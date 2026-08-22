/**
 * A **entrega da notícia do provedor** por empresa — ativação (cadastrar→confirmar) e consulta.
 *
 * ---------------------------------------------------------------------------
 * O ciclo é CADASTRAR e depois CONFIRMAR, e a segunda operação é quem decide
 * ---------------------------------------------------------------------------
 *
 * *"Habilitada"* exige os **dois** positivos (RN-01), e quem prevalece é a **consulta** (RN-05): um
 * cadastro recusado porque a vaga já está ocupada convive com uma consulta positiva, e nesse caso a
 * entrega **está de pé** — sem a segunda operação o produto desabilitaria uma entrega que funciona.
 * É por isso que a recusa do cadastro **não encerra** o ciclo.
 *
 * ---------------------------------------------------------------------------
 * O DISCRIMINADOR é a PRESENÇA do motivo — no CADASTRO, e só nele
 * ---------------------------------------------------------------------------
 *
 * Há um, e só um, desfecho em que a confirmação **não chega a ser alcançada**: aquele em que o
 * provedor **não respondeu** ao cadastro — indisponibilidade, tempo esgotado, concessão que não
 * voltou. O modelo canônico o declara por escrito, em {@link ResultadoDaOperacaoDeEntrega}: `motivo`
 * nulo num desfecho negativo significa *"não houve o que preservar íntegro"*, e o docblock dele fixa
 * que **é essa distinção que a borda lê** para preservar o estado anterior *"em vez de gravar uma
 * desabilitação que ninguém decidiu"* — *"e ela é leitura da **presença**, nunca do conteúdo"*.
 *
 * ⚠️ **Essa leitura vale para o CADASTRO, e NÃO se transporta para a CONSULTA.** O título deste bloco
 * é qualificado de propósito: a frase do modelo canônico não distingue as operações, e lê-la como
 * propriedade do arquivo inteiro leva à conclusão errada. A assimetria é **medida no adaptador**, em
 * `packages/cobranca-bancaria/src/adaptador-sicoob.ts` — `consultarEntrega` devolve
 * `{ aceito: false, motivo: null }` **também quando o provedor RESPONDEU e não encontrou cadastro
 * nosso** (`corpoUtil(texto) === null`), que é o caminho **principal** de desabilitação e não uma
 * indisponibilidade. Na consulta, portanto, `motivo` nulo carrega dois significados
 * **operacionalmente opostos**, e a informação que os separa **não chega até aqui**: aplicar à
 * confirmação o mesmo `return undefined` do cadastro seria a leitura uniforme e idiomática, e está
 * **descartada por razão concreta** — faria *"consultei e não há cadastro nosso lá"* preservar para
 * sempre um `habilitada: true` que já não é verdade, isto é, quebraria a desabilitação exatamente
 * pelo caminho por onde ela acontece de fato.
 *
 * ✅ **O preço dessa assimetria FOI PAGO em 2026-08-22** (era o `D35 · F5/T7`). O parágrafo anterior
 * registrava que cadastro aceito seguido de consulta que **não respondeu** gravava
 * `habilitada: false` com motivo nulo sobre o estado de uma entrega que podia estar de pé — porque
 * *"não respondeu"* e *"respondeu e não há cadastro nosso"* chegavam **iguais** à borda.
 *
 * Hoje a porta devolve `LeituraDaEntrega`, que os distingue por nome, e a leitura da **presença** do
 * motivo separa as duas metades: motivo nulo é *"não respondeu"* e **preserva** o estado; motivo
 * presente é *"respondeu e recusou"*, e esse é o fato que se grava. Ver o quadro de decisão em
 * {@link EntregaDaNoticiaService.apurarDesfecho}, cujas sete linhas são a especificação executável
 * da ativação.
 *
 * ⚠️ **Nenhum ramo deste arquivo compara `codigo`, casa `mensagem` ou alcança chave de
 * `diagnostico`.** A proibição é literal no modelo canônico e é a consequência exigível do `D5` e da
 * cláusula de fecho da ADR-0001: é ela que torna inócuo um código de recusa que ninguém previu — não
 * há tabela que o traduza nem `switch` que o consulte. Perguntar ao provedor *"a vaga está ocupada
 * por mim?"* é exatamente o que `consultarEntrega` responde, e é por isso que a resposta dela é o
 * eixo, e não a leitura do texto da recusa do cadastro.
 *
 * > **Divergência declarada em relação ao card da T7** (`autonomia-do-run.md`, A1). Os `CT-1026` e
 * > `CT-1035` do card, como escritos, só se distinguem lendo **o código da recusa** do cadastro —
 * > *"por vaga já ocupada"* contra *"por razão que não é vaga ocupada"*, com a consulta positiva nos
 * > dois. Implementar isso exigiria comparar `motivo.codigo` aqui, que o modelo canônico proíbe por
 * > escrito e que a ADR-0001 fecha. Adotada a leitura da **presença** — a única que a porta oferece
 * > —, com a RN-05 preservada byte a byte: o `CT-1035` continua provando *"cadastro recusado +
 * > consulta positiva ⟹ habilitada"*, e o `CT-1026` reancora o *"a confirmação não é alcançada"* no
 * > eixo em que ele é verdade, que é o do provedor que não respondeu. A razão de escolher assim:
 * > a RN-05 é regra de negócio nomeada no tech spec e tem risco próprio (R6), enquanto o eixo do
 * > `CT-1026` era prescrição de forma de teste — e prescrição de gate é hipótese, não ordem.
 *
 * ---------------------------------------------------------------------------
 * DUAS transações, com o ato externo NO MEIO — e nenhuma delas o cobre
 * ---------------------------------------------------------------------------
 *
 * A primeira lê as **duas** pré-condições e fecha; o ato externo corre fora; a segunda grava. É o
 * padrão que a verificação de identidade estabeleceu, e a razão é a mesma: manter chamada de rede a
 * terceiro dentro de `sql.begin` reservaria conexão física da reserva que atende **todo** o produto
 * durante a espera inteira.
 *
 * Quem abre as unidades é o **controlador**, na borda (decisão D1), e este serviço as recebe por
 * parâmetro — {@link AberturaDeUnidade}, na mesma forma de `../cobrancas/boleto.service.ts`. Ele não
 * injeta `AcessoAoBanco`, e a ausência é o mecanismo.
 *
 * ---------------------------------------------------------------------------
 * A projeção sai das COLUNAS, e nunca do que veio do provedor
 * ---------------------------------------------------------------------------
 *
 * O que a rota publica é o que a gravação devolveu — relido do banco, campo a campo, nunca por
 * espalhamento da linha nem pelo objeto que o adaptador montou em memória. Uma implementação que
 * devolvesse o objeto recebido em vez de reler a coluna passaria num caso de integridade e reprovaria
 * no de substituição, e é essa a diferença que a composição a partir das colunas fecha.
 *
 * ⚠️ **`?? {}` não aparece em lugar nenhum deste arquivo**: `diagnostico` nulo é *"o provedor não
 * mandou campo variável nenhum"*, distinto de `{}`, e converter um no outro seria a mentira sobre a
 * origem que os docblocks de `@sysloc/contracts` e de `@sysloc/cobranca-bancaria` proíbem nos dois
 * níveis acima deste.
 *
 * ---------------------------------------------------------------------------
 * NENHUMA comparação de empresa (ADR-0008)
 * ---------------------------------------------------------------------------
 *
 * Não há `WHERE empresa_id` nem `if (linha.empresaId === …)` aqui, e nenhuma função de dados recebe
 * empresa: quem recorta é a política de isolamento, com RLS forçada. O único uso do identificador de
 * empresa é **carregá-lo ao ato externo** — é ele que chaveia o cache de credencial do adaptador, e é
 * ele que impede a credencial de uma empresa de acompanhar a chamada de outra.
 */

import { Inject, Injectable } from '@nestjs/common';
import type {
  PortaDeEntregaDaNoticia,
  ResultadoDaOperacaoDeEntrega,
} from '@sysloc/cobranca-bancaria';
import type { EstadoDaEntrega } from '@sysloc/contracts';
import {
  type EstadoDaEntregaGravado,
  gravarDesfechoDaEntrega,
  type IdentidadeParaUso,
  lerCertificadoVigente,
  lerEstadoDaEntrega,
  lerIdentidadeParaUso,
  lerVigenciaObservada,
  type MotivoDaRecusaDoProvedor,
  obterEnvelopeCifradoDoVigente,
  type SituacaoDaEntrega,
} from '@sysloc/db';
import { CodigoErro, decifrarSegredo, ErroDeAplicacao } from '@sysloc/shared';
import type { TransactionSql } from 'postgres';
import type { SessaoComEmpresa } from '../comum/contexto-da-sessao.js';
import {
  type Ambiente,
  TOKEN_AMBIENTE,
  TOKEN_PORTA_DE_ENTREGA_DA_NOTICIA,
} from '../configuracao/ambiente.js';
import {
  DISCRIMINADOR_DA_VALIDADE,
  derivarEstadoDaVigencia,
  MENSAGEM_SEM_CERTIFICADO,
} from './certificado.service.js';

/**
 * A abertura de uma unidade de trabalho **da borda**, entregue por parâmetro.
 *
 * Ela é sempre `(trabalho) => sobContextoDaSessao(banco, requisicao, trabalho)`, montada no
 * controlador: o contexto de tenant continua saindo da sessão, e este serviço não conhece a porta de
 * conexão. É a **segunda** escrita desta forma nesta base — a primeira é `AberturaDeUnidade` de
 * `../cobrancas/boleto.service.ts` —, e o limiar deste repositório é três: a terceira sobe para casa
 * compartilhada em vez de nascer aqui do lado.
 */
export type AberturaDeUnidade = <T>(
  trabalho: (tx: TransactionSql, sessao: SessaoComEmpresa) => Promise<T>,
) => Promise<T>;

/** O rótulo do estado com validade encerrada, no vocabulário que `derivarEstadoDaVigencia` publica. */
const VIGENCIA_ENCERRADA = 'VENCIDO';

/**
 * O discriminador do certificado dentro de `detalhes`, e o valor da ausência.
 *
 * Constantes nomeadas porque são **contrato publicado**: o cliente as lê para saber que o que falta é
 * configuração da empresa, e não algo no pedido. Elas coincidem, byte a byte, com as que
 * `../cobrancas/boleto.service.ts` publica nas recusas de pré-condição do outro ato do produto que
 * usa o provedor — as duas superfícies descrevem o **mesmo** fato, e um segundo vocabulário faria o
 * cliente aprender dois.
 *
 * ⚠️ Esta é a **segunda** declaração das duas, e por isso ela fica aqui em vez de subir: o Limiar de
 * Três do `CLAUDE.md` dispara no terceiro consumidor. As duas que já tinham três consumidores —
 * {@link MENSAGEM_SEM_CERTIFICADO} e {@link DISCRIMINADOR_DA_VALIDADE} — subiram nesta task para
 * `./certificado.service.ts`, que é a casa do certificado, e são **importadas** daqui.
 */
// DÉBITO COM GATILHO — D31 · F5/T7 · registrado 2026-08-22
// (NÃO é uma `DECISÃO FECHADA`: ele agenda uma convergência, não protege o código abaixo.)
// O QUÊ: as CINCO constantes de recusa de pré-condição — `DISCRIMINADOR_DO_CERTIFICADO`,
//        `CERTIFICADO_AUSENTE`, `MENSAGEM_DO_CERTIFICADO_VENCIDO`, `MENSAGEM_SEM_IDENTIDADE`,
//        `DISCRIMINADOR_DA_IDENTIDADE` e `IDENTIDADE_AUSENTE` — existem DUAS vezes: aqui e em
//        `../cobrancas/boleto.service.ts`. Elas são **contrato publicado** (o cliente lê a frase e o
//        discriminador), e duas declarações do mesmo contrato são duas regras livres para divergir.
// QUANDO FECHA: a primeira task autorizada a abrir `../cobrancas/boleto.service.ts` por outra razão,
//        ou o TERCEIRO consumidor de qualquer uma delas. Ali as seis sobem para `./certificado.service.ts`
//        — a casa da área do certificado, e para onde as DUAS que já tinham três consumidores
//        (`MENSAGEM_SEM_CERTIFICADO` e `DISCRIMINADOR_DA_VALIDADE`) subiram nesta task.
// POR QUE NÃO AGORA: `../cobrancas/boleto.service.ts` está fora da lista de arquivos da T7, e mover a
//        declaração alteraria o serviço que EMITE boleto — área de cobrança, com suíte própria — por
//        uma task cujo escopo declarado é a entrega da notícia. O que a T7 podia fazer sem alargar
//        escopo era não deixar nascer a terceira cópia das duas que já estavam no limiar, que é o que
//        a exportação de `./certificado.service.ts` fez.
// ÍNDICE: docs/specs/features/integracao-bancaria-autonoma/v1/_run/run-report.md §2, D31
const DISCRIMINADOR_DO_CERTIFICADO = 'certificado';
const CERTIFICADO_AUSENTE = 'AUSENTE';

/** A mensagem da recusa por certificado vencido — a mesma do registro e da emissão, pelo mesmo fato. */
const MENSAGEM_DO_CERTIFICADO_VENCIDO = 'a validade do certificado apresentado já terminou';

/**
 * A recusa por identidade ausente — irmã da do certificado, e **distinta** dela.
 *
 * Distinta porque as duas configurações são independentes: a empresa pode ter material válido e
 * nunca ter informado o identificador da aplicação, e o Admin precisa saber **qual** das duas falta.
 * Segunda declaração das três, pela razão registrada acima.
 */
const MENSAGEM_SEM_IDENTIDADE = 'esta empresa não tem identidade registrada no provedor';
const DISCRIMINADOR_DA_IDENTIDADE = 'identidade';
const IDENTIDADE_AUSENTE = 'AUSENTE';

/**
 * O que a primeira transação apura — as **duas** pré-condições do ato externo, mais a empresa.
 *
 * São duas coisas distintas, e a distinção é conteúdo: o **envelope cifrado do certificado** é o que
 * faz o aperto de mão mútuo, e a **identidade** é de onde saem o identificador da aplicação e o
 * número do cliente que a entrega endereça. Faltando qualquer uma, o ato nem começa.
 */
interface PreparoDaAtivacao {
  readonly empresaId: string;
  readonly envelopeCifrado: string;
  readonly identidade: IdentidadeParaUso;
  /**
   * A referência ao cadastro que **este produto** criou numa tentativa anterior, se houver.
   *
   * Ela é lida na mesma transação das pré-condições, e é o que permite à consulta distinguir *"o
   * meu cadastro, com o endereço antigo"* de *"o cadastro de outro sistema"* — os dois têm URL
   * diferente da atual, e só um deles pode ser corrigido.
   */
  readonly referenciaConhecida: string | undefined;
}

/**
 * O que a segunda transação grava — o desfecho apurado pelo ciclo.
 *
 * `undefined` no lugar dele significa *"não há desfecho a gravar"*: o provedor não respondeu, e o
 * estado anterior permanece.
 */
interface DesfechoApurado {
  readonly situacao: SituacaoDaEntrega;
  readonly motivo: MotivoDaRecusaDoProvedor | null;
  /** A referência opaca ao cadastro, quando ele é comprovadamente nosso. */
  readonly referenciaNoProvedor: string | null;
}

/**
 * O estado publicado da empresa que **nunca tentou** (CA-19).
 *
 * Ele é montado aqui, e não gravado: a empresa que nunca abriu a tela não tem linha, e inserir uma
 * para poder respondê-la faria a ausência de tentativa virar tentativa. `verificadaEm` nulo é o
 * discriminador — é assim que ela se distingue da que tentou e foi recusada, e as duas têm
 * `habilitada: false`.
 */
const ESTADO_SEM_TENTATIVA: EstadoDaEntrega = {
  habilitada: false,
  // Nunca tentou é DESABILITADA, e não em validação: *em validação* pressupõe um ato do produto que
  // aqui nunca aconteceu. `verificadaEm` nulo continua sendo o discriminador dos dois.
  situacao: 'DESABILITADA',
  verificadaEm: null,
  motivo: null,
};

/**
 * A projeção publicada, montada **campo a campo** a partir das colunas.
 *
 * Nunca por espalhamento da linha: o que o banco devolve tem `id` e `verificadaPor`, que não são
 * contrato publicado, e um espalhamento os levaria junto no dia em que o esquema de saída deixasse
 * de ser conferido. É o mesmo molde, e a mesma razão, de `publicar` em `./identidade.service.ts`.
 */
function publicar(gravado: EstadoDaEntregaGravado): EstadoDaEntrega {
  return {
    habilitada: gravado.habilitada,
    situacao: gravado.situacao,
    verificadaEm: gravado.verificadaEm === null ? null : gravado.verificadaEm.toISOString(),
    motivo:
      gravado.motivo === null
        ? null
        : {
            codigo: gravado.motivo.codigo,
            mensagem: gravado.motivo.mensagem,
            // ⚠️ Sem `?? {}`. Ver o cabeçalho: nulo é *"não mandou campo variável nenhum"*, e é
            // distinto de *"mandou um registro vazio"*.
            diagnostico: gravado.motivo.diagnostico,
          },
  };
}

@Injectable()
export class EntregaDaNoticiaService {
  constructor(
    // O ambiente **já validado** na partida — é dele que sai a chave que abre o envelope. Um
    // `process.env` lido aqui escaparia da conferência que recusa chave de comprimento errado.
    @Inject(TOKEN_AMBIENTE) private readonly ambiente: Ambiente,
    @Inject(TOKEN_PORTA_DE_ENTREGA_DA_NOTICIA)
    private readonly provedor: PortaDeEntregaDaNoticia,
  ) {}

  /**
   * Lê o estado persistido da empresa da sessão. **Não fala com o provedor.**
   *
   * A consulta ao vivo foi podada no discovery, e a razão sustenta o módulo inteiro: *a recusa
   * precisa sobreviver à requisição*. Sem a cópia durável, o Admin que fechasse a tela perderia o
   * motivo pelo qual a habilitação falhou.
   *
   * Empresa sem linha responde `200` com o estado *sem tentativa*, e **nunca `404`**: a ausência de
   * tentativa é estado declarado, não recurso inexistente.
   */
  async consultar(tx: TransactionSql): Promise<EstadoDaEntrega> {
    const gravado = await lerEstadoDaEntrega(tx);

    return gravado === undefined ? ESTADO_SEM_TENTATIVA : publicar(gravado);
  }

  /**
   * Ativa a entrega da notícia da empresa da sessão — cadastra no provedor e **confirma por consulta**.
   *
   * A ordem é `abrir → ler as duas pré-condições → FECHAR → cadastrar → confirmar → abrir → gravar`,
   * e a partição é a decisão desta rota: ver o cabeçalho.
   */
  async ativar(abrirUnidade: AberturaDeUnidade, verificadaPor: string): Promise<EstadoDaEntrega> {
    // A PRIMEIRA transação cobre **só a leitura**, e este `await` a fecha: o cliente mTLS ainda não
    // existe quando a conexão física volta para a reserva. A empresa sem pré-condição nem chega à
    // linha seguinte — as três recusas saem daqui de dentro.
    const preparo = await abrirUnidade(async (tx, sessao) => ({
      empresaId: sessao.empresaId,
      envelopeCifrado: await this.exigirCertificadoVigente(tx),
      identidade: await this.exigirIdentidadeVigente(tx),
      // A referência viaja na MESMA leitura das pré-condições, e não numa ida a mais: ela é coluna
      // da linha do estado, que já está aberta aqui. `undefined` cobre os dois casos em que não há
      // o que provar — a empresa que nunca tentou e a que nunca teve cadastro próprio.
      referenciaConhecida: (await lerEstadoDaEntrega(tx))?.referenciaNoProvedor ?? undefined,
    }));

    const apurado = await this.apurarDesfecho(preparo);

    if (apurado === undefined) {
      // O provedor não respondeu. Não há confirmação a alcançar e não há desabilitação a gravar: o
      // estado anterior **permanece**, e é ele que se publica. É a leitura da presença do motivo que
      // o cabeçalho declara, e a alternativa — gravar `habilitada: false` — apagaria, por causa de
      // uma indisponibilidade momentânea, o motivo íntegro que o Admin ainda precisa ler.
      return await abrirUnidade(async (tx) => await this.consultar(tx));
    }

    // A SEGUNDA transação, e só ela grava. `verificadaEm` nasce do relógio do BANCO, dentro da mesma
    // instrução (ADR-0026), e a gravação **substitui** o desfecho anterior (RN-04) por
    // `ON CONFLICT (empresa_id) DO UPDATE` — uma instrução só, e não leitura seguida de escrita.
    const gravado = await abrirUnidade(
      async (tx) =>
        await gravarDesfechoDaEntrega(tx, {
          situacao: apurado.situacao,
          motivo: apurado.motivo,
          referenciaNoProvedor: apurado.referenciaNoProvedor,
          verificadaPor,
        }),
    );

    // A projeção sai do que a gravação **releu**, e nunca do que o adaptador montou em memória.
    return publicar(gravado);
  }

  /**
   * Corre o ciclo junto ao provedor e devolve o que apurar — ou `undefined` quando ele não respondeu.
   *
   * ⚠️ **`empresaId` viaja no ato**, e não na construção do adaptador: é ele que chaveia o cache de
   * credencial, e é ele que impede a credencial de uma empresa de acompanhar a chamada de outra. A
   * decifra acontece **dentro** da expressão que monta o ato, e o claro não ganha nome próprio no
   * escopo: uma variável com o segredo aberto é exatamente o que um registro de diagnóstico futuro
   * acharia à mão, e a ADR-0032 é sobre **não haver o que redigir**.
   */
  private async apurarDesfecho(preparo: PreparoDaAtivacao): Promise<DesfechoApurado | undefined> {
    const entrega = {
      empresaId: preparo.empresaId,
      segredo: decifrarSegredo(preparo.envelopeCifrado, this.ambiente.chaveDeCifraDoCertificado),
      identidade: preparo.identidade,
    };

    // ⚠️ **A CONSULTA VEM PRIMEIRO, e ela é quem decide** — é o quadro de decisão desta rota, e a
    // ordem é conteúdo. Cadastrar antes de olhar produziria uma recusa por vaga ocupada em toda
    // reativação e em toda correção de endereço, e o produto trataria como falha o caso mais comum
    // de todos. Quem já sabe o que há lá não precisa pedir o que já existe.
    const leitura = await this.provedor.consultarEntrega(entrega, preparo.referenciaConhecida);

    switch (leitura.tipo) {
      // ── Linha 7 do quadro, e ela tem DUAS metades ─────────────────────────────────────────────
      //
      // ⚠️ **`motivo` nulo é *"não respondeu"*; `motivo` presente é *"respondeu, e recusou"*.** É a
      // mesma leitura da PRESENÇA que o cadastro sempre fez, e a distinção é operacional: no
      // primeiro caso não há fato do provedor a registrar, e gravar desabilitação apagaria — por
      // uma indisponibilidade momentânea — o motivo íntegro que o Admin ainda precisa ler; no
      // segundo, o provedor disse algo sobre a nossa pergunta, e isso é exatamente o que se grava.
      //
      // Era o `D35`: os dois chegavam iguais à borda, e o produto tinha de escolher um
      // comportamento para ambos.
      case 'NAO_RESPONDEU':
        return leitura.motivo === null
          ? undefined
          : { situacao: 'DESABILITADA', motivo: leitura.motivo, referenciaNoProvedor: null };

      // ── Linha 2 ───────────────────────────────────────────────────────────────────────────────
      // Cadastro nosso, validado e não inativado: a entrega **está de pé**. Nenhum ato, e nenhuma
      // recusa a explicar — o motivo sai nulo em vez de carregar o de uma tentativa anterior.
      case 'ATIVA':
        return { situacao: 'HABILITADA', motivo: null, referenciaNoProvedor: null };

      // ── Linha 3 ───────────────────────────────────────────────────────────────────────────────
      // Cadastro nosso, aguardando a validação do endereço. **Nenhum ato**: ele já está no caminho,
      // e reativar ou recadastrar aqui reiniciaria a janela de validação por nada.
      case 'EM_VALIDACAO':
        return { situacao: 'EM_VALIDACAO', motivo: null, referenciaNoProvedor: null };

      // ── Linha 5, e ela tem PRECEDÊNCIA sobre a 4 ──────────────────────────────────────────────
      // O cadastro é comprovadamente nosso e aponta para o endereço errado. Corrigir a URL leva a
      // situação a *em validação* sozinho — é o que a documentação declara —, e **precede a
      // reativação**: reativar mantendo a URL errada faria o provedor validar o endereço errado,
      // falhar e inativar de novo, num ciclo. Ver o débito da precedência.
      case 'ENDERECO_DIVERGENTE':
        return await this.corrigir(
          leitura.referencia,
          async () => await this.provedor.atualizarEnderecoDaEntrega(entrega, leitura.referencia),
        );

      // ── Linha 4 ───────────────────────────────────────────────────────────────────────────────
      // Cadastro nosso, inativado pelo provedor — o cenário do falso positivo que este trabalho
      // fechou. A operação é a **dedicada**, e não a de correção de endereço.
      case 'INATIVA':
        return await this.corrigir(
          leitura.referencia,
          async () => await this.provedor.reativarEntrega(entrega, leitura.referencia),
        );

      // ── Linhas 1 e 6, e o mesmo ato serve às duas ─────────────────────────────────────────────
      //
      // **Linha 1** — não há cadastro algum: pedir a vaga é o ato, e o desfecho dele é *em
      // validação*, porque o provedor aceita o cadastro e só então valida o endereço. Afirmar
      // *habilitada* aqui seria falso positivo em toda ativação nova.
      //
      // **Linha 6** — a vaga é de **terceiro**, e o produto **não a toca**: nenhuma correção, nenhuma
      // reativação. O que ele faz é o mesmo que faria se a vaga estivesse livre — pedir —, e o
      // provedor responde que ela está ocupada.
      //
      // ⚠️ **Fundir as duas é o que mantém o motivo VERDADEIRO.** A alternativa era o produto
      // gravar um texto próprio dizendo *"a vaga é de outro sistema"*, e isso poria vocabulário do
      // produto no campo que existe para preservar **verbatim o que o provedor disse** (RN-02). Aqui
      // o motivo que o Admin lê é o do provedor, sobre a nossa tentativa — que é exatamente o que
      // ele precisa ler. A chamada a mais é o preço, e ela é o próprio ato de configurar.
      case 'DE_TERCEIRO':
      case 'SEM_CADASTRO': {
        const cadastro = await this.provedor.cadastrarEntrega(entrega);

        if (!cadastro.aceito) {
          // ⚠️ Motivo nulo é *"não respondeu"*, e aí não há desfecho a gravar — o mesmo critério da
          // linha 7. Motivo presente é recusa **respondida**, e essa se grava com a causa.
          return cadastro.motivo === null
            ? undefined
            : { situacao: 'DESABILITADA', motivo: cadastro.motivo, referenciaNoProvedor: null };
        }

        // ⚠️ **A referência é lida da resposta do cadastro, e é a ÚNICA vez que o produto a obtém
        // de um ato de escrita.** É ela que, na tentativa seguinte, prova que a vaga é nossa quando
        // o endereço tiver mudado — sem ela, o cadastro viraria intocável e o Admin ficaria sem
        // saída pela tela.
        return {
          situacao: 'EM_VALIDACAO',
          motivo: null,
          referenciaNoProvedor: cadastro.referencia,
        };
      }
    }
  }

  /**
   * Executa um ato corretivo sobre cadastro **comprovadamente nosso**, e apura o que ele deixou.
   *
   * Os dois atos — corrigir o endereço e reativar — têm o mesmo desfecho por construção: o provedor
   * leva a situação a *aguardando validação* nos dois, e é a reconferência periódica que promove
   * depois. Escrevê-los uma vez é o que impede os dois de divergirem no tratamento da recusa.
   *
   * ⚠️ **A referência é preservada mesmo quando o ato recusa.** Ela é o que prova a propriedade do
   * cadastro, e perdê-la na primeira recusa transformaria um cadastro nosso em intocável — que é o
   * beco sem saída que este trabalho existe para fechar.
   */
  private async corrigir(
    referencia: string,
    ato: () => Promise<ResultadoDaOperacaoDeEntrega>,
  ): Promise<DesfechoApurado | undefined> {
    const desfecho = await ato();

    if (!desfecho.aceito) {
      return desfecho.motivo === null
        ? undefined
        : { situacao: 'DESABILITADA', motivo: desfecho.motivo, referenciaNoProvedor: referencia };
    }

    return { situacao: 'EM_VALIDACAO', motivo: null, referenciaNoProvedor: referencia };
  }

  /**
   * O envelope cifrado do certificado vigente, ou a recusa que diz o que falta.
   *
   * ⚠️ **Sem `campo`**, e a ausência é decisão — é o precedente literal de `exigirCertificadoVigente`
   * em `../cobrancas/boleto.service.ts`: as recusas desta função **não têm culpado no pedido**, o
   * corpo é vazio e não há identificador no caminho. Nomear um campo mandaria o Admin conferir a
   * requisição quando o que falta é configuração da empresa.
   *
   * ⚠️ **E não é `404`.** O `404` desta superfície pertence às rotas em que o certificado **é o
   * recurso pedido**; aqui ele é **pré-condição de um ato**, e o cliente que a recebe não pediu
   * certificado nenhum.
   */
  private async exigirCertificadoVigente(tx: TransactionSql): Promise<string> {
    const vigente = await lerCertificadoVigente(tx);

    if (vigente === undefined) {
      throw new ErroDeAplicacao(CodigoErro.CAMPO_INVALIDO, MENSAGEM_SEM_CERTIFICADO, {
        detalhes: { [DISCRIMINADOR_DO_CERTIFICADO]: CERTIFICADO_AUSENTE },
      });
    }

    // A data corrente vem do BANCO (ADR-0026), e não do relógio deste processo: a vigência é decisão
    // de negócio, e um relógio de processo faria a resposta depender de qual máquina atendeu.
    const observada = await lerVigenciaObservada(tx, vigente.validoAte);

    if (
      derivarEstadoDaVigencia(observada.fimDaValidade, observada.dataCorrente).estado ===
      VIGENCIA_ENCERRADA
    ) {
      throw new ErroDeAplicacao(CodigoErro.CAMPO_INVALIDO, MENSAGEM_DO_CERTIFICADO_VENCIDO, {
        detalhes: { [DISCRIMINADOR_DA_VALIDADE]: vigente.validoAte.toISOString() },
      });
    }

    const envelopeCifrado = await obterEnvelopeCifradoDoVigente(tx);

    if (envelopeCifrado === undefined) {
      // Estado que a `CHECK` da RN-13 torna irrepresentável — vigente sem segredo não existe no
      // banco. A recusa é a **mesma** da ausência, e não um `500`: um erro de servidor aqui diria ao
      // cliente que existe uma linha em estado esquisito, que é informação sobre o dado guardado.
      throw new ErroDeAplicacao(CodigoErro.CAMPO_INVALIDO, MENSAGEM_SEM_CERTIFICADO, {
        detalhes: { [DISCRIMINADOR_DO_CERTIFICADO]: CERTIFICADO_AUSENTE },
      });
    }

    return envelopeCifrado;
  }

  /**
   * A identidade vigente da empresa, **pronta para uso** — ou a recusa que diz o que falta.
   *
   * Espelha {@link exigirCertificadoVigente} porque a pré-condição é da mesma natureza: sem ela o
   * provedor recusa a concessão, e o ato falharia mais adiante com mensagem do provedor em vez da do
   * produto. Recusar aqui é o que faz o Admin saber **qual** configuração falta.
   */
  private async exigirIdentidadeVigente(tx: TransactionSql): Promise<IdentidadeParaUso> {
    const identidade = await lerIdentidadeParaUso(tx, this.ambiente.chaveDeCifraDoCertificado);

    if (identidade === undefined) {
      throw new ErroDeAplicacao(CodigoErro.CAMPO_INVALIDO, MENSAGEM_SEM_IDENTIDADE, {
        detalhes: { [DISCRIMINADOR_DA_IDENTIDADE]: IDENTIDADE_AUSENTE },
      });
    }

    return identidade;
  }
}
