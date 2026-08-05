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
import {
  type Ambiente,
  ENDERECO_DE_ESCUTA,
  PREFIXO_DE_VERSAO,
  TOKEN_AMBIENTE,
  TOKEN_LOGGER,
} from './configuracao/ambiente.js';

/** Caminho da página navegável do contrato. */
export const CAMINHO_DO_CONTRATO = 'docs';

/**
 * Caminho do documento de descrição do contrato, em JSON — o que um gerador de cliente consome.
 * A página acima é para pessoas; este endereço é para ferramentas.
 */
export const CAMINHO_DO_DOCUMENTO = 'docs/json';

/**
 * Rotas que ficam FORA do prefixo de versão. A exclusão é obrigatória, não preferência.
 *
 * `deploy/scripts/instalacao/verificar-fundacao.sh` consulta `/saude`, `/saude/pronto`, `/docs` e
 * `/docs/json` nesses endereços literais — inclusive na sub-bateria de recuperação após reinício
 * real, que é critério de aceitação da F0. Movê-las para `/v1/…` tornaria vermelho um conjunto de
 * casos que está verde, e o P5 de `.claude/rules/nao-regressao.md` classifica isso como regressão a
 * reverter, não como teste a ajustar. A rasa é, além disso, consumida pelo supervisor do sistema
 * operacional, cuja unidade também nomeia o endereço.
 *
 * A lista está escrita aqui, e não num comentário do `setGlobalPrefix`, para que uma rodada futura
 * a leia como **decisão registrada** e não como esquecimento. O `CT-018 (b)` de
 * `test/autenticacao.e2e.spec.ts` é a rede: ele extrai os endereços do próprio verificador shell e
 * afirma que os quatro continuam respondendo, e que a versão prefixada deles NÃO existe.
 *
 * O caminho do contrato entra por completude do registro: `SwaggerModule.setup` publica a página e
 * o documento fora do prefixo por padrão (`useGlobalPrefix` desligado), de modo que a entrada aqui
 * não é o que os mantém no lugar — mas é o que faz o DOCUMENTO declará-los sem o prefixo, que é o
 * endereço em que eles de fato atendem.
 */
const ROTAS_FORA_DO_PREFIXO = ['saude', 'saude/pronto', CAMINHO_DO_CONTRATO, CAMINHO_DO_DOCUMENTO];

/**
 * Publica o contrato: a página navegável e o documento que a descreve.
 *
 * A versão declarada aqui **continua** não sendo a versão da API: ela acompanha a versão do pacote.
 * O versionamento da API é o prefixo de caminho (`PREFIXO_DE_VERSAO`), decidido na T8 da fatia
 * `fundacao-multitenancy-identidade` (§15.1 daquela tech spec) — até ali a decisão estava diferida
 * porque nenhum recurso do produto havia sido publicado, e é essa condição que deixou de valer.
 *
 * ## O contrato atende SEM SESSÃO, e isso é decisão — não omissão
 *
 * As rotas que `SwaggerModule.setup` registra direto no adaptador não têm manipulador do arcabouço,
 * de modo que a guarda global **não corre nelas**: `/docs` (a página), `/docs/json` e `/docs-yaml`
 * (o documento inteiro) respondem a qualquer cliente. O estado é herdado — o contrato é publicado
 * assim desde a F1, e `verificar-fundacao.sh` consulta esses endereços como critério de aceitação da
 * F0 —, mas até 2026-08-05 ele estava apenas **inventariado**, nunca decidido: nenhuma ADR o cobria
 * e nenhum critério de aceitação o nomeava. Dois verificadores independentes RATIFICAVAM o estado
 * por igualdade de inventário, o que é coisa diferente de alguém ter decidido. É o débito **D24**.
 *
 * **A decisão é manter público enquanto a API não for publicada, e restringir na borda na F7.** As
 * três razões, na ordem em que pesam:
 *
 *   1. o contrato é **insumo declarado** do handoff ao frontend — o `CLAUDE.md` o lista no marco de
 *      entrega do backend, e o `@sysloc/contracts` nasce dele. Fechá-lo agora encareceria o trabalho
 *      que ele existe para servir;
 *   2. **hoje não há a quem vazar**: a API escuta em `127.0.0.1` (`configuracao/ambiente.ts`) e
 *      `deploy/nginx/` está vazio, então o alcance é o próprio hospedeiro;
 *   3. o que o documento revela é a **forma** da superfície, não dado de negócio nem credencial —
 *      toda rota de produto segue exigindo sessão e declaração de exigência (ADR-0011).
 *
 * O que muda isso é a F7, quando `/docs*` deixa de ser endereço interno de conveniência. Ver o
 * marcador logo abaixo.
 */
// DÉBITO COM GATILHO — D24 · F1/T5 · registrado 2026-08-05
// O QUÊ: a página e o documento do contrato atendem sem sessão, por decisão registrada no docblock
//        acima — decisão que vale enquanto a API só é alcançável do próprio hospedeiro.
// QUANDO FECHA: na **F7**, ao publicar atrás do servidor de borda. É lá que a premissa (2) da
//        decisão deixa de valer, e é a mesma janela e o mesmo salto confiável que o `D23 · F1/T8` e
//        o `D27 · F1/T6` esperam — o custo marginal de restringir `/docs*` ali é quase nulo.
// POR QUE NÃO AGORA: não há borda onde restringir, e o contrato é insumo do handoff ao frontend, que
//        acontece antes da F7.
// ÍNDICE: docs/specs/features/autorizacao-e-ciclo-de-acesso/v1/_run/run-report.md §2, D24
function publicarContrato(app: NestFastifyApplication): void {
  const documento = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle('Sysloc — API')
      .setDescription(
        'Contrato do backend Sysloc. Erros seguem a forma canônica ' +
          '`{ codigo, mensagem, campo?, detalhes? }` com status HTTP semântico (ADR-0012).',
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

  // ANTES de publicar o contrato: o documento é gerado a partir das rotas já registradas, e o
  // gerador aplica o prefixo global honrando esta mesma lista de exclusão. Publicar primeiro
  // descreveria endereços que a aplicação não atende.
  app.setGlobalPrefix(PREFIXO_DE_VERSAO, { exclude: ROTAS_FORA_DO_PREFIXO });

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
