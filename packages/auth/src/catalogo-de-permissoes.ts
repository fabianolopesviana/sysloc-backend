/**
 * O catálogo fechado de permissões — 10 áreas de tela, 7 ações sensíveis, e a dependência entre
 * os dois eixos.
 *
 * ---------------------------------------------------------------------------
 * Por que o catálogo é FECHADO, e o que isso compra
 * ---------------------------------------------------------------------------
 *
 * A RN-15 e a **ADR-0011** fixam que não existe permissão fora desta lista: ela é uma das duas
 * dimensões da exigência que toda rota declara, e a rota que não declara nada é recusada. Um
 * catálogo aberto — chave livre, validada por texto — reintroduziria exatamente o que a decisão
 * rejeita: a operação do operador do SaaS entraria aqui como chave sintética, o catálogo deixaria
 * de ser a matriz do produto e viraria um índice de rotas.
 *
 * Fechado significa **união de literais**, não constante em tempo de execução. Quem trata os casos
 * de forma exaustiva — um `Record<ChaveDoCatalogo, …>`, um `switch` com o ramo `never` — passa a
 * ser obrigado pelo compilador a tratar a chave nova, em vez de ganhar em silêncio um valor que
 * ninguém previu. É a mesma escolha que `perfis.ts` faz ao derivar os perfis do enum do schema em
 * vez de redigitar a lista.
 *
 * ---------------------------------------------------------------------------
 * A forma da chave: `TIPO:nome`, num literal só
 * ---------------------------------------------------------------------------
 *
 * A chave carrega o eixo no próprio valor (`TELA:financeiro`, `ACAO:emitir_boleto`) por duas razões
 * concretas. A primeira é que ela é o que a recusa devolve ao cliente em `detalhes.exigido`
 * (RN-14): `'financeiro'` sozinho não diria se faltou a área ou uma ação dentro dela. A segunda é
 * que o prefixo torna os dois eixos **disjuntos por construção** — uma tela e uma ação nunca
 * colidem, mesmo que compartilhem o nome.
 *
 * A persistência é outra coisa, e de propósito: `negocio.acesso_usuario_permissao` guarda `tipo` e
 * `chave` em colunas separadas, porque é sobre o trio `(acesso_id, tipo, chave)` que a unicidade
 * recusa concessão e negação coexistentes. A composição e a decomposição entre as duas formas são
 * da camada de dados; aqui o domínio fala uma coisa só.
 *
 * ---------------------------------------------------------------------------
 * Por que o mapa é a DECLARAÇÃO das ações, e não um segundo arquivo a manter
 * ---------------------------------------------------------------------------
 *
 * A RN-02 diz que uma ação sensível só vale para quem alcança a área de tela correspondente. Se as
 * ações fossem declaradas numa lista e o mapa noutra, a totalidade — *toda* ação tem *exatamente
 * uma* tela — dependeria de alguém manter as duas em sincronia, que é a dependência de disciplina
 * que este projeto substitui por estrutura.
 *
 * Aqui {@link MAPA_ACAO_TELA} **é** a declaração: uma ação existe porque tem entrada no mapa, e
 * {@link CHAVES_DE_ACAO} é derivada dele. Isso torna as duas metades da totalidade propriedades do
 * compilador, não do teste:
 *
 * - *toda ação tem tela* — não há como declarar uma ação sem valor, porque a ação **é** a chave de
 *   uma entrada;
 * - *toda ação tem UMA tela* — um objeto não tem chave repetida;
 * - *o alvo é uma tela de verdade* — o `satisfies Readonly<Record<string, ChaveDeTela>>` recusa,
 *   em tempo de compilação, um valor que não esteja em {@link CHAVES_DE_TELA}.
 *
 * O CT-201 afirma as mesmas propriedades em tempo de execução. Não é redundância inútil: o
 * `satisfies` não alcança as cardinalidades (10 e 7) nem a ausência de repetida dentro do eixo das
 * telas, que é um arranjo.
 */

/**
 * As 10 áreas de tela do app da imobiliária — a lista fechada da decisão 38 (`plano-saas.md` §0.5),
 * na ordem em que ela as enumera.
 *
 * `Object.freeze` sobre o literal `as const`: o `as const` fecha a união em tempo de compilação, e o
 * congelamento fecha o arranjo em tempo de execução. Sem o segundo, um consumidor com um `push` mal
 * colocado alargaria o catálogo de todo mundo — este módulo tem instância única no processo.
 */
export const CHAVES_DE_TELA = Object.freeze([
  'TELA:resumo',
  'TELA:imoveis',
  'TELA:contratos',
  'TELA:cadastros',
  'TELA:financeiro',
  'TELA:automacao_de_cobranca',
  'TELA:integracoes_bancarias',
  'TELA:multa_e_juros',
  'TELA:relatorios',
  'TELA:usuarios',
] as const);

/** União fechada das 10 áreas de tela. */
export type ChaveDeTela = (typeof CHAVES_DE_TELA)[number];

/**
 * As 7 ações sensíveis e, para cada uma, a área de tela que a comporta (RN-02).
 *
 * É a declaração única do eixo das ações — ver o cabeçalho deste arquivo. O `satisfies` é o que
 * recusa um alvo inventado sem apagar os literais que o `as const` preserva; trocá-lo por uma
 * anotação de tipo (`: Readonly<Record<string, ChaveDeTela>>`) alargaria as chaves para `string` e
 * a união das ações deixaria de existir.
 *
 * As atribuições seguem o alcance de cada área na §0.5: emissão e baixa de boleto são operações do
 * **Financeiro**; ativar e cancelar contrato são do **Contratos**; excluir cadastro é do
 * **Cadastros** (locador, locatário, fiador — cadastro de negócio, nunca empresa nem pessoa, que a
 * decisão 11 declara não apagáveis); configurar integração é do **Integrações bancárias**; e o
 * envio manual de cobrança por e-mail é da **Automação de cobrança**, que é a área onde a régua de
 * e-mail vive.
 */
export const MAPA_ACAO_TELA = Object.freeze({
  'ACAO:emitir_boleto': 'TELA:financeiro',
  'ACAO:solicitar_baixa_de_boleto': 'TELA:financeiro',
  'ACAO:ativar_contrato': 'TELA:contratos',
  'ACAO:cancelar_contrato': 'TELA:contratos',
  'ACAO:excluir_cadastro': 'TELA:cadastros',
  'ACAO:configurar_integracao': 'TELA:integracoes_bancarias',
  'ACAO:enviar_cobranca_manual': 'TELA:automacao_de_cobranca',
} as const satisfies Readonly<Record<string, ChaveDeTela>>);

/** União fechada das 7 ações sensíveis, derivada do mapa acima. */
export type ChaveDeAcao = keyof typeof MAPA_ACAO_TELA;

/**
 * As 7 ações como arranjo, derivadas do mapa.
 *
 * A conversão sobre `Object.keys` é a única deste módulo e é inevitável: a assinatura da biblioteca
 * padrão devolve `string[]` mesmo para objeto de chaves literais, porque um objeto pode carregar
 * propriedades a mais em tempo de execução. Aqui não pode — o valor é um literal congelado, criado
 * neste arquivo e nunca estendido. A ordem é a de inserção, que a especificação da linguagem
 * garante para chaves não numéricas, e é por isso que este arranjo é determinístico.
 */
export const CHAVES_DE_ACAO = Object.freeze(Object.keys(MAPA_ACAO_TELA) as ChaveDeAcao[]);

/** União fechada das 17 chaves — as duas dimensões do catálogo, num tipo só. */
export type ChaveDoCatalogo = ChaveDeTela | ChaveDeAcao;

/**
 * O catálogo inteiro como conjunto, para a pertinência em tempo constante.
 *
 * Tipado como `ReadonlySet<unknown>` de propósito: é o que permite a {@link ehChaveDoCatalogo}
 * receber `unknown` sem conversão. Um `ReadonlySet<string>` obrigaria o predicado a converter o
 * argumento antes de consultar — e conversão dentro de uma guarda de borda é justamente o lugar
 * onde ela não deve existir.
 */
const CATALOGO: ReadonlySet<unknown> = new Set<string>([...CHAVES_DE_TELA, ...CHAVES_DE_ACAO]);

/**
 * A chave pertence ao catálogo?
 *
 * É o predicado que a borda usa para recusar chave inventada antes de qualquer escrita — a
 * primeira linha da §6.1 da tech spec (`422 CAMPO_INVALIDO`, `campo: "ajustes"`). Recebe `unknown`
 * porque o que chega ali é corpo de requisição: obrigá-lo a receber `string` transferiria ao
 * chamador o estreitamento, e um chamador que estreitasse errado abriria o buraco que este
 * predicado existe para fechar.
 */
export function ehChaveDoCatalogo(valor: unknown): valor is ChaveDoCatalogo {
  return CATALOGO.has(valor);
}
