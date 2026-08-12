/**
 * A composição do aviso — os **dois** moldes, escolhidos pelo estado publicado (RD-16).
 *
 * ===========================================================================
 * O conteúdo é composto em CÓDIGO, e não é dado configurável
 * ===========================================================================
 *
 * O PRD fecha personalização por empresa fora de escopo, e a decisão tem consequência prática: não
 * há tabela de modelo, não há campo de texto editável e não há substituição de variável vinda do
 * banco. O molde vem de `retorno.template` do oráculo — o registro do que o sistema antigo enviava.
 *
 * **Duas divergências de forma são deliberadas, e não são regressão:**
 *
 * 1. o legado escreve `<br>` porque compõe HTML dentro do arcabouço dele; aqui o corpo sai em
 *    **texto puro**, com quebra de linha de verdade;
 * 2. o legado imprime `Boleto indisponivel` porque a emissão bancária é da F4 — e o oráculo mediu
 *    exatamente isso. Preservamos o mesmo dizer em vez de inventar um endereço que ninguém emite.
 *
 * O que se preserva é a **estrutura**: saudação nominal, o código da cobrança, o vencimento
 * formatado, o valor, os dados do imóvel e o fecho. O oráculo é o registro do que existia, não uma
 * exigência de igualdade de bytes num texto que ele mesmo mede com o boleto ausente.
 *
 * O texto reproduz o do legado **sem acentuação**, e isso também vem do oráculo. Não o "corrija":
 * é o que o locatário reconhece na caixa dele desde antes desta migração, e a acentuação seria uma
 * terceira divergência — desta vez sem razão.
 *
 * ===========================================================================
 * O corpo sai em TEXTO PURO — e é por isso que nada é escapado aqui
 * ===========================================================================
 *
 * Nome de locatário, identificador de imóvel e nome de conjunto entram no corpo como vieram do
 * cadastro. Não há contexto de marcação a escapar: em texto puro, `<script>` é a cadeia
 * `<script>` e nada mais. **Se algum dia este corpo virar HTML, este é o ponto em que a escapada
 * passa a ser obrigatória** (§11.4 do tech spec) — e o dia em que isso acontecer, o parágrafo acima
 * deixa de valer e este aqui é o aviso.
 *
 * ===========================================================================
 * Por que NENHUM rótulo de estado é escrito neste arquivo
 * ===========================================================================
 *
 * Os rótulos do estado da cobrança existem num lugar só — `@sysloc/contracts` —, e a asserção
 * estática do CT-612 varre `packages/regua/src/**` justamente para que a segunda cópia não nasça
 * aqui. Os dois moldes, portanto, se decidem sobre **valores importados**, obtidos por
 * desestruturação posicional da união fechada.
 *
 * A ordem da união é **conteúdo, não estética** — o próprio `@sysloc/contracts` a declara assim, e
 * `packages/db` deriva dela a ordem do enum do PostgreSQL, que a migração já gravou. Ainda assim, a
 * rede contra uma reordenação silenciosa não é a prosa: é o **CT-614**, que afirma o assunto de cada
 * molde por igualdade de cadeia inteira — trocar a ordem da união troca os dois moldes de lugar e
 * reprova o caso.
 */

import { ESTADOS_DA_COBRANCA } from '@sysloc/contracts';
import type { CandidataAoAviso } from './porta-de-dados.js';

/**
 * O aviso pronto para ser entregue — o que a porta de e-mail recebe e o que a verificação captura.
 *
 * Assunto e corpo, e nada mais: destinatário é do **envio**, não da mensagem. Fundi-los faria a
 * mesma mensagem carregar para quem ela vai, e um aviso composto uma vez não poderia ser entregue a
 * dois endereços sem ser recomposto.
 */
export interface MensagemDeAviso {
  /** A linha de assunto, já com o código da cobrança. */
  readonly assunto: string;
  /** O corpo em texto puro, com quebras de linha reais. */
  readonly corpo: string;
}

/**
 * Os dois estados **avisáveis**, obtidos da união fechada que o contrato publica.
 *
 * A desestruturação é posicional porque não há outra forma de nomear um rótulo sem escrevê-lo — ver
 * o cabeçalho. A união é uma tupla literal (`as const`), de modo que os dois recebem o tipo exato do
 * rótulo, e não `string`: comparar `status` com eles é comparação de união fechada, que o compilador
 * confere.
 */
// DÉBITO COM GATILHO — D12 · F3/T4 · registrado 2026-08-11
// O QUÊ: a escolha do molde depende da ORDEM de `ESTADOS_DA_COBRANCA`, um array de outro pacote,
//        e não de um nome publicado por ele.
// QUANDO FECHA: a primeira task que abrir `packages/contracts/src/cobranca.ts` por outra razão —
//        ali se publica `ESTADOS_AVISAVEIS` como tupla `as const` (o molde de `ESTADOS_DA_COBRANCA`,
//        NÃO o de `ESTADOS_EM_ABERTO`, que é `readonly EstadoDaCobranca[]` e perderia o
//        estreitamento de união fechada) e esta desestruturação passa a ler dela.
// POR QUE NÃO AGORA: `packages/contracts` está fora da §5 desta task, e as duas alternativas
//        internas estão fechadas — o literal do rótulo é proibido pelo CT-612 (T8), que varre
//        `packages/regua/src/**`, e o mapa indexado pelo estado recairia nos mesmos rótulos como
//        chaves. A rede existe e foi MEDIDA: reordenar a constante dá `3 failed | 11 passed`, e a
//        ordem já é carga estrutural independente disto — `negocio.enum('status_cobranca', …)` a
//        gravou na `0009`, de modo que reordená-la já é incompatível com migração aplicada.
// ÍNDICE: docs/specs/features/regua-de-cobranca/v1/_run/run-report.md §2, D12
const [ESTADO_AVISAVEL_ANTES_DO_VENCIMENTO, ESTADO_AVISAVEL_APOS_O_VENCIMENTO] =
  ESTADOS_DA_COBRANCA;

/**
 * O que a recusa diz quando o estado não admite aviso.
 *
 * Constante nomeada, e não literal no ponto do `throw`: esta cadeia é conferida por asserção (o
 * companheiro negativo do CT-614), e ter nome é o que impede duas escritas do mesmo dizer.
 *
 * ⚠️ **Ela não é publicada, e a borda NÃO a cita.** Quem traduz a recusa em `422` reconhece o
 * **tipo** ({@link ErroDeEstadoNaoAvisavel}) e lê o estado do **campo** — nunca compara a mensagem.
 * A distinção é o que fecha o **D10 (F3/T4)**: enquanto a recusa atravessava a fronteira do pacote
 * como `Error` genérico, o único jeito de reconhecê-la era casar texto, e o texto teria de ser
 * redigitado do outro lado — a segunda representação do mesmo fato que a ADR-0016 elimina. O
 * parágrafo anterior desta prosa afirmava a citação pela borda, que a visibilidade nunca permitiu.
 */
const MOTIVO_DE_ESTADO_NAO_AVISAVEL = 'estado não avisável';

/**
 * A recusa por estado terminal — cobrança **paga ou cancelada** não é avisável (RD-02).
 *
 * ---------------------------------------------------------------------------
 * Por que uma classe, e não o `Error` genérico que estava aqui
 * ---------------------------------------------------------------------------
 *
 * Esta recusa atravessa duas fronteiras: sobe de `comporAvisoDeCobranca` para
 * `enviarAvisoDeCobranca` (`./regua.ts`) e de lá para a borda HTTP, que a traduz em `422
 * CAMPO_INVALIDO` com `detalhes.estado`. Com um `Error` genérico, os dois consumidores só teriam a
 * **mensagem** para discriminar — e a cadeia que a compõe não é exportada. A borda redigitaria o
 * texto, e a segunda escrita ficaria livre para divergir na primeira emenda desta.
 *
 * O `estado` viaja em **campo**, e não recortado da mensagem: extrair o rótulo de uma cadeia é
 * análise sintática que pode falhar em silêncio, e o valor que a borda publica em `detalhes.estado`
 * precisa ser o mesmo que o compositor recusou.
 *
 * A classe estende `Error` e **preserva a mensagem byte a byte** — nenhum tratamento genérico que já
 * existia deixa de valer, e o companheiro negativo do CT-614 continua a comparando por igualdade.
 *
 * A recusa mora **neste** arquivo, e não em `./regua.ts`, porque é aqui que ela é levantada: pô-la
 * lá faria os dois módulos se importarem em ciclo — `./regua.ts` já importa o compositor daqui.
 */
export class ErroDeEstadoNaoAvisavel extends Error {
  /** O estado publicado que recusou o aviso — o que a borda põe em `detalhes.estado`. */
  readonly estado: CandidataAoAviso['status'];

  constructor(estado: CandidataAoAviso['status']) {
    super(`${MOTIVO_DE_ESTADO_NAO_AVISAVEL}: ${estado}`);
    // `name` é escrito à mão porque a herança de `Error` não o deriva da classe: sem isto, o
    // registro estruturado e o `stack` diriam apenas `Error`, e o diagnóstico perderia o nome que
    // identifica a recusa.
    this.name = 'ErroDeEstadoNaoAvisavel';
    this.estado = estado;
  }
}

/** Quantas casas o produto publica em toda grandeza monetária — `numeric(15,2)`. */
const CASAS_DECIMAIS_DO_VALOR = 2;

/**
 * Onde entra o separador de milhar: entre dígitos, a cada três contados **da direita**.
 *
 * `\B` impede o separador de nascer na borda da cadeia, e o `lookahead` conta os grupos completos.
 * É a forma que opera sobre **texto** — e é isso que se quer: o valor chega em texto do banco e sai
 * em texto para o aviso, sem nunca virar ponto flutuante no meio do caminho.
 */
const POSICAO_DO_SEPARADOR_DE_MILHAR = /\B(?=(\d{3})+(?!\d))/g;

/**
 * As duas primeiras linhas de todo aviso, mais a linha em branco que as separa da saudação.
 *
 * Declaradas uma vez e compartilhadas pelos dois moldes: o oráculo mede as duas idênticas nos dez
 * cenários, e duas cópias ficariam livres para divergir na primeira emenda de texto.
 */
const ABERTURA: readonly string[] = [
  'Mensagem automatica do Sistema de Locacao de Imoveis.',
  'NAO RESPONDA ESSA MENSAGEM! CONTA DE EMAIL NAO MONITORADA.',
  '',
];

/** O fecho, igualmente comum aos dois moldes. */
const FECHO: readonly string[] = [
  'Caso o pagamento ja tenha sido efetuado, favor desconsiderar este comunicado.',
  'Permanecemos a disposicao para esclarecimentos.',
  'Atenciosamente,',
  'Equipe Financeira',
];

/**
 * O que ocupa o lugar do endereço do boleto enquanto a emissão bancária não existe (F4).
 *
 * É o texto do oráculo, preservado por decisão: quando a F4 chegar, o ponto de mudança é **este**, e
 * não uma linha de molde espalhada em dois lugares.
 */
const BOLETO_INDISPONIVEL = 'Boleto indisponivel';

/**
 * Formata a grandeza monetária no padrão pt-BR, operando **sobre texto**.
 *
 * `Intl.NumberFormat` seria o caminho idiomático e foi descartado por duas razões concretas: ele
 * exige converter para `number` — reintroduzindo o ponto flutuante que o `numeric(15,2)` existe para
 * evitar — e, na moeda brasileira, ele separa `R$` do número por **espaço não separável** (U+00A0),
 * que não é o caractere que o aviso do legado imprime nem o que a asserção do CT-614 compara.
 *
 * O valor chega do banco como `1100.00`. A parte decimal é completada e recortada em duas casas para
 * que um `1100` ou um `1100.5` — formas que outro projetor produziria — não vazem para o aviso com
 * o número de casas errado.
 */
function formatarValorEmReais(valor: string): string {
  const [inteiro = '0', decimais = ''] = valor.split('.');
  const centavos = decimais.padEnd(CASAS_DECIMAIS_DO_VALOR, '0').slice(0, CASAS_DECIMAIS_DO_VALOR);

  return `R$ ${inteiro.replace(POSICAO_DO_SEPARADOR_DE_MILHAR, '.')},${centavos}`;
}

/**
 * Formata `AAAA-MM-DD` como `DD/MM/AAAA`, **sem construir um `Date`**.
 *
 * Duas razões, e as duas são regra desta base:
 *
 * 1. `new Date('2026-03-01')` interpreta a cadeia como meia-noite **UTC** e imprime o dia anterior
 *    em qualquer fuso a oeste — o deslocamento de dia que a projeção por `to_char` existe para
 *    evitar. O vencimento é data de calendário, não instante;
 * 2. o relógio da operação mora no banco (ADR-0026), e este pacote não lê relógio de processo em
 *    ponto algum. `new Date(` tem **zero** ocorrências em `packages/regua/src/**`, e o CT-612 é a
 *    única rede desse defeito — nenhum caso comportamental o pega, porque o host acerta o fuso por
 *    acidente.
 */
function formatarDataDeVencimento(data: string): string {
  const [ano = '', mes = '', dia = ''] = data.split('-');

  return `${dia}/${mes}/${ano}`;
}

/**
 * Compõe o aviso da candidata, escolhendo o molde pelo **estado publicado** (RD-16).
 *
 * Estado terminal — cobrança paga ou cancelada — levanta {@link ErroDeEstadoNaoAvisavel}, nomeando o
 * estado recebido, e nenhuma mensagem é composta (RD-02). A recusa aqui é a última linha, não a primeira: quem decide quem é
 * avisado é o teste de admissão, e a régua nunca chega a compor para uma cobrança inelegível. Ainda
 * assim ela existe, e o motivo é o defeito medido no legado — lá, `core.py` e `emailer.py` derivam o
 * mesmo estado e **discordam**, ao ponto de o envio manual cobrar por dívida cancelada. Um compositor
 * que aceitasse qualquer estado transformaria uma discordância futura em mensagem entregue.
 */
export function comporAvisoDeCobranca(candidata: CandidataAoAviso): MensagemDeAviso {
  const valor = formatarValorEmReais(candidata.valorTotal);
  const vencimento = formatarDataDeVencimento(candidata.dataVencimento);
  const saudacao = `Prezado(a) ${candidata.nomeDoLocatario},`;
  const dadosDoImovel = `Dados do imovel: ${candidata.imovel} (${candidata.conjunto}).`;

  if (candidata.status === ESTADO_AVISAVEL_ANTES_DO_VENCIMENTO) {
    return {
      assunto: `Aviso de vencimento - Fatura de aluguel ${candidata.codigo}`,
      corpo: [
        ...ABERTURA,
        saudacao,
        `Informamos que a fatura do aluguel referente a ${candidata.codigo} vencera em ${vencimento}, no valor de ${valor}.`,
        dadosDoImovel,
        `Para pagamento, utilize o boleto disponivel em: ${BOLETO_INDISPONIVEL}.`,
        ...FECHO,
      ].join('\n'),
    };
  }

  if (candidata.status === ESTADO_AVISAVEL_APOS_O_VENCIMENTO) {
    return {
      assunto: `Pendencia financeira - Fatura de aluguel vencida ${candidata.codigo}`,
      corpo: [
        ...ABERTURA,
        saudacao,
        `Identificamos pendencia de pagamento da fatura do aluguel referente a ${candidata.codigo}, com vencimento em ${vencimento}, no valor de ${valor}.`,
        dadosDoImovel,
        `Para regularizacao, acesse o boleto: ${BOLETO_INDISPONIVEL}.`,
        ...FECHO,
      ].join('\n'),
    };
  }

  throw new ErroDeEstadoNaoAvisavel(candidata.status);
}
