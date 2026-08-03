/**
 * Instância do arcabouço de identidade — `better-auth` 1.6.25 sobre o adaptador Drizzle.
 *
 * ---------------------------------------------------------------------------
 * Ela RECEBE o acesso; nunca abre conexão (critério 2 do §4 da T6)
 * ---------------------------------------------------------------------------
 *
 * O acesso restrito a `identidade` vem de `@sysloc/db` (`abrirAcessoAIdentidade`), e este pacote não
 * importa cliente de banco algum — não há como ele abrir conexão nem alcançar `negocio`. Quem abre é
 * dono do recurso e o encerra; esta instância só o usa.
 *
 * > **Divergência declarada.** A §1 da T6 nomeia o símbolo consumido como `acessoIdentidade` ← T3.
 * > Esse símbolo nunca existiu: a T3 entregou `abrirAcessoAoBanco`, que é a porta para `negocio`. O
 * > acesso restrito a `identidade` que a §3.3 da tech spec declara desde sempre foi materializado
 * > nesta task, em `packages/db/src/acesso-identidade.ts`, com o nome `abrirAcessoAIdentidade`. O
 * > requisito — "recebe o acesso restrito à identidade exportado por `@sysloc/db`, nunca uma conexão
 * > própria" — é o que está cumprido aqui.
 *
 * ---------------------------------------------------------------------------
 * Fábrica, e não instância de módulo
 * ---------------------------------------------------------------------------
 *
 * A §1 da T6 chama o símbolo de "instância configurada". Uma instância criada na carga do módulo
 * precisaria ler a cadeia de conexão e o segredo de sessão de algum lugar no momento do `import` —
 * isto é, do ambiente, dentro de um pacote de biblioteca. É exatamente o modo de falha que a
 * ADR-0006 nomeia: a verificação alcançaria, em silêncio, o que atende a operação. A fábrica recebe
 * tudo por parâmetro e deixa a leitura de ambiente onde ela já mora — na validação de partida do
 * processo.
 *
 * ---------------------------------------------------------------------------
 * O schema fala português; o vocabulário do arcabouço não entra no banco
 * ---------------------------------------------------------------------------
 *
 * Cada modelo do arcabouço é remapeado para a tabela e as colunas do projeto: `user` → `usuario`,
 * `session` → `sessao`, `account` → `conta`, `verification` → `verificacao`, `twoFactor` →
 * `dois_fatores`, e cada campo para a coluna correspondente. Nenhum nome em inglês chega ao schema.
 *
 * ---------------------------------------------------------------------------
 * As três lacunas medidas, e onde cada uma se prende
 * ---------------------------------------------------------------------------
 *
 * O arcabouço não oferece verificação de força de senha, não oferece bloqueio **por conta** e trata
 * o segundo fator como adesão por pessoa. As duas primeiras são cobertas por `senha.ts` e
 * `bloqueio.ts`; a terceira, pelo plugin de segundo fator mais o predicado por perfil que a barreira
 * de admissão instala. O que amarra bloqueio e trilha ao fluxo de entrada são os dois ganchos
 * abaixo.
 *
 * **`antes`** roda antes do manipulador: é onde a barreira de admissão é consultada, porque recusar
 * depois significaria conferir a senha de uma conta trancada — e conferir a senha é justamente o que
 * o bloqueio existe para impedir. A recusa **deriva a senha informada e descarta o resultado** antes
 * de lançar: derivar sem comparar não é conferir credencial, e sem isso a conta bloqueada seria a
 * única resposta em milissegundos de um fluxo cujo custo é dominado pelo `scrypt` — um canal
 * lateral que enumera contas. Ver a decisão fechada no ponto.
 *
 * **`depois`** roda depois, inclusive quando o manipulador falhou: o arcabouço deixa o resultado em
 * `ctx.context.returned`, e um `APIError` ali é a recusa. É o único ponto em que sucesso e falha do
 * mesmo fluxo são observáveis pela mesma via, e é por isso que a trilha dos dois caminhos mora aqui,
 * e não duplicada em dois lugares que podem divergir. **Nem todo `APIError` é credencial incorreta**
 * — o discriminador é o código, não a classe; ver a decisão fechada no gancho.
 *
 * Quando `antes` levanta, `depois` **não** roda — verificado empiricamente contra o pacote
 * publicado. É o que garante uma linha por tentativa, e não duas, na recusa por bloqueio.
 *
 * ---------------------------------------------------------------------------
 * A barreira de admissão, e os DOIS pontos em que ela é consultada
 * ---------------------------------------------------------------------------
 *
 * A T7 entregou `admissao.ts` — a barreira única, com os cinco predicados nomeados. Nenhum deles
 * nasceu aqui, e nenhum deve nascer: este arquivo **consulta** a barreira, não decide. É o que a T6
 * já deixava escrito neste ponto, e continua valendo para o sexto predicado que a fatia de
 * autorização acrescentará.
 *
 * Ela é consultada em dois pontos, e os dois são necessários por razões diferentes:
 *
 *   * **`databaseHooks.session.create.before`** — o ponto de estrangulamento. Toda emissão de sessão
 *     do arcabouço, venha de que rota vier e de que plugin vier, passa por
 *     `internalAdapter.createSession`, que por sua vez passa por este gancho. É o que torna
 *     "nenhuma sessão nasce fora da barreira" propriedade **estrutural**, e não lista de rotas a
 *     manter à mão: uma rota emissora acrescentada por versão futura do arcabouço já nasce coberta.
 *
 *   * **`hooks.before` do caminho de entrada** — porque recusar *apenas* no ponto de estrangulamento
 *     significaria conferir a senha antes, e a conta bloqueada existe justamente para que a senha
 *     dela não seja conferida. É também aqui que a trilha da tentativa recusada é escrita, e é por
 *     isso que o motivo da recusa importa: o gancho `depois` não roda quando o `antes` levanta, o
 *     que garante uma linha por tentativa e não duas.
 *
 * Os dois chamam a **mesma** função, e é isso que os torna dois pontos de consulta em vez de duas
 * implementações da regra.
 */

import { type AcessoAIdentidade, type BancoDeIdentidade, esquemaIdentidade } from '@sysloc/db';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { APIError, createAuthMiddleware, getIp, getSessionFromCtx } from 'better-auth/api';
import { twoFactor } from 'better-auth/plugins/two-factor';
import { eq } from 'drizzle-orm';
import {
  admitirSessao,
  carregarEstadoDeAdmissao,
  type MotivoDeRecusa,
  RECUSA_DE_CREDENCIAL,
} from './admissao.js';
import { type DesfechoDeTentativa, registrarTentativa } from './auditoria.js';
import { limparBloqueio, registrarFalha } from './bloqueio.js';
import { avaliarForcaDeSenha, type PessoaDaSenha } from './senha.js';

/**
 * Validade da sessão, em segundos (RN-07).
 *
 * **Exportada para ser ancorável.** Sem uma asserção que amarre este número ao valor da regra, ele
 * é literal órfão: trocá-lo por outro não reprova caso nenhum. A âncora vive no CT-015
 * (`test/bloqueio.spec.ts`), no mesmo padrão que `LIMITE_DE_FALHAS_CONSECUTIVAS` já usa.
 *
 * Não sai no índice do pacote (`index.ts`): a superfície publicada é a das **capacidades** que os
 * outros pacotes chamam, e nenhum consumidor de fora lê a configuração da instância.
 */
export const DURACAO_DA_SESSAO_EM_SEGUNDOS = 8 * 60 * 60;

/**
 * De quanto em quanto tempo a sessão é renovada, em segundos.
 *
 * Zero significa "a cada uso", que é a leitura literal de "renovada por atividade" (RN-07). O padrão
 * do arcabouço é um dia — maior que a própria validade de 8 h, o que faria a renovação nunca
 * acontecer e a sessão morrer 8 h depois da entrada, ativa ou não. O custo é uma escrita por
 * requisição autenticada, aceitável na vazão desta fatia (§12.1: dezenas de requisições por segundo).
 *
 * Exportada pela mesma razão da constante acima, e com o mesmo critério de índice.
 */
export const RENOVACAO_DA_SESSAO_EM_SEGUNDOS = 0;

/** O caminho, relativo ao prefixo do arcabouço, em que a entrada por identificação e senha acontece. */
const CAMINHO_DE_ENTRADA = '/sign-in/email';

// ---------------------------------------------------------------------------------------------
// As duas validações de PRODUTO, e por que elas moram AQUI e não no adaptador HTTP (T10 / Gate 2)
// ---------------------------------------------------------------------------------------------
//
// A §6.1 da tech spec escreve a regra da força de senha por CLASSE — "toda definição de senha" —,
// e a T10 a instalou por PONTO: uma comparação com o literal `/change-password` dentro do
// encaminhador `@All('*')` de `apps/api`. É a mesma topologia que a `DECISÃO FECHADA — T7` deste
// arquivo rejeita por escrito ("instalada por ponto, a propriedade sobrevive só até o ponto
// seguinte") e que a §5 de `.claude/rules/nao-regressao.md` nomeia como origem do defeito de
// quatro rodadas deste repositório. O gatilho para o defeito virar alcance era **uma linha de
// configuração numa fatia futura**: `emailAndPassword.sendResetPassword` definido — o caminho
// natural do "esqueci minha senha" — e `POST /reset-password` passaria a gravar credencial sujeita
// apenas ao piso de 10 caracteres, sem as regras de dado pessoal, sequência e repetição, sem que
// nada no código, no teste ou num marcador acusasse. O mesmo valia para toda chamada
// `auth.api.*` feita de dentro do servidor, que não passa pelo encaminhador HTTP nenhuma vez — e
// é o que a fatia `autorizacao-e-ciclo-de-acesso` fará no onboarding.
//
// Aqui a propriedade é estrutural nos dois eixos:
//
//   * **quem passa** — o `hooks.before` corre para TODO endpoint do arcabouço, venha ele do
//     roteador HTTP ou de `auth.api.*` (os dois entram por `toAuthEndpoints` → `dispatchAuthEndpoint`,
//     medido no pacote publicado). Não há caminho paralelo a fechar;
//   * **o que dispara** — a classe é reconhecida pelo CAMPO que o arcabouço usa para definir uma
//     senha nova, e não por uma lista de caminhos. Os três endpoints que declaram esse campo hoje
//     (`changePassword`, `resetPassword` e o `serverOnly` `setPassword`, que **não tem caminho**)
//     ficam cobertos por construção, e um endpoint que uma versão futura acrescente nasce coberto
//     **se declarar `newPassword`** — e só nesse caso.
//
// O ALCANCE TEM BORDA, E ELA É NOMEÁVEL (T10 / Gate 2, rodada 2). Um endpoint que defina senha por
// campo de OUTRO nome fica fora, e o exemplo não é hipotético: o plugin `email-otp`, que este
// projeto NÃO instala, publica `POST /email-otp/reset-password` gravando credencial por
// `internalAdapter.updatePassword` a partir de um campo chamado `password`. Política nenhuma
// correria sobre ele.
//
// **Não se fecha alargando o discriminador**: `password` é o campo com que `/sign-in/email`,
// `/verify-password` e `/delete-user` CONFEREM uma senha existente, e aplicar a política ali
// recusaria a entrada de quem tem senha antiga fraca — o oposto do que a RN-05 pede (ver
// {@link CAMPO_DA_SENHA_NOVA}). Fecha-se por REVISÃO OBRIGATÓRIA, e ela está instalada: o
// inventário de `test/definicao-de-senha.spec.ts` enumera da instância TODO endpoint cujo esquema
// de corpo declare qualquer campo de senha e o compara, por igualdade nos dois sentidos, com uma
// partição declarada entre DEFINIDORES (cobertos) e CONFERIDORES (deliberadamente fora). Um
// definidor de plugin com campo `password` entra ali como excedente e REPROVA, nomeando-o — quem
// instalar o plugin decide então, por escrito, de que lado ele fica.
//
// E elas correm ANTES do manipulador, que é o que o `D21` exige: a troca de senha do arcabouço
// persiste a credencial antes de qualquer gancho posterior, de modo que validar depois devolveria
// a recusa com a senha nova já valendo.

/**
 * Campo do corpo com que o arcabouço define uma senha NOVA — e, por isso, o discriminador da
 * classe "definição de senha".
 *
 * Vale a distinção com `password`: aquele campo aparece em `/sign-in/email`, `/verify-password` e
 * `/delete-user`, que **conferem** uma senha existente. Aplicar a política de força ali recusaria a
 * entrada de quem tem senha antiga fraca — o oposto do que a RN-05 pede.
 */
const CAMPO_DA_SENHA_NOVA = 'newPassword';

/**
 * De onde sai o DONO da senha em cada caminho que a define.
 *
 * Ele é necessário porque a RN-05 compara a senha nova com o nome e o e-mail de quem a está
 * definindo, e a origem dessa pessoa **muda por caminho**: na troca é a sessão do pedido; na
 * redefinição não há sessão nenhuma, e quem identifica a pessoa é o token de uso único.
 *
 * O conjunto de chaves é a {@link CAMINHOS_QUE_DEFINEM_SENHA}, e ele está amarrado por asserção em
 * `test/definicao-de-senha.spec.ts` contra a superfície que o próprio arcabouço publica — crescer
 * sem revisão reprova um caso, no mesmo molde do `CT-018 (d)`.
 *
 * **Caminho fora desta tabela não fica sem política** — só fica sem esta resolução: a política
 * continua correndo, e o dono vem de {@link donoDaSessao}, que é o padrão. É o que cobre o
 * `setPassword`, endpoint `serverOnly` que **não tem caminho algum** (`createAuthEndpoint.serverOnly`
 * não recebe um) e cujo dono é, de fato, a sessão do pedido.
 */
const DONO_POR_CAMINHO_QUE_DEFINE_SENHA = {
  '/change-password': donoDaSessao,
  '/reset-password': donoDoTokenDeRedefinicao,
} as const satisfies Record<string, LeitorDoDonoDaSenha>;

/**
 * Os caminhos do arcabouço que definem senha e têm resolução de dono própria.
 *
 * Exportada **para ser ancorável**, pelo mesmo critério de `DURACAO_DA_SESSAO_EM_SEGUNDOS`: sem uma
 * asserção que a compare com a superfície publicada pelo arcabouço, a tabela acima é uma lista que
 * envelhece em silêncio. Não sai no índice do pacote — nenhum consumidor de fora a lê.
 */
export const CAMINHOS_QUE_DEFINEM_SENHA = Object.keys(DONO_POR_CAMINHO_QUE_DEFINE_SENHA);

/**
 * Caminho da verificação do segundo fator, relativo ao prefixo (§4.1).
 *
 * É **uma** rota exercitada em dois momentos do fluxo — o desafio da entrada e a ativação a partir
 * de uma sessão —, e a validação de formato vale nos dois: a §6.1 diz *"desafio e ativação"*.
 *
 * Diferente da política de senha, esta comparação é com UM caminho **e é assim que deve ser**: o
 * campo `code` não é discriminador de classe (o plugin o usa também em `verify-backup-code`, cujo
 * formato é outro), e a única coisa que define "o que é um código TOTP bem formado" é a rota que o
 * confere. Ela mudou de casa junto com a política pela outra metade do argumento — cobrir
 * `auth.api.verifyTOTP`, que o encaminhador HTTP nunca vê —, e não porque a comparação por caminho
 * fosse o defeito.
 */
const CAMINHO_DA_VERIFICACAO_DO_SEGUNDO_FATOR = '/two-factor/verify-totp';

/** Campo do corpo que carrega o código do segundo fator — nome do arcabouço, preservado pela §4.1. */
const CAMPO_DO_CODIGO = 'code';

/**
 * Forma exigida do código do segundo fator: seis dígitos (§6.1).
 *
 * Seis é o que o plugin gera — `digits` não é configurado abaixo, e o padrão dele é 6. Um código
 * com outro comprimento ou com caractere não numérico **não pode** corresponder a nenhum código
 * gerado, de modo que recusá-lo aqui não muda desfecho nenhum: muda a RESPOSTA, de "credencial
 * inválida" para "campo inválido", que é o que a §6.1 exige e o que distingue erro de digitação de
 * código errado.
 */
const CODIGO_DO_SEGUNDO_FATOR = /^[0-9]{6}$/u;

/** Prefixo com que o arcabouço indexa o token de redefinição em `identidade.verificacao`. */
const PREFIXO_DO_TOKEN_DE_REDEFINICAO = 'reset-password:';

/**
 * A recusa que as validações de produto emitem, no vocabulário do arcabouço.
 *
 * Mesma forma e mesmo papel de `RECUSA_DE_CREDENCIAL`: um `APIError` é a única recusa que o
 * roteador do arcabouço converte em resposta em vez de tratar como falha do servidor (medido em
 * `better-call@1.3.7`), então é neste vocabulário que este pacote precisa falar. **A mensagem
 * daqui nunca chega ao cliente** — quem monta o envelope da ADR-0007 é o adaptador HTTP, que lê o
 * `code` abaixo e responde com a mensagem canônica do código `CAMPO_INVALIDO`.
 *
 * Sai no índice do pacote porque o leitor da recusa é `apps/api`: sem a constante, aquele lado
 * escreveria um segundo literal, livre para divergir deste.
 */
export const RECUSA_DE_CAMPO_INVALIDO = {
  code: 'CAMPO_INVALIDO',
  message: 'campo inválido',
} as const;

/** Nome do campo culpado **como o cliente o conhece** — a §6.1 fixa `senha` para toda senha. */
const CAMPO_DA_SENHA_NO_ERRO = 'senha';

/** Idem para o código do segundo fator. */
const CAMPO_DO_CODIGO_NO_ERRO = 'codigo';

/**
 * O desfecho que cada motivo de recusa da barreira grava na trilha.
 *
 * `Record` exaustivo, e não `switch` com ramo padrão: um motivo novo na barreira deixa de compilar
 * aqui, em vez de cair em silêncio num desfecho genérico que a auditoria não sabe interpretar.
 *
 * `PESSOA_DESATIVADA` e `EMPRESA_SUSPENSA` compartilham `ACESSO_RECUSADO` porque o enum do banco não
 * os distingue — a fronteira está escrita por extenso no comentário de `desfechoTentativa`
 * (`packages/db/src/esquema/identidade.ts`), que é o oráculo do vocabulário, e separá-los exige
 * valor novo no enum e migração. Elas são, a partir da T7, o volume normal do valor.
 */
const DESFECHO_POR_MOTIVO: Record<MotivoDeRecusa, DesfechoDeTentativa> = {
  CONTA_BLOQUEADA: 'CONTA_BLOQUEADA',
  PESSOA_DESATIVADA: 'ACESSO_RECUSADO',
  EMPRESA_SUSPENSA: 'ACESSO_RECUSADO',
};

/** O que a instância precisa para existir. Tudo entra por parâmetro; nada é lido do ambiente. */
export interface OpcoesDeAutenticacao {
  /** O acesso restrito ao schema `identidade`, aberto por quem compõe o processo. */
  readonly acesso: AcessoAIdentidade;
  /** Segredo de assinatura de sessão. Vive em `EnvironmentFile` 0600, fora da árvore (§11.6). */
  readonly segredoDeSessao: string;
  /** Endereço base público do serviço, usado na montagem dos endereços do arcabouço. */
  readonly enderecoBase: string;
  /** Prefixo em que as rotas do arcabouço são montadas (§4.1: `/v1/auth`). */
  readonly prefixoDasRotas: string;
}

/** A instância configurada. O tipo é o do arcabouço — não reexportamos os caminhos internos dele. */
export type Autenticacao = ReturnType<typeof criarAutenticacao>;

/**
 * Monta a instância do arcabouço sobre o acesso restrito a `identidade`.
 */
// DECISÃO FECHADA — T6 / Gate 2 (P5) · 2026-08-02
// O QUÊ: `zod` é dependência direta do manifesto deste pacote (`packages/auth/package.json`) e
//        NENHUM arquivo dele o importa.
// POR QUÊ: sem ela a declaração inferida desta função não é nomeável — `TS2883`, referência a
//          `$strip` de `zod/v4/core` — e `dist/autenticacao.d.ts` NÃO é emitido. MEDIDO, não
//          suposto: a linha foi removida, rodados `pnpm install` e `tsc --build --force`, o
//          compilador reprovou apontando esta função, e manifesto e `pnpm-lock.yaml` voltaram.
// REVERTER EXIGE: `tsc --build --force` com `dist/` e `tsbuildinfo` APAGADOS emitir o `.d.ts` sem
//                 a dependência **E SEM anotação de tipo manual no retorno desta função** (ver a
//                 nota adjacente abaixo — a anotação faz o `.d.ts` emitir e NÃO satisfaz este
//                 campo). Build INCREMENTAL NÃO mede — ele reaproveita o `.d.ts` já emitido e
//                 passa mesmo sem `zod`, de modo que um `pnpm build` do dia a dia não é prova de
//                 nada aqui.
//
// (Adjacente à decisão acima, e não parte dela.) A anotação de tipo explícita que o compilador
// sugere NÃO satisfaz o `REVERTER EXIGE`: o retorno de `betterAuth(opcoes)` é inferido e
// dependente das opções, e escrevê-lo à mão criaria uma superfície de tipo paralela que diverge
// no primeiro bump do arcabouço — abstração especulativa. A dependência é a saída barata.
export function criarAutenticacao(opcoes: OpcoesDeAutenticacao) {
  const banco = opcoes.acesso.identidade;
  const { conta, doisFatores, sessao, usuario, verificacao } = esquemaIdentidade;

  return betterAuth({
    appName: 'Sysloc',
    baseURL: opcoes.enderecoBase,
    basePath: opcoes.prefixoDasRotas,
    secret: opcoes.segredoDeSessao,

    // O limitador nativo fica DESLIGADO, e explicitamente — a omissão não era "não usar".
    //
    // Medido em `better-auth@1.6.25` (`dist/context/create-context.mjs`): o estado do limitador é
    // `options.rateLimit?.enabled ?? isProduction`, e `isProduction` é
    // `process.env.NODE_ENV === 'production'`. Omitir a opção, portanto, LIGAVA o limitador em
    // produção — janela de 10 s, teto de 100, aplicado antes do casamento de rota para todo
    // `/v1/auth/*` — e o mantinha desligado em toda verificação, que roda com `NODE_ENV=test`. A
    // configuração que atende a operação era diferente da que a suíte exercita, e nenhuma decisão
    // deste projeto tinha escolhido isso.
    //
    // A §11.5 da tech spec declara o limitador nativo como "camada adicional, e não substituto" do
    // bloqueio por conta (RN-06): algo a ligar de propósito, com janela e teto escolhidos. Esse é
    // o `P-T6-2`, atribuído à task de fechamento da F1 — ele exige decidir também a retenção de
    // `identidade.tentativa_login`, e as duas decisões são de lá. Até que sejam tomadas, o estado
    // fica escrito aqui em vez de herdado do padrão de uma biblioteca.
    rateLimit: { enabled: false },

    database: drizzleAdapter(banco, {
      provider: 'pg',
      // O mapeamento de MODELO para tabela. Sem ele o adaptador procuraria `user`, `session` e
      // afins — nomes que este banco não tem, e nem deve ter.
      schema: { usuario, sessao, conta, verificacao, doisFatores },
    }),

    advanced: {
      // O arcabouço gera identificador em formato próprio (cadeia alfanumérica de 32 caracteres),
      // que o tipo `uuid` das chaves primárias recusa. `false` entrega a geração ao banco, onde o
      // `DEFAULT gen_random_uuid()` de cada tabela já está declarado — a mesma origem que a carga
      // inicial e as migrações usam. Verificado: sem isto, a criação de sessão falha na inserção.
      database: { generateId: false },
      // `Secure` sempre, e não "em produção": o cookie de sessão desta aplicação nunca deve
      // trafegar em claro, e o padrão do arcabouço (seguro só quando o ambiente diz produção) faz o
      // atributo depender de configuração de ambiente — que é onde ele some.
      useSecureCookies: true,
      defaultCookieAttributes: { httpOnly: true, secure: true, sameSite: 'lax' },
    },

    emailAndPassword: {
      enabled: true,
      // Nenhuma rota de cadastro público: pessoas nascem pelo convite do Master ou do Admin
      // (fatia seguinte). Deixar o cadastro ligado abriria criação de conta sem dono.
      disableSignUp: true,
      // O arcabouço só sabe conferir comprimento; a força é de `senha.ts`. O valor está aqui mesmo
      // assim para que as duas verificações não possam divergir no piso.
      minPasswordLength: 10,
    },

    // DÉBITO COM GATILHO — D21 · F1/T7 · registrado 2026-08-02 · gatilho DISPARADO nesta fatia
    //                       (F1/T8, 2026-08-02) — segue ABERTO
    // (Natureza OPOSTA à `DECISÃO FECHADA — T7` logo abaixo, e ele NÃO a alcança: aquela PROTEGE a
    //  topologia da barreira, que não se altera sem satisfazer o `REVERTER EXIGE`. Este AGENDA, e
    //  alcança só o que a recusa do gancho é incapaz de desfazer. Nada aqui autoriza mover, alterar
    //  ou remover a barreira nem a decisão abaixo.)
    // O QUÊ: a recusa deste gancho NÃO desfaz o que a rota já escreveu. Em `/change-password` o
    //        arcabouço persiste a senha nova e apaga as sessões ANTES de chegar aqui — medido em
    //        `better-auth@1.6.25`, onde `updateAccount` precede `deleteUserSessions` e
    //        `createSession` sem que as três corram numa transação comum. A pessoa recusada sai da
    //        requisição com a credencial TROCADA, com ZERO sessões, e recebendo um `401` que a
    //        RN-10 torna indistinguível de "a senha atual estava errada". Reativada depois pelo
    //        Master, ela não entra com a senha antiga e não sabe qual é a nova: perda de acesso que
    //        só intervenção administrativa desfaz, com a resposta afirmando que nada aconteceu.
    // QUANDO FECHA: JÁ DISPAROU — F1/T8 (2026-08-02). O gatilho registrado era "quando
    //        `/change-password` for montado em `apps/api`", e a T8 o montou: o encaminhador
    //        `@All('*')` de `apps/api/src/autenticacao/autenticacao.controller.ts` publica sob
    //        `/v1/auth` TODA rota do núcleo do arcabouço, e `/change-password` é uma delas
    //        (inventariada e fixada por asserção no CT-018 (d) de
    //        `apps/api/test/autenticacao.e2e.spec.ts`). As duas frases que sustentavam o adiamento
    //        deixaram de ser verdadeiras e por isso foram reescritas: NÃO é mais verdade que
    //        "nenhuma rota de identidade está montada", e a alcançabilidade NÃO é mais zero —
    //        basta sessão válida somada à senha atual correta, isto é, o próprio dono da conta.
    //        O débito segue ABERTO; o que mudou é que ele agora é alcançável.
    // POR QUE NÃO AGORA: fechar exige barrar ANTES da escrita de credencial — topologia POR ROTA,
    //        distinta da barreira de emissão que a T7 entrega —, e a rota publicada pela T8 é a
    //        NATIVA do arcabouço, não a do produto. Quem decide a forma da troca de senha (rota
    //        própria, senha provisória, convite, e se `/change-password` continua exposta) é a
    //        fatia `autorizacao-e-ciclo-de-acesso`; desenhar a barreira contra uma rota que aquela
    //        fatia vai redesenhar seria fechar o caminho errado, e a T8 é um ciclo de correção de
    //        gate, não o lugar de tomar a decisão de desenho daquela fatia.
    // ÍNDICE: docs/specs/features/fundacao-multitenancy-identidade/v1/_run/run-report.md §2, D21
    //
    // DECISÃO FECHADA — T7 · 2026-08-02
    // O QUÊ: a admissão de sessão tem UMA entrada, e ela está no gancho de criação de sessão do
    //        banco — não um gancho por rota, não um predicado instalado em cada ponto de extensão
    //        que o arcabouço oferece.
    // POR QUÊ: instalada por ponto, a propriedade sobrevive só até o ponto seguinte. Foi exatamente
    //          assim que a redação de credencial deste repositório sobreviveu a QUATRO correções,
    //          cada uma fechando com precisão o caminho apontado enquanto o defeito reaparecia por
    //          outro (`.claude/rules/nao-regressao.md` §7). Aqui a topologia é o argumento: toda
    //          emissão de sessão do arcabouço — de qualquer rota, de qualquer plugin, e das que uma
    //          versão futura acrescentar — passa por `internalAdapter.createSession`, e é dentro
    //          dele que este gancho corre. Não há caminho paralelo a fechar porque não há caminho
    //          paralelo: quem não passa por aqui não escreve em `identidade.sessao`.
    // REVERTER EXIGE: provar que nenhum caminho de emissão de sessão alcança o banco sem passar por
    //                 aqui.
    databaseHooks: {
      session: {
        create: {
          before: async (sessaoNova) => {
            const estado = await carregarEstadoDeAdmissao(banco, {
              usuarioId: sessaoNova.userId,
            });

            // Pessoa que não é mais resolvível entre a conferência da credencial e a emissão da
            // sessão: recusa. É a postura fail-closed do resto da fatia — na dúvida, nenhuma sessão
            // nasce —, e é o que impede que um estado inesperado seja lido como permissão.
            if (estado === undefined || !admitirSessao(estado, new Date()).admitida) {
              throw new APIError('UNAUTHORIZED', RECUSA_DE_CREDENCIAL);
            }
          },
        },
      },
    },

    // DÉBITO COM GATILHO — D7 · F1/T6 · registrado 2026-08-02
    // (Natureza OPOSTA às `DECISÃO FECHADA` deste arquivo — sem contá-las, porque o numeral
    //  envelhece a cada marcador novo: aquelas PROTEGEM o código sob elas, que não se altera sem
    //  satisfazer o `REVERTER EXIGE`. Esta AGENDA — o bloco abaixo VAI mudar, e o marcador só diz
    //  quando e sob que cuidado. Editá-lo é normal; editá-lo sem ler, não.)
    // O QUÊ: criar pessoa pelo adaptador é INEXEQUÍVEL. `perfil` e `empresa_id` são colunas do
    //        PRODUTO e não campos do modelo `user`; o `transformInput` do arcabouço itera apenas os
    //        campos declarados e descarta toda chave que não seja um deles, então o `INSERT` sai com
    //        `perfil` em `default` — coluna `NOT NULL` sem padrão — e o banco recusa. Medido contra
    //        o pacote publicado, não suposto.
    // QUANDO FECHA: quando a PRIMEIRA rota de criação de pessoa — onboarding com senha temporária ou
    //        convite do Master, ambos da fatia `autorizacao-e-ciclo-de-acesso` — precisar de
    //        `internalAdapter.createUser`. Nenhuma task restante desta fatia cria pessoa (T7 é a
    //        barreira de admissão, T8 publica `/v1`, T9 liga sessão a tenant, T10 fecha senha
    //        provisória e segundo fator por ATUALIZAÇÃO, T11 prova a equivalência das recusas), de
    //        modo que o gatilho não dispara aqui.
    //        Ao fechar, o par NÃO é uma coisa só: `perfil` e `empresa_id` têm consequências
    //        distintas quando abertos à escrita, e a segunda é a mais grave — ver abaixo.
    // POR QUE NÃO AGORA: declarar os dois como `additionalFields` muda o objeto de pessoa devolvido
    //        pela sessão, que é superfície pública — e a "sessão gorda" é decisão registrada da
    //        fatia de autorização —, e abre `perfil` à escrita por `updateUser`, o que é ELEVAÇÃO DE
    //        PRIVILÉGIO se o campo não nascer com `input: false`. Quando a decisão for tomada, o par
    //        `perfil`/`empresa_id` precisa nascer com a escrita FECHADA, e isso merece análise da
    //        superfície de privilégio. É decisão de desenho daquela fatia, não de um ciclo de
    //        correção de gate desta.
    //
    //        `empresa_id` NÃO É CARONA DE `perfil` — É A METADE MAIS GRAVE. O contexto de tenant
    //        nasce da sessão, que deriva de `identidade.usuario.empresa_id`; tornar essa coluna
    //        escrevível pelo corpo de um request faz A ORIGEM DO CONTEXTO DE RLS SER O REQUEST, por
    //        via indireta. A ADR-0008 fixa o oposto em texto literal — o `app.empresa_id` que a
    //        política consome "é fixado por transação com `SET LOCAL`, e sua origem **nunca é o
    //        request**" —, e isso é o invariante 2 do `CLAUDE.md`. `perfil` aberto é ELEVAÇÃO DE
    //        PRIVILÉGIO; `empresa_id` aberto é FUGA DE TENANT. Fechar só `perfil` — com a
    //        justificativa plausível "o Master precisa mover pessoa entre empresas" — derruba a
    //        ADR-0008 por um flag de configuração de biblioteca, sem que nada no banco acuse.
    //
    //        O ÚNICO GUARDA-CORPO ESTRUTURAL DE HOJE COBRE SÓ METADE DO ESPAÇO. O
    //        `usuario_master_sem_empresa_chk` (`packages/db/src/esquema/identidade.ts`) exige
    //        `(perfil = 'SYSLOC_MASTER') = (empresa_id IS NULL)`: ele barra a promoção a
    //        `SYSLOC_MASTER` com empresa preenchida, mas NÃO barra a troca de `empresa_id` de uma
    //        empresa para outra mantendo `ADMIN_EMPRESA` — que é exatamente a fuga de tenant. E
    //        nenhuma suíte pega isso: `identidade` não tem RLS, por decisão da ADR-0009.
    //
    //        `input: false` É DEFESA DE APLICAÇÃO, não estrutural. Ela é necessária, e pode não ser
    //        suficiente: a fatia de autorização precisa decidir se quer também defesa no banco. O
    //        caminho já está escrito — o D5 da §2 do run-report desta fatia aponta a promoção de
    //        `usuario` a par `(id, empresa_id)` ou um `CHECK` por função. É decisão de spec, a
    //        escalar, não de execução.
    //
    //        DUAS MEDIÇÕES JÁ FEITAS CONTRA O PACOTE PUBLICADO, para a fatia seguinte não as
    //        refazer (Staff, Gate 2 rodada 2): (a) sem `input: false`, `perfil` seria escrito pelo
    //        corpo de `POST /update-user` a partir de qualquer sessão autenticada; (b)
    //        `input: false` não inviabiliza o onboarding server-side. Ambas medidas contra
    //        `better-auth@1.6.25`; caminhos e linhas na §2 do run-report (ver ÍNDICE abaixo) — o
    //        endereço fica lá, e não aqui, porque é `path:linha` de saída de build de terceiro e
    //        deixa de valer no próximo bump.
    // ÍNDICE: docs/specs/features/fundacao-multitenancy-identidade/v1/_run/run-report.md §2, D7
    user: {
      modelName: 'usuario',
      // O mapeamento cobre **todos** os campos que o modelo `user` declara, e não só os que esta
      // fatia usa. Campo sem entrada aqui falha de dois jeitos: na criação de pessoa o adaptador
      // levanta `BetterAuthError`, e na atualização ele apenas não grava — `updatedAt`, que o
      // arcabouço acrescenta a TODO update, sumiria em silêncio. As colunas correspondentes entram
      // pela migração `0002`.
      fields: {
        name: 'nome',
        emailVerified: 'emailVerificado',
        image: 'imagem',
        createdAt: 'criadoEm',
        updatedAt: 'atualizadoEm',
      },
    },

    session: {
      modelName: 'sessao',
      expiresIn: DURACAO_DA_SESSAO_EM_SEGUNDOS,
      updateAge: RENOVACAO_DA_SESSAO_EM_SEGUNDOS,
      fields: {
        userId: 'usuarioId',
        expiresAt: 'expiraEm',
        createdAt: 'criadaEm',
        updatedAt: 'atualizadaEm',
        ipAddress: 'origem',
        userAgent: 'agente',
      },
    },

    account: {
      modelName: 'conta',
      fields: {
        userId: 'usuarioId',
        accountId: 'contaId',
        providerId: 'provedorId',
        password: 'senhaDerivada',
        createdAt: 'criadaEm',
        updatedAt: 'atualizadaEm',
      },
    },

    verification: {
      modelName: 'verificacao',
      fields: {
        identifier: 'identificador',
        value: 'valor',
        expiresAt: 'expiraEm',
        createdAt: 'criadaEm',
        updatedAt: 'atualizadaEm',
      },
    },

    plugins: [
      twoFactor({
        issuer: 'Sysloc',
        schema: {
          user: { fields: { twoFactorEnabled: 'doisFatoresAtivo' } },
          twoFactor: {
            modelName: 'doisFatores',
            // Os três últimos são escritos pelo PRÓPRIO adaptador (o plugin os declara com
            // `input: false`), então nenhum chamador os informa — e é justamente por isso que a
            // ausência deles passaria despercebida até a T10 criar a primeira linha e detonar.
            fields: {
              userId: 'usuarioId',
              secret: 'segredo',
              backupCodes: 'codigosRecuperacao',
              verified: 'verificado',
              failedVerificationCount: 'falhasVerificacao',
              lockedUntil: 'bloqueadoAte',
            },
          },
        },
      }),
    ],

    hooks: {
      before: createAuthMiddleware(async (ctx) => {
        // As duas validações de PRODUTO correm ANTES do desvio abaixo, e é obrigatório que seja
        // assim: elas não são da entrada, e o `return` seguinte encerraria o gancho para todo
        // caminho que não fosse `CAMINHO_DE_ENTRADA` — isto é, para os dois caminhos que elas
        // existem para alcançar. O bloco de comentário no topo das constantes diz por que elas
        // moram neste gancho e não no adaptador HTTP. Nada abaixo desta linha foi tocado.
        recusarCodigoMalFormado(ctx);
        await recusarSenhaNovaFraca(ctx, banco);

        if (ctx.path !== CAMINHO_DE_ENTRADA) {
          return;
        }

        const email = extrairEmail(ctx.body);
        if (email === null) {
          // Pedido malformado: quem recusa é a validação do arcabouço, e recusar aqui produziria uma
          // linha de trilha sem tentativa de entrada correspondente.
          return;
        }

        const estado = await carregarEstadoDeAdmissao(banco, { email });
        // E-mail inexistente segue o fluxo normal: o arcabouço derivará a senha assim mesmo (é o que
        // torna o tempo de resposta indistinguível), e o gancho `depois` registra o desfecho.
        if (estado === undefined) {
          return;
        }

        // A barreira decide — os cinco predicados vivem em `admissao.ts`, e a ordem deles é dela.
        // Admissão com restrição NÃO recusa: quem limita o alcance da sessão restrita é a guarda de
        // contexto, não a entrada.
        const admissao = admitirSessao(estado, new Date());
        if (admissao.admitida) {
          return;
        }

        await registrarTentativa(banco, {
          emailInformado: email,
          usuarioId: estado.usuarioId,
          desfecho: DESFECHO_POR_MOTIVO[admissao.motivo],
          origem: origemDoCliente(ctx),
          agente: agenteDoCliente(ctx),
        });

        // DECISÃO FECHADA — T6 / Gate 2 (P3) · 2026-08-02
        // O QUÊ: a senha informada é derivada e o resultado DESCARTADO, imediatamente antes de
        //        lançar a recusa por bloqueio.
        // POR QUÊ: a igualdade com a recusa por credencial cobria o corpo e deixava o TEMPO de
        //          fora. Todo outro desfecho paga o `scrypt` — o próprio arcabouço deriva e
        //          descarta nos três ramos de "não encontrado", justamente para nivelar —, e a
        //          conta bloqueada era a única resposta em milissegundos do fluxo. Isso enumera
        //          contas em seis requisições: cinco erradas contra um e-mail candidato e uma
        //          sexta, cuja resposta rápida confirma que o e-mail EXISTE.
        // REVERTER EXIGE: provar que a latência da recusa por bloqueio é indistinguível da dos
        //                 demais desfechos por outro mecanismo. "É derivação inútil" não basta:
        //                 a inutilidade do resultado é o ponto, não um descuido.
        //
        // Derivar SEM comparar não é conferir a senha de uma conta trancada — o argumento do
        // cabeçalho ("recusar depois significaria conferir a senha de uma conta trancada")
        // permanece intacto, e esta frase existe para que a rodada seguinte não "otimize" a
        // derivação de volta.
        await ctx.context.password.hash(extrairSenha(ctx.body));

        throw new APIError('UNAUTHORIZED', RECUSA_DE_CREDENCIAL);
      }),

      after: createAuthMiddleware(async (ctx) => {
        if (ctx.path !== CAMINHO_DE_ENTRADA) {
          return;
        }

        const email = extrairEmail(ctx.body);
        if (email === null) {
          return;
        }

        // Segunda busca da mesma pessoa, e é deliberado: o contexto do gancho `antes` NÃO é o mesmo
        // objeto do `depois` (verificado contra o pacote publicado), então não há onde guardar o
        // resultado da primeira. Uma leitura por chave única custa ordens de grandeza menos que a
        // derivação de senha que acabou de rodar.
        const pessoa = await buscarPessoa(banco, email);
        const registro = {
          emailInformado: email,
          origem: origemDoCliente(ctx),
          agente: agenteDoCliente(ctx),
        };

        if (pessoa === undefined) {
          // Autor nulo, e apenas aqui: é o único caso em que não há a quem vincular a tentativa, e é
          // o motivo de a coluna ser anulável no schema.
          await registrarTentativa(banco, {
            ...registro,
            usuarioId: null,
            desfecho: 'EMAIL_INEXISTENTE',
          });
          return;
        }

        // DECISÃO FECHADA — T6 / Gate 2 (P5) · 2026-08-02
        // O QUÊ: só o `APIError` cujo `code` é o da recusa de credencial conta como credencial
        //        incorreta. Qualquer outro `APIError` grava `ACESSO_RECUSADO` e **não** incrementa
        //        o contador de bloqueio.
        // POR QUÊ: discriminar por `instanceof APIError` tratava como erro da pessoa o que é erro
        //          do servidor ou do pedido. O mesmo manipulador emite `FAILED_TO_CREATE_SESSION`
        //          (depois da conferência BEM-SUCEDIDA da senha), `INVALID_EMAIL` e
        //          `EMAIL_PASSWORD_DISABLED` pela mesma via. Consequência medida: uma
        //          indisponibilidade parcial do banco na criação de sessão trancava contas
        //          legítimas depois de cinco entradas CERTAS, e a trilha registrava cinco
        //          credenciais incorretas que nunca existiram — a trilha passava a afirmar sobre a
        //          pessoa um fato que é do servidor, e é essa trilha que a operação lê para decidir
        //          se houve ataque. A RN-06 conta falhas DE CREDENCIAL.
        // REVERTER EXIGE: provar que nenhum outro `APIError` alcança este ponto — o que a leitura
        //                 do manipulador publicado desmente hoje.
        //
        // A forma é igualdade com UM código, e não exclusão de uma lista de códigos conhecidos: um
        // desfecho novo do arcabouço cai por padrão no ramo que não incrementa, que é o lado seguro.
        //
        // ----------------------------------------------------------------------------------
        // Efeito colateral desta escolha, espelhado aqui porque é AQUI que ele nasce
        // (comentário ADJACENTE à decisão acima, e não parte dela: nada nas quatro linhas
        //  canônicas foi tocado — o oráculo do vocabulário continua sendo o comentário do enum
        //  `desfechoTentativa` em `packages/db/src/esquema/identidade.ts`, onde a fronteira está
        //  escrita por extenso e é onde ela deve ser mantida.)
        // ----------------------------------------------------------------------------------
        // `ACESSO_RECUSADO` passou a ter TRÊS origens e NÃO as distingue: recusa de política
        // (RN-10 — pessoa desativada, empresa suspensa; volume normal a partir da T7), defeito de
        // servidor (`FAILED_TO_CREATE_SESSION`, gravado no ramo abaixo) e pedido malformado
        // (`INVALID_EMAIL`). Consequência: um pico causado por indisponibilidade parcial do banco
        // fica indistinguível de um pico de tentativas contra contas desativadas — o sinal de
        // ataque que a RN-11 existe para tornar legível. Separá-los EXIGE valor novo no enum;
        // pendência `P-T6-1`, escrita por extenso em `docs/specs/features/
        // fundacao-multitenancy-identidade/v1/tasks/T8.md` §7, com dono na **task de fechamento da
        // F1** — não na T8, que recusou o escopo por decisão registrada (`_run/workflow-report.md`,
        // D-E3). Fechar aqui obriga a mexer no `DESFECHO_POR_MOTIVO` deste arquivo, que é parte do
        // blast radius que aquela decisão pesou.
        //
        // ----------------------------------------------------------------------------------
        // Janela de corrida conhecida, anotada em vez de corrigida
        // (segundo comentário ADJACENTE à decisão acima, e não parte dela: nenhuma das quatro
        //  linhas canônicas foi tocada, e o discriminador continua sendo o código do `APIError`.)
        // ----------------------------------------------------------------------------------
        // A recusa que a barreira levanta no ponto de emissão de sessão carrega o MESMO código
        // desta comparação — `RECUSA_DE_CREDENCIAL` —, e isso é DESENHO: é o que torna a recusa de
        // política indistinguível da recusa por senha errada (RN-10). O preço é que, se ela chegar
        // aqui, cai no ramo `CREDENCIAL_INCORRETA` e incrementa o contador da RN-06 numa tentativa
        // cuja credencial estava CERTA.
        // O alcance foi medido e é ESTREITO: este gancho só roda para `CAMINHO_DE_ENTRADA`, e ali
        // o `antes` já recusou a pessoa inadmissível antes de qualquer emissão — sobra apenas a
        // CORRIDA em que o estado muda (desativação, suspensão, bloqueio) entre a leitura do
        // `antes` e a do gancho de banco, janela que inclui o `scrypt`. Nos demais caminhos
        // emissores de sessão o `depois` não roda, e nenhuma linha é escrita.
        // NÃO se fecha consultando a barreira aqui: seria mudar comportamento na vizinhança da
        // decisão acima para atenuar, numa corrida, o contador de uma conta que já está recusada
        // de qualquer modo — superfície de regressão desproporcional ao dano. Fica anotado para
        // que a rodada seguinte reconheça a janela em vez de a redescobrir como defeito novo.
        const recusa = ctx.context.returned;
        if (recusa instanceof APIError) {
          const desfecho =
            recusa.body?.code === RECUSA_DE_CREDENCIAL.code
              ? 'CREDENCIAL_INCORRETA'
              : // `ACESSO_RECUSADO`, e não "nenhuma linha": a RN-11 manda registrar TODA tentativa,
                // e o desfecho é literalmente verdadeiro — a tentativa não resultou em acesso, e
                // não foi por credencial incorreta. Omitir a linha deixaria um buraco na trilha
                // exatamente na janela em que o servidor está com defeito.
                'ACESSO_RECUSADO';

          if (desfecho === 'CREDENCIAL_INCORRETA') {
            await registrarFalha(banco, pessoa.id);
          }

          await registrarTentativa(banco, { ...registro, usuarioId: pessoa.id, desfecho });
          return;
        }

        await limparBloqueio(banco, pessoa.id);
        await registrarTentativa(banco, {
          ...registro,
          usuarioId: pessoa.id,
          desfecho: 'SUCESSO',
        });
      }),
    },
  });
}

/**
 * O que a trilha precisa saber da pessoa: a quem vincular a linha.
 *
 * Encolheu na T7. Até ali este tipo carregava também o par `tentativas_falhas`/`bloqueado_ate`,
 * porque era o gancho `antes` quem avaliava o bloqueio; agora quem lê esse par é a barreira, pelo
 * estado que ela mesma carrega. Manter as duas colunas aqui seria leitura sem leitor.
 */
interface PessoaDaEntrada {
  readonly id: string;
}

/**
 * Resolve a pessoa pelo e-mail informado.
 *
 * O e-mail chega já normalizado por `extrairEmail`. A coluna guarda minúsculas (§6.1: a normalização
 * é ponto único na borda), então comparar sem normalizar faria `Ana@…` não encontrar a conta de
 * `ana@…` — e a pessoa receberia "credencial inválida" por causa da tecla de maiúsculas.
 */
async function buscarPessoa(
  banco: BancoDeIdentidade,
  email: string,
): Promise<PessoaDaEntrada | undefined> {
  const { usuario } = esquemaIdentidade;

  const [pessoa] = await banco
    .select({ id: usuario.id })
    .from(usuario)
    .where(eq(usuario.email, email))
    .limit(1);

  return pessoa;
}

// ---------------------------------------------------------------------------------------------
// As duas validações de produto — implementação
// ---------------------------------------------------------------------------------------------

/**
 * O contexto que o arcabouço entrega a um gancho.
 *
 * Derivado do próprio arcabouço, e não escrito à mão nem importado de `@better-auth/core`: aquele
 * pacote é dependência **transitiva** e declará-lo no manifesto só para nomear um tipo acrescentaria
 * ao pacote uma dependência que o código não usa. `getSessionFromCtx` é a função que exige o
 * contexto mais completo entre as usadas aqui, então o parâmetro dela é exatamente o tipo procurado
 * — e ele acompanha o arcabouço em qualquer bump, sem cópia para envelhecer.
 */
type ContextoDeEndpoint = Parameters<typeof getSessionFromCtx>[0];

/** Como o dono da senha é resolvido num caminho. Nulo quando não há quem resolver. */
type LeitorDoDonoDaSenha = (
  ctx: ContextoDeEndpoint,
  banco: BancoDeIdentidade,
) => Promise<PessoaDaSenha | undefined>;

/**
 * Recusa a senha nova que não passa na política de força (RN-05), com o motivo.
 *
 * O disparo é o CAMPO, e não o caminho: ver o bloco no topo das constantes. Corpo sem
 * {@link CAMPO_DA_SENHA_NOVA} não é definição de senha e sai daqui sem custo — inclusive a entrada,
 * que passa por este gancho a cada tentativa.
 *
 * **Dono não resolvido não valida.** Quem chega sem sessão a `/change-password`, ou com token de
 * redefinição inválido, segue para o arcabouço, que é quem recusa: validar o corpo de quem não se
 * identificou diria a um anônimo se a senha que ele mandou é forte, e a resposta seria um oráculo
 * de política aberto. A credencial não corre risco nisso — sem sessão e sem token, o manipulador
 * não escreve nada.
 *
 * O motivo vai em `detalhes`, como a §6.1 fixa, e é o rótulo fechado que `avaliarForcaDeSenha`
 * devolve — nunca texto livre, e **nunca** a senha informada nem trecho dela: `detalhes` viaja para
 * a resposta e para o registro estruturado, e um motivo que citasse a senha a levaria para os dois
 * (RN-12).
 */
async function recusarSenhaNovaFraca(
  ctx: ContextoDeEndpoint,
  banco: BancoDeIdentidade,
): Promise<void> {
  const senhaNova = campoTextual(ctx.body, CAMPO_DA_SENHA_NOVA);

  if (senhaNova === undefined) {
    return;
  }

  const leitor: LeitorDoDonoDaSenha =
    DONO_POR_CAMINHO_QUE_DEFINE_SENHA[ctx.path as keyof typeof DONO_POR_CAMINHO_QUE_DEFINE_SENHA] ??
    donoDaSessao;
  const dono = await leitor(ctx, banco);

  if (dono === undefined) {
    return;
  }

  const avaliacao = avaliarForcaDeSenha(senhaNova, dono);

  if (avaliacao.aprovada) {
    return;
  }

  throw new APIError('UNPROCESSABLE_ENTITY', {
    ...RECUSA_DE_CAMPO_INVALIDO,
    campo: CAMPO_DA_SENHA_NO_ERRO,
    detalhes: { motivos: avaliacao.motivos },
  });
}

/**
 * Recusa o código do segundo fator que não tem a forma de um código (§6.1).
 *
 * Código ausente ou que não seja texto **não** é recusado aqui: quem responde por corpo malformado
 * é o esquema de validação do arcabouço, e duplicar essa recusa produziria duas respostas para o
 * mesmo pedido inválido, livres para divergir.
 */
function recusarCodigoMalFormado(ctx: ContextoDeEndpoint): void {
  if (ctx.path !== CAMINHO_DA_VERIFICACAO_DO_SEGUNDO_FATOR) {
    return;
  }

  const codigo = campoTextual(ctx.body, CAMPO_DO_CODIGO);

  if (codigo === undefined || CODIGO_DO_SEGUNDO_FATOR.test(codigo)) {
    return;
  }

  throw new APIError('UNPROCESSABLE_ENTITY', {
    ...RECUSA_DE_CAMPO_INVALIDO,
    campo: CAMPO_DO_CODIGO_NO_ERRO,
  });
}

/**
 * O dono da senha quando ele é quem está autenticado no pedido.
 *
 * A conferência é a **do arcabouço**, a mesma que a sessão de qualquer rota dele usa: um segundo
 * jeito de decidir "há sessão aqui?" seria um segundo jeito de errar. `disableRefresh` porque esta
 * leitura pode terminar em recusa, e renovar a validade de uma sessão por causa de um pedido que
 * vai ser rejeitado é efeito colateral que a política não deve ter — quem renova é o manipulador,
 * se o pedido chegar até ele.
 */
async function donoDaSessao(ctx: ContextoDeEndpoint): Promise<PessoaDaSenha | undefined> {
  const autenticada = await getSessionFromCtx(ctx, { disableRefresh: true });

  return autenticada === null
    ? undefined
    : { nome: autenticada.user.name, email: autenticada.user.email };
}

/**
 * O dono da senha quando quem o identifica é o token de uso único da redefinição.
 *
 * A leitura é `findVerificationValue` escrita no ORM deste pacote, e **não** consome o token: o
 * manipulador é que o consome, e gastá-lo aqui faria toda redefinição recusada pela política
 * queimar o token junto — a pessoa perderia o direito de tentar de novo por ter escolhido uma senha
 * fraca.
 *
 * O token vem do corpo ou da consulta, **pela mesma regra do manipulador — inclusive o descarte da
 * cadeia vazia**, e não apenas na mesma ordem que ele. Ver a decisão fechada abaixo.
 *
 * **A classe é "valor que o gancho relê do mesmo pedido que o manipulador".** Este token é o ÚNICO
 * que o arcabouço lê por CADEIA de origens; os demais valores que este gancho relê — `newPassword`
 * (`ctx.body.newPassword`), `code` (`ctx.body.code`), `email` e `password` de `/sign-in/email` —
 * são campo simples do corpo, sem consulta nem parâmetro de rota por trás.
 *
 * A propriedade de que a política depende é **"a leitura do gancho nunca é estritamente menor que a
 * do manipulador"** — e não "é subconjunto dela". As duas formas a satisfazem, e a distinção
 * importa porque um dos quatro valores é superconjunto:
 *
 * - **Subconjunto** é o caso de `newPassword`, `code` e `password`: {@link campoTextual} só devolve
 *   valor quando ele é texto, e o que não é texto o esquema do endpoint recusa antes de o
 *   manipulador ler.
 * - **Superconjunto, e deliberado** é o caso do `email` de `/sign-in/email`. Este gancho normaliza
 *   (`.trim().toLowerCase()`, ver {@link extrairEmail}) e o manipulador valida o e-mail **cru**
 *   — medido em `better-auth@1.6.25`, `dist/api/routes/sign-in.mjs:286`:
 *   `if (!z.email().safeParse(email).success) throw … INVALID_EMAIL`, sem `trim`. Um `' ana@x '`
 *   resolve aqui e é recusado lá.
 *
 * A divergência **falha fechado** — o pedido morre no manipulador antes de qualquer efeito — e não
 * é para ser "corrigida": alinhar a leitura seria mexer numa propriedade que já está segura, contra
 * a proibição 5 da `.claude/rules/nao-regressao.md`. O que importa é que, nos dois sentidos, um
 * valor que chegue ao manipulador não tem como ficar invisível a este gancho.
 */
// DECISÃO FECHADA — T10 / Gate 2 (rodada 2) · 2026-08-02
// O QUÊ: a leitura do token replica a REGRA DE VERACIDADE do manipulador — corpo primeiro, e a
//        cadeia VAZIA do corpo cai para a consulta —, e não a ordem em que ele lê as duas origens.
// POR QUÊ: com `??`, que é a forma idiomática em TypeScript, o gancho lia `token: ''` do corpo como
//          valor presente enquanto o manipulador (`ctx.body.token || ctx.query?.token`) o descartava
//          e usava o da consulta. O esquema aceita `token` opcional nas duas origens, então `''` é
//          entrada válida: o resolvedor procurava um identificador inexistente, devolvia dono
//          indefinido, a política de força saía SEM VALIDAR — e o manipulador gravava a credencial
//          fraca logo em seguida. A RN-05 contornada exatamente no caminho que este gancho existe
//          para alcançar.
// REVERTER EXIGE: provar que o manipulador publicado deixou de encadear corpo e consulta por
//                 veracidade — isto é, que `/reset-password` não usa mais `||` entre os dois.
//                 Igualdade de ORDEM não basta, e é o erro a não repetir: foi a ordem igual com
//                 semântica de vazio diferente que abriu o desvio.
async function donoDoTokenDeRedefinicao(
  ctx: ContextoDeEndpoint,
  banco: BancoDeIdentidade,
): Promise<PessoaDaSenha | undefined> {
  const token = campoTextualNaoVazio(ctx.body, 'token') ?? campoTextualNaoVazio(ctx.query, 'token');

  if (token === undefined) {
    return undefined;
  }

  const { usuario, verificacao } = esquemaIdentidade;

  const [emitido] = await banco
    .select({ usuarioId: verificacao.valor })
    .from(verificacao)
    .where(eq(verificacao.identificador, `${PREFIXO_DO_TOKEN_DE_REDEFINICAO}${token}`))
    .limit(1);

  if (emitido === undefined) {
    return undefined;
  }

  const [pessoa] = await banco
    .select({ nome: usuario.nome, email: usuario.email })
    .from(usuario)
    .where(eq(usuario.id, emitido.usuarioId))
    .limit(1);

  return pessoa;
}

/** O valor textual de um campo do corpo já interpretado, ou `undefined` se não há um. */
function campoTextual(corpo: unknown, campo: string): string | undefined {
  if (typeof corpo !== 'object' || corpo === null) {
    return undefined;
  }

  const valor = (corpo as Record<string, unknown>)[campo];
  return typeof valor === 'string' ? valor : undefined;
}

/**
 * O mesmo, **descartando a cadeia vazia** — a regra com que o arcabouço encadeia origens.
 *
 * Ele existe para que a leitura de um valor que o manipulador busca em mais de um lugar (`corpo ||
 * consulta`) seja escrita UMA vez, com a semântica dele, em vez de reproduzida por ordem em cada
 * ponto de leitura. Encadear os dois retornos desta função com `??` é o equivalente exato do `||` do
 * arcabouço para campo textual — e é o único encadeamento por veracidade que este pacote precisa
 * hoje, no token da redefinição.
 */
function campoTextualNaoVazio(objeto: unknown, campo: string): string | undefined {
  const valor = campoTextual(objeto, campo);
  return valor === undefined || valor === '' ? undefined : valor;
}

/**
 * A senha do corpo do pedido, ou a cadeia vazia quando o corpo não traz uma.
 *
 * A cadeia vazia, e não um retorno nulo com ramo condicional: o único consumidor é a derivação que
 * nivela o tempo, e um ramo que pulasse a derivação quando a senha está ausente reabriria — em
 * miniatura — exatamente o canal lateral que a derivação existe para fechar.
 */
function extrairSenha(corpo: unknown): string {
  if (typeof corpo !== 'object' || corpo === null) {
    return '';
  }

  const senha = (corpo as { password?: unknown }).password;
  return typeof senha === 'string' ? senha : '';
}

/** O e-mail do corpo do pedido, normalizado, ou nulo se o corpo não traz um. */
function extrairEmail(corpo: unknown): string | null {
  if (typeof corpo !== 'object' || corpo === null) {
    return null;
  }

  const email = (corpo as { email?: unknown }).email;
  return typeof email === 'string' && email.length > 0 ? email.trim().toLowerCase() : null;
}

/** Contexto de gancho, no mínimo que estas funções consomem. */
interface ContextoDeGancho {
  readonly headers?: Headers | undefined;
  readonly request?: Request | undefined;
  readonly context: { readonly options: Parameters<typeof getIp>[1] };
}

/**
 * Endereço de rede do cliente, como o arcabouço o apura.
 *
 * `getIp` é do próprio arcabouço, e não um leitor de cabeçalho escrito aqui: ele **valida** o
 * endereço (IPv4 ou IPv6) e devolve nulo quando nenhum é confiável. A coluna `origem` é `inet`, e um
 * valor malformado derrubaria a gravação da trilha — a validação na origem é o que impede que um
 * cabeçalho forjado transforme a auditoria em erro de servidor.
 */
function origemDoCliente(ctx: ContextoDeGancho): string | null {
  const cabecalhos = ctx.headers ?? ctx.request;
  return cabecalhos === undefined ? null : (getIp(cabecalhos, ctx.context.options) ?? null);
}

/** Identificação do programa cliente, quando declarada. */
function agenteDoCliente(ctx: ContextoDeGancho): string | null {
  return ctx.headers?.get('user-agent') ?? ctx.request?.headers.get('user-agent') ?? null;
}
