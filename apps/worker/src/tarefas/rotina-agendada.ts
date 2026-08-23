/**
 * A **borda das quatro rotinas por empresa** — onde o contexto de tenant nasce da carga (ADR-0024).
 *
 * ===========================================================================
 * UMA fila para QUATRO rotinas, e o que discrimina é a CARGA
 * ===========================================================================
 *
 * O relógio do sistema provoca o despachante, que enumera as empresas ativas e enfileira **uma tarefa
 * por empresa** com o nome da rotina na carga. Este consumidor é o outro lado: ele confere a carga,
 * abre o contexto **uma vez** e despacha para uma das quatro.
 *
 * A alternativa — uma fila por rotina — foi descartada: o par carga/resultado é o mesmo nas quatro, o
 * encerramento teria quatro produtores a devolver em vez de um, e a rotina nova exigiria emendar
 * `../fila.ts`, `../main.ts` e o despachante para acrescentar um caminho que o campo `rotina` já
 * carrega. O que a fila única não pode ter é **rotina que ninguém trate**, e isso é fechado nos dois
 * sentidos: a união `RotinaDeTrabalho` de `@sysloc/shared` é fechada, {@link ROTINAS_DA_FILA} é
 * cobrada pelo compilador contra ela (`satisfies Record<…>`, que recusa tanto a chave que falta
 * quanto a que sobra), e o despacho termina num `never` que não compila se um ramo faltar.
 *
 * ===========================================================================
 * Por que a carga é RECUSADA antes de qualquer leitura
 * ===========================================================================
 *
 * Vale aqui, palavra por palavra, o cabeçalho de `./regua.ts`: sem contexto, a política do banco não
 * casa linha alguma e devolve conjunto vazio **em silêncio** — o trabalho termina CONCLUÍDO, sem
 * fazer nada, e a rotina *parece* ter rodado. Numa rotina sem ninguém do outro lado isso significa
 * meses de nada acontecendo sem que nada falhe.
 *
 * A conferência é do **esquema**, pela entrada única de `./carga-da-tarefa.ts`, e o identificador vem
 * de `@sysloc/contracts` (ADR-0016): ele confere a forma **e canoniza a caixa do UUID** (ADR-0017),
 * que já foi vetor de escalada. A razão da falha nomeia o **campo**, nunca o valor recebido — ela fica
 * gravada no servidor de fila e alcança o journal, e valor de campo pode ser dado de outra empresa.
 *
 * ===========================================================================
 * O PREDICADO DE EFEITO É DECLARADO POR ROTINA — e é ele que decide se há registro (RN-15)
 * ===========================================================================
 *
 * `registrarExecucaoDeRotina` **não decide**: o docblock dela diz por escrito que quem decide é este
 * consumidor. Enfiar a decisão na camada de dados foi explicitamente recusado, e o risco tem nome —
 * reintroduzir o **registro de passagem vazia**, o histórico de 12 MB por empresa do sistema antigo.
 *
 * Cada ramo declara o **seu** predicado, e nenhum é inferido de *"o resumo não é vazio"*:
 *
 *   * encerramento → `candidatos > 0`;
 *   * conferência → `liquidacoesDescobertas > 0`. ⚠️ Não `cobrancasConferidas > 0`: a passada que
 *     perguntou por trinta títulos e encontrou tudo como estava **não produziu efeito**;
 *   * expurgo → `removidos > 0`;
 *   * vigilância → **não há**: ela só lê.
 *
 * ⚠️ **Vigilância e expurgo NÃO gravam registro, e a impossibilidade é do TIPO.**
 * `ExecucaoDeRotinaNova.rotina` é `RotinaPublicada` — as três do roster do Admin —, de modo que
 * `registrarExecucaoDeRotina(tx, { rotina: 'EXPURGO_DO_HISTORICO', … })` **não compila**. As duas são
 * manutenção, e gravá-las reintroduziria o defeito de 12 MB com outro nome. O predicado delas
 * sobrevive para uma coisa só: decidir o **nível** da linha do diário.
 *
 * ===========================================================================
 * A UNIDADE DE TRABALHO do registro é a MESMA do efeito, onde isso é possível
 * ===========================================================================
 *
 * No encerramento e no expurgo, o trabalho e o registro correm no **mesmo** `tx`: falha no registro
 * desfaz o efeito, e não existe passagem com efeito gravado sem a linha que a conta. É a leitura
 * literal da atomicidade que `encerrarContratosVencidos` declara — *"a unidade é a PASSAGEM, não o
 * par"* —, e é por isso que o resumo devolvido por ela **não sobrevive** ao desfazimento: não há o que
 * registrar quando nada ficou.
 *
 * Na conferência isso é impossível, e a impossibilidade é do desenho dela: a passada usa **uma unidade
 * por cobrança**, de propósito, para que a falha da trigésima não desfaça as vinte e nove anteriores.
 * O registro dela corre, portanto, em unidade própria, depois. A consequência é declarada: uma queda
 * entre o fecho da conferência e o registro deixa a conferência concluída sem linha de execução — o
 * Admin vê a rotina como não executada, e a passagem seguinte a refaz sem duplicar efeito, porque a
 * cobrança já liquidada cai no desfecho benigno da porta.
 *
 * ===========================================================================
 * A VIGILÂNCIA LÊ, e ela NÃO ESCREVE ESTADO (ADR-0022)
 * ===========================================================================
 *
 * Ela consome `lerEstadoDasRotinas` e **filtra** as atrasadas. Quem compara o silêncio contra o limiar
 * é a **consulta**, no banco, na mesma leitura que traz a última execução (ADR-0023 + ADR-0026): o
 * campo `atrasada` chega derivado, e nada aqui recalcula. Uma comparação escrita neste arquivo seria o
 * segundo eixo de atraso do produto, e o primeiro a divergir venceria em silêncio — a tela do Admin
 * diria *"em dia"* enquanto o alerta gritaria, ou o contrário.
 *
 * ⚠️ **O `limiarMinutos` da linha de alerta é LIDO do contrato**, indexado pelo tipo de cadência que a
 * própria leitura devolve. Um número escrito aqui é exatamente o que
 * `LIMIAR_DE_ATRASO_POR_CADENCIA` existe para impedir.
 *
 * A vigilância **não se vigia**, e isso é trade-off declarado da fatia: se ela mesma parar, a falha da
 * unidade cai no `OnFailure=`, mas a parada silenciosa dela não é detectada por nada dentro do
 * produto. Fechar a recursão exige observação **de fora**. **Não é lacuna a "corrigir".**
 *
 * ===========================================================================
 * A FALHA É NOMEADA AQUI — porque o ouvinte genérico da fila não tem como nomeá-la
 * ===========================================================================
 *
 * Quando a passagem levanta, quem registra é o ouvinte `failed` de `../fila.ts`, e ele emite
 * `{ idTarefa, fila, tentativa, erro }` — **sem empresa**. A ausência lá é estrutural e correta:
 * `Fila.processar` é parametrizado pela carga, e a carga da manutenção do acervo é
 * `Record<string, never>`; um ouvinte que fosse buscar `empresaId` dentro de `job.data` teria de
 * supor a forma da carga de **toda** fila do processo, e a primeira sem o campo o faria publicar
 * `undefined` como se fosse um identificador.
 *
 * O resultado, sem esta linha, é o pior possível para quem opera: o despachante enfileira **uma
 * tarefa por empresa por disparo**, e o journal diz *"tarefa terminou em falha"* sem dizer **de
 * quem**. A partir da F5 isso chega ao operador pelo `OnFailure=` da unidade, e ele abre o journal
 * para descobrir qual imobiliária ficou sem a rotina daquele dia.
 *
 * Por isso a borda **nomeia a empresa antes de relançar**, e o lugar é este e não outro: é o único
 * ponto em que `empresaId` já foi conferido pelo `strictObject` e a exceção ainda não saiu. A recusa
 * da carga acontece **antes** e não tem empresa a nomear — por construção, é justamente o campo que
 * faltou.
 *
 * ⚠️ **O relançamento é obrigatório, e não é zelo**: é ele que preserva a política de repetição, o
 * desfecho `failed` e a razão gravada no servidor de fila. A exceção sobe **intacta** — nada é
 * traduzido, nada é absorvido —, e o ouvinte genérico continua emitindo a linha dele. O que esta
 * borda acrescenta é a **identificação**, nunca o tratamento.
 *
 * ===========================================================================
 * O que esta borda faz, e o que ela deliberadamente NÃO faz
 * ===========================================================================
 *
 * Ela liga as pontas e **não decide nada do domínio**: quem seleciona, transiciona e conta é
 * `@sysloc/db`; quem apura a conferência é `@sysloc/cobranca-bancaria`. As portas chegam **por
 * parâmetro** (ADR-0025), e é por isso que a operação injeta o adaptador do provedor e a verificação
 * injeta o dela **pelo mesmo parâmetro**, sem que exista bandeira, ambiente ou ramo que escolha entre
 * os dois.
 *
 * **Nenhuma comparação de empresa é escrita aqui** (ADR-0008): quem recorta é a política do banco.
 * **Nenhum relógio de processo é lido**: o que decide o que venceu, o que atrasou e o que expirou é o
 * relógio do **banco** (ADR-0026). E **nenhuma chave de idempotência é introduzida**: a de cada rotina
 * é a que já a governa — o predicado no encerramento, o `conferencia_bancaria_em_andamento_uidx` na
 * conferência, e a natureza de `DELETE` e de leitura no expurgo e na vigilância.
 */

import { ESQUEMA_DO_IDENTIFICADOR, LIMIAR_DE_ATRASO_POR_CADENCIA } from '@sysloc/contracts';
import {
  abrirConferencia,
  contextoDeTenant,
  encerrarContratosVencidos,
  expurgarExecucoesVencidas,
  lerEstadoDasRotinas,
  type ResumoDaPassagem,
  registrarExecucaoDeRotina,
} from '@sysloc/db';
import { FILA_DA_ROTINA_AGENDADA, type Logger, type RotinaDeTrabalho } from '@sysloc/shared';
import { z } from 'zod';
import type { TarefaDaRotinaAgendada } from '../fila.js';
import { cargaConferida } from './carga-da-tarefa.js';
import {
  type DependenciasDaConferenciaBancaria,
  ehReentrada,
  executarConferenciaDaEmpresa,
  type OrigemDaConferencia,
} from './conferencia-bancaria.js';

/**
 * Os nomes dos dois campos da carga — constantes pela mesma razão das irmãs: cada um aparece no
 * esquema **e** na razão da falha, e dois literais separados divergem sem que nada acuse.
 */
const CAMPO_DA_EMPRESA = 'empresaId';
const CAMPO_DA_ROTINA = 'rotina';

/**
 * A mensagem com que a borda **nomeia a empresa** da passagem que levantou — cadeia EXATA.
 *
 * Constante pela mesma razão dos dois campos acima: ela é o que a verificação usa para localizar a
 * linha entre as demais do diário, e um literal escrito nos dois lados divergiria sem que nada
 * acusasse. Ela **não** repete a do ouvinte genérico de `../fila.ts` (*"tarefa terminou em falha"*),
 * e a distinção é conteúdo: as duas linhas convivem no journal, e igualá-las tornaria impossível
 * separar quem sabe a empresa de quem não sabe.
 */
const MENSAGEM_DA_PASSAGEM_EM_FALHA = 'passagem da rotina agendada falhou';

/**
 * As **quatro** rotinas que esta fila transporta, cobradas pelo compilador nos dois sentidos.
 *
 * `satisfies Record<RotinaDeTrabalho, RotinaDeTrabalho>` sobre um objeto literal recusa a chave que
 * **falta** (a união exige todas) e a que **sobra** (o excesso é erro em literal). É o que impede o
 * esquema de recusar em execução uma rotina que a união publica — a falha mais silenciosa possível,
 * porque a tarefa terminaria em falha retida sem que nada no compilador tivesse acusado.
 *
 * A união vem de `@sysloc/shared`, que **não depende de `zod`** por decisão registrada: a conferência
 * em tempo de execução vive aqui, na borda que recebe a carga, e é aqui que a recusa nomeia o campo.
 */
const ROTINAS_DA_FILA = {
  ENCERRAMENTO_DE_CONTRATOS: 'ENCERRAMENTO_DE_CONTRATOS',
  CONFERENCIA_DE_LIQUIDACAO: 'CONFERENCIA_DE_LIQUIDACAO',
  VIGILANCIA_DAS_ROTINAS: 'VIGILANCIA_DAS_ROTINAS',
  EXPURGO_DO_HISTORICO: 'EXPURGO_DO_HISTORICO',
} as const satisfies Record<RotinaDeTrabalho, RotinaDeTrabalho>;

/**
 * O que a carga da tarefa precisa ser — **exatamente** a empresa e a rotina.
 *
 * `strictObject`, e não `object`: campo desconhecido é **recusado**, em vez de ignorado. A carga é a
 * origem do contexto de tenant, e ignorar o que veio a mais é o começo de ela virar "o novo request"
 * — o `Cons` que a ADR-0024 registra e a alternativa que ela rejeita por nome.
 */
export const esquemaDaCargaDaRotinaAgendada = z.strictObject({
  [CAMPO_DA_EMPRESA]: ESQUEMA_DO_IDENTIFICADOR,
  [CAMPO_DA_ROTINA]: z.enum(ROTINAS_DA_FILA),
});

/** A exigência publicada na razão da falha, nomeando os campos e **nada mais**. */
const EXIGENCIA_DA_CARGA =
  `a carga da tarefa da rotina agendada exige os campos '${CAMPO_DA_EMPRESA}', com um ` +
  `identificador de empresa (UUID), e '${CAMPO_DA_ROTINA}', com uma das rotinas por empresa, e ` +
  'nada além deles';

/**
 * As portas que a composição raiz do processo entrega a esta borda (ADR-0025).
 *
 * É **o mesmo** conjunto da conferência, e o tipo é reusado em vez de redigitado: das quatro rotinas,
 * só ela fala com o provedor, e as outras três precisam apenas do banco — que já está ali. Duas
 * declarações do mesmo conjunto divergiriam na primeira porta acrescentada, e a que ficasse para trás
 * quebraria a composição sem que nada explicasse por quê.
 */
export type DependenciasDaRotinaAgendada = DependenciasDaConferenciaBancaria;

/**
 * O que uma passagem produziu — as contagens e o veredito do predicado de efeito.
 *
 * `houveEfeito` é **declarado pelo ramo que executou**, e nunca recomposto aqui a partir do resumo:
 * recompor criaria um segundo lugar onde se decide o que conta como efeito, e o primeiro a divergir
 * faria a passagem vazia voltar a gravar registro (RN-15).
 */
interface DesfechoDaPassagem {
  /** As contagens da passagem, em vocabulário do produto (RN-19) — o que vai ao diário. */
  readonly resumo: ResumoDaPassagem;
  /** O predicado de efeito da rotina, avaliado por ela. */
  readonly houveEfeito: boolean;
}

/**
 * Executa **uma** passagem de **uma** rotina de **uma** empresa, sob o contexto que a carga declara.
 *
 * @param tarefa       A tarefa, como o servidor de fila a entregou.
 * @param logger       Registrador do processo, recebido do consumidor que a executa.
 * @param dependencias As portas da composição raiz — ver {@link DependenciasDaRotinaAgendada}.
 * @throws {Error} Quando a carga não traz os dois campos válidos — **antes** de qualquer leitura e
 * sem abrir contexto — ou quando alguma porta de dados falha. Nos dois a fila repete pela política
 * declarada em `@sysloc/shared`. No **segundo**, a falha sai do processo já **nomeando a empresa**
 * (ver {@link sobContextoNomeandoAEmpresa}); no primeiro não há empresa a nomear, porque é
 * justamente o campo que faltou.
 */
export async function processarRotinaAgendada(
  tarefa: TarefaDaRotinaAgendada,
  logger: Logger,
  dependencias: DependenciasDaRotinaAgendada,
): Promise<void> {
  // Primeiro a recusa, e só depois o contexto: é a ordem que impede a passagem de correr sem contexto
  // válido e terminar concluída como se tivesse trabalhado.
  const carga = cargaConferida(esquemaDaCargaDaRotinaAgendada, EXIGENCIA_DA_CARGA, tarefa.data);
  const { empresaId, rotina } = carga;

  // O contexto é aberto UMA VEZ, aqui, pelo mesmo escritor único que a borda HTTP usa. Nada abaixo
  // desta linha o reabre — nem a passada da conferência, que corre dentro dele (ADR-0024).
  const passagem = await sobContextoNomeandoAEmpresa(
    tarefa,
    logger,
    empresaId,
    rotina,
    dependencias,
  );

  // O término é REGISTRADO para ser observável de fora do processo. As contagens entram; nenhum
  // código de contrato, endereço ou nome entra — a auditoria por entidade são as tabelas do domínio.
  const evento = {
    idTarefa: tarefa.id,
    fila: FILA_DA_ROTINA_AGENDADA,
    empresaId,
    rotina,
    ...passagem.resumo,
    efeito: passagem.houveEfeito,
  };

  if (passagem.houveEfeito) {
    logger.info(evento, 'passagem da rotina agendada concluída');

    return;
  }

  // Passagem sem efeito é o desfecho NORMAL da maior parte dos disparos — a diária que não achou
  // contrato vencido, o expurgo que não achou linha vencida. Ela sai em diagnóstico, e não em
  // informação, pela mesma razão que ela não deixa registro: o volume é o do relógio, não o do
  // negócio.
  logger.debug(evento, 'passagem da rotina agendada concluída sem efeito');
}

/**
 * Executa a passagem sob o contexto da carga e, se ela levantar, **nomeia a empresa antes de
 * relançar**.
 *
 * Ver a seção homônima do cabeçalho para por que o registro mora aqui e não no ouvinte genérico de
 * `../fila.ts`. Os campos são os mesmos das duas linhas de fecho — `idTarefa`, `fila`, `empresaId`,
 * `rotina` —, de modo que quem lê o journal correlaciona sucesso e falha pelo mesmo vocabulário. O
 * objeto de exceção entra como `erro` e é redigido pela entrada única de `@sysloc/shared`; nenhuma
 * contagem entra, porque a passagem que levantou não produziu nenhuma.
 *
 * @throws Repassa **intacto** o que a passagem levantou — é o que preserva a política de repetição e
 * o desfecho `failed` que o servidor de fila grava.
 */
async function sobContextoNomeandoAEmpresa(
  tarefa: TarefaDaRotinaAgendada,
  logger: Logger,
  empresaId: string,
  rotina: RotinaDeTrabalho,
  dependencias: DependenciasDaRotinaAgendada,
): Promise<DesfechoDaPassagem> {
  try {
    return await contextoDeTenant.executarCom(
      { empresaId },
      async () => await executarRotina(rotina, tarefa, logger, empresaId, dependencias),
    );
  } catch (erro) {
    logger.error(
      { idTarefa: tarefa.id, fila: FILA_DA_ROTINA_AGENDADA, empresaId, rotina, erro },
      MENSAGEM_DA_PASSAGEM_EM_FALHA,
    );

    throw erro;
  }
}

/**
 * Despacha para a rotina da carga — **sob o contexto já aberto**, e sem reabri-lo.
 *
 * O `switch` é exaustivo por construção: o `never` do ramo final não compila se uma alternativa de
 * `RotinaDeTrabalho` deixar de ter ramo, e é isso que impede uma rotina nova de chegar aqui e ser
 * silenciosamente ignorada — que seria trabalho não feito sem uma linha vermelha em lugar nenhum.
 */
async function executarRotina(
  rotina: RotinaDeTrabalho,
  tarefa: TarefaDaRotinaAgendada,
  logger: Logger,
  empresaId: string,
  dependencias: DependenciasDaRotinaAgendada,
): Promise<DesfechoDaPassagem> {
  switch (rotina) {
    case 'ENCERRAMENTO_DE_CONTRATOS':
      return await encerrarOsVencidos(dependencias);
    case 'CONFERENCIA_DE_LIQUIDACAO':
      return await conferirAsLiquidacoes(tarefa, logger, empresaId, dependencias);
    case 'VIGILANCIA_DAS_ROTINAS':
      return await vigiarAsRotinas(logger, empresaId, dependencias);
    case 'EXPURGO_DO_HISTORICO':
      return await expurgarOHistorico(dependencias);
    default: {
      const rotinaNaoTratada: never = rotina;

      throw new Error(`a rotina ${String(rotinaNaoTratada)} não tem trabalho declarado`);
    }
  }
}

/**
 * Encerra os contratos vencidos da empresa e registra a passagem **na mesma unidade**.
 *
 * O predicado é `candidatos > 0` — o que a **seleção alcançou**, e não `encerrados > 0`: a passagem
 * que selecionou candidatos e não transicionou nenhum (porque outra unidade os moveu entre a seleção
 * e a escrita) percorreu trabalho real, e o resumo dela é o que explica ao Admin por que os números
 * não batem. É a leitura literal da RD-15.
 *
 * O registro corre no **mesmo** `tx` do encerramento pela razão que o docblock de
 * `encerrarContratosVencidos` fixa: a unidade é a **passagem**, e o resumo devolvido não sobrevive ao
 * desfazimento — logo não há o que registrar quando nada ficou.
 */
async function encerrarOsVencidos(
  dependencias: DependenciasDaRotinaAgendada,
): Promise<DesfechoDaPassagem> {
  const resumo = await dependencias.banco.emUnidadeDeTrabalho(async (tx) => {
    const contagens = await encerrarContratosVencidos(tx);

    if (contagens.candidatos > 0) {
      await registrarExecucaoDeRotina(tx, {
        rotina: 'ENCERRAMENTO_DE_CONTRATOS',
        resumo: contagens,
      });
    }

    return contagens;
  });

  return { resumo, houveEfeito: resumo.candidatos > 0 };
}

/**
 * Abre a conferência do dia e executa a **mesma** passada que o pedido do Admin executa.
 *
 * ⚠️ **`solicitadaPor: null` é conformidade, e não lacuna.** A coluna
 * `negocio.conferencia_bancaria.solicitada_por` é anulável e o docblock de `ConferenciaNova` diz
 * literalmente *"ou `null` quando o disparo é do relógio"* — a F4 previu esta fatia. É o que dispensa
 * inventar uma sessão de serviço sintética, alternativa que a ADR-0024 descarta por nome porque
 * criaria credencial de longa duração e atribuiria ato de auditoria a um usuário que não existe.
 *
 * ⚠️ **Duas passagens CONCORRENTES não abrem duas conferências**, e quem o garante é o
 * `conferencia_bancaria_em_andamento_uidx`: `abrirConferencia` devolve `iniciadaAgora: false` e a
 * conferência **em curso**. Nenhum mecanismo de trava novo é introduzido (RD-13).
 *
 * ---------------------------------------------------------------------------
 * ⚠️ `iniciadaAgora: false` TEM DUAS CAUSAS, e tratá-las igual trava a empresa para sempre
 * ---------------------------------------------------------------------------
 *
 * A leitura ingênua — *"achei uma em andamento, logo outra passagem está trabalhando"* — é verdadeira
 * para duas passagens **concorrentes** e **falsa para a repetição desta mesma tarefa**. A abertura
 * corre em unidade **própria**, que **commita antes** de a passada começar; se a passada levantar
 * depois disso (o `@throws` de {@link executarConferenciaDaEmpresa} declara que ela levanta quando
 * qualquer porta de dados falha), a linha fica `concluida_em IS NULL` e **nada a conclui**. Na
 * ativação seguinte, *"a outra"* é o **cadáver da ativação anterior**.
 *
 * Sem discriminar as duas causas, o desfecho é o pior possível, e ele é silencioso em três frentes:
 * a repetição converte a falha em `completed` **sem trabalhar** — a política de repetição nem chega a
 * se esgotar —; toda passagem diária seguinte vira no-op permanente, o que deixa
 * `CONFERENCIA_DE_LIQUIDACAO` **atrasada para sempre** na derivação da leitura do Admin; e o botão
 * *"conferir"* da rota manual, que é a saída natural do operador, também não enfileira nada, porque
 * ela reencontra a mesma linha. Recuperar exigiria intervenção direta no banco. É dinheiro recebido
 * que deixa de ser baixado sem uma linha vermelha em lugar nenhum.
 *
 * **O que separa as duas causas é o estado da PRÓPRIA tarefa**, e não o da conferência:
 * {@link ehReentrada} — publicado por `./conferencia-bancaria.ts`, e consumido aqui como **segundo
 * chamador de produção**. Na reentrada, a passada é **refeita** contra a conferência que ficou
 * aberta; só na **primeira** ativação o desfecho `iniciadaAgora: false` significa concorrência de
 * verdade, e só aí a passagem não trabalha.
 *
 * ⚠️ **Refazer é seguro, e não é uma segunda regra de idempotência**: `comReentranciaBenigna`, lá
 * dentro, já absorve a conclusão que a ativação anterior porventura tenha alcançado, e
 * `conferirCobrancas` é idempotente pelo **desfecho benigno** de cada porta de escrita — a cobrança
 * já liquidada devolve `NAO_ESTAVA_EM_ABERTO` e não conta efeito nem grava evento (ADR-0034).
 *
 * ⚠️ **Isto NÃO fecha o buraco inteiro, e a metade que falta tem endereço.** A conferência abandonada
 * por **esgotamento** das repetições continua irrecuperável: quando a tarefa morre em falha retida,
 * não há mais ativação para reentrar. Fechá-la exige janela de obsolescência em `abrirConferencia` ou
 * varredura de recolhimento na manutenção — `packages/db/src/conferencia-bancaria.ts`, que esta task
 * não alcança. Endereçado à T11 desta fatia.
 *
 * O predicado é `liquidacoesDescobertas > 0`: a passada que perguntou e encontrou tudo como estava
 * não produziu efeito, e `cobrancasConferidas > 0` a faria gravar registro todo dia.
 */
async function conferirAsLiquidacoes(
  tarefa: TarefaDaRotinaAgendada,
  logger: Logger,
  empresaId: string,
  dependencias: DependenciasDaRotinaAgendada,
): Promise<DesfechoDaPassagem> {
  const { banco } = dependencias;
  const origem = origemDaConferencia(tarefa);
  const conferencia = await banco.emUnidadeDeTrabalho(
    async (tx) => await abrirConferencia(tx, { solicitadaPor: null }),
  );

  const diarioDaPassagem = {
    idTarefa: tarefa.id,
    fila: FILA_DA_ROTINA_AGENDADA,
    empresaId,
    conferenciaId: conferencia.id,
    iniciadaEm: conferencia.iniciadaEm,
  };

  if (!conferencia.iniciadaAgora && !ehReentrada(origem)) {
    // PRIMEIRA ativação encontrando apuração em andamento: é concorrência de verdade — quem está
    // trabalhando é a outra passagem. Esta não trabalha, não conta liquidação e não deixa registro.
    logger.info(
      diarioDaPassagem,
      'a conferência do relógio encontrou uma apuração em andamento — nada a fazer nesta passagem',
    );

    return { resumo: { liquidacoesDescobertas: 0 }, houveEfeito: false };
  }

  if (!conferencia.iniciadaAgora) {
    // REENTRADA sobre a apuração que a ativação anterior desta mesma tarefa deixou aberta. O nível é
    // de alerta, e não de informação: a linha diz ao operador que houve uma falha antes desta
    // ativação — a repetição está recuperando, e não passando por cima.
    logger.warn(
      { ...diarioDaPassagem, tentativa: tarefa.attemptsStarted },
      'a conferência do relógio reentrou sobre a apuração que a ativação anterior deixou aberta — refazendo a passada',
    );
  }

  const passada = await executarConferenciaDaEmpresa({
    tarefa: origem,
    logger,
    empresaId,
    conferenciaId: conferencia.id,
    dependencias,
  });

  const resumo = { liquidacoesDescobertas: passada.liquidacoesDescobertas };

  if (resumo.liquidacoesDescobertas > 0) {
    // Unidade própria, e não a da passada: ver o cabeçalho para por que a conferência não tem uma
    // unidade única a que este registro pudesse pertencer.
    await banco.emUnidadeDeTrabalho(async (tx) => {
      await registrarExecucaoDeRotina(tx, { rotina: 'CONFERENCIA_DE_LIQUIDACAO', resumo });
    });
  }

  return { resumo, houveEfeito: resumo.liquidacoesDescobertas > 0 };
}

/**
 * A tarefa desta fila, projetada no que a execução da conferência declara precisar.
 *
 * ⚠️ **`fila` é o desta fila, e não o da fila da conferência** — é o que faz o par (fila,
 * identificador) publicado no diário ser verdadeiro quando o provocador é o relógio. Ver
 * {@link OrigemDaConferencia}.
 *
 * Campo a campo, e não por espalhamento: `fila` não existe em `Job`, e espalhar um objeto da
 * biblioteca de fila levaria adiante o que ela guarda por dentro — o oposto do que aquele tipo
 * promete entregar.
 */
function origemDaConferencia(tarefa: TarefaDaRotinaAgendada): OrigemDaConferencia {
  return {
    fila: FILA_DA_ROTINA_AGENDADA,
    id: tarefa.id,
    attemptsMade: tarefa.attemptsMade,
    attemptsStarted: tarefa.attemptsStarted,
  };
}

/**
 * Lê o estado das rotinas da empresa e **grita** uma vez por rotina atrasada — CA-03, metade 2.
 *
 * Ela **não escreve nada** (ADR-0022): `atrasada` chega derivado da consulta, e o que este ramo faz é
 * filtrar e relatar. O nível é `error` porque o destinatário é o **operador**, pelo journal: o alerta
 * de rotina parada **não depende do e-mail funcionar**, que é justamente o modo de falha que ele
 * existe para cobrir (RN-18).
 *
 * ⚠️ **Uma linha por rotina atrasada, e nenhuma para a que está em dia.** Um alerta que dispara para
 * tudo é um alerta que ninguém lê, e é a asserção sobre as rotinas em dia que separa os dois.
 *
 * A metade 1 do CA-03 é outra e não substitui esta: o `OnFailure=` da unidade cobre a rotina que
 * **falhou**; esta cobre a que **não executou**, para a qual o supervisor não produz evento algum.
 */
async function vigiarAsRotinas(
  logger: Logger,
  empresaId: string,
  dependencias: DependenciasDaRotinaAgendada,
): Promise<DesfechoDaPassagem> {
  const estados = await dependencias.banco.emUnidadeDeTrabalho(
    async (tx) => await lerEstadoDasRotinas(tx),
  );
  const atrasadas = estados.filter((estado) => estado.atrasada);

  for (const estado of atrasadas) {
    logger.error(
      {
        empresaId,
        rotina: estado.rotina,
        ultimaExecucao: estado.ultimaExecucao,
        // LIDO do contrato, indexado pelo tipo de cadência que a própria leitura devolve — a mesma
        // tabela que o banco consulta para derivar `atrasada`. Um número escrito aqui seria o
        // segundo limiar do produto.
        limiarMinutos: LIMIAR_DE_ATRASO_POR_CADENCIA[estado.cadencia.tipo],
      },
      'rotina agendada parada: o silêncio dela passou do limiar da cadência',
    );
  }

  // A vigilância **nunca** grava registro — ver o cabeçalho. `houveEfeito` é `false` sempre, e o que
  // ele governa aqui é só o nível da linha de fecho.
  return {
    resumo: { rotinasExaminadas: estados.length, atrasadas: atrasadas.length },
    houveEfeito: false,
  };
}

/**
 * Apaga o histórico de execução vencido da empresa — manutenção, e **sem registro**.
 *
 * O corte de retenção é do banco (`expurgarExecucoesVencidas`), e nada aqui compõe data. O predicado
 * `removidos > 0` existe para o nível do diário: gravar linha de execução por um expurgo seria a
 * rotina de limpeza alimentando exatamente a tabela que ela limpa.
 */
async function expurgarOHistorico(
  dependencias: DependenciasDaRotinaAgendada,
): Promise<DesfechoDaPassagem> {
  const resumo = await dependencias.banco.emUnidadeDeTrabalho(
    async (tx) => await expurgarExecucoesVencidas(tx),
  );

  return { resumo, houveEfeito: resumo.removidos > 0 };
}
