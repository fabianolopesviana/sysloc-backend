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
 * `./conjunto.js` entra pela mesma pergunta, e com a mesma resposta: as cinco operações do ciclo de
 * vida do conjunto **recebem** o executor de quem já abriu a unidade, não abrem conexão nem transação
 * e não devolvem executor. Elas existem pelas duas razões que já sustentam as anteriores, somadas a
 * uma terceira que é própria do domínio de locação: devolver a **enumerabilidade** do alcance a
 * `negocio` (a contenção da §11.2 é de tipo e não alcança texto de SQL); dar UM lugar, sob a
 * política, à leitura e à escrita do agregado; e — a terceira — instalar o **predicado de circulação
 * por padrão** na porta, em vez de deixá-lo por conta de cada listagem que venha a ser escrita. A
 * ADR-0014 nomeia esse esquecimento entre os próprios *Cons*, e o cabeçalho de `./conjunto.ts`
 * registra por que o default invertido é o que o fecha.
 *
 * De lá sai também, pela T10, `lerCarteira` — a leitura composta que devolve a página de conjuntos
 * com os imóveis de cada um. Ela entra pelo mesmo critério das cinco: **recebe** o executor de quem
 * já abriu a unidade, não abre conexão nem transação e não devolve executor. Ela precisa sair porque
 * é o que `apps/api/src/imoveis/conjunto.service.ts` consome para servir `?expandir=imoveis`, e a
 * alternativa — a borda montar a árvore chamando as portas dos dois níveis — devolveria à aplicação
 * a decisão de quantas idas ao banco a carteira custa, que é precisamente o que a §12.2 fixa aqui.
 *
 * `./imovel.js` entra pela mesma pergunta, e com a mesma resposta: as cinco operações do ciclo de
 * vida do imóvel **recebem** o executor de quem já abriu a unidade, não abrem conexão nem transação
 * e não devolvem executor. Elas repetem as três razões de `./conjunto.js` — enumerabilidade do
 * alcance a `negocio`, um lugar único sob a política, e o predicado de circulação por padrão — e
 * acrescentam uma quarta, que é própria desta entidade: a **tradução da violação de unicidade**. A
 * restrição `unique(empresa_id, identificador_municipal)` é o mecanismo que impede a repetição, e
 * traduzi-la exige ler o estado do registro em conflito **depois** da recusa, de dentro da mesma
 * transação. Isso só é possível de dentro do pacote — a leitura corre atrás de um `SAVEPOINT`, sobre
 * a tabela que só daqui é alcançável — e é por isso que `ErroDeIdentificadorMunicipalEmUso` sai
 * daqui: ele é **classe de erro**, no mesmo critério de `ErroDeUnidadeAninhada` e de
 * `ErroDePessoaForaDoContexto`, e não um caminho para dado.
 *
 * De lá **não** sai `lerImoveisDeConjuntos`, e a ausência é deliberada — a mesma de
 * `lerComodosDeImoveis` um nível abaixo. Quem a consome é `./conjunto.js`, para compor a carteira, e
 * publicá-la ofereceria a `apps/api` um caminho para ler imóvel **por conjunto** fora das duas
 * portas que o contrato publica (a listagem paginada e a leitura por identificador) — isto é, uma
 * listagem sem janela, cujo tamanho de resposta ninguém declara.
 *
 * `./comodo.js` entra pela mesma pergunta, e com a mesma resposta: as três escritas do cômodo
 * **recebem** o executor de quem já abriu a unidade, não abrem conexão nem transação e não devolvem
 * executor. Elas repetem as razões de `./imovel.js` — enumerabilidade do alcance a `negocio`, um
 * lugar único sob a política — e acrescentam a que é própria desta entidade: a **atribuição de
 * posição** (`max(posicao) + 1`) acontece dentro da própria instrução de gravação, e escrevê-la fora
 * do pacote reabriria a janela de corrida que ela existe para não ter.
 *
 * Duas coisas de lá **não** saem, e as ausências são deliberadas. `lerComodosDeImoveis` fica dentro:
 * quem a consome é `./imovel.js`, para montar o agregado, e publicá-la ofereceria a `apps/api` um
 * caminho para ler cômodo **sem** passar pelo imóvel — que é justamente o que o contrato recusa (não
 * há rota de leitura de cômodo; ele chega e volta dentro do agregado). E `./contexto-de-escrita.js`
 * fica dentro porque é fragmento de SQL: publicá-lo daria à borda um pedaço de instrução para
 * compor, que é o oposto do que a §11.2 mantém.
 *
 * `somarMetragem`, de `./imovel.js`, sai — e ela não é caminho para dado nenhum: é função **pura**
 * sobre os cômodos já lidos. Ela é publicada porque é a materialização do *ponto único de soma* que
 * a decisão D2 do tech_spec exige, e ter o ponto com nome é o que torna a afirmação verificável: uma
 * segunda soma apareceria como um segundo símbolo, e não como uma linha a mais escondida numa
 * consulta.
 *
 * `./cadastro-de-pessoa.js` entra pela mesma pergunta, e com a mesma resposta: as cinco operações do
 * ciclo de vida dos três cadastros de pessoa — locador, locatário e fiador — **recebem** o executor
 * de quem já abriu a unidade, não abrem conexão nem transação e não devolvem executor. Elas repetem
 * as razões das anteriores — enumerabilidade do alcance a `negocio`, um lugar único sob a política, o
 * predicado de circulação por padrão — e acrescentam a que é própria destas três: **o papel é
 * parâmetro, e a parametrização é por tabela**. Publicar UMA porta para os três papéis é o que
 * impede a borda de escolher a tabela por conta própria; e `PAPEIS_DE_PESSOA` sai junto porque é a
 * união fechada que a borda usa para fixar o papel de cada controlador, sem redigitar os três nomes.
 *
 * De lá saem também, pela T9, `ErroDeDocumentoEmUso` e `gravarCadastroSobRestricaoDeUnicidade`. A
 * classe entra pelo MESMO critério de `ErroDeUnidadeAninhada`, de `ErroDePessoaForaDoContexto` e de
 * `ErroDeIdentificadorMunicipalEmUso`: é classe de erro, não caminho para dado. O envoltório entra
 * porque a tradução da violação de unicidade exige **ler o estado do registro em conflito depois da
 * recusa, na mesma transação e atrás de um `SAVEPOINT`** — o que só é possível de dentro do pacote —,
 * e porque as duas escritas cruas seguem observáveis pelos casos da T8, que afirmam o `23505` e o
 * nome da restrição. Ele **não** é caminho para dado: recebe o executor de quem já abriu a unidade e
 * devolve o que a função envolvida devolver.
 *
 * O que de lá **não** sai é `TABELA_POR_PAPEL`, e a ausência é deliberada: ele é a declaração
 * **interna** da parametrização — o mapa de papel para nome físico de tabela —, e publicá-lo ofereceria
 * a `apps/api` o nome da tabela, que é justamente o que a §11.2 mantém dentro. `RESTRICAO_DO_DOCUMENTO`
 * fica dentro pelo mesmo critério, e `lerConflitoDoDocumento` também: publicá-la daria à borda uma
 * leitura por documento sem passar pela recusa que a justifica. `somenteDigitos` de `@sysloc/shared`
 * também não é reexportado: quem precisa dele fora daqui o importa de lá.
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
  alterarPessoa,
  type ConflitoDeDocumento,
  criarPessoa,
  type DadosDaPessoa,
  definirCirculacaoDaPessoa,
  ErroDeDocumentoEmUso,
  gravarCadastroSobRestricaoDeUnicidade,
  type JanelaDePessoasCadastradas,
  listarPessoas,
  localizarPessoa,
  PAPEIS_DE_PESSOA,
  type PaginaDePessoasCadastradas,
  type PapelDePessoa,
  type PessoaCadastrada,
} from './cadastro-de-pessoa.js';
export {
  type CoberturaDeIsolamento,
  type ExcecaoDeIsolamento,
  type MotivoDeExcecao,
  verificarCoberturaDeIsolamento,
} from './catalogo.js';
export {
  acrescentarComodo,
  alterarComodo,
  type ComodoPersistido,
  type DadosDoComodo,
  removerComodo,
} from './comodo.js';
export {
  alterarConjunto,
  type ConjuntoComImoveisPersistido,
  type ConjuntoPersistido,
  criarConjunto,
  type DadosDoConjunto,
  definirCirculacaoDoConjunto,
  type JanelaDeConjuntos,
  lerCarteira,
  listarConjuntos,
  localizarConjunto,
  type OpcoesDeCirculacao,
  type PaginaDaCarteiraPersistida,
  type PaginaDeConjuntosPersistidos,
} from './conjunto.js';
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
  alterarImovel,
  type ConflitoDeIdentificador,
  criarImovel,
  type DadosDoImovel,
  definirCirculacaoDoImovel,
  ErroDeIdentificadorMunicipalEmUso,
  type ImovelPersistido,
  type JanelaDeImoveis,
  listarImoveis,
  localizarImovel,
  type PaginaDeImoveisPersistidos,
  somarMetragem,
} from './imovel.js';
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
