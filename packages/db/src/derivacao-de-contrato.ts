/**
 * As duas derivações da ativação — **o término da locação e o valor total**, em funções puras.
 *
 * ---------------------------------------------------------------------------
 * POR QUE ELAS MORAM AQUI, E NÃO NO SERVIÇO QUE AS CHAMA
 * ---------------------------------------------------------------------------
 *
 * Pelo mesmo critério que já admitiu {@link ../imovel.ts | somarMetragem} no índice do pacote, e a
 * pergunta que aquele índice força tem a mesma resposta: **isto é um caminho para dado? NÃO.** As
 * duas funções não recebem executor, não abrem conexão, não tocam o banco e não devolvem nada além
 * de um valor calculado sobre o que já está em mãos.
 *
 * A razão de existirem como símbolos **com nome** é o que torna verificável a afirmação da RD-10
 * (*"a derivação acontece num lugar só"*): uma segunda derivação apareceria como um segundo símbolo
 * no índice — que o `CT-012` audita por igualdade —, e não como uma linha a mais escondida dentro de
 * uma consulta ou de um serviço. É o mesmo mecanismo do *ponto único de soma* da fatia anterior.
 *
 * A contrapartida da disciplina é uma proibição, e ela vale para quem consumir daqui em diante: a
 * regra **não pode vazar de volta** para o serviço de ativação. Quem ativa chama estas funções e não
 * recalcula nada.
 *
 * ---------------------------------------------------------------------------
 * O ORÁCULO É O GOLDEN — este arquivo reproduz comportamento MEDIDO, não escolhido
 * ---------------------------------------------------------------------------
 *
 * O término da locação é a reprodução de `add_days(add_months(inicio, prazo), -1)`, que é o que o
 * sistema antigo executa. O detalhe que decide o resultado — a **saturação de fim de mês** — mora na
 * biblioteca do arcabouço (`frappe.utils.add_months` delega a `dateutil.relativedelta`) e, por isso,
 * **não se lê no código portado**. Ela foi capturada em
 * `docs/specs/features/caracterizacao-regras-legadas/v1/golden/contrato-ativacao.json`, que é o
 * oráculo, e é contra ele que `test/derivacao-de-contrato.spec.ts` afirma caso a caso.
 *
 * Exemplo verificável, e é ele que o aceite da task nomeia: início **`2026-01-31`**, prazo **1** →
 * o avanço satura em `2026-02-28` (fevereiro não tem 31) → menos um dia → **`2026-02-27`**.
 *
 * ---------------------------------------------------------------------------
 * NENHUMA BIBLIOTECA DE DATAS, e a ausência é o ponto
 * ---------------------------------------------------------------------------
 *
 * A operação é elementar, e a razão de escrevê-la é que o comportamento seja **declarado por nós** e
 * provado contra o oráculo, em vez de herdado por acaso de uma terceira implementação que ninguém
 * declarou como contrato. É também por isso que {@link ultimoDiaDoMes} escreve a regra bissexta
 * gregoriana por extenso em vez de perguntá-la a um `Date`: a regra é justamente o que está sob
 * prova, e lê-la de outro lugar a devolveria ao estado de coisa herdada.
 *
 * ---------------------------------------------------------------------------
 * DATA É CADEIA, E A ARITMÉTICA CORRE EM UTC — leia antes de "simplificar"
 * ---------------------------------------------------------------------------
 *
 * As duas funções recebem e devolvem `YYYY-MM-DD`, e toda construção de instante passa por
 * {@link Date.UTC}. **Nunca `new Date(ano, mes, dia)`**, que interpreta os campos no fuso do
 * processo: um `date` construído assim e reserializado desloca a data em **um dia inteiro** para
 * metade dos fusos — em `Pacific/Kiritimati` (UTC+14), `2027-02-28` local vira `2027-02-27` em UTC.
 * E é precisamente `dataFimLocacao` que o CA-20 compara contra o oráculo, de modo que o defeito
 * apareceria como divergência com o legado numa máquina e não em outra. O `CT-432` mede os três
 * fusos.
 *
 * ---------------------------------------------------------------------------
 * PRÉ-CONDIÇÃO DAS ENTRADAS — de onde elas vêm, e por que não são revalidadas aqui
 * ---------------------------------------------------------------------------
 *
 * Mesmo desenho de `somarMetragem`: função pura sobre dado **já conferido**. `dataInicio` chega
 * como `YYYY-MM-DD` de duas origens, e as duas o garantem — `z.iso.date()` de
 * `esquemaDeContratoNovo`, na borda, e a projeção `to_char(coluna, 'YYYY-MM-DD')` da porta, na
 * leitura. `prazoMeses` e `valorMensal` chegam dentro dos tetos que `esquemaDeContratoNovo` fixa, e
 * é a conferência **conjunta** de lá que mantém `emCentavos(valorMensal) × prazoMeses` dentro da
 * capacidade de `numeric(15,2)` — isto é, folgadamente dentro do inteiro seguro de JavaScript.
 * Repetir a validação aqui criaria a segunda definição do mesmo fato que a ADR-0016 recusa.
 */

/** Quantos meses há num ano — o divisor do avanço no par (ano, mês). */
const MESES_POR_ANO = 12;

/** O passo terminal do cálculo, em milissegundos. Em UTC não há hora de verão a encurtar o dia. */
const MILISSEGUNDOS_POR_DIA = 24 * 60 * 60 * 1000;

/** A escala de `numeric(15,2)` expressa como inteiro — ver {@link derivarValorTotal}. */
const CENTAVOS_POR_UNIDADE = 100;

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
 * A data de fim da locação (RD-10) — **a única derivação de término escrita neste repositório**.
 *
 * Reproduz `add_days(add_months(inicio, prazo), -1)` do sistema antigo, em três passos:
 *
 * 1. avançar `prazoMeses` no par (ano, mês);
 * 2. **saturar** o dia no último dia do mês de destino, quando o dia de início não existe lá;
 * 3. subtrair um dia.
 *
 * O passo 2 é o que decide a data de fim de **todo** contrato iniciado em 29, 30 ou 31, e o passo 3
 * é o que faz o contrato terminar na véspera do mês seguinte, e não no dia. Os dois são
 * independentes, e cada um tem o próprio mutante registrado no cabeçalho da suíte: sem a saturação,
 * os cenários de virada do golden divergem; sem o `-1 dia`, `2026-01-31 + 1 mês` daria `2026-02-28`
 * em vez de `2026-02-27`.
 *
 * @param dataInicio data de início da locação, em `YYYY-MM-DD`
 * @param prazoMeses prazo da locação em meses, inteiro positivo
 * @returns a data de fim da locação, em `YYYY-MM-DD`
 */
export function derivarTerminoDaLocacao(dataInicio: string, prazoMeses: number): string {
  // As posições são fixas na cadeia `YYYY-MM-DD`. Recortar por posição, e não por `split`, é o que
  // dispensa tratar a fatia ausente que `noUncheckedIndexedAccess` obrigaria a considerar.
  const ano = Number(dataInicio.slice(0, DIGITOS_DO_ANO));
  const mes = Number(dataInicio.slice(5, 7));
  const dia = Number(dataInicio.slice(8, 10));

  // --- Passo 1: avançar no par (ano, mês) --------------------------------------------------------
  //
  // A contagem corre em meses absolutos desde o ano zero para que o transbordo de dezembro seja
  // aritmética, e não um ramo condicional que alguém possa esquecer de escrever.
  const mesesAbsolutos = ano * MESES_POR_ANO + (mes - 1) + prazoMeses;
  const anoDeDestino = Math.floor(mesesAbsolutos / MESES_POR_ANO);
  const mesDeDestino = mesesAbsolutos - anoDeDestino * MESES_POR_ANO + 1;

  // --- Passo 2: SATURAÇÃO -----------------------------------------------------------------------
  //
  // O dia de início não existe em todo mês de destino, e é aqui que a diferença aparece:
  // `2026-01-31` mais 1 mês satura em `2026-02-28`, porque fevereiro de 2026 não tem 31 dias — e o
  // passo 3 abaixo o leva a `2026-02-27`, que é o valor que o sistema antigo produz. Sem esta
  // linha, o mês de destino receberia dia 31 e a construção UTC transbordaria para março.
  const diaSaturado = Math.min(dia, ultimoDiaDoMes(anoDeDestino, mesDeDestino));

  // --- Passo 3: menos um dia --------------------------------------------------------------------
  //
  // `Date.UTC`, nunca `new Date(ano, mes, dia)`: a segunda forma lê o fuso do processo e deslocaria
  // o resultado em um dia inteiro em metade dos fusos (ver o cabeçalho, e o `CT-432`).
  const inicioDoDiaDeDestino = Date.UTC(anoDeDestino, mesDeDestino - 1, diaSaturado);

  return formatarEmUtc(new Date(inicioDoDiaDeDestino - MILISSEGUNDOS_POR_DIA));
}

/**
 * O valor total do contrato (RD-10) — `valorMensal × prazoMeses`, **em centavos inteiros**.
 *
 * Mesmo desenho, e mesma razão medida, de `somarMetragem`: multiplicar diretamente em ponto
 * flutuante produz resíduo binário em combinações perfeitamente legítimas — `500.03 × 13` dá
 * `6500.389999999999` —, e esse resíduo viajaria no JSON como `valorTotalContrato`, num campo que o
 * cliente exibe. Multiplicar os centavos como inteiros e dividir **uma vez** no fim mantém o
 * resultado exato dentro do domínio que a coluna `numeric(15,2)` admite.
 *
 * O `Math.round` fecha o outro lado, e ele também é medido: o número que chega já veio de um
 * `numeric(15,2)` convertido, de modo que multiplicá-lo por cem pode render um valor abaixo do
 * inteiro — `512.05 × 100` dá `51204.99999999999`. Truncar devolveria `3072.24` para seis meses,
 * onde o valor correto é `3072.30`; é o **arredondamento**, e não o truncamento, que devolve o
 * centavo que a coluna guardava.
 *
 * @param valorMensal valor mensal da locação, com no máximo duas casas decimais
 * @param prazoMeses prazo da locação em meses, inteiro positivo
 * @returns o valor total do contrato, exato em duas casas
 */
export function derivarValorTotal(valorMensal: number, prazoMeses: number): number {
  const centavos = Math.round(valorMensal * CENTAVOS_POR_UNIDADE) * prazoMeses;

  return centavos / CENTAVOS_POR_UNIDADE;
}

/**
 * O último dia de um mês, pela regra gregoriana escrita por extenso.
 *
 * Ela **não** é perguntada a um `Date` (`new Date(ano, mes, 0).getDate()`, a forma idiomática)
 * por duas razões, e a segunda é a que decide: aquela forma constrói o instante no fuso do
 * processo — o que este arquivo recusa por inteiro —, e a regra bissexta é justamente o
 * comportamento que a task manda **declarar** em vez de herdar de terceiro.
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
 * A exceção do século não é ornamento — o golden exercita 2028 (bissexto) e 2027 e 2029 (comuns),
 * e o comportamento de 2100 é o mesmo contrato, ainda que nenhum contrato de locação o alcance.
 */
function ehBissexto(ano: number): boolean {
  return (ano % 4 === 0 && ano % 100 !== 0) || ano % 400 === 0;
}

/**
 * A cadeia `YYYY-MM-DD` de um instante, lida **só** pelos acessores UTC.
 *
 * `toISOString().slice(0, 10)` daria o mesmo para o domínio desta fatia; a forma explícita está aqui
 * porque ela torna a ausência do relógio local legível na própria linha, que é a propriedade que o
 * `CT-432` afirma.
 */
function formatarEmUtc(instante: Date): string {
  const ano = String(instante.getUTCFullYear()).padStart(DIGITOS_DO_ANO, '0');
  const mes = String(instante.getUTCMonth() + 1).padStart(DIGITOS_DO_MES_E_DO_DIA, '0');
  const dia = String(instante.getUTCDate()).padStart(DIGITOS_DO_MES_E_DO_DIA, '0');

  return `${ano}-${mes}-${dia}`;
}
