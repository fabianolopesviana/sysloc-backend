/**
 * A montagem **instrumentada** da aplicação — casa única das suítes que substituem uma porta.
 *
 * ---------------------------------------------------------------------------
 * Por que existe
 * ---------------------------------------------------------------------------
 *
 * Quatro suítes de `apps/api/test/` precisam da aplicação real com **uma dependência trocada**: o
 * destino da mensagem em `autorizacao-do-dominio.e2e.spec.ts`, `automacao-de-cobranca.e2e.spec.ts` e
 * `equivalencia-com-o-oraculo.spec.ts` (o capturador de e-mail, sobre `TOKEN_PORTA_DE_EMAIL`), e o
 * provedor bancário em `vocabulario-na-saida-real.e2e.spec.ts` (sobre
 * `TOKEN_PORTA_DE_COBRANCA_BANCARIA`). A substituição é feita pelo **arcabouço de teste**, por
 * `overrideProvider` sobre o token que a composição já publica — nunca por variável de ambiente nem
 * por ramo condicional no código de produção.
 *
 * Até o fecho do débito **D57** (F3/T12) essa montagem existia em **quatro cópias literais**, e o
 * gatilho do marcador — o terceiro consumidor — já havia disparado **duas vezes**, com as duas donas
 * deferindo por escopo de task. O que a duplicação custava não era estética: as quatro cópias podiam
 * divergir entre si, e **nenhuma asserção acusaria** — a suíte que herdasse uma montagem defasada
 * mediria uma aplicação que já não é a das outras três. Este módulo é o fecho, e a intervenção
 * dirigida de 2026-08-18 migrou as quatro no mesmo diff.
 *
 * ---------------------------------------------------------------------------
 * Por que aqui, e não em `packages/shared/test/`
 * ---------------------------------------------------------------------------
 *
 * Pela mesma razão de `./documento.ts` e `./base32.ts`, que são o precedente do diretório: **não
 * precisa** atravessar fronteira de pacote. Os quatro consumidores são irmãos deste arquivo, e o que
 * a função monta é o `AppModule` **deste** serviço — não há nada aqui que outro pacote pudesse usar.
 * Isto é independente do débito `D28` (F0/T5), que é sobre importar `packages/shared/test/` por
 * caminho relativo profundo, ATRAVESSANDO a fronteira do pacote; nada disso acontece neste módulo.
 *
 * ---------------------------------------------------------------------------
 * O que ela deliberadamente NÃO faz — e por que a diferença é conteúdo
 * ---------------------------------------------------------------------------
 *
 * Ela **não** deriva de `criarAplicacao()`, e por isso omite `logger: false`, `abortOnError: false`,
 * o `exclude` do prefixo, `publicarContrato()` e `enableShutdownHooks()`. Nenhuma dessas cinco
 * alcança o que os casos medem: a guarda, o filtro de erro e o interceptador de contexto são
 * registrados por `APP_GUARD` / `APP_FILTER` / `APP_INTERCEPTOR` **dentro** do `AppModule`, e
 * portanto valem aqui exatamente como valem na aplicação que atende.
 *
 * A ausência do `exclude` é a mais visível, e é deliberada: nenhuma requisição feita a uma aplicação
 * instrumentada toca as rotas de saúde nem o contrato publicado, e reproduzir a lista de exclusões
 * aqui criaria uma segunda cópia dela **livre para divergir** — a mesma classe de defeito que este
 * módulo acabou de fechar. O que importa é que as rotas de negócio atendam sob o prefixo, e isso a
 * montagem garante.
 *
 * ⚠️ **A divergência acima é conhecida e não reprova caso algum — a asserção que a acusaria não
 * existe.** Ela é aceitável enquanto `criarAplicacao()` não registrar nenhum global FORA do
 * `AppModule`. Se algum dia registrar, esta função é o **único** ponto a corrigir, e era exatamente
 * essa unicidade que as quatro cópias não davam.
 */

import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import { AppModule } from '../src/app.module.ts';
import { ENDERECO_DE_ESCUTA, PREFIXO_DE_VERSAO } from '../src/configuracao/ambiente.ts';

/**
 * Uma porta a trocar: o token que a composição publica, e o dublê que entra no lugar.
 *
 * O `token` é `symbol` porque é o que os dois tokens do serviço são
 * (`Symbol('PortaDeEnvioDeEmail')`, `Symbol('AdaptadorCobrancaBancaria')`), e restringi-lo assim
 * impede que um nome de classe ou uma cadeia solta seja passada por engano — erro que só apareceria
 * como "a substituição não teve efeito", em runtime, no meio de um caso.
 */
export interface SubstituicaoDePorta {
  readonly token: symbol;
  readonly valor: unknown;
}

/**
 * Sobe a aplicação real com as portas indicadas trocadas, já escutando.
 *
 * @param porta - a porta reservada por `reservarPorta()`. A função **não** a reserva por conta
 *   própria: quem chama já precisa do número antes, para compor a URL base do caso.
 * @param substituicoes - as portas a trocar. Uma lista, e não um par único, porque uma suíte futura
 *   pode precisar de duas — e descobrir isso depois obrigaria a migrar os quatro consumidores de
 *   novo, que é o custo que este módulo existe para não repetir.
 */
export async function montarAplicacaoInstrumentada(
  porta: number,
  substituicoes: readonly SubstituicaoDePorta[],
): Promise<NestFastifyApplication> {
  let construtor = Test.createTestingModule({ imports: [AppModule] });
  for (const { token, valor } of substituicoes) {
    construtor = construtor.overrideProvider(token).useValue(valor);
  }
  const modulo = await construtor.compile();

  const aplicacao = modulo.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
  aplicacao.setGlobalPrefix(PREFIXO_DE_VERSAO);
  await aplicacao.listen({ port: porta, host: ENDERECO_DE_ESCUTA });
  return aplicacao;
}
