/**
 * O segredo operável — cifra autenticada e opacidade do invólucro (ADR-0032, primeira barreira).
 *
 * ---------------------------------------------------------------------------
 * INVARIANTES
 * ---------------------------------------------------------------------------
 *
 * | Critério | CT     | Invariante |
 * |----------|--------|------------|
 * | A1, A4   | CT-801 | Material e senha cifrados por `cifrarSegredo` e decifrados **pela mesma
 * |          |        | chave** voltam byte a byte idênticos; o envelope não carrega nenhuma
 * |          |        | subcadeia do claro; e cifrar o mesmo par duas vezes produz envelopes
 * |          |        | diferentes, porque o vetor de inicialização é sorteado por operação. |
 * | A2, A6   | CT-802 | Decifrar com chave distinta da que cifrou **levanta**
 * | CA-12    |        | `ErroDeSegredoAdulterado`, nada é devolvido — nem bytes parciais, nem os
 * |          |        | originais —, e nenhuma superfície da exceção (texto, mensagem, pilha,
 * |          |        | propriedades próprias, inspeção profunda, serialização) carrega o claro
 * |          |        | nem qualquer das duas chaves. |
 * | A6       | CT-802 | As guardas de recusa do módulo têm desfecho nomeado e provado:
 * |          | (c)(d) | chave de comprimento errado é recusada com `ErroDeChaveDeCifraInvalida`
 * |          |        | **nas duas pontas** — cifra e decifração —, e a exceção dela também não
 * |          |        | carrega o claro nem nenhuma das chaves; e um quadro cujo prefixo declara
 * |          |        | comprimento de senha maior que o próprio quadro é recusado com
 * |          |        | `ErroDeSegredoAdulterado` em vez de fatiado no lugar errado — caminho que
 * |          |        | a etiqueta do GCM **não** alcança, e o caso o demonstra decifrando à mão. |
 * | A6       | CT-802 | O quadro em claro **se identifica**: ele abre com um byte de versão, e um
 * |          | (d)    | quadro que dele diverge em **exatamente esse byte** — autêntico, coerente,
 * |          |        | e que fatiado pelo layout corrente devolveria um par plausível — é
 * |          |        | recusado com `ErroDeVersaoDeEnvelopeDesconhecida`, desfecho **próprio** e
 * |          |        | distinto do da adulteração; a conferência vem **antes** de qualquer
 * |          |        | fatiamento, o que o caso prova somando versão desconhecida a prefixo
 * |          |        | incoerente e afirmando que responde a versão. |
 * | A6       | CT-802 | O porte mínimo do envelope é **exato**: o menor segredo possível — senha e
 * |          | (e)    | material vazios — abre pela API pública, e um envelope autêntico cujo
 * |          |        | quadro não carrega os dois campos de comprimento fixo é recusado com
 * |          |        | `ErroDeSegredoAdulterado`, nunca com o `RangeError` cru do runtime. |
 * | A6       | CT-802 | A6 vale para as **TRÊS** classes de erro do módulo, e o conjunto delas é
 * |          | (f)    | conferido contra o que o módulo **exporta**: nenhuma superfície de nenhuma
 * |          |        | das três carrega o claro nem chave alguma — inclusive a da versão
 * |          |        | desconhecida, a única levantada com o quadro **já decifrado** na mão —, e
 * |          |        | uma classe de erro publicada sem entrada no roteiro reprova nomeando-se. |
 * | A3, A5   | CT-803 | As três formas de serialização do invólucro — `toString`,
 * | CA-02    |        | `JSON.stringify` e a inspeção do runtime — devolvem `[REDIGIDO]`,
 * | CA-12    |        | inclusive com o invólucro aninhado dentro de outro objeto; o conteúdo não
 * |          |        | é alcançável por enumeração nem por espalhamento; e o módulo não lê
 * |          |        | `process.env` em ponto nenhum. |
 *
 * Rastreabilidade: `A1 → CT-801`, `A2/A6 → CT-802`,
 * `A6 → CT-802 (c), CT-802 (d), CT-802 (e), CT-802 (f)`, `A3/A5 → CT-803`, `CA-02 → CT-803`,
 * `CA-12 → CT-802, CT-803`.
 *
 * ---------------------------------------------------------------------------
 * FRONTEIRA REAL DE EXECUÇÃO: **nenhuma**, e legitimamente
 * ---------------------------------------------------------------------------
 *
 * O SUT é `node:crypto` em memória — não há I/O, relógio nem rede. **Nenhum dublê é usado**: a
 * cifra de verdade é o próprio objeto sob teste, e substituí-la por um dublê provaria o dublê.
 *
 * ⚠️ **A medição do segredo sobre a SAÍDA REAL — resposta HTTP, diário do sistema, documento
 * publicado — é da T13, e é ela que a ADR-0032 exige como prova**: *"a ausência de vazamento é
 * afirmada por medição da saída real, nunca por leitura do código"*. Este arquivo prova a barreira
 * **estrutural**, que é outra coisa. Repetir aqui a medição de saída seria duplicação entre camadas
 * (AP-23); afirmar a CA-12 como provada por este arquivo seria pior — seria trocar a prova exigida
 * por uma mais fraca.
 *
 * ---------------------------------------------------------------------------
 * TODA VARREDURA POR SENTINELA CARREGA CONTROLE POSITIVO — e a razão é medida
 * ---------------------------------------------------------------------------
 *
 * Afirmar *"a agulha não está na palha"* não prova nada enquanto não se souber que aquela busca
 * **acha** a agulha quando ela está lá: uma varredura quebrada passa verde e não prova coisa alguma
 * (AP-29, a única causa de rejeição repetida da fatia anterior). Por isso cada caso que busca
 * sentinela busca **antes** num objeto de controle onde ela foi plantada de propósito, canal por
 * canal — mensagem, pilha, propriedade própria rasa, propriedade aninhada, `Buffer` cru inspecionado
 * — e afirma a lista de achados por igualdade.
 *
 * Pela mesma razão, o CT-803 abre afirmando que o invólucro **de fato carrega** o par em claro: um
 * invólucro vazio passaria em todas as asserções de opacidade sem redigir nada.
 *
 * ---------------------------------------------------------------------------
 * POR QUE A VARREDURA É REPETIDA POR CLASSE, e ainda assim existe o CT-802 (f)
 * ---------------------------------------------------------------------------
 *
 * A prova de A6 é **por classe de erro**, não por módulo, e duas vezes uma classe nova nasceu fora
 * dela — a segunda numa rodada, a terceira na seguinte. A repetição explícita foi **mantida**: cada
 * caso varre com o material do seu próprio caminho e com o controle positivo escrito canal a canal,
 * e trocá-la por uma iteração genérica custaria a força das asserções para comprar elegância — que
 * é o negócio errado.
 *
 * O que o CT-802 (f) acrescenta **não é a varredura de novo, é outra propriedade**: a de que o
 * conjunto das classes que têm prova de A6 é o conjunto das que o módulo **exporta**. Nenhum dos
 * casos por classe pode afirmá-la, porque nenhum deles enxerga o conjunto. E a entrada no roteiro
 * dele não é um nome numa lista: é produtor executável, mapa de agulhas e controle positivo — de
 * modo que registrar uma quarta classe **é** escrever a prova dela, e não registrá-la reprova.
 *
 * Nenhuma chave, material ou senha deste arquivo é versionada: os três são **gerados em execução**,
 * na memória do processo de teste.
 */

import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { inspect } from 'node:util';
import { describe, expect, it } from 'vitest';
/**
 * O módulo **inteiro**, ao lado dos símbolos nomeados — e a duplicação do caminho é o mecanismo.
 *
 * É o que permite ao CT-802 (f) perguntar **quais** classes de erro o módulo publica, em vez de
 * aceitar a lista que quem escreveu o teste lembrou de importar. Um import nomeado jamais poderia
 * responder isso: ele **é** a lista, e uma classe nova que ninguém importasse ficaria invisível
 * exatamente para o caso que existe para achá-la.
 */
import * as moduloDoSegredoOperavel from '../src/segredo-operavel.ts';
import {
  cifrarSegredo,
  cifrarValorOperavel,
  criarSegredoOperavel,
  decifrarSegredo,
  decifrarValorOperavel,
  ErroDeChaveDeCifraInvalida,
  ErroDeSegredoAdulterado,
  ErroDeVersaoDeEnvelopeDesconhecida,
  type SegredoOperavel,
} from '../src/segredo-operavel.ts';

/**
 * A sentinela de redação, escrita **literalmente** aqui — e não importada do produto.
 *
 * A duplicação é deliberada, e é a mesma escolha que `log.spec.ts` já registra: importar a
 * constante do SUT tornaria a asserção tautológica (AP-29). Trocar `[REDIGIDO]` por qualquer outra
 * coisa no produto passaria despercebido, porque os dois lados da comparação mudariam juntos —
 * justamente o que este arquivo existe para pegar. **No código de produção vale o contrário**: lá a
 * sentinela tem declaração única, em `src/log.ts`, e o segredo operável a importa.
 */
const SENTINELA_REDIGIDO = '[REDIGIDO]';

/** Comprimento da chave do AES-256, em bytes. */
const BYTES_DA_CHAVE = 32;

/** Comprimento do vetor de inicialização no envelope — as primeiras posições dele. */
const BYTES_DO_VETOR = 12;

/** Comprimento da etiqueta de autenticação no envelope, logo após o vetor. */
const BYTES_DA_ETIQUETA = 16;

/** Quantos bytes anunciam o comprimento da senha no início do quadro em claro. */
const BYTES_DO_PREFIXO_DA_SENHA = 4;

/**
 * A versão do layout do quadro em claro, escrita **literalmente** aqui — e não importada do produto.
 *
 * Pela mesma razão já registrada em {@link SENTINELA_REDIGIDO}: importar o discriminador do módulo
 * faria os dois lados da comparação mudarem juntos, e trocar a versão no produto — que é mudança de
 * **formato binário persistido** — passaria despercebido. É justamente o que estes casos existem
 * para pegar.
 */
const VERSAO_DO_QUADRO = 1;

/** Quantos bytes carregam a versão, à frente de tudo no quadro. */
const BYTES_DA_VERSAO = 1;

/** Onde o corpo da senha começa: depois dos dois campos de comprimento fixo do quadro. */
const INICIO_DA_SENHA = BYTES_DA_VERSAO + BYTES_DO_PREFIXO_DA_SENHA;

/**
 * O algoritmo, escrito **literalmente** aqui — e não importado do produto.
 *
 * Pela mesma razão já registrada em {@link SENTINELA_REDIGIDO}: o CT-802 (d) precisa forjar um
 * envelope **autêntico** por fora do módulo, e forjá-lo com a constante do próprio módulo tornaria
 * a montagem incapaz de discordar dele (AP-29). Trocar o modo por um não autenticado no produto
 * passaria despercebido se os dois lados mudassem juntos.
 */
const ALGORITMO_DA_CIFRA = 'aes-256-gcm';

/**
 * Os comprimentos de chave que a guarda recusa — **um abaixo e um acima** do exigido.
 *
 * As duas pontas, e não só a curta: uma guarda escrita como `chave.length < BYTES_DA_CHAVE`
 * aceitaria a de 33 bytes, e o `RangeError` cru do runtime chegaria à borda sem nome de domínio —
 * indistinguível, para quem chama, de um envelope adulterado.
 */
const COMPRIMENTOS_DE_CHAVE_RECUSADOS = [31, 33] as const;

/** O porte do material real medido para a spec (§21.1) — o PKCS#12 do provedor tem 2.686 bytes. */
const BYTES_DO_MATERIAL = 2686;

/** Quantos bytes de fonte aleatória compõem a senha sintética — 9 bytes dão 12 caracteres. */
const BYTES_DA_SENHA_SINTETICA = 9;

/**
 * Cadeias que não ocorrem em nenhum outro lugar da árvore versionada.
 *
 * Elas são a **agulha**: quando o teste procura o claro numa superfície e não o acha, é destas
 * cadeias que se está falando. Serem improváveis é o que impede que um achado por coincidência
 * (ou uma ausência por coincidência) passe por resultado.
 */
const SENTINELA_DO_MATERIAL = 'MATERIAL-SENTINELA-b7c1e4a9d2f60358';
const SENTINELA_DA_SENHA = 'SENHA-SENTINELA-4e19ac37f5b8d206';

/** Uma chave de cifra, sorteada na memória do processo de teste. Nada aqui é versionado. */
function chaveDeCifra(): Buffer {
  return randomBytes(BYTES_DA_CHAVE);
}

/**
 * Material sintético do porte do real, com a sentinela **no meio**.
 *
 * No meio, e não numa ponta, de propósito: uma implementação que preservasse cabeça ou cauda do
 * claro (um envelope que só cifrasse parte do quadro, por exemplo) escaparia de uma sentinela
 * plantada na borda.
 */
function materialSintetico(sentinela: string): Buffer {
  const marca = Buffer.from(sentinela, 'utf8');
  const enchimento = randomBytes(BYTES_DO_MATERIAL - marca.length);
  const meio = Math.floor(enchimento.length / 2);

  return Buffer.concat([enchimento.subarray(0, meio), marca, enchimento.subarray(meio)]);
}

/** Senha de 12 caracteres, gerada em execução. */
function senhaSintetica(): string {
  return randomBytes(BYTES_DA_SENHA_SINTETICA).toString('base64url');
}

/** O vetor de inicialização de um envelope — as primeiras posições, por construção do formato. */
function vetorDe(envelope: string): Buffer {
  return Buffer.from(envelope, 'base64').subarray(0, BYTES_DO_VETOR);
}

/** O texto cifrado de um envelope — o que sobra depois do vetor e da etiqueta. */
function textoCifradoDe(envelope: string): Buffer {
  return Buffer.from(envelope, 'base64').subarray(BYTES_DO_VETOR + BYTES_DA_ETIQUETA);
}

/**
 * Monta um envelope **autêntico** por fora do módulo: `vetor || etiqueta || textoCifrado`.
 *
 * Por fora de propósito — é o único jeito de produzir um quadro que a etiqueta do GCM aprova e que,
 * ainda assim, este módulo não deve aceitar. `cifrarSegredo` jamais produziria um.
 *
 * Ele mora aqui, e não dentro de um caso, porque **dois** casos precisam da mesma forja — o do
 * layout do quadro e o do porte mínimo do envelope. Uma segunda cópia da montagem seriam dois fatos
 * executáveis dizendo o que o envelope é, livres para divergir, com nada que acuse quando divergirem.
 */
function envelopeDoQuadro(quadro: Buffer, chave: Buffer): string {
  const vetor = randomBytes(BYTES_DO_VETOR);
  const cifrador = createCipheriv(ALGORITMO_DA_CIFRA, chave, vetor);
  const textoCifrado = Buffer.concat([cifrador.update(quadro), cifrador.final()]);

  return Buffer.concat([vetor, cifrador.getAuthTag(), textoCifrado]).toString('base64');
}

/**
 * Um quadro `[uint8 versão][uint32BE declarado][corpo]` — com os **dois** campos livres para mentir.
 *
 * A versão é parâmetro, e não constante fixada aqui, porque é exatamente ela que os casos precisam
 * variar: um quadro que só diverge no discriminador é o experimento de **variável única** que separa
 * a recusa por layout desconhecido da recusa por incoerência de comprimento.
 */
function quadroDeclarando(versao: number, declarado: number, corpo: Buffer): Buffer {
  const cabecalho = Buffer.alloc(INICIO_DA_SENHA);
  cabecalho.writeUInt8(versao, 0);
  cabecalho.writeUInt32BE(declarado, BYTES_DA_VERSAO);

  return Buffer.concat([cabecalho, corpo]);
}

/**
 * Procura o claro **dentro dos bytes** do envelope e devolve o que achou, nomeado.
 *
 * A busca é sobre os bytes decodificados, e não sobre o texto em base64: qualquer subcadeia do claro
 * que sobrevivesse ao envelope apareceria ali, independentemente do alinhamento da codificação — que
 * é justamente o que uma busca sobre o texto codificado perderia.
 */
function claroEncontradoNoEnvelope(envelope: string, material: Buffer, senha: string): string[] {
  const bytes = Buffer.from(envelope, 'base64');
  const achados: string[] = [];

  if (bytes.includes(material)) {
    achados.push('material');
  }
  if (bytes.includes(Buffer.from(senha, 'utf8'))) {
    achados.push('senha');
  }

  return achados;
}

/**
 * As seis superfícies pelas quais uma exceção chega ao diário, ao terminal ou à resposta.
 *
 * Cada uma é um caminho independente: o texto do `throw` não convertido, a mensagem, a pilha (que a
 * medição M4 da spec apontou como sobrevivente da redação), as propriedades próprias, a inspeção
 * profunda (o caminho de `console.error`) e a serialização em JSON.
 */
function superficiesDaExcecao(erro: unknown): readonly string[] {
  const excecao = erro as Error & Record<string, unknown>;
  const proprias = Object.getOwnPropertyNames(excecao);

  return [
    String(erro),
    excecao.message ?? '',
    excecao.stack ?? '',
    inspect(Object.fromEntries(proprias.map((nome) => [nome, excecao[nome]])), { depth: null }),
    inspect(erro, { depth: null }),
    JSON.stringify(excecao, proprias) ?? '',
  ];
}

/**
 * Devolve, nomeadas e na ordem declarada, as agulhas encontradas em alguma superfície da exceção.
 *
 * Cada superfície é buscada em **duas formas**: crua e sem espaço em branco. A segunda existe porque
 * a inspeção de um `Buffer` imprime os bytes em hexadecimal **separados por espaço**
 * (`<Buffer 1a 2b …>`), e sem a normalização uma chave viajando como bytes crus escaparia da busca —
 * exatamente o modo de falha que o controle positivo abaixo planta para provar que não escapa.
 */
function agulhasEncontradas(erro: unknown, agulhas: Readonly<Record<string, string>>): string[] {
  const superficies = superficiesDaExcecao(erro).flatMap((texto) => [
    texto,
    texto.replace(/\s/g, ''),
  ]);

  return Object.entries(agulhas)
    .filter(([, agulha]) => superficies.some((superficie) => superficie.includes(agulha)))
    .map(([nome]) => nome);
}

/**
 * Executa e devolve **a exceção levantada**, ou `undefined` quando a chamada retornou.
 *
 * Existe para que o desfecho seja **nomeado** por {@link nomeDoDesfecho} em vez de afirmado por
 * `toThrow()` genérico: "recusou pela guarda deste módulo", "recusou pelo `RangeError` cru do
 * runtime" e "não recusou coisa alguma" são três respostas diferentes, e um `toThrow()` sem classe
 * daria a mesma cor às duas primeiras — que é exatamente a distinção que estes casos existem para
 * provar.
 */
function excecaoDe(executar: () => unknown): unknown {
  try {
    executar();
    return undefined;
  } catch (erro) {
    return erro;
  }
}

/** O nome do desfecho: o `name` da exceção, ou o rótulo de que nada foi levantado. */
function nomeDoDesfecho(erro: unknown): string {
  return erro === undefined ? 'nada levantado' : String((erro as Error).name);
}

/** Uma exceção de controle com uma agulha plantada em **cada** canal que a varredura percorre. */
interface ExcecaoDeControle extends Error {
  readonly contexto: { readonly certificado: { readonly pfx: string } };
  readonly chaveCrua: Buffer;
  readonly detalhes: { readonly interno: readonly string[] };
}

/**
 * Planta as agulhas de controle **nomeando o canal de cada uma** — o mapeamento é da chamada.
 *
 * Ele existe porque o CT-802 (f) monta um controle por classe de erro e os cinco canais são sempre
 * os mesmos; o que muda é qual agulha vai em qual. Deixar o mapeamento no argumento, e não dentro
 * daqui, é o que mantém legível a propriedade que interessa: **cada** agulha declarada está em
 * **algum** canal, e é por isso que o controle positivo tem de achar todas.
 *
 * ⚠️ Ele **não** substitui os controles escritos à mão dos casos anteriores, e a duplicação é
 * deliberada: reescrevê-los para passar por aqui alteraria prova já verificada por medição, que é
 * exatamente o que o Protocolo Antirregressão proíbe.
 */
function controleComAgulhas(canais: {
  readonly naMensagem: readonly string[];
  readonly naPilha: string;
  readonly emPropriedadeAninhada: string;
  readonly comoBufferCru: Buffer;
  readonly emArrayAninhado: readonly string[];
}): ExcecaoDeControle {
  const controle: ExcecaoDeControle = Object.assign(
    new Error(`vazou ${canais.naMensagem.join(' sob ')}`),
    {
      contexto: { certificado: { pfx: canais.emPropriedadeAninhada } },
      chaveCrua: canais.comoBufferCru,
      detalhes: { interno: canais.emArrayAninhado },
    },
  );
  controle.stack = `${controle.stack ?? ''}\n    at decompor (${canais.naPilha})`;

  return controle;
}

/**
 * Uma entrada do roteiro de A6: **uma classe de erro do módulo e tudo o que prova A6 sobre ela**.
 *
 * A forma do tipo é o mecanismo do CT-802 (f). Registrar uma classe nova no roteiro não é escrever
 * um nome numa lista: é entregar o caminho legítimo que a levanta, o que nunca pode aparecer nas
 * superfícies dela, e uma exceção de controle onde essas agulhas foram plantadas de propósito.
 * Quem acrescentar uma quarta classe **escreve a prova ao registrá-la**, ou não compila.
 */
interface ProvaDeA6 {
  /** O nome da classe — também o `.name` esperado da exceção e a chave dos mapas afirmados. */
  readonly nome: string;
  /** A classe em si: `.name` é uma cadeia e não distingue a classe de uma homônima qualquer. */
  readonly classe: new () => Error;
  /** Levanta a exceção **pelo caminho legítimo do módulo** — nunca por construção direta. */
  readonly produzir: () => unknown;
  /** O que jamais pode aparecer em superfície alguma daquela exceção, nomeado agulha a agulha. */
  readonly agulhas: Readonly<Record<string, string>>;
  /** A mesma coisa plantada de propósito, para provar que a varredura acha o que está lá. */
  readonly controle: ExcecaoDeControle;
}

describe('cifra do segredo operável', () => {
  it('CT-801 — ida e volta pela mesma chave devolve material e senha byte a byte idênticos', () => {
    const chave = chaveDeCifra();
    const material = materialSintetico(SENTINELA_DO_MATERIAL);
    const senha = senhaSintetica();
    const segredo = criarSegredoOperavel({ material, senha });

    const envelope = cifrarSegredo(segredo, chave);
    const recuperado = decifrarSegredo(envelope, chave).abrir();

    // (a) A IDA E VOLTA — igualdade de bytes, não "parece com".
    expect(recuperado.material.equals(material)).toBe(true);
    expect(recuperado.senha).toBe(senha);
    expect(recuperado.material.length).toBe(BYTES_DO_MATERIAL);
    expect(senha).toHaveLength(12);

    // (b) O CONTROLE POSITIVO DA BUSCA, e ele é indispensável: um envelope montado SEM cifra
    //     alguma tem o claro dentro, e a busca precisa achá-lo. Sem esta linha, a asserção
    //     seguinte passaria mesmo com `includes` procurando a coisa errada.
    const envelopeSemCifra = Buffer.concat([
      randomBytes(BYTES_DO_VETOR + BYTES_DA_ETIQUETA),
      Buffer.from(senha, 'utf8'),
      material,
    ]).toString('base64');
    expect(claroEncontradoNoEnvelope(envelopeSemCifra, material, senha)).toEqual([
      'material',
      'senha',
    ]);

    // (c) A ASSERÇÃO: no envelope de verdade, nenhum dos dois aparece.
    expect(claroEncontradoNoEnvelope(envelope, material, senha)).toEqual([]);

    // (d) O VETOR É SORTEADO POR OPERAÇÃO (A4): o mesmo par cifrado duas vezes dá envelopes
    //     diferentes — e não só na primeira parte: o texto cifrado também difere, que é o que
    //     reprova um vetor fixo (com ele, o texto cifrado seria idêntico).
    const segundoEnvelope = cifrarSegredo(segredo, chave);
    expect(segundoEnvelope).not.toBe(envelope);
    expect(vetorDe(segundoEnvelope).equals(vetorDe(envelope))).toBe(false);
    expect(textoCifradoDe(segundoEnvelope).equals(textoCifradoDe(envelope))).toBe(false);

    // (e) …e os dois envelopes abrem no MESMO claro — sem isto, "diferentes" poderia ser lixo.
    const doSegundo = decifrarSegredo(segundoEnvelope, chave).abrir();
    expect(doSegundo.material.equals(material)).toBe(true);
    expect(doSegundo.senha).toBe(senha);
  });

  it('CT-802 — decifrar com chave errada levanta e a exceção não carrega o claro nem as chaves', () => {
    const chaveQueCifrou = chaveDeCifra();
    const chaveApresentada = chaveDeCifra();
    const material = materialSintetico(SENTINELA_DO_MATERIAL);
    const senha = SENTINELA_DA_SENHA;

    const envelope = cifrarSegredo(criarSegredoOperavel({ material, senha }), chaveQueCifrou);

    let recuperado: SegredoOperavel | undefined;
    let capturada: unknown;
    try {
      recuperado = decifrarSegredo(envelope, chaveApresentada);
    } catch (erro) {
      capturada = erro;
    }

    // (a) LEVANTOU, e nada foi devolvido — nem bytes parciais, nem os originais.
    expect(recuperado).toBeUndefined();
    expect(capturada).toBeInstanceOf(ErroDeSegredoAdulterado);
    expect((capturada as Error).name).toBe('ErroDeSegredoAdulterado');

    const agulhas = {
      material: SENTINELA_DO_MATERIAL,
      senha: SENTINELA_DA_SENHA,
      chaveQueCifrouEmBase64: chaveQueCifrou.toString('base64'),
      chaveQueCifrouEmHexadecimal: chaveQueCifrou.toString('hex'),
      chaveApresentadaEmBase64: chaveApresentada.toString('base64'),
      chaveApresentadaEmHexadecimal: chaveApresentada.toString('hex'),
    } as const;

    // (b) O CONTROLE POSITIVO DA VARREDURA — uma agulha por canal, plantada de propósito:
    //     mensagem, pilha, propriedade própria rasa, `Buffer` cru inspecionado (que só casa com a
    //     normalização de espaços) e propriedade aninhada. A varredura tem de achar as SEIS.
    const controle: ExcecaoDeControle = Object.assign(
      new Error(`vazou ${SENTINELA_DO_MATERIAL} sob ${agulhas.chaveApresentadaEmBase64}`),
      {
        contexto: { certificado: { pfx: agulhas.chaveQueCifrouEmBase64 } },
        chaveCrua: chaveQueCifrou,
        detalhes: { interno: [agulhas.chaveApresentadaEmHexadecimal] },
      },
    );
    controle.stack = `${controle.stack ?? ''}\n    at abrirEnvelope (${SENTINELA_DA_SENHA})`;

    expect(agulhasEncontradas(controle, agulhas)).toEqual(Object.keys(agulhas));

    // (c) A ASSERÇÃO: na exceção de verdade, a mesma varredura não acha nenhuma.
    expect(
      agulhasEncontradas(capturada, agulhas),
      'a exceção do segredo operável carrega valor que nunca deveria sair do módulo',
    ).toEqual([]);
  });

  it('CT-802 (b) — envelope adulterado é recusado pela mesma chave que o cifrou', () => {
    const chave = chaveDeCifra();
    const material = materialSintetico(SENTINELA_DO_MATERIAL);
    const senha = senhaSintetica();
    const envelope = cifrarSegredo(criarSegredoOperavel({ material, senha }), chave);

    // Um bit trocado no ÚLTIMO byte do texto cifrado — a adulteração que a etiqueta do GCM existe
    // para pegar, e que uma cifra não autenticada devolveria como material corrompido.
    const bytes = Buffer.from(envelope, 'base64');
    const ultimo = bytes.length - 1;
    bytes[ultimo] = (bytes[ultimo] ?? 0) ^ 0x01;

    expect(() => decifrarSegredo(bytes.toString('base64'), chave)).toThrow(ErroDeSegredoAdulterado);

    // O controle positivo do próprio caso: o envelope ÍNTegro, com a mesma chave, abre.
    expect(decifrarSegredo(envelope, chave).abrir().material.equals(material)).toBe(true);
  });

  it('CT-802 (c) — chave de comprimento errado é recusada nas duas pontas, e a recusa não carrega nada', () => {
    const chaveValida = chaveDeCifra();
    const material = materialSintetico(SENTINELA_DO_MATERIAL);
    const senha = SENTINELA_DA_SENHA;
    const segredo = criarSegredoOperavel({ material, senha });

    // (a) O CONTROLE POSITIVO DO CASO: com os 32 bytes exigidos, as duas pontas passam. Sem ele,
    //     uma guarda que recusasse TODA chave deixaria o bloco (b) verde sem provar nada.
    const envelope = cifrarSegredo(segredo, chaveValida);
    expect(decifrarSegredo(envelope, chaveValida).abrir().material.equals(material)).toBe(true);

    // (b) A ASSERÇÃO: 31 e 33 bytes são recusados NAS DUAS PONTAS, e pela exceção deste domínio —
    //     não pelo `RangeError` cru do runtime, que é o que sobra quando a guarda some. A guarda
    //     vale na cifra também de propósito: uma chave curta ali gravaria um envelope que nenhuma
    //     decifração futura abriria, e o defeito só apareceria no dia da cobrança.
    const tentativas = COMPRIMENTOS_DE_CHAVE_RECUSADOS.map((bytes) => randomBytes(bytes)).flatMap(
      (chave) =>
        [
          [`cifrar com ${chave.length} bytes`, excecaoDe(() => cifrarSegredo(segredo, chave))],
          [`decifrar com ${chave.length} bytes`, excecaoDe(() => decifrarSegredo(envelope, chave))],
        ] as const,
    );

    expect(
      Object.fromEntries(tentativas.map(([rotulo, erro]) => [rotulo, nomeDoDesfecho(erro)])),
    ).toEqual({
      'cifrar com 31 bytes': 'ErroDeChaveDeCifraInvalida',
      'decifrar com 31 bytes': 'ErroDeChaveDeCifraInvalida',
      'cifrar com 33 bytes': 'ErroDeChaveDeCifraInvalida',
      'decifrar com 33 bytes': 'ErroDeChaveDeCifraInvalida',
    });
    for (const [rotulo, erro] of tentativas) {
      expect(erro, rotulo).toBeInstanceOf(ErroDeChaveDeCifraInvalida);
    }

    // (c) O CONTROLE POSITIVO DA VARREDURA — a mesma do CT-802, agora sobre a OUTRA classe de erro
    //     do módulo: uma agulha por canal, plantada de propósito. A varredura tem de achar as seis.
    const chaveRecusada = randomBytes(COMPRIMENTOS_DE_CHAVE_RECUSADOS[0]);
    const capturada = excecaoDe(() => cifrarSegredo(segredo, chaveRecusada));
    expect(capturada).toBeInstanceOf(ErroDeChaveDeCifraInvalida);

    const agulhas = {
      material: SENTINELA_DO_MATERIAL,
      senha: SENTINELA_DA_SENHA,
      chaveValidaEmBase64: chaveValida.toString('base64'),
      chaveValidaEmHexadecimal: chaveValida.toString('hex'),
      chaveRecusadaEmBase64: chaveRecusada.toString('base64'),
      chaveRecusadaEmHexadecimal: chaveRecusada.toString('hex'),
    } as const;

    const controle: ExcecaoDeControle = Object.assign(
      new Error(`vazou ${SENTINELA_DO_MATERIAL} sob ${agulhas.chaveRecusadaEmBase64}`),
      {
        contexto: { certificado: { pfx: agulhas.chaveValidaEmBase64 } },
        chaveCrua: chaveValida,
        detalhes: { interno: [agulhas.chaveRecusadaEmHexadecimal] },
      },
    );
    controle.stack = `${controle.stack ?? ''}\n    at exigirChaveDeCifra (${SENTINELA_DA_SENHA})`;

    expect(agulhasEncontradas(controle, agulhas)).toEqual(Object.keys(agulhas));

    // (d) A ASSERÇÃO DE A6 PARA A SEGUNDA CLASSE DE ERRO: na recusa de verdade, a mesma varredura
    //     não acha nenhuma. A mensagem nomeia o desfecho e, no máximo, uma constante do módulo.
    expect(
      agulhasEncontradas(capturada, agulhas),
      'a recusa de chave inválida carrega valor que nunca deveria sair do módulo',
    ).toEqual([]);
  });

  it('CT-802 (d) — quadro com prefixo de senha incoerente é recusado, não fatiado no lugar errado', () => {
    const chave = chaveDeCifra();
    const corpo = Buffer.from(`${SENTINELA_DA_SENHA}|${SENTINELA_DO_MATERIAL}`, 'utf8');
    const bytesDaSenha = Buffer.byteLength(SENTINELA_DA_SENHA, 'utf8');

    // (a) O CONTROLE POSITIVO DA MONTAGEM: um quadro COERENTE forjado pelo mesmo caminho abre e
    //     devolve o par exato. Sem ele, um erro na forja (etiqueta fora de posição, vetor de porte
    //     diferente) faria o bloco (c) passar pelo motivo ERRADO — recusa do GCM, não da guarda.
    const quadroCoerente = quadroDeclarando(VERSAO_DO_QUADRO, bytesDaSenha, corpo);
    const coerente = decifrarSegredo(envelopeDoQuadro(quadroCoerente, chave), chave).abrir();
    expect(coerente.senha).toBe(SENTINELA_DA_SENHA);
    expect(coerente.material.toString('utf8')).toBe(`|${SENTINELA_DO_MATERIAL}`);

    // (b) A FRONTEIRA EXATA, do lado que ACEITA: a senha ocupando o quadro inteiro é coerente —
    //     `fimDaSenha === quadro.length`, material vazio. É o que impede a guarda de ser escrita
    //     como `>=` e passar a recusar um quadro legítimo.
    const noLimite = decifrarSegredo(
      envelopeDoQuadro(quadroDeclarando(VERSAO_DO_QUADRO, corpo.length, corpo), chave),
      chave,
    ).abrir();
    expect(noLimite.senha).toBe(corpo.toString('utf8'));
    expect(noLimite.material.length).toBe(0);

    // (c) A ASSERÇÃO: um único byte declarado a mais já é incoerente e é RECUSADO — e o maior
    //     uint32 possível também. O desfecho é nomeado, e não "levantou alguma coisa": fatiar no
    //     lugar errado devolveria material parcial como se fosse o certificado.
    const incoerentes = {
      'um byte a mais que o quadro': quadroDeclarando(VERSAO_DO_QUADRO, corpo.length + 1, corpo),
      'o maior uint32 possível': quadroDeclarando(VERSAO_DO_QUADRO, 0xffffffff, corpo),
    };
    expect(
      Object.fromEntries(
        Object.entries(incoerentes).map(([rotulo, quadro]) => [
          rotulo,
          nomeDoDesfecho(excecaoDe(() => decifrarSegredo(envelopeDoQuadro(quadro, chave), chave))),
        ]),
      ),
    ).toEqual({
      'um byte a mais que o quadro': 'ErroDeSegredoAdulterado',
      'o maior uint32 possível': 'ErroDeSegredoAdulterado',
    });

    // (d) O DISCRIMINADOR DA GUARDA DE COERÊNCIA: o envelope incoerente PASSA na autenticação do
    //     GCM — decifrado à mão, o quadro volta byte a byte. Logo a recusa de (c) vem da guarda de
    //     coerência, e cobre um caminho que a etiqueta comprovadamente NÃO alcança.
    const quadroIncoerente = quadroDeclarando(VERSAO_DO_QUADRO, corpo.length + 1, corpo);
    const bytes = Buffer.from(envelopeDoQuadro(quadroIncoerente, chave), 'base64');
    const decifrador = createDecipheriv(
      ALGORITMO_DA_CIFRA,
      chave,
      bytes.subarray(0, BYTES_DO_VETOR),
    );
    decifrador.setAuthTag(bytes.subarray(BYTES_DO_VETOR, BYTES_DO_VETOR + BYTES_DA_ETIQUETA));
    const autenticado = Buffer.concat([
      decifrador.update(bytes.subarray(BYTES_DO_VETOR + BYTES_DA_ETIQUETA)),
      decifrador.final(),
    ]);
    expect(autenticado.equals(quadroIncoerente)).toBe(true);

    // (e) O LAYOUT SE IDENTIFICA, e a conferência vem ANTES de qualquer fatiamento. Um quadro
    //     autêntico, coerente e bem formado cuja ÚNICA divergência é o byte de versão é recusado
    //     com desfecho PRÓPRIO — e não com o da adulteração, porque as duas coisas pedem ações
    //     opostas da operação: adulteração manda trocar a chave ou reenviar o certificado; layout
    //     desconhecido manda mexer no processo, não no dado.
    //     A última linha do mapa é a que prova a ORDEM: versão desconhecida SOMADA a prefixo
    //     incoerente responde pela versão, e não pela coerência. Inverter as duas guardas no
    //     produto reprova aqui.
    const layoutsDesconhecidos = {
      'a versão 0, anterior ao discriminador': quadroDeclarando(0, bytesDaSenha, corpo),
      'a versão 2, que a fatia (ii) escreverá': quadroDeclarando(
        VERSAO_DO_QUADRO + 1,
        bytesDaSenha,
        corpo,
      ),
      'a maior versão que cabe no campo': quadroDeclarando(0xff, bytesDaSenha, corpo),
      'versão desconhecida com prefixo TAMBÉM incoerente': quadroDeclarando(
        0xff,
        corpo.length + 1,
        corpo,
      ),
    };
    expect(
      Object.fromEntries(
        Object.entries(layoutsDesconhecidos).map(([rotulo, quadro]) => [
          rotulo,
          nomeDoDesfecho(excecaoDe(() => decifrarSegredo(envelopeDoQuadro(quadro, chave), chave))),
        ]),
      ),
    ).toEqual({
      'a versão 0, anterior ao discriminador': 'ErroDeVersaoDeEnvelopeDesconhecida',
      'a versão 2, que a fatia (ii) escreverá': 'ErroDeVersaoDeEnvelopeDesconhecida',
      'a maior versão que cabe no campo': 'ErroDeVersaoDeEnvelopeDesconhecida',
      'versão desconhecida com prefixo TAMBÉM incoerente': 'ErroDeVersaoDeEnvelopeDesconhecida',
    });
    for (const [rotulo, quadro] of Object.entries(layoutsDesconhecidos)) {
      expect(
        excecaoDe(() => decifrarSegredo(envelopeDoQuadro(quadro, chave), chave)),
        rotulo,
      ).toBeInstanceOf(ErroDeVersaoDeEnvelopeDesconhecida);
    }

    // (f) O DISCRIMINADOR DE (e), e é ele que liga a asserção ao defeito que ela persegue: o quadro
    //     da versão 2 difere do de (a) em EXATAMENTE UM BYTE, e é COERENTE pela guarda de
    //     comprimento. Logo a recusa não veio do GCM (o quadro autentica) nem da coerência (as
    //     contas fecham) — veio da conferência de versão, e cobre um caminho que as outras duas
    //     guardas comprovadamente NÃO alcançam.
    const daVersaoSeguinte = quadroDeclarando(VERSAO_DO_QUADRO + 1, bytesDaSenha, corpo);
    expect(daVersaoSeguinte.length).toBe(quadroCoerente.length);
    expect(
      daVersaoSeguinte.subarray(BYTES_DA_VERSAO).equals(quadroCoerente.subarray(BYTES_DA_VERSAO)),
    ).toBe(true);
    expect(daVersaoSeguinte[0]).not.toBe(quadroCoerente[0]);

    const declarado = daVersaoSeguinte.readUInt32BE(BYTES_DA_VERSAO);
    expect(INICIO_DA_SENHA + declarado).toBeLessThanOrEqual(daVersaoSeguinte.length);

    // …e, fatiado pelo layout corrente, ele produziria um par PLAUSÍVEL — senha inteira e material
    //     não vazio. É exatamente este desfecho que a conferência impede: entregar pedaços de um
    //     layout alheio como se fossem a senha e o certificado.
    expect({
      senha: daVersaoSeguinte.toString('utf8', INICIO_DA_SENHA, INICIO_DA_SENHA + declarado),
      material: daVersaoSeguinte.toString('utf8', INICIO_DA_SENHA + declarado),
    }).toEqual({ senha: SENTINELA_DA_SENHA, material: `|${SENTINELA_DO_MATERIAL}` });
  });

  it('CT-802 (e) — o menor envelope legítimo abre, e quadro curto demais é recusado com nome', () => {
    const chave = chaveDeCifra();

    // (a) A FRONTEIRA EXATA DO LADO QUE ACEITA, e é ela que ancora o número: o menor segredo
    //     possível — senha vazia e material vazio — produz, pela API pública, um envelope de
    //     exatamente `vetor + etiqueta + versão + prefixo` bytes, e ele abre devolvendo o par
    //     vazio. Uma guarda de porte mínimo calculada grande demais recusaria este envelope
    //     LEGÍTIMO, e é isto que a asserção pega — o byte de versão a deslocou, e nada mais amarra
    //     o número.
    const menor = cifrarSegredo(
      criarSegredoOperavel({ material: Buffer.alloc(0), senha: '' }),
      chave,
    );
    expect(Buffer.from(menor, 'base64').length).toBe(
      BYTES_DO_VETOR + BYTES_DA_ETIQUETA + INICIO_DA_SENHA,
    );

    const aberto = decifrarSegredo(menor, chave).abrir();
    expect(aberto.senha).toBe('');
    expect(aberto.material.length).toBe(0);

    // (b) A ASSERÇÃO, do lado que RECUSA: envelopes AUTÊNTICOS cujo quadro é curto demais para
    //     carregar os dois campos de comprimento fixo são recusados com o desfecho deste domínio —
    //     e não com o `RangeError` cru do runtime, que é o que sobra quando a guarda de porte é
    //     calculada pequena demais e a leitura de posição fixa cai fora do buffer, chegando à borda
    //     sem nome de domínio.
    //     Os três carregam a versão CERTA quando têm espaço para ela: assim o único desfecho
    //     possível é o da guarda de porte, e não o da conferência de layout.
    const curtos = {
      'quadro vazio': Buffer.alloc(0),
      'só o byte de versão': Buffer.from([VERSAO_DO_QUADRO]),
      'a versão certa e o prefixo truncado em um byte': Buffer.concat([
        Buffer.from([VERSAO_DO_QUADRO]),
        Buffer.alloc(BYTES_DO_PREFIXO_DA_SENHA - 1),
      ]),
    };
    expect(
      Object.fromEntries(
        Object.entries(curtos).map(([rotulo, quadro]) => [
          rotulo,
          nomeDoDesfecho(excecaoDe(() => decifrarSegredo(envelopeDoQuadro(quadro, chave), chave))),
        ]),
      ),
    ).toEqual({
      'quadro vazio': 'ErroDeSegredoAdulterado',
      'só o byte de versão': 'ErroDeSegredoAdulterado',
      'a versão certa e o prefixo truncado em um byte': 'ErroDeSegredoAdulterado',
    });

    // (c) O CONTROLE DA MONTAGEM DE (b): um quadro com EXATAMENTE o cabeçalho, forjado pelo mesmo
    //     caminho, é aceito e devolve o par vazio. Sem ele, um erro na forja faria (b) passar pelo
    //     motivo errado — recusa do GCM, não da guarda de porte.
    const soOCabecalho = decifrarSegredo(
      envelopeDoQuadro(quadroDeclarando(VERSAO_DO_QUADRO, 0, Buffer.alloc(0)), chave),
      chave,
    ).abrir();
    expect(soOCabecalho.senha).toBe('');
    expect(soOCabecalho.material.length).toBe(0);
  });

  it('CT-802 (f) — as TRÊS classes de erro do módulo têm A6 provado, e o roteiro é conferido contra o que o módulo exporta', () => {
    const chaveQueCifrou = chaveDeCifra();
    const chaveAlheia = chaveDeCifra();
    const chaveCurta = randomBytes(COMPRIMENTOS_DE_CHAVE_RECUSADOS[0]);
    const material = materialSintetico(SENTINELA_DO_MATERIAL);
    const segredo = criarSegredoOperavel({ material, senha: SENTINELA_DA_SENHA });
    const envelope = cifrarSegredo(segredo, chaveQueCifrou);

    // O envelope de layout desconhecido carrega o par em claro DENTRO do quadro, e é isto que
    // distingue a terceira classe das outras duas: ela é levantada de dentro de `decompor`, com o
    // quadro **já decifrado** na mão — o único ponto do módulo em que senha e material existem em
    // claro fora do invólucro. Nas outras duas o corpo sequer chegou a ser decifrado, de modo que
    // ali não havia claro para vazar; aqui há, e por isso a varredura precisa alcançá-la.
    const corpo = Buffer.from(`${SENTINELA_DA_SENHA}|${SENTINELA_DO_MATERIAL}`, 'utf8');
    const daVersaoSeguinte = envelopeDoQuadro(
      quadroDeclarando(VERSAO_DO_QUADRO + 1, Buffer.byteLength(SENTINELA_DA_SENHA, 'utf8'), corpo),
      chaveQueCifrou,
    );

    const agulhasDaAdulteracao = {
      material: SENTINELA_DO_MATERIAL,
      senha: SENTINELA_DA_SENHA,
      chaveQueCifrouEmBase64: chaveQueCifrou.toString('base64'),
      chaveQueCifrouEmHexadecimal: chaveQueCifrou.toString('hex'),
      chaveAlheiaEmBase64: chaveAlheia.toString('base64'),
      chaveAlheiaEmHexadecimal: chaveAlheia.toString('hex'),
    } as const;

    const agulhasDaChaveInvalida = {
      material: SENTINELA_DO_MATERIAL,
      senha: SENTINELA_DA_SENHA,
      chaveValidaEmBase64: chaveQueCifrou.toString('base64'),
      chaveValidaEmHexadecimal: chaveQueCifrou.toString('hex'),
      chaveCurtaEmBase64: chaveCurta.toString('base64'),
      chaveCurtaEmHexadecimal: chaveCurta.toString('hex'),
    } as const;

    const agulhasDaVersaoDesconhecida = {
      material: SENTINELA_DO_MATERIAL,
      senha: SENTINELA_DA_SENHA,
      chaveEmBase64: chaveQueCifrou.toString('base64'),
      chaveEmHexadecimal: chaveQueCifrou.toString('hex'),
    } as const;

    // O ROTEIRO — uma entrada por classe de erro publicada, cada uma com o caminho legítimo que a
    // levanta, o que nunca pode sair dela, e o controle onde essas agulhas foram plantadas.
    const roteiro: readonly ProvaDeA6[] = [
      {
        nome: 'ErroDeSegredoAdulterado',
        classe: ErroDeSegredoAdulterado,
        produzir: () => decifrarSegredo(envelope, chaveAlheia),
        agulhas: agulhasDaAdulteracao,
        controle: controleComAgulhas({
          naMensagem: [agulhasDaAdulteracao.material, agulhasDaAdulteracao.chaveAlheiaEmBase64],
          naPilha: agulhasDaAdulteracao.senha,
          emPropriedadeAninhada: agulhasDaAdulteracao.chaveQueCifrouEmBase64,
          comoBufferCru: chaveQueCifrou,
          emArrayAninhado: [agulhasDaAdulteracao.chaveAlheiaEmHexadecimal],
        }),
      },
      {
        nome: 'ErroDeChaveDeCifraInvalida',
        classe: ErroDeChaveDeCifraInvalida,
        produzir: () => cifrarSegredo(segredo, chaveCurta),
        agulhas: agulhasDaChaveInvalida,
        controle: controleComAgulhas({
          naMensagem: [agulhasDaChaveInvalida.material, agulhasDaChaveInvalida.chaveCurtaEmBase64],
          naPilha: agulhasDaChaveInvalida.senha,
          emPropriedadeAninhada: agulhasDaChaveInvalida.chaveValidaEmBase64,
          comoBufferCru: chaveQueCifrou,
          emArrayAninhado: [agulhasDaChaveInvalida.chaveCurtaEmHexadecimal],
        }),
      },
      {
        nome: 'ErroDeVersaoDeEnvelopeDesconhecida',
        classe: ErroDeVersaoDeEnvelopeDesconhecida,
        produzir: () => decifrarSegredo(daVersaoSeguinte, chaveQueCifrou),
        agulhas: agulhasDaVersaoDesconhecida,
        // Quatro agulhas, e não seis: neste caminho existe **uma** chave — a que cifrou é a mesma
        // que foi apresentada. Plantar uma segunda chave que o fluxo não tem faria o controle
        // crescer sem que a asserção discriminasse mais nada. O canal do array aninhado fica, por
        // isso, exercido pelas duas entradas acima.
        controle: controleComAgulhas({
          naMensagem: [agulhasDaVersaoDesconhecida.material],
          naPilha: agulhasDaVersaoDesconhecida.senha,
          emPropriedadeAninhada: agulhasDaVersaoDesconhecida.chaveEmBase64,
          comoBufferCru: chaveQueCifrou,
          emArrayAninhado: [],
        }),
      },
    ];

    // (a) A ÂNCORA DE COMPLETUDE, e é ela que fecha a classe do defeito em vez de um caso dele: o
    //     conjunto das classes de erro que o módulo **exporta** é conferido contra o roteiro, e os
    //     dois contra uma lista literal. Uma quarta classe publicada sem entrada no roteiro reprova
    //     aqui, nomeando-a — que é exatamente o que faltou quando a segunda e a terceira nasceram
    //     fora da varredura de A6, uma em cada rodada.
    const ehClasseDeErro = (valor: unknown): boolean =>
      typeof valor === 'function' && valor.prototype instanceof Error;
    const classesDeErroExportadas = Object.entries(moduloDoSegredoOperavel)
      .filter(([, valor]) => ehClasseDeErro(valor))
      .map(([nome]) => nome)
      .sort();

    const AS_TRES_CLASSES_DE_ERRO = [
      'ErroDeChaveDeCifraInvalida',
      'ErroDeSegredoAdulterado',
      'ErroDeVersaoDeEnvelopeDesconhecida',
    ];
    expect(
      classesDeErroExportadas,
      'o módulo publica classe de erro que o roteiro de A6 não cobre — toda classe nova precisa de ' +
        'entrada aqui, com produtor, agulhas e controle',
    ).toEqual(AS_TRES_CLASSES_DE_ERRO);
    expect(roteiro.map((prova) => prova.nome).sort()).toEqual(AS_TRES_CLASSES_DE_ERRO);

    // (b) O CONTROLE POSITIVO DO ROTEIRO: cada produtor levanta **a classe que a entrada declara**.
    //     Sem isto, um produtor apontado para o caminho errado faria (d) varrer a exceção de outra
    //     classe e a terceira continuaria sem prova, com o caso verde.
    const capturadas = roteiro.map((prova) => ({ ...prova, erro: excecaoDe(prova.produzir) }));
    expect(
      Object.fromEntries(
        capturadas.map((prova) => [
          prova.nome,
          { desfecho: nomeDoDesfecho(prova.erro), daClasse: prova.erro instanceof prova.classe },
        ]),
      ),
    ).toEqual({
      ErroDeSegredoAdulterado: { desfecho: 'ErroDeSegredoAdulterado', daClasse: true },
      ErroDeChaveDeCifraInvalida: { desfecho: 'ErroDeChaveDeCifraInvalida', daClasse: true },
      ErroDeVersaoDeEnvelopeDesconhecida: {
        desfecho: 'ErroDeVersaoDeEnvelopeDesconhecida',
        daClasse: true,
      },
    });

    // (c) O CONTROLE POSITIVO DA VARREDURA, classe a classe e **canal a canal**: a mesma busca que
    //     (d) usa acha TODAS as agulhas quando elas estão lá. O número por classe é conteúdo — seis
    //     onde o caminho tem duas chaves, quatro onde tem uma — e está escrito por extenso de
    //     propósito: derivar o esperado do próprio mapa esconderia uma varredura que perdeu um canal.
    expect(
      Object.fromEntries(
        capturadas.map((prova) => [prova.nome, agulhasEncontradas(prova.controle, prova.agulhas)]),
      ),
    ).toEqual({
      ErroDeSegredoAdulterado: [
        'material',
        'senha',
        'chaveQueCifrouEmBase64',
        'chaveQueCifrouEmHexadecimal',
        'chaveAlheiaEmBase64',
        'chaveAlheiaEmHexadecimal',
      ],
      ErroDeChaveDeCifraInvalida: [
        'material',
        'senha',
        'chaveValidaEmBase64',
        'chaveValidaEmHexadecimal',
        'chaveCurtaEmBase64',
        'chaveCurtaEmHexadecimal',
      ],
      ErroDeVersaoDeEnvelopeDesconhecida: [
        'material',
        'senha',
        'chaveEmBase64',
        'chaveEmHexadecimal',
      ],
    });

    // (d) A ASSERÇÃO DE A6, agora sobre as TRÊS: nenhuma superfície de nenhuma delas — texto,
    //     mensagem, pilha, propriedades próprias, inspeção profunda, serialização — carrega o claro
    //     nem chave nenhuma. A entrada da versão desconhecida é a que morde: ela nasce com o quadro
    //     decifrado disponível, e passar esse quadro à exceção é uma linha de distância.
    expect(
      Object.fromEntries(
        capturadas.map((prova) => [prova.nome, agulhasEncontradas(prova.erro, prova.agulhas)]),
      ),
      'uma exceção do segredo operável carrega valor que nunca deveria sair do módulo',
    ).toEqual({
      ErroDeSegredoAdulterado: [],
      ErroDeChaveDeCifraInvalida: [],
      ErroDeVersaoDeEnvelopeDesconhecida: [],
    });
  });
});

describe('opacidade do invólucro do segredo operável', () => {
  it('CT-803 — as três formas de serialização devolvem a sentinela, e nenhuma expõe o segredo', () => {
    const material = materialSintetico(SENTINELA_DO_MATERIAL);
    const senha = SENTINELA_DA_SENHA;
    const involucro = criarSegredoOperavel({ material, senha });

    // (a) O CONTROLE POSITIVO DO INVÓLUCRO: ele de fato CARREGA o par em claro. Sem esta linha,
    //     um invólucro vazio passaria em todas as asserções de opacidade abaixo sem redigir nada.
    expect(involucro.abrir().material.equals(material)).toBe(true);
    expect(involucro.abrir().senha).toBe(senha);

    // (b) AS TRÊS FORMAS, por igualdade literal — mais o invólucro ANINHADO em outro objeto, que é
    //     como ele chegaria a um registro estruturado ou a um corpo de resposta.
    const saidas = {
      texto: String(involucro),
      interpolacao: `${involucro}`,
      json: JSON.stringify(involucro),
      jsonAninhado: JSON.stringify({ certificado: involucro }),
      inspecao: inspect(involucro, { depth: null }),
      inspecaoAninhada: inspect({ certificado: involucro }, { depth: null }),
    };

    expect(saidas).toEqual({
      texto: SENTINELA_REDIGIDO,
      interpolacao: SENTINELA_REDIGIDO,
      json: `"${SENTINELA_REDIGIDO}"`,
      jsonAninhado: `{"certificado":"${SENTINELA_REDIGIDO}"}`,
      inspecao: SENTINELA_REDIGIDO,
      inspecaoAninhada: `{ certificado: ${SENTINELA_REDIGIDO} }`,
    });

    // (c) O CONTROLE POSITIVO DA BUSCA POR SENTINELA: as mesmas seis formas, aplicadas ao par
    //     carregado por um objeto comum — sem invólucro —, acham o claro em **quatro** delas. Não
    //     nas seis, e o número é conteúdo: `String` e a interpolação de um objeto comum devolvem
    //     `[object Object]`, de modo que esses dois canais nunca carregariam a agulha por essa via.
    //     São exatamente os dois que o bloco (b) já fecha por igualdade literal.
    const semInvolucro = { certificado: { pfx: material.toString('latin1'), passphrase: senha } };
    const formasDe = (valor: unknown): readonly string[] => [
      String(valor),
      `${valor}`,
      JSON.stringify(valor) ?? '',
      JSON.stringify({ certificado: valor }) ?? '',
      inspect(valor, { depth: null, maxStringLength: null }),
      inspect({ certificado: valor }, { depth: null, maxStringLength: null }),
    ];
    const quantasFormasCarregam = (valor: unknown, agulha: string): number =>
      formasDe(valor).filter((forma) => forma.includes(agulha)).length;

    expect(quantasFormasCarregam(semInvolucro, SENTINELA_DO_MATERIAL)).toBe(4);
    expect(quantasFormasCarregam(semInvolucro, SENTINELA_DA_SENHA)).toBe(4);

    // (d) A ASSERÇÃO: com invólucro, nenhuma das seis formas carrega qualquer das sentinelas.
    expect(quantasFormasCarregam(involucro, SENTINELA_DO_MATERIAL)).toBe(0);
    expect(quantasFormasCarregam(involucro, SENTINELA_DA_SENHA)).toBe(0);

    // (e) NÃO HÁ ENUMERAÇÃO NEM ESPALHAMENTO que alcance o conteúdo — é o que os campos privados
    //     de classe compram, e é o caminho por onde um serializador de registro copiaria os campos.
    expect(Object.keys(involucro)).toEqual([]);
    expect(Object.getOwnPropertyNames(involucro)).toEqual([]);
    expect({ ...involucro }).toEqual({});
    expect(JSON.stringify({ ...involucro })).toBe('{}');
  });

  it('CT-803 (b) — o módulo não lê o ambiente em ponto nenhum', () => {
    const fonte = readFileSync(
      join(import.meta.dirname, '..', 'src', 'segredo-operavel.ts'),
      'utf8',
    );

    /** Os dois caminhos pelos quais um módulo alcançaria o ambiente do processo. */
    const LEITURAS_DO_AMBIENTE: readonly [string, RegExp][] = [
      ['process.env', /process\s*\.\s*env/],
      ["import de 'node:process'", /from\s+'node:process'/],
    ];

    /**
     * Retira comentários antes de varrer — a varredura é sobre **código executável**.
     *
     * Sem isto ela acusaria o próprio docblock do módulo, que explica por escrito por que a chave
     * **não** é lida de `process.env`. Uma asserção que proíbe a menção em prosa cobraria o preço
     * errado: apagar a explicação da decisão para o teste passar é exatamente o que o Protocolo
     * Antirregressão existe para impedir.
     */
    const semComentarios = (texto: string): string =>
      texto.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

    const alcancadas = (texto: string): string[] =>
      LEITURAS_DO_AMBIENTE.filter(([, expressao]) => expressao.test(semComentarios(texto))).map(
        ([nome]) => nome,
      );

    // O CONTROLE POSITIVO da asserção estática: aplicada a um fonte que LÊ o ambiente, ela acusa
    // as duas formas. Sem ele, uma expressão quebrada devolveria lista vazia para qualquer entrada.
    const fonteDeControle = [
      "import { env } from 'node:process';",
      'const chave = process.env.CHAVE_DE_CIFRA_DO_CERTIFICADO;',
    ].join('\n');
    expect(alcancadas(fonteDeControle)).toEqual(['process.env', "import de 'node:process'"]);

    // …e o CONTROLE NEGATIVO do descomentador, que é a outra metade: menção em prosa não acusa, e
    // é isso que impede o filtro de virar um "sempre vazio" que aprovaria qualquer fonte.
    const fonteSoComMencao = [
      '/** Quem lê `process.env` é a conferência de partida. */',
      "// nada aqui toca from 'node:process'",
      'export const chave = (v: Buffer) => v;',
    ].join('\n');
    expect(alcancadas(fonteSoComMencao)).toEqual([]);

    // A ASSERÇÃO: a chave chega por parâmetro, e o módulo não tem uma segunda fonte para ela.
    expect(
      alcancadas(fonte),
      'o segredo operável passou a ler o ambiente — a chave chega por parâmetro, e um segundo ' +
        'leitor escaparia da conferência de partida',
    ).toEqual([]);
  });
});

/**
 * CA-D36 → CT-520..CT-524 (RN-32) — o VALOR operável, irmão do par.
 *
 * INVARIANTES
 * - o valor volta íntegro depois do ciclo, e só com a chave certa;
 * - dois envelopes do MESMO valor diferem — sem isso, a coluna denuncia por igualdade quem
 *   registrou o mesmo identificador;
 * - adulteração e chave errada LEVANTAM, nunca devolvem texto;
 * - o quadro do valor tem versão PRÓPRIA: um envelope do par não se abre como valor. É o que
 *   impede que os dois formatos sejam confundidos, e é a razão de o byte de versão existir.
 */
describe('CT-520 — o valor operável cifrado', () => {
  const CHAVE = Buffer.alloc(32, 7);
  const OUTRA_CHAVE = Buffer.alloc(32, 9);
  const VALOR = 'identificador-da-aplicacao-1947';

  it('CT-520 — o valor volta íntegro depois do ciclo', () => {
    expect(decifrarValorOperavel(cifrarValorOperavel(VALOR, CHAVE), CHAVE)).toBe(VALOR);
  });

  it('CT-521 — dois envelopes do mesmo valor são diferentes', () => {
    expect(cifrarValorOperavel(VALOR, CHAVE)).not.toBe(cifrarValorOperavel(VALOR, CHAVE));
  });

  it('CT-522 — a chave errada LEVANTA, e não devolve texto', () => {
    const envelope = cifrarValorOperavel(VALOR, CHAVE);
    expect(() => decifrarValorOperavel(envelope, OUTRA_CHAVE)).toThrow();
  });

  it('CT-523 — envelope adulterado LEVANTA', () => {
    const bytes = Buffer.from(cifrarValorOperavel(VALOR, CHAVE), 'base64');
    const ultimo = bytes.length - 1;
    bytes.writeUInt8(bytes.readUInt8(ultimo) ^ 0xff, ultimo);
    expect(() => decifrarValorOperavel(bytes.toString('base64'), CHAVE)).toThrow();
    expect(() => decifrarValorOperavel('', CHAVE)).toThrow();
  });

  it('CT-524 — o envelope do PAR não se abre como valor (versões próprias)', () => {
    const doPar = cifrarSegredo(
      criarSegredoOperavel({ material: Buffer.from('material'), senha: 'senha' }),
      CHAVE,
    );
    expect(() => decifrarValorOperavel(doPar, CHAVE)).toThrow();
  });
});
