/**
 * Os esquemas de `@sysloc/contracts` — CT-334 a CT-338, mais CT-340 e CT-341.
 *
 * ---------------------------------------------------------------------------
 * INVARIANTES
 * ---------------------------------------------------------------------------
 *
 * | Critério | CT     | Invariante |
 * |----------|--------|------------|
 * | CA-02    | CT-334 | O esquema de ENTRADA de imóvel aprova `DISPONIVEL` e `INDISPONIVEL` em
 * |          |        | `statusLocacao`, devolvendo o valor **verbatim** e um corpo profundamente
 * |          |        | igual ao enviado — nenhum campo acrescentado nem removido. |
 * | CA-02    | CT-335 | `LOCADO` é recusado na ENTRADA com `issues[0].path === ['statusLocacao']`,
 * |          |        | e aprovado na SAÍDA — a restrição é do esquema de entrada, não do enum. |
 * | CA-16    | CT-336 | TODO esquema de entrada publicado recusa chave desconhecida com
 * |          |        | `unrecognized_keys`, e aprova o mesmo corpo sem ela. |
 * | CA-14    | CT-337 | `empresaId` não é declarado no `shape` de nenhum esquema de entrada, e
 * |          |        | enviá-lo recusa nomeando a chave. |
 * | CA-15    | CT-338 | A janela aprova `limite` igual ao teto devolvendo-o verbatim e RECUSA
 * |          |        | `teto + 1` — pedido acima do teto nunca é truncado em silêncio. |
 * | CA-16    | CT-340 | `metragem` espelha as DUAS metades de `numeric(10,2)`: aprova o teto e
 * |          |        | `25.55` verbatim, e RECUSA `teto + 1` e `25.555` nomeando o campo — nenhum
 * |          |        | valor aprovado pelo contrato estoura o `INSERT` (500) nem é gravado com
 * |          |        | valor diferente do enviado (arredondamento silencioso). |
 * | CA-16    | CT-341 | O endereço é canonizado num ponto único: `estado` volta em maiúsculas e
 * |          |        | `cep` volta sem máscara, iguais em imóvel e em pessoa. |
 *
 * Rastreabilidade: `CA-02 → CT-334, CT-335 (RN-10)` · `CA-14 → CT-337 (RN-01)` ·
 * `CA-15 → CT-338 (RN-06)` · `CA-16 → CT-336, CT-340, CT-341 (RN-11)`.
 *
 * ---------------------------------------------------------------------------
 * Por que os casos vêm em pares, e por que nenhum deles sozinho serve
 * ---------------------------------------------------------------------------
 *
 * **CT-334 × CT-335.** Só o positivo deixaria verde um esquema que aceitasse o enum inteiro; só o
 * negativo deixaria verde um esquema que recusasse tudo. E a segunda metade do CT-335 — a SAÍDA
 * aprovando `LOCADO` — é o que impede a "correção" mais tentadora e mais errada: apagar `LOCADO` do
 * enum do domínio faria a entrada recusá-lo e deixaria a fatia de contratos sem como devolver o
 * valor que ela mesma produz.
 *
 * **CT-338.** A fronteira do teto é `<= MAIOR_PAGINA`. Provar só o lado aceito deixaria verde um
 * teto maior; provar só o recusado deixaria verde um teto menor. É o mesmo desenho do par
 * CT-013/CT-014 de `packages/auth/test/senha.spec.ts`, e o teto é **lido da constante exportada** —
 * redigitar `200` aqui faria o caso sobreviver a um teto alargado na constante, que é justamente o
 * mutante que ele precisa detectar.
 *
 * **CT-336 e CT-337** afirmam a contagem exata de esquemas examinados. Sem ela, *"nenhum esquema
 * violou"* seria indistinguível de *"nenhum esquema foi olhado"* — e a tabela é montada a partir dos
 * símbolos EXPORTADOS pelo pacote, não de uma lista redigitada, para que um esquema de entrada novo
 * entre nas duas varreduras sozinho (ou reprove por não ter corpo válido declarado).
 *
 * Sem colaborador algum: os esquemas são funções puras. Fronteira real de execução: **nenhuma**.
 * As asserções são comportamentais — exercitam o esquema e observam o desfecho —, e por isso não
 * exigem prova de falsificação; a asserção estática desta task é o CT-339, em `folha.spec.ts`.
 */

import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import * as contratos from '../src/index.ts';
import {
  ESCALA_DA_METRAGEM,
  esquemaDaJanela,
  esquemaDeComodoNovo,
  esquemaDeImovelNovo,
  esquemaDePessoaNova,
  esquemaDoImovel,
  MAIOR_METRAGEM,
  MAIOR_PAGINA,
  PAGINA_PADRAO,
  SITUACOES_INFORMAVEIS,
} from '../src/index.ts';

/** O corpo canônico de `POST /v1/imoveis` (tech spec §4.1.1), sem `statusLocacao`. */
const CORPO_DE_IMOVEL = {
  conjuntoId: '9f1c0000-0000-4000-8000-000000000001',
  nomeImovel: 'Ap 101',
  identificadorMunicipal: '12345.678.9012-3',
  tipoImovel: 'RESIDENCIAL',
  logradouro: 'Rua X',
  numero: '100',
  complemento: null,
  bairro: 'Centro',
  cidade: 'São Paulo',
  estado: 'SP',
  cep: '01000000',
  observacoes: null,
} as const;

/** Um cadastro de pessoa completo e válido — o corpo de `POST /v1/locadores`. */
const CORPO_DE_PESSOA = {
  nome: 'Ana Alves',
  tipoPessoa: 'PESSOA_FISICA',
  documentoPrincipal: '12345678909',
  rg: null,
  email: 'ana@exemplo.com.br',
  telefone: '11999990000',
  logradouro: 'Rua Y',
  numero: '20',
  complemento: null,
  bairro: 'Centro',
  cidade: 'São Paulo',
  estado: 'SP',
  cep: '01000000',
} as const;

/** Identificador de outra empresa — o valor que a metade comportamental do CT-337 tenta enfiar. */
const EMPRESA_ALHEIA = 'b0000000-0000-4000-8000-000000000002';

/** A chave inventada do CT-336. */
const CHAVE_EXTRA = 'campoInventado';

describe('CT-334 — a ENTRADA de imóvel aceita as duas situações que o usuário informa', () => {
  /**
   * Os dois valores estão escritos por extenso de propósito — o card do caso os fixa. A asserção
   * seguinte prende a lista literal ao que o pacote publica: se `SITUACOES_INFORMAVEIS` mudar, é
   * aqui que se descobre, e não numa rota três tasks adiante.
   */
  const ACEITOS = ['DISPONIVEL', 'INDISPONIVEL'] as const;

  it('a lista exercitada é exatamente a que o pacote declara informável', () => {
    expect([...SITUACOES_INFORMAVEIS]).toEqual([...ACEITOS]);
  });

  for (const situacao of ACEITOS) {
    it(`aprova ${situacao} e devolve o corpo verbatim`, () => {
      const corpo = { ...CORPO_DE_IMOVEL, statusLocacao: situacao };

      const resultado = esquemaDeImovelNovo.safeParse(corpo);

      expect(resultado.success).toBe(true);
      expect(resultado.data?.statusLocacao).toBe(situacao);
      // Profundamente igual ao enviado: o esquema não acrescenta nem remove campo. É o que impede
      // um `.default()` ou um `.omit()` distraído de mudar o corpo por baixo do controlador.
      expect(resultado.data).toEqual(corpo);
    });
  }
});

describe('CT-335 — LOCADO é recusado na ENTRADA e aceito na SAÍDA', () => {
  const RECUSADOS: readonly { readonly rotulo: string; readonly valor: string }[] = [
    { rotulo: 'o valor que só a ativação de contrato produz', valor: 'LOCADO' },
    { rotulo: 'a mesma situação em minúsculas', valor: 'disponivel' },
    { rotulo: 'a mesma situação em caixa mista', valor: 'Indisponivel' },
    { rotulo: 'uma situação que não existe no enum', valor: 'ALUGADO' },
  ];

  for (const { rotulo, valor } of RECUSADOS) {
    it(`recusa ${rotulo} (${valor}) nomeando o campo`, () => {
      const resultado = esquemaDeImovelNovo.safeParse({
        ...CORPO_DE_IMOVEL,
        statusLocacao: valor,
      });

      expect(resultado.success).toBe(false);
      expect(resultado.error?.issues[0]?.path).toEqual(['statusLocacao']);
    });
  }

  it('a SAÍDA aprova LOCADO — a restrição é do esquema de entrada, não do enum', () => {
    const imovel = {
      id: '9f1c0000-0000-4000-8000-000000000009',
      conjuntoId: CORPO_DE_IMOVEL.conjuntoId,
      nomeImovel: CORPO_DE_IMOVEL.nomeImovel,
      identificadorMunicipal: CORPO_DE_IMOVEL.identificadorMunicipal,
      tipoImovel: CORPO_DE_IMOVEL.tipoImovel,
      logradouro: CORPO_DE_IMOVEL.logradouro,
      numero: CORPO_DE_IMOVEL.numero,
      complemento: CORPO_DE_IMOVEL.complemento,
      bairro: CORPO_DE_IMOVEL.bairro,
      cidade: CORPO_DE_IMOVEL.cidade,
      estado: CORPO_DE_IMOVEL.estado,
      cep: CORPO_DE_IMOVEL.cep,
      statusLocacao: 'LOCADO',
      observacoes: CORPO_DE_IMOVEL.observacoes,
      comodos: [
        {
          id: '9f1c0000-0000-4000-8000-00000000000a',
          nomeComodo: 'Sala',
          metragem: 25.5,
          posicao: 1,
          observacoes: null,
        },
      ],
      metragemTotal: 25.5,
      retiradoEm: null,
    };

    const resultado = esquemaDoImovel.safeParse(imovel);

    expect(resultado.success).toBe(true);
    expect(resultado.data?.statusLocacao).toBe('LOCADO');
  });
});

/**
 * Um esquema de entrada sob teste, com o corpo válido que o exercita.
 *
 * O `rotulo` é o nome exportado — é ele que aparece na mensagem de falha e diz QUAL esquema violou.
 */
interface EntradaSobTeste {
  readonly rotulo: string;
  readonly esquema: z.ZodObject;
  readonly corpoValido: Record<string, unknown>;
}

/**
 * Todo esquema de ENTRADA de entidade nasce com este prefixo — `esquemaDeConjuntoNovo`,
 * `esquemaDeImovelNovo`, `esquemaDeComodoNovo`, `esquemaDePessoaNova`. Os de SAÍDA usam
 * `esquemaDo`/`esquemaDa`, e por isso não caem aqui.
 */
const PREFIXO_DE_ENTRADA_DE_ENTIDADE = 'esquemaDe';

/**
 * As entradas que **não** são de entidade: as duas janelas de listagem.
 *
 * SUT_IS_CORRECT_BECAUSE: era uma constante de nome único, e a T8 publicou um segundo esquema de
 * entrada fora do prefixo de entidade — `esquemaDaJanelaComCirculacao`, a promoção da extensão
 * `incluirRetirados` que vivia copiada em dois controladores (débito D7). Com o nome único, ele
 * **escaparia** às duas varreduras, e as afirmações que elas fazem — *todo* esquema de entrada é
 * `strictObject`, `empresaId` não é declarado em *nenhum* — passariam a ser verdadeiras por
 * omissão. Nenhum alvo sai daqui; o conjunto só cresce.
 *
 * SUT_IS_CORRECT_BECAUSE: a T10 publicou um terceiro esquema de entrada fora do prefixo de entidade
 * — `esquemaDaJanelaDaCarteira`, a janela de `/v1/conjuntos` estendida com `expandir`, que a
 * ADR-0016 obriga a nascer no esquema em vez de numa conferência escrita no controlador. Pelo mesmo
 * motivo do parágrafo acima, com o nome único ele **escaparia** às duas varreduras. Nenhum alvo sai
 * daqui; o conjunto só cresce.
 */
const NOMES_DAS_ENTRADAS_DE_LISTAGEM = [
  'esquemaDaJanela',
  'esquemaDaJanelaComCirculacao',
  'esquemaDaJanelaDaCarteira',
] as const;

/**
 * Quantos esquemas de entrada o pacote publica hoje — quatro entidades mais as duas janelas.
 *
 * O valor é **exato** de propósito: sem ele, "nenhum esquema violou" seria indistinguível de
 * "nenhum esquema foi olhado", que é a forma clássica de uma varredura passar provando nada.
 *
 * SUT_IS_CORRECT_BECAUSE: subiu de 5 para 6 porque a T8 publicou `esquemaDaJanelaComCirculacao`
 * por decisão declarada (fonte única do contrato, ADR-0016 — ver o débito D7). A âncora de
 * igualdade **sobe**, nunca afrouxa: continua sendo comparação exata, e um esquema de entrada que
 * suma daqui segue reprovando.
 *
 * SUT_IS_CORRECT_BECAUSE: subiu de 6 para 7 porque a T10 publicou `esquemaDaJanelaDaCarteira` pela
 * mesma decisão — o parâmetro `expandir` da carteira nasce no esquema, e não numa conferência
 * escrita no controlador (ADR-0016). A âncora segue exata, e nenhum alvo saiu.
 */
const QUANTIDADE_DE_ESQUEMAS_DE_ENTRADA = 7;

/** Um corpo válido por esquema de entrada, indexado pelo nome exportado. */
const CORPOS_VALIDOS = new Map<string, Record<string, unknown>>([
  ['esquemaDeConjuntoNovo', { nome: 'Edifício Aurora' }],
  ['esquemaDeImovelNovo', { ...CORPO_DE_IMOVEL, statusLocacao: 'DISPONIVEL' }],
  ['esquemaDeComodoNovo', { nomeComodo: 'Sala', metragem: 25.5, observacoes: null }],
  ['esquemaDePessoaNova', { ...CORPO_DE_PESSOA }],
  ['esquemaDaJanela', { limite: 10, deslocamento: 0 }],
  // O corpo declara `incluirRetirados` **por extenso**, e não o omite deixando o padrão agir: é o
  // parâmetro que este esquema acrescenta, e um corpo que não o exercitasse deixaria a varredura
  // provando apenas o que a janela-base já prova.
  ['esquemaDaJanelaComCirculacao', { limite: 10, deslocamento: 0, incluirRetirados: 'false' }],
  // O corpo declara `expandir` **por extenso**, pela mesma razão da linha acima: é o parâmetro que
  // este esquema acrescenta, e um corpo que o omitisse deixaria a varredura provando apenas o que a
  // janela com circulação já prova.
  [
    'esquemaDaJanelaDaCarteira',
    { limite: 10, deslocamento: 0, incluirRetirados: 'false', expandir: 'imoveis' },
  ],
]);

/**
 * A tabela dos esquemas de entrada, descoberta a partir dos símbolos EXPORTADOS pelo pacote.
 *
 * Não é uma lista redigitada: um esquema de entrada novo entra sozinho nas varreduras do CT-336 e
 * do CT-337. Se ele chegar sem corpo válido declarado acima, a construção **levanta** — a suíte não
 * o examina em silêncio nem o pula.
 */
const ESQUEMAS_DE_ENTRADA: readonly EntradaSobTeste[] = (
  Object.entries(contratos) as readonly (readonly [string, unknown])[]
)
  .filter(
    (entrada): entrada is readonly [string, z.ZodObject] =>
      (entrada[0].startsWith(PREFIXO_DE_ENTRADA_DE_ENTIDADE) ||
        NOMES_DAS_ENTRADAS_DE_LISTAGEM.includes(
          entrada[0] as (typeof NOMES_DAS_ENTRADAS_DE_LISTAGEM)[number],
        )) &&
      entrada[1] instanceof z.ZodObject,
  )
  .map(([rotulo, esquema]) => {
    const corpoValido = CORPOS_VALIDOS.get(rotulo);
    if (corpoValido === undefined) {
      throw new Error(
        `o esquema de entrada '${rotulo}' não tem corpo válido declarado em CORPOS_VALIDOS`,
      );
    }
    return { rotulo, esquema, corpoValido };
  });

/**
 * A precondição COMPARTILHADA pelo CT-336 e pelo CT-337 — e por isso afirmada uma vez só.
 *
 * Os dois casos varrem a MESMA tabela, montada uma vez no escopo do módulo. Duas asserções idênticas
 * sobre a mesma constante não acrescentam poder de detecção: a segunda só pode falhar se a primeira
 * já tiver falhado. Ela é a guarda de ambos — sem ela, *"nenhum esquema violou"* seria
 * indistinguível de *"nenhum esquema foi olhado"* nos dois casos de uma vez.
 *
 * Rastreabilidade preservada: `CA-14, CA-16 → CT-336, CT-337`.
 */
describe('CT-336 / CT-337 — a tabela de esquemas de entrada é a superfície inteira', () => {
  it(`examina exatamente ${QUANTIDADE_DE_ESQUEMAS_DE_ENTRADA} esquemas de entrada`, () => {
    expect(ESQUEMAS_DE_ENTRADA).toHaveLength(QUANTIDADE_DE_ESQUEMAS_DE_ENTRADA);
  });
});

describe('CT-336 — todo esquema de entrada é strictObject', () => {
  for (const { rotulo, esquema, corpoValido } of ESQUEMAS_DE_ENTRADA) {
    it(`${rotulo} aprova o corpo válido e recusa a chave desconhecida`, () => {
      expect(esquema.safeParse(corpoValido).success).toBe(true);

      const comChaveExtra = esquema.safeParse({ ...corpoValido, [CHAVE_EXTRA]: 'x' });

      expect(comChaveExtra.success).toBe(false);
      expect(comChaveExtra.error?.issues[0]?.code).toBe('unrecognized_keys');
      expect(comChaveExtra.error?.issues[0]).toMatchObject({ keys: [CHAVE_EXTRA] });
    });
  }
});

describe('CT-337 — empresaId não é declarado em nenhum esquema de entrada', () => {
  for (const { rotulo, esquema, corpoValido } of ESQUEMAS_DE_ENTRADA) {
    it(`${rotulo} não declara empresaId e recusa quem o envia`, () => {
      // Metade declarativa: o campo não existe no contrato. Sozinha, ela não distingue
      // "não declarado" de "declarado e opcional".
      expect(Object.keys(esquema.shape)).not.toContain('empresaId');

      // Metade comportamental: enviá-lo recusa nomeando a chave. Sozinha, ela não distingue
      // "recusado por chave desconhecida" de "recusado por tipo".
      const comEmpresa = esquema.safeParse({ ...corpoValido, empresaId: EMPRESA_ALHEIA });

      expect(comEmpresa.success).toBe(false);
      expect(comEmpresa.error?.issues[0]?.code).toBe('unrecognized_keys');
      expect(comEmpresa.error?.issues[0]).toMatchObject({ keys: ['empresaId'] });
    });
  }
});

describe('CT-338 — a janela RECUSA limite acima do teto, em vez de truncar', () => {
  /**
   * A política da janela, escrita **por extenso** — e a única coisa deste caso que é literal.
   *
   * As janelas exercitadas abaixo derivam da constante exportada (é o que o card exige, e é o que
   * pega o teto alargado **no esquema**: `.max(MAIOR_PAGINA * 5)` deixaria `MAIOR_PAGINA + 1`
   * passar). Só isso, porém, não pega o teto alargado **na própria constante**: as duas pontas
   * andariam juntas e o caso seguiria verde — mutante medido, `MAIOR_PAGINA = 500` sobrevivia às
   * trinta asserções. Estes dois números são o que torna o teto uma **decisão**, e não um valor que
   * o teste descobre a cada rodada. Mesmo desenho de `TETO_DECLARADO_DA_PAGINA` no `CT-226 (b)` da
   * F1, e pela mesma razão escrita lá.
   */
  const TETO_DECLARADO_DA_PAGINA = 200;
  const PADRAO_DECLARADO_DA_PAGINA = 50;

  it('a política da janela está amarrada ao que o pacote publica', () => {
    expect([PAGINA_PADRAO, MAIOR_PAGINA]).toEqual([
      PADRAO_DECLARADO_DA_PAGINA,
      TETO_DECLARADO_DA_PAGINA,
    ]);
  });

  const ACEITAS: readonly {
    readonly rotulo: string;
    readonly janela: Record<string, unknown>;
    readonly limite: number;
    readonly deslocamento: number;
  }[] = [
    {
      rotulo: 'a menor janela',
      janela: { limite: 1, deslocamento: 0 },
      limite: 1,
      deslocamento: 0,
    },
    {
      rotulo: 'exatamente o teto',
      janela: { limite: MAIOR_PAGINA, deslocamento: 0 },
      limite: MAIOR_PAGINA,
      deslocamento: 0,
    },
    {
      rotulo: 'limite ausente',
      janela: { deslocamento: 7 },
      limite: PAGINA_PADRAO,
      deslocamento: 7,
    },
    { rotulo: 'janela vazia', janela: {}, limite: PAGINA_PADRAO, deslocamento: 0 },
  ];

  const RECUSADAS: readonly {
    readonly rotulo: string;
    readonly janela: Record<string, unknown>;
    readonly campo: string;
  }[] = [
    { rotulo: 'um a mais que o teto', janela: { limite: MAIOR_PAGINA + 1 }, campo: 'limite' },
    { rotulo: 'limite zero', janela: { limite: 0 }, campo: 'limite' },
    { rotulo: 'limite fracionário', janela: { limite: 1.5 }, campo: 'limite' },
    { rotulo: 'deslocamento negativo', janela: { deslocamento: -1 }, campo: 'deslocamento' },
  ];

  for (const { rotulo, janela, limite, deslocamento } of ACEITAS) {
    it(`aprova ${rotulo} devolvendo o valor verbatim`, () => {
      const resultado = esquemaDaJanela.safeParse(janela);

      expect(resultado.success).toBe(true);
      expect(resultado.data?.limite).toBe(limite);
      expect(resultado.data?.deslocamento).toBe(deslocamento);
    });
  }

  for (const { rotulo, janela, campo } of RECUSADAS) {
    it(`recusa ${rotulo} nomeando ${campo}`, () => {
      const resultado = esquemaDaJanela.safeParse(janela);

      expect(resultado.success).toBe(false);
      expect(resultado.error?.issues[0]?.path).toEqual([campo]);
    });
  }
});

describe('CT-340 — a metragem espelha a precisão E a escala de numeric(10,2)', () => {
  /**
   * O teto da metragem, escrito **por extenso** — pela mesma razão do CT-338, e com um agravante.
   *
   * Aqui o número não é política de produto: é a **capacidade** de `numeric(10,2)` (§7.2), que são
   * dez dígitos com dois decimais. Escrevê-lo aqui é o que prende o contrato à coluna: se alguém
   * alargar `MAIOR_METRAGEM` sem alargar a coluna, este caso reprova — e é exatamente a divergência
   * que reabriria o defeito, porque o contrato voltaria a aprovar valor que o `INSERT` recusa.
   * Derivar o literal da constante deixaria as duas pontas andando juntas e o caso verde.
   */
  const TETO_DECLARADO_DA_METRAGEM = 99_999_999.99;

  /**
   * A escala declarada — o `2` de `numeric(10,2)`, pela mesma razão do teto acima.
   *
   * `numeric(10,2)` tem duas metades, e provar só o teto deixaria a outra aberta: `25.555` cabia na
   * coluna e **mudava de valor** ao entrar nela, voltando ao cliente como `25.56`.
   */
  const ESCALA_DECLARADA_DA_METRAGEM = 0.01;

  it('o teto e a escala do contrato são a precisão e a escala da coluna numeric(10,2)', () => {
    expect([MAIOR_METRAGEM, ESCALA_DA_METRAGEM]).toEqual([
      TETO_DECLARADO_DA_METRAGEM,
      ESCALA_DECLARADA_DA_METRAGEM,
    ]);
  });

  const ACEITAS: readonly {
    readonly rotulo: string;
    readonly corpo: Record<string, unknown>;
    readonly metragem: number;
  }[] = [
    { rotulo: 'o piso', corpo: { nomeComodo: 'Sala', metragem: 0 }, metragem: 0 },
    { rotulo: 'uma metragem comum', corpo: { nomeComodo: 'Sala', metragem: 25.5 }, metragem: 25.5 },
    {
      rotulo: 'exatamente a escala da coluna',
      corpo: { nomeComodo: 'Sala', metragem: 25.55 },
      metragem: 25.55,
    },
    // A dízima do binário é o risco óbvio de `multipleOf`: `0.29` e `8.11` não são exatos em ponto
    // flutuante, e um resto ingênuo os recusaria. Sem estas duas linhas, a restrição de escala
    // passaria a reprovar metragem legítima e ninguém saberia até a primeira rota.
    {
      rotulo: 'uma dízima do binário',
      corpo: { nomeComodo: 'Sala', metragem: 0.29 },
      metragem: 0.29,
    },
    {
      rotulo: 'outra dízima do binário',
      corpo: { nomeComodo: 'Sala', metragem: 8.11 },
      metragem: 8.11,
    },
    {
      rotulo: 'exatamente o teto',
      corpo: { nomeComodo: 'Sala', metragem: MAIOR_METRAGEM },
      metragem: MAIOR_METRAGEM,
    },
    { rotulo: 'metragem ausente (RN-02)', corpo: { nomeComodo: 'Sala' }, metragem: 0 },
  ];

  const RECUSADAS: readonly { readonly rotulo: string; readonly metragem: unknown }[] = [
    { rotulo: 'um a mais que o teto', metragem: MAIOR_METRAGEM + 1 },
    { rotulo: 'a ordem de grandeza que o gate mediu', metragem: 1e30 },
    { rotulo: 'abaixo do piso', metragem: -0.01 },
    // Uma casa decimal além da escala. É o par de `25.55` acima: só o lado aceito deixaria verde uma
    // escala mais fina; só o recusado, uma escala mais grossa.
    { rotulo: 'uma casa decimal além da escala', metragem: 25.555 },
    { rotulo: 'muito abaixo da escala', metragem: 0.001 },
    { rotulo: 'nulo explícito', metragem: null },
  ];

  for (const { rotulo, corpo, metragem } of ACEITAS) {
    it(`aprova ${rotulo} devolvendo o valor verbatim`, () => {
      const resultado = esquemaDeComodoNovo.safeParse(corpo);

      expect(resultado.success).toBe(true);
      expect(resultado.data?.metragem).toBe(metragem);
    });
  }

  for (const { rotulo, metragem } of RECUSADAS) {
    it(`recusa ${rotulo} nomeando metragem`, () => {
      const resultado = esquemaDeComodoNovo.safeParse({ nomeComodo: 'Sala', metragem });

      expect(resultado.success).toBe(false);
      expect(resultado.error?.issues[0]?.path).toEqual(['metragem']);
    });
  }
});

describe('CT-341 — o endereço é canonizado num ponto único, igual nas duas entidades', () => {
  /**
   * As duas entidades que compõem `camposDeEndereco()`. A varredura é sobre as DUAS de propósito:
   * o ponto único só é ponto único se as duas o consumirem, e canonizar numa e esquecer na outra é
   * exatamente a divergência que a composição existe para impedir.
   */
  const PORTADORAS_DE_ENDERECO: readonly {
    readonly rotulo: string;
    readonly esquema: z.ZodObject;
    readonly corpoValido: Record<string, unknown>;
  }[] = [
    {
      rotulo: 'esquemaDeImovelNovo',
      esquema: esquemaDeImovelNovo,
      corpoValido: { ...CORPO_DE_IMOVEL, statusLocacao: 'DISPONIVEL' },
    },
    { rotulo: 'esquemaDePessoaNova', esquema: esquemaDePessoaNova, corpoValido: CORPO_DE_PESSOA },
  ];

  for (const { rotulo, esquema, corpoValido } of PORTADORAS_DE_ENDERECO) {
    it(`${rotulo} devolve estado em MAIÚSCULAS e cep sem máscara`, () => {
      const resultado = esquema.safeParse({ ...corpoValido, estado: ' sp ', cep: '01001-000' });

      expect(resultado.success).toBe(true);
      // Valor exato, não "está definido": é a forma canônica que o banco guarda e que toda
      // comparação de igualdade a jusante vai usar.
      expect(resultado.data).toMatchObject({ estado: 'SP', cep: '01001000' });
    });

    it(`${rotulo} recusa estado fora de duas letras e cep que não tem oito dígitos`, () => {
      const estadoLongo = esquema.safeParse({ ...corpoValido, estado: 'sao' });

      expect(estadoLongo.success).toBe(false);
      expect(estadoLongo.error?.issues[0]?.path).toEqual(['estado']);

      // Sete dígitos: a máscara sai, e o que sobra continua não sendo um CEP. Sem esta metade,
      // "remove a máscara" seria indistinguível de "aceita qualquer coisa".
      const cepCurto = esquema.safeParse({ ...corpoValido, cep: '0100-100' });

      expect(cepCurto.success).toBe(false);
      expect(cepCurto.error?.issues[0]?.path).toEqual(['cep']);
    });
  }
});
