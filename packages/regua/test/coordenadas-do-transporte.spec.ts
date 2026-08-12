/**
 * As coordenadas do transporte de e-mail — **CT-641 e CT-642**, da T6 da fatia `regua-de-cobranca`.
 *
 * ===========================================================================
 * INVARIANTES
 * ===========================================================================
 *
 * | Critério | Caso   | Invariante |
 * |----------|--------|------------|
 * | CA-17    | CT-641 | O objeto de opções de uma `SMTP_URL` completa é, por **igualdade estrita**,
 * | (aceite  | (a)    | `{host, port, secure, auth, connectionTimeout, greetingTimeout, socketTimeout}` —
 * |  téc. 9) |        | com os três limites **iguais às constantes nomeadas**, elas próprias iguais aos
 * |          |        | valores declarados (10 s e 20 s), e **sem** chave `url`, que é o que faz o
 * |          |        | objeto sobreviver inteiro ao `createTransport`. |
 * | CA-17    | CT-641 | Porta e modo são **escritos** a partir do esquema quando a URL os omite
 * |          | (b)    | (`smtp:` ⇒ 587/`false`, `smtps:` ⇒ 465/`true`), nunca deixados para o padrão
 * |          |        | implícito da biblioteca; URL sem credencial **não** produz `auth`. |
 * | CA-17    | CT-641 | O adaptador de produção entrega ao `createTransport` a **chamada inteira** das
 * |          | (c)    | coordenadas, e **uma só vez** — igualdade sobre a lista de argumentos extraída
 * |          |        | do fonte. Um literal de objeto ali (a forma que descartava os limites)
 * |          |        | reprova. |
 * | CA-17    | CT-642 | Cada uma das **três formas medidas** de `SMTP_URL` inutilizável, mais o esquema
 * | (aceite  | (a)    | alheio, o endereço sem servidor e a cadeia vazia, é **recusada**; a mensagem é
 * |  téc. 10)|        | comparada contra o **literal escrito neste arquivo** — nunca contra a constante
 * |          |        | do fonte —, o nome da variável é **ancorado** por valor, e o erro inteiro
 * |          |        | **não contém o valor** recusado. |
 * | CA-17    | CT-642 | O par positivo: as URLs legítimas do CT-641 **não** são recusadas — a lista de
 * |          | (b)    | desfechos é comparada por igualdade, e uma recusa que reprovasse tudo cairia
 * |          |        | aqui. |
 *
 * Rastreabilidade: `CA-17 → CT-641, CT-642 (RN-15/RD-15)`.
 *
 * ===========================================================================
 * POR QUE ESTES CASOS EXERCITAM A FUNÇÃO PURA, E NÃO O ADAPTADOR
 * ===========================================================================
 *
 * Pela CA-17, o adaptador de produção é o **único** módulo do produto que arquivo de teste nenhum
 * pode nomear: `packages/db/test/barreira-de-envio.spec.ts` afirma, por igualdade sobre a árvore
 * inteira, que quem liga aquele símbolo são apenas quem o define e quem o publica. A contrapartida
 * honesta desse desenho é que o defeito que o Gate 2 mediu — os três limites nomeados **não**
 * alcançando o transporte — não tinha como ser provado por efeito.
 *
 * A saída **não** é abrir uma exceção na barreira, nem construir transporte aqui para inspecioná-lo:
 * um `createTransport` num arquivo de teste é exatamente o objeto capaz de entregar mensagem a uma
 * pessoa real, e tê-lo aqui contornaria o espírito da CA-17 sem acender a asserção que a guarda. A
 * saída é **topológica**: a parte pura mora em `../src/coordenadas-do-transporte.ts`, este arquivo a
 * exercita, e nem o nome do adaptador nem o caminho do módulo dele aparecem no fonte — o caminho do
 * `CT-641 (c)` é montado por **concatenação**, o mesmo idioma que a barreira usa para não acusar a
 * si mesma. Nenhuma das âncoras daquele arquivo muda de valor por causa deste.
 *
 * ⚠️ **Nenhuma cadeia aqui aponta para servidor que exista.** Os endereços usam o TLD reservado
 * `.test` (RFC 2606), e os valores de credencial são inventados — o que se prova é a forma do objeto
 * e a recusa, e nada nesta suíte abre socket.
 */

import { readFile } from 'node:fs/promises';
import { inspect } from 'node:util';
import { describe, expect, it } from 'vitest';
import {
  type CoordenadasDoTransporte,
  coordenadasDoTransporte,
  LIMITE_DE_CONEXAO_MS,
  LIMITE_DE_ENVIO_MS,
  VARIAVEL_DO_TRANSPORTE,
} from '../src/coordenadas-do-transporte.ts';

/**
 * O caminho do fonte do adaptador, **partido** — ver o cabeçalho.
 *
 * Escrito inteiro, este literal faria o detector de `barreira-de-envio.spec.ts` acusar este arquivo
 * pelo fato 2 (o caminho do módulo dentro de um literal de string), e a âncora de segurança
 * reprovaria o repositório íntegro. A cadeia só existe montada, em tempo de execução.
 */
const FONTE_DO_ADAPTADOR = new URL(`../src/adaptador${'-'}smtp.ts`, import.meta.url);

/** A função da biblioteca cujo argumento está sob prova no `CT-641 (c)`. */
const CONSTRUTOR_DO_TRANSPORTE = 'createTransport';

/**
 * O argumento que o adaptador deve passar — a **chamada inteira**, e nada ao lado dela.
 *
 * É esta igualdade que fecha a classe do defeito, e não apenas a ocorrência: qualquer literal de
 * objeto ali (com ou sem a chave `url`) muda o texto extraído e reprova, porque toda opção passada
 * ao lado de `url` é descartada pelo `createTransport` — e uma opção acrescentada sem `url` deixaria
 * de estar sob a igualdade do `CT-641 (a)`, que é quem prova que os limites chegam.
 */
const ARGUMENTO_ESPERADO = 'coordenadasDoTransporte(config.urlDoTransporte)';

// DECISÃO FECHADA — T6 / Gate 1 rodada 6 · 2026-08-12
// O QUÊ: as duas metades da mensagem de recusa são LITERAIS escritos neste arquivo. Nenhuma delas é
//        importada de `../src/coordenadas-do-transporte.ts`, e a duplicação do texto é deliberada.
// POR QUÊ: montada com as constantes do módulo sob prova, a igualdade do `CT-642 (a)` movia as duas
//          pontas juntas — provava a FORMA `<motivo>: <variável>` e nenhum dos dois conteúdos. Três
//          mutantes medidos sobreviviam em 19/19 verde: `VARIAVEL_DO_TRANSPORTE = 'SMTP_URI'`, o
//          motivo trocado por `'xyz'`, e o motivo trocado pelo texto da recusa por variável **não
//          declarada** — este último apagando a distinção que a constante existe para carregar. É a
//          mesma classe já fechada nos limites de tempo, nove linhas acima, de volta por outro
//          caminho; e nenhum outro arquivo da árvore asserta estes literais.
// REVERTER EXIGE: demonstrar que a suíte reprova os três mutantes acima SEM o literal escrito aqui —
//                 isto é, que existe outro oráculo do texto publicado, fora do módulo sob prova.
//                 "Evitar a duplicação" não satisfaz o requisito: é a duplicação que discrimina.

/**
 * O nome da variável que a recusa publica — o que o operador procura no `EnvironmentFile`.
 */
const VARIAVEL_ESPERADA = 'SMTP_URL';

/**
 * O motivo da recusa por **forma**, palavra por palavra — o oráculo mora no teste, não no SUT.
 *
 * A distinção que este texto carrega é conteúdo, e não estilo: *"declarada e não serve como
 * transporte"* é um diagnóstico diferente de *"não declarada"*, e a segunda mensagem nasceu do
 * achado `BAIXO-002` do Gate 1 justamente para não confundir os dois eixos.
 */
const MOTIVO_ESPERADO =
  'o adaptador de e-mail não é construído com esta variável em forma que não serve de transporte';

/** A mensagem literal da recusa por forma — nomeia a variável, jamais o valor. */
const RECUSA_ESPERADA = `${MOTIVO_ESPERADO}: ${VARIAVEL_ESPERADA}`;

/** Os três limites, como toda coordenada legítima os carrega. */
const LIMITES_DECLARADOS = {
  connectionTimeout: LIMITE_DE_CONEXAO_MS,
  greetingTimeout: LIMITE_DE_CONEXAO_MS,
  socketTimeout: LIMITE_DE_ENVIO_MS,
} as const;

/** Uma `SMTP_URL` completa: esquema simples, credencial escapada e porta explícita. */
const URL_COMPLETA = 'smtp://usuario:se%40nha@mail.exemplo.test:2525';

/**
 * As formas de `SMTP_URL` sob prova, com o desfecho esperado de cada uma.
 *
 * As três primeiras são as **medidas pelo Gate 2** nesta árvore, e é por elas que a barreira
 * anterior deixava passar: nenhuma é a cadeia vazia, todas atravessavam o parse tolerante do
 * `nodemailer`, e o `SMTPConnection` então resolvia `localhost:587`. As três seguintes fecham o que
 * o `URL` **aceita e não serve**. As duas últimas são o par positivo — sem elas, uma recusa que
 * reprovasse tudo passaria por barreira correta.
 */
const FORMAS_DA_SMTP_URL: readonly {
  readonly rotulo: string;
  readonly cadeia: string;
  readonly recusada: boolean;
}[] = [
  { rotulo: 'host:porta sem esquema', cadeia: 'localhost:2525', recusada: true },
  { rotulo: 'palavra solta', cadeia: 'nonsense', recusada: true },
  {
    rotulo: 'aspas retidas pelo EnvironmentFile',
    cadeia: '"smtp://usuario:se%40nha@mail.exemplo.test:587"',
    recusada: true,
  },
  { rotulo: 'esquema alheio ao e-mail', cadeia: 'http://mail.exemplo.test', recusada: true },
  { rotulo: 'esquema certo sem servidor', cadeia: 'smtp://', recusada: true },
  { rotulo: 'cadeia vazia', cadeia: '', recusada: true },
  { rotulo: 'transporte simples completo', cadeia: URL_COMPLETA, recusada: false },
  { rotulo: 'transporte sobre TLS', cadeia: 'smtps://mail.exemplo.test', recusada: false },
];

/**
 * O fonte com os comentários fora — a mesma operação que `packages/db/test/varredura-de-fontes.ts`
 * publica, reescrita aqui porque a fronteira de pacote a torna inalcançável.
 *
 * `@sysloc/regua` **não pode** depender de `@sysloc/db`, nem em `devDependencies`: o Turborepo aborta
 * com `Cyclic dependency detected` (medido na T4). A duplicação é de seis linhas e não divergível em
 * consequência — ela existe para que a prosa que explica a decisão não seja confundida com código,
 * que é o defeito registrado em `.claude/rules/testing-stack.md`.
 */
function semComentarios(fonte: string): string {
  return fonte
    .replace(/\/\*[\s\S]*?\*\//g, (bloco) => bloco.replace(/[^\n]/g, ' '))
    .replace(/\/\/[^\n]*/g, '');
}

/**
 * Os argumentos, normalizados, de cada chamada a uma função no fonte — por **balanceamento de
 * parênteses**, e não por casamento de linha.
 *
 * A escolha é medida contra a alternativa óbvia: comparar a linha inteira quebraria com a primeira
 * reformatação do Biome, que é o seletor frágil que o Gate 1 já anotou nesta task. Aqui, o que se
 * afirma é o **texto do argumento**, sobrevivente a indentação e a comentário — as duas coisas que
 * o `semComentarios` e o colapso de espaço em branco absorvem.
 *
 * ⚠️ **Ele NÃO sobrevive à quebra de linha do argumento**, e a afirmação anterior de que sobrevivia
 * era falsa: medida pelo Gate 1, a reformatação multilinha do Biome produz
 * `coordenadasDoTransporte(config.urlDoTransporte),` — **com a vírgula pendente** —, e a igualdade
 * reprova. O modo de falha fica registrado em vez de corrigido porque ele é **ruidoso e fecha para
 * o lado seguro**: falso positivo que nomeia o argumento extraído, nunca falso negativo que deixe
 * o defeito passar. A linha do ponto de chamada tem 86 dos 100 caracteres de `lineWidth`, de modo
 * que a reformatação não acontece hoje; normalizar a vírgula final compraria a afirmação forte ao
 * preço de tornar a extração tolerante a uma diferença que ela existe para enxergar.
 */
function argumentosDasChamadas(fonte: string, funcao: string): string[] {
  const codigo = semComentarios(fonte);
  const abertura = `${funcao}(`;
  const chamadas: string[] = [];

  let inicio = codigo.indexOf(abertura);
  while (inicio >= 0) {
    let profundidade = 0;
    let fim = inicio + abertura.length - 1;
    for (; fim < codigo.length; fim += 1) {
      const caractere = codigo[fim];
      if (caractere === '(') {
        profundidade += 1;
      } else if (caractere === ')') {
        profundidade -= 1;
        if (profundidade === 0) {
          break;
        }
      }
    }

    if (fim >= codigo.length) {
      throw new Error(`chamada a ${funcao} sem parêntese de fechamento no fonte sob prova`);
    }

    chamadas.push(
      codigo
        .slice(inicio + abertura.length, fim)
        .replace(/\s+/g, ' ')
        .trim(),
    );
    inicio = codigo.indexOf(abertura, fim);
  }

  return chamadas;
}

/** O desfecho observado de uma cadeia: recusada com a mensagem canônica, ou aceita. */
function desfechoDe(cadeia: string): { readonly recusada: boolean; readonly erro: unknown } {
  try {
    coordenadasDoTransporte(cadeia);

    return { recusada: false, erro: undefined };
  } catch (erro) {
    return { recusada: true, erro };
  }
}

describe('CT-641 — as coordenadas do transporte carregam os limites até o transporte', () => {
  it('CT-641 (a) — a URL completa vira o objeto de opções INTEIRO, com os três limites nomeados', () => {
    // Os VALORES, antes da ligação. Sem estas duas linhas a igualdade abaixo compara o campo contra
    // a mesma constante que o fonte usa — e trocar `20_000` por outro número deixaria as duas pontas
    // iguais e a suíte verde. Medido: o mutante do limite de envio SOBREVIVEU até esta asserção
    // existir. Os dois números são contrato da task (§3.2: conexão 10 s, envio 20 s), e não detalhe
    // de implementação: quem os mudar muda quanto tempo um servidor mudo segura o job da régua.
    expect(LIMITE_DE_CONEXAO_MS).toBe(10_000);
    expect(LIMITE_DE_ENVIO_MS).toBe(20_000);

    expect(coordenadasDoTransporte(URL_COMPLETA)).toStrictEqual({
      host: 'mail.exemplo.test',
      port: 2525,
      secure: false,
      // A credencial chega **decodificada**, como o parse antigo a entregava: `se%40nha` é `se@nha`.
      // Perdê-la aqui quebraria a autenticação sem que nenhuma outra asserção acusasse.
      auth: { user: 'usuario', pass: 'se@nha' },
      ...LIMITES_DECLARADOS,
    } satisfies CoordenadasDoTransporte);
  });

  it('CT-641 (b) — porta e modo são escritos a partir do esquema, e sem credencial não há `auth`', () => {
    expect(coordenadasDoTransporte('smtp://mail.exemplo.test')).toStrictEqual({
      host: 'mail.exemplo.test',
      port: 587,
      secure: false,
      ...LIMITES_DECLARADOS,
    } satisfies CoordenadasDoTransporte);

    expect(coordenadasDoTransporte('smtps://mail.exemplo.test')).toStrictEqual({
      host: 'mail.exemplo.test',
      port: 465,
      secure: true,
      ...LIMITES_DECLARADOS,
    } satisfies CoordenadasDoTransporte);

    // O par que discrimina: a mesma URL sobre TLS, agora COM credencial, produz `auth`. Sem ele, a
    // ausência acima seria satisfeita por uma função que nunca devolvesse credencial nenhuma.
    expect(coordenadasDoTransporte('smtps://relay:chave@mail.exemplo.test:1025')).toStrictEqual({
      host: 'mail.exemplo.test',
      port: 1025,
      secure: true,
      auth: { user: 'relay', pass: 'chave' },
      ...LIMITES_DECLARADOS,
    } satisfies CoordenadasDoTransporte);
  });

  it('CT-641 (c) — o adaptador entrega ao construtor do transporte a chamada INTEIRA, uma só vez', async () => {
    const fonte = await readFile(FONTE_DO_ADAPTADOR, 'utf8');

    // A igualdade é a âncora e é também a não-vacuidade: um fonte que não fosse lido, uma chamada
    // que sumisse ou uma segunda chamada reprovam aqui, junto com o literal de objeto que
    // reintroduziria o defeito — o objeto do chamador é descartado quando viaja com a chave `url`.
    expect(
      argumentosDasChamadas(fonte, CONSTRUTOR_DO_TRANSPORTE),
      'o argumento do construtor do transporte deixou de ser a chamada inteira das coordenadas',
    ).toEqual([ARGUMENTO_ESPERADO]);
  });
});

describe('CT-642 — a SMTP_URL que não serve é recusada, nomeando a variável e nunca o valor', () => {
  it('CT-642 (a) — as três formas medidas, o esquema alheio, o endereço sem servidor e a vazia são recusados', () => {
    // O VALOR da constante, antes da ligação — e ela NÃO é implicada pela igualdade da mensagem
    // abaixo. `VARIAVEL_DO_TRANSPORTE` tem um segundo consumidor que este arquivo não observa: é ela
    // que o adaptador passa a `exigirDeclarada`, de modo que a recusa por variável **não declarada**
    // nomeia o mesmo texto. Um `SMTP_URI` aqui mandaria o operador procurar, nas DUAS recusas, uma
    // variável que não existe no `EnvironmentFile`. O motivo não ganha âncora irmã de propósito: ele
    // não tem consumidor fora do módulo, e a igualdade contra `MOTIVO_ESPERADO` já é estritamente
    // mais forte — uma segunda asserção ali seria implicada por esta suíte, e não prova nada novo.
    expect(VARIAVEL_DO_TRANSPORTE).toBe(VARIAVEL_ESPERADA);

    for (const { rotulo, cadeia, recusada } of FORMAS_DA_SMTP_URL) {
      if (!recusada) {
        continue;
      }

      const { erro } = desfechoDe(cadeia);

      expect(erro, `${rotulo}: a recusa não levantou`).toBeInstanceOf(Error);
      expect((erro as Error).message, `${rotulo}: a mensagem da recusa mudou`).toEqual(
        RECUSA_ESPERADA,
      );

      // O critério da credencial: o erro INTEIRO — mensagem, `cause` e propriedades próprias — não
      // pode conter o valor recusado. O `TypeError` nativo do `new URL` traz a cadeia em `input`, de
      // modo que deixá-lo subir cru reabriria o vazamento. A cadeia vazia não entra aqui: `''` é
      // subcadeia de tudo, e a asserção passaria a não poder falhar.
      if (cadeia !== '') {
        expect(
          inspect(erro, { depth: null }),
          `${rotulo}: o valor recusado vazou no erro`,
        ).not.toContain(cadeia);
      }
    }
  });

  it('CT-642 (b) — o par positivo: a lista de desfechos é exatamente a declarada', () => {
    const observado = FORMAS_DA_SMTP_URL.map(({ rotulo, cadeia }) => ({
      rotulo,
      recusada: desfechoDe(cadeia).recusada,
    }));

    // A igualdade sobre a lista inteira é o que impede as duas degenerações opostas: uma barreira
    // que recusasse tudo (e faria o caso acima passar por engano) e uma que não recusasse nada.
    expect(observado).toEqual(
      FORMAS_DA_SMTP_URL.map(({ rotulo, recusada }) => ({ rotulo, recusada })),
    );
  });
});
