/**
 * Ciclo de vida do **Admin Empresa** visto pelo operador do SaaS — leitura, suspensão, reativação,
 * correção cadastral e **remoção definitiva**.
 *
 * ---------------------------------------------------------------------------
 * Este serviço ORQUESTRA — ele não escreve consulta
 * ---------------------------------------------------------------------------
 *
 * Toda instrução sobre `identidade.usuario` e `identidade.sessao` vive em
 * `packages/db/src/administrador-do-master.ts`, publicada como função de domínio que **recebe** o
 * executor da transação. O que este arquivo faz é abrir a unidade de trabalho, encadear as chamadas
 * e traduzir o retorno delas em recusa HTTP.
 *
 * A razão por extenso — a **enumerabilidade** do alcance às tabelas de `identidade`, que a contenção
 * de tipo não garante porque ela não alcança texto de SQL — está no cabeçalho de
 * {@link ./empresa.service.js}, e vale aqui sem uma vírgula de diferença. Não é copiada: o original
 * é corrigido e a cópia não.
 *
 * **O contexto de tenant NÃO é escrito aqui**, pela mesma razão daquele arquivo: o Sysloc Master não
 * pertence a empresa alguma, a guarda publicou `empresaId: null`, e o identificador que estas rotas
 * recebem vem do **caminho da requisição** — derivar o contexto de RLS do pedido é literalmente o
 * mutante que o `CT-014` de `packages/db/test/unidade-de-trabalho.spec.ts` reprova, e o que a
 * ADR-0008 proíbe por escrito.
 *
 * ---------------------------------------------------------------------------
 * A UNIDADE DE TRABALHO ABRE AQUI, e não na borda
 * ---------------------------------------------------------------------------
 *
 * Divergência **deliberada** do molde das rotas da imobiliária, onde o controlador chama
 * `sobContextoDaSessao` e o serviço recebe o executor (decisão D1). Aquele molde existe para fixar
 * `app.empresa_id` a partir da sessão; aqui **não há tenant a fixar**, e a tech spec desta fatia
 * declara o fluxo no passo 3 da §5.1 — *"Serviço abre `emUnidadeDeTrabalho` (sem contexto de
 * tenant)"*. É também a forma literal de {@link ./empresa.service.js}, que é o irmão desta
 * superfície. Nada aqui abre unidade dentro de unidade: cada operação abre a sua, uma vez.
 *
 * ---------------------------------------------------------------------------
 * A SUSPENSÃO encerra na MESMA transação, e o encerramento roda SEMPRE
 * ---------------------------------------------------------------------------
 *
 * `definirAtivoDoAdministrador` e `encerrarSessoesDoAdministrador` correm na mesma unidade (RN-03,
 * RN-05). O encerramento **não** é condicionado a "a marca mudou": a repetição encontra zero sessões
 * porque a barreira de admissão já recusa quem está suspenso, e `sessoesEncerradas: 0` passa a ser
 * **fato medido** em vez de constante escrita num ramo. Condicioná-lo deixaria uma sessão viva
 * sempre que a suspensão fosse repetida sobre alguém que voltou a entrar entre as duas chamadas.
 *
 * ⚠️ **A reativação NÃO enfileira nada.** A de **Empresa** retoma as notícias bancárias retidas
 * (CA-10 da fatia `webhook-e-carne`); a de **Admin Empresa** não tem esse efeito — não há trabalho
 * retido por pessoa. Copiar o enfileiramento do irmão seria efeito que ninguém pediu.
 *
 * ---------------------------------------------------------------------------
 * O alcance é `ADMIN_EMPRESA`, e a barreira é DUPLA (RN-06)
 * ---------------------------------------------------------------------------
 *
 * A leitura prévia recusa o alvo de outro perfil com `422` nomeando `perfilDoAlvo` — e é por isso
 * que `lerAdministrador` **não** recorta por perfil: o recorte ali transformaria a recusa por perfil
 * num `404` indistinguível de "não existe", e o operador não saberia que errou de pessoa. A segunda
 * barreira é o `AND perfil = 'ADMIN_EMPRESA'` que vive **na instrução** de cada escrita, e ela fecha
 * a janela entre ler e escrever.
 */

import { Inject, Injectable } from '@nestjs/common';
import {
  type AcessoAoBanco,
  type AdministradorPersistido,
  alterarAdministrador,
  type ClasseDeImpedimento,
  definirAtivoDoAdministrador,
  type ElegibilidadeDeExclusao,
  elegibilidadeDeExclusaoDoAdministrador,
  encerrarSessoesDoAdministrador,
  excluirAdministrador,
  type JanelaDeAdministradores,
  lerAdministrador,
  listarAdministradoresDaEmpresa,
  localizarEmpresa,
  type PerfilDaPessoa,
} from '@sysloc/db';
import { CodigoErro, ErroDeAplicacao, type Logger } from '@sysloc/shared';
import type { TransactionSql } from 'postgres';
import { MENSAGEM_POR_CODIGO } from '../comum/filtro-excecao.js';
import { TOKEN_ACESSO_AO_NEGOCIO, TOKEN_LOGGER } from '../configuracao/ambiente.js';
import type {
  AdministradorAlterado,
  AdministradorDoContrato,
  JanelaDaListagem,
  PaginaDeAdministradores,
  ReativacaoDoAdministrador,
  RemocaoDoAdministrador,
  SuspensaoDoAdministrador,
} from './administrador.contrato.js';

/**
 * O único perfil que esta superfície alcança (ADR-0013, RN-06).
 *
 * Constante nomeada, e não literal repetido: ela decide **e** é publicada em `detalhes.perfilExigido`
 * na recusa — os dois lados são a mesma decisão, e dois literais ficariam livres para divergir.
 */
const PERFIL_GOVERNADO_PELO_MASTER = 'ADMIN_EMPRESA';

/** Nome de campo que a recusa por perfil e a da exclusão impedida nomeiam — o `:id` da rota. */
const CAMPO_DO_IDENTIFICADOR = 'id';

/** Nome de campo que a recusa por endereço já registrado nomeia. */
const CAMPO_DO_EMAIL = 'email';

/**
 * O motivo publicado quando o endereço da correção já pertence a outra pessoa (CA-11).
 *
 * Constante nomeada porque é contrato: o cliente ramifica sobre este valor. Ver
 * {@link recusaDeEmailEmUso} para por que o literal é o mesmo da admissão.
 */
// DÉBITO COM GATILHO — D19 · F7/T5 · registrado 2026-09-02
// (NÃO é uma `DECISÃO FECHADA`: ele agenda uma convergência, não protege o código abaixo.)
// O QUÊ: o literal `EMAIL_JA_REGISTRADO` tem TRÊS declarações de produção — `master/empresa.service.ts`,
//        `usuarios/usuario.service.ts` e esta —, todas no mesmo envelope
//        `{campo:'email', detalhes:{motivo:…}}`. É valor de CONTRATO: o cliente ramifica sobre ele em
//        três rotas, e três cópias são três chances de divergir.
// QUANDO FECHA: a primeira task autorizada a abrir `apps/api/src/usuarios/usuario.service.ts` por
//        outra razão. Aí o literal sobe para casa única e os três pontos passam a importá-lo.
// POR QUE NÃO AGORA: subi-lo hoje obrigaria a editar dois serviços que publicam rotas **entregues**,
//        sem defeito que o motive — a refatoração fora da causa-raiz que a §4.5 do Protocolo proíbe.
// ÍNDICE: docs/specs/features/painel-master-administradores/v1/_run/run-report.md §2, D19
const MOTIVO_DO_EMAIL_EM_USO = 'EMAIL_JA_REGISTRADO';

// ---------------------------------------------------------------------------------------------
// O contrato desta superfície vive em `./administrador.contrato.ts`
// ---------------------------------------------------------------------------------------------
//
// Os tipos que este serviço declara — a página, o item, a prévia de exclusão, os dois corpos de
// transição, os dados da correção cadastral e o corpo da remoção — são `z.infer` dos esquemas de
// lá, e **não** interfaces redigitadas aqui. A `Decision` da ADR-0016 enumera três derivados do
// esquema, e o do meio é justamente *"o tipo da resposta"*: enquanto ele foi escrito à mão, o
// documento publicado e o contrato real ficaram livres para divergir — e divergiram no primeiro
// dia, em `impedimentos`.
//
// O teto e o padrão de página moram lá pela mesma razão: são conteúdo do contrato (o cliente
// precisa saber onde a listagem recusa), e o esquema da janela os consome.

@Injectable()
export class AdministradorService {
  constructor(
    // A porta única para transação. É dela que sai o executor cru, e é ela que torna a marcação e o
    // encerramento um commit só.
    @Inject(TOKEN_ACESSO_AO_NEGOCIO) private readonly banco: AcessoAoBanco,
    @Inject(TOKEN_LOGGER) private readonly logger: Logger,
  ) {}

  /**
   * Lista os Admin Empresa de uma empresa, com a prévia de exclusão de cada um (US-01, US-07).
   *
   * A empresa é localizada **antes** da página: empresa inexistente responde `404`, e não uma página
   * vazia — uma lista vazia diria ao operador que a empresa existe e não tem administrador, que é
   * uma afirmação diferente e falsa.
   *
   * ⚠️ **Tudo corre numa unidade só, e a razão é a sonda.** `elegibilidadeDeExclusaoDoAdministrador`
   * executa o **próprio ato** dentro de um ponto de salvamento e o desfaz sempre (ADR-0030), de modo
   * que ela **exige** o executor de uma transação. Não há saída por leitura: a **ADR-0038** fixa que
   * o critério é a integridade referencial e *"nunca uma contagem"*, e o marcador `DECISÃO FECHADA`
   * de `IMPEDIMENTOS_DE_EXCLUSAO` (`@sysloc/db`) mede por quê — sob a política `FORCE` e com
   * `empresaId: null`, `count(*)` sobre `negocio` devolve **zero para uma empresa cheia**
   * (`CT-1204`). Trocar a prévia por contagem declararia excluível o que não é.
   *
   * ---------------------------------------------------------------------------
   * O que a sonda por item CUSTA, e o que ela NÃO faz — os dois números são medidos
   * ---------------------------------------------------------------------------
   *
   * Medido em 2026-09-02, em instância efêmera migrada, com uma empresa de 200 Admin Empresa
   * **elegíveis** — o caminho mais caro, em que o `DELETE` do ensaio remove de fato antes de a
   * sentinela desfazê-lo:
   *
   * 1. **Custo**: a unidade inteira (a página mais a sonda item a item) leva `674–885 ms` para 200
   *    itens, `167–181 ms` para 50 e `92–141 ms` para 25 — **linear em ~3,4 ms por item**. É por
   *    isso que o teto desta listagem é 50, e não os 200 herdados do irmão: a tabela completa e a
   *    razão estão no docblock de {@link ./administrador.contrato.js#MAIOR_PAGINA_DE_ADMINISTRADORES}.
   * 2. **Efeito sobre terceiros — MEDIDO, e menor do que a premissa herdada.** Com a unidade da
   *    listagem **ainda aberta** e 203 bloqueios de relação retidos pelo processo que a executa, a
   *    **entrada** de um administrador da própria página — o `INSERT` em `identidade.sessao`, que
   *    toma `FOR KEY SHARE` na linha da pessoa — **atravessou em 8 ms**. O controle positivo, no
   *    mesmo arranjo, discrimina: contra um `DELETE` **vivo** (sem retorno ao ponto de salvamento)
   *    na mesma linha, o mesmo `INSERT` esperou o teto inteiro e foi recusado com `55P03`
   *    (`lock_timeout`) após 5 014 ms. Ou seja: o desfazimento do ponto de salvamento **libera** o
   *    bloqueio de LINHA que o ensaio tomou, e o que fica retido até o commit são os de **relação**,
   *    que não conflitam com a entrada.
   *
   * ✅ **A divergência que este parágrafo declarava FOI FECHADA em 2026-09-02, nas duas pontas.** A
   * frase larga de `ensaiarExclusao` (*"`ROLLBACK TO SAVEPOINT` não libera bloqueios"*) foi precisada
   * em `packages/db/src/administrador-do-master.ts` para nomear a espécie — **relação** retém,
   * **linha** é liberado —, e o 2º `Cons` da **ADR-0038**, que carregava a mesma frase, ganhou emenda
   * na mesma passada, com o texto original preservado. **Não reponha a declaração de divergência**:
   * ela não tem mais objeto, e mantê-la faria o próximo leitor procurar em `@sysloc/db` uma frase que
   * já não está lá. A medição dos itens 1 e 2 acima é a fonte das três.
   *
   * As sondas correm **em sequência**, e não em lote paralelo: são pontos de salvamento aninhados na
   * **mesma** transação, e o driver serializa uma conexão — despachá-las juntas embaralharia os
   * pontos de salvamento de sondas diferentes.
   */
  async listar(empresaId: string, janela: JanelaDaListagem): Promise<PaginaDeAdministradores> {
    const pagina = await this.banco.emUnidadeDeTrabalho(async (tx) => {
      if ((await localizarEmpresa(tx, empresaId)) === undefined) {
        return undefined;
      }

      const { administradores, total } = await listarAdministradoresDaEmpresa(
        tx,
        empresaId,
        janela satisfies JanelaDeAdministradores,
      );

      const itens: AdministradorDoContrato[] = [];
      for (const administrador of administradores) {
        itens.push(
          paraContratoDoAdministrador(
            administrador,
            await elegibilidadeDeExclusaoDoAdministrador(tx, administrador.id),
          ),
        );
      }

      return { itens, total };
    });

    if (pagina === undefined) {
      throw naoEncontrado();
    }

    return {
      itens: pagina.itens,
      total: pagina.total,
      limite: janela.limite,
      deslocamento: janela.deslocamento,
    };
  }

  /**
   * Suspende o acesso do Admin Empresa e **encerra as sessões dele no mesmo ato** (US-03, RN-03).
   *
   * A operação é idempotente **sem ramo condicional**: a coluna é booleana, o `UPDATE` devolve a
   * linha em qualquer estado anterior, e o encerramento roda sempre. A segunda chamada responde o
   * mesmo corpo, diferindo apenas em `sessoesEncerradas`, que aí é zero — **medido**, e não escrito.
   *
   * O encerramento é **por pessoa**, e não por empresa: a colega ativa da mesma empresa continua
   * operando no mesmo instante (`CT-1223`). Uma implementação que alcançasse por empresa passaria em
   * toda asserção sobre a pessoa suspensa e reprovaria só ali.
   */
  async suspender(usuarioId: string, emitidaPor: string): Promise<SuspensaoDoAdministrador> {
    const sessoesEncerradas = await this.banco.emUnidadeDeTrabalho(async (tx) => {
      await this.exigirAdministrador(tx, usuarioId, emitidaPor);

      // O retorno da escrita é a **segunda barreira** da RN-06 falando: ela devolve `undefined`
      // quando o `AND perfil = 'ADMIN_EMPRESA'` da instrução não alcança linha alguma. Descartá-lo
      // tornaria a barreira inobservável — a rota responderia `200` sobre uma pessoa que não foi
      // marcada. Ela e a leitura acima correm na MESMA transação, então este ramo não é alcançável
      // hoje; ele existe para que deixar de ser inalcançável seja um `404`, e não um sucesso falso.
      if ((await definirAtivoDoAdministrador(tx, usuarioId, false)) === undefined) {
        throw naoEncontrado();
      }

      // MESMA transação da marcação, e **incondicional**: é isto que faz o encerramento acontecer na
      // origem do evento em vez de virar recusa avaliada depois, na guarda.
      return await encerrarSessoesDoAdministrador(tx, usuarioId);
    });

    this.logger.info(
      { usuarioId, emitidaPor, sessoesEncerradas },
      'administrador suspenso e sessões encerradas na origem do evento',
    );

    return { usuarioId, estado: 'SUSPENSO', sessoesEncerradas };
  }

  /**
   * Reativa o acesso do Admin Empresa (US-04, RN-04).
   *
   * **Ela devolve a capacidade de entrar, e não as sessões que a suspensão encerrou.** Não há o que
   * restaurar: a suspensão apagou os registros, e devolvê-los exigiria tê-los guardado — que é
   * precisamente a diferença entre "reativar o acesso" e "retomar o que estava em curso". Os cookies
   * anteriores seguem inválidos, e a pessoa entra de novo.
   *
   * ⚠️ **Nada é enfileirado.** Ver o cabeçalho: o efeito de retomada é da reativação de **Empresa**.
   */
  async reativar(usuarioId: string, emitidaPor: string): Promise<ReativacaoDoAdministrador> {
    await this.banco.emUnidadeDeTrabalho(async (tx) => {
      await this.exigirAdministrador(tx, usuarioId, emitidaPor);

      // Mesma leitura do retorno que a suspensão faz, e pela mesma razão — ver o docblock dela.
      if ((await definirAtivoDoAdministrador(tx, usuarioId, true)) === undefined) {
        throw naoEncontrado();
      }
    });

    this.logger.info({ usuarioId, emitidaPor }, 'administrador reativado pelo operador do SaaS');

    return { usuarioId, estado: 'ATIVO' };
  }

  /**
   * Corrige o cadastro do Admin Empresa — **nome e endereço, e nada além** (US-06, RN-08).
   *
   * ---------------------------------------------------------------------------
   * Ela alcança CADASTRO, nunca ESTADO
   * ---------------------------------------------------------------------------
   *
   * `estado`, `ativo`, `perfil` e `empresaId` não chegam aqui porque não existem no esquema de
   * entrada (ADR-0021, metade categórica) — a razão por extenso está no docblock de
   * {@link ./administrador.contrato.js#ESQUEMA_DO_ADMINISTRADOR_ALTERADO}. A consequência
   * observável é que editar quem está suspenso **não** o reativa, e editar quem está ativo não o
   * suspende: a coluna `ativo` não é tocada pela instrução, e o `estado` do corpo devolvido é
   * derivado dela, no ponto único de tradução.
   *
   * ⚠️ **A credencial sobrevive à troca de endereço**, e isso é propriedade do modelo, não desta
   * função: a conta ancora no `usuarioId`, de modo que a Senha provisória emitida antes da correção
   * continua valendo depois dela. Nada aqui toca `identidade.conta`.
   *
   * A colisão de endereço é decidida **pelo banco**, e nunca por uma leitura prévia: entre o
   * `SELECT` que não achasse e o `UPDATE`, outra transação grava. `alterarAdministrador` executa sob
   * ponto de salvamento e devolve `EMAIL_EM_USO`; aqui isso vira `422` nomeando o campo, **sem** que
   * o `detail` do driver — que carrega valores de chave — chegue perto da resposta.
   */
  async alterar(
    usuarioId: string,
    dados: AdministradorAlterado,
    emitidaPor: string,
  ): Promise<AdministradorDoContrato> {
    const item = await this.banco.emUnidadeDeTrabalho(async (tx) => {
      // PRIMEIRA barreira da RN-06, e ela roda ANTES da escrita: quando o alvo é de outro perfil,
      // a recusa sai daqui e nada foi gravado — a unidade é desfeita inteira.
      await this.exigirAdministrador(tx, usuarioId, emitidaPor);

      const desfecho = await alterarAdministrador(tx, usuarioId, dados);

      if (desfecho.desfecho === 'EMAIL_EM_USO') {
        throw recusaDeEmailEmUso();
      }

      // O `NAO_ALCANCADO` é a SEGUNDA barreira da RN-06 falando: o `AND perfil = 'ADMIN_EMPRESA'`
      // da instrução não alcançou linha alguma. Ele e a leitura acima correm na MESMA transação,
      // então este ramo não é alcançável hoje; ele existe para que deixar de ser inalcançável seja
      // um `404`, e não um `200` sobre uma pessoa que ninguém alterou.
      if (desfecho.desfecho === 'NAO_ALCANCADO') {
        throw naoEncontrado();
      }

      // A prévia de exclusão é composta na MESMA unidade, depois da escrita, e é o que faz a
      // resposta ser a linha inteira da listagem: o cliente substitui a linha que ele tem, em vez
      // de recompor um item a partir de duas formas diferentes do mesmo fato. A sonda desfaz o
      // próprio ensaio (ADR-0030); o `UPDATE` acima é anterior ao ponto de salvamento dela e
      // permanece.
      return paraContratoDoAdministrador(
        desfecho.administrador,
        await elegibilidadeDeExclusaoDoAdministrador(tx, usuarioId),
      );
    });

    this.logger.info(
      { usuarioId, emitidaPor },
      'cadastro de administrador corrigido pelo operador do SaaS',
    );

    return item;
  }

  /**
   * Remove o Admin Empresa **em definitivo** (US-08, ADR-0038).
   *
   * ---------------------------------------------------------------------------
   * A recusa nomeia a CLASSE — nunca a entidade, nunca a quantidade (RN-15, CA-20)
   * ---------------------------------------------------------------------------
   *
   * O impedimento chega aqui já traduzido em `ClasseDeImpedimento` por `@sysloc/db`, que o deriva do
   * par (`code`, `constraint_name`) do servidor. O `detail` do erro do driver — que carrega os
   * **valores** da chave recusada — não é lido, não é copiado e não é registrado: dizer *"3
   * contratos"* ou *"o contrato CTR-2026-00001"* seria dado de negócio numa persona que a ADR-0013
   * restringe ao que é dela, e o operador não precisa de nenhum dos dois para decidir. O que ele
   * precisa é da classe e da saída, e a saída é **executável**: `SUSPENSAO` nomeia a rota que este
   * mesmo serviço publica.
   *
   * ⚠️ **Falha fechada**: uma restrição que o vocabulário não classifique não vira "excluído" nem
   * "elegível" — `@sysloc/db` repassa o erro intacto e a operação vira falha. Traduzir `23503` em
   * bloco esconderia um defeito atrás de um `422` plausível.
   *
   * ---------------------------------------------------------------------------
   * O desfecho é VALOR, e a tradução acontece FORA da unidade
   * ---------------------------------------------------------------------------
   *
   * `excluirAdministrador` desfaz a recusa no próprio ponto de salvamento, de modo que a unidade
   * segue utilizável e comita **sem ter gravado nada**. Levantar a recusa daqui de dentro
   * funcionaria igual no efeito, mas trocaria o desenho que a T1 registrou por outro sem razão — e
   * o que a borda precisa decidir (qual código HTTP) não é assunto de dentro da transação.
   *
   * A recusa por **perfil**, essa sim, sai de dentro: ela é anterior ao ato, e é o que garante que
   * nada foi removido quando o alvo é um Usuário Empresa.
   */
  async excluir(usuarioId: string, emitidaPor: string): Promise<RemocaoDoAdministrador> {
    const desfecho = await this.banco.emUnidadeDeTrabalho(async (tx) => {
      await this.exigirAdministrador(tx, usuarioId, emitidaPor);

      return await excluirAdministrador(tx, usuarioId);
    });

    if (desfecho.desfecho === 'IMPEDIDO') {
      this.logger.info(
        { usuarioId, emitidaPor, impedimentos: desfecho.impedimentos },
        'a remoção definitiva do administrador foi recusada pela integridade referencial',
      );

      throw recusaDeExclusao(desfecho.impedimentos);
    }

    // Mesma segunda barreira da RN-06 das demais escritas — ver o docblock de `alterar`.
    if (desfecho.desfecho === 'NAO_ALCANCADO') {
      throw naoEncontrado();
    }

    this.logger.info(
      { usuarioId, emitidaPor },
      'administrador removido em definitivo pelo operador do SaaS',
    );

    return { usuarioId, removido: true };
  }

  /**
   * A leitura prévia do alvo — **primeira** barreira da RN-06.
   *
   * Ela recusa antes de qualquer escrita, e por isso a recusa por perfil **não deixa efeito**: nada
   * foi marcado e nenhuma sessão foi encerrada quando ela dispara. Levantar dentro da unidade é o
   * que garante isso mesmo se uma escrita fosse acrescentada acima dela um dia — a transação
   * desfaz-se inteira.
   *
   * Devolve nada de propósito: quem chama não precisa do alvo, e devolvê-lo convidaria a segunda
   * leitura do mesmo fato a nascer no chamador.
   */
  private async exigirAdministrador(
    tx: TransactionSql,
    usuarioId: string,
    emitidaPor: string,
  ): Promise<void> {
    const alvo = await lerAdministrador(tx, usuarioId);

    if (alvo === undefined) {
      this.logger.info(
        { usuarioId, emitidaPor },
        'o operador do SaaS alcançou um usuário inexistente',
      );

      throw naoEncontrado();
    }

    if (alvo.perfil !== PERFIL_GOVERNADO_PELO_MASTER) {
      throw recusaPorPerfil(alvo.perfil);
    }
  }
}

/**
 * Traduz a linha de `identidade.usuario` na forma do contrato.
 *
 * **Ponto único da derivação de `estado`** (§6.2): `ativo` é o fato gravado, `estado` é o que o
 * cliente lê. Duas traduções — uma na listagem, outra na transição — ficariam livres para divergir, e
 * as duas superfícies passariam a afirmar coisas diferentes sobre o mesmo fato. É o mesmo desenho, e
 * a mesma razão, de `paraContrato` em {@link ./empresa.service.js}.
 *
 * A elegibilidade entra por **parâmetro**, e não é lida aqui: esta função é pura, e a sonda precisa
 * de um executor de transação. Separá-las é o que permite ao caso de teste compor o item sem banco.
 */
export function paraContratoDoAdministrador(
  linha: AdministradorPersistido,
  elegibilidade: ElegibilidadeDeExclusao,
): AdministradorDoContrato {
  return {
    usuarioId: linha.id,
    nome: linha.nome,
    email: linha.email,
    estado: linha.ativo ? 'ATIVO' : 'SUSPENSO',
    criadoEm: linha.criadoEm.toISOString(),
    exclusao: elegibilidade.elegivel
      ? { disponivel: true, impedimentos: [] }
      : {
          disponivel: false,
          motivo: MOTIVO_DA_EXCLUSAO_IMPEDIDA,
          impedimentos: elegibilidade.impedimentos,
          alternativa: ALTERNATIVA_A_EXCLUSAO,
        },
  };
}

/**
 * O motivo publicado quando a remoção física está indisponível (US-10, §4.1.1).
 *
 * Ele nomeia a **classe do desfecho**, e o detalhe fica em `impedimentos`. Constante nomeada porque é
 * contrato: o cliente ramifica sobre este valor.
 */
const MOTIVO_DA_EXCLUSAO_IMPEDIDA = 'EXCLUSAO_IMPEDIDA_POR_REGISTROS';

/**
 * A saída que o produto oferece quando a exclusão está impedida (US-10, CA-14).
 *
 * Ela é **executável**: `SUSPENSAO` nomeia a rota que este mesmo serviço publica, e é isso que separa
 * uma recusa útil de uma recusa muda.
 */
const ALTERNATIVA_A_EXCLUSAO = 'SUSPENSAO';

/**
 * A recusa da correção cadastral cujo endereço já pertence a outra pessoa (CA-11, RN-15).
 *
 * O motivo é o **mesmo vocabulário** que a admissão já publica (`empresa.service.ts`,
 * `admitirAdministrador`), e a coincidência é deliberada: é o mesmo fato — *"este endereço já está
 * registrado"* — visto por rotas diferentes, e o cliente ramifica sobre o valor.
 *
 * ⚠️ **São TRÊS declarações do literal, e o Limiar de Três JÁ DISPAROU.** Medido em 2026-09-02
 * (`grep -rn "EMAIL_JA_REGISTRADO" apps/api/src`): `master/empresa.service.ts:626`,
 * `usuarios/usuario.service.ts:380` e esta — as três no mesmo envelope
 * `{campo:'email', detalhes:{motivo:'EMAIL_JA_REGISTRADO'}}`. Este docblock dizia *"são **duas**, e o
 * Limiar de Três não disparou"* até 2026-09-02, e a frase era **falsa**: o executor contou a vizinha
 * de quem copiou, não o conjunto — literalmente o modo de falha que a convenção do `CLAUDE.md`
 * descreve ao se enunciar. **Não reponha a contagem antiga**; ela é o que faria a **quarta** cópia
 * nascer com a mesma convicção. A extração segue adiada, e agora **por escopo, não por limiar** —
 * ver o marcador logo abaixo.
 *
 * ⚠️ **Nada do erro do driver entra aqui.** O `detail` do PostgreSQL carrega o **valor** da chave
 * recusada — isto é, o endereço da outra pessoa —, e ele não é lido, não é copiado e não é
 * registrado: quem decide o desfecho é `@sysloc/db`, pelo par (`code`, `constraint_name`), e o que
 * chega até aqui é um discriminante sem dado. O campo nomeado é o que o cliente precisa para
 * corrigir.
 */
function recusaDeEmailEmUso(): ErroDeAplicacao {
  return new ErroDeAplicacao(
    CodigoErro.CAMPO_INVALIDO,
    MENSAGEM_POR_CODIGO[CodigoErro.CAMPO_INVALIDO],
    { campo: CAMPO_DO_EMAIL, detalhes: { motivo: MOTIVO_DO_EMAIL_EM_USO } },
  );
}

/**
 * A recusa da remoção definitiva impedida pela integridade referencial (US-10, CA-17, RN-15).
 *
 * Ela nomeia **a classe, a lista de classes e a alternativa** — e é a MESMA tripla que a prévia da
 * listagem publica por item, composta pelas mesmas duas constantes. Duas triplas ficariam livres
 * para divergir, e o operador leria na prévia um motivo que a recusa não confirma.
 *
 * ⚠️ **Nunca a entidade, nunca a quantidade.** `impedimentos` carrega classes do vocabulário
 * fechado da RN-15; *"3 contratos"* ou *"o contrato CTR-2026-00001"* seriam dado de negócio numa
 * persona que a ADR-0013 restringe ao que é dela, e nada disso ajuda a decidir — o que decide é a
 * classe, e a saída é `alternativa`.
 */
function recusaDeExclusao(impedimentos: readonly ClasseDeImpedimento[]): ErroDeAplicacao {
  return new ErroDeAplicacao(
    CodigoErro.CAMPO_INVALIDO,
    MENSAGEM_POR_CODIGO[CodigoErro.CAMPO_INVALIDO],
    {
      campo: CAMPO_DO_IDENTIFICADOR,
      detalhes: {
        motivo: MOTIVO_DA_EXCLUSAO_IMPEDIDA,
        impedimentos,
        alternativa: ALTERNATIVA_A_EXCLUSAO,
      },
    },
  );
}

/** A recusa por ausência — a mesma para inexistente e para alcance nenhum, byte a byte. */
function naoEncontrado(): ErroDeAplicacao {
  return new ErroDeAplicacao(
    CodigoErro.RECURSO_NAO_ENCONTRADO,
    MENSAGEM_POR_CODIGO[CodigoErro.RECURSO_NAO_ENCONTRADO],
  );
}

// DÉBITO COM GATILHO — D8 · F7/T4 · registrado 2026-09-02
// (NÃO é uma `DECISÃO FECHADA`: ele agenda uma mudança, não protege o código abaixo.)
// O QUÊ: este envelope de recusa por perfil tem uma SEGUNDA cópia em `./empresa.service.ts`
//        (`EmpresaService.reemitirSenha`) — mesmo código, mesmo `campo`, mesmo par de chaves em
//        `detalhes`, e o mesmo literal `'ADMIN_EMPRESA'` declarado em constante própria de cada
//        arquivo. As duas concordam hoje e estão livres para divergir amanhã.
// QUANDO FECHA: a TERCEIRA cópia — a T5 desta fatia acrescenta duas rotas ao alcance da RN-06, e
//        elas consomem este mesmo ponto; a terceira nasce quando outra superfície do Master
//        precisar recusar por perfil. Aí o envelope sobe para casa única em `comum/`, com o perfil
//        exigido por parâmetro.
// POR QUE NÃO AGORA: são DUAS cópias, e o Limiar de Três do `CLAUDE.md` NÃO disparou. Subi-lo hoje
//        obrigaria a editar `empresa.service.ts`, que publica rota já congelada para o painel do
//        operador, sem defeito que o motive — o Protocolo Antirregressão proíbe refatorar fora da
//        causa-raiz.
// ÍNDICE: docs/specs/features/painel-master-administradores/v1/_run/run-report.md §2, D8
/**
 * A recusa de alvo cujo perfil está fora do alcance desta persona (RN-06, ADR-0013).
 *
 * Ela nomeia **o perfil exigido e o do alvo**, e é isso que a torna acionável: o operador descobre
 * que errou de pessoa, em vez de receber um `404` que ele leria como "não existe". O `422` é o código
 * do enum fechado da ADR-0017 — nenhum código novo nasce aqui.
 */
function recusaPorPerfil(perfilDoAlvo: PerfilDaPessoa): ErroDeAplicacao {
  return new ErroDeAplicacao(
    CodigoErro.CAMPO_INVALIDO,
    MENSAGEM_POR_CODIGO[CodigoErro.CAMPO_INVALIDO],
    {
      campo: CAMPO_DO_IDENTIFICADOR,
      detalhes: { perfilExigido: PERFIL_GOVERNADO_PELO_MASTER, perfilDoAlvo },
    },
  );
}
