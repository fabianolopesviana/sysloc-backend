/**
 * A maquinaria que responde, para **qualquer** composição raiz, duas perguntas que nenhum caso
 * comportamental alcança sozinho: *"que variáveis este processo EXIGE para subir?"* e *"cada uma
 * delas tem caminho de provisionamento numa instalação de máquina nova?"*.
 *
 * ===========================================================================
 * Por que ela mora AQUI, e não dentro do arquivo de teste de um dos processos
 * ===========================================================================
 *
 * Ela nasceu em `apps/worker/test/ambiente.spec.ts` (T8 da fatia `regua-de-cobranca`), servindo ao
 * `CT-643`, e derivava o conjunto exigido de **uma** composição raiz. O débito **D41** registrou o
 * que isso custaria: a **T10** faz `apps/api/src/configuracao/ambiente.ts` exigir `SMTP_URL` e
 * `EMAIL_REMETENTE`, e o arquivo de teste da `api` não alcança maquinaria que vive dentro do
 * diretório de teste de outro app — restariam duplicá-la, ou importá-la por caminho relativo entre
 * `apps/`, que é a forma do `D28`. Duplicada, ela ficaria livre para divergir exatamente no ponto em
 * que a divergência não faz barulho: **nada acusa** a omissão, porque a suíte de cada processo fica
 * verde sem a do outro.
 *
 * ⚠️ **O que este módulo NÃO fez foi migrar o consumidor original.** `apps/worker/test/ambiente.spec.ts`
 * segue com a própria cópia, e a razão é o Protocolo Antirregressão, não esquecimento: a derivação
 * por observação está sob um marcador `DECISÃO FECHADA` (T8 / Gate 1 rodada 2), e mover código sob
 * marcador é gatilho de parada — exige escalada ao usuário, com o texto literal do marcador contra o
 * que se precisa fazer. O que esta task pôde fazer sem contrariá-lo foi dar à maquinaria um **lar
 * canônico** e fazer o segundo processo consumi-lo, em vez de abrir a terceira escrita do mesmo
 * detector.
 *
 * ===========================================================================
 * As duas naturezas, e por que elas são separadas
 * ===========================================================================
 *
 * O lado da **exigência** é COMPORTAMENTAL: o conjunto sai de **executar** a leitura de ambiente —
 * quais nomes ela consulta na fonte, e quais dessas ela recusa quando faltam. Nenhuma função deste
 * arquivo lê o texto do fonte da composição, e nenhuma lê a mensagem de recusa. A razão está medida:
 * um detector textual fecha uma redação por rodada e deixa as outras abertas, e a composição raiz da
 * `api` monta a mensagem por **template**, de modo que a via não é hipotética.
 *
 * O lado do **provisionamento** é estático por natureza — um script de shell e uma unidade `systemd`
 * não são código que se chame —, e por isso ele pede prova de falsificação permanente na suíte que o
 * consome: o detector é função **pura sobre texto**, aplicável a cópias em memória com o defeito de
 * volta, sem escrever nada no disco.
 */

/** Assinatura de uma leitura de ambiente — a de produção e os mutantes das suítes. */
export type LeituraDeAmbiente = (fonte: Readonly<Record<string, string | undefined>>) => unknown;

/** Valor de preenchimento para variável cujo valor válido a suíte chamadora não conhece. */
export const VALOR_DE_PREENCHIMENTO = 'preenchida-para-o-experimento';

/**
 * Teto de rodadas da observação — a garantia de terminação, não um ajuste.
 *
 * O conjunto observado só cresce e é limitado pelos nomes que a leitura consulta, de modo que o
 * ponto fixo chega em poucas rodadas. O teto existe para que uma leitura patológica derrube o **caso**
 * em vez de pendurar a suíte inteira.
 */
const LIMITE_DE_RODADAS_DA_OBSERVACAO = 50;

/** Monta uma fonte que declara exatamente os nomes pedidos, com valor que a partida aceita. */
export function fonteDeclarando(
  nomes: Iterable<string>,
  conhecidos: Readonly<Record<string, string>>,
): Record<string, string> {
  const fonte: Record<string, string> = {};
  for (const nome of nomes) {
    fonte[nome] = conhecidos[nome] ?? VALOR_DE_PREENCHIMENTO;
  }

  return fonte;
}

/** A leitura RECUSA esta fonte? */
function recusa(ler: LeituraDeAmbiente, fonte: Record<string, string>): boolean {
  try {
    ler(fonte);

    return false;
  } catch {
    return true;
  }
}

/**
 * Os nomes que a leitura CONSULTA na fonte, capturados enquanto ela executa.
 *
 * `fonte.NOME`, `fonte['NOME']` e a desestruturação passam todos pelo mesmo `get` do `Proxy`, que é a
 * razão de a captura não depender de como o fonte está escrito.
 *
 * A observação é iterada até o **ponto fixo**, e não uma vez só, porque uma leitura que recusasse na
 * **primeira** ausência revelaria apenas a primeira consulta. A cada rodada, o espião entrega o que já
 * se sabe ser consultado e continua espiando o resto: a leitura avança um degrau e mostra a consulta
 * seguinte.
 */
export function variaveisConsultadasPor(
  ler: LeituraDeAmbiente,
  conhecidos: Readonly<Record<string, string>>,
): readonly string[] {
  const consultadas = new Set<string>();

  for (let rodada = 0; rodada < LIMITE_DE_RODADAS_DA_OBSERVACAO; rodada += 1) {
    const jaConhecidas = consultadas.size;
    const espiao = new Proxy<Record<string, string | undefined>>(
      fonteDeclarando(consultadas, conhecidos),
      {
        get(alvo, chave) {
          if (typeof chave !== 'string') {
            return undefined;
          }
          consultadas.add(chave);

          return alvo[chave];
        },
      },
    );

    try {
      ler(espiao);
    } catch {
      // Esperado enquanto faltar variável. O que interessa aqui é o que a leitura CONSULTOU.
    }

    if (consultadas.size === jaConhecidas) {
      return [...consultadas];
    }
  }

  throw new Error(
    `a observação não estabilizou em ${String(LIMITE_DE_RODADAS_DA_OBSERVACAO)} rodadas: ${[...consultadas].join(', ')}`,
  );
}

/**
 * As variáveis que a partida EXIGE — o subconjunto das consultadas cuja **omissão** é recusada.
 *
 * O filtro por omissão é o que separa exigir de apenas ler: uma variável opcional, consultada e
 * tolerada quando ausente, não entra — e cobrá-la do provisionamento seria falso.
 *
 * ⚠️ **O resíduo conhecido, nomeado em vez de silenciado (débito `D42 · F3/T8`).** A observação
 * enxerga toda exigência **incondicional**, qualquer que seja a redação da recusa ou a forma de
 * leitura. Ela **não** enxerga exigência **condicional** — `if (fonte.NODE_ENV === 'production' && …)`
 * —, porque o ramo não abre com a fonte que o espião entrega, e as duas âncoras do caso ficam mudas.
 * O risco é `BAIXO` **por medição**, e não por conveniência: nenhuma das duas composições raiz deste
 * repositório pratica exigência condicional — a do serviço de aplicação valida por um esquema **fixo**
 * e a do processador itera uma lista de módulo incondicional —, de modo que quem espelhar qualquer uma
 * das duas cai na via coberta. Uma composição futura que condicionasse a exigência precisa de um caso
 * próprio; não conte com esta derivação para ela.
 */
export function variaveisExigidasPor(
  ler: LeituraDeAmbiente,
  conhecidos: Readonly<Record<string, string>>,
): readonly string[] {
  const consultadas = variaveisConsultadasPor(ler, conhecidos);
  const declarandoTodas = fonteDeclarando(consultadas, conhecidos);

  return consultadas
    .filter((nome) => {
      const semEla = { ...declarandoTodas };
      delete semEla[nome];

      return recusa(ler, semEla);
    })
    .sort();
}

/** O arquivo de ambiente que as duas unidades carregam por `EnvironmentFile=`. */
const VARIAVEL_DO_ARQUIVO_DE_AMBIENTE = 'ARQ_AMBIENTE';

/** O destino de um redirecionamento de saída para variável (`>"${X}"` ou `>>"${X}"`). */
function destinoDeSaida(linha: string): string | undefined {
  return />>?\s*"\$\{([A-Za-z_][A-Za-z0-9_]*)\}"/.exec(linha)?.[1];
}

/**
 * O arquivo para onde uma linha de emissão escreve: o redirecionamento dela, ou o do bloco.
 *
 * A busca adiante para no **fechamento** do bloco (`}` ou `done`) e usa o destino dele — nunca
 * atravessa para o redirecionamento seguinte. É o que impede uma linha que escreve em `stdout` de
 * herdar o destino de um bloco alheio, que seria falso-negativo do detector.
 */
function destinoDaEmissao(linhas: readonly string[], indice: number): string | undefined {
  const proprio = destinoDeSaida(linhas[indice] ?? '');
  if (proprio !== undefined) {
    return proprio;
  }

  for (let adiante = indice + 1; adiante < linhas.length; adiante += 1) {
    const linha = linhas[adiante] ?? '';
    const inicio = linha.trimStart();
    if (inicio.startsWith('}') || inicio.startsWith('done')) {
      return destinoDeSaida(linha);
    }
  }

  return undefined;
}

/**
 * As chaves que o provisionamento EMITE **para o arquivo de ambiente**.
 *
 * Três descartes, e cada um fecha um jeito de o detector mentir que a chave foi entregue: a **linha
 * comentada** (o provisionador cita variáveis em comentário, inclusive a de um débito aberto), a
 * **menção sem escrita** (o casamento é sobre `printf 'CHAVE=`, a forma que grava) e a **escrita para
 * outro arquivo** (há chave gravada em `/etc/sysloc/migracao.env`, que nenhuma das duas unidades
 * carrega).
 *
 * ⚠️ O critério é o destino **literal** `${ARQ_AMBIENTE}`, e não o arquivo que o destino resolve.
 * Consequência assumida: uma chave apenas **semeada** em arquivo preexistente aparece como
 * desprovisionada. Isso é coerente com o que o detector afirma provar — a instalação de máquina nova,
 * onde o arquivo nasce do bloco redirecionado — e erra para o lado ruidoso, nunca para o silencioso.
 */
export function chavesEmitidasPor(fonteDoProvisionador: string): readonly string[] {
  const chaves = new Set<string>();
  const linhas = fonteDoProvisionador.split('\n');
  for (const [indice, linha] of linhas.entries()) {
    if (linha.trimStart().startsWith('#')) {
      continue;
    }
    if (destinoDaEmissao(linhas, indice) !== VARIAVEL_DO_ARQUIVO_DE_AMBIENTE) {
      continue;
    }
    for (const [, nome] of linha.matchAll(/printf '([A-Z][A-Z0-9_]*)=/g)) {
      chaves.add(nome as string);
    }
  }

  return [...chaves].sort();
}

/**
 * As chaves que uma unidade `systemd` declara por `Environment=` — a **segunda** fonte legítima.
 *
 * Ela não é detalhe de implementação: é a partição que as duas unidades documentam. O que carrega
 * credencial chega por `EnvironmentFile=` (o arquivo que o provisionamento grava, 0600, fora da
 * árvore), e o que é coordenada revisável chega por `Environment=` inline.
 */
export function chavesDeclaradasNaUnidade(fonteDaUnidade: string): readonly string[] {
  return [...fonteDaUnidade.matchAll(/^Environment=([A-Z][A-Z0-9_]*)=/gm)].map(
    ([, nome]) => nome as string,
  );
}

/** As chaves que o `.env.example` DECLARA — atribuição ancorada no início da linha. */
export function chavesDeclaradasPor(fonteDoExemplo: string): readonly string[] {
  return [...fonteDoExemplo.matchAll(/^([A-Z][A-Z0-9_]*)=/gm)].map(([, nome]) => nome as string);
}

/**
 * O detector inteiro: as variáveis exigidas que **não** têm caminho de provisionamento.
 *
 * Uma variável está provisionada quando alguma das duas fontes a entrega — o arquivo de ambiente que
 * o script grava, ou a diretiva `Environment=` da unidade que executa aquele processo — **e** o
 * `.env.example` a documenta. A conjunção com o exemplo é deliberada: ele é o contrato versionado que
 * a mensagem de recusa de partida manda o operador consultar, e uma variável exigida que não esteja
 * lá manda o operador a um documento que não a menciona.
 *
 * ⚠️ **O que ele prova, e o que ele não prova.** Ele prova que a chave é ENTREGUE ao processo numa
 * instalação de máquina nova, que é onde o arquivo de ambiente nasce. Ele **não** prova o caminho de
 * atualização de um arquivo preexistente, e não poderia: esse caminho é legitimamente diferente por
 * chave.
 */
export function semCaminhoDeProvisionamento(
  exigidas: readonly string[],
  fonteDoProvisionador: string,
  fonteDaUnidade: string,
  fonteDoExemplo: string,
): readonly string[] {
  const entregues = new Set([
    ...chavesEmitidasPor(fonteDoProvisionador),
    ...chavesDeclaradasNaUnidade(fonteDaUnidade),
  ]);
  const documentadas = new Set(chavesDeclaradasPor(fonteDoExemplo));

  return exigidas.filter((nome) => !entregues.has(nome) || !documentadas.has(nome));
}
