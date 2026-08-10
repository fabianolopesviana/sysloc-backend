/**
 * Cobrança — a regra de aplicação das três primeiras rotas de `/v1/cobrancas`: lançar avulsa, ler a
 * carteira e ler uma cobrança.
 *
 * ---------------------------------------------------------------------------
 * ELE NÃO DERIVA NADA — e a ausência é a decisão central da fatia (ADR-0022, ADR-0023)
 * ---------------------------------------------------------------------------
 *
 * **Não existe neste arquivo uma condicional sobre estado, sobre vencimento ou sobre mora.**
 * `status`, `diasAtraso`, `valorMulta`, `valorJuros` e `valorTotal` chegam **prontos** da visão
 * `negocio.cobranca_derivada`, e este serviço apenas os repassa. A tentação de "só saber se está
 * vencida" — um `dataVencimento < hoje` escrito aqui — é exatamente como o sistema antigo chegou a
 * **três** avaliações divergentes do mesmo estado, a ponto de o envio manual cobrar por uma dívida
 * cancelada (golden `regua-de-cobranca.json`, cenário `cobranca_cancelada_e_vencida`).
 *
 * A rede desta decisão **não é comportamental**, e é preciso saber disso antes de editar: uma segunda
 * derivação escrita aqui coincidiria com a da visão na esmagadora maioria dos casos, e passaria por
 * toda a suíte de rota. O que a impede é a asserção **estática** do `CT-510`
 * (`packages/db/test/fonte-unica-do-estado.spec.ts`), que varre `packages/db/src/**` e
 * `apps/api/src/**` e acusa qualquer literal de `status_cobranca` em posição executável — a única
 * ocorrência legítima é a declaração do enum em `packages/contracts/src/cobranca.ts`. É ela a rede
 * que o marcador `DECISÃO FECHADA` de `packages/db/src/cobranca.ts` exige pelo P4 do Protocolo
 * Antirregressão. **Leia-o antes de escrever qualquer condicional sobre estado.**
 *
 * Consequência prática para quem precisar de um recorte por estado: ele é **predicado SQL sobre a
 * visão**, declarado no esquema da janela e repassado à porta — nunca uma filtragem em memória sobre
 * a página já lida, que além de duplicar a derivação faria a janela deixar de ser janela.
 *
 * ---------------------------------------------------------------------------
 * ELE RECEBE O EXECUTOR, E NÃO ABRE UNIDADE PRÓPRIA (decisão D1)
 * ---------------------------------------------------------------------------
 *
 * Todos os métodos tomam o `tx` de quem já abriu a unidade de trabalho — o controlador. Nenhum deles
 * chama `emUnidadeDeTrabalho`, e é essa ausência que faz o lançamento — a leitura do contrato, a
 * emissão do número e a gravação da linha — ser um **commit só**. É a mesma decisão, com a mesma
 * razão, de {@link ../contratos/contrato.service.js} e de {@link ../imoveis/imovel.service.js}, e é a
 * saída que o próprio marcador `DECISÃO FECHADA` de `packages/db/src/unidade-de-trabalho.ts` aponta
 * como preferível. **A decisão fechada não é tocada.**
 *
 * A ausência de construtor é o mecanismo: o acesso ao banco **não** é injetado aqui, porque injetá-lo
 * daria a este serviço exatamente a capacidade que ele não pode ter.
 *
 * ---------------------------------------------------------------------------
 * ELE ORQUESTRA — não escreve consulta, e não compara empresa
 * ---------------------------------------------------------------------------
 *
 * Toda instrução sobre `negocio.cobranca` e sobre a visão vive em `packages/db/src/cobranca.ts`,
 * publicada como função de domínio. A razão é a enumerabilidade, e está por extenso no cabeçalho
 * daquele arquivo: a contenção da §11.2 é de **tipo** e não alcança texto de SQL, de modo que o que a
 * mantém viva é não haver **onde** escrever a instrução.
 *
 * Não existe, em lugar algum deste arquivo, uma comparação de empresa. A cobrança e o contrato de
 * outra empresa não são achados — a política do banco os esconde, e a visão é `security_invoker` —, e
 * a ausência vira `404 RECURSO_NAO_ENCONTRADO` num ponto único ({@link CobrancaService.exigir}).
 *
 * ---------------------------------------------------------------------------
 * A GARANTIA DA SÉRIE mora aqui, e o controlador só ABRE a unidade dela (ADR-0015)
 * ---------------------------------------------------------------------------
 *
 * {@link CobrancaService.garantirSerie} é a **primeira** das duas unidades sequenciais, e ela é
 * obrigatória **nesta rota**, e não só na ativação: `proximo_numero_de_cobranca` **consome** a
 * sequência, nunca a cria, e a primeira cobrança de uma empresa num ano pode nascer por aqui. Omitir
 * o passo faria a rota falhar exatamente no caso mais banal — empresa nova, primeira cobrança avulsa
 * do ano —, e a falha só apareceria em produção.
 *
 * O ano sai de `lerAnoDaSerieDeCobranca`, e o eixo é conteúdo: ele é o **mesmo**
 * `negocio.data_corrente_da_operacao()` que a visão consulta para classificar a linha. A razão por
 * extenso está no docblock daquela função — e foi o débito **D7 (F3/T4)**, fechado ao ligar esta
 * borda. Reusar aqui `lerAnoDaSerieDeContrato`, que deriva do fuso da **sessão**, poria o código de
 * um ano no contador do outro nas horas em torno da virada.
 *
 * ---------------------------------------------------------------------------
 * O `locatarioId` NÃO é gravado — ele é derivado, e é isso que fecha a incoerência do legado
 * ---------------------------------------------------------------------------
 *
 * {@link DadosDaCobranca} não tem o campo, e a coluna não existe: o locatário publicado sai da junção
 * da visão com o contrato. A tabela do sistema antigo guarda as duas pontas e admite que elas
 * discordem; aqui a incoerência é **estruturalmente impossível**, porque não há segunda ponta a
 * divergir. O que este serviço traduz do cliente é o **código do contrato**, e o UUID interno dele é
 * o que a porta grava.
 *
 * ---------------------------------------------------------------------------
 * A RECUSA POR CONFLITO é traduzida AQUI, num ponto só
 * ---------------------------------------------------------------------------
 *
 * O vocabulário de erro é **fechado** e não tem código de conflito: `STATUS_POR_CODIGO` é
 * `Record<CodigoErro, number>`, de modo que acrescentar valor sem mapear status não compila — e
 * acrescentar código é decisão de contrato com efeito no handoff, não escolha de implementação. A
 * §10.1 da tech spec fixa, por isso, a forma da recusa: `422 CAMPO_INVALIDO` com o campo culpado e o
 * discriminador **`detalhes.conflito`**. É o mesmo desenho, e a mesma razão, de
 * `traduzirConflitoDeGravacao` em {@link ../contratos/contrato.service.js}.
 */

import { Injectable } from '@nestjs/common';
import type { Cobranca, CobrancaNova, EnvelopeDeLista, JanelaDeCobrancas } from '@sysloc/contracts';
import {
  criarCobranca,
  ErroDeCodigoDeCobrancaEmUso,
  emitirNumeroDeCobranca,
  type FiltrosDaCarteira,
  garantirContadorDeCobranca,
  type LinhaDeCobranca,
  lerAnoDaSerieDeCobranca,
  listarCobrancas,
  localizarCobranca,
  localizarContrato,
} from '@sysloc/db';
import { CodigoErro, ErroDeAplicacao } from '@sysloc/shared';
import type { TransactionSql } from 'postgres';
import { MENSAGEM_POR_CODIGO } from '../comum/filtro-excecao.js';

/** A página da carteira, na forma canônica de lista da ADR-0017. */
export type PaginaDeCobrancas = EnvelopeDeLista<Cobranca>;

/**
 * Os campos que a recusa nomeia, como o cliente os conhece (camelCase, ADR-0017).
 *
 * Constantes nomeadas, e não literais no ponto de cada recusa: elas são **contrato publicado** — o
 * cliente as usa para destacar o campo do formulário —, e os casos as afirmam por igualdade de corpo
 * inteiro.
 */
const CAMPO_DO_CONTRATO = 'contratoCodigo';
const CAMPO_DO_CODIGO = 'codigo';

/**
 * O nome do discriminador de circulação dentro de `detalhes`, e o valor que ele carrega.
 *
 * Os dois são **os mesmos** que a superfície de contratos já publica ao recusar um cadastro fora de
 * circulação. Um nome escolhido por conveniência aqui faria o cliente ter de aprender dois
 * vocabulários para a mesma classe de recusa — e as duas recusas descrevem o mesmo fato: o cadastro
 * referenciado saiu de circulação e precisa voltar, ou outro precisa ser apontado.
 */
const DISCRIMINADOR_DA_CIRCULACAO = 'circulacao';
const CADASTRO_RETIRADO = 'RETIRADO_DE_CIRCULACAO';

/**
 * O nome do discriminador de conflito dentro de `detalhes`, e o valor que ele carrega.
 *
 * O nome é o **mesmo** que a colisão de código de contrato já publica (§10.1 usa `detalhes.conflito`
 * para toda colisão desta superfície), e o valor também: quem colide é o **código emitido pela
 * série**, e é a mesma classe de fato nas duas entidades.
 */
const DISCRIMINADOR_DO_CONFLITO = 'conflito';
const CONFLITO_DE_CODIGO = 'CODIGO_EM_USO';

@Injectable()
export class CobrancaService {
  // Sem construtor, e a ausência é o ponto: ver o cabeçalho deste arquivo.

  /**
   * Garante o contador do escopo `(empresa da sessão, ano)` e devolve **o ano lido**.
   *
   * Ela corre numa unidade de trabalho **própria, que commita antes de a segunda abrir**. Fundir as
   * duas devolveria o número `0000001` no desfazimento: a criação da sequência e o `nextval` cairiam
   * na mesma transação, o desfazimento apagaria a sequência recém-criada, e a cobrança seguinte a
   * recriaria e tomaria `nextval = 1` **outra vez** — o número teria sido **reusado**, contra a
   * cláusula literal da ADR-0015. Com as duas unidades, a sequência já está commitada quando o
   * `nextval` corre, e a criação abortada queima o número para sempre, que é o furo que a ADR aceita
   * por escrito e que o `CT-536` mede.
   *
   * **As duas unidades não aninham**: a segunda começa depois de a primeira fechar, e o marcador
   * `DECISÃO FECHADA` de `packages/db/src/unidade-de-trabalho.ts`, que recusa abrir uma segunda
   * unidade **de dentro** de uma aberta, não é tocado.
   *
   * **O ano é lido AQUI e viaja daqui em diante**, uma vez só: o mesmo valor alimenta o contador
   * desta unidade, a emissão do número na seguinte e o código que a porta compõe. Uma segunda leitura
   * permitiria às duas unidades discordarem na virada do ano.
   */
  async garantirSerie(tx: TransactionSql): Promise<number> {
    const ano = await lerAnoDaSerieDeCobranca(tx);

    await garantirContadorDeCobranca(tx, ano);

    return ano;
  }

  /**
   * Lança a cobrança avulsa e devolve o corpo que a rota publica.
   *
   * **O ano chega pronto, e esta função não o relê** — ele foi lido uma única vez pela borda, na
   * primeira unidade de trabalho, e é o mesmo que alimentou `garantirContadorDeCobranca`.
   *
   * A ordem dos três passos é conteúdo: a conferência do contrato vem **antes** da emissão porque é
   * dela que saem o `404` e o `422`, e o número que a emissão consome **não volta** se a gravação
   * abortar (ADR-0015, ADR-0020) — emitir antes de saber se o contrato serve queimaria um número por
   * requisição malformada.
   *
   * O que a porta devolve é lido da **visão**, na mesma unidade que acabou de gravar: a resposta sai
   * com os cinco derivados já calculados pela política vigente, e nada é composto aqui.
   */
  async criar(tx: TransactionSql, entrada: CobrancaNova, ano: number): Promise<Cobranca> {
    const contrato = this.exigirContratoEmCirculacao(
      await localizarContrato(tx, entrada.contratoCodigo),
    );

    const numero = await emitirNumeroDeCobranca(tx, ano);

    return await this.traduzirConflitoDeGravacao(
      async () =>
        await criarCobranca(
          tx,
          {
            contratoId: contrato.id,
            natureza: entrada.natureza,
            referencia: entrada.referencia,
            competencia: entrada.competencia,
            dataVencimento: entrada.dataVencimento,
            valorOriginal: entrada.valorOriginal,
          },
          { ano, numero },
        ),
    );
  }

  /**
   * Lê a página pedida da carteira.
   *
   * O envelope é montado aqui, e a janela devolvida é a que foi **de fato servida** — não um eco do
   * que o cliente pediu. `total` é a contagem na empresa inteira sob o recorte, e é ela que permite ao
   * cliente saber que existe uma página seguinte sem pedi-la (ADR-0017).
   *
   * **Os três filtros atravessam este serviço sem serem interpretados**: o que acontece aqui é a
   * tradução de nome — `contrato`, como a cadeia de consulta o chama, é `contratoCodigo` para a porta
   * —, e quem os transforma em predicado é `predicadoDaCarteira`, do lado do banco. Reimplementar o
   * recorte por estado aqui seria a segunda derivação que o `CT-510` proíbe, e o recorte por natureza
   * em memória faria a janela deixar de ser janela.
   *
   * Cada filtro é espalhado **condicionalmente**, e não atribuído como `undefined`: com
   * `exactOptionalPropertyTypes`, ausente e presente-com-`undefined` são coisas diferentes, e a porta
   * declara os três como opcionais em que ausência quer dizer *sem filtro*.
   */
  async listar(tx: TransactionSql, janela: JanelaDeCobrancas): Promise<PaginaDeCobrancas> {
    const { limite, deslocamento, contrato, status, natureza } = janela;

    const filtros: FiltrosDaCarteira = {
      ...(contrato === undefined ? {} : { contratoCodigo: contrato }),
      ...(status === undefined ? {} : { status }),
      ...(natureza === undefined ? {} : { natureza }),
    };

    const { cobrancas, total } = await listarCobrancas(tx, { limite, deslocamento }, filtros);

    return { itens: [...cobrancas], total, limite, deslocamento };
  }

  /**
   * Lê a cobrança pelo **código** (ADR-0017).
   *
   * Ela alcança a cobrança em qualquer estado, inclusive a paga e a cancelada: não há exclusão lógica
   * nesta entidade (ADR-0014 — a cobrança não tem ato de exclusão a traduzir), e o desfecho é fato
   * gravado, não visibilidade.
   */
  async ler(tx: TransactionSql, codigo: string): Promise<Cobranca> {
    return this.exigir(await localizarCobranca(tx, codigo));
  }

  /**
   * Recusa o contrato que o contexto corrente não alcança, e o que está fora de circulação.
   *
   * As duas metades são de naturezas diferentes, e a distinção é a mesma que
   * `exigirCadastrosAlcancaveisEEmCirculacao` registra em {@link ../contratos/contrato.service.js}:
   *
   *   * **alcance** — é uma **leitura sob a política**, e não uma comparação de `empresa_id` escrita
   *     aqui. Quem impede o vínculo cruzado é a chave estrangeira composta
   *     `cobranca_contrato_empresa_fkey`, que recusaria a linha de qualquer jeito (ADR-0008). O que
   *     esta conferência compra é a **forma** da recusa: sem ela, o contrato de outra empresa
   *     produziria erro de driver — `500` com o erro do banco —, e o `500` diria ao cliente que
   *     aquele código existe em algum lugar. Com ela, contrato alheio e contrato inexistente
   *     respondem o **mesmo** `404`, byte a byte;
   *   * **circulação** — `localizarContrato` alcança o retirado **de propósito**, para que a
   *     recirculação seja possível (ADR-0014). Nada, portanto, recusaria sozinho uma cobrança lançada
   *     sobre um contrato que saiu de circulação, e a conferência é **deliberada e visível**:
   *     `422 CAMPO_INVALIDO` nomeando `contratoCodigo`, com `detalhes.circulacao` dizendo por quê. É
   *     a informação que resolve a situação — recircular o contrato, ou apontar outro.
   */
  private exigirContratoEmCirculacao(
    contrato: { readonly id: string; readonly retiradoEm: Date | null } | undefined,
  ): { readonly id: string } {
    if (contrato === undefined) {
      throw new ErroDeAplicacao(
        CodigoErro.RECURSO_NAO_ENCONTRADO,
        MENSAGEM_POR_CODIGO[CodigoErro.RECURSO_NAO_ENCONTRADO],
      );
    }

    if (contrato.retiradoEm !== null) {
      throw new ErroDeAplicacao(
        CodigoErro.CAMPO_INVALIDO,
        MENSAGEM_POR_CODIGO[CodigoErro.CAMPO_INVALIDO],
        {
          campo: CAMPO_DO_CONTRATO,
          detalhes: { [DISCRIMINADOR_DA_CIRCULACAO]: CADASTRO_RETIRADO },
        },
      );
    }

    return contrato;
  }

  /**
   * Traduz a ausência no `404` canônico — **ponto único** da recusa por cobrança inalcançável.
   *
   * As duas causas da ausência são deliberadamente **indistinguíveis**: a cobrança não existe, ou
   * existe e é de outra empresa. Um corpo diferente para cada uma faria da borda um oráculo de
   * existência sobre o dado alheio, que é justamente o que a política do banco esconde (ADR-0008), e
   * é o invariante que `recusa-indistinguivel.e2e.spec.ts` estabeleceu na F2.
   */
  private exigir(linha: LinhaDeCobranca | undefined): Cobranca {
    if (linha === undefined) {
      throw new ErroDeAplicacao(
        CodigoErro.RECURSO_NAO_ENCONTRADO,
        MENSAGEM_POR_CODIGO[CodigoErro.RECURSO_NAO_ENCONTRADO],
      );
    }

    return linha;
  }

  /**
   * Executa a gravação e traduz a colisão do código no envelope da ADR-0017 — o ponto único dela.
   *
   * A colisão é **possível sem ser culpa do cliente**: a série pode ter sido semeada para trás na
   * virada (F7), ou o contador de um ano pode ter sido alcançado por um código gravado antes dele. O
   * campo nomeado é `codigo` — e não `contratoCodigo` — porque é o código **emitido** que colidiu, e
   * o cliente não o escolheu: o que a resposta lhe diz é que a tentativa não valeu, não que ele tenha
   * algo a corrigir no corpo.
   *
   * Toda outra falha **atravessa intacta**. Traduzir em bloco atribuiria à entrada do cliente uma
   * recusa que ele não causou, escondida atrás de um `422` plausível — que é a pior forma de perder
   * um defeito.
   */
  private async traduzirConflitoDeGravacao(
    gravar: () => Promise<LinhaDeCobranca>,
  ): Promise<LinhaDeCobranca> {
    try {
      return await gravar();
    } catch (erro) {
      if (!(erro instanceof ErroDeCodigoDeCobrancaEmUso)) {
        throw erro;
      }

      throw new ErroDeAplicacao(
        CodigoErro.CAMPO_INVALIDO,
        MENSAGEM_POR_CODIGO[CodigoErro.CAMPO_INVALIDO],
        {
          campo: CAMPO_DO_CODIGO,
          detalhes: { [DISCRIMINADOR_DO_CONFLITO]: CONFLITO_DE_CODIGO },
        },
      );
    }
  }
}
