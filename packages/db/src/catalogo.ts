/**
 * Guarda de cobertura de isolamento — a segunda metade da ADR-0009, materializada.
 *
 * ---------------------------------------------------------------------------
 * Por que a resposta vem do catálogo, e nunca de uma lista
 * ---------------------------------------------------------------------------
 *
 * A ADR-0009 decide que *"a cobertura do isolamento é uma propriedade **consultada no catálogo do
 * sistema** — nenhuma tabela do schema de negócio sem RLS forçada —, **nunca uma lista de exceções
 * mantida à mão**"*. A distinção é a razão de este arquivo existir: uma lista sabe apenas o que
 * alguém lembrou de escrever nela, e a tabela que nascer amanhã sem isolamento é exatamente a que
 * ninguém vai lembrar de acrescentar. O `pg_class` sabe de todas.
 *
 * Disso decorre uma restrição que vale para toda manutenção futura deste arquivo: **nenhum nome de
 * tabela entra em posição executável aqui**. Nem em conjunto permitido, nem em exceção conhecida,
 * nem em filtro de conveniência — as três formas pelas quais a consulta passaria a tratar uma
 * tabela diferente das outras. O único nome literal que a consulta lê é o do schema, que é a
 * fronteira que a própria ADR-0009 desenha. Nome de tabela citado em **exemplo de documentação** —
 * como o que ilustra o formato de `ExcecaoDeIsolamento`, adiante — não é nenhuma das três: ele não
 * alcança a consulta. Já um nome em posição executável reintroduz a lista à mão que a decisão
 * rejeita — e silenciosamente, porque a suíte continuaria verde.
 *
 * ---------------------------------------------------------------------------
 * As duas metades do retorno, e por que a segunda não é ornamento
 * ---------------------------------------------------------------------------
 *
 * A guarda devolve as exceções **e** as tabelas examinadas. Sem a segunda, o modo de falha clássico
 * desta classe de verificação passa por aprovação: uma consulta que não encontrasse tabela nenhuma
 * — schema errado, filtro apertado demais, migração não aplicada — devolveria zero exceções, e
 * "nada violou" seria indistinguível de "nada foi olhado". Quem consome afirma as duas coisas.
 *
 * ---------------------------------------------------------------------------
 * O que entra no exame — e por que o conjunto é definido por EXCLUSÃO
 * ---------------------------------------------------------------------------
 *
 * Ficam de fora do exame os `relkind` que não devolvem linha de negócio por consulta própria —
 * índice (`i`, `I`), sequência (`S`), tipo composto (`c`) e tabela TOAST (`t`) —, e **todo o resto é
 * examinado**. A forma é deliberada: enumerar o que ENTRA é a forma que aprova em silêncio o que a
 * enumeração esquecer, e foi exatamente assim que a visão materializada atravessou o filtro
 * `relkind IN ('r','p')` da primeira escrita deste arquivo. Definido por exclusão, o conjunto não
 * tem como esquecer espécie nenhuma: a que ninguém previu cai dentro.
 *
 * Os três casos que o exame precisa justificar são a visão, a visão materializada e a tabela
 * estrangeira, porque a intuição trata as duas primeiras como o mesmo objeto e aqui elas são
 * opostas:
 *
 *   * **visão** (`v`) não guarda linha, e é examinada por um critério PRÓPRIO: `security_invoker =
 *     true`. Com a opção, a política das tabelas de origem é avaliada para **quem consulta**, e ler
 *     a visão fica sujeito exatamente ao que ler a tabela já estava; sem ela, o PostgreSQL avalia a
 *     política com os direitos da **dona**, e uma dona que contorne RLS faz a visão devolver todas
 *     as empresas. O invariante, em uma frase: *uma visão em `negocio` não pode ser caminho mais
 *     fraco que a tabela que ela lê*;
 *   * **visão materializada** (`m`) guarda linha, **fisicamente**, e o PostgreSQL **não** suporta
 *     RLS sobre ela: não existe `ALTER MATERIALIZED VIEW … ENABLE ROW LEVEL SECURITY`, e
 *     `CREATE POLICY` só alcança tabela. Ler dela não reavalia coisa alguma — é um retrato já
 *     materializado, com as linhas de todas as empresas misturadas. O mesmo vale para a **tabela
 *     estrangeira** (`f`), cujo dado vive fora do alcance de qualquer política local.
 *
 * As duas últimas são, portanto, caminho de dado de negócio **sem isolamento possível**: não há
 * estado em que fiquem certas. Por isso são examinadas e **reprovam por construção**, com motivo
 * próprio (`OBJETO_SEM_ISOLAMENTO_POSSIVEL`). É o que mantém literal o *Pro* da ADR-0009 — *"uma
 * tabela nova nasce protegida ou reprova a verificação — não há terceiro estado"*. Um objeto que
 * não admite isolamento, aprovado em silêncio dentro de `negocio`, era esse terceiro estado.
 *
 * ---------------------------------------------------------------------------
 * A precondição e as três propriedades, e a ordem em que são cobradas
 * ---------------------------------------------------------------------------
 *
 * Por objeto examinado do schema `negocio`, e nesta ordem:
 *
 *   0. **o objeto admite isolamento** — é tabela ordinária ou particionada. É precondição, não
 *      propriedade a corrigir: quem falha aqui não tem conserto por `ALTER`, e a saída para ele é
 *      sair de `negocio`;
 *   1. **existe coluna `empresa_id`** — é a coluna que a política compara (ADR-0008);
 *   2. **RLS habilitada E forçada** — `ENABLE` faz a política valer para quem não é dono; só
 *      `FORCE` a faz valer também para o dono. Sem `FORCE`, o isolamento existe no papel e uma
 *      suíte conectada com o dono fica verde sem provar nada (ADR-0008, *Cons*);
 *   3. **restrição única `(id, empresa_id)`** — é o alvo que torna a chave estrangeira composta
 *      escrevível: o PostgreSQL exige unicidade sobre o par referenciado.
 *
 * **A ordem é normativa, e cada objeto rende no máximo UMA exceção: a primeira propriedade
 * ausente.** Duas coisas distintas sustentam essa regra, e vale separá-las, porque **uma é
 * necessidade e a outra é escolha** — e confundi-las convida a rodada seguinte a mexer na parte
 * errada.
 *
 * A **necessidade** são as implicações: a **0 implica todas**, e a **1 implica a 3**. Uma visão
 * materializada não tem RLS a forçar nem par a tornar único; uma tabela sem `empresa_id` não pode
 * ter a restrição única sobre o par, porque metade do par não existe. Reportar a consequência
 * junto do defeito misturaria as duas e deixaria quem lê a saída sem saber o que corrigir. Nesses
 * pares, calar a segunda é ganho puro, e mudar isso seria regressão.
 *
 * O resto é **escolha de forma**. A 2 e a 3 são independentes entre si — ter `FORCE` nada diz
 * sobre ter a restrição única, e vice-versa —, e nada obriga a calar a segunda quando as duas
 * faltam: uma variante que coletasse todas as ausentes, preservando apenas a supressão da 3 quando
 * a 1 falta, produziria exatamente uma entrada em cada caso que a suíte hoje escreve. **Os casos
 * não impõem a forma.** O que a decide é o contrato de saída: quem consome imprime **uma linha por
 * exceção** e conta exceções, de modo que "uma entrada por objeto defeituoso" faz a contagem ser o
 * número de objetos a corrigir, em vez de um número sem referente. O preço é de **ergonomia, não
 * de corretude**: uma tabela sem as duas reporta só `RLS_NAO_FORCADA`, e o segundo defeito aparece
 * na execução seguinte; a guarda segue reprovando enquanto qualquer propriedade faltar, e converge
 * em tantas rodadas quantos forem os defeitos independentes. Está declarado abaixo, entre o que
 * ela não prova.
 *
 * Isto fica escrito como escolha, e não como imposição, para que a rodada seguinte não a reabra
 * achando que estava obrigada — nem a troque achando que não custa nada.
 *
 * ---------------------------------------------------------------------------
 * O que esta guarda NÃO prova — declarado, para que ninguém a leia como mais do que é
 * ---------------------------------------------------------------------------
 *
 * Ela responde por **cobertura**, não por semântica. Fora do alcance dela, de propósito:
 *
 *   * **o conteúdo da política** — que `USING` e `WITH CHECK` existam e digam a mesma coisa é
 *     provado por comportamento, na suíte de isolamento (CT-003 a CT-007), que exercita leitura e
 *     gravação cruzadas contra o banco em vez de ler o texto da expressão;
 *   * **a classificação da tabela** — pôr no schema errado uma tabela que deveria ser de negócio é
 *     erro que nenhuma consulta a `negocio` pega, e a própria ADR-0009 o declara entre os *Cons*;
 *   * **a propriedade dos objetos** e o papel de conexão — são do verificador de infraestrutura, que
 *     roda contra o cluster real, e de `test/papel-de-conexao.spec.ts`. Um papel com `BYPASSRLS`
 *     atravessa qualquer política, e isso vale para a tabela tanto quanto para a visão: é
 *     propriedade de **papel**, não de objeto, e não é desta guarda. **O que mudou** (D38, fechado
 *     no fechamento da F1): antes esse resíduo alcançava a visão de forma ASSIMÉTRICA — a dona da
 *     visão emprestava os privilégios dela a QUALQUER leitor, de modo que a visão podia ser um
 *     caminho mais fraco que a tabela sem que quem consultasse tivesse privilégio nenhum. Exigir
 *     `security_invoker = true` remove a assimetria: agora só o privilégio de **quem consulta**
 *     conta, nos dois caminhos;
 *   * **quantos defeitos um objeto tem** — a saída nomeia a primeira propriedade ausente, e só
 *     ela. Quando as ausências são independentes (a 2 e a 3, acima), corrigir a reportada revela a
 *     seguinte na execução seguinte: a guarda converge, mas não numa rodada só. Ler "uma exceção"
 *     como "um defeito" é o engano que este item existe para evitar.
 *
 * ---------------------------------------------------------------------------
 * Uma implementação, dois consumidores
 * ---------------------------------------------------------------------------
 *
 * Esta função é código de produção porque tem dois consumidores: a suíte (CT-008 e CT-009) e o
 * verificador de infraestrutura, que a invoca de fora do pacote pelo especificador público e traduz
 * `excecoes` em código de saída e linhas de diagnóstico. Reimplementar a consulta no verificador
 * repetiria o defeito que a F0 já pagou caro — o verificador que reimplementava o leitor e aprovava
 * 5/5 um alvo defeituoso (`.claude/rules/testing-stack.md`).
 */

import { abrirConexao } from './conexao.js';

/**
 * O schema cujas tabelas nascem tenantizadas (ADR-0009). É o único nome literal deste arquivo, e é
 * fronteira de decisão, não lista: `identidade` fica fora porque a autenticação opera antes de
 * existir contexto de empresa.
 */
const SCHEMA_DE_NEGOCIO = 'negocio';

/** A coluna que a política de isolamento compara. */
const COLUNA_DE_EMPRESA = 'empresa_id';

/** A chave interna. Junto com a de empresa, forma o par que a chave estrangeira composta referencia. */
const COLUNA_DE_IDENTIFICADOR = 'id';

/**
 * Motivo pelo qual um objeto reprova. Conjunto **fechado**: quem consome compara com valor exato —
 * texto livre viraria mensagem, e mensagem não se compara nem se traduz em código de saída.
 *
 * `OBJETO_SEM_ISOLAMENTO_POSSIVEL` é o único que não nomeia propriedade a acrescentar: ele diz que
 * o objeto não admite isolamento em espécie nenhuma — visão materializada, tabela estrangeira — e
 * que a correção é tirá-lo de `negocio`, não consertá-lo. Ver o cabeçalho.
 */
export type MotivoDeExcecao =
  | 'OBJETO_SEM_ISOLAMENTO_POSSIVEL'
  | 'SEM_COLUNA_EMPRESA'
  | 'RLS_NAO_FORCADA'
  | 'SEM_UNICA_COMPOSTA'
  | 'VISAO_NAO_DELEGA_ISOLAMENTO';

/** Um objeto que nasceu sem isolamento, e a primeira propriedade que falta nele. */
export interface ExcecaoDeIsolamento {
  /** Nome qualificado pelo schema — `negocio.acesso_usuario_app`. */
  readonly tabela: string;
  readonly motivo: MotivoDeExcecao;
}

/** O que a guarda apurou. As duas listas importam; ver o cabeçalho. */
export interface CoberturaDeIsolamento {
  /**
   * Vazia quando todo objeto examinado satisfaz a precondição e as três propriedades. Ordenada por
   * nome de tabela.
   */
  readonly excecoes: readonly ExcecaoDeIsolamento[];
  /**
   * Todo objeto do schema de negócio que a consulta alcançou, com nome qualificado e ordenado pelo
   * nome — o tipo `name` do catálogo compara na intercalação `C`, então a ordem é a mesma em
   * qualquer instalação, e quem consome pode afirmar a lista inteira em vez de só o conjunto.
   *
   * O campo se chama `tabelasExaminadas` porque **tabela é o que ele deve conter**: objeto de outra
   * espécie aparece aqui sempre acompanhado da própria exceção, nunca sozinho. É a diferença entre
   * o nome descrever o conteúdo legítimo e o filtro esconder o ilegítimo.
   *
   * Vazia significa que **nada foi olhado** — nunca aprovação.
   */
  readonly tabelasExaminadas: readonly string[];
}

/** Uma linha do catálogo, já reduzida à precondição e às propriedades da espécie dela. */
interface LinhaDeCobertura {
  readonly tabela: string;
  /** Tabela ordinária ou particionada. Falso para visão, visão materializada e tabela estrangeira. */
  readonly admiteIsolamento: boolean;
  /** Visão não-materializada. Ela é examinada por um critério próprio — ver {@link PROPRIEDADES_DA_VISAO}. */
  readonly ehVisao: boolean;
  /**
   * A visão foi declarada `WITH (security_invoker = true)`.
   *
   * É o que faz a política das tabelas de origem ser avaliada para **quem consulta**, e não para a
   * dona da visão. Sem isso, uma dona que contorne RLS transforma a visão num caminho mais fraco que
   * a tabela. Falso para tudo que não é visão, onde o campo não é lido.
   */
  readonly delegaIsolamento: boolean;
  readonly temColunaDeEmpresa: boolean;
  readonly rlsEmVigor: boolean;
  readonly temUnicaComposta: boolean;
}

/** Uma propriedade cobrada e o motivo que a ausência dela produz. */
interface PropriedadeDeIsolamento {
  readonly motivo: MotivoDeExcecao;
  satisfeitaEm(linha: LinhaDeCobertura): boolean;
}

/**
 * A precondição e as três propriedades, **na ordem em que uma implica a outra** — ver o cabeçalho.
 * Trocar a ordem troca o motivo reportado para o mesmo objeto defeituoso.
 *
 * A primeira vem primeiro porque implica todas: uma visão materializada não tem RLS a forçar nem
 * par a tornar único, e reportá-la como `RLS_NAO_FORCADA` mandaria corrigir o que não tem conserto.
 */
const PROPRIEDADES_DA_TABELA: readonly PropriedadeDeIsolamento[] = [
  { motivo: 'OBJETO_SEM_ISOLAMENTO_POSSIVEL', satisfeitaEm: (linha) => linha.admiteIsolamento },
  { motivo: 'SEM_COLUNA_EMPRESA', satisfeitaEm: (linha) => linha.temColunaDeEmpresa },
  { motivo: 'RLS_NAO_FORCADA', satisfeitaEm: (linha) => linha.rlsEmVigor },
  { motivo: 'SEM_UNICA_COMPOSTA', satisfeitaEm: (linha) => linha.temUnicaComposta },
];

/**
 * O que se cobra de uma VISÃO — uma propriedade só, e ela é suficiente.
 *
 * A visão não tem RLS própria, coluna de empresa nem restrição única, e cobrar as três dela seria
 * mandar corrigir o que não tem conserto — o mesmo erro que a ordem normativa das propriedades da
 * tabela existe para evitar. O que ela pode ter é **delegação**: com `security_invoker = true`, a
 * política das tabelas de origem é avaliada para quem consulta, e ler a visão fica sujeito
 * exatamente ao que ler a tabela já estava. Sem isso, a avaliação usa os direitos da DONA, e uma
 * dona que contorne RLS faz a visão devolver todas as empresas.
 *
 * As tabelas de origem, por sua vez, são cobradas por esta mesma guarda quando estão em `negocio` —
 * de modo que a delegação não é promessa vazia: ela aponta para propriedades que já foram provadas.
 */
const PROPRIEDADES_DA_VISAO: readonly PropriedadeDeIsolamento[] = [
  { motivo: 'VISAO_NAO_DELEGA_ISOLAMENTO', satisfeitaEm: (linha) => linha.delegaIsolamento },
];

/**
 * Qual conjunto de propriedades se cobra deste objeto.
 *
 * A escolha é pela ESPÉCIE, e não por nome — nenhum nome de tabela entra em posição executável neste
 * arquivo (ver o cabeçalho). Espécie que não é visão cai na lista da tabela, inclusive a espécie que
 * ninguém previu: é o que mantém o conjunto definido por exclusão.
 */
function propriedadesDe(linha: LinhaDeCobertura): readonly PropriedadeDeIsolamento[] {
  return linha.ehVisao ? PROPRIEDADES_DA_VISAO : PROPRIEDADES_DA_TABELA;
}

/**
 * Pergunta ao catálogo se algum objeto do schema de negócio nasceu sem isolamento.
 *
 * A conexão é aberta e encerrada aqui, inclusive no caminho de falha: a guarda é invocada por
 * processos curtos — um caso de teste, um verificador de shell — e uma reserva deixada aberta os
 * manteria vivos depois do trabalho terminar.
 *
 * O papel de conexão é indiferente ao resultado. O catálogo do PostgreSQL é legível por qualquer
 * papel que consiga conectar, e isso é propriedade desejada: o verificador não precisa de privilégio
 * para responder pela cobertura, e a suíte pode invocá-la pela mesma cadeia sem privilégio que a
 * aplicação usa.
 */
export async function verificarCoberturaDeIsolamento(
  cadeiaDeConexao: string,
): Promise<CoberturaDeIsolamento> {
  const sql = abrirConexao(cadeiaDeConexao, { maximoDeConexoes: 1 });

  try {
    // DECISÃO FECHADA — T4 / Gate 2 (P1) · 2026-08-02
    // O QUÊ: o conjunto examinado é definido por EXCLUSÃO (`relkind NOT IN …`), e não por inclusão.
    //        A precondição `admiteIsolamento` é o que separa o que foi examinado do que pode estar
    //        certo, e é ela que faz visão materializada e tabela estrangeira reprovarem.
    // POR QUÊ: com `relkind IN ('r','p')`, uma `CREATE MATERIALIZED VIEW negocio.…` era aprovada em
    //          silêncio e nem sequer aparecia em `tabelasExaminadas` — apesar de guardar linha
    //          FISICAMENTE, com as empresas misturadas, e de o PostgreSQL não suportar RLS sobre
    //          ela. Era o "terceiro estado" que a ADR-0009 declara não existir.
    // REVERTER EXIGE: provar que a espécie readmitida ao filtro de exclusão **não pode devolver
    //                 linha de negócio fora do alcance da política de isolamento da tabela de
    //                 origem** — e, para trocar a exclusão por uma lista de inclusão, provar que a
    //                 lista não pode omitir espécie alguma, hoje ou num PostgreSQL futuro. Foi a
    //                 omissão que produziu o defeito.
    //
    // O critério do campo acima NÃO é "não armazena" nem "não é legível": as duas formas são
    // FALSAS sobre a lista, e escrever qualquer uma faria o marcador mandar aplicar uma regra que a
    // lista viola. Índice e TOAST **armazenam** (inclusive bytes de coluna tenantizada). O que une
    // as quatro espécies excluídas é outra coisa — nenhuma delas entrega linha de negócio por
    // consulta própria, **escapando da RLS da origem**:
    //
    //   * **não guardam linha de negócio** — sequência (`S`) e tipo composto (`c`);
    //   * **guardam bytes, mas só são lidos a serviço da tabela de origem** — índice (`i`, `I`) e
    //     TOAST (`t`). Quem os acessa é o executor de consulta, sempre resolvendo uma leitura da
    //     tabela dona, cuja política se aplica antes de a linha sair.
    //
    // É por isso que o critério recusa exatamente as espécies que têm de reprovar: visão
    // MATERIALIZADA (`m`) guarda cópia física com as empresas misturadas, e a RLS da origem não a
    // alcança; tabela estrangeira (`f`) guarda o dado fora do banco, onde política nenhuma daqui
    // vale. Ver o cabeçalho, que separa visão de materializada.
    //

    // DECISÃO FECHADA — fechamento da F1 (D38) · 2026-08-02
    // O QUÊ: **visão (`v`) saiu da lista de exclusão e passou a ser EXAMINADA**, por um critério
    //        próprio: `security_invoker = true`. É aperto do conjunto examinado, nunca afrouxamento
    //        — nada que era examinado deixou de ser.
    // POR QUÊ: a razão pela qual `v` era excluída — "a visão reavalia a política da origem a cada
    //          consulta" — é CONDICIONAL, e a condição não estava escrita. O PostgreSQL avalia
    //          aquela política com os direitos da **dona da visão**, não de quem consulta, salvo
    //          `security_invoker = true`. Uma visão de dona que contorne RLS devolvia todas as
    //          empresas e **não aparecia sequer em `tabelasExaminadas`** — o mesmo desfecho da visão
    //          materializada, por outra porta, e o mesmo "terceiro estado" que a ADR-0009 declara
    //          não existir. Medido em instância efêmera antes da correção: a mesma visão, consultada
    //          sem `app.empresa_id`, devolveu 0 linhas com dona comum e as 2 linhas das duas
    //          empresas com dona superusuária.
    //          O invariante que isto instala, e que a exclusão não conseguia dar: *uma visão em
    //          `negocio` não pode ser caminho mais fraco que a tabela que ela lê*. Com a opção, só o
    //          privilégio de QUEM CONSULTA conta — exatamente como no acesso direto à tabela —, e o
    //          resíduo de `BYPASSRLS` volta a ser simétrico entre os dois caminhos.
    // REVERTER EXIGE: provar que a visão sem `security_invoker` **não pode** devolver linha de
    //                 negócio que a leitura direta da tabela de origem negaria ao mesmo papel — o
    //                 que exige, no mínimo, que nenhuma dona possível de visão em `negocio` contorne
    //                 RLS, hoje e em toda instalação futura. Enumerar os papéis de HOJE não
    //                 satisfaz: foi assim que o defeito nasceu. Voltar a excluir `v` do exame sem
    //                 isso reabre o terceiro estado.
    //
    // A restrição única é conferida por **conjunto de nomes de coluna**, e não por posição: o
    // `conkey` guarda números de coluna, cuja ordem segue a declaração da restrição, e comparar
    // posição faria `UNIQUE (empresa_id, id)` — a mesma unicidade, escrita ao contrário — reprovar
    // sem defeito nenhum. `contype IN ('u','p')` aceita também a chave primária sobre o par: ela é
    // igualmente um alvo válido para a chave estrangeira composta.
    //
    // A cobrança é sobre **restrição nomeada**, e não sobre unicidade em geral. Um
    // `CREATE UNIQUE INDEX … (id, empresa_id)` solto — imediato, não-parcial, não-expressional —
    // também é alvo válido de chave estrangeira composta, e ainda assim reprova aqui, **de
    // propósito**: a forma canônica deste projeto é a restrição nomeada, que é o que
    // `0001_seguranca.sql` e o gerador de migração produzem. O erro é fail-closed — reprova quem
    // está isolado por uma forma fora da convenção, e nunca aprova quem não está isolado.

    const linhas = await sql<LinhaDeCobertura[]>`
      SELECT
        n.nspname || '.' || c.relname AS "tabela",
        (c.relkind IN ('r', 'p')) AS "admiteIsolamento",
        (c.relkind = 'v') AS "ehVisao",
        -- O valor NORMALIZADO, e não a presença da opção: casar a cadeia literal deixaria passar
        -- como ausente uma visão que declarou a opção noutra grafia (true, on, 1, yes). O cast
        -- para boolean aceita todas, e a ausência vira falso por COALESCE -- falha fechada.
        -- (Sem crase neste comentário: ele vive dentro de um template literal.)
        COALESCE(
          (
            SELECT o.option_value
            FROM pg_catalog.pg_options_to_table(c.reloptions) AS o
            WHERE o.option_name = 'security_invoker'
          ),
          'false'
        )::boolean AS "delegaIsolamento",
        EXISTS (
          SELECT 1
          FROM pg_catalog.pg_attribute a
          WHERE a.attrelid = c.oid
            AND a.attname = ${COLUNA_DE_EMPRESA}
            AND a.attnum > 0
            AND NOT a.attisdropped
        ) AS "temColunaDeEmpresa",
        (c.relrowsecurity AND c.relforcerowsecurity) AS "rlsEmVigor",
        EXISTS (
          SELECT 1
          FROM pg_catalog.pg_constraint k
          WHERE k.conrelid = c.oid
            AND k.contype IN ('u', 'p')
            AND (
              SELECT array_agg(a.attname ORDER BY a.attname)
              FROM unnest(k.conkey) AS coluna(attnum)
              JOIN pg_catalog.pg_attribute a
                ON a.attrelid = c.oid AND a.attnum = coluna.attnum
            ) = ARRAY[${COLUNA_DE_EMPRESA}, ${COLUNA_DE_IDENTIFICADOR}]::name[]
        ) AS "temUnicaComposta"
      FROM pg_catalog.pg_class c
      JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = ${SCHEMA_DE_NEGOCIO}
        AND c.relkind NOT IN ('i', 'I', 'S', 'c', 't')
      ORDER BY c.relname
    `;

    return {
      excecoes: linhas.flatMap((linha) => {
        const ausente = propriedadesDe(linha).find(
          (propriedade) => !propriedade.satisfeitaEm(linha),
        );
        return ausente === undefined ? [] : [{ tabela: linha.tabela, motivo: ausente.motivo }];
      }),
      tabelasExaminadas: linhas.map((linha) => linha.tabela),
    };
  } finally {
    await sql.end();
  }
}
