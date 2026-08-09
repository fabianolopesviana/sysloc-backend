/**
 * Cadastro de pessoa — locador, locatário e fiador — na **porta única** parametrizada pelo papel.
 *
 * ---------------------------------------------------------------------------
 * POR QUE ESTAS OPERAÇÕES MORAM AQUI, E NÃO NO SERVIÇO QUE AS CHAMA
 * ---------------------------------------------------------------------------
 *
 * Pela razão que {@link ./conjunto.ts}, {@link ./imovel.ts} e {@link ./comodo.ts} já registram: a
 * contenção da §11.2 é de **tipo** e não alcança **texto de SQL**. Um serviço de aplicação com o
 * executor da unidade de trabalho em mãos escreve `negocio.locador` numa cadeia sem importar nada de
 * proibido, e o alcance às tabelas do domínio deixa de ser enumerável. Toda instrução que o ciclo de
 * vida dos três cadastros precisa vive aqui, publicada como função de domínio.
 *
 * A pergunta que o índice do pacote força, e a resposta: **isto é um caminho para dado fora da
 * unidade de trabalho? NÃO.** As seis funções **recebem** o executor (`tx`) de quem já abriu a
 * unidade; nenhuma abre conexão, reserva ou transação, e nenhuma devolve executor.
 *
 * O termo é o do glossário: **cadastro de pessoa** é a entidade de negócio destas três tabelas;
 * *pessoa*, sozinho, é quem entra no sistema e tem vínculo de acesso — essa mora em
 * {@link ./pessoa.ts}, sobre o schema `identidade`, e as duas não se confundem apesar de o nome
 * colidir.
 *
 * ---------------------------------------------------------------------------
 * A PARAMETRIZAÇÃO É POR TABELA, e é isso que a torna UMA implementação
 * ---------------------------------------------------------------------------
 *
 * Os três papéis têm hoje a **mesma forma** — quinze colunas idênticas, declaradas uma vez em
 * `camposDeCadastroDePessoa()` de {@link ./esquema/negocio.ts} —, e o que os separa é a tabela
 * alvo. O papel escolhe a tabela; o restante do caminho é o mesmo, caractere a caractere. Triplicar
 * estas funções triplicaria também os casos de teste e a superfície de divergência, e a primeira
 * emenda a uma das cópias já as faria discordar.
 *
 * **O conjunto de papéis é FECHADO** ({@link PAPEIS_DE_PESSOA}), e {@link TABELA_POR_PAPEL} é um
 * `Record` sobre a união literal: papel inventado **não é representável**, e um papel novo não
 * compila enquanto não ganhar tabela. É a mesma escolha, e a mesma razão, de
 * `packages/auth/src/catalogo-de-permissoes.ts` — o compilador obriga a tratar o caso novo, em vez
 * de deixar aparecer em execução um valor que ninguém previu.
 *
 * O modo de falha de uma parametrização malfeita é **escrever na tabela errada**, e ele é
 * silencioso: nada levanta, nada some, e o registro simplesmente não está onde deveria. É o que o
 * `CT-350` mede, contando as **três** tabelas na mesma asserção — contar só a esperada não detecta
 * escrita duplicada.
 *
 * ---------------------------------------------------------------------------
 * A UNICIDADE É POR PAPEL, e não global — o banco é quem a impõe
 * ---------------------------------------------------------------------------
 *
 * Cada tabela tem a **sua** `unique(empresa_id, documento_principal)`, e por isso a mesma pessoa do
 * mundo pode ser locadora **e** locatária da mesma empresa. É caso real de negócio, não brecha: o
 * proprietário que aluga um imóvel e mora em outro do mesmo administrador é o exemplo comum.
 *
 * **Não há, em lugar algum deste arquivo, leitura que decida se pode gravar.** Leitura-antes-de-
 * gravar é *janela de corrida disfarçada de validação* — entre o `SELECT` que não achou nada e o
 * `INSERT` que grava, outra transação grava o mesmo documento, e as duas passam. Quem recusa é a
 * restrição, e a violação (`23505`, nomeando a restrição **daquela** tabela) sobe intacta de
 * {@link criarPessoa} e de {@link alterarPessoa} ao chamador.
 *
 * ---------------------------------------------------------------------------
 * A TRADUÇÃO DA VIOLAÇÃO É UM ENVOLTÓRIO À PARTE — e a separação é decisão, não descuido
 * ---------------------------------------------------------------------------
 *
 * {@link gravarCadastroSobRestricaoDeUnicidade} envolve a escrita, reconhece a violação da restrição
 * **daquele papel** e a converte em {@link ErroDeDocumentoEmUso}, já discriminada pelo estado do
 * registro em conflito. É o molde de `gravarSobRestricaoDeUnicidade` em {@link ./imovel.ts}, com
 * **uma** diferença de forma, e ela tem razão: lá o envoltório é privado e as duas escritas o
 * atravessam por dentro; aqui ele é **público e composto por fora**, porque as duas escritas já são
 * observadas cruas pelo `CT-349` e pelo `CT-352`, que afirmam o `code` `23505` e o nome da restrição.
 * Traduzir por dentro apagaria essas provas — e são elas que demonstram que o mecanismo da unicidade
 * é a restrição do banco, e não um `if` da aplicação.
 *
 * Quem compõe as duas coisas é a borda, num ponto só (`apps/api/src/cadastros/
 * cadastro-de-pessoa.service.ts`), e é lá que a recusa vira `422 CAMPO_INVALIDO` com
 * `detalhes.conflito` no envelope da ADR-0017.
 *
 * ---------------------------------------------------------------------------
 * O DOCUMENTO É NORMALIZADO ANTES DE GRAVAR — e a normalização é da PORTA
 * ---------------------------------------------------------------------------
 *
 * A coluna guarda **só dígitos** (§6.2), e é isso que faz a unicidade não depender da máscara que o
 * operador digitou: `529.982.247-25` e `52998224725` são o mesmo documento, e duas linhas com as
 * duas grafias derrotariam a restrição sem que validação alguma acusasse.
 *
 * A normalização mora **aqui**, e não apenas no esquema de entrada de `@sysloc/contracts`, porque o
 * invariante é da **coluna**, não do formulário: esta porta é o único caminho de escrita para as
 * três tabelas (é a decisão de enumerabilidade do primeiro bloco), de modo que garanti-la neste
 * ponto a torna verdadeira para todo chamador — inclusive uma carga futura que não passe por HTTP.
 * Ela é {@link somenteDigitos}, de `@sysloc/shared`, e não uma segunda expressão regular escrita
 * aqui: quem confere o dígito verificador é quem normaliza, e o cabeçalho daquele módulo registra
 * por que as duas andam juntas.
 *
 * ---------------------------------------------------------------------------
 * O PREDICADO DE CIRCULAÇÃO É DA PORTA — o mesmo molde da T5
 * ---------------------------------------------------------------------------
 *
 * A ADR-0014 nomeia, entre os próprios *Cons*, o defeito que ela cria: *"toda consulta de listagem e
 * todo seletor passa a carregar o predicado de circulação; esquecê-lo é um defeito silencioso"*. Um
 * defeito **silencioso** não se fecha pedindo lembrança a quem escreve a próxima listagem: fecha-se
 * invertendo o default. {@link listarPessoas} aplica o predicado **por padrão**, e alcançar os
 * retirados exige o parâmetro nomeado `incluirRetirados`. Quem esquece obtém a listagem correta;
 * quem quer os retirados diz por escrito, e a decisão aparece no diff.
 *
 * {@link localizarPessoa} **não** tem predicado, e a assimetria é deliberada — a recirculação é uma
 * rota sobre `:id`, e uma leitura que escondesse o retirado tornaria a volta dele inalcançável pela
 * interface. O motivo por extenso está no cabeçalho de {@link ./conjunto.ts}, e vale igual aqui.
 *
 * ---------------------------------------------------------------------------
 * O ESCOPO DE TENANT VEM DO BANCO (ADR-0008)
 * ---------------------------------------------------------------------------
 *
 * **Nenhuma função deste arquivo recebe `empresaId` por parâmetro, e nenhuma compara empresa com
 * coisa alguma escrita na aplicação.** As três tabelas nascem com RLS **forçada**
 * (`migracoes/0006_seguranca_dominio.sql`): a política decide o que cada leitura enxerga e o que
 * cada escrita pode gravar. Não há aqui um `WHERE empresa_id = …` — a defesa em profundidade que a
 * `Decision` da ADR-0008 rejeita por escrito.
 *
 * A escrita é a única que precisa **propor** um valor para a coluna, porque `empresa_id` é
 * `NOT NULL` e não tem padrão. Ela o obtém de {@link empresaDoContexto}, que é a expressão literal
 * das políticas, avaliada dentro da própria instrução.
 */

import type { TipoDePessoa } from '@sysloc/contracts';
import { somenteDigitos } from '@sysloc/shared';
import type { Fragment, TransactionSql } from 'postgres';
// O tipo é da **decisão**, e não da entidade: `{ incluirRetirados }` é o parâmetro nomeado que a
// ADR-0014 obriga toda porta de leitura a expor, e ele já nasceu publicado pelo pacote. Declarar um
// gêmeo aqui daria dois nomes ao mesmo parâmetro na superfície pública. Mesma importação, e mesma
// razão, de `./imovel.ts`. O que se importa é o tipo: `conjunto.ts` não é tocado.
import type { OpcoesDeCirculacao } from './conjunto.js';
// O fragmento da empresa do contexto tem **lar único** em `./contexto-de-escrita.ts` (débito D7,
// metade fechada na T7). Ele **não é filtro** sobre as três tabelas — nenhuma leitura deste arquivo
// o aplica, porque elas já têm política e um segundo caminho para o mesmo recorte é o que a
// ADR-0008 rejeita. Ele existe para a **escrita**, onde `empresa_id` é `NOT NULL` sem padrão.
import { empresaDoContexto } from './contexto-de-escrita.js';

/**
 * Os três papéis de cadastro de pessoa — a união **fechada** que parametriza esta porta.
 *
 * `Object.freeze` sobre o literal `as const`: o `as const` fecha a união em tempo de compilação, e o
 * congelamento fecha o arranjo em tempo de execução. Sem o segundo, um consumidor com um `push` mal
 * colocado alargaria o conjunto de todo mundo — este módulo tem instância única no processo. Mesmo
 * desenho de `CHAVES_DE_TELA` em `packages/auth/src/catalogo-de-permissoes.ts`.
 */
export const PAPEIS_DE_PESSOA = Object.freeze(['locador', 'locatario', 'fiador'] as const);

/** União fechada dos papéis. Papel fora dela não é representável. */
export type PapelDePessoa = (typeof PAPEIS_DE_PESSOA)[number];

/**
 * O papel → a tabela que o guarda. **A parametrização inteira mora nesta constante.**
 *
 * A anotação `Readonly<Record<PapelDePessoa, string>>` é o que obriga o compilador: papel novo na
 * união **não compila** enquanto não ganhar entrada aqui, e chave que não seja papel é recusada como
 * propriedade em excesso. É a totalidade como propriedade do compilador, e não do teste — o mesmo
 * mecanismo que `MAPA_ACAO_TELA` usa para amarrar cada ação a uma tela.
 *
 * Ela **não é exportada**, e a ausência da palavra-chave é a decisão: um `export` aqui não serviria
 * caminho de produção nenhum — o único consumidor seria um arquivo de teste —, e ofereceria a
 * qualquer módulo irmão de `packages/db/src/` o mapa para montar SQL próprio sobre
 * `negocio.locador|locatario|fiador`, que é exatamente a capacidade que o cabeçalho deste arquivo
 * argumenta não existir. Não confundir com `somarMetragem` de {@link ./imovel.ts}, que **tem**
 * consumidor de produção externo à declaração e por isso é publicada: aqui não há análogo.
 *
 * E nada se perde em prova ao mantê-la fechada. Que *cada papel aponta para a sua própria tabela* é
 * afirmado **comportamentalmente** pelo `CT-350`, que conta as três tabelas na mesma asserção: dois
 * papéis apontando para a mesma tabela aparecem como a linha gravada na tabela errada. E que as
 * chaves são exatamente os papéis é garantia do **compilador**, pela anotação acima.
 *
 * Os valores são nomes qualificados de tabela, e chegam ao SQL pelo construtor de **identificador**
 * do driver (`tx(nome)`), que os escapa e qualifica — nunca por interpolação de cadeia. Nada aqui
 * vem de fora: é constante deste módulo, indexada por uma união fechada.
 */
const TABELA_POR_PAPEL: Readonly<Record<PapelDePessoa, string>> = Object.freeze({
  locador: 'negocio.locador',
  locatario: 'negocio.locatario',
  fiador: 'negocio.fiador',
});

/** A janela pedida da listagem, já validada na borda. */
export interface JanelaDePessoasCadastradas {
  readonly limite: number;
  readonly deslocamento: number;
}

/**
 * O padrão da porta: **só o que circula**.
 *
 * Ele é o valor omitido de {@link listarPessoas}, e é o que faz o esquecimento produzir a listagem
 * correta em vez do defeito silencioso da ADR-0014. Congelado porque é constante compartilhada entre
 * todas as chamadas que não declaram nada.
 */
const SO_EM_CIRCULACAO: OpcoesDeCirculacao = Object.freeze({ incluirRetirados: false });

/**
 * Os campos que o cliente informa de um cadastro de pessoa — os mesmos na criação e na alteração
 * (§4.1.1), e os mesmos nos três papéis.
 */
export interface DadosDaPessoa {
  readonly nome: string;
  readonly tipoPessoa: TipoDePessoa;
  /** Chega como o cliente digitou; é gravado só com dígitos — ver {@link comDocumentoNormalizado}. */
  readonly documentoPrincipal: string;
  /** Anulável: pessoa jurídica não tem um. */
  readonly rg: string | null;
  readonly email: string;
  readonly telefone: string;
  readonly logradouro: string;
  readonly numero: string;
  readonly complemento: string | null;
  readonly bairro: string;
  readonly cidade: string;
  readonly estado: string;
  readonly cep: string;
}

/** Uma linha de cadastro de pessoa, na projeção que o contrato publica. */
export interface PessoaCadastrada {
  readonly id: string;
  readonly nome: string;
  readonly tipoPessoa: TipoDePessoa;
  /** Sempre em dígitos, como foi guardado — remascarar é apresentação, e é do cliente. */
  readonly documentoPrincipal: string;
  readonly rg: string | null;
  readonly email: string;
  readonly telefone: string;
  readonly logradouro: string;
  readonly numero: string;
  readonly complemento: string | null;
  readonly bairro: string;
  readonly cidade: string;
  readonly estado: string;
  readonly cep: string;
  /** A marca da exclusão lógica (ADR-0014): nula enquanto circula, o instante da retirada depois. */
  readonly retiradoEm: Date | null;
}

/** A página lida, com o total do papel inteiro — os dois da MESMA transação. */
export interface PaginaDePessoasCadastradas {
  readonly pessoas: readonly PessoaCadastrada[];
  readonly total: number;
}

/** Em que estado está o cadastro que já ocupa o documento recusado. */
export type ConflitoDeDocumento = 'EM_CIRCULACAO' | 'RETIRADO_DE_CIRCULACAO';

/**
 * O documento já pertence a outro cadastro **do mesmo papel, nesta empresa**.
 *
 * É erro de **domínio**, e não de transporte: esta camada não conhece HTTP nem código de erro de
 * API. Quem o traduz no envelope da ADR-0017 — `422 CAMPO_INVALIDO` com `campo` e
 * `detalhes.conflito` — é `apps/api/src/cadastros/cadastro-de-pessoa.service.ts`, num ponto único.
 *
 * **A mensagem não carrega o documento recusado**, e a omissão é a decisão: a §13.1 da tech spec
 * proíbe que o dado em disputa entre na mensagem de erro, porque ela chega ao registro estruturado e
 * a recusa é a resposta a um cliente que ainda não provou nada. O que o usuário precisa saber — qual
 * campo, e se o conflito está em circulação — viaja em campo nomeado. **O papel também não entra**:
 * ele já é a rota que o cliente chamou, e repeti-lo na mensagem não acrescenta diagnóstico.
 */
export class ErroDeDocumentoEmUso extends Error {
  override readonly name: string = 'ErroDeDocumentoEmUso';

  /** Se o cadastro que ocupa o documento circula ou foi retirado — é ele que discrimina a recusa. */
  readonly conflito: ConflitoDeDocumento;

  constructor(conflito: ConflitoDeDocumento) {
    super('o documento já pertence a outro cadastro deste papel nesta empresa');
    this.conflito = conflito;
  }
}

/**
 * O nome da restrição que impõe a unicidade do documento, **por papel**, como o servidor a reporta.
 *
 * Ele é o **discriminante**: cada uma das três tabelas tem duas restrições únicas, e a outra
 * (`<papel>_id_empresa_key`) é o alvo das chaves estrangeiras compostas que a fatia de contratos
 * traz. Traduzir toda violação `23505` como conflito de documento atribuiria à entrada do cliente uma
 * colisão que ele não causou — e, pior, a esconderia atrás de um `422` plausível.
 *
 * A anotação `Readonly<Record<PapelDePessoa, string>>` é a mesma totalidade de {@link
 * TABELA_POR_PAPEL}: papel novo na união não compila enquanto não ganhar restrição aqui.
 */
const RESTRICAO_DO_DOCUMENTO: Readonly<Record<PapelDePessoa, string>> = Object.freeze({
  locador: 'locador_empresa_documento_key',
  locatario: 'locatario_empresa_documento_key',
  fiador: 'fiador_empresa_documento_key',
});

/** `unique_violation` — o `SQLSTATE` que o servidor devolve ao recusar a restrição acima. */
const VIOLACAO_DE_UNICIDADE = '23505';

/**
 * A tabela do papel, como **identificador escapado** do driver.
 *
 * `tx(nome)` é o construtor de identificador do `postgres.js`: ele escapa o nome e qualifica o
 * schema, e o valor resultante nunca é interpolado como texto de consulta. O nome vem de
 * {@link TABELA_POR_PAPEL}, indexado por uma união fechada — não há entrada de fora no caminho.
 */
function tabelaDoPapel(tx: TransactionSql, papel: PapelDePessoa) {
  return tx(TABELA_POR_PAPEL[papel]);
}

/**
 * A projeção publicada, escrita **uma vez** e reusada pelas seis funções.
 *
 * É um **fragmento** do driver, e não uma cadeia interpolada: ele é montado pelo mesmo mecanismo da
 * consulta que o hospeda, e nada aqui vem de fora — é constante deste módulo, sem interpolação
 * alguma. Mesmo padrão, e mesma justificativa, de `colunasDoImovel` em {@link ./imovel.ts}.
 *
 * Os apelidos existem porque as colunas são `snake_case` e o contrato fala camelCase (ADR-0017):
 * traduzir aqui, num ponto só, é o que impede seis traduções livres para divergir. E `empresa_id`
 * **não** está na lista — o que a porta devolve é o que o contrato publica, e a coluna de tenant não
 * é publicada.
 */
function colunasDaPessoa(tx: TransactionSql): Fragment {
  return tx`
    id,
    nome,
    tipo_pessoa AS "tipoPessoa",
    documento_principal AS "documentoPrincipal",
    rg,
    email,
    telefone,
    logradouro,
    numero,
    complemento,
    bairro,
    cidade,
    estado,
    cep,
    retirado_em AS "retiradoEm"
  `;
}

/**
 * O predicado de circulação — **o ponto único** onde "retirado some da lista" vira instrução.
 *
 * Um fragmento, e não uma comparação com parâmetro (`${incluir} OR retirado_em IS NULL`), por duas
 * razões: o índice `<papel>_empresa_retirado_idx` cobre o par `(empresa_id, retirado_em)` que a
 * forma abaixo consulta, e a disjunção com parâmetro esconderia do planejador o que a consulta de
 * fato pede. E ele é **um só** para a página e para o total: duas escritas do mesmo recorte fariam a
 * contagem descrever um conjunto do qual a página já não faz parte.
 */
function predicadoDeCirculacao(tx: TransactionSql, opcoes: OpcoesDeCirculacao): Fragment {
  return opcoes.incluirRetirados ? tx`TRUE` : tx`retirado_em IS NULL`;
}

/**
 * Os dados com o documento reduzido a dígitos — **o ponto único** da normalização de escrita.
 *
 * As duas escritas passam por aqui, e é isso que faz a afirmação do cabeçalho ser verdadeira para as
 * duas: uma normalização por instrução ficaria livre para existir numa e faltar na outra, e a
 * alteração que gravasse a máscara derrotaria a restrição única sem levantar nada.
 */
function comDocumentoNormalizado(dados: DadosDaPessoa): DadosDaPessoa {
  return { ...dados, documentoPrincipal: somenteDigitos(dados.documentoPrincipal) };
}

/**
 * Grava um cadastro de pessoa no papel informado e devolve a linha como ela ficou.
 *
 * O cadastro nasce **em circulação** — `retirado_em` é nulo por ausência de valor, e não por um
 * valor escrito aqui: a coluna é anulável e o estado inicial é o da tabela, não o desta função.
 *
 * A recusa por documento repetido vem do **banco**, e sobe intacta: `23505` nomeando a restrição
 * daquele papel. Ver o cabeçalho deste arquivo para por que a tradução dela não acontece aqui.
 */
export async function criarPessoa(
  tx: TransactionSql,
  papel: PapelDePessoa,
  dados: DadosDaPessoa,
): Promise<PessoaCadastrada> {
  const gravaveis = comDocumentoNormalizado(dados);

  const [pessoa] = await tx<PessoaCadastrada[]>`
    INSERT INTO ${tabelaDoPapel(tx, papel)} (
      empresa_id, nome, tipo_pessoa, documento_principal, rg, email, telefone,
      logradouro, numero, complemento, bairro, cidade, estado, cep
    )
    VALUES (
      ${empresaDoContexto(tx)}, ${gravaveis.nome}, ${gravaveis.tipoPessoa},
      ${gravaveis.documentoPrincipal}, ${gravaveis.rg}, ${gravaveis.email}, ${gravaveis.telefone},
      ${gravaveis.logradouro}, ${gravaveis.numero}, ${gravaveis.complemento}, ${gravaveis.bairro},
      ${gravaveis.cidade}, ${gravaveis.estado}, ${gravaveis.cep}
    )
    RETURNING ${colunasDaPessoa(tx)}
  `;

  if (pessoa === undefined) {
    // Inalcançável por entrada de cliente: o `INSERT … RETURNING` de uma linha ou devolve a linha ou
    // levanta. O ramo existe porque o tipo do driver admite o arranjo vazio, e um `as` no lugar dele
    // trocaria uma falha nomeada por um `undefined` viajando como se fosse um cadastro.
    throw new Error('o cadastro de pessoa foi gravado e a linha não voltou do INSERT');
  }

  return pessoa;
}

/**
 * Lê uma página de cadastros do papel informado e o total daquele papel, na **mesma transação**.
 *
 * Lidos separadamente, o total poderia descrever um conjunto do qual a página já não faz parte, e o
 * cliente pagina sobre dois retratos — mesma razão de `listarConjuntos`, em {@link ./conjunto.ts}.
 *
 * A ordem é `nome, id`, e o desempate importa: `nome` sozinho empata entre homônimos, e um empate faz
 * a mesma linha aparecer em duas páginas — ou em nenhuma.
 *
 * **O predicado de circulação é aplicado por padrão**, e o `opcoes` omitido é o caminho correto.
 */
export async function listarPessoas(
  tx: TransactionSql,
  papel: PapelDePessoa,
  janela: JanelaDePessoasCadastradas,
  opcoes: OpcoesDeCirculacao = SO_EM_CIRCULACAO,
): Promise<PaginaDePessoasCadastradas> {
  const pessoas = await tx<PessoaCadastrada[]>`
    SELECT ${colunasDaPessoa(tx)}
      FROM ${tabelaDoPapel(tx, papel)}
     WHERE ${predicadoDeCirculacao(tx, opcoes)}
     ORDER BY nome, id
     LIMIT ${janela.limite}
    OFFSET ${janela.deslocamento}
  `;

  const [contagem] = await tx<{ total: string }[]>`
    SELECT count(*) AS total
      FROM ${tabelaDoPapel(tx, papel)}
     WHERE ${predicadoDeCirculacao(tx, opcoes)}
  `;

  // `count(*)` volta como `bigint`, que o driver entrega em cadeia de caracteres. A conversão
  // explícita é o que impede o total de viajar como texto no JSON.
  return { pessoas, total: Number(contagem?.total ?? 0) };
}

/**
 * Localiza o cadastro pelo identificador, **dentro do papel informado**. `undefined` quando o
 * contexto corrente não o alcança.
 *
 * Duas ausências são deliberadamente **indistinguíveis**: o cadastro não existe, ou existe e é de
 * outra empresa. A borda traduz as duas no mesmo `404 RECURSO_NAO_ENCONTRADO` — a recusa é
 * consequência de não achar, e não de uma comparação de empresa escrita na aplicação (ADR-0008).
 *
 * Uma terceira ausência se soma às duas, e é própria da parametrização: o identificador **de outro
 * papel** também não é achado, porque a consulta corre sobre a tabela deste. É o que o `CT-350`
 * afirma, e é o oposto do defeito silencioso que ele persegue.
 *
 * **Ela alcança o retirado de circulação**, e o cabeçalho deste arquivo registra por quê.
 */
export async function localizarPessoa(
  tx: TransactionSql,
  papel: PapelDePessoa,
  id: string,
): Promise<PessoaCadastrada | undefined> {
  const [pessoa] = await tx<PessoaCadastrada[]>`
    SELECT ${colunasDaPessoa(tx)}
      FROM ${tabelaDoPapel(tx, papel)}
     WHERE id = ${id}
  `;

  return pessoa;
}

/**
 * Localiza N cadastros do papel informado **numa consulta só**, indexados pelo identificador.
 *
 * ---------------------------------------------------------------------------
 * ELA EXISTE PORQUE A CARDINALIDADE É DO CLIENTE — e o laço a transformava em N consultas
 * ---------------------------------------------------------------------------
 *
 * A coleção de fiadores de um contrato **não tem teto** — nem no esquema de entrada, nem no banco,
 * nem por decisão (a RD-06 fixa *"zero ou mais fiadores, sem teto"* por escrito). Conferi-la com uma
 * chamada a {@link localizarPessoa} por item faria o **número de idas ao banco** ser escolhido pela
 * requisição, dentro de uma transação aberta que segura uma conexão de um pool **compartilhado entre
 * empresas**. O isolamento de *dado* é garantido pela política (ADR-0008); o de **recurso** não é
 * garantido por nada, e uma requisição com dezenas de milhares de identificadores degradaria o
 * serviço de todas as empresas sem violar regra alguma de acesso.
 *
 * O teto declarado foi a alternativa descartada: ele fecharia a magnitude contrariando a RD-06, e
 * deixaria o eixo aberto para a próxima coleção sem teto. Esta forma fecha o eixo — o custo passa a
 * ser **uma** consulta por papel, por construção, e não por um limite que alguém precise manter.
 *
 * ---------------------------------------------------------------------------
 * O MAPA é a forma devolvida, e a razão é a ORDEM DA RECUSA
 * ---------------------------------------------------------------------------
 *
 * Ela devolve um índice por identificador, e **não** a lista de linhas, porque quem chama precisa
 * percorrer os identificadores **na ordem em que o cliente os enviou** para nomear o **primeiro**
 * problema. Percorrer o resultado da consulta faria a resposta depender da ordem em que o banco
 * devolveu as linhas — e, pior, tornaria o identificador **ausente** invisível, já que ele não está
 * no resultado. O mapa preserva as duas coisas: a ordem é de quem itera, e a ausência é um
 * {@link Map.get} que devolve `undefined`, exatamente como {@link localizarPessoa} devolvia.
 *
 * A lista vazia devolve o mapa vazio **sem consultar**: pagar uma ida ao banco para saber que
 * `= ANY('{}')` não casa nada é custo sem informação — mesma decisão de `lerComodosDeImoveis`, em
 * {@link ./comodo.ts}, e é o caso comum aqui (contrato sem fiador).
 *
 * As três ausências de {@link localizarPessoa} valem sem mudança: não existe, existe em outra
 * empresa (a política o esconde), ou existe em **outro papel**. Nenhuma comparação de empresa é
 * escrita aqui, e **ela alcança o retirado de circulação** — é a conferência de circulação de quem
 * chama que o recusa, e sem esse alcance a recusa nomeada viraria um `404` genérico.
 */
export async function localizarPessoas(
  tx: TransactionSql,
  papel: PapelDePessoa,
  ids: readonly string[],
): Promise<Map<string, PessoaCadastrada>> {
  const porId = new Map<string, PessoaCadastrada>();

  if (ids.length === 0) {
    return porId;
  }

  const pessoas = await tx<PessoaCadastrada[]>`
    SELECT ${colunasDaPessoa(tx)}
      FROM ${tabelaDoPapel(tx, papel)}
     WHERE id = ANY(${[...ids]}::uuid[])
  `;

  for (const pessoa of pessoas) {
    porId.set(pessoa.id, pessoa);
  }

  return porId;
}

/**
 * Reescreve os campos informados do cadastro e devolve a linha nova. `undefined` quando não
 * alcançado.
 *
 * O corpo é **completo** (§4.1.1): não há atualização parcial nesta superfície, e campo ausente é
 * recusa por campo obrigatório na borda — nunca "preserve o que estava lá".
 *
 * A alteração **não** consulta o predicado de circulação, pela mesma razão de
 * {@link localizarPessoa}: quem tem o identificador em mãos alcança o registro, e a marca viaja no
 * corpo. Ela também **não** toca `retirado_em` — a circulação tem porta própria, e reuni-las faria
 * uma correção de telefone carregar, por descuido, uma mudança de estado.
 *
 * O documento passa pela **mesma** normalização da criação: um `PUT` que gravasse a máscara faria a
 * linha escapar da restrição única, e a segunda gravação do mesmo documento passaria a ser aceita.
 */
export async function alterarPessoa(
  tx: TransactionSql,
  papel: PapelDePessoa,
  id: string,
  dados: DadosDaPessoa,
): Promise<PessoaCadastrada | undefined> {
  const gravaveis = comDocumentoNormalizado(dados);

  const [pessoa] = await tx<PessoaCadastrada[]>`
    UPDATE ${tabelaDoPapel(tx, papel)}
       SET nome = ${gravaveis.nome},
           tipo_pessoa = ${gravaveis.tipoPessoa},
           documento_principal = ${gravaveis.documentoPrincipal},
           rg = ${gravaveis.rg},
           email = ${gravaveis.email},
           telefone = ${gravaveis.telefone},
           logradouro = ${gravaveis.logradouro},
           numero = ${gravaveis.numero},
           complemento = ${gravaveis.complemento},
           bairro = ${gravaveis.bairro},
           cidade = ${gravaveis.cidade},
           estado = ${gravaveis.estado},
           cep = ${gravaveis.cep}
     WHERE id = ${id}
    RETURNING ${colunasDaPessoa(tx)}
  `;

  return pessoa;
}

/**
 * Retira o cadastro de circulação, ou o devolve a ela, e entrega a linha nova. `undefined` quando
 * não alcançado.
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
 * legítima. Aqui a ausência de linha significa uma coisa só — o contexto não alcança o cadastro.
 *
 * A recirculação **zera** a marca, e é isso que faz a retirada seguinte produzir um instante
 * **novo**: sem essa metade, uma implementação que nunca reescrevesse a marca seria indistinguível
 * desta.
 */
export async function definirCirculacaoDaPessoa(
  tx: TransactionSql,
  papel: PapelDePessoa,
  id: string,
  emCirculacao: boolean,
): Promise<PessoaCadastrada | undefined> {
  const [pessoa] = await tx<PessoaCadastrada[]>`
    UPDATE ${tabelaDoPapel(tx, papel)}
       SET retirado_em = CASE
                           WHEN ${emCirculacao} THEN NULL
                           ELSE coalesce(retirado_em, now())
                         END
     WHERE id = ${id}
    RETURNING ${colunasDaPessoa(tx)}
  `;

  return pessoa;
}

/**
 * Executa a escrita e traduz **a violação da restrição de unicidade do documento** — o ponto único
 * das duas escritas que podem colidir.
 *
 * ---------------------------------------------------------------------------
 * O SAVEPOINT existe porque a violação ABORTA a transação — leia antes de removê-lo
 * ---------------------------------------------------------------------------
 *
 * No PostgreSQL, um erro dentro de uma transação a coloca em estado abortado: **qualquer** instrução
 * seguinte falha com `25P02` até um `ROLLBACK`. Sem o ponto de retorno, a leitura que descreve o
 * conflito seria impossível na mesma unidade de trabalho — ela já teria sido perdida pela própria
 * recusa que se quer descrever —, e a alternativa seria abrir uma **segunda** unidade depois, o que a
 * decisão D1 (unidade aberta na borda) e o `ErroDeUnidadeAninhada` recusam.
 *
 * `tx.savepoint` reusa a transação corrente — é exatamente o mecanismo que o `REVERTER EXIGE` do
 * marcador `DECISÃO FECHADA` de {@link ./unidade-de-trabalho.ts} nomeia como o aninhamento
 * **correto**. Ele **não** contraria aquele marcador: o que a marca recusa é abrir uma segunda
 * unidade (outra conexão, outra transação, com `COMMIT` próprio), e aqui não se abre nenhuma. O
 * desfazimento alcança **só** a instrução recusada — o que a unidade já gravou antes dela permanece,
 * e é o `CT-310 (c)` de `test/unidade-de-trabalho.spec.ts` que mede esse alcance.
 *
 * **Isto não é leitura-antes-de-gravar.** Quando {@link lerConflitoDoDocumento} corre, a recusa já
 * aconteceu: o mecanismo da unicidade continua sendo a restrição do banco, e a leitura serve para uma
 * coisa só — dizer ao usuário se o caminho é **reativar** o cadastro retirado que ocupa o documento
 * ou **recadastrar** com outro, que é a consequência que a ADR-0014 nomeia entre os *Cons*.
 *
 * Toda violação que **não** seja a da restrição do papel informado é **repassada intacta**. Traduzir
 * `23505` em bloco atribuiria à entrada do cliente uma colisão de outra restrição — e a esconderia
 * atrás de um `422` plausível, que é a pior forma de perder um defeito.
 *
 * O tipo é **concreto**, e não genérico, pela mesma razão medida em {@link ./imovel.ts}: as duas
 * escritas que ela envolve devolvem a mesma linha, e o parâmetro de tipo obrigaria a converter o
 * `UnwrapPromiseArray` do driver — uma conversão no caminho da tradução de erro é justamente onde ela
 * não deve existir. A ausência de linha é possível porque {@link alterarPessoa} a devolve quando o
 * contexto não alcança o cadastro; quem a interpreta é a borda.
 */
export async function gravarCadastroSobRestricaoDeUnicidade(
  tx: TransactionSql,
  papel: PapelDePessoa,
  documentoPrincipal: string,
  escrever: (escrita: TransactionSql) => Promise<PessoaCadastrada | undefined>,
): Promise<PessoaCadastrada | undefined> {
  try {
    return await tx.savepoint(async (escrita) => await escrever(escrita));
  } catch (erro) {
    if (!ehViolacaoDoDocumento(erro, papel)) {
      throw erro;
    }

    throw new ErroDeDocumentoEmUso(await lerConflitoDoDocumento(tx, papel, documentoPrincipal));
  }
}

/**
 * Reconhece a recusa da restrição `unique(empresa_id, documento_principal)` **daquele papel**.
 *
 * A leitura é por **forma**, e não por `instanceof`: o erro do servidor chega como objeto do driver,
 * e o par (`code`, `constraint_name`) é o contrato do protocolo — os mesmos dois campos que
 * `test/cadastro-de-pessoa.spec.ts` já lê. Casar pelo texto da mensagem seria amarrar a tradução ao
 * idioma configurado no servidor.
 *
 * O papel entra na comparação, e não só o `SQLSTATE`: sem ele, uma violação da restrição de **outra**
 * tabela — possível numa composição futura que escreva mais de um papel na mesma unidade — viraria
 * "documento em uso" no papel errado.
 */
function ehViolacaoDoDocumento(erro: unknown, papel: PapelDePessoa): boolean {
  const falha = erro as { code?: unknown; constraint_name?: unknown } | null;

  return (
    falha?.code === VIOLACAO_DE_UNICIDADE && falha.constraint_name === RESTRICAO_DO_DOCUMENTO[papel]
  );
}

/**
 * Lê o estado do cadastro que já ocupa o documento — **depois** de o banco ter recusado.
 *
 * O documento é normalizado pela **mesma** função da escrita ({@link comDocumentoNormalizado} usa
 * `somenteDigitos`): a coluna guarda só dígitos, e comparar com a grafia que o cliente digitou não
 * acharia a linha em conflito quando ela chegou mascarada — o discriminador ficaria sem estado a
 * relatar justamente no caso que o `CT-352` já provou ser real.
 *
 * Não há `WHERE empresa_id` aqui, e não pode haver: a linha em conflito é necessariamente da empresa
 * do contexto — é a própria restrição, que tem `empresa_id` na chave, que o garante —, e a política
 * já recorta a leitura. A ausência de linha é, portanto, estado impossível: ela levanta com nome, em
 * vez de escolher um discriminador por omissão e afirmar ao usuário algo que ninguém apurou.
 */
async function lerConflitoDoDocumento(
  tx: TransactionSql,
  papel: PapelDePessoa,
  documentoPrincipal: string,
): Promise<ConflitoDeDocumento> {
  const [emConflito] = await tx<{ retiradoEm: Date | null }[]>`
    SELECT retirado_em AS "retiradoEm"
      FROM ${tabelaDoPapel(tx, papel)}
     WHERE documento_principal = ${somenteDigitos(documentoPrincipal)}
  `;

  if (emConflito === undefined) {
    throw new Error(
      'a restrição de unicidade recusou a gravação e o cadastro em conflito não é alcançável',
    );
  }

  return emConflito.retiradoEm === null ? 'EM_CIRCULACAO' : 'RETIRADO_DE_CIRCULACAO';
}
