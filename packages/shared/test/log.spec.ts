/**
 * Registro estruturado de eventos.
 *
 * Rastreabilidade: T3 §4 (registro estruturado, nível por ambiente, correlação por
 * requisição, campos sensíveis mascarados na origem) e CLAUDE.md invariante 3
 * → CT-006, CT-007, CT-008.
 * Rastreabilidade: T1/F1 §4 (terceiro eixo de redação, por forma do valor, que fecha o débito
 * D25) e CA-15 (nenhum segredo legível no registro interno) → CT-027, CT-028.
 * Rastreabilidade: T3/F4 §4 (três radicais novos no eixo do nome — `pfx`, `passphrase` e
 * `material` — e `certificado` deliberadamente fora) e CA-12 (nenhum segredo em registro, erro ou
 * diagnóstico) → CT-829.
 *
 * INVARIANTES
 * - CT-006: cada evento chega ao destino como uma linha JSON única e parseável, carregando o
 *   identificador de correlação recebido e o nível do evento — nunca texto livre.
 * - CT-007: com nível `warn`, evento `debug` não produz nenhuma linha; evento `warn` produz
 *   exatamente uma.
 * - CT-008: nenhum valor de campo sensível chega ao destino em forma legível — nem no primeiro
 *   nível, nem aninhado, nem dentro de objeto de erro, nem dentro de objeto que se auto-serializa
 *   por `toJSON` próprio —, e mascarar não silencia o evento. Também não chega em forma legível
 *   a senha embutida numa cadeia de conexão (`postgres://usuario:SEGREDO@host/banco`), seja ela
 *   uma cadeia de caracteres ou um `URL`, nem o conteúdo de um `Buffer`. A cadeia embutida na
 *   **mensagem** e na **pilha** de uma exceção também não chega — nem pelo campo do erro, nem
 *   pela chave de topo que o registrador promove a partir dela quando o chamador não informa
 *   mensagem própria (`logger.error({ err })` e `logger.error(err)`), nem pelas outras duas
 *   origens da mensagem (texto livre e interpolação).
 * - CT-008 (posição raiz): a garantia vale na **profundidade 0** — quando o portador não está
 *   sob uma chave e sim **é** o objeto do evento (`logger.info(buffer)`, `logger.info(url)`).
 *   Nem despejo de bytes em mapa de índices, nem evento reduzido ao envelope.
 * - CT-008 (não-mutilação): URL legítima **sem** credencial atravessa o registro byte a byte
 *   idêntica — inclusive a que traz `@` no query (`http://hospedeiro:porta?redirect=a@b`).
 *   Mascarar demais corrompe em silêncio o diagnóstico que o registro existe para preservar.
 * - CT-027: o VALOR de parâmetro de endereço cujo nome case um radical sensível não chega ao
 *   destino em forma legível — nem em campo, nem na mensagem, nem na pilha de uma exceção, nem
 *   na posição raiz —, enquanto o separador, o nome do parâmetro, o esquema, o hospedeiro, a
 *   porta, o caminho, o fragmento e os parâmetros não sensíveis atravessam intactos.
 * - CT-027 (delimitação de `code`): o radical `code` torna sensível o NOME DE UM PARÂMETRO de
 *   endereço e **nada além disso** — como chave do evento ele não mascara, e `statusCode` e
 *   `errorCode` chegam ao destino com o valor informado. As duas metades convivem no mesmo
 *   evento: sem a negativa, mover o radical para a lista de chaves não reprovaria nada.
 * - CT-829: chave cujo nome case `material`, `pfx` ou `passphrase` não chega ao destino em forma
 *   legível — nem no primeiro nível, nem aninhada, nem como propriedade própria de exceção, nem
 *   como vínculo de logger filho, nem como nome de parâmetro de endereço —, **e** o
 *   `certificadoId` do MESMO evento chega **com o valor**, porque `certificado` não é radical e a
 *   ausência dele é a decisão. As duas metades convivem no mesmo evento: sem a segunda, acrescentar
 *   `certificado` à lista cegaria o diagnóstico passando verde.
 * - CT-028: endereço legítimo, **sem** parâmetro sensível, atravessa byte a byte idêntico nas
 *   três posições — inclusive com `@`, `=` ou `?` no valor de um parâmetro inocente, e com
 *   `callbackURL`, que é alvo de retorno e não credencial. É o companheiro que cobre o endereço
 *   sem parâmetro sensível nenhum, que o CT-027 nunca emite.
 *
 * Fronteira real exercida: filesystem. O destino é um arquivo em diretório temporário próprio,
 * criado pelo caminho legítimo — o mesmo parâmetro `destino` que a unidade systemd usa em
 * operação. Nenhuma bandeira, nenhum ramo e nenhum símbolo existe aqui só para o teste.
 */

import { Buffer } from 'node:buffer';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { criarLogger, type Logger, type NivelDeLog } from '../src/log.js';

/** Sentinela com que o registro substitui o conteúdo de um campo sensível. */
const SENTINELA_REDIGIDO = '[REDIGIDO]';

/** Nome do arquivo de destino usado por todos os casos — um só, para não divergir. */
const ARQUIVO_DE_EVENTOS = 'eventos.log';

/**
 * Chaves que o envelope carimba em toda linha sem que o chamador peça. Serve para distinguir
 * "evento emitido" de "evento apagado": um evento que sai só com o envelope não vazou nada e
 * também não registrou nada.
 */
const CHAVES_DO_ENVELOPE: readonly string[] = ['nivel', 'time', 'pid', 'hostname'];

let diretorio: string;

beforeEach(async () => {
  diretorio = await mkdtemp(join(tmpdir(), 'sysloc-log-'));
});

afterEach(async () => {
  await rm(diretorio, { recursive: true, force: true });
});

/**
 * Aguarda o esvaziamento pelo mecanismo do próprio registrador — nunca por espera fixa.
 */
async function esvaziar(logger: Logger): Promise<void> {
  await new Promise<void>((resolver, rejeitar) => {
    logger.flush((erro) => {
      if (erro) {
        rejeitar(erro);
        return;
      }
      resolver();
    });
  });
}

function linhasNaoVazias(conteudo: string): string[] {
  return conteudo.split('\n').filter((linha) => linha.trim() !== '');
}

/**
 * Par destino/registrador que todo caso monta igual: arquivo no diretório temporário do caso,
 * criado pelo caminho legítimo — o mesmo parâmetro `destino` que a unidade systemd usa em
 * operação. Nenhuma bandeira de teste; o helper apenas evita repetir o literal do nome do
 * arquivo em cada caso, onde ele já divergiu por descuido.
 */
function loggerEmArquivo(nivel: NivelDeLog): { logger: Logger; destino: string } {
  const destino = join(diretorio, ARQUIVO_DE_EVENTOS);
  return { logger: criarLogger({ nivel, destino }), destino };
}

describe('CT-006 — evento registrado é linha JSON única com o identificador de correlação', () => {
  it('emite uma linha parseável carregando correlação, evento e nível', async () => {
    const { logger, destino } = loggerEmArquivo('info');

    logger.info({
      idCorrelacao: 'corr-abc-123',
      evento: 'requisicao_concluida',
      duracaoMs: 42,
    });
    await esvaziar(logger);

    const conteudo = await readFile(destino, 'utf8');
    const linhas = linhasNaoVazias(conteudo);
    expect(linhas).toHaveLength(1);

    const linha = linhas[0] as string;
    expect(linha).not.toContain('\n');
    expect(() => JSON.parse(linha)).not.toThrow();

    const evento = JSON.parse(linha) as Record<string, unknown>;
    expect(evento.idCorrelacao).toBe('corr-abc-123');
    expect(evento.evento).toBe('requisicao_concluida');
    expect(evento.duracaoMs).toBe(42);
    expect(evento.nivel).toBe('info');
  });

  it('carrega a correlação vinculada ao logger filho em todo evento derivado', async () => {
    const { logger, destino } = loggerEmArquivo('info');

    const daRequisicao = logger.child({ idCorrelacao: 'corr-abc-123' });
    const doHandler = daRequisicao.child({ rota: '/saude/pronto' });

    daRequisicao.info({ evento: 'requisicao_recebida' });
    doHandler.info({ evento: 'requisicao_concluida', duracaoMs: 42 });
    await esvaziar(logger);

    const linhas = linhasNaoVazias(await readFile(destino, 'utf8'));
    expect(linhas).toHaveLength(2);
    const [recebida, concluida] = linhas.map(
      (linha) => JSON.parse(linha) as Record<string, unknown>,
    );

    expect(recebida).toMatchObject({ idCorrelacao: 'corr-abc-123', evento: 'requisicao_recebida' });
    // O neto preserva o vínculo do pai: perder a correlação um nível abaixo tornaria o
    // identificador inútil justamente onde o evento interessa.
    expect(concluida).toMatchObject({
      idCorrelacao: 'corr-abc-123',
      rota: '/saude/pronto',
      evento: 'requisicao_concluida',
      duracaoMs: 42,
    });
  });
});

describe('CT-007 — evento abaixo do nível configurado não produz nenhuma linha', () => {
  it('descarta o evento debug e emite apenas o warn sob nível warn', async () => {
    const { logger, destino } = loggerEmArquivo('warn');

    logger.debug('mensagem-debug-nao-deve-sair');
    logger.warn('mensagem-warn-deve-sair');
    await esvaziar(logger);

    const conteudo = await readFile(destino, 'utf8');
    const linhas = linhasNaoVazias(conteudo);
    expect(linhas).toHaveLength(1);

    const evento = JSON.parse(linhas[0] as string) as Record<string, unknown>;
    expect(evento.nivel).toBe('warn');
    expect(evento.mensagem).toBe('mensagem-warn-deve-sair');

    expect(conteudo).not.toContain('mensagem-debug-nao-deve-sair');
    const niveis = linhas.map((linha) => (JSON.parse(linha) as Record<string, unknown>).nivel);
    expect(niveis).toEqual(['warn']);
  });
});

describe('CT-008 — segredo e dado pessoal registrados não chegam ao destino', () => {
  /**
   * Valores sentinela improváveis, para que a varredura por substring seja conclusiva.
   * O CPF traz também a forma sem pontuação: normalizar antes de mascarar é a regressão
   * que faria o dado pessoal escapar da varredura ingênua.
   */
  const camposSensiveis = [
    { chave: 'senha', valor: 'senha-NAO-VAZAR-9f3a', formasProibidas: ['senha-NAO-VAZAR-9f3a'] },
    {
      chave: 'authorization',
      valor: 'Bearer NAO-VAZAR-7d21',
      formasProibidas: ['Bearer NAO-VAZAR-7d21', 'NAO-VAZAR-7d21'],
    },
    { chave: 'token', valor: 'token-NAO-VAZAR-51bc', formasProibidas: ['token-NAO-VAZAR-51bc'] },
    {
      chave: 'senhaCertificado',
      valor: 'pfx-NAO-VAZAR-0e88',
      formasProibidas: ['pfx-NAO-VAZAR-0e88'],
    },
    {
      chave: 'cpf',
      valor: '529.982.247-25',
      formasProibidas: ['529.982.247-25', '52998224725'],
    },
  ];

  /**
   * As cinco portas por onde um campo entra numa linha: o objeto do evento, um objeto
   * aninhado dentro dele, uma exceção anexada, o vínculo de um logger filho — que é como
   * T5 vai carregar o contexto da requisição — e um objeto que traz **serializador próprio**.
   *
   * A quinta posição é a que o redator deixava passar: ele perguntava se o objeto tinha um
   * método `toJSON` e, em caso afirmativo, o devolvia intacto. Toda entidade de domínio que
   * ganhasse um serializador (o caso normal de uma entidade que precisa virar JSON) saía
   * inteira do alcance do mascaramento, com CPF e senha legíveis.
   *
   * As cinco põem o portador **sob** uma chave. A sexta — o portador **como** o objeto do
   * evento — tem tabela própria logo abaixo, porque nela o que varia não é a chave sensível
   * e sim o **tipo** do portador.
   */
  const posicoes = [
    'primeiro_nivel',
    'aninhado',
    'objeto_de_erro',
    'vinculo_do_filho',
    'objeto_com_toJSON',
  ] as const;
  type Posicao = (typeof posicoes)[number];

  const combinacoes = camposSensiveis.flatMap((campo) =>
    posicoes.map((posicao) => ({ ...campo, posicao })),
  );

  const EVENTO_BASE = { evento: 'tentativa_de_registro', idCorrelacao: 'corr-seguranca-1' };

  /** Nome preservado no objeto que se auto-serializa — mascarar não pode virar apagar. */
  const NOME_DO_LOCATARIO = 'Fulano de Tal';

  /**
   * Entidade de domínio com `toJSON` **próprio** (propriedade do objeto, não do protótipo) —
   * a forma exata que o duck-typing do redator reconhecia para devolver o objeto intacto.
   */
  function comSerializadorProprio(chave: string, valor: string): Record<string, unknown> {
    const dados: Record<string, unknown> = { nome: NOME_DO_LOCATARIO, [chave]: valor };
    return { ...dados, toJSON: () => dados };
  }

  function emitir(logger: Logger, posicao: Posicao, chave: string, valor: string): void {
    switch (posicao) {
      case 'primeiro_nivel':
        logger.info({ ...EVENTO_BASE, [chave]: valor });
        return;
      case 'aninhado':
        logger.info({ ...EVENTO_BASE, requisicao: { cabecalhos: { [chave]: valor } } });
        return;
      case 'objeto_de_erro':
        logger.info({
          ...EVENTO_BASE,
          err: Object.assign(new Error('falha ao autenticar no provedor'), { [chave]: valor }),
        });
        return;
      case 'vinculo_do_filho':
        logger.child({ [chave]: valor }).info(EVENTO_BASE);
        return;
      case 'objeto_com_toJSON':
        logger.info({ ...EVENTO_BASE, locatario: comSerializadorProprio(chave, valor) });
        return;
    }
  }

  function localizarPortador(evento: Record<string, unknown>, posicao: Posicao): unknown {
    if (posicao === 'aninhado') {
      return (evento.requisicao as Record<string, unknown>).cabecalhos;
    }
    if (posicao === 'objeto_de_erro') {
      return evento.err;
    }
    if (posicao === 'objeto_com_toJSON') {
      return evento.locatario;
    }
    return evento;
  }

  it.each(combinacoes)(
    '$chave em $posicao é mascarado sem silenciar o evento',
    async ({ chave, valor, formasProibidas, posicao }) => {
      const { logger, destino } = loggerEmArquivo('info');

      emitir(logger, posicao, chave, valor);
      await esvaziar(logger);

      const conteudo = await readFile(destino, 'utf8');
      for (const forma of formasProibidas) {
        expect(conteudo, `forma vazada: ${forma}`).not.toContain(forma);
      }
      expect(conteudo).not.toContain('NAO-VAZAR');

      const linhas = linhasNaoVazias(conteudo);
      expect(linhas).toHaveLength(1);
      const evento = JSON.parse(linhas[0] as string) as Record<string, unknown>;

      // Mascarar não pode virar silenciar: o evento continua sendo emitido, inteiro.
      expect(evento.evento).toBe('tentativa_de_registro');
      expect(evento.idCorrelacao).toBe('corr-seguranca-1');

      const portador = localizarPortador(evento, posicao) as Record<string, unknown>;
      expect(portador[chave]).toBe(SENTINELA_REDIGIDO);

      if (posicao === 'objeto_com_toJSON') {
        // Descer no objeto não pode custar o resto do conteúdo: mascarar não é apagar.
        expect(portador.nome).toBe(NOME_DO_LOCATARIO);
      }
    },
  );

  /**
   * A **sexta posição** — e a única em que o portador não está SOB uma chave: ele **é** o
   * objeto do evento (`logger.info(portador)`), a profundidade 0.
   *
   * As cinco posições da tabela acima põem o portador debaixo de uma chave, e por isso todas
   * exercitam o despacho por tipo a partir do segundo nível. A profundidade 0 ficava fora:
   * o ponto de entrada dos campos entregava o objeto do chamador direto ao copiador de
   * chaves, pulando o despacho — e com ele a lista fechada de tipos, o mascaramento por
   * forma do valor e o guarda de ciclo. Três consequências confirmadas por sonda contra o
   * artefato compilado:
   *
   * - `Buffer` e `Uint8Array` saíam como **mapa de índices** (`{"0":80,"1":70,…}`) — os bytes
   *   inteiros, que é exatamente o despejo do `.pfx` que a posição aninhada já persegue;
   * - `URL` credenciada e `Date` **apagavam o evento**: a linha saía só com o envelope,
   *   porque o copiador de chaves não encontra chave própria enumerável em nenhum dos dois;
   * - vetor virava mapa de índices, perdendo a forma de vetor.
   *
   * O controle (objeto comum) existe para provar que fechar a profundidade 0 não mudou o
   * caminho normal: evento de campos continua saindo com os campos no topo, sem embrulho.
   */
  describe('posição raiz — o portador é o próprio objeto do evento', () => {
    const CERTIFICADO = Buffer.from('PFX-NAO-VAZAR-0e88-conteudo-do-certificado');
    const VETOR_DE_BYTES = new Uint8Array([80, 70, 88, 45, 78, 65, 79]);
    const MOMENTO = new Date('2026-07-31T12:00:00.000Z');
    const CADEIA_RAIZ = 'postgres://sysloc:RAIZ-NAO-VAZAR-9d40@localhost:5432/sysloc';
    const CADEIA_RAIZ_MASCARADA = `postgres://sysloc:${SENTINELA_REDIGIDO}@localhost:5432/sysloc`;

    const naRaiz = [
      {
        forma: 'Buffer — resumido em forma e tamanho, nunca despejado em bytes',
        emitir: (logger: Logger) => logger.info(CERTIFICADO),
        verificar: (evento: Record<string, unknown>) => {
          expect(evento).toMatchObject({ tipo: 'Buffer', bytes: CERTIFICADO.byteLength });
        },
      },
      {
        forma: 'Uint8Array — mesma visão de memória, mesmo resumo',
        emitir: (logger: Logger) => logger.info(VETOR_DE_BYTES),
        verificar: (evento: Record<string, unknown>) => {
          expect(evento).toMatchObject({ tipo: 'Uint8Array', bytes: VETOR_DE_BYTES.byteLength });
        },
      },
      {
        forma: 'URL credenciada — credencial mascarada, evento preservado',
        emitir: (logger: Logger) => logger.info(new URL(CADEIA_RAIZ)),
        verificar: (evento: Record<string, unknown>) => {
          expect(evento.valor).toBe(CADEIA_RAIZ_MASCARADA);
        },
      },
      {
        forma: 'Date — representação própria preservada, evento não apagado',
        emitir: (logger: Logger) => logger.info(MOMENTO),
        verificar: (evento: Record<string, unknown>) => {
          expect(evento.valor).toBe(MOMENTO.toISOString());
        },
      },
      {
        forma: 'vetor — segue vetor, com a cadeia de conexão mascarada item a item',
        emitir: (logger: Logger) => logger.info(['inicio', CADEIA_RAIZ]),
        verificar: (evento: Record<string, unknown>) => {
          expect(evento.valor).toEqual(['inicio', CADEIA_RAIZ_MASCARADA]);
        },
      },
      {
        forma: 'objeto comum (controle) — campos no topo, sem embrulho, chave sensível mascarada',
        emitir: (logger: Logger) =>
          logger.info({ ...EVENTO_BASE, senha: 'raiz-NAO-VAZAR-e5f6', nome: NOME_DO_LOCATARIO }),
        verificar: (evento: Record<string, unknown>) => {
          expect(evento).toMatchObject({
            evento: 'tentativa_de_registro',
            idCorrelacao: 'corr-seguranca-1',
            senha: SENTINELA_REDIGIDO,
            nome: NOME_DO_LOCATARIO,
          });
          // Não-regressão do caminho normal: registro de campos não ganha chave de embrulho.
          expect('valor' in evento).toBe(false);
        },
      },
    ] as const;

    it.each(naRaiz)('$forma', async ({ emitir: emitirNaRaiz, verificar }) => {
      const { logger, destino } = loggerEmArquivo('info');

      emitirNaRaiz(logger);
      await esvaziar(logger);

      const conteudo = await readFile(destino, 'utf8');
      expect(conteudo).not.toContain('NAO-VAZAR');

      const linhas = linhasNaoVazias(conteudo);
      expect(linhas).toHaveLength(1);
      const evento = JSON.parse(linhas[0] as string) as Record<string, unknown>;

      // Despejo de bytes e vetor achatado saem como chaves numéricas — a forma exata em que
      // o conteúdo de um `.pfx` escaparia da varredura por texto.
      const chavesDeIndice = Object.keys(evento).filter((chave) => /^\d+$/.test(chave));
      expect(chavesDeIndice, 'evento saiu como mapa de índices').toEqual([]);

      // Mascarar não é apagar: sobrar só o envelope é perder o evento inteiro.
      const conteudoProprio = Object.keys(evento).filter(
        (chave) => !CHAVES_DO_ENVELOPE.includes(chave),
      );
      expect(conteudoProprio.length, 'evento apagado: sobrou só o envelope').toBeGreaterThan(0);

      verificar(evento);
    });
  });

  /**
   * O nome do campo raramente é o radical puro. `novaSenha` é o nome natural do campo de troca
   * de senha que T5/T6 introduzem; `senhaDoBanco` e `senha-atual` são as variantes vizinhas.
   * Casar a chave por igualdade exata deixava as três saírem legíveis enquanto `senha` era
   * mascarada — a assimetria de custo decide: falso positivo mascara campo inócuo, falso
   * negativo vaza.
   */
  it('mascara a chave sensível em qualquer composição do nome, não só na forma exata', async () => {
    const { logger, destino } = loggerEmArquivo('info');

    const variantes = {
      novaSenha: 'nova-NAO-VAZAR-a1',
      senhaDoBanco: 'banco-NAO-VAZAR-b2',
      'senha-atual': 'atual-NAO-VAZAR-c3',
      apiSecret: 'segredo-NAO-VAZAR-d4',
      numeroCpf: '529.982.247-25',
      // Cookie de sessão: a forma em que o better-auth (stack declarada no CLAUDE.md) carrega
      // a credencial. `set-cookie` é a grafia do cabeçalho de resposta; `idSessao` e
      // `sessionId` são as duas grafias em que o identificador nasce — a biblioteca fala
      // inglês, o produto fala português.
      cookie: 'cookie-NAO-VAZAR-e5',
      'set-cookie': 'setcookie-NAO-VAZAR-f6',
      idSessao: 'sessao-NAO-VAZAR-a7',
      sessionId: 'session-NAO-VAZAR-b8',
    };

    logger.info({ ...EVENTO_BASE, ...variantes });
    await esvaziar(logger);

    const conteudo = await readFile(destino, 'utf8');
    expect(conteudo).not.toContain('NAO-VAZAR');
    expect(conteudo).not.toContain('529.982.247-25');

    const evento = JSON.parse(linhasNaoVazias(conteudo)[0] as string) as Record<string, unknown>;
    for (const chave of Object.keys(variantes)) {
      expect(evento[chave], `chave não mascarada: ${chave}`).toBe(SENTINELA_REDIGIDO);
    }
    // Mascarar não pode virar mascarar tudo: campo inócuo do mesmo evento sobrevive.
    expect(evento.evento).toBe('tentativa_de_registro');
    expect(evento.idCorrelacao).toBe('corr-seguranca-1');
  });

  /**
   * A senha do PostgreSQL deste projeto não chega ao registro sob uma chave chamada `senha`:
   * ela chega dentro de `DATABASE_URL`, cujo formato o `.env.example` versionado documenta
   * como `postgres://USUARIO:SEGREDO@HOSPEDEIRO:PORTA/BANCO`. O mesmo vale para `REDIS_URL`.
   * Casar apenas o nome da chave nunca alcançaria essa forma — o log de partida do processo
   * ("conectado a X") é exatamente onde ela aparece.
   */
  it('mascara a senha embutida em cadeia de conexão, sob chave que não a denuncia', async () => {
    const { logger, destino } = loggerEmArquivo('info');

    logger.info({
      ...EVENTO_BASE,
      databaseUrl: 'postgres://sysloc:BANCO-NAO-VAZAR-2f70@localhost:5432/sysloc',
      redisUrl: 'redis://default:FILA-NAO-VAZAR-8b13@localhost:6379',
    });
    await esvaziar(logger);

    const conteudo = await readFile(destino, 'utf8');
    expect(conteudo).not.toContain('BANCO-NAO-VAZAR-2f70');
    expect(conteudo).not.toContain('FILA-NAO-VAZAR-8b13');
    expect(conteudo).not.toContain('NAO-VAZAR');

    const evento = JSON.parse(linhasNaoVazias(conteudo)[0] as string) as Record<string, unknown>;
    // Esquema, usuário, hospedeiro e banco sobrevivem: sai a senha, não o diagnóstico.
    expect(evento.databaseUrl).toBe(
      `postgres://sysloc:${SENTINELA_REDIGIDO}@localhost:5432/sysloc`,
    );
    expect(evento.redisUrl).toBe(`redis://default:${SENTINELA_REDIGIDO}@localhost:6379`);
  });

  it('mascara a credencial de um URL, que se auto-serializa com usuário e senha', async () => {
    const { logger, destino } = loggerEmArquivo('info');

    logger.info({
      ...EVENTO_BASE,
      bancoUrl: new URL('postgres://sysloc:URL-NAO-VAZAR-4c19@localhost:5432/sysloc'),
    });
    await esvaziar(logger);

    const conteudo = await readFile(destino, 'utf8');
    expect(conteudo).not.toContain('URL-NAO-VAZAR-4c19');
    expect(conteudo).not.toContain('NAO-VAZAR');

    const evento = JSON.parse(linhasNaoVazias(conteudo)[0] as string) as Record<string, unknown>;
    expect(evento.bancoUrl).toBe(`postgres://sysloc:${SENTINELA_REDIGIDO}@localhost:5432/sysloc`);
  });

  it('resume Buffer em forma e tamanho em vez de despejar os bytes', async () => {
    const { logger, destino } = loggerEmArquivo('info');

    // O caminho pelo qual o `.pfx` do Sicoob (CLAUDE.md, invariante 3) sairia inteiro.
    const certificado = Buffer.from('PFX-NAO-VAZAR-0e88-conteudo-do-certificado');
    logger.info({ ...EVENTO_BASE, certificado });
    await esvaziar(logger);

    const conteudo = await readFile(destino, 'utf8');
    expect(conteudo).not.toContain('NAO-VAZAR');
    // O despejo padrão de um Buffer é `{"type":"Buffer","data":[…]}` — os bytes, inteiros.
    // A varredura por texto não o pegaria; a varredura pela sequência de bytes pega.
    expect(conteudo).not.toContain([...certificado].join(','));

    const evento = JSON.parse(linhasNaoVazias(conteudo)[0] as string) as Record<string, unknown>;
    expect(evento.certificado).toEqual({ tipo: 'Buffer', bytes: certificado.byteLength });
  });

  /**
   * O caso mais canônico que existe: a falha de conexão carrega a cadeia inteira — com senha —
   * dentro da **mensagem** da exceção, e não sob chave nenhuma.
   *
   * Por que este caso precisa existir, e por que o `objeto_de_erro` da tabela acima não o
   * substitui: aquela posição anexa o valor sentinela como propriedade **própria** da exceção e
   * usa mensagem inócua, de modo que o segredo nunca entra na `message`. As duas linhas de
   * `redigirErro` que mascaram `erro.message` e `erro.stack` ficavam, por isso, sem nenhuma
   * asserção capaz de reprová-las — removê-las mantinha a suíte inteira verde.
   *
   * As duas formas de chamada são exercitadas de propósito. Sem mensagem própria, o registrador
   * **promove** `erro.message` para a chave de topo por uma rota de montagem que não é a dos
   * campos: quem fecha apenas os campos deixa a linha sair com o campo do erro mascarado e a
   * mensagem de topo crua — vazamento silencioso e dependente do estilo de chamada.
   *
   * A promoção é **uma** das três origens da mensagem; as outras duas — texto livre e
   * interpolação — têm caso próprio ao final deste bloco. Sem ele, duas das três origens que
   * o cabeçalho de `log.ts` declara cobrir ficavam sem falsificador: remover o interceptador
   * da chave da mensagem continuaria reprovando (pela promoção), mas trocá-lo por um que só
   * tratasse a promoção passaria limpo.
   */
  describe('cadeia de conexão embutida na mensagem do evento', () => {
    const CADEIA_CRUA = 'postgres://sysloc:MSG-NAO-VAZAR-3e57@127.0.0.1:5432/sysloc';
    const CADEIA_MASCARADA = `postgres://sysloc:${SENTINELA_REDIGIDO}@127.0.0.1:5432/sysloc`;
    const TEXTO_CRU = `connect ECONNREFUSED ${CADEIA_CRUA}`;
    const TEXTO_MASCARADO = `connect ECONNREFUSED ${CADEIA_MASCARADA}`;

    const formasDeChamada = [
      {
        forma: 'logger.error({ err })',
        emitir: (logger: Logger, erro: Error) => logger.error({ ...EVENTO_BASE, err: erro }),
      },
      {
        forma: 'logger.error(err)',
        emitir: (logger: Logger, erro: Error) => logger.error(erro),
      },
    ] as const;

    it.each(formasDeChamada)(
      'não deixa a senha sair por $forma, nem no campo nem na mensagem promovida',
      async ({ emitir }) => {
        const { logger, destino } = loggerEmArquivo('info');

        emitir(logger, new Error(TEXTO_CRU));
        await esvaziar(logger);

        const conteudo = await readFile(destino, 'utf8');
        // A varredura é sobre o conteúdo INTEGRAL do arquivo — não sobre um campo escolhido.
        // Asserir só `err.mensagem` era exatamente o que deixava a mensagem promovida passar.
        expect(conteudo).not.toContain('MSG-NAO-VAZAR-3e57');
        expect(conteudo).not.toContain('NAO-VAZAR');

        const evento = JSON.parse(linhasNaoVazias(conteudo)[0] as string) as Record<
          string,
          unknown
        >;

        // Mascarar não é apagar: o diagnóstico (esquema, usuário, hospedeiro, porta, banco e a
        // causa da falha) sobrevive inteiro nas duas rotas — sai a senha, não o diagnóstico.
        expect(evento.mensagem).toBe(TEXTO_MASCARADO);
        const erroRegistrado = evento.err as Record<string, unknown>;
        expect(erroRegistrado.mensagem).toBe(TEXTO_MASCARADO);
      },
    );

    /**
     * Companheiro do vetor acima, isolando a segunda linha de `redigirErro`: aqui a mensagem é
     * inócua e a cadeia vive **só na pilha**. Sem este caso, `saida.pilha = erro.stack` (sem
     * mascaramento) permaneceria sem falsificador próprio.
     */
    it('não deixa a senha sair pela pilha da exceção', async () => {
      const { logger, destino } = loggerEmArquivo('info');

      const erro = new Error('falha ao abrir conexão');
      erro.stack = [
        'Error: falha ao abrir conexão',
        '    at conectar (/opt/sysloc/src/banco.ts:12:9)',
        `    at abrirPool [postgres://sysloc:PILHA-NAO-VAZAR-6a2c@127.0.0.1:5432/sysloc]`,
      ].join('\n');

      logger.error({ ...EVENTO_BASE, err: erro }, 'falha ao abrir conexão');
      await esvaziar(logger);

      const conteudo = await readFile(destino, 'utf8');
      expect(conteudo).not.toContain('PILHA-NAO-VAZAR-6a2c');
      expect(conteudo).not.toContain('NAO-VAZAR');

      const evento = JSON.parse(linhasNaoVazias(conteudo)[0] as string) as Record<string, unknown>;
      const erroRegistrado = evento.err as Record<string, unknown>;
      // A pilha continua legível como pilha — o quadro segue lá, só sem a senha.
      expect(erroRegistrado.pilha).toContain('at conectar (/opt/sysloc/src/banco.ts:12:9)');
      expect(erroRegistrado.pilha).toContain(
        `at abrirPool [postgres://sysloc:${SENTINELA_REDIGIDO}@127.0.0.1:5432/sysloc]`,
      );
    });

    /**
     * As outras duas origens da mensagem, sem exceção nenhuma envolvida: **texto livre** e
     * **interpolação**. São as formas do log de partida do processo ("conectado a X"), que é
     * onde a cadeia de conexão aparece primeiro na vida do serviço.
     *
     * Elas atravessam a mesma rota de escrita da mensagem promovida, mas não passavam por
     * asserção nenhuma: o cabeçalho de `log.ts` prometia as três e a suíte falsificava uma.
     */
    /**
     * `AggregateError` é a forma em que a falha de conexão chega quando o resolvedor tentou
     * vários endereços: a cadeia — com senha — vive na mensagem de **cada sub-erro**, e não na
     * do agregado. Os sub-erros ficam em `.errors`, propriedade própria mas **não-enumerável**,
     * que a varredura por `Object.keys` não alcança: sem tratamento explícito eles eram
     * descartados em silêncio, e o registro perdia exatamente o que explica a falha.
     */
    it('preserva os sub-erros de um AggregateError, já mascarados', async () => {
      const { logger, destino } = loggerEmArquivo('info');

      const agregado = new AggregateError(
        [new Error(`connect ECONNREFUSED ${CADEIA_CRUA}`), new Error('connect ETIMEDOUT')],
        'nenhum endereço respondeu',
      );

      logger.error({ ...EVENTO_BASE, err: agregado }, 'falha ao abrir conexão');
      await esvaziar(logger);

      const conteudo = await readFile(destino, 'utf8');
      expect(conteudo).not.toContain('NAO-VAZAR');

      const evento = JSON.parse(linhasNaoVazias(conteudo)[0] as string) as Record<string, unknown>;
      const erroRegistrado = evento.err as Record<string, unknown>;
      const subErros = erroRegistrado.erros as Array<Record<string, unknown>>;

      // Mascarar não é apagar: os dois sub-erros seguem lá, com o diagnóstico legível.
      expect(subErros).toHaveLength(2);
      expect(subErros[0]?.mensagem).toBe(`connect ECONNREFUSED ${CADEIA_MASCARADA}`);
      expect(subErros[1]?.mensagem).toBe('connect ETIMEDOUT');
    });

    it.each([
      {
        forma: 'texto livre',
        emitir: (logger: Logger) => logger.info(`conectado a ${CADEIA_CRUA}`),
      },
      {
        forma: 'interpolação',
        emitir: (logger: Logger) => logger.info('conectado a %s', CADEIA_CRUA),
      },
    ])('não deixa a senha sair pela mensagem montada por $forma', async ({ emitir }) => {
      const { logger, destino } = loggerEmArquivo('info');

      emitir(logger);
      await esvaziar(logger);

      const conteudo = await readFile(destino, 'utf8');
      expect(conteudo).not.toContain('MSG-NAO-VAZAR-3e57');
      expect(conteudo).not.toContain('NAO-VAZAR');

      const evento = JSON.parse(linhasNaoVazias(conteudo)[0] as string) as Record<string, unknown>;
      // Mascarar não é apagar: a mensagem continua dizendo a que serviço o processo se ligou.
      expect(evento.mensagem).toBe(`conectado a ${CADEIA_MASCARADA}`);
    });
  });

  /**
   * Companheiro negativo do mascaramento por forma do valor: **não-mutilação**.
   *
   * O padrão que reconhece a credencial não pode destruir URL legítima. O caso que motivou este
   * companheiro é o da autoridade seguida direto de query: `http://hospedeiro:porta?p=a@b` casava
   * `hospedeiro` como usuário e `porta?p=a` como senha, saindo como `http://hospedeiro:[REDIGIDO]@b`
   * — perdia a porta, perdia o parâmetro e inventava um hospedeiro. Não vaza nada; corrompe em
   * silêncio o diagnóstico que o registro existe para preservar. O formato é o normal do fluxo de
   * autenticação (URL de retorno com `redirect=`/`callbackURL=`).
   *
   * Sem este companheiro, qualquer aperto futuro do padrão volta a passar despercebido.
   */
  it('não mutila URL legítima sem credencial — ela atravessa byte a byte idêntica', async () => {
    const { logger, destino } = loggerEmArquivo('info');

    const intactas = {
      comQueryCarregandoArroba: 'http://localhost:8080?redirect=user@example.com',
      comFragmentoCarregandoArroba: 'https://app.exemplo.com:8443?callbackURL=x#a@b',
      comPortaECaminho: 'https://api.sicoob.com.br:443/cobranca',
      comCaminhoSemPorta: 'https://api.exemplo.com/v1/recursos',
      comEmailNoTexto: 'falar com suporte@sicoob.com.br sobre https://api.sicoob.com.br:443/erro',
    };

    logger.info({ ...EVENTO_BASE, ...intactas });
    await esvaziar(logger);

    const conteudo = await readFile(destino, 'utf8');
    expect(conteudo).not.toContain(SENTINELA_REDIGIDO);

    const evento = JSON.parse(linhasNaoVazias(conteudo)[0] as string) as Record<string, unknown>;
    for (const [chave, original] of Object.entries(intactas)) {
      expect(evento[chave], `URL mutilada em ${chave}`).toBe(original);
    }
  });
});

/**
 * O terceiro eixo da redação — **o valor de parâmetro de endereço** —, que fecha o débito D25.
 *
 * O que os dois eixos anteriores não alcançam: `?token=SEGREDO` dentro de uma cadeia de
 * caracteres. O eixo por nome casa **chaves** do evento, e aqui o par `nome=valor` vive dentro
 * de um texto; o eixo da cadeia de conexão casa `usuario:senha@`, que não é esta forma. O
 * vazamento não é hipotético: foi medido no journal, e saiu **quatro vezes numa linha só** pela
 * mensagem que o arcabouço monta para rota não casada interpolando o alvo bruto.
 *
 * Por que a matriz cobre as QUATRO posições em vez de só o campo: a classe já reapareceu por
 * posição nova quatro vezes neste repositório, sempre com a correção anterior fechando com
 * precisão o caminho apontado. Cobrir só o campo repetiria esse padrão.
 *
 * CT-027 e CT-028 são o par positivo/negativo do MESMO predicado, e nenhum dos dois vale
 * sozinho. O que cada um pega, medido com o eixo mutilado numa cópia: um padrão largo demais
 * (que redija QUALQUER parâmetro) reprova os dois — o CT-027 pela igualdade literal, que inclui
 * os parâmetros inocentes de cada endereço. O que só o CT-028 alcança é o endereço **sem
 * parâmetro sensível nenhum**, que o CT-027 nunca emite: é ali que moram `callbackURL`, o `@` do
 * destino e o `?` dentro de um valor inocente — as três formas em que um aperto do padrão
 * mutilaria endereço legítimo sem que caso positivo algum percebesse.
 */
describe('CT-027 — valor de parâmetro sensível em endereço é redigido, com o nome preservado', () => {
  const EVENTO_BASE = { evento: 'rota_nao_encontrada', idCorrelacao: 'corr-seguranca-27' };
  const HOSPEDEIRO = 'https://app.exemplo.com:8443';
  const ALVO = `${HOSPEDEIRO}/entrar`;

  /**
   * Um portador por forma em que o parâmetro sensível aparece no endereço. Os valores são
   * sentinela improvável — e não `123456`/`abc` como um literal curto —, porque a varredura é
   * por substring sobre o arquivo inteiro: um literal curto pode coincidir com o horário ISO ou
   * com o PID do envelope e tornar o caso instável exatamente na asserção que mais importa.
   *
   * O par `endereco`/`redigido` é escrito **literalmente** nos dois lados de propósito: derivar
   * o esperado com um `replace` no próprio caso reimplementaria o SUT dentro do teste, e um
   * defeito compartilhado passaria despercebido pelos dois.
   */
  const portadores = [
    {
      portador: 'token na consulta, com parâmetro inocente ao lado',
      endereco: `${ALVO}?token=TOKEN-NAO-VAZAR-7b41&estado=ok`,
      redigido: `${ALVO}?token=${SENTINELA_REDIGIDO}&estado=ok`,
      segredo: 'TOKEN-NAO-VAZAR-7b41',
      parametroRedigido: `token=${SENTINELA_REDIGIDO}`,
      parametroIntacto: 'estado=ok',
    },
    {
      portador: 'code — o código de autorização, credencial de uso único do fluxo OAuth',
      endereco: `${ALVO}?code=CODE-NAO-VAZAR-51bc&pagina=2`,
      redigido: `${ALVO}?code=${SENTINELA_REDIGIDO}&pagina=2`,
      segredo: 'CODE-NAO-VAZAR-51bc',
      parametroRedigido: `code=${SENTINELA_REDIGIDO}`,
      parametroIntacto: 'pagina=2',
    },
    {
      portador: 'SECRET em caixa alta, no segundo parâmetro — a grafia não decide o casamento',
      endereco: `${ALVO}?pagina=2&SECRET=SEG-NAO-VAZAR-0e88`,
      redigido: `${ALVO}?pagina=2&SECRET=${SENTINELA_REDIGIDO}`,
      segredo: 'SEG-NAO-VAZAR-0e88',
      parametroRedigido: `SECRET=${SENTINELA_REDIGIDO}`,
      parametroIntacto: 'pagina=2',
    },
    {
      portador: 'senha com fragmento logo após o valor — o `#` encerra o valor, e sobrevive',
      endereco: `${ALVO}?estado=ok&senha=PWD-NAO-VAZAR-a1f0#secao`,
      redigido: `${ALVO}?estado=ok&senha=${SENTINELA_REDIGIDO}#secao`,
      segredo: 'PWD-NAO-VAZAR-a1f0',
      parametroRedigido: `senha=${SENTINELA_REDIGIDO}`,
      parametroIntacto: 'estado=ok',
    },
    {
      portador: 'access_token no fragmento — a mesma forma fora da cadeia de consulta',
      endereco: `${ALVO}#access_token=FRAG-NAO-VAZAR-c3d9&estado=ok`,
      redigido: `${ALVO}#access_token=${SENTINELA_REDIGIDO}&estado=ok`,
      segredo: 'FRAG-NAO-VAZAR-c3d9',
      parametroRedigido: `access_token=${SENTINELA_REDIGIDO}`,
      parametroIntacto: 'estado=ok',
    },
  ] as const;

  /** A mensagem que o arcabouço monta para rota não casada — a forma exata do vazamento medido. */
  const comoMensagem = (endereco: string): string => `Cannot GET ${endereco}`;

  const comoPilha = (endereco: string): string =>
    [
      'Error: rota não encontrada',
      '    at despachar (/opt/sysloc/apps/api/src/roteador.ts:31:7)',
      `    at alvo [${endereco}]`,
    ].join('\n');

  /**
   * As quatro posições em que o endereço chega à linha. A raiz usa `URL` porque é o portador de
   * endereço na **profundidade 0**: uma cadeia de caracteres passada sozinha vira mensagem, e
   * essa rota já é a segunda posição desta tabela.
   */
  const posicoes = [
    {
      posicao: 'campo',
      montar: (endereco: string) => endereco,
      emitir: (logger: Logger, endereco: string) => logger.info({ ...EVENTO_BASE, alvo: endereco }),
      extrair: (evento: Record<string, unknown>) => evento.alvo,
    },
    {
      posicao: 'mensagem',
      montar: comoMensagem,
      emitir: (logger: Logger, endereco: string) => logger.info(comoMensagem(endereco)),
      extrair: (evento: Record<string, unknown>) => evento.mensagem,
    },
    {
      posicao: 'pilha_de_excecao',
      montar: comoPilha,
      emitir: (logger: Logger, endereco: string) => {
        const erro = new Error('rota não encontrada');
        erro.stack = comoPilha(endereco);
        logger.error({ ...EVENTO_BASE, err: erro }, 'rota não encontrada');
      },
      extrair: (evento: Record<string, unknown>) => (evento.err as Record<string, unknown>).pilha,
    },
    {
      posicao: 'raiz',
      montar: (endereco: string) => endereco,
      emitir: (logger: Logger, endereco: string) => logger.info(new URL(endereco)),
      extrair: (evento: Record<string, unknown>) => evento.valor,
    },
  ] as const;

  const combinacoes = portadores.flatMap((portador) =>
    posicoes.map((posicao) => ({ ...portador, ...posicao })),
  );

  it.each(combinacoes)(
    '$portador — em $posicao',
    async ({
      endereco,
      redigido,
      segredo,
      parametroRedigido,
      parametroIntacto,
      montar,
      emitir,
      extrair,
    }) => {
      const { logger, destino } = loggerEmArquivo('info');

      emitir(logger, endereco);
      await esvaziar(logger);

      const conteudo = await readFile(destino, 'utf8');
      // A varredura é sobre o arquivo INTEIRO, não sobre o campo escolhido: foi asserir só o
      // campo que deixou a mensagem promovida vazar em silêncio na fatia anterior.
      expect(conteudo, `segredo vazado: ${segredo}`).not.toContain(segredo);
      expect(conteudo).not.toContain('NAO-VAZAR');

      const linhas = linhasNaoVazias(conteudo);
      expect(linhas).toHaveLength(1);
      const evento = JSON.parse(linhas[0] as string) as Record<string, unknown>;

      const extraido = extrair(evento);

      // ORDEM DELIBERADA: as asserções nomeadas vêm ANTES da igualdade literal. O Vitest aborta
      // o caso no primeiro `expect` que falha — postas depois do `toBe`, que já as implica
      // caractere a caractere, elas nunca chegariam a ser avaliadas e seriam decorativas. Nesta
      // posição cada uma reprova sozinha, com a mensagem que nomeia a metade quebrada; sem elas,
      // uma falha diria apenas "cadeias diferentes".
      expect(String(extraido), 'nome do parâmetro perdido').toContain(parametroRedigido);
      expect(String(extraido), 'parâmetro inocente mutilado').toContain(parametroIntacto);

      // Mascarar não é apagar: a linha continua carregando o evento, não só o envelope.
      const conteudoProprio = Object.keys(evento).filter(
        (chave) => !CHAVES_DO_ENVELOPE.includes(chave),
      );
      expect(conteudoProprio.length, 'evento apagado: sobrou só o envelope').toBeGreaterThan(0);

      // Igualdade literal com o endereço inteiro, fechando atrás das nomeadas: prova, de uma vez,
      // que o nome do parâmetro, o esquema, o hospedeiro, a porta, o caminho, o fragmento e os
      // demais parâmetros atravessaram — e que só o valor sensível mudou.
      expect(extraido).toBe(montar(redigido));
    },
  );

  /**
   * A METADE NEGATIVA da delimitação de `code` — a que a matriz acima não alcança.
   *
   * O radical `code` é acrescentado à lista do eixo de ENDEREÇO e **só** a ela: em cadeia de
   * consulta ele é o código de autorização de um fluxo OAuth — credencial de uso único, trocável
   * por sessão —, enquanto como CHAVE DE EVENTO ele casaria `statusCode` e `errorCode`, que são
   * diagnóstico e não segredo. A matriz prova o lado fácil (que `code` É redigido no endereço), e
   * medido: com o radical movido para a lista de chaves, ela segue inteira verde — a delimitação
   * podia ser desfeita por qualquer agente futuro sem que a suíte percebesse, cegando toda linha
   * de diagnóstico do serviço.
   *
   * Este caso emite num ÚNICO evento a combinação que discrimina os dois lados. Alargar o radical
   * para as chaves reprova as duas igualdades de diagnóstico; estreitá-lo, tirando-o do endereço,
   * reprova a igualdade do alvo. É o par que detecta, não a asserção isolada.
   */
  it('`code` é radical de PARÂMETRO de endereço, não de chave — `statusCode` e `errorCode` atravessam', async () => {
    const { logger, destino } = loggerEmArquivo('info');
    const codigoDeAutorizacao = 'CODE-NAO-VAZAR-9f22';

    logger.info({
      ...EVENTO_BASE,
      statusCode: 404,
      errorCode: 'ROTA_NAO_ENCONTRADA',
      alvo: `${ALVO}?code=${codigoDeAutorizacao}`,
    });
    await esvaziar(logger);

    const conteudo = await readFile(destino, 'utf8');
    expect(conteudo, `segredo vazado: ${codigoDeAutorizacao}`).not.toContain(codigoDeAutorizacao);

    const evento = JSON.parse(linhasNaoVazias(conteudo)[0] as string) as Record<string, unknown>;

    // As duas chaves de diagnóstico, por igualdade literal com o valor informado — nunca o
    // sentinela: mascará-las não tira segredo nenhum e apaga o status e o motivo da falha, que é
    // o que o registro existe para preservar.
    expect(evento.statusCode, '`statusCode` mascarado — é diagnóstico, não segredo').toBe(404);
    expect(evento.errorCode, '`errorCode` mascarado — é diagnóstico, não segredo').toBe(
      'ROTA_NAO_ENCONTRADA',
    );

    // E, no MESMO evento, o outro lado da delimitação: como nome de parâmetro, `code` é redigido.
    expect(evento.alvo, 'código de autorização vazado no endereço').toBe(
      `${ALVO}?code=${SENTINELA_REDIGIDO}`,
    );
  });
});

/**
 * Companheiro negativo do CT-027 — a delimitação pelo NOME do parâmetro.
 *
 * O marcador do D25 registrava, antes desta task, que um padrão mal delimitado **já mutilou em
 * silêncio** URL legítima neste mesmo arquivo. Este caso é a rede contra a repetição: ele
 * reprova qualquer aperto do padrão que passe a redigir parâmetro que não é credencial.
 *
 * O endereço com `callbackURL` está aqui por decisão registrada em `log.ts` (marcador
 * `DECISÃO FECHADA` de `redigirValorEmCadeiaDeConsulta`): alvo de retorno é diagnóstico, não
 * segredo — redigi-lo apagaria para onde o usuário foi mandado sem tirar credencial nenhuma.
 */
describe('CT-028 — endereço legítimo sem parâmetro sensível atravessa byte a byte idêntico', () => {
  const EVENTO_BASE = { evento: 'requisicao_concluida', idCorrelacao: 'corr-seguranca-28' };
  const HOSPEDEIRO = 'https://app.exemplo.com:8443';

  /** Endereços escolhidos para tentar o padrão largo demais em cada fronteira que ele tem. */
  const legitimos = [
    {
      legitimo: 'consulta comum — nenhum nome casa radical sensível',
      endereco: `${HOSPEDEIRO}/painel?ordenacao=nome&pagina=2`,
    },
    {
      legitimo: 'alvo de retorno e destino com `@` — nenhum dos dois é credencial',
      endereco: `${HOSPEDEIRO}/retorno?callbackURL=/painel&redirect=alguem@exemplo.com`,
    },
    {
      legitimo: '`?` e `=` dentro do valor de um parâmetro inocente',
      endereco: `${HOSPEDEIRO}/busca?termo=a?b=c&pagina=2`,
    },
  ] as const;

  const posicoes = [
    {
      posicao: 'campo',
      montar: (endereco: string) => endereco,
      emitir: (logger: Logger, endereco: string) => logger.info({ ...EVENTO_BASE, alvo: endereco }),
      extrair: (evento: Record<string, unknown>) => evento.alvo,
    },
    {
      posicao: 'mensagem',
      montar: (endereco: string) => `requisição concluída para ${endereco}`,
      emitir: (logger: Logger, endereco: string) =>
        logger.info(`requisição concluída para ${endereco}`),
      extrair: (evento: Record<string, unknown>) => evento.mensagem,
    },
    {
      posicao: 'raiz',
      montar: (endereco: string) => endereco,
      emitir: (logger: Logger, endereco: string) => logger.info(new URL(endereco)),
      extrair: (evento: Record<string, unknown>) => evento.valor,
    },
  ] as const;

  const combinacoes = legitimos.flatMap((legitimo) =>
    posicoes.map((posicao) => ({ ...legitimo, ...posicao })),
  );

  it.each(combinacoes)('$legitimo — em $posicao', async ({ endereco, montar, emitir, extrair }) => {
    const { logger, destino } = loggerEmArquivo('info');

    emitir(logger, endereco);
    await esvaziar(logger);

    const conteudo = await readFile(destino, 'utf8');
    // Nenhum sentinela em lugar nenhum da linha: o eixo não tocou este endereço.
    expect(conteudo, 'sentinela introduzido em endereço legítimo').not.toContain(
      SENTINELA_REDIGIDO,
    );

    const evento = JSON.parse(linhasNaoVazias(conteudo)[0] as string) as Record<string, unknown>;
    // Igualdade literal com o que foi informado — caractere a caractere, sem exceção.
    expect(extrair(evento), `endereço mutilado: ${endereco}`).toBe(montar(endereco));
  });
});

/**
 * Os três radicais que o **segredo operável** do provedor bancário introduz — e o `certificadoId`
 * que precisa sobreviver a eles.
 *
 * Por que exatamente três, e por que estes: a medição M4 desta fatia registrou dois vetores que a
 * redação **não alcançava**, os dois chegando ao destino em claro — `materialDoCertificado` e
 * `{ certificado: { pfx, passphrase } }`. `material` fecha o primeiro; `pfx` e `passphrase` fecham o
 * segundo **pelas chaves internas**, que é onde o valor de fato está: a chave externa `certificado`
 * carrega um objeto, não um segredo.
 *
 * ⚠️ **A METADE QUE IMPEDE A "CORREÇÃO" ÓBVIA.** O casamento é por radical contido na chave
 * normalizada, de modo que o radical `certificado` — a escolha idiomática, que pareceria cobrir
 * tudo de uma vez — alcançaria **`certificadoId`**, o único eixo pelo qual uma falha registrada se
 * liga à linha do banco. Ele trocaria vazamento por cegueira operacional: o diagnóstico sairia
 * `[REDIGIDO]` sem cobrir um byte a mais de segredo. Por isso o caso afirma, no MESMO evento, que
 * as sentinelas somem **e** que o identificador chega com o valor — sem a segunda metade,
 * acrescentar `certificado` à lista passaria verde e ninguém veria.
 *
 * ⚠️ **A redação é a SEGUNDA barreira, nunca a garantia** (ADR-0032). A primeira é estrutural — o
 * material e a senha não são campo de objeto que viaje para registro —, e a prova sobre as quatro
 * superfícies de saída real é de outra task. Este bloco prova o que é desta: que o eixo do nome
 * passou a reconhecer os três radicais, em todas as rotas por onde uma chave é reconhecida.
 */
describe('CT-829 — radicais do segredo operável redigidos, com o `certificadoId` legível', () => {
  const EVENTO_BASE = { evento: 'certificado_recusado', idCorrelacao: 'corr-seguranca-829' };

  /** O eixo que liga a falha registrada à linha do banco — e que a redação NÃO pode alcançar. */
  const CERTIFICADO_ID = '9c2f1b7a-4d38-4e6f-8a51-0b7d3e5c6a24';

  const SENTINELA_DO_MATERIAL = 'MATERIAL-NAO-VAZAR-4b7e';
  const SENTINELA_DO_PFX = 'PFX-NAO-VAZAR-8c31';
  const SENTINELA_DA_PASSPHRASE = 'PASSPHRASE-NAO-VAZAR-0d92';

  /** A ordem é a do filtro abaixo, e é o que torna a lista de achados comparável por igualdade. */
  const SENTINELAS = [SENTINELA_DO_MATERIAL, SENTINELA_DO_PFX, SENTINELA_DA_PASSPHRASE] as const;

  /** Endereço do provedor — o eixo de endereço herda os radicais novos pelo *spread* já existente. */
  const ENDERECO = 'https://api.sicoob.com.br:443/cobranca';

  /** Destino do controle positivo — nome próprio, para nunca colidir com o do arquivo sob exame. */
  const ARQUIVO_DE_CONTROLE = 'controle.log';

  function agulhasEncontradas(conteudo: string): readonly string[] {
    return SENTINELAS.filter((sentinela) => conteudo.includes(sentinela));
  }

  /**
   * **O controle positivo da varredura, e ele é indispensável** (AP-29): afirmar que a agulha não
   * está na palha não prova nada enquanto não se souber que esta busca a **acha** quando ela está
   * lá — uma varredura quebrada passa verde e não prova coisa alguma.
   *
   * O plantio usa o **mesmo registrador**, o **mesmo tipo de destino** e as **mesmas posições** do
   * caso, trocando apenas os nomes das chaves por nomes inócuos. Assim ele falsifica, de uma vez,
   * as três maneiras de a asserção principal ser vacuamente verde: busca quebrada, registrador que
   * não escreveu nada, e valor truncado antes de chegar ao arquivo.
   */
  async function agulhasNoControle(emitir: (logger: Logger) => void): Promise<readonly string[]> {
    const destino = join(diretorio, ARQUIVO_DE_CONTROLE);
    const logger = criarLogger({ nivel: 'info', destino });
    emitir(logger);
    await esvaziar(logger);
    return agulhasEncontradas(await readFile(destino, 'utf8'));
  }

  it('redige `materialDoCertificado`, `pfx` e `passphrase`, e deixa `certificadoId` legível', async () => {
    // (a) CONTROLE POSITIVO — as mesmas três sentinelas, nas mesmas posições, sob nomes inócuos:
    //     a busca tem de achar as três antes de a ausência delas significar alguma coisa.
    const achadasNoControle = await agulhasNoControle((logger) =>
      logger.warn({
        ...EVENTO_BASE,
        controleRaso: SENTINELA_DO_MATERIAL,
        envelopeDeControle: { controleAninhado: SENTINELA_DO_PFX },
        alvo: `${ENDERECO}?pagina=${SENTINELA_DA_PASSPHRASE}`,
      }),
    );
    expect(achadasNoControle, 'a varredura não acha a agulha nem quando ela está plantada').toEqual(
      [SENTINELA_DO_MATERIAL, SENTINELA_DO_PFX, SENTINELA_DA_PASSPHRASE],
    );

    const { logger, destino } = loggerEmArquivo('info');

    logger.warn({
      ...EVENTO_BASE,
      certificadoId: CERTIFICADO_ID,
      materialDoCertificado: SENTINELA_DO_MATERIAL,
      certificado: { pfx: SENTINELA_DO_PFX, passphrase: SENTINELA_DA_PASSPHRASE },
      alvo: `${ENDERECO}?passphrase=${SENTINELA_DA_PASSPHRASE}&pagina=2`,
    });
    await esvaziar(logger);

    const conteudo = await readFile(destino, 'utf8');

    // (b) A VARREDURA — sobre o arquivo INTEIRO, e não sobre um campo escolhido: foi asserir só o
    //     campo que deixou a mensagem promovida vazar em silêncio numa fatia anterior.
    expect(agulhasEncontradas(conteudo), 'sentinela vazada no arquivo de eventos').toEqual([]);
    expect(conteudo).not.toContain('NAO-VAZAR');

    const linhas = linhasNaoVazias(conteudo);
    expect(linhas).toHaveLength(1);
    const evento = JSON.parse(linhas[0] as string) as Record<string, unknown>;
    const certificado = evento.certificado as Record<string, unknown> | undefined;

    // (c) PRESENÇA, NÃO AUSÊNCIA — as três chaves seguem na linha, carregando o sentinela. Um
    //     evento silenciado, ou um objeto `certificado` inteiro colapsado, passaria em (b) sem
    //     redigir coisa alguma; aqui reprova.
    expect({
      materialDoCertificado: evento.materialDoCertificado,
      pfx: certificado?.pfx,
      passphrase: certificado?.passphrase,
    }).toEqual({
      materialDoCertificado: SENTINELA_REDIGIDO,
      pfx: SENTINELA_REDIGIDO,
      passphrase: SENTINELA_REDIGIDO,
    });

    // (d) A OUTRA METADE — o identificador chega com o valor. É esta linha que reprova o dia em que
    //     alguém acrescentar `certificado` à lista de radicais.
    expect(evento.certificadoId, '`certificadoId` redigido — é diagnóstico, não segredo').toBe(
      CERTIFICADO_ID,
    );

    // (e) Mascarar não é silenciar: o evento continua sendo emitido, com os demais campos.
    expect(evento.evento).toBe('certificado_recusado');
    expect(evento.idCorrelacao).toBe('corr-seguranca-829');
    expect(evento.nivel).toBe('warn');

    // (f) O EIXO DE ENDEREÇO, alcançado por consequência do *spread* que deriva a lista de nomes de
    //     parâmetro — sem segunda lista. Sai o valor do parâmetro sensível; o esquema, o
    //     hospedeiro, a porta, o caminho e o parâmetro inocente atravessam intactos.
    expect(evento.alvo, 'endereço mutilado além do parâmetro sensível').toBe(
      `${ENDERECO}?passphrase=${SENTINELA_REDIGIDO}&pagina=2`,
    );
  });

  /**
   * As duas portas que reconhecem uma chave por **rota própria**, e que o evento acima não
   * atravessa: a propriedade própria de uma exceção — `redigirErro` consulta o predicado numa
   * segunda posição, separada da de `redigirObjeto` — e o vínculo de um logger filho, que o pino
   * monta fora do formatador de campos e que é por onde o contexto da requisição viaja.
   *
   * Radical que valesse só numa das rotas vazaria pela outra em silêncio — foi exatamente assim que
   * a classe reapareceu quatro vezes neste repositório, cada correção fechando o caminho apontado.
   */
  it('alcança a propriedade própria da exceção e o vínculo do logger filho', async () => {
    // (a) CONTROLE POSITIVO — as mesmas três sentinelas, nas mesmas duas rotas, sob nomes inócuos.
    const achadasNoControle = await agulhasNoControle((logger) =>
      logger.child({ controleNoVinculo: SENTINELA_DA_PASSPHRASE }).error(
        {
          ...EVENTO_BASE,
          err: Object.assign(new Error('falha no aperto de mão com o provedor'), {
            controleNaExcecao: SENTINELA_DO_MATERIAL,
            outroNaExcecao: SENTINELA_DO_PFX,
          }),
        },
        'falha ao registrar o certificado',
      ),
    );
    expect(achadasNoControle, 'a varredura não acha a agulha nem quando ela está plantada').toEqual(
      [SENTINELA_DO_MATERIAL, SENTINELA_DO_PFX, SENTINELA_DA_PASSPHRASE],
    );

    const { logger, destino } = loggerEmArquivo('info');

    logger.child({ passphrase: SENTINELA_DA_PASSPHRASE }).error(
      {
        ...EVENTO_BASE,
        certificadoId: CERTIFICADO_ID,
        err: Object.assign(new Error('falha no aperto de mão com o provedor'), {
          materialDoCertificado: SENTINELA_DO_MATERIAL,
          pfx: SENTINELA_DO_PFX,
        }),
      },
      'falha ao registrar o certificado',
    );
    await esvaziar(logger);

    const conteudo = await readFile(destino, 'utf8');
    expect(agulhasEncontradas(conteudo), 'sentinela vazada no arquivo de eventos').toEqual([]);
    expect(conteudo).not.toContain('NAO-VAZAR');

    const evento = JSON.parse(linhasNaoVazias(conteudo)[0] as string) as Record<string, unknown>;
    const erroRegistrado = evento.err as Record<string, unknown> | undefined;

    // Presença nas duas rotas, mais o vínculo do filho — que chega como campo de topo da linha.
    expect({
      materialDoCertificado: erroRegistrado?.materialDoCertificado,
      pfx: erroRegistrado?.pfx,
      passphrase: evento.passphrase,
    }).toEqual({
      materialDoCertificado: SENTINELA_REDIGIDO,
      pfx: SENTINELA_REDIGIDO,
      passphrase: SENTINELA_REDIGIDO,
    });

    // Mascarar não é apagar, nas duas metades: o identificador e o diagnóstico da falha sobrevivem.
    expect(evento.certificadoId, '`certificadoId` redigido — é diagnóstico, não segredo').toBe(
      CERTIFICADO_ID,
    );
    expect(erroRegistrado?.mensagem).toBe('falha no aperto de mão com o provedor');
    expect(evento.mensagem).toBe('falha ao registrar o certificado');
  });
});
