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
 * @param campoPadrao Nome de campo usado quando a recusa **não tem nada a nomear** — hoje só o
 *                 escalar de rota (`id`, `codigo`), porque a chave desconhecida passou a nomear a
 *                 si mesma. Ver {@link campoDoProblema}.
 */
export function validar<T>(esquema: ZodType<T>, valor: unknown, campoPadrao: string): T {
  const resultado = esquema.safeParse(valor);

  if (resultado.success) {
    return resultado.data;
  }

  throw recusaDeCampo(campoDoProblema(resultado.error, campoPadrao), resultado.error);
}

/**
 * O campo culpado, na ordem de precisão: a **chave desconhecida**, depois o **caminho**, depois o
 * campo padrão do ponto de chamada.
 *
 * ---------------------------------------------------------------------------
 * A chave desconhecida nomeia A SI MESMA — e isso é o CONTRATO, não uma melhoria
 * ---------------------------------------------------------------------------
 *
 * O `handoff-frontend.md` promete exatamente isto, em cinco lugares e desde 2026-08-24: a **§6.1**
 * (*"chave desconhecida é `422 CAMPO_INVALIDO`, com `campo` nomeando a chave"*), a **§6.2**
 * (*"`limite=50&ordenar=nome` é `422`, com `campo: "ordenar"`"*), as fixtures
 * `listar-contratos/parametro-desconhecido` e `alterar-imovel/status-de-locacao-e-chave-desconhecida`
 * da §20 e o teste mínimo 15 da §21.
 *
 * ⚠️ **O produto respondia o `campoPadrao` — `'corpo'` ou `'limite'` —, e a divergência era
 * CONHECIDA e estava declarada por escrito** no cabeçalho de
 * `apps/api/test/circulacao-de-cadastro.e2e.spec.ts`: o cartão do `CT-347` previa
 * `campo: 'retiradoEm'`, e o executor registrou que publicá-lo exigiria *"mudar `validar()` para ler
 * `keys`, o que a §3 da T4 proíbe literalmente (**esta é uma extração, não uma melhoria**)"*. Aquela
 * proibição era **escopo daquela task**, não decisão permanente — a task fechou, e o que sobrou foi
 * um contrato publicado que o servidor não cumpria. É essa dívida que esta função paga.
 *
 * O gatilho de fato foi uma medição da equipe do frontend, em 2026-09-05: `campo: "limite"` para um
 * parâmetro inventado é **indistinguível** da recusa de um `limite` de verdade inválido, de modo que
 * nenhum cliente conseguia classificar as duas. O corpo tem a mesma forma do defeito, e entrou junto
 * pela razão que eles próprios deram — *documento que promete o que o servidor não faz é a classe de
 * defeito que já custou este ciclo*.
 *
 * ---------------------------------------------------------------------------
 * O caminho é PREFIXO da chave, e não alternativa a ela
 * ---------------------------------------------------------------------------
 *
 * O Zod reporta `unrecognized_keys` com o caminho do **objeto que hospeda** a chave, e o nome dela em
 * `keys`. No topo o caminho é vazio e o campo é a chave nua (`empresaId`); aninhado, os dois se
 * compõem (`ajustes.0.chaveInventada`). Publicar só o caminho mandaria o cliente corrigir o objeto
 * inteiro; publicar só a chave esconderia **onde** ela está, num corpo que aninha.
 *
 * ---------------------------------------------------------------------------
 * Sai o NOME, nunca o VALOR
 * ---------------------------------------------------------------------------
 *
 * `keys` carrega o nome da chave recusada; o valor continua sem sair, como o cabeçalho deste módulo
 * exige. Para a consulta isso é o que mantém intacta a decisão de `caminhoSemConsulta`
 * (`comum/filtro-excecao.ts`), que trunca a cadeia antes do `?` no diário: o que ela guarda é o
 * **valor** que viaja na consulta — credencial, endereço de retorno —, e um nome de chave não é ele.
 *
 * Nomeia-se a **primeira**, e não todas: mesma disciplina do `issues[0]` e do `detalhes.exigido` da
 * guarda de autorização, que nomeia a primeira permissão ausente. O cliente corrige uma e volta.
 */
function campoDoProblema(erro: ZodError, campoPadrao: string): string {
  const problema = erro.issues[0];
  const caminho = problema?.path ?? [];

  if (problema?.code === 'unrecognized_keys') {
    const chave = problema.keys[0];

    // O `undefined` cobre o arranjo vazio, que o tipo admite e o Zod não produz. Sem a guarda, um
    // `keys` vazio sairia como `campo: ''` — pior que o campo padrão, porque parece um nome.
    if (chave !== undefined) {
      return [...caminho, chave].join('.');
    }
  }

  return caminho.length > 0 ? caminho.join('.') : campoPadrao;
}

/**
 * O campo que nomeia a recusa da **cadeia de consulta** quando não há nada mais preciso a nomear.
 *
 * É o análogo exato do `'corpo'` que as bordas passam a {@link validar}: o culpado é a consulta
 * **como um todo**. Hoje ele é inalcançável na prática — todo problema de consulta ou tem caminho ou
 * é chave desconhecida —, e existe porque o padrão é obrigatório e um valor honesto é melhor que um
 * inalcançável mentiroso.
 *
 * ⚠️ **Ele NÃO é `'limite'`.** Até 2026-09-05 as sete bordas de listagem declaravam, cada uma,
 * `const CAMPO_DA_CONSULTA = 'limite'`, com o docblock dizendo *"nome de campo usado quando a recusa
 * é da cadeia de consulta"* — o docblock descrevia o papel e o valor nomeava **um parâmetro**.
 * Enquanto `limite` era o único parâmetro de consulta do produto a divergência não tinha
 * consequência; com nove, ela passou a produzir diagnóstico errado no cliente.
 */
const CAMPO_DA_CONSULTA = 'consulta';

/**
 * Valida a **cadeia de consulta**.
 *
 * Ela delega a {@link validar} e existe por **um** motivo: carregar o campo padrão certo, para que
 * as oito bordas de listagem não voltem a declarar um literal cada. A regra do campo culpado é uma
 * só, e vive em {@link campoDoProblema} — corpo e consulta a compartilham.
 */
export function validarConsulta<T>(esquema: ZodType<T>, valor: unknown): T {
  return validar(esquema, valor, CAMPO_DA_CONSULTA);
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
