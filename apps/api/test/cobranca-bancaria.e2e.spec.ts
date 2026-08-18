/**
 * As **três rotas de `/v1/cobranca-bancaria`** medidas na borda real — a concorrência que o banco
 * recusa, a recusa que o esquema faz e a ordem `COMMIT → fila` que torna o pior caso inofensivo.
 *
 * ---------------------------------------------------------------------------
 * INVARIANTES
 * ---------------------------------------------------------------------------
 *
 * | Critério | Caso        | Invariante |
 * |---|---|---|
 * | CA-15 | CT-928       | Com uma conferência da empresa A em curso (`concluida_em IS NULL`), um
 * |       |              | segundo disparo da mesma empresa **não cria linha nova** e responde `200`
 * |       |              | informando **qual** está em curso — o mesmo `id`, com
 * |       |              | `iniciadaAgora: false` — e **nada é enfileirado**. O disparo da empresa B
 * |       |              | no mesmo instante é aceito. Concluída a de A, um disparo novo de A é
 * |       |              | aceito e cria a **segunda** linha: é o que discrimina índice **parcial**
 * |       |              | de índice total. |
 * | §4    | CT-928 (b)   | `competencia` fora do primeiro dia do mês é `422` nomeando `competencia`, e
 * |       |              | chave desconhecida no corpo é `422` nomeando o `corpo` — os dois com o
 * |       |              | envelope canônico inteiro, e **sem eco do valor recusado**. Nos dois, a
 * |       |              | contagem crua de `emissao_em_lote` **não muda** e nenhuma tarefa entra na
 * |       |              | fila. ⚠️ O `code: 'unrecognized_keys'` e a lista `keys` são do **esquema**,
 * |       |              | e estão medidos pelo `CT-942` de `packages/contracts/test/esquemas.spec.ts`;
 * |       |              | eles não chegam ao corpo publicado, porque o `ZodError` viaja como `causa`
 * |       |              | de diagnóstico e a borda **nunca ecoa a entrada recusada**. Repeti-los aqui
 * |       |              | seria caso semanticamente duplicado. |
 * | §4    | CT-928 (c)   | O primeiro `POST /emissoes` responde `201` e enfileira **exatamente**
 * |       |              | `{ empresaId, loteId }`; o segundo, com lote em andamento, responde `422`
 * |       |              | com `detalhes: { loteEmCurso: '<id do primeiro>' }`, **sem gravar** e
 * |       |              | **sem enfileirar**. E o lote **que este caso acabou de abrir** é
 * |       |              | indistinguível de inexistente para a outra empresa — `404` com o
 * |       |              | **mesmo corpo**, byte a byte, tendo o `200` do dono como âncora
 * |       |              | antivácuo. |
 * | §9.3  | CT-928 (d)   | O lote é gravado **antes** de ser enfileirado: com o servidor de fila
 * |       |              | fora, o `POST` responde `503` e o lote **permanece** `EM_ANDAMENTO`,
 * |       |              | alcançável pelo `GET`. |
 *
 * Rastreabilidade: `CA-15 → CT-928 (RN-11)`.
 *
 * ===========================================================================
 * POR QUE OS TRÊS CASOS IRMÃOS USAM O ID COM SUFIXO
 * ===========================================================================
 *
 * A §6 da T15 declara **um** CT para esta suíte, o da CA-15. Os demais critérios do **§4 (Aceite
 * Técnico)** — as duas recusas de esquema, a recusa do lote concorrente e a ordem `COMMIT → fila` —
 * são invariantes de comportamento que a task cobra por escrito e que nenhum caso declarado mede.
 * Eles entram como **casos irmãos sob o mesmo ID com sufixo**, que é a forma já praticada nesta base
 * (`CT-918 (f)` em `cobertura-de-autorizacao.e2e.spec.ts`, `CT-824 (c)` em
 * `certificado-do-provedor.e2e.spec.ts`) — em vez de inventar números que a spec não alocou, o que
 * colidiria com a numeração das tasks seguintes.
 *
 * ===========================================================================
 * A CONFERÊNCIA É MANTIDA ABERTA PELO ESTADO DO BANCO, nunca por pausa
 * ===========================================================================
 *
 * O CT-928 precisa de *"uma conferência em curso no instante do segundo disparo"*, e a precondição é
 * montada pelo **caminho legítimo**: a primeira conferência nasce pela própria rota e continua aberta
 * porque **ninguém a concluiu** — `concluida_em` é nulo, e o índice único parcial é o que recusa a
 * segunda. Não há `sleep`, não há relógio falseado e não há linha inserida à mão.
 *
 * A conclusão da conferência de A, no último passo, também é pelo caminho que o produto usa:
 * `concluirConferencia`, a função de domínio publicada por `@sysloc/db` — a mesma que o processo de
 * trabalho invoca ao fim do percurso. A rota que a chamará é do processo de trabalho, não da borda;
 * **nenhum símbolo de produção nasceu para este arquivo enxergar algo**.
 *
 * ===========================================================================
 * A FILA CAI DE VERDADE no CT-928 (d) — e é isso que mede a ORDEM
 * ===========================================================================
 *
 * A afirmação *"nada é enfileirado antes do commit"* não se prova olhando a ordem das linhas do
 * controlador: as duas ordens compilam igual. O que a discrimina é o desfecho observável quando o
 * enfileiramento **falha** — se o lote fosse enfileirado dentro da unidade, a falha desfaria a
 * transação e **não haveria lote** para o `GET` encontrar.
 *
 * Por isso o servidor de fila é **derrubado** (`parar({ preservarDados: true })`) e religado no
 * `finally` do próprio caso. A instância é efêmera e própria (ADR-0006), e o par
 * `parar`/`religar` existe no acessório desde a F0, justamente para casos assim. O caso é o
 * **último** do arquivo, de modo que nenhum irmão herda o servidor em transição.
 *
 * ⚠️ **E ele cria o próprio lote**, pela rota, com a empresa B: não lê nada que outro caso tenha
 * deixado gravado, e roda **isolado** (`-t 'CT-928 (d)'`) com o mesmo resultado. A leitura que antes
 * abria este caso — o `GET` do lote de A, aberto pelo irmão — mudou-se para o `CT-928 (c)`, que é
 * quem **cria** aquele lote. Um caso que só passa na ordem em que os irmãos o deixaram é justamente
 * o que não se pode executar sozinho para diagnosticar a regressão que ele existe para pegar.
 *
 * ===========================================================================
 * De onde vêm o banco, a fila e a credencial (ADR-0006)
 * ===========================================================================
 *
 * De instâncias efêmeras próprias. Nenhuma coordenada de conexão é lida do ambiente: o ambiente do
 * processo é **montado** a partir do que os acessórios devolvem, e a porta é **reservada** porque o
 * arcabouço confere a origem das requisições com cookie contra o endereço base.
 */

import { randomBytes } from 'node:crypto';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import {
  type AcessoAoBanco,
  abrirAcessoAoBanco,
  concluirConferencia,
  contextoDeTenant,
  EMPRESA_A,
  EMPRESA_B,
  SENHA_DA_CARGA,
} from '@sysloc/db';
import {
  type CargaDaConferenciaBancaria,
  type CargaDaEmissaoEmLote,
  CodigoErro,
  FILA_DA_CONFERENCIA_BANCARIA,
  FILA_DA_EMISSAO_EM_LOTE,
} from '@sysloc/shared';
import { Queue } from 'bullmq';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
// DÉBITO COM GATILHO — D28 · F0/T5 · gatilho JÁ DISPARADO (F1/T2, 2026-08-02)
// (NÃO é uma `DECISÃO FECHADA`: ele agenda uma mudança, não protege o código abaixo.)
// O QUÊ: os imports a seguir atravessam a fronteira de `@sysloc/auth` e `@sysloc/shared` por
//        CAMINHO DE ARQUIVO, fora do `exports` e do `files` daqueles manifestos. As dependências de
//        workspace estão declaradas, então não há dependência oculta; o que não existe é FRONTEIRA
//        para os diretórios `test/` — e este arquivo é mais um a repetir o padrão.
// QUANDO FECHA: o gatilho já disparou e o fechamento segue pendente; ele é o mesmo de sempre —
//        declarar o subpath `"./test"` nos manifestos e importar por `@sysloc/<pacote>/test`, ou
//        extrair um `@sysloc/test-utils`.
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
import {
  CAMINHO_DA_COBRANCA_BANCARIA,
  SEGMENTO_DAS_CONFERENCIAS,
  SEGMENTO_DAS_EMISSOES,
} from '../src/cobranca-bancaria/cobranca-bancaria.controller.ts';
import { ENDERECO_DE_ESCUTA, PREFIXO_DE_VERSAO } from '../src/configuracao/ambiente.ts';
import { criarAplicacao } from '../src/main.ts';

/** Limite da montagem: banco migrado, semente com credencial, fila e a aplicação real. */
const LIMITE_DE_MONTAGEM_MS = 240_000;

/** Limite de um caso que atravessa HTTP, banco e fila várias vezes. */
const LIMITE_CASO_MS = 120_000;

/** Limite do caso que derruba e religa o servidor de fila — ele paga duas transições de processo. */
const LIMITE_DO_CASO_COM_QUEDA_MS = 180_000;

/** Sufixo do nome do cookie de sessão do arcabouço — o prefixo vem da configuração. */
const SUFIXO_DO_COOKIE_DE_SESSAO = 'session_token';

/** A rota de entrada, composta a partir do prefixo real. Nunca escrita à mão. */
const ROTA_DE_ENTRADA = `${PREFIXO_DAS_ROTAS_DE_IDENTIDADE}/sign-in/email`;

/** Caminho, relativo à raiz, da rota de sessão do produto. Composto, nunca escrito à mão. */
const CAMINHO_DA_SESSAO_CORRENTE = `/${PREFIXO_DE_VERSAO}/${CAMINHO_DA_SESSAO}`;

/** A área desta superfície, composta a partir das constantes que o controlador publica. */
const AREA_DA_COBRANCA_BANCARIA = `/${PREFIXO_DE_VERSAO}/${CAMINHO_DA_COBRANCA_BANCARIA}`;

/** As duas coleções de execução, compostas pela mesma razão. */
const ROTA_DAS_EMISSOES = `${AREA_DA_COBRANCA_BANCARIA}/${SEGMENTO_DAS_EMISSOES}`;
const ROTA_DAS_CONFERENCIAS = `${AREA_DA_COBRANCA_BANCARIA}/${SEGMENTO_DAS_CONFERENCIAS}`;

/**
 * Quem age em cada empresa: as `ADMIN_EMPRESA` da carga, cujo perfil alcança o catálogo inteiro.
 *
 * As duas são necessárias, e não uma conveniência: o CT-928 só discrimina *"o índice é por empresa"*
 * de *"o índice é global"* se houver um disparo de outra empresa no mesmo instante.
 */
const QUEM_ADMINISTRA_EM_A = pessoaSemeada('admin.a@exemplo.com.br');
const QUEM_ADMINISTRA_EM_B = pessoaSemeada('admin.b@exemplo.com.br');

/** A área e a ação que as três rotas exigem — literais, e **não** importados do controlador. */
const AREA_DO_FINANCEIRO = 'TELA:financeiro';
const ACAO_DE_EMISSAO_DE_BOLETO = 'ACAO:emitir_boleto';

/** Uma competência válida — primeiro dia do mês, que é o que o esquema exige. */
const COMPETENCIA_VALIDA = '2026-09-01';

/** A mesma competência, deslocada para um dia que **não** é o primeiro. */
const COMPETENCIA_NO_MEIO_DO_MES = '2026-09-15';

/** Uma competência válida e distinta da primeira — o lote da empresa B. */
const COMPETENCIA_DE_B = '2026-10-01';

/** A chave que o corpo fechado tem de recusar **nomeando-a**. */
const CHAVE_DESCONHECIDA = 'empresaId';

/** O campo que a recusa da competência nomeia. */
const CAMPO_DA_COMPETENCIA = 'competencia';

/** O discriminador que a recusa do lote concorrente publica dentro de `detalhes`. */
const DISCRIMINADOR_DO_LOTE_EM_CURSO = 'loteEmCurso';

/** O estado em que um lote recém-aberto nasce — literal, e não importado do contrato. */
const ESTADO_EM_ANDAMENTO = 'EM_ANDAMENTO';

/** Um identificador bem-formado que não corresponde a lote algum — o alvo do `404` de controle. */
const LOTE_INEXISTENTE = '00000000-0000-4000-8000-0000000000ff';

/** As contagens com que a conferência de A é fechada — valores quaisquer; nada aqui as mede. */
const CONTAGENS_DO_FECHO = { cobrancasConferidas: 0, efeitos: 0 };

/** As variáveis que a montagem fixa e o encerramento restaura. */
const VARIAVEIS_MONTADAS = [
  'NODE_ENV',
  'PORT',
  'LOG_LEVEL',
  'DATABASE_URL',
  'REDIS_URL',
  'BETTER_AUTH_SECRET',
  'CHAVE_DE_CIFRA_DO_CERTIFICADO',
] as const;

/** Comprimento da chave do AES-256, em bytes — o que a partida exige da chave de cifra. */
const BYTES_DA_CHAVE_DE_CIFRA = 32;

let identidade: IdentidadeEfemera;
let filaEfemera: FilaEfemera;
let acessoAoNegocio: AcessoAoBanco;
let aplicacao: NestFastifyApplication;
let base: string;
let ambienteAnterior: NodeJS.ProcessEnv;
let cookieDeA: string;
let cookieDeB: string;

/**
 * As SONDAS das duas filas — produtores só de observação, sobre o mesmo servidor.
 *
 * Elas escutam os nomes que `@sysloc/shared` publica, e não literais: se o produtor de produção
 * gravasse em outra fila, a contagem aqui ficaria em zero e os casos reprovariam nomeando o
 * problema. É essa coincidência de nome, vinda da definição única, que torna verdadeira a afirmação
 * *"a borda enfileirou a tarefa que o processo de trabalho vai consumir"*.
 */
let sondaDoLote: Queue<CargaDaEmissaoEmLote, void>;
let sondaDaConferencia: Queue<CargaDaConferenciaBancaria, void>;

beforeAll(async () => {
  identidade = await identidadeEfemera();
  filaEfemera = await redisEfemero();
  acessoAoNegocio = abrirAcessoAoBanco({ cadeiaDeConexao: identidade.banco.cadeiaConexao });

  ambienteAnterior = { ...process.env };
  process.env.NODE_ENV = 'test';
  process.env.LOG_LEVEL = 'fatal';
  process.env.DATABASE_URL = identidade.banco.cadeiaConexao;
  process.env.REDIS_URL = filaEfemera.cadeiaConexao;
  process.env.BETTER_AUTH_SECRET = randomBytes(32).toString('base64url');
  process.env.CHAVE_DE_CIFRA_DO_CERTIFICADO =
    randomBytes(BYTES_DA_CHAVE_DE_CIFRA).toString('base64');

  const porta = await reservarPorta();
  base = `http://${ENDERECO_DE_ESCUTA}:${String(porta)}`;
  process.env.PORT = String(porta);

  aplicacao = await criarAplicacao();
  await aplicacao.listen({ port: porta, host: ENDERECO_DE_ESCUTA });

  const endereco = new URL(filaEfemera.cadeiaConexao);
  const conexaoDaSonda = {
    host: endereco.hostname,
    port: Number.parseInt(endereco.port, 10),
  };

  sondaDoLote = new Queue<CargaDaEmissaoEmLote, void>(FILA_DA_EMISSAO_EM_LOTE, {
    connection: conexaoDaSonda,
  });
  sondaDaConferencia = new Queue<CargaDaConferenciaBancaria, void>(FILA_DA_CONFERENCIA_BANCARIA, {
    connection: conexaoDaSonda,
  });

  // Os ouvintes NÃO são ornamento: o `CT-928 (d)` derruba o servidor de fila de propósito, e uma
  // sonda sem ouvinte de `error` derrubaria o processo de teste com `Unhandled error event` em vez
  // de deixar o caso medir o que ele persegue.
  sondaDoLote.on('error', () => undefined);
  sondaDaConferencia.on('error', () => undefined);

  cookieDeA = await entrar(QUEM_ADMINISTRA_EM_A.email);
  cookieDeB = await entrar(QUEM_ADMINISTRA_EM_B.email);

  // As precondições de autorização AFIRMADAS, e não supostas. Sem elas, um `403` em qualquer rota
  // desta superfície seria indistinguível de um defeito dela, e a varredura correria sobre corpos de
  // recusa.
  for (const [rotulo, credencial] of [
    ['A', cookieDeA],
    ['B', cookieDeB],
  ] as const) {
    const sessao = (await pedir(CAMINHO_DA_SESSAO_CORRENTE, { cookie: credencial }))
      .corpo as SessaoPublicada;

    expect(sessao.telas, `a sessão de ${rotulo} não alcança o Financeiro`).toContain(
      AREA_DO_FINANCEIRO,
    );
    expect(sessao.acoes, `a sessão de ${rotulo} não alcança a emissão`).toContain(
      ACAO_DE_EMISSAO_DE_BOLETO,
    );
  }
}, LIMITE_DE_MONTAGEM_MS);

afterAll(async () => {
  await sondaDoLote?.close();
  await sondaDaConferencia?.close();
  await aplicacao?.close();
  await acessoAoNegocio?.encerrar();
  await filaEfemera?.parar();
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

describe('a borda da cobrança bancária — lote e conferência (T15)', () => {
  it(
    'CT-928 — o disparo concorrente não inicia uma segunda conferência, informa qual está em curso, e o índice é PARCIAL',
    async () => {
      const primeiro = await pedir(ROTA_DAS_CONFERENCIAS, {
        metodo: 'POST',
        cookie: cookieDeA,
        corpo: {},
      });

      expect(primeiro.status).toBe(200);
      const aberta = primeiro.corpo as ConferenciaPublicada;

      // A ÂNCORA ANTIVÁCUO do arranjo: a conferência de A **existe e está aberta** no instante do
      // segundo disparo. Sem esta linha, um primeiro disparo que tivesse falhado faria o `count === 1`
      // abaixo passar por outra razão — e o caso deixaria de medir a concorrência.
      expect(aberta.iniciadaAgora).toBe(true);
      expect(aberta.concluidaEm).toBeNull();
      expect(await conferenciasDe(EMPRESA_A.id)).toEqual([{ id: aberta.id, concluida: false }]);

      const enfileiradasApos1 = await tarefasDaConferencia();
      expect(enfileiradasApos1).toEqual([{ empresaId: EMPRESA_A.id, conferenciaId: aberta.id }]);

      // O SEGUNDO DISPARO DE A — o ato que o caso mede.
      const segundo = await pedir(ROTA_DAS_CONFERENCIAS, {
        metodo: 'POST',
        cookie: cookieDeA,
        corpo: {},
      });

      // Ela DISCRIMINA o defeito desta task: se a borda tratasse `iniciadaAgora: false` como caminho
      // de criação, o corpo traria um `id` novo e esta igualdade reprovaria nomeando os dois. É a
      // primeira asserção a reprovar num produto que iniciasse a segunda conferência, porque a
      // resposta sai antes de qualquer leitura do banco que este caso faça.
      expect(segundo.status).toBe(200);
      expect(segundo.corpo).toEqual({
        id: aberta.id,
        iniciadaEm: aberta.iniciadaEm,
        concluidaEm: null,
        iniciadaAgora: false,
        cobrancasConferidas: 0,
        efeitos: 0,
      });

      // O EFEITO no banco, medido por leitura crua sob o contexto de A: **uma** linha, a mesma.
      expect(await conferenciasDe(EMPRESA_A.id)).toEqual([{ id: aberta.id, concluida: false }]);

      // E NADA foi enfileirado pelo segundo disparo — a tarefa continua sendo a do primeiro.
      expect(await tarefasDaConferencia()).toEqual(enfileiradasApos1);

      // A EMPRESA B, no mesmo instante: o índice é por empresa, e o disparo dela é aceito.
      const deB = await pedir(ROTA_DAS_CONFERENCIAS, {
        metodo: 'POST',
        cookie: cookieDeB,
        corpo: {},
      });

      expect(deB.status).toBe(200);
      const abertaEmB = deB.corpo as ConferenciaPublicada;

      expect(abertaEmB.iniciadaAgora).toBe(true);
      expect(abertaEmB.id).not.toBe(aberta.id);
      expect(await conferenciasDe(EMPRESA_B.id)).toEqual([{ id: abertaEmB.id, concluida: false }]);
      // A de A continua sendo **uma**: o disparo de B não a tocou.
      expect(await conferenciasDe(EMPRESA_A.id)).toEqual([{ id: aberta.id, concluida: false }]);

      // O ÍNDICE É PARCIAL, e este é o passo que o discrimina de um índice total: concluída a de A,
      // um disparo novo de A é **aceito** e cria a segunda linha. Com índice total sobre
      // `(empresa_id)`, este disparo responderia a mesma conferência já concluída.
      await contextoDeTenant.executarCom(
        { empresaId: EMPRESA_A.id },
        async () =>
          await acessoAoNegocio.emUnidadeDeTrabalho(
            async (tx) => await concluirConferencia(tx, aberta.id, CONTAGENS_DO_FECHO),
          ),
      );

      const terceiro = await pedir(ROTA_DAS_CONFERENCIAS, {
        metodo: 'POST',
        cookie: cookieDeA,
        corpo: {},
      });

      expect(terceiro.status).toBe(200);
      const reaberta = terceiro.corpo as ConferenciaPublicada;

      expect(reaberta.iniciadaAgora).toBe(true);
      expect(reaberta.id).not.toBe(aberta.id);
      expect(await conferenciasDe(EMPRESA_A.id)).toEqual([
        { id: aberta.id, concluida: true },
        { id: reaberta.id, concluida: false },
      ]);
    },
    LIMITE_CASO_MS,
  );

  it(
    'CT-928 (b) — competência fora do primeiro dia e chave desconhecida são 422, e nenhuma das duas grava ou enfileira',
    async () => {
      const lotesAntes = await lotesDe(EMPRESA_A.id);
      const tarefasAntes = await tarefasDoLote();

      const foraDoPrimeiroDia = await pedir(ROTA_DAS_EMISSOES, {
        metodo: 'POST',
        cookie: cookieDeA,
        corpo: { competencia: COMPETENCIA_NO_MEIO_DO_MES },
      });

      expect(foraDoPrimeiroDia.status).toBe(422);
      expect(foraDoPrimeiroDia.corpo).toEqual({
        codigo: CodigoErro.CAMPO_INVALIDO,
        mensagem: MENSAGEM_DE_REQUISICAO_INVALIDA,
        campo: CAMPO_DA_COMPETENCIA,
      });

      const comChaveDesconhecida = await pedir(ROTA_DAS_EMISSOES, {
        metodo: 'POST',
        cookie: cookieDeA,
        corpo: { competencia: COMPETENCIA_VALIDA, [CHAVE_DESCONHECIDA]: EMPRESA_B.id },
      });

      // O corpo INTEIRO por igualdade, e não campo a campo: é ela que pega o `detalhes` que
      // aparecesse com o valor recusado dentro — a borda nomeia o campo culpado e **nunca ecoa a
      // entrada**. O `campo` é o do corpo porque a chave excedente não tem caminho a nomear, e quem
      // afirma o `code`/`keys` da recusa é o `CT-942`, sobre o esquema (ver os INVARIANTES).
      expect(comChaveDesconhecida.status).toBe(422);
      expect(comChaveDesconhecida.corpo).toEqual({
        codigo: CodigoErro.CAMPO_INVALIDO,
        mensagem: MENSAGEM_DE_REQUISICAO_INVALIDA,
        campo: CAMPO_DO_CORPO,
      });
      // E o valor recusado NÃO viajou: `empresaId` é o identificador de outra empresa, e vê-lo na
      // saída seria vazamento além de eco.
      expect(comChaveDesconhecida.texto).not.toContain(EMPRESA_B.id);

      // A CONTAGEM CRUA, antes e depois: é ela que separa "respondeu 422" de "respondeu 422 e não
      // gravou". A igualdade é de array, e não de tamanho: um lote que entrasse e outro que saísse
      // manteriam a contagem e a lista acusaria.
      expect(await lotesDe(EMPRESA_A.id)).toEqual(lotesAntes);
      expect(await tarefasDoLote()).toEqual(tarefasAntes);
    },
    LIMITE_CASO_MS,
  );

  it(
    'CT-928 (c) — a abertura enfileira exatamente {empresaId, loteId}, e o segundo lote é 422 nomeando o que está em curso',
    async () => {
      const tarefasAntes = await tarefasDoLote();

      const abertura = await pedir(ROTA_DAS_EMISSOES, {
        metodo: 'POST',
        cookie: cookieDeA,
        corpo: { competencia: COMPETENCIA_VALIDA },
      });

      expect(abertura.status).toBe(201);
      const lote = abertura.corpo as LotePublicado;

      expect(abertura.corpo).toEqual({
        id: lote.id,
        competencia: COMPETENCIA_VALIDA,
        estado: ESTADO_EM_ANDAMENTO,
        criadoEm: lote.criadoEm,
        concluidoEm: null,
        interrompidoEm: null,
        motivoDaInterrupcao: null,
        emitidas: 0,
        recusadas: 0,
        itens: [],
      });

      // A CARGA, por igualdade de objeto: dois identificadores, e nada mais. Um campo a mais aqui —
      // material, senha, envelope — reprovaria nomeando-o.
      expect(await tarefasDoLote()).toEqual([
        ...tarefasAntes,
        { empresaId: EMPRESA_A.id, loteId: lote.id },
      ]);

      const lotesAposAbertura = await lotesDe(EMPRESA_A.id);
      expect(lotesAposAbertura).toEqual([{ id: lote.id, competencia: COMPETENCIA_VALIDA }]);

      // O SEGUNDO LOTE, com um em andamento — o ato que este caso mede.
      const concorrente = await pedir(ROTA_DAS_EMISSOES, {
        metodo: 'POST',
        cookie: cookieDeA,
        corpo: { competencia: COMPETENCIA_DE_B },
      });

      // Ela DISCRIMINA o defeito: sem a tradução de `ErroDeLoteEmCurso`, a violação do índice subiria
      // como falha de driver e o corpo seria o `500` genérico — esta igualdade reprova nomeando os
      // dois corpos. O `detalhes` carrega o lote que está acontecendo, que é o que resolve a situação.
      expect(concorrente.status).toBe(422);
      expect(concorrente.corpo).toEqual({
        codigo: CodigoErro.CAMPO_INVALIDO,
        mensagem: MENSAGEM_DE_REQUISICAO_INVALIDA,
        detalhes: { [DISCRIMINADOR_DO_LOTE_EM_CURSO]: lote.id },
      });

      // E NADA foi gravado nem enfileirado pelo segundo pedido.
      expect(await lotesDe(EMPRESA_A.id)).toEqual(lotesAposAbertura);
      expect(await tarefasDoLote()).toEqual([
        ...tarefasAntes,
        { empresaId: EMPRESA_A.id, loteId: lote.id },
      ]);

      // A LEITURA, e as duas recusas indistinguíveis. Ela mora aqui, e não no caso seguinte, porque
      // o lote de A é criado **dentro deste caso**: lê-lo do caso irmão faria a prova depender da
      // ordem de execução, e um caso que não roda sozinho não diagnostica a regressão que ele existe
      // para pegar. O `GET` sob a sessão do dono é a âncora antivácuo das duas comparações abaixo —
      // sem ele, um `404` universal (rota errada, por exemplo) faria a igualdade passar comparando
      // duas ausências.
      const lidoPorA = await pedir(`${ROTA_DAS_EMISSOES}/${lote.id}`, { cookie: cookieDeA });

      expect(lidoPorA.status).toBe(200);
      expect((lidoPorA.corpo as LotePublicado).estado).toBe(ESTADO_EM_ANDAMENTO);

      const lidoPorB = await pedir(`${ROTA_DAS_EMISSOES}/${lote.id}`, { cookie: cookieDeB });
      const inexistentePorB = await pedir(`${ROTA_DAS_EMISSOES}/${LOTE_INEXISTENTE}`, {
        cookie: cookieDeB,
      });

      expect(lidoPorB.status).toBe(404);
      expect(inexistentePorB.status).toBe(404);
      // Byte a byte: um corpo diferente para cada causa faria da borda um oráculo de existência
      // sobre o dado alheio.
      expect(lidoPorB.texto).toBe(inexistentePorB.texto);
      expect(lidoPorB.corpo).toEqual({
        codigo: CodigoErro.RECURSO_NAO_ENCONTRADO,
        mensagem: MENSAGEM_DE_RECURSO_NAO_ENCONTRADO,
      });
    },
    LIMITE_CASO_MS,
  );

  it(
    'CT-928 (d) — com a fila fora, o POST responde 503 e o lote de B fica gravado e alcançável',
    async () => {
      // A ORDEM `COMMIT → fila`, medida pelo desfecho: o servidor de fila cai, e o pedido de B
      // responde `503` **com o lote gravado**. Se a borda enfileirasse dentro da unidade de
      // trabalho, a falha desfaria a transação e o `GET` abaixo responderia `404`.
      const lotesDeBAntes = await lotesDe(EMPRESA_B.id);
      expect(lotesDeBAntes).toEqual([]);

      try {
        await filaEfemera.parar({ preservarDados: true });

        const comFilaFora = await pedir(ROTA_DAS_EMISSOES, {
          metodo: 'POST',
          cookie: cookieDeB,
          corpo: { competencia: COMPETENCIA_DE_B },
        });

        expect(comFilaFora.status).toBe(503);
        const recusa = comFilaFora.corpo as EnvelopeDeErro;
        expect(recusa.codigo).toBe(CodigoErro.SERVICO_INDISPONIVEL);

        // Esta é a asserção que discrimina a ordem: o lote de B **existe** depois de o
        // enfileiramento ter falhado. Ela é a primeira a reprovar num produto que enfileirasse
        // dentro da unidade, porque ali a lista voltaria vazia.
        const lotesDeBDepois = await lotesDe(EMPRESA_B.id);
        expect(lotesDeBDepois.map((lote) => lote.competencia)).toEqual([COMPETENCIA_DE_B]);

        const gravado = lotesDeBDepois[0];

        if (gravado === undefined) {
          throw new Error('o lote da empresa B não foi gravado');
        }

        const acompanhado = await pedir(`${ROTA_DAS_EMISSOES}/${gravado.id}`, {
          cookie: cookieDeB,
        });

        expect(acompanhado.status).toBe(200);
        expect((acompanhado.corpo as LotePublicado).estado).toBe(ESTADO_EM_ANDAMENTO);
      } finally {
        await filaEfemera.religar();
      }
    },
    LIMITE_DO_CASO_COM_QUEDA_MS,
  );
});

// ---------------------------------------------------------------------------
// Leituras cruas do banco — sem `WHERE empresa_id`, com a empresa entrando pelo CONTEXTO
// ---------------------------------------------------------------------------

/** O que a leitura crua de uma conferência devolve: o identificador e se ela já fechou. */
interface ConferenciaCrua {
  readonly id: string;
  readonly concluida: boolean;
}

/**
 * As conferências da empresa informada, em ordem de início.
 *
 * Nenhum `WHERE empresa_id` é escrito aqui: quem recorta é a política (ADR-0008), e a empresa entra
 * pelo **contexto**, que é o mesmo mecanismo que a aplicação usa. Declarar a empresa observada é o
 * que torna a leitura vazia distinguível de *"a conferência não existe"*.
 */
async function conferenciasDe(empresaId: string): Promise<readonly ConferenciaCrua[]> {
  return await contextoDeTenant.executarCom(
    { empresaId },
    async () =>
      await acessoAoNegocio.emUnidadeDeTrabalho(
        async (tx) =>
          await tx<ConferenciaCrua[]>`
            SELECT id, (concluida_em IS NOT NULL) AS concluida
              FROM negocio.conferencia_bancaria
             ORDER BY iniciada_em, id
          `,
      ),
  );
}

/** O que a leitura crua de um lote devolve: o identificador e a competência que ele cobre. */
interface LoteCru {
  readonly id: string;
  readonly competencia: string;
}

/** Os lotes da empresa informada, em ordem de criação. Mesma disciplina de {@link conferenciasDe}. */
async function lotesDe(empresaId: string): Promise<readonly LoteCru[]> {
  return await contextoDeTenant.executarCom(
    { empresaId },
    async () =>
      await acessoAoNegocio.emUnidadeDeTrabalho(
        async (tx) =>
          await tx<LoteCru[]>`
            SELECT id, to_char(competencia, 'YYYY-MM-DD') AS competencia
              FROM negocio.emissao_em_lote
             ORDER BY criado_em, id
          `,
      ),
  );
}

// ---------------------------------------------------------------------------
// As filas
// ---------------------------------------------------------------------------

/**
 * As cargas das tarefas **em espera** na fila da emissão em lote, na ordem em que entraram.
 *
 * Em espera, e não "todas": nenhum processador é registrado por este arquivo, de modo que toda tarefa
 * enfileirada fica ali — e uma tarefa que sumisse desse estado seria, ela própria, um achado.
 */
async function tarefasDoLote(): Promise<readonly CargaDaEmissaoEmLote[]> {
  return await cargasEmEspera(sondaDoLote);
}

/** As cargas das tarefas em espera na fila da conferência. Mesma disciplina da irmã acima. */
async function tarefasDaConferencia(): Promise<readonly CargaDaConferenciaBancaria[]> {
  return await cargasEmEspera(sondaDaConferencia);
}

/** A leitura comum às duas sondas — escrita uma vez para que as duas ordenem do mesmo jeito. */
async function cargasEmEspera<C>(sonda: Queue<C, void>): Promise<readonly C[]> {
  const tarefas = await sonda.getJobs(['waiting', 'delayed', 'prioritized']);

  return tarefas
    .sort((uma, outra) => Number(uma.id ?? 0) - Number(outra.id ?? 0))
    .map((t) => t.data);
}

// ---------------------------------------------------------------------------
// HTTP
// ---------------------------------------------------------------------------

/** A mensagem canônica do `422` — literal, e não lida do SUT. */
const MENSAGEM_DE_REQUISICAO_INVALIDA = 'requisição inválida';

/** A mensagem canônica do `404` — literal, pela mesma razão. */
const MENSAGEM_DE_RECURSO_NAO_ENCONTRADO = 'recurso não encontrado';

/** Nome de campo que a recusa do corpo nomeia quando o Zod não tem caminho a dar. */
const CAMPO_DO_CORPO = 'corpo';

interface SessaoPublicada {
  readonly telas: readonly string[];
  readonly acoes: readonly string[];
}

interface ConferenciaPublicada {
  readonly id: string;
  readonly iniciadaEm: string;
  readonly concluidaEm: string | null;
  readonly iniciadaAgora: boolean;
}

interface LotePublicado {
  readonly id: string;
  readonly estado: string;
  readonly criadoEm: string;
}

interface EnvelopeDeErro {
  readonly codigo: string;
  readonly mensagem: string;
  readonly campo?: string;
  readonly detalhes?: unknown;
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
async function entrar(email: string): Promise<string> {
  const entrada = await pedir(ROTA_DE_ENTRADA, {
    metodo: 'POST',
    corpo: { email, password: SENHA_DA_CARGA },
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
