/**
 * Geração de CPF **válido** para o arranjo das suítes de borda.
 *
 * ---------------------------------------------------------------------------
 * Por que num arquivo próprio
 * ---------------------------------------------------------------------------
 *
 * Ele nasceu duplicado palavra por palavra em `autorizacao-do-dominio.e2e.spec.ts` e
 * `contrato-publicado.e2e.spec.ts` — dois arquivos do MESMO diretório, sem fronteira de pacote
 * entre eles, **ambos introduzidos pela T11 da fatia `cadastro-de-imoveis-e-pessoas`**. O grep da
 * época confirmou que eram as únicas duas ocorrências de `digitoDeControle` no monorepo: as cópias
 * não herdaram de um precedente, nasceram juntas.
 *
 * O que separa este caso da duplicação inofensiva de acessório de transporte (o cliente HTTP, a
 * rotina de entrada) é que aqui está **regra de domínio**: o algoritmo de dígito de controle que
 * `packages/shared/src/documento.ts` implementa em produção, sob a RN-04. Duas cópias corrigidas em
 * momentos diferentes produzem suítes que discordam sobre o que é um CPF válido, e a discordância
 * aparece como `422` de arranjo — falha no lugar errado, com o diagnóstico mais enganoso possível.
 *
 * É o débito **D18** (F2/T11), e este módulo é o fecho dele.
 *
 * ---------------------------------------------------------------------------
 * Por que aqui, e não em `packages/shared/test/`
 * ---------------------------------------------------------------------------
 *
 * Porque **não precisa** atravessar fronteira de pacote: os dois consumidores são irmãos deste
 * arquivo, e a importação é `./documento.ts`. O Tech Review da T11 registrou o `D28` (F0/T5) como
 * "condição habilitante" deste débito, e essa leitura estava errada — o `D28` é sobre importar
 * `packages/shared/test/` por caminho relativo profundo, ATRAVESSANDO a fronteira do pacote, e nada
 * disso acontece aqui. O precedente é `./base32.ts`, que resolveu a mesma classe de duplicação
 * entre irmãos, com o mesmo raciocínio escrito no cabeçalho dele.
 *
 * Se um terceiro pacote vier a precisar do gerador, aí sim o `D28` vira condição — e a carga migra
 * junto com os demais acessórios.
 *
 * ---------------------------------------------------------------------------
 * O que este módulo NÃO é
 * ---------------------------------------------------------------------------
 *
 * Isto é **arranjo**, e não asserção: nada aqui é comparado contra o SUT. Quem prova que a
 * conferência recusa documento inválido é o `CT-312`, com vetores próprios. Este gerador só produz
 * entrada que a borda deve aceitar — e a rota reprovaria em voz alta (`422 CAMPO_INVALIDO`) se ele
 * estivesse errado, nunca em silêncio.
 *
 * **Não é uma segunda implementação de `conferirDocumento`.** Uma cópia do conferidor provaria que
 * duas implementações concordam, não que a borda aceita o que deve — pela mesma razão que
 * `./base32.ts` declara no cabeçalho dele.
 *
 * O arquivo não termina em `.spec.ts`, então o padrão de inclusão do arcabouço não tenta executá-lo
 * como caso; `tsconfig.test.json` alcança `test/**​/*.ts` e continua a verificar os tipos dele.
 */

/**
 * Um CPF **válido**, derivado do sequencial que o chamador fornece.
 *
 * O sequencial entra por parâmetro, e não por estado deste módulo, porque cada suíte mantém o seu
 * próprio contador: compartilhá-lo faria a numeração de um arquivo depender da ordem de execução do
 * outro. A RN-04 exige que o documento seja conferido, e `cadastro-de-pessoa.service.ts` o confere
 * com `conferirDocumento` — de modo que um número qualquer de onze dígitos é recusado com `422`. Os
 * dois dígitos de controle são calculados porque os casos precisam de **dezenas** de documentos
 * distintos, e uma lista literal envelheceria ao primeiro caso novo.
 */
export function cpfValido(sequencial: number): string {
  const base = String(100_000_000 + ((sequencial * 7_919) % 800_000_000));
  const digitos = [...base].map((caractere) => Number(caractere));
  const primeiro = digitoDeControle(digitos, 10);
  const segundo = digitoDeControle([...digitos, primeiro], 11);

  return `${base}${String(primeiro)}${String(segundo)}`;
}

/** Um dígito de controle de CPF: soma ponderada decrescente, resto da multiplicação por dez. */
function digitoDeControle(digitos: readonly number[], pesoInicial: number): number {
  const soma = digitos.reduce((acumulado, digito, indice) => {
    return acumulado + digito * (pesoInicial - indice);
  }, 0);
  const resto = (soma * 10) % 11;

  return resto >= 10 ? 0 : resto;
}
