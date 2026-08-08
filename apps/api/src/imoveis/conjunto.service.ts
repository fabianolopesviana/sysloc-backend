/**
 * Conjunto — a regra de domínio das seis rotas de `/v1/conjuntos`.
 *
 * ---------------------------------------------------------------------------
 * ELE RECEBE O EXECUTOR, E NÃO ABRE UNIDADE PRÓPRIA (decisão D1)
 * ---------------------------------------------------------------------------
 *
 * Todos os métodos deste serviço tomam o `tx` de quem já abriu a unidade de trabalho — o
 * controlador. Nenhum deles chama `emUnidadeDeTrabalho`, e é essa ausência que torna possível a
 * composição que a fatia precisa mais adiante: um imóvel e os cômodos dele nascem num **commit só**,
 * com o serviço do imóvel e o do cômodo compartilhando a mesma transação. Se cada serviço abrisse a
 * própria unidade, a composição bateria em `ErroDeUnidadeAninhada`, e a saída seria fundir serviços
 * para satisfazer o mecanismo de transação — a topologia às avessas.
 *
 * O docblock daquele erro, em `packages/db/src/unidade-de-trabalho.ts`, nomeia as duas saídas
 * legítimas e declara esta a **preferida** *"enquanto o ramo interno não precisar desfazer sozinho"*.
 * Nenhum ramo desta fatia precisa: a falha em qualquer ponto desfaz a unidade inteira, que é
 * exatamente o comportamento desejado. **A decisão fechada que instala a recusa de aninhamento não é
 * tocada** — esta é a saída que ela própria aponta.
 *
 * ---------------------------------------------------------------------------
 * ELE ORQUESTRA — não escreve consulta, e não compara empresa
 * ---------------------------------------------------------------------------
 *
 * Toda instrução sobre `negocio.conjunto` vive em `packages/db/src/conjunto.ts`, publicada como
 * função de domínio. A razão é a enumerabilidade, e está por extenso no cabeçalho daquele arquivo e
 * no de `apps/api/src/master/empresa.service.ts`: a contenção da §11.2 é de **tipo** e não alcança
 * texto de SQL, de modo que o que a mantém viva é não haver **onde** escrever a instrução.
 *
 * Não existe, em lugar algum deste arquivo, uma comparação de empresa. O conjunto de outra empresa
 * não é achado — a política do banco o esconde —, e a ausência vira `404 RECURSO_NAO_ENCONTRADO` num
 * ponto único ({@link ConjuntoService.exigir}). A recusa é consequência de **não achar**, não de ter
 * comparado (ADR-0008).
 *
 * ---------------------------------------------------------------------------
 * A CONVERSÃO DA MARCA acontece AQUI, num ponto só
 * ---------------------------------------------------------------------------
 *
 * O driver entrega `timestamptz` como `Date`; o contrato publica cadeia ISO-8601 (`esquemaDoConjunto`
 * de `@sysloc/contracts`). A tradução é {@link publicar}, e ela é uma só para as cinco operações:
 * cinco conversões ficariam livres para divergir no formato, e o formato da marca é contrato — o
 * `CT-346` compara o `retiradoEm` da retirada com o da leitura seguinte **caractere a caractere**.
 */

import { Injectable } from '@nestjs/common';
import type {
  Conjunto,
  ConjuntoComImoveis,
  ConjuntoNovo,
  EnvelopeDeLista,
  Janela,
} from '@sysloc/contracts';
import {
  alterarConjunto,
  type ConjuntoComImoveisPersistido,
  type ConjuntoPersistido,
  criarConjunto,
  definirCirculacaoDoConjunto,
  lerCarteira,
  listarConjuntos,
  localizarConjunto,
  type OpcoesDeCirculacao,
} from '@sysloc/db';
import { CodigoErro, ErroDeAplicacao } from '@sysloc/shared';
import type { TransactionSql } from 'postgres';
import { MENSAGEM_POR_CODIGO } from '../comum/filtro-excecao.js';
// A tradução do imóvel persistido no corpo publicado tem **lar único**, e é o serviço do imóvel. Uma
// segunda cópia aqui é o defeito que os débitos D12, D38 e D40 já custaram a esta base: duas
// traduções da mesma forma divergem no primeiro campo novo, e o formato é contrato. O apelido existe
// porque `publicar` já é o nome da tradução do conjunto, logo abaixo.
import { publicar as publicarImovel } from './imovel.service.js';

/** A página de conjuntos, na forma canônica de lista da ADR-0017. */
export type PaginaDeConjuntos = EnvelopeDeLista<Conjunto>;

/** A página da carteira expandida, na mesma forma canônica de lista (ADR-0017). */
export type PaginaDaCarteira = EnvelopeDeLista<ConjuntoComImoveis>;

@Injectable()
export class ConjuntoService {
  // Sem construtor, e a ausência é o ponto: o acesso ao banco **não** é injetado aqui, porque quem
  // abre a unidade de trabalho é o controlador (D1). Injetá-lo daria a este serviço exatamente a
  // capacidade que ele não pode ter — a de abrir a própria unidade.

  /** Cria o conjunto e devolve o corpo que a rota publica. */
  async criar(tx: TransactionSql, entrada: ConjuntoNovo): Promise<Conjunto> {
    return publicar(await criarConjunto(tx, { nome: entrada.nome }));
  }

  /**
   * Lê a página pedida.
   *
   * O envelope é montado aqui, e a janela devolvida é a que foi **de fato servida** — não um eco do
   * que o cliente pediu. `total` é a contagem na empresa inteira, e é ela que permite ao cliente
   * saber que existe uma página seguinte sem pedi-la (ADR-0017).
   *
   * As opções de circulação **atravessam** este serviço sem serem interpretadas: quem decide o que a
   * leitura enxerga é a porta, e reimplementar o predicado aqui é precisamente o que o `CT-348`
   * reprova.
   */
  async listar(
    tx: TransactionSql,
    janela: Janela,
    opcoes: OpcoesDeCirculacao,
  ): Promise<PaginaDeConjuntos> {
    const { conjuntos, total } = await listarConjuntos(tx, janela, opcoes);

    return {
      itens: conjuntos.map(publicar),
      total,
      limite: janela.limite,
      deslocamento: janela.deslocamento,
    };
  }

  /**
   * Lê a página pedida **com os imóveis de cada conjunto** — a carteira de `?expandir=imoveis`.
   *
   * Ela é a mesma listagem de {@link ConjuntoService.listar}, com um nível a mais: mesmo envelope,
   * mesmo `total` da empresa inteira, mesma janela devolvida. O que muda é o item, e a diferença é
   * **a chave `imoveis`** — sem `expandir`, ela não existe no corpo, e não é um arranjo vazio, que
   * diria ao cliente que o conjunto não tem imóvel nenhum.
   *
   * As opções de circulação **atravessam** este serviço sem serem interpretadas, como na listagem
   * simples: quem decide o que cada nível enxerga é a porta, e é ela que propaga a decisão ao imóvel.
   * Reimplementar o predicado aqui — em qualquer dos dois níveis — é o que o `CT-348` reprova.
   */
  async listarCarteira(
    tx: TransactionSql,
    janela: Janela,
    opcoes: OpcoesDeCirculacao,
  ): Promise<PaginaDaCarteira> {
    const { conjuntos, total } = await lerCarteira(tx, janela, opcoes);

    return {
      itens: conjuntos.map(publicarComImoveis),
      total,
      limite: janela.limite,
      deslocamento: janela.deslocamento,
    };
  }

  /**
   * Lê o conjunto por identificador.
   *
   * **Ela alcança o conjunto retirado de circulação**, e responde `200` com a marca preenchida — sem
   * isso a recirculação ficaria inalcançável pela interface, porque a rota que a executa é sobre o
   * mesmo `:id`. O motivo por extenso está no cabeçalho de `packages/db/src/conjunto.ts`.
   */
  async ler(tx: TransactionSql, id: string): Promise<Conjunto> {
    return publicar(this.exigir(await localizarConjunto(tx, id)));
  }

  /** Reescreve o conjunto com o corpo completo (§4.1.1) e devolve como ele ficou. */
  async alterar(tx: TransactionSql, id: string, entrada: ConjuntoNovo): Promise<Conjunto> {
    return publicar(this.exigir(await alterarConjunto(tx, id, { nome: entrada.nome })));
  }

  /**
   * Retira o conjunto de circulação, ou o devolve a ela (ADR-0014).
   *
   * **Nada é apagado**: o que muda é a marca. A idempotência da retirada é da instrução da porta —
   * repetir preserva o instante da primeira —, e não de um ramo escrito aqui: um `if` antes da
   * escrita teria duas idas ao banco e uma corrida entre elas.
   */
  async definirCirculacao(
    tx: TransactionSql,
    id: string,
    emCirculacao: boolean,
  ): Promise<Conjunto> {
    return publicar(this.exigir(await definirCirculacaoDoConjunto(tx, id, emCirculacao)));
  }

  /**
   * Traduz a ausência em `404` — **ponto único** das quatro rotas de `:id`.
   *
   * É aqui, e em nenhum outro lugar, que a fronteira de tenant do conjunto vira resposta. Quatro
   * traduções da mesma ausência ficariam livres para divergir no código e no status, e a forma do
   * erro é contrato: o conjunto de outra empresa responde `404` com o corpo **idêntico** ao do
   * conjunto que não existe, porque a borda não tem como distinguir os dois — e não deve ter.
   */
  private exigir(conjunto: ConjuntoPersistido | undefined): ConjuntoPersistido {
    if (conjunto === undefined) {
      throw new ErroDeAplicacao(
        CodigoErro.RECURSO_NAO_ENCONTRADO,
        MENSAGEM_POR_CODIGO[CodigoErro.RECURSO_NAO_ENCONTRADO],
      );
    }

    return conjunto;
  }
}

/**
 * A linha persistida no corpo que o contrato publica — a **única** tradução das duas formas.
 *
 * `retiradoEm` sai como cadeia ISO-8601 em UTC, que é o que `esquemaDoConjunto` declara
 * (`z.iso.datetime()`); nulo continua nulo, e é ele que diz que o conjunto circula.
 */
function publicar(conjunto: ConjuntoPersistido): Conjunto {
  return {
    id: conjunto.id,
    nome: conjunto.nome,
    retiradoEm: conjunto.retiradoEm === null ? null : conjunto.retiradoEm.toISOString(),
  };
}

/**
 * O item da carteira: o **mesmo** corpo de {@link publicar}, com os imóveis do conjunto.
 *
 * As duas traduções que ele compõe são as canônicas — {@link publicar} para o conjunto e a de
 * `imovel.service.ts` para cada imóvel —, e nenhuma linha de campo é escrita aqui. É isso que faz a
 * árvore ser **profundamente igual** à composição das leituras individuais: se este ponto copiasse
 * campos por conta própria, a carteira viraria um segundo formato do mesmo recurso, e a divergência
 * apareceria no primeiro campo que o imóvel ou o conjunto ganhar — não hoje.
 */
function publicarComImoveis(conjunto: ConjuntoComImoveisPersistido): ConjuntoComImoveis {
  return {
    ...publicar(conjunto),
    imoveis: conjunto.imoveis.map(publicarImovel),
  };
}
