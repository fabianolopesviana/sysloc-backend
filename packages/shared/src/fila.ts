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
 *
 * ---------------------------------------------------------------------------
 * A SEGUNDA CLASSE DE CARGA — a entrada de fato de terceiro, que NÃO carrega empresa
 * ---------------------------------------------------------------------------
 *
 * O parágrafo acima descreve a **primeira** classe, e continua verdadeiro palavra por palavra para
 * cada uma das cargas que a habitam: {@link CargaDaRegua}, {@link CargaDaConfirmacao},
 * {@link CargaDaEmissaoEmLote}, {@link CargaDaConferenciaBancaria} e
 * {@link CargaDaReconferenciaDaEntrega} levam `empresaId` porque **quem enfileira já detinha direito
 * a ele** — a sessão que atendeu o pedido, ou a enumeração de tenants.
 *
 * {@link CargaDaNotificacaoBancaria} é a **segunda** classe, e ela não tem empresa alguma. A borda
 * que a enfileira recebe um **fato produzido por um terceiro** que não é usuário do sistema e nunca
 * terá sessão (ADR-0035): ela **não sabe — e não pode saber** — de que empresa o fato é, porque
 * descobrir é justamente o trabalho da tarefa, por travessia nominal ao registro que o próprio
 * produto emitiu. O único valor de empresa disponível na borda viria do **recebido**, e aceitá-lo é
 * literalmente a terceira *Alternativa rejeitada* da ADR-0035 e o que a cláusula de procedência da
 * ADR-0024 proíbe.
 *
 * A **terceira emenda da ADR-0024** (2026-08-18) é quem declara este alcance, e ela é a razão de a
 * ausência do campo **não** ser violação: *"a carga NÃO carrega empresa quando a empresa é o
 * resultado da travessia nominal… aí o contexto vem do registro resolvido, uma única vez, na borda
 * que o resolve"*. Sem essa emenda, a abertura da `Decision` — *"estabelece o contexto de tenant a
 * partir da carga do próprio trabalho"* — leria como exigência universal, e este módulo pareceria
 * contrariá-la.
 *
 * ⚠️ **Acrescentar `empresaId` aqui não seria conformidade, seria violação.** É a armadilha mais
 * provável de quem editar este arquivo por analogia com as cinco cargas de cima.
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
 * Nome da fila da entrega da confirmação de endereço de e-mail do locatário.
 *
 * Ela é a **primeira fila com produtor em produção**: quem enfileira é a borda HTTP (`apps/api`),
 * pelos dois gatilhos que convergem no mesmo caminho — o automático do cadastro e o manual do
 * operador —, e quem consome é o processador de trabalho. Vale aqui, palavra por palavra, a razão
 * de {@link FILA_DA_REGUA}: um literal repetido dos dois lados é a divergência que nenhuma
 * ferramenta apanha, porque o trabalho fica parado **sem erro nenhum**.
 */
export const FILA_DA_CONFIRMACAO = 'confirmacao-de-email';

/**
 * Nome da fila da tarefa de ida e volta.
 *
 * Ela não tem produtor em produção: existe para provar que o caminho fila → processador funciona
 * de ponta a ponta, e continua na suíte depois de haver tarefa real.
 */
export const FILA_DO_ECO = 'eco';

/**
 * Nome da fila da **emissão em lote** dos boletos de uma competência.
 *
 * Quem enfileira é a borda HTTP (`apps/api`), quando o Admin abre o lote; quem consome é o processo
 * de trabalho, que percorre as cobranças em aberto e sem boleto. Vale aqui, palavra por palavra, a
 * razão de {@link FILA_DA_REGUA}: um literal repetido dos dois lados é a divergência que nenhuma
 * ferramenta apanha, porque o trabalho fica parado **sem erro nenhum**.
 */
export const FILA_DA_EMISSAO_EM_LOTE = 'emissao-em-lote';

/**
 * Nome da fila da **conferência bancária** — a apuração periódica junto ao provedor.
 *
 * Mesma razão da anterior, e com um agravante próprio: a conferência é o caminho por onde o produto
 * descobre pagamento feito fora dele. Uma tarefa enfileirada sob nome que ninguém escuta faria o
 * produto **deixar de acusar pagamento** sem que nada falhasse.
 */
export const FILA_DA_CONFERENCIA_BANCARIA = 'conferencia-bancaria';

/**
 * Nome da fila do **tratamento da notícia bancária** — o fato que o provedor envia sem sessão.
 *
 * Quem enfileira é a borda HTTP (`apps/api`), logo depois de gravar o recebido cru; quem consome é o
 * processo de trabalho, que interpreta, roteia e decide o desfecho. Vale aqui, palavra por palavra,
 * a razão de {@link FILA_DA_REGUA}: um literal repetido dos dois lados é a divergência que nenhuma
 * ferramenta apanha, porque o trabalho fica parado **sem erro nenhum**.
 *
 * O agravante próprio desta fila é o mesmo de {@link FILA_DA_CONFERENCIA_BANCARIA}, e mais um: a
 * notícia é o caminho por onde o produto **descobre pagamento no mesmo dia**, e o terceiro que a
 * envia já recebeu o `204`. Uma tarefa enfileirada sob nome que ninguém escuta ficaria parada em
 * `RECEBIDO` sem que nada falhasse — e sem que ninguém a reenviasse.
 */
export const FILA_DA_NOTIFICACAO_BANCARIA = 'notificacao-bancaria';

/**
 * Nome da fila da **reconferência da entrega da notícia** — a releitura do estado junto ao provedor.
 *
 * Quem enfileira é a borda HTTP (`apps/api`), logo depois de o Admin registrar um certificado novo:
 * o material trocou, e o que o produto sabe sobre a entrega daquela empresa passou a descrever um
 * aperto de mão que já não é o mesmo. Quem consome é o processo de trabalho, que reconsulta e grava
 * **só quando o desfecho muda**.
 *
 * Vale aqui, palavra por palavra, a razão de {@link FILA_DA_REGUA}: um literal repetido dos dois
 * lados é a divergência que nenhuma ferramenta apanha, porque o trabalho fica parado **sem erro
 * nenhum**. O agravante próprio desta fila é o oposto do das irmãs bancárias — nada se perde de
 * imediato quando ela não é escutada, e é justamente por isso que ela precisa do nome único: a
 * ausência de efeito é indistinguível de *"nada mudou"*, que é o desfecho normal da reconferência.
 */
export const FILA_DA_RECONFERENCIA_DA_ENTREGA = 'reconferencia-da-entrega';

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

/**
 * Carga útil da entrega de **uma** confirmação de endereço de e-mail.
 *
 * ---------------------------------------------------------------------------
 * Os TRÊS campos são obrigatórios, e o terceiro é o SEGREDO EM CLARO
 * ---------------------------------------------------------------------------
 *
 * A obrigatoriedade de `empresaId` é a mesma decisão de {@link CargaDaRegua}, com a mesma razão da
 * ADR-0024 — ver o cabeçalho deste módulo. O que é próprio desta carga é o terceiro campo, e ele
 * merece o parágrafo abaixo porque parece um descuido e não é.
 *
 * **É `segredo`, e não o identificador do portador.** A borda sorteia o segredo, grava apenas
 * `sha256(segredo)` e descarta o claro ao fim da transação: nem ela consegue reconstruí-lo depois —
 * é exatamente a impossibilidade que a RN-11 exige, e ela vale **também para o nosso próprio
 * processo**. Quem monta o link precisa do claro; carregar o identificador do portador seria
 * inútil, porque o consumidor leria o derivado e continuaria sem o que pôr no link.
 *
 * O que fecha o risco de o claro viajar aqui, e cada metade é verificável: (a) ele **nunca** é
 * gravado no banco — a coluna do claro não existe; (b) `segredo` está na lista de radicais
 * **redigidos** do despacho único de redação de `./log.ts`, de modo que ele não aparece em registro
 * nenhum; (c) ele vive no servidor de fila apenas pelo tempo da tarefa. A exposição residual — a
 * retenção de tarefas concluídas declarada em {@link OPCOES_PADRAO_DA_TAREFA} — é **declarada**, e
 * não descoberta.
 */
export interface CargaDaConfirmacao {
  /**
   * A empresa do locatário cujo endereço será confirmado.
   *
   * Obrigatório por decisão da ADR-0024, e produzido por quem **já detinha direito a ele** — a
   * sessão que atendeu o pedido —, nunca aceito de fonte externa.
   */
  readonly empresaId: string;
  /** O locatário a quem a mensagem se destina. O endereço é lido do cadastro, sob a política. */
  readonly locatarioId: string;
  /** O segredo em claro do portador recém-emitido. Ver o cabeçalho desta interface. */
  readonly segredo: string;
}

/** Carga útil da tarefa de ida e volta. */
export interface CargaDoEco {
  /** O valor que a tarefa devolve inalterado. */
  readonly valor: string;
}

/**
 * Carga útil da emissão em lote de **uma** empresa — **dois** identificadores, e nada mais.
 *
 * ---------------------------------------------------------------------------
 * A AUSÊNCIA DE SEGREDO É O MECANISMO, e não uma promessa deste docblock
 * ---------------------------------------------------------------------------
 *
 * A emissão precisa do certificado da empresa para falar com o provedor, e a forma intuitiva —
 * mandar o material junto, já que quem abriu o lote o tem em mãos — é a que reabre o **vetor exato**
 * do achado crítico da fase anterior: a carga viaja como argumento de comando do servidor de fila
 * (`job.data` serializado), a biblioteca de acesso anexa `err.command = { name, args }` a qualquer
 * erro de resposta, e a redação única alcança chave sensível **pelo nome** — que ali não existe.
 * O desfecho seria o segredo em claro no diário, publicado pelo próprio `catch` que existe para
 * protegê-lo.
 *
 * Por isso o que viaja são **identificadores**: o processo de trabalho resolve o certificado pelo
 * **banco**, sob o contexto de tenant que esta mesma carga estabelece, e o decifra com a chave do
 * próprio ambiente. Não há o que redigir porque não há o que carregar — é a ADR-0032 aplicada à
 * superfície `fila`, e ela é **medida** pelo `CT-935` de `apps/api/test/segredo-nao-escapa.e2e.spec.ts`,
 * não afirmada por leitura de código.
 *
 * `empresaId` é obrigatório por decisão da ADR-0024 — ver o cabeçalho deste módulo. Um campo
 * opcional reabriria o pior modo de falha da ADR-0008: sem contexto, a política devolve vazio **em
 * silêncio** e o trabalho *parece* ter rodado.
 */
export interface CargaDaEmissaoEmLote {
  /**
   * A empresa cujo lote o trabalho vai percorrer.
   *
   * Produzido por quem **já detinha direito a ele** — a sessão que atendeu o pedido —, nunca aceito
   * de fonte externa.
   */
  readonly empresaId: string;
  /**
   * O lote **já gravado** que a tarefa executa.
   *
   * Ele existe antes de a tarefa ser enfileirada, e é isso que torna a repetição segura: a entrega é
   * *at-least-once*, e a tarefa repetida opera sobre o **mesmo** registro em vez de criar um segundo.
   */
  readonly loteId: string;
}

/**
 * Carga útil da conferência bancária de **uma** empresa — **dois** identificadores, e nada mais.
 *
 * Vale para ela, palavra por palavra, o cabeçalho de {@link CargaDaEmissaoEmLote}: a conferência
 * também apresenta a identidade da empresa ao provedor, e também **não** leva material, senha,
 * envelope cifrado ou credencial — o processo de trabalho os resolve pelo banco. A ausência é o
 * mecanismo.
 */
export interface CargaDaConferenciaBancaria {
  /** A empresa cujas cobranças a apuração vai percorrer. Obrigatório pela ADR-0024. */
  readonly empresaId: string;
  /** A conferência **já aberta** que a tarefa executa — a mesma razão do `loteId`. */
  readonly conferenciaId: string;
}

/**
 * Carga útil do tratamento de **uma** notícia bancária — **um** identificador, e nada mais.
 *
 * ---------------------------------------------------------------------------
 * A AUSÊNCIA DE EMPRESA É O MECANISMO — ver a "SEGUNDA CLASSE DE CARGA" no cabeçalho
 * ---------------------------------------------------------------------------
 *
 * Esta é a única carga do produto sem `empresaId`, e a ausência é a decisão, não um esquecimento: a
 * borda que enfileira **não sabe** de que empresa o fato é. Descobrir é o trabalho da tarefa, que o
 * faz pela travessia nominal `negocio.rotear_notificacao_bancaria` — cuja assinatura, por decisão,
 * **não tem por onde receber empresa**. O contexto de tenant nasce do **registro resolvido**, uma
 * vez só, e é a **terceira emenda da ADR-0024** (2026-08-18) que declara esse alcance.
 *
 * Acrescentar aqui um campo de empresa exigiria tirá-lo do **recebido** — a única fonte disponível
 * na borda —, o que é a terceira *Alternativa rejeitada* da ADR-0035 (*"aceitar a empresa declarada
 * no recebido… faz uma origem externa escolher o tenant"*).
 *
 * Vale aqui, também, o cabeçalho de {@link CargaDaEmissaoEmLote}: **nada de segredo viaja**. O que
 * segue é um identificador de linha, e o recebido cru — que carrega dado pessoal do pagador —
 * permanece na coluna `jsonb` com prazo de guarda, alcançado pela tarefa a partir deste `id`.
 */
export interface CargaDaNotificacaoBancaria {
  /**
   * A notícia **já gravada** que a tarefa vai tratar.
   *
   * Ela existe antes de a tarefa ser enfileirada, e é isso que torna a repetição segura: a entrega é
   * *at-least-once*, e a tarefa repetida opera sobre o **mesmo** registro. É a mesma razão do
   * `loteId` de {@link CargaDaEmissaoEmLote}.
   */
  readonly notificacaoId: string;
}

/**
 * Carga útil da **reconferência da entrega da notícia** de uma empresa — **um** identificador.
 *
 * ---------------------------------------------------------------------------
 * `empresaId` está presente, e isso é CONFORMIDADE — não a violação que a carga vizinha descreve
 * ---------------------------------------------------------------------------
 *
 * Ela pertence à **primeira** classe do cabeçalho, e não à segunda: quem a enfileira é a borda que
 * acabou de atender o registro do certificado, **sob a sessão do Admin daquela empresa** — de modo
 * que o identificador é produzido por quem **já detinha direito a ele**, e não lido de nada que um
 * terceiro tenha enviado. É literalmente o alcance que a **terceira emenda da ADR-0024**
 * (2026-08-18) declara.
 *
 * ⚠️ **Não a leia por analogia com {@link CargaDaNotificacaoBancaria}**, que é a vizinha logo acima
 * e a única do produto sem empresa. Lá a empresa é o **resultado** da travessia nominal e o campo
 * não existe porque a borda não sabe — nem pode saber — de que empresa o fato é; aqui a borda sabe,
 * porque foi ela quem atendeu a sessão. **Tirar o campo daqui não seria conformidade, seria reabrir
 * o pior modo de falha da ADR-0008**: sem contexto, a política devolve vazio **em silêncio** e a
 * reconferência *parece* ter rodado sobre uma empresa sem entrega configurada.
 *
 * Vale aqui, também, o cabeçalho de {@link CargaDaEmissaoEmLote}: **nada de segredo viaja**. O
 * certificado e a identidade são resolvidos pelo banco, sob o contexto que esta carga estabelece, e
 * decifrados com a chave do ambiente do processo de trabalho (ADR-0032). A ausência é o mecanismo.
 */
export interface CargaDaReconferenciaDaEntrega {
  /**
   * A empresa cuja entrega da notícia será reconferida junto ao provedor.
   *
   * Obrigatório por decisão da ADR-0024 — ver o cabeçalho desta interface e o do módulo.
   */
  readonly empresaId: string;
}
