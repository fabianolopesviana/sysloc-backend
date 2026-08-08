/**
 * Serviço de aplicação — saúde, contrato publicado e envelope de erro. T5 da fatia
 * `fundacao-stack-nativa`.
 *
 * ---------------------------------------------------------------------------
 * INVARIANTES
 * ---------------------------------------------------------------------------
 *
 * | Critério | Caso | Invariante |
 * |---|---|---|
 * | CA-2  | CT-001 | `GET /saude` responde `200` com banco e fila COMPROVADAMENTE derrubados, e
 * |       |        | o corpo não menciona dependência alguma — a rasa não consulta nada. |
 * | CA-2  | CT-001 | Companheiro estrutural: a rota rasa não atravessa a porta única por onde
 * |       | (b)    | as duas dependências são consultadas; a profunda atravessa uma vez. |
 * | CA-3  | CT-002 | Com ao menos uma dependência inalcançável, `GET /saude/pronto` responde
 * |       |        | `503` marcando indisponível exatamente a que caiu e disponível a que ficou. |
 * | CA-3  | CT-003 | Com as duas de pé, `GET /saude/pronto` responde `200` enumerando as duas
 * | CA-6  |        | dependências, em camelCase, sem expor coordenada nem credencial. |
 * | CA-13 |        | As efêmeras usadas não são as provisionadas (porta distinta). |
 * | CA-4  | CT-004 | `GET /docs` publica a página navegável, e o documento que ela descreve
 * |       |        | declara as rotas que a aplicação de fato expõe. |
 * | CA-13 | CT-005 | Exceção do próprio arcabouço (rota inexistente) sai no envelope da ADR-0007,
 * |       |        | e não no formato padrão (`statusCode`/`error` AUSENTES). |
 * | CA-13 | CT-006 | Exceção não prevista vira `500` com `ERRO_INTERNO`, sem vazar mensagem
 * |       |        | interna nem rastreamento de pilha. |
 * | CA-13 | CT-006 | Rede da guarda de redação: o `caminho` que o filtro grava no journal é o
 * |       | (b)    | padrão da rota casada ou o alvo truncado antes do `?` — nunca a cadeia de
 * |       |        | consulta, nos dois ramos. |
 *
 * ---------------------------------------------------------------------------
 * ADR-0006 — de onde vêm o banco e a fila desta verificação
 * ---------------------------------------------------------------------------
 *
 * De instâncias efêmeras próprias (T4), nunca das provisionadas que atendem (ou virão a atender) a
 * operação. O ambiente do processo é MONTADO a partir do que os helpers devolvem — nenhuma
 * coordenada é lida do repositório nem assumida por porta padrão. O CT-003 assere a distinção
 * comparando a porta em uso com a provisionada, no mesmo molde de
 * `packages/shared/test/ambiente-efemero.spec.ts`.
 *
 * A queda de dependência dos CT-001 e CT-002 é REAL, feita pelo `parar()` dos helpers: nenhuma
 * bandeira, nenhum ponto de injeção e nenhum dublê foi acrescentado ao serviço para simulá-la.
 *
 * ---------------------------------------------------------------------------
 * Como cada eixo do CT-001 é discriminado — e por que o banco e a fila pedem instrumentos
 * diferentes
 * ---------------------------------------------------------------------------
 *
 * O CT-001 precisa reprovar duas mutações independentes: a rasa consultar o BANCO e a rasa
 * consultar a FILA. Os dois clientes têm semânticas de conexão opostas, e por isso o mesmo
 * instrumento não serve para os dois:
 *
 *   - **Banco** — o cliente conecta SOB DEMANDA, uma conexão por consulta. Um sentinela na porta
 *     conta, portanto, exatamente as consultas: `conexoes() === 0` reprova a mutação, e a rota
 *     profunda no mesmo processo serve de controle (faz a contagem subir). É o que está no caso.
 *
 *   - **Fila** — o cliente mantém UMA conexão persistente e a restabelece sozinho, em laço, quando
 *     o servidor cai. Medido nesta máquina, com a fila derrubada e nenhuma requisição feita, um
 *     sentinela na porta dela contou 1 conexão em 250 ms e 4 em 2 s; e dez consultas seguidas ao
 *     cliente não produziram conexão alguma além das que o laço de reconexão já produziria. Um
 *     sentinela na porta da fila é, portanto, **não discriminante** para a mutação (a consulta não
 *     abre conexão) **e** instável (o laço a faz contar sozinha) — as duas razões pelas quais ele
 *     não está aqui.
 *
 *     O que discrimina a fila é o CT-001 (b): o serviço que consulta as duas dependências é a
 *     porta única por onde a rota teria de passar, e ele é substituído por um espião que conta
 *     chamadas — sem que nada em `apps/api/src` ganhe ponto de injeção para isso (o mecanismo é o
 *     do próprio arcabouço de teste). Zero chamadas na rasa, exatamente uma na profunda.
 *
 *     **O CT-001 tinha um teto de tempo, e ele SAIU** — débito D9 da fatia
 *     `cadastro-de-imoveis-e-pessoas`, fechado em 2026-08-06. A redação original o declarava
 *     "segundo discriminador comportamental da fila", apoiada na medição de que dez consultas à
 *     fila derrubada levavam ~1 s. A própria medição desmente a conclusão: ~1 s para DEZ consultas
 *     é ~100 ms para UMA, folgadamente abaixo dos 500 ms declarados — de modo que o mutante
 *     realista (a rasa consultando a fila **uma** vez) já passava por baixo do teto. O que sobrava
 *     era relógio de parede asserido como correção, e foi ele que reprovou a suíte por contenção
 *     de máquina, sem defeito no produto. Quem discrimina a fila é o CT-001 (b), que conta
 *     chamadas e não milissegundos — e a seção seguinte mede que a remoção não custou detecção.
 *
 * ===========================================================================
 * MUTANTES EXECUTADOS — o eixo de cada rota sobrevive sem o teto de tempo
 * ===========================================================================
 *
 * A `.claude/rules/testing-stack.md` e o P4 de `.claude/rules/nao-regressao.md` exigem demonstrar
 * que a prova **reprova** com o defeito reintroduzido. O mutante abaixo foi aplicado ao fonte de
 * produção e a suíte foi invocada pelo **script do pacote** (`pnpm --filter @sysloc/api test`),
 * nunca por `vitest run` avulso — a regra é "sempre pelo script" e não se negocia caso a caso.
 *
 *   * **controle** — árvore íntegra, com o teto de tempo já removido: `16 arquivos, 110 casos,
 *     0 falhas`. A contagem é a mesma de antes da remoção, porque o que saiu foi uma **asserção**,
 *     não um caso;
 *   * **MT-D9 · a rota rasa passa a consultar as dependências** — `verificacaoRasa`, em
 *     `apps/api/src/saude/saude.controller.ts`, vira `async` e chama
 *     `this.saude.verificarDependencias()` antes de devolver o corpo (a forma que uma fusão das
 *     duas rotas produziria): `2 failed | 108 passed`, nos **dois** casos que existem para isto e
 *     em nenhum outro. O CT-001 reprova em `expect(sentinela.conexoes()).toBe(0)` —
 *     *expected 498 to be +0* —, e o CT-001 (b) em `expect(espiao.chamadas).toBe(0)` —
 *     *expected 1 to be +0*. É a prova de que a remoção do teto **não** custou poder de detecção:
 *     os dois eixos, o do banco e o da fila, seguem sendo apanhados por asserção de contagem, que
 *     é determinística e não depende de quanto a máquina está carregada;
 *   * **reversão** — `saude.controller.ts` foi restaurado e conferido idêntico ao original por
 *     `diff`, e o controle voltou ao verde.
 */

import { readFileSync } from 'node:fs';
import { createConnection, createServer } from 'node:net';
import { fileURLToPath } from 'node:url';
import { Controller, Get } from '@nestjs/common';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import { CodigoErro, criarLogger } from '@sysloc/shared';
import { afterAll, beforeAll, describe, expect, it, onTestFinished } from 'vitest';
// DÉBITO COM GATILHO — D28 · F0/T5 · registrado 2026-08-01
// (NÃO é uma `DECISÃO FECHADA`: as duas deste arquivo, mais abaixo, protegem código; esta agenda.)
// O QUÊ: os três imports a seguir atravessam a fronteira de `@sysloc/shared` por CAMINHO DE ARQUIVO
//        (`../../../packages/shared/test/*.ts`), fora do `exports` e do `files` do pacote — é o que
//        obriga o `rootDir` de `apps/api/tsconfig.test.json` a subir até a raiz do repositório. A
//        dependência de workspace está declarada, então não há dependência oculta; o que não existe
//        é FRONTEIRA: `packages/shared/test/` virou superfície pública de fato, sem ser declarada.
//        Mover ou renomear qualquer arquivo de lá quebra `apps/api` sem que ferramenta alguma do
//        workspace enxergue o vínculo.
// QUANDO FECHA: quando um QUARTO consumidor importar `packages/shared/test/` por caminho relativo
//        profundo. (T6 foi o terceiro e repetiu o padrão; a decisão de promover ficou para o
//        próximo.) Fechar declarando o subpath `"./test"` no `package.json` de `@sysloc/shared` e
//        importando por `@sysloc/shared/test` — o que também dispensa o `rootDir` alargado —, ou
//        extraindo um pacote `@sysloc/test-utils`.
// POR QUE NÃO AGORA: impacto baixo enquanto o número de consumidores é pequeno, e declarar o
//        subpath sem saber que forma os helpers terão nas fatias seguintes congelaria uma superfície
//        pública cedo demais.
// ÍNDICE: docs/specs/features/fundacao-stack-nativa/v1/_run/run-report.md §2, D28
import { FAIXA_PORTAS_EFEMERAS } from '../../../packages/shared/test/efemero-comum.ts';
import {
  type BancoEfemero,
  postgresEfemero,
} from '../../../packages/shared/test/postgres-efemero.ts';
import { type FilaEfemera, redisEfemero } from '../../../packages/shared/test/redis-efemero.ts';
import { AppModule } from '../src/app.module.ts';
import { RotaPublica } from '../src/autenticacao/rota-publica.decorator.ts';
import { TOKEN_LOGGER } from '../src/configuracao/ambiente.ts';
import { CAMINHO_DO_CONTRATO, CAMINHO_DO_DOCUMENTO, criarAplicacao } from '../src/main.ts';
import { type EstadoDasDependencias, SaudeService } from '../src/saude/saude.service.ts';

/** Limite de um caso que sobe instância própria de banco e de fila. */
const LIMITE_CASO_MS = 120_000;

/** Limite para observar a porta de uma instância já derrubada. */
const LIMITE_DE_CONEXAO_MS = 10_000;

/** Portas padrão dos serviços, usadas pelo ambiente legado desta máquina. */
const PORTA_PADRAO_DO_BANCO = 5432;
const PORTA_PADRAO_DA_FILA = 6379;

/** Caminho da rota que o controlador-fixture de CT-006 expõe. */
const CAMINHO_DO_GATILHO = 'gatilho-de-falha-ct006';

/** Texto sensível plantado na exceção do fixture — nada dele pode sair na resposta. */
const CADEIA_SENSIVEL = 'postgres://usuario:senha@127.0.0.1:5432/operacao';

/**
 * Segredo plantado na CADEIA DE CONSULTA da requisição (CT-006 (b)).
 *
 * Viaja sob o nome `token` de propósito: é o parâmetro que o arcabouço de autenticação da fatia
 * seguinte carrega em consulta. O eixo por nome de chave da redação de T3 não o alcança aqui — ele
 * casa CHAVES do evento, e este valor chega dentro de uma cadeia de caracteres —, de modo que quem
 * o mantém fora do journal é a guarda do filtro, e mais nada.
 */
const SEGREDO_EM_CONSULTA = 'SEGREDO-PLANTADO';

/** Chaves de primeiro nível que a ADR-0007 admite num corpo de erro. */
const CHAVES_DO_ERRO = ['codigo', 'mensagem', 'campo', 'detalhes'];

const RAIZ_DO_REPOSITORIO = fileURLToPath(new URL('../../..', import.meta.url));
const SCRIPT_DE_PROVISIONAMENTO = `${RAIZ_DO_REPOSITORIO}deploy/scripts/instalacao/provisionar-base.sh`;

interface Resposta {
  readonly status: number;
  readonly tipoDeConteudo: string;
  readonly texto: string;
}

/**
 * Lê uma constante declarada no script de provisionamento — o caminho legítimo para conhecer as
 * coordenadas da instância provisionada sem abrir conexão contra ela, que a ADR-0006 proíbe.
 * Mesmo padrão de `packages/shared/test/ambiente-efemero.spec.ts`.
 */
function constanteDoProvisionamento(nome: string): string | undefined {
  const texto = readFileSync(SCRIPT_DE_PROVISIONAMENTO, 'utf8');
  return new RegExp(`^readonly ${nome}="?([^"\\n]+)"?$`, 'm').exec(texto)?.[1];
}

interface CoordenadaProvisionada {
  readonly porta: number;
  readonly origem: string;
}

/**
 * Porta da fila provisionada, com a ORIGEM declarada.
 *
 * A origem existe para que a degradação apareça: quando a constante deixa de ser encontrada no
 * script, o valor comparável passa a ser o padrão do serviço — e sem dizê-lo a asserção seguiria
 * verde por um motivo diferente do que ela afirma provar. Mesmo padrão de `coordenadasProvisionadas`
 * em `packages/shared/test/ambiente-efemero.spec.ts`, e a política da `.claude/rules/testing-stack.md`
 * é literal: ausência nunca faz o caso passar em silêncio.
 */
function portaProvisionadaDaFila(): CoordenadaProvisionada {
  const declarada = constanteDoProvisionamento('PORTA_FILA');
  if (declarada !== undefined) {
    return {
      porta: Number.parseInt(declarada, 10),
      origem: 'PORTA_FILA declarada em provisionar-base.sh',
    };
  }
  return {
    porta: PORTA_PADRAO_DA_FILA,
    origem: 'padrão do serviço (degradação: provisionar-base.sh não declarou PORTA_FILA)',
  };
}

/** Código do erro de conexão — `ECONNREFUSED` quando ninguém escuta a porta. */
function codigoAoConectar(porta: number): Promise<string> {
  return new Promise((resolver) => {
    const soquete = createConnection({ host: '127.0.0.1', port: porta });
    soquete.setTimeout(LIMITE_DE_CONEXAO_MS, () => {
      soquete.destroy();
      resolver('TEMPO-ESGOTADO');
    });
    soquete.on('error', (erro: NodeJS.ErrnoException) => {
      soquete.destroy();
      resolver(erro.code ?? 'SEM-CODIGO');
    });
    soquete.on('connect', () => {
      soquete.destroy();
      resolver('CONECTOU');
    });
  });
}

/**
 * Ocupa uma porta já liberada com um servidor que apenas CONTA conexões e as descarta.
 *
 * É o instrumento que torna observável "ninguém tentou falar com esta dependência" — a mesma
 * ideia do sentinela do CT-003 de T4. Nada foi acrescentado ao serviço para permitir a contagem:
 * ela acontece do lado de fora, no endereço que ele já conhece.
 */
async function sentinelaNaPorta(porta: number): Promise<{ conexoes: () => number }> {
  let conexoes = 0;
  const servidor = createServer((soquete) => {
    conexoes += 1;
    soquete.destroy();
  });
  await new Promise<void>((resolver, rejeitar) => {
    servidor.once('error', rejeitar);
    servidor.listen(porta, '127.0.0.1', resolver);
  });
  onTestFinished(
    () =>
      new Promise<void>((resolver) => {
        servidor.close(() => resolver());
      }),
  );
  return { conexoes: () => conexoes };
}

/** Sobe as duas instâncias efêmeras e as descarta ao fim do caso. */
async function subirEfemeras(): Promise<{
  banco: BancoEfemero;
  fila: FilaEfemera;
}> {
  const banco = await postgresEfemero();
  onTestFinished(() => banco.parar());
  const fila = await redisEfemero();
  onTestFinished(() => fila.parar());
  return { banco, fila };
}

/**
 * Monta o ambiente do processo a partir das coordenadas que os helpers devolveram, e o restaura
 * ao fim do caso.
 *
 * As duas cadeias de conexão são SOBRESCRITAS, nunca completadas: a tarefa `test` do `turbo.json`
 * declara `DATABASE_URL` e `REDIS_URL`, então elas chegam até aqui — e um valor herdado apontaria
 * a verificação para o banco que atende a operação, em silêncio (ADR-0006).
 *
 * Nenhum caso a chama: ela é alcançada **apenas** de dentro das funções que sobem aplicação, todas
 * elas exigindo o par de instâncias efêmeras na assinatura. É a diferença entre a garantia vir da
 * assinatura e vir da lembrança de quem escreve o caso seguinte — e é a primeira alternativa que a
 * própria ADR-0006 rejeita ("depende de cada teste respeitar o mecanismo").
 */
function apontarAmbienteParaEfemeras(banco: BancoEfemero, fila: FilaEfemera): void {
  const anterior = { ...process.env };
  onTestFinished(() => {
    for (const nome of ['NODE_ENV', 'PORT', 'LOG_LEVEL', 'DATABASE_URL', 'REDIS_URL']) {
      const valor = anterior[nome];
      if (valor === undefined) {
        delete process.env[nome];
      } else {
        process.env[nome] = valor;
      }
    }
  });

  process.env.NODE_ENV = 'test';
  // A porta declarada nunca é usada: cada caso escuta em porta dinâmica. Ela existe porque a
  // validação de partida a exige, e é a validação real que está sob teste.
  process.env.PORT = '3000';
  // O registro estruturado da aplicação sai pela saída padrão do processo de verificação; nenhum
  // caso assere sobre ele, e as linhas se misturariam ao relatório do arcabouço.
  process.env.LOG_LEVEL = 'fatal';
  process.env.DATABASE_URL = banco.cadeiaConexao;
  process.env.REDIS_URL = fila.cadeiaConexao;
}

/**
 * Sobe a aplicação REAL — a mesma montagem de `main.ts` — em porta dinâmica, apontada para as
 * instâncias efêmeras recebidas.
 *
 * O par de instâncias é PARÂMETRO porque a aplicação não pode subir sem que se diga de quais
 * instâncias ela fala: a montagem do ambiente acontece aqui dentro, e não numa chamada separada
 * que cada caso precise lembrar de fazer (ADR-0006).
 */
async function subirAplicacao(banco: BancoEfemero, fila: FilaEfemera): Promise<string> {
  apontarAmbienteParaEfemeras(banco, fila);

  const app = await criarAplicacao();
  onTestFinished(() => app.close());
  await app.listen({ port: 0, host: '127.0.0.1' });
  return app.getUrl();
}

/**
 * Sobe a aplicação acrescentando o controlador-fixture que provoca a exceção não prevista (CT-006).
 *
 * O fixture vive neste arquivo, e nada em `apps/api/src` ganhou rota, bandeira ou ramo para
 * permitir o cenário. O filtro global continua sendo o de produção, que a composição raiz registra.
 * O ambiente é montado aqui pelo mesmo motivo da função acima.
 */
async function subirAplicacaoComFixtureDeFalha(
  banco: BancoEfemero,
  fila: FilaEfemera,
): Promise<string> {
  apontarAmbienteParaEfemeras(banco, fila);

  const modulo = await Test.createTestingModule({
    imports: [AppModule],
    controllers: [ControladorQueFalha],
  }).compile();
  const app = modulo.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
  onTestFinished(() => app.close());
  await app.listen({ port: 0, host: '127.0.0.1' });
  return app.getUrl();
}

/** O journal desta aplicação: as linhas cruas e os eventos já desserializados, em ordem. */
interface JournalObservavel {
  /** As linhas exatamente como o registrador as escreve — é o que o operador lê. */
  linhas: () => readonly string[];
  /** As mesmas linhas desserializadas, para asserção de campo. */
  eventos: () => readonly Record<string, unknown>[];
}

/**
 * Sobe a aplicação com o fixture de falha e com o journal OBSERVÁVEL (CT-006 (b)).
 *
 * O registrador é o de PRODUÇÃO — `criarLogger` de `@sysloc/shared`, com o mesmo parâmetro
 * `destino` que a unidade systemd usa para apontar o journal. Nenhum dublê de registrador: a
 * serialização, a promoção de mensagem e a redação de segredo observadas aqui são as reais, e é o
 * que torna a asserção sobre a linha inteira significativa.
 *
 * Duas coisas justificam o helper próprio em vez de reaproveitar {@link subirAplicacaoComFixtureDeFalha}:
 *
 *   1. **O nível.** O ambiente montado para a verificação fixa `LOG_LEVEL=fatal` de propósito (as
 *      linhas se misturariam ao relatório do arcabouço), e o filtro emite em `warn` e `error` — as
 *      duas abaixo de `fatal`, portanto suprimidas. Baixar o nível no ambiente global calaria essa
 *      escolha para todos os casos; aqui ele é baixado só para esta aplicação.
 *   2. **O ponto de substituição** é o do próprio arcabouço de teste (`overrideProvider`): nada em
 *      `apps/api/src` ganhou símbolo, ramo ou export para o journal ser observável — o token já é
 *      publicado pela composição raiz, que é como o filtro o recebe em operação.
 */
async function subirAplicacaoComJournalObservavel(
  banco: BancoEfemero,
  fila: FilaEfemera,
): Promise<{ base: string; journal: JournalObservavel }> {
  apontarAmbienteParaEfemeras(banco, fila);

  const linhas: string[] = [];
  const logger = criarLogger({
    nivel: 'warn',
    destino: {
      write(linha: string): void {
        linhas.push(linha);
      },
    },
  });

  const modulo = await Test.createTestingModule({
    imports: [AppModule],
    controllers: [ControladorQueFalha],
  })
    .overrideProvider(TOKEN_LOGGER)
    .useValue(logger)
    .compile();
  const app = modulo.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
  onTestFinished(() => app.close());
  await app.listen({ port: 0, host: '127.0.0.1' });

  return {
    base: await app.getUrl(),
    journal: {
      linhas: () => linhas,
      eventos: () => linhas.map((linha) => JSON.parse(linha) as Record<string, unknown>),
    },
  };
}

/** Espião do serviço que consulta as dependências — conta as travessias da porta única. */
interface EspiaoDeDependencias {
  chamadas: number;
  verificarDependencias(): Promise<EstadoDasDependencias>;
}

/**
 * Sobe a aplicação com o serviço de dependências SUBSTITUÍDO por um espião que conta chamadas.
 *
 * O ponto de substituição é o do próprio arcabouço de teste (`overrideProvider`): nenhum símbolo
 * foi criado, exportado ou alargado em `apps/api/src` para o espião existir. É o instrumento do
 * CT-001 (b) — ver o cabeçalho deste arquivo para por que a fila exige este eixo e não um sentinela
 * de porta.
 */
async function subirAplicacaoComEspiaoDeDependencias(
  banco: BancoEfemero,
  fila: FilaEfemera,
): Promise<{ base: string; espiao: EspiaoDeDependencias }> {
  apontarAmbienteParaEfemeras(banco, fila);

  const espiao: EspiaoDeDependencias = {
    chamadas: 0,
    verificarDependencias(): Promise<EstadoDasDependencias> {
      espiao.chamadas += 1;
      return Promise.resolve({ banco: 'disponivel', fila: 'disponivel' });
    },
  };

  const modulo = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(SaudeService)
    .useValue(espiao)
    .compile();
  const app = modulo.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
  onTestFinished(() => app.close());
  await app.listen({ port: 0, host: '127.0.0.1' });
  return { base: await app.getUrl(), espiao };
}

async function pedir(base: string, caminho: string): Promise<Resposta> {
  const resposta = await fetch(new URL(caminho, base), {
    headers: { connection: 'close' },
  });
  return {
    status: resposta.status,
    tipoDeConteudo: resposta.headers.get('content-type') ?? '',
    texto: await resposta.text(),
  };
}

function comoObjeto(resposta: Resposta): Record<string, unknown> {
  return JSON.parse(resposta.texto) as Record<string, unknown>;
}

/** Todas as chaves do corpo, em qualquer profundidade — para a asserção de camelCase. */
function chavesEmProfundidade(valor: unknown): string[] {
  if (Array.isArray(valor)) {
    return valor.flatMap(chavesEmProfundidade);
  }
  if (typeof valor !== 'object' || valor === null) {
    return [];
  }
  return Object.entries(valor).flatMap(([chave, aninhado]) => [
    chave,
    ...chavesEmProfundidade(aninhado),
  ]);
}

describe('serviço de aplicação (T5)', () => {
  describe('com dependência derrubada de verdade', () => {
    it(
      'CT-001 — GET /saude responde 200 com banco e fila comprovadamente derrubados',
      async () => {
        const { banco, fila } = await subirEfemeras();
        const base = await subirAplicacao(banco, fila);

        // A queda vem PRIMEIRO e é real: a aplicação já subiu apontando para estas instâncias.
        await banco.parar();
        await fila.parar();

        // Sem esta confirmação o caso seria tautológico — provaria 200 com as dependências de pé.
        expect(await codigoAoConectar(banco.porta)).toBe('ECONNREFUSED');
        expect(await codigoAoConectar(fila.porta)).toBe('ECONNREFUSED');

        // Sentinela no endereço que a aplicação conhece como banco, contando conexões. Ele é o
        // que discrimina "não consultou" de "consultou e a consulta falhou depressa": conexão
        // recusada custa milissegundos, então a latência sozinha não distingue os dois — medido,
        // e não suposto (um mutante que fizesse a rasa consultar dependência passava na versão
        // que só media tempo). Só o BANCO ganha sentinela: o cliente da fila mantém conexão
        // persistente e a restabelece em laço, o que torna a contagem na porta dela não
        // discriminante e instável — o eixo da fila é provado pelo CT-001 (b), e o cabeçalho
        // deste arquivo traz a medição que sustenta a escolha.
        const sentinela = await sentinelaNaPorta(banco.porta);

        // SUT_IS_CORRECT_BECAUSE: a rota rasa está CERTA — ela não consulta dependência alguma, e
        // quem prova isso é o sentinela logo abaixo. O que estava errado era a asserção de tempo
        // que morava aqui (`expect(decorrido).toBeLessThan(500)`): ela media RELÓGIO DE PAREDE —
        // agendamento do event loop e contenção entre as suítes paralelas — e reprovou a suíte com
        // 528 ms no mesmo host, minutos depois de um `110/110` verde, sem defeito algum no produto.
        // Ela também não discriminava nada: o comentário abaixo já registrava, desde a F0/T5, que
        // "conexão recusada custa milissegundos, então a latência sozinha não distingue os dois".
        // O poder de detecção NÃO cai com a remoção, e isso foi medido, não argumentado — ver
        // `MT-D9` na seção de mutantes do cabeçalho. Fecha o débito D9 da fatia
        // `cadastro-de-imoveis-e-pessoas` (§2 do `_run/run-report.md`).
        const resposta = await pedir(base, '/saude');

        expect(resposta.status).toBe(200);
        expect(comoObjeto(resposta)).toEqual({ estado: 'disponivel' });
        // Nenhuma menção a estado de dependência: é o que separa a rasa da profunda.
        expect(resposta.texto).not.toContain('banco');
        expect(resposta.texto).not.toContain('fila');
        expect(resposta.texto).not.toContain('dependencias');
        // A prova: o endereço do banco não recebeu conexão nenhuma.
        expect(sentinela.conexoes()).toBe(0);

        // Controle — sem ele a asserção acima seria infalível: a rota PROFUNDA, no mesmo processo
        // e com a mesma configuração, faz o sentinela contar.
        const profunda = await pedir(base, '/saude/pronto');
        expect(profunda.status).toBe(503);
        expect(sentinela.conexoes()).toBeGreaterThanOrEqual(1);
      },
      LIMITE_CASO_MS,
    );

    it.each([
      {
        cenario: 'banco fora',
        derrubar: ['banco'],
        banco: 'indisponivel',
        fila: 'disponivel',
      },
      {
        cenario: 'fila fora',
        derrubar: ['fila'],
        banco: 'disponivel',
        fila: 'indisponivel',
      },
      {
        cenario: 'ambas fora',
        derrubar: ['banco', 'fila'],
        banco: 'indisponivel',
        fila: 'indisponivel',
      },
    ])(
      'CT-002 — GET /saude/pronto responde 503 nomeando a dependência indisponível ($cenario)',
      async ({ derrubar, banco: estadoDoBanco, fila: estadoDaFila }) => {
        // Uma aplicação e um par de instâncias por cenário: o estado de conexão não se recupera
        // entre cenários, e reaproveitá-los acoplaria um caso ao anterior.
        const { banco, fila } = await subirEfemeras();
        const base = await subirAplicacao(banco, fila);

        if (derrubar.includes('banco')) {
          await banco.parar();
          expect(await codigoAoConectar(banco.porta)).toBe('ECONNREFUSED');
        }
        if (derrubar.includes('fila')) {
          await fila.parar();
          expect(await codigoAoConectar(fila.porta)).toBe('ECONNREFUSED');
        }

        const resposta = await pedir(base, '/saude/pronto');
        const corpo = comoObjeto(resposta);

        expect(resposta.status).toBe(503);
        expect(corpo.codigo).toBe(CodigoErro.SERVICO_INDISPONIVEL);
        // A dependência que continua de pé precisa aparecer DISPONÍVEL: sem esta metade, uma
        // implementação que marcasse tudo como indisponível ao primeiro erro passaria.
        expect(corpo.detalhes).toEqual({
          dependencias: { banco: estadoDoBanco, fila: estadoDaFila },
        });
        for (const nome of derrubar) {
          expect(corpo.mensagem).toContain(nome);
        }
        // Nem pilha, nem cadeia de conexão, nem credencial.
        expect(Object.keys(corpo).sort()).toEqual(['codigo', 'detalhes', 'mensagem']);
        expect(resposta.texto).not.toContain('postgresql://');
        expect(resposta.texto).not.toContain('redis://');
        expect(resposta.texto).not.toContain(String(banco.porta));
      },
      LIMITE_CASO_MS,
    );
  });

  describe('com as dependências de pé', () => {
    let banco: BancoEfemero;
    let fila: FilaEfemera;

    // As instâncias são caras de subir e nenhum caso deste bloco as altera — o que muda por caso
    // é a aplicação, que continua nascendo e morrendo dentro de cada um.
    beforeAll(async () => {
      banco = await postgresEfemero();
      fila = await redisEfemero();
    }, LIMITE_CASO_MS);

    afterAll(async () => {
      await banco?.parar();
      await fila?.parar();
    }, LIMITE_CASO_MS);

    // DECISÃO FECHADA — T5 / Gate 2 · 2026-08-01
    // O QUÊ: o eixo da fila é provado por contagem exata de chamadas ao serviço, não por sentinela
    //        na porta da fila.
    // POR QUÊ: medido — com a fila fora, o laço de reconexão do cliente faz o sentinela contar
    //          sozinho (1 em 250 ms, 4 em 2 s) e a sonda entra na fila de espera local sem abrir
    //          socket; `toBe(0)` seria instável E tautológico. O sentinela na porta da fila foi
    //          prescrito pelo Gate 2 na 1ª passagem e retratado na 2ª ("o executor estava certo").
    //          A medição completa está no cabeçalho deste arquivo.
    // REVERTER EXIGE: demonstrar que `ping()` sobre cliente em reconexão abre conexão nova e que o
    //                 laço de reconexão não incrementa a contagem no intervalo do caso.
    it(
      'CT-001 (b) — a rota rasa não atravessa a porta por onde as dependências são consultadas',
      async () => {
        // Companheiro ESTRUTURAL do CT-001, e o eixo que cobre a fila. Ele não depende do estado
        // das dependências — por isso mora neste bloco, reaproveitando as instâncias já de pé em
        // vez de subir um par só para derrubá-lo.
        const { base, espiao } = await subirAplicacaoComEspiaoDeDependencias(banco, fila);

        const rasa = await pedir(base, '/saude');

        expect(rasa.status).toBe(200);
        expect(comoObjeto(rasa)).toEqual({ estado: 'disponivel' });
        // A prova: a rasa não chamou o serviço nenhuma vez — nem para o banco, nem para a fila.
        expect(espiao.chamadas).toBe(0);

        // Controle — sem ele a asserção acima seria infalível (um espião que ninguém alcança conta
        // zero por construção): a rota PROFUNDA, no mesmo processo, atravessa exatamente uma vez.
        const profunda = await pedir(base, '/saude/pronto');
        expect(profunda.status).toBe(200);
        expect(espiao.chamadas).toBe(1);
      },
      LIMITE_CASO_MS,
    );

    it(
      'CT-003 — GET /saude/pronto responde 200 com o estado de cada dependência, em camelCase',
      async () => {
        // ADR-0006: as instâncias em uso não são as provisionadas. A porta provisionada da fila é
        // lida do que está VERSIONADO; a do banco não existe (o provisionamento não abre porta
        // TCP), então o valor comparável é a porta padrão do serviço.
        const provisionada = portaProvisionadaDaFila();
        expect(
          fila.porta,
          `a porta efêmera da fila não pode ser a provisionada (${provisionada.porta}, ` +
            `origem: ${provisionada.origem})`,
        ).not.toBe(provisionada.porta);
        expect(fila.porta).not.toBe(PORTA_PADRAO_DA_FILA);
        expect(banco.porta).not.toBe(PORTA_PADRAO_DO_BANCO);
        for (const porta of [banco.porta, fila.porta]) {
          expect(porta).toBeGreaterThanOrEqual(FAIXA_PORTAS_EFEMERAS.primeira);
          expect(porta).toBeLessThanOrEqual(FAIXA_PORTAS_EFEMERAS.ultima);
        }

        const base = await subirAplicacao(banco, fila);

        const resposta = await pedir(base, '/saude/pronto');
        const corpo = comoObjeto(resposta);

        expect(resposta.status).toBe(200);
        expect(corpo).toEqual({
          estado: 'disponivel',
          dependencias: { banco: 'disponivel', fila: 'disponivel' },
        });
        // camelCase em toda a profundidade do corpo (ADR-0007).
        for (const chave of chavesEmProfundidade(corpo)) {
          expect(chave).toMatch(/^[a-z][a-zA-Z0-9]*$/);
        }
        // Nenhuma coordenada nem credencial da dependência.
        expect(resposta.texto).not.toContain(String(banco.porta));
        expect(resposta.texto).not.toContain(String(fila.porta));
        expect(resposta.texto).not.toContain('postgresql://');
        expect(resposta.texto).not.toContain('127.0.0.1');
      },
      LIMITE_CASO_MS,
    );

    it(
      'CT-004 — GET /docs publica o contrato navegável, contendo as rotas de saúde',
      async () => {
        const base = await subirAplicacao(banco, fila);

        const pagina = await pedir(base, `/${CAMINHO_DO_CONTRATO}`);

        expect(pagina.status).toBe(200);
        expect(pagina.tipoDeConteudo.startsWith('text/html')).toBe(true);
        expect(pagina.texto.length).toBeGreaterThan(0);

        // O endereço do script que alimenta a página é EXTRAÍDO do próprio HTML servido: um
        // `GET /docs` que só conferisse 200 passaria com a página quebrada.
        const script = /<script src="([^"]+)"/.exec(pagina.texto)?.[1];
        expect(script, 'a página do contrato precisa carregar o script do visualizador').toBeTypeOf(
          'string',
        );
        // O endereço extraído é relativo à página, e é assim que ele é resolvido aqui.
        const recurso = await pedir(`${base}/${CAMINHO_DO_CONTRATO}`, script ?? '');
        expect(recurso.status).toBe(200);

        // O documento de descrição vem do caminho que o PRÓPRIO código de produção publica —
        // constante importada de `main.ts`, nunca um literal repetido aqui.
        const documento = await pedir(base, `/${CAMINHO_DO_DOCUMENTO}`);
        expect(documento.status).toBe(200);
        expect(documento.tipoDeConteudo.startsWith('application/json')).toBe(true);

        const contrato = comoObjeto(documento);
        const rotas = contrato.paths as Record<string, Record<string, { responses: object }>>;
        expect(Object.keys(rotas).sort()).toContain('/saude');
        expect(Object.keys(rotas).sort()).toContain('/saude/pronto');
        expect(rotas['/saude']?.get).toBeTypeOf('object');
        expect(Object.keys(rotas['/saude/pronto']?.get?.responses ?? {}).sort()).toEqual([
          '200',
          '503',
        ]);
      },
      LIMITE_CASO_MS,
    );

    it(
      'CT-005 — rota inexistente devolve o envelope da ADR-0007, não o corpo padrão do arcabouço',
      async () => {
        const base = await subirAplicacao(banco, fila);

        const resposta = await pedir(base, '/rota-que-nao-existe');
        const corpo = comoObjeto(resposta);

        expect(resposta.status).toBe(404);
        // O valor esperado vem do enum exportado pelo pacote compartilhado, nunca de um literal.
        expect(corpo.codigo).toBe(CodigoErro.RECURSO_NAO_ENCONTRADO);
        expect(typeof corpo.mensagem).toBe('string');
        expect(String(corpo.mensagem).length).toBeGreaterThan(0);
        // A ausência destas duas chaves é o que prova a substituição do formato padrão — sem ela,
        // o caso não distingue "filtro registrado" de "filtro coincidentemente parecido".
        expect(Object.keys(corpo)).not.toContain('statusCode');
        expect(Object.keys(corpo)).not.toContain('error');
        for (const chave of Object.keys(corpo)) {
          expect(CHAVES_DO_ERRO).toContain(chave);
        }
      },
      LIMITE_CASO_MS,
    );

    it(
      'CT-006 — exceção inesperada vira 500 com ERRO_INTERNO, sem vazar mensagem interna nem pilha',
      async () => {
        const base = await subirAplicacaoComFixtureDeFalha(banco, fila);

        const resposta = await pedir(base, `/${CAMINHO_DO_GATILHO}`);
        const corpo = comoObjeto(resposta);

        expect(resposta.status).toBe(500);
        expect(corpo.codigo).toBe(CodigoErro.ERRO_INTERNO);
        expect(typeof corpo.mensagem).toBe('string');
        expect(String(corpo.mensagem).length).toBeGreaterThan(0);
        // Um filtro que apenas reencapsulasse `erro.message` passaria numa versão que só
        // conferisse o código.
        expect(resposta.texto).not.toContain('senha@');
        expect(resposta.texto).not.toContain('postgres://');
        expect(Object.keys(corpo)).not.toContain('stack');
        expect(Object.keys(corpo)).not.toContain('statusCode');
        expect(Object.keys(corpo)).not.toContain('error');
        for (const chave of Object.keys(corpo)) {
          expect(CHAVES_DO_ERRO).toContain(chave);
        }
      },
      LIMITE_CASO_MS,
    );

    // DECISÃO FECHADA — T5 / Gate 2 · 2026-08-01
    // O QUÊ: a guarda `caminhoSemConsulta` (`src/comum/filtro-excecao.ts`) é defendida por ESTE
    //        caso, que assere o valor exato do campo `caminho` do evento nos dois ramos dela.
    // POR QUÊ: a guarda entrou como correção de segurança (P7 do Gate 2) e passou uma rodada
    //          inteira sem rede — todos os demais casos rodam com `LOG_LEVEL=fatal` e o filtro
    //          emite em `warn`/`error`, de modo que reverter a linha para `requisicao.url`
    //          deixava a suíte inteira verde. É a R2 da `.claude/rules/nao-regressao.md`, a mesma
    //          classe que já custou quatro rodadas a este repositório num vazamento de credencial.
    // REVERTER EXIGE: demonstrar que existe outra asserção que reprova quando a cadeia de consulta
    //                 volta ao campo `caminho` do journal — nos DOIS ramos: rota casada e rota que
    //                 não casou nenhuma. Enquanto não houver, este caso é a única.
    it(
      'CT-006 (b) — o caminho gravado no journal não carrega a cadeia de consulta',
      async () => {
        const { base, journal } = await subirAplicacaoComJournalObservavel(banco, fila);

        // Ramo 1 — rota CASADA: o filtro grava o padrão da rota, e o evento sai em `error` (500).
        const casada = await pedir(
          base,
          `/${CAMINHO_DO_GATILHO}?token=${SEGREDO_EM_CONSULTA}&callbackURL=/painel`,
        );
        expect(casada.status).toBe(500);

        // Ramo 2 — rota NÃO casada: não há padrão a usar, e sobra o alvo truncado antes do `?`.
        // Sem este ramo a rede cobriria metade da guarda: um `caminhoSemConsulta` que devolvesse
        // `requisicao.routeOptions?.url ?? requisicao.url` passaria no ramo 1 e vazaria aqui.
        const naoCasada = await pedir(
          base,
          `/rota-que-nao-existe?token=${SEGREDO_EM_CONSULTA}&callbackURL=/painel`,
        );
        expect(naoCasada.status).toBe(404);

        // Contagem exata: uma linha por requisição, na ordem em que foram feitas. Sem ela, um
        // registrador mudo passaria os índices adiante como `undefined`.
        const eventos = journal.eventos();
        expect(eventos).toHaveLength(2);

        // Valor EXATO do campo — nunca a presença dele, nem "não contém o segredo" sozinho: o
        // campo precisa continuar dizendo QUAL rota falhou, e não virar cadeia vazia.
        expect(eventos[0]?.caminho).toBe(`/${CAMINHO_DO_GATILHO}`);
        expect(eventos[1]?.caminho).toBe('/rota-que-nao-existe');
        // O evento certo, no nível certo — o `caminho` correto do evento errado não provaria nada.
        expect(eventos[0]?.nivel).toBe('error');
        expect(eventos[0]?.status).toBe(500);
        expect(eventos[1]?.nivel).toBe('warn');
        expect(eventos[1]?.status).toBe(404);

        // A linha INTEIRA do evento da rota casada — não só o campo — está livre do segredo: se
        // ele reaparecer por outro campo, esta asserção o apanha.
        //
        // O mesmo não é asserido para a rota não casada, e a razão é registrada aqui em vez de
        // omitida: o arcabouço monta a exceção de rota inexistente com o ALVO BRUTO na mensagem
        // (`Cannot GET /rota-que-nao-existe?token=...`), e o filtro entrega a exceção de origem ao
        // journal por campo nomeado (`erro`), que é onde o diagnóstico deve estar. Esse caminho é
        // do arcabouço, não da guarda, e fechá-lo é decisão que pertence a quem tocar
        // `filtro-excecao.ts` — está anotado como pendência da task.
        expect(journal.linhas()[0]).not.toContain(SEGREDO_EM_CONSULTA);
      },
      LIMITE_CASO_MS,
    );
  });
});

/** Fixture de CT-006: uma rota que falha com exceção comum, carregando texto sensível. */
//
// SUT_IS_CORRECT_BECAUSE: a guarda de contexto global da T9 está CERTA ao recusar esta rota — ela é
// uma rota como qualquer outra, e o default fechado que a task entrega manda que rota nova nasça
// protegida por omissão. Sem a marca, o CT-006 e o CT-006 (b) passariam a receber `401` da guarda em
// vez do `500`/`404` do filtro, e deixariam de exercitar o que existem para exercitar. A §7 do
// cartão da T9 manda "corrigir a guarda, nunca o teste" **quando a guarda capturar as rotas de
// saúde** — e ela não as capturou: `SaudeController` traz `@RotaPublica()`, e os CT-001 a CT-005
// seguem verdes sem alteração alguma. O que ela capturou foi este CONTROLADOR-FIXTURE, que a §7 não
// previa e cuja recusa é o comportamento correto, não regressão.
//
// A marca é o MENOR diff possível e **não enfraquece nada**: nenhum caso deste arquivo foi alterado,
// nenhuma asserção foi afrouxada e a contagem de casos não mudou. Ela apenas declara, no fixture, o
// que toda rota do produto passa a declarar — que aquela rota dispensa sessão.
@RotaPublica()
@Controller(CAMINHO_DO_GATILHO)
class ControladorQueFalha {
  @Get()
  falhar(): never {
    throw new Error(`conexão ${CADEIA_SENSIVEL} recusada`);
  }
}
