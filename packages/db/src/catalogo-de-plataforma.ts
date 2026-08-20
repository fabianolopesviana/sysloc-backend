/**
 * Guarda de admissão do schema `plataforma` — a segunda metade da ADR-0031, materializada.
 *
 * ---------------------------------------------------------------------------
 * Por que este módulo existe, e por que `catalogo.ts` NÃO é editado
 * ---------------------------------------------------------------------------
 *
 * O cabeçalho de `./catalogo.ts` declara uma restrição para toda manutenção futura **daquele
 * arquivo**: *"nenhum nome de tabela entra em posição executável aqui"* — nem em conjunto permitido,
 * nem em exceção conhecida, nem em filtro de conveniência —, porque uma lista *"sabe apenas o que
 * alguém lembrou de escrever nela"*, e é exatamente a tabela nova que ninguém lembra de acrescentar.
 *
 * A ADR-0031, por sua vez, exige que *"o roster de tabelas de `plataforma` seja **enumerado**, de
 * modo que uma tabela nova ali só entre por alteração explícita e revisada"*.
 *
 * **As duas não se contradizem, e a diferença é a DIREÇÃO da lista.** Em `negocio`, enumerar seria
 * **isentar**: a lista diria quais tabelas escapam da RLS, e uma tabela esquecida escaparia em
 * silêncio — a omissão APROVA. Em `plataforma`, enumerar é **admitir**: a lista diz quais tabelas
 * têm licença para viver fora do alcance da RLS, e uma tabela esquecida **reprova** — a omissão
 * RECUSA. *O modo de falha da omissão se inverte junto com a direção*, e é por isso que a mesma
 * forma que seria defeito lá é a decisão aqui.
 *
 * Daí a separação física: pôr um nome de tabela em posição executável dentro de `catalogo.ts`
 * contrariaria a restrição escrita nele. Este arquivo é o lugar onde nome de tabela **pode** ser
 * escrito à mão, e o parágrafo acima é o que impede a distinção de precisar ser redescoberta.
 *
 * ---------------------------------------------------------------------------
 * O roster tem UMA tabela, e ela entrou pela alteração explícita que a ADR pede
 * ---------------------------------------------------------------------------
 *
 * Até a fatia `emissao-e-conciliacao`, `plataforma` guardava uma sequência e duas funções (migração
 * `0016`) e **nenhuma tabela** — e o roster vazio era a afirmação de que ninguém tinha licença para
 * morar fora do alcance da RLS. A fatia `webhook-e-carne` traz a primeira: a notícia crua do
 * provedor (`plataforma.notificacao_bancaria`, migração `0019`), gravada **antes** do roteamento e
 * por isso sem empresa derivável. Ela entrou por alteração deste arquivo, visível no diff, que é
 * literalmente o que a ADR-0031 pede.
 *
 * ---------------------------------------------------------------------------
 * As DUAS metades do retorno, e por que a segunda não é ornamento AQUI menos que lá
 * ---------------------------------------------------------------------------
 *
 * A guarda devolve as exceções **e** as tabelas examinadas, pela razão que o cabeçalho de
 * `./catalogo.ts` já registra: `excecoes: []` é o resultado CORRETO de um schema íntegro, e é também
 * o que uma consulta apontada para o schema errado, ou com filtro apertado demais, devolveria. "Nada
 * violou" e "nada foi olhado" produzem o mesmo veredito e só se distinguem por `tabelasExaminadas`.
 * Quem consome afirma as duas coisas na mesma asserção.
 *
 * ⚠️ **Com o roster povoado, o vácuo deixou de ser MUDO — e a segunda metade continua obrigatória.**
 * A consulta que não alcançasse schema nenhum hoje produziria uma exceção `AUSENTE_DO_BANCO` por
 * entrada do roster, em vez de `excecoes: []`; o vácuo passou a ter sintoma. O que **não** mudou é o
 * que quem consome tem de afirmar: `tabelasExaminadas` continua sendo afirmado **contra o roster**,
 * e não contra o vazio, porque é a igualdade entre os dois conjuntos que a metade (b) da ADR-0031
 * pede — e porque um roster que voltasse a esvaziar devolveria o vácuo à mudez sem que asserção
 * alguma acusasse.
 *
 * ---------------------------------------------------------------------------
 * A fonte é `pg_catalog`, e NÃO o `information_schema` — refutado por medição
 * ---------------------------------------------------------------------------
 *
 * DECISÃO FECHADA — F4/T5 · 2026-08-14
 * O QUÊ: as duas leituras deste módulo (objetos do schema e colunas de cada um) saem de
 *        `pg_catalog.pg_class`/`pg_catalog.pg_attribute`, e **não** das views do
 *        `information_schema`.
 * POR QUÊ: as views do `information_schema` são filtradas por PRIVILÉGIO — elas só mostram o objeto
 *          sobre o qual o papel corrente tem algum privilégio de tabela ou de coluna. Medido em
 *          instância efêmera, com o papel real `sysloc_app` e `has_schema_privilege('plataforma',
 *          'USAGE') = true`: criada `plataforma.residuo_com_empresa (id uuid, empresa_id uuid)` pelo
 *          papel de migração e sem `GRANT` algum, `information_schema.tables` e
 *          `information_schema.columns` devolveram **lista vazia** para aquele schema, enquanto
 *          `pg_class` devolveu a tabela. Uma guarda escrita sobre o `information_schema` responderia
 *          `{ excecoes: [], tabelasExaminadas: [] }` — indistinguível do schema íntegro — para
 *          exatamente o caso que ela existe para pegar: a tabela estacionada em `plataforma` sem
 *          revisão, que é justamente a que ninguém se lembra de conceder privilégio. O
 *          `information_schema` esconde o intruso porque ele é intruso.
 * REVERTER EXIGE: provar que a view escolhida enxerga objeto sobre o qual o papel que conecta não
 *                 tem privilégio algum — isto é, exibir a medição acima devolvendo a tabela. A
 *                 ADR-0031 pede a admissão conferida *"no catálogo do sistema"*, e `pg_catalog` é o
 *                 catálogo; o `information_schema` é uma projeção padronizada dele, com um recorte
 *                 que o transforma em resposta sobre PRIVILÉGIO, não sobre EXISTÊNCIA.
 *
 * ---------------------------------------------------------------------------
 * O que entra no exame — o conjunto é definido por EXCLUSÃO, como em `./catalogo.ts`
 * ---------------------------------------------------------------------------
 *
 * Ficam de fora as mesmas quatro espécies que a guarda de isolamento exclui — índice (`i`, `I`),
 * sequência (`S`), tipo composto (`c`) e tabela TOAST (`t`) —, e **todo o resto é examinado**. A
 * razão é a mesma, e ela vale aqui com um exemplo vivo: `plataforma.identificador_bancario_seq` é
 * uma sequência, existe hoje, e não é tabela — enumerar o que ENTRA no exame aprovaria em silêncio a
 * espécie que a enumeração esquecesse, e é assim que uma visão materializada estacionada em
 * `plataforma` passaria despercebida. Definido por exclusão, o que ninguém previu cai DENTRO, e
 * reprova por não estar no roster.
 *
 * Que a sequência fica de fora **e** que o índice de uma tabela intrusa fica de fora não são
 * afirmações declarativas: as duas são falsificáveis pelo `tabelasExaminadas` que os casos afirmam
 * por igualdade.
 *
 * ---------------------------------------------------------------------------
 * As duas propriedades, e a ORDEM em que são cobradas
 * ---------------------------------------------------------------------------
 *
 * Por objeto examinado, e nesta ordem:
 *
 *   1. **não carrega coluna de empresa** — `CARREGA_COLUNA_DE_EMPRESA`;
 *   2. **está no roster declarado** — `FORA_DO_ROSTER`.
 *
 * **Cada objeto rende no máximo UMA exceção: a primeira propriedade ausente** — mesmo contrato de
 * saída de `./catalogo.ts`, e pela mesma razão: quem consome imprime uma linha por exceção e conta
 * exceções, de modo que a contagem é o número de objetos a corrigir.
 *
 * A ordem é normativa, e ela **não** é arbitrária: uma tabela tenantizada estacionada em
 * `plataforma` está simultaneamente fora do roster e carregando coluna de empresa, e o motivo
 * reportado decide qual correção quem lê vai fazer. `FORA_DO_ROSTER` convida a acrescentá-la ao
 * roster — que é a correção ERRADA, e a mais barata de escrever. `CARREGA_COLUNA_DE_EMPRESA` diz o
 * que a ADR-0031 decide: dado com dono-empresa mora em `negocio`, sob RLS, e a saída é tirá-la
 * daqui. Inverter a ordem é trocar a mensagem "isto está no schema errado" por "esqueceram de te
 * cadastrar", e é o mutante que os casos matam.
 *
 * ⚠️ **`AUSENTE_DO_BANCO` NÃO entra nesta ordem, e não é uma terceira propriedade.** Ele não fala de
 * objeto examinado — fala de entrada do roster que o banco não tem. Não há linha de catálogo sobre a
 * qual cobrar propriedade alguma, e por isso ele não disputa com os dois acima: uma tabela ausente
 * do banco jamais aparece em `tabelasExaminadas`, e uma tabela examinada jamais rende
 * `AUSENTE_DO_BANCO`. Os conjuntos são disjuntos por construção.
 *
 * ---------------------------------------------------------------------------
 * A igualdade é nas duas direções, e a SEGUNDA ganhou conteúdo nesta fatia
 * ---------------------------------------------------------------------------
 *
 * A metade (b) da ADR-0031 pede o conjunto observado **igual** ao roster, e não contido nele.
 * Enquanto o roster era vazio, as duas direções eram a mesma afirmação — `observado ⊆ roster` já
 * implicava `observado = ∅`, e `roster ⊆ observado` era verdade por vacuidade —, e este cabeçalho
 * registrava que *"a fatia que puser a PRIMEIRA tabela no roster muda esse fato"*. Ela é a
 * `webhook-e-carne`, e o que era agenda virou código:
 *
 *   * **observado \ roster** — a tabela que está no banco e ninguém admitiu:
 *     `FORA_DO_ROSTER`;
 *   * **roster \ observado** — a tabela declarada e **ausente do banco**:
 *     `AUSENTE_DO_BANCO`.
 *
 * A segunda direção não é simetria decorativa. Ela pega o que nenhuma outra asserção pega: o nome
 * que ficou no roster depois de a tabela ser renomeada, dropada ou nunca migrada. Sem ela, um roster
 * que descreve um banco que não existe passa verde — e a licença que ele concede fica valendo para
 * um nome que ninguém mais escreve, enquanto a tabela real que herdou os dados entra por
 * `FORA_DO_ROSTER` e convida à correção errada (acrescentar a nova, deixando a velha).
 *
 * ⚠️ **Os dois lados vêm da MESMA leitura.** `tabelasExaminadas` é o conjunto observado, e as duas
 * diferenças são calculadas contra ele — não há segunda consulta, e por isso não há como as direções
 * discordarem sobre o que o banco tem.
 *
 * ---------------------------------------------------------------------------
 * Um consumidor, e ele é a SUÍTE — a ausência de chamador de produção é deliberada
 * ---------------------------------------------------------------------------
 *
 * Nenhum código de produção invoca esta guarda, no mesmo desenho de
 * `verificarCoberturaDeIsolamento`, cujos consumidores são a suíte e o verificador de infraestrutura
 * em shell. Ela é instrumento de verificação, não caminho de dado: não devolve cliente nem
 * transação, não alcança linha de tabela alguma, e abre e encerra por dentro a conexão que usa —
 * inclusive no caminho de falha, porque quem a invoca são processos curtos que uma reserva aberta
 * manteria vivos depois do trabalho terminar.
 */

import { abrirConexao } from './conexao.js';

/**
 * O schema da ADR-0031 — o lugar do que não é dado de empresa nenhuma. É o único nome de SCHEMA
 * deste arquivo, e é fronteira de decisão: `identidade` e `negocio` têm cada um a sua guarda, com
 * critérios próprios.
 */
const SCHEMA_DE_PLATAFORMA = 'plataforma';

/**
 * A coluna cuja presença denuncia dado com dono-empresa. É o mesmo nome que a política de isolamento
 * compara em `negocio` (ADR-0008) — e é justamente por ser o mesmo que ele não pode aparecer aqui.
 */
const COLUNA_DE_EMPRESA = 'empresa_id';

/**
 * As tabelas com licença para viver em `plataforma`, fora do alcance de qualquer política de linha.
 *
 * **Uma, e ela é a notícia crua do provedor.** A migração `0019` a criou sem `empresa_id` e sem
 * política, porque ela é gravada antes do roteamento e, quando o recebido não casa com cobrança
 * alguma, **não há empresa derivável** — que é a situação nomeada na `Context` da ADR-0031.
 * `plataforma` também guarda uma sequência e duas funções, e a guarda não as examina porque nenhuma
 * delas é tabela.
 *
 * Congelado porque é declaração, não estado: um `push` em tempo de execução admitiria uma tabela sem
 * passar pelo diff, que é exatamente o contrário do que a ADR-0031 decide ao exigir o roster
 * enumerado. Acrescentar uma entrada aqui é a **alteração explícita e revisada** que ela pede.
 *
 * Os nomes são **qualificados pelo schema** (`plataforma.notificacao_bancaria`), como os que a
 * guarda devolve: comparar nome curto contra nome qualificado é a divergência silenciosa que faria
 * toda tabela admitida reprovar como `FORA_DO_ROSTER` — e, na direção contrária, faria **toda**
 * entrada do roster reprovar como `AUSENTE_DO_BANCO`.
 */
export const ROSTER_DE_PLATAFORMA: readonly string[] = Object.freeze([
  'plataforma.notificacao_bancaria',
] as const);

/**
 * Motivo pelo qual o roster e o banco não se correspondem. Conjunto **fechado**: quem consome
 * compara com valor exato — texto livre viraria mensagem, e mensagem não se compara nem se traduz em
 * código de saída.
 *
 * Os dois primeiros são propriedades de um objeto **observado no banco**, cobradas na ordem em que
 * estão escritas (ver o cabeçalho). O terceiro é de natureza diferente: ele fala de uma entrada do
 * **roster** que o banco não tem, e por isso não participa daquela ordem — não há objeto sobre o
 * qual cobrar propriedade nenhuma.
 */
export type MotivoDeAdmissao = 'CARREGA_COLUNA_DE_EMPRESA' | 'FORA_DO_ROSTER' | 'AUSENTE_DO_BANCO';

/** Uma discordância entre o roster e o banco, e a primeira razão pela qual ela existe. */
export interface ExcecaoDeAdmissao {
  /**
   * Nome qualificado pelo schema — `plataforma.residuo_com_empresa`. Em `AUSENTE_DO_BANCO` é o nome
   * **declarado no roster**, que é justamente o que não se acha no banco.
   */
  readonly tabela: string;
  readonly motivo: MotivoDeAdmissao;
}

/** O que a guarda apurou. As duas listas importam; ver o cabeçalho. */
export interface AdmissaoDePlataforma {
  /**
   * Vazia quando as duas direções fecham: todo objeto examinado satisfaz as duas propriedades **e**
   * toda entrada do roster existe no banco.
   *
   * A ordem é: primeiro as do banco, pela ordem em que
   * {@link AdmissaoDePlataforma.tabelasExaminadas} as devolve; depois as `AUSENTE_DO_BANCO`, pela
   * ordem em que {@link ROSTER_DE_PLATAFORMA} as declara. As duas listas respondem perguntas opostas
   * — *"o que está lá e não devia"* contra *"o que devia estar lá e não está"* —, e intercalá-las por
   * nome faria quem lê alternar entre elas linha a linha. Dentro de cada bloco a ordem é estável em
   * qualquer instalação: a primeira sai do catálogo ordenado por `name`, e a segunda é a ordem do
   * código-fonte.
   */
  readonly excecoes: readonly ExcecaoDeAdmissao[];
  /**
   * Todo objeto de `plataforma` que a consulta alcançou, com nome qualificado e ordenado pelo nome —
   * o tipo `name` do catálogo compara na intercalação `C`, então a ordem é a mesma em qualquer
   * instalação, e quem consome pode afirmar a lista inteira em vez de só o conjunto.
   *
   * **Vazia significa que nada foi olhado.** É por isso que quem consome afirma esta lista **contra
   * o roster**, e não contra o vazio: a igualdade com {@link ROSTER_DE_PLATAFORMA} é o que separa
   * "não achei nada" de "está tudo certo". Desde que o roster deixou de ser vazio, o vácuo também
   * produz `AUSENTE_DO_BANCO` em {@link AdmissaoDePlataforma.excecoes} — mas a asserção continua
   * sendo contra o roster, porque é ela que sobrevive a um roster que volte a esvaziar.
   */
  readonly tabelasExaminadas: readonly string[];
}

/** Uma linha do catálogo, já reduzida às duas propriedades que se cobram dela. */
interface LinhaDeAdmissao {
  readonly tabela: string;
  readonly temColunaDeEmpresa: boolean;
}

/** Uma propriedade cobrada e o motivo que a ausência dela produz. */
interface PropriedadeDeAdmissao {
  readonly motivo: MotivoDeAdmissao;
  satisfeitaEm(linha: LinhaDeAdmissao): boolean;
}

/**
 * As duas propriedades, **na ordem em que são cobradas** — ver o cabeçalho. Trocar a ordem troca o
 * motivo reportado para a mesma tabela intrusa, e com ele a correção que quem lê vai fazer.
 */
const PROPRIEDADES_DA_ADMISSAO: readonly PropriedadeDeAdmissao[] = [
  { motivo: 'CARREGA_COLUNA_DE_EMPRESA', satisfeitaEm: (linha) => !linha.temColunaDeEmpresa },
  {
    motivo: 'FORA_DO_ROSTER',
    satisfeitaEm: (linha) => ROSTER_DE_PLATAFORMA.includes(linha.tabela),
  },
];

/**
 * Pergunta ao catálogo se o schema `plataforma` e o roster dizem a mesma coisa — nas duas direções.
 *
 * A conexão é aberta e encerrada aqui, inclusive no caminho de falha, pela razão que o cabeçalho
 * registra. O papel de conexão é indiferente ao resultado — e essa indiferença é **medida**, não
 * suposta: é justamente o que o `information_schema` não daria, e o que o `pg_catalog` dá.
 */
export async function conferirAdmissaoDePlataforma(
  cadeiaDeConexao: string,
): Promise<AdmissaoDePlataforma> {
  const sql = abrirConexao(cadeiaDeConexao, { maximoDeConexoes: 1 });

  try {
    // O filtro de espécie é por EXCLUSÃO, e a lista das quatro excluídas é a mesma de
    // `./catalogo.ts`, pela mesma razão registrada lá: nenhuma delas entrega linha por consulta
    // própria — sequência (`S`) e tipo composto (`c`) não guardam linha; índice (`i`, `I`) e TOAST
    // (`t`) guardam bytes lidos apenas a serviço da tabela dona. Tudo o mais é examinado, inclusive
    // a espécie que ninguém previu — que aqui reprova por não estar no roster.
    const linhas = await sql<LinhaDeAdmissao[]>`
      SELECT
        n.nspname || '.' || c.relname AS "tabela",
        EXISTS (
          SELECT 1
          FROM pg_catalog.pg_attribute a
          WHERE a.attrelid = c.oid
            AND a.attname = ${COLUNA_DE_EMPRESA}
            AND a.attnum > 0
            AND NOT a.attisdropped
        ) AS "temColunaDeEmpresa"
      FROM pg_catalog.pg_class c
      JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = ${SCHEMA_DE_PLATAFORMA}
        AND c.relkind NOT IN ('i', 'I', 'S', 'c', 't')
      ORDER BY c.relname
    `;

    const tabelasExaminadas = linhas.map((linha) => linha.tabela);

    // Direção 1 — `observado \ roster`: o que está no banco e não deveria estar. Cada objeto rende
    // no máximo UMA exceção, a da primeira propriedade ausente, e a ordem de
    // `PROPRIEDADES_DA_ADMISSAO` é normativa (ver o cabeçalho).
    const excedentes = linhas.flatMap((linha) => {
      const ausente = PROPRIEDADES_DA_ADMISSAO.find(
        (propriedade) => !propriedade.satisfeitaEm(linha),
      );
      return ausente === undefined ? [] : [{ tabela: linha.tabela, motivo: ausente.motivo }];
    });

    // Direção 2 — `roster \ observado`: o que foi declarado e o banco não tem. É calculada sobre a
    // MESMA leitura, e não por segunda consulta: as duas direções não podem discordar sobre o que o
    // banco tem porque olham a mesma lista.
    const naoAchadas: ExcecaoDeAdmissao[] = ROSTER_DE_PLATAFORMA.filter(
      (declarada) => !tabelasExaminadas.includes(declarada),
    ).map((declarada) => ({ tabela: declarada, motivo: 'AUSENTE_DO_BANCO' }));

    return { excecoes: [...excedentes, ...naoAchadas], tabelasExaminadas };
  } finally {
    await sql.end();
  }
}
