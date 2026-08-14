/**
 * A **fronteira com a biblioteca de fila** — o que a falha do servidor de fila deixa passar para
 * dentro da aplicação.
 *
 * ---------------------------------------------------------------------------
 * INVARIANTES
 * ---------------------------------------------------------------------------
 *
 * | Critério | Caso   | Invariante |
 * |---|---|---|
 * | §13.1 | CT-738 | **Companheiro positivo, e ele é o que torna o CT-739 falsificável**: o erro
 * |       |        | CRU que a biblioteca de fila rejeita carrega a **carga inteira da tarefa** em
 * |       |        | `command.args` — inclusive o segredo em claro —, e registrá-lo publica o
 * |       |        | segredo no journal. Sem esta metade, o CT-739 passaria por vacuidade no dia
 * |       |        | em que a biblioteca deixasse de anexar o comando, e ninguém saberia. |
 * | §13.1 | CT-739 | O que {@link ProdutorDeFila.enfileirarConfirmacao} rejeita é erro **próprio**:
 * |       |        | não tem propriedade própria alguma vinda da biblioteca, e a linha que o
 * |       |        | registrador emite a partir dele — na **mesma forma** que o `catch` de
 * |       |        | `ConfirmacaoDeEmailService.entregar` usa, `{ erro, empresaId, locatarioId }` —
 * |       |        | **não** contém o segredo, **contém** os dois identificadores e **preserva** o
 * |       |        | diagnóstico da falha original. |
 *
 * Rastreabilidade: `CA-09 → CT-738 (RN-11)`, `CA-09 → CT-739 (RN-11)`.
 *
 * ===========================================================================
 * O DEFEITO QUE ESTE ARQUIVO FECHA, e por que ele não era visível de dentro
 * ===========================================================================
 *
 * A carga da confirmação carrega o **segredo em claro** (§4.3 da tech spec), e a decisão de
 * carregá-lo tem como fundamento declarado a mitigação (b) da §13.1: *o segredo nunca é registrado*.
 * A cadeia que a desfazia, medida nesta base e não inferida:
 *
 *   1. a carga viaja como **argumento de comando** do servidor de fila (`job.data` serializado);
 *   2. a biblioteca de acesso anexa `err.command = { name, args }` a **qualquer** erro de resposta
 *      (`MISCONF`, `OOM`, `NOSCRIPT`, `LOADING`) e ao aborto por queda de conexão com comando em voo;
 *   3. a redação única de `@sysloc/shared` alcança chave sensível **pelo nome** — e `command` não
 *      casa radical nenhum — e cadeia de caracteres **pela forma de endereço** — e um JSON com o
 *      campo `segredo` não tem `?`, `&` nem `#` antes do nome, de modo que atravessa byte a byte.
 *
 * O resultado é o segredo em claro no journal, emitido pelo próprio `catch` que existe para
 * protegê-lo. A correção mora na **fronteira** (`apps/api/src/comum/produtor-de-fila.ts`), que é o
 * único ponto da aplicação que conhece a biblioteca — e é aqui que ela é medida, porque tapar o
 * ponto de registro cobriria um chamador e deixaria os outros, presentes e futuros, abertos.
 *
 * ===========================================================================
 * COMO A FALHA É PROVOCADA — servidor real, erro real, sem dublê
 * ===========================================================================
 *
 * Instância efêmera própria (ADR-0006) com o teto de memória baixado a {@link TETO_DE_MEMORIA_BYTES}
 * byte e a política `noeviction`: o servidor passa a recusar **toda escrita** com `OOM`, que é um
 * erro de **resposta** — exatamente a classe que carrega `command.args`. Dublar a biblioteca aqui
 * esvaziaria a prova: o que está sob medição é o que ELA anexa, e um dublê anexaria o que este
 * arquivo mandasse.
 *
 * ⚠️ **O `OOM` não é um cenário de laboratório neste produto**: o servidor de fila roda com registro
 * contínuo em disco ligado (invariante 8 do `CLAUDE.md`), e disco cheio produz `MISCONF Errors
 * writing to the AOF file`, que é a mesma classe de erro, pelo mesmo caminho.
 *
 * O aquecimento na montagem não é ornamento: ele carrega os scripts no servidor e cria os registros
 * de controle da fila **antes** do teto baixar, de modo que a falha medida seja a da tarefa nova, e
 * não a da preparação da biblioteca. Ele é também o controle do caminho feliz — se o produtor não
 * conseguisse enfileirar com o servidor saudável, a montagem falharia nomeando isso.
 */

import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  type CargaDaConfirmacao,
  criarLogger,
  FILA_DA_CONFIRMACAO,
  type Logger,
} from '@sysloc/shared';
import { Queue } from 'bullmq';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
// DÉBITO COM GATILHO — D28 · F0/T5 · gatilho JÁ DISPARADO (F1/T2, 2026-08-02)
// (NÃO é uma `DECISÃO FECHADA`: ele agenda uma mudança, não protege o código abaixo.)
// O QUÊ: os imports a seguir atravessam a fronteira de `@sysloc/shared` por CAMINHO DE ARQUIVO,
//        fora do `exports` e do `files` daquele manifesto. A dependência de workspace está
//        declarada, então não há dependência oculta; o que não existe é FRONTEIRA para o diretório
//        `test/` — e este arquivo é mais um a repetir o padrão.
// QUANDO FECHA: o gatilho já disparou e o fechamento segue pendente; ele é o mesmo de sempre —
//        declarar o subpath `"./test"` no manifesto e importar por `@sysloc/shared/test`, ou
//        extrair um `@sysloc/test-utils`.
// POR QUE NÃO AGORA: fechar exige editar os manifestos de dois pacotes e todos os consumidores,
//        nenhum deles no escopo desta task, e o índice de débitos do `CLAUDE.md`.
// ÍNDICE: docs/specs/features/fundacao-stack-nativa/v1/_run/run-report.md §2, D28
import {
  comandoFila,
  type FilaEfemera,
  redisEfemero,
} from '../../../packages/shared/test/redis-efemero.ts';
import { conectarProdutorDeFila, type ProdutorDeFila } from '../src/comum/produtor-de-fila.ts';

/** Limite da montagem: instância efêmera de fila, produtor real e o aquecimento. */
const LIMITE_DE_MONTAGEM_MS = 60_000;

/** Limite de um caso que fala com o servidor de fila algumas vezes. */
const LIMITE_CASO_MS = 30_000;

/**
 * O segredo sob observação — cadeia sentinela, e não um segredo de verdade.
 *
 * Ela é improvável o bastante para que uma ocorrência dela na linha registrada só possa ter vindo da
 * carga: é isso que faz `includes` ser asserção e não coincidência.
 */
const SEGREDO_SENTINELA = 'sentinela-do-segredo-em-claro-9f3c1a7b';

/** Os dois identificadores que a linha de `warn` do disparo carrega — e que devem sobreviver. */
const EMPRESA_DA_CARGA = '11111111-1111-4111-8111-111111111111';
const LOCATARIO_DA_CARGA = '22222222-2222-4222-8222-222222222222';

/**
 * Teto de memória imposto ao servidor durante a medição, em bytes.
 *
 * Um byte: qualquer instância já ocupa mais que isso, de modo que a recusa é imediata e não depende
 * de quanto o servidor tenha acumulado. A política `noeviction` acompanha porque, com política de
 * despejo, o servidor apagaria chaves em vez de recusar — e o erro que se quer medir não nasceria.
 */
const TETO_DE_MEMORIA_BYTES = 1;

/** O trecho do erro do servidor que precisa sobreviver à saneamento — mascarar não é apagar. */
const DIAGNOSTICO_DA_RECUSA = 'OOM';

let fila: FilaEfemera;
let produtor: ProdutorDeFila;
let logger: Logger;
let diretorioDeRegistro: string;
let arquivoDeRegistro: string;

/**
 * A fila CRUA — a biblioteca sem o produtor no meio.
 *
 * É ela que fornece o companheiro positivo do CT-738: o erro como a biblioteca o entrega, antes de
 * qualquer saneamento. Sem esta segunda instância, o caso teria de confiar na descrição do defeito
 * em vez de exibi-lo.
 */
let filaCrua: Queue<CargaDaConfirmacao, void>;

beforeAll(async () => {
  fila = await redisEfemero();

  diretorioDeRegistro = mkdtempSync(join(tmpdir(), 'sysloc-registro-produtor-'));
  arquivoDeRegistro = join(diretorioDeRegistro, 'produtor.log');
  // `trace` é o nível mais baixo do vocabulário do projeto: nenhuma linha é filtrada, e a asserção
  // de ausência do segredo alcança o registro inteiro.
  logger = criarLogger({ nivel: 'trace', destino: arquivoDeRegistro });

  produtor = conectarProdutorDeFila(fila.cadeiaConexao, logger);

  const endereco = new URL(fila.cadeiaConexao);
  filaCrua = new Queue<CargaDaConfirmacao, void>(FILA_DA_CONFIRMACAO, {
    connection: { host: endereco.hostname, port: Number.parseInt(endereco.port, 10) },
  });

  // O AQUECIMENTO — ver o cabeçalho. Ele é também o controle do caminho feliz.
  await produtor.enfileirarConfirmacao(cargaCom('aquecimento-pelo-produtor'));
  await filaCrua.add(FILA_DA_CONFIRMACAO, cargaCom('aquecimento-pela-fila-crua'));
}, LIMITE_DE_MONTAGEM_MS);

afterAll(async () => {
  // O teto volta ao normal ANTES de qualquer encerramento: fechar a fila com o servidor recusando
  // escrita deixaria o desligamento pendurado por um motivo que este arquivo criou.
  try {
    await comandoFila(fila.porta, 'CONFIG', 'SET', 'maxmemory', '0');
  } catch {
    // A instância já pode ter caído — o descarte abaixo é incondicional de qualquer forma.
  }

  await filaCrua?.close();
  await produtor?.encerrar();
  await fila?.parar();

  if (diretorioDeRegistro !== undefined) {
    rmSync(diretorioDeRegistro, { recursive: true, force: true });
  }
}, LIMITE_DE_MONTAGEM_MS);

describe('a fronteira com a biblioteca de fila (T9)', () => {
  it(
    'CT-738 — o erro CRU da biblioteca carrega a carga inteira, e registrá-lo publica o segredo',
    async () => {
      const carga = cargaCom(SEGREDO_SENTINELA);
      const erro = await sobMemoriaEsgotada(
        async () => await rejeicaoDe(filaCrua.add(FILA_DA_CONFIRMACAO, carga)),
      );

      expect(erro).toBeInstanceOf(Error);
      // A recusa é a que este arquivo diz provocar, e não uma qualquer: sem esta linha, uma falha
      // de conexão passaria pelo caso e a conclusão seria outra.
      expect((erro as Error).message).toContain(DIAGNOSTICO_DA_RECUSA);

      // A PROPRIEDADE ANEXADA PELA BIBLIOTECA, e o conteúdo dela — nunca a presença. A carga viaja
      // como argumento do comando, serializada, e é assim que ela chega ao objeto de exceção.
      const comando = (erro as { command?: { readonly args?: readonly unknown[] } }).command;
      expect(comando?.args).toContain(JSON.stringify(carga));

      // E o efeito terminal: a linha que o registrador emite a partir desse erro **contém** o
      // segredo. É esta asserção que prova que a do CT-739 pode falhar.
      logger.warn({ erro, marca: 'cru' }, 'a falha crua da biblioteca de fila');
      expect(linhaRegistrada('cru')).toContain(SEGREDO_SENTINELA);
    },
    LIMITE_CASO_MS,
  );

  it(
    'CT-739 — o que o produtor rejeita não leva o comando junto, e a linha do disparo não tem o segredo',
    async () => {
      const carga = cargaCom(SEGREDO_SENTINELA);
      const erro = await sobMemoriaEsgotada(
        async () => await rejeicaoDe(produtor.enfileirarConfirmacao(carga)),
      );

      expect(erro).toBeInstanceOf(Error);

      // (a) NENHUMA propriedade própria atravessa a fronteira do módulo. A igualdade com o conjunto
      //     vazio, e não a ausência de `command`: fechar só a chave conhecida deixaria passar a
      //     próxima que a biblioteca anexasse.
      expect(Object.keys(erro as object)).toEqual([]);

      // (b) A LINHA, na mesma forma que `ConfirmacaoDeEmailService.entregar` emite — é ela que vai
      //     para o journal, e é sobre ela que a §13.1 promete que o segredo nunca aparece.
      logger.warn(
        {
          erro,
          empresaId: EMPRESA_DA_CARGA,
          locatarioId: LOCATARIO_DA_CARGA,
          marca: 'saneado',
        },
        'a confirmação de e-mail foi gravada e não pôde ser enfileirada',
      );
      const linha = linhaRegistrada('saneado');

      expect(linha).not.toContain(SEGREDO_SENTINELA);
      // (c) Mascarar não é apagar: o diagnóstico da falha original sobrevive, ou o operador ficaria
      //     com uma linha que diz que algo falhou e não diz o quê.
      expect(linha).toContain(DIAGNOSTICO_DA_RECUSA);
      // (d) E os dois identificadores que permitem reenviar pela interface continuam na linha — a
      //     redação alcança o que denuncia segredo, e não o que identifica o cadastro.
      expect(linha).toContain(LOCATARIO_DA_CARGA);
      expect(linha).toContain(EMPRESA_DA_CARGA);
    },
    LIMITE_CASO_MS,
  );
});

// ---------------------------------------------------------------------------------------------
// Arranjo e observação
// ---------------------------------------------------------------------------------------------

/** Uma carga completa, com o segredo informado. */
function cargaCom(segredo: string): CargaDaConfirmacao {
  return { empresaId: EMPRESA_DA_CARGA, locatarioId: LOCATARIO_DA_CARGA, segredo };
}

/**
 * Executa o trabalho com o servidor de fila recusando toda escrita, e devolve o teto ao normal.
 *
 * O `finally` é o que impede um caso vermelho de deixar o servidor inutilizável para os seguintes —
 * a restauração não pode depender do desfecho da medição.
 */
async function sobMemoriaEsgotada<T>(trabalho: () => Promise<T>): Promise<T> {
  await comandoFila(fila.porta, 'CONFIG', 'SET', 'maxmemory-policy', 'noeviction');
  await comandoFila(fila.porta, 'CONFIG', 'SET', 'maxmemory', String(TETO_DE_MEMORIA_BYTES));

  try {
    return await trabalho();
  } finally {
    await comandoFila(fila.porta, 'CONFIG', 'SET', 'maxmemory', '0');
  }
}

/**
 * O motivo da rejeição da promessa informada.
 *
 * Escrito assim, e não com `rejects.toThrow`, porque o que os casos medem é o **objeto** rejeitado —
 * as propriedades que ele carrega e o que ele produz no registro —, e não apenas que houve rejeição.
 */
async function rejeicaoDe(promessa: Promise<unknown>): Promise<unknown> {
  return await promessa.then(
    () => {
      throw new Error('o enfileiramento foi ACEITO com o servidor de fila recusando escrita');
    },
    (motivo: unknown) => motivo,
  );
}

/**
 * A única linha do registro que carrega a marca informada.
 *
 * A unicidade é afirmada, e não suposta: duas linhas com a mesma marca fariam a asserção seguinte
 * medir a errada, e nada acusaria.
 */
function linhaRegistrada(marca: string): string {
  const linhas = readFileSync(arquivoDeRegistro, 'utf8')
    .split('\n')
    .filter((linha) => linha.includes(`"marca":"${marca}"`));

  expect(linhas).toHaveLength(1);

  return linhas[0] ?? '';
}
