/**
 * Contrato das filas de trabalho: **nome**, **política de repetição** e **carga útil**.
 *
 * ---------------------------------------------------------------------------
 * Por que ele mora aqui, e não em `apps/worker` — o D32 (F0/T6) fechado
 * ---------------------------------------------------------------------------
 *
 * Até esta fatia o contrato vivia dentro de `apps/worker/src/fila.ts`, que é aplicação privada e
 * **sem `exports`**: nenhum produtor conseguiria importá-lo. O marcador do débito registrava a
 * consequência e o gatilho — *"na primeira fatia que enfileirar tarefa de negócio"*, que é esta —,
 * e prescrevia duas saídas: extrair, ou declarar a duplicação como deliberada nos dois lados. A
 * decisão é **extrair**, porque a segunda saída preserva exatamente a divergência que o débito
 * nomeia.
 *
 * O que estava em risco não é estética. {@link OPCOES_PADRAO_DA_TAREFA} chega à biblioteca de fila
 * como `defaultJobOptions`, e essas opções valem **só para a instância que as declara**: um
 * produtor construído em outro processo — a borda da aplicação, o relógio da F5, a própria suíte —
 * ou repetiria as quatro opções à mão, ou as ignoraria em silêncio. Nos dois casos a política
 * documentada como *"a de produção"* passaria a valer apenas no processo do consumidor, e a
 * divergência não tem quem a acuse: a tarefa é aceita, roda, e só a repetição se comporta
 * diferente.
 *
 * ---------------------------------------------------------------------------
 * Este módulo NÃO ganha dependência — a restrição é parte da decisão
 * ---------------------------------------------------------------------------
 *
 * O nome é cadeia, as opções são objeto estrutural e as cargas são interfaces: nada aqui precisa
 * da biblioteca de fila. O tipo `Job<…>` continua morando em `apps/worker`, que é quem a consome.
 * Trazer `bullmq` para `@sysloc/shared` faria **todo** consumidor de registro estruturado e de
 * erros do monorepo — a API inclusive — arrastar a biblioteca de fila junto.
 *
 * ---------------------------------------------------------------------------
 * ADR-0024 — a carga é a origem do contexto de tenant quando não há requisição
 * ---------------------------------------------------------------------------
 *
 * {@link CargaDaRegua} tem **um** campo, e ele é **obrigatório**. Não é conveniência de tipagem: é
 * a materialização literal da decisão. Trabalho fora do ciclo de uma requisição estabelece o
 * contexto a partir da carga do próprio trabalho, **uma vez, na borda que a recebe** — e o
 * identificador que viaja nela é produzido por quem já detinha direito a ele (a enumeração de
 * empresas), **nunca aceito de fonte externa**. Um campo opcional reabriria o pior modo de falha
 * que a ADR-0008 fechou: sem contexto, a RLS devolve vazio **em silêncio** e o trabalho *parece*
 * ter rodado.
 */

/**
 * As quatro constantes abaixo são **privadas do módulo**, e a ausência de `export` é a decisão.
 *
 * Publicá-las oferece a um produtor futuro as peças para montar `{ attempts, backoff, … }` à mão —
 * um **segundo caminho, mais fraco**, para a mesma política, que é exatamente a divergência que o
 * fecho do `D32 (F0/T6)` existiu para eliminar quando o contrato da fila desceu para cá. Quem
 * enfileira consome `OPCOES_PADRAO_DA_TAREFA`, que é o **único** caminho publicado.
 *
 * Elas nasceram exportadas na T7 e não tinham consumidor algum fora deste pacote — o `CT-638`
 * confirma pela outra ponta, exigindo do `worker` exatamente cinco símbolos, nenhum deles aqui.
 * O `CT-638` continua provando a unicidade da definição: `definicaoDe()` casa
 * `(?:export\s+)?(?:const|…)`, de modo que a definição privada segue encontrada.
 */

/** Tentativas de execução de uma tarefa antes de ela ser dada por falha. */
const TENTATIVAS_POR_TAREFA = 3;

/** Espera antes da segunda tentativa; as seguintes dobram a partir dela. */
const ESPERA_ENTRE_TENTATIVAS_MS = 1_000;

/**
 * Quantas tarefas terminadas o servidor de fila retém.
 *
 * O padrão da biblioteca é reter **todas**, e o servidor grava tudo em disco (a persistência
 * ligada na F0) — reter sem limite faria a fila crescer para sempre em memória e no registro
 * contínuo. O que se retém é o suficiente para diagnosticar o passado recente; falha é retida por
 * mais tempo que sucesso porque é ela que alguém volta para ler.
 */
const TAREFAS_CONCLUIDAS_RETIDAS = 1_000;
const TAREFAS_FALHAS_RETIDAS = 5_000;

/**
 * Nome da fila do trabalho da régua de cobrança.
 *
 * Quem enfileira e quem consome precisam do mesmo nome, e um literal repetido dos dois lados é uma
 * divergência que nenhuma ferramenta apanha: o produtor grava em `regua-de-cobranca`, o consumidor
 * escuta outro nome, e o trabalho fica parado **sem erro nenhum**.
 */
export const FILA_DA_REGUA = 'regua-de-cobranca';

/**
 * Nome da fila da tarefa de ida e volta.
 *
 * Ela não tem produtor em produção: existe para provar que o caminho fila → processador funciona
 * de ponta a ponta, e continua na suíte depois de haver tarefa real.
 */
export const FILA_DO_ECO = 'eco';

/**
 * Opções aplicadas a toda tarefa enfileirada, por qualquer produtor.
 *
 * Falha de execução é frequentemente transitória (a dependência que a tarefa consulta piscou): a
 * tarefa é retentada com espera crescente, e só depois da última tentativa é dada por falha.
 *
 * ⚠️ Reduzir tentativas para observar uma falha depressa é opção da tarefa **enfileirada**, e não
 * desta política — mexer aqui trocaria o comportamento de produção para acomodar a verificação.
 */
export const OPCOES_PADRAO_DA_TAREFA = {
  attempts: TENTATIVAS_POR_TAREFA,
  backoff: { type: 'exponential', delay: ESPERA_ENTRE_TENTATIVAS_MS },
  removeOnComplete: { count: TAREFAS_CONCLUIDAS_RETIDAS },
  removeOnFail: { count: TAREFAS_FALHAS_RETIDAS },
} as const;

/** Carga útil do trabalho da régua de cobrança de **uma** empresa. */
export interface CargaDaRegua {
  /**
   * A empresa cujas cobranças o trabalho vai percorrer.
   *
   * Obrigatório por decisão da ADR-0024 — ver o cabeçalho. A procedência **não é verificável pelo
   * banco**: ela é disciplina de quem enfileira, provada por teste.
   */
  readonly empresaId: string;
}

/** Carga útil da tarefa de ida e volta. */
export interface CargaDoEco {
  /** O valor que a tarefa devolve inalterado. */
  readonly valor: string;
}
