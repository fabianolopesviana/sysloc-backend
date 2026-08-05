/**
 * Autorização no ponto de aplicação: as 17 chaves, as duas dimensões e a revalidação por versão.
 * T4 da fatia `autorizacao-e-ciclo-de-acesso`.
 *
 * ---------------------------------------------------------------------------
 * INVARIANTES
 * ---------------------------------------------------------------------------
 *
 * | Critério | Caso   | Invariante |
 * |---|---|---|
 * | CA-23 | CT-211 | Para **cada uma** das 17 chaves do catálogo, a rota que a exige responde
 * | CA-09 |        | sucesso a quem a tem e `403` a quem não a tem — e a recusa nomeia **aquela**
 * | CA-10 |        | chave em `detalhes.exigido`, nunca uma genérica. A tabela é derivada do
 * | CA-22 |        | catálogo exportado, e a contagem é afirmada em 17. (RN-14, RN-15) |
 * | CA-22 | CT-214 | A recusa por permissão é distinguível, por CORPO INTEIRO, da recusa por falta
 * |       |        | de sessão e da de recurso inexistente: a MESMA rota devolve `403
 * |       |        | ACESSO_NEGADO` + `detalhes.exigido`, `401 NAO_AUTENTICADO` e `404
 * |       |        | RECURSO_NAO_ENCONTRADO`, e os três corpos são distintos entre si. (RN-14) |
 * | CA-22 | CT-215 | As duas dimensões da ADR-0011 recusam de formas distinguíveis: o Admin que
 * |       |        | chama rota de perfil de Master recebe `exigido: 'PERFIL:SYSLOC_MASTER'`, e o
 * |       |        | Usuário que chama rota de chave recebe `exigido: 'TELA:usuarios'` — valores
 * |       |        | distintos, nenhum genérico. (RN-14) |
 * | CA-20 | CT-217 | Permissão RETIRADA vale na operação seguinte, **com o mesmo cookie**: a rota
 * |       |        | que dependia dela passa a `403` nomeando-a, `GET /v1/sessao` responde `200`
 * |       |        | (a sessão NÃO caiu) e já não lista a chave, a rota que depende de outra chave
 * |       |        | segue em `2xx`, e a contagem de sessões da pessoa não muda. (RN-03, ADR-0010) |
 * | CA-21 | CT-218 | Permissão CONCEDIDA vale na operação seguinte, com o mesmo cookie e **sem
 * |       |        | nenhuma requisição de entrada entre as duas chamadas**: `403` vira `2xx`, o
 * |       |        | conjunto publicado passa a listar a chave e `versaoPermissoes` sobe de
 * |       |        | exatamente um. (RN-03, RN-17, ADR-0010) |
 *
 * Rastreabilidade: `CA-23 → CT-211 (RN-15)`, `CA-09 → CT-211 (RN-14)`, `CA-10 → CT-211 (RN-14)`,
 * `CA-22 → CT-211/CT-214/CT-215 (RN-14)`, `CA-20 → CT-217 (RN-03)`, `CA-21 → CT-218 (RN-03)`.
 *
 * ===========================================================================
 * AS ROTAS EXERCITADAS SÃO SINTÉTICAS — decisão do orquestrador, e a razão dela
 * ===========================================================================
 *
 * As 17 chaves do catálogo são áreas e ações do **app da imobiliária** (imóveis, contratos,
 * financeiro, cobrança), e as rotas que as consomem nascem nas fases **F2 a F5**. As rotas do Master
 * e do Admin desta fatia nascem nas tasks **T7** e **T8**. Nenhuma delas existe hoje.
 *
 * O que esta task entrega, e o que estes casos provam, é a **guarda** — o ponto de aplicação único.
 * O invariante do CT-211 é *"para cada chave, quem a tem alcança e quem não a tem é recusado
 * nomeando-a"*, e ele é propriedade da guarda, não das rotas de negócio. Por isso os casos
 * exercitam a guarda REAL, o decorator REAL e a decisão REAL contra **rotas sintéticas montadas
 * dentro deste arquivo**, injetadas pelo mecanismo do próprio arcabouço de teste — o mesmo padrão
 * do `ControladorDeVinculos` (`test/contexto.e2e.spec.ts`) e do `ControladorQueFalha` (CT-006).
 *
 * Três razões, na ordem em que pesam:
 *
 *   1. **Criar 17 rotas de produção seria violação séria.** A superfície da API **congela no marco
 *      de entrega** e é o que o `@sysloc/contracts` publica ao frontend; rotas de negócio vazias
 *      criadas agora poluiriam o contrato para sempre.
 *   2. **Não viola a Lei do seam.** Nenhum símbolo de produção nasce para teste: o módulo sintético
 *      vive em `apps/api/test/`, fora de `apps/api/src/`, e nada em `src` o conhece.
 *   3. **Não contamina o CT-216**, cuja varredura examina `apps/api/src` — rota de teste não entra
 *      naquele conjunto.
 *
 * **A tabela das 17 é DERIVADA do catálogo exportado, nunca redigitada** (o card do CT-211 é
 * literal quanto a isso): as rotas são publicadas por um laço sobre `CHAVES_DE_TELA` e
 * `CHAVES_DE_ACAO`, de modo que uma chave nova no catálogo ganha rota e caso sem edição aqui — e
 * uma chave que o catálogo perca deixa de ser exercitada em vez de virar um caso órfão que passa.
 *
 * ---------------------------------------------------------------------------
 * Os ajustes são gravados pela CAMADA DE DADOS, e não pela rota do Admin
 * ---------------------------------------------------------------------------
 *
 * O CT-217 e o CT-218 descrevem a mudança como feita "pelo Admin", e a rota que a fará
 * (`POST /v1/usuarios/:id/permissoes`) nasce na **T8**. Até lá, a mudança acontece por
 * `escreverAjustes` (T3) — sob o contexto de tenant, dentro da unidade de trabalho, com a validação
 * de coerência do domínio e o incremento do contador na mesma transação. É o caminho legítimo
 * disponível, e é exatamente o mesmo que a rota do Admin vai chamar por dentro. **Quando a T8
 * existir, estes casos passam a exercitá-la** — o que muda é a borda, não o efeito observado.
 *
 * ---------------------------------------------------------------------------
 * Cada caso arranja o próprio sujeito
 * ---------------------------------------------------------------------------
 *
 * Os cinco casos compartilham arquivo, banco e aplicação, e **nenhum herda estado de outro**: cada
 * um usa uma pessoa exclusiva, e as precondições de permissão são gravadas no arranjo e **afirmadas**
 * antes de o fluxo ser exercitado. A T7 da fatia anterior foi reprovada por prova tautológica por
 * dependência de ordem, e é essa a lição aplicada aqui.
 *
 * ---------------------------------------------------------------------------
 * De onde vêm o banco, a fila e a credencial (ADR-0006)
 * ---------------------------------------------------------------------------
 *
 * De instâncias efêmeras próprias. Nenhuma coordenada de conexão é lida do ambiente: o ambiente do
 * processo é MONTADO a partir do que os helpers devolvem. A porta é **reservada** (trava atômica), e
 * não dinâmica, pela razão que a T8 da fatia anterior registrou: o arcabouço confere a origem das
 * requisições com cookie contra o endereço base, composto a partir da porta CONFIGURADA.
 */

import { randomBytes } from 'node:crypto';
import { Controller, Get } from '@nestjs/common';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import {
  CHAVES_DE_ACAO,
  CHAVES_DE_TELA,
  type ChaveDoCatalogo,
  MATRIZ_POR_PERFIL,
  validarCoerenciaDeAjustes,
} from '@sysloc/auth';
import {
  type AcessoAoBanco,
  abrirAcessoAoBanco,
  contextoDeTenant,
  EMPRESA_A,
  EMPRESA_B,
  escreverAjustes,
  esquemaIdentidade,
  SENHA_DA_CARGA,
} from '@sysloc/db';
import { CodigoErro, ErroDeAplicacao } from '@sysloc/shared';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
// DÉBITO COM GATILHO — D28 · F0/T5 · gatilho JÁ DISPARADO (F1/T2, 2026-08-02)
// (NÃO é uma `DECISÃO FECHADA`: ele agenda uma mudança, não protege o código abaixo.)
// O QUÊ: os imports a seguir atravessam a fronteira de `@sysloc/shared` e de `@sysloc/auth` por
//        CAMINHO DE ARQUIVO, fora do `exports` e do `files` daqueles manifestos. As dependências de
//        workspace estão declaradas, então não há dependência oculta; o que não existe é FRONTEIRA
//        para os diretórios `test/` — e este arquivo é mais um a repetir o padrão.
// QUANDO FECHA: o gatilho já disparou e o fechamento segue pendente; ele é o mesmo de sempre —
//        declarar o subpath `"./test"` nos manifestos e importar por `@sysloc/shared/test` e
//        `@sysloc/auth/test`, ou extrair um `@sysloc/test-utils`.
// POR QUE NÃO AGORA: fechar exige editar os manifestos de dois pacotes e todos os consumidores,
//        nenhum deles no escopo desta task, e o índice de débitos do `CLAUDE.md`. É pendência
//        escalada ao orquestrador, não decisão desta task.
// ÍNDICE: docs/specs/features/fundacao-stack-nativa/v1/_run/run-report.md §2, D28
import {
  type IdentidadeEfemera,
  identidadeEfemera,
  pessoaSemeada,
} from '../../../packages/auth/test/identidade-efemera.ts';
import { reservarPorta } from '../../../packages/shared/test/efemero-comum.ts';
import { type FilaEfemera, redisEfemero } from '../../../packages/shared/test/redis-efemero.ts';
import { AppModule } from '../src/app.module.ts';
import { PREFIXO_DAS_ROTAS_DE_IDENTIDADE } from '../src/autenticacao/autenticacao.module.ts';
import { ExigeChave, ExigePerfil } from '../src/autenticacao/exigencia.decorator.ts';
import { CAMINHO_DA_SESSAO } from '../src/autenticacao/sessao.controller.ts';
import { ENDERECO_DE_ESCUTA, PREFIXO_DE_VERSAO } from '../src/configuracao/ambiente.ts';

/** Limite da montagem: banco migrado, semente, fila e a aplicação. */
const LIMITE_DE_MONTAGEM_MS = 240_000;

/** Limite de um caso que atravessa HTTP e banco várias vezes. */
const LIMITE_CASO_MS = 60_000;

/** Sufixo do nome do cookie de sessão do arcabouço — o prefixo vem da configuração. */
const SUFIXO_DO_COOKIE_DE_SESSAO = 'session_token';

/** Caminho, relativo à raiz, da rota de sessão do produto. Composto, nunca escrito à mão. */
const CAMINHO_DA_SESSAO_CORRENTE = `/${PREFIXO_DE_VERSAO}/${CAMINHO_DA_SESSAO}`;

/** Prefixo das 17 rotas sintéticas de chave — uma por chave do catálogo. */
const CAMINHO_DAS_CHAVES = 'verificacao-de-chave';

/** Rota sintética que exige a dimensão de PERFIL. */
const CAMINHO_DO_PERFIL = 'verificacao-de-perfil';

/** Rota sintética que exige chave E responde `404` para identificador desconhecido. */
const CAMINHO_DO_RECURSO = 'verificacao-de-recurso';

/** A chave que a rota de recurso exige — do catálogo, nunca um literal solto. */
const CHAVE_DO_RECURSO: ChaveDoCatalogo = 'TELA:cadastros';

/** O perfil que a rota de perfil exige. Literal fixado pelo card do CT-215. */
const PERFIL_EXIGIDO = 'SYSLOC_MASTER';

/** O valor que a recusa por perfil nomeia em `detalhes.exigido`. Literal fixado pelo card. */
const EXIGIDO_DE_PERFIL = 'PERFIL:SYSLOC_MASTER';

/** A chave que o CT-215 usa no eixo de chave. Literal fixado pelo card. */
const EXIGIDO_DE_CHAVE = 'TELA:usuarios';

/** Identificador que nenhum recurso tem — o gatilho do `404` do CT-214. */
const IDENTIFICADOR_INEXISTENTE = '99999999-9999-4999-8999-999999999999';

/**
 * As mensagens canônicas de cada código, escritas por extenso.
 *
 * Literais, e **não** lidas de `MENSAGEM_POR_CODIGO`: o CT-214 compara os três corpos inteiros por
 * igualdade, e derivá-los da mesma tabela que o SUT usa faria a asserção concordar consigo mesma —
 * um erro de texto na tabela passaria despercebido nos dois lados.
 */
const MENSAGEM_DE_ACESSO_NEGADO = 'acesso negado para esta sessão';
const MENSAGEM_SEM_SESSAO = 'sessão inválida ou expirada';
const MENSAGEM_DE_RECURSO_AUSENTE = 'recurso não encontrado';

/** As 17 chaves do catálogo — derivadas dos dois eixos exportados, nunca redigitadas. */
const TODAS_AS_CHAVES: readonly ChaveDoCatalogo[] = [...CHAVES_DE_TELA, ...CHAVES_DE_ACAO];

/** Quantas chaves o catálogo tem hoje (RN-15: 10 áreas de tela e 7 ações sensíveis). */
const TOTAL_DE_CHAVES = 17;

// ---------------------------------------------------------------------------------------------
// O elenco — uma pessoa por caso, e nenhuma compartilhada
// ---------------------------------------------------------------------------------------------

/** Alcança as 17 pela matriz do perfil dela: o lado POSITIVO do CT-211, e o `404` do CT-214. */
const ADMIN_COM_TUDO = pessoaSemeada('admin.a@exemplo.com.br');

/** Fica com efetivo VAZIO no arranjo: o lado NEGATIVO do CT-211, do CT-214 e do CT-215. */
const USUARIO_SEM_NADA = pessoaSemeada('usuario.a@exemplo.com.br');

/** Sujeito exclusivo do CT-217 — duas chaves concedidas, uma delas retirada durante o caso. */
const USUARIO_DA_RETIRADA = pessoaSemeada('usuario.b1@exemplo.com.br');

/** Sujeito exclusivo do CT-218 — a área concedida, a ação concedida durante o caso. */
const USUARIO_DA_CONCESSAO = pessoaSemeada('usuario.b2@exemplo.com.br');

/** A chave da "rota X" do CT-217 e a área que o CT-218 exige por coerência (RN-02). */
const CHAVE_DA_ROTA_X: ChaveDoCatalogo = 'TELA:financeiro';

/** A chave da "rota Y" do CT-217 — a que sobrevive à retirada. */
const CHAVE_DA_ROTA_Y: ChaveDoCatalogo = 'TELA:contratos';

/** A ação que o CT-218 concede no meio do caso. */
const ACAO_CONCEDIDA: ChaveDoCatalogo = 'ACAO:emitir_boleto';

/**
 * O piso da matriz do perfil `USUARIO_EMPRESA` — a área de chegada, que ele alcança sem ajuste.
 *
 * O efetivo é `(matriz do perfil ∪ concedidas) − negadas`, então ela aparece nos conjuntos dos dois
 * sujeitos de empresa mesmo sem ninguém a ter concedido. O literal é **amarrado à matriz** por
 * asserção no CT-217 e no CT-218: mudar o piso do perfil reprova ali, nomeando a causa, em vez de
 * fazer os dois casos falharem por uma diferença de conjunto sem explicação.
 */
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
    controllers: [ControladorDeChaves, ControladorDePerfil, ControladorDeRecurso],
  }).compile();

  aplicacao = modulo.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
  aplicacao.setGlobalPrefix(PREFIXO_DE_VERSAO);
  await aplicacao.listen({ port: porta, host: ENDERECO_DE_ESCUTA });

  // ------------------------------------------------------------------------------------------
  // Arranjo de permissão — pelo caminho real da camada de dados (ver o cabeçalho)
  // ------------------------------------------------------------------------------------------
  //
  // O Admin não recebe ajuste algum: a matriz do perfil dele já é o catálogo inteiro, e conceder
  // por ajuste o que o perfil concede tornaria o eixo positivo do CT-211 indiferente à matriz.
  await ajustar(USUARIO_SEM_NADA.id, EMPRESA_A.id, [{ chave: 'TELA:resumo', efeito: 'NEGADA' }]);
  await ajustar(USUARIO_DA_RETIRADA.id, EMPRESA_B.id, [
    { chave: CHAVE_DA_ROTA_X, efeito: 'CONCEDIDA' },
    { chave: CHAVE_DA_ROTA_Y, efeito: 'CONCEDIDA' },
  ]);
  await ajustar(USUARIO_DA_CONCESSAO.id, EMPRESA_B.id, [
    { chave: CHAVE_DA_ROTA_X, efeito: 'CONCEDIDA' },
  ]);
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

describe('autorização no ponto de aplicação (T4)', () => {
  it(
    'CT-211 — cada uma das 17 chaves concede a quem a tem e recusa nomeando-a a quem não a tem',
    async () => {
      // Âncora da tabela: ela é derivada do catálogo, e um catálogo que encolhesse em silêncio
      // faria os laços abaixo rodarem menos vezes sem que nada acusasse.
      expect(TODAS_AS_CHAVES.length).toBe(TOTAL_DE_CHAVES);
      expect(new Set(TODAS_AS_CHAVES).size).toBe(TOTAL_DE_CHAVES);

      const cookieDeQuemTem = await entrar(ADMIN_COM_TUDO.email);
      const cookieDeQuemNaoTem = await entrar(USUARIO_SEM_NADA.email);

      // Precondição afirmada, e não suposta: quem "não tem" precisa não ter NENHUMA das 17, senão o
      // lado negativo passaria por acaso em algumas linhas.
      expect(await efetivoPublicado(cookieDeQuemNaoTem)).toEqual({ telas: [], acoes: [] });
      const doAdmin = await efetivoPublicado(cookieDeQuemTem);
      expect(doAdmin.telas.length + doAdmin.acoes.length).toBe(TOTAL_DE_CHAVES);

      const concedidas: string[] = [];
      const recusadas: { chave: string; status: number; corpo: unknown }[] = [];

      for (const chave of TODAS_AS_CHAVES) {
        const permitida = await pedir(caminhoDaChave(chave), { cookie: cookieDeQuemTem });
        expect(
          permitida.status,
          `a chave ${chave} deveria conceder a quem a tem, e respondeu ${String(permitida.status)}`,
        ).toBe(200);
        concedidas.push(chave);

        const negada = await pedir(caminhoDaChave(chave), { cookie: cookieDeQuemNaoTem });
        recusadas.push({ chave, status: negada.status, corpo: negada.corpo });
      }

      // As 17 concessões e as 17 recusas, contadas. Sem a contagem, um laço que não iterasse nada
      // passaria todas as asserções de dentro dele — e não haveria como notar.
      expect(concedidas).toEqual([...TODAS_AS_CHAVES]);
      expect(recusadas.length).toBe(TOTAL_DE_CHAVES);

      // Corpo INTEIRO por igualdade, chave a chave, e cada um nomeando A SUA. É esta lista, e não
      // uma asserção por iteração, que reprova a implementação que devolvesse sempre a mesma chave
      // em `detalhes.exigido`: o valor esperado varia com a linha.
      expect(recusadas).toEqual(
        TODAS_AS_CHAVES.map((chave) => ({
          chave,
          status: 403,
          corpo: {
            codigo: CodigoErro.ACESSO_NEGADO,
            mensagem: MENSAGEM_DE_ACESSO_NEGADO,
            detalhes: { exigido: chave },
          },
        })),
      );
    },
    LIMITE_CASO_MS,
  );

  it(
    'CT-214 — a recusa por permissão é distinguível, por corpo inteiro, das outras duas',
    async () => {
      const cookieDeQuemTem = await entrar(ADMIN_COM_TUDO.email);
      const cookieDeQuemNaoTem = await entrar(USUARIO_SEM_NADA.email);
      const caminho = `/${PREFIXO_DE_VERSAO}/${CAMINHO_DO_RECURSO}/${IDENTIFICADOR_INEXISTENTE}`;

      // A MESMA rota, em três condições. Usar rotas diferentes provaria que três rotas respondem
      // três coisas; o eixo é que a MESMA rota discrimina por condição.
      const semPermissao = await pedir(caminho, { cookie: cookieDeQuemNaoTem });
      const semSessao = await pedir(caminho);
      const semRecurso = await pedir(caminho, { cookie: cookieDeQuemTem });

      expect(semPermissao.status).toBe(403);
      expect(semPermissao.corpo).toEqual({
        codigo: CodigoErro.ACESSO_NEGADO,
        mensagem: MENSAGEM_DE_ACESSO_NEGADO,
        detalhes: { exigido: CHAVE_DO_RECURSO },
      });

      expect(semSessao.status).toBe(401);
      expect(semSessao.corpo).toEqual({
        codigo: CodigoErro.NAO_AUTENTICADO,
        mensagem: MENSAGEM_SEM_SESSAO,
      });

      expect(semRecurso.status).toBe(404);
      expect(semRecurso.corpo).toEqual({
        codigo: CodigoErro.RECURSO_NAO_ENCONTRADO,
        mensagem: MENSAGEM_DE_RECURSO_AUSENTE,
      });

      // E os três são DISTINTOS entre si — dito por igualdade de texto cru, que alcança também a
      // ordem dos campos e qualquer diferença que a comparação estruturada normalizaria.
      const textos = new Set([semPermissao.texto, semSessao.texto, semRecurso.texto]);
      expect(textos.size).toBe(3);
    },
    LIMITE_CASO_MS,
  );

  it(
    'CT-215 — as duas dimensões recusam de formas distinguíveis, e nenhuma genérica',
    async () => {
      // O Admin tem TODAS as 17 chaves e mesmo assim é recusado na rota de perfil: é o que prova que
      // as duas dimensões são ORTOGONAIS, e que a de perfil não é satisfeita por permissão nenhuma.
      const cookieDoAdmin = await entrar(ADMIN_COM_TUDO.email);
      const porPerfil = await pedir(`/${PREFIXO_DE_VERSAO}/${CAMINHO_DO_PERFIL}`, {
        cookie: cookieDoAdmin,
      });

      // O Usuário sem chave nenhuma é recusado na rota de chave. Ele tem o perfil de empresa, então
      // a recusa não pode vir da outra dimensão.
      const cookieDoUsuario = await entrar(USUARIO_SEM_NADA.email);
      const porChave = await pedir(caminhoDaChave(EXIGIDO_DE_CHAVE), { cookie: cookieDoUsuario });

      expect(porPerfil.status).toBe(403);
      expect(porPerfil.corpo).toEqual({
        codigo: CodigoErro.ACESSO_NEGADO,
        mensagem: MENSAGEM_DE_ACESSO_NEGADO,
        detalhes: { exigido: EXIGIDO_DE_PERFIL },
      });

      expect(porChave.status).toBe(403);
      expect(porChave.corpo).toEqual({
        codigo: CodigoErro.ACESSO_NEGADO,
        mensagem: MENSAGEM_DE_ACESSO_NEGADO,
        detalhes: { exigido: EXIGIDO_DE_CHAVE },
      });

      // Distintos, e o par é o que discrimina: com um `exigido` genérico as duas igualdades acima
      // não passariam, mas esta linha nomeia o defeito de que se trata.
      expect(EXIGIDO_DE_PERFIL).not.toBe(EXIGIDO_DE_CHAVE);
      expect(exigidoDe(porPerfil.corpo)).not.toBe(exigidoDe(porChave.corpo));
    },
    LIMITE_CASO_MS,
  );

  it(
    'CT-217 — permissão retirada vale na operação seguinte, sem desconectar e sem quebrar o resto',
    async () => {
      // Âncora do piso do perfil: o efetivo soma a matriz aos ajustes, e as igualdades abaixo
      // contam com isso. Mudar a matriz do perfil reprova AQUI, nomeando a causa.
      expect(MATRIZ_POR_PERFIL.USUARIO_EMPRESA).toEqual([TELA_PADRAO_DO_USUARIO]);

      const cookie = await entrar(USUARIO_DA_RETIRADA.email);
      const sessoesAntes = await contarSessoes(USUARIO_DA_RETIRADA.id);

      // Precondição: a pessoa alcança as duas rotas com o efetivo que o arranjo gravou, somado ao
      // piso do perfil.
      const xAntes = await pedir(caminhoDaChave(CHAVE_DA_ROTA_X), { cookie });
      expect(xAntes.status).toBe(200);
      expect(await efetivoPublicado(cookie)).toEqual({
        telas: [TELA_PADRAO_DO_USUARIO, CHAVE_DA_ROTA_Y, CHAVE_DA_ROTA_X].sort(),
        acoes: [],
      });

      // A retirada. Em operação será `POST /v1/usuarios/:id/permissoes` (T8); aqui é o mesmo
      // caminho da camada de dados que aquela rota chamará por dentro.
      await ajustar(USUARIO_DA_RETIRADA.id, EMPRESA_B.id, [
        { chave: CHAVE_DA_ROTA_Y, efeito: 'CONCEDIDA' },
        { chave: CHAVE_DA_ROTA_X, efeito: 'NEGADA' },
      ]);

      // MESMO COOKIE, sem nenhuma requisição de entrada no meio.
      const xDepois = await pedir(caminhoDaChave(CHAVE_DA_ROTA_X), { cookie });
      expect(xDepois.status).toBe(403);
      expect(xDepois.corpo).toEqual({
        codigo: CodigoErro.ACESSO_NEGADO,
        mensagem: MENSAGEM_DE_ACESSO_NEGADO,
        detalhes: { exigido: CHAVE_DA_ROTA_X },
      });

      // A sessão NÃO caiu: a ADR-0010 separa "mudar permissão" de "revogar acesso", e encerrar a
      // sessão aqui apagaria a distinção. `200`, e o conjunto publicado já sem a chave.
      const sessao = await pedir(CAMINHO_DA_SESSAO_CORRENTE, { cookie });
      expect(sessao.status).toBe(200);
      expect((sessao.corpo as { telas: string[] }).telas).toEqual(
        [TELA_PADRAO_DO_USUARIO, CHAVE_DA_ROTA_Y].sort(),
      );
      expect((sessao.corpo as { telas: string[] }).telas).not.toContain(CHAVE_DA_ROTA_X);

      // E o RESTO continua funcionando — é a metade do invariante que uma implementação que
      // derrubasse o efetivo inteiro na divergência deixaria passar.
      const yDepois = await pedir(caminhoDaChave(CHAVE_DA_ROTA_Y), { cookie });
      expect(yDepois.status).toBe(200);

      // Nenhuma sessão foi criada nem apagada no percurso.
      expect(await contarSessoes(USUARIO_DA_RETIRADA.id)).toBe(sessoesAntes);
    },
    LIMITE_CASO_MS,
  );

  it(
    'CT-218 — permissão concedida vale na operação seguinte, com o mesmo cookie e sem novo login',
    async () => {
      // Âncora do piso do perfil — ver o CT-217.
      expect(MATRIZ_POR_PERFIL.USUARIO_EMPRESA).toEqual([TELA_PADRAO_DO_USUARIO]);

      const cookie = await entrar(USUARIO_DA_CONCESSAO.email);
      const versaoAntes = await versaoPublicada(cookie);

      // Precondição: a pessoa tem a ÁREA (exigência de coerência da RN-02) e não tem a AÇÃO.
      const telasEsperadas = [TELA_PADRAO_DO_USUARIO, CHAVE_DA_ROTA_X].sort();
      const efetivoAntes = await efetivoPublicado(cookie);
      expect(efetivoAntes.telas).toEqual(telasEsperadas);
      expect(efetivoAntes.acoes).toEqual([]);

      const antes = await pedir(caminhoDaChave(ACAO_CONCEDIDA), { cookie });
      expect(antes.status).toBe(403);
      expect(antes.corpo).toEqual({
        codigo: CodigoErro.ACESSO_NEGADO,
        mensagem: MENSAGEM_DE_ACESSO_NEGADO,
        detalhes: { exigido: ACAO_CONCEDIDA },
      });

      // A concessão. O conjunto é COMPLETO — `escreverAjustes` substitui o que existia —, e por isso
      // a área continua na lista: retirá-la deixaria a ação órfã e a RN-02 recusaria a escrita.
      await ajustar(USUARIO_DA_CONCESSAO.id, EMPRESA_B.id, [
        { chave: CHAVE_DA_ROTA_X, efeito: 'CONCEDIDA' },
        { chave: ACAO_CONCEDIDA, efeito: 'CONCEDIDA' },
      ]);

      // MESMO COOKIE, e NENHUMA requisição de entrada entre as duas chamadas — é o eixo do caso.
      const depois = await pedir(caminhoDaChave(ACAO_CONCEDIDA), { cookie });
      expect(depois.status).toBe(200);

      const efetivoDepois = await efetivoPublicado(cookie);
      expect(efetivoDepois.acoes).toEqual([ACAO_CONCEDIDA]);
      expect(efetivoDepois.telas).toEqual(telasEsperadas);

      // Exatamente um incremento: o contador sobe uma vez por escrita de ajuste (RN-17), qualquer
      // que seja o número de linhas gravadas. Asserir "mudou" deixaria passar dois incrementos.
      expect(await versaoPublicada(cookie)).toBe(versaoAntes + 1);
      expect(await versaoPublicada(cookie)).toBe(await versaoPersistida(USUARIO_DA_CONCESSAO.id));
    },
    LIMITE_CASO_MS,
  );
});

// ---------------------------------------------------------------------------------------------
// As rotas sintéticas — a superfície de VERIFICAÇÃO. Ver o cabeçalho deste arquivo.
// ---------------------------------------------------------------------------------------------

/**
 * O controlador das 17 rotas de chave.
 *
 * Os manipuladores são publicados por um **laço sobre o catálogo exportado**, logo abaixo — e não
 * escritos um a um. O card do CT-211 exige a tabela "derivada do catálogo exportado, nunca
 * redigitada", e dezessete métodos copiados seriam exatamente a lista paralela que envelhece em
 * silêncio: uma chave nova no catálogo nasceria sem rota, e o caso continuaria verde provando
 * dezesseis.
 *
 * Nada nos manipuladores lê o pedido: o que está sob teste é a decisão da GUARDA sobre alcançar ou
 * não a rota, e um manipulador que lesse o pedido tornaria a resposta função de outra coisa.
 */
@Controller(CAMINHO_DAS_CHAVES)
class ControladorDeChaves {}

for (const chave of TODAS_AS_CHAVES) {
  publicarRotaDeChave(chave);
}

/**
 * Publica, no protótipo do controlador acima, o manipulador de uma chave.
 *
 * Os decoradores do arcabouço são funções comuns — `@Get(...)` e `@ExigeChave(...)` gravam metadado
 * no `descriptor.value` —, então aplicá-los à mão produz exatamente a mesma rota que a forma
 * anotada produziria. É o que permite derivar as 17 do catálogo sem abrir mão do decorator REAL:
 * a exigência de cada rota é gravada por `ExigeChave`, o mesmo símbolo que a produção usa.
 */
function publicarRotaDeChave(chave: ChaveDoCatalogo): void {
  const nome = `alcancar_${chave.replace(/[^A-Za-z0-9]/gu, '_')}`;

  Object.defineProperty(ControladorDeChaves.prototype, nome, {
    value: () => ({ chave }),
    writable: true,
    enumerable: false,
    configurable: true,
  });

  const descritor = Object.getOwnPropertyDescriptor(ControladorDeChaves.prototype, nome);
  if (descritor === undefined) {
    throw new Error(`a rota sintética da chave ${chave} não pôde ser publicada`);
  }

  Get(segmentoDaChave(chave))(ControladorDeChaves.prototype, nome, descritor);
  ExigeChave(chave)(ControladorDeChaves.prototype, nome, descritor);
}

/** A rota sintética da dimensão de PERFIL. */
@Controller(CAMINHO_DO_PERFIL)
class ControladorDePerfil {
  @Get()
  @ExigePerfil(PERFIL_EXIGIDO)
  operacaoDoOperador(): { readonly alcancada: true } {
    return { alcancada: true };
  }
}

/**
 * A rota sintética que exige chave **e** pode não encontrar o recurso.
 *
 * Ela existe para o CT-214: sem um `404` produzido pela MESMA rota, a distinção entre "não pode" e
 * "não existe" seria afirmada comparando rotas diferentes, que não é o invariante. O erro é
 * levantado pelo vocabulário REAL (`ErroDeAplicacao`), de modo que o corpo vem do filtro global e do
 * envelope da ADR-0012 — e não de um objeto montado aqui.
 */
@Controller(CAMINHO_DO_RECURSO)
class ControladorDeRecurso {
  @Get(':id')
  @ExigeChave(CHAVE_DO_RECURSO)
  ler(): never {
    throw new ErroDeAplicacao(CodigoErro.RECURSO_NAO_ENCONTRADO, MENSAGEM_DE_RECURSO_AUSENTE);
  }
}

// ---------------------------------------------------------------------------------------------
// Acessórios
// ---------------------------------------------------------------------------------------------

/** `TELA:financeiro` → `TELA-financeiro`. O `:` é separador de parâmetro no roteador. */
function segmentoDaChave(chave: string): string {
  return chave.replace(':', '-');
}

/** Caminho absoluto da rota sintética de uma chave. */
function caminhoDaChave(chave: string): string {
  return `/${PREFIXO_DE_VERSAO}/${CAMINHO_DAS_CHAVES}/${segmentoDaChave(chave)}`;
}

/** O `detalhes.exigido` de um corpo de recusa, ou `undefined` se não houver. */
function exigidoDe(corpo: unknown): unknown {
  return (corpo as { detalhes?: { exigido?: unknown } } | undefined)?.detalhes?.exigido;
}

/** O par de conjuntos que `GET /v1/sessao` publica para o portador do cookie. */
async function efetivoPublicado(cookie: string): Promise<{ telas: string[]; acoes: string[] }> {
  const sessao = await pedir(CAMINHO_DA_SESSAO_CORRENTE, { cookie });

  if (sessao.status !== 200) {
    throw new Error(`a leitura da sessão respondeu ${String(sessao.status)}: ${sessao.texto}`);
  }

  const corpo = sessao.corpo as { telas: string[]; acoes: string[] };
  return { telas: corpo.telas, acoes: corpo.acoes };
}

/** O `versaoPermissoes` que `GET /v1/sessao` publica para o portador do cookie. */
async function versaoPublicada(cookie: string): Promise<number> {
  const sessao = await pedir(CAMINHO_DA_SESSAO_CORRENTE, { cookie });

  if (sessao.status !== 200) {
    throw new Error(`a leitura da sessão respondeu ${String(sessao.status)}: ${sessao.texto}`);
  }

  return (sessao.corpo as { versaoPermissoes: number }).versaoPermissoes;
}

/**
 * O contador de versão de permissão da pessoa, lido do banco.
 *
 * Observação de estado persistido pelo acesso restrito a `identidade` — a mesma via pela qual a T7,
 * a T8 e a T10 já afirmam precondição. Existe para conferir o valor **publicado** contra o banco, e
 * não contra si mesmo.
 */
async function versaoPersistida(usuarioId: string): Promise<number> {
  const { usuario } = esquemaIdentidade;

  const [linha] = await identidade.acesso.identidade
    .select({ versaoPermissoes: usuario.versaoPermissoes })
    .from(usuario)
    .where(eq(usuario.id, usuarioId))
    .limit(1);

  if (linha === undefined) {
    throw new Error(`a pessoa ${usuarioId} não existe no banco desta execução`);
  }

  return linha.versaoPermissoes;
}

/** Quantos registros de sessão a pessoa tem agora — o eixo "não desconectou" do CT-217. */
async function contarSessoes(usuarioId: string): Promise<number> {
  const { sessao } = esquemaIdentidade;

  const linhas = await identidade.acesso.identidade
    .select({ id: sessao.id })
    .from(sessao)
    .where(eq(sessao.usuarioId, usuarioId));

  return linhas.length;
}

/**
 * Substitui os ajustes individuais de uma pessoa, pelo caminho real da camada de dados (T3).
 *
 * Sob o contexto de tenant e dentro da unidade de trabalho — a coerência ação→tela é validada pela
 * função de domínio e o contador é incrementado na mesma transação. É o que a rota do Admin chamará
 * por dentro quando ela existir (T8); ver o cabeçalho deste arquivo.
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
  readonly corpo: unknown;
  readonly cookies: readonly string[];
}

interface OpcoesDoPedido {
  readonly metodo?: string;
  readonly corpo?: Record<string, unknown>;
  readonly cookie?: string;
}

/**
 * Executa uma requisição HTTP real contra a aplicação.
 *
 * O cabeçalho `Origin` acompanha toda requisição com a MESMA origem da aplicação — é o que um
 * navegador enviaria, e é o que o arcabouço confere nas requisições que carregam cookie.
 */
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

  const texto = await resposta.text();
  const tipoDeConteudo = resposta.headers.get('content-type') ?? '';

  return {
    status: resposta.status,
    texto,
    corpo:
      tipoDeConteudo.includes('application/json') && texto.length > 0
        ? (JSON.parse(texto) as unknown)
        : undefined,
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
