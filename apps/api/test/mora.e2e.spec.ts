/**
 * As **duas rotas de `/v1/multa-e-juros`** — T6 da fatia `cobranca-e-mora`: ler a política de mora
 * da empresa e defini-la.
 *
 * ---------------------------------------------------------------------------
 * INVARIANTES
 * ---------------------------------------------------------------------------
 *
 * | Critério | Caso   | Invariante |
 * |---|---|---|
 * | CA-11 | CT-538 | `PUT /v1/multa-e-juros` grava a política da empresa **do contexto**, e a
 * |       |        | regravação **ATUALIZA a mesma linha** em vez de acrescentar outra — a contagem
 * |       |        | crua por empresa termina em `1`, nunca `2`. `GET /v1/multa-e-juros` devolve
 * |       |        | sempre o último par gravado, e devolve `{ multaPercentual: 0,
 * |       |        | jurosPercentual: 0 }` com `200` quando a empresa **nunca** configurou —
 * |       |        | **sem criar linha** (contagem `0` depois da leitura) e **sem `404`** (RD-21).
 * |       |        | A política de uma empresa nunca alcança a outra: nenhuma rota recebe empresa,
 * |       |        | e o que separa as duas é o cookie. |
 * | CA-11 | CT-539 | Todo corpo que viole a faixa `[0, 100]`, a escala `0.01`, a completude do
 * |       |        | `strictObject` ou o conjunto fechado de chaves é recusado com `422` e o
 * |       |        | envelope **INTEIRO** da ADR-0017 nomeando o campo; e a política já gravada
 * |       |        | permanece byte a byte a mesma, com a contagem crua intacta — recusa nunca é
 * |       |        | escrita parcial. As bordas `{0, 0}` e `{100, 100}` são **ACEITAS**: a faixa é
 * |       |        | fechada nos dois extremos. |
 *
 * Rastreabilidade: `CA-11 → CT-538 (RD-11, RD-21)`, `CA-11 → CT-539 (RD-21)`.
 *
 * ===========================================================================
 * A CONTAGEM DE LINHAS é o discriminador do `upsert` — e ela vem em duas medições
 * ===========================================================================
 *
 * As leituras sozinhas **não distinguem** a implementação correta da errada. Uma escrita que
 * inserisse uma linha por chamada passaria em todas elas — a última inserida venceria em qualquer
 * ordenação estável —, e o defeito só apareceria quando a restrição `UNIQUE (empresa_id)` fosse
 * consultada, ou quando duas linhas discordantes chegassem à apuração da carteira. É a contagem
 * crua que separa *"a leitura devolve o último par"* de *"a empresa tem UMA política"*.
 *
 * A outra medição é a contagem **`0`** logo depois do primeiro `GET`, e ela separa a RD-21 de uma
 * implementação que cria a linha zerada na leitura. As duas metades da regra são independentes: não
 * responder `404` é a primeira, e **não escrever** é a segunda — a segunda é a que passa
 * despercebida, porque uma leitura que grava devolve exatamente o mesmo corpo.
 *
 * As contagens são **cruas e sem recorte**, e a empresa entra pelo **contexto**, que é o mesmo
 * mecanismo que a aplicação usa. Nenhum `WHERE empresa_id` é escrito aqui — quem recorta é a
 * política (ADR-0008).
 *
 * ===========================================================================
 * O CONTROLE POSITIVO das bordas, e por que ele é obrigatório
 * ===========================================================================
 *
 * Sem os pares `{0, 0}` e `{100, 100}` respondendo `200`, os seis primeiros passos do `CT-539`
 * seriam satisfeitos por uma validação que recusasse **todo** corpo — e a releitura intacta do passo
 * 6 continuaria verdadeira, porque nada teria sido gravado. O par aceito é o que torna o caso
 * discriminante, e as bordas exatas são o que prende a faixa pelos dois lados: um piso maior que
 * zero recusaria `{0, 0}`, e um teto menor que cem recusaria `{100, 100}`.
 *
 * A releitura final é o que separa *recusado* de *aceito com efeito parcial* — a diferença que um
 * `422` sozinho não conta.
 *
 * ===========================================================================
 * A precondição privilegiada, e por que ela é montada pelo caminho REAL
 * ===========================================================================
 *
 *   * **sessão** — pela rota pública de entrada, com a senha da carga. Nenhum estado de sessão é
 *     forjado, e nenhum cookie é montado à mão;
 *   * **arranjo de chaves** — pelo caminho real da camada de dados (`escreverAjustes` com a coerência
 *     ação→tela validada pela função de domínio), sob o contexto de tenant da empresa da pessoa. É o
 *     mesmo caminho que a rota do Admin usa por dentro, e o mesmo padrão de
 *     `test/cobrancas.e2e.spec.ts` e `test/autorizacao-do-dominio.e2e.spec.ts`. **Nenhum símbolo de
 *     produção nasce para o teste enxergar algo**, nenhuma rota de verificação é publicada, e
 *     `app.empresa_id` nunca é fixado por fora da barreira;
 *   * **o efetivo é AFIRMADO por `GET /v1/sessao`** antes dos casos, e não presumido: sem essa linha,
 *     um `403` nas rotas de mora seria indistinguível de um defeito delas.
 *
 * O arranjo tem **uma chave só**, e a economia é conteúdo: `TELA:multa_e_juros` é a exigência
 * declarada na classe do controlador, e nada nesta task exige outra área. Conceder mais do que o
 * necessário faria o caso deixar de medir a exigência que ele exercita. O perfil da pessoa da carga
 * é `USUARIO_EMPRESA`, cuja matriz padrão é **só** `TELA:resumo` — é isso que torna a concessão uma
 * precondição de verdade, e não uma formalidade.
 *
 * Quem mede a **recusa** de quem não alcança a área é o `CT-534`, em T11.
 *
 * ===========================================================================
 * A ORDEM dos dois casos é conteúdo, e o primeiro depende dela
 * ===========================================================================
 *
 * O `CT-538` exige que **nenhuma** das duas empresas tenha chamado o `PUT` antes dele — é o
 * invariante da RD-21 que ele mede, e ele não é reconstituível depois de a linha existir (não há
 * rota que apague a política, e não deve haver). Por isso ele é o primeiro `it` do arquivo, e a
 * contagem `0` do passo 2 é também a **afirmação** dessa precondição: se um caso anterior tivesse
 * configurado a empresa A, este reprovaria ruidosamente, em vez de medir outra coisa em silêncio.
 *
 * O `CT-539` **não** depende de ordem: ele grava a própria precondição (`{2, 1}`) pela rota real, e
 * a escrita é idempotente por construção — o corpo é completo, sem campo opcional, de modo que ela
 * descreve um estado final inteiro qualquer que fosse o anterior.
 *
 * ===========================================================================
 * MUTANTES EXECUTADOS sobre a porta (2026-08-10) — os dois reprovaram
 * ===========================================================================
 *
 * As asserções deste arquivo são **comportamentais** — exercitam a rota por HTTP real e observam o
 * desfecho —, e por isso não estão sob a exigência de prova de falsificação da
 * `.claude/rules/testing-stack.md`. As duas medições abaixo foram feitas assim mesmo, pelo P4 do
 * Protocolo Antirregressão: as duas propriedades que este arquivo existe para prender são
 * **invisíveis nas respostas**, e uma asserção que não pudesse falhar por elas seria pior que
 * ausente. Os mutantes foram aplicados ao fonte de `packages/db/src/configuracao-de-mora.ts` e a
 * suíte foi invocada pelo **script do pacote** (`pnpm --filter @sysloc/api test`), nunca por
 * `vitest run` avulso — este arquivo carrega `@sysloc/db` pela fronteira do pacote, e um `vitest
 * run` leria o `dist/` da compilação anterior.
 *
 *   * **controle** — árvore íntegra: `162 passed`;
 *   * **M1 · a leitura CRIA a linha zerada** (`lerConfiguracaoDeMora` delegando a
 *     `gravarConfiguracaoDeMora(tx, POLITICA_AUSENTE)` quando não acha linha): `1 failed |
 *     161 passed`, no `CT-538`, com *"expected 1 to be +0"* — a contagem do passo 2. **Todas as
 *     asserções sobre o corpo do passo 1 seguiram verdes**, e é isso que prova que a contagem `0` é
 *     carregada e não redundante: a segunda metade da RD-21 não aparece em resposta alguma;
 *   * **M2 · o `upsert` deixa de atualizar** (`ON CONFLICT (empresa_id) DO NOTHING` no lugar do `DO
 *     UPDATE`): `2 failed | 160 passed`, nos **dois** casos, com *"expected 500 to be 200"* — o
 *     `RETURNING` vem vazio na colisão e a porta levanta a falha nomeada em vez de devolver um
 *     `undefined` como se fosse a política vigente. É a prova de que a regravação é exercitada de
 *     verdade, e não apenas a primeira escrita;
 *   * **reversão** — o fonte foi restaurado do backup e conferido idêntico ao original por
 *     `diff -q`, e o controle voltou a `162 passed`.
 *
 * ===========================================================================
 * De onde vêm o banco, a fila e a credencial (ADR-0006)
 * ===========================================================================
 *
 * De instâncias efêmeras próprias. Nenhuma coordenada de conexão é lida do ambiente: o ambiente do
 * processo é MONTADO a partir do que os helpers devolvem, e a porta é **reservada** (trava atômica)
 * porque o arcabouço confere a origem das requisições com cookie contra o endereço base.
 */

import { randomBytes } from 'node:crypto';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { type ChaveDoCatalogo, validarCoerenciaDeAjustes } from '@sysloc/auth';
import {
  type AcessoAoBanco,
  abrirAcessoAoBanco,
  contextoDeTenant,
  EMPRESA_A,
  EMPRESA_B,
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
import { CAMINHO_DA_SESSAO } from '../src/autenticacao/sessao.controller.ts';
import { ENDERECO_DE_ESCUTA, PREFIXO_DE_VERSAO } from '../src/configuracao/ambiente.ts';
import { criarAplicacao } from '../src/main.ts';
import { CAMINHO_DE_MULTA_E_JUROS } from '../src/mora/mora.controller.ts';

/** Limite da montagem: banco migrado, semente com credencial, fila e a aplicação real. */
const LIMITE_DE_MONTAGEM_MS = 240_000;

/** Limite de um caso que atravessa HTTP e banco dezenas de vezes. */
const LIMITE_CASO_MS = 120_000;

/** Sufixo do nome do cookie de sessão do arcabouço — o prefixo vem da configuração. */
const SUFIXO_DO_COOKIE_DE_SESSAO = 'session_token';

/** A rota de entrada, composta a partir do prefixo real. Nunca escrita à mão. */
const ROTA_DE_ENTRADA = `${PREFIXO_DAS_ROTAS_DE_IDENTIDADE}/sign-in/email`;

/** Caminho, relativo à raiz, da rota de sessão do produto. Composto, nunca escrito à mão. */
const CAMINHO_DA_SESSAO_CORRENTE = `/${PREFIXO_DE_VERSAO}/${CAMINHO_DA_SESSAO}`;

/** Caminho, relativo à raiz, do recurso singular desta task. */
const POLITICA_DE_MORA = `/${PREFIXO_DE_VERSAO}/${CAMINHO_DE_MULTA_E_JUROS}`;

/**
 * A mensagem canônica do `422`, escrita por extenso.
 *
 * Literal, e **não** lida de `MENSAGEM_POR_CODIGO`: os casos comparam corpos inteiros por igualdade,
 * e derivá-la da mesma tabela que o SUT usa faria a asserção concordar consigo mesma — um erro de
 * texto na tabela passaria despercebido nos dois lados.
 */
const MENSAGEM_DE_CAMPO_INVALIDO = 'requisição inválida';

/**
 * O arranjo concedido às duas sessões — **uma chave só**.
 *
 * Literal, e **não** derivado da exigência declarada no controlador: derivá-lo faria a asserção
 * concordar com o SUT, e trocar a exigência da classe deixaria de reprovar caso algum.
 */
const CHAVES_DO_ARRANJO: readonly ChaveDoCatalogo[] = ['TELA:multa_e_juros'];

/** A área que a classe do controlador exige — afirmada no efetivo, nunca suposta. */
const AREA_DE_MULTA_E_JUROS: ChaveDoCatalogo = 'TELA:multa_e_juros';

/**
 * A política publicada pela empresa que **nunca** configurou (RD-21).
 *
 * Escrita por extenso, e não derivada de constante do SUT: é o corpo que o contrato promete a toda
 * empresa nova, e derivá-lo da mesma fonte que o produz faria a asserção concordar consigo mesma.
 */
const POLITICA_ZERADA = { multaPercentual: 0, jurosPercentual: 0 } as const;

/** Os três pares do `CT-538` — dois em sequência na empresa A, e um distinto na empresa B. */
const PRIMEIRA_POLITICA_DE_A = { multaPercentual: 2, jurosPercentual: 1 } as const;
const SEGUNDA_POLITICA_DE_A = { multaPercentual: 5, jurosPercentual: 0.5 } as const;
const POLITICA_DE_B = { multaPercentual: 10, jurosPercentual: 2 } as const;

/** As duas bordas EXATAS da faixa fechada — o controle positivo do `CT-539`. */
const BORDA_INFERIOR = { multaPercentual: 0, jurosPercentual: 0 } as const;
const BORDA_SUPERIOR = { multaPercentual: 100, jurosPercentual: 100 } as const;

/**
 * A pessoa que age na empresa A: `USUARIO_EMPRESA` **da carga**.
 *
 * Ela tem senha definitiva e nenhuma exigência pendente, então a sessão dela nasce **plena** com uma
 * entrada só — e o perfil dela **não** concede `TELA:multa_e_juros` (a matriz de `USUARIO_EMPRESA` é
 * só `TELA:resumo`), que é o que torna a concessão do arranjo uma precondição de verdade.
 */
const QUEM_AGE = pessoaSemeada('usuario.a@exemplo.com.br');

/**
 * A pessoa que age na empresa B: `USUARIO_EMPRESA` **da carga**, com o mesmo estado inicial da de A.
 *
 * **Nenhuma rota recebe a empresa dela**: o que separa uma sessão da outra é o cookie, e é a guarda
 * que publica o contexto a partir da sessão.
 */
const QUEM_AGE_EM_B = pessoaSemeada('usuario.b1@exemplo.com.br');

let identidade: IdentidadeEfemera;
let fila: FilaEfemera;
let acessoAoNegocio: AcessoAoBanco;
let aplicacao: NestFastifyApplication;
let base: string;
let ambienteAnterior: NodeJS.ProcessEnv;
let cookie: string;
let cookieDeB: string;

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

  cookie = await entrar(QUEM_AGE.email, SENHA_DA_CARGA);
  await conceder(QUEM_AGE.id, EMPRESA_A.id, CHAVES_DO_ARRANJO);

  cookieDeB = await entrar(QUEM_AGE_EM_B.email, SENHA_DA_CARGA);
  await conceder(QUEM_AGE_EM_B.id, EMPRESA_B.id, CHAVES_DO_ARRANJO);

  // Precondição AFIRMADA, e não suposta, nas DUAS sessões: sem estas linhas, um `403` nas rotas de
  // mora seria indistinguível de um defeito delas.
  for (const credencial of [cookie, cookieDeB]) {
    const sessao = (await pedir(CAMINHO_DA_SESSAO_CORRENTE, { cookie: credencial }))
      .corpo as SessaoPublicada;
    expect(sessao.telas).toContain(AREA_DE_MULTA_E_JUROS);
  }
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

describe('a política de multa e juros por empresa (T6)', () => {
  it(
    'CT-538 — a política é gravada, regravada e lida; empresa que nunca configurou lê zero sem que linha alguma nasça',
    async () => {
      // -------------------------------------------------------------------------------------
      // Passo 1 — a empresa A NUNCA configurou: `200` com zeros, e jamais `404`
      // -------------------------------------------------------------------------------------
      //
      // O corpo INTEIRO por igualdade, e não a presença de campos: um `id` ou um `empresaId`
      // vazando reprova aqui. E o status é afirmado à parte, porque é ele que carrega a metade da
      // RD-21 que um corpo correto não distinguiria — `404` com corpo de erro também "não tem
      // política", e é exatamente a resposta que a regra proíbe.
      const semPolitica = await pedir(POLITICA_DE_MORA, { cookie });

      expect(semPolitica.status).toBe(200);
      expect(semPolitica.corpo).toEqual(POLITICA_ZERADA);

      // -------------------------------------------------------------------------------------
      // Passo 2 — a leitura NÃO criou linha: a segunda metade da RD-21
      // -------------------------------------------------------------------------------------
      //
      // É a metade que passa despercebida: uma leitura que gravasse a linha zerada devolveria
      // exatamente o mesmo corpo do passo 1, e nenhuma asserção sobre a resposta a pegaria.
      expect(await contarPoliticas(EMPRESA_A.id)).toBe(0);
      expect(await contarPoliticas(EMPRESA_B.id)).toBe(0);

      // -------------------------------------------------------------------------------------
      // Passo 3 — a primeira gravação ECOA o par gravado
      // -------------------------------------------------------------------------------------
      const primeira = await pedir(POLITICA_DE_MORA, {
        metodo: 'PUT',
        cookie,
        corpo: { ...PRIMEIRA_POLITICA_DE_A },
      });

      expect(primeira.status).toBe(200);
      expect(primeira.corpo).toEqual(PRIMEIRA_POLITICA_DE_A);

      // -------------------------------------------------------------------------------------
      // Passo 4 — a leitura devolve o que a escrita gravou
      // -------------------------------------------------------------------------------------
      expect(await lerPolitica(cookie)).toEqual(PRIMEIRA_POLITICA_DE_A);

      // -------------------------------------------------------------------------------------
      // Passo 5 — a REGRAVAÇÃO, com um par diferente nos dois campos
      // -------------------------------------------------------------------------------------
      //
      // Os dois campos mudam de propósito: um par que repetisse um dos valores deixaria de
      // discriminar uma escrita que atualizasse só uma das colunas. E `0.5` exercita a casa decimal
      // que a coluna `numeric(5,2)` guarda — um `integer` no caminho a devolveria como `1` ou `0`.
      const segunda = await pedir(POLITICA_DE_MORA, {
        metodo: 'PUT',
        cookie,
        corpo: { ...SEGUNDA_POLITICA_DE_A },
      });

      expect(segunda.status).toBe(200);
      expect(segunda.corpo).toEqual(SEGUNDA_POLITICA_DE_A);
      expect(await lerPolitica(cookie)).toEqual(SEGUNDA_POLITICA_DE_A);

      // -------------------------------------------------------------------------------------
      // Passo 6 — UMA linha, nunca duas: o discriminador do `upsert`
      // -------------------------------------------------------------------------------------
      //
      // Sem esta asserção, uma implementação que inserisse uma linha por chamada passaria em todas
      // as leituras acima — ver o cabeçalho deste arquivo.
      expect(await contarPoliticas(EMPRESA_A.id)).toBe(1);

      // -------------------------------------------------------------------------------------
      // Passo 7 — a empresa B, e o isolamento nos DOIS sentidos
      // -------------------------------------------------------------------------------------
      //
      // Nenhuma rota recebe empresa: o que decide onde a política nasce é o cookie. A leitura de A
      // depois da escrita de B é o que impede uma implementação sem escopo de passar — ela
      // devolveria o par de B nas duas sessões.
      const emB = await pedir(POLITICA_DE_MORA, {
        metodo: 'PUT',
        cookie: cookieDeB,
        corpo: { ...POLITICA_DE_B },
      });

      expect(emB.status).toBe(200);
      expect(emB.corpo).toEqual(POLITICA_DE_B);
      expect(await lerPolitica(cookieDeB)).toEqual(POLITICA_DE_B);
      expect(await lerPolitica(cookie)).toEqual(SEGUNDA_POLITICA_DE_A);

      // Uma linha em cada empresa — e não duas numa e nenhuma na outra, que é como uma escrita sem
      // escopo apareceria na contagem.
      expect(await contarPoliticas(EMPRESA_A.id)).toBe(1);
      expect(await contarPoliticas(EMPRESA_B.id)).toBe(1);
    },
    LIMITE_CASO_MS,
  );

  it(
    'CT-539 — a entrada recusa fora de faixa, fora de escala, corpo parcial e chave desconhecida; e a recusa não escreve',
    async () => {
      // A precondição é gravada pela rota real, e o caso NÃO depende de ordem por causa disso: o
      // corpo é completo, então a escrita descreve um estado final inteiro qualquer que fosse o
      // anterior.
      const precondicao = await pedir(POLITICA_DE_MORA, {
        metodo: 'PUT',
        cookie,
        corpo: { ...PRIMEIRA_POLITICA_DE_A },
      });

      expect(precondicao.status).toBe(200);

      const antes = await contarPoliticas(EMPRESA_A.id);

      /**
       * Os seis corpos recusados, cada um com o campo que a resposta nomeia.
       *
       * Os dois últimos são a metade que mais importa desta superfície: **campo ausente é recusa**, e
       * nunca "preserve o valor atual" (§4.1.1 do tech spec). O campo nomeado é o que falta, porque é
       * o primeiro problema que o esquema encontra — e é a informação que resolve a situação.
       *
       * A chave desconhecida nomeia `corpo` porque o Zod reporta `unrecognized_keys` com caminho
       * vazio, e é o campo padrão do ponto de chamada que a batiza.
       */
      const recusas: readonly {
        readonly rotulo: string;
        readonly campo: string;
        readonly corpo: Record<string, unknown>;
      }[] = [
        {
          rotulo: 'multa abaixo do piso da faixa',
          campo: 'multaPercentual',
          corpo: { multaPercentual: -1, jurosPercentual: 1 },
        },
        {
          rotulo: 'multa um centésimo acima do teto',
          campo: 'multaPercentual',
          corpo: { multaPercentual: 100.01, jurosPercentual: 1 },
        },
        {
          // O valor está DENTRO da faixa, e é isso que faz deste o caso discriminante da escala: um
          // esquema com piso e teto e sem `multipleOf` aprovaria `0.005`, e a coluna
          // `numeric(5,2)` o gravaria como `0.01` — diferente do que o cliente enviou.
          rotulo: 'juros fora da escala de centésimos',
          campo: 'jurosPercentual',
          corpo: { multaPercentual: 2, jurosPercentual: 0.005 },
        },
        {
          rotulo: 'chave desconhecida no corpo',
          campo: 'corpo',
          corpo: { multaPercentual: 2, jurosPercentual: 1, moraPercentual: 3 },
        },
        { rotulo: 'corpo vazio', campo: 'multaPercentual', corpo: {} },
        {
          rotulo: 'corpo parcial, só com a multa',
          campo: 'jurosPercentual',
          corpo: { multaPercentual: 3 },
        },
      ];

      for (const { rotulo, campo, corpo } of recusas) {
        const resposta = await pedir(POLITICA_DE_MORA, { metodo: 'PUT', cookie, corpo });

        expect(resposta.status, rotulo).toBe(422);
        // O envelope INTEIRO por igualdade de objeto, e não a presença de campos: `detalhes` **não**
        // aparece, e o valor recusado **não** é ecoado — o que sai é o nome do campo culpado.
        expect(resposta.corpo, rotulo).toEqual({
          codigo: CodigoErro.CAMPO_INVALIDO,
          mensagem: MENSAGEM_DE_CAMPO_INVALIDO,
          campo,
        });
      }

      // -------------------------------------------------------------------------------------
      // Passo 6 — nenhuma das SEIS recusas escreveu
      // -------------------------------------------------------------------------------------
      //
      // A releitura é o que separa *recusado* de *aceito com efeito parcial*; a contagem crua é o
      // que separa *"não mudou o valor"* de *"não escreveu linha nenhuma"* — uma escrita parcial que
      // inserisse uma segunda linha poderia deixar a leitura intacta e ainda assim ter gravado.
      expect(await lerPolitica(cookie)).toEqual(PRIMEIRA_POLITICA_DE_A);
      expect(await contarPoliticas(EMPRESA_A.id)).toBe(antes);

      // -------------------------------------------------------------------------------------
      // Passo 7 — CONTROLE POSITIVO: as duas bordas EXATAS da faixa são ACEITAS
      // -------------------------------------------------------------------------------------
      //
      // Sem ele, tudo acima seria satisfeito por uma validação que recusasse todo corpo. As bordas
      // exatas prendem a faixa pelos dois lados: um piso maior que zero recusaria a primeira, e um
      // teto menor que cem recusaria a segunda.
      for (const borda of [BORDA_INFERIOR, BORDA_SUPERIOR]) {
        const aceita = await pedir(POLITICA_DE_MORA, {
          metodo: 'PUT',
          cookie,
          corpo: { ...borda },
        });

        expect(aceita.status).toBe(200);
        expect(aceita.corpo).toEqual(borda);
        expect(await lerPolitica(cookie)).toEqual(borda);
      }

      // E as duas escritas de borda continuaram atualizando a MESMA linha.
      expect(await contarPoliticas(EMPRESA_A.id)).toBe(antes);
    },
    LIMITE_CASO_MS,
  );
});

// ---------------------------------------------------------------------------------------------
// Acessórios — tudo pelas rotas reais, salvo a contagem crua
// ---------------------------------------------------------------------------------------------

/** Lê a política pela rota real e devolve o corpo publicado. A falha levanta. */
async function lerPolitica(credencial: string): Promise<unknown> {
  const resposta = await pedir(POLITICA_DE_MORA, { cookie: credencial });

  if (resposta.status !== 200) {
    throw new Error(
      `a leitura da política respondeu ${String(resposta.status)}: ${resposta.texto}`,
    );
  }

  return resposta.corpo;
}

/**
 * Quantas linhas de `negocio.configuracao_de_mora` o contexto da empresa informada alcança.
 *
 * A contagem é **crua** e sem recorte: o que os casos medem é quantas linhas existem. Nenhum
 * `WHERE empresa_id` é escrito aqui — quem recorta é a política (ADR-0008) —, e a empresa entra pelo
 * **contexto**, que é o mesmo mecanismo que a aplicação usa.
 */
async function contarPoliticas(empresaId: string): Promise<number> {
  return await contextoDeTenant.executarCom(
    { empresaId },
    async () =>
      await acessoAoNegocio.emUnidadeDeTrabalho(async (tx) => {
        const [linha] = await tx<{ total: string }[]>`
          SELECT count(*) AS total FROM negocio.configuracao_de_mora
        `;

        return Number(linha?.total ?? 0);
      }),
  );
}

// ---------------------------------------------------------------------------------------------
// Corpos observados — declarados aqui, e não importados do SUT
// ---------------------------------------------------------------------------------------------

/** O recorte da sessão publicada que este arquivo observa. */
interface SessaoPublicada {
  readonly telas: readonly string[];
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

/** Entra pelo caminho REAL — a rota pública de entrada. Nenhum estado de sessão é forjado. */
async function entrar(email: string, senha: string): Promise<string> {
  const entrada = await pedir(ROTA_DE_ENTRADA, {
    metodo: 'POST',
    corpo: { email, password: senha },
  });

  if (entrada.status !== 200) {
    throw new Error(`a entrada de ${email} respondeu ${String(entrada.status)}: ${entrada.texto}`);
  }

  const credencial = entrada.cookies.find((bruto) =>
    (bruto.split(';')[0] ?? '').split('=')[0]?.trim().endsWith(SUFIXO_DO_COOKIE_DE_SESSAO),
  );

  if (credencial === undefined) {
    throw new Error('a entrada bem-sucedida não devolveu cookie de sessão');
  }

  return credencial.split(';')[0] ?? '';
}

/**
 * Concede as chaves informadas a uma pessoa, pelo caminho real da camada de dados.
 *
 * Sob o contexto de tenant **da empresa dela** e dentro da unidade de trabalho, com a coerência
 * ação→tela validada pela função de domínio (`validarCoerenciaDeAjustes`) e o contador incrementado
 * na mesma transação — é o mesmo caminho que a rota do Admin usa por dentro, e o mesmo padrão de
 * `test/cobrancas.e2e.spec.ts`.
 */
async function conceder(
  usuarioId: string,
  empresaId: string,
  chaves: readonly ChaveDoCatalogo[],
): Promise<void> {
  await contextoDeTenant.executarCom({ empresaId }, async () => {
    await acessoAoNegocio.emUnidadeDeTrabalho(async (tx) => {
      await escreverAjustes(tx, {
        usuarioId,
        ajustes: chaves.map((chave) => ({ chave, efeito: 'CONCEDIDA' as const })),
        validarCoerencia: validarCoerenciaDeAjustes,
      });
    });
  });
}
