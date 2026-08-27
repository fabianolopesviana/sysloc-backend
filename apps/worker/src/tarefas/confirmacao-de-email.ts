/**
 * A **borda da entrega da confirmação de endereço de e-mail** — o contexto de tenant nasce da carga,
 * e é daqui que a mensagem alcança o mundo.
 *
 * ---------------------------------------------------------------------------
 * A decisão que este arquivo materializa (ADR-0024 e ADR-0029)
 * ---------------------------------------------------------------------------
 *
 * A ADR-0029 manda o efeito externo de um ato de negócio sair **por fila**: a borda HTTP grava o
 * cadastro e o portador, commita, e enfileira — quem alcança o servidor de e-mail é **este**
 * processo. A ADR-0024 fecha a lacuna do contexto: fora do ciclo de uma requisição não existe
 * sessão, e o `empresaId` vem da **carga do próprio trabalho**, aberto **uma vez, na borda que a
 * recebe**, pelo mesmo escritor único que a borda HTTP usa (`contextoDeTenant.executarCom`). Nada
 * abaixo daqui reescreve o contexto, e **nenhuma sessão de serviço sintética é criada**.
 *
 * O identificador que viaja na carga é produzido por quem **já detinha direito a ele** — a sessão
 * que atendeu o cadastro ou o reenvio. Essa procedência **não é verificável pelo banco**: ela é
 * disciplina de quem enfileira, e é por isso que não existe rota que aceite `empresaId` de fora.
 *
 * ---------------------------------------------------------------------------
 * Por que a carga é RECUSADA antes de qualquer contexto e de qualquer leitura
 * ---------------------------------------------------------------------------
 *
 * Mesma disciplina, e mesma razão, de `./regua.ts`: sem contexto, a política do banco não casa linha
 * alguma e devolve conjunto vazio **em silêncio**. Aqui o desfecho seria uma tarefa que termina sem
 * entregar mensagem nenhuma e sem nada que acuse — e o locatário fica esperando um link que ninguém
 * mandou.
 *
 * A conferência é do **esquema**, e ele monta as três exigências a partir do que já existe: o
 * identificador vem de `@syslocbr/contracts` (ADR-0016), que valida a forma **e canoniza a caixa do
 * UUID** (ADR-0017), e o molde do segredo vem do **mesmo** esquema que a rota pública usa para
 * recusar segredo malformado. Redigitar qualquer um dos dois criaria uma segunda definição do mesmo
 * fato, livre para divergir.
 *
 * ⚠️ **A razão da falha nomeia o CAMPO, nunca o VALOR.** Ela fica gravada no servidor de fila e
 * chega ao journal: nome de campo não é segredo, e valor de campo pode ser dado de outra empresa —
 * ou, nesta carga, **o próprio segredo em claro**.
 *
 * ---------------------------------------------------------------------------
 * O que esta borda faz, e o que ela deliberadamente NÃO faz
 * ---------------------------------------------------------------------------
 *
 * Ela liga as pontas e **não decide nada do domínio**: o texto da mensagem é de
 * `comporMensagemDeConfirmacao` (`@sysloc/documentos`), que é função pura e recebe a base do link
 * **por parâmetro**; a entrega é pela `PortaDeEnvioDeEmail` que `@sysloc/regua` declara. As duas
 * chegam por parâmetro (ADR-0025), e é por isso que a operação injeta o adaptador de SMTP e a
 * verificação injeta o capturador **pelo mesmo parâmetro**, sem que exista bandeira, ambiente ou ramo
 * que escolha entre os dois. **Nenhum adaptador novo nasce aqui**, e o cabeçalho de
 * `packages/regua/src/adaptador-smtp.ts` proíbe por escrito a duplicação que um segundo convidaria.
 *
 * ⚠️ **Nenhuma repetição escrita à mão.** Quem retenta é a fila, com `OPCOES_PADRAO_DA_TAREFA` — três
 * tentativas, espera exponencial a partir de um segundo. Um laço de tentativas aqui multiplicaria as
 * da fila em silêncio, e o locatário receberia a mesma mensagem nove vezes.
 *
 * ---------------------------------------------------------------------------
 * A repetição é INOFENSIVA por construção — e nenhuma guarda foi escrita para isso
 * ---------------------------------------------------------------------------
 *
 * Reprocessar a tarefa reenvia a **mesma** mensagem com o **mesmo** segredo: o portador já está
 * gravado, e esta borda não o recria — ela nem tem como, porque o que ela recebe é o claro, e emitir
 * outro exigiria escrever no banco. O pior desfecho é o locatário receber duas vezes; o link
 * continua sendo um só. É o que a §9.2 da tech spec declara, e ele vale sem que exista aqui uma
 * segunda regra de idempotência livre para divergir da primeira.
 *
 * ---------------------------------------------------------------------------
 * O envio corre FORA da unidade de trabalho
 * ---------------------------------------------------------------------------
 *
 * A leitura do locatário é a única coisa que acontece dentro dela. Manter a transação aberta durante
 * a conversa com o servidor de e-mail prenderia uma conexão da reserva pelo tempo de uma entrega de
 * rede — e a reserva deste processo é pequena de propósito. A leitura devolve o que a composição
 * precisa, e a transação fecha antes de a mensagem sair.
 */

import {
  type AcessoAoBanco,
  contextoDeTenant,
  localizarPessoa,
  PAPEIS_DE_PESSOA,
} from '@sysloc/db';
import { comporMensagemDeConfirmacao } from '@sysloc/documentos';
import type { PortaDeEnvioDeEmail } from '@sysloc/regua';
import { FILA_DA_CONFIRMACAO, type Logger } from '@sysloc/shared';
import { ESQUEMA_DO_IDENTIFICADOR, esquemaDaApresentacaoDoPortador } from '@syslocbr/contracts';
import { z } from 'zod';
import type { TarefaDaConfirmacao } from '../fila.js';

/**
 * O papel a que a confirmação pertence, tirado da união **fechada** que `@sysloc/db` publica.
 *
 * Indexado, e não redigitado, pela mesma razão de `apps/api/src/cadastros/confirmacao-de-email.service.ts`:
 * um literal solto compilaria mesmo depois de o papel deixar de existir na porta, e a leitura cairia
 * numa tabela que ninguém mais mantém. A coluna `email_confirmado_em` existe **só** em
 * `negocio.locatario`, e é isso que faz esta tarefa ser do locatário e de nenhum outro papel.
 */
const PAPEL_DO_TITULAR = PAPEIS_DE_PESSOA[1];

/**
 * Os nomes dos campos que a carga precisa trazer — constantes porque cada um aparece em **dois**
 * contratos.
 *
 * Eles são as chaves do esquema e são as cadeias que a razão da falha publica, e é por essas cadeias
 * que a verificação reconhece a recusa. Literais separados divergiriam sem que nada acusasse: o
 * esquema passaria a exigir um campo e a mensagem a nomear outro. Mesma forma de `./regua.ts`.
 */
const CAMPO_DA_EMPRESA = 'empresaId';
const CAMPO_DO_LOCATARIO = 'locatarioId';
const CAMPO_DO_SEGREDO = 'segredo';

/**
 * O que a carga da tarefa precisa ser — **exatamente** os três campos, todos obrigatórios.
 *
 * `strictObject`, e não `object`: campo desconhecido é **recusado**, em vez de ignorado. A carga é a
 * origem do contexto de tenant, e ignorar o que veio a mais é o começo de ela virar "o novo request"
 * — o `Cons` que a ADR-0024 registra e a alternativa que ela rejeita por nome.
 *
 * O molde do segredo é o **do contrato publicado**, tomado do esquema da rota pública em vez de
 * reescrito: são 43 caracteres do alfabeto base64url, ancorados nas duas pontas, e é a mesma cadeia
 * que aquela rota aceita. Uma expressão redigitada aqui seria a segunda definição de um mesmo fato
 * (ADR-0016) — e a primeira a divergir faria esta borda recusar um segredo que a rota aceita, ou o
 * contrário.
 */
const ESQUEMA_DA_CARGA = z.strictObject({
  [CAMPO_DA_EMPRESA]: ESQUEMA_DO_IDENTIFICADOR,
  [CAMPO_DO_LOCATARIO]: ESQUEMA_DO_IDENTIFICADOR,
  [CAMPO_DO_SEGREDO]: esquemaDaApresentacaoDoPortador.shape.segredo,
});

/**
 * A exigência publicada na razão da falha, nomeando os campos e **nada mais**.
 *
 * A razão fica gravada no servidor de fila e alcança o journal. Ela nomeia os campos exigidos e os
 * recusados **pelo nome**; o conteúdo recebido nunca entra. Aqui isso é mais sério do que na régua:
 * um dos campos é o **segredo em claro** do portador, e ecoá-lo publicaria no journal o que abre a
 * confirmação de outra pessoa.
 */
const EXIGENCIA_DA_CARGA =
  `a carga da tarefa de confirmação exige os campos '${CAMPO_DA_EMPRESA}', ` +
  `'${CAMPO_DO_LOCATARIO}' e '${CAMPO_DO_SEGREDO}', e nada além deles`;

/**
 * O que a borda diz quando o contexto da carga não alcança o locatário.
 *
 * Ela **não** distingue *"não existe"* de *"é de outra empresa"*, e a indistinção é de graça aqui:
 * quem não é alcançado pela política do banco não é achado (ADR-0008), e esta borda não compara
 * empresa alguma. A cadeia não carrega identificador: quem liga a falha ao trabalho é o registro da
 * tarefa, que o consumidor grava com `idTarefa`.
 */
const MOTIVO_DE_LOCATARIO_AUSENTE =
  'o locatário da tarefa de confirmação não foi alcançado sob o contexto da carga';

/** As portas que a composição raiz do processo entrega à borda. */
export interface DependenciasDaConfirmacao {
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
  /**
   * O endereço público do aplicativo, de `URL_BASE_DA_CONFIRMACAO`, já conferido na partida.
   *
   * Ele atravessa esta borda até a composição **por parâmetro**, e a razão está no cabeçalho de
   * `packages/documentos/src/mensagem-de-confirmacao.ts`: o domínio não lê ambiente, e uma segunda
   * leitura escaparia da conferência de partida.
   */
  readonly urlBaseDaConfirmacao: string;
}

/**
 * Entrega a confirmação de **um** endereço, sob o contexto que a carga declara.
 *
 * @param tarefa       A tarefa, como o servidor de fila a entregou.
 * @param logger       Registrador do processo, recebido do consumidor que a executa.
 * @param dependencias As portas da composição raiz — ver {@link DependenciasDaConfirmacao}.
 * @throws {Error} Quando a carga não traz os três campos válidos — **antes** de abrir contexto e
 * antes de qualquer leitura —, quando o contexto não alcança o locatário, ou quando a entrega falha,
 * caso em que a fila repete o trabalho pela política de `@sysloc/shared`.
 */
export async function processarConfirmacaoDeEmail(
  tarefa: TarefaDaConfirmacao,
  logger: Logger,
  dependencias: DependenciasDaConfirmacao,
): Promise<void> {
  // Primeiro a recusa, e só depois o contexto: é a ordem que impede o trabalho de correr sem
  // contexto válido e de tocar o banco com o que veio de fora.
  const carga = cargaConferida(tarefa.data);
  const { banco, email, urlBaseDaConfirmacao } = dependencias;

  const locatario = await contextoDeTenant.executarCom(
    { empresaId: carga.empresaId },
    async () =>
      await banco.emUnidadeDeTrabalho(
        async (tx) => await localizarPessoa(tx, PAPEL_DO_TITULAR, carga.locatarioId),
      ),
  );

  if (locatario === undefined) {
    // Levantar, e não concluir em silêncio: a tarefa fica retida como falha, com a razão gravada, em
    // vez de desaparecer como se a mensagem tivesse saído. O caso acontece se o cadastro for apagado
    // entre o disparo e a entrega — e é o operador quem decide o que fazer com ele.
    throw new Error(MOTIVO_DE_LOCATARIO_AUSENTE);
  }

  const mensagem = comporMensagemDeConfirmacao({
    nome: locatario.nome,
    segredo: carga.segredo,
    urlBase: urlBaseDaConfirmacao,
  });

  // Os campos do registro são os da §13.1 da tech spec, e a lista é fechada: `idTarefa`, `fila` e os
  // dois identificadores. **Nem o segredo, nem o derivado, nem o endereço** entram — o claro é o que
  // abre a confirmação de outra pessoa, e o journal é lido pelo operador da plataforma.
  const doTrabalho = {
    idTarefa: tarefa.id,
    fila: FILA_DA_CONFIRMACAO,
    empresaId: carga.empresaId,
    locatarioId: carga.locatarioId,
  };

  try {
    await email.enviar(locatario.email, mensagem);
  } catch (erro) {
    // A causa é registrada AQUI, e a falha sobe intacta para a fila repetir. Registrar e engolir
    // faria a tarefa terminar concluída sem mensagem alguma ter saído; e subir sem registrar aqui
    // perderia `empresaId` e `locatarioId` — o manipulador de `failed` de `../fila.js` já grava a
    // falha em `error`, mas o que ele alcança é `{ idTarefa, fila, tentativa }`, e é a correlação
    // com o cadastro que a §13.1 da tech spec prescreve NESTE evento. Sem ela, o operador sabe que
    // uma entrega falhou e não sabe de quem.
    logger.warn({ ...doTrabalho, erro }, 'a entrega da confirmação de e-mail falhou');

    throw erro;
  }

  logger.info(doTrabalho, 'confirmação de e-mail entregue');
}

/**
 * A carga conferida, ou uma falha que **nomeia os campos**.
 *
 * A conversão de `data` é deliberada: ela chega desserializada de um armazenamento externo, e o tipo
 * declarado descreve o contrato — não é garantia que esta função possa assumir. É o mesmo raciocínio
 * de `./regua.ts` e de `./eco.ts`.
 */
function cargaConferida(carga: unknown): z.infer<typeof ESQUEMA_DA_CARGA> {
  const analise = ESQUEMA_DA_CARGA.safeParse(carga ?? {});

  if (!analise.success) {
    throw new Error(`${EXIGENCIA_DA_CARGA} (recusado: ${camposRecusados(analise.error)})`);
  }

  return analise.data;
}

/**
 * Descreve o que foi recusado **pelo nome do campo**, nunca pelo conteúdo dele.
 *
 * Quando o problema não tem campo — a carga inteira veio com o tipo errado, ou trouxe chave
 * desconhecida —, o que sai é o **código** do problema, que é rótulo fechado da biblioteca de
 * esquema. Nem o valor recebido nem a mensagem crua atravessam.
 *
 * ⚠️ Ela repete, linha a linha, a função homônima de `./regua.ts`, e a repetição é **deliberada
 * nesta fatia**: aquele arquivo é referência somente leitura aqui (o PRD põe fora de escopo alterar
 * o que a sub-fatia irmã entregou e provou), e promover a função a um módulo comum exigiria editá-lo.
 * Quem for unificar as duas precisa fazê-lo **junto**, e não copiar o endurecimento para uma só.
 *
 * **Nenhum `DÉBITO COM GATILHO` foi emitido para esta cópia, e a ausência é a decisão.** O critério
 * da §3-B da `.claude/rules/nao-regressao.md` é *gatilho concreto* mais **dano silencioso**, e aqui
 * não há o segundo: as duas cópias vivem no **mesmo diretório do mesmo processo** — quem abrir uma
 * enxerga a outra ao lado —, e o pior desfecho de elas divergirem é uma **mensagem de recusa
 * diferente** entre duas filas. Não há vazamento (as duas nomeiam campo, nunca valor) e não há verde
 * falso: a carga recusada continua recusada dos dois lados. É o mesmo discriminante que esta fatia
 * aplicou ao `D7` na T8, e o marcador que não se emite é o que preserva a força dos que importam —
 * a §3-B adverte que marcador em excesso *"ensina todo mundo a ignorar os marcadores que importam"*.
 */
function camposRecusados(erro: z.ZodError): string {
  const nomes = erro.issues.map((problema) =>
    problema.path.length > 0 ? problema.path.join('.') : problema.code,
  );

  return [...new Set(nomes)].join(', ');
}
