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
export * as esquemaIdentidade from './esquema/identidade.js';
export * as esquemaNegocio from './esquema/negocio.js';
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
