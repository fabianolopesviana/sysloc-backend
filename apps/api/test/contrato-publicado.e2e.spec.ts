/**
 * O contrato publicado das 33 rotas do domínio de locação — T11 da fatia
 * `cadastro-de-imoveis-e-pessoas`.
 *
 * ===========================================================================
 * INVARIANTES
 * ===========================================================================
 *
 * | Critério | Caso   | Invariante |
 * |---|---|---|
 * | CA-16 | CT-322 | Em cada uma das **12** rotas de escrita, um corpo válido acrescido de uma chave
 * |       |        | que nenhum esquema declara é recusado com `422 CAMPO_INVALIDO` nomeando o corpo,
 * |       |        | e **nada é gravado** — a contagem da entidade não muda pela tentativa recusada.
 * |       |        | O MESMO corpo sem a chave extra é aceito. (ADR-0017) |
 * | CA-16 | CT-324 | O mesmo recurso é alcançado com o identificador em minúsculas, em MAIÚSCULAS e
 * |       |        | em caixa mista: as três respostas são profundamente iguais, e o `id` do corpo
 * |       |        | vem em minúsculas nas três. Identificador que não é UUID é recusado com
 * |       |        | `422 CAMPO_INVALIDO` nomeando o parâmetro, e a contagem da tabela não muda. |
 * | CA-16 | CT-327 | Para **cada uma** das 33 rotas, o esquema de resposta que o documento publicado
 * |       |        | descreve é **profundamente igual** ao derivado do esquema de `@sysloc/contracts`
 * |       |        | que a rota usa — nenhuma descrição escrita à mão em paralelo. Acrescentar um
 * |       |        | campo obrigatório ao esquema muda a descrição derivada, e a comparação passa a
 * |       |        | reprovar. (ADR-0016) |
 * | CA-16 | CT-328 | Em toda leitura das seis entidades — item, listagem e carteira expandida —,
 * |       |        | metragem, metragem total, posição, total e janela chegam como `number`; tipo de
 * |       |        | imóvel, situação de locação e tipo de pessoa chegam como um dos valores da
 * |       |        | lista fechada; e a marca de retirada é nula ou cadeia ISO-8601. Nenhum campo
 * |       |        | numérico chega como texto. |
 *
 * Rastreabilidade: `CA-16 → CT-322 (RN-13)`, `CA-16 → CT-324 (RN-13)`, `CA-16 → CT-327 (RN-16)`,
 * `CA-16 → CT-328 (RN-16)`.
 *
 * ===========================================================================
 * Por que estes quatro casos moram no MESMO arquivo
 * ===========================================================================
 *
 * Os quatro medem a mesma coisa por quatro ângulos: **o que a borda promete e o que ela entrega**. O
 * `CT-327` compara a promessa publicada com o esquema que confere a entrada; o `CT-328` compara o
 * que chega ao consumidor com o tipo que aquele mesmo esquema declara; o `CT-322` e o `CT-324` medem
 * as duas fronteiras de entrada que o contrato fecha — a chave desconhecida no corpo e a forma do
 * identificador na rota. Separá-los custaria mais três instâncias efêmeras de Postgres e de Redis
 * para observar a mesma superfície.
 *
 * ===========================================================================
 * O CT-327 e a ADR-0016 — o que a comparação prova, e o que o MUTANTE prova
 * ===========================================================================
 *
 * A ADR-0016 é literal: *"o esquema declarado no pacote de contratos é a fonte única… Nenhuma
 * descrição de contrato é escrita à mão em paralelo ao esquema"*. As duas metades da prova:
 *
 *   1. **A comparação** (permanente, neste caso): para as 33 rotas, o esquema que o documento
 *      publica é profundamente igual ao que `esquemaPublicado(<esquema de @sysloc/contracts>)`
 *      produz. Uma descrição escrita à mão precisaria coincidir byte a byte com a saída de
 *      `z.toJSONSchema` — inclusive os padrões de UUID e de data — para passar aqui;
 *   2. **A sensibilidade** (permanente, na segunda metade do caso): o MESMO esquema com **um** campo
 *      obrigatório a mais produz uma descrição diferente, e a comparação do passo 1 reprovaria
 *      contra ela. É o que impede o caso de passar por vacuidade sobre uma comparação frouxa;
 *   3. **Os dois mutantes** (medidos — ver abaixo): um reintroduz a descrição escrita à mão e o
 *      outro mexe no esquema. Eles têm de dar resultados **opostos**, e é o par que prova a
 *      derivação — nenhum dos dois sozinho a prova.
 *
 * ---------------------------------------------------------------------------
 * MUTANTES EXECUTADOS — MT11-2 e MT11-3 (2026-08-06)
 * ---------------------------------------------------------------------------
 *
 * Os dois foram invocados pelo **script do pacote consumidor** (`pnpm --filter @sysloc/api test`),
 * nunca por `vitest run` avulso: `apps/api` alcança `@sysloc/contracts` pela fronteira do pacote e
 * leria o `dist/` da compilação anterior.
 *
 *   * **controle** — árvore íntegra: `129 passed`, os `4` deste arquivo entre eles;
 *   * **MT11-2 · a descrição volta a ser escrita à mão** — em
 *     `apps/api/src/imoveis/conjunto.controller.ts`, o `schema` do `@ApiOkResponse` de `GET :id`
 *     trocado de `esquemaPublicado(esquemaDoConjunto, 'output')` por um objeto literal plausível
 *     (`{ type: 'object', properties: { id, nome, retiradoEm }, required: […] }`): `1 failed | 128
 *     passed`, no `CT-327`, com a mensagem nomeando a rota — *"GET /v1/conjuntos/{id} descreve algo
 *     que o esquema não produz"*. É **o defeito literal que a ADR-0016 existe para impedir**, e o
 *     caso o acusa apontando qual das 33 rotas divergiu;
 *   * **MT11-3 · o esquema ganha um campo** — em `packages/contracts/src/conjunto.ts`,
 *     `esquemaDoConjunto` acrescido de `campoDerivadoDoMutante: z.string().optional()`:
 *     `129 passed`, **verde**. E o verde é a prova, não a ausência dela: o valor esperado do
 *     `CT-327` passou a conter o campo novo, de modo que a igualdade profunda **só** pode ter
 *     passado porque o documento publicado o ganhou também — sem que uma linha de descrição fosse
 *     editada. Um documento escrito à mão teria ficado para trás e reprovado, que é exatamente o
 *     que o `MT11-2` mostra acontecer;
 *   * **por que o campo é opcional, e não obrigatório** — obrigatório muda `z.infer`, e o tipo
 *     `Conjunto` passa a exigir o campo de todo produtor: a compilação cai antes de a suíte rodar, e
 *     o mutante fica **inconclusivo**. Opcional entra em `properties` sem entrar em `required`, que
 *     é mudança suficiente para a igualdade profunda deste caso detectar;
 *   * **reversão** — os dois fontes foram restaurados e conferidos por `git diff` vazio, e o
 *     controle voltou a `129 passed`.
 *
 * As âncoras destes registros são **simbólicas** — `esquemaDoConjunto` em
 * `packages/contracts/src/conjunto.ts`, e o `@ApiOkResponse` do `GET :id` em
 * `apps/api/src/imoveis/conjunto.controller.ts` —, e nunca número de linha.
 *
 * ===========================================================================
 * Precondição privilegiada — tudo pelo caminho REAL
 * ===========================================================================
 *
 * A sessão sai da rota pública de entrada, e a matriz do perfil `ADMIN_EMPRESA` é o catálogo inteiro
 * — nenhum ajuste individual precisa ser escrito, e o efetivo é AFIRMADO por `GET /v1/sessao` antes
 * do primeiro fluxo. Os registros são criados **pelas rotas**, com todos os campos opcionais
 * preenchidos, para que nenhum campo escape da varredura do `CT-328` por estar nulo. O documento é
 * pedido pela rota que a aplicação já publica (`/docs/json`, hoje sem sessão por decisão registrada
 * no débito `D24`); **nenhuma função de produção foi acrescentada para "expor os esquemas ao
 * teste"** — a derivação é observada pelo artefato real (Iron Law #6).
 *
 * ===========================================================================
 * De onde vêm o banco, a fila e a credencial (ADR-0006)
 * ===========================================================================
 *
 * De instâncias efêmeras próprias; nenhuma coordenada de conexão é lida do ambiente. A porta é
 * **reservada** (trava atômica), e não dinâmica, pela razão que a T8 da fatia anterior registrou.
 */

import { randomBytes } from 'node:crypto';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import {
  envelopeDeLista,
  esquemaDaPessoa,
  esquemaDoConjunto,
  esquemaDoConjuntoComImoveis,
  esquemaDoImovel,
  SITUACOES_DE_LOCACAO,
  TIPOS_DE_IMOVEL,
  TIPOS_DE_PESSOA,
} from '@sysloc/contracts';
import { SENHA_DA_CARGA } from '@sysloc/db';
import { CodigoErro } from '@sysloc/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod';
// DÉBITO COM GATILHO — D28 · F0/T5 · gatilho JÁ DISPARADO (F1/T2, 2026-08-02)
// (NÃO é uma `DECISÃO FECHADA`: ele agenda uma mudança, não protege o código abaixo.)
// O QUÊ: os imports a seguir atravessam a fronteira de `@sysloc/shared` e de `@sysloc/auth` por
//        CAMINHO DE ARQUIVO, fora do `exports` e do `files` daqueles manifestos.
// QUANDO FECHA: o gatilho já disparou e o fechamento segue pendente; ele é o mesmo de sempre —
//        declarar o subpath `"./test"` nos manifestos, ou extrair um `@sysloc/test-utils`.
// POR QUE NÃO AGORA: fechar exige editar os manifestos de dois pacotes e todos os consumidores,
//        nenhum deles no escopo desta task.
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
import { CAMINHO_DOS_FIADORES } from '../src/cadastros/fiador.controller.ts';
import { CAMINHO_DOS_LOCADORES } from '../src/cadastros/locador.controller.ts';
import { CAMINHO_DOS_LOCATARIOS } from '../src/cadastros/locatario.controller.ts';
import { esquemaPublicado } from '../src/comum/esquema-publicado.ts';
import { ENDERECO_DE_ESCUTA, PREFIXO_DE_VERSAO } from '../src/configuracao/ambiente.ts';
import { CAMINHO_DOS_CONJUNTOS } from '../src/imoveis/conjunto.controller.ts';
import { CAMINHO_DOS_IMOVEIS } from '../src/imoveis/imovel.controller.ts';
import { CAMINHO_DO_DOCUMENTO, criarAplicacao } from '../src/main.ts';

/** Limite da montagem: banco migrado, semente, fila, aplicação e o arranjo dos registros. */
const LIMITE_DE_MONTAGEM_MS = 240_000;

/** Limite de um caso que atravessa HTTP dezenas de vezes. */
const LIMITE_CASO_MS = 120_000;

/** Sufixo do nome do cookie de sessão do arcabouço — o prefixo vem da configuração. */
const SUFIXO_DO_COOKIE_DE_SESSAO = 'session_token';

/** A rota pública de entrada do arcabouço de identidade. */
const ROTA_DE_ENTRADA = `${PREFIXO_DAS_ROTAS_DE_IDENTIDADE}/sign-in/email`;

/** A rota que publica o efetivo da sessão corrente. */
const CAMINHO_DA_SESSAO_CORRENTE = `/${PREFIXO_DE_VERSAO}/${CAMINHO_DA_SESSAO}`;

/** As mensagens canônicas — literais, e não importadas do SUT. */
const MENSAGEM_DE_CAMPO_INVALIDO = 'requisição inválida';

/** O nome de campo que a borda publica quando a recusa é do corpo e o Zod não tem caminho. */
const CAMPO_DO_CORPO = 'corpo';

/** O nome de campo que a borda publica quando a recusa é do identificador de rota. */
const CAMPO_DO_IDENTIFICADOR = 'id';

/** A chave que nenhum esquema declara — o vetor do `CT-322`. */
const CHAVE_EXTRA = 'campoQueNinguemDeclarou';

/** Quantas rotas a fatia publica — a âncora do `CT-327` contra tabela truncada. */
const ROTAS_DA_FATIA = 33;

/** Quantas rotas de escrita a fatia publica: `POST` e `PUT` das seis entidades. */
const ROTAS_DE_ESCRITA = 12;

/** A pessoa que age: Admin da empresa A, cuja matriz do perfil é o catálogo inteiro. */
const QUEM_AGE = pessoaSemeada('admin.a@exemplo.com.br');

/** As duas áreas de tela que governam a superfície nova, e a ação sensível da circulação. */
const AREA_DOS_IMOVEIS = 'TELA:imoveis';
const AREA_DOS_CADASTROS = 'TELA:cadastros';
const ACAO_SENSIVEL = 'ACAO:excluir_cadastro';

/** O padrão de um UUID já canonizado — minúsculas, e nada mais. */
const UUID_CANONICO = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u;

/** O padrão de uma marca de retirada em ISO-8601 — o formato que a ADR-0017 fixa. */
const MARCA_ISO = /^\d{4}-\d{2}-\d{2}T/u;

let identidade: IdentidadeEfemera;
let fila: FilaEfemera;
let aplicacao: NestFastifyApplication;
let base: string;
let ambienteAnterior: NodeJS.ProcessEnv;
let cookie: string;

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
  process.env.LOG_LEVEL = 'fatal';
  process.env.DATABASE_URL = identidade.banco.cadeiaConexao;
  process.env.REDIS_URL = fila.cadeiaConexao;
  process.env.BETTER_AUTH_SECRET = randomBytes(32).toString('base64url');

  const porta = await reservarPorta();
  base = `http://${ENDERECO_DE_ESCUTA}:${String(porta)}`;
  process.env.PORT = String(porta);

  // A aplicação de PRODUÇÃO, montada por `criarAplicacao()` e não remontada aqui: um documento
  // obtido de uma remontagem descreveria uma aplicação que ninguém sobe.
  aplicacao = await criarAplicacao();
  await aplicacao.listen({ port: porta, host: ENDERECO_DE_ESCUTA });

  cookie = await entrar(QUEM_AGE.email, SENHA_DA_CARGA);

  // Precondição AFIRMADA, e não suposta: a matriz do perfil `ADMIN_EMPRESA` é o catálogo inteiro, e
  // sem esta conferência um `403` em qualquer rota abaixo seria indistinguível de defeito dela.
  const sessao = (await ler(CAMINHO_DA_SESSAO_CORRENTE)) as {
    telas: readonly string[];
    acoes: readonly string[];
  };
  expect(sessao.telas).toContain(AREA_DOS_IMOVEIS);
  expect(sessao.telas).toContain(AREA_DOS_CADASTROS);
  expect(sessao.acoes).toContain(ACAO_SENSIVEL);
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

describe('o contrato publicado das 33 rotas do domínio (T11)', () => {
  it(
    'CT-327 — o documento publicado é DERIVADO dos esquemas que validam a entrada',
    async () => {
      const documento = await documentoPublicado();
      const tabela = ESQUEMAS_POR_ROTA;

      // A tabela cobre a superfície inteira — afirmado antes de percorrê-la.
      expect(tabela.length).toBe(ROTAS_DA_FATIA);

      const conferidas: string[] = [];
      for (const rota of tabela) {
        const publicado = esquemaDaResposta(documento, rota.caminho, rota.metodo);
        const derivado = esquemaPublicado(rota.esquema, 'output');

        // Igualdade PROFUNDA contra o derivado. Uma descrição escrita à mão teria de coincidir byte
        // a byte com a saída de `z.toJSONSchema` — inclusive os padrões de UUID e de data-hora —
        // para chegar aqui, e é isso que torna esta asserção uma prova de derivação.
        expect(
          publicado,
          `${rota.metodo.toUpperCase()} ${rota.caminho} descreve algo que o esquema não produz`,
        ).toEqual(derivado);

        conferidas.push(`${rota.metodo.toUpperCase()} ${rota.caminho}`);
      }
      expect(conferidas.length).toBe(ROTAS_DA_FATIA);

      // --- SENSIBILIDADE: o mesmo esquema com UM campo obrigatório a mais ----------------------
      // Sem esta metade, a comparação acima passaria por vacuidade sobre uma igualdade frouxa. Aqui
      // a MESMA função de derivação recebe o esquema mutado, e o resultado é DIFERENTE do que o
      // documento publica — de modo que, se alguém acrescentasse o campo ao esquema e o documento
      // não acompanhasse, a comparação acima reprovaria. É a perna que o mutante `MT11-2` mediu
      // sobre o fonte, permanente na suíte.
      const CAMPO_DO_MUTANTE = 'campoDerivadoDoMutante';
      const mutado = esquemaPublicado(
        esquemaDoConjunto.extend({ [CAMPO_DO_MUTANTE]: z.string() }),
        'output',
      );
      const doConjunto = esquemaDaResposta(
        documento,
        `/${PREFIXO_DE_VERSAO}/${CAMINHO_DOS_CONJUNTOS}/{id}`,
        'get',
      );

      expect(mutado).not.toEqual(doConjunto);
      expect((mutado as { required: readonly string[] }).required).toContain(CAMPO_DO_MUTANTE);
      // E o campo do mutante NÃO está no documento de hoje: sem esta linha, um documento que já
      // trouxesse o campo tornaria a desigualdade acima verdadeira por outro motivo.
      expect((doConjunto as { required: readonly string[] }).required).not.toContain(
        CAMPO_DO_MUTANTE,
      );
    },
    LIMITE_CASO_MS,
  );

  it(
    'CT-328 — nenhum campo exige conversão de tipo pelo consumidor, em nenhuma das leituras',
    async () => {
      const cenario = await montarCenarioCompleto();

      // As três formas de leitura de cada entidade: item, listagem e carteira expandida.
      const leituras: readonly Leitura[] = [
        { rotulo: 'conjunto (item)', corpo: cenario.conjunto },
        { rotulo: 'imovel (item)', corpo: cenario.imovel },
        { rotulo: 'imovel retirado (item)', corpo: cenario.imovelRetirado },
        { rotulo: 'locador (item)', corpo: cenario.locador },
        { rotulo: 'locatario (item)', corpo: cenario.locatario },
        { rotulo: 'fiador (item)', corpo: cenario.fiador },
        { rotulo: 'conjuntos (lista)', corpo: await ler(colecao(CAMINHO_DOS_CONJUNTOS)) },
        { rotulo: 'imoveis (lista)', corpo: await ler(colecao(CAMINHO_DOS_IMOVEIS)) },
        { rotulo: 'locadores (lista)', corpo: await ler(colecao(CAMINHO_DOS_LOCADORES)) },
        { rotulo: 'locatarios (lista)', corpo: await ler(colecao(CAMINHO_DOS_LOCATARIOS)) },
        { rotulo: 'fiadores (lista)', corpo: await ler(colecao(CAMINHO_DOS_FIADORES)) },
        {
          rotulo: 'carteira (lista expandida)',
          corpo: await ler(`${colecao(CAMINHO_DOS_CONJUNTOS)}?expandir=imoveis`),
        },
      ];

      // A varredura é por CAMINHO, e não campo a campo: é o que impede a asserção de envelhecer
      // quando um campo novo entrar no contrato.
      const violacoes: string[] = [];
      for (const leitura of leituras) {
        percorrer(leitura.corpo, leitura.rotulo, violacoes);
      }
      expect(violacoes, `campos entregues no tipo errado:\n${violacoes.join('\n')}`).toEqual([]);

      // Âncora de NÃO-VACUIDADE: a varredura de fato visitou os campos que ela existe para checar.
      // Sem ela, um caminhamento quebrado — ou um corpo vazio — devolveria `[]` e passaria.
      const visitados = new Set<string>();
      for (const leitura of leituras) {
        colher(leitura.corpo, visitados);
      }
      for (const nome of [...CAMPOS_NUMERICOS, ...Object.keys(LISTAS_FECHADAS), 'retiradoEm']) {
        expect(visitados, `a varredura nunca alcançou o campo \`${nome}\``).toContain(nome);
      }

      // E as asserções LITERAIS sobre os campos que o PRD nomeia — as que dizem o valor exato do
      // `typeof`, e não apenas "a lista de violações está vazia".
      expect(typeof (cenario.imovel as { metragemTotal: unknown }).metragemTotal).toBe('number');
      const comodos = (cenario.imovel as { comodos: readonly Record<string, unknown>[] }).comodos;
      expect(comodos.length).toBeGreaterThan(0);
      for (const comodo of comodos) {
        expect(typeof comodo.metragem).toBe('number');
        expect(typeof comodo.posicao).toBe('number');
      }
      const pagina = (await ler(colecao(CAMINHO_DOS_IMOVEIS))) as Record<string, unknown>;
      expect(typeof pagina.total).toBe('number');
      expect(typeof pagina.limite).toBe('number');
      expect(typeof pagina.deslocamento).toBe('number');

      // A marca de retirada preenchida é cadeia ISO-8601, e a de quem está em circulação é nula.
      expect((cenario.imovelRetirado as { retiradoEm: unknown }).retiradoEm).toMatch(MARCA_ISO);
      expect((cenario.imovel as { retiradoEm: unknown }).retiradoEm).toBeNull();
    },
    LIMITE_CASO_MS,
  );

  it(
    'CT-322 — chave desconhecida no corpo recusa em toda rota de escrita, e nada é gravado',
    async () => {
      const cenario = await montarCenarioCompleto();
      const tabela = rotasDeEscrita(cenario);

      expect(tabela.length).toBe(ROTAS_DE_ESCRITA);

      const exercitadas: string[] = [];
      for (const rota of tabela) {
        const antes = await contar(rota.colecaoDaContagem);

        // Eixo POSITIVO primeiro: sem ele, um esquema quebrado que recusasse TUDO passaria o caso
        // inteiro, e o `422` abaixo não provaria nada sobre a chave extra.
        const aceita = await pedir(rota.alvo, {
          metodo: rota.metodo,
          cookie,
          corpo: rota.corpo(),
        });
        expect(
          aceita.status,
          `${rota.rotulo} recusou o corpo VÁLIDO com ${String(aceita.status)}: ${aceita.texto}`,
        ).toBe(rota.sucesso);

        const depoisDoAceite = await contar(rota.colecaoDaContagem);

        // O MESMO corpo, com a chave a mais.
        const recusada = await pedir(rota.alvo, {
          metodo: rota.metodo,
          cookie,
          corpo: { ...rota.corpo(), [CHAVE_EXTRA]: 'valor qualquer' },
        });

        expect(
          recusada.status,
          `${rota.rotulo} aceitou a chave extra com ${String(recusada.status)}: ${recusada.texto}`,
        ).toBe(422);
        // Corpo INTEIRO por igualdade: um envelope que ganhasse `detalhes` — com o `ZodError`
        // dentro, que é por onde a entrada recusada vazaria — reprova aqui.
        expect(recusada.corpo, `a recusa de ${rota.rotulo} mudou de forma`).toEqual({
          codigo: CodigoErro.CAMPO_INVALIDO,
          mensagem: MENSAGEM_DE_CAMPO_INVALIDO,
          campo: CAMPO_DO_CORPO,
        });

        // A contagem só se moveu na tentativa ACEITA — o `422` não gravou linha nenhuma.
        expect(
          { rotulo: rota.rotulo, contagem: await contar(rota.colecaoDaContagem) },
          `${rota.rotulo} gravou apesar da recusa`,
        ).toEqual({ rotulo: rota.rotulo, contagem: depoisDoAceite });
        expect(depoisDoAceite).toBe(antes + rota.crescimentoEsperado);

        exercitadas.push(rota.rotulo);
      }
      expect(exercitadas.length).toBe(ROTAS_DE_ESCRITA);
    },
    LIMITE_CASO_MS,
  );

  it(
    'CT-324 — o identificador de rota é validado como UUID e canonizado em minúsculas',
    async () => {
      const cenario = await montarCenarioCompleto();
      const id = (cenario.conjunto as { id: string }).id;
      const item = `${colecao(CAMINHO_DOS_CONJUNTOS)}/`;

      expect(id).toMatch(UUID_CANONICO);

      // As TRÊS grafias do mesmo identificador.
      const emMinusculas = await pedir(`${item}${id}`, { cookie });
      const emMaiusculas = await pedir(`${item}${id.toUpperCase()}`, { cookie });
      const emCaixaMista = await pedir(`${item}${caixaMista(id)}`, { cookie });

      for (const resposta of [emMinusculas, emMaiusculas, emCaixaMista]) {
        expect(resposta.status, `a leitura respondeu ${String(resposta.status)}`).toBe(200);
      }

      // Corpos PROFUNDAMENTE iguais — inclusive o campo `id`, que vem em minúsculas nas três. É a
      // canonização: o Postgres renderiza `uuid` em minúsculas e parseia hexadecimal sem distinguir
      // caixa, enquanto `z.uuid()` devolveria o valor verbatim.
      expect(emMaiusculas.corpo).toEqual(emMinusculas.corpo);
      expect(emCaixaMista.corpo).toEqual(emMinusculas.corpo);
      expect((emMaiusculas.corpo as { id: string }).id).toBe(id);
      expect((emCaixaMista.corpo as { id: string }).id).toMatch(UUID_CANONICO);

      // --- Eixo NEGATIVO: o que não é UUID é recusado, nomeando o parâmetro --------------------
      const antes = await contar(CAMINHO_DOS_CONJUNTOS);

      for (const invalido of VALORES_INVALIDOS(id)) {
        const resposta = await pedir(`${item}${encodeURIComponent(invalido)}`, { cookie });

        expect(
          resposta.status,
          `o identificador ${JSON.stringify(invalido)} respondeu ${String(resposta.status)}`,
        ).toBe(422);
        expect(resposta.corpo, `a recusa de ${JSON.stringify(invalido)} mudou de forma`).toEqual({
          codigo: CodigoErro.CAMPO_INVALIDO,
          mensagem: MENSAGEM_DE_CAMPO_INVALIDO,
          campo: CAMPO_DO_IDENTIFICADOR,
        });
      }

      // Nada foi gravado nem apagado pelas tentativas — inclusive a que carrega a instrução de
      // remoção de tabela.
      expect(await contar(CAMINHO_DOS_CONJUNTOS)).toBe(antes);
    },
    LIMITE_CASO_MS,
  );
});

// ---------------------------------------------------------------------------------------------
// CT-327 — a tabela das 33 rotas, com o esquema de `@sysloc/contracts` que cada uma publica
// ---------------------------------------------------------------------------------------------

/** Uma rota do domínio e o esquema de que a resposta dela deve derivar. */
interface EsquemaDeRota {
  /** O caminho **como o documento OpenAPI o escreve** — com `{id}`, e não `:id`. */
  readonly caminho: string;
  readonly metodo: string;
  readonly esquema: z.ZodType;
}

/** O caminho de uma coleção no documento OpenAPI. */
function caminhoDoDocumento(dono: string): string {
  return `/${PREFIXO_DE_VERSAO}/${dono}`;
}

/** As **seis** rotas de uma entidade de cadastro, com o esquema do item e o do envelope. */
function esquemasDeUmCadastro(dono: string, item: z.ZodType, lista: z.ZodType): EsquemaDeRota[] {
  const raiz = caminhoDoDocumento(dono);

  return [
    { caminho: raiz, metodo: 'post', esquema: item },
    { caminho: raiz, metodo: 'get', esquema: lista },
    { caminho: `${raiz}/{id}`, metodo: 'get', esquema: item },
    { caminho: `${raiz}/{id}`, metodo: 'put', esquema: item },
    { caminho: `${raiz}/{id}/retirada`, metodo: 'post', esquema: item },
    { caminho: `${raiz}/{id}/recirculacao`, metodo: 'post', esquema: item },
  ];
}

/**
 * As **33** rotas, com o esquema de `@sysloc/contracts` de que cada resposta deriva.
 *
 * A listagem de conjuntos é a **união** da página simples com a da carteira, porque a rota é uma só
 * e devolve uma das duas formas conforme `expandir` — é o que `conjunto.controller.ts` publica, e a
 * união é composta **aqui a partir dos mesmos esquemas do pacote**, nunca importada dele: importar a
 * composição do controlador faria a asserção concordar consigo mesma.
 *
 * As três rotas de cômodo respondem com o **imóvel inteiro** já recalculado: o cômodo não tem
 * representação própria na API (§4.1), e a ausência de uma quarta rota é contrato.
 */
const ESQUEMAS_POR_ROTA: readonly EsquemaDeRota[] = [
  ...esquemasDeUmCadastro(
    CAMINHO_DOS_CONJUNTOS,
    esquemaDoConjunto,
    z.union([envelopeDeLista(esquemaDoConjunto), envelopeDeLista(esquemaDoConjuntoComImoveis)]),
  ),
  ...esquemasDeUmCadastro(CAMINHO_DOS_IMOVEIS, esquemaDoImovel, envelopeDeLista(esquemaDoImovel)),
  {
    caminho: `${caminhoDoDocumento(CAMINHO_DOS_IMOVEIS)}/{id}/comodos`,
    metodo: 'post',
    esquema: esquemaDoImovel,
  },
  {
    caminho: `${caminhoDoDocumento(CAMINHO_DOS_IMOVEIS)}/{id}/comodos/{comodoId}`,
    metodo: 'put',
    esquema: esquemaDoImovel,
  },
  {
    caminho: `${caminhoDoDocumento(CAMINHO_DOS_IMOVEIS)}/{id}/comodos/{comodoId}`,
    metodo: 'delete',
    esquema: esquemaDoImovel,
  },
  ...esquemasDeUmCadastro(CAMINHO_DOS_LOCADORES, esquemaDaPessoa, envelopeDeLista(esquemaDaPessoa)),
  ...esquemasDeUmCadastro(
    CAMINHO_DOS_LOCATARIOS,
    esquemaDaPessoa,
    envelopeDeLista(esquemaDaPessoa),
  ),
  ...esquemasDeUmCadastro(CAMINHO_DOS_FIADORES, esquemaDaPessoa, envelopeDeLista(esquemaDaPessoa)),
];

/** O documento publicado, pedido pela rota que a aplicação já expõe. */
async function documentoPublicado(): Promise<Record<string, unknown>> {
  const resposta = await pedir(`/${CAMINHO_DO_DOCUMENTO}`);

  if (resposta.status !== 200) {
    throw new Error(`o documento respondeu ${String(resposta.status)}: ${resposta.texto}`);
  }

  return resposta.corpo as Record<string, unknown>;
}

/**
 * O esquema da resposta de sucesso de uma operação do documento.
 *
 * A operação tem **exatamente uma** resposta `2xx` com conteúdo, e a busca por prefixo em vez de por
 * código literal é o que permite a `201` da criação e a `200` das demais conviverem numa tabela só.
 * Ausência levanta: uma rota que sumisse do documento devolveria `undefined`, e `undefined` igual a
 * `undefined` passaria a comparação em silêncio.
 */
function esquemaDaResposta(
  documento: Record<string, unknown>,
  caminho: string,
  metodo: string,
): unknown {
  const paths = documento.paths as Record<string, Record<string, unknown>> | undefined;
  const operacao = paths?.[caminho]?.[metodo] as
    | { responses?: Record<string, { content?: Record<string, { schema?: unknown }> }> }
    | undefined;

  if (operacao === undefined) {
    throw new Error(`o documento não descreve ${metodo.toUpperCase()} ${caminho}`);
  }

  const sucessos = Object.entries(operacao.responses ?? {}).filter(
    ([codigo, corpo]) => codigo.startsWith('2') && corpo.content !== undefined,
  );

  if (sucessos.length !== 1) {
    throw new Error(
      `${metodo.toUpperCase()} ${caminho} declara ${String(sucessos.length)} respostas de sucesso com conteúdo`,
    );
  }

  const esquema = sucessos[0]?.[1].content?.['application/json']?.schema;
  if (esquema === undefined) {
    throw new Error(`${metodo.toUpperCase()} ${caminho} não descreve o corpo da resposta`);
  }

  return esquema;
}

// ---------------------------------------------------------------------------------------------
// CT-328 — a varredura por CAMINHO
// ---------------------------------------------------------------------------------------------

/** Uma leitura observada, com o rótulo que a violação nomeia. */
interface Leitura {
  readonly rotulo: string;
  readonly corpo: unknown;
}

/** Os campos que **têm** de chegar como `number` — a métrica "zero conversão" do PRD §10. */
const CAMPOS_NUMERICOS = [
  'metragem',
  'metragemTotal',
  'posicao',
  'total',
  'limite',
  'deslocamento',
];

/** Os campos de união fechada, e a lista a que cada valor tem de pertencer. */
const LISTAS_FECHADAS: Readonly<Record<string, readonly string[]>> = {
  tipoImovel: TIPOS_DE_IMOVEL,
  statusLocacao: SITUACOES_DE_LOCACAO,
  tipoPessoa: TIPOS_DE_PESSOA,
};

/**
 * Percorre o corpo recursivamente e coleta o caminho exato de cada campo entregue no tipo errado.
 *
 * Por caminho, e não campo a campo: `numeric` e `count(*)` voltam do driver como CADEIA, e o defeito
 * que este caso previne é exatamente esse — um campo novo que nascesse texto ficaria sem prova numa
 * asserção escrita campo a campo.
 */
function percorrer(valor: unknown, caminho: string, violacoes: string[]): void {
  if (Array.isArray(valor)) {
    valor.forEach((item, indice) => {
      percorrer(item, `${caminho}[${String(indice)}]`, violacoes);
    });
    return;
  }

  if (valor === null || typeof valor !== 'object') {
    return;
  }

  for (const [nome, conteudo] of Object.entries(valor)) {
    const aqui = `${caminho}.${nome}`;

    if (CAMPOS_NUMERICOS.includes(nome) && typeof conteudo !== 'number') {
      violacoes.push(`${aqui}: esperado number, veio ${typeof conteudo}`);
    }

    const fechada = LISTAS_FECHADAS[nome];
    if (fechada !== undefined && !fechada.includes(conteudo as string)) {
      violacoes.push(`${aqui}: ${JSON.stringify(conteudo)} fora da lista fechada`);
    }

    if (nome === 'retiradoEm' && conteudo !== null && !MARCA_ISO.test(String(conteudo))) {
      violacoes.push(`${aqui}: ${JSON.stringify(conteudo)} não é nulo nem ISO-8601`);
    }

    percorrer(conteudo, aqui, violacoes);
  }
}

/** Os nomes de campo que a varredura de fato visitou — a âncora de não-vacuidade. */
function colher(valor: unknown, vistos: Set<string>): void {
  if (Array.isArray(valor)) {
    for (const item of valor) {
      colher(item, vistos);
    }
    return;
  }

  if (valor === null || typeof valor !== 'object') {
    return;
  }

  for (const [nome, conteudo] of Object.entries(valor)) {
    vistos.add(nome);
    colher(conteudo, vistos);
  }
}

// ---------------------------------------------------------------------------------------------
// CT-322 — a tabela das 12 rotas de escrita
// ---------------------------------------------------------------------------------------------

/** Uma rota de escrita, com o corpo válido e o efeito esperado sobre a contagem da entidade. */
interface RotaDeEscrita {
  readonly rotulo: string;
  readonly metodo: string;
  readonly alvo: string;
  readonly corpo: () => Record<string, unknown>;
  /** O status que o corpo VÁLIDO recebe: `201` na criação, `200` na reescrita. */
  readonly sucesso: number;
  /** A coleção cuja contagem é observada — o cômodo é contado pelo imóvel que o carrega. */
  readonly colecaoDaContagem: string;
  /** Quanto a contagem cresce com a tentativa aceita. */
  readonly crescimentoEsperado: number;
}

/** As **12** rotas de escrita: `POST` e `PUT` das seis entidades. */
function rotasDeEscrita(cenario: CenarioCompleto): readonly RotaDeEscrita[] {
  const conjuntoId = (cenario.conjunto as { id: string }).id;
  const imovelId = (cenario.imovel as { id: string }).id;
  const comodoId = (cenario.imovel as { comodos: readonly { id: string }[] }).comodos[0]?.id ?? '';
  const comodos = `${colecao(CAMINHO_DOS_IMOVEIS)}/${imovelId}/comodos`;

  const dePapel = (dono: string, id: string): readonly RotaDeEscrita[] => [
    {
      rotulo: `POST ${colecao(dono)}`,
      metodo: 'POST',
      alvo: colecao(dono),
      corpo: corpoDePessoa,
      sucesso: 201,
      colecaoDaContagem: dono,
      crescimentoEsperado: 1,
    },
    {
      rotulo: `PUT ${colecao(dono)}/:id`,
      metodo: 'PUT',
      alvo: `${colecao(dono)}/${id}`,
      corpo: corpoDePessoa,
      sucesso: 200,
      colecaoDaContagem: dono,
      crescimentoEsperado: 0,
    },
  ];

  return [
    {
      rotulo: `POST ${colecao(CAMINHO_DOS_CONJUNTOS)}`,
      metodo: 'POST',
      alvo: colecao(CAMINHO_DOS_CONJUNTOS),
      corpo: () => ({ nome: `Edifício ${String(proximo())}` }),
      sucesso: 201,
      colecaoDaContagem: CAMINHO_DOS_CONJUNTOS,
      crescimentoEsperado: 1,
    },
    {
      rotulo: `PUT ${colecao(CAMINHO_DOS_CONJUNTOS)}/:id`,
      metodo: 'PUT',
      alvo: `${colecao(CAMINHO_DOS_CONJUNTOS)}/${conjuntoId}`,
      corpo: () => ({ nome: `Edifício ${String(proximo())}` }),
      sucesso: 200,
      colecaoDaContagem: CAMINHO_DOS_CONJUNTOS,
      crescimentoEsperado: 0,
    },
    {
      rotulo: `POST ${colecao(CAMINHO_DOS_IMOVEIS)}`,
      metodo: 'POST',
      alvo: colecao(CAMINHO_DOS_IMOVEIS),
      corpo: () => corpoDeImovel(conjuntoId),
      sucesso: 201,
      colecaoDaContagem: CAMINHO_DOS_IMOVEIS,
      crescimentoEsperado: 1,
    },
    {
      rotulo: `PUT ${colecao(CAMINHO_DOS_IMOVEIS)}/:id`,
      metodo: 'PUT',
      alvo: `${colecao(CAMINHO_DOS_IMOVEIS)}/${imovelId}`,
      corpo: () => corpoDeImovel(conjuntoId),
      sucesso: 200,
      colecaoDaContagem: CAMINHO_DOS_IMOVEIS,
      crescimentoEsperado: 0,
    },
    // O cômodo não tem coleção própria, e por isso a contagem observada é a dos IMÓVEIS: o que a
    // recusa não pode fazer é criar um imóvel — e o número de cômodos é conferido pelo `CT-308`.
    {
      rotulo: `POST ${comodos}`,
      metodo: 'POST',
      alvo: comodos,
      corpo: () => ({ nomeComodo: `Sala ${String(proximo())}`, metragem: 12.5, observacoes: null }),
      sucesso: 201,
      colecaoDaContagem: CAMINHO_DOS_IMOVEIS,
      crescimentoEsperado: 0,
    },
    {
      rotulo: `PUT ${comodos}/:comodoId`,
      metodo: 'PUT',
      alvo: `${comodos}/${comodoId}`,
      corpo: () => ({ nomeComodo: `Sala ${String(proximo())}`, metragem: 13.5, observacoes: null }),
      sucesso: 200,
      colecaoDaContagem: CAMINHO_DOS_IMOVEIS,
      crescimentoEsperado: 0,
    },
    ...dePapel(CAMINHO_DOS_LOCADORES, (cenario.locador as { id: string }).id),
    ...dePapel(CAMINHO_DOS_LOCATARIOS, (cenario.locatario as { id: string }).id),
    ...dePapel(CAMINHO_DOS_FIADORES, (cenario.fiador as { id: string }).id),
  ];
}

// ---------------------------------------------------------------------------------------------
// CT-324 — os vetores inválidos
// ---------------------------------------------------------------------------------------------

/**
 * Quatro valores que não são UUID, incluindo a tentativa de injeção — o mesmo padrão do `CT-011`.
 *
 * A cadeia **vazia** fica de fora, e a ausência é medida, não esquecimento: `/v1/conjuntos/` não é
 * uma requisição de `:id` — o roteador nem chega ao manipulador do item —, de modo que ela provaria
 * o roteamento, e não a validação do identificador. O que a substitui é o UUID **truncado em um
 * dígito**, que é a fronteira que de fato exercita o esquema.
 */
function VALORES_INVALIDOS(idValido: string): readonly string[] {
  return [
    'nao-e-uuid',
    '11111111-1111-4111-8111-11111111111',
    `${idValido}'; DROP TABLE negocio.conjunto; --`,
    `${idValido}x`,
  ];
}

/** O mesmo identificador com a caixa alternada — a terceira grafia do `CT-324`. */
function caixaMista(id: string): string {
  return [...id]
    .map((caractere, indice) => (indice % 2 === 0 ? caractere.toUpperCase() : caractere))
    .join('');
}

// ---------------------------------------------------------------------------------------------
// Arranjo — tudo pelo caminho real
// ---------------------------------------------------------------------------------------------

/** Um cenário completo: um exemplar de cada entidade, com todos os campos opcionais preenchidos. */
interface CenarioCompleto {
  readonly conjunto: unknown;
  readonly imovel: unknown;
  readonly imovelRetirado: unknown;
  readonly locador: unknown;
  readonly locatario: unknown;
  readonly fiador: unknown;
}

/**
 * Monta um cenário completo **pelas rotas reais**.
 *
 * Todos os campos opcionais são preenchidos — `complemento`, `observacoes`, `rg` — para que nenhum
 * campo escape da varredura do `CT-328` por estar nulo, e o imóvel nasce com **dois cômodos** para
 * que a metragem total seja soma de mais de uma parcela.
 */
async function montarCenarioCompleto(): Promise<CenarioCompleto> {
  const conjunto = await criar(colecao(CAMINHO_DOS_CONJUNTOS), {
    nome: `Edifício ${String(proximo())}`,
  });
  const conjuntoId = (conjunto as { id: string }).id;

  const semComodos = await criar(colecao(CAMINHO_DOS_IMOVEIS), corpoDeImovel(conjuntoId));
  const imovelId = (semComodos as { id: string }).id;
  const comodos = `${colecao(CAMINHO_DOS_IMOVEIS)}/${imovelId}/comodos`;

  await criar(comodos, { nomeComodo: 'Sala', metragem: 21.5, observacoes: 'de frente' });
  const imovel = await criar(comodos, {
    nomeComodo: 'Quarto',
    metragem: 13.25,
    observacoes: 'suíte',
  });

  // Um imóvel RETIRADO, para que a marca preenchida seja exercitada — sem ele o eixo de
  // `retiradoEm` só veria nulos, e uma marca entregue como número passaria despercebida.
  const outro = await criar(colecao(CAMINHO_DOS_IMOVEIS), corpoDeImovel(conjuntoId));
  const retirada = await pedir(
    `${colecao(CAMINHO_DOS_IMOVEIS)}/${(outro as { id: string }).id}/retirada`,
    {
      metodo: 'POST',
      cookie,
      corpo: {},
    },
  );
  if (retirada.status !== 200) {
    throw new Error(`a retirada respondeu ${String(retirada.status)}: ${retirada.texto}`);
  }

  return {
    conjunto,
    imovel,
    imovelRetirado: retirada.corpo,
    locador: await criar(colecao(CAMINHO_DOS_LOCADORES), corpoDePessoa()),
    locatario: await criar(colecao(CAMINHO_DOS_LOCATARIOS), corpoDePessoa()),
    fiador: await criar(colecao(CAMINHO_DOS_FIADORES), corpoDePessoa()),
  };
}

/** A coleção de uma entidade, sob o prefixo de versão. */
function colecao(dono: string): string {
  return `/${PREFIXO_DE_VERSAO}/${dono}`;
}

/**
 * O sequencial que dá unicidade aos três campos únicos desta superfície.
 *
 * Monotônico e de processo, e não sorteado: identificador municipal, documento e endereço de e-mail
 * vivem sob restrições que **alcançam os cadastros retirados** (ADR-0014), de modo que um valor
 * repetido produziria `422` de unicidade onde o caso mede outra coisa.
 */
let sequencial = 0;

function proximo(): number {
  sequencial += 1;
  return sequencial;
}

/** O corpo completo de um imóvel, com **todos** os campos opcionais preenchidos. */
function corpoDeImovel(conjuntoId: string): Record<string, unknown> {
  return {
    conjuntoId,
    nomeImovel: `Ap ${String(proximo())}`,
    identificadorMunicipal: `IM-${String(proximo()).padStart(6, '0')}`,
    tipoImovel: 'RESIDENCIAL',
    logradouro: 'Rua das Acácias',
    numero: '100',
    complemento: 'bloco B',
    bairro: 'Centro',
    cidade: 'São Paulo',
    estado: 'SP',
    cep: '01000000',
    statusLocacao: 'DISPONIVEL',
    observacoes: 'imóvel do cenário completo',
  };
}

/** O corpo completo de um cadastro de pessoa, com **todos** os campos opcionais preenchidos. */
function corpoDePessoa(): Record<string, unknown> {
  const marca = String(proximo()).padStart(6, '0');

  return {
    nome: `Pessoa ${marca}`,
    tipoPessoa: 'PESSOA_FISICA',
    documentoPrincipal: cpfValido(),
    rg: `MG-${marca}`,
    email: `pessoa.${marca}@exemplo.com.br`,
    telefone: '11999990000',
    logradouro: 'Rua das Acácias',
    numero: '100',
    complemento: 'apto 12',
    bairro: 'Centro',
    cidade: 'São Paulo',
    estado: 'SP',
    cep: '01000000',
  };
}

/**
 * Um CPF **válido**, derivado do sequencial.
 *
 * A RN-04 exige que o documento seja conferido, e `cadastro-de-pessoa.service.ts` o confere com
 * `conferirDocumento` — de modo que um número qualquer de onze dígitos é recusado com `422`. Isto é
 * **arranjo**, e não asserção: nada aqui é comparado contra o SUT, e quem prova que a conferência
 * recusa documento inválido é o `CT-312`, com vetores próprios.
 */
function cpfValido(): string {
  const base = String(100_000_000 + ((proximo() * 7_919) % 800_000_000));
  const digitos = [...base].map((caractere) => Number(caractere));
  const primeiro = digitoDeControle(digitos, 10);
  const segundo = digitoDeControle([...digitos, primeiro], 11);

  return `${base}${String(primeiro)}${String(segundo)}`;
}

/** Um dígito de controle de CPF: soma ponderada decrescente, resto da multiplicação por dez. */
function digitoDeControle(digitos: readonly number[], pesoInicial: number): number {
  const soma = digitos.reduce((acumulado, digito, indice) => {
    return acumulado + digito * (pesoInicial - indice);
  }, 0);
  const resto = (soma * 10) % 11;

  return resto >= 10 ? 0 : resto;
}

/** Cria um registro pela rota real e devolve o corpo publicado. A falha levanta. */
async function criar(alvo: string, corpo: Record<string, unknown>): Promise<unknown> {
  const resposta = await pedir(alvo, { metodo: 'POST', cookie, corpo });

  if (resposta.status !== 201) {
    throw new Error(`a criação em ${alvo} respondeu ${String(resposta.status)}: ${resposta.texto}`);
  }

  return resposta.corpo;
}

/** Lê pela rota real e devolve o corpo publicado. A falha levanta. */
async function ler(alvo: string): Promise<unknown> {
  const resposta = await pedir(alvo, { cookie });

  if (resposta.status !== 200) {
    throw new Error(`a leitura de ${alvo} respondeu ${String(resposta.status)}: ${resposta.texto}`);
  }

  return resposta.corpo;
}

/**
 * Quantos registros a coleção publica — lida **pela rota**, e não por consulta ao banco.
 *
 * O `total` do envelope é o que o consumidor enxerga, e é sobre ele que "nada foi gravado" tem de
 * valer. Uma contagem por conexão privilegiada mediria a tabela, e não o contrato.
 */
async function contar(dono: string): Promise<number> {
  const pagina = (await ler(`${colecao(dono)}?limite=1&incluirRetirados=true`)) as {
    total: number;
  };

  return pagina.total;
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
