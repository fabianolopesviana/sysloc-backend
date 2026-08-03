/**
 * Unidade de trabalho — a **única** porta pública para dado de negócio.
 *
 * ---------------------------------------------------------------------------
 * O que ela é
 * ---------------------------------------------------------------------------
 *
 * `BEGIN` → `SET LOCAL app.empresa_id` → operações → `COMMIT`. Nessa ordem, e a ordem é o
 * mecanismo: o contexto é fixado **antes da primeira instrução de negócio**, de modo que não existe
 * janela em que uma consulta corra sem política aplicável.
 *
 * `SET LOCAL` morre com a transação. É essa propriedade — e não uma limpeza escrita por alguém —
 * que impede o valor de sobreviver para a requisição seguinte que pegue a mesma conexão da reserva.
 * Uma limpeza escrita à mão teria de rodar também nos caminhos de erro, e é justamente ali que ela
 * seria esquecida.
 *
 * ---------------------------------------------------------------------------
 * A exceção auditada à consulta parametrizada (§11.4 da tech spec)
 * ---------------------------------------------------------------------------
 *
 * `SET LOCAL` **não aceita parâmetro vinculado** — é comando utilitário, não expressão. Compor a
 * instrução é, portanto, inevitável, e é a única composição de SQL desta fatia. O que a torna
 * segura é a ordem: o identificador é **validado como UUID antes** de entrar na cadeia, e um valor
 * que não seja UUID nunca chega a existir dentro de uma instrução — ele levanta
 * `ErroDeContextoInvalido` enquanto a transação sequer foi aberta.
 *
 * A alternativa `set_config('app.empresa_id', $1, true)` aceita vínculo e é o que
 * `semente.ts` usa — mas ali o valor é constante do próprio módulo. Aqui o valor vem da sessão, e
 * a spec exige a forma com validação prévia justamente para que o caso negativo exista e seja
 * exercitado (CT-011). Trocar a forma apagaria a prova.
 *
 * ---------------------------------------------------------------------------
 * "Sem empresa" é UM modo só, e a fixação é SEMPRE emitida
 * ---------------------------------------------------------------------------
 *
 * Há duas maneiras de uma unidade correr sem empresa — ninguém chamou o escritor de contexto, ou o
 * contexto é o do Sysloc Master (`empresaId` nulo) —, e as duas terminam na **mesma** instrução:
 * `SET LOCAL app.empresa_id = ''`, que o `nullif(..., '')` da política resolve para nulo. Leitura
 * vazia, gravação recusada, pelo banco, sem ramo condicional de aplicação — não há, em lugar algum
 * deste pacote, um `if` por perfil de usuário no caminho do dado.
 *
 * A alternativa óbvia — **não** emitir nada quando não há o que fixar — parece equivalente e não é.
 * A frase "`SET LOCAL` morre com a transação" vale para o que este módulo emite, e nada diz sobre um
 * valor deixado em nível de **sessão**. O `tx` é entregue ao `trabalho`, e um
 * `SET app.empresa_id = '<uuid>'` (sem `LOCAL`) numa transação que commita **sobrevive na conexão
 * física**. Numa unidade que não emitisse fixação, a política leria esse resíduo — e "sem contexto"
 * deixaria de ser leitura vazia para virar leitura de **outra empresa**, sem erro e sem alarme.
 * Emitir sempre torna a garantia propriedade da unidade, não do histórico da conexão.
 *
 * ---------------------------------------------------------------------------
 * Aninhamento é recusado, não silenciado
 * ---------------------------------------------------------------------------
 *
 * Uma unidade aberta de dentro de outra reservaria **outra** conexão e abriria uma segunda transação
 * **independente**: o `COMMIT` de dentro seria definitivo mesmo com `ROLLBACK` do lado de fora e,
 * com a reserva pequena, o aninhamento simplesmente travaria esperando conexão. Os dois modos de
 * falha ficam longe da causa. Enquanto nenhuma fatia precisar de transação aninhada de verdade — o
 * que exigiria `SAVEPOINT`, via `tx.begin` do `postgres.js` —, a unidade **recusa** o aninhamento
 * com erro nomeado, porque a única resposta que não se pode dar aqui é o silêncio.
 */

import { AsyncLocalStorage } from 'node:async_hooks';
import type { Sql, TransactionSql } from 'postgres';
import { abrirConexao } from './conexao.js';
import { type ContextoDeTenant, corrente } from './contexto.js';

/** A variável de sessão que as políticas de `negocio` consultam. */
const VARIAVEL_DE_CONTEXTO = 'app.empresa_id';

/**
 * Marca "existe uma unidade de trabalho aberta nesta cadeia de execução".
 *
 * Armazenamento **próprio deste módulo**, e não o do contexto de tenant: são coisas de vida
 * diferente — o contexto vale pela requisição inteira, a marca vale pela transação. Guardá-las
 * juntas faria uma reescrever a outra no fim da transação, e o contexto da requisição sumiria no
 * meio dela.
 */
const unidadeAberta = new AsyncLocalStorage<true>();

/**
 * Forma canônica do UUID, âncora a âncora.
 *
 * Sem as âncoras, `'x' + uuid + "'; DROP ..."` casaria — e a composição da instrução deixaria de
 * ser segura exatamente no caso que ela existe para barrar.
 */
const PADRAO_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * O que a mensagem de erro mostra no lugar do valor recusado. Mesmo sentinela de
 * `packages/shared/src/log.ts` — o valor recusado é entrada não confiável, e repeti-lo na mensagem
 * o leva para o registro estruturado por outro caminho.
 */
const SENTINELA_REDIGIDO = '[REDIGIDO]';

/**
 * Identificador de empresa que não é UUID, recusado **antes** de compor a instrução de fixação.
 *
 * Erro com nome próprio, e não `Error` genérico: quem trata precisa distinguir "o contexto da
 * sessão está corrompido" de "o banco recusou a operação", e as duas coisas têm resposta diferente.
 */
export class ErroDeContextoInvalido extends Error {
  constructor() {
    super(`identificador de empresa inválido para ${VARIAVEL_DE_CONTEXTO}: ${SENTINELA_REDIGIDO}`);
    this.name = 'ErroDeContextoInvalido';
  }
}

/**
 * Unidade de trabalho aberta de dentro de outra — recusada em vez de silenciosamente duplicada.
 *
 * Erro com nome próprio pela mesma razão do anterior: "o chamador aninhou transação" é defeito de
 * composição do código, e não tem nada a ver com "o banco recusou a operação".
 *
 * ---------------------------------------------------------------------------
 * As DUAS causas, e as duas remediações — leia antes de compor serviços
 * ---------------------------------------------------------------------------
 *
 * A recusa em si é decisão fechada (ver o marcador em {@link abrirAcessoAoBanco}). O que **não** é
 * decisão fechada, e chega junto com a primeira camada de serviço, é *quem abre a unidade quando um
 * serviço chama outro*. Este erro tem duas causas com remediações opostas, e confundi-las leva à
 * saída errada:
 *
 * 1. **Aninhamento acidental** — o mesmo fluxo abriu duas unidades por descuido. Remediação: reunir
 *    as operações numa unidade só.
 * 2. **Composição de serviços** — dois serviços legítimos, cada um dono de uma unidade, e um passou
 *    a chamar o outro. Reuni-los seria fundir serviços para satisfazer o mecanismo de transação, o
 *    que é a topologia às avessas. As saídas corretas são duas:
 *    - **unidade na borda**: quem atende a requisição abre a unidade e passa o executor (`tx`)
 *      adiante; os serviços deixam de abrir unidade e passam a receber uma. É a forma preferida
 *      enquanto o ramo interno não precisar desfazer sozinho;
 *    - **`SAVEPOINT` via `tx.begin`**: o ramo interno ganha ponto de desfazimento próprio dentro da
 *      transação corrente. É o que o `REVERTER EXIGE` do marcador nomeia, e exige o caso que prove
 *      que desfazer o ramo interno não deixa efeito gravado.
 *
 * Nenhuma das duas está implementada — o momento de escolher é a fatia que trouxer a camada de
 * repositório, e ela decide com este parágrafo à vista, não por descoberta.
 */
export class ErroDeUnidadeAninhada extends Error {
  constructor() {
    // A mensagem nomeia as duas remediações de propósito: prescrever só "reúna as operações"
    // — como fazia — está certo para o aninhamento acidental e empurra a composição de serviços
    // para a saída errada, que é fundir serviços. Ver o docblock acima.
    super(
      'unidade de trabalho aninhada: já existe transação aberta nesta cadeia de execução — ' +
        'reúna as operações numa única unidade, ou abra a unidade na borda e passe o executor ' +
        'adiante se o aninhamento vem de um serviço chamar outro',
    );
    this.name = 'ErroDeUnidadeAninhada';
  }
}

/** Como a reserva de conexões deste acesso é aberta. */
export interface OpcoesDeAcessoAoBanco {
  /** Cadeia de conexão do papel que atende requisição. Nunca lida do ambiente aqui (ADR-0006). */
  readonly cadeiaDeConexao: string;
  /** Tamanho da reserva. Omitido, vale o padrão da biblioteca. */
  readonly maximoDeConexoes?: number;
}

/**
 * O acesso a dado que o pacote publica.
 *
 * Repare no que ele **não** tem: nenhum executor, nenhuma reserva, nenhum caminho de navegação até
 * o cliente. A §3.3 da tech spec faz disso um invariante de compilação — fora deste pacote,
 * consultar `negocio` sem contexto de tenant não é escrevível, e não apenas desaconselhado.
 */
export interface AcessoAoBanco {
  /**
   * Abre a transação, fixa o contexto da cadeia assíncrona corrente e só então executa `trabalho`.
   *
   * O executor entregue ao `trabalho` já está dentro da transação com o contexto fixado — é a razão
   * de ele poder ser entregue: nenhuma consulta feita com ele alcança linha de outra empresa.
   *
   * Chamada de dentro de outra unidade levanta `ErroDeUnidadeAninhada`, antes de qualquer conexão
   * ser reservada.
   */
  emUnidadeDeTrabalho<T>(trabalho: (tx: TransactionSql) => Promise<T>): Promise<T>;
  /** Encerra a reserva. Quem abriu é dono do recurso, inclusive no caminho de falha. */
  encerrar(): Promise<void>;
}

/**
 * Abre o acesso a dado do processo.
 *
 * Uma instância por processo é o uso esperado (a reserva é o recurso caro); a fábrica existe em vez
 * de um estado de módulo porque estado global de conexão exige um caminho de reconfiguração, e todo
 * caminho de reconfiguração é um caminho pelo qual o acesso passa a apontar para outro banco no
 * meio da execução.
 */
export function abrirAcessoAoBanco(opcoes: OpcoesDeAcessoAoBanco): AcessoAoBanco {
  // O condicional, e não `{ maximoDeConexoes: opcoes.maximoDeConexoes }`: com
  // `exactOptionalPropertyTypes`, passar a propriedade com valor indefinido não é o mesmo que não
  // passá-la — e é a segunda forma que preserva o padrão da biblioteca.
  const sql: Sql = abrirConexao(
    opcoes.cadeiaDeConexao,
    opcoes.maximoDeConexoes === undefined ? {} : { maximoDeConexoes: opcoes.maximoDeConexoes },
  );

  return {
    async emUnidadeDeTrabalho<T>(trabalho: (tx: TransactionSql) => Promise<T>): Promise<T> {
      // DECISÃO FECHADA — T3 / Gate 2 (P2) · 2026-08-02
      // O QUÊ: o aninhamento é recusado aqui, antes de reservar conexão, por marca em
      //        `AsyncLocalStorage` próprio deste módulo.
      // POR QUÊ: sem a recusa, `sql.begin` reserva OUTRA conexão e abre transação independente — o
      //          `COMMIT` de dentro sobrevive ao `ROLLBACK` de fora, e com reserva pequena o
      //          aninhamento trava. Ambos os modos de falha aparecem longe da causa, e a suíte não
      //          os acusa. Silêncio não é resposta admissível na porta única de acesso a dado.
      // REVERTER EXIGE: oferecer aninhamento CORRETO em seu lugar — `tx.begin` (SAVEPOINT) reusando
      //                 a transação corrente —, com caso que prove que o desfazimento do ramo
      //                 interno não deixa efeito gravado.
      if (unidadeAberta.getStore() !== undefined) {
        throw new ErroDeUnidadeAninhada();
      }

      // Fora da transação, de propósito: a validação recusa antes de `BEGIN`, e é isso que faz
      // "nenhuma instrução chega ao servidor" ser verdade — e não "a transação abriu e voltou".
      const fixacao = comporFixacaoDeContexto(corrente());

      const resultado = await sql.begin(async (tx) =>
        unidadeAberta.run(true, async () => {
          await tx.unsafe(fixacao);
          return await trabalho(tx);
        }),
      );

      // `begin` declara `UnwrapPromiseArray<T>` no retorno para acomodar o caso em que o retorno da
      // função é um arranjo de promessas — que aqui não acontece, porque o `trabalho` é aguardado
      // acima. A conversão é o preço de expressar isso ao compilador; o valor é o mesmo objeto.
      return resultado as T;
    },
    encerrar: () => sql.end(),
  };
}

/**
 * Traduz o contexto da cadeia corrente na instrução que fixa a variável de sessão.
 *
 * DECISÃO FECHADA — T3 / Gate 2 (P1) · 2026-08-02
 * O QUÊ: devolve SEMPRE uma instrução. Contexto ausente colapsa no mesmo `SET LOCAL … = ''` do
 *        Sysloc Master; não existe caminho em que a unidade abra sem fixar a variável.
 * POR QUÊ: a versão anterior devolvia `undefined` para contexto ausente e nada era emitido. Isso é
 *          fail-closed apenas enquanto ninguém tiver deixado `app.empresa_id` fixado em nível de
 *          SESSÃO na conexão física — o que um `SET` (sem `LOCAL`) de qualquer `trabalho`, numa
 *          transação que commita, faz. A partir dali, "sem contexto" leria como aquela empresa.
 *          A garantia tem de ser da instrução emitida, não da ausência dela.
 * REVERTER EXIGE: provar que nenhum caminho entrega o `tx` a código capaz de emitir `SET` de
 *                 sessão — hoje o `tx` cru é entregue ao `trabalho`, então não é provável.
 */
function comporFixacaoDeContexto(contexto: ContextoDeTenant | undefined): string {
  // `?? null`, e não desestruturação com ramo para `undefined`: contexto ausente e contexto do
  // Master são o MESMO modo daqui para baixo, e escrevê-los como um só é o que impede a rodada
  // seguinte de reintroduzir a assimetria.
  const empresaId = contexto?.empresaId ?? null;

  if (empresaId === null) {
    return `SET LOCAL ${VARIAVEL_DE_CONTEXTO} = ''`;
  }

  if (!PADRAO_UUID.test(empresaId)) {
    throw new ErroDeContextoInvalido();
  }

  return `SET LOCAL ${VARIAVEL_DE_CONTEXTO} = '${empresaId}'`;
}
