/**
 * Recusa que **não** é de credencial — o desfecho que o gancho `depois` precisa distinguir.
 *
 * ---------------------------------------------------------------------------
 * INVARIANTES
 * ---------------------------------------------------------------------------
 *
 * | Critério | Caso     | Invariante |
 * |----------|----------|------------|
 * | CA-08    | T6 §3-c  | Uma tentativa recusada por erro que **não** é de credencial não incrementa
 * | CA-14    |          | o contador de bloqueio, e a trilha registra `ACESSO_RECUSADO` — nunca
 * |          |          | `CREDENCIAL_INCORRETA`. Uma tentativa recusada por credencial errada, no
 * |          |          | mesmo cenário, incrementa e registra `CREDENCIAL_INCORRETA`. |
 *
 * Rastreabilidade: `CA-08 → T6 §3-c (RN-06)` e `CA-14 → T6 §3-c (RN-11)`.
 *
 * ---------------------------------------------------------------------------
 * Por que este arquivo existe
 * ---------------------------------------------------------------------------
 *
 * O gancho `depois` discriminava o desfecho **apenas** por `ctx.context.returned instanceof
 * APIError`. O mesmo manipulador emite outros erros pela mesma via — `FAILED_TO_CREATE_SESSION`
 * (depois da conferência BEM-SUCEDIDA da senha), `INVALID_EMAIL`, `EMAIL_PASSWORD_DISABLED` —, e em
 * todos eles a pessoa acertou, ou nem chegou a errar, a credencial. Sem esta distinção, uma
 * indisponibilidade parcial do banco na criação de sessão trancava contas legítimas depois de cinco
 * entradas CERTAS, e a auditoria registrava cinco credenciais incorretas que nunca existiram.
 *
 * ---------------------------------------------------------------------------
 * Por que o PAR, e por que o gatilho é o e-mail com espaços
 * ---------------------------------------------------------------------------
 *
 * O eixo negativo sozinho — "não incrementou" — passaria sobre um SUT que nunca incrementa. O
 * controle é a MESMA conta, na MESMA instância, recusada por credencial errada: ali o contador
 * precisa andar. É a diferença entre os dois que prova a discriminação.
 *
 * ---------------------------------------------------------------------------
 * Por que os dois eixos vivem num caso só, em duas fases
 * ---------------------------------------------------------------------------
 *
 * Porque a segunda fase afirma a trilha **inteira** — as duas linhas, na ordem —, e a primeira
 * delas é escrita pela primeira fase. Em dois `it`, o segundo dependia do estado deixado pelo
 * primeiro: rodá-lo isolado com `pnpm --filter @sysloc/auth test -- -t "…"` — que é workflow
 * documentado do repositório (`.claude/rules/testing-stack.md`, *Comando de teste*) — reprovava com
 * `expected 2 to be 1`, mensagem que **parece defeito do SUT** e custa uma investigação em falso a
 * quem estiver depurando.
 *
 * A fusão não afrouxa nada: as duas fases mantêm literalmente todas as asserções que tinham,
 * inclusive a igualdade do arranjo inteiro e a de que o contador andou **exatamente uma vez**. O
 * que muda é que o cenário passa a ser autocontido, que é o que ele sempre foi na intenção — uma
 * narrativa só, sobre a mesma conta, em que é o PAR que discrimina.
 *
 * O gatilho é um e-mail com espaços em volta, e ele é o caminho real, não um dublê: a borda desta
 * fatia normaliza o e-mail (§6.1) antes de resolver a pessoa, enquanto o manipulador do arcabouço
 * valida o valor **cru** com `z.email()` e recusa com `INVALID_EMAIL`. A pessoa, portanto, existe e
 * é resolvida — e a recusa não tem nada a ver com a senha dela, que aqui é a CORRETA. Nenhuma
 * cirurgia no banco, nenhum dublê, nenhuma configuração inventada para o caso.
 */

import { esquemaIdentidade, SENHA_DA_CARGA } from '@sysloc/db';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { type IdentidadeEfemera, identidadeEfemera, pessoaSemeada } from './identidade-efemera.ts';

/** A conta usada nos dois eixos. Distinta das dos outros arquivos por instância própria. */
const PESSOA = pessoaSemeada('admin.b@exemplo.com.br');

/** O mesmo endereço da pessoa, com espaços em volta — válido para a borda, inválido para `z.email()`. */
const EMAIL_COM_ESPACOS = `  ${PESSOA.email.toUpperCase()}  `;

const SENHA_ERRADA = 'nao-e-a-senha-desta-conta';
const ORIGEM = '203.0.113.7';
const AGENTE = 'verificacao/1';

/** O código que o arcabouço emite para e-mail malformado. Não é o de credencial incorreta. */
const CODIGO_DE_EMAIL_INVALIDO = 'INVALID_EMAIL';

/** O código da recusa de credencial, replicado como em `src/autenticacao.ts` e pelo mesmo motivo. */
const CODIGO_DE_CREDENCIAL = 'INVALID_EMAIL_OR_PASSWORD';

let identidade: IdentidadeEfemera;

beforeAll(async () => {
  identidade = await identidadeEfemera();
});

afterAll(async () => {
  await identidade?.parar();
});

describe('T6 §3-c — recusa que não é de credencial não conta como falha da pessoa', () => {
  it('erro não-credencial não conta; a credencial errada, na mesma conta, conta', async () => {
    const banco = identidade.acesso.identidade;

    // ------------------------------------------------------------------------------------------
    // Fase 1 — o erro que NÃO é de credencial
    // ------------------------------------------------------------------------------------------
    expect(await lerContador(banco)).toBe(0);

    // A senha é a CORRETA: se o contador andar aqui, ele andou por um erro que não é da pessoa.
    const recusaNaoCredencial = await entrar(EMAIL_COM_ESPACOS, SENHA_DA_CARGA);

    // Sem esta perna o caso passaria pela razão errada — por exemplo, se o pedido tivesse sido
    // recusado como credencial incorreta e o resto do caso ainda coincidisse.
    expect(recusaNaoCredencial.status).toBe(400);
    expect(await codigoDaRecusa(recusaNaoCredencial)).toBe(CODIGO_DE_EMAIL_INVALIDO);

    expect(await lerContador(banco)).toBe(0);
    expect(await lerTrilhaDaPessoa()).toEqual([
      { desfecho: 'ACESSO_RECUSADO', emailInformado: PESSOA.email },
    ]);

    // ------------------------------------------------------------------------------------------
    // Fase 2 — o controle, na MESMA conta: credencial errada
    // ------------------------------------------------------------------------------------------
    const recusaDeCredencial = await entrar(PESSOA.email, SENHA_ERRADA);

    expect(recusaDeCredencial.status).toBe(401);
    expect(await codigoDaRecusa(recusaDeCredencial)).toBe(CODIGO_DE_CREDENCIAL);

    // O contador andou exatamente uma vez — a recusa da fase 1 não somou nada.
    expect(await lerContador(banco)).toBe(1);
    expect(await lerTrilhaDaPessoa()).toEqual([
      { desfecho: 'ACESSO_RECUSADO', emailInformado: PESSOA.email },
      { desfecho: 'CREDENCIAL_INCORRETA', emailInformado: PESSOA.email },
    ]);
  });
});

type Banco = IdentidadeEfemera['acesso']['identidade'];

/** Executa a entrada pela instância do arcabouço e devolve a resposta crua. */
async function entrar(email: string, senha: string): Promise<Response> {
  return await identidade.autenticacao.api.signInEmail({
    body: { email, password: senha },
    headers: new Headers({ 'x-forwarded-for': ORIGEM, 'user-agent': AGENTE }),
    asResponse: true,
  });
}

/** O código declarado no corpo da recusa. */
async function codigoDaRecusa(resposta: Response): Promise<string | undefined> {
  const corpo = (await resposta.clone().json()) as { code?: string };
  return corpo.code;
}

/** O contador de falhas consecutivas da conta sob prova. */
async function lerContador(banco: Banco): Promise<number> {
  const { usuario } = esquemaIdentidade;

  const [linha] = await banco
    .select({ tentativasFalhas: usuario.tentativasFalhas })
    .from(usuario)
    .where(eq(usuario.id, PESSOA.id));

  if (linha === undefined) {
    throw new Error(`a conta ${PESSOA.email} sumiu da carga inicial no meio do caso`);
  }

  return linha.tentativasFalhas;
}

/**
 * A trilha da pessoa, na ordem dos fatos.
 *
 * Igualdade do arranjo inteiro, e não contagem nem "contém": é o que impede um SUT que gravasse
 * duas linhas por tentativa, ou nenhuma, de passar — e é o que faz o desfecho ser afirmado, e não
 * apenas a existência da linha.
 */
async function lerTrilhaDaPessoa(): Promise<{ desfecho: string; emailInformado: string }[]> {
  const { tentativaLogin } = esquemaIdentidade;

  return await identidade.acesso.identidade
    .select({
      desfecho: tentativaLogin.desfecho,
      emailInformado: tentativaLogin.emailInformado,
    })
    .from(tentativaLogin)
    .orderBy(tentativaLogin.ocorridaEm);
}
