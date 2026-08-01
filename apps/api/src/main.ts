/**
 * Ponto de entrada do serviço de aplicação.
 *
 * ---------------------------------------------------------------------------
 * Desligamento gracioso
 * ---------------------------------------------------------------------------
 *
 * O supervisor do sistema operacional encerra o processo por sinal a cada reinício, e uma conexão
 * em curso cortada no meio é uma requisição perdida sem resposta. `enableShutdownHooks` faz o
 * arcabouço atender ao sinal fechando o servidor — sem aceitar requisição nova, esperando as em
 * curso — e só então executar os ganchos de encerramento, que é onde as conexões de banco e de
 * fila são devolvidas.
 *
 * ---------------------------------------------------------------------------
 * Falha de partida
 * ---------------------------------------------------------------------------
 *
 * Configuração inválida faz a criação da aplicação lançar (`carregarAmbiente`, na composição
 * raiz). A mensagem — que nomeia cada variável ausente — é escrita na saída de erro, que é o que
 * a unidade de serviço entrega ao journal, e o processo termina com código diferente de zero. O
 * registrador estruturado não é usado nesse caminho de propósito: ele depende da configuração que
 * acabou de ser recusada.
 *
 * ---------------------------------------------------------------------------
 * Por que a partida está atrás de um guarda
 * ---------------------------------------------------------------------------
 *
 * Este módulo exporta `criarAplicacao` e os dois caminhos do contrato (`CAMINHO_DO_CONTRATO` e
 * `CAMINHO_DO_DOCUMENTO`), que é o que a verificação de ponta a ponta importa para exercitar **a
 * mesma** montagem que atende em operação — em vez de remontá-la, e um dia remontá-la diferente.
 * O guarda de ponto de entrada é o que permite importá-lo sem que a importação suba um servidor.
 */

import { pathToFileURL } from 'node:url';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { Logger } from '@sysloc/shared';
import { AppModule } from './app.module.js';
import { type Ambiente, TOKEN_AMBIENTE, TOKEN_LOGGER } from './configuracao/ambiente.js';

/** Caminho da página navegável do contrato. */
export const CAMINHO_DO_CONTRATO = 'docs';

/**
 * Caminho do documento de descrição do contrato, em JSON — o que um gerador de cliente consome.
 * A página acima é para pessoas; este endereço é para ferramentas.
 */
export const CAMINHO_DO_DOCUMENTO = 'docs/json';

/**
 * Endereço em que o serviço escuta.
 *
 * Somente o endereço de retorno: este servidor é compartilhado com o ambiente que ainda atende a
 * operação, e escutar em toda interface publicaria o backend novo na internet antes da virada.
 * A publicação externa é da fatia de virada, e passa por servidor de borda — que alcança este
 * endereço sem que ele deixe de ser local.
 */
const ENDERECO_DE_ESCUTA = '127.0.0.1';

/**
 * Publica o contrato: a página navegável e o documento que a descreve.
 *
 * A versão declarada não é versão de API — o versionamento do contrato é decisão diferida
 * (`scope.md` §3.9), porque ainda não há recurso de negócio publicado. Aqui ela apenas acompanha
 * a versão do pacote.
 */
function publicarContrato(app: NestFastifyApplication): void {
  const documento = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle('Sysloc — API')
      .setDescription(
        'Contrato do backend Sysloc. Erros seguem a forma canônica ' +
          '`{ codigo, mensagem, campo?, detalhes? }` com status HTTP semântico (ADR-0007).',
      )
      .setVersion('0.0.0')
      .build(),
  );

  SwaggerModule.setup(CAMINHO_DO_CONTRATO, app, documento, {
    jsonDocumentUrl: CAMINHO_DO_DOCUMENTO,
    customSiteTitle: 'Sysloc — API',
  });
}

/**
 * Monta a aplicação: composição raiz, adaptador HTTP, contrato publicado e ganchos de
 * desligamento. Não escuta — quem decide isso é quem chama.
 */
export async function criarAplicacao(): Promise<NestFastifyApplication> {
  const app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter(), {
    // O registrador do arcabouço escreve texto livre na saída padrão, e o projeto registra em
    // formato estruturado (T3). Deixar os dois ativos entregaria ao journal duas gramáticas
    // misturadas, e a metade em texto livre não seria consultável.
    logger: false,
    // Sem isto, uma falha durante a montagem — configuração incompleta, entre elas — é
    // interceptada pelo arcabouço, registrada pelo registrador que a linha acima desligou e
    // encerrada com `process.exit`. O processo morreria com código diferente de zero e **sem
    // dizer por quê**, que é exatamente o contrário do que a validação de partida existe para
    // entregar. Com o aborto desligado, a exceção chega a quem chamou.
    abortOnError: false,
  });

  publicarContrato(app);
  app.enableShutdownHooks();

  return app;
}

async function principal(): Promise<void> {
  const app = await criarAplicacao();

  try {
    const ambiente = app.get<Ambiente>(TOKEN_AMBIENTE);
    const logger = app.get<Logger>(TOKEN_LOGGER);

    await app.listen({ port: ambiente.porta, host: ENDERECO_DE_ESCUTA });

    logger.info(
      {
        porta: ambiente.porta,
        endereco: ENDERECO_DE_ESCUTA,
        ambiente: ambiente.ambiente,
        contrato: `/${CAMINHO_DO_CONTRATO}`,
      },
      'serviço de aplicação no ar',
    );
  } catch (erro) {
    // Fechar o que já subiu é o que permite ao processo terminar: uma porta aberta ou um cliente
    // conectado seguraria o laço de eventos e o serviço ficaria de pé sem atender.
    await app.close();
    throw erro;
  }
}

/** Este módulo foi executado como programa, ou apenas importado? */
function ehPontoDeEntrada(): boolean {
  const invocado = process.argv[1];
  return invocado !== undefined && import.meta.url === pathToFileURL(invocado).href;
}

if (ehPontoDeEntrada()) {
  principal().catch((erro: unknown) => {
    process.stderr.write(`${erro instanceof Error ? erro.message : String(erro)}\n`);
    // Código de saída em vez de encerramento imediato: a escrita acima ainda pode estar a caminho
    // do journal, e `process.exit` a truncaria — justamente a linha que diz por que o serviço não
    // subiu.
    process.exitCode = 1;
  });
}
