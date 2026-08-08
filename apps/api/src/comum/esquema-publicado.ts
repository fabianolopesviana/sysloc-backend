/**
 * A tradução de um esquema de `@sysloc/contracts` na descrição publicada — **ponto único da borda**.
 *
 * ## Por que existe
 *
 * A **ADR-0016** é literal: *"o esquema declarado no pacote de contratos é a fonte única: a
 * conferência de entrada, o tipo da resposta e o documento publicado derivam dele. Nenhuma descrição
 * de contrato é escrita à mão em paralelo ao esquema"*. As 15 rotas da F1 escrevem a descrição à mão
 * — é o débito com gatilho que a própria ADR registra —, e as rotas do domínio de locação nascem do
 * outro lado dessa linha: elas **derivam**.
 *
 * O tradutor é `z.toJSONSchema`, do próprio zod, e não uma biblioteca nova. Isso importa por duas
 * razões concretas: nenhuma dependência entra no manifesto para publicar contrato, e o que produz a
 * descrição é o **mesmo** objeto que confere a entrada — de modo que não existe caminho pelo qual os
 * dois divirjam sem que alguém tenha alterado o esquema.
 *
 * ## Por que num módulo só, e por que aqui
 *
 * Pela razão que {@link ./esquema-de-erro.js} e {@link ./validacao.js} já pagaram nesta base: três
 * controladores nascidos em três tasks distintas escreveram, cada um, uma cópia byte a byte da mesma
 * função de borda, porque cada executor partiu do controlador anterior e não havia lugar de onde
 * importar (débitos **D38** e **D40**). Esta fatia acrescenta **cinco** controladores ao mesmo molde,
 * e a quarta cópia nasceria aqui se o tradutor morasse dentro do primeiro deles.
 *
 * ## O `io` é obrigatório, e não tem padrão
 *
 * Um esquema de **entrada** e um de **saída** produzem descrições diferentes quando há transformação
 * ou padrão declarado — `esquemaDaJanela` tem os dois, e lido como saída ele descreveria o que o
 * servidor devolve, não o que o cliente pode enviar. Um padrão silencioso aqui escolheria o lado
 * errado sem que nada acusasse; exigir o argumento faz a escolha aparecer em cada chamada.
 */

import { type ZodType, z } from 'zod';

/** De que lado do esquema a descrição fala: o que o cliente envia, ou o que o servidor devolve. */
export type LadoDoContrato = 'input' | 'output';

/**
 * Deriva a descrição publicada de um esquema.
 *
 * @param esquema O esquema de `@sysloc/contracts` — a fonte única (ADR-0016).
 * @param lado    `'input'` para corpo e parâmetro de entrada; `'output'` para resposta.
 *
 * O `$schema` sai do resultado de propósito: ele é metadado do dialeto JSON Schema e não pertence ao
 * documento OpenAPI, onde o dialeto é declarado uma vez no topo. Deixá-lo faria cada esquema de cada
 * rota carregar a mesma linha de ruído.
 */
export function esquemaPublicado(esquema: ZodType, lado: LadoDoContrato): Record<string, unknown> {
  const { $schema: _dialeto, ...descricao } = z.toJSONSchema(esquema, { io: lado });

  return descricao;
}
