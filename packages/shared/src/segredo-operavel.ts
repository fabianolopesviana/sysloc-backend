/**
 * O **segredo operável** de terceiro — a primeira barreira da ADR-0032.
 *
 * Este é o **único lugar do produto em que o material do certificado e a senha que o abre existem
 * como valor em claro**. Tudo o mais — a coluna do banco, o registro estruturado, a resposta da
 * API, o documento publicado — vê apenas o envelope cifrado ou a sentinela de redação.
 *
 * ===========================================================================
 * A CONTENÇÃO AQUI É ESTRUTURAL — a redação do registrador é a SEGUNDA barreira
 * ===========================================================================
 *
 * A ADR-0032 nasceu de um achado **medido**: um segredo em claro alcançou o diário do sistema por
 * um caminho que a redação não cobria, e que revisão de código nenhuma teria visto. A lição que ela
 * fixa é que redigir na saída é rede de segurança, **nunca** a garantia. A garantia é não haver o
 * que redigir: o material e a senha não são propriedade enumerável de objeto algum que viaje para
 * registro, erro, resposta ou documento — são **campos privados de classe**, e portanto invisíveis
 * a `Object.keys`, a espalhamento, a `JSON.stringify` e a `util.inspect`.
 *
 * Por isso as três formas de serialização que um registrador, um `throw` ou um `console` usariam
 * devolvem {@link SENTINELA_REDIGIDO}, e **a sentinela é importada de `./log.ts`, não redeclarada**:
 * duas declarações do mesmo literal é a forma exata do débito que a fase anterior deixou aberto
 * sobre o fuso da operação — dois fatos executáveis dizendo a mesma coisa, livres para divergir,
 * com nada que acuse quando divergirem.
 *
 * ===========================================================================
 * UM ENVELOPE, e não duas colunas
 * ===========================================================================
 *
 * Material e senha são cifrados **juntos**, numa operação só, produzindo uma cadeia só. A razão é a
 * substituição: renovar um certificado é **anular um ponto**, e com duas metades cifradas em
 * separado *"o segredo do anterior deixou de existir"* passa a ter duas partes livres para
 * divergir. O ganho colateral, registrado no tech spec §8: acrescentar campo ao segredo (o
 * `client_id` e o `scope` da fatia seguinte) é mudança do **que se cifra**, não da tabela, da
 * migração, da política de linha nem do contrato.
 *
 * É justamente por o layout estar agendado para mudar que o quadro em claro **se identifica**: ele
 * abre com um byte de versão, conferido antes de qualquer fatiamento. Ver
 * {@link VERSAO_DO_QUADRO} — o marcador ali diz o que a fatia seguinte pode e o que não pode fazer.
 *
 * ===========================================================================
 * ELE MORA EM `@sysloc/shared`, e não no pacote bancário
 * ===========================================================================
 *
 * A ADR-0032 fixa uma regra de **classe** — *"segredo de terceiro que o produto precisa usar, e não
 * apenas conferir"* —, não uma regra do provedor bancário. Pôr a cifra dentro do pacote bancário
 * faria a próxima credencial de terceiro nascer com uma segunda cópia da mesma decisão.
 *
 * ⚠️ **Cifra reversível NÃO contradiz o resumo de senha, e quem chegar depois não deve "corrigir"
 * isto em nome da coerência.** A ADR-0032 diz nos Neutros que a decisão alcança apenas o segredo
 * **operável**: senha de acesso e portador de confirmação seguem resumidos e irrecuperáveis
 * (`packages/db/src/portador-de-confirmacao.ts`). O discriminador é a natureza do uso — o material
 * precisa voltar em claro, dentro do processo, a cada aperto de mão mútuo.
 *
 * ===========================================================================
 * A CHAVE CHEGA POR PARÂMETRO — este módulo não lê o ambiente
 * ===========================================================================
 *
 * Quem lê `CHAVE_DE_CIFRA_DO_CERTIFICADO` é a conferência de partida da aplicação, uma vez, e
 * repassa o valor. Um segundo leitor de `process.env` teria duas fontes para a mesma configuração,
 * e a segunda escaparia da conferência de partida — é a mesma razão já registrada no cabeçalho de
 * `criarAdaptadorSmtp` (`packages/regua/src/adaptador-smtp.ts`), que serve de molde.
 *
 * ===========================================================================
 * REGRA DE ESCRITA QUE VALE PARA TODA MENSAGEM DAQUI
 * ===========================================================================
 *
 * **Nenhuma mensagem de erro deste módulo interpola valor vindo do corpo.** A medição M4 da spec
 * achou que segredo interpolado em texto de mensagem sobrevive em `mensagem` e `pilha` do evento, e
 * que a redação do registrador **não o alcança** ali. As mensagens daqui nomeiam **desfecho** e, no
 * máximo, uma constante deste módulo — jamais conteúdo.
 */

import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { SENTINELA_REDIGIDO } from './log.js';

/**
 * O algoritmo, e a razão de ele ser **autenticado**.
 *
 * AES-256-GCM produz, além do texto cifrado, uma etiqueta que a decifração confere. É o que compra
 * a propriedade que a §11.3 da spec exige: adulteração do texto cifrado é **detectada**, e não
 * produz material silenciosamente corrompido sendo apresentado ao provedor. Um modo sem
 * autenticação (CBC, CTR) decifraria lixo e o entregaria como se fosse o certificado.
 */
const ALGORITMO = 'aes-256-gcm';

/** Comprimento exigido da chave — 256 bits, como o algoritmo acima nomeia. */
const BYTES_DA_CHAVE = 32;

/**
 * Comprimento do vetor de inicialização — **96 bits**, e o número é conteúdo.
 *
 * É o comprimento canônico do GCM (NIST SP 800-38D §8.2): com 12 bytes o vetor entra direto no
 * contador, sem a passagem adicional pela função de hash que qualquer outro comprimento obriga. O
 * vetor é **sorteado por operação** — reusá-lo com a mesma chave quebra o GCM por completo, e é
 * justamente por isso que ele nunca é derivado de nada nem guardado em constante.
 */
const BYTES_DO_VETOR = 12;

/** Comprimento da etiqueta de autenticação que o GCM produz — o padrão, e o máximo, de 128 bits. */
const BYTES_DA_ETIQUETA = 16;

/**
 * O layout do quadro em claro que **esta** versão do módulo escreve e é a única que lê.
 *
 * DECISÃO FECHADA — T2 / Gate 2 rodada 2 · 2026-08-14
 * O QUÊ: o quadro em claro abre com um byte de versão, e {@link decompor} o confere **antes de
 *        qualquer fatiamento**.
 * POR QUÊ: sem ele a detecção de formato era **probabilística**, não estrutural. A guarda de
 *          coerência confere aritmética (`fimDaSenha > quadro.length`), que infinitos layouts
 *          satisfazem por acaso: um quadro de formato futuro cujo campo seguinte, lido como
 *          `uint32BE`, calhasse de dar valor pequeno passava nela e era fatiado no layout errado,
 *          devolvendo senha e material **parciais** como se fossem o certificado. No material
 *          concreto a colisão é improvável (DER começa em `30 82 …`, que dá ~813 milhões e cai na
 *          guarda), mas isso é **sorte da forma do material**, não propriedade do formato. O tech
 *          spec §8 já agenda o layout novo para a fatia (ii) — `client_id` e `scope` entram no
 *          **que se cifra** —, sobre envelopes gravados por esta.
 * REVERTER EXIGE: provar que nenhum envelope escrito por qualquer versão deste formato sobrevive em
 *                 coluna durável — o que, depois do primeiro certificado real cifrado, significa
 *                 recifrar todo o material guardado.
 * NÃO ALCANÇA: **acrescentar** um valor novo a este discriminador é o uso previsto dele, e não
 *              reversão — é o que a fatia (ii) fará ao mudar o layout. O que não se faz é remover o
 *              campo, deixar de conferi-lo, ou conferi-lo depois de fatiar.
 *
 * ⚠️ **O que ele versiona é o layout do quadro em claro, e só isso.** Ele mora **dentro** do texto
 * cifrado de propósito: ali a etiqueta do GCM o autentica junto com o resto, e não há caminho em que
 * alguém que alcance a coluna troque o discriminador sem que a autenticação falhe primeiro — o que
 * um byte em claro na frente do envelope não compraria. O preço, e ele é explícito: a versão só é
 * legível **depois** de decifrar, de modo que trocar o algoritmo, o porte do vetor ou o da etiqueta
 * é mudança que este discriminador **não** sinaliza. Quem for fazê-la não deve ler "tem versão" como
 * "está coberto": ela exige recifra ou um discriminador externo, e é decisão de outra ordem.
 */
const VERSAO_DO_QUADRO = 1;

/** Quantos bytes carregam a versão — um só; 255 layouts é folga de sobra para este formato. */
const BYTES_DA_VERSAO = 1;

/**
 * Quantos bytes anunciam o comprimento da senha dentro do quadro em claro.
 *
 * O quadro é `[uint8 versão][uint32BE comprimento da senha][senha em utf8][material]`, e o prefixo
 * existe porque as duas partes viajam **coladas** num envelope só: sem ele, não haveria como separar
 * onde a senha termina e o material começa. Um separador textual não serviria — o material é binário
 * e pode conter qualquer byte, inclusive o que se escolhesse como separador.
 */
const BYTES_DO_PREFIXO_DA_SENHA = 4;

/** Onde o corpo da senha começa: logo depois dos dois campos de comprimento fixo do quadro. */
const INICIO_DA_SENHA = BYTES_DA_VERSAO + BYTES_DO_PREFIXO_DA_SENHA;

/**
 * Menor envelope estruturalmente possível: vetor, etiqueta e um quadro de senha e material vazios.
 *
 * O número não é ornamento — é ele que torna as leituras de posição fixa de {@link decompor}
 * seguras. O GCM não muda o comprimento, logo o texto cifrado tem o porte do quadro; recusar aqui
 * tudo que seja menor garante que o quadro tem ao menos os dois campos fixos, e é o que impede o
 * `RangeError` cru do runtime de escapar de `decompor` sem nome de domínio.
 */
const MENOR_ENVELOPE = BYTES_DO_VETOR + BYTES_DA_ETIQUETA + INICIO_DA_SENHA;

/**
 * O que se diz quando o envelope não abre — **um texto só para as duas causas**.
 *
 * Chave errada e texto cifrado adulterado produzem a mesma falha de autenticação do GCM, e
 * distingui-las na mensagem não ajudaria a operação nem seria honesto: o algoritmo não as
 * distingue. Nenhum valor entra aqui — nem o envelope, nem a chave, nem o claro.
 */
const MOTIVO_DE_ENVELOPE_QUE_NAO_ABRE = 'o envelope do segredo operável não abriu com esta chave';

/** O que se diz quando a chave apresentada não tem o comprimento que o algoritmo exige. */
const MOTIVO_DE_CHAVE_INVALIDA = `a chave de cifra não tem ${BYTES_DA_CHAVE} bytes`;

/**
 * O que se diz quando o quadro autenticou mas foi escrito por outro layout.
 *
 * A versão **lida** não entra no texto, e a ausência é a regra deste módulo aplicada sem exceção: o
 * byte veio do corpo decifrado, e mensagem que interpola valor do corpo sobrevive em `mensagem` e
 * `pilha`, onde a redação do registrador não o alcança (medição M4 da spec). Quem interpola é a
 * constante daqui — a versão que este módulo **escreve** —, que é o que a operação precisa saber
 * para decidir qual processo está velho.
 */
const MOTIVO_DE_VERSAO_DESCONHECIDA = `o envelope do segredo operável não está na versão ${VERSAO_DO_QUADRO} do formato`;

/**
 * O envelope não abriu: a chave não é a que cifrou, ou o texto cifrado foi adulterado.
 *
 * Ela é levantada **em lugar de** devolver qualquer coisa. Não há retorno parcial, não há `Buffer`
 * meio decifrado e não há segredo silenciosamente corrompido seguindo para o provedor — que é
 * exatamente o que a cifra autenticada existe para impedir.
 *
 * A exceção **não carrega causa**, e a ausência é deliberada: a mensagem do OpenSSL (`mac verify
 * failure`, `unable to authenticate data`) não discrimina nada que o nome desta classe já não diga,
 * e anexá-la acrescentaria uma superfície a mais sobre a qual provar que nenhum segredo viaja.
 */
export class ErroDeSegredoAdulterado extends Error {
  override readonly name: string = 'ErroDeSegredoAdulterado';

  constructor() {
    super(MOTIVO_DE_ENVELOPE_QUE_NAO_ABRE);
  }
}

/**
 * A chave apresentada não tem o comprimento que o algoritmo exige.
 *
 * É falha de **configuração**, não de entrada de cliente: a chave vem do arquivo de ambiente, pela
 * conferência de partida. A guarda existe aqui mesmo assim porque a alternativa é o `RangeError`
 * cru do runtime — sem nome do domínio, e portanto sem como quem chama distinguir *"a operação não
 * está configurada"* de *"este envelope foi adulterado"*, que são desfechos operacionais opostos.
 */
export class ErroDeChaveDeCifraInvalida extends Error {
  override readonly name: string = 'ErroDeChaveDeCifraInvalida';

  constructor() {
    super(MOTIVO_DE_CHAVE_INVALIDA);
  }
}

/**
 * O envelope abriu, autenticou, e o quadro dentro dele **não é do layout que este módulo conhece**.
 *
 * ---------------------------------------------------------------------------
 * POR QUE ELA NÃO É {@link ErroDeSegredoAdulterado} — os desfechos são opostos
 * ---------------------------------------------------------------------------
 *
 * Nada aqui está corrompido: a chave é a certa, os bytes estão íntegros, e a etiqueta do GCM já
 * aprovou o quadro inteiro. O que está velho é **o processo que lê**. Chamar isto de adulteração
 * mandaria a operação fazer exatamente a coisa errada — trocar a chave, pedir ao Admin que reenvie o
 * certificado —, destruindo material bom para consertar um problema que é de versão de código. O
 * desfecho certo é o inverso: o dado fica onde está, e quem se move é o processo (um rollback foi
 * longe demais, ou o binário é anterior ao formato que gravou).
 *
 * É o mesmo argumento que separou {@link ErroDeChaveDeCifraInvalida} de
 * {@link ErroDeSegredoAdulterado}: quem chama precisa distinguir *"não está configurado"*, *"foi
 * adulterado"* e *"este processo é antigo demais para ler isto"*, e um nome só para os três apaga a
 * distinção justamente na hora em que ela decide a ação.
 *
 * Pela mesma razão de {@link ErroDeSegredoAdulterado}, ela **não carrega causa nem a versão lida**:
 * o byte veio do corpo decifrado, e o corpo não entra em superfície de exceção.
 */
export class ErroDeVersaoDeEnvelopeDesconhecida extends Error {
  override readonly name: string = 'ErroDeVersaoDeEnvelopeDesconhecida';

  constructor() {
    super(MOTIVO_DE_VERSAO_DESCONHECIDA);
  }
}

/** O par em claro — a forma de entrada de {@link criarSegredoOperavel} e a saída de `abrir()`. */
export interface SegredoEmClaro {
  /** Os bytes do material PKCS#12, já decodificados. */
  readonly material: Buffer;
  /** A senha que abre o material. */
  readonly senha: string;
}

/**
 * O invólucro opaco — carrega o par em claro e **não o entrega por acidente**.
 *
 * ---------------------------------------------------------------------------
 * A OPACIDADE É ESTRUTURAL, e não uma lista de métodos que alguém lembrou de sobrescrever
 * ---------------------------------------------------------------------------
 *
 * Os dois valores são **campos privados de classe** (`#`). Não existe reflexão que os alcance:
 * `Object.keys` devolve vazio, o espalhamento (`{ ...inv }`) devolve `{}`, e nem o serializador do
 * registrador nem o do JSON os encontram para copiar. As três sobrescritas abaixo cobrem a metade
 * restante — o que aconteceria com a **representação** do objeto — e devolvem a sentinela em vez de
 * qualquer coisa derivada do conteúdo.
 *
 * ---------------------------------------------------------------------------
 * A CLASSE É EXPORTADA COMO TIPO, e o construtor não é alcançável de fora
 * ---------------------------------------------------------------------------
 *
 * Quem consome anota o tipo; quem constrói passa por {@link criarSegredoOperavel} ou por
 * {@link decifrarSegredo}. Publicar o construtor abriria uma segunda entrada para o claro, e a
 * borda tem **uma** — a primeira instrução depois da validação, onde as cadeias cruas deixam de ser
 * tocadas.
 */
class SegredoOperavel {
  readonly #material: Buffer;
  readonly #senha: string;

  constructor(segredo: SegredoEmClaro) {
    // Cópia, e não a referência de quem chamou: sem ela, o corpo da requisição e o interior do
    // invólucro seriam o mesmo buffer, e uma escrita posterior de fora mudaria o que já foi
    // aceito como segredo.
    this.#material = Buffer.from(segredo.material);
    this.#senha = segredo.senha;
  }

  /**
   * Devolve o par em claro — **o único caminho para o conteúdo**, e o nome diz o que acontece.
   *
   * Quem chama é código que **precisa** do claro: a leitura do material na borda e o aperto de mão
   * mútuo com o provedor.
   *
   * ---------------------------------------------------------------------------
   * O CONTRATO DE QUEM RECEBE — três obrigações, e a terceira não é óbvia
   * ---------------------------------------------------------------------------
   *
   * O buffer devolvido é o **interno**, não uma cópia. Logo, quem o recebe **não pode**:
   *
   * 1. **divulgá-lo** — nem registrar, nem embutir em mensagem de erro, nem devolver em resposta;
   * 2. **mutá-lo** — escrever nele é escrever no interior de um invólucro **já aceito** como
   *    segredo. `SegredoEmClaro.material` é `readonly Buffer`, e o modificador alcança a
   *    **referência**, jamais o conteúdo: `readonly` não impede `material[0] = 0`;
   * 3. **retê-lo** — guardar a referência além do aperto de mão mantém o claro vivo na heap depois
   *    de o uso ter terminado, que é exatamente o que a barreira estrutural existe para encurtar.
   *
   * ⚠️ **A assimetria com o construtor é deliberada, e não descuido.** O construtor **copia** porque
   * a ameaça ali é externa e não governável: o corpo da requisição continua existindo do lado de
   * fora, e sem a cópia uma escrita posterior mudaria o que já foi aceito. Aqui a ameaça é interna e
   * governada por este contrato, e o preço da simetria seria alto na direção errada — copiar na
   * saída multiplicaria cópias vivas do claro na heap **a cada aperto de mão**, aumentando
   * justamente a superfície que a primeira barreira da ADR-0032 existe para reduzir.
   */
  abrir(): SegredoEmClaro {
    return { material: this.#material, senha: this.#senha };
  }

  /** `String(inv)` e `${inv}` — a interpolação distraída num texto de log ou de erro. */
  toString(): string {
    return SENTINELA_REDIGIDO;
  }

  /** `JSON.stringify(inv)` e o invólucro aninhado dentro de outro objeto serializado. */
  toJSON(): string {
    return SENTINELA_REDIGIDO;
  }

  /** `util.inspect` — o caminho de `console.log`, do diagnóstico e do relatório de teste. */
  [Symbol.for('nodejs.util.inspect.custom')](): string {
    return SENTINELA_REDIGIDO;
  }
}

export type { SegredoOperavel };

/**
 * A **única entrada** do claro no produto.
 *
 * A borda a chama na primeira instrução depois da validação e não volta a tocar as cadeias cruas
 * que chegaram no corpo. Não há conferência de forma aqui, e a ausência é deliberada: quem confere
 * material e senha é o esquema publicado em `@sysloc/contracts` (ADR-0016), e uma segunda
 * conferência escrita à mão seria uma segunda declaração da mesma regra, livre para divergir.
 */
export function criarSegredoOperavel(segredo: SegredoEmClaro): SegredoOperavel {
  return new SegredoOperavel(segredo);
}

/**
 * Cifra o par num **envelope único**: `vetor || etiqueta || textoCifrado`, em base64.
 *
 * As três partes viajam numa cadeia só porque a coluna é uma só, e porque decifrar exige as três —
 * separá-las em campos criaria a possibilidade de guardar uma metade sem a outra. O vetor é
 * sorteado a cada chamada, de modo que cifrar o **mesmo** par duas vezes produz envelopes
 * diferentes: é o que impede que um observador da coluna conclua, por igualdade, que duas empresas
 * registraram o mesmo certificado.
 *
 * A ordem `vetor, etiqueta, texto` é fixa e conhecida porque as duas primeiras têm comprimento
 * constante — o texto cifrado é o resto, e por isso vai por último, sem precisar de anúncio de
 * comprimento.
 */
export function cifrarSegredo(segredo: SegredoOperavel, chave: Buffer): string {
  exigirChaveDeCifra(chave);

  const vetor = randomBytes(BYTES_DO_VETOR);
  const cifrador = createCipheriv(ALGORITMO, chave, vetor);
  const textoCifrado = Buffer.concat([cifrador.update(compor(segredo)), cifrador.final()]);

  return Buffer.concat([vetor, cifrador.getAuthTag(), textoCifrado]).toString('base64');
}

/**
 * Abre o envelope e devolve o invólucro — ou **levanta**, nunca devolve conteúdo duvidoso.
 *
 * A conferência da etiqueta acontece no `final()` do decifrador, e é ela que detecta a adulteração:
 * até esse ponto o GCM entrega bytes que **parecem** claro. Por isso nada do que `update()` produz
 * é usado antes de `final()` completar — usá-lo seria devolver material não autenticado, que é
 * exatamente o desfecho que a cifra autenticada existe para impedir.
 */
export function decifrarSegredo(envelope: string, chave: Buffer): SegredoOperavel {
  exigirChaveDeCifra(chave);

  const bytes = Buffer.from(envelope, 'base64');
  if (bytes.length < MENOR_ENVELOPE) {
    // Envelope truncado nem chega ao decifrador: sem vetor e etiqueta completos não há o que
    // autenticar, e o runtime levantaria um erro de comprimento, alheio a este domínio.
    throw new ErroDeSegredoAdulterado();
  }

  const decifrador = createDecipheriv(ALGORITMO, chave, bytes.subarray(0, BYTES_DO_VETOR));
  decifrador.setAuthTag(bytes.subarray(BYTES_DO_VETOR, BYTES_DO_VETOR + BYTES_DA_ETIQUETA));

  let quadro: Buffer;
  try {
    quadro = Buffer.concat([
      decifrador.update(bytes.subarray(BYTES_DO_VETOR + BYTES_DA_ETIQUETA)),
      decifrador.final(),
    ]);
  } catch {
    // A exceção do runtime é descartada de propósito — ver a ausência de causa em
    // {@link ErroDeSegredoAdulterado}.
    throw new ErroDeSegredoAdulterado();
  }

  return new SegredoOperavel(decompor(quadro));
}

/**
 * Serializa o par no quadro que vai para a cifra: `[versão][comprimento da senha][senha][material]`.
 *
 * O comprimento é o da senha **em bytes**, e não em caracteres: `utf8` gasta mais de um byte fora
 * do ASCII, e contar caracteres partiria o quadro no lugar errado para toda senha acentuada.
 *
 * A versão vai na **frente**, e a posição é conteúdo: quem lê precisa decidir se conhece o layout
 * **antes** de interpretar qualquer campo dele. Um discriminador no fim seria inútil — para
 * alcançá-lo, já seria preciso ter atravessado o quadro pelo layout que se está tentando descobrir.
 */
function compor(segredo: SegredoOperavel): Buffer {
  const { material, senha } = segredo.abrir();
  const senhaEmBytes = Buffer.from(senha, 'utf8');
  const cabecalho = Buffer.alloc(INICIO_DA_SENHA);
  cabecalho.writeUInt8(VERSAO_DO_QUADRO, 0);
  cabecalho.writeUInt32BE(senhaEmBytes.length, BYTES_DA_VERSAO);

  return Buffer.concat([cabecalho, senhaEmBytes, material]);
}

/**
 * Lê o quadro já autenticado de volta no par — **conferindo o layout antes de fatiar**.
 *
 * As duas guardas daqui não são redundantes com a etiqueta do GCM, e não são redundantes entre si:
 *
 * - A **etiqueta** prova que o quadro é o que foi cifrado com esta chave. Não diz nada sobre qual
 *   layout o compôs, porque quem o compôs também assinou.
 * - A **versão** prova que o layout é o desta versão do módulo. É uma resposta **estrutural**:
 *   qualquer outro layout é recusado pelo primeiro byte, independentemente do que venha depois.
 * - A **coerência do comprimento** pega o quadro que se diz do layout corrente e não fecha as
 *   contas. Ela sozinha nunca poderia cumprir o papel da anterior — coerência aritmética é
 *   propriedade que layouts diferentes satisfazem por acaso, e "por acaso" aqui significa fatiar no
 *   lugar errado e devolver senha e material parciais como se fossem o certificado.
 *
 * A ordem é vinculante: conferir a versão **depois** de fatiar leria campos de um layout que já se
 * sabe desconhecido, e o desfecho voltaria a depender de sorte.
 *
 * As leituras de posição fixa são seguras sem guarda própria porque {@link MENOR_ENVELOPE} já
 * recusou, na borda, todo envelope pequeno demais para carregar os dois campos de comprimento fixo.
 */
function decompor(quadro: Buffer): SegredoEmClaro {
  if (quadro.readUInt8(0) !== VERSAO_DO_QUADRO) {
    throw new ErroDeVersaoDeEnvelopeDesconhecida();
  }

  const comprimentoDaSenha = quadro.readUInt32BE(BYTES_DA_VERSAO);
  const fimDaSenha = INICIO_DA_SENHA + comprimentoDaSenha;
  if (fimDaSenha > quadro.length) {
    throw new ErroDeSegredoAdulterado();
  }

  return {
    senha: quadro.toString('utf8', INICIO_DA_SENHA, fimDaSenha),
    material: Buffer.from(quadro.subarray(fimDaSenha)),
  };
}

/**
 * Recusa a chave de comprimento errado **antes** de qualquer operação.
 *
 * Ela vale para as duas pontas de propósito: uma chave curta na cifra gravaria um envelope que
 * nenhuma decifração futura abriria, e o defeito só apareceria no dia da cobrança.
 */
function exigirChaveDeCifra(chave: Buffer): void {
  if (chave.length !== BYTES_DA_CHAVE) {
    throw new ErroDeChaveDeCifraInvalida();
  }
}

// ===========================================================================
// VALOR OPERÁVEL — o segredo de terceiro que é TEXTO, e não o par do certificado
// ===========================================================================
//
// Nasceu em 2026-08-20, ao fechar o `D36 · F4/T10`: o identificador da aplicação
// perante o provedor bancário é segredo de terceiro que o produto precisa USAR
// (ele compõe o pedido de credencial), e a ADR-0032 alcança exatamente esse
// caso — *"segredo de terceiro que o produto precisa usar, e não apenas
// conferir, é guardado cifrado de forma reversível"*.
//
// ---------------------------------------------------------------------------
// POR QUE NÃO ALARGAR O QUADRO DO PAR, que seria o caminho óbvio
// ---------------------------------------------------------------------------
//
// Porque os CICLOS DE VIDA são diferentes, e juntá-los faz um morrer com o
// outro. O par material+senha é o certificado, que vale um ano e é substituído
// inteiro a cada renovação; o identificador da aplicação não muda quando o
// certificado é trocado. No mesmo quadro, cada renovação obrigaria a reinformar
// o identificador — e esquecê-lo quebraria a obtenção de credencial em silêncio,
// meses depois, sem que nada acusasse.
//
// A `DECISÃO FECHADA` de 2026-08-14 permanece intocada: o quadro do par continua
// com UM formato, e o byte de versão dele continua conferido antes de qualquer
// fatiamento. O quadro daqui tem versão PRÓPRIA, pela mesma razão que aquele
// tem: detecção de formato é estrutural, nunca probabilística.
//
// O que se compartilha é o algoritmo, a chave e a forma do envelope
// (`vetor ‖ etiqueta ‖ cifrado`) — porque duas criptografias no mesmo produto é
// que seriam duas superfícies para endurecer, e uma delas ficaria para trás.

/**
 * Versão do quadro em claro do valor.
 *
 * ⚠️ **O espaço de versões é COMPARTILHADO com o quadro do par, de propósito, e por isso este
 * começa em `0x81`.** Os dois envelopes têm a mesma forma externa e são abertos com a mesma chave,
 * de modo que a única coisa que impede um de ser lido como o outro é este byte. Reusar o `1` do par
 * fazia o quadro do certificado atravessar a conferência e ser devolvido como TEXTO — medido pelo
 * `CT-524` na primeira escrita desta primitiva, em 2026-08-20.
 *
 * Convenção: `0x01..0x7F` são versões do PAR; `0x81..0xFF`, do VALOR. Quem acrescentar um terceiro
 * quadro escolhe faixa própria e acrescenta o caso que prova a disjunção.
 */
const VERSAO_DO_QUADRO_DE_VALOR = 0x81;

/** Menor envelope de valor que pode ser autêntico: vetor, etiqueta e o byte de versão. */
const MENOR_ENVELOPE_DE_VALOR = BYTES_DO_VETOR + BYTES_DA_ETIQUETA + 1;

/**
 * Cifra um valor textual operável e devolve o envelope em base64.
 *
 * O vetor é sorteado a cada chamada, de modo que cifrar o **mesmo** valor duas vezes produz
 * envelopes diferentes — é o que impede concluir, por igualdade da coluna, que duas empresas
 * registraram o mesmo identificador.
 */
export function cifrarValorOperavel(valor: string, chave: Buffer): string {
  exigirChaveDeCifra(chave);

  const quadro = Buffer.concat([
    Buffer.from([VERSAO_DO_QUADRO_DE_VALOR]),
    Buffer.from(valor, 'utf8'),
  ]);
  const vetor = randomBytes(BYTES_DO_VETOR);
  const cifrador = createCipheriv(ALGORITMO, chave, vetor);
  const textoCifrado = Buffer.concat([cifrador.update(quadro), cifrador.final()]);

  return Buffer.concat([vetor, cifrador.getAuthTag(), textoCifrado]).toString('base64');
}

/**
 * Abre o envelope de um valor operável — ou **levanta**, nunca devolve conteúdo duvidoso.
 *
 * Como no par, nada do que `update()` produz é usado antes de `final()` completar: até ali o GCM
 * entrega bytes que **parecem** claro, e usá-los seria devolver valor não autenticado.
 */
export function decifrarValorOperavel(envelope: string, chave: Buffer): string {
  exigirChaveDeCifra(chave);

  const bytes = Buffer.from(envelope, 'base64');
  if (bytes.length < MENOR_ENVELOPE_DE_VALOR) {
    throw new ErroDeSegredoAdulterado();
  }

  const decifrador = createDecipheriv(ALGORITMO, chave, bytes.subarray(0, BYTES_DO_VETOR));
  decifrador.setAuthTag(bytes.subarray(BYTES_DO_VETOR, BYTES_DO_VETOR + BYTES_DA_ETIQUETA));

  let quadro: Buffer;
  try {
    quadro = Buffer.concat([
      decifrador.update(bytes.subarray(BYTES_DO_VETOR + BYTES_DA_ETIQUETA)),
      decifrador.final(),
    ]);
  } catch {
    throw new ErroDeSegredoAdulterado();
  }

  if (quadro.length < 1 || quadro[0] !== VERSAO_DO_QUADRO_DE_VALOR) {
    throw new ErroDeVersaoDeEnvelopeDesconhecida();
  }

  return quadro.subarray(1).toString('utf8');
}
