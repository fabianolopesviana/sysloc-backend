/**
 * O **vocabulário canônico** da cobrança bancária — o que o produto fala, e não o que o banco fala.
 *
 * ===========================================================================
 * A cláusula que este módulo existe para tornar verdadeira
 * ===========================================================================
 *
 * A ADR-0001 fixa que *"nenhum campo, URL ou vocabulário específico de provedor cruza a porta"*. É
 * uma propriedade do **vocabulário**, não do número de operações: ela vale igual para uma porta com
 * cinco operações e para a porta de identidade que esta fatia declara (ver o cabeçalho de
 * `./porta-de-identidade.ts` e a §21.3 do tech spec).
 *
 * Na prática, isto é o que este arquivo NÃO tem: nada que se chame como um campo do provedor, nada
 * que carregue código de banco, nada que nomeie recurso da API de lá. Quem traduz o dialeto do
 * provedor é o adaptador, e a tradução morre nele.
 *
 * ===========================================================================
 * O ENUM É IMPORTADO, e a ausência de uma segunda declaração é a decisão
 * ===========================================================================
 *
 * `MEIOS_DE_RECEBIMENTO` tem **definição única** em `@sysloc/contracts` (ADR-0016), e este módulo o
 * importa para derivar a união — não o redeclara. Duas declarações do mesmo fato é a forma exata do
 * débito **D14** que a fase anterior deixou aberta sobre o fuso da operação: dois fatos executáveis
 * dizendo a mesma coisa, livres para divergir, com nada que acuse quando divergirem.
 *
 * A derivação por `typeof` **não** é uma segunda declaração: ela não escolhe membro nenhum, e
 * acrescentar um meio no contrato alarga esta união sozinho. O que se cria aqui é o **nome** pelo
 * qual o domínio se refere ao vocabulário, e a origem dele fica visível no próprio import.
 *
 * ---------------------------------------------------------------------------
 * `PIX` é declarado e não tem operação — e isso NÃO é bandeira desligada
 * ---------------------------------------------------------------------------
 *
 * A RN-11 declara os dois meios e implementa só o boleto. Bandeira desligada esconde código pronto;
 * aqui **não há código a esconder** — nenhum caminho de execução deste pacote consome `PIX`, e o
 * CT-835 afirma essa ausência por lista vazia, que é o que separa uma coisa da outra.
 */

import type { MEIOS_DE_RECEBIMENTO } from '@sysloc/contracts';
import type { SegredoOperavel } from '@sysloc/shared';

/**
 * Os meios pelos quais o produto recebe, como união fechada — derivada da fonte única do contrato.
 *
 * Quem precisar do arranjo (para percorrer, para conferir em execução) importa
 * `MEIOS_DE_RECEBIMENTO` de `@sysloc/contracts`, que é onde ele mora congelado. Este pacote publica
 * o **tipo** porque é o tipo que o domínio manipula; republicar o valor daria ao produto dois
 * caminhos para o mesmo arranjo, e o segundo escaparia do `Object.freeze` da origem se algum dia
 * alguém o copiasse em vez de reexportá-lo.
 *
 * ⚠️ **A derivação por `typeof` NÃO é intercambiável com `export type { MeioDeRecebimento } from
 * '@sysloc/contracts'`, e a diferença foi MEDIDA — não argumentada.** O reexport publica o mesmo
 * nome com uma definição só, e o argumento acima (que é sobre o *valor*) de fato não o desautoriza:
 * tipo não existe em execução e não há `Object.freeze` a escapar. O que o desautoriza é o efeito
 * sobre a prova. Com o reexport, este pacote deixa de citar `MEIOS_DE_RECEBIMENTO` no vocabulário
 * executável, e a **âncora antivácuo** do CT-835 (`citacoesDe`) reprova — medido na T8, rodada 3:
 * `AssertionError: expected [] to deeply equal [ 'modelo-canonico.ts' ]`. A âncora existe porque a
 * asserção vizinha — *"nenhuma ligação local do enum"* — passa a ser satisfeita **por vacuidade**
 * num pacote que simplesmente não usa o nome: a metade *"importado"* da ADR-0016 ficaria sem prova,
 * e a limpeza teria custado cobertura. **É o import que mantém a varredura com o que examinar.**
 */
export type MeioDeRecebimento = (typeof MEIOS_DE_RECEBIMENTO)[number];

/**
 * O que a porta recebe para verificar uma identidade — **o invólucro opaco, e nada mais**.
 *
 * ---------------------------------------------------------------------------
 * Por que um tipo de um campo só, em vez do invólucro cru na assinatura
 * ---------------------------------------------------------------------------
 *
 * Porque é este tipo que a fatia (ii) alarga. O tech spec §8 já registra que `client_id` e `scope`
 * entram no **que se cifra**, e não na tabela nem no contrato: quando isso acontecer, o dado
 * continuará chegando por aqui, e a assinatura da operação não muda. Um `SegredoOperavel` solto na
 * assinatura faria o acréscimo de qualquer outro dado de identidade virar mudança de assinatura,
 * arrastando o adaptador e a borda junto.
 *
 * ⚠️ **Nenhum endereço, nenhuma URL e nenhuma credencial de habilitação entram aqui.** Para onde a
 * verificação conecta é decisão de quem monta o processo — o adaptador recebe o endereço na
 * construção, lido do ambiente num ponto só (tech spec §3.9 da T10). Aceitá-lo por este tipo faria
 * uma entrada de usuário decidir o destino da conexão, que é a forma canônica do defeito de
 * requisição forjada do lado do servidor.
 *
 * O campo se chama `segredo`, e não `certificado`, `pfx` ou `material`: o domínio não sabe que
 * formato o adaptador vai apresentar ao provedor — sabe apenas que carrega um segredo operável.
 */
export interface IdentidadeParaVerificar {
  /** O material e a senha que o abrem, opacos (ADR-0032). Quem os lê em claro é o adaptador. */
  readonly segredo: SegredoOperavel;
}

/**
 * O desfecho de uma verificação de identidade — **três campos, e nenhum deles do provedor**.
 *
 * ---------------------------------------------------------------------------
 * A recusa do provedor é um DESFECHO, nunca uma exceção
 * ---------------------------------------------------------------------------
 *
 * `aceito: false` é resposta: a pergunta do Admin — *"esta identidade serve?"* — foi respondida, e a
 * resposta é "não". Modelar a recusa como rejeição da promessa obrigaria quem chama a distinguir
 * "não serve" de "o serviço falhou" pelo tipo do erro, e a borda traduziria a primeira em `500`
 * (RN-06). O mesmo vale para indisponibilidade e tempo esgotado: são desfechos, e o `detalhe` os
 * separa.
 *
 * ---------------------------------------------------------------------------
 * Ele NÃO é um alias de `ResultadoDaVerificacao` de `@sysloc/contracts`
 * ---------------------------------------------------------------------------
 *
 * Os dois coincidem hoje, campo a campo, e a coincidência é **contingente**. Este é o que atravessa
 * a **porta**, e pertence ao domínio (ADR-0025); aquele é o que a **API publica**, e pertence ao
 * contrato (ADR-0016). Amarrá-los faria uma mudança da superfície publicada reescrever a assinatura
 * da porta e, com ela, o adaptador — que não tem nada com o que o frontend lê. Quem os aproxima é o
 * serviço da borda, num ponto só, e é o esquema publicado que confere a saída lá.
 *
 * A duplicação aparente, portanto, não é o débito D14: ali eram dois fatos **executáveis** dizendo a
 * mesma coisa (um limiar, um fuso), livres para divergir sem que nada acusasse. Aqui são dois fatos
 * **distintos** que hoje têm a mesma forma, e a divergência entre eles é justamente o que a fatia
 * (ii) prevê — o `detalhe` do desfecho positivo perde a ressalva de alcance quando a sonda subir.
 */
// DECISÃO FECHADA — T8 / Gate 2 · 2026-08-15
// O QUÊ: `ResultadoDaVerificacaoDeIdentidade` é declarado aqui, e NÃO é alias, `Pick` nem
//        reexportação de `ResultadoDaVerificacao` de `@sysloc/contracts`.
// POR QUÊ: a alternativa idiomática — um alias, já que as formas coincidem — foi descartada por
//          razão concreta: este tipo atravessa a PORTA e pertence ao domínio (ADR-0025); aquele é o
//          que a API PUBLICA e pertence ao contrato (ADR-0016). Amarrá-los faria uma mudança da
//          superfície publicada reescrever a assinatura da porta e, com ela, o adaptador — que não
//          tem nada com o que o frontend lê. A coincidência já nem é total: o esquema publicado
//          declara `verificadoEm` como `z.iso.datetime()`, e aqui ele é `string`.
// REVERTER EXIGE: provar que o desfecho da porta e o corpo publicado não podem mais divergir — o
//                 que a fatia (ii) já contradiz ao zerar `detalhe` no desfecho positivo.
export interface ResultadoDaVerificacaoDeIdentidade {
  /** O par aceitou a identidade apresentada. */
  readonly aceito: boolean;
  /**
   * Quando o ato aconteceu, como instante ISO-8601 em UTC — **cadeia, nunca `Date`**.
   *
   * A forma segue o que o produto já pratica na fronteira de dados (`packages/db/src/`): objeto de
   * data reserializado no fuso do processo desloca o valor, e a cadeia atravessa da origem até a
   * resposta sem ninguém reinterpretá-la.
   *
   * ⚠️ Ele é **carimbo do ato externo**, e não relógio de decisão de negócio. A ADR-0026 continua
   * valendo onde ela incide: a vigência do certificado é comparada com
   * `negocio.data_corrente_da_operacao()`, e nada neste desfecho decide comportamento do produto.
   */
  readonly verificadoEm: string;
  /**
   * O alcance do desfecho, em português do produto — anulável desde já.
   *
   * Ele carrega, **inclusive no desfecho positivo**, o que a sonda desta fatia afirma e o que ela
   * não afirma (tech spec §8), para que a tela do Admin não prometa mais do que foi medido. Nasce
   * anulável porque a fatia (ii) o zera no positivo, quando a sonda passar a responder a pergunta
   * inteira — sem a anulabilidade agora, aquela fatia mudaria contrato publicado para fazer o que já
   * está decidido.
   *
   * ⚠️ **Nenhum detrito do runtime de transporte entra aqui** — nem código de erro de biblioteca,
   * nem texto de OpenSSL, nem nome de recurso do provedor. Quem escolhe o texto é o adaptador, de um
   * conjunto fechado de constantes suas (T10), e é isso que mantém verdadeira a cláusula da
   * ADR-0001 sobre o que atravessa a porta.
   */
  // DÉBITO COM GATILHO — D27 · F4/T8 · registrado 2026-08-15 · gatilho emendado 2026-08-16 (T14)
  // O QUÊ: a restrição acima — *o texto sai de um conjunto FECHADO de constantes do adaptador* —
  //        existe só em prosa, e o tipo é `string`. O `CT-834` varre NOMES (chaves de tipo,
  //        literais de enum, símbolos declarados), nunca VALORES em execução, de modo que este é o
  //        único ponto por onde texto arbitrário atravessa a porta sem que nada acuse — e ele tem
  //        caminho direto até a tela do Admin, porque `esquemaDoResultadoDaVerificacao` publica
  //        `detalhe: z.string().nullable()`.
  // QUANDO FECHA: a fatia **(ii)** (`emissao-e-conciliacao`), ao CONSUMIR este campo na tela do
  //        Admin — ali o texto deixa de ser dado inerte e ganha leitor, e o tipo sobe para a união
  //        dos valores mais `null`, com a cláusula de vocabulário da ADR-0001 exigível pelo
  //        compilador em vez de pela boa-fé de quem escreve o adaptador.
  //        ⚠️ O gatilho ORIGINAL — *"a T10, ao escolher o conjunto fechado de constantes"* — JÁ
  //        DISPAROU: a T10 escolheu as quatro (`DETALHE_ACEITE`, `DETALHE_RECUSA_PELO_PAR`,
  //        `DETALHE_INDISPONIVEL`, `DETALHE_TEMPO_ESGOTADO`) e **pagou a metade exigível** do
  //        débito pela segunda saída que ele admitia — *"ganhar caso que afirme a pertinência ao
  //        conjunto"* —, medida por CT-839/840/841/842, com o CT-840 varrendo 12 termos proibidos
  //        no desfecho serializado e controle positivo. O que sobra é a saída ESTRUTURAL, e é ela
  //        que este gatilho novo agenda (T14, 2026-08-16; ver §5.7 do ÍNDICE abaixo).
  // POR QUE NÃO AGORA: a saída estrutural exige declarar os quatro valores **no domínio**, para que
  //        o adaptador os importe — e a ADR-0025 aponta a dependência ao contrário: o domínio não
  //        conhece o adaptador. Movê-la no fecho da fatia, sem adaptador novo que a justifique,
  //        trocaria a fronteira do pacote por conveniência de escrituração. É parente da razão
  //        original: assinatura sem quem a chame é abstração especulativa.
  // ÍNDICE: docs/specs/features/fundacao-bancaria/v1/_run/run-report.md §2, D27
  readonly detalhe: string | null;
}
