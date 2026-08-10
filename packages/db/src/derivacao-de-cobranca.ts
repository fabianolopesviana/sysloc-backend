/**
 * A derivação das **parcelas de aluguel** de um contrato, em função pura.
 *
 * ---------------------------------------------------------------------------
 * POR QUE ELA MORA AQUI, E NÃO NO SERVIÇO QUE ATIVA O CONTRATO
 * ---------------------------------------------------------------------------
 *
 * Pelo mesmo critério que já admitiu `somarMetragem` e as duas derivações de
 * `derivacao-de-contrato.ts` no índice do pacote, e a pergunta que
 * aquele índice força tem a mesma resposta: **isto é um caminho para dado? NÃO.** A função não recebe
 * executor, não abre conexão, não toca o banco, não lê relógio e não devolve nada além de uma lista
 * calculada sobre o que já está em mãos.
 *
 * A razão de existir como símbolo **com nome** é o que torna verificável a afirmação da RD-18/RD-19
 * (*"as parcelas nascem de uma derivação só"*): uma segunda derivação apareceria como um segundo
 * símbolo no índice — que o `CT-012` audita por igualdade —, e não como um laço a mais escondido
 * dentro do serviço que ativa o contrato. A contrapartida vale para quem consumir daqui em diante: a
 * regra **não pode vazar de volta** para a ativação. Quem ativa chama esta função e não recalcula
 * nada.
 *
 * ---------------------------------------------------------------------------
 * O ORÁCULO É O GOLDEN — este arquivo reproduz comportamento MEDIDO, não escolhido
 * ---------------------------------------------------------------------------
 *
 * O bloco `cobrancas` de
 * `docs/specs/features/caracterizacao-regras-legadas/v1/golden/contrato-ativacao.json` é o registro
 * capturado do sistema antigo, e é contra ele que `test/derivacao-de-cobranca.spec.ts` afirma parcela
 * a parcela. O que o oráculo fixa, e que **não se lê** no código portado, é o avanço de mês da
 * biblioteca do arcabouço (`frappe.utils.add_months`, que delega a `dateutil.relativedelta`): daí a
 * **saturação de fim de mês** logo abaixo.
 *
 * **Se a implementação divergir do golden, o errado é a implementação.**
 *
 * ---------------------------------------------------------------------------
 * O INÍCIO DE CADA PERÍODO É ITERATIVO, e é o ponto mais fácil de errar da fatia
 * ---------------------------------------------------------------------------
 *
 * `inicio[i] = avançar um mês a partir de inicio[i-1]`, **nunca** `avançar i meses a partir do início
 * original`. A diferença só aparece quando o dia de início não existe em algum mês do caminho, e
 * então a saturação é **herdada** pelos meses seguintes: para `2027-01-31` os inícios são `31/01`,
 * `28/02`, **`28/03`**, `28/04` — a forma intuitiva devolveria `31/03` no terceiro período, porque
 * partiria do 31 original outra vez.
 *
 * A forma intuitiva **passa em todo cenário cujo dia de início seja ≤ 28**, e é por isso que os dois
 * cenários do golden iniciados em `2027-01-31` existem: eles são o discriminador declarado. O
 * `CT-505` escreve o controle não-iterativo **dentro do teste** e afirma a divergência pelo índice do
 * período, para que a discriminação seja medida, e não presumida.
 *
 * ---------------------------------------------------------------------------
 * NENHUMA BIBLIOTECA DE DATAS, E NENHUM `Date` — a ausência é o mecanismo
 * ---------------------------------------------------------------------------
 *
 * A aritmética corre inteira sobre o par (ano, mês, dia) recortado da cadeia `YYYY-MM-DD`, e **não
 * existe um único `Date` neste arquivo**. Isso vai um passo além do irmão `derivacao-de-contrato.ts`,
 * que constrói o instante em UTC, e a razão é que aqui já se escreve o calendário por extenso
 * ({@link ultimoDiaDoMes}): tendo o comprimento do mês em mãos, passar por instante para somar e
 * subtrair um dia seria dar a volta por um objeto que carrega fuso — pelo caminho que as duas
 * proibições abaixo existem para fechar.
 *
 * As duas proibições são **medidas**, não estilísticas, e o `CT-506` as afirma por asserção estática
 * com falsificação:
 *
 *   1. **`new Date(ano, mes, dia)` é proibido** — interpreta os campos no fuso do processo, e a
 *      competência sai deslocada em um dia inteiro para metade dos fusos: em `Pacific/Kiritimati`
 *      (UTC+14) o primeiro dia de janeiro de 2027 lido de volta em UTC é `2026-12-31`.
 *   2. **`Date.UTC(` é proibido** — herda do construtor de `Date` a cláusula que remapeia argumento
 *      de ano entre 0 e 99 para `1900 + ano`, de modo que o valor errado sai com a **forma certa**.
 *      Foi o defeito **D21** da fatia anterior, fechado em 2026-08-09 no commit `3697027`.
 *
 * ---------------------------------------------------------------------------
 * O VENCIMENTO NÃO SATURA, e a ausência de `Math.min` é deliberada
 * ---------------------------------------------------------------------------
 *
 * O dia de vencimento vem do contrato e já está limitado a `[1, 28]` em **dois** lugares que não são
 * este: `esquemaDeContratoNovo` o recusa na borda e o `check` da tabela `negocio.contrato` o recusa
 * no banco (RD-06). Dia 28 existe em todo mês, inclusive em fevereiro comum, então não há o que
 * saturar — e escrever a saturação aqui de qualquer forma seria pior que redundante: ela **esconderia
 * silenciosamente** um dia 31 que tivesse escapado das duas conferências, em vez de deixá-lo produzir
 * uma cadeia obviamente inválida que o banco recusa. A saturação do bloco acima é a do **início do
 * período**, que é outro fato: aquele dia vem da data de início da locação, que não tem teto algum.
 *
 * ---------------------------------------------------------------------------
 * PRÉ-CONDIÇÃO DAS ENTRADAS — de onde elas vêm, e por que não são revalidadas aqui
 * ---------------------------------------------------------------------------
 *
 * Mesmo desenho de `derivarTerminoDaLocacao`: função pura sobre dado **já conferido**.
 * `dataInicioLocacao` chega como `YYYY-MM-DD` de duas origens que o garantem — `z.iso.date()` de
 * `esquemaDeContratoNovo`, na borda, e a projeção `to_char(coluna, 'YYYY-MM-DD')` da porta, na
 * leitura —, e `prazoMeses`, `diaVencimento` e `valorMensal` chegam dentro dos tetos que aquele
 * esquema fixa. Repetir a validação aqui criaria a segunda definição do mesmo fato que a ADR-0016
 * recusa; a única exceção é o prazo impossível, e o motivo dela está em
 * {@link derivarParcelasDoContrato}.
 *
 * ---------------------------------------------------------------------------
 * O QUE ESTA FUNÇÃO NÃO PRODUZ (ADR-0022)
 * ---------------------------------------------------------------------------
 *
 * Nem estado, nem mora, nem código. A parcela nasce como **fato**: competência, vencimento, natureza,
 * referência e valor original. `status`, `diasAtraso`, `valorMulta`, `valorJuros` e `valorTotal` são
 * derivados na visão `negocio.cobranca_derivada`, e o `codigo` sai da série do banco — nenhum dos
 * três tem caminho por aqui, e a ausência é o que mantém a derivação num lugar só.
 */

import type { NaturezaDeCobranca } from '@sysloc/contracts';

/** Quantos meses há num ano — o divisor do avanço no par (ano, mês). */
const MESES_POR_ANO = 12;

/** Fevereiro, pelo número do mês — o único cujo comprimento depende do ano. */
const FEVEREIRO = 2;

/** Os quatro meses de trinta dias, pelo número. */
const MESES_DE_TRINTA_DIAS: ReadonlySet<number> = new Set([4, 6, 9, 11]);

const DIAS_DE_FEVEREIRO_COMUM = 28;
const DIAS_DE_FEVEREIRO_BISSEXTO = 29;
const DIAS_DE_MES_CURTO = 30;
const DIAS_DE_MES_LONGO = 31;

/** Larguras da cadeia `YYYY-MM-DD`, para que o preenchimento com zero não vire número mágico. */
const DIGITOS_DO_ANO = 4;
const DIGITOS_DO_MES_E_DO_DIA = 2;

/**
 * A competência é sempre o primeiro dia do mês.
 *
 * Não é escolha deste arquivo: é a mesma condição que `esquemaDeCobrancaNova` impõe ao lançamento
 * avulso, no `refine` que recusa competência fora do dia 1. Derivar uma parcela com competência no meio
 * do mês produziria pela ativação o que a borda recusa pela rota.
 */
const PRIMEIRO_DIA_DO_MES = 1;

/**
 * A natureza de toda parcela gerada pela ativação.
 *
 * A anotação de tipo — e não um `as` — é o mecanismo: um rótulo fora de `NATUREZAS_DE_COBRANCA`
 * **não compila**, de modo que a única fonte da união continua sendo o contrato (ADR-0016). O literal
 * existe num lugar só neste pacote, e é este.
 */
const NATUREZA_DA_PARCELA: NaturezaDeCobranca = 'ALUGUEL';

/**
 * O separador do período na `referencia`, **como o oráculo o escreve**.
 *
 * É a preposição com crase (`à`), e não um `a` solto nem um travessão: o texto é comparado byte a
 * byte contra o golden, e ele viaja para a tela do Financeiro e para o carnê da fatia 2. Constante
 * nomeada porque é **contrato**, não estética.
 */
const SEPARADOR_DO_PERIODO = ' à ';

/**
 * O que a derivação precisa saber do contrato — e nada mais.
 *
 * Quatro campos, todos já conferidos na borda. O tipo é declarado aqui, e não importado de
 * `ContratoPersistido`, porque a função é pura sobre **valores**: amarrá-la à linha do banco a faria
 * exigir os outros vinte campos do agregado para calcular quatro cadeias. Ele não é publicado no
 * índice do pacote pelo mesmo critério — quem chama passa o contrato que já tem em mãos.
 */
export interface ContratoParaParcelas {
  /** Data de início da locação, em `YYYY-MM-DD`. */
  readonly dataInicioLocacao: string;
  /** Prazo da locação em meses — inteiro não negativo; é ele que fixa a quantidade de parcelas. */
  readonly prazoMeses: number;
  /** Dia do mês do vencimento, já limitado a `[1, 28]` pela borda e pelo banco (RD-06). */
  readonly diaVencimento: number;
  /** Valor mensal da locação, com no máximo duas casas decimais. */
  readonly valorMensal: number;
}

/**
 * Uma parcela derivada — os **cinco** fatos que a cobrança de aluguel nasce carregando (ADR-0022).
 *
 * É exatamente `DadosDaCobranca` menos o `contratoId`, e a coincidência é deliberada: quem grava em
 * lote recebe o contrato uma vez e as parcelas N vezes. Estado, mora e código **não estão aqui** —
 * ver o fim do cabeçalho.
 */
export interface ParcelaDerivada {
  /** Sempre `ALUGUEL` — ver {@link NATUREZA_DA_PARCELA}. */
  readonly natureza: NaturezaDeCobranca;
  /** O período coberto, no formato do oráculo: `DD/MM/YYYY à DD/MM/YYYY`. */
  readonly referencia: string;
  /** O primeiro dia do mês de competência, em `YYYY-MM-DD`. */
  readonly competencia: string;
  /** O vencimento, em `YYYY-MM-DD` — dia {@link ContratoParaParcelas.diaVencimento} da competência. */
  readonly dataVencimento: string;
  /** O valor mensal da locação, repetido em toda parcela. */
  readonly valorOriginal: number;
}

/** Uma data de calendário decomposta — a forma em que toda a aritmética deste arquivo corre. */
interface DataDeCalendario {
  readonly ano: number;
  readonly mes: number;
  readonly dia: number;
}

/**
 * As `prazoMeses` parcelas de aluguel de um contrato (RD-18, RD-19).
 *
 * A parcela de índice `i` cobre o período que começa em `inicio[i]` e termina na **véspera** de
 * `inicio[i+1]`, com `inicio[0] = dataInicioLocacao` e cada início seguinte obtido avançando **um**
 * mês a partir do anterior, com saturação no último dia do mês de destino. É a reprodução de
 * `add_days(add_months(inicio, 1), -1)` do sistema antigo, aplicada **em cadeia** — ver o cabeçalho
 * para a razão de a cadeia importar.
 *
 * A competência é o primeiro dia do mês de `inicio[i]`, e o vencimento é o dia `diaVencimento` desse
 * mesmo mês. As duas saem do cursor iterativo, e podem: a saturação altera o **dia** do início e
 * nunca o mês, de modo que o mês de `inicio[i]` é sempre o mês de início mais `i`.
 *
 * ---------------------------------------------------------------------------
 * Prazo zero devolve lista vazia; prazo impossível LEVANTA
 * ---------------------------------------------------------------------------
 *
 * Zero é resultado aritmético legítimo — zero mês coberto, zero parcela —, e a ativação tem caminho
 * declarado para gerar parcela nenhuma (RD-20). Prazo **negativo ou fracionário** não tem leitura
 * aritmética: a comparação do laço o converteria em lista vazia (ou em `N` truncado) e a ativação
 * gravaria menos parcelas do que o contrato prevê **sem nada acusando**. A guarda não é revalidação
 * do contrato de negócio — o piso `1` e o teto continuam sendo do `esquemaDeContratoNovo` e do
 * `check` do banco —, é a recusa de produzir silêncio a partir de entrada impossível.
 *
 * @param contrato os quatro campos do contrato que a derivação consome
 * @returns as parcelas, em ordem de competência crescente
 * @throws RangeError quando `prazoMeses` não é inteiro não negativo
 */
export function derivarParcelasDoContrato(
  contrato: ContratoParaParcelas,
): readonly ParcelaDerivada[] {
  const { dataInicioLocacao, prazoMeses, diaVencimento, valorMensal } = contrato;

  if (!Number.isInteger(prazoMeses) || prazoMeses < 0) {
    // Sem o valor na mensagem, de propósito: ela pode alcançar o registro estruturado, e a entrada
    // recusada não viaja em texto de erro neste repositório.
    throw new RangeError('prazoMeses precisa ser um inteiro não negativo');
  }

  const parcelas: ParcelaDerivada[] = [];

  // O CURSOR é o que faz a saturação ser herdada: ele guarda o início REAL do período corrente, já
  // saturado, e o avanço seguinte parte dele — nunca da data de início original. Trocar este cursor
  // por `avancarMeses(inicioOriginal, i)` é o defeito que o `CT-505` mede.
  let inicioDoPeriodo = lerData(dataInicioLocacao);

  for (let indice = 0; indice < prazoMeses; indice += 1) {
    const inicioDoPeriodoSeguinte = avancarUmMesComSaturacao(inicioDoPeriodo);
    const competencia = {
      ano: inicioDoPeriodo.ano,
      mes: inicioDoPeriodo.mes,
      dia: PRIMEIRO_DIA_DO_MES,
    };

    parcelas.push({
      natureza: NATUREZA_DA_PARCELA,
      referencia: montarReferencia(inicioDoPeriodo, recuarUmDia(inicioDoPeriodoSeguinte)),
      competencia: formatarEmIso(competencia),
      // O vencimento NÃO satura — ver o cabeçalho. O dia vem do contrato como está.
      dataVencimento: formatarEmIso({ ...competencia, dia: diaVencimento }),
      valorOriginal: valorMensal,
    });

    inicioDoPeriodo = inicioDoPeriodoSeguinte;
  }

  return parcelas;
}

/**
 * O período coberto, no formato exato do oráculo: `31/01/2027 à 27/02/2027`.
 *
 * As duas pontas são **inclusivas**: o fim é a véspera do início do período seguinte, e é o que faz
 * dois períodos consecutivos não se sobreporem nem deixarem um dia de fora.
 */
function montarReferencia(inicio: DataDeCalendario, fim: DataDeCalendario): string {
  return `${formatarEmDiaMesAno(inicio)}${SEPARADOR_DO_PERIODO}${formatarEmDiaMesAno(fim)}`;
}

/** As três componentes de uma data `YYYY-MM-DD`, recortadas por posição. */
function lerData(cadeia: string): DataDeCalendario {
  // As posições são fixas na cadeia. Recortar por posição, e não por `split`, é o que dispensa
  // tratar a fatia ausente que `noUncheckedIndexedAccess` obrigaria a considerar.
  return {
    ano: Number(cadeia.slice(0, DIGITOS_DO_ANO)),
    mes: Number(cadeia.slice(5, 7)),
    dia: Number(cadeia.slice(8, 10)),
  };
}

/**
 * Um mês adiante, **saturando** o dia no último dia do mês de destino.
 *
 * A contagem corre em meses absolutos desde o ano zero para que o transbordo de dezembro seja
 * aritmética, e não um ramo condicional que alguém possa esquecer de escrever — mesma forma de
 * `derivarTerminoDaLocacao`.
 *
 * A saturação é o que decide o início de **todo** período subsequente de um contrato iniciado em 29,
 * 30 ou 31: `31/01/2027` mais um mês não é `31/02`, é `28/02` — e, porque o resultado volta ao cursor,
 * o período seguinte parte do 28.
 */
function avancarUmMesComSaturacao(data: DataDeCalendario): DataDeCalendario {
  const mesesAbsolutos = data.ano * MESES_POR_ANO + (data.mes - 1) + 1;
  const ano = Math.floor(mesesAbsolutos / MESES_POR_ANO);
  const mes = mesesAbsolutos - ano * MESES_POR_ANO + 1;

  return { ano, mes, dia: Math.min(data.dia, ultimoDiaDoMes(ano, mes)) };
}

/**
 * A véspera de uma data — o `-1 dia` que fecha cada período.
 *
 * Escrito sobre o par (ano, mês, dia) porque o calendário já está declarado neste arquivo: subtrair
 * milissegundos de um instante exigiria construí-lo, e toda construção de instante é o que este
 * arquivo recusa por inteiro (ver o cabeçalho).
 */
function recuarUmDia(data: DataDeCalendario): DataDeCalendario {
  if (data.dia > PRIMEIRO_DIA_DO_MES) {
    return { ...data, dia: data.dia - 1 };
  }

  // Primeiro dia do mês: a véspera é o último dia do mês anterior, e janeiro volta um ano.
  const ano = data.mes === 1 ? data.ano - 1 : data.ano;
  const mes = data.mes === 1 ? MESES_POR_ANO : data.mes - 1;

  return { ano, mes, dia: ultimoDiaDoMes(ano, mes) };
}

/** A data em `YYYY-MM-DD` — a forma em que ela viaja para a coluna `date` e para o JSON. */
function formatarEmIso({ ano, mes, dia }: DataDeCalendario): string {
  return [
    String(ano).padStart(DIGITOS_DO_ANO, '0'),
    String(mes).padStart(DIGITOS_DO_MES_E_DO_DIA, '0'),
    String(dia).padStart(DIGITOS_DO_MES_E_DO_DIA, '0'),
  ].join('-');
}

/** A data em `DD/MM/YYYY` — a forma que **só** a `referencia` usa, porque é a do oráculo. */
function formatarEmDiaMesAno({ ano, mes, dia }: DataDeCalendario): string {
  return [
    String(dia).padStart(DIGITOS_DO_MES_E_DO_DIA, '0'),
    String(mes).padStart(DIGITOS_DO_MES_E_DO_DIA, '0'),
    String(ano).padStart(DIGITOS_DO_ANO, '0'),
  ].join('/');
}

// DÉBITO COM GATILHO — D26 · F3/T8 · registrado 2026-08-10
// (NÃO é uma `DECISÃO FECHADA`: ele agenda uma mudança, não protege as duas funções abaixo.)
// O QUÊ: `ultimoDiaDoMes` e `ehBissexto` são a SEGUNDA escrita da regra gregoriana no pacote — a
//        primeira são os acessórios homônimos de `derivacao-de-contrato.ts`, que são internos de lá
//        (o `CT-012` registra a ausência deles no índice como deliberada). Duas cópias podem
//        divergir, e as duas decidem data que o cliente lê.
// QUANDO FECHA: no TERCEIRO consumidor de aritmética de calendário do pacote — a régua de vencimento
//        da F5 e o carnê da fatia 2 são os candidatos óbvios. Aí as duas sobem para um módulo de
//        calendário próprio, com os call sites ajustados no mesmo commit.
// POR QUE NÃO AGORA: promover exigiria alterar a superfície de um módulo estável, com decisões
//        registradas e provado contra o golden, fora dos arquivos desta task; e com dois
//        consumidores a cópia local — cada uma provada contra o MESMO oráculo, e a de fevereiro
//        exercitada pelos cenários de virada dos dois — ainda é mais barata que a promoção.
// ÍNDICE: docs/specs/features/cobranca-e-mora/v1/_run/run-report.md §2, D26

/**
 * O último dia de um mês, pela regra gregoriana escrita por extenso.
 *
 * Ela **não** é perguntada a um `Date` (`new Date(ano, mes, 0).getDate()`, a forma idiomática) por
 * duas razões, e a segunda é a que decide: aquela forma constrói o instante no fuso do processo — o
 * que este arquivo recusa por inteiro —, e a regra bissexta é justamente o comportamento que a
 * derivação **declara** em vez de herdar de terceiro.
 */
function ultimoDiaDoMes(ano: number, mes: number): number {
  if (mes === FEVEREIRO) {
    return ehBissexto(ano) ? DIAS_DE_FEVEREIRO_BISSEXTO : DIAS_DE_FEVEREIRO_COMUM;
  }

  return MESES_DE_TRINTA_DIAS.has(mes) ? DIAS_DE_MES_CURTO : DIAS_DE_MES_LONGO;
}

/**
 * A regra bissexta gregoriana: divisível por 4, salvo os séculos que não são divisíveis por 400.
 *
 * A exceção do século não é ornamento — o golden exercita 2027 (comum) e 2028 (bissexto), e é a
 * primeira que decide a saturação dos dois cenários iniciados em `2027-01-31`.
 */
function ehBissexto(ano: number): boolean {
  return (ano % 4 === 0 && ano % 100 !== 0) || ano % 400 === 0;
}
