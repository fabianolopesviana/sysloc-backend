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
 *      entrega do backend, e o `@syslocbr/contracts` nasce dele. Fechá-lo agora encareceria o trabalho
 *      que ele existe para servir;
 *   2. **hoje não há a quem vazar**: a API escuta em `127.0.0.1` (`configuracao/ambiente.ts`) e
 *      `deploy/nginx/` está vazio, então o alcance é o próprio hospedeiro;
 *   3. o que o documento revela é a **forma** da superfície, não dado de negócio nem credencial —
 *      toda rota de produto segue exigindo sessão e declaração de exigência (ADR-0011).
 *
 * ## O débito FECHOU em 2026-08-26 — e ele fechou NA BORDA, não aqui
 *
 * O gatilho do `D24` era literal: *"na F7, ao publicar atrás do servidor de borda"*. A borda passou
 * a existir na T9 da fatia `publicacao-e-backup` (`deploy/nginx/sysloc-app.conf`), e é **ela** que
 * recusa os três endereços — `/docs`, `/docs/json` e `/docs-yaml` — antes de qualquer repasse ao
 * serviço. O efeito que o débito pedia está obtido: o contrato deixou de ser alcançável de fora.
 *
 * ⚠️ **A restrição NÃO se instala aqui, e não é omissão.** Fechá-lo no registro da aplicação seria
 * regressão dupla, medida na §5.8 do scope daquela fatia:
 *
 *   1. as **8 rotas** `GET /docs*` **contam** nas 106 da âncora de superfície
 *      (`apps/api/test/cobertura-de-autorizacao.e2e.spec.ts`), e removê-las do registro moveria a
 *      superfície — que está **congelada** por item do marco de entrega do backend;
 *   2. `deploy/scripts/instalacao/verificar-fundacao.sh` consulta `/docs` e `/docs/json` **nesses
 *      endereços literais**, inclusive na sub-bateria de recuperação após reinício real, que é
 *      critério de aceitação da F0.
 *
 * A rede desta decisão é o `CT-1183` de `deploy/scripts/borda/verificar-borda-do-app.sh`: ele afirma
 * que o elenco acima continua com **quatro** entradas e que as duas constantes seguem exportadas com
 * os mesmos valores — com dois mutantes provando que a asserção pode falhar. O `CT-1182`, da mesma
 * bateria, prova por **medição de rede** que os três endereços morrem na borda, sem repasse.
 */
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
 * Maior corpo que o transporte aceita numa requisição — **64 KiB**, declarado e não herdado.
 *
 * ---------------------------------------------------------------------------
 * Por que ele existe, e por que aqui
 * ---------------------------------------------------------------------------
 *
 * Sem esta linha vale o padrão do arcabouço, **1 MiB por requisição**, que era um teto que ninguém
 * escolheu. Ele deixou de ser aceitável quando a fatia `webhook-e-carne` publicou
 * `POST /v1/notificacoes-bancarias`. São **duas** as rotas de negócio sem sessão do produto — a da
 * confirmação de endereço (ADR-0027) e esta (ADR-0035) —, e a distinção que importa aqui é outra: a
 * da confirmação exige **portador de segredo** de uso único, e esta não exige nada. É, portanto, a
 * única em que um desconhecido escreve, e ela grava o corpo **verbatim**, de propósito, porque a
 * ADR-0035 manda persistir o recebido cru antes de interpretá-lo. Com o teto herdado, uma requisição
 * forjada custava até ~1 MiB persistido com 90 dias de retenção, mais uma tarefa numa fila que
 * outros três produtores compartilham.
 *
 * A §11.5 do tech spec daquela fatia **proíbe limitador de abuso naquela rota**, e a proibição
 * continua de pé: ela veta o limitador **por origem**, que descartaria uma rajada *legítima* do
 * provedor — e perder notícia é o dano que a fatia existe para não ter. Um teto de **tamanho** é
 * controle ortogonal: ele não recusa requisição legítima nenhuma, porque a maior notícia real
 * medida (o Caso A da §4.1.1) tem **514 bytes** e cabe **127 vezes** aqui dentro. O que a §11.5
 * afirmava como premissa — *"o custo por notícia forjada é uma escrita pequena"* — passa a ser
 * imposto por esta constante, em vez de suposto.
 *
 * ---------------------------------------------------------------------------
 * De onde sai o número — é medido, não arredondado por conforto
 * ---------------------------------------------------------------------------
 *
 * O critério é o do erro assimétrico: recusar corpo **legítimo** é o defeito caro, porque não tem
 * contorno do lado de quem envia. Então o teto é fixado acima do maior corpo que o produto **aceita
 * hoje**, com folga:
 *
 *   * o maior corpo legítimo de toda a API é o registro de certificado — `material` em base64 mais
 *     `senha`, medido em **8.346 bytes**, e já limitado no contrato por `MAIOR_MATERIAL_CODIFICADO`
 *     (8192) e `MAIOR_SENHA_DO_MATERIAL` (128). 64 KiB é **7,8×** isso;
 *   * o segundo maior é a criação de imóvel (~4 KiB, todos os campos em seus tetos);
 *   * a notícia bancária, que é a rota exposta, é **514 bytes**.
 *
 * Ele é **global**, e não por rota, porque a propriedade que se quer é a da montagem: instalado por
 * rota, o teto seria o controle que a rota seguinte esquece. Nenhum esquema de entrada do produto
 * tem corpo sem limite — todos são `strictObject` com campos limitados —, de modo que um teto único
 * generoso não recusa nada que o contrato aceite.
 *
 * ⚠️ O valor é **contado em bytes do corpo**, pelo transporte, **antes** do manipulador: a recusa é
 * do adaptador, e nada chega a ser gravado. É o mesmo caminho pelo qual corpo que não é JSON já é
 * recusado, e o `CT-020 (e)` de `test/contexto.e2e.spec.ts` mede as duas metades (recusa acima do
 * teto, aceite abaixo dele) contra **esta** montagem.
 */
export const MAIOR_CORPO_ACEITO = 64 * 1024;

/**
 * Monta a aplicação: composição raiz, adaptador HTTP, contrato publicado e ganchos de
 * desligamento. Não escuta — quem decide isso é quem chama.
 */
export async function criarAplicacao(): Promise<NestFastifyApplication> {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    // O teto de corpo é **declarado**, e a ausência de opções aqui já foi o defeito: ver
    // {@link MAIOR_CORPO_ACEITO} para por que 64 KiB, e por que ele não é o limitador que a §11.5
    // da fatia `webhook-e-carne` proíbe.
    new FastifyAdapter({ bodyLimit: MAIOR_CORPO_ACEITO }),
    {
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
    },
  );

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
