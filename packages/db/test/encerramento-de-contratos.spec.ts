/**
 * O encerramento do contrato vencido contra banco real — CT-1063 a CT-1069 e CT-1097, da T5 da
 * fatia `automacoes-agendadas`.
 *
 * ===========================================================================
 * INVARIANTES
 * ===========================================================================
 *
 * | Critério | Caso   | Invariante |
 * |----------|--------|------------|
 * | CA-05    | CT-1063| Sobre o cenário do golden transposto, o contrato `ATIVO` com
 * | CA-07    |        | `data_fim_locacao < negocio.data_corrente_da_operacao()` passa a
 * | CA-08    |        | `ENCERRADO` e o imóvel dele a `DISPONIVEL` **na mesma transação**; o de
 * |          |        | data futura e o já encerrado ficam **literalmente** como estavam. O
 * |          |        | retorno é EXATAMENTE `{ candidatos: 1, encerrados: 1, preservados: 0 }`, e
 * |          |        | a divergência frente a `total_candidatos: 2` / `total_ignorados: 1` do
 * |          |        | oráculo é **afirmada** — o segundo candidato é o contrato sem imóvel, que
 * |          |        | a §21.2 declara irrepresentável (CT-1066). |
 * | CA-05    | CT-1064| Encerrar e liberar são **um ato**: feita a segunda escrita ser recusada
 * |          |        | pelo BANCO (`55P03`, sobre a linha do imóvel travada por outra transação),
 * |          |        | a chamada rejeita e, relido por **conexão nova** depois do desfazimento, o
 * |          |        | contrato é `ATIVO`, o imóvel é `LOCADO`, a contagem de `ENCERRADO` na
 * |          |        | empresa é `0` e nenhum registro de passagem foi gravado. |
 * | CA-07    | CT-1065| Nada fora do predicado é alcançado: data futura, `data_fim_locacao` nula
 * | CA-08    |        | (rascunho), já encerrado e cancelado devolvem
 * |          |        | `{ candidatos: 0, encerrados: 0, preservados: 0 }` com estado
 * |          |        | **literalmente idêntico** ao semeado — enquanto o CONTROLE POSITIVO, na
 * |          |        | mesma tabela, devolve `{ candidatos: 1, encerrados: 1, preservados: 0 }`. |
 * | CA-06    | CT-1066| Contrato sem imóvel é **irrepresentável**: a inserção com `imovel_id` nulo
 * |          |        | é recusada com `code = '23502'` nomeando `imovel_id`, enquanto a MESMA
 * |          |        | instrução com o imóvel do cenário grava exatamente uma linha; e
 * |          |        | `count(*) WHERE imovel_id IS NULL` é `0`. |
 * | CA-09    | CT-1067| A segunda passagem do mesmo dia devolve zeros, o estado dos dois pares é
 * | CA-11    |        | igual **campo a campo** ao capturado após a primeira, e
 * |          |        | `negocio.execucao_de_rotina` permanece com **uma** linha para a rotina, com
 * |          |        | o `ocorrida_em` inalterado. |
 * | CA-22    | CT-1068| Duas passagens **comprovadamente sobrepostas** — a sobreposição é afirmada
 * |          |        | por `pg_stat_activity`, pelos dois `pid`, antes de qualquer contagem —
 * |          |        | somam exatamente os 4 candidatos: `4 + 0`, sem efeito duplicado, e a
 * |          |        | rotina recebe **uma** linha de registro. |
 * | CA-05    | CT-1069| Não há instante observável de imóvel `DISPONIVEL` com contrato `ATIVO`
 * |          |        | apontando para ele: a ativação concorrente **sucede** quando o
 * |          |        | encerramento comita (imóvel `LOCADO`, 1 vigente) e é **recusada pelo
 * |          |        | índice** (`23505` nomeando `contrato_imovel_vigente_uidx`) quando ele
 * |          |        | desfaz — e a consulta de pares inconsistentes devolve `0` linhas nos DOIS
 * |          |        | desfechos. |
 * | —        | CT-1097| A liberação é **condicional** (RD-20): dos três contratos vencidos
 * |          |        | encerrados, os imóveis `LOCADO` viram `DISPONIVEL` e o `INDISPONIVEL`
 * |          |        | permanece **literalmente** `'INDISPONIVEL'`; o resumo é profundamente igual
 * |          |        | a `{ candidatos: 3, encerrados: 3, preservados: 1 }`, e nenhum imóvel
 * |          |        | passou de `INDISPONIVEL` a `DISPONIVEL` na passagem. |
 *
 * Rastreabilidade: `CA-05, CA-07, CA-08 → CT-1063 (RD-01)` · `CA-05 → CT-1064 (RD-03)` ·
 * `CA-07, CA-08 → CT-1065 (RD-01, RD-04)` · `CA-06 → CT-1066 (RD-02)` ·
 * `CA-09, CA-11 → CT-1067 (RD-05)` · `CA-22 → CT-1068 (RD-13)` · `CA-05 → CT-1069 (RD-03)` ·
 * `— → CT-1097 (RD-20)`.
 *
 * ===========================================================================
 * CADA CASO CORRE NUMA EMPRESA PRÓPRIA — e a razão é o alcance da rotina
 * ===========================================================================
 *
 * `encerrarContratosVencidos` não recebe recorte algum: ela alcança **todo** contrato vencido que a
 * política deixa a empresa do contexto enxergar. Dois casos que compartilhassem empresa
 * compartilhariam conjunto de candidatos, e as contagens exatas que esta suíte afirma passariam a
 * depender da ordem em que o arcabouço executa os `describe` — que é a receita do caso que passa
 * sozinho e reprova na suíte.
 *
 * A saída é `admitirEmpresaNova`, no molde que `execucao-de-rotina.spec.ts` e
 * `politica-de-aviso.spec.ts` já usam: `identidade.empresa` não tem política (ADR-0009), de modo que
 * a admissão corre sob qualquer contexto válido, e ela é a porta **pública** do pacote — a mesma que
 * o Master usa. Duas consequências que os casos consomem: `{ candidatos: N }` é absoluto, e não
 * relativo a uma contagem prévia; e `count(*)` sobre `negocio.execucao_de_rotina` já vem recortado
 * pela RLS na empresa do caso, sem que nenhuma consulta desta suíte escreva `WHERE empresa_id`
 * (ADR-0008).
 *
 * ===========================================================================
 * O ARRANJO É MONTADO PELAS PORTAS DE PRODUÇÃO — nunca por `UPDATE` cru
 * ===========================================================================
 *
 * A cadeia `conjunto → imóvel → pessoas → contrato` vem de `./cenario-de-cobranca.ts`, a casa
 * compartilhada — **importada, não recopiada** (`D21 · F4/T9`). O docblock dela nomeia esta fatia
 * entre as consumidoras previstas: *"quem precisar de contrato `ATIVO` (a régua, o encerramento)
 * ativa por fora, com o `contratoCodigo` que este módulo devolve"*.
 *
 * A ativação daqui **reproduz a composição da borda**: `ativarContrato` seguido de
 * `definirSituacaoDeLocacaoDoImovel(…, 'LOCADO')`, na mesma unidade, que são as etapas 6 e 7 de
 * `ContratoService.ativar`. E o estado `ENCERRADO` de um arranjo é produzido pelo **único produtor
 * dele**: uma passagem da própria rotina, corrida **antes** de os candidatos vivos existirem.
 *
 * ⚠️ **`UPDATE negocio.imovel SET status_locacao` não aparece em lugar nenhum desta suíte**, e a
 * ausência é o ponto: escrever a coluna por fora provaria que uma coluna que o próprio caso gravou
 * não mudou, em vez de provar que a porta estreita a preserva. As duas únicas instruções cruas aqui
 * são as **leituras** de conferência e os dois `INSERT` do CT-1066, que existem para contornar a
 * porta de propósito — é o discriminador que `isolamento.spec.ts` documenta.
 *
 * ===========================================================================
 * O ESTADO `INDISPONIVEL` DO CT-1097 nasce pelo caminho real desta CAMADA
 * ===========================================================================
 *
 * O card do CT-1097 nomeia `ImovelService.definirSituacaoDeLocacao` como caminho legítimo. **Ele não
 * é importável daqui**: `packages/db` está abaixo de `apps/api` no grafo de dependências, e
 * importá-lo inverteria o sentido. O caminho real **nesta camada** é a porta estreita
 * `definirSituacaoDeLocacaoDoImovel` — exatamente a instrução que aquele serviço executa **depois**
 * da guarda dele —, e a **ordem** é o que reproduz a guarda: a situação é posta enquanto o contrato
 * ainda é `RASCUNHO`, isto é, quando `contratoVigente` é nulo e o serviço deixaria passar. Em
 * seguida o contrato é ativado, porque *"locar um imóvel `INDISPONIVEL` passa"*.
 *
 * A ativação do caso `INDISPONIVEL` **não** escreve `LOCADO` no imóvel, e a assimetria é deliberada:
 * escrevê-lo apagaria o estado que o caso mede. O par que fica — imóvel `INDISPONIVEL` com contrato
 * `ATIVO` — é o mesmo que a janela do `D44 · F2/T10` produz em operação, e é justamente por ele ser
 * alcançável que a RD-20 existe.
 *
 * ===========================================================================
 * A SOBREPOSIÇÃO DAS TRANSAÇÕES É AFIRMADA, NUNCA PRESUMIDA
 * ===========================================================================
 *
 * O CT-1068 e o CT-1069 medem concorrência, e um caso que só disparasse duas promessas mediria dois
 * sequenciais — e passaria com `SKIP LOCKED` nenhum. Cada um confirma a sobreposição por **estado
 * observável do servidor**, com limite declarado em constante nomeada, e nunca por espera fixa:
 *
 *   * o **CT-1069** sonda `pg_stat_activity` até existir sessão **esperando por bloqueio**
 *     (`wait_event_type = 'Lock'`) — é o molde do `CT-407`, e ali a segunda transação de fato
 *     bloqueia, no índice de vigência;
 *   * o **CT-1068** NÃO pode usar aquele molde, e a diferença é o próprio mecanismo sob teste:
 *     `SKIP LOCKED` existe para que a segunda passagem **não** espere. Ela pula as linhas travadas e
 *     termina de imediato, de modo que uma sondagem por sessão bloqueada expiraria sempre. O que se
 *     afirma ali é o fato que interessa — as **duas** transações abertas ao mesmo tempo —, pelos dois
 *     `pid` capturados dentro de cada unidade e comparados **por igualdade** contra as sessões com
 *     transação em curso.
 *
 * ⚠️ Reproduzir aqui o `esperarSessaoBloqueada` do `CT-407` seria a **segunda** declaração de
 * sondagem de `pg_stat_activity` em `packages/db/test/`. Ela não sobe para casa compartilhada nesta
 * task por duas razões: o Limiar de Três ainda não disparou (são duas), e a irmã vive dentro de
 * `contrato.spec.ts`, arquivo que esta task não está autorizada a abrir. Quem escrever a terceira
 * cria a casa e migra as três — está declarado nas Pendências desta task.
 *
 * ===========================================================================
 * De onde vem o banco (ADR-0006)
 * ===========================================================================
 *
 * De uma instância efêmera própria, migrada, descartada ao fim. Nenhuma coordenada de conexão é lida
 * do ambiente — a suíte nunca toca o banco que atende a operação.
 */

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import type { EstadoDoContrato, RotinaPublicada, SituacaoDeLocacao } from '@sysloc/contracts';
import type { TransactionSql } from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  ativarContrato,
  type ContratoPersistido,
  cancelarContrato,
  criarContrato,
  emitirNumeroDeContrato,
  garantirContadorDeContrato,
  lerAnoDaSerieDeContrato,
  localizarContrato,
} from '../src/contrato.ts';
import { derivarValorTotal } from '../src/derivacao-de-contrato.ts';
import { admitirEmpresa } from '../src/empresa.ts';
import {
  encerrarContratosVencidos,
  type ResultadoDoEncerramento,
} from '../src/encerramento-de-contratos.ts';
import { registrarExecucaoDeRotina } from '../src/execucao-de-rotina.ts';
import { definirSituacaoDeLocacaoDoImovel } from '../src/imovel.ts';
import { EMPRESA_A } from '../src/semente.ts';
import { type AcessoAoBanco, abrirAcessoAoBanco } from '../src/unidade-de-trabalho.ts';
import { type BancoMigrado, bancoEfemero } from './banco-efemero.ts';
import { semearCobrancaDoZero } from './cenario-de-cobranca.ts';
import { type Contexto, emUnidadeSobContexto } from './unidade-sob-contexto.ts';

// ---------------------------------------------------------------------------
// Limites de tempo — constantes nomeadas, nunca número mágico no meio do caso
// ---------------------------------------------------------------------------

/** Subir a instância, provisionar papéis, migrar e semear leva dezenas de segundos nesta máquina. */
const LIMITE_SUBIDA_MS = 90_000;

/** Cada caso semeia poucos pares e roda uma ou duas passagens. Teto folgado sobre o observado. */
const LIMITE_DO_CASO_MS = 60_000;

/** Até quando o CT-1069 sonda `pg_stat_activity` à espera da sessão bloqueada pelo índice. */
const LIMITE_DA_SONDAGEM_MS = 20_000;

/** O intervalo entre sondagens — espera por estado observável, nunca espera fixa por tempo. */
const INTERVALO_DA_SONDAGEM_MS = 25;

/**
 * Quanto a unidade do CT-1064 espera pela linha do imóvel antes de o BANCO recusar a escrita.
 *
 * Ele não mede desempenho: é o que transforma uma espera indefinida — que penduraria o caso — na
 * recusa `55P03` que o caso existe para observar. A trava concorrente já está tomada quando a
 * passagem começa, de modo que o valor não corre com nada; ele é curto porque o desfecho é certo.
 */
const ESPERA_PELA_LINHA_DO_IMOVEL = '250ms';

/** Reserva de UMA conexão: cada acesso desta suíte corre sobre uma conexão física própria. */
const RESERVA_DE_UMA = 1;

// ---------------------------------------------------------------------------
// O vocabulário do domínio, tipado — literal fora da união fechada não compila
// ---------------------------------------------------------------------------

/** A rotina a que o registro de passagem pertence — `RotinaPublicada`, e não cadeia solta. */
const ROTINA_DO_ENCERRAMENTO: RotinaPublicada = 'ENCERRAMENTO_DE_CONTRATOS';

const ESTADO_RASCUNHO: EstadoDoContrato = 'RASCUNHO';
const ESTADO_VIGENTE: EstadoDoContrato = 'ATIVO';
const ESTADO_CANCELADO: EstadoDoContrato = 'CANCELADO';
const ESTADO_ENCERRADO: EstadoDoContrato = 'ENCERRADO';

const SITUACAO_DISPONIVEL: SituacaoDeLocacao = 'DISPONIVEL';
const SITUACAO_LOCADO: SituacaoDeLocacao = 'LOCADO';
const SITUACAO_INDISPONIVEL: SituacaoDeLocacao = 'INDISPONIVEL';

/** O molde da DATA que o arranjo compõe **no banco** — nunca um `Date` do processo (ADR-0026). */
const FORMATO_ISO_DA_DATA = 'YYYY-MM-DD';

/** O molde do INSTANTE em que o `ocorrida_em` do registro atravessa para comparação. */
const FORMATO_ISO_DO_INSTANTE = 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"';

/** O `SQLSTATE` da violação de coluna obrigatória — o que o CT-1066 mede. */
const VIOLACAO_DE_NAO_NULO = '23502';

/** O `SQLSTATE` da violação de unicidade, e o nome do índice de vigência que o CT-1069 espera. */
const VIOLACAO_DE_UNICIDADE = '23505';
const INDICE_DA_VIGENCIA = 'contrato_imovel_vigente_uidx';

/** O `SQLSTATE` com que o servidor recusa esperar por uma trava além do limite declarado. */
const TRAVA_INDISPONIVEL = '55P03';

/** Quantos candidatos as duas passagens sobrepostas do CT-1068 disputam. */
const CANDIDATOS_EM_DISPUTA = 4;

/**
 * Quanto adiante vence o contrato que disputa o imóvel no CT-1069.
 *
 * Ele é longe de propósito: o disputante existe para **ocupar** a posição do índice de vigência, e um
 * horizonte curto o tornaria candidato de uma passagem futura — o caso passaria a medir dois
 * encerramentos em vez da disputa que ele nomeia.
 */
const DIAS_ATE_O_FIM_DO_DISPUTANTE = 365;

// ---------------------------------------------------------------------------
// O oráculo — o golden lido do arquivo versionado
// ---------------------------------------------------------------------------

/** O registro capturado do sistema antigo. Caminho relativo a este arquivo, nunca ao processo. */
const CAMINHO_DO_GOLDEN = fileURLToPath(
  new URL(
    '../../../docs/specs/features/caracterizacao-regras-legadas/v1/golden/encerrar-contratos-vencidos.json',
    import.meta.url,
  ),
);

/** Quantos contratos e imóveis o golden traz — a âncora contra arquivo truncado ou trocado. */
const CONTRATOS_DO_GOLDEN = 4;
const IMOVEIS_DO_GOLDEN = 3;

/** O contrato do golden que **não tem instância possível** no produto novo (§21.2, CT-1066). */
const CONTRATO_SEM_IMOVEL_DO_GOLDEN = 'CTR-CARACT-ECV-02';
const MOTIVO_DE_DESCARTE_DO_GOLDEN = 'contrato_sem_imovel';

/**
 * A tradução dos rótulos do legado para a união fechada do produto novo.
 *
 * Ela é escrita **por extenso**, e não derivada de normalização de texto: `Disponível` perde o acento
 * e `Encerrado` muda de caixa, e uma normalização genérica acertaria os dois por acidente enquanto
 * aceitaria calada um rótulo que o oráculo nunca trouxe. O tipo do valor é a união fechada, de modo
 * que um alvo inventado **não compila**.
 */
const ESTADO_POR_ROTULO_DO_LEGADO: Readonly<Record<string, EstadoDoContrato>> = Object.freeze({
  Ativo: ESTADO_VIGENTE,
  Encerrado: ESTADO_ENCERRADO,
});

const SITUACAO_POR_ROTULO_DO_LEGADO: Readonly<Record<string, SituacaoDeLocacao>> = Object.freeze({
  Locado: SITUACAO_LOCADO,
  Disponível: SITUACAO_DISPONIVEL,
});

/** Um contrato do golden, nos campos que a transposição consome. */
interface ContratoDoGolden {
  readonly name: string;
  readonly imovel: string;
  readonly status_contrato: string;
  readonly data_fim_locacao_offset_dias: number;
}

/** Um imóvel do golden — a situação de locação é o que a transposição consome. */
interface ImovelDoGolden {
  readonly name: string;
  readonly status_locacao: string;
}

/** Um item do relatório que o sistema antigo devolveu. */
interface ResultadoDoGolden {
  readonly name: string;
  readonly acao: string;
  readonly motivo?: string;
}

/** O golden inteiro, na forma que os casos consomem. */
interface Golden {
  readonly entrada: {
    readonly contratos: readonly ContratoDoGolden[];
    readonly imoveis: readonly ImovelDoGolden[];
  };
  readonly estado_resultante: {
    readonly contratos: readonly ContratoDoGolden[];
    readonly imoveis: readonly ImovelDoGolden[];
  };
  readonly retorno: {
    readonly total_candidatos: number;
    readonly total_encerrados: number;
    readonly total_ignorados: number;
    readonly resultados: readonly ResultadoDoGolden[];
  };
}

let golden: Golden;

// ---------------------------------------------------------------------------
// O cenário
// ---------------------------------------------------------------------------

/** O contexto da carga inicial — usado só para admitir empresa e sondar o servidor. */
const CONTEXTO_DA_SEMENTE: Contexto = { empresaId: EMPRESA_A.id };

/** O par que cada arranjo devolve: o contrato pelo código e o imóvel pelo identificador interno. */
interface ParSemeado {
  readonly contratoCodigo: string;
  readonly imovelId: string;
}

/** O estado observado de um par, lido **cruamente** das duas tabelas. */
interface EstadoDoPar {
  readonly status: EstadoDoContrato;
  readonly situacaoDoImovel: SituacaoDeLocacao;
}

let banco: BancoMigrado;
let acesso: AcessoAoBanco;
let empresasAdmitidas = 0;

beforeAll(async () => {
  banco = await bancoEfemero();
  acesso = abrirAcessoAoBanco({
    cadeiaDeConexao: banco.cadeiaConexao,
    maximoDeConexoes: RESERVA_DE_UMA,
  });
  golden = JSON.parse(await readFile(CAMINHO_DO_GOLDEN, 'utf8')) as Golden;
}, LIMITE_SUBIDA_MS);

afterAll(async () => {
  await acesso?.encerrar();
  await banco?.parar();
}, LIMITE_SUBIDA_MS);

// ===========================================================================
// CT-1063 — encerra e libera no MESMO ato, contra o oráculo
// ===========================================================================

describe('CT-1063 — o contrato vencido encerra e o imóvel dele é liberado no mesmo ato', () => {
  it(
    'os 3 pares representáveis do golden terminam como o oráculo os deixa, e o retorno é {1,1,0}',
    async () => {
      // Âncoras do oráculo: um arquivo truncado, trocado ou reescrito reprova AQUI, e não adiante,
      // onde a comparação campo a campo passaria por vacuidade sobre um conjunto vazio.
      expect(golden.entrada.contratos).toHaveLength(CONTRATOS_DO_GOLDEN);
      expect(golden.entrada.imoveis).toHaveLength(IMOVEIS_DO_GOLDEN);
      expect(golden.retorno.total_candidatos).toBe(2);
      expect(golden.retorno.total_encerrados).toBe(1);
      expect(golden.retorno.total_ignorados).toBe(1);

      const contexto = await admitirEmpresaNova('ct1063');
      const representaveis = golden.entrada.contratos.filter((contrato) => contrato.imovel !== '');

      expect(representaveis).toHaveLength(CONTRATOS_DO_GOLDEN - 1);

      const pares = new Map<string, ParSemeado>();

      // Os JÁ ENCERRADOS vêm primeiro, e a ordem é conteúdo: o único produtor de `ENCERRADO` é a
      // própria rotina, e a passagem que os produz precisa correr ANTES de os candidatos vivos
      // existirem — senão ela os encerraria junto, e o caso mediria a segunda passagem.
      for (const contrato of representaveis) {
        if (ESTADO_POR_ROTULO_DO_LEGADO[contrato.status_contrato] !== ESTADO_ENCERRADO) {
          continue;
        }

        const par = await semearParVigente(
          contexto,
          contrato.name,
          contrato.data_fim_locacao_offset_dias,
          SITUACAO_LOCADO,
        );
        await encerrarPorPassagemDeArranjo(contexto, par);
        pares.set(contrato.name, par);
      }

      for (const contrato of representaveis) {
        if (ESTADO_POR_ROTULO_DO_LEGADO[contrato.status_contrato] === ESTADO_ENCERRADO) {
          continue;
        }

        pares.set(
          contrato.name,
          await semearParVigente(
            contexto,
            contrato.name,
            contrato.data_fim_locacao_offset_dias,
            SITUACAO_LOCADO,
          ),
        );
      }

      const resultado = await emUnidadeSobContexto(acesso, contexto, passagemDoEncerramento);

      // A comparação é CAMPO A CAMPO contra o oráculo traduzido, e nunca por instantâneo: a
      // transposição Frappe→produto novo não é literal, e um instantâneo esconderia a divergência
      // de RN-02 em vez de a exibir.
      for (const [nome, par] of pares) {
        const esperadoDoContrato = contratoResultanteDoGolden(nome);
        const esperadoDoImovel = imovelResultanteDoGolden(esperadoDoContrato.imovel);

        expect(await lerEstadoDoPar(contexto, par), nome).toEqual({
          status: exigirTraducao(ESTADO_POR_ROTULO_DO_LEGADO, esperadoDoContrato.status_contrato),
          situacaoDoImovel: exigirTraducao(
            SITUACAO_POR_ROTULO_DO_LEGADO,
            esperadoDoImovel.status_locacao,
          ),
        });
      }

      // A DIVERGÊNCIA frente ao oráculo é AFIRMADA, e não escondida (§21.2 do tech spec). O segundo
      // candidato do golden é `CTR-CARACT-ECV-02`, descartado por `contrato_sem_imovel`: ele não tem
      // instância possível no produto novo, porque `negocio.contrato.imovel_id` é `NOT NULL` desde a
      // migração `0007` — o que o CT-1066 mede. O EFEITO, esse, coincide: um contrato encerrado.
      const descartado = golden.retorno.resultados.find(
        (item) => item.name === CONTRATO_SEM_IMOVEL_DO_GOLDEN,
      );

      expect(descartado?.motivo).toBe(MOTIVO_DE_DESCARTE_DO_GOLDEN);
      expect(resultado.encerrados).toBe(golden.retorno.total_encerrados);
      expect(resultado.candidatos).not.toBe(golden.retorno.total_candidatos);
      expect(resultado).toEqual({ candidatos: 1, encerrados: 1, preservados: 0 });
    },
    LIMITE_DO_CASO_MS,
  );
});

// ===========================================================================
// CT-1064 — encerrar e liberar são UM ato: a segunda escrita recusada desfaz a primeira
// ===========================================================================
//
// A falha vem do BOUNDARY REAL, e não de bandeira, parâmetro opcional ou ramo `se estiverTestando`
// no código de produção (Iron Law #6): outra transação segura a linha do imóvel, e a unidade do
// encerramento declara até quando espera por ela. O `UPDATE` da porta estreita é então recusado pelo
// **servidor**, com `55P03`, depois de o contrato já ter sido gravado como `ENCERRADO`.
//
// A asserção que DISCRIMINA é a releitura em **conexão nova** depois do desfazimento: sem ela o caso
// ficaria verde mesmo que as duas escritas corressem em transações separadas — bastaria a segunda
// falhar. É ela que prova que a primeira foi desfeita junto.

describe('CT-1064 — a falha na liberação do imóvel desfaz o encerramento do contrato', () => {
  it(
    'a chamada rejeita com SQLSTATE do servidor, e nada das duas escritas sobrevive ao rollback',
    async () => {
      const contexto = await admitirEmpresaNova('ct1064');
      const par = await semearParVigente(contexto, 'ct1064', -5, SITUACAO_LOCADO);

      const travador = abrirAcessoAoBanco({
        cadeiaDeConexao: banco.cadeiaConexao,
        maximoDeConexoes: RESERVA_DE_UMA,
      });
      const conferente = abrirAcessoAoBanco({
        cadeiaDeConexao: banco.cadeiaConexao,
        maximoDeConexoes: RESERVA_DE_UMA,
      });

      const travou = portao<void>();
      const liberar = portao<void>();

      try {
        const trava = emUnidadeSobContexto(travador, contexto, async (tx) => {
          await tx`SELECT id FROM negocio.imovel WHERE id = ${par.imovelId} FOR UPDATE`;
          travou.abrir(undefined);
          await liberar.espera;
        });

        // A trava está TOMADA antes de a passagem começar: o desfecho não corre com nada, e o caso
        // não depende de ordem de escalonamento.
        await travou.espera;

        const tentativa = await tentar(
          async () =>
            await emUnidadeSobContexto(acesso, contexto, async (tx) => {
              await tx`SELECT set_config('lock_timeout', ${ESPERA_PELA_LINHA_DO_IMOVEL}, true)`;

              return await passagemDoEncerramento(tx);
            }),
        );

        // O `code` é do SERVIDOR, e não sintético do caso: `55P03` é a recusa de esperar pela linha
        // do imóvel além do limite declarado. Sem afirmar o código, "rejeitou" ficaria verde sobre
        // qualquer defeito do arranjo.
        expect(tentativa.ok).toBe(false);
        expect(sqlstate(erroDe(tentativa))).toBe(TRAVA_INDISPONIVEL);

        liberar.abrir(undefined);
        await trava;

        // Releitura por CONEXÃO NOVA, depois do desfazimento — a asserção que discrimina.
        expect(await lerEstadoDoPar(contexto, par, conferente)).toEqual({
          status: ESTADO_VIGENTE,
          situacaoDoImovel: SITUACAO_LOCADO,
        });
        expect(await contarContratosEncerrados(contexto, conferente)).toBe(0);
        expect(await lerOcorrenciasDaRotina(contexto, conferente)).toEqual([]);
      } finally {
        liberar.abrir(undefined);
        await travador.encerrar();
        await conferente.encerrar();
      }
    },
    LIMITE_DO_CASO_MS,
  );
});

// ===========================================================================
// CT-1065 — a tabela dos NÃO-candidatos, com o controle positivo dentro dela
// ===========================================================================
//
// O controle positivo na MESMA tabela é o que impede o AP-29: uma implementação que nunca encontrasse
// candidato — um predicado invertido, uma seleção que devolvesse sempre vazio — passaria nas quatro
// linhas negativas e reprovaria só na quinta.

interface LinhaDeNaoCandidato {
  readonly rotulo: string;
  readonly esperado: ResultadoDoEncerramento;
  readonly estadoEsperado: EstadoDoPar;
  montar(contexto: Contexto): Promise<ParSemeado>;
}

const TABELA_DE_CANDIDATURA: readonly LinhaDeNaoCandidato[] = [
  {
    rotulo: 'data de fim ainda no futuro (+20 dias)',
    esperado: { candidatos: 0, encerrados: 0, preservados: 0 },
    estadoEsperado: { status: ESTADO_VIGENTE, situacaoDoImovel: SITUACAO_LOCADO },
    montar: async (contexto) =>
      await semearParVigente(contexto, 'ct1065-futuro', 20, SITUACAO_LOCADO),
  },
  {
    rotulo: 'data de fim NULA — o contrato ainda em rascunho',
    esperado: { candidatos: 0, encerrados: 0, preservados: 0 },
    estadoEsperado: { status: ESTADO_RASCUNHO, situacaoDoImovel: SITUACAO_LOCADO },
    montar: async (contexto) => {
      const par = await semearParEmRascunho(contexto, 'ct1065-rascunho');

      await emUnidadeSobContexto(acesso, contexto, async (tx) => {
        await definirSituacaoDeLocacaoDoImovel(tx, par.imovelId, SITUACAO_LOCADO);
      });

      return par;
    },
  },
  {
    rotulo: 'contrato JÁ ENCERRADO, com data de fim vencida (-30 dias)',
    esperado: { candidatos: 0, encerrados: 0, preservados: 0 },
    estadoEsperado: { status: ESTADO_ENCERRADO, situacaoDoImovel: SITUACAO_LOCADO },
    montar: async (contexto) => {
      // O arranjo devolve o par com o contrato `ENCERRADO` e o imóvel de volta em `LOCADO` — é o
      // par que uma implementação sem o predicado de estado tocaria de novo, e é ele que esta
      // linha existe para vigiar. Ver o docblock de `encerrarPorPassagemDeArranjo`.
      const par = await semearParVigente(contexto, 'ct1065-encerrado', -30, SITUACAO_LOCADO);
      await encerrarPorPassagemDeArranjo(contexto, par);

      return par;
    },
  },
  {
    rotulo: 'contrato CANCELADO, com data de fim vencida (-30 dias)',
    esperado: { candidatos: 0, encerrados: 0, preservados: 0 },
    estadoEsperado: { status: ESTADO_CANCELADO, situacaoDoImovel: SITUACAO_LOCADO },
    montar: async (contexto) => {
      const par = await semearParVigente(contexto, 'ct1065-cancelado', -30, SITUACAO_LOCADO);

      await emUnidadeSobContexto(acesso, contexto, async (tx) => {
        await cancelarContrato(tx, par.contratoCodigo);
      });

      return par;
    },
  },
  {
    rotulo: 'CONTROLE POSITIVO — contrato ativo e vencido (-5 dias)',
    esperado: { candidatos: 1, encerrados: 1, preservados: 0 },
    estadoEsperado: { status: ESTADO_ENCERRADO, situacaoDoImovel: SITUACAO_DISPONIVEL },
    montar: async (contexto) =>
      await semearParVigente(contexto, 'ct1065-controle', -5, SITUACAO_LOCADO),
  },
];

describe('CT-1065 — nada fora do predicado é alcançado, e o controle positivo é alcançado', () => {
  it.each(TABELA_DE_CANDIDATURA)(
    'CT-1065 — $rotulo',
    async (linha) => {
      const contexto = await admitirEmpresaNova(linha.rotulo);
      const par = await linha.montar(contexto);
      const semeado = await lerEstadoDoPar(contexto, par);

      const resultado = await emUnidadeSobContexto(acesso, contexto, passagemDoEncerramento);

      expect(resultado).toEqual(linha.esperado);

      const depois = await lerEstadoDoPar(contexto, par);

      // Igualdade LITERAL contra o estado esperado — e, nas quatro linhas negativas, também contra o
      // estado SEMEADO. "Não mudou muito" não é asserção: as duas comparações juntas dizem que o par
      // está exatamente onde o arranjo o deixou, e que o arranjo o deixou onde a linha declara.
      expect(depois).toEqual(linha.estadoEsperado);

      if (linha.esperado.candidatos === 0) {
        expect(depois).toEqual(semeado);
      }
    },
    LIMITE_DO_CASO_MS,
  );
});

// ===========================================================================
// CT-1066 — contrato sem imóvel é IRREPRESENTÁVEL, e quem recusa é o banco
// ===========================================================================
//
// ⚠️ REDE ANTIRREGRESSÃO da §21.2. A CA-06 **não** é provada montando o cenário `CTR-…-02` do golden,
// que não tem instância possível: prova-se a **irrepresentabilidade**, para que a rodada seguinte não
// "corrija a lacuna" tornando `imovel_id` anulável. É o par com o marcador `DECISÃO FECHADA` do
// docblock de `encerrarContratosVencidos`.
//
// A instrução contorna a porta de aplicação de propósito, e o controle POSITIVO é o discriminador que
// `isolamento.spec.ts` documenta — *"tirar do caminho toda restrição que não seja a que se mede"*:
// os dois `INSERT` são idênticos exceto por `imovel_id`, e todos os demais `NOT NULL` e `CHECK` são
// respeitados. Sem o controle, a recusa ficaria verde também sobre um banco que recusasse **toda**
// escrita crua nesta tabela — por privilégio, por política ou por qualquer outra restrição.

describe('CT-1066 — `negocio.contrato` recusa `imovel_id` nulo pelo BANCO, e nada é gravado', () => {
  it(
    'o controle positivo grava 1 linha; o nulo rejeita com 23502 nomeando `imovel_id`',
    async () => {
      const contexto = await admitirEmpresaNova('ct1066');
      const par = await semearParEmRascunho(contexto, 'ct1066');
      const base = await lerContrato(contexto, par.contratoCodigo);

      const antes = await contarContratos(contexto);

      const gravadas = await emUnidadeSobContexto(
        acesso,
        contexto,
        async (tx) => await inserirContratoCru(tx, contexto, 'CTR-2001-99998', base, base.imovelId),
      );

      expect(gravadas).toBe(1);
      expect(await contarContratos(contexto)).toBe(antes + 1);

      const tentativa = await tentar(
        async () =>
          await emUnidadeSobContexto(
            acesso,
            contexto,
            async (tx) => await inserirContratoCru(tx, contexto, 'CTR-2001-99999', base, null),
          ),
      );

      // O SQLSTATE **e** a coluna: `23502` sozinho diria que alguma coluna obrigatória foi violada, e
      // `negocio.contrato` tem onze delas. A nomeada é o conteúdo do caso.
      expect(tentativa.ok).toBe(false);
      expect(sqlstate(erroDe(tentativa))).toBe(VIOLACAO_DE_NAO_NULO);
      expect(nomeDaColuna(erroDe(tentativa))).toBe('imovel_id');

      expect(await contarContratos(contexto)).toBe(antes + 1);
      expect(await contarContratosSemImovel(contexto)).toBe(0);
    },
    LIMITE_DO_CASO_MS,
  );
});

// ===========================================================================
// CT-1067 — idempotência por PREDICADO: a segunda passagem não produz efeito nem registro
// ===========================================================================
//
// A asserção sobre a CONTAGEM de registros é o que liga a CA-09 à CA-11: sem ela, uma implementação
// que gravasse registro em toda passagem passaria no teste de idempotência de estado e reintroduziria
// o crescimento de 12 MB por empresa do sistema antigo (RN-15).

describe('CT-1067 — a segunda passagem do mesmo dia não muda estado nem grava segundo registro', () => {
  it(
    'a primeira devolve {2,2,0} e grava uma linha; a segunda devolve zeros e não grava nada',
    async () => {
      const contexto = await admitirEmpresaNova('ct1067');
      const primeiroPar = await semearParVigente(contexto, 'ct1067-a', -5, SITUACAO_LOCADO);
      const segundoPar = await semearParVigente(contexto, 'ct1067-b', -9, SITUACAO_LOCADO);

      const daPrimeira = await emUnidadeSobContexto(acesso, contexto, passagemDoEncerramento);

      expect(daPrimeira).toEqual({ candidatos: 2, encerrados: 2, preservados: 0 });

      const capturado = [
        await lerEstadoDoPar(contexto, primeiroPar),
        await lerEstadoDoPar(contexto, segundoPar),
      ];
      const registrosDepoisDaPrimeira = await lerOcorrenciasDaRotina(contexto);

      expect(registrosDepoisDaPrimeira).toHaveLength(1);

      const daSegunda = await emUnidadeSobContexto(acesso, contexto, passagemDoEncerramento);

      expect(daSegunda).toEqual({ candidatos: 0, encerrados: 0, preservados: 0 });

      expect([
        await lerEstadoDoPar(contexto, primeiroPar),
        await lerEstadoDoPar(contexto, segundoPar),
      ]).toEqual(capturado);

      // A lista INTEIRA por igualdade, e não só a contagem: um segundo registro apareceria como
      // elemento a mais, e um `ocorrida_em` reescrito apareceria como valor diferente.
      expect(await lerOcorrenciasDaRotina(contexto)).toEqual(registrosDepoisDaPrimeira);
    },
    LIMITE_DO_CASO_MS,
  );
});

// ===========================================================================
// CT-1068 — duas passagens CONCORRENTES: `SKIP LOCKED` sem efeito duplicado e sem segundo registro
// ===========================================================================

describe('CT-1068 — duas passagens sobrepostas somam os candidatos exatamente uma vez', () => {
  it(
    'a sobreposição é AFIRMADA pelos dois pid; A encerra os 4, B encerra 0, e há uma só linha',
    async () => {
      const contexto = await admitirEmpresaNova('ct1068');
      const pares: ParSemeado[] = [];

      for (let posicao = 0; posicao < CANDIDATOS_EM_DISPUTA; posicao += 1) {
        pares.push(
          await semearParVigente(
            contexto,
            `ct1068-${String(posicao)}`,
            -5 - posicao,
            SITUACAO_LOCADO,
          ),
        );
      }

      const primeiro = abrirAcessoAoBanco({
        cadeiaDeConexao: banco.cadeiaConexao,
        maximoDeConexoes: RESERVA_DE_UMA,
      });
      const segundo = abrirAcessoAoBanco({
        cadeiaDeConexao: banco.cadeiaConexao,
        maximoDeConexoes: RESERVA_DE_UMA,
      });

      const rodouA = portao<number>();
      const liberarA = portao<void>();
      const rodouB = portao<number>();
      const liberarB = portao<void>();

      try {
        const passagemA = emUnidadeSobContexto(primeiro, contexto, async (tx) => {
          const pid = await lerPidDaSessao(tx);
          const resultado = await passagemDoEncerramento(tx);
          rodouA.abrir(pid);
          await liberarA.espera;

          return resultado;
        });

        const pidDeA = await rodouA.espera;

        // A segunda passagem corre com a primeira AINDA ABERTA e com as 4 linhas travadas por ela.
        // É esta ordem que discrimina o `SKIP LOCKED` de um teste sequencial disfarçado.
        const passagemB = emUnidadeSobContexto(segundo, contexto, async (tx) => {
          const pid = await lerPidDaSessao(tx);
          const resultado = await passagemDoEncerramento(tx);
          rodouB.abrir(pid);
          await liberarB.espera;

          return resultado;
        });

        const pidDeB = await rodouB.espera;

        // SOBREPOSIÇÃO AFIRMADA, e antes de qualquer contagem: as DUAS sessões têm transação em
        // curso no mesmo instante, por igualdade de conjunto contra os dois `pid` capturados dentro
        // das próprias unidades. Sondagem por estado observável, com limite nomeado — nunca espera
        // fixa. `SKIP LOCKED` não bloqueia ninguém, então "sessão esperando por trava" seria a
        // sondagem errada aqui (ver o cabeçalho).
        expect(await esperarTransacoesAbertas([pidDeA, pidDeB])).toEqual(
          [pidDeA, pidDeB].sort(porOrdemNumerica),
        );

        liberarA.abrir(undefined);
        liberarB.abrir(undefined);

        const [deA, deB] = await Promise.all([passagemA, passagemB]);

        expect(deA).toEqual({
          candidatos: CANDIDATOS_EM_DISPUTA,
          encerrados: CANDIDATOS_EM_DISPUTA,
          preservados: 0,
        });
        expect(deB).toEqual({ candidatos: 0, encerrados: 0, preservados: 0 });
        expect(deA.encerrados + deB.encerrados).toBe(CANDIDATOS_EM_DISPUTA);

        // Nenhum contrato encerrado duas vezes: os 4 estão `ENCERRADO` e os 4 imóveis `DISPONIVEL`,
        // e a soma acima já é igual à contagem de distintos — dupla contagem faria as duas
        // afirmações serem incompatíveis.
        for (const par of pares) {
          expect(await lerEstadoDoPar(contexto, par), par.contratoCodigo).toEqual({
            status: ESTADO_ENCERRADO,
            situacaoDoImovel: SITUACAO_DISPONIVEL,
          });
        }

        expect(await lerOcorrenciasDaRotina(contexto)).toHaveLength(1);
      } finally {
        liberarA.abrir(undefined);
        liberarB.abrir(undefined);
        await primeiro.encerrar();
        await segundo.encerrar();
      }
    },
    LIMITE_DO_CASO_MS,
  );
});

// ===========================================================================
// CT-1069 — a ordem contrato→imóvel não abre janela de `DISPONIVEL` com contrato vigente
// ===========================================================================
//
// ⚠️ Este caso mede o AGRAVAMENTO declarado do `D44 · F2/T10`: esta fatia cria o **terceiro** escritor
// do par contrato-vigente / situação-do-imóvel, e o débito **não fecha aqui** — o gatilho literal dele
// é *"a fatia que criar no banco a restrição pareando `contrato.status='ATIVO'` com
// `imovel.status_locacao`"*, e criá-la não é requisito de nada que o PRD peça. Enquanto ela não
// existir, este caso é a rede possível: ele afirma a ausência do par inconsistente nos **dois**
// desfechos da disputa, e não em um deles.

const DESFAZIMENTO_DELIBERADO = 'desfazimento deliberado do encerramento — CT-1069 (b)';

describe('CT-1069 — encerramento e ativação disputando o mesmo imóvel, nos dois desfechos', () => {
  it(
    'CT-1069 — o encerramento COMITA: a ativação concorrente sucede e o imóvel fica LOCADO',
    async () => {
      const contexto = await admitirEmpresaNova('ct1069a');
      const vencido = await semearParVigente(contexto, 'ct1069a', -5, SITUACAO_LOCADO);
      const novo = await montarContratoNoMesmoImovel(contexto, vencido);
      const parDoNovo: ParSemeado = { contratoCodigo: novo.codigo, imovelId: vencido.imovelId };

      const primeiro = abrirAcessoAoBanco({
        cadeiaDeConexao: banco.cadeiaConexao,
        maximoDeConexoes: RESERVA_DE_UMA,
      });
      const segundo = abrirAcessoAoBanco({
        cadeiaDeConexao: banco.cadeiaConexao,
        maximoDeConexoes: RESERVA_DE_UMA,
      });

      const encerrou = portao<void>();
      const liberar = portao<void>();

      try {
        const encerramento = emUnidadeSobContexto(primeiro, contexto, async (tx) => {
          const resultado = await passagemDoEncerramento(tx);
          encerrou.abrir(undefined);
          await liberar.espera;

          return resultado;
        });

        await encerrou.espera;

        const ativacao = tentar(
          async () =>
            await emUnidadeSobContexto(segundo, contexto, async (tx) => {
              const ativado = await ativarContrato(tx, novo.codigo, {
                // A data de fim vai adiante de propósito: o disputante não pode ser candidato de
                // passagem nenhuma, senão o caso mediria dois encerramentos em vez da disputa. O
                // valor total sai do PONTO ÚNICO da RD-10, e não de um número escrito aqui.
                dataFimLocacao: await dataDeslocada(tx, DIAS_ATE_O_FIM_DO_DISPUTANTE),
                valorTotalContrato: derivarValorTotal(novo.valorMensal, novo.prazoMeses),
              });
              await definirSituacaoDeLocacaoDoImovel(tx, vencido.imovelId, SITUACAO_LOCADO);

              return ativado;
            }),
        );

        // A ativação está BLOQUEADA no índice de vigência enquanto o encerramento não commita — é o
        // molde do `CT-407`, e é a sobreposição que faz o caso medir a disputa em vez de dois atos
        // sequenciais.
        await esperarSessaoBloqueada();

        liberar.abrir(undefined);

        const [doEncerramento, daAtivacao] = await Promise.all([encerramento, ativacao]);

        expect(doEncerramento).toEqual({ candidatos: 1, encerrados: 1, preservados: 0 });
        expect(daAtivacao.ok).toBe(true);

        // O desfecho SUCEDIDO: o imóvel voltou a `LOCADO`, com exatamente um contrato vigente.
        expect(await lerEstadoDoPar(contexto, parDoNovo)).toEqual({
          status: ESTADO_VIGENTE,
          situacaoDoImovel: SITUACAO_LOCADO,
        });
        expect(await contarVigentesDoImovel(contexto, vencido.imovelId)).toBe(1);
        expect((await lerEstadoDoPar(contexto, vencido)).status).toBe(ESTADO_ENCERRADO);

        // O invariante, em todos os desfechos: nenhum imóvel `DISPONIVEL` com contrato vigente.
        expect(await lerParesInconsistentes(contexto)).toEqual([]);
      } finally {
        liberar.abrir(undefined);
        await primeiro.encerrar();
        await segundo.encerrar();
      }
    },
    LIMITE_DO_CASO_MS,
  );

  it(
    'CT-1069 (b) — o encerramento DESFAZ: a ativação concorrente é recusada pelo índice de vigência',
    async () => {
      const contexto = await admitirEmpresaNova('ct1069b');
      const vencido = await semearParVigente(contexto, 'ct1069b', -5, SITUACAO_LOCADO);
      const novo = await montarContratoNoMesmoImovel(contexto, vencido);
      const parDoNovo: ParSemeado = { contratoCodigo: novo.codigo, imovelId: vencido.imovelId };

      const primeiro = abrirAcessoAoBanco({
        cadeiaDeConexao: banco.cadeiaConexao,
        maximoDeConexoes: RESERVA_DE_UMA,
      });
      const segundo = abrirAcessoAoBanco({
        cadeiaDeConexao: banco.cadeiaConexao,
        maximoDeConexoes: RESERVA_DE_UMA,
      });

      const encerrou = portao<void>();
      const liberar = portao<void>();

      try {
        const encerramento = tentar(
          async () =>
            await emUnidadeSobContexto(primeiro, contexto, async (tx) => {
              await passagemDoEncerramento(tx);
              encerrou.abrir(undefined);
              await liberar.espera;

              throw new Error(DESFAZIMENTO_DELIBERADO);
            }),
        );

        await encerrou.espera;

        // A ativação CRUA, e não pela porta: o que este desfecho afirma é o **mecanismo** — o índice
        // único parcial —, e a porta traduziria a recusa em erro de domínio, escondendo o `SQLSTATE`
        // e o nome de quem recusou. É o mesmo recurso do Passo 6 do `CT-407`.
        const ativacaoCrua = tentar(
          async () =>
            await emUnidadeSobContexto(segundo, contexto, async (tx) => {
              await tx`UPDATE negocio.contrato SET status = 'ATIVO' WHERE codigo = ${novo.codigo}`;
            }),
        );

        await esperarSessaoBloqueada();

        liberar.abrir(undefined);

        const [doEncerramento, daAtivacao] = await Promise.all([encerramento, ativacaoCrua]);

        // O desfazimento aconteceu pela razão DECLARADA, e não por acidente do arranjo.
        expect(doEncerramento.ok).toBe(false);
        expect(mensagemDe(doEncerramento)).toBe(DESFAZIMENTO_DELIBERADO);

        expect(daAtivacao.ok).toBe(false);
        expect(sqlstate(erroDe(daAtivacao))).toBe(VIOLACAO_DE_UNICIDADE);
        expect(nomeDaRestricao(erroDe(daAtivacao))).toBe(INDICE_DA_VIGENCIA);

        // O encerramento foi desfeito inteiro, e o contrato novo segue rascunho.
        expect(await lerEstadoDoPar(contexto, vencido)).toEqual({
          status: ESTADO_VIGENTE,
          situacaoDoImovel: SITUACAO_LOCADO,
        });
        expect((await lerEstadoDoPar(contexto, parDoNovo)).status).toBe(ESTADO_RASCUNHO);
        expect(await contarVigentesDoImovel(contexto, vencido.imovelId)).toBe(1);

        // O MESMO invariante do desfecho anterior — é a igualdade nos dois que o caso afirma.
        expect(await lerParesInconsistentes(contexto)).toEqual([]);
      } finally {
        liberar.abrir(undefined);
        await primeiro.encerrar();
        await segundo.encerrar();
      }
    },
    LIMITE_DO_CASO_MS,
  );
});

// ===========================================================================
// CT-1097 — o imóvel INDISPONIVEL tem o contrato encerrado e a situação PRESERVADA (RD-20)
// ===========================================================================
//
// A asserção que DISCRIMINA é a igualdade **literal** com `'INDISPONIVEL'`: uma implementação com
// `SET status_locacao = 'DISPONIVEL'` incondicional passa em todos os outros casos desta suíte e
// falha só neste. A segunda — o resumo com `preservados: 1` — é o que impede a implementação certa
// de ficar muda sobre o que fez.

describe('CT-1097 — a liberação é condicional: `INDISPONIVEL` sobrevive ao encerramento', () => {
  it(
    'os 3 contratos encerram, os 2 imóveis LOCADO viram DISPONIVEL e o INDISPONIVEL permanece',
    async () => {
      const contexto = await admitirEmpresaNova('ct1097');
      const deA = await semearParVigente(contexto, 'ct1097-a', -5, SITUACAO_LOCADO);
      const deB = await semearParVigente(contexto, 'ct1097-b', -7, SITUACAO_INDISPONIVEL);
      const deC = await semearParVigente(contexto, 'ct1097-c', -9, SITUACAO_LOCADO);

      const antes = [
        await lerEstadoDoPar(contexto, deA),
        await lerEstadoDoPar(contexto, deB),
        await lerEstadoDoPar(contexto, deC),
      ];

      // O arranjo é o que o caso afirma medir: o imóvel de B chegou `INDISPONIVEL` com o contrato
      // dele `ATIVO`. Sem esta âncora, a preservação seria verdade vazia sobre um imóvel que nunca
      // esteve indisponível.
      expect(antes).toEqual([
        { status: ESTADO_VIGENTE, situacaoDoImovel: SITUACAO_LOCADO },
        { status: ESTADO_VIGENTE, situacaoDoImovel: SITUACAO_INDISPONIVEL },
        { status: ESTADO_VIGENTE, situacaoDoImovel: SITUACAO_LOCADO },
      ]);

      const resultado = await emUnidadeSobContexto(acesso, contexto, passagemDoEncerramento);

      expect(resultado).toEqual({ candidatos: 3, encerrados: 3, preservados: 1 });

      const depois = [
        await lerEstadoDoPar(contexto, deA),
        await lerEstadoDoPar(contexto, deB),
        await lerEstadoDoPar(contexto, deC),
      ];

      expect(depois).toEqual([
        { status: ESTADO_ENCERRADO, situacaoDoImovel: SITUACAO_DISPONIVEL },
        { status: ESTADO_ENCERRADO, situacaoDoImovel: SITUACAO_INDISPONIVEL },
        { status: ESTADO_ENCERRADO, situacaoDoImovel: SITUACAO_DISPONIVEL },
      ]);

      // A igualdade literal, isolada, sobre o par que a implementação óbvia converteria por engano.
      expect(depois[1]?.situacaoDoImovel).toBe('INDISPONIVEL');

      // E a conversão indevida contada por comparação dos dois retratos: nenhum imóvel passou de
      // `INDISPONIVEL` a `DISPONIVEL` nesta passagem.
      const convertidos = antes
        .map((estado, posicao) => ({ estado, depois: depois[posicao] }))
        .filter(
          (par) =>
            par.estado.situacaoDoImovel === SITUACAO_INDISPONIVEL &&
            par.depois?.situacaoDoImovel === SITUACAO_DISPONIVEL,
        );

      expect(convertidos).toEqual([]);
    },
    LIMITE_DO_CASO_MS,
  );
});

// ---------------------------------------------------------------------------
// A passagem, como o consumidor da rotina a fará
// ---------------------------------------------------------------------------

/**
 * Uma passagem completa da rotina: o trabalho, e o registro **sob o predicado de efeito**.
 *
 * O predicado é `candidatos > 0`, declarado por rotina na RN-15/RD-15, e ele mora em quem chama —
 * `registrarExecucaoDeRotina` grava o que lhe entregam, e o docblock dela registra por que trazer a
 * decisão para dentro do módulo reabriria o registro de passagem vazia. Esta função é, portanto, o
 * **caminho legítimo** que os casos exercitam: a composição das duas portas publicadas, na mesma
 * unidade de trabalho, exatamente como o consumidor único das rotinas a fará.
 *
 * `resumo: resultado` sem redigitar chave alguma é o que o tipo-alias de `ResultadoDoEncerramento`
 * torna possível — ver o docblock dele. Uma segunda grafia das três contagens aqui seria o segundo
 * vocabulário para o mesmo fato que a RN-19 proíbe.
 */
async function passagemDoEncerramento(tx: TransactionSql): Promise<ResultadoDoEncerramento> {
  const resultado = await encerrarContratosVencidos(tx);

  if (resultado.candidatos > 0) {
    await registrarExecucaoDeRotina(tx, { rotina: ROTINA_DO_ENCERRAMENTO, resumo: resultado });
  }

  return resultado;
}

// ---------------------------------------------------------------------------
// O arranjo — sempre pelas portas de produção
// ---------------------------------------------------------------------------

/**
 * Admite uma empresa nova e devolve o contexto dela.
 *
 * `identidade.empresa` não tem política (ADR-0009), de modo que a admissão corre sob qualquer
 * contexto válido, e ela é a porta pública do pacote — a mesma que o Master usa. Mesmo molde de
 * `execucao-de-rotina.spec.ts` e de `politica-de-aviso.spec.ts`.
 */
async function admitirEmpresaNova(marca: string): Promise<Contexto> {
  empresasAdmitidas += 1;
  const documento = `77${String(empresasAdmitidas).padStart(12, '0')}`;

  const criada = await emUnidadeSobContexto(
    acesso,
    CONTEXTO_DA_SEMENTE,
    async (tx) => await admitirEmpresa(tx, { nome: `Imobiliária ${marca}`, documento }),
  );

  if (criada === undefined) {
    throw new Error(`o arranjo não conseguiu admitir a empresa ${marca}`);
  }

  return { empresaId: criada.id };
}

/** A cadeia `conjunto → imóvel → pessoas → contrato`, pela casa compartilhada, sem ativar. */
async function semearParEmRascunho(contexto: Contexto, marca: string): Promise<ParSemeado> {
  const semeada = await semearCobrancaDoZero(acesso, contexto, marca);
  const contrato = await lerContrato(contexto, semeada.contratoCodigo);

  return { contratoCodigo: contrato.codigo, imovelId: contrato.imovelId };
}

/**
 * Semeia o par e o deixa **vigente**, com a data de fim deslocada em `offsetDias`.
 *
 * A data sai de `negocio.data_corrente_da_operacao()` deslocada **no SQL** (ADR-0026): compô-la no
 * processo faria o arranjo medir a diferença entre dois relógios, que é exatamente o defeito que o
 * CT-1061 varre no fonte.
 *
 * A ordem das duas escritas reproduz a composição de `ContratoService.ativar`, com a assimetria que
 * o cabeçalho deste arquivo explica: quando a situação pedida **não** é `LOCADO`, ela é escrita
 * **antes** da ativação (que é quando a guarda daquele serviço a admitiria) e não é sobrescrita
 * depois — é o arranjo do CT-1097.
 */
async function semearParVigente(
  contexto: Contexto,
  marca: string,
  offsetDias: number,
  situacaoDoImovel: SituacaoDeLocacao,
): Promise<ParSemeado> {
  const par = await semearParEmRascunho(contexto, marca);
  const contrato = await lerContrato(contexto, par.contratoCodigo);

  await emUnidadeSobContexto(acesso, contexto, async (tx) => {
    if (situacaoDoImovel !== SITUACAO_LOCADO) {
      await definirSituacaoDeLocacaoDoImovel(tx, par.imovelId, situacaoDoImovel);
    }

    await ativarContrato(tx, par.contratoCodigo, {
      dataFimLocacao: await dataDeslocada(tx, offsetDias),
      valorTotalContrato: derivarValorTotal(contrato.valorMensal, contrato.prazoMeses),
    });

    if (situacaoDoImovel === SITUACAO_LOCADO) {
      await definirSituacaoDeLocacaoDoImovel(tx, par.imovelId, SITUACAO_LOCADO);
    }
  });

  return par;
}

/**
 * Leva o par a `ENCERRADO` **com o imóvel de volta em `LOCADO`** — o não-candidato do CA-08.
 *
 * O estado vem do **único produtor dele**: uma passagem da própria rotina. Não há atalho legítimo —
 * `contrato.ts` não escreve `ENCERRADO` (o docblock de lá registra que o estado *"não tem produtor
 * nesta fatia"*), e um `UPDATE` cru montaria o arranjo por um caminho que a operação não tem. Como a
 * rotina alcança **todo** candidato da empresa, quem a usa como arranjo a roda **antes** de os
 * candidatos vivos do caso existirem.
 *
 * A situação do imóvel é reposta em `LOCADO` porque é assim que o oráculo deixa `CTR-CARACT-ECV-04`
 * (`estado_resultante`) e é assim que a linha do já-encerrado do CT-1065 o pede. E a escolha é
 * conteúdo, não fidelidade decorativa: **é o par que uma implementação sem o predicado de estado
 * tocaria de novo**, liberando um imóvel cujo contrato já não é candidato. Com o imóvel em
 * `DISPONIVEL` a segunda passagem seria indistinguível da correta.
 *
 * A precondição é conferida aqui, e não no caso: um arranjo que não produzisse o estado deixaria o
 * caso reprovando longe da causa.
 */
async function encerrarPorPassagemDeArranjo(contexto: Contexto, par: ParSemeado): Promise<void> {
  await emUnidadeSobContexto(acesso, contexto, encerrarContratosVencidos);

  const estado = await lerEstadoDoPar(contexto, par);

  if (estado.status !== ESTADO_ENCERRADO) {
    throw new Error(
      `o arranjo não conseguiu encerrar ${par.contratoCodigo}: ele está ${estado.status}`,
    );
  }

  await emUnidadeSobContexto(acesso, contexto, async (tx) => {
    await definirSituacaoDeLocacaoDoImovel(tx, par.imovelId, SITUACAO_LOCADO);
  });
}

/**
 * Monta um SEGUNDO contrato, em rascunho, sobre o **mesmo imóvel** do par — o disputante do CT-1069.
 *
 * Ele nasce pelo protocolo das duas unidades sequenciais da série (ADR-0020/0033), como o
 * `cenario-de-cobranca.ts` já faz, e copia os termos do primeiro contrato lendo-os pela porta: nada
 * aqui é redigitado, de modo que uma mudança nos termos do arranjo compartilhado não deixa este
 * disputante para trás.
 */
async function montarContratoNoMesmoImovel(
  contexto: Contexto,
  par: ParSemeado,
): Promise<ContratoPersistido> {
  const base = await lerContrato(contexto, par.contratoCodigo);
  const ano = await emUnidadeSobContexto(acesso, contexto, lerAnoDaSerieDeContrato);

  await emUnidadeSobContexto(acesso, contexto, async (tx) => {
    await garantirContadorDeContrato(tx, ano);
  });

  return await emUnidadeSobContexto(acesso, contexto, async (tx) => {
    const numero = await emitirNumeroDeContrato(tx, ano);

    return await criarContrato(
      tx,
      {
        imovelId: base.imovelId,
        locadorId: base.locadorId,
        locatarioId: base.locatarioId,
        fiadoresIds: [],
        dataInicioLocacao: base.dataInicioLocacao,
        prazoMeses: base.prazoMeses,
        valorMensal: base.valorMensal,
        diaVencimento: base.diaVencimento,
        gerarCobrancasAutomaticamente: base.gerarCobrancasAutomaticamente,
      },
      { ano, numero },
    );
  });
}

/**
 * O `INSERT` CRU do CT-1066 — os dois do caso, diferentes **só** por `imovel_id`.
 *
 * Todas as demais colunas obrigatórias recebem valores legítimos, lidos do contrato semeado, e os
 * `CHECK` da tabela são respeitados: a única coisa errada na segunda chamada é o imóvel ausente. Sem
 * esse cuidado o caso ficaria verde por qualquer outra recusa e deixaria de discriminar a coluna que
 * ele nomeia.
 */
async function inserirContratoCru(
  tx: TransactionSql,
  contexto: Contexto,
  codigo: string,
  base: ContratoPersistido,
  imovelId: string | null,
): Promise<number> {
  const resultado = await tx`
    INSERT INTO negocio.contrato
                (empresa_id, codigo, imovel_id, locador_id, locatario_id, status,
                 data_inicio_locacao, prazo_meses, valor_mensal, dia_vencimento,
                 gerar_cobrancas_automaticamente)
    VALUES (${contexto.empresaId}, ${codigo}, ${imovelId},
            ${base.locadorId}, ${base.locatarioId},
            ${ESTADO_RASCUNHO}::negocio.status_contrato,
            ${base.dataInicioLocacao}::date, ${base.prazoMeses}, ${String(base.valorMensal)},
            ${base.diaVencimento}, ${base.gerarCobrancasAutomaticamente})
  `;

  return resultado.count;
}

// ---------------------------------------------------------------------------
// As leituras de conferência — cruas, e sem `WHERE empresa_id` (ADR-0008)
// ---------------------------------------------------------------------------

/**
 * O estado do par, lido **cruamente** das duas tabelas.
 *
 * Não há `WHERE empresa_id` aqui, e não pode haver: quem recorta é a política, e escrever o filtro no
 * caso provaria a aplicação em vez do banco. O `dono` é parâmetro para que o CT-1064 possa reler por
 * uma **conexão nova**, depois do desfazimento — que é a asserção que discrimina lá.
 */
async function lerEstadoDoPar(
  contexto: Contexto,
  par: ParSemeado,
  dono: AcessoAoBanco = acesso,
): Promise<EstadoDoPar> {
  return await emUnidadeSobContexto(dono, contexto, async (tx) => {
    const [linha] = await tx<EstadoDoPar[]>`
      SELECT contrato.status,
             imovel.status_locacao AS "situacaoDoImovel"
        FROM negocio.contrato AS contrato
        JOIN negocio.imovel AS imovel ON imovel.id = contrato.imovel_id
       WHERE contrato.codigo = ${par.contratoCodigo}
    `;

    if (linha === undefined) {
      throw new Error(`o contrato ${par.contratoCodigo} não é alcançável pelo contexto do caso`);
    }

    return linha;
  });
}

/** Quantos contratos a empresa do contexto alcança — a contagem crua do CT-1066. */
async function contarContratos(contexto: Contexto): Promise<number> {
  return await emUnidadeSobContexto(acesso, contexto, async (tx) => {
    const [linha] = await tx<{ total: number }[]>`
      SELECT count(*)::integer AS total FROM negocio.contrato
    `;

    return linha?.total ?? -1;
  });
}

/** Quantos contratos sem imóvel existem — o `0` que a irrepresentabilidade fixa. */
async function contarContratosSemImovel(contexto: Contexto): Promise<number> {
  return await emUnidadeSobContexto(acesso, contexto, async (tx) => {
    const [linha] = await tx<{ total: number }[]>`
      SELECT count(*)::integer AS total FROM negocio.contrato WHERE imovel_id IS NULL
    `;

    return linha?.total ?? -1;
  });
}

/** Quantos contratos `ENCERRADO` a empresa alcança — o `0` do desfazimento do CT-1064. */
async function contarContratosEncerrados(
  contexto: Contexto,
  dono: AcessoAoBanco = acesso,
): Promise<number> {
  return await emUnidadeSobContexto(dono, contexto, async (tx) => {
    const [linha] = await tx<{ total: number }[]>`
      SELECT count(*)::integer AS total
        FROM negocio.contrato
       WHERE status = ${ESTADO_ENCERRADO}
    `;

    return linha?.total ?? -1;
  });
}

/** Quantos contratos vigentes o imóvel tem — a contagem que o índice parcial limita a um. */
async function contarVigentesDoImovel(contexto: Contexto, imovelId: string): Promise<number> {
  return await emUnidadeSobContexto(acesso, contexto, async (tx) => {
    const [linha] = await tx<{ total: number }[]>`
      SELECT count(*)::integer AS total
        FROM negocio.contrato
       WHERE imovel_id = ${imovelId}
         AND status = ${ESTADO_VIGENTE}
    `;

    return linha?.total ?? -1;
  });
}

/**
 * Os pares INCONSISTENTES: imóvel `DISPONIVEL` com contrato vigente apontando para ele.
 *
 * É o invariante que o `CT-434` declara irrepresentável e que nada no banco ainda impõe
 * (`D44 · F2/T10`). A consulta devolve os códigos, e não uma contagem, para que o vermelho **nomeie**
 * o par que quebrou em vez de dizer só quantos são.
 */
async function lerParesInconsistentes(contexto: Contexto): Promise<string[]> {
  return await emUnidadeSobContexto(acesso, contexto, async (tx) => {
    const linhas = await tx<{ codigo: string }[]>`
      SELECT contrato.codigo
        FROM negocio.contrato AS contrato
        JOIN negocio.imovel AS imovel ON imovel.id = contrato.imovel_id
       WHERE contrato.status = ${ESTADO_VIGENTE}
         AND imovel.status_locacao = ${SITUACAO_DISPONIVEL}
       ORDER BY contrato.codigo
    `;

    return linhas.map((linha) => linha.codigo);
  });
}

/**
 * Os instantes das passagens registradas para a rotina, em ordem — a lista, e não a contagem.
 *
 * A lista inteira por igualdade é o que faz um segundo registro aparecer como elemento a mais **e**
 * um `ocorrida_em` reescrito aparecer como valor diferente. O instante atravessa por `to_char` do
 * servidor, e não como `Date` reserializado pelo processo.
 */
async function lerOcorrenciasDaRotina(
  contexto: Contexto,
  dono: AcessoAoBanco = acesso,
): Promise<string[]> {
  return await emUnidadeSobContexto(dono, contexto, async (tx) => {
    const linhas = await tx<{ ocorridaEm: string }[]>`
      SELECT to_char(ocorrida_em AT TIME ZONE 'UTC', ${FORMATO_ISO_DO_INSTANTE}) AS "ocorridaEm"
        FROM negocio.execucao_de_rotina
       WHERE rotina = ${ROTINA_DO_ENCERRAMENTO}::negocio.rotina_agendada
       ORDER BY ocorrida_em
    `;

    return linhas.map((linha) => linha.ocorridaEm);
  });
}

/** O contrato pela porta pública, com a ausência tratada por erro nomeado. */
async function lerContrato(contexto: Contexto, codigo: string): Promise<ContratoPersistido> {
  const contrato = await emUnidadeSobContexto(
    acesso,
    contexto,
    async (tx) => await localizarContrato(tx, codigo),
  );

  if (contrato === undefined) {
    throw new Error(`o contrato ${codigo} não é alcançável pelo contexto do arranjo`);
  }

  return contrato;
}

/**
 * A data corrente da operação deslocada em `dias`, como cadeia `YYYY-MM-DD`.
 *
 * A leitura sai do mesmo `negocio.data_corrente_da_operacao()` que o predicado da rotina consulta, de
 * modo que o arranjo e a decisão partem do **mesmo eixo** (ADR-0026). Um `new Date()` aqui faria o
 * caso medir a diferença entre dois relógios — e ele passaria em 21 das 24 horas do dia.
 */
async function dataDeslocada(tx: TransactionSql, dias: number): Promise<string> {
  const [linha] = await tx<{ data: string }[]>`
    SELECT to_char(
             negocio.data_corrente_da_operacao() + make_interval(days => ${dias}::integer),
             ${FORMATO_ISO_DA_DATA}
           ) AS data
  `;

  if (linha === undefined) {
    throw new Error('o relógio do banco não devolveu a data corrente da operação');
  }

  return linha.data;
}

// ---------------------------------------------------------------------------
// A sondagem da concorrência — estado observável, com limite declarado
// ---------------------------------------------------------------------------

/** O identificador da sessão desta unidade, como o servidor o publica em `pg_stat_activity`. */
async function lerPidDaSessao(tx: TransactionSql): Promise<number> {
  const [linha] = await tx<{ pid: number }[]>`SELECT pg_backend_pid()::integer AS pid`;

  if (linha === undefined) {
    throw new Error('o servidor não devolveu o identificador da sessão');
  }

  return linha.pid;
}

/**
 * Sonda até **todas** as sessões informadas terem transação em curso, e devolve as observadas.
 *
 * É a prova de sobreposição do CT-1068, e ela não pode ser a do `CT-407`: `SKIP LOCKED` existe para
 * que a segunda passagem **não** espere, de modo que nenhuma sessão fica bloqueada e a sondagem por
 * `wait_event_type = 'Lock'` expiraria sempre. O que se observa aqui é `xact_start`, que o servidor
 * preenche enquanto a transação está aberta.
 *
 * Espera por estado observável, com limite declarado — nunca espera fixa por tempo, que deixaria o
 * caso passar por acaso nas máquinas rápidas e reprovar nas demais.
 */
async function esperarTransacoesAbertas(pids: readonly number[]): Promise<number[]> {
  const limite = Date.now() + LIMITE_DA_SONDAGEM_MS;

  while (Date.now() < limite) {
    const abertas = await emUnidadeSobContexto(acesso, CONTEXTO_DA_SEMENTE, async (tx) => {
      const linhas = await tx<{ pid: number }[]>`
        SELECT pid
          FROM pg_stat_activity
         WHERE datname = current_database()
           AND xact_start IS NOT NULL
           AND pid = ANY(${[...pids]}::integer[])
         ORDER BY pid
      `;

      return linhas.map((linha) => linha.pid);
    });

    if (abertas.length === pids.length) {
      return abertas;
    }

    await esperarUmIntervalo();
  }

  throw new Error(
    'as duas passagens não estiveram abertas ao mesmo tempo dentro do limite — sem a sobreposição, ' +
      'o caso não distingue `SKIP LOCKED` de duas passagens sequenciais',
  );
}

/**
 * Sonda até existir sessão **esperando por bloqueio** neste banco, com limite declarado.
 *
 * É o molde do `CT-407`, e aqui ele é o correto: a ativação concorrente do CT-1069 de fato bloqueia,
 * no índice único parcial de vigência, enquanto o encerramento não decide. A visão é a das sessões do
 * próprio papel `sysloc_app` — nenhuma conexão privilegiada participa.
 */
async function esperarSessaoBloqueada(): Promise<void> {
  const limite = Date.now() + LIMITE_DA_SONDAGEM_MS;

  while (Date.now() < limite) {
    const bloqueadas = await emUnidadeSobContexto(acesso, CONTEXTO_DA_SEMENTE, async (tx) => {
      const [linha] = await tx<{ total: number }[]>`
        SELECT count(*)::integer AS total
          FROM pg_stat_activity
         WHERE datname = current_database()
           AND wait_event_type = 'Lock'
      `;

      return linha?.total ?? 0;
    });

    if (bloqueadas > 0) {
      return;
    }

    await esperarUmIntervalo();
  }

  throw new Error(
    'a ativação concorrente não chegou a esperar pelo índice de vigência dentro do limite — sem a ' +
      'sobreposição, o caso não distingue a disputa de dois atos sequenciais',
  );
}

/** O intervalo entre sondagens — nunca a espera pelo desfecho, sempre a pausa entre duas leituras. */
async function esperarUmIntervalo(): Promise<void> {
  await new Promise((resolver) => setTimeout(resolver, INTERVALO_DA_SONDAGEM_MS));
}

// ---------------------------------------------------------------------------
// Acessórios de composição e de leitura de erro
// ---------------------------------------------------------------------------

/** Um ponto de encontro entre transações — o que mantém duas unidades abertas ao mesmo tempo. */
interface Portao<T> {
  readonly espera: Promise<T>;
  /** Idempotente: chamar duas vezes não muda o valor nem levanta. */
  abrir(valor: T): void;
}

function portao<T>(): Portao<T> {
  let abrir: (valor: T) => void = () => undefined;
  const espera = new Promise<T>((resolver) => {
    abrir = resolver;
  });

  return { espera, abrir: (valor: T) => abrir(valor) };
}

type Resultado<T> =
  | { readonly ok: true; readonly valor: T }
  | { readonly ok: false; readonly erro: unknown };

async function tentar<T>(acao: () => Promise<T>): Promise<Resultado<T>> {
  try {
    return { ok: true, valor: await acao() };
  } catch (erro) {
    return { ok: false, erro };
  }
}

function erroDe<T>(resultado: Resultado<T>): unknown {
  return resultado.ok ? undefined : resultado.erro;
}

function mensagemDe<T>(resultado: Resultado<T>): string {
  const erro = erroDe(resultado);

  return erro instanceof Error ? erro.message : String(erro);
}

/** O SQLSTATE que o servidor devolveu, ou `undefined` quando o erro não veio dele. */
function sqlstate(erro: unknown): string | undefined {
  const codigo = (erro as { code?: unknown } | null)?.code;

  return typeof codigo === 'string' ? codigo : undefined;
}

/**
 * O nome da restrição que o servidor apontou.
 *
 * Afirmá-lo — e não só o `SQLSTATE` — é o que distingue "alguma unicidade recusou" de "ESTA unicidade
 * recusou": `negocio.contrato` tem duas restrições únicas e um índice único parcial.
 */
function nomeDaRestricao(erro: unknown): string | undefined {
  const nome = (erro as { constraint_name?: unknown } | null)?.constraint_name;

  return typeof nome === 'string' ? nome : undefined;
}

/** A COLUNA que o servidor apontou — o que discrimina a recusa por `NOT NULL` (CT-1066). */
function nomeDaColuna(erro: unknown): string | undefined {
  const nome = (erro as { column_name?: unknown } | null)?.column_name;

  return typeof nome === 'string' ? nome : undefined;
}

/** A ordenação dos `pid` — numérica, e não a lexicográfica que `sort()` aplicaria por omissão. */
function porOrdemNumerica(primeiro: number, segundo: number): number {
  return primeiro - segundo;
}

/** O contrato do `estado_resultante` do golden, com a ausência tratada por erro nomeado. */
function contratoResultanteDoGolden(nome: string): ContratoDoGolden {
  const contrato = golden.estado_resultante.contratos.find((item) => item.name === nome);

  if (contrato === undefined) {
    throw new Error(`o golden não traz o estado resultante de ${nome}`);
  }

  return contrato;
}

/** O imóvel do `estado_resultante` do golden, com a ausência tratada por erro nomeado. */
function imovelResultanteDoGolden(nome: string): ImovelDoGolden {
  const imovel = golden.estado_resultante.imoveis.find((item) => item.name === nome);

  if (imovel === undefined) {
    throw new Error(`o golden não traz o estado resultante do imóvel ${nome}`);
  }

  return imovel;
}

/**
 * Traduz um rótulo do legado, e **levanta** quando ele não está declarado.
 *
 * A ausência de rótulo é a forma pela qual esta transposição apodreceria em silêncio: um valor novo
 * no golden viraria `undefined`, e a comparação passaria a medir `undefined` contra `undefined`.
 */
function exigirTraducao<T>(mapa: Readonly<Record<string, T>>, rotulo: string): T {
  const traduzido = mapa[rotulo];

  if (traduzido === undefined) {
    throw new Error(`o rótulo do legado \`${rotulo}\` não tem tradução declarada`);
  }

  return traduzido;
}
