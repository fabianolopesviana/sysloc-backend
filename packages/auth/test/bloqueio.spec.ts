/**
 * Bloqueio por conta — CT-015.
 *
 * ---------------------------------------------------------------------------
 * INVARIANTES
 * ---------------------------------------------------------------------------
 *
 * | Critério | CT     | Invariante |
 * |----------|--------|------------|
 * | CA-08    | CT-015 | O contador de tentativas vive na própria conta: após a 4ª falha consecutiva
 * |          |        | `bloqueado_ate` continua nulo; na 5ª ele recebe instante no futuro; uma
 * |          |        | entrada bem-sucedida zera `tentativas_falhas` e limpa `bloqueado_ate`. |
 * | CA-08    | T6 §3  | O contador **não perde incremento sob tentativas paralelas**: N falhas
 * |          |        | disparadas ao mesmo tempo sobre a mesma conta deixam `tentativas_falhas`
 * |          |        | exatamente em N, e cada chamada enxerga um valor distinto. |
 * | CA-08    | T6 §3-d| A recusa por conta bloqueada **paga a derivação da senha informada**, uma
 * |          |        | vez e com a senha informada — a MESMA conta de derivações que o arcabouço
 * |          |        | paga no seu ramo de e-mail inexistente. |
 *
 * Rastreabilidade: `CA-08 → CT-015 (RN-06)`, `CA-08 → T6 §3 (RN-06)` e `CA-08 → T6 §3-d (RN-06)`.
 *
 * ---------------------------------------------------------------------------
 * Por que contra banco real, e por que a fronteira é em 4
 * ---------------------------------------------------------------------------
 *
 * O estado é **persistido na conta** por decisão do tech-alignment (D5). Um dublê aqui provaria a
 * aritmética do contador e não a persistência dele, que é o ponto — e não alcançaria o `CASE` que
 * decide o instante de liberação, que roda no servidor.
 *
 * A asserção percorre as **cinco** tentativas, uma a uma, e não só a quinta. Provar apenas a quinta
 * deixaria os dois vizinhos sem asserção: um limiar errado em 4 (bloqueia cedo) e um em 6 (bloqueia
 * tarde) passariam os dois por verde.
 *
 * ---------------------------------------------------------------------------
 * Precondição privilegiada — (b), construir pelo caminho real
 * ---------------------------------------------------------------------------
 *
 * A conta nasce da carga inicial, com a senha definida pela **função de derivação do próprio
 * arcabouço** (ver `identidade-efemera.ts`), nunca por escrita direta de derivação forjada. A
 * leitura das duas colunas é consulta ao schema `identidade` — que não tem RLS por decisão da
 * ADR-0009 —, e observa o estado persistido que a RN-06 exige, em vez de instrumentar o SUT.
 *
 * O desbloqueio do passo final é o **decurso do prazo**: o instante de liberação é recuado por uma
 * duração inteira, calculada com `DURACAO_DO_BLOQUEIO_EM_MINUTOS`, que é a mesma constante que a
 * operação usa. Não há relógio falso nem espera — esperar quinze minutos de verdade é o `sleep`
 * fixo que `.claude/rules/testing-stack.md` proíbe.
 *
 * > **Companheiro negativo (CT-016), fora desta task.** A 6ª tentativa com a credencial CORRETA
 * > sobre a conta já bloqueada — resposta idêntica à de credencial incorreta e nenhuma sessão nova —
 * > é do CT-016, na T11. O desfecho `CONTA_BLOQUEADA` que o bloqueio produz **é** exercitado nesta
 * > task, pelo CT-025 em `auditoria.spec.ts`.
 *
 * ---------------------------------------------------------------------------
 * Por que o segundo caso — a correção sob concorrência precisava de asserção
 * ---------------------------------------------------------------------------
 *
 * `registrarFalha` incrementa **no próprio `UPDATE`**, sem leitura prévia, e a §7.4 da tech spec, a
 * §3 da task e o cabeçalho de `src/bloqueio.ts` declaram, os três, que é isso que a torna correta
 * sob concorrência. Nenhum caso executava tentativas paralelas: reescrever a função como "ler,
 * somar em JavaScript, gravar de volta" mantinha a suíte inteira verde. Propriedade declarada em
 * três lugares e provada em nenhum é literal órfão em forma de prosa — e, num caminho de
 * autenticação, a regressão silenciosa é o ataque paralelo, que é justamente o cenário que a RN-06
 * cobre.
 *
 * O caso é determinístico nos dois sentidos: o código correto o passa sempre (o bloqueio de linha
 * serializa os `UPDATE`, e o `READ COMMITTED` reavalia a expressão sobre o valor recém-comitado), e
 * a forma ler-somar-gravar o reprova com quase-certeza. Não há espera nem relógio falso.
 *
 * ---------------------------------------------------------------------------
 * Por que o terceiro caso — e por que ele CONTA derivações em vez de medir tempo
 * ---------------------------------------------------------------------------
 *
 * A recusa por bloqueio precisa custar o mesmo que os demais desfechos, ou a conta bloqueada vira a
 * única resposta rápida do fluxo e o tempo enumera contas. A propriedade é sobre **latência**, mas
 * uma asserção de relógio seria refém da máquina — e `.claude/rules/testing-stack.md` trata teste
 * instável como defeito.
 *
 * O que se afirma, então, é a **causa** da latência, que é observável e determinística: quantas
 * vezes a derivação de senha foi chamada, e com qual argumento. O observatório é o próprio contexto
 * do arcabouço (`autenticacao.$context`), envolvido pelo caso e restaurado depois — o mesmo objeto
 * que o gancho e o manipulador usam, sem nenhuma bandeira, contador ou parâmetro acrescentado ao
 * fonte de produção para o caso enxergar algo.
 *
 * O par é o que discrimina: o e-mail inexistente é o ramo em que o **próprio arcabouço** deriva e
 * descarta, justamente para nivelar o tempo; se a recusa por bloqueio pagar a mesma conta que ele,
 * as duas respostas custam o mesmo. Sem a derivação, a contagem da recusa por bloqueio é zero e a
 * do ramo de referência continua um — e é essa diferença que o caso reprova.
 */

import { esquemaIdentidade, SENHA_DA_CARGA } from '@sysloc/db';
import { count, eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { DURACAO_DA_SESSAO_EM_SEGUNDOS } from '../src/autenticacao.ts';
import {
  DURACAO_DO_BLOQUEIO_EM_MINUTOS,
  LIMITE_DE_FALHAS_CONSECUTIVAS,
  registrarFalha,
} from '../src/bloqueio.ts';
import { type IdentidadeEfemera, identidadeEfemera, pessoaSemeada } from './identidade-efemera.ts';

/** A pessoa cuja conta é levada ao bloqueio. */
const PESSOA = pessoaSemeada('admin.a@exemplo.com.br');

/**
 * A pessoa do caso de concorrência.
 *
 * Distinta da de cima de propósito: o CT-015 afirma contagens exatas na conta dele e no número de
 * sessões, e disparar dez falhas na mesma conta mexeria nesses números — o caso novo passaria a
 * poder quebrar o antigo por vizinhança, e não por defeito.
 */
const PESSOA_CONCORRENTE = pessoaSemeada('usuario.b2@exemplo.com.br');

/**
 * Quantas falhas o caso de concorrência dispara ao mesmo tempo.
 *
 * Dez é o bastante: com a forma ler-somar-gravar, dez chamadas simultâneas leem o mesmo valor em
 * quase toda execução e o contador termina muito abaixo de dez. Um número maior não aumenta o poder
 * de detecção e só alonga o caso.
 */
const FALHAS_EM_PARALELO = 10;

/** A pessoa do caso de derivação — a terceira conta distinta, pelo mesmo motivo da segunda. */
const PESSOA_DO_TEMPO = pessoaSemeada('usuario.b1@exemplo.com.br');

/** E-mail que a carga não tem. É o ramo em que o próprio arcabouço deriva e descarta. */
const EMAIL_QUE_NAO_EXISTE = 'ninguem@exemplo.com.br';

/** Senha que a conta não tem. Longa o bastante para não ser recusada por comprimento antes da hora. */
const SENHA_ERRADA = 'nao-e-a-senha-desta-conta';

/** Endereço do cliente que as tentativas declaram. Faixa de documentação (RFC 5737). */
const ORIGEM = '203.0.113.7';

const MILISSEGUNDOS_POR_MINUTO = 60_000;

/**
 * A fronteira, escrita **por extenso** e não derivada de `LIMITE_DE_FALHAS_CONSECUTIVAS`.
 *
 * Derivá-la da constante do SUT tornaria o caso tautológico: com o limiar mudado para 4, o laço
 * abaixo passaria a rodar três vezes e a "quinta" tentativa passaria a ser a quarta — o caso
 * continuaria verde sobre a política errada, que é exatamente o defeito que ele existe para pegar.
 * A amarra com a constante é feita uma vez, em asserção própria, logo abaixo.
 */
const FALHAS_QUE_NAO_BLOQUEIAM = 4;
const FALHA_QUE_BLOQUEIA = 5;

/**
 * A validade que a RN-07 fixa, **por extenso** — mesmo critério dos números de falha acima.
 *
 * Derivá-la de `DURACAO_DA_SESSAO_EM_SEGUNDOS` tornaria a asserção tautológica: com a constante
 * trocada para uma hora, o valor esperado mudaria junto e o caso seguiria verde sobre a regra
 * errada. A amarra com a constante do SUT é feita uma vez, em asserção própria.
 */
const VALIDADE_DA_SESSAO_EM_HORAS = 8;

const MINUTOS_POR_HORA = 60;

/** A mesma validade em milissegundos, que é a unidade em que os dois instantes são comparados. */
const VALIDADE_DA_SESSAO_MS =
  VALIDADE_DA_SESSAO_EM_HORAS * MINUTOS_POR_HORA * MILISSEGUNDOS_POR_MINUTO;

/**
 * Folga tolerada entre `criada_em` e `expira_em` da linha de sessão.
 *
 * Os dois instantes não vêm do mesmo relógio lido uma vez: o arcabouço compõe a expiração a partir
 * de um `Date.now()` e a criação a partir de outro, e a diferença observada entre eles é de poucos
 * milissegundos — em qualquer sentido. Sem folga a asserção reprovaria por essa diferença, e não
 * por defeito. Ela é constante nomeada, e não número solto no meio do caso
 * (`.claude/rules/testing-stack.md`), e é quatro ordens de grandeza menor que a distância entre
 * oito horas e a hora única do mutante — folgada para o ruído, cega para o defeito.
 */
const FOLGA_DA_VALIDADE_MS = 5_000;

let identidade: IdentidadeEfemera;

beforeAll(async () => {
  identidade = await identidadeEfemera();
});

afterAll(async () => {
  await identidade?.parar();
});

describe('CT-015 — cinco falhas consecutivas gravam o bloqueio na conta', () => {
  it('a política em vigor é a de cinco falhas — mudá-la invalida a fronteira deste caso', () => {
    // Amarra única entre a política e o caso. Sem ela, os números por extenso acima virariam
    // literais órfãos; com ela, trocar o limiar reprova aqui, num lugar só e com a causa nomeada.
    expect(LIMITE_DE_FALHAS_CONSECUTIVAS).toBe(FALHA_QUE_BLOQUEIA);
    expect(FALHAS_QUE_NAO_BLOQUEIAM).toBe(FALHA_QUE_BLOQUEIA - 1);
  });

  it('a validade de sessão em vigor é a de oito horas — mudá-la invalida a asserção abaixo', () => {
    // Mesma amarra que a de cima, para a outra política que este caso observa. Sem ela, as oito
    // horas do SUT são literal órfão: trocá-las por uma hora não reprovaria caso nenhum, porque o
    // esperado seria recalculado a partir da própria constante trocada.
    expect(DURACAO_DA_SESSAO_EM_SEGUNDOS).toBe(VALIDADE_DA_SESSAO_EM_HORAS * MINUTOS_POR_HORA * 60);
  });

  it('a quarta não bloqueia, a quinta bloqueia e o sucesso zera o contador', async () => {
    const banco = identidade.acesso.identidade;

    expect(await contarSessoes(banco, PESSOA.id)).toBe(0);

    // --- Passos 1 e 2: quatro tentativas com a senha errada, uma a uma -----------------------
    // A leitura acontece a CADA tentativa, e não só depois da quarta: é o que fixa a fronteira nos
    // dois vizinhos. Um limiar em 4 reprovaria na quarta linha; um em 6, na quinta.
    for (let tentativa = 1; tentativa <= FALHAS_QUE_NAO_BLOQUEIAM; tentativa += 1) {
      expect(await entrar(SENHA_ERRADA)).toBe('RECUSADA');

      expect(await lerConta(banco)).toEqual({ tentativasFalhas: tentativa, bloqueadoAte: null });
    }

    // --- Passos 3 e 4: a quinta tentativa ----------------------------------------------------
    const antesDaQuinta = new Date();
    expect(await entrar(SENHA_ERRADA)).toBe('RECUSADA');
    // O teto da janela é medido DEPOIS da tentativa, não antes: o `now()` que o banco usa para
    // compor o instante de liberação corre no meio dela, e a derivação de senha do arcabouço leva
    // centenas de milissegundos. Ancorar o teto no instante anterior tornaria a asserção sensível
    // ao custo do `scrypt` — reprovaria por lentidão, não por defeito.
    const depoisDaQuinta = new Date();

    const aposAQuinta = await lerConta(banco);
    expect(aposAQuinta.tentativasFalhas).toBe(FALHA_QUE_BLOQUEIA);
    expect(aposAQuinta.bloqueadoAte).not.toBeNull();
    // Estritamente no futuro em relação ao instante que precedeu a tentativa — e não "não nulo".
    // Um `bloqueado_ate` gravado no passado seria não nulo e não bloquearia ninguém.
    expect(aposAQuinta.bloqueadoAte?.getTime()).toBeGreaterThan(antesDaQuinta.getTime());
    // E dentro da duração declarada: um prazo de um século também seria "no futuro", e não é o que
    // a operação configura.
    expect(aposAQuinta.bloqueadoAte?.getTime()).toBeLessThanOrEqual(
      depoisDaQuinta.getTime() + DURACAO_DO_BLOQUEIO_EM_MINUTOS * MILISSEGUNDOS_POR_MINUTO,
    );

    // --- Passo 5: decurso do prazo, e entrada com a senha correta ----------------------------
    await recuarLiberacaoUmaDuracaoInteira(banco);

    expect(await entrar(SENHA_DA_CARGA)).toBe('ACEITA');

    // --- Passo 6: o estado depois do sucesso -------------------------------------------------
    expect(await lerConta(banco)).toEqual({ tentativasFalhas: 0, bloqueadoAte: null });
    // Exatamente uma sessão nova: as cinco recusas não criaram nenhuma, e o sucesso criou uma só.
    expect(await contarSessoes(banco, PESSOA.id)).toBe(1);

    // E ela vale pelo prazo da RN-07. Contar a linha prova que a sessão NASCEU; só ler os dois
    // instantes dela prova POR QUANTO TEMPO ela vale — e é essa a metade que a configuração de
    // `expiresIn` decide. A âncora acima cuida da constante; esta asserção cuida do caminho: uma
    // duração certa que não chegue ao arcabouço, ou que chegue em outra unidade, reprova aqui.
    //
    // O esperado é o valor POR EXTENSO, e não `DURACAO_DA_SESSAO_EM_SEGUNDOS`: comparar o observado
    // contra a própria constante do SUT seria tautológico — trocá-la por uma hora mudaria os dois
    // lados da comparação e esta asserção seguiria verde. Mesmo critério dos números de falha, e
    // pela mesma razão; a amarra entre o extenso e a constante é a âncora acima.
    const sessaoCriada = await lerSessaoUnica(banco, PESSOA.id);
    const validadeMs = sessaoCriada.expiraEm.getTime() - sessaoCriada.criadaEm.getTime();

    expect(validadeMs).toBeGreaterThanOrEqual(VALIDADE_DA_SESSAO_MS - FOLGA_DA_VALIDADE_MS);
    expect(validadeMs).toBeLessThanOrEqual(VALIDADE_DA_SESSAO_MS + FOLGA_DA_VALIDADE_MS);
  });
});

describe('T6 §3 — o contador de falhas é correto sob tentativas paralelas', () => {
  it('dez falhas simultâneas sobre a mesma conta somam dez, sem incremento perdido', async () => {
    const banco = identidade.acesso.identidade;

    // Ponto de partida conhecido: a conta desta pessoa não foi tocada por nenhum caso anterior.
    expect(await lerContaDe(banco, PESSOA_CONCORRENTE.id)).toEqual({
      tentativasFalhas: 0,
      bloqueadoAte: null,
    });

    const estados = await Promise.all(
      Array.from({ length: FALHAS_EM_PARALELO }, () =>
        registrarFalha(banco, PESSOA_CONCORRENTE.id),
      ),
    );

    // As dez encontraram a conta: nenhuma devolveu `undefined`, que é o que uma conta inexistente
    // produziria. Sem esta perna, um SUT que não atualizasse nada passaria a asserção seguinte se
    // ela olhasse só para os valores presentes.
    expect(estados.filter((estado) => estado === undefined)).toEqual([]);

    // Cada chamada enxergou um valor DISTINTO — os dez primeiros naturais, sem repetição. É esta a
    // asserção que discrimina a forma: com "ler, somar em JavaScript, gravar de volta", chamadas
    // que correm juntas leem o mesmo valor e devolvem o mesmo resultado.
    const contados = estados
      .map((estado) => estado?.tentativasFalhas ?? 0)
      .toSorted((a, b) => a - b);
    expect(contados).toEqual(Array.from({ length: FALHAS_EM_PARALELO }, (_, i) => i + 1));

    // E o estado PERSISTIDO — que é o que a RN-06 consulta na tentativa seguinte — conta as dez.
    const persistido = await lerContaDe(banco, PESSOA_CONCORRENTE.id);
    expect(persistido.tentativasFalhas).toBe(FALHAS_EM_PARALELO);
    // Dez ultrapassa o limiar, então o instante de liberação foi gravado: o `CASE` da mesma
    // instrução também vale sob concorrência, e não só no caminho sequencial do CT-015.
    expect(persistido.bloqueadoAte).not.toBeNull();
  });
});

describe('T6 §3-d — a recusa por bloqueio paga a mesma derivação que os demais desfechos', () => {
  it('deriva a senha informada uma vez, exatamente como o ramo de e-mail inexistente', async () => {
    const banco = identidade.acesso.identidade;

    // Leva a conta ao bloqueio pelo caminho de produção — a mesma função que o gancho `depois`
    // chama —, e não por escrita direta das duas colunas.
    for (let falha = 0; falha < FALHA_QUE_BLOQUEIA; falha += 1) {
      await registrarFalha(banco, PESSOA_DO_TEMPO.id);
    }
    expect((await lerContaDe(banco, PESSOA_DO_TEMPO.id)).bloqueadoAte).not.toBeNull();

    const derivacoes = await espionarDerivacao();

    try {
      // Eixo sob prova: conta bloqueada, com a senha CORRETA. A recusa acontece antes do
      // manipulador, então nenhuma derivação viria do arcabouço — só a que o gancho paga.
      expect(await entrarComo(PESSOA_DO_TEMPO.email, SENHA_DA_CARGA)).toBe('RECUSADA');
      expect(derivacoes.argumentos).toEqual([SENHA_DA_CARGA]);

      // Eixo de referência: o ramo em que o PRÓPRIO arcabouço deriva e descarta para nivelar o
      // tempo. Uma chamada a mais, e a conta das duas passa a ser a mesma.
      expect(await entrarComo(EMAIL_QUE_NAO_EXISTE, SENHA_DA_CARGA)).toBe('RECUSADA');
      expect(derivacoes.argumentos).toEqual([SENHA_DA_CARGA, SENHA_DA_CARGA]);
    } finally {
      derivacoes.restaurar();
    }
  });
});

type Banco = IdentidadeEfemera['acesso']['identidade'];

/** O que o espião registrou, e como desfazê-lo. */
interface DerivacoesObservadas {
  /** Um item por chamada, na ordem, com o argumento exato — nunca apenas "foi chamado". */
  readonly argumentos: string[];
  restaurar(): void;
}

/**
 * Envolve a derivação de senha do contexto do arcabouço, contando chamadas e argumentos.
 *
 * O contexto é o objeto que o gancho recebe em `ctx.context` e que o manipulador usa — envolvê-lo
 * observa o colaborador real, sem tocar em `src/`. A derivação verdadeira continua sendo executada:
 * suprimi-la mudaria o custo que o caso existe para afirmar.
 */
async function espionarDerivacao(): Promise<DerivacoesObservadas> {
  const contexto = await identidade.autenticacao.$context;
  const original = contexto.password.hash;
  const argumentos: string[] = [];

  contexto.password.hash = async (senha: string): Promise<string> => {
    argumentos.push(senha);
    return await original(senha);
  };

  return {
    argumentos,
    restaurar: () => {
      contexto.password.hash = original;
    },
  };
}

/** Executa a entrada da pessoa do CT-015 e classifica o desfecho observável. */
async function entrar(senha: string): Promise<'ACEITA' | 'RECUSADA'> {
  return await entrarComo(PESSOA.email, senha);
}

/** A mesma entrada, para o e-mail informado. */
async function entrarComo(email: string, senha: string): Promise<'ACEITA' | 'RECUSADA'> {
  try {
    const resposta = await identidade.autenticacao.api.signInEmail({
      body: { email, password: senha },
      headers: new Headers({ 'x-forwarded-for': ORIGEM, 'user-agent': 'verificacao/1' }),
      asResponse: true,
    });

    return resposta.ok ? 'ACEITA' : 'RECUSADA';
  } catch {
    // A recusa da barreira de bloqueio levanta em vez de devolver resposta, porque ela acontece
    // antes do manipulador. Para este caso as duas formas são a mesma coisa: não entrou.
    return 'RECUSADA';
  }
}

/** As duas colunas que a RN-06 mantém, lidas do banco — para a pessoa do CT-015. */
async function lerConta(
  banco: Banco,
): Promise<{ tentativasFalhas: number; bloqueadoAte: Date | null }> {
  return await lerContaDe(banco, PESSOA.id);
}

/** As mesmas duas colunas, para a pessoa informada. */
async function lerContaDe(
  banco: Banco,
  usuarioId: string,
): Promise<{ tentativasFalhas: number; bloqueadoAte: Date | null }> {
  const { usuario } = esquemaIdentidade;

  const [linha] = await banco
    .select({ tentativasFalhas: usuario.tentativasFalhas, bloqueadoAte: usuario.bloqueadoAte })
    .from(usuario)
    .where(eq(usuario.id, usuarioId));

  if (linha === undefined) {
    throw new Error(`a conta ${usuarioId} sumiu da carga inicial no meio do caso`);
  }

  return linha;
}

/**
 * Os dois instantes da única sessão da pessoa.
 *
 * Exige a unicidade em vez de pegar a primeira linha: o passo anterior já afirmou que existe uma só,
 * e uma segunda linha aqui significaria que a asserção de contagem e esta olham para sessões
 * diferentes — o tipo de divergência que passa despercebida quando se lê pelo índice.
 */
async function lerSessaoUnica(
  banco: Banco,
  usuarioId: string,
): Promise<{ expiraEm: Date; criadaEm: Date }> {
  const { sessao } = esquemaIdentidade;

  const linhas = await banco
    .select({ expiraEm: sessao.expiraEm, criadaEm: sessao.criadaEm })
    .from(sessao)
    .where(eq(sessao.usuarioId, usuarioId));

  const [linha] = linhas;
  if (linhas.length !== 1 || linha === undefined) {
    throw new Error(`esperava exatamente uma sessão para ${PESSOA.email}, e há ${linhas.length}`);
  }

  return linha;
}

async function contarSessoes(banco: Banco, usuarioId: string): Promise<number> {
  const { sessao } = esquemaIdentidade;

  const [linha] = await banco
    .select({ total: count() })
    .from(sessao)
    .where(eq(sessao.usuarioId, usuarioId));

  return linha?.total ?? 0;
}

/**
 * Recua o instante de liberação em uma duração inteira — o prazo decorreu.
 *
 * A duração vem da constante que a operação usa. Escrever um instante arbitrário no passado (por
 * exemplo, "ano 2000") provaria o mesmo caminho de código com um valor que a operação nunca produz,
 * e deixaria a configuração de duração sem nenhuma amarra ao caso.
 */
async function recuarLiberacaoUmaDuracaoInteira(banco: Banco): Promise<void> {
  const { usuario } = esquemaIdentidade;
  const decorrido = new Date(
    Date.now() - DURACAO_DO_BLOQUEIO_EM_MINUTOS * MILISSEGUNDOS_POR_MINUTO,
  );

  await banco.update(usuario).set({ bloqueadoAte: decorrido }).where(eq(usuario.id, PESSOA.id));
}
