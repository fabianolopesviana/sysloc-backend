/**
 * Registro estruturado de eventos.
 *
 * Rastreabilidade: T3 §4 (registro estruturado, nível por ambiente, correlação por
 * requisição, campos sensíveis mascarados na origem) e CLAUDE.md invariante 3
 * → CT-006, CT-007, CT-008.
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
