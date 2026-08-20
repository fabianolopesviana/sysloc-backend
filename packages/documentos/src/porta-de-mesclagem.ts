/**
 * A porta de **composição** de documentos prontos — *"junte estes documentos num só"*.
 *
 * ===========================================================================
 * A porta sabe uma coisa só, e ela é diferente da que a renderização sabe
 * ===========================================================================
 *
 * A porta de renderização (`./porta-de-renderizacao.ts`) recebe **conteúdo** — a representação
 * textual que o domínio compôs — e produz bytes. Esta recebe **bytes já prontos** e produz bytes. A
 * diferença não é de grau: o que atravessa aqui é o **fato recebido de terceiro** — o boleto que o
 * provedor emitiu —, e a ADR-0030 o exclui explicitamente do que o produto pode recompor (*"fato
 * recebido de terceiro … não é artefato derivado: é dado de entrada, ninguém o recompõe"*). Por
 * isso a porta não tem, e não pode ganhar, parâmetro de página, margem, cabeçalho, numeração ou
 * marca d'água: **toda** opção assim seria um convite a alterar o documento de origem, que é
 * justamente o que ela existe para não fazer.
 *
 * Nada de nome de arquivo, tipo de mídia ou disposição atravessa esta fronteira — quem declara isso
 * é a rota que devolve os bytes (ADR-0028), e ela vive na borda.
 *
 * **A porta chega ao consumidor por parâmetro, nunca por import** (ADR-0025): ela é propriedade de
 * quem a **exige**, e é o adaptador que importa daqui para dizer que a satisfaz. A seta nunca se
 * inverte. O molde literal é o de `./porta-de-renderizacao.ts`, e as duas se leem juntas.
 *
 * ===========================================================================
 * Por que a ORDEM é conteúdo, e por que o arranjo é a única forma de dizê-la
 * ===========================================================================
 *
 * O carnê é lido por quem paga: a primeira parcela vem primeiro. A alternativa idiomática — receber
 * um mapa de `competência → bytes` e ordenar aqui dentro — foi descartada porque obrigaria esta
 * fronteira a conhecer **competência**, que é vocabulário de cobrança, e a decidir critério de
 * ordenação, que é decisão de domínio tomada por quem seleciona o recorte. O arranjo já é a ordem;
 * quem o monta é quem a escolheu.
 *
 * ===========================================================================
 * NENHUMA REPETIÇÃO, NENHUM TIMEOUT E NENHUM TRATAMENTO DE FALHA MORAM AQUI
 * ===========================================================================
 *
 * Não há processo externo a esperar: a composição acontece dentro do processo que atende à
 * requisição, sobre bytes que **já estão em memória** — quem os obteve (do disco ou do provedor) já
 * atravessou as fronteiras que existiam. Um adaptador que tentasse de novo por conta própria
 * multiplicaria trabalho em silêncio, e um timeout aqui mentiria sobre haver uma fronteira de rede.
 * É a mesma disciplina de `./porta-de-renderizacao.ts` e de `packages/regua/src/adaptador-smtp.ts`.
 *
 * ===========================================================================
 * As duas recusas são do CONTRATO da porta, e não do adaptador que a satisfaz
 * ===========================================================================
 *
 * {@link ErroDeMesclagemSemDocumentos} e {@link ErroDeDocumentoIlegivel} moram aqui, junto da
 * interface, porque são **o que a porta promete** a quem a chama: qualquer implementação futura tem
 * de recusar as duas situações do mesmo jeito, e quem prova a porta não pode depender de conhecer o
 * adaptador para escrever a asserção. Declará-las no adaptador amarraria o consumidor à
 * implementação e faria a troca de motor quebrar a captura da falha — exatamente o acoplamento que
 * a ADR-0025 existe para impedir.
 */

/**
 * A recusa de mesclar **coisa nenhuma**.
 *
 * A alternativa idiomática — devolver um PDF de zero páginas — foi descartada: um documento vazio é
 * indistinguível, para quem o recebe, de um carnê que perdeu as parcelas no caminho, e o produto
 * responderia `200` com um arquivo que não serve para nada. Quem sabe que o recorte não alcançou
 * cobrança alguma é o `CarneService`, e a resposta dele é `404 SEM_COBRANCAS` (CA-18) — **antes**
 * de chegar aqui. Esta recusa é, portanto, a rede de quem chamou sem conferir: ela nunca deveria
 * ser alcançada em produção, e por isso é erro, não caso de uso.
 */
export class ErroDeMesclagemSemDocumentos extends Error {
  constructor() {
    super('mesclagem pedida sem documento algum');
    // `name` é escrito à mão porque a herança de `Error` não o deriva da classe — sem isto, o
    // `stack` e o registro estruturado diriam apenas `Error`.
    this.name = 'ErroDeMesclagemSemDocumentos';
  }
}

/**
 * A recusa de um documento de origem que **não pôde ser lido** — malformado, truncado ou cifrado.
 *
 * O que ela impede é o documento **parcial silencioso**: pular a origem ilegível e seguir com as
 * demais entregaria ao locatário um carnê com uma parcela a menos, e ninguém perceberia. É a mesma
 * escolha de `ErroDeDataDeEmissaoInvalida` — documento pela metade é pior que erro.
 *
 * ⚠️ **Ela carrega a POSIÇÃO, e jamais os bytes.** A posição é o que permite a quem chamou dizer
 * *qual* documento ofendeu (o chamador conhece a ordem que montou); os bytes são conteúdo de
 * terceiro, e despejá-los em mensagem de erro os levaria ao registro estruturado. O diagnóstico da
 * biblioteca viaja em `cause`, que é interno e não compõe resposta alguma.
 */
export class ErroDeDocumentoIlegivel extends Error {
  /** A posição do documento recusado no arranjo recebido, contada de zero. */
  readonly posicao: number;

  constructor(posicao: number, causa: unknown) {
    super(`documento de origem ilegível na posição ${posicao}`, { cause: causa });
    // `name` é escrito à mão porque a herança de `Error` não o deriva da classe.
    this.name = 'ErroDeDocumentoIlegivel';
    this.posicao = posicao;
  }
}

/**
 * A porta de mesclagem — a única forma de o produto compor um documento a partir de outros prontos.
 *
 * `mesclar` devolve um documento cujas páginas são as das origens, **na ordem em que elas
 * chegaram** e com o conteúdo intacto. Ela **rejeita** quando não pôde produzir o documento inteiro
 * ({@link ErroDeMesclagemSemDocumentos}, {@link ErroDeDocumentoIlegivel}), e a rejeição sobe
 * intacta: devolver um resultado de sucesso/erro obrigaria cada chamador a decidir o que fazer com
 * a falha, e a decisão já está tomada num ponto único — o filtro global.
 */
export interface PortaDeMesclagem {
  mesclar(documentos: readonly Uint8Array[]): Promise<Uint8Array>;
}
