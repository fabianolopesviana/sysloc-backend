/**
 * A conversão do material PKCS#12 que o runtime não abre — **por processo externo de vida curta**.
 *
 * ===========================================================================
 * POR QUE ESTE MÓDULO EXISTE, e o achado é MEDIDO
 * ===========================================================================
 *
 * A Autoridade Certificadora entrega o material embalado em `RC2-40-CBC` — duas emissões
 * consecutivas medidas, de modo que é o **padrão dela**, não exceção. O OpenSSL 3 moveu essa cifra
 * para o provider `legacy` e a recusa por padrão; o Node 24 falha ao abrir o material com
 * `Unsupported PKCS12 PFX data`. Sem conversão, a rota que registra o certificado recusa exatamente
 * o arquivo que o Admin recebeu, e toda renovação vira chamado para quem opera a máquina.
 *
 * A ADR-0036 decide **onde** a tolerância à cifra fraca vive: num subprocesso descartável, e nunca no
 * processo do produto — que é o mesmo que decifra todo segredo operável (ADR-0032). Este módulo é a
 * materialização dela, e é o **irmão** de `leitura-do-material.ts`: a conversão é a etapa que precede
 * a abertura, sobre o mesmo insumo e sob a mesma disciplina de segredo.
 *
 * ⚠️ **Ele NÃO invoca `deploy/scripts/cobranca-bancaria/preparar-material-do-certificado.sh`.** O
 * roteiro é o precedente **provado** da conversão e a origem das guardas de execução abaixo; o que se
 * herda dele é a disciplina, não o arquivo. Chamá-lo poria um interpretador de comandos e um caminho
 * do repositório no meio do caminho do segredo.
 *
 * ===========================================================================
 * A CONVERSÃO É CONDICIONAL — material moderno não paga nada
 * ===========================================================================
 *
 * A primeira pergunta é *"o runtime abre isto como está?"*, e ela é respondida pelo **mesmo**
 * `lerMaterial` que a borda usa — perguntar ao `openssl` mediria outro programa. Abriu: devolve-se o
 * recebido **byte a byte**, declarando que não houve conversão, e **nenhum processo externo chega a
 * ser criado**. Não abriu: converte-se em duas invocações do binário.
 *
 * A idempotência, portanto, não depende de nome de arquivo nem de estado anterior: o material
 * conferido é o que **acabou de chegar**. É onde o roteiro de servidor errou em 2026-08-21 —
 * perguntava *"o runtime o abre?"* sobre um preparado de emissão anterior, e respondia "nada a
 * fazer" enquanto o operador registrava o certificado velho. Dentro do produto a armadilha some por
 * construção.
 *
 * ===========================================================================
 * A GUARDA DE EXECUÇÃO — toda ela é exigível, e cada linha fecha um caminho
 * ===========================================================================
 *
 * | Guarda | Por quê |
 * |---|---|
 * | **caminho absoluto** do binário | `PATH` é do ambiente e pode ser reescrito |
 * | **ambiente vazio no subprocesso** | o resto do ambiente é reescrevível pelo mesmo motivo que o `PATH`, e o conversor lê `OPENSSL_CONF`/`OPENSSL_MODULES` enquanto o carregador lê `LD_PRELOAD`/`LD_LIBRARY_PATH` — medido: a herança derruba a conversão quando o ambiente do pai é hostil (CT-1050) |
 * | **sem interpretador de comandos** | nenhuma cadeia de comando é montada; nada a citar, nada a escapar |
 * | **senha por descritor de arquivo** | `argv` é legível por qualquer processo da máquina; ambiente também |
 * | **teto de tempo** | sem ele, a requisição do Admin fica pendurada por um processo que não termina |
 * | **saída do processo FORA do diário** | ela é lida para classificar e **descartada** — não vira causa, não vira propriedade, não entra em texto nenhum |
 * | **um único artefato em claro**, em memória compartilhada, com permissão restrita | e removido em **todo** desfecho |
 *
 * ⚠️ **A garantia do artefato é *"não escreve em armazenamento persistente"*, e não impossibilidade
 * física.** O intermediário carrega chave privada em claro em `tmpfs`, que **pode ser paginado para
 * área de troca** sob pressão de memória. A ADR-0036 já declara o trade-off nesses termos, e nada
 * aqui — docblock, mensagem ou teste — deve prometer mais do que isso.
 *
 * ===========================================================================
 * POR QUE O INTERMEDIÁRIO É ARQUIVO, e não um cano entre os dois processos
 * ===========================================================================
 *
 * Porque **foi medido que o cano não funciona**: `openssl pkcs12 -export` exige entrada *seekable*, e
 * falha lendo de entrada padrão, de cano simples ou de descritor (`Could not read any certificates
 * from -in file`). A assimetria é só da **entrada da exportação** — a decodificação aceita entrada
 * padrão e a exportação aceita saída não-seekable (medições M5, M6 e o controle M7). Por isso os três
 * artefatos se reduzem a **um**: o recebido entra por fluxo, o convertido sai por fluxo, e só o
 * intermediário toca o sistema de arquivos.
 *
 * ===========================================================================
 * A IDENTIDADE É CONFERIDA, e nunca presumida pela ausência de erro
 * ===========================================================================
 *
 * A ADR-0036 exige identidade conferida por **titular, número de série e validade**. O lado
 * "recebido" da comparação só existe num lugar — o intermediário —, porque o recebido é justamente o
 * que o runtime não abre; o lado "convertido" vem de `lerMaterial`, pelo caminho real da borda.
 *
 * ⚠️ **O número de série é afirmado pela impressão digital, e isso é MAIS forte, nunca menos.**
 * `MaterialLido` publica quatro campos e `serialNumber` **não** é um deles — por decisão registrada,
 * que o CT-806 afirma por igualdade de chaves. A impressão digital SHA-256 é o resumo do certificado
 * **inteiro** em DER, do qual o número de série é um campo: igualdade de impressão digital implica
 * igualdade de série, de titular, de validade e da chave pública. Alargar `MaterialLido` para expor a
 * série seria mudar superfície publicada para provar o que já está provado.
 *
 * ===========================================================================
 * A CAUSA SE DISCRIMINA POR SINAL DE CONTEÚDO — e o sinal daqui é OUTRO
 * ===========================================================================
 *
 * Ver {@link RADICAL_DE_SENHA_DO_CONVERSOR}. O caminho ingênuo — classificar tentando ler o original
 * — **não funciona**: material em cifra legada com senha errada falha pela **cifra**, antes de a
 * etiqueta de autenticação ser conferida, e o runtime nunca chega a dizer que a senha não abre. A
 * senha só se manifesta **dentro** da conversão, que é quem a apresenta.
 *
 * ===========================================================================
 * NADA DA SAÍDA DO CONVERSOR ATRAVESSA ESTA FRONTEIRA
 * ===========================================================================
 *
 * Valem aqui as duas regras de escrita de `leitura-do-material.ts`, e as duas são **exigíveis por
 * medição** (CT-1015, CT-1019), nunca por leitura:
 *
 * - **Nenhuma mensagem interpola valor vindo do corpo.** As mensagens daqui nomeiam o **desfecho**, e
 *   jamais conteúdo — nem o material, nem a senha, nem o que o conversor respondeu.
 * - **A saída do processo é lida para classificar e descartada.** Não vira `cause`, não vira
 *   propriedade, não entra em texto nenhum e não alcança o diário. Repassá-la criaria uma superfície
 *   nova sobre a qual provar que nenhum segredo viaja — o oposto do que a ADR-0032 decidiu.
 */

import { spawn } from 'node:child_process';
import { randomUUID, X509Certificate } from 'node:crypto';
import type { FileHandle } from 'node:fs/promises';
import { open, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { type Readable, Writable } from 'node:stream';
import type { SegredoOperavel } from '@sysloc/shared';
import { criarSegredoOperavel } from '@sysloc/shared';
import type { MaterialLido } from './leitura-do-material.js';
import { ErroDeSenhaQueNaoAbre, lerMaterial } from './leitura-do-material.js';

/**
 * O binário que converte, por **caminho absoluto**.
 *
 * Resolver pelo `PATH` deixaria a escolha do executável ao ambiente do processo, que é reescrevível;
 * o caminho é o mesmo medido neste host (`/usr/bin/openssl`, OpenSSL 3.0.13, provider `legacy`
 * carregando). A presença dele é **pré-condição de operação** — consequência que a ADR-0036 registra
 * em `Cons` — e é afirmada pelo provisionamento, não por este módulo.
 */
const CONVERSOR = '/usr/bin/openssl';

/**
 * Onde o intermediário em claro nasce — memória compartilhada, e nunca disco.
 *
 * `tmpfs` é memória: o artefato não toca armazenamento persistente por escrita deste módulo. Ver, no
 * cabeçalho, a fronteira exata dessa garantia.
 */
const DIRETORIO_EM_MEMORIA = '/dev/shm';

/**
 * O prefixo do nome do intermediário — o mesmo do roteiro provado, para que resíduo eventual seja
 * reconhecível por quem opera a máquina.
 *
 * O restante do nome é sorteado: dois registros simultâneos — dois Admins de duas empresas —
 * disputariam um nome fixo, e o segundo falharia numa recusa que o Admin leria como *"o meu
 * certificado é inválido"*.
 */
const PREFIXO_DO_INTERMEDIARIO = 'material-do-certificado-';

/** A extensão do intermediário — ele é PEM, e o nome o diz. */
const SUFIXO_DO_INTERMEDIARIO = '.pem';

/**
 * A permissão com que o intermediário nasce: **só o dono**, e a criação já a fixa.
 *
 * Ela vai no ato de criação, e não num `chmod` posterior, porque o `chmod` deixa uma janela em que o
 * arquivo existe com a permissão da máscara herdada. A máscara do processo só sabe **remover** bits,
 * nunca acrescentar — de modo que o artefato jamais nasce mais permissivo que isto, qualquer que
 * seja o `umask` do host. O CT-1017 mede exatamente isso, com a máscara aberta em `0o000`.
 */
const MODO_DO_INTERMEDIARIO = 0o600;

/**
 * O descritor por onde a senha entra no processo externo — **nunca `argv`, nunca o ambiente**.
 *
 * `argv` de qualquer processo é legível por qualquer outro processo da máquina (`/proc/<pid>/cmdline`),
 * e o ambiente é herdado por tudo o que o filho criar. O descritor é um cano anônimo entre pai e
 * filho, e o número dele — que é o que viaja em `argv` — não é segredo.
 */
const DESCRITOR_DA_SENHA = 3;

/** Como o `openssl` nomeia a origem da senha: o descritor, e nada mais. */
const ORIGEM_DA_SENHA = `fd:${DESCRITOR_DA_SENHA}`;

/**
 * Teto de cada invocação do conversor.
 *
 * Sem ele, uma requisição do Admin fica pendurada por um processo que não termina — e o intermediário
 * em claro vive junto. O valor é folgado porque a decodificação de um cofre com chave RSA sob disputa
 * de CPU é o caso lento previsto; ele não é folga de desempenho, é o limite para além do qual o ato
 * deixa de ter dono.
 *
 * ⚠️ **O estouro sai como {@link ErroDeFormatoDoMaterial}, e a escolha é deliberada** — mesma decisão
 * já registrada para o teto de `leitura-do-material.ts`: do ponto de vista do produto o desfecho é o
 * mesmo (não foi possível preparar o material), e um terceiro tipo de erro alargaria a superfície
 * publicada por um caminho que só um defeito do host alcança.
 */
const TETO_DA_CONVERSAO_MS = 30_000;

/** Como o processo que estourou o teto é encerrado — sem cooperação, porque ele já não a dá. */
const SINAL_DE_ENCERRAMENTO = 'SIGKILL';

/**
 * O radical que o **executável** de criptografia diz quando a senha não abre o cofre — **medido**.
 *
 * ⚠️ **Ele NÃO é `SINAL_DE_SENHA_QUE_NAO_ABRE` de `leitura-do-material.ts`, e importar aquele para cá
 * seria defeito.** São **dois produtores com redações diferentes**, medido em 2026-08-21: a
 * **biblioteca** — que é quem o outro módulo escuta, de dentro do processo — diz `mac verify
 * failure`; o **executável**, que é quem este módulo invoca, diz `Mac verify error: invalid
 * password?`. Reusar a constante de lá faria o ramo da senha **nunca disparar** aqui, e todo desfecho
 * de senha errada degradaria em silêncio para "formato".
 *
 * O radical `mac verify` é o maior denominador comum das duas redações, e o casamento é por
 * **conteúdo normalizado** da saída, nunca por igualdade: a redação do OpenSSL ganha e perde prefixo
 * de contexto entre versões.
 *
 * **Degradação declarada**: sinal que deixe de casar cai no desfecho mais genérico
 * ({@link ErroDeFormatoDoMaterial}). Perde-se precisão de diagnóstico, **nunca contenção** — a
 * resposta ao Admin é a mesma nos dois casos. É a mesma regra já aceita no módulo irmão.
 */
export const RADICAL_DE_SENHA_DO_CONVERSOR = 'mac verify';

/** O motivo interno do material cujo formato o produto não consegue preparar. */
export const MOTIVO_DO_FORMATO_NAO_SUPORTADO = 'FORMATO_NAO_SUPORTADO';

/** Nomeia o desfecho, e nada mais: nem a senha, nem o material, nem o que o conversor respondeu. */
const MENSAGEM_DO_FORMATO_NAO_SUPORTADO = 'o formato do material do certificado não é suportado';

/**
 * O primeiro bloco de certificado do intermediário — que é o **mesmo** que a exportação toma como
 * folha.
 *
 * `openssl pkcs12 -export -in <pem>` trata o primeiro certificado do arquivo como o do titular e os
 * demais como cadeia; ler o primeiro aqui é, portanto, ler exatamente o objeto que a exportação vai
 * embalar. Casar o último, ou casar todos, compararia coisa diferente da que o convertido apresenta.
 */
const BLOCO_DO_CERTIFICADO = /-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/;

/** Como o runtime separa os atributos do sujeito num `X509Certificate` — uma linha por atributo. */
const SEPARADOR_DO_SUJEITO_NO_CERTIFICADO = '\n';

/** Como o produto os apresenta, e como `MaterialLido.titular` os traz: `C=BR, O=…, CN=…`. */
const SEPARADOR_DO_SUJEITO = ', ';

/**
 * O material pronto para abrir, mais o **discriminador de qual caminho correu**.
 *
 * O booleano é **fechado nos dois sentidos** e é fato do produto, não detalhe de implementação: é ele
 * que a borda de registro publica no desfecho, para que o Admin saiba que o arquivo que ele anexou
 * precisou ser preparado. `material` é o que se cifra e se guarda — o **convertido**, quando houve
 * conversão (ADR-0036), e o recebido byte a byte quando não houve.
 */
export interface MaterialPreparado {
  /** Os bytes que o runtime abre — convertidos ou os do recebido, conforme o caminho que correu. */
  readonly material: Buffer;
  /** `true` apenas quando o processo externo correu e produziu material novo. */
  readonly convertido: boolean;
}

/**
 * O material não se deixa preparar: não é um PKCS#12 que o conversor entenda, ou o preparo não pôde
 * completar.
 *
 * Como as duas classes de `leitura-do-material.ts`, ela **não carrega causa** e a mensagem não cita
 * conteúdo. Nada da saída do conversor — nem do objeto de erro do runtime — atravessa esta fronteira,
 * e o CT-1019 mede a ausência sobre a saída **real** em vez de presumi-la.
 *
 * ⚠️ Distinta de {@link ErroDeSenhaQueNaoAbre} **por decisão**: as duas causas viram a mesma resposta
 * ao Admin, e o que se perderia fundindo-as é a única informação que o operador tem para dizer se o
 * Admin digitou a senha errada ou anexou o arquivo errado. A distinção nasce aqui e morre na borda.
 */
export class ErroDeFormatoDoMaterial extends Error {
  override readonly name: string = 'ErroDeFormatoDoMaterial';

  /** O motivo interno, para o registro estruturado da borda — nunca para o corpo da resposta. */
  readonly motivo: typeof MOTIVO_DO_FORMATO_NAO_SUPORTADO = MOTIVO_DO_FORMATO_NAO_SUPORTADO;

  constructor() {
    super(MENSAGEM_DO_FORMATO_NAO_SUPORTADO);
  }
}

/**
 * Prepara o material para o runtime — convertendo-o **apenas se** ele não abrir como está.
 *
 * @param segredo O invólucro opaco (ADR-0032). O claro existe **apenas** dentro desta chamada.
 * @throws {ErroDeSenhaQueNaoAbre} quando a senha apresentada não abre o material.
 * @throws {ErroDeFormatoDoMaterial} quando o material não se deixa preparar.
 */
export async function converterMaterialSeNecessario(
  segredo: SegredoOperavel,
): Promise<MaterialPreparado> {
  const { material, senha } = segredo.abrir();

  if (await oRuntimeAbre(segredo)) {
    return { material, convertido: false };
  }

  return { material: await converter(material, senha), convertido: true };
}

/**
 * Responde *"o runtime abre este material como está?"* — e **propaga** a recusa por senha.
 *
 * A senha que não abre é desfecho terminal, não motivo para converter: com cifra moderna e senha
 * errada, o runtime já diz exatamente o que houve, e insistir no processo externo gastaria um
 * subprocesso para chegar à mesma conclusão. É também a única forma de o produto distinguir as duas
 * causas quando o material **não** é legado.
 */
async function oRuntimeAbre(segredo: SegredoOperavel): Promise<boolean> {
  try {
    await lerMaterial(segredo);
    return true;
  } catch (falha) {
    if (falha instanceof ErroDeSenhaQueNaoAbre) {
      throw falha;
    }
    return false;
  }
}

/**
 * Converte, em duas invocações do binário, e **remove o intermediário em todo desfecho**.
 *
 * O `finally` cobre os três caminhos — sucesso, falha da decodificação e falha da exportação —, e é
 * ele que o CT-1016 exerce nos três. Um intermediário sobrevivente deixaria chave privada em claro
 * em memória compartilhada por tempo indefinido, legível por quem tivesse o dono do processo.
 */
async function converter(material: Buffer, senha: string): Promise<Buffer> {
  const caminho = join(
    DIRETORIO_EM_MEMORIA,
    `${PREFIXO_DO_INTERMEDIARIO}${randomUUID()}${SUFIXO_DO_INTERMEDIARIO}`,
  );
  const intermediario = await abrirIntermediario(caminho);

  try {
    await decodificarOMaterial(material, senha, intermediario.fd);
    const origem = await certificadoDeOrigem(caminho);
    const convertido = await reexportarOMaterial(caminho, senha);

    await exigirIdentidadePreservada(origem, convertido, senha);

    return convertido;
  } finally {
    await intermediario.close().catch(() => undefined);
    await rm(caminho, { force: true });
  }
}

/**
 * Cria o intermediário **já restrito**, e recusa reaproveitar arquivo existente (`wx`).
 *
 * Escrever sobre um arquivo que já estava lá entregaria o claro a quem o tivesse criado antes — o
 * nome é sorteado justamente para que isso não aconteça, e a bandeira exclusiva é o que transforma a
 * improbabilidade em recusa.
 */
async function abrirIntermediario(caminho: string): Promise<FileHandle> {
  try {
    return await open(caminho, 'wx', MODO_DO_INTERMEDIARIO);
  } catch {
    // Memória compartilhada ausente, cheia ou não gravável: o ato não tem onde acontecer, e o
    // desfecho para o produto é o mesmo — o material não pôde ser preparado.
    throw new ErroDeFormatoDoMaterial();
  }
}

/**
 * Primeira invocação: abre o cofre legado e escreve o PEM em claro **direto no intermediário**.
 *
 * O recebido entra por **entrada padrão** (medição M5) e o resultado sai pelo descritor do arquivo —
 * de modo que o claro nunca passa pelo espaço deste processo nesta etapa. `-legacy` é o que carrega o
 * provider da cifra fraca, e ele existe **só neste subprocesso**: é a decisão inteira da ADR-0036.
 */
function decodificarOMaterial(
  material: Buffer,
  senha: string,
  destinoDoClaro: number,
): Promise<Buffer> {
  return executarOConversor(
    ['pkcs12', '-legacy', '-nodes', '-passin', ORIGEM_DA_SENHA],
    senha,
    material,
    destinoDoClaro,
  );
}

/**
 * Segunda invocação: reembala o intermediário em cifra que o runtime aceita.
 *
 * A entrada é o **arquivo** — e não um cano —, porque a exportação exige entrada *seekable*
 * (medição M7, o controle que reproduziu o achado do roteiro). A saída vai por **saída padrão**
 * (medição M6), de modo que o convertido não toca o sistema de arquivos.
 *
 * A senha é a **mesma** do recebido: um segundo segredo obrigaria o produto a guardar dois, e a
 * renovação passaria a ter duas metades livres para divergir.
 */
function reexportarOMaterial(caminhoDoClaro: string, senha: string): Promise<Buffer> {
  return executarOConversor(
    ['pkcs12', '-export', '-in', caminhoDoClaro, '-passout', ORIGEM_DA_SENHA],
    senha,
    undefined,
    undefined,
  );
}

/**
 * Invoca o conversor sob todas as guardas, e traduz a falha **sem repassar nada dela**.
 *
 * DÉBITO COM GATILHO — D1 · F5/T1 · registrado 2026-08-21
 * O QUÊ: o estouro de {@link TETO_DA_CONVERSAO_MS} não tem caso que o exerça — a prova existente
 *        cobre a **consequência** dele (o intermediário removido no caminho de erro, CT-1016), e não
 *        o disparo do teto em si.
 * QUANDO FECHA: quando o módulo ganhar, por outra razão já legítima, um ponto de injeção do binário
 *        ou do limite — ou quando o repositório adotar arranjo que substitua executável do host sem
 *        tocar o `PATH` global do arcabouço de teste.
 * POR QUE NÃO AGORA: o único arranjo disponível hoje exigiria um símbolo *test-only* na produção
 *        (parâmetro de binário ou de teto), o que a Iron Law #6 proíbe, ou manipular o `PATH` do
 *        processo do arcabouço, que é estado global compartilhado por todos os arquivos da suíte.
 * ÍNDICE: docs/specs/features/integracao-bancaria-autonoma/v1/_run/run-report.md §2, D1
 *
 * A saída padrão do processo é devolvida a quem chamou **apenas quando o desfecho é bom**; a saída de
 * erro é lida, examinada em minúsculas para classificar, e some — não vira `cause`, não vira
 * propriedade e não entra em texto nenhum.
 */
function executarOConversor(
  argumentos: readonly string[],
  senha: string,
  entrada: Buffer | undefined,
  destinoDaSaida: number | undefined,
): Promise<Buffer> {
  return new Promise((resolver, rejeitar) => {
    const processo = spawn(CONVERSOR, [...argumentos], {
      // Nenhuma cadeia de comando é montada: os argumentos chegam ao executável como vetor, e não há
      // citação, expansão nem substituição possível no meio do caminho.
      shell: false,
      // DECISÃO FECHADA — D3 · F5/Tech Review · intervenção dirigida de 2026-08-22
      // O QUÊ: o subprocesso nasce com ambiente VAZIO, e não com o ambiente herdado deste processo.
      // POR QUÊ: o cabeçalho já nomeia o ambiente como superfície legível e blinda o `PATH` por
      //          caminho absoluto — mas o resto do ambiente seguia herdado, sobre o MESMO executável,
      //          que é quem manipula a chave privada em claro. `env` é a única porta pela qual
      //          variável de ambiente alcança o filho, de modo que declará-lo aqui fecha a classe
      //          inteira — `OPENSSL_CONF`, `OPENSSL_MODULES`, `LD_PRELOAD`, `LD_LIBRARY_PATH` e
      //          qualquer outra, presente ou futura — sem enumerar nenhuma. Enumerar seria a forma
      //          que apodrece: variável nova nasce herdada por omissão.
      // MEDIDO ANTES DE APLICAR (o débito exigia): o ciclo completo das duas invocações, `-legacy`
      //          incluso, corre com ambiente vazio neste host (OpenSSL 3.0.13) — decodificar 3039 B,
      //          reexportar 2515 B. E o inverso também foi medido: com `OPENSSL_MODULES` plantado no
      //          ambiente do pai, a herança de hoje DERRUBA a conversão (`unable to load provider
      //          legacy`), enquanto o ambiente explícito a preserva. É o que o CT-1050 afirma.
      // REVERTER EXIGE: provar que alguma variável do ambiente é necessária ao conversor neste host
      //          — e então ela entra NOMEADA aqui, com a razão, nunca por herança silenciosa.
      env: {},
      stdio: [
        entrada === undefined ? 'ignore' : 'pipe',
        destinoDaSaida === undefined ? 'pipe' : destinoDaSaida,
        'pipe',
        // O descritor da senha. `pipe` aqui é um cano anônimo entre este processo e o filho — o valor
        // não aparece em `argv` nem no ambiente, e morre com o processo.
        'pipe',
      ],
    });

    const pedacosDaSaida: Buffer[] = [];
    const pedacosDoErro: Buffer[] = [];
    let expirou = false;
    let jaDecidiu = false;

    const expiracao = setTimeout(() => {
      expirou = true;
      processo.kill(SINAL_DE_ENCERRAMENTO);
    }, TETO_DA_CONVERSAO_MS);

    const decidir = (desfecho: () => void): void => {
      if (jaDecidiu) {
        return;
      }
      jaDecidiu = true;
      clearTimeout(expiracao);
      desfecho();
    };

    processo.stdout?.on('data', (pedaco: Buffer) => pedacosDaSaida.push(pedaco));
    processo.stderr?.on('data', (pedaco: Buffer) => pedacosDoErro.push(pedaco));

    // Falha de criação do processo — binário ausente, sem permissão de execução. O objeto do runtime
    // é descartado aqui, como toda outra falha deste módulo.
    processo.on('error', () => decidir(() => rejeitar(new ErroDeFormatoDoMaterial())));

    processo.on('close', (codigo) => {
      decidir(() => {
        if (expirou || codigo !== 0) {
          rejeitar(classificarFalhaDoConversor(Buffer.concat(pedacosDoErro)));
          return;
        }
        resolver(Buffer.concat(pedacosDaSaida));
      });
    });

    alimentarPorCano(processo.stdio[DESCRITOR_DA_SENHA], Buffer.from(senha, 'utf8'));
    if (entrada !== undefined) {
      alimentarPorCano(processo.stdin, entrada);
    }
  });
}

/**
 * Escreve num cano do filho e o fecha, **ignorando a falha de escrita**.
 *
 * O filho pode morrer antes de ler (material que ele recusa de imediato), e o cano quebrado chega
 * como evento de erro que derrubaria o processo inteiro se ninguém o escutasse. O desfecho do ato
 * já está sendo decidido pelo código de saída — a falha da escrita não acrescenta informação, e
 * repassá-la traria a superfície do runtime para dentro do domínio.
 */
function alimentarPorCano(cano: Writable | Readable | null | undefined, conteudo: Buffer): void {
  if (cano === null || cano === undefined || !(cano instanceof Writable)) {
    // O descritor não virou cano gravável — o `stdio` que este módulo declara sempre o produz, e a
    // guarda existe porque o tipo do runtime admite as outras formas.
    return;
  }

  cano.on('error', () => undefined);
  cano.end(conteudo);
}

/**
 * Traduz a falha do conversor no erro do domínio — **por sinal de conteúdo**, e sem repassar nada.
 *
 * A saída de erro é examinada em minúsculas e some em seguida. Ver
 * {@link RADICAL_DE_SENHA_DO_CONVERSOR} para por que o radical é este, e por que a constante do
 * módulo irmão **não** serve aqui.
 */
function classificarFalhaDoConversor(saidaDeErro: Buffer): Error {
  return saidaDeErro.toString('utf8').toLowerCase().includes(RADICAL_DE_SENHA_DO_CONVERSOR)
    ? new ErroDeSenhaQueNaoAbre()
    : new ErroDeFormatoDoMaterial();
}

/**
 * Lê, do intermediário, o certificado do titular — o lado "recebido" da conferência de identidade.
 *
 * O arquivo carrega também a chave privada em claro, e ela **não é retida**: o que sobrevive a esta
 * função é o bloco do certificado, que é dado público. A leitura acontece aqui, e não por uma
 * terceira invocação do binário, porque o intermediário é o **insumo da exportação** — comparar
 * contra ele fecha o laço exatamente onde a preservação pode se perder.
 */
async function certificadoDeOrigem(caminho: string): Promise<X509Certificate> {
  const bloco = BLOCO_DO_CERTIFICADO.exec(await readFile(caminho, 'utf8'))?.[0];

  if (bloco === undefined) {
    // Cofre sem certificado algum: não há identidade a preservar, e o que sairia da exportação não
    // seria o material do Admin.
    throw new ErroDeFormatoDoMaterial();
  }

  try {
    return new X509Certificate(bloco);
  } catch {
    throw new ErroDeFormatoDoMaterial();
  }
}

/**
 * Exige que o convertido seja **o mesmo certificado** do recebido — divergência é recusa, não aviso.
 *
 * Os três fatos que a ADR-0036 nomeia são conferidos: **titular**, **validade** nas duas pontas e —
 * pela impressão digital, que os subsume — o **número de série**. Ver o cabeçalho para por que a
 * impressão digital é a afirmação mais forte, e não um substituto mais fraco.
 *
 * O convertido é aberto pelo **mesmo** `lerMaterial` que a borda usa: se ele não abrir aqui, não
 * abriria lá, e devolvê-lo seria empurrar o defeito para o registro. Qualquer falha desta etapa é
 * **formato** — a senha já se provou boa na decodificação, de modo que uma recusa aqui nunca é dela.
 */
async function exigirIdentidadePreservada(
  origem: X509Certificate,
  convertido: Buffer,
  senha: string,
): Promise<void> {
  const lido = await lerOConvertido(convertido, senha);

  const preservada =
    lido.impressaoDigital === origem.fingerprint256 &&
    lido.titular === formaTextualDoSujeito(origem) &&
    lido.validoDe.getTime() === origem.validFromDate.getTime() &&
    lido.validoAte.getTime() === origem.validToDate.getTime();

  if (!preservada) {
    throw new ErroDeFormatoDoMaterial();
  }
}

/** Abre o convertido pelo caminho real da borda, traduzindo toda recusa em formato. */
async function lerOConvertido(convertido: Buffer, senha: string): Promise<MaterialLido> {
  try {
    return await lerMaterial(criarSegredoOperavel({ material: convertido, senha }));
  } catch {
    throw new ErroDeFormatoDoMaterial();
  }
}

/**
 * Compõe o sujeito na forma que o produto publica, a partir da que o runtime declara no certificado.
 *
 * `X509Certificate.subject` separa os atributos por quebra de linha; `MaterialLido.titular` os separa
 * por vírgula e espaço. A tradução é aqui, e num ponto só, porque é o que torna os dois lados da
 * conferência comparáveis sem alterar nenhum deles.
 */
function formaTextualDoSujeito(certificado: X509Certificate): string {
  return certificado.subject.split(SEPARADOR_DO_SUJEITO_NO_CERTIFICADO).join(SEPARADOR_DO_SUJEITO);
}
