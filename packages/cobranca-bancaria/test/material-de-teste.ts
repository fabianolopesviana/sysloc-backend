/**
 * O acessório que **gera** material PKCS#12 em execução — porque nenhum `.pfx` entra no repositório.
 *
 * ===========================================================================
 * POR QUE GERAR, e não versionar um material de exemplo
 * ===========================================================================
 *
 * O Invariante 3 do projeto é *"nenhum segredo versionado"*, e o `.gitignore` já barra `*.pfx`. Um
 * material fixo na árvore seria um cofre com chave privada dentro dela, com senha escrita ao lado
 * para o teste poder abri-lo — e teria validade fixa, de modo que a suíte passaria a falhar num dia
 * futuro por vencimento do fixture, que é a forma mais desagradável de teste instável.
 *
 * Tudo o que este módulo escreve vive num diretório temporário próprio, apagado em `onTestFinished`.
 * O disco deste host é apertado, e material que sobra vira `No space left on device` **disfarçado de
 * teste vermelho**.
 *
 * ===========================================================================
 * QUEM GERA É O `openssl` DO SISTEMA — e isso não contradiz a decisão D2-c
 * ===========================================================================
 *
 * A D2-c recusa **biblioteca de terceiro que interprete o material**: quem lê os bytes que o Admin
 * entregou é o runtime, dentro do processo, e alargar aquela superfície de confiança seria o oposto
 * do que a fatia faz. Aqui a direção é inversa e o alcance é outro — não se **interpreta** segredo
 * algum do produto: **fabrica-se** um cofre descartável, fora do processo, num binário do sistema
 * operacional, e nenhuma linha disto entra em `src/`. Nenhuma dependência nova é acrescentada ao
 * manifesto (A8), e o pacote continua com zero dependência externa.
 *
 * A alternativa era escrever um compositor de ASN.1 próprio — X.509 e PKCS#12 montados à mão sobre
 * `node:crypto`. Recusada por custo e por risco: seriam centenas de linhas de estrutura binária
 * delicada **em código de teste**, cujo defeito se manifestaria como fixture sutilmente inválido, e
 * portanto como reprovação do SUT que está certo.
 *
 * ⚠️ **Ferramenta ausente nunca faz o caso passar em silêncio** (`.claude/rules/testing-stack.md`): a
 * ausência do binário levanta erro que a nomeia, em vez de degradar.
 *
 * ===========================================================================
 * A SENHA É PARÂMETRO, e ela nunca viaja em `argv`
 * ===========================================================================
 *
 * A senha do cofre é **parâmetro obrigatório** porque o CT-844 (T10) precisa que a senha sentinela
 * seja a senha **real** do PKCS#12 — derivar a agulha do dado que de fato circulou é o que impede a
 * variante oca (*"procurei uma cadeia que nunca entrou"*).
 *
 * Ela chega ao `openssl` por **arquivo 0600** dentro do diretório efêmero (`-passout file:`), e nunca
 * por `argv` nem por variável exportada. É a mesma disciplina que a ADR-0005 impõe aos verificadores
 * de infraestrutura, e vale aqui pela mesma razão: `argv` é legível por qualquer processo do host.
 *
 * ===========================================================================
 * DUAS AUTORIDADES, e o par é o que separa "o par recusou" de "os bytes eram ruins"
 * ===========================================================================
 *
 * {@link gerarAutoridadeDeTeste} é chamada uma vez por autoridade, e cada material é emitido por uma
 * delas. Sem **duas**, o CT-840 e o CT-843 (T10) não teriam como obter uma recusa vinda da **decisão
 * do par** — o servidor confia na autoridade A e o cliente apresenta material da B —, e provariam de
 * novo o CT-808, que é outra coisa. A extensão está registrada na §7 da T9 para não ser lida como
 * desvio de escopo.
 *
 * ===========================================================================
 * DUAS EMBALAGENS DO MESMO PAR, e é a igualdade entre elas que prova a conversão
 * ===========================================================================
 *
 * `comEmbalagemLegada` pede, na **mesma** chamada, um segundo cofre com o **mesmo** par chave/
 * certificado, embalado na cifra que a Autoridade Certificadora entrega (`RC2-40-CBC`) e que o
 * runtime recusa. Ela é opcional porque custa uma invocação a mais, e só a suíte da conversão a usa.
 *
 * ⚠️ **A extensão é do gerador que já existe, e não um segundo gerador** (`CLAUDE.md`: *"acessório
 * de suíte se importa, não se copia"*). Uma segunda função nasceria livre para divergir justamente
 * onde a divergência é invisível — a senha por `argv` em vez de `-passout file:` —, e duas chamadas
 * ao gerador atual produziriam **pares distintos**, o que faria a prova da conversão aprovar um
 * conversor que emite chave nova. É o mesmo par ou não é prova.
 *
 * ===========================================================================
 * OS FATOS CONHECIDOS SAEM DE UM CAMINHO INDEPENDENTE DO SUT
 * ===========================================================================
 *
 * `validoDe`, `validoAte` e `impressaoDigital` são lidos do certificado emitido pelo **próprio
 * `openssl`** (`-dates -dateopt iso_8601`, `-fingerprint -sha256`), e não pelo caminho TLS que o SUT
 * exercita. É o que faz a igualdade do CT-806 significar alguma coisa: os dois lados vêm de origens
 * distintas, e um defeito na projeção do SUT reprova em vez de se refletir nos dois lados.
 */

import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { onTestFinished } from 'vitest';

const executar = promisify(execFile);

/** O binário do sistema que fabrica o material. Ausente, o acessório recusa **nomeando-o**. */
const FERRAMENTA = 'openssl';

/** Teto de cada invocação. Geração de par RSA sob disputa de CPU é o caso lento previsto. */
const TETO_DA_FERRAMENTA_MS = 30_000;

/**
 * O porte da chave — RSA de 2048 bits, o mesmo do material real medido (~2,6 KB de PKCS#12).
 *
 * Curva elíptica geraria mais rápido, e foi recusada por fidelidade: o que a fatia vai apresentar ao
 * provedor é RSA, e um fixture de outra natureza tornaria o exercício menos parecido com o ato real
 * justamente na única fronteira que esta suíte atravessa.
 */
const PORTE_DA_CHAVE = 'rsa:2048';

/** Validade da autoridade — folgada, porque ela só existe durante a execução do caso. */
const DIAS_DA_AUTORIDADE = 3650;

/** Validade padrão do material emitido, quando o caso não declara a sua. */
const DIAS_DE_VALIDADE_PADRAO = 300;

/** O separador da forma textual do sujeito — o mesmo contrato de apresentação que o SUT publica. */
const SEPARADOR_DO_SUJEITO = ', ';

/**
 * Os argumentos que embalam o **mesmo** par em cifra legada — a que a Autoridade Certificadora
 * entrega, e que o runtime deste produto recusa.
 *
 * ⚠️ **Eles não são uma escolha de estilo: são a reprodução do material real.** Medido em duas
 * emissões consecutivas da AC (`D64 · F4/fechamento`), o `.pfx` chega em `RC2-40-CBC`, que o
 * OpenSSL 3 moveu para o provider `legacy` e o Node 24 recusa com `Unsupported PKCS12 PFX data`.
 * Sem esta embalagem, toda suíte deste pacote continuaria exercitando material que **nasce moderno**
 * — que é exatamente a razão de o defeito nunca ter aparecido em teste antes.
 *
 * O `-legacy` é obrigatório na **geração**: sem ele o provider que implementa a cifra não carrega e
 * o `openssl` recusa produzi-la. O `-macalg sha1` acompanha porque é o que a AC entrega junto.
 */
const ARGUMENTOS_DA_EMBALAGEM_LEGADA = [
  '-legacy',
  '-certpbe',
  'PBE-SHA1-RC2-40',
  '-keypbe',
  'PBE-SHA1-RC2-40',
  '-macalg',
  'sha1',
] as const;

/** O prefixo do diretório efêmero, para que resíduo eventual seja reconhecível no `/tmp`. */
const PREFIXO_DA_RAIZ = 'sysloc-material-';

/**
 * As extensões do certificado que o **par de teste** apresenta.
 *
 * O nome alternativo cobre as duas formas pelas quais um caso alcança o laço local, e o
 * `basicConstraints` diz explicitamente que o par não é autoridade — sem ele, um runtime que
 * endureça a cadeia recusaria uma folha sem a restrição declarada.
 */
const EXTENSOES_DO_SERVIDOR = [
  'subjectAltName=DNS:localhost,IP:127.0.0.1',
  'basicConstraints=critical,CA:FALSE',
  'keyUsage=critical,digitalSignature,keyEncipherment',
  'extendedKeyUsage=serverAuth',
  '',
].join('\n');

/** Os componentes do sujeito, na ordem em que o certificado os declara. */
export interface SujeitoDeTeste {
  readonly pais: string;
  readonly organizacao: string;
  readonly nomeComum: string;
}

/** O titular padrão: uma imobiliária fictícia identificada por um CNPJ que não existe. */
const TITULAR_PADRAO: SujeitoDeTeste = {
  pais: 'BR',
  organizacao: 'Imobiliaria de Teste Sysloc',
  nomeComum: '00000000000191',
};

/** Uma autoridade certificadora descartável, e a raiz efêmera onde ela e os materiais dela vivem. */
export interface AutoridadeDeTeste {
  /** Rótulo humano, usado no sujeito e no diagnóstico de uma reprovação. */
  readonly nome: string;
  /** O diretório temporário desta autoridade — apagado em `onTestFinished`. */
  readonly raiz: string;
  /** O certificado dela em PEM — é o que um par usa para decidir em quem confia (T10). */
  readonly certificadoEmPem: string;
  readonly caminhoDoCertificado: string;
  readonly caminhoDaChave: string;
}

/**
 * O par que o servidor de teste apresenta — chave e certificado em PEM, emitidos por uma autoridade.
 *
 * Ele **não** carrega senha nem cofre: quem apresenta material PKCS#12 é o cliente, e é o adaptador
 * sob prova que o abre. Aqui o que se precisa é apenas de uma identidade de servidor que a cadeia da
 * autoridade cubra.
 */
export interface ParDeServidorDeTeste {
  readonly chaveEmPem: string;
  readonly certificadoEmPem: string;
  readonly autoridade: AutoridadeDeTeste;
}

/** O que se pede ao acessório. Só `autoridade` e `senha` são obrigatórios. */
export interface OpcoesDoMaterial {
  readonly autoridade: AutoridadeDeTeste;
  /** A senha **real** do cofre — a mesma que o caso apresenta como sentinela. */
  readonly senha: string;
  readonly titular?: SujeitoDeTeste;
  readonly diasDeValidade?: number;
  /**
   * Pede a **segunda embalagem** do mesmo par: a cifra legada que a AC entrega.
   *
   * É opcional porque custa uma invocação a mais do `openssl` por material, e só a suíte da
   * conversão precisa dela — as demais exercitam a leitura, que só alcança a embalagem moderna.
   */
  readonly comEmbalagemLegada?: boolean;
}

/** O material gerado, mais os fatos conhecidos dele — lidos por caminho independente do SUT. */
export interface MaterialDeTeste {
  /** Os bytes do PKCS#12, como chegariam do corpo da requisição já decodificados. */
  readonly material: Buffer;
  readonly senha: string;
  /** A forma textual do sujeito, como o produto a publica: `C=BR, O=…, CN=…`. */
  readonly titular: string;
  readonly validoDe: Date;
  readonly validoAte: Date;
  /** Hexadecimal com separadores, maiúsculo — a mesma forma que o runtime devolve. */
  readonly impressaoDigital: string;
  /** O certificado da entidade em PEM, para quem precisar apresentá-lo fora do cofre. */
  readonly certificadoEmPem: string;
  readonly autoridade: AutoridadeDeTeste;
  /**
   * O **mesmo** par, embalado em cifra legada — presente só quando `comEmbalagemLegada` foi pedida.
   *
   * ⚠️ É o **mesmo certificado** de {@link MaterialDeTeste.material}: mesma série, mesma validade,
   * mesma impressão digital. É essa igualdade que dá conteúdo à prova da conversão — um acessório
   * que gerasse dois pares distintos faria o caso aprovar um conversor que emite chave nova.
   */
  readonly materialEmEmbalagemLegada?: Buffer;
}

/**
 * Cria uma autoridade certificadora descartável, com raiz temporária própria.
 *
 * A limpeza é registrada aqui, no ato da criação: quem chama não pode esquecê-la, e cada autoridade
 * leva embora os materiais que emitiu.
 */
export async function gerarAutoridadeDeTeste(nome: string): Promise<AutoridadeDeTeste> {
  const raiz = await mkdtemp(join(tmpdir(), PREFIXO_DA_RAIZ));
  onTestFinished(() => rm(raiz, { recursive: true, force: true }));

  const caminhoDaChave = join(raiz, 'autoridade.key');
  const caminhoDoCertificado = join(raiz, 'autoridade.crt');

  await ferramenta([
    'req',
    '-x509',
    '-newkey',
    PORTE_DA_CHAVE,
    '-noenc',
    '-sha256',
    '-days',
    String(DIAS_DA_AUTORIDADE),
    '-keyout',
    caminhoDaChave,
    '-out',
    caminhoDoCertificado,
    '-subj',
    formaDeLinhaDeComando({ pais: 'BR', organizacao: `Autoridade ${nome}`, nomeComum: nome }),
  ]);

  return {
    nome,
    raiz,
    caminhoDaChave,
    caminhoDoCertificado,
    certificadoEmPem: await readFile(caminhoDoCertificado, 'utf8'),
  };
}

/**
 * Emite um material PKCS#12 pela autoridade dada, e devolve os fatos conhecidos dele.
 *
 * O cofre carrega a chave privada, o certificado da entidade e o da autoridade — que é a composição
 * que o provedor bancário entrega ao cliente dele.
 */
export async function gerarMaterialDeTeste(opcoes: OpcoesDoMaterial): Promise<MaterialDeTeste> {
  const { autoridade, senha } = opcoes;
  const titular = opcoes.titular ?? TITULAR_PADRAO;
  const diasDeValidade = opcoes.diasDeValidade ?? DIAS_DE_VALIDADE_PADRAO;

  const pasta = await mkdtemp(join(autoridade.raiz, 'material-'));
  const caminhoDaChave = join(pasta, 'entidade.key');
  const caminhoDoPedido = join(pasta, 'entidade.csr');
  const caminhoDoCertificado = join(pasta, 'entidade.crt');
  const caminhoDoCofre = join(pasta, 'material.pfx');
  const caminhoDaSenha = join(pasta, 'senha');

  // A senha vai para arquivo restrito, e é por ele que o `openssl` a lê — nunca por `argv`.
  await writeFile(caminhoDaSenha, senha, { encoding: 'utf8', mode: 0o600 });

  await ferramenta([
    'req',
    '-newkey',
    PORTE_DA_CHAVE,
    '-noenc',
    '-keyout',
    caminhoDaChave,
    '-out',
    caminhoDoPedido,
    '-subj',
    formaDeLinhaDeComando(titular),
  ]);

  await ferramenta([
    'x509',
    '-req',
    '-in',
    caminhoDoPedido,
    '-CA',
    autoridade.caminhoDoCertificado,
    '-CAkey',
    autoridade.caminhoDaChave,
    '-CAcreateserial',
    '-sha256',
    '-days',
    String(diasDeValidade),
    '-out',
    caminhoDoCertificado,
  ]);

  const argumentosDoCofre = [
    'pkcs12',
    '-export',
    '-out',
    caminhoDoCofre,
    '-inkey',
    caminhoDaChave,
    '-in',
    caminhoDoCertificado,
    '-certfile',
    autoridade.caminhoDoCertificado,
    '-passout',
    `file:${caminhoDaSenha}`,
  ];

  await ferramenta(argumentosDoCofre);

  // A segunda embalagem sai do MESMO par: mesma chave, mesmo certificado, mesma senha — só o
  // invólucro muda. Reemitir o par aqui produziria duas identidades e destruiria a prova.
  const caminhoDoCofreLegado = join(pasta, 'material-legado.pfx');
  if (opcoes.comEmbalagemLegada === true) {
    await ferramenta([
      ...argumentosDoCofre.map((argumento) =>
        argumento === caminhoDoCofre ? caminhoDoCofreLegado : argumento,
      ),
      ...ARGUMENTOS_DA_EMBALAGEM_LEGADA,
    ]);
  }

  const { validoDe, validoAte } = await lerValidade(caminhoDoCertificado);

  return {
    material: await readFile(caminhoDoCofre),
    ...(opcoes.comEmbalagemLegada === true
      ? { materialEmEmbalagemLegada: await readFile(caminhoDoCofreLegado) }
      : {}),
    senha,
    titular: formaTextual(titular),
    validoDe,
    validoAte,
    impressaoDigital: await lerImpressaoDigital(caminhoDoCertificado),
    certificadoEmPem: await readFile(caminhoDoCertificado, 'utf8'),
    autoridade,
  };
}

/**
 * Emite, pela mesma autoridade, o **par que o servidor de teste apresenta** — chave e certificado.
 *
 * ===========================================================================
 * POR QUE ELE EXISTE (T10), e por que sai da MESMA autoridade
 * ===========================================================================
 *
 * A T9 precisava apenas do cofre do cliente: o par do aperto de mão era o próprio processo. A T10
 * exerce a outra ponta — um **par TLS mútuo de verdade**, que apresenta certificado e exige o do
 * cliente —, e para isso é preciso um par chave/certificado em PEM que o `tls.createServer` aceite.
 *
 * Ele é emitido pela **mesma** autoridade que emite o material do cliente porque é isso que torna a
 * confiança e a recusa observáveis pela **decisão do par**: o servidor lista `acConfiavel` em `ca[]`
 * e o material alheio vem de `acAlheia`. Fabricá-lo por outro caminho faria a recusa poder nascer de
 * bytes divergentes, que é o CT-808 — outra propriedade, e a confusão entre as duas faria o caso
 * aprovar um adaptador que trata tudo como *"material ruim"*.
 *
 * ===========================================================================
 * O NOME ALTERNATIVO É ESCRITO, e a ausência dele seria uma armadilha de versão
 * ===========================================================================
 *
 * O certificado carrega `subjectAltName` com `localhost` e `127.0.0.1`. Sem ele, a conferência de
 * identidade do runtime ainda recorre ao `CN` — hoje —, e o caso passaria a depender de um fallback
 * que os navegadores já removeram e que o Node pode remover. Escrever a extensão custa uma linha e
 * tira o exercício da dependência disso.
 */
export async function gerarParDeServidorDeTeste(
  autoridade: AutoridadeDeTeste,
  nomeComum: string,
): Promise<ParDeServidorDeTeste> {
  const pasta = await mkdtemp(join(autoridade.raiz, 'servidor-'));
  const caminhoDaChave = join(pasta, 'servidor.key');
  const caminhoDoPedido = join(pasta, 'servidor.csr');
  const caminhoDoCertificado = join(pasta, 'servidor.crt');
  const caminhoDasExtensoes = join(pasta, 'extensoes.cnf');

  await writeFile(caminhoDasExtensoes, EXTENSOES_DO_SERVIDOR, 'utf8');

  await ferramenta([
    'req',
    '-newkey',
    PORTE_DA_CHAVE,
    '-noenc',
    '-keyout',
    caminhoDaChave,
    '-out',
    caminhoDoPedido,
    '-subj',
    formaDeLinhaDeComando({ pais: 'BR', organizacao: `Par ${autoridade.nome}`, nomeComum }),
  ]);

  await ferramenta([
    'x509',
    '-req',
    '-in',
    caminhoDoPedido,
    '-CA',
    autoridade.caminhoDoCertificado,
    '-CAkey',
    autoridade.caminhoDaChave,
    '-CAcreateserial',
    '-sha256',
    '-days',
    String(DIAS_DE_VALIDADE_PADRAO),
    '-extfile',
    caminhoDasExtensoes,
    '-out',
    caminhoDoCertificado,
  ]);

  return {
    chaveEmPem: await readFile(caminhoDaChave, 'utf8'),
    certificadoEmPem: await readFile(caminhoDoCertificado, 'utf8'),
    autoridade,
  };
}

/** O sujeito na forma que o `openssl` recebe: `/C=BR/O=…/CN=…`. */
function formaDeLinhaDeComando(sujeito: SujeitoDeTeste): string {
  return `/C=${sujeito.pais}/O=${sujeito.organizacao}/CN=${sujeito.nomeComum}`;
}

/**
 * O sujeito na forma que o **produto** publica.
 *
 * Ela é composta aqui a partir dos componentes que este acessório passou ao `openssl`, e **não** lida
 * do SUT: é o lado esquerdo da igualdade do CT-806, e derivá-lo do SUT poria o artefato sob prova nas
 * duas pontas.
 */
function formaTextual(sujeito: SujeitoDeTeste): string {
  return [`C=${sujeito.pais}`, `O=${sujeito.organizacao}`, `CN=${sujeito.nomeComum}`].join(
    SEPARADOR_DO_SUJEITO,
  );
}

/** Lê a validade do certificado emitido, em ISO-8601, pelo caminho independente do SUT. */
async function lerValidade(caminho: string): Promise<{ validoDe: Date; validoAte: Date }> {
  const saida = await ferramenta([
    'x509',
    '-in',
    caminho,
    '-noout',
    '-dates',
    '-dateopt',
    'iso_8601',
  ]);

  return {
    validoDe: instanteDe(saida, 'notBefore'),
    validoAte: instanteDe(saida, 'notAfter'),
  };
}

/** Lê a impressão digital SHA-256 do certificado emitido, na forma hexadecimal com separadores. */
async function lerImpressaoDigital(caminho: string): Promise<string> {
  const saida = await ferramenta(['x509', '-in', caminho, '-noout', '-fingerprint', '-sha256']);
  const achado = /^sha256 Fingerprint=(.+)$/m.exec(saida);

  if (achado?.[1] === undefined) {
    throw new Error(
      `o acessório não achou a impressão digital na saída de ${FERRAMENTA}: ${saida}`,
    );
  }

  return achado[1].trim();
}

/**
 * Converte `notBefore=2026-08-15 12:09:56Z` no instante correspondente.
 *
 * O formato pedido ao `openssl` é o ISO-8601, e não o formato clássico (`Aug 15 12:09:56 2026 GMT`)
 * que o SUT interpreta. A escolha é deliberada: se os dois lados dependessem do mesmo parse, um
 * defeito comum passaria despercebido pela igualdade do CT-806.
 */
function instanteDe(saida: string, rotulo: string): Date {
  const achado = new RegExp(`^${rotulo}=(.+)$`, 'm').exec(saida);
  const bruto = achado?.[1]?.trim();

  if (bruto === undefined) {
    throw new Error(`o acessório não achou '${rotulo}' na saída de ${FERRAMENTA}: ${saida}`);
  }

  const instante = new Date(bruto.replace(' ', 'T'));
  if (Number.isNaN(instante.getTime())) {
    throw new Error(`o acessório não interpretou '${rotulo}=${bruto}' como instante`);
  }

  return instante;
}

/**
 * Executa a ferramenta e devolve a saída padrão — **sem `shell`**, e com teto de tempo.
 *
 * Sem `shell` porque nenhum argumento passa por interpretação de linha de comando: o sujeito carrega
 * espaços, e um caminho de shell aqui seria a porta de entrada de um defeito de citação que só
 * apareceria em algum nome de organização futuro.
 */
async function ferramenta(argumentos: readonly string[]): Promise<string> {
  try {
    const { stdout } = await executar(FERRAMENTA, [...argumentos], {
      timeout: TETO_DA_FERRAMENTA_MS,
      encoding: 'utf8',
    });
    return stdout;
  } catch (falha) {
    const causa = falha instanceof Error ? falha.message : String(falha);
    const subcomando = argumentos[0] ?? '(sem subcomando)';

    if (causa.includes('ENOENT')) {
      throw new Error(
        `o binário '${FERRAMENTA}' não está disponível neste host, e o acessório de material o ` +
          'exige para fabricar o PKCS#12 em execução. Nenhum caso desta suíte pode passar sem ele.',
      );
    }

    throw new Error(`'${FERRAMENTA} ${subcomando}' falhou no acessório de material: ${causa}`);
  }
}

/**
 * A identidade da empresa perante o provedor, para os casos que precisam de um ato COMPLETO.
 *
 * Ela mora aqui, e não em cada suíte, pela convenção do projeto: **acessório de suíte se importa,
 * não se copia**. Cinco arquivos passaram a precisar dela ao mesmo tempo — cinco cópias nasceriam
 * livres para divergir, e a primeira divergência apareceria como caso que passa por acaso.
 *
 * Os valores são plausíveis e **fixos**: o que os casos afirmam é que eles chegam ao provedor, e um
 * valor sorteado tornaria a asserção uma comparação consigo mesma.
 */
export const IDENTIDADE_DE_TESTE = Object.freeze({
  identificadorDaAplicacao: 'identificador-de-teste-0001',
  numeroDoCliente: 33065,
  numeroDaContaCorrente: 380261,
  codigoDaModalidade: 1,
});
