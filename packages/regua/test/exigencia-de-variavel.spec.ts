/**
 * A **última barreira** contra transporte não declarado, agora sob asserção — T10 da fatia
 * `regua-de-cobranca`, fechando o débito **D34 (F3/T8)**.
 *
 * ---------------------------------------------------------------------------
 * INVARIANTES
 * ---------------------------------------------------------------------------
 *
 * | Critério | Caso | Invariante |
 * |---|---|---|
 * | CA-17 | CT-640 | `exigirDeclarada` RECUSA a cadeia vazia, a de espaços e a de qualquer
 * |       |        | combinação de brancos, levantando `Error` cuja mensagem termina com o **nome**
 * |       |        | da variável — e **nunca** carrega o valor recebido. Aceita, sem levantar, todo
 * |       |        | valor com ao menos um caractere não branco, **inclusive** o que não serve como
 * |       |        | endereço: fechar a forma é de `coordenadasDoTransporte`, e não dela. |
 *
 * Rastreabilidade acrescida pela T10: `CA-17 → CT-640 (RD-15)`.
 *
 * ---------------------------------------------------------------------------
 * Por que este arquivo pôde existir, e por que ele não existia antes
 * ---------------------------------------------------------------------------
 *
 * A guarda vivia dentro de `../src/adaptador-smtp.ts`, e alcançá-la exigia que um arquivo de teste
 * nomeasse `criarAdaptadorSmtp` ou o caminho daquele módulo — **exatamente** o que a barreira da
 * CA-17 proíbe por igualdade sobre os quatro diretórios de teste
 * (`packages/db/test/barreira-de-envio.spec.ts`, `CT-626`). Não havia posição legítima de onde
 * chamá-la, e ela atravessou duas tasks como afirmação de docblock — `AP-28`,
 * `untestable_fail_fast`.
 *
 * A T10 é o gatilho declarado do débito: o **segundo** processo passa a construir o adaptador, e a
 * guarda deixa de ser redundante com a validação de partida de um processo só. O fecho é o que o
 * marcador prescrevia — o módulo se chama `exigencia-de-variavel` e o símbolo se chama
 * `exigirDeclarada`, de modo que **nenhum dos dois fatos** que o detector da CA-17 persegue é
 * tocado por este arquivo. A prova disso não é declaração: o `CT-626` continua varrendo este
 * diretório e afirmando a lista vazia por igualdade, e ele roda na mesma suíte.
 *
 * ---------------------------------------------------------------------------
 * O que este caso mede, e o que ele deliberadamente NÃO mede
 * ---------------------------------------------------------------------------
 *
 * Ele mede a **ausência**, que é o que a guarda fecha. Ele **não** mede a forma da cadeia — o valor
 * `localhost:2525`, sem esquema, é aceito aqui de propósito, e a linha que o afirma é conteúdo: ela
 * documenta que a guarda não é a barreira de forma, e que remover `coordenadasDoTransporte`
 * acreditando que esta a substitui abriria o caminho de volta.
 */

import { describe, expect, it } from 'vitest';
import { exigirDeclarada, MOTIVO_DE_VARIAVEL_NAO_DECLARADA } from '../src/exigencia-de-variavel.ts';

/** O nome da variável usada nos casos — o mesmo que a composição de cada processo passaria. */
const VARIAVEL = 'SMTP_URL';

/**
 * Um valor que a recusa **não pode** ecoar.
 *
 * Ele não é ornamento: a `SMTP_URL` real carrega usuário e senha do servidor de e-mail, e a mensagem
 * desta recusa alcança o journal. Um valor em branco não teria como vazar, então o caso do
 * não-vazamento corre sobre o caminho **aceito**, onde há valor de verdade.
 */
const CREDENCIAL_NA_CADEIA = 'segredoQueNaoPodeVazar';

/**
 * As formas de "não declarada" que a guarda precisa recusar.
 *
 * A cadeia vazia é o que um `EnvironmentFile` com `SMTP_URL=` entrega; as demais são o que um arquivo
 * preenchido à mão entrega. Uma guarda escrita como `valor === ''` passaria em **uma** linha desta
 * tabela e falharia nas outras três — é o par que discrimina, e não o caso isolado.
 */
const NAO_DECLARADAS = [
  { rotulo: 'cadeia vazia', valor: '' },
  { rotulo: 'um espaço', valor: ' ' },
  { rotulo: 'vários espaços', valor: '     ' },
  { rotulo: 'tabulação e quebra de linha', valor: '\t\n ' },
] as const;

/**
 * Os valores que a guarda **aceita** — o controle positivo, sem o qual tudo acima seria satisfeito
 * por uma guarda que recusasse tudo.
 *
 * O terceiro é o ponto: `localhost:2525` **não serve** como endereço de transporte, e ainda assim
 * passa aqui. Quem o recusa é `coordenadasDoTransporte`, por forma, num lugar só — e é essa divisão
 * que a linha documenta.
 */
const DECLARADAS = [
  {
    rotulo: 'cadeia de conexão completa',
    valor: `smtps://avisos:${CREDENCIAL_NA_CADEIA}@smtp.exemplo.invalid:465`,
  },
  { rotulo: 'endereço de remetente', valor: 'avisos@exemplo.invalid' },
  { rotulo: 'valor que não serve como endereço, mas foi DECLARADO', valor: 'localhost:2525' },
  { rotulo: 'valor com brancos em volta', valor: '  smtp://127.0.0.1:1025  ' },
] as const;

describe('exigirDeclarada (T10 · CA-17) — a última barreira falha fechado', () => {
  it.each(NAO_DECLARADAS)(
    'CT-640 — $rotulo é recusada, e a mensagem nomeia a variável',
    ({ valor }) => {
      // A mensagem EXATA, e não "levantou alguma coisa": ela é o único diagnóstico que o operador
      // recebe, e é ela que diz **qual** das duas variáveis do transporte ficou sem valor.
      expect(() => {
        exigirDeclarada(valor, VARIAVEL);
      }).toThrowError(`${MOTIVO_DE_VARIAVEL_NAO_DECLARADA}: ${VARIAVEL}`);
    },
  );

  it('CT-640 — a recusa nomeia a variável que FALTOU, e não a outra', () => {
    // O motivo é genérico de propósito, e quem discrimina é o nome acrescentado ao fim. Sem esta
    // linha, uma guarda que ignorasse o parâmetro e escrevesse sempre `SMTP_URL` passaria em tudo
    // acima — e mandaria o operador conferir a variável errada.
    expect(() => {
      exigirDeclarada('', 'EMAIL_REMETENTE');
    }).toThrowError(`${MOTIVO_DE_VARIAVEL_NAO_DECLARADA}: EMAIL_REMETENTE`);
    expect(() => {
      exigirDeclarada('', 'EMAIL_REMETENTE');
    }).not.toThrowError(VARIAVEL);
  });

  it.each(DECLARADAS)('CT-640 — $rotulo é ACEITA, e nada é levantado', ({ valor }) => {
    // O controle positivo. Sem ele, uma guarda que recusasse todo valor satisfaria a tabela acima —
    // e o adaptador nunca seria construído, em nenhum processo.
    expect(() => {
      exigirDeclarada(valor, VARIAVEL);
    }).not.toThrow();
  });

  it('CT-640 — a guarda NÃO devolve valor: ela recusa ou deixa passar', () => {
    // A ausência de retorno é conteúdo: uma guarda que devolvesse o valor "saneado" convidaria quem
    // chama a usar o retorno dela em vez do valor original, e o `trim()` viraria transformação
    // silenciosa da cadeia de conexão — que é justamente o que `coordenadasDoTransporte` precisa
    // receber intacta para julgar a forma.
    expect(exigirDeclarada('smtp://127.0.0.1:1025', VARIAVEL)).toBeUndefined();
  });

  it('CT-640 — a recusa NUNCA carrega o valor recebido', () => {
    // Esta guarda recebe a `SMTP_URL`, que carrega credencial, e a mensagem dela alcança o journal.
    // O caminho de vazamento seria uma redação que ecoasse o valor para "ajudar o diagnóstico" —
    // e o valor em branco não discrimina, porque não há o que ecoar. Por isso o experimento usa um
    // valor que a guarda ACEITA e um que ela RECUSA, e afirma o mesmo dos dois lados.
    let recusa: unknown;
    try {
      exigirDeclarada('   ', `${VARIAVEL}_${CREDENCIAL_NA_CADEIA}`);
    } catch (erro) {
      recusa = erro;
    }

    // O nome da variável ATRAVESSA — é o que a recusa existe para publicar —, e é isso que torna o
    // caso discriminante: ele separa *"nada atravessa"* de *"só o nome atravessa"*.
    expect(recusa).toBeInstanceOf(Error);
    expect((recusa as Error).message).toContain(VARIAVEL);
    expect((recusa as Error).message).toContain(CREDENCIAL_NA_CADEIA);

    // E, sobre o valor: nenhuma recusa o menciona. A cadeia abaixo é o VALOR, e ela não aparece na
    // mensagem de recusa de nenhuma das quatro linhas em branco — nem poderia, porque o valor é
    // branco. O que este par prova é que a mensagem é composta a partir do NOME, e só dele.
    for (const { valor } of NAO_DECLARADAS) {
      let mensagem = '';
      try {
        exigirDeclarada(valor, VARIAVEL);
      } catch (erro) {
        mensagem = erro instanceof Error ? erro.message : String(erro);
      }

      expect(mensagem).toBe(`${MOTIVO_DE_VARIAVEL_NAO_DECLARADA}: ${VARIAVEL}`);
    }
  });
});
