/**
 * Trilha de tentativas de entrada — CT-025.
 *
 * ---------------------------------------------------------------------------
 * INVARIANTES
 * ---------------------------------------------------------------------------
 *
 * | Critério | CT     | Invariante |
 * |----------|--------|------------|
 * | CA-14    | CT-025 | Cada tentativa de entrada — sucesso, credencial incorreta, recusa por
 * |          |        | bloqueio e e-mail inexistente — grava **exatamente uma** linha em
 * |          |        | `identidade.tentativa_login`, com desfecho próprio, momento, origem de rede
 * |          |        | e autor quando identificável (nulo, e apenas nulo, quando o e-mail não
 * |          |        | existe). |
 *
 * Rastreabilidade: `CA-14 → CT-025 (RN-11)`.
 *
 * ---------------------------------------------------------------------------
 * Por que a contagem é TOTAL, e não das quatro tentativas do caso
 * ---------------------------------------------------------------------------
 *
 * O caso precisa de uma conta bloqueada para produzir o desfecho de bloqueio, e chegar lá custa
 * cinco falhas reais. Essas cinco **também** geram linha, e são contadas: 5 + 4 = 9.
 *
 * Contar só as quatro deixaria passar dois defeitos de uma vez — um SUT que gravasse duas linhas por
 * tentativa e um que não gravasse nada no caminho de falha. É a contagem total, casada com a
 * asserção linha a linha, que discrimina.
 *
 * ---------------------------------------------------------------------------
 * Onde o caso ataca o SUT
 * ---------------------------------------------------------------------------
 *
 * > **Divergência declarada.** O card manda "executar as quatro tentativas **pela rota HTTP**". As
 * > rotas de autenticação nascem na T8/T9 e não existem hoje. Por decisão do orquestrador, o caso
 * > exercita o **caminho real disponível**: a API da própria instância do arcabouço, que é o
 * > boundary de produção neste nível. Ele atravessa `auditoria.ts` de verdade, contra banco real, e
 * > nenhuma rota falsa é montada nem `registrarTentativa` é invocada diretamente — invocá-la provaria
 * > a função, não o registro.
 * >
 * > A asserção de `origem` foi **preservada**: ela depende de cabeçalho, não de servidor HTTP, e a
 * > instância a apura pelo mesmo `getIp` que usaria atrás da rota. Quando a rota nascer, o caso
 * > equivalente sobre ela é da T8/T9.
 *
 * A leitura da trilha é consulta ao schema `identidade` na instância efêmera. O PRD proíbe superfície
 * de **consulta no produto**, não a observação do estado persistido pela verificação — que é o
 * próprio efeito que a RN-11 exige.
 *
 * ---------------------------------------------------------------------------
 * Ordenação
 * ---------------------------------------------------------------------------
 *
 * As linhas são lidas por `ocorrida_em` crescente. O empate é impossível na prática: entre duas
 * tentativas há uma derivação `scrypt` (centenas de milissegundos, §12.1) e ao menos uma ida ao
 * banco, e `now()` é o instante da transação de cada inserção — não há espera artificial em lugar
 * nenhum deste arquivo.
 */

import { esquemaIdentidade, SENHA_DA_CARGA } from '@sysloc/db';
import { asc, eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { LIMITE_DE_FALHAS_CONSECUTIVAS } from '../src/bloqueio.ts';
import { type IdentidadeEfemera, identidadeEfemera, pessoaSemeada } from './identidade-efemera.ts';

/** A conta que é levada ao bloqueio pelas cinco falhas do preparo. */
const BLOQUEADA = pessoaSemeada('admin.a@exemplo.com.br');

/** A conta livre, que produz os desfechos de credencial incorreta e de sucesso. */
const LIVRE = pessoaSemeada('usuario.a@exemplo.com.br');

/** E-mail que a carga não tem. É a única tentativa sem autor a quem se vincular. */
const EMAIL_INEXISTENTE = 'ninguem@exemplo.com.br';

const SENHA_ERRADA = 'nao-e-a-senha-desta-conta';
const ORIGEM = '203.0.113.7';
const AGENTE = 'verificacao/1';

/**
 * Quantas falhas o preparo precisa para bloquear a conta — **por extenso**, e não derivado de
 * `LIMITE_DE_FALHAS_CONSECUTIVAS`.
 *
 * Derivar da constante do SUT tornaria a contagem tautológica: com o limiar mudado, o laço de
 * preparo mudaria junto e o total esperado também, e o caso ficaria verde sobre a política errada.
 * A amarra com a constante é feita uma vez, em asserção própria.
 */
const FALHAS_DO_PREPARO = 5;

/** As quatro tentativas do caso, uma por desfecho. */
const TENTATIVAS_DO_CASO = 4;

/** Total esperado: 5 falhas do preparo do bloqueio + 4 tentativas do caso = 9. */
const LINHAS_ESPERADAS = FALHAS_DO_PREPARO + TENTATIVAS_DO_CASO;

let identidade: IdentidadeEfemera;

beforeAll(async () => {
  identidade = await identidadeEfemera();
});

afterAll(async () => {
  await identidade?.parar();
});

describe('CT-025 — toda tentativa de entrada é registrada com autor, momento, origem e desfecho', () => {
  it('a política em vigor é a de cinco falhas — mudá-la invalida a contagem deste caso', () => {
    // Amarra única entre a política e o total de 9 linhas. Sem ela, os números por extenso acima
    // virariam literais órfãos; com ela, trocar o limiar reprova aqui, com a causa nomeada.
    expect(LIMITE_DE_FALHAS_CONSECUTIVAS).toBe(FALHAS_DO_PREPARO);
  });

  it('grava exatamente uma linha por tentativa, nos quatro desfechos', async () => {
    const banco = identidade.acesso.identidade;

    // Pré-condição do card: a trilha começa vazia.
    expect(await lerTrilha()).toEqual([]);

    const inicio = new Date();

    // --- Preparo: cinco falhas reais levam a conta ao bloqueio -------------------------------
    for (let tentativa = 0; tentativa < FALHAS_DO_PREPARO; tentativa += 1) {
      await entrar(BLOQUEADA.email, SENHA_ERRADA);
    }

    // --- As quatro tentativas do caso, uma por desfecho --------------------------------------
    // Com a credencial CORRETA: se o bloqueio não interrompesse antes da conferência, esta
    // tentativa entraria, e o desfecho gravado seria `SUCESSO`.
    await entrar(BLOQUEADA.email, SENHA_DA_CARGA);
    await entrar(LIVRE.email, SENHA_ERRADA);
    await entrar(LIVRE.email, SENHA_DA_CARGA);
    await entrar(EMAIL_INEXISTENTE, SENHA_ERRADA);

    const fim = new Date();
    const trilha = await lerTrilha();

    // --- Passo 3: a contagem total, exata ----------------------------------------------------
    expect(trilha).toHaveLength(LINHAS_ESPERADAS);

    // --- Passo 4: linha a linha --------------------------------------------------------------
    const esperadas = [
      ...Array.from({ length: FALHAS_DO_PREPARO }, () => ({
        emailInformado: BLOQUEADA.email,
        usuarioId: BLOQUEADA.id,
        desfecho: 'CREDENCIAL_INCORRETA',
        origem: ORIGEM,
        agente: AGENTE,
      })),
      {
        emailInformado: BLOQUEADA.email,
        usuarioId: BLOQUEADA.id,
        desfecho: 'CONTA_BLOQUEADA',
        origem: ORIGEM,
        agente: AGENTE,
      },
      {
        emailInformado: LIVRE.email,
        usuarioId: LIVRE.id,
        desfecho: 'CREDENCIAL_INCORRETA',
        origem: ORIGEM,
        agente: AGENTE,
      },
      {
        emailInformado: LIVRE.email,
        usuarioId: LIVRE.id,
        desfecho: 'SUCESSO',
        origem: ORIGEM,
        agente: AGENTE,
      },
      {
        emailInformado: EMAIL_INEXISTENTE,
        // Nulo aqui, e **apenas** aqui: é o que torna a coluna anulável justificada, e a igualdade
        // do arranjo inteiro é o que impede um SUT que gravasse nulo em todas de passar.
        usuarioId: null,
        desfecho: 'EMAIL_INEXISTENTE',
        origem: ORIGEM,
        agente: AGENTE,
      },
    ];

    expect(trilha.map(semMomento)).toEqual(esperadas);

    for (const linha of trilha) {
      expect(linha.ocorridaEm.getTime()).toBeGreaterThanOrEqual(inicio.getTime());
      expect(linha.ocorridaEm.getTime()).toBeLessThanOrEqual(fim.getTime());
    }

    // --- Passo 5: nenhum segredo em nenhuma coluna de nenhuma linha --------------------------
    const token = await lerTokenDaSessao(banco, LIVRE.id);
    const trilhaSerializada = JSON.stringify(trilha);

    expect(trilhaSerializada).not.toContain(SENHA_DA_CARGA);
    expect(trilhaSerializada).not.toContain(SENHA_ERRADA);
    expect(trilhaSerializada).not.toContain(token);
    // O par positivo da asserção acima: sem ele, um `token` vazio faria as três linhas passarem
    // sobre qualquer trilha, inclusive uma que vazasse tudo.
    expect(token.length).toBeGreaterThan(0);
  });
});

type Banco = IdentidadeEfemera['acesso']['identidade'];

/** Uma linha da trilha, como ela está gravada. */
interface LinhaDaTrilha {
  readonly emailInformado: string;
  readonly usuarioId: string | null;
  readonly desfecho: string;
  readonly origem: string | null;
  readonly agente: string | null;
  readonly ocorridaEm: Date;
}

/** Executa a entrada pela instância do arcabouço. O desfecho é lido da trilha, não daqui. */
async function entrar(email: string, senha: string): Promise<void> {
  try {
    await identidade.autenticacao.api.signInEmail({
      body: { email, password: senha },
      headers: new Headers({ 'x-forwarded-for': ORIGEM, 'user-agent': AGENTE }),
      asResponse: true,
    });
  } catch {
    // A recusa por bloqueio levanta em vez de devolver resposta, porque acontece antes do
    // manipulador. Este caso julga pelo que ficou gravado, e não pela forma da recusa — a forma é
    // do CT-016, na T11.
  }
}

/** A trilha inteira, na ordem em que os fatos aconteceram. */
async function lerTrilha(): Promise<LinhaDaTrilha[]> {
  const { tentativaLogin } = esquemaIdentidade;

  return await identidade.acesso.identidade
    .select({
      emailInformado: tentativaLogin.emailInformado,
      usuarioId: tentativaLogin.usuarioId,
      desfecho: tentativaLogin.desfecho,
      origem: tentativaLogin.origem,
      agente: tentativaLogin.agente,
      ocorridaEm: tentativaLogin.ocorridaEm,
    })
    .from(tentativaLogin)
    .orderBy(asc(tentativaLogin.ocorridaEm));
}

/** A linha sem o momento — comparado à parte, por janela, no passo 4. */
function semMomento(linha: LinhaDaTrilha): Omit<LinhaDaTrilha, 'ocorridaEm'> {
  const { ocorridaEm: _, ...resto } = linha;
  return resto;
}

/** O token da sessão criada pela tentativa bem-sucedida. */
async function lerTokenDaSessao(banco: Banco, usuarioId: string): Promise<string> {
  const { sessao } = esquemaIdentidade;

  const [linha] = await banco
    .select({ token: sessao.token })
    .from(sessao)
    .where(eq(sessao.usuarioId, usuarioId));

  if (linha === undefined) {
    throw new Error('a tentativa bem-sucedida não criou sessão — o caso perdeu o valor a procurar');
  }

  return linha.token;
}
