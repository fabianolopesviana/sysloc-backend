/**
 * Validação das variáveis de ambiente na partida do processador de trabalho — T6 da fatia
 * `fundacao-stack-nativa`.
 *
 * ---------------------------------------------------------------------------
 * INVARIANTES
 * ---------------------------------------------------------------------------
 *
 * | Critério | Caso | Invariante |
 * |---|---|---|
 * | CA-15 | CT-006 | Faltando variável exigida, ou com valor inválido, `lerAmbiente` FALHA e a
 * |       |        | mensagem nomeia CADA variável com problema — nunca uma mensagem genérica,
 * |       |        | nunca devolvendo configuração, e nunca ecoando o valor recebido. |
 * | CA-15 | CT-007 | Com as duas presentes e válidas, devolve a configuração com cada campo
 * |       |        | derivado da SUA variável de origem, e nada além delas. |
 *
 * ---------------------------------------------------------------------------
 * Por que este arquivo existe
 * ---------------------------------------------------------------------------
 *
 * O processador exige DUAS variáveis, e nenhuma delas é a de conexão com o banco. A prova de
 * sistema do CA-15 (T7) sobe uma unidade com o arquivo de ambiente incompleto; se ela for
 * executada contra o processador com a variável do banco removida, o processo sobe normalmente e
 * o caso prova o contrário do que afirma. A prova de unidade fecha esse vão: ela exercita as
 * variáveis que ESTE processo lê, e é a única que reprova se a mensagem de falha regredir para
 * genérica — ou se ela passar a ecoar o valor recebido, que é o que a levaria a publicar
 * credencial no journal.
 *
 * ---------------------------------------------------------------------------
 * Espelho de `apps/api/test/ambiente.spec.ts`
 * ---------------------------------------------------------------------------
 *
 * Mesma disciplina: a fonte de variáveis é PARÂMETRO da função, e um único caso planta valor em
 * `process.env` — o que PROVA que o ambiente do processo não prevalece sobre a fonte — restaurando
 * o valor anterior ao terminar. Nos demais, mutação global só quebraria a independência entre
 * casos. `lerAmbiente` é exportada pelo mesmo motivo que `carregarAmbiente` o é do lado do serviço
 * de aplicação: é a unidade que a composição raiz consome, não um ponto de entrada criado para a
 * verificação enxergar estado.
 */

import { NIVEIS_DE_LOG } from '@sysloc/shared';
import { describe, expect, it, onTestFinished } from 'vitest';
import { type Ambiente, lerAmbiente } from '../src/main.ts';

/** As variáveis que o processador exige — e o `.env.example` documenta. */
const VARIAVEIS_EXIGIDAS = ['LOG_LEVEL', 'REDIS_URL'] as const;

/** Senha embutida na cadeia de conexão da fila, para provar que a falha não a ecoa. */
const SENHA_NA_CADEIA = 'segredoQueNaoPodeVazar';

/** Severidade única e distinguível de qualquer valor padrão do registrador. */
const SEVERIDADE = 'warn';

/**
 * Ambiente completo e válido do processador.
 *
 * Traz também uma variável que o processador NÃO exige: é o que permite afirmar que a
 * configuração devolvida não a absorve.
 */
function ambienteCompleto(): Record<string, string> {
  return {
    LOG_LEVEL: SEVERIDADE,
    REDIS_URL: `redis://usuarioct007:${SENHA_NA_CADEIA}@127.0.0.1:16399`,
  };
}

/** Clona o ambiente completo removendo as variáveis indicadas. */
function ambienteSem(...ausentes: readonly string[]): Record<string, string> {
  const fonte = ambienteCompleto();
  for (const nome of ausentes) {
    delete fonte[nome];
  }
  return fonte;
}

/** Executa a leitura e devolve a falha, ou reprova se a chamada tiver devolvido configuração. */
function falhaDe(fonte: Record<string, string>): Error {
  let devolvido: Ambiente | undefined;
  try {
    devolvido = lerAmbiente(fonte);
  } catch (erro) {
    expect(erro).toBeInstanceOf(Error);
    return erro as Error;
  }
  throw new Error(
    `lerAmbiente devolveu configuração onde deveria ter falhado: ${JSON.stringify(devolvido)}`,
  );
}

describe('lerAmbiente (T6 · CA-15)', () => {
  it.each(VARIAVEIS_EXIGIDAS.map((nome) => ({ nome })))(
    'CT-006 — sem $nome, a partida falha e a mensagem nomeia a variável ausente',
    ({ nome }) => {
      const falha = falhaDe(ambienteSem(nome));

      expect(falha.message).toContain(`${nome}: ausente`);
    },
  );

  it.each(VARIAVEIS_EXIGIDAS.map((nome) => ({ nome })))(
    'CT-006 — $nome presente e em branco conta como ausente e é nomeada',
    ({ nome }) => {
      // Um arquivo copiado do `.env.example` sem preenchimento entrega cadeias vazias; a falha tem
      // de dizer "não foi preenchida", e não "não é uma severidade" ou "não é interpretável".
      const fonte = { ...ambienteCompleto(), [nome]: '   ' };

      const falha = falhaDe(fonte);

      expect(falha.message).toContain(`${nome}: ausente`);
    },
  );

  it('CT-006 — severidade fora da lista falha nomeando a variável e as severidades aceitas', () => {
    const fonte = { ...ambienteCompleto(), LOG_LEVEL: 'verboso' };

    const falha = falhaDe(fonte);

    expect(falha.message).toContain('LOG_LEVEL: deve ser um de: ');
    // A lista aceita é a MESMA do serviço de aplicação, e vem do pacote compartilhado: severidade
    // acrescentada em um dos lados faria um processo subir e o outro recusar o mesmo arquivo.
    for (const nivel of NIVEIS_DE_LOG) {
      expect(falha.message).toContain(nivel);
    }
    // A mensagem nomeia a exigência, nunca o valor recebido.
    expect(falha.message).not.toContain('verboso');
  });

  it('CT-006 — cadeia de fila com esquema errado falha nomeando a variável, sem ecoar a senha', () => {
    const fonte = ambienteCompleto();
    fonte.REDIS_URL = `postgresql://usuarioct006:${SENHA_NA_CADEIA}@127.0.0.1:16399`;

    const falha = falhaDe(fonte);

    expect(falha.message).toContain('REDIS_URL: deve ser uma cadeia interpretável começando com');
    expect(falha.message).toContain('redis://');
    // A mensagem vai para o journal: ecoar o valor recebido publicaria a credencial da fila.
    expect(falha.message).not.toContain(SENHA_NA_CADEIA);
    expect(falha.message).not.toContain('postgresql://');
  });

  it('CT-006 — cadeia de fila com o esquema certo, porém não interpretável, também falha', () => {
    // O companheiro do caso acima: sem esta asserção, a regra poderia regredir para uma
    // verificação de prefixo, e uma cadeia truncada só falharia na primeira conexão — com o
    // processo já reportado como no ar pelo supervisor.
    const fonte = { ...ambienteCompleto(), REDIS_URL: 'redis://[falta-fechar' };

    const falha = falhaDe(fonte);

    expect(falha.message).toContain('REDIS_URL: deve ser uma cadeia interpretável começando com');
  });

  it('CT-006 — faltando as DUAS variáveis, a mensagem nomeia as duas de uma vez', () => {
    // Validação que para na primeira ausência esconde configuração incompleta e obriga uma
    // rodada de partida por variável faltante.
    const falha = falhaDe(ambienteSem(...VARIAVEIS_EXIGIDAS));

    expect(falha.message).toContain('LOG_LEVEL: ausente');
    expect(falha.message).toContain('REDIS_URL: ausente');
    expect(falha.message).toContain('.env.example');
  });

  it('CT-007 — com as duas variáveis válidas, devolve a configuração tipada com os valores lidos', () => {
    const fonte = ambienteCompleto();

    const ambiente = lerAmbiente(fonte);

    // Cada campo vale exatamente o valor da SUA variável de origem.
    expect(ambiente.nivelDeLog).toBe(SEVERIDADE);
    expect(ambiente.cadeiaConexaoFila).toBe(fonte.REDIS_URL);
    expect(Object.keys(ambiente).sort()).toEqual(['cadeiaConexaoFila', 'nivelDeLog']);
  });

  it('CT-007 — o ambiente do processo não é lido, e o que não é exigido não entra na configuração', () => {
    const fonte = { ...ambienteCompleto(), VARIAVEL_ALHEIA: 'nao-deve-atravessar' };

    // O ambiente do PROCESSO recebe, para a mesma variável, valor divergente do que a fonte
    // declara. Uma leitura de `process.env` que PREVALECESSE sobre a fonte devolveria `trace`
    // aqui — e o processador passaria a registrar num nível que ninguém configurou. (A outra forma
    // de vazamento, uma leitura que apenas COMPLETASSE o que a fonte não trouxe, é morta pelo
    // CT-006: com ela, remover uma variável da fonte deixaria de falhar.)
    const anterior = process.env.LOG_LEVEL;
    process.env.LOG_LEVEL = 'trace';
    onTestFinished(() => {
      if (anterior === undefined) {
        delete process.env.LOG_LEVEL;
      } else {
        process.env.LOG_LEVEL = anterior;
      }
    });

    const ambiente = lerAmbiente(fonte);

    expect(ambiente.nivelDeLog).toBe(SEVERIDADE);
    expect(ambiente.nivelDeLog).not.toBe(process.env.LOG_LEVEL);
    expect(Object.values(ambiente)).not.toContain('nao-deve-atravessar');
  });
});
