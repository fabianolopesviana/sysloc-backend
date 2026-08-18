/**
 * A porta da conferência bancária — o **predicado do conjunto a conferir** e a recusa da concorrente.
 *
 * ===========================================================================
 * INVARIANTES
 * ===========================================================================
 *
 * | Critério | Caso   | Invariante |
 * |----------|--------|------------|
 * | CA-16    | CT-929 | A seleção da conferência é exatamente a união de (toda cobrança em aberto com
 * |          |        | boleto emitido) e (toda cobrança paga há 30 dias ou menos com boleto emitido),
 * |          |        | com a fronteira dos 30 dias medida contra `negocio.data_corrente_da_operacao()`
 * |          |        | — nem uma a mais, nem uma a menos, por igualdade de conjunto com controle
 * |          |        | antivácuo ancorado em LITERAL. As três bordas (29, 30 e 31 dias) são
 * |          |        | afirmadas INDIVIDUALMENTE, com 29 e 30 DENTRO e 31 FORA. Ficam FORA: a em
 * |          |        | aberto sem boleto, a paga há 29 dias sem boleto, a cancelada com boleto e a
 * |          |        | de OUTRA empresa — sem que assinatura alguma receba `empresaId` (ADR-0008). |
 * | CA-15    | CT-929 | Com uma conferência em curso (`concluida_em IS NULL`) da empresa A, o segundo
 * | CA-09    | (b)    | disparo de A **não cria linha nova**: a porta devolve `iniciadaAgora: false`
 * |          |        | com o MESMO `id` da primeira, e a mesma inserção pela instrução crua é
 * |          |        | recusada PELO BANCO com `23505` nomeando
 * |          |        | `conferencia_bancaria_em_andamento_uidx`. A conferência de B é aceita.
 * |          |        | Concluída a de A, uma nova de A passa a ser aceita — o índice é PARCIAL, e
 * |          |        | não total. As duas contagens da conclusão são gravadas e lidas por valor. |
 * | CA-15    | CT-929 | Uma conclusão que NÃO alcança a linha levanta com nome, em vez de resolver em
 * |          | (c)    | silêncio: sob o contexto de OUTRA empresa a política esconde a conferência, a
 * |          |        | escrita não tem efeito, e a recusa é a CLASSE `ErroDeConferenciaNaoAlcancada`
 * |          |        | carregando o identificador — não um `Error` de texto. A mesma chamada, sob o
 * |          |        | contexto certo, conclui (controle positivo), e a REPETIÇÃO — o percurso do
 * |          |        | REENVIO da tarefa, que a entrega *at-least-once* torna alcançável — é
 * |          |        | recusada do mesmo modo, com as contagens da passada que de fato correu
 * |          |        | sobrevivendo por valor. |
 *
 * Rastreabilidade: `CA-16 → CT-929 (RN-11)` · `CA-15, CA-09 → CT-929 (b) (RN-11)` ·
 * `CA-15 → CT-929 (c) (RN-11)`.
 *
 * ⚠️ **O `CT-929 (b)` e o `CT-929 (c)` são acréscimo do executor**, e a razão é o **aceite técnico da
 * própria task**: a §4 exige *"segunda conferência concorrente recusada pelo banco; concluída a
 * primeira, uma nova é aceita"*, que o `CT-929` — cujo eixo é o predicado — não alcança. Sem eles,
 * `abrirConferencia`, `concluirConferencia` e `lerConferenciaEmCurso` entrariam na árvore sem nenhuma
 * asserção sobre o que devolvem, e o índice único parcial ficaria sem prova de que quem recusa é o
 * banco. É a mesma razão, e o mesmo desenho, do `CT-916 (b)`/`(c)` da task irmã.
 *
 * ===========================================================================
 * A PRECONDIÇÃO PRIVILEGIADA: as datas são posicionadas contra o RELÓGIO DO BANCO
 * ===========================================================================
 *
 * As três bordas só significam alguma coisa se forem medidas contra o **mesmo eixo** que o predicado
 * consulta. Por isso **nenhum `new Date()` participa do arranjo**: `pago_em` é posicionado por
 * {@link dataDeslocada}, que lê `negocio.data_corrente_da_operacao()` do banco e devolve a data
 * deslocada em N dias — exatamente a disciplina que o `CT-506` (`derivacao-de-cobranca.spec.ts`) e o
 * `CT-513` (`cobranca.spec.ts`) já fixam nesta base. O relógio nunca é falseado; **o dado é que se
 * move**.
 *
 * Um arranjo montado com o relógio do processo passaria a depender do fuso de quem roda a suíte: a
 * função do banco reduz o instante a dia em `America/Sao_Paulo`, e num processo em UTC as bordas de 29
 * e 31 dias cairiam no lugar errado por até três horas por dia — reprovando (ou, pior, **passando**)
 * conforme a hora da execução.
 *
 * O contexto de tenant vem do par que a operação usa — `contextoDeTenant.executarCom` mais
 * `acesso.emUnidadeDeTrabalho` —, e **não** de um parâmetro acrescentado à produção: acrescentar
 * `empresaId` a uma assinatura seria escrever em código a comparação que a política já faz (ADR-0008),
 * que é a Lei do seam somada à `Decision` daquela ADR. As duas empresas são as da **semente real**
 * (`EMPRESA_A`, `EMPRESA_B`), e o usuário que dispara cada conferência é **derivado da carga** (ver
 * {@link exigirUsuarioDa}), nunca um literal reescrito aqui: o par `(usuario, empresa)` que
 * `conferencia_bancaria_usuario_empresa_fkey` cobra é o mesmo que `semente.ts` gravou.
 *
 * ===========================================================================
 * As DUAS intrusas que discriminam o que uma lista de elegíveis sozinha não discrimina
 * ===========================================================================
 *
 *   * **a paga há 29 dias SEM boleto** existe por causa da **precedência dos operadores**: `AND` liga
 *     mais forte que `OR`, de modo que um predicado escrito sem os parênteses do segundo termo vira
 *     `(nosso_numero IS NOT NULL AND em aberto) OR (paga há ≤30 dias)` — e ela entra no conjunto. É a
 *     única intrusa que essa perda faz vazar, e sem ela o defeito passaria despercebido;
 *   * **a de OUTRA empresa** existe porque o recorte é da política: ela é elegível em tudo, e só não
 *     entra porque a RLS a esconde. O **controle antivácuo** dela é a chamada sob o contexto de B, que
 *     a devolve — provando que havia o que vazar, em vez de um conjunto vazio dos dois lados.
 *
 * ===========================================================================
 * O controle antivácuo é ancorado em LITERAL, e a escolha corrige um defeito medido
 * ===========================================================================
 *
 * {@link TOTAL_DE_ELEGIVEIS} é o número que o card do CT-929 declara, escrito como literal. Ele **não**
 * é `ELEGIVEIS.length`: as listas que entram na igualdade descendem do mesmo arranjo por `map`, que
 * **preserva comprimento**, de modo que compará-las entre si é verdade por construção — inclusive com
 * o arranjo vazio, e aí o caso inteiro passaria comparando nada com nada. Foi o bloqueante da rodada 1
 * da task irmã, e o literal é o segundo eixo que o arranjo não alcança.
 *
 * ===========================================================================
 * Cada caso deixa o banco SEM conferência em andamento — e isso é prova, não higiene
 * ===========================================================================
 *
 * O índice é por empresa e atravessa os casos, de modo que uma conferência deixada aberta por um caso
 * faria o seguinte observar `iniciadaAgora: false` sem que nada no caso o explicasse. Os fechos que
 * encerram cada caso não são limpeza incidental: são a própria afirmação de que `concluirConferencia`
 * libera o índice, que é a segunda metade da CA-15.
 *
 * Justamente **por serem asserção**, eles não são rede: o caso que reprove ANTES de alcançá-los deixa
 * uma conferência aberta, e o seguinte reprova por herança. A rede é
 * {@link liberarConferenciasEmAndamento}, que roda em `beforeEach` por instrução crua — ela **não
 * substitui** os fechos, e numa execução íntegra não encontra conferência nenhuma.
 *
 * ===========================================================================
 * MUTANTES EXECUTADOS (2026-08-17)
 * ===========================================================================
 *
 * As asserções deste arquivo são **comportamentais** — exercitam a porta contra banco real —, e por
 * isso a `.claude/rules/testing-stack.md` não lhes cobra prova de falsificação. Os sete abaixo foram
 * medidos assim mesmo, porque as invariantes que este arquivo existe para fixar são em boa parte
 * *ausências* (dois parênteses, um `=` na comparação, um termo da cláusula, uma cláusula do índice), e
 * ausência é o que passa despercebido. Todos com a suíte invocada pelo **script do pacote**
 * (`pnpm --filter @sysloc/db test`), nunca por `vitest run` avulso, sobre a árvore de controle de
 * **206 casos** (29 arquivos).
 *
 * ⚠️ **DOIS deles mudaram a ordem das asserções, e as mudanças ficam registradas** — foi por isso que
 * a medição valeu a pena:
 *
 *   * **MT-T5-A · o predicado SEM os parênteses do segundo termo** — a precedência de `AND` sobre `OR`
 *     transformando a união em `(com boleto E em aberto) OU (paga há ≤30 dias)`. `Test Files 1 failed |
 *     28 passed (29)`, `Tests 1 failed | 205 passed (206)`: o `CT-929` reprova **nomeando a intrusa**,
 *     `excedentes: ['COB-2026-9290007']` — a paga há 29 dias **sem** boleto, que é a única cobrança do
 *     arranjo que essa perda faz vazar. As três bordas seguem verdes sob ele, e é isso que mostra que o
 *     mapa de bordas e a igualdade de conjunto medem eixos **diferentes**;
 *   * **MT-T5-B · `>=` trocado por `>`** — a borda dos 30 dias virando exclusiva. `Tests 1 failed | 205
 *     passed (206)`, com o `CT-929` reprovando em `"paga há 30 dias": false`.
 *     ⚠️ **Este mutante mudou a ordem do caso.** Na primeira medição o mapa de bordas vinha **depois**
 *     da igualdade de conjunto, e o desfecho era `ausentes: ['COB-2026-9290003']` — o código da
 *     cobrança, e não a **borda** que se moveu; o mapa ficava inalcançável, porque toda troca de borda
 *     também muda o conjunto. A ordem foi corrigida (bordas primeiro) e o mutante **reexecutado**: é
 *     dessa segunda execução que sai o diagnóstico acima;
 *   * **MT-T5-C · a janela em `INTERVAL '31 days'`** — o teto da RN-11 afrouxado em um dia. `Tests 1
 *     failed | 205 passed (206)`, com o `CT-929` reprovando em `"paga há 31 dias": true`. Ele é o par
 *     do `MT-T5-B`: um move a borda de dentro, o outro a de fora, e só o mapa distingue os dois;
 *   * **MT-T5-D · a conclusão sem observar a linha alcançada** — o `UPDATE` aguardado com o resultado
 *     descartado, que é o defeito `ALTO` que o Gate 2 nomeou na task irmã. `Tests 1 failed | 205 passed
 *     (206)`: o `CT-929 (c)` reprova em `classe: 'ACEITO'` — a escrita sob o contexto da empresa B
 *     alcançava zero linhas e **resolvia em silêncio**.
 *     ⚠️ **A forma ingênua do mutante NÃO compila**: apagar só o `if` deixa `resultado` sem leitura e o
 *     `noUnusedLocals` do `tsconfig` aborta o `tsc --build` antes de a suíte rodar (`error TS6133`). O
 *     mutante válido descarta também a atribuição — quem repetir a medição precisa fazer os dois;
 *   * **MT-T5-E · a recusa de volta a `Error` genérico** — `concluirConferencia` levantando
 *     `new Error('a conferência foi concluída e não foi alcançada')` no lugar de
 *     {@link ErroDeConferenciaNaoAlcancada}. `Tests 1 failed | 205 passed (206)`, com o `CT-929 (c)`
 *     reprovando em `classe: 'OUTRA RECUSA'` — a **mensagem é idêntica**, e é só o eixo do tipo que o
 *     pega. É a rede do defeito que a task irmã levou três rodadas para fechar;
 *   * **MT-T5-F · a cláusula sem `AND concluida_em IS NULL`** — a repetição voltando a alcançar a linha
 *     já concluída. `Tests 1 failed | 205 passed (206)`, com o `CT-929 (c)` reprovando em
 *     `cobrancasConferidas: 0` e `efeitos: 0` contra `12` e `3` — a passada que de fato correu apagada
 *     pela tentativa que não fez nada.
 *     ⚠️ **Este mutante também mudou a ordem do caso.** Na primeira medição a asserção do fato
 *     preservado vinha **depois** do retrato da recusa, e o Vitest abortava o caso antes de alcançá-la:
 *     o diagnóstico era `classe: 'ACEITO'`, que descreve a recusa ausente e **não** o dano. Com a
 *     leitura das contagens antes, o mutante acusa o dano; e o `MT-T5-E`, que não apaga nada, continua
 *     sendo pego pelo retrato — as duas asserções ficam alcançáveis, cada uma pelo seu mutante;
 *   * **MT-T5-G · o índice único SEM a cláusula `WHERE`** — o defeito reintroduzido em
 *     `migracoes/0017_dominio_emissao_e_conciliacao.sql`, que é a fonte executável do índice, tornando-o
 *     TOTAL. `Test Files 2 failed | 27 passed (29)`, `Tests 3 failed | 203 passed (206)`: o `CT-929 (b)`
 *     e o `CT-929 (c)` reprovam, e o `CT-940` de `isolamento-bancario.spec.ts` — alheio a esta task —
 *     reprova comparando a definição do índice no catálogo. É a segunda metade da CA-15 medida: sem o
 *     passo que abre uma conferência nova **depois** de concluir a primeira, este mutante passaria.
 *     ⚠️ **A via da reprovação aqui é indireta, e a ressalva é obrigatória**: com o índice total, o
 *     `ON CONFLICT (empresa_id) WHERE concluida_em IS NULL` deixa de **inferir** índice algum e o
 *     servidor recusa a instrução, de modo que o caso reprova por não conseguir abrir a conferência —
 *     e não por conseguir abrir a segunda. Ele prova que o predicado do índice e o do árbitro são o
 *     mesmo objeto; quem quiser medir a recusa da segunda **sobre um índice total** precisa mutar os
 *     dois lados juntos.
 *
 * ===========================================================================
 * De onde vem o banco (ADR-0006)
 * ===========================================================================
 *
 * De uma instância efêmera própria, migrada e semeada, descartada ao fim. Nenhuma coordenada de
 * conexão é lida do ambiente — a suíte nunca toca o banco que atende a operação.
 */

import type { TransactionSql } from 'postgres';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  abrirConferencia,
  type CobrancaAConferir,
  concluirConferencia,
  ErroDeConferenciaNaoAlcancada,
  type LinhaDaConferencia,
  lerConferenciaEmCurso,
  selecionarCobrancasAConferir,
} from '../src/conferencia-bancaria.ts';
import * as contextoDeTenant from '../src/contexto.ts';
import { EMPRESA_A, EMPRESA_B, USUARIOS, type UsuarioSemeado } from '../src/semente.ts';
import { type AcessoAoBanco, abrirAcessoAoBanco } from '../src/unidade-de-trabalho.ts';
import { type BancoMigrado, bancoEfemero } from './banco-efemero.ts';

// ---------------------------------------------------------------------------
// Limites de tempo — constantes nomeadas, nunca número mágico no meio do caso
// ---------------------------------------------------------------------------

/** Subir a instância, provisionar papéis, migrar e semear leva dezenas de segundos nesta máquina. */
const LIMITE_SUBIDA_MS = 90_000;

/** Os casos semeiam poucas linhas e fazem uma dezena de idas ao banco; o teto é folgado. */
const LIMITE_DO_CASO_MS = 60_000;

/** Uma conexão só por acesso: a sequência de unidades corre sobre a MESMA conexão física. */
const RESERVA_DE_UMA = 1;

const CONTEXTO_DE_A = { empresaId: EMPRESA_A.id } as const;
const CONTEXTO_DE_B = { empresaId: EMPRESA_B.id } as const;

// ---------------------------------------------------------------------------
// Os atores da carga inicial — derivados dela, nunca redigitados
// ---------------------------------------------------------------------------

/**
 * O usuário que dispara a conferência de cada empresa.
 *
 * Ele é **derivado da carga**, e não um literal reescrito aqui: o par `(usuario, empresa)` que
 * `conferencia_bancaria_usuario_empresa_fkey` cobra é o mesmo que `semente.ts` gravou, e copiar o
 * identificador criaria uma segunda declaração livre para divergir da carga que a instância efêmera
 * aplica. Mesma forma de `emissao-em-lote.spec.ts`.
 */
function exigirUsuarioDa(empresaId: string): UsuarioSemeado {
  const usuario = USUARIOS.find((candidato) => candidato.empresaId === empresaId);
  if (usuario === undefined) {
    throw new Error(`a carga inicial não tem usuário da empresa ${empresaId}`);
  }
  return usuario;
}

const USUARIO_DE_A = exigirUsuarioDa(EMPRESA_A.id);
const USUARIO_DE_B = exigirUsuarioDa(EMPRESA_B.id);

// ---------------------------------------------------------------------------
// As oito cobranças do arranjo — três elegíveis, quatro intrusas e a de outra empresa
// ---------------------------------------------------------------------------

/**
 * Uma cobrança do arranjo — o que ela é, e o que a torna (ou não) parte do conjunto a conferir.
 *
 * A forma declarativa é o que permite semear as oito pela MESMA instrução, variando só o que
 * discrimina: um arranjo com oito `INSERT` diferentes faria a lista esperada depender de qual deles o
 * autor lembrou de manter em dia.
 *
 * `diasDesdeOPagamento` é **deslocamento**, e não data: a data concreta só existe depois de o banco
 * dizer que dia é hoje — ver {@link dataDeslocada} e o cabeçalho deste arquivo.
 */
interface CobrancaDoArranjo {
  readonly id: string;
  readonly codigo: string;
  /** Há quantos dias a cobrança foi paga, ou `null` quando ela não foi paga. */
  readonly diasDesdeOPagamento: number | null;
  readonly canceladoEm: string | null;
  /** Preenchido ⇒ tem boleto emitido, e é este campo que o primeiro termo do predicado exige. */
  readonly numeroDoTituloNoProvedor: string | null;
}

function cobranca(
  posicao: number,
  parte: Omit<CobrancaDoArranjo, 'id' | 'codigo'>,
): CobrancaDoArranjo {
  return {
    id: `aaaaaaaa-9290-4000-8000-00000000000${posicao}`,
    codigo: `COB-2026-929000${posicao}`,
    ...parte,
  };
}

/** O número do título tal como o provedor o atribui — 18 posições, como na fatia da emissão. */
function tituloDe(posicao: number): string {
  return `00000000000000000${posicao}`;
}

const SEM_BOLETO = { numeroDoTituloNoProvedor: null } as const;

/**
 * As **três** elegíveis: a em aberto com boleto, e as pagas nas duas bordas que ficam DENTRO.
 *
 * São três, e não uma: uma só faria a igualdade de conjunto passar por qualquer consulta que
 * devolvesse a primeira linha que encontrasse. E elas cobrem os **dois** ramos da união — o de estar
 * em aberto e o de ter sido paga dentro da janela —, de modo que a perda de qualquer um dos dois
 * aparece como `ausentes`.
 */
const EM_ABERTO_COM_BOLETO = cobranca(1, {
  diasDesdeOPagamento: null,
  canceladoEm: null,
  numeroDoTituloNoProvedor: tituloDe(1),
});

const PAGA_HA_29_DIAS = cobranca(2, {
  diasDesdeOPagamento: 29,
  canceladoEm: null,
  numeroDoTituloNoProvedor: tituloDe(2),
});

const PAGA_HA_30_DIAS = cobranca(3, {
  diasDesdeOPagamento: 30,
  canceladoEm: null,
  numeroDoTituloNoProvedor: tituloDe(3),
});

const ELEGIVEIS: readonly CobrancaDoArranjo[] = [
  EM_ABERTO_COM_BOLETO,
  PAGA_HA_29_DIAS,
  PAGA_HA_30_DIAS,
];

/**
 * Quantas elegíveis o arranjo declara — o **literal** que o card do CT-929 fixa.
 *
 * Ele é literal de propósito: ver o cabeçalho deste arquivo para o defeito medido que a âncora literal
 * corrige, e por que `ELEGIVEIS.length` não serviria.
 */
const TOTAL_DE_ELEGIVEIS = 3;

/**
 * As **quatro** intrusas da empresa A — cada uma falha por um motivo só.
 *
 * A paga há 31 dias é a borda de fora; a em aberto sem boleto e a cancelada com boleto são as duas
 * exclusões que o aceite técnico nomeia; a paga há 29 dias **sem** boleto é a que discrimina a perda
 * dos parênteses do predicado — ver o cabeçalho.
 */
const PAGA_HA_31_DIAS = cobranca(4, {
  diasDesdeOPagamento: 31,
  canceladoEm: null,
  numeroDoTituloNoProvedor: tituloDe(4),
});

const EM_ABERTO_SEM_BOLETO = cobranca(5, {
  diasDesdeOPagamento: null,
  canceladoEm: null,
  ...SEM_BOLETO,
});

const CANCELADA_COM_BOLETO = cobranca(6, {
  diasDesdeOPagamento: null,
  canceladoEm: '2026-08-06T12:00:00Z',
  numeroDoTituloNoProvedor: tituloDe(6),
});

const PAGA_HA_29_DIAS_SEM_BOLETO = cobranca(7, {
  diasDesdeOPagamento: 29,
  canceladoEm: null,
  ...SEM_BOLETO,
});

const INTRUSAS: readonly CobrancaDoArranjo[] = [
  PAGA_HA_31_DIAS,
  EM_ABERTO_SEM_BOLETO,
  CANCELADA_COM_BOLETO,
  PAGA_HA_29_DIAS_SEM_BOLETO,
];

const COBRANCAS_DE_A: readonly CobrancaDoArranjo[] = [...ELEGIVEIS, ...INTRUSAS];

/**
 * A cobrança da empresa **B** — elegível em tudo, e fora do conjunto de A só porque a política a
 * esconde.
 *
 * Ela é o que transforma *"nenhuma cobrança de outra empresa aparece"* numa afirmação com conteúdo: a
 * chamada sob o contexto de B a devolve, provando que **havia o que vazar**.
 */
const ELEGIVEL_DE_B = cobranca(8, {
  diasDesdeOPagamento: null,
  canceladoEm: null,
  numeroDoTituloNoProvedor: tituloDe(8),
});

/** As três chaves de cada elegível, na ordem que a consulta declara (por código). */
const ESPERADAS: readonly CobrancaAConferir[] = ELEGIVEIS.map((linha) => ({
  id: linha.id,
  codigo: linha.codigo,
  // O predicado exige `nosso_numero IS NOT NULL`, então toda elegível o tem — o ramo de recusa existe
  // para que um arranjo mal montado reprove no carregamento, e não como igualdade silenciosa.
  numeroDoTituloNoProvedor: exigirTitulo(linha),
}));

const CODIGOS_ESPERADOS = ESPERADAS.map(({ codigo }) => codigo);

/** O título de uma elegível — `null` aqui é defeito do arranjo, e não desfecho a comparar. */
function exigirTitulo(linha: CobrancaDoArranjo): string {
  if (linha.numeroDoTituloNoProvedor === null) {
    throw new Error(`a elegível ${linha.codigo} precisa de boleto emitido para entrar no conjunto`);
  }
  return linha.numeroDoTituloNoProvedor;
}

// ---------------------------------------------------------------------------
// Identificadores descartáveis do cadastro de apoio
// ---------------------------------------------------------------------------
//
// A cadeia inteira é necessária, e não é zelo: `cobranca.contrato_id` tem chave estrangeira COMPOSTA
// para `contrato(id, empresa_id)`, o contrato exige imóvel, locador e locatário, e o imóvel exige
// conjunto — todas as chaves são `NOT NULL`. Mesmo arranjo, e mesma razão, de `semearApoio` em
// `emissao-em-lote.spec.ts`.

/** Os cinco identificadores do apoio de uma empresa, derivados de um prefixo por empresa. */
function apoioDe(prefixo: string): {
  conjunto: string;
  imovel: string;
  locador: string;
  locatario: string;
  contrato: string;
} {
  return {
    conjunto: `${prefixo}-000000000001`,
    imovel: `${prefixo}-000000000002`,
    locador: `${prefixo}-000000000003`,
    locatario: `${prefixo}-000000000004`,
    contrato: `${prefixo}-000000000005`,
  };
}

const APOIO_DE_A = apoioDe('aaaaaaaa-9291-4000-8000');
const APOIO_DE_B = apoioDe('bbbbbbbb-9291-4000-8000');

// ---------------------------------------------------------------------------
// Moldes e acessórios de coleta
// ---------------------------------------------------------------------------

/** O molde do instante que a projeção publica: ISO-8601 em UTC, com milissegundos e `Z` literal. */
const INSTANTE_ISO_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

/** O molde do UUID que o banco gera — é o que impede a asserção de passar sobre cadeia vazia. */
const IDENTIFICADOR_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** A marca com que um instante bem-formado entra na igualdade de corpo inteiro. */
const CARIMBO_DO_BANCO = 'INSTANTE ISO-8601 UTC';

/** `unique_violation` — o SQLSTATE do índice único parcial recusando a conferência concorrente. */
const VIOLACAO_DE_UNICIDADE = '23505';

/** O índice que recusa a segunda conferência em andamento — nomeado, e não um `23505` qualquer. */
const INDICE_DA_CONFERENCIA_EM_ANDAMENTO = 'conferencia_bancaria_em_andamento_uidx';

/**
 * A recusa que a porta de conclusão levanta quando **não alcança a linha**.
 *
 * É literal nomeado aqui, e não texto solto no meio do caso: a asserção é sobre a mensagem exata, e um
 * literal repetido nos pontos de uso ficaria livre para divergir do que a porta escreve.
 */
const RECUSA_DA_CONCLUSAO = 'a conferência foi concluída e não foi alcançada';

/**
 * O nome da **classe** de recusa que o `CT-929 (c)` distingue, e o rótulo de tudo o mais.
 *
 * Ele é nomeado aqui porque a asserção é sobre a classe **reconhecida por `instanceof`**, e não sobre
 * a propriedade `name` — que qualquer `Error` pode carregar. O rótulo genérico existe para que a
 * reprovação **nomeie o que veio no lugar** em vez de dizer só que os objetos diferem.
 */
const CLASSE_NAO_ALCANCADA = 'ErroDeConferenciaNaoAlcancada';
const OUTRA_RECUSA = 'OUTRA RECUSA';

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

/** O SQLSTATE que o servidor devolveu, ou `undefined` quando o erro não veio dele. */
function sqlstate(erro: unknown): string | undefined {
  const codigo = (erro as { code?: unknown } | null)?.code;
  return typeof codigo === 'string' ? codigo : undefined;
}

/** A restrição que o servidor nomeou, ou `undefined` quando o erro não veio dele. */
function restricaoDe(erro: unknown): string | undefined {
  const nome = (erro as { constraint_name?: unknown } | null)?.constraint_name;
  return typeof nome === 'string' ? nome : undefined;
}

/**
 * O desfecho de uma tentativa, como texto comparável — `<sqlstate> · <restrição>` ou `ACEITO`.
 *
 * Ele existe para que a recusa entre numa igualdade **que nomeia o que aconteceu**, em vez de um
 * booleano de insucesso: o ramo `ACEITO` é o que faz a asserção reprovar quando a escrita ilegítima
 * passa, e o par `(sqlstate, restrição)` é o que a faz reprovar quando quem recusou foi outra
 * restrição. Mesma forma de `desfechoDaTentativa` em `emissao-em-lote.spec.ts`.
 */
function desfechoDaTentativa(tentativa: Resultado<unknown>): string {
  if (tentativa.ok) {
    return 'ACEITO';
  }

  const codigo = sqlstate(tentativa.erro) ?? 'sem sqlstate';
  const restricao = restricaoDe(tentativa.erro) ?? 'sem restrição';

  return `${codigo} · ${restricao}`;
}

/**
 * A recusa como corpo comparável — **classe**, o que ela diz de si, e a conferência que ela carrega.
 *
 * O eixo é a **classe**: a porta precisa recusar com um tipo que o chamador reconheça em runtime,
 * porque zero linhas tem duas causas (o reenvio benigno da tarefa e o alvo errado) que a camada de
 * dados não separa — quem decide é quem sabe se está reentrando. Uma asserção só sobre a mensagem
 * passaria com um `Error` genérico, que é a forma que o Gate 2 da task irmã julgou insuficiente.
 *
 * O ramo `ACEITO` é o que faz a asserção reprovar quando a escrita que não deveria alcançar linha
 * alguma passa **em silêncio**.
 */
function retratoDaRecusa(tentativa: Resultado<unknown>): {
  classe: string;
  dito: string;
  conferencia: string | null;
} {
  if (tentativa.ok) {
    return { classe: 'ACEITO', dito: 'ACEITO', conferencia: null };
  }

  if (tentativa.erro instanceof ErroDeConferenciaNaoAlcancada) {
    return {
      classe: CLASSE_NAO_ALCANCADA,
      dito: tentativa.erro.message,
      conferencia: tentativa.erro.conferenciaId,
    };
  }

  return { classe: OUTRA_RECUSA, dito: desfechoDaTentativa(tentativa), conferencia: null };
}

/**
 * O que sobra e o que falta entre o observado e o declarado, com os nomes.
 *
 * Declarada aqui, e **não importada** de `packages/auth/test/conjuntos.ts`: aquele arquivo é acessório
 * de outro pacote, e alcançá-lo por caminho relativo profundo atravessaria fronteira de pacote — o
 * mesmo `D28` que a nota daquele arquivo nomeia. Esta é a **segunda** ocorrência em `packages/db/test/`
 * (a primeira é `emissao-em-lote.spec.ts`), e o limiar de três do `CLAUDE.md` dispara na **terceira**.
 *
 * Ela devolve as diferenças, e não um booleano, pela razão que o original registra: uma reprovação que
 * diz apenas "os conjuntos diferem" obriga quem lê a caçar o item, e é essa fricção que faz a asserção
 * ser afrouxada na rodada seguinte.
 */
function diferencasDeConjunto(
  observado: readonly string[],
  declarado: readonly string[],
): { excedentes: string[]; ausentes: string[] } {
  const noDeclarado = new Set(declarado);
  const noObservado = new Set(observado);

  return {
    excedentes: [...noObservado].filter((item) => !noDeclarado.has(item)).sort(),
    ausentes: [...noDeclarado].filter((item) => !noObservado.has(item)).sort(),
  };
}

/** O instante reduzido à FORMA — o carimbo bem-formado vira a marca, e o torto entra nomeado. */
function marcaDoInstante(valor: string): string {
  return INSTANTE_ISO_UTC.test(valor) ? CARIMBO_DO_BANCO : `FORA DO MOLDE: ${valor}`;
}

/** O mesmo, para o carimbo ANULÁVEL: o nulo atravessa intacto e é ele que diz "em andamento". */
function marcaDoInstanteOpcional(valor: string | null): string | null {
  return valor === null ? null : marcaDoInstante(valor);
}

/**
 * A conferência como a igualdade de corpo inteiro a compara — tudo, menos o `id` e o valor dos
 * instantes.
 *
 * O `id` sai porque é sorteado pelo banco e nenhum caso o conhece: ele é asserido por forma e por
 * igualdade **entre chamadas**, onde a comparação diz alguma coisa. Os dois instantes entram
 * **reduzidos à forma**: compará-los contra si mesmos seria tautologia (AP-29), e deixá-los fora da
 * igualdade deixaria sem prova justamente o campo que distingue a conferência em andamento da
 * concluída.
 */
function retrato(conferencia: LinhaDaConferencia): {
  iniciadaEm: string;
  concluidaEm: string | null;
  cobrancasConferidas: number;
  efeitos: number;
} {
  return {
    iniciadaEm: marcaDoInstante(conferencia.iniciadaEm),
    concluidaEm: marcaDoInstanteOpcional(conferencia.concluidaEm),
    cobrancasConferidas: conferencia.cobrancasConferidas,
    efeitos: conferencia.efeitos,
  };
}

/** A conferência que a leitura precisa ter alcançado — `undefined` aqui é defeito, não desfecho. */
function exigirConferencia(
  conferencia: LinhaDaConferencia | undefined,
  rotulo: string,
): LinhaDaConferencia {
  if (conferencia === undefined) {
    throw new Error(`a conferência ${rotulo} não foi alcançada pela leitura`);
  }
  return conferencia;
}

let banco: BancoMigrado;
let acesso: AcessoAoBanco;

/** Corre uma unidade de trabalho sob o contexto da empresa — o par que a operação usa. */
async function sobContextoDe<T>(
  contexto: { readonly empresaId: string },
  trabalho: (tx: TransactionSql) => Promise<T>,
): Promise<T> {
  return contextoDeTenant.executarCom(contexto, async () =>
    acesso.emUnidadeDeTrabalho(async (tx) => trabalho(tx)),
  );
}

/**
 * O molde com que a leitura de observação compõe os dois instantes.
 *
 * Ele é declarado aqui, e não importado de `../src/moldes-de-formatacao.ts`, de propósito: este é o
 * **oráculo** do caso, e importá-lo do SUT faria a asserção comparar a porta consigo mesma — se o
 * molde mudar dos dois lados, a igualdade continua verde e o formato publicado muda sem que nada
 * acuse. É a mesma razão pela qual {@link INSTANTE_ISO_UTC} é escrito por extenso.
 */
const MOLDE_DO_INSTANTE_NA_OBSERVACAO = 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"';

/**
 * Lê **uma** conferência pelo identificador, por instrução crua — o observatório dos casos.
 *
 * Ela existe porque nem toda observação é sobre a conferência *em curso*: a concluída não é alcançável
 * por {@link lerConferenciaEmCurso}, e usar a porta para observar o efeito da porta faria o caso medir
 * o SUT contra ele mesmo. Nenhuma comparação de empresa aqui: a política recorta a leitura (ADR-0008),
 * e é por isso que a mesma chamada sob outro contexto devolve `undefined`.
 */
async function lerConferenciaPorId(
  contexto: { readonly empresaId: string },
  id: string,
): Promise<LinhaDaConferencia | undefined> {
  return await sobContextoDe(contexto, async (tx) => {
    const [linha] = await tx<LinhaDaConferencia[]>`
      SELECT id,
             to_char(iniciada_em AT TIME ZONE 'UTC', ${MOLDE_DO_INSTANTE_NA_OBSERVACAO})
               AS "iniciadaEm",
             to_char(concluida_em AT TIME ZONE 'UTC', ${MOLDE_DO_INSTANTE_NA_OBSERVACAO})
               AS "concluidaEm",
             cobrancas_conferidas AS "cobrancasConferidas",
             efeitos
        FROM negocio.conferencia_bancaria
       WHERE id = ${id}
    `;

    return linha;
  });
}

/** Quantas conferências a empresa do contexto tem, ao todo — a contagem CRUA que mede o efeito. */
async function contarConferencias(contexto: { readonly empresaId: string }): Promise<string> {
  return await sobContextoDe(contexto, async (tx) => {
    const [linha] = await tx<{ total: string }[]>`
      SELECT count(*)::text AS total FROM negocio.conferencia_bancaria
    `;

    if (linha === undefined) {
      throw new Error('a contagem de conferências não devolveu linha');
    }

    return linha.total;
  });
}

/**
 * A data corrente da operação deslocada em `dias`, como cadeia `YYYY-MM-DD`.
 *
 * **É assim que toda data de pagamento deste arquivo é posicionada**: o relógio nunca é falseado, o
 * dado é que se move. A leitura sai do mesmo `negocio.data_corrente_da_operacao()` que o predicado
 * consulta, de modo que a fronteira dos 30 dias é medida contra o próprio eixo que a decide. Mesma
 * forma, e mesma razão, de `dataDeslocada` em `cobranca.spec.ts` (CT-513).
 */
async function dataDeslocada(
  contexto: { readonly empresaId: string },
  dias: number,
): Promise<string> {
  return await sobContextoDe(contexto, async (tx) => {
    const [linha] = await tx<{ data: string }[]>`
      SELECT to_char(
               negocio.data_corrente_da_operacao() - make_interval(days => ${dias}),
               'YYYY-MM-DD'
             ) AS data
    `;

    if (linha === undefined) {
      throw new Error('o relógio do banco não devolveu a data corrente da operação');
    }

    return linha.data;
  });
}

/**
 * Semeia, sob o contexto da empresa, o cadastro de apoio e as cobranças informadas.
 *
 * Tudo numa unidade só, na ordem pai → filho: as chaves estrangeiras compostas exigem que o conjunto
 * exista antes do imóvel, e o imóvel, o locador e o locatário antes do contrato. As instruções são
 * cruas porque o objeto deste arquivo é a conferência, e não o cadastro — montar o apoio pelas portas
 * daqueles agregados faria estes casos reprovarem por defeito alheio.
 *
 * As datas de pagamento chegam **já resolvidas** contra o relógio do banco, por
 * {@link dataDeslocada} — nenhuma delas nasce de `new Date()`.
 *
 * Nenhuma instrução compara `empresa_id` com coisa alguma: a empresa é **proposta** e a política a
 * aceita ou recusa (ADR-0008).
 */
async function semearApoio(
  contexto: { readonly empresaId: string },
  apoio: ReturnType<typeof apoioDe>,
  cobrancas: readonly CobrancaDoArranjo[],
  marca: string,
): Promise<void> {
  const pagamentos = new Map<string, string>();

  for (const linha of cobrancas) {
    if (linha.diasDesdeOPagamento !== null) {
      pagamentos.set(linha.codigo, await dataDeslocada(contexto, linha.diasDesdeOPagamento));
    }
  }

  await sobContextoDe(contexto, async (tx) => {
    await tx`
      INSERT INTO negocio.conjunto (id, empresa_id, nome)
      VALUES (${apoio.conjunto}, ${contexto.empresaId}, ${`Conjunto da conferência ${marca}`})
    `;
    await tx`
      INSERT INTO negocio.imovel
                  (id, empresa_id, conjunto_id, nome_imovel, identificador_municipal, tipo_imovel,
                   logradouro, numero, complemento, bairro, cidade, estado, cep, status_locacao)
      VALUES (${apoio.imovel}, ${contexto.empresaId}, ${apoio.conjunto},
              ${`Imóvel da conferência ${marca}`}, ${`IM-CONF-${marca}`},
              ${'RESIDENCIAL'}::negocio.tipo_imovel,
              ${'Rua das Acácias'}, ${'400'}, ${null}, ${'Centro'}, ${'Teresina'}, ${'PI'},
              ${'64000000'}, ${'DISPONIVEL'}::negocio.status_locacao)
    `;
    for (const pessoa of [
      { relacao: 'negocio.locador', id: apoio.locador, papel: 'locador' },
      { relacao: 'negocio.locatario', id: apoio.locatario, papel: 'locatario' },
    ]) {
      await tx.unsafe(
        `INSERT INTO ${pessoa.relacao}
                (id, empresa_id, nome, tipo_pessoa, documento_principal, rg, email, telefone,
                 logradouro, numero, complemento, bairro, cidade, estado, cep)
         VALUES ($1, $2, $3, 'PESSOA_FISICA', $4, NULL, $5, '8699990000',
                 'Rua das Acácias', '400', NULL, 'Centro', 'Teresina', 'PI', '64000000')`,
        [
          pessoa.id,
          contexto.empresaId,
          `Cadastro ${pessoa.papel} da conferência ${marca}`,
          `DOC-CONF-${marca}-${pessoa.papel}`,
          `conferencia.${marca}.${pessoa.papel}@exemplo.com.br`,
        ],
      );
    }
    // `RASCUNHO` de propósito: o índice parcial `contrato_imovel_vigente_uidx` só alcança `ATIVO`, e o
    // que este arquivo mede não é a vigência única.
    await tx`
      INSERT INTO negocio.contrato
                  (id, empresa_id, codigo, imovel_id, locador_id, locatario_id, status,
                   data_inicio_locacao, prazo_meses, valor_mensal, dia_vencimento)
      VALUES (${apoio.contrato}, ${contexto.empresaId}, ${`CTR-2026-9290${marca}`}, ${apoio.imovel},
              ${apoio.locador}, ${apoio.locatario}, ${'RASCUNHO'}::negocio.status_contrato,
              ${'2026-01-10'}::date, ${12}, ${'1500.00'}, ${10})
    `;

    for (const linha of cobrancas) {
      // Os quatro carimbos andam com `pago_em` pela bicondicional `cobranca_carimbo_coerente_chk`:
      // pagamento sem carimbo é recusado pelo banco, e é essa recusa que torna a cobrança paga um
      // registro legítimo em vez de uma linha inventada para o caso.
      const pagoEm = pagamentos.get(linha.codigo) ?? null;
      const carimbo = pagoEm === null ? null : '0.00';
      const valorPago = pagoEm === null ? null : '2000.00';

      await tx`
        INSERT INTO negocio.cobranca
                    (id, empresa_id, codigo, contrato_id, natureza, referencia, competencia,
                     data_vencimento, valor_original, pago_em, valor_pago, cancelado_em,
                     multa_aplicada, juros_aplicados, multa_percentual_aplicado,
                     juros_percentual_aplicado, nosso_numero)
        VALUES (${linha.id}, ${contexto.empresaId}, ${linha.codigo}, ${apoio.contrato},
                ${'ALUGUEL'}::negocio.natureza_cobranca, ${'01/08/2026 à 31/08/2026'},
                ${'2026-08-01'}::date, ${'2026-08-10'}::date, ${'2000.00'},
                ${pagoEm}::date, ${valorPago}, ${linha.canceladoEm}::timestamptz,
                ${carimbo}, ${carimbo}, ${carimbo}, ${carimbo},
                ${linha.numeroDoTituloNoProvedor})
      `;
    }
  });
}

beforeAll(async () => {
  banco = await bancoEfemero();
  acesso = abrirAcessoAoBanco({
    cadeiaDeConexao: banco.cadeiaConexao,
    maximoDeConexoes: RESERVA_DE_UMA,
  });
  // O apoio é semeado UMA vez por empresa: as chaves são fixas, e uma segunda semeadura reprovaria
  // por `23505` antes de qualquer asserção — o que esconderia o que os casos medem.
  await semearApoio(CONTEXTO_DE_A, APOIO_DE_A, COBRANCAS_DE_A, 'A');
  await semearApoio(CONTEXTO_DE_B, APOIO_DE_B, [ELEGIVEL_DE_B], 'B');
}, LIMITE_SUBIDA_MS);

afterAll(async () => {
  await acesso?.encerrar();
  await banco?.parar();
}, LIMITE_SUBIDA_MS);

/**
 * Devolve as duas empresas ao estado SEM conferência em andamento — a rede contra herança entre casos.
 *
 * O índice único parcial é por empresa e **atravessa os casos**: um caso que reprove ANTES do fecho que
 * ele mesmo escreve deixa uma conferência aberta, e o caso seguinte observaria `iniciadaAgora: false`
 * por herança, em vez de pelo próprio defeito.
 *
 * Ela roda em `beforeEach`, e não em `afterEach`, porque o que precisa ser garantido é o estado de
 * **entrada**: o caso anterior pode ter terminado por reprovação, por expiração de tempo ou por
 * lançamento, e nenhuma dessas saídas garante que o fecho dele correu.
 *
 * A instrução é **crua**, e não `concluirConferencia`: a rede não pode depender do SUT que os casos
 * medem — uma porta defeituosa faria a limpeza falhar junto, e o defeito apareceria como erro de
 * arranjo. E ela **não substitui** os fechos escritos no corpo dos casos, que são asserção de
 * comportamento (ver o cabeçalho): numa execução íntegra ela não encontra conferência nenhuma.
 *
 * Nenhuma comparação de empresa aqui: a política recorta o `UPDATE` sob cada contexto (ADR-0008).
 */
async function liberarConferenciasEmAndamento(): Promise<void> {
  for (const contexto of [CONTEXTO_DE_A, CONTEXTO_DE_B]) {
    await sobContextoDe(contexto, async (tx) => {
      await tx`
        UPDATE negocio.conferencia_bancaria
           SET concluida_em = pg_catalog.now()
         WHERE concluida_em IS NULL
      `;
    });
  }
}

beforeEach(liberarConferenciasEmAndamento, LIMITE_DO_CASO_MS);

describe('CT-929 — o conjunto da conferência é exatamente o declarado, nem a mais nem a menos', () => {
  it(
    'CT-929 — três elegíveis, as bordas de 29/30/31 dias afirmadas uma a uma, e outra empresa fora',
    async () => {
      const selecionadas = await sobContextoDe(CONTEXTO_DE_A, async (tx) =>
        selecionarCobrancasAConferir(tx),
      );

      const codigos = selecionadas.map(({ codigo }) => codigo);

      // --- 1. Metade do controle antivácuo: a lista DECLARADA não é vazia --------------------
      //
      // Esta perna não observa o SUT — ela protege a igualdade abaixo de comparar nada com nada
      // (`.claude/rules/ancoras-de-superficie.md`). Ela vem primeiro porque não pode reprovar por
      // defeito da porta: se reprovar, quem encolheu foi o arranjo.
      //
      // A contagem é conferida contra o LITERAL de {@link TOTAL_DE_ELEGIVEIS}, e **nunca** contra
      // `ELEGIVEIS.length`: as duas listas descendem do mesmo arranjo por `map`, que preserva
      // comprimento, de modo que uma compará-la com a outra é verdade por construção — inclusive com
      // o arranjo vazio. As DUAS pontas são ancoradas porque só uma delas pode encolher.
      expect(ELEGIVEIS).toHaveLength(TOTAL_DE_ELEGIVEIS);
      expect(CODIGOS_ESPERADOS).toHaveLength(TOTAL_DE_ELEGIVEIS);

      // --- 2. As TRÊS BORDAS, afirmadas INDIVIDUALMENTE ---------------------------------------
      //
      // O card é literal: 29 e 30 DENTRO, 31 FORA — a leitura de "30 dias ou menos" da RN-11. O mapa
      // afirma as três de uma vez **e** nomeia qual delas caiu, o que três asserções soltas fariam
      // pior: a primeira a reprovar deixaria as outras duas inalcançáveis.
      //
      // ⚠️ **Ele vem ANTES da igualdade de conjunto, e a ordem foi decidida por MEDIÇÃO.** Escrito
      // depois dela, o mapa era **inalcançável** sob todo mutante de borda: o mutante `MT-T5-B`
      // (`>=` trocado por `>`) parava na igualdade, cujo diagnóstico é `ausentes:
      // ['COB-2026-9290003']` — o código da cobrança, e não a **borda** que mudou. Toda troca de borda
      // muda o conjunto, de modo que a igualdade sempre reprovaria primeiro e a asserção que o card
      // pede ("as três bordas afirmadas individualmente") nunca seria executada sob defeito.
      const bordas = {
        'paga há 29 dias': codigos.includes(PAGA_HA_29_DIAS.codigo),
        'paga há 30 dias': codigos.includes(PAGA_HA_30_DIAS.codigo),
        'paga há 31 dias': codigos.includes(PAGA_HA_31_DIAS.codigo),
      };

      expect(bordas).toEqual({
        'paga há 29 dias': true,
        'paga há 30 dias': true,
        'paga há 31 dias': false,
      });

      // --- 3. A igualdade de CONJUNTO, nos dois sentidos --------------------------------------
      //
      // Nunca `toContain`: ele aprovaria tanto a elegível que sumiu quanto a intrusa que apareceu. A
      // reprovação nomeia a cobrança culpada — o código dela entra em `excedentes` quando o predicado
      // perde um termo (ou os parênteses), e em `ausentes` quando ele ganha um a mais.
      //
      // Ela é o eixo que o mapa acima **não** cobre: as três bordas são pagas, e nenhuma delas se move
      // quando o defeito está no termo do boleto ou no da cancelada. Foi o que o `MT-T5-A` mediu — sem
      // os parênteses do predicado, as três bordas continuam certas e é aqui que a paga sem boleto
      // aparece como `excedentes`.
      //
      // Ela vem ANTES das contagens de propósito, e a ordem é conteúdo: a contagem reprova primeiro em
      // toda divergência de tamanho, e postada antes deixaria esta asserção inalcançável — o
      // diagnóstico viraria "esperava 3, veio 4" em vez de nomear a cobrança que vazou.
      expect(diferencasDeConjunto(codigos, CODIGOS_ESPERADOS)).toEqual({
        excedentes: [],
        ausentes: [],
      });

      // --- 4. As quatro intrusas de A, NOMEADAS ------------------------------------------------
      //
      // A perna negativa dita por extenso: a paga fora da janela, a em aberto sem boleto, a cancelada
      // com boleto e a paga dentro da janela **sem** boleto estão fora. Ela é implicada pela igualdade
      // acima, e existe pela mesma razão de ordem — ela aponta qual termo do predicado sumiu.
      const intrusasQueVazaram = INTRUSAS.map(({ codigo }) => codigo).filter((codigo) =>
        codigos.includes(codigo),
      );

      expect(intrusasQueVazaram).toEqual([]);

      // --- 5. A outra metade do antivácuo: as três foram LIDAS ---------------------------------
      //
      // A igualdade de conjunto é cega a repetição — três linhas iguais e três distintas produzem o
      // mesmo conjunto —, e é a contagem do observado que fecha essa fresta.
      expect(selecionadas).toHaveLength(TOTAL_DE_ELEGIVEIS);

      // --- 6. As TRÊS chaves, na ordem declarada pela consulta ---------------------------------
      //
      // A igualdade do corpo inteiro, e não só dos códigos: o `id` é o UUID que o percurso guarda na
      // chave estrangeira composta do evento, e o número do título é por onde se pergunta ao provedor
      // — uma projeção que deixasse qualquer um dos dois de fora passaria por uma asserção feita só
      // sobre o código. A ordem é a do `ORDER BY codigo`, que é o determinismo de que a retomada
      // depende.
      expect([...selecionadas]).toEqual([...ESPERADAS]);

      // --- 7. O recorte é da POLÍTICA, não do parâmetro (ADR-0008) -----------------------------
      //
      // A cobrança de B é elegível em tudo: ela está em aberto e tem boleto. Ela não aparece acima
      // porque a política a esconde — e a chamada sob o contexto de B a devolve, que é o **controle
      // antivácuo** desta perna: sem ele, um predicado que não devolvesse nada para ninguém passaria.
      // Nenhuma assinatura recebeu `empresaId`, e nada na porta comparou empresa com coisa alguma.
      expect(codigos).not.toContain(ELEGIVEL_DE_B.codigo);

      const sobOutraEmpresa = await sobContextoDe(CONTEXTO_DE_B, async (tx) =>
        selecionarCobrancasAConferir(tx),
      );

      expect([...sobOutraEmpresa]).toEqual([
        {
          id: ELEGIVEL_DE_B.id,
          codigo: ELEGIVEL_DE_B.codigo,
          numeroDoTituloNoProvedor: exigirTitulo(ELEGIVEL_DE_B),
        },
      ]);
    },
    LIMITE_DO_CASO_MS,
  );
});

describe('CT-929 (b) — o índice único parcial impede duas conferências concorrentes na mesma empresa', () => {
  it(
    'CT-929 (b) — o segundo disparo de A devolve a mesma conferência, o de B é aceito, e concluir libera',
    async () => {
      // --- 1. A conferência 1 da empresa A, iniciada AGORA e em andamento ---------------------
      const primeira = await sobContextoDe(CONTEXTO_DE_A, async (tx) =>
        abrirConferencia(tx, { solicitadaPor: USUARIO_DE_A.id }),
      );

      expect(primeira.id).toMatch(IDENTIFICADOR_UUID);
      expect(primeira.iniciadaAgora).toBe(true);
      expect(retrato(primeira)).toEqual({
        iniciadaEm: CARIMBO_DO_BANCO,
        // Nulo **é** estar em andamento — não há coluna de estado (ADR-0022).
        concluidaEm: null,
        // Nascem zero porque a linha nasce ANTES do trabalho: nenhuma cobrança pode ter sido
        // percorrida por uma conferência que a instrução acabou de inserir.
        cobrancasConferidas: 0,
        efeitos: 0,
      });

      // A contagem ANTES do segundo disparo — é contra ela que o delta é medido. Ela é lida, e não
      // presumida `1`: outras conferências CONCLUÍDAS podem existir de casos anteriores (o índice
      // parcial não as impede), e um literal aqui faria o caso depender da ordem de execução.
      const antesDoSegundoDisparo = await contarConferencias(CONTEXTO_DE_A);

      // --- 2a. O segundo disparo de A pela PORTA: `200`, e NÃO erro ---------------------------
      //
      // Aqui a recusa **não é falha**: a conferência que o Admin quis já está acontecendo, e o que ele
      // recebe é ela mesma, com `iniciadaAgora: false`. O `id` é asserido por igualdade contra o da
      // primeira — sem isso, uma porta que devolvesse qualquer conferência (ou uma linha nova)
      // passaria por uma asserção feita só sobre o campo booleano.
      const segunda = await sobContextoDe(CONTEXTO_DE_A, async (tx) =>
        abrirConferencia(tx, { solicitadaPor: USUARIO_DE_A.id }),
      );

      expect(segunda.iniciadaAgora).toBe(false);
      expect(segunda.id).toBe(primeira.id);
      expect(retrato(segunda)).toEqual({
        iniciadaEm: CARIMBO_DO_BANCO,
        concluidaEm: null,
        cobrancasConferidas: 0,
        efeitos: 0,
      });

      // --- 2b. E NENHUMA linha nova foi criada --------------------------------------------------
      //
      // A asserção sobre a resposta não bastaria: uma porta que inserisse a segunda linha e devolvesse
      // a primeira passaria nela. A contagem crua **antes e depois** é o que mede o efeito no banco, e
      // o delta zero é o invariante — não o valor absoluto, que depende de quantas conferências
      // concluídas os casos anteriores deixaram.
      expect(await contarConferencias(CONTEXTO_DE_A)).toBe(antesDoSegundoDisparo);

      // E há exatamente UMA em andamento: a leitura em curso alcança no máximo uma linha por empresa
      // pelo índice parcial, e é a primeira que ela devolve.
      const emCursoDeA = exigirConferencia(
        await sobContextoDe(CONTEXTO_DE_A, async (tx) => lerConferenciaEmCurso(tx)),
        'em curso da empresa A',
      );

      expect(emCursoDeA.id).toBe(primeira.id);

      // --- 2c. O mesmo segundo disparo pela instrução CRUA: a recusa é DO BANCO ----------------
      //
      // A mesma inserção que a porta emite, sem o `ON CONFLICT`. Ela prova que quem recusa é o índice,
      // e não um `if` escrito na aplicação — a distinção que uma asserção só sobre a resposta da porta
      // não faria. O nome do índice viaja junto do SQLSTATE porque esta tabela tem outra restrição
      // única (`conferencia_bancaria_id_empresa_key`), e um `23505` sozinho não diz qual delas falou.
      const peloBanco = await tentar(async () =>
        sobContextoDe(CONTEXTO_DE_A, async (tx) => {
          await tx`
            INSERT INTO negocio.conferencia_bancaria (empresa_id, solicitada_por)
            VALUES (nullif(current_setting('app.empresa_id', true), '')::uuid,
                    ${USUARIO_DE_A.id})
          `;
        }),
      );

      expect(desfechoDaTentativa(peloBanco)).toBe(
        `${VIOLACAO_DE_UNICIDADE} · ${INDICE_DA_CONFERENCIA_EM_ANDAMENTO}`,
      );

      // --- 3. A conferência da empresa B é aceita ----------------------------------------------
      //
      // O índice é por empresa: a B abre a dela enquanto a A tem uma em curso. Sem esta perna, um
      // índice único GLOBAL sobre a condição passaria nos passos anteriores.
      const deB = await sobContextoDe(CONTEXTO_DE_B, async (tx) =>
        abrirConferencia(tx, { solicitadaPor: USUARIO_DE_B.id }),
      );

      expect(deB.iniciadaAgora).toBe(true);
      expect(deB.id).not.toBe(primeira.id);

      // A conferência de A não é alcançável sob o contexto de B: a leitura em curso devolve a DELE,
      // sem que nada compare empresa com coisa alguma (ADR-0008).
      const emCursoSobB = exigirConferencia(
        await sobContextoDe(CONTEXTO_DE_B, async (tx) => lerConferenciaEmCurso(tx)),
        'em curso da empresa B',
      );

      expect(emCursoSobB.id).toBe(deB.id);

      // --- 4. A conclusão grava o instante e as DUAS contagens ---------------------------------
      //
      // Os valores são distintos entre si e distintos de zero de propósito: com `30` e `2`, uma porta
      // que trocasse os dois campos, ou que gravasse zero, aparece na igualdade. O par é o que
      // distingue *quantas foram percorridas* de *quantas mudaram* (ADR-0034).
      await sobContextoDe(CONTEXTO_DE_A, async (tx) =>
        concluirConferencia(tx, primeira.id, { cobrancasConferidas: 30, efeitos: 2 }),
      );

      // Concluída, ela deixa de ser a "em curso" — e é isso que devolve o índice parcial à empresa.
      const semEmCurso = await sobContextoDe(CONTEXTO_DE_A, async (tx) =>
        lerConferenciaEmCurso(tx),
      );

      expect(semEmCurso).toBeUndefined();

      const concluida = exigirConferencia(
        await lerConferenciaPorId(CONTEXTO_DE_A, primeira.id),
        'concluída de A',
      );

      expect(retrato(concluida)).toEqual({
        iniciadaEm: CARIMBO_DO_BANCO,
        concluidaEm: CARIMBO_DO_BANCO,
        cobrancasConferidas: 30,
        efeitos: 2,
      });

      // --- 5. Concluída a primeira, uma NOVA de A é aceita — o índice é PARCIAL -----------------
      //
      // É este passo que discrimina índice parcial de índice total: sem ele, um `unique(empresa_id)`
      // sem cláusula `WHERE` passaria em tudo acima — e a empresa conferiria uma vez só, para sempre.
      const terceira = await sobContextoDe(CONTEXTO_DE_A, async (tx) =>
        abrirConferencia(tx, { solicitadaPor: USUARIO_DE_A.id }),
      );

      expect(terceira.iniciadaAgora).toBe(true);
      expect(terceira.id).not.toBe(primeira.id);

      // --- 6. E o disparo do RELÓGIO, sem usuário, é aceito (F5) --------------------------------
      //
      // `solicitada_por` é anulável de propósito, e a coluna só serve se o nulo de fato atravessar: a
      // chave estrangeira composta é `MATCH SIMPLE` e não cobra o par cujo primeiro membro é nulo.
      // Sem esta perna, um `NOT NULL` acrescentado por engano à coluna passaria despercebido até a F5.
      await sobContextoDe(CONTEXTO_DE_A, async (tx) =>
        concluirConferencia(tx, terceira.id, { cobrancasConferidas: 0, efeitos: 0 }),
      );

      const semUsuario = await sobContextoDe(CONTEXTO_DE_A, async (tx) =>
        abrirConferencia(tx, { solicitadaPor: null }),
      );

      expect(semUsuario.iniciadaAgora).toBe(true);

      // As conferências abertas aqui são fechadas: o índice é por empresa e atravessa os casos, e o
      // fecho é a própria afirmação de que `concluirConferencia` o libera (ver o cabeçalho).
      await sobContextoDe(CONTEXTO_DE_A, async (tx) =>
        concluirConferencia(tx, semUsuario.id, { cobrancasConferidas: 0, efeitos: 0 }),
      );
      await sobContextoDe(CONTEXTO_DE_B, async (tx) =>
        concluirConferencia(tx, deB.id, { cobrancasConferidas: 1, efeitos: 0 }),
      );
    },
    LIMITE_DO_CASO_MS,
  );
});

describe('CT-929 (c) — a conclusão confere a linha alcançada e não reescreve contagem já gravada', () => {
  it(
    'CT-929 (c) — concluir sob OUTRA empresa e reconcluir levantam com a classe nomeada',
    async () => {
      const conferencia = await sobContextoDe(CONTEXTO_DE_A, async (tx) =>
        abrirConferencia(tx, { solicitadaPor: USUARIO_DE_A.id }),
      );

      // --- 1. A conclusão sob o contexto de B não alcança a linha e levanta com NOME -----------
      //
      // A política esconde a linha de A sob o contexto de B (ADR-0008), de modo que o `UPDATE` alcança
      // zero linhas. Sem a conferência da linha alcançada, essa chamada resolveria em silêncio e quem
      // percorre seguiria acreditando que fechou — deixando a conferência em andamento para sempre e
      // fazendo todo disparo seguinte da empresa reencontrá-la em vez de iniciar uma nova.
      //
      // O retrato compara a **classe**, a mensagem e o identificador carregado: uma asserção só sobre a
      // mensagem passaria com um `Error` genérico, e é justamente o tipo que a borda do processo de
      // trabalho precisa reconhecer para tratar o reenvio como desfecho benigno.
      const sobOutraEmpresa = await tentar(async () =>
        sobContextoDe(CONTEXTO_DE_B, async (tx) =>
          concluirConferencia(tx, conferencia.id, { cobrancasConferidas: 7, efeitos: 7 }),
        ),
      );

      expect(retratoDaRecusa(sobOutraEmpresa)).toEqual({
        classe: CLASSE_NAO_ALCANCADA,
        dito: RECUSA_DA_CONCLUSAO,
        conferencia: conferencia.id,
      });

      // --- 2. E a conferência de A permanece EM ANDAMENTO, com as contagens intactas ------------
      //
      // A recusa não é só uma mensagem: a escrita de fato não teve efeito, e é isto que impede a
      // asserção acima de ser satisfeita por uma porta que levantasse **depois** de gravar.
      const intacta = exigirConferencia(
        await sobContextoDe(CONTEXTO_DE_A, async (tx) => lerConferenciaEmCurso(tx)),
        'de A depois da tentativa sob B',
      );

      expect(intacta.id).toBe(conferencia.id);
      expect(retrato(intacta)).toEqual({
        iniciadaEm: CARIMBO_DO_BANCO,
        concluidaEm: null,
        cobrancasConferidas: 0,
        efeitos: 0,
      });

      // --- 3. O CONTROLE POSITIVO: a mesma chamada, sob o contexto certo, conclui ---------------
      //
      // Sem ele, uma porta que levantasse **sempre** — quebrando a conclusão legítima do produto —
      // passaria nos dois passos acima. É o par que discrimina, não a asserção negativa isolada.
      await sobContextoDe(CONTEXTO_DE_A, async (tx) =>
        concluirConferencia(tx, conferencia.id, { cobrancasConferidas: 12, efeitos: 3 }),
      );

      // --- 4. A REPETIÇÃO — o percurso do REENVIO — é recusada do mesmo modo --------------------
      //
      // O `conferenciaId` viaja na carga da tarefa (`{ empresaId, conferenciaId }`) e a entrega é
      // *at-least-once*: a tentativa que comitou e caiu antes do reconhecimento volta com o MESMO
      // identificador. Aqui isso é benigno — o fato já está gravado —, e quem sabe disso é o chamador.
      // A camada de dados dá o fato (a linha não foi alcançada) com o tipo que permite decidir.
      //
      // Quem fecha este caminho é `concluida_em IS NULL` na própria instrução: sem ele, a repetição
      // reescreveria as contagens da passada que de fato correu pelas da tentativa que não fez nada.
      const repeticao = await tentar(async () =>
        sobContextoDe(CONTEXTO_DE_A, async (tx) =>
          concluirConferencia(tx, conferencia.id, { cobrancasConferidas: 0, efeitos: 0 }),
        ),
      );

      // --- 5. As contagens da passada que correu SOBREVIVEM, por valor -------------------------
      //
      // É esta asserção — e não a recusa abaixo — que mede o **fato preservado**, e ela vem primeiro
      // por MEDIÇÃO: escrita depois do retrato da recusa, ela ficava **inalcançável** sob o mutante
      // `MT-T5-F` (a cláusula sem `AND concluida_em IS NULL`), porque o Vitest aborta o caso na
      // primeira asserção que reprova. Nessa ordem o mutante acusa o dano real — `12`/`3` reescritos
      // por `0`/`0`, a passada que correu apagada pela que não fez nada —, e não apenas a ausência da
      // recusa.
      const depoisDaRepeticao = exigirConferencia(
        await lerConferenciaPorId(CONTEXTO_DE_A, conferencia.id),
        'de A depois da repetição',
      );

      expect(retrato(depoisDaRepeticao)).toEqual({
        iniciadaEm: CARIMBO_DO_BANCO,
        concluidaEm: CARIMBO_DO_BANCO,
        cobrancasConferidas: 12,
        efeitos: 3,
      });

      // --- 6. E a recusa da repetição é a MESMA classe nomeada ---------------------------------
      //
      // O eixo aqui é o **tipo**, e não o dano: é ele que a borda do processo de trabalho reconhece
      // para tratar o reenvio como desfecho terminal benigno em vez de queimar as tentativas.
      expect(retratoDaRecusa(repeticao)).toEqual({
        classe: CLASSE_NAO_ALCANCADA,
        dito: RECUSA_DA_CONCLUSAO,
        conferencia: conferencia.id,
      });
    },
    LIMITE_DO_CASO_MS,
  );
});
