/**
 * Ator do exercício de concorrência da reserva de porta — intervenção dirigida sobre
 * `efemero-comum.ts` (veredito do Gate 2 da T4).
 *
 * A propriedade sob prova é entre PROCESSOS: duas reservas concorrentes não podem coincidir. Ela
 * não é observável de dentro de um processo só, porque o árbitro é o núcleo e o que se quer
 * provar é justamente que ele arbitra entre partes que não se conhecem.
 *
 * ---------------------------------------------------------------------------
 * Duas escolhas deste ator que o caso depende, e por quê
 * ---------------------------------------------------------------------------
 *
 *   1. **O sorteio do ponto de partida é neutralizado.** Na forma antiga da reserva o sorteio era
 *      a mitigação da corrida: com ele intacto, a colisão aparece em cerca de metade das rodadas
 *      de 8 processos × 5 reservas — o suficiente para diagnosticar, e insuficiente para um caso
 *      de teste, que passaria a acusar o defeito ORA SIM ORA NÃO. Um teste probabilístico contra
 *      instabilidade seria ele próprio instável. Com todos os processos partindo do início da
 *      faixa, a contenção é máxima e o veredito é determinístico nos dois sentidos: a forma
 *      correta nunca repete, a forma antiga sempre repete.
 *
 *   2. **O ator segura as reservas até o processo-pai mandar sair.** Ele imprime o resultado e
 *      espera a entrada padrão FECHAR. Sem isso, um ator que terminasse cedo devolveria as
 *      travas ao núcleo e o ator seguinte poderia legitimamente reusar as mesmas portas — o caso
 *      acusaria colisão onde não houve concorrência. A espera é por evento, não por tempo: é o
 *      pai que decide o instante, depois de todos terem reportado, e é isso que garante que as
 *      N reservas coexistiram.
 *
 * Este arquivo é FIXTURE de teste: quem o executa é o caso, com
 * `node <este arquivo> <caminho-do-módulo> <quantas>`. O caminho do módulo é parâmetro porque o
 * caso de falsificação aponta o ator para uma CÓPIA MUTANTE do módulo, com a trava removida — o
 * ator é o mesmo nos dois lados, e é a igualdade do ator que faz o par valer como prova.
 */

import { pathToFileURL } from 'node:url';

/** Prefixo da linha que o processo-pai analisa. Tudo mais em `stdout` é diagnóstico. */
const MARCA_RESULTADO = 'RESULTADO=';

interface ModuloDeReserva {
  reservarPorta: () => Promise<number>;
}

async function principal(): Promise<void> {
  const caminhoDoModulo = process.argv[2] ?? '';
  const quantas = Number.parseInt(process.argv[3] ?? '', 10);

  if (caminhoDoModulo === '') {
    throw new Error('o caminho do módulo de reserva não foi informado');
  }
  if (!Number.isInteger(quantas) || quantas <= 0) {
    throw new Error(`quantidade de reservas inválida: '${process.argv[3]}'`);
  }

  // Anula o sorteio ANTES de o módulo ser carregado. Por isso a importação é dinâmica: uma
  // importação estática seria içada para antes desta linha e o módulo já teria lido o sorteio
  // original em tempo de carga, caso um dia passasse a lê-lo ali.
  Math.random = (): number => 0;

  const modulo: ModuloDeReserva = await import(pathToFileURL(caminhoDoModulo).href);

  const portas: number[] = [];
  for (let indice = 0; indice < quantas; indice += 1) {
    portas.push(await modulo.reservarPorta());
  }

  process.stdout.write(`${MARCA_RESULTADO}${JSON.stringify({ pid: process.pid, portas })}\n`);

  // Segura as reservas até o pai fechar a entrada padrão — ver a escolha 2 no cabeçalho.
  await new Promise<void>((resolver) => {
    process.stdin.on('end', resolver);
    process.stdin.on('close', resolver);
    process.stdin.resume();
  });
}

await principal();
