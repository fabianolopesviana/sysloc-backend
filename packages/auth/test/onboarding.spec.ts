/**
 * Onboarding de pessoa — a compensação que impede o endereço de queimar.
 *
 * ---------------------------------------------------------------------------
 * INVARIANTES
 * ---------------------------------------------------------------------------
 *
 * | Critério | CT      | Invariante |
 * |----------|---------|------------|
 * | —        | T6 (P4) | Falha DEPOIS da criação da pessoa não deixa linha órfã: `criarPessoa`
 * |          |         | apaga a pessoa recém-criada antes de propagar, propaga a falha ORIGINAL,
 * |          |         | e o mesmo e-mail continua disponível para a tentativa seguinte. |
 *
 * Rastreabilidade: `RN-09 → T6 (P4)` — a criação de pessoa é o ato que a US-02/US-07/US-08 põem nas
 * mãos do Master e do Admin, e `identidade.usuario.email` é ÚNICO.
 *
 * ---------------------------------------------------------------------------
 * O que este caso persegue, e por que ele não é sobre a ordem dos passos
 * ---------------------------------------------------------------------------
 *
 * A ordem dos três passos de `criarPessoa` é fail-closed e está certa: interrompida em qualquer
 * ponto, ela deixa uma pessoa **sem credencial**, que não entra em lugar nenhum. O que a ordem não
 * resolve é o outro dano, que é de operação e não de acesso: a linha órfã **ocupa o e-mail**, que é
 * único, e nesta fatia não existe rota de exclusão. Sem compensação, a segunda tentativa de criar a
 * mesma pessoa falha por conflito, e ninguém que olhe para a resposta sabe por quê.
 *
 * ---------------------------------------------------------------------------
 * Como a falha é provocada — colaborador REAL sabotado, não dublê
 * ---------------------------------------------------------------------------
 *
 * A derivação de senha do contexto do arcabouço é substituída por uma que levanta, no mesmo molde
 * do espião de `bloqueio.spec.ts`: é o objeto que o SUT usa de fato, e devolvê-lo ao lugar restaura
 * o caminho verdadeiro. Ela é o último dos três passos, de modo que a falha acontece **depois** de
 * a pessoa existir — que é exatamente a janela que o caso existe para cobrir. Nenhum módulo é
 * interceptado, e nada em `src/` é tocado.
 *
 * A segunda metade do caso é o **companheiro positivo**, e é ela que discrimina: recriar a mesma
 * pessoa, com o mesmo e-mail, **funciona**. Sem a compensação, a linha órfã continuaria lá e esta
 * segunda criação reprovaria por violação de unicidade — que é literalmente o dano.
 */

import { randomUUID } from 'node:crypto';
import { EMPRESA_A, esquemaIdentidade } from '@sysloc/db';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { criarPessoa } from '../src/onboarding.ts';
import { type IdentidadeEfemera, identidadeEfemera } from './identidade-efemera.ts';

/** A falha injetada. Texto próprio, para que a asserção prove que é ELA que sobe — e não outra. */
const FALHA_INJETADA = 'derivação indisponível neste caso';

/** Nome da pessoa do caso. Sem relação com a senha sorteada, que é o que a política exige. */
const NOME = 'Pessoa Da Compensação';

let identidade: IdentidadeEfemera;

beforeAll(async () => {
  identidade = await identidadeEfemera();
});

afterAll(async () => {
  await identidade?.parar();
});

describe('T6 (P4) — falha depois da criação não deixa pessoa órfã ocupando o e-mail', () => {
  it('a falha original propaga, a linha não fica, e o mesmo e-mail cria de novo', async () => {
    const banco = identidade.acesso.identidade;
    // Endereço exclusivo deste caso: um e-mail fixo o acoplaria à carga inicial e à ordem dos casos.
    const email = `compensacao.${randomUUID()}@exemplo.com.br`;
    const pessoa = { nome: NOME, email, perfil: 'ADMIN_EMPRESA', empresaId: EMPRESA_A.id } as const;

    // Ponto de partida conhecido: o endereço está livre. Sem esta linha, "não ficou linha" poderia
    // ser verdade porque ela nunca chegou a existir por outro motivo.
    expect(await contarPessoasCom(email)).toBe(0);

    const contexto = await identidade.autenticacao.$context;
    const derivacaoVerdadeira = contexto.password.hash;
    contexto.password.hash = () => {
      throw new Error(FALHA_INJETADA);
    };

    try {
      // A falha que sobe é a ORIGINAL, e não a da compensação: quem lê o erro precisa ver a causa
      // real. Um SUT que engolisse a original e levantasse outra coisa reprova aqui.
      await expect(criarPessoa(identidade.autenticacao, banco, pessoa)).rejects.toThrowError(
        FALHA_INJETADA,
      );
    } finally {
      contexto.password.hash = derivacaoVerdadeira;
    }

    // A linha foi desfeita. É a asserção direta do invariante, e ela reprova sozinha um SUT sem
    // compensação — que deixaria exatamente uma pessoa aqui.
    expect(await contarPessoasCom(email)).toBe(0);

    // O companheiro positivo, e a razão de o débito existir: o endereço não queimou. Sem a
    // compensação, esta criação reprovaria por unicidade de `identidade.usuario.email`.
    const criada = await criarPessoa(identidade.autenticacao, banco, pessoa);

    expect(criada.usuarioId).toEqual(expect.any(String));
    expect(await contarPessoasCom(email)).toBe(1);
  });
});

/** Quantas pessoas existem com o endereço informado — a unicidade que o caso persegue. */
async function contarPessoasCom(email: string): Promise<number> {
  const { usuario } = esquemaIdentidade;

  const linhas = await identidade.acesso.identidade
    .select({ id: usuario.id })
    .from(usuario)
    .where(eq(usuario.email, email));

  return linhas.length;
}
