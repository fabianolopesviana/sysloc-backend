/**
 * O **despachante efêmero** — o segundo ponto de entrada de `apps/worker`, e a camada de provocação
 * que faltava ao produto.
 *
 * ===========================================================================
 * UM EXECUTÁVEL QUE RECEBE QUAL ROTINA EXECUTAR (decisão P1 da §21.1)
 * ===========================================================================
 *
 * `node apps/worker/dist/despachante.js <rotina>`, sob uma unidade `Type=oneshot` que um `.timer`
 * dispara. As alternativas foram consideradas e recusadas: um workspace novo repetiria build,
 * manifesto, `EnvironmentFile` e o molde de partida que **falha fechado**; um executável por rotina
 * multiplicaria a composição raiz por seis para comprar uma legibilidade que o nome da unidade
 * `systemd` já dá — ela é por rotina de qualquer forma.
 *
 * ⚠️ **Ele é PRODUTOR PURO.** Não há `fila.processar` neste arquivo, e a ausência é o mecanismo: sem
 * consumidor registrado, o processo não apanha tarefa nenhuma e termina assim que devolve o que
 * abriu. Quem consome é `./main.ts`, no processo que fica de pé.
 *
 * ===========================================================================
 * A ENUMERAÇÃO DE EMPRESAS É A LEITURA LEGÍTIMA #1 (ADR-0024 · ADR-0009)
 * ===========================================================================
 *
 * `listarEmpresasAtivas` lê `identidade.empresa`, schema **sem noção de tenant**, e devolve **só o
 * identificador**. É dela que sai todo `empresaId` que viaja em carga — o que a emenda de 2026-08-18
 * da ADR-0024 chama de *"produzido por quem já detinha direito a ele"*.
 *
 * ⚠️ **A enumeração É o filtro** (RN-09). A empresa suspensa **não é alcançada**, e a diferença é
 * entre impossível e evitado: um despachante que enumerasse todas e descartasse a suspensa dentro da
 * tarefa enfileiraria trabalho para ela.
 *
 * ⚠️ **Nenhuma terceira leitura sem contexto nasce aqui.** A que responderia *"quais empresas têm
 * candidata"* foi **medida e rejeitada** (decisão D2 do tech-alignment): um furo permanente no
 * isolamento para poupar trabalho barato. **Passagens sem trabalho existem, e são o custo declarado**
 * de não furar o isolamento — contidas pela seleção por índice parcial, pela idempotência de cada
 * rotina e pela proibição de registrar passagem sem efeito (RN-15).
 *
 * ===========================================================================
 * ELE ABRE UNIDADE DE TRABALHO, E **NÃO** ABRE CONTEXTO DE TENANT
 * ===========================================================================
 *
 * As duas leituras deste arquivo correm em unidade **sem** `app.empresa_id`, e a ausência é
 * conformidade: `identidade.empresa` nunca teve política (ADR-0009) e `plataforma.notificacao_bancaria`
 * não tem dono-empresa (ADR-0031). Fixar o contexto "para facilitar" seria violação, não zelo — daria
 * à enumeração a aparência de correr sob tenant, e a primeira leitura tenantizada que alguém
 * acrescentasse aqui encontraria o contexto já aberto com a empresa de ninguém, com a política
 * devolvendo vazio **em silêncio**.
 *
 * Quem abre o contexto do trabalho é a **borda que recebe a carga** (`./tarefas/rotina-agendada.ts`,
 * `./tarefas/regua.ts`), uma vez, pelo mesmo escritor único da guarda HTTP. É por isso que este
 * arquivo entra em `ABRIDORES_LEGITIMOS` e **não** em `BORDAS_QUE_ESCREVEM_CONTEXTO`.
 *
 * ===========================================================================
 * O ENFILEIRAMENTO REUSA `conectarFila` — o ÚNICO caminho publicado
 * ===========================================================================
 *
 * A interface `Fila` já publica cada `Queue` como campo, e cada uma nasce com
 * `OPCOES_PADRAO_DA_TAREFA` de `@sysloc/shared`. Escrever um produtor próprio aqui seria a
 * **terceira** cópia do padrão — a borda HTTP em `apps/api/src/comum/produtor-de-fila.ts` é a
 * primeira — e reabriria o defeito que o fecho do `D32 · F0/T6` eliminou: `defaultJobOptions` vale
 * só para a **instância** que as declara, de modo que uma política escrita aqui divergiria em
 * silêncio da do consumidor.
 *
 * ⚠️ **Nenhuma chave de idempotência (`jobId`) é usada, e a ausência é decisão.** Com a retenção por
 * **contagem** de `OPCOES_PADRAO_DA_TAREFA`, um `jobId` fixo permaneceria no conjunto depois de
 * concluído e **recusaria em silêncio a passagem seguinte** — a rotina pararia sem que nada
 * falhasse, que é o modo de falha mais caro desta fatia. A idempotência de cada rotina é a que já a
 * governa: o predicado no encerramento e na régua, o `conferencia_bancaria_em_andamento_uidx` na
 * conferência, e a natureza de `DELETE` e de leitura no expurgo e na vigilância.
 *
 * ===========================================================================
 * ELE NÃO COMPÕE PORTA EXTERNA ALGUMA (ADR-0025 · ADR-0029 · ADR-0032)
 * ===========================================================================
 *
 * Nem adaptador de e-mail, nem adaptador do provedor bancário, nem guarda de boletos. Ele **só
 * enfileira**: não fala com SMTP nem com o provedor, e por isso **não exige e não lê**
 * `CHAVE_DE_CIFRA_DO_CERTIFICADO` — a superfície capaz de abrir o segredo mais forte do produto
 * continua sendo a de `./main.ts`, e não passa a ter um terceiro processo. As portas seguem vivendo
 * lá, e chegam às bordas por parâmetro.
 *
 * ===========================================================================
 * NENHUMA DECISÃO DE NEGÓCIO DERIVA DO RELÓGIO DESTE PROCESSO (ADR-0026)
 * ===========================================================================
 *
 * O timer apenas **provoca**. Quem decide o que venceu, o que atrasou e o que expirou é
 * `negocio.data_corrente_da_operacao()` e o `now()` do banco, dentro de cada consulta. A **única**
 * leitura de relógio deste arquivo é {@link cronometrar}, que mede a duração do despacho para o
 * diário — ela não decide nada, e é a exceção que o `CT-1062` declara e afirma por igualdade.
 *
 * ===========================================================================
 * A PARTIDA FALHA FECHADO, e o código de saída é conteúdo
 * ===========================================================================
 *
 * O nome da rotina é casado contra a união fechada **antes de qualquer uso** — ele nunca entra em
 * SQL nem em nome de fila por interpolação —, e valor fora dela termina o processo com
 * {@link CODIGO_DE_ROTINA_DESCONHECIDA}, nomeando os aceitos. **Não há ramo padrão silencioso.**
 * As três variáveis são conferidas no molde de `./main.ts`, nomeando **cada** ausente e **nunca**
 * imprimindo valor: `DATABASE_URL` e `REDIS_URL` carregam credencial, e a mensagem vai para o
 * journal.
 *
 * Falha em qualquer ponto ⇒ código ≠ 0 ⇒ o `OnFailure=` da unidade aciona o alerta que nomeia a
 * rotina. **Nada é enfileirado antes de a partida ter passado**: o banco e a fila só são abertos
 * depois das duas recusas.
 */

// DÉBITO COM GATILHO — D16 · F5/T8 · registrado 2026-08-23
// (NÃO é uma `DECISÃO FECHADA`: ele agenda uma convergência, não protege o código abaixo.)
// O QUÊ: a conferência de partida das TRÊS variáveis comuns aos dois pontos de entrada deste
//        processo — `LOG_LEVEL`, `DATABASE_URL` e `REDIS_URL` — passa a ter DUAS declarações:
//        {@link lerAmbienteDoDespacho}, aqui, e `lerAmbiente`, em `./main.ts`. Os dois processos
//        sobem do MESMO `EnvironmentFile`, e é o caso que o cabeçalho de
//        `packages/shared/src/ambiente.ts` nomeia: endurecer uma faz um ponto de entrada subir e o
//        outro recusar o mesmo arquivo, e a divergência aparece **no boot**.
// QUANDO FECHA: junto do `D51 · F4/T16` — a task que subir `ehChaveDeCifraAceitavel` e
//        `ehDiretorioGravavel` para `packages/shared/src/ambiente.ts` leva estas três no mesmo
//        movimento —, ou o TERCEIRO ponto de entrada que exigir as mesmas três.
// POR QUE NÃO AGORA: reusar `lerAmbiente` daqui exigiria importar `./main.ts`, e o grafo de importe
//        passaria a alcançar `criarAdaptadorSicoob`, `criarAdaptadorSmtp` e `criarGuardaDeBoletos`
//        num processo que a ADR-0025 e a ADR-0032 dizem, por escrito, que **não compõe porta
//        externa alguma**. Extrair a leitura para o pacote compartilhado alcança
//        `apps/api/src/configuracao/ambiente.ts`, que está fora da lista de arquivos desta task —
//        é o mesmo motivo pelo qual o `D51` segue aberto.
// ÍNDICE: docs/specs/features/automacoes-agendadas/v1/_run/run-report.md §2, D16

import { pathToFileURL } from 'node:url';
import {
  type AcessoAoBanco,
  abrirAcessoAoBanco,
  listarEmpresasAtivas,
  listarNaoTratadas,
} from '@sysloc/db';
import {
  criarLogger,
  EXIGENCIA_DA_CADEIA_DE_FILA,
  ehCadeiaDeFilaValida,
  type Logger,
  NIVEIS_DE_LOG,
  type NivelDeLog,
  type RotinaDeTrabalho,
} from '@sysloc/shared';
import { CADENCIA_DA_ROTINA } from '@syslocbr/contracts';
import { conectarFila, type Fila } from './fila.js';

// ---------------------------------------------------------------------------
// Os códigos de saída — o vocabulário que o supervisor lê
// ---------------------------------------------------------------------------

/** Despacho concluído: as tarefas foram publicadas e os recursos, devolvidos. */
const CODIGO_DE_SUCESSO = 0;

/** Qualquer falha do despacho — ambiente inválido, banco fora, fila fora, consulta que levantou. */
const CODIGO_DE_FALHA = 1;

/**
 * O nome recebido em `process.argv[2]` não pertence ao roster — código **próprio**, e não o de falha.
 *
 * A distinção é para quem opera: `1` significa *"a rotina certa não conseguiu correr"* e pede olhar
 * para o banco, a fila ou o arquivo de ambiente; `2` significa *"a unidade `systemd` está chamando um
 * nome que não existe"* e pede olhar para o `ExecStart=`. Um código só mandaria o operador procurar
 * o problema errado metade das vezes.
 */
const CODIGO_DE_ROTINA_DESCONHECIDA = 2;

// ---------------------------------------------------------------------------
// O roster aceito em `argv` — DERIVADO da declaração única do relógio
// ---------------------------------------------------------------------------

/**
 * Uma rotina que **tem unidade `systemd` própria** — derivada da declaração única do relógio.
 *
 * ⚠️ **`keyof typeof CADENCIA_DA_ROTINA`, e não um segundo alfabeto de nomes.** `@syslocbr/contracts`
 * publica o mesmo conjunto sob o nome `RotinaAgendada`, mas **não o exporta pelo barril** — e o
 * caminho barato de contorno seria redigitar aqui a união das seis. Derivar do mesmo mapa é o que
 * torna as duas declarações o **mesmo fato**: uma rotina acrescentada a `CADENCIA_DA_ROTINA` entra
 * aqui sozinha, e uma removida de lá deixa de existir aqui — sem que exista um lugar para esquecer.
 *
 * ⚠️ **Não a confunda com `RotinaDeTrabalho`** (`@sysloc/shared`), que é o conjunto das **quatro**
 * rotinas por empresa que viajam na carga. Os dois se cruzam sem se conter: `AVISO_DE_COBRANCA`,
 * `MANUTENCAO` e `RETOMADA_DE_NOTICIAS` têm unidade e não são trabalho por empresa;
 * `EXPURGO_DO_HISTORICO` é trabalho por empresa e **não tem unidade** — ele pega carona no disparo da
 * manutenção.
 */
type RotinaDeDespacho = keyof typeof CADENCIA_DA_ROTINA;

/**
 * O nome de uma rotina como a linha de comando a escreve: minúsculas, com hífen no lugar do
 * sublinhado.
 *
 * A conversão é **total e mecânica** — as chaves de `CADENCIA_DA_ROTINA` são maiúsculas ASCII
 * separadas por `_` —, e é ela que permite {@link ROTINAS_DE_DESPACHO} ser derivado em vez de
 * redigitado. Uma segunda lista literal dos nomes aceitos é exatamente o que o cabeçalho de
 * `packages/contracts/src/rotina-agendada.ts` proíbe: *"acrescentar rotina ao roster é ligar um
 * booleano, e não editar dois lugares que ninguém amarra"*.
 */
function emKebab(rotina: RotinaDeDespacho): string {
  return rotina.toLowerCase().replaceAll('_', '-');
}

/**
 * A **união fechada** dos nomes aceitos em `process.argv[2]`, e a rotina que cada um nomeia.
 *
 * ⚠️ **Ele é derivado de `CADENCIA_DA_ROTINA`, que é a declaração única do relógio do produto** — as
 * mesmas seis entradas que a asserção estática das unidades `systemd` compara contra o `OnCalendar=`
 * de cada `.timer`. Derivar é o que faz *ter timer* e *ser despachável* serem o mesmo fato: uma
 * rotina acrescentada ao mapa nasce aceita aqui, e uma removida de lá deixa de ser aceita — sem que
 * exista um segundo lugar para esquecer.
 *
 * `Object.freeze` fecha o objeto em **execução**, e não só em compilação: sem ele, um consumidor
 * poderia acrescentar um nome aceito em tempo de execução, que é justamente o que a barreira de
 * partida existe para impedir.
 *
 * ⚠️ **O protótipo é NULO, e a ausência dele é o mecanismo — não é estilo.** Um objeto literal herda
 * `Object.prototype`, e a busca por `constructor`, `toString`, `valueOf` ou `hasOwnProperty` **não
 * devolveria `undefined`**: devolveria o membro do protótipo, a recusa por roster não dispararia, e o
 * processo abriria banco e fila antes de cair no `default` do `switch` — terminando com
 * {@link CODIGO_DE_FALHA} em vez de {@link CODIGO_DE_ROTINA_DESCONHECIDA}. Não há alcance de segurança
 * nisso (`argv[2]` vem do `ExecStart=` versionado, e a partida falha fechado de qualquer forma); o que
 * se perderia é exatamente a **distinção de código de saída** que este arquivo declara ser conteúdo —
 * o operador seria mandado olhar banco, fila e `EnvironmentFile` quando o defeito está no `ExecStart=`.
 * Sem protótipo, a união é fechada **de fato**, e o congelamento acima passa a alcançar tudo o que a
 * busca pode ver.
 */
const ROTINAS_DE_DESPACHO: Readonly<Record<string, RotinaDeDespacho>> = Object.freeze(
  Object.assign(
    Object.create(null) as Record<string, RotinaDeDespacho>,
    Object.fromEntries(
      (Object.keys(CADENCIA_DA_ROTINA) as RotinaDeDespacho[]).map((rotina) => [
        emKebab(rotina),
        rotina,
      ]),
    ),
  ),
);

/** Os nomes aceitos, como a recusa os publica — derivados do roster, jamais redigitados. */
const NOMES_ACEITOS = Object.keys(ROTINAS_DE_DESPACHO).join(', ');

// ---------------------------------------------------------------------------
// A partida
// ---------------------------------------------------------------------------

/**
 * Prazo da devolução da reserva de conexões, **depois** de a fila já ter sido devolvida.
 *
 * Mesmo valor e mesma razão de `./main.ts`: recurso que não é devolvido segura o laço de eventos, e
 * o processo fica vivo sem fazer nada. Aqui o efeito é pior do que lá — em `Type=oneshot` o
 * supervisor conta o `TimeoutStartSec` e a unidade que não termina **atrasa o disparo seguinte**.
 * Quem desiste primeiro precisa ser o processo, que sabe explicar no journal por que desistiu.
 */
const LIMITE_DE_DEVOLUCAO_DA_RESERVA_MS = 5_000;

/**
 * Por quantos minutos uma notícia pode ficar em `RECEBIDO` antes de a retomada reenfileirá-la.
 *
 * ⚠️ **Dez minutos é UMA cadência inteira do timer da retomada** (`A_CADA_10_MIN` em
 * `CADENCIA_DA_ROTINA`), e o valor é o piso que evita a corrida óbvia: a notícia que acabou de
 * chegar está sendo tratada **agora** pelo processo de trabalho, e reenfileirá-la produziria duas
 * passagens concorrentes sobre o mesmo cru. Com a folga de uma cadência, só é retomada a notícia que
 * atravessou um disparo inteiro sem ninguém a carimbar — que é a definição operacional de *ninguém a
 * tratou*.
 *
 * Ele mora **aqui**, e não em `@sysloc/db`, porque é **cadência** e não retenção: quem sabe de quanto
 * em quanto tempo o relógio acorda este processo é este processo. `listarNaoTratadas` o **recebe**.
 *
 * ⚠️ **A igualdade com a cadência declarada NÃO é boa-fé: ela é asserida.** O `CT-1079 (b)`
 * (`apps/worker/test/despachante.spec.ts`) lê este valor do fonte por `fs` e o compara com os minutos
 * que o **nome** de `CADENCIA_DA_ROTINA.RETOMADA_DE_NOTICIAS.tipo` declara, de modo que os dois
 * números são o mesmo fato. **Alterar um sem o outro fica vermelho.** O impacto de os separar é
 * assimétrico, e a metade cara é silenciosa: afrouxar a cadência só torna a retomada mais lenta, mas
 * apertá-la para `A_CADA_15_MIN` faz esta folga ficar **menor** que uma cadência — e o invariante do
 * parágrafo acima passa a ser falso sem nada acusar.
 */
const FOLGA_DA_RETOMADA_EM_MINUTOS = 10;

/** A configuração que o despachante exige — **três** variáveis, e nenhuma delas nova. */
interface AmbienteDoDespacho {
  /** Severidade mínima registrada, de `LOG_LEVEL`. */
  readonly nivelDeLog: NivelDeLog;
  /** Cadeia de conexão do banco, de `DATABASE_URL`. **Carrega credencial**. */
  readonly cadeiaConexaoBanco: string;
  /** Cadeia de conexão da fila, de `REDIS_URL`. **Pode carregar credencial**. */
  readonly cadeiaConexaoFila: string;
}

/**
 * Lê e valida as **três** variáveis que o despacho exige — nem uma a mais.
 *
 * O conjunto é **menor** que o de `./main.ts`, e a diferença é a fronteira deste processo, não um
 * esquecimento: ele não fala com servidor de e-mail, não fala com o provedor bancário, não monta link
 * e não grava boleto, de modo que exigir `SMTP_URL`, `CHAVE_DE_CIFRA_DO_CERTIFICADO` ou
 * `DIRETORIO_DOS_BOLETOS` recusaria a partida por ausência de coisa que ele não usaria. A ADR-0032 é
 * literal nisso: a chave que abre o envelope do certificado continua sendo lida **apenas** por
 * `./main.ts`.
 *
 * O critério que separa *"exigir presença"* de *"exigir forma"* é o mesmo de `./main.ts`: exige forma
 * quem não tem segundo conferidor. `LOG_LEVEL` e `REDIS_URL` têm a forma conferida aqui, pelas regras
 * **importadas** de `@sysloc/shared` — duas definições independentes do que é uma severidade ou uma
 * cadeia de fila divergiriam em silêncio entre os dois pontos de entrada. `DATABASE_URL` exige apenas
 * presença e não-vacuidade, exatamente como lá: quem recusa a cadeia que não serve é o driver, na
 * abertura da reserva, num lugar só.
 *
 * Valor em branco conta como **ausente**, porque o `.env.example` versionado declara toda variável sem
 * valor e um arquivo copiado dele sem preenchimento entrega cadeias vazias.
 *
 * A fonte é PARÂMETRO e a falha é EXCEÇÃO, como em `./main.ts`: quem decide o código de saída é o
 * ponto de entrada.
 *
 * ⚠️ **Ela NÃO é exportada, e a assimetria com `lerAmbiente` é deliberada.** O irmão de `./main.ts` é
 * exportado por razão concreta — `apps/worker/test/ambiente.spec.ts` o chama, e é assim que as doze
 * variáveis daquela partida são provadas sem subprocesso. Aqui a partida é provada **como processo
 * real** (`CT-1077`), com o ambiente montado variável a variável e o código de saída observado de
 * fora, que é o único jeito de medir o contrato com o supervisor. Exportá-la alargaria a superfície
 * deste módulo sem consumidor, e a Iron Law #6 é literal: símbolo de produção não nasce para o teste
 * enxergar. **Não a exporte "por simetria com `main.ts`"** — a simetria que importa é a das razões,
 * e elas divergem.
 *
 * @throws {Error} Quando falta variável exigida ou algum valor é inválido. A mensagem nomeia **todas**
 * as variáveis com problema e **nunca** ecoa o valor recebido — a regra é do formato da mensagem, e
 * abri-la "só para esta" cria a exceção que a próxima variável herda.
 */
function lerAmbienteDoDespacho(
  fonte: Readonly<Record<string, string | undefined>>,
): AmbienteDoDespacho {
  const problemas: string[] = [];

  const nivel = fonte.LOG_LEVEL?.trim() ?? '';
  if (nivel === '') {
    problemas.push('LOG_LEVEL: ausente');
  } else if (!NIVEIS_DE_LOG.includes(nivel as NivelDeLog)) {
    problemas.push(`LOG_LEVEL: deve ser um de: ${NIVEIS_DE_LOG.join(', ')}`);
  }

  const banco = fonte.DATABASE_URL?.trim() ?? '';
  if (banco === '') {
    problemas.push('DATABASE_URL: ausente');
  }

  const fila = fonte.REDIS_URL?.trim() ?? '';
  if (fila === '') {
    problemas.push('REDIS_URL: ausente');
  } else if (!ehCadeiaDeFilaValida(fila)) {
    problemas.push(`REDIS_URL: ${EXIGENCIA_DA_CADEIA_DE_FILA}`);
  }

  if (problemas.length > 0) {
    throw new Error(
      `configuração inválida na partida: ${problemas.join('; ')}. ` +
        'As variáveis exigidas estão documentadas em .env.example.',
    );
  }

  return { nivelDeLog: nivel as NivelDeLog, cadeiaConexaoBanco: banco, cadeiaConexaoFila: fila };
}

// ---------------------------------------------------------------------------
// O despacho
// ---------------------------------------------------------------------------

/** O que uma passagem do despachante produziu — os números que o diário publica. */
interface ResumoDoDespacho {
  /** Quantas empresas **ativas** a enumeração alcançou. `0` nas rotinas que não enumeram. */
  readonly empresasEnumeradas: number;
  /** Quantas tarefas foram publicadas, somando todas as filas tocadas nesta passagem. */
  readonly tarefasEnfileiradas: number;
}

/**
 * As **quatro** rotinas por empresa que viajam na fila única, indexadas pela unidade que as provoca.
 *
 * `EXPURGO_DO_HISTORICO` **não tem entrada aqui**, e a ausência é conteúdo: ele não tem timer
 * próprio — é despachado de carona no disparo de `MANUTENCAO`, que já enumera as empresas para a
 * tarefa sem tenant. Ver {@link despacharManutencao}.
 *
 * `satisfies` cobra o par pelo compilador nas duas pontas: um valor fora de `RotinaDeTrabalho` não
 * compila, e uma chave fora de `RotinaAgendada` também não.
 */
const ROTINA_DE_TRABALHO_POR_UNIDADE = {
  ENCERRAMENTO_DE_CONTRATOS: 'ENCERRAMENTO_DE_CONTRATOS',
  CONFERENCIA_DE_LIQUIDACAO: 'CONFERENCIA_DE_LIQUIDACAO',
  VIGILANCIA_DAS_ROTINAS: 'VIGILANCIA_DAS_ROTINAS',
} as const satisfies Partial<Record<RotinaDeDespacho, RotinaDeTrabalho>>;

/** A rotina que a manutenção despacha por empresa, de carona no disparo dela. */
const ROTINA_DO_EXPURGO: RotinaDeTrabalho = 'EXPURGO_DO_HISTORICO';

/**
 * Enumera as empresas ativas em **uma** unidade de trabalho, sem contexto de tenant.
 *
 * A unidade abre aqui, na borda, e a porta de dados **recebe** o executor — a decisão D1, literal.
 */
async function enumerarEmpresasAtivas(banco: AcessoAoBanco): Promise<readonly string[]> {
  return await banco.emUnidadeDeTrabalho(async (tx) => await listarEmpresasAtivas(tx));
}

/**
 * Despacha **uma tarefa por empresa ativa** na fila da régua de cobrança (US-04).
 *
 * A fila é a que **já existia** (`FILA_DA_REGUA`): o que faltava à régua não era consumidor, era
 * quem a provocasse. O disparo **não discrimina** — quem decide se a passagem acontece é a política
 * da empresa e a janela de horário, conferidas dentro da borda contra a hora do **banco**.
 */
async function despacharAviso(fila: Fila, empresas: readonly string[]): Promise<number> {
  for (const empresaId of empresas) {
    await fila.regua.add(fila.regua.name, { empresaId });
  }

  return empresas.length;
}

/**
 * Despacha **uma tarefa por empresa ativa** na fila única das rotinas por empresa.
 *
 * O que discrimina o trabalho é o campo `rotina` da carga, conferido na borda contra a união fechada
 * — ver o cabeçalho de `./tarefas/rotina-agendada.ts`.
 */
async function despacharPorEmpresa(
  fila: Fila,
  empresas: readonly string[],
  rotina: RotinaDeTrabalho,
): Promise<number> {
  for (const empresaId of empresas) {
    await fila.rotinaAgendada.add(fila.rotinaAgendada.name, { empresaId, rotina });
  }

  return empresas.length;
}

/**
 * O disparo da manutenção: **uma** tarefa sem tenant, mais o expurgo do histórico por empresa.
 *
 * ⚠️ **A carga da tarefa sem tenant é o objeto vazio**, e a ausência de campo é conformidade com a
 * emenda de 2026-08-18 da ADR-0024: não há empresa a resolver, porque os alvos dela são o schema da
 * plataforma (ADR-0031) e o sistema de arquivos. Acrescentar `empresaId` "por analogia" com a fila
 * irmã **não compila** — `CargaDaManutencaoDoAcervo` é `Record<string, never>`.
 *
 * ⚠️ **O expurgo do histórico corre por empresa, e a assimetria é a decisão**:
 * `negocio.execucao_de_rotina` **é** tenantizada, de modo que apagá-la exige contexto — e por isso
 * ela viaja na fila da rotina agendada, e não junto do resto da manutenção. As duas rotinas
 * compartilham o **disparo** (uma unidade `systemd` de madrugada), nunca a passagem.
 */
async function despacharManutencao(fila: Fila, empresas: readonly string[]): Promise<number> {
  await fila.manutencaoDoAcervo.add(fila.manutencaoDoAcervo.name, {});

  return 1 + (await despacharPorEmpresa(fila, empresas, ROTINA_DO_EXPURGO));
}

/**
 * Reenfileira as notícias paradas em `RECEBIDO` além da folga — o fecho do `D13 · F4/T6`.
 *
 * ⚠️ **A carga é `{ notificacaoId }`, sem campo de empresa**, e a ausência é a ADR-0035 aplicada à
 * letra: na entrada de fato de terceiro a empresa é o **resultado** da travessia nominal, e o único
 * valor disponível aqui viria do recebido. Pôr `empresaId` seria violação, não conformidade.
 *
 * A fila é a que **já existia** — a mesma que a borda HTTP alimenta e que a reativação de empresa
 * suspensa reenfileira —, e a tarefa é a mesma: ela opera sobre a notícia **já gravada**, o que torna
 * a repetição segura sem mecanismo novo.
 */
async function despacharRetomada(fila: Fila, banco: AcessoAoBanco): Promise<number> {
  const paradas = await banco.emUnidadeDeTrabalho(
    async (tx) => await listarNaoTratadas(tx, FOLGA_DA_RETOMADA_EM_MINUTOS),
  );

  for (const notificacaoId of paradas) {
    await fila.notificacaoBancaria.add(fila.notificacaoBancaria.name, { notificacaoId });
  }

  return paradas.length;
}

/**
 * Executa o despacho da rotina pedida, e devolve o que ele produziu.
 *
 * O `switch` é exaustivo por construção: o `never` do ramo final **não compila** se uma alternativa
 * de {@link RotinaDeDespacho} deixar de ter ramo. É o que impede uma unidade `systemd` nova de disparar um
 * processo que termina `0` sem ter feito nada — trabalho não feito sem uma linha vermelha em lugar
 * nenhum, que é o desfecho que esta fatia inteira existe para não ter.
 */
async function executarDespacho(
  rotina: RotinaDeDespacho,
  fila: Fila,
  banco: AcessoAoBanco,
): Promise<ResumoDoDespacho> {
  // A retomada NÃO enumera empresa alguma, e por isso ela sai antes: pedir a enumeração para depois
  // descartá-la abriria uma consulta a `identidade` sem consumidor.
  if (rotina === 'RETOMADA_DE_NOTICIAS') {
    return {
      empresasEnumeradas: 0,
      tarefasEnfileiradas: await despacharRetomada(fila, banco),
    };
  }

  const empresas = await enumerarEmpresasAtivas(banco);

  switch (rotina) {
    case 'AVISO_DE_COBRANCA':
      return {
        empresasEnumeradas: empresas.length,
        tarefasEnfileiradas: await despacharAviso(fila, empresas),
      };
    case 'ENCERRAMENTO_DE_CONTRATOS':
    case 'CONFERENCIA_DE_LIQUIDACAO':
    case 'VIGILANCIA_DAS_ROTINAS':
      return {
        empresasEnumeradas: empresas.length,
        tarefasEnfileiradas: await despacharPorEmpresa(
          fila,
          empresas,
          ROTINA_DE_TRABALHO_POR_UNIDADE[rotina],
        ),
      };
    case 'MANUTENCAO':
      return {
        empresasEnumeradas: empresas.length,
        tarefasEnfileiradas: await despacharManutencao(fila, empresas),
      };
    default: {
      const rotinaNaoTratada: never = rotina;

      throw new Error(`a rotina ${String(rotinaNaoTratada)} não tem despacho declarado`);
    }
  }
}

// ---------------------------------------------------------------------------
// A devolução dos recursos e a medição
// ---------------------------------------------------------------------------

/**
 * Começa a medir a duração do despacho e devolve como lê-la — a **única** leitura de relógio deste
 * arquivo.
 *
 * ⚠️ Ela é a exceção que o `CT-1062` declara **e afirma por igualdade**, justamente para não virar
 * porta de entrada: a asserção compara as ocorrências encontradas com as duas linhas desta função, de
 * modo que uma leitura de relógio acrescentada em qualquer outro ponto reprova nomeando arquivo e
 * linha. Ela **não decide nada** — o que decide o que venceu, o que atrasou e o que expirou é o
 * relógio do **banco** (ADR-0026).
 */
function cronometrar(): () => number {
  const inicio = Date.now();

  return () => Date.now() - inicio;
}

/**
 * Devolve a reserva de conexões com o banco, em **tempo limitado**.
 *
 * Mesma forma e mesma razão de `./main.ts`: a falha é registrada e **não sobe** — no fecho, uma
 * rejeição aqui trocaria um diagnóstico por um travamento, e o que já foi enfileirado já foi.
 *
 * @returns `true` quando a reserva foi devolvida dentro do prazo.
 */
async function devolverReserva(banco: AcessoAoBanco, logger: Logger): Promise<boolean> {
  let prazo: NodeJS.Timeout | undefined;
  const expirar = new Promise<false>((resolver) => {
    prazo = setTimeout(() => resolver(false), LIMITE_DE_DEVOLUCAO_DA_RESERVA_MS);
  });

  try {
    return await Promise.race([banco.encerrar().then(() => true), expirar]);
  } catch (erro) {
    logger.error({ erro }, 'falha ao devolver a reserva de conexões com o banco');

    return false;
  } finally {
    clearTimeout(prazo);
  }
}

/**
 * Devolve fila e reserva, nesta ordem, **incondicionalmente** — inclusive depois de o despacho ter
 * falhado.
 *
 * A fila primeiro porque é ela que ainda pode ter comando em voo; a reserva depois, e sempre:
 * enquanto ela estiver de pé o processo não termina, e a falha da fila deixaria de ser diagnóstico
 * para virar travamento. Nenhuma das duas rejeições sobe — quem decide o código de saída é o despacho.
 *
 * @returns `true` quando os dois recursos voltaram pelo caminho gracioso, dentro dos prazos.
 */
async function devolverRecursos(
  fila: Fila,
  banco: AcessoAoBanco,
  logger: Logger,
): Promise<boolean> {
  const desfechoDaFila = await fila.encerrar().catch((erro: unknown) => {
    logger.error({ erro }, 'falha ao devolver os recursos da fila');

    return 'PRAZO-ESTOURADO' as const;
  });

  const reservaDevolvida = await devolverReserva(banco, logger);

  return desfechoDaFila === 'RECURSOS-DEVOLVIDOS' && reservaDevolvida;
}

// ---------------------------------------------------------------------------
// O ponto de entrada
// ---------------------------------------------------------------------------

/**
 * Executa **uma** passagem completa do despachante e devolve o código de saída.
 *
 * A ordem das duas recusas é conteúdo: a rotina desconhecida é recusada **antes** da leitura do
 * ambiente, porque ela é defeito da unidade `systemd` e não da instalação — e recusá-la depois faria
 * um `ExecStart=` errado num host mal provisionado reportar a variável ausente, mandando o operador
 * procurar o problema errado. As duas acontecem **antes** de banco e fila serem abertos, de modo que
 * nenhuma recusa deixa recurso para trás.
 */
async function despachar(
  nomeDaRotina: string | undefined,
  fonte: Readonly<Record<string, string | undefined>>,
): Promise<number> {
  const rotina = nomeDaRotina === undefined ? undefined : ROTINAS_DE_DESPACHO[nomeDaRotina];

  if (rotina === undefined) {
    // O nome RECEBIDO não é ecoado: ele vem de `argv`, e a disciplina da mensagem de partida é do
    // formato — o que o operador precisa é a lista do que **é** aceito.
    process.stderr.write(`rotina desconhecida em argv[2]. Valores aceitos: ${NOMES_ACEITOS}\n`);

    return CODIGO_DE_ROTINA_DESCONHECIDA;
  }

  let ambiente: AmbienteDoDespacho;
  try {
    ambiente = lerAmbienteDoDespacho(fonte);
  } catch (erro) {
    process.stderr.write(`${erro instanceof Error ? erro.message : String(erro)}\n`);

    return CODIGO_DE_FALHA;
  }

  const logger = criarLogger({ nivel: ambiente.nivelDeLog });
  const lerDuracao = cronometrar();
  const banco = abrirAcessoAoBanco({ cadeiaDeConexao: ambiente.cadeiaConexaoBanco });
  const fila = conectarFila(ambiente.cadeiaConexaoFila, logger);

  let codigo = CODIGO_DE_SUCESSO;
  try {
    const resumo = await executarDespacho(rotina, fila, banco);

    logger.info({ rotina, ...resumo, duracaoMs: lerDuracao() }, 'despacho da rotina concluído');
  } catch (erro) {
    // A exceção é registrada AQUI, e não relançada: é o journal que o operador lê quando o
    // `OnFailure=` o avisa, e o que ele precisa é da rotina nomeada ao lado da causa já redigida.
    logger.error({ rotina, erro, duracaoMs: lerDuracao() }, 'o despacho da rotina falhou');
    codigo = CODIGO_DE_FALHA;
  } finally {
    if (!(await devolverRecursos(fila, banco, logger))) {
      // Desistir por decisão própria, dizendo no journal por quê, é melhor do que a unidade
      // `Type=oneshot` ficar pendurada até o `TimeoutStartSec` do supervisor — que não deixa
      // registro e atrasa o disparo seguinte. O código já decidido é preservado.
      logger.error({ rotina }, 'o despachante não devolveu todos os recursos dentro do prazo');
      process.exitCode = codigo;
      process.exit();
    }
  }

  return codigo;
}

/** Este módulo foi executado como programa, ou apenas importado? Mesma disciplina de `./main.ts`. */
function ehPontoDeEntrada(): boolean {
  const invocado = process.argv[1];

  return invocado !== undefined && import.meta.url === pathToFileURL(invocado).href;
}

if (ehPontoDeEntrada()) {
  process.exitCode = await despachar(process.argv[2], process.env);
}
