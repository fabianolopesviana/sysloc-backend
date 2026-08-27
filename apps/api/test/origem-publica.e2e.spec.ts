/**
 * A **origem confiável** da API publicada — T7 da fatia `publicacao-e-backup`, e o fecho do
 * `D23 · F1/T8`.
 *
 * ---------------------------------------------------------------------------
 * INVARIANTES
 * ---------------------------------------------------------------------------
 *
 * | Critério | Caso | Invariante |
 * |---|---|---|
 * | CA-02 | CT-1164 | Para **cada** origem declarada em `ORIGENS_PUBLICAS`, a entrada com
 * |       |         | credencial **correta** e aquele `Origin` responde `200`, devolve o cookie de
 * |       |         | sessão (nome terminado em `session_token`) e o corpo **não** carrega campo
 * |       |         | `codigo`. Uma origem só não bastaria: são dois aplicativos. |
 * | CA-02 | CT-1165 | Entrada com credencial **correta** e `Origin` não declarada — a de um
 * |       |         | intruso, e a do servidor declarado com o **esquema trocado** — é recusada
 * |       |         | com `403` e corpo **igual**, por `toEqual`, a
 * |       |         | `{ codigo: 'ACESSO_NEGADO', mensagem: 'acesso negado para esta sessão' }`,
 * |       |         | **sem** emitir cookie de sessão. Declarar a lista NÃO afrouxa a recusa. |
 * | CA-02 | CT-1166 | O conjunto de origens confiáveis que a **instância** publica é IGUAL
 * |       |         | (igualdade de conjunto, nunca contenção) à união das origens declaradas com
 * |       |         | a origem derivada do endereço de escuta; o intruso **não** pertence a ele, e
 * |       |         | **nenhuma** entrada contém `*`. |
 *
 * Rastreabilidade: `CA-02 → CT-1164 (T7-b)` · `CA-02 → CT-1165 (T7-c)` ·
 * `CA-02 → CT-1166 (T7-b, T7-c)`.
 *
 * ===========================================================================
 * A PRECONDIÇÃO PRIVILEGIADA — e por que sem ela esta suíte seria verde por VÁCUO
 * ===========================================================================
 *
 * ⚠️ **A conferência de origem do arcabouço vinha DESLIGADA em toda a verificação.** Medido em
 * `better-auth@1.6.25` (`dist/context/create-context.mjs`): `skipOriginCheck` é
 * `options.advanced?.disableOriginCheck !== undefined ? … : isTest() ? true : false`, e `isTest()` lê
 * `NODE_ENV` — que o Vitest fixa em `test`. Sem intervenção, o `CT-1165` responderia `200` em vez de
 * `403`, e passaria **por vácuo**: o `D23` fecharia sem prova nenhuma.
 *
 * O caminho legítimo, e o único usado aqui, é a **composição declarar o estado explicitamente** nas
 * opções do arcabouço — `advanced.disableOriginCheck: false`, em `packages/auth/src/autenticacao.ts`,
 * no mesmo molde já justificado para `rateLimit.enabled: true`: *o mesmo estado em todo ambiente, e
 * agora exercitado*. **Nenhum símbolo de produção nasce para o teste enxergar algo** (Iron Law #6),
 * nenhum ramo condicional é instalado, e nenhuma flag de verificação existe.
 *
 * As demais precondições são montadas pelo caminho REAL:
 *
 *   * **as origens** — gravadas em `process.env` **antes** de compor a aplicação, e restauradas no
 *     `afterAll`. É de lá que a partida as lê, como em produção;
 *   * **a entrada** — pela rota pública de entrada do arcabouço, com a credencial da carga. Nenhum
 *     estado de sessão é forjado e nenhum cookie é montado à mão;
 *   * **o cliente HTTP** — {@link pedir} de `./acessorios-de-borda.ts`, importado e nunca
 *     redeclarado (convenção *"acessório de suíte se importa, não se copia"* do `CLAUDE.md`);
 *   * **o conjunto confiável do `CT-1166`** — lido da **instância já subida**, pelo contêiner da
 *     aplicação, na mesma via que o arcabouço usa em tempo de execução. É o molde de
 *     `trancaDeSegundoFatorDaInstancia`, em `packages/auth/test/bloqueio.spec.ts`.
 *
 * ===========================================================================
 * Por que a CREDENCIAL é CORRETA nos dois eixos — e não só no positivo
 * ===========================================================================
 *
 * ⚠️ O `CT-1165` entra com a senha **certa**. Com senha errada, um `401` mascararia a ausência da
 * recusa por origem: o caso ficaria verde tanto com a conferência ligada quanto com ela desligada, e
 * deixaria de discriminar exatamente o que ele existe para discriminar.
 *
 * ===========================================================================
 * Por que o conjunto é a UNIÃO, e não a substituição
 * ===========================================================================
 *
 * ⚠️ **Fato medido** em `getTrustedOrigins` (`dist/context/helpers.mjs`): a origem derivada de
 * `baseURL` é **sempre** empilhada, e o que a composição declara é acrescentado depois. O fecho do
 * `D23` foi **acrescentar** a lista, jamais mover a derivação — `pedir()` envia `origin: base` em
 * cerca de trinta suítes de borda, e trocar uma pela outra reprovaria todas elas. É por isso que o
 * `CT-1166` afirma igualdade com a **união**, e não com a lista declarada.
 *
 * ⚠️ **A união tem TRÊS fontes, e o `CT-1166` mede as duas primeiras porque a terceira não é
 * emitida.** A terceira é `env.BETTER_AUTH_TRUSTED_ORIGINS`, lida pelo arcabouço direto do
 * ambiente: este produto nunca a define, e nada na partida a recusa — é o canal do `D35 · F7/T7`.
 * Registrado aqui para que quem estender este arquivo saiba que a igualdade afirmada vale sob a
 * premissa de que a variável está ausente, e não porque o conjunto seja fechado por duas.
 *
 * O `CT-1166` aplica `.claude/rules/ancoras-de-superficie.md` à superfície de **confiança**:
 * igualdade de conjunto com controle antivácuo, nunca contenção. É o que impede o fecho de virar
 * `trustedOrigins: ['*']` — que passaria o `CT-1164` e o `CT-1165` do modo mais silencioso possível.
 */

import { randomBytes } from 'node:crypto';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import type { Autenticacao } from '@sysloc/auth';
import { SENHA_DA_CARGA } from '@sysloc/db';
import { CodigoErro } from '@sysloc/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  type IdentidadeEfemera,
  identidadeEfemera,
  pessoaSemeada,
} from '../../../packages/auth/test/identidade-efemera.ts';
import { reservarPorta } from '../../../packages/shared/test/efemero-comum.ts';
import { type FilaEfemera, redisEfemero } from '../../../packages/shared/test/redis-efemero.ts';
import { ENDERECO_DE_ESCUTA, TOKEN_AUTENTICACAO } from '../src/configuracao/ambiente.ts';
import { criarAplicacao } from '../src/main.ts';
import { pedir, ROTA_DE_ENTRADA, SUFIXO_DO_COOKIE_DE_SESSAO } from './acessorios-de-borda.ts';

/** Teto da montagem — instância efêmera de banco e de fila mais a aplicação real. */
const LIMITE_DE_MONTAGEM_MS = 90_000;

/**
 * As DUAS origens públicas que esta instalação declara — o app do cliente e o Painel Master.
 *
 * Escritas por extenso e **nunca** derivadas do SUT: elas são o valor que o ambiente declara, e
 * derivá-las da configuração já lida faria o caso comparar a leitura consigo mesma (AP-29).
 *
 * O domínio é `.com.br` de propósito, e não `.invalid`: aqui elas nomeiam hostnames que um navegador
 * de fato usaria, e nenhuma resolução de nome acontece — o cliente fala com o endereço de escuta e
 * apenas **declara** a origem no cabeçalho, exatamente como um salto de borda faria.
 */
const ORIGEM_DO_APP = 'https://app.exemplo.com.br';
const ORIGEM_DO_PAINEL = 'https://painel.exemplo.com.br';

/** As duas, na ordem em que a variável de ambiente as declara. */
const ORIGENS_DECLARADAS = [ORIGEM_DO_APP, ORIGEM_DO_PAINEL] as const;

/**
 * As DUAS origens que a conferência tem de recusar, e o que cada uma discrimina.
 *
 * A primeira é um servidor que **não** está na lista — o caso canônico do intruso. A segunda é o
 * servidor **declarado** com o esquema trocado, e ela existe porque a comparação é por **origem
 * inteira**, e não por servidor: medido em `dist/auth/trusted-origins.mjs`, sem curinga o casamento
 * é `pattern === getOrigin(url)`. Uma implementação que comparasse apenas o hostname passaria a
 * primeira linha e falharia a segunda.
 */
const ORIGENS_RECUSADAS = [
  { rotulo: 'servidor que não está na lista', valor: 'https://intruso.exemplo.com.br' },
  { rotulo: 'servidor declarado com o esquema trocado', valor: 'http://app.exemplo.com.br' },
] as const;

/** A origem do intruso, isolada — é a agulha do controle antivácuo do `CT-1166`. */
const ORIGEM_INTRUSA = ORIGENS_RECUSADAS[0].valor;

/** O envelope EXATO da recusa por origem, na forma que a ADR-0017 fixa. Objeto inteiro, nunca campo. */
const RECUSA_POR_ORIGEM = {
  codigo: CodigoErro.ACESSO_NEGADO,
  mensagem: 'acesso negado para esta sessão',
};

/** A pessoa que entra — a Admin da empresa A da carga, pelo caminho real. */
const QUEM_ENTRA = pessoaSemeada('admin.a@exemplo.com.br');

/** As variáveis que a montagem escreve no ambiente do processo e restaura ao fim. */
const VARIAVEIS_MONTADAS = [
  'NODE_ENV',
  'PORT',
  'LOG_LEVEL',
  'DATABASE_URL',
  'REDIS_URL',
  'BETTER_AUTH_SECRET',
  'ORIGENS_PUBLICAS',
] as const;

let identidade: IdentidadeEfemera;
let fila: FilaEfemera;
let aplicacao: NestFastifyApplication;
let base: string;
let ambienteAnterior: NodeJS.ProcessEnv;

beforeAll(async () => {
  identidade = await identidadeEfemera();
  fila = await redisEfemero();

  ambienteAnterior = { ...process.env };
  process.env.NODE_ENV = 'test';
  process.env.LOG_LEVEL = 'fatal';
  process.env.DATABASE_URL = identidade.banco.cadeiaConexao;
  process.env.REDIS_URL = fila.cadeiaConexao;
  process.env.BETTER_AUTH_SECRET = randomBytes(32).toString('base64url');
  // ⚠️ ANTES de compor a aplicação: é na partida que a lista é lida e conferida, e escrevê-la depois
  // deixaria a instância com o conjunto de outra execução.
  process.env.ORIGENS_PUBLICAS = ORIGENS_DECLARADAS.join(',');

  const porta = await reservarPorta();
  base = `http://${ENDERECO_DE_ESCUTA}:${String(porta)}`;
  process.env.PORT = String(porta);

  // A aplicação de PRODUÇÃO. Nenhum provedor é substituído: a conferência de origem não fala com
  // terceiro algum, e substituir qualquer porta aqui mediria outra aplicação.
  aplicacao = await criarAplicacao();
  await aplicacao.listen({ port: porta, host: ENDERECO_DE_ESCUTA });
}, LIMITE_DE_MONTAGEM_MS);

afterAll(async () => {
  await aplicacao?.close();
  await fila?.parar();
  await identidade?.parar();

  for (const nome of VARIAVEIS_MONTADAS) {
    const valor = ambienteAnterior?.[nome];
    if (valor === undefined) {
      delete process.env[nome];
    } else {
      process.env[nome] = valor;
    }
  }
}, LIMITE_DE_MONTAGEM_MS);

describe('a origem confiável da API publicada (T7 · fecha o D23 · F1/T8)', () => {
  it.each(ORIGENS_DECLARADAS.map((origem) => ({ origem })))(
    'CT-1164 — a entrada com credencial correta e Origin $origem responde 200 e emite sessão',
    async ({ origem }) => {
      const entrada = await entrarComOrigem(origem);

      expect(entrada.status).toBe(200);
      // O cookie de sessão, conferido por SUFIXO: o arcabouço prefixa o nome conforme o modo de
      // execução, e casar o nome inteiro faria o caso medir a configuração em vez da sessão.
      expect(cookiesDeSessao(entrada.cookies)).toHaveLength(1);
      // E o corpo é o do arcabouço, não o envelope de erro do produto: a ausência de `codigo` é o
      // que separa "entrou" de "recusou com 200 por algum caminho torto".
      expect(campoDeCodigo(entrada.corpo)).toBeUndefined();
    },
    LIMITE_DE_MONTAGEM_MS,
  );

  it.each(ORIGENS_RECUSADAS)(
    'CT-1165 — a entrada com credencial correta e $rotulo é recusada com 403, sem emitir sessão',
    async ({ valor }) => {
      // ⚠️ ESTE é o discriminador que separa o fecho do `D23` de um afrouxamento da conferência.
      // Sem ele, declarar `trustedOrigins: ['*']` — ou deixar a conferência desligada, que era o
      // estado herdado de `NODE_ENV=test` — manteria o `CT-1164` verde.
      const entrada = await entrarComOrigem(valor);

      expect(entrada.status).toBe(403);
      // O objeto INTEIRO, e nunca a presença de um campo: é a igualdade que faz um `detalhes`
      // acrescentado, ou uma mensagem que ecoasse a origem recusada, reprovar aqui.
      expect(entrada.corpo).toEqual(RECUSA_POR_ORIGEM);
      // A afirmação que discrimina o efeito terminal: nenhuma sessão foi emitida. Uma recusa que
      // respondesse 403 **depois** de emitir o cookie deixaria a credencial na mão do intruso.
      expect(cookiesDeSessao(entrada.cookies)).toEqual([]);
    },
    LIMITE_DE_MONTAGEM_MS,
  );

  it('CT-1166 — o conjunto de origens confiáveis da instância é a UNIÃO declarada, sem curinga', async () => {
    const confiaveis = await origensConfiaveisDaInstancia();

    // Igualdade de CONJUNTO, nunca contenção (`.claude/rules/ancoras-de-superficie.md`): as duas
    // direções precisam reprovar — a origem que sumiu e a que apareceu sem ninguém decidir.
    expect([...confiaveis].sort()).toEqual([base, ...ORIGENS_DECLARADAS].sort());

    // CONTROLE ANTIVÁCUO 1 — o intruso não pertence ao conjunto. Sem ele, comparar dois conjuntos
    // vazios passaria por vacuidade.
    expect(confiaveis).not.toContain(ORIGEM_INTRUSA);

    // CONTROLE ANTIVÁCUO 2 — nenhuma entrada carrega curinga. A igualdade acima já o pegaria, mas
    // esta é a asserção que NOMEIA o defeito: `trustedOrigins: ['*']` é o fecho falso que passaria
    // o CT-1164 e o CT-1165 do modo mais silencioso possível, porque `matchesOriginPattern` trata
    // `*` como padrão e não como literal.
    expect(confiaveis.filter((origem) => origem.includes('*'))).toEqual([]);

    // E a origem de ESCUTA continua no conjunto, nomeada: o fecho do `D23` foi ACRESCENTAR a lista
    // pública, jamais mover a derivação — retirá-la reprovaria as ~30 suítes de borda que falam com
    // o endereço de retorno, e esta linha é o aviso local desse fato.
    expect(confiaveis).toContain(base);
  });
});

/**
 * Entra pelo caminho real, declarando a origem informada — e com a senha **certa**, sempre.
 *
 * A credencial correta é o que faz o eixo negativo discriminar: com senha errada, um `401`
 * mascararia a ausência da recusa por origem.
 */
async function entrarComOrigem(origem: string): ReturnType<typeof pedir> {
  return await pedir(base, ROTA_DE_ENTRADA, {
    metodo: 'POST',
    corpo: { email: QUEM_ENTRA.email, password: SENHA_DA_CARGA },
    cabecalhos: { origin: origem },
  });
}

/**
 * Os cookies de SESSÃO da resposta — conferidos por sufixo, nunca pelo nome inteiro.
 *
 * ⚠️ **O predicado está copiado de `credencialDeSessao` (`acessorios-de-borda.ts`), e a cópia é
 * declarada, não despercebida.** O que esta suíte precisa é da **lista**, possivelmente vazia — o
 * eixo negativo afirma que a recusa por origem **não** emitiu cookie —, enquanto o acessório comum
 * devolve *uma* credencial e **levanta** quando ela não vem. Publicar `ehCookieDeSessao` ali e fazer
 * `credencialDeSessao` consumi-lo é a extração certa, e não foi feita nesta rodada por uma razão
 * medida: aquele arquivo é a casa de ~30 suítes de borda, e a rodada de correção do Gate 1 tem de
 * conter o diff ao bloqueante — mexer nele obrigaria a remedir todas elas para provar que nenhuma
 * asserção se moveu. Fica como débito de qualidade, com o gatilho óbvio: a primeira task autorizada
 * a abrir `acessorios-de-borda.ts` por outra razão.
 */
function cookiesDeSessao(cookies: readonly string[]): readonly string[] {
  return cookies.filter((cookie) =>
    (cookie.split(';')[0] ?? '').split('=')[0]?.trim().endsWith(SUFIXO_DO_COOKIE_DE_SESSAO),
  );
}

/** O campo `codigo` do corpo, quando ele existe — é a marca do envelope de erro do produto. */
function campoDeCodigo(corpo: unknown): unknown {
  if (typeof corpo !== 'object' || corpo === null) {
    return undefined;
  }

  return (corpo as Record<string, unknown>).codigo;
}

/**
 * O conjunto de origens confiáveis que a **instância já subida** publica.
 *
 * Lido do contêiner da aplicação e do contexto do arcabouço — a MESMA via que `validateOrigin` usa
 * em tempo de execução (`ctx.context.trustedOrigins`, em `dist/api/middlewares/origin-check.mjs`) —,
 * e nunca do texto do fonte: é o que torna a asserção sensível à lista ter **chegado** às opções, e
 * não à existência de um comentário. Molde de `trancaDeSegundoFatorDaInstancia`
 * (`packages/auth/test/bloqueio.spec.ts`).
 *
 * O molde do tipo é local porque a superfície publicada tipa o contexto pelo contrato genérico do
 * arcabouço; o valor devolvido é comparado por igualdade de conjunto, de modo que o molde não amplia
 * nem estreita o que a asserção observa. **Nenhum símbolo de produção nasceu para esta leitura.**
 */
async function origensConfiaveisDaInstancia(): Promise<readonly string[]> {
  const autenticacao = aplicacao.get<Autenticacao>(TOKEN_AUTENTICACAO);
  const contexto = (await (autenticacao as unknown as ContextoDoArcabouco).$context) as {
    readonly trustedOrigins: readonly string[];
  };

  return contexto.trustedOrigins;
}

/** A ponta do arcabouço que esta suíte lê, no mínimo necessário. */
interface ContextoDoArcabouco {
  readonly $context: Promise<unknown>;
}
