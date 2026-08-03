/**
 * Alcance da sessão restrita, na camada mais baixa que o detecta — fechamento da F1 (débito D31
 * da §2 de `docs/specs/features/fundacao-multitenancy-identidade/v1/_run/run-report.md`).
 *
 * ---------------------------------------------------------------------------
 * INVARIANTES
 * ---------------------------------------------------------------------------
 *
 * | Critério | Caso   | Invariante |
 * |---|---|---|
 * | CA-09 | CT-105 | Sobre as QUATRO combinações de exigências pendentes × rota dentro e fora de
 * | CA-10 |        | `ROTAS_DA_SESSAO_RESTRITA`: a rota governada é sempre alcançada; fora dela, a
 * |       |        | sessão sem pendência alcança e a sessão com pendência recusa com a mensagem
 * |       |        | composta LITERAL, nomeando cada exigência na ordem de `RESTRICOES_DE_SESSAO`
 * |       |        | e unindo duas exigências por ` e `. (RN-08, RN-09) |
 *
 * Rastreabilidade: `CA-09 → CT-105 (RN-08)`, `CA-10 → CT-105 (RN-09)`.
 *
 * Faixa `CT-1xx` porque `CT-001..CT-032` está inteiramente atribuída pela tech spec da fatia —
 * mesma razão registrada em `packages/db/test/semente.spec.ts` e `packages/auth/test/sessao.spec.ts`.
 *
 * ---------------------------------------------------------------------------
 * Por que unit, e o que exatamente estava sem prova
 * ---------------------------------------------------------------------------
 *
 * O e2e irmão (`sessao-restrita.e2e.spec.ts`) exercita as pendências **uma de cada vez**: o CT-019
 * isola o segundo fator e o CT-021/CT-022 isolam a senha provisória. A combinação das DUAS
 * simultâneas não era exercitada em camada nenhuma — e ela é real: o primeiro acesso do Master no
 * onboarding da fatia `autorizacao-e-ciclo-de-acesso` tem as duas marcas de pé. O
 * `join(CONECTOR_DE_EXIGENCIAS)` com dois elementos era, portanto, código introduzido pela T10 e
 * nunca executado por asserção alguma.
 *
 * A camada é `unit` por ser a mais baixa que detecta (Iron Law #3): `sessaoRestritaPermite` é
 * função pura — sem pedido, sem banco e sem relógio —, e cobrir a combinação por e2e custaria
 * arranjar uma pessoa com as duas marcas para provar uma propriedade da composição da cadeia.
 *
 * ---------------------------------------------------------------------------
 * A mensagem é asserida por LITERAL, e isso é deliberado
 * ---------------------------------------------------------------------------
 *
 * `ABERTURA_DA_RECUSA`, `CUMPRIMENTO_POR_RESTRICAO` e `CONECTOR_DE_EXIGENCIAS` são privados do
 * módulo, e **é bom que sejam**: recompor a mensagem esperada a partir das constantes do próprio
 * SUT produziria a asserção tautológica que a §4 do run-report da fatia registra como defeito real
 * deste repositório — *"o CT-015 ficou verde sobre a política errada"*. Um literal só reprova
 * quando o texto que chega ao cliente muda, que é a propriedade que importa.
 *
 * O que isso torna detectável, e que nenhuma asserção anterior pegava: trocar o conector por `, `,
 * inverter a ordem das exigências, ou perder uma delas na composição.
 */

import { RESTRICOES_DE_SESSAO } from '@sysloc/auth';
import { describe, expect, it } from 'vitest';
import {
  type ExigenciasDaSessao,
  ROTAS_DA_SESSAO_RESTRITA,
  sessaoRestritaPermite,
} from '../src/autenticacao/sessao-restrita.ts';

/**
 * Rota que a guarda governa e que a sessão restrita alcança.
 *
 * Vem da constante exportada, e não de um literal: quem fixa o valor dela contra o dono do segmento
 * (`CAMINHO_DA_SESSAO`) é o CT-021, e repetir a comparação aqui seria a segunda definição da mesma
 * coisa. O que este arquivo afirma é o ALCANCE, não o endereço.
 */
const ROTA_GOVERNADA = primeiraRotaGovernada();

/**
 * A primeira rota governada, ou falha na CARGA do módulo.
 *
 * Falhar aqui, e não dentro de um caso, é deliberado: com a lista vazia o arranjo inteiro deste
 * arquivo deixa de significar o que ele diz — as pernas "dentro da lista" passariam a exercitar
 * `undefined` — e a falha alta e imediata é a única resposta honesta. É também o que satisfaz
 * `noUncheckedIndexedAccess` sem uma asserção de tipo que apagaria justamente esta verificação.
 */
function primeiraRotaGovernada(): string {
  const rota = ROTAS_DA_SESSAO_RESTRITA[0];

  if (rota === undefined) {
    throw new Error(
      'ROTAS_DA_SESSAO_RESTRITA está vazia — o arranjo de CT-105 não se sustenta sobre ela',
    );
  }

  return rota;
}

/**
 * Rota fora da lista — o companheiro negativo de toda linha da tabela.
 *
 * Literal, e de um recurso de negócio que ainda não existe: o eixo é "padrão que não está na lista
 * recusa", e derivá-lo de qualquer coisa do SUT o tornaria refém da mesma fonte que ele testa.
 */
const ROTA_DE_NEGOCIO = '/v1/contratos';

/**
 * As quatro combinações de exigências, com a mensagem LITERAL que cada uma produz fora da rota
 * governada. `mensagem: null` é a combinação que não recusa em lugar nenhum.
 */
const COMBINACOES: readonly {
  readonly rotulo: string;
  readonly exigencias: ExigenciasDaSessao;
  readonly mensagem: string | null;
}[] = [
  {
    rotulo: 'nenhuma exigência pendente',
    exigencias: { senhaProvisoria: false, segundoFatorPendente: false },
    mensagem: null,
  },
  {
    rotulo: 'apenas a senha provisória',
    exigencias: { senhaProvisoria: true, segundoFatorPendente: false },
    mensagem: 'acesso negado: esta sessão está restrita até a troca da senha provisória',
  },
  {
    rotulo: 'apenas o segundo fator',
    exigencias: { senhaProvisoria: false, segundoFatorPendente: true },
    mensagem: 'acesso negado: esta sessão está restrita até a configuração do segundo fator',
  },
  {
    // A combinação que nenhuma prova alcançava — a única em que o `join` recebe dois elementos.
    rotulo: 'as duas exigências ao mesmo tempo',
    exigencias: { senhaProvisoria: true, segundoFatorPendente: true },
    mensagem:
      'acesso negado: esta sessão está restrita até a troca da senha provisória e ' +
      'a configuração do segundo fator',
  },
];

describe('CT-105 — alcance da sessão restrita sobre as quatro combinações de exigências', () => {
  // Guarda de conjunto vazio, declarada como caso além de imposta na carga: ela nomeia a
  // precondição que as pernas "dentro da lista" assumem, em vez de deixá-la implícita.
  it('a lista de rotas governadas não está vazia', () => {
    expect(ROTAS_DA_SESSAO_RESTRITA.length).toBeGreaterThan(0);
  });

  // A tabela declara o vocabulário inteiro; se `RESTRICOES_DE_SESSAO` ganhar uma restrição nova,
  // as quatro combinações deixam de ser exaustivas e este caso reprova ANTES de as demais pernas
  // passarem a provar um subconjunto sem avisar.
  it('as combinações declaradas cobrem o vocabulário de restrições por completo', () => {
    expect(COMBINACOES).toHaveLength(2 ** RESTRICOES_DE_SESSAO.length);
  });

  for (const combinacao of COMBINACOES) {
    it(`alcança a rota governada com ${combinacao.rotulo}`, () => {
      expect(sessaoRestritaPermite(combinacao.exigencias, ROTA_GOVERNADA)).toEqual({
        permite: true,
      });
    });

    it(`fora da rota governada, com ${combinacao.rotulo}`, () => {
      const alcance = sessaoRestritaPermite(combinacao.exigencias, ROTA_DE_NEGOCIO);

      // Objeto inteiro, e não presença de campo: é o que a `testing-stack.md` exige do envelope, e
      // é o que impede a mensagem de mudar sem reprovar.
      expect(alcance).toEqual(
        combinacao.mensagem === null
          ? { permite: true }
          : { permite: false, mensagem: combinacao.mensagem },
      );
    });
  }
});
