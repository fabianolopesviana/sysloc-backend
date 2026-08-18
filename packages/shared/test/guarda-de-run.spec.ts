/**
 * Barreira executável da Guarda de Continuidade do Run — CT-954 a CT-966.
 *
 * A faixa **CT-9xx é deliberada**, pela mesma razão que `protocolo-antirregressao.spec.ts`
 * documenta: estes casos não provam regra de domínio, provam o substrato do pipeline. A
 * sequência de domínio cresce fatia a fatia e alcançaria qualquer faixa baixa que se
 * escolhesse. O último 9xx alocado antes deste arquivo era o CT-953.
 *
 * ---------------------------------------------------------------------------
 * INVARIANTES
 * ---------------------------------------------------------------------------
 *
 * | CT     | Invariante |
 * |--------|------------|
 * | CT-954 | Plano sem pendência não bloqueia — a guarda é silenciosa no caso normal. |
 * | CT-955 | Task `A Fazer` com TODAS as dependências `Concluído` bloqueia, e a razão nomeia
 * |        | a task devida. É o controle POSITIVO do par com o CT-954. |
 * | CT-956 | Task `A Fazer` com dependência aberta NÃO bloqueia — despacho não é devido. |
 * | CT-957 | Task `Em Progresso` bloqueia, e tem PRECEDÊNCIA sobre a task pronta. |
 * | CT-958 | Sem marcador `_run/.run-ativo` a guarda é inerte — fora de run ela não existe. |
 * | CT-959 | Marcador vinculado a OUTRA sessão não bloqueia a sessão corrente. |
 * | CT-960 | O orçamento de reincidência tem teto: ao esgotá-lo a guarda LIBERA o encerramento. |
 * | CT-961 | Progresso muda a assinatura do estado e ZERA o orçamento. |
 * | CT-962 | Marcador abandonado (mais velho que o TTL) não prende a sessão. |
 * | CT-963 | Falha para o lado ABERTO: entrada não-JSON, sem `session_id` e plano ausente
 * |        | saem em silêncio, com código 0 e sem bloquear. |
 * | CT-964 | `SYSLOC_SEM_GUARDA_DE_RUN=1` desliga a guarda por completo. |
 * | CT-965 | `--armar` cria o marcador e `--desarmar` o remove. |
 * | CT-966 | A tabela lida é a de EXECUÇÃO, não a de rastreabilidade de User Stories — cujas
 * |        | linhas ficam `A Fazer` para sempre por design e produziriam bloqueio eterno. |
 *
 * ---------------------------------------------------------------------------
 * Por que uma barreira, e por que ELA e não outra coisa
 * ---------------------------------------------------------------------------
 *
 * A guarda é um gancho de `Stop`: ela roda fora da suíte, sem ninguém olhando, e o modo de
 * falha que mais importa é SILENCIOSO nos dois sentidos. Se ela deixar de detectar, o run volta
 * a parar no meio e ninguém percebe que a guarda parou de funcionar — o sintoma é
 * indistinguível de um run que simplesmente acabou. Se ela detectar demais, ela APRISIONA a
 * sessão: o turno não termina e não há caminho de código que o solte. Os dois lados precisam de
 * prova, e é por isso que metade dos casos abaixo prova o NÃO-bloqueio.
 *
 * ---------------------------------------------------------------------------
 * Natureza das asserções e o que isto NÃO exige
 * ---------------------------------------------------------------------------
 *
 * Toda asserção aqui é **comportamental**: cada caso executa o script de verdade, com entrada
 * sintética, e observa a saída. Pela tabela do P4 de `.claude/rules/nao-regressao.md`, asserção
 * comportamental **não se demonstra por execução de mutante** — o caso já reprova naturalmente
 * com o código antigo. A asserção que discrimina, em cada par, é a presença de `decision:
 * "block"` na saída padrão: o predicado não tem outra forma de manifestar a decisão, e nenhum
 * dos casos negativos pode produzi-la por acidente, porque o script só a emite no fim de um
 * caminho que exige marcador, vínculo de sessão, TTL válido e veredito não-vazio.
 *
 * A prova de falsificação por execução seria exigida se estes casos inspecionassem o TEXTO do
 * script (`grep` sobre o fonte). Eles não o fazem, deliberadamente: uma asserção sobre o texto
 * do gancho ficaria verde com o gancho quebrado, que é o defeito exato que a guarda existe para
 * não ter.
 */

import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const RAIZ_DO_REPOSITORIO = fileURLToPath(new URL('../../..', import.meta.url));
const GANCHO = join(RAIZ_DO_REPOSITORIO, 'deploy/scripts/run/guarda-de-run.sh');

const FEATURE = 'fixture-da-guarda';

/** Linhas de tabela no formato que os geradores do agent-spec emitem. */
interface LinhaDeTask {
  readonly id: string;
  readonly dependencias: string;
  readonly status: string;
}

/**
 * Monta um `task_plan.md` com a tabela de execução — e, opcionalmente, a de rastreabilidade
 * que existe em todo plano real e cujas linhas nunca saem de `A Fazer`.
 */
function planoCom(tasks: readonly LinhaDeTask[], comTabelaDeRastreabilidade = false): string {
  const cabecalho =
    '| ID | Nome da Task | Arquivo | Fase | Dependências | Pode Rodar em Paralelo? | Status |\n' +
    '|---|---|---|---|---|---|---|\n';
  const linhas = tasks
    .map(
      (t) =>
        `| ${t.id} | nome | [${t.id}](tasks/${t.id}.md) | 1 | ${t.dependencias} | Não | ${t.status} |`,
    )
    .join('\n');
  const rastreabilidade = comTabelaDeRastreabilidade
    ? '\n\n## 6. Rastreabilidade\n\n' +
      '| User Story (PRD) | Definição Técnica (SPEC) | Tasks Relacionadas | Status |\n' +
      '|---|---|---|---|\n' +
      '| US-01 — alguma coisa | §7.2 | T1, T2 | A Fazer |\n' +
      '| US-02 — outra coisa | §7.3 | T2 | A Fazer |\n'
    : '';
  return `# Plano\n\n## 4. Tasks\n\n${cabecalho}${linhas}\n${rastreabilidade}`;
}

/** Ambiente isolado: uma raiz de projeto sintética e um diretório de orçamento só deste caso. */
interface Ambiente {
  readonly raiz: string;
  readonly temp: string;
  readonly plano: string;
  readonly marcador: string;
}

let ambiente: Ambiente;

beforeEach(() => {
  const base = mkdtempSync(join(tmpdir(), 'guarda-de-run-'));
  const diretorioDaFatia = join(base, 'raiz', 'docs/specs/features', FEATURE, 'v1');
  mkdirSync(join(diretorioDaFatia, '_run'), { recursive: true });
  mkdirSync(join(base, 'temp'), { recursive: true });
  ambiente = {
    raiz: join(base, 'raiz'),
    temp: join(base, 'temp'),
    plano: join(diretorioDaFatia, 'task_plan.md'),
    marcador: join(diretorioDaFatia, '_run', '.run-ativo'),
  };
});

afterEach(() => {
  rmSync(join(ambiente.raiz, '..'), { recursive: true, force: true });
});

interface Resultado {
  readonly stdout: string;
  readonly stderr: string;
  readonly codigo: number;
}

/**
 * `spawnSync`, e NÃO `execFileSync`: o segundo devolve apenas a saída padrão no caminho de
 * sucesso, e a guarda comunica pela saída de erro justamente quando NÃO bloqueia (marcador
 * abandonado, orçamento esgotado). Com `execFileSync` os casos que provam essas duas liberações
 * ficariam cegos — asserção sobre um fluxo que o arranjo nunca captura.
 */
function executar(
  argumentos: readonly string[],
  entrada: string,
  extra: Record<string, string> = {},
): Resultado {
  const processo = spawnSync('bash', [GANCHO, ...argumentos], {
    input: entrada,
    encoding: 'utf8',
    env: {
      ...process.env,
      CLAUDE_PROJECT_DIR: ambiente.raiz,
      TMPDIR: ambiente.temp,
      ...extra,
    },
  });
  return {
    stdout: processo.stdout ?? '',
    stderr: processo.stderr ?? '',
    codigo: processo.status ?? 1,
  };
}

/** Um fim de turno da sessão informada. */
function fimDeTurno(sessao = 'sessao-corrente', extra: Record<string, string> = {}): Resultado {
  return executar([], JSON.stringify({ session_id: sessao, stop_hook_active: false }), extra);
}

function armar(): void {
  executar(['--armar', ambiente.plano], '');
}

function vincularA(sessao: string): void {
  armar();
  writeFileSync(
    ambiente.marcador,
    `criado_em: 2026-08-18T00:00:00-03:00\ntask_plan: x\nsession_id: ${sessao}\n`,
    'utf8',
  );
}

/** A asserção que discrimina: o script só emite `decision: "block"` ao decidir bloquear. */
function bloqueou(resultado: Resultado): boolean {
  if (resultado.stdout.trim() === '') return false;
  const corpo = JSON.parse(resultado.stdout) as { decision?: string; reason?: string };
  return corpo.decision === 'block';
}

function razao(resultado: Resultado): string {
  return (JSON.parse(resultado.stdout) as { reason: string }).reason;
}

describe('Guarda de Continuidade do Run — o gancho de Stop', () => {
  it('CT-954: não bloqueia quando nenhuma task é devida', () => {
    writeFileSync(
      ambiente.plano,
      planoCom([
        { id: 'T1', dependencias: '—', status: 'Concluído' },
        { id: 'T2', dependencias: 'T1', status: 'Concluído' },
      ]),
    );
    armar();

    const resultado = fimDeTurno();

    expect(resultado.codigo).toBe(0);
    expect(resultado.stdout.trim()).toBe('');
  });

  it('CT-955: bloqueia quando há task pronta, e a razão nomeia a task devida', () => {
    writeFileSync(
      ambiente.plano,
      planoCom([
        { id: 'T1', dependencias: '—', status: 'Concluído' },
        { id: 'T2', dependencias: 'T1', status: 'A Fazer' },
      ]),
    );
    armar();

    const resultado = fimDeTurno();

    expect(bloqueou(resultado)).toBe(true);
    // Nomear a task é o que separa um bloqueio acionável de um alarme genérico.
    expect(razao(resultado)).toContain('T2');
    expect(razao(resultado)).toContain('autonomia-do-run.md');
  });

  it('CT-956: não bloqueia quando a dependência da task ainda está aberta', () => {
    writeFileSync(
      ambiente.plano,
      planoCom([
        { id: 'T1', dependencias: '—', status: 'Bloqueado' },
        { id: 'T2', dependencias: 'T1', status: 'A Fazer' },
      ]),
    );
    armar();

    expect(bloqueou(fimDeTurno())).toBe(false);
  });

  it('CT-957: task Em Progresso bloqueia e tem precedência sobre a task pronta', () => {
    writeFileSync(
      ambiente.plano,
      planoCom([
        { id: 'T1', dependencias: '—', status: 'Concluído' },
        { id: 'T2', dependencias: 'T1', status: 'A Fazer' },
        { id: 'T3', dependencias: 'T1', status: 'Em Progresso' },
      ]),
    );
    armar();

    const resultado = fimDeTurno();

    expect(bloqueou(resultado)).toBe(true);
    // A execução interrompida é o defeito mais grave; relatar a T2 esconderia a T3.
    expect(razao(resultado)).toContain('T3');
    expect(razao(resultado)).toContain('Em Progresso');
  });

  it('CT-958: é inerte sem o marcador — fora de um run a guarda não existe', () => {
    writeFileSync(ambiente.plano, planoCom([{ id: 'T1', dependencias: '—', status: 'A Fazer' }]));
    // Sem armar().

    const resultado = fimDeTurno();

    expect(resultado.codigo).toBe(0);
    expect(resultado.stdout.trim()).toBe('');
  });

  it('CT-959: marcador vinculado a outra sessão não prende a sessão corrente', () => {
    writeFileSync(ambiente.plano, planoCom([{ id: 'T1', dependencias: '—', status: 'A Fazer' }]));
    vincularA('sessao-de-outro-run');

    expect(bloqueou(fimDeTurno('sessao-corrente'))).toBe(false);
    // E o run legítimo segue protegido.
    expect(bloqueou(fimDeTurno('sessao-de-outro-run'))).toBe(true);
  });

  it('CT-960: o orçamento de reincidência tem teto e libera o encerramento ao esgotar', () => {
    writeFileSync(ambiente.plano, planoCom([{ id: 'T1', dependencias: '—', status: 'A Fazer' }]));
    armar();

    const teto = { SYSLOC_GUARDA_TETO: '2' };
    expect(bloqueou(fimDeTurno('s', teto))).toBe(true);
    expect(bloqueou(fimDeTurno('s', teto))).toBe(true);

    const liberado = fimDeTurno('s', teto);
    expect(bloqueou(liberado)).toBe(false);
    expect(liberado.stderr).toContain('bloqueios seguidos sem progresso');
  });

  it('CT-961: progresso muda a assinatura do estado e zera o orçamento', () => {
    writeFileSync(
      ambiente.plano,
      planoCom([
        { id: 'T1', dependencias: '—', status: 'A Fazer' },
        { id: 'T2', dependencias: 'T1', status: 'A Fazer' },
      ]),
    );
    armar();

    const teto = { SYSLOC_GUARDA_TETO: '1' };
    expect(bloqueou(fimDeTurno('s', teto))).toBe(true);
    expect(bloqueou(fimDeTurno('s', teto))).toBe(false); // teto de 1 esgotado

    // O run andou: T1 fechou e agora T2 é a devida.
    writeFileSync(
      ambiente.plano,
      planoCom([
        { id: 'T1', dependencias: '—', status: 'Concluído' },
        { id: 'T2', dependencias: 'T1', status: 'A Fazer' },
      ]),
    );

    const aposProgresso = fimDeTurno('s', teto);
    expect(bloqueou(aposProgresso)).toBe(true);
    expect(razao(aposProgresso)).toContain('T2');
  });

  it('CT-962: marcador abandonado não prende a sessão', () => {
    writeFileSync(ambiente.plano, planoCom([{ id: 'T1', dependencias: '—', status: 'A Fazer' }]));
    armar();
    const vinteHorasAtras = new Date(Date.now() - 20 * 60 * 60 * 1000);
    utimesSync(ambiente.marcador, vinteHorasAtras, vinteHorasAtras);

    const resultado = fimDeTurno();

    expect(bloqueou(resultado)).toBe(false);
    expect(resultado.stderr).toContain('abandonado');
  });

  it('CT-963: falha para o lado aberto em toda entrada degenerada', () => {
    writeFileSync(ambiente.plano, planoCom([{ id: 'T1', dependencias: '—', status: 'A Fazer' }]));
    armar();

    const naoJson = executar([], 'isto não é json {{{');
    expect(naoJson.codigo).toBe(0);
    expect(bloqueou(naoJson)).toBe(false);

    const semSessao = executar([], JSON.stringify({ stop_hook_active: false }));
    expect(semSessao.codigo).toBe(0);
    expect(bloqueou(semSessao)).toBe(false);

    rmSync(ambiente.plano);
    const semPlano = fimDeTurno();
    expect(semPlano.codigo).toBe(0);
    expect(bloqueou(semPlano)).toBe(false);
  });

  it('CT-964: a chave de desligamento desarma a guarda por completo', () => {
    writeFileSync(ambiente.plano, planoCom([{ id: 'T1', dependencias: '—', status: 'A Fazer' }]));
    armar();

    expect(bloqueou(fimDeTurno('s', { SYSLOC_SEM_GUARDA_DE_RUN: '1' }))).toBe(false);
    // E volta a valer sem a chave — o controle que separa "desligou" de "nunca funcionou".
    expect(bloqueou(fimDeTurno('s'))).toBe(true);
  });

  it('CT-965: --armar cria o marcador e --desarmar o remove', () => {
    writeFileSync(ambiente.plano, planoCom([{ id: 'T1', dependencias: '—', status: 'A Fazer' }]));

    expect(existsSync(ambiente.marcador)).toBe(false);
    executar(['--armar', ambiente.plano], '');
    expect(existsSync(ambiente.marcador)).toBe(true);
    executar(['--desarmar', ambiente.plano], '');
    expect(existsSync(ambiente.marcador)).toBe(false);
  });

  it('CT-966: lê a tabela de execução, não a de rastreabilidade de User Stories', () => {
    // Todas as tasks fechadas; as linhas de US ficam `A Fazer` para sempre, por design.
    writeFileSync(
      ambiente.plano,
      planoCom([{ id: 'T1', dependencias: '—', status: 'Concluído' }], true),
    );
    armar();

    // Bloquear aqui seria bloqueio ETERNO: nada no pipeline muda o Status daquelas linhas.
    expect(bloqueou(fimDeTurno())).toBe(false);
  });
});
