/**
 * A autorização do lado de `@sysloc/auth` — **a decisão**, e o retrato de efetivo que ela consome.
 *
 * ---------------------------------------------------------------------------
 * A decisão mora AQUI e é CONSULTADA no ponto de aplicação
 * ---------------------------------------------------------------------------
 *
 * É o mesmo padrão de `apps/api/src/autenticacao/sessao-restrita.ts`, e pela mesma razão escrita
 * lá: *"uma regra escrita no ponto onde ela é aplicada vira uma regra por ponto de aplicação"*.
 * {@link decidirAcesso} é função pura — sem pedido, sem banco e sem relógio —, o que a torna
 * exercitável e a mantém sendo **uma** definição. A guarda de contexto a chama; nenhum manipulador,
 * serviço ou controlador reavalia por conta própria, e o **CT-216** reprova por varredura de fontes
 * o segundo consumidor que aparecer em `apps/api/src`.
 *
 * ---------------------------------------------------------------------------
 * DUAS dimensões independentes, e a ausência de declaração RECUSA (ADR-0011)
 * ---------------------------------------------------------------------------
 *
 * A **ADR-0011** fixa que toda rota declara o que exige em duas dimensões ortogonais — perfil e
 * chave do catálogo fechado — e que *"a rota que não declara nada é recusada"*. As duas dimensões
 * existem porque o catálogo é fechado nas 17 chaves do app da imobiliária: as operações do operador
 * do SaaS não cabem nele sem inflá-lo até ele deixar de ser a matriz do produto, e por isso o
 * Master atravessa pela dimensão de **perfil**, nunca por chave.
 *
 * A terceira variante — {@link Exigencia} com `dimensao: 'NENHUMA'` — é a marca de *"esta rota
 * legitimamente não exige permissão"*, que a própria ADR nomeia como *"a única abertura
 * deliberada"*. Ela é um valor de {@link Exigencia}, e **não** um caso especial tratado fora daqui:
 * assim a guarda chama esta função para toda rota, sem ramo próprio, e existe **um** lugar onde se
 * decide o que passa. O que a ADR proíbe é a rota **sem declaração alguma** — e essa não chega até
 * aqui: ela é ausência de metadado, e quem a recusa é a guarda, porque o valor `undefined` não é
 * uma exigência a avaliar.
 *
 * ---------------------------------------------------------------------------
 * Por que o retrato de efetivo é LIDO E ESCRITO deste lado da fronteira (ADR-0009)
 * ---------------------------------------------------------------------------
 *
 * As três colunas de efetivo vivem em `identidade.sessao`, e a **ADR-0009** mantém a leitura de
 * `identidade` deste lado: `apps/api` **consome**, não monta consulta. É o mesmo critério que já
 * trouxe {@link carregarPessoaDaSessao} e `limparMarcaDeSenhaProvisoria` para `admissao.ts` — o que
 * dispensa a aplicação de conhecer `esquemaIdentidade` e o construtor de consulta do ORM, e é o que
 * sustenta a contenção que a §11.2 da tech spec exige na ausência de RLS naquele schema.
 *
 * A pergunta que o índice do pacote obriga a fazer foi feita para as três funções daqui: **isto
 * emite sessão? NÃO.** Nenhuma cria linha em `identidade.sessao`, nenhuma devolve token ou cookie e
 * nenhuma decide admissão — a de escrita atualiza três colunas de uma sessão que o arcabouço já
 * criou e conferiu.
 *
 * ---------------------------------------------------------------------------
 * A repartição nos dois eixos tem UM lugar
 * ---------------------------------------------------------------------------
 *
 * `calcularEfetivo` devolve um conjunto só, com o eixo no prefixo de cada chave; o registro de
 * sessão e o contrato do `GET /v1/sessao` falam **dois arranjos**. A conversão entre as duas formas
 * é {@link repartirEfetivo}, e ela tem um **segundo consumidor desde a T8** — ver o docblock dela.
 * {@link regravarEfetivoDaSessao} devolve o retrato **já repartido** que acabou de gravar, de modo
 * que quem escreve e quem publica não podem discordar sobre em que arranjo uma chave cai.
 */

import { type BancoDeIdentidade, esquemaIdentidade } from '@sysloc/db';
import { eq } from 'drizzle-orm';
import {
  CHAVES_DE_TELA,
  type ChaveDeAcao,
  type ChaveDeTela,
  type ChaveDoCatalogo,
  ehChaveDoCatalogo,
} from './catalogo-de-permissoes.js';
import type { Perfil } from './perfis.js';

/**
 * Prefixo com que a dimensão de perfil se nomeia em `detalhes.exigido`.
 *
 * A forma `PERFIL:SYSLOC_MASTER` espelha a das chaves do catálogo (`TELA:financeiro`) de propósito:
 * a RN-14 manda a recusa **nomear a exigência**, e um cliente que só recebesse `SYSLOC_MASTER` não
 * saberia se lhe faltou o perfil ou uma chave de mesmo nome. O prefixo é o que torna as duas
 * dimensões distinguíveis por inspeção do próprio valor, sem campo extra no envelope.
 */
const PREFIXO_DE_PERFIL = 'PERFIL';

/** Separador entre o eixo e o nome — o mesmo do catálogo, para as duas formas coincidirem. */
const SEPARADOR = ':';

/**
 * O que uma rota exige, nas duas dimensões da ADR-0011 mais a marca de "não exige".
 *
 * União discriminada, como o `Admissao` da barreira e o `AlcanceDaSessao` da sessão restrita: é
 * impossível declarar um perfil e uma chave ao mesmo tempo, e impossível ler `chave` de uma
 * exigência de perfil sem que o compilador reclame.
 */
export type Exigencia =
  | { readonly dimensao: 'PERFIL'; readonly perfil: Perfil }
  | { readonly dimensao: 'CHAVE'; readonly chave: ChaveDoCatalogo }
  | { readonly dimensao: 'NENHUMA' };

/** As dimensões, para a tabela exaustiva abaixo. */
type DimensaoDaExigencia = Exigencia['dimensao'];

/**
 * O desfecho da decisão.
 *
 * União discriminada pela mesma razão de `AlcanceDaSessao`: é impossível recusar sem dizer **o que
 * faltou**, e impossível ler o que faltou de um acesso que passou. O `exigido` sai pronto daqui
 * porque quem sabe nomear a exigência é quem a interpreta — a guarda só o repassa em
 * `detalhes.exigido`.
 */
export type DecisaoDeAcesso =
  | { readonly alcanca: true }
  | { readonly alcanca: false; readonly exigido: string };

/**
 * O que esta decisão lê da sessão, e nada além disso.
 *
 * Declarado por estrutura — e não importado da guarda que o consome —, no mesmo molde de
 * `ExigenciasDaSessao` em `sessao-restrita.ts`: a sessão do produto satisfaz este tipo por ter os
 * três campos. O tipo é fechado pelo mesmo motivo de `EstadoDeAdmissao`: acrescentar um dado à
 * decisão obriga a acrescentá-lo aqui, o que torna visível, no tipo, o que a autorização passou a
 * depender.
 */
export interface PermissoesDaSessao {
  /** O perfil da pessoa — a dimensão que o Sysloc Master atravessa. */
  readonly perfil: Perfil;
  /** As áreas de tela do efetivo desta sessão. */
  readonly telas: readonly ChaveDoCatalogo[];
  /** As ações sensíveis do efetivo desta sessão. */
  readonly acoes: readonly ChaveDoCatalogo[];
}

/**
 * Como cada dimensão decide.
 *
 * `Record<DimensaoDaExigencia, …>` sobre a união, e não `switch` com ramo padrão: uma dimensão nova
 * em {@link Exigencia} **não compila** até ganhar decisão aqui, em vez de cair em silêncio num
 * comportamento que ninguém escolheu. É a mesma forma de `PENDENCIA_POR_RESTRICAO` e de
 * `DESFECHO_POR_MOTIVO`.
 *
 * A conversão de cada entrada é o preço de indexar uma união discriminada por um mapa: o
 * compilador não estreita a variante a partir da chave. Ela é segura porque a chave **é** o
 * discriminante, e o acesso abaixo usa `exigencia.dimensao` como índice.
 */
const DECISAO_POR_DIMENSAO: Readonly<
  Record<DimensaoDaExigencia, (exigencia: Exigencia, sessao: PermissoesDaSessao) => DecisaoDeAcesso>
> = {
  // A dimensão de perfil é comparação de igualdade, e é ela — e não um `if (perfil ===
  // 'SYSLOC_MASTER')` espalhado pelo caminho do dado — que dá alcance ao operador do SaaS. O
  // Master tem matriz vazia (`matriz-de-perfil.ts`), de modo que ele **nunca** alcança por chave:
  // as duas metades juntas são o que mantém o catálogo fechado sem deixar as rotas dele a
  // descoberto.
  PERFIL: (exigencia, sessao) => {
    const { perfil } = exigencia as Extract<Exigencia, { dimensao: 'PERFIL' }>;
    return sessao.perfil === perfil
      ? { alcanca: true }
      : { alcanca: false, exigido: `${PREFIXO_DE_PERFIL}${SEPARADOR}${perfil}` };
  },
  // Os dois eixos são consultados porque o efetivo viaja repartido; os prefixos são disjuntos por
  // construção (`catalogo-de-permissoes.ts`), então uma chave de tela nunca pode ser satisfeita por
  // uma entrada do arranjo de ações, e vice-versa. Consultar os dois é o que impede a decisão de
  // depender de a repartição ter caído no arranjo que ela esperava.
  CHAVE: (exigencia, sessao) => {
    const { chave } = exigencia as Extract<Exigencia, { dimensao: 'CHAVE' }>;
    return sessao.telas.includes(chave) || sessao.acoes.includes(chave)
      ? { alcanca: true }
      : { alcanca: false, exigido: chave };
  },
  // A abertura deliberada da ADR-0011. Ela decide **aqui**, e não por um desvio na guarda, para que
  // exista um lugar só onde se responde "isto passa?" — e para que a marca seja um valor auditável
  // em vez de a ausência de um.
  NENHUMA: () => ({ alcanca: true }),
};

/**
 * A sessão alcança a exigência declarada pela rota?
 *
 * Função pura. Ela **decide**; quem aplica é a guarda de contexto — e quem recusa a rota **sem
 * declaração** também é a guarda, porque ausência de metadado não é uma exigência a avaliar.
 *
 * @param exigencia O que a rota declarou, por reflexão.
 * @param sessao O perfil e o efetivo que a sessão corrente carrega.
 */
export function decidirAcesso(exigencia: Exigencia, sessao: PermissoesDaSessao): DecisaoDeAcesso {
  return DECISAO_POR_DIMENSAO[exigencia.dimensao](exigencia, sessao);
}

/**
 * O retrato de efetivo que o registro de sessão carrega — as duas metades e a versão que as datou.
 *
 * `versaoPermissoes` é o valor do contador de `identidade.usuario` no instante em que o retrato foi
 * montado. Divergiu do valor de lá, o retrato está velho: é essa comparação, e não um prazo, que
 * torna o ajuste perceptível na operação seguinte sem derrubar a sessão (ADR-0010).
 */
export interface EfetivoDaSessao {
  readonly telas: readonly ChaveDeTela[];
  readonly acoes: readonly ChaveDeAcao[];
  readonly versaoPermissoes: number;
}

/**
 * O que o registro de sessão carrega, e se aquilo é um retrato de verdade.
 *
 * ---------------------------------------------------------------------------
 * Por que `montado` existe — e por que ele NÃO é um detalhe de implementação
 * ---------------------------------------------------------------------------
 *
 * As três colunas nascem no padrão do schema: `telas = '{}'`, `acoes = '{}'` e
 * `versao_permissoes = 0`. **Quem cria a linha de sessão é o arcabouço de identidade**, e ele não
 * sabe preenchê-las — elas não são campos do modelo `session` dele, exatamente como `perfil` e
 * `empresa_id` não são do modelo `user` (o débito **D7**). A montagem do retrato é, portanto, da
 * PRIMEIRA requisição autenticada da sessão, e não do nascimento dela.
 *
 * Isso cria uma colisão que é preciso reconhecer para não servir dado errado: o estado de
 * nascimento (`0`, vazio, vazio) é **indistinguível pelo valor** do retrato legítimo de quem não
 * alcança nada e nunca teve ajuste. Sem `montado`, a comparação `retrato.versao === pessoa.versao`
 * daria `0 === 0` para **toda sessão recém-criada**, e o efetivo servido seria o vazio com que a
 * coluna nasce — um Admin entraria sem alcançar nada, para sempre, e nenhuma divergência jamais
 * apareceria para corrigir isso.
 *
 * `montado: false` é, então, *"não há retrato confiável aqui"*, e a resposta correta a ele é
 * recalcular — que é o lado seguro, porque recalcular está sempre certo e servir o vazio nem
 * sempre.
 *
 * **Resíduo declarado.** Uma pessoa cuja matriz de perfil é vazia e que nunca teve ajuste
 * permanece no estado de nascimento mesmo depois de a borda recalcular, porque o valor que ela
 * grava é igual ao que a coluna já contém — hoje, apenas o **Sysloc Master** (matriz vazia por
 * decisão estrutural; qualquer ajuste incrementa o contador e sai do zero). O custo é uma leitura
 * de ajustes por requisição dele, sem escrita. Fechar o resíduo exige que a montagem aconteça no
 * nascimento da sessão, o que depende de declarar as colunas como campos adicionais do arcabouço —
 * a mesma decisão do D7, e dono dela é quem o fechar.
 */
export interface RetratoDaSessao {
  /** O que está gravado, já filtrado pelo catálogo corrente. */
  readonly efetivo: EfetivoDaSessao;
  /** `false` quando as três colunas ainda estão no padrão do schema — ver o docblock. */
  readonly montado: boolean;
}

/**
 * Lê o retrato de efetivo gravado no registro de sessão.
 *
 * **Descarta o que o catálogo corrente não reconhece**, pela mesma razão que
 * `lerAjustesDaPessoa` o faz do lado dos ajustes: as colunas são `text[]` e o catálogo é código, de
 * modo que uma chave removida do catálogo continuaria no retrato até a versão mudar — e sairia
 * publicada em `GET /v1/sessao`. O alcance concedido seria nulo (nenhuma rota declara exigência
 * fora do catálogo), mas a superfície publicada mentiria.
 *
 * `undefined` significa "não há registro de sessão com este identificador": a sessão sumiu entre a
 * conferência do arcabouço e esta leitura. Quem chama trata isso como o `montado: false` — sem
 * retrato confiável, recalcula.
 */
export async function carregarRetratoDaSessao(
  banco: BancoDeIdentidade,
  sessaoId: string,
): Promise<RetratoDaSessao | undefined> {
  const { sessao } = esquemaIdentidade;

  const [linha] = await banco
    .select({
      telas: sessao.telas,
      acoes: sessao.acoes,
      versaoPermissoes: sessao.versaoPermissoes,
    })
    .from(sessao)
    .where(eq(sessao.id, sessaoId))
    .limit(1);

  if (linha === undefined) {
    return undefined;
  }

  const efetivo = repartirEfetivo(
    [...linha.telas, ...linha.acoes].filter((chave) => ehChaveDoCatalogo(chave)),
    // O driver devolve `integer` como número; a conversão explícita é o que impede uma mudança de
    // tipo da coluna de fazer o contador viajar como cadeia sem alarme — mesmo cuidado de
    // `incrementarVersaoPermissoes`.
    Number(linha.versaoPermissoes),
  );

  // A conferência é sobre a LINHA CRUA, e não sobre o efetivo já filtrado: um retrato montado que
  // só contivesse chaves órfãs sairia vazio do filtro e seria confundido com nascimento — o que
  // ainda daria o resultado certo (recalcular), mas pela razão errada. Comparar o cru mantém o
  // predicado dizendo exatamente o que ele diz.
  const montado =
    linha.telas.length > 0 || linha.acoes.length > 0 || Number(linha.versaoPermissoes) !== 0;

  return { efetivo, montado };
}

/**
 * Reescreve as três colunas de efetivo do registro de sessão, e devolve o retrato gravado.
 *
 * **É a única escrita no caminho de leitura de uma requisição**, e ela acontece por **mudança**, e
 * não por requisição: quem a chama é a guarda, e apenas quando o retrato gravado não está em dia. O
 * CT-219 prova os dois lados — que a divergência reescreve, e que a ausência dela não toca as
 * colunas.
 *
 * **Nada é escrito quando o resultado é igual ao que já está lá.** É o que torna a segunda metade
 * daquele invariante propriedade da função, e não do acaso: o caminho de recálculo pode ser
 * percorrido sem que a requisição vire uma escrita. A comparação é sobre os três valores
 * publicados, e é barata — os arranjos vêm ordenados de `calcularEfetivo`, então a igualdade
 * posicional basta e não depende de normalizar de novo.
 *
 * Devolve o retrato **já repartido** de propósito: é ele que a sessão do produto publica, e
 * devolvê-lo daqui é o que impede quem grava e quem publica de repartirem diferente.
 *
 * @param efetivo O conjunto que `calcularEfetivo` devolveu, ainda num arranjo só.
 * @param versaoPermissoes A versão corrente da pessoa, que passa a datar o retrato.
 * @param gravado O que a leitura encontrou, quando houve leitura. Omitido, a escrita acontece.
 */
export async function regravarEfetivoDaSessao(
  banco: BancoDeIdentidade,
  sessaoId: string,
  entrada: {
    readonly efetivo: readonly ChaveDoCatalogo[];
    readonly versaoPermissoes: number;
    readonly gravado?: EfetivoDaSessao | undefined;
  },
): Promise<EfetivoDaSessao> {
  const { sessao } = esquemaIdentidade;
  const retrato = repartirEfetivo(entrada.efetivo, entrada.versaoPermissoes);

  if (entrada.gravado !== undefined && saoIguais(entrada.gravado, retrato)) {
    return retrato;
  }

  await banco
    .update(sessao)
    .set({
      telas: [...retrato.telas],
      acoes: [...retrato.acoes],
      versaoPermissoes: retrato.versaoPermissoes,
    })
    .where(eq(sessao.id, sessaoId));

  return retrato;
}

/** Os dois retratos publicam exatamente a mesma coisa? Igualdade posicional sobre os três campos. */
function saoIguais(um: EfetivoDaSessao, outro: EfetivoDaSessao): boolean {
  return (
    um.versaoPermissoes === outro.versaoPermissoes &&
    um.telas.length === outro.telas.length &&
    um.acoes.length === outro.acoes.length &&
    um.telas.every((chave, indice) => chave === outro.telas[indice]) &&
    um.acoes.every((chave, indice) => chave === outro.acoes[indice])
  );
}

/**
 * Parte o efetivo nos dois eixos — ponto único da conversão entre a forma do domínio e a das duas
 * colunas.
 *
 * O critério é a pertinência a {@link CHAVES_DE_TELA}, e não o prefixo textual da chave: comparar
 * o texto aceitaria `TELA:inventada` como tela, e o que decide o que é uma área de tela é o
 * catálogo, não a grafia. A ordem de `calcularEfetivo` (crescente, estável) é preservada em cada
 * arranjo, que é o que permite compará-los entre requisições sem normalizar de novo.
 *
 * **Ela é exportada porque tem um segundo consumidor, e a alternativa era duplicá-la.**
 * `POST /v1/usuarios/:id/permissoes` (T8) devolve o efetivo novo repartido nos mesmos dois eixos, e
 * uma segunda repartição escrita na borda ficaria livre para divergir desta — em particular, a forma
 * óbvia (`chave.startsWith('TELA:')`) é precisamente a que o parágrafo acima rejeita. Publicá-la é o
 * que faz "quem grava e quem publica repartem igual" valer também para a rota que ajusta.
 */
export function repartirEfetivo(
  efetivo: readonly ChaveDoCatalogo[],
  versaoPermissoes: number,
): EfetivoDaSessao {
  const telas: ChaveDeTela[] = [];
  const acoes: ChaveDeAcao[] = [];

  for (const chave of efetivo) {
    if (ehChaveDeTela(chave)) {
      telas.push(chave);
    } else {
      acoes.push(chave);
    }
  }

  return { telas, acoes, versaoPermissoes };
}

/** A chave é uma das 10 áreas de tela? Estreitamento sobre o catálogo, nunca sobre o texto. */
function ehChaveDeTela(chave: ChaveDoCatalogo): chave is ChaveDeTela {
  return (CHAVES_DE_TELA as readonly string[]).includes(chave);
}
