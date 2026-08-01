/**
 * Ator dos cenários que só podem ser observados de FORA do processo — T4 da fatia
 * `fundacao-stack-nativa`.
 *
 * Três casos da suíte precisam de um processo separado, e por motivos diferentes:
 *
 *   * **CT-003** monta o ambiente EXPLICITAMENTE (sem as variáveis de conexão, ou com elas
 *     apontando para um servidor sentinela). Mudar `process.env` do processo da suíte vazaria
 *     para os casos vizinhos e quebraria a independência entre eles.
 *   * **CT-004** provoca término anômalo. O observador não pode ser o processo que morre.
 *   * **CT-006** monta um `PATH` sem o binário provisionado da fila, que é a mesma razão do
 *     CT-003 — e sem precisar de parâmetro de "caminho do binário" nos helpers, que existiria
 *     só para o teste apontá-lo a lugar nenhum.
 *
 * Este arquivo é FIXTURE de teste: quem o executa é o caso, com `node <este arquivo> <cenário>`.
 * Ele não é importado por nada em produção, e o rastro que ele grava é escrito por código de
 * teste — nenhum gancho de diagnóstico foi acrescentado aos helpers para viabilizá-lo.
 *
 * Uso:
 *   node cenario-subprocesso.ts sondas
 *   node cenario-subprocesso.ts rastro-asercao|rastro-excecao|rastro-sigterm  (env SYSLOC_RASTRO)
 *   node cenario-subprocesso.ts fila-sem-binario
 */

import { strict as afirmar } from 'node:assert';
import { writeFileSync } from 'node:fs';
import postgres from 'postgres';
import { postgresEfemero } from './postgres-efemero.ts';
import { comandoFila, redisEfemero } from './redis-efemero.ts';

/** Prefixo da linha que o processo-pai analisa. Tudo mais em `stdout` é diagnóstico. */
const MARCA_RESULTADO = 'RESULTADO=';

async function sondarInstancias(): Promise<void> {
  const banco = await postgresEfemero();
  const fila = await redisEfemero();

  const sql = postgres(banco.cadeiaConexao, { max: 1, onnotice: () => {} });
  try {
    const linhas = await sql`SELECT 1 AS um`;
    const pong = await comandoFila(fila.porta, 'PING');

    process.stdout.write(
      `${MARCA_RESULTADO}${JSON.stringify({
        portaBanco: banco.porta,
        portaFila: fila.porta,
        um: linhas[0]?.um,
        pong,
      })}\n`,
    );
  } finally {
    await sql.end();
    await fila.parar();
    await banco.parar();
  }
}

async function gravarRastroEEncerrar(modo: string): Promise<void> {
  const destino = process.env.SYSLOC_RASTRO;
  if (destino === undefined || destino === '') {
    throw new Error('SYSLOC_RASTRO não foi informado — sem ele o processo-pai não tem o que ler');
  }

  const banco = await postgresEfemero();
  const fila = await redisEfemero();

  // Gravação SÍNCRONA e antes de provocar o término: o pai só consegue verificar processo órfão
  // e diretório remanescente se souber os identificadores de antes da morte.
  writeFileSync(
    destino,
    JSON.stringify({
      banco: { pid: banco.pid, porta: banco.porta, diretorioDados: banco.diretorioDados },
      fila: { pid: fila.pid, porta: fila.porta, diretorioDados: fila.diretorioDados },
    }),
    'utf8',
  );

  switch (modo) {
    case 'asercao':
      afirmar.equal('a instância efêmera some', 'a instância efêmera fica para trás');
      return;
    case 'excecao':
      throw new Error('estouro deliberado do cenário de término anômalo');
    case 'sigterm':
      process.kill(process.pid, 'SIGTERM');
      // O sinal não interrompe a execução aqui mesmo; a espera abaixo existe para que o
      // processo continue vivo até o manipulador rodar, em vez de sair por laço de eventos
      // vazio e mascarar o modo de término que o caso quer provar.
      await new Promise(() => {});
      return;
    default:
      throw new Error(`modo de término desconhecido: ${modo}`);
  }
}

async function principal(): Promise<void> {
  const cenario = process.argv[2] ?? '';

  switch (cenario) {
    case 'sondas':
      await sondarInstancias();
      return;
    case 'rastro-asercao':
      await gravarRastroEEncerrar('asercao');
      return;
    case 'rastro-excecao':
      await gravarRastroEEncerrar('excecao');
      return;
    case 'rastro-sigterm':
      await gravarRastroEEncerrar('sigterm');
      return;
    case 'fila-sem-binario': {
      // A rejeição é deliberadamente NÃO capturada: o cenário exige que ela derrube o processo
      // com código diferente de zero e que a mensagem chegue inteira ao `stderr`.
      const fila = await redisEfemero();
      await fila.parar();
      throw new Error('a fila efêmera subiu mesmo sem o binário no PATH — cenário inválido');
    }
    default:
      throw new Error(`cenário desconhecido: '${cenario}'`);
  }
}

await principal();
