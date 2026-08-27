/**
 * A **conferência bancária** — o alcance por empresa, a revogação que não cancela e a trilha que
 * registra efeito e nunca tentativa. T12 da fatia `emissao-e-conciliacao`.
 *
 * ===========================================================================
 * INVARIANTES
 * ===========================================================================
 *
 * | Critério | Caso   | Invariante |
 * |----------|--------|------------|
 * | CA-15    | CT-927 | A conferência disparada por um Admin de **A** consulta o provedor
 * |          |        | **exatamente** pelas cobranças elegíveis de A e por **nenhuma** de B —
 * |          |        | medido pela lista de identificadores que a porta recebeu, com igualdade de
 * |          |        | conjunto contra o conjunto de A escrito pelo arranjo, interseção vazia com o
 * |          |        | de B, e o conjunto de B **não-vazio** (controle antivácuo). O estado das
 * |          |        | três de B fica intacto. |
 * | CA-15    | CT-927 | A consulta recusada **não conta** e a classe decide o percurso (RN-02):
 * |          | (b)    | `DA_COBRANCA` segue, `DA_EMPRESA` **cessa** — a porta recebe EXATAMENTE 4
 * |          |        | consultas de 5 cobranças, `cobrancasConferidas === 2`, o efeito anterior ao
 * |          |        | ponto **permanece**, a 5ª fica intocada, e a conferência é **fechada assim
 * |          |        | mesmo**, com `concluida_em` não-nulo e as contagens do que de fato correu. |
 * | CA-17    | CT-930 | Boleto revogado pelo provedor — por motivo **reconhecido** OU por motivo que
 * | CA-20    |        | o produto **não reconhece** —: `cancelado_em IS NULL`, `numero_do_titulo_no_provedor IS
 * |          |        | NULL`, o estado derivado continua em aberto (`VENCIDA` e `A_VENCER`, um de
 * |          |        | cada), `identificador_no_provedor` **sobrevive**, o arquivo sai do disco, e
 * |          |        | cada uma tem **1** evento `{BOLETO_REVOGADO, CONFERENCIA}` com `diagnostico`
 * |          |        | igual **byte a byte** ao texto informado. |
 * | CA-13    | CT-938 | Uma passada que consulta 5 cobranças e encontra **todas como estavam** grava
 * |          |        | **zero** eventos (delta `0` na trilha inteira) e ainda assim fecha com
 * |          |        | `cobrancas_conferidas = 5` e `efeitos = 0`; a passada **seguinte**, com um
 * |          |        | efeito, produz delta `=== 1` e `efeitos = 1`. Nenhum evento de tipo
 * |          |        | `CONFERENCIA` existe — o enum tem **seis** valores e nenhum deles é esse. |
 * | CA-11    | CT-938 | Valor informado diferente do esperado **não impede** a baixa: `pago_em`
 * |          | (b)    | não-nulo, `valor_pago` e `valor_creditado` iguais ao informado, e **dois**
 * |          |        | eventos — o segundo com `valorInformado`. O companheiro do valor **igual**
 * |          |        | grava **um** só. E a repetição da mesma liquidação grava **zero** (§3.3.3). |
 * | CA-12    | CT-938 | O estorno informado pelo provedor apaga os **oito** campos, preserva os três
 * |          | (c)    | de emissão, devolve o estado à **derivação** da visão, e grava **1** evento
 * |          |        | `{LIQUIDACAO_ESTORNADA, CONFERENCIA}`. A passada seguinte, com o provedor
 * |          |        | informando o mesmo estorno, grava **zero** — nada mudou. |
 *
 * Rastreabilidade: `CA-15 → CT-927 (RN-14)` · `CA-15 → CT-927 (b) (RN-02)` ·
 * `CA-17, CA-20 → CT-930 (RN-09, RN-10, RN-15)` · `CA-13 → CT-938 (RN-13)` ·
 * `CA-11 → CT-938 (b) (RN-07)` · `CA-12 → CT-938 (c) (RN-08)`.
 *
 * ===========================================================================
 * Qual asserção DISCRIMINA cada defeito (prova do P4 — aqui é de RACIOCÍNIO)
 * ===========================================================================
 *
 * Todas as asserções deste arquivo são **comportamentais**: exercitam `conferirCobrancas` contra banco
 * real e observam o estado em repouso. A `.claude/rules/testing-stack.md` não lhes cobra prova de
 * falsificação por execução, e o **P4 do Protocolo Antirregressão a PROÍBE** para elas (2026-08-17) —
 * reintroduzir defeito comportamental "para conferir" é campanha de mutantes com outro nome, e
 * mutation testing está fora da stack deste projeto. O que se declara é **qual** asserção discrimina:
 *
 *   * **"alcança só A" vs "alcança as duas empresas"** — a `diferencasDeConjunto` do CT-927 contra o
 *     conjunto de A **escrito pelo arranjo**, mais a interseção vazia com o de B. Uma apuração que
 *     vazasse traria os três títulos de B como `excedentes`, nomeados. O conjunto de B com **3**
 *     elementos é o controle antivácuo: sem ele, uma interseção vazia contra o vazio passaria.
 *   * **"cessou no ponto" vs "consultou tudo e falhou no fim"** — a **contagem exata** de consultas
 *     recebidas (`=== 4`) do CT-927 (b), somada à 5ª cobrança **com boleto intacto**. Uma asserção por
 *     presença de `interrompida` passaria nos dois percursos.
 *   * **"o provedor não apaga valor a receber" vs "o provedor cancela"** — `canceladoEm === null` do
 *     CT-930, lido do banco **depois** da revogação. É a asserção que carrega a métrica nº 1 do PRD, e
 *     é a única que separa este produto do sistema antigo.
 *   * **"o motivo é opaco" vs "algum ramo o lê"** — as **duas** cobranças do CT-930 terminam no mesmo
 *     estado apesar de motivos totalmente diferentes, e o `diagnostico` de cada uma volta byte a byte.
 *     Um `switch` sobre o motivo faria a de `'MOTIVO-INEXISTENTE-99'` cair em ramo diferente da outra,
 *     e a igualdade de corpo inteiro reprovaria. É prova **comportamental** da RN-15 — e é por isso que
 *     este arquivo não varre o texto do fonte atrás de um `switch`.
 *   * **"zero é ausência de efeito" vs "o escritor de eventos está cego"** — o **contraste** entre as
 *     duas passadas do CT-938. A primeira sozinha passaria com um escritor quebrado; é o delta `1` da
 *     segunda que prova que ele funciona.
 *   * **"a divergência não impede" vs "a divergência recusa a baixa"** — `pagoEm` não-nulo do
 *     CT-938 (b), asserido **antes** dos eventos: um SUT que bloqueasse a baixa e só registrasse a
 *     divergência passaria por qualquer asserção que olhasse primeiro a trilha.
 *   * **"a divergência é decidida" vs "todo pagamento vira divergência"** — o companheiro de valor
 *     **igual** do CT-938 (b), com **um** evento só.
 *   * **"o estado volta a derivar" vs "o estorno grava um estado fixo"** — os **dois lados do
 *     vencimento** no mesmo caso, no CT-930 e no CT-938 (c): uma implementação que gravasse estado
 *     acertaria um lado e erraria o outro.
 *
 * ===========================================================================
 * As DATAS do arranjo saem do RELÓGIO DO BANCO — nenhuma é literal (ADR-0026)
 * ===========================================================================
 *
 * Duas asserções deste arquivo são resolvidas por `negocio.data_corrente_da_operacao()`, e nenhuma
 * delas é resolvida por quem escreve o caso: o **predicado** de `selecionarCobrancasAConferir`
 * mantém no conjunto a cobrança paga há `≤ 30 dias`, e a **visão** `cobranca_derivada` classifica em
 * `VENCIDA`/`A_VENCER` comparando `data_vencimento` com o mesmo eixo. Um arranjo com data absoluta
 * ficaria com **dois eixos de dia** — um parado no texto do teste, outro andando —, e a distância
 * entre eles muda de sinal numa data marcada: a partir dela o caso reprova sem que nada tenha mudado
 * no produto, que é o modo de falha que faz um vermelho recorrente deixar de ser lido.
 *
 * Por isso `VENCIMENTO_PASSADO`, `VENCIMENTO_FUTURO` e `DATA_DO_PAGAMENTO` **não são literais**: as
 * três nascem na subida, de {@link dataDeslocada}, que lê o **mesmo** `data_corrente_da_operacao()`
 * do banco e o desloca por `make_interval`. O que cada caso fixa é uma **distância em dias** até o
 * eixo que decide, e não uma data. **Nenhum `new Date()` participa do arranjo** — o relógio do
 * processo seria o segundo eixo que a ADR-0026 existe para fechar, e sob `TZ=UTC` a virada do dia
 * cairia até três horas fora do lugar.
 *
 * ⚠️ **Isto não afrouxa asserção nenhuma.** `ESTADO_VENCIDA`/`ESTADO_A_VENCER` e as contagens seguem
 * escritos por extenso, valor a valor; o que muda é que passam a ser verdadeiros **em qualquer dia**.
 * É a mesma disciplina de `packages/db/test/conferencia-bancaria.spec.ts` — a suíte que prova o outro
 * lado deste mesmo predicado.
 *
 * ===========================================================================
 * O DUBLÊ é IMPLEMENTAÇÃO da porta — nunca `vi.mock`
 * ===========================================================================
 *
 * {@link adaptadorQueResponde} satisfaz `AdaptadorCobrancaBancaria` com a mesma assinatura pela qual a
 * produção é exercitada, no molde do CT-933 de `./vocabulario-canonico.spec.ts` e do dublê de
 * `./emissao-em-lote.spec.ts`. O que ele substitui é a **fronteira externa** — o HTTP do provedor —,
 * que é exatamente o que a porta da ADR-0001 existe para permitir trocar. Nenhuma bandeira, ramo ou
 * parâmetro de teste foi acrescentado ao adaptador de produção, e este arquivo não tem caminho para
 * construí-lo.
 *
 * ⚠️ **Ele é AGNÓSTICO na captura**: registra **toda** consulta recebida, na ordem em que chega, sem
 * filtrar por título nem por tipo. Quem discrimina é a asserção — um acessório que colhesse só o que o
 * caso espera tornaria a igualdade de conjunto infalível (AP-29), que foi o bloqueante da T9 desta
 * fatia.
 *
 * ⚠️ **Ele decide por TÍTULO, e não por posição de chamada.** A diferença em relação ao dublê do lote
 * é o que a porta carrega: `PedidoDeEmissao` não nomeia a cobrança, e `ConsultaDeSituacao` nomeia — o
 * `numeroDoTituloNoProvedor` é justamente o eixo do caso. Decidir por posição aqui esconderia a
 * correspondência que o CT-927 existe para medir.
 *
 * ⚠️ **As três operações que a apuração não usa LEVANTAM.** Não é zelo: é asserção. Uma apuração que
 * emitisse ou pedisse revogação derrubaria o caso no ponto, em vez de passar despercebida.
 *
 * ⚠️ **A GUARDA é a de produção**, sobre um diretório descartável do sistema. Ela não é fronteira a
 * substituir — é filesystem real, e é o que faz *"o arquivo saiu do disco"* ser fato observável em vez
 * de um valor combinado entre teste e teste.
 *
 * ===========================================================================
 * As PORTAS DE DADOS são satisfeitas pelas funções REAIS de `@sysloc/db`
 * ===========================================================================
 *
 * `valorEsperado`, `gravarLiquidacao`, `gravarEstorno`, `gravarRevogacao` e `concluir` são satisfeitas
 * exatamente como a borda da tarefa (T16) as satisfará: por **aplicação parcial**, cada uma abrindo a
 * própria unidade de trabalho sob o contexto de tenant, no molde literal de
 * `apps/worker/src/tarefas/regua.ts`. É o que faz este arquivo provar o **caminho**, e não apenas a
 * função — e é o que torna o estado asserido um **side-effect em repouso no banco**.
 *
 * ⚠️ **A precondição privilegiada — o contexto de tenant — vem da unidade de trabalho REAL**
 * (`contextoDeTenant.executarCom` mais `acesso.emUnidadeDeTrabalho`), como em
 * `packages/db/test/isolamento.spec.ts`. Nenhuma assinatura de produção recebeu `empresaId`, e
 * **nenhuma consulta deste arquivo escreve `WHERE empresa_id`**: quem recorta é a política (ADR-0008).
 *
 * ===========================================================================
 * A CARTEIRA é preparada por caso, e a razão é o predicado
 * ===========================================================================
 *
 * Diferente do lote — cujo conjunto é recortado por **competência**, o que dá a cada caso um universo
 * próprio de graça —, o conjunto a conferir é *"toda cobrança da empresa com boleto, em aberto ou paga
 * há ≤ 30 dias"*, **sem eixo por onde separar os casos**. Por isso {@link prepararCarteira} aposenta o
 * que restou do caso anterior **pela porta de produção `revogarBoleto`** (a mesma que a apuração usa),
 * e não por um `DELETE`: a cobrança sem boleto sai do conjunto **por construção**, que é o que o
 * docblock de `selecionarCobrancasAConferir` declara. Cada caso começa, portanto, de uma carteira
 * vazia — e a igualdade que abre cada um o afirma em vez de supor.
 *
 * ===========================================================================
 * De onde vêm o banco e o diretório (ADR-0006)
 * ===========================================================================
 *
 * De uma instância efêmera **própria**, migrada e semeada, descartada ao fim, e de um diretório
 * temporário do sistema, removido no fecho. Nenhuma coordenada de conexão é lida do ambiente — a
 * suíte nunca toca o banco que atende a operação.
 */

import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  type AcessoAoBanco,
  abrirAcessoAoBanco,
  abrirConferencia,
  concluirConferencia,
  contextoDeTenant,
  EMPRESA_A,
  EMPRESA_B,
  estornarLiquidacao,
  gravarBoletoDaCobranca,
  type LinhaDeCobranca,
  liquidarPeloProvedor,
  localizarCobranca,
  registrarEventoBancario,
  revogarBoleto,
  selecionarCobrancasAConferir,
  USUARIOS,
  type UsuarioSemeado,
} from '@sysloc/db';
import { criarSegredoOperavel } from '@sysloc/shared';
import { TIPOS_DE_EVENTO_BANCARIO } from '@syslocbr/contracts';
import type { TransactionSql } from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
// DÉBITO COM GATILHO — D28 · F0/T5 · gatilho JÁ DISPARADO (F1/T2, 2026-08-02)
// (NÃO é uma `DECISÃO FECHADA`: ele agenda uma mudança, não protege o código abaixo.)
// O QUÊ: o import a seguir atravessa a fronteira de `@sysloc/db` por CAMINHO DE ARQUIVO, fora do
//        `exports` e do `files` daquele manifesto. A dependência de workspace está declarada — em
//        `devDependencies`, ver o `"//"` do `package.json` —, então não há dependência oculta; o que
//        não existe é FRONTEIRA para os diretórios `test/`.
// QUANDO FECHA: o gatilho já disparou e o fechamento segue pendente; ele é o mesmo de sempre —
//        declarar o subpath `"./test"` nos manifestos e importar por `@sysloc/<pacote>/test`, ou
//        extrair um `@sysloc/test-utils`.
// POR QUE NÃO AGORA: fechar exige editar os manifestos de vários pacotes e todos os consumidores,
//        nenhum deles no escopo desta task, e o índice de débitos do `CLAUDE.md`.
// ÍNDICE: docs/specs/features/fundacao-stack-nativa/v1/_run/run-report.md §2, D28
import { type BancoMigrado, bancoEfemero } from '../../db/test/banco-efemero.ts';
import {
  type CobrancaAConferir,
  conferirCobrancas,
  type DesfechoDaConferencia,
  type TrabalhoDaConferencia,
} from '../src/conferencia.ts';
import { criarGuardaDeBoletos } from '../src/guarda-de-boletos.ts';
// Os tipos vêm do vocabulário canônico, e não de recortes reescritos aqui: a lista de consultas
// capturadas carrega o tipo REAL que atravessa a porta, e a classe da falha é a união fechada — um
// literal escrito à mão aceitaria uma classe que o domínio não conhece.
import type {
  ClasseDaFalha,
  ConsultaDeSituacao,
  SituacaoConsultada,
} from '../src/modelo-canonico.ts';
import type { AdaptadorCobrancaBancaria } from '../src/porta-de-cobranca.ts';
import { diferencasDeConjunto } from './conjuntos.ts';
import { IDENTIDADE_DE_TESTE } from './material-de-teste.ts';

// ---------------------------------------------------------------------------
// Limites de tempo — constantes nomeadas, nunca número mágico no meio do caso
// ---------------------------------------------------------------------------

/** Subir a instância, provisionar papéis, migrar e semear leva dezenas de segundos nesta máquina. */
const LIMITE_SUBIDA_MS = 150_000;

/** Cada caso percorre até seis cobranças, e cada uma abre até três unidades de trabalho. */
const LIMITE_DO_CASO_MS = 120_000;

/** Reserva de conexões: o arranjo e a apuração tocam o banco em unidades sequenciais. */
const RESERVA_DE_CONEXOES = 2;

// ---------------------------------------------------------------------------
// Os atores da carga inicial — derivados dela, nunca redigitados
// ---------------------------------------------------------------------------

/**
 * O usuário que dispara as conferências de cada empresa.
 *
 * **Derivado da carga**, e não um literal reescrito aqui: o par `(usuario, empresa)` que
 * `conferencia_bancaria_usuario_empresa_fkey` cobra é o mesmo que `semente.ts` gravou, e copiar o
 * identificador criaria uma segunda declaração livre para divergir.
 */
function exigirUsuarioDa(empresaId: string): UsuarioSemeado {
  const usuario = USUARIOS.find((candidato) => candidato.empresaId === empresaId);
  if (usuario === undefined) {
    throw new Error(`a carga inicial não tem usuário da empresa ${empresaId}`);
  }
  return usuario;
}

/** Uma empresa sob apuração, com o usuário que dispara e os cadastros de apoio dela. */
interface Cenario {
  readonly empresaId: string;
  readonly usuarioId: string;
  readonly conjuntoId: string;
  readonly imovelId: string;
  readonly locadorId: string;
  readonly locatarioId: string;
  readonly contratoId: string;
  readonly codigoDoContrato: string;
}

const CENARIO_DE_A: Cenario = {
  empresaId: EMPRESA_A.id,
  usuarioId: exigirUsuarioDa(EMPRESA_A.id).id,
  conjuntoId: 'aaaaaaaa-9270-4000-8000-000000000001',
  imovelId: 'aaaaaaaa-9270-4000-8000-000000000002',
  locadorId: 'aaaaaaaa-9270-4000-8000-000000000003',
  locatarioId: 'aaaaaaaa-9270-4000-8000-000000000004',
  contratoId: 'aaaaaaaa-9270-4000-8000-000000000005',
  codigoDoContrato: 'CTR-2026-92701',
};

const CENARIO_DE_B: Cenario = {
  empresaId: EMPRESA_B.id,
  usuarioId: exigirUsuarioDa(EMPRESA_B.id).id,
  conjuntoId: 'bbbbbbbb-9270-4000-8000-000000000001',
  imovelId: 'bbbbbbbb-9270-4000-8000-000000000002',
  locadorId: 'bbbbbbbb-9270-4000-8000-000000000003',
  locatarioId: 'bbbbbbbb-9270-4000-8000-000000000004',
  contratoId: 'bbbbbbbb-9270-4000-8000-000000000005',
  codigoDoContrato: 'CTR-2026-92702',
};

// ---------------------------------------------------------------------------
// O arranjo — os dados escritos por extenso
// ---------------------------------------------------------------------------

/**
 * A competência das cobranças — primeiro dia do mês, como o `check` do banco exige.
 *
 * Ela **pode** ser literal porque nada a confronta com o relógio: `competencia` não entra em
 * predicado de seleção, não é derivada pela visão e não é asserida por caso algum — o `check` que
 * ela satisfaz olha só o dia do mês. O mesmo vale para o `data_inicio_locacao` do contrato de apoio.
 * As datas que o **relógio decide** estão logo abaixo, e nenhuma delas é literal.
 */
const COMPETENCIA = '2026-01-01';

/**
 * Quanto os vencimentos e o pagamento do arranjo distam da data corrente da operação, em dias.
 *
 * **O sinal é conteúdo**: negativo é passado, positivo é futuro. O que cada caso fixa é a distância
 * até o eixo que decide — nunca uma data —, e distância não envelhece.
 */
const DESLOCAMENTO_DO_VENCIMENTO_PASSADO = -30;
const DESLOCAMENTO_DO_VENCIMENTO_FUTURO = 30;

/**
 * O pagamento fica **confortavelmente dentro** da janela de 30 dias do predicado de seleção.
 *
 * A folga é conteúdo: o `CT-938 (b)` e o `CT-938 (c)` **só existem** porque a cobrança volta a ser
 * conferida depois de paga, e é `pago_em >= data corrente - INTERVAL '30 days'` que a mantém no
 * conjunto. Cinco dias deixa a passada seguinte longe da borda em qualquer dia de execução.
 */
const DESLOCAMENTO_DO_PAGAMENTO = -5;

/**
 * Um vencimento **passado**, que a visão deriva como `VENCIDA`.
 *
 * Preenchido na subida a partir de {@link dataDeslocada} — ver a seção do cabeçalho sobre o relógio.
 */
let VENCIMENTO_PASSADO: string;

/**
 * Um vencimento **futuro**, que a visão deriva como `A_VENCER`.
 *
 * Preenchido na subida a partir de {@link dataDeslocada} — ver a seção do cabeçalho sobre o relógio.
 */
let VENCIMENTO_FUTURO: string;

/** O valor de cada cobrança, em `numeric(15,2)` — texto, como a coluna o guarda. */
const VALOR_ORIGINAL = '1500.00';

/** Os dois rótulos que a visão publica para cobrança **em aberto** — o que a revogação preserva. */
const ESTADO_VENCIDA = 'VENCIDA';
const ESTADO_A_VENCER = 'A_VENCER';

/** O cadastro do locatário — a cadeia inteira é `NOT NULL` até a cobrança. */
const CADASTRO = {
  logradouro: 'Rua das Acácias',
  numero: '300',
  bairro: 'Centro',
  cidade: 'Teresina',
  estado: 'PI',
  cep: '64000000',
} as const;

/** O que o arranjo antepõe aos bytes do boleto, para que eles sejam reconhecíveis no disco. */
const PREFIXO_DO_DOCUMENTO = '%PDF-boleto-';

/**
 * O motivo de revogação que o produto **reconheceria** se tivesse um vocabulário para isso.
 *
 * Ele é texto do provedor, e o produto não o mapeia: é justamente por não haver enum que a RN-15
 * torna o desconhecido inócuo.
 */
const MOTIVO_RECONHECIDO = 'baixa por solicitacao do beneficiario';

/** Um motivo **fora de qualquer vocabulário do produto** — o dado que o CT-930 fixa. */
const MOTIVO_DESCONHECIDO = 'MOTIVO-INEXISTENTE-99';

/** O texto com que o provedor recusa a consulta por causa da **cobrança** (RN-02). */
const RECUSA_DA_COBRANCA = 'titulo nao localizado para o convenio informado';

/** O texto com que o provedor recusa a consulta por causa da **empresa** (RN-02). */
const RECUSA_DA_EMPRESA = 'certificado da empresa inservivel para o ambiente do provedor';

/**
 * A data que o provedor informa como a do pagamento — cadeia `YYYY-MM-DD`, nunca `Date`.
 *
 * Preenchida na subida a partir de {@link dataDeslocada} — ver a seção do cabeçalho sobre o relógio.
 */
let DATA_DO_PAGAMENTO: string;

/** Um valor **diferente** do esperado, para a divergência da CA-11. */
const VALOR_DIVERGENTE = 1000;

// ---------------------------------------------------------------------------
// Estado do arquivo
// ---------------------------------------------------------------------------

let banco: BancoMigrado;
let acesso: AcessoAoBanco;
let diretorioDosBoletos: string;

/** Contador que mantém códigos e identificadores distintos entre todos os casos e as duas empresas. */
let sequenciaDaCobranca = 0;

// ---------------------------------------------------------------------------
// Acessórios de arranjo — todo estado nasce pelo caminho legítimo
// ---------------------------------------------------------------------------

/**
 * Executa o trabalho sob o contexto da empresa do cenário, dentro de uma unidade de trabalho.
 *
 * É o **único** caminho por onde este arquivo alcança o banco: `executarCom` mais
 * `emUnidadeDeTrabalho`, o mesmo par da operação. Nenhum `SET app.empresa_id` é escrito à mão, e
 * nenhuma consulta compara empresa com coisa alguma.
 */
async function emUnidade<T>(
  cenario: Cenario,
  trabalho: (tx: TransactionSql) => Promise<T>,
): Promise<T> {
  return await contextoDeTenant.executarCom(
    { empresaId: cenario.empresaId },
    async () => await acesso.emUnidadeDeTrabalho(trabalho),
  );
}

/**
 * A data corrente da operação deslocada em `dias`, como cadeia `YYYY-MM-DD`.
 *
 * **É assim que toda data deste arranjo é posicionada**: o relógio nunca é falseado, o dado é que se
 * move. A leitura sai do **mesmo** `negocio.data_corrente_da_operacao()` que o predicado de
 * `selecionarCobrancasAConferir` compara e que a visão `cobranca_derivada` consulta — nunca de
 * `new Date()` do processo, que é o segundo eixo de dia que a ADR-0026 fecha. Mesma forma, e mesma
 * razão, de `dataDeslocada` em `packages/db/test/conferencia-bancaria.spec.ts` (CT-929) e em
 * `packages/db/test/envio-de-cobranca.spec.ts`.
 *
 * O sinal viaja no argumento: `dias` negativo é passado, positivo é futuro.
 */
async function dataDeslocada(cenario: Cenario, dias: number): Promise<string> {
  return await emUnidade(cenario, async (tx) => {
    const [linha] = await tx<{ data: string }[]>`
      SELECT to_char(
               negocio.data_corrente_da_operacao() + make_interval(days => ${dias}),
               'YYYY-MM-DD'
             ) AS data
    `;

    if (linha === undefined) {
      throw new Error('o relógio do banco não devolveu a data corrente da operação');
    }

    return linha.data;
  });
}

/** Semeia a cadeia de cadastros que a cobrança exige — conjunto, imóvel, as duas pessoas, contrato. */
async function semearApoio(cenario: Cenario): Promise<void> {
  await emUnidade(cenario, async (tx) => {
    await tx`
      INSERT INTO negocio.conjunto (id, empresa_id, nome)
      VALUES (${cenario.conjuntoId}, ${cenario.empresaId}, ${'Conjunto da conferência'})
    `;
    await tx`
      INSERT INTO negocio.imovel
                  (id, empresa_id, conjunto_id, nome_imovel, identificador_municipal, tipo_imovel,
                   logradouro, numero, complemento, bairro, cidade, estado, cep, status_locacao)
      VALUES (${cenario.imovelId}, ${cenario.empresaId}, ${cenario.conjuntoId},
              ${'Imóvel da conferência'}, ${`IM-CONF-${cenario.empresaId.slice(0, 8)}`},
              ${'RESIDENCIAL'}::negocio.tipo_imovel,
              ${CADASTRO.logradouro}, ${CADASTRO.numero}, ${null}, ${CADASTRO.bairro},
              ${CADASTRO.cidade}, ${CADASTRO.estado}, ${CADASTRO.cep},
              ${'DISPONIVEL'}::negocio.status_locacao)
    `;
    await tx`
      INSERT INTO negocio.locador
                  (id, empresa_id, nome, tipo_pessoa, documento_principal, rg, email, telefone,
                   logradouro, numero, complemento, bairro, cidade, estado, cep)
      VALUES (${cenario.locadorId}, ${cenario.empresaId}, ${'Locador da conferência'},
              ${'PESSOA_FISICA'}::negocio.tipo_pessoa, ${'98765432100'}, ${null},
              ${`locador.${cenario.empresaId.slice(0, 8)}@exemplo.com.br`}, ${'8699990000'},
              ${CADASTRO.logradouro}, ${CADASTRO.numero}, ${null}, ${CADASTRO.bairro},
              ${CADASTRO.cidade}, ${CADASTRO.estado}, ${CADASTRO.cep})
    `;
    await tx`
      INSERT INTO negocio.locatario
                  (id, empresa_id, nome, tipo_pessoa, documento_principal, rg, email, telefone,
                   logradouro, numero, complemento, bairro, cidade, estado, cep)
      VALUES (${cenario.locatarioId}, ${cenario.empresaId}, ${'Locatário da conferência'},
              ${'PESSOA_FISICA'}::negocio.tipo_pessoa, ${'12345678901'}, ${null},
              ${`locatario.${cenario.empresaId.slice(0, 8)}@exemplo.com.br`}, ${'8699990001'},
              ${CADASTRO.logradouro}, ${CADASTRO.numero}, ${null}, ${CADASTRO.bairro},
              ${CADASTRO.cidade}, ${CADASTRO.estado}, ${CADASTRO.cep})
    `;
    // `RASCUNHO` de propósito: o índice parcial `contrato_imovel_vigente_uidx` só alcança `ATIVO`, e
    // o que este arquivo mede não é a vigência única.
    await tx`
      INSERT INTO negocio.contrato
                  (id, empresa_id, codigo, imovel_id, locador_id, locatario_id, status,
                   data_inicio_locacao, prazo_meses, valor_mensal, dia_vencimento)
      VALUES (${cenario.contratoId}, ${cenario.empresaId}, ${cenario.codigoDoContrato},
              ${cenario.imovelId}, ${cenario.locadorId}, ${cenario.locatarioId},
              ${'RASCUNHO'}::negocio.status_contrato, ${'2026-01-10'}::date, ${12},
              ${VALOR_ORIGINAL}, ${10})
    `;
  });
}

/** Uma cobrança elegível do arranjo — o código, o título vivo e o identificador que o produto enviou. */
interface CobrancaSemeada {
  readonly codigo: string;
  readonly numeroDoTituloNoProvedor: string;
  readonly identificadorNoProvedor: string;
  readonly nomeDoArquivo: string;
}

/**
 * Aposenta tudo o que ainda é elegível na empresa do cenário — pela porta de produção.
 *
 * `revogarBoleto` é a mesma porta que a apuração usa, e é ela que tira a cobrança do conjunto: sem
 * `numero_do_titulo_no_provedor`, o primeiro termo do predicado deixa de alcançá-la. Ver o cabeçalho para por que a
 * carteira precisa ser preparada por caso.
 */
async function esvaziarCarteira(cenario: Cenario): Promise<void> {
  await emUnidade(cenario, async (tx) => {
    for (const cobranca of await selecionarCobrancasAConferir(tx)) {
      await revogarBoleto(tx, cobranca.codigo);
    }
  });
}

/**
 * Prepara a carteira do caso: esvazia a anterior e semeia `vencimentos.length` cobranças **com
 * boleto**, na ordem dos vencimentos informados.
 *
 * Os bytes do boleto são gravados pela **guarda de produção**, e o caminho que ela devolve é o que a
 * coluna guarda — é isso que faz *"o arquivo saiu do disco"* ser observável.
 */
async function prepararCarteira(
  cenario: Cenario,
  vencimentos: readonly string[],
): Promise<CobrancaSemeada[]> {
  await esvaziarCarteira(cenario);

  const guarda = criarGuardaDeBoletos(diretorioDosBoletos);
  const semeadas: CobrancaSemeada[] = [];

  for (const vencimento of vencimentos) {
    sequenciaDaCobranca += 1;
    const ordem = String(sequenciaDaCobranca).padStart(7, '0');
    const codigo = `COB-2026-${ordem}`;
    const numeroDoTituloNoProvedor = `T-${ordem}`;
    const identificadorNoProvedor = `00000000000${ordem}`;
    const nomeDoArquivo = await guarda.gravar(
      codigo,
      Buffer.from(`${PREFIXO_DO_DOCUMENTO}${ordem}`),
    );

    await emUnidade(cenario, async (tx) => {
      await tx`
        INSERT INTO negocio.cobranca
                    (empresa_id, codigo, contrato_id, natureza, referencia, competencia,
                     data_vencimento, valor_original)
        VALUES (${cenario.empresaId}, ${codigo}, ${cenario.contratoId},
                ${'ALUGUEL'}::negocio.natureza_cobranca, ${'Aluguel da conferência'},
                ${COMPETENCIA}::date, ${vencimento}::date, ${VALOR_ORIGINAL})
      `;

      await gravarBoletoDaCobranca(tx, codigo, {
        numeroDoTituloNoProvedor,
        linhaDigitavel: `L-${ordem}`,
        codigoDeBarras: `B-${ordem}`,
        identificadorNoProvedor,
        caminhoDoArquivo: nomeDoArquivo,
      });
    });

    semeadas.push({ codigo, numeroDoTituloNoProvedor, identificadorNoProvedor, nomeDoArquivo });
  }

  return semeadas;
}

// ---------------------------------------------------------------------------
// O dublê — IMPLEMENTAÇÃO da porta, que decide por TÍTULO e captura tudo
// ---------------------------------------------------------------------------

/** O que o provedor responde sobre um título: a situação traduzida, ou a recusa classificada. */
type RespostaDoProvedor =
  | { readonly situacao: SituacaoConsultada }
  | { readonly recusa: { readonly classe: ClasseDaFalha; readonly motivo: string } };

/** O adaptador de teste, com as consultas que chegaram a ele — a lista prova o que NÃO foi perguntado. */
interface AdaptadorDeTeste {
  readonly porta: AdaptadorCobrancaBancaria;
  readonly consultas: readonly ConsultaDeSituacao[];
}

/**
 * A operação que a apuração **não** deve chamar — levanta nomeando-se.
 *
 * É asserção, e não zelo: uma apuração que emitisse ou pedisse revogação derrubaria o caso no ponto,
 * em vez de passar despercebida por ninguém ter olhado.
 */
function operacaoNaoEsperada(nome: string): () => Promise<never> {
  return async () => {
    throw new Error(`a conferência chamou uma operação que ela não deve chamar: ${nome}`);
  };
}

/** A resposta padrão: o título está de pé e ninguém o pagou — **nada mudou**. */
const NADA_MUDOU: SituacaoConsultada = { situacao: 'EM_ABERTO', documento: null };

/**
 * Uma implementação de `AdaptadorCobrancaBancaria` que responde conforme o **título** consultado.
 *
 * O que não está no mapa responde {@link NADA_MUDOU}, que é o desfecho comum da apuração real. A
 * captura é **agnóstica**: toda consulta entra na lista, na ordem em que chega, sem filtro algum.
 */
function adaptadorQueResponde(
  respostas: ReadonlyMap<string, RespostaDoProvedor>,
): AdaptadorDeTeste {
  const consultas: ConsultaDeSituacao[] = [];

  const porta: AdaptadorCobrancaBancaria = {
    consultarSituacao: async (consulta) => {
      consultas.push(consulta);
      const resposta = respostas.get(consulta.numeroDoTituloNoProvedor);

      if (resposta !== undefined && 'recusa' in resposta) {
        return { aceito: false, classe: resposta.recusa.classe, motivo: resposta.recusa.motivo };
      }

      return { aceito: true, valor: resposta?.situacao ?? NADA_MUDOU };
    },
    emitir: operacaoNaoEsperada('emitir'),
    solicitarRevogacaoDeBoleto: operacaoNaoEsperada('solicitarRevogacaoDeBoleto'),
    confirmarRevogacaoDeBoleto: operacaoNaoEsperada('confirmarRevogacaoDeBoleto'),
  };

  return { porta, consultas };
}

// ---------------------------------------------------------------------------
// A fiação — as portas de dados satisfeitas como a borda da tarefa (T16) as satisfará
// ---------------------------------------------------------------------------

/**
 * O segredo que atravessa a porta, opaco (ADR-0032).
 *
 * Construído pelo caminho público de `@sysloc/shared`, e nada neste arquivo o abre: quem o abriria é o
 * adaptador de produção, que este arquivo não constrói.
 */
const SEGREDO_DA_EMPRESA = criarSegredoOperavel({
  material: Buffer.from('material-de-verificacao'),
  senha: 'senha-de-verificacao',
});

/**
 * Dinheiro em **cadeia**, como `numeric(15,2)` o recebe.
 *
 * A conversão mora **aqui**, em quem satisfaz a porta, e não no domínio: o vocabulário canônico
 * declara o valor como número, e é esta camada que já traduz o resto do vocabulário para o banco.
 */
function emCadeiaDeDinheiro(valor: number): string {
  return valor.toFixed(2);
}

/**
 * Abre a conferência e devolve o `TrabalhoDaConferencia` inteiro, pronto para apurar.
 *
 * As cinco portas são fechadas por **aplicação parcial** sobre o cenário e sobre o
 * `conferenciaId` — é a borda que decide sob que contexto e em que unidade de trabalho cada escrita
 * corre. É por isso que `TrabalhoDaConferencia` não tem `conferenciaId`: não há por onde a apuração
 * alcançar outra conferência.
 */
async function montarTrabalho(
  cenario: Cenario,
  adaptador: AdaptadorCobrancaBancaria,
): Promise<{ trabalho: TrabalhoDaConferencia; conferenciaId: string }> {
  const conferencia = await emUnidade(
    cenario,
    async (tx) => await abrirConferencia(tx, { solicitadaPor: cenario.usuarioId }),
  );

  if (!conferencia.iniciadaAgora) {
    throw new Error(
      'o arranjo encontrou uma conferência em andamento que o caso anterior não fechou',
    );
  }

  const cobrancas = await emUnidade(cenario, selecionarCobrancasAConferir);
  const conferenciaId = conferencia.id;

  return {
    conferenciaId,
    trabalho: {
      empresaId: cenario.empresaId,
      segredo: SEGREDO_DA_EMPRESA,
      identidade: IDENTIDADE_DE_TESTE,
      cobrancas: cobrancas.map(({ id, codigo, numeroDoTituloNoProvedor }) => ({
        id,
        codigo,
        numeroDoTituloNoProvedor,
      })),
      adaptador,
      guarda: criarGuardaDeBoletos(diretorioDosBoletos),
      valorEsperado: async (cobranca: CobrancaAConferir) =>
        await emUnidade(cenario, async (tx) => {
          const linha = await localizarCobranca(tx, cobranca.codigo);
          if (linha === undefined) {
            throw new Error(`o arranjo não encontrou a cobrança ${cobranca.codigo}`);
          }
          // `valorTotal` é o total DERIVADO pela visão (ADR-0022) — original mais a mora vigente —, e
          // é ele que se esperava receber. Nada aqui calcula: a derivação é do banco.
          return linha.valorTotal;
        }),
      // UMA unidade de trabalho: a baixa, o evento da liquidação e — quando houve divergência — o
      // segundo evento.
      gravarLiquidacao: async (cobranca, liquidacao) =>
        await emUnidade(cenario, async (tx) => {
          const desfecho = await liquidarPeloProvedor(tx, cobranca.codigo, {
            pagoEm: liquidacao.pagoEm,
            valorPago: emCadeiaDeDinheiro(liquidacao.valorPago),
            dataDoCredito: liquidacao.dataDoCredito,
            valorCreditado: emCadeiaDeDinheiro(liquidacao.valorCreditado),
          });

          if (desfecho !== 'LIQUIDADA') {
            return desfecho;
          }

          await registrarEventoBancario(tx, {
            cobrancaId: cobranca.id,
            tipo: 'COBRANCA_LIQUIDADA',
            origem: 'CONFERENCIA',
          });

          if (liquidacao.divergente) {
            await registrarEventoBancario(tx, {
              cobrancaId: cobranca.id,
              tipo: 'DIVERGENCIA_DE_VALOR',
              origem: 'CONFERENCIA',
              valorInformado: emCadeiaDeDinheiro(liquidacao.valorPago),
            });
          }

          return desfecho;
        }),
      gravarEstorno: async (cobranca) =>
        await emUnidade(cenario, async (tx) => {
          const desfecho = await estornarLiquidacao(tx, cobranca.codigo);

          if (desfecho === 'ESTORNADA') {
            await registrarEventoBancario(tx, {
              cobrancaId: cobranca.id,
              tipo: 'LIQUIDACAO_ESTORNADA',
              origem: 'CONFERENCIA',
            });
          }

          return desfecho;
        }),
      gravarRevogacao: async (cobranca, motivo) =>
        await emUnidade(cenario, async (tx) => {
          const aplicada = await revogarBoleto(tx, cobranca.codigo);

          if (aplicada.desfecho === 'REVOGADO') {
            await registrarEventoBancario(tx, {
              cobrancaId: cobranca.id,
              tipo: 'BOLETO_REVOGADO',
              origem: 'CONFERENCIA',
              // O motivo do provedor viaja INTACTO até a coluna de diagnóstico (RN-15).
              diagnostico: motivo,
            });
          }

          return aplicada.desfecho;
        }),
      concluir: async (contagens) => {
        await emUnidade(cenario, async (tx) => {
          await concluirConferencia(tx, conferenciaId, contagens);
        });
      },
    },
  };
}

/** Roda uma apuração inteira sobre a carteira corrente do cenário. */
async function apurar(
  cenario: Cenario,
  respostas: ReadonlyMap<string, RespostaDoProvedor>,
): Promise<{
  desfecho: DesfechoDaConferencia;
  adaptador: AdaptadorDeTeste;
  conferenciaId: string;
  cobrancas: readonly CobrancaAConferir[];
}> {
  const adaptador = adaptadorQueResponde(respostas);
  const { trabalho, conferenciaId } = await montarTrabalho(cenario, adaptador.porta);
  const desfecho = await conferirCobrancas(trabalho);

  return { desfecho, adaptador, conferenciaId, cobrancas: trabalho.cobrancas };
}

// ---------------------------------------------------------------------------
// Coleta — o estado em repouso, lido do banco SEM cláusula de empresa (ADR-0008)
// ---------------------------------------------------------------------------

/** O que a conferência gravou ao se fechar — o fato cru, sem derivação. */
interface ConferenciaGravada {
  readonly concluida: boolean;
  readonly cobrancasConferidas: number;
  readonly efeitos: number;
}

async function conferenciaGravada(
  cenario: Cenario,
  conferenciaId: string,
): Promise<ConferenciaGravada> {
  return await emUnidade(cenario, async (tx) => {
    const [linha] = await tx<
      { concluidaEm: Date | null; cobrancasConferidas: number; efeitos: number }[]
    >`
      SELECT concluida_em AS "concluidaEm",
             cobrancas_conferidas AS "cobrancasConferidas",
             efeitos
        FROM negocio.conferencia_bancaria
       WHERE id = ${conferenciaId}
    `;

    if (linha === undefined) {
      throw new Error(
        `a conferência ${conferenciaId} não foi encontrada sob o contexto do arranjo`,
      );
    }

    return {
      concluida: linha.concluidaEm !== null,
      cobrancasConferidas: linha.cobrancasConferidas,
      efeitos: linha.efeitos,
    };
  });
}

/** Os dois campos internos que a projeção publicada **não** entrega — lidos crus da tabela. */
interface CamposInternos {
  readonly identificadorNoProvedor: string | null;
  readonly caminhoDoArquivo: string | null;
}

async function camposInternosDe(cenario: Cenario, codigo: string): Promise<CamposInternos> {
  return await emUnidade(cenario, async (tx) => {
    const [linha] = await tx<CamposInternos[]>`
      SELECT identificador_no_provedor AS "identificadorNoProvedor",
             boleto_arquivo AS "caminhoDoArquivo"
        FROM negocio.cobranca
       WHERE codigo = ${codigo}
    `;

    if (linha === undefined) {
      throw new Error(`a cobrança ${codigo} sumiu do banco entre o arranjo e a leitura`);
    }

    return {
      identificadorNoProvedor: linha.identificadorNoProvedor,
      caminhoDoArquivo: linha.caminhoDoArquivo,
    };
  });
}

/** Um evento da trilha bancária, como a tabela o guarda. */
interface EventoLido {
  readonly codigo: string;
  readonly tipo: string;
  readonly origem: string;
  readonly diagnostico: string | null;
  readonly valorInformado: string | null;
}

/**
 * Os eventos das cobranças informadas, em ordem **determinística**.
 *
 * ⚠️ O desempate por `codigo` e `tipo` não é ornamento: `ocorrido_em` nasce de `now()`, que é o
 * instante do **início da transação**, de modo que dois efeitos gravados na mesma unidade de trabalho
 * — a liquidação e a divergência de valor da mesma cobrança — carregam carimbos **idênticos**. E o
 * `id` é UUID, que não cresce com o tempo: desempatar por ele deixaria a ordem ao acaso, e a igualdade
 * de lista abaixo ficaria instável sem que nada mudasse no produto.
 */
async function eventosDe(cenario: Cenario, codigos: readonly string[]): Promise<EventoLido[]> {
  return await emUnidade(cenario, async (tx) => {
    const linhas = await tx<EventoLido[]>`
      SELECT c.codigo AS codigo,
             e.tipo::text AS tipo,
             e.origem::text AS origem,
             e.diagnostico AS diagnostico,
             e.valor_informado AS "valorInformado"
        FROM negocio.evento_bancario e
        JOIN negocio.cobranca c ON c.id = e.cobranca_id
       WHERE c.codigo = ANY(${[...codigos]})
       ORDER BY e.ocorrido_em, c.codigo, e.tipo
    `;

    return linhas.map((linha) => ({
      codigo: linha.codigo,
      tipo: linha.tipo,
      origem: linha.origem,
      diagnostico: linha.diagnostico,
      valorInformado: linha.valorInformado,
    }));
  });
}

/**
 * Quantos eventos a trilha **inteira** da empresa carrega.
 *
 * A contagem é global ao contexto, e não recortada pelas cobranças do caso, de propósito: o que o
 * CT-938 afirma é que a passada sem efeito **não escreveu em lugar nenhum**, e um recorte por
 * cobrança deixaria de fora justamente a escrita no alvo errado.
 */
async function eventosNaTrilha(cenario: Cenario): Promise<number> {
  return await emUnidade(cenario, async (tx) => {
    const [linha] = await tx<{ total: string }[]>`
      SELECT count(*)::text AS total FROM negocio.evento_bancario
    `;

    if (linha === undefined) {
      throw new Error('a contagem da trilha não devolveu linha');
    }

    return Number(linha.total);
  });
}

/** O retrato publicado de uma cobrança — a projeção real, pela porta de produção. */
async function retratoDe(cenario: Cenario, codigo: string): Promise<LinhaDeCobranca> {
  const linha = await emUnidade(cenario, async (tx) => await localizarCobranca(tx, codigo));

  if (linha === undefined) {
    throw new Error(`a cobrança ${codigo} não foi encontrada sob o contexto do arranjo`);
  }

  return linha;
}

/** A posição `indice` (1-indexada) da lista semeada — a indexação crua devolveria `undefined`. */
function posicao(semeadas: readonly CobrancaSemeada[], indice: number): CobrancaSemeada {
  const cobranca = semeadas[indice - 1];
  if (cobranca === undefined) {
    throw new Error(`o arranjo precisa da cobrança na posição ${String(indice)}`);
  }
  return cobranca;
}

/** Um par `[título, resposta]` do arranjo do provedor. */
type ParDeResposta = readonly [string, RespostaDoProvedor];

/** Um mapa de respostas montado a partir de pares `[título, resposta]`. */
function respostasDe(pares: readonly ParDeResposta[]): ReadonlyMap<string, RespostaDoProvedor> {
  return new Map(pares);
}

/** A resposta `LIQUIDADO` do provedor, com a data e o valor informados. */
function liquidacaoDe(valorPago: number): RespostaDoProvedor {
  return {
    situacao: {
      situacao: 'LIQUIDADO',
      documento: null,
      pagoEm: DATA_DO_PAGAMENTO,
      valorPago,
    },
  };
}

/** A resposta `REVOGADO` do provedor, com o motivo **tal como ele o informa** (RN-15). */
function revogacaoPor(motivo: string): RespostaDoProvedor {
  return { situacao: { situacao: 'REVOGADO', documento: null, motivo } };
}

/** A resposta `ESTORNADO` do provedor — ela não carrega conteúdo próprio. */
const ESTORNO_INFORMADO: RespostaDoProvedor = {
  situacao: { situacao: 'ESTORNADO', documento: null },
};

// ---------------------------------------------------------------------------
// Subida e descida
// ---------------------------------------------------------------------------

beforeAll(async () => {
  banco = await bancoEfemero();
  acesso = abrirAcessoAoBanco({
    cadeiaDeConexao: banco.cadeiaConexao,
    maximoDeConexoes: RESERVA_DE_CONEXOES,
  });
  diretorioDosBoletos = await mkdtemp(join(tmpdir(), 'sysloc-boletos-conferencia-'));

  await semearApoio(CENARIO_DE_A);
  await semearApoio(CENARIO_DE_B);

  // ⚠️ As três datas do arranjo nascem AQUI, do relógio do banco, e não de literal nenhum: é o que
  // faz cada caso ser verdadeiro em qualquer dia em que a suíte rode. A leitura corre uma vez, na
  // subida, para que as duas empresas e todos os casos compartilhem o mesmo eixo.
  VENCIMENTO_PASSADO = await dataDeslocada(CENARIO_DE_A, DESLOCAMENTO_DO_VENCIMENTO_PASSADO);
  VENCIMENTO_FUTURO = await dataDeslocada(CENARIO_DE_A, DESLOCAMENTO_DO_VENCIMENTO_FUTURO);
  DATA_DO_PAGAMENTO = await dataDeslocada(CENARIO_DE_A, DESLOCAMENTO_DO_PAGAMENTO);
}, LIMITE_SUBIDA_MS);

afterAll(async () => {
  await acesso?.encerrar();
  await banco?.parar();
  if (diretorioDosBoletos !== undefined) {
    await rm(diretorioDosBoletos, { recursive: true, force: true });
  }
}, LIMITE_SUBIDA_MS);

// ===========================================================================
// CT-927 — a conferência de A alcança apenas cobranças de A
// ===========================================================================

describe('CT-927 — a conferência disparada pelo Admin alcança apenas cobranças da empresa dele', () => {
  it(
    'CT-927 — a porta recebe exatamente os títulos de A, e nenhum de B',
    async () => {
      const deB = await prepararCarteira(CENARIO_DE_B, [
        VENCIMENTO_PASSADO,
        VENCIMENTO_PASSADO,
        VENCIMENTO_FUTURO,
      ]);
      const deA = await prepararCarteira(CENARIO_DE_A, [
        VENCIMENTO_PASSADO,
        VENCIMENTO_FUTURO,
        VENCIMENTO_FUTURO,
      ]);

      const titulosDeA = deA.map((cobranca) => cobranca.numeroDoTituloNoProvedor);
      const titulosDeB = deB.map((cobranca) => cobranca.numeroDoTituloNoProvedor);

      // ⚠️ CONTROLE ANTIVÁCUO, e ele vem ANTES de tudo: o conjunto de B tem três elementos, de modo
      // que havia o que vazar. Sem esta asserção, a interseção vazia lá embaixo compararia o conjunto
      // de A com o vazio, e passaria mesmo num produto que nunca semeasse B.
      expect(titulosDeB).toHaveLength(3);

      const { desfecho, adaptador, conferenciaId, cobrancas } = await apurar(
        CENARIO_DE_A,
        respostasDe([]),
      );

      // O conjunto que a apuração recebeu é o de A — a seleção é da política, e nada aqui filtra.
      expect(cobrancas.map((cobranca) => cobranca.codigo)).toEqual(
        deA.map((cobranca) => cobranca.codigo),
      );

      const recebidos = adaptador.consultas.map((consulta) => consulta.numeroDoTituloNoProvedor);

      // ⚠️ ESTA é a asserção que discrimina "alcança só A" de "alcança as duas empresas": a igualdade
      // de conjunto é contra `titulosDeA`, **escrito pelo arranjo**, e nunca contra uma derivação do
      // próprio resultado — reprova nas duas direções, nomeando quem sobra e quem falta.
      expect(recebidos).toHaveLength(3);
      expect(diferencasDeConjunto(recebidos, titulosDeA)).toEqual({
        excedentes: [],
        ausentes: [],
      });

      // E a interseção com o conjunto de B é vazia.
      expect(recebidos.filter((titulo) => titulosDeB.includes(titulo))).toEqual([]);

      // Toda consulta correu em nome de A e **sem** pedir o documento — a apuração decide sobre
      // estado, e trazer o boleto de cada cobrança do dia tornaria a passada cara.
      expect(
        adaptador.consultas.map((consulta) => ({
          empresaId: consulta.empresaId,
          incluirDocumento: consulta.incluirDocumento,
        })),
      ).toEqual([
        { empresaId: EMPRESA_A.id, incluirDocumento: false },
        { empresaId: EMPRESA_A.id, incluirDocumento: false },
        { empresaId: EMPRESA_A.id, incluirDocumento: false },
      ]);

      expect(desfecho).toEqual({
        cobrancasConferidas: 3,
        efeitos: 0,
        interrompida: false,
        motivoDaInterrupcao: null,
      });

      expect(await conferenciaGravada(CENARIO_DE_A, conferenciaId)).toEqual({
        concluida: true,
        cobrancasConferidas: 3,
        efeitos: 0,
      });

      // O estado das três de B ficou intacto — a apuração de A não as tocou nem para "não mudar".
      for (const cobranca of deB) {
        const retrato = await retratoDe(CENARIO_DE_B, cobranca.codigo);
        expect(retrato.numeroDoTituloNoProvedor).toBe(cobranca.numeroDoTituloNoProvedor);
        expect(retrato.canceladoEm).toBeNull();
      }
    },
    LIMITE_DO_CASO_MS,
  );
});

// ===========================================================================
// CT-927 (b) — a consulta recusada não conta, e a classe decide o percurso
// ===========================================================================

describe('CT-927 (b) — a falha da consulta classifica: DA_COBRANCA segue, DA_EMPRESA cessa', () => {
  it(
    'CT-927 (b) — quatro consultas de cinco cobranças, e a conferência fecha assim mesmo',
    async () => {
      const semeadas = await prepararCarteira(CENARIO_DE_A, [
        VENCIMENTO_FUTURO,
        VENCIMENTO_FUTURO,
        VENCIMENTO_FUTURO,
        VENCIMENTO_FUTURO,
        VENCIMENTO_FUTURO,
      ]);

      const { desfecho, adaptador, conferenciaId, cobrancas } = await apurar(
        CENARIO_DE_A,
        respostasDe([
          [
            posicao(semeadas, 2).numeroDoTituloNoProvedor,
            { recusa: { classe: 'DA_COBRANCA', motivo: RECUSA_DA_COBRANCA } },
          ],
          [posicao(semeadas, 3).numeroDoTituloNoProvedor, revogacaoPor(MOTIVO_RECONHECIDO)],
          [
            posicao(semeadas, 4).numeroDoTituloNoProvedor,
            { recusa: { classe: 'DA_EMPRESA', motivo: RECUSA_DA_EMPRESA } },
          ],
        ]),
      );

      // Controle antivácuo: as cinco entraram no conjunto, na ordem do predicado (`ORDER BY codigo`).
      expect(cobrancas.map((cobranca) => cobranca.codigo)).toEqual(
        semeadas.map((cobranca) => cobranca.codigo),
      );

      // ⚠️ A CONTAGEM EXATA é o que separa "cessou no ponto" de "consultou tudo e falhou no fim": uma
      // apuração que seguisse perguntaria também pela quinta, e ainda assim declararia interrompida.
      expect(adaptador.consultas.map((consulta) => consulta.numeroDoTituloNoProvedor)).toEqual([
        posicao(semeadas, 1).numeroDoTituloNoProvedor,
        posicao(semeadas, 2).numeroDoTituloNoProvedor,
        posicao(semeadas, 3).numeroDoTituloNoProvedor,
        posicao(semeadas, 4).numeroDoTituloNoProvedor,
      ]);

      // A recusa `DA_COBRANCA` **não conta como conferida** e não gera efeito: conferidas são a 1ª e a
      // 3ª. O efeito é o da 3ª, que revogou.
      expect(desfecho).toEqual({
        cobrancasConferidas: 2,
        efeitos: 1,
        interrompida: true,
        motivoDaInterrupcao: RECUSA_DA_EMPRESA,
      });

      // ⚠️ A conferência é FECHADA mesmo interrompida — deixá-la aberta faria o índice único parcial
      // devolver `iniciadaAgora: false` a todo disparo seguinte da empresa, para sempre.
      expect(await conferenciaGravada(CENARIO_DE_A, conferenciaId)).toEqual({
        concluida: true,
        cobrancasConferidas: 2,
        efeitos: 1,
      });

      // O que já foi aplicado PERMANECE: a 3ª está sem boleto e em aberto.
      const revogada = await retratoDe(CENARIO_DE_A, posicao(semeadas, 3).codigo);
      expect(revogada.numeroDoTituloNoProvedor).toBeNull();
      expect(revogada.canceladoEm).toBeNull();

      // E a 5ª, depois do ponto, não foi tocada — o boleto dela continua o do arranjo.
      const intocada = await retratoDe(CENARIO_DE_A, posicao(semeadas, 5).codigo);
      expect(intocada.numeroDoTituloNoProvedor).toBe(posicao(semeadas, 5).numeroDoTituloNoProvedor);

      // A trilha registrou EXATAMENTE o efeito, e nenhuma das duas recusas.
      const trilha = await eventosDe(
        CENARIO_DE_A,
        semeadas.map((cobranca) => cobranca.codigo),
      );
      expect(trilha).toEqual([
        {
          codigo: posicao(semeadas, 3).codigo,
          tipo: 'BOLETO_REVOGADO',
          origem: 'CONFERENCIA',
          diagnostico: MOTIVO_RECONHECIDO,
          valorInformado: null,
        },
      ]);
    },
    LIMITE_DO_CASO_MS,
  );
});

// ===========================================================================
// CT-930 — boleto revogado pelo provedor NÃO cancela a cobrança
// ===========================================================================

describe('CT-930 — boleto revogado pelo provedor não cancela a cobrança', () => {
  it(
    'CT-930 — cancelado_em segue nulo nas duas, com motivo reconhecido e com motivo desconhecido',
    async () => {
      // Os dois lados do vencimento no MESMO caso: é o par que detecta uma implementação que gravasse
      // estado fixo em vez de derivar — ela acertaria um lado e erraria o outro.
      const semeadas = await prepararCarteira(CENARIO_DE_A, [
        VENCIMENTO_PASSADO,
        VENCIMENTO_FUTURO,
      ]);

      const vencida = posicao(semeadas, 1);
      const aVencer = posicao(semeadas, 2);

      const { desfecho, conferenciaId } = await apurar(
        CENARIO_DE_A,
        respostasDe([
          [vencida.numeroDoTituloNoProvedor, revogacaoPor(MOTIVO_RECONHECIDO)],
          [aVencer.numeroDoTituloNoProvedor, revogacaoPor(MOTIVO_DESCONHECIDO)],
        ]),
      );

      expect(desfecho).toEqual({
        cobrancasConferidas: 2,
        efeitos: 2,
        interrompida: false,
        motivoDaInterrupcao: null,
      });

      expect(await conferenciaGravada(CENARIO_DE_A, conferenciaId)).toEqual({
        concluida: true,
        cobrancasConferidas: 2,
        efeitos: 2,
      });

      // ⚠️ ESTA é a asserção que carrega a métrica nº 1 do PRD, e a que separa este produto do sistema
      // antigo, que cancelava a cobrança: `canceladoEm` segue NULO nas duas. O estado derivado é o de
      // cada uma — `VENCIDA` e `A_VENCER` —, e é o par que reprova uma implementação que gravasse
      // estado fixo.
      const retratos = [
        { esperado: ESTADO_VENCIDA, cobranca: vencida },
        { esperado: ESTADO_A_VENCER, cobranca: aVencer },
      ];

      for (const { esperado, cobranca } of retratos) {
        const retrato = await retratoDe(CENARIO_DE_A, cobranca.codigo);

        expect({
          canceladoEm: retrato.canceladoEm,
          numeroDoTituloNoProvedor: retrato.numeroDoTituloNoProvedor,
          linhaDigitavel: retrato.linhaDigitavel,
          codigoDeBarras: retrato.codigoDeBarras,
          pagoEm: retrato.pagoEm,
          status: retrato.status,
        }).toEqual({
          canceladoEm: null,
          numeroDoTituloNoProvedor: null,
          linhaDigitavel: null,
          codigoDeBarras: null,
          pagoEm: null,
          status: esperado,
        });

        // São QUATRO as colunas que a revogação zera — os três de emissão mais o arquivo —, e o
        // `identificador_no_provedor` SOBREVIVE: ele é a chave de correlação por onde uma notícia
        // atrasada do provedor ainda se liga a esta cobrança, e não se recompõe (ADR-0033).
        expect(await camposInternosDe(CENARIO_DE_A, cobranca.codigo)).toEqual({
          identificadorNoProvedor: cobranca.identificadorNoProvedor,
          caminhoDoArquivo: null,
        });
      }

      // Os bytes saíram do disco — filesystem real, e não um valor combinado entre teste e teste.
      // ⚠️ O controle antivácuo é o diretório NÃO estar vazio: os boletos das cobranças que o arranjo
      // aposentou continuam lá, porque `esvaziarCarteira` só revoga **no banco**. Sem ele, um
      // diretório inexistente satisfaria a filtragem abaixo por não ter olhado.
      const arquivos = await readdir(diretorioDosBoletos);
      expect(arquivos.length).toBeGreaterThan(0);
      expect(
        arquivos.filter((nome) => [vencida.nomeDoArquivo, aVencer.nomeDoArquivo].includes(nome)),
      ).toEqual([]);

      // ⚠️ AQUI está a prova comportamental da RN-15: as duas cobranças terminam no MESMO tratamento
      // apesar de motivos completamente diferentes, e cada `diagnostico` volta byte a byte. Um `switch`
      // sobre o motivo faria a de `'MOTIVO-INEXISTENTE-99'` cair em ramo diferente, e a igualdade de
      // corpo inteiro reprovaria.
      expect(
        await eventosDe(
          CENARIO_DE_A,
          semeadas.map((cobranca) => cobranca.codigo),
        ),
      ).toEqual([
        {
          codigo: vencida.codigo,
          tipo: 'BOLETO_REVOGADO',
          origem: 'CONFERENCIA',
          diagnostico: MOTIVO_RECONHECIDO,
          valorInformado: null,
        },
        {
          codigo: aVencer.codigo,
          tipo: 'BOLETO_REVOGADO',
          origem: 'CONFERENCIA',
          diagnostico: MOTIVO_DESCONHECIDO,
          valorInformado: null,
        },
      ]);
    },
    LIMITE_DO_CASO_MS,
  );
});

// ===========================================================================
// CT-938 — a trilha registra efeito e NUNCA a tentativa que nada mudou
// ===========================================================================

describe('CT-938 — a trilha registra efeito e nunca a tentativa que nada mudou', () => {
  it(
    'CT-938 — a passada sem efeito grava zero eventos, e a seguinte com um efeito grava um',
    async () => {
      const semeadas = await prepararCarteira(CENARIO_DE_A, [
        VENCIMENTO_FUTURO,
        VENCIMENTO_FUTURO,
        VENCIMENTO_FUTURO,
        VENCIMENTO_FUTURO,
        VENCIMENTO_FUTURO,
      ]);

      // ⚠️ Nenhum evento de tipo `CONFERENCIA` existe — a conferência é **origem**, nunca **tipo**. O
      // enum tem sete valores, afirmados por igualdade de lista contra a fonte única do contrato.
      //
      // SUT_IS_CORRECT_BECAUSE: eram SEIS até a fatia `webhook-e-carne`, que acrescentou
      // `NOTICIA_RECUSADA` ao fim por decisão declarada na §1 da T2 dela. Ele é **desfecho anômalo**
      // — a notícia do provedor cujo número de título diverge do gravado —, que é a segunda metade
      // literal da `Decision` da ADR-0034, e não tentativa. O que este caso afirma não mudou:
      // `CONFERENCIA` continua ausente da lista, que é o invariante sob prova aqui.
      expect([...TIPOS_DE_EVENTO_BANCARIO]).toEqual([
        'BOLETO_EMITIDO',
        'BOLETO_REVOGADO',
        'EMISSAO_RECUSADA',
        'COBRANCA_LIQUIDADA',
        'LIQUIDACAO_ESTORNADA',
        'DIVERGENCIA_DE_VALOR',
        'NOTICIA_RECUSADA',
      ]);

      const antes = await eventosNaTrilha(CENARIO_DE_A);

      // --- 1ª passada: o provedor responde "sem alteração" para todas ---------------------------
      const primeira = await apurar(CENARIO_DE_A, respostasDe([]));

      expect(primeira.cobrancas).toHaveLength(5);
      expect(primeira.desfecho).toEqual({
        cobrancasConferidas: 5,
        efeitos: 0,
        interrompida: false,
        motivoDaInterrupcao: null,
      });

      // Delta ZERO na trilha inteira — a passada rodou e não escreveu em lugar nenhum.
      const depoisDaPrimeira = await eventosNaTrilha(CENARIO_DE_A);
      expect(depoisDaPrimeira - antes).toBe(0);

      // E ainda assim a execução é auditável: a conferência registra que percorreu as cinco.
      expect(await conferenciaGravada(CENARIO_DE_A, primeira.conferenciaId)).toEqual({
        concluida: true,
        cobrancasConferidas: 5,
        efeitos: 0,
      });

      // --- 2ª passada: uma das cinco liquidou ----------------------------------------------------
      //
      // ⚠️ O CONTRASTE É OBRIGATÓRIO: sem ele, um escritor de eventos quebrado produziria zero nos dois
      // casos e passaria. É este delta `1` que prova que o zero acima é ausência de efeito.
      const liquidada = posicao(semeadas, 2);
      const esperado = (await retratoDe(CENARIO_DE_A, liquidada.codigo)).valorTotal;

      const segunda = await apurar(
        CENARIO_DE_A,
        respostasDe([[liquidada.numeroDoTituloNoProvedor, liquidacaoDe(esperado)]]),
      );

      expect(segunda.desfecho).toEqual({
        cobrancasConferidas: 5,
        efeitos: 1,
        interrompida: false,
        motivoDaInterrupcao: null,
      });

      const depoisDaSegunda = await eventosNaTrilha(CENARIO_DE_A);
      expect(depoisDaSegunda - depoisDaPrimeira).toBe(1);

      expect(await conferenciaGravada(CENARIO_DE_A, segunda.conferenciaId)).toEqual({
        concluida: true,
        cobrancasConferidas: 5,
        efeitos: 1,
      });

      // O único evento é a liquidação, na cobrança certa, com origem `CONFERENCIA` — e sem
      // `DIVERGENCIA_DE_VALOR`, porque o valor informado era o esperado.
      expect(
        await eventosDe(
          CENARIO_DE_A,
          semeadas.map((cobranca) => cobranca.codigo),
        ),
      ).toEqual([
        {
          codigo: liquidada.codigo,
          tipo: 'COBRANCA_LIQUIDADA',
          origem: 'CONFERENCIA',
          diagnostico: null,
          valorInformado: null,
        },
      ]);
    },
    LIMITE_DO_CASO_MS,
  );
});

// ===========================================================================
// CT-938 (b) — o valor divergente não impede a baixa, e a repetição não grava
// ===========================================================================

describe('CT-938 (b) — valor divergente baixa assim mesmo, e a repetição não gera evento', () => {
  it(
    'CT-938 (b) — dois eventos na divergente, um na de valor igual, zero na repetição',
    async () => {
      const semeadas = await prepararCarteira(CENARIO_DE_A, [VENCIMENTO_FUTURO, VENCIMENTO_FUTURO]);

      const divergente = posicao(semeadas, 1);
      const conforme = posicao(semeadas, 2);

      // O valor **esperado** sai da visão, e não de um literal escrito aqui: é o `valorTotal` que a
      // cobrança publicava um instante antes da baixa.
      const esperado = (await retratoDe(CENARIO_DE_A, divergente.codigo)).valorTotal;
      expect(esperado).not.toBe(VALOR_DIVERGENTE);

      const respostas = respostasDe([
        [divergente.numeroDoTituloNoProvedor, liquidacaoDe(VALOR_DIVERGENTE)],
        [conforme.numeroDoTituloNoProvedor, liquidacaoDe(esperado)],
      ]);

      const primeira = await apurar(CENARIO_DE_A, respostas);

      // A divergência **não impede nada**: as duas contam como efeito, e o efeito é um por cobrança —
      // o segundo evento não é um segundo efeito.
      expect(primeira.desfecho).toEqual({
        cobrancasConferidas: 2,
        efeitos: 2,
        interrompida: false,
        motivoDaInterrupcao: null,
      });

      // ⚠️ `pagoEm` não-nulo vem PRIMEIRO, e é o que discrimina *baixou assim mesmo* de *recusou a
      // baixa e só registrou a divergência*: sem ele, um SUT que bloqueasse a baixa passaria por ter
      // gravado o evento.
      const retrato = await retratoDe(CENARIO_DE_A, divergente.codigo);
      expect({
        pagoEm: retrato.pagoEm,
        valorPago: retrato.valorPago,
        dataDoCredito: retrato.dataDoCredito,
        valorCreditado: retrato.valorCreditado,
        status: retrato.status,
      }).toEqual({
        pagoEm: DATA_DO_PAGAMENTO,
        valorPago: VALOR_DIVERGENTE,
        // O crédito é **derivado do pagamento**, num ponto único do domínio — ver o cabeçalho de
        // `../src/conferencia.ts`.
        dataDoCredito: DATA_DO_PAGAMENTO,
        valorCreditado: VALOR_DIVERGENTE,
        status: 'PAGA',
      });

      const trilha = await eventosDe(
        CENARIO_DE_A,
        semeadas.map((cobranca) => cobranca.codigo),
      );

      // A divergente tem DOIS eventos, o segundo com o valor **tal como informado**...
      expect(trilha.filter((evento) => evento.codigo === divergente.codigo)).toEqual([
        {
          codigo: divergente.codigo,
          tipo: 'COBRANCA_LIQUIDADA',
          origem: 'CONFERENCIA',
          diagnostico: null,
          valorInformado: null,
        },
        {
          codigo: divergente.codigo,
          tipo: 'DIVERGENCIA_DE_VALOR',
          origem: 'CONFERENCIA',
          diagnostico: null,
          valorInformado: VALOR_DIVERGENTE.toFixed(2),
        },
      ]);

      // ⚠️ ...e a de valor IGUAL tem UM só. É o companheiro que discrimina *a divergência é decidida*
      // de *todo pagamento vira divergência*.
      expect(trilha.filter((evento) => evento.codigo === conforme.codigo)).toEqual([
        {
          codigo: conforme.codigo,
          tipo: 'COBRANCA_LIQUIDADA',
          origem: 'CONFERENCIA',
          diagnostico: null,
          valorInformado: null,
        },
      ]);

      // --- A repetição: o provedor informa as MESMAS liquidações -------------------------------
      //
      // Nada mudou (§3.3.3), e a ADR-0034 é literal: nenhum evento. As duas continuam elegíveis
      // porque `pago_em` foi posicionado a `DESLOCAMENTO_DO_PAGAMENTO` dias do relógio do banco —
      // dentro da janela de 30 do predicado em qualquer dia de execução —, então elas são conferidas
      // de novo. É a passada que só existe por causa dessa elegibilidade.
      const antesDaRepeticao = await eventosNaTrilha(CENARIO_DE_A);
      const segunda = await apurar(CENARIO_DE_A, respostas);

      expect(segunda.desfecho).toEqual({
        cobrancasConferidas: 2,
        efeitos: 0,
        interrompida: false,
        motivoDaInterrupcao: null,
      });
      expect((await eventosNaTrilha(CENARIO_DE_A)) - antesDaRepeticao).toBe(0);

      // E o fato da primeira baixa SOBREVIVE: a repetição não reescreveu nada.
      const depois = await retratoDe(CENARIO_DE_A, divergente.codigo);
      expect(depois.valorPago).toBe(VALOR_DIVERGENTE);
      expect(depois.pagoEm).toBe(DATA_DO_PAGAMENTO);
    },
    LIMITE_DO_CASO_MS,
  );
});

// ===========================================================================
// CT-938 (c) — o estorno informado devolve o estado à derivação
// ===========================================================================

describe('CT-938 (c) — o estorno informado pelo provedor devolve o estado à derivação', () => {
  it(
    'CT-938 (c) — oito campos nulos, três de emissão intactos, e a repetição não gera evento',
    async () => {
      // Os dois lados do vencimento de novo: o estado depois do estorno é DERIVADO, e uma
      // implementação que gravasse estado fixo acertaria um lado e erraria o outro.
      const semeadas = await prepararCarteira(CENARIO_DE_A, [
        VENCIMENTO_PASSADO,
        VENCIMENTO_FUTURO,
      ]);

      const vencida = posicao(semeadas, 1);
      const aVencer = posicao(semeadas, 2);

      // --- Passada 1: as duas liquidam ----------------------------------------------------------
      const liquidacoes = respostasDe(
        semeadas.map(
          (cobranca): ParDeResposta => [
            cobranca.numeroDoTituloNoProvedor,
            liquidacaoDe(VALOR_DIVERGENTE),
          ],
        ),
      );

      expect((await apurar(CENARIO_DE_A, liquidacoes)).desfecho.efeitos).toBe(2);
      expect((await retratoDe(CENARIO_DE_A, vencida.codigo)).status).toBe('PAGA');

      // --- Passada 2: o provedor informa o estorno das duas ---------------------------------------
      const estornos = respostasDe(
        semeadas.map(
          (cobranca): ParDeResposta => [cobranca.numeroDoTituloNoProvedor, ESTORNO_INFORMADO],
        ),
      );

      const antesDoEstorno = await eventosNaTrilha(CENARIO_DE_A);
      const comEstorno = await apurar(CENARIO_DE_A, estornos);

      expect(comEstorno.desfecho).toEqual({
        cobrancasConferidas: 2,
        efeitos: 2,
        interrompida: false,
        motivoDaInterrupcao: null,
      });
      expect((await eventosNaTrilha(CENARIO_DE_A)) - antesDoEstorno).toBe(2);

      // Os oito campos da liquidação voltaram a `NULL`, os TRÊS de emissão permanecem — estorno não é
      // revogação —, e o estado voltou a DERIVAR do vencimento de cada uma.
      const retratos = [
        { esperado: ESTADO_VENCIDA, cobranca: vencida },
        { esperado: ESTADO_A_VENCER, cobranca: aVencer },
      ];

      for (const { esperado, cobranca } of retratos) {
        const retrato = await retratoDe(CENARIO_DE_A, cobranca.codigo);

        expect({
          pagoEm: retrato.pagoEm,
          valorPago: retrato.valorPago,
          dataDoCredito: retrato.dataDoCredito,
          valorCreditado: retrato.valorCreditado,
          multaPercentualAplicado: retrato.multaPercentualAplicado,
          jurosPercentualAplicado: retrato.jurosPercentualAplicado,
          canceladoEm: retrato.canceladoEm,
          numeroDoTituloNoProvedor: retrato.numeroDoTituloNoProvedor,
          status: retrato.status,
        }).toEqual({
          pagoEm: null,
          valorPago: null,
          dataDoCredito: null,
          valorCreditado: null,
          multaPercentualAplicado: null,
          jurosPercentualAplicado: null,
          canceladoEm: null,
          numeroDoTituloNoProvedor: cobranca.numeroDoTituloNoProvedor,
          status: esperado,
        });
      }

      // --- Passada 3: o provedor repete o estorno — nada mudou, nenhum evento -------------------
      const antesDaRepeticao = await eventosNaTrilha(CENARIO_DE_A);
      const repetida = await apurar(CENARIO_DE_A, estornos);

      expect(repetida.desfecho).toEqual({
        cobrancasConferidas: 2,
        efeitos: 0,
        interrompida: false,
        motivoDaInterrupcao: null,
      });
      expect((await eventosNaTrilha(CENARIO_DE_A)) - antesDaRepeticao).toBe(0);
    },
    LIMITE_DO_CASO_MS,
  );
});
