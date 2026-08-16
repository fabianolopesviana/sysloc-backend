/**
 * A leitura do material PKCS#12 — **por aperto de mão em laço local**, e não por leitor de formato.
 *
 * ===========================================================================
 * O CAMINHO ÓBVIO NÃO FUNCIONA, e a alternativa foi MEDIDA — não argumentada
 * ===========================================================================
 *
 * A forma que um leitor deste arquivo esperaria é `new X509Certificate(material)`. Ela **falha** com
 * `ERR_OSSL_PEM_NO_START_LINE` sobre um PKCS#12: aquela classe lê certificado em PEM ou DER, e o
 * material do Admin é um **cofre** com chave privada, cadeia e MAC, cifrado por senha (tech spec
 * §21.1, medição **M1**). O que o runtime oferece para abrir esse cofre é o mesmo caminho que ele
 * usa para servir TLS — `pfx` mais `passphrase` —, de modo que a leitura acontece assim:
 *
 * 1. sobe-se um ponto de escuta TLS com o material, em **porta dinâmica** do laço local;
 * 2. conecta-se a ele;
 * 3. lê-se do par por `getPeerCertificate()` — que é onde `subject`, `valid_from`, `valid_to` e
 *    `fingerprint256` existem como valor.
 *
 * ⚠️ **A linha da stack do `CLAUDE.md` que atribui a `X509Certificate` a *"leitura de `.pfx`"* está
 * IMPRECISA**, e corrigi-la não pertence a esta fatia. O registro fica aqui para que ninguém
 * implemente contra a linha errada — e para que a forma escolhida não seja lida como rebuscada.
 *
 * ⚠️ **Nenhuma biblioteca de terceiro interpreta o material** (decisão D2-c, recusada por escrito).
 * Quem interpreta os bytes que o Admin entregou é `tls.createServer`, **do runtime**. Alargar a
 * superfície de confiança exatamente sobre o segredo que a fatia existe para conter seria o oposto do
 * que ela faz, e o custo de manutenção de um analisador de ASN.1 próprio seria pior ainda.
 *
 * ===========================================================================
 * O SEGREDO ENTRA OPACO, É ABERTO AQUI DENTRO, e NADA DELE SAI
 * ===========================================================================
 *
 * O parâmetro é o invólucro da ADR-0032, e o claro só existe dentro desta chamada — o buffer não é
 * copiado, não é mutado e não é retido além do aperto de mão, que é o contrato escrito no `abrir()`
 * de `packages/shared/src/segredo-operavel.ts`.
 *
 * Daí decorrem duas regras de escrita deste módulo, e as duas são **exigíveis por medição**
 * (CT-807, CT-808), nunca por leitura:
 *
 * - **Nenhuma mensagem interpola valor vindo do corpo.** As mensagens daqui nomeiam o **desfecho**, e
 *   jamais conteúdo. A medição **M4** achou que segredo interpolado em texto de mensagem sobrevive em
 *   `mensagem` e `pilha` do evento, onde a redação do registrador **não o alcança**.
 * - **A falha do runtime é descartada, e não viaja como causa.** É a mesma decisão já tomada em
 *   `ErroDeSegredoAdulterado` (T2): a mensagem do OpenSSL (`mac verify failure`, `wrong tag`, `not
 *   enough data`) não discrimina nada que o nome da classe já não diga, e anexá-la acrescentaria uma
 *   superfície a mais sobre a qual provar que nenhum segredo viaja. A M4 mediu que ela **não** carrega
 *   a senha nem os bytes — o que torna o descarte barato, não desnecessário.
 *
 * ===========================================================================
 * A CONEXÃO NÃO VERIFICA CADEIA, e a ausência é a decisão certa aqui
 * ===========================================================================
 *
 * `rejectUnauthorized: false` acende alerta em qualquer revisão de segurança, e por isso a razão está
 * escrita no ponto: **o par é o próprio processo**, numa porta que ele mesmo acabou de abrir em
 * `127.0.0.1`. Não há terceiro para autenticar, e não há canal a proteger — o que se lê no fim é o
 * certificado **público** que o material carrega, que é exatamente o que o produto vai publicar.
 * Exigir cadeia confiável aqui recusaria todo certificado emitido por autoridade privada, que é o
 * caso do provedor bancário, e transformaria a leitura numa verificação de confiança que ninguém
 * pediu. A chave privada **não** atravessa o aperto de mão: ela fica no ponto de escuta, e some com
 * ele.
 *
 * ===========================================================================
 * DOIS ERROS DISTINTOS, e a indistinguibilidade NÃO mora aqui
 * ===========================================================================
 *
 * Senha que não abre e material ilegível são desfechos **distintos**, com motivos internos distintos,
 * porque é no registro interno que o diagnóstico mora. O que o Admin vê é uma **única** mensagem para
 * as duas causas — e essa tradução é da borda (T11), que monta a recusa a partir do **tipo** do erro.
 *
 * ⚠️ **Quem repassar `mensagem` daqui para o corpo da resposta reabre a distinção que a §3.4 da task
 * fecha.** A distinção nasce aqui e morre aqui.
 */

import type { Socket } from 'node:net';
import type { PeerCertificate, Server, TLSSocket } from 'node:tls';
import { connect, createServer } from 'node:tls';
import type { SegredoOperavel } from '@sysloc/shared';

/**
 * O endereço do ponto de escuta — **laço local**, e nunca `0.0.0.0`.
 *
 * Amarrar em todas as interfaces publicaria na rede, por milissegundos, um ponto TLS que apresenta o
 * certificado da empresa. Não há segredo ali (a chave privada não atravessa o aperto de mão), mas
 * também não há razão alguma para o ato sair da máquina.
 */
const ENDERECO_DO_LACO = '127.0.0.1';

/**
 * A porta é **sorteada pelo núcleo** (`listen(0)`), e o número é conteúdo.
 *
 * Porta fixa faria dois registros simultâneos — dois Admins de duas empresas — disputarem o mesmo
 * ponto, e o segundo falharia com `EADDRINUSE` numa recusa que o Admin leria como *"o meu certificado
 * é inválido"*.
 */
const PORTA_DINAMICA = 0;

/**
 * Teto do ato inteiro: escutar, conectar e ler do par.
 *
 * Tudo aqui é laço local e a leitura custa milissegundos, de modo que o teto **não** é uma folga de
 * desempenho — é a garantia de que uma requisição do Admin nunca fica pendurada por um ponto de
 * escuta que não completa. Sem ele, a promessa poderia nunca resolver, segurando a requisição HTTP e
 * o ponto de escuta vivos por tempo indefinido.
 *
 * ⚠️ **O estouro do teto sai como {@link ErroDeMaterialIlegivel}, e a escolha é deliberada.** Do ponto
 * de vista do produto o desfecho é o mesmo — não foi possível ler o material —, e a alternativa
 * (um terceiro tipo de erro) alargaria a superfície publicada por um caminho que só um defeito do
 * runtime alcança. A resposta ao Admin é a mesma nos dois casos (T11).
 */
const TETO_DO_APERTO_DE_MAO_MS = 5_000;

/**
 * O que o OpenSSL diz quando a senha não abre o cofre — **medido**, não suposto.
 *
 * Com material bom e senha errada, `tls.createServer` levanta `mac verify failure`: a etiqueta de
 * autenticação do PKCS#12 não confere. Bytes que não são um PKCS#12 produzem outra coisa (`wrong
 * tag`, `not enough data`), e é essa diferença — a única que o runtime oferece — que separa os dois
 * desfechos.
 *
 * O casamento é por **conteúdo** da mensagem normalizada, e não por igualdade: a redação do OpenSSL
 * pode ganhar prefixo de contexto entre versões. Se um dia ela mudar por completo, o desfecho degrada
 * para {@link ErroDeMaterialIlegivel} — que é a direção segura, porque a resposta ao Admin é a mesma
 * e o que se perde é precisão de diagnóstico, nunca contenção. O **CT-807** mede a classificação
 * contra o runtime de verdade, e reprova se ela deixar de valer.
 */
const SINAL_DE_SENHA_QUE_NAO_ABRE = 'mac verify failure';

/** O motivo interno da senha que não abre — o que o registro do serviço e a suíte examinam. */
const MOTIVO_DA_SENHA_QUE_NAO_ABRE = 'SENHA_NAO_ABRE';

/** O motivo interno do material que não se deixa ler. */
const MOTIVO_DO_MATERIAL_ILEGIVEL = 'MATERIAL_ILEGIVEL';

/** Nomeia o desfecho, e nada mais: nem a senha, nem o material, nem o que o OpenSSL respondeu. */
const MENSAGEM_DA_SENHA_QUE_NAO_ABRE = 'a senha apresentada não abre o material do certificado';

/** Idem — o texto descreve o que aconteceu, jamais o que chegou no corpo. */
const MENSAGEM_DO_MATERIAL_ILEGIVEL = 'o material do certificado não pôde ser lido';

/**
 * O que separa dois atributos na forma textual do sujeito.
 *
 * Constante nomeada porque a forma é **contrato de apresentação**: é ela que a tela do Admin exibe
 * como titular, e é contra ela que o CT-806 confere por igualdade.
 */
const SEPARADOR_DO_SUJEITO = ', ';

/**
 * O que se leu do material — **quatro campos, e a ausência dos outros é a decisão**.
 *
 * `getPeerCertificate()` devolve dezenove chaves, entre elas `issuer`, `serialNumber`, `modulus` e o
 * DER cru. Publicam-se **quatro**: titular, validade nas duas pontas e a impressão digital tal como o
 * runtime a formata. O PRD lista o que sai (RN-02), e acrescentar campo aqui é alargar superfície sem
 * caso de uso — o CT-806 afirma o conjunto por **igualdade de chaves**, que é o que impede o campo a
 * mais de entrar sem que ninguém veja.
 *
 * Os nomes são os do produto, não os do runtime nem os do provedor (ADR-0001): `titular` no lugar de
 * `subject`, `validoDe`/`validoAte` no lugar de `valid_from`/`valid_to`, `impressaoDigital` no lugar
 * de `fingerprint256`. São exatamente os quatro primeiros campos de `DadosDoCertificado`
 * (`packages/db/src/certificado-do-provedor.ts`), de modo que a borda os repassa sem traduzir nada.
 */
export interface MaterialLido {
  /** A forma textual do sujeito — `C=BR, O=…, CN=…`, na ordem em que o certificado os declara. */
  readonly titular: string;
  /** Começo da vigência. **Instante**, e não cadeia: quem o compara é o banco, em `timestamptz`. */
  readonly validoDe: Date;
  /** Fim da vigência — o que a RN-03 confere contra a data corrente da operação. */
  readonly validoAte: Date;
  /** A impressão digital SHA-256 **tal como o runtime a formata**: hexadecimal com separadores. */
  readonly impressaoDigital: string;
}

/**
 * A senha apresentada não abre o material.
 *
 * Ela **não carrega causa**, e a ausência é a mesma decisão de `ErroDeSegredoAdulterado`: a exceção
 * do runtime é descartada no ponto em que é traduzida, e nada dela — mensagem, pilha ou propriedade —
 * atravessa esta fronteira.
 *
 * ⚠️ Distinta de {@link ErroDeMaterialIlegivel} **por decisão**: as duas causas viram a mesma resposta
 * ao Admin, e o que se perderia fundindo-as é a única informação que o operador tem para dizer se o
 * Admin digitou a senha errada ou anexou o arquivo errado.
 */
export class ErroDeSenhaQueNaoAbre extends Error {
  override readonly name: string = 'ErroDeSenhaQueNaoAbre';

  /** O motivo interno, para o registro estruturado da borda — nunca para o corpo da resposta. */
  readonly motivo: typeof MOTIVO_DA_SENHA_QUE_NAO_ABRE = MOTIVO_DA_SENHA_QUE_NAO_ABRE;

  constructor() {
    super(MENSAGEM_DA_SENHA_QUE_NAO_ABRE);
  }
}

/**
 * O material não se deixa ler como PKCS#12 — ou o ato não completou dentro do teto declarado.
 *
 * Como a irmã acima, ela **não carrega causa** e a mensagem não cita conteúdo. Nenhum byte do que
 * chegou no corpo entra nesta exceção, e o CT-808 mede a ausência em vez de presumi-la.
 */
export class ErroDeMaterialIlegivel extends Error {
  override readonly name: string = 'ErroDeMaterialIlegivel';

  /** O motivo interno — **diferente** do da irmã, e é essa diferença que o par CT-807/CT-808 afirma. */
  readonly motivo: typeof MOTIVO_DO_MATERIAL_ILEGIVEL = MOTIVO_DO_MATERIAL_ILEGIVEL;

  constructor() {
    super(MENSAGEM_DO_MATERIAL_ILEGIVEL);
  }
}

/**
 * Lê do material o que o produto publica — titular, validade nas duas pontas e impressão digital.
 *
 * O ponto de escuta e a ligação são **encerrados ao fim do ato**, aconteça o que acontecer: o
 * `finally` cobre o caminho feliz, a falha de leitura e o estouro do teto. Um ponto de escuta
 * sobrevivente seguraria porta e material decifrado na memória do processo por tempo indefinido, que
 * é justamente o que a decisão D6-b existe para não deixar acontecer.
 *
 * @param segredo O invólucro opaco (ADR-0032). O claro existe **apenas** dentro desta chamada.
 * @throws {ErroDeSenhaQueNaoAbre} quando a senha não abre o material.
 * @throws {ErroDeMaterialIlegivel} quando os bytes não são um PKCS#12 legível.
 */
export async function lerMaterial(segredo: SegredoOperavel): Promise<MaterialLido> {
  const { material, senha } = segredo.abrir();
  // A falha mais comum — senha errada e bytes ruins — acontece AQUI, antes de qualquer porta ser
  // aberta: o runtime monta o contexto seguro na construção do servidor. Por isso a tradução das
  // duas causas vem antes do `try`: não há recurso a liberar quando ela dispara.
  const pontoDeEscuta = abrirPontoDeEscuta(material, senha);
  const conexoes = rastrearConexoes(pontoDeEscuta);
  let ligacao: TLSSocket | undefined;

  try {
    return await sobTetoDeTempo(async () => {
      const porta = await escutarEmPortaDinamica(pontoDeEscuta);
      ligacao = conectarAoLaco(porta);
      return projetarMaterial(await lerDoPar(ligacao));
    });
  } finally {
    ligacao?.destroy();
    await encerrarPontoDeEscuta(pontoDeEscuta, conexoes);
  }
}

/**
 * Guarda as conexões aceitas, para que o encerramento possa desfazê-las.
 *
 * ⚠️ **`closeAllConnections()` não serve aqui**, e a tentação é real: ele existe em `http.Server`, e
 * **não** em `net.Server` — de onde `tls.Server` descende. Sem este rastreamento, `close()` fica
 * esperando a última conexão terminar, e o encerramento passa a depender de o outro lado cooperar.
 *
 * O soquete sai do conjunto quando se fecha sozinho, para que o caminho feliz não acumule referência
 * a nada.
 */
function rastrearConexoes(pontoDeEscuta: Server): ReadonlySet<Socket> {
  const conexoes = new Set<Socket>();

  pontoDeEscuta.on('connection', (soquete: Socket) => {
    conexoes.add(soquete);
    soquete.once('close', () => conexoes.delete(soquete));
  });

  return conexoes;
}

/**
 * Monta o ponto de escuta com o material — e é aqui que as duas causas de recusa se separam.
 *
 * A exceção do runtime é lida **e descartada**: o que sobrevive é o tipo do erro deste domínio.
 */
function abrirPontoDeEscuta(material: Buffer, senha: string): Server {
  try {
    return createServer({ pfx: material, passphrase: senha });
  } catch (falha) {
    throw traduzirFalha(falha);
  }
}

/**
 * Traduz a falha do runtime no erro do domínio — **sem repassar nada dela**.
 *
 * A mensagem original é examinada em minúsculas e some em seguida: ela não vira `cause`, não vira
 * propriedade e não entra em texto nenhum. A M4 mediu que ela não carrega a senha nem os bytes; ainda
 * assim, o que não atravessa a fronteira não precisa ser provado inofensivo a cada superfície nova.
 */
function traduzirFalha(falha: unknown): Error {
  const sinal = falha instanceof Error ? falha.message.toLowerCase() : '';

  return sinal.includes(SINAL_DE_SENHA_QUE_NAO_ABRE)
    ? new ErroDeSenhaQueNaoAbre()
    : new ErroDeMaterialIlegivel();
}

/**
 * Abre a porta sorteada pelo núcleo e devolve o número dela.
 *
 * O ouvinte de `error` fica instalado **para sempre**, e não por `once`: um ponto de escuta sem
 * ouvinte de erro derruba o processo inteiro quando o evento chega tarde (é o contrato do
 * `EventEmitter`), e rejeitar uma promessa já resolvida é inócuo.
 */
function escutarEmPortaDinamica(pontoDeEscuta: Server): Promise<number> {
  return new Promise((resolver, rejeitar) => {
    pontoDeEscuta.on('error', (falha) => rejeitar(traduzirFalha(falha)));
    pontoDeEscuta.listen(PORTA_DINAMICA, ENDERECO_DO_LACO, () => {
      const endereco = pontoDeEscuta.address();
      if (endereco === null || typeof endereco === 'string') {
        // Endereço de soquete de domínio Unix, ou ponto de escuta que já caiu: não há porta a
        // conectar, e o ato não tem como completar.
        rejeitar(new ErroDeMaterialIlegivel());
        return;
      }
      resolver(endereco.port);
    });
  });
}

/** Conecta ao próprio ponto de escuta. Ver, no cabeçalho, por que a cadeia não é verificada. */
function conectarAoLaco(porta: number): TLSSocket {
  return connect({ host: ENDERECO_DO_LACO, port: porta, rejectUnauthorized: false });
}

/**
 * Espera o aperto de mão completar e devolve o que o par apresentou.
 *
 * ⚠️ O tipo de retorno admite **`null`** de propósito, ainda que o `@types/node` não o admita: é o
 * que o runtime devolve com o soquete destruído, e declarar aqui a forma real é o que obriga
 * {@link projetarMaterial} a guardar contra ela em vez de confiar no `.d.ts`.
 */
function lerDoPar(ligacao: TLSSocket): Promise<PeerCertificate | null> {
  return new Promise((resolver, rejeitar) => {
    ligacao.on('error', (falha) => rejeitar(traduzirFalha(falha)));
    ligacao.once('secureConnect', () => resolver(ligacao.getPeerCertificate()));
  });
}

/**
 * Encerra o ponto de escuta **e as conexões que sobraram**.
 *
 * `close()` sozinho apenas para de aceitar novas conexões, e só chama de volta quando a última se
 * fecha — com o lado servidor do aperto de mão ainda aberto, ele penduraria. Desfazer as conexões
 * primeiro é o que torna o encerramento determinístico, inclusive no caminho em que o teto estourou e
 * ninguém do outro lado vai cooperar.
 *
 * A falha de fechamento é ignorada de propósito: o desfecho do ato já está decidido, e um erro aqui
 * (ponto que nunca chegou a abrir) não muda o que se leu nem o que se recusou.
 */
function encerrarPontoDeEscuta(
  pontoDeEscuta: Server,
  conexoes: ReadonlySet<Socket>,
): Promise<void> {
  for (const conexao of conexoes) {
    conexao.destroy();
  }

  return new Promise((resolver) => {
    pontoDeEscuta.close(() => resolver());
  });
}

/**
 * Corre o trabalho contra o teto declarado.
 *
 * `Promise.race` já anexa tratamento às duas promessas, de modo que a rejeição tardia do trabalho —
 * a que o `finally` de {@link lerMaterial} provoca ao destruir a ligação — não vira rejeição não
 * tratada. O temporizador é limpo sempre, inclusive quando o trabalho vence.
 */
async function sobTetoDeTempo<T>(trabalho: () => Promise<T>): Promise<T> {
  let expiracao: ReturnType<typeof setTimeout> | undefined;
  const teto = new Promise<never>((_, rejeitar) => {
    expiracao = setTimeout(() => rejeitar(new ErroDeMaterialIlegivel()), TETO_DO_APERTO_DE_MAO_MS);
  });

  try {
    return await Promise.race([trabalho(), teto]);
  } finally {
    clearTimeout(expiracao);
  }
}

/**
 * Projeta o certificado do par nos quatro campos publicados — recusando o que não se deixa ler.
 *
 * ===========================================================================
 * SÃO DUAS GUARDAS, e a de cima existe porque O TIPO MENTE
 * ===========================================================================
 *
 * O `@types/node` declara `getPeerCertificate()` devolvendo `PeerCertificate` **não-nulo**, com
 * `subject` **não-opcional**. O runtime documenta outra coisa, e são **duas** formas degeneradas:
 * objeto **vazio** quando o par não apresentou certificado, e **`null`** quando o soquete já foi
 * destruído. Nenhuma das duas é hipotética aqui — cifra anônima negociada e soquete desfeito entre o
 * `secureConnect` e a leitura alcançam cada uma delas.
 *
 * ⚠️ **A guarda de cima precede toda leitura de campo, e a ordem é o conteúdo dela.** A versão
 * anterior projetava primeiro e guardava depois: sobre o objeto vazio, `Object.entries(undefined)`
 * levantava `TypeError` **antes** de a guarda de baixo ser avaliada — de modo que o comentário
 * prometia cobrir exatamente o caminho que o código deixava escapar, e a borda receberia erro fora
 * do mapa dela. O **CT-862** mede as duas formas e reprova se a ordem voltar a se inverter.
 *
 * A classe está fechada por enumeração, e ela é curta: esta é a **única** função do módulo que lê o
 * certificado, e ela toca **quatro** campos. `subject` e o próprio objeto são os que lançam, e a
 * guarda de cima os cobre; `fingerprint256` é coberto pela guarda de baixo (`typeof !== 'string'`);
 * `valid_from` e `valid_to` só são alcançados depois das duas, e ainda assim `instanteDeclarado`
 * traduz data ininterpretável em recusa nomeada, sem lançar. Campo novo aqui exige guarda nova.
 *
 * A guarda de baixo continua sendo a que recusa o material **lido e vazio** — titular sem atributo
 * algum, impressão digital ausente —, que a borda gravaria como se fosse o material.
 */
function projetarMaterial(certificado: PeerCertificate | null): MaterialLido {
  if (certificado === null || certificado.subject === undefined || certificado.subject === null) {
    throw new ErroDeMaterialIlegivel();
  }

  const titular = formaTextualDoSujeito(certificado.subject);
  const impressaoDigital = certificado.fingerprint256;

  if (titular === '' || typeof impressaoDigital !== 'string' || impressaoDigital === '') {
    throw new ErroDeMaterialIlegivel();
  }

  return {
    titular,
    validoDe: instanteDeclarado(certificado.valid_from),
    validoAte: instanteDeclarado(certificado.valid_to),
    impressaoDigital,
  };
}

/**
 * Compõe o sujeito na forma textual que o produto exibe: `C=BR, O=Empresa, CN=12345678000199`.
 *
 * A ordem é a que o certificado declara — reordenar mudaria o titular de um material já registrado
 * sem que nada no material tivesse mudado. Atributo repetido (dois `OU`, por exemplo) chega como
 * arranjo e sai como duas entradas, em vez de virar `[object Object]`.
 */
function formaTextualDoSujeito(sujeito: PeerCertificate['subject']): string {
  const atributos: string[] = [];

  for (const [nome, valor] of Object.entries(sujeito)) {
    if (typeof valor === 'string') {
      atributos.push(`${nome}=${valor}`);
    } else if (Array.isArray(valor)) {
      for (const repetido of valor) {
        atributos.push(`${nome}=${repetido}`);
      }
    }
  }

  return atributos.join(SEPARADOR_DO_SUJEITO);
}

/**
 * Converte a data que o runtime formata (`Aug 15 12:09:56 2026 GMT`) no instante correspondente.
 *
 * Data que não se deixa interpretar é material ilegível, e não um `Invalid Date` seguindo adiante: a
 * borda o gravaria numa coluna `timestamptz` e a falha apareceria a quilômetros da causa.
 */
function instanteDeclarado(texto: string): Date {
  const instante = new Date(texto);

  if (Number.isNaN(instante.getTime())) {
    throw new ErroDeMaterialIlegivel();
  }

  return instante;
}
