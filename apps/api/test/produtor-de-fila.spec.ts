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
 * | §4.3  | CT-967 | **T6** · O que `enfileirarNotificacaoBancaria` põe na fila
 * | (T6)  | (d)    | `notificacao-bancaria` é **exatamente** `{ notificacaoId }` — uma chave, e
 * |       |        | nenhuma a mais —, afirmado por igualdade de objeto **e** por igualdade do
 * |       |        | arranjo de chaves, contra servidor de fila REAL. É o eixo que reprova um
 * |       |        | `empresaId` acrescentado à carga: a empresa é o **resultado** da travessia
 * |       |        | nominal, e o único valor disponível na borda viria do recebido — que é o que a
 * |       |        | ADR-0024 (terceira emenda) e a ADR-0035 proíbem. |
 *
 * | §13.1 | CT-739 | **T15** · Os pontos de registro do módulo são afirmados por igualdade sobre
 * | (T15) | (b)    | o texto do SUT — **o par nível + produtor do valor de `erro`**, ponto a ponto:
 * |       |        | o ouvinte do cliente, o ouvinte de cada fila, a espera de assentamento
 * |       |        | abandonada (que **não tem causa**) e o **fecho das filas no desligamento**.
 * |       |        | Onde há causa, o valor é `semRastroDeComando(...)`, nunca o objeto que a
 * |       |        | biblioteca rejeitou. Ela fecha as duas metades do que o caminho de fecho
 * |       |        | perdera: o resultado de `Promise.allSettled` **descartado sem leitura** (o
 * |       |        | ponto some da lista) e a causa **crua** no registrador (o valor deixa de ser
 * |       |        | o saneador). ⚠️ **T9 (rodada 4)**: o par substituiu a lista de níveis, e é
 * |       |        | estritamente mais forte — ver `SUT_IS_CORRECT_BECAUSE` em
 * |       |        | {@link PONTOS_DE_REGISTRO}. |
 *
 * | §10.2 | CT-1007 | **T9 (rodada 4)** · O encerramento do produtor **TERMINA** com o servidor
 * | (T9)  |         | de fila ausente desde antes da conexão — o estado em que as quatro
 * |       |         | inicializações ficam pendentes e a queda da conexão não as libera. O
 * |       |         | desfecho é afirmado nas duas pontas: a promessa **resolve** dentro do teto
 * |       |         | do caso, e o diário traz a linha do prazo abandonado, nomeando as quatro
 * |       |         | filas — sem ela, o caso passaria sem ter alcançado o estado que mede. |
 *
 * Rastreabilidade: `CA-09 → CT-738 (RN-11)`, `CA-09 → CT-739 (RN-11)`, `CA-09 → CT-739 (b) (RN-11)`.
 * Acrescida pela T6 da fatia `webhook-e-carne`: `CA-02 → CT-967 (d) (RN-02)`.
 * Acrescida pela T9 da mesma fatia: `CA-09 → CT-1007 (RN-11)`.
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
 * O `CT-739 (b)` É ESTÁTICO — e a razão de ele não ser comportamental foi MEDIDA
 * ===========================================================================
 *
 * O `CT-738` e o `CT-739` medem o SUT em execução, com servidor real, e é assim que se prova o que
 * se pode provocar. O caminho de **fecho** não é um desses: para observar a leitura do resultado de
 * `Promise.allSettled` seria preciso um `close()` que **rejeite**, e a medição desta base diz que
 * ele não rejeita por caminho legítimo — com a instância efêmera **parada** antes do fecho, as duas
 * filas de uma medição de controle devolveram `fulfilled`, porque a conexão é **compartilhada** e o
 * fecho da fila não emite comando algum ao servidor. Provocá-la exigiria dublar a biblioteca ou
 * abrir na produção um ponto de entrada que só o teste usa — o *seam* que a
 * `.claude/rules/testing-stack.md` proíbe.
 *
 * O que resta é a asserção sobre o **texto** do módulo, e ela é discriminante nas duas direções que
 * importam: remover o registro do fecho tira o ponto da lista afirmada por igualdade, e passar a
 * causa crua ao registrador troca o valor da chave `erro`. Sendo estática, ela paga o preço que a
 * `testing-stack.md` e o P4 da `.claude/rules/nao-regressao.md` cobram — a **prova de falsificação
 * por execução**:
 *
 *   1. **controle** — árvore íntegra: os três casos do arquivo verdes;
 *   2. **mutante F (resultado descartado)** — o `for` de leitura removido do `encerrar` e o
 *      `allSettled` de volta a `await Promise.allSettled(...)` sem ligação: o caso **reprovou**, com
 *      `['warn','debug']` contra `['warn','debug','debug']`;
 *   3. **mutante G (causa crua)** — `erro: fecho.reason` no lugar de
 *      `erro: semRastroDeComando(FALHA_DO_FECHO, fecho.reason)`: o caso **reprovou** com
 *      *"o registro 3 (debug) não passa a causa por semRastroDeComando"*, que é o vetor
 *      `err.command.args` sendo apontado no ponto exato em que ele reentraria;
 *   4. **reversão** — as cópias foram desfeitas e o controle reexecutado.
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
import { fileURLToPath } from 'node:url';
import {
  type CargaDaConfirmacao,
  type CargaDaNotificacaoBancaria,
  criarLogger,
  FILA_DA_CONFERENCIA_BANCARIA,
  FILA_DA_CONFIRMACAO,
  FILA_DA_EMISSAO_EM_LOTE,
  FILA_DA_NOTIFICACAO_BANCARIA,
  type Logger,
} from '@sysloc/shared';
import { Queue } from 'bullmq';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
// DÉBITO COM GATILHO — D28 · F0/T5 · gatilho JÁ DISPARADO (F1/T2, 2026-08-02)
// (NÃO é uma `DECISÃO FECHADA`: ele agenda uma mudança, não protege o código abaixo.)
// O QUÊ: os imports a seguir atravessam a fronteira de `@sysloc/shared` e de `@sysloc/db` por
//        CAMINHO DE ARQUIVO, fora do `exports` e do `files` daqueles manifestos. As dependências de
//        workspace estão declaradas, então não há dependência oculta; o que não existe é FRONTEIRA
//        para o diretório `test/` — e este arquivo é mais um a repetir o padrão, agora também para
//        o acessório de varredura de `@sysloc/db`, que o `CT-216` já consome por aqui.
// QUANDO FECHA: o gatilho já disparou e o fechamento segue pendente; ele é o mesmo de sempre —
//        declarar o subpath `"./test"` nos manifestos e importar por `@sysloc/<pacote>/test`, ou
//        extrair um `@sysloc/test-utils`.
// POR QUE NÃO AGORA: fechar exige editar os manifestos de dois pacotes e todos os consumidores,
//        nenhum deles no escopo desta task, e o índice de débitos do `CLAUDE.md`.
// ÍNDICE: docs/specs/features/fundacao-stack-nativa/v1/_run/run-report.md §2, D28
import { semComentarios } from '../../../packages/db/test/varredura-de-fontes.ts';
import { sondarAte } from '../../../packages/shared/test/efemero-comum.ts';
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
 * Limite do `CT-1007`, e ele é a metade que discrimina.
 *
 * Generoso o bastante para a subida da instância efêmera e para o prazo de assentamento do módulo
 * caberem com folga, e finito porque é justamente o estouro dele que reprova o desligamento que não
 * termina — o defeito que o caso mede não produz erro, produz **ausência de desfecho**.
 */
const LIMITE_DO_DESLIGAMENTO_MS = 60_000;

/**
 * Teto da espera pelo SINAL de que o cliente do `CT-1007` entrou em reconexão.
 *
 * O que o caso aguarda é um **estado observável**, e o sinal dele é a linha que o ouvinte de `error`
 * do módulo emite quando a primeira tentativa de conexão falha — {@link MARCA_DA_FALHA_DE_CONEXAO},
 * no mesmo diário que o caso já lê. Antes desse ponto o cliente ainda está em `connecting`, o
 * `disconnect()` fecha o socket, as esperas assentam sozinhas, e o caso mediria um caminho que nunca
 * esteve quebrado.
 *
 * Este número é **limite de recurso, não calibragem**: ele só se manifesta na falha — a sondagem
 * retorna assim que o sinal aparece, e numa máquina carregada o sinal apenas demora mais a chegar.
 * A forma anterior era uma pausa fixa de 300 ms, que comprava o mesmo estado com o relógio: ficava
 * intermitente exatamente onde esta suíte já gastou quatro rodadas — sob carga.
 */
const LIMITE_DA_RECONEXAO_MS = 10_000;

/** A linha que o ouvinte de `error` do módulo emite ao falhar a conexão — o sinal do `CT-1007`. */
const MARCA_DA_FALHA_DE_CONEXAO = 'o produtor de fila reportou falha de conexão';

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

/** O fonte do SUT, lido pelo `CT-739 (b)`. Arquivo ausente levanta, e não devolve conjunto vazio. */
const FONTE_DO_PRODUTOR = fileURLToPath(
  new URL('../src/comum/produtor-de-fila.ts', import.meta.url),
);

/** A linha que o SUT emite quando abandona a espera de assentamento — o controle do `CT-1007`. */
const MENSAGEM_DO_PRAZO_ABANDONADO = 'o assentamento das inicializações excedeu o limite';

/** A entrada única de saneamento do módulo, protegida pela `DECISÃO FECHADA — T9 / Gate 2`. */
const SANEADOR_DA_CAUSA = 'semRastroDeComando';

/**
 * Os pontos de registro do módulo, na ORDEM do arquivo — a expectativa revisada.
 *
 * Cada um é uma decisão registrada no cabeçalho do SUT: o `warn` do ouvinte do cliente, o `debug`
 * do ouvinte instalado em cada fila por `criarFila`, o `warn` que anuncia a espera de assentamento
 * **abandonada** no desligamento, e o `debug` que **lê** o resultado do `Promise.allSettled` do
 * fecho. Escritos à mão de propósito: derivá-los da mesma varredura que o caso classifica faria a
 * asserção concordar consigo mesma.
 *
 * ⚠️ O do fecho é o que a T15 acrescentou. Enquanto havia uma fila só, a rejeição do fecho subia até
 * `onApplicationShutdown` e o arcabouço a registrava; sob `allSettled` — que nunca rejeita — quem
 * não lê o resultado não fica sabendo em lugar nenhum, e o cabeçalho do SUT condena esse silêncio
 * por escrito na seção *"O ouvinte de `error` não é ornamento"*.
 *
 * SUT_IS_CORRECT_BECAUSE: a T9 (rodada 4) acrescentou o TERCEIRO ponto, e o SUT está certo — a
 * espera de assentamento que estoura o prazo não tem causa a sanear: ela não recebe exceção alguma,
 * e o que publica é `{ limiteMs, filas }`. A lista anterior era de NÍVEIS, e cobrava de todo ponto
 * um `erro:` produzido pelo saneador; declarar o ponto novo ali o faria reprovar por não ter causa.
 * O par abaixo é ESTRITAMENTE MAIS FORTE que a lista que ele substitui: fixa por igualdade o nível
 * **e** o produtor do valor de `erro` em cada ponto — de modo que um ponto que passe a causa CRUA
 * (`erro: erro`, sem chamada) é classificado {@link CAUSA_CRUA} e reprova, o que a lista de níveis
 * sozinha não pegava. `undefined` significa, e só pode significar, *"este ponto não menciona
 * causa"*.
 */
const PONTOS_DE_REGISTRO: readonly { readonly nivel: string; readonly causa?: string }[] = [
  { nivel: 'warn', causa: SANEADOR_DA_CAUSA },
  { nivel: 'debug', causa: SANEADOR_DA_CAUSA },
  { nivel: 'warn' },
  { nivel: 'debug', causa: SANEADOR_DA_CAUSA },
];

/** Como o caso classifica um registro que menciona `erro` sem passá-lo por função alguma. */
const CAUSA_CRUA = 'CRUA';

/** Casa a MENÇÃO à chave `erro` no objeto registrado, com ou sem chamada produzindo o valor. */
const MENCAO_A_CAUSA = /\berro:/u;

/** Casa a chave `erro` do objeto registrado e o NOME da função que produz o valor dela. */
const VALOR_DA_CHAVE_DE_ERRO = /\berro:\s*([A-Za-z_$][A-Za-z0-9_$]*)\(/u;

/** Casa a abertura de uma chamada de registro, qualquer que seja o nível. */
const ABERTURA_DO_REGISTRO = /\blogger\.([a-z]+)\(/gu;

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

describe('a carga da notícia bancária no transporte (T6)', () => {
  it(
    'CT-967 (d) — o que chega à fila da notícia é exatamente `{ notificacaoId }`, e nada mais',
    async () => {
      // Identificador de linha, e não um valor qualquer: é o que a borda tem em mãos depois do
      // `COMMIT`, e é a única coisa que a carga carrega.
      const notificacaoId = '33333333-3333-4333-8333-333333333333';

      const endereco = new URL(fila.cadeiaConexao);
      const sonda = new Queue<CargaDaNotificacaoBancaria, void>(FILA_DA_NOTIFICACAO_BANCARIA, {
        connection: { host: endereco.hostname, port: Number.parseInt(endereco.port, 10) },
      });

      try {
        await produtor.enfileirarNotificacaoBancaria({ notificacaoId });

        // A tarefa é lida de volta do servidor REAL: o que se afirma é o que atravessou a
        // serialização da biblioteca, e não o objeto que o caso acabou de construir.
        const emEspera = await sonda.getJobs(['waiting', 'delayed', 'prioritized', 'active']);

        // Âncora antivácuo: sem tarefa alguma, as igualdades abaixo passariam por vacuidade sobre
        // um `undefined` — e a conclusão seria a oposta da verdadeira.
        expect(emEspera.length, 'a fila da notícia não recebeu tarefa alguma').toBe(1);

        const tarefa = emEspera[0];

        // O NOME DA FILA e o da tarefa, por igualdade: uma carga íntegra numa fila que ninguém
        // escuta deixa o trabalho parado **sem erro nenhum**, que é o defeito que
        // `FILA_DA_NOTIFICACAO_BANCARIA` existe para fechar.
        expect({ fila: tarefa?.queueName, nome: tarefa?.name }).toEqual({
          fila: FILA_DA_NOTIFICACAO_BANCARIA,
          nome: FILA_DA_NOTIFICACAO_BANCARIA,
        });

        // A CARGA, por igualdade de objeto: **um** campo, e nenhum a mais. É esta linha que reprova
        // um `empresaId` acrescentado — a violação que a terceira emenda da ADR-0024 nomeia.
        expect(tarefa?.data).toEqual({ notificacaoId });
        // E as chaves, nomeadas: quando a igualdade acima reprovar, é esta que diz **qual** campo
        // entrou a mais, em vez de exibir dois objetos para o leitor comparar.
        expect(Object.keys(tarefa?.data ?? {})).toEqual(['notificacaoId']);
      } finally {
        await sonda.close();
      }
    },
    LIMITE_CASO_MS,
  );
});

describe('o caminho de FECHO do módulo (T15)', () => {
  it('CT-739 (b) — todo ponto de registro do módulo que tem causa a saneia, e o fecho é um deles', () => {
    const fonte = semComentarios(readFileSync(FONTE_DO_PRODUTOR, 'utf8'));

    // Âncora antivácuo: um fonte lido em branco produziria lista vazia, e a igualdade abaixo
    // reprovaria por ausência sem dizer por quê. O caminho ausente já levanta no `readFileSync`.
    expect(fonte.length, 'o fonte do produtor foi lido vazio').toBeGreaterThan(0);

    const registros = chamadasDeRegistro(fonte);

    // O par (nível, produtor do valor de `erro`) de cada ponto, na ordem do arquivo. O produtor é o
    // **valor** da chave, e não a presença dela: um registro que mantivesse a chamada saneada e
    // acrescentasse a causa crua ao lado satisfaria a presença. O ponto que MENCIONA a causa sem
    // passá-la por função alguma é classificado à parte — é o defeito perseguido, e ele precisa ter
    // classificação própria para não se confundir com o ponto que não tem causa nenhuma a sanear.
    const observados = registros.map((registro) => {
      if (!MENCAO_A_CAUSA.test(registro.argumentos)) {
        return { nivel: registro.nivel };
      }

      const produtorDoValor = VALOR_DA_CHAVE_DE_ERRO.exec(registro.argumentos);

      return { nivel: registro.nivel, causa: produtorDoValor?.[1] ?? CAUSA_CRUA };
    });

    // Igualdade sobre o CONJUNTO de pontos: o registro REMOVIDO do fecho — que é o defeito
    // perseguido — some daqui; um registro NOVO obriga a revisão que esta lista é; e um registro que
    // deixe de sanear a causa muda o par sem mudar a contagem.
    expect(
      observados,
      `os pontos de registro do produtor mudaram: ${JSON.stringify(observados)}`,
    ).toEqual([...PONTOS_DE_REGISTRO]);
  });
});

// ---------------------------------------------------------------------------------------------
// Arranjo e observação
// ---------------------------------------------------------------------------------------------

/** Uma chamada de registro do módulo: o nível e o texto dos argumentos dela. */
interface ChamadaDeRegistro {
  readonly nivel: string;
  readonly argumentos: string;
}

/**
 * As chamadas ao registrador que o fonte declara, na ordem do arquivo.
 *
 * O recorte é por **profundidade de parênteses**, e não por linha: as três chamadas do módulo são
 * multilinha, e um casamento por linha veria a abertura sem enxergar o argumento — que é justamente
 * onde a causa entra. Os comentários já saíram antes (`semComentarios`), de modo que a prosa do
 * cabeçalho do SUT, que cita `logger` e `semRastroDeComando` por extenso, não conta como chamada.
 */
function chamadasDeRegistro(fonte: string): ChamadaDeRegistro[] {
  const chamadas: ChamadaDeRegistro[] = [];
  // `lastIndex` é estado do padrão global: zerado a cada uso para que duas invocações do caso não
  // partam do meio do arquivo.
  ABERTURA_DO_REGISTRO.lastIndex = 0;

  let casado = ABERTURA_DO_REGISTRO.exec(fonte);
  while (casado !== null) {
    const inicio = casado.index + casado[0].length;
    let profundidade = 1;
    let posicao = inicio;

    while (posicao < fonte.length && profundidade > 0) {
      const caractere = fonte.charAt(posicao);
      if (caractere === '(') profundidade += 1;
      else if (caractere === ')') profundidade -= 1;
      posicao += 1;
    }

    chamadas.push({ nivel: casado[1] ?? '', argumentos: fonte.slice(inicio, posicao - 1) });
    casado = ABERTURA_DO_REGISTRO.exec(fonte);
  }

  return chamadas;
}

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

// ===========================================================================
// O DESLIGAMENTO TERMINA — a espera de assentamento contra um servidor ausente
// ===========================================================================

describe('o desligamento do produtor com o servidor de fila ausente (T9)', () => {
  it(
    'CT-1007 — o encerramento termina, e o diário registra a espera abandonada',
    async () => {
      // Instância, produtor e diário PRÓPRIOS: este caso derruba o servidor de fila, e usar os do
      // arranjo compartilhado deixaria os demais casos falando com um servidor morto.
      const instancia = await redisEfemero();
      const diretorio = mkdtempSync(join(tmpdir(), 'sysloc-desligamento-produtor-'));
      const arquivo = join(diretorio, 'produtor.log');

      try {
        // O SERVIDOR CAI ANTES DE QUALQUER CONEXÃO — e é isso que produz o estado, de forma
        // determinística e sem depender de carga da máquina: o cliente falha a primeira conexão e
        // entra em RECONEXÃO, com as quatro inicializações de fila pendentes. A promessa de aptidão
        // da biblioteca só resolve em `ready`, `end` ou `error`, e o `disconnect()` de um cliente
        // já em reconexão não produz nenhum dos três.
        await instancia.parar();

        const registrador = criarLogger({ nivel: 'trace', destino: arquivo });
        const emDesligamento = conectarProdutorDeFila(instancia.cadeiaConexao, registrador);

        // O ESTADO É ESPERADO PELO SINAL QUE O PRÓPRIO SUT PUBLICA, nunca por relógio: o ouvinte de
        // `error` do módulo registra a falha da primeira tentativa de conexão neste mesmo diário, e
        // é exatamente aí que o cliente entra em RECONEXÃO. Sem esta espera o cliente ainda está em
        // `connecting`, o `disconnect()` fecha o socket, as esperas assentam por conta própria e o
        // caso mediria outro caminho. O limite é teto de recurso: esgotá-lo levanta, em vez de
        // seguir adiante medindo o caminho errado — o que a pausa fixa anterior fazia em silêncio.
        await sondarAte(
          'a primeira conexão do produtor falhar e o cliente entrar em reconexão',
          () => readFileSync(arquivo, 'utf8').includes(MARCA_DA_FALHA_DE_CONEXAO),
          LIMITE_DA_RECONEXAO_MS,
        );

        // A ASSERÇÃO QUE DISCRIMINA: sem prazo na espera de assentamento, esta promessa não
        // resolve — nem aqui, nem no `SIGTERM` de uma borda real com o servidor de fila já parado.
        // O caso reprovaria pelo teto dele mesmo.
        await emDesligamento.encerrar();

        // CONTROLE ANTIVÁCUO: a linha do prazo prova que o estado medido foi ALCANÇADO. Sem ela, um
        // encerramento que tivesse assentado sozinho passaria por este caso sem ter exercitado nada.
        // Leitor PRÓPRIO: o do arranjo compartilhado lê o diário dos outros casos e casa pela
        // marca que eles plantam — aqui o diário é outro, e a linha é a que o SUT emite sozinho.
        // A unicidade é afirmada pela mesma razão de lá: duas linhas fariam a asserção medir a
        // errada, e nada acusaria.
        const linhas = readFileSync(arquivo, 'utf8')
          .split('\n')
          .filter((registrada) => registrada.includes(MENSAGEM_DO_PRAZO_ABANDONADO));
        expect(linhas).toHaveLength(1);

        const evento = JSON.parse(linhas[0] ?? '') as {
          limiteMs?: number;
          filas?: readonly string[];
        };

        // As QUATRO filas, por igualdade e na ordem em que nascem — nunca "contém": o campo existe
        // para dizer o que ficou para trás, e uma lista que encolhesse em silêncio seria pior que
        // nenhuma.
        expect(evento.filas).toEqual([
          FILA_DA_CONFIRMACAO,
          FILA_DA_EMISSAO_EM_LOTE,
          FILA_DA_CONFERENCIA_BANCARIA,
          FILA_DA_NOTIFICACAO_BANCARIA,
        ]);
        expect(typeof evento.limiteMs).toBe('number');
      } finally {
        rmSync(diretorio, { recursive: true, force: true });
        await instancia.parar();
      }
    },
    LIMITE_DO_DESLIGAMENTO_MS,
  );
});
