/**
 * O ponto de aplicação da autorização: cardinalidade um, e a reescrita do registro de sessão.
 * T4 da fatia `autorizacao-e-ciclo-de-acesso`.
 *
 * ---------------------------------------------------------------------------
 * INVARIANTES
 * ---------------------------------------------------------------------------
 *
 * | Critério | Caso   | Invariante |
 * |---|---|---|
 * | —     | CT-216 | O módulo de decisão de autorização é consumido por **exatamente um** arquivo
 * |       |        | de `apps/api/src` — a guarda de contexto —, e nenhum manipulador, serviço ou
 * |       |        | controlador reavalia a decisão por conta própria. A asserção reprova
 * |       |        | **nomeando o intruso**, e não casa menção em comentário. (ADR-0011, §11.2) |
 * | —     | CT-216 | O **default que nega**: rota governada pela guarda que não declara exigência
 * |       | (b)    | alguma responde `403 ACESSO_NEGADO`, mesmo à sessão que alcança as 17 chaves —
 * |       |        | e a recusa **não** carrega `detalhes.exigido`, porque não há exigência a
 * |       |        | nomear. É a metade estrutural do invariante que o `CT-212` (T5) provará
 * |       |        | sobre a superfície publicada inteira. (ADR-0011) |
 * | CA-20 | CT-219 | Ao detectar divergência entre a versão do retrato gravado na sessão e a versão
 * | CA-21 |        | corrente da pessoa, o servidor reescreve no registro de sessão o efetivo novo e
 * |       |        | a versão corrente; requisições **sem** divergência não alteram essas colunas.
 * |       |        | E a escrita do ajuste, sozinha, **não** toca o registro de sessão — quem o
 * |       |        | atualiza é a requisição seguinte. (RN-03, RN-17, ADR-0010) |
 *
 * Rastreabilidade: `CA-20 → CT-219 (RN-03)`, `CA-21 → CT-219 (RN-17)`. A metade do invariante que
 * fala da **ausência de escrita** tem prova própria, uma camada abaixo:
 * `CA-20 → T4 §4-6 (RN-03)` e `CA-21 → T4 §4-6 (RN-17)`, em
 * `packages/auth/test/reescrita-do-efetivo.spec.ts` — ver o último bloco deste cabeçalho.
 *
 * ---------------------------------------------------------------------------
 * CT-216 — asserção ESTÁTICA, e a prova de falsificação que a `testing-stack.md` exige
 * ---------------------------------------------------------------------------
 *
 * A varredura inspeciona o **texto** do código sob teste, e a `.claude/rules/testing-stack.md` é
 * literal quanto ao preço disso: *"toda asserção que inspeciona o texto do código sob teste exige
 * prova de falsificação antes de ser aceita"*, com o caso medido neste repositório de uma asserção
 * que casava o alvo **em comentário** e permanecia verde num arquivo sem guarda alguma.
 *
 * As duas defesas contra aquele modo de falha estão instaladas:
 *
 *   * **os comentários saem antes da comparação** — o acessório `semComentarios` de
 *     `packages/db/test/varredura-de-fontes.ts` é o mesmo que o CT-005 e o CT-014 já usam, e é o
 *     que impede a prosa deste próprio invariante (que cita o símbolo por extenso, no cabeçalho da
 *     guarda) de contar como consumo;
 *   * **a lista de arquivos é afirmada não vazia** antes da igualdade, porque uma varredura que não
 *     lesse nada produziria um conjunto vazio e reprovaria por ausência, sem dizer por quê.
 *
 * **PROVA DE FALSIFICAÇÃO EXECUTADA** (2026-08-04), pelo procedimento da rule — mutante no fonte,
 * suíte invocada pelo **script do pacote** (`pnpm --filter @sysloc/api test`), nunca por `vitest run`
 * avulso, porque este arquivo carrega o SUT pela fronteira do pacote e um `vitest run` leria o
 * `dist/` da compilação anterior:
 *
 *   1. **controle** — árvore íntegra: `59 passed`, este caso verde, conjunto de consumidores
 *      exatamente `['autenticacao/contexto.guard.ts']`;
 *   2. **mutante A (segunda consulta plantada)** — `apps/api/src/autenticacao/sessao.controller.ts`
 *      ganhou `import { decidirAcesso } from '@sysloc/auth';` e uma chamada no manipulador:
 *      `1 failed | 58 passed`, e a mensagem nomeou o intruso —
 *      `os consumidores da decisão de autorização deixaram de ser apenas a guarda:
 *       autenticacao/contexto.guard.ts, autenticacao/sessao.controller.ts`;
 *   3. **mutante B (menção só em comentário)** — a mesma chamada, uma vez em comentário de linha e
 *      outra em comentário de bloco: `59 passed`, o caso permaneceu **VERDE**. É o que prova que a
 *      varredura não confunde menção com consumo — sem este segundo mutante, uma asserção que
 *      casasse comentário passaria o mutante A e pareceria boa, que é o defeito literal registrado
 *      na `testing-stack.md`;
 *   4. **reversão** — a cópia foi desfeita e o controle reexecutado, de novo `59 passed`.
 *
 * A varredura roda sobre `apps/api/src`, e **rota de teste não entra nesse conjunto**: as rotas
 * sintéticas de `test/autorizacao.e2e.spec.ts` vivem em `apps/api/test/` e não contaminam a
 * cardinalidade.
 *
 * ---------------------------------------------------------------------------
 * CT-219 — a precondição privilegiada, e por que ela é legítima
 * ---------------------------------------------------------------------------
 *
 * Observar as três colunas exige ler `identidade.sessao` **durante a sessão viva**, e isso é feito
 * pelo acesso restrito que `@sysloc/db` já publica — a mesma via pela qual a T7, a T8 e a T10 já
 * afirmam precondição. É observação de **estado persistido**, não instrumentação do SUT: nada em
 * `apps/api/src` ganhou símbolo, bandeira ou rota para este caso existir.
 *
 * O ajuste de permissão é gravado por `escreverAjustes` (T3), sob o contexto de tenant e dentro da
 * unidade de trabalho — o mesmo caminho que a rota do Admin chamará por dentro quando ela nascer
 * (T8 desta fatia).
 *
 * ---------------------------------------------------------------------------
 * O que o CT-219 prova, e o que ele NÃO tem como provar aqui
 * ---------------------------------------------------------------------------
 *
 * Ele prova o **valor** das três colunas nos três momentos: o retrato antigo antes da mudança, o
 * novo depois da primeira requisição, e a imutabilidade nas seguintes. Ele **não** prova a
 * *ausência da escrita* — e não por asserção faltante, mas porque nesta camada não existe marcador
 * que a discrimine: o arcabouço de identidade renova a sessão a cada uso, e reescreve a linha em
 * toda requisição autenticada por conta própria (medido: `xmin` mudou 4 vezes em 3 leituras, com
 * zero mudanças de permissão).
 *
 * Essa metade do invariante — *"a reescrita acontece por mudança, não por requisição"* — é provada
 * em `packages/auth/test/reescrita-do-efetivo.spec.ts` (caso `T4 §4-6`), sobre a função que emite a
 * escrita, lendo a versão da tupla. O detalhe da medição e da escolha de camada está no cabeçalho
 * daquele arquivo.
 */

import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { Controller, Get } from '@nestjs/common';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import { type ChaveDoCatalogo, validarCoerenciaDeAjustes } from '@sysloc/auth';
import {
  type AcessoAoBanco,
  abrirAcessoAoBanco,
  contextoDeTenant,
  EMPRESA_A,
  escreverAjustes,
  esquemaIdentidade,
  SENHA_DA_CARGA,
} from '@sysloc/db';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
// DÉBITO COM GATILHO — D28 · F0/T5 · gatilho JÁ DISPARADO (F1/T2, 2026-08-02)
// (NÃO é uma `DECISÃO FECHADA`: ele agenda uma mudança, não protege o código abaixo.)
// O QUÊ: os imports a seguir atravessam a fronteira de `@sysloc/shared`, `@sysloc/auth` e
//        `@sysloc/db` por CAMINHO DE ARQUIVO, fora do `exports` e do `files` daqueles manifestos.
//        As dependências de workspace estão declaradas, então não há dependência oculta; o que não
//        existe é FRONTEIRA para os diretórios `test/` — e este arquivo é mais um a repetir o
//        padrão, agora também para o acessório de varredura de `@sysloc/db`.
// QUANDO FECHA: o gatilho já disparou e o fechamento segue pendente; ele é o mesmo de sempre —
//        declarar o subpath `"./test"` nos manifestos e importar por `@sysloc/<pacote>/test`, ou
//        extrair um `@sysloc/test-utils`.
// POR QUE NÃO AGORA: fechar exige editar os manifestos de três pacotes e todos os consumidores,
//        nenhum deles no escopo desta task, e o índice de débitos do `CLAUDE.md`. É pendência
//        escalada ao orquestrador, não decisão desta task.
// ÍNDICE: docs/specs/features/fundacao-stack-nativa/v1/_run/run-report.md §2, D28
import {
  type IdentidadeEfemera,
  identidadeEfemera,
  pessoaSemeada,
} from '../../../packages/auth/test/identidade-efemera.ts';
import {
  listarFontesTs,
  type VarreduraDeFontes,
  varrerArquivos,
} from '../../../packages/db/test/varredura-de-fontes.ts';
import { reservarPorta } from '../../../packages/shared/test/efemero-comum.ts';
import { type FilaEfemera, redisEfemero } from '../../../packages/shared/test/redis-efemero.ts';
import { AppModule } from '../src/app.module.ts';
import { PREFIXO_DAS_ROTAS_DE_IDENTIDADE } from '../src/autenticacao/autenticacao.module.ts';
import { NaoExigePermissao } from '../src/autenticacao/exigencia.decorator.ts';
import { ENDERECO_DE_ESCUTA, PREFIXO_DE_VERSAO } from '../src/configuracao/ambiente.ts';

/** Limite da montagem: banco migrado, semente, fila e a aplicação. */
const LIMITE_DE_MONTAGEM_MS = 240_000;

/** Limite de um caso que atravessa HTTP e banco várias vezes. */
const LIMITE_CASO_MS = 60_000;

/** Sufixo do nome do cookie de sessão do arcabouço — o prefixo vem da configuração. */
const SUFIXO_DO_COOKIE_DE_SESSAO = 'session_token';

/** Caminho da rota sintética que o CT-219 usa como "requisição qualquer". */
const CAMINHO_DA_SONDA = 'sonda-de-ponto-de-aplicacao';

/** Diretório varrido pelo CT-216 — o fonte da aplicação, e só ele. */
const FONTE_DA_APLICACAO = fileURLToPath(new URL('../src', import.meta.url));

/** O símbolo de decisão cuja cardinalidade de consumo o CT-216 fixa. */
const SIMBOLO_DA_DECISAO = 'decidirAcesso';

/**
 * O único consumidor legítimo, relativo a `apps/api/src`.
 *
 * Literal e escrito à mão de propósito: ele é a **expectativa revisada**, e derivá-lo da mesma
 * varredura que o caso classifica faria o caso concordar consigo mesmo.
 */
const CONSUMIDOR_ESPERADO = 'autenticacao/contexto.guard.ts';

/**
 * Casa o consumo do símbolo como IDENTIFICADOR, e não como pedaço de palavra.
 *
 * As âncoras `\b` são o que impede `naoDecidirAcessoAlgum` de contar. Os comentários já saíram
 * antes de a linha chegar aqui (`semComentarios`), então menção em prosa não alcança este ponto.
 */
const CONSUMO_DA_DECISAO = new RegExp(`\\b${SIMBOLO_DA_DECISAO}\\b`, 'u');

/** Caminho da rota sintética que o `CT-216 (b)` usa — ela NÃO declara exigência alguma. */
const CAMINHO_SEM_DECLARACAO = 'rota-sem-declaracao-de-exigencia';

/** O sujeito do CT-219 — pessoa de empresa, com efetivo não vazio pela matriz do perfil. */
const PESSOA_DO_RETRATO = pessoaSemeada('usuario.a@exemplo.com.br');

/** O sujeito do `CT-216 (b)` — alcança as 17 chaves pela matriz do perfil dela. */
const ADMIN_COM_TUDO = pessoaSemeada('admin.a@exemplo.com.br');

/** A chave concedida no meio do CT-219, para que o retrato novo seja distinguível do antigo. */
const CHAVE_CONCEDIDA: ChaveDoCatalogo = 'TELA:financeiro';

/** O piso da matriz do perfil `USUARIO_EMPRESA` — a área que a pessoa alcança sem ajuste. */
const TELA_PADRAO_DO_USUARIO: ChaveDoCatalogo = 'TELA:resumo';

let identidade: IdentidadeEfemera;
let fila: FilaEfemera;
let acessoAoNegocio: AcessoAoBanco;
let aplicacao: NestFastifyApplication;
let base: string;
let ambienteAnterior: NodeJS.ProcessEnv;

const VARIAVEIS_MONTADAS = [
  'NODE_ENV',
  'PORT',
  'LOG_LEVEL',
  'DATABASE_URL',
  'REDIS_URL',
  'BETTER_AUTH_SECRET',
] as const;

beforeAll(async () => {
  identidade = await identidadeEfemera();
  fila = await redisEfemero();
  acessoAoNegocio = abrirAcessoAoBanco({ cadeiaDeConexao: identidade.banco.cadeiaConexao });

  ambienteAnterior = { ...process.env };
  process.env.NODE_ENV = 'test';
  process.env.LOG_LEVEL = 'fatal';
  process.env.DATABASE_URL = identidade.banco.cadeiaConexao;
  process.env.REDIS_URL = fila.cadeiaConexao;
  process.env.BETTER_AUTH_SECRET = randomBytes(32).toString('base64url');

  const porta = await reservarPorta();
  base = `http://${ENDERECO_DE_ESCUTA}:${String(porta)}`;
  process.env.PORT = String(porta);

  const modulo = await Test.createTestingModule({
    imports: [AppModule],
    controllers: [ControladorDeSonda, ControladorSemDeclaracao],
  }).compile();

  aplicacao = modulo.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
  aplicacao.setGlobalPrefix(PREFIXO_DE_VERSAO);
  await aplicacao.listen({ port: porta, host: ENDERECO_DE_ESCUTA });
}, LIMITE_DE_MONTAGEM_MS);

afterAll(async () => {
  await aplicacao?.close();
  await acessoAoNegocio?.encerrar();
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

describe('ponto de aplicação da autorização (T4)', () => {
  it('CT-216 — a decisão de autorização é consultada num ponto só de apps/api/src', async () => {
    const varredura = await varrerFonteDaAplicacao();

    // Âncora: sem ela, uma varredura que não lesse arquivo algum produziria dois conjuntos vazios e
    // a igualdade abaixo reprovaria por ausência, sem dizer por quê.
    expect(
      varredura.arquivos,
      'a varredura não leu arquivo algum: a cardinalidade seria zero por construção',
    ).toBeGreaterThan(0);

    const consumidores = [...new Set(varredura.ocorrencias.map(arquivoDaOcorrencia))].sort();

    // Igualdade sobre o CONJUNTO, com a diferença NOMEADA na mensagem: é ela que faz a falha dizer
    // QUEM passou a reavaliar a decisão, em vez de apenas "esperava 1, obteve 2".
    expect(
      consumidores,
      'os consumidores da decisão de autorização deixaram de ser apenas a guarda: ' +
        consumidores.join(', '),
    ).toEqual([CONSUMIDOR_ESPERADO]);
    expect(consumidores.length).toBe(1);

    // E o consumo é REAL, e não uma linha só: a guarda importa o símbolo e o chama. Sem esta
    // âncora, um arquivo que apenas mencionasse o nome numa cadeia de caracteres satisfaria a
    // cardinalidade e o invariante ficaria provado sobre nada.
    expect(varredura.ocorrencias.length).toBeGreaterThanOrEqual(2);
    expect(varredura.linhas.some((linha) => linha.includes(`${SIMBOLO_DA_DECISAO}(`))).toBe(true);
  });

  it(
    'CT-216 (b) — rota sem declaração de exigência é recusada, mesmo a quem alcança tudo',
    async () => {
      // O sujeito é o ADMIN, cuja matriz é o catálogo INTEIRO. É o que faz a recusa ser atribuível
      // à ausência de declaração, e não a uma permissão que falte: não há permissão que ele não
      // tenha. Com um sujeito sem chaves, o `403` viria de qualquer um dos dois caminhos.
      const cookie = await entrar(ADMIN_COM_TUDO.email);

      // SUT_IS_CORRECT_BECAUSE: sem cookie a resposta é `403`, e não `401` — o código de produção
      // está certo. A §5.1 da tech spec põe a leitura do metadado de exigência como **passo 1**, e
      // a resolução de sessão como passo 2: uma rota sem declaração está quebrada
      // independentemente de quem a chama, e recusá-la antes de autenticar não revela nada (não há
      // segredo a proteger numa rota que não atende ninguém). O contrário — recusar só depois de
      // autenticar — faria a MESMA rota quebrada responder duas coisas conforme o cliente tivesse
      // ou não cookie, e o operador veria `401` onde o defeito é de publicação.
      const semDeclaracao = await pedir(`/${PREFIXO_DE_VERSAO}/${CAMINHO_SEM_DECLARACAO}`);
      expect(semDeclaracao.status).toBe(403);

      const comSessao = await pedir(`/${PREFIXO_DE_VERSAO}/${CAMINHO_SEM_DECLARACAO}`, { cookie });
      expect(comSessao.status).toBe(403);

      // E as duas respostas são a MESMA — é o que diz "a recusa é da rota, não de quem pede".
      expect(semDeclaracao.texto).toBe(comSessao.texto);

      // Corpo INTEIRO: `ACESSO_NEGADO` (a ADR-0012 proíbe código novo no enum) com a mensagem
      // CANÔNICA, e **sem** `detalhes` — não há exigência a nomear, e inventar uma diria ao cliente
      // que existe uma chave capaz de liberá-lo. É a ausência de `detalhes` que discrimina esta
      // recusa da recusa por falta de permissão; o texto NÃO discrimina, e é assim de propósito.
      //
      // SUT_IS_CORRECT_BECAUSE: o código de produção está certo e esta asserção é que descrevia o
      // estado anterior. A mensagem própria ('acesso negado: a rota não declara exigência de
      // autorização') descreve um defeito interno de publicação e, pela ordem da guarda — o
      // metadado é lido ANTES de a sessão ser resolvida —, chegava também a cliente ANÔNIMO,
      // permitindo separar por varredura as rotas bem declaradas das mal declaradas. É o débito
      // D17 da §2 do run-report da fatia `autorizacao-e-ciclo-de-acesso`. A distinção não sumiu:
      // migrou para o `logger.warn` do ponto da recusa, que o cliente não lê.
      expect(JSON.parse(comSessao.texto) as unknown).toEqual({
        codigo: 'ACESSO_NEGADO',
        mensagem: 'acesso negado para esta sessão',
      });

      // O par que discrimina: a MESMA sessão alcança a sonda, que declara a marca de "não exige".
      // Sem ele, uma guarda que recusasse tudo passaria a metade de cima.
      expect((await sondar(cookie)).status).toBe(200);
    },
    LIMITE_CASO_MS,
  );

  it(
    'CT-219 — a divergência de versão reescreve o registro de sessão, e a ausência dela não o toca',
    async () => {
      const cookie = await entrar(PESSOA_DO_RETRATO.email);

      // A primeira requisição MONTA o retrato: a linha de sessão nasce com as três colunas no
      // padrão do schema, porque quem a cria é o arcabouço de identidade, que não as conhece.
      await sondar(cookie);

      const antigo = await retratoDaSessao(PESSOA_DO_RETRATO.id);
      expect(antigo).toEqual({ telas: [TELA_PADRAO_DO_USUARIO], acoes: [], versaoPermissoes: 0 });

      // --- a mudança, pelo caminho real da camada de dados ------------------------------------
      const versaoNova = await ajustar(PESSOA_DO_RETRATO.id, EMPRESA_A.id, [
        { chave: CHAVE_CONCEDIDA, efeito: 'CONCEDIDA' },
      ]);
      expect(versaoNova).toBe(1);

      // A escrita do ajuste, SOZINHA, não toca o registro de sessão. É metade do invariante e é o
      // que faz a reescrita ser atribuível à requisição seguinte, e não ao ajuste.
      expect(await retratoDaSessao(PESSOA_DO_RETRATO.id)).toEqual(antigo);

      // --- uma requisição qualquer, com o MESMO cookie ------------------------------------------
      expect((await sondar(cookie)).status).toBe(200);

      const novo = await retratoDaSessao(PESSOA_DO_RETRATO.id);
      expect(novo).toEqual({
        telas: [CHAVE_CONCEDIDA, TELA_PADRAO_DO_USUARIO].sort(),
        acoes: [],
        versaoPermissoes: 1,
      });
      // Dito também como diferença: o retrato MUDOU. Sem esta linha, um retrato antigo que já
      // coincidisse com o esperado tornaria a igualdade acima infalsificável.
      expect(novo).not.toEqual(antigo);

      // --- companheiro negativo: mais duas requisições SEM mudança ------------------------------
      //
      // O que as quatro asserções abaixo provam é o **valor**: as três colunas seguem carregando o
      // retrato que a divergência gravou, e uma requisição que não mudou nada não mexe nem no
      // efetivo nem na versão.
      //
      // O que elas **não** provam — e a correção deste comentário é o fecho de um achado do Gate 1,
      // não uma ressalva de estilo — é que a reescrita **não aconteceu**. Uma implementação que
      // reescrevesse a cada requisição gravaria exatamente os mesmos valores e passaria aqui: o
      // mutante duplo (desvio de `efetivoCorrente` removido **e** curto-circuito de igualdade de
      // `regravarEfetivoDaSessao` neutralizado) manteve esta suíte inteira verde, nos 59 casos.
      //
      // E nesta camada isso é irremediável, não uma asserção faltante: o arcabouço de identidade
      // renova a sessão **a cada uso** (`RENOVACAO_DA_SESSAO_EM_SEGUNDOS = 0`), de modo que toda
      // requisição autenticada reescreve a linha por conta própria. Medido em `xmin` — 4 versões de
      // tupla para 3 leituras autenticadas e zero mudanças de permissão. Nenhum marcador de escrita
      // física discrimina aqui, `atualizada_em` inclusive, porque quem o escreve é o mesmo caminho.
      //
      // A ausência da escrita é provada **uma camada abaixo**, sobre a função que a emite, onde
      // nada além da chamada sob prova toca a linha:
      // `packages/auth/test/reescrita-do-efetivo.spec.ts`, caso `T4 §4-6`. Os dois são
      // complementares — aquele prova que só se grava quando precisa, este prova o que fica
      // gravado atravessando a rota — e nenhum substitui o outro.
      expect((await sondar(cookie)).status).toBe(200);
      expect(await retratoDaSessao(PESSOA_DO_RETRATO.id)).toEqual(novo);

      expect((await sondar(cookie)).status).toBe(200);
      expect(await retratoDaSessao(PESSOA_DO_RETRATO.id)).toEqual(novo);
    },
    LIMITE_CASO_MS,
  );
});

/**
 * A rota sintética que o CT-219 usa como "requisição qualquer".
 *
 * Ela vive NESTE arquivo e é montada apenas na aplicação dele — nada em `apps/api/src` a conhece,
 * e por isso ela não entra na varredura do CT-216. Declara `@NaoExigePermissao()` porque o eixo do
 * caso é a **revalidação por versão**, e não a decisão de acesso: exigir uma chave faria a
 * requisição ser recusada justamente quando a permissão fosse retirada, e o retrato deixaria de ser
 * observável no passo seguinte.
 */
@Controller(CAMINHO_DA_SONDA)
class ControladorDeSonda {
  @Get()
  @NaoExigePermissao()
  responder(): { readonly ok: true } {
    return { ok: true };
  }
}

/**
 * A rota que **não declara nada** — o sujeito do `CT-216 (b)`.
 *
 * Ela é deliberadamente omissa, e o manipulador devolveria `200` se algum dia rodasse: é justamente
 * isso que torna a asserção comportamental. Um `403` produzido por um manipulador que já levantasse
 * erro não distinguiria a guarda do próprio manipulador.
 *
 * Ela vive NESTE arquivo. Publicar uma rota sem declaração em `apps/api/src` seria criar em produção
 * a superfície que a ADR-0011 existe para impedir — e o `CT-212` da T5 vai reprovar exatamente isso
 * sobre o roteador montado.
 */
@Controller(CAMINHO_SEM_DECLARACAO)
class ControladorSemDeclaracao {
  @Get()
  responder(): { readonly naoDeveriaChegarAqui: true } {
    return { naoDeveriaChegarAqui: true };
  }
}

// ---------------------------------------------------------------------------------------------
// Acessórios
// ---------------------------------------------------------------------------------------------

/** Varre o fonte da aplicação atrás do consumo do símbolo de decisão, sem comentários. */
async function varrerFonteDaAplicacao(): Promise<VarreduraDeFontes> {
  const arquivos = await listarFontesTs(FONTE_DA_APLICACAO);
  return await varrerArquivos(arquivos, (linha) => CONSUMO_DA_DECISAO.test(linha));
}

/** `…/apps/api/src/autenticacao/contexto.guard.ts:330` → `autenticacao/contexto.guard.ts`. */
function arquivoDaOcorrencia(ocorrencia: string): string {
  const semLinha = ocorrencia.slice(0, ocorrencia.lastIndexOf(':'));
  return semLinha.slice(FONTE_DA_APLICACAO.length + 1);
}

/** O retrato de efetivo gravado no registro de sessão da pessoa. */
async function retratoDaSessao(usuarioId: string): Promise<{
  telas: string[];
  acoes: string[];
  versaoPermissoes: number;
}> {
  const { sessao } = esquemaIdentidade;

  const linhas = await identidade.acesso.identidade
    .select({
      telas: sessao.telas,
      acoes: sessao.acoes,
      versaoPermissoes: sessao.versaoPermissoes,
    })
    .from(sessao)
    .where(eq(sessao.usuarioId, usuarioId));

  // Uma sessão, e o caso afirma isso: com duas, "o retrato" seria ambíguo e a igualdade passaria a
  // depender da ordem em que o banco as devolvesse.
  if (linhas.length !== 1) {
    throw new Error(
      `esperava exatamente uma sessão para ${usuarioId}, e há ${String(linhas.length)}`,
    );
  }

  const [linha] = linhas;
  if (linha === undefined) {
    throw new Error(`a sessão de ${usuarioId} desapareceu entre a contagem e a leitura`);
  }

  return {
    telas: [...linha.telas].sort(),
    acoes: [...linha.acoes].sort(),
    versaoPermissoes: linha.versaoPermissoes,
  };
}

/**
 * Substitui os ajustes individuais de uma pessoa, pelo caminho real da camada de dados (T3).
 *
 * Sob o contexto de tenant e dentro da unidade de trabalho — a coerência ação→tela é validada pela
 * função de domínio e o contador é incrementado na mesma transação. É o que a rota do Admin chamará
 * por dentro quando ela existir (T8 desta fatia).
 */
async function ajustar(
  usuarioId: string,
  empresaId: string,
  ajustes: readonly { readonly chave: ChaveDoCatalogo; readonly efeito: 'CONCEDIDA' | 'NEGADA' }[],
): Promise<number> {
  return await contextoDeTenant.executarCom(
    { empresaId },
    async () =>
      await acessoAoNegocio.emUnidadeDeTrabalho(
        async (tx) =>
          await escreverAjustes(tx, {
            usuarioId,
            ajustes,
            validarCoerencia: validarCoerenciaDeAjustes,
          }),
      ),
  );
}

interface Resposta {
  readonly status: number;
  readonly texto: string;
  readonly cookies: readonly string[];
}

/** Uma requisição qualquer com o cookie da pessoa — o gatilho da revalidação. */
async function sondar(cookie: string): Promise<Resposta> {
  return await pedir(`/${PREFIXO_DE_VERSAO}/${CAMINHO_DA_SONDA}`, { cookie });
}

interface OpcoesDoPedido {
  readonly metodo?: string;
  readonly corpo?: Record<string, unknown>;
  readonly cookie?: string;
}

/** Executa uma requisição HTTP real contra a aplicação. */
async function pedir(caminho: string, opcoes: OpcoesDoPedido = {}): Promise<Resposta> {
  const cabecalhos: Record<string, string> = { connection: 'close', origin: base };
  if (opcoes.corpo !== undefined) {
    cabecalhos['content-type'] = 'application/json';
  }
  if (opcoes.cookie !== undefined) {
    cabecalhos.cookie = opcoes.cookie;
  }

  const resposta = await fetch(new URL(caminho, base), {
    method: opcoes.metodo ?? 'GET',
    headers: cabecalhos,
    ...(opcoes.corpo === undefined ? {} : { body: JSON.stringify(opcoes.corpo) }),
  });

  return {
    status: resposta.status,
    texto: await resposta.text(),
    cookies: resposta.headers.getSetCookie(),
  };
}

/** Entra pelo caminho REAL — a rota pública de entrada — e devolve o cookie de sessão. */
async function entrar(email: string): Promise<string> {
  const entrada = await pedir(`${PREFIXO_DAS_ROTAS_DE_IDENTIDADE}/sign-in/email`, {
    metodo: 'POST',
    corpo: { email, password: SENHA_DA_CARGA },
  });

  if (entrada.status !== 200) {
    throw new Error(`a entrada de ${email} respondeu ${String(entrada.status)}: ${entrada.texto}`);
  }

  const cookie = entrada.cookies.find((candidato) =>
    (candidato.split(';')[0] ?? '').split('=')[0]?.trim().endsWith(SUFIXO_DO_COOKIE_DE_SESSAO),
  );

  if (cookie === undefined) {
    throw new Error('a entrada bem-sucedida não devolveu cookie de sessão');
  }

  return cookie.split(';')[0] ?? '';
}
