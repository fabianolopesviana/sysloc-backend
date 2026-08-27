/**
 * O **despachante efêmero** — o processo que o relógio do sistema acorda, enumerando as empresas
 * ativas e enfileirando sem perguntar quem tem trabalho. T8 da fatia `automacoes-agendadas`.
 *
 * ===========================================================================
 * INVARIANTES
 * ===========================================================================
 *
 * | Critério | Caso    | Invariante |
 * |----------|---------|------------|
 * | CA-17    | CT-1075 | Em cada uma das **5** formas de despacho, o conjunto de `empresaId`
 * | CA-13    |         | enfileirados é EXATAMENTE o das empresas com `suspensa_em IS NULL`, com
 * |          |         | **1** tarefa por empresa e total **`2`** — não `3` com uma descartada
 * |          |         | depois. Na linha `manutencao`, `FILA_DA_MANUTENCAO_DO_ACERVO` recebe
 * |          |         | **1** tarefa de carga profundamente igual a `{}` e a fila da rotina
 * |          |         | recebe **2** de `EXPURGO_DO_HISTORICO`. Código de saída `0` em todas. |
 * | CA-02    | CT-1076 | Com a porta de dados recusando a unidade sob o contexto de B, o conjunto
 * |          |         | de tarefas CONCLUÍDAS é exatamente `{A, C}` e o de FALHADAS exatamente
 * |          |         | `{B}`; os contratos vencidos de A e C estão `ENCERRADO` com os imóveis
 * |          |         | `DISPONIVEL`, o de B permanece `ATIVO` com o imóvel `LOCADO`, e as
 * |          |         | tentativas de B são as de `OPCOES_PADRAO_DA_TAREFA`. |
 * | CA-02    | CT-1077 | As **7** partidas inválidas terminam com código ≠ `0` — exatamente `2` na
 * |          |         | rotina desconhecida, na ausente e no nome **herdado do protótipo de
 * |          |         | objeto** —, nomeando a variável que faltou ou os
 * |          |         | valores aceitos, com **`0`** tarefas em TODAS as filas; a varredura de
 * |          |         | segredo sobre a saída devolve `[]` e o controle positivo dela devolve
 * |          |         | todas as agulhas. O controle positivo da partida sai `0` e enfileira. |
 * | CA-02    | CT-1078 | Duas execuções consecutivas, com a primeira tarefa JÁ CONCLUÍDA e ainda
 * | CA-22    |         | retida, publicam **2** tarefas de identificadores DIFERENTES, e a segunda
 * |          |         | sai `0`. Perna estática: **`0`** ocorrências de `jobId` nos fontes novos,
 * |          |         | com prova de falsificação sobre a cópia que o introduz. |
 * | CA-20    | CT-1079 | A retomada reenfileira EXATAMENTE as `RECEBIDO` mais antigas que a folga
 * |          |         | — `2` de `5` semeadas —, com cada carga profundamente igual a
 * |          |         | `{ notificacaoId }` e `Object.keys` exatamente `['notificacaoId']`. |
 * | CA-20    | CT-1079 | A folga da retomada declarada no fonte do despachante é **exatamente** os
 * |          | (b)     | minutos que o nome da cadência de `RETOMADA_DE_NOTICIAS` declara em
 * |          |         | `CADENCIA_DA_ROTINA` — os dois números são o **mesmo fato**, e não duas
 * |          |         | declarações livres para andar separadas. Falsificação: a cadência de 15 min
 * |          |         | reprova a igualdade, e a constante renomeada reprova por leitura ausente. |
 * | CA-01    | CT-1080 | Num disparo só, a fila da régua recebe **2** tarefas (o disparo NÃO
 * |          |         | discrimina); o conjunto de destinatários capturados é EXATAMENTE o dos
 * |          |         | locatários de A, a interseção com os de B é vazia, a contagem crua de
 * |          |         | `envio_de_cobranca` sob B é IDÊNTICA à de antes, e as DUAS tarefas
 * |          |         | CONCLUEM. E o registro da passagem nasce **só** para A, com
 * |          |         | `rotina='AVISO_DE_COBRANCA'` e o resumo das quatro contagens. |
 * | CA-18    | CT-1081 | Com a empresa suspensa, o disparo produz `0` tarefas para ela. Depois da
 * |          |         | reativação, o encerramento produz `{ candidatos: 1, encerrados: 1,
 * |          |         | preservados: 0 }` e o disparo seguinte `{ 0, 0, 0 }` — **uma** vez, não
 * |          |         | N. E o disparo do aviso, com a JANELA ABERTA, captura `0` destinatários
 * |          |         | para as cobranças que atravessaram a suspensão, com `0` linhas
 * |          |         | `ENVIADA` novas para elas — enquanto a cobrança de controle É avisada. |
 *
 * Rastreabilidade: `CA-17, CA-13 → CT-1075 (RD-09)` · `CA-02 → CT-1076 (RD-12)` ·
 * `CA-02 → CT-1077 (RD-02)` · `CA-02, CA-22 → CT-1078 (RD-13)` · `CA-20 → CT-1079 (RD-21)` ·
 * `CA-20 → CT-1079 (b) (RD-21)` ·
 * `CA-01 → CT-1080 (RD-06)` · `CA-18 → CT-1081 (RD-08)`.
 *
 * ===========================================================================
 * O CAMINHO É O DA OPERAÇÃO — o despachante roda como SUBPROCESSO REAL
 * ===========================================================================
 *
 * Nada aqui importa uma função de `../src/despachante.ts` para "executar o despacho": o ponto de
 * entrada é lançado como **processo separado**, com `node dist/despachante.js <rotina>` e o ambiente
 * montado **variável a variável**, exatamente como a unidade `Type=oneshot` o executa. É a única
 * forma de observar o **código de saída**, que é metade do contrato desta task — e é o que impede
 * este arquivo de forçar a produção a exportar um ramo de teste (Iron Law #6).
 *
 * O ambiente **não é herdado**: ele é construído do zero em cada lançamento. É isso que permite provar
 * a recusa por variável ausente sem que a montagem de um cenário vaze para o vizinho.
 *
 * ===========================================================================
 * A ENUMERAÇÃO SÓ É OBSERVÁVEL SE O CONJUNTO DE ATIVAS FOR CONHECIDO
 * ===========================================================================
 *
 * A carga inicial (`semente.ts`) já admite duas empresas **ativas**, e elas seriam enumeradas junto
 * com as do cenário — o total deixaria de ser `2` e a igualdade de conjunto viraria contenção
 * disfarçada. Por isso todo caso começa por {@link suspenderTodasAsEmpresas}, que corre pela **porta
 * de produção** (`suspenderEmpresa`, idempotente por `coalesce`) sobre os identificadores lidos de
 * `identidade.empresa` — schema que nunca teve política (ADR-0009), onde o `WHERE id` **é** o caminho.
 *
 * ⚠️ **A leitura do arranjo é crua de propósito, e não usa `listarEmpresasAtivas`**: o arranjo não pode
 * depender do símbolo sob prova. Uma enumeração quebrada faria o arranjo suspender o conjunto errado,
 * e a asserção passaria a concordar com o defeito.
 *
 * ===========================================================================
 * A ESPERA É POR SONDAGEM, com limite declarado no topo
 * ===========================================================================
 *
 * Nenhuma pausa fixa (`.claude/rules/testing-stack.md`): o que se espera é o **estado terminal da
 * tarefa**, observado no próprio servidor de fila. E **um consumidor por caso**, nunca em laço: dois
 * vivos na mesma fila competem pela tarefa, e o desfecho passa a depender de qual venceu.
 *
 * ===========================================================================
 * De onde vêm o banco e a fila (ADR-0006)
 * ===========================================================================
 *
 * De instâncias efêmeras **próprias**, descartadas ao fim. Nenhuma coordenada é lida do ambiente: a
 * cadeia do banco é a que `bancoEfemero()` devolve e a da fila é a que `redisEfemero()` devolve, e as
 * duas são passadas ao subprocesso por variável explícita. **Nenhum `WHERE empresa_id` é escrito neste
 * arquivo**, nem nas contagens cruas: quem recorta é a política (ADR-0008). As exceções são as
 * escritas e leituras de arranjo em `identidade.empresa`, schema sem política.
 */

// DÉBITO COM GATILHO — D17 · F5/T8 · registrado 2026-08-23
// (NÃO é uma `DECISÃO FECHADA`: ele agenda uma convergência, não protege o código abaixo.)
// O QUÊ: o lançador de subprocesso com ambiente montado explicitamente
//        ({@link executarDespachante}) passa a ter DUAS declarações privadas no repositório — esta e
//        `executarCenario`, em `packages/shared/test/ambiente-efemero.spec.ts`. Medido em
//        2026-08-23: `grep -rln "env: ambiente" --include='*.spec.ts' apps packages` devolve os
//        dois. ⚠️ **O eixo do comando é o AMBIENTE EXPLÍCITO, e não o `spawn`** — este último devolve
//        TRÊS, e o terceiro (`packages/shared/test/reserva-de-porta.spec.ts`) **não conta**: ele
//        HERDA `process.env`, e o que está duplicado aqui é justamente a construção do ambiente
//        variável a variável, sem a qual a prova de *"a partida recusa sem a variável"* passa a
//        depender do ambiente de quem roda a suíte. Quem for medir o gatilho, meça por este eixo.
// QUANDO FECHA: o TERCEIRO consumidor. Ali o lançador sobe para a casa compartilhada do diretório —
//        `packages/shared/test/` se o consumidor for de outro pacote, `apps/worker/test/` se for
//        irmão —, e as duas cópias existentes migram.
// POR QUE NÃO AGORA: o Limiar de Três ainda não disparou (são duas), e migrar
//        `ambiente-efemero.spec.ts` é abrir arquivo que esta task não tem razão para tocar
//        (proibição 5 do Protocolo Antirregressão).
// ÍNDICE: docs/specs/features/automacoes-agendadas/v1/_run/run-report.md §2, D17

import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdtempSync, readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  type AdaptadorCobrancaBancaria,
  criarGuardaDeBoletos,
  type GuardaDeBoletos,
} from '@sysloc/cobranca-bancaria';
import {
  type AcessoAoBanco,
  abrirAcessoAoBanco,
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
  emitirNumeroDeCobranca,
  emitirNumeroDeContrato,
  garantirContadorDeCobranca,
  garantirContadorDeContrato,
  gravarPoliticaDeAviso,
  lerAnoDaSerieDeCobranca,
  lerAnoDaSerieDeContrato,
  lerHoraCorrenteDaOperacao,
  reativarEmpresa,
  registrarNotificacaoBancaria,
  suspenderEmpresa,
} from '@sysloc/db';
import { criarCapturadorDeEmail, dentroDaJanela, type PortaDeEnvioDeEmail } from '@sysloc/regua';
import { criarLogger, FILA_DA_ROTINA_AGENDADA, OPCOES_PADRAO_DA_TAREFA } from '@sysloc/shared';
import {
  CADENCIA_DA_ROTINA,
  type PoliticaDeAvisoNova,
  type SituacaoDeLocacao,
} from '@syslocbr/contracts';
import type { Job, Queue } from 'bullmq';
import type { TransactionSql } from 'postgres';
import { afterAll, beforeAll, describe, expect, it, onTestFinished } from 'vitest';
import { type BancoMigrado, bancoEfemero } from '../../../packages/db/test/banco-efemero.ts';
import { FAIXA_PORTAS_EFEMERAS, sondarAte } from '../../../packages/shared/test/efemero-comum.ts';
import { type FilaEfemera, redisEfemero } from '../../../packages/shared/test/redis-efemero.ts';
import { conectarFila, type Fila } from '../src/fila.ts';
import { processarReguaDeCobranca } from '../src/tarefas/regua.ts';
import { processarRotinaAgendada } from '../src/tarefas/rotina-agendada.ts';
import { type Contexto, emUnidadeSobContexto } from './acessorios-de-borda.ts';
import { controleComAsAgulhas, ocorrenciasDe, rotulosDoControle } from './varredura-de-segredo.ts';

// ---------------------------------------------------------------------------
// Limites de tempo — constantes nomeadas, nunca número mágico no meio do caso
// ---------------------------------------------------------------------------

/** Subir banco e fila efêmeros, provisionar, migrar e semear leva dezenas de segundos aqui. */
const LIMITE_SUBIDA_MS = 180_000;

/** Cada caso monta cadastros, contratos e cobranças, e lança ao menos um subprocesso. */
const LIMITE_DO_CASO_MS = 300_000;

/** Limite para a tarefa alcançar estado terminal — folgado sobre a repetição da fila. */
const LIMITE_ESTADO_TERMINAL_MS = 90_000;

/** Limite de vida de um lançamento do despachante, contado pelo processo-pai. */
const LIMITE_DO_SUBPROCESSO_MS = 120_000;

/** Reserva de conexões: o arranjo, o consumidor e o subprocesso tocam o banco ao mesmo tempo. */
const RESERVA_DE_CONEXOES = 6;

/** Porta padrão do servidor de fila, usada pelo ambiente legado desta máquina (ADR-0006). */
const PORTA_PADRAO_DA_FILA = 6379;

// ---------------------------------------------------------------------------
// O ponto de entrada sob prova, e o vocabulário da linha de comando
// ---------------------------------------------------------------------------

/**
 * O artefato **construído** que a unidade `systemd` executa.
 *
 * Ele é `dist/`, e não `src/`: o script `test` deste pacote roda `tsc --build` antes do arcabouço, e
 * é o binário resultante que a operação de fato executa. Apontar para o fonte provaria outro
 * programa.
 */
const DESPACHANTE = fileURLToPath(new URL('../dist/despachante.js', import.meta.url));

/** Os nomes de rotina que a linha de comando aceita — as seis unidades do relógio. */
const ARGV_DO_AVISO = 'aviso-de-cobranca';
const ARGV_DO_ENCERRAMENTO = 'encerramento-de-contratos';
const ARGV_DA_CONFERENCIA = 'conferencia-de-liquidacao';
const ARGV_DA_VIGILANCIA = 'vigilancia-das-rotinas';
const ARGV_DA_MANUTENCAO = 'manutencao';
const ARGV_DA_RETOMADA = 'retomada-de-noticias';

/** Os três códigos de saída que o despachante publica — cadeias do contrato com o supervisor. */
const CODIGO_DE_SUCESSO = 0;
const CODIGO_DE_FALHA = 1;
const CODIGO_DE_ROTINA_DESCONHECIDA = 2;

/** As três variáveis que o despachante exige. A lista é a fonte das linhas inválidas do CT-1077. */
const VARIAVEIS_EXIGIDAS = ['LOG_LEVEL', 'DATABASE_URL', 'REDIS_URL'] as const;

/** A severidade com que o subprocesso registra — `debug` para o diário caber na varredura. */
const SEVERIDADE = 'debug';

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

/** Deslocamento de vencimento de uma cobrança ELEGÍVEL ao aviso — vencida há poucos dias. */
const VENCIDA_RECENTE = -12;

/** Valor de cada cobrança do arranjo, em reais. */
const VALOR_DA_COBRANCA = 1000;

/** Os termos do contrato de todo cenário — nada aqui participa do que está sob prova. */
const TERMOS_DO_CONTRATO = {
  dataInicioLocacao: '2026-01-01',
  prazoMeses: 12,
  valorMensal: VALOR_DA_COBRANCA,
  diaVencimento: 10,
  indiceReajuste: 'IGPM',
  gerarCobrancasAutomaticamente: false,
  observacoes: null,
} as const;

/** A competência de todas as cobranças do arranjo — não participa de recorte nenhum. */
const COMPETENCIA = '2026-01-01';

/** O contexto usado só para admitir empresas — `identidade.empresa` não tem política (ADR-0009). */
const CONTEXTO_DA_SEMENTE: Contexto = { empresaId: EMPRESA_A.id };

/** A chave de cifra que a composição entrega às bordas. Nenhum caso deste arquivo a exercita. */
const CHAVE_DE_CIFRA = randomBytes(32);

/** A rotina que o registro de execução da régua nomeia — cadeia EXATA, como o banco a guarda. */
const ROTINA_DO_AVISO = 'AVISO_DE_COBRANCA';

/**
 * A mensagem com que a BORDA nomeia a empresa da passagem que levantou — cadeia EXATA.
 *
 * Ela **não** é a do ouvinte genérico de `apps/worker/src/fila.ts` (*"tarefa terminou em falha"*), e a
 * distinção é o que este caso mede: as duas linhas convivem no journal, e só esta sabe de quem é a
 * passagem. Filtrar pela outra faria a asserção incidir sobre a linha que **não pode** carregar
 * empresa.
 */
const MENSAGEM_DA_PASSAGEM_EM_FALHA = 'passagem da rotina agendada falhou';

/** O nível da linha que nomeia a falha — cadeia EXATA, como o registrador a rotula. */
const NIVEL_DE_ALERTA = 'error';

/** A rotina que o expurgo do histórico carrega na carga — cadeia EXATA. */
const ROTINA_DO_EXPURGO = 'EXPURGO_DO_HISTORICO';

/** Os estados de tarefa que a observação percorre — os cinco em que uma tarefa publicada pode estar. */
const ESTADOS_OBSERVADOS = ['waiting', 'delayed', 'active', 'completed', 'failed'] as const;

let banco: BancoMigrado;
let acesso: AcessoAoBanco;
let instanciaDaFila: FilaEfemera;
let diretorioDosBoletos: string;
let empresasAdmitidas = 0;
let sequenciaDoCenario = 0;
let proximoDocumento = 71_000_000_000;

beforeAll(async () => {
  banco = await bancoEfemero();
  acesso = abrirAcessoAoBanco({
    cadeiaDeConexao: banco.cadeiaConexao,
    maximoDeConexoes: RESERVA_DE_CONEXOES,
  });

  instanciaDaFila = await redisEfemero();
  diretorioDosBoletos = mkdtempSync(join(tmpdir(), 'sysloc-despachante-boletos-'));

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
// CT-1075 — a enumeração É o filtro
// ===========================================================================

/**
 * As **cinco** formas de despacho, com o produtor que cada uma alimenta e a carga que ela publica.
 *
 * A tabela existe para provar que o filtro vale em **todas**, e não apenas na primeira que alguém
 * escreveu: um despachante que enumerasse corretamente no aviso e descuidasse na manutenção passaria
 * num caso único.
 */
const FORMAS_DE_DESPACHO = [
  { argv: ARGV_DO_AVISO, rotinaNaCarga: null },
  { argv: ARGV_DO_ENCERRAMENTO, rotinaNaCarga: 'ENCERRAMENTO_DE_CONTRATOS' },
  { argv: ARGV_DA_CONFERENCIA, rotinaNaCarga: 'CONFERENCIA_DE_LIQUIDACAO' },
  { argv: ARGV_DA_VIGILANCIA, rotinaNaCarga: 'VIGILANCIA_DAS_ROTINAS' },
  { argv: ARGV_DA_MANUTENCAO, rotinaNaCarga: ROTINA_DO_EXPURGO },
] as const;

describe('CT-1075 — a empresa suspensa não é enumerada, e nenhuma tarefa nasce para ela', () => {
  it.each(FORMAS_DE_DESPACHO)(
    'CT-1075 — $argv: o conjunto de empresaId enfileirados é EXATAMENTE o das ativas',
    async ({ argv, rotinaNaCarga }) => {
      const { a, b, c } = await tresEmpresasComUmaSuspensa(`ct1075-${argv}`);
      const fila = filaObservadora();
      await limparFilas(fila);

      const desfecho = await executarDespachante([argv]);

      expect({ codigo: desfecho.codigo, erro: desfecho.erro }).toEqual({
        codigo: CODIGO_DE_SUCESSO,
        erro: '',
      });

      // O produtor que a forma alimenta: o aviso vai para a fila da régua; as demais, para a fila
      // única das rotinas por empresa. A leitura é por produtor, e não por união de cargas: cada
      // fila tem o próprio tipo de carga, e uni-las apagaria a conferência do campo `rotina`.
      const enfileiradas: string[] = [];

      if (rotinaNaCarga === null) {
        const cargas = await cargasDe(fila.regua);
        enfileiradas.push(...cargas.map((carga) => carga.empresaId));
      } else {
        const cargas = await cargasDe(fila.rotinaAgendada);
        enfileiradas.push(...cargas.map((carga) => carga.empresaId));
        // O campo que DISCRIMINA o trabalho na fila única — sem ele, o disparo da vigilância e o do
        // encerramento seriam indistinguíveis.
        expect(cargas.map((carga) => carga.rotina)).toEqual([rotinaNaCarga, rotinaNaCarga]);
      }

      // ⚠️ A asserção que DISCRIMINA é o TOTAL ser 2: um despachante que enfileirasse 3 e
      // descartasse a suspensa DENTRO da tarefa passaria em qualquer asserção que olhasse só as
      // empresas processadas. É a diferença entre impossível e evitado.
      expect(enfileiradas).toHaveLength(2);
      expect([...enfileiradas].sort()).toEqual([a.empresaId, c.empresaId].sort());
      // Controle antivácuo da igualdade acima: as duas ativas existem e são distintas, e a suspensa
      // não aparece em tarefa nenhuma.
      expect(enfileiradas.filter((empresaId) => empresaId === b.empresaId)).toEqual([]);

      if (argv === ARGV_DA_MANUTENCAO) {
        // A tarefa SEM TENANT: uma só, e com carga profundamente igual ao objeto vazio — a
        // conformidade com a emenda de 2026-08-18 da ADR-0024.
        const semTenant = await cargasDe(fila.manutencaoDoAcervo);
        expect(semTenant).toEqual([{}]);
      }
    },
    LIMITE_DO_CASO_MS,
  );
});

// ===========================================================================
// CT-1076 — falha isolada: a tarefa de uma empresa falhar não impede as demais
// ===========================================================================

/**
 * ⚠️ **Por que a falha entra pela PORTA DE DADOS, e não por um estado de domínio do encerramento.**
 *
 * Foi medido antes de escolher: `encerrarContratosVencidos` **não tem falha alcançável por estado de
 * domínio**. As três instruções dela são um `SELECT … FOR UPDATE SKIP LOCKED`, um `UPDATE` sob
 * predicado que devolve `0` e é tratado com `continue`, e a porta estreita
 * `definirSituacaoDeLocacaoDoImovel` — cujo próprio docblock declara que a ausência de linha é
 * *"estado impossível"*, porque o imóvel acabou de ser lido pela mesma transação, sob a mesma
 * política. Não há `CHECK`, chave estrangeira ou índice único que uma empresa possa violar
 * encerrando o contrato dela: o `contrato_imovel_vigente_uidx` é **liberado** pela transição, nunca
 * disputado. Isso é uma propriedade **boa** da rotina, e não uma lacuna — e é por isso que o
 * discriminador desta prova precisa vir de outro lugar.
 *
 * O lugar legítimo é a **porta** que a composição raiz injeta (ADR-0025): `AcessoAoBanco` chega a
 * `processarRotinaAgendada` por parâmetro, exatamente como o adaptador do provedor chega à
 * conferência. {@link bancoQueRecusaSobContextoDe} é implementação da **mesma** interface, e o que
 * ela discrimina é o **contexto de tenant que a borda abriu** — isto é, a tarefa falha *porque é a de
 * B*, que é precisamente o que o caso quer observar. Não há bandeira, variável de ambiente ou ramo
 * condicional em produção: `rotina-agendada.ts` não sabe que houve substituição, e o mesmo parâmetro
 * recebe a reserva real em operação.
 *
 * ⚠️ **A razão da falha NÃO é asserida por conteúdo plantado.** O que discrimina é o par
 * (concluídas, falhadas) lido das **cargas** das tarefas — que o despachante produziu — mais o efeito
 * de domínio de A e C no banco: sem ele, um despachante que abortasse tudo ao primeiro erro poderia
 * passar olhando só o estado da fila.
 */
describe('CT-1076 — a falha da tarefa de B deixa A e C concluídas, com o efeito delas no banco', () => {
  it(
    'CT-1076 — concluídas exatamente {A, C}, falhadas exatamente {B}, e o par de B intacto',
    async () => {
      await suspenderTodasAsEmpresas();
      const a = await admitirEmpresaNova('ct1076-a');
      const b = await admitirEmpresaNova('ct1076-b');
      const c = await admitirEmpresaNova('ct1076-c');

      const deA = await semearParVigente(a, 'ct1076-a', DIAS_VENCIDO, SITUACAO_LOCADO);
      const deB = await semearParVigente(b, 'ct1076-b', DIAS_VENCIDO, SITUACAO_LOCADO);
      const deC = await semearParVigente(c, 'ct1076-c', DIAS_VENCIDO, SITUACAO_LOCADO);

      const montagem = montarConsumidores({ banco: bancoQueRecusaSobContextoDe(b.empresaId) });
      await limparFilas(montagem.fila);

      const desfecho = await executarDespachante([ARGV_DO_ENCERRAMENTO]);
      expect(desfecho.codigo).toBe(CODIGO_DE_SUCESSO);

      const terminadas = await sondarAteTerminarem(montagem.fila.rotinaAgendada, 3);

      // Os dois conjuntos, por IGUALDADE: `concluídas` sozinho não distinguiria "B falhou" de "B
      // nunca foi enfileirada", e `falhadas` sozinho não distinguiria "só B falhou" de "todas
      // falharam".
      expect(empresasNoEstado(terminadas, 'completed')).toEqual([a.empresaId, c.empresaId].sort());
      expect(empresasNoEstado(terminadas, 'failed')).toEqual([b.empresaId]);

      // O EFEITO DE DOMÍNIO — a asserção que discrimina o despachante que aborta tudo ao primeiro
      // erro: A e C encerraram o par inteiro, contrato e imóvel.
      expect(await lerEstadoDoPar(a, deA)).toEqual({
        status: 'ENCERRADO',
        situacaoDoImovel: SITUACAO_DISPONIVEL,
      });
      expect(await lerEstadoDoPar(c, deC)).toEqual({
        status: 'ENCERRADO',
        situacaoDoImovel: SITUACAO_DISPONIVEL,
      });
      // E o de B não se moveu: a unidade inteira foi desfeita, como o docblock de
      // `encerrarContratosVencidos` declara — não há progresso parcial.
      expect(await lerEstadoDoPar(b, deB)).toEqual({
        status: 'ATIVO',
        situacaoDoImovel: SITUACAO_LOCADO,
      });

      // O número de tentativas sai da CONSTANTE do SUT, e não de um literal: reduzir a política em
      // `@sysloc/shared` sem revisar este caso reprovaria aqui, que é o que se quer.
      const falhada = terminadas.find(({ estado }) => estado === 'failed');
      expect(falhada?.tarefa.attemptsMade).toBe(OPCOES_PADRAO_DA_TAREFA.attempts);

      // ⚠️ O REGISTRO ESTRUTURADO NOMEIA A EMPRESA — a metade da CA-02 que o par (concluídas,
      // falhadas) acima **não** alcança. O ouvinte `failed` de `apps/worker/src/fila.ts` publica
      // `{ idTarefa, fila, tentativa, erro }` e **não tem como** publicar a empresa: ele é
      // parametrizado pela carga, e a da manutenção do acervo é `Record<string, never>`. Sem a linha
      // da borda, o operador que o `OnFailure=` da unidade acordar lê *"tarefa terminou em falha"* e
      // não sabe qual imobiliária ficou sem a rotina do dia — numa fila com UMA tarefa por empresa
      // por disparo.
      //
      // O valor asserido **não é plantado pelo dublê**: ele vem da carga que o **despachante**
      // produziu e que o `strictObject` da borda conferiu. O que o dublê decide é apenas *qual*
      // passagem levanta.
      const falhasNoDiario = montagem
        .eventos()
        .filter((evento) => evento.mensagem === MENSAGEM_DA_PASSAGEM_EM_FALHA);

      // Uma linha por TENTATIVA, todas de B — e a contagem sai da constante do SUT, como acima.
      expect(falhasNoDiario.map((evento) => evento.empresaId)).toEqual(
        Array.from({ length: OPCOES_PADRAO_DA_TAREFA.attempts }, () => b.empresaId),
      );

      // ⚠️ O COMPANHEIRO QUE DISCRIMINA: nenhuma linha de falha nomeia A nem C. Sem ele, uma borda
      // que registrasse a falha de **toda** passagem — inclusive as que concluíram — satisfaria a
      // igualdade acima por acidente, e a asserção voltaria a ser vácua.
      expect(
        falhasNoDiario
          .map((evento) => evento.empresaId)
          .filter((empresa) => empresa === a.empresaId || empresa === c.empresaId),
      ).toEqual([]);

      // E os campos que correlacionam a falha com as duas linhas de fecho no journal — mesmo
      // vocabulário, mesma fila, mesmo identificador de tarefa.
      expect(falhasNoDiario[0]).toMatchObject({
        nivel: NIVEL_DE_ALERTA,
        idTarefa: falhada?.tarefa.id,
        fila: FILA_DA_ROTINA_AGENDADA,
        empresaId: b.empresaId,
        rotina: 'ENCERRAMENTO_DE_CONTRATOS',
      });
    },
    LIMITE_DO_CASO_MS,
  );
});

// ===========================================================================
// CT-1077 — a partida falha fechado, e nada é enfileirado
// ===========================================================================

/**
 * As **sete** partidas inválidas, com o que cada uma tem de nomear e o código que ela tem de devolver.
 *
 * As três primeiras são a ausência de cada variável exigida; a quarta é a `DATABASE_URL` presente e
 * **em branco**, que é o que um `EnvironmentFile` copiado do `.env.example` sem preenchimento
 * entrega; a quinta é o nome de rotina fora do roster; a sexta é `argv[2]` **ausente**, que é o
 * `ExecStart=` sem argumento.
 *
 * ⚠️ **A recusa por rotina vem ANTES da leitura do ambiente**, e as três últimas linhas o afirmam: elas
 * trazem o ambiente COMPLETO, de modo que o código `2` só pode vir do roster.
 */
const PARTIDAS_RECUSADAS: readonly {
  readonly cenario: string;
  readonly sem: string | null;
  readonly emBranco: string | null;
  readonly argv: readonly string[];
  readonly codigo: number;
  readonly nomeia: string;
}[] = [
  {
    cenario: 'sem LOG_LEVEL',
    sem: 'LOG_LEVEL',
    emBranco: null,
    argv: [ARGV_DO_ENCERRAMENTO],
    codigo: CODIGO_DE_FALHA,
    nomeia: 'LOG_LEVEL: ausente',
  },
  {
    cenario: 'sem DATABASE_URL',
    sem: 'DATABASE_URL',
    emBranco: null,
    argv: [ARGV_DO_ENCERRAMENTO],
    codigo: CODIGO_DE_FALHA,
    nomeia: 'DATABASE_URL: ausente',
  },
  {
    cenario: 'sem REDIS_URL',
    sem: 'REDIS_URL',
    emBranco: null,
    argv: [ARGV_DO_ENCERRAMENTO],
    codigo: CODIGO_DE_FALHA,
    nomeia: 'REDIS_URL: ausente',
  },
  {
    cenario: 'DATABASE_URL em branco',
    sem: null,
    emBranco: 'DATABASE_URL',
    argv: [ARGV_DO_ENCERRAMENTO],
    codigo: CODIGO_DE_FALHA,
    nomeia: 'DATABASE_URL: ausente',
  },
  {
    cenario: 'rotina inexistente',
    sem: null,
    emBranco: null,
    argv: ['rotina-que-nao-existe'],
    codigo: CODIGO_DE_ROTINA_DESCONHECIDA,
    nomeia: ARGV_DO_ENCERRAMENTO,
  },
  {
    cenario: 'argv[2] ausente',
    sem: null,
    emBranco: null,
    argv: [],
    codigo: CODIGO_DE_ROTINA_DESCONHECIDA,
    nomeia: ARGV_DA_RETOMADA,
  },
  {
    // ⚠️ A sétima linha é a que discrimina a **união fechada de fato** da união fechada aparente. Um
    // roster com protótipo de objeto devolveria o membro herdado para este nome — a recusa não
    // dispararia, o processo abriria banco e fila, e o `default` do `switch` o terminaria com `1`.
    // Sai `0` tarefa nos dois desenhos; o que muda é **para onde o operador é mandado olhar**, e é
    // isso que o código `2` existe para dizer. A T9 é quem escreve os `ExecStart=`.
    cenario: 'nome herdado do protótipo de objeto',
    sem: null,
    emBranco: null,
    argv: ['constructor'],
    codigo: CODIGO_DE_ROTINA_DESCONHECIDA,
    nomeia: ARGV_DA_MANUTENCAO,
  },
];

describe('CT-1077 — partida recusada termina sem enfileirar NADA e sem imprimir valor', () => {
  it(
    'CT-1077 — as sete recusas, o controle positivo da partida e a varredura de segredo',
    async () => {
      const { a, c } = await tresEmpresasComUmaSuspensa('ct1077');
      const fila = filaObservadora();

      const recusas: { readonly rotulo: string; readonly texto: string }[] = [];

      for (const linha of PARTIDAS_RECUSADAS) {
        await limparFilas(fila);

        const ambiente = ambienteDoDespacho();
        if (linha.sem !== null) {
          delete ambiente[linha.sem];
        }
        if (linha.emBranco !== null) {
          ambiente[linha.emBranco] = '   ';
        }

        const desfecho = await executarDespachante([...linha.argv], ambiente);

        // O código de saída EXATO, e não apenas "diferente de zero": o `2` é o contrato com quem
        // opera, e um `1` no lugar dele mandaria o operador procurar o problema errado.
        expect({ cenario: linha.cenario, codigo: desfecho.codigo }).toEqual({
          cenario: linha.cenario,
          codigo: linha.codigo,
        });
        // A saída de erro NOMEIA o que faltou — a variável, ou a lista dos valores aceitos.
        expect(desfecho.erro, linha.cenario).toContain(linha.nomeia);
        // E NADA foi publicado: a contagem é sobre TODAS as filas, e não só a da rotina pedida.
        expect({ cenario: linha.cenario, tarefas: await contarTarefas(fila) }).toEqual({
          cenario: linha.cenario,
          tarefas: 0,
        });

        recusas.push({ rotulo: linha.cenario, texto: `${desfecho.saida}\n${desfecho.erro}` });
      }

      // Contagem contra o número ESCRITO à mão: derivá-la da mesma tabela que constrói a lista seria
      // a soma por construção, e a igualdade concordaria consigo mesma. **Sete** desde a linha do
      // nome herdado do protótipo — o número acompanha a tabela no MESMO diff, que é o que torna a
      // mudança deliberada.
      expect(recusas).toHaveLength(7);
      // E as TRÊS variáveis exigidas foram todas exercitadas pela ausência — a rede da variável que
      // alguém acrescente ao despachante e esqueça de pôr na tabela acima. Igualdade de conjunto, e
      // não contenção: a linha que sobrasse apontando para variável que a partida não exige também
      // reprova.
      expect(
        PARTIDAS_RECUSADAS.map((linha) => linha.sem)
          .filter((nome) => nome !== null)
          .sort(),
      ).toEqual([...VARIAVEIS_EXIGIDAS].sort());

      // As sentinelas, nomeadas: é o nome que a reprovação exibe, e é ele que diz QUAL valor escapou.
      const sentinelas = {
        'cadeia de conexão do banco': banco.cadeiaConexao,
        'cadeia de conexão da fila': instanciaDaFila.cadeiaConexao,
      };

      // ⚠️ O CONTROLE POSITIVO, e é ELE que impede o `AP-29`: a MESMA função de varredura aplicada a
      // um objeto onde cada sentinela está plantada num canal diferente, com a lista afirmada por
      // IGUALDADE. Sem ele, uma busca quebrada devolveria `[]` e o caso ficaria verde num processo
      // que imprime a cadeia de conexão inteira. Ele vem ANTES da ausência porque `toEqual` aborta o
      // caso ao falhar.
      expect(ocorrenciasDe(controleComAsAgulhas(sentinelas), sentinelas)).toEqual(
        rotulosDoControle(sentinelas),
      );
      // A lista dos achados, e não um booleano: quando reprovar, ela nomeia qual sentinela vazou e
      // em qual recusa.
      expect(ocorrenciasDe(recusas, sentinelas)).toEqual([]);

      // O CONTROLE POSITIVO DA PARTIDA — indispensável: uma conferência que recusasse tudo passaria
      // em todas as seis linhas acima e derrubaria a partida de toda instalação.
      await limparFilas(fila);
      const aceito = await executarDespachante([ARGV_DO_ENCERRAMENTO]);

      expect({ codigo: aceito.codigo, erro: aceito.erro }).toEqual({
        codigo: CODIGO_DE_SUCESSO,
        erro: '',
      });
      expect((await cargasDe(fila.rotinaAgendada)).map((carga) => carga.empresaId).sort()).toEqual(
        [a.empresaId, c.empresaId].sort(),
      );
    },
    LIMITE_DO_CASO_MS,
  );
});

// ===========================================================================
// CT-1078 — sem `jobId` determinístico: duas passagens, duas tarefas
// ===========================================================================

/** Os fontes novos de `apps/worker` que a perna estática varre — os três desta fatia. */
const FONTES_NOVOS_DO_PROCESSO = [
  'apps/worker/src/despachante.ts',
  'apps/worker/src/tarefas/rotina-agendada.ts',
  'apps/worker/src/tarefas/manutencao-do-acervo.ts',
] as const;

/** A raiz da árvore versionada — o mesmo idioma de `packages/db/test/fonte-unica-do-estado.spec.ts`. */
const RAIZ_DO_REPOSITORIO = fileURLToPath(new URL('../../../', import.meta.url));

/** Lê um fonte da árvore versionada, pelo caminho relativo à raiz. */
function lerFonte(relativo: string): string {
  return readFileSync(join(RAIZ_DO_REPOSITORIO, relativo), 'utf8');
}

/**
 * A chave de idempotência que **não pode existir** nos fontes novos.
 *
 * `jobId` é o nome que a biblioteca de fila dá ao identificador declarado pelo produtor. Com a
 * retenção por **contagem** de `OPCOES_PADRAO_DA_TAREFA`, um `jobId` fixo permanece no conjunto
 * depois de concluído e **recusa em silêncio** a passagem seguinte: a rotina para sem que nada falhe.
 */
const CHAVE_DE_IDEMPOTENCIA = 'jobId';

describe('CT-1078 — duas execuções consecutivas publicam DUAS tarefas distintas', () => {
  it(
    'CT-1078 — a segunda passagem não é recusada pelo conjunto de retenção',
    async () => {
      await suspenderTodasAsEmpresas();
      const unica = await admitirEmpresaNova('ct1078');
      await semearParVigente(unica, 'ct1078', DIAS_A_VENCER, SITUACAO_LOCADO);

      const montagem = montarConsumidores({});
      await limparFilas(montagem.fila);

      const primeira = await executarDespachante([ARGV_DO_ENCERRAMENTO]);
      expect(primeira.codigo).toBe(CODIGO_DE_SUCESSO);

      // A primeira tarefa é CONSUMIDA e chega ao estado terminal — a precondição do caso: ela fica
      // no conjunto de retenção por contagem quando a segunda é publicada.
      const apos = await sondarAteTerminarem(montagem.fila.rotinaAgendada, 1);
      expect(apos.map(({ estado }) => estado)).toEqual(['completed']);

      const segunda = await executarDespachante([ARGV_DO_ENCERRAMENTO]);
      expect(segunda.codigo).toBe(CODIGO_DE_SUCESSO);

      const publicadas = await tarefasDe(montagem.fila.rotinaAgendada);
      expect(publicadas).toHaveLength(2);
      // Os identificadores DIFERENTES: com `jobId` determinístico a segunda seria recusada e a
      // contagem ficaria em `1` — o modo de falha que a §20 nomeia como o mais caro desta fatia.
      const identificadores = publicadas.map((tarefa) => tarefa.id);
      expect(new Set(identificadores).size).toBe(2);
    },
    LIMITE_DO_CASO_MS,
  );

  it('CT-1078 — perna estática: nenhum fonte novo declara chave de idempotência', async () => {
    const fontes = await Promise.all(
      FONTES_NOVOS_DO_PROCESSO.map(async (caminho) => ({
        caminho,
        texto: await readFile(join(RAIZ_DO_REPOSITORIO, caminho), 'utf8'),
      })),
    );

    // Âncora antivácuo em valor EXATO: "nenhuma chave" sobre zero arquivos lidos é verdade vazia.
    expect(fontes).toHaveLength(FONTES_NOVOS_DO_PROCESSO.length);
    expect(fontes.every(({ texto }) => texto.length > 0)).toBe(true);

    expect(ocorrenciasDaChave(fontes)).toEqual([]);
  });

  it('CT-1078 (b) — PROVA DE FALSIFICAÇÃO: a MESMA varredura reprova a cópia que introduz jobId', async () => {
    const caminho = FONTES_NOVOS_DO_PROCESSO[0];
    const integro = await readFile(join(RAIZ_DO_REPOSITORIO, caminho), 'utf8');

    // CONTROLE: o fonte como ele está na árvore.
    expect(ocorrenciasDaChave([{ caminho, texto: integro }])).toEqual([]);

    // MUTANTE: a cópia com o `jobId` determinístico que a decisão proíbe — a forma exata que um
    // autor futuro escreveria para "não enfileirar duas vezes no mesmo minuto". A cópia vive em
    // memória: escrevê-la no disco deixaria o defeito no fonte se o processo morresse no meio.
    const comChave = `${integro}\nconst opcoes = { jobId: 'despacho-do-minuto' };\n`;

    expect(ocorrenciasDaChave([{ caminho, texto: comChave }])).toEqual([
      `${caminho}:${String(integro.split('\n').length + 1)}`,
    ]);
  });
});

// ===========================================================================
// CT-1079 — a retomada das notícias em RECEBIDO
// ===========================================================================

/** As cinco notícias do cenário, cruzando desfecho e idade. Duas — e só duas — são retomadas. */
const NOTICIAS_DO_CENARIO = [
  { rotulo: 'RECEBIDO há 30 min', desfecho: 'RECEBIDO', minutos: 30, retomada: true },
  { rotulo: 'RECEBIDO há 2 h', desfecho: 'RECEBIDO', minutos: 120, retomada: true },
  { rotulo: 'RECEBIDO há 1 min', desfecho: 'RECEBIDO', minutos: 1, retomada: false },
  { rotulo: 'RETIDO há 2 h', desfecho: 'RETIDO', minutos: 120, retomada: false },
  { rotulo: 'APLICADO há 2 h', desfecho: 'APLICADO', minutos: 120, retomada: false },
] as const;

describe('CT-1079 — a retomada reenfileira as RECEBIDO vencidas, com a carga sem empresa', () => {
  it(
    'CT-1079 — exatamente as duas vencidas, e Object.keys da carga é ["notificacaoId"]',
    async () => {
      const fila = filaObservadora();
      await limparFilas(fila);
      await esvaziarNoticias();

      const semeadas = new Map<string, string>();
      for (const noticia of NOTICIAS_DO_CENARIO) {
        semeadas.set(noticia.rotulo, await semearNoticia(noticia.desfecho, noticia.minutos));
      }

      const desfecho = await executarDespachante([ARGV_DA_RETOMADA]);
      expect({ codigo: desfecho.codigo, erro: desfecho.erro }).toEqual({
        codigo: CODIGO_DE_SUCESSO,
        erro: '',
      });

      const cargas = await cargasDe(fila.notificacaoBancaria);

      const esperadas = NOTICIAS_DO_CENARIO.filter((noticia) => noticia.retomada).map((noticia) =>
        exigirSemeada(semeadas, noticia.rotulo),
      );
      expect(cargas).toHaveLength(2);
      expect(cargas.map((carga) => carga.notificacaoId).sort()).toEqual([...esperadas].sort());

      // ⚠️ A carga é profundamente igual a `{ notificacaoId }`, e `Object.keys` é exatamente esse um
      // campo: pôr `empresaId` aqui seria VIOLAÇÃO da emenda de 2026-08-18 da ADR-0024, e não
      // conformidade — a empresa é o RESULTADO da travessia nominal que a tarefa ainda vai fazer.
      for (const carga of cargas) {
        expect(Object.keys(carga)).toEqual(['notificacaoId']);
        expect(carga).toEqual({ notificacaoId: carga.notificacaoId });
      }

      // Controle antivácuo do recorte: as três que NÃO devem ser retomadas continuam fora.
      const naoRetomadas = NOTICIAS_DO_CENARIO.filter((noticia) => !noticia.retomada).map(
        (noticia) => exigirSemeada(semeadas, noticia.rotulo),
      );
      expect(
        cargas.map((carga) => carga.notificacaoId).filter((id) => naoRetomadas.includes(id)),
      ).toEqual([]);
    },
    LIMITE_DO_CASO_MS,
  );
});

// ===========================================================================
// CT-1079 (b) — a folga da retomada É a cadência do timer, e não um número ao lado dela
// ===========================================================================

/**
 * ⚠️ **A rede de uma premissa que o docblock afirma e que nada amarrava.**
 *
 * `FOLGA_DA_RETOMADA_EM_MINUTOS` declara, por escrito, que o valor **é** uma cadência inteira do timer
 * da retomada, e é dessa igualdade que sai o invariante do produto: *a notícia que acabou de chegar
 * está sendo tratada agora, e reenfileirá-la produziria duas passagens concorrentes sobre o mesmo
 * cru*. Os dois números moram em arquivos que nada liga — a folga em `apps/worker/src/despachante.ts`,
 * a cadência em `packages/contracts/src/rotina-agendada.ts` —, e o impacto de os separar é
 * **assimétrico**: afrouxar a cadência para 5 min só torna a retomada mais lenta, mas apertá-la para
 * **15 min** faz a folga ficar MENOR que uma cadência, e o invariante passa a ser **falso sem nada
 * ficar vermelho**. É o mesmo modo de falha que fez o `CT-644` nascer, do outro lado do processo.
 *
 * ⚠️ **A folga é lida do FONTE por `fs`, e não importada.** Exportá-la só para esta asserção enxergá-la
 * criaria símbolo de produção a serviço do teste — o seam que a Iron Law #6 proíbe, e a mesma razão
 * pela qual `lerAmbienteDoDespacho` deixou de ser exportada. É o molde do `CT-644`.
 *
 * ⚠️ **E a constante NÃO se muda de casa.** Levá-la para `@sysloc/db` foi refutado por escrito no
 * docblock dela: a folga é **cadência**, não retenção — quem sabe de quanto em quanto tempo o relógio
 * acorda este processo é este processo. O que faltava não era o lugar, era a amarra.
 */
const CAMINHO_DO_DESPACHANTE = 'apps/worker/src/despachante.ts';

/** A folga que o fonte do despachante declara, em minutos (aceita o separador `_`). */
function folgaDeclaradaEm(fonte: string): number | undefined {
  const achado = /FOLGA_DA_RETOMADA_EM_MINUTOS = ([0-9_]+)/.exec(fonte);

  return achado?.[1] === undefined ? undefined : Number(achado[1].replaceAll('_', ''));
}

/**
 * Os minutos que o **nome** de uma cadência de intervalo declara — `A_CADA_10_MIN` vale `10`.
 *
 * `undefined` para as cadências que não são de intervalo (`A_CADA_MINUTO`, `DIARIA`), e a ausência é
 * nomeada em vez de silenciosa: uma retomada cuja cadência deixasse de ser de intervalo tornaria a
 * comparação abaixo sem objeto, e o caso reprova por isso em vez de passar vazio.
 */
function minutosDaCadencia(tipo: string): number | undefined {
  const achado = /^A_CADA_(\d+)_MIN$/.exec(tipo);

  return achado?.[1] === undefined ? undefined : Number(achado[1]);
}

/** A folga escrita à mão — o terceiro termo, que torna a igualdade capaz de reprovar dos dois lados. */
const FOLGA_ESPERADA_EM_MINUTOS = 10;

describe('CT-1079 (b) — a folga da retomada e a cadência do timer são o MESMO fato', () => {
  const folga = folgaDeclaradaEm(lerFonte(CAMINHO_DO_DESPACHANTE));
  const cadencia = CADENCIA_DA_ROTINA.RETOMADA_DE_NOTICIAS.tipo;

  it('CT-1079 (b) — os três termos foram efetivamente LIDOS, e não assumidos', () => {
    // Âncora antivácuo: um `undefined` silencioso — a constante renomeada, a entrada da cadência
    // removida — faria a igualdade abaixo comparar contra nada.
    expect(folga).toBe(FOLGA_ESPERADA_EM_MINUTOS);
    expect(cadencia).toBe('A_CADA_10_MIN');
    expect(minutosDaCadencia(cadencia)).toBe(FOLGA_ESPERADA_EM_MINUTOS);
  });

  it('CT-1079 (b) — a folga é EXATAMENTE uma cadência inteira do timer da retomada', () => {
    // A amarra: os dois números passam a ser o mesmo fato. Mudar a cadência em `@syslocbr/contracts`
    // sem revisar a folga reprova AQUI, no instante em que a premissa deixa de valer — e não em
    // produção, meses depois, com duas passagens concorrentes sobre o mesmo cru.
    expect(folga).toBe(minutosDaCadencia(cadencia));
  });

  it('CT-1079 (b) — PROVA DE FALSIFICAÇÃO: a cadência apertada e a constante renomeada reprovam', () => {
    // MUTANTE 1 — a metade CARA: `A_CADA_15_MIN` faz a folga ficar MENOR que uma cadência, e é
    // exatamente o caso em que o invariante do docblock passa a ser falso. A comparação reprova.
    expect(minutosDaCadencia('A_CADA_15_MIN')).toBe(15);
    expect(minutosDaCadencia('A_CADA_15_MIN')).not.toBe(folga);

    // MUTANTE 2 — a metade SILENCIOSA: a constante renomeada. Sem a âncora antivácuo acima, a
    // leitura devolveria `undefined` e a igualdade `undefined === undefined` passaria em silêncio.
    expect(folgaDeclaradaEm('const OUTRO_NOME_QUALQUER = 10;\n')).toBeUndefined();

    // MUTANTE 3 — a cadência que deixa de ser de intervalo: a comparação fica sem objeto, e o
    // primeiro caso deste bloco a pega pela âncora.
    expect(minutosDaCadencia('DIARIA')).toBeUndefined();
  });
});

// ===========================================================================
// CT-1080 — duas janelas opostas no mesmo disparo
// ===========================================================================

describe('CT-1080 — o disparo não discrimina, e a janela decide quem recebe', () => {
  it(
    'CT-1080 — 2 tarefas, destinatários só os de A, e o registro da passagem só para A',
    async () => {
      await suspenderTodasAsEmpresas();
      const a = await admitirEmpresaNova('ct1080-a');
      const b = await admitirEmpresaNova('ct1080-b');

      // As duas janelas saem da HORA CORRENTE DA OPERAÇÃO, lida do BANCO (ADR-0026) — nunca de
      // `new Date()` nem de `vi.setSystemTime`.
      const agora = await emUnidade(a, lerHoraCorrenteDaOperacao);
      const janelas = janelasOpostas(agora);

      // Precondição afirmada com o predicado de PRODUÇÃO: a janela de A contém o instante do banco
      // e a de B não. Sem esta linha, "B não recebeu" poderia estar certo por outro motivo.
      expect({
        contemEmA: dentroDaJanela(agora, janelas.aberta.inicio, janelas.aberta.fim),
        contemEmB: dentroDaJanela(agora, janelas.fechada.inicio, janelas.fechada.fim),
      }).toEqual({ contemEmA: true, contemEmB: false });

      await gravarPolitica(a, politicaCom(janelas.aberta));
      await gravarPolitica(b, politicaCom(janelas.fechada));

      const deA = await semearCadeiaComCobranca(a, 'ct1080-a');
      const deB = await semearCadeiaComCobranca(b, 'ct1080-b');

      const enviosDeBAntes = await contarEnviosDeCobranca(b);
      expect(await contarRegistrosDeRotina(a)).toBe(0);

      const capturador = criarCapturadorDeEmail();
      const montagem = montarConsumidores({ email: capturador });
      await limparFilas(montagem.fila);

      const desfecho = await executarDespachante([ARGV_DO_AVISO]);
      expect(desfecho.codigo).toBe(CODIGO_DE_SUCESSO);

      // O DISPARO não discrimina: uma tarefa por empresa ativa, as duas.
      const terminadas = await sondarAteTerminarem(montagem.fila.regua, 2);
      expect(empresasNoEstado(terminadas, 'completed')).toEqual([a.empresaId, b.empresaId].sort());
      // A de B conclui SEM EFEITO — ela não falha. Uma tarefa falhada faria a fila repetir para
      // sempre o trabalho de uma empresa que apenas está fora da janela.
      expect(empresasNoEstado(terminadas, 'failed')).toEqual([]);

      // O que SAIU: exatamente os endereços dos locatários de A, e a interseção com os de B vazia.
      const capturados = capturador.capturas.map((captura) => captura.destinatario).sort();
      expect(capturados).toEqual([deA.destinatario]);
      expect(capturados.filter((endereco) => endereco === deB.destinatario)).toEqual([]);

      // A contagem CRUA sob B, idêntica à de antes: nem sequer uma tentativa nasceu.
      expect(await contarEnviosDeCobranca(b)).toBe(enviosDeBAntes);

      // E o REGISTRO da passagem (RD-15): ele nasce só onde houve efeito, com o vocabulário de
      // `ResultadoDaRegua`. Sem ele, `AVISO_DE_COBRANCA` seria publicada como parada para sempre.
      expect(await lerRegistrosDeRotina(a)).toEqual([
        {
          rotina: ROTINA_DO_AVISO,
          resumo: { candidatas: 1, enviadas: 1, falhas: 0, semDestinatario: 0 },
        },
      ]);
      // A perna NEGATIVA do predicado, e é ela que separa "grava quando houve efeito" de "grava
      // sempre": a passagem de B não tentou nada e não deixou linha alguma.
      expect(await lerRegistrosDeRotina(b)).toEqual([]);
    },
    LIMITE_DO_CASO_MS,
  );
});

// ===========================================================================
// CT-1081 — a reativação põe em dia UMA vez, e não retroage o aviso
// ===========================================================================

/**
 * ⚠️ **O que "sem Aviso retroativo" significa aqui, e por que a leitura literal do card é impossível.**
 *
 * A §5.2 do tech spec é literal: *"Nenhum Aviso retroativo: a régua respeita **janela e intervalo
 * mínimo**"*. Este caso abre a janela de propósito — é o que ele existe para provar —, logo o único
 * mecanismo que resta é o **intervalo mínimo**, e é ele que está sob prova.
 *
 * A leitura alternativa — *"cobranças que se tornaram avisáveis durante a suspensão não são
 * avisadas"* — **não é verdadeira deste produto, e não pode ser**: o predicado de
 * `selecionarCandidatasAoAviso` não tem teto para a cobrança vencida (`data_vencimento <=
 * data_corrente + dias`), de modo que uma cobrança que ficou avisável durante a suspensão **é**
 * candidata depois da reativação — e deve ser, senão a suspensão apagaria a cobrança do radar para
 * sempre. A §17 do tech spec declara, para a US-05, *"nenhum código novo — a não retroatividade é
 * propriedade do predicado existente"*: escrever um teto seria contrariá-la.
 *
 * O que a suspensão **não** faz é zerar o intervalo mínimo. As três cobranças do cenário foram
 * avisadas na última passagem antes da suspensão; dez dias de empresa fora do ar não as tornam
 * avisáveis de novo, e é isso que impede a reativação de virar uma rajada de avisos repetidos na
 * caixa do locatário — o modo de falha mais caro do produto, porque o remetente é único e a reação de
 * spam de um locatário atinge todos os clientes.
 *
 * ⚠️ **A cobrança de CONTROLE é o que impede a prova de ser vazia**: ela nasce durante a suspensão,
 * nunca foi avisada, e **é** avisada no disparo pós-reativação. Sem ela, `0` destinatários seria
 * indistinguível de *"a passagem não correu"* ou *"a janela estava fechada"*.
 */
describe('CT-1081 — a reativação põe em dia uma vez, e não contorna o intervalo mínimo', () => {
  it(
    'CT-1081 — 0 tarefas na suspensa; encerramento {1,1,0} e depois {0,0,0}; 0 avisos repetidos',
    async () => {
      await suspenderTodasAsEmpresas();
      const empresa = await admitirEmpresaNova('ct1081');
      await gravarPolitica(empresa, politicaCom(JANELA_SEMPRE_ABERTA));

      // As três cobranças que atravessam a suspensão, e a passagem que as avisa ANTES dela.
      const carteira = await semearCadeiaComCobranca(empresa, 'ct1081-carteira', 3);

      const capturadorAntes = criarCapturadorDeEmail();
      const antes = montarConsumidores({ email: capturadorAntes });
      await limparFilas(antes.fila);

      expect((await executarDespachante([ARGV_DO_AVISO])).codigo).toBe(CODIGO_DE_SUCESSO);
      const passagemInicial = await sondarAteTerminarem(antes.fila.regua, 1);
      expect(passagemInicial.map(({ estado }) => estado)).toEqual(['completed']);
      expect(capturadorAntes.capturas).toHaveLength(3);
      await antes.fila.encerrar();

      // O contrato que vence DURANTE a suspensão, e a suspensão.
      const par = await semearParVigente(empresa, 'ct1081-par', DIAS_VENCIDO, SITUACAO_LOCADO);
      await suspender(empresa);

      // DISPARO 1 — com a empresa suspensa: nenhuma tarefa nasce para ela, em fila alguma.
      const observadora = filaObservadora();
      await limparFilas(observadora);
      expect((await executarDespachante([ARGV_DO_ENCERRAMENTO])).codigo).toBe(CODIGO_DE_SUCESSO);
      expect(await contarTarefas(observadora)).toBe(0);

      // A cobrança de CONTROLE, criada durante a suspensão — nunca avisada.
      const controle = await semearCadeiaComCobranca(empresa, 'ct1081-controle');

      // A reativação, pela mesma escrita que `EmpresaService.reativar` faz.
      await reativar(empresa);

      // DISPARO 2 — o encerramento põe em dia, e UMA vez.
      const capturador = criarCapturadorDeEmail();
      const montagem = montarConsumidores({ email: capturador });
      await limparFilas(montagem.fila);

      expect((await executarDespachante([ARGV_DO_ENCERRAMENTO])).codigo).toBe(CODIGO_DE_SUCESSO);
      expect(
        (await sondarAteTerminarem(montagem.fila.rotinaAgendada, 1)).map(({ estado }) => estado),
      ).toEqual(['completed']);

      expect(await lerEstadoDoPar(empresa, par)).toEqual({
        status: 'ENCERRADO',
        situacaoDoImovel: SITUACAO_DISPONIVEL,
      });
      expect(await lerRegistrosDeRotina(empresa, 'ENCERRAMENTO_DE_CONTRATOS')).toEqual([
        {
          rotina: 'ENCERRAMENTO_DE_CONTRATOS',
          resumo: { candidatos: 1, encerrados: 1, preservados: 0 },
        },
      ]);

      // DISPARO 3 — o mesmo encerramento, imediatamente depois: `{0,0,0}` e NENHUM registro novo.
      await limparFilas(montagem.fila);
      expect((await executarDespachante([ARGV_DO_ENCERRAMENTO])).codigo).toBe(CODIGO_DE_SUCESSO);
      expect(
        (await sondarAteTerminarem(montagem.fila.rotinaAgendada, 1)).map(({ estado }) => estado),
      ).toEqual(['completed']);
      // Uma vez, não N: a segunda passagem não encontrou candidato e, pelo predicado da RN-15, não
      // deixou linha alguma — o histórico continua com o único registro do disparo 2.
      expect(await lerRegistrosDeRotina(empresa, 'ENCERRAMENTO_DE_CONTRATOS')).toHaveLength(1);

      // DISPARO 4 — o aviso, com a JANELA ABERTA. As três da carteira não são reavisadas; a de
      // controle é.
      const enviosAntesDoAviso = await contarEnviosDeCobranca(empresa);
      await limparFilas(montagem.fila);
      expect((await executarDespachante([ARGV_DO_AVISO])).codigo).toBe(CODIGO_DE_SUCESSO);
      expect(
        (await sondarAteTerminarem(montagem.fila.regua, 1)).map(({ estado }) => estado),
      ).toEqual(['completed']);

      const capturados = capturador.capturas.map((captura) => captura.destinatario);
      // ⚠️ A asserção que discrimina: `0` para os locatários da carteira, COM a janela aberta.
      expect(capturados.filter((endereco) => endereco === carteira.destinatario)).toEqual([]);
      // O controle positivo: a passagem correu, a janela estava aberta, e a cobrança nova saiu.
      expect(capturados).toEqual([controle.destinatario]);
      // E o número de linhas gravadas cresceu de exatamente UMA — a do controle.
      expect(await contarEnviosDeCobranca(empresa)).toBe(enviosAntesDoAviso + 1);
    },
    LIMITE_DO_CASO_MS,
  );
});

// ---------------------------------------------------------------------------
// O lançamento do ponto de entrada — SUBPROCESSO real, ambiente explícito
// ---------------------------------------------------------------------------

/** O que o processo-pai observa de um lançamento do despachante. */
interface DesfechoDoLancamento {
  readonly codigo: number | null;
  readonly saida: string;
  readonly erro: string;
}

/**
 * O ambiente mínimo de um lançamento — **montado variável a variável**, nunca herdado.
 *
 * Herdar `process.env` faria a prova de *"a partida recusa sem a variável"* depender do ambiente de
 * quem roda a suíte: num host com `DATABASE_URL` exportada, a linha "sem DATABASE_URL" passaria a
 * exercitar outra coisa. As coordenadas são as das instâncias **efêmeras** (ADR-0006).
 */
function ambienteDoDespacho(): Record<string, string> {
  return {
    PATH: process.env.PATH ?? '',
    HOME: process.env.HOME ?? '',
    LOG_LEVEL: SEVERIDADE,
    DATABASE_URL: banco.cadeiaConexao,
    REDIS_URL: instanciaDaFila.cadeiaConexao,
  };
}

/**
 * Executa `node dist/despachante.js <argv…>` e devolve código de saída e as duas saídas.
 *
 * `spawn`, e não `execFile`: o segundo rejeita no código diferente de zero e a captura do desfecho
 * ficaria dentro de um `catch` — e é justamente o código diferente de zero que metade dos casos
 * existe para observar.
 */
function executarDespachante(
  argv: readonly string[],
  ambiente: Record<string, string> = ambienteDoDespacho(),
): Promise<DesfechoDoLancamento> {
  return new Promise((resolver, rejeitar) => {
    const filho = spawn(process.execPath, [DESPACHANTE, ...argv], {
      env: ambiente,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let saida = '';
    let erro = '';
    filho.stdout.setEncoding('utf8');
    filho.stderr.setEncoding('utf8');
    filho.stdout.on('data', (pedaco: string) => {
      saida += pedaco;
    });
    filho.stderr.on('data', (pedaco: string) => {
      erro += pedaco;
    });

    const limite = setTimeout(() => {
      filho.kill('SIGKILL');
      rejeitar(
        new Error(`o despachante não terminou em ${String(LIMITE_DO_SUBPROCESSO_MS)} ms:\n${erro}`),
      );
    }, LIMITE_DO_SUBPROCESSO_MS);

    filho.on('error', (falha: Error) => {
      clearTimeout(limite);
      rejeitar(falha);
    });
    filho.on('close', (codigo) => {
      clearTimeout(limite);
      resolver({ codigo, saida, erro });
    });
  });
}

// ---------------------------------------------------------------------------
// A observação das filas
// ---------------------------------------------------------------------------

/** Uma fila observável, no molde tipado de `apps/api/src/comum/produtor-de-fila.ts`. */
type FilaObservavel<C> = Queue<C, void, string, C, void, string>;

/** Conecta a fila real **sem registrar consumidor** — o observador puro dos casos de produção. */
function filaObservadora(): Fila {
  const fila = conectarFila(instanciaDaFila.cadeiaConexao, criarLogger({ nivel: 'error' }));
  onTestFinished(async () => {
    await fila.encerrar();
  });

  return fila;
}

/** O que a montagem devolve: a fila conectada e as linhas que o registrador escreveu. */
interface Montagem {
  readonly fila: Fila;
  eventos(): Record<string, unknown>[];
}

/**
 * Conecta a fila real e registra os consumidores da rotina agendada e da régua.
 *
 * É a **mesma** fiação de `apps/worker/src/main.ts`: `conectarFila` mais `processar(…)`, com cada
 * borda recebendo as portas por parâmetro. A única diferença é qual implementação a composição
 * injeta — que é exatamente a diferença que a operação também tem entre si mesma e a verificação.
 *
 * ⚠️ **Uma montagem por caso, e nunca em laço.** Dois consumidores vivos na mesma fila competem pela
 * tarefa, e o desfecho passa a depender de qual venceu.
 */
function montarConsumidores(opcoes: {
  readonly email?: PortaDeEnvioDeEmail;
  readonly banco?: AcessoAoBanco;
}): Montagem {
  const linhas: string[] = [];
  const logger = criarLogger({
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

  const bancoDaBorda = opcoes.banco ?? acesso;

  fila.processar(
    fila.rotinaAgendada,
    async (tarefa, registrador) =>
      await processarRotinaAgendada(tarefa, registrador, {
        banco: bancoDaBorda,
        adaptador: adaptadorNaoEsperado(),
        guarda: guardaDeProducao(),
        chaveDeCifra: CHAVE_DE_CIFRA,
      }),
  );

  const email = opcoes.email;
  if (email !== undefined) {
    fila.processar(
      fila.regua,
      async (tarefa, registrador) =>
        await processarReguaDeCobranca(tarefa, registrador, { banco: bancoDaBorda, email }),
    );
  }

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
 * O adaptador do provedor que **nenhuma rotina deste arquivo deve chamar** — levanta nomeando-se.
 *
 * É asserção, e não zelo: das quatro rotinas por empresa, só a conferência fala com o provedor, e
 * nenhum caso daqui a exercita. Uma chamada derrubaria o caso no ponto, em vez de passar despercebida.
 */
function adaptadorNaoEsperado(): AdaptadorCobrancaBancaria {
  const recusar = (nome: string) => async (): Promise<never> => {
    throw new Error(`a rotina chamou uma operação que ela não deve chamar: ${nome}`);
  };

  return {
    consultarSituacao: recusar('consultarSituacao'),
    emitir: recusar('emitir'),
    solicitarRevogacaoDeBoleto: recusar('solicitarRevogacaoDeBoleto'),
    confirmarRevogacaoDeBoleto: recusar('confirmarRevogacaoDeBoleto'),
  };
}

/**
 * Uma porta de dados que **recusa a unidade de trabalho** aberta sob o contexto da empresa informada.
 *
 * Ver o docblock do `CT-1076` para por que a falha entra por aqui, e por que isso **não** é bandeira
 * em produção: `AcessoAoBanco` é uma das portas que a composição raiz injeta (ADR-0025), e o
 * discriminador é o contexto de tenant que a **borda** abriu — a tarefa falha porque é a daquela
 * empresa.
 *
 * O identificador vem por **fecho léxico** e não é lido de ambiente nem de bandeira: quem decide é a
 * composição do caso, exatamente como a operação decide qual adaptador do provedor injetar.
 */
function bancoQueRecusaSobContextoDe(empresaId: string): AcessoAoBanco {
  return {
    async emUnidadeDeTrabalho<T>(trabalho: (tx: TransactionSql) => Promise<T>): Promise<T> {
      return await acesso.emUnidadeDeTrabalho(async (tx) => {
        const [linha] = await tx<{ empresa: string | null }[]>`
          SELECT nullif(current_setting('app.empresa_id', true), '') AS empresa
        `;

        if (linha?.empresa === empresaId) {
          throw new Error('a porta de dados recusou a unidade de trabalho desta passagem');
        }

        return await trabalho(tx);
      });
    },
    encerrar: async () => {
      // O acesso real é encerrado pelo `afterAll` deste arquivo, que é quem o abriu. Encerrá-lo aqui
      // derrubaria o arranjo dos casos seguintes.
    },
  };
}

/** As cargas efetivamente publicadas num produtor, em qualquer estado terminal ou de espera. */
async function cargasDe<C>(produtor: FilaObservavel<C>): Promise<C[]> {
  const tarefas = await produtor.getJobs([...ESTADOS_OBSERVADOS]);

  return tarefas.map((tarefa) => tarefa.data);
}

/** As tarefas efetivamente publicadas num produtor — quando o identificador delas importa. */
async function tarefasDe<C>(produtor: FilaObservavel<C>): Promise<Job<C, void>[]> {
  return await produtor.getJobs([...ESTADOS_OBSERVADOS]);
}

/** Os quatro produtores que esta fatia alimenta — a contagem "em TODAS as filas" sai daqui. */
async function contarTarefas(fila: Fila): Promise<number> {
  const contagens = await Promise.all([
    cargasDe(fila.regua),
    cargasDe(fila.rotinaAgendada),
    cargasDe(fila.manutencaoDoAcervo),
    cargasDe(fila.notificacaoBancaria),
  ]);

  return contagens.reduce((total, cargas) => total + cargas.length, 0);
}

/**
 * Apaga toda tarefa das quatro filas — o servidor de fila é **um só** para o arquivo inteiro.
 *
 * Sem isto, a retenção por contagem de `OPCOES_PADRAO_DA_TAREFA` deixaria as tarefas concluídas de um
 * caso visíveis no seguinte, e as contagens passariam a descrever outra coisa.
 */
async function limparFilas(fila: Fila): Promise<void> {
  await fila.regua.obliterate({ force: true });
  await fila.rotinaAgendada.obliterate({ force: true });
  await fila.manutencaoDoAcervo.obliterate({ force: true });
  await fila.notificacaoBancaria.obliterate({ force: true });
}

/** Uma tarefa terminada, com o estado em que ela parou. */
interface TarefaTerminada<C> {
  readonly tarefa: Job<C, void>;
  readonly estado: string;
}

/**
 * Espera as `quantas` tarefas do produtor alcançarem estado terminal, por **sondagem**.
 *
 * `completed` e `failed` são os dois estados terminais; `delayed` e `waiting` — onde a tarefa fica
 * entre as tentativas da política de repetição — **não** encerram a espera.
 */
async function sondarAteTerminarem<C>(
  produtor: FilaObservavel<C>,
  quantas: number,
): Promise<TarefaTerminada<C>[]> {
  await sondarAte(
    `as ${String(quantas)} tarefas de ${produtor.name} alcançarem estado terminal`,
    async () => {
      const estados = await Promise.all(
        (await produtor.getJobs([...ESTADOS_OBSERVADOS])).map(
          async (tarefa) => await tarefa.getState(),
        ),
      );

      return (
        estados.length === quantas &&
        estados.every((estado) => estado === 'completed' || estado === 'failed')
      );
    },
    LIMITE_ESTADO_TERMINAL_MS,
  );

  const tarefas = await produtor.getJobs([...ESTADOS_OBSERVADOS]);

  return await Promise.all(
    tarefas.map(async (tarefa) => ({ tarefa, estado: await tarefa.getState() })),
  );
}

/** As empresas cujas tarefas pararam no estado informado, ordenadas. */
function empresasNoEstado<C extends { readonly empresaId: string }>(
  terminadas: readonly TarefaTerminada<C>[],
  estado: string,
): string[] {
  return terminadas
    .filter((terminada) => terminada.estado === estado)
    .map((terminada) => terminada.tarefa.data.empresaId)
    .sort();
}

// ---------------------------------------------------------------------------
// A varredura estática do CT-1078
// ---------------------------------------------------------------------------

/** Um fonte varrido: o caminho relativo que a reprovação nomeia e o texto dele. */
interface FonteVarrido {
  readonly caminho: string;
  readonly texto: string;
}

/**
 * As ocorrências de {@link CHAVE_DE_IDEMPOTENCIA} em posição **executável**, como `arquivo:linha`.
 *
 * As linhas de comentário são descartadas antes da busca: o cabeçalho do despachante **explica** por
 * que a chave não é usada, e uma varredura cega ao comentário reprovaria a documentação da própria
 * decisão. O recorte é o mesmo que `packages/db/test/varredura-de-fontes.ts` faz para o eixo do
 * relógio.
 */
function ocorrenciasDaChave(fontes: readonly FonteVarrido[]): string[] {
  const achados: string[] = [];

  for (const fonte of fontes) {
    for (const [indice, linha] of fonte.texto.split('\n').entries()) {
      const semProsa = linha.trim();
      const ehComentario =
        semProsa.startsWith('//') || semProsa.startsWith('*') || semProsa.startsWith('/*');

      if (!ehComentario && semProsa.includes(CHAVE_DE_IDEMPOTENCIA)) {
        achados.push(`${fonte.caminho}:${String(indice + 1)}`);
      }
    }
  }

  return achados;
}

// ---------------------------------------------------------------------------
// O arranjo — sempre pelas portas de produção
// ---------------------------------------------------------------------------

/**
 * Executa o trabalho sob o contexto informado, dentro de uma unidade de trabalho.
 *
 * **Aplicação parcial** da casa compartilhada do diretório sobre o acesso que este arquivo abriu — a
 * convenção *"acessório de suíte se importa, não se copia"* do `CLAUDE.md`. Ver `./acessorios-de-borda.ts`
 * para por que a casa de `packages/db/test/` **não serve** aqui (fronteira `dist/` × fonte, medida).
 */
async function emUnidade<T>(
  contexto: Contexto,
  trabalho: (tx: TransactionSql) => Promise<T>,
): Promise<T> {
  return await emUnidadeSobContexto(acesso, contexto, trabalho);
}

/**
 * Suspende **toda** empresa hoje existente, pela porta de produção.
 *
 * A leitura é crua e o `WHERE` é por `id` — `identidade.empresa` nunca teve política (ADR-0009), e
 * ali ele **é** o caminho. Ela não usa `listarEmpresasAtivas` de propósito: o arranjo não pode
 * depender do símbolo sob prova (ver o cabeçalho).
 *
 * `suspenderEmpresa` é idempotente por `coalesce(suspensa_em, now())`, de modo que repetir sobre uma
 * já suspensa preserva o instante original e não é erro.
 */
async function suspenderTodasAsEmpresas(): Promise<void> {
  await emUnidade(CONTEXTO_DA_SEMENTE, async (tx) => {
    const linhas = await tx<{ id: string }[]>`SELECT id FROM identidade.empresa`;

    for (const linha of linhas) {
      await suspenderEmpresa(tx, linha.id);
    }
  });
}

/** Três empresas, com a do meio suspensa — o arranjo comum do CT-1075 e do CT-1077. */
async function tresEmpresasComUmaSuspensa(
  marca: string,
): Promise<{ readonly a: Contexto; readonly b: Contexto; readonly c: Contexto }> {
  await suspenderTodasAsEmpresas();

  const a = await admitirEmpresaNova(`${marca}-a`);
  const b = await admitirEmpresaNova(`${marca}-b`);
  const c = await admitirEmpresaNova(`${marca}-c`);
  await suspender(b);

  return { a, b, c };
}

/** Suspende a empresa do contexto — a mesma escrita que `EmpresaService.suspender` faz. */
async function suspender(contexto: Contexto): Promise<void> {
  const marca = await emUnidade(
    contexto,
    async (tx) => await suspenderEmpresa(tx, contexto.empresaId),
  );

  if (marca === undefined) {
    throw new Error(`o arranjo não conseguiu suspender a empresa ${contexto.empresaId}`);
  }
}

/** Reativa a empresa do contexto — a mesma escrita que `EmpresaService.reativar` faz. */
async function reativar(contexto: Contexto): Promise<void> {
  const reativada = await emUnidade(
    contexto,
    async (tx) => await reativarEmpresa(tx, contexto.empresaId),
  );

  if (reativada === undefined) {
    throw new Error(`o arranjo não conseguiu reativar a empresa ${contexto.empresaId}`);
  }
}

/**
 * Admite uma empresa nova e devolve o contexto dela.
 *
 * `identidade.empresa` não tem política (ADR-0009), de modo que a admissão corre sob qualquer contexto
 * válido — e ela é a porta pública do pacote, a mesma que o Master usa.
 */
async function admitirEmpresaNova(marca: string): Promise<Contexto> {
  empresasAdmitidas += 1;
  const documento = `77${String(empresasAdmitidas).padStart(12, '0')}`;

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
}

/** O que a cadeia semeada devolve — o suficiente para ativar ou lançar cobranças. */
interface CadeiaSemeada {
  readonly contratoId: string;
  readonly contratoCodigo: string;
  readonly imovelId: string;
  /** O endereço do locatário, **como o cadastro o gravou** — nunca recomposto por concatenação. */
  readonly destinatario: string;
}

/** Um cadastro de pessoa mínimo — a conferência de dígito verificador é do contrato, não da porta. */
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
 * Semeia `conjunto → imóvel → pessoas → contrato`, **sempre pelas portas de produção**.
 *
 * ⚠️ **Medição de 2026-08-23**: este arranjo é a **segunda** cópia da cadeia de cadastro em
 * `apps/worker/test/` (a primeira é `semearCadeia`, em `./rotina-agendada.spec.ts`), e a casa
 * compartilhada `packages/db/test/cenario-de-cobranca.ts` **é inutilizável daqui** pela razão medida
 * em `./acessorios-de-borda.ts`: ela resolve `contextoDeTenant` pelo fonte de `@sysloc/db`, e este
 * pacote o resolve por `dist/` — duas instâncias de `AsyncLocalStorage`, e toda escrita do arranjo
 * cai em `new row violates row-level security policy`. O Limiar de Três **não disparou**; ao terceiro
 * consumidor, a cadeia sobe para casa compartilhada de `apps/worker/test/`.
 *
 * As duas séries são emitidas pelo protocolo das **duas unidades sequenciais** (ADR-0020/0033): a
 * primeira garante o contador e **commita**; a segunda emite o número e grava. Fundir as duas é o
 * desenho que a ADR recusa.
 */
async function semearCadeia(contexto: Contexto, marcaBase: string): Promise<CadeiaSemeada> {
  sequenciaDoCenario += 1;
  const marca = `${marcaBase}-${String(sequenciaDoCenario)}`;

  // Os dados do locatário nascem UMA vez e são reusados: o endereço que a régua entrega é o que o
  // cadastro gravou, e recompô-lo por concatenação no fim criaria uma segunda derivação livre para
  // divergir de `pessoaDe`.
  const dadosDoLocatario = pessoaDe(`Locatário ${marca}`);

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
    const locatario = await criarPessoa(tx, 'locatario', dadosDoLocatario);

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

  return {
    contratoId: contrato.id,
    contratoCodigo: contrato.codigo,
    imovelId: cadastros.imovelId,
    destinatario: dadosDoLocatario.email,
  };
}

/**
 * Semeia a cadeia, deixa o contrato **vigente** e lança `quantas` cobranças já avisáveis.
 *
 * O contrato nasce vigente com fim no futuro: o que este arranjo produz é carteira para a régua, e um
 * contrato vencido faria a rotina de encerramento do mesmo caso alcançá-lo sem querer.
 */
async function semearCadeiaComCobranca(
  contexto: Contexto,
  marca: string,
  quantas = 1,
): Promise<CadeiaSemeada> {
  const cadeia = await semearCadeia(contexto, marca);
  await ativarPar(contexto, cadeia, DIAS_A_VENCER, SITUACAO_LOCADO);

  const anoDaCobranca = await emUnidade(contexto, lerAnoDaSerieDeCobranca);
  await emUnidade(contexto, async (tx) => {
    await garantirContadorDeCobranca(tx, anoDaCobranca);
  });

  for (let indice = 0; indice < quantas; indice += 1) {
    await emUnidade(contexto, async (tx) => {
      const numero = await emitirNumeroDeCobranca(tx, anoDaCobranca);

      await criarCobranca(
        tx,
        {
          contratoId: cadeia.contratoId,
          natureza: 'ALUGUEL',
          referencia: `Aluguel ${marca}-${String(indice)}`,
          competencia: COMPETENCIA,
          dataVencimento: await dataDeslocada(tx, VENCIDA_RECENTE - indice),
          valorOriginal: VALOR_DA_COBRANCA,
        },
        { ano: anoDaCobranca, numero },
      );
    });
  }

  return cadeia;
}

/** Semeia a cadeia e deixa o contrato **vigente**, com o fim deslocado em `offsetDias`. */
async function semearParVigente(
  contexto: Contexto,
  marca: string,
  offsetDias: number,
  situacaoDoImovel: SituacaoDeLocacao,
): Promise<ParSemeado> {
  const cadeia = await semearCadeia(contexto, marca);
  await ativarPar(contexto, cadeia, offsetDias, situacaoDoImovel);

  return { contratoCodigo: cadeia.contratoCodigo };
}

/**
 * Ativa o contrato e põe o imóvel na situação pedida — a composição de `ContratoService.ativar`.
 *
 * A data sai de `negocio.data_corrente_da_operacao()` deslocada **no SQL** (ADR-0026): compô-la no
 * processo faria o arranjo medir a diferença entre dois relógios.
 */
async function ativarPar(
  contexto: Contexto,
  cadeia: CadeiaSemeada,
  offsetDias: number,
  situacaoDoImovel: SituacaoDeLocacao,
): Promise<void> {
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

// ---------------------------------------------------------------------------
// A política de aviso e as janelas
// ---------------------------------------------------------------------------

/** Uma janela de horário, como a política a guarda. */
interface Janela {
  readonly inicio: string;
  readonly fim: string;
}

/** A janela que nunca fecha — a mesma das suítes irmãs, imune à virada do dia. */
const JANELA_SEMPRE_ABERTA: Janela = { inicio: '00:00', fim: '23:59' };

/**
 * Deriva, da hora corrente **do banco**, uma janela que a contém e outra que não.
 *
 * A **aberta** é a que nunca fecha, e a escolha é deliberada: qualquer banda derivada da hora corrente
 * deixaria de conter o instante do disparo na virada da meia-noite, e o caso passaria a depender de
 * quando a suíte roda. Quem afirma que ela contém a hora lida é o predicado de produção, no próprio
 * caso.
 *
 * A **fechada** é derivada, com folga de ao menos **uma hora** dos dois lados do instante lido — é o
 * que a torna estável mesmo que o disparo aconteça minutos depois da leitura, e mesmo na virada.
 */
function janelasOpostas(agora: string): { readonly aberta: Janela; readonly fechada: Janela } {
  const hora = Number(agora.slice(0, 2));

  return {
    aberta: JANELA_SEMPRE_ABERTA,
    fechada: hora < 12 ? { inicio: '13:00', fim: '22:59' } : { inicio: '01:00', fim: '10:59' },
  };
}

/** A política dos casos: ligada, com a janela informada e trava de intervalo longa. */
function politicaCom(janela: Janela): PoliticaDeAvisoNova {
  return {
    ativo: true,
    diasAntesDoVencimento: 10,
    // ⚠️ **Trinta dias**, e o número é conteúdo do `CT-1081`: ele precisa ser MAIOR que a suspensão
    // simulada, porque é justamente a trava do intervalo que a reativação não pode zerar.
    intervaloMinimoDias: 30,
    janelaInicio: janela.inicio,
    janelaFim: janela.fim,
    canal: 'EMAIL',
  };
}

/** Grava a política da empresa do contexto, pela porta de produção. */
async function gravarPolitica(contexto: Contexto, politica: PoliticaDeAvisoNova): Promise<void> {
  await emUnidade(contexto, async (tx) => {
    await gravarPoliticaDeAviso(tx, politica);
  });
}

// ---------------------------------------------------------------------------
// As notícias bancárias do CT-1079
// ---------------------------------------------------------------------------

/** Apaga o cru remanescente de execuções anteriores — o schema `plataforma` não tem dono-empresa. */
async function esvaziarNoticias(): Promise<void> {
  await emUnidade(CONTEXTO_DA_SEMENTE, async (tx) => {
    await tx`DELETE FROM plataforma.notificacao_bancaria`;
  });
}

/**
 * Semeia uma notícia com o desfecho e a idade pedidos, **derivada de `now()` do banco**.
 *
 * A gravação usa a porta de produção (`registrarNotificacaoBancaria`), e o que o arranjo ajusta
 * depois são o instante e o desfecho — que a porta não abre por parâmetro, de propósito: `recebido_em`
 * é padrão da coluna e `desfecho` nasce `RECEBIDO`. Abrir parâmetro para servir a este arranjo daria a
 * quem chama o poder de escolher quando a notícia chegou.
 *
 * A `CHECK` do banco amarra `tratado_em` ao desfecho (`(tratado_em IS NULL) = (desfecho =
 * 'RECEBIDO')`), e por isso o carimbo acompanha o desfecho não-`RECEBIDO`.
 */
async function semearNoticia(desfecho: string, minutosAtras: number): Promise<string> {
  return await emUnidade(CONTEXTO_DA_SEMENTE, async (tx) => {
    const id = await registrarNotificacaoBancaria(tx, { recebido: { marca: desfecho } });

    await tx`
      UPDATE plataforma.notificacao_bancaria
         SET recebido_em = now() - make_interval(mins => ${minutosAtras}::integer),
             desfecho = ${desfecho}::plataforma.desfecho_da_notificacao,
             tratado_em = CASE WHEN ${desfecho} = 'RECEBIDO' THEN NULL ELSE now() END
       WHERE id = ${id}
    `;

    return id;
  });
}

/** O identificador semeado sob o rótulo, ou uma falha nomeada — nunca `undefined` silencioso. */
function exigirSemeada(semeadas: ReadonlyMap<string, string>, rotulo: string): string {
  const id = semeadas.get(rotulo);

  if (id === undefined) {
    throw new Error(`o arranjo não semeou a notícia '${rotulo}'`);
  }

  return id;
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

/** Quantas linhas de `negocio.envio_de_cobranca` o contexto corrente alcança. */
async function contarEnviosDeCobranca(contexto: Contexto): Promise<number> {
  return await emUnidade(contexto, async (tx) => {
    const [linha] = await tx<{ total: number }[]>`
      SELECT count(*)::integer AS total FROM negocio.envio_de_cobranca
    `;

    if (linha === undefined) {
      throw new Error('a contagem crua de envio_de_cobranca não devolveu linha');
    }

    return linha.total;
  });
}

/** Quantas linhas de `negocio.execucao_de_rotina` o contexto corrente alcança. */
async function contarRegistrosDeRotina(contexto: Contexto): Promise<number> {
  return (await lerRegistrosDeRotina(contexto)).length;
}

/** Um registro de execução como o banco o guarda — a rotina e o resumo. */
interface RegistroLido {
  readonly rotina: string;
  readonly resumo: Record<string, number>;
}

/** As linhas de `negocio.execucao_de_rotina` alcançáveis pelo contexto, na ordem de ocorrência. */
async function lerRegistrosDeRotina(contexto: Contexto, rotina?: string): Promise<RegistroLido[]> {
  const linhas = await emUnidade(contexto, async (tx) => {
    return await tx<RegistroLido[]>`
      SELECT rotina::text AS rotina, resumo
        FROM negocio.execucao_de_rotina
       ORDER BY ocorrida_em, rotina
    `;
  });

  return rotina === undefined ? linhas : linhas.filter((linha) => linha.rotina === rotina);
}
