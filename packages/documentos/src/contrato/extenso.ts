/**
 * O valor monetário do documento, nas **duas** formas em que ele aparece — e as duas em pt-BR.
 *
 * ===========================================================================
 * ⚠️ A DV-01 mora aqui, e o veredito está escrito ANTES: `PRODUTO_VENCE`
 * ===========================================================================
 *
 * O legado emite o extenso **em inglês**: `two thousand, ﬁve hundred only reais` está literalmente
 * no golden `contrato-pdf.txt`, produzido por `frappe.utils.money_in_words(v, "BRL")` com o idioma
 * padrão do site. É defeito do legado, não regra de negócio — a §21.1 do tech spec registra o
 * veredito, e a normalização da comparação **não** o absorve: a linha entra na lista de divergência
 * esperada do CT-709.
 *
 * **Não "corrija" esta função para emitir em inglês ao ver a diferença.** O veredito é anterior à
 * execução, e o golden é que carrega o defeito (RN-15).
 *
 * ===========================================================================
 * Por que as duas formas moram no mesmo arquivo
 * ===========================================================================
 *
 * Elas nunca aparecem separadas no documento — a cláusula sétima escreve
 * `R$ 2.500,00 (dois mil e quinhentos reais)`, e a alínea do valor total repete o par. As duas
 * partem do **mesmo** valor convertido em centavos inteiros, e essa conversão é o ponto único de
 * contato com o ponto flutuante: pô-las em módulos distintos duplicaria a conversão, que é
 * exatamente onde um resíduo de arredondamento nasceria em silêncio.
 *
 * ===========================================================================
 * O dinheiro é operado em CENTAVOS INTEIROS, nunca em ponto flutuante
 * ===========================================================================
 *
 * O contrato publicado declara `valorMensal: z.number()` e a camada de dados já converte o
 * `numeric(15,2)` do banco (ADR-0016 — o tipo daqui deriva de lá, e não o redigita). O que esta
 * função faz é **sair do ponto flutuante na primeira linha**: `Math.round(valor * 100)` produz o
 * número exato de centavos para toda a faixa que o produto admite, e todo o resto do algoritmo é
 * aritmética inteira. Formatar direto do `number` — `valor.toFixed(2)` — funcionaria hoje e
 * imprimiria `1234.56` como `1234.55` no dia em que o resíduo do binário caísse para baixo.
 *
 * `Intl.NumberFormat` seria o caminho idiomático e está descartado nesta base por duas razões já
 * medidas em `packages/regua/src/mensagem.ts`: ele exige o `number` (reintroduzindo o ponto
 * flutuante) e, na moeda brasileira, separa `R$` do número por **espaço não separável** (U+00A0),
 * que não é o caractere que o documento do legado imprime.
 *
 * ===========================================================================
 * ⚠️ Aqui se ESCREVE dinheiro; dinheiro DERIVADO não se calcula aqui
 * ===========================================================================
 *
 * O que este arquivo faz é **apresentar** um valor que já chegou decidido — é o lado que a ADR-0023
 * deixa na aplicação (*"serve apenas à apresentação do registro já selecionado"*). Toda derivação
 * monetária — somar, multiplicar por prazo, ratear — é o **outro** lado da mesma `Decision` e vive no
 * banco, em `numeric`. Uma multiplicação em centavos morou aqui e foi removida: ela era o contorno do
 * ponto flutuante para uma conta que, feita em decimal exato, não precisa de contorno nenhum. **Não a
 * reintroduza** — quem precisa do total é a consulta, não o compositor.
 */

/** Quantas casas decimais o produto publica em toda grandeza monetária — `numeric(15,2)`. */
const CASAS_DECIMAIS_DO_VALOR = 2;

/** Quantos centavos formam um real. */
const CENTAVOS_POR_REAL = 100;

/** Onde entra cada separador de milhar: antes de todo trio de dígitos que não abre a cadeia. */
const POSICAO_DO_SEPARADOR_DE_MILHAR = /\B(?=(\d{3})+(?!\d))/gu;

/** Quantos dígitos tem cada grupo de escala — `mil`, `milhão`, `bilhão`, `trilhão`. */
const DIGITOS_POR_GRUPO = 3;

/** Os nomes de 0 a 19, que em português não se compõem de dezena mais unidade. */
const ATE_DEZENOVE = [
  'zero',
  'um',
  'dois',
  'três',
  'quatro',
  'cinco',
  'seis',
  'sete',
  'oito',
  'nove',
  'dez',
  'onze',
  'doze',
  'treze',
  'quatorze',
  'quinze',
  'dezesseis',
  'dezessete',
  'dezoito',
  'dezenove',
] as const;

/** As dezenas exatas de 20 a 90, indexadas pela casa das dezenas. */
const DEZENAS = [
  '',
  '',
  'vinte',
  'trinta',
  'quarenta',
  'cinquenta',
  'sessenta',
  'setenta',
  'oitenta',
  'noventa',
] as const;

/**
 * As centenas de 100 a 900, indexadas pela casa das centenas.
 *
 * O `cento` da posição 1 vale para 101 a 199; a **centena exata** 100 é `cem`, e a exceção é tratada
 * no ponto em que ela ocorre. Declarar `cem` aqui faria `cento e um` sair como `cem e um`.
 */
const CENTENAS = [
  '',
  'cento',
  'duzentos',
  'trezentos',
  'quatrocentos',
  'quinhentos',
  'seiscentos',
  'setecentos',
  'oitocentos',
  'novecentos',
] as const;

/** Uma escala de grupo, com as duas flexões que o português exige. */
interface EscalaDeGrupo {
  readonly singular: string;
  readonly plural: string;
}

/**
 * As escalas dos grupos de três dígitos, do menos significativo ao mais.
 *
 * `mil` é o caso irregular: não flexiona (`dois mil`, nunca `dois mis`) e **não recebe `um`** na
 * frente (`mil reais`, nunca `um mil reais`). As demais flexionam e recebem.
 *
 * ⚠️ **A profundidade desta lista é o alcance do vocabulário** — quatro escalas nomeiam até
 * `999.999.999.999.999` —, e ela é **uma** das duas metades de {@link MAIOR_VALOR_REPRESENTAVEL}: a
 * outra é a aritmética, que estrangula antes. **Nenhuma das duas importa a constante monetária de
 * `@syslocbr/contracts`**, e a ausência é deliberada: o limite aqui é do que esta função sabe nomear e
 * somar, não da coluna que guarda o dinheiro. Ver a conferência do débito **D1 (F3/T2)** no relatório
 * desta task; o marcador dele vive em `packages/contracts/src/cobranca.ts`, e não aqui.
 */
const ESCALAS: readonly EscalaDeGrupo[] = [
  { singular: '', plural: '' },
  { singular: 'mil', plural: 'mil' },
  { singular: 'milhão', plural: 'milhões' },
  { singular: 'bilhão', plural: 'bilhões' },
  { singular: 'trilhão', plural: 'trilhões' },
];

/** O maior número inteiro que {@link ESCALAS} sabe nomear. */
const MAIOR_INTEIRO_NOMEAVEL = 10 ** (ESCALAS.length * DIGITOS_POR_GRUPO) - 1;

/**
 * O maior valor cuja conversão para centavos ainda é **exata** em `number`.
 *
 * Acima de `Number.MAX_SAFE_INTEGER / 100` (≈ 9,007 × 10¹³), `Math.round(valor * 100)` deixa de
 * distinguir centavos vizinhos e o extenso passaria a mentir **em silêncio** — que é o pior desfecho
 * possível para dinheiro num documento assinado. O teto do vocabulário (10¹⁵) é maior que este, e é
 * por isso que o limite efetivo é o menor dos dois: a aritmética estrangula antes da língua.
 *
 * Folga medida contra o produto: `MAIOR_VALOR_MONETARIO` de `@syslocbr/contracts` vale
 * 9.999.999.999.999,99 — uma ordem de grandeza **abaixo** deste teto. A constante de lá **não é
 * importada** de propósito; ver a conferência do débito **D1 (F3/T2)** no relatório da T5 — o
 * marcador dele vive em `packages/contracts/src/cobranca.ts` — e o caso de apoio que afirma que um
 * teto não estrangula o outro.
 */
const MAIOR_VALOR_COM_CENTAVOS_EXATOS = Math.floor(Number.MAX_SAFE_INTEGER / CENTAVOS_POR_REAL);

/** O limite efetivo desta função — o menor entre o que ela sabe nomear e o que ela sabe somar. */
const MAIOR_VALOR_REPRESENTAVEL = Math.min(MAIOR_INTEIRO_NOMEAVEL, MAIOR_VALOR_COM_CENTAVOS_EXATOS);

/**
 * A recusa de um valor que esta função não sabe escrever por extenso.
 *
 * Existe pela mesma razão de {@link ErroDeTipoDePessoaDesconhecido} em `./qualificacao.ts`: um
 * documento com `undefined` — ou com a parte inteira faltando — encaixado no meio da cláusula
 * sétima é pior que documento nenhum, porque ninguém o percebe. O valor recusado viaja em **campo**,
 * e não recortado da mensagem, para que a borda possa registrá-lo sem análise sintática.
 */
export class ErroDeValorForaDeAlcance extends Error {
  /** O valor que a função recusou escrever. */
  readonly valor: number;

  constructor(valor: number) {
    super(`valor monetário fora do alcance do extenso: ${valor}`);
    // `name` é escrito à mão porque a herança de `Error` não o deriva da classe — sem isto, o
    // `stack` e o registro estruturado diriam apenas `Error`.
    this.name = 'ErroDeValorForaDeAlcance';
    this.valor = valor;
  }
}

/**
 * Converte o valor publicado em centavos inteiros, recusando o que não é dinheiro representável.
 *
 * A recusa alcança `NaN`, `Infinity`, valor negativo e valor acima de
 * {@link MAIOR_VALOR_REPRESENTAVEL}. O
 * legado tomava o módulo do negativo em silêncio (`if valor < 0: valor = 0 - valor`) — aqui ele é
 * recusado, porque aluguel negativo é dado corrompido e imprimi-lo como positivo esconderia o
 * defeito dentro de um documento que alguém assina.
 */
function emCentavos(valor: number): number {
  if (!Number.isFinite(valor) || valor < 0 || valor > MAIOR_VALOR_REPRESENTAVEL) {
    throw new ErroDeValorForaDeAlcance(valor);
  }

  return Math.round(valor * CENTAVOS_POR_REAL);
}

/** Escreve por extenso um grupo de 1 a 999 — a unidade de composição de todas as escalas. */
function grupoPorExtenso(grupo: number): string {
  if (grupo === 100) {
    return 'cem';
  }

  const centenas = Math.floor(grupo / 100);
  const resto = grupo % 100;
  const partes: string[] = [];

  if (centenas > 0) {
    partes.push(CENTENAS[centenas] ?? '');
  }

  if (resto > 0 && resto < ATE_DEZENOVE.length) {
    partes.push(ATE_DEZENOVE[resto] ?? '');
  } else if (resto >= ATE_DEZENOVE.length) {
    const dezenas = Math.floor(resto / 10);
    const unidades = resto % 10;
    const dezenaEscrita = DEZENAS[dezenas] ?? '';

    partes.push(
      unidades > 0 ? `${dezenaEscrita} e ${ATE_DEZENOVE[unidades] ?? ''}` : dezenaEscrita,
    );
  }

  return partes.join(' e ');
}

/**
 * Junta os grupos já escritos, do mais significativo ao menos.
 *
 * A regra do português é conhecida e não é uniforme: os grupos se separam por vírgula, **exceto**
 * antes do último, que recebe `e` quando vale menos de cem ou é centena exata. É o que faz
 * `dois mil e quinhentos` e `um milhão e cem` conviverem com `mil, cento e um`. Juntar tudo por
 * vírgula seria mais simples e produziria `dois mil, quinhentos`, que ninguém escreve.
 */
function juntarGrupos(escritos: readonly string[], ultimoGrupo: number): string {
  if (escritos.length <= 1) {
    return escritos[0] ?? '';
  }

  const cabeca = escritos.slice(0, -1).join(', ');
  const cauda = escritos[escritos.length - 1] ?? '';
  const conector = ultimoGrupo < 100 || ultimoGrupo % 100 === 0 ? ' e ' : ', ';

  return `${cabeca}${conector}${cauda}`;
}

/** Escreve por extenso um inteiro não negativo, sem unidade monetária. */
function inteiroPorExtenso(inteiro: number): string {
  if (inteiro === 0) {
    return ATE_DEZENOVE[0];
  }

  const grupos: number[] = [];
  let restante = inteiro;

  while (restante > 0) {
    grupos.push(restante % 10 ** DIGITOS_POR_GRUPO);
    restante = Math.floor(restante / 10 ** DIGITOS_POR_GRUPO);
  }

  const escritos: string[] = [];

  for (let posicao = grupos.length - 1; posicao >= 0; posicao -= 1) {
    const grupo = grupos[posicao] ?? 0;

    if (grupo === 0) {
      continue;
    }

    const escala = ESCALAS[posicao];

    if (escala === undefined) {
      throw new ErroDeValorForaDeAlcance(inteiro);
    }

    if (escala.singular === '') {
      escritos.push(grupoPorExtenso(grupo));
      continue;
    }

    // `mil` sozinho, e não `um mil`: é a irregularidade que a lista de escalas anota.
    const prefixo = grupo === 1 && escala.singular === 'mil' ? '' : `${grupoPorExtenso(grupo)} `;

    escritos.push(`${prefixo}${grupo === 1 ? escala.singular : escala.plural}`);
  }

  return juntarGrupos(escritos, grupos[0] ?? 0);
}

/** A partir de que grandeza a moeda pede a preposição — `um milhão **de** reais`. */
const MENOR_GRANDEZA_COM_PREPOSICAO = 10 ** 6;

/**
 * Decide se a moeda entra precedida de `de`.
 *
 * É a regra do português para as grandezas maiores: `um milhão **de** reais` e
 * `dois bilhões **de** reais`, mas `um milhão e quinhentos mil reais` — a preposição só aparece
 * quando o número termina na própria escala, sem nada abaixo dela. O legado não a emitia (o extenso
 * dele nem em português estava), e omiti-la produziria `um milhão reais` num documento que alguém
 * assina.
 */
function pedePreposicao(parteInteira: number): boolean {
  return (
    parteInteira >= MENOR_GRANDEZA_COM_PREPOSICAO &&
    parteInteira % MENOR_GRANDEZA_COM_PREPOSICAO === 0
  );
}

/**
 * O valor monetário por extenso, em **pt-BR** — `2500` vira `dois mil e quinhentos reais`.
 *
 * A concordância segue o número: `um real` e `um centavo` no singular, `reais` e `centavos` no
 * plural, e `zero reais` para o valor nulo (é o que o legado também produz, pela outra língua). Os
 * centavos só aparecem quando existem — `dois mil e quinhentos reais`, nunca
 * `… reais e zero centavos`.
 */
export function valorPorExtenso(valor: number): string {
  const centavos = emCentavos(valor);
  const parteInteira = Math.floor(centavos / CENTAVOS_POR_REAL);
  const parteCentavos = centavos % CENTAVOS_POR_REAL;

  const moeda = parteInteira === 1 ? 'real' : 'reais';
  const preposicao = pedePreposicao(parteInteira) ? 'de ' : '';
  const reais = `${inteiroPorExtenso(parteInteira)} ${preposicao}${moeda}`;

  if (parteCentavos === 0) {
    return reais;
  }

  const escritos = `${inteiroPorExtenso(parteCentavos)} ${parteCentavos === 1 ? 'centavo' : 'centavos'}`;

  return `${reais} e ${escritos}`;
}

/**
 * O valor monetário na forma que o documento imprime — `2500` vira `R$ 2.500,00`.
 *
 * A cadeia é montada a partir dos centavos inteiros, e não do `number`: o separador de milhar entra
 * por expressão sobre o texto da parte inteira, e os centavos são preenchidos à esquerda. É o mesmo
 * desenho de `formatarValorEmReais` em `packages/regua/src/mensagem.ts`, e pela mesma razão escrita
 * lá.
 */
export function formatarValorEmReais(valor: number): string {
  const centavos = emCentavos(valor);
  const parteInteira = Math.floor(centavos / CENTAVOS_POR_REAL);
  const parteCentavos = centavos % CENTAVOS_POR_REAL;

  const inteiroFormatado = String(parteInteira).replace(POSICAO_DO_SEPARADOR_DE_MILHAR, '.');
  const centavosFormatados = String(parteCentavos).padStart(CASAS_DECIMAIS_DO_VALOR, '0');

  return `R$ ${inteiroFormatado},${centavosFormatados}`;
}
