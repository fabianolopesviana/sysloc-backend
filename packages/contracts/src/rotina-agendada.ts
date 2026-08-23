/**
 * O contrato das **rotinas agendadas** — a declaração única do relógio do produto, o roster que o
 * Admin enxerga, o limiar a partir do qual o silêncio vira atraso e o vocabulário do que a empresa
 * pode resolver sozinha.
 *
 * ===========================================================================
 * Por que o mapa cobre as SEIS unidades, e não só as três publicadas
 * ===========================================================================
 *
 * {@link CADENCIA_DA_ROTINA} tem uma entrada por **unidade systemd**, e {@link ROTINAS_PUBLICADAS} é
 * o subconjunto **derivado** dela pelo campo `publicada`. A forma anterior — dois conjuntos escritos
 * lado a lado — foi refutada no challenge de 2026-08-22 porque produzia **contradição executável**: a
 * asserção estática das unidades compara o `OnCalendar=` de **cada** `.timer` contra a cadência
 * declarada aqui, e três dos seis (`VIGILANCIA_DAS_ROTINAS`, `MANUTENCAO`, `RETOMADA_DE_NOTICIAS`)
 * não teriam entrada num mapa restrito às publicadas — a suíte teria de escolher entre não cobrir
 * três unidades ou manter uma segunda lista, que é a divergência que a ADR-0016 fecha.
 *
 * **Não "simplifique" o mapa para três entradas**: é exatamente o que reabre a contradição. E não
 * escreva uma segunda lista literal das publicadas: `ROTINAS_PUBLICADAS` sai de um filtro sobre este
 * mapa, e o tipo {@link RotinaPublicada} sai do mesmo lugar, de modo que **acrescentar rotina ao
 * roster do Admin é ligar um booleano**, e não editar dois lugares que ninguém amarra.
 *
 * As três não publicadas são **infraestrutura** (RN-18): elas não produzem registro tenantizado, e o
 * que elas têm a dizer vai para o journal do operador, nunca para a leitura do Admin. A **diferença
 * entre os dois conjuntos é asserida por igualdade nos dois sentidos** (CT-1090) — é o que impede uma
 * rotina de manutenção de vazar para a tela por descuido, e o que impede uma publicada de sumir dela.
 *
 * ===========================================================================
 * O limiar é da CADÊNCIA, nunca da rotina
 * ===========================================================================
 *
 * {@link LIMIAR_DE_ATRASO_POR_CADENCIA} é indexado pelo **tipo de cadência** (RD-17), e não pelo nome
 * da rotina. Número solto por rotina é o defeito que esta constante existe para impedir: com um
 * limiar por rotina, duas rotinas do mesmo relógio ganham tolerâncias diferentes sem que ninguém
 * tenha decidido isso, e a terceira nasce sem limiar algum.
 *
 * O tipo dele é `Record<TipoDeCadenciaPublicada, …>`, derivado do próprio mapa: publicar uma rotina
 * cuja cadência não tenha limiar **não compila**. É a mesma forma de `STATUS_POR_CODIGO` em
 * `apps/api` — a cobertura é do compilador, e o CT-1090 a reafirma em execução, nos dois sentidos.
 *
 * Os valores são **minutos**, e a unidade é conteúdo: é ela que a linha de alerta da vigilância
 * publica como `limiarMinutos`, e é ela que a comparação do banco converte em intervalo.
 *
 * ===========================================================================
 * A saída é ABERTA, e é isso que torna a decisão D3 reversível
 * ===========================================================================
 *
 * Todo esquema deste arquivo é de **saída**, logo `z.object` (`.claude/rules/contrato-publicado.md`:
 * a direção decide a estritude). **Não há esquema de entrada nesta fatia** — a única rota é um `GET`
 * sem corpo. A abertura é o que permite ampliar a leitura existente em vez de publicar uma segunda
 * rota, se a tela vier a exigir percurso longo: campo novo na resposta nasce sem quebrar o cliente
 * já publicado, e esta é a **última superfície antes do congelamento**.
 *
 * ⚠️ **Não simetrize a saída com uma restrição de faixa.** Vale aqui a assimetria que
 * `./automacao-de-cobranca.ts` já registra e que o marcador `DECISÃO FECHADA` de `ESCALA_DA_METRAGEM`
 * em `./comum.ts` protege: esquema de saída que recusa **não produz `422`** — ele levanta na
 * serialização e derruba a rota. Quem impede o valor impossível de existir é o banco, no ponto que
 * grava. Por isso as contagens do resumo são `z.number()` puro.
 *
 * ===========================================================================
 * A rotina é identificada pelo NOME canônico do roster (ADR-0017)
 * ===========================================================================
 *
 * Não há UUID nem código legível aqui, e a ausência é a regra, não uma exceção: a ADR-0017 dá três
 * classes de chave exposta, e a rotina **não é entidade referenciável** — não tem série declarada,
 * não tem linha própria e não é alvo de nenhuma rota. Ela é um rótulo de vocabulário fechado, e o
 * nome canônico do roster é a chave. Inventar identificador para ela criaria um segundo vocabulário
 * para o mesmo fato, que é o que a RN-19 proíbe.
 *
 * Isso **não** alcança o nome do envelope: a resposta é `{ itens: [...] }`, como toda coleção de topo
 * deste produto. O que a ADR-0017 dispensa aqui são as **três chaves de janela** —
 * `total`, `limite` e `deslocamento` —, porque o roster é fechado em três: não há janela para pedir,
 * nem total que possa diferir do tamanho do arranjo. O precedente literal, e o molde copiado byte a
 * byte, é `esquemaDaTrilhaDaCobranca` em `./cobranca-bancaria.ts`.
 *
 * ===========================================================================
 * Três campos são ANULÁVEIS, e o nulo é conteúdo
 * ===========================================================================
 *
 * `ultimaExecucao: null` **não é erro** — é a empresa recém-admitida, que ainda não teve passagem com
 * efeito; a leitura não cria linha alguma nem responde `404` por isso. `resumo` acompanha o instante:
 * sem passagem, não há o que resumir. `impedimento: null` é a rotina sem nada que o Admin precise
 * resolver. E `historicoRecente` é arranjo que **pode ser vazio** pela mesma razão — vazio não é
 * ausência de dado, é ausência de passagem.
 *
 * ===========================================================================
 * O resumo é registro ABERTO de números — um vocabulário por rotina, nunca dois
 * ===========================================================================
 *
 * Cada rotina resume a própria passagem com as contagens que ela produz (decisão D4 do
 * tech-alignment), e o contrato as publica **como o banco as gravou**, sem remodelagem. Declará-lo
 * como três esquemas fixos por rotina amarraria o contrato ao conjunto de rotinas de hoje e obrigaria
 * a mexer aqui a cada rotina nova.
 *
 * ⚠️ **O resumo da rotina de aviso REUSA `candidatas` / `enviadas` / `falhas` / `semDestinatario`**,
 * que `@sysloc/regua` já publica em `ResultadoDaRegua`. Inventar `avisadas`/`recusadas` criaria um
 * segundo vocabulário para o mesmo fato (§21.7 Q1) — e é justamente o que o registro aberto torna
 * fácil demais de fazer por descuido.
 *
 * ===========================================================================
 * Todo instante é ISO-8601 UTC composto pelo servidor
 * ===========================================================================
 *
 * `z.iso.datetime()`, como todo `timestamptz` publicado por este pacote. O contrato **não formata
 * data**: quem fixa o eixo é a consulta, com `AT TIME ZONE 'UTC'`.
 */

import { z } from 'zod';

/**
 * Os quatro relógios que o produto usa — o vocabulário fechado das cadências.
 *
 * É a união que {@link CadenciaDaRotina} restringe, e é por ela que {@link CADENCIA_DA_ROTINA} não
 * pode ganhar um tipo de relógio novo em silêncio: o `satisfies` abaixo recusa em **compilação** a
 * entrada com cadência fora desta lista. Ela não sai pelo barril — é composição interna do contrato,
 * e quem precisa do tipo de um rótulo o obtém do recurso publicado
 * (`EstadoDeRotina['cadencia']['tipo']`), que é derivação do mesmo esquema e não uma segunda
 * declaração livre para divergir.
 */
export type TipoDeCadencia = 'A_CADA_MINUTO' | 'A_CADA_10_MIN' | 'A_CADA_15_MIN' | 'DIARIA';

/**
 * A cadência declarada de **uma** unidade systemd.
 *
 * `hora` só existe na cadência `DIARIA` — nas de intervalo não há hora marcada —, e é por isso que
 * ela é opcional. Sob `exactOptionalPropertyTypes`, opcional significa **ausente**, nunca
 * `undefined` explícito: a entrada do mapa ou declara a hora, ou não tem a chave.
 *
 * `publicada` é o que separa o roster do Admin da infraestrutura, e ele é **booleano declarado**, e
 * não a ausência da entrada: é a existência das seis entradas que permite à asserção estática cobrir
 * as seis unidades.
 */
export interface CadenciaDaRotina {
  /** O relógio da unidade. */
  readonly tipo: TipoDeCadencia;
  /** A hora marcada, `HH:MM`, presente apenas nas cadências diárias. */
  readonly hora?: string;
  /** `true` quando a rotina entra na leitura do Admin; `false` quando é infraestrutura (RN-18). */
  readonly publicada: boolean;
}

/**
 * A cadência de **cada uma das seis unidades systemd** — a declaração única do relógio do produto.
 *
 * ⚠️ **Mudar horário aqui muda a unidade, e vice-versa.** A asserção estática de
 * `packages/shared/test/unidades-agendadas.spec.ts` compara o `OnCalendar=` de cada `.timer` contra
 * esta tabela, nos dois sentidos: seis unidades, seis entradas. A suíte reprova se as duas
 * declarações divergirem, e isso é **deliberado** — é o que impede o horário de existir em dois
 * lugares livres para andar separados.
 *
 * O congelamento é em **dois níveis**, e o de dentro não é ornamento: `as const` fecha as uniões em
 * compilação e não sobrevive ao build, e um `Object.freeze` só na raiz deixaria
 * `CADENCIA_DA_ROTINA.MANUTENCAO.publicada = true` passar em execução — o consumidor compilado
 * leria uma cadência adulterada, e {@link ROTINAS_PUBLICADAS}, já derivada na carga do módulo,
 * continuaria dizendo outra coisa. As duas declarações precisam ser imutáveis para que a derivação
 * seja um fato, e não uma foto.
 */
export const CADENCIA_DA_ROTINA = Object.freeze({
  AVISO_DE_COBRANCA: Object.freeze({ tipo: 'A_CADA_MINUTO', publicada: true } as const),
  ENCERRAMENTO_DE_CONTRATOS: Object.freeze({
    tipo: 'DIARIA',
    hora: '00:02',
    publicada: true,
  } as const),
  CONFERENCIA_DE_LIQUIDACAO: Object.freeze({
    tipo: 'DIARIA',
    hora: '03:00',
    publicada: true,
  } as const),
  VIGILANCIA_DAS_ROTINAS: Object.freeze({ tipo: 'A_CADA_15_MIN', publicada: false } as const),
  MANUTENCAO: Object.freeze({ tipo: 'DIARIA', hora: '03:30', publicada: false } as const),
  RETOMADA_DE_NOTICIAS: Object.freeze({ tipo: 'A_CADA_10_MIN', publicada: false } as const),
} as const) satisfies Readonly<Record<string, CadenciaDaRotina>>;

/** Toda rotina declarada — as seis unidades, publicadas ou não. */
export type RotinaAgendada = keyof typeof CADENCIA_DA_ROTINA;

/**
 * As rotinas que a leitura do Admin devolve — **derivado** de {@link CADENCIA_DA_ROTINA}, no tipo.
 *
 * O tipo condicional é a metade em compilação da mesma derivação que o filtro faz em execução: ligar
 * `publicada` numa entrada acrescenta o nome aqui **e** no arranjo, sem que exista um segundo lugar
 * para esquecer.
 */
export type RotinaPublicada = {
  [Rotina in RotinaAgendada]: (typeof CADENCIA_DA_ROTINA)[Rotina]['publicada'] extends true
    ? Rotina
    : never;
}[RotinaAgendada];

/**
 * O roster que a leitura do Admin devolve — **derivado por filtro**, jamais redigitado.
 *
 * A **ordem é conteúdo**: ela é a ordem de declaração do mapa, e é a ordem em que a rota devolve as
 * rotinas. `Object.keys` a preserva para chaves textuais, de modo que a ordem da tela e a ordem da
 * declaração são o mesmo fato.
 *
 * A conversão de `Object.keys` é a única do arquivo, e é estreita: a assinatura da biblioteca padrão
 * devolve `string[]` mesmo sobre um objeto de chaves literais conhecidas. O predicado de tipo logo
 * abaixo é o que estreita o resultado para as publicadas, e ele lê o **mesmo** campo que o tipo
 * condicional acima consulta.
 */
export const ROTINAS_PUBLICADAS = Object.freeze(
  (Object.keys(CADENCIA_DA_ROTINA) as RotinaAgendada[]).filter(
    (rotina): rotina is RotinaPublicada => CADENCIA_DA_ROTINA[rotina].publicada,
  ),
);

/** Os relógios efetivamente usados pelas rotinas publicadas — derivados, nunca redigitados. */
export type TipoDeCadenciaPublicada = (typeof CADENCIA_DA_ROTINA)[RotinaPublicada]['tipo'];

/**
 * Os tipos de cadência que a leitura pode devolver, sem repetição e na ordem do roster.
 *
 * Derivado do roster publicado porque é o roster que a rota devolve: publicar no documento um relógio
 * que rota nenhuma entrega faria o contrato prometer o que ele não cumpre — o mesmo raciocínio que
 * fez `CANAIS_DE_AVISO` ser enum de um valor só em `./automacao-de-cobranca.ts`.
 */
const TIPOS_DE_CADENCIA_PUBLICADOS = Object.freeze([
  ...new Set(ROTINAS_PUBLICADAS.map((rotina) => CADENCIA_DA_ROTINA[rotina].tipo)),
]);

/** Quantos minutos tem uma hora — a unidade em que os limiares são declarados. */
const MINUTOS_POR_HORA = 60;

/**
 * O silêncio, em **minutos**, a partir do qual a rotina é considerada parada (RN-17 · RD-17).
 *
 * `A_CADA_MINUTO → 15 min` tolera a fila lenta sem tolerar a fila parada; `DIARIA → 26 h` cobre a
 * diária que atrasou algumas horas sem deixar passar o dia inteiro perdido — as duas horas de folga
 * são o que separa "correu tarde" de "não correu".
 *
 * ⚠️ **Os dois lados leem daqui**: a derivação de `atrasada` no banco e o alerta da vigilância. Um
 * número escrito no consumidor é o que esta constante existe para impedir — o CT-1074 e o CT-1086
 * tomam o esperado deste mapa, e não de um literal do teste.
 *
 * O `satisfies` cobra **cobertura total** das cadências publicadas em compilação: publicar uma rotina
 * de relógio novo sem declarar o limiar dela não compila. As cadências das três rotinas de
 * infraestrutura não entram — elas não são lidas pelo Admin e não têm atraso derivado —, e é isso que
 * a cobertura mútua do CT-1090 afirma nos dois sentidos.
 */
export const LIMIAR_DE_ATRASO_POR_CADENCIA = Object.freeze({
  A_CADA_MINUTO: 15,
  DIARIA: 26 * MINUTOS_POR_HORA,
} as const) satisfies Readonly<Record<TipoDeCadenciaPublicada, number>>;

/**
 * O que impede uma rotina de produzir efeito **e está na alçada do Admin** — união fechada.
 *
 * O que não está na alçada dele não entra aqui: falha de infraestrutura, processo caído e unidade que
 * não disparou são do operador, e saem pelo journal (RN-18). A fronteira é o que dá sentido ao campo
 * — uma lista que misturasse as duas naturezas viraria "erro genérico", e o Admin não saberia quais
 * itens ele consegue resolver.
 *
 * `as const` fecha a união em **compilação**; `Object.freeze` fecha o arranjo em **execução**, e é a
 * segunda que impede um consumidor de alargar o vocabulário com um `push`.
 */
export const CODIGOS_DE_IMPEDIMENTO = Object.freeze([
  'REGUA_DESLIGADA',
  'AVISOS_RECUSADOS_PELO_PROVEDOR',
  'INTEGRACAO_BANCARIA_PENDENTE',
] as const);

/** Um dos três impedimentos que o Admin pode resolver sozinho. */
export type CodigoDeImpedimento = (typeof CODIGOS_DE_IMPEDIMENTO)[number];

/**
 * O impedimento publicado — o código fechado e a mensagem que o Admin lê.
 *
 * A mensagem é escrita em **vocabulário do produto** (RD-19): diagnóstico cru de terceiro obedece à
 * ADR-0034 e à redação de `@sysloc/shared`, e não chega aqui. O par código + mensagem existe porque
 * o código é o que a tela pode ramificar e a mensagem é o que ela mostra — um só dos dois obrigaria
 * a tela a traduzir o código, criando o segundo vocabulário que a RN-19 proíbe.
 */
export const esquemaDoImpedimento = z.object({
  codigo: z.enum(CODIGOS_DE_IMPEDIMENTO),
  mensagem: z.string(),
});

/**
 * As contagens de uma passagem, como a rotina as gravou.
 *
 * É **função**, e não uma constante compartilhada, pelo mesmo motivo de `camposDeEndereco()` em
 * `./comum.ts`: o objeto de esquema do Zod é consumido por composição em dois pontos (o resumo da
 * última passagem e o de cada linha do histórico), e uma única instância partilhada os deixaria
 * acoplados a qualquer emenda futura de um deles.
 */
function esquemaDoResumoDaPassagem() {
  return z.record(z.string(), z.number());
}

/**
 * O estado publicado de **uma** rotina do roster (§4.1.1).
 *
 * `hora` usa `z.iso.time({ precision: -1 })`, que é **o mesmo molde** que
 * `./automacao-de-cobranca.ts` declara por expressão ancorada — medido: o documento publicado sai com
 * `^(?:[01]\d|2[0-3]):[0-5]\d$`, e `24:00`, `08:60`, `8:00`, `08:0`, `08:00:00` e `08:00:30.5` são
 * todos recusados. Aquele arquivo rejeita `z.iso.time()` **na forma padrão**, e a razão que ele
 * registra é literal — *"aceita segundos e fração"* —, que é exatamente o que a precisão de minuto
 * remove. Nada ali é contrariado, e o repositório não ganha a **terceira** cópia de um molde que hoje
 * tem duas (`./automacao-de-cobranca.ts` e `packages/db/test/envio-de-cobranca.spec.ts`) — que é o
 * que o Limiar de Três do `CLAUDE.md` manda evitar.
 *
 * `atrasada` é campo **derivado no servidor** e nunca no cliente (ADR-0017, regra 2): quem compara o
 * silêncio contra {@link LIMIAR_DE_ATRASO_POR_CADENCIA} é a mesma consulta que lê a última execução,
 * porque a comparação participa de **seleção** — a vigilância filtra as atrasadas.
 */
export const esquemaDoEstadoDeRotina = z.object({
  rotina: z.enum(ROTINAS_PUBLICADAS),
  cadencia: z.object({
    tipo: z.enum(TIPOS_DE_CADENCIA_PUBLICADOS),
    hora: z.iso.time({ precision: -1 }).optional(),
  }),
  ultimaExecucao: z.iso.datetime().nullable(),
  resumo: esquemaDoResumoDaPassagem().nullable(),
  proximaEsperada: z.iso.datetime(),
  atrasada: z.boolean(),
  impedimento: esquemaDoImpedimento.nullable(),
  historicoRecente: z.array(
    z.object({
      ocorridaEm: z.iso.datetime(),
      resumo: esquemaDoResumoDaPassagem(),
    }),
  ),
});

/**
 * A resposta de `GET /v1/automacao-de-cobranca/rotinas` — o roster inteiro, sempre, em `itens`.
 *
 * ⚠️ **A chave é `itens`, e ela NÃO é negociável pela natureza da coleção.** A cláusula de lista da
 * ADR-0017 tem dois eixos, e só um deles depende de haver janela: `total`, `limite` e `deslocamento`
 * descrevem **paginação**, e o nome `itens` descreve o **envelope de coleção**. Medido em
 * `packages/contracts/src/` em 2026-08-22: os **dois** corpos de topo que devolvem coleção o chamam
 * de `itens` — `envelopeDeLista` em `./comum.js` e `esquemaDaTrilhaDaCobranca` em
 * `./cobranca-bancaria.js` —, e `esquemaDaEmissaoEmLote`, no mesmo arquivo, usa o mesmo nome para o
 * arranjo **dentro** do recurso. As únicas chaves de arranjo com nome de domínio do pacote
 * (`imoveis`, `comodos`, `fiadores`) são campos **internos** de um recurso, jamais o corpo de topo de
 * uma rota de coleção. Batizar este de `rotinas` faria dele o primeiro a abandonar o nome comum, e o
 * consumidor publicado passaria a ter duas formas de ler uma coleção sem que fato algum do domínio o
 * exigisse.
 *
 * O que de fato fica de fora são as **três chaves de janela**, e a razão é a mesma que
 * {@link ./cobranca-bancaria.js#esquemaDaTrilhaDaCobranca} escreve para si: declará-las
 * *"prometeria uma janela que esta rota não oferece"*. São **três** rotinas, o roster é fechado, e
 * paginar coleção fechada é oferecer ao cliente um controle que não decide nada. Por isso o envelope
 * é o daquele precedente, byte a byte, e não `envelopeDeLista`.
 *
 * É objeto, e não arranjo no topo, pela mesma razão que `envelopeDeLista` existe: corpo que é lista
 * no topo não tem onde ganhar campo sem quebrar cliente publicado — e é essa folga que torna
 * reversível a decisão D3 desta fatia.
 *
 * O item é {@link esquemaDoEstadoDeRotina} **por referência**, nunca por cópia dos oito campos: um
 * campo novo no estado aparece aqui pelo compilador, e não por alguém lembrar de espelhá-lo.
 */
export const esquemaDoEstadoDasRotinas = z.object({
  itens: z.array(esquemaDoEstadoDeRotina),
});

/**
 * O estado publicado de uma rotina, derivado do esquema (ADR-0016).
 *
 * O impedimento **não** ganha alias próprio, pela mesma razão registrada em
 * `./automacao-de-cobranca.ts`: quem precisa do tipo o obtém do recurso publicado
 * (`EstadoDeRotina['impedimento']`), que é derivação do mesmo esquema. Um alias por composição
 * acrescentaria símbolo à superfície do pacote sem acrescentar um fato sequer.
 */
export type EstadoDeRotina = z.infer<typeof esquemaDoEstadoDeRotina>;

/** A resposta da leitura, derivada do esquema (ADR-0016). */
export type EstadoDasRotinas = z.infer<typeof esquemaDoEstadoDasRotinas>;
