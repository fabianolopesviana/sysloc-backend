/**
 * Superfície versionada de identidade — entrada, encerramento e ciclo de vida da sessão sobre HTTP
 * real. T8 da fatia `fundacao-multitenancy-identidade`.
 *
 * ---------------------------------------------------------------------------
 * INVARIANTES
 * ---------------------------------------------------------------------------
 *
 * | Critério | Caso   | Invariante |
 * |---|---|---|
 * | CA-06 | CT-018 | Credencial correta de pessoa ativa em empresa ativa produz `200` com cookie
 * | CA-01 |        | `HttpOnly`+`Secure`+`SameSite=Lax`; o cookie reenviado identifica AQUELA
 * |       |        | pessoa, e a sessão persistida está presa à empresa dela — a de outra empresa
 * |       |        | produz sessão presa à outra. (RN-07) |
 * | CA-06 | CT-018 | Companheiro negativo: credencial incorreta responde `401` com o corpo exato
 * |       | (c)    | `{ codigo: 'CREDENCIAL_INVALIDA', mensagem: 'credencial inválida' }` — o
 * |       |        | envelope da ADR-0007, sem o vocabulário do arcabouço —, sem cookie e sem
 * |       |        | sessão nova. (RN-10) |
 * | —     | CT-018 | Os quatro endereços que `verificar-fundacao.sh` consulta continuam
 * |       | (b)    | respondendo fora do prefixo, e a versão prefixada deles NÃO existe; ao mesmo
 * |       |        | tempo a superfície de identidade só existe COM o prefixo. |
 * | —     | CT-018 | O INVENTÁRIO das rotas que o curinga publica sob `/v1/auth` é exatamente o
 * |       | (d)    | conjunto aceito — as seis declaradas na §4.1 mais a superfície tolerada —, e
 * |       |        | qualquer excedente ou ausente é NOMEADO na falha. (§11.1) |
 * | —     | CT-018 | Recusa do arcabouço com status FORA da tabela de código por status sai com o
 * |       | (e)    | status preservado e código de recusa — nunca `500`/`ERRO_INTERNO` —, e o
 * |       |        | journal a registra como recusa, nunca como falha do serviço. (ADR-0007) |
 * | CA-11 | CT-023 | Depois de `POST /v1/auth/sign-out`, o mesmo cookie deixa de autenticar e a
 * |       |        | linha some de `identidade.sessao` — invalidação de ESTADO no banco, não
 * |       |        | expiração do cookie no cliente. A resposta é idêntica à de um cookie que
 * |       |        | nunca correspondeu a sessão alguma. (RN-10) |
 * | CA-12 | CT-024 | Atividade dentro do prazo empurra a expiração persistida para a frente;
 * |       |        | passada a expiração, a requisição com o mesmo cookie é recusada e exige nova
 * |       |        | entrada, que funciona. (RN-07) |
 *
 * Rastreabilidade: `CA-06 → CT-018 (RN-07)`, `CA-01 → CT-018`, `CA-11 → CT-023 (RN-10)`,
 * `CA-12 → CT-024 (RN-07)`.
 *
 * ---------------------------------------------------------------------------
 * A sonda autenticada é `GET /v1/auth/get-session`, e não `GET /v1/sessao`
 * ---------------------------------------------------------------------------
 *
 * Os três casos precisam de UMA rota que só responda a quem tem sessão válida. `GET /v1/sessao` — o
 * objeto de sessão no modelo de domínio do produto — é da **T9**, que é dona do arquivo que a cria;
 * publicá-la aqui seria criar duas vezes o mesmo recurso, em duas tasks. A sonda usada é, portanto,
 * a rota que ESTA task publica: a leitura de sessão do próprio arcabouço, que passa a existir sob
 * `/v1/auth` pela montagem entregue aqui.
 *
 * A troca preserva o que cada caso prova, porque o CA-11 e o CA-12 são sobre **ciclo de vida da
 * sessão** — quem a invalida, quando ela vence, o que sobra no banco — e não sobre a forma do
 * envelope. O eixo do envelope de domínio (`usuarioId`, `nome`, `email`, `perfil`, `empresaId`,
 * `empresaNome`, `senhaProvisoria`, `segundoFatorPendente`) é da T9, e está registrado como
 * pendência desta task com aquela dona.
 *
 * **A recusa desta sonda é corpo `null` com `200`, e não `401`.** É o contrato do arcabouço para
 * "não há sessão", e afirmá-lo como ele é vale mais que fingir um status que esta rota não produz:
 * o `401` com `{ codigo: 'NAO_AUTENTICADO' }` é da guarda de contexto (T9), que ainda não existe.
 * O que os casos afirmam, então, é o par: a sonda **identifica a pessoa** antes, e **não identifica
 * ninguém** depois — com a contagem no banco discriminando "invalidou" de "mandou o navegador
 * esquecer o cookie".
 *
 * ---------------------------------------------------------------------------
 * De onde vêm o banco, a fila e a credencial (ADR-0006)
 * ---------------------------------------------------------------------------
 *
 * De instâncias efêmeras próprias. O banco vem de `packages/auth/test/identidade-efemera.ts`, que é
 * o helper canônico de identidade migrada: ele envolve o banco efêmero da fatia, aplica as
 * migrações e semeia a carga **com a função de derivação do próprio arcabouço** — a credencial
 * nasce pelo caminho de produção, e não de uma cadeia forjada em `identidade.conta`. O acesso
 * restrito que ele devolve é usado aqui **apenas para observar** o estado persistido; a instância
 * do arcabouço que ele monta não é usada por caso nenhum, porque a instância sob prova é a que a
 * aplicação real compõe.
 *
 * Nenhuma coordenada de conexão é lida do ambiente: o ambiente do processo é MONTADO a partir do
 * que os helpers devolvem.
 *
 * ---------------------------------------------------------------------------
 * Por que a porta é reservada, e não dinâmica
 * ---------------------------------------------------------------------------
 *
 * O arcabouço de identidade recusa requisição com cookie cuja `Origin` não seja a origem confiável,
 * e a origem confiável é derivada do endereço base que a composição monta a partir da porta
 * CONFIGURADA. Com `port: 0` a porta configurada e a porta real seriam diferentes, e os casos
 * precisariam declarar uma origem que o servidor não atende — provando o fluxo contra uma
 * configuração que a operação não tem. A porta é, então, reservada pelo mecanismo do projeto (trava
 * atômica em `packages/shared/test/efemero-comum.ts`) e usada nos dois lugares.
 *
 * ---------------------------------------------------------------------------
 * Cada caso arranja o próprio sujeito
 * ---------------------------------------------------------------------------
 *
 * Os três casos compartilham uma aplicação e uma instância de banco — subir uma por caso custaria
 * minutos e nada acrescentaria. O que **não** é compartilhado é o sujeito: cada caso usa uma pessoa
 * própria da carga e afirma a precondição que assume (quantas sessões ela tem antes, se está
 * ativa, a que empresa pertence). Referência herdada do arranjo de outro caso é literal disfarçado,
 * e uma corrupção do sujeito por um caso anterior tornaria a comparação constante contra si mesma.
 */

import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { EMPRESA_A, EMPRESA_B, esquemaIdentidade, SENHA_DA_CARGA } from '@sysloc/db';
import { CodigoErro, type Logger } from '@sysloc/shared';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
// DÉBITO COM GATILHO — D28 · F0/T5 · gatilho JÁ DISPARADO (F1/T2, 2026-08-02)
// (NÃO é uma `DECISÃO FECHADA`: ele agenda uma mudança, não protege o código abaixo.)
// O QUÊ: os imports a seguir atravessam a fronteira de `@sysloc/shared` e de `@sysloc/auth` por
//        CAMINHO DE ARQUIVO, fora do `exports` e do `files` daqueles manifestos. As dependências de
//        workspace estão declaradas, então não há dependência oculta; o que não existe é FRONTEIRA
//        para os diretórios `test/` — e este arquivo é o QUINTO consumidor a repetir o padrão.
// QUANDO FECHA: o gatilho já disparou e o fechamento segue pendente; ele é o mesmo de sempre —
//        declarar o subpath `"./test"` nos manifestos e importar por `@sysloc/shared/test` e
//        `@sysloc/auth/test`, ou extrair um `@sysloc/test-utils`.
// POR QUE NÃO AGORA: fechar exige editar os manifestos de dois pacotes e os cinco consumidores,
//        nenhum deles no escopo desta task, e o índice de débitos do `CLAUDE.md`. É pendência
//        escalada ao orquestrador, não decisão desta task.
// ÍNDICE: docs/specs/features/fundacao-stack-nativa/v1/_run/run-report.md §2, D28
import {
  type IdentidadeEfemera,
  identidadeEfemera,
  pessoaSemeada,
} from '../../../packages/auth/test/identidade-efemera.ts';
import { reservarPorta, sondarAte } from '../../../packages/shared/test/efemero-comum.ts';
import { type FilaEfemera, redisEfemero } from '../../../packages/shared/test/redis-efemero.ts';
import { PREFIXO_DAS_ROTAS_DE_IDENTIDADE } from '../src/autenticacao/autenticacao.module.ts';
import {
  ENDERECO_DE_ESCUTA,
  TOKEN_AUTENTICACAO,
  TOKEN_LOGGER,
} from '../src/configuracao/ambiente.ts';
import { criarAplicacao } from '../src/main.ts';

/** Limite da montagem: sobe banco migrado, semeia, sobe fila e sobe a aplicação real. */
const LIMITE_DE_MONTAGEM_MS = 180_000;

/** Limite de um caso que atravessa HTTP e banco várias vezes. */
const LIMITE_CASO_MS = 60_000;

/**
 * Teto da sondagem que espera a expiração persistida avançar depois de uma requisição autenticada.
 *
 * Constante nomeada no topo, e não número no meio do caso: é a política de flaky de
 * `.claude/rules/testing-stack.md` — espera por estado observável tem limite declarado, e nunca
 * `sleep` fixo.
 */
const LIMITE_DE_RENOVACAO_MS = 15_000;

/** Teto da sondagem que espera a expiração persistida ficar no passado. */
const LIMITE_DE_VENCIMENTO_MS = 15_000;

/** Sufixo do nome do cookie de sessão do arcabouço — o prefixo `__Secure-` depende da configuração. */
const SUFIXO_DO_COOKIE_DE_SESSAO = 'session_token';

/** Os três atributos de segurança exigidos da credencial de sessão (§11.1), nomeados. */
const ATRIBUTOS_EXIGIDOS = { httpOnly: true, secure: true, sameSite: 'Lax' } as const;

/**
 * Os endereços que `deploy/scripts/instalacao/verificar-fundacao.sh` consulta, escritos por extenso.
 *
 * Fonte externa de verdade, e a lista é comparada por IGUALDADE contra o que o script declara (ver
 * {@link enderecosConsultadosPeloVerificador}). A igualdade guarda os dois lados: se a extração do
 * script falhar, o conjunto obtido fica vazio e a comparação reprova; se o script ganhar um
 * endereço novo, a comparação reprova e obriga revisão — que é exatamente o momento em que alguém
 * precisa decidir se aquele endereço também fica fora do prefixo.
 */
const ENDERECOS_DA_FUNDACAO = ['/docs', '/docs/json', '/saude', '/saude/pronto'] as const;

/**
 * As rotas que a **§4.1 da tech spec DECLARA** sob `/v1/auth` — o contrato, e só ele.
 *
 * A tabela da §4.1 tem seis linhas sob este prefixo, e duas delas ("Verificar segundo fator" e
 * "Ativar segundo fator") são a MESMA rota exercitada em dois momentos do fluxo; por isso cinco
 * entradas, e não seis. A sétima linha da tabela, `GET /v1/sessao`, não mora sob `/v1/auth` e é da
 * T9.
 *
 * Escritas à mão de propósito, e separadas de {@link SUPERFICIE_TOLERADA}: é a distinção entre o
 * que o produto **prometeu** e o que a montagem por curinga **arrastou** junto. Derivar esta lista
 * do arcabouço destruiria a distinção — passaria a afirmar "o arcabouço publica o que o arcabouço
 * publica", que é verdade vazia.
 */
const SUPERFICIE_DECLARADA = [
  'POST /sign-in/email',
  'POST /sign-out',
  'POST /change-password',
  'POST /two-factor/enable',
  'POST /two-factor/verify-totp',
] as const;

/**
 * O que o curinga publica ALÉM do contrato, e que aceitamos hoje conscientemente.
 *
 * A §4.1 declara seis rotas; o `@All('*')` do encaminhador monta a superfície inteira do núcleo do
 * arcabouço mais a do plugin de segundo fator. Parte dela está inerte por configuração
 * (`disableSignUp`, ausência de provedor social, ausência de remetente de e-mail), mas
 * `update-user`, `change-password`, `verify-password`, `list-sessions`, `revoke-*`, `list-accounts`
 * e `account-info` **atendem com sessão válida** — é superfície viva.
 *
 * A lista existe para que o crescimento dela seja uma DECISÃO e não um efeito colateral: acrescentar
 * um plugin, ou subir a versão do arcabouço, reprova o CT-018 (d) nomeando o excedente, e quem
 * revisar decide se aquela rota entra no contrato, é desligada ou é tolerada. É a rede que a §11.1
 * da tech spec exige — *"um caso de teste enumera as rotas públicas efetivas e falha se a lista
 * crescer sem revisão"*.
 *
 * ---------------------------------------------------------------------------
 * DECISÃO (fechamento da F1, 2026-08-02 · decisão do usuário) — o conjunto é TOLERADO
 * ---------------------------------------------------------------------------
 *
 * As 35 abaixo são **toleradas**, e não pendentes. Antes desta linha elas eram aceitas por esta
 * constante sem que decisão nenhuma — ADR, seção de spec ou marcador — dissesse por quê; o débito
 * **D26** da §2 registrou que o congelamento da superfície chegaria por descoberta em vez de por
 * agendamento. A decisão foi tomada e é esta.
 *
 * **A razão é medida, e é de alcance — não de conveniência.** Nenhuma das 35 cruza tenant:
 *
 *   * as perigosas estão **inertes por configuração** e recusam antes de qualquer efeito —
 *     `sign-up/email` (`disableSignUp`), `sign-in/social` e `link-social` (nenhum provedor social
 *     declarado), `request-password-reset`/`send-verification-email` (nenhum remetente de e-mail),
 *     `change-email` e `delete-user` (opção não passada);
 *   * as **vivas** — `update-user`, `verify-password`, `list-sessions`, `revoke-*`,
 *     `list-accounts`, `account-info` — são de identidade da PRÓPRIA pessoa, autoescopadas pela
 *     sessão dela. O que a sessão não alcança é exatamente o que a RLS protege, e nenhum dado de
 *     `negocio` é alcançável por elas.
 *
 * **As duas alternativas foram consideradas e recusadas.** Declará-las no contrato publicaria como
 * API rotas que este produto não oferece. Desligá-las por lista de permissão no encaminhador
 * reintroduz a enumeração à mão que a T8 rejeitou por escrito — *"uma lista que o arcabouço já tem,
 * e que envelheceria a cada versão dele"* —, trocando um risco nulo hoje por um vetor de regressão
 * a cada bump.
 *
 * **GATILHO DE REVISÃO** (não é decisão fechada — isto vence): a decisão vale **até o congelamento
 * da superfície da API**, imediatamente antes de publicar `@sysloc/contracts` e gerar o
 * `handoff-frontend.md`. Ali cada uma volta à mesa com a pergunta *"o cliente React chama isto?"*,
 * e a resposta esperada, para as 35, é não. Quem congelar reavalia; quem só passar por aqui, não
 * precisa.
 */
const SUPERFICIE_TOLERADA = [
  'GET /account-info',
  'GET /callback/:id',
  'GET /delete-user/callback',
  'GET /error',
  'GET /get-session',
  'GET /list-accounts',
  'GET /list-sessions',
  'GET /ok',
  'GET /reset-password/:token',
  'GET /verify-email',
  'POST /callback/:id',
  'POST /change-email',
  'POST /delete-user',
  'POST /get-access-token',
  'POST /get-session',
  'POST /link-social',
  'POST /refresh-token',
  'POST /request-password-reset',
  'POST /reset-password',
  'POST /revoke-other-sessions',
  'POST /revoke-session',
  'POST /revoke-sessions',
  'POST /send-verification-email',
  'POST /sign-in/social',
  'POST /sign-up/email',
  'POST /two-factor/disable',
  'POST /two-factor/generate-backup-codes',
  'POST /two-factor/get-totp-uri',
  'POST /two-factor/send-otp',
  'POST /two-factor/verify-backup-code',
  'POST /two-factor/verify-otp',
  'POST /unlink-account',
  'POST /update-session',
  'POST /update-user',
  'POST /verify-password',
] as const;

/**
 * Rota do inventário usada como âncora comportamental — pública, sem efeito e sem corpo.
 *
 * Serve para amarrar a enumeração ao roteamento REAL: sem ela, o caso provaria apenas que o
 * registro de pontas do arcabouço tem certo conteúdo, e não que aquele conteúdo é o que de fato
 * atende sob `/v1/auth`.
 */
const ANCORA_PUBLICA_DO_INVENTARIO = 'GET /ok';

/** Âncora do outro eixo: rota do inventário que existe e recusa sem sessão — existe ≠ responde. */
const ANCORA_AUTENTICADA_DO_INVENTARIO = 'POST /update-user';

/** Caminho que NÃO está no inventário — o companheiro negativo das duas âncoras. */
const CAMINHO_FORA_DO_INVENTARIO = '/rota-que-o-arcabouco-nao-publica';

/**
 * Tipo de conteúdo que o adaptador HTTP interpreta e o roteador do arcabouço RECUSA.
 *
 * O arcabouço aceita apenas `application/json` (`allowedMediaTypes` do roteador) e responde `415`
 * a qualquer outro — status que a tabela de código por status do filtro global não conhece. É o
 * gatilho legítimo do CT-018 (e): um status de recusa produzido pelo arcabouço, sem nenhum
 * artifício, sem tocar código de produção e sem depender do limitador nativo (desligado).
 */
const TIPO_DE_CONTEUDO_RECUSADO = 'text/plain';

/** O status que aquele tipo de conteúdo provoca — fora de `CODIGO_POR_STATUS` do filtro global. */
const STATUS_FORA_DA_TABELA = 415;

/** Trechos que o verificador shell procura no corpo das duas rotas de saúde. */
const CORPO_DA_SAUDE_RASA = '"estado":"disponivel"';
const CORPO_DA_SAUDE_PROFUNDA = ['"banco":"disponivel"', '"fila":"disponivel"'] as const;

const RAIZ_DO_REPOSITORIO = fileURLToPath(new URL('../../..', import.meta.url));
const VERIFICADOR_DA_FUNDACAO = `${RAIZ_DO_REPOSITORIO}deploy/scripts/instalacao/verificar-fundacao.sh`;

/** As duas pessoas do CT-018 — uma por empresa, para que "fixa a empresa dela" tenha dois lados. */
const PESSOA_DE_A = pessoaSemeada('usuario.a@exemplo.com.br');
const PESSOA_DE_B = pessoaSemeada('usuario.b1@exemplo.com.br');

/** Sujeito exclusivo do CT-023: encerrar a sessão dele não pode mexer na contagem de outro caso. */
const PESSOA_DO_ENCERRAMENTO = pessoaSemeada('admin.a@exemplo.com.br');

/** Sujeito exclusivo do CT-024. */
const PESSOA_DA_EXPIRACAO = pessoaSemeada('admin.b@exemplo.com.br');

/**
 * Sujeito exclusivo do CT-018 (c) — a única pessoa da carga contra quem uma senha ERRADA é
 * informada. Exclusiva de propósito: a tentativa incorreta incrementa o contador de bloqueio dela,
 * e emprestar o sujeito de outro caso faria o número que aquele caso afirma depender da ordem.
 */
const PESSOA_DA_RECUSA = pessoaSemeada('usuario.b2@exemplo.com.br');

let identidade: IdentidadeEfemera;
let fila: FilaEfemera;
let app: NestFastifyApplication;
let base: string;
let ambienteAnterior: NodeJS.ProcessEnv;

beforeAll(async () => {
  identidade = await identidadeEfemera();
  fila = await redisEfemero();

  const porta = await reservarPorta();
  base = `http://${ENDERECO_DE_ESCUTA}:${String(porta)}`;

  ambienteAnterior = { ...process.env };
  process.env.NODE_ENV = 'test';
  process.env.PORT = String(porta);
  // O registro estruturado sai pela saída padrão do processo de verificação; nenhum caso deste
  // arquivo assere sobre ele, e as linhas se misturariam ao relatório do arcabouço. Quem prova a
  // ausência de segredo no registro é o CT-029, da T9, que aponta o registrador a arquivo próprio.
  process.env.LOG_LEVEL = 'fatal';
  process.env.DATABASE_URL = identidade.banco.cadeiaConexao;
  process.env.REDIS_URL = fila.cadeiaConexao;
  // Sorteado por execução, como as demais credenciais efêmeras: vive na memória deste processo e
  // morre com ele.
  process.env.BETTER_AUTH_SECRET = randomBytes(32).toString('base64url');

  app = await criarAplicacao();
  await app.listen({ port: porta, host: ENDERECO_DE_ESCUTA });
}, LIMITE_DE_MONTAGEM_MS);

afterAll(async () => {
  await app?.close();
  await fila?.parar();
  await identidade?.parar();

  for (const nome of [
    'NODE_ENV',
    'PORT',
    'LOG_LEVEL',
    'DATABASE_URL',
    'REDIS_URL',
    'BETTER_AUTH_SECRET',
  ]) {
    const valor = ambienteAnterior?.[nome];
    if (valor === undefined) {
      delete process.env[nome];
    } else {
      process.env[nome] = valor;
    }
  }
}, LIMITE_DE_MONTAGEM_MS);

describe('superfície versionada de identidade (T8)', () => {
  it(
    'CT-018 — a entrada com credencial correta identifica a pessoa e fixa a empresa dela na sessão',
    async () => {
      // Precondição afirmada, nunca herdada: as duas pessoas estão ativas, em empresas distintas,
      // e nenhuma delas tem sessão antes deste caso.
      const antesDeA = await pessoaPersistida(PESSOA_DE_A.id);
      const antesDeB = await pessoaPersistida(PESSOA_DE_B.id);
      expect(antesDeA).toEqual({ ativo: true, empresaId: EMPRESA_A.id });
      expect(antesDeB).toEqual({ ativo: true, empresaId: EMPRESA_B.id });
      expect(await sessoesDe(PESSOA_DE_A.id)).toHaveLength(0);
      expect(await sessoesDe(PESSOA_DE_B.id)).toHaveLength(0);

      const entradaDeA = await pedir('/v1/auth/sign-in/email', {
        metodo: 'POST',
        corpo: { email: PESSOA_DE_A.email, password: SENHA_DA_CARGA },
      });

      expect(entradaDeA.status).toBe(200);

      // Eixo positivo do par de cookies: sem ele, uma resposta SEM cookie algum passaria a
      // comparação seguinte por vacuidade.
      expect(entradaDeA.cookies.length).toBeGreaterThan(0);
      // Cada cookie da resposta carrega o trio — não só o de sessão: um cookie auxiliar emitido sem
      // `Secure` viajaria em claro pelo mesmo canal.
      expect(entradaDeA.cookies.map(atributosDeSeguranca)).toEqual(
        entradaDeA.cookies.map(() => ATRIBUTOS_EXIGIDOS),
      );
      expect(
        entradaDeA.cookies.find((cookie) =>
          nomeDoCookie(cookie).endsWith(SUFIXO_DO_COOKIE_DE_SESSAO),
        ),
      ).toBeDefined();

      // O cookie devolvido é REENVIADO como qualquer cliente faria — nada é forjado.
      const cookieDeA = credencialDeSessao(entradaDeA);
      const sondaDeA = await pedir('/v1/auth/get-session', { cookie: cookieDeA });

      expect(sondaDeA.status).toBe(200);
      expect(usuarioDaSonda(sondaDeA)).toEqual({
        id: PESSOA_DE_A.id,
        email: PESSOA_DE_A.email,
      });

      // A sessão persistida está presa à pessoa certa — e, por ela, à empresa dela. É o que
      // "a sessão fixa a empresa de quem entrou" significa nesta camada: não há outra origem para
      // o vínculo além da linha de `identidade.usuario` que a sessão aponta (ADR-0008, invariante 2).
      const sessoesDeA = await sessoesDe(PESSOA_DE_A.id);
      expect(sessoesDeA).toHaveLength(1);
      expect(await empresaDaSessao(sessoesDeA[0]?.token ?? '')).toBe(EMPRESA_A.id);

      // O outro lado: a MESMA rota, com a credencial de uma pessoa da outra empresa, produz sessão
      // presa à OUTRA empresa. Sem este par, "fixa a empresa" não distingue vínculo real de
      // constante — uma implementação que gravasse sempre a empresa A passaria a metade de cima.
      const entradaDeB = await pedir('/v1/auth/sign-in/email', {
        metodo: 'POST',
        corpo: { email: PESSOA_DE_B.email, password: SENHA_DA_CARGA },
      });
      expect(entradaDeB.status).toBe(200);

      const sondaDeB = await pedir('/v1/auth/get-session', {
        cookie: credencialDeSessao(entradaDeB),
      });
      expect(sondaDeB.status).toBe(200);
      expect(usuarioDaSonda(sondaDeB)).toEqual({
        id: PESSOA_DE_B.id,
        email: PESSOA_DE_B.email,
      });

      const sessoesDeB = await sessoesDe(PESSOA_DE_B.id);
      expect(sessoesDeB).toHaveLength(1);
      expect(await empresaDaSessao(sessoesDeB[0]?.token ?? '')).toBe(EMPRESA_B.id);
      expect(EMPRESA_A.id).not.toBe(EMPRESA_B.id);

      // E o cookie de uma não vale pela outra: cada credencial identifica exatamente a sua pessoa.
      expect(cookieDeA).not.toBe(credencialDeSessao(entradaDeB));
    },
    LIMITE_CASO_MS,
  );

  it(
    'CT-018 (c) — a recusa da entrada sai no envelope da ADR-0007, e nenhuma sessão nasce',
    async () => {
      // Companheiro negativo do CT-018 **dentro desta task**: sem ele, o caminho que converte a
      // recusa do arcabouço no envelope canônico — a razão de o controlador levantar exceção em vez
      // de repassar a resposta dele — ficaria sem prova nenhuma até a T11. O eixo que a T11 traz é
      // OUTRO: lá se compara a recusa das QUATRO causas entre si (RN-10); aqui se prova a FORMA de
      // uma delas.
      expect(await sessoesDe(PESSOA_DA_RECUSA.id)).toHaveLength(0);

      const recusa = await pedir('/v1/auth/sign-in/email', {
        metodo: 'POST',
        corpo: { email: PESSOA_DA_RECUSA.email, password: `${SENHA_DA_CARGA}-errada` },
      });

      expect(recusa.status).toBe(401);
      // Objeto inteiro, e não presença de campos: o formato do arcabouço (`{ code, message }`, em
      // inglês) passaria numa asserção que só conferisse o status, e é justamente ele que a
      // ADR-0007 existe para não deixar sair.
      expect(recusa.corpo).toEqual({
        codigo: CodigoErro.CREDENCIAL_INVALIDA,
        mensagem: 'credencial inválida',
      });
      // Nada do vocabulário do arcabouço atravessa.
      expect(recusa.texto).not.toContain('INVALID_EMAIL_OR_PASSWORD');
      expect(recusa.texto).not.toContain('Invalid email or password');
      // Nem cookie, nem sessão: a recusa não pode deixar credencial para trás.
      expect(recusa.cookies).toEqual([]);
      expect(await sessoesDe(PESSOA_DA_RECUSA.id)).toHaveLength(0);
    },
    LIMITE_CASO_MS,
  );

  it(
    'CT-018 (b) — os endereços da fundação continuam fora do prefixo, e a identidade só existe com ele',
    async () => {
      // A lista esperada é confrontada com o que o verificador shell DE FATO consulta: ele é o
      // conjunto de asserções que o prefixo tornaria vermelho, e é dele que a exclusão em `main.ts`
      // tira a razão de existir.
      expect(enderecosConsultadosPeloVerificador()).toEqual([...ENDERECOS_DA_FUNDACAO]);

      for (const endereco of ENDERECOS_DA_FUNDACAO) {
        const resposta = await pedir(endereco);
        expect(resposta.status, `${endereco} deixou de responder 200`).toBe(200);
      }

      // O corpo, e não só o código: o verificador shell procura estes trechos literais, e um `200`
      // com corpo trocado passaria numa asserção que só olhasse o status.
      expect((await pedir('/saude')).texto).toContain(CORPO_DA_SAUDE_RASA);
      const profunda = await pedir('/saude/pronto');
      for (const trecho of CORPO_DA_SAUDE_PROFUNDA) {
        expect(profunda.texto).toContain(trecho);
      }

      // Companheiro negativo: a versão prefixada NÃO existe. Sem ele, um serviço que respondesse
      // nos dois endereços passaria a metade de cima e a exclusão não estaria provando nada.
      for (const endereco of ENDERECOS_DA_FUNDACAO) {
        const prefixado = await pedir(`/v1${endereco}`);
        expect(prefixado.status, `/v1${endereco} não devia existir`).toBe(404);
      }

      // Controle na direção oposta — sem ele, "excluir tudo do prefixo" também passaria: a
      // superfície de identidade existe SOMENTE sob o prefixo.
      expect(PREFIXO_DAS_ROTAS_DE_IDENTIDADE).toBe('/v1/auth');
      expect((await pedir('/v1/auth/get-session')).status).toBe(200);
      expect((await pedir('/auth/get-session')).status).toBe(404);
    },
    LIMITE_CASO_MS,
  );

  it(
    'CT-018 (d) — o inventário das rotas publicadas sob o prefixo é exatamente o conjunto aceito',
    async () => {
      const aceita: string[] = [...SUPERFICIE_DECLARADA, ...SUPERFICIE_TOLERADA];
      aceita.sort();
      const efetiva = superficieEfetiva();

      // Eixo do CONTRATO, primeiro e separado: as rotas da §4.1 continuam publicadas. Sem ele, um
      // arcabouço desligado por inteiro passaria na igualdade abaixo bastando encolher a constante
      // junto — a igualdade sozinha prova estabilidade, não cumprimento da promessa.
      for (const rota of SUPERFICIE_DECLARADA) {
        expect(
          efetiva,
          `rota da §4.1 sumiu de ${PREFIXO_DAS_ROTAS_DE_IDENTIDADE}: ${rota}`,
        ).toContain(rota);
      }

      // Eixo do INVENTÁRIO, com as diferenças nomeadas nos DOIS sentidos. Nomear importa: a
      // mensagem da falha é o que faz quem revisar saber se acrescentou rota sem querer (excedente)
      // ou removeu superfície que alguém já usava (ausente) — a igualdade crua diria só "não bate".
      const excedentes = efetiva.filter((rota) => !aceita.includes(rota));
      const ausentes = aceita.filter((rota) => !efetiva.includes(rota));

      expect(
        excedentes,
        `rotas NÃO revisadas apareceram sob ${PREFIXO_DAS_ROTAS_DE_IDENTIDADE}: ${excedentes.join(', ')}`,
      ).toEqual([]);
      expect(
        ausentes,
        `rotas do conjunto aceito sumiram de ${PREFIXO_DAS_ROTAS_DE_IDENTIDADE}: ${ausentes.join(', ')}`,
      ).toEqual([]);
      expect(efetiva).toEqual(aceita);

      // Âncora comportamental — é ela que impede o caso de virar auditoria do registro de pontas
      // do arcabouço contra si mesmo. Uma rota do inventário RESPONDE (não é `404`), e um caminho
      // fora dele NÃO responde: a enumeração e o roteamento real ficam amarrados.
      expect(efetiva).toContain(ANCORA_PUBLICA_DO_INVENTARIO);
      expect(efetiva).toContain(ANCORA_AUTENTICADA_DO_INVENTARIO);

      const publica = partesDaRota(ANCORA_PUBLICA_DO_INVENTARIO);
      expect((await pedir(publica.caminho, { metodo: publica.metodo })).status).toBe(200);

      // A âncora autenticada prova o que a §4.1 não declara e o inventário tolera: a rota está
      // MONTADA (não é `404`) e recusa quem não tem sessão. É a superfície viva que o curinga
      // arrastou, e é por isso que o conjunto tolerado precisa de revisão para crescer.
      const autenticada = partesDaRota(ANCORA_AUTENTICADA_DO_INVENTARIO);
      const semSessao = await pedir(autenticada.caminho, {
        metodo: autenticada.metodo,
        corpo: { nome: 'irrelevante' },
      });
      expect(semSessao.status).not.toBe(404);
      expect(semSessao.status).toBe(401);

      const fora = await pedir(`${PREFIXO_DAS_ROTAS_DE_IDENTIDADE}${CAMINHO_FORA_DO_INVENTARIO}`, {
        metodo: 'POST',
        corpo: {},
      });
      expect(fora.status).toBe(404);
    },
    LIMITE_CASO_MS,
  );

  it(
    'CT-018 (e) — recusa com status fora da tabela preserva o status e não vira falha do serviço',
    async () => {
      // O registrador é o MESMO objeto que o filtro global recebe por injeção — não um dublê
      // instalado no lugar dele. O que se observa aqui é, literalmente, a linha que iria para o
      // journal, e é esse artefato que a `DECISÃO FECHADA — T6 / Gate 2 (P5)` nomeia como "aquele
      // que a operação lê para decidir se houve ataque".
      const logger = app.get<Logger>(TOKEN_LOGGER);
      const comoFalhaDoServico = vi.spyOn(logger, 'error');
      const comoRecusa = vi.spyOn(logger, 'warn');

      try {
        const recusa = await pedir('/v1/auth/sign-in/email', {
          metodo: 'POST',
          corpoBruto: {
            texto: 'isto não é JSON',
            tipoDeConteudo: TIPO_DE_CONTEUDO_RECUSADO,
          },
        });

        // --- eixo do cliente: o status de quem recusou é preservado -------------------------
        expect(recusa.status).toBe(STATUS_FORA_DA_TABELA);
        expect(recusa.corpo).toEqual({
          codigo: CodigoErro.REQUISICAO_RECUSADA,
          mensagem: 'requisição recusada',
        });
        // Companheiro negativo explícito, e não implícito na igualdade acima: é ESTE par que
        // reprova se a classificação por faixa for desfeita e o status voltar a ser re-derivado.
        expect(recusa.status).not.toBe(500);
        expect(recusa.texto).not.toContain(CodigoErro.ERRO_INTERNO);
        // Nada do vocabulário do arcabouço atravessa, como em toda outra recusa.
        expect(recusa.texto).not.toContain('UNSUPPORTED_MEDIA_TYPE');

        // --- eixo do journal: a linha fala de recusa, nunca de falha do serviço --------------
        expect(comoFalhaDoServico).not.toHaveBeenCalled();
        expect(comoRecusa).toHaveBeenCalledTimes(1);

        const evento = comoRecusa.mock.calls[0]?.[0] as Record<string, unknown>;
        expect(comoRecusa.mock.calls[0]?.[1]).toBe('requisição recusada');
        expect(Object.keys(evento).sort()).toEqual([
          'caminho',
          'codigo',
          'erro',
          'idCorrelacao',
          'metodo',
          'status',
        ]);
        expect(evento.status).toBe(STATUS_FORA_DA_TABELA);
        expect(evento.codigo).toBe(CodigoErro.REQUISICAO_RECUSADA);
        expect(evento.metodo).toBe('POST');
        // SUT_IS_CORRECT_BECAUSE: esta asserção fixava `/v1/auth/*` — o padrão que o roteador casa
        // para TODA a superfície de identidade, porque o encaminhador é `@All('*')`. O valor estava
        // certo para o SUT de então e é o defeito que o débito D27 registra: o operador não
        // distinguia uma tentativa de entrada de qualquer outra recusa daquele prefixo, degradando
        // o artefato que a `DECISÃO FECHADA — T6 / Gate 2 (P5)` nomeia como "aquele que a operação
        // lê para decidir se houve ataque". O fechamento da F1 fez o encaminhador declarar a rota
        // real quando ela é um padrão LITERAL do registro do arcabouço, e a asserção passa a fixar
        // o comportamento novo. Ela não afrouxou: era uma igualdade e continua sendo, agora contra
        // um valor mais específico, com o companheiro negativo abaixo.
        expect(evento.caminho).toBe(`${PREFIXO_DAS_ROTAS_DE_IDENTIDADE}/sign-in/email`);
        expect(evento.caminho).not.toBe(`${PREFIXO_DAS_ROTAS_DE_IDENTIDADE}/*`);
      } finally {
        comoFalhaDoServico.mockRestore();
        comoRecusa.mockRestore();
      }
    },
    LIMITE_CASO_MS,
  );

  it(
    'CT-106 — rota com segmento variável NÃO leva o valor do segmento ao journal',
    async () => {
      // O companheiro do eixo de journal do CT-018 (e), e o que torna o rótulo de rota seguro por
      // construção: o encaminhador só declara a rota quando o padrão é LITERAL. Padrão com `:` fica
      // de fora, e a linha sai com o curinga — que é o comportamento anterior ao débito D27 e o
      // desfecho seguro. Sem este caso, um "melhoramento" futuro que casasse padrões parametrizados
      // publicaria o token de redefinição no artefato que a operação lê, e nada reprovaria.
      const logger = app.get<Logger>(TOKEN_LOGGER);
      const comoRecusa = vi.spyOn(logger, 'warn');
      const comoFalhaDoServico = vi.spyOn(logger, 'error');

      try {
        // Valor distinguível de qualquer outro texto do evento: se ele aparecer em QUALQUER campo
        // da linha, a asserção abaixo o encontra.
        const segmento = 'valor-de-segmento-que-nao-pode-vazar';
        // A recusa é forçada pelo MESMO mecanismo do CT-018 (e) — tipo de conteúdo que o arcabouço
        // não aceita —, e não pela reação da rota ao segmento: depender de a rota recusar por conta
        // própria tornaria o caso refém do comportamento de uma rota que nem sequer está
        // configurada (sem provedor social, `/callback/:id` responde por redirecionamento e não
        // produziria linha de journal alguma).
        await pedir(`${PREFIXO_DAS_ROTAS_DE_IDENTIDADE}/callback/${segmento}`, {
          metodo: 'POST',
          corpoBruto: { texto: 'isto não é JSON', tipoDeConteudo: TIPO_DE_CONTEUDO_RECUSADO },
        });

        const linhas = [...comoRecusa.mock.calls, ...comoFalhaDoServico.mock.calls];

        // Guarda de conjunto vazio: sem linha de journal o caso não observa nada, e passaria por
        // vacuidade. Se o arcabouço deixar de recusar esta rota, isto reprova e obriga revisão.
        expect(
          linhas.length,
          'a rota parametrizada não produziu linha de journal — o caso não observa nada',
        ).toBeGreaterThan(0);

        for (const [evento] of linhas) {
          const registrado = evento as Record<string, unknown>;
          expect(registrado.caminho).toBe(`${PREFIXO_DAS_ROTAS_DE_IDENTIDADE}/*`);
          // Sobre a linha INTEIRA, e não só sobre `caminho`: o eixo é "o valor não vaza", e
          // restringi-lo a um campo deixaria os outros sem asserção.
          expect(JSON.stringify(registrado)).not.toContain(segmento);
        }
      } finally {
        comoRecusa.mockRestore();
        comoFalhaDoServico.mockRestore();
      }
    },
    LIMITE_CASO_MS,
  );

  it(
    'CT-023 — encerrar a sessão invalida o acesso imediatamente, e a recusa é indistinguível',
    async () => {
      expect(await sessoesDe(PESSOA_DO_ENCERRAMENTO.id)).toHaveLength(0);

      const entrada = await pedir('/v1/auth/sign-in/email', {
        metodo: 'POST',
        corpo: { email: PESSOA_DO_ENCERRAMENTO.email, password: SENHA_DA_CARGA },
      });
      expect(entrada.status).toBe(200);
      const cookie = credencialDeSessao(entrada);

      // Antes: a sonda autenticada identifica a pessoa, e há exatamente uma linha no banco.
      const antes = await pedir('/v1/auth/get-session', { cookie });
      expect(antes.status).toBe(200);
      expect(usuarioDaSonda(antes)).toEqual({
        id: PESSOA_DO_ENCERRAMENTO.id,
        email: PESSOA_DO_ENCERRAMENTO.email,
      });
      expect(await sessoesDe(PESSOA_DO_ENCERRAMENTO.id)).toHaveLength(1);

      const saida = await pedir('/v1/auth/sign-out', { metodo: 'POST', cookie });
      expect(saida.status).toBe(200);

      // Depois: o MESMO cookie não identifica mais ninguém...
      const depois = await pedir('/v1/auth/get-session', { cookie });
      expect(depois.corpo).toBeNull();

      // ...e a linha SUMIU do banco. Esta é a asserção que distingue "invalidou" de "apenas mandou
      // o navegador esquecer o cookie": a segunda passaria na asserção de corpo acima e deixaria a
      // sessão viva para quem guardou o valor do cookie.
      expect(await sessoesDe(PESSOA_DO_ENCERRAMENTO.id)).toHaveLength(0);

      // E a recusa é a mesma de um cookie que nunca correspondeu a sessão alguma (RN-10): campo a
      // campo, sem nada que revele que aquele token um dia existiu.
      const inexistente = await pedir('/v1/auth/get-session', {
        cookie: `${nomeDoCookie(cookie)}=token-que-nunca-existiu`,
      });
      expect(inexistente.status).toBe(depois.status);
      expect(inexistente.texto).toBe(depois.texto);
      expect(inexistente.tipoDeConteudo).toBe(depois.tipoDeConteudo);
    },
    LIMITE_CASO_MS,
  );

  it(
    'CT-024 — atividade renova a sessão; passada a expiração, o mesmo cookie é recusado',
    async () => {
      expect(await sessoesDe(PESSOA_DA_EXPIRACAO.id)).toHaveLength(0);

      const entrada = await pedir('/v1/auth/sign-in/email', {
        metodo: 'POST',
        corpo: { email: PESSOA_DA_EXPIRACAO.email, password: SENHA_DA_CARGA },
      });
      expect(entrada.status).toBe(200);
      const cookie = credencialDeSessao(entrada);

      const [sessaoInicial] = await sessoesDe(PESSOA_DA_EXPIRACAO.id);
      expect(sessaoInicial).toBeDefined();
      const token = sessaoInicial?.token ?? '';
      const expiracaoInicial = sessaoInicial?.expiraEm.getTime() ?? 0;

      // --- eixo positivo: atividade DENTRO do prazo renova a expiração persistida ---------------
      //
      // A sondagem existe porque a renovação escreve `agora + validade`, e duas escritas no mesmo
      // milissegundo produzem o mesmo instante: o que se espera não é tempo, é o ESTADO observável
      // "a expiração avançou". Cada volta faz uma requisição autenticada de verdade — nenhuma
      // espera de tempo fixo aparece aqui.
      await sondarAte(
        'a expiração persistida avançar após atividade dentro do prazo',
        async () => {
          const sonda = await pedir('/v1/auth/get-session', { cookie });
          expect(sonda.status).toBe(200);
          expect(usuarioDaSonda(sonda)).toEqual({
            id: PESSOA_DA_EXPIRACAO.id,
            email: PESSOA_DA_EXPIRACAO.email,
          });
          return (await expiracaoDe(token)).getTime() > expiracaoInicial;
        },
        LIMITE_DE_RENOVACAO_MS,
      );

      const renovada = await expiracaoDe(token);
      expect(renovada.getTime()).toBeGreaterThan(expiracaoInicial);
      // O eixo é obrigatório: um serviço que expirasse a sessão em tempo absoluto desde a criação,
      // sem renovar por atividade, passaria o eixo negativo abaixo e violaria a RN-07 em silêncio.

      // --- eixo negativo: passada a expiração, o mesmo cookie é recusado -------------------------
      //
      // O decurso é imposto pelo CAMINHO DE ESCRITA DO PRÓPRIO ARCABOUÇO — o adaptador interno que
      // a renovação acima acabou de usar —, e não por SQL escrito à mão nem por relógio falso. É a
      // via legítima que a §7 desta task nomeia. A alternativa "instanciar com validade curta" não
      // existe sem acrescentar uma bandeira de sessão curta a `packages/auth/src/**`, que o próprio
      // caso proíbe: a validade é configuração da instância de produção (8 h, ancorada em
      // `packages/auth/test/sessao.spec.ts`), não parâmetro de chamada.
      const contexto = await app.get<{ $context: Promise<ContextoDoArcabouco> }>(TOKEN_AUTENTICACAO)
        .$context;
      await contexto.internalAdapter.updateSession(token, {
        expiresAt: new Date(Date.now() - LIMITE_DE_VENCIMENTO_MS),
      });

      await sondarAte(
        'a expiração persistida ficar no passado',
        async () => (await expiracaoDe(token)).getTime() < Date.now(),
        LIMITE_DE_VENCIMENTO_MS,
      );

      const vencida = await pedir('/v1/auth/get-session', { cookie });
      expect(vencida.corpo).toBeNull();

      // --- e a nova entrada funciona: a recusa é da sessão vencida, não da conta ----------------
      const reentrada = await pedir('/v1/auth/sign-in/email', {
        metodo: 'POST',
        corpo: { email: PESSOA_DA_EXPIRACAO.email, password: SENHA_DA_CARGA },
      });
      expect(reentrada.status).toBe(200);

      const cookieNovo = credencialDeSessao(reentrada);
      expect(cookieNovo).not.toBe(cookie);

      const apos = await pedir('/v1/auth/get-session', { cookie: cookieNovo });
      expect(apos.status).toBe(200);
      expect(usuarioDaSonda(apos)).toEqual({
        id: PESSOA_DA_EXPIRACAO.id,
        email: PESSOA_DA_EXPIRACAO.email,
      });

      const tokensAgora = (await sessoesDe(PESSOA_DA_EXPIRACAO.id)).map((linha) => linha.token);
      expect(tokensAgora).not.toContain(token);
      expect(tokensAgora.length).toBeGreaterThan(0);
    },
    LIMITE_CASO_MS,
  );
});

/**
 * O mínimo de uma **ponta** do arcabouço que a enumeração precisa ler.
 *
 * Estrutural, e não o tipo publicado: o registro de pontas é tipado com uma entrada por rota, e
 * escrever esse tipo aqui seria copiar a lista que o caso existe para conferir.
 */
interface PontaDoArcabouco {
  readonly path?: string | undefined;
  readonly options?:
    | {
        readonly method?: string | readonly string[] | undefined;
        readonly metadata?: { readonly SERVER_ONLY?: boolean | undefined } | undefined;
      }
    | undefined;
}

/**
 * A superfície EFETIVA sob o prefixo de identidade, obtida do manipulador — nunca escrita à mão.
 *
 * A fonte é o **registro de pontas da instância que a aplicação compõe** (`api`), que é exatamente
 * o objeto que o arcabouço entrega ao roteador. As três exclusões aplicadas abaixo são, literalmente,
 * as do roteador (`createRouter` de `better-call` 1.3.7, consumido por `better-auth@1.6.25`):
 * ponta sem opções ou sem caminho não vira rota, e ponta marcada `SERVER_ONLY` é deliberadamente
 * mantida fora do roteador — só alcançável por chamada de servidor.
 *
 * Reproduzir essas três linhas é o preço de enumerar sem subir uma requisição por rota candidata; o
 * que impede o caso de virar auditoria de si mesmo é a **âncora comportamental** do CT-018 (d), que
 * confronta a lista com o roteamento real nos dois sentidos.
 */
function superficieEfetiva(): string[] {
  const registro = app.get<{ readonly api: Record<string, PontaDoArcabouco | undefined> }>(
    TOKEN_AUTENTICACAO,
  ).api;
  const rotas = new Set<string>();

  for (const ponta of Object.values(registro)) {
    if (ponta?.options === undefined || ponta.path === undefined || ponta.path.length === 0) {
      continue;
    }
    if (ponta.options.metadata?.SERVER_ONLY === true) {
      continue;
    }

    const declarado = ponta.options.method;
    const metodos = typeof declarado === 'string' ? [declarado] : (declarado ?? []);
    for (const metodo of metodos) {
      rotas.add(`${metodo} ${ponta.path}`);
    }
  }

  return [...rotas].sort();
}

/** Quebra uma entrada do inventário (`MÉTODO /caminho`) no par que o pedido HTTP consome. */
function partesDaRota(rota: string): { metodo: string; caminho: string } {
  const [metodo = '', caminho = ''] = rota.split(' ');
  return { metodo, caminho: `${PREFIXO_DAS_ROTAS_DE_IDENTIDADE}${caminho}` };
}

/** O mínimo do contexto do arcabouço que este arquivo consome. */
interface ContextoDoArcabouco {
  readonly internalAdapter: {
    updateSession(token: string, dados: { expiresAt: Date }): Promise<unknown>;
  };
}

interface Resposta {
  readonly status: number;
  readonly texto: string;
  readonly corpo: unknown;
  readonly tipoDeConteudo: string;
  readonly cookies: readonly string[];
}

interface OpcoesDoPedido {
  readonly metodo?: string;
  readonly corpo?: Record<string, unknown>;
  readonly cookie?: string;
  /**
   * Corpo enviado LITERALMENTE, com o tipo de conteúdo declarado.
   *
   * Existe para o CT-018 (e), que precisa de um tipo de conteúdo que o arcabouço recusa — algo que
   * o caminho de {@link OpcoesDoPedido.corpo} não pode produzir, porque ele sempre declara JSON.
   */
  readonly corpoBruto?: { readonly texto: string; readonly tipoDeConteudo: string };
}

/**
 * Executa uma requisição HTTP real contra a aplicação.
 *
 * O cabeçalho `Origin` acompanha toda requisição, com a MESMA origem que a composição entrega ao
 * arcabouço — é o que um navegador na origem do serviço enviaria, e é o que o arcabouço confere nas
 * requisições que carregam cookie. Ele é composto da mesma fonte que o endereço base, e não escrito
 * à mão: um literal aqui poderia divergir da configuração e o caso passaria a provar outra coisa.
 */
async function pedir(caminho: string, opcoes: OpcoesDoPedido = {}): Promise<Resposta> {
  const cabecalhos: Record<string, string> = { connection: 'close', origin: base };
  if (opcoes.corpo !== undefined) {
    cabecalhos['content-type'] = 'application/json';
  }
  if (opcoes.corpoBruto !== undefined) {
    cabecalhos['content-type'] = opcoes.corpoBruto.tipoDeConteudo;
  }
  if (opcoes.cookie !== undefined) {
    cabecalhos.cookie = opcoes.cookie;
  }

  const enviado =
    opcoes.corpo !== undefined ? JSON.stringify(opcoes.corpo) : opcoes.corpoBruto?.texto;

  const resposta = await fetch(new URL(caminho, base), {
    method: opcoes.metodo ?? 'GET',
    headers: cabecalhos,
    ...(enviado === undefined ? {} : { body: enviado }),
  });

  const texto = await resposta.text();
  const tipoDeConteudo = resposta.headers.get('content-type') ?? '';

  return {
    status: resposta.status,
    texto,
    // Interpretado apenas quando o serviço declara JSON: a página navegável do contrato responde
    // HTML, e interpretar tudo faria o helper falhar por um motivo que nada tem a ver com o caso.
    corpo:
      tipoDeConteudo.includes('application/json') && texto.length > 0
        ? (JSON.parse(texto) as unknown)
        : undefined,
    tipoDeConteudo,
    cookies: resposta.headers.getSetCookie(),
  };
}

/** O par `nome=valor` do cookie de sessão, no formato em que o cliente o reenvia. */
function credencialDeSessao(resposta: Resposta): string {
  const cookie = resposta.cookies.find((candidato) =>
    nomeDoCookie(candidato).endsWith(SUFIXO_DO_COOKIE_DE_SESSAO),
  );

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
 * O trio de segurança declarado por um cookie, lido do próprio cabeçalho.
 *
 * Do cabeçalho, e não da configuração: é ele que chega ao navegador, e é ele que decide se a
 * credencial pode viajar em claro. A comparação é por igualdade do objeto inteiro — "contém
 * `Secure`" passaria sobre um `SameSite=None; Secure`, que o navegador rejeita.
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

  const valorDe = (nome: string): string | undefined =>
    atributos
      .find((atributo) => atributo.toLowerCase().startsWith(`${nome.toLowerCase()}=`))
      ?.slice(nome.length + 1);

  return {
    httpOnly: presente('HttpOnly'),
    secure: presente('Secure'),
    sameSite: valorDe('SameSite'),
  };
}

/** Identificador e endereço da pessoa que a sonda autenticada declara. */
function usuarioDaSonda(resposta: Resposta): { id: unknown; email: unknown } {
  const corpo = resposta.corpo as { user?: { id?: unknown; email?: unknown } } | null;
  return { id: corpo?.user?.id, email: corpo?.user?.email };
}

/** Estado persistido da pessoa, direto do schema `identidade`. */
async function pessoaPersistida(
  usuarioId: string,
): Promise<{ ativo: boolean; empresaId: string | null }> {
  const { usuario } = esquemaIdentidade;
  const [linha] = await identidade.acesso.identidade
    .select({ ativo: usuario.ativo, empresaId: usuario.empresaId })
    .from(usuario)
    .where(eq(usuario.id, usuarioId))
    .limit(1);

  if (linha === undefined) {
    throw new Error(`a carga inicial não tem pessoa com o identificador ${usuarioId}`);
  }

  return linha;
}

/** As sessões persistidas de uma pessoa. */
async function sessoesDe(usuarioId: string): Promise<readonly { token: string; expiraEm: Date }[]> {
  const { sessao } = esquemaIdentidade;
  return await identidade.acesso.identidade
    .select({ token: sessao.token, expiraEm: sessao.expiraEm })
    .from(sessao)
    .where(eq(sessao.usuarioId, usuarioId));
}

/** A expiração persistida da sessão de um token. */
async function expiracaoDe(token: string): Promise<Date> {
  const { sessao } = esquemaIdentidade;
  const [linha] = await identidade.acesso.identidade
    .select({ expiraEm: sessao.expiraEm })
    .from(sessao)
    .where(eq(sessao.token, token))
    .limit(1);

  if (linha === undefined) {
    throw new Error(`nenhuma sessão persistida para o token observado`);
  }

  return linha.expiraEm;
}

/** A empresa da pessoa a quem a sessão de um token pertence — a junção que a sessão fixa. */
async function empresaDaSessao(token: string): Promise<string | null> {
  const { sessao, usuario } = esquemaIdentidade;
  const [linha] = await identidade.acesso.identidade
    .select({ empresaId: usuario.empresaId })
    .from(sessao)
    .innerJoin(usuario, eq(usuario.id, sessao.usuarioId))
    .where(eq(sessao.token, token))
    .limit(1);

  if (linha === undefined) {
    throw new Error('nenhuma sessão persistida para o token observado');
  }

  return linha.empresaId;
}

/**
 * Os endereços HTTP que o verificador shell da fundação consulta, extraídos dele próprio.
 *
 * Extraídos, e não copiados: é o script que decide quais endereços a bateria da F0 exige, e uma
 * lista copiada aqui envelheceria em silêncio. O conjunto é devolvido ordenado e sem repetição,
 * para ser comparado por igualdade com {@link ENDERECOS_DA_FUNDACAO}.
 */
function enderecosConsultadosPeloVerificador(): string[] {
  const texto = readFileSync(VERIFICADOR_DA_FUNDACAO, 'utf8');
  const encontrados = [...texto.matchAll(/consultar_http (\/\S*)/g)].map((casado) => casado[1]);
  return [...new Set(encontrados)].sort() as string[];
}
