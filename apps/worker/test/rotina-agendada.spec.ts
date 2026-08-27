/**
 * A **borda das quatro rotinas por empresa** — a tarefa entra pela fila real, o contexto nasce da
 * carga, e uma passagem de UMA empresa corre. T6 da fatia `automacoes-agendadas`.
 *
 * ===========================================================================
 * INVARIANTES
 * ===========================================================================
 *
 * | Critério | Caso    | Invariante |
 * |----------|---------|------------|
 * | CA-12    | CT-1082 | Executada a tarefa com o `empresaId` de B, o efeito de domínio ocorre
 * | CA-15    |         | EXCLUSIVAMENTE em B: o contrato vencido de B fica `ENCERRADO` com o imóvel
 * |          |         | `DISPONIVEL`, o de A permanece `ATIVO` com o imóvel `LOCADO`, a contagem
 * |          |         | crua sob A é IDÊNTICA à de antes, e existe exatamente `1` linha em
 * |          |         | `negocio.execucao_de_rotina`, com o `empresa_id` de B. |
 * | CA-11    | CT-1083 | Para cada uma das quatro rotinas, a passagem cujo predicado de efeito é
 * |          |         | falso termina CONCLUÍDA e não grava linha alguma: depois das quatro,
 * |          |         | `count(*)` é EXATAMENTE `0`. O controle positivo — o mesmo encerramento
 * |          |         | com um contrato vencido — grava EXATAMENTE `1`. E os valores do enum
 * |          |         | `negocio.rotina_agendada` NÃO contêm vigilância nem expurgo. |
 * | CA-02    | CT-1084 | As cinco cargas inválidas terminam FALHADAS, com a razão contendo
 * |          |         | literalmente o campo ofensor, sem aparecer entre as concluídas e sem mover
 * |          |         | as contagens cruas de contrato, imóvel e registro. O controle positivo
 * |          |         | CONCLUI, encerra e grava exatamente `1`. |
 * | CA-16    | CT-1085 | Com a Entrega da notícia DESABILITADA, a conferência diária CONCLUI e
 * |          |         | descobre as liquidações: as 2 cobranças ganham o FATO (`pago_em`,
 * |          |         | `data_credito`, `valor_creditado`) e passam a derivar `PAGA`; existe 1
 * |          |         | linha com `rotina='CONFERENCIA_DE_LIQUIDACAO'` e `resumo` profundamente
 * |          |         | igual a `{ liquidacoesDescobertas: 2 }`; e a Entrega permanece DESABILITADA. |
 * | CA-03    | CT-1086 | A vigilância emite EXATAMENTE uma linha `error` por rotina atrasada, com
 * |          |         | `empresaId`, `rotina`, `ultimaExecucao` e `limiarMinutos` LIDO do contrato,
 * |          |         | e NENHUMA para rotina em dia. `negocio.execucao_de_rotina` não ganha linha. |
 * | CA-16    | CT-1085 | Falhada a 1ª ativação **depois** de a conferência ter sido aberta e comitada,
 * | CA-02    | (b)     | a repetição da tarefa **REFAZ a passada** contra a mesma linha: existe `1`
 * |          |         | conferência e ela está CONCLUÍDA, as 2 cobranças ganham o fato e derivam
 * |          |         | `PAGA`, a passagem grava `1` registro, e a reentrada é anunciada em `warn`.
 * |          |         | Sem isso a repetição termina verde SEM trabalhar, e o índice único parcial
 * |          |         | trava a conferência daquela empresa para sempre — inclusive pelo Admin. |
 * | CA-16    | CT-1085 | Na **primeira** ativação, a apuração já em andamento é de outra passagem: a
 * |          | (c)     | passagem NÃO trabalha — a conferência alheia continua não concluída, as
 * |          |         | cobranças do cenário continuam fora das pagas, nenhum registro nasce, e a
 * |          |         | linha do diário sai em `info` nomeando a apuração encontrada. É a OUTRA
 * |          |         | perna do discriminador que o `(b)` cobre pela metade. |
 * | CA-02    | CT-1089 | `esquemaDaCargaDaRotinaAgendada` aceita a carga válida **canonizando a caixa
 * |          | (T6)    | do UUID**, e recusa com `path` EXATO o `empresaId` que não é UUID e a
 * |          |         | `rotina` fora da união fechada; a chave desconhecida recusa por
 * |          |         | `code === 'unrecognized_keys'` com `keys === ['extra']`. |
 *
 * Rastreabilidade: `CA-12, CA-15 → CT-1082 (RD-12)` · `CA-11 → CT-1083 (RD-15)` ·
 * `CA-02 → CT-1084 (RD-12)` · `CA-16 → CT-1085 (RD-13)` · `CA-16, CA-02 → CT-1085 (b) (RD-13)` ·
 * `CA-16 → CT-1085 (c) (RD-13)` · `CA-03 → CT-1086 (RD-17/RD-18)` · `CA-02 → CT-1089 (T6) (RD-12)`.
 *
 * ===========================================================================
 * O CT-1084 e o CT-1089 (T6) provam coisas DIFERENTES — nenhum substitui o outro
 * ===========================================================================
 *
 * O `CT-1084` prova o **percurso**: a tarefa entra pela fila real, termina em falha retida e a razão
 * publicada nomeia os campos. O `CT-1089 (T6)` prova a **forma da recusa no ponto em que ela nasce**,
 * no formato que a `.claude/rules/contrato-publicado.md` fixa. Ele é a metade de `safeParse` que a §3
 * da T2 delegou nominalmente a esta task — `@sysloc/shared` não depende de `zod`, e o `strictObject`
 * mora na borda que recebe a carga.
 *
 * ⚠️ **A asserção do `CT-1084` incide sobre o SEGMENTO da razão que só a tradução produz**, e não
 * sobre a razão inteira. A razão é `${exigencia} (recusado: <campos>)`, e a exigência **nomeia os dois
 * campos obrigatórios** — como deve. Asserir contenção sobre a cadeia inteira era infalível em quatro
 * das cinco cargas, e o Gate 1 o demonstrou por execução. Ver {@link CAMPOS_RECUSADOS_NA_RAZAO}.
 *
 * ===========================================================================
 * O CAMINHO É O DA OPERAÇÃO, e é isso que o caso existe para provar
 * ===========================================================================
 *
 * Nada aqui chama `processarRotinaAgendada` diretamente. A tarefa é **enfileirada pela fila real** e
 * consumida pelo consumidor que `conectarFila().processar(…)` registra — a mesma fiação que
 * `apps/worker/src/main.ts` monta em operação, com a única diferença sendo qual implementação do
 * adaptador do provedor a composição injeta. Chamar a borda direto provaria a função; o que se quer
 * provar é o **caminho**, e é ele que carrega a decisão da ADR-0024.
 *
 * ⚠️ **O contexto de tenant NÃO é fixado por fora.** O arranjo semeia sob o contexto da empresa que
 * ele monta, e para a tarefa ele entrega apenas a **carga**; quem abre o contexto do trabalho é a
 * borda, uma vez, pelo mesmo `contextoDeTenant.executarCom` da guarda HTTP. Se o teste fixasse
 * `app.empresa_id` por fora, o CT-1082 passaria mesmo com a borda não abrindo contexto nenhum — que é
 * exatamente o defeito que ele existe para pegar.
 *
 * ===========================================================================
 * A ESPERA É POR SONDAGEM, com limite declarado no topo
 * ===========================================================================
 *
 * Nenhuma pausa fixa (`.claude/rules/testing-stack.md`): o que se espera é o **estado terminal da
 * tarefa**, observado no próprio servidor de fila. E **um consumidor por caso**, nunca em laço: dois
 * consumidores vivos na mesma fila competem pela tarefa, e o desfecho passa a depender de qual venceu.
 *
 * ===========================================================================
 * O adaptador do provedor, e por que ele NÃO é mock
 * ===========================================================================
 *
 * `adaptadorQueLiquida` é **implementação** da porta que o domínio declarou, com a mesma assinatura
 * pela qual a produção é exercitada; o que ela substitui é o **par remoto**, nunca a lógica sob prova.
 * Ela chega por **parâmetro na composição** (ADR-0025) — não há bandeira, ambiente ou ramo em
 * `rotina-agendada.ts` que escolha entre operação e verificação. As três operações de título que a
 * conferência **não deve** chamar levantam nomeando-se: uma passagem que emitisse ou revogasse
 * derrubaria o caso no ponto, em vez de passar despercebida.
 *
 * ===========================================================================
 * De onde vêm o banco e a fila (ADR-0006)
 * ===========================================================================
 *
 * De instâncias efêmeras **próprias**, descartadas ao fim. Nenhuma coordenada é lida do ambiente: a
 * cadeia do banco é a que `bancoEfemero()` devolve e a da fila é a que `redisEfemero()` devolve, e a
 * porta em uso é conferida contra a faixa efêmera antes do primeiro caso. **Nenhum `WHERE
 * empresa_id` é escrito neste arquivo**, nem nas contagens cruas: quem recorta é a política
 * (ADR-0008). As duas exceções são as escritas de arranjo em `identidade.empresa`, schema que nunca
 * teve política (ADR-0009) e onde o `WHERE id` **é** o caminho.
 */

import { randomBytes, randomUUID } from 'node:crypto';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  type AdaptadorCobrancaBancaria,
  criarGuardaDeBoletos,
  type GuardaDeBoletos,
} from '@sysloc/cobranca-bancaria';
import {
  type AcessoAoBanco,
  abrirAcessoAoBanco,
  abrirConferencia,
  admitirEmpresa,
  ativarContrato,
  criarCobranca,
  criarConjunto,
  criarContrato,
  criarImovel,
  criarPessoa,
  type DadosDaPessoa,
  definirSituacaoDeLocacaoDoImovel,
  derivarValorTotal,
  EMPRESA_A,
  EMPRESA_B,
  emitirNumeroDeCobranca,
  emitirNumeroDeContrato,
  garantirContadorDeCobranca,
  garantirContadorDeContrato,
  gravarBoletoDaCobranca,
  gravarDesfechoDaEntrega,
  lerAnoDaSerieDeCobranca,
  lerAnoDaSerieDeContrato,
  lerEstadoDaEntrega,
  registrarCertificado,
  registrarIdentidadeNoProvedor,
  revogarBoleto,
  selecionarCobrancasAConferir,
  USUARIOS,
} from '@sysloc/db';
import {
  type CargaDaRotinaAgendada,
  cifrarSegredo,
  cifrarValorOperavel,
  criarLogger,
  criarSegredoOperavel,
  FILA_DA_ROTINA_AGENDADA,
} from '@sysloc/shared';
import {
  LIMIAR_DE_ATRASO_POR_CADENCIA,
  type RotinaPublicada,
  type SituacaoDeLocacao,
} from '@syslocbr/contracts';
import type { TransactionSql } from 'postgres';
import { afterAll, beforeAll, describe, expect, it, onTestFinished } from 'vitest';
import { type BancoMigrado, bancoEfemero } from '../../../packages/db/test/banco-efemero.ts';
import { FAIXA_PORTAS_EFEMERAS, sondarAte } from '../../../packages/shared/test/efemero-comum.ts';
import { type FilaEfemera, redisEfemero } from '../../../packages/shared/test/redis-efemero.ts';
import { conectarFila, type Fila, type TarefaDaRotinaAgendada } from '../src/fila.ts';
import {
  esquemaDaCargaDaRotinaAgendada,
  processarRotinaAgendada,
} from '../src/tarefas/rotina-agendada.ts';
import { type Contexto, emUnidadeSobContexto } from './acessorios-de-borda.ts';

// ---------------------------------------------------------------------------
// Limites de tempo — constantes nomeadas, nunca número mágico no meio do caso
// ---------------------------------------------------------------------------

/** Subir banco e fila efêmeros, provisionar, migrar e semear leva dezenas de segundos aqui. */
const LIMITE_SUBIDA_MS = 180_000;

/** Cada caso monta cadastros, contratos e cobranças, cada um em unidades sequenciais. */
const LIMITE_DO_CASO_MS = 300_000;

/** Limite para a tarefa alcançar estado terminal — folgado sobre a repetição da fila. */
const LIMITE_ESTADO_TERMINAL_MS = 90_000;

/** Reserva de conexões: o arranjo e o consumidor tocam o banco ao mesmo tempo. */
const RESERVA_DE_CONEXOES = 4;

/** Porta padrão do servidor de fila, usada pelo ambiente legado desta máquina (ADR-0006). */
const PORTA_PADRAO_DA_FILA = 6379;

// ---------------------------------------------------------------------------
// O arranjo — vereditos declarados ANTES da execução
// ---------------------------------------------------------------------------

/** As duas situações de locação que os casos leem. Literais fora da união não compilam. */
const SITUACAO_LOCADO: SituacaoDeLocacao = 'LOCADO';
const SITUACAO_DISPONIVEL: SituacaoDeLocacao = 'DISPONIVEL';

/** Quantos dias no PASSADO vence o contrato candidato — longe de qualquer borda de dia. */
const DIAS_VENCIDO = -5;

/** Quantos dias no FUTURO vence o contrato que nenhuma passagem deve alcançar. */
const DIAS_A_VENCER = 30;

/** Os termos do contrato de todo cenário — nada aqui participa do que está sob prova. */
const TERMOS_DO_CONTRATO = {
  dataInicioLocacao: '2026-01-01',
  prazoMeses: 12,
  valorMensal: 1000,
  diaVencimento: 10,
  indiceReajuste: 'IGPM',
  gerarCobrancasAutomaticamente: false,
  observacoes: null,
} as const;

/** A competência de todas as cobranças do arranjo — não participa de recorte nenhum. */
const COMPETENCIA = '2026-01-01';

/** Tentativas de uma tarefa que o CT-1084 reduz — nas opções do ENFILEIRAMENTO, nunca em `fila.ts`. */
const UMA_TENTATIVA = 1;

/** O nome de cada campo que a razão da falha tem de nomear. Cadeias EXATAS. */
const CAMPO_DA_EMPRESA = 'empresaId';
const CAMPO_DA_ROTINA = 'rotina';
const CHAVE_EXCEDENTE = 'extra';

/**
 * Um identificador bem formado em **caixa alta** — o que prova a canonização da ADR-0017.
 *
 * Ele é literal e não sorteado: o que o CT-1089 afirma é que o esquema devolve a forma **minúscula**
 * do mesmo valor, e comparar contra `.toLowerCase()` de um valor sorteado provaria o mesmo, mas sem
 * deixar legível qual é a diferença que está sob prova.
 */
const UUID_EM_CAIXA_ALTA = '3F2504E0-4F89-41D3-9A0C-0305E82C3301';

/** Um nome de rotina fora da união fechada — a quarta carga do CT-1084. */
const ROTINA_INEXISTENTE = 'ROTINA_INEXISTENTE';

/**
 * O segmento da razão da falha que **só a tradução do `ZodError` produz** — ver o CT-1084.
 *
 * ⚠️ **Ele existe porque asserir sobre a razão INTEIRA é infalível, e isso foi medido.** A razão é
 * `${exigencia} (recusado: <campos>)`, e a exigência de `rotina-agendada.ts` **nomeia os dois campos
 * obrigatórios** no próprio texto — ela precisa nomeá-los, porque é o que diz a quem opera o que a
 * carga exige. Consequência: `failedReason.includes('empresaId')` responde `true` mesmo com a
 * tradução devolvendo cadeia vazia, ou nomeando o campo errado. Demonstrado pelo Gate 1: com
 * `camposRecusados` mutilado, quatro das cinco cargas continuavam passando.
 *
 * O prefixo fixo **não alcança** o que vem depois de `(recusado: `, e é por isso que a asserção mora
 * aqui. **Não substitua isto por uma exigência que deixe de nomear os campos**: seria consertar o
 * teste piorando a mensagem que o operador lê.
 */
const CAMPOS_RECUSADOS_NA_RAZAO = /\(recusado: ([^)]*)\)/;

/** Quantas cobranças com boleto o cenário bancário do CT-1085 monta. */
const COBRANCAS_DO_CENARIO_BANCARIO = 2;

/** O valor de cada cobrança do cenário bancário, em reais — igual ao que o provedor informa. */
const VALOR_DA_COBRANCA = 1000;

/** O diagnóstico com que a porta do CT-1085 (b) recusa a consulta — cadeia EXATA. */
const FALHA_DO_PROVEDOR = 'o par remoto encerrou o aperto de mão antes da resposta';

/** A data em que o provedor diz que o título foi pago — fixa, e fora de qualquer recorte. */
const DATA_DO_PAGAMENTO = '2026-04-15';

/** O estado que a visão derivada publica para a cobrança com o fato da liquidação gravado. */
const COBRANCA_PAGA = 'PAGA';

/** A situação da entrega que o CT-1085 semeia e que a rotina NÃO pode religar. */
const ENTREGA_DESABILITADA = 'DESABILITADA';

/** O motivo com que a entrega do CT-1085 é desabilitada — a `CHECK` exige a coerência do par. */
const MOTIVO_DA_ENTREGA_DESABILITADA = {
  codigo: 'RECUSADO_PELO_PROVEDOR',
  mensagem: 'o provedor recusou a entrega da notícia',
  diagnostico: null,
} as const;

/** Bytes do material opaco do certificado do arranjo. Nada aqui o abre (ADR-0032). */
const BYTES_DO_MATERIAL = 64;

/** A chave que a composição usa para cifrar e decifrar o envelope do certificado. */
const CHAVE_DE_CIFRA = randomBytes(32);

/** Prefixo dos bytes que a guarda grava — o boleto do arranjo não é PDF de verdade, e não precisa. */
const PREFIXO_DO_DOCUMENTO = '%PDF-boleto-';

/** As idades, em minutos, dos três registros do CT-1086 — uma atrasada e duas em dia. */
const MINUTOS_DA_ROTINA_ATRASADA = 40;
const MINUTOS_DA_DIARIA_EM_DIA = 120;
const MINUTOS_DA_SEGUNDA_DIARIA_EM_DIA = 300;

/** Quantos minutos tem um dia — usado para envelhecer a empresa além de qualquer limiar. */
const MINUTOS_POR_DIA = 1440;

/** Idade da empresa do CT-1086: velha o bastante para que o eixo em jogo seja a última execução. */
const IDADE_DA_EMPRESA_VELHA = 30 * MINUTOS_POR_DIA;

/** A rotina que o CT-1086 espera ver no alerta, e as duas que ele espera NÃO ver. */
const ROTINA_ATRASADA: RotinaPublicada = 'AVISO_DE_COBRANCA';
const ROTINA_DO_ENCERRAMENTO: RotinaPublicada = 'ENCERRAMENTO_DE_CONTRATOS';
const ROTINA_DA_CONFERENCIA: RotinaPublicada = 'CONFERENCIA_DE_LIQUIDACAO';

/** O nível da linha que a vigilância emite por rotina parada — cadeia EXATA, como o Pino a rotula. */
const NIVEL_DE_ALERTA = 'error';

/**
 * O nível da linha que anuncia a **recuperação** — e ele é deliberadamente MENOR que o do alerta.
 *
 * A reentrada da conferência é recuperação **em curso**, e não falha terminal: a repetição está
 * refazendo o que a ativação anterior deixou pela metade. Reservar `error` para a rotina **parada** é
 * o que impede o canal de alerta de virar *"o alerta que dispara para tudo"* — a decisão que o
 * docblock de `vigiarAsRotinas` registra. Uma constante própria, e não a da vigilância reusada: são
 * dois canais com destinatários e urgências diferentes, e igualá-los aqui apagaria a distinção.
 */
const NIVEL_DA_RECUPERACAO = 'warn';

/**
 * As duas mensagens do diário que os casos da conferência localizam — cadeias EXATAS.
 *
 * A primeira nasce na execução **compartilhada** com o pedido do Admin
 * (`apps/worker/src/tarefas/conferencia-bancaria.ts`), e é justamente por ser compartilhada que o
 * `CT-1085` afirma a fila que ela publica: enquanto o nome da fila era literal ali dentro, a passagem
 * do relógio publicava o par (fila, identificador) **falso**. A segunda nasce em
 * `rotina-agendada.ts`, no ramo da reentrada.
 */
const MENSAGEM_DO_FECHO_DA_CONFERENCIA = 'conferência bancária concluída';
const MENSAGEM_DA_REENTRADA_DA_CONFERENCIA =
  'a conferência do relógio reentrou sobre a apuração que a ativação anterior deixou aberta — refazendo a passada';

/**
 * A mensagem do **outro** lado do discriminador — a passagem que encontra concorrência de verdade.
 *
 * As duas convivem porque `iniciadaAgora: false` tem **duas causas**, e o ramo que as separa é o
 * `&&` de `conferirAsLiquidacoes`. Cada perna tem o seu caso: o `CT-1085 (b)` cobre a reentrada, e o
 * `CT-1085 (c)` cobre esta — sem ela, apagar o ramo inteiro deixaria a suíte verde.
 */
const MENSAGEM_DA_APURACAO_CONCORRENTE =
  'a conferência do relógio encontrou uma apuração em andamento — nada a fazer nesta passagem';

/** O nível da linha da passagem que não trabalhou: informação, e não alerta — nada falhou. */
const NIVEL_DE_INFORMACAO = 'info';

/** O contexto usado só para admitir empresas — `identidade.empresa` não tem política (ADR-0009). */
const CONTEXTO_DA_SEMENTE: Contexto = { empresaId: EMPRESA_A.id };

let banco: BancoMigrado;
let acesso: AcessoAoBanco;
let instanciaDaFila: FilaEfemera;
let diretorioDosBoletos: string;
let empresasAdmitidas = 0;

beforeAll(async () => {
  banco = await bancoEfemero();
  acesso = abrirAcessoAoBanco({
    cadeiaDeConexao: banco.cadeiaConexao,
    maximoDeConexoes: RESERVA_DE_CONEXOES,
  });

  instanciaDaFila = await redisEfemero();
  diretorioDosBoletos = mkdtempSync(join(tmpdir(), 'sysloc-rotina-boletos-'));

  // ADR-0006 — a instância em uso não é a que atende a operação, e está dentro da faixa efêmera. A
  // conferência mais completa (contra a porta que `provisionar-base.sh` declara) mora em
  // `apps/worker/test/eco.spec.ts`, e não é recopiada aqui: cópias de um verificador divergem.
  expect(instanciaDaFila.porta).not.toBe(PORTA_PADRAO_DA_FILA);
  expect(instanciaDaFila.porta).toBeGreaterThanOrEqual(FAIXA_PORTAS_EFEMERAS.primeira);
  expect(instanciaDaFila.porta).toBeLessThanOrEqual(FAIXA_PORTAS_EFEMERAS.ultima);
}, LIMITE_SUBIDA_MS);

afterAll(async () => {
  await acesso?.encerrar();
  await banco?.parar();
  await instanciaDaFila?.parar();
}, LIMITE_SUBIDA_MS);

// ===========================================================================
// CT-1082 — o contexto nasce da carga, uma vez, na borda
// ===========================================================================

describe('CT-1082 — o efeito da rotina de B não alcança nada da empresa A', () => {
  it(
    'CT-1082 — o contrato de B encerra, o de A não se move, e o registro nasce com o empresa_id de B',
    async () => {
      const empresaA = await admitirEmpresaNova('ct1082-a');
      const empresaB = await admitirEmpresaNova('ct1082-b');

      // Dois pares EQUIVALENTES: fosse só B a ter contrato vencido, "cada empresa pela sua" e "a
      // rotina só achou o de B" seriam indistinguíveis.
      const deA = await semearParVigente(empresaA, 'ct1082-a', DIAS_VENCIDO, SITUACAO_LOCADO);
      const deB = await semearParVigente(empresaB, 'ct1082-b', DIAS_VENCIDO, SITUACAO_LOCADO);

      const registrosDeAAntes = await contarRegistros(empresaA);
      const registrosDeBAntes = await contarRegistros(empresaB);
      expect(registrosDeAAntes).toBe(0);
      expect(registrosDeBAntes).toBe(0);
      expect(await lerEstadoDoPar(empresaA, deA)).toEqual({
        status: 'ATIVO',
        situacaoDoImovel: SITUACAO_LOCADO,
      });

      const fila = montarConsumidor(adaptadorQueLiquida()).fila;

      // Só a tarefa de B é enfileirada. A de A não existe — e é isso que faz a asserção sobre a
      // contagem crua de A significar alguma coisa.
      const tarefa = await executarTarefa(fila, {
        empresaId: empresaB.empresaId,
        rotina: 'ENCERRAMENTO_DE_CONTRATOS',
      });
      expect(await tarefa.getState()).toBe('completed');

      // O que MUDOU em B: o par inteiro, contrato e imóvel.
      expect(await lerEstadoDoPar(empresaB, deB)).toEqual({
        status: 'ENCERRADO',
        situacaoDoImovel: SITUACAO_DISPONIVEL,
      });

      // O que NÃO mudou em A: o par e a contagem crua, idênticos aos de antes.
      expect(await lerEstadoDoPar(empresaA, deA)).toEqual({
        status: 'ATIVO',
        situacaoDoImovel: SITUACAO_LOCADO,
      });
      expect(await contarRegistros(empresaA)).toBe(registrosDeAAntes);

      // E o registro nasceu com o `empresa_id` de B — sem que a borda o tenha escrito: ele vem do
      // contexto que a carga estabeleceu.
      const registrosDeB = await lerRegistros(empresaB);
      expect(registrosDeB).toHaveLength(1);
      expect(registrosDeB[0]).toEqual({
        empresaId: empresaB.empresaId,
        rotina: ROTINA_DO_ENCERRAMENTO,
        resumo: { candidatos: 1, encerrados: 1, preservados: 0 },
      });
    },
    LIMITE_DO_CASO_MS,
  );
});

// ===========================================================================
// CT-1083 — passagem sem trabalho não deixa registro
// ===========================================================================

describe('CT-1083 — o predicado de efeito é declarado por rotina, e a passagem vazia não grava', () => {
  it(
    'CT-1083 — as 4 rotinas concluem sobre empresa vazia sem gravar linha; o controle grava exatamente 1',
    async () => {
      const empresa = await admitirEmpresaNova('ct1083');
      // Um contrato que ainda NÃO venceu: a empresa tem cadastro, e mesmo assim nenhuma das quatro
      // rotinas encontra trabalho. Sem ele, "não gravou porque não havia nada" seria indistinguível
      // de "não gravou porque a empresa está vazia de tudo".
      await semearParVigente(empresa, 'ct1083-futuro', DIAS_A_VENCER, SITUACAO_LOCADO);

      expect(await contarRegistros(empresa)).toBe(0);

      const fila = montarConsumidor(adaptadorQueLiquida()).fila;

      // Uma tarefa por rotina, SEQUENCIAIS: publicá-las juntas deixaria o desfecho dependente da
      // ordem em que o consumidor as apanhou.
      for (const rotina of [
        'ENCERRAMENTO_DE_CONTRATOS',
        'CONFERENCIA_DE_LIQUIDACAO',
        'VIGILANCIA_DAS_ROTINAS',
        'EXPURGO_DO_HISTORICO',
      ] as const) {
        const tarefa = await executarTarefa(fila, { empresaId: empresa.empresaId, rotina });

        expect(await tarefa.getState(), `a rotina ${rotina} não concluiu`).toBe('completed');
      }

      // A asserção do PRD §10, literal: zero linhas depois de quatro passagens sem trabalho.
      expect(await contarRegistros(empresa)).toBe(0);

      // --- O controle positivo, obrigatório -------------------------------------------------
      // Sem ele, o caso seria satisfeito por um consumidor que nunca grava nada.
      await semearParVigente(empresa, 'ct1083-vencido', DIAS_VENCIDO, SITUACAO_LOCADO);

      const controle = await executarTarefa(fila, {
        empresaId: empresa.empresaId,
        rotina: 'ENCERRAMENTO_DE_CONTRATOS',
      });
      expect(await controle.getState()).toBe('completed');

      const registros = await lerRegistros(empresa);
      expect(registros).toHaveLength(1);
      expect(registros[0]?.rotina).toBe(ROTINA_DO_ENCERRAMENTO);
    },
    LIMITE_DO_CASO_MS,
  );

  it(
    'CT-1083 (b) — vigilância e expurgo NÃO estão entre os valores do enum negocio.rotina_agendada',
    async () => {
      // A prova estrutural de que as duas nunca gravam: não há valor de enum para elas, de modo que
      // `registrarExecucaoDeRotina` não as aceitaria nem se alguém a chamasse. É a metade que a
      // contagem em zero não discrimina — uma implementação que gravasse `VIGILANCIA_DAS_ROTINAS`
      // falharia no banco, e não em silêncio.
      const valores = await emUnidade(CONTEXTO_DA_SEMENTE, async (tx) => {
        const linhas = await tx<{ valor: string }[]>`
          SELECT rotulo.enumlabel AS valor
            FROM pg_catalog.pg_enum AS rotulo
            JOIN pg_catalog.pg_type AS tipo ON tipo.oid = rotulo.enumtypid
            JOIN pg_catalog.pg_namespace AS espaco ON espaco.oid = tipo.typnamespace
           WHERE espaco.nspname = 'negocio'
             AND tipo.typname = 'rotina_agendada'
           ORDER BY rotulo.enumsortorder
        `;

        return linhas.map((linha) => linha.valor);
      });

      expect([...valores].sort()).toEqual(
        [ROTINA_ATRASADA, ROTINA_DO_ENCERRAMENTO, ROTINA_DA_CONFERENCIA].sort(),
      );
      expect(valores).not.toContain('VIGILANCIA_DAS_ROTINAS');
      expect(valores).not.toContain('EXPURGO_DO_HISTORICO');
    },
    LIMITE_DO_CASO_MS,
  );
});

// ===========================================================================
// CT-1084 — carga inválida FALHA nomeando o campo
// ===========================================================================

describe('CT-1084 — carga inválida falha nomeando o campo, e nada roda sem contexto', () => {
  it(
    'CT-1084 — as 5 cargas inválidas FALHAM nomeando o campo ofensor; o controle válido conclui',
    async () => {
      const empresa = await admitirEmpresaNova('ct1084');
      const par = await semearParVigente(empresa, 'ct1084', DIAS_VENCIDO, SITUACAO_LOCADO);

      // A precondição que torna o "nada aconteceu" informativo: HÁ trabalho disponível.
      expect(await lerEstadoDoPar(empresa, par)).toEqual({
        status: 'ATIVO',
        situacaoDoImovel: SITUACAO_LOCADO,
      });
      const registrosAntes = await contarRegistros(empresa);
      expect(registrosAntes).toBe(0);

      const fila = montarConsumidor(adaptadorQueLiquida()).fila;

      // Cada linha declara, por IGUALDADE, o conjunto de campos que a tradução do `ZodError` tem de
      // publicar — a asserção não é "falhou", nem "a razão menciona o campo em algum lugar", é
      // "recusou exatamente estes". Ver {@link CAMPOS_RECUSADOS_NA_RAZAO} para por que a razão
      // inteira não serve.
      const invalidas: readonly {
        readonly carga: unknown;
        readonly recusados: readonly string[];
      }[] = [
        // A carga vazia recusa os DOIS campos obrigatórios, e não só o primeiro: `strictObject` emite
        // um problema por chave ausente.
        { carga: {}, recusados: [CAMPO_DA_EMPRESA, CAMPO_DA_ROTINA] },
        { carga: { rotina: 'ENCERRAMENTO_DE_CONTRATOS' }, recusados: [CAMPO_DA_EMPRESA] },
        {
          carga: { empresaId: 'nao-e-uuid', rotina: 'ENCERRAMENTO_DE_CONTRATOS' },
          recusados: [CAMPO_DA_EMPRESA],
        },
        {
          carga: { empresaId: empresa.empresaId, rotina: ROTINA_INEXISTENTE },
          recusados: [CAMPO_DA_ROTINA],
        },
        {
          carga: {
            empresaId: empresa.empresaId,
            rotina: 'ENCERRAMENTO_DE_CONTRATOS',
            [CHAVE_EXCEDENTE]: 1,
          },
          recusados: [CHAVE_EXCEDENTE],
        },
      ];

      const falhadas: TarefaDaRotinaAgendada[] = [];
      for (const invalida of invalidas) {
        falhadas.push(
          await executarTarefa(fila, invalida.carga as CargaDaRotinaAgendada, UMA_TENTATIVA),
        );
      }

      for (const indice of invalidas.keys()) {
        const tarefa = falhadas[indice];

        expect(tarefa, `a tarefa ${String(indice)} não foi enfileirada`).toBeDefined();
        expect(await tarefa?.getState(), `a carga ${String(indice)} não falhou`).toBe('failed');
        expect(tarefa?.failedReason).toBeTypeOf('string');
      }

      // Igualdade sobre o SEGMENTO DISCRIMINANTE da razão, e não contenção sobre a razão inteira —
      // ver {@link CAMPOS_RECUSADOS_NA_RAZAO}. E as CINCO comparadas de uma vez, em vez de uma por
      // volta do laço: a reprovação precisa nomear **todas** as cargas que divergiram, e não parar
      // na primeira. Com a tradução do `ZodError` mutilada para cadeia vazia, o observado é
      // `[[], [], [], [], []]` e as cinco linhas aparecem na diferença.
      expect(falhadas.map((tarefa) => camposRecusadosDe(tarefa.failedReason))).toEqual(
        invalidas.map((invalida) => [...invalida.recusados].sort()),
      );

      const concluidas = (await fila.rotinaAgendada.getCompleted()).map((tarefa) => tarefa.id);
      for (const tarefa of falhadas) {
        expect(concluidas).not.toContain(tarefa.id);
      }

      // Nada foi executado — em particular, a rotina NÃO rodou sem contexto encontrando conjunto
      // vazio como se fosse sucesso, que é o pior desfecho possível.
      expect(await lerEstadoDoPar(empresa, par)).toEqual({
        status: 'ATIVO',
        situacaoDoImovel: SITUACAO_LOCADO,
      });
      expect(await contarRegistros(empresa)).toBe(registrosAntes);

      // --- O controle positivo, obrigatório -------------------------------------------------
      const controle = await executarTarefa(fila, {
        empresaId: empresa.empresaId,
        rotina: 'ENCERRAMENTO_DE_CONTRATOS',
      });

      expect(await controle.getState()).toBe('completed');
      expect(await lerEstadoDoPar(empresa, par)).toEqual({
        status: 'ENCERRADO',
        situacaoDoImovel: SITUACAO_DISPONIVEL,
      });
      expect(await contarRegistros(empresa)).toBe(registrosAntes + 1);
    },
    LIMITE_DO_CASO_MS,
  );
});

// ===========================================================================
// CT-1089 (T6) — a perna de `safeParse` que a T2 delegou a esta task
// ===========================================================================

describe('CT-1089 (T6) — o esquema da carga da rotina recusa por `path` e nomeia a chave excedente', () => {
  // Esta é a metade do `CT-1089` que a §3 da T2 delegou nominalmente aqui, e a razão é registrada
  // lá: as pernas de `safeParse` exigem um esquema Zod, e `@sysloc/shared` **não depende de `zod`**
  // por decisão do docblock dele. O esquema nasce na borda que recebe a carga, e é aqui que ele é
  // exercitado. As pernas ESTÁTICAS da mesma família vivem em `packages/shared/test/fila.spec.ts`.
  //
  // ⚠️ **Ela não substitui o CT-1084, e o CT-1084 não a substitui.** Aquele prova o percurso — a
  // tarefa entra pela fila real e termina em falha retida com a razão publicada; este prova a
  // **forma** da recusa no ponto em que ela nasce, no formato que a
  // `.claude/rules/contrato-publicado.md` fixa: `path` exato para valor inválido, e `code` mais
  // `keys` para chave desconhecida. Sem ele, nada no repositório exercitava
  // `esquemaDaCargaDaRotinaAgendada` diretamente — medido.

  it('CT-1089 (T6) — a carga válida é aceita, com o UUID canonizado pelo contrato', () => {
    const resultado = esquemaDaCargaDaRotinaAgendada.safeParse({
      empresaId: UUID_EM_CAIXA_ALTA,
      rotina: 'ENCERRAMENTO_DE_CONTRATOS',
    });

    // O controle positivo da perna: sem ele, um esquema que recusasse tudo passaria nos negativos.
    expect(resultado.success).toBe(true);
    // E a caixa do UUID é CANONIZADA pelo esquema do contrato (ADR-0017) — caixa não canonizada já
    // foi vetor de escalada, e é este valor que a unidade de trabalho compõe no `SET LOCAL`.
    expect(resultado.data).toEqual({
      empresaId: UUID_EM_CAIXA_ALTA.toLowerCase(),
      rotina: 'ENCERRAMENTO_DE_CONTRATOS',
    });
  });

  it('CT-1089 (T6) — o `empresaId` que não é UUID reprova com o `path` exato', () => {
    const resultado = esquemaDaCargaDaRotinaAgendada.safeParse({
      empresaId: 'nao-e-uuid',
      rotina: 'ENCERRAMENTO_DE_CONTRATOS',
    });

    expect(resultado.success).toBe(false);
    expect(resultado.error?.issues).toHaveLength(1);
    expect(resultado.error?.issues[0]?.path).toEqual([CAMPO_DA_EMPRESA]);
  });

  it('CT-1089 (T6) — a rotina fora da união fechada reprova com o `path` exato', () => {
    const resultado = esquemaDaCargaDaRotinaAgendada.safeParse({
      empresaId: UUID_EM_CAIXA_ALTA.toLowerCase(),
      rotina: ROTINA_INEXISTENTE,
    });

    expect(resultado.success).toBe(false);
    expect(resultado.error?.issues).toHaveLength(1);
    expect(resultado.error?.issues[0]?.path).toEqual([CAMPO_DA_ROTINA]);
  });

  it('CT-1089 (T6) — a chave desconhecida reprova por `unrecognized_keys`, nomeando a chave', () => {
    const resultado = esquemaDaCargaDaRotinaAgendada.safeParse({
      empresaId: UUID_EM_CAIXA_ALTA.toLowerCase(),
      rotina: 'ENCERRAMENTO_DE_CONTRATOS',
      [CHAVE_EXCEDENTE]: 1,
    });

    expect(resultado.success).toBe(false);
    expect(resultado.error?.issues).toHaveLength(1);

    const problema = resultado.error?.issues[0];

    // `code` e `keys`, como a `.claude/rules/contrato-publicado.md` cobra: é a chave EXCEDENTE que
    // precisa ser nomeada, e não apenas "a carga foi recusada". A entrada é FECHADA — `z.object`
    // ignoraria a chave em silêncio, e a carga viraria "o novo request" (ADR-0024).
    expect(problema?.code).toBe('unrecognized_keys');
    expect(problema && 'keys' in problema ? problema.keys : undefined).toEqual([CHAVE_EXCEDENTE]);
  });
});

// ===========================================================================
// CT-1085 — a conferência não depende da entrega da notícia
// ===========================================================================

describe('CT-1085 — com a Entrega DESABILITADA, a conferência diária continua descobrindo', () => {
  it(
    'CT-1085 — a tarefa conclui, as 2 cobranças ganham o fato da liquidação e o resumo traz 2',
    async () => {
      const contexto: Contexto = { empresaId: EMPRESA_A.id };
      const cenario = await semearCenarioBancario(contexto, 'ct1085');

      // A precondição do caso, afirmada e não presumida: a entrega está DESABILITADA antes de a
      // rotina correr. Sem esta linha, "a conferência não depende da entrega" seria vácuo.
      expect((await lerEntrega(contexto))?.situacao).toBe(ENTREGA_DESABILITADA);
      expect(await cobrancasPorEstado(contexto, COBRANCA_PAGA)).toEqual([]);
      expect(await contarRegistros(contexto)).toBe(0);

      const montagem = montarConsumidor(adaptadorQueLiquida());

      const tarefa = await executarTarefa(montagem.fila, {
        empresaId: contexto.empresaId,
        rotina: 'CONFERENCIA_DE_LIQUIDACAO',
      });

      // Ela CONCLUI — não falha, não é pulada: a entrega desabilitada não é pré-requisito da
      // conferência.
      expect(await tarefa.getState()).toBe('completed');

      // O par (fila, identificador) publicado no diário é VERDADEIRO: quem provocou esta passada foi
      // o relógio, pela fila da rotina agendada, e é o nome dela que a linha traz. A execução da
      // conferência é compartilhada com o pedido do Admin, e enquanto ela escrevia o nome da fila da
      // conferência como literal, o `idTarefa` ao lado — que é da fila `rotina-agendada` — mandava
      // quem investigasse procurar na fila errada.
      const fechoDaConferencia = montagem
        .eventos()
        .filter((evento) => evento.mensagem === MENSAGEM_DO_FECHO_DA_CONFERENCIA);

      expect(fechoDaConferencia).toHaveLength(1);
      expect(fechoDaConferencia[0]).toMatchObject({
        idTarefa: tarefa.id,
        fila: FILA_DA_ROTINA_AGENDADA,
        empresaId: contexto.empresaId,
      });

      // O FATO da liquidação foi gravado nas duas, e a derivação passou a publicá-las como `PAGA`.
      // Nenhuma coluna de estado foi movida (ADR-0022): `status` é da visão.
      expect(await liquidacoesGravadas(contexto)).toEqual(
        cenario.codigos.map((codigo) => ({
          codigo,
          pagoEm: DATA_DO_PAGAMENTO,
          dataCredito: DATA_DO_PAGAMENTO,
          valorCreditado: VALOR_DA_COBRANCA.toFixed(2),
        })),
      );
      expect(await cobrancasPorEstado(contexto, COBRANCA_PAGA)).toEqual(cenario.codigos);

      // O resumo gravado é PROFUNDAMENTE igual ao declarado — e a chave é a do vocabulário do
      // produto, não a do desfecho da apuração.
      const registros = await lerRegistros(contexto);
      expect(registros).toHaveLength(1);
      expect(registros[0]).toEqual({
        empresaId: contexto.empresaId,
        rotina: ROTINA_DA_CONFERENCIA,
        resumo: { liquidacoesDescobertas: COBRANCAS_DO_CENARIO_BANCARIO },
      });

      // E a rotina NÃO religou a entrega — ela não a toca.
      expect((await lerEntrega(contexto))?.situacao).toBe(ENTREGA_DESABILITADA);
    },
    LIMITE_DO_CASO_MS,
  );

  it(
    'CT-1085 (b) — falhada a 1ª ativação DEPOIS de abrir, a repetição REFAZ a passada e conclui',
    async () => {
      // O companheiro que discrimina o modo de falha de RECUPERAÇÃO, e ele reprova com o código da
      // rodada 2. A abertura da conferência commita numa unidade própria, ANTES de a passada começar;
      // quando a passada levanta depois disso, a linha fica `concluida_em IS NULL`. Se a ativação
      // seguinte lesse `iniciadaAgora: false` como "outra passagem está trabalhando", ela terminaria
      // `completed` sem trabalhar — e a empresa ficaria com a conferência travada PARA SEMPRE, porque
      // o `conferencia_bancaria_em_andamento_uidx` faz todo disparo seguinte reencontrar a mesma
      // linha, inclusive o do botão do Admin. O que separa as duas causas é o estado da PRÓPRIA
      // tarefa.
      const contexto: Contexto = { empresaId: EMPRESA_B.id };
      const cenario = await semearCenarioBancario(contexto, 'ct1085b');

      expect(await conferenciasDaEmpresa(contexto)).toEqual({ total: 0, concluidas: 0 });
      expect(await contarRegistros(contexto)).toBe(0);

      // A porta levanta na PRIMEIRA consulta e liquida em todas as seguintes: é o efeito observável
      // do percurso real — a resposta ruim do provedor na primeira ativação, e o provedor de pé na
      // repetição. Ela é implementação da mesma interface da produção, e o domínio não sabe que a
      // falha foi provocada.
      const adaptador = adaptadorQueLevantaNaPrimeiraConsulta();
      const montagem = montarConsumidor(adaptador.porta);

      const tarefa = await executarTarefa(montagem.fila, {
        empresaId: contexto.empresaId,
        rotina: 'CONFERENCIA_DE_LIQUIDACAO',
      });

      // A âncora antivácuo, e ela vem ANTES por ser precondição: a primeira ativação de fato falhou e
      // a fila de fato repetiu. Sem ela, uma porta que nunca levantasse faria o caso passar sem
      // exercitar a reentrada. ⚠️ Ela é sobre a TAREFA, e não sobre o adaptador: a contagem de
      // consultas é **consequência** do conserto, e afirmá-la aqui faria a reprovação apontar o
      // sintoma (`esperava mais de 1 consulta`) em vez da causa (`a conferência ficou aberta`).
      expect(tarefa.attemptsMade).toBeGreaterThan(0);

      // E a tarefa CONCLUI — mas concluir não é a asserção: é a precondição das que vêm abaixo. Com
      // o código anterior ela também concluía, e concluía **sem ter feito nada**.
      expect(await tarefa.getState()).toBe('completed');

      // ⚠️ ESTAS são as asserções que discriminam. UMA conferência foi aberta — a repetição não abriu
      // uma segunda, porque o índice único parcial não deixaria —, e ela está CONCLUÍDA. É esta linha
      // que reprova com o código anterior, com `concluidas: 0`: a linha aberta e nunca fechada é
      // exatamente o estado que trava a empresa.
      expect(await conferenciasDaEmpresa(contexto)).toEqual({ total: 1, concluidas: 1 });

      // O provedor foi consultado de novo na segunda ativação — a passada foi REFEITA, e não pulada.
      expect(adaptador.consultas).toBeGreaterThan(1);

      // O trabalho foi REFEITO: as duas cobranças ganharam o fato da liquidação e a derivação passou
      // a publicá-las como `PAGA`.
      expect(await cobrancasPorEstado(contexto, COBRANCA_PAGA)).toEqual(cenario.codigos);

      // E a passagem deixou registro, com o resumo do que ela de fato descobriu.
      const registros = await lerRegistros(contexto);
      expect(registros).toHaveLength(1);
      expect(registros[0]).toEqual({
        empresaId: contexto.empresaId,
        rotina: ROTINA_DA_CONFERENCIA,
        resumo: { liquidacoesDescobertas: COBRANCAS_DO_CENARIO_BANCARIO },
      });

      // A reentrada é ANUNCIADA, e em nível de alerta: a linha é o que diz ao operador que houve uma
      // falha antes desta ativação — a repetição recuperou, e não passou por cima em silêncio.
      const reentradas = montagem
        .eventos()
        .filter((evento) => evento.mensagem === MENSAGEM_DA_REENTRADA_DA_CONFERENCIA);

      expect(reentradas).toHaveLength(1);
      expect(reentradas[0]).toMatchObject({
        nivel: NIVEL_DA_RECUPERACAO,
        fila: FILA_DA_ROTINA_AGENDADA,
        empresaId: contexto.empresaId,
      });
    },
    LIMITE_DO_CASO_MS,
  );

  it(
    'CT-1085 (c) — na PRIMEIRA ativação, a apuração já em andamento faz a passagem não trabalhar',
    async () => {
      // O companheiro do `(b)`, e é ele que cobre a OUTRA perna do discriminador. `iniciadaAgora:
      // false` tem duas causas, e `conferirAsLiquidacoes` as separa por `ehReentrada`: aqui a
      // ativação é a PRIMEIRA, de modo que a apuração em curso é de outra passagem — e esta não
      // trabalha. Sem este caso, **apagar o ramo inteiro** deixaria a suíte verde: as duas
      // reprovações abaixo são a única coisa que mantém a guarda viva (Protocolo Antirregressão §7).
      const contexto: Contexto = { empresaId: EMPRESA_A.id };
      const cenario = await semearCenarioBancario(contexto, 'ct1085c');

      // A precondição, pela PORTA DE PRODUÇÃO: uma apuração aberta e não concluída, como a que uma
      // passagem concorrente teria deixado. `iniciadaAgora` é afirmado, e não presumido — um arranjo
      // que reencontrasse uma conferência antiga montaria outro cenário.
      const emCurso = await emUnidade(
        contexto,
        async (tx) => await abrirConferencia(tx, { solicitadaPor: null }),
      );
      expect(emCurso.iniciadaAgora).toBe(true);

      // O estado capturado ANTES — as três asserções abaixo são relativas a ele, e não a números
      // absolutos: a empresa da carga inicial é compartilhada com o `CT-1085`, e um esperado fixo
      // faria o caso depender da ordem de execução do arquivo.
      const conferenciasAntes = await conferenciasDaEmpresa(contexto);
      const registrosAntes = await contarRegistros(contexto);
      const pagasAntes = await cobrancasPorEstado(contexto, COBRANCA_PAGA);

      // As cobranças deste cenário estão FORA das pagas de antes — é o que dá conteúdo à asserção de
      // igualdade lá embaixo.
      expect(pagasAntes.filter((codigo) => cenario.codigos.includes(codigo))).toEqual([]);

      const montagem = montarConsumidor(adaptadorQueLiquida());

      const tarefa = await executarTarefa(montagem.fila, {
        empresaId: contexto.empresaId,
        rotina: 'CONFERENCIA_DE_LIQUIDACAO',
      });

      // ⚠️ A precondição que faz o caso ser sobre a perna CERTA: houve **uma** ativação, e ela é a
      // primeira. Sem afirmá-la, uma tarefa que tivesse falhado e repetido escorregaria para o ramo
      // da reentrada e o caso provaria o oposto do que persegue.
      //
      // ⚠️ **O valor é `1`, e não `0`** — medido. O `0` do docblock de `ehReentrada` descreve o job
      // **entregue ao processador** na primeira ativação; o objeto relido de `getJob()` depois do
      // término já contabiliza a tentativa que teve sucesso. `1` é, portanto, exatamente *"uma
      // tentativa, e nenhuma repetição"*, que é o que este caso precisa: a repetição do `(b)` mede
      // `> 0` sobre o mesmo contador porque lá a leitura acontece depois de duas.
      expect(await tarefa.getState()).toBe('completed');
      expect(tarefa.attemptsMade).toBe(1);

      // E o ramo tomado é afirmado pelo COMPORTAMENTO observável, e não só pelo contador: a linha da
      // reentrada não existe. É ela que apareceria se o `&&` de `conferirAsLiquidacoes` fosse
      // invertido — e o contador sozinho não distinguiria os dois ramos.
      expect(
        montagem
          .eventos()
          .filter((evento) => evento.mensagem === MENSAGEM_DA_REENTRADA_DA_CONFERENCIA),
      ).toEqual([]);

      // ⚠️ ESTAS discriminam. Apagar o ramo faria a passagem trabalhar POR CIMA da apuração alheia:
      // `concluidas` subiria, as cobranças deste cenário entrariam nas pagas, e a passagem deixaria
      // registro. As três permanecem exatamente como estavam.
      expect(await conferenciasDaEmpresa(contexto)).toEqual(conferenciasAntes);
      expect(await cobrancasPorEstado(contexto, COBRANCA_PAGA)).toEqual(pagasAntes);
      expect(await contarRegistros(contexto)).toBe(registrosAntes);

      // E a passagem ANUNCIA que não trabalhou, em informação — nada falhou aqui, ao contrário da
      // reentrada do `(b)`, que sai em alerta.
      const concorrentes = montagem
        .eventos()
        .filter((evento) => evento.mensagem === MENSAGEM_DA_APURACAO_CONCORRENTE);

      expect(concorrentes).toHaveLength(1);
      expect(concorrentes[0]).toMatchObject({
        nivel: NIVEL_DE_INFORMACAO,
        idTarefa: tarefa.id,
        fila: FILA_DA_ROTINA_AGENDADA,
        empresaId: contexto.empresaId,
        conferenciaId: emCurso.id,
      });

      // ⚠️ **Este caso termina deixando a apuração ABERTA**, e é assim que ele tem de terminar: o que
      // ele prova é que a passagem não a fecha. Consequência para quem vier depois — ele é o **último**
      // do `describe`, e um caso novo sobre a empresa da carga inicial teria de fechar essa linha
      // primeiro, porque `abrirConferencia` a reencontraria com `iniciadaAgora: false`.
    },
    LIMITE_DO_CASO_MS,
  );
});

// ===========================================================================
// CT-1086 — a vigilância grita pela rotina parada, e cala pelas em dia
// ===========================================================================

describe('CT-1086 — a vigilância nomeia a rotina parada e cala sobre as que estão em dia', () => {
  it(
    'CT-1086 — exatamente 1 linha `error`, com o limiar LIDO do contrato, e nenhum registro novo',
    async () => {
      const empresa = await admitirEmpresaNova('ct1086');
      // A empresa é envelhecida além de qualquer limiar: sem isso, o eixo de `atrasada` para a
      // rotina sem execução seria a admissão dela, e não a última execução — que é o que este caso
      // mede.
      await envelhecerEmpresa(empresa, IDADE_DA_EMPRESA_VELHA);

      const ultimaDaAtrasada = await semearExecucaoEm(
        empresa,
        ROTINA_ATRASADA,
        MINUTOS_DA_ROTINA_ATRASADA,
      );
      await semearExecucaoEm(empresa, ROTINA_DO_ENCERRAMENTO, MINUTOS_DA_DIARIA_EM_DIA);
      await semearExecucaoEm(empresa, ROTINA_DA_CONFERENCIA, MINUTOS_DA_SEGUNDA_DIARIA_EM_DIA);

      const registrosAntes = await contarRegistros(empresa);
      expect(registrosAntes).toBe(3);

      const montagem = montarConsumidor(adaptadorQueLiquida());

      const tarefa = await executarTarefa(montagem.fila, {
        empresaId: empresa.empresaId,
        rotina: 'VIGILANCIA_DAS_ROTINAS',
      });
      expect(await tarefa.getState()).toBe('completed');

      const linhasDeErro = montagem.eventos().filter((evento) => evento.nivel === NIVEL_DE_ALERTA);
      const alertas = linhasDeErro.filter((evento) => typeof evento.rotina === 'string');

      // A contagem TOTAL de linhas `error`, e não só a das que nomeiam rotina: sem ela, uma linha
      // vermelha espúria **sem** o campo `rotina` — a falha de conexão da fila, um alerta novo escrito
      // por engano — escaparia do filtro abaixo, e o "exatamente uma" deixaria de significar
      // "exatamente uma".
      expect(linhasDeErro).toHaveLength(1);

      // Igualdade de CONJUNTO, e não contenção: as duas direções precisam reprovar — a rotina que
      // sumiu do alerta e a que apareceu sem estar atrasada.
      expect(alertas.map((alerta) => alerta.rotina)).toEqual([ROTINA_ATRASADA]);

      // E a linha nomeia empresa, rotina, quando foi a última vez e contra que limiar — com o
      // limiar LIDO do contrato, nunca um literal deste arquivo.
      expect(alertas[0]).toMatchObject({
        empresaId: empresa.empresaId,
        rotina: ROTINA_ATRASADA,
        ultimaExecucao: ultimaDaAtrasada,
        limiarMinutos: LIMIAR_DE_ATRASO_POR_CADENCIA.A_CADA_MINUTO,
      });

      // A vigilância LÊ, e não escreve (ADR-0022): a contagem crua não se moveu.
      expect(await contarRegistros(empresa)).toBe(registrosAntes);
    },
    LIMITE_DO_CASO_MS,
  );
});

// ---------------------------------------------------------------------------
// Acessórios — a fiação da operação
// ---------------------------------------------------------------------------

/** O que a montagem devolve: a fila conectada e as linhas que o registrador escreveu. */
interface Montagem {
  readonly fila: Fila;
  /** Os eventos já desserializados, na ordem em que o registrador os escreveu. */
  eventos(): Record<string, unknown>[];
}

/**
 * Conecta a fila real e registra o consumidor da rotina agendada com o adaptador informado.
 *
 * É a **mesma** fiação de `apps/worker/src/main.ts`: `conectarFila` mais
 * `processar(fila.rotinaAgendada, …)`, com a borda recebendo o acesso ao banco, o adaptador, a guarda
 * e a chave de cifra por parâmetro. A única diferença é qual implementação da porta a composição
 * injeta — e é justamente essa a diferença que a operação também tem entre si mesma e a verificação.
 *
 * ⚠️ **Uma fila por caso, e nunca em laço.** Cada chamada registra um consumidor novo na MESMA fila;
 * dois vivos ao mesmo tempo competem pela tarefa, e o desfecho passa a depender de qual venceu.
 *
 * O destino do registrador é um coletor em memória — o **mesmo parâmetro** que a unidade systemd usa
 * para apontar o journal —, e é por ele que o CT-1086 lê os alertas. Nenhum dublê de módulo, nenhum
 * gancho novo em `@sysloc/shared`.
 */
function montarConsumidor(adaptador: AdaptadorCobrancaBancaria): Montagem {
  const linhas: string[] = [];
  const logger = criarLogger({
    // `debug` para que a linha de fecho da passagem sem efeito também caiba no coletor: filtrar em
    // `info` esconderia metade do que esta borda escreve.
    nivel: 'debug',
    destino: {
      write(linha: string): void {
        linhas.push(linha);
      },
    },
  });

  const fila = conectarFila(instanciaDaFila.cadeiaConexao, logger);
  onTestFinished(async () => {
    await fila.encerrar();
  });

  fila.processar(
    fila.rotinaAgendada,
    async (tarefa, registrador) =>
      await processarRotinaAgendada(tarefa, registrador, {
        banco: acesso,
        adaptador,
        guarda: guardaDeProducao(),
        chaveDeCifra: CHAVE_DE_CIFRA,
      }),
  );

  return {
    fila,
    eventos: () => linhas.map((linha) => JSON.parse(linha) as Record<string, unknown>),
  };
}

/** A guarda de produção, apontada para o diretório efêmero deste arquivo. */
function guardaDeProducao(): GuardaDeBoletos {
  return criarGuardaDeBoletos(diretorioDosBoletos);
}

/**
 * A operação que a passagem **não** deve chamar — levanta nomeando-se.
 *
 * É asserção, e não zelo: uma conferência que emitisse ou pedisse revogação derrubaria o caso no
 * ponto, em vez de passar despercebida por ninguém ter olhado.
 */
function operacaoNaoEsperada(nome: string): () => Promise<never> {
  return async () => {
    throw new Error(`a rotina chamou uma operação que ela não deve chamar: ${nome}`);
  };
}

/**
 * Uma implementação de `AdaptadorCobrancaBancaria` que responde **liquidado** para todo título.
 *
 * O valor informado é **igual** ao esperado, de propósito: o que este arquivo mede é a origem do
 * contexto e o predicado de efeito, e não a divergência de valor — que tem caso próprio em
 * `packages/cobranca-bancaria/test/conferencia.spec.ts`.
 */
function adaptadorQueLiquida(): AdaptadorCobrancaBancaria {
  return {
    consultarSituacao: async () => ({
      aceito: true,
      valor: {
        situacao: 'LIQUIDADO',
        pagoEm: DATA_DO_PAGAMENTO,
        valorPago: VALOR_DA_COBRANCA,
        documento: null,
      },
    }),
    emitir: operacaoNaoEsperada('emitir'),
    solicitarRevogacaoDeBoleto: operacaoNaoEsperada('solicitarRevogacaoDeBoleto'),
    confirmarRevogacaoDeBoleto: operacaoNaoEsperada('confirmarRevogacaoDeBoleto'),
  };
}

/** O adaptador do CT-1085 (b), com a contagem de consultas que serve de âncora antivácuo. */
interface AdaptadorComContagem {
  readonly porta: AdaptadorCobrancaBancaria;
  /** Quantas vezes o provedor foi consultado — soma das duas ativações. */
  readonly consultas: number;
}

/**
 * Uma porta que **levanta na primeira consulta** e liquida em todas as seguintes.
 *
 * É o efeito observável do percurso real que o `CT-1085 (b)` persegue: a resposta ruim do provedor na
 * primeira ativação da tarefa, e o provedor de pé na repetição. Ela é implementação da **mesma**
 * interface pela qual a produção é exercitada — a falha entra pela porta, e o domínio não sabe que
 * foi provocada.
 *
 * ⚠️ **A falha acontece DEPOIS de a conferência ter sido aberta e comitada**, que é a precondição do
 * caso: `abrirConferencia` corre numa unidade própria, antes de a passada tocar o provedor.
 */
function adaptadorQueLevantaNaPrimeiraConsulta(): AdaptadorComContagem {
  const marca = { consultas: 0 };

  const porta: AdaptadorCobrancaBancaria = {
    consultarSituacao: async () => {
      marca.consultas += 1;

      if (marca.consultas === 1) {
        throw new Error(FALHA_DO_PROVEDOR);
      }

      return {
        aceito: true,
        valor: {
          situacao: 'LIQUIDADO',
          pagoEm: DATA_DO_PAGAMENTO,
          valorPago: VALOR_DA_COBRANCA,
          documento: null,
        },
      };
    },
    emitir: operacaoNaoEsperada('emitir'),
    solicitarRevogacaoDeBoleto: operacaoNaoEsperada('solicitarRevogacaoDeBoleto'),
    confirmarRevogacaoDeBoleto: operacaoNaoEsperada('confirmarRevogacaoDeBoleto'),
  };

  return {
    porta,
    get consultas(): number {
      return marca.consultas;
    },
  };
}

/**
 * Enfileira a carga e espera a tarefa alcançar estado terminal, por **sondagem**.
 *
 * `completed` e `failed` são os dois estados terminais; `delayed` e `waiting` — que é onde a tarefa
 * fica entre as tentativas da política de repetição — **não** encerram a espera.
 */
async function executarTarefa(
  fila: Fila,
  carga: CargaDaRotinaAgendada,
  tentativas?: number,
): Promise<TarefaDaRotinaAgendada> {
  const enfileirada = await fila.rotinaAgendada.add(
    FILA_DA_ROTINA_AGENDADA,
    carga,
    tentativas === undefined ? {} : { attempts: tentativas },
  );
  const id = enfileirada.id;

  if (typeof id !== 'string' || id.length === 0) {
    throw new Error('o servidor de fila não atribuiu identificador à tarefa enfileirada');
  }

  await sondarAte(
    `a tarefa ${id} alcançar estado terminal`,
    async () => {
      const estado = await (await fila.rotinaAgendada.getJob(id))?.getState();

      return estado === 'completed' || estado === 'failed';
    },
    LIMITE_ESTADO_TERMINAL_MS,
  );

  const terminada = await fila.rotinaAgendada.getJob(id);
  if (terminada === undefined) {
    throw new Error(`a tarefa ${id} desapareceu da fila antes da leitura do estado final`);
  }

  return terminada;
}

/**
 * Os campos que a tradução do `ZodError` publicou na razão da falha, **ordenados**, ou `[]`.
 *
 * Ela lê **só** o que vem depois de `(recusado: ` — o segmento que o prefixo fixo da exigência não
 * alcança (ver {@link CAMPOS_RECUSADOS_NA_RAZAO}). A ordenação existe para que a asserção não dependa
 * da ordem em que a biblioteca de esquema emite os problemas, que não é contrato; o que ela afirma é
 * **quais** campos foram recusados, por igualdade.
 *
 * O segmento vazio devolve `[]`, e não `['']`: é o valor que a tradução mutilada produz, e ele
 * precisa reprovar contra qualquer conjunto declarado. A razão sem o segmento levanta **nomeando** o
 * texto recebido — um `[]` silencioso ali faria a asserção comparar vazio com vazio nos casos em que
 * o esperado também fosse vazio.
 */
function camposRecusadosDe(razao: string | undefined): string[] {
  if (typeof razao !== 'string') {
    throw new Error('a tarefa falhada não publicou razão alguma');
  }

  const segmento = CAMPOS_RECUSADOS_NA_RAZAO.exec(razao)?.[1];

  if (segmento === undefined) {
    throw new Error(`a razão da falha não traz o segmento de campos recusados: ${razao}`);
  }

  return segmento
    .split(',')
    .map((campo) => campo.trim())
    .filter((campo) => campo.length > 0)
    .sort();
}

// ---------------------------------------------------------------------------
// O arranjo — sempre pelas portas de produção
// ---------------------------------------------------------------------------

/**
 * Executa o trabalho sob o contexto informado, dentro de uma unidade de trabalho.
 *
 * **Aplicação parcial** da casa compartilhada do diretório sobre o acesso que este arquivo abriu — a
 * convenção *"acessório de suíte se importa, não se copia"* do `CLAUDE.md`. A casa não existia em
 * `apps/worker/test/` e nasceu com esta task, em `./acessorios-de-borda.ts`; o docblock dela registra
 * por que a de `packages/db/test/` **não serve** aqui (fronteira `dist/` × fonte, medida) e o débito
 * das 6 declarações locais que restam.
 */
async function emUnidade<T>(
  contexto: Contexto,
  trabalho: (tx: TransactionSql) => Promise<T>,
): Promise<T> {
  return await emUnidadeSobContexto(acesso, contexto, trabalho);
}

/**
 * Admite uma empresa nova e devolve o contexto dela.
 *
 * `identidade.empresa` não tem política (ADR-0009), de modo que a admissão corre sob qualquer contexto
 * válido — e ela é a porta pública do pacote, a mesma que o Master usa.
 */
async function admitirEmpresaNova(marca: string): Promise<Contexto> {
  empresasAdmitidas += 1;
  const documento = `88${String(empresasAdmitidas).padStart(12, '0')}`;

  const criada = await emUnidade(
    CONTEXTO_DA_SEMENTE,
    async (tx) => await admitirEmpresa(tx, { nome: `Imobiliária ${marca}`, documento }),
  );

  if (criada === undefined) {
    throw new Error(`o arranjo não conseguiu admitir a empresa ${marca}`);
  }

  return { empresaId: criada.id };
}

/** O par contrato–imóvel que os casos do encerramento leem. */
interface ParSemeado {
  readonly contratoCodigo: string;
  readonly imovelId: string;
}

/** O que a cadeia semeada devolve — o suficiente para ativar, emitir boleto ou conferir. */
interface CadeiaSemeada {
  readonly contratoId: string;
  readonly contratoCodigo: string;
  readonly imovelId: string;
  readonly cobrancaCodigo: string;
}

/** O contador que mantém documentos e identificadores municipais distintos entre os cenários. */
let sequenciaDoCenario = 0;

/** Um cadastro de pessoa mínimo — a conferência de dígito verificador é do contrato, não da porta. */
let proximoDocumento = 62_000_000_000;

function pessoaDe(nome: string): DadosDaPessoa {
  proximoDocumento += 1;

  return {
    nome,
    tipoPessoa: 'PESSOA_FISICA',
    documentoPrincipal: String(proximoDocumento),
    rg: null,
    email: `${nome.toLowerCase().replaceAll(' ', '-')}@exemplo.invalid`,
    telefone: '11999990000',
    logradouro: 'Rua das Acácias',
    numero: '100',
    complemento: null,
    bairro: 'Centro',
    cidade: 'São Paulo',
    estado: 'SP',
    cep: '01000000',
  };
}

/**
 * Semeia `conjunto → imóvel → pessoas → contrato → cobrança`, **sempre pelas portas de produção**.
 *
 * As duas séries são emitidas pelo protocolo das **duas unidades sequenciais** (ADR-0020/0033): a
 * primeira garante o contador e **commita**; a segunda emite o número e grava. Fundir as duas é o
 * desenho que a ADR recusa, e um arranjo que o fizesse montaria o cenário por um caminho que a
 * operação não tem — exatamente o que a Iron Law #6 proíbe.
 *
 * O contrato nasce em **rascunho**: quem precisa dele vigente o ativa por fora, com o código que esta
 * função devolve, reproduzindo a composição de `ContratoService.ativar`.
 */
async function semearCadeia(contexto: Contexto, marcaBase: string): Promise<CadeiaSemeada> {
  sequenciaDoCenario += 1;
  const marca = `${marcaBase}-${String(sequenciaDoCenario)}`;

  const cadastros = await emUnidade(contexto, async (tx) => {
    const conjunto = await criarConjunto(tx, { nome: `Conjunto ${marca}` });
    const imovel = await criarImovel(tx, {
      conjuntoId: conjunto.id,
      nomeImovel: `Imóvel ${marca}`,
      identificadorMunicipal: `IPTU-${marca}`,
      tipoImovel: 'RESIDENCIAL',
      logradouro: 'Rua das Acácias',
      numero: '100',
      complemento: null,
      bairro: 'Centro',
      cidade: 'São Paulo',
      estado: 'SP',
      cep: '01000000',
      // Literal, e não a constante do arquivo: `criarImovel` aceita só as duas situações de
      // CADASTRO — `LOCADO` nasce da ativação do contrato, pela porta estreita.
      statusLocacao: 'DISPONIVEL',
      observacoes: null,
    });
    const locador = await criarPessoa(tx, 'locador', pessoaDe(`Locador ${marca}`));
    const locatario = await criarPessoa(tx, 'locatario', pessoaDe(`Locatário ${marca}`));

    return { imovelId: imovel.id, locadorId: locador.id, locatarioId: locatario.id };
  });

  const anoDoContrato = await emUnidade(contexto, lerAnoDaSerieDeContrato);
  await emUnidade(contexto, async (tx) => {
    await garantirContadorDeContrato(tx, anoDoContrato);
  });
  const contrato = await emUnidade(contexto, async (tx) => {
    const numero = await emitirNumeroDeContrato(tx, anoDoContrato);

    return await criarContrato(
      tx,
      {
        imovelId: cadastros.imovelId,
        locadorId: cadastros.locadorId,
        locatarioId: cadastros.locatarioId,
        fiadoresIds: [],
        ...TERMOS_DO_CONTRATO,
      },
      { ano: anoDoContrato, numero },
    );
  });

  const anoDaCobranca = await emUnidade(contexto, lerAnoDaSerieDeCobranca);
  await emUnidade(contexto, async (tx) => {
    await garantirContadorDeCobranca(tx, anoDaCobranca);
  });
  const cobranca = await emUnidade(contexto, async (tx) => {
    const numero = await emitirNumeroDeCobranca(tx, anoDaCobranca);

    return await criarCobranca(
      tx,
      {
        contratoId: contrato.id,
        natureza: 'ALUGUEL',
        referencia: `Aluguel ${marca}`,
        competencia: COMPETENCIA,
        dataVencimento: await dataDeslocada(tx, DIAS_A_VENCER),
        valorOriginal: VALOR_DA_COBRANCA,
      },
      { ano: anoDaCobranca, numero },
    );
  });

  return {
    contratoId: contrato.id,
    contratoCodigo: contrato.codigo,
    imovelId: cadastros.imovelId,
    cobrancaCodigo: cobranca.codigo,
  };
}

/**
 * Semeia a cadeia e deixa o contrato **vigente**, com o fim deslocado em `offsetDias`.
 *
 * A ativação reproduz a composição da borda: `ativarContrato` seguido de
 * `definirSituacaoDeLocacaoDoImovel`, na mesma unidade — as etapas que `ContratoService.ativar`
 * executa. Mesmo molde de `packages/db/test/encerramento-de-contratos.spec.ts`.
 *
 * A data sai de `negocio.data_corrente_da_operacao()` deslocada **no SQL** (ADR-0026): compô-la no
 * processo faria o arranjo medir a diferença entre dois relógios — e ele passaria em 21 das 24 horas
 * do dia.
 */
async function semearParVigente(
  contexto: Contexto,
  marca: string,
  offsetDias: number,
  situacaoDoImovel: SituacaoDeLocacao,
): Promise<ParSemeado> {
  const cadeia = await semearCadeia(contexto, marca);

  await emUnidade(contexto, async (tx) => {
    await ativarContrato(tx, cadeia.contratoCodigo, {
      dataFimLocacao: await dataDeslocada(tx, offsetDias),
      valorTotalContrato: derivarValorTotal(
        TERMOS_DO_CONTRATO.valorMensal,
        TERMOS_DO_CONTRATO.prazoMeses,
      ),
    });

    await definirSituacaoDeLocacaoDoImovel(tx, cadeia.imovelId, situacaoDoImovel);
  });

  return { contratoCodigo: cadeia.contratoCodigo, imovelId: cadeia.imovelId };
}

/** A data corrente da operação deslocada em `dias`, como cadeia `AAAA-MM-DD`. */
async function dataDeslocada(tx: TransactionSql, dias: number): Promise<string> {
  const [linha] = await tx<{ data: string }[]>`
    SELECT to_char(
             negocio.data_corrente_da_operacao() + make_interval(days => ${dias}::integer),
             'YYYY-MM-DD'
           ) AS data
  `;

  if (linha === undefined) {
    throw new Error('o relógio do banco não devolveu a data corrente da operação');
  }

  return linha.data;
}

/**
 * Recua a admissão da empresa em N minutos, **pelo relógio do banco**.
 *
 * `identidade.empresa` nunca teve política (ADR-0009), e por isso o `WHERE id = …` aqui não é o
 * segundo caminho que a ADR-0008 recusa: ali ele **é** o caminho.
 */
async function envelhecerEmpresa(contexto: Contexto, minutos: number): Promise<void> {
  const alcancadas = await emUnidade(contexto, async (tx) => {
    const resultado = await tx`
      UPDATE identidade.empresa
         SET criada_em = now() - make_interval(mins => ${minutos}::integer)
       WHERE id = ${contexto.empresaId}
    `;

    return resultado.count;
  });

  if (alcancadas !== 1) {
    throw new Error(`o arranjo não conseguiu envelhecer a empresa ${contexto.empresaId}`);
  }
}

/**
 * Semeia uma execução com idade controlada, **derivada de `now()` do banco**, e devolve o instante.
 *
 * A porta de produção não abre parâmetro de instante — `ocorrida_em` é o padrão da coluna —, e abrir
 * um para servir a este arranjo daria a quem chama o poder de escolher quando a passagem aconteceu.
 * Por isso o arranjo emite o `INSERT` direto, com a **mesma** expressão de empresa que as políticas
 * avaliam: nada aqui compara `empresa_id` com valor escrito na aplicação. Mesmo molde de
 * `packages/db/test/execucao-de-rotina.spec.ts`.
 *
 * O instante devolvido sai do próprio `RETURNING`, no molde publicado: comparar a linha de alerta
 * contra um instante composto no processo mediria a diferença entre dois relógios.
 */
async function semearExecucaoEm(
  contexto: Contexto,
  rotina: RotinaPublicada,
  minutosAtras: number,
): Promise<string> {
  const [linha] = await emUnidade(
    contexto,
    async (tx) =>
      await tx<{ ocorridaEm: string }[]>`
        INSERT INTO negocio.execucao_de_rotina (empresa_id, rotina, ocorrida_em, resumo)
        VALUES (nullif(current_setting('app.empresa_id', true), '')::uuid,
                ${rotina}::negocio.rotina_agendada,
                now() - make_interval(mins => ${minutosAtras}::integer),
                '{}'::jsonb)
        RETURNING to_char(ocorrida_em AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
                    AS "ocorridaEm"
      `,
  );

  if (linha === undefined) {
    throw new Error(`o arranjo não conseguiu semear a execução de ${rotina}`);
  }

  return linha.ocorridaEm;
}

/**
 * Semeia a empresa bancária: certificado vigente, identidade no provedor, duas cobranças **com
 * boleto** e a entrega da notícia **desabilitada**.
 *
 * ⚠️ **Ela usa a empresa da carga inicial**, e não uma admitida: `registrarCertificado` e
 * `registrarIdentidadeNoProvedor` exigem `registradoPor` com chave estrangeira composta para
 * `identidade.usuario`, e só as empresas da semente têm usuário. Nenhum outro caso deste arquivo toca
 * essa empresa, de modo que as contagens cruas dela continuam sendo do caso.
 *
 * ⚠️ **Medição de 2026-08-23, e ela agrava o `D21 · F4/T9`** — declarar isso é o mínimo que a §3-B
 * cobra de quem acrescenta a enésima cópia. O arranjo *cobrança com boleto e certificado* tinha
 * **três** cópias (`apps/worker/test/conferencia-bancaria.spec.ts`,
 * `apps/api/test/retomada-de-retidas.spec.ts` e `apps/api/test/boleto-da-cobranca.e2e.spec.ts`), e
 * esta é a quarta. **A casa compartilhada `packages/db/test/cenario-de-cobranca.ts` foi tentada e é
 * inutilizável daqui**, pela razão medida em {@link emUnidade}: ela resolve `contextoDeTenant` pelo
 * fonte de `@sysloc/db`, e este pacote o resolve por `dist/` — duas instâncias de
 * `AsyncLocalStorage`, e toda escrita do arranjo cai em `new row violates row-level security
 * policy`. Fechar isso exige uma casa compartilhada de `apps/worker/test/` que consuma a fronteira
 * publicada, e migrar as três cópias existentes para ela; o gatilho do `D21` é *"a primeira task
 * autorizada a abrir as duas suítes irmãs da notícia bancária"*, e **esta task não as abre**. Não
 * escreva a quinta cópia sem fechar o débito.
 */
async function semearCenarioBancario(
  contexto: Contexto,
  marca: string,
): Promise<{ readonly codigos: string[] }> {
  await esvaziarCarteira(contexto);
  await gravarCertificadoVigente(contexto);
  await desabilitarEntrega(contexto);

  const guarda = guardaDeProducao();
  const codigos: string[] = [];

  for (let indice = 0; indice < COBRANCAS_DO_CENARIO_BANCARIO; indice += 1) {
    const semeada = await semearCadeia(contexto, `${marca}-${String(indice)}`);
    const ordem = `${marca}-${String(indice)}-${String(sequenciaDoCenario)}`;
    const nomeDoArquivo = await guarda.gravar(
      semeada.cobrancaCodigo,
      Buffer.from(`${PREFIXO_DO_DOCUMENTO}${ordem}`),
    );

    await emUnidade(contexto, async (tx) => {
      await gravarBoletoDaCobranca(tx, semeada.cobrancaCodigo, {
        numeroDoTituloNoProvedor: `T-${ordem}`,
        linhaDigitavel: `L-${ordem}`,
        codigoDeBarras: `B-${ordem}`,
        identificadorNoProvedor: `I-${ordem}`,
        caminhoDoArquivo: nomeDoArquivo,
      });
    });

    codigos.push(semeada.cobrancaCodigo);
  }

  return { codigos: codigos.sort() };
}

/**
 * Tira do conjunto a conferir tudo o que ficou de execuções anteriores — pela porta de produção.
 *
 * A empresa da carga inicial é a mesma entre execuções da suíte inteira, e uma carteira herdada faria
 * a contagem de liquidações do caso descrever outra coisa.
 */
async function esvaziarCarteira(contexto: Contexto): Promise<void> {
  await emUnidade(contexto, async (tx) => {
    for (const cobranca of await selecionarCobrancasAConferir(tx)) {
      await revogarBoleto(tx, cobranca.codigo);
    }
  });
}

/**
 * Grava um certificado **vigente** e a identidade da empresa perante o provedor.
 *
 * O material é opaco para o banco (ADR-0032) e nada neste arquivo o abre. O que importa é que a borda
 * **o resolve pelo banco** e o decifra com a chave que a composição lhe deu — sem que nada de segredo
 * tenha atravessado a fila.
 */
async function gravarCertificadoVigente(contexto: Contexto): Promise<void> {
  const envelopeCifrado = cifrarSegredo(
    criarSegredoOperavel({
      material: Buffer.concat([
        Buffer.from(`material-${randomUUID()}-`),
        randomBytes(BYTES_DO_MATERIAL),
      ]),
      senha: `senha-${randomUUID()}`,
    }),
    CHAVE_DE_CIFRA,
  );

  const validade = await emUnidade(contexto, async (tx) => {
    const [linha] = await tx<{ de: Date; ate: Date }[]>`
      SELECT (negocio.data_corrente_da_operacao() - INTERVAL '1 day')::timestamptz AS de,
             (negocio.data_corrente_da_operacao() + INTERVAL '365 days')::timestamptz AS ate
    `;

    if (linha === undefined) {
      throw new Error('o relógio do banco não devolveu a validade do certificado do arranjo');
    }

    return linha;
  });

  await emUnidade(contexto, async (tx) => {
    await registrarCertificado(tx, {
      titular: `Empresa ${contexto.empresaId.slice(0, 8)}`,
      validoDe: validade.de,
      validoAte: validade.ate,
      impressaoDigital: randomUUID(),
      segredoCifrado: envelopeCifrado,
      registradoPor: exigirUsuarioDa(contexto.empresaId),
    });

    await registrarIdentidadeNoProvedor(tx, {
      identificadorDaAplicacaoCifrado: cifrarValorOperavel(
        `identificador-${contexto.empresaId.slice(0, 8)}`,
        CHAVE_DE_CIFRA,
      ),
      numeroDoCliente: 33065,
      numeroDaContaCorrente: 380261,
      codigoDaModalidade: 1,
      registradoPor: exigirUsuarioDa(contexto.empresaId),
    });
  });
}

/** Põe a entrega da notícia em DESABILITADA, pela porta de produção. */
async function desabilitarEntrega(contexto: Contexto): Promise<void> {
  await emUnidade(contexto, async (tx) => {
    await gravarDesfechoDaEntrega(tx, {
      situacao: ENTREGA_DESABILITADA,
      motivo: MOTIVO_DA_ENTREGA_DESABILITADA,
      verificadaPor: null,
      referenciaNoProvedor: null,
    });
  });
}

/** O estado da entrega da empresa do contexto, como o banco o guarda. */
async function lerEntrega(contexto: Contexto): Promise<{ readonly situacao: string } | undefined> {
  return await emUnidade(contexto, lerEstadoDaEntrega);
}

/** O usuário que assina os registros de configuração de uma empresa — vem da carga inicial. */
function exigirUsuarioDa(empresaId: string): string {
  const usuario = USUARIOS.find((candidato) => candidato.empresaId === empresaId);

  if (usuario === undefined) {
    throw new Error(`a carga inicial não tem usuário para a empresa ${empresaId}`);
  }

  return usuario.id;
}

// ---------------------------------------------------------------------------
// As leituras cruas — sempre SEM `WHERE empresa_id` (ADR-0008)
// ---------------------------------------------------------------------------

/** O estado do par contrato–imóvel, sob o contexto informado. */
async function lerEstadoDoPar(
  contexto: Contexto,
  par: ParSemeado,
): Promise<{ readonly status: string; readonly situacaoDoImovel: string }> {
  return await emUnidade(contexto, async (tx) => {
    const [linha] = await tx<{ status: string; situacaoDoImovel: string }[]>`
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

/** Quantas linhas de `negocio.execucao_de_rotina` o contexto corrente alcança. */
async function contarRegistros(contexto: Contexto): Promise<number> {
  return await emUnidade(contexto, async (tx) => {
    const [linha] = await tx<{ total: number }[]>`
      SELECT count(*)::integer AS total FROM negocio.execucao_de_rotina
    `;

    if (linha === undefined) {
      throw new Error('a contagem crua de execucao_de_rotina não devolveu linha');
    }

    return linha.total;
  });
}

/** O registro de execução como o banco o guarda — a empresa, a rotina e o resumo. */
interface RegistroLido {
  readonly empresaId: string;
  readonly rotina: string;
  readonly resumo: Record<string, number>;
}

/** As linhas de `negocio.execucao_de_rotina` alcançáveis pelo contexto, na ordem de ocorrência. */
async function lerRegistros(contexto: Contexto): Promise<RegistroLido[]> {
  return await emUnidade(contexto, async (tx) => {
    return await tx<RegistroLido[]>`
      SELECT empresa_id AS "empresaId", rotina::text AS rotina, resumo
        FROM negocio.execucao_de_rotina
       ORDER BY ocorrida_em, rotina
    `;
  });
}

/**
 * Quantas conferências a empresa do contexto tem, e quantas delas estão **concluídas**.
 *
 * É a leitura que discrimina o `CT-1085 (b)`: a conferência aberta e nunca concluída é justamente o
 * estado que trava a empresa, e ele não aparece em nenhuma outra contagem do arquivo. **Sem
 * `WHERE empresa_id`** — quem recorta é a política (ADR-0008).
 */
async function conferenciasDaEmpresa(
  contexto: Contexto,
): Promise<{ readonly total: number; readonly concluidas: number }> {
  return await emUnidade(contexto, async (tx) => {
    const [linha] = await tx<{ total: number; concluidas: number }[]>`
      SELECT count(*)::integer AS total,
             count(*) FILTER (WHERE concluida_em IS NOT NULL)::integer AS concluidas
        FROM negocio.conferencia_bancaria
    `;

    if (linha === undefined) {
      throw new Error('a contagem crua de conferencia_bancaria não devolveu linha');
    }

    return linha;
  });
}

/** Os códigos das cobranças que a visão derivada publica no estado informado, em ordem. */
async function cobrancasPorEstado(contexto: Contexto, estado: string): Promise<string[]> {
  return await emUnidade(contexto, async (tx) => {
    const linhas = await tx<{ codigo: string }[]>`
      SELECT codigo
        FROM negocio.cobranca_derivada
       WHERE status = ${estado}::negocio.status_cobranca
       ORDER BY codigo
    `;

    return linhas.map((linha) => linha.codigo);
  });
}

/** O FATO da liquidação como ele ficou gravado — nunca uma coluna de estado (ADR-0022). */
interface LiquidacaoGravada {
  readonly codigo: string;
  readonly pagoEm: string;
  readonly dataCredito: string;
  readonly valorCreditado: string;
}

/** As cobranças com o fato da liquidação gravado, na ordem do código. */
async function liquidacoesGravadas(contexto: Contexto): Promise<LiquidacaoGravada[]> {
  return await emUnidade(contexto, async (tx) => {
    return await tx<LiquidacaoGravada[]>`
      SELECT codigo,
             to_char(pago_em, 'YYYY-MM-DD') AS "pagoEm",
             to_char(data_credito, 'YYYY-MM-DD') AS "dataCredito",
             valor_creditado::text AS "valorCreditado"
        FROM negocio.cobranca
       WHERE pago_em IS NOT NULL
       ORDER BY codigo
    `;
  });
}
