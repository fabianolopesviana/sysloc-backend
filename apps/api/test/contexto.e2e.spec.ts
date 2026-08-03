/**
 * Guarda de contexto, rotas públicas e sessão corrente. T9 da fatia
 * `fundacao-multitenancy-identidade`.
 *
 * ---------------------------------------------------------------------------
 * INVARIANTES
 * ---------------------------------------------------------------------------
 *
 * | Critério | Caso   | Invariante |
 * |---|---|---|
 * | CA-05 | CT-020 | `GET /v1/sessao` do Sysloc Master devolve `empresaId` e `empresaNome` NULOS,
 * | CA-01 |        | e a do Admin da empresa A devolve os dois PREENCHIDOS com a empresa dela —
 * |       |        | objeto inteiro, no modelo de domínio camelCase da §4.2. É o par que
 * |       |        | discrimina: sem ele, "nulo para o Master" não distingue vínculo real de
 * |       |        | constante. (RN-04) |
 * | CA-05 | CT-020 | O contexto que a guarda publica CHEGA à unidade de trabalho: no contexto do
 * | CA-01 | (b)    | Master toda leitura de negócio é vazia, e no de cada Admin é exatamente o
 * | CA-02 |        | conjunto da empresa dele — atravessando guarda, `AsyncLocalStorage`,
 * |       |        | `SET LOCAL` e política, sem ramo de aplicação que trate o Master à parte.
 * |       |        | (RN-04, ADR-0008) |
 * | CA-01 | CT-020 | E o lado NEGATIVO do mesmo critério: a MESMA leitura, pedida com todos os
 * |       | (b)    | vetores de entrada do pedido apontando para OUTRA empresa — cabeçalho,
 * |       |        | cadeia de consulta, parâmetro de rota, corpo e um cookie ao lado do de
 * |       |        | sessão, na mesma requisição —, responde EXATAMENTE o mesmo objeto, na
 * |       |        | sessão de empresa e na do Master. Nenhum valor do pedido influencia a
 * |       |        | empresa do contexto. (RN-04, ADR-0008, invariante 2 do `CLAUDE.md`) |
 * | CA-01 | CT-020 | Companheiro negativo da guarda: requisição sem sessão válida responde `401`
 * |       | (c)    | com o corpo exato `{ codigo: 'NAO_AUTENTICADO', mensagem: 'sessão inválida
 * |       |        | ou expirada' }` — o envelope da ADR-0007, e o código que só a guarda produz. |
 * | CA-01 | CT-020 | O INVENTÁRIO de rotas públicas efetivas — as que a guarda libera — é
 * |       | (d)    | exatamente o conjunto revisado, e o de rotas protegidas também; excedentes e
 * |       |        | ausentes são NOMEADOS na falha. Rota nova nasce protegida por omissão. O
 * |       |        | conjunto vem da TABELA DO ROTEADOR já montado, e não do gancho `onRoute`:
 * |       |        | rota registrada direto no adaptador durante a montagem entra no inventário,
 * |       |        | e a perna de controle nomeia as oito que o gancho perde. (§11.1) |
 * | CA-15 | CT-029 | Percorrido o fluxo real de entrada, nenhuma linha do registro carrega senha,
 * |       |        | código de segundo fator, valor do cookie de sessão nem o segredo que viajou
 * |       |        | em cadeia de consulta — E o registro NÃO ficou mudo: cada requisição
 * |       |        | recusada tem a sua linha, com nível, status e caminho próprios. |
 *
 * Rastreabilidade: `CA-05 → CT-020 (RN-04)`, `CA-01 → CT-020 (RN-04)`, `CA-02 → CT-020 (b)`,
 * `CA-15 → CT-029`.
 *
 * ---------------------------------------------------------------------------
 * Por que DUAS aplicações, e o que cada uma prova
 * ---------------------------------------------------------------------------
 *
 * **A real** (`criarAplicacao`, de `src/main.ts`) é a montagem que atende em operação — prefixo de
 * versão com as exclusões reais, contrato publicado, guarda global. É contra ela que o inventário
 * de rotas públicas roda, porque um inventário obtido de uma remontagem descreveria uma aplicação
 * que ninguém sobe.
 *
 * **A instrumentada** existe por duas exigências que a real não pode satisfazer sem ganhar símbolo:
 *
 *   1. o CT-029 precisa do registrador apontado a **arquivo próprio**, e o destino do registrador é
 *      escolhido pela composição raiz. O ponto de substituição é o do próprio arcabouço de teste
 *      (`overrideProvider` sobre o token que a composição já publica) — nada em `apps/api/src`
 *      ganhou bandeira, ramo ou export para isso, e o registrador é o de PRODUÇÃO (`criarLogger`,
 *      com o mesmo parâmetro `destino` que a unidade systemd usa). Mesmo caminho legítimo já
 *      estabelecido em `packages/shared/test/log.spec.ts` e em `test/saude.e2e.spec.ts` CT-006 (b);
 *   2. o CT-020 (b) precisa de uma rota **protegida que consulte dado de negócio**, e esta fatia
 *      não publica nenhuma — a §4.1 tem sete rotas, seis sob `/v1/auth` e `GET /v1/sessao`. O
 *      controlador-fixture abaixo vive NESTE arquivo, como o `ControladorQueFalha` do CT-006 já
 *      fazia: ele não é superfície de produto, não sobe em operação, e a alternativa — publicar uma
 *      rota de negócio real só para o caso existir — seria criar produto para satisfazer teste, a
 *      forma mais cara da Iron Law #6. As rotas de negócio de verdade chegam na fatia
 *      `autorizacao-e-ciclo-de-acesso`, e o eixo HTTP do CT-020 cresce com elas.
 *
 * As duas compartilham a MESMA instância efêmera de banco: as sessões são estado do banco, e o
 * segredo de assinatura é o mesmo — mas cada caso faz a própria entrada, na aplicação que exercita,
 * para que nenhuma referência seja herdada de outro caso.
 *
 * ---------------------------------------------------------------------------
 * De onde vêm o banco, a fila e a credencial (ADR-0006)
 * ---------------------------------------------------------------------------
 *
 * De instâncias efêmeras próprias. O banco vem de `packages/auth/test/identidade-efemera.ts` — o
 * helper canônico de identidade migrada, que semeia a carga com a função de derivação do próprio
 * arcabouço. Nenhuma coordenada de conexão é lida do ambiente: o ambiente do processo é MONTADO a
 * partir do que os helpers devolvem.
 *
 * A porta de cada aplicação é **reservada** (trava atômica de `packages/shared/test/efemero-comum.ts`)
 * e não dinâmica, pela razão que a T8 registrou: o arcabouço confere a origem das requisições com
 * cookie contra o endereço base, que é composto a partir da porta CONFIGURADA — com `port: 0` a
 * configurada e a real divergiriam e todo caso passaria a provar outra coisa.
 *
 * ---------------------------------------------------------------------------
 * Cada caso arranja o próprio sujeito
 * ---------------------------------------------------------------------------
 *
 * A T7 desta fatia foi reprovada por prova tautológica por dependência de ordem — um caso anterior
 * corrompia o sujeito e a referência virava constante contra si mesma. Aqui cada caso entra com a
 * própria credencial, afirma a precondição que assume, e o CT-029 **esvazia o arquivo de registro**
 * no começo, de modo que a contagem de linhas dele não depende do que rodou antes.
 */

import { randomBytes } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Controller, Get, HttpCode, Post } from '@nestjs/common';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import {
  ACESSOS_DA_EMPRESA_A,
  ACESSOS_DA_EMPRESA_B,
  type AcessoAoBanco,
  abrirAcessoAoBanco,
  contextoDeTenant,
  EMPRESA_A,
  EMPRESA_B,
  SENHA_DA_CARGA,
  USUARIO_MASTER,
} from '@sysloc/db';
import { CodigoErro, criarLogger } from '@sysloc/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
// DÉBITO COM GATILHO — D28 · F0/T5 · gatilho JÁ DISPARADO (F1/T2, 2026-08-02)
// (NÃO é uma `DECISÃO FECHADA`: ele agenda uma mudança, não protege o código abaixo.)
// O QUÊ: os imports a seguir atravessam a fronteira de `@sysloc/shared` e de `@sysloc/auth` por
//        CAMINHO DE ARQUIVO, fora do `exports` e do `files` daqueles manifestos. As dependências de
//        workspace estão declaradas, então não há dependência oculta; o que não existe é FRONTEIRA
//        para os diretórios `test/` — e este arquivo é o SEXTO consumidor a repetir o padrão.
// QUANDO FECHA: o gatilho já disparou e o fechamento segue pendente; ele é o mesmo de sempre —
//        declarar o subpath `"./test"` nos manifestos e importar por `@sysloc/shared/test` e
//        `@sysloc/auth/test`, ou extrair um `@sysloc/test-utils`.
// POR QUE NÃO AGORA: fechar exige editar os manifestos de dois pacotes e os seis consumidores,
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
import {
  ENDERECO_DE_ESCUTA,
  PREFIXO_DE_VERSAO,
  TOKEN_LOGGER,
} from '../src/configuracao/ambiente.ts';
import { CAMINHO_DO_CONTRATO, CAMINHO_DO_DOCUMENTO, criarAplicacao } from '../src/main.ts';
import { decodificarBase32 } from './base32.ts';

/** Limite da montagem: banco migrado, semente, fila e DUAS aplicações reais. */
const LIMITE_DE_MONTAGEM_MS = 240_000;

/** Limite de um caso que atravessa HTTP e banco várias vezes. */
const LIMITE_CASO_MS = 60_000;

/** Sufixo do nome do cookie de sessão do arcabouço — o prefixo `__Secure-` vem da configuração. */
const SUFIXO_DO_COOKIE_DE_SESSAO = 'session_token';

/** Caminho, relativo à raiz, da rota de sessão do produto. Composto, nunca escrito à mão. */
const CAMINHO_DA_SESSAO_CORRENTE = `/${PREFIXO_DE_VERSAO}/${CAMINHO_DA_SESSAO}`;

/**
 * Caminho do controlador-fixture do CT-020 (b), relativo ao prefixo de versão.
 *
 * O nome denuncia o que ele é: superfície de VERIFICAÇÃO, montada apenas na aplicação instrumentada
 * deste arquivo. Nada em `apps/api/src` a conhece.
 */
const CAMINHO_DOS_VINCULOS = 'vinculos-de-verificacao';

/**
 * Nomes de cabeçalho plantados no quarto eixo do CT-020 (b).
 *
 * São três, e não um, porque o eixo persegue a CLASSE — *"qualquer entrada do pedido alcança o
 * contexto"* — e não o nome que o mutante do Gate 1 usou. O primeiro é literalmente o dele.
 */
const CABECALHOS_DE_EMPRESA_FORJADA = ['x-empresa', 'x-empresa-id', 'x-tenant-id'] as const;

/** Nomes de campo plantados na cadeia de consulta e no corpo, no mesmo eixo e pela mesma razão. */
const CAMPOS_DE_EMPRESA_FORJADA = ['empresaId', 'empresa_id', 'tenant'] as const;

/** Nome do cookie plantado AO LADO do de sessão — cookie é entrada do cliente como qualquer outra. */
const COOKIE_DE_EMPRESA_FORJADA = 'empresaId';

/**
 * As rotas que o publicador do contrato registra **direto no adaptador HTTP**, dentro de
 * `criarAplicacao()` — e que, por isso, nenhum gancho `onRoute` instalado depois dele enxerga.
 *
 * **São oito, e não duas.** Antes da rodada 2 da T9 supunha-se que o publicador registrasse a
 * página e o documento; o inventário derivado da tabela do roteador mostrou que ele registra também
 * a variante YAML do documento (**fora** do prefixo `/docs`, note-se), a página com barra final, o
 * `index.html`, a licença do visualizador e dois roteiros de inicialização. Nenhuma delas estava
 * classificada como coisa alguma até aqui — é a medida exata do ponto cego que o P2 fechou.
 *
 * A lista é literal e escrita à mão de propósito: ela é a **expectativa revisada**, e uma rota nova
 * que o publicador passe a registrar reprova a perna de controle do CT-020 (d) até alguém olhar
 * para ela. Derivá-la da mesma fonte que o caso classifica faria o caso concordar consigo mesmo.
 */
const ROTAS_DO_CONTRATO_NO_ADAPTADOR: readonly string[] = [
  `/${CAMINHO_DO_CONTRATO}`,
  `/${CAMINHO_DO_CONTRATO}-yaml`,
  `/${CAMINHO_DO_CONTRATO}/`,
  `/${CAMINHO_DO_CONTRATO}/LICENSE`,
  `/${CAMINHO_DO_CONTRATO}/docs/swagger-ui-init.js`,
  `/${CAMINHO_DO_CONTRATO}/index.html`,
  `/${CAMINHO_DO_DOCUMENTO}`,
  `/${CAMINHO_DO_CONTRATO}/swagger-ui-init.js`,
];

/**
 * As rotas que a guarda de contexto LIBERA na aplicação real — o conjunto revisado.
 *
 * Este é o inventário que a §11.1 da tech spec exige: *"um caso de teste enumera as rotas públicas
 * efetivas e falha se a lista crescer sem revisão"*. Ele é **outro conjunto** e de outra natureza
 * que o `CT-018 (d)` da T8: aquele enumera a superfície de biblioteca que o curinga arrasta sob
 * `/v1/auth`; este enumera a **exceção de segurança** — o que passa sem sessão.
 *
 * As entradas, e por que cada uma:
 *
 *   * as **duas verificações de saúde** são consultadas pelo supervisor do sistema operacional e
 *     pela prova de aceitação do reinício, nenhum dos dois com sessão;
 *   * o **encaminhador de identidade** precisa ser público porque entrar acontece antes de existir
 *     sessão. A marca é do MANIPULADOR (`@All('*')` é um só), então liberar a entrada libera o
 *     encaminhador inteiro. **Isso não é "aberto"**, e o caso o afirma logo abaixo: uma rota do
 *     inventário da T8 que exige sessão continua respondendo `401` — com `CREDENCIAL_INVALIDA`, a
 *     recusa do arcabouço, e não `NAO_AUTENTICADO`, a da guarda.
 *   * o **contrato publicado**, nas suas nove rotas: as oito de
 *     {@link ROTAS_DO_CONTRATO_NO_ADAPTADOR} mais os recursos estáticos da página (`/docs/*`), que
 *     é a única que chega pelo `listen`, com o plugin de arquivos. Que elas atendem é o
 *     `CT-018 (b)` da T8 quem afirma; que elas dispensam sessão é este caso.
 *
 * As oito entraram na **rodada 2 da T9**, e a razão é o P2 da Revisão Técnica: até ali o inventário
 * vinha do gancho `onRoute`, que não as alcançava, e elas ficavam **sem classificação nenhuma** —
 * nem públicas, nem protegidas. Não é que fossem privadas: é que ninguém olhava. Ver
 * {@link rotasDaTabelaDoRoteador}.
 *
 * A lista é ordenada porque o conjunto classificado também é, e a igualdade abaixo compara os dois
 * na mesma ordem — ordenar aqui evita que acrescentar uma entrada exija adivinhar a posição dela.
 */
const ROTAS_PUBLICAS_ACEITAS: readonly string[] = [
  ...ROTAS_DO_CONTRATO_NO_ADAPTADOR,
  `/${CAMINHO_DO_CONTRATO}/*`,
  '/saude',
  '/saude/pronto',
  `${PREFIXO_DAS_ROTAS_DE_IDENTIDADE}/*`,
].sort();

/** As rotas que a guarda PROTEGE na aplicação real — o outro lado da mesma igualdade. */
const ROTAS_PROTEGIDAS_ACEITAS: readonly string[] = [CAMINHO_DA_SESSAO_CORRENTE];

/**
 * Segmento concreto usado para sondar o encaminhador de identidade.
 *
 * `/*` é padrão de rota, não caminho. `ok` é a rota do arcabouço sem efeito e sem corpo de entrada
 * (inventariada pelo `CT-018 (d)` da T8), o que faz a sonda produzir `200` — sinal mais forte que um
 * `404`: a rota pública não só passa pela guarda, ela **atende**.
 */
const SEGMENTO_DE_SONDA = 'ok';

/**
 * Rota do inventário da T8 que EXIGE sessão do arcabouço — a âncora que separa "público na guarda"
 * de "aberto".
 */
const ROTA_DO_ARCABOUCO_COM_SESSAO = `${PREFIXO_DAS_ROTAS_DE_IDENTIDADE}/update-user`;

/**
 * Métodos que o cliente HTTP do runtime recusa emitir (lista de métodos proibidos do padrão de
 * busca). Um deles como único método de uma rota é falha declarada, não classificação silenciosa.
 */
const METODOS_INDISPONIVEIS = new Set(['CONNECT', 'TRACE', 'TRACK']);

/** Segredo plantado na CADEIA DE CONSULTA das duas rotas inexistentes do CT-029. */
const SEGREDO_EM_CONSULTA = 'SEGREDO-LITERAL-DO-CT-029';

/** Alvo de retorno plantado ao lado dele — ele NÃO é credencial, e continua legível. Ver abaixo. */
const ALVO_DE_RETORNO = '/painel';

/** Código de segundo fator informado no CT-029. Nunca pode aparecer legível no registro. */
const CODIGO_DE_SEGUNDO_FATOR = '654321';

/**
 * Status da recusa do código de segundo fator informado a quem não o configurou.
 *
 * **Medido, e não suposto**: o arcabouço recusa com `400 TOTP_NOT_ENABLED`, e a tabela de código por
 * status do filtro global traduz `400` em {@link CodigoErro.CAMPO_INVALIDO}, cujo status semântico é
 * `422` (ADR-0007). O literal fica aqui, nomeado, em vez de solto no meio do caso — e afirmá-lo é o
 * que faz a linha do journal ser conferida contra a resposta que o cliente recebeu, e não contra si
 * mesma.
 */
const STATUS_DA_RECUSA_DE_SEGUNDO_FATOR = 422;

/** E-mail que não existe na carga — usado para recusar a entrada com a senha REAL no corpo. */
const EMAIL_INEXISTENTE = 'ninguem.mora.aqui@exemplo.com.br';

/** Sujeito do eixo "empresa preenchida": Admin da empresa A. */
const ADMIN_DE_A = pessoaSemeada('admin.a@exemplo.com.br');

/** Sujeito do terceiro eixo do CT-020 (b): Admin da empresa B, com contagem diferente da de A. */
const ADMIN_DE_B = pessoaSemeada('admin.b@exemplo.com.br');

/** Sujeito exclusivo do CT-029 — a entrada bem-sucedida dele não mexe na contagem de outro caso. */
const PESSOA_DO_REGISTRO = pessoaSemeada('usuario.a@exemplo.com.br');

interface RotaRegistrada {
  readonly metodos: readonly string[];
  readonly url: string;
}

let identidade: IdentidadeEfemera;
let fila: FilaEfemera;
let acessoAoNegocio: AcessoAoBanco;

let aplicacaoReal: NestFastifyApplication;
let baseReal: string;

/**
 * A superfície que o CT-020 (d) classifica: a tabela de rotas do ROTEADOR já montado.
 *
 * Fonte primária, e a única de que a igualdade do inventário depende.
 */
let rotasDoRoteador: RotaRegistrada[] = [];

/**
 * A mesma superfície vista pelo gancho `onRoute` — fonte **complementar**, e só ela.
 *
 * Ela existe para a perna de controle do CT-020 (d): o gancho é instalado depois de
 * `criarAplicacao()`, e o que ele NÃO viu é exatamente o que a fonte primária existe para alcançar.
 * Nenhuma classificação sai daqui.
 */
const rotasDoGancho: RotaRegistrada[] = [];

let aplicacaoInstrumentada: NestFastifyApplication;
let baseInstrumentada: string;
let diretorioDeRegistro: string;
let arquivoDeRegistro: string;

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
  // recurso: ele é encerrado no descarte, junto das instâncias. A cadeia é a do papel `sysloc_app`
  // — a única que `bancoEfemero()` devolve —, que é o papel sujeito à política (ADR-0008).
  acessoAoNegocio = abrirAcessoAoBanco({ cadeiaDeConexao: identidade.banco.cadeiaConexao });

  ambienteAnterior = { ...process.env };
  process.env.NODE_ENV = 'test';
  // A aplicação REAL escreve o registro na saída padrão do processo de verificação, e nenhum caso
  // assere sobre ele — as linhas se misturariam ao relatório do arcabouço. Quem observa registro é
  // o CT-029, na aplicação instrumentada, cujo registrador aponta para arquivo próprio.
  process.env.LOG_LEVEL = 'fatal';
  process.env.DATABASE_URL = identidade.banco.cadeiaConexao;
  process.env.REDIS_URL = fila.cadeiaConexao;
  // Sorteado por execução, como as demais credenciais efêmeras: vive na memória deste processo e
  // morre com ele. É o MESMO para as duas aplicações — elas assinam sessões sobre o mesmo banco.
  process.env.BETTER_AUTH_SECRET = randomBytes(32).toString('base64url');

  const portaReal = await reservarPorta();
  baseReal = `http://${ENDERECO_DE_ESCUTA}:${String(portaReal)}`;
  process.env.PORT = String(portaReal);

  aplicacaoReal = await criarAplicacao();
  // Fonte COMPLEMENTAR. O gancho só dispara para registros posteriores à instalação dele, e a
  // instalação só é possível depois de `criarAplicacao()` — que é onde `SwaggerModule.setup`
  // registra as oito rotas do contrato direto no adaptador. O que ele perde é o assunto da perna de
  // controle do CT-020 (d); o inventário não sai daqui.
  aplicacaoReal
    .getHttpAdapter()
    .getInstance()
    .addHook('onRoute', (rota: { method: string | string[]; url: string }) => {
      rotasDoGancho.push({
        metodos: typeof rota.method === 'string' ? [rota.method] : rota.method,
        url: rota.url,
      });
    });
  await aplicacaoReal.listen({ port: portaReal, host: ENDERECO_DE_ESCUTA });
  // Fonte PRIMÁRIA, e depois do `listen` de propósito: só aí o roteador está completo (as rotas dos
  // controladores entram na inicialização do arcabouço, e as do plugin de arquivos estáticos na
  // prontidão do adaptador). A tabela inclui o que foi registrado ANTES do gancho — é essa a
  // diferença que o P2 da Revisão Técnica mandou fechar.
  rotasDoRoteador = rotasDaTabelaDoRoteador(
    aplicacaoReal.getHttpAdapter().getInstance().printRoutes(),
  );

  const portaInstrumentada = await reservarPorta();
  baseInstrumentada = `http://${ENDERECO_DE_ESCUTA}:${String(portaInstrumentada)}`;
  process.env.PORT = String(portaInstrumentada);

  diretorioDeRegistro = mkdtempSync(join(tmpdir(), 'sysloc-registro-t9-'));
  arquivoDeRegistro = join(diretorioDeRegistro, 'aplicacao.log');

  const modulo = await Test.createTestingModule({
    imports: [AppModule],
    controllers: [ControladorDeVinculos],
  })
    .overrideProvider(TOKEN_LOGGER)
    // `trace` é o nível mais baixo do vocabulário do projeto: com ele NENHUMA linha que o processo
    // emita durante o fluxo é filtrada, e a asserção de ausência de segredo alcança o registro
    // inteiro — não só a parte que um nível mais alto deixaria passar.
    .useValue(criarLogger({ nivel: 'trace', destino: arquivoDeRegistro }))
    .compile();

  aplicacaoInstrumentada = modulo.createNestApplication<NestFastifyApplication>(
    new FastifyAdapter(),
  );
  // Sem as exclusões da aplicação real, de propósito: nenhum caso desta aplicação toca as rotas de
  // saúde, e reproduzir a lista aqui criaria uma segunda cópia dela livre para divergir. O que
  // importa é que `/v1/auth` e o fixture atendam sob o prefixo, e é o que esta linha garante.
  aplicacaoInstrumentada.setGlobalPrefix(PREFIXO_DE_VERSAO);
  await aplicacaoInstrumentada.listen({ port: portaInstrumentada, host: ENDERECO_DE_ESCUTA });
}, LIMITE_DE_MONTAGEM_MS);

afterAll(async () => {
  await aplicacaoInstrumentada?.close();
  await aplicacaoReal?.close();
  await acessoAoNegocio?.encerrar();
  await fila?.parar();
  await identidade?.parar();

  if (diretorioDeRegistro !== undefined) {
    rmSync(diretorioDeRegistro, { recursive: true, force: true });
  }

  for (const nome of VARIAVEIS_MONTADAS) {
    const valor = ambienteAnterior?.[nome];
    if (valor === undefined) {
      delete process.env[nome];
    } else {
      process.env[nome] = valor;
    }
  }
}, LIMITE_DE_MONTAGEM_MS);

describe('guarda de contexto, rotas públicas e sessão corrente (T9)', () => {
  it(
    'CT-020 — a sessão do Sysloc Master reporta empresa nula; a do Admin de A reporta a empresa dela',
    async () => {
      const cookieDoMaster = await entrar(baseReal, USUARIO_MASTER.email);
      const sessaoDoMaster = await pedir(baseReal, CAMINHO_DA_SESSAO_CORRENTE, {
        cookie: cookieDoMaster,
      });

      expect(sessaoDoMaster.status).toBe(200);
      // Objeto INTEIRO por igualdade, e não presença de campo: os oito campos da §4.2, em
      // camelCase e português, sem extras. Uma implementação que devolvesse o `{ user, session }`
      // do arcabouço, ou que acrescentasse `versaoPermissoes` antes da hora, reprova aqui.
      expect(sessaoDoMaster.corpo).toEqual({
        usuarioId: USUARIO_MASTER.id,
        nome: USUARIO_MASTER.nome,
        email: USUARIO_MASTER.email,
        perfil: 'SYSLOC_MASTER',
        empresaId: null,
        empresaNome: null,
        senhaProvisoria: false,
        // Verdadeiro porque a carga inicial cria o Master SEM segundo fator ativo, e o predicado da
        // barreira (RN-08) o exige dele. A configuração do segundo fator, e a queda da restrição,
        // são da T10 (CT-019).
        segundoFatorPendente: true,
      });

      // O outro lado do par. Sem ele, "nulo para o Master" não distingue vínculo real de constante:
      // uma implementação que devolvesse `null` para todo mundo passaria a metade de cima.
      const cookieDoAdmin = await entrar(baseReal, ADMIN_DE_A.email);
      const sessaoDoAdmin = await pedir(baseReal, CAMINHO_DA_SESSAO_CORRENTE, {
        cookie: cookieDoAdmin,
      });

      expect(sessaoDoAdmin.status).toBe(200);
      expect(sessaoDoAdmin.corpo).toEqual({
        usuarioId: ADMIN_DE_A.id,
        nome: ADMIN_DE_A.nome,
        email: ADMIN_DE_A.email,
        perfil: 'ADMIN_EMPRESA',
        empresaId: EMPRESA_A.id,
        empresaNome: EMPRESA_A.nome,
        senhaProvisoria: false,
        segundoFatorPendente: false,
      });

      // E as duas empresas são de fato distintas — a asserção acima só discrimina porque isto vale.
      expect(EMPRESA_A.id).not.toBe(EMPRESA_B.id);
    },
    LIMITE_CASO_MS,
  );

  it(
    'CT-020 (b) — o contexto publicado chega à unidade de trabalho: Master lê vazio, cada Admin lê a sua empresa',
    async () => {
      // SUT_IS_CORRECT_BECAUSE: a sessão do Master nasce RESTRITA — o segundo fator é exigido dele
      // e ainda não está ativo (RN-08) —, e desde a T10 a sessão restrita não alcança rota de
      // negócio: ela responde `403 ACESSO_NEGADO` nomeando a exigência (CA-09, CT-019). Quando este
      // caso foi escrito, a marca de restrição existia e ainda não decidia nada, então `entrar`
      // bastava; hoje uma leitura de negócio autorizada a uma sessão com segundo fator pendente
      // seria a janela de privilégio que a T10 existe para fechar. O eixo deste caso é o CONTEXTO
      // publicado, não a restrição: por isso ele **cumpre a exigência pelo caminho público real**
      // — prepara e verifica o segundo fator — antes de exercitar a leitura, e a desfaz no fim,
      // pela rota pública também, para não deixar precondição alterada para outro caso. Nenhuma
      // asserção deste caso foi enfraquecida, removida ou trocada.
      const cookieDoMaster = await entrarComSegundoFatorCumprido(
        baseInstrumentada,
        USUARIO_MASTER.email,
      );

      try {
        const doMaster = await pedir(
          baseInstrumentada,
          `/${PREFIXO_DE_VERSAO}/${CAMINHO_DOS_VINCULOS}`,
          {
            cookie: cookieDoMaster,
          },
        );

        expect(doMaster.status).toBe(200);
        // `contextoPublicado: true` com `empresaIdDoContexto: null` é o par que discrimina "a guarda
        // publicou contexto SEM empresa" de "a guarda não publicou contexto nenhum". Os dois estados
        // terminam em leitura vazia, por caminhos diferentes — e só o primeiro é o comportamento que
        // esta task entrega. Sem esta asserção, uma guarda que jamais chamasse `executarCom` passaria.
        //
        // É TAMBÉM esta igualdade que satisfaz o passo 4 do cartão (§6.6, CT-020) — *"nenhum corpo de
        // resposta contém mensagem de erro, código de erro ou indicação de existência"*: um corpo com
        // `codigo`, `mensagem` ou qualquer campo a mais não é igual a este objeto. Asserções separadas
        // de ausência desses nomes seriam IMPLICADAS por ela, e portanto infalíveis (AP-29): os
        // identificadores são UUID, e não existe estado do SUT em que a igualdade passe e a ausência
        // falhe. O eixo continua provado, com mais força, pela própria igualdade.
        expect(doMaster.corpo).toEqual({
          contextoPublicado: true,
          empresaIdDoContexto: null,
          vinculos: [],
        });

        // Companheiro negativo, e o que impede o vazio do Master de significar "rota quebrada": a
        // MESMA rota, na sessão de uma pessoa de empresa, devolve as linhas DAQUELA empresa.
        const cookieDeA = await entrar(baseInstrumentada, ADMIN_DE_A.email);
        const deA = await pedir(
          baseInstrumentada,
          `/${PREFIXO_DE_VERSAO}/${CAMINHO_DOS_VINCULOS}`,
          {
            cookie: cookieDeA,
          },
        );

        expect(deA.status).toBe(200);
        expect(deA.corpo).toEqual({
          contextoPublicado: true,
          empresaIdDoContexto: EMPRESA_A.id,
          vinculos: identificadoresOrdenados(ACESSOS_DA_EMPRESA_A),
        });

        // Terceiro eixo: a empresa B, com contagem diferente da de A (3 contra 2, por decisão da
        // carga). Sem ele, uma implementação que devolvesse sempre o conjunto de A passaria os dois
        // eixos anteriores.
        const cookieDeB = await entrar(baseInstrumentada, ADMIN_DE_B.email);
        const deB = await pedir(
          baseInstrumentada,
          `/${PREFIXO_DE_VERSAO}/${CAMINHO_DOS_VINCULOS}`,
          {
            cookie: cookieDeB,
          },
        );

        expect(deB.status).toBe(200);
        expect(deB.corpo).toEqual({
          contextoPublicado: true,
          empresaIdDoContexto: EMPRESA_B.id,
          vinculos: identificadoresOrdenados(ACESSOS_DA_EMPRESA_B),
        });

        // As duas leituras são disjuntas — é a forma direta de dizer "nenhuma alcançou a outra".
        const deAComoConjunto = new Set(identificadoresOrdenados(ACESSOS_DA_EMPRESA_A));
        expect(
          identificadoresOrdenados(ACESSOS_DA_EMPRESA_B).filter((id) => deAComoConjunto.has(id)),
        ).toEqual([]);

        // ---------------------------------------------------------------------------------------
        // Quarto eixo — o lado NEGATIVO do CA-01: nenhum valor do PEDIDO influencia a empresa
        // ---------------------------------------------------------------------------------------
        //
        // Os três eixos acima provam de onde a empresa VEM (a sessão). Nenhum deles prova de onde ela
        // NÃO vem: até aqui nenhuma requisição da suíte carregava empresa, e uma guarda que
        // preferisse um cabeçalho ao `empresaId` da sessão passaria os três — foi exatamente o
        // mutante que o Gate 1 reproduziu, sobrevivendo à suíte inteira.
        //
        // A classe não é "o cabeçalho `x-empresa`"; é *"qualquer entrada do pedido alcança o
        // contexto"*. Por isso os vetores viajam JUNTOS, na MESMA requisição — cabeçalho, cadeia de
        // consulta, parâmetro de rota, corpo e um cookie ao lado do de sessão —, todos com
        // `EMPRESA_B.id`: um por vez provaria um caminho; juntos, provam que a resposta é
        // INDIFERENTE ao envelope do pedido, que é o que a ADR-0008 e o invariante 2 exigem. Vetor
        // novo entra num ponto só, {@link pedirComEmpresaForjada}.
        const forjadaDeA = await pedirComEmpresaForjada(cookieDeA);

        expect(forjadaDeA.status).toBe(200);
        // EXATAMENTE a mesma resposta do eixo de A — inclusive os `vinculos`, que continuam sendo os
        // de A e não os de B. Asserir os vínculos, e não só `empresaIdDoContexto`, é o que faz o eixo
        // alcançar o efeito TERMINAL (a política do banco), e não apenas o valor que a guarda
        // publicou: uma leitura do pedido que só contaminasse o `SET LOCAL` já reprovaria aqui.
        expect(forjadaDeA.corpo).toEqual({
          contextoPublicado: true,
          empresaIdDoContexto: EMPRESA_A.id,
          vinculos: identificadoresOrdenados(ACESSOS_DA_EMPRESA_A),
        });

        // O caso simétrico, e o mais grave: para o Master a empresa do contexto é a AUSÊNCIA dela, de
        // modo que o pedido não precisaria TROCAR nada — bastaria CRIAR contexto onde a sessão não
        // tem nenhum para o Master virar admin de B sem que coisa alguma quebrasse.
        const forjadaDoMaster = await pedirComEmpresaForjada(cookieDoMaster);

        expect(forjadaDoMaster.status).toBe(200);
        expect(forjadaDoMaster.corpo).toEqual({
          contextoPublicado: true,
          empresaIdDoContexto: null,
          vinculos: [],
        });
      } finally {
        // O estado do Master volta ao que era, pela rota pública, ACONTEÇA O QUE ACONTECER acima:
        // no `finally`, e não como última instrução do corpo, porque qualquer `expect` que reprove
        // antes abortaria o caso e deixaria o segundo fator ativo para os seguintes — e o CT-020,
        // que afirma `segundoFatorPendente: true`, passaria a falhar por arrasto, com a segunda
        // falha apontando para o lugar errado. O arquivo não tem dependência de ordem NEM QUANDO
        // ESTE CASO FALHA, e é isso que o `finally` garante — a versão anterior só o garantia no
        // caminho feliz.
        await desfazerSegundoFator(baseInstrumentada, cookieDoMaster);
      }
    },
    LIMITE_CASO_MS,
  );

  it(
    'CT-020 (c) — requisição sem sessão válida responde 401 no envelope da ADR-0007',
    async () => {
      const semCookie = await pedir(baseReal, CAMINHO_DA_SESSAO_CORRENTE);

      expect(semCookie.status).toBe(401);
      // Objeto inteiro: o formato padrão do arcabouço HTTP (`{ statusCode, error, message }`)
      // passaria numa asserção que só conferisse o status, e é ele que a ADR-0007 existe para não
      // deixar sair.
      expect(semCookie.corpo).toEqual({
        codigo: CodigoErro.NAO_AUTENTICADO,
        mensagem: 'sessão inválida ou expirada',
      });

      // Cookie que nunca correspondeu a sessão alguma responde EXATAMENTE o mesmo: nada revela que
      // um token existiu ou deixou de existir (RN-10).
      const cookieForjado = await pedir(baseReal, CAMINHO_DA_SESSAO_CORRENTE, {
        cookie: `__Secure-sysloc.${SUFIXO_DO_COOKIE_DE_SESSAO}=token-que-nunca-existiu`,
      });
      expect(cookieForjado.status).toBe(semCookie.status);
      expect(cookieForjado.texto).toBe(semCookie.texto);
    },
    LIMITE_CASO_MS,
  );

  it(
    'CT-020 (d) — o inventário de rotas públicas efetivas é exatamente o conjunto revisado',
    async () => {
      // Sem esta âncora o caso seria vácuo: uma derivação que não extraísse nada produziria dois
      // conjuntos vazios, e a igualdade abaixo só reprovaria por ausência — sem dizer por quê.
      expect(
        rotasDoRoteador.length,
        'a tabela do roteador não rendeu rota alguma: o inventário estaria vazio por construção',
      ).toBeGreaterThan(0);

      // ---------------------------------------------------------------------------------------
      // Perna de controle — a fonte primária alcança o que o gancho NÃO alcança
      // ---------------------------------------------------------------------------------------
      //
      // As oito rotas de {@link ROTAS_DO_CONTRATO_NO_ADAPTADOR} são registradas DIRETO no adaptador
      // HTTP, dentro de `criarAplicacao()` — antes, portanto, de existir gancho. Elas são a prova
      // concreta da classe que o P2 aponta: rota que nasce pública por um caminho que o gancho não
      // vê. Esta asserção afirma as duas coisas de uma vez — que o gancho de fato as perde (senão a
      // lista seria vazia) e que a tabela do roteador de fato as tem (senão a lista seria outra).
      // Sem ela, trocar a fonte do inventário seria trocar um ponto cego por outro sem prova.
      const vistasPeloGancho = new Set(rotasDoGancho.map((rota) => rota.url));
      const invisiveisAoGancho = [...new Set(rotasDoRoteador.map((rota) => rota.url))]
        .filter((url) => !vistasPeloGancho.has(url))
        .sort();

      expect(
        invisiveisAoGancho,
        'as rotas registradas direto no adaptador deixaram de ser exatamente as do contrato: ' +
          `${invisiveisAoGancho.join(', ')}`,
      ).toEqual([...ROTAS_DO_CONTRATO_NO_ADAPTADOR].sort());

      // E o gancho não viu NADA que o roteador não tenha: a fonte primária é superconjunto da
      // complementar. Sem isto, uma derivação que perdesse metade da árvore ainda passaria acima.
      const vistasPeloRoteador = new Set(rotasDoRoteador.map((rota) => rota.url));
      const perdidasPelaDerivacao = [...vistasPeloGancho]
        .filter((url) => !vistasPeloRoteador.has(url))
        .sort();
      expect(perdidasPelaDerivacao).toEqual([]);

      const { publicas, protegidas } = await classificarRotas();

      // Igualdade nos DOIS sentidos, com as diferenças NOMEADAS: a mensagem da falha é o que faz
      // quem revisar saber se abriu uma rota sem querer (excedente) ou fechou uma que o supervisor
      // do sistema operacional consulta (ausente).
      const aceitas: readonly string[] = ROTAS_PUBLICAS_ACEITAS;
      const excedentes = publicas.filter((rota) => !aceitas.includes(rota));
      const ausentes = aceitas.filter((rota) => !publicas.includes(rota));

      expect(
        excedentes,
        `rotas passaram a dispensar sessão sem revisão: ${excedentes.join(', ')}`,
      ).toEqual([]);
      expect(
        ausentes,
        `rotas que precisam dispensar sessão deixaram de dispensá-la: ${ausentes.join(', ')}`,
      ).toEqual([]);
      expect(publicas).toEqual([...ROTAS_PUBLICAS_ACEITAS]);

      // O outro lado da mesma igualdade. Sem ele, desligar a guarda inteira passaria bastando
      // encolher a constante de cima — a igualdade sozinha prova estabilidade, não proteção.
      expect(protegidas).toEqual([...ROTAS_PROTEGIDAS_ACEITAS]);

      // Âncora que separa "público na guarda" de "aberto": uma rota do inventário da T8 que exige
      // sessão do ARCABOUÇO continua recusando — e recusa com o código DELE, o que prova que a
      // requisição atravessou a guarda em vez de ser barrada por ela.
      const doArcabouco = await pedir(baseReal, ROTA_DO_ARCABOUCO_COM_SESSAO, {
        metodo: 'POST',
        corpo: { nome: 'irrelevante' },
      });
      expect(doArcabouco.status).toBe(401);
      expect((doArcabouco.corpo as { codigo?: unknown }).codigo).toBe(
        CodigoErro.CREDENCIAL_INVALIDA,
      );
      expect((doArcabouco.corpo as { codigo?: unknown }).codigo).not.toBe(
        CodigoErro.NAO_AUTENTICADO,
      );
    },
    LIMITE_CASO_MS,
  );

  it(
    'CT-029 — nenhum segredo de autenticação legível no registro durante o fluxo real de entrada',
    async () => {
      // O arquivo é esvaziado no COMEÇO do caso: a contagem de linhas abaixo é sobre o fluxo que
      // este caso executa, e não sobre o que os casos anteriores deixaram para trás.
      writeFileSync(arquivoDeRegistro, '');

      // --- 1. entrada bem-sucedida, com a senha real no corpo -----------------------------------
      const entrada = await pedir(
        baseInstrumentada,
        `${PREFIXO_DAS_ROTAS_DE_IDENTIDADE}/sign-in/email`,
        {
          metodo: 'POST',
          corpo: { email: PESSOA_DO_REGISTRO.email, password: SENHA_DA_CARGA },
        },
      );
      expect(entrada.status).toBe(200);
      const cookie = credencialDeSessao(entrada);
      const valorDoCookie = cookie.slice(cookie.indexOf('=') + 1);
      expect(valorDoCookie.length).toBeGreaterThan(0);

      // --- 2. requisição autenticada, que exercita a guarda no caminho feliz --------------------
      const autenticada = await pedir(baseInstrumentada, CAMINHO_DA_SESSAO_CORRENTE, { cookie });
      expect(autenticada.status).toBe(200);

      // --- 3. entrada RECUSADA, também com a senha real no corpo --------------------------------
      // O e-mail é que não existe. É deliberado: a recusa precisa ser produzida com o segredo
      // verdadeiro trafegando, senão a ausência dele no registro não prova nada.
      const recusada = await pedir(
        baseInstrumentada,
        `${PREFIXO_DAS_ROTAS_DE_IDENTIDADE}/sign-in/email`,
        {
          metodo: 'POST',
          corpo: { email: EMAIL_INEXISTENTE, password: SENHA_DA_CARGA },
        },
      );
      expect(recusada.status).toBe(401);

      // --- 4. código de segundo fator informado a quem não tem segundo fator --------------------
      const segundoFator = await pedir(
        baseInstrumentada,
        `${PREFIXO_DAS_ROTAS_DE_IDENTIDADE}/two-factor/verify-totp`,
        { metodo: 'POST', cookie, corpo: { code: CODIGO_DE_SEGUNDO_FATOR } },
      );
      expect(segundoFator.status).toBe(STATUS_DA_RECUSA_DE_SEGUNDO_FATOR);

      // --- 5. requisição sem sessão: a recusa que a GUARDA produz --------------------------------
      const semSessao = await pedir(baseInstrumentada, CAMINHO_DA_SESSAO_CORRENTE);
      expect(semSessao.status).toBe(401);

      // --- 6. rota inexistente SOB /v1/auth, com segredo na cadeia de consulta -------------------
      const inexistenteNaIdentidade = await pedir(
        baseInstrumentada,
        `${PREFIXO_DAS_ROTAS_DE_IDENTIDADE}/rota-que-o-arcabouco-nao-publica` +
          `?token=${SEGREDO_EM_CONSULTA}&callbackURL=${ALVO_DE_RETORNO}`,
      );
      expect(inexistenteNaIdentidade.status).toBe(404);

      // --- 7. rota inexistente FORA de /v1/auth, com o mesmo segredo -----------------------------
      // É esta que carrega o eixo do D25 até o fim: o arcabouço HTTP monta a mensagem da exceção
      // interpolando o ALVO BRUTO (`Cannot GET /…?token=…`), e é dela que o valor sensível sairia
      // legível se a redação por forma não o alcançasse.
      const inexistenteNoProduto = await pedir(
        baseInstrumentada,
        `/${PREFIXO_DE_VERSAO}/rota-que-nao-existe` +
          `?token=${SEGREDO_EM_CONSULTA}&callbackURL=${ALVO_DE_RETORNO}`,
      );
      expect(inexistenteNoProduto.status).toBe(404);

      // -----------------------------------------------------------------------------------------
      // Eixo 1 — AUSÊNCIA: nenhum segredo legível, no arquivo INTEIRO
      // -----------------------------------------------------------------------------------------
      const registro = readFileSync(arquivoDeRegistro, 'utf8');

      expect(registro).not.toContain(SENHA_DA_CARGA);
      expect(registro).not.toContain(CODIGO_DE_SEGUNDO_FATOR);
      expect(registro).not.toContain(valorDoCookie);
      expect(registro).not.toContain(SEGREDO_EM_CONSULTA);

      // -----------------------------------------------------------------------------------------
      // Eixo 2 — o registro NÃO FICOU MUDO
      // -----------------------------------------------------------------------------------------
      //
      // Obrigatória, e o `DÉBITO`/`DECISÃO` do D25 diz por quê: apagar o evento faria a asserção de
      // ausência acima passar exatamente igual. Mascarar não pode silenciar. A contagem é EXATA —
      // uma linha por requisição recusada, na ordem em que foram feitas —, o que também afirma que
      // nenhuma linha extra apareceu.
      const eventos = linhasDoRegistro(registro);
      const recusas = eventos.map((evento) => ({
        nivel: evento.nivel,
        status: evento.status,
        caminho: evento.caminho,
      }));

      // SUT_IS_CORRECT_BECAUSE: as duas primeiras entradas fixavam `/v1/auth/*`, e o valor estava
      // certo para o SUT de então — o encaminhador é `@All('*')` e o roteador casa um padrão só
      // para toda a superfície de identidade. Era exatamente o defeito do débito **D27**: as ~40
      // rotas de identidade colapsavam num rótulo, e o operador não distinguia uma tentativa de
      // ENTRADA de qualquer outra recusa daquele prefixo — degradando o artefato que a
      // `DECISÃO FECHADA — T6 / Gate 2 (P5)` nomeia como "aquele que a operação lê para decidir se
      // houve ataque". O fechamento da F1 fez o encaminhador declarar a rota real quando ela é um
      // padrão LITERAL do registro do arcabouço, e este caso passa a fixar o comportamento novo.
      //
      // A asserção NÃO afrouxou — segue igualdade sobre a lista inteira, agora contra valores mais
      // específicos. E as entradas 6 e 7 continuam iguais **de propósito**: elas são a prova, aqui
      // mesmo, de que a mudança é fail-closed. Rota inexistente não é padrão literal do registro,
      // então não recebe rótulo e continua saindo como o curinga; segmento nenhum do pedido chega
      // ao journal por este caminho. O `CT-106` de `autenticacao.e2e.spec.ts` prova o mesmo para
      // rota com segmento VARIÁVEL, que é o caso em que vazaria um token.
      expect(recusas).toEqual([
        // 3 — a entrada recusada, com o status que o arcabouço escolheu, agora sob a rota REAL.
        {
          nivel: 'warn',
          status: 401,
          caminho: `${PREFIXO_DAS_ROTAS_DE_IDENTIDADE}/sign-in/email`,
        },
        // 4 — o código de segundo fator recusado, idem.
        {
          nivel: 'warn',
          status: STATUS_DA_RECUSA_DE_SEGUNDO_FATOR,
          caminho: `${PREFIXO_DAS_ROTAS_DE_IDENTIDADE}/two-factor/verify-totp`,
        },
        // 5 — a recusa da GUARDA, no caminho da rota de sessão.
        { nivel: 'warn', status: 401, caminho: CAMINHO_DA_SESSAO_CORRENTE },
        // 6 — a rota INEXISTENTE sob o encaminhador: não está no registro, não vira rótulo, sai
        //     como o curinga. É metade da prova de que o rótulo vem de conjunto fechado.
        { nivel: 'warn', status: 404, caminho: `${PREFIXO_DAS_ROTAS_DE_IDENTIDADE}/*` },
        // 7 — a rota inexistente fora dele: sem rota casada, sobra o alvo TRUNCADO antes do `?`.
        { nivel: 'warn', status: 404, caminho: `/${PREFIXO_DE_VERSAO}/rota-que-nao-existe` },
      ]);

      // A recusa da guarda nomeia o código do vocabulário fechado — é a linha que a operação lê
      // para distinguir "sessão ausente" de "credencial errada".
      expect(eventos[2]?.codigo).toBe(CodigoErro.NAO_AUTENTICADO);
      expect(eventos[0]?.codigo).toBe(CodigoErro.CREDENCIAL_INVALIDA);

      // -----------------------------------------------------------------------------------------
      // Eixo 3 — o valor sensível foi MASCARADO, e o resto do endereço sobreviveu
      // -----------------------------------------------------------------------------------------
      // A linha é localizada pelo CAMINHO que ela grava, e não por posição no arquivo: um índice
      // amarraria o caso à ordem das requisições e o faria mudar de sujeito em silêncio se alguém
      // acrescentasse uma requisição antes.
      const linhaDaRotaInexistente =
        registro
          .split('\n')
          .find((linha) =>
            linha.includes(`"caminho":"/${PREFIXO_DE_VERSAO}/rota-que-nao-existe"`),
          ) ?? '';
      expect(
        linhaDaRotaInexistente,
        'a linha da rota inexistente não foi encontrada no registro',
      ).not.toBe('');
      expect(linhaDaRotaInexistente).toContain('token=[REDIGIDO]');

      // `callbackURL` continua LEGÍVEL, e isso é decisão registrada — a `DECISÃO FECHADA — T1 (F1)
      // / Gate 1 (CRIT-001) + decisão do usuário` de `packages/shared/src/log.ts` fixa que ele é
      // ALVO DE RETORNO, não credencial: redigi-lo não tira segredo nenhum e apaga para onde a
      // pessoa foi mandada, que é o diagnóstico que o registro existe para preservar. O cartão desta
      // task (§6.6) PEDIA `callbackURL=[REDIGIDO]` — ficara para trás da correção que o cartão da
      // T1 recebeu na época —, e o executor seguiu o marcador, que prevalece
      // (`.claude/rules/nao-regressao.md` §3). O orquestrador corrigiu a §6.6 em 2026-08-02: o
      // `Resultado esperado` fixa o `callbackURL` **intacto**, e a divergência deixou de existir.
      expect(linhaDaRotaInexistente).toContain(`callbackURL=${ALVO_DE_RETORNO}`);
      expect(linhaDaRotaInexistente).not.toContain('callbackURL=[REDIGIDO]');
    },
    LIMITE_CASO_MS,
  );
});

/**
 * Controlador-fixture do CT-020 (b) — a rota protegida que consulta dado de negócio.
 *
 * Ele existe **apenas neste arquivo**, e é montado apenas na aplicação instrumentada. O que ele
 * observa é o que nenhuma rota do produto desta fatia observaria:
 *
 *   * `contextoPublicado` distingue "a guarda publicou um contexto sem empresa" de "a guarda não
 *     publicou contexto nenhum" — dois estados que terminam na mesma leitura vazia, e só o primeiro
 *     é o comportamento entregue;
 *   * `vinculos` atravessa a unidade de trabalho REAL, com `SET LOCAL` e política — é o que faz o
 *     caso provar a cadeia inteira, e não apenas o armazenamento por continuação.
 *
 * Nada em `apps/api/src` ganhou símbolo, bandeira ou rota para ele existir: a rota é declarada aqui
 * e injetada pelo mecanismo do próprio arcabouço de teste, como o `ControladorQueFalha` do CT-006 em
 * `test/saude.e2e.spec.ts`.
 */
@Controller(CAMINHO_DOS_VINCULOS)
class ControladorDeVinculos {
  @Get()
  async listar(): Promise<LeituraDeVinculos> {
    const contexto = contextoDeTenant.corrente();
    const linhas = await acessoAoNegocio.emUnidadeDeTrabalho(
      async (tx) =>
        await tx<{ id: string }[]>`SELECT id FROM negocio.acesso_usuario_app ORDER BY id`,
    );

    return {
      contextoPublicado: contexto !== undefined,
      empresaIdDoContexto: contexto?.empresaId ?? null,
      vinculos: linhas.map((linha) => linha.id),
    };
  }

  /**
   * A MESMA leitura, publicada sob um método que admite corpo e sob um parâmetro de rota — é o que
   * permite ao quarto eixo do CT-020 (b) carregar os quatro vetores numa requisição só (o cliente
   * HTTP do runtime recusa emitir corpo em `GET`, e parâmetro de rota exige segmento).
   *
   * Ele **delega** a {@link listar}, e não reimplementa: o código que lê é o mesmo, e a única
   * diferença entre os dois eixos é o envelope do pedido — que é exatamente o que está sob teste.
   * Note que nada aqui declara `@Param`, `@Query`, `@Body` ou `@Headers`: **nada do pedido chega ao
   * manipulador, de propósito**. Se a resposta mudar quando o pedido carregar uma empresa, quem
   * mudou foi a GUARDA, que é o sujeito do eixo.
   *
   * O `@HttpCode(200)` só desfaz o `201` que o arcabouço dá a `POST` por padrão: com ele a resposta
   * do eixo forjado é comparável à dos outros três **campo a campo, status inclusive**, em vez de
   * exigir uma asserção diferente por um detalhe que nada tem a ver com contexto de tenant.
   */
  @Post(':empresaIdDoPedido')
  @HttpCode(200)
  async listarComPedidoForjado(): Promise<LeituraDeVinculos> {
    return await this.listar();
  }
}

/** O que o controlador-fixture observa. Extraído porque os dois manipuladores devolvem o mesmo. */
interface LeituraDeVinculos {
  contextoPublicado: boolean;
  empresaIdDoContexto: string | null;
  vinculos: string[];
}

/** Identificadores de um conjunto de vínculos da carga, na ordem em que o banco os devolve. */
function identificadoresOrdenados(acessos: readonly { readonly id: string }[]): string[] {
  return acessos.map((acesso) => acesso.id).sort();
}

/** Largura de um nível na árvore que o roteador imprime — `'│   '`, `'    '`, `'├── '`, `'└── '`. */
const LARGURA_DO_NIVEL_DA_ARVORE = 4;

/**
 * Extrai a tabela de rotas do roteador a partir da árvore que o adaptador HTTP imprime.
 *
 * **Por que esta é a fonte do inventário.** A alternativa — o gancho `onRoute` — só enxerga o que é
 * registrado DEPOIS dela, e a instalação do gancho só é possível depois de `criarAplicacao()`.
 * Tudo o que a montagem registra direto no adaptador (hoje as oito rotas do contrato, por
 * `SwaggerModule.setup`; amanhã um plugin novo, outra página, uma rota escrita à mão em
 * `app.getHttpAdapter().getInstance().get(...)`) nasce **público e invisível ao gancho** — o modo
 * de falha *"superfície aberta silenciosa"* que a §11.1 da tech spec existe para pegar. A tabela do
 * roteador não tem esse ponto cego: ela é o estado final, e nela está tudo o que foi registrado,
 * antes ou depois de qualquer gancho.
 *
 * **Como se lê a árvore.** Cada linha é um NÓ, e o caminho de uma rota é a concatenação dos rótulos
 * dos ancestrais dela — a impressão fatora prefixo comum, de modo que `/v1/auth/*` aparece como
 * `v1/` → `auth/` → `*`. O nível é dado pela coluna em que o traço da ramificação começa. Só os nós
 * que declaram métodos entre parênteses são rota; os demais são apenas prefixo.
 *
 * **Risco residual, nomeado.** Isto cobre o que passa pelo roteador do adaptador HTTP, que é onde a
 * guarda atua. Fica de fora quem responde SEM passar por ele: um ouvinte instalado direto no
 * servidor HTTP do runtime, um manipulador de "não encontrado" que passe a atender, ou um segundo
 * servidor em outra porta. Nenhum deles existe hoje, nenhum é alcançável pela guarda, e detectá-los
 * exigiria varrer o fonte em vez de perguntar ao roteador — que é a troca de prova comportamental
 * por prova estática que este caso evita de propósito.
 */
function rotasDaTabelaDoRoteador(arvore: string): RotaRegistrada[] {
  const rotulos: string[] = [];
  const rotas: RotaRegistrada[] = [];

  for (const linha of arvore.split('\n')) {
    const coluna = linha.search(/[├└]/u);
    if (coluna < 0 || coluna % LARGURA_DO_NIVEL_DA_ARVORE !== 0) {
      continue;
    }

    const conteudo = linha.slice(coluna + LARGURA_DO_NIVEL_DA_ARVORE).trimEnd();
    const casamento = /^(.*?)(?: \(([^()]+)\))?$/u.exec(conteudo);
    if (casamento === null) {
      continue;
    }

    // Trunca em vez de sobrescrever: sair de um ramo profundo para um raso tem de descartar os
    // rótulos do ramo anterior, senão um caminho herdaria segmento de rota vizinha.
    rotulos.length = coluna / LARGURA_DO_NIVEL_DA_ARVORE;
    rotulos.push(casamento[1] ?? '');

    const metodos = casamento[2];
    if (metodos !== undefined) {
      rotas.push({ metodos: metodos.split(', '), url: rotulos.join('') });
    }
  }

  return rotas;
}

/**
 * Classifica cada rota registrada na aplicação real em pública ou protegida, **por comportamento**.
 *
 * O critério é o que a guarda de fato produz: `401` com o código {@link CodigoErro.NAO_AUTENTICADO}
 * é recusa DELA; qualquer outra resposta significa que a requisição atravessou. Classificar por
 * metadado leria o que o código declara; classificar assim lê o que ele faz — e é a diferença entre
 * auditar a intenção e auditar a proteção.
 *
 * `HEAD` é sondado como `GET` porque o adaptador HTTP o deriva do `GET` (`exposeHeadRoutes`): o
 * manipulador é o mesmo, e a marca da guarda é do manipulador.
 */
async function classificarRotas(): Promise<{ publicas: string[]; protegidas: string[] }> {
  const publicas: string[] = [];
  const protegidas: string[] = [];

  for (const url of [...new Set(rotasDoRoteador.map((rota) => rota.url))].sort()) {
    const metodos = rotasDoRoteador
      .filter((rota) => rota.url === url)
      .flatMap((rota) => rota.metodos);

    const resposta = await pedir(baseReal, url.replace('/*', `/${SEGMENTO_DE_SONDA}`), {
      metodo: metodoDeSonda(url, metodos),
    });

    const codigo = (resposta.corpo as { codigo?: unknown } | undefined)?.codigo;
    if (resposta.status === 401 && codigo === CodigoErro.NAO_AUTENTICADO) {
      protegidas.push(url);
    } else {
      publicas.push(url);
    }
  }

  return { publicas, protegidas };
}

/** O método com que uma rota é sondada. Rota que só aceite método inemitível é falha declarada. */
function metodoDeSonda(url: string, metodos: readonly string[]): string {
  const escolhido = metodos
    .map((metodo) => (metodo === 'HEAD' ? 'GET' : metodo))
    .find((metodo) => !METODOS_INDISPONIVEIS.has(metodo));

  if (escolhido === undefined) {
    throw new Error(
      `a rota ${url} só aceita métodos que o cliente HTTP não emite (${metodos.join(', ')}): ` +
        'ela não pode ser classificada, e classificá-la como pública seria mentira',
    );
  }

  return escolhido;
}

/** Os eventos do registro, um por linha, já desserializados. */
function linhasDoRegistro(registro: string): Record<string, unknown>[] {
  return registro
    .split('\n')
    .filter((linha) => linha.length > 0)
    .map((linha) => JSON.parse(linha) as Record<string, unknown>);
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
  /** Cabeçalhos além dos fixos. Existe para o quarto eixo do CT-020 (b) plantar os vetores dele. */
  readonly cabecalhos?: Readonly<Record<string, string>>;
}

/**
 * Executa uma requisição HTTP real contra a aplicação informada.
 *
 * O cabeçalho `Origin` acompanha toda requisição com a MESMA origem da aplicação alvo — é o que um
 * navegador enviaria, e é o que o arcabouço confere nas requisições que carregam cookie. Ele é
 * composto da mesma fonte que o endereço base, e não escrito à mão.
 */
async function pedir(
  base: string,
  caminho: string,
  opcoes: OpcoesDoPedido = {},
): Promise<Resposta> {
  const cabecalhos: Record<string, string> = { connection: 'close', origin: base };
  if (opcoes.corpo !== undefined) {
    cabecalhos['content-type'] = 'application/json';
  }
  if (opcoes.cookie !== undefined) {
    cabecalhos.cookie = opcoes.cookie;
  }
  for (const [nome, valor] of Object.entries(opcoes.cabecalhos ?? {})) {
    cabecalhos[nome] = valor;
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

/**
 * A MESMA leitura do CT-020 (b), pedida com TODOS os vetores de entrada do pedido apontando para
 * `EMPRESA_B` — o lado negativo do CA-01, e o único lugar onde a lista de vetores mora.
 *
 * São cinco, na MESMA requisição: cabeçalho ({@link CABECALHOS_DE_EMPRESA_FORJADA}), cadeia de
 * consulta e corpo ({@link CAMPOS_DE_EMPRESA_FORJADA}), parâmetro de rota (o segmento final) e um
 * cookie ({@link COOKIE_DE_EMPRESA_FORJADA}) ao lado do de sessão. O cookie entra porque ele é
 * entrada do cliente como qualquer outra — só o de SESSÃO é credencial, e a diferença entre os dois
 * é justamente o que o cabeçalho de `contexto.guard.ts` afirma.
 *
 * **Por que `POST`**: o vetor "campo de corpo" exige método que admita corpo — o cliente HTTP do
 * runtime recusa emitir corpo em `GET` — e o parâmetro de rota exige um segmento. O
 * controlador-fixture publica o MESMO manipulador sob `POST /:empresaIdDoPedido` (ver
 * {@link ControladorDeVinculos.listarComPedidoForjado}) para que os cinco caibam numa requisição
 * só. Um vetor por vez, em requisições separadas, provaria caminhos; juntos, provam indiferença.
 *
 * A empresa forjada é sempre `EMPRESA_B`, e por isso o eixo roda nas sessões de `ADMIN_DE_A` e do
 * Master: forjá-la na sessão do próprio Admin de B seria tautológico.
 */
async function pedirComEmpresaForjada(cookieDeSessao: string): Promise<Resposta> {
  const forjada = EMPRESA_B.id;
  const cadeiaDeConsulta = CAMPOS_DE_EMPRESA_FORJADA.map(
    (campo) => `${campo}=${encodeURIComponent(forjada)}`,
  ).join('&');

  return await pedir(
    baseInstrumentada,
    `/${PREFIXO_DE_VERSAO}/${CAMINHO_DOS_VINCULOS}/${forjada}?${cadeiaDeConsulta}`,
    {
      metodo: 'POST',
      cookie: `${cookieDeSessao}; ${COOKIE_DE_EMPRESA_FORJADA}=${forjada}`,
      cabecalhos: Object.fromEntries(CABECALHOS_DE_EMPRESA_FORJADA.map((nome) => [nome, forjada])),
      corpo: Object.fromEntries(CAMPOS_DE_EMPRESA_FORJADA.map((campo) => [campo, forjada])),
    },
  );
}

/**
 * Entra pelo caminho REAL — a rota pública de entrada — e devolve o cookie de sessão.
 *
 * É o padrão que a T10 deve **reusar** para chegar à sessão do Master (CT-019), em vez de escrever
 * um segundo: a sessão nasce da rota que a operação usa, e nenhum estado é forjado no banco.
 */
async function entrar(base: string, email: string): Promise<string> {
  const entrada = await pedir(base, `${PREFIXO_DAS_ROTAS_DE_IDENTIDADE}/sign-in/email`, {
    metodo: 'POST',
    corpo: { email, password: SENHA_DA_CARGA },
  });

  if (entrada.status !== 200) {
    throw new Error(`a entrada de ${email} respondeu ${String(entrada.status)}: ${entrada.texto}`);
  }

  return credencialDeSessao(entrada);
}

/**
 * Entra e **cumpre a exigência de segundo fator**, pelo caminho público real.
 *
 * O Master nasce da carga sem segundo fator configurado, e a sessão dele é restrita até que ele o
 * configure (RN-08). Este helper percorre a sequência que o CT-019 da T10 prova — entrar, preparar
 * (`two-factor/enable`) e verificar (`two-factor/verify-totp`) —, e existe aqui porque o CT-020 (b)
 * precisa de uma sessão de Master **plena** para exercitar o contexto na unidade de trabalho.
 *
 * Nada é forjado: o segredo sai do endereço que a própria resposta do preparo devolveu, e o código
 * é derivado pela função de geração **do arcabouço**. A verificação emite credencial de sessão nova
 * e apaga a anterior, e é a nova que sai daqui.
 */
async function entrarComSegundoFatorCumprido(base: string, email: string): Promise<string> {
  const cookie = await entrar(base, email);

  const preparo = await pedir(base, `${PREFIXO_DAS_ROTAS_DE_IDENTIDADE}/two-factor/enable`, {
    metodo: 'POST',
    cookie,
    corpo: { password: SENHA_DA_CARGA },
  });

  if (preparo.status !== 200) {
    throw new Error(
      `o preparo do segundo fator respondeu ${String(preparo.status)}: ${preparo.texto}`,
    );
  }

  const totpURI = (preparo.corpo as { totpURI?: unknown }).totpURI;
  if (typeof totpURI !== 'string') {
    throw new Error('o preparo do segundo fator não devolveu o endereço de configuração');
  }

  const ativacao = await pedir(base, `${PREFIXO_DAS_ROTAS_DE_IDENTIDADE}/two-factor/verify-totp`, {
    metodo: 'POST',
    cookie,
    corpo: { code: await codigoDoSegundoFator(totpURI) },
  });

  if (ativacao.status !== 200) {
    throw new Error(
      `a ativação do segundo fator respondeu ${String(ativacao.status)}: ${ativacao.texto}`,
    );
  }

  return credencialDeSessao(ativacao);
}

/** Desfaz o segundo fator pela rota pública, devolvendo a pessoa ao estado da carga. */
async function desfazerSegundoFator(base: string, cookie: string): Promise<void> {
  const desfeito = await pedir(base, `${PREFIXO_DAS_ROTAS_DE_IDENTIDADE}/two-factor/disable`, {
    metodo: 'POST',
    cookie,
    corpo: { password: SENHA_DA_CARGA },
  });

  if (desfeito.status !== 200) {
    throw new Error(
      `a desativação do segundo fator respondeu ${String(desfeito.status)}: ${desfeito.texto}`,
    );
  }
}

/**
 * Deriva o código do segundo fator a partir do endereço de configuração.
 *
 * A derivação é a **do próprio arcabouço** (`api.generateTOTP`), e não uma reimplementação: uma
 * cópia do algoritmo provaria que duas implementações concordam, não que a nossa confere o código
 * que o arcabouço espera. Só a decodificação de transporte (base32 do endereço) é local, porque o
 * decodificador do arcabouço vive num pacote transitivo que `apps/api` não resolve.
 */
async function codigoDoSegundoFator(totpURI: string): Promise<string> {
  const codificado = new URL(totpURI).searchParams.get('secret');

  if (codificado === null) {
    throw new Error(`o endereço de configuração do segundo fator não trouxe segredo: ${totpURI}`);
  }

  const { code } = await identidade.autenticacao.api.generateTOTP({
    body: { secret: decodificarBase32(codificado) },
  });

  return code;
}

/** O par `nome=valor` do cookie de sessão, no formato em que o cliente o reenvia. */
function credencialDeSessao(resposta: Resposta): string {
  const cookie = resposta.cookies.find((candidato) =>
    (candidato.split(';')[0] ?? '').split('=')[0]?.trim().endsWith(SUFIXO_DO_COOKIE_DE_SESSAO),
  );

  if (cookie === undefined) {
    throw new Error('a entrada bem-sucedida não devolveu cookie de sessão');
  }

  return cookie.split(';')[0] ?? '';
}
