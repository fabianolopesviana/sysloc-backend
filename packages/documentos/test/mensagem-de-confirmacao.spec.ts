/**
 * A composição da **mensagem de confirmação de endereço de e-mail** — o link sai da base recebida,
 * e o assunto não carrega dado sensível. T10 da fatia `documentos-e-confirmacao`.
 *
 * Rastreabilidade: CA-11 → apoio (o link) · CA-14 → apoio (o assunto).
 *
 * ---------------------------------------------------------------------------
 * INVARIANTES
 * ---------------------------------------------------------------------------
 *
 * | Critério | Caso | Invariante |
 * |---|---|---|
 * | CA-11 | apoio | Compostas duas mensagens que diferem **apenas** na `urlBase`, o corpo de cada
 * |       |       | uma traz o link montado sobre a SUA base, por igualdade literal da linha
 * |       |       | inteira; o link da outra base **não** aparece; e o segredo ocorre **exatamente
 * |       |       | uma vez** em cada corpo. O restante do corpo é idêntico entre as duas — é o que
 * |       |       | discrimina *"a base entra no link"* de *"a base entra em algum lugar"*. |
 * | CA-11 | apoio | A base com barra final produz **o mesmo** link da base sem ela — `//` no caminho
 * |       |       | é endereço diferente para parte dos servidores, e o operador digita as duas
 * |       |       | formas no arquivo de ambiente. |
 * | CA-14 | apoio | O assunto é a cadeia literal declarada, **não contém** o segredo, o endereço de
 * |       |       | e-mail nem o nome do titular, e **não muda** quando o segredo e o nome mudam. |
 * | CA-14 | apoio | A função é **pura**: duas chamadas com a mesma entrada produzem objetos iguais
 * |       |       | por `toStrictEqual`, e nenhuma variável de ambiente é consultada — o corpo não
 * |       |       | se altera quando `URL_BASE_DA_CONFIRMACAO` é plantada em `process.env` com
 * |       |       | valor divergente. |
 *
 * ===========================================================================
 * O que este arquivo NÃO faz
 * ===========================================================================
 *
 * **Real execution boundary**: `none`. Nenhum mock — não há colaborador a dublar numa função pura.
 * A entrega da mensagem, o contexto de tenant e a leitura do locatário são da borda do processador
 * de trabalho, e são provados pelo `CT-734` (`apps/worker/test/confirmacao-de-email.spec.ts`); o
 * ciclo inteiro, até o endereço constar como confirmado, é o `CT-721` (T11).
 */

import { describe, expect, it, onTestFinished } from 'vitest';
import { comporMensagemDeConfirmacao } from '../src/mensagem-de-confirmacao.ts';

/** Um segredo com a forma real do portador: base64url de 43 caracteres (32 bytes). */
const SEGREDO = '3q2-7bV1yZ8xK0pQwErTyUiOpAsDfGhJkLzXcVbNm4Y';

/** Um segundo segredo, para provar que o assunto não se move com ele. */
const OUTRO_SEGREDO = 'Zm9vYmFyLWJhei1xdXV4LTEyMzQ1Njc4OTAtYWJjZGU';

/** O nome do titular, como o cadastro o guarda. */
const NOME = 'Maria da Silva';

/** O endereço de e-mail do titular — ele NÃO pode aparecer no assunto. */
const EMAIL = 'maria.silva@exemplo.invalid';

/** Duas bases distintas: é a diferença entre elas que o primeiro caso mede. */
const BASE_UM = 'https://app.exemplo.invalid';
const BASE_DOIS = 'https://outro.exemplo.invalid';

/**
 * O assunto esperado, **redigitado de propósito**.
 *
 * Importar a constante do módulo sob prova faria a asserção comparar o valor com ele mesmo, e o
 * caso passaria com qualquer texto — inclusive um que carregasse o segredo. A cadeia literal é o
 * que torna a asserção capaz de reprovar.
 */
const ASSUNTO_ESPERADO = 'Confirmação do seu endereço de e-mail';

/** Quantas vezes uma cadeia ocorre dentro de outra. */
function ocorrenciasDe(texto: string, procurado: string): number {
  return texto.split(procurado).length - 1;
}

describe('comporMensagemDeConfirmacao (T10 · CA-11) — o link sai da base recebida', () => {
  it('apoio — trocar a base troca o link, e o segredo aparece exatamente uma vez', () => {
    const daPrimeira = comporMensagemDeConfirmacao({
      nome: NOME,
      segredo: SEGREDO,
      urlBase: BASE_UM,
    });
    const daSegunda = comporMensagemDeConfirmacao({
      nome: NOME,
      segredo: SEGREDO,
      urlBase: BASE_DOIS,
    });

    const linkDaPrimeira = `${BASE_UM}/confirmar-email#${SEGREDO}`;
    const linkDaSegunda = `${BASE_DOIS}/confirmar-email#${SEGREDO}`;

    // A LINHA inteira, e não `toContain` do endereço: uma linha que trouxesse o link com sufixo
    // ou prefixo colado passaria por `toContain` e chegaria quebrada à caixa do locatário.
    expect(daPrimeira.corpo.split('\n')).toContain(linkDaPrimeira);
    expect(daSegunda.corpo.split('\n')).toContain(linkDaSegunda);

    // O companheiro que discrimina: nenhuma das duas carrega o link da outra. Sem ele, um corpo
    // que ignorasse `urlBase` e escrevesse as duas bases passaria no par de asserções acima.
    expect(daPrimeira.corpo).not.toContain(BASE_DOIS);
    expect(daSegunda.corpo).not.toContain(BASE_UM);

    // O segredo ocorre UMA vez — dentro do link. Duas ocorrências multiplicariam a superfície por
    // onde ele vaza (um encaminhamento da mensagem, uma citação em resposta).
    expect(ocorrenciasDe(daPrimeira.corpo, SEGREDO)).toBe(1);
    expect(ocorrenciasDe(daSegunda.corpo, SEGREDO)).toBe(1);

    // E o resto do corpo é o MESMO: o que a base muda é o link, e nada além dele.
    expect(daPrimeira.corpo.replace(linkDaPrimeira, '')).toBe(
      daSegunda.corpo.replace(linkDaSegunda, ''),
    );
  });

  it('apoio — a base com barra final produz o mesmo link da base sem ela', () => {
    const semBarra = comporMensagemDeConfirmacao({
      nome: NOME,
      segredo: SEGREDO,
      urlBase: BASE_UM,
    });
    const comBarra = comporMensagemDeConfirmacao({
      nome: NOME,
      segredo: SEGREDO,
      urlBase: `${BASE_UM}/`,
    });

    expect(comBarra).toStrictEqual(semBarra);
    // A asserção negativa que nomeia o defeito: `//confirmar-email` é outro caminho para parte dos
    // servidores, e o link chegaria quebrado sem que nada no processo acusasse.
    expect(comBarra.corpo).not.toContain('//confirmar-email');
  });

  it('apoio — a composição é PURA: mesma entrada, saída igual, e o ambiente não a altera', () => {
    const dados = { nome: NOME, segredo: SEGREDO, urlBase: BASE_UM };

    // Uma leitura de `URL_BASE_DA_CONFIRMACAO` dentro do módulo daria à mesma configuração duas
    // fontes, e a segunda escaparia da conferência de partida. Plantado um valor divergente no
    // ambiente do processo, o link continua saindo do PARÂMETRO.
    const anterior = process.env.URL_BASE_DA_CONFIRMACAO;
    process.env.URL_BASE_DA_CONFIRMACAO = 'https://ambiente-que-nao-deve-prevalecer.invalid';
    onTestFinished(() => {
      if (anterior === undefined) {
        delete process.env.URL_BASE_DA_CONFIRMACAO;
      } else {
        process.env.URL_BASE_DA_CONFIRMACAO = anterior;
      }
    });

    const primeira = comporMensagemDeConfirmacao(dados);
    const segunda = comporMensagemDeConfirmacao(dados);

    expect(segunda).toStrictEqual(primeira);
    expect(primeira.corpo).not.toContain('ambiente-que-nao-deve-prevalecer');
    expect(primeira.corpo.split('\n')).toContain(`${BASE_UM}/confirmar-email#${SEGREDO}`);
  });
});

describe('comporMensagemDeConfirmacao (T10 · CA-14) — o assunto não carrega dado sensível', () => {
  it('apoio — o assunto é a cadeia declarada e não traz segredo, endereço nem nome', () => {
    const mensagem = comporMensagemDeConfirmacao({
      nome: NOME,
      segredo: SEGREDO,
      urlBase: BASE_UM,
    });

    // Igualdade literal, e não "não está vazio": o assunto é publicado na lista da caixa de quem
    // recebe, inclusive em pré-visualização de tela bloqueada.
    expect(mensagem.assunto).toBe(ASSUNTO_ESPERADO);
    expect(mensagem.assunto).not.toContain(SEGREDO);
    expect(mensagem.assunto).not.toContain(EMAIL);
    expect(mensagem.assunto).not.toContain(NOME);
  });

  it('apoio — trocar segredo e nome NÃO move o assunto (e move o corpo)', () => {
    const primeira = comporMensagemDeConfirmacao({
      nome: NOME,
      segredo: SEGREDO,
      urlBase: BASE_UM,
    });
    const segunda = comporMensagemDeConfirmacao({
      nome: 'João Pereira',
      segredo: OUTRO_SEGREDO,
      urlBase: BASE_UM,
    });

    expect(segunda.assunto).toBe(primeira.assunto);
    // O companheiro positivo, obrigatório: sem ele, um compositor que ignorasse a entrada inteira
    // — devolvendo assunto e corpo fixos — satisfaria a igualdade acima.
    expect(segunda.corpo).not.toBe(primeira.corpo);
    expect(segunda.corpo).toContain('João Pereira');
    expect(segunda.corpo).not.toContain(SEGREDO);
  });
});
