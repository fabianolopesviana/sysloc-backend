/**
 * Módulo de identidade — onde a instância do arcabouço nasce, e onde ela morre.
 *
 * ---------------------------------------------------------------------------
 * A composição acontece AQUI, e não dentro do pacote
 * ---------------------------------------------------------------------------
 *
 * `@sysloc/auth` publica uma **fábrica** (`criarAutenticacao`), não uma instância de módulo, e a
 * razão está escrita lá: uma instância criada na carga do módulo precisaria ler cadeia de conexão e
 * segredo do ambiente **de dentro de um pacote de biblioteca**, que é o modo de falha que a
 * ADR-0006 nomeia — a verificação alcançaria, em silêncio, o que atende a operação.
 *
 * Este módulo é a outra ponta dessa decisão: ele é o único lugar do processo que sabe de onde vêm o
 * acesso ao banco, o segredo e o endereço, porque é o lugar onde a configuração validada já está
 * disponível por injeção.
 *
 * ---------------------------------------------------------------------------
 * Quem abre é dono do recurso
 * ---------------------------------------------------------------------------
 *
 * O acesso restrito a `identidade` é uma reserva de conexões, e é este módulo que a abre — logo é
 * ele que a encerra no desligamento, pelo mesmo gancho que `SaudeService` usa para os clientes
 * dele. Sem isso, uma reserva viva seguraria o laço de eventos e o processo não terminaria: o
 * desligamento gracioso que o ponto de entrada arma pararia de ser gracioso e viraria morte por
 * temporizador do supervisor.
 *
 * ---------------------------------------------------------------------------
 * O que a T9 acrescentou: a guarda e a rota de sessão
 * ---------------------------------------------------------------------------
 *
 * A guarda de contexto (`contexto.guard.ts`) é declarada por este módulo porque é aqui que vivem as
 * duas coisas que ela precisa — a instância do arcabouço e o acesso restrito a `identidade` — e é
 * **exportada** para que a composição raiz a registre como global sobre esta mesma instância. O
 * `SessaoController` entra ao lado do encaminhador: os dois publicam sessão, um no vocabulário do
 * arcabouço e o outro no do produto.
 *
 * O encaminhador ganhou `@RotaPublica()` na mesma task. A marca diz apenas *"a guarda de contexto
 * não exige sessão aqui"* — ela é o que torna a ENTRADA possível, já que entrar acontece antes de
 * existir sessão. As rotas do arcabouço que exigem sessão continuam exigindo, pela conferência
 * dele.
 *
 * ---------------------------------------------------------------------------
 * O endereço base não é enfeite
 * ---------------------------------------------------------------------------
 *
 * O arcabouço deriva dele a **origem confiável** das requisições que carregam cookie: uma
 * requisição autenticada cujo cabeçalho `Origin` não bata com essa origem é recusada antes de
 * qualquer manipulador. Por isso ele é composto a partir do MESMO endereço e da MESMA porta em que
 * o processo escuta — as duas coisas vindas da configuração, e não de literais repetidos.
 *
 * **Limite declarado**: enquanto o serviço só atende no endereço de retorno, essa origem é a do
 * próprio processo. Quando a virada (F7) publicá-lo atrás do servidor de borda, a origem que o
 * navegador enviará é a do endereço público, e ela precisará entrar na configuração. Isso é
 * **débito com gatilho** — `D23`, no marcador junto do `enderecoBase` mais abaixo, que é onde a
 * varredura `grep -rl "DÉBITO COM GATILHO" apps packages deploy` o encontra e onde a fatia da
 * virada vai lê-lo. Este parágrafo não é o registro; o marcador é.
 */

import { Inject, Module, type OnApplicationShutdown } from '@nestjs/common';
import { type Autenticacao, criarAutenticacao } from '@sysloc/auth';
import {
  type AcessoAIdentidade,
  type AcessoAoBanco,
  abrirAcessoAIdentidade,
  abrirAcessoAoBanco,
} from '@sysloc/db';
import {
  type Ambiente,
  ENDERECO_DE_ESCUTA,
  PREFIXO_DE_VERSAO,
  TOKEN_ACESSO_A_IDENTIDADE,
  TOKEN_ACESSO_AO_NEGOCIO,
  TOKEN_AMBIENTE,
  TOKEN_AUTENTICACAO,
} from '../configuracao/ambiente.js';
import { AutenticacaoController, CAMINHO_DA_IDENTIDADE } from './autenticacao.controller.js';
import { GuardaDeContexto } from './contexto.guard.js';
import { SenhaController } from './senha.controller.js';
import { SessaoController } from './sessao.controller.js';

/**
 * Endereço, relativo à raiz do serviço, em que as rotas do arcabouço atendem.
 *
 * Composto — e não escrito como `/v1/auth` — porque é ele que o arcabouço recebe como prefixo de
 * montagem, e o controlador é montado a partir dos mesmos dois pedaços. Compor é o que impede o
 * par de divergir: um literal solto aqui deixaria o arcabouço interpretando caminhos a partir de um
 * prefixo que ninguém atende.
 */
export const PREFIXO_DAS_ROTAS_DE_IDENTIDADE = `/${PREFIXO_DE_VERSAO}/${CAMINHO_DA_IDENTIDADE}`;

@Module({
  // `SenhaController` entra ao lado dos dois desde a T9 da fatia `autorizacao-e-ciclo-de-acesso`:
  // ele publica a troca de senha do produto, que substitui a rota nativa que o encaminhador deixou
  // de publicar. Ele vive NESTE módulo, e não num módulo próprio, porque injeta exatamente as duas
  // coisas que este módulo é dono — a instância do arcabouço e o acesso restrito a `identidade` —,
  // e um módulo novo só para ele teria de importá-las de volta daqui.
  controllers: [AutenticacaoController, SenhaController, SessaoController],
  providers: [
    // A guarda é declarada AQUI, e não na composição raiz, porque é aqui que vivem as duas coisas
    // que ela injeta: a instância do arcabouço e o acesso restrito a `identidade`. Quem a torna
    // GLOBAL é `app.module.ts`, que a registra por `useExisting` sobre esta mesma instância — e é
    // por isso que ela sai no `exports`. Uma segunda instância provida lá manteria duas reservas de
    // conexão e dois estados para a mesma responsabilidade.
    GuardaDeContexto,
    {
      provide: TOKEN_ACESSO_A_IDENTIDADE,
      useFactory: (ambiente: Ambiente): AcessoAIdentidade =>
        abrirAcessoAIdentidade({ cadeiaDeConexao: ambiente.cadeiaConexaoBanco }),
      inject: [TOKEN_AMBIENTE],
    },
    {
      // O acesso a dado de NEGÓCIO — reserva própria, distinta da de identidade, porque são papéis
      // distintos: aquela é o executor restrito ao schema `identidade`, esta é a unidade de trabalho
      // que fixa `app.empresa_id` por transação. Fundi-las devolveria a `identidade` um caminho para
      // `negocio` sem contexto, que é o que a ADR-0008 fecha.
      //
      // Ele nasce aqui, e não na composição raiz, porque hoje o único consumidor é a guarda de
      // contexto, que este módulo declara — mesma razão pela qual a guarda não vive lá. Quando as
      // rotas de Master e de usuários chegarem (T7, T8), a decisão a rever é se ele sobe para a
      // composição raiz; até lá, publicá-lo seria superfície sem consumidor.
      provide: TOKEN_ACESSO_AO_NEGOCIO,
      useFactory: (ambiente: Ambiente): AcessoAoBanco =>
        abrirAcessoAoBanco({ cadeiaDeConexao: ambiente.cadeiaConexaoBanco }),
      inject: [TOKEN_AMBIENTE],
    },
    {
      provide: TOKEN_AUTENTICACAO,
      useFactory: (ambiente: Ambiente, acesso: AcessoAIdentidade): Autenticacao =>
        criarAutenticacao({
          acesso,
          segredoDeSessao: ambiente.segredoDeSessao,
          // DÉBITO COM GATILHO — D23 · F1/T8 · registrado 2026-08-02
          // (Ele AGENDA, não protege: a linha abaixo VAI mudar, e editá-la é normal — o que não se
          //  pode é editá-la sem ler isto, porque é aqui que a mudança da virada incide.)
          // O QUÊ: deste valor o arcabouço deriva a ORIGEM CONFIÁVEL, e ele é o endereço de
          //        RETORNO em que o processo escuta. Medido em `better-auth@1.6.25`
          //        (`dist/api/middlewares/origin-check.mjs`): `Origin`/`Referer` são conferidos
          //        contra `trustedOrigins`, derivado daqui, para todo método diferente de
          //        GET/HEAD/OPTIONS que carregue cookie E TAMBÉM para a requisição SEM cookie —
          //        `validateFormCsrf` chama `validateOrigin(ctx, true)` assim que qualquer
          //        cabeçalho `Sec-Fetch-*` está presente, e um navegador SEMPRE os envia.
          //        Consequência depois da F7, quando o `Origin` do navegador for o endereço
          //        PÚBLICO e este valor continuar `http://127.0.0.1:<porta>`: recusa com
          //        `FORBIDDEN / INVALID_ORIGIN` antes de qualquer manipulador em toda requisição
          //        com cookie **e no PRÓPRIO LOGIN**. Não é "requisição autenticada recusada" — é
          //        o serviço inteiro inacessível a navegador, entrada inclusive.
          // QUANDO FECHA: a publicação atrás do servidor de borda na F7 (virada). Até lá o único
          //        cliente é o próprio host, e a origem confiável coincide com a de escuta.
          // POR QUE NÃO AGORA: o endereço público não existe ainda — nome e certificado são
          //        decididos na virada. Fixar um literal hoje seria adivinhar, e um valor errado
          //        aqui recusa o login inteiro sem que caso nenhum desta fatia o alcance (todos
          //        falam com o endereço de retorno). Fechar exige variável de ambiente própria
          //        para a origem pública, validada na partida como as demais, e essa configuração
          //        pertence à fatia que publica o serviço.
          // ÍNDICE: docs/specs/features/fundacao-multitenancy-identidade/v1/_run/run-report.md §2, D23
          enderecoBase: `http://${ENDERECO_DE_ESCUTA}:${String(ambiente.porta)}`,
          prefixoDasRotas: PREFIXO_DAS_ROTAS_DE_IDENTIDADE,
        }),
      inject: [TOKEN_AMBIENTE, TOKEN_ACESSO_A_IDENTIDADE],
    },
  ],
  // Os dois acessos SAEM daqui a partir da T7 da fatia `autorizacao-e-ciclo-de-acesso`, e as duas
  // saídas são DECISÕES DESTA TASK, com argumento próprio. Nenhuma delas é a revisão que o
  // comentário de `TOKEN_ACESSO_AO_NEGOCIO`, acima, agendou: aquele texto pergunta se **ele** sobe
  // para a composição raiz — é sobre a LOCALIZAÇÃO da fábrica dele —, e a resposta continua sendo
  // não, pela razão que `master.module.ts` registra (mover o provedor sem mover o gancho de
  // desligamento deixaria o recurso sem dono). Exportar é outra coisa, e não estava agendado.
  //
  // **O que muda, e o que não muda.** Não muda o número de objetos: cada token continua tendo UMA
  // fábrica, e é essa única instância que sai. Publicá-los é o que impede o módulo do Master (e o
  // de pessoas, na T8) de abrir a própria reserva de conexões — o que produziria duas donas do
  // mesmo recurso e um desligamento que só devolve metade delas, já que o gancho abaixo encerra as
  // que ESTE módulo abriu.
  //
  //   * `TOKEN_ACESSO_AO_NEGOCIO` sai porque o Master precisa de transação de verdade, e esta é a
  //     porta ÚNICA que a entrega. Ela abre a transação com `SET LOCAL` derivado do contexto, que
  //     só a guarda escreve (CT-014): publicar o objeto não publica um caminho para `negocio` sem
  //     contexto, porque esse caminho não existe;
  //   * `TOKEN_ACESSO_A_IDENTIDADE` sai porque as duas funções de onboarding de `@sysloc/auth`
  //     (`criarPessoa` e `reemitirSenhaProvisoria`) exigem o executor de identidade **por
  //     assinatura**, e o índice daquele pacote as publicou nomeando literalmente as rotas desta
  //     task. Sem o export, o módulo do Master abriria um segundo `abrirAcessoAIdentidade`, que é o
  //     recurso sem dono do parágrafo acima.
  //
  // **A prescrição que isto substitui, e por que ela pôde cair.** Desde a T8 da fatia anterior este
  // módulo registrava que `TOKEN_ACESSO_A_IDENTIDADE` ficava fora do `exports` porque *"publicar o
  // executor criaria um segundo caminho para as tabelas de identidade"*. A propriedade que ela
  // protegia — o alcance a `identidade` ser enumerável — continua sendo exigida, e é ela que o
  // cabeçalho de `master.module.ts` e o de `empresa.service.ts` sustentam por outra via: o
  // consumidor **repassa** o executor e não escreve consulta alguma com ele. Isso é verificável,
  // não declarado: as operações de `identidade` do ciclo de vida da empresa vivem em
  // `packages/db/src/empresa.ts`, e `apps/api/src` não tem SQL nem importa `esquemaIdentidade` ou o
  // construtor de consulta do ORM. O executor publicado continua sendo o restrito às sete tabelas,
  // sem `$client` (a `DECISÃO FECHADA` de `packages/db/src/acesso-identidade.ts`).
  exports: [
    TOKEN_ACESSO_A_IDENTIDADE,
    TOKEN_ACESSO_AO_NEGOCIO,
    TOKEN_AUTENTICACAO,
    GuardaDeContexto,
  ],
})
export class AutenticacaoModule implements OnApplicationShutdown {
  constructor(
    @Inject(TOKEN_ACESSO_A_IDENTIDADE) private readonly acesso: AcessoAIdentidade,
    @Inject(TOKEN_ACESSO_AO_NEGOCIO) private readonly negocio: AcessoAoBanco,
  ) {}

  /**
   * Devolve as duas reservas de conexões abertas na construção.
   *
   * As duas, e não só a primeira: quem abre é dono do recurso, e uma reserva viva segura o laço de
   * eventos — o desligamento gracioso que o ponto de entrada arma pararia de ser gracioso e viraria
   * morte por temporizador do supervisor. `Promise.allSettled` para que a falha de uma não impeça o
   * fechamento da outra, que é justamente o caminho em que o vazamento aconteceria.
   */
  async onApplicationShutdown(): Promise<void> {
    await Promise.allSettled([this.acesso.encerrar(), this.negocio.encerrar()]);
  }
}
