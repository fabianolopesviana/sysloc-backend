/**
 * A confirmação de endereço de e-mail do locatário — **o caminho único** dos dois gatilhos.
 *
 * ---------------------------------------------------------------------------
 * Por que UM caminho, e não um por gatilho
 * ---------------------------------------------------------------------------
 *
 * A confirmação sai por dois caminhos de negócio: o **automático**, quando o cadastro grava um
 * endereço novo (RN-07), e o **manual**, quando o operador reenvia porque a mensagem não chegou
 * (RN-13). Os dois fazem exatamente o mesmo ao dado — invalidam os portadores vivos, emitem um novo
 * e mandam entregar —, e escrevê-los duas vezes deixaria livres para divergir justamente a
 * invalidação (RN-09) e o prazo. A divergência não faria barulho: apareceria como um link antigo
 * que continua funcionando depois de um reenvio, meses depois.
 *
 * Daí a forma: {@link ConfirmacaoDeEmailService.disparar} é o **único** ponto que compõe os três
 * passos, e {@link ConfirmacaoDeEmailService.reenviar} é o gatilho manual **chamando-o** depois de
 * exigir que o locatário exista.
 *
 * ---------------------------------------------------------------------------
 * ELE RECEBE O EXECUTOR, E NÃO ABRE UNIDADE PRÓPRIA (decisão D1)
 * ---------------------------------------------------------------------------
 *
 * `disparar` toma o `tx` de quem já abriu a unidade de trabalho — o controlador, pela borda única
 * de `comum/contexto-da-sessao.ts`. É isso que faz o cadastro **e** o portador dele serem um commit
 * só: um cadastro gravado sem portador deixaria o locatário sem link e sem nada que o acusasse.
 * Este serviço não tem `AcessoAoBanco` no construtor, e a ausência é o mecanismo.
 *
 * ---------------------------------------------------------------------------
 * O `add` da fila corre DEPOIS do `COMMIT` — e por isso ele não é executado aqui
 * ---------------------------------------------------------------------------
 *
 * Enfileirar dentro da transação abriria a janela oposta e pior: a tarefa nasceria visível ao
 * processador **antes** de o portador existir para quem a fosse consumir, e um desfazimento da
 * unidade deixaria na fila uma entrega para um portador que nunca existiu.
 *
 * Por isso `disparar` devolve {@link ConfirmacaoDisparada}, cujo campo `entregar` é a **continuação
 * a ser acionada depois do `COMMIT`**. Ela é devolvida, e não guardada em estado do serviço, porque
 * o serviço é compartilhado entre requisições concorrentes — estado aqui misturaria disparos de
 * pessoas diferentes.
 *
 * ⚠️ **A perda entre o `COMMIT` e o `add` é possível e é decisão declarada** (§9.2 da tech spec): se
 * o processo morrer entre os dois, o portador existe e a mensagem não sai. A rede de produto é a
 * **RN-13**, o reenvio manual. O *outbox* no banco é tecnicamente superior e foi **rejeitado por
 * YAGNI** nesta versão (tech-alignment D8) — se a F4 trouxer efeito externo que **não** possa se
 * perder, ele entra por cima desta decisão, sem contradizê-la.
 *
 * ---------------------------------------------------------------------------
 * FALHA AO ENFILEIRAR NUNCA DERRUBA A RESPOSTA — a assimetria é o conteúdo
 * ---------------------------------------------------------------------------
 *
 * `entregar` engole a falha do produtor e registra em `warn`. Não é tolerância a erro por
 * conveniência: propagá-la faria o cadastro **já commitado** responder `500` ao cliente, que
 * tentaria de novo e receberia `422` por documento em uso. Trocaríamos uma mensagem perdida — que
 * tem recurso, o reenvio — por um cadastro perdido, que não tem.
 *
 * O que entra no registro é `locatarioId` e `empresaId`. **Nunca o segredo, nunca o derivado, nunca
 * o endereço** (§13.1): o claro é o que abre a confirmação de outra pessoa, e o journal é lido pelo
 * operador da plataforma. A chave `segredo` está na lista de radicais redigidos de
 * `packages/shared/src/log.ts`, e esta é a segunda barreira — não passar o valor adiante.
 */

import { Inject, Injectable } from '@nestjs/common';
import { emitirPortador, invalidarPortadoresDoLocatario, PAPEIS_DE_PESSOA } from '@sysloc/db';
import type { CargaDaConfirmacao, Logger } from '@sysloc/shared';
import type { TransactionSql } from 'postgres';
import { type ProdutorDeFila, TOKEN_PRODUTOR_DE_FILA } from '../comum/produtor-de-fila.js';
import { TOKEN_LOGGER } from '../configuracao/ambiente.js';
import { CadastroDePessoaService } from './cadastro-de-pessoa.service.js';

/**
 * O papel a que a confirmação pertence, tirado da união **fechada** que `@sysloc/db` publica.
 *
 * Indexado, e não redigitado, pela mesma razão de `locatario.controller.ts`: um literal solto
 * compilaria mesmo depois de o papel deixar de existir na porta, e a leitura cairia numa tabela que
 * ninguém mais mantém. A coluna `email_confirmado_em` existe **só** em `negocio.locatario`, e é
 * isso que faz este serviço ser do locatário e de nenhum outro papel.
 */
const PAPEL_DO_TITULAR = PAPEIS_DE_PESSOA[1];

/** De onde o disparo partiu — vai para a linha de trilha, e para lugar nenhum além dela. */
export type OrigemDoDisparo = 'cadastro' | 'reenvio';

/**
 * O que um disparo deixa pronto: os dois instantes que o `202` publica, e a entrega pendente.
 *
 * `reenviadoEm` é quando o portador foi gravado e `expiraEm` é até quando ele resolve — os dois
 * carimbados pelo relógio **do banco** (ADR-0026), e não por este processo.
 */
export interface ConfirmacaoDisparada {
  readonly reenviadoEm: Date;
  readonly expiraEm: Date;
  /**
   * O enfileiramento da entrega, a ser acionado **depois do `COMMIT`** de quem abriu a unidade.
   *
   * Ela **nunca rejeita**: a falha do servidor de fila é registrada e engolida aqui dentro, pela
   * razão do cabeçalho. Quem chama não tem o que tratar, e não deve inventar tratamento.
   */
  readonly entregar: () => Promise<void>;
}

@Injectable()
export class ConfirmacaoDeEmailService {
  constructor(
    // O cadastro entra por injeção, e não por consulta própria, porque a tradução da ausência em
    // `404` é **ponto único** dele (`CadastroDePessoaService.exigir`). Reescrevê-la aqui daria ao
    // reenvio uma segunda forma de recusar o locatário que o contexto não alcança — e as duas
    // ficariam livres para divergir no código e no status, que são contrato publicado.
    @Inject(CadastroDePessoaService) private readonly cadastros: CadastroDePessoaService,
    @Inject(TOKEN_PRODUTOR_DE_FILA) private readonly produtor: ProdutorDeFila,
    @Inject(TOKEN_LOGGER) private readonly logger: Logger,
  ) {}

  /**
   * O caminho **único** dos dois gatilhos: invalida os anteriores, emite o novo e prepara a entrega.
   *
   * Os dois primeiros passos correm na unidade de trabalho de quem chamou; o terceiro é devolvido
   * como continuação — ver o cabeçalho.
   *
   * A ordem **invalidar antes de emitir** é conteúdo, e não estilo: invertida, o portador recém-
   * emitido seria alcançado pelo próprio `UPDATE` de invalidação (o predicado dele é
   * `invalidado_em IS NULL`, e não "os que existiam antes"), e o reenvio nasceria morto.
   *
   * Nada é lido antes de gravar. `invalidarPortadoresDoLocatario` alcança zero linhas no primeiro
   * disparo de um locatário, e conjunto vazio é resultado legítimo — um `SELECT` para saber se há o
   * que invalidar seria uma ida ao banco a mais e uma corrida entre as duas.
   */
  async disparar(
    tx: TransactionSql,
    locatarioId: string,
    empresaId: string,
    origem: OrigemDoDisparo,
  ): Promise<ConfirmacaoDisparada> {
    await invalidarPortadoresDoLocatario(tx, locatarioId);
    const portador = await emitirPortador(tx, locatarioId);

    const carga: CargaDaConfirmacao = {
      empresaId,
      locatarioId,
      segredo: portador.segredo,
    };

    this.logger.info({ empresaId, locatarioId, origem }, 'confirmação de e-mail disparada');

    return {
      reenviadoEm: portador.criadoEm,
      expiraEm: portador.expiraEm,
      entregar: async (): Promise<void> => {
        await this.entregar(carga);
      },
    };
  }

  /**
   * O gatilho **manual** (RN-13): exige que o locatário exista e dispara.
   *
   * A leitura vem antes do disparo por duas razões, e as duas importam: ela é o que faz o reenvio
   * para um locatário inexistente — ou de outra empresa — responder `404` **indistinguível**, e é o
   * que impede a emissão de um portador órfão. Quem não é alcançado pela política do banco não é
   * achado, e a ausência vira `404` no ponto único do cadastro (ADR-0008).
   *
   * Ela **não toca `email_confirmado_em`**: reenviar não desconfirma um endereço já confirmado.
   */
  async reenviar(
    tx: TransactionSql,
    locatarioId: string,
    empresaId: string,
  ): Promise<ConfirmacaoDisparada> {
    const locatario = await this.cadastros.ler(tx, PAPEL_DO_TITULAR, locatarioId);

    return await this.disparar(tx, locatario.id, empresaId, 'reenvio');
  }

  /**
   * Enfileira a entrega — e **absorve** a falha do servidor de fila.
   *
   * Ver o cabeçalho para por que a assimetria é deliberada. O corpo do registro tem os dois
   * identificadores que permitem ao operador reenviar pela interface, e nada mais: a carga inteira
   * **não** entra na linha, porque ela carrega o segredo em claro.
   */
  private async entregar(carga: CargaDaConfirmacao): Promise<void> {
    try {
      await this.produtor.enfileirarConfirmacao(carga);
    } catch (erro) {
      this.logger.warn(
        { erro, empresaId: carga.empresaId, locatarioId: carga.locatarioId },
        'a confirmação de e-mail foi gravada e não pôde ser enfileirada',
      );
    }
  }
}
