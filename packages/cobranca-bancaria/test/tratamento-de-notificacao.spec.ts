/**
 * Verificação das **duas decisões puras** do tratamento da notícia do provedor — CT-970 e CT-982 da
 * fatia `webhook-e-carne`.
 *
 * ---------------------------------------------------------------------------
 * INVARIANTES
 * ---------------------------------------------------------------------------
 *
 * | Critério | CT     | Invariante |
 * |----------|--------|------------|
 * | CA-02,03 | CT-970 | A classificação do recebido é **pura, total e exaustiva**: todo corpo cai em
 * |          |        | exatamente uma das três categorias, e nenhuma entrada a faz levantar. |
 * | CA-03    | CT-970 | Identificador **ausente, vazio, com 17 ou com 19 posições** cai em `ILEGIVEL`
 * |          | (b)    | — a largura é fechada dos dois lados, e não só por baixo. |
 * | CA-11    | CT-970 | `validacaoWebhook === true` decide **antes de qualquer outra consideração**,
 * |          | (c)    | inclusive quando o resto do corpo seria um aviso legítimo. |
 * | CA-03    | CT-970 | Campo desconhecido do provedor **não desclassifica** um aviso válido: a
 * |          | (d)    | leitura é tolerante, e o resultado é idêntico ao do aviso sem os campos. |
 * | CA-02    | CT-970 | O *Número do título no provedor* chega **inteiro** no corpo e sai **cadeia**;
 * |          | (e)    | os outros dois campos não se coagem, porque a largura deles já passa do
 * |          |        | inteiro seguro do JSON. |
 * | CA-03    | CT-970 | O *identificador da liquidação* **nunca** se coage: número o desclassifica
 * |          | (f)    | nas DUAS faixas do JSON — dentro e fora do inteiro seguro —, e é a de dentro
 * |          |        | que separa a leitura correta daquela que coageria. |
 * | CA-09    | CT-982 | **Efeito** — e não *tratamento* — é o que torna uma notícia reentrega: dos
 * |          |        | nove desfechos, exatamente **um** (`APLICADO`) devolve `true`. |
 * | CA-09    | CT-982 | Ausência de notícia anterior (`null` da coluna, `undefined` da consulta que
 * |          | (b)    | não achou linha) **não** é reentrega. |
 *
 * Rastreabilidade: `CA-02 → CT-970 (RN-02)` · `CA-03 → CT-970 (RN-02, RN-18)` ·
 * `CA-11 → CT-970 (RN-10)` · `CA-09 → CT-982 (RN-08)`.
 *
 * ---------------------------------------------------------------------------
 * A AUSÊNCIA DE ARRANJO é a evidência da pureza, e por isso ela é declarada aqui
 * ---------------------------------------------------------------------------
 *
 * Não há `beforeEach`, instância efêmera, porta dinâmica, relógio congelado nem dublê algum: as duas
 * funções são chamadas diretamente, com valores literais, e o que se observa é o retorno. Uma leitura
 * de relógio, uma ida ao banco ou uma dependência injetada tornariam este arquivo impossível de
 * escrever como está — de modo que a **forma** desta suíte é o que prova a propriedade, e não uma
 * asserção sobre ela.
 *
 * ---------------------------------------------------------------------------
 * Por que a linha do CAMPO DESCONHECIDO é o companion do modo de falha OPOSTO
 * ---------------------------------------------------------------------------
 *
 * As linhas do identificador ausente, vazio e curto são os companions negativos do aviso completo —
 * elas pegam a leitura frouxa demais. A linha dos campos desconhecidos pega o **erro contrário**, que
 * é o mais provável nesta base: alguém "corrigir" a leitura para `z.strictObject`, seguindo
 * `.claude/rules/contrato-publicado.md` sem ler a divergência declarada da §21.2 do tech spec. Com a
 * leitura fechada, toda notícia com campo novo do provedor viraria `ILEGIVEL` — perder a notícia é o
 * defeito que a fatia existe para não ter, e ele passaria por todas as outras linhas da tabela.
 *
 * A asserção dela é **igualdade com o resultado do aviso sem os extras**, e não apenas a categoria:
 * assim ela também reprova a leitura que aceitasse o corpo mas deixasse um campo traduzido escapar
 * para o retorno.
 *
 * ---------------------------------------------------------------------------
 * Por que a recusa de NÚMERO na liquidação exige as DUAS faixas do inteiro
 * ---------------------------------------------------------------------------
 *
 * O identificador da liquidação é a chave do efeito único (RN-08): coagir um valor que já chegou
 * corrompido de `JSON.parse` produziria dois efeitos distintos colidindo, ou o mesmo efeito aplicado
 * duas vezes. A guarda que impede isso é a leitura por cadeia, e a tentação que a ameaça tem nome —
 * *harmonizar* os três campos do bloco de dados sob a leitura que coage o inteiro, ao notar que eles
 * são lidos por funções diferentes.
 *
 * As duas leituras **coincidem** sobre cadeia e sobre número fora do inteiro seguro: nos dois casos
 * devolvem ausência. A única faixa em que elas divergem é o **inteiro seguro não negativo**, onde uma
 * coage e a outra recusa. Por isso o valor real deste arquivo — 19 posições, muito além da faixa —
 * não serve sozinho de rede: um caso só com ele passaria idêntico nas duas leituras, e a troca
 * seguiria invisível.
 *
 * Daí a tabela ter **duas linhas e um controle antivácuo por faixa**: a de dentro é a que discrimina
 * a leitura, e a de fora é a que fixa a prosa acima — que o valor que o provedor manda de fato passa
 * do inteiro seguro, e portanto a corrupção descrita não é hipotética.
 *
 * ---------------------------------------------------------------------------
 * A varredura dos NOVE desfechos é amarrada ao tipo em DUAS pontas
 * ---------------------------------------------------------------------------
 *
 * `DESFECHOS_DA_NOTIFICACAO` é escrita por extenso — derivá-la do SUT poria as duas pontas da
 * igualdade sob o mesmo autor —, e duas amarras impedem que ela envelheça em silêncio:
 *
 * 1. o `satisfies` obriga cada item a ser membro da união do SUT: um desfecho renomeado lá reprova
 *    aqui na verificação de tipos (`tsc -p tsconfig.test.json`, que o script `test` roda antes do
 *    Vitest), e não com um `false` inexplicável em execução;
 * 2. `COBERTURA_DOS_DESFECHOS` é um `Record` sobre a união inteira, de modo que o compilador cobra
 *    **uma chave por desfecho** — um décimo valor no SUT deixa este arquivo de compilar, em vez de
 *    passar despercebido por uma lista que ninguém atualizou.
 *
 * A igualdade de conjunto entre as duas, em execução, é o que fecha o par: sem ela, as duas
 * declarações poderiam divergir sem que a compilação acusasse (a lista aceita repetição, e o `Record`
 * não vê ordem).
 */

import { describe, expect, it } from 'vitest';
import type { DesfechoDaNotificacaoBancaria } from '../src/tratamento-de-notificacao.ts';
import {
  classificarNotificacaoBancaria,
  ehReentregaDeEfeitoAplicado,
} from '../src/tratamento-de-notificacao.ts';
import { diferencasDeConjunto } from './conjuntos.ts';

/** O identificador que o **produto** compôs e enviou — 18 posições, como o Caso A da §4.1.1 o traz. */
const IDENTIFICADOR_PERANTE_O_PROVEDOR = '202608000000000042';

/**
 * O número do título como o provedor o envia: **inteiro**, e não cadeia.
 *
 * É o valor que a medição §13-A.4 do discovery observou, e é ele que faz a coerção da fronteira ser
 * exercida de verdade — uma cadeia aqui deixaria o caso verde sem que coerção alguma acontecesse.
 */
const NUMERO_DO_TITULO_NO_PROVEDOR = 1234567;

/** O identificador que o **provedor** deu à baixa — 19 posições, e a chave do efeito único. */
const IDENTIFICADOR_DA_LIQUIDACAO = '1600100000000000001';

/** O aviso de recebimento completo — o Caso A da §4.1.1 do tech spec, campo a campo. */
const AVISO_COMPLETO = {
  idWebhook: 990,
  tipoMovimento: 7,
  dados: {
    seuNumero: IDENTIFICADOR_PERANTE_O_PROVEDOR,
    nossoNumero: NUMERO_DO_TITULO_NO_PROVEDOR,
    numeroCliente: 25546454,
    numeroIdentificadorBaixa: IDENTIFICADOR_DA_LIQUIDACAO,
    codigoBarrasBoleto: '00190000090123456789012345678901234567890123',
    codigoBarrasBaixa: '00190000090123456789012345678901234567890123',
    valorBoleto: 1500.0,
    valorPagamento: 1500.0,
    dataHoraSituacaoBaixa: '2026-08-18T14:03:11Z',
    dataVencimento: '2026-08-20',
    cancelamentoBaixa: false,
    baixaRealizadaEmContigencia: false,
    codigoMotivoCancelamento: 2,
  },
};

/** O pedido de validação do endereço — o Caso B da §4.1.1, que não roteia nem procura cobrança. */
const PEDIDO_DE_VALIDACAO = { idWebhook: 990, validacaoWebhook: true };

/** O que o aviso completo produz, campo a campo — os **três** nomes do produto, e nada do dialeto. */
const AVISO_TRADUZIDO = {
  classificacao: 'AVISO_DE_RECEBIMENTO',
  identificadorPeranteOProvedor: IDENTIFICADOR_PERANTE_O_PROVEDOR,
  numeroDoTituloNoProvedor: '1234567',
  identificadorDaLiquidacao: IDENTIFICADOR_DA_LIQUIDACAO,
};

/** A classificação de tudo que não se reconhece. */
const ILEGIVEL = { classificacao: 'ILEGIVEL' };

/** A classificação do pedido de validação do endereço. */
const VALIDACAO_DE_ENDERECO = { classificacao: 'VALIDACAO_DE_ENDERECO' };

/** Um aviso completo com o identificador trocado — o que varia entre as linhas 1, 3, 4 e 5. */
function avisoComIdentificador(identificador: unknown): unknown {
  return { ...AVISO_COMPLETO, dados: { ...AVISO_COMPLETO.dados, seuNumero: identificador } };
}

/**
 * Um aviso completo com o **identificador da liquidação** trocado — a chave do efeito único.
 *
 * Irmão de {@link avisoComIdentificador}, e separado dele de propósito: os dois campos são lidos por
 * funções diferentes, e um auxiliar único parametrizado pela chave esconderia justamente a diferença
 * que a tabela abaixo existe para fixar.
 */
function avisoComIdentificadorDaLiquidacao(valor: unknown): unknown {
  return {
    ...AVISO_COMPLETO,
    dados: { ...AVISO_COMPLETO.dados, numeroIdentificadorBaixa: valor },
  };
}

/**
 * Um valor de liquidação **dentro** do inteiro seguro — o único que discrimina as duas leituras.
 *
 * Escrito por extenso, e não derivado por corte do identificador real: derivá-lo faria o valor mudar
 * de faixa junto com a constante de cima, e é a **faixa**, não o dígito, que este caso existe para
 * exercer. O controle antivácuo da tabela é que amarra o literal à faixa que ele diz ocupar.
 */
const LIQUIDACAO_COMO_NUMERO_SEGURO = 1600100;

/** Um aviso completo sem uma das chaves do dialeto — a rede da decisão de exigir os três campos. */
function avisoSem(chave: 'nossoNumero' | 'numeroIdentificadorBaixa'): unknown {
  const { [chave]: _removida, ...resto } = AVISO_COMPLETO.dados;
  return { ...AVISO_COMPLETO, dados: resto };
}

/**
 * O aviso completo acrescido de campos que o produto **não conhece** — a leitura tolerante em ato.
 *
 * Os nomes imitam o que um provedor acrescenta sem avisar: chave nova no bloco de dados e chave nova
 * na raiz do corpo.
 */
const AVISO_COM_CAMPOS_DESCONHECIDOS = {
  ...AVISO_COMPLETO,
  versaoDoLayout: '2.1',
  dados: {
    ...AVISO_COMPLETO.dados,
    codigoSituacaoInedito: 42,
    blocoQueNaoExistia: { qualquerCoisa: true },
  },
};

/** Os nove desfechos que uma notícia pode ter, na ordem em que o enum do banco os declara. */
const DESFECHOS_DA_NOTIFICACAO = [
  'RECEBIDO',
  'VALIDACAO_DE_ENDERECO',
  'ILEGIVEL',
  'SEM_CORRESPONDENCIA',
  'DIVERGENTE',
  'RETIDO',
  'REENTREGA',
  'CONFERIDO_SEM_EFEITO',
  'APLICADO',
] as const satisfies readonly DesfechoDaNotificacaoBancaria[];

/**
 * Controle de **exaustividade**: o `Record` sobre a união inteira obriga uma chave por desfecho.
 *
 * Um décimo valor no SUT — ou um renomeado — faz este literal deixar de satisfazer a anotação, e a
 * verificação de tipos reprova nomeando a chave ausente. É a metade que a lista acima não cobre.
 */
const COBERTURA_DOS_DESFECHOS: Record<DesfechoDaNotificacaoBancaria, true> = {
  RECEBIDO: true,
  VALIDACAO_DE_ENDERECO: true,
  ILEGIVEL: true,
  SEM_CORRESPONDENCIA: true,
  DIVERGENTE: true,
  RETIDO: true,
  REENTREGA: true,
  CONFERIDO_SEM_EFEITO: true,
  APLICADO: true,
};

/** O único desfecho que registra efeito produzido — o que o predicado tem de reconhecer. */
const DESFECHO_COM_EFEITO = 'APLICADO';

// ===========================================================================
// CT-970 — a classificação decide entre as três categorias
// ===========================================================================

describe('CT-970 — classificarNotificacaoBancaria decide entre as três categorias', () => {
  const TABELA = [
    { forma: 'aviso completo', recebido: AVISO_COMPLETO, esperado: AVISO_TRADUZIDO },
    {
      forma: 'pedido de validação do endereço',
      recebido: PEDIDO_DE_VALIDACAO,
      esperado: VALIDACAO_DE_ENDERECO,
    },
    {
      forma: 'aviso sem identificador',
      recebido: avisoComIdentificador(undefined),
      esperado: ILEGIVEL,
    },
    { forma: 'identificador vazio', recebido: avisoComIdentificador(''), esperado: ILEGIVEL },
    {
      forma: 'identificador com 17 posições',
      recebido: avisoComIdentificador(IDENTIFICADOR_PERANTE_O_PROVEDOR.slice(0, 17)),
      esperado: ILEGIVEL,
    },
    {
      forma: 'aviso com campos desconhecidos do provedor',
      recebido: AVISO_COM_CAMPOS_DESCONHECIDOS,
      esperado: AVISO_TRADUZIDO,
    },
  ];

  it.each(TABELA)('classifica o corpo inteiro — $forma', ({ recebido, esperado }) => {
    // Igualdade do OBJETO INTEIRO, e não só da categoria: um aviso que classificasse certo e
    // traduzisse errado — ou que deixasse escapar um campo do dialeto para o retorno — reprova aqui
    // nomeando a diferença.
    expect(classificarNotificacaoBancaria(recebido)).toEqual(esperado);
  });

  it('o número do título chega inteiro e sai cadeia — a coerção da fronteira', () => {
    // Controle antivácuo da coerção: o valor de ENTRADA é um número. Sem esta asserção, uma cadeia
    // no arranjo faria o caso passar sem que coerção alguma tivesse acontecido.
    expect(typeof AVISO_COMPLETO.dados.nossoNumero).toBe('number');

    const classificada = classificarNotificacaoBancaria(AVISO_COMPLETO);

    // O estreitamento pelo discriminador é o caminho legítimo de leitura dos campos traduzidos, e a
    // asserção da categoria vem antes por isso.
    expect(classificada.classificacao).toBe('AVISO_DE_RECEBIMENTO');
    if (classificada.classificacao !== 'AVISO_DE_RECEBIMENTO') {
      return;
    }

    expect(typeof classificada.numeroDoTituloNoProvedor).toBe('string');
    expect(classificada.numeroDoTituloNoProvedor).toBe('1234567');
    expect(typeof classificada.identificadorPeranteOProvedor).toBe('string');
    expect(typeof classificada.identificadorDaLiquidacao).toBe('string');
  });

  it('campo desconhecido não desclassifica: o resultado é idêntico ao do aviso sem os extras', () => {
    // Controle antivácuo: os extras existem de fato no corpo submetido — sem isto, um arranjo que
    // esquecesse de acrescentá-los provaria apenas que dois objetos iguais classificam igual.
    expect(AVISO_COM_CAMPOS_DESCONHECIDOS.versaoDoLayout).toBe('2.1');
    expect(AVISO_COM_CAMPOS_DESCONHECIDOS.dados.codigoSituacaoInedito).toBe(42);

    expect(classificarNotificacaoBancaria(AVISO_COM_CAMPOS_DESCONHECIDOS)).toEqual(
      classificarNotificacaoBancaria(AVISO_COMPLETO),
    );
  });

  it('o pedido de validação decide ANTES de qualquer outra consideração', () => {
    // O corpo carrega, ao mesmo tempo, um aviso que seria legítimo e a marca do pedido de validação.
    // Uma implementação que lesse o bloco de dados primeiro devolveria `AVISO_DE_RECEBIMENTO` e
    // rotearia uma cobrança que ninguém pagou (CA-11).
    expect(classificarNotificacaoBancaria({ ...AVISO_COMPLETO, validacaoWebhook: true })).toEqual(
      VALIDACAO_DE_ENDERECO,
    );

    // E a marca só vale como a bandeira que ela é: um valor parecido não a substitui.
    expect(classificarNotificacaoBancaria({ idWebhook: 990, validacaoWebhook: 'true' })).toEqual(
      ILEGIVEL,
    );
  });

  it.each([
    { forma: 'nulo', recebido: null },
    { forma: 'indefinido', recebido: undefined },
    { forma: 'cadeia', recebido: 'notificacao' },
    { forma: 'arranjo', recebido: [{ ...AVISO_COMPLETO }] },
    { forma: 'número', recebido: 990 },
    { forma: 'booleano', recebido: true },
    { forma: 'objeto vazio', recebido: {} },
    { forma: 'bloco de dados que não é objeto', recebido: { dados: 'nada' } },
  ])('corpo que não é o esperado sai ILEGIVEL, e nunca por exceção — $forma', ({ recebido }) => {
    // A ausência de exceção é observada pelo próprio retorno: uma função que levantasse não chegaria
    // à comparação, e o caso reprovaria com o erro levantado.
    expect(classificarNotificacaoBancaria(recebido)).toEqual(ILEGIVEL);
  });

  it('identificador com 19 posições sai ILEGIVEL — a largura é fechada dos dois lados', () => {
    // Controle antivácuo do arranjo: o identificador submetido tem mesmo 19 posições, e o legítimo
    // tem 18. Sem isto, um `slice`/concatenação errado provaria outra coisa.
    const dezenove = `${IDENTIFICADOR_PERANTE_O_PROVEDOR}7`;
    expect(dezenove.length).toBe(19);
    expect(IDENTIFICADOR_PERANTE_O_PROVEDOR.length).toBe(18);

    expect(classificarNotificacaoBancaria(avisoComIdentificador(dezenove))).toEqual(ILEGIVEL);

    // E o identificador que chega como NÚMERO também sai ILEGIVEL: 18 dígitos passam de
    // `Number.MAX_SAFE_INTEGER`, de modo que o valor já chegou corrompido de `JSON.parse` — coagi-lo
    // rotearia para a cobrança errada, ou para nenhuma.
    expect(Number.isSafeInteger(Number(IDENTIFICADOR_PERANTE_O_PROVEDOR))).toBe(false);
    expect(
      classificarNotificacaoBancaria(
        avisoComIdentificador(Number(IDENTIFICADOR_PERANTE_O_PROVEDOR)),
      ),
    ).toEqual(ILEGIVEL);
  });

  it.each([
    { forma: 'sem o número do título', chave: 'nossoNumero' as const },
    { forma: 'sem o identificador da liquidação', chave: 'numeroIdentificadorBaixa' as const },
  ])('aviso incompleto sai ILEGIVEL — $forma', ({ chave }) => {
    const recebido = avisoSem(chave);

    // Controle antivácuo: a chave foi mesmo removida do corpo submetido.
    expect(Object.keys(AVISO_COMPLETO.dados)).toContain(chave);
    expect(Object.keys((recebido as { dados: Record<string, unknown> }).dados)).not.toContain(
      chave,
    );

    // Sem o número do título não há o que conferir (RN-05); sem o identificador da liquidação não há
    // chave de efeito único (RN-08). Passar adiante como aviso deixaria a tarefa aplicar efeito sem a
    // chave que o torna único.
    expect(classificarNotificacaoBancaria(recebido)).toEqual(ILEGIVEL);
  });

  it.each([
    {
      forma: 'número dentro do inteiro seguro',
      valor: LIQUIDACAO_COMO_NUMERO_SEGURO,
      cabeNoInteiroSeguro: true,
    },
    {
      forma: 'número fora do inteiro seguro',
      valor: Number(IDENTIFICADOR_DA_LIQUIDACAO),
      cabeNoInteiroSeguro: false,
    },
  ])(
    'identificador da liquidação que chega como número sai ILEGIVEL — $forma',
    ({ valor, cabeNoInteiroSeguro }) => {
      // Controle antivácuo em duas pontas: o valor submetido é mesmo um número, e está mesmo na faixa
      // que a linha declara. Sem a segunda asserção, as duas linhas poderiam cair fora do inteiro
      // seguro e a tabela provaria a mesma coisa duas vezes — deixando de fora justamente a faixa em
      // que as duas leituras divergem.
      expect(typeof valor).toBe('number');
      expect(Number.isSafeInteger(valor)).toBe(cabeNoInteiroSeguro);

      // A linha de dentro da faixa é a que discrimina: sob a leitura que coage o inteiro ela sairia
      // como AVISO_DE_RECEBIMENTO, com a chave do efeito único remontada a partir de um número —
      // exatamente o defeito que a leitura por cadeia impede (RN-08).
      expect(classificarNotificacaoBancaria(avisoComIdentificadorDaLiquidacao(valor))).toEqual(
        ILEGIVEL,
      );
    },
  );
});

// ===========================================================================
// CT-982 — só o desfecho APLICADO é reentrega
// ===========================================================================

describe('CT-982 — ehReentregaDeEfeitoAplicado só reconhece o desfecho APLICADO', () => {
  it('o desfecho anterior APLICADO é reentrega, e o DIVERGENTE não é', () => {
    expect(ehReentregaDeEfeitoAplicado('APLICADO')).toBe(true);
    expect(ehReentregaDeEfeitoAplicado('DIVERGENTE')).toBe(false);
  });

  it('dos nove desfechos, exatamente um devolve true', () => {
    // Controle antivácuo em duas pontas: a lista tem os nove, e ela é o MESMO conjunto que o
    // `Record` sobre a união inteira — que o compilador já obrigou a ser exaustivo. Sem isto, uma
    // lista encurtada faria a contagem abaixo passar por não ter olhado para o desfecho que falta.
    expect(DESFECHOS_DA_NOTIFICACAO.length).toBe(9);
    expect(
      diferencasDeConjunto(Object.keys(COBERTURA_DOS_DESFECHOS), [...DESFECHOS_DA_NOTIFICACAO]),
    ).toEqual({ excedentes: [], ausentes: [] });

    const reconhecidos = DESFECHOS_DA_NOTIFICACAO.filter((desfecho) =>
      ehReentregaDeEfeitoAplicado(desfecho),
    );

    // Igualdade de lista, e não contagem: o mutante `return true` reprova nomeando os oito
    // excedentes, e o predicado apontado para o desfecho errado reprova nomeando as duas pontas.
    // É o que impede `CONFERIDO_SEM_EFEITO` de ser fundido com `APLICADO` — a corrida entre o aviso
    // e a baixa no provedor precisa continuar reprocessável.
    expect(reconhecidos).toEqual([DESFECHO_COM_EFEITO]);
  });

  it('ausência de notícia anterior não é reentrega', () => {
    // As duas formas de ausência que o monorepo pratica: `null` da coluna e `undefined` da consulta
    // que não achou linha. Um predicado que as tratasse como efeito faria a PRIMEIRA notícia de cada
    // liquidação sair sem efeito algum.
    expect(ehReentregaDeEfeitoAplicado(null)).toBe(false);
    expect(ehReentregaDeEfeitoAplicado(undefined)).toBe(false);
  });
});
