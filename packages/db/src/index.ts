/**
 * Superfície pública da camada de dados.
 *
 * ---------------------------------------------------------------------------
 * O que NÃO entra aqui, e é a parte que importa
 * ---------------------------------------------------------------------------
 *
 * `./conexao.js` fica de fora **de propósito**. A §3.3 da tech spec faz da fronteira do pacote um
 * invariante de compilação: nada fora daqui abre conexão nem executa consulta com alcance ao schema
 * `negocio`. Exportar o cliente criaria o segundo caminho para o dado que a ADR-0008 rejeita
 * explicitamente — e é o caminho pelo qual todo filtro por empresa esquecido devolveria dado
 * alheio, em vez de vazio.
 *
 * Os dois schemas, sim, são exportados: eles são declaração de estrutura, não capacidade de acesso.
 * Quem os tem em mãos ainda precisa de um executor para chegar ao banco, e o executor não sai daqui.
 *
 * `./unidade-de-trabalho.js` entra, e é o que torna a ausência acima sustentável: ele publica o
 * acesso a dado sem publicar o executor. O objeto devolvido por `abrirAcessoAoBanco` oferece a
 * transação com contexto já fixado e o encerramento da reserva — e nada mais. É o conjunto fechado
 * que o CT-012 audita por igualdade, e não por contenção: contenção deixaria passar o export
 * acrescentado por descuido, que é exatamente o defeito a barrar.
 *
 * `./acesso-identidade.js` entra, e é a exceção que a própria §3.3 nomeia: a fronteira ali declarada
 * é "a unidade de trabalho, o schema **e um acesso tipado restrito ao schema `identidade`**". Ele
 * não contradiz a ausência acima porque o que ele destrava é `identidade`, que por decisão da
 * ADR-0009 nunca teve política a contornar — e porque o tipo publicado enumera apenas as sete
 * tabelas daquele schema, sem `$client`. O detalhe do que a restrição alcança, e do que ela
 * declaradamente não alcança, está no cabeçalho daquele arquivo.
 *
 * `./catalogo.js` entra pelo mesmo critério, e não o contradiz: a guarda de cobertura publica uma
 * PERGUNTA sobre o catálogo do sistema, não um caminho para dado de negócio. Ela não devolve
 * cliente nem transação, não alcança linha de tabela alguma, e abre e encerra por dentro a conexão
 * que usa. Ela precisa sair daqui porque tem dois consumidores fora do pacote — a suíte e o
 * verificador de infraestrutura, que a invoca pelo especificador público e traduz as exceções em
 * código de saída. A alternativa seria o verificador reimplementar a consulta, que é o antipadrão
 * registrado em `.claude/rules/testing-stack.md`.
 *
 * `./empresa.js` entra pela mesma pergunta, e com a mesma resposta: as oito operações **recebem** o
 * executor de quem já abriu a unidade, não abrem conexão nem transação e não devolvem executor. Elas
 * existem por uma razão a mais, e ela é a que este índice serve: a contenção da §11.2 impede
 * `apps/api` de **importar** `esquemaIdentidade` e o construtor de consulta, mas — como o cabeçalho
 * de `./acesso-identidade.ts` declara no item 3 — não alcança **texto de SQL**. Um serviço de
 * aplicação com o executor da unidade de trabalho em mãos escreve `identidade.usuario` numa cadeia
 * sem importar nada de proibido, e o alcance às sete tabelas deixa de ser enumerável. Publicá-las
 * aqui é o que devolve a enumerabilidade: o nome físico de tabela e de coluna existe num lugar só,
 * o mesmo em que mora a migração que os renomeia.
 *
 * `./permissao.js` entra, e a pergunta que este índice existe para forçar foi feita: **isto é um
 * caminho para dado de negócio fora da unidade de trabalho? NÃO.** As quatro operações **recebem** o
 * executor (`tx`) de quem já abriu a unidade — nenhuma delas abre conexão, reserva ou transação, e
 * nenhuma devolve executor. Elas são o oposto de um atalho: existem para que a leitura e a escrita
 * de ajuste de permissão tenham UM lugar, sob a política, em vez de serem reescritas em cada rota
 * que precise delas. Publicá-las é o que dispensa `apps/api` de conhecer o schema `negocio` e de
 * escrever, por conta própria, a instrução em que um `WHERE` por empresa reapareceria.
 *
 * `./pessoa.js` entra pela mesma pergunta, e com a mesma resposta: as seis operações do ciclo de
 * vida das pessoas **recebem** o executor de quem já abriu a unidade, não abrem conexão nem transação
 * e não devolvem executor. Elas existem pelas duas razões que já sustentam `./empresa.js` e
 * `./permissao.js`, somadas: devolver a **enumerabilidade** do alcance a `identidade` (a contenção da
 * §11.2 é de tipo e não alcança texto de SQL), e dar UM lugar — sob a política — à resolução de
 * pessoa pelo vínculo, em vez de reescrevê-la em cada uma das sete rotas do Admin, onde um `WHERE`
 * por empresa reapareceria.
 *
 * A igualdade é sobre a superfície ACHATADA, e a distinção não é detalhe: as três linhas
 * `export * as …` abaixo publicam tudo o que o módulo de origem exporta, hoje e no futuro. Um
 * conjunto que só comparasse os nomes de topo veria `contextoDeTenant` como UM nome e deixaria
 * passar qualquer símbolo acrescentado a `contexto.ts` — inclusive um cliente. Por isso o CT-012
 * compara `contextoDeTenant.executarCom`, `esquemaNegocio.negocio` e afins, um a um, e procura as
 * marcas do executor também nos valores de dentro do namespace.
 */

export {
  type AcessoAIdentidade,
  abrirAcessoAIdentidade,
  type BancoDeIdentidade,
  type TabelasDeIdentidade,
} from './acesso-identidade.js';
export {
  type CoberturaDeIsolamento,
  type ExcecaoDeIsolamento,
  type MotivoDeExcecao,
  verificarCoberturaDeIsolamento,
} from './catalogo.js';
export * as contextoDeTenant from './contexto.js';
export {
  type AlvoDeReemissao,
  admitirEmpresa,
  type EmpresaNova,
  type EmpresaPersistida,
  encerrarSessoesDaEmpresa,
  type JanelaDeEmpresas,
  lerAlvoDeReemissao,
  listarEmpresas,
  localizarEmpresa,
  localizarPessoaPorEmail,
  type MarcaDeSuspensao,
  type PaginaDeEmpresasPersistidas,
  reativarEmpresa,
  suspenderEmpresa,
} from './empresa.js';
export * as esquemaIdentidade from './esquema/identidade.js';
export * as esquemaNegocio from './esquema/negocio.js';
export {
  type AjustePersistido,
  type AjustesDaPessoa,
  type ChaveDeAjuste,
  type EfeitoDoAjuste,
  ErroDePessoaForaDoContexto,
  type EscritaDeAjustes,
  escreverAjustes,
  incrementarVersaoPermissoes,
  lerAjustesDaPessoa,
  type PerfilDaPessoa,
  type TrocaDePerfil,
  trocarPerfilDaPessoa,
} from './permissao.js';
export {
  contarAjustesDaPessoa,
  definirAtivoDaPessoa,
  encerrarSessoesDaPessoa,
  garantirVinculoDeAcesso,
  type JanelaDePessoas,
  listarPessoasDaEmpresa,
  localizarPessoaDoContexto,
  type PaginaDePessoasPersistidas,
  type PessoaDoContexto,
  type PessoaPersistida,
} from './pessoa.js';
export {
  ACESSOS_DA_EMPRESA_A,
  ACESSOS_DA_EMPRESA_B,
  type AcessoSemeado,
  EMPRESA_A,
  EMPRESA_B,
  EMPRESAS,
  type EmpresaSemeada,
  type OpcoesDeSemente,
  PROVEDOR_DE_CREDENCIAL,
  SENHA_DA_CARGA,
  semear,
  USUARIO_MASTER,
  USUARIOS,
  type UsuarioSemeado,
} from './semente.js';
export {
  type AcessoAoBanco,
  abrirAcessoAoBanco,
  ErroDeContextoInvalido,
  ErroDeUnidadeAninhada,
  type OpcoesDeAcessoAoBanco,
} from './unidade-de-trabalho.js';
