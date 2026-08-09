/**
 * As três provas de SEGURANÇA sobre as **33 rotas do domínio de locação da fatia
 * `cadastro-de-imoveis-e-pessoas`** (T11), mais as duas provas de que as **três ações sensíveis da
 * superfície de contrato são independentes entre si** (T7 e T8 da fatia `contratos-de-locacao`).
 *
 * SUT_IS_CORRECT_BECAUSE: o código de produção está certo e era a prosa deste arquivo que dizia "as
 * 33 rotas do domínio" como se fossem a superfície inteira. Elas são as **da fatia anterior**, e a
 * tabela {@link rotasDoDominio} continua descrevendo exatamente essas 33 — `ROTAS_DA_FATIA` **não
 * muda**, nenhuma asserção foi afrouxada e nenhum caso saiu. O que a T7 acrescenta é o `CT-320 (b)`,
 * sobre uma superfície que aquela tabela nunca cobriu: `/v1/contratos`.
 *
 * SUT_IS_CORRECT_BECAUSE: a T8 acrescenta o `CT-320 (c)`, sobre a MESMA superfície e pela mesma
 * razão — e o `describe` perde o numeral "três provas", que já estava vencido com quatro casos
 * dentro (débito **D33 · F2/T7**). O número vive nas âncoras logo abaixo, que são executáveis;
 * repeti-lo na prosa só criava um segundo lugar para envelhecer. `ROTAS_DA_FATIA` **não muda**,
 * nenhuma asserção foi afrouxada e nenhum caso saiu.
 *
 * ===========================================================================
 * INVARIANTES
 * ===========================================================================
 *
 * | Critério | Caso   | Invariante |
 * |---|---|---|
 * | CA-12 | CT-319 | Para **cada uma** das 33 rotas novas, uma sessão válida **sem** a chave da área
 * |       |        | correspondente recebe `403 ACESSO_NEGADO` com `detalhes.exigido` igual **àquela**
 * |       |        | chave — `TELA:imoveis` nas 15 de imóveis, `TELA:cadastros` nas 18 de pessoas —,
 * |       |        | nunca uma genérica; e a sessão que **tem** a chave recebe, nas MESMAS 33 rotas,
 * |       |        | resposta diferente de `403`. (ADR-0011) |
 * | CA-13 | CT-320 | Nas **10** rotas de circulação, a sessão que tem a ÁREA e **não** tem
 * |       |        | `ACAO:excluir_cadastro` recebe `403` nomeando **a ação** — e não a área, que ela
 * |       |        | possui —, e o cadastro permanece em circulação (`retiradoEm` nulo) na leitura
 * |       |        | seguinte. Concedida a ação à MESMA pessoa, a retirada responde `200` e a marca
 * |       |        | passa a preenchida. (ADR-0011, ADR-0018) |
 * | CA-14 | CT-321 | Nas rotas de `:id` das cinco entidades circuláveis, o cadastro de OUTRA empresa é
 * | CA-12 |        | indistinguível de inexistente: `404` com corpos **profundamente iguais**, e o
 * |       |        | estado do cadastro alheio é idêntico, campo a campo, depois das tentativas. A
 * |       |        | mesma sessão alcança o cadastro PRÓPRIO com `200`. (ADR-0008, ADR-0017) |
 *
 * | CA-16 | CT-320 | Na rota de **ativação** de contrato, a sessão que tem a área **e a outra ação
 * |       | (b)    | sensível da mesma superfície** (`ACAO:excluir_cadastro`) — provada por retirar e
 * |       |        | recircular o contrato com `200` — recebe `403` nomeando `ACAO:ativar_contrato`
 * |       |        | ao tentar ativar; o contrato segue `RASCUNHO` e o imóvel `DISPONIVEL`. As duas
 * |       |        | ações são **independentes**: ter uma não substitui a outra. (ADR-0018,
 * |       |        | ADR-0019) |
 * | CA-17 | CT-320 | Na rota de **cancelamento**, a sessão que tem a área **e as DUAS outras ações
 * |       | (c)    | sensíveis** da mesma superfície (`ACAO:excluir_cadastro` e
 * |       |        | `ACAO:ativar_contrato`) — provadas por ativar, retirar e recircular com `200` —
 * |       |        | recebe `403` nomeando `ACAO:cancelar_contrato`; o contrato segue `ATIVO` e o
 * |       |        | imóvel `LOCADO`. As três ações são independentes duas a duas, e reaproveitar
 * |       |        | `ACAO:excluir_cadastro` para cancelar é o que a ADR-0019 rejeita
 * |       |        | **nominalmente**. (ADR-0018, ADR-0019) |
 *
 * Rastreabilidade: `CA-12 → CT-319 (RN-14)`, `CA-13 → CT-320 (RN-14)`, `CA-14 → CT-321 (RN-01)`,
 * `CA-16 → CT-320 (b) (RN-13)`, `CA-17 → CT-320 (c) (RN-07)`.
 *
 * ===========================================================================
 * POR QUE O CT-320 (b) E O (c) NÃO SÃO O CT-425 E O CT-426 OUTRA VEZ
 * ===========================================================================
 *
 * O `CT-425` e o `CT-426`, em `test/contratos.e2e.spec.ts`, medem sessões que **não têm** a ação da
 * rota que tentam — e o que eles prendem é a **forma** da recusa. Estes dois medem sessões que **têm
 * as outras ações da mesma superfície**, e o que eles prendem é outra coisa: que **ter uma ação da
 * superfície não dá as demais**. É a diferença entre acusar um corpo de erro errado e mostrar a
 * **escalada**.
 *
 * A distinção não é acadêmica, e nomeia o erro mais provável deste controlador: as **quatro** rotas
 * que declaram no método são adjacentes no fonte, e duas delas exigem `ACAO:excluir_cadastro`. Uma
 * ativação que copiasse a linha de cima exigiria a ação errada — e a sessão do `(b)`, que **tem** a
 * de circulação, seria admitida a ativar. O cancelamento tem **duas** vizinhas de onde copiar, e é
 * por isso que a sessão do `(c)` carrega as duas: com qualquer uma delas exigida por engano, a rota
 * responderia `200`, e nenhum dos casos de `contratos.e2e.spec.ts` mostraria isso. O eixo positivo
 * de cada um — as rotas que a MESMA sessão alcança com `200` — é o que torna o `403` atribuível à
 * ação que falta, e não à que ela tem.
 *
 * No `(c)` o eixo positivo tem uma segunda função, e ela é necessária: a ativação **precisa** vir
 * antes, senão o contrato seria um rascunho e a recusa do cancelamento poderia ser a `422` da guarda
 * de **estado** em vez da `403` da guarda de autorização.
 *
 * ===========================================================================
 * A tabela das 33 rotas é DERIVADA, e não redigitada
 * ===========================================================================
 *
 * {@link rotasDoDominio} é composta a partir dos donos de segmento (`CAMINHO_DOS_CONJUNTOS`,
 * `CAMINHO_DOS_IMOVEIS`, `CAMINHO_DOS_COMODOS` e os três de cadastro de pessoa), do mesmo modo que o
 * inventário do `CT-318`. A razão é a que a §6.6 da task registra: *"uma rota nova que ninguém
 * acrescentasse à tabela ficaria sem prova comportamental, enquanto o CT-318 (declarativo) a
 * pegaria"*. Os dois se cobrem — um lê o metadado da superfície publicada, o outro **sonda o
 * comportamento** —, e a contagem de 33 é afirmada nos dois, porque tabela truncada em silêncio é o
 * modo de falha desta classe de caso.
 *
 * ===========================================================================
 * O EIXO POSITIVO é obrigatório nos três casos
 * ===========================================================================
 *
 * Uma guarda que recusasse **tudo** passaria os três eixos negativos inteiros. É a lição literal do
 * `VALORES_INVALIDOS` do `CT-011`, repetida em cada task desta fatia. Por isso:
 *
 *   * o `CT-319` percorre as MESMAS 33 rotas com a sessão que **tem** a área, e afirma que nenhuma
 *     responde `403`;
 *   * o `CT-320` concede a ação à mesma pessoa e afirma que a retirada passa a responder `200` com a
 *     marca preenchida — a mudança de comportamento é atribuível à chave, e a nada mais;
 *   * o `CT-321` faz a sessão da empresa B alcançar um cadastro **próprio** com `200`, o que separa
 *     "esta sessão não alcança o alheio" de "esta sessão está quebrada".
 *
 * ===========================================================================
 * Por que as duas FAMÍLIAS de área entram no CT-320
 * ===========================================================================
 *
 * `MAPA_ACAO_TELA['ACAO:excluir_cadastro']` é `TELA:cadastros`. Nas rotas de pessoa, portanto, a área
 * da classe **coincide** com a tela que o catálogo associa à ação — e uma recusa que nomeasse a área
 * pareceria certa por acidente. Nas rotas de imóvel a área é `TELA:imoveis`, e ali a coincidência não
 * existe: uma recusa que nomeasse a área diria `TELA:imoveis` onde o contrato exige
 * `ACAO:excluir_cadastro`, e reprovaria. Por isso o caso usa **as duas famílias**, e não uma.
 *
 * ===========================================================================
 * MUTANTES EXECUTADOS — MT11-4 e MT11-5 (2026-08-06)
 * ===========================================================================
 *
 * Os dois foram aplicados ao MESMO ponto — a declaração de exigência de `POST /v1/imoveis/:id/
 * retirada`, em `apps/api/src/imoveis/imovel.controller.ts` — e cada um reprova um caso diferente. A
 * suíte foi invocada com a compilação do pacote antes do `vitest` (`tsc --build`), nunca por
 * `vitest run` sobre um `dist/` velho. **Nenhum deles tocou o código sob o marcador `DECISÃO
 * FECHADA` de `conjunto.controller.ts`** — a medição corre no gêmeo, que declara a mesma conjunção
 * por referência àquele marcador.
 *
 *   * **controle** — árvore íntegra: `3 passed` neste arquivo;
 *   * **MT11-4 · a ação sensível desaparece da rota** (`@ExigeChaves(AREA, ACAO)` → `@ExigeChave
 *     (AREA)`): `1 failed`, no **`CT-320`**, com a mensagem *"POST /v1/imoveis/<id>/retirada
 *     respondeu 200: expected 200 to be 403"*. É o defeito de quem confia só na área: a sessão que
 *     tem a área e não tem a ação passa a retirar cadastro;
 *   * **MT11-5 · a declaração do MÉTODO SUBSTITUI a da classe** (`@ExigeChaves(AREA, ACAO)` →
 *     `@ExigeChave(ACAO)`) — o defeito literal que a **ADR-0018** nasceu para impedir: `1 failed`,
 *     no **`CT-319`**, com a mensagem *"a recusa de POST /v1/imoveis/:id/retirada mudou de forma:
 *     `exigido` `TELA:imoveis` → `ACAO:excluir_cadastro`"*. Note que o `CT-320` **sobreviveria** a
 *     este segundo mutante (a sessão dele continua sem a ação, e a recusa continua nomeando a ação),
 *     e o `CT-355` o pegaria por estrutura: são três redes sobre o mesmo defeito, por três caminhos,
 *     e é isso que torna a ADR-0018 verificável em vez de prometida;
 *   * **reversão** — o fonte foi restaurado e conferido por `git diff` vazio, e o controle voltou a
 *     `3 passed`.
 *
 * ---------------------------------------------------------------------------
 * MUTANTES DA T8 — MT8-3 e MT8-4 (2026-08-09), o par que mede a ESCALADA
 * ---------------------------------------------------------------------------
 *
 * Os dois foram aplicados ao MESMO ponto — a constante `ACAO_DE_CANCELAMENTO` de
 * `apps/api/src/contratos/contrato.controller.ts`, que é o que a rota de cancelamento exige além da
 * área —, e cada um troca a ação por **uma das duas vizinhas** dela no fonte. A suíte foi invocada
 * pelo script do pacote (`pnpm --filter @sysloc/api test`). **Controle**: `151 passed`.
 *
 *   * **MT8-3 · a ação vira a da vizinha de CIMA** (`ACAO:cancelar_contrato` →
 *     `ACAO:ativar_contrato`): `2 failed | 149 passed`, no **`CT-320 (c)`** — `expected 200 to be
 *     403`, isto é, **quem pode ativar passaria a cancelar** — e no `CT-426` de
 *     `test/contratos.e2e.spec.ts`, na mesma forma;
 *   * **MT8-4 · a ação vira a da vizinha de BAIXO** (`ACAO:cancelar_contrato` →
 *     `ACAO:excluir_cadastro`): `2 failed | 149 passed`, e os dois falham de formas **diferentes** —
 *     o `CT-320 (c)` com `expected 200 to be 403` (quem administra a circulação passaria a destravar
 *     imóveis, que é o efeito que a ADR-0019 rejeita **nominalmente**) e o `CT-426` na **igualdade
 *     do corpo** da recusa, porque a sessão dele não tem aquela ação. É a divisão de trabalho entre
 *     os dois casos, medida: um acusa a **forma** da recusa, o outro mostra a **escalada**;
 *   * **reversão** — o fonte foi restaurado do backup e conferido idêntico ao original por `diff -q`,
 *     `pnpm build` refeito, e o controle voltou a `151 passed`.
 *
 * A âncora destes registros é **simbólica** — a constante `ACAO_DE_CANCELAMENTO` do controlador de
 * contrato —, e nunca número de linha.
 *
 * As âncoras destes registros são **simbólicas** — o `@ExigeChaves` do manipulador de retirada de
 * `imovel.controller.ts` —, e nunca número de linha.
 *
 * ===========================================================================
 * Precondição privilegiada — tudo pelo caminho REAL
 * ===========================================================================
 *
 * Nenhum estado é forjado e nenhum símbolo foi acrescentado a `apps/api/src/**` para estes casos
 * existirem (Iron Law #6):
 *
 *   * **sessão** — pela rota pública de entrada (`entrar`), com a senha da carga; a pessoa exclusiva
 *     do `CT-320` nasce por `POST /v1/usuarios` (a rota real do Admin) e cumpre a troca obrigatória
 *     por `POST /v1/sessao/senha`, como em `circulacao-de-cadastro.e2e.spec.ts`;
 *   * **permissão** — por `escreverAjustes` sob `contextoDeTenant.executarCom` da empresa da pessoa,
 *     com `validarCoerenciaDeAjustes` (a regra de domínio de verdade), e o efetivo resultante é
 *     **AFIRMADO por `GET /v1/sessao`** antes de cada fluxo, nunca presumido. A sessão sem área
 *     recebe a **NEGAÇÃO explícita** das duas chaves: o efetivo é `(matriz do perfil ∪ concedidas) −
 *     negadas`, e sem a negação o piso do perfil poderia já conceder a área;
 *   * **cadastro** — criado e retirado **pelas rotas**, nunca por conexão privilegiada. Nenhuma
 *     cláusula deste arquivo compara `empresa_id`: o isolamento é observado pela resposta da borda,
 *     que é o que a ADR-0008 autoriza.
 *
 * Cada caso arranja o **próprio sujeito**: a pessoa cujo efetivo o `CT-320` altera não é usada por
 * nenhum outro caso, e nenhuma sessão é compartilhada entre casos que escrevem permissão.
 *
 * ===========================================================================
 * De onde vêm o banco, a fila e a credencial (ADR-0006)
 * ===========================================================================
 *
 * De instâncias efêmeras próprias. Nenhuma coordenada de conexão é lida do ambiente: o ambiente do
 * processo é MONTADO a partir do que os helpers devolvem. A porta é **reservada** (trava atômica), e
 * não dinâmica, pela razão que a T8 da fatia anterior registrou: o arcabouço confere a origem das
 * requisições com cookie contra o endereço base, composto a partir da porta CONFIGURADA.
 */

import { randomBytes, randomUUID } from 'node:crypto';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { type ChaveDoCatalogo, validarCoerenciaDeAjustes } from '@sysloc/auth';
import {
  type AcessoAoBanco,
  abrirAcessoAoBanco,
  contextoDeTenant,
  EMPRESA_A,
  escreverAjustes,
  SENHA_DA_CARGA,
} from '@sysloc/db';
import { CodigoErro } from '@sysloc/shared';
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
//        nenhum deles no escopo desta task, e o índice de débitos do `CLAUDE.md`.
// ÍNDICE: docs/specs/features/fundacao-stack-nativa/v1/_run/run-report.md §2, D28
import {
  type IdentidadeEfemera,
  identidadeEfemera,
  pessoaSemeada,
} from '../../../packages/auth/test/identidade-efemera.ts';
import { reservarPorta } from '../../../packages/shared/test/efemero-comum.ts';
import { type FilaEfemera, redisEfemero } from '../../../packages/shared/test/redis-efemero.ts';
import { PREFIXO_DAS_ROTAS_DE_IDENTIDADE } from '../src/autenticacao/autenticacao.module.ts';
import { CAMINHO_DA_TROCA_DE_SENHA_DO_PRODUTO } from '../src/autenticacao/senha.controller.ts';
import { CAMINHO_DA_SESSAO } from '../src/autenticacao/sessao.controller.ts';
import { CAMINHO_DOS_FIADORES } from '../src/cadastros/fiador.controller.ts';
import { CAMINHO_DOS_LOCADORES } from '../src/cadastros/locador.controller.ts';
import { CAMINHO_DOS_LOCATARIOS } from '../src/cadastros/locatario.controller.ts';
import { ENDERECO_DE_ESCUTA, PREFIXO_DE_VERSAO } from '../src/configuracao/ambiente.ts';
import { CAMINHO_DOS_CONTRATOS } from '../src/contratos/contrato.controller.ts';
import { CAMINHO_DOS_COMODOS } from '../src/imoveis/comodo.controller.ts';
import { CAMINHO_DOS_CONJUNTOS } from '../src/imoveis/conjunto.controller.ts';
import { CAMINHO_DOS_IMOVEIS } from '../src/imoveis/imovel.controller.ts';
import { criarAplicacao } from '../src/main.ts';
import { CAMINHO_DOS_USUARIOS } from '../src/usuarios/usuario.controller.ts';
import { cpfValido } from './documento.ts';

/** Limite da montagem: banco migrado, semente, fila, aplicação e o arranjo das quatro sessões. */
const LIMITE_DE_MONTAGEM_MS = 240_000;

/** Limite de um caso que atravessa HTTP dezenas de vezes. */
const LIMITE_CASO_MS = 120_000;

/** Sufixo do nome do cookie de sessão do arcabouço — o prefixo vem da configuração. */
const SUFIXO_DO_COOKIE_DE_SESSAO = 'session_token';

/** A rota pública de entrada do arcabouço de identidade. */
const ROTA_DE_ENTRADA = `${PREFIXO_DAS_ROTAS_DE_IDENTIDADE}/sign-in/email`;

/** A rota de troca de senha **do produto** — a que baixa a marca de senha provisória (RN-09). */
const ROTA_DE_TROCA_DE_SENHA = `/${PREFIXO_DE_VERSAO}/${CAMINHO_DA_TROCA_DE_SENHA_DO_PRODUTO}`;

/** A rota que publica o efetivo da sessão corrente — onde toda precondição é AFIRMADA. */
const CAMINHO_DA_SESSAO_CORRENTE = `/${PREFIXO_DE_VERSAO}/${CAMINHO_DA_SESSAO}`;

/** A rota do Admin por onde a pessoa exclusiva do CT-320 nasce. */
const CAMINHO_DAS_PESSOAS = `/${PREFIXO_DE_VERSAO}/${CAMINHO_DOS_USUARIOS}`;

/** A senha definitiva com que a pessoa criada pelo Admin passa a operar. */
const SENHA_TROCADA = 'brisa9Verde!';

/** As duas áreas de tela que governam a superfície nova (§4.1, §11.2). */
const AREA_DOS_IMOVEIS: ChaveDoCatalogo = 'TELA:imoveis';
const AREA_DOS_CADASTROS: ChaveDoCatalogo = 'TELA:cadastros';

/** A ação sensível que as 10 rotas de circulação exigem **além** da área (ADR-0011, ADR-0018). */
const ACAO_SENSIVEL: ChaveDoCatalogo = 'ACAO:excluir_cadastro';

/**
 * A área e as **duas** ações sensíveis próprias da superfície de contrato — o eixo do `CT-320 (b)` e
 * do `CT-320 (c)` (ADR-0019).
 *
 * As duas ações são **independentes**, e é a independência que os dois casos medem por ângulos
 * opostos: o `(b)` prova que ter a de circulação não dá a de ativar; o `(c)`, que ter as de circulação
 * **e** de ativar não dá a de cancelar. A ADR-0019 rejeita **nominalmente** reaproveitar
 * `ACAO:excluir_cadastro` para cancelar, e a razão é de efeito — retirar de circulação não libera o
 * imóvel, cancelar libera.
 */
const AREA_DOS_CONTRATOS: ChaveDoCatalogo = 'TELA:contratos';
const ACAO_DE_ATIVAR_CONTRATO: ChaveDoCatalogo = 'ACAO:ativar_contrato';
const ACAO_DE_CANCELAR_CONTRATO: ChaveDoCatalogo = 'ACAO:cancelar_contrato';

/** A coleção de contratos, sob o prefixo de versão — a superfície que o `CT-320 (b)` sonda. */
const COLECAO_DE_CONTRATOS = `/${PREFIXO_DE_VERSAO}/${CAMINHO_DOS_CONTRATOS}`;

/** A mensagem canônica da recusa de autorização — literal, e não importada da guarda. */
const MENSAGEM_DE_ACESSO_NEGADO = 'acesso negado para esta sessão';

/** A mensagem canônica do recurso não encontrado. */
const MENSAGEM_DE_NAO_ENCONTRADO = 'recurso não encontrado';

/** Um identificador bem formado que não existe em empresa alguma — o controle do `CT-321`. */
const UUID_INEXISTENTE = '99999999-9999-4999-8999-999999999999';

/** Quantas rotas a fatia publica — a âncora contra tabela truncada em silêncio. */
const ROTAS_DA_FATIA = 33;

/** Quantas delas exigem a ação sensível: cinco entidades circuláveis × duas transições. */
const ROTAS_DE_CIRCULACAO = 10;

/** A pessoa cujo efetivo o `CT-319` NEGA — `USUARIO_EMPRESA` da empresa A, da carga. */
const QUEM_NAO_ALCANCA = pessoaSemeada('usuario.a@exemplo.com.br');

/** O Admin da empresa A: a matriz do perfil dele é o catálogo inteiro (as 17 chaves). */
const ADMIN_DE_A = pessoaSemeada('admin.a@exemplo.com.br');

/** O Admin da empresa B — a outra ponta do `CT-321`, com a mesma matriz plena na empresa dele. */
const ADMIN_DE_B = pessoaSemeada('admin.b@exemplo.com.br');

let identidade: IdentidadeEfemera;
let fila: FilaEfemera;
let acessoAoNegocio: AcessoAoBanco;
let aplicacao: NestFastifyApplication;
let base: string;
let ambienteAnterior: NodeJS.ProcessEnv;

/** A sessão plena da empresa A — cria os recursos e é o eixo positivo do `CT-319`. */
let cookiePleno: string;

/** A sessão da empresa A a quem as DUAS áreas foram explicitamente negadas. */
let cookieSemArea: string;

/** A sessão plena da empresa B — a outra ponta do `CT-321`. */
let cookieDeB: string;

/** Os recursos da empresa A que a tabela das 33 rotas endereça. */
let alvos: AlvosDoDominio;

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

  aplicacao = await criarAplicacao();
  await aplicacao.listen({ port: porta, host: ENDERECO_DE_ESCUTA });

  cookiePleno = await entrar(ADMIN_DE_A.email, SENHA_DA_CARGA);
  cookieDeB = await entrar(ADMIN_DE_B.email, SENHA_DA_CARGA);

  // A NEGAÇÃO explícita das duas áreas — ver o cabeçalho: sem ela, um piso de perfil que já
  // concedesse a área faria o eixo negativo do `CT-319` provar outra coisa.
  cookieSemArea = await entrar(QUEM_NAO_ALCANCA.email, SENHA_DA_CARGA);
  await ajustar(QUEM_NAO_ALCANCA.id, EMPRESA_A.id, [
    { chave: AREA_DOS_IMOVEIS, efeito: 'NEGADA' },
    { chave: AREA_DOS_CADASTROS, efeito: 'NEGADA' },
  ]);

  alvos = await criarAlvosDoDominio(cookiePleno);
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

describe('as provas de segurança sobre as rotas do domínio (T11) e sobre as ações do contrato', () => {
  it(
    'CT-319 — quem não alcança a área é recusado nas 33 rotas, com a chave DAQUELA área nomeada',
    async () => {
      const tabela = rotasDoDominio(alvos);

      // A tabela cobre a superfície inteira — afirmado sobre ela ANTES de percorrê-la. Tabela
      // truncada é o modo de falha silencioso desta classe de caso.
      expect(tabela.length).toBe(ROTAS_DA_FATIA);
      expect(tabela.filter((rota) => rota.area === AREA_DOS_IMOVEIS).length).toBe(15);
      expect(tabela.filter((rota) => rota.area === AREA_DOS_CADASTROS).length).toBe(18);

      // Precondição AFIRMADA: o efetivo publicado NÃO tem nenhuma das duas áreas.
      const semArea = await efetivoDe(cookieSemArea);
      expect(semArea.telas).not.toContain(AREA_DOS_IMOVEIS);
      expect(semArea.telas).not.toContain(AREA_DOS_CADASTROS);

      // E o da sessão plena TEM as duas, mais a ação — é o que dá sentido ao eixo positivo.
      const pleno = await efetivoDe(cookiePleno);
      expect(pleno.telas).toContain(AREA_DOS_IMOVEIS);
      expect(pleno.telas).toContain(AREA_DOS_CADASTROS);
      expect(pleno.acoes).toContain(ACAO_SENSIVEL);

      // --- Eixo NEGATIVO: as 33 rotas recusam, nomeando a chave DAQUELA área -------------------
      const recusadas: string[] = [];
      for (const rota of tabela) {
        const resposta = await pedir(rota.alvo, {
          metodo: rota.metodo,
          cookie: cookieSemArea,
          ...(rota.corpo === undefined ? {} : { corpo: rota.corpo }),
        });

        expect(resposta.status, `${rota.rotulo} respondeu ${String(resposta.status)}`).toBe(403);
        // Corpo INTEIRO por igualdade: `detalhes.exigido` é a chave da área **daquela** rota, e não
        // uma genérica. Uma recusa que nomeasse sempre a mesma chave reprova em metade da tabela.
        expect(resposta.corpo, `a recusa de ${rota.rotulo} mudou de forma`).toEqual({
          codigo: CodigoErro.ACESSO_NEGADO,
          mensagem: MENSAGEM_DE_ACESSO_NEGADO,
          detalhes: { exigido: rota.area },
        });
        recusadas.push(rota.rotulo);
      }
      expect(recusadas.length).toBe(ROTAS_DA_FATIA);

      // --- Eixo POSITIVO: nenhuma das 33 responde 403 a quem TEM a chave -----------------------
      // Sem ele, uma guarda que recusasse tudo passaria o eixo inteiro acima. A leva é NOVA: o eixo
      // positivo escreve de verdade — cria, altera, retira, recircula e remove o cômodo —, e reusar
      // os alvos do eixo negativo deixaria o `CT-320` observando o que este caso mexeu.
      //
      // A asserção é de SUCESSO (`2xx`), e não de "diferente de 403": as 33 requisições são
      // bem-formadas e endereçam recursos que existem, de modo que qualquer outra recusa — `404` de
      // alcance, `422` de esquema — também seria defeito. Um "diferente de 403" aceitaria a
      // superfície inteira respondendo `422`, que é o eixo positivo vazio.
      const alcancadas: string[] = [];
      for (const rota of rotasDoDominio(await criarAlvosDoDominio(cookiePleno))) {
        const resposta = await pedir(rota.alvo, {
          metodo: rota.metodo,
          cookie: cookiePleno,
          ...(rota.corpo === undefined ? {} : { corpo: rota.corpo }),
        });

        expect(
          { rotulo: rota.rotulo, sucesso: resposta.status >= 200 && resposta.status < 300 },
          `${rota.rotulo} respondeu ${String(resposta.status)} a quem TEM a chave: ${resposta.texto}`,
        ).toEqual({ rotulo: rota.rotulo, sucesso: true });
        alcancadas.push(rota.rotulo);
      }
      expect(alcancadas).toEqual(recusadas);
    },
    LIMITE_CASO_MS,
  );

  it(
    'CT-320 — retirar exige a ação sensível: a recusa nomeia a AÇÃO, e o cadastro segue em circulação',
    async () => {
      // Sujeito EXCLUSIVO deste caso: é o efetivo dele que o caso altera no passo positivo, e
      // compartilhá-lo faria os demais casos observarem uma permissão que este concedeu.
      const sujeito = await pessoaOperandoComSenhaTrocada('so.administra');
      await ajustar(sujeito.usuarioId, EMPRESA_A.id, [
        { chave: AREA_DOS_IMOVEIS, efeito: 'CONCEDIDA' },
        { chave: AREA_DOS_CADASTROS, efeito: 'CONCEDIDA' },
        // A NEGAÇÃO explícita da ação: é ela que torna o `403` atribuível à ação, e não ao piso.
        { chave: ACAO_SENSIVEL, efeito: 'NEGADA' },
      ]);

      // Precondição AFIRMADA: TEM as duas áreas, NÃO tem a ação. É o que discrimina — uma
      // implementação que exigisse só a área passaria o `403` de quem não tem nada e falharia aqui.
      const antes = await efetivoDe(sujeito.cookie);
      expect(antes.telas).toContain(AREA_DOS_IMOVEIS);
      expect(antes.telas).toContain(AREA_DOS_CADASTROS);
      expect(antes.acoes).not.toContain(ACAO_SENSIVEL);

      const circulaveis = entidadesCirculaveis(alvos);
      expect(circulaveis.length).toBe(5);
      // As DUAS famílias de área — ver o cabeçalho: nas de pessoa a área coincide com
      // `MAPA_ACAO_TELA[ACAO]`, e só nas de imóvel a coincidência não existe.
      expect(new Set(circulaveis.map((entidade) => entidade.area)).size).toBe(2);

      // --- Eixo NEGATIVO: as 10 rotas recusam nomeando a AÇÃO, e nada muda ---------------------
      const recusadas: string[] = [];
      for (const entidade of circulaveis) {
        for (const transicao of ['retirada', 'recirculacao'] as const) {
          const rotulo = `POST ${entidade.item}/${transicao}`;
          const resposta = await pedir(`${entidade.item}/${transicao}`, {
            metodo: 'POST',
            cookie: sujeito.cookie,
            corpo: {},
          });

          expect(resposta.status, `${rotulo} respondeu ${String(resposta.status)}`).toBe(403);
          // A chave nomeada é a AÇÃO — e **não** a área, que a sessão possui. Nomear a área seria a
          // recusa genérica que a ADR-0011 rejeita.
          expect(resposta.corpo, `a recusa de ${rotulo} mudou de forma`).toEqual({
            codigo: CodigoErro.ACESSO_NEGADO,
            mensagem: MENSAGEM_DE_ACESSO_NEGADO,
            detalhes: { exigido: ACAO_SENSIVEL },
          });

          // O ESTADO depois da recusa — é o que separa "recusou" de "recusou depois de gravar".
          expect(
            await marcaDeRetirada(entidade.item, sujeito.cookie),
            `${rotulo} recusou, mas mexeu na marca de circulação`,
          ).toBeNull();

          recusadas.push(rotulo);
        }
      }
      expect(recusadas.length).toBe(ROTAS_DE_CIRCULACAO);

      // --- Eixo POSITIVO: concedida a AÇÃO, a MESMA rota passa a responder 200 -----------------
      await ajustar(sujeito.usuarioId, EMPRESA_A.id, [
        { chave: AREA_DOS_IMOVEIS, efeito: 'CONCEDIDA' },
        { chave: AREA_DOS_CADASTROS, efeito: 'CONCEDIDA' },
        { chave: ACAO_SENSIVEL, efeito: 'CONCEDIDA' },
      ]);

      const depois = await efetivoDe(sujeito.cookie);
      expect(depois.acoes).toContain(ACAO_SENSIVEL);

      for (const entidade of circulaveis) {
        const retirada = await pedir(`${entidade.item}/retirada`, {
          metodo: 'POST',
          cookie: sujeito.cookie,
          corpo: {},
        });

        expect(
          retirada.status,
          `a retirada de ${entidade.item} respondeu ${String(retirada.status)}: ${retirada.texto}`,
        ).toBe(200);
        expect(await marcaDeRetirada(entidade.item, sujeito.cookie)).not.toBeNull();
      }
    },
    LIMITE_CASO_MS,
  );

  it(
    'CT-320 (b) — ter a ação de circulação não dá a de ativar: a recusa nomeia ACAO:ativar_contrato',
    async () => {
      // Sujeito EXCLUSIVO deste caso, pela mesma razão do `CT-320`: o efetivo dele é o que está sob
      // prova, e compartilhá-lo faria os demais casos observarem uma permissão que este escreveu.
      const sujeito = await pessoaOperandoComSenhaTrocada('so.circula.contrato');
      await ajustar(sujeito.usuarioId, EMPRESA_A.id, [
        { chave: AREA_DOS_CONTRATOS, efeito: 'CONCEDIDA' },
        { chave: AREA_DOS_IMOVEIS, efeito: 'CONCEDIDA' },
        { chave: AREA_DOS_CADASTROS, efeito: 'CONCEDIDA' },
        { chave: ACAO_SENSIVEL, efeito: 'CONCEDIDA' },
        // A NEGAÇÃO explícita da ação de ativar: é ela que torna o `403` atribuível a essa ação, e
        // não ao piso do perfil.
        { chave: ACAO_DE_ATIVAR_CONTRATO, efeito: 'NEGADA' },
      ]);

      // Precondição AFIRMADA nas TRÊS pontas, e as três importam: ela alcança a área da classe, TEM
      // a outra ação sensível da MESMA superfície, e NÃO tem a que está sob prova.
      const efetivo = await efetivoDe(sujeito.cookie);
      expect(efetivo.telas).toContain(AREA_DOS_CONTRATOS);
      expect(efetivo.acoes).toContain(ACAO_SENSIVEL);
      expect(efetivo.acoes).not.toContain(ACAO_DE_ATIVAR_CONTRATO);

      // --- Arranjo: um rascunho montado pela PRÓPRIA sessão -------------------------------------
      const partes = await criarAlvosDoDominio(sujeito.cookie);
      const criacao = await pedir(COLECAO_DE_CONTRATOS, {
        metodo: 'POST',
        cookie: sujeito.cookie,
        corpo: corpoDeContrato(partes),
      });
      expect(criacao.status, criacao.texto).toBe(201);
      const codigo = (criacao.corpo as { codigo: string }).codigo;

      // --- Eixo POSITIVO da ação que ela TEM: retirar e recircular respondem 200 ---------------
      //
      // Ele vem ANTES do eixo negativo de propósito: sem ele, o `403` da ativação seria compatível
      // com uma sessão que não alcança nada da superfície, e o caso não diria nada sobre a
      // independência entre as duas ações.
      for (const transicao of ['retirada', 'recirculacao'] as const) {
        const aceita = await pedir(`${COLECAO_DE_CONTRATOS}/${codigo}/${transicao}`, {
          metodo: 'POST',
          cookie: sujeito.cookie,
          corpo: {},
        });

        expect(aceita.status, `${transicao}: ${aceita.texto}`).toBe(200);
      }

      // --- Eixo NEGATIVO: ativar recusa, nomeando a ação que FALTA -----------------------------
      const recusada = await pedir(`${COLECAO_DE_CONTRATOS}/${codigo}/ativacao`, {
        metodo: 'POST',
        cookie: sujeito.cookie,
        corpo: {},
      });

      expect(recusada.status).toBe(403);
      // Corpo INTEIRO por igualdade, e `exigido` nomeando **`ACAO:ativar_contrato`**. É esta linha
      // que acusa a rota que declarasse a ação errada por cópia da vizinha: com a sessão possuindo
      // `ACAO:excluir_cadastro`, uma exigência copiada responderia `200` aqui.
      expect(recusada.corpo).toEqual({
        codigo: CodigoErro.ACESSO_NEGADO,
        mensagem: MENSAGEM_DE_ACESSO_NEGADO,
        detalhes: { exigido: ACAO_DE_ATIVAR_CONTRATO },
      });

      // --- E NADA transitou --------------------------------------------------------------------
      //
      // A recusa sozinha não prova ausência de efeito: uma implementação que gravasse e só então
      // recusasse passaria em tudo acima e reprovaria aqui.
      const contrato = await pedir(`${COLECAO_DE_CONTRATOS}/${codigo}`, { cookie: sujeito.cookie });
      expect(contrato.status).toBe(200);
      expect((contrato.corpo as { status: string }).status).toBe('RASCUNHO');

      const imovel = await pedir(`${colecao(CAMINHO_DOS_IMOVEIS)}/${partes.imovelId}`, {
        cookie: sujeito.cookie,
      });
      expect(imovel.status).toBe(200);
      expect((imovel.corpo as { statusLocacao: string }).statusLocacao).toBe('DISPONIVEL');
    },
    LIMITE_CASO_MS,
  );

  it(
    'CT-320 (c) — ter a ação de ativar não dá a de cancelar: a recusa nomeia ACAO:cancelar_contrato',
    async () => {
      // Sujeito EXCLUSIVO deste caso, pela mesma razão do `CT-320 (b)`.
      const sujeito = await pessoaOperandoComSenhaTrocada('so.ativa.contrato');
      await ajustar(sujeito.usuarioId, EMPRESA_A.id, [
        { chave: AREA_DOS_CONTRATOS, efeito: 'CONCEDIDA' },
        { chave: AREA_DOS_IMOVEIS, efeito: 'CONCEDIDA' },
        { chave: AREA_DOS_CADASTROS, efeito: 'CONCEDIDA' },
        // As DUAS outras ações sensíveis que a superfície de contrato conhece. É o efetivo mais
        // generoso que ainda **não** deve poder cancelar — e é exatamente ele que discrimina.
        { chave: ACAO_SENSIVEL, efeito: 'CONCEDIDA' },
        { chave: ACAO_DE_ATIVAR_CONTRATO, efeito: 'CONCEDIDA' },
        // A NEGAÇÃO explícita da ação sob prova: é ela que torna o `403` atribuível a essa ação, e
        // não ao piso do perfil.
        { chave: ACAO_DE_CANCELAR_CONTRATO, efeito: 'NEGADA' },
      ]);

      // Precondição AFIRMADA nas QUATRO pontas: ela alcança a área da classe, TEM as duas outras
      // ações sensíveis da MESMA superfície, e NÃO tem a que está sob prova.
      const efetivo = await efetivoDe(sujeito.cookie);
      expect(efetivo.telas).toContain(AREA_DOS_CONTRATOS);
      expect(efetivo.acoes).toContain(ACAO_SENSIVEL);
      expect(efetivo.acoes).toContain(ACAO_DE_ATIVAR_CONTRATO);
      expect(efetivo.acoes).not.toContain(ACAO_DE_CANCELAR_CONTRATO);

      // --- Arranjo: um contrato VIGENTE, montado e ativado pela PRÓPRIA sessão ------------------
      const partes = await criarAlvosDoDominio(sujeito.cookie);
      const criacao = await pedir(COLECAO_DE_CONTRATOS, {
        metodo: 'POST',
        cookie: sujeito.cookie,
        corpo: corpoDeContrato(partes),
      });
      expect(criacao.status, criacao.texto).toBe(201);
      const codigo = (criacao.corpo as { codigo: string }).codigo;

      // --- Eixo POSITIVO das ações que ela TEM: ativar e circular respondem 200 ----------------
      //
      // Ele vem ANTES do eixo negativo de propósito. Sem a ativação aqui, o contrato seria um
      // rascunho e a recusa do cancelamento poderia ser a `422` da guarda de ESTADO em vez da `403`
      // da guarda de autorização — o caso mediria outra coisa. E sem a retirada, o `403` seria
      // compatível com uma sessão que não alcança ação alguma da superfície.
      const ativacao = await pedir(`${COLECAO_DE_CONTRATOS}/${codigo}/ativacao`, {
        metodo: 'POST',
        cookie: sujeito.cookie,
        corpo: {},
      });
      expect(ativacao.status, `ativacao: ${ativacao.texto}`).toBe(200);

      for (const transicao of ['retirada', 'recirculacao'] as const) {
        const aceita = await pedir(`${COLECAO_DE_CONTRATOS}/${codigo}/${transicao}`, {
          metodo: 'POST',
          cookie: sujeito.cookie,
          corpo: {},
        });

        expect(aceita.status, `${transicao}: ${aceita.texto}`).toBe(200);
      }

      // --- Eixo NEGATIVO: cancelar recusa, nomeando a ação que FALTA ---------------------------
      const recusada = await pedir(`${COLECAO_DE_CONTRATOS}/${codigo}/cancelamento`, {
        metodo: 'POST',
        cookie: sujeito.cookie,
        corpo: {},
      });

      expect(recusada.status).toBe(403);
      // Corpo INTEIRO por igualdade, e `exigido` nomeando **`ACAO:cancelar_contrato`**. É esta linha
      // que acusa a rota que declarasse a ação de uma das vizinhas — as quatro rotas que declaram no
      // método são adjacentes no controlador —, porque a sessão **tem** as duas outras: uma exigência
      // copiada responderia `200` aqui, e o `403` do `CT-426` não mostraria a escalada.
      expect(recusada.corpo).toEqual({
        codigo: CodigoErro.ACESSO_NEGADO,
        mensagem: MENSAGEM_DE_ACESSO_NEGADO,
        detalhes: { exigido: ACAO_DE_CANCELAR_CONTRATO },
      });

      // --- E NADA transitou --------------------------------------------------------------------
      //
      // As DUAS metades: uma implementação que cancelasse e só então recusasse passaria em tudo
      // acima e reprova aqui, e a segunda escrita do ato — a liberação do imóvel — também não pode
      // ter acontecido.
      const contrato = await pedir(`${COLECAO_DE_CONTRATOS}/${codigo}`, { cookie: sujeito.cookie });
      expect(contrato.status).toBe(200);
      expect((contrato.corpo as { status: string }).status).toBe('ATIVO');

      const imovel = await pedir(`${colecao(CAMINHO_DOS_IMOVEIS)}/${partes.imovelId}`, {
        cookie: sujeito.cookie,
      });
      expect(imovel.status).toBe(200);
      expect((imovel.corpo as { statusLocacao: string }).statusLocacao).toBe('LOCADO');
    },
    LIMITE_CASO_MS,
  );

  it(
    'CT-321 — cadastro de outra empresa é indistinguível de inexistente nas rotas de `:id`',
    async () => {
      // Precondição AFIRMADA: a sessão de B tem a área e a ação — a recusa precisa vir do
      // não-alcance, e não de permissão que lhe falte.
      const deB = await efetivoDe(cookieDeB);
      expect(deB.telas).toContain(AREA_DOS_IMOVEIS);
      expect(deB.telas).toContain(AREA_DOS_CADASTROS);
      expect(deB.acoes).toContain(ACAO_SENSIVEL);

      // Os cadastros de A são criados PELA SESSÃO DE A, e o identificador que B usa é o que aquela
      // criação devolveu: o caso prova o outro lado — conhecer o identificador alheio não basta.
      const deA = entidadesCirculaveis(await criarAlvosDoDominio(cookiePleno));
      const proprios = entidadesCirculaveis(await criarAlvosDoDominio(cookieDeB));
      expect(deA.length).toBe(5);
      expect(proprios.length).toBe(5);

      // O estado inicial de cada cadastro de A, serializado pela sessão de A.
      const estadoInicial = await Promise.all(
        deA.map(async (e) => await lerPor(e.item, cookiePleno)),
      );

      const conferidas: string[] = [];
      for (const [indice, entidade] of deA.entries()) {
        const inexistente = entidade.item.replace(/[^/]+$/u, UUID_INEXISTENTE);

        for (const rota of ROTAS_DE_IDENTIFICADOR) {
          const alheio = await pedir(rota.alvo(entidade.item), {
            metodo: rota.metodo,
            cookie: cookieDeB,
            ...(rota.corpo === undefined ? {} : { corpo: rota.corpo(entidade) }),
          });
          const nenhum = await pedir(rota.alvo(inexistente), {
            metodo: rota.metodo,
            cookie: cookieDeB,
            ...(rota.corpo === undefined ? {} : { corpo: rota.corpo(entidade) }),
          });

          const rotulo = `${rota.metodo} ${entidade.nome}${rota.sufixo}`;
          expect(alheio.status, `${rotulo} (alheio) respondeu ${String(alheio.status)}`).toBe(404);
          expect(nenhum.status, `${rotulo} (inexistente) respondeu ${String(nenhum.status)}`).toBe(
            404,
          );
          // Corpos PROFUNDAMENTE iguais, e ambos iguais ao envelope canônico: um `404` que trouxesse
          // `campo` ou `detalhes` só no caso alheio revelaria a existência do recurso da outra
          // empresa, que é exatamente o que o caso existe para impedir.
          expect(alheio.corpo, `${rotulo}: o alheio é distinguível do inexistente`).toEqual(
            nenhum.corpo,
          );
          expect(alheio.corpo).toEqual({
            codigo: CodigoErro.RECURSO_NAO_ENCONTRADO,
            mensagem: MENSAGEM_DE_NAO_ENCONTRADO,
          });

          conferidas.push(rotulo);
        }

        // Eixo POSITIVO: a MESMA sessão de B alcança o cadastro PRÓPRIO da mesma entidade.
        const proprio = proprios[indice];
        if (proprio === undefined) {
          throw new Error(`sem cadastro próprio de B para ${entidade.nome}`);
        }
        const alcance = await pedir(proprio.item, { cookie: cookieDeB });
        expect(alcance.status, `B não alcança o próprio ${proprio.nome}: ${alcance.texto}`).toBe(
          200,
        );
      }

      expect(conferidas.length).toBe(deA.length * ROTAS_DE_IDENTIFICADOR.length);

      // O estado de A é o MESMO depois das vinte tentativas — nenhuma delas gravou nada.
      const estadoFinal = await Promise.all(
        deA.map(async (e) => await lerPor(e.item, cookiePleno)),
      );
      expect(estadoFinal).toEqual(estadoInicial);
    },
    LIMITE_CASO_MS,
  );
});

// ---------------------------------------------------------------------------------------------
// A tabela das 33 rotas — DERIVADA dos donos de segmento, nunca redigitada
// ---------------------------------------------------------------------------------------------

/** Uma rota do domínio, no que estes casos precisam saber dela. */
interface RotaDoDominio {
  /** Método e caminho, para a mensagem de falha nomear a rota exata. */
  readonly rotulo: string;
  readonly metodo: string;
  readonly alvo: string;
  readonly corpo?: Record<string, unknown>;
  /** A chave de área que a rota exige — o valor que a recusa tem de nomear. */
  readonly area: ChaveDoCatalogo;
}

/** Os recursos da empresa que a tabela endereça — todos criados pelas rotas reais. */
interface AlvosDoDominio {
  readonly conjuntoId: string;
  readonly imovelId: string;
  readonly comodoId: string;
  readonly locadorId: string;
  readonly locatarioId: string;
  readonly fiadorId: string;
  /** Rótulo desta leva — entra no nome do conjunto, para que a falha diga de qual leva ela veio. */
  readonly marca: string;
}

/** A coleção de cada entidade, sob o prefixo de versão. */
function colecao(caminho: string): string {
  return `/${PREFIXO_DE_VERSAO}/${caminho}`;
}

/**
 * As **seis** rotas que uma entidade de cadastro publica, com corpo válido onde há corpo.
 *
 * O corpo do `POST` e o do `PUT` são **distintos**, e a distinção não é estilo: o `POST` cria um
 * registro NOVO e o `PUT` reescreve o que a tabela endereça. Com o mesmo corpo nos dois, o `PUT` de
 * imóvel e o de pessoa tentariam gravar um identificador municipal — ou um documento — que o `POST`
 * acabou de tomar, e a resposta seria `422` de unicidade em vez do `200` que o eixo positivo mede.
 */
function rotasDeUmCadastro(
  caminho: string,
  id: string,
  area: ChaveDoCatalogo,
  corpoDoPost: Record<string, unknown>,
  corpoDoPut: Record<string, unknown>,
): readonly RotaDoDominio[] {
  const raiz = colecao(caminho);
  const item = `${raiz}/${id}`;

  return [
    { rotulo: `POST ${raiz}`, metodo: 'POST', alvo: raiz, corpo: corpoDoPost, area },
    { rotulo: `GET ${raiz}`, metodo: 'GET', alvo: raiz, area },
    { rotulo: `GET ${raiz}/:id`, metodo: 'GET', alvo: item, area },
    { rotulo: `PUT ${raiz}/:id`, metodo: 'PUT', alvo: item, corpo: corpoDoPut, area },
    {
      rotulo: `POST ${raiz}/:id/retirada`,
      metodo: 'POST',
      alvo: `${item}/retirada`,
      corpo: {},
      area,
    },
    {
      rotulo: `POST ${raiz}/:id/recirculacao`,
      metodo: 'POST',
      alvo: `${item}/recirculacao`,
      corpo: {},
      area,
    },
  ];
}

/**
 * As **33** rotas, compostas a partir dos donos de segmento.
 *
 * A ordem importa no eixo positivo: cada entidade é criada, lida, alterada, retirada e recirculada
 * nesta sequência, de modo que o cadastro termina em circulação — e o `POST` da coleção cria um
 * registro NOVO, sem tocar o que a tabela endereça.
 */
function rotasDoDominio(recursos: AlvosDoDominio): readonly RotaDoDominio[] {
  const comodos = colecao(CAMINHO_DOS_COMODOS).replace(':id', recursos.imovelId);
  const doComodo = `${comodos}/${recursos.comodoId}`;

  return [
    ...rotasDeUmCadastro(
      CAMINHO_DOS_CONJUNTOS,
      recursos.conjuntoId,
      AREA_DOS_IMOVEIS,
      { nome: `Edifício ${recursos.marca} novo` },
      { nome: `Edifício ${recursos.marca}` },
    ),
    ...rotasDeUmCadastro(
      CAMINHO_DOS_IMOVEIS,
      recursos.imovelId,
      AREA_DOS_IMOVEIS,
      // O `POST` cria um imóvel NOVO, com identificador próprio; o `PUT` reescreve o imóvel que a
      // tabela endereça, devolvendo a ele o MESMO identificador com que nasceu — que é o único
      // valor que a restrição de unicidade aceita da própria linha.
      corpoDeImovel(recursos.conjuntoId, identificadorMunicipal()),
      corpoDeImovelAlterado(recursos.conjuntoId, identificadorMunicipal()),
    ),
    // O cômodo não tem rota de leitura: ele chega e volta dentro do imóvel, que é o agregado dele
    // (§4.1). São três escritas, e a ausência da quarta é contrato.
    {
      rotulo: `POST ${CAMINHO_DOS_COMODOS}`,
      metodo: 'POST',
      alvo: comodos,
      corpo: { nomeComodo: 'Sala', metragem: 12.5, observacoes: null },
      area: AREA_DOS_IMOVEIS,
    },
    {
      rotulo: `PUT ${CAMINHO_DOS_COMODOS}/:comodoId`,
      metodo: 'PUT',
      alvo: doComodo,
      corpo: { nomeComodo: 'Sala ampliada', metragem: 14, observacoes: null },
      area: AREA_DOS_IMOVEIS,
    },
    {
      rotulo: `DELETE ${CAMINHO_DOS_COMODOS}/:comodoId`,
      metodo: 'DELETE',
      alvo: doComodo,
      area: AREA_DOS_IMOVEIS,
    },
    // Nos três papéis, o corpo do `POST` e o do `PUT` são construídos por chamadas distintas de
    // {@link corpoDePessoa}, e cada uma sorteia documento e endereço próprios — pela mesma razão do
    // imóvel logo acima.
    ...rotasDeUmCadastro(
      CAMINHO_DOS_LOCADORES,
      recursos.locadorId,
      AREA_DOS_CADASTROS,
      corpoDePessoa(),
      corpoDePessoa(),
    ),
    ...rotasDeUmCadastro(
      CAMINHO_DOS_LOCATARIOS,
      recursos.locatarioId,
      AREA_DOS_CADASTROS,
      corpoDePessoa(),
      corpoDePessoa(),
    ),
    ...rotasDeUmCadastro(
      CAMINHO_DOS_FIADORES,
      recursos.fiadorId,
      AREA_DOS_CADASTROS,
      corpoDePessoa(),
      corpoDePessoa(),
    ),
  ];
}

/** Uma entidade circulável, no que os `CT-320` e `CT-321` observam dela. */
interface EntidadeCirculavel {
  readonly nome: string;
  /** O endereço do item, já com o identificador. */
  readonly item: string;
  readonly area: ChaveDoCatalogo;
  /**
   * Um corpo **válido** para o `PUT` daquela entidade.
   *
   * Válido é obrigatório, e a razão é a ordem do manipulador: ele valida o corpo **antes** de
   * procurar o registro, de modo que um corpo malformado responderia `422` e o `404` que o `CT-321`
   * mede nunca aconteceria. Os campos únicos saem de um sorteio próprio a cada chamada — se a
   * gravação chegasse a acontecer, ela não poderia colidir com nada e o defeito apareceria como
   * mudança de estado, e não como recusa de unicidade que o mascararia.
   */
  readonly corpoDoPut: () => Record<string, unknown>;
}

/** As **cinco** entidades que saem e voltam à circulação — o cômodo não é uma delas (ADR-0014). */
function entidadesCirculaveis(recursos: AlvosDoDominio): readonly EntidadeCirculavel[] {
  return [
    {
      nome: CAMINHO_DOS_CONJUNTOS,
      item: `${colecao(CAMINHO_DOS_CONJUNTOS)}/${recursos.conjuntoId}`,
      area: AREA_DOS_IMOVEIS,
      corpoDoPut: () => ({ nome: `Edifício ${String(proximo())}` }),
    },
    {
      nome: CAMINHO_DOS_IMOVEIS,
      item: `${colecao(CAMINHO_DOS_IMOVEIS)}/${recursos.imovelId}`,
      area: AREA_DOS_IMOVEIS,
      corpoDoPut: () => corpoDeImovelAlterado(recursos.conjuntoId, identificadorMunicipal()),
    },
    {
      nome: CAMINHO_DOS_LOCADORES,
      item: `${colecao(CAMINHO_DOS_LOCADORES)}/${recursos.locadorId}`,
      area: AREA_DOS_CADASTROS,
      corpoDoPut: () => corpoDePessoa(),
    },
    {
      nome: CAMINHO_DOS_LOCATARIOS,
      item: `${colecao(CAMINHO_DOS_LOCATARIOS)}/${recursos.locatarioId}`,
      area: AREA_DOS_CADASTROS,
      corpoDoPut: () => corpoDePessoa(),
    },
    {
      nome: CAMINHO_DOS_FIADORES,
      item: `${colecao(CAMINHO_DOS_FIADORES)}/${recursos.fiadorId}`,
      area: AREA_DOS_CADASTROS,
      corpoDoPut: () => corpoDePessoa(),
    },
  ];
}

/** Uma das quatro rotas de `:id` que o `CT-321` percorre, endereçada por um item já composto. */
interface RotaDeIdentificador {
  readonly metodo: string;
  readonly sufixo: string;
  readonly alvo: (item: string) => string;
  readonly corpo?: (entidade: EntidadeCirculavel) => Record<string, unknown>;
}

/**
 * As **quatro** rotas de `:id` comuns às cinco entidades circuláveis.
 *
 * O `PUT` carrega o corpo válido da entidade — ver {@link EntidadeCirculavel.corpoDoPut} —, e as
 * duas transições de circulação carregam o objeto **vazio e fechado**, que é o corpo que elas
 * aceitam.
 */
const ROTAS_DE_IDENTIFICADOR: readonly RotaDeIdentificador[] = [
  { metodo: 'GET', sufixo: '/:id', alvo: (item) => item },
  {
    metodo: 'PUT',
    sufixo: '/:id',
    alvo: (item) => item,
    corpo: (entidade) => entidade.corpoDoPut(),
  },
  {
    metodo: 'POST',
    sufixo: '/:id/retirada',
    alvo: (item) => `${item}/retirada`,
    corpo: () => ({}),
  },
  {
    metodo: 'POST',
    sufixo: '/:id/recirculacao',
    alvo: (item) => `${item}/recirculacao`,
    corpo: () => ({}),
  },
];

// ---------------------------------------------------------------------------------------------
// Arranjo — tudo pelo caminho real
// ---------------------------------------------------------------------------------------------

/**
 * O sequencial que dá unicidade a tudo o que este arquivo cria.
 *
 * Ele é monotônico e de processo, e não sorteado: os três campos únicos desta superfície —
 * identificador municipal, documento e endereço de e-mail — vivem sob restrições que **alcançam os
 * cadastros retirados** (ADR-0014), de modo que um valor repetido entre casos produziria `422` de
 * unicidade onde o caso mede outra coisa. Determinístico também torna a falha reproduzível.
 */
let sequencial = 0;

function proximo(): number {
  sequencial += 1;
  return sequencial;
}

/** O identificador municipal — único por empresa, e a unicidade alcança os retirados. */
function identificadorMunicipal(): string {
  return `IM-${String(proximo()).padStart(6, '0')}`;
}

/** O corpo completo de um imóvel. **`empresaId` não aparece**, e a ausência é o ponto (ADR-0008). */
function corpoDeImovel(conjuntoId: string, identificador: string): Record<string, unknown> {
  return {
    conjuntoId,
    nomeImovel: 'Ap 101',
    identificadorMunicipal: identificador,
    tipoImovel: 'RESIDENCIAL',
    logradouro: 'Rua das Acácias',
    numero: '100',
    complemento: null,
    bairro: 'Centro',
    cidade: 'São Paulo',
    estado: 'SP',
    cep: '01000000',
    statusLocacao: 'DISPONIVEL',
    observacoes: null,
  };
}

/**
 * O corpo completo do `PUT` de imóvel — o da criação **menos** `statusLocacao` (T10).
 *
 * SUT_IS_CORRECT_BECAUSE: o código de produção está certo e era o corpo do `PUT` deste arquivo que
 * carregava um campo que a rota deixou de aceitar. A T10 da fatia `contratos-de-locacao` tirou
 * `statusLocacao` do corpo da alteração — ele passou a ter rota própria —, e `esquemaDeImovelAlterado`
 * é `strictObject`: um corpo que ainda o traga responde `422`. Aqui isso importa duplamente, porque o
 * docblock de {@link EntidadeCirculavel} registra por que o corpo do `PUT` **tem** de ser válido — a
 * borda valida o corpo **antes** de procurar o registro, de modo que um corpo recusado devolveria
 * `422` e o `404` que o `CT-321` mede nunca aconteceria. **Nenhuma asserção foi afrouxada**; o corpo
 * continua completo, e a recusa da chave a mais tem prova própria no `CT-434`.
 *
 * Ele é **derivado** do corpo da criação, espelhando o `omit` do contrato — nunca uma segunda lista.
 */
function corpoDeImovelAlterado(conjuntoId: string, identificador: string): Record<string, unknown> {
  const corpo = corpoDeImovel(conjuntoId, identificador);
  delete corpo.statusLocacao;

  return corpo;
}

/** O corpo completo de um cadastro de pessoa, com documento e endereço **únicos a cada chamada**. */
function corpoDePessoa(): Record<string, unknown> {
  const marca = String(proximo()).padStart(6, '0');

  return {
    nome: `Pessoa ${marca}`,
    tipoPessoa: 'PESSOA_FISICA',
    documentoPrincipal: cpfValido(proximo()),
    rg: null,
    email: `pessoa.${marca}@exemplo.com.br`,
    telefone: '11999990000',
    logradouro: 'Rua das Acácias',
    numero: '100',
    complemento: null,
    bairro: 'Centro',
    cidade: 'São Paulo',
    estado: 'SP',
    cep: '01000000',
  };
}

/**
 * Cria, **pelas rotas reais**, um exemplar de cada entidade da empresa da sessão informada.
 *
 * Cada chamada gera uma leva nova, com marca própria: o `CT-319` precisa de um conjunto de alvos
 * intocado para o eixo positivo (que retira, recircula e remove), e o `CT-321` precisa de exemplares
 * exclusivos em cada empresa. Reaproveitar a mesma leva criaria dependência de ordem entre casos.
 */
async function criarAlvosDoDominio(credencial: string): Promise<AlvosDoDominio> {
  const marca = String(proximo()).padStart(6, '0');

  const conjuntoId = await criarPelaRota(credencial, colecao(CAMINHO_DOS_CONJUNTOS), {
    nome: `Edifício ${marca}`,
  });
  const imovelId = await criarPelaRota(
    credencial,
    colecao(CAMINHO_DOS_IMOVEIS),
    corpoDeImovel(conjuntoId, identificadorMunicipal()),
  );

  const comodos = colecao(CAMINHO_DOS_COMODOS).replace(':id', imovelId);
  const comComodo = await pedir(comodos, {
    metodo: 'POST',
    cookie: credencial,
    corpo: { nomeComodo: 'Quarto', metragem: 10, observacoes: null },
  });
  if (comComodo.status !== 201) {
    throw new Error(
      `a criação do cômodo respondeu ${String(comComodo.status)}: ${comComodo.texto}`,
    );
  }
  const comodoId = (comComodo.corpo as { comodos: readonly { id: string }[] }).comodos[0]?.id;
  if (comodoId === undefined) {
    throw new Error('a criação do cômodo não devolveu o imóvel com o cômodo dentro');
  }

  const locadorId = await criarPelaRota(
    credencial,
    colecao(CAMINHO_DOS_LOCADORES),
    corpoDePessoa(),
  );
  const locatarioId = await criarPelaRota(
    credencial,
    colecao(CAMINHO_DOS_LOCATARIOS),
    corpoDePessoa(),
  );
  const fiadorId = await criarPelaRota(credencial, colecao(CAMINHO_DOS_FIADORES), corpoDePessoa());

  return { conjuntoId, imovelId, comodoId, locadorId, locatarioId, fiadorId, marca };
}

/**
 * O corpo completo de um contrato sobre os alvos de uma leva — o arranjo do `CT-320 (b)`.
 *
 * Os termos são fixos e irrelevantes para o que o caso mede: o eixo aqui é a **autorização**, e não a
 * derivação nem as condições de entrada. `empresaId` não aparece — ela sai da sessão, e o
 * `strictObject` do contrato recusaria a chave.
 */
function corpoDeContrato(alvos: AlvosDoDominio): Record<string, unknown> {
  return {
    imovelId: alvos.imovelId,
    locadorId: alvos.locadorId,
    locatarioId: alvos.locatarioId,
    fiadoresIds: [alvos.fiadorId],
    dataInicioLocacao: '2026-01-15',
    prazoMeses: 12,
    valorMensal: 2500,
    diaVencimento: 10,
    gerarCobrancasAutomaticamente: true,
    pdfContratoArquivo: null,
  };
}

/**
 * Cria um registro pela rota real e devolve o identificador da resposta.
 *
 * A falha levanta em vez de devolver: uma precondição que falhasse em silêncio faria o caso reprovar
 * numa asserção adiante, apontando para o lugar errado.
 */
async function criarPelaRota(
  credencial: string,
  colecaoDaEntidade: string,
  corpo: Record<string, unknown>,
): Promise<string> {
  const resposta = await pedir(colecaoDaEntidade, { metodo: 'POST', cookie: credencial, corpo });

  if (resposta.status !== 201) {
    throw new Error(
      `a criação em ${colecaoDaEntidade} respondeu ${String(resposta.status)}: ${resposta.texto}`,
    );
  }

  return (resposta.corpo as { id: string }).id;
}

/** A marca de retirada do cadastro, lida **pela rota** com a sessão informada. */
async function marcaDeRetirada(item: string, credencial: string): Promise<string | null> {
  const resposta = await pedir(item, { cookie: credencial });

  if (resposta.status !== 200) {
    throw new Error(`a leitura de ${item} respondeu ${String(resposta.status)}: ${resposta.texto}`);
  }

  return (resposta.corpo as { retiradoEm: string | null }).retiradoEm;
}

/** O corpo inteiro do cadastro, lido pela rota — o retrato que o `CT-321` compara antes e depois. */
async function lerPor(item: string, credencial: string): Promise<unknown> {
  const resposta = await pedir(item, { cookie: credencial });

  if (resposta.status !== 200) {
    throw new Error(`a leitura de ${item} respondeu ${String(resposta.status)}: ${resposta.texto}`);
  }

  return resposta.corpo;
}

/** O efetivo publicado da sessão — toda precondição de permissão é AFIRMADA por aqui. */
async function efetivoDe(credencial: string): Promise<SessaoPublicada> {
  const resposta = await pedir(CAMINHO_DA_SESSAO_CORRENTE, { cookie: credencial });

  if (resposta.status !== 200) {
    throw new Error(`a sessão respondeu ${String(resposta.status)}: ${resposta.texto}`);
  }

  return resposta.corpo as SessaoPublicada;
}

/** Um ajuste individual de permissão, na forma que a camada de dados persiste. */
interface AjusteDoCaso {
  readonly chave: ChaveDoCatalogo;
  readonly efeito: 'CONCEDIDA' | 'NEGADA';
}

/**
 * Escreve os ajustes individuais de uma pessoa pelo caminho REAL da camada de dados.
 *
 * Sob o contexto de tenant **da empresa dela** e dentro da unidade de trabalho, com a coerência
 * ação→tela validada pela função de domínio (`validarCoerenciaDeAjustes`) e o contador de versão
 * incrementado na mesma transação — é o mesmo caminho que a rota do Admin usa por dentro.
 *
 * A escrita é o conjunto INTEIRO de ajustes da pessoa, e não um acréscimo: é assim que
 * `escreverAjustes` funciona, e é por isso que o passo positivo do `CT-320` repete as duas áreas ao
 * conceder a ação.
 */
async function ajustar(
  usuarioId: string,
  empresaId: string,
  ajustes: readonly AjusteDoCaso[],
): Promise<void> {
  await contextoDeTenant.executarCom({ empresaId }, async () => {
    await acessoAoNegocio.emUnidadeDeTrabalho(async (tx) => {
      await escreverAjustes(tx, {
        usuarioId,
        ajustes: ajustes.map((ajuste) => ({ chave: ajuste.chave, efeito: ajuste.efeito })),
        validarCoerencia: validarCoerenciaDeAjustes,
      });
    });
  });
}

/**
 * Cria uma pessoa `USUARIO_EMPRESA` da empresa A pela ROTA REAL do Admin e devolve a sessão dela,
 * já **plena**.
 *
 * Tudo pelas rotas reais: a pessoa nasce por `POST /v1/usuarios`, entra pela rota pública com a
 * Senha provisória que a criação devolveu, e cumpre a troca obrigatória por `POST /v1/sessao/senha`.
 * A troca não é conveniência: sem ela a sessão fica RESTRITA (RN-09), e o `403` que ela produz viria
 * da restrição — não da autorização, que é o eixo do caso. É o mesmo arranjo, pelas mesmas rotas, de
 * `circulacao-de-cadastro.e2e.spec.ts`.
 */
async function pessoaOperandoComSenhaTrocada(prefixo: string): Promise<PessoaEmOperacao> {
  const criada = await pedir(CAMINHO_DAS_PESSOAS, {
    metodo: 'POST',
    cookie: cookiePleno,
    corpo: {
      nome: 'Pessoa Que Só Administra Cadastros',
      email: `${prefixo}.${randomUUID()}@exemplo.com.br`,
      perfil: 'USUARIO_EMPRESA',
    },
  });

  if (criada.status !== 201) {
    throw new Error(`a criação de pessoa respondeu ${String(criada.status)}: ${criada.texto}`);
  }

  const { usuarioId, email, senhaProvisoria } = criada.corpo as {
    usuarioId: string;
    email: string;
    senhaProvisoria: string;
  };

  const restrita = await entrar(email, senhaProvisoria);
  const troca = await pedir(ROTA_DE_TROCA_DE_SENHA, {
    metodo: 'POST',
    cookie: restrita,
    corpo: { senhaAtual: senhaProvisoria, senhaNova: SENHA_TROCADA },
  });

  if (troca.status !== 200) {
    throw new Error(`a troca de senha respondeu ${String(troca.status)}: ${troca.texto}`);
  }

  // A resposta pode ou não reemitir a credencial de sessão, e as duas formas são aceitas: o que
  // importa é o cookie que passa a valer, e não por qual das duas ele chegou.
  return { usuarioId, cookie: credencialDe(troca.cookies) ?? restrita };
}

/** Uma pessoa da empresa já operando com sessão plena. */
interface PessoaEmOperacao {
  readonly usuarioId: string;
  readonly cookie: string;
}

/** A sessão do produto, no que este arquivo observa dela. */
interface SessaoPublicada {
  readonly telas: readonly string[];
  readonly acoes: readonly string[];
}

// ---------------------------------------------------------------------------------------------
// Cliente HTTP
// ---------------------------------------------------------------------------------------------

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
async function pedir(alvo: string, opcoes: OpcoesDoPedido = {}): Promise<Resposta> {
  const cabecalhos: Record<string, string> = { connection: 'close', origin: base };

  if (opcoes.corpo !== undefined) {
    cabecalhos['content-type'] = 'application/json';
  }
  if (opcoes.cookie !== undefined) {
    cabecalhos.cookie = opcoes.cookie;
  }

  const resposta = await fetch(new URL(alvo, base), {
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

/** O cookie de sessão de uma lista de `Set-Cookie`, quando houver. */
function credencialDe(cookies: readonly string[]): string | undefined {
  const bruto = cookies.find((valor) =>
    (valor.split(';')[0] ?? '').split('=')[0]?.trim().endsWith(SUFIXO_DO_COOKIE_DE_SESSAO),
  );

  return bruto?.split(';')[0];
}

/** Entra pelo caminho REAL — a rota pública de entrada. Nenhum estado de sessão é forjado. */
async function entrar(email: string, senha: string): Promise<string> {
  const entrada = await pedir(ROTA_DE_ENTRADA, {
    metodo: 'POST',
    corpo: { email, password: senha },
  });

  if (entrada.status !== 200) {
    throw new Error(`a entrada de ${email} respondeu ${String(entrada.status)}: ${entrada.texto}`);
  }

  const credencial = credencialDe(entrada.cookies);
  if (credencial === undefined) {
    throw new Error('a entrada bem-sucedida não devolveu cookie de sessão');
  }

  return credencial;
}
