/**
 * O cálculo do efetivo de permissão, e a coerência entre os dois eixos do catálogo.
 *
 * ---------------------------------------------------------------------------
 * A ORDEM DAS OPERAÇÕES É A DECISÃO DE SEGURANÇA DESTA FATIA
 * ---------------------------------------------------------------------------
 *
 * A **ADR-0010** e a RN-01 fixam o efetivo como `(matriz do perfil ∪ concedidas) − negadas`, com a
 * negação vencendo a concessão. A ordem não é detalhe de escrita: **subtrair por último é o que faz
 * a negação vencer**. Trocá-la por `(perfil − negadas) ∪ concedidas` devolve ao efetivo toda chave
 * que apareça nos dois efeitos — e o Admin que retirou uma ação de alguém continuaria vendo a
 * retirada na tela enquanto ela não valeria nada.
 *
 * A própria ADR-0010 registra isso como o risco da decisão: *"a precedência da negação só existe em
 * código; sem prova dedicada, um caminho de leitura pode ignorá-la e uma permissão retirada
 * continuar valendo"*. O CT-203 é essa prova, e ele carrega a prova de falsificação do mutante de
 * ordem justamente para que nenhuma refatoração futura inverta as duas linhas sem reprovar.
 *
 * ---------------------------------------------------------------------------
 * Puro, e por quê
 * ---------------------------------------------------------------------------
 *
 * As duas funções recebem os ajustes **prontos** e não tocam banco, relógio nem requisição. Quem os
 * lê sob o contexto de tenant é `packages/db/src/permissao.ts`; quem os aplica por requisição é a
 * guarda de `apps/api`. Aqui fica só a aritmética — que é o que a torna verificável pelo compilador
 * e barata de provar por igualdade de conjunto inteiro.
 */

import type { esquemaNegocio } from '@sysloc/db';
import { CodigoErro, ErroDeAplicacao } from '@sysloc/shared';
import { CHAVES_DE_ACAO, type ChaveDoCatalogo, MAPA_ACAO_TELA } from './catalogo-de-permissoes.js';
import { MATRIZ_POR_PERFIL } from './matriz-de-perfil.js';
import type { Perfil } from './perfis.js';

/**
 * O que uma linha de ajuste FAZ com a chave que ela nomeia — conceder ou retirar.
 *
 * Derivado de `negocio.efeito_permissao`, e não redigitado, pela mesma razão de `perfis.ts`: o enum
 * do schema já é a fonte de verdade, e uma segunda lista escrita à mão teria de ser mantida em
 * sincronia por disciplina. É o que torna o ajuste **bidirecional** da ADR-0010 — sem `NEGADA` não
 * há como retirar de um Admin algo que o perfil dele concede.
 */
export type EfeitoDePermissao = (typeof esquemaNegocio.efeitoPermissao.enumValues)[number];

/**
 * Um ajuste individual: a chave, e o que se faz com ela.
 *
 * **Sem o campo `tipo`, de propósito.** A linha persistida em `negocio.acesso_usuario_permissao`
 * tem `tipo` e `chave` em colunas separadas, porque é sobre o trio `(acesso_id, tipo, chave)` que a
 * unicidade recusa concessão e negação coexistentes — e o DTO da rota espelha essa forma. Aqui, no
 * domínio, a chave do catálogo já carrega o eixo no próprio valor: repetir `tipo` ao lado dela
 * tornaria representável o estado incoerente `{ tipo: 'TELA', chave: 'ACAO:emitir_boleto' }`, que
 * nenhum código saberia interpretar. A composição entre as duas formas é da camada de dados.
 */
export interface AjusteDePermissao {
  readonly chave: ChaveDoCatalogo;
  readonly efeito: EfeitoDePermissao;
}

/** Mensagem canônica da recusa de coerência (RN-02). O detalhe estruturado vai em `detalhes`. */
const MENSAGEM_DE_ACAO_SEM_TELA = 'a ação sensível concedida exige a área de tela correspondente';

/**
 * O efetivo de uma pessoa: `(matriz do perfil ∪ concedidas) − negadas`.
 *
 * Os dois laços são **separados de propósito**, e é aí que mora a precedência. Um laço único que
 * decidisse por ajuste (`efeito === 'CONCEDIDA' ? add : delete`) faria a última linha da lista
 * vencer — o resultado passaria a depender da ordem em que os ajustes chegam, que é ordem de
 * consulta ao banco, isto é, nenhuma garantia. Com dois laços, **toda** negação é aplicada depois
 * de **toda** concessão, e a lista pode chegar em qualquer ordem.
 *
 * Devolve o conjunto **ordenado**: o efetivo viaja no registro de sessão e é comparado entre
 * requisições, e uma ordem estável é o que permite compará-lo sem normalizar de novo a cada leitura.
 *
 * @param perfil O perfil da pessoa — a origem do conjunto padrão.
 * @param ajustes Os ajustes individuais dela, já lidos. Ordem irrelevante, repetidos toleráveis.
 */
/**
 * Os efeitos que {@link calcularEfetivo} trata, um a um.
 *
 * Existe para que **acrescentar** um valor ao enum `negocio.efeito_permissao` quebre a compilação
 * aqui, em vez de atravessar os dois laços sem efeito algum. Renomear um valor já quebrava; somar um
 * terceiro, não — e ele seria ignorado do lado errado da segurança, porque um efeito futuro de
 * natureza restritiva (`NEGADA_POR_SUSPENSAO`, digamos) deixaria a chave no efetivo, numa função
 * cuja razão de existir é a precedência da negação.
 *
 * É o mesmo molde de `DESFECHO_POR_MOTIVO` (`autenticacao.ts`) e `STATUS_POR_CODIGO`
 * (`@sysloc/shared`): o `Record` sobre a união fechada é o que torna a exaustividade propriedade do
 * compilador. O valor de cada entrada é o próprio nome porque o que se consome aqui é a **chave** —
 * os dois laços abaixo comparam contra estas constantes, e é esse consumo que faz a garantia valer.
 */
const EFEITO: Readonly<Record<EfeitoDePermissao, EfeitoDePermissao>> = Object.freeze({
  CONCEDIDA: 'CONCEDIDA',
  NEGADA: 'NEGADA',
});

export function calcularEfetivo(
  perfil: Perfil,
  ajustes: readonly AjusteDePermissao[],
): readonly ChaveDoCatalogo[] {
  const efetivo = new Set<ChaveDoCatalogo>(MATRIZ_POR_PERFIL[perfil]);

  for (const ajuste of ajustes) {
    if (ajuste.efeito === EFEITO.CONCEDIDA) {
      efetivo.add(ajuste.chave);
    }
  }

  // A SUBTRAÇÃO É A ÚLTIMA OPERAÇÃO. Ver o cabeçalho deste arquivo: mover este laço para antes do
  // de cima, ou fundir os dois, desfaz a precedência da negação da ADR-0010 sem que nada mais no
  // sistema perceba. O CT-203 é o que reprova essa mudança.
  for (const ajuste of ajustes) {
    if (ajuste.efeito === EFEITO.NEGADA) {
      efetivo.delete(ajuste.chave);
    }
  }

  return [...efetivo].sort();
}

/**
 * Recusa o conjunto de ajustes que deixaria uma ação sensível concedida sem a área de tela que a
 * comporta (RN-02).
 *
 * **Examina o efetivo RESULTANTE, não a lista de ajustes**, e essa é a diferença que faz a regra
 * valer nos dois sentidos. A incoerência nasce por duas pontas: conceder a ação a quem não alcança
 * a área, e retirar a área de quem já tem a ação pelo perfil. Uma validação que olhasse só os
 * ajustes `CONCEDIDA` pegaria a primeira e deixaria a segunda passar — e a segunda é a mais
 * provável, porque quem a comete acha que está restringindo.
 *
 * **Levanta, nunca corrige.** A RN-02 é literal: *"recusada no momento de salvar (…) nunca aceita e
 * silenciosamente ignorada"*. Aparar a ação órfã do conjunto e seguir seria a saída cômoda, e é
 * justamente ela que a regra proíbe: o Admin sairia da tela achando que concedeu algo que não valeu.
 *
 * A varredura é sobre {@link CHAVES_DE_ACAO}, na ordem do catálogo, e não sobre o efetivo: com mais
 * de uma incoerência no mesmo conjunto, a que se reporta é sempre a mesma, e a mensagem não muda
 * conforme a ordem de iteração de um `Set`.
 *
 * @throws {ErroDeAplicacao} `CAMPO_INVALIDO` (`422`), com `campo: 'permissoes'` e, em `detalhes`,
 *   a tela que precisa ser liberada junto e a ação que a exige.
 */
export function validarCoerenciaDeAjustes(
  perfil: Perfil,
  ajustes: readonly AjusteDePermissao[],
): void {
  const efetivo = new Set<ChaveDoCatalogo>(calcularEfetivo(perfil, ajustes));

  for (const acao of CHAVES_DE_ACAO) {
    if (!efetivo.has(acao)) {
      continue;
    }

    const telaExigida = MAPA_ACAO_TELA[acao];
    if (efetivo.has(telaExigida)) {
      continue;
    }

    throw new ErroDeAplicacao(CodigoErro.CAMPO_INVALIDO, MENSAGEM_DE_ACAO_SEM_TELA, {
      campo: 'permissoes',
      detalhes: { telaExigida, acao },
    });
  }
}
