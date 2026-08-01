/**
 * Verificação profunda de saúde — alcançabilidade do banco de dados e da fila.
 *
 * ---------------------------------------------------------------------------
 * Cliente leve, aqui dentro
 * ---------------------------------------------------------------------------
 *
 * Não há pacote de banco de dados nesta fatia, e este serviço não é o começo de um. O que ele faz
 * é uma pergunta de alcançabilidade — "a dependência responde?" — com o cliente que a stack já
 * fixou, configurado para responder **rápido quando a resposta é não**. O pacote dedicado nasce
 * na fatia seguinte, junto da primeira estrutura que precisa dele.
 *
 * ---------------------------------------------------------------------------
 * Por que as sondas têm limite de tempo próprio
 * ---------------------------------------------------------------------------
 *
 * A rota profunda é consumida pela prova de aceitação do reinício, e uma sonda sem limite
 * transforma "o banco não voltou" em "a requisição ficou pendurada" — que é o desfecho que não se
 * distingue de defeito na aplicação. As duas sondas correm **em paralelo** e cada uma tem teto
 * declarado: o estado de uma dependência nunca depende do tempo que a outra leva.
 *
 * ---------------------------------------------------------------------------
 * Conexão viva, encerrada no desligamento
 * ---------------------------------------------------------------------------
 *
 * Os dois clientes são criados uma vez e reaproveitados — abrir e fechar conexão a cada consulta
 * de saúde só transferiria custo para o banco. Em contrapartida, eles são recursos abertos por
 * este serviço, e é ele quem os fecha no desligamento (`onApplicationShutdown`), que o ponto de
 * entrada arma com os ganchos do supervisor do sistema operacional.
 */

import { Inject, Injectable, type OnApplicationShutdown } from '@nestjs/common';
import type { Logger } from '@sysloc/shared';
import { Redis } from 'ioredis';
import postgres from 'postgres';
import { type Ambiente, TOKEN_AMBIENTE, TOKEN_LOGGER } from '../configuracao/ambiente.js';

/** Teto de cada sonda. Além dele a dependência é dada por inalcançável. */
const LIMITE_DA_SONDA_MS = 2_000;

/** Milissegundos em um segundo — o cliente do banco declara o teto de conexão em segundos. */
const MS_POR_SEGUNDO = 1_000;

/** Espera entre tentativas de reconexão da fila, e seu teto. */
const PASSO_DE_RECONEXAO_MS = 200;
const MAIOR_ESPERA_DE_RECONEXAO_MS = 2_000;

/** Teto para o encerramento do cliente de banco no desligamento, em segundos. */
const LIMITE_DE_ENCERRAMENTO_S = 5;

/** Estado observado de uma dependência. */
export type EstadoDeDependencia = 'disponivel' | 'indisponivel';

/**
 * Estado de cada dependência, nomeada. É esta forma que a resposta da rota profunda carrega — em
 * `200` e em `503` —, e é o que torna a prova do reinício útil em vez de binária.
 */
export interface EstadoDasDependencias {
  readonly banco: EstadoDeDependencia;
  readonly fila: EstadoDeDependencia;
}

@Injectable()
export class SaudeService implements OnApplicationShutdown {
  private readonly banco: postgres.Sql;
  private readonly fila: Redis;

  constructor(
    @Inject(TOKEN_AMBIENTE) ambiente: Ambiente,
    @Inject(TOKEN_LOGGER) private readonly logger: Logger,
  ) {
    this.banco = postgres(ambiente.cadeiaConexaoBanco, {
      // Uma conexão basta para uma sonda, e é o que impede a verificação de saúde de disputar
      // capacidade de conexão com o trabalho de negócio das fatias seguintes.
      max: 1,
      connect_timeout: LIMITE_DA_SONDA_MS / MS_POR_SEGUNDO,
      onnotice: () => {},
    });

    this.fila = new Redis(ambiente.cadeiaConexaoFila, {
      connectTimeout: LIMITE_DA_SONDA_MS,
      commandTimeout: LIMITE_DA_SONDA_MS,
      // Uma tentativa de reenvio, e o comando é recusado: quem espera pela sonda é uma rota de
      // saúde, não um trabalho de negócio. Com o servidor fora, a recusa chega em seguida; e se
      // demorar mais que o teto declarado, o limite de {@link comLimite} a encerra de qualquer
      // forma. A fila de espera local fica LIGADA de propósito — desligá-la faria a sonda emitida
      // enquanto a conexão inicial ainda se estabelece ser recusada de imediato, e a rota profunda
      // reportaria a fila indisponível nos primeiros instantes de vida do processo, justamente
      // quando a prova de aceitação do reinício a consulta.
      maxRetriesPerRequest: 1,
      retryStrategy: (tentativa: number) =>
        Math.min(tentativa * PASSO_DE_RECONEXAO_MS, MAIOR_ESPERA_DE_RECONEXAO_MS),
    });

    // O cliente da fila emite `error` a cada tentativa de reconexão frustrada. Sem ouvinte, o
    // runtime trata o evento como exceção não capturada e **derruba o processo** — a queda da
    // fila levaria junto a aplicação inteira, que é o oposto do que as duas rotas de saúde
    // existem para permitir.
    this.fila.on('error', (erro: Error) => {
      this.logger.debug({ erro, dependencia: 'fila' }, 'cliente da fila reportou falha de conexão');
    });
  }

  /** Consulta banco e fila em paralelo e devolve o estado de cada um. */
  async verificarDependencias(): Promise<EstadoDasDependencias> {
    const [banco, fila] = await Promise.all([
      this.sondar('banco', () => this.banco`SELECT 1`),
      this.sondar('fila', () => this.fila.ping()),
    ]);
    return { banco, fila };
  }

  /** Encerra os dois clientes. Chamado pelo desligamento gracioso e pelo fechamento da aplicação. */
  async onApplicationShutdown(): Promise<void> {
    await Promise.allSettled([
      this.banco.end({ timeout: LIMITE_DE_ENCERRAMENTO_S }),
      this.encerrarFila(),
    ]);
  }

  private async sondar(
    dependencia: string,
    sonda: () => PromiseLike<unknown>,
  ): Promise<EstadoDeDependencia> {
    try {
      await comLimite(sonda(), dependencia);
      return 'disponivel';
    } catch (erro) {
      // A falha é diagnóstico, não resposta: ela vai por campo nomeado para o registro (que
      // redige credencial na origem) e nunca para o corpo devolvido ao cliente.
      this.logger.warn({ erro, dependencia }, 'dependência inalcançável na verificação de saúde');
      return 'indisponivel';
    }
  }

  /**
   * Encerra o cliente da fila pelo caminho gracioso, e pelo incondicional quando ele não estiver
   * disponível — sem o segundo, uma parada com a fila já fora deixaria o temporizador de
   * reconexão de pé, e com ele o processo que deveria estar terminando.
   */
  private async encerrarFila(): Promise<void> {
    try {
      await this.fila.quit();
    } catch {
      this.fila.disconnect();
    }
  }
}

/**
 * Corre a sonda contra um teto de tempo.
 *
 * O temporizador é sempre desarmado: um `setTimeout` pendente é um recurso aberto, e ele seguraria
 * o encerramento do processo pelo tempo restante.
 */
async function comLimite<T>(sonda: PromiseLike<T>, dependencia: string): Promise<T> {
  let temporizador: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      sonda,
      new Promise<never>((_, rejeitar) => {
        temporizador = setTimeout(
          () =>
            rejeitar(
              new Error(`a dependência '${dependencia}' não respondeu em ${LIMITE_DA_SONDA_MS} ms`),
            ),
          LIMITE_DA_SONDA_MS,
        );
      }),
    ]);
  } finally {
    clearTimeout(temporizador);
  }
}
