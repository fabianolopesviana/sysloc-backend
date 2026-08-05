/**
 * Ciclo de vida das pessoas da própria empresa — o que as **sete rotas do Admin** orquestram.
 *
 * ---------------------------------------------------------------------------
 * Este serviço ORQUESTRA — ele não escreve consulta
 * ---------------------------------------------------------------------------
 *
 * Todas as instruções sobre `identidade.usuario`, `identidade.sessao` e
 * `negocio.acesso_usuario_app` vivem em `packages/db/src/pessoa.ts`, e as de ajuste de permissão em
 * `packages/db/src/permissao.ts` — publicadas como funções de domínio que **recebem** o executor da
 * transação. O que este arquivo faz é abrir a unidade de trabalho, encadear as chamadas e traduzir
 * ausência em recusa HTTP. A razão é a enumerabilidade, e está por extenso no cabeçalho de
 * `apps/api/src/master/empresa.service.ts`: a contenção da §11.2 é de **tipo** e não alcança texto
 * de SQL, de modo que o que a mantém viva é não haver **onde** escrever a instrução.
 *
 * Os nomes dos tipos de borda seguem o critério registrado naquele mesmo cabeçalho (D36):
 * `PessoaDaCriacao` (borda) × `PessoaPersistida` (dados), `JanelaDaListagem` (borda) ×
 * `JanelaDePessoas` (dados). Ele é herdado **explicitamente**, e não por imitação de um dos lados.
 *
 * ---------------------------------------------------------------------------
 * A FRONTEIRA DE TENANT NÃO É ESCRITA AQUI — e é isso que o CT-230 mede
 * ---------------------------------------------------------------------------
 *
 * Não existe, em lugar algum deste arquivo, uma comparação de empresa. Não há `if (pessoa.empresaId
 * !== sessao.empresaId)`, e não há `empresaId` viajando como argumento para consulta alguma: as
 * cinco rotas de `:id` resolvem a pessoa por {@link localizarPessoaDoContexto}, que a alcança
 * **pelo vínculo de acesso** — tenantizado e sob RLS forçada. Sob o contexto da empresa A, o vínculo
 * de B não existe, a resolução devolve `undefined`, e a rota responde `404 RECURSO_NAO_ENCONTRADO`
 * **porque não achou**, não porque comparou.
 *
 * A distinção não é retórica, e o `CT-230` foi desenhado para não aceitar a versão retórica: uma
 * implementação que comparasse empresa e devolvesse `403` passaria numa asserção de status, então o
 * caso assere o **corpo inteiro** da recusa e o **estado inalterado** da pessoa de B, antes e
 * depois. É a ADR-0008 em forma de teste — *"sua origem nunca é o request"*, e o filtro de aplicação
 * ao lado da política é o que ela rejeita por escrito.
 *
 * O contexto que a política consome vem da **sessão**, publicado pela guarda; este serviço apenas
 * abre a unidade de trabalho dentro dele. Nada aqui chama `contextoDeTenant.executarCom` — e não
 * pode chamar: seria a segunda origem de contexto, e a única legítima é a que a guarda derivou.
 *
 * ---------------------------------------------------------------------------
 * A ORDEM DE CADA OPERAÇÃO É FAIL-CLOSED — resolver antes de escrever
 * ---------------------------------------------------------------------------
 *
 * A propriedade é *"nenhuma rota de `:id` escreve antes de saber que alcança a pessoa"*, e ela é
 * obtida em **duas formas**, ambas corretas. Confundi-las é o que faz alguém "uniformizar" a segunda
 * na primeira e trocar uma garantia estrutural por uma sequência de passos:
 *
 *   1. **Resolver e só então escrever** — a forma de {@link UsuarioService.ajustarPermissoes},
 *      {@link UsuarioService.trocarPerfil} e {@link UsuarioService.reemitirSenha}, que chamam
 *      {@link UsuarioService.exigirPessoaDoContexto} antes de qualquer escrita. Elas precisam do
 *      **dado** da pessoa (o perfil, o nome, o endereço) ou de uma decisão que depende dele;
 *   2. **Resolver E escrever na MESMA instrução** — a forma de {@link UsuarioService.desativar} e
 *      {@link UsuarioService.reativar}, que vão direto a `definirAtivoDaPessoa`: ali o alcance é o
 *      `FROM negocio.acesso_usuario_app` do próprio `UPDATE`, e a pessoa inalcançável produz zero
 *      linhas afetadas — `undefined` — sem que escrita alguma tenha acontecido. Resolver antes seria
 *      uma segunda consulta que não fecha janela nenhuma e abre uma corrida entre as duas.
 *
 * **Qual delas vale para um manipulador novo**: a forma 2 quando a operação inteira couber numa
 * instrução cujo alcance passe pelo vínculo; a forma 1 em todo o resto — e, na dúvida, a forma 1,
 * que é a conservadora. O que **não** é opcional é abrir a unidade por
 * {@link UsuarioService.sobreAPessoa}, que é onde o alcance ao alvo é estabelecido.
 *
 * A troca de perfil leva a forma 1 um passo adiante — ela conta os ajustes e recusa por falta de
 * intenção declarada **antes** de tocar em perfil, ajuste ou contador —, e é por isso que o `CT-231`
 * assere as **três** dimensões inalteradas na recusa: verificar só o perfil deixaria passar uma
 * implementação que remove os ajustes e só então valida.
 *
 * ---------------------------------------------------------------------------
 * O ponto único de entrada na unidade de trabalho, e o que ele garante (D32)
 * ---------------------------------------------------------------------------
 *
 * As sete operações passam por {@link UsuarioService.sobContextoDaSessao}, e nenhuma abre unidade
 * por conta própria. Ele faz duas coisas, nesta ordem:
 *
 *   1. **recusa a sessão sem empresa** — o Sysloc Master não alcança estas rotas (a matriz dele é
 *      vazia, ADR-0011), e chegar aqui com `empresaId` nulo é defeito de composição, não pedido
 *      inválido: a resposta é `ERRO_INTERNO`, pela mesma postura de `sessaoDaRequisicao`;
 *   2. **garante o vínculo de quem age**, idempotente. Aqui o contexto veio da sessão, e a empresa
 *      de quem age **é** o contexto por construção: a guarda derivou o contexto da linha dessa mesma
 *      pessoa.
 *
 * As cinco rotas de `:id` passam por um segundo ponto único, {@link UsuarioService.sobreAPessoa},
 * que encapsula o primeiro e acrescenta **duas** garantias próprias do alvo:
 *
 *   1. **a recusa do AUTO-ALVO** — quem age não é alvo de rota de `:id` alguma. Sem ela, a
 *      concessão individual de `TELA:usuarios` a uma pessoa qualquer virava escalada de privilégio
 *      dentro da empresa, por **dois** caminhos independentes (a troca do próprio perfil e o ajuste
 *      das próprias permissões);
 *   2. **o vínculo do ALVO**, que fecha o `D32 · F1/T7` para quem a rota do Master criou e ainda não
 *      agiu — o caso que a garantia de quem age **não** alcança, porque entrar e trocar a senha não
 *      passam por este serviço e portanto não estabelecem contexto de tenant.
 *
 * As duas moram no mesmo ponto pela mesma razão, e ela está escrita no marcador `DECISÃO FECHADA`
 * daquele método: cada um dos dois defeitos alcançava **duas** rotas, e fechar a rota apontada
 * deixava a outra aberta. O recorte que preserva a fronteira de tenant está no docblock de
 * `garantirVinculoDeAcesso`.
 *
 * ---------------------------------------------------------------------------
 * A Senha provisória em texto existe apenas no valor de retorno
 * ---------------------------------------------------------------------------
 *
 * Herdado da T6 e reafirmado aqui, porque este é o segundo consumidor de produção das funções que a
 * emitem: ela **não** é registrada, **não** é persistida em texto e **não** é ecoada por consulta
 * posterior. O que vai para o registro estruturado é a **autoria** da emissão (§13.1), que é a
 * mitigação nomeada pela **ADR-0013** — emitir credencial alheia é poder distinto da garantia sobre
 * a sessão de quem emite, e o que a criptografia não impede a trilha torna reconstituível.
 *
 * O alcance, aqui, é o do **Admin sobre a própria empresa**: não há a contenção por perfil que a
 * ADR-0013 impõe ao Master, porque a área de tela `Usuários` alcança **todas** as pessoas da
 * empresa, de qualquer perfil, inclusive outros administradores (glossário-feature). A contenção do
 * Master existe para encurtar o caminho entre o operador do SaaS e uma sessão de cliente; entre o
 * Admin e a própria empresa não há caminho a encurtar — ele já a administra.
 */

import { Inject, Injectable } from '@nestjs/common';
import {
  type Autenticacao,
  type ChaveDeAcao,
  type ChaveDeTela,
  type ChaveDoCatalogo,
  calcularEfetivo,
  criarPessoa,
  ehChaveDoCatalogo,
  type Perfil,
  reemitirSenhaProvisoria,
  repartirEfetivo,
  validarCoerenciaDeAjustes,
} from '@sysloc/auth';
import {
  type AcessoAIdentidade,
  type AcessoAoBanco,
  contarAjustesDaPessoa,
  definirAtivoDaPessoa,
  ErroDePessoaForaDoContexto,
  encerrarSessoesDaPessoa,
  escreverAjustes,
  garantirVinculoDeAcesso,
  lerAjustesDaPessoa,
  listarPessoasDaEmpresa,
  localizarPessoaDoContexto,
  localizarPessoaPorEmail,
  type PessoaDoContexto,
  trocarPerfilDaPessoa,
} from '@sysloc/db';
import { CodigoErro, ErroDeAplicacao, type Logger } from '@sysloc/shared';
import type { TransactionSql } from 'postgres';
import type { SessaoDoProduto } from '../autenticacao/contexto.guard.js';
import { MENSAGEM_POR_CODIGO } from '../comum/filtro-excecao.js';
import {
  TOKEN_ACESSO_A_IDENTIDADE,
  TOKEN_ACESSO_AO_NEGOCIO,
  TOKEN_AUTENTICACAO,
  TOKEN_LOGGER,
} from '../configuracao/ambiente.js';

/** Maior página que a listagem devolve. Pedido acima disso é recusado, nunca truncado em silêncio. */
export const MAIOR_PAGINA_DE_PESSOAS = 200;

/** Tamanho de página quando quem chama não declara um. */
export const PAGINA_PADRAO_DE_PESSOAS = 50;

/**
 * Os perfis que uma pessoa da empresa pode ter.
 *
 * `SYSLOC_MASTER` fica de fora, e a §6.1 é literal a respeito: ele **não é criável pelas rotas de
 * empresa**. A restrição `usuario_master_sem_empresa_chk` do schema já o impede estruturalmente — um
 * Master com empresa não existe —, mas deixar a recusa por conta dela produziria `500` sobre uma
 * violação de restrição em vez do `422` que o contrato declara.
 *
 * Derivado por exclusão em vez de redigitado: um perfil novo no enum do schema nasce aqui **dentro**
 * do conjunto administrável, que é o lado seguro para uma lista de perfis de empresa — e o que ficar
 * de fora fica por decisão escrita, não por esquecimento.
 */
export const PERFIS_ADMINISTRAVEIS = ['ADMIN_EMPRESA', 'USUARIO_EMPRESA'] as const;

/** Os perfis que as rotas desta superfície aceitam, como união fechada. */
export type PerfilAdministravel = (typeof PERFIS_ADMINISTRAVEIS)[number];

/**
 * O campo culpado quando a recusa é do **alvo**, e não do corpo — o identificador do caminho.
 *
 * É o mesmo nome que o controlador publica quando o identificador é malformado, e é deliberado: as
 * duas recusas falam do mesmo campo do pedido, e nomeá-lo diferente faria o cliente tratar como
 * lugares distintos o que é um só. É também a forma que a superfície já usa para recusa de alvo em
 * `POST /v1/master/usuarios/:id/senha-provisoria`.
 */
const CAMPO_DO_ALVO = 'id';

/**
 * O motivo publicado quando o alvo de uma rota de `:id` é a própria pessoa que age.
 *
 * Ele **entra no contrato que congela** no marco de entrega: o cliente discrimina a recusa por
 * `codigo` e, dentro do `CAMPO_INVALIDO`, por este motivo — que é o que permite à interface dizer
 * *"use a troca de senha"* em vez de repetir "requisição inválida". A grafia segue a dos motivos
 * irmãos desta superfície (`EMAIL_JA_REGISTRADO`, `DOCUMENTO_JA_REGISTRADO`).
 *
 * Ele **não é oráculo**: o alvo é quem pergunta, então a recusa não revela nada que quem age já não
 * soubesse.
 */
const MOTIVO_DE_AUTO_ALVO = 'ALVO_E_QUEM_AGE';

/** Os campos que o corpo da criação de pessoa carrega, já validados na borda. */
export interface PessoaDaCriacao {
  readonly nome: string;
  readonly email: string;
  readonly perfil: PerfilAdministravel;
}

/** A janela pedida da listagem, já validada na borda. */
export interface JanelaDaListagem {
  readonly limite: number;
  readonly deslocamento: number;
}

/**
 * Um ajuste individual como o corpo da requisição o carrega — os dois eixos em campos **separados**.
 *
 * A forma espelha a da tabela (`tipo` e `chave` em colunas próprias, §4.2), e não a do domínio, que
 * fala um literal só (`TELA:financeiro`). A composição entre as duas acontece na borda, num ponto
 * único: {@link comporChave}.
 */
export interface AjusteDoPedido {
  readonly tipo: 'TELA' | 'ACAO';
  readonly chave: string;
  readonly efeito: 'CONCEDIDA' | 'NEGADA';
}

/** O que o corpo da troca de perfil carrega, já validado na borda. */
export interface TrocaDePerfilPedida {
  readonly perfil: PerfilAdministravel;
  /**
   * A **intenção declarada** de descartar os ajustes individuais (RN-11).
   *
   * Ausente é `false` — **nunca** consentimento. Isto não é atualização parcial: `perfil` continua
   * obrigatório, e este campo é declaração de intenção, não campo a preservar.
   */
  readonly descartarAjustes: boolean;
}

/** Uma pessoa como o contrato a publica (§4.2, `PessoaDaEmpresa`). */
export interface PessoaDoContrato {
  readonly usuarioId: string;
  readonly nome: string;
  readonly email: string;
  readonly perfil: Perfil;
  readonly ativo: boolean;
}

/** A página de pessoas, na forma canônica de lista da ADR-0012. */
export interface PaginaDePessoas {
  readonly itens: readonly PessoaDoContrato[];
  readonly total: number;
  readonly limite: number;
  readonly deslocamento: number;
}

/** O que a criação devolve. A senha em texto existe aqui, e em nenhum outro lugar. */
export interface PessoaAdmitida {
  readonly usuarioId: string;
  readonly email: string;
  readonly perfil: PerfilAdministravel;
  /** A Senha provisória em texto, entregue **uma única vez** (RN-07). */
  readonly senhaProvisoria: string;
}

/** O que o ajuste de permissões devolve — o efetivo novo, já repartido nos dois eixos. */
export interface PermissoesAjustadas {
  readonly usuarioId: string;
  readonly telas: readonly ChaveDeTela[];
  readonly acoes: readonly ChaveDeAcao[];
  readonly versaoPermissoes: number;
}

/** O que a troca de perfil devolve. */
export interface PerfilTrocado {
  readonly usuarioId: string;
  readonly perfil: PerfilAdministravel;
  readonly versaoPermissoes: number;
}

/** O que a desativação devolve — o estado novo mais a **prova** do encerramento. */
export interface PessoaDesativada {
  readonly usuarioId: string;
  readonly ativo: false;
  /** Quantos registros de sessão **desta pessoa** foram apagados neste ato. Zero na repetição. */
  readonly sessoesEncerradas: number;
}

/** O que a reativação devolve. Ela devolve o acesso, e **não** a sessão encerrada (RN-05). */
export interface PessoaReativada {
  readonly usuarioId: string;
  readonly ativo: true;
}

/** O que a reemissão devolve. Não é idempotente por natureza (§9.2, RN-09). */
export interface SenhaProvisoriaDaPessoa {
  readonly usuarioId: string;
  /** A Senha provisória nova, em texto, entregue **uma única vez**. */
  readonly senhaProvisoria: string;
}

@Injectable()
export class UsuarioService {
  constructor(
    // A porta única para transação. É dela que sai o executor cru, e é ela que torna a escrita do
    // ajuste e o incremento do contador — nas duas fronteiras de schema — um commit só.
    @Inject(TOKEN_ACESSO_AO_NEGOCIO) private readonly banco: AcessoAoBanco,
    // O acesso restrito a `identidade` entra APENAS para ser repassado às duas funções de onboarding
    // de `@sysloc/auth`, que o exigem por assinatura. Nenhuma consulta é escrita com ele neste
    // arquivo — nem com ele, nem com o executor da unidade de trabalho.
    @Inject(TOKEN_ACESSO_A_IDENTIDADE) private readonly acesso: AcessoAIdentidade,
    @Inject(TOKEN_AUTENTICACAO) private readonly autenticacao: Autenticacao,
    @Inject(TOKEN_LOGGER) private readonly logger: Logger,
  ) {}

  /**
   * Cria uma pessoa da empresa, com Senha provisória (US-08).
   *
   * ---------------------------------------------------------------------------
   * `perfil` vem do corpo; `empresaId` vem da SESSÃO — e a assimetria é a decisão
   * ---------------------------------------------------------------------------
   *
   * O perfil é campo declarado desta rota, validado contra o conjunto administrável **antes** de
   * chegar ao onboarding (§6.1): o Admin escolhe entre `ADMIN_EMPRESA` e `USUARIO_EMPRESA`, e essa
   * escolha é legítima porque ele já administra a própria empresa. A empresa, essa, **não** é aceita
   * do corpo em hipótese alguma: ela é a da sessão de quem age, e aceitá-la do pedido seria a fuga
   * de tenant que o corpo fechado do controlador e o `input: false` do arcabouço existem para
   * impedir.
   *
   * ---------------------------------------------------------------------------
   * A ordem, e a janela que ela NÃO fecha — declarada em vez de escondida
   * ---------------------------------------------------------------------------
   *
   * Tudo que pode recusar acontece **antes** de `criarPessoa`: o endereço é conferido dentro de uma
   * transação de leitura, e só então a pessoa nasce. Isso importa porque a compensação de
   * `criarPessoa` alcança apenas os passos internos dela — o que este serviço faça **depois** do
   * retorno fica fora da rede.
   *
   * O vínculo de acesso é justamente um passo posterior, e ele **precisa** ser: `negocio.
   * acesso_usuario_app` referencia `identidade.usuario`, então a linha do vínculo não pode existir
   * antes da pessoa. A janela que sobra é estreita e **se cura sozinha**: uma falha entre a criação e
   * o vínculo deixa a pessoa sem vínculo — ela entra normalmente, e o vínculo dela nasce na primeira
   * operação de administração que ela mesma fizer (ver {@link UsuarioService.sobContextoDaSessao})
   * **ou na primeira em que um Admin a alcançar** (ver {@link UsuarioService.sobreAPessoa}). A
   * segunda metade é a que torna a cura independente de a pessoa agir: sem ela, quem nunca agisse
   * ficaria fora do alcance de todas as cinco rotas, inclusive a que revoga o acesso. O que não se
   * cura é o endereço ocupado, e por isso a falha é **registrada com o identificador da pessoa**
   * antes de propagar: sem essa linha, o Admin veria um erro e ninguém saberia qual pessoa examinar.
   *
   * ---------------------------------------------------------------------------
   * Risco residual, nomeado: a recusa por endereço ocupado é um ORÁCULO entre empresas
   * ---------------------------------------------------------------------------
   *
   * O espaço de login é **global**: `identidade.usuario.email` é único no banco inteiro, e não por
   * empresa. `localizarPessoaPorEmail` confere sem recorte nenhum, deliberadamente. A consequência é
   * declarada aqui em vez de descoberta depois: um Admin da empresa A descobre, pelo
   * `422 CAMPO_INVALIDO` com `detalhes.motivo: 'EMAIL_JA_REGISTRADO'`, que um endereço **tem conta em
   * alguma outra empresa** — ele aprende a existência, e nada além dela (nem o nome, nem o perfil,
   * nem qual empresa). É limite aceito, e as duas alternativas foram rejeitadas com motivo:
   *
   *   * **recortar a checagem pela empresa do contexto** — a colisão deixaria de ser vista aqui e
   *     bateria na unicidade global lá embaixo, chegando ao cliente como `500` sobre uma condição que
   *     é de domínio. Seria **pior e continuaria sendo oráculo**: o `500` naquela posição discrimina
   *     exatamente o mesmo fato, com uma resposta mentirosa por cima;
   *   * **responder sucesso sem criar** — mentiria sobre o efeito, e o Admin ficaria esperando por
   *     uma pessoa que nunca vai entrar. Recusa que não recusa é o pior dos dois mundos.
   *
   * O que fecharia de verdade é o espaço de login por empresa (login composto por empresa+endereço),
   * que é decisão de produto e não desta rota: ela mudaria a forma de entrar, o formulário do
   * frontend e a unicidade da coluna. Enquanto o espaço for global, a recusa tem de acontecer, e
   * acontecer com honestidade.
   */
  async criarPessoa(sessao: SessaoDoProduto, entrada: PessoaDaCriacao): Promise<PessoaAdmitida> {
    await this.sobContextoDaSessao(sessao, async (tx) => {
      if ((await localizarPessoaPorEmail(tx, entrada.email)) !== undefined) {
        throw new ErroDeAplicacao(
          CodigoErro.CAMPO_INVALIDO,
          MENSAGEM_POR_CODIGO[CodigoErro.CAMPO_INVALIDO],
          { campo: 'email', detalhes: { motivo: 'EMAIL_JA_REGISTRADO' } },
        );
      }
    });

    const criada = await criarPessoa(this.autenticacao, this.acesso.identidade, {
      nome: entrada.nome,
      email: entrada.email,
      perfil: entrada.perfil,
      // A empresa é a da SESSÃO — nunca do corpo, nunca do caminho.
      empresaId: sessao.empresaId,
    });

    try {
      await this.sobContextoDaSessao(
        sessao,
        async (tx) => await garantirVinculoDeAcesso(tx, criada.usuarioId),
      );
    } catch (falha) {
      this.logger.error(
        { erro: falha, usuarioId: criada.usuarioId, empresaId: sessao.empresaId },
        'a pessoa foi criada e o vínculo de acesso não pôde ser gravado — o endereço segue ocupado',
      );
      throw falha;
    }

    // A autoria da emissão, e **nunca** a senha (§13.1, ADR-0013).
    this.logger.info(
      { usuarioId: criada.usuarioId, empresaId: sessao.empresaId, emitidaPor: sessao.usuarioId },
      'senha provisória emitida na criação de pessoa pelo administrador da empresa',
    );

    return {
      usuarioId: criada.usuarioId,
      email: entrada.email,
      perfil: entrada.perfil,
      senhaProvisoria: criada.senhaProvisoria,
    };
  }

  /**
   * Lista as pessoas da empresa (US-08).
   *
   * **Alcança todas elas**, de qualquer perfil e ativas ou não: é o alcance que o glossário-feature
   * canoniza para a área `Usuários`, e é o que permite reativar quem foi desativado — uma listagem
   * que escondesse a pessoa desativada tornaria a reativação inalcançável pela interface.
   *
   * O recorte por empresa é do banco, e não desta camada: ver o cabeçalho deste arquivo e o de
   * `packages/db/src/pessoa.ts`. O que é desta camada é o **envelope** — a janela devolvida é a que
   * foi de fato servida, e não um eco do que o cliente pediu.
   */
  async listarPessoas(sessao: SessaoDoProduto, janela: JanelaDaListagem): Promise<PaginaDePessoas> {
    const { pessoas, total } = await this.sobContextoDaSessao(
      sessao,
      async (tx) => await listarPessoasDaEmpresa(tx, janela),
    );

    return {
      itens: pessoas.map((pessoa) => ({
        usuarioId: pessoa.id,
        nome: pessoa.nome,
        email: pessoa.email,
        perfil: pessoa.perfil,
        ativo: pessoa.ativo,
      })),
      total,
      limite: janela.limite,
      deslocamento: janela.deslocamento,
    };
  }

  /**
   * Substitui os ajustes individuais da pessoa e devolve o efetivo novo (US-09).
   *
   * ---------------------------------------------------------------------------
   * O conjunto é COMPLETO, e não um delta
   * ---------------------------------------------------------------------------
   *
   * `escreverAjustes` remove os ajustes anteriores e grava os informados: quem enviar só o ajuste que
   * mudou **apaga todos os demais**. É contrato da rota, e não efeito colateral — o corpo declara o
   * conjunto inteiro, e a transição de estado é expressa por sub-recurso, sem atualização parcial em
   * lugar algum desta superfície.
   *
   * ---------------------------------------------------------------------------
   * A coerência é validada DENTRO da transação, com o perfil lido do banco
   * ---------------------------------------------------------------------------
   *
   * `validarCoerenciaDeAjustes` entra por parâmetro em `escreverAjustes`, por **inversão de
   * dependência** — `@sysloc/auth` depende de `@sysloc/db`, e o inverso fecharia ciclo entre os
   * pacotes. Quem compõe as duas camadas é esta borda. O perfil contra o qual a regra roda é o lido
   * **dentro** da transação: lê-lo aqui deixaria a janela em que uma troca de perfil concorrente
   * valida a coerência contra um perfil que já não vale.
   *
   * O efetivo devolvido é calculado a partir do que **de fato ficou persistido**, relido depois da
   * escrita, e não do conjunto que o cliente enviou. Devolver o pedido seria devolver a intenção em
   * vez do resultado — e uma chave que a leitura descarte (ver abaixo) apareceria na resposta sem
   * existir no efetivo que a guarda vai aplicar na requisição seguinte.
   */
  async ajustarPermissoes(
    sessao: SessaoDoProduto,
    usuarioId: string,
    ajustes: readonly AjusteDoPedido[],
  ): Promise<PermissoesAjustadas> {
    return await this.sobreAPessoa(sessao, usuarioId, async (tx) => {
      // Resolver ANTES de escrever: a pessoa de outra empresa é recusada com o banco intocado.
      const pessoa = await this.exigirPessoaDoContexto(tx, usuarioId);

      const versaoPermissoes = await this.escrever(async () => {
        return await escreverAjustes(tx, {
          usuarioId,
          ajustes: ajustes.map((ajuste) => ({
            chave: comporChave(ajuste),
            efeito: ajuste.efeito,
          })),
          validarCoerencia: validarCoerenciaDeAjustes,
        });
      });

      const { ajustes: persistidos, chavesDesconhecidas } = await lerAjustesDaPessoa(
        tx,
        usuarioId,
        ehChaveDoCatalogo,
      );

      // `@sysloc/db` devolve as chaves órfãs em vez de registrá-las — ele não tem registrador, por
      // decisão, e a obrigação de tornar o descarte observável é da borda. Aqui a leitura acontece
      // logo depois de a rota ter substituído o conjunto inteiro por chaves que a borda validou:
      // uma chave órfã nesta posição significa que algo escreveu em `acesso_usuario_permissao` por
      // fora desta rota, e é justamente por ser inesperada que ela não pode passar em silêncio.
      if (chavesDesconhecidas.length > 0) {
        this.logger.warn(
          { usuarioId, empresaId: sessao.empresaId, chavesDesconhecidas },
          'ajustes de permissão fora do catálogo corrente foram lidos após a escrita e descartados',
        );
      }

      // Nem a aritmética nem a repartição são reescritas aqui. A precedência da negação é de
      // `calcularEfetivo` (ADR-0010, RN-01), que o CT-203 prova; a separação nos dois eixos é de
      // `repartirEfetivo`, a MESMA que grava o retrato do registro de sessão — é o que faz o que
      // esta rota devolve e o que a guarda aplica na requisição seguinte serem a mesma coisa.
      return {
        usuarioId,
        ...repartirEfetivo(calcularEfetivo(pessoa.perfil, persistidos), versaoPermissoes),
      };
    });
  }

  /**
   * Troca o perfil da pessoa, descartando os ajustes individuais dela (US-10).
   *
   * ---------------------------------------------------------------------------
   * A INTENÇÃO DECLARADA, e por que a contagem vem antes de tudo
   * ---------------------------------------------------------------------------
   *
   * Os ajustes são desvios sobre a matriz de **um** perfil; mantê-los sobre outra matriz produziria
   * um efetivo que ninguém desenhou. Por isso a troca os descarta — e por isso ela **exige que quem
   * administra declare que sabe disso** quando há o que perder (RN-11). Sem a intenção, a recusa é
   * `422` informando **quantos** ajustes se perderiam, e **nada muda**: nem o perfil, nem a contagem
   * de ajustes, nem o contador de versão.
   *
   * A contagem, portanto, acontece **antes** de qualquer escrita. Contá-la depois — ou pior, contar
   * as linhas removidas — passaria em qualquer asserção sobre o número e reprovaria na única que
   * importa, que é o estado inalterado. É a razão de o `CT-231` medir as três dimensões.
   *
   * `descartarAjustes` ausente é `false`, e o controlador o resolve na borda: aqui ele já chega
   * decidido. Tratá-lo como consentimento por omissão inverteria o sentido da regra — quem esquece o
   * campo perderia os ajustes sem nunca ter dito que aceitava perdê-los.
   */
  async trocarPerfil(
    sessao: SessaoDoProduto,
    usuarioId: string,
    pedido: TrocaDePerfilPedida,
  ): Promise<PerfilTrocado> {
    return await this.sobreAPessoa(sessao, usuarioId, async (tx) => {
      await this.exigirPessoaDoContexto(tx, usuarioId);

      const ajustesDescartados = await contarAjustesDaPessoa(tx, usuarioId);

      if (ajustesDescartados > 0 && !pedido.descartarAjustes) {
        throw new ErroDeAplicacao(
          CodigoErro.CAMPO_INVALIDO,
          MENSAGEM_POR_CODIGO[CodigoErro.CAMPO_INVALIDO],
          { campo: 'perfil', detalhes: { ajustesDescartados } },
        );
      }

      const versaoPermissoes = await this.escrever(
        async () => await trocarPerfilDaPessoa(tx, { usuarioId, perfil: pedido.perfil }),
      );

      this.logger.info(
        {
          usuarioId,
          empresaId: sessao.empresaId,
          perfil: pedido.perfil,
          ajustesDescartados,
          alteradoPor: sessao.usuarioId,
        },
        'perfil da pessoa trocado e ajustes individuais descartados',
      );

      return { usuarioId, perfil: pedido.perfil, versaoPermissoes };
    });
  }

  /**
   * Desativa a pessoa e **encerra as sessões dela no mesmo ato** (US-11, RN-04).
   *
   * O encerramento é **por pessoa**, e não por empresa: a colega da mesma empresa continua operando
   * no instante seguinte, e o `CT-228` exige que ela responda `2xx`. Ele acontece na **mesma
   * transação** da marcação — é isto, e só isto, que faz o encerramento acontecer *"na origem do
   * evento"* (decisão D5) em vez de virar uma recusa avaliada depois, na guarda, que seria a segunda
   * definição de recusa ao lado da barreira única de admissão.
   *
   * O encerramento roda **sempre**, e não apenas quando a marca é nova: repetir a desativação
   * encontra zero sessões, porque a barreira de admissão já recusa a entrada de quem está desativado,
   * e `sessoesEncerradas: 0` passa a ser um fato medido em vez de uma constante escrita num ramo.
   *
   * **Nada é apagado** (RN-06): a pessoa continua existindo, com os ajustes individuais intactos —
   * é o que permite à reativação devolver exatamente o efetivo que ela tinha.
   *
   * **A autodesativação é recusada**, e não por regra própria desta operação: ela cai na recusa do
   * auto-alvo de {@link UsuarioService.sobreAPessoa}. O que ela evitava é concreto — o único Admin da
   * empresa podia se desativar, e como a marcação e o encerramento das sessões acontecem no mesmo
   * commit, a partir dali **ninguém** na empresa alcançaria as sete rotas; o socorro seria externo,
   * pelo `POST /v1/master/empresas/:id/admin`. Ela fecha ali, e não aqui, porque é a mesma causa-raiz
   * dos dois vetores de escalada: a superfície pressupunha alvo e ator distintos sem verificar.
   */
  async desativar(sessao: SessaoDoProduto, usuarioId: string): Promise<PessoaDesativada> {
    return await this.sobreAPessoa(sessao, usuarioId, async (tx) => {
      if ((await definirAtivoDaPessoa(tx, usuarioId, false)) === undefined) {
        throw naoEncontrada();
      }

      const sessoesEncerradas = await encerrarSessoesDaPessoa(tx, usuarioId);

      this.logger.info(
        {
          usuarioId,
          empresaId: sessao.empresaId,
          sessoesEncerradas,
          desativadaPor: sessao.usuarioId,
        },
        'pessoa desativada e sessões dela encerradas na origem do evento',
      );

      return { usuarioId, ativo: false, sessoesEncerradas };
    });
  }

  /**
   * Reativa a pessoa (US-12).
   *
   * **Ela devolve o acesso, e não a sessão** (RN-05): os cookies anteriores continuam inválidos,
   * porque os registros foram apagados e devolvê-los exigiria tê-los guardado — que é precisamente a
   * diferença entre *"devolver o acesso"* e *"retomar o que estava em curso"*. Quem foi desativado
   * entra de novo.
   *
   * O efetivo volta **inteiro, com os ajustes individuais**, e isso não é feito aqui: nada foi
   * apagado (RN-06), então não há nada a restaurar. A reativação mexe numa coluna só, e é justamente
   * por isso que o `CT-229` compara o efetivo com o instantâneo anterior — se a desativação tivesse
   * apagado ajustes, a comparação reprovaria.
   */
  async reativar(sessao: SessaoDoProduto, usuarioId: string): Promise<PessoaReativada> {
    return await this.sobreAPessoa(sessao, usuarioId, async (tx) => {
      if ((await definirAtivoDaPessoa(tx, usuarioId, true)) === undefined) {
        throw naoEncontrada();
      }

      this.logger.info(
        { usuarioId, empresaId: sessao.empresaId, reativadaPor: sessao.usuarioId },
        'pessoa reativada pelo administrador da empresa',
      );

      return { usuarioId, ativo: true };
    });
  }

  /**
   * Reemite a Senha provisória de uma pessoa da empresa (US-08, RN-09).
   *
   * A invalidação da senha anterior **não** é um passo à parte: `reemitirSenhaProvisoria` reescreve a
   * derivação da conta local, e a anterior deixa de derivar naquele mesmo `UPDATE`. Quem a tentar
   * recebe a recusa indistinguível de credencial incorreta (RN-10) — porque é literalmente o que ela
   * passou a ser.
   *
   * O nome e o endereço vêm da **resolução pelo vínculo**, na transação que já os leu: a política de
   * força da senha os consome para recusar sorteio que contenha dado pessoal, e uma segunda leitura
   * poderia observar um estado diferente daquele que autorizou a operação.
   *
   * A emissão acontece **fora** da unidade de trabalho, e é deliberado: o adaptador do arcabouço tem
   * conexão própria e não aceita a transação de fora. A resolução — que é a fronteira de tenant —
   * roda dentro dela e recusa antes, de modo que nenhuma senha é sorteada para pessoa que este
   * contexto não alcança.
   */
  async reemitirSenha(
    sessao: SessaoDoProduto,
    usuarioId: string,
  ): Promise<SenhaProvisoriaDaPessoa> {
    const pessoa = await this.sobreAPessoa(
      sessao,
      usuarioId,
      async (tx) => await this.exigirPessoaDoContexto(tx, usuarioId),
    );

    const senhaProvisoria = await reemitirSenhaProvisoria(
      this.autenticacao,
      this.acesso.identidade,
      { usuarioId, nome: pessoa.nome, email: pessoa.email },
    );

    this.logger.info(
      { usuarioId, empresaId: sessao.empresaId, emitidaPor: sessao.usuarioId },
      'senha provisória reemitida pelo administrador da empresa',
    );

    return { usuarioId, senhaProvisoria };
  }

  /**
   * Abre a unidade de trabalho da operação — o **ponto único** por onde as sete rotas passam.
   *
   * As duas garantias que ele instala, e a razão de cada uma, estão no cabeçalho deste arquivo: a
   * recusa da sessão sem empresa e o vínculo idempotente de quem age (D32). Instalá-las aqui, e não
   * em cada operação, é o que impede a oitava rota de nascer sem elas — a propriedade instalada por
   * ponto sobrevive só até o ponto seguinte.
   */
  private async sobContextoDaSessao<T>(
    sessao: SessaoDoProduto,
    trabalho: (tx: TransactionSql) => Promise<T>,
  ): Promise<T> {
    if (sessao.empresaId === null) {
      // Não é `403`: a autorização já decidiu antes daqui, e o Sysloc Master não alcança estas rotas
      // por não ter chave alguma na matriz. Chegar aqui sem empresa é defeito de composição — a
      // mesma postura, e a mesma razão, de `sessaoDaRequisicao`.
      throw new ErroDeAplicacao(
        CodigoErro.ERRO_INTERNO,
        'rota de administração de pessoas alcançada por sessão sem empresa',
      );
    }

    return await this.banco.emUnidadeDeTrabalho(async (tx) => {
      await garantirVinculoDeAcesso(tx, sessao.usuarioId);
      return await trabalho(tx);
    });
  }

  /**
   * Abre a unidade de trabalho de uma operação **sobre uma pessoa identificada** — o ponto único das
   * cinco rotas de `:id`.
   *
   * ---------------------------------------------------------------------------
   * O ALVO NÃO PODE SER QUEM AGE — e a recusa mora aqui, nas cinco de uma vez
   * ---------------------------------------------------------------------------
   *
   * As cinco rotas foram escritas pressupondo que o alvo e quem age são **pessoas distintas**, e a
   * pressuposição não era verificada em lugar nenhum — nem na borda, nem na guarda, nem nos
   * manipuladores. A consequência é escalada de privilégio **dentro da própria empresa**, e ela é
   * consequência direta de a exigência ser de **chave** e não de perfil (ver o docblock do
   * controlador, que é onde essa escolha está justificada):
   *
   *   * uma pessoa `USUARIO_EMPRESA` que receba a concessão individual de **uma** chave —
   *     `TELA:usuarios` — alcança as sete rotas;
   *   * ela chama `POST /v1/usuarios/<o próprio id>/perfil` com `ADMIN_EMPRESA` e sai do piso
   *     `['TELA:resumo']` para **o catálogo inteiro**, com efeito **imediato**: a troca incrementa
   *     `versaoPermissoes`, e pela ADR-0010 a sessão relê o efetivo na requisição seguinte;
   *   * e é **irreversível para quem concedeu**: dali em diante `TELA:usuarios` passa a vir da matriz
   *     do perfil, e retirá-la exigiria gravar uma `NEGADA` explícita — que a própria pessoa
   *     promovida remove, porque segue alcançando a rota de ajuste.
   *
   * **Fechar só `/perfil` não fecharia a classe.** `POST /:id/permissoes` produz a MESMA escalada por
   * caminho diferente: a pessoa concede a si mesma as outras 16 chaves sem nunca tocar o perfil. O
   * defeito não é de rota, é da **superfície** — e por isso a recusa mora no ponto único por onde as
   * cinco abrem a unidade de trabalho, e não em dois manipuladores.
   *
   * **As cinco recusam, e a medição que sustenta o alcance** — nenhuma delas tem auto-alvo legítimo:
   *
   *   * **reativação**: inalcançável em auto-alvo. Estar desativado e ter sessão viva são
   *     mutuamente exclusivos — a desativação encerra as sessões no mesmo commit (RN-04) e a barreira
   *     de admissão recusa a entrada de quem está desativado. Sobra o auto-alvo de quem já está
   *     ativo, que é operação sem efeito e sem caso de uso;
   *   * **desativação**: era alcançável, e trancava a administração — o único Admin da empresa podia
   *     se desativar, e a partir dali **ninguém** na empresa alcançava as sete rotas; a recuperação
   *     era externa, pela rota do Master. Ela fecha aqui, junto, por ter a mesma causa-raiz;
   *   * **senha provisória**: a própria pessoa troca a senha por `POST /v1/sessao/senha`, que existe e é o
   *     caminho do produto. Reemitir a **própria** senha provisória não tem caso de uso — ela apenas
   *     devolveria a sessão à condição restrita;
   *   * **perfil** e **permissões**: os dois vetores de escalada acima.
   *
   * **A recusa é `422 CAMPO_INVALIDO` com `campo: 'id'`**, e não `403 ACESSO_NEGADO`. As duas razões:
   * é a forma que **esta superfície já fala** para recusa de alvo — `POST
   * /v1/master/usuarios/:id/senha-provisoria` recusa o alvo de perfil errado exatamente assim
   * (§11.2, e o corpo em `master/empresa.service.ts`) —, e `ACESSO_NEGADO` é do **ponto de aplicação
   * único** da guarda, que o emite com `detalhes.exigido` (RN-14, ADR-0011): emiti-lo de dentro de um
   * manipulador seria uma segunda definição de recusa de autorização, ao lado da que já decide.
   *
   * A verificação acontece **antes de a unidade de trabalho abrir**, e não dentro dela: ela compara
   * dois valores que já estão em mãos e não precisa de contexto nenhum para decidir, de modo que o
   * pedido de auto-alvo é recusado sem que escrita alguma aconteça — nem a garantia idempotente do
   * vínculo de quem age. É a forma mais forte do fail-closed que o cabeçalho deste arquivo descreve.
   *
   * ---------------------------------------------------------------------------
   * Por que o vínculo do ALVO é garantido AQUI, e não em cada rota
   * ---------------------------------------------------------------------------
   *
   * As cinco rotas alcançam o alvo **pelo** vínculo de acesso, e há uma origem legítima de pessoa que
   * nasce sem ele: `POST /v1/master/empresas/:id/admin`, que não pode gravá-lo sem derivar o contexto
   * de RLS do caminho da requisição (ADR-0008). Enquanto o vínculo só nascia para **quem age**, essa
   * pessoa era mostrada pela listagem — que lê `identidade.usuario` — e respondia `404` nas cinco
   * rotas: **ninguém conseguia revogar o acesso dela**. A mitigação que se supunha (a RN-09 obriga a
   * troca de senha na primeira entrada) não cobria caso algum: entrar e trocar a senha **não passam
   * por aqui**, e portanto não estabelecem contexto de tenant nem criam vínculo.
   *
   * A garantia mora neste ponto único, e não nos manipuladores, pela mesma razão que
   * {@link UsuarioService.sobContextoDaSessao} existe: propriedade instalada por ponto sobrevive só
   * até o ponto seguinte. Uma sexta rota de `:id` nasce alcançando o alvo porque **é assim que ela
   * abre a unidade de trabalho** — não porque quem a escreveu lembrou de uma chamada.
   *
   * **Ela não abre buraco na fronteira de tenant**, e é o recorte de `garantirVinculoDeAcesso` que o
   * garante: alvo de outra empresa não casa com a empresa do contexto, **nenhuma linha é inserida**,
   * a resolução segue devolvendo `undefined` e a rota segue respondendo `404` — o mesmo desfecho, e
   * pela mesma ausência, que o `CT-230` assere.
   */
  // DECISÃO FECHADA — T8 / Gate 2 · 2026-08-05
  // O QUÊ: `sobreAPessoa` é o ponto único de abertura das cinco rotas de `:id`, e as DUAS garantias
  //        que ele instala — o vínculo do ALVO e a recusa do AUTO-ALVO — moram aqui, não nos
  //        manipuladores.
  // POR QUÊ: duas rodadas de gate fecharam neste mesmo ponto dois defeitos de CLASSES DIFERENTES —
  //          revogação de acesso inalcançável (Gate 1, rodada 1) e escalada de privilégio dentro da
  //          empresa (Gate 2, rodada 2) —, e nos dois a forma óbvia (verificar em cada manipulador)
  //          é exatamente a que falhou: cada defeito alcançava DUAS rotas, e fechar a rota apontada
  //          deixava a outra aberta. Propriedade instalada por ponto sobrevive só até o ponto
  //          seguinte; instalada na abertura, a sexta rota de `:id` nasce com as duas.
  //          TERCEIRA VOLTA (Gate 2, rodada 4), acrescentada sem alterar nada do que está acima: a
  //          recusa do auto-alvo daqui era contornável por UUID em MAIÚSCULAS. A topologia estava
  //          certa — o ponto único — e o que estava errado era o PREDICADO, que pressupunha uma
  //          canonicidade que ninguém estabelecia. Ela passou a ser estabelecida na BORDA, por
  //          `ESQUEMA_DO_IDENTIFICADOR` (`usuario.controller.ts`), que tem marcador próprio: a
  //          igualdade abaixo só é sólida enquanto aquele `.transform` existir.
  // REVERTER EXIGE: provar que nenhuma rota de `:id` — inclusive as que ainda não existem — alcança
  //                 uma pessoa sem passar por aqui, E que o alcance ao alvo e a distinção entre alvo
  //                 e quem age passam a ser garantidos por um mecanismo que não depende de quem
  //                 escreve o manipulador. Enquanto a abertura da unidade for o único caminho, as
  //                 duas garantias não saem daqui.
  private async sobreAPessoa<T>(
    sessao: SessaoDoProduto,
    usuarioId: string,
    trabalho: (tx: TransactionSql) => Promise<T>,
  ): Promise<T> {
    if (usuarioId === sessao.usuarioId) {
      throw new ErroDeAplicacao(
        CodigoErro.CAMPO_INVALIDO,
        MENSAGEM_POR_CODIGO[CodigoErro.CAMPO_INVALIDO],
        { campo: CAMPO_DO_ALVO, detalhes: { motivo: MOTIVO_DE_AUTO_ALVO } },
      );
    }

    return await this.sobContextoDaSessao(sessao, async (tx) => {
      await garantirVinculoDeAcesso(tx, usuarioId);
      return await trabalho(tx);
    });
  }

  /**
   * Resolve a pessoa pelo vínculo, ou recusa com `404`.
   *
   * **É aqui, e em nenhum outro lugar, que a fronteira de tenant das rotas de `:id` acontece** — e
   * ela acontece por ausência, não por comparação. Ponto único: cinco traduções da mesma ausência
   * ficariam livres para divergir no código e no status, e a forma do erro é contrato.
   */
  private async exigirPessoaDoContexto(
    tx: TransactionSql,
    usuarioId: string,
  ): Promise<PessoaDoContexto> {
    const pessoa = await localizarPessoaDoContexto(tx, usuarioId);

    if (pessoa === undefined) {
      throw naoEncontrada();
    }

    return pessoa;
  }

  /**
   * Executa uma escrita de `@sysloc/db` traduzindo `ErroDePessoaForaDoContexto` em `404`.
   *
   * As duas funções de escrita de permissão recusam com esse erro quando o vínculo não é alcançável
   * sob o contexto corrente. Nas rotas desta classe a resolução já aconteceu antes, então a recusa
   * aqui só pode vir de uma **corrida** — a pessoa deixou de ser alcançável entre a resolução e a
   * escrita. Traduzi-la é o que impede a corrida de virar `500`: o cliente recebe o mesmo `404` que
   * receberia um instante antes, em vez de uma falha de servidor sobre uma condição que é do domínio.
   */
  private async escrever(escrita: () => Promise<number>): Promise<number> {
    try {
      return await escrita();
    } catch (falha) {
      if (falha instanceof ErroDePessoaForaDoContexto) {
        throw naoEncontrada();
      }
      throw falha;
    }
  }
}

/** A recusa canônica de recurso inalcançável. Um lugar só, para que o corpo seja sempre o mesmo. */
function naoEncontrada(): ErroDeAplicacao {
  return new ErroDeAplicacao(
    CodigoErro.RECURSO_NAO_ENCONTRADO,
    MENSAGEM_POR_CODIGO[CodigoErro.RECURSO_NAO_ENCONTRADO],
  );
}

/**
 * Compõe a chave do catálogo a partir dos dois campos do corpo — **ponto único** da composição.
 *
 * O corpo carrega `tipo` e `chave` separados (a forma da tabela); o domínio fala um literal só. A
 * conversão é segura porque o controlador já recusou, com `422`, todo par cuja composição não
 * pertença ao catálogo: quando a execução chega aqui, a chave é uma das 17.
 */
function comporChave(ajuste: AjusteDoPedido): ChaveDoCatalogo {
  return `${ajuste.tipo}:${ajuste.chave}` as ChaveDoCatalogo;
}
