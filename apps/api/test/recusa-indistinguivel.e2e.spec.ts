/**
 * Recusas indistinguíveis: bloqueio, desativação e suspensão. T11 da fatia
 * `fundacao-multitenancy-identidade` — a **última** dela.
 *
 * ---------------------------------------------------------------------------
 * INVARIANTES
 * ---------------------------------------------------------------------------
 *
 * | Critério | Caso   | Invariante |
 * |---|---|---|
 * | CA-08 | CT-016 | A resposta a uma entrada com credencial **CORRETA** sobre conta **bloqueada**
 * |       |        | é idêntica, campo a campo, à resposta a uma credencial **incorreta** e à de um
 * |       |        | **e-mail inexistente** — mesmo status, mesmo corpo byte a byte, mesmo conjunto
 * |       |        | de chaves do corpo, mesmo conjunto de nomes de cabeçalho e nenhum cabeçalho de
 * |       |        | sessão —, de modo que a resposta **não confirma a existência da conta**. E
 * |       |        | nenhuma das três cria linha em `identidade.sessao`. (RN-06, RN-10) |
 * | CA-13 | CT-017 | Pessoa **desativada** e pessoa de **empresa suspensa**, ambas com credencial
 * |       |        | correta, recebem resposta idêntica à de credencial incorreta, **nenhuma sessão
 * |       |        | é criada**, e a trilha ganha **exatamente três** linhas — todas com desfecho de
 * |       |        | recusa, e ali sim distinguindo o motivo, que é onde ele serve. (RN-10, RN-11) |
 * | CA-08 | CT-016 | Companheiro negativo dos dois: a **mesma** conta, antes do bloqueio, e as
 * | CA-13 | CT-017 | **mesmas** pessoas, antes da desativação e da suspensão, entram com a mesma
 * |       |        | credencial e recebem `200` com cabeçalho de sessão e **uma linha nova** em
 * |       |        | `identidade.sessao`. A diferença observável só existe quando a admissão é
 * |       |        | legítima — sem isso, "todas as recusas são iguais" passaria sobre uma barreira
 * |       |        | que recusa todo mundo. |
 *
 * Rastreabilidade: `CA-08 → CT-016 (RN-06)`, `CA-08 → CT-016 (RN-10)`, `CA-13 → CT-017 (RN-10)`,
 * `CA-13 → CT-017 (RN-11)`.
 *
 * ---------------------------------------------------------------------------
 * O eixo que discrimina é a comparação CRUZADA, e só ela
 * ---------------------------------------------------------------------------
 *
 * As respostas são comparadas **entre si**, e não cada uma contra um literal escrito à mão: dois
 * literais escritos à mão continuariam iguais mesmo se o produto divergisse **em ambos**. O único
 * literal deste arquivo é a **âncora** — uma escrita à mão, sobre uma das respostas, que fixa a
 * forma da ADR-0007. Sem ela, três respostas idênticas e **erradas** passariam; sem a comparação
 * cruzada, três respostas certas e **divergentes** passariam. É o par que prova.
 *
 * Cada resposta de referência vem de um sujeito **arranjado neste arquivo e cuja precondição o
 * próprio caso afirma** antes de exercitar o fluxo. A T7 desta fatia foi reprovada por prova
 * tautológica por dependência de ordem — a referência vinha corrompida por um caso anterior e o
 * mutante sobrevivia à suíte inteira —, e é essa a razão de o elenco abaixo ser **disjunto entre os
 * dois casos** e de cada precondição ser afirmada como igualdade de tupla, e não pressuposta.
 *
 * ---------------------------------------------------------------------------
 * O alcance TEM BORDA, e ela foi MEDIDA (prova de falsificação da T11)
 * ---------------------------------------------------------------------------
 *
 * O que estes casos alcançam é o que **o cliente observa**, e essa superfície é normalizada pelo
 * filtro global da ADR-0007 (`apps/api/src/comum/filtro-excecao.ts`): a recusa de um componente
 * externo entra pelo STATUS, e o código e a mensagem que saem vêm de `CODIGO_POR_STATUS` e
 * `MENSAGEM_POR_CODIGO`. Duas consequências, ambas medidas com mutante aplicado ao produto e
 * revertido em seguida:
 *
 *   * **um status próprio por predicado é observável, e reprova** — trocar a recusa de `401` por
 *     `403` no gancho de entrada de `packages/auth/src/autenticacao.ts` faz os dois casos reprovarem
 *     **na comparação cruzada**, nomeando a divergência (`ACESSO_NEGADO` contra `CREDENCIAL_INVALIDA`,
 *     `403` contra `401`);
 *   * **uma mensagem própria por predicado NÃO é observável — e não é lacuna da prova**: com a
 *     recusa levantando `` `Refused: ${motivo}` `` os dois casos seguem verdes, porque o filtro
 *     **descarta** a mensagem da exceção de origem e responde a canônica do código. O motivo não
 *     chega ao cliente por construção, que é exatamente o que a RN-10 pede. Provar essa metade é
 *     trabalho do filtro, e ele já o tem: o `CT-018 (c)` da T8 afirma que nada do vocabulário do
 *     arcabouço atravessa, e o bloco *"A mensagem que sai é NOSSA, nunca a da exceção de origem"*
 *     no cabeçalho do filtro é a decisão de onde isso vem.
 *
 * ---------------------------------------------------------------------------
 * O elenco é disjunto, e por isso os dois casos rodam em qualquer ordem
 * ---------------------------------------------------------------------------
 *
 * Nenhuma pessoa é sujeito dos dois casos, e as duas empresas são atribuídas a lados opostos: o
 * CT-016 opera **só** em pessoas da empresa B (que permanece ativa), e o CT-017 suspende a
 * **empresa A**. O Sysloc Master, que não pertence a empresa alguma, é a linha de base do CT-017 —
 * é a única pessoa da carga indiferente a qualquer suspensão.
 *
 * A consequência é a que importa: `pnpm --filter @sysloc/api test -- -t "CT-017"` e a execução
 * completa produzem o mesmo resultado, e o mesmo vale na ordem invertida. Um elenco compartilhado
 * faria a linha de base de um caso ser o sujeito recusado do outro — e comparar recusa de política
 * com recusa de política é exatamente a tautologia que este arquivo existe para não cometer.
 *
 * ---------------------------------------------------------------------------
 * O estado de desativação e de suspensão é arranjado no caso — e por quê
 * ---------------------------------------------------------------------------
 *
 * **A carga inicial não os define**: `packages/db/src/semente.ts` não escreve `ativo` nem
 * `suspensa_em`, e as duas colunas têm padrão (`true` e nulo). O card afirma o contrário na §6.6, e
 * a divergência está registrada nas pendências desta task.
 *
 * O arranjo é escrito no próprio caso, por acesso direto ao banco, pelo padrão que a **T7** já usa
 * (`banco.update(usuario).set({ ativo: false })`) e que a T10 repetiu para a senha provisória:
 * **observação e escrita de estado de domínio persistido**, não instrumentação do SUT. Não existe
 * caminho de escrita para essas colunas nesta fatia — as rotas de administração que as moveriam são
 * da fatia `autorizacao-e-ciclo-de-acesso` —, e criar rota, bandeira ou símbolo de produção para
 * "desativar pessoa" seria antecipar aquela fatia e vazar código test-only para a produção
 * (Iron Law #6). A partir do arranjo, **tudo** acontece pela rota real.
 *
 * O bloqueio é o caso oposto, e por isso é tratado de modo oposto: ele **tem** caminho de produção,
 * e o CT-016 o percorre — cinco `POST /v1/auth/sign-in/email` com senha errada, atravessando HTTP.
 * Escrever `bloqueado_ate` à mão provaria a leitura da coluna, e não a regra que a preenche.
 *
 * ---------------------------------------------------------------------------
 * O tempo de resposta NÃO é asserido aqui — e onde o eixo está coberto
 * ---------------------------------------------------------------------------
 *
 * O invariante do CT-017 fala em *"nem o corpo nem o tempo de resposta"*. O tempo **não** ganha
 * asserção neste arquivo, por decisão registrada: medida de latência em suíte é refém da máquina,
 * `.claude/rules/testing-stack.md` trata teste instável como defeito e **proíbe retry**, e uma
 * asserção de relógio aqui seria a primeira fonte de intermitência da fatia.
 *
 * O eixo já está coberto, e por prova determinística: a `DECISÃO FECHADA — T6 / Gate 2 (P3)` de
 * `packages/auth/src/autenticacao.ts` fixa que a recusa **deriva a senha informada e descarta o
 * resultado** antes de lançar — sem isso a conta bloqueada seria a única resposta em milissegundos
 * de um fluxo dominado pelo `scrypt`, e o tempo enumeraria contas. O terceiro caso de
 * `packages/auth/test/bloqueio.spec.ts` prova essa propriedade contando **quantas vezes a derivação
 * foi chamada e com qual argumento**, que é a causa observável da latência, em vez de medir o
 * relógio. Repeti-la aqui seria duplicação cross-layer (AP-23) trocando prova determinística por
 * prova instável.
 *
 * ---------------------------------------------------------------------------
 * De onde vêm o banco, a fila e a credencial (ADR-0006)
 * ---------------------------------------------------------------------------
 *
 * De instâncias efêmeras próprias. Nenhuma coordenada de conexão é lida do ambiente: o ambiente do
 * processo é MONTADO a partir do que os helpers devolvem. A aplicação é a **real** (`criarAplicacao`,
 * de `src/main.ts`) — é ela que atende em operação, e uma remontagem descreveria uma aplicação que
 * ninguém sobe. A porta é **reservada** (trava atômica), e não dinâmica, pela razão que a T8
 * registrou: o arcabouço confere a origem das requisições contra o endereço base, composto a partir
 * da porta CONFIGURADA — com `port: 0` a configurada e a real divergiriam.
 */

import { randomBytes } from 'node:crypto';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { LIMITE_DE_FALHAS_CONSECUTIVAS } from '@sysloc/auth';
import { EMPRESA_A, EMPRESA_B, esquemaIdentidade, SENHA_DA_CARGA } from '@sysloc/db';
import { CodigoErro } from '@sysloc/shared';
import { count, eq } from 'drizzle-orm';
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
import { PREFIXO_DAS_ROTAS_DE_IDENTIDADE } from '../src/autenticacao/autenticacao.module.ts';
import { ENDERECO_DE_ESCUTA } from '../src/configuracao/ambiente.ts';
import { criarAplicacao } from '../src/main.ts';

/** Limite da montagem: banco migrado, semente com credencial, fila e a aplicação real. */
const LIMITE_DE_MONTAGEM_MS = 240_000;

/**
 * Limite de um caso.
 *
 * Generoso de propósito: o CT-016 executa **oito** entradas reais em sequência, e cada uma paga a
 * derivação `scrypt`, que é deliberadamente cara (§12.1). O teto não é espera — nada aqui dorme —,
 * é o teto de um caso que atravessa HTTP e banco muitas vezes.
 */
const LIMITE_CASO_MS = 120_000;

/** Sufixo do nome do cookie de sessão do arcabouço — o prefixo `__Secure-` vem da configuração. */
const SUFIXO_DO_COOKIE_DE_SESSAO = 'session_token';

/** A rota de entrada, composta a partir do prefixo real. Nunca escrita à mão. */
const ROTA_DE_ENTRADA = `${PREFIXO_DAS_ROTAS_DE_IDENTIDADE}/sign-in/email`;

/**
 * A mensagem canônica do código `CREDENCIAL_INVALIDA`, escrita por extenso.
 *
 * Literal, e **não** importada de `MENSAGEM_POR_CODIGO`: comparar a resposta com a constante que a
 * produziu faria a âncora concordar consigo mesma. Ela é contrato — é o que o cliente lê —, e
 * contrato se escreve à mão no caso.
 */
const MENSAGEM_DE_CREDENCIAL_INVALIDA = 'credencial inválida';

/** Senha que não é a de ninguém da carga. Satisfaz o piso de comprimento do arcabouço. */
const SENHA_ERRADA = 'nao-e-a-senha-desta-conta';

/** E-mail que não existe na carga — a terceira resposta de referência do CT-016. */
const EMAIL_INEXISTENTE = 'ninguem.mora.aqui@exemplo.com.br';

// ---------------------------------------------------------------------------------------------
// O elenco — disjunto entre os dois casos, e por isso independente de ordem
// ---------------------------------------------------------------------------------------------

/**
 * CT-016 · a conta levada ao bloqueio pelas cinco tentativas reais.
 *
 * Da empresa **B**, que este arquivo nunca suspende: se ela fosse da A, uma execução em que o
 * CT-017 rodasse primeiro recusaria as cinco tentativas por `EMPRESA_SUSPENSA` **antes** de a senha
 * ser conferida — o contador jamais andaria, e o caso passaria a provar outra coisa.
 */
const CONTA_QUE_BLOQUEIA = pessoaSemeada('usuario.b2@exemplo.com.br');

/** CT-016 · a conta saudável contra quem a senha ERRADA é informada — a resposta de referência. */
const CONTA_SAUDAVEL_DO_BLOQUEIO = pessoaSemeada('usuario.b1@exemplo.com.br');

/** CT-017 · a pessoa desativada no arranjo. Empresa **B**, que permanece ATIVA (§6.6: "em empresa ativa"). */
const PESSOA_DESATIVADA = pessoaSemeada('admin.b@exemplo.com.br');

/** CT-017 · a pessoa da empresa suspensa. Empresa **A**, e é a A que o caso suspende. */
const PESSOA_DE_EMPRESA_SUSPENSA = pessoaSemeada('usuario.a@exemplo.com.br');

/**
 * CT-017 · a conta saudável contra quem a senha ERRADA é informada — a resposta de referência.
 *
 * É o Sysloc Master, e a escolha é deliberada: ele não pertence a empresa alguma, e por isso é a
 * única pessoa da carga **indiferente** à suspensão que este caso aplica. O perfil dele não
 * participa do eixo — a senha informada é a ERRADA, e a tentativa é recusada pelo arcabouço antes de
 * qualquer restrição de sessão ser avaliada.
 */
const CONTA_SAUDAVEL_DA_POLITICA = pessoaSemeada('master@sysloc.com.br');

let identidade: IdentidadeEfemera;
let fila: FilaEfemera;
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

describe('recusas indistinguíveis de admissão (T11)', () => {
  it(
    'CT-016 — conta bloqueada com credencial correta recebe recusa indistinguível da de credencial incorreta',
    async () => {
      // --- Precondições AFIRMADAS, nunca herdadas ----------------------------------------------
      // Tupla inteira por igualdade, e não campo a campo: é ela que garante que a conta que vai ser
      // bloqueada e a conta de referência partem do MESMO estado — ativas, sem falha acumulada, sem
      // instante de liberação e em empresa não suspensa. Sem isso, "as respostas são iguais" poderia
      // significar "as duas contas estavam recusadas pelo mesmo motivo".
      expect(await estadoDaConta(CONTA_QUE_BLOQUEIA.id)).toEqual({
        ativo: true,
        tentativasFalhas: 0,
        bloqueadoAte: null,
        empresaId: EMPRESA_B.id,
        empresaSuspensaEm: null,
      });
      expect(await estadoDaConta(CONTA_SAUDAVEL_DO_BLOQUEIO.id)).toEqual({
        ativo: true,
        tentativasFalhas: 0,
        bloqueadoAte: null,
        empresaId: EMPRESA_B.id,
        empresaSuspensaEm: null,
      });

      // -----------------------------------------------------------------------------------------
      // Companheiro negativo — a MESMA conta, ainda DESBLOQUEADA, com a credencial correta
      // -----------------------------------------------------------------------------------------
      //
      // Ele vem ANTES do bloqueio, e não depois, porque desbloquear a conta depois exigiria ou
      // esperar quinze minutos ou escrever `bloqueado_ate` à mão — que é justamente o que a
      // precondição privilegiada deste caso proíbe. O bônus é que a entrada bem-sucedida zera o
      // contador (`limparBloqueio`), de modo que as cinco tentativas seguintes partem do zero que a
      // asserção acima afirmou.
      //
      // Sem esta perna, "as três recusas são iguais" passaria sobre uma barreira que recusa TODO
      // MUNDO — a diferença observável precisa existir quando a admissão é legítima.
      const sessoesAntesDaEntrada = await contarSessoes();
      const entradaLegitima = await entrar(CONTA_QUE_BLOQUEIA.email, SENHA_DA_CARGA);

      expect(entradaLegitima.status).toBe(200);
      expect(entradaLegitima.cookies.filter(ehCookieDeSessao)).toHaveLength(1);
      expect(await contarSessoes()).toBe(sessoesAntesDaEntrada + 1);
      expect(await contarSessoesDe(CONTA_QUE_BLOQUEIA.id)).toBe(1);

      // --- 1. o bloqueio, pelas CINCO tentativas reais, atravessando a rota HTTP ----------------
      for (let tentativa = 1; tentativa <= LIMITE_DE_FALHAS_CONSECUTIVAS; tentativa += 1) {
        const falha = await entrar(CONTA_QUE_BLOQUEIA.email, SENHA_ERRADA);
        expect(falha.status, `a ${String(tentativa)}ª tentativa malsucedida`).toBe(401);
      }

      // O bloqueio foi produzido pela REGRA que preenche a coluna, e não por escrita direta nela.
      // O número não é reancorado aqui: `LIMITE_DE_FALHAS_CONSECUTIVAS` é amarrado ao valor da RN-06
      // pelo CT-015 (`packages/auth/test/bloqueio.spec.ts`), que é o dono daquele eixo.
      const bloqueada = await estadoDaConta(CONTA_QUE_BLOQUEIA.id);
      expect(bloqueada).toEqual({
        ativo: true,
        tentativasFalhas: LIMITE_DE_FALHAS_CONSECUTIVAS,
        bloqueadoAte: expect.any(Date),
        empresaId: EMPRESA_B.id,
        empresaSuspensaEm: null,
      });
      // No FUTURO: é o instante que o predicado `contaBloqueada` lê, e um prazo já vencido faria o
      // passo seguinte exercitar uma conta liberada sem que nada acusasse.
      expect(bloqueada?.bloqueadoAte?.getTime() ?? 0).toBeGreaterThan(Date.now());

      // --- 2, 3 e 4. as três respostas -----------------------------------------------------------
      const sessoesAntesDasRecusas = await contarSessoes();

      // A credencial é a CORRETA. É o que faz a recusa ser da BARREIRA, e não da senha.
      const comContaBloqueada = await entrar(CONTA_QUE_BLOQUEIA.email, SENHA_DA_CARGA);
      const comCredencialIncorreta = await entrar(CONTA_SAUDAVEL_DO_BLOQUEIO.email, SENHA_ERRADA);
      const comEmailInexistente = await entrar(EMAIL_INEXISTENTE, SENHA_DA_CARGA);

      // --- 5. a ÂNCORA, e depois a comparação CRUZADA --------------------------------------------
      //
      // A âncora é o único literal deste eixo, e ela fica sobre a resposta de REFERÊNCIA — a da
      // credencial incorreta, que é a forma que a RN-10 manda todas as outras imitarem. Sem ela,
      // três respostas idênticas e ERRADAS (o `{ statusCode, error, message }` do arcabouço, por
      // exemplo) passariam na igualdade cruzada.
      //
      // Ancorar a referência, e não o sujeito, é deliberado: é o que deixa a comparação cruzada
      // carregar sozinha o peso de julgar a recusa POR BLOQUEIO. Medido na prova de falsificação —
      // com a âncora sobre o sujeito, um mutante que divergisse o bloqueio reprovava no literal
      // antes de a cruzada ser exercitada, e o poder dela ficava sem demonstração.
      expect(comCredencialIncorreta.status).toBe(401);
      expect(comCredencialIncorreta.corpo).toEqual({
        codigo: CodigoErro.CREDENCIAL_INVALIDA,
        mensagem: MENSAGEM_DE_CREDENCIAL_INVALIDA,
      });

      // E a cruzada, que é o que prova a INDISTINGUIBILIDADE: cada referência veio de um sujeito
      // arranjado neste caso e com precondição afirmada acima. `observavel` compara status, corpo
      // desserializado, corpo BYTE A BYTE, o conjunto de chaves do corpo (é ele que reprova um
      // `detalhes` ou um `campo` a mais numa das respostas) e o conjunto de nomes de cabeçalho.
      expect(observavel(comContaBloqueada)).toEqual(observavel(comCredencialIncorreta));
      expect(observavel(comEmailInexistente)).toEqual(observavel(comCredencialIncorreta));

      // Nenhuma resposta traz cabeçalho de sessão. A igualdade acima já compara o conjunto de nomes
      // de cabeçalho, mas ela provaria apenas que as três **concordam**: se todas trouxessem cookie,
      // as três continuariam iguais. Esta asserção é o eixo absoluto do critério.
      for (const resposta of [comContaBloqueada, comCredencialIncorreta, comEmailInexistente]) {
        expect(resposta.cookies).toEqual([]);
      }

      // E nenhuma linha nova em `identidade.sessao` — recusa que responde erro mas cria sessão é o
      // defeito que a asserção de resposta sozinha não pega.
      expect(await contarSessoes()).toBe(sessoesAntesDasRecusas);
      expect(await contarSessoesDe(CONTA_SAUDAVEL_DO_BLOQUEIO.id)).toBe(0);
      // A conta bloqueada continua com a ÚNICA sessão do companheiro negativo — nem uma a mais.
      expect(await contarSessoesDe(CONTA_QUE_BLOQUEIA.id)).toBe(1);
    },
    LIMITE_CASO_MS,
  );

  it(
    'CT-017 — pessoa desativada e empresa suspensa recebem a mesma recusa, e nenhuma sessão é criada',
    async () => {
      // --- Precondições AFIRMADAS antes de qualquer arranjo -------------------------------------
      expect(await estadoDaConta(PESSOA_DESATIVADA.id)).toEqual({
        ativo: true,
        tentativasFalhas: 0,
        bloqueadoAte: null,
        empresaId: EMPRESA_B.id,
        empresaSuspensaEm: null,
      });
      expect(await estadoDaConta(PESSOA_DE_EMPRESA_SUSPENSA.id)).toEqual({
        ativo: true,
        tentativasFalhas: 0,
        bloqueadoAte: null,
        empresaId: EMPRESA_A.id,
        empresaSuspensaEm: null,
      });
      expect(await estadoDaConta(CONTA_SAUDAVEL_DA_POLITICA.id)).toEqual({
        ativo: true,
        tentativasFalhas: 0,
        bloqueadoAte: null,
        // Nulos porque o Master não pertence a empresa alguma — é o que o torna a linha de base
        // indiferente à suspensão que este caso aplica logo abaixo.
        empresaId: null,
        empresaSuspensaEm: null,
      });

      // -----------------------------------------------------------------------------------------
      // Companheiro negativo — as MESMAS pessoas, ativas e em empresa ativa
      // -----------------------------------------------------------------------------------------
      //
      // Antes do arranjo, e com a MESMA credencial que será usada depois: o único eixo que muda
      // entre esta perna e a recusa é o estado da pessoa e o da empresa dela.
      for (const pessoa of [PESSOA_DESATIVADA, PESSOA_DE_EMPRESA_SUSPENSA]) {
        const sessoesAntes = await contarSessoes();
        const entradaLegitima = await entrar(pessoa.email, SENHA_DA_CARGA);

        expect(entradaLegitima.status, pessoa.email).toBe(200);
        expect(entradaLegitima.cookies.filter(ehCookieDeSessao), pessoa.email).toHaveLength(1);
        expect(await contarSessoes(), pessoa.email).toBe(sessoesAntes + 1);
        expect(await contarSessoesDe(pessoa.id), pessoa.email).toBe(1);
      }

      // --- O arranjo: estado de domínio persistido, pelo padrão que a T7 estabeleceu -------------
      await desativarPessoa(PESSOA_DESATIVADA.id);
      await suspenderEmpresa(EMPRESA_A.id);

      // O arranjo TOMOU EFEITO, e só ele: a desativação não suspendeu empresa nenhuma, e a suspensão
      // não desativou pessoa alguma. Sem estas duas afirmações, um arranjo que errasse o alvo faria
      // as três respostas serem iguais **pelo motivo errado**.
      expect(await estadoDaConta(PESSOA_DESATIVADA.id)).toEqual({
        ativo: false,
        tentativasFalhas: 0,
        bloqueadoAte: null,
        empresaId: EMPRESA_B.id,
        empresaSuspensaEm: null,
      });
      expect(await estadoDaConta(PESSOA_DE_EMPRESA_SUSPENSA.id)).toEqual({
        ativo: true,
        tentativasFalhas: 0,
        bloqueadoAte: null,
        empresaId: EMPRESA_A.id,
        empresaSuspensaEm: expect.any(Date),
      });

      // --- 1. o estado ANTES das três requisições ------------------------------------------------
      const sessoesAntes = await contarSessoes();
      const trilhaAntes = new Set((await tentativasRegistradas()).map((linha) => linha.id));

      // --- 2. as três requisições ---------------------------------------------------------------
      // As duas primeiras com a credencial CORRETA — é o que faz a recusa ser da BARREIRA.
      const comPessoaDesativada = await entrar(PESSOA_DESATIVADA.email, SENHA_DA_CARGA);
      const comEmpresaSuspensa = await entrar(PESSOA_DE_EMPRESA_SUSPENSA.email, SENHA_DA_CARGA);
      const comCredencialIncorreta = await entrar(CONTA_SAUDAVEL_DA_POLITICA.email, SENHA_ERRADA);

      // --- 3. a âncora e a comparação CRUZADA ----------------------------------------------------
      expect(comCredencialIncorreta.status).toBe(401);
      expect(comCredencialIncorreta.corpo).toEqual({
        codigo: CodigoErro.CREDENCIAL_INVALIDA,
        mensagem: MENSAGEM_DE_CREDENCIAL_INVALIDA,
      });

      // A referência é a MESMA nas duas comparações, de propósito: é a resposta da credencial
      // incorreta que a RN-10 manda imitar, e compará-las entre si também provaria que os dois
      // predicados concordam **um com o outro** sem dizer nada sobre o alvo.
      expect(observavel(comPessoaDesativada)).toEqual(observavel(comCredencialIncorreta));
      expect(observavel(comEmpresaSuspensa)).toEqual(observavel(comCredencialIncorreta));

      for (const resposta of [comPessoaDesativada, comEmpresaSuspensa, comCredencialIncorreta]) {
        expect(resposta.cookies).toEqual([]);
      }

      // --- 4. nenhuma sessão nova ---------------------------------------------------------------
      expect(await contarSessoes()).toBe(sessoesAntes);
      // E a contagem por pessoa não se moveu: cada uma continua com a única sessão que a perna
      // legítima criou, e o Master com nenhuma.
      expect(await contarSessoesDe(PESSOA_DESATIVADA.id)).toBe(1);
      expect(await contarSessoesDe(PESSOA_DE_EMPRESA_SUSPENSA.id)).toBe(1);
      expect(await contarSessoesDe(CONTA_SAUDAVEL_DA_POLITICA.id)).toBe(0);

      // --- 5. a trilha registrou as TRÊS tentativas, com desfecho de recusa ----------------------
      //
      // As linhas novas são identificadas por DIFERENÇA de chave primária, e não por ordenação
      // temporal: `ocorrida_em` vem do relógio do banco e duas inserções podem empatar, o que faria
      // uma asserção por ordem depender de desempate arbitrário.
      //
      // Aqui a trilha DISTINGUE o motivo, e é assim que tem de ser: a RN-10 exige indistinguibilidade
      // na RESPOSTA — o motivo fica onde ele serve, que é a auditoria que a operação lê. Uma trilha
      // que gravasse os três com o mesmo desfecho apagaria o sinal de ataque da RN-11.
      const novas = (await tentativasRegistradas())
        .filter((linha) => !trilhaAntes.has(linha.id))
        .map((linha) => ({
          emailInformado: linha.emailInformado,
          usuarioId: linha.usuarioId,
          desfecho: linha.desfecho,
        }))
        .sort((uma, outra) => uma.emailInformado.localeCompare(outra.emailInformado));

      expect(novas).toEqual([
        {
          emailInformado: PESSOA_DESATIVADA.email,
          usuarioId: PESSOA_DESATIVADA.id,
          desfecho: 'ACESSO_RECUSADO',
        },
        {
          emailInformado: CONTA_SAUDAVEL_DA_POLITICA.email,
          usuarioId: CONTA_SAUDAVEL_DA_POLITICA.id,
          desfecho: 'CREDENCIAL_INCORRETA',
        },
        {
          emailInformado: PESSOA_DE_EMPRESA_SUSPENSA.email,
          usuarioId: PESSOA_DE_EMPRESA_SUSPENSA.id,
          desfecho: 'ACESSO_RECUSADO',
        },
      ]);
    },
    LIMITE_CASO_MS,
  );
});

// ---------------------------------------------------------------------------------------------
// O que é comparado entre respostas
// ---------------------------------------------------------------------------------------------

/**
 * Tudo o que um cliente observa de uma resposta de recusa, num objeto só.
 *
 * Os cinco eixos, e por que cada um:
 *
 *   * `status` — o primeiro sinal, e o mais fácil de divergir sem querer (`403` para "desativada");
 *   * `corpo` — o objeto desserializado, que é o que o cliente lê;
 *   * `texto` — o corpo **byte a byte**. Ele pega o que a igualdade de objeto não pega: ordem de
 *     chaves, espaçamento e acentuação diferentes produzem o mesmo objeto e cadeias distintas;
 *   * `chavesDoCorpo` — o CONJUNTO de campos. É este eixo que reprova um `detalhes` ou um `campo`
 *     presente em apenas uma das respostas, que é a forma mais discreta de confirmar a existência
 *     da conta;
 *   * `cabecalhos` — o conjunto de NOMES de cabeçalho, nunca os valores. Nomes são estáveis entre
 *     respostas do mesmo fluxo; valores carregam instante e comprimento, e compará-los produziria
 *     falha por variação que não distingue coisa alguma.
 *
 * Comparar o objeto INTEIRO, e não eixo a eixo, é o que faz a falha nomear qual deles divergiu.
 */
function observavel(resposta: Resposta): Record<string, unknown> {
  return {
    status: resposta.status,
    corpo: resposta.corpo,
    texto: resposta.texto,
    chavesDoCorpo: chavesOrdenadas(resposta.corpo),
    cabecalhos: [...resposta.cabecalhos],
  };
}

/** As chaves de um corpo JSON, ordenadas. Corpo que não seja objeto vira lista vazia. */
function chavesOrdenadas(corpo: unknown): string[] {
  return typeof corpo === 'object' && corpo !== null ? Object.keys(corpo).sort() : [];
}

// ---------------------------------------------------------------------------------------------
// Observação e arranjo do estado persistido
// ---------------------------------------------------------------------------------------------

/** O estado que decide a admissão de uma pessoa, lido do banco pela mesma junção que a barreira usa. */
interface EstadoDaConta {
  ativo: boolean;
  tentativasFalhas: number;
  bloqueadoAte: Date | null;
  empresaId: string | null;
  empresaSuspensaEm: Date | null;
}

/**
 * Lê o estado de admissão persistido de uma pessoa.
 *
 * Observação de estado persistido — a mesma via pela qual a T7, a T8 e a T10 já afirmam precondição.
 * A junção é `LEFT` pela razão que `carregarPessoa` registra: o Master não tem empresa, e com `INNER`
 * ele simplesmente sumiria da consulta.
 */
async function estadoDaConta(usuarioId: string): Promise<EstadoDaConta | undefined> {
  const { empresa, usuario } = esquemaIdentidade;

  const [linha] = await identidade.acesso.identidade
    .select({
      ativo: usuario.ativo,
      tentativasFalhas: usuario.tentativasFalhas,
      bloqueadoAte: usuario.bloqueadoAte,
      empresaId: usuario.empresaId,
      empresaSuspensaEm: empresa.suspensaEm,
    })
    .from(usuario)
    .leftJoin(empresa, eq(empresa.id, usuario.empresaId))
    .where(eq(usuario.id, usuarioId))
    .limit(1);

  return linha;
}

/**
 * Desativa a pessoa no arranjo do caso.
 *
 * **Não existe caminho de produção para esta coluna nesta fatia** — o cabeçalho deste arquivo explica
 * por que criar um seria antecipar a fatia `autorizacao-e-ciclo-de-acesso` e vazar símbolo test-only
 * para a produção. É o mesmo padrão que a T7 usa no arranjo dela. A partir daqui, tudo é pela rota
 * real.
 */
async function desativarPessoa(usuarioId: string): Promise<void> {
  const { usuario } = esquemaIdentidade;

  await identidade.acesso.identidade
    .update(usuario)
    .set({ ativo: false })
    .where(eq(usuario.id, usuarioId));
}

/** Suspende a empresa no arranjo do caso, pela mesma razão e pelo mesmo padrão de {@link desativarPessoa}. */
async function suspenderEmpresa(empresaId: string): Promise<void> {
  const { empresa } = esquemaIdentidade;

  await identidade.acesso.identidade
    .update(empresa)
    .set({ suspensaEm: new Date() })
    .where(eq(empresa.id, empresaId));
}

/** Quantas sessões existem no banco inteiro. */
async function contarSessoes(): Promise<number> {
  const [linha] = await identidade.acesso.identidade
    .select({ total: count() })
    .from(esquemaIdentidade.sessao);

  return linha?.total ?? -1;
}

/** Quantas sessões existem para uma pessoa. */
async function contarSessoesDe(usuarioId: string): Promise<number> {
  const { sessao } = esquemaIdentidade;

  const [linha] = await identidade.acesso.identidade
    .select({ total: count() })
    .from(sessao)
    .where(eq(sessao.usuarioId, usuarioId));

  return linha?.total ?? -1;
}

/** Uma linha da trilha, no que este arquivo observa dela. */
interface TentativaRegistrada {
  id: string;
  emailInformado: string;
  usuarioId: string | null;
  desfecho: string;
}

/** A trilha inteira. O caso identifica as linhas novas por diferença de chave primária. */
async function tentativasRegistradas(): Promise<TentativaRegistrada[]> {
  const { tentativaLogin } = esquemaIdentidade;

  return await identidade.acesso.identidade
    .select({
      id: tentativaLogin.id,
      emailInformado: tentativaLogin.emailInformado,
      usuarioId: tentativaLogin.usuarioId,
      desfecho: tentativaLogin.desfecho,
    })
    .from(tentativaLogin);
}

// ---------------------------------------------------------------------------------------------
// Cliente HTTP
// ---------------------------------------------------------------------------------------------

interface Resposta {
  readonly status: number;
  readonly texto: string;
  readonly corpo: unknown;
  readonly cookies: readonly string[];
  /** Os NOMES dos cabeçalhos da resposta, ordenados. Nunca os valores — ver {@link observavel}. */
  readonly cabecalhos: readonly string[];
}

interface OpcoesDoPedido {
  readonly metodo?: string;
  readonly corpo?: Record<string, unknown>;
}

/**
 * Executa uma requisição HTTP real contra a aplicação.
 *
 * O cabeçalho `Origin` acompanha toda requisição com a MESMA origem da aplicação — é o que um
 * navegador enviaria, e é o que o arcabouço confere. Ele é composto da mesma fonte que o endereço
 * base, e não escrito à mão. O corpo só é desserializado quando o tipo declarado é JSON.
 */
async function pedir(caminho: string, opcoes: OpcoesDoPedido = {}): Promise<Resposta> {
  const cabecalhos: Record<string, string> = { connection: 'close', origin: base };

  if (opcoes.corpo !== undefined) {
    cabecalhos['content-type'] = 'application/json';
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
    cabecalhos: [...resposta.headers.keys()].sort(),
  };
}

/** Entra pelo caminho REAL — a rota pública de entrada. Nenhum estado de sessão é forjado. */
async function entrar(email: string, senha: string): Promise<Resposta> {
  return await pedir(ROTA_DE_ENTRADA, {
    metodo: 'POST',
    corpo: { email, password: senha },
  });
}

/** O cabeçalho `Set-Cookie` carrega a credencial de sessão do arcabouço. */
function ehCookieDeSessao(bruto: string): boolean {
  const par = bruto.split(';')[0] ?? '';
  return (par.split('=')[0] ?? '').trim().endsWith(SUFIXO_DO_COOKIE_DE_SESSAO);
}
