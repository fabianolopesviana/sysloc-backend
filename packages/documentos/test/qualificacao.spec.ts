/**
 * A qualificação de uma parte do contrato — os eixos condicionais, e a recusa do que está fora da
 * união fechada.
 *
 * Rastreabilidade: CA-03 → CT-704 (RN-15) · CA-03 → CT-705 (RN-15).
 *
 * ---------------------------------------------------------------------------
 * INVARIANTES
 * ---------------------------------------------------------------------------
 *
 * | Critério | Caso | Invariante |
 * |---|---|---|
 * | CA-03 | CT-704 | Os três eixos medidos no `contrato-pdf-fonte.py` produzem o bloco correto, e
 * |       |        | cada caso é afirmado pelo trecho **inteiro**, por igualdade literal: (1) pessoa
 * |       |        | física com RG traz `cédula de identidade civil número MG-1234567`; (2) pessoa
 * |       |        | física sem RG **não** traz a cadeia `cédula de identidade civil` em lugar
 * |       |        | nenhum, e qualifica por `do CPF número`; (3) pessoa jurídica qualifica por
 * |       |        | `do CNPJ número`, com a máscara de catorze dígitos, e nunca pelo molde de RG;
 * |       |        | (4) pessoa jurídica **com `rg` sujo** — o cruzamento dos dois eixos — continua
 * |       |        | fora do molde de RG. A presença ou ausência do trecho de identidade civil é
 * |       |        | afirmada **no mesmo caso**, contra a constante que o SUT emite: um caso
 * |       |        | separado sobre a mesma tabela seria implicado pela igualdade acima (AP-26). |
 * | CA-03 | CT-704 | **(fiador)** O fiador **sem RG** é qualificado pelo mesmo molde das demais
 * |       |        | partes — `portador(a) **do** CPF número` —, afirmado pelo trecho **inteiro**,
 * |       |        | por igualdade literal. O molde que o legado escreve só para ele (linha 350,
 * |       |        | **sem** o `do`) é afirmado **ausente**, e a ausência tem companheiro: retirado
 * |       |        | o `do ` do texto do produto, o molde do legado aparece — logo a constante é um
 * |       |        | quase-acerto, e não uma cadeia que jamais casaria. A mesma igualdade é afirmada
 * |       |        | sobre o bloco `fiadores` do documento **composto**, que é o único caminho por
 * |       |        | onde um segundo molde escolhido por **papel** apareceria — a chamada direta,
 * |       |        | sozinha, não o alcança. É o único caso da suíte que toca o texto qualificado de
 * |       |        | um fiador; sem ele, o segundo molde deixa a suíte inteira verde. |
 * | CA-03 | CT-704 | O eixo resolve **uma vez**: o resultado da qualificação atravessa o documento
 * |       |        | inteiro sem que nenhuma das 21 cláusulas reabra a condição — afirmado pela
 * |       |        | contagem de ocorrências do trecho de identidade civil no documento composto. |
 * | CA-03 | CT-705 | `tipoPessoa` fora de `TIPOS_DE_PESSOA` **lança** `ErroDeTipoDePessoaDesconhecido`
 * |       |        | nomeando o campo e o valor recusado, tanto na qualificação isolada quanto na
 * |       |        | composição inteira — e nenhum documento parcial é produzido. O companheiro
 * |       |        | positivo afirma que o caminho válido **não** lança e que a cadeia `undefined`
 * |       |        | não aparece em bloco algum. |
 *
 * ===========================================================================
 * Por que este caso prova por COMPOSIÇÃO, e por que isso é resultado
 * ===========================================================================
 *
 * A T1 tentou capturar do sistema antigo um contrato real para cada eixo. O de **pessoa jurídica**
 * saiu (`contrato-pdf-pessoa-juridica.txt`, que também exercita a parte **sem** documento de
 * identidade); o de **fiador** não existe no legado, e a ausência foi registrada como *ausência
 * medida*. O PRD autoriza expressamente (§7.2) que o caminho sem oráculo continue provado por
 * composição — granularidade de bloco, não de documento inteiro. Isso é resultado, não lacuna.
 *
 * **Real execution boundary**: `none`. Nenhum mock — não há colaborador a dublar numa função pura.
 */

import { TIPOS_DE_PESSOA } from '@sysloc/contracts';
import { describe, expect, it } from 'vitest';
import { comporDocumentoDoContrato } from '../src/contrato/composicao.ts';
import type { DadosDoContratoParaDocumento, ParteDoContrato } from '../src/contrato/dados.ts';
import {
  ErroDeTipoDePessoaDesconhecido,
  qualificarParte,
  TRECHO_DA_IDENTIDADE_CIVIL,
} from '../src/contrato/qualificacao.ts';

/** O endereço comum aos três casos — o eixo sob prova é a identificação, não o endereço. */
const ENDERECO_COMUM = {
  logradouro: 'Avenida Central',
  numero: '1000',
  complemento: null,
  bairro: 'Centro',
  cidade: 'Caratinga',
  estado: 'MG',
  cep: '35300001',
} as const;

/** Como o endereço acima sai composto — escrito à mão, para não sair do próprio SUT. */
const ENDERECO_COMPOSTO = 'Avenida Central, 1000, Centro, Caratinga - MG, CEP 35300-001';

/** Um caso do eixo: a parte de entrada e o trecho inteiro que o produto deve emitir. */
interface CasoDeQualificacao {
  readonly nome: string;
  readonly parte: ParteDoContrato;
  readonly qualificacaoEsperada: string;
  readonly trazIdentidadeCivil: boolean;
}

const CASOS_DOS_EIXOS: readonly CasoDeQualificacao[] = [
  {
    nome: 'pessoa física COM cédula de identidade — o eixo com RG',
    parte: {
      nome: 'Maria Locadora',
      tipoPessoa: 'PESSOA_FISICA',
      documentoPrincipal: '11122233344',
      rg: 'MG-1234567',
      ...ENDERECO_COMUM,
    },
    qualificacaoEsperada: `Maria Locadora, portador(a) da cédula de identidade civil número MG-1234567, e do CPF número 111.222.333-44, residente e domiciliado em ${ENDERECO_COMPOSTO}`,
    trazIdentidadeCivil: true,
  },
  {
    nome: 'pessoa física SEM cédula de identidade — o trecho inteiro é omitido, não emitido vazio',
    parte: {
      nome: 'Maria Locadora',
      tipoPessoa: 'PESSOA_FISICA',
      documentoPrincipal: '11122233344',
      rg: null,
      ...ENDERECO_COMUM,
    },
    qualificacaoEsperada: `Maria Locadora, portador(a) do CPF número 111.222.333-44, residente e domiciliado em ${ENDERECO_COMPOSTO}`,
    trazIdentidadeCivil: false,
  },
  {
    nome: 'pessoa jurídica — qualifica por CNPJ, nunca pelo molde de RG',
    parte: {
      nome: 'Locadora Central Ltda',
      tipoPessoa: 'PESSOA_JURIDICA',
      documentoPrincipal: '11222333000181',
      rg: null,
      ...ENDERECO_COMUM,
    },
    qualificacaoEsperada: `Locadora Central Ltda, portador(a) do CNPJ número 11.222.333/0001-81, residente e domiciliado em ${ENDERECO_COMPOSTO}`,
    trazIdentidadeCivil: false,
  },
  {
    // ⚠️ Este é o caso que DISCRIMINA o cruzamento dos dois eixos, e sem ele a tabela não podia
    // falhar pelo defeito que persegue: com `rg: null` nos outros dois casos de pessoa jurídica, um
    // compositor que voltasse a emitir o molde de identidade civil para empresa passaria limpo —
    // medido, e o mutante sobreviveu antes desta linha existir. A decisão está registrada no
    // docblock de `../src/contrato/qualificacao.ts`: cédula de identidade civil é de pessoa
    // natural, e o dado sujo pode vir de migração, que não passa por esquema nenhum.
    nome: 'pessoa jurídica COM `rg` sujo — o molde de RG continua fora, e o eixo não se cruza',
    parte: {
      nome: 'Locadora Central Ltda',
      tipoPessoa: 'PESSOA_JURIDICA',
      documentoPrincipal: '11222333000181',
      rg: 'MG-0000001',
      ...ENDERECO_COMUM,
    },
    qualificacaoEsperada: `Locadora Central Ltda, portador(a) do CNPJ número 11.222.333/0001-81, residente e domiciliado em ${ENDERECO_COMPOSTO}`,
    trazIdentidadeCivil: false,
  },
];

/** Monta um agregado mínimo cujo locador é a parte sob prova — o resto não varia. */
function agregadoCom(locador: ParteDoContrato): DadosDoContratoParaDocumento {
  return {
    contrato: { prazoMeses: 12, valorMensal: 2500, diaVencimento: 10, valorTotalContrato: 30000 },
    locador,
    locatario: {
      nome: 'Joao Locatario',
      tipoPessoa: 'PESSOA_FISICA',
      documentoPrincipal: '55566677788',
      rg: null,
      ...ENDERECO_COMUM,
    },
    imovel: {
      nomeImovel: 'Imovel PDF-001',
      logradouro: 'Rua das Flores',
      numero: '120',
      complemento: 'Fundos',
      bairro: 'Centro',
      cidade: 'Caratinga',
      estado: 'MG',
      cep: '35300000',
    },
    fiadores: [],
    dataDeEmissao: '2026-08-13',
  };
}

describe('CT-704 — os três eixos condicionais da qualificação resolvem uma vez só', () => {
  it.each(CASOS_DOS_EIXOS)(
    'CT-704 — $nome',
    ({ parte, qualificacaoEsperada, trazIdentidadeCivil }) => {
      const qualificacao = qualificarParte(parte);

      // O trecho INTEIRO, por igualdade literal: "contém o CNPJ" passaria mesmo com o molde de RG
      // colado adiante, que é exatamente o que o caso 3 precisa discriminar.
      expect(qualificacao).toBe(qualificacaoEsperada);

      // As duas linhas abaixo moram DENTRO deste caso, e não num `it.each` próprio, porque a
      // igualdade acima já as determina por completo — um caso separado sobre a mesma tabela, a
      // mesma entrada e o mesmo alvo não podia reprovar sem que este reprovasse antes (AP-26). O
      // que elas acrescentam não é detecção, e sim a **amarração** do literal esperado à constante
      // que o SUT emite: três literais soltos ficariam livres para divergir, e a asserção de
      // ausência continuaria verde procurando um texto que ninguém mais escreve.
      expect(qualificacao.includes(TRECHO_DA_IDENTIDADE_CIVIL)).toBe(trazIdentidadeCivil);
      // E a cadeia curta, que é como um trecho vazio (`… civil número , e do CPF`) apareceria.
      expect(qualificacao.includes('cédula de identidade civil')).toBe(trazIdentidadeCivil);
    },
  );

  /**
   * O molde que o legado escreve **só para o fiador sem RG** — sem o `do` das outras duas partes.
   *
   * Está escrito à mão aqui, e não lido do SUT, porque o ponto do caso é justamente que o produto
   * **não** o emite: lê-lo de onde quer que fosse tornaria a asserção incapaz de reprovar.
   */
  const MOLDE_DO_LEGADO_SO_PARA_O_FIADOR = 'portador(a) CPF número';

  it('CT-704 (fiador) — o fiador usa o MESMO molde das demais partes, com o `do` (DECISÃO FECHADA)', () => {
    // A divergência deliberada com o legado: `contrato-pdf-fonte.py` linha 350 escreve
    // `, portador(a) " + f_doc_label + " número ` no ramo SEM RG do fiador, contra o `, portador(a)
    // do ` das linhas 133 e 228 (locador e locatário). O veredito está sob o marcador
    // `DECISÃO FECHADA` na linha de `qualificarParte`, em `../src/contrato/qualificacao.ts`.
    //
    // ⚠️ Sem este caso, um segundo molde reintroduzido dentro de `qualificarParte` — escolhido por
    // papel — deixaria a suíte INTEIRA verde: nenhuma outra asserção alcança o texto qualificado de
    // um fiador, e o eixo do fiador é ausência MEDIDA de oráculo (não existe golden com fiador), de
    // modo que o CT-709 nunca chega aqui. **Não "restaure a fidelidade" ao ver a diferença.**
    const fiadorSemRg: ParteDoContrato = {
      nome: 'Carlos Fiador',
      tipoPessoa: 'PESSOA_FISICA',
      documentoPrincipal: '99988877766',
      rg: null,
      ...ENDERECO_COMUM,
    };

    // O trecho INTEIRO, por igualdade literal — é o `do` que está sob prova, e ele some no meio de
    // uma asserção de presença.
    expect(qualificarParte(fiadorSemRg)).toBe(
      `Carlos Fiador, portador(a) do CPF número 999.888.777-66, residente e domiciliado em ${ENDERECO_COMPOSTO}`,
    );

    // E o negativo que nomeia o molde do legado: ele não aparece, nem como subcadeia.
    expect(qualificarParte(fiadorSemRg)).not.toContain(MOLDE_DO_LEGADO_SO_PARA_O_FIADOR);

    // O companheiro que impede a ausência acima de ficar verde por engano: retirado o `do ` do
    // texto que o PRODUTO emite, o molde do legado aparece. É o que prova que a constante é um
    // quase-acerto — e não uma cadeia qualquer, que jamais casaria e deixaria a asserção de ausência
    // verde para sempre.
    expect(qualificarParte(fiadorSemRg).replace('portador(a) do ', 'portador(a) ')).toContain(
      MOLDE_DO_LEGADO_SO_PARA_O_FIADOR,
    );

    // ⚠️ E a mesma afirmação **na posição de fiador**, pelo documento composto. A chamada direta
    // acima, sozinha, NÃO alcança o vetor: um segundo molde escolhido por PAPEL — a forma que o
    // lapso do legado teria de tomar aqui, já que esta função não recebe papel algum — só apareceria
    // quando a composição pedisse a qualificação de um fiador. É este par de asserções que fecha os
    // dois caminhos.
    const documento = comporDocumentoDoContrato(
      { ...agregadoCom(CASOS_DOS_EIXOS[0]?.parte ?? fiadorSemRg), fiadores: [fiadorSemRg] },
      { cancelado: false },
    );
    const blocoDosFiadores = documento.blocos.find((candidato) => candidato.rotulo === 'fiadores');

    expect(blocoDosFiadores?.texto).toBe(
      `FIADOR (A) (S): Como fiador(es) e principal(ais) pagador(es) das mensalidades do aluguel e demais obrigações constantes deste contrato, Carlos Fiador, portador(a) do CPF número 999.888.777-66, residente e domiciliado em ${ENDERECO_COMPOSTO}, até final satisfação das obrigações locacionais, vincendas tal como consumo de luz, água, IPTU e devolução das chaves ao(à) LOCADOR(A), renunciando expressamente ao benefício de ordem de que tratam os artigos 1.491, 1.500 e 1.503 do Código Civil Brasileiro.`,
    );
    for (const candidato of documento.blocos) {
      expect(candidato.texto).not.toContain(MOLDE_DO_LEGADO_SO_PARA_O_FIADOR);
    }
  });

  it('CT-704 (uma vez só) — o resultado atravessa o documento sem que cláusula alguma reabra a condição', () => {
    const [comRg] = CASOS_DOS_EIXOS;
    const semRg = CASOS_DOS_EIXOS[1];

    if (comRg === undefined || semRg === undefined) {
      throw new Error('a tabela dos eixos perdeu um caso');
    }

    const documentoComRg = comporDocumentoDoContrato(agregadoCom(comRg.parte), {
      cancelado: false,
    });
    const documentoSemRg = comporDocumentoDoContrato(agregadoCom(semRg.parte), {
      cancelado: false,
    });

    const ocorrencias = (documento: typeof documentoComRg): number =>
      documento.blocos.filter((candidato) => candidato.texto.includes(TRECHO_DA_IDENTIDADE_CIVIL))
        .length;

    // Exatamente UM bloco carrega o trecho — o do locador. Se alguma das 21 cláusulas reabrisse a
    // condição, este número seria outro; se a qualificação vazasse para o locatário (que aqui está
    // sem RG), também.
    expect(ocorrencias(documentoComRg)).toBe(1);
    expect(ocorrencias(documentoSemRg)).toBe(0);
  });
});

describe('CT-705 — companheiro negativo: tipo de pessoa fora da união fechada é recusado', () => {
  /** O valor fora da união — nem `PESSOA_FISICA` nem `PESSOA_JURIDICA`. */
  const TIPO_INVALIDO = 'ESTRANGEIRO';

  /** A parte corrompida, como chegaria de uma migração que não passou por esquema algum. */
  const PARTE_COM_TIPO_INVALIDO = {
    nome: 'Parte Estrangeira',
    // A conversão é deliberada e é o ponto do caso: o TypeScript barra o valor, e o dado real não
    // passa pelo TypeScript. Sem ela, este caso não poderia sequer ser escrito.
    tipoPessoa: TIPO_INVALIDO as ParteDoContrato['tipoPessoa'],
    documentoPrincipal: '11122233344',
    rg: 'MG-1234567',
    ...ENDERECO_COMUM,
  } satisfies ParteDoContrato;

  it('CT-705 (a) — o valor fora da união NÃO está em TIPOS_DE_PESSOA', () => {
    // Sem esta linha o caso poderia ficar tautológico no dia em que `ESTRANGEIRO` virasse um tipo
    // legítimo: ele continuaria "lançando" por outra razão, ou deixaria de lançar em silêncio.
    expect([...TIPOS_DE_PESSOA]).toEqual(['PESSOA_FISICA', 'PESSOA_JURIDICA']);
    expect([...TIPOS_DE_PESSOA]).not.toContain(TIPO_INVALIDO);
  });

  it('CT-705 (b) — a qualificação lança o erro nomeado, com o campo e o valor recusado', () => {
    expect(() => qualificarParte(PARTE_COM_TIPO_INVALIDO)).toThrow(ErroDeTipoDePessoaDesconhecido);

    // O tipo específico não basta: o campo e o valor viajam em propriedade, e é o que a borda
    // publicaria. Recortá-los da mensagem seria análise sintática que falha em silêncio.
    try {
      qualificarParte(PARTE_COM_TIPO_INVALIDO);
      expect.unreachable('a qualificação deveria ter recusado o tipo fora da união');
    } catch (erro) {
      expect(erro).toBeInstanceOf(ErroDeTipoDePessoaDesconhecido);
      const recusa = erro as ErroDeTipoDePessoaDesconhecido;
      expect(recusa.campo).toBe('tipoPessoa');
      expect(recusa.valor).toBe(TIPO_INVALIDO);
      expect(recusa.name).toBe('ErroDeTipoDePessoaDesconhecido');
    }
  });

  it('CT-705 (c) — a composição inteira recusa, e nenhum documento parcial é produzido', () => {
    expect(() =>
      comporDocumentoDoContrato(agregadoCom(PARTE_COM_TIPO_INVALIDO), { cancelado: false }),
    ).toThrow(ErroDeTipoDePessoaDesconhecido);
  });

  it('CT-705 (d) — companheiro positivo: o caminho válido não lança e não encaixa `undefined`', () => {
    const valida = CASOS_DOS_EIXOS[0];

    if (valida === undefined) {
      throw new Error('a tabela dos eixos perdeu o primeiro caso');
    }

    const documento = comporDocumentoDoContrato(agregadoCom(valida.parte), { cancelado: false });

    for (const candidato of documento.blocos) {
      expect(candidato.texto).not.toContain('undefined');
      expect(candidato.texto).not.toContain('null');
    }
  });
});
