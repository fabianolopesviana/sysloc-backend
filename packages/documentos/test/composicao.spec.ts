/**
 * A composição do documento do contrato — pureza, marca de cancelamento e a **igualdade com o
 * golden**.
 *
 * Rastreabilidade: CA-02 → CT-702 (RN-01) · CA-02 → CT-703 (RN-01) · CA-04 → CT-706 (RN-02) ·
 * CA-03 → CT-709 (RN-15).
 *
 * ---------------------------------------------------------------------------
 * INVARIANTES
 * ---------------------------------------------------------------------------
 *
 * | Critério | Caso | Invariante |
 * |---|---|---|
 * | CA-02 | CT-702 | Composto o documento com um agregado e depois com o **mesmo** agregado alterado
 * |       |        | no `valorMensal`, a segunda composição traz a cláusula sétima e a alínea do
 * |       |        | valor total **inteiras**, por igualdade literal, com o valor novo — e a
 * |       |        | primeira permanece byte a byte como era, sem mutação retroativa. A mesma
 * |       |        | entrada, recomposta, dá blocos **iguais por objeto**. |
 * | CA-02 | CT-702 | **(c)** O `valorTotalContrato` chega **resolvido** e é impresso como chegou: um
 * |       |        | total que destoa de `valorMensal × prazoMeses` — `0` e `999` contra os 30.000
 * |       |        | do produto — sai literalmente na alínea, e o produto **não aparece em bloco
 * |       |        | algum**. É o caso que reprova a derivação monetária na aplicação que a
 * |       |        | ADR-0023 põe no banco, e que sobreviveria a qualquer asserção de igualdade
 * |       |        | feita sobre um agregado coerente. |
 * | CA-02 | CT-703 | Composto um contrato **com** fiador e, em seguida, um **sem** fiador, o nome do
 * |       |        | fiador anterior tem índice `-1` em **todos** os blocos da segunda composição, o
 * |       |        | bloco `fiadores` não existe e nenhum rótulo `assinatura-fiador-*` sobrevive. O
 * |       |        | positivo do par — o bloco `fiadores` da primeira composição, **inteiro** e por
 * |       |        | igualdade literal, com a abertura, a qualificação e o encerramento — é
 * |       |        | afirmado no mesmo caso. |
 * | CA-04 | CT-706 | Para os **quatro** estados de `ESTADOS_DO_CONTRATO`, a marca de cancelamento
 * |       |        | existe **se e somente se** o estado é `CANCELADO`: bloco presente com texto
 * |       |        | literal ali, e nenhum traço dela (nem o rótulo, nem a cadeia `CANCELAD`) nos
 * |       |        | outros três. O conjunto dos quatro estados é afirmado por igualdade, para que um
 * |       |        | quinto estado futuro **reprove** em vez de passar sem veredito. |
 * | CA-03 | CT-709 | Composto o documento com os dados do contrato de referência do golden, os **45**
 * |       |        | blocos pareiam por rótulo com os 45 marcadores estruturais do oráculo, e o texto
 * |       |        | normalizado de cada bloco é **estritamente igual** ao do golden — exceto pelos
 * |       |        | **quatro** blocos da lista de divergências, escrita **antes** da execução. O
 * |       |        | conjunto dos rótulos divergentes é afirmado por **igualdade**, de modo que
 * |       |        | divergência nova reprova nomeando o bloco e divergência declarada que deixou de
 * |       |        | existir reprova também. |
 * | CA-03 | CT-709 | **(apoio f)** Data de emissão **fora do formato `AAAA-MM-DD` ou com mês fora de
 * |       |        | 1..12** — ordem trocada, mês
 * |       |        | sem zero à esquerda, cadeia vazia, mês acima de dezembro e mês zero — faz a
 * |       |        | composição **lançar** `ErroDeDataDeEmissaoInvalida` com o valor recusado em
 * |       |        | campo, e **nenhum documento parcial** é produzido. As duas saídas de recusa da
 * |       |        | função têm classe de entrada própria: as três primeiras reprovam pelo formato,
 * |       |        | as duas últimas pelo índice do mês. |
 * | CA-03 | CT-709 | **(apoio g)** Os **doze** meses saem por extenso, cada um pelo próprio nome: o
 * |       |        | bloco `praca-e-data` é afirmado **inteiro**, por igualdade literal, com os doze
 * |       |        | nomes escritos **à mão neste arquivo** — nunca lidos do SUT. É o caso que
 * |       |        | discrimina uma letra trocada em qualquer posição da tabela de meses, que a
 * |       |        | igualdade com o oráculo **não alcança** (o bloco é o divergente DV-04). |
 * | CA-03 | CT-709 | **(apoio h)** Molde cujo ponto de interpolação não recebeu valor **lança**
 * |       |        | `ErroDeInterpolacaoIncompleta` nomeando o ponto em campo — no ponto único, no
 * |       |        | ponto embutido na cláusula e no **segundo** ponto, depois de um já substituído.
 * |       |        | O companheiro positivo afirma o molde inteiro interpolado, por igualdade. |
 *
 * ===========================================================================
 * As duas separações sem as quais esta prova concordaria consigo mesma
 * ===========================================================================
 *
 * Uma prova de equivalência é o lugar clássico onde uma suíte passa a provar nada, e o modo de falha
 * é silencioso: ela fica verde para sempre porque os dois lados saíram da mesma cabeça. É o molde do
 * `CT-636`/`CT-637` da sub-fatia irmã, e as duas separações são:
 *
 * 1. **O lado do ORÁCULO é LIDO do disco**, fatiado pelos marcadores estruturais que o próprio
 *    arquivo carrega. Nenhum trecho do golden é redigitado aqui — **salvo** as quatro evidências de
 *    divergência, que são a asserção, exatamente como o `CT-637` faz com o seu único par divergente.
 * 2. **O lado do PRODUTO é constante literal declarada ANTES do `it`.** As divergências e os textos
 *    esperados vêm da §3.6 da task e da §21.1 do tech spec, escritas antes de existir código para
 *    medir. **Elas não se ajustam**: se a comparação reprovar, o que está errado é o produto
 *    (RN-15 — *"divergência descoberta durante a execução é falha de método, não resultado"*).
 *
 * ===========================================================================
 * Por que a comparação NÃO pula bloco algum
 * ===========================================================================
 *
 * A forma preguiçosa — *"compare só os blocos que não estão na lista de divergência"* — deixaria os
 * quatro blocos mais interessantes do documento **sem asserção nenhuma**: justamente os que carregam
 * dinheiro, o nome do imóvel e a data. Aqui os quatro são afirmados por **igualdade literal contra o
 * texto do produto declarado antes**, e a divergência é afirmada nos dois sentidos (o golden contém
 * a evidência antiga; o produto contém a nova e **não** contém a antiga).
 *
 * **Real execution boundary**: `none`. A composição é função pura e não tem colaborador a dublar —
 * não existe mock neste arquivo. A única leitura de disco é o artefato golden, que é dado de entrada
 * versionado (ADR-0006: nenhuma coordenada de conexão é lida em lugar nenhum desta suíte).
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ESTADOS_DO_CONTRATO } from '@sysloc/contracts';
import { describe, expect, it } from 'vitest';
import { ErroDeInterpolacaoIncompleta, interpolar } from '../src/contrato/clausulas.ts';
import {
  comporDocumentoDoContrato,
  ErroDeDataDeEmissaoInvalida,
  MARCA_DE_CANCELAMENTO,
} from '../src/contrato/composicao.ts';
import type { DadosDoContratoParaDocumento, ParteDoContrato } from '../src/contrato/dados.ts';
import { normalizarParaComparacao } from '../src/normalizacao.ts';

// ---------------------------------------------------------------------------
// O oráculo, lido do repositório
// ---------------------------------------------------------------------------

/** A raiz do monorepo, resolvida a partir deste módulo — `packages/documentos/test/` menos três. */
const RAIZ_DO_REPOSITORIO = fileURLToPath(new URL('../../../', import.meta.url));

/**
 * O documento do contrato extraído do PDF do sistema antigo, capturado pela fatia de caracterização.
 *
 * Nenhuma alteração nele é permitida por esta fatia: ele é o registro do que existia, e o que este
 * arquivo faz é **lê-lo**. Ver a `PROCEDENCIA.md` ao lado dele para como foi capturado.
 */
const CAMINHO_DO_GOLDEN = join(
  RAIZ_DO_REPOSITORIO,
  'docs/specs/features/caracterizacao-regras-legadas/v1/golden/contrato-pdf.txt',
);

const GOLDEN = readFileSync(CAMINHO_DO_GOLDEN, 'utf8');

/**
 * Como o oráculo é segmentado: o rótulo do bloco do produto e o marcador que o abre no golden.
 *
 * Os marcadores são **texto que o próprio oráculo carrega** — cabeçalhos de cláusula, títulos de
 * seção, a abertura de cada alínea —, e a busca é **sequencial**: cada um é procurado depois do
 * anterior, o que resolve os dois `Testemunha` e os dois usos de cada nome sem inventar âncora.
 */
const MARCADORES_DO_ORACULO: readonly (readonly [string, string])[] = [
  ['titulo', 'CONTRATO DE LOCAÇÃO RESIDENCIAL'],
  ['locador', 'LOCADOR (A):'],
  ['locatario', 'LOCATÁRIO (A) (S):'],
  ['secao-objeto', 'OBJETO'],
  ['clausula-primeira', 'CLÁUSULA PRIMEIRA:'],
  ['secao-destinacao', 'DESTINAÇÃO'],
  ['clausula-segunda', 'CLÁUSULA SEGUNDA:'],
  ['clausula-terceira', 'CLÁUSULA TERCEIRA:'],
  ['secao-prazo', 'PRAZO'],
  ['clausula-quarta', 'CLÁUSULA QUARTA:'],
  ['clausula-quinta', 'CLÁUSULA QUINTA:'],
  ['paragrafo-primeiro', 'PARÁGRAFO 1º:'],
  ['clausula-sexta', 'CLÁUSULA SEXTA:'],
  ['secao-valor', 'VALOR'],
  ['clausula-setima', 'CLÁUSULA SÉTIMA:'],
  ['alinea-valor-total', 'a) VALOR TOTAL DO CONTRATO:'],
  ['clausula-oitava', 'CLÁUSULA OITAVA:'],
  ['clausula-nona', 'CLÁUSULA NONA:'],
  ['clausula-decima', 'CLÁUSULA DÉCIMA:'],
  ['clausula-decima-alinea-a', 'a) Despesas de luz'],
  ['clausula-decima-alinea-b', 'b) Pagamento de Imposto'],
  ['clausula-decima-alinea-c', 'c) Satisfação de todas'],
  ['clausula-decima-primeira', 'CLÁUSULA DÉCIMA PRIMEIRA:'],
  ['clausula-decima-segunda', 'CLÁUSULA DÉCIMA SEGUNDA:'],
  ['clausula-decima-terceira', 'CLÁUSULA DÉCIMA TERCEIRA:'],
  ['secao-conservacao', 'CONSERVAÇÃO'],
  ['clausula-decima-quarta', 'CLÁUSULA DÉCIMA QUARTA:'],
  ['clausula-decima-quinta', 'CLÁUSULA DÉCIMA QUINTA:'],
  ['clausula-decima-sexta', 'CLÁUSULA DÉCIMA SEXTA:'],
  ['clausula-decima-setima', 'CLÁUSULA DÉCIMA SÉTIMA:'],
  ['clausula-decima-oitava', 'CLÁUSULA DÉCIMA OITAVA:'],
  ['clausula-decima-nona', 'CLÁUSULA DÉCIMA NONA:'],
  ['secao-sancoes', 'SANÇÕES'],
  ['clausula-vigesima', 'CLÁUSULA VIGÉSIMA:'],
  ['clausula-vigesima-alinea-a', 'a) Rescisão contratual'],
  ['clausula-vigesima-alinea-b', 'b) Multa penal'],
  ['clausula-vigesima-alinea-c', 'c) Perdas e danos'],
  ['clausula-vigesima-alinea-d', 'd) Pagamentos dos honorários'],
  ['clausula-vigesima-primeira', 'CLÁUSULA VIGÉSIMA PRIMEIRA:'],
  ['fecho', 'E por estarem justos'],
  ['praca-e-data', 'Caratinga - MG, <DATA'],
  ['assinatura-locatario', 'Joao Locatario\nLocatário(a)'],
  ['assinatura-locador', 'Maria Locadora\nLocador(a)'],
  ['assinatura-testemunha-1', 'Testemunha'],
  ['assinatura-testemunha-2', 'Testemunha'],
];

/**
 * Projeta o oráculo como {rótulo → texto normalizado do bloco}.
 *
 * Falha **ruidosamente** quando um marcador não é encontrado, e a escolha é deliberada: devolver
 * texto vazio faria a asserção seguinte comparar nada com nada, que é o pior desfecho possível de
 * uma asserção — verde por cegueira. É o mesmo desenho de `trechoDoGolden` em `normalizacao.spec.ts`.
 */
function projetarOraculo(): ReadonlyMap<string, string> {
  const posicoes: number[] = [];
  let cursor = 0;

  for (const [rotulo, marcador] of MARCADORES_DO_ORACULO) {
    const inicio = GOLDEN.indexOf(marcador, cursor);

    if (inicio === -1) {
      throw new Error(`marcador ausente no oráculo (${rotulo}): ${marcador}`);
    }

    posicoes.push(inicio);
    cursor = inicio + marcador.length;
  }

  const projecao = new Map<string, string>();

  MARCADORES_DO_ORACULO.forEach(([rotulo], posicao) => {
    const inicio = posicoes[posicao] ?? 0;
    const fim = posicoes[posicao + 1] ?? GOLDEN.length;

    projecao.set(rotulo, normalizarParaComparacao(GOLDEN.slice(inicio, fim)));
  });

  return projecao;
}

const ORACULO = projetarOraculo();

// ---------------------------------------------------------------------------
// O lado do produto — agregados declarados, e nenhum deles lido de lugar nenhum
// ---------------------------------------------------------------------------

/** O locador do contrato de referência do golden — pessoa física, com cédula de identidade. */
const MARIA_LOCADORA: ParteDoContrato = {
  nome: 'Maria Locadora',
  tipoPessoa: 'PESSOA_FISICA',
  documentoPrincipal: '11122233344',
  rg: 'MG-1234567',
  logradouro: 'Avenida Central',
  numero: '1000',
  complemento: null,
  bairro: 'Centro',
  cidade: 'Caratinga',
  estado: 'MG',
  cep: '35300001',
};

/** O locatário do contrato de referência do golden. */
const JOAO_LOCATARIO: ParteDoContrato = {
  nome: 'Joao Locatario',
  tipoPessoa: 'PESSOA_FISICA',
  documentoPrincipal: '55566677788',
  rg: 'MG-7654321',
  logradouro: 'Rua B',
  numero: '55',
  complemento: null,
  bairro: 'Bela Vista',
  cidade: 'Caratinga',
  estado: 'MG',
  cep: '35300002',
};

/** O fiador que o CT-703 procura na composição seguinte — e não pode encontrar. */
const CARLOS_FIADOR: ParteDoContrato = {
  nome: 'Carlos Fiador',
  tipoPessoa: 'PESSOA_FISICA',
  documentoPrincipal: '99988877766',
  rg: 'MG-9999999',
  logradouro: 'Rua C',
  numero: '9',
  complemento: null,
  bairro: 'Centro',
  cidade: 'Caratinga',
  estado: 'MG',
  cep: '35300003',
};

/** O imóvel do contrato de referência do golden. */
const IMOVEL_DE_REFERENCIA: DadosDoContratoParaDocumento['imovel'] = {
  nomeImovel: 'Imovel PDF-001',
  logradouro: 'Rua das Flores',
  numero: '120',
  complemento: 'Fundos',
  bairro: 'Centro',
  cidade: 'Caratinga',
  estado: 'MG',
  cep: '35300000',
};

/** A data corrente da operação usada por toda esta suíte — apurada pelo banco na produção. */
const DATA_DE_EMISSAO = '2026-08-13';

/** Monta o agregado de referência, com os desvios que cada caso precisa. */
function agregadoDeReferencia(
  desvios: Partial<DadosDoContratoParaDocumento> = {},
): DadosDoContratoParaDocumento {
  return {
    contrato: { prazoMeses: 12, valorMensal: 2500, diaVencimento: 10, valorTotalContrato: 30000 },
    locador: MARIA_LOCADORA,
    locatario: JOAO_LOCATARIO,
    imovel: IMOVEL_DE_REFERENCIA,
    fiadores: [],
    dataDeEmissao: DATA_DE_EMISSAO,
    ...desvios,
  };
}

/** O texto de um bloco pelo rótulo — levanta quando o bloco não existe, em vez de devolver vazio. */
function bloco(
  representacao: ReturnType<typeof comporDocumentoDoContrato>,
  rotulo: string,
): string {
  const achado = representacao.blocos.find((candidato) => candidato.rotulo === rotulo);

  if (achado === undefined) {
    throw new Error(`bloco ausente na composição: ${rotulo}`);
  }

  return achado.texto;
}

// ---------------------------------------------------------------------------
// As divergências com o oráculo — DECLARADAS ANTES DA EXECUÇÃO (§3.6 da task)
// ---------------------------------------------------------------------------

/**
 * Uma divergência esperada entre o produto e o oráculo, com o veredito escrito antes.
 *
 * `textoDoProduto` é o bloco **inteiro**, normalizado, que o produto deve emitir — é o que impede a
 * tolerância de virar um "pule este bloco". `evidenciaNoGolden` e `evidenciaNoProduto` são os
 * trechos que **caracterizam** a divergência, e são afirmados nos dois sentidos.
 */
interface DivergenciaEsperada {
  readonly rotulo: string;
  readonly veredito: string;
  readonly textoDoProduto: string;
  readonly evidenciaNoGolden: string;
  readonly evidenciaNoProduto: string;
}

/**
 * As quatro divergências esperadas, cada uma casando veredito de §3.6 da task / §21.1 do tech spec.
 *
 * ⚠️ **Esta lista é insumo, não subproduto.** Ela não se ajusta depois de ver o resultado: uma
 * divergência que apareça fora daqui é falha de **método**, e o caminho é emendar o artefato de
 * especificação e escalar — nunca acrescentar uma linha aqui (RN-15).
 *
 * Sobre a **DV-03 e o resíduo adjacente a sinal de pontuação**: o extrator de texto do PDF quebra
 * linha ao redor de cada trecho em negrito do HTML do legado. Onde a quebra caiu **entre palavras**,
 * o colapso de espaço da normalização a absorve por inteiro — é o que faz 41 dos 45 blocos serem
 * idênticos. Onde ela caiu **colada a um sinal**, sobra um espaço, e as formas medidas são **três**,
 * não duas:
 *
 * 1. antes da **vírgula** (`</b>,`) — `Imovel PDF-001 , localizado`, em `clausula-primeira`;
 * 2. antes do **ponto** (`</b>.`) — a mesma origem, no fecho de período;
 * 3. **dentro do parêntese**, dos dois lados — `( two thousand, five hundred only reais )`, em
 *    `clausula-setima` e em `alinea-valor-total`. Esta é a que a emenda da DV-03 não enumerava, e
 *    quem lesse *"antes da vírgula e do ponto"* concluiria que aqueles dois blocos divergem por outra
 *    causa.
 *
 * A causa é a mesma nas três, e o produto **não** reproduz o resíduo em nenhuma delas — imprimi-lo
 * poria no PDF um espaço que o contrato não tem, só para casar com um artefato de extração.
 */
const DIVERGENCIAS_ESPERADAS: readonly DivergenciaEsperada[] = [
  {
    rotulo: 'clausula-primeira',
    veredito: 'DV-03 — resíduo do extrator colado à pontuação; o produto não o reproduz',
    textoDoProduto:
      'CLÁUSULA PRIMEIRA: O objeto do presente contrato é o imóvel residencial identificado como Imovel PDF-001, localizado em Rua das Flores, 120, Fundos, Centro, Caratinga - MG, CEP 35300-000.',
    evidenciaNoGolden: 'Imovel PDF-001 , localizado em',
    evidenciaNoProduto: 'Imovel PDF-001, localizado em',
  },
  {
    rotulo: 'clausula-setima',
    veredito: 'DV-01 (extenso em inglês no legado) — PRODUTO_VENCE; mais o resíduo da DV-03',
    textoDoProduto:
      'CLÁUSULA SÉTIMA: O aluguel mensal é de R$ 2.500,00 (dois mil e quinhentos reais), com reajuste anual pelo índice IGPM-FGV, no período acumulativamente ou outro índice oficial determinado pelo governo que venha a substituí-lo. Daí por diante, caso ocorra a hipótese prevista na cláusula Sexta, ficará sujeito a reajustamentos periódicos estabelecidos na legislação pertinente que estiver em vigor.',
    evidenciaNoGolden: '( two thousand, five hundred only reais )',
    evidenciaNoProduto: '(dois mil e quinhentos reais)',
  },
  {
    rotulo: 'alinea-valor-total',
    veredito: 'DV-01 (extenso em inglês no legado) — PRODUTO_VENCE; mais o resíduo da DV-03',
    textoDoProduto: 'a) VALOR TOTAL DO CONTRATO: R$ 30.000,00 (trinta mil reais).',
    evidenciaNoGolden: '( thirty thousand only reais )',
    evidenciaNoProduto: '(trinta mil reais)',
  },
  {
    rotulo: 'praca-e-data',
    veredito: 'DV-04 — máscara declarada na PROCEDENCIA.md §1; o instante entra por parâmetro',
    textoDoProduto: `Caratinga - MG, 13 de AGOSTO de 2026`,
    evidenciaNoGolden: '<DATA_GERACAO_EXTENSO>',
    evidenciaNoProduto: '13 de AGOSTO de 2026',
  },
];

/** Os rótulos divergentes declarados, na ordem em que o documento os apresenta. */
const ROTULOS_DIVERGENTES_DECLARADOS = DIVERGENCIAS_ESPERADAS.map(
  (divergencia) => divergencia.rotulo,
);

// ---------------------------------------------------------------------------
// Os casos
// ---------------------------------------------------------------------------

describe('CT-702 — a composição é função pura do dado, sem estado entre chamadas', () => {
  /** A cláusula sétima com o aluguel de origem — o lado esperado, escrito à mão. */
  const SETIMA_COM_2500 =
    'CLÁUSULA SÉTIMA: O aluguel mensal é de R$ 2.500,00 (dois mil e quinhentos reais), com reajuste anual pelo índice IGPM-FGV, no período acumulativamente ou outro índice oficial determinado pelo governo que venha a substituí-lo. Daí por diante, caso ocorra a hipótese prevista na cláusula Sexta, ficará sujeito a reajustamentos periódicos estabelecidos na legislação pertinente que estiver em vigor.';

  /** A mesma cláusula depois da alteração — o valor é o único trecho que muda. */
  const SETIMA_COM_2800 = SETIMA_COM_2500.replace(
    'R$ 2.500,00 (dois mil e quinhentos reais)',
    'R$ 2.800,00 (dois mil e oitocentos reais)',
  );

  it('CT-702 (a) — o agregado alterado reflete a alteração, e a composição anterior não muda', () => {
    const agregadoV1 = agregadoDeReferencia({
      contrato: { prazoMeses: 12, valorMensal: 2500, diaVencimento: 10, valorTotalContrato: 30000 },
    });
    const agregadoV2 = agregadoDeReferencia({
      contrato: { prazoMeses: 12, valorMensal: 2800, diaVencimento: 10, valorTotalContrato: 33600 },
    });

    const primeira = comporDocumentoDoContrato(agregadoV1, { cancelado: false });
    const segunda = comporDocumentoDoContrato(agregadoV2, { cancelado: false });

    // O trecho INTEIRO da cláusula, por igualdade literal — nunca "contém algum valor".
    expect(bloco(segunda, 'clausula-setima')).toBe(SETIMA_COM_2800);
    expect(bloco(segunda, 'clausula-setima')).not.toContain('R$ 2.500,00');

    // Sem mutação retroativa: a primeira composição continua exatamente como era.
    expect(bloco(primeira, 'clausula-setima')).toBe(SETIMA_COM_2500);

    // O total chega RESOLVIDO no agregado (ADR-0023: quem o deriva é a consulta da T7, em `numeric`),
    // e a alínea imprime o que recebeu — nada é recalculado aqui. As duas linhas continuam sendo o
    // eixo do caso: a segunda composição traz o total novo, e a primeira não é reescrita por ela.
    expect(bloco(primeira, 'alinea-valor-total')).toBe(
      'a) VALOR TOTAL DO CONTRATO: R$ 30.000,00 (trinta mil reais).',
    );
    expect(bloco(segunda, 'alinea-valor-total')).toBe(
      'a) VALOR TOTAL DO CONTRATO: R$ 33.600,00 (trinta e três mil e seiscentos reais).',
    );
  });

  /**
   * O par que discrimina a **derivação removida** — e ele reprova com o código de antes.
   *
   * Até a rodada 2 a composição resolvia o total por conta própria: com o declarado nulo **ou zero**,
   * ela multiplicava `valorMensal × prazoMeses`. Era aritmética monetária sobre valor não persistido
   * dentro da aplicação, e a `Decision` da ADR-0023 a põe no banco — quem a faz agora é a consulta da
   * T7, por `COALESCE(valor_total_contrato, valor_mensal * prazo_meses)` em `numeric`.
   *
   * As duas linhas abaixo destoam de propósito de `valorMensal × prazoMeses` (que daria 30.000): sob
   * o código antigo a primeira imprimiria `R$ 30.000,00` em vez de `R$ 0,00`, e é essa a asserção que
   * impede a derivação de voltar para cá em silêncio.
   */
  const TOTAIS_QUE_DESTOAM_DO_PRODUTO_MENSAL = [
    { total: 0, impresso: 'R$ 0,00', extenso: 'zero reais' },
    { total: 999, impresso: 'R$ 999,00', extenso: 'novecentos e noventa e nove reais' },
  ] as const;

  it.each(TOTAIS_QUE_DESTOAM_DO_PRODUTO_MENSAL)(
    'CT-702 (c) — o total $total chega resolvido e é impresso como chegou, sem recálculo',
    ({ total, impresso, extenso }) => {
      const documento = comporDocumentoDoContrato(
        agregadoDeReferencia({
          contrato: {
            prazoMeses: 12,
            valorMensal: 2500,
            diaVencimento: 10,
            valorTotalContrato: total,
          },
        }),
        { cancelado: false },
      );

      // A alínea INTEIRA, por igualdade literal.
      expect(bloco(documento, 'alinea-valor-total')).toBe(
        `a) VALOR TOTAL DO CONTRATO: ${impresso} (${extenso}).`,
      );
      // …e o produto `valorMensal × prazoMeses` não aparece em bloco algum: a composição não o
      // calcula, nem por outro caminho.
      for (const candidato of documento.blocos) {
        expect(candidato.texto).not.toContain('R$ 30.000,00');
        expect(candidato.texto).not.toContain('trinta mil reais');
      }
    },
  );

  it('CT-702 (b) — a mesma entrada, recomposta, dá a MESMA saída, bloco a bloco', () => {
    const agregado = agregadoDeReferencia();

    const primeira = comporDocumentoDoContrato(agregado, { cancelado: false });
    const segunda = comporDocumentoDoContrato(agregado, { cancelado: false });

    // Igualdade do objeto inteiro, e não de um campo: é o que uma memoização mal instalada — ou um
    // acumulador de módulo — quebraria primeiro.
    expect(segunda).toEqual(primeira);
    // …e a igualdade acima não pode vir de as duas serem a MESMA referência devolvida de um cache.
    expect(segunda).not.toBe(primeira);
    expect(segunda.blocos).not.toBe(primeira.blocos);
  });
});

describe('CT-703 — companheiro negativo: a composição não vaza o fiador de uma chamada para a seguinte', () => {
  it('CT-703 — compor sem fiador logo após compor com fiador não deixa traço algum do anterior', () => {
    const comFiador = agregadoDeReferencia({ fiadores: [CARLOS_FIADOR] });
    const semFiador = agregadoDeReferencia({ fiadores: [] });

    const primeira = comporDocumentoDoContrato(comFiador, { cancelado: false });
    const segunda = comporDocumentoDoContrato(semFiador, { cancelado: false });

    // O positivo do par: sem ele, uma composição que NUNCA emitisse o fiador passaria neste caso.
    // O bloco é afirmado INTEIRO, e não por presença do nome: é o que prende a abertura, o molde da
    // qualificação e o encerramento do parágrafo. O molde **sem** RG — onde mora a divergência
    // deliberada com o legado — é discriminado em `qualificacao.spec.ts`, no `CT-704 (fiador)`.
    expect(bloco(primeira, 'fiadores')).toBe(
      'FIADOR (A) (S): Como fiador(es) e principal(ais) pagador(es) das mensalidades do aluguel e demais obrigações constantes deste contrato, Carlos Fiador, portador(a) da cédula de identidade civil número MG-9999999, e do CPF número 999.888.777-66, residente e domiciliado em Rua C, 9, Centro, Caratinga - MG, CEP 35300-003, até final satisfação das obrigações locacionais, vincendas tal como consumo de luz, água, IPTU e devolução das chaves ao(à) LOCADOR(A), renunciando expressamente ao benefício de ordem de que tratam os artigos 1.491, 1.500 e 1.503 do Código Civil Brasileiro.',
    );
    expect(bloco(primeira, 'assinatura-fiador-1')).toBe('Carlos Fiador\nFiador(a)');

    // Ausência TOTAL na segunda — em todos os blocos, e por índice, como o card do caso pede.
    for (const candidato of segunda.blocos) {
      expect(candidato.texto.indexOf('Carlos Fiador')).toBe(-1);
    }

    // E a ausência é estrutural, não textual: o bloco e a assinatura simplesmente não existem.
    expect(segunda.blocos.map((candidato) => candidato.rotulo)).not.toContain('fiadores');
    expect(
      segunda.blocos.filter((candidato) => candidato.rotulo.startsWith('assinatura-fiador-')),
    ).toEqual([]);
  });
});

describe('CT-706 — a marca de cancelamento é parâmetro da composição, e só o CANCELADO a traz', () => {
  /** O rótulo do bloco da marca — a segunda evidência, independente do texto. */
  const ROTULO_DA_MARCA = 'marca-de-cancelamento';

  /** O texto da marca, escrito à mão: o lado esperado não pode sair do próprio SUT. */
  const TEXTO_ESPERADO_DA_MARCA = 'CONTRATO CANCELADO';

  it('CT-706 (a) — os quatro estados do contrato são exatamente os declarados no contrato publicado', () => {
    // Sem esta linha, um quinto estado criado em `@sysloc/contracts` entraria no caso parametrizado
    // abaixo sem que ninguém decidisse se ele marca ou não marca o documento.
    expect([...ESTADOS_DO_CONTRATO]).toEqual(['RASCUNHO', 'ATIVO', 'CANCELADO', 'ENCERRADO']);
    // A constante publicada e o texto esperado coincidem — é o que liga a asserção literal ao SUT.
    expect(MARCA_DE_CANCELAMENTO).toBe(TEXTO_ESPERADO_DA_MARCA);
  });

  it.each(ESTADOS_DO_CONTRATO)(
    'CT-706 (b) — status %s: a marca existe se e somente se o status é CANCELADO',
    (status) => {
      // A derivação é a MESMA que a borda faz (§5.1-A passo 4): a composição não conhece `status`.
      const cancelado = status === 'CANCELADO';
      const documento = comporDocumentoDoContrato(agregadoDeReferencia(), { cancelado });
      const rotulos = documento.blocos.map((candidato) => candidato.rotulo);

      if (cancelado) {
        expect(rotulos).toContain(ROTULO_DA_MARCA);
        expect(bloco(documento, ROTULO_DA_MARCA)).toBe(TEXTO_ESPERADO_DA_MARCA);
        // A marca entra logo abaixo do título, e não no rodapé.
        expect(rotulos.slice(0, 2)).toEqual(['titulo', ROTULO_DA_MARCA]);
        return;
      }

      // Nenhum traço dela: nem o bloco, nem o texto em bloco algum. A busca é por `CANCELAD` para
      // alcançar também uma variação de caixa ou de flexão que alguém acrescentasse.
      expect(rotulos).not.toContain(ROTULO_DA_MARCA);
      for (const candidato of documento.blocos) {
        expect(candidato.texto.toUpperCase()).not.toContain('CANCELAD');
      }
    },
  );
});

describe('CT-709 — igualdade normalizada com o golden `contrato-pdf.txt`, bloco a bloco', () => {
  const documento = comporDocumentoDoContrato(agregadoDeReferencia(), { cancelado: false });

  it('CT-709 (a) — os blocos do produto pareiam, um a um e na ordem, com os do oráculo', () => {
    expect(documento.blocos.map((candidato) => candidato.rotulo)).toEqual(
      MARCADORES_DO_ORACULO.map(([rotulo]) => rotulo),
    );
  });

  it('CT-709 (b) — o conjunto de blocos divergentes é EXATAMENTE o declarado antes da execução', () => {
    const divergentes = documento.blocos
      .filter(
        (candidato) => normalizarParaComparacao(candidato.texto) !== ORACULO.get(candidato.rotulo),
      )
      .map((candidato) => candidato.rotulo);

    // Igualdade de lista, e não "está contido": divergência NOVA reprova nomeando o bloco, e
    // divergência declarada que deixou de existir reprova também — a lista não se ajusta (RN-15).
    expect(divergentes).toEqual(ROTULOS_DIVERGENTES_DECLARADOS);
  });

  it.each(
    MARCADORES_DO_ORACULO.filter(
      ([rotulo]) => !ROTULOS_DIVERGENTES_DECLARADOS.includes(rotulo),
    ).map(([rotulo]) => ({ rotulo })),
  )('CT-709 (c) — o bloco $rotulo é estritamente igual ao do oráculo', ({ rotulo }) => {
    expect(normalizarParaComparacao(bloco(documento, rotulo))).toBe(ORACULO.get(rotulo));
  });

  it.each(DIVERGENCIAS_ESPERADAS)(
    'CT-709 (d) — o bloco $rotulo diverge exatamente como o veredito declara: $veredito',
    ({ rotulo, textoDoProduto, evidenciaNoGolden, evidenciaNoProduto }) => {
      const doProduto = normalizarParaComparacao(bloco(documento, rotulo));
      const doOraculo = ORACULO.get(rotulo);

      // O bloco divergente NÃO é pulado: ele é afirmado por igualdade literal contra o texto que a
      // task declarou que o produto deve emitir.
      expect(doProduto).toBe(textoDoProduto);

      // E a divergência é caracterizada nos dois sentidos, para que a tolerância não cubra outra
      // diferença que tenha aparecido no mesmo bloco.
      expect(doOraculo).toContain(evidenciaNoGolden);
      expect(doProduto).toContain(evidenciaNoProduto);
      expect(doProduto).not.toContain(evidenciaNoGolden);
    },
  );

  it('CT-709 (e) — controle: a comparação sabe reprovar, e o oráculo não colapsa em si mesmo', () => {
    // Se a igualdade do (c) viesse de a normalização colapsar tudo, este par também passaria.
    expect(ORACULO.get('clausula-primeira')).not.toBe(ORACULO.get('clausula-segunda'));

    // E um bloco com uma palavra trocada reprova pela mesma asserção que o (c) usa — é o mutante m1
    // de §21.2, aplicado ao lado do produto.
    const comPalavraTrocada = bloco(documento, 'clausula-quarta').replace(
      'prazo determinado',
      'prazo indeterminado',
    );
    expect(normalizarParaComparacao(comPalavraTrocada)).not.toBe(ORACULO.get('clausula-quarta'));
  });
});

// ---------------------------------------------------------------------------
// Os casos de apoio ao CT-709 — as recusas e a tabela de meses
// ---------------------------------------------------------------------------
//
// A sequência de letras do `CT-709 (apoio …)` é **global à feature** e começa em `extenso.spec.ts`,
// que ocupa de `a` a `e`. Ela continua aqui em `f`, `g` e `h` em vez de recomeçar, porque letra
// repetida em arquivos diferentes tornaria ambíguo o `-t "CT-709 (apoio c)"` da linha de comando.
// Sem ID de CT novo, pelo mesmo motivo registrado lá: a faixa está fechada em 33 casos (§19 do tech
// spec) e renumerar dessincronizaria o tech spec e o `_run/test-cases.json`.

describe('CT-709 (apoio f) — a data de emissão fora do formato ou com mês fora de 1..12 é recusada', () => {
  /**
   * As cinco entradas recusadas, uma por classe — e as **duas** saídas de recusa da função têm
   * cobertura própria.
   *
   * As três primeiras reprovam no casamento com `AAAA-MM-DD`; as duas últimas **passam** por ele e
   * reprovam no índice do mês, que é a segunda saída: `2026-13-01` cai fora da tabela e `2026-00-01`
   * cai na posição de reserva, aquela cadeia vazia que abre `MESES_POR_EXTENSO` para que o índice
   * comece em 1. Sem a última, um compositor que devolvesse `01 de  de 2026` passaria limpo.
   *
   * ⚠️ **O dia não é conferido contra o calendário, e a lista acima não finge que é**: `2026-02-31`
   * atravessa as duas saídas e sai como *"31 de FEVEREIRO de 2026"*. Não acrescente essa entrada à
   * tabela esperando recusa — a guarda é a declarada no docblock de `ErroDeDataDeEmissaoInvalida`, e
   * por ADR-0026 a entrada vem de `negocio.data_corrente_da_operacao()`, que só produz data que
   * existe.
   */
  const DATAS_RECUSADAS = [
    { nome: 'com a ordem invertida e barras', valor: '13/08/2026' },
    { nome: 'sem o zero à esquerda no mês', valor: '2026-8-13' },
    { nome: 'vazia', valor: '' },
    { nome: 'com mês acima de dezembro', valor: '2026-13-01' },
    { nome: 'com mês zero, a posição de reserva da tabela', valor: '2026-00-01' },
  ] as const;

  it.each(DATAS_RECUSADAS)(
    'CT-709 (apoio f) — a data $nome é recusada, e nenhum documento parcial sai',
    ({ valor }) => {
      const agregado = agregadoDeReferencia({ dataDeEmissao: valor });

      expect(() => comporDocumentoDoContrato(agregado, { cancelado: false })).toThrow(
        ErroDeDataDeEmissaoInvalida,
      );

      // O tipo específico não basta: o valor recusado viaja em propriedade, e é dele que a borda da
      // T7 monta o envelope da ADR-0017. Recortá-lo da mensagem seria análise sintática que falha
      // em silêncio — é o mesmo molde do `CT-705 (b)`.
      try {
        comporDocumentoDoContrato(agregado, { cancelado: false });
        expect.unreachable('a composição deveria ter recusado a data de emissão');
      } catch (erro) {
        expect(erro).toBeInstanceOf(ErroDeDataDeEmissaoInvalida);
        const recusa = erro as ErroDeDataDeEmissaoInvalida;
        expect(recusa.name).toBe('ErroDeDataDeEmissaoInvalida');
        expect(recusa.valor).toBe(valor);
      }
    },
  );
});

describe('CT-709 (apoio g) — os doze meses saem por extenso, cada um pelo próprio nome', () => {
  /**
   * Os doze nomes, escritos **à mão neste arquivo**.
   *
   * ⚠️ Eles **não** são lidos de `MESES_POR_EXTENSO`: lê-los do SUT tornaria a asserção tautológica
   * (AP-29) e uma letra trocada na tabela passaria nos doze casos. Este é o único lugar da suíte que
   * discrimina o nome do mês — a igualdade com o oráculo não alcança, porque `praca-e-data` é
   * justamente um dos quatro blocos divergentes (DV-04) e o mês entra ali por texto declarado.
   */
  const MESES_ESPERADOS = [
    { mes: '01', nome: 'JANEIRO' },
    { mes: '02', nome: 'FEVEREIRO' },
    { mes: '03', nome: 'MARÇO' },
    { mes: '04', nome: 'ABRIL' },
    { mes: '05', nome: 'MAIO' },
    { mes: '06', nome: 'JUNHO' },
    { mes: '07', nome: 'JULHO' },
    { mes: '08', nome: 'AGOSTO' },
    { mes: '09', nome: 'SETEMBRO' },
    { mes: '10', nome: 'OUTUBRO' },
    { mes: '11', nome: 'NOVEMBRO' },
    { mes: '12', nome: 'DEZEMBRO' },
  ] as const;

  it.each(MESES_ESPERADOS)(
    'CT-709 (apoio g) — o mês $mes sai como $nome, e o fecho é afirmado inteiro',
    ({ mes, nome }) => {
      const documento = comporDocumentoDoContrato(
        agregadoDeReferencia({ dataDeEmissao: `2026-${mes}-01` }),
        { cancelado: false },
      );

      // O bloco INTEIRO, por igualdade literal — a praça vem junto, e é ela que prova que o dia e o
      // ano não trocaram de lugar no recorte da cadeia.
      expect(bloco(documento, 'praca-e-data')).toBe(`Caratinga - MG, 01 de ${nome} de 2026`);
    },
  );
});

describe('CT-709 (apoio h) — a interpolação recusa o molde cujo ponto não recebeu valor', () => {
  /** Os valores disponíveis nos casos de recusa — `valorMensal` está deliberadamente fora. */
  const VALORES_PARCIAIS: Readonly<Record<string, string>> = {
    diaDeVencimento: '10',
    prazoEmMeses: '12',
  };

  it.each([
    { nome: 'o ponto sozinho', molde: '{valorMensal}', ponto: 'valorMensal' },
    {
      nome: 'o ponto embutido na cláusula',
      molde: 'CLÁUSULA SÉTIMA: O aluguel mensal é de {valorMensal}, com reajuste anual.',
      ponto: 'valorMensal',
    },
    {
      // Este é o caso que discrimina uma recusa instalada só na primeira ocorrência: o primeiro
      // ponto é substituído com sucesso, e a recusa tem de alcançar o segundo assim mesmo.
      nome: 'o segundo ponto, depois de um que já foi substituído',
      molde: 'CLÁUSULA QUINTA: vencendo dia {diaDeVencimento}, no valor de {valorMensal}.',
      ponto: 'valorMensal',
    },
  ])(
    'CT-709 (apoio h) — $nome é recusado, e o ponto faltante viaja em campo',
    ({ molde, ponto }) => {
      expect(() => interpolar(molde, VALORES_PARCIAIS)).toThrow(ErroDeInterpolacaoIncompleta);

      try {
        interpolar(molde, VALORES_PARCIAIS);
        expect.unreachable('a interpolação deveria ter recusado o ponto sem valor');
      } catch (erro) {
        expect(erro).toBeInstanceOf(ErroDeInterpolacaoIncompleta);
        const recusa = erro as ErroDeInterpolacaoIncompleta;
        expect(recusa.name).toBe('ErroDeInterpolacaoIncompleta');
        expect(recusa.ponto).toBe(ponto);
      }
    },
  );

  it('CT-709 (apoio h) — companheiro positivo: com todos os valores, o molde sai inteiro', () => {
    // Sem este par, uma `interpolar` que lançasse SEMPRE passaria nos três casos acima.
    expect(
      interpolar(
        'CLÁUSULA QUINTA: {prazoEmMeses} meses, vencendo dia {diaDeVencimento}, no valor de {valorMensal}.',
        { ...VALORES_PARCIAIS, valorMensal: 'R$ 2.500,00' },
      ),
    ).toBe('CLÁUSULA QUINTA: 12 meses, vencendo dia 10, no valor de R$ 2.500,00.');
  });
});
