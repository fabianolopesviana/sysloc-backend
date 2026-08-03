/**
 * Decodificação do base32 em que o arcabouço escreve o segredo do segundo fator no `totpURI`.
 *
 * ---------------------------------------------------------------------------
 * Por que existe aqui, e não importado do arcabouço
 * ---------------------------------------------------------------------------
 *
 * O decodificador do arcabouço vive em `@better-auth/utils`, que é dependência **transitiva** e não
 * é resolvível a partir de `apps/api`; declará-la no manifesto só para o teste acrescentaria à
 * aplicação uma dependência que ela não usa. O que importa **não** é duplicado: a derivação do
 * código continua sendo a do arcabouço (`api.generateTOTP`), e este passo apenas desfaz a
 * codificação de transporte do endereço que ele mesmo escreveu — uma cópia do algoritmo de derivação
 * provaria que duas implementações concordam, não que a nossa confere o código que ele espera.
 *
 * ---------------------------------------------------------------------------
 * Por que num arquivo próprio
 * ---------------------------------------------------------------------------
 *
 * Ele nasceu duplicado palavra por palavra em `contexto.e2e.spec.ts` e `sessao-restrita.e2e.spec.ts`
 * — dois arquivos do MESMO diretório, sem fronteira de pacote entre eles, ambos introduzidos pela
 * T10. Uma correção de transporte aplicada a uma cópia e não à outra faria um dos arquivos derivar
 * um código diferente do que o arcabouço espera, e a falha apareceria como "código errado", que é o
 * diagnóstico mais enganoso possível aqui.
 *
 * Isto **não** esbarra no `D28` (F0/T5): aquele débito é sobre importar `packages/shared/test/` por
 * caminho relativo profundo, ATRAVESSANDO fronteira de pacote. Este arquivo é irmão dos dois que o
 * importam, e a importação é `./base32.ts`.
 *
 * O arquivo não termina em `.spec.ts`, então o padrão de inclusão do arcabouço (`test/**​/*.spec.ts`)
 * não tenta executá-lo como caso; `tsconfig.test.json` alcança `test/**​/*.ts` e continua a
 * verificar os tipos dele.
 */

/** Alfabeto do base32 (RFC 4648), o mesmo em que o arcabouço escreve o segredo no endereço TOTP. */
const ALFABETO_BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

/** Decodifica o base32 (RFC 4648, sem preenchimento) em que o segredo viaja no endereço. */
export function decodificarBase32(codificado: string): string {
  const bytes: number[] = [];
  let acumulador = 0;
  let bits = 0;

  for (const caractere of codificado) {
    if (caractere === '=') {
      break;
    }

    const valor = ALFABETO_BASE32.indexOf(caractere);
    if (valor < 0) {
      throw new Error(`caractere fora do alfabeto base32 no segredo: ${caractere}`);
    }

    acumulador = (acumulador << 5) | valor;
    bits += 5;

    if (bits >= 8) {
      bits -= 8;
      bytes.push((acumulador >> bits) & 0xff);
    }
  }

  return Buffer.from(bytes).toString('utf8');
}
