/**
 * Reserva de porta das instâncias efêmeras — intervenção dirigida sobre `efemero-comum.ts`,
 * acatando o veredito do Gate 2 da T4 da fatia `fundacao-multitenancy-identidade`.
 *
 * ---------------------------------------------------------------------------
 * INVARIANTES
 * ---------------------------------------------------------------------------
 *
 * | Critério | Caso | Invariante |
 * |---|---|---|
 * | CA-6 | CT-101 | Reservas concorrentes em PROCESSOS DISTINTOS, contendo ao mesmo tempo pela
 * |      |        | mesma faixa e com o sorteio do ponto de partida neutralizado, nunca devolvem
 * |      |        | a mesma porta duas vezes. Toda porta devolvida está dentro da faixa efêmera e
 * |      |        | fora das portas intocáveis. |
 * | CA-6 | CT-102 | Falsificação do CT-101: o MESMO exercício, contra uma cópia do módulo com a
 * |      |        | trava do núcleo removida — a forma anterior, que apenas sondava —, devolve
 * |      |        | porta repetida. A asserção do CT-101 reprova essa cópia. |
 *
 * ---------------------------------------------------------------------------
 * O defeito que estes dois casos existem para impedir de voltar
 * ---------------------------------------------------------------------------
 *
 * A reserva antiga não reservava: ela sondava a porta abrindo e FECHANDO um soquete e devolvia o
 * número. O serviço só amarrava a porta segundos mais tarde, ao fim de `initialise()`+`start()`,
 * e nessa janela outro processo da suíte sondava a mesma porta, encontrava-a livre e escolhia-a
 * também — uma das duas instâncias morria com "address already in use". O sintoma era um caso
 * reprovando de vez em quando, rápido, sob mutante causalmente irrelevante; foi assim que o
 * Gate 1 o encontrou, e foi assim que ele derrubou o CT-001 numa execução de `pnpm test` desta
 * intervenção. `.claude/rules/testing-stack.md` é explícita: teste instável é defeito, e não se
 * corrige com nova tentativa.
 *
 * O CT-102 é o que impede a rodada seguinte de trocar a trava por qualquer coisa "mais simples":
 * ele executa a forma antiga e exige que ela reprove. Sem esse par, o CT-101 sozinho passaria
 * verde também num mundo em que a colisão apenas ficou rara — e ficar rara foi exatamente o
 * estado que produziu o defeito.
 */

import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, onTestFinished } from 'vitest';
import { FAIXA_PORTAS_EFEMERAS } from './efemero-comum.ts';

/** Limite de um caso inteiro: subir os atores, coletar os resultados e encerrá-los. */
const LIMITE_CASO_MS = 90_000;

/** Limite de vida de um ator, contado pelo processo-pai. */
const LIMITE_ATOR_MS = 60_000;

/**
 * Quantos atores concorrem e quantas portas cada um reserva.
 *
 * Com o sorteio neutralizado no ator, os 8 disputam a mesma primeira porta da faixa, e os
 * 40 pedidos exercitam a varredura sob contenção real. A colisão da forma antiga aparece já no
 * primeiro par; o excedente existe para que a prova não dependa de um único encontro.
 */
const ATORES = 8;
const RESERVAS_POR_ATOR = 5;

/** Portas que a reserva jamais pode devolver — a mesma lista que o módulo sob teste protege. */
const PORTAS_INTOCAVEIS = [1025, 5432, 6379, 6380, 8025];

const ATOR = fileURLToPath(new URL('./cenario-reserva-de-porta.ts', import.meta.url));
const MODULO_SOB_TESTE = fileURLToPath(new URL('./efemero-comum.ts', import.meta.url));

/**
 * Início da linha que amarra a porta no núcleo. É ela, e só ela, que separa reservar de sondar.
 *
 * A âncora é o começo da chamada, e não a linha inteira: o argumento é um literal com
 * interpolação, e prendê-lo aqui faria a geração do mutante quebrar a cada reformatação do
 * módulo, sem que nada de substantivo tivesse mudado.
 *
 * Se esta âncora deixar de existir — ou aparecer mais de uma vez — a geração ESTOURA em vez de
 * produzir uma cópia igual ao original: um mutante que não muda nada aprovaria o CT-102 sem
 * provar coisa alguma, que é o antipadrão de "asserção que não pode falhar".
 */
const ANCORA_DA_TRAVA = 'trava.listen(';

/** O que entra no lugar da linha ancorada: a trava vira promessa vazia — a forma anterior. */
const MUTACAO_SEM_TRAVA = [
  '    void trava;',
  '    void PREFIXO_TRAVA_DE_PORTA;',
  "    resolver('obtida');",
].join('\n');

interface ResultadoDoAtor {
  pid: number;
  portas: number[];
}

/** Cria uma raiz temporária do caso e a apaga no encerramento registrado. */
async function raizTemporariaDoCaso(): Promise<string> {
  const raiz = await mkdtemp(join(tmpdir(), 'sysloc-reserva-'));
  onTestFinished(() => rm(raiz, { recursive: true, force: true }));
  return raiz;
}

/**
 * Escreve, na raiz temporária, uma cópia do módulo com a trava do núcleo removida.
 *
 * A cópia é derivada do ARQUIVO REAL, e não reimplementada aqui: uma reimplementação da forma
 * antiga provaria apenas que a reimplementação colide, e continuaria verde no dia em que o
 * módulo de verdade regredisse. O módulo só depende de `node:net`, então a cópia é executável
 * de qualquer diretório.
 */
async function gerarModuloSemTrava(raiz: string): Promise<string> {
  const linhas = (await readFile(MODULO_SOB_TESTE, 'utf8')).split('\n');
  const ancoradas = linhas
    .map((linha, indice) => ({ linha, indice }))
    .filter(({ linha }) => linha.trimStart().startsWith(ANCORA_DA_TRAVA));

  if (ancoradas.length !== 1) {
    throw new Error(
      `a âncora '${ANCORA_DA_TRAVA}' abre ${ancoradas.length} linha(s) de ${MODULO_SOB_TESTE}, ` +
        'e o mutante do CT-102 exige exatamente uma. A trava mudou de forma: reescreva a âncora ' +
        'antes de seguir, sob pena de o caso passar contra uma cópia idêntica ao original.',
    );
  }

  const alvo = ancoradas[0]?.indice ?? -1;
  const mutante = [...linhas.slice(0, alvo), MUTACAO_SEM_TRAVA, ...linhas.slice(alvo + 1)].join(
    '\n',
  );

  const destino = join(raiz, 'efemero-sem-trava.ts');
  await writeFile(destino, mutante, 'utf8');
  return destino;
}

/**
 * Roda `ATORES` atores contra o módulo indicado e devolve o que cada um reservou.
 *
 * O encerramento é o ponto delicado: os atores só são liberados DEPOIS que todos reportaram, e é
 * essa ordem que garante que as reservas coexistiram. Liberar cada um assim que ele responde
 * devolveria travas ao núcleo no meio do exercício e a coincidência observada deixaria de
 * significar corrida.
 */
async function reservarEmParalelo(caminhoDoModulo: string): Promise<ResultadoDoAtor[]> {
  const filhos = Array.from({ length: ATORES }, () =>
    spawn(process.execPath, [ATOR, caminhoDoModulo, String(RESERVAS_POR_ATOR)], {
      stdio: ['pipe', 'pipe', 'pipe'],
    }),
  );

  // Mata o que sobreviver, aconteça o que acontecer com as asserções deste caso.
  onTestFinished(() => {
    for (const filho of filhos) {
      if (filho.exitCode === null && filho.signalCode === null) {
        filho.kill('SIGKILL');
      }
    }
  });

  const reportados = filhos.map(
    (filho) =>
      new Promise<ResultadoDoAtor>((resolver, rejeitar) => {
        let saida = '';
        let erro = '';

        filho.stdout.setEncoding('utf8');
        filho.stderr.setEncoding('utf8');
        filho.stderr.on('data', (pedaco: string) => {
          erro += pedaco;
        });
        filho.stdout.on('data', (pedaco: string) => {
          saida += pedaco;
          const linha = saida.split('\n').find((candidata) => candidata.startsWith('RESULTADO='));
          if (linha !== undefined) {
            resolver(JSON.parse(linha.slice('RESULTADO='.length)) as ResultadoDoAtor);
          }
        });

        const limite = setTimeout(() => {
          filho.kill('SIGKILL');
          rejeitar(new Error(`um ator não reportou em ${LIMITE_ATOR_MS} ms:\n${erro}`));
        }, LIMITE_ATOR_MS);
        limite.unref();

        filho.on('error', rejeitar);
        filho.on('close', (codigo, sinal) => {
          clearTimeout(limite);
          rejeitar(
            new Error(
              `um ator saiu (código ${codigo}, sinal ${sinal}) sem imprimir o resultado:\n` +
                `${erro || saida}`,
            ),
          );
        });
      }),
  );

  try {
    return await Promise.all(reportados);
  } finally {
    // Só agora: todos já reservaram, e a coexistência das reservas está estabelecida.
    for (const filho of filhos) {
      filho.stdin.end();
    }
  }
}

/** Achata os resultados numa lista única de portas, na ordem em que os atores reportaram. */
function todasAsPortas(resultados: ResultadoDoAtor[]): number[] {
  return resultados.flatMap((resultado) => resultado.portas);
}

/** As portas que apareceram mais de uma vez — o achado que discrimina corrida de reserva. */
function portasRepetidas(portas: number[]): number[] {
  return [...new Set(portas.filter((porta, indice) => portas.indexOf(porta) !== indice))].sort(
    (a, b) => a - b,
  );
}

describe('reserva de porta das instâncias efêmeras (intervenção dirigida · Gate 2 da T4)', () => {
  it('CT-101 — reservas concorrentes em processos distintos nunca devolvem a mesma porta', {
    timeout: LIMITE_CASO_MS,
  }, async () => {
    const resultados = await reservarEmParalelo(MODULO_SOB_TESTE);
    const portas = todasAsPortas(resultados);

    // O exercício só vale se os atores forem mesmo processos distintos e todos tiverem
    // reservado tudo o que se pediu — sem isto, uma lista curta passaria por não-colidente.
    expect(new Set(resultados.map((resultado) => resultado.pid)).size).toBe(ATORES);
    expect(portas).toHaveLength(ATORES * RESERVAS_POR_ATOR);

    expect(portasRepetidas(portas)).toEqual([]);

    for (const porta of portas) {
      expect(porta).toBeGreaterThanOrEqual(FAIXA_PORTAS_EFEMERAS.primeira);
      expect(porta).toBeLessThanOrEqual(FAIXA_PORTAS_EFEMERAS.ultima);
      expect(PORTAS_INTOCAVEIS).not.toContain(porta);
    }
  });

  it('CT-102 — sem a trava do núcleo, o mesmo exercício devolve porta repetida', {
    timeout: LIMITE_CASO_MS,
  }, async () => {
    const raiz = await raizTemporariaDoCaso();
    const semTrava = await gerarModuloSemTrava(raiz);

    const resultados = await reservarEmParalelo(semTrava);
    const portas = todasAsPortas(resultados);

    expect(new Set(resultados.map((resultado) => resultado.pid)).size).toBe(ATORES);
    expect(portas).toHaveLength(ATORES * RESERVAS_POR_ATOR);

    // O controle: a mesma asserção do CT-101, aplicada à cópia com o defeito de volta,
    // REPROVA. É isto — e não a passagem do CT-101 — que prova que o CT-101 pode falhar.
    expect(portasRepetidas(portas).length).toBeGreaterThan(0);
  });
});
