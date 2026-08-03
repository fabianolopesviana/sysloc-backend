/**
 * Sessão restrita: alcance, troca de senha provisória e segundo fator do Master. T10 da fatia
 * `fundacao-multitenancy-identidade`.
 *
 * ---------------------------------------------------------------------------
 * INVARIANTES
 * ---------------------------------------------------------------------------
 *
 * | Critério | Caso   | Invariante |
 * |---|---|---|
 * | CA-09 | CT-019 | Para o perfil Master a senha correta sozinha NÃO produz sessão plena: sem
 * |       |        | segundo fator ativo a sessão é restrita e a rota de negócio responde `403`
 * |       |        | nomeando a exigência; configurado e VERIFICADO o segundo fator, a restrição
 * |       |        | cai sem novo login. Com o segundo fator já ativo, a entrada devolve o
 * |       |        | DESAFIO e nenhuma sessão existe — código inválido e código mal formado
 * |       |        | recusam de formas distintas e a ausência de sessão permanece; só o código
 * |       |        | válido conclui o acesso. (RN-08) |
 * | CA-10 | CT-021 | Enquanto a senha em uso for provisória, a sessão alcança apenas `GET
 * |       |        | /v1/sessao`, a troca de senha e a configuração do segundo fator; toda outra
 * |       |        | rota responde `403` `ACESSO_NEGADO` nomeando a troca pendente. Concluída a
 * |       |        | troca, a restrição cai COM O MESMO COOKIE — sem novo login —, a leitura de
 * |       |        | negócio devolve os identificadores da empresa dela, e a senha provisória
 * |       |        | deixa de autenticar com resposta idêntica à da credencial incorreta.
 * |       |        | (RN-09, RN-10) |
 * | CA-10 | CT-022 | A troca obrigatória aplica a MESMA política de força da definição de senha:
 * | CA-07 |        | senha nova reprovada devolve `422` `CAMPO_INVALIDO` com o motivo em
 * |       |        | `detalhes` e NÃO passa a valer — a marca de senha provisória permanece, a
 * |       |        | rota de negócio segue em `403`, a provisória continua autenticando e
 * |       |        | nenhuma das recusadas autentica. (RN-05, RN-09) |
 *
 * Rastreabilidade: `CA-09 → CT-019 (RN-08)`, `CA-10 → CT-021 (RN-09)`, `CA-10 → CT-022 (RN-09)`,
 * `CA-07 → CT-022 (RN-05)`.
 *
 * ---------------------------------------------------------------------------
 * De onde vem o estado que cada caso assume
 * ---------------------------------------------------------------------------
 *
 * **Cada caso arranja o próprio sujeito e afirma a precondição que assume.** A T7 desta fatia foi
 * reprovada por prova tautológica por dependência de ordem, e aqui os três casos compartilham
 * arquivo, banco e aplicação — então nenhum deles herda estado de outro: cada um usa uma pessoa
 * exclusiva, escreve o que precisa e **afirma** o que escreveu antes de exercitar o fluxo.
 *
 * A marca `identidade.usuario.senha_provisoria` é escrita no arranjo, por acesso direto ao banco.
 * Não é atalho: **não existe caminho de escrita para ela nesta fatia** — a carga inicial não a
 * define (a coluna tem padrão falso) e as rotas de administração que a definiriam são da fatia
 * `autorizacao-e-ciclo-de-acesso`. Criar rota, bandeira ou símbolo de produção para "marcar como
 * provisória" seria antecipar aquela fatia e vazar código test-only para a produção (Iron Law #6).
 * O padrão é o mesmo que a T7 já usa no arranjo dela (`banco.update(usuario).set({ ativo: false })`)
 * — observação e escrita de **estado de domínio persistido**, não instrumentação do SUT: a partir
 * daí tudo acontece pelas rotas reais.
 *
 * O segundo fator, esse, **nunca** é forjado no banco: ele nasce e é ativado pelas rotas públicas
 * (`POST /v1/auth/two-factor/enable` e `POST /v1/auth/two-factor/verify-totp`), e o código é
 * derivado do `totpURI` que a própria resposta devolve, pela função de geração **do próprio
 * arcabouço** (`api.generateTOTP`). Ler o segredo da tabela ou reimplementar o algoritmo provaria
 * um caminho que não existe.
 *
 * ---------------------------------------------------------------------------
 * Uma aplicação, instrumentada — e por que ela precisa de um controlador-fixture
 * ---------------------------------------------------------------------------
 *
 * A §4.1 da tech spec publica sete rotas, seis sob `/v1/auth` e `GET /v1/sessao`: **nenhuma de
 * negócio**. O eixo central desta task — *"a sessão restrita não alcança dado de negócio"* — precisa
 * de uma rota protegida que leia dado tenantizado, e publicar uma rota de produto para satisfazer
 * teste seria a forma mais cara da Iron Law #6. O controlador-fixture abaixo vive NESTE arquivo,
 * como o `ControladorDeVinculos` da T9 (`test/contexto.e2e.spec.ts`) e o `ControladorQueFalha` do
 * CT-006: ele é injetado pelo mecanismo do próprio arcabouço de teste, não sobe em operação, e nada
 * em `apps/api/src` o conhece.
 *
 * ---------------------------------------------------------------------------
 * De onde vêm o banco, a fila e a credencial (ADR-0006)
 * ---------------------------------------------------------------------------
 *
 * De instâncias efêmeras próprias. Nenhuma coordenada de conexão é lida do ambiente: o ambiente do
 * processo é MONTADO a partir do que os helpers devolvem. A porta é **reservada** (trava atômica),
 * e não dinâmica, pela razão que a T8 registrou: o arcabouço confere a origem das requisições com
 * cookie contra o endereço base, composto a partir da porta CONFIGURADA — com `port: 0` a
 * configurada e a real divergiriam.
 */

import { randomBytes } from 'node:crypto';
import { Controller, Get } from '@nestjs/common';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import {
  ACESSOS_DA_EMPRESA_A,
  type AcessoAoBanco,
  abrirAcessoAoBanco,
  EMPRESA_A,
  esquemaIdentidade,
  SENHA_DA_CARGA,
  USUARIO_MASTER,
} from '@sysloc/db';
import { CodigoErro } from '@sysloc/shared';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
// DÉBITO COM GATILHO — D28 · F0/T5 · gatilho JÁ DISPARADO (F1/T2, 2026-08-02)
// (NÃO é uma `DECISÃO FECHADA`: ele agenda uma mudança, não protege o código abaixo.)
// O QUÊ: os imports a seguir atravessam a fronteira de `@sysloc/shared` e de `@sysloc/auth` por
//        CAMINHO DE ARQUIVO, fora do `exports` e do `files` daqueles manifestos. As dependências de
//        workspace estão declaradas, então não há dependência oculta; o que não existe é FRONTEIRA
//        para os diretórios `test/` — e este arquivo é mais um a repetir o padrão. A varredura de
//        hoje conta OITO arquivos que atravessam a fronteira assim; os marcadores anteriores
//        numeraram por ordem de criação e ficaram abaixo desse total — o número que vale é o medido.
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
import { CAMINHO_DA_SESSAO } from '../src/autenticacao/sessao.controller.ts';
import { ROTAS_DA_SESSAO_RESTRITA } from '../src/autenticacao/sessao-restrita.ts';
import { ENDERECO_DE_ESCUTA, PREFIXO_DE_VERSAO } from '../src/configuracao/ambiente.ts';
import { decodificarBase32 } from './base32.ts';

/** Limite da montagem: banco migrado, semente, fila e a aplicação. */
const LIMITE_DE_MONTAGEM_MS = 240_000;

/** Limite de um caso que atravessa HTTP e banco várias vezes. */
const LIMITE_CASO_MS = 60_000;

/** Sufixo do nome do cookie de sessão do arcabouço — o prefixo vem da configuração. */
const SUFIXO_DO_COOKIE_DE_SESSAO = 'session_token';

/** Caminho, relativo à raiz, da rota de sessão do produto. Composto, nunca escrito à mão. */
const CAMINHO_DA_SESSAO_CORRENTE = `/${PREFIXO_DE_VERSAO}/${CAMINHO_DA_SESSAO}`;

/**
 * Caminho do controlador-fixture, relativo ao prefixo de versão.
 *
 * O nome denuncia o que ele é: superfície de VERIFICAÇÃO, montada apenas nesta aplicação. Nada em
 * `apps/api/src` a conhece.
 */
const CAMINHO_DO_NEGOCIO = 'negocio-de-verificacao';

/** O mesmo caminho a partir da raiz. */
const CAMINHO_DO_NEGOCIO_CORRENTE = `/${PREFIXO_DE_VERSAO}/${CAMINHO_DO_NEGOCIO}`;

/** As rotas do arcabouço que esta task exercita, compostas a partir do prefixo real. */
const ROTA_DE_ENTRADA = `${PREFIXO_DAS_ROTAS_DE_IDENTIDADE}/sign-in/email`;
const ROTA_DE_SAIDA = `${PREFIXO_DAS_ROTAS_DE_IDENTIDADE}/sign-out`;
const ROTA_DE_TROCA_DE_SENHA = `${PREFIXO_DAS_ROTAS_DE_IDENTIDADE}/change-password`;
const ROTA_DE_PREPARO_DO_SEGUNDO_FATOR = `${PREFIXO_DAS_ROTAS_DE_IDENTIDADE}/two-factor/enable`;
const ROTA_DE_VERIFICACAO_DO_SEGUNDO_FATOR = `${PREFIXO_DAS_ROTAS_DE_IDENTIDADE}/two-factor/verify-totp`;

/**
 * As mensagens que o `403` da sessão restrita carrega, escritas por extenso.
 *
 * Literais, e **não** importadas do módulo sob teste: comparar a resposta com a constante que a
 * produziu faria o caso concordar consigo mesmo. É a mensagem que a §10.1 da tech spec exige que
 * *"nomeie a exigência pendente"*, e é ela que o cliente lê para saber o que falta — logo, é
 * contrato, e contrato se escreve à mão no caso.
 */
const MENSAGEM_DA_SENHA_PROVISORIA =
  'acesso negado: esta sessão está restrita até a troca da senha provisória';
const MENSAGEM_DO_SEGUNDO_FATOR =
  'acesso negado: esta sessão está restrita até a configuração do segundo fator';

/** Mensagem canônica dos códigos que os casos afirmam, também por extenso e pela mesma razão. */
const MENSAGEM_DE_CAMPO_INVALIDO = 'requisição inválida';
const MENSAGEM_DE_CREDENCIAL_INVALIDA = 'credencial inválida';
const MENSAGEM_SEM_SESSAO = 'sessão inválida ou expirada';

/** Código de segundo fator bem formado e **errado** — seis dígitos que não são o código corrente. */
const CODIGO_ERRADO = '000000';

/** Código MAL FORMADO: nem seis, nem só dígitos. É recusa de campo, não de credencial (§6.1). */
const CODIGO_MAL_FORMADO = '12a4';

/** Sujeito do CT-019 — o Master nasce da carga sem segundo fator configurado. */
const MASTER = USUARIO_MASTER;

/** Sujeito exclusivo do CT-021: a troca dele muda a senha da conta, e emprestá-lo quebraria o CT-022. */
const PESSOA_DA_TROCA = pessoaSemeada('admin.a@exemplo.com.br');

/** Sujeito exclusivo do CT-022: as três recusas incrementam o contador de bloqueio dele. */
const PESSOA_DA_RECUSA = pessoaSemeada('usuario.a@exemplo.com.br');

/** A senha nova do CT-021 — aprovada pela política, e sem pedaço do nome ou do e-mail da pessoa. */
const SENHA_NOVA = 'Trilha9Verde!';

/** Senha atual errada, usada para sondar a rota de troca sem trocar coisa alguma. */
const SENHA_ATUAL_ERRADA = 'Bosque4Claro!';

/**
 * A tabela do CT-022 — uma linha por regra da política de força (RN-05).
 *
 * O `motivo` esperado é o rótulo fechado que a política devolve, e ele viaja em `detalhes`. Cada
 * senha viola **uma** regra e apenas uma: se violasse duas, a asserção do motivo deixaria de
 * discriminar qual regra reprovou.
 */
const SENHAS_RECUSADAS: readonly { rotulo: string; senha: string; motivo: string }[] = [
  { rotulo: 'nove caracteres', senha: 'Chuva7Lon', motivo: 'COMPRIMENTO_MINIMO' },
  { rotulo: 'contém o nome da pessoa', senha: 'Artur#2026Ok', motivo: 'CONTEM_DADO_PESSOAL' },
  {
    rotulo: 'quatro caracteres consecutivos',
    senha: 'Prova!abcd7X',
    motivo: 'SEQUENCIA_CONSECUTIVA',
  },
];

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
  // O acesso a `negocio` é do CONTROLADOR-FIXTURE, e é aberto aqui porque quem abre é dono do
  // recurso: ele é encerrado no descarte. A cadeia é a do papel `sysloc_app`, o papel sujeito à
  // política (ADR-0008).
  acessoAoNegocio = abrirAcessoAoBanco({ cadeiaDeConexao: identidade.banco.cadeiaConexao });

  ambienteAnterior = { ...process.env };
  process.env.NODE_ENV = 'test';
  // As linhas do registro se misturariam ao relatório do arcabouço, e nenhum caso deste arquivo
  // assere sobre elas — quem observa registro é o CT-029 da T9.
  process.env.LOG_LEVEL = 'fatal';
  process.env.DATABASE_URL = identidade.banco.cadeiaConexao;
  process.env.REDIS_URL = fila.cadeiaConexao;
  // Sorteado por execução, como as demais credenciais efêmeras: vive na memória deste processo e
  // morre com ele.
  process.env.BETTER_AUTH_SECRET = randomBytes(32).toString('base64url');

  const porta = await reservarPorta();
  base = `http://${ENDERECO_DE_ESCUTA}:${String(porta)}`;
  process.env.PORT = String(porta);

  const modulo = await Test.createTestingModule({
    imports: [AppModule],
    controllers: [ControladorDeNegocioDeVerificacao],
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

describe('sessão restrita, troca de senha provisória e segundo fator (T10)', () => {
  it(
    'CT-019 — o Sysloc Master só conclui o acesso após o segundo fator; sem ele nenhuma sessão plena existe',
    async () => {
      // Precondição AFIRMADA, nunca herdada: o Master da carga não tem segundo fator ativo e a
      // senha dele não é provisória — sem isto, "restrita por causa do segundo fator" não
      // distinguiria a exigência de uma restrição vinda de outro eixo.
      expect(await estadoPersistido(MASTER.id)).toEqual({
        senhaProvisoria: false,
        doisFatoresAtivo: false,
      });

      // --- 1. entra com a senha correta, ainda sem segundo fator ------------------------------
      const primeira = await entrar(MASTER.email, SENHA_DA_CARGA);
      expect(primeira.status).toBe(200);
      const sessaoDoMaster = guardarCookies(new Map(), primeira);

      // --- 2. a sessão é RESTRITA: reporta a exigência e não alcança negócio -------------------
      const restrita = await pedir(CAMINHO_DA_SESSAO_CORRENTE, { cookies: sessaoDoMaster });
      expect(restrita.status).toBe(200);
      // Objeto inteiro: os oito campos da §4.2. `segundoFatorPendente: true` com
      // `senhaProvisoria: false` é o par que isola a exigência sob teste.
      expect(restrita.corpo).toEqual({
        usuarioId: MASTER.id,
        nome: MASTER.nome,
        email: MASTER.email,
        perfil: 'SYSLOC_MASTER',
        empresaId: null,
        empresaNome: null,
        senhaProvisoria: false,
        segundoFatorPendente: true,
      });

      const negocioBarrado = await pedir(CAMINHO_DO_NEGOCIO_CORRENTE, { cookies: sessaoDoMaster });
      expect(negocioBarrado.status).toBe(403);
      // O envelope inteiro da ADR-0007, com a mensagem que NOMEIA a exigência (§10.1): uma recusa
      // com a mensagem padrão do filtro (`acesso negado para esta sessão`) reprova aqui.
      expect(negocioBarrado.corpo).toEqual({
        codigo: CodigoErro.ACESSO_NEGADO,
        mensagem: MENSAGEM_DO_SEGUNDO_FATOR,
      });

      // --- 3. configura o segundo fator PELAS ROTAS PÚBLICAS -----------------------------------
      const preparo = await pedir(ROTA_DE_PREPARO_DO_SEGUNDO_FATOR, {
        metodo: 'POST',
        cookies: sessaoDoMaster,
        corpo: { password: SENHA_DA_CARGA },
      });
      expect(preparo.status).toBe(200);
      const totpURI = (preparo.corpo as { totpURI?: unknown }).totpURI;
      expect(typeof totpURI).toBe('string');

      // PREPARAR não é CONFIGURAR: enquanto o código não for verificado, o segundo fator não está
      // ativo e a restrição PERMANECE. Sem esta asserção, uma implementação que caísse a restrição
      // no preparo — abrindo a janela que esta task existe para fechar — passaria o caso.
      const aindaBarrado = await pedir(CAMINHO_DO_NEGOCIO_CORRENTE, { cookies: sessaoDoMaster });
      expect(aindaBarrado.status).toBe(403);
      expect(aindaBarrado.corpo).toEqual({
        codigo: CodigoErro.ACESSO_NEGADO,
        mensagem: MENSAGEM_DO_SEGUNDO_FATOR,
      });

      const ativacao = await pedir(ROTA_DE_VERIFICACAO_DO_SEGUNDO_FATOR, {
        metodo: 'POST',
        cookies: sessaoDoMaster,
        corpo: { code: await codigoDoSegundoFator(String(totpURI)) },
      });
      expect(ativacao.status).toBe(200);
      // A ativação rotaciona a credencial de sessão (o arcabouço emite uma nova e apaga a
      // anterior); o cliente a guarda como faria um navegador.
      guardarCookies(sessaoDoMaster, ativacao);

      // A restrição caiu SEM novo login — a mesma pessoa, sem reentrada.
      const plena = await pedir(CAMINHO_DA_SESSAO_CORRENTE, { cookies: sessaoDoMaster });
      expect(plena.status).toBe(200);
      expect(plena.corpo).toEqual({
        usuarioId: MASTER.id,
        nome: MASTER.nome,
        email: MASTER.email,
        perfil: 'SYSLOC_MASTER',
        empresaId: null,
        empresaNome: null,
        senhaProvisoria: false,
        segundoFatorPendente: false,
      });

      // E a rota de negócio deixou de responder `403`. Para o Master ela devolve VAZIO, e é por
      // política do banco: contexto sem empresa não casa política alguma (RN-04).
      const negocioLiberado = await pedir(CAMINHO_DO_NEGOCIO_CORRENTE, { cookies: sessaoDoMaster });
      expect(negocioLiberado.status).toBe(200);
      expect(negocioLiberado.corpo).toEqual({ vinculos: [] });

      // --- 4. encerra e entra de novo, agora COM segundo fator ativo ---------------------------
      const saida = await pedir(ROTA_DE_SAIDA, { metodo: 'POST', cookies: sessaoDoMaster });
      expect(saida.status).toBe(200);
      expect(await estadoPersistido(MASTER.id)).toEqual({
        senhaProvisoria: false,
        doisFatoresAtivo: true,
      });

      const reentrada = await entrar(MASTER.email, SENHA_DA_CARGA);

      // --- 5. a resposta é o DESAFIO, e não uma sessão -----------------------------------------
      expect(reentrada.status).toBe(200);
      expect(reentrada.corpo).toEqual({ twoFactorRedirect: true, twoFactorMethods: ['totp'] });
      const desafio = guardarCookies(new Map(), reentrada);
      // O desafio NÃO é sessão restrita: naquela existe sessão, nesta não existe nenhuma — é a
      // ambiguidade que o glossário da fatia resolve, e o `401` (e não `403`) é a diferença
      // observável.
      await afirmarQueNaoHaSessao(desafio);

      // --- 6. código errado e código mal formado ------------------------------------------------
      const codigoValido = await codigoDoSegundoFator(String(totpURI));
      expect(
        codigoValido,
        'o código corrente coincidiu com o código propositalmente errado: o caso perderia o sujeito',
      ).not.toBe(CODIGO_ERRADO);

      const comCodigoErrado = await pedir(ROTA_DE_VERIFICACAO_DO_SEGUNDO_FATOR, {
        metodo: 'POST',
        cookies: desafio,
        corpo: { code: CODIGO_ERRADO },
      });
      expect(comCodigoErrado.status).toBe(401);
      expect(comCodigoErrado.corpo).toEqual({
        codigo: CodigoErro.CREDENCIAL_INVALIDA,
        mensagem: MENSAGEM_DE_CREDENCIAL_INVALIDA,
      });
      await afirmarQueNaoHaSessao(desafio);

      // Mal formado é recusa de CAMPO, e não de credencial (§6.1): o par de respostas é o que
      // separa "você digitou errado" de "o código não confere".
      const comCodigoMalFormado = await pedir(ROTA_DE_VERIFICACAO_DO_SEGUNDO_FATOR, {
        metodo: 'POST',
        cookies: desafio,
        corpo: { code: CODIGO_MAL_FORMADO },
      });
      expect(comCodigoMalFormado.status).toBe(422);
      expect(comCodigoMalFormado.corpo).toEqual({
        codigo: CodigoErro.CAMPO_INVALIDO,
        mensagem: MENSAGEM_DE_CAMPO_INVALIDO,
        campo: 'codigo',
      });
      await afirmarQueNaoHaSessao(desafio);

      // --- 7. o código válido conclui o acesso ---------------------------------------------------
      const conclusao = await pedir(ROTA_DE_VERIFICACAO_DO_SEGUNDO_FATOR, {
        metodo: 'POST',
        cookies: desafio,
        corpo: { code: await codigoDoSegundoFator(String(totpURI)) },
      });
      expect(conclusao.status).toBe(200);
      guardarCookies(desafio, conclusao);

      const sessaoConcluida = await pedir(CAMINHO_DA_SESSAO_CORRENTE, { cookies: desafio });
      expect(sessaoConcluida.status).toBe(200);
      expect(sessaoConcluida.corpo).toEqual({
        usuarioId: MASTER.id,
        nome: MASTER.nome,
        email: MASTER.email,
        perfil: 'SYSLOC_MASTER',
        empresaId: null,
        empresaNome: null,
        senhaProvisoria: false,
        segundoFatorPendente: false,
      });

      const negocioAposDesafio = await pedir(CAMINHO_DO_NEGOCIO_CORRENTE, { cookies: desafio });
      expect(negocioAposDesafio.status).toBe(200);
      expect(negocioAposDesafio.corpo).toEqual({ vinculos: [] });
    },
    LIMITE_CASO_MS,
  );

  it(
    'CT-021 — a senha provisória obriga a troca antes de qualquer outra ação, e depois dela deixa de valer',
    async () => {
      // A lista de rotas permitidas é a do módulo sob teste, e o caminho da rota de sessão é
      // composto a partir do DONO do segmento — é o que amarra o literal daquele módulo ao
      // controlador que atende, já que o ciclo de módulos impede a importação direta lá.
      expect(ROTAS_DA_SESSAO_RESTRITA).toEqual([CAMINHO_DA_SESSAO_CORRENTE]);

      await marcarSenhaProvisoria(PESSOA_DA_TROCA.id, true);
      // Precondição afirmada no BANCO, e não pressuposta: é ela que faz a sessão nascer restrita.
      expect(await estadoPersistido(PESSOA_DA_TROCA.id)).toEqual({
        senhaProvisoria: true,
        doisFatoresAtivo: false,
      });

      const entrada = await entrar(PESSOA_DA_TROCA.email, SENHA_DA_CARGA);
      expect(entrada.status).toBe(200);
      const sessao = guardarCookies(new Map(), entrada);

      // --- 2. as rotas PERMITIDAS respondem ------------------------------------------------------
      // O status exato de cada uma é afirmado em vez do "não é 403" que o passo pede: a igualdade
      // implica a negação e discrimina mais — uma rota permitida que respondesse `500` passaria
      // pelo "não é 403".
      const sessaoRestrita = await pedir(CAMINHO_DA_SESSAO_CORRENTE, { cookies: sessao });
      expect(sessaoRestrita.status).toBe(200);
      expect(sessaoRestrita.corpo).toEqual({
        usuarioId: PESSOA_DA_TROCA.id,
        nome: PESSOA_DA_TROCA.nome,
        email: PESSOA_DA_TROCA.email,
        perfil: 'ADMIN_EMPRESA',
        empresaId: EMPRESA_A.id,
        empresaNome: EMPRESA_A.nome,
        senhaProvisoria: true,
        segundoFatorPendente: false,
      });

      const preparoPermitido = await pedir(ROTA_DE_PREPARO_DO_SEGUNDO_FATOR, {
        metodo: 'POST',
        cookies: sessao,
        corpo: { password: SENHA_DA_CARGA },
      });
      expect(preparoPermitido.status).toBe(200);

      // A rota de troca é sondada com a senha ATUAL errada: ela responde — que é o que o passo
      // pede — sem trocar coisa alguma, e a recusa é a do arcabouço, traduzida pelo filtro.
      const sondaDaTroca = await pedir(ROTA_DE_TROCA_DE_SENHA, {
        metodo: 'POST',
        cookies: sessao,
        corpo: { currentPassword: SENHA_ATUAL_ERRADA, newPassword: SENHA_NOVA },
      });
      expect(sondaDaTroca.status).toBe(422);
      expect(sondaDaTroca.corpo).toEqual({
        codigo: CodigoErro.CAMPO_INVALIDO,
        mensagem: MENSAGEM_DE_CAMPO_INVALIDO,
      });

      // --- 3. a rota PROIBIDA responde 403 nomeando a exigência ---------------------------------
      const negocioBarrado = await pedir(CAMINHO_DO_NEGOCIO_CORRENTE, { cookies: sessao });
      expect(negocioBarrado.status).toBe(403);
      expect(negocioBarrado.corpo).toEqual({
        codigo: CodigoErro.ACESSO_NEGADO,
        mensagem: MENSAGEM_DA_SENHA_PROVISORIA,
      });

      // --- 4. troca a senha com o MESMO cookie ---------------------------------------------------
      const troca = await pedir(ROTA_DE_TROCA_DE_SENHA, {
        metodo: 'POST',
        cookies: sessao,
        corpo: { currentPassword: SENHA_DA_CARGA, newPassword: SENHA_NOVA },
      });
      expect(troca.status).toBe(200);
      // "Sem novo login" tem uma prova direta: a troca NÃO devolveu credencial de sessão nova. Sem
      // ela, uma implementação que rotacionasse o cookie e o teste guardasse em silêncio passaria
      // os passos seguintes provando outra coisa.
      expect(troca.cookies.filter(ehCookieDeSessao)).toEqual([]);

      // --- 5. a restrição caiu, com o MESMO cookie -----------------------------------------------
      const sessaoLiberada = await pedir(CAMINHO_DA_SESSAO_CORRENTE, { cookies: sessao });
      expect(sessaoLiberada.status).toBe(200);
      expect(sessaoLiberada.corpo).toEqual({
        usuarioId: PESSOA_DA_TROCA.id,
        nome: PESSOA_DA_TROCA.nome,
        email: PESSOA_DA_TROCA.email,
        perfil: 'ADMIN_EMPRESA',
        empresaId: EMPRESA_A.id,
        empresaNome: EMPRESA_A.nome,
        senhaProvisoria: false,
        segundoFatorPendente: false,
      });
      expect(await estadoPersistido(PESSOA_DA_TROCA.id)).toEqual({
        senhaProvisoria: false,
        doisFatoresAtivo: false,
      });

      // A leitura de negócio devolve os identificadores DA EMPRESA DELA — e não uma lista vazia,
      // que seria o que uma restrição ainda de pé produziria por outro caminho.
      const negocioLiberado = await pedir(CAMINHO_DO_NEGOCIO_CORRENTE, { cookies: sessao });
      expect(negocioLiberado.status).toBe(200);
      expect(negocioLiberado.corpo).toEqual({ vinculos: identificadoresDeA() });

      // --- 6. a provisória antiga não autentica mais ---------------------------------------------
      const saida = await pedir(ROTA_DE_SAIDA, { metodo: 'POST', cookies: sessao });
      expect(saida.status).toBe(200);

      const comAProvisoria = await entrar(PESSOA_DA_TROCA.email, SENHA_DA_CARGA);
      expect(comAProvisoria.status).toBe(401);
      expect(comAProvisoria.corpo).toEqual({
        codigo: CodigoErro.CREDENCIAL_INVALIDA,
        mensagem: MENSAGEM_DE_CREDENCIAL_INVALIDA,
      });

      // "Corpo IDÊNTICO ao da credencial incorreta" — comparado contra uma tentativa que é, de
      // fato, credencial incorreta. Sem esta referência, a asserção acima provaria o formato do
      // erro, não a indistinguibilidade que a RN-10 exige.
      const comSenhaQualquer = await entrar(PESSOA_DA_TROCA.email, SENHA_ATUAL_ERRADA);
      expect(comSenhaQualquer.status).toBe(comAProvisoria.status);
      expect(comSenhaQualquer.texto).toBe(comAProvisoria.texto);

      const comASenhaNova = await entrar(PESSOA_DA_TROCA.email, SENHA_NOVA);
      expect(comASenhaNova.status).toBe(200);
    },
    LIMITE_CASO_MS,
  );

  it(
    'CT-022 — a troca obrigatória recusa senha curta ou fraca com o motivo, e a exigência permanece',
    async () => {
      await marcarSenhaProvisoria(PESSOA_DA_RECUSA.id, true);
      expect(await estadoPersistido(PESSOA_DA_RECUSA.id)).toEqual({
        senhaProvisoria: true,
        doisFatoresAtivo: false,
      });

      const entrada = await entrar(PESSOA_DA_RECUSA.email, SENHA_DA_CARGA);
      expect(entrada.status).toBe(200);
      const sessao = guardarCookies(new Map(), entrada);

      // --- 1 e 2. cada linha da tabela, com o cookie da sessão restrita -------------------------
      for (const linha of SENHAS_RECUSADAS) {
        const recusa = await pedir(ROTA_DE_TROCA_DE_SENHA, {
          metodo: 'POST',
          cookies: sessao,
          corpo: { currentPassword: SENHA_DA_CARGA, newPassword: linha.senha },
        });

        expect(recusa.status, linha.rotulo).toBe(422);
        // Envelope inteiro: `detalhes` com o motivo específico é o que separa a recusa da POLÍTICA
        // (RN-05) da recusa por comprimento que o arcabouço faria sozinho — aquela chega sem
        // `detalhes` e não distingue regra nenhuma.
        expect(recusa.corpo, linha.rotulo).toEqual({
          codigo: CodigoErro.CAMPO_INVALIDO,
          mensagem: MENSAGEM_DE_CAMPO_INVALIDO,
          campo: 'senha',
          detalhes: { motivos: [linha.motivo] },
        });
      }

      // --- 3 e 4. a exigência PERMANECE de pé ---------------------------------------------------
      const aindaRestrita = await pedir(CAMINHO_DA_SESSAO_CORRENTE, { cookies: sessao });
      expect(aindaRestrita.status).toBe(200);
      expect((aindaRestrita.corpo as { senhaProvisoria?: unknown }).senhaProvisoria).toBe(true);
      expect(await estadoPersistido(PESSOA_DA_RECUSA.id)).toEqual({
        senhaProvisoria: true,
        doisFatoresAtivo: false,
      });

      const negocioBarrado = await pedir(CAMINHO_DO_NEGOCIO_CORRENTE, { cookies: sessao });
      expect(negocioBarrado.status).toBe(403);
      expect(negocioBarrado.corpo).toEqual({
        codigo: CodigoErro.ACESSO_NEGADO,
        mensagem: MENSAGEM_DA_SENHA_PROVISORIA,
      });

      // --- 5. a PROVISÓRIA ainda autentica, e nenhuma das recusadas autentica --------------------
      // Este é o passo que pega o defeito silencioso mais caro da troca: gravar a senha nova e SÓ
      // DEPOIS reprovar a validação. A resposta `422` acima ficaria idêntica, e só a tentativa de
      // entrada revela qual credencial está de fato valendo.
      const saida = await pedir(ROTA_DE_SAIDA, { metodo: 'POST', cookies: sessao });
      expect(saida.status).toBe(200);

      const comAProvisoria = await entrar(PESSOA_DA_RECUSA.email, SENHA_DA_CARGA);
      expect(comAProvisoria.status).toBe(200);

      for (const linha of SENHAS_RECUSADAS) {
        const comARecusada = await entrar(PESSOA_DA_RECUSA.email, linha.senha);

        expect(comARecusada.status, linha.rotulo).toBe(401);
        expect(comARecusada.corpo, linha.rotulo).toEqual({
          codigo: CodigoErro.CREDENCIAL_INVALIDA,
          mensagem: MENSAGEM_DE_CREDENCIAL_INVALIDA,
        });
      }
    },
    LIMITE_CASO_MS,
  );
});

/**
 * Controlador-fixture — a rota protegida que consulta dado de negócio.
 *
 * Ele existe **apenas neste arquivo** e é montado apenas na aplicação deste arquivo. Nada nele
 * declara `@Param`, `@Query`, `@Body` ou `@Headers`: nada do pedido chega ao manipulador, de
 * propósito, porque o que está sob teste é a decisão da GUARDA sobre alcançar ou não a rota.
 *
 * A leitura atravessa a unidade de trabalho REAL, com `SET LOCAL` e política — é o que faz o `200`
 * depois da troca significar "a pessoa alcançou o dado da empresa dela", e não apenas "o
 * manipulador rodou".
 */
@Controller(CAMINHO_DO_NEGOCIO)
class ControladorDeNegocioDeVerificacao {
  @Get()
  async listar(): Promise<{ vinculos: string[] }> {
    const linhas = await acessoAoNegocio.emUnidadeDeTrabalho(
      async (tx) =>
        await tx<{ id: string }[]>`SELECT id FROM negocio.acesso_usuario_app ORDER BY id`,
    );

    return { vinculos: linhas.map((linha) => linha.id) };
  }
}

/** Os identificadores de vínculo da empresa A, na ordem em que o banco os devolve. */
function identificadoresDeA(): string[] {
  return ACESSOS_DA_EMPRESA_A.map((acesso) => acesso.id).sort();
}

/** O par de marcas que a admissão lê da pessoa — o estado que cada caso arranja e afirma. */
interface EstadoPersistido {
  senhaProvisoria: boolean;
  doisFatoresAtivo: boolean;
}

/**
 * Lê do banco as duas marcas que decidem a restrição.
 *
 * Observação de estado persistido, e não instrumentação: é a mesma via pela qual a T7 e a T8 já
 * afirmam precondição (`ativo`, `empresa_id`, expiração de sessão).
 */
async function estadoPersistido(usuarioId: string): Promise<EstadoPersistido | undefined> {
  const { usuario } = esquemaIdentidade;

  const [linha] = await identidade.acesso.identidade
    .select({
      senhaProvisoria: usuario.senhaProvisoria,
      doisFatoresAtivo: usuario.doisFatoresAtivo,
    })
    .from(usuario)
    .where(eq(usuario.id, usuarioId))
    .limit(1);

  return linha;
}

/**
 * Escreve a marca de senha provisória no arranjo do caso.
 *
 * **Não existe rota que faça isso nesta fatia** — o cabeçalho deste arquivo explica por que criar
 * uma seria antecipar a fatia seguinte e vazar símbolo test-only para a produção. A partir daqui,
 * tudo é pelo caminho real.
 */
async function marcarSenhaProvisoria(usuarioId: string, valor: boolean): Promise<void> {
  const { usuario } = esquemaIdentidade;

  await identidade.acesso.identidade
    .update(usuario)
    .set({ senhaProvisoria: valor })
    .where(eq(usuario.id, usuarioId));
}

/**
 * Afirma que **não existe sessão** para os cookies informados.
 *
 * É a diferença observável entre o desafio de segundo fator e a sessão restrita: naquele o `GET
 * /v1/sessao` responde `401` — a recusa da guarda por ausência de sessão —, e nesta ele responde
 * `200`. O envelope inteiro é comparado porque o código é o que distingue a recusa da GUARDA da
 * recusa do arcabouço.
 */
async function afirmarQueNaoHaSessao(cookies: Map<string, string>): Promise<void> {
  const resposta = await pedir(CAMINHO_DA_SESSAO_CORRENTE, { cookies });

  expect(resposta.status).toBe(401);
  expect(resposta.corpo).toEqual({
    codigo: CodigoErro.NAO_AUTENTICADO,
    mensagem: MENSAGEM_SEM_SESSAO,
  });
}

/**
 * Deriva o código do segundo fator a partir do `totpURI` que a rota de preparo devolveu.
 *
 * O código sai da **função de geração do próprio arcabouço** (`api.generateTOTP`), e não de uma
 * reimplementação do algoritmo: uma cópia do TOTP escrita aqui provaria que duas implementações
 * concordam, e não que a nossa confere o código que o arcabouço espera. O segredo vem do endereço
 * que a resposta devolveu — nunca da tabela.
 *
 * A instância usada é a do helper de identidade, e isso é indiferente ao resultado: `generateTOTP`
 * é função pura sobre o segredo informado, sem banco e sem o segredo de assinatura da instância.
 */
async function codigoDoSegundoFator(totpURI: string): Promise<string> {
  const { code } = await identidade.autenticacao.api.generateTOTP({
    body: { secret: segredoDoTotpURI(totpURI) },
  });

  return code;
}

/** O segredo bruto que o `totpURI` carrega em base32. */
function segredoDoTotpURI(totpURI: string): string {
  const codificado = new URL(totpURI).searchParams.get('secret');

  if (codificado === null) {
    throw new Error(`o endereço de configuração do segundo fator não trouxe segredo: ${totpURI}`);
  }

  return decodificarBase32(codificado);
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
  /** O pote de cookies do cliente, reenviado como um navegador faria. */
  readonly cookies?: Map<string, string>;
}

/**
 * Executa uma requisição HTTP real contra a aplicação.
 *
 * O cabeçalho `Origin` acompanha toda requisição com a MESMA origem da aplicação — é o que um
 * navegador enviaria, e é o que o arcabouço confere nas requisições que carregam cookie. Ele é
 * composto da mesma fonte que o endereço base, e não escrito à mão.
 */
async function pedir(caminho: string, opcoes: OpcoesDoPedido = {}): Promise<Resposta> {
  const cabecalhos: Record<string, string> = { connection: 'close', origin: base };

  if (opcoes.corpo !== undefined) {
    cabecalhos['content-type'] = 'application/json';
  }

  const cookie = opcoes.cookies === undefined ? '' : comoCabecalhoDeCookie(opcoes.cookies);
  if (cookie.length > 0) {
    cabecalhos.cookie = cookie;
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

/** Entra pelo caminho REAL — a rota pública de entrada. Nenhum estado de sessão é forjado. */
async function entrar(email: string, senha: string): Promise<Resposta> {
  return await pedir(ROTA_DE_ENTRADA, {
    metodo: 'POST',
    corpo: { email, password: senha },
  });
}

/**
 * Guarda no pote os cookies que a resposta emitiu, como um navegador faria.
 *
 * Cookie com valor vazio é **removido**, e não guardado vazio: é assim que o arcabouço encerra
 * sessão e consome o desafio de segundo fator, e guardá-lo faria o cliente reenviar uma credencial
 * que o servidor acabou de apagar. O pote é devolvido para encadear no arranjo do caso.
 */
function guardarCookies(pote: Map<string, string>, resposta: Resposta): Map<string, string> {
  for (const bruto of resposta.cookies) {
    const par = bruto.split(';')[0] ?? '';
    const separador = par.indexOf('=');

    if (separador < 0) {
      continue;
    }

    const nome = par.slice(0, separador).trim();
    const valor = par.slice(separador + 1).trim();

    if (valor.length === 0) {
      pote.delete(nome);
    } else {
      pote.set(nome, valor);
    }
  }

  return pote;
}

/** O pote no formato em que o cliente o reenvia. */
function comoCabecalhoDeCookie(pote: Map<string, string>): string {
  return [...pote].map(([nome, valor]) => `${nome}=${valor}`).join('; ');
}

/** O cabeçalho `Set-Cookie` carrega a credencial de sessão do arcabouço. */
function ehCookieDeSessao(bruto: string): boolean {
  const par = bruto.split(';')[0] ?? '';
  return (par.split('=')[0] ?? '').trim().endsWith(SUFIXO_DO_COOKIE_DE_SESSAO);
}
