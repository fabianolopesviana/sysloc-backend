/**
 * Superfície pública do pacote de identidade.
 *
 * ---------------------------------------------------------------------------
 * O que NÃO entra aqui
 * ---------------------------------------------------------------------------
 *
 * A §3.3 da tech spec fixa a fronteira: `@sysloc/auth` exporta a instância configurada e — a partir
 * da T7 — a barreira de admissão; **não exporta** os caminhos internos do arcabouço que criam
 * sessão. Nada aqui devolve sessão, token ou cookie: quem precisa disso passa pelas rotas do
 * arcabouço, que a instância monta, e não por um atalho de biblioteca.
 *
 * A barreira sai daqui **inteira** — o desfecho, os cinco predicados e a recusa canônica —, e nada
 * dela emite sessão: ela apenas **decide**. Quem a liga ao ponto de emissão é `autenticacao.ts`, e
 * o carregador de estado (`carregarEstadoDeAdmissao`) fica de fora de propósito: ele é a leitura que
 * a ligação faz, não uma capacidade que outro pacote deva chamar. `RECUSA_DE_CREDENCIAL` sai porque
 * a indistinguibilidade da RN-10 é afirmada de fora (T11), e uma segunda cadeia literal escrita à
 * mão para afirmá-la seria duas definições da mesma coisa, livres para divergir.
 *
 * `carregarPessoaDaSessao` **sai**, e isso NÃO contradiz o parágrafo acima: são leituras de papéis
 * diferentes. Aquela é interna à ligação — quem a chamasse de fora estaria emitindo sessão por
 * atalho. Esta é a leitura do **consumidor legítimo declarado** em `packages/db/src/contexto.ts`:
 * a guarda de contexto de `apps/api`, que precisa da pessoa por trás de uma sessão que o arcabouço
 * JÁ conferiu. Ela sai daqui exatamente para que a consulta a `identidade` continue sendo uma só,
 * escrita num lugar só — publicá-la é o que dispensa `apps/api` de conhecer `esquemaIdentidade` e o
 * construtor de consulta do ORM, e é o que sustenta a contenção que a §11.2 da tech spec exige na
 * ausência de RLS em `identidade`.
 *
 * **A barreira concreta, e o resíduo — em vez de "a contenção é topológica".** O que de fato contém
 * é `TOKEN_ACESSO_A_IDENTIDADE` ficar **fora do `exports:` de `AutenticacaoModule`**
 * (`apps/api/src/autenticacao/autenticacao.module.ts`): nenhum módulo de fora recebe o executor
 * restrito, e sem ele não há consulta a `identidade` para escrever. Isso é estrutura, e é forte.
 *
 * O que ela **não** alcança: de dentro daquele módulo, um provider novo pode ler a linha por
 * `acesso.identidade.query.usuario.findFirst({ where: (u, { eq }) => … })`. A API relacional do
 * Drizzle entrega tabela e operadores **por callback**, de modo que a leitura nova não precisa
 * importar `drizzle-orm` nem `esquemaIdentidade` — e nenhuma prova atual a alcança. Quem acrescentar
 * provider ali confere isto à mão; a palavra "topológica", sozinha, faria supor que não precisa.
 *
 * Também não sai daqui nenhum acesso a banco. O executor restrito é de `@sysloc/db`, entra por
 * parâmetro em `criarAutenticacao` e não é reexportado — reexportá-lo criaria um segundo caminho
 * para o mesmo objeto, e o consumidor passaria a escolher entre dois especificadores para a mesma
 * coisa.
 *
 * Das três capacidades que o arcabouço não oferece, **duas** saem, porque é para isso que elas
 * existem: o bloqueio e a trilha são chamados pela barreira de admissão (T7). A terceira — a
 * política de força de senha — **não sai**, e a distinção é a que este índice existe para manter:
 * ela é aplicada **internamente**, pelo próprio gancho de `autenticacao.ts`, que é onde alcança a
 * CLASSE "definição de senha" e não um caminho HTTP (T10 / Gate 2). Nenhum pacote de fora a chama,
 * e publicá-la seria superfície mais larga que o critério que este pacote se impõe — o mesmo que
 * mantém `DURACAO_DA_SESSAO_EM_SEGUNDOS` e `CAMINHOS_QUE_DEFINEM_SENHA` fora daqui: **a superfície
 * publicada é a das capacidades que os outros pacotes chamam.** `avaliarForcaDeSenha` e
 * `PessoaDaSenha` seguem exportados de `senha.ts`, que é de onde o gancho e o `test/senha.spec.ts`
 * os leem.
 *
 * O que sai da política é o **vocabulário** da recusa, não a função: `MotivoDeRecusaDeSenha`,
 * `AvaliacaoDeSenha` e os `COMPRIMENTO_*` são contrato da API, porque o rótulo é o que viaja em
 * `detalhes.motivos` — afirmado por asserção no CT-022 —, e o consumidor que classifica a recusa
 * precisa do enum, não do texto.
 *
 * `RECUSA_DE_CAMPO_INVALIDO` **sai** pelo mesmo critério de `RECUSA_DE_CREDENCIAL`, e a pergunta
 * que este índice existe para forçar foi feita: **isto emite sessão? NÃO.** É o `code` com que as
 * validações de produto recusam, no vocabulário do arcabouço, para que `apps/api` monte o envelope
 * da ADR-0007 a partir dele em vez de reconhecer a recusa por um segundo literal escrito à mão.
 *
 * `limparMarcaDeSenhaProvisoria` **sai** pelo mesmo critério de `carregarPessoaDaSessao`, e com o
 * mesmo cuidado: ela não emite sessão nem confere credencial — baixa a marca que o predicado
 * `senhaProvisoriaPendente` lê, depois de a troca ter sido aceita, e existe aqui para que o par
 * "quem lê a marca" e "quem a baixa" continue num arquivo só. Publicá-la é o que dispensa
 * `apps/api` de escrever em `identidade` conhecendo o schema e o construtor de consulta do ORM.
 *
 * ---------------------------------------------------------------------------
 * O domínio da autorização sai INTEIRO — e a pergunta de sempre foi feita
 * ---------------------------------------------------------------------------
 *
 * A fatia `autorizacao-e-ciclo-de-acesso` acrescenta o catálogo fechado, a matriz por perfil e o
 * cálculo do efetivo. **Isto emite sessão? NÃO** — nenhum dos três toca banco, relógio ou
 * requisição: são constantes e duas funções puras. O critério que este índice se impõe é o das
 * **capacidades que os outros pacotes chamam**, e aqui os três consumidores estão nomeados: a
 * guarda de `apps/api` calcula o efetivo e decide (ADR-0011), a rota de ajuste valida a coerência
 * antes de escrever (RN-02), e a rota de sessão publica o conjunto para o cliente desenhar o menu
 * (CA-19). Nenhum deles pode reimplementar a precedência da negação por conta própria sem criar uma
 * segunda definição da ADR-0010, livre para divergir da que o CT-203 prova.
 *
 * `ehChaveDoCatalogo` sai pela mesma razão de `RECUSA_DE_CAMPO_INVALIDO`: é o que a borda usa para
 * recusar chave inventada, e o alternativo seria `apps/api` conhecer a forma literal da chave.
 * `MAPA_ACAO_TELA` sai porque o cliente precisa dele para não oferecer uma ação cuja área ele não
 * liberou — a mesma dependência que a validação impõe do lado do servidor.
 *
 * `ChaveDeTela` e `ChaveDeAcao` saem junto de `ChaveDoCatalogo`: o efetivo viaja **repartido** nos
 * dois eixos — no registro de sessão e no contrato do `GET /v1/sessao` —, e sem os dois tipos a
 * borda declararia os arranjos publicados como `string[]`, perdendo exatamente a checagem que o
 * catálogo fechado existe para dar.
 *
 * ---------------------------------------------------------------------------
 * A autorização sai INTEIRA — inclusive as duas funções que tocam `identidade.sessao`
 * ---------------------------------------------------------------------------
 *
 * `decidirAcesso` e o tipo `Exigencia` saem pelo motivo do parágrafo anterior levado ao fim: a
 * guarda de `apps/api` é o **ponto único de aplicação** (ADR-0011), e ela consulta a decisão em vez
 * de reescrevê-la — uma segunda definição de "o que esta rota exige" dentro do ponto onde ela é
 * aplicada é a topologia que a §5 de `.claude/rules/nao-regressao.md` nomeia. **Isto emite sessão?
 * NÃO**: é função pura, sem banco, sem pedido e sem relógio.
 *
 * `repartirEfetivo` sai pela mesma razão, num grau a mais: **isto emite sessão? NÃO** — é função
 * pura sobre um arranjo de chaves. Ela sai porque a rota de ajuste de permissão da T8 devolve o
 * efetivo novo **repartido nos mesmos dois eixos**, e a alternativa a publicá-la era escrevê-la de
 * novo na borda. O docblock dela nomeia a forma que uma segunda escrita quase certamente teria
 * (partir pelo prefixo textual da chave) e a razão de ela estar errada — o eixo é decidido pelo
 * catálogo, não pela grafia. Duas repartições livres para divergir fariam o que a rota devolve e o
 * que a sessão guarda deixarem de ser a mesma coisa.
 *
 * `carregarRetratoDaSessao` e `regravarEfetivoDaSessao` saem pelo MESMO critério de
 * `carregarPessoaDaSessao` e `limparMarcaDeSenhaProvisoria`, e a pergunta foi feita para as duas:
 * **isto emite sessão? NÃO.** Elas leem e reescrevem três colunas de uma sessão que o arcabouço já
 * criou e conferiu; não devolvem token nem cookie, e não decidem admissão. Publicá-las é o que
 * dispensa `apps/api` de conhecer `esquemaIdentidade` e o construtor de consulta do ORM — a mesma
 * contenção que a §11.2 da tech spec exige na ausência de RLS em `identidade` (ADR-0009).
 *
 * ---------------------------------------------------------------------------
 * O onboarding sai — e aqui a pergunta de sempre exige uma resposta mais longa
 * ---------------------------------------------------------------------------
 *
 * `gerarSenhaProvisoria`, `criarPessoa` e `reemitirSenhaProvisoria` saem. **Isto emite sessão?
 * NÃO** — nenhuma das três cria linha em `identidade.sessao`, devolve token ou cookie, ou decide
 * admissão: a pessoa criada precisa ENTRAR depois, pela rota de entrada, e ali a barreira de
 * admissão a recebe como a qualquer outra (e a recebe RESTRITA, porque as duas que escrevem
 * levantam a marca de senha provisória que o predicado `senhaProvisoriaPendente` lê).
 *
 * A resposta é mais longa porque as duas últimas **emitem credencial**, que é a coisa mais próxima
 * de emitir sessão que este pacote publica — e a distinção não é sutileza, é a ADR-0013: emitir
 * credencial para outra pessoa é poder distinto da garantia sobre a sessão de quem emite, aceito e
 * auditado, e não uma contradição com o que a fatia anterior provou sobre a sessão do Master. Elas
 * saem porque os consumidores estão nomeados e são rotas: `POST /v1/master/empresas/:id/admin` e
 * `POST /v1/master/usuarios/:id/senha-provisoria` (T7), e `POST /v1/usuarios` (T8). Nenhuma delas
 * pode criar pessoa por conta própria sem conhecer `internalAdapter`, a derivação de senha do
 * arcabouço e o schema de `identidade` — que é exatamente o que este índice existe para manter do
 * lado de cá.
 *
 * `PessoaNova` **não** sai, pelo critério das capacidades: quem chama monta o objeto no ponto da
 * chamada, e publicar o tipo de entrada não habilita nada que já não esteja habilitado — mesmo
 * tratamento que `PessoaDaSenha` recebe em `senha.ts`.
 */

export {
  type Admissao,
  admitirSessao,
  carregarPessoaDaSessao,
  contaBloqueada,
  type EstadoDeAdmissao,
  empresaSuspensa,
  limparMarcaDeSenhaProvisoria,
  MOTIVOS_DE_RECUSA,
  type MotivoDeRecusa,
  type PessoaDaSessao,
  pessoaDesativada,
  RECUSA_DE_CREDENCIAL,
  RESTRICOES_DE_SESSAO,
  type RestricaoDeSessao,
  segundoFatorExigido,
  senhaProvisoriaPendente,
} from './admissao.js';
export {
  type DesfechoDeTentativa,
  registrarTentativa,
  type TentativaDeEntrada,
} from './auditoria.js';
export {
  type Autenticacao,
  criarAutenticacao,
  type OpcoesDeAutenticacao,
  RECUSA_DE_CAMPO_INVALIDO,
} from './autenticacao.js';
export {
  carregarRetratoDaSessao,
  type DecisaoDeAcesso,
  decidirAcesso,
  type EfetivoDaSessao,
  type Exigencia,
  type PermissoesDaSessao,
  type RetratoDaSessao,
  regravarEfetivoDaSessao,
  repartirEfetivo,
} from './autorizacao.js';
export {
  DURACAO_DO_BLOQUEIO_EM_MINUTOS,
  type EstadoDeBloqueio,
  estaBloqueada,
  LIMITE_DE_FALHAS_CONSECUTIVAS,
  limparBloqueio,
  registrarFalha,
} from './bloqueio.js';
export {
  CHAVES_DE_ACAO,
  CHAVES_DE_TELA,
  type ChaveDeAcao,
  type ChaveDeTela,
  type ChaveDoCatalogo,
  ehChaveDoCatalogo,
  MAPA_ACAO_TELA,
} from './catalogo-de-permissoes.js';
export {
  type AjusteDePermissao,
  calcularEfetivo,
  type EfeitoDePermissao,
  validarCoerenciaDeAjustes,
} from './efetivo.js';
export { MATRIZ_POR_PERFIL } from './matriz-de-perfil.js';
export {
  criarPessoa,
  gerarSenhaProvisoria,
  type PessoaCriada,
  reemitirSenhaProvisoria,
} from './onboarding.js';
export { PERFIS, type Perfil } from './perfis.js';
export {
  type AvaliacaoDeSenha,
  COMPRIMENTO_DE_REPETICAO_PROIBIDA,
  COMPRIMENTO_DE_SEQUENCIA_PROIBIDA,
  COMPRIMENTO_MINIMO_DE_SENHA,
  type MotivoDeRecusaDeSenha,
} from './senha.js';
