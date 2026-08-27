/**
 * O **carnê** — a reunião, num documento só, dos boletos das cobranças de um contrato num intervalo
 * de competências (US-14 a US-17 da fatia `webhook-e-carne`).
 *
 * ===========================================================================
 * ELE COMPÕE SOBRE `BoletoService.entregar`. NÃO REIMPLEMENTA NADA.
 * ===========================================================================
 *
 * Este arquivo **não conhece** a guarda dos bytes, o adaptador do provedor, o certificado da empresa
 * nem a cifra que o abre. Tudo isso já vive dentro de {@link BoletoService.entregar}, que é o
 * caminho único de *"obter os bytes do boleto desta cobrança"* — leitura de disco no caminho comum,
 * rebusca do provedor no caminho raro —, e o carnê o chama **uma vez por cobrança**.
 *
 * A alternativa idiomática seria ler o diretório da guarda aqui e montar os caminhos em lote: ela
 * abriria um **segundo** caminho para o mesmo fato, e a §7 da `.claude/rules/nao-regressao.md`
 * documenta essa classe de defeito com nome e histórico — o vazamento que sobreviveu a quatro
 * correções, cada uma fechando o caminho apontado enquanto o defeito reaparecia por outro. Aqui o
 * modo de falha seria pior que um vazamento: a rebusca da CA-08 não aconteceria, e o carnê
 * responderia falha onde a rota do boleto avulso responde o documento.
 *
 * ⚠️ **`BoletoService` NÃO é alterado por esta superfície**, e a decisão é registrada (A1 nº 7 do
 * tech-alignment): a tentação óbvia é compartilhar a leitura do certificado entre as rebuscas de um
 * mesmo carnê, e o que ela pouparia é um `SELECT` indexado por rebusca — irrelevante diante da
 * chamada de rede que ele precede, e já coberto pelo cache de credencial do adaptador (300 s, por
 * empresa). Alterá-lo reabriria caminho fechado da fatia anterior sem ganho medido.
 *
 * ===========================================================================
 * O ATO É PARTIDO EM DUAS METADES, e o corte é onde a transação FECHA
 * ===========================================================================
 *
 * {@link CarneService.prepararRecorte} corre **dentro** da unidade de trabalho que o controlador
 * abriu e faz duas leituras e nenhuma escrita: o contrato — de que sai o `404` de recurso
 * inalcançável — e as cobranças do recorte, já filtradas e ordenadas **pelo banco** (ADR-0023). É
 * ela que produz **todas** as recusas que não custam uma ida ao disco.
 *
 * {@link CarneService.compor} corre **fora** de transação alguma, e a repartição é herdada da rota
 * do boleto avulso, cuja `DECISÃO FECHADA — T7 / Gate 2` registra a medição que a motivou:
 * `sobContextoDaSessao` é um `sql.begin` real, e o que corre depois dela é leitura de disco e, no
 * caminho raro, conversa de rede com o provedor — que pode custar dez segundos por boleto. Dentro da
 * unidade, **um** carnê de doze parcelas seguraria uma conexão física da reserva que atende o
 * produto inteiro por mais de dois minutos.
 *
 * ===========================================================================
 * NADA É ARMAZENADO, e a ausência de caminho de escrita é o mecanismo (ADR-0030)
 * ===========================================================================
 *
 * O carnê é *"composto no instante do pedido e nunca armazenado"*: não há aqui gravação, diretório
 * temporário nem cache entre pedidos. É isso que faz o mesmo recorte, pedido duas vezes, devolver o
 * que o cadastro diz **hoje** (CA-17) — e é isso que impede a existência de um artefato desatualizado
 * a expurgar. O que **continua** guardado são os bytes de cada boleto, e a cláusula de exclusão da
 * mesma ADR é quem autoriza: *fato recebido de terceiro não é artefato derivado*.
 *
 * ===========================================================================
 * O carnê NÃO ENGOLE FALHA — os bytes SÃO o desfecho
 * ===========================================================================
 *
 * Nenhuma das duas metades tem `catch` que siga adiante. Provedor indisponível durante a rebusca
 * sobe como `503`; cobrança sem boleto vira `404` **antes** de qualquer byte ser lido. A alternativa
 * — pular a parcela que faltou — responderia `200` com um caderno incompleto, e quem paga só
 * descobriria no mês em que a parcela ausente vencesse. É o *"documento em branco"* que a RN-16
 * proíbe, aplicado à parcela em vez de ao documento.
 *
 * ⚠️ **Nada aqui grava evento na trilha**, e a ausência é a ADR-0034 lida ao pé da letra: rebuscar o
 * cache não é **efeito**, e reunir documentos que já existem, menos ainda. Registrar a montagem de um
 * carnê encheria a trilha que a operação lê para responder *"por que esta cobrança está assim"* com
 * linhas sobre ninguém ter mexido em nada.
 */

import { Inject, Injectable } from '@nestjs/common';
import { localizarContrato, selecionarCobrancasDoRecorte } from '@sysloc/db';
import type { PortaDeMesclagem } from '@sysloc/documentos';
import { CodigoErro, ErroDeAplicacao } from '@sysloc/shared';
import type { RecorteDoCarne } from '@syslocbr/contracts';
import type { TransactionSql } from 'postgres';
import { MENSAGEM_POR_CODIGO } from '../comum/filtro-excecao.js';
import { TOKEN_PORTA_DE_MESCLAGEM } from '../configuracao/ambiente.js';
import {
  type AberturaDeUnidade,
  BoletoService,
  type PreparoDaEntregaDoBoleto,
} from './boleto.service.js';

/** O nome de campo que as recusas desta rota nomeiam — o identificador dela. */
const CAMPO_DO_CODIGO = 'codigo';

/**
 * O discriminador do carnê dentro de `detalhes`, e os dois motivos que ele admite (§4.1.1).
 *
 * Constantes nomeadas porque são **contrato publicado**: o cliente as lê para distinguir *"não há o
 * que reunir neste intervalo"* de *"há, mas uma parcela não tem boleto"* — dois `404` que pedem duas
 * ações completamente diferentes de quem opera. Um `404` genérico, sem `detalhes`, faria as duas
 * situações chegarem ao Financeiro como o mesmo *"não encontrado"*, e a segunda — que se resolve
 * emitindo o boleto que falta — ficaria indistinguível de um erro de digitação no recorte.
 *
 * ⚠️ **O nome da cobrança ausente é o `codigo`**, e nunca o UUID interno: a chave exposta desta
 * entidade é o código legível (ADR-0017), e é com ele que quem recebe a recusa acha a cobrança na
 * carteira.
 */
const DISCRIMINADOR_DO_CARNE = 'carne';
const SEM_COBRANCAS = 'SEM_COBRANCAS';
const BOLETO_AUSENTE = 'BOLETO_AUSENTE';
const DISCRIMINADOR_DA_COBRANCA = 'cobranca';

@Injectable()
export class CarneService {
  constructor(
    // O caminho único dos bytes de um boleto. Ele é **consumido**, e não recriado: ver o cabeçalho
    // para por que um segundo caminho é o defeito que este arquivo existe para não ter.
    @Inject(BoletoService) private readonly boletos: BoletoService,
    // A porta chega **por injeção**, e este arquivo não conhece biblioteca de PDF alguma (ADR-0025):
    // quem escolhe o adaptador é a composição (`cobrancas.module.ts`).
    @Inject(TOKEN_PORTA_DE_MESCLAGEM) private readonly mesclador: PortaDeMesclagem,
  ) {}

  /**
   * Lê o recorte e produz **todas** as recusas que não custam uma ida ao disco.
   *
   * Ela é a última coisa que corre dentro da unidade de trabalho da borda: quem chama fecha a
   * transação com o que ela devolveu, e só então busca os bytes. Nada aqui escreve.
   *
   * As três recusas, e por que são `404` as três:
   *
   *   1. **o contrato não é alcançável** — não existe, ou é de outra empresa e a política o esconde:
   *      o `404` do ponto único ({@link CarneService.naoEncontrado}), **sem `detalhes`**, com corpo
   *      idêntico nas duas causas (ADR-0008). A conferência acontece **antes** da seleção das
   *      cobranças, e a ordem é conteúdo: sem ela, o contrato alheio cairia no recorte vazio e
   *      responderia `SEM_COBRANCAS` — um corpo **distinguível** do de contrato inexistente, que é
   *      exatamente o vazamento de existência que a ADR-0008 fecha;
   *   2. **o recorte não alcança cobrança alguma** (CA-18) — `404` com `SEM_COBRANCAS`, e não um
   *      documento de zero páginas: um PDF vazio é indistinguível, para quem o recebe, de um carnê
   *      que perdeu as parcelas no caminho;
   *   3. **alguma cobrança do recorte não tem boleto** (CA-16) — `404` com `BOLETO_AUSENTE`,
   *      nomeando a **primeira na ordem de vencimento**. A recusa acontece **antes** de compor
   *      qualquer coisa, e por isso nenhum byte é lido em vão.
   *
   * A **primeira** é a primeira porque o arranjo já chega ordenado por vencimento, do banco — e não
   * porque alguém o reordenou aqui. Nomear "qualquer uma" faria a mensagem apontar para uma parcela
   * diferente a cada pedido do mesmo recorte, e quem opera perseguiria alvos móveis.
   */
  async prepararRecorte(
    tx: TransactionSql,
    empresaId: string,
    codigo: string,
    recorte: RecorteDoCarne,
  ): Promise<readonly PreparoDaEntregaDoBoleto[]> {
    const contrato = await localizarContrato(tx, codigo);

    if (contrato === undefined) {
      throw this.naoEncontrado();
    }

    const cobrancas = await selecionarCobrancasDoRecorte(tx, codigo, recorte);

    if (cobrancas.length === 0) {
      throw this.recusaDoCarne({ [DISCRIMINADOR_DO_CARNE]: SEM_COBRANCAS });
    }

    // A recusa mora **dentro** da conversão, e a posição é o que dispensa uma asserção de tipo: o
    // percurso é do arranjo **já ordenado** pelo banco, de modo que a primeira cobrança sem título é
    // a primeira por vencimento; e o estreitamento de `string | null` para `string` sai do próprio
    // ramo, e não de um `??` num caminho que nunca corre. Um passo separado para achar e outro para
    // converter percorreria a mesma lista duas vezes e deixaria o compilador sem como saber que o
    // nulo já foi eliminado.
    return cobrancas.map((cobranca) => {
      const numeroDoTituloVivo = cobranca.numeroDoTituloNoProvedor;

      if (numeroDoTituloVivo === null) {
        throw this.recusaDoCarne({
          [DISCRIMINADOR_DO_CARNE]: BOLETO_AUSENTE,
          [DISCRIMINADOR_DA_COBRANCA]: cobranca.codigo,
        });
      }

      return { empresaId, codigo: cobranca.codigo, numeroDoTituloNoProvedor: numeroDoTituloVivo };
    });
  }

  /**
   * Obtém os bytes de cada boleto e os reúne num documento só — **fora da unidade de trabalho**.
   *
   * O laço é **sequencial de propósito**, e não um `Promise.all`. No caminho comum ele é leitura de
   * disco e a diferença é irrelevante; no caminho raro, cada iteração é uma conversa de rede com o
   * provedor, e paralelizá-las mandaria doze consultas simultâneas em nome da mesma empresa — carga
   * que o produto nunca declarou ao provedor, e que o teto de tempo do adaptador não cobre, porque
   * ele governa cada chamada e não o conjunto. Cada iteração também pode abrir uma unidade própria
   * (a leitura do certificado dentro da rebusca), e doze delas ao mesmo tempo reservariam doze
   * conexões físicas da reserva que atende o produto inteiro.
   *
   * A ordem do arranjo entregue à mesclagem **é** a ordem das páginas do documento, e ela vem de
   * `prepararRecorte`, que a recebeu do banco. A porta não a reordena e não tem como: ela recebe um
   * arranjo de bytes e nada mais (ver `packages/documentos/src/porta-de-mesclagem.ts`).
   *
   * Nenhuma falha é engolida — ver o cabeçalho. `for … of` com `await` dentro, e não `map` com
   * `Promise.all`, também é o que faz a primeira falha **interromper** o laço: com o `Promise.all`,
   * as onze consultas restantes correriam assim mesmo, e o pedido que já está perdido cobraria do
   * provedor o trabalho inteiro antes de responder `503`.
   */
  async compor(
    preparos: readonly PreparoDaEntregaDoBoleto[],
    abrirUnidade: AberturaDeUnidade,
  ): Promise<Uint8Array> {
    const documentos: Uint8Array[] = [];

    for (const preparo of preparos) {
      documentos.push(await this.boletos.entregar(preparo, abrirUnidade));
    }

    return await this.mesclador.mesclar(documentos);
  }

  /**
   * O `404` do contrato inalcançável — **ponto único**, e sem `detalhes`.
   *
   * As duas causas (não existe, ou é de outra empresa) chegam aqui pelo mesmo caminho, porque
   * `localizarContrato` não as distingue: quem esconde a linha alheia é a política do banco, e não
   * uma comparação escrita na aplicação (ADR-0008). O corpo é, portanto, **idêntico** byte a byte nos
   * dois casos — inclusive na ausência de `detalhes`, que é o que impediria a resposta de vazar
   * existência.
   */
  private naoEncontrado(): ErroDeAplicacao {
    return new ErroDeAplicacao(
      CodigoErro.RECURSO_NAO_ENCONTRADO,
      MENSAGEM_POR_CODIGO[CodigoErro.RECURSO_NAO_ENCONTRADO],
      { campo: CAMPO_DO_CODIGO },
    );
  }

  /**
   * O `404` **nomeado** das duas recusas do recorte — a mensagem é a canônica, e o que varia é
   * `detalhes`.
   *
   * A mensagem não é personalizada de propósito: ela chega ao cliente e ao registro, e escrever nela
   * o intervalo pedido ou o código da cobrança repetiria na prosa o que `detalhes` já carrega em
   * campo nomeado — com a diferença de que a prosa não é interpretável por programa. O que
   * discrimina as duas situações é o discriminador, e é ele que o frontend lê.
   */
  private recusaDoCarne(detalhes: Record<string, string>): ErroDeAplicacao {
    return new ErroDeAplicacao(
      CodigoErro.RECURSO_NAO_ENCONTRADO,
      MENSAGEM_POR_CODIGO[CodigoErro.RECURSO_NAO_ENCONTRADO],
      { campo: CAMPO_DO_CODIGO, detalhes },
    );
  }
}
