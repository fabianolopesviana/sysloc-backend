/**
 * Ciclo de vida da empresa e **encerramento de sessões na origem do evento** (D5 do
 * tech-alignment).
 *
 * ---------------------------------------------------------------------------
 * Este serviço ORQUESTRA — ele não escreve consulta
 * ---------------------------------------------------------------------------
 *
 * Todas as instruções sobre `identidade.empresa`, `identidade.usuario` e `identidade.sessao` vivem
 * em `packages/db/src/empresa.ts`, publicadas como funções de domínio que **recebem** o executor da
 * transação. O que este arquivo faz é abrir a unidade de trabalho, encadear as chamadas e traduzir
 * ausência em recusa HTTP.
 *
 * **A razão é a enumerabilidade, e não estética.** A contenção que a §11.2 da tech spec da fatia
 * anterior descreve — *"`apps/api` não conhece `esquemaIdentidade` nem o construtor de consulta do
 * ORM"* — é uma restrição de **tipo**, e o cabeçalho de `packages/db/src/acesso-identidade.ts`
 * declara no item 3 que ela **não alcança texto de SQL**. Uma versão anterior deste serviço emitia
 * nove instruções nomeando tabelas e colunas físicas de `identidade` sem importar nada de proibido:
 * a letra da contenção continuava satisfeita e o propósito dela caía, porque o alcance às sete
 * tabelas deixava de ser enumerável e o nome físico da coluna passava a existir numa segunda
 * camada, sem cobertura de tipo — uma migração que renomeasse `suspensa_em` compilaria e falharia
 * em execução.
 *
 * O que fecha a classe não é tirar as nove instruções deste arquivo: é não haver **onde** escrever
 * a décima. Com as operações publicadas por `@sysloc/db`, `apps/api/src` volta a ter zero SQL, e a
 * auditoria do alcance a `identidade` cabe num grep.
 *
 * Uma consequência permanece, e continua deliberada: **o contexto de tenant NÃO é escrito aqui.** O
 * Sysloc Master não pertence a empresa alguma, a guarda já publicou `empresaId: null` para a
 * requisição dele, e a unidade de trabalho emite `SET LOCAL app.empresa_id = ''`. Nada neste
 * arquivo chama `contextoDeTenant.executarCom` — e não pode chamar: o identificador da empresa
 * desta rota vem do **caminho da requisição**, e derivar o contexto de RLS do pedido é literalmente
 * o mutante que o `CT-014` de `packages/db/test/unidade-de-trabalho.spec.ts` reprova, e o que a
 * ADR-0008 proíbe por escrito (*"sua origem nunca é o request"*).
 *
 * ---------------------------------------------------------------------------
 * A suspensão ENCERRA; ela não marca para recusar depois
 * ---------------------------------------------------------------------------
 *
 * `encerrarSessoesDaEmpresa`, de `@sysloc/db`, apaga os registros de sessão de todas as pessoas da
 * empresa na **mesma transação** em que a marca é gravada. A alternativa — marcar a empresa e
 * recusar na guarda a cada requisição — foi rejeitada pela decisão D5, e por duas razões: ela
 * criaria a **segunda definição de recusa** ao lado da barreira única de admissão (contra a qual o
 * cabeçalho de `apps/api/src/autenticacao/contexto.guard.ts` adverte literalmente), e manteria a
 * sessão de pé, o que contraria a RN-04 — *"quem estava dentro é recusado na operação seguinte"*.
 *
 * É por isso que o corpo da resposta publica `sessoesEncerradas`: o número é a evidência de que o
 * encerramento aconteceu no ato, e é ele que o `CT-224` assere indo de dois a zero.
 *
 * **A reativação não devolve sessão** (RN-05): ela limpa a marca e nada mais. Quem estava dentro
 * entra de novo — e é isso, e não a restauração do que foi apagado, que a `CA-05` pede.
 *
 * ---------------------------------------------------------------------------
 * CRITÉRIO DE NOME DOS TIPOS DE BORDA — distinção por CAMADA (D36)
 * ---------------------------------------------------------------------------
 *
 * **Tipo de borda que espelha um tipo de `@sysloc/db` recebe nome que nomeia a OPERAÇÃO desta
 * camada, nunca o mesmo nome do tipo de dados.** `JanelaDaListagem` (borda) × `JanelaDeEmpresas`
 * (dados) já era o precedente; `EmpresaDaAdmissao` (borda) × `EmpresaNova` (dados) passou a segui-lo.
 *
 * A razão é concreta e foi medida: enquanto o par `EmpresaNova`/`EmpresaNova` existia com nome e
 * forma idênticos dos dois lados, bastava alguém acrescentar `EmpresaNova` à lista de importações de
 * `@sysloc/db` — que já traz dez símbolos — para haver colisão de identificador num arquivo que hoje
 * compila. E, com dois precedentes contrários no mesmo arquivo, a camada seguinte escolheria
 * qualquer um dos dois, deixando a superfície com as duas convenções misturadas.
 *
 * **As sete rotas de `apps/api/src/usuarios/` herdam este critério** — `PessoaDaCriacao` (borda) ×
 * `PessoaPersistida` (dados) e `JanelaDaListagem` (borda) × `JanelaDePessoas` (dados) nascem por
 * ele, e não por imitação de um dos dois lados.
 *
 * ---------------------------------------------------------------------------
 * A Senha provisória em texto existe apenas no valor de retorno
 * ---------------------------------------------------------------------------
 *
 * Herdado da T6, e reafirmado aqui porque este arquivo é o primeiro consumidor de produção das duas
 * funções que a emitem: ela **não** é registrada, **não** é persistida em texto e **não** é ecoada
 * por consulta posterior. O que vai para o registro estruturado é a autoria da emissão
 * (`usuarioId` e `emitidaPor`, §13.1), que é a mitigação nomeada pela **ADR-0013** — o poder de
 * emitir credencial é distinto da garantia sobre a sessão do operador, e o que a criptografia não
 * impede a trilha torna reconstituível.
 *
 * A mesma ADR fixa a contenção do alcance: **a reemissão pelo Master alcança apenas
 * `ADMIN_EMPRESA`**, e alvo de outro perfil é recusado com `422`. Não é preferência — é o que
 * encurta o caminho entre o operador do SaaS e uma sessão de usuário comum.
 */

import { Inject, Injectable } from '@nestjs/common';
import {
  type Autenticacao,
  criarPessoa,
  type PessoaCriada,
  reemitirSenhaProvisoria,
} from '@sysloc/auth';
import {
  type AcessoAIdentidade,
  type AcessoAoBanco,
  admitirEmpresa,
  type EmpresaPersistida,
  encerrarSessoesDaEmpresa,
  lerAlvoDeReemissao,
  listarEmpresas,
  localizarEmpresa,
  localizarPessoaPorEmail,
  reativarEmpresa,
  suspenderEmpresa,
} from '@sysloc/db';
import { CodigoErro, ErroDeAplicacao, type Logger } from '@sysloc/shared';
import { MENSAGEM_POR_CODIGO } from '../comum/filtro-excecao.js';
import {
  TOKEN_ACESSO_A_IDENTIDADE,
  TOKEN_ACESSO_AO_NEGOCIO,
  TOKEN_AUTENTICACAO,
  TOKEN_LOGGER,
} from '../configuracao/ambiente.js';

/**
 * O perfil que o Master admite, e o **único** alvo que ele pode reemitir (ADR-0013, §11.2).
 *
 * Constante nomeada, e não literal repetido nos dois pontos: os dois são a mesma decisão vista de
 * dois lados — quem o Master cria é quem ele pode socorrer —, e escrevê-la duas vezes deixaria os
 * dois lados livres para divergir.
 */
const PERFIL_ADMITIDO_PELO_MASTER = 'ADMIN_EMPRESA';

/** Maior página que a listagem devolve. Pedido acima disso é recusado, nunca truncado em silêncio. */
export const MAIOR_PAGINA_DE_EMPRESAS = 200;

/** Tamanho de página quando quem chama não declara um. */
export const PAGINA_PADRAO_DE_EMPRESAS = 50;

/**
 * Os dois estados publicados de uma empresa.
 *
 * **Calculado no servidor a partir de `suspensa_em`** (ADR-0012, terceira regra de forma), e não
 * uma coluna própria: duas fontes para o mesmo fato divergem, e o cliente não deriva estado.
 */
export type EstadoDaEmpresa = 'ATIVA' | 'SUSPENSA';

/**
 * A empresa como o contrato a publica (§4.2).
 *
 * **O conjunto de chaves é fechado, e é isso que a RN-13 exige** — a listagem devolve identificação
 * e estado, e nenhum dado de negócio de empresa alguma. O `CT-226` assere as cinco chaves por
 * igualdade profunda, de modo que um campo acrescentado aqui reprova antes de vazar.
 *
 * `id` é UUID porque empresa é entidade de **identidade**, e não de negócio tenantizado — a
 * ADR-0012 fixa a fronteira e a razão: não há código legível a preservar, e a interface a
 * identifica pelo nome.
 */
export interface EmpresaDoContrato {
  readonly id: string;
  readonly nome: string;
  readonly documento: string;
  readonly estado: EstadoDaEmpresa;
  /** Instante da criação, em ISO-8601. */
  readonly criadaEm: string;
}

/** A página de empresas, na forma canônica de lista da ADR-0012. */
export interface PaginaDeEmpresas {
  readonly itens: readonly EmpresaDoContrato[];
  readonly total: number;
  readonly limite: number;
  readonly deslocamento: number;
}

/** O que a suspensão devolve — o estado novo mais a **prova** do encerramento. */
export interface SuspensaoDaEmpresa {
  readonly id: string;
  readonly estado: 'SUSPENSA';
  /** Instante da suspensão, em ISO-8601. Preservado na repetição (idempotência da §9.2). */
  readonly suspensaEm: string;
  /** Quantos registros de sessão foram apagados **neste ato**. Zero na repetição. */
  readonly sessoesEncerradas: number;
}

/** O que a reativação devolve. Ela limpa a marca e nada mais (RN-05). */
export interface ReativacaoDaEmpresa {
  readonly id: string;
  readonly estado: 'ATIVA';
}

/** O que a admissão de administrador devolve. A senha em texto existe aqui, e em nenhum outro lugar. */
export interface AdministradorAdmitido {
  readonly usuarioId: string;
  readonly email: string;
  /** A Senha provisória em texto, entregue **uma única vez** (RN-07). */
  readonly senhaProvisoria: string;
}

/** O que a reemissão devolve. Não é idempotente por natureza (§9.2, RN-09). */
export interface SenhaProvisoriaReemitida {
  readonly usuarioId: string;
  /** A Senha provisória nova, em texto, entregue **uma única vez**. */
  readonly senhaProvisoria: string;
}

/** Os campos que o corpo da criação de empresa carrega, já validados na borda. */
export interface EmpresaDaAdmissao {
  readonly nome: string;
  readonly documento: string;
}

/** Os campos que o corpo da admissão de administrador carrega, já validados na borda. */
export interface AdministradorNovo {
  readonly nome: string;
  readonly email: string;
}

/** A janela pedida da listagem, já validada na borda. */
export interface JanelaDaListagem {
  readonly limite: number;
  readonly deslocamento: number;
}

@Injectable()
export class EmpresaService {
  constructor(
    // A porta única para transação. Ver o cabeçalho: é dela que sai o executor cru, e é ela que
    // torna a marcação e o encerramento um commit só.
    @Inject(TOKEN_ACESSO_AO_NEGOCIO) private readonly banco: AcessoAoBanco,
    // O acesso restrito a `identidade` entra APENAS para ser repassado às duas funções de
    // onboarding de `@sysloc/auth`, que o exigem por assinatura. Nenhuma consulta é escrita com ele
    // neste arquivo — nem com ele, nem com o executor da unidade de trabalho: o que este serviço
    // conhece é a função de `@sysloc/db`, não o schema.
    @Inject(TOKEN_ACESSO_A_IDENTIDADE) private readonly acesso: AcessoAIdentidade,
    @Inject(TOKEN_AUTENTICACAO) private readonly autenticacao: Autenticacao,
    @Inject(TOKEN_LOGGER) private readonly logger: Logger,
  ) {}

  /**
   * Registra uma empresa nova, ativa (US-01).
   *
   * A duplicidade de documento é decidida **pelo banco**, e não por uma consulta prévia — a razão
   * está no docblock de `admitirEmpresa`, em `@sysloc/db`, junto do `ON CONFLICT` que a nomeia. Aqui
   * o que existe é a tradução: **ausência de linha é documento repetido**, e é o `422` do contrato.
   */
  async admitirEmpresa(entrada: EmpresaDaAdmissao): Promise<EmpresaDoContrato> {
    const linha = await this.banco.emUnidadeDeTrabalho(
      async (tx) => await admitirEmpresa(tx, entrada),
    );

    if (linha === undefined) {
      throw new ErroDeAplicacao(
        CodigoErro.CAMPO_INVALIDO,
        MENSAGEM_POR_CODIGO[CodigoErro.CAMPO_INVALIDO],
        { campo: 'documento', detalhes: { motivo: 'DOCUMENTO_JA_REGISTRADO' } },
      );
    }

    this.logger.info({ empresaId: linha.id }, 'empresa admitida pelo operador do SaaS');

    return paraContrato(linha);
  }

  /**
   * Lista as empresas com o estado corrente de cada uma (US-06).
   *
   * A página e o total saem da **mesma transação** — e a projeção é a das cinco chaves do contrato,
   * e nada mais (RN-13). As duas propriedades são da consulta, e vivem com ela em `@sysloc/db`.
   *
   * O que é desta camada é o **envelope**: a janela devolvida é a que foi de fato servida, e não um
   * eco do que o cliente pediu — os dois valores são os mesmos que a consulta recebeu.
   */
  async listarEmpresas(janela: JanelaDaListagem): Promise<PaginaDeEmpresas> {
    const { empresas, total } = await this.banco.emUnidadeDeTrabalho(
      async (tx) => await listarEmpresas(tx, janela),
    );

    return {
      itens: empresas.map(paraContrato),
      total,
      limite: janela.limite,
      deslocamento: janela.deslocamento,
    };
  }

  /**
   * Admite um administrador para a empresa, com Senha provisória (US-02 e US-07).
   *
   * A mesma rota atende o primeiro Admin e o **socorro** de uma empresa cujo único Admin está
   * desativado: são a mesma operação, e separá-las em duas rotas criaria duas definições de
   * "admitir administrador" livres para divergir.
   *
   * ---------------------------------------------------------------------------
   * A ordem existe para que nada precise ser desfeito
   * ---------------------------------------------------------------------------
   *
   * Tudo que pode recusar acontece **antes** de `criarPessoa`: a empresa é localizada e o endereço
   * é conferido dentro de uma transação de leitura; só então a pessoa nasce. Isso importa porque a
   * compensação de `criarPessoa` alcança apenas os passos internos dela — o que este serviço fizesse
   * **depois** do retorno ficaria fora da rede, e uma falha ali recriaria a linha órfã e **queimaria
   * o endereço**, que é único e não tem rota de exclusão nesta fatia.
   *
   * Por isso não há passo posterior algum: depois de `criarPessoa` só resta montar a resposta.
   *
   * ---------------------------------------------------------------------------
   * O vínculo de acesso NÃO é gravado aqui — e a razão é a ADR-0008
   * ---------------------------------------------------------------------------
   *
   * `negocio.acesso_usuario_app` está sob RLS forçada, e gravar a linha exigiria fixar
   * `app.empresa_id` com o identificador que **veio do caminho da requisição** — exatamente a
   * origem que a ADR-0008 proíbe (*"sua origem nunca é o request"*) e o mutante que o `CT-014`
   * reprova. O efetivo do Admin não depende dele: sem ajustes individuais, o efetivo é a matriz do
   * perfil, que para `ADMIN_EMPRESA` é o catálogo inteiro.
   *
   * **A consequência da omissão foi fechada pela T8, e não por aqui.** Enquanto o vínculo não
   * existisse, o Admin admitido nesta rota ficaria fora do alcance de toda operação que chega a uma
   * pessoa *pelo* vínculo — nenhum colega conseguiria ajustar as permissões dele, trocar o perfil
   * dele nem **revogar o acesso dele**. Quem o cria é `garantirVinculoDeAcesso`
   * (`packages/db/src/pessoa.ts`), chamada pelas rotas de `/v1/usuarios` sob o contexto que a guarda
   * publica **a partir da sessão** — nunca a partir do caminho da requisição, e por isso a origem
   * proibida nunca entra em cena.
   *
   * A metade que importa para esta rota é a do **alvo**: `UsuarioService.sobreAPessoa` garante o
   * vínculo da pessoa alcançada por qualquer uma das cinco rotas de `:id`, de modo que o Admin
   * admitido aqui é administrável por um colega **sem que ele mesmo precise agir antes**. A garantia
   * de "quem age", sozinha, não cobria este caso: entrar e trocar a Senha provisória não passam por
   * aquele serviço, e a pessoa admitida por esta rota podia permanecer inalcançável — visível na
   * listagem e `404` nas cinco rotas — por tempo indeterminado. Era o débito `D32 · F1/T7`, e o
   * marcador saiu no commit da correção.
   */
  async admitirAdministrador(
    empresaId: string,
    entrada: AdministradorNovo,
    emitidaPor: string,
  ): Promise<AdministradorAdmitido> {
    await this.banco.emUnidadeDeTrabalho(async (tx) => {
      if ((await localizarEmpresa(tx, empresaId)) === undefined) {
        throw new ErroDeAplicacao(
          CodigoErro.RECURSO_NAO_ENCONTRADO,
          MENSAGEM_POR_CODIGO[CodigoErro.RECURSO_NAO_ENCONTRADO],
        );
      }

      if ((await localizarPessoaPorEmail(tx, entrada.email)) !== undefined) {
        throw new ErroDeAplicacao(
          CodigoErro.CAMPO_INVALIDO,
          MENSAGEM_POR_CODIGO[CodigoErro.CAMPO_INVALIDO],
          { campo: 'email', detalhes: { motivo: 'EMAIL_JA_REGISTRADO' } },
        );
      }
    });

    const criada: PessoaCriada = await criarPessoa(this.autenticacao, this.acesso.identidade, {
      nome: entrada.nome,
      email: entrada.email,
      // Os dois são **decididos pelo servidor**, e é por isso que eles não aparecem no corpo da
      // requisição: o perfil é fixo por decisão da ADR-0013 (o Master admite administrador, e nada
      // além disso), e a empresa é a do caminho da rota. Aceitá-los do corpo seria a elevação de
      // privilégio e a fuga de tenant que o D7 fechou.
      perfil: PERFIL_ADMITIDO_PELO_MASTER,
      empresaId,
    });

    // A autoria da emissão, e **nunca** a senha (§13.1, ADR-0013). É esta linha que torna "o Master
    // emitiu e alguém entrou" uma sequência legível na trilha, em vez de um vazio.
    this.logger.info(
      { usuarioId: criada.usuarioId, empresaId, emitidaPor },
      'senha provisória emitida na admissão de administrador',
    );

    return {
      usuarioId: criada.usuarioId,
      email: entrada.email,
      senhaProvisoria: criada.senhaProvisoria,
    };
  }

  /**
   * Suspende a empresa e **encerra as sessões no mesmo ato** (US-04, RN-04).
   *
   * `coalesce(suspensa_em, now())` é o que torna a repetição idempotente **sem um ramo condicional
   * escrito aqui**: a empresa já suspensa conserva o instante original, de modo que a segunda
   * chamada devolve o mesmo corpo (§9.2). Um `WHERE suspensa_em IS NULL` devolveria zero linhas na
   * repetição e obrigaria uma segunda leitura para distinguir "já suspensa" de "não existe" — dois
   * caminhos para o mesmo fato.
   *
   * O encerramento roda **sempre**, e não apenas quando a marca é nova: a repetição encontra zero
   * sessões porque a barreira de admissão já recusa a entrada de quem é da empresa suspensa, e
   * `sessoesEncerradas: 0` passa a ser um fato medido em vez de uma constante escrita no ramo.
   */
  async suspender(empresaId: string): Promise<SuspensaoDaEmpresa> {
    const suspensao = await this.banco.emUnidadeDeTrabalho(async (tx) => {
      const marcada = await suspenderEmpresa(tx, empresaId);

      if (marcada === undefined) {
        return undefined;
      }

      // MESMA transação da marcação — é isto, e só isto, que faz o encerramento acontecer "na
      // origem do evento" em vez de virar recusa avaliada depois, na guarda (D5).
      const sessoesEncerradas = await encerrarSessoesDaEmpresa(tx, empresaId);

      return { id: marcada.id, suspensaEm: marcada.suspensaEm, sessoesEncerradas };
    });

    if (suspensao === undefined) {
      throw new ErroDeAplicacao(
        CodigoErro.RECURSO_NAO_ENCONTRADO,
        MENSAGEM_POR_CODIGO[CodigoErro.RECURSO_NAO_ENCONTRADO],
      );
    }

    this.logger.info(
      { empresaId: suspensao.id, sessoesEncerradas: suspensao.sessoesEncerradas },
      'empresa suspensa e sessões encerradas na origem do evento',
    );

    return {
      id: suspensao.id,
      estado: 'SUSPENSA',
      suspensaEm: suspensao.suspensaEm.toISOString(),
      sessoesEncerradas: suspensao.sessoesEncerradas,
    };
  }

  /**
   * Reativa a empresa (US-05).
   *
   * **Ela limpa a marca e nada mais** (RN-05). Não há restauração de sessão porque não há o que
   * restaurar: a suspensão apagou os registros, e devolvê-los exigiria tê-los guardado — que é
   * precisamente a diferença entre "reativar o acesso" e "retomar o que estava em curso". Quem
   * estava dentro entra de novo.
   */
  async reativar(empresaId: string): Promise<ReativacaoDaEmpresa> {
    const reativada = await this.banco.emUnidadeDeTrabalho(
      async (tx) => await reativarEmpresa(tx, empresaId),
    );

    if (reativada === undefined) {
      throw new ErroDeAplicacao(
        CodigoErro.RECURSO_NAO_ENCONTRADO,
        MENSAGEM_POR_CODIGO[CodigoErro.RECURSO_NAO_ENCONTRADO],
      );
    }

    this.logger.info({ empresaId: reativada }, 'empresa reativada pelo operador do SaaS');

    return { id: reativada, estado: 'ATIVA' };
  }

  /**
   * Reemite a Senha provisória de um administrador (US-03).
   *
   * **O alvo é restrito a `ADMIN_EMPRESA`** (ADR-0013, §11.2). Alvo de outro perfil é recusado com
   * `422`, e a recusa nomeia o perfil exigido — o Master não tem caminho direto para uma sessão de
   * `Usuario Empresa`. A contenção não elimina a propriedade (quem emite credencial pode usá-la),
   * mas encurta o caminho, e é isso que a ADR declara.
   *
   * A invalidação da senha anterior **não** é um passo à parte: `reemitirSenhaProvisoria` reescreve
   * a derivação da conta local, e a anterior deixa de derivar naquele mesmo `UPDATE`. Quem a tentar
   * recebe a recusa indistinguível de credencial incorreta (RN-09/RN-10) — porque é literalmente o
   * que ela passou a ser.
   */
  async reemitirSenha(usuarioId: string, emitidaPor: string): Promise<SenhaProvisoriaReemitida> {
    const alvo = await this.banco.emUnidadeDeTrabalho(
      async (tx) => await lerAlvoDeReemissao(tx, usuarioId),
    );

    if (alvo === undefined) {
      throw new ErroDeAplicacao(
        CodigoErro.RECURSO_NAO_ENCONTRADO,
        MENSAGEM_POR_CODIGO[CodigoErro.RECURSO_NAO_ENCONTRADO],
      );
    }

    if (alvo.perfil !== PERFIL_ADMITIDO_PELO_MASTER) {
      throw new ErroDeAplicacao(
        CodigoErro.CAMPO_INVALIDO,
        MENSAGEM_POR_CODIGO[CodigoErro.CAMPO_INVALIDO],
        {
          campo: 'id',
          detalhes: { perfilExigido: PERFIL_ADMITIDO_PELO_MASTER, perfilDoAlvo: alvo.perfil },
        },
      );
    }

    const senhaProvisoria = await reemitirSenhaProvisoria(
      this.autenticacao,
      this.acesso.identidade,
      { usuarioId, nome: alvo.nome, email: alvo.email },
    );

    this.logger.info({ usuarioId, emitidaPor }, 'senha provisória reemitida pelo operador do SaaS');

    return { usuarioId, senhaProvisoria };
  }
}

/**
 * Traduz a linha de `identidade.empresa` na forma do contrato.
 *
 * **Ponto único da derivação do estado.** `suspensa_em` é o fato gravado; `estado` é o que o
 * cliente lê. Duas traduções — uma na listagem, outra na criação — ficariam livres para divergir, e
 * a ADR-0012 é literal em que `status` é calculado no servidor.
 */
function paraContrato(linha: EmpresaPersistida): EmpresaDoContrato {
  return {
    id: linha.id,
    nome: linha.nome,
    documento: linha.documento,
    estado: linha.suspensaEm === null ? 'ATIVA' : 'SUSPENSA',
    criadaEm: linha.criadaEm.toISOString(),
  };
}
