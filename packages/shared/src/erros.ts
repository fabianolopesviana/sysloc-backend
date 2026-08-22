/**
 * Contrato de erro da API — materialização em código da ADR-0007.
 *
 * A decisão fixa a forma literal: **status HTTP semântico** acompanhado do corpo
 * `{ codigo, mensagem, campo?, detalhes? }`, com `codigo` vindo de **enum fechado**
 * e o corpo falando camelCase. Nada além destes quatro campos trafega ao cliente —
 * em particular, nem o status (que é da resposta, não do corpo) nem o estado interno
 * da exceção (`name`, `message`, `stack`).
 *
 * A separação entre a exceção e o filtro global (T5) é deliberada: a exceção carrega
 * a decisão (qual código, qual status); o filtro apenas traduz. Assim a decisão fica
 * perto de quem tem contexto e o filtro não precisa adivinhar.
 */

/**
 * Enum fechado de códigos de erro (ADR-0007).
 *
 * **Superfície versionada.** Acrescentar valor é retrocompatível — o cliente que ainda
 * não conhece o código novo continua tratando os que conhece. **Renomear ou remover
 * não é**: quebra todo consumidor que classifica erro por `codigo`, que é exatamente o
 * que a ADR-0007 comprou ao eliminar a classificação por prefixo de texto.
 *
 * Só entram aqui códigos que esta fatia usa. Antecipar código de negócio é dívida sem
 * consumidor.
 *
 * Grafia: **maiúsculo**-com-sublinhado, em português, como a §4 da T3 fixou.
 *
 * O **idioma** é continuidade com o cliente; a **grafia não é**, e vale registrar a ruptura em
 * vez de alegar o contrário. Os símbolos de erro que o React já discrimina
 * (`levantamento-frontend.md` §6) são minúsculo-com-sublinhado — `sem_certificado_proprio`,
 * `requer_decisao`, `sem_config_ativa` e, entre eles, `campo_invalido`, que é o mesmo código
 * que aqui nasce `CAMPO_INVALIDO`. Nenhum dos quatro códigos desta fatia trafega hoje para
 * aquele `switch`: ele discrimina erro da integração bancária, que chega em F4.
 *
 * **A decisão de mapeamento pertence à F4**, e é lá que ela precisa ser tomada — junto com o
 * adaptador por provedor da ADR-0001, que é o lugar onde a tradução entre o vocabulário do
 * provedor e o do produto já mora. Duas saídas continuam abertas: traduzir no adaptador, ou
 * adotar a grafia herdada para os códigos daquele domínio. Por isso o teste de contrato desta
 * fatia asserta a grafia **dos quatro códigos fixados aqui**, e não do enum inteiro: prender
 * o enum inteiro a esta grafia forçaria F4 a escolher entre quebrar o cliente em silêncio e
 * enfraquecer um teste de contrato para acomodar uma decisão que nunca foi tomada.
 */
export const CodigoErro = Object.freeze({
  /** Entrada rejeitada pela validação. Acompanha `campo` quando há um culpado nomeável. */
  CAMPO_INVALIDO: 'CAMPO_INVALIDO',
  /** O recurso pedido não existe — ou não é visível para quem pediu. */
  RECURSO_NAO_ENCONTRADO: 'RECURSO_NAO_ENCONTRADO',
  /** Falha não prevista. O diagnóstico fica no registro estruturado, nunca na resposta. */
  ERRO_INTERNO: 'ERRO_INTERNO',
  /** Dependência necessária indisponível. A operação pode ser repetida mais tarde. */
  SERVICO_INDISPONIVEL: 'SERVICO_INDISPONIVEL',

  // -------------------------------------------------------------------------
  // Identidade (F1) — os três da §10.1 da tech spec da fatia
  // -------------------------------------------------------------------------
  /**
   * A tentativa de entrada não resultou em acesso.
   *
   * **Um código para quatro causas, de propósito** (RN-10): credencial incorreta, conta bloqueada,
   * pessoa desativada e empresa suspensa produzem a MESMA resposta — mesmo status, mesmo código,
   * mesma mensagem, mesmo conjunto de campos. Distinguir confirmaria ao atacante que a conta
   * existe. Um código por causa seria a forma "mais informativa" e é justamente a que a decisão
   * rejeita; quem precisa da causa é a trilha de auditoria, não o cliente.
   */
  CREDENCIAL_INVALIDA: 'CREDENCIAL_INVALIDA',
  /** Não há sessão válida na requisição — ausente, encerrada ou vencida. */
  NAO_AUTENTICADO: 'NAO_AUTENTICADO',
  /** Há sessão válida, mas ela não alcança o que foi pedido. */
  ACESSO_NEGADO: 'ACESSO_NEGADO',

  /**
   * A requisição foi recusada por quem a atendeu, e a causa **não tem nome neste vocabulário**.
   *
   * É o código do **fecho** da classificação, e não mais um código de negócio: existe para que
   * uma recusa de CLIENTE emitida por um componente que não conhecemos — o arcabouço de
   * identidade e as versões futuras dele — chegue ao cliente **como recusa**, com o status que
   * quem recusou escolheu, em vez de ser reclassificada como falha do servidor. Sem ele, todo
   * status fora da tabela do filtro global virava `500 ERRO_INTERNO`: resposta mentirosa para o
   * cliente e, pior, uma linha de nível `error` no journal afirmando falha do serviço no exato
   * instante em que o serviço estava se defendendo.
   *
   * **O status que acompanha este código é o de origem, não o desta tabela** — o `400` mapeado em
   * {@link STATUS_POR_CODIGO} é apenas o padrão de quem o levantar diretamente como
   * `ErroDeAplicacao`. Quem preserva o status de origem é `apps/api/src/comum/filtro-excecao.ts`,
   * onde a decisão está registrada por extenso.
   */
  REQUISICAO_RECUSADA: 'REQUISICAO_RECUSADA',

  // -------------------------------------------------------------------------
  // Material do certificado do provedor (F5) — os três da §4.3 da tech spec da fatia
  // `integracao-bancaria-autonoma`, um por causa
  // -------------------------------------------------------------------------

  /**
   * O material apresentado não se deixa preparar: não é um PKCS#12 que o produto entenda, ou o
   * preparo não pôde completar.
   *
   * ⚠️ **Ele é o oposto exato de {@link CodigoErro.CREDENCIAL_INVALIDA}, e a assimetria é
   * deliberada.** Lá um código responde por quatro causas porque distinguir *"confirmaria ao
   * atacante que a conta existe"*. Aqui **não há atacante a informar**: quem pede está autenticado,
   * detém a ação sensível de configurar a integração e apresentou **as duas metades** — o arquivo e
   * a senha. Dizer-lhe qual das duas não serve não revela nada que ele já não tenha, e o silêncio
   * tem custo medido: em 2026-08-20 o operador caçou uma senha errada que não existia.
   */
  MATERIAL_EM_FORMATO_NAO_SUPORTADO: 'MATERIAL_EM_FORMATO_NAO_SUPORTADO',

  /**
   * A senha apresentada não abre o material — desfecho **distinto** do formato, e é essa distinção
   * que a fatia acrescenta.
   *
   * ⚠️ A causa é escolhida pelo **tipo** da exceção do domínio, nunca por texto de mensagem: com
   * material em cifra legada, a leitura direta falha **pela cifra** antes de a etiqueta de
   * autenticação ser conferida, e quem descobre a senha errada é o conversor.
   */
  SENHA_DO_MATERIAL_NAO_ABRE: 'SENHA_DO_MATERIAL_NAO_ABRE',

  /**
   * O material abriu, o titular é legível — e a validade dele já terminou.
   *
   * É a única das três que acompanha `detalhes`, com o dia em que a validade acabou: sem ele o
   * Admin não distingue *"o arquivo é o errado"* de *"o arquivo é o certo e está velho"*.
   */
  CERTIFICADO_COM_VALIDADE_ENCERRADA: 'CERTIFICADO_COM_VALIDADE_ENCERRADA',
} as const);

/** União fechada dos códigos acima. */
export type CodigoErro = (typeof CodigoErro)[keyof typeof CodigoErro];

/**
 * Status HTTP semântico por código.
 *
 * `Record<CodigoErro, number>` faz o compilador exigir uma entrada por código: acrescentar
 * valor ao enum sem mapear status **não compila**. Deliberadamente **sem valor padrão** —
 * um `?? 500` transformaria mapeamento esquecido em erro genérico silencioso e tiraria do
 * teste a única chance de detectá-lo.
 */
const STATUS_POR_CODIGO: Readonly<Record<CodigoErro, number>> = {
  [CodigoErro.CAMPO_INVALIDO]: 422,
  [CodigoErro.RECURSO_NAO_ENCONTRADO]: 404,
  [CodigoErro.ERRO_INTERNO]: 500,
  [CodigoErro.SERVICO_INDISPONIVEL]: 503,
  // Os dois `401` são o par "quem é você?" — a entrada que não foi aceita e a requisição sem
  // sessão válida. O `403` é outra pergunta: a sessão existe e não alcança o pedido.
  [CodigoErro.CREDENCIAL_INVALIDA]: 401,
  [CodigoErro.NAO_AUTENTICADO]: 401,
  [CodigoErro.ACESSO_NEGADO]: 403,
  // `400` é o PADRÃO de quem levantar este código diretamente — a recusa de cliente mais genérica
  // que existe. Ele **não** é o status que o filtro global responde quando traduz a recusa de um
  // componente externo: ali o status de origem é preservado, justamente porque a razão de o código
  // existir é não reclassificar a recusa alheia. Ver a decisão fechada em
  // `apps/api/src/comum/filtro-excecao.ts`.
  [CodigoErro.REQUISICAO_RECUSADA]: 400,
  // Os três do material do certificado são `422` como `CAMPO_INVALIDO`, e pela mesma razão:
  // continuam sendo recusa da ENTRADA do cliente. O que a fatia acrescenta é a distinção do
  // **código**, e só dela — o status não muda, porque a natureza do desfecho não mudou.
  [CodigoErro.MATERIAL_EM_FORMATO_NAO_SUPORTADO]: 422,
  [CodigoErro.SENHA_DO_MATERIAL_NAO_ABRE]: 422,
  [CodigoErro.CERTIFICADO_COM_VALIDADE_ENCERRADA]: 422,
};

/**
 * Corpo de erro da API — a forma literal da ADR-0007. Nenhum campo a mais, nenhum a menos.
 *
 * Os opcionais são declarados **sem** `| undefined`: sob `exactOptionalPropertyTypes`, isso
 * proíbe `{ campo: undefined }` e obriga a **omissão**. Opcional presente com valor indefinido
 * e opcional ausente são coisas diferentes no JSON emitido, e só a segunda é conforme.
 */
export interface CorpoErro {
  readonly codigo: CodigoErro;
  readonly mensagem: string;
  readonly campo?: string;
  readonly detalhes?: Record<string, unknown>;
}

/**
 * Opcionais aceitos na construção da exceção.
 *
 * Aqui os campos admitem `undefined` de propósito — quem levanta o erro costuma repassar um
 * valor que pode não existir (`{ campo: problema.campo }`) e não deveria ter que ramificar
 * para isso. A conversão de "indefinido" em "ausente" é feita por {@link ErroDeAplicacao.paraCorpo}.
 */
export interface OpcoesDeErro {
  /** Nome do campo culpado, em camelCase, como o cliente o conhece. */
  readonly campo?: string | undefined;
  /** Contexto adicional estruturado. Nunca carrega segredo — a resposta é do cliente. */
  readonly detalhes?: Record<string, unknown> | undefined;

  /**
   * Exceção de origem, quando esta é erguida a partir de outra.
   *
   * Repassada ao `Error` como `cause`, que é onde o registro estruturado de `log.ts` já sabe
   * descer e redigir. Sem este parâmetro, quem convertesse uma falha de driver em
   * `ErroDeAplicacao` perdia o diagnóstico — ou o anexava por conta própria, fora do contrato.
   *
   * **Não entra em `paraCorpo()`**: a causa é diagnóstico interno, e a ADR-0007 fixa o corpo
   * em quatro campos.
   */
  readonly causa?: unknown;
}

/**
 * Exceção que carrega a decisão de erro: o código do enum fechado, a mensagem e o status
 * HTTP semântico derivado do código.
 *
 * O status **não** é parâmetro: quem levanta o erro escolhe o código, e o código determina
 * o status. Isso impede que dois pontos do sistema respondam status diferentes para a mesma
 * classe de falha.
 */
export class ErroDeAplicacao extends Error {
  override readonly name: string = 'ErroDeAplicacao';

  /** Código do enum fechado — o que o cliente usa para classificar. */
  readonly codigo: CodigoErro;

  /** Status HTTP semântico correspondente ao código. Não trafega no corpo. */
  readonly status: number;

  /** Campo culpado, quando há um. */
  readonly campo?: string | undefined;

  /** Contexto adicional, quando há. */
  readonly detalhes?: Record<string, unknown> | undefined;

  constructor(codigo: CodigoErro, mensagem: string, opcoes: OpcoesDeErro = {}) {
    // Mesma disciplina dos demais opcionais: causa não informada é **ausência**, não presença
    // com valor indefinido. `new Error(msg, { cause: undefined })` criaria a propriedade
    // `cause` valendo indefinido, e o registro passaria a emitir uma causa vazia por evento.
    super(mensagem, opcoes.causa !== undefined ? { cause: opcoes.causa } : undefined);
    this.codigo = codigo;
    this.status = STATUS_POR_CODIGO[codigo];
    this.campo = opcoes.campo;
    this.detalhes = opcoes.detalhes;
  }

  /**
   * Devolve o corpo canônico que o filtro global de T5 serializa.
   *
   * Constrói o objeto campo a campo em vez de serializar a exceção: `name`, `message`, `stack`
   * e `status` ficam de fora por construção, e não por confiar que alguém lembre de removê-los.
   * Opcional não informado é **omitido**, nunca presente com valor indefinido.
   */
  paraCorpo(): CorpoErro {
    const corpo: {
      codigo: CodigoErro;
      mensagem: string;
      campo?: string;
      detalhes?: Record<string, unknown>;
    } = { codigo: this.codigo, mensagem: this.message };

    if (this.campo !== undefined) {
      corpo.campo = this.campo;
    }
    if (this.detalhes !== undefined) {
      corpo.detalhes = this.detalhes;
    }

    return corpo;
  }
}
