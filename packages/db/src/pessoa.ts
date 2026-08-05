/**
 * Ciclo de vida das pessoas de uma empresa — a camada de dados das rotas do Admin.
 *
 * ---------------------------------------------------------------------------
 * POR QUE ESTAS OPERAÇÕES MORAM AQUI, E NÃO NO SERVIÇO QUE AS CHAMA
 * ---------------------------------------------------------------------------
 *
 * Pela mesma razão que {@link ./empresa.ts} registra por extenso: a contenção da §11.2 da tech spec
 * da fatia anterior é de **tipo** e, como o item 3 do cabeçalho de {@link ./acesso-identidade.ts}
 * declara, **não alcança texto de SQL**. Um serviço de aplicação com o executor da unidade de
 * trabalho em mãos escreve `identidade.usuario` numa cadeia sem importar nada de proibido, e o
 * alcance às sete tabelas daquele schema deixa de ser enumerável.
 *
 * Toda instrução que o ciclo de vida das pessoas precisa vive aqui, publicada como função de
 * domínio. A pergunta que o índice do pacote força, e a resposta: **isto é um caminho para dado fora
 * da unidade de trabalho? NÃO.** Todas as funções **recebem** o executor (`tx`) de quem já abriu a
 * unidade; nenhuma abre conexão, reserva ou transação, e nenhuma devolve executor.
 *
 * ---------------------------------------------------------------------------
 * O ESCOPO DE TENANT VEM DO BANCO — as duas formas, e por que são duas (ADR-0008)
 * ---------------------------------------------------------------------------
 *
 * Nenhuma função deste arquivo recebe `empresaId` por parâmetro, e nenhuma compara empresa com coisa
 * alguma escrita na aplicação. **O identificador da empresa não passa pela aplicação em momento
 * algum** — é a mesma propriedade que {@link ./permissao.ts} sustenta, e ela é obtida aqui por duas
 * vias, porque os dois schemas têm regimes diferentes (ADR-0009):
 *
 *   1. **Pelo VÍNCULO, sob a política** — é a forma de tudo que alcança uma pessoa *identificada*:
 *      {@link localizarPessoaDoContexto}, {@link definirAtivoDaPessoa},
 *      {@link encerrarSessoesDaPessoa} e {@link contarAjustesDaPessoa} chegam à pessoa **através de**
 *      `negocio.acesso_usuario_app`, que está sob RLS forçada. Sob o contexto da empresa A, o
 *      vínculo de B simplesmente não existe: a consulta devolve zero linhas, e quem chama traduz a
 *      ausência em `404`. **A recusa é consequência de não achar, não de ter comparado** — e é isso
 *      que o `CT-230` verifica, asserindo o corpo inteiro da recusa e o estado inalterado de B.
 *
 *   2. **Pela VARIÁVEL DE SESSÃO que a própria política lê** — é a forma de
 *      {@link listarPessoasDaEmpresa} e de {@link garantirVinculoDeAcesso}, as duas consultas que
 *      leem `identidade.usuario`, que não tem política a aplicar. A listagem precisa alcançar
 *      **toda** pessoa da empresa, inclusive quem ainda não tem vínculo (ver o bloco seguinte); a
 *      garantia do vínculo precisa decidir se a pessoa É da empresa do contexto **antes** de a linha
 *      do vínculo existir — e enquanto ela não existe, não há vínculo pelo qual chegar. O recorte usa
 *      `nullif(current_setting('app.empresa_id', true), '')::uuid` — **a expressão literal das
 *      políticas de `migracoes/0001_seguranca.sql`**, e não uma segunda regra escrita aqui. O valor
 *      é o que a unidade de trabalho fixou com `SET LOCAL` a partir do contexto que a guarda
 *      publicou **da sessão**; ele não é argumento, não vem do pedido e não trafega pela aplicação.
 *      Sem contexto — o caso do Sysloc Master —, a comparação vira `empresa_id = NULL` e o resultado
 *      é vazio, exatamente como a política produziria.
 *
 * A alternativa "listar pela junção com o vínculo" foi descartada por ser **incorreta**, e não por
 * gosto: ela omitiria da listagem a pessoa sem vínculo, que é justamente a que o Admin precisa
 * enxergar para administrá-la.
 *
 * ---------------------------------------------------------------------------
 * Onde o vínculo NASCE — e por que {@link garantirVinculoDeAcesso} existe
 * ---------------------------------------------------------------------------
 *
 * `negocio.acesso_usuario_app` está sob RLS forçada, e gravar a linha exige contexto de tenant. A
 * rota do Master que admite o primeiro Admin (`POST /v1/master/empresas/:id/admin`) **não pode**
 * gravá-la: o identificador da empresa ali vem do **caminho da requisição**, e derivar o contexto de
 * RLS do pedido é o que a ADR-0008 proíbe por escrito e o mutante que o `CT-014` reprova. Era o
 * débito `D32 · F1/T7`, e ele fecha com três peças, todas sob o contexto que a guarda publica **da
 * sessão**:
 *
 *   * **quem nasce pela rota do Admin** ganha o vínculo no ato da criação;
 *   * **quem age** ganha o próprio vínculo, idempotente, no ponto em que o contexto é estabelecido;
 *   * **quem é ALVO de uma rota de `:id`** ganha o vínculo antes de a rota tentar alcançá-lo — é
 *     esta peça que alcança quem a rota do Master criou e que **ainda não agiu**. Sem ela, a pessoa
 *     admitida pelo Master aparecia na listagem (que lê `identidade.usuario`) e respondia `404` nas
 *     cinco rotas de `:id` (que chegam pelo vínculo): ninguém conseguia desativá-la, e **o acesso
 *     dela não podia ser revogado**. Entrar e trocar a senha não criam vínculo — nenhuma das duas
 *     passa pelo contexto de tenant —, então "ele age antes" não era garantia de coisa alguma.
 *
 * As três são a MESMA função, {@link garantirVinculoDeAcesso}, e ela toma `empresa_id` do **próprio
 * registro da pessoa** (`SELECT u.empresa_id FROM identidade.usuario`), nunca de um argumento: a
 * política decide se a linha pode nascer, com a mesma expressão de sempre, e a aplicação não tem
 * como propor uma empresa.
 */

import type { Fragment, TransactionSql } from 'postgres';
import type { PerfilDaPessoa } from './esquema/identidade.js';

/** A janela pedida da listagem, já validada na borda. */
export interface JanelaDePessoas {
  readonly limite: number;
  readonly deslocamento: number;
}

/** Uma linha de `identidade.usuario`, na projeção que o contrato de pessoas publica. */
export interface PessoaPersistida {
  readonly id: string;
  readonly nome: string;
  readonly email: string;
  readonly perfil: PerfilDaPessoa;
  readonly ativo: boolean;
}

/** A página lida, com o total do conjunto inteiro — os dois da MESMA transação. */
export interface PaginaDePessoasPersistidas {
  readonly pessoas: readonly PessoaPersistida[];
  readonly total: number;
}

/**
 * A pessoa **alcançada pelo vínculo**, isto é, sob a política.
 *
 * O tipo é distinto de {@link PessoaPersistida} de propósito: aquele descreve uma linha da listagem,
 * este descreve o desfecho de uma resolução que pode não achar. Fundi-los faria a ausência de
 * vínculo — que é a fronteira de tenant — parecer uma linha que simplesmente não veio na página.
 */
export interface PessoaDoContexto {
  readonly id: string;
  readonly nome: string;
  readonly email: string;
  readonly perfil: PerfilDaPessoa;
  readonly ativo: boolean;
}

/**
 * A empresa do contexto, **na expressão literal das políticas de `0001_seguranca.sql`**.
 *
 * Escrita uma vez e reusada pelas três consultas que leem `identidade.usuario` — as duas da listagem
 * e a de {@link garantirVinculoDeAcesso} —, para que não existam leituras da variável de sessão
 * livres para divergir. O `true` de `current_setting` é o que faz a variável não
 * fixada devolver nulo em vez de levantar erro, e o `nullif(…, '')` trata o outro caminho, o da
 * variável fixada em cadeia vazia — a mesma escolha, e a mesma razão, da migração: **contexto
 * ausente resulta em vazio, nunca em dado alheio**.
 *
 * É um **fragmento** do driver (`tx`...``), e não uma cadeia interpolada: ele é montado pelo mesmo
 * mecanismo da consulta que o hospeda, de modo que nenhum texto entra na instrução por concatenação
 * — mesmo padrão, e mesma justificativa, de `colunasDaEmpresa` em {@link ./empresa.ts}. Nada aqui
 * vem de fora: o fragmento é constante deste módulo, sem interpolação alguma.
 *
 * Ela **não é um filtro redundante sobre `negocio`**: nenhuma consulta deste arquivo a aplica a
 * tabela que já tem política. Ela existe para `identidade.usuario`, que por decisão da ADR-0009 não
 * tem política alguma — e ali ela não duplica caminho nenhum, ela **é** o caminho. Em
 * {@link garantirVinculoDeAcesso} isso vale com força ainda maior: ali a linha do vínculo **ainda
 * não existe**, então não há política de `negocio` a consultar sobre a pessoa — a única forma de
 * saber se ela é da empresa do contexto é perguntar à variável que a própria política leria.
 */
function empresaDoContexto(tx: TransactionSql): Fragment {
  return tx`nullif(current_setting('app.empresa_id', true), '')::uuid`;
}

/**
 * Lê uma página de pessoas da empresa do contexto e o total do conjunto, na **mesma transação**.
 *
 * Lidos separadamente, o total poderia descrever um conjunto do qual a página já não faz parte, e o
 * cliente pagina sobre dois retratos — mesma razão de `listarEmpresas`, em {@link ./empresa.ts}.
 *
 * A ordem é `nome, id`, e o desempate importa: `nome` sozinho empata entre homônimos, e um empate
 * faz a mesma linha aparecer em duas páginas — ou em nenhuma.
 *
 * **Alcança todas as pessoas da empresa**, de qualquer perfil, inclusive outros administradores e
 * inclusive quem está desativado — é o alcance que o glossário-feature canoniza para a área de tela
 * `Usuários`, e é o que permite reativar quem foi desativado.
 *
 * Sem contexto de tenant, devolve vazio: ver o cabeçalho deste arquivo.
 */
export async function listarPessoasDaEmpresa(
  tx: TransactionSql,
  janela: JanelaDePessoas,
): Promise<PaginaDePessoasPersistidas> {
  const pessoas = await tx<PessoaPersistida[]>`
    SELECT id,
           nome,
           email,
           perfil::text AS perfil,
           ativo
      FROM identidade.usuario
     WHERE empresa_id = ${empresaDoContexto(tx)}
     ORDER BY nome, id
     LIMIT ${janela.limite}
    OFFSET ${janela.deslocamento}
  `;

  const [contagem] = await tx<{ total: string }[]>`
    SELECT count(*) AS total
      FROM identidade.usuario
     WHERE empresa_id = ${empresaDoContexto(tx)}
  `;

  // `count(*)` volta como `bigint`, que o driver entrega em cadeia de caracteres. A conversão
  // explícita é o que impede o total de viajar como texto no JSON.
  return { pessoas, total: Number(contagem?.total ?? 0) };
}

/**
 * Localiza a pessoa **pelo vínculo de acesso** — a fronteira de tenant das rotas de `:id`.
 *
 * Devolve `undefined` quando não há vínculo alcançável sob o contexto corrente, e as duas causas são
 * deliberadamente **indistinguíveis**: a pessoa não existe, ou existe e é de outra empresa. A borda
 * traduz a ausência em `404 RECURSO_NAO_ENCONTRADO` — a recusa é consequência de não achar, e não de
 * uma comparação de empresa escrita na aplicação (ADR-0008, `CT-230`).
 *
 * Ela é chamada **antes** de qualquer escrita nas rotas que alteram estado: recusar aqui é o que faz
 * "operação recusada não deixa efeito colateral" ser propriedade da ordem, e não do acaso.
 */
export async function localizarPessoaDoContexto(
  tx: TransactionSql,
  usuarioId: string,
): Promise<PessoaDoContexto | undefined> {
  const [pessoa] = await tx<PessoaDoContexto[]>`
    SELECT u.id AS id,
           u.nome AS nome,
           u.email AS email,
           u.perfil::text AS perfil,
           u.ativo AS ativo
      FROM negocio.acesso_usuario_app AS a
      JOIN identidade.usuario AS u ON u.id = a.usuario_id
     WHERE a.usuario_id = ${usuarioId}
  `;

  return pessoa;
}

/**
 * Liga ou desliga o acesso da pessoa, e devolve o estado novo. `undefined` quando não alcançada.
 *
 * A escrita é em `identidade.usuario`, que não tem RLS — e é por isso que ela alcança a pessoa
 * **através do vínculo**, exatamente como `incrementarVersaoPermissoes` faz em
 * {@link ./permissao.ts}. Uma escrita por `WHERE u.id = $1` sozinha alcançaria pessoa de qualquer
 * empresa; o `FROM negocio.acesso_usuario_app` é o que põe a política no caminho.
 *
 * Ela **liga e desliga a mesma coluna**, em vez de duas funções, porque desativar e reativar são o
 * mesmo fato com valores opostos: duas instruções ficariam livres para divergir no alcance — e é
 * precisamente o alcance que carrega a fronteira de tenant aqui.
 *
 * **Ela marca e nada mais**: quem encerra as sessões é {@link encerrarSessoesDaPessoa}, chamada na
 * mesma transação por quem abriu a unidade. Fundir as duas esconderia da borda o número que o
 * contrato publica como prova do encerramento — e faria a reativação carregar um encerramento que a
 * RN-05 não pede.
 */
export async function definirAtivoDaPessoa(
  tx: TransactionSql,
  usuarioId: string,
  ativo: boolean,
): Promise<boolean | undefined> {
  const [linha] = await tx<{ ativo: boolean }[]>`
    UPDATE identidade.usuario AS u
       SET ativo = ${ativo}
      FROM negocio.acesso_usuario_app AS a
     WHERE a.usuario_id = u.id
       AND u.id = ${usuarioId}
    RETURNING u.ativo AS ativo
  `;

  return linha?.ativo;
}

/**
 * Apaga os registros de sessão **de uma pessoa**, e devolve quantos foram.
 *
 * ---------------------------------------------------------------------------
 * POR PESSOA, e não por empresa — a diferença é o eixo do `CT-228`
 * ---------------------------------------------------------------------------
 *
 * A irmã de {@link ./empresa.ts}, `encerrarSessoesDaEmpresa`, alcança todas as pessoas da empresa
 * porque quem a chama suspendeu a empresa inteira. Aqui o evento é a desativação de **uma** pessoa, e
 * o encerramento tem de parar nela: a colega da mesma empresa continua operando, e o `CT-228` exige
 * que ela responda `2xx` no mesmo instante. Uma implementação que encerrasse por empresa passaria em
 * todas as asserções sobre a desativada e reprovaria ali — que é exatamente o motivo de o caso
 * carregar a colega.
 *
 * O alcance vem do **vínculo**, como o de {@link definirAtivoDaPessoa}: `identidade.sessao` não tem
 * política, e é o `USING negocio.acesso_usuario_app` que a põe no caminho.
 *
 * Recebe o executor da transação em vez de abrir unidade própria — é a forma que o docblock de
 * `ErroDeUnidadeAninhada` chama de *"unidade na borda"* e declara preferida, e é o que faz a
 * desativação e o encerramento serem **um commit só** (RN-04, decisão D5 do tech-alignment).
 *
 * Devolve a **contagem das linhas efetivamente apagadas**, e não uma estimativa: é ela que distingue
 * *"encerrada"* de *"marcada"*, e sem ela o caso passaria com uma implementação que apenas marca.
 */
export async function encerrarSessoesDaPessoa(
  tx: TransactionSql,
  usuarioId: string,
): Promise<number> {
  const apagadas = await tx<{ id: string }[]>`
    DELETE FROM identidade.sessao AS s
     USING negocio.acesso_usuario_app AS a
     WHERE a.usuario_id = s.usuario_id
       AND s.usuario_id = ${usuarioId}
    RETURNING s.id AS id
  `;

  return apagadas.length;
}

/**
 * Quantos ajustes individuais a pessoa tem hoje — **todas as linhas**, não só as do catálogo.
 *
 * É o número que a recusa da troca de perfil publica em `detalhes.ajustesDescartados` (RN-11), e ele
 * conta o que de fato será apagado: `trocarPerfilDaPessoa` remove **todas** as linhas do vínculo,
 * inclusive uma chave órfã de um catálogo anterior. Contar pelo catálogo corrente informaria ao
 * Admin um número menor que a perda real — a recusa existe justamente para que ele decida sabendo o
 * tamanho dela.
 *
 * O alcance é o do vínculo, sob a política: pessoa de outra empresa devolve zero, pelo mesmo caminho
 * que todo o resto deste arquivo.
 */
export async function contarAjustesDaPessoa(
  tx: TransactionSql,
  usuarioId: string,
): Promise<number> {
  const [contagem] = await tx<{ total: string }[]>`
    SELECT count(*) AS total
      FROM negocio.acesso_usuario_permissao AS p
      JOIN negocio.acesso_usuario_app AS a ON a.id = p.acesso_id
     WHERE a.usuario_id = ${usuarioId}
  `;

  return Number(contagem?.total ?? 0);
}

/**
 * Garante, **idempotentemente**, o vínculo de acesso de uma pessoa cuja empresa É a do contexto.
 *
 * ---------------------------------------------------------------------------
 * O que ela fecha: o `D32 · F1/T7`
 * ---------------------------------------------------------------------------
 *
 * O Admin admitido por `POST /v1/master/empresas/:id/admin` nasce **sem vínculo**, e a omissão está
 * certa — ver o cabeçalho deste arquivo. A consequência é que ele fica fora do alcance de toda
 * operação que chega a uma pessoa **pelo** vínculo: nenhum outro Admin conseguiria ajustar as
 * permissões dele, trocar o perfil dele, desativá-lo ou reativá-lo.
 *
 * **Uma função, três chamadores** — e é deliberado que sejam a mesma, porque são a mesma instrução e
 * a mesma garantia; três cópias ficariam livres para divergir no alcance, que é justamente onde a
 * fronteira de tenant mora:
 *
 *   1. **a pessoa recém-criada** por `POST /v1/usuarios`, na transação da criação. Quem chama acabou
 *      de criá-la com a empresa da própria sessão, então a empresa dela É o contexto;
 *   2. **quem age**, no ponto em que o contexto é estabelecido para uma operação de administração de
 *      pessoas. A empresa de quem age É o contexto por construção: a guarda derivou o contexto da
 *      linha dessa mesma pessoa;
 *   3. **a pessoa ALVO de uma rota de `:id`**, no mesmo ponto único por onde as cinco rotas abrem a
 *      unidade de trabalho e **antes** de qualquer resolução ou escrita. É este chamador que fecha a
 *      revogação de acesso de quem a rota do Master criou e **nunca agiu** — caso que os dois
 *      primeiros não alcançam, porque entrar e trocar a senha não estabelecem contexto de tenant.
 *
 * ---------------------------------------------------------------------------
 * O RECORTE PELA EMPRESA DO CONTEXTO — o que torna o chamador 3 possível
 * ---------------------------------------------------------------------------
 *
 * O alvo é a única das três posições em que a pessoa **pode não ser da empresa do contexto**, e a
 * fronteira que o `CT-230` prova exige que esse caso produza `404`, nunca um erro. É o que o
 * `AND u.empresa_id = <empresa do contexto>` garante, e ele é **a expressão literal das políticas**
 * (ver {@link empresaDoContexto}), não uma segunda regra escrita aqui:
 *
 *   * alvo de outra empresa ⇒ o `SELECT` devolve zero linhas ⇒ **nenhuma linha é inserida**, e a
 *     política sequer é provocada. A resolução seguinte continua devolvendo `undefined` e a rota
 *     continua respondendo `404 RECURSO_NAO_ENCONTRADO`, indistinguível de "não existe";
 *   * sem o recorte, o mesmo alvo produziria `empresa_id = B` sob o contexto de A e o `WITH CHECK`
 *     recusaria a gravação — um **erro**, onde o contrato manda `404`. O recorte é o que troca a
 *     recusa da política por ausência de linha, que é a forma que a fronteira já tem em todo o resto
 *     deste arquivo.
 *
 * `empresa_id` continua saindo do **próprio registro da pessoa**, dentro da instrução: o recorte
 * compara duas coisas que já estão no banco, e o identificador da empresa segue sem passar pela
 * aplicação.
 *
 * ---------------------------------------------------------------------------
 * A idempotência é do BANCO — e o que esse argumento refuta, e o que ele NÃO refuta
 * ---------------------------------------------------------------------------
 *
 * São duas coisas diferentes, e confundi-las fecha uma porta que não precisava fechar:
 *
 *   1. **A leitura prévia como MECANISMO de idempotência está refutada**, e a razão é a corrida: duas
 *      requisições concorrentes leem *"não existe"* e ambas inserem. Quem garante a unicidade é o
 *      banco, com `ON CONFLICT DO NOTHING`, e nenhum arranjo na aplicação substitui isso;
 *   2. **um caminho rápido de leitura ANTES da mesma escrita NÃO está refutado** por aquele
 *      argumento, porque os dois **compõem**: um `SELECT 1 …` sob a política e, só na ausência, o
 *      `INSERT … ON CONFLICT DO NOTHING` que já está aqui. A corrida continuaria coberta pelo
 *      `ON CONFLICT`; a leitura só pouparia a escrita no caso comum, em que o vínculo já existe.
 *
 * **A escrita incondicional foi preferida assim mesmo, e por medida de volume.** Esta função roda em
 * toda requisição das sete rotas do Admin — inclusive nos dois `GET` —, e o caminho rápido trocaria
 * **uma** instrução por **duas** no caso em que o vínculo falta, para poupar uma inserção que não
 * insere nada no caso em que ele existe. Na escala deste produto — dezenas a poucas centenas de
 * empresas — isso não paga: nem o custo medido justifica, nem a segunda instrução é de graça (ela é
 * mais uma ida ao banco por requisição). Se algum dia o volume mudar a conta, o caminho rápido entra
 * **sem alterar a garantia**, porque ele não a substitui — é por isso que este parágrafo o deixa
 * declarado em vez de rejeitado.
 *
 * O `ON CONFLICT` **nomeia a restrição** do par empresa/pessoa — sem alvo, ele absorveria em silêncio
 * qualquer unicidade acrescentada à tabela no futuro, e a repetição passaria a esconder uma colisão
 * que não é a do vínculo.
 *
 * A cláusula `empresa_id IS NOT NULL` cobre o Sysloc Master, que não pertence a empresa alguma: ele
 * não alcança estas rotas (a matriz dele é vazia, ADR-0011), e se alcançasse nada seria gravado, em
 * vez de a instrução falhar por coluna não nula. Ela **sobrevive ao recorte** de propósito, apesar de
 * o recorte já excluir a linha de `empresa_id` nulo: as duas cláusulas defendem coisas diferentes —
 * uma, que nenhuma linha nasça com empresa nula; a outra, que nenhuma linha nasça com empresa alheia
 * — e fundi-las faria a primeira depender da forma da segunda.
 */
export async function garantirVinculoDeAcesso(
  tx: TransactionSql,
  usuarioId: string,
): Promise<void> {
  await tx`
    INSERT INTO negocio.acesso_usuario_app (empresa_id, usuario_id)
    SELECT u.empresa_id, u.id
      FROM identidade.usuario AS u
     WHERE u.id = ${usuarioId}
       AND u.empresa_id IS NOT NULL
       AND u.empresa_id = ${empresaDoContexto(tx)}
    ON CONFLICT ON CONSTRAINT acesso_usuario_app_empresa_usuario_key DO NOTHING
  `;
}
