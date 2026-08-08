/**
 * Conferência de dígito verificador de CPF e CNPJ, e normalização do documento para dígitos.
 *
 * ---------------------------------------------------------------------------
 * Por que a regra mora aqui, e não no esquema de validação
 * ---------------------------------------------------------------------------
 *
 * O documento é conferido na borda (o esquema recusa com `422` nomeando o campo) e **gravado só
 * com dígitos**, porque a unicidade por empresa é imposta pelo banco sobre a coluna e não pode
 * depender da forma como o operador digitou: `529.982.247-25` e `52998224725` são o mesmo
 * documento, e duas linhas com as duas grafias derrotariam a restrição única sem que nenhuma
 * validação de aplicação acusasse.
 *
 * Por isso as duas funções andam juntas e são publicadas juntas: quem confere é quem normaliza,
 * e a normalização não é detalhe de escrita — é parte da regra.
 *
 * Sem dependência nova: é aritmética de poucas linhas, e trazer biblioteca para isso não se paga
 * (tech spec §18).
 *
 * ---------------------------------------------------------------------------
 * Os quatro ramos que uma implementação ingênua erra
 * ---------------------------------------------------------------------------
 *
 * 1. **Resto menor que dois ⇒ dígito verificador é zero.** Devolver `11 - resto` sempre produz
 *    `11` ou `10`, que não são dígitos — e o efeito é **falso-negativo em documento legítimo**,
 *    que é o defeito mais caro dos quatro: recusa cadastro válido e não deixa rastro de erro.
 * 2. **Todos os dígitos iguais passam no cálculo.** `000.000.000-00` e `111.111.111-11` satisfazem
 *    os dois dígitos verificadores; a recusa precisa ser explícita, e o mesmo vale para
 *    `00.000.000/0000-00`.
 * 3. **Comprimento fora do previsto recusa antes de calcular** — sem isso, o acesso posicional
 *    lê fora da cadeia e a soma vira `NaN`, que compara falso com tudo e esconde a causa.
 * 4. **Letra não vira documento válido por ser removida na normalização.** `5299822472A5` reduz a
 *    onze dígitos que conferem; sem a guarda de forma, a cadeia seria aprovada e gravada como se
 *    o operador tivesse digitado um CPF. A guarda roda **antes** da normalização, que é o único
 *    ponto em que a informação ainda existe.
 */

/** Regra de um tipo de documento: o comprimento em dígitos e os pesos dos dois verificadores. */
interface RegraDeDocumento {
  /** Quantos dígitos o documento tem, já sem máscara. */
  readonly comprimento: number;
  /** Pesos do primeiro dígito verificador, aplicados aos dígitos que o antecedem. */
  readonly pesosDoPrimeiroDigito: readonly number[];
  /** Pesos do segundo dígito verificador — alcançam também o primeiro verificador. */
  readonly pesosDoSegundoDigito: readonly number[];
}

/**
 * As duas regras, na forma da especificação oficial.
 *
 * Os pesos estão escritos por extenso, e não derivados por fórmula, de propósito: são o ponto em
 * que um erro é silencioso — uma sequência trocada continua produzindo um dígito de 0 a 9 — e a
 * lista literal é conferível contra a norma sem executar nada.
 */
const REGRAS: readonly RegraDeDocumento[] = [
  {
    comprimento: 11,
    pesosDoPrimeiroDigito: [10, 9, 8, 7, 6, 5, 4, 3, 2],
    pesosDoSegundoDigito: [11, 10, 9, 8, 7, 6, 5, 4, 3, 2],
  },
  {
    comprimento: 14,
    pesosDoPrimeiroDigito: [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2],
    pesosDoSegundoDigito: [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2],
  },
];

/**
 * A cadeia só pode conter dígitos e os separadores das duas máscaras canônicas —
 * `000.000.000-00` e `00.000.000/0000-00`.
 *
 * A guarda existe porque a normalização é **destrutiva**: ela apaga o caractere ofensivo e
 * entrega uma cadeia de comprimento correto, de modo que qualquer conferência feita depois dela
 * já não distingue `5299822472A5` de um CPF digitado corretamente.
 */
const FORMA_ACEITA = /^[0-9./-]+$/;

/** Documento cujos dígitos são todos iguais — recusado apesar de o cálculo do verificador passar. */
const TODOS_OS_DIGITOS_IGUAIS = /^(\d)\1*$/;

/**
 * Devolve o valor com tudo que não é dígito removido.
 *
 * É a forma em que o documento é **gravado**: a restrição única por empresa é imposta pelo banco
 * sobre esta coluna, e comparar cadeias mascaradas faria duas grafias do mesmo documento
 * coexistirem.
 */
export function somenteDigitos(valor: string): string {
  return valor.replace(/\D/g, '');
}

/**
 * Dígito verificador de uma posição, pelo módulo 11.
 *
 * Pré-condição do chamador: `digitos` tem ao menos `pesos.length` caracteres — garantida pela
 * conferência de comprimento em `conferirDocumento`, que é a única chamadora.
 */
function digitoVerificador(digitos: string, pesos: readonly number[]): number {
  let soma = 0;

  for (const [posicao, peso] of pesos.entries()) {
    soma += peso * Number(digitos.charAt(posicao));
  }

  const resto = soma % 11;

  // Resto 0 ou 1 ⇒ o dígito é zero. É o ramo esquecido com mais frequência, e devolver
  // `11 - resto` aqui produziria 11 ou 10 — falso-negativo em documento legítimo.
  return resto < 2 ? 0 : 11 - resto;
}

/**
 * O documento informado é um CPF ou um CNPJ cujo dígito verificador confere?
 *
 * Aceita a cadeia com ou sem máscara, e escolhe entre CPF e CNPJ pelo comprimento depois da
 * normalização. Devolve `false` — nunca lança — para toda entrada que não seja um documento
 * válido, inclusive a cadeia vazia: a recusa é resposta de negócio, não condição excepcional.
 */
export function conferirDocumento(valor: string): boolean {
  if (!FORMA_ACEITA.test(valor)) {
    return false;
  }

  const digitos = somenteDigitos(valor);
  const regra = REGRAS.find((candidata) => candidata.comprimento === digitos.length);

  if (regra === undefined || TODOS_OS_DIGITOS_IGUAIS.test(digitos)) {
    return false;
  }

  const primeiro = digitoVerificador(digitos, regra.pesosDoPrimeiroDigito);
  const segundo = digitoVerificador(digitos, regra.pesosDoSegundoDigito);

  return digitos.endsWith(`${primeiro}${segundo}`);
}
