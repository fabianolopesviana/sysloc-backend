/**
 * A política de força de senha alcança a CLASSE "definição de senha" — T10, ciclo de correção.
 *
 * ---------------------------------------------------------------------------
 * INVARIANTES
 * ---------------------------------------------------------------------------
 *
 * | Critério | Caso   | Invariante |
 * |----------|--------|------------|
 * | CA-07    | T10 §6 | O conjunto de endpoints do arcabouço que DEFINEM uma senha é fechado e
 * |          |        | conhecido, e a tabela de resolução de dono cobre todos os que têm caminho.
 * |          |        | Uma versão nova do arcabouço que acrescente um definidor reprova aqui. |
 * | CA-07    | T10 §6 | TODO endpoint cujo corpo declare um campo de senha — `newPassword`,
 * |          |        | `password` ou `currentPassword` — está na partição declarada entre
 * |          |        | DEFINIDORES e CONFERIDORES. Um definidor de plugin que grave credencial
 * |          |        | por campo de outro nome entra como excedente e reprova, NOMEADO. |
 * | CA-07    | T10 §6 | A política corre em `/reset-password` — o SEGUNDO caminho que grava
 * | CA-10    |        | credencial —, recusa a senha fraca com o envelope da §6.1, NÃO grava a
 * |          |        | credencial e NÃO queima o token de uso único. Vale pelas DUAS origens do
 * |          |        | token (corpo e consulta), inclusive com a cadeia vazia no corpo. |
 * | CA-07    | T10 §6 | A política corre também no endpoint `serverOnly` que **não tem caminho**
 * |          |        | (`setPassword`), o que prova que o gatilho é o CAMPO do corpo e não uma
 * |          |        | lista de rotas. |
 *
 * Rastreabilidade: `CA-07 → T10 §6 (RN-05)`, `CA-10 → T10 §6 (RN-09)`.
 *
 * ---------------------------------------------------------------------------
 * Por que este arquivo existe, e por que ele NÃO passa por HTTP
 * ---------------------------------------------------------------------------
 *
 * A T10 instalou a política de força **no encaminhador HTTP de `apps/api`**, comparando o caminho
 * do pedido com o literal `/change-password`. A Revisão Técnica reprovou por topologia: a §6.1 da
 * tech spec escreve a regra por CLASSE — *"toda definição de senha"* —, e o arcabouço publica uma
 * SEGUNDA rota que grava credencial (`POST /reset-password`), além de um definidor `serverOnly` que
 * o encaminhador HTTP nunca vê. A correção moveu as duas validações de produto para o
 * `hooks.before` de `packages/auth/src/autenticacao.ts`.
 *
 * Os casos abaixo chamam `auth.api.*` **de propósito**, e não por atalho: é justamente a metade da
 * classe que o encaminhador HTTP não alcançava, e é a que a fatia `autorizacao-e-ciclo-de-acesso`
 * vai usar no onboarding. A metade que passa por HTTP continua provada onde já estava — o `CT-022`
 * de `apps/api/test/sessao-restrita.e2e.spec.ts`, que exercita `/v1/auth/change-password` com
 * requisição real e afirma o envelope inteiro.
 *
 * ---------------------------------------------------------------------------
 * Prova de falsificação
 * ---------------------------------------------------------------------------
 *
 * O eixo estático inspeciona superfície, não comportamento, e por isso
 * `.claude/rules/testing-stack.md` exige demonstrar que ele **reprova** sobre uma cópia com o
 * defeito reintroduzido. São **dois** casos de falsificação, um por inventário:
 *
 *   * o dos DEFINIDORES aplica a mesma comparação a uma superfície com um definidor a mais e a
 *     outra sem nenhum, e afirma que ela NOMEIA o excedente e o ausente;
 *   * o da PARTIÇÃO aplica a **função de inventário commitada** a uma superfície acrescida do
 *     endpoint que o plugin `email-otp` publicaria — molde literal do pacote instalado, campo
 *     `password` e gravação de credencial —, e afirma que ele entra como excedente NOMEADO. É o
 *     defeito que a escolha do campo como discriminador introduz, e que o inventário anterior,
 *     cego a tudo que não fosse `newPassword`, não podia acusar.
 *
 * O eixo comportamental é falsificável por construção — ele reprova sobre o SUT anterior a esta
 * correção, em que a política não corria em `/reset-password` nem em `setPassword` de forma alguma.
 * A perna do token na CONSULTA reprova sobre o SUT da rodada anterior desta mesma correção, em que
 * o resolvedor de dono lia a cadeia vazia do corpo como valor presente: medido, a chamada devolvia
 * `{"status":true}` — o manipulador gravava a senha fraca com o token da consulta.
 */

import { esquemaIdentidade, SENHA_DA_CARGA } from '@sysloc/db';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { CAMINHOS_QUE_DEFINEM_SENHA, RECUSA_DE_CAMPO_INVALIDO } from '../src/autenticacao.ts';
import { diferencasDeConjunto } from './conjuntos.ts';
import { type IdentidadeEfemera, identidadeEfemera, pessoaSemeada } from './identidade-efemera.ts';

/** Limite de um caso que atravessa o banco várias vezes. */
const LIMITE_CASO_MS = 60_000;

/** Limite da subida da instância efêmera. */
const LIMITE_DE_MONTAGEM_MS = 240_000;

/**
 * Os endpoints do arcabouço que DEFINEM uma senha, pela chave com que ele os publica.
 *
 * Três, e o terceiro é o que faz este inventário valer a pena: `setPassword` é `serverOnly` e
 * **não tem caminho** (`createAuthEndpoint.serverOnly` não recebe um), de modo que nenhuma tabela
 * de rotas o alcançaria. É por isso que o gatilho da política é o CAMPO do corpo.
 */
const DEFINIDORES_DE_SENHA = ['changePassword', 'resetPassword', 'setPassword'] as const;

/**
 * Os endpoints que declaram campo de senha e estão **deliberadamente fora** da política.
 *
 * Eles CONFEREM uma senha existente — para entrar, para liberar um segredo ou para autorizar um ato
 * destrutivo —, e a razão de a política não correr sobre eles está escrita em `CAMPO_DA_SENHA_NOVA`
 * (`src/autenticacao.ts`): aplicá-la aqui recusaria a entrada de quem tem senha antiga fraca, que é
 * o oposto do que a RN-05 pede.
 *
 * A lista é maior que a óbvia, e é por isso que ela é DECLARADA e não deduzida: além de
 * `/sign-in/email`, `/verify-password` e `/delete-user`, o plugin de segundo fator traz mais quatro
 * — os dois de adesão (`enable`/`disable`) e os dois que entregam segredo (a URI do TOTP e os
 * códigos de recuperação), todos exigindo a senha atual como reautenticação.
 */
const CONFERIDORES_DE_SENHA = [
  'deleteUser',
  'disableTwoFactor',
  'enableTwoFactor',
  'generateBackupCodes',
  'getTOTPURI',
  'signInEmail',
  'verifyPassword',
] as const;

/** O campo com que o arcabouço define uma senha nova — o discriminador da classe. */
const CAMPO_DA_SENHA_NOVA = 'newPassword';

/**
 * Como se reconhece um campo de senha no esquema de corpo do arcabouço, **sem depender do nome que
 * a política escolheu**.
 *
 * É a diferença entre este inventário e o dos definidores: aquele pergunta por `newPassword`, que é
 * o MESMO discriminador da política, e por isso não pode enxergar a única falha que a escolha do
 * campo introduz — um endpoint que grave credencial com outro nome. Este pergunta pela família
 * inteira (`password`, `newPassword`, `currentPassword`, e o que uma versão futura acrescentar no
 * mesmo vocabulário), de modo que o definidor de plugin aparece como excedente da partição.
 */
const CAMPO_DE_SENHA = /password/iu;

/** Sujeito da redefinição. Escolhido por não ser sujeito de nenhum outro caso deste arquivo. */
const PESSOA_DA_REDEFINICAO = pessoaSemeada('usuario.b1@exemplo.com.br');

/** Sujeito do endpoint sem caminho. Idem. */
const PESSOA_DO_SET_PASSWORD = pessoaSemeada('usuario.b2@exemplo.com.br');

/**
 * Senha que viola **uma** regra da RN-05 e apenas uma — `Bruno` é o nome da pessoa da redefinição.
 *
 * Uma só, para que a asserção do motivo seja discriminante: com duas regras violadas, `motivos`
 * traria duas entradas e a igualdade deixaria de dizer QUAL regra pegou.
 */
const SENHA_FRACA_DA_REDEFINICAO = 'Bruno#2026Ok';

/** Idem para a pessoa do endpoint sem caminho — `Beatriz` é o nome dela. */
const SENHA_FRACA_DO_SET_PASSWORD = 'Beatriz#26Ok';

/** Senha aprovada pela política, sem pedaço do nome nem do e-mail da pessoa. */
const SENHA_FORTE = 'trovao3Perto!';

/** Prefixo com que o arcabouço indexa o token de redefinição em `identidade.verificacao`. */
const PREFIXO_DO_TOKEN_DE_REDEFINICAO = 'reset-password:';

let identidade: IdentidadeEfemera;

beforeAll(async () => {
  identidade = await identidadeEfemera();
}, LIMITE_DE_MONTAGEM_MS);

afterAll(async () => {
  await identidade?.parar();
});

// ---------------------------------------------------------------------------------------------
// Eixo estático — o conjunto de definidores é fechado, e a tabela de dono cobre os que têm caminho
// ---------------------------------------------------------------------------------------------

describe('T10 §6 — o conjunto de endpoints que definem senha é fechado e conhecido', () => {
  it('a superfície publicada declara exatamente os definidores conhecidos', () => {
    const observados = definidoresDeSenha().map(({ chave }) => chave);

    // O eixo positivo do par: sem ele, uma superfície VAZIA passaria a comparação seguinte por
    // vacuidade — comparar dois conjuntos vazios é comparar nada com nada.
    expect(observados.length).toBe(DEFINIDORES_DE_SENHA.length);
    expect(diferencasDeConjunto(observados, DEFINIDORES_DE_SENHA)).toEqual({
      excedentes: [],
      ausentes: [],
    });
  });

  it('a tabela de resolução de dono cobre todos os definidores que têm caminho', () => {
    const comCaminho = definidoresDeSenha()
      .filter(({ caminho }) => caminho !== undefined)
      .map(({ caminho }) => caminho as string);

    // Igualdade dos dois lados, e não continência: um caminho a mais na tabela seria ramo morto, e
    // um a menos seria definição de senha cujo dono é resolvido pelo padrão sem que ninguém tenha
    // decidido isso. As duas direções precisam reprovar.
    expect(diferencasDeConjunto(CAMINHOS_QUE_DEFINEM_SENHA, comCaminho)).toEqual({
      excedentes: [],
      ausentes: [],
    });

    // E o definidor SEM caminho é nomeado, para que a cobertura dele pelo resolvedor padrão seja
    // afirmação e não silêncio: se um dia ele ganhar caminho, a asserção acima passa a exigi-lo na
    // tabela e esta aqui reprova, obrigando a revisão.
    expect(definidoresDeSenha().filter(({ caminho }) => caminho === undefined)).toEqual([
      { chave: 'setPassword', caminho: undefined },
    ]);
  });

  it('prova de falsificação — a comparação de conjunto reprova, nomeando o excedente e o ausente', () => {
    const declarados = [...DEFINIDORES_DE_SENHA];

    // O controle: a superfície íntegra passa limpo no MESMO harness.
    expect(
      diferencasDeConjunto(
        definidoresDeSenha().map(({ chave }) => chave),
        declarados,
      ),
    ).toEqual({ excedentes: [], ausentes: [] });

    // O mutante: uma versão do arcabouço que publicasse um definidor a mais — exatamente o defeito
    // que este inventário existe para pegar, já que ele gravaria credencial sem revisão.
    expect(diferencasDeConjunto([...declarados, 'definirSenhaDeRecuperacao'], declarados)).toEqual({
      excedentes: ['definirSenhaDeRecuperacao'],
      ausentes: [],
    });

    // E o simétrico: um definidor que SUMISSE também reprova, nomeando o ausente. Sem esta perna a
    // asserção seria apenas "não sobrou nada", e um arcabouço que deixasse de publicar
    // `resetPassword` passaria em silêncio.
    expect(diferencasDeConjunto([], declarados)).toEqual({
      excedentes: [],
      ausentes: [...declarados].sort(),
    });
  });
});

// ---------------------------------------------------------------------------------------------
// Eixo estático (2) — TODO endpoint que toca senha está particionado, e a partição é declarada
// ---------------------------------------------------------------------------------------------
//
// A âncora acima enxerga só `newPassword`, que é o MESMO discriminador da política: um endpoint que
// gravasse credencial por campo de outro nome não apareceria nela, a contagem continuaria três e a
// igualdade passaria em silêncio. Este bloco faz a pergunta que não depende do nome escolhido —
// "que endpoints tocam senha, seja qual for o campo?" — e exige que cada um deles esteja de um dos
// dois lados de uma partição DECLARADA. Quem chegar de fora reprova, nomeado.

describe('T10 §6 — todo endpoint que declara campo de senha está na partição declarada', () => {
  it('a superfície publicada é exatamente definidores mais conferidores', () => {
    const observados = chavesComCampoDeSenha(superficieDaInstancia());
    const declarados = [...DEFINIDORES_DE_SENHA, ...CONFERIDORES_DE_SENHA];

    // PARTIÇÃO, e não só cobertura: um endpoint declarado dos DOIS lados satisfaria a igualdade
    // seguinte enquanto a classificação dele seria contraditória — coberto pela política e
    // deliberadamente fora dela ao mesmo tempo.
    expect(
      DEFINIDORES_DE_SENHA.filter((chave) =>
        (CONFERIDORES_DE_SENHA as readonly string[]).includes(chave),
      ),
    ).toEqual([]);

    // Igualdade nos dois sentidos: um endpoint a mais na superfície é definidor não revisado até
    // que alguém prove o contrário, e um a menos é entrada morta na partição.
    //
    // Ela vem ANTES da contagem de propósito, e é o contrário da ordem do bloco anterior: aqui a
    // reprovação que interessa é a do endpoint que CHEGOU, e uma contagem falhando primeiro diria
    // "11 ≠ 10" sem dizer QUEM — a fricção que a §4.2 da `nao-regressao.md` aponta como origem do
    // afrouxamento da rodada seguinte.
    expect(diferencasDeConjunto(observados, declarados)).toEqual({
      excedentes: [],
      ausentes: [],
    });

    // E a contagem depois, como o eixo positivo do par: ela é o que impede que uma superfície vazia
    // — instância montada pela metade, inventário lendo o campo errado — passe por vacuidade.
    expect(observados.length).toBe(declarados.length);
  });

  it('prova de falsificação — um definidor de plugin com campo `password` entra como excedente nomeado', () => {
    const declarados = [...DEFINIDORES_DE_SENHA, ...CONFERIDORES_DE_SENHA];

    // O controle: a superfície íntegra passa limpo no MESMO harness, pela MESMA função.
    expect(
      diferencasDeConjunto(chavesComCampoDeSenha(superficieDaInstancia()), declarados),
    ).toEqual({ excedentes: [], ausentes: [] });

    // O mutante: a superfície acrescida do endpoint que o plugin `email-otp` publica — molde
    // LITERAL do pacote instalado (`dist/plugins/email-otp/routes.mjs`), que grava credencial por
    // `internalAdapter.updatePassword` a partir de um campo chamado `password`. O plugin não está
    // instalado aqui; instalar não é preciso, porque o que se prova é que o INVENTÁRIO o veria.
    // Sobre o inventário anterior, cego a tudo que não fosse `newPassword`, este mutante passava.
    const comDefinidorDePlugin: Superficie = {
      ...superficieDaInstancia(),
      resetPasswordEmailOTP: {
        path: '/email-otp/reset-password',
        options: { body: { shape: { email: {}, otp: {}, password: {} } } },
      },
    };

    expect(diferencasDeConjunto(chavesComCampoDeSenha(comDefinidorDePlugin), declarados)).toEqual({
      excedentes: ['resetPasswordEmailOTP'],
      ausentes: [],
    });

    // E o simétrico: um endpoint da partição que SUMISSE da superfície também reprova, nomeado.
    // Sem esta perna a asserção seria só "não sobrou nada", e a `/reset-password` desaparecendo do
    // arcabouço — com a política deixando de ter sobre o que correr — passaria em silêncio.
    const semARedefinicao = { ...superficieDaInstancia() };
    delete semARedefinicao.resetPassword;

    expect(diferencasDeConjunto(chavesComCampoDeSenha(semARedefinicao), declarados)).toEqual({
      excedentes: [],
      ausentes: ['resetPassword'],
    });
  });
});

// ---------------------------------------------------------------------------------------------
// Eixo comportamental — a política alcança o SEGUNDO caminho e o endpoint sem caminho
// ---------------------------------------------------------------------------------------------

describe('T10 §6 — a política de força alcança toda definição de senha', () => {
  it(
    '/reset-password recusa a senha fraca, não grava a credencial e não queima o token',
    async () => {
      const derivadaAntes = await credencialDe(PESSOA_DA_REDEFINICAO.id);
      const token = await emitirTokenDeRedefinicao(PESSOA_DA_REDEFINICAO.id);

      const recusa = await capturarRecusa(
        identidade.autenticacao.api.resetPassword({
          body: { newPassword: SENHA_FRACA_DA_REDEFINICAO, token },
        }),
      );

      // Envelope inteiro, e não só o status: `detalhes` com o motivo específico é o que separa a
      // recusa da POLÍTICA (RN-05) da recusa por comprimento que o arcabouço faria sozinho — aquela
      // chega sem `detalhes` e não distingue regra nenhuma. Antes desta correção NENHUMA recusa
      // chegava aqui: o manipulador gravava a senha e devolvia `{ status: true }`.
      expect(recusa.statusCode).toBe(422);
      expect(recusa.body).toEqual({
        ...RECUSA_DE_CAMPO_INVALIDO,
        campo: 'senha',
        detalhes: { motivos: ['CONTEM_DADO_PESSOAL'] },
      });

      // A asserção que discrimina o defeito caro: a credencial NÃO mudou. Uma política que corresse
      // depois do manipulador devolveria a mesma recusa acima com a senha nova já valendo.
      expect(await credencialDe(PESSOA_DA_REDEFINICAO.id)).toBe(derivadaAntes);

      // E o token de uso único sobreviveu: recusar por senha fraca não pode custar à pessoa o
      // direito de tentar de novo. É o que a leitura sem consumo do resolvedor de dono garante.
      expect(await tokenExiste(token)).toBe(true);
    },
    LIMITE_CASO_MS,
  );

  it(
    '/reset-password recusa a senha fraca com o token na CONSULTA e a cadeia vazia no corpo',
    async () => {
      // A perna que faltava, e ela não é variação decorativa da anterior: o esquema aceita `token`
      // no corpo E na consulta, e o manipulador os encadeia por VERACIDADE
      // (`ctx.body.token || ctx.query?.token`), de modo que a cadeia VAZIA no corpo cai para a
      // consulta. Um resolvedor que encadeasse por NULIDADE (`??`) leria `''` como valor presente,
      // não acharia dono nenhum, sairia SEM VALIDAR — e o manipulador gravaria a senha fraca com o
      // token da consulta logo em seguida. É a política contornada no caminho que ela existe para
      // alcançar, e por isso a asserção é a MESMA recusa do caso anterior, com a mesma senha e o
      // mesmo sujeito: o que muda é só por onde o token viaja.
      const derivadaAntes = await credencialDe(PESSOA_DA_REDEFINICAO.id);
      const token = await emitirTokenDeRedefinicao(PESSOA_DA_REDEFINICAO.id);

      const recusa = await capturarRecusa(
        identidade.autenticacao.api.resetPassword({
          body: { newPassword: SENHA_FRACA_DA_REDEFINICAO, token: '' },
          query: { token },
        }),
      );

      expect(recusa.statusCode).toBe(422);
      expect(recusa.body).toEqual({
        ...RECUSA_DE_CAMPO_INVALIDO,
        campo: 'senha',
        detalhes: { motivos: ['CONTEM_DADO_PESSOAL'] },
      });

      // As duas asserções terminais do caso irmão, pela mesma razão: sem elas "recusou" não
      // distingue a política correndo de o manipulador ter falhado por outro motivo.
      expect(await credencialDe(PESSOA_DA_REDEFINICAO.id)).toBe(derivadaAntes);
      expect(await tokenExiste(token)).toBe(true);
    },
    LIMITE_CASO_MS,
  );

  it(
    '/reset-password aceita a senha que passa na política, e a credencial nova passa a valer',
    async () => {
      // O controle positivo, sem o qual "recusou" acima não distingue política de rota quebrada:
      // a MESMA rota, com uma senha que a política aprova, chega ao manipulador e grava.
      const derivadaAntes = await credencialDe(PESSOA_DA_REDEFINICAO.id);
      const token = await emitirTokenDeRedefinicao(PESSOA_DA_REDEFINICAO.id);

      expect(
        await identidade.autenticacao.api.resetPassword({
          body: { newPassword: SENHA_FORTE, token },
        }),
      ).toEqual({ status: true });

      expect(await credencialDe(PESSOA_DA_REDEFINICAO.id)).not.toBe(derivadaAntes);
      // O token foi consumido pelo manipulador — a leitura do gancho não o havia gastado.
      expect(await tokenExiste(token)).toBe(false);
    },
    LIMITE_CASO_MS,
  );

  it(
    'o definidor SEM caminho (setPassword) também é alcançado pela política',
    async () => {
      const cookie = await entrar(PESSOA_DO_SET_PASSWORD.email);

      const recusa = await capturarRecusa(
        identidade.autenticacao.api.setPassword({
          body: { newPassword: SENHA_FRACA_DO_SET_PASSWORD },
          headers: new Headers({ cookie }),
        }),
      );

      // É o caso que prova que o gatilho é o CAMPO e não o caminho: `ctx.path` aqui é indefinido, e
      // uma política casada por caminho — a que a T10 entregou — não teria como correr.
      expect(recusa.statusCode).toBe(422);
      expect(recusa.body).toEqual({
        ...RECUSA_DE_CAMPO_INVALIDO,
        campo: 'senha',
        detalhes: { motivos: ['CONTEM_DADO_PESSOAL'] },
      });

      // O companheiro positivo: com senha aprovada pela política, a recusa que volta é a DO
      // ARCABOUÇO (a pessoa já tem credencial), e não a nossa. Sem ele, "recusou" acima passaria
      // sobre um gancho que recusasse toda chamada a este endpoint.
      const doArcabouco = await capturarRecusa(
        identidade.autenticacao.api.setPassword({
          body: { newPassword: SENHA_FORTE },
          headers: new Headers({ cookie }),
        }),
      );

      expect(doArcabouco.statusCode).toBe(400);
      expect((doArcabouco.body as { code?: unknown }).code).toBe('PASSWORD_ALREADY_SET');
    },
    LIMITE_CASO_MS,
  );
});

// ---------------------------------------------------------------------------------------------
// Ferramental do caso
// ---------------------------------------------------------------------------------------------

/** A forma de um endpoint publicado, no que estes inventários perguntam a ele. */
interface EndpointPublicado {
  readonly path?: string;
  readonly options?: { readonly body?: { readonly shape?: Record<string, unknown> } };
}

/** A superfície publicada, pela chave com que o arcabouço nomeia cada endpoint. */
type Superficie = Record<string, EndpointPublicado>;

/**
 * A superfície da INSTÂNCIA — não uma lista lida de arquivo nem um export interno.
 *
 * Estreitar o tipo aqui, num ponto só, é o que permite aos casos de falsificação aplicarem a MESMA
 * função de inventário a uma superfície mutante: sem isso, o mutante teria de reimplementar a
 * pergunta, que é exatamente o antipadrão que a `.claude/rules/testing-stack.md` nomeia ("tabela que
 * exercitava a reimplementação do leitor no próprio verificador").
 */
function superficieDaInstancia(): Superficie {
  return identidade.autenticacao.api as unknown as Superficie;
}

/**
 * Os endpoints da superfície cujo corpo declara ALGUM campo de senha, com quais são.
 *
 * A pergunta é feita ao esquema que o próprio arcabouço declara para o corpo de cada endpoint. É o
 * que faz um endpoint novo numa versão futura — ou num plugin que alguém instale — aparecer aqui
 * sem que ninguém precise lembrar de procurá-lo.
 */
function endpointsComCampoDeSenha(
  superficie: Superficie,
): { chave: string; caminho: string | undefined; campos: string[] }[] {
  return Object.entries(superficie)
    .map(([chave, endpoint]) => ({
      chave,
      caminho: endpoint.path,
      campos: Object.keys(endpoint.options?.body?.shape ?? {})
        .filter((campo) => CAMPO_DE_SENHA.test(campo))
        .sort(),
    }))
    .filter(({ campos }) => campos.length > 0);
}

/** Só as chaves do inventário acima, que é o que a comparação de conjunto consome. */
function chavesComCampoDeSenha(superficie: Superficie): string[] {
  return endpointsComCampoDeSenha(superficie).map(({ chave }) => chave);
}

/**
 * Os endpoints que a instância publica cujo corpo declara o campo de senha NOVA.
 *
 * Recorte do inventário acima pelo discriminador da política — é a pergunta que amarra a tabela de
 * resolução de dono, e é por ser a mesma pergunta da política que ela precisa do inventário largo
 * ao lado, e não no lugar dela.
 */
function definidoresDeSenha(): { chave: string; caminho: string | undefined }[] {
  return endpointsComCampoDeSenha(superficieDaInstancia())
    .filter(({ campos }) => campos.includes(CAMPO_DA_SENHA_NOVA))
    .map(({ chave, caminho }) => ({ chave, caminho }));
}

/**
 * A recusa que uma chamada a `auth.api.*` levanta, ou uma falha do caso quando ela não levanta.
 *
 * O `expect(...).rejects` do arcabouço de teste não dá acesso ao objeto para asserir `body` e
 * `statusCode` juntos, e asserir só a mensagem seria classificação por texto — o que a ADR-0007
 * existe para aposentar.
 */
async function capturarRecusa(
  chamada: Promise<unknown>,
): Promise<{ statusCode: number; body: unknown }> {
  try {
    const devolvida = await chamada;
    throw new Error(
      `a chamada devolveu em vez de recusar: ${JSON.stringify(devolvida)} — o caso perderia o sujeito`,
    );
  } catch (erro) {
    if (!(erro instanceof Error) || !('statusCode' in erro) || !('body' in erro)) {
      throw erro;
    }

    return { statusCode: Number(erro.statusCode), body: erro.body };
  }
}

/**
 * Grava em `identidade.verificacao` um token de redefinição válido, e devolve o token.
 *
 * Escrito pelo caso, e não obtido por `requestPasswordReset`: aquela rota **falha fechado** sem
 * `emailAndPassword.sendResetPassword`, que a instância de produção não configura de propósito
 * (não há envio de e-mail nesta fatia). A linha gravada é a MESMA que ela gravaria — mesmo prefixo
 * de identificador, mesmo valor (o identificador da pessoa) —, que é o que faz este arranjo
 * exercitar o manipulador real em vez de um caminho inventado.
 *
 * É também o que torna o caso o alerta que a Revisão Técnica pediu: no dia em que uma fatia
 * configurar `sendResetPassword`, a rota fica alcançável por HTTP com o token vindo do e-mail, e a
 * política já estará valendo — provado aqui, e não descoberto lá.
 */
async function emitirTokenDeRedefinicao(usuarioId: string): Promise<string> {
  const token = `verificacao-${crypto.randomUUID()}`;
  const UMA_HORA_EM_MS = 3_600_000;

  await identidade.acesso.identidade.insert(esquemaIdentidade.verificacao).values({
    identificador: `${PREFIXO_DO_TOKEN_DE_REDEFINICAO}${token}`,
    valor: usuarioId,
    expiraEm: new Date(Date.now() + UMA_HORA_EM_MS),
  });

  return token;
}

/** O token de redefinição ainda está em `identidade.verificacao`? */
async function tokenExiste(token: string): Promise<boolean> {
  const { verificacao } = esquemaIdentidade;

  const linhas = await identidade.acesso.identidade
    .select({ id: verificacao.id })
    .from(verificacao)
    .where(eq(verificacao.identificador, `${PREFIXO_DO_TOKEN_DE_REDEFINICAO}${token}`))
    .limit(1);

  return linhas.length > 0;
}

/** A cadeia derivada da senha da pessoa, como está no banco. */
async function credencialDe(usuarioId: string): Promise<string | null> {
  const { conta } = esquemaIdentidade;

  const [linha] = await identidade.acesso.identidade
    .select({ senhaDerivada: conta.senhaDerivada })
    .from(conta)
    .where(eq(conta.usuarioId, usuarioId))
    .limit(1);

  if (linha === undefined) {
    throw new Error(`a carga não deixou credencial para o usuário ${usuarioId}`);
  }

  return linha.senhaDerivada;
}

/** Entra com a senha da carga e devolve o par `nome=valor` do cookie de sessão. */
async function entrar(email: string): Promise<string> {
  const devolvida = await identidade.autenticacao.api.signInEmail({
    body: { email, password: SENHA_DA_CARGA },
    asResponse: true,
  });

  const cookie = devolvida.headers
    .getSetCookie()
    .find((candidato) => (candidato.split(';')[0] ?? '').includes('session_token'));

  if (cookie === undefined) {
    throw new Error(`a entrada de ${email} não devolveu cookie de sessão`);
  }

  return cookie.split(';')[0] ?? '';
}
