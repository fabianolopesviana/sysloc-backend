/**
 * A janela de horário da régua — decisão pura, com bordas inclusivas nos dois extremos.
 *
 * Rastreabilidade: CA-05 → CT-613 (RN-05).
 *
 * INVARIANTES
 * - CT-613: `dentroDaJanela(agora, inicio, fim)` devolve `false` no minuto anterior ao início,
 *   `true` no minuto exato do início, `true` no meio, `true` no minuto exato do fim, `false` no
 *   minuto seguinte ao fim, e `true` sempre com a janela `00:00`–`23:59`. Os seis vereditos são
 *   afirmados por igualdade ao literal booleano — nunca por `toBeFalsy()`/`toBeTruthy()`.
 * - CT-613 (b): o vetor dos seis vereditos, na ordem da tabela, é **exatamente**
 *   `[false, true, true, true, false, true]`. É esta asserção que reprova a função constante — a que
 *   sempre devolve `true` (e passaria em quatro linhas) e a que sempre devolve `false` (e passaria
 *   em duas).
 *
 * ---------------------------------------------------------------------------
 * A inclusividade é o ponto, e ela vem do oráculo
 * ---------------------------------------------------------------------------
 *
 * `is_hora_execucao` do sistema antigo mede `no_minuto_do_horario: saida true`. Um `>` no lugar do
 * `>=` reprova a **segunda** linha da tabela, e um `<` no lugar do `<=` reprova a **quarta**. As
 * duas bordas são casos próprios porque um erro de sinal em cada extremo é um defeito diferente.
 *
 * ---------------------------------------------------------------------------
 * Precondição privilegiada: o instante corrente
 * ---------------------------------------------------------------------------
 *
 * Ele precisa ser determinístico, ou a janela vira flake. **Caminho legítimo**: a função recebe o
 * instante como PARÂMETRO, e quem monta o job o obtém na borda, do banco (ADR-0026). É desenho de
 * produção, não seam nascido para a verificação: nenhum ramo, bandeira ou símbolo existe aqui para
 * o teste enxergar. **Nenhum relógio falso global é instalado, e nenhum `if (ehTeste)` existe no
 * SUT** — a prova de que o relógio do processo não é lido em `packages/regua/src/**` é estática, e
 * mora no CT-612.
 */

import { describe, expect, it } from 'vitest';
import { dentroDaJanela } from '../src/janela.ts';

/** Uma linha da tabela de bordas: as três entradas e o veredito esperado, declarado na linha. */
interface LinhaDaJanela {
  readonly nome: string;
  readonly agora: string;
  readonly inicio: string;
  readonly fim: string;
  readonly esperado: boolean;
}

/**
 * As seis linhas do CT-613 — cinco sobre a janela comercial e uma sobre o dia inteiro.
 *
 * O veredito é escrito **na linha**, e não derivado de expressão alguma: derivá-lo faria a asserção
 * reimplementar o SUT dentro do próprio caso, que é o defeito literal registrado na
 * `.claude/rules/testing-stack.md` (*"tabela que exercitava a reimplementação do leitor no próprio
 * verificador"*).
 */
const LINHAS: readonly LinhaDaJanela[] = [
  {
    nome: 'linha_1 — 08:59 é o minuto ANTERIOR ao início e fica de fora',
    agora: '08:59',
    inicio: '09:00',
    fim: '18:00',
    esperado: false,
  },
  {
    nome: 'linha_2 — 09:00 é o minuto EXATO do início e entra (borda inclusiva)',
    agora: '09:00',
    inicio: '09:00',
    fim: '18:00',
    esperado: true,
  },
  {
    nome: 'linha_3 — 13:37 está no meio e entra',
    agora: '13:37',
    inicio: '09:00',
    fim: '18:00',
    esperado: true,
  },
  {
    nome: 'linha_4 — 18:00 é o minuto EXATO do fim e entra (borda inclusiva)',
    agora: '18:00',
    inicio: '09:00',
    fim: '18:00',
    esperado: true,
  },
  {
    nome: 'linha_5 — 18:01 é o minuto SEGUINTE ao fim e fica de fora',
    agora: '18:01',
    inicio: '09:00',
    fim: '18:00',
    esperado: false,
  },
  {
    nome: 'linha_6 — 03:14 entra na janela do dia inteiro (00:00–23:59)',
    agora: '03:14',
    inicio: '00:00',
    fim: '23:59',
    esperado: true,
  },
];

/** O vetor dos seis vereditos, na ordem da tabela — escrito por extenso, fora do SUT. */
const VEREDITOS_ESPERADOS: readonly boolean[] = [false, true, true, true, false, true];

describe('CT-613 — a janela de horário decide com bordas inclusivas nos dois extremos', () => {
  it.each(LINHAS)('$nome', ({ agora, inicio, fim, esperado }) => {
    expect(dentroDaJanela(agora, inicio, fim)).toBe(esperado);
  });

  it('CT-613 (b) — os seis vereditos, em ordem, são exatamente false, true, true, true, false, true', () => {
    const obtidos = LINHAS.map(({ agora, inicio, fim }) => dentroDaJanela(agora, inicio, fim));

    expect(obtidos).toEqual(VEREDITOS_ESPERADOS);
  });

  it('as duas recusas são o literal `false`, nunca um valor apenas "falsy"', () => {
    // Companheiro negativo do caso, com asserção própria: `toBeFalsy()` aceitaria `0`, `''` e
    // `undefined`, e uma função que devolvesse `undefined` fora da janela passaria por ela.
    expect(dentroDaJanela('08:59', '09:00', '18:00')).toBe(false);
    expect(dentroDaJanela('18:01', '09:00', '18:00')).toBe(false);
  });
});
