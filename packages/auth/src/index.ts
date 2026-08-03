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
 * construtor de consulta do ORM, e é o que mantém topológica (e não disciplinar) a contenção que a
 * §11.2 da tech spec exige na ausência de RLS em `identidade`.
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
  DURACAO_DO_BLOQUEIO_EM_MINUTOS,
  type EstadoDeBloqueio,
  estaBloqueada,
  LIMITE_DE_FALHAS_CONSECUTIVAS,
  limparBloqueio,
  registrarFalha,
} from './bloqueio.js';
export { PERFIS, type Perfil } from './perfis.js';
export {
  type AvaliacaoDeSenha,
  COMPRIMENTO_DE_REPETICAO_PROIBIDA,
  COMPRIMENTO_DE_SEQUENCIA_PROIBIDA,
  COMPRIMENTO_MINIMO_DE_SENHA,
  type MotivoDeRecusaDeSenha,
} from './senha.js';
