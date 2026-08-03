/**
 * Barreira única de admissão de sessão — CT-026 e os cinco predicados, um a um. T7.
 *
 * ---------------------------------------------------------------------------
 * INVARIANTES
 * ---------------------------------------------------------------------------
 *
 * | Critério | Caso   | Invariante |
 * |----------|--------|------------|
 * | CA-06    | CT-026 | Para um usuário que a barreira recusa, NENHUM dos caminhos de emissão de
 * | CA-09    |        | sessão publicados pelo arcabouço instalado produz linha em
 * | CA-13    |        | `identidade.sessao`; e o conjunto desses caminhos é fechado e conhecido, de
 * |          |        | modo que uma versão nova do arcabouço que acrescente um caminho faz a
 * |          |        | verificação reprovar. |
 * | CA-06    | T7 §4  | Pessoa ativa em empresa ativa é admitida e ganha exatamente uma sessão — o
 * |          |        | controle positivo sem o qual "nenhuma sessão foi criada" passaria por
 * |          |        | vacuidade sobre uma barreira que recusa todo mundo. |
 * | CA-13    | T7 §4  | Os cinco predicados são símbolos nomeados, puros e testáveis isoladamente, e
 * |          |        | a ordem de avaliação é determinística: o primeiro que recusa interrompe os
 * |          |        | demais. |
 *
 * Rastreabilidade: `CA-06 → CT-026 (RN-06)`, `CA-09 → CT-026 (RN-08)`, `CA-13 → CT-026 (RN-10)`.
 *
 * ---------------------------------------------------------------------------
 * Por que os dois eixos moram no mesmo arquivo
 * ---------------------------------------------------------------------------
 *
 * O catálogo da tech spec propõe o eixo **estático** (conjunto fechado de caminhos, não-exportação
 * dos internos) em `packages/auth/test/superficie-publica.spec.ts` e o eixo **comportamental**
 * (produto cartesiano por HTTP) em `apps/api/test/autenticacao.e2e.spec.ts`. O segundo não é
 * exequível hoje: `apps/api` não tem ligação alguma de identidade — o `AutenticacaoModule` nasce na
 * T8 —, e montá-lo aqui seria executar a task seguinte. A §5.1 da T7, que é normativa, declara **um**
 * arquivo, e é este.
 *
 * A fronteira real exigida (`http`) é atendida sem invadir a T8: o servidor sobe **neste arquivo**,
 * em porta dinâmica, e delega ao manipulador que a própria instância publica. Nada em `src/` ganhou
 * ponto de injeção, e nenhum caminho interno do arcabouço foi exportado para o caso enxergar algo —
 * a §3.3 da tech spec declara essa não-exportação como invariante, e criá-la para o teste seria
 * violação da Iron Law #6.
 *
 * ---------------------------------------------------------------------------
 * O que discrimina, e o que apenas cobre
 * ---------------------------------------------------------------------------
 *
 * O produto cartesiano inteiro **cobre**: ele afirma que nenhuma das 11 rotas emissoras produziu
 * linha em `identidade.sessao` para nenhuma das três pessoas recusadas. Sozinho ele passaria sobre
 * um SUT que recusasse todo mundo, e a maior parte daquelas rotas recusaria o pedido por falta de
 * pré-condição própria mesmo sem barreira alguma.
 *
 * O que **discrimina** são três coisas, e elas estão aqui por isso:
 *
 *   1. o **controle positivo** — a mesma instância admite uma pessoa ativa e grava exatamente uma
 *      sessão; sem ele "zero sessões" não prova nada;
 *   2. a **igualdade da recusa** em `/sign-in/email`, comparada contra a recusa que o próprio
 *      arcabouço emite para senha errada — comparar as respostas ENTRE SI é o que prova a
 *      indistinguibilidade, porque dois literais escritos à mão continuariam iguais mesmo se o SUT
 *      divergisse em ambos;
 *   3. a **segunda rota emissora exercitada de verdade** — `/change-password` com
 *      `revokeOtherSessions`, que chega ao ponto de emissão por um caminho estruturalmente distinto
 *      do da entrada. É ela que reprova um SUT em que a barreira estivesse instalada apenas no
 *      gancho da rota de entrada, que é exatamente a topologia que esta task existe para recusar.
 *
 * ---------------------------------------------------------------------------
 * Prova de falsificação do eixo estático (obrigatória)
 * ---------------------------------------------------------------------------
 *
 * As asserções de conjunto inspecionam superfície, não comportamento, e por isso
 * `.claude/rules/testing-stack.md` exige demonstrar que elas **reprovam** sobre uma cópia com o
 * defeito reintroduzido. O caso `prova de falsificação` faz isso como caso versionado, e não como
 * exercício descartado: aplica `diferencasDeConjunto` a uma cópia da superfície com um caminho
 * emissor a mais e afirma que a diferença **nomeia** o excedente; o controle íntegro passa limpo no
 * mesmo harness.
 */

import { createServer, type Server } from 'node:http';
import { EMPRESA_B, esquemaIdentidade, SENHA_DA_CARGA, type UsuarioSemeado } from '@sysloc/db';
import { hashPassword } from 'better-auth/crypto';
import { count, eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { reservarPorta } from '../../shared/test/efemero-comum.ts';
import type { EstadoDeAdmissao } from '../src/admissao.ts';
import {
  admitirSessao,
  contaBloqueada,
  empresaSuspensa,
  pessoaDesativada,
  RECUSA_DE_CREDENCIAL,
  segundoFatorExigido,
  senhaProvisoriaPendente,
} from '../src/admissao.ts';
import { LIMITE_DE_FALHAS_CONSECUTIVAS, registrarFalha } from '../src/bloqueio.ts';
import * as indiceDoPacote from '../src/index.ts';
import { diferencasDeConjunto } from './conjuntos.ts';
import { type IdentidadeEfemera, identidadeEfemera, pessoaSemeada } from './identidade-efemera.ts';

// ---------------------------------------------------------------------------------------------
// A superfície do arcabouço instalado, declarada
// ---------------------------------------------------------------------------------------------

/**
 * Os caminhos do arcabouço instalado que **criam sessão**.
 *
 * Classificados por leitura do pacote publicado (`better-auth@1.6.25`): é emissor todo caminho cujo
 * manipulador alcança `internalAdapter.createSession`, direta ou indiretamente. Os indiretos são
 * dois — `/sign-in/social` e `/callback/:id` chegam lá por `handleOAuthUserInfo` —, e é por eles que
 * uma classificação "por nome de rota" erraria.
 *
 * A lista é constante nomeada, e não derivada em tempo de execução, de propósito: derivá-la do
 * próprio pacote faria a asserção concordar com qualquer coisa que o pacote passasse a publicar, que
 * é justamente o que ela existe para impedir. O preço é que uma atualização do arcabouço obriga a
 * reclassificar à mão — e obrigar isso é o objetivo, não o custo.
 */
const CAMINHOS_EMISSORES = [
  '/callback/:id',
  '/change-password',
  '/sign-in/email',
  '/sign-in/social',
  '/sign-up/email',
  '/two-factor/disable',
  '/two-factor/enable',
  '/two-factor/verify-backup-code',
  '/two-factor/verify-otp',
  '/two-factor/verify-totp',
  '/verify-email',
] as const;

/**
 * O resto da superfície publicada: caminhos que **não** criam sessão.
 *
 * Ele existe para que a asserção de fechamento seja sobre a superfície INTEIRA. Conferir só o
 * conjunto emissor deixaria passar a rota nova que ninguém classificou — que é o caminho pelo qual um
 * emissor novo entraria sem ser notado, porque quem não sabe que ele existe não o classifica como
 * emissor.
 */
const CAMINHOS_SEM_EMISSAO = [
  '/account-info',
  '/change-email',
  '/delete-user',
  '/delete-user/callback',
  '/error',
  '/get-access-token',
  '/get-session',
  '/link-social',
  '/list-accounts',
  '/list-sessions',
  '/ok',
  '/refresh-token',
  '/request-password-reset',
  '/reset-password',
  '/reset-password/:token',
  '/revoke-other-sessions',
  '/revoke-session',
  '/revoke-sessions',
  '/send-verification-email',
  '/sign-out',
  '/two-factor/generate-backup-codes',
  '/two-factor/get-totp-uri',
  '/two-factor/send-otp',
  '/unlink-account',
  '/update-session',
  '/update-user',
  '/verify-password',
] as const;

/**
 * Tudo o que `@sysloc/auth` publica, em valor.
 *
 * A §3.3 da tech spec fixa que o pacote **não exporta** os caminhos internos do arcabouço que criam
 * sessão. Afirmar apenas a ausência de um nome específico não prova nada — o caminho interno entraria
 * com outro nome. A igualdade do conjunto inteiro é o que torna a fronteira verificável: um export
 * novo reprova aqui, e quem o acrescentar precisa declará-lo, que é o momento em que a pergunta "isto
 * emite sessão?" é feita.
 */
const SUPERFICIE_DO_PACOTE = [
  'COMPRIMENTO_DE_REPETICAO_PROIBIDA',
  'COMPRIMENTO_DE_SEQUENCIA_PROIBIDA',
  'COMPRIMENTO_MINIMO_DE_SENHA',
  'DURACAO_DO_BLOQUEIO_EM_MINUTOS',
  'LIMITE_DE_FALHAS_CONSECUTIVAS',
  'MOTIVOS_DE_RECUSA',
  'PERFIS',
  // Acrescentado no ciclo de correção da T10, e a pergunta que este inventário existe para forçar
  // foi feita: **isto emite sessão? NÃO.** É uma CONSTANTE — o `code` com que as validações de
  // produto (força de senha e formato do código do segundo fator) recusam no vocabulário do
  // arcabouço. Não cria linha em `identidade.sessao`, não devolve token nem cookie, e não decide
  // admissão. Sai do pacote pelo mesmo motivo de `RECUSA_DE_CREDENCIAL`: quem lê a recusa é
  // `apps/api`, que monta o envelope da ADR-0007 a partir dela em vez de reconhecê-la por um
  // segundo literal escrito à mão, livre para divergir deste.
  'RECUSA_DE_CAMPO_INVALIDO',
  'RECUSA_DE_CREDENCIAL',
  'RESTRICOES_DE_SESSAO',
  'admitirSessao',
  // `avaliarForcaDeSenha` saiu do índice na rodada 2 do ciclo de correção da T10: a política é
  // aplicada INTERNAMENTE pelo gancho de `autenticacao.ts`, que a lê de `./senha.js`, e nenhum
  // pacote de fora a chama. O que continua publicado é o VOCABULÁRIO da recusa — os `COMPRIMENTO_*`
  // e o enum de motivos —, que é contrato da API porque viaja em `detalhes.motivos`.
  // Acrescentado na rodada 2 da T9, e a pergunta que este inventário existe para forçar foi feita:
  // **isto emite sessão? NÃO.** É uma LEITURA — a linha de `identidade.usuario` por identificador,
  // para a guarda de contexto de `apps/api` montar a sessão do produto de quem o arcabouço JÁ
  // autenticou. Não cria linha em `identidade.sessao`, não devolve token nem cookie, e não tem como:
  // o único parâmetro além do banco é o `usuarioId` que a sessão conferida carrega. Ela sai do
  // pacote para que a consulta a `identidade` continue sendo uma só e escrita num lugar só — ver o
  // índice do pacote e a §11.2 da tech spec.
  'carregarPessoaDaSessao',
  'contaBloqueada',
  'criarAutenticacao',
  'empresaSuspensa',
  'estaBloqueada',
  'limparBloqueio',
  // Acrescentado na T10, e a pergunta que este inventário existe para forçar foi feita: **isto
  // emite sessão? NÃO.** É uma ESCRITA de uma coluna do produto — baixa
  // `identidade.usuario.senha_provisoria` depois de a troca de senha ter sido aceita, que é o que
  // faz a exigência da RN-09 ter desfecho. Não toca `identidade.sessao`, não devolve token nem
  // cookie, e não decide admissão: ela é o par do predicado `senhaProvisoriaPendente`, que lê a
  // mesma coluna. Sai do pacote para que quem lê a marca e quem a baixa continuem no mesmo arquivo,
  // e para que `apps/api` não precise conhecer o schema de identidade (§11.2 da tech spec).
  'limparMarcaDeSenhaProvisoria',
  'pessoaDesativada',
  'registrarFalha',
  'registrarTentativa',
  'segundoFatorExigido',
  'senhaProvisoriaPendente',
] as const;

/** O caminho emissor forjado da prova de falsificação. Não existe no arcabouço. */
const CAMINHO_EMISSOR_FORJADO = '/sessao-por-fora';

/**
 * O prefixo em que a instância monta as rotas — o mesmo que `identidade-efemera.ts` passa à fábrica,
 * e o que a §4.1 da tech spec fixa.
 *
 * Os caminhos declarados acima são **relativos ao prefixo**, que é como o arcabouço os publica; o
 * servidor, por ser real, só os alcança pelo caminho absoluto. Escrito aqui e não derivado do helper
 * porque ele não o publica — e derivá-lo do próprio manipulador faria a requisição concordar com
 * qualquer prefixo, inclusive o errado.
 */
const PREFIXO_DAS_ROTAS = '/v1/auth';

// ---------------------------------------------------------------------------------------------
// O elenco
// ---------------------------------------------------------------------------------------------

/** Ativa, em empresa ativa: o controle positivo, e a pessoa da narrativa de `/change-password`. */
const PESSOA_ADMITIDA = pessoaSemeada('admin.a@exemplo.com.br');

/** Levada ao bloqueio pelo caminho real — `registrarFalha`, a mesma operação que a RN-06 usa. */
const PESSOA_BLOQUEADA = pessoaSemeada('usuario.a@exemplo.com.br');

/** Desativada. É o Master: sem empresa, o que também exercita o predicado que só vale para quem tem. */
const PESSOA_DESATIVADA = pessoaSemeada('master@sysloc.com.br');

/** Ativa, em empresa suspensa. */
const PESSOA_DE_EMPRESA_SUSPENSA = pessoaSemeada('admin.b@exemplo.com.br');

/** As três que a barreira recusa. */
const PESSOAS_RECUSADAS: readonly UsuarioSemeado[] = [
  PESSOA_BLOQUEADA,
  PESSOA_DESATIVADA,
  PESSOA_DE_EMPRESA_SUSPENSA,
];

const SENHA_ERRADA = 'nao-e-a-senha-desta-conta';

/** Senha nova da narrativa de `/change-password`. Satisfaz o piso de comprimento do arcabouço. */
const SENHA_NOVA = 'trovao3Perto!';

const ORIGEM = '203.0.113.7';
const AGENTE = 'verificacao/1';

/** Sufixo do nome do cookie de sessão do arcabouço, como em `sessao.spec.ts`. */
const SUFIXO_DO_COOKIE_DE_SESSAO = 'session_token';

let identidade: IdentidadeEfemera;
let servidor: Servidor;

beforeAll(async () => {
  identidade = await identidadeEfemera();

  try {
    servidor = await subirServidor((pedido) => identidade.autenticacao.handler(pedido));
  } catch (erro) {
    await identidade.parar();
    throw erro;
  }

  const banco = identidade.acesso.identidade;
  const { empresa, usuario } = esquemaIdentidade;

  // O bloqueio nasce da operação REAL de bloqueio, não de uma escrita forjada em `bloqueado_ate`:
  // é `registrarFalha` que a RN-06 executa, e é o instante que ela grava que o predicado lê.
  for (let falha = 0; falha < LIMITE_DE_FALHAS_CONSECUTIVAS; falha += 1) {
    await registrarFalha(banco, PESSOA_BLOQUEADA.id);
  }

  // Desativação e suspensão não têm operação de produção nesta fatia — elas são da fatia de
  // autorização. Escrever a coluna de domínio é o arranjo legítimo do estado, e é o que a
  // pré-condição do CT-026 pede ("semente com um usuário para cada predicado de recusa").
  await banco.update(usuario).set({ ativo: false }).where(eq(usuario.id, PESSOA_DESATIVADA.id));
  await banco.update(empresa).set({ suspensaEm: new Date() }).where(eq(empresa.id, EMPRESA_B.id));
});

afterAll(async () => {
  await servidor?.parar();
  await identidade?.parar();
});

// ---------------------------------------------------------------------------------------------
// CT-026 — eixo estático: a superfície é fechada e conhecida
// ---------------------------------------------------------------------------------------------

describe('CT-026 — a superfície de emissão do arcabouço é fechada e conhecida', () => {
  it('o conjunto de caminhos publicados é exatamente o classificado', () => {
    const publicados = caminhosPublicados();

    // O eixo positivo do par: sem ele, uma superfície VAZIA passaria a comparação seguinte por
    // vacuidade — comparar dois conjuntos vazios é comparar nada com nada.
    expect(publicados.length).toBe(CAMINHOS_EMISSORES.length + CAMINHOS_SEM_EMISSAO.length);

    expect(
      diferencasDeConjunto(publicados, [...CAMINHOS_EMISSORES, ...CAMINHOS_SEM_EMISSAO]),
    ).toEqual({ excedentes: [], ausentes: [] });
  });

  it('prova de falsificação — a asserção de conjunto reprova sobre superfície com emissor a mais', () => {
    const declarado = [...CAMINHOS_EMISSORES, ...CAMINHOS_SEM_EMISSAO];

    // O controle: a superfície íntegra passa limpo no MESMO harness.
    expect(diferencasDeConjunto(caminhosPublicados(), declarado)).toEqual({
      excedentes: [],
      ausentes: [],
    });

    // O mutante: uma versão do arcabouço que publicasse um emissor a mais. A asserção reprova, e
    // reprova NOMEANDO o excedente — não com um "os conjuntos diferem" que obrigaria a caçá-lo.
    const comEmissorAMais = [...caminhosPublicados(), CAMINHO_EMISSOR_FORJADO];
    expect(diferencasDeConjunto(comEmissorAMais, declarado)).toEqual({
      excedentes: [CAMINHO_EMISSOR_FORJADO],
      ausentes: [],
    });

    // E o simétrico: um caminho que SUMISSE da superfície também reprova, nomeando o ausente. Sem
    // esta perna, a asserção de fechamento seria apenas "não sobrou nada", e um arcabouço que
    // deixasse de publicar a rota de entrada passaria em silêncio.
    expect(diferencasDeConjunto([], declarado)).toEqual({
      excedentes: [],
      ausentes: [...declarado].sort(),
    });
  });

  it('o índice de @sysloc/auth publica exatamente a superfície declarada, e nada que emita sessão', () => {
    const publicado = Object.keys(indiceDoPacote);

    expect(publicado.length).toBe(SUPERFICIE_DO_PACOTE.length);
    expect(diferencasDeConjunto(publicado, [...SUPERFICIE_DO_PACOTE])).toEqual({
      excedentes: [],
      ausentes: [],
    });
  });
});

// ---------------------------------------------------------------------------------------------
// CT-026 — eixo comportamental: nenhuma sessão nasce fora da barreira
// ---------------------------------------------------------------------------------------------

describe('CT-026 — nenhum caminho de emissão produz sessão para quem a barreira recusa', () => {
  it('a pessoa admitida entra e ganha exatamente uma sessão; depois de desativada, nem por /change-password', async () => {
    const banco = identidade.acesso.identidade;

    // ------------------------------------------------------------------------------------------
    // Fase 1 — o controle positivo. Sem ele, "nenhuma sessão foi criada" passaria sobre uma
    // barreira que recusa todo mundo, que é o modo de falha mais fácil de escrever sem querer.
    // ------------------------------------------------------------------------------------------
    expect(await contarSessoesDe(PESSOA_ADMITIDA.id)).toBe(0);

    const entrada = await requisitar('POST', '/sign-in/email', {
      corpo: { email: PESSOA_ADMITIDA.email, password: SENHA_DA_CARGA },
    });

    expect(entrada.status).toBe(200);
    expect(await contarSessoesDe(PESSOA_ADMITIDA.id)).toBe(1);

    const cookie = parDoCookieDeSessao(entrada);

    // ------------------------------------------------------------------------------------------
    // Fase 2 — a MESMA pessoa, agora desativada, tentando emitir sessão por outra rota emissora.
    // `/change-password` com `revokeOtherSessions` apaga as sessões da pessoa e cria uma nova: se a
    // barreira estivesse instalada apenas no gancho da rota de entrada, a sessão nova nasceria aqui.
    // ------------------------------------------------------------------------------------------
    const { usuario } = esquemaIdentidade;
    await banco.update(usuario).set({ ativo: false }).where(eq(usuario.id, PESSOA_ADMITIDA.id));

    const trocaDeSenha = await requisitar('POST', '/change-password', {
      corpo: {
        currentPassword: SENHA_DA_CARGA,
        newPassword: SENHA_NOVA,
        revokeOtherSessions: true,
      },
      cookie,
    });

    expect(trocaDeSenha.status).toBe(401);
    expect(await corpoJson(trocaDeSenha)).toEqual(RECUSA_DE_CREDENCIAL);

    // A afirmação que discrimina: a pessoa ficou SEM sessão. Um SUT sem barreira no ponto de
    // emissão devolveria `200` e deixaria uma sessão nova aqui.
    expect(await contarSessoesDe(PESSOA_ADMITIDA.id)).toBe(0);
    expect(cookieDeSessaoDe(trocaDeSenha)).toBeUndefined();
  });

  it('nenhuma das rotas emissoras cria sessão para nenhuma das pessoas recusadas', async () => {
    const sessoesAntes = await contarSessoes();
    const respostas: { caminho: string; email: string; resposta: Response }[] = [];

    for (const caminho of CAMINHOS_EMISSORES) {
      for (const pessoa of PESSOAS_RECUSADAS) {
        respostas.push({
          caminho,
          email: pessoa.email,
          resposta: await exercitarCaminho(caminho, pessoa.email),
        });
      }
    }

    // O produto inteiro foi exercitado — sem esta contagem, um laço que não executasse nada
    // deixaria as asserções abaixo verdadeiras por vacuidade.
    expect(respostas.length).toBe(CAMINHOS_EMISSORES.length * PESSOAS_RECUSADAS.length);

    // E cada requisição CHEGOU ao arcabouço. Esta perna não é ornamento: com o prefixo errado no
    // endereço, as 33 respostas voltam `404`, nenhuma sessão nasce e o caso passa provando nada —
    // foi o que aconteceu na primeira execução deste arquivo.
    expect(
      respostas
        .filter(({ resposta }) => resposta.status === 404)
        .map(({ caminho, email }) => `${caminho} × ${email}`),
    ).toEqual([]);

    expect(await contarSessoes()).toBe(sessoesAntes);

    // Nenhuma resposta devolveu credencial de sessão. A contagem no banco não cobre isto sozinha: o
    // arcabouço poderia, em tese, marcar o cookie a partir de uma sessão vinda de outro lugar.
    expect(
      respostas
        .filter(({ resposta }) => cookieDeSessaoDe(resposta) !== undefined)
        .map(({ caminho, email }) => `${caminho} × ${email}`),
    ).toEqual([]);
  });

  it('a recusa da barreira na entrada é idêntica à que o arcabouço emite para senha errada', async () => {
    const banco = identidade.acesso.identidade;
    const { conta, usuario } = esquemaIdentidade;

    // ------------------------------------------------------------------------------------------
    // O sujeito da referência é ARRANJADO por este caso, e não herdado do estado que os anteriores
    // deixaram.
    //
    // Herdá-lo foi o defeito da rodada 1, e ele tinha DUAS pernas, ambas invisíveis daqui: o
    // primeiro caso deste `describe` desativa `PESSOA_ADMITIDA` e nunca restaura, e o
    // `/change-password` que ele exercita grava a senha nova ANTES de a barreira recusar a emissão
    // da sessão (medido no manipulador publicado: `updateAccount` precede `createSession`). Na
    // ordem em que o arquivo corre, a "recusa do arcabouço para senha errada" era, na verdade, a
    // recusa da PRÓPRIA barreira por `PESSOA_DESATIVADA` — e a igualdade abaixo comparava
    // `RECUSA_DE_CREDENCIAL` consigo mesma, sobrevivendo a qualquer divergência do SUT.
    //
    // Arranjar aqui, e não restaurar lá, é o que fecha a classe: a prova deixa de depender da
    // ordem de execução e do arranjo de um caso vizinho. A derivação é a do próprio arcabouço
    // (`hashPassword`, a mesma que `identidade-efemera.ts` entrega a `semear`), e não uma cadeia
    // forjada — senão a entrada com a senha certa passaria a depender de a forja coincidir com o
    // formato que o arcabouço confere.
    // ------------------------------------------------------------------------------------------
    await banco.update(usuario).set({ ativo: true }).where(eq(usuario.id, PESSOA_ADMITIDA.id));
    await banco
      .update(conta)
      .set({ senhaDerivada: await hashPassword(SENHA_DA_CARGA) })
      .where(eq(conta.usuarioId, PESSOA_ADMITIDA.id));

    // A admissão desta conta é OBSERVADA, não presumida: com a senha certa ela entra, devolve
    // `200` e um cookie de sessão. É esta asserção que reprova — alto e no ponto certo — no dia em
    // que um caso novo acima daqui, ou uma reordenação, deixar a conta em estado recusado. Sem
    // ela, a referência volta a ser a recusa da barreira e tudo o que vem depois passa por
    // tautologia, exatamente como na rodada 1.
    const admitida = await requisitar('POST', '/sign-in/email', {
      corpo: { email: PESSOA_ADMITIDA.email, password: SENHA_DA_CARGA },
    });

    expect(admitida.status).toBe(200);
    expect(cookieDeSessaoDe(admitida)).toBeDefined();

    // A referência NÃO é um literal escrito à mão: é a recusa que o próprio arcabouço produz para
    // uma senha errada na MESMA conta que acabou de ser admitida acima. Comparar as respostas
    // ENTRE SI é o que prova a indistinguibilidade — dois literais escritos à mão continuariam
    // iguais mesmo se o SUT divergisse em ambos.
    const referencia = await requisitar('POST', '/sign-in/email', {
      corpo: { email: PESSOA_ADMITIDA.email, password: SENHA_ERRADA },
    });

    // A âncora que impede a comparação de virar tautologia: a referência é, de fato, a recusa
    // canônica. Sem ela, um SUT que devolvesse `200` nas quatro respostas passaria a igualdade.
    expect(referencia.status).toBe(401);
    expect(await corpoJson(referencia)).toEqual(RECUSA_DE_CREDENCIAL);

    const referenciaComparavel = { status: 401, corpo: await corpoJson(referencia) };

    for (const pessoa of PESSOAS_RECUSADAS) {
      const recusa = await requisitar('POST', '/sign-in/email', {
        corpo: { email: pessoa.email, password: SENHA_DA_CARGA },
      });

      expect({ status: recusa.status, corpo: await corpoJson(recusa) }).toEqual(
        referenciaComparavel,
      );
      expect(cookieDeSessaoDe(recusa)).toBeUndefined();
    }

    // ------------------------------------------------------------------------------------------
    // Indistinguível por fora, nomeada por dentro: a trilha registra o motivo, e o contador de
    // credencial NÃO anda. As duas asserções abaixo reprovam a barreira consultada apenas no ponto
    // de emissão — ali o arcabouço já teria conferido a senha, e o gancho `depois` gravaria
    // `CREDENCIAL_INCORRETA` com incremento do contador, trancando por RN-06 quem acertou a senha.
    // ------------------------------------------------------------------------------------------
    expect(await desfechosDaTrilhaDe(PESSOA_BLOQUEADA.id)).toEqual(['CONTA_BLOQUEADA']);
    expect(await desfechosDaTrilhaDe(PESSOA_DESATIVADA.id)).toEqual(['ACESSO_RECUSADO']);
    expect(await desfechosDaTrilhaDe(PESSOA_DE_EMPRESA_SUSPENSA.id)).toEqual(['ACESSO_RECUSADO']);

    expect(await lerContador(PESSOA_DESATIVADA.id)).toBe(0);
    expect(await lerContador(PESSOA_DE_EMPRESA_SUSPENSA.id)).toBe(0);
    // A bloqueada continua com as cinco do preparo, e nenhuma a mais: a recusa por política não
    // soma tentativa de credencial.
    expect(await lerContador(PESSOA_BLOQUEADA.id)).toBe(LIMITE_DE_FALHAS_CONSECUTIVAS);
  });
});

// ---------------------------------------------------------------------------------------------
// Os cinco predicados, um a um — função pura, sem HTTP e sem banco
// ---------------------------------------------------------------------------------------------

const AGORA = new Date('2026-08-02T12:00:00.000Z');
const DAQUI_A_POUCO = new Date(AGORA.getTime() + 60_000);
const HA_POUCO = new Date(AGORA.getTime() - 60_000);

/** Uma pessoa que a barreira admite sem restrição. Cada caso muda **um** campo dela. */
function estado(sobrescritas: Partial<EstadoDeAdmissao> = {}): EstadoDeAdmissao {
  return {
    usuarioId: '11111111-0000-4000-8000-000000000001',
    perfil: 'ADMIN_EMPRESA',
    ativo: true,
    senhaProvisoria: false,
    doisFatoresAtivo: false,
    tentativasFalhas: 0,
    bloqueadoAte: null,
    empresaId: '11111111-1111-4111-8111-111111111111',
    empresaSuspensaEm: null,
    ...sobrescritas,
  };
}

describe('T7 §4 — os cinco predicados são nomeados e decidem isoladamente', () => {
  it('contaBloqueada olha o instante de liberação, e o prazo vencido não bloqueia', () => {
    expect(contaBloqueada(estado({ bloqueadoAte: DAQUI_A_POUCO }), AGORA)).toBe(true);
    expect(contaBloqueada(estado({ bloqueadoAte: HA_POUCO }), AGORA)).toBe(false);
    // Contador cheio com prazo vencido NÃO bloqueia: é o instante que expira sozinho, não a
    // contagem. Usar o contador manteria a conta trancada para sempre.
    expect(
      contaBloqueada(
        estado({ tentativasFalhas: LIMITE_DE_FALHAS_CONSECUTIVAS, bloqueadoAte: null }),
        AGORA,
      ),
    ).toBe(false);
  });

  it('pessoaDesativada é a negação de ativo', () => {
    expect(pessoaDesativada(estado({ ativo: false }))).toBe(true);
    expect(pessoaDesativada(estado({ ativo: true }))).toBe(false);
  });

  it('empresaSuspensa exige empresa: quem não pertence a nenhuma nunca é recusado por ela', () => {
    expect(empresaSuspensa(estado({ empresaSuspensaEm: HA_POUCO }))).toBe(true);
    expect(empresaSuspensa(estado({ empresaSuspensaEm: null }))).toBe(false);
    // O Master. A ausência de empresa é o discriminante — sem a verificação de `empresaId`, um
    // instante de suspensão herdado por engano o recusaria.
    expect(
      empresaSuspensa(
        estado({ perfil: 'SYSLOC_MASTER', empresaId: null, empresaSuspensaEm: HA_POUCO }),
      ),
    ).toBe(false);
  });

  it('senhaProvisoriaPendente é a marca da senha provisória', () => {
    expect(senhaProvisoriaPendente(estado({ senhaProvisoria: true }))).toBe(true);
    expect(senhaProvisoriaPendente(estado({ senhaProvisoria: false }))).toBe(false);
  });

  it('segundoFatorExigido vale para o Master sem segundo fator, e só para ele', () => {
    expect(segundoFatorExigido(estado({ perfil: 'SYSLOC_MASTER', empresaId: null }))).toBe(true);
    // Com o segundo fator ativo não há o que exigir — e nesse caso o arcabouço interrompe para o
    // desafio antes de criar sessão, de modo que a barreira nem é alcançada.
    expect(
      segundoFatorExigido(
        estado({ perfil: 'SYSLOC_MASTER', empresaId: null, doisFatoresAtivo: true }),
      ),
    ).toBe(false);
    // Para os outros dois perfis o segundo fator é adesão própria, não exigência (RN-08).
    expect(segundoFatorExigido(estado({ perfil: 'ADMIN_EMPRESA' }))).toBe(false);
    expect(segundoFatorExigido(estado({ perfil: 'USUARIO_EMPRESA' }))).toBe(false);
  });
});

describe('T7 §4 — admitirSessao para no primeiro predicado que recusa', () => {
  it('a ordem é determinística: bloqueada vence desativada, que vence empresa suspensa', () => {
    const tudoRuim = {
      bloqueadoAte: DAQUI_A_POUCO,
      ativo: false,
      empresaSuspensaEm: HA_POUCO,
    } as const;

    // Os três predicados verdadeiros ao mesmo tempo: o motivo devolvido nomeia QUAL deles decidiu, e
    // é isso que torna a ordem observável em vez de detalhe interno.
    expect(admitirSessao(estado(tudoRuim), AGORA)).toEqual({
      admitida: false,
      motivo: 'CONTA_BLOQUEADA',
    });

    expect(admitirSessao(estado({ ...tudoRuim, bloqueadoAte: null }), AGORA)).toEqual({
      admitida: false,
      motivo: 'PESSOA_DESATIVADA',
    });

    expect(admitirSessao(estado({ ...tudoRuim, bloqueadoAte: null, ativo: true }), AGORA)).toEqual({
      admitida: false,
      motivo: 'EMPRESA_SUSPENSA',
    });
  });

  it('a recusa não computa restrição alguma — o desfecho recusado não tem o campo', () => {
    // Igualdade do objeto INTEIRO, e não `admitida === false`: é o que impede um desfecho recusado
    // de carregar `restricoes` junto, que é por onde a marca de sessão restrita vazaria para um
    // caminho em que não existe sessão.
    expect(
      admitirSessao(
        estado({ ativo: false, senhaProvisoria: true, perfil: 'SYSLOC_MASTER', empresaId: null }),
        AGORA,
      ),
    ).toEqual({ admitida: false, motivo: 'PESSOA_DESATIVADA' });
  });

  it('senha provisória e segundo fator exigido admitem a sessão, marcando-a como restrita', () => {
    expect(
      admitirSessao(
        estado({ perfil: 'SYSLOC_MASTER', empresaId: null, senhaProvisoria: true }),
        AGORA,
      ),
    ).toEqual({ admitida: true, restricoes: ['SENHA_PROVISORIA', 'SEGUNDO_FATOR'] });

    expect(admitirSessao(estado({ senhaProvisoria: true }), AGORA)).toEqual({
      admitida: true,
      restricoes: ['SENHA_PROVISORIA'],
    });

    expect(admitirSessao(estado({ perfil: 'SYSLOC_MASTER', empresaId: null }), AGORA)).toEqual({
      admitida: true,
      restricoes: ['SEGUNDO_FATOR'],
    });
  });

  it('pessoa ativa em empresa ativa é admitida sem restrição alguma', () => {
    expect(admitirSessao(estado(), AGORA)).toEqual({ admitida: true, restricoes: [] });
  });
});

// ---------------------------------------------------------------------------------------------
// Ferramental do caso
// ---------------------------------------------------------------------------------------------

/**
 * Os caminhos que a instância publica, obtidos pela mesma superfície pública que a aplicação usa
 * para montá-los.
 *
 * Nada de leitura de arquivo do pacote nem de export interno: o que se pergunta à instância é o que
 * ela publica. Os manipuladores marcados como exclusivos de servidor não declaram caminho — eles não
 * são alcançáveis por HTTP e por isso não fazem parte da superfície publicada.
 */
function caminhosPublicados(): string[] {
  return superficie().map(({ caminho }) => caminho);
}

/** Cada manipulador publicado, com o caminho e o método declarados. */
function superficie(): { caminho: string; metodos: string[] }[] {
  const manipuladores = Object.values(identidade.autenticacao.api) as {
    path?: string;
    options?: { method?: string | string[] };
  }[];

  return manipuladores
    .filter((manipulador) => typeof manipulador.path === 'string')
    .map((manipulador) => ({
      caminho: manipulador.path as string,
      metodos: [manipulador.options?.method ?? 'POST'].flat(),
    }));
}

/**
 * Executa um caminho emissor com a credencial correta da pessoa.
 *
 * O método é o que o próprio manipulador declara — `POST` quando ele o aceita, porque é o verbo que
 * carrega a credencial. O parâmetro de caminho recebe um valor qualquer: o que está sob prova é a
 * emissão de sessão, e não a resolução do parâmetro.
 */
async function exercitarCaminho(caminho: string, email: string): Promise<Response> {
  const declarado = superficie().find((rota) => rota.caminho === caminho);

  if (declarado === undefined) {
    throw new Error(`o caminho ${caminho} não está publicado pela instância`);
  }

  const metodo = declarado.metodos.includes('POST') ? 'POST' : (declarado.metodos[0] ?? 'GET');
  const alvo = caminho.replace(/:[^/]+/g, 'credential');
  const credencial = { email, password: SENHA_DA_CARGA, currentPassword: SENHA_DA_CARGA };

  return await requisitar(metodo, alvo, metodo === 'GET' ? {} : { corpo: credencial });
}

interface OpcoesDeRequisicao {
  readonly corpo?: Record<string, unknown>;
  readonly cookie?: string;
}

/** Uma requisição HTTP real contra o servidor em porta dinâmica. */
async function requisitar(
  metodo: string,
  caminho: string,
  opcoes: OpcoesDeRequisicao = {},
): Promise<Response> {
  const cabecalhos = new Headers({
    'x-forwarded-for': ORIGEM,
    'user-agent': AGENTE,
  });

  if (opcoes.corpo !== undefined) {
    cabecalhos.set('content-type', 'application/json');
  }

  if (opcoes.cookie !== undefined) {
    cabecalhos.set('cookie', opcoes.cookie);
  }

  return await fetch(`${servidor.base}${PREFIXO_DAS_ROTAS}${caminho}`, {
    method: metodo,
    headers: cabecalhos,
    redirect: 'manual',
    ...(opcoes.corpo === undefined ? {} : { body: JSON.stringify(opcoes.corpo) }),
  });
}

/** O corpo da resposta como objeto, ou `null` quando ela não traz JSON. */
async function corpoJson(resposta: Response): Promise<unknown> {
  const texto = await resposta.clone().text();

  try {
    return JSON.parse(texto);
  } catch {
    return null;
  }
}

/** O cookie de sessão da resposta, se ela emitiu um. */
function cookieDeSessaoDe(resposta: Response): string | undefined {
  return resposta.headers
    .getSetCookie()
    .find((cookie) => nomeDoCookie(cookie).endsWith(SUFIXO_DO_COOKIE_DE_SESSAO));
}

/** O par `nome=valor` do cookie de sessão, no formato em que o cliente o reenvia. */
function parDoCookieDeSessao(resposta: Response): string {
  const cookie = cookieDeSessaoDe(resposta);

  if (cookie === undefined) {
    throw new Error('a entrada bem-sucedida não devolveu cookie de sessão');
  }

  return cookie.split(';')[0] ?? '';
}

function nomeDoCookie(cookie: string): string {
  return (cookie.split(';')[0] ?? '').split('=')[0]?.trim() ?? '';
}

/** Quantas sessões existem no banco, ao todo. */
async function contarSessoes(): Promise<number> {
  const [linha] = await identidade.acesso.identidade
    .select({ total: count() })
    .from(esquemaIdentidade.sessao);

  return linha?.total ?? 0;
}

/**
 * Os desfechos DISTINTOS que a trilha registrou para a pessoa, em ordem.
 *
 * Distintos, e não a lista bruta: o produto cartesiano também exercita `/sign-in/email` para as
 * mesmas três pessoas, e a quantidade de linhas passaria a depender da ordem em que os casos deste
 * arquivo correm. O que precisa valer é que **todo** registro daquela pessoa tenha o desfecho certo
 * — e o conjunto vazio, quando nada foi registrado, reprova a igualdade.
 */
async function desfechosDaTrilhaDe(usuarioId: string): Promise<string[]> {
  const { tentativaLogin } = esquemaIdentidade;

  const linhas = await identidade.acesso.identidade
    .selectDistinct({ desfecho: tentativaLogin.desfecho })
    .from(tentativaLogin)
    .where(eq(tentativaLogin.usuarioId, usuarioId));

  return linhas.map(({ desfecho }) => desfecho).sort();
}

/** O contador de falhas consecutivas de credencial da conta. */
async function lerContador(usuarioId: string): Promise<number> {
  const { usuario } = esquemaIdentidade;

  const [linha] = await identidade.acesso.identidade
    .select({ tentativasFalhas: usuario.tentativasFalhas })
    .from(usuario)
    .where(eq(usuario.id, usuarioId));

  if (linha === undefined) {
    throw new Error(`a conta ${usuarioId} sumiu da carga inicial no meio do caso`);
  }

  return linha.tentativasFalhas;
}

/** Quantas sessões a pessoa tem. */
async function contarSessoesDe(usuarioId: string): Promise<number> {
  const { sessao } = esquemaIdentidade;

  const [linha] = await identidade.acesso.identidade
    .select({ total: count() })
    .from(sessao)
    .where(eq(sessao.usuarioId, usuarioId));

  return linha?.total ?? 0;
}

interface Servidor {
  readonly base: string;
  parar(): Promise<void>;
}

/**
 * Sobe um servidor HTTP real, em porta dinâmica, que delega ao manipulador da instância.
 *
 * A porta vem de `reservarPorta`, que é o ferramental do repositório: ela toma a trava no núcleo
 * antes de sondar, e é o que impede duas execuções concorrentes de escolherem a mesma porta.
 *
 * A ponte entre o servidor do runtime e o manipulador é deliberadamente burra — método, caminho,
 * cabeçalhos e corpo entram; status, cabeçalhos e corpo saem. Qualquer tradução a mais aqui seria
 * comportamento do teste se passando por comportamento do arcabouço.
 */
async function subirServidor(
  manipulador: (pedido: Request) => Promise<Response>,
): Promise<Servidor> {
  const porta = await reservarPorta();
  const base = `http://127.0.0.1:${porta}`;

  const instancia: Server = createServer((requisicao, resposta) => {
    const pedacos: Buffer[] = [];

    requisicao.on('data', (pedaco: Buffer) => pedacos.push(pedaco));
    requisicao.on('end', () => {
      void (async () => {
        try {
          const metodo = requisicao.method ?? 'GET';
          const semCorpo = metodo === 'GET' || metodo === 'HEAD';

          const devolvida = await manipulador(
            new Request(`${base}${requisicao.url ?? '/'}`, {
              method: metodo,
              headers: cabecalhosDoPedido(requisicao.headers),
              ...(semCorpo ? {} : { body: Buffer.concat(pedacos) }),
            }),
          );

          const cookies = devolvida.headers.getSetCookie();
          const cabecalhos: Record<string, string | string[]> = {};

          for (const [nome, valor] of devolvida.headers) {
            if (nome.toLowerCase() !== 'set-cookie') {
              cabecalhos[nome] = valor;
            }
          }

          if (cookies.length > 0) {
            cabecalhos['set-cookie'] = cookies;
          }

          resposta.writeHead(devolvida.status, cabecalhos);
          resposta.end(Buffer.from(await devolvida.arrayBuffer()));
        } catch (erro) {
          // Falha da ponte não pode virar resposta plausível: um `500` mudo aqui seria lido como
          // recusa do arcabouço e o caso passaria pela razão errada.
          resposta.writeHead(599, { 'content-type': 'text/plain' });
          resposta.end(`falha na ponte HTTP do caso: ${String(erro)}`);
        }
      })();
    });
  });

  await new Promise<void>((resolver, rejeitar) => {
    instancia.once('error', rejeitar);
    instancia.listen(porta, '127.0.0.1', resolver);
  });

  return {
    base,
    parar: () =>
      new Promise<void>((resolver, rejeitar) => {
        instancia.closeAllConnections();
        instancia.close((erro) => (erro === undefined ? resolver() : rejeitar(erro)));
      }),
  };
}

/** Os cabeçalhos do pedido do runtime, na forma que `Request` aceita. */
function cabecalhosDoPedido(brutos: NodeJS.Dict<string | string[]>): Headers {
  const cabecalhos = new Headers();

  for (const [nome, valor] of Object.entries(brutos)) {
    if (valor === undefined) {
      continue;
    }

    for (const item of [valor].flat()) {
      cabecalhos.append(nome, item);
    }
  }

  return cabecalhos;
}
