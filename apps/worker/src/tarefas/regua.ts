/**
 * A **borda do trabalho automático da régua de cobrança** — onde o contexto de tenant nasce quando
 * não há requisição.
 *
 * ---------------------------------------------------------------------------
 * A decisão que este arquivo materializa (ADR-0024)
 * ---------------------------------------------------------------------------
 *
 * Fora do ciclo de uma requisição não existe sessão, e a ADR-0008 já fixara que a origem do
 * contexto **nunca** é o request. A ADR-0024 fecha a lacuna que sobrava: o contexto vem da **carga
 * do próprio trabalho**, aberto **uma vez, na borda que a recebe**, pelo **mesmo escritor único**
 * que a borda HTTP usa (`contextoDeTenant.executarCom`). Nada abaixo daqui reescreve o contexto, e
 * **nenhuma sessão de serviço sintética é criada** — a alternativa que a ADR descarta por nome,
 * porque criaria credencial de longa duração e atribuiria ato de auditoria a um usuário que não
 * existe.
 *
 * O identificador que viaja na carga é produzido por quem **já detinha direito a ele** — a
 * enumeração de empresas, ou a sessão que enfileirou. Essa procedência **não é verificável pelo
 * banco**: ela é disciplina de quem enfileira, e é por isso que não há rota que aceite `empresaId`
 * de fora.
 *
 * ---------------------------------------------------------------------------
 * Por que a carga é RECUSADA antes de qualquer leitura
 * ---------------------------------------------------------------------------
 *
 * Sem esta recusa o modo de falha é o **pior possível**: sem contexto, a política do banco não casa
 * linha alguma e devolve conjunto vazio **em silêncio** — o trabalho termina CONCLUÍDO, sem enviar
 * nada, e a régua *parece* ter rodado. Nenhum alarme, nenhuma linha vermelha, e a imobiliária
 * descobre pelo inadimplente que ninguém avisou.
 *
 * A conferência é do **esquema**, e o esquema é o de `@syslocbr/contracts` (ADR-0016): ele valida a
 * forma **e canoniza a caixa do UUID** (ADR-0017), que já foi vetor de escalada. A razão da falha
 * nomeia o **campo**, nunca o valor recebido — ela fica gravada no servidor de fila e chega ao
 * journal, e valor de campo pode ser dado de outra empresa.
 *
 * ---------------------------------------------------------------------------
 * O que esta borda faz, e o que ela deliberadamente NÃO faz
 * ---------------------------------------------------------------------------
 *
 * Ela liga as pontas e **não decide nada do domínio**: quem decide se a passagem acontece (política
 * desligada, fora da janela), quem é avisado e com que texto é `executarReguaDaEmpresa`, em
 * `@sysloc/regua`. As portas chegam a ele **por parâmetro** (ADR-0025), e é por isso que a operação
 * injeta o adaptador de SMTP e a verificação injeta o capturador **pelo mesmo parâmetro**, sem que
 * exista bandeira, ambiente ou ramo que escolha entre os dois.
 *
 * ⚠️ **A hora vem do BANCO** (`lerHoraCorrenteDaOperacao`, ADR-0026), e não do relógio do processo.
 * A decisão é deliberada e o defeito que ela fecha é invisível: `dentroDaJanela` é pura e recebe o
 * `HH:MM` por parâmetro, de modo que **nenhum caso comportamental** pega um erro na origem desse
 * parâmetro. Uma leitura do relógio do processo depende de `TZ`, que **nenhuma das duas unidades
 * systemd declara**; hoje ela acertaria por acidente (o host está em `America/Sao_Paulo`), e sob
 * UTC a régua dispararia três horas fora da janela configurada sem uma linha vermelha em lugar
 * nenhum. A única rede desse defeito é a varredura estática do `CT-612` — não "otimize" isto para
 * `new Date()`.
 *
 * ---------------------------------------------------------------------------
 * Uma unidade de trabalho para o preparo, e uma por tentativa
 * ---------------------------------------------------------------------------
 *
 * A política e a hora são lidas **na mesma** unidade: as duas descrevem a passagem, e lê-las juntas
 * é o que impede a política de valer para um instante e a janela para outro. Já **cada tentativa**
 * grava em unidade própria — uma unidade para o job inteiro faria a falha da décima cobrança
 * desfazer o registro das nove anteriores, e é justamente o registro que impede o reenvio na
 * repetição do job.
 *
 * ---------------------------------------------------------------------------
 * Por que a falha é levantada NO FIM, e por que a repetição não duplica
 * ---------------------------------------------------------------------------
 *
 * O laço do domínio **não para** na falha de uma candidata: cada desfecho é gravado e o sinal viaja
 * no resultado. A borda levanta ao fim, e a fila repete pela política declarada em
 * `@sysloc/shared`. Na repetição, as já avisadas caem **fora** do conjunto porque cada uma tem
 * tentativa `ENVIADA` dentro do intervalo mínimo — a idempotência vem do **predicado**, e não de
 * uma guarda escrita para ela. Uma guarda de idempotência aqui seria uma segunda regra, livre para
 * divergir da do predicado.
 *
 * ---------------------------------------------------------------------------
 * A PASSAGEM DA RÉGUA DEIXA REGISTRO — e a ausência dele marcava a rotina como parada para sempre
 * ---------------------------------------------------------------------------
 *
 * `AVISO_DE_COBRANCA` é uma das **três** `RotinaPublicada` do roster do Admin, com cadência
 * `A_CADA_MINUTO` e limiar de atraso de 15 minutos (`LIMIAR_DE_ATRASO_POR_CADENCIA`). Quem deriva
 * *"atrasada"* é a consulta de `lerEstadoDasRotinas`, comparando o silêncio desde a **última
 * execução registrada** contra esse limiar — e até esta task **nada gravava** a execução desta
 * rotina. O desfecho não era um número errado numa tela: era a vigilância da fila gritando `error`
 * a cada quinze minutos, para sempre, sobre uma rotina que roda a cada minuto, e a leitura do Admin
 * publicando-a como parada. A única passagem que produz o fato é esta, e é aqui que ele nasce.
 *
 * ⚠️ **O predicado é `enviadas + falhas + semDestinatario > 0`** (RD-15), e não `candidatas > 0`: o
 * que conta como efeito é a **tentativa** — a mensagem entregue, a que falhou, a que não tinha para
 * onde ir —, e cada uma delas deixa linha em `negocio.envio_de_cobranca`. A passagem que não tentou
 * nada não produziu efeito, e registrá-la reintroduziria o **registro de passagem vazia**: o
 * histórico de 12 MB por empresa do sistema antigo, sobre uma rotina de **minuto**, que é onde ele
 * custa mais caro. A régua desligada e a passagem fora da janela caem exatamente aí — as três
 * contagens são zero, e nada é gravado.
 *
 * ⚠️ **O resumo REUSA os campos de `ResultadoDaRegua`** — `candidatas`, `enviadas`, `falhas` e
 * `semDestinatario` —, e não inventa `avisadas`/`recusadas`: um segundo vocabulário para o mesmo
 * fato é o que a RN-19 proíbe, e o registro é `jsonb` aberto justamente para publicar as contagens
 * **como a rotina as produziu**. `houveFalha` fica de fora porque é booleano, e o resumo é registro
 * de números.
 *
 * ⚠️ **O registro corre em unidade PRÓPRIA, e não na do envio.** Aqui não existe unidade única da
 * passagem a que ele pudesse pertencer: cada tentativa grava na sua, de propósito, para que a falha
 * da décima não desfaça as nove anteriores. É a mesma situação — e a mesma consequência declarada —
 * da conferência de liquidação em `./rotina-agendada.ts`: uma queda entre o fim da passagem e o
 * registro deixa a passagem feita sem a linha que a conta, e a passagem seguinte, um minuto depois,
 * repõe o registro sem duplicar aviso, porque a trava do intervalo já protegeu as caixas.
 *
 * ⚠️ **Ele corre DENTRO do contexto de tenant**, junto do resto da passagem:
 * `registrarExecucaoDeRotina` não recebe `empresaId` — o `empresa_id` sai de `app.empresa_id`, e o
 * `WITH CHECK` da política aceita ou recusa o valor proposto (ADR-0008/ADR-0024).
 *
 * ⚠️ **O disparo MANUAL de uma cobrança não passa por aqui, e não deve registrar**: ele é ato de uma
 * pessoa sobre **uma** cobrança, e não passagem de rotina. Gravá-lo faria o botão do operador
 * "consertar" o atraso de uma rotina automática que continua parada.
 *
 * ---------------------------------------------------------------------------
 */

import {
  type AcessoAoBanco,
  contextoDeTenant,
  lerHoraCorrenteDaOperacao,
  lerPoliticaDeAviso,
  registrarEnvioDeCobranca,
  registrarExecucaoDeRotina,
  selecionarCandidatasAoAviso,
} from '@sysloc/db';
import {
  executarReguaDaEmpresa,
  type PortaDeEnvioDeEmail,
  type ResultadoDaRegua,
} from '@sysloc/regua';
import { FILA_DA_REGUA, type Logger } from '@sysloc/shared';
import { ESQUEMA_DO_IDENTIFICADOR, type RotinaPublicada } from '@syslocbr/contracts';
import { z } from 'zod';
import type { TarefaDaRegua } from '../fila.js';

/**
 * O nome do campo que a carga precisa trazer — constante porque ele aparece em **dois** contratos.
 *
 * Ele é a chave do esquema e é a cadeia que a razão da falha publica, e é por essa cadeia que a
 * verificação reconhece a recusa. Dois literais separados divergiriam sem que nada acusasse: o
 * esquema passaria a exigir um campo e a mensagem a nomear outro.
 */
const CAMPO_DA_EMPRESA = 'empresaId';

/**
 * O que a carga da tarefa precisa ser — **exatamente** um identificador de empresa.
 *
 * `strictObject`, e não `object`: campo desconhecido é **recusado**, em vez de ignorado. A carga é
 * a origem do contexto de tenant, e ignorar o que veio a mais é o começo de ela virar "o novo
 * request" — o `Cons` que a ADR-0024 registra e a alternativa que ela rejeita por nome.
 *
 * O identificador vem de `@syslocbr/contracts` (ADR-0016) e não é redigitado: ele confere a forma e
 * **canoniza a caixa do UUID** (ADR-0017). A canonização importa aqui e não é ornamento — é este
 * valor que a unidade de trabalho compõe no `SET LOCAL`.
 */
const ESQUEMA_DA_CARGA = z.strictObject({ [CAMPO_DA_EMPRESA]: ESQUEMA_DO_IDENTIFICADOR });

/**
 * A exigência publicada na razão da falha, nomeando o campo e **nada mais**.
 *
 * A razão fica gravada no servidor de fila e alcança o journal. Ela nomeia o campo exigido e os
 * campos recusados **pelo nome**; o conteúdo recebido nunca entra — nome de campo não é segredo,
 * valor de campo pode ser dado de outra empresa. Mesma disciplina de `./eco.ts`.
 */
const EXIGENCIA_DA_CARGA =
  `a carga da tarefa da régua exige o campo '${CAMPO_DA_EMPRESA}' com um identificador de ` +
  'empresa (UUID), e nada além dele';

/**
 * O nome desta rotina no roster publicado — tipado, e não literal solto.
 *
 * `RotinaPublicada` é derivado de `CADENCIA_DA_ROTINA` pelo campo `publicada`, de modo que um nome
 * fora do roster **não compila** — e é a mesma união que `ExecucaoDeRotinaNova.rotina` exige. É o que
 * torna impossível esta borda gravar registro de uma rotina que a leitura do Admin não publica.
 */
const ROTINA_DO_AVISO: RotinaPublicada = 'AVISO_DE_COBRANCA';

/** O que a borda diz quando a passagem terminou com tentativa em falha. */
const MOTIVO_DA_REPETICAO = 'a passagem da régua terminou com tentativa de envio em falha';

/** As portas que a composição raiz do processo entrega à borda. */
export interface DependenciasDaRegua {
  /**
   * A porta única para transação, aberta pela composição raiz e encerrada por ela no desligamento.
   *
   * Ela é **recebida**, e não construída aqui: quem conhece `DATABASE_URL` é `lerAmbiente`, e uma
   * segunda abertura por tarefa criaria uma reserva de conexões por job.
   */
  readonly banco: AcessoAoBanco;
  /**
   * A porta de saída — o adaptador de produção na operação, o capturador na verificação.
   *
   * Os dois são indistintos daqui, e é essa indistinção que faz a verificação exercitar a **mesma**
   * fiação sem nunca ter caminho para alcançar rede (CA-17).
   */
  readonly email: PortaDeEnvioDeEmail;
}

/**
 * Executa a passagem da régua de **uma** empresa, sob o contexto que a carga declara.
 *
 * @param tarefa       A tarefa, como o servidor de fila a entregou.
 * @param logger       Registrador do processo, recebido do consumidor que a executa.
 * @param dependencias As portas da composição raiz — ver {@link DependenciasDaRegua}.
 * @throws {Error} Quando a carga não traz {@link CAMPO_DA_EMPRESA} válido — **antes** de qualquer
 * leitura e sem abrir contexto —, ou quando alguma tentativa de envio falhou, caso em que a fila
 * repete o trabalho.
 */
export async function processarReguaDeCobranca(
  tarefa: TarefaDaRegua,
  logger: Logger,
  dependencias: DependenciasDaRegua,
): Promise<void> {
  // Primeiro a recusa, e só depois o contexto: é a ordem que impede o trabalho de correr sem
  // contexto válido e devolver vazio como se fosse sucesso.
  const empresaId = empresaDaCarga(tarefa.data);
  const { banco, email } = dependencias;

  const resultado = await contextoDeTenant.executarCom({ empresaId }, async () => {
    // A política e a hora, na MESMA unidade — ver o cabeçalho. As duas descrevem a passagem.
    const passagem = await banco.emUnidadeDeTrabalho(async (tx) => ({
      politica: await lerPoliticaDeAviso(tx),
      agora: await lerHoraCorrenteDaOperacao(tx),
    }));

    const passada = await executarReguaDaEmpresa({
      politica: passagem.politica,
      agora: passagem.agora,
      // A aplicação parcial acontece AQUI: é a borda que decide sob que contexto e em que unidade
      // de trabalho cada consulta corre. O domínio recebe portas sem parâmetro de empresa — não há
      // por onde uma empresa ser escolhida abaixo desta linha.
      candidatas: async () =>
        await banco.emUnidadeDeTrabalho(
          async (tx) => await selecionarCandidatasAoAviso(tx, passagem.politica),
        ),
      registrar: async (tentativa) =>
        await banco.emUnidadeDeTrabalho(
          async (tx) => await registrarEnvioDeCobranca(tx, tentativa),
        ),
      email,
    });

    // O registro da PASSAGEM — o que faz `AVISO_DE_COBRANCA` deixar de ser publicada como parada
    // (RD-15). Ele corre dentro do contexto já aberto, em unidade própria, e só quando o predicado
    // de efeito da rotina é verdadeiro. Ver a seção homônima do cabeçalho.
    if (houveEfeito(passada)) {
      await banco.emUnidadeDeTrabalho(async (tx) => {
        await registrarExecucaoDeRotina(tx, { rotina: ROTINA_DO_AVISO, resumo: resumoDa(passada) });
      });
    }

    return passada;
  });

  // O término é REGISTRADO para ser observável de fora do processo. As contagens entram; nenhum
  // endereço, nome ou código de cobrança entra — a auditoria por cobrança é a tabela de envios.
  logger.info(
    { idTarefa: tarefa.id, fila: FILA_DA_REGUA, empresaId, ...resultado },
    'passagem da régua de cobrança concluída',
  );

  if (resultado.houveFalha) {
    // `houveFalha` é DERIVADO pelo domínio, e não recomposto aqui a partir de `falhas > 0`:
    // recompor criaria um segundo lugar onde se decide o que conta como falha, e o primeiro que
    // divergisse faria o job parar de repetir em silêncio.
    throw new Error(
      `${MOTIVO_DA_REPETICAO}: ${String(resultado.falhas)} de ${String(resultado.candidatas)}`,
    );
  }
}

/**
 * A passagem produziu **efeito**? — o predicado de efeito declarado desta rotina (RD-15).
 *
 * Ele é `enviadas + falhas + semDestinatario > 0`, e **não** `candidatas > 0`: o que conta é a
 * tentativa, e não a seleção. A distinção é o que separa *"a régua rodou"* de *"a régua fez alguma
 * coisa"* — e é ela que impede a rotina de **minuto** de gravar 1.440 linhas por empresa por dia
 * numa imobiliária que não tem cobrança a avisar, que é o histórico de 12 MB do sistema antigo com
 * outro nome.
 *
 * ⚠️ **`houveFalha` não entra**, e a ausência é conteúdo: ele já é `falhas > 0` derivado pelo
 * domínio, e somá-lo aqui seria contar a mesma tentativa duas vezes na decisão.
 *
 * A função é **declarada nesta borda**, e não em `@sysloc/db`: o docblock de
 * `registrarExecucaoDeRotina` diz por escrito que ela *"não decide se grava"*. Enfiar a decisão na
 * camada de dados foi recusado por nome, e o risco tem nome — o registro de passagem vazia.
 */
function houveEfeito(passada: ResultadoDaRegua): boolean {
  return passada.enviadas + passada.falhas + passada.semDestinatario > 0;
}

/**
 * O resumo da passagem, no vocabulário que `@sysloc/regua` já publica (RN-19).
 *
 * As quatro contagens saem de `ResultadoDaRegua` **campo a campo**, e não por espalhamento: o
 * espalhamento levaria `houveFalha` junto, e o resumo é registro de **números** — um booleano ali
 * quebraria a forma que o contrato publica (`Record<string, number>`) e a leitura do Admin teria de
 * decidir o que fazer com ele.
 *
 * ⚠️ **Nenhum nome novo é inventado.** `avisadas`/`recusadas` seriam o segundo vocabulário para o
 * mesmo fato que a RN-19 proíbe — e o registro é `jsonb` aberto justamente para publicar as
 * contagens como a rotina as produziu.
 */
function resumoDa(passada: ResultadoDaRegua): Record<string, number> {
  return {
    candidatas: passada.candidatas,
    enviadas: passada.enviadas,
    falhas: passada.falhas,
    semDestinatario: passada.semDestinatario,
  };
}

/**
 * A empresa declarada pela carga, ou uma falha que **nomeia o campo**.
 *
 * A conversão de `data` é deliberada: ela chega desserializada de um armazenamento externo, e o
 * tipo declarado descreve o contrato — não é garantia que esta função possa assumir. É o mesmo
 * raciocínio de `./eco.ts`, com uma consequência mais séria: aqui o campo que falta é o que
 * estabelece o isolamento.
 */
function empresaDaCarga(carga: unknown): string {
  const analise = ESQUEMA_DA_CARGA.safeParse(carga ?? {});

  if (!analise.success) {
    throw new Error(`${EXIGENCIA_DA_CARGA} (recusado: ${camposRecusados(analise.error)})`);
  }

  return analise.data.empresaId;
}

/**
 * Descreve o que foi recusado **pelo nome do campo**, nunca pelo conteúdo dele.
 *
 * Quando o problema não tem campo — a carga inteira veio com o tipo errado, ou trouxe chave
 * desconhecida —, o que sai é o **código** do problema, que é rótulo fechado da biblioteca de
 * esquema. Nem o valor recebido nem a mensagem crua atravessam.
 */
function camposRecusados(erro: z.ZodError): string {
  const nomes = erro.issues.map((problema) =>
    problema.path.length > 0 ? problema.path.join('.') : problema.code,
  );

  return [...new Set(nomes)].join(', ');
}
