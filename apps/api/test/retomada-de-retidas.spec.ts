/**
 * A **retomada das notícias bancárias retidas na reativação da empresa** — T9 da fatia
 * `webhook-e-carne`, CA-10.
 *
 * ===========================================================================
 * INVARIANTES
 * ===========================================================================
 *
 * | Critério | Caso    | Invariante |
 * |----------|---------|------------|
 * | CA-10    | CT-985  | **Nada se perde.** Três notícias retidas durante a suspensão, gravadas em
 * |          |         | instantes distintos e conhecidos, são reenfileiradas pelo **ato de
 * |          |         | reativar** — pelo produtor real, na fila real —, na ordem de `recebido_em`
 * |          |         | **crescente**, e as três chegam a `APLICADO` com o efeito na trilha. A
 * |          |         | ordem de criação é **deliberadamente diferente** da ordem de chegada: sem
 * |          |         | isso, um reenfileiramento por ordem de inserção passaria. |
 * | CA-10    | CT-985  | **A reativação sem retida é inerte, e não silenciosa.** Zero tarefas novas
 * |          | (b)     | na fila, e a linha de `info` publica `empresaId` e `quantidade: 0` — o
 * |          |         | zero é a evidência de que a varredura correu, e o que separa *"não havia
 * |          |         | o que retomar"* de *"ninguém procurou"*. |
 * | CA-09    | CT-985  | **A retomada não duplica efeito.** Notícia retida enquanto a MESMA
 * | CA-10    | (c)     | liquidação produzia efeito por outra empresa, ainda ativa: retomada, ela
 * |          |         | termina `REENTREGA`, o contador da porta **não sobe**, e a cobrança e a
 * |          |         | trilha dela ficam idênticas. É a camada 1 da idempotência — que é por
 * |          |         | identificador de liquidação, e **global**, porque a tabela crua não tem
 * |          |         | dono-empresa — atravessando a retomada. |
 * | CA-10    | CT-986  | **A varredura é global; quem isola é o re-roteamento.** Duas empresas
 * |          |         | suspensas, uma retida cada: reativar **só A** enfileira **as duas** (a
 * |          |         | tabela crua não tem, e não pode ter, `empresa_id` — ADR-0031), e mesmo
 * |          |         | assim o de A avança para `APLICADO` enquanto o de B **volta a `RETIDO`**,
 * |          |         | com a cobrança de B **inalterada** por igualdade profunda. Reativada B
 * |          |         | depois, a dela — retida **duas** vezes — também aplica: nada se perde. |
 *
 * Rastreabilidade: `CA-10 → CT-985, CT-985 (b), CT-986 (RN-09)` · `CA-09 → CT-985 (c) (RN-08)`.
 *
 * ⚠️ **O limite declarado da CA-10 não ganha caso, e a ausência é escolha.** A notícia retida que
 * vencer os 90 dias durante a suspensão é apagada pelo expurgo, porque a RN-11 é incondicional —
 * preservá-la criaria retenção **sem prazo** de dado pessoal de terceiro exatamente no caso que a
 * regra existe para fechar. A rede é a **conferência diária** da fatia anterior (risco R7): ela
 * descobre a liquidação de qualquer maneira, e o que se perde é a *origem* na trilha (aparece
 * `CONFERENCIA` em vez de `NOTICIA_DO_PROVEDOR`), nunca o recebimento. O expurgo já tem caso
 * próprio — o `CT-988` de `apps/worker/test/notificacao-bancaria.spec.ts` —, e um caso aqui sobre a
 * mesma instrução seria duplicação semântica (AP-26), não cobertura nova.
 *
 * ===========================================================================
 * POR QUE ESTA SUÍTE MORA EM `apps/api/test/`, e não junto do tratamento
 * ===========================================================================
 *
 * O gatilho da CA-10 é o **ato de reativar**, e ele vive em `EmpresaService.reativar`
 * (`apps/api/src/master/`). O tratamento vive na tarefa do processo de trabalho
 * (`apps/worker/src/tarefas/`). Provar *"nada se perde"* exige os **dois** no mesmo caso, e só há
 * uma direção em que eles se encontram: `apps/api` declara `@nestjs/common` e alcança o fonte do
 * processo de trabalho pelo caminho de arquivo, enquanto `apps/worker` **não** declara o arcabouço
 * e não teria como carregar o serviço do Master sem alargar o manifesto dele por causa de teste.
 *
 * É a **mesma** aresta, e a mesma razão, que a T6 já abriu em `./notificacao-bancaria.e2e.spec.ts`:
 * a verificação de `apps/api` importa o fonte de `apps/worker`, e nunca o contrário — nada de
 * `apps/api/src` conhece aquele caminho.
 *
 * ===========================================================================
 * NENHUM ESTADO É FORJADO — a via de cada precondição privilegiada
 * ===========================================================================
 *
 *   * **a suspensão e a reativação** passam por `EmpresaService.suspender` e
 *     `EmpresaService.reativar` — o serviço real do Master, com o **produtor de fila real**
 *     (`conectarProdutorDeFila`) apontado à instância efêmera. Nenhum `UPDATE` em
 *     `identidade.empresa` é escrito por esta suíte, e o reenfileiramento **não** é simulado;
 *   * **o desfecho `RETIDO`** nasce do caminho de produção: o aviso é gravado pela porta de
 *     recepção e tratado pela **tarefa real**, que o retém no passo B.6 porque a empresa está
 *     suspensa. Nada aqui chama `marcarDesfecho`;
 *   * **os instantes de chegada** são movidos por `envelhecerCru`, e o instante sai de `now()` do
 *     **servidor** — nunca de `new Date()` do processo, que é o segundo eixo de relógio que a
 *     ADR-0026 fecha. É a mesma forma, e a mesma razão, do `CT-988`;
 *   * **o contexto de tenant** nunca é fixado em torno da tarefa: ele nasce dentro da borda, do
 *     `empresaId` que a função de roteamento devolveu. O `contextoDeTenant.executarCom` que aparece
 *     aqui é do **arranjo** e da **leitura**.
 *
 * A porta do provedor é uma **implementação de verificação** da `AdaptadorCobrancaBancaria`
 * (ADR-0025), instrumentada para contar chamadas e guardar argumentos. Não há mock de banco, de
 * fila nem de HTTP.
 *
 * ===========================================================================
 * A ORDEM DE ENFILEIRAMENTO É OBSERVADA DIRETO, e não inferida do processamento
 * ===========================================================================
 *
 * Cada caso **encerra o consumidor antes de reativar**, lê a fila em espera pela `Queue` real — na
 * ordem em que o servidor de fila a devolve — e só então religa um consumidor para drenar. Inferir
 * a ordem pela sequência de consultas ao provedor mediria *"a fila é FIFO com concorrência 1"*, que
 * é propriedade da biblioteca, e não *"o serviço enfileirou na ordem de chegada"*, que é a promessa
 * do produto.
 *
 * ===========================================================================
 * NENHUMA INICIALIZAÇÃO DA BIBLIOTECA DE FILA FICA EM VOO — e por que isso é deste arquivo
 * ===========================================================================
 *
 * Este arquivo levanta e devolve fiações de fila **dentro de cada caso** — sete `conectarFila` ao
 * todo, seis filas cada, mais o leitor do `beforeAll`. É uma janela que os demais arquivos de borda
 * não têm, e ela tem um modo de falha próprio, medido na biblioteca:
 *
 *   1. uma `Queue` construída sobre uma conexão que **quem chama já possui** é, para a biblioteca,
 *      uma conexão *compartilhada*: fechar a fila não fecha o cliente;
 *   2. o fecho da fila roda `removeAllListeners()` na conexão interna dela, **inclusive quando a
 *      inicialização ainda está em voo** — a espera de prontidão, o `INFO` de versão e a carga dos
 *      roteiros levam tempo, e sob contenção de máquina levam mais;
 *   3. a inicialização que rejeitar **depois** disso é reemitida como `error` num emissor que já
 *      não tem ouvinte — e `emit('error')` sem ouvinte **lança**, de dentro do `catch` que a
 *      própria biblioteca instalou, virando **rejeição não tratada**.
 *
 * O desfecho é traiçoeiro porque **não reprova caso algum**: a suíte fica verde e o *comando* do
 * pacote sai `1`, com `Errors N errors`. Uma linha de base que sai vermelha sem nenhum caso
 * vermelho é a que ninguém lê — e leva junto o dia em que a asserção de verdade reprovar.
 *
 * A biblioteca já fecha essa porta para o **consumidor**: a conexão dele não é compartilhada, e o
 * fecho dela suprime a rejeição tardia. Para as **filas**, não fecha. Por isso as duas metades
 * abaixo, e as duas valem para toda fila que este arquivo levanta, não para a que aparecer numa
 * pilha:
 *
 *   * {@link aguardarFilasProntas} espera **todas** as filas da fiação ficarem prontas antes de
 *     qualquer trabalho, no ponto único em que elas nascem. A lista é **derivada** do objeto que
 *     `conectarFila` devolve, e não escrita à mão: uma sétima fila entra na barreira por
 *     construção. É a mesma disciplina que o encerramento de `apps/api/src/comum/produtor-de-fila.ts`
 *     registra por escrito — a lista das filas mora ao lado da criação, e não reescrita no fecho,
 *     porque a que for reescrita nasce um dia sem a fila nova e nada acusa;
 *   * o **desfecho do encerramento é afirmado**, e não descartado. `PRAZO-ESTOURADO` devolve a
 *     conexão *com* trabalho em voo — o mesmo estado do item 3, por outro caminho —, e descartá-lo
 *     faria a suíte tolerar em silêncio exatamente o que esta seção existe para impedir.
 *
 * ⚠️ **As quatro filas do produtor da borda ficam fora da barreira, e a ausência é de alcance, não
 * de escolha**: `conectarProdutorDeFila` não publica handle de fila alguma — por decisão do módulo
 * dele, que guarda a conexão para si. Elas não têm a janela do item 2 mesmo assim: nascem no
 * `beforeAll` e só são devolvidas no `afterAll`, com a suíte inteira entre as duas pontas. No dia
 * em que aquele módulo publicar prontidão, ela entra aqui.
 */

// O arcabouço aplica os decoradores de `EmpresaService` no carregamento do módulo, e eles gravam
// metadado por `Reflect`. Quem monta a aplicação inteira herda esta importação de `@nestjs/core`;
// esta suíte carrega o serviço **direto**, e por isso a declara. O pacote é dependência de
// `apps/api`, e não entra por esta linha.
import 'reflect-metadata';
import { randomBytes, randomUUID } from 'node:crypto';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  type AdaptadorCobrancaBancaria,
  type ConsultaDeSituacao,
  criarGuardaDeBoletos,
  type GuardaDeBoletos,
  type SituacaoConsultada,
} from '@sysloc/cobranca-bancaria';
import {
  type AcessoAoBanco,
  abrirAcessoAoBanco,
  contextoDeTenant,
  criarCobranca,
  criarConjunto,
  criarContrato,
  criarImovel,
  criarPessoa,
  type DadosDaPessoa,
  EMPRESA_A,
  EMPRESA_B,
  emitirNumeroDeCobranca,
  emitirNumeroDeContrato,
  garantirContadorDeCobranca,
  garantirContadorDeContrato,
  gravarBoletoDaCobranca,
  type LinhaDeEventoBancario,
  lerAnoDaSerieDeCobranca,
  lerAnoDaSerieDeContrato,
  lerNotificacaoBancaria,
  lerTrilhaDaCobranca,
  type NotificacaoBancariaPersistida,
  registrarCertificado,
  registrarIdentidadeNoProvedor,
  registrarNotificacaoBancaria,
  USUARIOS,
  type UsuarioSemeado,
} from '@sysloc/db';
import {
  cifrarSegredo,
  cifrarValorOperavel,
  criarLogger,
  criarSegredoOperavel,
  type Logger,
} from '@sysloc/shared';
import type { TransactionSql } from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
// DÉBITO COM GATILHO — D28 · F0/T5 · gatilho JÁ DISPARADO (F1/T2, 2026-08-02)
// (NÃO é uma `DECISÃO FECHADA`: ele agenda uma mudança, não protege o código abaixo.)
// O QUÊ: os imports a seguir atravessam a fronteira de `@sysloc/auth` e de `@sysloc/shared` por
//        CAMINHO DE ARQUIVO, fora do `exports` daqueles manifestos.
// QUANDO FECHA: declarar o subpath `"./test"` nos manifestos e importar por `@sysloc/<pacote>/test`,
//        ou extrair um `@sysloc/test-utils`.
// POR QUE NÃO AGORA: fechar exige editar os manifestos de vários pacotes e todos os consumidores,
//        nenhum deles no escopo desta task.
// ÍNDICE: docs/specs/features/fundacao-stack-nativa/v1/_run/run-report.md §2, D28
import {
  type IdentidadeEfemera,
  identidadeEfemera,
} from '../../../packages/auth/test/identidade-efemera.ts';
import { FAIXA_PORTAS_EFEMERAS, sondarAte } from '../../../packages/shared/test/efemero-comum.ts';
import { type FilaEfemera, redisEfemero } from '../../../packages/shared/test/redis-efemero.ts';
// A fiação do processo de trabalho é alcançada pelo caminho do fonte, e não por especificador de
// pacote: ele é aplicação privada, sem `exports`. É a mesma aresta — e a mesma razão — que a T6
// abriu em `./notificacao-bancaria.e2e.spec.ts`, e ela existe **só** na verificação e **só** nesta
// direção. Ver o cabeçalho.
import { conectarFila, type DesfechoDoEncerramento, type Fila } from '../../worker/src/fila.ts';
import { processarNotificacaoBancaria } from '../../worker/src/tarefas/notificacao-bancaria.ts';
import { conectarProdutorDeFila, type ProdutorDeFila } from '../src/comum/produtor-de-fila.ts';
import { EmpresaService } from '../src/master/empresa.service.ts';

// ---------------------------------------------------------------------------
// Limites de tempo — constantes nomeadas, nunca número mágico no meio do caso
// ---------------------------------------------------------------------------

/** Subir banco e fila efêmeros, provisionar, migrar e semear leva dezenas de segundos aqui. */
const LIMITE_SUBIDA_MS = 180_000;

/** Cada caso monta cadastros, cobranças com boleto e drena a fila real algumas vezes. */
const LIMITE_DO_CASO_MS = 180_000;

/** Limite para as tarefas reenfileiradas alcançarem desfecho, folgado sobre a repetição da fila. */
const LIMITE_DE_DRENAGEM_MS = 90_000;

/** Reserva de conexões: o arranjo, o serviço e o consumidor tocam o banco ao mesmo tempo. */
const RESERVA_DE_CONEXOES = 4;

/** Porta padrão do servidor de fila, usada pelo ambiente legado desta máquina (ADR-0006). */
const PORTA_PADRAO_DA_FILA = 6379;

// ---------------------------------------------------------------------------
// O arranjo — os vereditos declarados ANTES da execução
// ---------------------------------------------------------------------------

/** O valor de cada cobrança do arranjo, em reais. */
const VALOR_DA_COBRANCA = 1000;

/** Quantos dias à frente as cobranças vencem — folga que mantém a mora em zero. */
const DIAS_ATE_O_VENCIMENTO = 30;

/** O que o arranjo antepõe aos bytes do boleto, para que eles sejam reconhecíveis no disco. */
const PREFIXO_DO_DOCUMENTO = '%PDF-boleto-';

/** Quantas notícias o `CT-985` retém — três, como o card manda. */
const RETIDAS_DO_CT985 = 3;

/**
 * As idades, em dias, com que as três retidas do `CT-985` são posicionadas no tempo.
 *
 * ⚠️ **A ordem desta lista é a ordem de CRIAÇÃO, e ela é deliberadamente diferente da ordem
 * cronológica.** A mais antiga (3 dias) é criada no meio, e a mais recente (1 dia) primeiro: um
 * reenfileiramento que percorresse a tabela por ordem de inserção — ou por `id` — passaria numa
 * lista ordenada, e reprova nesta.
 */
const IDADES_DAS_RETIDAS = [1, 3, 2] as const;

/** O rótulo do nível informativo, tal como `criarLogger` o emite — escrito à mão, nunca lido do SUT. */
const NIVEL_DE_INFORMACAO = 'info';

/** A mensagem com que o serviço publica a retomada — cadeia EXATA. */
const MENSAGEM_DA_RETOMADA = 'notícias bancárias retidas reenfileiradas na reativação da empresa';

/** Os termos do contrato de apoio — nada aqui participa do que está sob prova. */
const TERMOS_DO_CONTRATO = {
  dataInicioLocacao: '2026-01-01',
  prazoMeses: 12,
  valorMensal: VALOR_DA_COBRANCA,
  diaVencimento: 10,
  indiceReajuste: 'IGPM',
  gerarCobrancasAutomaticamente: false,
  observacoes: null,
} as const;

// ---------------------------------------------------------------------------
// Estado do arquivo
// ---------------------------------------------------------------------------

let identidade: IdentidadeEfemera;
let acesso: AcessoAoBanco;
let instanciaDaFila: FilaEfemera;
let produtor: ProdutorDeFila;
let servico: EmpresaService;
let leitorDaFila: Fila;
let diretorioDosBoletos: string;

/** O registrador do serviço e dos consumidores — as linhas ficam observáveis em memória. */
let registrador: Logger;

/** As linhas que o registrador emitiu, na ordem — o journal do processo, como texto. */
const linhasDoJournal: string[] = [];

/** A chave que a composição raiz entrega à borda — 32 bytes sorteados por execução, nunca literal. */
const CHAVE_DE_CIFRA = randomBytes(32);

/** O contador que mantém documentos, códigos, títulos e identificadores distintos entre os cenários. */
let sequencia = 0;

/** A data que o provedor informa como a do pagamento — derivada do relógio do BANCO na subida. */
let DATA_DO_PAGAMENTO: string;

beforeAll(async () => {
  identidade = await identidadeEfemera();
  acesso = abrirAcessoAoBanco({
    cadeiaDeConexao: identidade.banco.cadeiaConexao,
    maximoDeConexoes: RESERVA_DE_CONEXOES,
  });
  instanciaDaFila = await redisEfemero();
  diretorioDosBoletos = mkdtempSync(join(tmpdir(), 'sysloc-boletos-t9-'));

  // `trace` é o nível mais baixo do vocabulário do projeto: nenhuma linha é filtrada, e a asserção
  // sobre a linha da retomada alcança o registro INTEIRO.
  registrador = criarLogger({
    nivel: 'trace',
    destino: {
      write(linha: string): void {
        linhasDoJournal.push(linha);
      },
    },
  });

  // ADR-0006 — a instância em uso não é a que atende a operação, e está dentro da faixa efêmera.
  expect(instanciaDaFila.porta).not.toBe(PORTA_PADRAO_DA_FILA);
  expect(instanciaDaFila.porta).toBeGreaterThanOrEqual(FAIXA_PORTAS_EFEMERAS.primeira);
  expect(instanciaDaFila.porta).toBeLessThanOrEqual(FAIXA_PORTAS_EFEMERAS.ultima);

  // O produtor REAL da borda, apontado à instância efêmera — é ele que o serviço do Master recebe,
  // e é por ele que o reenfileiramento da CA-10 sai. Nada de dublê aqui: o que se quer provar é que
  // a reativação põe trabalho na fila de verdade.
  produtor = conectarProdutorDeFila(instanciaDaFila.cadeiaConexao, registrador);

  // O serviço REAL do Master, com as mesmas cinco portas que o contêiner lhe entrega em produção.
  servico = new EmpresaService(
    acesso,
    identidade.acesso,
    identidade.autenticacao,
    registrador,
    produtor,
  );

  // Um lado produtor **sem consumidor**, usado apenas para LER o que está em espera na fila. Ele não
  // processa nada: quem processa é o consumidor que cada caso monta e encerra.
  leitorDaFila = conectarFila(instanciaDaFila.cadeiaConexao, registrador);
  await aguardarFilasProntas(leitorDaFila);

  DATA_DO_PAGAMENTO = await dataDeslocada(EMPRESA_A.id, -5);
}, LIMITE_SUBIDA_MS);

afterAll(async () => {
  // A devolução dos recursos vem PRIMEIRO e inteira; o desfecho é afirmado no fim. Afirmá-lo no
  // meio abortaria o descarte e deixaria de pé justamente o resíduo que este bloco existe para
  // levar embora.
  const desfechoDoLeitor = await leitorDaFila?.encerrar();
  await produtor?.encerrar();
  await acesso?.encerrar();
  await instanciaDaFila?.parar();
  await identidade?.parar();

  if (leitorDaFila !== undefined) {
    expect(desfechoDoLeitor).toBe('RECURSOS-DEVOLVIDOS');
  }
}, LIMITE_SUBIDA_MS);

// ===========================================================================
// CT-985 — a reativação aplica os retidos na ordem de chegada
// ===========================================================================

describe('CT-985 — a reativação retoma o que a suspensão reteve, na ordem de chegada', () => {
  it(
    'CT-985 — as três retidas são reenfileiradas por recebido_em crescente e todas aplicam',
    async () => {
      const adaptador = adaptadorQueLiquida();

      // --- Arranjo: três cobranças da empresa A, e a empresa suspensa pela via do Master ---------
      const cobrancas: CobrancaSemeada[] = [];
      for (let indice = 0; indice < RETIDAS_DO_CT985; indice += 1) {
        cobrancas.push(await semearCobranca(EMPRESA_A.id));
      }

      await suspender(EMPRESA_A.id);

      // --- As três notícias, retidas pelo caminho de produção ------------------------------------
      const retidas: RetidaDoArranjo[] = [];
      await comConsumidor(adaptador.porta, async (fila) => {
        for (const [posicao, cobranca] of cobrancas.entries()) {
          const notificacaoId = await gravarCru(
            avisoDe(cobranca.identificador, cobranca.numeroDoTitulo),
          );

          await executarPelaFila(fila, notificacaoId);
          // A idade é aplicada DEPOIS do tratamento: `marcarDesfecho` não toca `recebido_em`, e
          // movê-la antes faria a própria retenção correr sobre um instante já deslocado.
          await envelhecerCru(notificacaoId, IDADES_DAS_RETIDAS[posicao] ?? 0);
          retidas.push({ notificacaoId, cobranca });
        }
      });

      // O ponto de partida afirmado: as três estão retidas, e nenhuma consulta aconteceu.
      expect(await desfechosDe(retidas)).toEqual(['RETIDO', 'RETIDO', 'RETIDO']);
      expect(adaptador.consultas).toEqual([]);

      // A ordem esperada é derivada do `recebido_em` LIDO do banco, e não da lista de idades: é o
      // mesmo eixo que a consulta do produto ordena, e derivá-lo do arranjo faria a asserção
      // concordar com a intenção em vez de com o dado.
      const esperada = await porChegadaCrescente(retidas);
      // Âncora do arranjo: se a ordem cronológica coincidisse com a de criação, o caso deixaria de
      // discriminar um reenfileiramento por ordem de inserção.
      expect(esperada).not.toEqual(retidas.map((retida) => retida.notificacaoId));

      // --- O ato sob prova: a reativação, pelo serviço real do Master ----------------------------
      const emEsperaAntes = await notificacoesEmEspera();
      expect(emEsperaAntes).toEqual([]);

      expect(await servico.reativar(EMPRESA_A.id)).toEqual({ id: EMPRESA_A.id, estado: 'ATIVA' });

      // --- A ordem de ENFILEIRAMENTO, observada direto na fila real ------------------------------
      expect(await notificacoesEmEspera()).toEqual(esperada);

      // --- E o desfecho: as três aplicam, com o efeito na trilha ---------------------------------
      await comConsumidor(adaptador.porta, drenarFilaReal);

      expect(await desfechosDe(retidas)).toEqual(['APLICADO', 'APLICADO', 'APLICADO']);
      expect(adaptador.consultas).toHaveLength(RETIDAS_DO_CT985);

      for (const retida of retidas) {
        expect(await pagamentoDe(retida.cobranca)).toEqual({
          pagoEm: DATA_DO_PAGAMENTO,
          valorPago: VALOR_DA_COBRANCA.toFixed(2),
        });
        expect(
          (await lerTrilha(retida.cobranca)).map((evento) => ({
            tipo: evento.tipo,
            origem: evento.origem,
          })),
        ).toEqual([{ tipo: 'COBRANCA_LIQUIDADA', origem: 'NOTICIA_DO_PROVEDOR' }]);
      }
    },
    LIMITE_DO_CASO_MS,
  );

  it(
    'CT-985 (b) — a reativação sem nenhuma retida conclui, não enfileira nada e publica quantidade zero',
    async () => {
      // A empresa é suspensa e reativada sem que notícia alguma tenha chegado no intervalo: é o
      // caminho comum da rota, e o que ele não pode fazer é falhar nem enfileirar trabalho.
      await suspender(EMPRESA_B.id);

      expect(await notificacoesEmEspera()).toEqual([]);
      const linhasAntes = linhasDoJournal.length;

      expect(await servico.reativar(EMPRESA_B.id)).toEqual({ id: EMPRESA_B.id, estado: 'ATIVA' });

      // Zero tarefas novas: a varredura correu e não achou o que retomar.
      expect(await notificacoesEmEspera()).toEqual([]);

      // E o zero é PUBLICADO — é ele que separa "não havia o que retomar" de "ninguém procurou".
      const retomadas = eventosDoJournalDesde(linhasAntes).filter(
        (evento) => evento.mensagem === MENSAGEM_DA_RETOMADA,
      );
      expect(retomadas).toHaveLength(1);
      expect({
        nivel: retomadas[0]?.nivel,
        empresaId: retomadas[0]?.empresaId,
        quantidade: retomadas[0]?.quantidade,
      }).toEqual({
        nivel: NIVEL_DE_INFORMACAO,
        empresaId: EMPRESA_B.id,
        quantidade: 0,
      });
    },
    LIMITE_DO_CASO_MS,
  );

  it(
    'CT-985 (c) — a retida cuja liquidação já produziu efeito termina REENTREGA, sem efeito repetido',
    async () => {
      const adaptador = adaptadorQueLiquida();

      // A cobrança da retida é da empresa **suspensa**; a que produz o efeito é de uma empresa que
      // continua **ativa**. É o único arranjo em que a corrida acontece de fato: com a empresa
      // suspensa, qualquer notícia dela seria retida também — o passo B.5 corre **antes** do B.6, de
      // modo que uma notícia cuja liquidação já produziu efeito nunca chega a ficar retida.
      const daRetida = await semearCobranca(EMPRESA_A.id);
      const doEfeito = await semearCobranca(EMPRESA_B.id);
      // O MESMO identificador de liquidação nas duas notícias: é ele a chave da camada 1 da
      // idempotência, e ele é global à tabela crua — que não tem, e não pode ter, `empresa_id`
      // (ADR-0031). É essa globalidade que faz a segunda ser reconhecida como reentrega do efeito.
      const liquidacao = liquidacaoNova();

      // (1) A empresa A, suspensa, retém a notícia; a empresa B segue ativa.
      await suspender(EMPRESA_A.id);

      const retida = await comConsumidor(adaptador.porta, async (fila) => {
        const daEmpresaSuspensa = await gravarCru(
          avisoDe(daRetida.identificador, daRetida.numeroDoTitulo, liquidacao),
        );
        await executarPelaFila(fila, daEmpresaSuspensa);
        // A ordem importa: a retenção acontece ANTES de o efeito existir. Invertê-la faria o passo
        // B.5 responder primeiro, e a notícia sairia `REENTREGA` sem nunca ter sido retida — que é
        // outro caminho, e não o que este caso mede.
        expect((await lerCru(daEmpresaSuspensa)).desfecho).toBe('RETIDO');

        // (2) A MESMA liquidação produz efeito por outro caminho, na empresa que está ativa.
        const daEmpresaAtiva = await gravarCru(
          avisoDe(doEfeito.identificador, doEfeito.numeroDoTitulo, liquidacao),
        );
        await executarPelaFila(fila, daEmpresaAtiva);
        expect((await lerCru(daEmpresaAtiva)).desfecho).toBe('APLICADO');

        return daEmpresaSuspensa;
      });

      // Uma consulta só até aqui: a retida não foi à rede, e a que aplicou foi.
      expect(adaptador.consultas).toHaveLength(1);

      const retratoAntes = await retratoDaCobranca(daRetida);
      // CONTROLE ANTIVÁCUO da fotografia: a leitura devolve `undefined` quando não alcança a linha,
      // e sem esta afirmação a igualdade profunda lá embaixo compararia `undefined` com `undefined`
      // — passaria justamente no caso em que a leitura correu sob o contexto errado.
      expect(retratoAntes).toBeDefined();
      const trilhaAntes = await lerTrilha(daRetida);

      // (3) A retomada: a reativação devolve a retida à fila.
      expect(await servico.reativar(EMPRESA_A.id)).toEqual({ id: EMPRESA_A.id, estado: 'ATIVA' });
      expect(await notificacoesEmEspera()).toEqual([retida]);

      const consultasNaRetomada = adaptador.consultas.length;
      await comConsumidor(adaptador.porta, drenarFilaReal);

      // O desfecho é REENTREGA, e o contador da porta NÃO sobe: a camada 1 poupou a ida à rede.
      expect((await lerCru(retida)).desfecho).toBe('REENTREGA');
      expect(adaptador.consultas).toHaveLength(consultasNaRetomada);

      // E nenhum efeito repetido: a cobrança e a trilha da retida ficam idênticas.
      expect(await retratoDaCobranca(daRetida)).toEqual(retratoAntes);
      expect(await lerTrilha(daRetida)).toEqual(trilhaAntes);
    },
    LIMITE_DO_CASO_MS,
  );
});

// ===========================================================================
// CT-986 — reativar A não aplica retidos de B, ainda suspensa
// ===========================================================================

describe('CT-986 — a varredura é global, e quem isola é o re-roteamento', () => {
  it(
    'CT-986 — reativar A avança o retido de A e devolve o de B a RETIDO, sem tocar a cobrança dele',
    async () => {
      const adaptador = adaptadorQueLiquida();

      const deA = await semearCobranca(EMPRESA_A.id);
      const deB = await semearCobranca(EMPRESA_B.id);

      // --- As DUAS empresas suspensas, uma notícia retida em cada --------------------------------
      await suspender(EMPRESA_A.id);
      await suspender(EMPRESA_B.id);

      const { retidaDeA, retidaDeB } = await comConsumidor(adaptador.porta, async (fila) => {
        const primeira = await gravarCru(avisoDe(deA.identificador, deA.numeroDoTitulo));
        await executarPelaFila(fila, primeira);

        const segunda = await gravarCru(avisoDe(deB.identificador, deB.numeroDoTitulo));
        await executarPelaFila(fila, segunda);

        return { retidaDeA: primeira, retidaDeB: segunda };
      });

      expect([(await lerCru(retidaDeA)).desfecho, (await lerCru(retidaDeB)).desfecho]).toEqual([
        'RETIDO',
        'RETIDO',
      ]);
      const retratoDeBAntes = await retratoDaCobranca(deB);
      // Mesmo controle antivácuo do `CT-985 (c)`, e pela mesma razão: `undefined` comparado com
      // `undefined` afirmaria *"a cobrança de B não se moveu"* sem ter alcançado a cobrança de B.
      expect(retratoDeBAntes).toBeDefined();
      const trilhaDeBAntes = await lerTrilha(deB);

      // --- Reativa SÓ a empresa A ----------------------------------------------------------------
      expect(await servico.reativar(EMPRESA_A.id)).toEqual({ id: EMPRESA_A.id, estado: 'ATIVA' });

      // ⚠️ A varredura é GLOBAL, e isto é o desenho, não um defeito: a tabela crua não tem — e não
      // pode ter — `empresa_id` (ADR-0031), de modo que as DUAS voltam para a fila. O isolamento
      // acontece adiante, no re-roteamento, e é o resto deste caso que o prova.
      expect(await notificacoesEmEspera()).toEqual([retidaDeA, retidaDeB]);

      // ⚠️ A drenagem espera a fila ESVAZIAR, e não o desfecho de A mudar: parar no primeiro
      // desfecho deixaria a tarefa de B por processar, e a asserção *"o de B continua `RETIDO`"*
      // passaria por **vacuidade** — sobre uma notícia que ninguém tratou.
      await comConsumidor(adaptador.porta, drenarFilaReal);

      // --- O de A avançou; o de B continua retido, e a cobrança dele não se moveu ----------------
      expect((await lerCru(retidaDeA)).desfecho).toBe('APLICADO');
      expect(await pagamentoDe(deA)).toEqual({
        pagoEm: DATA_DO_PAGAMENTO,
        valorPago: VALOR_DA_COBRANCA.toFixed(2),
      });

      expect((await lerCru(retidaDeB)).desfecho).toBe('RETIDO');
      expect(await retratoDaCobranca(deB)).toEqual(retratoDeBAntes);
      expect(await lerTrilha(deB)).toEqual(trilhaDeBAntes);

      // Uma consulta só ao provedor — a de A. A de B morreu no passo B.6, antes da rede.
      expect(adaptador.consultas).toHaveLength(1);

      // --- E o fecho da CA-10: o de B só espera a vez dele ---------------------------------------
      //
      // Reativada a empresa B, a MESMA linha crua — retida duas vezes, e com `tratado_em` gravado
      // desde a primeira — chega ao efeito. É a prova de que a retenção repetida não consome a
      // notícia: **nada se perde** enquanto a suspensão durar.
      expect(await servico.reativar(EMPRESA_B.id)).toEqual({ id: EMPRESA_B.id, estado: 'ATIVA' });
      expect(await notificacoesEmEspera()).toEqual([retidaDeB]);

      await comConsumidor(adaptador.porta, drenarFilaReal);

      expect((await lerCru(retidaDeB)).desfecho).toBe('APLICADO');
      expect(await pagamentoDe(deB)).toEqual({
        pagoEm: DATA_DO_PAGAMENTO,
        valorPago: VALOR_DA_COBRANCA.toFixed(2),
      });
      expect(adaptador.consultas).toHaveLength(2);
    },
    LIMITE_DO_CASO_MS,
  );
});

// ---------------------------------------------------------------------------
// Acessórios — a porta de verificação, o arranjo e as leituras
// ---------------------------------------------------------------------------

/** O valor que o AVISO alega ter recebido — nunca gravado em coluna nenhuma (CA-04). */
const VALOR_ALEGADO_PELO_AVISO = 4321.99;

/** A porta instrumentada: conta as chamadas e guarda os argumentos que o SUT lhe entregou. */
interface PortaInstrumentada {
  readonly porta: AdaptadorCobrancaBancaria;
  /** Toda consulta que chegou, na ordem — argumentos, e não apenas "foi chamado". */
  readonly consultas: readonly ConsultaDeSituacao[];
}

/** Uma notícia retida pelo arranjo, com a cobrança a que ela aponta. */
interface RetidaDoArranjo {
  readonly notificacaoId: string;
  readonly cobranca: CobrancaSemeada;
}

/** Uma implementação da porta que responde o que o caso mandar, contando as chamadas. */
function adaptadorQueResponde(situacaoDe: () => SituacaoConsultada): PortaInstrumentada {
  const consultas: ConsultaDeSituacao[] = [];

  return {
    consultas,
    porta: {
      consultarSituacao: async (consulta) => {
        consultas.push(consulta);

        return { aceito: true, valor: situacaoDe() };
      },
      emitir: operacaoNaoEsperada('emitir'),
      solicitarRevogacaoDeBoleto: operacaoNaoEsperada('solicitarRevogacaoDeBoleto'),
      confirmarRevogacaoDeBoleto: operacaoNaoEsperada('confirmarRevogacaoDeBoleto'),
    },
  };
}

/** A porta que responde `LIQUIDADO` com os valores do arranjo — o caminho que aplica. */
function adaptadorQueLiquida(): PortaInstrumentada {
  return adaptadorQueResponde(() => ({
    situacao: 'LIQUIDADO',
    pagoEm: DATA_DO_PAGAMENTO,
    valorPago: VALOR_DA_COBRANCA,
    documento: null,
  }));
}

/** Uma operação da porta que **nenhum** caso deste arquivo exercita — chamá-la é defeito. */
function operacaoNaoEsperada(nome: string): () => never {
  return () => {
    throw new Error(`a suíte da retomada de retidas não esperava a operação ${nome}`);
  };
}

/**
 * Roda o trabalho com um consumidor ativo, e **encerra-o ao final**.
 *
 * O encerramento não é higiene: é o que permite ao caso seguinte observar a fila **em espera**. Com
 * o consumidor de pé, a tarefa reenfileirada some da espera antes de qualquer leitura, e a ordem de
 * enfileiramento deixaria de ser observável — restaria inferi-la da ordem de processamento, que é
 * propriedade da biblioteca de fila e não promessa do produto.
 *
 * A fiação é a **mesma** de `apps/worker/src/main.ts`: `conectarFila` mais
 * `processar(fila.notificacaoBancaria, …)`, com a borda recebendo as portas por parâmetro. **Nenhum
 * contexto de tenant é fixado por fora** — ele nasce lá dentro, do registro que o roteamento
 * resolver.
 */
async function comConsumidor<T>(
  adaptador: AdaptadorCobrancaBancaria,
  trabalho: (fila: Fila) => Promise<T>,
): Promise<T> {
  const fila = conectarFila(instanciaDaFila.cadeiaConexao, registrador);

  fila.processar(
    fila.notificacaoBancaria,
    async (tarefa, logger) =>
      await processarNotificacaoBancaria(tarefa, logger, {
        banco: acesso,
        adaptador,
        guarda: guardaDeProducao(),
        chaveDeCifra: CHAVE_DE_CIFRA,
      }),
  );

  // A BARREIRA DE PRONTIDÃO — ver a seção do cabeçalho sobre inicialização em voo. Ela vem antes do
  // trabalho, e não antes do fecho: esperar só no fim deixaria a janela aberta para o caso que
  // termina depressa, que é justamente o que o `drenarFilaReal` sobre uma fila já vazia faz.
  await aguardarFilasProntas(fila);

  let desfecho: DesfechoDoEncerramento | undefined;

  try {
    const resultado = await trabalho(fila);

    desfecho = await fila.encerrar();
    // O desfecho é AFIRMADO, e aqui — fora do `finally`. Dentro dele, uma devolução abandonada
    // substituiria a exceção do trabalho pelo erro desta linha, e o caso passaria a mentir sobre o
    // que falhou.
    expect(desfecho).toBe('RECURSOS-DEVOLVIDOS');

    return resultado;
  } finally {
    // Devolução INCONDICIONAL: o trabalho que lançou ainda precisa devolver a fiação, ou a instância
    // efêmera seria parada com consumidor e filas de pé. O `undefined` discrimina *"ainda não foi
    // encerrada"* de *"foi, e o desfecho já está afirmado"* — encerrar duas vezes devolveria o mesmo
    // encerramento, mas pedi-lo à toa esconderia a intenção.
    if (desfecho === undefined) {
      await fila.encerrar();
    }
  }
}

/**
 * Espera **todas** as filas de uma fiação ficarem prontas — a barreira contra inicialização em voo.
 *
 * A lista é **derivada** do objeto que `conectarFila` devolve, e não escrita à mão. A razão é a
 * mesma que `apps/worker/src/fila.ts` registra ao compor do próprio produtor — e não de literais —
 * o campo `filas` da linha de prazo estourado: uma fila nova não tem como ficar de fora daqui. Uma
 * lista literal envelheceria em silêncio, e o sintoma seria o defeito do cabeçalho voltando pela
 * única fila que ninguém lembrou de acrescentar.
 *
 * O consumidor **não** entra: a conexão dele não é compartilhada, e a biblioteca já suprime a
 * rejeição tardia do fecho dele. O que a biblioteca não cobre é a fila.
 */
async function aguardarFilasProntas(fila: Fila): Promise<void> {
  const filas = Object.values(fila).filter(
    (valor): valor is { waitUntilReady(): Promise<unknown> } =>
      typeof valor === 'object' &&
      valor !== null &&
      'waitUntilReady' in valor &&
      typeof (valor as { waitUntilReady: unknown }).waitUntilReady === 'function',
  );

  // CONTROLE ANTIVÁCUO: sem ele, uma fiação que deixasse de publicar as filas — por renomeação, por
  // encapsulamento — faria esta barreira esperar por **nada** e passar por vacuidade, devolvendo o
  // arquivo ao estado que o cabeçalho descreve sem que linha alguma acusasse.
  expect(filas.length).toBeGreaterThan(0);

  await Promise.all(
    filas.map(async (produtor) => {
      await produtor.waitUntilReady();
    }),
  );
}

/** A guarda de produção, apontada para o diretório efêmero deste arquivo. */
function guardaDeProducao(): GuardaDeBoletos {
  return criarGuardaDeBoletos(diretorioDosBoletos);
}

/**
 * Enfileira uma notícia e espera a tarefa alcançar estado terminal, por **sondagem**.
 *
 * `completed` e `failed` são os dois estados terminais; `delayed` e `waiting` **não** encerram a
 * espera. A conclusão é afirmada aqui porque quem chama usa esta função como **arranjo**, e um
 * arranjo que falhou em silêncio faria o caso medir o estado errado dizendo outra coisa.
 */
async function executarPelaFila(fila: Fila, notificacaoId: string): Promise<void> {
  const enfileirada = await fila.notificacaoBancaria.add(fila.notificacaoBancaria.name, {
    notificacaoId,
  });
  const id = enfileirada.id;

  if (typeof id !== 'string' || id.length === 0) {
    throw new Error('o servidor de fila não atribuiu identificador à tarefa enfileirada');
  }

  await sondarAte(
    `a tarefa ${id} alcançar estado terminal`,
    async () => {
      const estado = await (await fila.notificacaoBancaria.getJob(id))?.getState();

      return estado === 'completed' || estado === 'failed';
    },
    LIMITE_DE_DRENAGEM_MS,
  );

  expect(await (await fila.notificacaoBancaria.getJob(id))?.getState()).toBe('completed');
}

/**
 * Os identificadores das notícias **em espera** na fila, na ordem em que o servidor os devolve.
 *
 * É a observação direta da ordem de enfileiramento. `waiting`, `delayed` e `prioritized` são os três
 * estados em que uma tarefa recém-enfileirada pode estar antes de um consumidor a pegar; incluí-los
 * todos é o que impede o caso de passar por vacuidade caso a política de repetição mude o estado
 * inicial.
 */
async function notificacoesEmEspera(): Promise<string[]> {
  const tarefas = await leitorDaFila.notificacaoBancaria.getJobs(
    ['waiting', 'delayed', 'prioritized'],
    0,
    -1,
    true,
  );

  return tarefas.map((tarefa) => tarefa.data.notificacaoId);
}

/**
 * Espera a fila de notícias bancárias **esvaziar**, por sondagem com limite nomeado.
 *
 * ⚠️ **O critério é a fila vazia, e não o desfecho que o caso espera** — a diferença é o que separa
 * asserção de vacuidade. Parar quando a notícia sob observação muda de estado deixaria as demais por
 * processar, e toda afirmação sobre elas (*"continua `RETIDO`"*, *"a cobrança não se moveu"*) passaria
 * por não ter havido tratamento nenhum. Os quatro estados consultados são os não-terminais: uma
 * tarefa em qualquer um deles ainda vai correr.
 */
async function drenarFilaReal(fila: Fila): Promise<void> {
  await sondarAte(
    'a fila de notícias bancárias esvaziar',
    async () => {
      const contagens = await fila.notificacaoBancaria.getJobCounts(
        'waiting',
        'active',
        'delayed',
        'prioritized',
      );

      return Object.values(contagens).every((quantidade) => quantidade === 0);
    },
    LIMITE_DE_DRENAGEM_MS,
  );
}

/**
 * Suspende a empresa pela via legítima do Master, e afirma o desfecho.
 *
 * É `EmpresaService.suspender`, o mesmo caminho que a rota `POST /v1/master/empresas/:id/suspensao`
 * percorre — nunca um `UPDATE` em `identidade.empresa`.
 */
async function suspender(empresaId: string): Promise<void> {
  const suspensao = await servico.suspender(empresaId);

  expect({ id: suspensao.id, estado: suspensao.estado }).toEqual({
    id: empresaId,
    estado: 'SUSPENSA',
  });
}

/**
 * Executa o trabalho sob o contexto informado, dentro de uma unidade de trabalho.
 *
 * É o **único** caminho por onde o arranjo deste arquivo alcança `negocio`. Ele monta e lê estado;
 * **nunca** o contexto da tarefa, que nasce na borda a partir do registro roteado.
 */
async function emUnidade<T>(
  empresaId: string,
  trabalho: (tx: TransactionSql) => Promise<T>,
): Promise<T> {
  return await contextoDeTenant.executarCom(
    { empresaId },
    async () => await acesso.emUnidadeDeTrabalho(trabalho),
  );
}

/** Grava o cru pela porta de produção, **sem contexto de tenant** (ADR-0031). */
async function gravarCru(recebido: unknown): Promise<string> {
  return await acesso.emUnidadeDeTrabalho(
    async (tx) => await registrarNotificacaoBancaria(tx, { recebido }),
  );
}

/** Lê a linha crua pela porta de produção, sem contexto. */
async function lerCru(notificacaoId: string): Promise<NotificacaoBancariaPersistida> {
  const linha = await acesso.emUnidadeDeTrabalho(
    async (tx) => await lerNotificacaoBancaria(tx, notificacaoId),
  );

  if (linha === undefined) {
    throw new Error(`a notificação ${notificacaoId} não foi encontrada no banco`);
  }

  return linha;
}

/** Os desfechos das retidas, na ordem em que o arranjo as criou. */
async function desfechosDe(retidas: readonly RetidaDoArranjo[]): Promise<string[]> {
  const desfechos: string[] = [];

  for (const retida of retidas) {
    desfechos.push((await lerCru(retida.notificacaoId)).desfecho);
  }

  return desfechos;
}

/** Os identificadores das retidas ordenados por `recebido_em` **crescente**, lido do banco. */
async function porChegadaCrescente(retidas: readonly RetidaDoArranjo[]): Promise<string[]> {
  const chegadas: { readonly id: string; readonly recebidoEm: number }[] = [];

  for (const retida of retidas) {
    chegadas.push({
      id: retida.notificacaoId,
      recebidoEm: (await lerCru(retida.notificacaoId)).recebidoEm.getTime(),
    });
  }

  return chegadas
    .sort((uma, outra) => uma.recebidoEm - outra.recebidoEm)
    .map((chegada) => chegada.id);
}

/**
 * Recua o `recebido_em` da linha crua em `dias`, **pelo relógio do banco**.
 *
 * ⚠️ **Precondição privilegiada, e a forma é o que a torna legítima.** A linha nasce pela porta de
 * produção; o que este acessório faz é **mover o dado**, e o instante sai de `now()` do servidor —
 * nunca de `new Date()` do processo, que é o segundo eixo de relógio que a ADR-0026 fecha. É a mesma
 * forma, e a mesma razão, do `CT-988` de `apps/worker/test/notificacao-bancaria.spec.ts`.
 *
 * Sem contexto de tenant: a tabela vive em `plataforma` e não tem dono-empresa (ADR-0031).
 */
async function envelhecerCru(notificacaoId: string, dias: number): Promise<void> {
  await acesso.emUnidadeDeTrabalho(async (tx) => {
    const resultado = await tx`
      UPDATE plataforma.notificacao_bancaria
         SET recebido_em = now() - make_interval(days => ${dias}::integer)
       WHERE id = ${notificacaoId}::uuid
    `;

    if (resultado.count !== 1) {
      throw new Error(`o arranjo não alcançou a notificação ${notificacaoId} para envelhecê-la`);
    }
  });
}

/** A trilha publicada de uma cobrança, sob o contexto da empresa dela. */
async function lerTrilha(cobranca: CobrancaSemeada): Promise<readonly LinhaDeEventoBancario[]> {
  return await emUnidade(
    cobranca.empresaId,
    async (tx) => await lerTrilhaDaCobranca(tx, cobranca.codigo),
  );
}

/** Os dois campos do pagamento, crus — o que separa "pagou" de "não pagou". */
async function pagamentoDe(
  cobranca: CobrancaSemeada,
): Promise<{ pagoEm: string | null; valorPago: string | null }> {
  return await emUnidade(cobranca.empresaId, async (tx) => {
    const [linha] = await tx<{ pagoEm: string | null; valorPago: string | null }[]>`
      SELECT to_char(pago_em, 'YYYY-MM-DD') AS "pagoEm",
             valor_pago::text               AS "valorPago"
        FROM negocio.cobranca
       WHERE codigo = ${cobranca.codigo}
    `;

    if (linha === undefined) {
      throw new Error(`a cobrança ${cobranca.codigo} não foi alcançada sob o contexto dela`);
    }

    return { pagoEm: linha.pagoEm, valorPago: linha.valorPago };
  });
}

/**
 * A linha **inteira** da cobrança, como objeto — a fotografia que as igualdades profundas comparam.
 *
 * `to_jsonb` alcança **toda** coluna, inclusive as que ninguém pensou em nomear: é isso que separa
 * *"não mexeu nas colunas que eu lembrei"* de *"não mexeu"*. A chave é o `identificador_no_provedor`,
 * único no SaaS inteiro — o código da cobrança é único **por empresa** (ADR-0033), e uma leitura por
 * código encontraria a cobrança errada sob o contexto errado.
 */
async function retratoDaCobranca(
  cobranca: CobrancaSemeada,
): Promise<Record<string, unknown> | undefined> {
  return await emUnidade(cobranca.empresaId, async (tx) => {
    const [linha] = await tx<{ retrato: Record<string, unknown> }[]>`
      SELECT to_jsonb(c) AS retrato
        FROM negocio.cobranca c
       WHERE identificador_no_provedor = ${cobranca.identificador}
    `;

    return linha?.retrato;
  });
}

/**
 * A data corrente da operação deslocada em `dias`, como cadeia `YYYY-MM-DD`.
 *
 * **É assim que toda data deste arranjo é posicionada**: o relógio nunca é falseado, o dado é que se
 * move. A leitura sai do **mesmo** `negocio.data_corrente_da_operacao()` que a visão consulta — nunca
 * de `new Date()` do processo, que é o segundo eixo de dia que a ADR-0026 fecha.
 */
async function dataDeslocada(empresaId: string, dias: number): Promise<string> {
  return await emUnidade(empresaId, async (tx) => {
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

/** Os eventos que o registrador emitiu a partir de `inicio`, já interpretados como objeto. */
function eventosDoJournalDesde(inicio: number): Record<string, unknown>[] {
  return linhasDoJournal.slice(inicio).map((linha) => JSON.parse(linha) as Record<string, unknown>);
}

/** O corpo do aviso, no vocabulário do PROVEDOR — copiado do Caso A da §4.1.1 do tech spec. */
function avisoDe(
  identificador: string,
  numeroDoTitulo: string,
  identificadorDaLiquidacao: string = liquidacaoNova(),
): {
  readonly idWebhook: number;
  readonly tipoMovimento: number;
  readonly dados: Record<string, unknown>;
} {
  return {
    idWebhook: 990,
    tipoMovimento: 7,
    dados: {
      seuNumero: identificador,
      nossoNumero: numeroDoTitulo,
      numeroIdentificadorBaixa: identificadorDaLiquidacao,
      valorPagamento: VALOR_ALEGADO_PELO_AVISO,
      dataHoraSituacaoBaixa: '2026-08-18T14:03:11Z',
    },
  };
}

/** O contador que mantém todo identificador do arranjo distinto. */
function proximo(): number {
  sequencia += 1;

  return sequencia;
}

/** Um número de título do provedor, distinto a cada chamada. */
function numeroDeTitulo(): string {
  return String(1_000_000_000 + proximo());
}

/** Um identificador de liquidação novo — a chave do efeito único (RN-08). */
function liquidacaoNova(): string {
  return `16001${String(proximo()).padStart(14, '0')}`;
}

/** Uma cobrança semeada: o que os casos precisam saber dela. */
interface CobrancaSemeada {
  readonly empresaId: string;
  readonly codigo: string;
  readonly identificador: string;
  readonly numeroDoTitulo: string;
  readonly nomeDoArquivo: string;
}

/** Um cadastro de pessoa mínimo — a conferência de dígito verificador é do contrato, não da porta. */
let proximoDocumento = 90_000_000_000;

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

/** O usuário que registra o certificado de uma empresa — derivado da carga inicial. */
function exigirUsuarioDa(empresaId: string): UsuarioSemeado {
  const usuario = USUARIOS.find((candidato) => candidato.empresaId === empresaId);

  if (usuario === undefined) {
    throw new Error(`a carga inicial não tem usuário da empresa ${empresaId}`);
  }

  return usuario;
}

/**
 * Semeia uma cobrança **com boleto vivo** na empresa informada, e garante o certificado vigente dela.
 *
 * Tudo pelas portas de produção: os cadastros, o contrato, a cobrança e o boleto — inclusive os bytes
 * do documento, gravados pela mesma guarda que a borda usa. É `gravarBoletoDaCobranca` que põe o
 * `identificador_no_provedor` vivo, e é ele a chave pela qual o roteamento da tarefa encontra a
 * cobrança.
 */
// DÉBITO COM GATILHO — D21 · F4/T9 · registrado 2026-08-19
// (NÃO é uma `DECISÃO FECHADA`: ele agenda uma mudança, não protege o código abaixo.)
// O QUÊ: esta é a TERCEIRA cópia do arranjo "cobrança com boleto vivo + certificado vigente" — as
//        outras duas vivem em `apps/worker/test/notificacao-bancaria.spec.ts` e em
//        `apps/api/test/notificacao-bancaria.e2e.spec.ts`. O limiar de três do `CLAUDE.md` disparou.
// QUANDO FECHA: a PRIMEIRA task autorizada a abrir as duas suítes irmãs por outra razão — ali o
//        arranjo sobe para casa compartilhada em `packages/db/test/`, que é o único diretório que
//        `apps/api/test/` e `apps/worker/test/` já alcançam os dois.
// POR QUE NÃO AGORA: subir o arranjo exigiria reescrever duas suítes de fronteira real que não
//        estão na lista desta task, com ~180 casos verdes dependendo delas.
// ⚠️ EMENDADO em 2026-08-23 pela T11 da fatia `automacoes-agendadas` (texto original preservado
//        acima, byte a byte). O que muda é o DESTINO prescrito no `QUANDO FECHA`, e só ele: a
//        medição da T6 daquela fatia **refutou** `packages/db/test/` como casa do arranjo. A razão é
//        de resolução de módulo, e não de gosto: os acessórios de `packages/db/test/` alcançam
//        `contextoDeTenant` pelo **fonte** (`unidade-sob-contexto.ts` → `../src/contexto.ts`),
//        enquanto `apps/*/test/` o alcançam pela fronteira publicada de `@sysloc/db`, que o
//        `package.json` manda para `./dist/index.js` — são **dois `AsyncLocalStorage` distintos**, e
//        toda escrita do arranjo cai em violação de política de linha. O arranjo que este débito
//        endereça é necessariamente **sob contexto**, logo o destino viável é um pacote de teste que
//        consuma `@sysloc/db` **pelo barril**. ⚠️ `packages/shared/test/` **não serve**:
//        `@sysloc/shared` não pode depender de `@sysloc/db` sem inverter o grafo. O gatilho — *a
//        primeira task autorizada a abrir as duas suítes irmãs* — **não muda**.
// ÍNDICE: docs/specs/features/webhook-e-carne/v1/_run/run-report.md §2, D21
async function semearCobranca(empresaId: string): Promise<CobrancaSemeada> {
  await garantirCertificadoVigente(empresaId);

  const marca = `t9-ret-${String(proximo())}`;

  const cadastros = await emUnidade(empresaId, async (tx) => {
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
      statusLocacao: 'DISPONIVEL',
      observacoes: null,
    });
    const locador = await criarPessoa(tx, 'locador', pessoaDe(`Locador ${marca}`));
    const locatario = await criarPessoa(tx, 'locatario', pessoaDe(`Locatário ${marca}`));

    return { imovelId: imovel.id, locadorId: locador.id, locatarioId: locatario.id };
  });

  const anoDoContrato = await emUnidade(empresaId, lerAnoDaSerieDeContrato);
  await emUnidade(empresaId, async (tx) => {
    await garantirContadorDeContrato(tx, anoDoContrato);
  });
  const contrato = await emUnidade(empresaId, async (tx) => {
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

  const anoDaCobranca = await emUnidade(empresaId, lerAnoDaSerieDeCobranca);
  await emUnidade(empresaId, async (tx) => {
    await garantirContadorDeCobranca(tx, anoDaCobranca);
  });

  // O vencimento fica à frente do dia corrente para que a mora seja zero — sem isso o `valorTotal`
  // derivado divergiria do valor informado e todo caso de liquidação ganharia um evento a mais.
  const vencimento = await dataDeslocada(empresaId, DIAS_ATE_O_VENCIMENTO);
  const cobranca = await emUnidade(empresaId, async (tx) => {
    const numero = await emitirNumeroDeCobranca(tx, anoDaCobranca);

    return await criarCobranca(
      tx,
      {
        contratoId: contrato.id,
        natureza: 'ALUGUEL',
        referencia: `Aluguel ${marca}`,
        competencia: `${vencimento.slice(0, 7)}-01`,
        dataVencimento: vencimento,
        valorOriginal: VALOR_DA_COBRANCA,
      },
      { ano: anoDaCobranca, numero },
    );
  });

  const identificador = `2026${String(proximo()).padStart(14, '0')}`;
  const numeroDoTitulo = numeroDeTitulo();
  const nomeDoArquivo = await guardaDeProducao().gravar(
    cobranca.codigo,
    Buffer.from(`${PREFIXO_DO_DOCUMENTO}${marca}`),
  );

  await emUnidade(empresaId, async (tx) => {
    await gravarBoletoDaCobranca(tx, cobranca.codigo, {
      numeroDoTituloNoProvedor: numeroDoTitulo,
      linhaDigitavel: `L-${marca}`,
      codigoDeBarras: `B-${marca}`,
      identificadorNoProvedor: identificador,
      caminhoDoArquivo: nomeDoArquivo,
    });
  });

  return { empresaId, codigo: cobranca.codigo, identificador, numeroDoTitulo, nomeDoArquivo };
}

/** As empresas cujo certificado o arranjo já registrou — o registro é único por empresa vigente. */
const COM_CERTIFICADO = new Set<string>();

/**
 * Grava um certificado **vigente** da empresa, com o envelope cifrado pela mesma chave da composição.
 *
 * O material é opaco para o banco (ADR-0032) e nada neste arquivo o abre. O que importa é que a borda
 * **o resolve pelo banco** e o decifra com a chave que recebeu — sem que nada de segredo tenha
 * atravessado a fila. O conjunto acima existe porque o índice único
 * `certificado_do_provedor_vigente_uidx` admite **um** vigente por empresa: registrar o segundo
 * abortaria a unidade.
 */
async function garantirCertificadoVigente(empresaId: string): Promise<void> {
  if (COM_CERTIFICADO.has(empresaId)) {
    return;
  }

  const envelopeCifrado = cifrarSegredo(
    criarSegredoOperavel({
      material: Buffer.concat([Buffer.from(`material-${randomUUID()}-`), randomBytes(64)]),
      senha: `senha-${randomUUID()}`,
    }),
    CHAVE_DE_CIFRA,
  );

  const validade = await emUnidade(empresaId, async (tx) => {
    const [linha] = await tx<{ de: Date; ate: Date }[]>`
      SELECT (negocio.data_corrente_da_operacao() - INTERVAL '1 day')::timestamptz AS de,
             (negocio.data_corrente_da_operacao() + INTERVAL '365 days')::timestamptz AS ate
    `;

    if (linha === undefined) {
      throw new Error('o relógio do banco não devolveu a validade do certificado do arranjo');
    }

    return linha;
  });

  await emUnidade(empresaId, async (tx) => {
    await registrarCertificado(tx, {
      titular: `Empresa ${empresaId.slice(0, 8)}`,
      validoDe: validade.de,
      validoAte: validade.ate,
      impressaoDigital: randomUUID(),
      segredoCifrado: envelopeCifrado,
      registradoPor: exigirUsuarioDa(empresaId).id,
    });

    // A identidade da empresa perante o provedor é pré-condição do MESMO tipo que o certificado
    // (`D36 · F4/T10`, fechado em 2026-08-20): sem ela os atos recusam com `422` antes de falar com
    // o provedor. Ela nasce junto, para que o arranjo siga produzindo uma empresa que opera.
    await registrarIdentidadeNoProvedor(tx, {
      identificadorDaAplicacaoCifrado: cifrarValorOperavel(
        'identificador-do-arranjo',
        CHAVE_DE_CIFRA,
      ),
      numeroDoCliente: 33065,
      numeroDaContaCorrente: 380261,
      codigoDaModalidade: 1,
      registradoPor: exigirUsuarioDa(empresaId).id,
    });
  });

  COM_CERTIFICADO.add(empresaId);
}
