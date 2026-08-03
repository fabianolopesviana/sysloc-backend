/**
 * Cookie de sessão e renovação por atividade — as duas entregas da §3 da T6 que nenhum CT nomeia.
 *
 * ---------------------------------------------------------------------------
 * INVARIANTES
 * ---------------------------------------------------------------------------
 *
 * | Critério | Caso     | Invariante |
 * |----------|----------|------------|
 * | CA-06    | T6 §3-a  | Toda credencial de sessão devolvida pela entrada bem-sucedida viaja em
 * |          |          | cookie marcado `HttpOnly`, `Secure` e `SameSite=Lax` — os três, nomeados,
 * |          |          | e não "algum atributo de segurança" —, e o cookie de sessão expira no
 * |          |          | mesmo prazo que a linha persistida. |
 * | CA-12    | T6 §3-b  | A sessão é renovada **por atividade**: uma leitura autenticada empurra
 * |          |          | `expira_em` para a frente; sem a atividade o valor persistido não se
 * |          |          | move sozinho. |
 *
 * Rastreabilidade: `CA-06 → T6 §3-a (RN-07)` e `CA-12 → T6 §3-b (RN-07)`.
 *
 * ---------------------------------------------------------------------------
 * Por que os casos não têm `CT-NNN`, e por que isso é a forma certa
 * ---------------------------------------------------------------------------
 *
 * As duas propriedades **têm** caso próprio no catálogo da tech spec — CT-018 (atributos do cookie)
 * e CT-024 (renovação e vencimento) —, e os dois moram em `apps/api/test/autenticacao.e2e.spec.ts`,
 * **sobre a rota HTTP**, que nasce na T8/T9. Reutilizar aqui um daqueles identificadores criaria
 * duas implementações do mesmo CT em pacotes diferentes, e a rastreabilidade passaria a apontar para
 * dois lugares; inventar um `CT-033` colidiria com a numeração que a tech spec ainda vai atribuir.
 *
 * A forma usada é a que o repositório já tem: nomear o caso pela **seção da task que o exige**,
 * como `packages/shared/test/ambiente-efemero.spec.ts` faz com `T4 §4`. O que este arquivo prova é
 * a **configuração da instância**, que é o que a T6 entrega; o que o CT-018 e o CT-024 vão provar é
 * o mesmo atravessando a rota, que é o que a T8/T9 entrega. Um não substitui o outro.
 *
 * ---------------------------------------------------------------------------
 * Por que instância própria, e não uma carona no CT-015
 * ---------------------------------------------------------------------------
 *
 * O CT-015 leva uma conta ao bloqueio e conta sessões: acrescentar entradas àquele cenário mexeria
 * nos números que ele afirma. As duas pessoas usadas aqui são distintas entre si, pelo mesmo motivo
 * — cada caso observa a sessão de uma pessoa, e a igualdade "exatamente uma linha" tem de valer.
 *
 * ---------------------------------------------------------------------------
 * O decurso é simulado por escrita, não por espera
 * ---------------------------------------------------------------------------
 *
 * A renovação só é observável se a expiração corrente estiver atrás do que a atividade escreveria.
 * Esperar por isso de verdade é o `sleep` fixo que `.claude/rules/testing-stack.md` proíbe, e medir
 * o avanço de poucos milissegundos entre duas chamadas seguidas seria asserção refém do relógio.
 * Recuar `expira_em` por uma duração nomeada, e afirmar que a atividade o traz de volta, é
 * determinístico e discrimina o defeito real: com a renovação no padrão do arcabouço (um dia, maior
 * que a própria validade), a atividade não renova nada e o valor recuado permanece.
 */

import { esquemaIdentidade, SENHA_DA_CARGA } from '@sysloc/db';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  DURACAO_DA_SESSAO_EM_SEGUNDOS,
  RENOVACAO_DA_SESSAO_EM_SEGUNDOS,
} from '../src/autenticacao.ts';
import { type IdentidadeEfemera, identidadeEfemera, pessoaSemeada } from './identidade-efemera.ts';

/** A pessoa cuja entrada é observada pelo cookie. */
const PESSOA_DO_COOKIE = pessoaSemeada('usuario.a@exemplo.com.br');

/** Outra pessoa, para que a sessão observada na renovação seja a única dela. */
const PESSOA_DA_RENOVACAO = pessoaSemeada('usuario.b1@exemplo.com.br');

const ORIGEM = '203.0.113.7';
const AGENTE = 'verificacao/1';

/**
 * Os três atributos de segurança exigidos pela §3, **nomeados**.
 *
 * A asserção compara este objeto por igualdade contra o que cada cookie da resposta declara. A
 * igualdade é o ponto: "o cabeçalho contém `Secure`" passaria sobre um cookie
 * `SameSite=None; Secure`, que é rejeitado por navegador e degrada a sessão para tráfego em claro —
 * exatamente o mutante que sobreviveu à primeira rodada deste caso.
 */
const ATRIBUTOS_EXIGIDOS = { httpOnly: true, secure: true, sameSite: 'Lax' } as const;

/**
 * Sufixo do nome do cookie de sessão do arcabouço.
 *
 * Sufixo, e não nome inteiro: com `useSecureCookies` ligado o arcabouço antepõe o prefixo
 * `__Secure-`, que é padrão de navegador e depende justamente da configuração sob prova. Casar pelo
 * nome completo faria a asserção de existência do cookie reprovar pela MESMA causa que a asserção
 * de atributos — dois eixos com uma causa só, que é o oposto do que se quer aqui.
 */
const SUFIXO_DO_COOKIE_DE_SESSAO = 'session_token';

const SEGUNDOS_POR_HORA = 60 * 60;

const MILISSEGUNDOS_POR_SEGUNDO = 1_000;

/**
 * A validade da RN-07, **por extenso**, e a renovação a cada uso, também por extenso.
 *
 * Escritas assim, e não derivadas das constantes do SUT, pelo mesmo motivo que o CT-015 registra:
 * comparar o observado contra a própria constante que se quer provar é tautológico — trocá-la
 * mudaria os dois lados da comparação. As duas âncoras abaixo são o que amarra o extenso ao SUT.
 */
const VALIDADE_DA_SESSAO_EM_HORAS = 8;
const VALIDADE_DA_SESSAO_EM_SEGUNDOS = VALIDADE_DA_SESSAO_EM_HORAS * SEGUNDOS_POR_HORA;
const RENOVACAO_A_CADA_USO = 0;

/** Quanto do prazo se finge decorrido antes de exercitar a atividade. */
const DECURSO_SIMULADO_EM_SEGUNDOS = 1 * SEGUNDOS_POR_HORA;

let identidade: IdentidadeEfemera;

beforeAll(async () => {
  identidade = await identidadeEfemera();
});

afterAll(async () => {
  await identidade?.parar();
});

describe('T6 §3 — cookie de sessão e renovação por atividade', () => {
  it('a entrada bem-sucedida devolve cookie HttpOnly, Secure e SameSite=Lax', async () => {
    const resposta = await entrar(PESSOA_DO_COOKIE.email);
    expect(resposta.status).toBe(200);

    const cookies = resposta.headers.getSetCookie();

    // O eixo positivo do par: sem ele, uma resposta SEM cookie algum passaria a asserção seguinte
    // por vacuidade — comparar dois arranjos vazios é comparar nada com nada.
    expect(cookies.length).toBeGreaterThan(0);

    // Cada cookie da resposta carrega o trio, e não só o de sessão: um cookie auxiliar emitido sem
    // `Secure` viajaria em claro pelo mesmo canal, e o `defaultCookieAttributes` sob prova é
    // justamente o que vale para todos eles.
    expect(cookies.map(atributosDeSeguranca)).toEqual(cookies.map(() => ATRIBUTOS_EXIGIDOS));

    const cookieDeSessao = cookies.find((cookie) =>
      nomeDoCookie(cookie).endsWith(SUFIXO_DO_COOKIE_DE_SESSAO),
    );
    expect(cookieDeSessao).toBeDefined();

    // O prazo do cookie é o segundo observável da RN-07 — o primeiro é a diferença entre
    // `criada_em` e `expira_em` da linha persistida, que o CT-015 afirma. São observáveis
    // independentes: o cookie é o que o navegador obedece, a linha é o que o servidor confere, e
    // uma validade que chegasse a um e não ao outro passaria por metade da prova.
    expect(prazoDoCookieEmSegundos(cookieDeSessao ?? '')).toBe(VALIDADE_DA_SESSAO_EM_SEGUNDOS);
  });

  it('as políticas de sessão em vigor são as da RN-07 — mudá-las invalida os casos deste arquivo', () => {
    // As duas amarras entre os valores por extenso acima e as constantes do SUT. Sem elas, o
    // extenso poderia divergir da configuração e os casos passariam sobre a política errada.
    expect(DURACAO_DA_SESSAO_EM_SEGUNDOS).toBe(VALIDADE_DA_SESSAO_EM_SEGUNDOS);
    expect(RENOVACAO_DA_SESSAO_EM_SEGUNDOS).toBe(RENOVACAO_A_CADA_USO);
  });

  it('uma leitura autenticada empurra a expiração da sessão para a frente', async () => {
    const banco = identidade.acesso.identidade;
    const resposta = await entrar(PESSOA_DA_RENOVACAO.email);
    expect(resposta.status).toBe(200);

    const cookie = parDoCookie(resposta);
    const recuada = new Date(
      (await lerExpiracao(banco)).getTime() -
        DECURSO_SIMULADO_EM_SEGUNDOS * MILISSEGUNDOS_POR_SEGUNDO,
    );
    await escreverExpiracao(banco, recuada);

    // Eixo negativo do par: o valor recuado está mesmo gravado ANTES da atividade. Sem esta leitura,
    // um avanço observado depois poderia ser a escrita acima não tendo pegado — e o caso passaria
    // sobre um SUT que nunca renovou nada.
    expect((await lerExpiracao(banco)).getTime()).toBe(recuada.getTime());

    const sessaoLida = await identidade.autenticacao.api.getSession({
      headers: new Headers({ cookie }),
    });
    expect(sessaoLida?.user.id).toBe(PESSOA_DA_RENOVACAO.id);

    // Eixo positivo: a atividade moveu a expiração para a frente. Com a renovação no padrão do
    // arcabouço, o predicado interno (`expira_em − validade + renovação ≤ agora`) é falso e nada
    // seria escrito — o valor recuado continuaria lá, e esta asserção reprovaria.
    const renovada = await lerExpiracao(banco);
    expect(renovada.getTime()).toBeGreaterThan(recuada.getTime());

    // E foi renovada pela validade inteira, não por um avanço qualquer: um SUT que empurrasse a
    // expiração por alguns segundos a cada uso também passaria a asserção de cima.
    const janelaMs = renovada.getTime() - Date.now();
    expect(janelaMs).toBeGreaterThan(
      (VALIDADE_DA_SESSAO_EM_SEGUNDOS - DECURSO_SIMULADO_EM_SEGUNDOS) * MILISSEGUNDOS_POR_SEGUNDO,
    );
  });
});

type Banco = IdentidadeEfemera['acesso']['identidade'];

/** Executa a entrada com a credencial da carga e devolve a resposta crua. */
async function entrar(email: string): Promise<Response> {
  return await identidade.autenticacao.api.signInEmail({
    body: { email, password: SENHA_DA_CARGA },
    headers: new Headers({ 'x-forwarded-for': ORIGEM, 'user-agent': AGENTE }),
    asResponse: true,
  });
}

/** O par `nome=valor` do cookie de sessão, no formato em que o cliente o reenvia. */
function parDoCookie(resposta: Response): string {
  const cookie = resposta.headers
    .getSetCookie()
    .find((candidato) => nomeDoCookie(candidato).endsWith(SUFIXO_DO_COOKIE_DE_SESSAO));

  if (cookie === undefined) {
    throw new Error('a entrada bem-sucedida não devolveu cookie de sessão');
  }

  return cookie.split(';')[0] ?? '';
}

/** O nome declarado no cookie, antes do primeiro `=`. */
function nomeDoCookie(cookie: string): string {
  return (cookie.split(';')[0] ?? '').split('=')[0]?.trim() ?? '';
}

/**
 * O trio de segurança declarado por um cookie, na forma que a asserção compara.
 *
 * Lê os atributos do próprio cabeçalho em vez de perguntar à configuração: é o cabeçalho que chega
 * ao navegador, e é ele que decide se a credencial pode viajar em claro.
 */
function atributosDeSeguranca(cookie: string): {
  httpOnly: boolean;
  secure: boolean;
  sameSite: string | undefined;
} {
  const atributos = cookie
    .split(';')
    .slice(1)
    .map((parte) => parte.trim());

  const presente = (nome: string): boolean =>
    atributos.some((atributo) => atributo.toLowerCase() === nome.toLowerCase());

  const valorDe = (nome: string): string | undefined => {
    const encontrado = atributos.find((atributo) =>
      atributo.toLowerCase().startsWith(`${nome.toLowerCase()}=`),
    );
    return encontrado?.slice(nome.length + 1);
  };

  return {
    httpOnly: presente('HttpOnly'),
    secure: presente('Secure'),
    sameSite: valorDe('SameSite'),
  };
}

/** O `Max-Age` declarado no cookie, em segundos. */
function prazoDoCookieEmSegundos(cookie: string): number {
  const bruto = cookie
    .split(';')
    .map((parte) => parte.trim())
    .find((parte) => parte.toLowerCase().startsWith('max-age='));

  if (bruto === undefined) {
    throw new Error(`o cookie de sessão não declara Max-Age: ${cookie}`);
  }

  return Number(bruto.slice('max-age='.length));
}

/** A expiração persistida da única sessão da pessoa da renovação. */
async function lerExpiracao(banco: Banco): Promise<Date> {
  const { sessao } = esquemaIdentidade;

  const linhas = await banco
    .select({ expiraEm: sessao.expiraEm })
    .from(sessao)
    .where(eq(sessao.usuarioId, PESSOA_DA_RENOVACAO.id));

  const [linha] = linhas;
  if (linhas.length !== 1 || linha === undefined) {
    throw new Error(`esperava exatamente uma sessão para a renovação, e há ${linhas.length}`);
  }

  return linha.expiraEm;
}

/** Finge o decurso do prazo escrevendo a expiração recuada. */
async function escreverExpiracao(banco: Banco, quando: Date): Promise<void> {
  const { sessao } = esquemaIdentidade;

  await banco
    .update(sessao)
    .set({ expiraEm: quando })
    .where(eq(sessao.usuarioId, PESSOA_DA_RENOVACAO.id));
}
