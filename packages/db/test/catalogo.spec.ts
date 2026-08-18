/**
 * Guarda de cobertura de isolamento — o schema íntegro aprovado, e a tabela sem isolamento apontada
 * pelo nome.
 *
 * ===========================================================================
 * INVARIANTES
 * ===========================================================================
 *
 * | Critério       | Caso            | Invariante |
 * |----------------|-----------------|------------|
 * | CA-16 · CA-14  | CT-008 → CT-300 | Sobre o schema migrado — `0000_fundacao.sql` e
 * |                |                 | `0001_seguranca.sql`, mais `0005_dominio_locacao.sql`,
 * |                |                 | `0006_seguranca_dominio.sql`, `0007_dominio_contrato.sql` e
 * |                |                 | `0008_seguranca_contrato.sql` —, a consulta de cobertura
 * |                |                 | devolve lista VAZIA de exceções e a lista de tabelas
 * |                |                 | EXAMINADAS igual, na íntegra, aos VINTE E UM objetos de `negocio`
 * |                |                 | — nem mais, nem menos. As duas metades importam: sem a
 * |                |                 | segunda, "nenhuma exceção" e "nada foi olhado" seriam
 * |                |                 | indistinguíveis, e um schema vazio passaria por verde.
 * |                |                 | **É UM caso só, com dois identificadores**: o CT-008 o
 * |                |                 | criou sobre as duas tabelas da F1, e o CT-300 é o mesmo
 * |                |                 | invariante depois que a fatia de cadastro acrescentou as
 * |                |                 | seis entidades do domínio — todas cobertas sem exceção. |
 * | CA-14          | CT-301          | Retirado `FORCE ROW LEVEL SECURITY` de `negocio.imovel`
 * |                |                 | numa instância DEDICADA, a MESMA asserção do CT-300 reprova
 * |                |                 | nomeando aquela tabela com motivo `RLS_NAO_FORCADA` —
 * |                |                 | exatamente uma entrada, não mais —, a lista de examinadas
 * |                |                 | continua com os vinte e um, e o controle volta ao verde quando o
 * |                |                 | `FORCE` é restaurado. É o par que impede o CT-300 de passar
 * |                |                 | por vacuidade: sem ele, uma guarda quebrada devolveria
 * |                |                 | `excecoes: []` sobre qualquer schema. |
 * | CA-16          | CT-009          | Criado em `negocio` um objeto sem isolamento — tabela sem
 * |                |                 | `empresa_id`, sem RLS forçada ou sem a restrição única
 * |                |                 | `(id, empresa_id)`, ou objeto que não admite isolamento em
 * |                |                 | espécie alguma —, a guarda devolve EXATAMENTE uma exceção,
 * |                |                 | nomeando aquele objeto e aquele motivo; os VINTE E UM objetos
 * |                |                 | legítimas seguem examinadas e fora das exceções; e,
 * |                |                 | removido o defeito, a lista volta a vazia. A lista de
 * |                |                 | EXAMINADAS é cobrada por igualdade de array — posição
 * |                |                 | inclusive —, e a primeira variante existe para que a ordem
 * |                |                 | seja falsificável: ela é criada por ÚLTIMO e ordena
 * |                |                 | PRIMEIRO, de modo que a ordem alfabética prometida diverge
 * |                |                 | da ordem em que o catálogo devolveria as linhas sem
 * |                |                 | `ORDER BY`. A ÚLTIMA variante é uma visão materializada:
 * |                |                 | ela guarda linha fisicamente, o PostgreSQL não suporta RLS
 * |                |                 | sobre ela, e é o "terceiro estado" que a ADR-0009 declara
 * |                |                 | não existir — a guarda a examina e a reprova com
 * |                |                 | `OBJETO_SEM_ISOLAMENTO_POSSIVEL`. |
 * | CA-18          | CT-421          | As DUAS tabelas que a `0007` cria (`negocio.contrato` e
 * |                |                 | `negocio.contrato_fiador`) nascem com as quatro
 * |                |                 | propriedades: elas constam de `tabelasExaminadas` e não
 * |                |                 | rendem exceção alguma. A SEQUÊNCIA do contador, criada em
 * |                |                 | tempo de execução pela função da `0008`, **não** aparece
 * |                |                 | entre as examinadas — `relkind = 'S'` está fora do exame
 * |                |                 | por construção, e não por exceção mantida à mão. Retirado
 * |                |                 | o `FORCE` de `negocio.contrato` numa instância DEDICADA, a
 * |                |                 | MESMA asserção reprova nomeando aquela tabela com motivo
 * |                |                 | `RLS_NAO_FORCADA` — exatamente uma entrada —, a lista de
 * |                |                 | examinadas continua com os vinte e um, e o controle volta ao verde
 * |                |                 | quando o `FORCE` é restaurado. No mesmo caso, e sobre o
 * |                |                 | mesmo schema íntegro, `contrato_imovel_vigente_uidx` é
 * |                |                 | ÍNDICE ÚNICO PARCIAL em `status = 'ATIVO'` — afirmado pela
 * |                |                 | definição que o catálogo reconstrói — e **não** aparece
 * |                |                 | entre as restrições de `negocio.contrato`, que são
 * |                |                 | afirmadas por igualdade. A prova sob CONCORRÊNCIA é o
 * |                |                 | CT-407, na T5; aqui prova-se a forma. |
 * | CA-03          | CT-430          | `negocio.contrato_fiador` **não tem** a coluna
 * |                |                 | `retirado_em`, e a ausência é a decisão (ADR-0014 exclui
 * |                |                 | vínculo do alcance da exclusão lógica). O companheiro
 * |                |                 | POSITIVO são as SEIS entidades de cadastro mais o próprio
 * |                |                 | `contrato`, que a têm — sem ele, "não tem a coluna" ficaria
 * |                |                 | verde sobre uma consulta que não achasse nada. E a guarda
 * |                |                 | de cobertura segue devolvendo `excecoes: []` com a coluna
 * |                |                 | ausente: **ela não cobra `retirado_em` de ninguém**, que é
 * |                |                 | exatamente por que esta afirmação precisa de caso próprio. |
 * | CA-02 · CA-09  | CT-535          | As duas funções da série da COBRANÇA emitem número sob o
 * |                |                 | CONTEXTO de empresa, nunca sob parâmetro: nenhuma das duas
 * |                |                 | assinaturas contém `uuid`, as duas são `SECURITY DEFINER`
 * |                |                 | com `search_path=pg_catalog, pg_temp`, e chamá-las sem
 * |                |                 | contexto levanta com a mensagem declarada na `0010`. A
 * |                |                 | guarda de faixa do ano é a MESMA nas duas superfícies —
 * |                |                 | `NULL`, `1999` e `3000` levantam, sem deixar sequência
 * |                |                 | residual; `2000`, `2027` e `2999` emitem o número `1`. E o
 * |                |                 | papel da aplicação tem `EXECUTE` sobre as duas e **nenhum**
 * |                |                 | privilégio sobre a sequência (`USAGE`, `SELECT` e `UPDATE`
 * |                |                 | falsos), de modo que o `nextval` direto levanta `42501`
 * |                |                 | enquanto o mesmo `nextval` pelo papel dono sucede. |
 *
 * O aceite 5 da §4 da task — *"a guarda é exportada por `@sysloc/db` e consumível fora do
 * pacote"* — é provado pelo **CT-012**, em `unidade-de-trabalho.spec.ts`: ele resolve o
 * especificador público num processo Node de verdade e compara a superfície do pacote por
 * igualdade de conjunto, que a partir desta task inclui `verificarCoberturaDeIsolamento`. Este
 * arquivo importa do fonte, como todos os demais casos do pacote, porque o que ele prova é
 * comportamento contra banco real, não resolução de módulo.
 *
 * ===========================================================================
 * Por que DUAS instâncias efêmeras, e não uma compartilhada
 * ===========================================================================
 *
 * O CT-009 cria tabelas deliberadamente sem isolamento. Numa instância compartilhada elas ficariam
 * de pé enquanto o arquivo roda e alcançariam a suíte de isolamento — que passaria a conviver com
 * tabela sem política. A instância do CT-009 é DEDICADA e descartada ao fim, no mesmo padrão que o
 * CT-007 de `isolamento.spec.ts` adota para aplicar mutantes de schema.
 *
 * ===========================================================================
 * Precondição privilegiada
 * ===========================================================================
 *
 * A tabela defeituosa nasce de **DDL do próprio caso**, executada pela cadeia de
 * `conexaoDeMigracao()` — o mesmo acessório e a mesma origem de privilégio do CT-007. Nenhuma
 * bandeira, semente condicional ou ramo de produção que "pule" o isolamento foi acrescentado para
 * que o defeito exista: ele é escrito em SQL, num schema real, como um autor futuro o escreveria
 * por descuido.
 *
 * A guarda, por outro lado, é sempre invocada pela cadeia SEM privilégio (`banco.cadeiaConexao`, o
 * papel `sysloc_app`). Isso não é detalhe de conveniência: é a demonstração de que responder pela
 * cobertura não exige privilégio, que é a condição para o verificador de infraestrutura da T5
 * invocá-la com o papel que a aplicação usa.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  type CoberturaDeIsolamento,
  type MotivoDeExcecao,
  verificarCoberturaDeIsolamento,
} from '../src/catalogo.ts';
import { abrirConexao } from '../src/conexao.ts';
import { EMPRESA_A } from '../src/semente.ts';
import { type BancoMigrado, bancoEfemero, conexaoDeMigracao } from './banco-efemero.ts';

// ---------------------------------------------------------------------------
// Limites de tempo — constantes nomeadas, nunca número mágico no meio do caso
// ---------------------------------------------------------------------------

/** Subir a instância, provisionar papéis, migrar e semear leva dezenas de segundos nesta máquina. */
const LIMITE_SUBIDA_MS = 90_000;

/** Cada caso faz poucas instruções de estrutura e duas consultas ao catálogo. Teto folgado. */
const LIMITE_DO_CASO_MS = 60_000;

// ---------------------------------------------------------------------------
// As tabelas que o schema íntegro tem — e o que se afirma sobre elas
// ---------------------------------------------------------------------------

const TABELA_DE_ACESSO = 'negocio.acesso_usuario_app';
const TABELA_DE_PERMISSAO = 'negocio.acesso_usuario_permissao';

// As seis entidades do domínio de locação, criadas pela migração `0005` (T2 da fatia
// `cadastro-de-imoveis-e-pessoas`). `comodo` está entre elas: ele é tabela de negócio, tem
// `empresa_id`, RLS forçada e a única composta — o que ele NÃO tem é `retirado_em`, que a guarda
// não cobra de ninguém (ADR-0014).
const TABELA_DE_COMODO = 'negocio.comodo';
const TABELA_DE_CONJUNTO = 'negocio.conjunto';
const TABELA_DE_FIADOR = 'negocio.fiador';
const TABELA_DE_IMOVEL = 'negocio.imovel';
const TABELA_DE_LOCADOR = 'negocio.locador';
const TABELA_DE_LOCATARIO = 'negocio.locatario';

// As duas tabelas do contrato, criadas pela migração `0007` (T3 da fatia `contratos-de-locacao`) e
// forçadas pela `0008`. `contrato_fiador` está entre elas: ele é tabela de negócio, tem
// `empresa_id`, RLS forçada e a única composta — o que ele NÃO tem é `retirado_em`, que a guarda não
// cobra de ninguém (ADR-0014). É o CT-430, adiante, que afirma essa ausência.
const TABELA_DE_CONTRATO = 'negocio.contrato';
const TABELA_DE_CONTRATO_FIADOR = 'negocio.contrato_fiador';

// As duas tabelas da cobrança, criadas pela migração `0009` (T3 da fatia `cobranca-e-mora`) e
// forçadas pela `0010`. Nenhuma das duas tem `retirado_em`, e a guarda não a cobra de ninguém: a
// cobrança não circula, ela transita de estado (RD-12).
const TABELA_DE_COBRANCA = 'negocio.cobranca';
const TABELA_DE_CONFIGURACAO_DE_MORA = 'negocio.configuracao_de_mora';

/**
 * A VISÃO da migração `0010` — o único objeto desta lista que não é tabela.
 *
 * Ela é examinada por um critério PRÓPRIO (`security_invoker = true`) e o satisfaz, de modo que
 * consta das examinadas **sem exceção associada**. É a diferença que o D38 instalou, e é por isso
 * que ela aparece aqui em vez de ficar de fora: objeto aprovado por estar EXCLUÍDO do exame e objeto
 * aprovado por ter passado no exame produzem o mesmo `excecoes: []`, e só a presença nesta lista
 * distingue os dois.
 */
const VISAO_DA_COBRANCA_DERIVADA = 'negocio.cobranca_derivada';

// As duas tabelas da régua de cobrança, criadas pela migração `0011` (T3 da fatia
// `regua-de-cobranca`) e forçadas pela `0012`. Nenhuma das duas tem `retirado_em`, e a guarda não a
// cobra de ninguém: a política é singular por empresa, e o registro de envio é FATO, nunca cadastro
// (ADR-0014) — o discriminador dela é *ser referenciável*, e o registro não é.
const TABELA_DE_ENVIO_DE_COBRANCA = 'negocio.envio_de_cobranca';
const TABELA_DE_POLITICA_DE_AVISO = 'negocio.politica_de_aviso';

// A tabela da confirmação de endereço, criada pela migração `0013` (T3 da fatia
// `documentos-e-confirmacao`) e forçada pela `0014`. Ela não tem `retirado_em`, e a guarda não a
// cobra de ninguém: o portador não é referenciável (ADR-0014 não o alcança), e a linha consumida
// PERMANECE porque a RN-10 precisa distinguir "já foi usado" de "nunca existiu".
const TABELA_DE_PORTADOR_DE_CONFIRMACAO = 'negocio.portador_de_confirmacao';

// A tabela do certificado do provedor, criada pela migração `0015` (T4 da fatia
// `fundacao-bancaria`) e forçada pela `0016`. Ela não tem `retirado_em`, e a guarda não a cobra de
// ninguém: o certificado não é referenciável (ADR-0014 não o alcança), e a linha substituída
// PERMANECE porque é o histórico de com qual material cada emissão foi assinada.
//
// Os objetos que a `0016` cria em `plataforma` — a sequência e a função do identificador perante o
// provedor — **não entram aqui**, e a ausência é a decisão: a guarda examina `negocio`, e nenhum dos
// dois é tabela. O roster de tabelas de `plataforma` é hoje VAZIO, e o vazio é o conteúdo (ADR-0031);
// quem o afirma é a guarda da T5, não este arquivo.
const TABELA_DE_CERTIFICADO_DO_PROVEDOR = 'negocio.certificado_do_provedor';

// As quatro tabelas da emissão e da conciliação, criadas pela migração `0017` (T2 da fatia
// `emissao-e-conciliacao`) e forçadas pela `0018`. Nenhuma delas tem `retirado_em`, e a guarda não a
// cobra de ninguém: as quatro registram FATO — trilha, lote, item e conferência —, e a ADR-0014
// alcança entidade de cadastro, que nenhuma é.
//
// ⚠️ Elas não movem o roster de `plataforma`, que continua VAZIO: as quatro têm dono-empresa e por
// isso pertencem a `negocio` (ADR-0031, pela contrapositiva). Quem afirma o vazio é a guarda de
// `catalogo-de-plataforma.spec.ts`, não este arquivo.
const TABELA_DE_CONFERENCIA_BANCARIA = 'negocio.conferencia_bancaria';
const TABELA_DE_EMISSAO_EM_LOTE = 'negocio.emissao_em_lote';
const TABELA_DE_EVENTO_BANCARIO = 'negocio.evento_bancario';
const TABELA_DE_ITEM_DA_EMISSAO_EM_LOTE = 'negocio.item_da_emissao_em_lote';

/**
 * Os vinte e um, na ordem em que a guarda promete devolvê-los (nome do objeto, intercalação `C`).
 *
 * Este conjunto é do CASO, não da guarda: é aqui que o nome de tabela pode ser escrito à mão, e é
 * exatamente por escrevê-lo aqui — e nunca em `src/catalogo.ts` — que a comparação tem valor. Uma
 * guarda que trouxesse a mesma lista por dentro estaria se conferindo contra si mesma.
 *
 * SUT_IS_CORRECT_BECAUSE: até a fatia da fundação eram DUAS, e a igualdade sobre elas é o que
 * reprovou quando a migração `0005` entrou — a rede funcionando, não defeito; a `0007` reprovou do
 * mesmo jeito, pela mesma razão, a `0009`/`0010` reprovou pela terceira vez, a `0011`/`0012` pela
 * quarta, a `0013`/`0014` pela quinta, a `0015`/`0016` pela sexta, e a `0017`/`0018` acaba de
 * reprovar pela sétima — desta vez com QUATRO tabelas de uma só vez. A guarda
 * continua respondendo o que sempre respondeu (todo objeto de `negocio`, ordenado); o que mudou foi
 * o schema, e declarar aqui a tabela nova é a atualização legítima. Enfraquecer a asserção para
 * contê-la (`toContain`) seria regressão de prova: a tabela que nascesse sem isolamento continuaria
 * passando.
 *
 * ⚠️ A migração `0013` também **removeu** uma coluna (`contrato.pdf_contrato_arquivo`, ADR-0030), e
 * isso NÃO move lista nenhuma daqui: a guarda examina objetos, não colunas, e o `CT-430` afirma
 * coluna só de `contrato_fiador`. A ausência da coluna removida tem prova própria no `CT-712`.
 */
const TABELAS_LEGITIMAS: readonly string[] = [
  TABELA_DE_ACESSO,
  TABELA_DE_PERMISSAO,
  TABELA_DE_CERTIFICADO_DO_PROVEDOR,
  TABELA_DE_COBRANCA,
  VISAO_DA_COBRANCA_DERIVADA,
  TABELA_DE_COMODO,
  TABELA_DE_CONFERENCIA_BANCARIA,
  TABELA_DE_CONFIGURACAO_DE_MORA,
  TABELA_DE_CONJUNTO,
  TABELA_DE_CONTRATO,
  TABELA_DE_CONTRATO_FIADOR,
  TABELA_DE_EMISSAO_EM_LOTE,
  TABELA_DE_ENVIO_DE_COBRANCA,
  TABELA_DE_EVENTO_BANCARIO,
  TABELA_DE_FIADOR,
  TABELA_DE_IMOVEL,
  TABELA_DE_ITEM_DA_EMISSAO_EM_LOTE,
  TABELA_DE_LOCADOR,
  TABELA_DE_LOCATARIO,
  TABELA_DE_POLITICA_DE_AVISO,
  TABELA_DE_PORTADOR_DE_CONFIRMACAO,
];

// ---------------------------------------------------------------------------
// O que o CT-430 afirma sobre COLUNAS — a marca de retirada, e onde ela não está
// ---------------------------------------------------------------------------

/** A marca da exclusão lógica (ADR-0014), pelo nome com que a coluna existe no banco. */
const COLUNA_DE_RETIRADA = 'retirado_em';

/**
 * As colunas de `negocio.contrato_fiador`, por igualdade de conjunto e ordenadas pelo nome.
 *
 * Escritas à mão, e **não** derivadas do esquema Drizzle: derivá-las faria a asserção concordar com
 * o mesmo lugar onde a coluna de retirada seria acrescentada. A ausência de `retirado_em` aqui é o
 * conteúdo do caso. Mesmo desenho de `COLUNAS_DO_COMODO`, em `metragem.spec.ts`.
 */
const COLUNAS_DO_VINCULO_DE_FIADOR: readonly string[] = [
  'contrato_id',
  'empresa_id',
  'fiador_id',
  'id',
];

/**
 * As entidades de CADASTRO que carregam a marca — o controle positivo do CT-430, na ordem em que a
 * asserção as afirma.
 *
 * `comodo` fica de fora porque é o outro excluído nominal da ADR-0014 (detalhe de composição), e é
 * afirmado à parte, como segundo negativo.
 */
const ENTIDADES_COM_RETIRADA: readonly string[] = [
  'conjunto',
  'contrato',
  'fiador',
  'imovel',
  'locador',
  'locatario',
];

// ---------------------------------------------------------------------------
// As variantes de defeito do CT-009
// ---------------------------------------------------------------------------

/**
 * Um objeto nascido sem isolamento: como criá-lo, o motivo que ele deve produzir, como removê-lo e
 * a lista de examinadas que a guarda deve devolver enquanto ele está de pé.
 *
 * Os três defeitos de tabela são **independentes de propósito**, e é a independência que dá poder
 * ao caso: uma guarda que só olhasse `relrowsecurity` passaria a variante sem a restrição única;
 * uma que só olhasse a coluna passaria a variante sem `FORCE`; e uma que só olhasse a restrição
 * passaria as outras duas.
 *
 * As duas variantes das PONTAS não acrescentam motivo de tabela — cada uma acrescenta um eixo que
 * os três defeitos deixavam sem prova, e o comentário de cada uma explica qual:
 *
 *   * a **primeira** acrescenta a **ordem** da lista de examinadas;
 *   * a **última** acrescenta a **espécie do objeto** — ela não é tabela, e prova que o que a
 *     guarda examina não se restringe ao que ela pode mandar consertar.
 */
interface VarianteDefeituosa {
  /** Entra no nome do caso, depois do ID literal. */
  readonly descricao: string;
  readonly tabela: string;
  readonly motivo: MotivoDeExcecao;
  readonly criar: readonly string[];
  readonly remover: readonly string[];
  /**
   * A lista de tabelas examinadas que a guarda deve devolver enquanto esta variante está de pé —
   * **escrita por extenso, na ordem exata**, e não derivada por ordenação aqui no caso.
   *
   * Derivá-la (`[...TABELAS_LEGITIMAS, variante.tabela].sort()`) reimplementaria no teste a
   * propriedade que ele existe para provar, e a guarda passaria a se conferir contra uma cópia de
   * si mesma — o defeito que a `.claude/rules/testing-stack.md` registra como o pior dos três da
   * F0 (o verificador que reimplementava o leitor e aprovava 5/5 um alvo defeituoso).
   *
   * **O que a proibição alcança é a ORDENAÇÃO, não o reúso do nome.** Espalhar
   * `...TABELAS_LEGITIMAS` é escrever os vinte e um legítimos na ordem em que eles já estão escritos
   * acima — nenhuma ordenação acontece, e a posição do objeto DEFEITUOSO, que é o que discrimina,
   * segue declarada à mão em cada variante. Onde ele não cai no fim da lista, a variante escreve as
   * vinte e duas posições por extenso.
   */
  readonly examinadasEsperadas: readonly string[];
}

const VARIANTES: readonly VarianteDefeituosa[] = [
  {
    // ---------------------------------------------------------------------------
    // Esta variante existe pela ORDEM, não pelo motivo — e o NOME dela é a asserção
    // ---------------------------------------------------------------------------
    //
    // As demais provam os três motivos de tabela e a espécie do objeto. Nenhuma delas prova que a
    // lista de examinadas vem ORDENADA, e a guarda promete isso no docblock de
    // `CoberturaDeIsolamento.tabelasExaminadas`:
    // é a promessa que autoriza quem consome — o verificador de infraestrutura da T5 — a afirmar a
    // lista inteira em vez de só o conjunto.
    //
    // A promessa não era falsificável porque os nomes de todas as demais (`sem_empresa`,
    // `sem_forca`, `sem_chave_composta`, `resumo_por_empresa`) ordenam DEPOIS das legítimas,
    // que é também a ordem em que as
    // linhas do catálogo chegam quando ninguém as ordena: a varredura de `pg_class` devolve as
    // tabelas da migração antes da tabela que o caso acabou de criar. Alfabética e física
    // coincidiam, e o Gate 1 mediu o efeito — apagado `ORDER BY c.relname` do SUT, os cinco casos
    // ficavam verdes.
    //
    // DECISÃO FECHADA — T4 / Gate 1 (MED-001) · 2026-08-02
    // O QUÊ: o nome desta tabela começa com `aaa_` para que ela seja a ÚLTIMA a ser criada e a
    //        PRIMEIRA em ordem alfabética, fazendo a ordem prometida divergir da ordem física.
    // POR QUÊ: é a única fonte de discriminação da ordem em toda a suíte. Sem a divergência, o
    //          `toEqual` de array compara posição contra uma lista em que posição não distingue
    //          nada, e a remoção de `ORDER BY c.relname` do SUT sobrevive verde — mutante que o
    //          Gate 1 aplicou e mediu vivo em duas execuções independentes.
    // REVERTER EXIGE: provar que a ordem de `tabelasExaminadas` é falsificada por outro caso —
    //                 isto é, exibir uma execução em que o SUT sem `ORDER BY c.relname` reprova
    //                 sem esta variante. Renomear para algo que ordene depois de
    //                 `acesso_usuario_app`, sem essa prova, desarma a única prova de ordem da
    //                 suíte e devolve o MED-001.
    descricao:
      'tabela defeituosa criada POR ÚLTIMO e nomeada para ordenar PRIMEIRO aparece à frente das ' +
      'legítimas na lista de examinadas',
    tabela: 'negocio.aaa_sem_empresa',
    motivo: 'SEM_COLUNA_EMPRESA',
    criar: [
      'CREATE TABLE negocio.aaa_sem_empresa (id uuid PRIMARY KEY DEFAULT gen_random_uuid())',
      'ALTER TABLE negocio.aaa_sem_empresa ENABLE ROW LEVEL SECURITY',
      'ALTER TABLE negocio.aaa_sem_empresa FORCE ROW LEVEL SECURITY',
    ],
    remover: ['DROP TABLE negocio.aaa_sem_empresa'],
    // As vinte e duas posições por extenso: esta é a variante da ORDEM, e espalhar a lista legítima
    // esconderia justamente o que ela discrimina — a defeituosa vindo ANTES dos vinte e um.
    examinadasEsperadas: [
      'negocio.aaa_sem_empresa',
      TABELA_DE_ACESSO,
      TABELA_DE_PERMISSAO,
      TABELA_DE_CERTIFICADO_DO_PROVEDOR,
      TABELA_DE_COBRANCA,
      VISAO_DA_COBRANCA_DERIVADA,
      TABELA_DE_COMODO,
      TABELA_DE_CONFERENCIA_BANCARIA,
      TABELA_DE_CONFIGURACAO_DE_MORA,
      TABELA_DE_CONJUNTO,
      TABELA_DE_CONTRATO,
      TABELA_DE_CONTRATO_FIADOR,
      TABELA_DE_EMISSAO_EM_LOTE,
      TABELA_DE_ENVIO_DE_COBRANCA,
      TABELA_DE_EVENTO_BANCARIO,
      TABELA_DE_FIADOR,
      TABELA_DE_IMOVEL,
      TABELA_DE_ITEM_DA_EMISSAO_EM_LOTE,
      TABELA_DE_LOCADOR,
      TABELA_DE_LOCATARIO,
      TABELA_DE_POLITICA_DE_AVISO,
      TABELA_DE_PORTADOR_DE_CONFIRMACAO,
    ],
  },
  {
    descricao: 'tabela sem a coluna `empresa_id` reprova nomeando a tabela',
    tabela: 'negocio.sem_empresa',
    motivo: 'SEM_COLUNA_EMPRESA',
    // As outras duas propriedades são satisfeitas até onde é possível: a RLS nasce habilitada E
    // forçada, e só a restrição única sobre o par fica de fora — porque sem a coluna ela é
    // inescrevível. É por isso que a guarda cobra a PRIMEIRA propriedade ausente: sem a ordem, esta
    // tabela renderia duas exceções e o defeito viria misturado com a consequência dele.
    criar: [
      'CREATE TABLE negocio.sem_empresa (id uuid PRIMARY KEY DEFAULT gen_random_uuid())',
      'ALTER TABLE negocio.sem_empresa ENABLE ROW LEVEL SECURITY',
      'ALTER TABLE negocio.sem_empresa FORCE ROW LEVEL SECURITY',
    ],
    remover: ['DROP TABLE negocio.sem_empresa'],
    examinadasEsperadas: [...TABELAS_LEGITIMAS, 'negocio.sem_empresa'],
  },
  {
    descricao: 'tabela com RLS habilitada mas NÃO forçada reprova nomeando a tabela',
    tabela: 'negocio.sem_forca',
    motivo: 'RLS_NAO_FORCADA',
    // Tem tudo o mais: coluna de empresa e a restrição única sobre o par. Falta só o `FORCE` — que
    // é justamente a propriedade invisível para o papel da aplicação, e por isso a que uma suíte
    // conectada com o dono jamais acusaria (ADR-0008, Cons).
    criar: [
      'CREATE TABLE negocio.sem_forca (' +
        'id uuid PRIMARY KEY DEFAULT gen_random_uuid(), ' +
        'empresa_id uuid NOT NULL, ' +
        'CONSTRAINT sem_forca_id_empresa_key UNIQUE (id, empresa_id))',
      'ALTER TABLE negocio.sem_forca ENABLE ROW LEVEL SECURITY',
    ],
    remover: ['DROP TABLE negocio.sem_forca'],
    examinadasEsperadas: [...TABELAS_LEGITIMAS, 'negocio.sem_forca'],
  },
  {
    descricao: 'tabela sem a restrição única `(id, empresa_id)` reprova nomeando a tabela',
    tabela: 'negocio.sem_chave_composta',
    motivo: 'SEM_UNICA_COMPOSTA',
    // A chave primária sobre `id` sozinho NÃO serve: a chave estrangeira composta referencia o PAR,
    // e sem unicidade sobre o par o PostgreSQL recusa a referência. Uma guarda que aceitasse
    // qualquer restrição única da tabela passaria esta variante.
    criar: [
      'CREATE TABLE negocio.sem_chave_composta (' +
        'id uuid PRIMARY KEY DEFAULT gen_random_uuid(), ' +
        'empresa_id uuid NOT NULL)',
      'ALTER TABLE negocio.sem_chave_composta ENABLE ROW LEVEL SECURITY',
      'ALTER TABLE negocio.sem_chave_composta FORCE ROW LEVEL SECURITY',
    ],
    remover: ['DROP TABLE negocio.sem_chave_composta'],
    examinadasEsperadas: [...TABELAS_LEGITIMAS, 'negocio.sem_chave_composta'],
  },
  {
    // ---------------------------------------------------------------------------
    // Esta variante não é uma tabela — e é justamente por isso que ela existe
    // ---------------------------------------------------------------------------
    //
    // As quatro acima criam TABELA, e uma tabela sempre pode ser consertada: falta `empresa_id`,
    // acrescenta-se; falta `FORCE`, força-se. A visão materializada não tem conserto: ela guarda
    // linha FISICAMENTE, e o PostgreSQL não suporta RLS sobre ela — não existe
    // `ALTER MATERIALIZED VIEW … ENABLE ROW LEVEL SECURITY`, e `CREATE POLICY` só alcança tabela.
    // Ler dela não reavalia política nenhuma: é um retrato já materializado, com as linhas de
    // todas as empresas misturadas. Um relatório ou painel de fatia futura a cria sem pensar duas
    // vezes, e o Gate 2 mediu o efeito: com o filtro por INCLUSÃO da primeira escrita
    // (`relkind IN ('r','p')`), a guarda devolvia `excecoes: []` sobre ela e nem a listava em
    // `tabelasExaminadas`.
    //
    // A coluna `empresa_id` está presente DE PROPÓSITO, e é o que dá poder discriminante ao caso.
    // Sem ela, `SEM_COLUNA_EMPRESA` também produziria exceção, e o caso ficaria verde com a
    // precondição em qualquer posição da fila. Com ela, a única ausência possível seria
    // `RLS_NAO_FORCADA` — de modo que só a precondição vindo PRIMEIRO produz o motivo afirmado
    // aqui. O caso mata, portanto, três mutantes de uma vez: readmitir o filtro por inclusão (o
    // objeto some da lista de examinadas e a exceção some junto), mover
    // `OBJETO_SEM_ISOLAMENTO_POSSIVEL` para depois de `RLS_NAO_FORCADA` (o motivo muda), e trocar
    // `admiteIsolamento` por uma condição que a visão materializada satisfaça.
    //
    // Não há variante irmã para TABELA ESTRANGEIRA (`relkind = 'f'`), que o mesmo `admiteIsolamento`
    // também reprova: criá-la exigiria extensão de FDW e privilégio de superusuário — uma origem de
    // privilégio que este arquivo não usa em lugar nenhum —, e ela atravessaria exatamente a mesma
    // expressão booleana já exercitada aqui. O que faltava prova era o buraco, não cada espécie.
    descricao:
      'visão materializada em `negocio` — que guarda linha e não admite RLS — reprova por não ' +
      'admitir isolamento, mesmo tendo a coluna `empresa_id`',
    tabela: 'negocio.resumo_por_empresa',
    motivo: 'OBJETO_SEM_ISOLAMENTO_POSSIVEL',
    criar: [
      'CREATE MATERIALIZED VIEW negocio.resumo_por_empresa AS ' +
        'SELECT id, empresa_id FROM negocio.acesso_usuario_app',
    ],
    remover: ['DROP MATERIALIZED VIEW negocio.resumo_por_empresa'],
    examinadasEsperadas: [...TABELAS_LEGITIMAS, 'negocio.resumo_por_empresa'],
  },
  {
    // ---------------------------------------------------------------------------
    // A visão SEM delegação — o buraco que o D38 registrou, fechado
    // ---------------------------------------------------------------------------
    //
    // A visão era EXCLUÍDA do exame, sob a razão de que "reavalia a política da origem a cada
    // consulta". A razão é condicional e a condição não estava escrita: o PostgreSQL avalia aquela
    // política com os direitos da DONA da visão, não de quem consulta. Uma visão de dona que
    // contorne RLS devolvia todas as empresas e **nem aparecia em `tabelasExaminadas`** — mesmo
    // desfecho da visão materializada logo acima, por outra porta.
    //
    // O critério é `security_invoker = true`, e não a identidade da dona: com a opção, só o
    // privilégio de QUEM CONSULTA conta, de modo que a visão deixa de poder ser caminho mais fraco
    // que a tabela **seja quem for a dona**. Cobrar a dona seria cobrar propriedade de papel, que
    // muda por instalação e não é desta guarda.
    //
    // A coluna `empresa_id` está presente pela mesma razão da variante acima: sem ela,
    // `SEM_COLUNA_EMPRESA` também produziria exceção e o caso ficaria verde com o critério da visão
    // em qualquer posição. Com ela, o único motivo possível é o afirmado aqui — o que mata o mutante
    // que manda a visão para a lista de propriedades da TABELA (ali ela reprovaria por
    // `OBJETO_SEM_ISOLAMENTO_POSSIVEL`, motivo diferente) e o que reintroduz a exclusão de `v` (o
    // objeto some das examinadas e a exceção some junto).
    descricao:
      'visão SEM `security_invoker` reprova por não delegar o isolamento, mesmo tendo a coluna ' +
      '`empresa_id`',
    tabela: 'negocio.espelho_sem_delegacao',
    motivo: 'VISAO_NAO_DELEGA_ISOLAMENTO',
    criar: [
      'CREATE VIEW negocio.espelho_sem_delegacao AS ' +
        'SELECT id, empresa_id FROM negocio.acesso_usuario_app',
    ],
    remover: ['DROP VIEW negocio.espelho_sem_delegacao'],
    // `espelho_...` ordena entre `envio_de_cobranca` e `evento_bancario`, e não no fim: as vinte e
    // duas posições vão por extenso, porque é a POSIÇÃO que a igualdade de array cobra.
    examinadasEsperadas: [
      TABELA_DE_ACESSO,
      TABELA_DE_PERMISSAO,
      TABELA_DE_CERTIFICADO_DO_PROVEDOR,
      TABELA_DE_COBRANCA,
      VISAO_DA_COBRANCA_DERIVADA,
      TABELA_DE_COMODO,
      TABELA_DE_CONFERENCIA_BANCARIA,
      TABELA_DE_CONFIGURACAO_DE_MORA,
      TABELA_DE_CONJUNTO,
      TABELA_DE_CONTRATO,
      TABELA_DE_CONTRATO_FIADOR,
      TABELA_DE_EMISSAO_EM_LOTE,
      TABELA_DE_ENVIO_DE_COBRANCA,
      'negocio.espelho_sem_delegacao',
      TABELA_DE_EVENTO_BANCARIO,
      TABELA_DE_FIADOR,
      TABELA_DE_IMOVEL,
      TABELA_DE_ITEM_DA_EMISSAO_EM_LOTE,
      TABELA_DE_LOCADOR,
      TABELA_DE_LOCATARIO,
      TABELA_DE_POLITICA_DE_AVISO,
      TABELA_DE_PORTADOR_DE_CONFIRMACAO,
    ],
  },
];

// ---------------------------------------------------------------------------
// Execução privilegiada — a DDL do defeito, e apenas ela
// ---------------------------------------------------------------------------

async function executarPrivilegiado(cadeia: string, instrucoes: readonly string[]): Promise<void> {
  const sql = abrirConexao(cadeia, { maximoDeConexoes: 1 });
  try {
    for (const instrucao of instrucoes) {
      await sql.unsafe(instrucao);
    }
  } finally {
    await sql.end();
  }
}

// ---------------------------------------------------------------------------
// Leituras cruas do catálogo — sem privilégio, pela cadeia da aplicação
// ---------------------------------------------------------------------------

/**
 * As colunas vivas de uma tabela de `negocio`, ordenadas pelo nome.
 *
 * Vem de `pg_attribute`, e não do esquema Drizzle: derivá-la da declaração faria a asserção do
 * CT-430 concordar com o mesmo lugar onde a coluna de retirada seria acrescentada, e a ausência
 * deixaria de ser verificável. Mesmo mecanismo do `CT-317`, em `metragem.spec.ts`.
 */
async function colunasDe(cadeia: string, tabela: string): Promise<string[]> {
  const sql = abrirConexao(cadeia, { maximoDeConexoes: 1 });
  try {
    const linhas = await sql<{ coluna: string }[]>`
      SELECT a.attname AS coluna
        FROM pg_catalog.pg_attribute a
        JOIN pg_catalog.pg_class c ON c.oid = a.attrelid
        JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'negocio'
         AND c.relname = ${tabela}
         AND a.attnum > 0
         AND NOT a.attisdropped
       ORDER BY a.attname
    `;
    return linhas.map((linha) => linha.coluna);
  } finally {
    await sql.end();
  }
}

/**
 * A definição de um índice, tal como o PostgreSQL a reconstrói a partir do catálogo.
 *
 * `pg_get_indexdef` é a fonte porque ela é o estado REAL: ler o texto da migração provaria o que
 * está escrito no arquivo, e não o que o banco aplicou. É a mesma razão pela qual a guarda de
 * cobertura pergunta ao `pg_class` em vez de ler a declaração em Drizzle.
 */
async function definicaoDeIndice(cadeia: string, indice: string): Promise<string> {
  const sql = abrirConexao(cadeia, { maximoDeConexoes: 1 });
  try {
    const [linha] = await sql<{ definicao: string }[]>`
      SELECT pg_catalog.pg_get_indexdef(c.oid) AS definicao
        FROM pg_catalog.pg_class c
        JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'negocio' AND c.relname = ${indice} AND c.relkind IN ('i', 'I')
    `;
    return linha?.definicao ?? 'INDICE INEXISTENTE';
  } finally {
    await sql.end();
  }
}

/**
 * As restrições NOMEADAS de uma tabela, no formato `tipo:nome`, ordenadas pelo nome.
 *
 * O que este retorno discrimina é a diferença entre **índice** e **restrição**: o índice único
 * parcial não aparece aqui, e é isso que prova que ele não foi convertido em `CONSTRAINT` — a
 * conversão que removeria a condição `WHERE status = 'ATIVO'` em silêncio.
 */
async function restricoesDe(cadeia: string, tabela: string): Promise<string[]> {
  const sql = abrirConexao(cadeia, { maximoDeConexoes: 1 });
  try {
    const linhas = await sql<{ linha: string }[]>`
      SELECT k.contype::text || ':' || k.conname AS linha
        FROM pg_catalog.pg_constraint k
        JOIN pg_catalog.pg_class c ON c.oid = k.conrelid
        JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'negocio' AND c.relname = ${tabela}
       ORDER BY k.conname
    `;
    return linhas.map((linha) => linha.linha);
  } finally {
    await sql.end();
  }
}

/** As sequências que existem em `negocio`, ordenadas pelo nome. Vazia significa nenhuma. */
async function sequenciasDeNegocio(cadeia: string): Promise<string[]> {
  const sql = abrirConexao(cadeia, { maximoDeConexoes: 1 });
  try {
    const linhas = await sql<{ nome: string }[]>`
      SELECT n.nspname || '.' || c.relname AS nome
        FROM pg_catalog.pg_class c
        JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'negocio'
         AND c.relkind = 'S'
       ORDER BY c.relname
    `;
    return linhas.map((linha) => linha.nome);
  } finally {
    await sql.end();
  }
}

/**
 * Cria o contador de um escopo `(empresa, ano)` pelo caminho LEGÍTIMO: a função `SECURITY DEFINER`
 * da `0008`, chamada pela cadeia da APLICAÇÃO, com o contexto de tenant fixado na transação.
 *
 * Nenhum `CREATE SEQUENCE` é escrito aqui, e a diferença importa: a sequência que o CT-421 procura
 * em `tabelasExaminadas` é a que a operação cria de verdade, com o nome que a função compõe — não
 * um objeto sintético que o caso inventou e que poderia nem se parecer com o real.
 */
async function criarContadorPeloCaminhoDaAplicacao(
  cadeia: string,
  empresaId: string,
  ano: number,
): Promise<void> {
  const sql = abrirConexao(cadeia, { maximoDeConexoes: 1 });
  try {
    await sql.begin(async (tx) => {
      await tx`SELECT set_config('app.empresa_id', ${empresaId}, true)`;
      await tx`SELECT negocio.garantir_contador_de_contrato(${ano})`;
    });
  } finally {
    await sql.end();
  }
}

/** A política tal como o catálogo a guarda hoje — para recriá-la sem reescrever a decisão. */
interface PoliticaCapturada {
  readonly nome: string;
  readonly usando: string;
  readonly comVerificacao: string;
}

/**
 * Lê do catálogo a política de uma tabela, para que o mutante M6 possa derrubá-la e devolvê-la
 * depois **idêntica**.
 *
 * Recriá-la a partir de um texto copiado de `0001_seguranca.sql` seria uma segunda cópia da mesma
 * decisão, que envelheceria em silêncio quando a migração mudasse. O catálogo é a fonte.
 */
async function capturarPolitica(cadeia: string, tabela: string): Promise<PoliticaCapturada> {
  const [schema, nomeDaTabela] = tabela.split('.');
  const sql = abrirConexao(cadeia, { maximoDeConexoes: 1 });

  try {
    const linhas = await sql<{ nome: string; usando: string; comVerificacao: string }[]>`
      SELECT policyname AS "nome", qual AS "usando", with_check AS "comVerificacao"
      FROM pg_policies
      WHERE schemaname = ${schema ?? ''} AND tablename = ${nomeDaTabela ?? ''}
    `;

    const politica = linhas[0];
    if (linhas.length !== 1 || politica === undefined) {
      throw new Error(
        `esperava exatamente uma política em ${tabela}, e o catálogo devolveu ${linhas.length} — ` +
          'sem ela o mutante M6 não teria o que derrubar, e o caso passaria sem exercitar nada',
      );
    }
    return politica;
  } finally {
    await sql.end();
  }
}

function recriarPolitica(tabela: string, politica: PoliticaCapturada): string {
  return (
    `CREATE POLICY "${politica.nome}" ON ${tabela} FOR ALL ` +
    `USING (${politica.usando}) WITH CHECK (${politica.comVerificacao})`
  );
}

// ---------------------------------------------------------------------------
// Os casos
// ---------------------------------------------------------------------------

describe('guarda de cobertura de isolamento — schema íntegro', () => {
  let banco: BancoMigrado;

  beforeAll(async () => {
    banco = await bancoEfemero();
  }, LIMITE_SUBIDA_MS);

  afterAll(async () => {
    await banco?.parar();
  }, LIMITE_SUBIDA_MS);

  it(
    'CT-300 (estende o CT-008) — guarda de catálogo aprova o schema íntegro sem apontar exceção',
    async () => {
      const cobertura = await verificarCoberturaDeIsolamento(banco.cadeiaConexao);

      // Igualdade nas DUAS listas, numa asserção só: nenhuma exceção **e** os vinte e um objetos
      // examinadas, nem mais nem menos. É o par que detecta — "exceções vazias" sozinho ficaria
      // verde contra um banco em que a consulta não alcançou tabela nenhuma, e "vinte e um examinados"
      // sozinho não diria que todas passaram.
      expect(cobertura).toEqual({
        excecoes: [],
        tabelasExaminadas: TABELAS_LEGITIMAS,
      } satisfies CoberturaDeIsolamento);
    },
    LIMITE_DO_CASO_MS,
  );

  // =========================================================================
  // CT-430 — o vínculo NÃO tem marca de retirada, e a ausência é a decisão
  // =========================================================================
  //
  // A ADR-0014 exclui do alcance da exclusão lógica *"vínculo ou concessão, cuja linha representa
  // estado de relacionamento"*, e o discriminador dela é **ser referenciável** — nada aponta para
  // uma linha de `contrato_fiador`. Substituir a lista de fiadores de um rascunho remove e insere
  // linhas, que é o mecanismo legítimo.
  //
  // Este caso existe porque a decisão se desfaz em SILÊNCIO: a guarda de cobertura não cobra
  // `retirado_em` de ninguém, então acrescentar a coluna "por simetria" com as sete entidades que a
  // têm passaria por todas as demais asserções deste arquivo. É o mesmo raciocínio, e o mesmo molde,
  // do `CT-317` para o cômodo.
  it(
    'CT-430 — `negocio.contrato_fiador` não tem `retirado_em`, e as sete entidades de cadastro têm',
    async () => {
      // --- A ausência, por igualdade de conjunto ----------------------------------------------
      //
      // Igualdade, e não `not.toContain`: uma coluna A MAIS, com outro nome, também é revisão
      // devida — o vínculo tem quatro colunas e só quatro, e é isso que a decisão diz.
      const doVinculo = await colunasDe(banco.cadeiaConexao, 'contrato_fiador');
      expect(doVinculo).toEqual([...COLUNAS_DO_VINCULO_DE_FIADOR]);
      expect(doVinculo).not.toContain(COLUNA_DE_RETIRADA);

      // --- O controle POSITIVO ------------------------------------------------------------------
      //
      // Sem ele, "não tem a coluna" ficaria verde sobre uma consulta ao catálogo que não achasse
      // nada — inclusive uma com o nome da marca escrito errado, ou apontada para a tabela errada.
      // São SEIS: as cinco entidades de cadastro da fatia anterior que a têm — o cômodo é o outro
      // excluído nominal da ADR-0014 — mais o próprio `contrato`, que a ADR nomeia na lista.
      const comMarcaDeRetirada: string[] = [];
      for (const entidade of ENTIDADES_COM_RETIRADA) {
        const colunas = await colunasDe(banco.cadeiaConexao, entidade);
        comMarcaDeRetirada.push(`${entidade}: ${colunas.includes(COLUNA_DE_RETIRADA)}`);
      }
      expect(comMarcaDeRetirada).toEqual([
        'conjunto: true',
        'contrato: true',
        'fiador: true',
        'imovel: true',
        'locador: true',
        'locatario: true',
      ]);
      // O cômodo é o OUTRO excluído nominalmente pela ADR-0014, e entra como segundo negativo: sem
      // ele, a lista acima poderia ser lida como "toda tabela de negócio tem a marca menos o
      // vínculo", que não é a decisão.
      expect(await colunasDe(banco.cadeiaConexao, 'comodo')).not.toContain(COLUNA_DE_RETIRADA);

      // --- E a guarda NÃO acusa a ausência ------------------------------------------------------
      //
      // Esta terceira asserção é a razão de o caso existir. Se a guarda cobrasse `retirado_em`, ela
      // apontaria `contrato_fiador` aqui e o caso acima seria redundante com ela. Ela não cobra — e
      // é por isso que a ausência precisa de asserção própria, e não de confiança na cobertura.
      expect(await verificarCoberturaDeIsolamento(banco.cadeiaConexao)).toEqual({
        excecoes: [],
        tabelasExaminadas: TABELAS_LEGITIMAS,
      } satisfies CoberturaDeIsolamento);
    },
    LIMITE_DO_CASO_MS,
  );
});

describe('guarda de cobertura de isolamento — tabela nascida sem isolamento', () => {
  let banco: BancoMigrado;
  let doMigrador: string;

  beforeAll(async () => {
    banco = await bancoEfemero();
    doMigrador = conexaoDeMigracao(banco);
  }, LIMITE_SUBIDA_MS);

  afterAll(async () => {
    await banco?.parar();
  }, LIMITE_SUBIDA_MS);

  for (const variante of VARIANTES) {
    it(
      `CT-009 — ${variante.descricao}`,
      async () => {
        await executarPrivilegiado(doMigrador, variante.criar);

        try {
          const comDefeito = await verificarCoberturaDeIsolamento(banco.cadeiaConexao);

          // Exatamente uma exceção, com a tabela e o motivo exatos — não "alguma exceção".
          expect(comDefeito.excecoes).toEqual([
            { tabela: variante.tabela, motivo: variante.motivo },
          ]);

          // As duas legítimas foram OLHADAS e ficaram fora das exceções. As duas afirmações são
          // necessárias: sem a primeira, "não aparecem nas exceções" também seria verdade se a
          // consulta simplesmente não as tivesse alcançado.
          //
          // A lista esperada vem da variante e é comparada por `toEqual` de array, que compara
          // POSIÇÃO — é aqui que a promessa de ordem estável do docblock da guarda é cobrada. A
          // primeira variante é a que discrimina: ela é criada por último e ordena primeiro.
          expect(comDefeito.tabelasExaminadas).toEqual(variante.examinadasEsperadas);
          expect(comDefeito.excecoes.map((excecao) => excecao.tabela)).not.toContain(
            TABELA_DE_ACESSO,
          );
          expect(comDefeito.excecoes.map((excecao) => excecao.tabela)).not.toContain(
            TABELA_DE_PERMISSAO,
          );
        } finally {
          await executarPrivilegiado(doMigrador, variante.remover);
        }

        // Removido o defeito, a guarda volta ao vazio. Sem este passo, "reprovou" não distinguiria
        // o defeito de um estado residual deixado por outra variante — e a guarda poderia estar
        // reprovando sempre.
        const restaurado = await verificarCoberturaDeIsolamento(banco.cadeiaConexao);
        expect(restaurado).toEqual({
          excecoes: [],
          tabelasExaminadas: TABELAS_LEGITIMAS,
        } satisfies CoberturaDeIsolamento);
      },
      LIMITE_DO_CASO_MS,
    );
  }

  it(
    'CT-009 (v-ok) — visão COM `security_invoker` é aprovada, e ainda assim aparece entre as examinadas',
    async () => {
      // O companheiro POSITIVO da variante `espelho_sem_delegacao`, e é ele que dá poder
      // discriminante ao critério. Sem este caso, um mutante que reprovasse TODA visão — trocar
      // `linha.delegaIsolamento` por `false`, ou mandar a visão para a lista de propriedades da
      // tabela — passaria pela suíte inteira, e a guarda estaria proibindo um padrão legítimo em vez
      // de exigir a delegação. É o par que detecta, nunca a asserção isolada.
      //
      // A segunda afirmação não é redundante com a primeira: uma visão aprovada por estar EXCLUÍDA
      // do exame também produziria `excecoes: []`. Só a presença dela em `tabelasExaminadas`
      // distingue "foi olhada e passou" de "não foi olhada" — que é a distinção inteira do D38.
      const VISAO_SEGURA = 'negocio.espelho_com_delegacao';

      await executarPrivilegiado(doMigrador, [
        `CREATE VIEW ${VISAO_SEGURA} WITH (security_invoker = true) AS ` +
          'SELECT id, empresa_id FROM negocio.acesso_usuario_app',
      ]);

      try {
        const cobertura = await verificarCoberturaDeIsolamento(banco.cadeiaConexao);

        expect(cobertura).toEqual({
          excecoes: [],
          // A visão segura ordena entre `envio_de_cobranca` e `evento_bancario`, pela mesma razão da
          // irmã acima.
          tabelasExaminadas: [
            TABELA_DE_ACESSO,
            TABELA_DE_PERMISSAO,
            TABELA_DE_CERTIFICADO_DO_PROVEDOR,
            TABELA_DE_COBRANCA,
            VISAO_DA_COBRANCA_DERIVADA,
            TABELA_DE_COMODO,
            TABELA_DE_CONFERENCIA_BANCARIA,
            TABELA_DE_CONFIGURACAO_DE_MORA,
            TABELA_DE_CONJUNTO,
            TABELA_DE_CONTRATO,
            TABELA_DE_CONTRATO_FIADOR,
            TABELA_DE_EMISSAO_EM_LOTE,
            TABELA_DE_ENVIO_DE_COBRANCA,
            VISAO_SEGURA,
            TABELA_DE_EVENTO_BANCARIO,
            TABELA_DE_FIADOR,
            TABELA_DE_IMOVEL,
            TABELA_DE_ITEM_DA_EMISSAO_EM_LOTE,
            TABELA_DE_LOCADOR,
            TABELA_DE_LOCATARIO,
            TABELA_DE_POLITICA_DE_AVISO,
            TABELA_DE_PORTADOR_DE_CONFIRMACAO,
          ],
        } satisfies CoberturaDeIsolamento);
      } finally {
        await executarPrivilegiado(doMigrador, [`DROP VIEW ${VISAO_SEGURA}`]);
      }

      const restaurado = await verificarCoberturaDeIsolamento(banco.cadeiaConexao);
      expect(restaurado).toEqual({
        excecoes: [],
        tabelasExaminadas: TABELAS_LEGITIMAS,
      } satisfies CoberturaDeIsolamento);
    },
    LIMITE_DO_CASO_MS,
  );

  it(
    'CT-009 (M6) — isolamento retirado de UMA tabela legítima reprova aquela tabela, e só ela',
    async () => {
      // O mutante que o Gate 1 da T2 deferiu para esta task: `FORCE` e política removidos **só** de
      // `acesso_usuario_permissao`. Ele é a prova que as três variantes acima não dão, porque as
      // três criam tabela NOVA: uma guarda que carregasse por dentro a lista das tabelas conhecidas
      // — o antipadrão que a ADR-0009 rejeita nominalmente — continuaria pegando tabela nova e
      // ficaria cega justamente para a tabela que a migração criou. Aqui ela morre.
      const politica = await capturarPolitica(doMigrador, TABELA_DE_PERMISSAO);

      await executarPrivilegiado(doMigrador, [
        `DROP POLICY "${politica.nome}" ON ${TABELA_DE_PERMISSAO}`,
        `ALTER TABLE ${TABELA_DE_PERMISSAO} NO FORCE ROW LEVEL SECURITY`,
      ]);

      try {
        const comDefeito = await verificarCoberturaDeIsolamento(banco.cadeiaConexao);

        expect(comDefeito.excecoes).toEqual([
          { tabela: TABELA_DE_PERMISSAO, motivo: 'RLS_NAO_FORCADA' },
        ]);
        // A tabela irmã, intacta, continua examinada e aprovada — a guarda distingue as duas em vez
        // de reprovar o schema em bloco.
        expect(comDefeito.tabelasExaminadas).toEqual(TABELAS_LEGITIMAS);
        expect(comDefeito.excecoes.map((excecao) => excecao.tabela)).not.toContain(
          TABELA_DE_ACESSO,
        );
      } finally {
        await executarPrivilegiado(doMigrador, [
          `ALTER TABLE ${TABELA_DE_PERMISSAO} FORCE ROW LEVEL SECURITY`,
          recriarPolitica(TABELA_DE_PERMISSAO, politica),
        ]);
      }

      const restaurado = await verificarCoberturaDeIsolamento(banco.cadeiaConexao);
      expect(restaurado).toEqual({
        excecoes: [],
        tabelasExaminadas: TABELAS_LEGITIMAS,
      } satisfies CoberturaDeIsolamento);
    },
    LIMITE_DO_CASO_MS,
  );
});

// ===========================================================================
// CT-301 — a falsificação do CT-300, sobre uma ENTIDADE NOVA da fatia
// ===========================================================================
//
// O CT-009 já falsifica a guarda com tabela criada pelo próprio caso, e o M6 dele já a falsifica
// sobre uma tabela que a MIGRAÇÃO criou. O que nenhum dos dois cobre é a pergunta que esta task
// abre: **as tabelas que a `0006` acabou de forçar estão mesmo forçadas?** Se a migração de
// segurança tivesse esquecido uma delas, o CT-300 reprovaria — mas se a GUARDA tivesse deixado de
// enxergar `FORCE`, o CT-300 ficaria verde sobre um schema sem isolamento, e é esse o par que falta.
//
// Um único mutante, sobre uma única tabela nova, basta: o mecanismo da guarda é o mesmo para as
// vinte e um, e o CT-009 já cobre as demais variantes de defeito (sem coluna, sem única composta, objeto
// sem isolamento possível).
//
// A instância é DEDICADA e descartada ao fim — nunca a compartilhada pelos demais casos, que
// passaria a conviver com tabela sem política enquanto o arquivo roda. É o mesmo padrão do CT-007
// de `isolamento.spec.ts`.

/** O caso sobe a própria instância, então o teto soma a subida ao trabalho. */
const LIMITE_COM_INSTANCIA_PROPRIA_MS = 180_000;

/** A entidade nova sobre a qual o mutante age. Uma só, e o comentário acima diz por quê. */
const TABELA_MUTANTE = TABELA_DE_IMOVEL;

describe('CT-301 — entidade nova sem RLS forçada é nomeada pela guarda', () => {
  it(
    'CT-301 — retirado o `FORCE` de `negocio.imovel`, a guarda o acusa por RLS_NAO_FORCADA e volta ao verde restaurado',
    async () => {
      const banco = await bancoEfemero();
      const doMigrador = conexaoDeMigracao(banco);

      try {
        // Controle ANTES: sem ele, "reprovou com o mutante" não distingue a guarda que discrimina
        // daquela que reprova qualquer coisa.
        const controle = await verificarCoberturaDeIsolamento(banco.cadeiaConexao);
        expect(controle).toEqual({
          excecoes: [],
          tabelasExaminadas: TABELAS_LEGITIMAS,
        } satisfies CoberturaDeIsolamento);

        await executarPrivilegiado(doMigrador, [
          `ALTER TABLE ${TABELA_MUTANTE} NO FORCE ROW LEVEL SECURITY`,
        ]);

        try {
          // A guarda é invocada pela cadeia SEM privilégio, como no controle: `NO FORCE` é
          // invisível para o papel da aplicação em toda leitura de dado, e é justamente por isso
          // que a resposta tem de vir do catálogo.
          const comMutante = await verificarCoberturaDeIsolamento(banco.cadeiaConexao);

          // Exatamente UMA entrada, com a tabela e o motivo exatos — não "alguma exceção". A
          // igualdade de array é o que impede a guarda de reprovar os vinte e um em bloco e ainda assim
          // passar aqui.
          expect(comMutante.excecoes).toEqual([
            { tabela: TABELA_MUTANTE, motivo: 'RLS_NAO_FORCADA' },
          ]);

          // Os vinte e um continuam EXAMINADOS: sem esta metade, uma guarda que tivesse perdido de vista
          // os doze irmãos reportaria a mesma exceção única e passaria.
          expect(comMutante.tabelasExaminadas).toEqual(TABELAS_LEGITIMAS);

          // E as irmãs seguem aprovadas — a guarda distingue a tabela defeituosa em vez de
          // reprovar o schema inteiro.
          expect(comMutante.excecoes.map((excecao) => excecao.tabela)).not.toContain(
            TABELA_DE_CONJUNTO,
          );
          expect(comMutante.excecoes.map((excecao) => excecao.tabela)).not.toContain(
            TABELA_DE_COMODO,
          );
        } finally {
          await executarPrivilegiado(doMigrador, [
            `ALTER TABLE ${TABELA_MUTANTE} FORCE ROW LEVEL SECURITY`,
          ]);
        }

        // Controle DEPOIS: restaurado o `FORCE`, a guarda volta ao vazio. É a terceira perna do par
        // controle→mutante→controle, e sem ela "reprovou" poderia ser estado residual.
        const restaurado = await verificarCoberturaDeIsolamento(banco.cadeiaConexao);
        expect(restaurado).toEqual({
          excecoes: [],
          tabelasExaminadas: TABELAS_LEGITIMAS,
        } satisfies CoberturaDeIsolamento);
      } finally {
        await banco.parar();
      }
    },
    LIMITE_COM_INSTANCIA_PROPRIA_MS,
  );
});

// ===========================================================================
// CT-421 — as DUAS tabelas do contrato, e a sequência que a guarda ignora
// ===========================================================================
//
// Ele é o CT-301 desta fatia, com um eixo a mais que só existe aqui: **o contador**.
//
// A ADR-0020 traz para `negocio` um objeto de espécie NOVA — a sequência do escopo `(empresa, ano)`,
// criada em tempo de execução pela função `SECURITY DEFINER` da `0008`. A pergunta que ela abre é se
// a guarda de cobertura passa a reprovar o schema por causa dela, e a resposta é não: `relkind = 'S'`
// está fora do exame **por construção**, no filtro por exclusão que o marcador `DECISÃO FECHADA` de
// `src/catalogo.ts` protege — e não por exceção mantida à mão, que é justamente o que a ADR-0009
// rejeita. Uma sequência não guarda linha de negócio nem é caminho para uma.
//
// A asserção sobre isso só tem conteúdo com a sequência EXISTINDO: "não aparece na lista" é
// trivialmente verdade sobre um objeto que ninguém criou. Por isso o caso a cria pelo caminho da
// aplicação e afirma, primeiro, que ela está lá.
//
// A instância é DEDICADA e descartada ao fim — nunca a compartilhada pelos demais casos, que
// passaria a conviver com tabela sem política enquanto o arquivo roda. É o mesmo padrão do CT-301.

/** As duas tabelas sobre as quais o mutante age, uma por vez. */
const TABELA_MUTANTE_DO_CONTRATO = TABELA_DE_CONTRATO;

/** O escopo do contador que o caso cria. Ano fixo: o que se observa é a ESPÉCIE, não o valor. */
const ANO_DO_CONTADOR = 2026;

describe('CT-421 — o contrato nasce isolado, e a sequência do contador não é examinada', () => {
  it(
    'as duas tabelas constam sem exceção, a sequência fica de fora, e sem `FORCE` o contrato é acusado',
    async () => {
      const banco = await bancoEfemero();
      const doMigrador = conexaoDeMigracao(banco);

      try {
        // --- Passo 1: o schema íntegro ---------------------------------------------------------
        //
        // Controle ANTES: sem ele, "reprovou com o mutante" não distingue a guarda que discrimina
        // daquela que reprova qualquer coisa. A igualdade cobre as DUAS listas de uma vez — os vinte e um
        // objetos examinados incluem `negocio.contrato` e `negocio.contrato_fiador`, nas posições
        // que a ordem prometida lhes dá, e nenhum deles rende exceção.
        const controle = await verificarCoberturaDeIsolamento(banco.cadeiaConexao);
        expect(controle).toEqual({
          excecoes: [],
          tabelasExaminadas: TABELAS_LEGITIMAS,
        } satisfies CoberturaDeIsolamento);
        expect(controle.tabelasExaminadas).toContain(TABELA_DE_CONTRATO);
        expect(controle.tabelasExaminadas).toContain(TABELA_DE_CONTRATO_FIADOR);

        // --- Passo 1-b: a vigência única é ÍNDICE PARCIAL, e não restrição ----------------------
        //
        // O PostgreSQL **não admite restrição única parcial**, então quem "corrigir"
        // `contrato_imovel_vigente_uidx` para `CONSTRAINT`, por consistência com as vizinhas, terá
        // de **remover a condição** — e a tabela passará a impedir dois contratos em QUALQUER estado
        // sobre o mesmo imóvel, o que quebra montar contrato novo depois de cancelar o anterior.
        //
        // As duas asserções abaixo são o par que detecta essa conversão. A definição, por igualdade
        // literal, mata o mutante que apaga o `WHERE`; a lista de restrições, também por igualdade,
        // mata o mutante que transforma o índice em restrição — ali ele apareceria como `u:`.
        //
        // A prova de CONCORRÊNCIA (duas ativações simultâneas sobre o mesmo imóvel) é o CT-407, na
        // T5. Aqui prova-se a forma, que é o que a estrutura pode responder sozinha.
        expect(await definicaoDeIndice(banco.cadeiaConexao, 'contrato_imovel_vigente_uidx')).toBe(
          'CREATE UNIQUE INDEX contrato_imovel_vigente_uidx ON negocio.contrato ' +
            "USING btree (imovel_id) WHERE (status = 'ATIVO'::negocio.status_contrato)",
        );

        // A lista inteira por igualdade, e não `not.toContain`: uma restrição a mais ou a menos em
        // `negocio.contrato` é revisão devida. `c:` é verificação, `f:` é chave estrangeira, `n:` é
        // não-nulo, `p:` é chave primária e `u:` é unicidade — e nenhuma `u:` nomeia o índice de
        // vigência, que é o que separa índice de restrição.
        //
        // As entradas `n:` entram porque o PostgreSQL 18 materializa `NOT NULL` como restrição
        // nomeada, e mantê-las torna a igualdade uma afirmação a mais: **`data_fim_locacao`,
        // `valor_total_contrato`, `pdf_contrato_arquivo` e `retirado_em` NÃO aparecem aqui**, e é
        // essa ausência que prova que as quatro são anuláveis. As duas primeiras são derivadas na
        // ativação (RD-10); declará-las não nulas obrigaria a criação a inventar valores que só a
        // ativação decide, e o defeito só apareceria na primeira criação em operação.
        expect(await restricoesDe(banco.cadeiaConexao, 'contrato')).toEqual([
          'n:contrato_codigo_not_null',
          'n:contrato_data_inicio_locacao_not_null',
          'c:contrato_dia_vencimento_chk',
          'n:contrato_dia_vencimento_not_null',
          'u:contrato_empresa_codigo_key',
          'n:contrato_empresa_id_not_null',
          'n:contrato_gerar_cobrancas_automaticamente_not_null',
          'u:contrato_id_empresa_key',
          'n:contrato_id_not_null',
          'f:contrato_imovel_empresa_fkey',
          'n:contrato_imovel_id_not_null',
          'f:contrato_locador_empresa_fkey',
          'n:contrato_locador_id_not_null',
          'f:contrato_locatario_empresa_fkey',
          'n:contrato_locatario_id_not_null',
          'p:contrato_pkey',
          'n:contrato_prazo_meses_not_null',
          'c:contrato_prazo_positivo_chk',
          'n:contrato_status_not_null',
          'n:contrato_valor_mensal_not_null',
          'c:contrato_valor_mensal_positivo_chk',
        ]);
        // O vínculo tem QUATRO colunas, todas não nulas, duas chaves compostas e duas unicidades —
        // e nada mais. A lista é a forma inteira dele, e é onde uma restrição acrescentada "por
        // simetria" com as entidades de cadastro apareceria.
        expect(await restricoesDe(banco.cadeiaConexao, 'contrato_fiador')).toEqual([
          'f:contrato_fiador_contrato_empresa_fkey',
          'u:contrato_fiador_contrato_fiador_key',
          'n:contrato_fiador_contrato_id_not_null',
          'n:contrato_fiador_empresa_id_not_null',
          'f:contrato_fiador_fiador_empresa_fkey',
          'n:contrato_fiador_fiador_id_not_null',
          'u:contrato_fiador_id_empresa_key',
          'n:contrato_fiador_id_not_null',
          'p:contrato_fiador_pkey',
        ]);

        // --- Passo 2: a sequência existe, e mesmo assim não é examinada -------------------------
        //
        // Antes de criar o contador não há sequência alguma em `negocio` — é a âncora que impede o
        // passo seguinte de passar por vacuidade.
        expect(await sequenciasDeNegocio(banco.cadeiaConexao)).toEqual([]);

        await criarContadorPeloCaminhoDaAplicacao(
          banco.cadeiaConexao,
          EMPRESA_A.id,
          ANO_DO_CONTADOR,
        );

        // O nome vem do catálogo, e não é recomposto aqui: recompor `contrato_{ano}_{empresa}` no
        // caso reimplementaria no teste a regra que a função aplica, e o par passaria a se conferir
        // contra uma cópia de si mesmo.
        const sequencias = await sequenciasDeNegocio(banco.cadeiaConexao);
        expect(sequencias).toHaveLength(1);
        const contador = sequencias[0] ?? '';
        expect(contador).not.toBe('');

        const comContador = await verificarCoberturaDeIsolamento(banco.cadeiaConexao);
        // A sequência EXISTE (afirmado acima) e ainda assim não entra em `tabelasExaminadas`, e não
        // produz exceção nenhuma. As duas metades são necessárias: sem a primeira, "não reprovou"
        // também seria verdade sobre uma guarda que a examinasse e a aprovasse por engano.
        expect(comContador.tabelasExaminadas).not.toContain(contador);
        expect(comContador).toEqual({
          excecoes: [],
          tabelasExaminadas: TABELAS_LEGITIMAS,
        } satisfies CoberturaDeIsolamento);

        // --- Passo 3: o mutante ----------------------------------------------------------------
        await executarPrivilegiado(doMigrador, [
          `ALTER TABLE ${TABELA_MUTANTE_DO_CONTRATO} NO FORCE ROW LEVEL SECURITY`,
        ]);

        try {
          // A guarda é invocada pela cadeia SEM privilégio, como no controle: `NO FORCE` é
          // invisível para o papel da aplicação em toda leitura de dado, e é justamente por isso
          // que a resposta tem de vir do catálogo.
          const comMutante = await verificarCoberturaDeIsolamento(banco.cadeiaConexao);

          // Exatamente UMA entrada, com a tabela e o motivo exatos — não "alguma exceção".
          expect(comMutante.excecoes).toEqual([
            { tabela: TABELA_MUTANTE_DO_CONTRATO, motivo: 'RLS_NAO_FORCADA' },
          ]);

          // Os vinte e um continuam EXAMINADOS: sem esta metade, uma guarda que tivesse perdido de vista
          // os doze irmãos reportaria a mesma exceção única e passaria.
          expect(comMutante.tabelasExaminadas).toEqual(TABELAS_LEGITIMAS);

          // E a tabela IRMÃ da mesma migração segue aprovada — a guarda distingue as duas em vez de
          // reprovar em bloco o que a `0007` criou.
          expect(comMutante.excecoes.map((excecao) => excecao.tabela)).not.toContain(
            TABELA_DE_CONTRATO_FIADOR,
          );
        } finally {
          await executarPrivilegiado(doMigrador, [
            `ALTER TABLE ${TABELA_MUTANTE_DO_CONTRATO} FORCE ROW LEVEL SECURITY`,
          ]);
        }

        // --- Passo 4: o controle DEPOIS ---------------------------------------------------------
        //
        // Restaurado o `FORCE`, a guarda volta ao vazio. É a terceira perna do par
        // controle→mutante→controle, e sem ela "reprovou" poderia ser estado residual.
        const restaurado = await verificarCoberturaDeIsolamento(banco.cadeiaConexao);
        expect(restaurado).toEqual({
          excecoes: [],
          tabelasExaminadas: TABELAS_LEGITIMAS,
        } satisfies CoberturaDeIsolamento);
      } finally {
        await banco.parar();
      }
    },
    LIMITE_COM_INSTANCIA_PROPRIA_MS,
  );
});

// ===========================================================================
// CT-535 — as funções da série da COBRANÇA: sem empresa, com guarda, sem sequência
// ===========================================================================
//
// Ele é o CT-406 e o CT-431 desta fatia reunidos num caso só, sobre o par de funções que a `0010`
// cria. A razão de existir é a mesma que aqueles registram, e ela não envelheceu: as funções são
// `SECURITY DEFINER` e rodam com os direitos de `sysloc_migracao`, que é DONO das tabelas de
// `negocio`. Tudo o que elas aceitarem por argumento, a aplicação passa a poder pedir com o
// privilégio da dona — inclusive o que a política de linha lhe tira.
//
// Daí os dois eixos, e nenhum substitui o outro:
//
//   * a **assinatura** — afirmada por introspecção do catálogo, e não por comportamento.
//     Comportamento se conserta com uma conferência a mais dentro da função; assinatura sem o
//     parâmetro de empresa torna o pedido cruzado **irrepresentável**;
//   * o **privilégio** — o `nextval` corre DENTRO da função, e o papel da aplicação nunca toca a
//     sequência. A ADR-0020 registra entre os *Neutros* que alargar o privilégio do papel da
//     aplicação **não é o caminho**, e é este caso que impede que alguém o alargue "para
//     simplificar" sem que nada acuse. É a rede executável do `DECISÃO FECHADA` da `0010` §6.
//
// A instância é DEDICADA e descartada ao fim — o caso cria sequências, e a compartilhada passaria a
// conviver com contadores que os demais casos deste arquivo afirmam não existir (CT-421, passo 2).
//
// As três utilidades locais abaixo repetem, em forma, as de `papel-de-conexao.spec.ts`. A
// duplicação é deliberada: aquelas são privadas daquele módulo, e exportá-las só para este caso
// enxergá-las seria o seam que a `.claude/rules/testing-stack.md` proíbe. O que NÃO se duplica é o
// nome das funções sob teste — cada helper o escreve literalmente, e nenhum o recebe por variável.

/** O escopo que os passos de privilégio usam. Ano fixo: o que se observa não é o valor emitido. */
const ANO_DA_COBRANCA = 2026;

/** `SQLSTATE` de privilégio insuficiente — o que o servidor devolve ao negar a sequência. */
const PRIVILEGIO_INSUFICIENTE = '42501';

/** `SQLSTATE` de `RAISE EXCEPTION` sem código próprio — o que as duas funções levantam. */
const EXCECAO_LEVANTADA = 'P0001';

/** As duas mensagens declaradas na migração `0010`, escritas UMA vez cada. */
const RECUSA_SEM_CONTEXTO =
  'contexto de empresa ausente: app.empresa_id não está fixado nesta transação';
const RECUSA_DE_FAIXA = 'ano do contador fora da faixa admitida';

/**
 * Os anos que a guarda de faixa das duas funções recusa, escritos como literal de SQL.
 *
 * Os três discriminam ramos diferentes, e nenhum é redundante: `NULL::integer` cobre a função **não
 * ser `STRICT`** — o corpo correria, e `format('cobranca_%s_%s', NULL, …)` renderia cadeia vazia no
 * lugar do ano, criando um contador de escopo indeterminado; `1999` e `3000` cobrem os dois extremos
 * da faixa, e um só deles deixaria vivo um mutante que trocasse a comparação por uma desigualdade de
 * um lado só.
 */
const ANOS_FORA_DA_FAIXA = ['NULL::integer', '1999', '3000'] as const;

/**
 * Os anos ACEITOS — o controle positivo do passo 5, e ele não é opcional.
 *
 * Sem ele, uma guarda escrita ao contrário (`p_ano BETWEEN 2000 AND 2999` levantando quando o ano
 * está DENTRO da faixa) passaria todas as asserções negativas acima. Os extremos entram junto do
 * meio de propósito: `2000` e `2999` são exatamente os valores que um `<`/`>` trocado por `<=`/`>=`
 * moveria.
 */
const ANOS_ACEITOS = [2000, 2027, 2999] as const;

/** O desfecho de uma instrução, coletado em vez de abortar — mesmo padrão do CT-406. */
interface DesfechoDeSql {
  readonly codigo: string;
  readonly mensagem: string;
}

/**
 * Executa uma instrução e devolve o desfecho como valor.
 *
 * `GRAVOU` é um desfecho legítimo e distinguível: o caso que espera recusa afirma o par
 * `(código, mensagem)` por igualdade, e uma execução bem-sucedida aparece como `GRAVOU` em vez de
 * passar despercebida.
 */
async function tentarInstrucao(cadeia: string, instrucao: string): Promise<DesfechoDeSql> {
  const sql = abrirConexao(cadeia, { maximoDeConexoes: 1 });
  try {
    await sql.unsafe(instrucao);
    return { codigo: 'GRAVOU', mensagem: '' };
  } catch (erro) {
    const codigo = (erro as { code?: string }).code ?? 'sem sqlstate';
    return { codigo, mensagem: erro instanceof Error ? erro.message : String(erro) };
  } finally {
    await sql.end();
  }
}

/**
 * Executa uma instrução com o contexto de empresa VÁLIDO e fixado, e devolve o desfecho como valor.
 *
 * O contexto é fixado na SESSÃO (`is_local = false`) e não numa transação, e a escolha é conteúdo:
 * a instrução corre em autocommit, de modo que um `CREATE SEQUENCE` executado ANTES da guarda
 * ficaria commitado e apareceria no retrato de sequências do passo seguinte. Sob `sql.begin` o
 * desfazimento apagaria o resíduo, e a asserção de resíduo deixaria de poder falhar.
 */
async function tentarInstrucaoComContexto(
  cadeia: string,
  empresaId: string,
  instrucao: string,
): Promise<DesfechoDeSql> {
  const sql = abrirConexao(cadeia, { maximoDeConexoes: 1 });
  try {
    await sql`SELECT set_config('app.empresa_id', ${empresaId}, false)`;
    await sql.unsafe(instrucao);
    return { codigo: 'GRAVOU', mensagem: '' };
  } catch (erro) {
    const codigo = (erro as { code?: string }).code ?? 'sem sqlstate';
    return { codigo, mensagem: erro instanceof Error ? erro.message : String(erro) };
  } finally {
    await sql.end();
  }
}

/**
 * Cria o contador de um escopo `(empresa, ano)` da COBRANÇA pelo caminho LEGÍTIMO e emite o
 * primeiro número — as DUAS unidades da §7.4, na ordem que ela fixa.
 *
 * Ela é irmã de {@link criarContadorPeloCaminhoDaAplicacao}, e não uma generalização dela: cada uma
 * escreve LITERALMENTE o nome das funções que exercita. Passar o nome por parâmetro tornaria a
 * função sob teste um valor, e a asserção deixaria de dizer qual delas foi chamada.
 */
async function emitirNumeroDeCobranca(
  cadeia: string,
  empresaId: string,
  ano: number,
): Promise<string> {
  const sql = abrirConexao(cadeia, { maximoDeConexoes: 1 });
  try {
    // A primeira unidade cria e COMMITA a sequência; a segunda a consome. Fundi-las faria o
    // desfazimento devolver o número, contra a ADR-0015.
    await sql.begin(async (tx) => {
      await tx`SELECT set_config('app.empresa_id', ${empresaId}, true)`;
      await tx`SELECT negocio.garantir_contador_de_cobranca(${ano})`;
    });
    return await sql.begin(async (tx) => {
      await tx`SELECT set_config('app.empresa_id', ${empresaId}, true)`;
      const [linha] = await tx<{ numero: string }[]>`
        SELECT negocio.proximo_numero_de_cobranca(${ano})::text AS numero
      `;
      if (linha === undefined) {
        throw new Error('a emissão não devolveu linha');
      }
      return linha.numero;
    });
  } finally {
    await sql.end();
  }
}

/** A assinatura de identidade de cada função da série da cobrança, tal como o catálogo a guarda. */
interface AssinaturaDaSerie {
  readonly nome: string;
  /**
   * A assinatura de IDENTIDADE — nome e tipo de cada parâmetro, **sem o valor padrão**.
   *
   * É a forma que identifica a função para `REVOKE`/`GRANT`, e é onde um parâmetro de empresa
   * apareceria. `pg_get_function_identity_arguments` inclui o nome do parâmetro e omite o
   * `DEFAULT 1` — que é afirmado à parte, pelo CT-406, sobre a série do contrato.
   */
  readonly tiposDosArgumentos: string;
  readonly definidoPeloDono: boolean;
  readonly caminhoDeBusca: string;
}

async function assinaturasDaSerieDeCobranca(cadeia: string): Promise<AssinaturaDaSerie[]> {
  const sql = abrirConexao(cadeia, { maximoDeConexoes: 1 });
  try {
    return await sql<AssinaturaDaSerie[]>`
      SELECT p.proname                                    AS nome,
             pg_get_function_identity_arguments(p.oid)    AS "tiposDosArgumentos",
             p.prosecdef                                  AS "definidoPeloDono",
             coalesce(array_to_string(p.proconfig, ' | '), 'SEM CONFIGURACAO') AS "caminhoDeBusca"
        FROM pg_catalog.pg_proc p
        JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = 'negocio'
         AND p.proname LIKE '%\_cobranca'
       ORDER BY p.proname
    `;
  } finally {
    await sql.end();
  }
}

describe('CT-535 — a série da cobrança não aceita empresa, guarda o ano e não concede a sequência', () => {
  it(
    'CT-535 — assinatura sem `uuid`, guarda de faixa nas duas, `EXECUTE` concedido e sequência inalcançável',
    async () => {
      const banco = await bancoEfemero();

      try {
        // --- Passo 1 e 2: a ASSINATURA, pelo catálogo -------------------------------------------
        //
        // A igualdade cobre quatro fatos de uma vez, e cada um é um mutante morto:
        //
        //   * as DUAS funções da série da cobrança são estas — uma terceira, criada para
        //     "facilitar", apareceria aqui;
        //   * **nenhuma tem parâmetro de empresa**: a lista de tipos é afirmada por igualdade, e um
        //     `uuid` acrescentado à assinatura aparece nela. É o pedido cruzado sendo
        //     IRREPRESENTÁVEL, e não conferido;
        //   * as duas são `SECURITY DEFINER` — sem isso, o `nextval` correria com os direitos de
        //     quem chama e o passo 8 recusaria a chamada legítima;
        //   * as duas fixam `search_path`, com o schema temporário em ÚLTIMO lugar. Uma
        //     `SECURITY DEFINER` sem `search_path` fixo é sequestrável por quem chama, e o catálogo
        //     é o único lugar onde essa propriedade é observável.
        const assinaturas = await assinaturasDaSerieDeCobranca(banco.cadeiaConexao);
        expect(assinaturas).toEqual([
          {
            nome: 'garantir_contador_de_cobranca',
            tiposDosArgumentos: 'p_ano integer, p_inicio bigint',
            definidoPeloDono: true,
            caminhoDeBusca: 'search_path=pg_catalog, pg_temp',
          },
          {
            nome: 'proximo_numero_de_cobranca',
            tiposDosArgumentos: 'p_ano integer',
            definidoPeloDono: true,
            caminhoDeBusca: 'search_path=pg_catalog, pg_temp',
          },
        ] satisfies AssinaturaDaSerie[]);

        // Dito também de forma direta, e não deduzido da igualdade acima: é ESTE o fato que a
        // decisão fixa, e é ele que precisa nomear a regressão se ela vier.
        expect(
          assinaturas.map((assinatura) => assinatura.tiposDosArgumentos.includes('uuid')),
        ).toEqual([false, false]);

        // --- Passo 3: as duas funções, chamadas SEM contexto ------------------------------------
        //
        // A chamada é direta, por SQL, sem passar por escritor de contexto algum — é o que reproduz
        // o estado real de uma conexão que ninguém preparou.
        const semContexto = [
          await tentarInstrucao(
            banco.cadeiaConexao,
            `SELECT negocio.garantir_contador_de_cobranca(${ANO_DA_COBRANCA})`,
          ),
          await tentarInstrucao(
            banco.cadeiaConexao,
            `SELECT negocio.proximo_numero_de_cobranca(${ANO_DA_COBRANCA})`,
          ),
        ];

        // O SQLSTATE **e** a mensagem, por igualdade: `P0001` sozinho não diz que foi o contexto que
        // faltou — qualquer `RAISE` da função devolveria o mesmo —, e a mensagem sozinha não diz que
        // a recusa veio do servidor. A mensagem NOMEIA `app.empresa_id`, e não ecoa entrada nenhuma.
        expect(semContexto.map((desfecho) => `${desfecho.codigo} · ${desfecho.mensagem}`)).toEqual([
          `${EXCECAO_LEVANTADA} · ${RECUSA_SEM_CONTEXTO}`,
          `${EXCECAO_LEVANTADA} · ${RECUSA_SEM_CONTEXTO}`,
        ]);

        // A recusa não deixa RESÍDUO. Sem esta asserção, uma função que criasse a sequência ANTES de
        // conferir o contexto passaria pelo passo acima e teria deixado um contador órfão — de
        // escopo indeterminado — para trás.
        expect(await sequenciasDeNegocio(banco.cadeiaConexao)).toEqual([]);

        // --- Passo 4: a guarda de faixa do ano, nas DUAS funções --------------------------------
        //
        // O contexto aqui é VÁLIDO e fixado, e é isso que separa esta recusa da do passo 3: sem o
        // contexto, a guarda de contexto levantaria primeiro e a asserção ficaria verde sobre funções
        // sem guarda de faixa nenhuma. As SEIS linhas são afirmadas de uma vez — três entradas × duas
        // funções —, porque o invariante é que as duas superfícies pelas quais o escopo
        // `(empresa, ano)` é NOMEADO tenham a MESMA superfície de entrada: guardar só a que cria
        // deixaria a que consome aceitar o ano nulo.
        const foraDaFaixa: string[] = [];
        for (const funcao of ['garantir_contador_de_cobranca', 'proximo_numero_de_cobranca']) {
          for (const ano of ANOS_FORA_DA_FAIXA) {
            const desfecho = await tentarInstrucaoComContexto(
              banco.cadeiaConexao,
              EMPRESA_A.id,
              `SELECT negocio.${funcao}(${ano})`,
            );
            foraDaFaixa.push(`${funcao}(${ano}) -> ${desfecho.codigo} · ${desfecho.mensagem}`);
          }
        }

        // O RESÍDUO é afirmado ANTES das mensagens, e a ordem é conteúdo: é ela que torna esta
        // asserção capaz de falhar. Sem a guarda, `garantir_…(NULL)` cria de fato
        // `cobranca__<32 hexadecimais>` — um contador de escopo INDETERMINADO, permanente e invisível
        // à guarda de cobertura do catálogo, que exclui sequências por espécie —, e é este retrato,
        // não a mensagem, que nomeia o dano. Posta depois da igualdade de mensagens, ela nunca
        // chegaria a ser avaliada no mutante que ela discrimina.
        expect(await sequenciasDeNegocio(banco.cadeiaConexao)).toEqual([]);

        expect(foraDaFaixa).toEqual([
          `garantir_contador_de_cobranca(NULL::integer) -> ${EXCECAO_LEVANTADA} · ${RECUSA_DE_FAIXA}: <NULL>`,
          `garantir_contador_de_cobranca(1999) -> ${EXCECAO_LEVANTADA} · ${RECUSA_DE_FAIXA}: 1999`,
          `garantir_contador_de_cobranca(3000) -> ${EXCECAO_LEVANTADA} · ${RECUSA_DE_FAIXA}: 3000`,
          `proximo_numero_de_cobranca(NULL::integer) -> ${EXCECAO_LEVANTADA} · ${RECUSA_DE_FAIXA}: <NULL>`,
          `proximo_numero_de_cobranca(1999) -> ${EXCECAO_LEVANTADA} · ${RECUSA_DE_FAIXA}: 1999`,
          `proximo_numero_de_cobranca(3000) -> ${EXCECAO_LEVANTADA} · ${RECUSA_DE_FAIXA}: 3000`,
        ]);

        // --- Passo 5: o CONTROLE POSITIVO -------------------------------------------------------
        //
        // Sem ele, uma guarda escrita ao contrário passaria todas as asserções negativas acima. O
        // número emitido é afirmado por igualdade, e não "algum número": o primeiro de um escopo
        // virgem é `1`, por `START WITH 1`.
        const aceitos: string[] = [];
        for (const ano of ANOS_ACEITOS) {
          aceitos.push(
            `${ano} -> ${await emitirNumeroDeCobranca(banco.cadeiaConexao, EMPRESA_A.id, ano)}`,
          );
        }
        expect(aceitos).toEqual(['2000 -> 1', '2027 -> 1', '2999 -> 1']);

        // --- Passo 6 a 8: o privilégio ----------------------------------------------------------
        //
        // A pré-condição é o contador do escopo, criado pelo caminho legítimo, pela conexão do papel
        // da APLICAÇÃO — a única que `bancoEfemero()` publica como campo.
        expect(
          await emitirNumeroDeCobranca(banco.cadeiaConexao, EMPRESA_A.id, ANO_DA_COBRANCA),
        ).toBe('1');

        // O nome vem do catálogo, e não é recomposto aqui: recompô-lo reimplementaria no caso a regra
        // que a função aplica, e o par passaria a se conferir contra uma cópia de si mesmo.
        const contador = (await sequenciasDeNegocio(banco.cadeiaConexao)).find((nome) =>
          nome.startsWith(`negocio.cobranca_${ANO_DA_COBRANCA}_`),
        );
        expect(contador).toBeTypeOf('string');
        const alvo = contador ?? '';

        const privilegios = await (async () => {
          const sql = abrirConexao(banco.cadeiaConexao, { maximoDeConexoes: 1 });
          try {
            const [linha] = await sql<
              {
                executaGarantir: boolean;
                executaProximo: boolean;
                usa: boolean;
                le: boolean;
                escreve: boolean;
              }[]
            >`
              SELECT has_function_privilege(
                       'sysloc_app',
                       'negocio.garantir_contador_de_cobranca(integer, bigint)',
                       'EXECUTE'
                     ) AS "executaGarantir",
                     has_function_privilege(
                       'sysloc_app',
                       'negocio.proximo_numero_de_cobranca(integer)',
                       'EXECUTE'
                     ) AS "executaProximo",
                     has_sequence_privilege('sysloc_app', ${alvo}, 'USAGE')  AS usa,
                     has_sequence_privilege('sysloc_app', ${alvo}, 'SELECT') AS le,
                     has_sequence_privilege('sysloc_app', ${alvo}, 'UPDATE') AS escreve
            `;
            return linha;
          } finally {
            await sql.end();
          }
        })();

        // Os cinco fatos numa igualdade só: o `EXECUTE` concedido é o companheiro POSITIVO das três
        // recusas — sem ele, "sem privilégio sobre a sequência" também seria verdade sobre um papel
        // que não pudesse fazer nada. E um `SELECT` concedido por engano deixaria o valor corrente do
        // contador de uma empresa legível por qualquer conexão da aplicação, o que o `nextval` do
        // passo 8 não exercita.
        expect(privilegios).toEqual({
          executaGarantir: true,
          executaProximo: true,
          usa: false,
          le: false,
          escreve: false,
        });

        // --- Passo 8: e o `nextval` direto é RECUSADO -------------------------------------------
        //
        // Se ele SUCEDER, existe um segundo caminho para o número, e o `DECISÃO FECHADA` da `0010`
        // §6 foi violado.
        const direto = await tentarInstrucao(banco.cadeiaConexao, `SELECT nextval('${alvo}')`);
        expect(direto.codigo).toBe(PRIVILEGIO_INSUFICIENTE);
        expect(direto.mensagem).toContain('permission denied for sequence');

        // O companheiro POSITIVO da recusa, e sem ele `42501` não distinguiria "sem privilégio" de
        // "objeto que não existe com esse nome": o papel DONO executa o mesmo `nextval` sobre o mesmo
        // objeto. A sequência existe, é utilizável, e o que separa os dois papéis é o privilégio.
        expect(
          await tentarInstrucao(conexaoDeMigracao(banco), `SELECT nextval('${alvo}')`),
        ).toEqual({
          codigo: 'GRAVOU',
          mensagem: '',
        });

        // E a função continua funcionando para o papel da aplicação, lido DEPOIS da recusa: é a
        // metade que prova que o menor privilégio não quebrou o caminho legítimo. O número é `3`
        // porque o dono acabou de consumir o `2`.
        expect(
          await emitirNumeroDeCobranca(banco.cadeiaConexao, EMPRESA_A.id, ANO_DA_COBRANCA),
        ).toBe('3');
      } finally {
        await banco.parar();
      }
    },
    LIMITE_COM_INSTANCIA_PROPRIA_MS,
  );
});
