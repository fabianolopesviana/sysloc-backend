/**
 * Imóvel — a regra de domínio das **sete** rotas de `/v1/imoveis`: as seis do cadastro e a de
 * situação de locação, que a fatia `contratos-de-locacao` acrescenta (T10).
 *
 * ---------------------------------------------------------------------------
 * ELE RECEBE O EXECUTOR, E NÃO ABRE UNIDADE PRÓPRIA (decisão D1)
 * ---------------------------------------------------------------------------
 *
 * Todos os métodos deste serviço tomam o `tx` de quem já abriu a unidade de trabalho — o
 * controlador. Nenhum deles chama `emUnidadeDeTrabalho`, e é essa ausência que torna possível a
 * composição que a T7 traz: o imóvel e os cômodos dele nascem num **commit só**, com o serviço do
 * imóvel e o do cômodo compartilhando a mesma transação. Se cada serviço abrisse a própria unidade,
 * a composição bateria em `ErroDeUnidadeAninhada`, e a saída seria fundir serviços para satisfazer o
 * mecanismo de transação — a topologia às avessas.
 *
 * É a mesma decisão, com a mesma razão, de `conjunto.service.ts`, e é a saída que o próprio marcador
 * `DECISÃO FECHADA` de `packages/db/src/unidade-de-trabalho.ts` aponta como preferível. **A decisão
 * fechada não é tocada.**
 *
 * ---------------------------------------------------------------------------
 * ELE ORQUESTRA — não escreve consulta, e não compara empresa
 * ---------------------------------------------------------------------------
 *
 * Toda instrução sobre `negocio.imovel` vive em `packages/db/src/imovel.ts`, publicada como função
 * de domínio. A razão é a enumerabilidade, e está por extenso no cabeçalho daquele arquivo: a
 * contenção da §11.2 é de **tipo** e não alcança texto de SQL, de modo que o que a mantém viva é não
 * haver **onde** escrever a instrução.
 *
 * Não existe, em lugar algum deste arquivo, uma comparação de empresa. O imóvel de outra empresa não
 * é achado — a política do banco o esconde —, e a ausência vira `404 RECURSO_NAO_ENCONTRADO` num
 * ponto único ({@link ImovelService.exigir}).
 *
 * ---------------------------------------------------------------------------
 * A CONFERÊNCIA DO CONJUNTO DE DESTINO é ALCANCE, não filtro de tenant
 * ---------------------------------------------------------------------------
 *
 * {@link ImovelService.exigirConjuntoAlcancavel} é uma **leitura sob a política** — a mesma
 * `localizarConjunto` que a superfície de conjuntos usa —, e não uma comparação de `empresa_id`
 * escrita aqui. Ela existe por uma razão de **contrato**, e não de segurança: quem impede o vínculo
 * cruzado é a chave estrangeira composta `(conjunto_id, empresa_id)`, que recusaria a linha de
 * qualquer jeito (ADR-0008, §7.2). O que ela compra é a **forma** da recusa: sem ela, o conjunto de
 * outra empresa produziria erro de driver — `500` com o erro do banco —, e o `500` diria ao cliente
 * que aquele identificador existe em algum lugar. Com ela, conjunto alheio e conjunto inexistente
 * respondem o **mesmo** `404`, byte a byte, que é o que o `CT-333` mede.
 *
 * Ela roda na criação **e** na alteração, porque trocar o conjunto pelo `PUT` é operação legítima de
 * cadastro (§5.2) e o destino é o mesmo campo, com a mesma exposição.
 *
 * ---------------------------------------------------------------------------
 * A RECUSA POR UNICIDADE é traduzida AQUI, num ponto só
 * ---------------------------------------------------------------------------
 *
 * O vocabulário de erro é **fechado em sete códigos e não tem código de conflito**:
 * `STATUS_POR_CODIGO` é `Record<CodigoErro, number>`, de modo que acrescentar valor sem mapear
 * status não compila — e acrescentar código é decisão de contrato com efeito no handoff, não escolha
 * de implementação. A §10.1 da tech spec fixa, por isso, a forma da recusa: `422 CAMPO_INVALIDO` com
 * `campo: 'identificadorMunicipal'` e o discriminador **`detalhes.conflito`** ∈
 * `{ EM_CIRCULACAO, RETIRADO_DE_CIRCULACAO }`.
 *
 * O discriminador é o que decide o que o usuário faz em seguida — **reativar** o imóvel retirado que
 * ocupa o identificador, ou **recadastrar** com outro. Sem ele, a recusa por um registro que o
 * usuário nem consegue ver na listagem seria indistinguível de um engano de digitação, e é
 * justamente essa a consequência que a ADR-0014 registra entre os *Cons*.
 *
 * A tradução mora em {@link ImovelService.traduzirConflitoDeIdentificador}, e é **uma**: duas
 * ficariam livres para divergir no código, no campo nomeado e no nome do discriminador — e os três
 * são contrato publicado.
 */

import { Injectable } from '@nestjs/common';
import type {
  EnvelopeDeLista,
  Imovel,
  ImovelAlterado,
  ImovelNovo,
  Janela,
  SituacaoInformavel,
} from '@sysloc/contracts';
import {
  alterarImovel,
  criarImovel,
  definirCirculacaoDoImovel,
  definirSituacaoDeLocacaoDoImovel,
  ErroDeIdentificadorMunicipalEmUso,
  type ImovelPersistido,
  listarImoveis,
  localizarConjunto,
  localizarImovel,
  type OpcoesDeCirculacao,
} from '@sysloc/db';
import { CodigoErro, ErroDeAplicacao } from '@sysloc/shared';
import type { TransactionSql } from 'postgres';
import { MENSAGEM_POR_CODIGO } from '../comum/filtro-excecao.js';

/** A página de imóveis, na forma canônica de lista da ADR-0017. */
export type PaginaDeImoveis = EnvelopeDeLista<Imovel>;

/**
 * O campo culpado da recusa por unicidade, como o cliente o conhece (camelCase, ADR-0017).
 *
 * Constante nomeada, e não literal no ponto da recusa: ele é **contrato publicado** — o cliente o
 * usa para destacar o campo do formulário —, e o `CT-310` o afirma por igualdade de corpo inteiro.
 */
const CAMPO_DO_IDENTIFICADOR_MUNICIPAL = 'identificadorMunicipal';

/**
 * O nome do discriminador do conflito dentro de `detalhes`.
 *
 * Fixado pela §10.1 da tech spec **antes** da implementação, e não escolhido aqui: o `CT-312` (T9)
 * compara os corpos de recusa das duas entidades com documento único, e um nome escolhido por
 * conveniência em cada uma faria a comparação reprovar por divergência de forma.
 */
const DISCRIMINADOR_DO_CONFLITO = 'conflito';

/**
 * O campo que a recusa da rota de situação de locação nomeia — o único que o corpo dela carrega.
 *
 * Constante nomeada, e não literal no ponto da recusa: ele é **contrato publicado**, e o `CT-434` o
 * afirma por igualdade de corpo inteiro.
 */
const CAMPO_DA_SITUACAO_DE_LOCACAO = 'statusLocacao';

/**
 * O valor de `detalhes.conflito` quando o imóvel já tem contrato vigente.
 *
 * O nome do discriminador e o valor são os **mesmos** que `contratos/contrato.service.ts` publica ao
 * recusar a segunda ativação sobre o mesmo imóvel: a §10.1 da tech spec fixa `detalhes.conflito` para
 * toda colisão desta superfície, e um segundo vocabulário faria o cliente ter de aprender duas formas
 * para a mesma classe de recusa. O literal é escrito aqui, e não importado daquele módulo, porque a
 * constante de lá é privada dele — o que **não** pode divergir é o texto, e é ele que o `CT-434`
 * afirma por igualdade de corpo inteiro dos dois lados.
 */
const CONFLITO_DE_VIGENCIA = 'IMOVEL_COM_CONTRATO_VIGENTE';

@Injectable()
export class ImovelService {
  // Sem construtor, e a ausência é o ponto: o acesso ao banco **não** é injetado aqui, porque quem
  // abre a unidade de trabalho é o controlador (D1). Injetá-lo daria a este serviço exatamente a
  // capacidade que ele não pode ter — a de abrir a própria unidade.

  /**
   * Cria o imóvel e devolve o corpo que a rota publica.
   *
   * A conferência do conjunto de destino vem **antes** da gravação porque é ela que produz o `404`;
   * a unicidade do identificador municipal vem **do banco**, na própria gravação, e nunca de uma
   * leitura anterior a ela — ver o cabeçalho de `packages/db/src/imovel.ts`.
   */
  async criar(tx: TransactionSql, entrada: ImovelNovo): Promise<Imovel> {
    await this.exigirConjuntoAlcancavel(tx, entrada.conjuntoId);

    return publicar(
      await this.traduzirConflitoDeIdentificador(async () => await criarImovel(tx, entrada)),
    );
  }

  /**
   * Lê a página pedida.
   *
   * O envelope é montado aqui, e a janela devolvida é a que foi **de fato servida** — não um eco do
   * que o cliente pediu. `total` é a contagem na empresa inteira, e é ela que permite ao cliente
   * saber que existe uma página seguinte sem pedi-la (ADR-0017).
   *
   * As opções de circulação **atravessam** este serviço sem serem interpretadas: quem decide o que a
   * leitura enxerga é a porta, e reimplementar o predicado aqui é precisamente o que a T5 fixou como
   * defeito (o `CT-348` o reprova na entidade irmã, chamando a porta diretamente).
   */
  async listar(
    tx: TransactionSql,
    janela: Janela,
    opcoes: OpcoesDeCirculacao,
  ): Promise<PaginaDeImoveis> {
    const { imoveis, total } = await listarImoveis(tx, janela, opcoes);

    return {
      itens: imoveis.map(publicar),
      total,
      limite: janela.limite,
      deslocamento: janela.deslocamento,
    };
  }

  /**
   * Lê o imóvel por identificador.
   *
   * **Ela alcança o imóvel retirado de circulação**, e responde `200` com a marca preenchida — sem
   * isso a recirculação ficaria inalcançável pela interface, porque a rota que a executa é sobre o
   * mesmo `:id`.
   */
  async ler(tx: TransactionSql, id: string): Promise<Imovel> {
    return publicar(this.exigir(await localizarImovel(tx, id)));
  }

  /**
   * Reescreve o imóvel com o corpo completo (§4.1.1) e devolve como ele ficou.
   *
   * O conjunto de destino passa pela **mesma** conferência da criação: `conjuntoId` é campo como
   * outro qualquer, e mudar o imóvel de conjunto é operação legítima de cadastro. Um `PUT` que
   * apontasse conjunto alheio sem a conferência responderia `500` em vez de `404`.
   *
   * **A entrada é {@link ImovelAlterado}, e não `ImovelNovo`**: a situação de locação não entra em
   * corpo de atualização, e a porta de dados sequer a recebe. Ver o marcador `DECISÃO FECHADA` de
   * `esquemaDeImovelAlterado`, em `packages/contracts/src/imovel.ts`.
   */
  async alterar(tx: TransactionSql, id: string, entrada: ImovelAlterado): Promise<Imovel> {
    await this.exigirConjuntoAlcancavel(tx, entrada.conjuntoId);

    return publicar(
      this.exigir(
        await this.traduzirConflitoDeIdentificador(
          async () => await alterarImovel(tx, id, entrada),
        ),
      ),
    );
  }

  /**
   * Retira o imóvel de circulação, ou o devolve a ela (ADR-0014).
   *
   * **Nada é apagado**: o que muda é a marca. A idempotência da retirada é da instrução da porta —
   * repetir preserva o instante da primeira —, e não de um ramo escrito aqui: um `if` antes da
   * escrita teria duas idas ao banco e uma corrida entre elas.
   */
  async definirCirculacao(tx: TransactionSql, id: string, emCirculacao: boolean): Promise<Imovel> {
    return publicar(this.exigir(await definirCirculacaoDoImovel(tx, id, emCirculacao)));
  }

  /**
   * Informa a situação de locação do imóvel — o **único** caminho por onde uma requisição a escreve.
   *
   * ---------------------------------------------------------------------------
   * ELA RECUSA O IMÓVEL COM CONTRATO VIGENTE, e a recusa é o ponto da rota
   * ---------------------------------------------------------------------------
   *
   * `LOCADO` é sustentado por um contrato `ATIVO`, e alternar o imóvel para `DISPONIVEL` ou
   * `INDISPONIVEL` por baixo dele reabriria, por outra porta, exatamente o furo que tirar o campo do
   * `PUT` fechou: a resposta traria a situação informada **ao lado** de `contratoVigente`
   * preenchido. Por isso a recusa é por **haver contrato vigente**, e não por valor informado — as
   * duas situações informáveis divergiriam do contrato do mesmo jeito.
   *
   * A conferência lê `contratoVigente` do próprio agregado que {@link localizarImovel} devolve — o
   * campo que a leitura em lote `lerContratosVigentesDeImoveis` preenche num ponto único. Não há aqui
   * uma segunda leitura de contrato por imóvel: uma consulta própria seria a segunda fonte do mesmo
   * fato, livre para discordar do campo que a mesma rota publica na resposta.
   *
   * ---------------------------------------------------------------------------
   * ELA É LEITURA-ANTES-DE-GRAVAR, e a assimetria com a ativação é deliberada
   * ---------------------------------------------------------------------------
   *
   * Nada no banco pareia `contrato.status` com `imovel.status_locacao` — é o que o docblock de
   * `definirSituacaoDeLocacaoDoImovel` já registra —, de modo que esta guarda é da aplicação, com a
   * janela de corrida que toda leitura-antes-de-gravar tem: uma ativação concorrente que commitasse
   * entre a leitura e a escrita deixaria o imóvel na situação informada.
   *
   * **Esta janela NÃO é a mesma da guarda de estado do contrato**, e a diferença é justamente a que
   * decide se sobra trabalho a fazer. Lá o índice parcial `contrato_imovel_vigente_uidx` fecha a
   * janela **no banco**: a segunda ativação concorrente do mesmo imóvel colide com o índice e vira
   * `422`, aconteça o que acontecer com a leitura. **Aqui não existe restrição alguma pareando as
   * duas colunas** — é o que o próprio `REVERTER EXIGE` do marcador de `esquemaDeImovelAlterado`
   * reconhece —, e a janela permanece aberta até que ela exista. A saída definitiva é essa
   * restrição; inventá-la aqui seria decisão de esquema fora do alcance desta rota. Ver o marcador
   * de débito no ponto da guarda.
   *
   * **O sentido inverso não é recusado**: locar um imóvel `INDISPONIVEL` passa. `INDISPONIVEL`
   * significa *"não ofereça nas buscas"*, e não *"proibido de locar"* — recusá-lo inventaria uma
   * regra que nenhuma RN declara, enquanto a recusa daqui protege um invariante que existe.
   *
   * A releitura depois da escrita é o que faz a resposta ser **o que o banco guarda**, e não um
   * objeto montado a partir do que a requisição pediu: as duas idas correm na mesma unidade de
   * trabalho, e a segunda enxerga o que a primeira gravou.
   */
  async definirSituacaoDeLocacao(
    tx: TransactionSql,
    id: string,
    situacao: SituacaoInformavel,
  ): Promise<Imovel> {
    const atual = this.exigir(await localizarImovel(tx, id));

    // DÉBITO COM GATILHO — D44 · F2/T10 · registrado 2026-08-09
    // O QUÊ: esta guarda é leitura-antes-de-gravar e a janela entre as duas NÃO é fechada por nada
    //        no banco — uma ativação que commite no meio deixa `contrato.status='ATIVO'` ao lado de
    //        uma `imovel.status_locacao` divergente, o par que o CT-434 declara irrepresentável.
    // QUANDO FECHA: a fatia que introduzir no banco a restrição que pareia `contrato.status='ATIVO'`
    //        com `imovel.status_locacao`. Nascida ela, a guarda daqui vira tradução do erro do
    //        banco, e não a única defesa.
    // POR QUE NÃO AGORA: a restrição é decisão de esquema, e esta rota não tem mandato para tomá-la;
    //        antes da T10 o furo era DETERMINÍSTICO (todo `PUT` apagava o `LOCADO`), e o que a T10
    //        fez foi estreitá-lo para uma janela concorrente e declará-la.
    // ÍNDICE: docs/specs/features/contratos-de-locacao/v1/_run/run-report.md §2, D44
    if (atual.contratoVigente !== null) {
      throw new ErroDeAplicacao(
        CodigoErro.CAMPO_INVALIDO,
        MENSAGEM_POR_CODIGO[CodigoErro.CAMPO_INVALIDO],
        {
          campo: CAMPO_DA_SITUACAO_DE_LOCACAO,
          detalhes: { [DISCRIMINADOR_DO_CONFLITO]: CONFLITO_DE_VIGENCIA },
        },
      );
    }

    await definirSituacaoDeLocacaoDoImovel(tx, atual.id, situacao);

    return publicar(this.exigir(await localizarImovel(tx, atual.id)));
  }

  /**
   * Recusa com `404` o conjunto que o contexto corrente não alcança — **ponto único** das duas
   * escritas que o referenciam.
   *
   * A ausência tem duas causas deliberadamente **indistinguíveis**: o conjunto não existe, ou existe
   * em outra empresa e a política o esconde. As duas produzem o mesmo corpo, e é isso que impede a
   * borda de virar um oráculo de existência sobre o cadastro alheio.
   *
   * Ela **não** consulta a marca de circulação do conjunto: um conjunto retirado continua sendo um
   * agrupamento legítimo para um imóvel, e recusar aqui inventaria uma regra que nenhuma RN declara.
   */
  private async exigirConjuntoAlcancavel(tx: TransactionSql, conjuntoId: string): Promise<void> {
    if ((await localizarConjunto(tx, conjuntoId)) === undefined) {
      throw new ErroDeAplicacao(
        CodigoErro.RECURSO_NAO_ENCONTRADO,
        MENSAGEM_POR_CODIGO[CodigoErro.RECURSO_NAO_ENCONTRADO],
      );
    }
  }

  /**
   * Traduz a recusa da restrição de unicidade no envelope da ADR-0017 — **ponto único** das duas
   * escritas que podem colidir.
   *
   * O código é `CAMPO_INVALIDO` porque o vocabulário é fechado e **não tem código de conflito**; o
   * `422` sai do próprio código, e não é escolhido aqui. O que discrimina o conflito é
   * `detalhes.conflito`, e ele vem do estado lido pela porta **depois** da recusa do banco.
   *
   * Nada do valor recusado entra no corpo nem na mensagem: a recusa de um cliente não autenticado
   * pelo dado que ele enviou é exatamente o vetor que a §13.1 fecha.
   */
  private async traduzirConflitoDeIdentificador<T>(gravar: () => Promise<T>): Promise<T> {
    try {
      return await gravar();
    } catch (erro) {
      if (!(erro instanceof ErroDeIdentificadorMunicipalEmUso)) {
        throw erro;
      }

      throw new ErroDeAplicacao(
        CodigoErro.CAMPO_INVALIDO,
        MENSAGEM_POR_CODIGO[CodigoErro.CAMPO_INVALIDO],
        {
          campo: CAMPO_DO_IDENTIFICADOR_MUNICIPAL,
          detalhes: { [DISCRIMINADOR_DO_CONFLITO]: erro.conflito },
          causa: erro,
        },
      );
    }
  }

  /**
   * Traduz a ausência em `404` — **ponto único** das quatro rotas de `:id`.
   *
   * É aqui, e em nenhum outro lugar, que a fronteira de tenant do imóvel vira resposta. Quatro
   * traduções da mesma ausência ficariam livres para divergir no código e no status, e a forma do
   * erro é contrato: o imóvel de outra empresa responde `404` com o corpo **idêntico** ao do imóvel
   * que não existe, porque a borda não tem como distinguir os dois — e não deve ter.
   */
  private exigir(imovel: ImovelPersistido | undefined): ImovelPersistido {
    if (imovel === undefined) {
      throw new ErroDeAplicacao(
        CodigoErro.RECURSO_NAO_ENCONTRADO,
        MENSAGEM_POR_CODIGO[CodigoErro.RECURSO_NAO_ENCONTRADO],
      );
    }

    return imovel;
  }
}

/**
 * A linha persistida no corpo que o contrato publica — a **única** tradução das duas formas.
 *
 * `retiradoEm` sai como cadeia ISO-8601 em UTC, que é o que `esquemaDoImovel` declara
 * (`z.iso.datetime()`); nulo continua nulo, e é ele que diz que o imóvel circula. Os demais campos
 * são copiados um a um, e não por espalhamento: o espalhamento publicaria qualquer coluna que a
 * projeção da porta venha a ganhar — inclusive `empresa_id`, que é justamente o que não pode sair.
 *
 * **Ela é exportada desde a T10**, e a razão é a mesma que já produziu os débitos D12, D38 e D40
 * nesta base: a carteira expandida (`conjunto.service.ts`) publica imóveis inteiros, e a segunda
 * tradução da mesma forma nasceria lá se não houvesse de onde importar. As duas divergiriam no
 * primeiro campo que o imóvel ganhar — e o que diverge primeiro neste molde é justamente o formato
 * de `retiradoEm` e a lista de campos copiados, isto é, o corpo que o cliente vê. Quem importa a
 * chama de `publicarImovel`, porque o nome curto só é inequívoco dentro deste módulo.
 */
export function publicar(imovel: ImovelPersistido): Imovel {
  return {
    id: imovel.id,
    conjuntoId: imovel.conjuntoId,
    nomeImovel: imovel.nomeImovel,
    identificadorMunicipal: imovel.identificadorMunicipal,
    tipoImovel: imovel.tipoImovel,
    logradouro: imovel.logradouro,
    numero: imovel.numero,
    complemento: imovel.complemento,
    bairro: imovel.bairro,
    cidade: imovel.cidade,
    estado: imovel.estado,
    cep: imovel.cep,
    statusLocacao: imovel.statusLocacao,
    observacoes: imovel.observacoes,
    comodos: [...imovel.comodos],
    metragemTotal: imovel.metragemTotal,
    // O objeto vem da porta já na forma que o contrato publica — `ContratoVigenteDoImovel` é o tipo
    // de `@sysloc/contracts`, e não uma projeção própria da camada de dados —, de modo que não há
    // tradução a fazer aqui. Copiar o campo é o que mantém esta função **enumerando** o corpo
    // publicado: um espalhamento traria junto qualquer coluna que a projeção da porta venha a ganhar.
    contratoVigente: imovel.contratoVigente,
    retiradoEm: imovel.retiradoEm === null ? null : imovel.retiradoEm.toISOString(),
  };
}
