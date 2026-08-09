/**
 * Os esquemas de `@sysloc/contracts` — CT-334 a CT-338, CT-340, CT-341, mais CT-424, CT-428 e
 * CT-429, que a fatia `contratos-de-locacao` acrescenta.
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
 * | CA-19    | CT-424 | `esquemaDoContrato.status` é união fechada de exatamente
 * |          |        | `{RASCUNHO, ATIVO, CANCELADO, ENCERRADO}` — qualquer outro valor, inclusive
 * |          |        | o `RESCINDIDO` do sistema antigo, é recusado nomeando `status`. E o recurso
 * |          |        | publicado **não** expõe o UUID interno. |
 * | CA-19    | CT-424 | O corpo da montagem é `strictObject` completo: os CINCO campos que o
 * |          | (b)    | servidor decide (`codigo`, `status`, `dataFimLocacao`, `valorTotalContrato`,
 * |          |        | `empresaId`) são recusados como chave desconhecida, e cada campo do corpo
 * |          |        | tem a sua fronteira — inclusive `fiadoresIds` sem repetição. |
 * | CA-04    | CT-428 | O código é canonizado num ponto único (`trim` + maiúsculas) e a largura do
 * |          |        | sequencial é de CINCO dígitos: quatro é recusado, seis é recusado, e todo
 * |          |        | código que `formatarCodigoDeContrato` emite dentro da largura é aceito. |
 * | CA-01    | CT-428 | `valorMensal` e `prazoMeses` espelham as capacidades das colunas
 * |          | (b)    | (`numeric(15,2)` e `integer`), o PRODUTO delas também cabe, e a restrição de
 * |          |        | escala vale na ENTRADA e **não** na SAÍDA. |
 * | CA-06    | CT-429 | A resposta da ativação recusa qualquer `efeitos.cobrancasGeradas` diferente
 * |          |        | de `false` — contrato fechado no esquema, não comportamento observado. |
 *
 * Rastreabilidade: `CA-02 → CT-334, CT-335 (RN-10)` · `CA-14 → CT-337 (RN-01)` ·
 * `CA-15 → CT-338 (RN-06)` · `CA-16 → CT-336, CT-340, CT-341 (RN-11)` ·
 * `CA-19 → CT-424, CT-424 (b) (RN-02, RN-03)` · `CA-04 → CT-428 (RN-04)` ·
 * `CA-01 → CT-428 (b) (RN-08)` · `CA-06 → CT-429 (RN-12)`.
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
 * **CT-428** é a **rede** que o P4 do Protocolo Antirregressão exige do marcador `DECISÃO FECHADA`
 * da largura, e por isso ela prende a largura pelos **dois** lados. Só o lado de baixo (quatro
 * dígitos recusados) deixaria verde um esquema aberto em `\d{5,}`, e a largura seguiria sem asserção
 * por cima — o `CLAUDE.md` e o `plano-execucao.md` escrevem QUATRO, e a "correção" para quatro
 * passaria pela suíte se a rede fosse frouxa de um dos lados. A amarra `formatador × esquema` é a
 * terceira ponta: sem ela, os dois poderiam divergir e a emissão produziria código que a leitura
 * recusa.
 *
 * **CT-428 (b)** repete o desenho do CT-340 para o dinheiro, com um par a mais. Os tetos são escritos
 * **por extenso** pela mesma razão registrada lá: derivá-los das constantes deixaria as duas pontas
 * andando juntas e o caso verde num teto alargado. E o par que discrimina a restrição CONJUNTA usa
 * dois fatores **ambos dentro dos seus tetos** cujo produto não cabe — nenhum teto de campo isolado
 * o pega.
 *
 * **CT-429** afirma o literal no esquema, e não o comportamento na rota: é o que obriga a F3 a tocar
 * este arquivo para gerar cobrança, em vez de o significado da resposta mudar por omissão.
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
  ESCALA_MONETARIA,
  ESQUEMA_DO_CODIGO_DE_CONTRATO,
  ESTADOS_DO_CONTRATO,
  esquemaDaAtivacaoDeContrato,
  esquemaDaJanela,
  esquemaDeComodoNovo,
  esquemaDeContratoNovo,
  esquemaDeImovelNovo,
  esquemaDePessoaNova,
  esquemaDoContrato,
  esquemaDoImovel,
  formatarCodigoDeContrato,
  LARGURA_DO_SEQUENCIAL_DE_CONTRATO,
  MAIOR_METRAGEM,
  MAIOR_PAGINA,
  MAIOR_PRAZO_EM_MESES,
  MAIOR_VALOR_MONETARIO,
  PAGINA_PADRAO,
  PREFIXO_DO_CODIGO_DE_CONTRATO,
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

/** O identificador do fiador do contrato — o único item de `fiadoresIds`. */
const FIADOR = '3c4d5e6f-7081-4920-a3b4-c5d6e7f80912';

/** O corpo canônico de `POST /v1/contratos` (tech spec §4.1.1), completo e sem campo opcional. */
const CORPO_DE_CONTRATO = {
  imovelId: '6f1b0f5a-2c3d-4e5f-8a9b-0c1d2e3f4a5b',
  locadorId: '1a2b3c4d-5e6f-4708-9a0b-1c2d3e4f5061',
  locatarioId: '9f8e7d6c-5b4a-4392-8180-7f6e5d4c3b2a',
  fiadoresIds: [FIADOR],
  dataInicioLocacao: '2026-01-31',
  prazoMeses: 12,
  valorMensal: 2500,
  diaVencimento: 10,
  gerarCobrancasAutomaticamente: true,
  pdfContratoArquivo: null,
} as const;

/**
 * O contrato como a API o devolve, recém-montado (tech spec §4.1.1).
 *
 * `dataFimLocacao` e `valorTotalContrato` vêm nulos porque são derivados **na ativação** — é o
 * estado em que o recurso nasce, e o que o `201` do exemplo publica.
 */
const CONTRATO_PUBLICADO = {
  codigo: 'CTR-2026-00001',
  status: 'RASCUNHO',
  imovelId: CORPO_DE_CONTRATO.imovelId,
  locadorId: CORPO_DE_CONTRATO.locadorId,
  locatarioId: CORPO_DE_CONTRATO.locatarioId,
  fiadores: [{ id: FIADOR, nome: 'Carlos Fiador' }],
  dataInicioLocacao: CORPO_DE_CONTRATO.dataInicioLocacao,
  prazoMeses: CORPO_DE_CONTRATO.prazoMeses,
  valorMensal: CORPO_DE_CONTRATO.valorMensal,
  diaVencimento: CORPO_DE_CONTRATO.diaVencimento,
  dataFimLocacao: null,
  valorTotalContrato: null,
  gerarCobrancasAutomaticamente: true,
  pdfContratoArquivo: null,
  retiradoEm: null,
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
      // SUT_IS_CORRECT_BECAUSE: o código de produção está certo e era este corpo que descrevia o
      // imóvel **antes** da T9. `esquemaDoImovel` ganhou `contratoVigente` por decisão declarada
      // (ADR-0016 — um esquema só de imóvel), e o campo é preenchido **de propósito** aqui: o eixo
      // deste caso é o `LOCADO` da saída, e `LOCADO` é justamente o estado que a ativação de contrato
      // produz. Um `null` compilaria e passaria, e deixaria a forma nova sem exercício algum. Nenhuma
      // asserção foi alterada, afrouxada ou removida.
      contratoVigente: {
        codigo: 'CTR-2026-00001',
        locatario: { id: '9f1c0000-0000-4000-8000-00000000000b', nome: 'Bruno Locatário' },
      },
      retiradoEm: null,
    };

    const resultado = esquemaDoImovel.safeParse(imovel);

    expect(resultado.success).toBe(true);
    expect(resultado.data?.statusLocacao).toBe('LOCADO');
    // E o par que a ADR-0017 impõe atravessa intacto: o código legível do contrato (série declarada)
    // e o UUID do locatário (sem série). Sem esta linha, o campo novo entraria no corpo sem que nada
    // afirmasse o que ele carrega.
    expect(resultado.data?.contratoVigente).toEqual(imovel.contratoVigente);
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
 * As entradas cujo nome **não** começa pelo prefixo de entidade: as três janelas de listagem e o
 * corpo da rota de situação de locação.
 *
 * SUT_IS_CORRECT_BECAUSE: a constante chamava-se `NOMES_DAS_ENTRADAS_FORA_DO_PREFIXO` e o nome descrevia
 * o conjunto de ontem, não o critério. O critério sempre foi *"esquema de entrada que escaparia às
 * varreduras por não começar com `esquemaDe`"* — é o que os parágrafos abaixo já diziam —, e a T10
 * publicou o primeiro que não é janela: `esquemaDaSituacaoDeLocacao`. Manter o nome antigo faria a
 * lista parecer fechada em listagens e convidaria a próxima entrada fora do prefixo a ficar de fora.
 * **Nenhum alvo saiu**, e as duas varreduras alcançam estritamente mais do que antes.
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
 *
 * SUT_IS_CORRECT_BECAUSE: a T10 da fatia `contratos-de-locacao` publicou `esquemaDaSituacaoDeLocacao`
 * — o corpo de um campo só de `POST /v1/imoveis/:id/situacao-de-locacao`. Pelo mesmo motivo dos
 * parágrafos acima ele escaparia às duas varreduras, e é justamente o esquema em que "`empresaId`
 * não é declarado" e "o corpo é fechado" mais importam: ele é a única porta de requisição que escreve
 * a situação de locação. Nenhum alvo sai daqui; o conjunto só cresce.
 */
const NOMES_DAS_ENTRADAS_FORA_DO_PREFIXO = [
  'esquemaDaJanela',
  'esquemaDaJanelaComCirculacao',
  'esquemaDaJanelaDaCarteira',
  'esquemaDaSituacaoDeLocacao',
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
 *
 * SUT_IS_CORRECT_BECAUSE: subiu de 7 para 8 porque a T2 da fatia `contratos-de-locacao` publicou
 * `esquemaDeContratoNovo` — o corpo da montagem do contrato, que nasce nesta fonte única pela mesma
 * ADR-0016. Ele entra nas duas varreduras **sozinho**, pelo prefixo de entrada de entidade; o que
 * esta linha faz é subir a âncora para que a entrada nova seja contada, e não tolerada. A âncora
 * segue exata, e nenhum alvo saiu.
 *
 * SUT_IS_CORRECT_BECAUSE: subiu de 8 para 10 porque a T10 da mesma fatia publicou **dois** esquemas
 * de entrada — `esquemaDeImovelAlterado`, o corpo do `PUT` de imóvel derivado por `omit` do da
 * criação, e `esquemaDaSituacaoDeLocacao`, o corpo da rota que passa a ser a única porta de
 * requisição para a situação de locação. O primeiro entra pelo prefixo de entidade; o segundo, pela
 * lista acima. A âncora segue exata, e nenhum alvo saiu.
 */
const QUANTIDADE_DE_ESQUEMAS_DE_ENTRADA = 10;

/** Um corpo válido por esquema de entrada, indexado pelo nome exportado. */
const CORPOS_VALIDOS = new Map<string, Record<string, unknown>>([
  ['esquemaDeConjuntoNovo', { nome: 'Edifício Aurora' }],
  ['esquemaDeImovelNovo', { ...CORPO_DE_IMOVEL, statusLocacao: 'DISPONIVEL' }],
  // O corpo da alteração é o da criação **sem** `statusLocacao`, que é exatamente o que o `omit`
  // produz. Ele é o mesmo objeto que alimenta a linha acima, sem o acréscimo — e não uma segunda
  // lista de campos, que ficaria livre para divergir dela.
  ['esquemaDeImovelAlterado', { ...CORPO_DE_IMOVEL }],
  ['esquemaDaSituacaoDeLocacao', { statusLocacao: 'INDISPONIVEL' }],
  ['esquemaDeComodoNovo', { nomeComodo: 'Sala', metragem: 25.5, observacoes: null }],
  ['esquemaDePessoaNova', { ...CORPO_DE_PESSOA }],
  ['esquemaDeContratoNovo', { ...CORPO_DE_CONTRATO }],
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
        NOMES_DAS_ENTRADAS_FORA_DO_PREFIXO.includes(
          entrada[0] as (typeof NOMES_DAS_ENTRADAS_FORA_DO_PREFIXO)[number],
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

describe('CT-424 — o estado do contrato é união fechada de exatamente quatro valores', () => {
  /**
   * Os quatro estados escritos **por extenso**, e na ordem — o card do caso os fixa.
   *
   * A ordem é conteúdo: a T3 deriva `negocio.status_contrato` deste arranjo, e um enum do PostgreSQL
   * guarda a ordem dos rótulos. Derivar esta lista da constante exportada deixaria as duas pontas
   * andando juntas e o caso verde num quinto valor reintroduzido.
   */
  const ESTADOS_DECLARADOS = ['RASCUNHO', 'ATIVO', 'CANCELADO', 'ENCERRADO'] as const;

  it('a união publicada tem exatamente quatro valores, na ordem declarada', () => {
    expect([...ESTADOS_DO_CONTRATO]).toEqual([...ESTADOS_DECLARADOS]);
  });

  for (const estado of ESTADOS_DECLARADOS) {
    it(`aprova ${estado} e devolve o recurso verbatim`, () => {
      const contrato = { ...CONTRATO_PUBLICADO, status: estado };

      const resultado = esquemaDoContrato.safeParse(contrato);

      expect(resultado.success).toBe(true);
      expect(resultado.data?.status).toBe(estado);
      // Profundamente igual ao enviado: o esquema não acrescenta nem remove campo.
      expect(resultado.data).toEqual(contrato);
    });
  }

  const RECUSADOS: readonly { readonly rotulo: string; readonly valor: string }[] = [
    { rotulo: 'o quinto valor do sistema antigo, podado', valor: 'RESCINDIDO' },
    { rotulo: 'um valor arbitrário', valor: 'QUALQUER_OUTRO' },
    { rotulo: 'o mesmo estado em minúsculas', valor: 'ativo' },
    { rotulo: 'a situação de locação do imóvel, que é outro enum', valor: 'LOCADO' },
  ];

  for (const { rotulo, valor } of RECUSADOS) {
    it(`recusa ${rotulo} (${valor}) nomeando o campo status`, () => {
      const resultado = esquemaDoContrato.safeParse({ ...CONTRATO_PUBLICADO, status: valor });

      expect(resultado.success).toBe(false);
      expect(resultado.error?.issues[0]?.path).toEqual(['status']);
    });
  }

  it('o recurso publicado NÃO expõe o UUID interno (ADR-0017)', () => {
    // Metade declarativa: o campo não existe no contrato. Sozinha, ela não distingue
    // "não declarado" de "declarado e ignorado na leitura".
    expect(Object.keys(esquemaDoContrato.shape)).not.toContain('id');

    // Metade comportamental: um `id` que chegue de fora não atravessa o esquema. O corpo publicado
    // é exatamente o declarado, e a chave exposta é o `codigo`.
    const comUuidInterno = esquemaDoContrato.safeParse({
      ...CONTRATO_PUBLICADO,
      id: '5d6e7f80-9102-4a3b-8c4d-5e6f70819203',
    });

    expect(comUuidInterno.success).toBe(true);
    expect(comUuidInterno.data).toEqual(CONTRATO_PUBLICADO);
  });
});

describe('CT-424 (b) — o corpo da montagem é fechado, e cada campo tem a sua fronteira', () => {
  /**
   * Os CINCO campos que o servidor decide (§6.1) — nenhum deles é chave do corpo.
   *
   * `status` é o que a ADR-0019 tira do recurso; `codigo` vem da série; `dataFimLocacao` e
   * `valorTotalContrato` são derivados na ativação; `empresaId` sai da sessão. A lista é escrita por
   * extenso porque é ela que a RN-03 elimina como segunda fonte de estado.
   */
  const DECIDIDOS_PELO_SERVIDOR: readonly { readonly chave: string; readonly valor: unknown }[] = [
    { chave: 'status', valor: 'ATIVO' },
    { chave: 'codigo', valor: 'CTR-2026-00002' },
    { chave: 'dataFimLocacao', valor: '2027-01-30' },
    { chave: 'valorTotalContrato', valor: 30_000 },
    { chave: 'empresaId', valor: EMPRESA_ALHEIA },
  ];

  it('o corpo aprova a montagem completa, verbatim', () => {
    const resultado = esquemaDeContratoNovo.safeParse({ ...CORPO_DE_CONTRATO });

    expect(resultado.success).toBe(true);
    expect(resultado.data).toEqual({ ...CORPO_DE_CONTRATO });
  });

  for (const { chave, valor } of DECIDIDOS_PELO_SERVIDOR) {
    it(`recusa ${chave} como chave desconhecida`, () => {
      const resultado = esquemaDeContratoNovo.safeParse({ ...CORPO_DE_CONTRATO, [chave]: valor });

      expect(resultado.success).toBe(false);
      expect(resultado.error?.issues[0]?.code).toBe('unrecognized_keys');
      expect(resultado.error?.issues[0]).toMatchObject({ keys: [chave] });
    });
  }

  it('aplica o padrão true a gerarCobrancasAutomaticamente quando ele é omitido', () => {
    const { gerarCobrancasAutomaticamente: _omitido, ...semOPadrao } = CORPO_DE_CONTRATO;

    const resultado = esquemaDeContratoNovo.safeParse(semOPadrao);

    expect(resultado.success).toBe(true);
    expect(resultado.data?.gerarCobrancasAutomaticamente).toBe(true);
  });

  it('aceita a coleção de fiadores VAZIA — zero ou mais, sem teto (RD-06)', () => {
    const resultado = esquemaDeContratoNovo.safeParse({ ...CORPO_DE_CONTRATO, fiadoresIds: [] });

    expect(resultado.success).toBe(true);
    expect(resultado.data?.fiadoresIds).toEqual([]);
  });

  it('recusa o mesmo fiador duas vezes, inclusive em grafias de caixa diferentes', () => {
    // A conferência corre sobre os valores já CANONIZADOS — é a mesma repetição que a restrição
    // `unique (contrato_id, fiador_id)` enxergaria, e recusá-la aqui é o que dá nome ao campo.
    const repetido = esquemaDeContratoNovo.safeParse({
      ...CORPO_DE_CONTRATO,
      fiadoresIds: [FIADOR, FIADOR.toUpperCase()],
    });

    expect(repetido.success).toBe(false);
    expect(repetido.error?.issues[0]?.path).toEqual(['fiadoresIds']);
  });

  it('canoniza os identificadores em minúsculas, no corpo inteiro', () => {
    const resultado = esquemaDeContratoNovo.safeParse({
      ...CORPO_DE_CONTRATO,
      imovelId: CORPO_DE_CONTRATO.imovelId.toUpperCase(),
      fiadoresIds: [FIADOR.toUpperCase()],
    });

    expect(resultado.success).toBe(true);
    expect(resultado.data).toMatchObject({
      imovelId: CORPO_DE_CONTRATO.imovelId,
      fiadoresIds: [FIADOR],
    });
  });

  const CAMPOS_RECUSADOS: readonly {
    readonly rotulo: string;
    readonly remendo: Record<string, unknown>;
    readonly campo: string;
  }[] = [
    {
      rotulo: 'dia de vencimento acima de 28 (RD-08)',
      remendo: { diaVencimento: 29 },
      campo: 'diaVencimento',
    },
    { rotulo: 'dia de vencimento zero', remendo: { diaVencimento: 0 }, campo: 'diaVencimento' },
    {
      rotulo: 'data de início que o calendário não tem',
      remendo: { dataInicioLocacao: '2026-02-30' },
      campo: 'dataInicioLocacao',
    },
    {
      rotulo: 'data de início com hora — a coluna é date, não timestamp',
      remendo: { dataInicioLocacao: '2026-01-31T00:00:00Z' },
      campo: 'dataInicioLocacao',
    },
    {
      rotulo: 'identificador que não é UUID',
      remendo: { locatarioId: 'nao-e-uuid' },
      campo: 'locatarioId',
    },
  ];

  for (const { rotulo, remendo, campo } of CAMPOS_RECUSADOS) {
    it(`recusa ${rotulo} nomeando ${campo}`, () => {
      const resultado = esquemaDeContratoNovo.safeParse({ ...CORPO_DE_CONTRATO, ...remendo });

      expect(resultado.success).toBe(false);
      expect(resultado.error?.issues[0]?.path).toEqual([campo]);
    });
  }

  const DIAS_DE_VENCIMENTO_ACEITOS = [1, 28] as const;

  for (const dia of DIAS_DE_VENCIMENTO_ACEITOS) {
    it(`aprova o dia de vencimento ${dia}, que é fronteira`, () => {
      const resultado = esquemaDeContratoNovo.safeParse({
        ...CORPO_DE_CONTRATO,
        diaVencimento: dia,
      });

      expect(resultado.success).toBe(true);
      expect(resultado.data?.diaVencimento).toBe(dia);
    });
  }
});

describe('CT-428 — o código é canonizado num ponto único, e a largura é de cinco dígitos', () => {
  /**
   * O formato declarado, escrito **por extenso** — pela mesma razão do CT-338 e do CT-340.
   *
   * É a decisão que o marcador `DECISÃO FECHADA` de `contrato.ts` protege, e o valor foi MEDIDO no
   * sistema antigo (`autoname` = `CTR-.YYYY.-.#####`). Derivá-lo das constantes deixaria as duas
   * pontas andando juntas: uma largura "corrigida" para quatro — como o `CLAUDE.md` e o
   * `plano-execucao.md` escrevem — passaria pela suíte inteira sem uma recusa sequer.
   */
  const PREFIXO_DECLARADO = 'CTR';
  const LARGURA_DECLARADA_DO_SEQUENCIAL = 5;

  it('o formato publicado é exatamente o que as constantes declaram', () => {
    expect([PREFIXO_DO_CODIGO_DE_CONTRATO, LARGURA_DO_SEQUENCIAL_DE_CONTRATO]).toEqual([
      PREFIXO_DECLARADO,
      LARGURA_DECLARADA_DO_SEQUENCIAL,
    ]);
  });

  const ACEITOS: readonly {
    readonly rotulo: string;
    readonly entrada: string;
    readonly canonizado: string;
  }[] = [
    {
      rotulo: 'a forma canônica, que permanece igual',
      entrada: 'CTR-2026-00001',
      canonizado: 'CTR-2026-00001',
    },
    {
      rotulo: 'o mesmo código em minúsculas',
      entrada: 'ctr-2026-00001',
      canonizado: 'CTR-2026-00001',
    },
    {
      rotulo: 'o mesmo código cercado de espaços',
      entrada: '  CTR-2026-00001  ',
      canonizado: 'CTR-2026-00001',
    },
    {
      rotulo: 'caixa mista e espaços de uma vez',
      entrada: ' Ctr-2026-00042 ',
      canonizado: 'CTR-2026-00042',
    },
  ];

  for (const { rotulo, entrada, canonizado } of ACEITOS) {
    it(`aprova ${rotulo} devolvendo ${canonizado}`, () => {
      const resultado = ESQUEMA_DO_CODIGO_DE_CONTRATO.safeParse(entrada);

      expect(resultado.success).toBe(true);
      // Valor exato, e não "está definido": é a forma que o banco guarda e que toda comparação de
      // igualdade a jusante vai usar.
      expect(resultado.data).toBe(canonizado);
    });
  }

  const RECUSADOS: readonly { readonly rotulo: string; readonly valor: string }[] = [
    {
      rotulo: 'quatro dígitos — a largura que o CLAUDE.md e o plano escrevem por engano',
      valor: 'CTR-2026-0001',
    },
    { rotulo: 'seis dígitos', valor: 'CTR-2026-000001' },
    { rotulo: 'ano de dois dígitos', valor: 'CTR-26-00001' },
    { rotulo: 'o prefixo de outra série', valor: 'COB-2026-00001' },
    { rotulo: 'o código sem os separadores', valor: 'CTR202600001' },
    { rotulo: 'sequencial não numérico', valor: 'CTR-2026-0000A' },
    { rotulo: 'texto vazio', valor: '   ' },
  ];

  for (const { rotulo, valor } of RECUSADOS) {
    it(`recusa ${rotulo} (${JSON.stringify(valor)})`, () => {
      const resultado = ESQUEMA_DO_CODIGO_DE_CONTRATO.safeParse(valor);

      expect(resultado.success).toBe(false);
      expect(resultado.error?.issues[0]?.code).toBe('invalid_format');
    });
  }

  it('dentro do recurso publicado, a recusa nomeia o campo codigo', () => {
    // O esquema do código é escalar, e escalar não tem caminho a reportar: quando ele chega pelo
    // parâmetro da rota, o nome do campo é aposto pela borda (`validar(esquema, valor, 'codigo')`).
    // Dentro do recurso o campo se nomeia sozinho, e é esta metade que prova o `campo: 'codigo'`
    // que a §6.1 exige.
    const resultado = esquemaDoContrato.safeParse({
      ...CONTRATO_PUBLICADO,
      codigo: 'CTR-2026-0001',
    });

    expect(resultado.success).toBe(false);
    expect(resultado.error?.issues[0]?.path).toEqual(['codigo']);
  });

  /**
   * A amarra entre a EMISSÃO e a LEITURA — a terceira ponta da rede.
   *
   * Formatador e esquema saem das mesmas constantes; sem esta asserção os dois poderiam divergir e a
   * emissão produziria um código que a rota de leitura recusa, em silêncio, até o primeiro `GET`.
   */
  const SEQUENCIAIS_DENTRO_DA_LARGURA = [1, 20, 99_999] as const;

  for (const sequencial of SEQUENCIAIS_DENTRO_DA_LARGURA) {
    it(`o código emitido para o sequencial ${sequencial} é aceito pelo esquema`, () => {
      const codigo = formatarCodigoDeContrato(2026, sequencial);

      expect(ESQUEMA_DO_CODIGO_DE_CONTRATO.safeParse(codigo).data).toBe(codigo);
    });
  }

  it('o formatador preenche com zeros até a largura declarada', () => {
    expect(formatarCodigoDeContrato(2026, 1)).toBe('CTR-2026-00001');
    expect(formatarCodigoDeContrato(2026, 20)).toBe('CTR-2026-00020');
    expect(formatarCodigoDeContrato(2026, 99_999)).toBe('CTR-2026-99999');
  });

  it('o formatador NÃO trunca o sequencial que passa da largura — truncar seria colisão', () => {
    expect(formatarCodigoDeContrato(2026, 123_456)).toBe('CTR-2026-123456');
  });
});

describe('CT-428 (b) — os tetos do dinheiro e do prazo são a capacidade das colunas', () => {
  /**
   * O teto e a escala de `numeric(15,2)` e o teto de `integer`, escritos **por extenso**.
   *
   * Não são política de produto: são a **capacidade** das colunas (§7.2). Escrevê-los aqui é o que
   * prende o contrato ao banco — alargar a constante sem alargar a coluna reprova este caso, que é
   * exatamente a divergência que reabriria o defeito do `500` por `numeric field overflow`.
   */
  const TETO_DECLARADO_MONETARIO = 9_999_999_999_999.99;
  const ESCALA_DECLARADA_MONETARIA = 0.01;
  const TETO_DECLARADO_DO_PRAZO = 2_147_483_647;

  it('o teto e a escala do dinheiro são a precisão e a escala de numeric(15,2)', () => {
    expect([MAIOR_VALOR_MONETARIO, ESCALA_MONETARIA]).toEqual([
      TETO_DECLARADO_MONETARIO,
      ESCALA_DECLARADA_MONETARIA,
    ]);
  });

  it('o teto do prazo é a MENOR das duas capacidades a jusante — a coluna integer', () => {
    expect(MAIOR_PRAZO_EM_MESES).toBe(TETO_DECLARADO_DO_PRAZO);
  });

  const ACEITOS: readonly {
    readonly rotulo: string;
    readonly remendo: Record<string, unknown>;
  }[] = [
    { rotulo: 'um valor mensal comum', remendo: { valorMensal: 2500 } },
    { rotulo: 'exatamente a escala da coluna', remendo: { valorMensal: 2500.55 } },
    { rotulo: 'o menor valor representável', remendo: { valorMensal: 0.01 } },
    // Dízimas do binário: `0.29` e `8.11` não são exatos em ponto flutuante, e um resto ingênuo os
    // recusaria. Sem elas, a restrição de escala passaria a reprovar aluguel legítimo.
    { rotulo: 'uma dízima do binário', remendo: { valorMensal: 1200.29 } },
    { rotulo: 'outra dízima do binário', remendo: { valorMensal: 8.11 } },
    {
      rotulo: 'o teto monetário com o prazo mínimo — o produto ainda cabe',
      remendo: { valorMensal: MAIOR_VALOR_MONETARIO, prazoMeses: 1 },
    },
    { rotulo: 'o menor prazo', remendo: { valorMensal: 0.01, prazoMeses: 1 } },
    {
      rotulo: 'exatamente o teto do prazo, com o menor valor mensal',
      remendo: { valorMensal: 0.01, prazoMeses: MAIOR_PRAZO_EM_MESES },
    },
  ];

  const RECUSADOS: readonly {
    readonly rotulo: string;
    readonly remendo: Record<string, unknown>;
    readonly campo: string;
  }[] = [
    {
      rotulo: 'uma casa decimal além da escala — o arredondamento silencioso',
      remendo: { valorMensal: 2500.555 },
      campo: 'valorMensal',
    },
    { rotulo: 'muito abaixo da escala', remendo: { valorMensal: 0.001 }, campo: 'valorMensal' },
    { rotulo: 'acima do teto da coluna', remendo: { valorMensal: 1e14 }, campo: 'valorMensal' },
    {
      rotulo: 'a ordem de grandeza que o gate mediu na metragem',
      remendo: { valorMensal: 1e30 },
      campo: 'valorMensal',
    },
    { rotulo: 'valor mensal zero (RD-08)', remendo: { valorMensal: 0 }, campo: 'valorMensal' },
    { rotulo: 'valor mensal negativo', remendo: { valorMensal: -0.01 }, campo: 'valorMensal' },
    { rotulo: 'valor mensal nulo', remendo: { valorMensal: null }, campo: 'valorMensal' },
    { rotulo: 'prazo zero (RD-08)', remendo: { prazoMeses: 0 }, campo: 'prazoMeses' },
    { rotulo: 'prazo fracionário', remendo: { prazoMeses: 1.5 }, campo: 'prazoMeses' },
    {
      rotulo: 'um mês a mais que o teto da coluna integer',
      remendo: { prazoMeses: MAIOR_PRAZO_EM_MESES + 1 },
      campo: 'prazoMeses',
    },
    // O par que discrimina a restrição CONJUNTA: os dois fatores estão dentro dos seus tetos, e o
    // PRODUTO não cabe. Nenhum teto de campo isolado o pega — sem esta linha, a ativação levantaria
    // `numeric field overflow` e a borda devolveria 500 por entrada malformada de cliente.
    {
      rotulo: 'dois fatores válidos cujo produto estoura numeric(15,2)',
      remendo: { valorMensal: MAIOR_VALOR_MONETARIO, prazoMeses: 2 },
      campo: 'prazoMeses',
    },
    // O segundo par conjunto, com um valor mensal de ordem de grandeza plausível: acima de
    // `9_999_999_999_999.99 / 2_147_483_647 ≈ 4656.6`, o teto do prazo deixa de bastar sozinho.
    {
      rotulo: 'um valor mensal plausível no teto do prazo — o total estoura',
      remendo: { valorMensal: 5000, prazoMeses: MAIOR_PRAZO_EM_MESES },
      campo: 'prazoMeses',
    },
  ];

  for (const { rotulo, remendo } of ACEITOS) {
    it(`aprova ${rotulo}`, () => {
      const resultado = esquemaDeContratoNovo.safeParse({ ...CORPO_DE_CONTRATO, ...remendo });

      expect(resultado.success).toBe(true);
      expect(resultado.data).toMatchObject(remendo);
    });
  }

  for (const { rotulo, remendo, campo } of RECUSADOS) {
    it(`recusa ${rotulo} nomeando ${campo}`, () => {
      const resultado = esquemaDeContratoNovo.safeParse({ ...CORPO_DE_CONTRATO, ...remendo });

      expect(resultado.success).toBe(false);
      expect(resultado.error?.issues[0]?.path).toEqual([campo]);
    });
  }

  it('a SAÍDA não replica a escala — restringi-la derrubaria a rota em vez de recusar', () => {
    // A metade que discrimina a assimetria deliberada (ver o marcador `DECISÃO FECHADA` de
    // `ESCALA_DA_METRAGEM`, em `comum.ts`, e o docblock de `ESCALA_MONETARIA`). Sem ela, "simetrizar
    // entrada e saída" passaria pela suíte, e a primeira divergência a montante viraria queda.
    const resultado = esquemaDoContrato.safeParse({
      ...CONTRATO_PUBLICADO,
      valorMensal: 2500.555,
      valorTotalContrato: 30_006.659,
    });

    expect(resultado.success).toBe(true);
    expect(resultado.data?.valorMensal).toBe(2500.555);
    expect(resultado.data?.valorTotalContrato).toBe(30_006.659);
  });
});

describe('CT-429 — a resposta da ativação fixa efeitos.cobrancasGeradas em false', () => {
  /** O contrato como a ativação o devolve: `ATIVO`, com as duas derivações já preenchidas. */
  const CONTRATO_ATIVADO = {
    ...CONTRATO_PUBLICADO,
    status: 'ATIVO',
    dataFimLocacao: '2027-01-30',
    valorTotalContrato: 30_000,
  } as const;

  it('aprova a resposta com o efeito declarado em false', () => {
    const resposta = { ...CONTRATO_ATIVADO, efeitos: { cobrancasGeradas: false } };

    const resultado = esquemaDaAtivacaoDeContrato.safeParse(resposta);

    expect(resultado.success).toBe(true);
    expect(resultado.data).toEqual(resposta);
  });

  it('RECUSA o efeito afrouxado para true, nomeando o campo', () => {
    const resultado = esquemaDaAtivacaoDeContrato.safeParse({
      ...CONTRATO_ATIVADO,
      efeitos: { cobrancasGeradas: true },
    });

    expect(resultado.success).toBe(false);
    expect(resultado.error?.issues[0]?.code).toBe('invalid_value');
    expect(resultado.error?.issues[0]?.path).toEqual(['efeitos', 'cobrancasGeradas']);
  });

  it('RECUSA a resposta sem a declaração de efeito', () => {
    const resultado = esquemaDaAtivacaoDeContrato.safeParse({ ...CONTRATO_ATIVADO });

    expect(resultado.success).toBe(false);
    expect(resultado.error?.issues[0]?.path).toEqual(['efeitos']);
  });

  it('RECUSA efeito inventado ao lado do declarado — o bloco é fechado', () => {
    const resultado = esquemaDaAtivacaoDeContrato.safeParse({
      ...CONTRATO_ATIVADO,
      efeitos: { cobrancasGeradas: false, boletosEmitidos: 3 },
    });

    expect(resultado.success).toBe(false);
    expect(resultado.error?.issues[0]?.code).toBe('unrecognized_keys');
    expect(resultado.error?.issues[0]).toMatchObject({ keys: ['boletosEmitidos'] });
  });
});
