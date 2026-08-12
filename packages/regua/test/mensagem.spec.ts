/**
 * A composição do aviso — os dois moldes do oráculo, escolhidos pelo estado publicado.
 *
 * Rastreabilidade: CA-04 → CT-614 (RD-16); companheiro negativo em CA-08 → CT-614 (b), com a prova
 * pelas rotas reais em CT-630.
 *
 * INVARIANTES
 * - CT-614: `comporAvisoDeCobranca` produz o molde *"A vencer"* para a cobrança a vencer e o molde
 *   *"Vencida"* para a vencida, com o **assunto exato** de cada um (igualdade de cadeia inteira), e
 *   com o código, o valor formatado em pt-BR, o nome do locatário, os dados do imóvel e o
 *   vencimento no corpo — cada um por asserção própria.
 * - CT-614 (a): os **dois assuntos são diferentes entre si**, e os dois corpos também. É esta
 *   asserção que impede um compositor de molde único de passar em todas as outras.
 * - CT-614 (b): estado terminal — paga ou cancelada — **levanta** `ErroDeEstadoNaoAvisavel`, cuja
 *   mensagem é exatamente `estado não avisável: <estado>` e cujo campo `estado` traz o rótulo
 *   recusado, e **nenhuma mensagem é composta**. A recusa acontece antes de qualquer aviso existir.
 *   A asserção sobre o **tipo** e sobre o **campo** entrou na T6, com o fecho do D10 (F3/T4): é ela
 *   que permite à borda traduzir a recusa em `422` sem redigitar o texto, que não é publicado.
 * - CT-614 (c): o corpo sai em **texto puro** — nenhum `<br>` sobrevive da forma do legado, que
 *   compunha HTML dentro do arcabouço dele.
 *
 * ---------------------------------------------------------------------------
 * O texto é IMPLEMENTATION_DETAIL: snapshot é PROIBIDO aqui
 * ---------------------------------------------------------------------------
 *
 * Um instantâneo aceito sem leitura aprovaria qualquer texto, inclusive um corpo com o nome do
 * locatário errado. As asserções abaixo são específicas e cada uma nomeia o fato que prende: o
 * assunto por igualdade inteira, e os cinco elementos que a RD-16 exige por conteúdo. A referência
 * do legado está em `retorno.template` do golden `regua-de-cobranca.json`.
 *
 * ---------------------------------------------------------------------------
 * Os rótulos de estado são escritos por extenso AQUI, e isso é deliberado
 * ---------------------------------------------------------------------------
 *
 * Importá-los de `ESTADOS_DA_COBRANCA` faria a asserção concordar consigo mesma: o SUT escolhe o
 * molde a partir daquela mesma união, e uma reordenação dela passaria despercebida nas duas pontas.
 * Escritos como literais externos, a troca de ordem quebra este caso — é a rede que o cabeçalho de
 * `src/mensagem.ts` invoca.
 *
 * ⚠️ A proibição de literal de estado vale para `packages/regua/src/**` (CT-612), **não** para a
 * verificação: é justamente da fonte externa que vem o poder de detecção.
 */

import { describe, expect, it } from 'vitest';
import { comporAvisoDeCobranca, ErroDeEstadoNaoAvisavel } from '../src/mensagem.ts';
import type { CandidataAoAviso } from '../src/porta-de-dados.ts';

/**
 * A candidata a vencer — os valores do oráculo, com o código na série do produto novo.
 *
 * `valorTotal` chega em texto, como o banco o projeta (`numeric(15,2)`), e é o SUT que o traduz para
 * a forma que o aviso imprime. Declará-lo já formatado esvaziaria a asserção do valor.
 */
const CANDIDATA_A_VENCER: CandidataAoAviso = {
  codigo: 'COB-2026-0000001',
  dataVencimento: '2026-03-10',
  status: 'A_VENCER',
  valorTotal: '1100.00',
  destinatario: 'joao.locatario@exemplo.test',
  nomeDoLocatario: 'Joao Locatario',
  imovel: 'Imovel COB-001',
  conjunto: 'Conjunto Caracterizacao',
};

/** A candidata vencida — o mesmo locatário e o mesmo imóvel, para que o estado seja o ÚNICO eixo. */
const CANDIDATA_VENCIDA: CandidataAoAviso = {
  codigo: 'COB-2026-0000003',
  dataVencimento: '2026-02-05',
  status: 'VENCIDA',
  valorTotal: '1300.00',
  destinatario: 'joao.locatario@exemplo.test',
  nomeDoLocatario: 'Joao Locatario',
  imovel: 'Imovel COB-001',
  conjunto: 'Conjunto Caracterizacao',
};

/** Os assuntos, por extenso — a forma do oráculo, com o código da cobrança no fim. */
const ASSUNTO_A_VENCER = 'Aviso de vencimento - Fatura de aluguel COB-2026-0000001';
const ASSUNTO_VENCIDA = 'Pendencia financeira - Fatura de aluguel vencida COB-2026-0000003';

/** Os dois estados terminais, e o que a recusa precisa dizer sobre cada um. */
const ESTADOS_TERMINAIS: readonly CandidataAoAviso['status'][] = ['PAGA', 'CANCELADA'];

/**
 * A recusa levantada pela composição, com o tipo já estreitado — ou uma falha nomeada.
 *
 * O acessório existe para que a asserção sobre o **campo** `estado` não precise de `as` nem de `!`:
 * `catch` entrega `unknown`, e forçar o tipo trocaria uma falha de arranjo por um `undefined`
 * atravessando a comparação. A composição que NÃO levantasse também é reprovada aqui, e não passaria
 * por omissão.
 */
function recusaDe(candidata: CandidataAoAviso): ErroDeEstadoNaoAvisavel {
  try {
    comporAvisoDeCobranca(candidata);
  } catch (erro) {
    if (erro instanceof ErroDeEstadoNaoAvisavel) {
      return erro;
    }

    throw erro;
  }

  throw new Error(`a composição admitiu o estado terminal ${candidata.status}`);
}

describe('CT-614 — a mensagem é composta em dois moldes, com assunto, código, valor e nome exatos', () => {
  it('o molde a vencer traz o assunto exato, o código, o valor em pt-BR e o nome do locatário', () => {
    const aviso = comporAvisoDeCobranca(CANDIDATA_A_VENCER);

    expect(aviso.assunto).toBe(ASSUNTO_A_VENCER);
    expect(aviso.corpo).toContain('COB-2026-0000001');
    expect(aviso.corpo).toContain('R$ 1.100,00');
    expect(aviso.corpo).toContain('Prezado(a) Joao Locatario,');
    expect(aviso.corpo).toContain('Dados do imovel: Imovel COB-001 (Conjunto Caracterizacao).');
    expect(aviso.corpo).toContain('vencera em 10/03/2026');
  });

  it('o molde vencido traz o assunto exato, o código, o valor em pt-BR e o nome do locatário', () => {
    const aviso = comporAvisoDeCobranca(CANDIDATA_VENCIDA);

    expect(aviso.assunto).toBe(ASSUNTO_VENCIDA);
    expect(aviso.corpo).toContain('COB-2026-0000003');
    expect(aviso.corpo).toContain('R$ 1.300,00');
    expect(aviso.corpo).toContain('Prezado(a) Joao Locatario,');
    expect(aviso.corpo).toContain('Dados do imovel: Imovel COB-001 (Conjunto Caracterizacao).');
    expect(aviso.corpo).toContain('com vencimento em 05/02/2026');
  });

  it('CT-614 (a) — os dois assuntos, e os dois corpos, são diferentes entre si', () => {
    const aVencer = comporAvisoDeCobranca(CANDIDATA_A_VENCER);
    const vencida = comporAvisoDeCobranca(CANDIDATA_VENCIDA);

    // A desigualdade é a asserção que DISCRIMINA: sem ela, um compositor de molde único — que
    // ignorasse o estado e sempre escrevesse o mesmo texto — passaria em todas as demais.
    expect(aVencer.assunto).not.toBe(vencida.assunto);
    expect(aVencer.corpo).not.toBe(vencida.corpo);

    // E a diferença é a do oráculo, não uma qualquer: cada molde tem a própria linha de boleto.
    expect(aVencer.corpo).toContain('Para pagamento, utilize o boleto disponivel em:');
    expect(vencida.corpo).toContain('Para regularizacao, acesse o boleto:');
    expect(aVencer.corpo).not.toContain('Para regularizacao, acesse o boleto:');
    expect(vencida.corpo).not.toContain('Para pagamento, utilize o boleto disponivel em:');
  });

  it('CT-614 (c) — o corpo sai em texto puro: nenhum `<br>` do legado sobrevive', () => {
    const aVencer = comporAvisoDeCobranca(CANDIDATA_A_VENCER);
    const vencida = comporAvisoDeCobranca(CANDIDATA_VENCIDA);

    expect(aVencer.corpo).not.toContain('<br>');
    expect(vencida.corpo).not.toContain('<br>');
    // A divergência de forma é DELIBERADA e tem contrapartida: onde havia `<br>`, há quebra de
    // linha de verdade. Sem esta segunda asserção, um corpo de linha única passaria na primeira.
    expect(aVencer.corpo).toContain('\n');
    expect(vencida.corpo).toContain('\n');
  });

  describe('CT-614 (b) — estado terminal levanta nomeando o estado, e nenhuma mensagem é composta', () => {
    it.each(ESTADOS_TERMINAIS)('estado %s não compõe aviso algum', (status) => {
      const terminal: CandidataAoAviso = { ...CANDIDATA_VENCIDA, status };

      // SUT_IS_CORRECT_BECAUSE: a T6 fecha o D10 (F3/T4) trocando o `Error` genérico pela classe
      // `ErroDeEstadoNaoAvisavel`, que é o que permite à borda reconhecer a recusa por TIPO e ler o
      // estado do CAMPO, em vez de casar um texto que o pacote não publica. A forma anterior desta
      // asserção — `toThrowError(new Error(...))` — compara o objeto de erro INTEIRO no Vitest 4, e
      // por isso reprovava a classe nova pelo `name` e pelo campo `estado`, e não pela mensagem, que
      // continua idêntica byte a byte. As três asserções abaixo são estritamente MAIS FORTES do que
      // a que substituem: afirmam o tipo, a mensagem inteira por igualdade e o estado publicado.
      expect(() => comporAvisoDeCobranca(terminal)).toThrowError(ErroDeEstadoNaoAvisavel);

      const recusa = recusaDe(terminal);

      expect(recusa.message).toBe(`estado não avisável: ${status}`);
      expect(recusa.estado).toBe(status);
    });
  });
});
