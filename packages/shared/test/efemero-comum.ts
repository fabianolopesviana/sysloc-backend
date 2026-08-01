/**
 * Fundamento comum das instâncias efêmeras da verificação — T4 da fatia
 * `fundacao-stack-nativa`.
 *
 * Três coisas que o helper do banco e o da fila precisam exatamente do mesmo jeito, e que
 * seriam defeito se divergissem entre eles:
 *
 *   1. **A faixa de portas.** Uma instância efêmera que subisse em 6380 sequestraria a fila
 *      PROVISIONADA por `provisionar-base.sh` — o dano exato que a ADR-0006 existe para
 *      impedir. A faixa é fixada aqui, uma vez, e o guarda de portas intocáveis é aplicado a
 *      toda porta escolhida, mesmo sendo redundante com a faixa: é a redundância que sobrevive
 *      a alguém mexer nos limites sem ler o resto do arquivo.
 *   2. **O descarte no caminho de FALHA.** Limpeza que só roda no caminho feliz deixa processo
 *      órfão e diretório de dados para trás quando a suíte quebra — e o disco desta máquina
 *      opera acima de 75%. O registro abaixo pendura o descarte no mecanismo de encerramento
 *      do runtime, não no `finally` de quem escreveu o teste.
 *   3. **A espera por estado observável.** Sondagem com limite declarado, nunca espera fixa
 *      (`.claude/rules/testing-stack.md`, política de flaky).
 *
 * Este arquivo é infraestrutura de teste: ele não é compilado para `dist/` (o `tsconfig.json`
 * do pacote alcança apenas `src/`) e nada em produção o importa.
 */

import { createServer } from 'node:net';

/**
 * Faixa de portas das instâncias efêmeras.
 *
 * Escolhida por exclusão, e não por gosto:
 *
 *   * fora de `PORTAS_PROVISIONADAS` (6380, 1025, 8025) — as três que `provisionar-base.sh`
 *     abre nesta máquina;
 *   * fora das portas padrão dos serviços (5432 do banco, 6379 da fila do ambiente legado);
 *   * fora da faixa efêmera do próprio sistema operacional (32768–60999 no Linux), de onde o
 *     núcleo tira porta de origem para conexão de saída — subir um servidor lá é convidar
 *     colisão com um cliente qualquer da máquina;
 *   * acima de 1024, para nunca exigir privilégio;
 *   * fora da faixa 11000–20000, que a pilha do ambiente legado (CloudPanel) já ocupa.
 */
export const FAIXA_PORTAS_EFEMERAS = { primeira: 24001, ultima: 24999 } as const;

/**
 * Portas que uma instância efêmera não pode ocupar em hipótese alguma. As três primeiras são
 * as que o provisionamento (T2) abre; as duas últimas são as padrão do banco e da fila.
 *
 * A faixa acima já as exclui — este guarda existe para o dia em que alguém alargar a faixa.
 */
const PORTAS_INTOCAVEIS = [1025, 5432, 6379, 6380, 8025] as const;

/** Intervalo entre duas leituras do estado observável, em milissegundos. */
const INTERVALO_SONDAGEM_MS = 50;

/** Limite para uma porta candidata aceitar e liberar o soquete de teste. */
const LIMITE_SONDA_DE_PORTA_MS = 2_000;

/** Descarte síncrono de um recurso efêmero, executável de dentro do gancho de encerramento. */
type Descarte = () => void;

const descartesPendentes = new Set<Descarte>();

let manipuladoresInstalados = false;

/**
 * Sinais que matam o processo sem passar pelo evento `exit`. Sem um manipulador explícito para
 * cada um deles, um `SIGTERM` na suíte deixaria a instância efêmera viva e o diretório de dados
 * no disco — o modo de falha que o CT-004 persegue.
 */
const SINAIS_DE_TERMINO = ['SIGINT', 'SIGTERM', 'SIGHUP'] as const;

/**
 * Executa e desregistra todos os descartes pendentes.
 *
 * Roda em contexto SÍNCRONO (gancho de `exit` e de sinal), onde promessa não é aguardada e
 * `console.log` com destino em cano pode se perder. Por isso o diagnóstico vai por
 * `process.stderr.write` e o registro estruturado de T3 fica de fora: ele é assíncrono por
 * desenho e não teria como escrever daqui.
 *
 * Falha de um descarte não interrompe os demais — cada instância é independente, e abortar no
 * primeiro erro deixaria as outras para trás, que é justamente o resíduo que se quer evitar.
 */
function executarDescartes(): void {
  for (const descarte of [...descartesPendentes]) {
    descartesPendentes.delete(descarte);
    try {
      descarte();
    } catch (erro) {
      const motivo = erro instanceof Error ? erro.message : String(erro);
      process.stderr.write(`[efemero] descarte falhou no encerramento: ${motivo}\n`);
    }
  }
}

function instalarManipuladores(): void {
  if (manipuladoresInstalados) {
    return;
  }
  manipuladoresInstalados = true;

  // `exit` cobre o encerramento normal, o `process.exit()` explícito e a exceção não capturada
  // (o manipulador padrão do runtime encerra com código 1, e isso dispara `exit`).
  process.on('exit', executarDescartes);

  for (const sinal of SINAIS_DE_TERMINO) {
    process.on(sinal, () => {
      executarDescartes();
      // Devolver o sinal ao processo é o que preserva a CAUSA do término: sem isso, quem
      // observa de fora veria um código de saída comum onde houve um sinal. Os demais ouvintes
      // do MESMO sinal são removidos antes porque um ouvinte remanescente suprime a ação
      // padrão do runtime — e a biblioteca do banco efêmero instala o seu, que converteria a
      // morte por sinal em `process.exit(143)`. O descarte acima já é completo e síncrono:
      // não há trabalho de terceiro a preservar depois dele.
      process.removeAllListeners(sinal);
      process.kill(process.pid, sinal);
    });
  }
}

/**
 * Pendura um descarte no encerramento do processo e devolve a função que o solta.
 *
 * Quem chama deve soltar o descarte assim que o recurso for descartado pelo caminho normal —
 * caso contrário o gancho tentaria matar um processo que já morreu.
 */
export function registrarDescarte(descarte: Descarte): () => void {
  instalarManipuladores();
  descartesPendentes.add(descarte);
  return () => {
    descartesPendentes.delete(descarte);
  };
}

/** Testa se uma porta aceita escuta agora, abrindo e fechando um soquete de sondagem. */
function portaLivre(porta: number): Promise<boolean> {
  return new Promise((resolver) => {
    const sonda = createServer();
    const limite = setTimeout(() => {
      sonda.close();
      resolver(false);
    }, LIMITE_SONDA_DE_PORTA_MS);

    sonda.once('error', () => {
      clearTimeout(limite);
      resolver(false);
    });
    sonda.once('listening', () => {
      clearTimeout(limite);
      sonda.close(() => resolver(true));
    });
    sonda.listen(porta, '127.0.0.1');
  });
}

/**
 * Escolhe uma porta livre dentro da faixa efêmera.
 *
 * A varredura começa em posição sorteada, e não no início da faixa: arquivos de teste rodam em
 * paralelo, e começar sempre em 24001 faria dois processos disputarem a mesma porta a cada
 * execução. O sorteio não entra em nenhuma asserção — ele escolhe onde procurar, não o que
 * provar.
 */
export async function reservarPorta(): Promise<number> {
  const { primeira, ultima } = FAIXA_PORTAS_EFEMERAS;
  const total = ultima - primeira + 1;
  const deslocamento = Math.floor(Math.random() * total);

  for (let tentativa = 0; tentativa < total; tentativa += 1) {
    const porta = primeira + ((deslocamento + tentativa) % total);
    if (PORTAS_INTOCAVEIS.includes(porta as (typeof PORTAS_INTOCAVEIS)[number])) {
      continue;
    }
    if (await portaLivre(porta)) {
      return porta;
    }
  }

  throw new Error(
    `nenhuma porta livre na faixa efêmera ${primeira}-${ultima}: as ${total} portas da faixa ` +
      'estão ocupadas nesta máquina',
  );
}

const esperar = (ms: number): Promise<void> =>
  new Promise((resolver) => {
    setTimeout(resolver, ms);
  });

/**
 * Aguarda uma condição observável até o limite declarado, sondando em intervalos regulares.
 *
 * Substitui a espera de tempo fixo, que é proibida pela política de flaky do projeto: um
 * `sleep` calibrado numa máquina ociosa é falha intermitente numa máquina carregada.
 */
export async function sondarAte(
  rotulo: string,
  condicao: () => boolean | Promise<boolean>,
  limiteMs: number,
  intervaloMs: number = INTERVALO_SONDAGEM_MS,
): Promise<void> {
  const prazo = Date.now() + limiteMs;

  for (;;) {
    if (await condicao()) {
      return;
    }
    if (Date.now() >= prazo) {
      throw new Error(`tempo esgotado aguardando ${rotulo} (limite de ${limiteMs} ms)`);
    }
    await esperar(intervaloMs);
  }
}

/** Responde se o processo de `pid` ainda existe, sem lhe enviar sinal algum. */
export function processoVivo(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}
