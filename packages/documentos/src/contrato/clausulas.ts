/**
 * As **21 cláusulas** do contrato de locação, em texto fixo, com os pontos de interpolação nomeados.
 *
 * ===========================================================================
 * O texto é PORTE, não redação — e por isso os erros do original ficam
 * ===========================================================================
 *
 * Cada parágrafo abaixo foi transcrito do `contrato-pdf-fonte.py` — o Server Script `PDF contrato`
 * capturado do sistema antigo pela T1 —, e a fidelidade é o requisito: o produto emite **o mesmo
 * contrato**, e a prova de equivalência com o golden (CT-709) compara palavra a palavra. Isso
 * inclui as grafias que hoje se escreveriam de outro jeito (`subseqüente`, `conseqüências`,
 * `LOCATÀRIO`), a vírgula deslocada de `renuncia ,o que` e a concordância de `entende-se á`.
 *
 * **Não "corrija" nenhuma delas.** Corrigir é alterar cláusula de contrato de locação, que é ato
 * jurídico e não higiene de código — e a correção apareceria como divergência sem veredito no
 * CT-709, reprovando o caso. Se um dia a redação for revista, o caminho é decisão de negócio com
 * veredito escrito antes, nunca uma emenda de passagem.
 *
 * ===========================================================================
 * Por que os cabeçalhos são CONSTANTES, e não literais dentro do texto
 * ===========================================================================
 *
 * O cabeçalho `CLÁUSULA PRIMEIRA:` precisa coincidir em três lugares: no texto que o documento
 * imprime, na lista {@link CABECALHOS_DAS_CLAUSULAS} que o CT-708 (T6) percorre para afirmar que os
 * 21 aparecem **uma vez cada, em ordem crescente**, e na segmentação do oráculo pelo CT-709. Três
 * literais soltos ficariam livres para divergir, e o modo de falha é mudo: a lista continuaria com
 * 21 itens enquanto o documento imprimiria outro texto.
 *
 * O cabeçalho é parte do **conteúdo** do parágrafo, e não um campo à parte. É a decisão registrada
 * em `../porta-de-renderizacao.ts`: separá-lo obrigaria o adaptador a decidir como recompor
 * cabeçalho e corpo, que é decisão de conteúdo tomada fora do domínio.
 *
 * ===========================================================================
 * Os pontos de interpolação são NOMEADOS, e a falta de um deles LEVANTA
 * ===========================================================================
 *
 * `{prazoEmMeses}` em vez de posição, e {@link interpolar} recusa o molde cujo ponto não recebeu
 * valor. A alternativa idiomática — substituição direta, deixando o que não casa como está — foi
 * descartada porque o defeito sairia **dentro do documento**: `após decorridos {prazoEmMeses} meses`
 * impresso num contrato que alguém assina, ou, pior, um `undefined` no lugar do valor. É a mesma
 * classe que o CT-705 fecha na qualificação: recusar em vez de produzir documento parcial silencioso.
 */

/** Os 21 cabeçalhos, cada um declarado uma vez e consumido pelo molde do próprio parágrafo. */
const CABECALHO_PRIMEIRA = 'CLÁUSULA PRIMEIRA:';
const CABECALHO_SEGUNDA = 'CLÁUSULA SEGUNDA:';
const CABECALHO_TERCEIRA = 'CLÁUSULA TERCEIRA:';
const CABECALHO_QUARTA = 'CLÁUSULA QUARTA:';
const CABECALHO_QUINTA = 'CLÁUSULA QUINTA:';
const CABECALHO_SEXTA = 'CLÁUSULA SEXTA:';
const CABECALHO_SETIMA = 'CLÁUSULA SÉTIMA:';
const CABECALHO_OITAVA = 'CLÁUSULA OITAVA:';
const CABECALHO_NONA = 'CLÁUSULA NONA:';
const CABECALHO_DECIMA = 'CLÁUSULA DÉCIMA:';
const CABECALHO_DECIMA_PRIMEIRA = 'CLÁUSULA DÉCIMA PRIMEIRA:';
const CABECALHO_DECIMA_SEGUNDA = 'CLÁUSULA DÉCIMA SEGUNDA:';
const CABECALHO_DECIMA_TERCEIRA = 'CLÁUSULA DÉCIMA TERCEIRA:';
const CABECALHO_DECIMA_QUARTA = 'CLÁUSULA DÉCIMA QUARTA:';
const CABECALHO_DECIMA_QUINTA = 'CLÁUSULA DÉCIMA QUINTA:';
const CABECALHO_DECIMA_SEXTA = 'CLÁUSULA DÉCIMA SEXTA:';
const CABECALHO_DECIMA_SETIMA = 'CLÁUSULA DÉCIMA SÉTIMA:';
const CABECALHO_DECIMA_OITAVA = 'CLÁUSULA DÉCIMA OITAVA:';
const CABECALHO_DECIMA_NONA = 'CLÁUSULA DÉCIMA NONA:';
const CABECALHO_VIGESIMA = 'CLÁUSULA VIGÉSIMA:';
const CABECALHO_VIGESIMA_PRIMEIRA = 'CLÁUSULA VIGÉSIMA PRIMEIRA:';

/**
 * Os 21 cabeçalhos na ordem em que o documento os imprime.
 *
 * É o que o CT-708 (T6) percorre sobre o PDF renderizado, e o mutante que omite a
 * `CLÁUSULA DÉCIMA QUARTA` reprova por aqui. A congelação (`Object.freeze`) é a mesma prática de
 * `TIPOS_DE_PESSOA` e `ESTADOS_DO_CONTRATO` em `@sysloc/contracts`: lista publicada que alguém possa
 * alterar em tempo de execução é um segundo caminho para o mesmo fato.
 */
export const CABECALHOS_DAS_CLAUSULAS = Object.freeze([
  CABECALHO_PRIMEIRA,
  CABECALHO_SEGUNDA,
  CABECALHO_TERCEIRA,
  CABECALHO_QUARTA,
  CABECALHO_QUINTA,
  CABECALHO_SEXTA,
  CABECALHO_SETIMA,
  CABECALHO_OITAVA,
  CABECALHO_NONA,
  CABECALHO_DECIMA,
  CABECALHO_DECIMA_PRIMEIRA,
  CABECALHO_DECIMA_SEGUNDA,
  CABECALHO_DECIMA_TERCEIRA,
  CABECALHO_DECIMA_QUARTA,
  CABECALHO_DECIMA_QUINTA,
  CABECALHO_DECIMA_SEXTA,
  CABECALHO_DECIMA_SETIMA,
  CABECALHO_DECIMA_OITAVA,
  CABECALHO_DECIMA_NONA,
  CABECALHO_VIGESIMA,
  CABECALHO_VIGESIMA_PRIMEIRA,
] as const);

/** Os títulos de seção que o documento centraliza entre os grupos de cláusulas. */
const SECAO_OBJETO = 'OBJETO';
const SECAO_DESTINACAO = 'DESTINAÇÃO';
const SECAO_PRAZO = 'PRAZO';
const SECAO_VALOR = 'VALOR';
const SECAO_CONSERVACAO = 'CONSERVAÇÃO';
const SECAO_SANCOES = 'SANÇÕES';

/**
 * Um parágrafo do corpo fixo do contrato.
 *
 * `rotulo` é **identidade**, não texto do documento: é por ele que a comparação com o oráculo pareia
 * os blocos e nomeia o divergente, e é por isso que ele nunca é renderizado (ver
 * `../porta-de-renderizacao.ts`). `molde` é o conteúdo integral, cabeçalho incluído.
 */
export interface ParagrafoDoContrato {
  readonly rotulo: string;
  readonly molde: string;
}

/**
 * O corpo fixo do contrato — do título `OBJETO` ao fecho de estilo —, na ordem do legado.
 *
 * A ordem é **conteúdo**: um parágrafo fora de lugar muda o contrato, e é uma das cinco classes de
 * divergência que a normalização da comparação não pode absorver (mutante m3 de §21.2).
 *
 * O preâmbulo (título, partes qualificadas e fiadores) e o fecho de assinaturas **não** estão aqui:
 * eles dependem do agregado e são montados por `./composicao.ts`. O que esta lista carrega é
 * exatamente o que não varia com o contrato.
 */
export const PARAGRAFOS_DO_CONTRATO: readonly ParagrafoDoContrato[] = Object.freeze([
  { rotulo: 'secao-objeto', molde: SECAO_OBJETO },
  {
    rotulo: 'clausula-primeira',
    molde: `${CABECALHO_PRIMEIRA} O objeto do presente contrato é o imóvel residencial identificado como {nomeDoImovel}, localizado em {enderecoDoImovel}.`,
  },
  { rotulo: 'secao-destinacao', molde: SECAO_DESTINACAO },
  {
    rotulo: 'clausula-segunda',
    molde: `${CABECALHO_SEGUNDA} O(A) LOCATÁRIO(A) utilizará o imóvel exclusivamente para fins seus e de seus familiares, destino que não poderá ser alterado sem o prévio consentimento escrito do(a) LOCADOR(A), sendo vedada qualquer cessão, transferência ou sublocação, ainda quando parcial e temporária, gratuita ou onerosa.`,
  },
  {
    rotulo: 'clausula-terceira',
    molde: `${CABECALHO_TERCEIRA} Será equiparada à violação da cláusula anterior qualquer situação de fato pela qual o(a) LOCATÁRIO(A) deixe de ocupar direta e integralmente o imóvel locado, em seu nome e conta própria.`,
  },
  { rotulo: 'secao-prazo', molde: SECAO_PRAZO },
  {
    rotulo: 'clausula-quarta',
    molde: `${CABECALHO_QUARTA} A locação será pelo prazo determinado de {prazoEmMeses} meses, podendo ser prorrogado por igual período de comum acordo entre as partes interessadas, contados a partir da assinatura deste contrato, respeitando a data de assinatura do laudo de vistoria, data em que o (a) locatário (a) obriga-se a restituir o imóvel completamente desocupado, em conformidade com a LEI Nº 8.245 (Lei do Inquilinato) e Medida Provisória nº 482 de 30/03/94.`,
  },
  {
    rotulo: 'clausula-quinta',
    molde: `${CABECALHO_QUINTA} Se o(a) LOCATÁRIO(A) devolver o imóvel antes de transcorrido o prazo estabelecido na cláusula anterior, ou se a rescisão ocorrer por inadimplemento de obrigação aqui ajustada, pagará multa contratual correspondente a 01 (um) mês de aluguel, sem prejuízo das demais sanções legais e contratuais. (Código Civil) Art. 1193 – Parágrafo Único.`,
  },
  {
    rotulo: 'paragrafo-primeiro',
    molde: `PARÁGRAFO 1º: O(A) LOCATÁRIO(A) ficará dispensado(a) da multa contratual se a devolução do imóvel decorrer de transferência pela empregadora para prestar serviços em localidade diversa daquela do início do contrato, ou se notificar por escrito o(a) LOCADOR(A), após decorridos {prazoEmMeses} meses de aluguel, com antecedência mínima de 30 (trinta) dias.`,
  },
  {
    rotulo: 'clausula-sexta',
    molde: `${CABECALHO_SEXTA} Findo o prazo de locação estipulado na Cláusula Quarta, se não ocorrer a hipótese de rescisão ou a da renuncia ,o que neste último caso deverá ocorrer mediante aviso por escrito de qualquer dos contratantes ao outro até 30 (trinta) dias antes de se vencer cada período contratual, prorrogar-se-á a locação, consoante a assinatura de um novo contrato, com garantia consoante deste contrato.`,
  },
  { rotulo: 'secao-valor', molde: SECAO_VALOR },
  {
    rotulo: 'clausula-setima',
    molde: `${CABECALHO_SETIMA} O aluguel mensal é de {valorMensal} ({valorMensalPorExtenso}), com reajuste anual pelo índice IGPM-FGV, no período acumulativamente ou outro índice oficial determinado pelo governo que venha a substituí-lo. Daí por diante, caso ocorra a hipótese prevista na cláusula Sexta, ficará sujeito a reajustamentos periódicos estabelecidos na legislação pertinente que estiver em vigor.`,
  },
  {
    rotulo: 'alinea-valor-total',
    molde: 'a) VALOR TOTAL DO CONTRATO: {valorTotal} ({valorTotalPorExtenso}).',
  },
  {
    rotulo: 'clausula-oitava',
    molde: `${CABECALHO_OITAVA} O aluguel será pré-pago, (ou seja o inquilino paga no dia que entrar no imóvel ou no ato da assinatura do contrato respeitando o termo de vistoria) pontualmente até o dia {diaDeVencimento} de cada mês de locação ajustada na cláusula quarta deste instrumento, independente de cobrança, ou onde o (a) LOCADOR (A) determinar, estendendo-se esse prazo para o primeiro dia útil seguinte, caso coincida com sábado, domingo ou feriado. Ultrapassando os dias acima estipulados o aluguel será acrescido de multa de 2% (dois por cento) ao mês a partir do primeiro dia útil do vencimento e mais 1% (um por cento) de juros de mora, ao dia.`,
  },
  {
    rotulo: 'clausula-nona',
    molde: `${CABECALHO_NONA} Se o LOCADOR (A), ou seu representante legal, recusar recebimento sem justa causa ou o LOCATÁRIO (A) tiver dificuldade em efetuar o pagamento das obrigações contratuais, deverá este (a) promover o respectivo depósito judicial até o 5º (quinto) dia útil do mês subseqüente ao vencido. Não o fazendo, entende-se á que ficou constituído em mora, para todos os efeitos legais, especialmente para a incidência das obrigações adiante convencionadas.`,
  },
  {
    rotulo: 'clausula-decima',
    molde: `${CABECALHO_DECIMA} O aluguel será inteiramente liquido ao (à) LOCADOR (A) respeitada a legislação sobre a renda, ocorrendo por conta exclusiva do (a) LOCATÀRIO (A):`,
  },
  {
    rotulo: 'clausula-decima-alinea-a',
    molde:
      'a) Despesas de luz, água e serviços semelhantes, os comprovantes dos pagamentos deverão ser entregues ao (à) LOCADOR (A), ou seu representante legal, junto com o pagamento do aluguel vencido, no prazo da locação estipulado neste instrumento ou provável prorrogação;',
  },
  {
    rotulo: 'clausula-decima-alinea-b',
    molde:
      'b) Pagamento de Imposto Predial e Territorial Urbano (IPTU), além das taxas municipais relativas ao imóvel locado. Os comprovantes de pagamentos deverão ser entregues ao (à) LOCADOR (A) ou seu representante legal. Junto com o pagamento do aluguel vencido, no prazo da locação estipulado neste instrumento ou provável prorrogação;',
  },
  {
    rotulo: 'clausula-decima-alinea-c',
    molde: 'c) Satisfação de todas as exigências do poder público, relativa ao imóvel locado.',
  },
  {
    rotulo: 'clausula-decima-primeira',
    molde: `${CABECALHO_DECIMA_PRIMEIRA} Além das obrigações mencionadas, qualquer outra que caiba ao (à) LOCATARIO (A) e for pago pelo LOCADOR (A), poderá este (a) também cobra-lo junto e indissoluvelmente com qualquer aluguel sub-seqüente, aplicando-se à demora ou recusa de ressarcimento, as mesmas sanções que decorreriam do atraso no pagamento dos aluguéis.`,
  },
  {
    rotulo: 'clausula-decima-segunda',
    molde: `${CABECALHO_DECIMA_SEGUNDA} Obriga-se o (a) LOCATARIO (A) a remeter ao (à) LOCADOR (A), ou seu representante legal, dentro das 24 (vinte e quatro) horas de seu recebimento, qualquer correspondência, intimação ou notificação que lhe for dirigida pelo imóvel locado, e, caso não o faça, assume integralmente todas as responsabilidades pelas exigidas em tais intervenções e suas conseqüências.`,
  },
  {
    rotulo: 'clausula-decima-terceira',
    molde: `${CABECALHO_DECIMA_TERCEIRA} No ato da entrega das chaves o (a) LOCATARIO (A) liquidará os aluguéis até àquela data e apresentará os comprovantes quitados das despesas de que trata a Cláusula Décima, e depositará mediante recibo a importância correspondente ao consumo de energia, água e taxa de condomínio e demais despesa dos dias que excederem o ultima talão quitado, calculado á base do valor médio dos 03 (Três) meses anteriores.`,
  },
  { rotulo: 'secao-conservacao', molde: SECAO_CONSERVACAO },
  {
    rotulo: 'clausula-decima-quarta',
    molde: `${CABECALHO_DECIMA_QUARTA} Obriga-se o (a) LOCATARIO (A) a devolver o imóvel no estado em que o recebe, de acordo com o Laudo de Vistoria em anexo, que passa a ser parte integrante deste contrato.`,
  },
  {
    rotulo: 'clausula-decima-quinta',
    molde: `${CABECALHO_DECIMA_QUINTA} O (A) LOCATÁRIO (A) satisfará à própria custa, com solidez e perfeição, todo o reparo e conserto de que necessite ou venha a necessitar o imóvel locado, satisfazendo, nesse sentido todas exigências das autoridades públicas.`,
  },
  {
    rotulo: 'clausula-decima-sexta',
    molde: `${CABECALHO_DECIMA_SEXTA} O (A) LOCATARIO (A) será responsável pelos danos causados ao imóvel pelo mau trato ou por aqueles que resultarem para os vizinhos do mau uso do imóvel locado, não se prejudicando, durante os respectivos reparos, a continuidade deste contrato, em todos os seus efeitos.`,
  },
  {
    rotulo: 'clausula-decima-setima',
    molde: `${CABECALHO_DECIMA_SETIMA} O (A) LOCATARIO (A) ou seu representante legal, poderá inspecionar o imóvel, pessoalmente ou através de representantes, sendo tal vistoria imprescindível antes da restituição, a fim de verificar a fiel observância das obrigações assumidas pelo (a) LOCATARIO(A) neste contrato, o(a) qual não poderá, sob pretexto algum fazer oposição a esse direito.`,
  },
  {
    rotulo: 'clausula-decima-oitava',
    molde: `${CABECALHO_DECIMA_OITAVA} As benfeitorias ou acessões que vierem a ser introduzidas, de qualquer natureza, aderirão automaticamente ao imóvel locado, integralmente a plena propriedade do (a) LOCADORA (A). O consentimento escrito do LOCADOR (A), ou seu representante legal, todavia, será imprescindível. O LOCATÁRIO (A) renuncia desde logo, irrevogável, a todo direito de indenização, compensação ou retenção aos valores despedidos.`,
  },
  {
    rotulo: 'clausula-decima-nona',
    molde: `${CABECALHO_DECIMA_NONA} As adaptações que se fizerem necessárias à instalação de aparelhos eletrodomésticos, inclusive ar-condicionado, e que prescindam de mutilar o imóvel, poderão ser efetuados mediante aviso prévio e consentimento do (a) LOCADOR (A), ou seu representante legal sempre por escrito.`,
  },
  { rotulo: 'secao-sancoes', molde: SECAO_SANCOES },
  {
    rotulo: 'clausula-vigesima',
    molde: `${CABECALHO_VIGESIMA} Ao inadimplemento total ou parcial de qualquer das obrigações deste contrato serão aplicadas cumulativamente ou alternativamente, a juízo do (a) LOCADOR (A) ou seu representante legal, as seguintes sanções:`,
  },
  {
    rotulo: 'clausula-vigesima-alinea-a',
    molde:
      'a) Rescisão contratual automática, independente de interpelação judicial ou extrajudicial, não significa a tolerância de qualquer infração como renuncia deste direito, caso a mesma se repita ou se prolongue, com exigências das obrigações financeiras totais previstas neste contrato, por antecipação.',
  },
  {
    rotulo: 'clausula-vigesima-alinea-b',
    molde:
      'b) Multa penal igual ao valor do dano, em se tratando de desconservação do imóvel e suas benfeitorias.',
  },
  {
    rotulo: 'clausula-vigesima-alinea-c',
    molde: 'c) Perdas e danos que se apurarem, incluindo custos processuais.',
  },
  {
    rotulo: 'clausula-vigesima-alinea-d',
    molde:
      'd) Pagamentos dos honorários dos advogados e peritos do LOCADOR (A), ou seu representante legal, desde já fixado em 20% (vinte por cento) se for litigioso e 10% (dez por cento) se for amigável.',
  },
  {
    rotulo: 'clausula-vigesima-primeira',
    molde: `${CABECALHO_VIGESIMA_PRIMEIRA} As partes contratantes elegem o foro da Comarca de Caratinga – MG para dirimir quaisquer duvidas oriundas deste Contrato, renunciando a qualquer outro, por mais privilegio que seja.`,
  },
  {
    rotulo: 'fecho',
    molde:
      'E por estarem justos e contratados, assim o presente contrato em 02 (Duas) vias de igual teor e forma, na presença de 02(duas) testemunhas que também assinam, elegendo o Foro da Comarca de Caratinga - MG para quaisquer ações oriundas deste contrato.',
  },
]);

/** Onde os pontos de interpolação estão — `{nomeDoImovel}`, e nada mais. */
const PONTO_DE_INTERPOLACAO = /\{([A-Za-z]+)\}/gu;

/**
 * A recusa de um molde cujo ponto de interpolação não recebeu valor.
 *
 * O ponto faltante viaja em **campo** para que quem trata a recusa saiba **qual** valor faltou sem
 * recortar a mensagem.
 */
export class ErroDeInterpolacaoIncompleta extends Error {
  /** O nome do ponto de interpolação que ficou sem valor. */
  readonly ponto: string;

  constructor(ponto: string) {
    super(`ponto de interpolação sem valor: ${ponto}`);
    // `name` é escrito à mão porque a herança de `Error` não o deriva da classe.
    this.name = 'ErroDeInterpolacaoIncompleta';
    this.ponto = ponto;
  }
}

/**
 * Substitui cada ponto nomeado do molde pelo valor correspondente, **recusando** o que faltar.
 *
 * A recusa é o ponto inteiro da função: substituição silenciosa deixaria `{prazoEmMeses}` — ou um
 * `undefined` — impresso dentro de uma cláusula de contrato, e ninguém percebe um documento errado
 * até ele ser assinado.
 */
export function interpolar(molde: string, valores: Readonly<Record<string, string>>): string {
  return molde.replace(PONTO_DE_INTERPOLACAO, (_ocorrencia, ponto: string) => {
    const valor = valores[ponto];

    if (valor === undefined) {
      throw new ErroDeInterpolacaoIncompleta(ponto);
    }

    return valor;
  });
}
