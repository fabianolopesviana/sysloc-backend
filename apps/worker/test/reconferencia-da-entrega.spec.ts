/**
 * A **borda da tarefa de reconferência da entrega da notícia** — o job entra pela fila real, o
 * contexto nasce da carga, e a releitura de UMA empresa corre. T8 da fatia
 * `integracao-bancaria-autonoma`.
 *
 * ===========================================================================
 * INVARIANTES
 * ===========================================================================
 *
 * | Critério | Caso    | Invariante |
 * |----------|---------|------------|
 * | CA-15    | CT-1040 | Com o provedor respondendo positivo sobre uma entrega guardada como
 * |          |         | DESABILITADA, a reconferência **atualiza** a linha: `habilitada` passa a
 * |          |         | verdadeira, o motivo some das três colunas, `verificadaPor` fica **nula**
 * |          |         | (não há usuário à frente), o instante **avança**, e a contagem de linhas
 * |          |         | de TODOS os vasos alcançáveis permanece a mesma — é atualização, nunca
 * |          |         | inserção. |
 * | CA-15    | CT-1040 | Com o provedor **sem responder**, a tarefa termina em **falha declarada**
 * |          | (b)     | nomeando o fato, e a linha lida depois é **IGUAL por igualdade profunda**
 * |          |         | à lida antes — o objeto inteiro, **inclusive o instante**. Nenhuma
 * |          |         | escrita parcial, nenhuma linha nova. |
 * | CA-15    | CT-1040 | Carga sem `empresaId`, carga com `empresaId` que não é UUID e carga com
 * |          | (c)     | campo extra terminam em FALHA com o nome do campo recusado **dentro do
 * |          |         | trecho `(recusado: …)`** — o único que a apuração dos campos produz, e não
 * |          |         | a exigência publicada — e **nenhuma** das três razões ecoa o VALOR
 * |          |         | recebido. A linha permanece idêntica campo a campo nas três. |
 * | CA-17    | CT-1041 | **Cinco** reconsultas que confirmam o desfecho já guardado deixam a linha
 * |          |         | **idêntica por `toEqual`, inclusive o instante de atualização**, e o mapa
 * |          |         | de contagens de todos os vasos igual por igualdade de objeto. **CONTROLE
 * |          |         | ANTIVÁCUO no mesmo caso**: a SEXTA execução, com desfecho diferente, faz
 * |          |         | a linha MUDAR contra o esperado — provando que as cinco igualdades
 * |          |         | anteriores podiam ter falhado. |
 *
 * Rastreabilidade: `CA-15 → CT-1040 (RN-15)` · `CA-17 → CT-1041 (RN-15)`.
 *
 * ===========================================================================
 * DUAS divergências declaradas em relação ao card da T8 (`autonomia-do-run.md`, A1)
 * ===========================================================================
 *
 * **(1) A porta do provedor é satisfeita por uma implementação DESTE arquivo, e não pelo par TLS
 * mútuo.** O card prescreve *"par TLS mútuo do provedor em porta dinâmica"*, e o acessório que o
 * monta (`apps/api/test/par-do-provedor.ts`) vive no **outro aplicativo**: importá-lo daqui seria a
 * primeira travessia `apps/<app>/test` → `apps/<app>/test` desta base, num diretório que hoje só atravessa
 * para `packages/<pacote>/test` (e ainda assim sob o `D28`). A convenção viva deste diretório é a oposta e
 * está no `CT-948` de `./conferencia-bancaria.spec.ts`: a **porta** é a fronteira (ADR-0025), e a
 * suíte entrega outra implementação dela pelo mesmo parâmetro da composição raiz.
 *
 * ⚠️ **E nada se perde do que este arquivo mede**: o desfecho *"o provedor não respondeu"* é, no
 * adaptador real, exatamente `{ aceito: false, motivo: null }` — `executarEntrega` o produz para
 * indisponibilidade, tempo esgotado e endereço ausente, e a porta **resolve sempre, nunca rejeita**
 * (`packages/cobranca-bancaria/src/porta-de-entrega-da-noticia.ts`). O que a suíte substitui é o
 * destino da resposta, e não a decisão que está sob prova, que é inteiramente da borda da tarefa.
 *
 * **(2) O "vaso de efeito incrementado em 1" do controle antivácuo NÃO existe — e a ausência é
 * decisão registrada.** O `D7` da fatia rejeitou a tabela de tentativas por escrito
 * (`packages/db/src/entrega-da-noticia.ts`: *"Não há histórico, e a ausência é a decisão"*), e a
 * trilha bancária é ancorada em **cobrança**, que a habilitação não toca. Exigir o incremento seria
 * inventar um vaso que a fatia decidiu não ter. O controle antivácuo do `CT-1041` é, portanto, a
 * **sexta execução mudando a linha** contra um esperado escrito à mão; e o mapa é afirmado com
 * valores **não nulos** (`entrega: 1`, `certificado: 1`, `identidade: 1`), de modo que uma medição
 * que não enxergasse linha alguma reprovaria em vez de passar comparando zero com zero.
 */

import { randomBytes, randomUUID } from 'node:crypto';
import type {
  EntregaParaCadastrar,
  LeituraDaEntrega,
  PortaDeEntregaDaNoticia,
} from '@sysloc/cobranca-bancaria';
import {
  type AcessoAoBanco,
  abrirAcessoAoBanco,
  contextoDeTenant,
  EMPRESA_A,
  type EstadoDaEntregaGravado,
  gravarDesfechoDaEntrega,
  lerEstadoDaEntrega,
  type MotivoDaRecusaDoProvedor,
  registrarCertificado,
  registrarIdentidadeNoProvedor,
  type SituacaoDaEntrega,
  USUARIOS,
  type UsuarioSemeado,
} from '@sysloc/db';
import {
  type CargaDaReconferenciaDaEntrega,
  cifrarSegredo,
  cifrarValorOperavel,
  criarLogger,
  criarSegredoOperavel,
  FILA_DA_RECONFERENCIA_DA_ENTREGA,
  type Logger,
} from '@sysloc/shared';
import type { TransactionSql } from 'postgres';
import { afterAll, beforeAll, describe, expect, it, onTestFinished } from 'vitest';
// DÉBITO COM GATILHO — D28 · F0/T5 · gatilho JÁ DISPARADO (F1/T2, 2026-08-02)
// (NÃO é uma `DECISÃO FECHADA`: ele agenda uma mudança, não protege o código abaixo.)
// O QUÊ: os imports a seguir atravessam a fronteira de `@sysloc/db` e de `@sysloc/shared` por
//        CAMINHO DE ARQUIVO, fora do `exports` daqueles manifestos.
// QUANDO FECHA: declarar o subpath `"./test"` nos manifestos e importar por `@sysloc/<pacote>/test`,
//        ou extrair um `@sysloc/test-utils`.
// POR QUE NÃO AGORA: fechar exige editar os manifestos de vários pacotes e todos os consumidores,
//        nenhum deles no escopo desta task.
// ÍNDICE: docs/specs/features/fundacao-stack-nativa/v1/_run/run-report.md §2, D28
import { type BancoMigrado, bancoEfemero } from '../../../packages/db/test/banco-efemero.ts';
import { FAIXA_PORTAS_EFEMERAS, sondarAte } from '../../../packages/shared/test/efemero-comum.ts';
import { type FilaEfemera, redisEfemero } from '../../../packages/shared/test/redis-efemero.ts';
import { conectarFila, type Fila, type TarefaDaReconferenciaDaEntrega } from '../src/fila.ts';
import { processarReconferenciaDaEntrega } from '../src/tarefas/reconferencia-da-entrega.ts';

// ---------------------------------------------------------------------------
// Limites de tempo — constantes nomeadas, nunca número mágico no meio do caso
// ---------------------------------------------------------------------------

/** Subir banco e fila efêmeros, provisionar e migrar leva dezenas de segundos aqui. */
const LIMITE_SUBIDA_MS = 180_000;

/** Cada caso semeia a empresa e executa a tarefa pela fila real, às vezes seis vezes. */
const LIMITE_DO_CASO_MS = 180_000;

/** Limite para a tarefa alcançar estado terminal, folgado sobre a repetição da fila. */
const LIMITE_ESTADO_TERMINAL_MS = 90_000;

/** Reserva de conexões: o arranjo e o consumidor tocam o banco ao mesmo tempo enquanto o job corre. */
const RESERVA_DE_CONEXOES = 4;

/** Porta padrão do servidor de fila, usada pelo ambiente legado desta máquina (ADR-0006). */
const PORTA_PADRAO_DA_FILA = 6379;

// ---------------------------------------------------------------------------
// O arranjo — os vereditos declarados ANTES da execução
// ---------------------------------------------------------------------------

/** Quantas reconsultas que nada mudam o `CT-1041` executa antes do controle antivácuo. */
const RECONSULTAS_SEM_MUDANCA = 5;

/** Tentativas de uma tarefa que os cenários de falha reduzem — nas opções do ENFILEIRAMENTO. */
const UMA_TENTATIVA = 1;

/** O nome do campo que a razão da falha tem de nomear (ADR-0024). Cadeia EXATA. */
const CAMPO_DA_EMPRESA = 'empresaId';

/** A chave excedente do terceiro cenário — a que o `strictObject` tem de nomear na recusa. */
const CHAVE_EXCEDENTE = 'segredo';

/** O valor da chave excedente — sentinela: nenhuma razão de falha pode contê-lo. */
const VALOR_DA_CHAVE_EXCEDENTE = 'segredo-que-nao-pode-vazar';

/** O `empresaId` que não é UUID — sentinela do segundo cenário, pela mesma razão. */
const EMPRESA_QUE_NAO_E_UUID = 'nao-e-uuid-empresa-sentinela';

/** Trecho EXATO da razão com que a borda falha quando o provedor não responde. */
const RAZAO_SEM_RESPOSTA = 'não obteve resposta do provedor';

/**
 * Abertura EXATA do trecho em que `cargaConferida` publica o que a apuração recusou.
 *
 * ⚠️ **Escrita à mão de propósito, e NUNCA importada de `../src/tarefas/carga-da-tarefa.ts`.** Só o
 * que a apuração dos campos produz aparece depois deste delimitador: o nome do campo *solto* já vive
 * na `EXIGENCIA_DA_CARGA` da borda (*"exige o campo 'empresaId'…"*), de modo que afirmá-lo sobre a
 * razão inteira é condição implicada pelo arranjo — passa mesmo com a apuração devolvendo cadeia
 * vazia. Importar o molde do próprio módulo sob prova traria o defeito de volta por outro caminho:
 * a asserção passaria a concordar consigo mesma.
 */
const PREFIXO_DOS_RECUSADOS = '(recusado: ';

/** O fecho do mesmo trecho — com ele, o campo nomeado tem de ser o ÚNICO recusado. */
const FECHO_DOS_RECUSADOS = ')';

/** O motivo que o provedor devolve nos cenários de recusa respondida — verbatim, dele. */
const MOTIVO_DA_RECUSA: MotivoDaRecusaDoProvedor = {
  codigo: 'RECUSA-DO-PAR-8821',
  mensagem: 'a vaga de entrega desta conta está ocupada por outro destino',
  diagnostico: { campoDoProvedor: 'url', ocorrencia: 4 },
};

/** O motivo **diferente** que o controle antivácuo do `CT-1041` faz o provedor devolver na sexta. */
/**
 * A referência opaca ao cadastro, escrita por extenso — o que a leitura da inativação carrega.
 *
 * O valor é arbitrário de propósito: nada no produto o interpreta, e o caso não o compara com nada
 * além dele mesmo.
 */
const REFERENCIA_DO_CADASTRO = '990';

const MOTIVO_DO_CONTROLE: MotivoDaRecusaDoProvedor = {
  codigo: 'RECUSA-DO-PAR-9047',
  mensagem: 'a conta deixou de ter cadastro de entrega neste provedor',
  diagnostico: null,
};

/** Bytes sorteados que o material do certificado do arranjo carrega além do prefixo legível. */
const BYTES_DO_MATERIAL = 64;

// ---------------------------------------------------------------------------
// Estado do arquivo
// ---------------------------------------------------------------------------

let banco: BancoMigrado;
let acesso: AcessoAoBanco;
let instanciaDaFila: FilaEfemera;

/** O registrador que todos os consumidores deste arquivo recebem. */
let registrador: Logger;

/** A chave que a composição raiz entrega à borda — 32 bytes sorteados por execução, nunca literal. */
const CHAVE_DE_CIFRA = randomBytes(32);

beforeAll(async () => {
  banco = await bancoEfemero();
  acesso = abrirAcessoAoBanco({
    cadeiaDeConexao: banco.cadeiaConexao,
    maximoDeConexoes: RESERVA_DE_CONEXOES,
  });
  instanciaDaFila = await redisEfemero();
  registrador = criarLogger({ nivel: 'fatal' });

  // ADR-0006 — a instância em uso não é a que atende a operação, e está dentro da faixa efêmera.
  expect(instanciaDaFila.porta).not.toBe(PORTA_PADRAO_DA_FILA);
  expect(instanciaDaFila.porta).toBeGreaterThanOrEqual(FAIXA_PORTAS_EFEMERAS.primeira);
  expect(instanciaDaFila.porta).toBeLessThanOrEqual(FAIXA_PORTAS_EFEMERAS.ultima);

  // As pré-condições do ato externo nascem UMA vez, pelas portas de produção: certificado vigente e
  // identidade da empresa perante o provedor. Sem elas a borda não chega a perguntar nada, e todo
  // caso deste arquivo mediria o ramo errado.
  await semearPreCondicoes(EMPRESA_A.id);
}, LIMITE_SUBIDA_MS);

afterAll(async () => {
  await acesso?.encerrar();
  await banco?.parar();
  await instanciaDaFila?.parar();
}, LIMITE_SUBIDA_MS);

// ===========================================================================
// CT-1040 — a reconferência ATUALIZA, e a falha não deixa escrita parcial
// ===========================================================================

describe('CT-1040 — a reconferência atualiza a linha, e a falha a deixa idêntica', () => {
  it(
    'CT-1040 — o desfecho positivo substitui a recusa guardada, sem criar linha em vaso algum',
    async () => {
      // O estado de partida é uma recusa GUARDADA: é ele que faz o desfecho positivo ser uma
      // mudança, e é dele que sai o `verificadaPor` não nulo que a gravação da tarefa tem de zerar.
      await gravarEstado({ situacao: 'DESABILITADA', motivo: MOTIVO_DA_RECUSA });
      const antes = await lerEstado();
      const vasosAntes = await contarVasos();

      const par = parQueResponde({ tipo: 'ATIVA' });
      const fila = montarConsumidor(par.porta);

      const tarefa = await executarJob(fila, { empresaId: EMPRESA_A.id });

      expect(await tarefa.getState()).toBe('completed');

      // A empresa que a borda apresentou ao provedor é a da CARGA — e só ela.
      expect(par.consultas.map((consulta) => consulta.empresaId)).toEqual([EMPRESA_A.id]);

      const depois = await lerEstado();

      // O objeto INTEIRO, campo a campo: `id` preservado (é atualização, nunca inserção), motivo
      // apagado das três colunas, e `verificadaPor` NULO — não há usuário à frente da reconferência.
      expect({ ...depois, verificadaEm: null }).toEqual({
        id: antes.id,
        habilitada: true,
        // A `0025` acrescenta os dois campos, e a igualdade do objeto INTEIRO cresce com eles — é
        // ela que faz um campo novo aparecer aqui em vez de passar despercebido.
        situacao: 'HABILITADA',
        referenciaNoProvedor: null,
        verificadaEm: null,
        motivo: null,
        verificadaPor: null,
      });

      // E o instante AVANÇOU — a asserção que separa "gravou" de "não fez nada".
      expect(instanteDe(depois)).toBeGreaterThan(instanteDe(antes));

      // Nenhuma linha nova em vaso algum: o que mudou foi a linha que já existia.
      expect(await contarVasos()).toEqual(vasosAntes);
    },
    LIMITE_DO_CASO_MS,
  );

  it(
    'CT-1040 (b) — com o provedor sem responder, a tarefa FALHA e a linha permanece idêntica',
    async () => {
      await gravarEstado({ situacao: 'DESABILITADA', motivo: MOTIVO_DA_RECUSA });
      const antes = await lerEstado();
      const vasosAntes = await contarVasos();

      // O desfecho literal do adaptador real quando o provedor não chega a responder — ver a
      // divergência (1) no cabeçalho. Desde a `0025` ele é NOMEADO, e não mais um booleano ambíguo:
      // é essa distinção que separa *"não respondeu"* de *"respondeu e não há cadastro nosso"*.
      const par = parQueResponde({ tipo: 'NAO_RESPONDEU', motivo: null });
      const fila = montarConsumidor(par.porta);

      const tarefa = await executarJob(fila, { empresaId: EMPRESA_A.id }, UMA_TENTATIVA);

      // A recusa SOBE: a tarefa termina em falha declarada, e não `completed` com nada feito.
      expect(await tarefa.getState()).toBe('failed');
      expect(tarefa.failedReason).toBeTypeOf('string');
      expect(tarefa.failedReason).toContain(RAZAO_SEM_RESPOSTA);

      // A pergunta CHEGOU a ser feita — sem esta linha, a igualdade abaixo passaria também para uma
      // borda que nem tentasse consultar.
      expect(par.consultas.map((consulta) => consulta.empresaId)).toEqual([EMPRESA_A.id]);

      // O OBJETO INTEIRO, inclusive o instante: é esta comparação que discrimina a escrita parcial.
      // Uma implementação que gravasse `habilitada` e só depois falhasse ao gravar o motivo passaria
      // numa comparação de campos escolhidos e reprova aqui.
      expect(await lerEstado()).toEqual(antes);
      expect(await contarVasos()).toEqual(vasosAntes);
    },
    LIMITE_DO_CASO_MS,
  );

  it(
    'CT-1040 (c) — as três cargas inválidas FALHAM nomeando o campo, e nada é gravado',
    async () => {
      await gravarEstado({ situacao: 'HABILITADA', motivo: null });
      const antes = await lerEstado();
      const vasosAntes = await contarVasos();

      const par = parQueResponde({ tipo: 'ATIVA' });
      const fila = montarConsumidor(par.porta);

      // A terceira é a chave excedente: `strictObject` RECUSA o que veio a mais — e o nome escolhido
      // é `segredo` de propósito, porque é exatamente o campo que alguém acrescentaria "para o
      // processo de trabalho não precisar consultar o banco" (ADR-0032).
      const cenarios = [
        { rotulo: 'sem empresaId', carga: {}, nomeado: CAMPO_DA_EMPRESA },
        {
          rotulo: 'empresaId que não é UUID',
          carga: { empresaId: EMPRESA_QUE_NAO_E_UUID },
          nomeado: CAMPO_DA_EMPRESA,
        },
        {
          rotulo: 'campo extra além do único',
          carga: { empresaId: EMPRESA_A.id, [CHAVE_EXCEDENTE]: VALOR_DA_CHAVE_EXCEDENTE },
          nomeado: CHAVE_EXCEDENTE,
        },
      ];

      const falhadas: TarefaDaReconferenciaDaEntrega[] = [];
      for (const { carga } of cenarios) {
        falhadas.push(
          await executarJob(fila, carga as unknown as CargaDaReconferenciaDaEntrega, UMA_TENTATIVA),
        );
      }

      for (const [indice, { rotulo, nomeado }] of cenarios.entries()) {
        const tarefa = falhadas[indice];
        expect(tarefa, rotulo).toBeDefined();
        expect(await tarefa?.getState(), rotulo).toBe('failed');
        expect(tarefa?.failedReason, rotulo).toBeTypeOf('string');
        // O trecho DELIMITADO, nunca o nome solto: o nome solto já está na exigência publicada, e
        // afirmá-lo sobre a razão inteira passaria mesmo com a apuração dos campos quebrada.
        expect(tarefa?.failedReason, rotulo).toContain(
          `${PREFIXO_DOS_RECUSADOS}${nomeado}${FECHO_DOS_RECUSADOS}`,
        );
        // E NUNCA o valor: a razão fica gravada no servidor de fila e alcança o journal.
        expect(tarefa?.failedReason, rotulo).not.toContain(VALOR_DA_CHAVE_EXCEDENTE);
        expect(tarefa?.failedReason, rotulo).not.toContain(EMPRESA_QUE_NAO_E_UUID);
      }

      // Nada foi perguntado ao provedor — a recusa aconteceu ANTES de abrir contexto e de ler.
      expect(par.consultas).toEqual([]);
      // E a linha permanece idêntica, inclusive o instante, nas três.
      expect(await lerEstado()).toEqual(antes);
      expect(await contarVasos()).toEqual(vasosAntes);
    },
    LIMITE_DO_CASO_MS,
  );
});

// ===========================================================================
// CT-1041 — cinco reconsultas idênticas, e o controle antivácuo da sexta
// ===========================================================================

describe('CT-1056 — a reconferência fecha o ciclo assíncrono, e NÃO executa ato corretivo', () => {
  it(
    'CT-1056 — a promoção EM VALIDAÇÃO ⟹ HABILITADA acontece quando o provedor conclui a validação',
    async () => {
      // ⚠️ **É este caso que torna o desfecho *em validação* uma etapa, e não um beco.** A rota de
      // ativação devolve *em validação* porque o provedor valida o endereço DEPOIS de aceitar o
      // cadastro — assíncrono por construção. Sem alguém promovendo, o Admin ficaria olhando para
      // um estado que nunca muda, e o ternário viraria um jeito elaborado de dizer "falhou".
      await gravarEstado({ situacao: 'EM_VALIDACAO', motivo: null });
      const antes = await lerEstado();

      expect(antes?.situacao).toBe('EM_VALIDACAO');
      expect(antes?.habilitada).toBe(false);

      // O provedor concluiu a validação: o cadastro agora está validado e não inativado.
      const par = parQueResponde({ tipo: 'ATIVA' });
      const fila = montarConsumidor(par.porta);

      expect(await (await executarJob(fila, { empresaId: EMPRESA_A.id })).getState()).toBe(
        'completed',
      );

      const depois = await lerEstado();

      // A ASSERÇÃO QUE DISCRIMINA: a situação mudou, e o booleano do contrato acompanhou. Uma
      // reconferência que só observasse sem promover deixaria os dois como estavam.
      expect(depois?.situacao).toBe('HABILITADA');
      expect(depois?.habilitada).toBe(true);
      expect(depois?.motivo).toBeNull();

      // E o instante AVANÇOU — é o que separa "promoveu" de "não fez nada".
      expect(instanteDe(depois)).toBeGreaterThan(instanteDe(antes));

      // Âncora antivácuo: a pergunta foi de fato feita ao provedor.
      expect(par.consultas.map((consulta) => consulta.empresaId)).toEqual([EMPRESA_A.id]);
    },
    LIMITE_DO_CASO_MS,
  );

  // ⚠️ **A reconferência OBSERVA, e não configura.** Cadastrar, corrigir endereço e reativar são
  // atos que mudam a conta do cliente junto ao provedor, e quem os dispara é o Admin pela rota de
  // ativação — que é o gesto em que ele pede exatamente isso. Uma tarefa de fundo que os executasse
  // sozinha agiria na conta de terceiro periodicamente e sem ninguém ter pedido.
  //
  // O dublê da porta **levanta** nas três operações de escrita, de modo que executar qualquer uma
  // delas faria a tarefa falhar em vez de passar despercebida.
  //
  // ⚠️ **UM CASO POR LEITURA, e não um laço dentro de um caso.** As três já foram um `for`, e o
  // arranjo era instável: `montarConsumidor` encerra a fila em `onTestFinished`, que dispara ao fim
  // do CASO — de modo que as iterações acumulavam três consumidores vivos disputando a mesma fila, e
  // o trabalho de uma iteração era servido pelo consumidor da anterior. A âncora antivácuo lia `0` e
  // reprovava (medido: 2 falhas em 3 execuções). Ver o invariante em {@link montarConsumidor}.
  it.each([
    { tipo: 'SEM_CADASTRO' },
    { tipo: 'ENDERECO_DIVERGENTE', referencia: REFERENCIA_DO_CADASTRO },
    { tipo: 'DE_TERCEIRO' },
  ] as const)(
    'CT-1056 (b) — a leitura $tipo deixa a linha intacta, e nenhum ato é executado',
    async (leitura) => {
      await gravarEstado({ situacao: 'HABILITADA', motivo: null });
      const antes = await lerEstado();

      const par = parQueResponde(leitura);
      const fila = montarConsumidor(par.porta);

      expect(await (await executarJob(fila, { empresaId: EMPRESA_A.id })).getState()).toBe(
        'completed',
      );

      const depois = await lerEstado();

      // A linha INTEIRA idêntica, inclusive o instante: nada foi gravado. Comparar só a situação
      // aprovaria uma gravação que reescrevesse a linha com o mesmo valor e avançasse o carimbo.
      expect(depois).toEqual(antes);

      // Âncora antivácuo: a consulta correu. Sem ela, a igualdade acima seria satisfeita por uma
      // tarefa que nem chegou a perguntar.
      expect(par.consultas.length).toBe(1);
    },
    LIMITE_DO_CASO_MS,
  );
});

describe('CT-1041 — reconsulta que nada muda não escreve, e a sexta prova que ela podia', () => {
  it(
    'CT-1041 — cinco reconsultas deixam a linha idêntica, inclusive o instante; a sexta a muda',
    async () => {
      // O estado de partida é o HABILITADO, e as cinco primeiras respostas do par o confirmam.
      await gravarEstado({ situacao: 'HABILITADA', motivo: null });
      const antes = await lerEstado();
      const vasosAntes = await contarVasos();

      // O mapa é afirmado com valores NÃO NULOS antes de qualquer execução: é isso que impede as
      // igualdades seguintes de passarem comparando zero com zero — ver a divergência (2).
      expect(vasosAntes).toEqual({ entrega: 1, evento: 0, certificado: 1, identidade: 1 });

      const par = parQueResponde({ tipo: 'ATIVA' });
      const fila = montarConsumidor(par.porta);

      for (let vez = 0; vez < RECONSULTAS_SEM_MUDANCA; vez += 1) {
        const tarefa = await executarJob(fila, { empresaId: EMPRESA_A.id });
        expect(await tarefa.getState(), `reconsulta ${String(vez + 1)}`).toBe('completed');
      }

      // As cinco CORRERAM de verdade: cinco perguntas ao provedor, todas sob a empresa da carga.
      // Sem esta linha, uma borda que não fizesse nada satisfaria as igualdades abaixo.
      expect(par.consultas.map((consulta) => consulta.empresaId)).toEqual(
        Array.from({ length: RECONSULTAS_SEM_MUDANCA }, () => EMPRESA_A.id),
      );

      // A linha INTEIRA, inclusive o instante de atualização e quem verificou.
      expect(await lerEstado()).toEqual(antes);
      // E o mapa INTEIRO numa asserção só, para que a falha NOMEIE qual vaso cresceu.
      expect(await contarVasos()).toEqual(vasosAntes);

      // ------------------------------------------------------------------
      // CONTROLE ANTIVÁCUO — a sexta execução, com desfecho DIFERENTE
      // ------------------------------------------------------------------
      // ⚠️ O CONTROLE ANTIVÁCUO é a INATIVAÇÃO, e a escolha é conteúdo: ela é o desfecho que o `D1`
      // existia para tornar visível — o provedor derrubou a entrega —, e é a única leitura pela qual
      // a reconferência DESABILITA. Ela carrega a causa verbatim do provedor, que é o que a `CHECK`
      // de coerência exige e o que o Admin precisa ler.
      par.responder({
        tipo: 'INATIVA',
        referencia: REFERENCIA_DO_CADASTRO,
        motivo: MOTIVO_DO_CONTROLE,
      });

      const sexta = await executarJob(fila, { empresaId: EMPRESA_A.id });
      expect(await sexta.getState()).toBe('completed');

      const depois = await lerEstado();

      // A linha MUDOU, contra o esperado escrito à mão — e é isto que prova que as cinco igualdades
      // acima podiam ter falhado, em vez de passarem por vacuidade.
      expect({ ...depois, verificadaEm: null }).toEqual({
        id: antes.id,
        habilitada: false,
        // ⚠️ A situação é `DESABILITADA` **com a causa do provedor**, e é isso que o `D1` instalou:
        // antes desta correção, um cadastro inativado era lido como *"existe registro"* e o produto
        // gravava **habilitada** — afirmava saúde no exato cenário em que a entrega estava morta.
        situacao: 'DESABILITADA',
        // E a referência é retida, porque é ela que autoriza a reativação quando o Admin agir.
        referenciaNoProvedor: REFERENCIA_DO_CADASTRO,
        verificadaEm: null,
        motivo: MOTIVO_DO_CONTROLE,
        verificadaPor: null,
      });
      expect(instanteDe(depois)).toBeGreaterThan(instanteDe(antes));

      // E mesmo com a mudança, nenhuma linha nova nasce: o vaso é a própria linha (D7).
      expect(await contarVasos()).toEqual(vasosAntes);
    },
    LIMITE_DO_CASO_MS,
  );
});

// ===========================================================================
// Acessórios do arquivo
// ===========================================================================

/** A porta de entrega deste arquivo, com o registro do que foi perguntado. */
interface ParDeEntrega {
  readonly porta: PortaDeEntregaDaNoticia;
  /** Cada consulta que chegou à porta — a grandeza que prova *"a pergunta foi feita"*. */
  readonly consultas: EntregaParaCadastrar[];
  /** Troca o que a porta responde da próxima consulta em diante. */
  responder(resposta: LeituraDaEntrega): void;
}

/**
 * Uma implementação de {@link PortaDeEntregaDaNoticia} com resposta **programável**.
 *
 * `cadastrarEntrega` levanta de propósito: a reconferência **não cadastra**, e uma implementação que
 * a chamasse pediria a vaga ao provedor sem que ninguém tivesse decidido isso. Levantar é o que faz
 * essa chamada aparecer como falha em vez de passar despercebida.
 */
function parQueResponde(inicial: LeituraDaEntrega): ParDeEntrega {
  const consultas: EntregaParaCadastrar[] = [];
  let resposta = inicial;

  return {
    consultas,
    responder(nova: LeituraDaEntrega): void {
      resposta = nova;
    },
    porta: {
      // ⚠️ **As TRÊS operações de escrita levantam**, e a razão é o eixo desta suíte: a reconferência
      // **observa, e não configura**. Cadastrar, corrigir endereço e reativar são atos que o Admin
      // dispara pela rota de ativação; uma tarefa de fundo que os executasse mudaria a conta do
      // cliente sem ninguém ter pedido, e periodicamente. Se algum dia uma delas for chamada daqui,
      // é aqui que se descobre.
      cadastrarEntrega: async () => {
        throw new Error('a reconferência chamou `cadastrarEntrega`, que ela não deve chamar');
      },
      atualizarEnderecoDaEntrega: async () => {
        throw new Error(
          'a reconferência chamou `atualizarEnderecoDaEntrega`, que ela não deve chamar',
        );
      },
      reativarEntrega: async () => {
        throw new Error('a reconferência chamou `reativarEntrega`, que ela não deve chamar');
      },
      consultarEntrega: async (entrega) => {
        consultas.push(entrega);

        return resposta;
      },
    },
  };
}

/**
 * Conecta a fila real e registra o consumidor da reconferência com a porta informada.
 *
 * É a **mesma** fiação de `apps/worker/src/main.ts`: `conectarFila` mais
 * `processar(fila.reconferenciaDaEntrega, …)`, com a borda recebendo o acesso ao banco, a porta de
 * entrega e a chave de cifra por parâmetro.
 *
 * ⚠️ **UM CONSUMIDOR POR CASO — não chame esta função em laço.** O encerramento é registrado em
 * `onTestFinished`, que dispara ao fim do CASO e não ao fim de uma iteração: chamá-la duas vezes no
 * mesmo `it` deixa dois consumidores **vivos e concorrentes** na mesma fila, e o trabalho enfileirado
 * por um arranjo passa a ser servido pelo consumidor do arranjo anterior. O sintoma é uma âncora
 * antivácuo que lê `0` consultas de forma intermitente — foi o que instabilizou o `CT-1056 (b)`, que
 * por isso é `it.each` e não um `for`. Precisa de vários arranjos? **Um caso para cada.**
 */
function montarConsumidor(entrega: PortaDeEntregaDaNoticia): Fila {
  const fila = conectarFila(instanciaDaFila.cadeiaConexao, registrador);
  onTestFinished(async () => {
    await fila.encerrar();
  });

  fila.processar(
    fila.reconferenciaDaEntrega,
    async (tarefa, registradorDaTarefa) =>
      await processarReconferenciaDaEntrega(tarefa, registradorDaTarefa, {
        banco: acesso,
        entrega,
        chaveDeCifra: CHAVE_DE_CIFRA,
      }),
  );

  return fila;
}

/**
 * Enfileira a tarefa e espera o estado terminal — **pela fila real**, como a produção faz.
 *
 * A espera é sondagem com limite nomeado, nunca pausa fixa.
 */
async function executarJob(
  fila: Fila,
  carga: CargaDaReconferenciaDaEntrega,
  tentativas?: number,
): Promise<TarefaDaReconferenciaDaEntrega> {
  const enfileirada = await fila.reconferenciaDaEntrega.add(
    FILA_DA_RECONFERENCIA_DA_ENTREGA,
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
      const estado = await (await fila.reconferenciaDaEntrega.getJob(id))?.getState();

      return estado === 'completed' || estado === 'failed';
    },
    LIMITE_ESTADO_TERMINAL_MS,
  );

  const terminada = await fila.reconferenciaDaEntrega.getJob(id);
  if (terminada === undefined) {
    throw new Error(`a tarefa ${id} desapareceu da fila antes da leitura do estado final`);
  }

  return terminada;
}

/**
 * Executa o trabalho sob o contexto de `EMPRESA_A`, dentro de uma unidade de trabalho.
 *
 * É o **único** caminho por onde o arranjo deste arquivo alcança o banco. Ele monta o estado;
 * **nunca** o contexto do job, que nasce na borda a partir da carga.
 */
async function emUnidade<T>(trabalho: (tx: TransactionSql) => Promise<T>): Promise<T> {
  return await contextoDeTenant.executarCom(
    { empresaId: EMPRESA_A.id },
    async () => await acesso.emUnidadeDeTrabalho(trabalho),
  );
}

/** Grava o estado de partida do caso — pela **porta de produção**, com usuário à frente. */
async function gravarEstado(desfecho: {
  situacao: SituacaoDaEntrega;
  motivo: MotivoDaRecusaDoProvedor | null;
}): Promise<void> {
  await emUnidade(async (tx) => {
    await gravarDesfechoDaEntrega(tx, {
      situacao: desfecho.situacao,
      motivo: desfecho.motivo,
      referenciaNoProvedor: null,
      // Um usuário REAL à frente: é o valor que a gravação da tarefa tem de zerar, e sem ele a
      // asserção sobre `verificadaPor` compararia nulo com nulo.
      verificadaPor: exigirUsuarioDa(EMPRESA_A.id).id,
    });
  });
}

/** O estado guardado da empresa, pela porta de produção. Reprova quando não há linha. */
async function lerEstado(): Promise<EstadoDaEntregaGravado> {
  const gravado = await emUnidade(async (tx) => await lerEstadoDaEntrega(tx));

  if (gravado === undefined) {
    throw new Error('o arranjo não encontrou a linha do estado da entrega da empresa');
  }

  return gravado;
}

/** O instante da verificação em milissegundos. Reprova quando a coluna está nula. */
function instanteDe(estado: EstadoDaEntregaGravado): number {
  if (estado.verificadaEm === null) {
    throw new Error('a linha do estado da entrega não tem instante de verificação');
  }

  return estado.verificadaEm.getTime();
}

/** O mapa de contagens dos vasos alcançáveis pelo contexto — ver a divergência (2) no cabeçalho. */
interface MapaDeVasos {
  readonly entrega: number;
  readonly evento: number;
  readonly certificado: number;
  readonly identidade: number;
}

/**
 * Conta as linhas de **todos** os vasos que o contexto alcança nesta área.
 *
 * Sem `WHERE empresa_id` em consulta alguma — quem recorta é a política do banco (ADR-0008). O mapa
 * é comparado **inteiro**, numa asserção só, para que a falha nomeie qual vaso cresceu.
 */
async function contarVasos(): Promise<MapaDeVasos> {
  return await emUnidade(async (tx) => ({
    entrega: await contar(tx, 'entrega_da_noticia'),
    evento: await contar(tx, 'evento_bancario'),
    certificado: await contar(tx, 'certificado_do_provedor'),
    identidade: await contar(tx, 'identidade_no_provedor'),
  }));
}

/** Quantas linhas o contexto corrente alcança na tabela do domínio. */
async function contar(tx: TransactionSql, tabela: string): Promise<number> {
  const [linha] = await tx<{ total: string }[]>`
    SELECT count(*)::text AS total FROM negocio.${tx(tabela)}
  `;

  return Number(linha?.total ?? '-1');
}

/** O usuário da empresa — derivado da carga inicial. */
function exigirUsuarioDa(empresaId: string): UsuarioSemeado {
  const usuario = USUARIOS.find((candidato) => candidato.empresaId === empresaId);

  if (usuario === undefined) {
    throw new Error(`a carga inicial não tem usuário da empresa ${empresaId}`);
  }

  return usuario;
}

/**
 * Semeia as **duas** pré-condições do ato externo, pelas portas de produção.
 *
 * O certificado nasce vigente com a validade derivada do relógio do **banco** (ADR-0026), e a
 * identidade perante o provedor nasce na mesma unidade: sem ela a borda interrompe antes de
 * perguntar, e todo caso deste arquivo mediria o ramo errado.
 */
async function semearPreCondicoes(empresaId: string): Promise<void> {
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

  const validade = await emUnidade(async (tx) => {
    const [linha] = await tx<{ de: Date; ate: Date }[]>`
      SELECT (negocio.data_corrente_da_operacao() - INTERVAL '1 day')::timestamptz AS de,
             (negocio.data_corrente_da_operacao() + INTERVAL '365 days')::timestamptz AS ate
    `;

    if (linha === undefined) {
      throw new Error('o relógio do banco não devolveu a validade do certificado do arranjo');
    }

    return linha;
  });

  await emUnidade(async (tx) => {
    await registrarCertificado(tx, {
      titular: `Empresa ${empresaId.slice(0, 8)}`,
      validoDe: validade.de,
      validoAte: validade.ate,
      impressaoDigital: randomUUID(),
      segredoCifrado: envelopeCifrado,
      registradoPor: exigirUsuarioDa(empresaId).id,
    });

    await registrarIdentidadeNoProvedor(tx, {
      identificadorDaAplicacaoCifrado: cifrarValorOperavel(
        `identificador-${empresaId.slice(0, 8)}`,
        CHAVE_DE_CIFRA,
      ),
      numeroDoCliente: 33065,
      numeroDaContaCorrente: 380261,
      codigoDaModalidade: 1,
      registradoPor: exigirUsuarioDa(empresaId).id,
    });
  });
}
