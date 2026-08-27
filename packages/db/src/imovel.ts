/**
 * Imóvel — a entidade central do cadastro, e a **porta única** de leitura e escrita dela.
 *
 * ---------------------------------------------------------------------------
 * POR QUE ESTAS OPERAÇÕES MORAM AQUI, E NÃO NO SERVIÇO QUE AS CHAMA
 * ---------------------------------------------------------------------------
 *
 * Pela razão que {@link ./conjunto.ts}, {@link ./pessoa.ts} e {@link ./empresa.ts} já registram: a
 * contenção da §11.2 é de **tipo** e não alcança **texto de SQL**. Um serviço de aplicação com o
 * executor da unidade de trabalho em mãos escreve `negocio.imovel` numa cadeia sem importar nada de
 * proibido, e o alcance às tabelas do domínio deixa de ser enumerável. Toda instrução que o ciclo de
 * vida do imóvel precisa vive aqui, publicada como função de domínio.
 *
 * A pergunta que o índice do pacote força, e a resposta: **isto é um caminho para dado fora da
 * unidade de trabalho? NÃO.** As sete funções **recebem** o executor (`tx`) de quem já abriu a
 * unidade; nenhuma abre conexão, reserva ou transação, e nenhuma devolve executor. A sexta é
 * {@link lerImoveisDeConjuntos}, da T10, que **não** sai pelo índice do pacote — ela é a leitura por
 * nível que `./conjunto.ts` compõe, e o docblock dela registra por quê. A sétima é
 * {@link definirSituacaoDeLocacaoDoImovel}, da fatia de contratos, e o docblock dela registra por que
 * ela é **estreita** em vez de um alargamento de {@link alterarImovel}.
 *
 * ---------------------------------------------------------------------------
 * A UNICIDADE É DO BANCO — e a leitura só acontece DEPOIS da recusa
 * ---------------------------------------------------------------------------
 *
 * O mecanismo que impede dois imóveis com o mesmo identificador municipal na mesma empresa é a
 * restrição `unique(empresa_id, identificador_municipal)`, e **nada mais**. Não há, em lugar algum
 * deste arquivo, uma leitura que decida se pode gravar: leitura-antes-de-gravar é *janela de
 * corrida disfarçada de validação* — entre o `SELECT` que não achou nada e o `INSERT` que grava,
 * outra transação grava o mesmo valor, e as duas passam. É o risco que o tech_spec §20 registra com
 * impacto alto, e a §5.2 fixa o desenho: *"a leitura prévia NÃO é o mecanismo de unicidade — é o
 * banco; a leitura só enriquece a mensagem depois da recusa"*.
 *
 * A leitura que este arquivo faz é, portanto, **posterior** — {@link lerConflitoDoIdentificador}
 * corre depois de o banco ter recusado, e serve para uma coisa só: dizer ao usuário **se o registro
 * em conflito está em circulação ou retirado**, que é o que decide entre reativar e recadastrar. Se
 * ela devolvesse o valor errado, ninguém gravaria linha alguma a mais; se o `INSERT` fosse
 * dispensado, dois imóveis nasceriam com o mesmo identificador.
 *
 * ---------------------------------------------------------------------------
 * O SAVEPOINT existe porque a transação ABORTA na violação — leia antes de removê-lo
 * ---------------------------------------------------------------------------
 *
 * No PostgreSQL, um erro dentro de uma transação a coloca em estado abortado: **qualquer** instrução
 * seguinte falha com `25P02` até um `ROLLBACK`. Sem o savepoint, a leitura de enriquecimento acima
 * seria impossível — a unidade de trabalho já teria sido perdida pela própria recusa que se quer
 * descrever, e a alternativa seria abrir uma **segunda** unidade depois, o que a decisão D1 (unidade
 * aberta na borda) e o `ErroDeUnidadeAninhada` recusam.
 *
 * `tx.savepoint` reusa a transação corrente — é exatamente o mecanismo que o `REVERTER EXIGE` do
 * marcador `DECISÃO FECHADA` de {@link ./unidade-de-trabalho.ts} nomeia como o aninhamento
 * **correto**. Ele **não** contraria aquele marcador: o que a marca recusa é abrir uma segunda
 * unidade (outra conexão, outra transação, com `COMMIT` próprio), e aqui não se abre nenhuma.
 *
 * ---------------------------------------------------------------------------
 * O PREDICADO DE CIRCULAÇÃO É DA PORTA — o mesmo molde da T5
 * ---------------------------------------------------------------------------
 *
 * A ADR-0014 nomeia, entre os próprios *Cons*, o defeito que ela cria: *"toda consulta de listagem e
 * todo seletor passa a carregar o predicado de circulação; esquecê-lo é um defeito silencioso"*.
 * Um defeito **silencioso** não se fecha pedindo lembrança a quem escreve a próxima listagem: ele se
 * fecha invertendo o default. {@link listarImoveis} aplica o predicado **por padrão**, e alcançar os
 * retirados exige o parâmetro nomeado `incluirRetirados`. Quem esquece obtém a listagem correta;
 * quem quer os retirados diz por escrito, e a decisão aparece no diff.
 *
 * {@link localizarImovel} **não** tem predicado, e a assimetria é deliberada — a recirculação é uma
 * rota sobre `:id`, e uma leitura que escondesse o retirado tornaria a volta dele inalcançável pela
 * interface. O motivo por extenso está no cabeçalho de {@link ./conjunto.ts}, e vale igual aqui.
 *
 * ---------------------------------------------------------------------------
 * O ESCOPO DE TENANT VEM DO BANCO (ADR-0008)
 * ---------------------------------------------------------------------------
 *
 * **Nenhuma função deste arquivo recebe `empresaId` por parâmetro, e nenhuma compara empresa com
 * coisa alguma escrita na aplicação.** `negocio.imovel` nasce com RLS **forçada**: a política decide
 * o que cada leitura enxerga e o que cada escrita pode gravar. Não há aqui um `WHERE empresa_id = …`
 * — a defesa em profundidade que a `Decision` da ADR-0008 rejeita por escrito.
 *
 * A escrita é a única que precisa **propor** um valor para a coluna, porque `empresa_id` é
 * `NOT NULL` e não tem padrão. Ela o obtém de {@link empresaDoContexto}, que é a expressão literal
 * das políticas de `migracoes/0006_seguranca_dominio.sql`, avaliada dentro da própria instrução.
 *
 * E é por isso que o vínculo com o conjunto de **outra** empresa é impossível sem que nada aqui o
 * confira: a chave estrangeira composta `(conjunto_id, empresa_id) → conjunto (id, empresa_id)`
 * recusa o par que não existe. A conferência de alcance que a borda faz — em
 * `apps/api/src/imoveis/imovel.service.ts` — não é filtro de aplicação nem substitui a chave: ela é
 * uma **leitura sob a política**, e existe para que a recusa chegue ao cliente como
 * `404 RECURSO_NAO_ENCONTRADO`, indistinguível de conjunto inexistente, em vez de como erro de
 * driver.
 */

import type {
  Comodo,
  ContratoVigenteDoImovel,
  SituacaoDeLocacao,
  SituacaoInformavel,
  TipoDeImovel,
} from '@syslocbr/contracts';
import type { Fragment, TransactionSql } from 'postgres';
// A leitura de `negocio.comodo` mora no módulo dono daquela tabela, e não aqui: é lá que vive toda
// instrução sobre ela, pela mesma razão de enumerabilidade que este cabeçalho registra. O que este
// arquivo faz é **compor** — e a composição é o ponto único do agregado (ver {@link montarImovel}).
import { lerComodosDeImoveis } from './comodo.js';
// O tipo é da **decisão**, e não da entidade: `{ incluirRetirados }` é o parâmetro nomeado que a
// ADR-0014 obriga toda porta de leitura a expor, e ele já nasceu publicado pelo pacote. Declarar um
// gêmeo aqui daria dois nomes ao mesmo parâmetro na superfície pública — e a próxima entidade daria
// um terceiro. O que se importa é o tipo, não comportamento: `conjunto.ts` não é tocado.
import type { OpcoesDeCirculacao } from './conjunto.js';
// O fragmento da empresa do contexto tem **lar único** em `./contexto-de-escrita.ts` (débito D7,
// fechado na T7). Ele **não é filtro** sobre `negocio.imovel` — nenhuma leitura deste arquivo o
// aplica, porque a tabela já tem política e um segundo caminho para o mesmo recorte é o que a
// ADR-0008 rejeita. Ele existe para a **escrita**, onde `empresa_id` é `NOT NULL` sem padrão.
import { empresaDoContexto } from './contexto-de-escrita.js';
// E o mesmo vale para `negocio.contrato`: a leitura do contrato vigente mora no módulo dono daquela
// tabela. A direção é `imovel.ts → contrato.ts`, e **não há ciclo** — `contrato.ts` não lê imóvel (a
// conferência de alcance do imóvel é da borda), e o que ele importa de `conjunto.ts` é só um tipo.
import { lerContratosVigentesDeImoveis } from './contrato.js';

/** A janela pedida da listagem, já validada na borda. */
export interface JanelaDeImoveis {
  readonly limite: number;
  readonly deslocamento: number;
}

/**
 * O padrão da porta: **só o que circula**.
 *
 * Ele é o valor omitido de {@link listarImoveis}, e é o que faz o esquecimento produzir a listagem
 * correta em vez do defeito silencioso da ADR-0014. Congelado porque é constante compartilhada entre
 * todas as chamadas que não declaram nada.
 */
const SO_EM_CIRCULACAO: OpcoesDeCirculacao = Object.freeze({ incluirRetirados: false });

/**
 * Os campos que o cliente informa ao **criar** um imóvel (§4.1.1). A alteração usa
 * {@link DadosDaAlteracaoDoImovel}, que é este menos a situação de locação.
 *
 * `statusLocacao` é {@link SituacaoInformavel}, e **não** {@link SituacaoDeLocacao}: `LOCADO` é
 * produzido pela ativação de contrato, que é fatia seguinte, e não pode entrar por aqui. A restrição
 * já existe no esquema de entrada de `@syslocbr/contracts` (RN-10); repeti-la **no tipo desta porta**
 * é o que torna impossível um caminho futuro atravessar a borda com o valor recusado — a
 * consequência que a RN-10 compra para a fatia de contratos é o invariante *"`LOCADO` implica
 * contrato ativo"* já válido.
 */
export interface DadosDoImovel {
  readonly conjuntoId: string;
  readonly nomeImovel: string;
  readonly identificadorMunicipal: string;
  readonly tipoImovel: TipoDeImovel;
  readonly logradouro: string;
  readonly numero: string;
  readonly complemento: string | null;
  readonly bairro: string;
  readonly cidade: string;
  readonly estado: string;
  readonly cep: string;
  readonly statusLocacao: SituacaoInformavel;
  readonly observacoes: string | null;
}

/**
 * Os campos que o cliente informa ao **alterar** um imóvel — os da criação **menos** a situação de
 * locação (T10).
 *
 * Derivado por `Omit`, e não redigitado: uma segunda lista de doze campos seria a segunda fonte do
 * mesmo fato, e as duas divergiriam no primeiro campo que o cadastro ganhasse. É o espelho, nesta
 * camada, do `omit` que produz `esquemaDeImovelAlterado` em `@syslocbr/contracts`.
 *
 * **A ausência de `statusLocacao` no tipo é o mecanismo**, e não uma conferência escrita em
 * {@link alterarImovel}: o campo não chega, então não há o que ignorar nem o que decidir ignorar.
 */
export type DadosDaAlteracaoDoImovel = Omit<DadosDoImovel, 'statusLocacao'>;

/** Uma linha de `negocio.imovel`, na projeção que o contrato publica. */
export interface ImovelPersistido {
  readonly id: string;
  readonly conjuntoId: string;
  readonly nomeImovel: string;
  readonly identificadorMunicipal: string;
  readonly tipoImovel: TipoDeImovel;
  readonly logradouro: string;
  readonly numero: string;
  readonly complemento: string | null;
  readonly bairro: string;
  readonly cidade: string;
  readonly estado: string;
  readonly cep: string;
  /** O enum **completo** na saída — a fatia de contratos produz `LOCADO`, e a leitura o devolve. */
  readonly statusLocacao: SituacaoDeLocacao;
  readonly observacoes: string | null;
  /** Os cômodos do imóvel, ordenados por posição. Ver {@link montarImovel}. */
  readonly comodos: readonly Comodo[];
  /** A soma das metragens dos cômodos (RN-02). Ver {@link montarImovel}. */
  readonly metragemTotal: number;
  /**
   * O contrato `ATIVO` que ocupa o imóvel, com o locatário dele — nulo quando não há nenhum.
   *
   * Derivado como a metragem, e pelo mesmo ponto único. Ver {@link montarImovel}.
   */
  readonly contratoVigente: ContratoVigenteDoImovel | null;
  /** A marca da exclusão lógica (ADR-0014): nula enquanto circula, o instante da retirada depois. */
  readonly retiradoEm: Date | null;
}

/** O que a consulta de fato lê da tabela — os três agregados derivados não são coluna. */
type LinhaDoImovel = Omit<ImovelPersistido, 'comodos' | 'metragemTotal' | 'contratoVigente'>;

/** A página lida, com o total do conjunto inteiro — os dois da MESMA transação. */
export interface PaginaDeImoveisPersistidos {
  readonly imoveis: readonly ImovelPersistido[];
  readonly total: number;
}

/** Em que estado está o imóvel que já ocupa o identificador municipal recusado. */
export type ConflitoDeIdentificador = 'EM_CIRCULACAO' | 'RETIRADO_DE_CIRCULACAO';

/**
 * O identificador municipal já pertence a outro imóvel **desta empresa**.
 *
 * É erro de **domínio**, e não de transporte: esta camada não conhece HTTP nem código de erro de
 * API. Quem o traduz no envelope da ADR-0017 — `422 CAMPO_INVALIDO` com `campo` e
 * `detalhes.conflito` — é `apps/api/src/imoveis/imovel.service.ts`, num ponto único.
 *
 * **A mensagem não carrega o valor recusado**, e a omissão é a decisão: a §13.1 da tech spec proíbe
 * que o identificador em disputa entre na mensagem de erro, porque ela chega ao registro estruturado
 * e a recusa é a resposta de um cliente que ainda não provou nada. O que o usuário precisa saber —
 * qual campo, e se o conflito está em circulação — viaja em campo nomeado.
 */
export class ErroDeIdentificadorMunicipalEmUso extends Error {
  override readonly name: string = 'ErroDeIdentificadorMunicipalEmUso';

  /** Se o imóvel que ocupa o identificador circula ou foi retirado — é ele que discrimina a recusa. */
  readonly conflito: ConflitoDeIdentificador;

  constructor(conflito: ConflitoDeIdentificador) {
    super('o identificador municipal já pertence a outro imóvel desta empresa');
    this.conflito = conflito;
  }
}

/**
 * O nome da restrição que impõe a unicidade, como o servidor a reporta.
 *
 * Ele é o **discriminante**: `negocio.imovel` tem duas restrições únicas, e a outra
 * (`imovel_id_empresa_key`) é o alvo da chave estrangeira composta dos cômodos. Traduzir toda
 * violação `23505` como conflito de identificador municipal atribuiria à entrada do cliente uma
 * colisão que ele não causou — e, pior, a esconderia atrás de um `422` plausível.
 */
const RESTRICAO_DO_IDENTIFICADOR_MUNICIPAL = 'imovel_empresa_identificador_municipal_key';

/** `unique_violation` — o `SQLSTATE` que o servidor devolve ao recusar a restrição acima. */
const VIOLACAO_DE_UNICIDADE = '23505';

/**
 * A projeção publicada, escrita **uma vez** e reusada pelas seis funções que leem a tabela.
 *
 * É um **fragmento** do driver, e não uma cadeia interpolada: ele é montado pelo mesmo mecanismo da
 * consulta que o hospeda, e nada aqui vem de fora — é constante deste módulo, sem interpolação
 * alguma. Mesmo padrão, e mesma justificativa, de `colunasDoConjunto` em {@link ./conjunto.ts}.
 *
 * Os apelidos existem porque as colunas são `snake_case` e o contrato fala camelCase (ADR-0017):
 * traduzir aqui, num ponto só, é o que impede cinco traduções livres para divergir.
 */
function colunasDoImovel(tx: TransactionSql): Fragment {
  return tx`
    id,
    conjunto_id AS "conjuntoId",
    nome_imovel AS "nomeImovel",
    identificador_municipal AS "identificadorMunicipal",
    tipo_imovel AS "tipoImovel",
    logradouro,
    numero,
    complemento,
    bairro,
    cidade,
    estado,
    cep,
    status_locacao AS "statusLocacao",
    observacoes,
    retirado_em AS "retiradoEm"
  `;
}

/**
 * O predicado de circulação — **o ponto único** onde "retirado some da lista" vira instrução.
 *
 * Um fragmento, e não uma comparação com parâmetro (`${incluir} OR retirado_em IS NULL`), por duas
 * razões: o índice `imovel_empresa_retirado_idx` cobre o par `(empresa_id, retirado_em)` que a forma
 * abaixo consulta, e a disjunção com parâmetro esconderia do planejador o que a consulta de fato
 * pede. E ele é **um só** para a página e para o total: duas escritas do mesmo recorte fariam a
 * contagem descrever um conjunto do qual a página já não faz parte.
 */
function predicadoDeCirculacao(tx: TransactionSql, opcoes: OpcoesDeCirculacao): Fragment {
  return opcoes.incluirRetirados ? tx`TRUE` : tx`retirado_em IS NULL`;
}

/**
 * O agregado derivado do imóvel — **o ponto único**. Ele nasceu na T7 e cresceu na T9.
 *
 * O contrato publica `comodos`, `metragemTotal` e `contratoVigente` (`esquemaDoImovel`), e os três são
 * **derivados**: a metragem total não é coluna de tabela nenhuma (decisão D2 do tech_spec), os cômodos
 * são um `SELECT` próprio ordenado por posição, e o contrato vigente é a leitura em lote de
 * `lerContratosVigentesDeImoveis`. O agregado é montado aqui, e não no serviço ou no controlador,
 * porque a derivação tem de ter um ponto único de avaliação: se a leitura do item, a listagem e a
 * porta de circulação derivassem por conta própria, a divergência voltaria pela porta de trás e
 * nenhuma delas estaria errada isoladamente — é exatamente o que o `CT-307` mede, comparando os três
 * caminhos.
 *
 * **Esta função é o único lugar do repositório que produz `metragemTotal` e `contratoVigente`.** As
 * portas de leitura e escrita deste arquivo passam por {@link comAgregado} ou
 * {@link comAgregadoEmLote}, e as duas terminam aqui.
 *
 * **O compilador NÃO segura essa propriedade, e é importante não acreditar que ele segura.**
 * `ImovelPersistido` exige a **presença** dos campos derivados, não a **procedência** deles: uma porta
 * nova que devolvesse `{ ...linha, comodos, metragemTotal: 0, contratoVigente: null }`, ou que
 * derivasse por conta própria, compila sem uma reclamação sequer. Quem obriga a preenchê-los **por
 * este ponto** é o `CT-307`, que compara os três produtores existentes entre si e reprova no par que
 * discorda — e foi ele, e não o tipo, que matou o mutante MT7-1; e é o `CT-329`, pela rota, que
 * compara a carteira com a composição das leituras individuais. A porta que nascer aqui entra naqueles
 * casos; **não os trate como redundantes com a verificação estática, porque ela não existe.**
 */
function montarImovel(
  linha: LinhaDoImovel,
  comodos: readonly Comodo[],
  contratoVigente: ContratoVigenteDoImovel | null,
): ImovelPersistido {
  return { ...linha, comodos, metragemTotal: somarMetragem(comodos), contratoVigente };
}

/**
 * A soma das metragens dos cômodos (RN-02) — **a única soma escrita neste repositório**.
 *
 * Publicada pelo índice do pacote porque é ela que o agregado da §6.2 nomeia, e porque tê-la com
 * nome é o que torna verificável a afirmação *"a soma tem um ponto único"*: uma segunda soma
 * apareceria como uma segunda função, e não como uma linha a mais dentro de uma consulta.
 *
 * ---------------------------------------------------------------------------
 * ELA SOMA EM CENTÉSIMOS, e isso não é preciosismo
 * ---------------------------------------------------------------------------
 *
 * `metragem` é `numeric(10,2)`: todo valor tem, no máximo, duas casas. Somar os números de ponto
 * flutuante diretamente produz resíduo binário em combinações perfeitamente legítimas — `10.06`
 * somado a `10.07` dá `20.130000000000003`, e `18.21 + 12.13 + 9.07` dá `39.410000000000004` —, e
 * esse resíduo viajaria no JSON como `metragemTotal`, num campo que o cliente exibe. Os quatro
 * cenários do golden (`0`, `25.5`, `67.75`, `58.5`) são todos exatos em binário e **não** pegariam o
 * defeito: ele apareceria em produção, no primeiro imóvel com metragens de centésimo ímpar. Quem o
 * pega é o `CT-305 (b)`, que afirma os dois pares acima **e mede a soma direta deles** — sem essa
 * segunda metade o caso poderia estar construído sobre valores que a soma ingênua acerta, que é o
 * que acontece com `0.29 + 0.07` (exato em binário, ao contrário do que parece).
 *
 * Somar os centésimos como inteiros e dividir uma vez no fim mantém a soma exata dentro do domínio
 * que a coluna admite. O `Math.round` fecha o outro lado: o número que chega já veio de um
 * `numeric(10,2)` convertido, então multiplicá-lo por cem pode render `2549.9999999999995` — e é o
 * arredondamento, e não um truncamento, que devolve o centésimo que a coluna guardava.
 *
 * A soma de nenhum cômodo é `0` — que é a RN-02 aplicada ao conjunto vazio, e é o cenário
 * `sem_comodo` do golden.
 */
export function somarMetragem(comodos: readonly Comodo[]): number {
  const centesimos = comodos.reduce(
    (total, comodo) => total + Math.round(comodo.metragem * CENTESIMOS_POR_UNIDADE),
    0,
  );

  return centesimos / CENTESIMOS_POR_UNIDADE;
}

/** A escala de `numeric(10,2)` expressa como inteiro — ver {@link somarMetragem}. */
const CENTESIMOS_POR_UNIDADE = 100;

/** O agregado de um imóvel sem cômodo algum. Congelado — é compartilhado por toda leitura. */
const SEM_COMODOS: readonly Comodo[] = Object.freeze([]);

/**
 * O imóvel que **nenhum** contrato vigente ocupa.
 *
 * Constante nomeada, e não um `null` solto no ponto da composição: ela é o resultado verdadeiro da
 * leitura em lote — o imóvel sem vigente não aparece no mapa —, e nomeá-la é o que distingue *"não há
 * contrato vigente"* de *"o campo ainda não foi preenchido"*.
 */
const SEM_CONTRATO_VIGENTE = null;

/**
 * Monta o agregado de **um** imóvel. `undefined` atravessa intacto — é a ausência da porta.
 *
 * Ela e {@link comAgregadoEmLote} compartilham as **mesmas** duas leituras — cômodos e contrato
 * vigente — e o **mesmo** montador, e é por isso que existem duas em vez de uma: a diferença entre
 * elas é o número de imóveis, e uma listagem que chamasse esta em laço faria duas consultas por linha
 * da página.
 */
async function comAgregado(
  tx: TransactionSql,
  linha: LinhaDoImovel | undefined,
): Promise<ImovelPersistido | undefined> {
  if (linha === undefined) {
    return undefined;
  }

  const comodosPorImovel = await lerComodosDeImoveis(tx, [linha.id]);
  const contratoPorImovel = await lerContratosVigentesDeImoveis(tx, [linha.id]);

  return montarImovel(
    linha,
    comodosPorImovel.get(linha.id) ?? SEM_COMODOS,
    contratoPorImovel.get(linha.id) ?? SEM_CONTRATO_VIGENTE,
  );
}

/**
 * Monta o agregado de uma página inteira com **uma** consulta de cômodos e **uma** de contrato
 * vigente, qualquer que seja o tamanho dela.
 *
 * O imóvel sem cômodo nenhum — e o que não tem contrato vigente — não aparece no mapa respectivo: a
 * consulta devolve linha só para quem tem. `SEM_COMODOS` e `SEM_CONTRATO_VIGENTE` são o resultado
 * verdadeiro dela, não um padrão que substitui a leitura.
 */
async function comAgregadoEmLote(
  tx: TransactionSql,
  linhas: readonly LinhaDoImovel[],
): Promise<ImovelPersistido[]> {
  const identificadores = linhas.map((linha) => linha.id);

  const comodosPorImovel = await lerComodosDeImoveis(tx, identificadores);
  const contratoPorImovel = await lerContratosVigentesDeImoveis(tx, identificadores);

  return linhas.map((linha) =>
    montarImovel(
      linha,
      comodosPorImovel.get(linha.id) ?? SEM_COMODOS,
      contratoPorImovel.get(linha.id) ?? SEM_CONTRATO_VIGENTE,
    ),
  );
}

/**
 * Grava um imóvel e devolve a linha como ela ficou.
 *
 * O imóvel nasce **em circulação** — `retirado_em` é nulo por ausência de valor, e não por um valor
 * escrito aqui: a coluna é anulável e o estado inicial é o da tabela, não o desta função.
 *
 * A recusa por identificador municipal repetido vem do **banco**, e chega ao chamador como
 * {@link ErroDeIdentificadorMunicipalEmUso} já discriminado. Ver
 * {@link gravarSobRestricaoDeUnicidade} e o cabeçalho deste arquivo.
 */
export async function criarImovel(
  tx: TransactionSql,
  dados: DadosDoImovel,
): Promise<ImovelPersistido> {
  const imovel = await gravarSobRestricaoDeUnicidade(
    tx,
    dados.identificadorMunicipal,
    async (escrita) => {
      const [linha] = await escrita<LinhaDoImovel[]>`
        INSERT INTO negocio.imovel (
          empresa_id, conjunto_id, nome_imovel, identificador_municipal, tipo_imovel,
          logradouro, numero, complemento, bairro, cidade, estado, cep,
          status_locacao, observacoes
        )
        VALUES (
          ${empresaDoContexto(escrita)}, ${dados.conjuntoId}, ${dados.nomeImovel},
          ${dados.identificadorMunicipal}, ${dados.tipoImovel},
          ${dados.logradouro}, ${dados.numero}, ${dados.complemento}, ${dados.bairro},
          ${dados.cidade}, ${dados.estado}, ${dados.cep},
          ${dados.statusLocacao}, ${dados.observacoes}
        )
        RETURNING ${colunasDoImovel(escrita)}
      `;

      return linha;
    },
  );

  if (imovel === undefined) {
    // Inalcançável por entrada de cliente: o `INSERT … RETURNING` de uma linha ou devolve a linha ou
    // levanta. O ramo existe porque o tipo do driver admite o arranjo vazio, e um `as` no lugar dele
    // trocaria uma falha nomeada por um `undefined` viajando como se fosse um imóvel.
    throw new Error('o imóvel foi gravado e a linha não voltou do INSERT');
  }

  // O imóvel nasce sem cômodo algum, e o agregado é lido do mesmo jeito que em toda outra porta: a
  // consulta é que devolve o vazio, e não um literal escrito aqui. Ler é o que faz a composição da
  // §7.4 — imóvel e cômodos num commit só — enxergar o que a MESMA unidade já gravou.
  const agregado = await comAgregado(tx, imovel);

  if (agregado === undefined) {
    // Inalcançável: `comAgregado` só devolve `undefined` quando a linha recebida é `undefined`, e o
    // ramo acima já a excluiu. O ramo existe porque o tipo o admite, e um `as` no lugar dele
    // trocaria uma falha nomeada por um `undefined` viajando como se fosse um imóvel.
    throw new Error('o imóvel foi gravado e o agregado de cômodos não o devolveu');
  }

  return agregado;
}

/**
 * Lê uma página de imóveis e o total do conjunto inteiro, na **mesma transação**.
 *
 * Lidos separadamente, o total poderia descrever um conjunto do qual a página já não faz parte, e o
 * cliente pagina sobre dois retratos — mesma razão de `listarConjuntos`, em {@link ./conjunto.ts}.
 *
 * A ordem é `nome_imovel, id`, e o desempate importa: o nome sozinho empata entre homônimos — dois
 * "Ap 101" em prédios diferentes são o caso comum, não a exceção —, e um empate faz a mesma linha
 * aparecer em duas páginas, ou em nenhuma.
 *
 * **O predicado de circulação é aplicado por padrão**, e o `opcoes` omitido é o caminho correto.
 */
export async function listarImoveis(
  tx: TransactionSql,
  janela: JanelaDeImoveis,
  opcoes: OpcoesDeCirculacao = SO_EM_CIRCULACAO,
): Promise<PaginaDeImoveisPersistidos> {
  const linhas = await tx<LinhaDoImovel[]>`
    SELECT ${colunasDoImovel(tx)}
      FROM negocio.imovel
     WHERE ${predicadoDeCirculacao(tx, opcoes)}
     ORDER BY nome_imovel, id
     LIMIT ${janela.limite}
    OFFSET ${janela.deslocamento}
  `;

  const [contagem] = await tx<{ total: string }[]>`
    SELECT count(*) AS total
      FROM negocio.imovel
     WHERE ${predicadoDeCirculacao(tx, opcoes)}
  `;

  // `count(*)` volta como `bigint`, que o driver entrega em cadeia de caracteres. A conversão
  // explícita é o que impede o total de viajar como texto no JSON.
  return {
    imoveis: await comAgregadoEmLote(tx, linhas),
    total: Number(contagem?.total ?? 0),
  };
}

/**
 * Lê os imóveis de N conjuntos, já agregados, agrupados pelo conjunto de cada um — **a leitura por
 * NÍVEL da carteira** (T10, tech spec §12.2).
 *
 * ---------------------------------------------------------------------------
 * Ela recebe A LISTA de conjuntos, e é isso que a distingue de um laço sobre {@link listarImoveis}
 * ---------------------------------------------------------------------------
 *
 * A carteira é a listagem de conjuntos expandida, e montá-la com uma consulta **por conjunto** é o
 * padrão N+1 que a §12.2 nomeia com todas as letras: *"a carteira expandida deve ser montada com um
 * número de consultas independente do número de conjuntos"*. Recebendo a lista, esta função emite
 * **uma** consulta de imóveis para a página inteira, e {@link comAgregadoEmLote} emite **uma** de
 * cômodos para todos os imóveis dela — quatro idas ao banco na carteira inteira, qualquer que seja o
 * número de conjuntos e de imóveis. É a mesma decisão, e a mesma forma, de `lerComodosDeImoveis` em
 * {@link ./comodo.ts}, um nível abaixo.
 *
 * A prova de que a contagem não depende de N é do `CT-329 (d)`, em `packages/db/test/janela.spec.ts`:
 * ele conta as invocações do executor sobre dois cenários de tamanhos diferentes e afirma que o
 * número é o **mesmo**. A corretude do resultado é do `CT-329`, pela rota — e nenhum dos dois
 * substitui o outro, porque uma implementação N+1 devolve a árvore certa.
 *
 * ---------------------------------------------------------------------------
 * O agregado passa pelo MESMO ponto único de soma
 * ---------------------------------------------------------------------------
 *
 * Ela termina em {@link comAgregadoEmLote}, como {@link listarImoveis} — e não numa soma escrita
 * aqui. O docblock de {@link montarImovel} declara que a porta que nascer depois dele entra no caso
 * que compara os produtores entre si, **e que o compilador não segura essa propriedade**: um retorno
 * que somasse por conta própria compilaria sem uma reclamação sequer. Quem a segura é o `CT-329`,
 * que compara a árvore com a composição das leituras individuais por igualdade profunda.
 *
 * ---------------------------------------------------------------------------
 * O predicado de circulação PROPAGA ao nível filho, e não é opcional
 * ---------------------------------------------------------------------------
 *
 * `opcoes` é parâmetro **obrigatório** aqui, ao contrário de {@link listarImoveis}, e a assimetria é
 * a decisão: esta função nunca é chamada por quem não acabou de decidir a circulação do nível pai.
 * A ADR-0014 exige que nenhum retirado apareça em nível algum da árvore, e um padrão silencioso faria
 * o pai e o filho se separarem — a carteira com `incluirRetirados=true` traria o conjunto retirado
 * com os imóveis dele filtrados. O eixo é do `CT-329`, e só ele o alcança: o `CT-315` lista por
 * entidade e não enxerga um imóvel retirado dentro de conjunto ativo.
 *
 * A lista vazia devolve o mapa vazio **sem consultar**, pela razão de `lerComodosDeImoveis`: pagar
 * uma ida ao banco para saber que `= ANY('{}')` não casa nada é custo sem informação.
 *
 * Não há `WHERE empresa_id` aqui, e não pode haver: a política de `negocio.imovel` já recorta a
 * leitura, e um segundo caminho para o mesmo recorte é o que a ADR-0008 rejeita.
 */
export async function lerImoveisDeConjuntos(
  tx: TransactionSql,
  conjuntosIds: readonly string[],
  opcoes: OpcoesDeCirculacao,
): Promise<Map<string, readonly ImovelPersistido[]>> {
  const porConjunto = new Map<string, ImovelPersistido[]>();

  if (conjuntosIds.length === 0) {
    return porConjunto;
  }

  const linhas = await tx<LinhaDoImovel[]>`
    SELECT ${colunasDoImovel(tx)}
      FROM negocio.imovel
     WHERE conjunto_id = ANY(${[...conjuntosIds]}::uuid[])
       AND ${predicadoDeCirculacao(tx, opcoes)}
     ORDER BY conjunto_id, nome_imovel, id
  `;

  // A ordem dentro de cada conjunto é `nome_imovel, id` — **a mesma** de {@link listarImoveis}, e o
  // desempate importa pela mesma razão: dois "Ap 101" em prédios diferentes são o caso comum. É essa
  // coincidência que faz a árvore ser profundamente igual à composição das leituras individuais.
  for (const imovel of await comAgregadoEmLote(tx, linhas)) {
    const doConjunto = porConjunto.get(imovel.conjuntoId) ?? [];
    doConjunto.push(imovel);
    porConjunto.set(imovel.conjuntoId, doConjunto);
  }

  return porConjunto;
}

/**
 * Localiza o imóvel pelo identificador. `undefined` quando o contexto corrente não o alcança.
 *
 * As duas causas da ausência são deliberadamente **indistinguíveis**: o imóvel não existe, ou existe
 * e é de outra empresa. A borda traduz as duas no mesmo `404 RECURSO_NAO_ENCONTRADO` — a recusa é
 * consequência de não achar, e não de uma comparação de empresa escrita na aplicação (ADR-0008).
 *
 * **Ela alcança o retirado de circulação**, e o cabeçalho deste arquivo registra por quê.
 */
export async function localizarImovel(
  tx: TransactionSql,
  id: string,
): Promise<ImovelPersistido | undefined> {
  const [linha] = await tx<LinhaDoImovel[]>`
    SELECT ${colunasDoImovel(tx)}
      FROM negocio.imovel
     WHERE id = ${id}
  `;

  return await comAgregado(tx, linha);
}

/**
 * Reescreve os campos informados do imóvel e devolve a linha nova. `undefined` quando não alcançado.
 *
 * O corpo é **completo** (§4.1.1): não há atualização parcial nesta superfície, e campo ausente é
 * recusa por campo obrigatório na borda — nunca "preserve o que estava lá".
 *
 * **`conjunto_id` é campo como outro qualquer**, e trocá-lo pelo `PUT` é operação legítima de
 * cadastro (§5.2): corrigir o agrupamento não tem efeito colateral que justifique um sub-recurso
 * próprio. O destino passa pela mesma conferência de alcance da criação, na borda, e pela mesma
 * chave estrangeira composta, no banco.
 *
 * A alteração **não** consulta o predicado de circulação, pela mesma razão de
 * {@link localizarImovel}: quem tem o identificador em mãos alcança o registro, e a marca viaja no
 * corpo. Ela também **não** toca `retirado_em` — a circulação tem porta própria, e reuni-las faria
 * uma correção de endereço carregar, por descuido, uma mudança de estado.
 *
 * ---------------------------------------------------------------------------
 * E ela NÃO toca `status_locacao`, pela MESMA razão — a segunda coluna de estado (T10)
 * ---------------------------------------------------------------------------
 *
 * O argumento do parágrafo acima não envelheceu; ele apenas não tinha sido aplicado à segunda coluna
 * de estado. Enquanto esta instrução escrevia `status_locacao` incondicionalmente, e a entrada não
 * aceitava `LOCADO`, **toda** alteração de um imóvel locado — inclusive corrigir o endereço —
 * apagava o `LOCADO` em silêncio, e a resposta trazia `statusLocacao: 'DISPONIVEL'` ao lado de
 * `contratoVigente` preenchido, com o contrato ainda `ATIVO`.
 *
 * A situação de locação tem **duas** portas próprias, e nenhuma delas é esta:
 * {@link definirSituacaoDeLocacaoDoImovel}, que a ativação, o cancelamento e a rota
 * `POST /v1/imoveis/:id/situacao-de-locacao` usam. **Não devolva a coluna a esta instrução "por
 * simetria com os outros campos"** — ver o marcador `DECISÃO FECHADA` de `esquemaDeImovelAlterado`,
 * em `packages/contracts/src/imovel.ts`, que governa esta ausência também.
 *
 * O tipo do parâmetro é {@link DadosDaAlteracaoDoImovel}, e é ele que torna a escrita
 * irrepresentável: o campo não chega até aqui.
 *
 * A recusa por identificador municipal repetido vem do banco também aqui: o `PUT` que aponte para um
 * identificador já ocupado é a **mesma** colisão da criação, e responde a mesma coisa. Um caminho
 * que só tratasse a criação deixaria a alteração devolver erro de driver ao cliente.
 */
export async function alterarImovel(
  tx: TransactionSql,
  id: string,
  dados: DadosDaAlteracaoDoImovel,
): Promise<ImovelPersistido | undefined> {
  const linha = await gravarSobRestricaoDeUnicidade(
    tx,
    dados.identificadorMunicipal,
    async (escrita) => {
      const [alterada] = await escrita<LinhaDoImovel[]>`
        UPDATE negocio.imovel
           SET conjunto_id = ${dados.conjuntoId},
               nome_imovel = ${dados.nomeImovel},
               identificador_municipal = ${dados.identificadorMunicipal},
               tipo_imovel = ${dados.tipoImovel},
               logradouro = ${dados.logradouro},
               numero = ${dados.numero},
               complemento = ${dados.complemento},
               bairro = ${dados.bairro},
               cidade = ${dados.cidade},
               estado = ${dados.estado},
               cep = ${dados.cep},
               observacoes = ${dados.observacoes}
         WHERE id = ${id}
        RETURNING ${colunasDoImovel(escrita)}
      `;

      return alterada;
    },
  );

  return await comAgregado(tx, linha);
}

/**
 * Retira o imóvel de circulação, ou o devolve a ela, e entrega a linha nova. `undefined` quando não
 * alcançado.
 *
 * ---------------------------------------------------------------------------
 * UMA função para os dois sentidos, e a razão é o ALCANCE
 * ---------------------------------------------------------------------------
 *
 * Retirar e recircular são o mesmo fato com valores opostos na mesma coluna. Duas instruções ficariam
 * livres para divergir justamente no `WHERE` — e é o `WHERE`, sob a política, que carrega a fronteira
 * de tenant. É a mesma decisão, com a mesma justificativa, de `definirCirculacaoDoConjunto`.
 *
 * ---------------------------------------------------------------------------
 * A IDEMPOTÊNCIA É DA INSTRUÇÃO, e não de um `if` antes dela
 * ---------------------------------------------------------------------------
 *
 * `coalesce(retirado_em, now())` **preserva a marca que já existe**: repetir a retirada devolve o
 * mesmo instante, caractere a caractere, e a resposta é a mesma. A alternativa — ler antes, decidir
 * na aplicação e só então escrever — teria duas idas ao banco e uma corrida entre elas, em que duas
 * requisições concorrentes leem "ainda não retirado" e a segunda sobrescreve a marca da primeira.
 *
 * E ela preserva o que distingue "não achou" de "já estava retirado": um `WHERE … AND retirado_em IS
 * NULL` devolveria zero linhas nos **dois** casos, e a borda responderia `404` a uma repetição
 * legítima. Aqui a ausência de linha significa uma coisa só — o contexto não alcança o imóvel.
 *
 * A recirculação **zera** a marca, e é isso que faz a retirada seguinte produzir um instante
 * **novo**: sem essa metade, uma implementação que nunca reescrevesse a marca seria indistinguível
 * desta.
 */
export async function definirCirculacaoDoImovel(
  tx: TransactionSql,
  id: string,
  emCirculacao: boolean,
): Promise<ImovelPersistido | undefined> {
  const [linha] = await tx<LinhaDoImovel[]>`
    UPDATE negocio.imovel
       SET retirado_em = CASE
                           WHEN ${emCirculacao} THEN NULL
                           ELSE coalesce(retirado_em, now())
                         END
     WHERE id = ${id}
    RETURNING ${colunasDoImovel(tx)}
  `;

  return await comAgregado(tx, linha);
}

/**
 * Escreve a situação de locação do imóvel — **a porta estreita, e o único caminho que grava
 * `LOCADO`**.
 *
 * ---------------------------------------------------------------------------
 * POR QUE ELA EXISTE SEPARADA, e por que a assimetria NÃO se unifica
 * ---------------------------------------------------------------------------
 *
 * A assimetria é com a **criação**: {@link criarImovel} recebe `statusLocacao` tipado em
 * {@link SituacaoInformavel} — o subconjunto que o cliente pode declarar, que
 * `esquemaDeImovelNovo.statusLocacao` lê de `SITUACOES_INFORMAVEIS` na borda —, e esta função é
 * tipada em {@link SituacaoDeLocacao}, o enum completo. Ela é **decisão fechada da fatia 1**, com
 * prova dedicada (`CT-334`/`CT-335`), e o cabeçalho de `packages/contracts/src/imovel.ts` registra a
 * razão por extenso: `LOCADO` é produzido pela **ativação de contrato**, e nenhum corpo de
 * requisição pode alcançá-lo.
 *
 * A **alteração** deixou de participar dessa comparação na T10: {@link alterarImovel} recebe
 * {@link DadosDaAlteracaoDoImovel}, que **não tem** `statusLocacao` — ali não há tipo a alargar,
 * porque não há campo.
 *
 * Nenhuma das duas simetrias tentadoras se aplica, e as duas desfariam **o mesmo** invariante —
 * *"`LOCADO` implica contrato ativo"* —, bastando um corpo de requisição com o campo para um imóvel
 * se declarar locado sem contrato algum: nem devolver o campo à alteração "por simetria com a
 * criação", nem alargar o tipo da criação para o enum completo "por simetria com esta função".
 * **Leia o marcador `DECISÃO FECHADA` de `esquemaDeImovelAlterado`, em
 * `packages/contracts/src/imovel.ts`, antes de qualquer tentativa de simetrizar** (regressão de
 * decisão, R3) — ele governa as duas ausências.
 *
 * Ela devolve `void` porque quem a chama já tem o imóvel em mãos: são a ativação e o cancelamento de
 * contrato, que acabaram de alcançá-lo pela chave estrangeira composta, e a rota de situação de
 * locação. A partir da F5 há um **quarto**, e ele é o único **sem ator**: o encerramento do contrato
 * vencido, em {@link ./encerramento-de-contratos.ts}, que a alcança pelo imóvel lido na própria
 * seleção dos candidatos. Ele é o chamador que **não** escreve a situação sempre — só converte
 * `LOCADO → DISPONIVEL`, e preserva o `INDISPONIVEL` do Admin (RD-20); a condição é dele, e não
 * desta porta, que segue escrevendo o que lhe mandarem.
 * A ausência de linha é, portanto, estado impossível — e ela levanta com nome, em vez de
 * deixar a escrita não ter efeito em silêncio, que é o modo de falha desta operação: um imóvel que
 * ficasse `DISPONIVEL` com contrato vigente não acusaria nada até a segunda locação ser recusada.
 */
export async function definirSituacaoDeLocacaoDoImovel(
  tx: TransactionSql,
  imovelId: string,
  situacao: SituacaoDeLocacao,
): Promise<void> {
  const resultado = await tx`
    UPDATE negocio.imovel
       SET status_locacao = ${situacao}
     WHERE id = ${imovelId}
  `;

  if (resultado.count !== 1) {
    throw new Error('a situação de locação foi escrita e o imóvel não foi alcançado');
  }
}

/**
 * Executa a escrita e traduz **a violação da restrição de unicidade** — o ponto único das duas.
 *
 * A escrita corre dentro de um `SAVEPOINT` pela razão que o cabeçalho deste arquivo registra: a
 * violação aborta a transação, e sem o ponto de retorno a leitura que descreve o conflito seria
 * impossível na mesma unidade de trabalho. O desfazimento alcança **só** a instrução recusada — o
 * que a unidade já gravou antes dela permanece, e é o que faz esta tradução caber dentro de uma
 * composição maior (o imóvel e os cômodos dele, na T7).
 *
 * Toda violação que **não** seja a da restrição nomeada é **repassada intacta**. Traduzir `23505`
 * em bloco atribuiria à entrada do cliente uma colisão de outra restrição — e a esconderia atrás de
 * um `422` plausível, que é a pior forma de perder um defeito.
 *
 * O tipo é **concreto**, e não genérico: as duas escritas que ela envolve devolvem a mesma linha, e
 * o parâmetro de tipo obrigaria a converter o `UnwrapPromiseArray` do driver — uma conversão no
 * caminho da tradução de erro é justamente onde ela não deve existir.
 */
async function gravarSobRestricaoDeUnicidade(
  tx: TransactionSql,
  identificadorMunicipal: string,
  escrever: (escrita: TransactionSql) => Promise<LinhaDoImovel | undefined>,
): Promise<LinhaDoImovel | undefined> {
  try {
    return await tx.savepoint(async (escrita) => await escrever(escrita));
  } catch (erro) {
    if (!ehViolacaoDoIdentificadorMunicipal(erro)) {
      throw erro;
    }

    throw new ErroDeIdentificadorMunicipalEmUso(
      await lerConflitoDoIdentificador(tx, identificadorMunicipal),
    );
  }
}

/**
 * Reconhece a recusa da restrição `unique(empresa_id, identificador_municipal)`.
 *
 * A leitura é por **forma**, e não por `instanceof`: o erro do servidor chega como objeto do driver,
 * e o par (`code`, `constraint_name`) é o contrato do protocolo — os mesmos dois campos que
 * `packages/db/test/isolamento.spec.ts` e `permissao.spec.ts` já leem. Casar pelo texto da mensagem
 * seria amarrar a tradução ao idioma configurado no servidor.
 */
function ehViolacaoDoIdentificadorMunicipal(erro: unknown): boolean {
  const falha = erro as { code?: unknown; constraint_name?: unknown } | null;

  return (
    falha?.code === VIOLACAO_DE_UNICIDADE &&
    falha.constraint_name === RESTRICAO_DO_IDENTIFICADOR_MUNICIPAL
  );
}

/**
 * Lê o estado do imóvel que já ocupa o identificador — **depois** de o banco ter recusado.
 *
 * É a leitura que enriquece a mensagem, e não a que decide se pode gravar: quando ela corre, a
 * recusa já aconteceu. A resposta que ela produz é o que diz ao usuário se o caminho é **reativar**
 * o imóvel retirado ou **recadastrar** com outro identificador — a consequência que a ADR-0014
 * nomeia entre os *Cons* (*"o registro retirado continua ocupando o valor"*).
 *
 * Não há `WHERE empresa_id` aqui, e não pode haver: a linha em conflito é necessariamente da empresa
 * do contexto — é a própria restrição, que tem `empresa_id` na chave, que o garante —, e a política
 * já recorta a leitura. A ausência de linha é, portanto, estado impossível: ela levanta com nome, em
 * vez de escolher um discriminador por omissão e afirmar ao usuário algo que ninguém apurou.
 */
async function lerConflitoDoIdentificador(
  tx: TransactionSql,
  identificadorMunicipal: string,
): Promise<ConflitoDeIdentificador> {
  const [emConflito] = await tx<{ retiradoEm: Date | null }[]>`
    SELECT retirado_em AS "retiradoEm"
      FROM negocio.imovel
     WHERE identificador_municipal = ${identificadorMunicipal}
  `;

  if (emConflito === undefined) {
    throw new Error(
      'a restrição de unicidade recusou a gravação e o imóvel em conflito não é alcançável',
    );
  }

  return emConflito.retiradoEm === null ? 'EM_CIRCULACAO' : 'RETIRADO_DE_CIRCULACAO';
}
