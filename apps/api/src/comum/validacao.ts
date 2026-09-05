/**
 * A tradução de recusa de esquema no envelope de erro — **ponto único da borda**.
 *
 * ## Por que existe, e por que num módulo só
 *
 * Toda rota desta superfície valida a entrada antes de qualquer consulta, e a recusa precisa sair
 * na forma canônica que a **ADR-0017** fixa: status HTTP semântico mais
 * `{ codigo, mensagem, campo?, detalhes? }`, com `codigo` vindo de enum fechado. Um `safeParse` com
 * tratamento por manipulador colocaria **dezenas** de traduções livres para divergir no código, no
 * status e no campo nomeado — e a forma do erro é contrato, não detalhe de implementação.
 *
 * O ponto único já existia; o que não existia era **um** ponto. As três bordas nascidas em T7, T8 e
 * T9 escreveram, cada uma, uma cópia byte a byte desta função, porque cada executor partiu do
 * controlador anterior e não havia lugar de onde importar. As três concordavam, e o risco era de
 * congelamento: a superfície da API fecha no marco de entrega e o `@syslocbr/contracts` nasce dela, de
 * modo que a partir dali cada ajuste teria três pontos para acertar e **nenhum mecanismo que
 * acusasse a divergência** — e o que diverge primeiro neste molde é justamente o campo padrão e a
 * escolha entre `issues[0].path` e o caminho completo, isto é, a forma da recusa que o cliente vê.
 * É o débito **D38**, e este módulo é o fecho dele; a rede que impede a quarta cópia é o `CT-343` de
 * `apps/api/test/validacao.spec.ts`, que afirma por igualdade de conjunto que há **uma** definição e
 * **três** importadores.
 *
 * É o mesmo desenho, e a mesma razão, de {@link ./esquema-de-erro.js}, que fez pelo DOCUMENTO o que
 * este faz pela EXECUÇÃO.
 *
 * ## O que sai para o cliente, e o que nunca sai
 *
 * Sai o **campo culpado**, e nada do valor recusado: entrada não confiável repetida na mensagem
 * chega ao registro estruturado por outro caminho — é a razão pela qual a unidade de trabalho já
 * redige o identificador inválido em vez de ecoá-lo. O `ZodError` viaja como `causa`, que é
 * diagnóstico interno e **não** entra em `paraCorpo()` (a ADR-0017 fixa o corpo em quatro campos).
 */

import { CodigoErro, ErroDeAplicacao } from '@sysloc/shared';
import type { ZodError, ZodType } from 'zod';
import { MENSAGEM_POR_CODIGO } from './filtro-excecao.js';

/**
 * Valida a entrada e traduz a recusa no envelope da ADR-0017.
 *
 * @param esquema  O esquema que decide. A transformação dele é **preservada**: o que volta é
 *                 `resultado.data`, e não o valor de entrada — uma normalização declarada no
 *                 esquema (caixa do UUID, minúscula do endereço) só existe porque este retorno a
 *                 carrega.
 * @param valor    O que chegou do cliente, sem confiança nenhuma.
 * @param campoPadrao Nome de campo usado quando a recusa **não tem caminho a nomear** — o caso do
 *                 escalar de rota (`id`) e o da chave desconhecida em objeto estrito, que o Zod
 *                 reporta com caminho vazio.
 */
export function validar<T>(esquema: ZodType<T>, valor: unknown, campoPadrao: string): T {
  const resultado = esquema.safeParse(valor);

  if (resultado.success) {
    return resultado.data;
  }

  const caminho = resultado.error.issues[0]?.path ?? [];

  throw recusaDeCampo(caminho.length > 0 ? caminho.join('.') : campoPadrao, resultado.error);
}

/**
 * O campo que nomeia a recusa da **cadeia de consulta** quando não há chave a nomear.
 *
 * É o análogo exato do `'corpo'` que as bordas passam a {@link validar} para o corpo: quando o
 * problema não tem caminho e não é chave desconhecida, o culpado é a consulta **como um todo**.
 *
 * ⚠️ **Ele NÃO é `'limite'`, e a diferença é a razão desta função existir.** Até 2026-09-05 as sete
 * bordas de listagem declaravam, cada uma, `const CAMPO_DA_CONSULTA = 'limite'`, com o docblock
 * dizendo *"nome de campo usado quando a recusa é da cadeia de consulta"* — o docblock descrevia o
 * papel e o valor nomeava **um parâmetro**. Enquanto `limite` era o único parâmetro de consulta do
 * produto, a divergência não tinha consequência; com nove, ela passou a produzir diagnóstico errado.
 */
const CAMPO_DA_CONSULTA = 'consulta';

/**
 * Valida a **cadeia de consulta** e traduz a recusa nomeando a **chave culpada**.
 *
 * ---------------------------------------------------------------------------
 * Por que ela existe, em vez de um `campoPadrao` a mais em {@link validar}
 * ---------------------------------------------------------------------------
 *
 * A cadeia de consulta é **plana**: não há aninhamento, e toda chave dela é um campo do contrato.
 * Por isso a chave desconhecida **tem** o que nomear — e é isso que a §6.2 do handoff publicado
 * promete, com todas as letras: *"`limite=50&ordenar=nome` é `422`, com `campo: "ordenar"`"*. O
 * corpo é outra coisa: ele aninha, e a decisão vigente ali é nomear `'corpo'`.
 *
 * Ela é função própria, e não um parâmetro booleano de `validar`, porque quem chama declara **o que
 * está validando** — e não uma opção de formatação. O ponto único do envelope continua sendo um só
 * ({@link recusaDeCampo}), que é o que o débito **D38** fechou e o `CT-343` protege.
 *
 * ---------------------------------------------------------------------------
 * A chave é o NOME, nunca o valor — e é o que a mantém fora do alcance do vazamento
 * ---------------------------------------------------------------------------
 *
 * O que sai é `keys[0]`, o **nome** da chave recusada. O valor recusado continua sem sair, como o
 * cabeçalho deste módulo exige, e `caminhoSemConsulta` (`comum/filtro-excecao.ts`) segue truncando a
 * cadeia antes do `?` para o diário — a decisão registrada lá guarda o **valor** que viaja na
 * consulta (credencial, endereço de retorno), e um nome de chave não é esse valor.
 *
 * Nomeia-se a **primeira**, e não todas: é a mesma disciplina do `issues[0]` de {@link validar} e do
 * `detalhes.exigido` da guarda de autorização, que nomeia a primeira chave ausente. O cliente
 * corrige uma e volta.
 */
export function validarConsulta<T>(esquema: ZodType<T>, valor: unknown): T {
  const resultado = esquema.safeParse(valor);

  if (resultado.success) {
    return resultado.data;
  }

  const problema = resultado.error.issues[0];
  const caminho = problema?.path ?? [];

  if (caminho.length > 0) {
    throw recusaDeCampo(caminho.join('.'), resultado.error);
  }

  // O Zod reporta a chave desconhecida com caminho VAZIO e o nome dela em `keys` — é o único
  // problema de consulta sem caminho que o produto pode produzir hoje, e é justamente o que a
  // §6.2 do handoff manda nomear. O `??` cobre o arranjo vazio, que o tipo admite e o Zod não
  // produz: sem ele, a recusa sairia com `campo: undefined` e o envelope perderia a chave.
  const chaveDesconhecida =
    problema?.code === 'unrecognized_keys' ? (problema.keys[0] ?? CAMPO_DA_CONSULTA) : undefined;

  throw recusaDeCampo(chaveDesconhecida ?? CAMPO_DA_CONSULTA, resultado.error);
}

/**
 * O envelope da recusa de campo — **o ponto único** que as duas funções acima compartilham.
 *
 * Ele existe para que a forma do erro (o código, a mensagem canônica, a `causa` que não é publicada)
 * tenha **uma** escrita, qualquer que seja a origem do campo nomeado. Duas construções do mesmo
 * envelope seriam livres para divergir no código e na mensagem — que é exatamente o débito **D38**
 * que este módulo fechou, reaparecendo dentro dele.
 */
function recusaDeCampo(campo: string, causa: ZodError): ErroDeAplicacao {
  return new ErroDeAplicacao(
    CodigoErro.CAMPO_INVALIDO,
    MENSAGEM_POR_CODIGO[CodigoErro.CAMPO_INVALIDO],
    {
      campo,
      causa,
    },
  );
}
