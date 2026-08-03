/**
 * Política de força de senha — CT-013 e CT-014.
 *
 * ---------------------------------------------------------------------------
 * INVARIANTES
 * ---------------------------------------------------------------------------
 *
 * | Critério | CT     | Invariante |
 * |----------|--------|------------|
 * | CA-07    | CT-013 | Senha com 10 ou mais caracteres, que não contenha o nome nem a parte local
 * |          |        | do e-mail da pessoa, sem sequência de 4 caracteres consecutivos e sem
 * |          |        | repetição de 4 iguais, é aprovada **sem motivo de recusa**. |
 * | CA-07    | CT-014 | Cada regra tem **rótulo próprio**: comprimento, dado pessoal, sequência
 * |          |        | consecutiva e repetição são distinguíveis por quem chama, e o motivo
 * |          |        | devolvido **não carrega a senha informada**. |
 *
 * Rastreabilidade: `CA-07 → CT-013, CT-014 (RN-05)`.
 *
 * ---------------------------------------------------------------------------
 * Por que os dois casos são um par, e não dois casos soltos
 * ---------------------------------------------------------------------------
 *
 * A fronteira do comprimento é `>= 10`, e é o eixo mais fácil de errar para `> 10`. Provar só o lado
 * aprovado deixaria `> 10` verde; provar só o lado recusado deixaria `>= 9` verde. Por isso o
 * CT-013 carrega uma senha de **exatamente dez** caracteres e o CT-014 carrega uma de **exatamente
 * nove** — é o par que detecta, e nenhuma das duas asserções sozinha.
 *
 * A senha da carga inicial entra na lista de aprovadas de propósito: o cabeçalho de
 * `packages/db/src/semente.ts` afirma que ela "satisfaz a política de força de propósito", e uma
 * afirmação em prosa que ninguém exercita é a que apodrece primeiro. Aqui ela é verificada.
 *
 * Sem colaborador algum: a política é função pura, e a decisão de não consultar rede é registrada
 * (§8 da tech spec). Fronteira real de execução: nenhuma.
 */

import { SENHA_DA_CARGA } from '@sysloc/db';
import { describe, expect, it } from 'vitest';
import {
  avaliarForcaDeSenha,
  COMPRIMENTO_MINIMO_DE_SENHA,
  type MotivoDeRecusaDeSenha,
  type PessoaDaSenha,
} from '../src/senha.ts';

/**
 * A pessoa de referência das duas tabelas.
 *
 * Espelha `Ana Alves` / `admin.a@exemplo.com.br` da carga inicial, mas é declarada aqui em vez de
 * lida de lá: a política é função pura e não deve depender de qual pessoa a carga tem hoje. O que
 * importa é que os pedaços de dado pessoal sejam concretos — `ana`, `alves`, `admin` e `admin.a`.
 */
const PESSOA: PessoaDaSenha = { nome: 'Ana Alves', email: 'admin.a@exemplo.com.br' };

describe('CT-013 — senha que satisfaz comprimento e força é aceita', () => {
  const APROVADAS: readonly { readonly rotulo: string; readonly senha: string }[] = [
    { rotulo: 'a senha da carga inicial', senha: SENHA_DA_CARGA },
    { rotulo: 'exatamente o comprimento mínimo', senha: 'Ki7#zTrupe' },
    { rotulo: 'acima do comprimento mínimo', senha: 'Vento#42Sul' },
  ];

  it.each(APROVADAS)('$rotulo é aprovada sem motivo de recusa', ({ senha }) => {
    expect(avaliarForcaDeSenha(senha, PESSOA)).toEqual({ aprovada: true, motivos: [] });
  });

  it('a senha de exatamente dez caracteres tem mesmo dez caracteres — a fronteira é `>= 10`', () => {
    // Sem esta linha o caso acima seria verde mesmo se a senha "de fronteira" tivesse onze
    // caracteres, e o eixo que ele existe para provar desapareceria sem nenhuma asserção quebrar.
    expect('Ki7#zTrupe'.length).toBe(COMPRIMENTO_MINIMO_DE_SENHA);
  });
});

describe('CT-014 — senha curta ou fraca é recusada com o motivo específico da regra violada', () => {
  const RECUSADAS: readonly {
    readonly rotulo: string;
    readonly senha: string;
    readonly motivo: MotivoDeRecusaDeSenha;
  }[] = [
    // Nove caracteres — um a menos que a fronteira, e nada mais errado com ela.
    { rotulo: 'um caractere abaixo do mínimo', senha: 'K9mvt#Qzp', motivo: 'COMPRIMENTO_MINIMO' },
    {
      rotulo: 'contém o sobrenome da pessoa',
      senha: 'AlvesTrovao#7',
      motivo: 'CONTEM_DADO_PESSOAL',
    },
    {
      rotulo: 'contém a parte local do e-mail',
      senha: 'Xadmin#9tuk',
      motivo: 'CONTEM_DADO_PESSOAL',
    },
    { rotulo: 'tem quatro consecutivos', senha: 'Qw#abcd7Kmz', motivo: 'SEQUENCIA_CONSECUTIVA' },
    { rotulo: 'tem quatro iguais em fila', senha: 'Qw#1111zKmv', motivo: 'REPETICAO' },
  ];

  it.each(RECUSADAS)('$rotulo devolve exatamente $motivo', ({ senha, motivo }) => {
    // Igualdade do arranjo inteiro, e não `toContain`: cada senha da tabela viola UMA regra, e
    // `toContain` deixaria passar uma política que devolvesse os quatro rótulos sempre — que é
    // exatamente o motivo genérico que o caso existe para reprovar.
    expect(avaliarForcaDeSenha(senha, PESSOA)).toEqual({ aprovada: false, motivos: [motivo] });
  });

  it.each(RECUSADAS)('o veredito de $rotulo não carrega a senha informada', ({ senha }) => {
    // Rede local da RN-12: o motivo viaja para `detalhes` do envelope da ADR-0007 e para o registro
    // estruturado. A asserção é sobre o veredito INTEIRO serializado, e não só sobre `motivos` —
    // um campo novo que ecoasse a entrada seria pego aqui, e não apenas o rótulo.
    const serializado = JSON.stringify(avaliarForcaDeSenha(senha, PESSOA));

    expect(serializado).not.toContain(senha);
    expect(serializado.toLowerCase()).not.toContain(senha.toLowerCase());
  });
});
