/**
 * A **borda da entrega da confirmação de endereço** — a tarefa entra pela fila real, o contexto
 * nasce da carga, e a mensagem sai pela porta. T10 da fatia `documentos-e-confirmacao`.
 *
 * ===========================================================================
 * INVARIANTES
 * ===========================================================================
 *
 * | Critério | Caso | Invariante |
 * |----------|------|------------|
 * | CA-09 | CT-734 | Com a carga completa — os três campos, produzidos pelo caminho real de
 * |       |        | cadastro e de emissão de portador —, a tarefa CONCLUI e o capturador recebe
 * |       |        | **uma** entrega, para o endereço do locatário, com o link montado sobre a base
 * |       |        | recebida e o segredo aparecendo **exatamente uma vez** no corpo. |
 * | CA-09 | CT-734 | Com a carga incompleta (`{ empresaId }` apenas), a tarefa FALHA **antes de
 * |       |        | qualquer leitura**: a contagem de unidades de trabalho abertas permanece
 * |       |        | EXATAMENTE a de antes da chamada, a razão nomeia `locatarioId` e `segredo`
 * |       |        | **pelo nome**, e não contém o conteúdo de campo nenhum — nem o `empresaId`
 * |       |        | recebido, nem o segredo válido, nem o endereço. Nada sai pela porta e a
 * |       |        | contagem crua de `negocio.portador_de_confirmacao` não se move. |
 *
 * Rastreabilidade: `CA-09 → CT-734 (RN-07)`.
 *
 * ===========================================================================
 * O CAMINHO É O DA OPERAÇÃO — nada aqui chama a borda diretamente
 * ===========================================================================
 *
 * A tarefa é **enfileirada pela fila real** e consumida pelo consumidor que
 * `conectarFila().processar(fila.confirmacao, …)` registra — a mesma fiação que
 * `apps/worker/src/main.ts` monta em operação, com a única diferença sendo qual implementação da
 * `PortaDeEnvioDeEmail` a composição injeta. É o molde de `./regua.spec.ts`, e a razão é a mesma:
 * chamar a borda direto provaria a função; o que se quer provar é o **caminho**, que é ele que
 * carrega a decisão da ADR-0024.
 *
 * ⚠️ **O contexto de tenant NÃO é fixado por fora.** O arranjo semeia sob o contexto da empresa que
 * ele monta, e para a tarefa entrega apenas a **carga**; quem abre o contexto do trabalho é a borda,
 * uma vez, pelo mesmo `contextoDeTenant.executarCom` da guarda HTTP.
 *
 * ===========================================================================
 * O segredo vem da PORTA que o emite — nunca do banco, nunca fabricado
 * ===========================================================================
 *
 * O claro não existe no banco: a coluna dele não existe, e `emitirPortador` grava apenas o derivado.
 * O caminho legítimo para tê-lo é o mesmo da produção — chamar a porta de emissão e ficar com o valor
 * que ela devolve ao chamador. **Nada é inserido direto na tabela e nenhum derivado é fabricado.**
 *
 * ===========================================================================
 * O acesso ao banco é OBSERVADO, e o observador não é mock
 * ===========================================================================
 *
 * `bancoQueContaUnidades` é implementação de `AcessoAoBanco` que **delega tudo** ao acesso real e
 * apenas conta as aberturas de unidade de trabalho — mesmo desenho de `portaQueRecusaNaFaixa` em
 * `./regua.spec.ts`. Ele não substitui a lógica sob prova nem planta resposta alguma: o que ele
 * torna observável é a **fronteira**, e é ela que a asserção *"lança antes de qualquer leitura"*
 * precisa. Uma asserção só sobre a contagem de linhas provaria que nada foi **gravado**, e é
 * silenciosa sobre a consulta ter sido disparada.
 *
 * ===========================================================================
 * A porta de saída, e por que ela NÃO é mock (ADR-0006)
 * ===========================================================================
 *
 * `criarCapturadorDeEmail` é **implementação** da porta que o domínio declarou, com a mesma
 * assinatura pela qual a produção é exercitada; o que ela substitui é o **destino da mensagem**,
 * nunca a lógica sob prova. Este arquivo não tem caminho para construir o adaptador de produção, e
 * isso é auditado de fora pelo `CT-626`. Banco e fila são instâncias efêmeras **próprias**, e
 * nenhuma coordenada é lida do ambiente.
 */

import {
  type AcessoAoBanco,
  abrirAcessoAoBanco,
  admitirEmpresa,
  contextoDeTenant,
  criarPessoa,
  type DadosDaPessoa,
  EMPRESA_A,
  emitirPortador,
} from '@sysloc/db';
import { type CapturadorDeEmail, criarCapturadorDeEmail } from '@sysloc/regua';
import { type CargaDaConfirmacao, criarLogger, FILA_DA_CONFIRMACAO } from '@sysloc/shared';
import type { TransactionSql } from 'postgres';
import { afterAll, beforeAll, describe, expect, it, onTestFinished } from 'vitest';
import { type BancoMigrado, bancoEfemero } from '../../../packages/db/test/banco-efemero.ts';
import { FAIXA_PORTAS_EFEMERAS, sondarAte } from '../../../packages/shared/test/efemero-comum.ts';
import { type FilaEfemera, redisEfemero } from '../../../packages/shared/test/redis-efemero.ts';
import { conectarFila, type Fila, type TarefaDaConfirmacao } from '../src/fila.ts';
import { processarConfirmacaoDeEmail } from '../src/tarefas/confirmacao-de-email.ts';

// ---------------------------------------------------------------------------
// Limites de tempo — constantes nomeadas, nunca número mágico no meio do caso
// ---------------------------------------------------------------------------

/** Subir banco e fila efêmeros, provisionar e migrar leva dezenas de segundos aqui. */
const LIMITE_SUBIDA_MS = 150_000;

/** O caso monta cadastros e portador em unidades sequenciais, e espera duas tarefas terminarem. */
const LIMITE_DO_CASO_MS = 300_000;

/** Limite para a tarefa alcançar estado terminal, folgado sobre a repetição da fila. */
const LIMITE_ESTADO_TERMINAL_MS = 90_000;

/** Reserva de conexões: o arranjo e o consumidor tocam o banco ao mesmo tempo. */
const RESERVA_DE_CONEXOES = 4;

/** Porta padrão do servidor de fila, usada pelo ambiente legado desta máquina (ADR-0006). */
const PORTA_PADRAO_DA_FILA = 6379;

// ---------------------------------------------------------------------------
// O arranjo — os vereditos declarados ANTES da execução
// ---------------------------------------------------------------------------

/** A base do link, entregue à borda por parâmetro — como a composição raiz faz em operação. */
const URL_BASE_DA_CONFIRMACAO = 'https://app.exemplo.invalid';

/** O caminho da página que recebe o link, redigitado de propósito — ver o docblock do caso. */
const CAMINHO_DA_PAGINA = '/confirmar-email';

/** Os nomes dos campos que a razão da falha tem de nomear (ADR-0024). Cadeias EXATAS. */
const CAMPO_DO_LOCATARIO = 'locatarioId';
const CAMPO_DO_SEGREDO = 'segredo';

/** Tentativas de uma tarefa que o caso reduz — nas opções do ENFILEIRAMENTO, nunca em `fila.ts`. */
const UMA_TENTATIVA = 1;

/** O contexto da empresa da carga inicial — usado só para admitir as empresas dos cenários. */
const CONTEXTO_DE_A = { empresaId: EMPRESA_A.id } as const;

let banco: BancoMigrado;
let acesso: AcessoAoBanco;
let instanciaDaFila: FilaEfemera;

beforeAll(async () => {
  banco = await bancoEfemero();
  acesso = abrirAcessoAoBanco({
    cadeiaDeConexao: banco.cadeiaConexao,
    maximoDeConexoes: RESERVA_DE_CONEXOES,
  });

  instanciaDaFila = await redisEfemero();

  // ADR-0006 — a instância em uso não é a que atende a operação, e está dentro da faixa efêmera de
  // T4. A conferência mais completa (contra a porta que `provisionar-base.sh` declara) mora em
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
// CT-734 — a carga é conferida ANTES de abrir contexto e de qualquer leitura
// ===========================================================================

describe('CT-734 — a carga é conferida antes do contexto, e a recusa nomeia o campo', () => {
  it(
    'CT-734 — a carga completa entrega; a incompleta FALHA antes de qualquer leitura',
    async () => {
      const contexto = await admitirEmpresaNova('confirmacao');
      const locatario = await semearLocatario(contexto, 'confirmacao');
      const segredo = await emitirPortadorDe(contexto, locatario.id);

      const capturador = criarCapturadorDeEmail();
      const observado = bancoQueContaUnidades(acesso);
      const fila = montarConsumidor(capturador, observado);

      const portadoresAntes = await contarPortadores(contexto);
      expect(portadoresAntes).toBe(1);

      // --- O caminho feliz, e ele é o controle positivo do ramo negativo -----------------------
      const entregue = await executarTarefa(fila, {
        empresaId: contexto.empresaId,
        locatarioId: locatario.id,
        segredo,
      });

      expect(await entregue.getState()).toBe('completed');

      // UMA entrega, para o endereço do cadastro — lido sob a política, e não informado na carga.
      expect(capturador.capturas.map((captura) => captura.destinatario)).toEqual([locatario.email]);

      const mensagem = capturador.capturas[0]?.mensagem;
      if (mensagem === undefined) {
        throw new Error('o capturador não reteve mensagem alguma no caminho feliz');
      }

      // O link montado sobre a base que a composição raiz entregou — a LINHA inteira, por
      // igualdade, e o segredo ocorrendo exatamente uma vez no corpo.
      expect(mensagem.corpo.split('\n')).toContain(
        `${URL_BASE_DA_CONFIRMACAO}${CAMINHO_DA_PAGINA}#${segredo}`,
      );
      expect(mensagem.corpo.split(segredo)).toHaveLength(2);
      // E o assunto não carrega o segredo nem o endereço: ele é publicado na lista da caixa.
      expect(mensagem.assunto).not.toContain(segredo);
      expect(mensagem.assunto).not.toContain(locatario.email);

      // A leitura ACONTECEU — sem esta âncora, a igualdade do ramo negativo seria satisfeita por
      // uma borda que nunca abre unidade alguma, inclusive no caminho feliz.
      const unidadesAposEntrega = observado.unidades();
      expect(unidadesAposEntrega).toBeGreaterThan(0);

      // --- O ramo negativo: a carga incompleta ------------------------------------------------
      const recusada = await executarTarefa(
        fila,
        { empresaId: contexto.empresaId } as unknown as CargaDaConfirmacao,
        UMA_TENTATIVA,
      );

      expect(await recusada.getState()).toBe('failed');

      const razao = recusada.failedReason;
      expect(razao).toBeTypeOf('string');
      // A razão NOMEIA os campos que faltaram — mensagem genérica não diz a quem opera o que houve.
      expect(razao).toContain(CAMPO_DO_LOCATARIO);
      expect(razao).toContain(CAMPO_DO_SEGREDO);
      // E não ecoa o CONTEÚDO de campo nenhum: um deles é o segredo em claro, e a razão fica
      // gravada no servidor de fila e alcança o journal.
      expect(razao).not.toContain(contexto.empresaId);
      expect(razao).not.toContain(segredo);
      expect(razao).not.toContain(locatario.email);

      // NENHUMA unidade de trabalho foi aberta pela chamada recusada — contagem EXATA, e não
      // "quase igual". É esta igualdade que distingue *"recusou"* de *"recusou antes de ler"*.
      expect(observado.unidades()).toBe(unidadesAposEntrega);

      // Nada saiu pela porta, e nada foi gravado: a entrega continua sendo a única, e o portador
      // do arranjo permanece intacto.
      expect(capturador.capturas).toHaveLength(1);
      expect(await contarPortadores(contexto)).toBe(portadoresAntes);
    },
    LIMITE_DO_CASO_MS,
  );
});

// ---------------------------------------------------------------------------
// Acessórios — a fiação da operação, o arranjo e as leituras cruas
// ---------------------------------------------------------------------------

interface Contexto {
  readonly empresaId: string;
}

/** O locatário semeado: o identificador que a carga leva e os dois campos que a mensagem usa. */
interface LocatarioSemeado {
  readonly id: string;
  readonly nome: string;
  readonly email: string;
}

/** O acesso ao banco com a contagem de unidades abertas exposta. */
interface AcessoObservado extends AcessoAoBanco {
  /** Quantas unidades de trabalho foram abertas por este acesso desde a criação. */
  unidades(): number;
}

/**
 * Envolve o acesso real contando as aberturas de unidade — e **delegando tudo**.
 *
 * Ele não planta resposta nem intercepta consulta: o `trabalho` corre contra o banco real, com o
 * contexto que a borda estabeleceu. `encerrar` também delega, de propósito: se a borda algum dia
 * encerrar a reserva que ela apenas recebeu, o caso seguinte quebra — que é o desejável.
 */
function bancoQueContaUnidades(real: AcessoAoBanco): AcessoObservado {
  let aberturas = 0;

  return {
    unidades: () => aberturas,

    async emUnidadeDeTrabalho<T>(trabalho: (tx: TransactionSql) => Promise<T>): Promise<T> {
      aberturas += 1;

      return await real.emUnidadeDeTrabalho(trabalho);
    },

    async encerrar(): Promise<void> {
      await real.encerrar();
    },
  };
}

/**
 * Conecta a fila real e registra o consumidor da confirmação com as portas informadas.
 *
 * É a **mesma** fiação de `apps/worker/src/main.ts`: `conectarFila` mais
 * `processar(fila.confirmacao, …)`, com a borda recebendo o acesso ao banco, a porta de e-mail e a
 * base do link por parâmetro. A única diferença é qual implementação da porta a composição injeta.
 */
function montarConsumidor(email: CapturadorDeEmail, bancoDaBorda: AcessoAoBanco): Fila {
  const logger = criarLogger({
    nivel: 'info',
    destino: {
      write(): void {
        // O registro é descartado: este arquivo assere o EFEITO da entrega (o que saiu, o que foi
        // lido e o que foi gravado), e não a linha do journal — quem faz isso é `eco.spec.ts`.
      },
    },
  });

  const fila = conectarFila(instanciaDaFila.cadeiaConexao, logger);
  onTestFinished(async () => {
    await fila.encerrar();
  });

  fila.processar(
    fila.confirmacao,
    async (tarefa, registrador) =>
      await processarConfirmacaoDeEmail(tarefa, registrador, {
        banco: bancoDaBorda,
        email,
        urlBaseDaConfirmacao: URL_BASE_DA_CONFIRMACAO,
      }),
  );

  return fila;
}

/**
 * Enfileira a carga e espera a tarefa alcançar estado terminal, por **sondagem**.
 *
 * `completed` e `failed` são os dois estados terminais; `delayed` e `waiting` **não** encerram a
 * espera, e é essa distinção que faz o caso observar o desfecho depois de eventual repetição.
 */
async function executarTarefa(
  fila: Fila,
  carga: CargaDaConfirmacao,
  tentativas?: number,
): Promise<TarefaDaConfirmacao> {
  const enfileirada = await fila.confirmacao.add(
    FILA_DA_CONFIRMACAO,
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
      const estado = await (await fila.confirmacao.getJob(id))?.getState();

      return estado === 'completed' || estado === 'failed';
    },
    LIMITE_ESTADO_TERMINAL_MS,
  );

  const terminada = await fila.confirmacao.getJob(id);
  if (terminada === undefined) {
    throw new Error(`a tarefa ${id} desapareceu da fila antes da leitura do estado final`);
  }

  return terminada;
}

/**
 * Executa o trabalho sob o contexto informado, dentro de uma unidade de trabalho.
 *
 * É o **único** caminho por onde o arranjo alcança o banco: `executarCom` mais
 * `emUnidadeDeTrabalho`, o mesmo par da operação. Ele monta o estado; **nunca** o contexto da
 * tarefa, que nasce na borda a partir da carga. Corre sobre o acesso REAL, e não sobre o observado,
 * para que a contagem de unidades descreva só o que a borda abriu.
 */
async function emUnidade<T>(
  contexto: Contexto,
  trabalho: (tx: TransactionSql) => Promise<T>,
): Promise<T> {
  return await contextoDeTenant.executarCom(
    contexto,
    async () => await acesso.emUnidadeDeTrabalho(trabalho),
  );
}

/** O contador que mantém documentos e endereços distintos entre os cenários. */
let sequenciaDoCenario = 0;

/**
 * Admite uma empresa nova e devolve o contexto dela.
 *
 * `identidade.empresa` não tem política (ADR-0009), de modo que a admissão corre sob qualquer
 * contexto válido — e ela é a porta pública do pacote, a mesma que o Master usa.
 */
async function admitirEmpresaNova(marcaBase: string): Promise<Contexto> {
  sequenciaDoCenario += 1;

  const criada = await emUnidade(
    CONTEXTO_DE_A,
    async (tx) =>
      await admitirEmpresa(tx, {
        nome: `Imobiliária ${marcaBase}-${String(sequenciaDoCenario)}`,
        documento: `${String(Date.now()).slice(-8)}${String(sequenciaDoCenario).padStart(6, '0')}`,
      }),
  );

  if (criada === undefined) {
    throw new Error(`o arranjo não conseguiu admitir a empresa ${marcaBase}`);
  }

  return { empresaId: criada.id };
}

/** Um cadastro de pessoa mínimo — a conferência de dígito verificador é do contrato, não da porta. */
let proximoDocumento = 70_000_000_000;

function pessoaDe(nome: string, email: string): DadosDaPessoa {
  proximoDocumento += 1;

  return {
    nome,
    tipoPessoa: 'PESSOA_FISICA',
    documentoPrincipal: String(proximoDocumento),
    rg: null,
    email,
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

/** Cria o locatário pela porta pública do cadastro — o mesmo caminho que a rota usa por dentro. */
async function semearLocatario(contexto: Contexto, marcaBase: string): Promise<LocatarioSemeado> {
  sequenciaDoCenario += 1;
  const marca = `${marcaBase}-${String(sequenciaDoCenario)}`;
  const nome = `Locatário ${marca}`;
  const email = `locatario-${marca}@exemplo.invalid`;

  const criado = await emUnidade(
    contexto,
    async (tx) => await criarPessoa(tx, 'locatario', pessoaDe(nome, email)),
  );

  return { id: criado.id, nome: criado.nome, email: criado.email };
}

/**
 * Emite um portador pelo caminho de produção e devolve o **segredo em claro**.
 *
 * É a única forma legítima de tê-lo: o claro não é gravado, e a coluna dele não existe. Nada é
 * inserido direto na tabela, e nenhum derivado é fabricado.
 */
async function emitirPortadorDe(contexto: Contexto, locatarioId: string): Promise<string> {
  const portador = await emUnidade(contexto, async (tx) => await emitirPortador(tx, locatarioId));

  return portador.segredo;
}

/**
 * Quantas linhas de `negocio.portador_de_confirmacao` o contexto corrente alcança.
 *
 * **Sem `WHERE empresa_id`**, e não pode haver: quem recorta é a política (ADR-0008). O ramo
 * impossível levanta em vez de virar zero, que é justamente um dos valores esperados.
 */
async function contarPortadores(contexto: Contexto): Promise<number> {
  return await emUnidade(contexto, async (tx) => {
    const [linha] = await tx<{ total: string }[]>`
      SELECT count(*) AS total FROM negocio.portador_de_confirmacao
    `;

    if (linha === undefined) {
      throw new Error('a contagem crua de portador_de_confirmacao não devolveu linha');
    }

    return Number.parseInt(linha.total, 10);
  });
}
