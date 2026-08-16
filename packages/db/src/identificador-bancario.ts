/**
 * O identificador da cobrança perante o provedor — o **consumo do contador** e a **composição das 18
 * posições**.
 *
 * ===========================================================================
 * O banco entrega o NÚMERO; o texto nasce aqui
 * ===========================================================================
 *
 * A divisão é a mesma das duas séries anteriores do produto (`CTR-{ano}-{5 dígitos}` e
 * `COB-{ano}-{7 dígitos}`): a sequência vive no banco, atrás de uma função `SECURITY DEFINER`, e o
 * texto publicado é composto pela aplicação. O que muda é **de quem** é a série — e essa diferença é
 * o assunto do bloco seguinte.
 *
 * ===========================================================================
 * O ESCOPO desta série é o SaaS, e a assinatura sem parâmetro é o mecanismo (ADR-0033)
 * ===========================================================================
 *
 * `plataforma.proximo_identificador_bancario()` **não recebe parâmetro algum**. Não é economia de
 * assinatura: é o que torna **irrepresentável** pedir o próximo identificador em nome de uma empresa.
 * A unicidade aqui é exigida por um terceiro que não conhece a fronteira de empresa — duas
 * imobiliárias emitindo o mesmo número no mesmo mês é o defeito que o sistema antigo tinha, pela
 * razão oposta —, e por isso o contador vive em `plataforma`, sem coluna de empresa (ADR-0031).
 *
 * ⚠️ **A ADR-0015 está `superseded-by:0033`.** Não "corrija" este contador para ser por empresa
 * citando o quantificador universal dela (*"todo contador sequencial deste produto é único por
 * empresa"*): é exatamente essa oração que esta série falsifica, e foi o que motivou a substituição.
 * O `DECISÃO FECHADA — F4/T4` do bloco 3 de `migracoes/0016_seguranca_bancaria.sql` é a outra ponta
 * da mesma decisão; leia-o antes de mexer na chamada abaixo.
 *
 * ===========================================================================
 * O avanço NÃO participa do desfazimento (ADR-0020)
 * ===========================================================================
 *
 * `nextval` é imune a `ROLLBACK`, e é isso — não a disciplina de quem chama — que faz o número
 * **nunca** ser reusado. As duas consequências são aceitas e escritas: **furo na sequência é aceito**
 * (o preço de criações concorrentes não esperarem umas pelas outras) e o número queimado por uma
 * unidade abortada não volta. No teto declarado (`MAXVALUE 999999999999`, `NO CYCLE`) a sequência
 * **levanta** em vez de reciclar — número fora de forma nunca é produzido (RN-07).
 *
 * ===========================================================================
 * O relógio mora no BANCO (ADR-0026)
 * ===========================================================================
 *
 * A competência sai de `negocio.data_corrente_da_operacao()`, cujo fuso é do **objeto**
 * (`America/Sao_Paulo`, fixado na migração `0010`) justamente para que quem consulta não possa
 * mudá-lo. **Nenhum `new Date()` decide comportamento neste módulo**: a decisão que consome o
 * instante — {@link comporIdentificadorBancario} — é **pura** e o recebe por parâmetro, que é a forma
 * literal que aquela ADR fixa.
 *
 * O prefixo é `AAAAMM`, e ele é **extração** de ano e mês, não regra gregoriana: nada aqui toca
 * `ultimoDiaDoMes` nem `ehBissexto`, de modo que o `DÉBITO COM GATILHO — D26` de
 * `./derivacao-de-cobranca.ts` **não** dispara. Pela mesma razão, o `D14` de `./envio-de-cobranca.ts`
 * não dispara: esta fatia **consome** a data corrente da operação e não a redefine.
 *
 * ===========================================================================
 * A largura sai do CONTRATO — IMPORTADA, nem redigitada nem medida
 * ===========================================================================
 *
 * `@sysloc/contracts` é a fonte única da forma (ADR-0016), e as duas larguras que a compõem —
 * `LARGURA_DA_COMPETENCIA` e `LARGURA_DO_CONTADOR` — chegam aqui **pelo nome que aquele módulo
 * publica**. Redigitar `12` neste arquivo criaria a **segunda declaração executável do mesmo
 * formato**, que é a forma exata do débito `D14` que a fase anterior deixou aberta sobre o fuso:
 * dois fatos dizendo a mesma coisa, livres para divergir.
 *
 * A primeira rodada da T6 obteve a largura **medindo** o esquema publicado — iterando larguras até a
 * primeira cadeia de zeros aceita —, porque as duas constantes eram privadas naquele módulo. A
 * medição saiu na rodada 2, por achado do Gate 2: ela acoplava este pacote a uma propriedade que o
 * contrato **nunca prometeu** (que a menor cadeia de zeros aceita fosse a largura total) e assumia a
 * dependência sobre um fato privado **sem interface declarada**, de modo que o dono do contrato não
 * tinha como saber que tinha um consumidor, nem como protegê-lo por caso do lado dele. Publicar as
 * duas larguras cumpriu, literalmente, a condição de saída que o marcador daquela rodada escreveu —
 * *"provar que `@sysloc/contracts` publica a largura como símbolo importável"* —, e por isso o
 * marcador saiu junto com a maquinaria que ele protegia. **Hoje a largura é importada: nada aqui a
 * redigita, e nada aqui a mede.**
 */

import { LARGURA_DA_COMPETENCIA, LARGURA_DO_CONTADOR } from '@sysloc/contracts';
import type { TransactionSql } from 'postgres';

/**
 * O formato com que o **banco** escreve a competência.
 *
 * Ele é o argumento de `to_char` na consulta abaixo, e só isso. A **largura** da competência não sai
 * mais daqui: ela é importada do contrato, junto com a do contador. Derivá-la do comprimento desta
 * cadeia parecia impossível de divergir, e não é em geral — a igualdade entre o molde de `to_char` e
 * o comprimento da saída vale para os moldes **numéricos** (`YYYYMM`, `MON`), mas não para todos
 * (`Month` tem molde de 5 e saída de 9).
 */
const FORMATO_DA_COMPETENCIA = 'YYYYMM';

/** O algarismo com que o contador é preenchido à esquerda. */
const ALGARISMO_DE_PREENCHIMENTO = '0';

/**
 * Quantas posições o contador ocupa no identificador — o preenchimento é à **esquerda**, com zeros.
 *
 * É o nome com que **este** pacote publica a largura que o contrato declara: o valor tem uma origem
 * só, e o índice de `@sysloc/db` carrega o nome do domínio de quem o consome (`…_BANCARIO`), sem
 * criar um segundo fato. Ela é publicada porque a emissão (fatia ii) precisa dela para decompor o
 * identificador que devolveu ao provedor, e porque ter a largura com **nome** é o que torna
 * verificável a afirmação de que ela existe num lugar só: uma segunda largura apareceria como um
 * segundo símbolo no índice do pacote — que o `CT-012` audita por igualdade —, e não como um
 * `padStart(12, …)` escondido.
 */
export const LARGURA_DO_CONTADOR_BANCARIO = LARGURA_DO_CONTADOR;

/** O maior contador que cabe na largura declarada — e o teto que a sequência do banco também declara. */
const MAIOR_CONTADOR_BANCARIO = 10 ** LARGURA_DO_CONTADOR_BANCARIO - 1;

/**
 * O contador não cabe na largura declarada do identificador.
 *
 * É **classe de erro**, e não caminho para dado: ela sai do índice do pacote pelo mesmo critério de
 * `ErroDeUnidadeAninhada` e de `ErroDeCodigoDeCobrancaEmUso`, para que quem a traduza reconheça a
 * recusa pelo tipo e não pelo texto da mensagem — que amarraria a tradução ao idioma do servidor.
 *
 * A mensagem **não ecoa o valor recusado**, de propósito: ela pode alcançar o registro estruturado.
 * Mesma decisão de `emitirNumerosDeCobranca` em `./cobranca.ts`.
 */
export class ErroDeContadorForaDaLargura extends Error {
  override readonly name: string = 'ErroDeContadorForaDaLargura';

  /** A largura que o contrato declara — é ela que a recusa defende, e não um limite deste módulo. */
  readonly largura: number;

  constructor() {
    super('o contador não cabe na largura declarada do identificador perante o provedor');
    this.largura = LARGURA_DO_CONTADOR_BANCARIO;
  }
}

/**
 * Compõe as 18 posições do identificador: a competência `AAAAMM` seguida do contador preenchido à
 * esquerda com zeros.
 *
 * ---------------------------------------------------------------------------
 * A composição é TOTAL — nenhuma cadeia fora de forma existe, nem como intermediária
 * ---------------------------------------------------------------------------
 *
 * As duas conferências acontecem **antes** de qualquer concatenação, e a ordem é conteúdo: compor
 * primeiro e conferir depois deixaria a cadeia de 19 posições existir como valor intermediário —
 * pronta para ser registrada, transportada ou devolvida por um ramo de erro futuro. O formato é
 * imposto pelo provedor, e um identificador com uma posição a mais é recusado longe da causa.
 *
 * É a assimetria deliberada em relação a `formatarCodigoDeCobranca` de `@sysloc/contracts`, que
 * **deixa crescer** o sequencial: lá o excesso produziria colisão dentro do produto, que a restrição
 * de unicidade recusa na hora; aqui ele produziria um número que só o provedor rejeitaria.
 *
 * A recusa do contador é **nomeada** ({@link ErroDeContadorForaDaLargura}) porque é a única das duas
 * que uma emissão legítima pode alcançar — no teto da sequência. A da competência é `RangeError`,
 * como em `emitirNumerosDeCobranca`: ela só é alcançável por defeito de programação, já que o único
 * produtor de competência do produto é {@link proximoIdentificadorBancario}, que a lê do banco no
 * formato declarado.
 *
 * A função é **pura**: não recebe executor, não toca o banco e não lê relógio (ADR-0026).
 */
export function comporIdentificadorBancario(competencia: number, contador: number): string {
  const competenciaEmTexto = String(competencia);

  if (competenciaEmTexto.length !== LARGURA_DA_COMPETENCIA) {
    // Sem o valor na mensagem, de propósito: ela pode alcançar o registro estruturado.
    throw new RangeError('a competência do identificador perante o provedor não tem `AAAAMM`');
  }

  if (!Number.isInteger(contador) || contador < 0 || contador > MAIOR_CONTADOR_BANCARIO) {
    throw new ErroDeContadorForaDaLargura();
  }

  const contadorEmTexto = String(contador).padStart(
    LARGURA_DO_CONTADOR_BANCARIO,
    ALGARISMO_DE_PREENCHIMENTO,
  );

  return `${competenciaEmTexto}${contadorEmTexto}`;
}

/**
 * Consome o contador do SaaS e devolve o identificador perante o provedor, já composto.
 *
 * ---------------------------------------------------------------------------
 * As duas leituras viajam numa CONSULTA só
 * ---------------------------------------------------------------------------
 *
 * O contador e a competência são independentes — nenhuma depende do valor da outra —, e dentro de
 * uma unidade de trabalho aberta cada ida ao banco segura uma conexão de um pool compartilhado entre
 * empresas. É a mesma razão que faz `emitirNumerosDeCobranca` emitir N números numa viagem: o que a
 * forma economiza é **viagem**, nunca avanço do contador, que continua sendo exatamente um.
 *
 * A empresa **não** é parâmetro, e não é omissão: a função do banco não a recebe, e é essa ausência
 * que torna irrepresentável pedir o identificador em nome de uma empresa (ADR-0033). A transação
 * segue correndo sob o contexto que a unidade de trabalho fixou — ele apenas não participa desta
 * emissão.
 *
 * O número volta como `bigint`, que o driver entrega em cadeia de caracteres; a conversão explícita é
 * o que impede o contador de chegar à composição como texto — e o teto declarado da sequência cabe
 * folgadamente no inteiro seguro do runtime.
 */
export async function proximoIdentificadorBancario(tx: TransactionSql): Promise<string> {
  const [linha] = await tx<{ competencia: number; contador: string }[]>`
    SELECT to_char(negocio.data_corrente_da_operacao(), ${FORMATO_DA_COMPETENCIA}::text)::integer
             AS competencia,
           plataforma.proximo_identificador_bancario() AS contador
  `;

  if (linha === undefined) {
    // Inalcançável: a consulta é escalar e sem predicado, e a função ou devolve o número ou levanta.
    // O ramo existe porque o tipo do driver admite o arranjo vazio, e um `as` no lugar dele deixaria
    // um `NaN` virar identificador perante o provedor.
    throw new Error('o banco não devolveu o próximo identificador perante o provedor');
  }

  return comporIdentificadorBancario(linha.competencia, Number(linha.contador));
}
