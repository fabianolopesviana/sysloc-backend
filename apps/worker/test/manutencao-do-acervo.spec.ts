/**
 * A **manutenção do acervo** — a tarefa entra pela fila real, corre **sem tenant**, e expurga os dois
 * alvos que não têm dono-empresa. T7 da fatia `automacoes-agendadas`.
 *
 * ===========================================================================
 * INVARIANTES
 * ===========================================================================
 *
 * | Critério | Caso    | Invariante |
 * |----------|---------|------------|
 * | CA-13    | CT-1088 | Executada a tarefa com carga `{}`, a notícia crua de **91** dias é removida
 * | CA-21    |         | e as de **90** (na borda) e **1** dia permanecem — remanescentes afirmados por
 * |          |         | IGUALDADE contra os dois identificadores —, e o boleto vencido some **na
 * |          |         | mesma passagem**, com o boleto no prazo intacto. A tarefa CONCLUI, e o
 * |          |         | contexto de tenant nunca é aberto: `plataforma` não tem política (ADR-0031). |
 * | CA-13    | CT-1088 | Perna ESTÁTICA: o fonte da borda **chama** `expurgarNotificacoesVencidas` e
 * | CA-21    | (b)     | contém `0` instruções próprias de remoção sobre `plataforma.notificacao_
 * |          |         | bancaria` — o corte dos 90 dias é reusado, jamais reescrito. |
 * | CA-13    | CT-1089 | `esquemaDaCargaDaManutencaoDoAcervo` aceita `{}` devolvendo objeto vazio, e
 * |          | (T7)    | recusa `{ empresaId }` por `code === 'unrecognized_keys'` com
 * |          |         | `keys === ['empresaId']`. |
 * | CA-13    | CT-1089 | A carga `{ empresaId }` publicada na fila termina a tarefa em **FALHA**, com a
 * |          | (b)     | razão nomeando literalmente `empresaId`, e **nenhuma** linha crua é expurgada
 * |          |         | — nem a de 91 dias, que a passagem legítima levaria. |
 *
 * Rastreabilidade: `CA-13, CA-21 → CT-1088 (RN-11)` · `CA-13, CA-21 → CT-1088 (b) (RN-11)` ·
 * `CA-13 → CT-1089 (T7) (RN-11)` · `CA-13 → CT-1089 (b) (RN-11)`.
 *
 * ===========================================================================
 * O CT-1089 (T7) e o CT-1089 (b) provam coisas DIFERENTES — nenhum substitui o outro
 * ===========================================================================
 *
 * O `(T7)` prova a **forma da recusa no ponto em que ela nasce**, no formato que a
 * `.claude/rules/contrato-publicado.md` fixa: `code` **mais** a lista `keys`, jamais o booleano de
 * insucesso, que aprovaria qualquer falha de esquema. É a metade de `safeParse` que a §3 da T2
 * delegou nominalmente a esta task — `@sysloc/shared` não depende de `zod`, e o `strictObject` mora na
 * borda que recebe a carga. O `(b)` prova o **percurso**: a tarefa entra pela fila real, termina em
 * falha retida, a razão publicada nomeia o campo, e **o efeito não acontece**.
 *
 * ⚠️ **A asserção de que nada foi expurgado é o que separa "recusou" de "recusou antes de apagar".**
 * Sem ela, uma borda que conferisse a carga **depois** do primeiro `DELETE` passaria: a tarefa
 * falharia do mesmo jeito, e o dado já teria ido.
 *
 * ===========================================================================
 * O CAMINHO É O DA OPERAÇÃO, e o contexto NÃO é fixado por fora
 * ===========================================================================
 *
 * Nada aqui chama `processarManutencaoDoAcervo` diretamente: a tarefa é **enfileirada pela fila real**
 * e consumida pelo consumidor que `conectarFila().processar(…)` registra — a mesma fiação que
 * `apps/worker/src/main.ts` monta em operação.
 *
 * ⚠️ **Nenhum `contextoDeTenant.executarCom` aparece neste arquivo, e a ausência é a prova.** Todo o
 * arranjo — a semeadura das notícias, o envelhecimento e as leituras — corre em unidade **sem
 * contexto**, exatamente como a produção corre. Fixar `app.empresa_id` "para facilitar" mascararia um
 * consumidor que exigisse contexto indevidamente: ele passaria aqui e falharia em operação, onde não
 * há empresa alguma a fixar.
 *
 * ===========================================================================
 * A ESPERA É POR SONDAGEM, com limite declarado no topo
 * ===========================================================================
 *
 * Nenhuma pausa fixa (`.claude/rules/testing-stack.md`): o que se espera é o **estado terminal da
 * tarefa**, observado no próprio servidor de fila. E **um consumidor por caso**, nunca em laço: dois
 * consumidores vivos na mesma fila competem pela tarefa, e o desfecho passa a depender de qual venceu.
 *
 * ===========================================================================
 * As duas naturezas de asserção deste arquivo, e o que cada uma exige do P4
 * ===========================================================================
 *
 * As do `CT-1088` e do `CT-1089 (b)` são **comportamentais** — exercitam o percurso real e observam o
 * efeito —, e por isso o P4 as dispensa de mutante. A que **discrimina** o defeito do `CT-1088` é a
 * igualdade de conjunto sobre as notícias remanescentes: uma borda que não chamasse o expurgo deixaria
 * **três** identificadores, e uma que expurgasse com corte próprio errado levaria a de 90 dias junto —
 * o par (o que saiu, o que ficou) reprova nos dois sentidos. No `CT-1089 (b)`, quem discrimina é a
 * contagem crua **depois** da falha.
 *
 * A do `CT-1088 (b)` é **ESTÁTICA** — ela inspeciona o texto do fonte —, e a `.claude/rules/
 * testing-stack.md` cobra dela a prova de falsificação, registrada logo abaixo.
 *
 * ---------------------------------------------------------------------------
 * MUTANTE EXECUTADO — o corte reimplementado na borda (2026-08-23)
 * ---------------------------------------------------------------------------
 *
 * Invocado pelo **script do pacote** (`pnpm --filter @sysloc/worker test`), nunca por `vitest run`
 * avulso — os pacotes de `packages/` resolvem `"."` para `dist/`, e verde de invocação avulsa se lê
 * como "sobreviveu", invertendo a conclusão.
 *
 *   * **controle** — árvore íntegra: `159 passed`, com a chamada encontrada e `0` reimplementações;
 *   * **mutante** — uma instrução própria **acrescentada** dentro da mesma unidade, sem tirar a
 *     chamada (``await tx`DELETE FROM plataforma.notificacao_bancaria WHERE recebido_em < now() -
 *     make_interval(days => 90::integer)` ``). Acrescentar em vez de substituir é o que isola a perna
 *     sob prova: a perna da CHAMADA segue verde, e quem reprova é só a da reimplementação. Medido:
 *     `1 failed | 158 passed`, com a falha **nomeando o arquivo** —
 *     `["/…/apps/worker/src/tarefas/manutencao-do-acervo.ts"]` contra o `[]` esperado. É o modo de
 *     falha desejado: ele aponta o culpado, e não uma contagem;
 *   * **reversão** — o fonte restaurado do backup e conferido por `sha256sum -c` contra o estado
 *     pré-mutante (`OK`), com `git diff` vazio no arquivo.
 *
 * ===========================================================================
 * De onde vêm o banco e a fila (ADR-0006)
 * ===========================================================================
 *
 * De instâncias efêmeras **próprias**, descartadas ao fim. Nenhuma coordenada é lida do ambiente, e o
 * diretório dos boletos é um temporário criado pelo caso e removido depois — a árvore que a operação
 * usa nunca é tocada.
 */

import { randomUUID } from 'node:crypto';
import { mkdtemp, readdir, readFile, rm, utimes } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { criarGuardaDeBoletos, type GuardaDeBoletos } from '@sysloc/cobranca-bancaria';
import {
  type AcessoAoBanco,
  abrirAcessoAoBanco,
  lerNotificacaoBancaria,
  registrarNotificacaoBancaria,
} from '@sysloc/db';
import {
  type CargaDaManutencaoDoAcervo,
  criarLogger,
  FILA_DA_MANUTENCAO_DO_ACERVO,
} from '@sysloc/shared';
import { afterAll, beforeAll, describe, expect, it, onTestFinished } from 'vitest';
import { type BancoMigrado, bancoEfemero } from '../../../packages/db/test/banco-efemero.ts';
import { semComentarios, varrerArquivos } from '../../../packages/db/test/varredura-de-fontes.ts';
import { FAIXA_PORTAS_EFEMERAS, sondarAte } from '../../../packages/shared/test/efemero-comum.ts';
import { type FilaEfemera, redisEfemero } from '../../../packages/shared/test/redis-efemero.ts';
import { conectarFila, type Fila, type TarefaDaManutencaoDoAcervo } from '../src/fila.ts';
import {
  esquemaDaCargaDaManutencaoDoAcervo,
  processarManutencaoDoAcervo,
} from '../src/tarefas/manutencao-do-acervo.ts';

// ---------------------------------------------------------------------------
// Limites de tempo — constantes nomeadas, nunca número mágico no meio do caso
// ---------------------------------------------------------------------------

/** Subir banco e fila efêmeros, provisionar e migrar leva dezenas de segundos aqui. */
const LIMITE_SUBIDA_MS = 180_000;

/** Cada caso semeia o cru, o acervo, e espera a tarefa percorrer a fila real. */
const LIMITE_DO_CASO_MS = 180_000;

/** Limite para a tarefa alcançar estado terminal — folgado sobre a repetição da fila. */
const LIMITE_ESTADO_TERMINAL_MS = 90_000;

/** Reserva de conexões: o arranjo e o consumidor tocam o banco ao mesmo tempo. */
const RESERVA_DE_CONEXOES = 4;

/** Porta padrão do servidor de fila, usada pelo ambiente legado desta máquina (ADR-0006). */
const PORTA_PADRAO_DA_FILA = 6379;

// ---------------------------------------------------------------------------
// O arranjo — vereditos declarados ANTES da execução
// ---------------------------------------------------------------------------

/** O prazo que a composição raiz declara, e que o arranjo repete à mão para fixar as bordas. */
const DIAS_DE_RETENCAO = 90;

/** Milissegundos de um dia — literal do caso, jamais importado do artefato sob prova. */
const MS_POR_DIA = 24 * 60 * 60 * 1000;

/**
 * As idades das três notícias cruas — uma além do prazo, uma **na borda** dele e uma recente.
 *
 * A do meio é a que discrimina o corte por baixo: ela é a linha **mais velha que sobrevive**, e uma
 * implementação com o prazo mais curto (89, ou o dia arredondado para baixo) a levaria junto.
 *
 * ⚠️ **Ela é `90 dias MENOS {@link MARGEM_DA_BORDA_MINUTOS}`, e não `90` exatos — a diferença é
 * determinismo, não conveniência.** `expurgarNotificacoesVencidas` corta por `recebido_em < now() -
 * 90 dias`, e `now()` no PostgreSQL é `transaction_timestamp()`: o arranjo carimba a linha na
 * transação dele, e a tarefa avalia o corte numa transação **estritamente posterior**. Uma linha
 * gravada como "exatamente 90 dias" pelo relógio do arranjo tem, ao ser avaliada, 90 dias **e alguns
 * milissegundos** — ela sai por construção, e o caso seria vermelho contra um SUT correto. Medido
 * nesta máquina, na primeira execução deste arquivo.
 *
 * ⚠️ **A borda EXATA é afirmável no outro alvo, e a assimetria é do desenho de cada corte**: o expurgo
 * do acervo conta **dias inteiros completos** (truncados), de modo que `90d` exatos permanecem lá por
 * decisão declarada em `guarda-de-boletos.ts`. O corte do cru é por **instante**, e num eixo contínuo
 * não existe "exatamente 90 dias" observável entre duas transações.
 */
const DIAS_ALEM_DA_RETENCAO = 91;
const DIAS_NO_LIMITE_DA_RETENCAO = 90;
const DIAS_RECENTES = 1;

/**
 * A folga que separa a linha da borda do instante do corte — ver {@link DIAS_NO_LIMITE_DA_RETENCAO}.
 *
 * Cinco minutos: grande o bastante para cobrir com folga a distância entre a transação do arranjo e a
 * da tarefa (dezenas de milissegundos, medidos), e pequeno o bastante para a linha continuar sendo a
 * mais velha que sobrevive — um corte de 89 dias a levaria.
 */
const MARGEM_DA_BORDA_MINUTOS = 5;

/** O corpo opaco das notícias do arranjo — nada aqui participa de recorte nenhum. */
const CORPO_DA_NOTICIA = { origem: 'arranjo-da-manutencao' } as const;

/** Os bytes que a guarda grava — o boleto do arranjo não é PDF de verdade, e não precisa ser. */
const BYTES_DO_BOLETO = Buffer.from('%PDF-boleto-do-arranjo\n', 'utf8');

/** Os dois códigos do acervo: um vencido, que sai, e um recente, que é o controle e permanece. */
const CODIGO_DO_BOLETO_VENCIDO = 'COB-2026-0000091';
const CODIGO_DO_BOLETO_RECENTE = 'COB-2026-0000001';

/** O acervo depois da passagem, escrito por extenso — nunca derivado do que a guarda devolveu. */
const ACERVO_APOS_A_PASSAGEM = ['COB-2026-0000001.pdf'] as const;

/** O acervo antes da passagem, escrito por extenso — o estado que o `CT-1089 (b)` afirma INTOCADO. */
const ACERVO_INTEIRO = ['COB-2026-0000091.pdf', 'COB-2026-0000001.pdf'] as const;

/** Tentativas de uma tarefa que o `CT-1089 (b)` reduz — nas opções do ENFILEIRAMENTO, nunca em `fila.ts`. */
const UMA_TENTATIVA = 1;

/** O nome do campo que a razão da falha tem de nomear. Cadeia EXATA. */
const CAMPO_DA_EMPRESA = 'empresaId';

/** O código com que o `strictObject` recusa chave desconhecida — vocabulário da biblioteca. */
const CODIGO_DE_CHAVE_DESCONHECIDA = 'unrecognized_keys';

/** O fonte da borda, que a perna estática lê. */
const FONTE_DA_BORDA = fileURLToPath(
  new URL('../src/tarefas/manutencao-do-acervo.ts', import.meta.url),
);

/**
 * A CHAMADA ao expurgo reusado, e não a menção dela.
 *
 * O parêntese depois do nome é o que discrimina chamada de item de lista de import — a mesma
 * discriminação que as âncoras de `packages/db/test/` usam, e o controle de não-cegueira abaixo a
 * prova sobre as duas formas.
 */
const CHAMADA_AO_EXPURGO_REUSADO = /\bexpurgarNotificacoesVencidas\s*\(/;

/**
 * Uma instrução PRÓPRIA de remoção sobre a tabela crua — o que a borda **não** pode conter.
 *
 * O predicado é largo de propósito (qualquer `DELETE` que nomeie a tabela, em qualquer caixa): o que
 * ele persegue é o corte reimplementado, e estreitá-lo à forma exata do mutante o faria casar só a
 * cópia que já se conhece.
 */
const REMOCAO_PROPRIA_DO_CRU = /\bDELETE\b[\s\S]{0,200}?plataforma\.notificacao_bancaria/i;

let banco: BancoMigrado;
let acesso: AcessoAoBanco;
let instanciaDaFila: FilaEfemera;
let diretorioDosBoletos: string;

beforeAll(async () => {
  banco = await bancoEfemero();
  acesso = abrirAcessoAoBanco({
    cadeiaDeConexao: banco.cadeiaConexao,
    maximoDeConexoes: RESERVA_DE_CONEXOES,
  });

  instanciaDaFila = await redisEfemero();

  // ADR-0006 — a instância em uso não é a que atende a operação, e está dentro da faixa efêmera. A
  // conferência mais completa (contra a porta que `provisionar-base.sh` declara) mora em
  // `apps/worker/test/eco.spec.ts`, e não é recopiada aqui: cópias de um verificador divergem.
  expect(instanciaDaFila.porta).not.toBe(PORTA_PADRAO_DA_FILA);
  expect(instanciaDaFila.porta).toBeGreaterThanOrEqual(FAIXA_PORTAS_EFEMERAS.primeira);
  expect(instanciaDaFila.porta).toBeLessThanOrEqual(FAIXA_PORTAS_EFEMERAS.ultima);
}, LIMITE_SUBIDA_MS);

afterAll(async () => {
  await acesso?.encerrar();
  await banco?.parar();
  await instanciaDaFila?.parar();
}, LIMITE_SUBIDA_MS);

// ===========================================================================
// CT-1088 — a manutenção sem tenant expurga os dois alvos, reusando o que existe
// ===========================================================================

describe('CT-1088 — a manutenção sem tenant expurga o recebido cru vencido e o boleto vencido', () => {
  it(
    'CT-1088 — a notícia de 91 dias sai, as de 90 e 1 dia ficam, e o boleto vencido some na mesma passagem',
    async () => {
      const alemDoPrazo = await semearCru(DIAS_ALEM_DA_RETENCAO);
      const noLimite = await semearCru(DIAS_NO_LIMITE_DA_RETENCAO, MARGEM_DA_BORDA_MINUTOS);
      const recente = await semearCru(DIAS_RECENTES);

      // Controle antivácuo do arranjo: as três existem ANTES da passagem. Sem ele, "a de 91 dias não
      // está lá" seria satisfeito por um arranjo que nunca a gravou.
      expect(await identificadoresCrusPresentes([alemDoPrazo, noLimite, recente])).toEqual(
        [alemDoPrazo, noLimite, recente].sort(),
      );

      const { guarda } = await semearAcervo();

      const tarefa = await executarTarefa(montarConsumidor(guarda), {});
      expect(await tarefa.getState()).toBe('completed');

      // O que SAIU e o que FICOU, por igualdade de conjunto: a de 90 dias exatos permanece, e é ela
      // que separa o corte estrito do frouxo.
      expect(await identificadoresCrusPresentes([alemDoPrazo, noLimite, recente])).toEqual(
        [noLimite, recente].sort(),
      );

      // E o segundo alvo, na MESMA passagem: o boleto vencido some, o que está no prazo permanece.
      expect([...(await readdir(diretorioDosBoletos))].sort()).toEqual(
        [...ACERVO_APOS_A_PASSAGEM].sort(),
      );
    },
    LIMITE_DO_CASO_MS,
  );

  it('CT-1088 (b) — a borda CHAMA o expurgo existente e não reimplementa o corte', async () => {
    const daChamada = await varrerArquivos([FONTE_DA_BORDA], (linha) =>
      CHAMADA_AO_EXPURGO_REUSADO.test(linha),
    );

    // Controle antivácuo: a varredura leu o arquivo, e a chamada está lá. Uma lista vazia aqui
    // significaria que o reuso sumiu — e o caso reprova nomeando o fonte.
    expect(daChamada.arquivos).toBe(1);
    expect(daChamada.ocorrencias.length).toBeGreaterThan(0);

    // A metade que discrimina a REIMPLEMENTAÇÃO: nenhuma instrução própria de remoção sobre a tabela
    // crua. O predicado corre sobre o fonte INTEIRO, e não linha a linha, porque a instrução vive num
    // literal de gabarito que o autor pode quebrar onde quiser — e os comentários saem antes, para que
    // a menção à tabela num docblock não conte como código.
    const executavel = semComentarios(await readFile(FONTE_DA_BORDA, 'utf8'));
    const reimplementacoes = REMOCAO_PROPRIA_DO_CRU.test(executavel) ? [FONTE_DA_BORDA] : [];

    // Igualdade com lista vazia, e não um booleano: a reprovação NOMEIA o arquivo culpado.
    expect(
      reimplementacoes,
      'a borda reimplementou o corte do recebido cru em vez de chamar a operação existente',
    ).toEqual([]);

    // Controle de não-cegueira dos DOIS predicados: eles reconhecem o que devem e recusam o que não
    // devem. Sem isto, uma expressão quebrada ficaria verde por não enxergar nada.
    expect(CHAMADA_AO_EXPURGO_REUSADO.test('await expurgarNotificacoesVencidas(tx)')).toBe(true);
    expect(CHAMADA_AO_EXPURGO_REUSADO.test('  expurgarNotificacoesVencidas,')).toBe(false);
    expect(REMOCAO_PROPRIA_DO_CRU.test('DELETE FROM plataforma.notificacao_bancaria')).toBe(true);
    expect(REMOCAO_PROPRIA_DO_CRU.test('SELECT 1 FROM plataforma.notificacao_bancaria')).toBe(
      false,
    );
  });
});

// ===========================================================================
// CT-1089 (T7) — a carga vazia é fechada, e a chave excedente é recusada pelo nome
// ===========================================================================

describe('CT-1089 (T7) — o esquema da carga da manutenção recusa a chave que veio a mais', () => {
  it('CT-1089 (T7) — a carga vazia é aceita, e o que ela devolve é o objeto vazio', () => {
    const resultado = esquemaDaCargaDaManutencaoDoAcervo.safeParse({});

    // O controle positivo da perna: sem ele, um esquema que recusasse tudo passaria no negativo.
    expect(resultado.success).toBe(true);
    expect(resultado.data).toEqual({});
  });

  it('CT-1089 (T7) — `{ empresaId }` reprova por `unrecognized_keys`, nomeando a chave', () => {
    const resultado = esquemaDaCargaDaManutencaoDoAcervo.safeParse({
      [CAMPO_DA_EMPRESA]: randomUUID(),
    });

    expect(resultado.success).toBe(false);
    expect(resultado.error?.issues).toHaveLength(1);

    const problema = resultado.error?.issues[0];

    // `code` e `keys`, como a `.claude/rules/contrato-publicado.md` cobra: é a chave EXCEDENTE que
    // precisa ser nomeada, e não apenas "a carga foi recusada". A entrada é FECHADA — `z.object`
    // ignoraria `empresaId` em silêncio, e a fila sem tenant passaria a aceitar uma empresa que os
    // alvos dela não têm (ADR-0024, terceira emenda / ADR-0031).
    expect(problema?.code).toBe(CODIGO_DE_CHAVE_DESCONHECIDA);
    expect(problema && 'keys' in problema ? problema.keys : undefined).toEqual([CAMPO_DA_EMPRESA]);
  });

  it(
    'CT-1089 (b) — a carga com `empresaId` falha a tarefa nomeando o campo, e NADA é expurgado',
    async () => {
      const alemDoPrazo = await semearCru(DIAS_ALEM_DA_RETENCAO);
      const { guarda } = await semearAcervo();

      const tarefa = await executarTarefa(
        montarConsumidor(guarda),
        // A conversão existe porque o tipo da carga RECUSA o campo — é o compilador cumprindo o que
        // a ADR-0024 decidiu, e o caso precisa publicar exatamente o que ele impede.
        { [CAMPO_DA_EMPRESA]: randomUUID() } as unknown as CargaDaManutencaoDoAcervo,
        UMA_TENTATIVA,
      );

      expect(await tarefa.getState()).toBe('failed');
      expect(tarefa.failedReason).toContain(CAMPO_DA_EMPRESA);

      // A asserção que separa "recusou" de "recusou ANTES de apagar": a notícia que a passagem
      // legítima teria levado continua lá, e o acervo está inteiro.
      expect(await identificadoresCrusPresentes([alemDoPrazo])).toEqual([alemDoPrazo]);
      expect([...(await readdir(diretorioDosBoletos))].sort()).toEqual([...ACERVO_INTEIRO].sort());
    },
    LIMITE_DO_CASO_MS,
  );
});

// ---------------------------------------------------------------------------
// Acessórios — a fiação da operação
// ---------------------------------------------------------------------------

/**
 * Conecta a fila real e registra o consumidor da manutenção com a guarda informada.
 *
 * É a **mesma** fiação de `apps/worker/src/main.ts`: `conectarFila` mais
 * `processar(fila.manutencaoDoAcervo, …)`, com a borda recebendo o acesso ao banco, a guarda e o
 * prazo por parâmetro (ADR-0025).
 *
 * ⚠️ **Uma fila por caso, e nunca em laço.** Cada chamada registra um consumidor novo na MESMA fila;
 * dois vivos ao mesmo tempo competem pela tarefa, e o desfecho passa a depender de qual venceu.
 */
function montarConsumidor(guarda: GuardaDeBoletos): Fila {
  const logger = criarLogger({ nivel: 'fatal', destino: { write: () => undefined } });
  const fila = conectarFila(instanciaDaFila.cadeiaConexao, logger);

  onTestFinished(async () => {
    await fila.encerrar();
  });

  fila.processar(
    fila.manutencaoDoAcervo,
    async (tarefa, registrador) =>
      await processarManutencaoDoAcervo(tarefa, registrador, {
        banco: acesso,
        guarda,
        diasDeRetencaoDosBoletos: DIAS_DE_RETENCAO,
      }),
  );

  return fila;
}

/**
 * Enfileira a carga e **sonda** até a tarefa alcançar estado terminal.
 *
 * A espera é por estado observável no próprio servidor de fila, com limite em constante nomeada —
 * nunca por pausa fixa (`.claude/rules/testing-stack.md`).
 */
async function executarTarefa(
  fila: Fila,
  carga: CargaDaManutencaoDoAcervo,
  tentativas?: number,
): Promise<TarefaDaManutencaoDoAcervo> {
  const enfileirada = await fila.manutencaoDoAcervo.add(
    FILA_DA_MANUTENCAO_DO_ACERVO,
    carga,
    tentativas === undefined ? {} : { attempts: tentativas },
  );
  const id = enfileirada.id;

  if (typeof id !== 'string' || id.length === 0) {
    throw new Error('o servidor de fila não atribuiu identificador à tarefa enfileirada');
  }

  await sondarAte(
    `a tarefa ${id} alcançar estado terminal`,
    async () => {
      const estado = await (await fila.manutencaoDoAcervo.getJob(id))?.getState();

      return estado === 'completed' || estado === 'failed';
    },
    LIMITE_ESTADO_TERMINAL_MS,
  );

  const terminada = await fila.manutencaoDoAcervo.getJob(id);
  if (terminada === undefined) {
    throw new Error(`a tarefa ${id} desapareceu da fila antes da leitura do estado final`);
  }

  return terminada;
}

/**
 * Grava uma notícia crua pela porta de produção e a **envelhece pelo relógio do banco**.
 *
 * ⚠️ **Precondição privilegiada, e a forma é o que a torna legítima.** A linha nasce por
 * `registrarNotificacaoBancaria`; o que o arranjo faz é **mover o dado**, e o instante sai de `now()`
 * do servidor — nunca de `new Date()` do processo, que seria o segundo eixo de relógio que a ADR-0026
 * fecha, e que decidiria o desfecho do caso fora do SUT.
 *
 * Sem contexto de tenant: a tabela vive em `plataforma` e não tem dono-empresa (ADR-0031).
 */
async function semearCru(dias: number, margemMinutos = 0): Promise<string> {
  return await acesso.emUnidadeDeTrabalho(async (tx) => {
    const id = await registrarNotificacaoBancaria(tx, { recebido: CORPO_DA_NOTICIA });

    // A margem é SOMADA ao instante — ela rejuvenesce a linha —, e vive no arranjo, jamais no corte.
    // Ver {@link MARGEM_DA_BORDA_MINUTOS} para por que a borda exata não é observável aqui.
    const resultado = await tx`
      UPDATE plataforma.notificacao_bancaria
         SET recebido_em = now()
                         - make_interval(days => ${dias}::integer)
                         + make_interval(mins => ${margemMinutos}::integer)
       WHERE id = ${id}::uuid
    `;

    if (resultado.count !== 1) {
      throw new Error(`o arranjo não alcançou a notificação ${id} para envelhecê-la`);
    }

    return id;
  });
}

/**
 * Quais dos identificadores informados **ainda existem**, ordenados.
 *
 * Devolver a lista dos presentes — em vez de um booleano por linha — é o que faz a asserção ser de
 * igualdade de conjunto: a reprovação nomeia **quais** sobraram e quais faltaram, nos dois sentidos.
 */
async function identificadoresCrusPresentes(identificadores: readonly string[]): Promise<string[]> {
  const presentes: string[] = [];

  for (const id of identificadores) {
    const linha = await acesso.emUnidadeDeTrabalho(
      async (tx) => await lerNotificacaoBancaria(tx, id),
    );

    if (linha !== undefined) {
      presentes.push(id);
    }
  }

  return presentes.sort();
}

/**
 * Monta o acervo num diretório temporário: um boleto **vencido** e um **no prazo**.
 *
 * Os dois são gravados pela porta legítima da guarda — é o que liga o que `gravar` produz ao que o
 * expurgo varre —, e a idade é fabricada por `utimes` no ARRANJO. O arranjo pode ler o relógio; o SUT
 * não (ADR-0026).
 *
 * O controle no prazo é obrigatório: sem ele, "o vencido sumiu" seria satisfeito por um expurgo que
 * apagasse o diretório inteiro.
 */
async function semearAcervo(): Promise<{ guarda: GuardaDeBoletos }> {
  diretorioDosBoletos = await mkdtemp(join(tmpdir(), 'sysloc-manutencao-boletos-'));
  onTestFinished(async () => {
    await rm(diretorioDosBoletos, { recursive: true, force: true });
  });

  const guarda = criarGuardaDeBoletos(diretorioDosBoletos);

  const vencido = await guarda.gravar(CODIGO_DO_BOLETO_VENCIDO, BYTES_DO_BOLETO);
  const carimbo = new Date(Date.now() - (DIAS_DE_RETENCAO + 1) * MS_POR_DIA);
  await utimes(join(diretorioDosBoletos, vencido), carimbo, carimbo);

  await guarda.gravar(CODIGO_DO_BOLETO_RECENTE, BYTES_DO_BOLETO);

  // Controle antivácuo do arranjo: os dois estão lá antes da passagem.
  expect([...(await readdir(diretorioDosBoletos))].sort()).toEqual([...ACERVO_INTEIRO].sort());

  return { guarda };
}
