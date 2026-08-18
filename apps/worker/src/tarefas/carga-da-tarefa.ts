/**
 * A **conferência da carga de uma tarefa** — a entrada única que recusa antes de qualquer leitura.
 *
 * ---------------------------------------------------------------------------
 * Por que este módulo existe: o limiar de três
 * ---------------------------------------------------------------------------
 *
 * As duas bordas anteriores (`./regua.ts` e `./confirmacao-de-email.ts`) escrevem, cada uma, a mesma
 * tradução de `ZodError` em nomes de campo. Com a emissão em lote e a conferência bancária seriam
 * **quatro** cópias, e o `CLAUDE.md` fixa o gatilho: *"ao terceiro consumidor, o símbolo duplicado
 * sobe para casa compartilhada em vez de ganhar a terceira cópia"* — porque com duas cópias endurecer
 * uma deixa a outra para trás, e com três elas já divergiram. Esta é a casa.
 *
 * ---------------------------------------------------------------------------
 * O que ele publica, e por que a recusa nomeia o CAMPO e nunca o valor
 * ---------------------------------------------------------------------------
 *
 * A razão da falha fica gravada no servidor de fila e alcança o journal. Ela nomeia o campo exigido e
 * os campos recusados **pelo nome**; o conteúdo recebido nunca entra — nome de campo não é segredo,
 * valor de campo pode ser dado de outra empresa. É a disciplina que `./eco.ts` inaugurou e que as
 * duas bordas seguintes repetiram, agora escrita **uma vez**.
 *
 * ⚠️ **Ele não abre contexto, não lê banco e não conhece fila.** É função pura sobre a carga
 * desserializada, e é isso que permite chamá-la como **primeira** instrução de cada borda — antes de
 * `contextoDeTenant.executarCom`, que é a ordem que impede o trabalho de correr sem contexto e
 * devolver vazio como se fosse sucesso (ADR-0008 / ADR-0024).
 */

import type { z } from 'zod';

// DÉBITO COM GATILHO — D49 · F4/T16 · registrado 2026-08-18
// (NÃO é uma `DECISÃO FECHADA`: ele agenda uma convergência, não protege o código abaixo.)
// O QUÊ: a tradução de `ZodError` em nomes de campo existe TRÊS vezes no processo — aqui, em
//        `./regua.ts` e em `./confirmacao-de-email.ts`. As duas bordas antigas seguem com cópia
//        privada, e endurecer esta deixa as duas para trás.
// QUANDO FECHA: a primeira task autorizada a abrir `./regua.ts` ou `./confirmacao-de-email.ts` por
//        outra razão — as duas estão declaradas como REFERÊNCIA (somente leitura) na §3.4 da
//        `tech_spec.md` desta fatia, de modo que migrá-las agora seria alargamento de escopo.
// POR QUE NÃO AGORA: as duas bordas antigas estão verdes e fora da lista de arquivos da T16; o que a
//        T16 podia fazer sem alargar escopo era não criar a quarta cópia, e é o que ela fez.
// ÍNDICE: docs/specs/features/emissao-e-conciliacao/v1/_run/run-report.md §2, D49

/**
 * Confere a carga contra o esquema e devolve o valor **já canonizado**, ou falha nomeando o campo.
 *
 * A conversão de `carga` a partir de `unknown` é deliberada: ela chega desserializada de um
 * armazenamento externo, e o tipo declarado da tarefa descreve o **contrato** — não é garantia que
 * esta função possa assumir. `carga ?? {}` faz a carga ausente cair na mesma recusa da carga sem os
 * campos, em vez de produzir a mensagem do interpretador sobre `null`.
 *
 * @param esquema   O `strictObject` da borda — fechado, para que campo desconhecido seja **recusado**
 *                  em vez de ignorado: a carga é a origem do contexto de tenant, e ignorar o que veio
 *                  a mais é o começo de ela virar "o novo request" (ADR-0024).
 * @param exigencia O texto que a razão publica, nomeando os campos exigidos e **nada mais**.
 * @param carga     `tarefa.data`, como o servidor de fila a entregou.
 * @throws {Error} Quando a carga não satisfaz o esquema. A mensagem nomeia os campos recusados.
 */
export function cargaConferida<T>(
  esquema: z.ZodType<T, unknown>,
  exigencia: string,
  carga: unknown,
): T {
  const analise = esquema.safeParse(carga ?? {});

  if (!analise.success) {
    throw new Error(`${exigencia} (recusado: ${camposRecusados(analise.error)})`);
  }

  return analise.data;
}

/**
 * Descreve o que foi recusado **pelo nome do campo**, nunca pelo conteúdo dele.
 *
 * Três casos, e cada um tem endereço:
 *
 *   1. **campo com caminho** — sai o caminho (`empresaId`), que é o que quem opera precisa ler;
 *   2. **chave excedente** — saem as chaves que o `strictObject` recusou, **pelo nome**. É o que a
 *      `.claude/rules/contrato-publicado.md` cobra (*"a recusa por chave desconhecida é afirmada por
 *      `code` e pela lista `keys`"*), e é a metade que as cópias privadas de `./regua.ts` e
 *      `./confirmacao-de-email.ts` não têm: elas publicam o código `unrecognized_keys` e deixam quem
 *      opera sem saber **qual** chave veio a mais. Nome de chave não é segredo — o que nunca sai é o
 *      **valor** dela;
 *   3. **problema sem caminho e sem chave** — a carga inteira veio com o tipo errado —, e o que sai é
 *      o **código** do problema, que é rótulo fechado da biblioteca de esquema.
 *
 * Nem o valor recebido nem a mensagem crua da biblioteca atravessam em caso algum.
 */
function camposRecusados(erro: z.ZodError): string {
  const nomes = erro.issues.flatMap((problema) => {
    if (problema.path.length > 0) {
      return [problema.path.join('.')];
    }

    return problema.code === 'unrecognized_keys' ? [...problema.keys] : [problema.code];
  });

  return [...new Set(nomes)].join(', ');
}
