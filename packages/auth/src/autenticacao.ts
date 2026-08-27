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

/**
 * O cabeçalho de onde o endereço do cliente é lido.
 *
 * É o mesmo que o arcabouço leria por omissão, e está **declarado** pela razão que este arquivo já
 * aplica a `enabled`, a `disableOriginCheck` e à tranca do segundo fator: padrão de biblioteca não
 * declarado muda no próximo bump sem que nada acuse — e aqui o que mudaria em silêncio é o eixo do
 * qual toda a política de limitação depende.
 */
const CABECALHO_DE_ORIGEM = 'x-forwarded-for';

/**
 * Os saltos confiáveis imediatamente à frente desta API — o fecho do `D27 · F1/T6` (ADR-0037).
 *
 * ---------------------------------------------------------------------------
 * O endereço é MEDIDO, e medir era a coisa que faltava
 * ---------------------------------------------------------------------------
 *
 * O débito recusou por duas fases declarar um salto **suposto**, e a razão está escrita nele:
 * `trustedProxies` errado transforma cabeçalho forjado em origem aceita, **com aparência de
 * correção**. O que o fecha, portanto, não é a coragem de declarar — é o endereço existir para ser
 * lido. Ele existe, e é `127.0.0.1`, medido na borda que já opera:
 * `/opt/web/syslocadmin/nginx/default.conf` declara `set_real_ip_from 127.0.0.1` com a razão por
 * extenso (*"o CloudPanel é o único salto à frente e fala de 127.0.0.1"*), e repassa para
 * `http://127.0.0.1:3000`, que é onde este processo escuta.
 *
 *   navegador --443--> CloudPanel --127.0.0.1--> nginx local --127.0.0.1:3000--> esta API
 *
 * ---------------------------------------------------------------------------
 * Por que UM endereço, e por que este
 * ---------------------------------------------------------------------------
 *
 * O que entra aqui **não** é "quem pode falar com a API" — é **quem, na cadeia de encaminhamento,
 * tem permissão de dizer quem é o cliente**. `getIPFromHeader` (medido em
 * `@better-auth/core@1.6.25`, `dist/utils/ip.mjs`) percorre a cadeia **da direita para a esquerda**,
 * pula todo termo que casa com esta lista, e adota como eixo o **primeiro termo não confiável**.
 * Todo termo à esquerda dele — inclusive o que o cliente escreveu antes de o primeiro salto tocar a
 * requisição — é descartado por construção. É isso que torna a rotação do cabeçalho forjado inócua,
 * e é a mitigação que a ADR-0037 nomeia nos `Cons`.
 *
 * Segue-se que a lista é o **complemento** do endereço do cliente, e não um catálogo de permissões:
 * acrescentar aqui um endereço que não seja salto de infraestrutura desta máquina **apagaria** esse
 * endereço do eixo, entregando o balde a quem estiver atrás dele. `::1` fica de fora pela mesma
 * razão, e não por descuido: nenhum salto da topologia medida se anuncia assim na cadeia — o
 * CloudPanel fala de `127.0.0.1` e o nginx local repassa por IPv4. Declarar um termo que a cadeia
 * real nunca traz é adivinhação, que é justamente o que o débito recusou.
 *
 * ⚠️ **Entrada inválida é descartada com um AVISO, e não com recusa de partida** (`create-context`,
 * `findInvalidTrustedProxies`). Se todas fossem inválidas a lista viraria vazia e o comportamento
 * voltaria ao regime que este fecho encerra — em silêncio para a suíte. É por isso que o `CT-1170`
 * lê a declaração **na instância** e a afirma **não vazia**, em vez de conferir o texto do fonte.
 *
 * **Exportada para ser ancorável**, pelo mesmo critério de {@link JANELA_DO_LIMITADOR_EM_SEGUNDOS}.
 * Não sai no índice do pacote — nenhum consumidor de fora lê a configuração da instância.
 *
 * ---------------------------------------------------------------------------
 * ⚠️ O QUE SUSTENTA ESTE EIXO NÃO É A DECLARAÇÃO DAQUI — é a borda APENSAR
 * ---------------------------------------------------------------------------
 *
 * Toda borda que alcance `/v1/auth/*` ou `POST /v1/sessao/senha` tem de **apensar** o endereço
 * observado (`$proxy_add_x_forwarded_for`), e **nenhuma** pode repassar o `X-Forwarded-For` do
 * cliente sem apensar. Uma borda que repassasse faria do termo mais à direita um valor **escolhido
 * por quem chama**, e `getIPFromHeader` o adotaria como eixo: o teto viraria evadível por rotação de
 * cabeçalho — **pior** que o regime anterior a este fecho, em que a cadeia resolvia para `null` e
 * todos caíam num balde único, compartilhado mas não evadível. É o `Con` que a ADR-0037 nomeia.
 *
 * Era o `D39 · F7/T8`, e ele **fechou em 2026-08-26**, na T9 da fatia `publicacao-e-backup`, que é o
 * gatilho que o marcador nomeava: a borda que faltava passou a existir
 * (`deploy/nginx/sysloc-app.conf`) e apensa. As três bordas do produto estão conformes, e as duas
 * anteriores já haviam sido medidas — o vhost do Master e o da notícia bancária.
 *
 * A propriedade deixou de depender de quem escreve o vhost, e passou a ter rede em duas frentes, as
 * duas em `deploy/scripts/borda/verificar-borda-do-app.sh`:
 *
 *   * `CT-1187` mede **por rede**, com cabeçalho FORJADO, que o salto real chega **sobrescrito** pelo
 *     endereço observado e que a cadeia chega **apensada**, com o observado à direita;
 *   * `CT-1188` fixa a **forma** no gabarito versionado — a diretiva que apensa presente, a que
 *     repassaria ausente, e nenhuma reescrita de origem de rede —, que é o que a próxima borda copia.
 */
export const SALTOS_CONFIAVEIS = ['127.0.0.1'] as const;

/**
 * Janela do limitador de taxa nativo, em segundos (§11.5, `P-T6-2`).
 *
 * Um minuto, e a mesma janela para as duas regras: o que distingue o caminho de entrada dos demais
 * é o TETO, não o período. Dois períodos diferentes só acrescentariam um número a manter.
 *
 * A janela é **rolante a partir do último pedido**, e não fixa a partir do primeiro — medido no
 * pacote publicado: o contador só zera quando o intervalo entre dois pedidos consecutivos passa da
 * janela. Quem insiste sem parar não obtém o zeramento pela passagem do tempo.
 *
 * **Exportada para ser ancorável**, pelo mesmo critério de {@link DURACAO_DA_SESSAO_EM_SEGUNDOS}:
 * sem uma asserção que amarre o número à política, ele é literal órfão e alargá-lo até o limitador
 * nunca disparar não reprovaria caso nenhum. A âncora vive no CT-236 (`test/bloqueio.spec.ts`).
 * Não sai no índice do pacote — nenhum consumidor de fora lê a configuração da instância.
 */
export const JANELA_DO_LIMITADOR_EM_SEGUNDOS = 60;

/**
 * Quantas tentativas de ENTRADA uma mesma origem obtém por janela.
 *
 * **A CONDIÇÃO EM QUE ESTE NÚMERO É "POR ORIGEM", E ELA VALE DESDE 2026-08-26.** O eixo de
 * identidade do limitador é o endereço que `getIp` apura a partir do cabeçalho declarado, e ele
 * depende de um salto confiável estar declarado em `advanced.ipAddress`. Enquanto não estava, em
 * produção `getIp` devolvia nulo, a chave virava uma só por caminho e este teto era o do PRODUTO
 * INTEIRO ali — era o `D27 · F1/T6`. {@link SALTOS_CONFIAVEIS} o declara a partir de endereço
 * medido, e o dimensionamento abaixo passou a ser o regime em vigor, não o regime pretendido. O
 * `CT-1167` e o `CT-1170` (`test/bloqueio.spec.ts`) são a rede disso, e o `CT-236 (c)` fixa o que
 * sobrou do balde compartilhado: ele é agora o do pedido cuja origem NÃO se apura.
 *
 * O teto é por origem e por caminho, e precisa caber o pior caso legítimo: uma imobiliária inteira
 * atrás de um endereço só, abrindo o expediente ao mesmo tempo (decisão 2 — 20 a 300 empresas com
 * equipes pequenas). Trinta cobre esse pico com folga e ainda corta o regime que a RN-06 não vê: a
 * pulverização de uma senha por conta, em que nenhuma conta chega às cinco falhas do bloqueio.
 *
 * Ele é MENOR que {@link TETO_GERAL_POR_JANELA} de propósito: a entrada é o único caminho em que
 * cada pedido custa uma derivação de senha, e é o único que um atacante repete sem credencial
 * nenhuma na mão.
 *
 * Exportada pela mesma razão da constante acima, e com o mesmo critério de índice.
 */
export const TETO_DE_ENTRADAS_POR_JANELA = 30;

/**
 * Quantos pedidos uma mesma origem obtém, por janela, nos caminhos que CRIAM, CONFEREM ou TROCAM
 * credencial fora do fluxo de entrada.
 *
 * «Por origem» aqui vale sob a MESMA condição declarada em {@link TETO_DE_ENTRADAS_POR_JANELA}, e
 * ela vale desde que {@link SALTOS_CONFIAVEIS} declarou o eixo.
 *
 * O grupo é `/sign-in/*` (as variantes que não são a entrada), `/sign-up/*`, `/change-password` e
 * `/change-email`. O que eles têm em comum não é a rota: é **não existir contador por conta ali**.
 * A RN-06 conta falhas por conta no caminho de entrada, e só nele — o gancho `depois` deste arquivo
 * retorna cedo para todo `ctx.path` que não seja {@link CAMINHO_DE_ENTRADA}, de modo que
 * `registrarFalha` nunca corre nesses caminhos. Neles o limitador **é a única camada**, e é por isso
 * que o teto não pode ser o geral.
 *
 * Dez, e não os trinta da entrada: nenhum destes caminhos tem pico coletivo. A entrada tem — a
 * imobiliária inteira abrindo o expediente atrás de um endereço só —, e é dela que vêm os trinta.
 * Trocar a própria senha, ou o próprio e-mail, é ato individual e raro; dez por minuto cobrem a
 * redigitação de algumas pessoas atrás do mesmo endereço e continuam **mais estreitos** que os 3 por
 * 10 s (18 por minuto) que o padrão do arcabouço dava a este grupo.
 *
 * Duas das rotas do grupo estão inertes hoje por configuração — `/sign-up/*` por `disableSignUp`,
 * `/sign-in/social` por não haver provedor social declarado, `/change-email` por a opção não ser
 * passada. **É justamente por isso que elas entram**: a inércia é uma linha de configuração, e um
 * teto que dependa dela some no dia em que a linha mudar, sem que nada acuse.
 *
 * **Exportada para ser ancorável**, pelo mesmo critério de {@link TETO_DE_ENTRADAS_POR_JANELA}. A
 * âncora vive no CT-236 (`test/bloqueio.spec.ts`), com a perna comportamental de
 * `/change-password` — o caminho do grupo que confere `currentPassword`.
 *
 * **Como `/change-password` é alcançado, e por que a distinção importa** (T9 da fatia
 * `autorizacao-e-ciclo-de-acesso`): ele **deixou de ser publicado** sob `/v1/auth` — o encaminhador
 * de `apps/api` responde `404` a ele —, e passou a ser alcançado apenas por dentro, no repasse que
 * `POST /v1/sessao/senha` faz ao **manipulador** desta instância. O teto, portanto, continua
 * governando toda troca de senha do produto; o que mudou é que o balde é alimentado por uma rota
 * só. A perna do CT-236 em `test/bloqueio.spec.ts` exercita a INSTÂNCIA, que é o lado da fronteira
 * que este pacote alcança; a perna sobre a **superfície publicada** vive em
 * `apps/api/test/campos-fechados.e2e.spec.ts`, e é ela que impede este número de voltar a ser
 * literal órfão do lado do produto.
 */
export const TETO_DE_CREDENCIAL_POR_JANELA = 10;

/**
 * Quantos pedidos uma mesma origem obtém, por janela, nos caminhos que DISPARAM E-MAIL para um
 * endereço informado no próprio pedido.
 *
 * «Por origem» aqui vale sob a MESMA condição declarada em {@link TETO_DE_ENTRADAS_POR_JANELA}, e
 * ela vale desde que {@link SALTOS_CONFIAVEIS} declarou o eixo.
 *
 * O grupo é `/request-password-reset`, `/send-verification-email` e a família
 * `/forget-password/**`. O teto mais estreito dos três é deste grupo porque o custo de cada pedido
 * **não é do servidor nem de quem pede**: é da caixa de entrada de um terceiro, escolhido pelo
 * atacante. Um teto folgado aqui transforma a identidade do produto em remetente de mensagem não
 * solicitada, e a reputação do domínio de envio é o que se perde.
 *
 * Cinco, e não os 3 por 60 s do padrão do arcabouço: o padrão foi escolhido sem saber que este
 * produto tem origens compartilhadas por desenho (decisão 2 — imobiliárias inteiras atrás de um
 * endereço), e três recusaria a terceira pessoa do escritório que pedisse a redefinição no mesmo
 * minuto. Cinco é a mesma ordem de grandeza do padrão, e vinte e quatro vezes mais estreito que
 * {@link TETO_GERAL_POR_JANELA}.
 *
 * `/forget-password` não existe no núcleo do `better-auth@1.6.25` — é o nome histórico do
 * `/request-password-reset`, e hoje só o plugin `email-otp`, que este projeto não instala, publica
 * caminho com esse prefixo. A entrada fica assim mesmo: ela custa uma chave e não depende de o nome
 * voltar num bump. Os dois caminhos `/email-otp/*` que o padrão também cobria ficam de fora pelo
 * motivo oposto — declará-los seria configurar um plugin ausente, e a rede contra a instalação dele
 * já existe e é comportamental: o CT-018 (d) de `apps/api/test/autenticacao.e2e.spec.ts` reprova
 * nomeando **toda** rota nova que apareça sob o prefixo, e quem instalar o plugin decide ali o teto
 * das rotas que ele trouxer.
 *
 * Exportada pela mesma razão das constantes acima, e com o mesmo critério de índice.
 */
export const TETO_DE_EMISSAO_DE_EMAIL_POR_JANELA = 5;

/**
 * O teto de toda a demais superfície de identidade, por origem e por caminho — «por origem» sob a
 * MESMA condição declarada em {@link TETO_DE_ENTRADAS_POR_JANELA}, que {@link SALTOS_CONFIAVEIS}
 * satisfaz.
 *
 * Mais folgado que o da entrada porque os caminhos daqui pressupõem sessão ou token já emitido —
 * quem os alcança já passou por alguma barreira —, e porque uma sessão legítima ativa faz muito
 * mais pedidos de leitura de sessão do que tentativas de entrada.
 *
 * Exportada pela mesma razão das constantes acima, e com o mesmo critério de índice.
 */
export const TETO_GERAL_POR_JANELA = 120;

/**
 * Quantas verificações de segundo fator seguidas erram antes de a CONTA ser trancada.
 *
 * Ela é a camada que sustenta o teto geral em `/two-factor/*` — ver o quadro do bloco `rateLimit`,
 * onde aquele caminho é o único deixado na curinga por decisão. O número é o mesmo que o plugin
 * aplicaria por padrão (`enabled ?? true`, `maxFailedAttempts ?? 10`, `durationSeconds ?? 900`,
 * medido em `better-auth@1.6.25`, `dist/plugins/two-factor/verify-two-factor.mjs`), e é DECLARADO
 * mesmo assim: um padrão de biblioteca não declarado muda no próximo bump sem que nada acuse, que é
 * exatamente o raciocínio que o bloco `rateLimit` recusa duas vezes para os demais caminhos.
 *
 * **Exportada para ser ancorável**, pelo mesmo critério de {@link TETO_DE_ENTRADAS_POR_JANELA}. A
 * âncora vive no CT-236 (b) (`test/bloqueio.spec.ts`) e lê a configuração DA INSTÂNCIA, não este
 * comentário: apagar a declaração das opções do plugin reprova ali.
 */
export const FALHAS_DE_SEGUNDO_FATOR_ANTES_DA_TRANCA = 10;

/** Por quanto tempo a conta fica trancada depois delas, em segundos. Mesmo critério acima. */
export const TRANCA_DO_SEGUNDO_FATOR_EM_SEGUNDOS = 15 * 60;

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
 * `PESSOA_DESATIVADA` e `EMPRESA_SUSPENSA` compartilham `ACESSO_RECUSADO_POR_POLITICA` — e o que
 * elas compartilham agora é uma CLASSE, não a falta de um valor. As duas são decisão do produto
 * sobre quem pode entrar; o que ficou de fora do valor é o que **não** é decisão de política
 * (defeito de servidor e pedido malformado), que segue em `ACESSO_RECUSADO`.
 *
 * Até a migração `0004` as três origens dividiam o mesmo rótulo, e um pico causado por
 * indisponibilidade do banco era indistinguível de um pico de tentativas contra contas desativadas.
 * A fronteira está escrita por extenso no comentário de `desfechoTentativa`
 * (`packages/db/src/esquema/identidade.ts`), que continua sendo o oráculo do vocabulário — este
 * comentário aponta para lá, não o duplica.
 */
const DESFECHO_POR_MOTIVO: Record<MotivoDeRecusa, DesfechoDeTentativa> = {
  CONTA_BLOQUEADA: 'CONTA_BLOQUEADA',
  PESSOA_DESATIVADA: 'ACESSO_RECUSADO_POR_POLITICA',
  EMPRESA_SUSPENSA: 'ACESSO_RECUSADO_POR_POLITICA',
};

/** O que a instância precisa para existir. Tudo entra por parâmetro; nada é lido do ambiente. */
export interface OpcoesDeAutenticacao {
  /** O acesso restrito ao schema `identidade`, aberto por quem compõe o processo. */
  readonly acesso: AcessoAIdentidade;
  /** Segredo de assinatura de sessão. Vive em `EnvironmentFile` 0600, fora da árvore (§11.6). */
  readonly segredoDeSessao: string;
  /** Endereço base público do serviço, usado na montagem dos endereços do arcabouço. */
  readonly enderecoBase: string;
  /**
   * As origens **públicas** que o navegador de fato envia — a lista, nunca um valor só.
   *
   * ---------------------------------------------------------------------------
   * Por que ela entra por parâmetro, e por que é OBRIGATÓRIA
   * ---------------------------------------------------------------------------
   *
   * O arcabouço deriva a origem confiável de {@link enderecoBase}, que é o endereço em que o
   * processo **escuta**. Enquanto o único cliente era o próprio hospedeiro, as duas coincidiam;
   * publicado atrás do servidor de borda, o `Origin` que o navegador envia é o do **hostname
   * público**, e nada na instância o conhecia — toda requisição com cookie, e a própria entrada,
   * seriam recusadas com `FORBIDDEN / INVALID_ORIGIN` antes de qualquer manipulador. Era o
   * `D23 · F1/T8`, e esta lista é o fecho dele.
   *
   * Ela é **obrigatória** de propósito: opcional, um ponto de composição futuro a esqueceria e o
   * serviço voltaria, em silêncio, a confiar só no endereço de escuta. Sem valor padrão pela mesma
   * razão — um padrão seria a adivinhação que o débito recusou por dois anos de fatia.
   *
   * ⚠️ **É uma LISTA porque são dois aplicativos sobre a mesma API** — o app do cliente e o Painel
   * Master, cada um no seu hostname. Uma origem só faria um dos dois parar de entrar.
   *
   * ⚠️ **Ela ACRESCENTA, e não substitui.** Medido em `getTrustedOrigins`
   * (`dist/context/helpers.mjs`): a origem derivada de `baseURL` é **sempre** empilhada primeiro, e
   * o que se declara aqui é empurrado depois. Trocar uma pela outra recusaria todo cliente que fala
   * com o endereço de escuta — o que inclui a superfície de verificação inteira.
   */
  readonly origensPublicas: readonly string[];
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

    // As origens PÚBLICAS declaradas pela composição — o fecho do `D23 · F1/T8`.
    //
    // A cópia é deliberada: a opção do arcabouço é mutável por tipo (`string[]`), e entregar a
    // lista de quem compõe daria à instância uma referência que um chamador poderia alterar depois
    // de a instância existir. `getTrustedOrigins` a empilha **depois** da origem derivada de
    // `baseURL`, de modo que o conjunto efetivo é a UNIÃO das duas — ver o docblock de
    // {@link OpcoesDeAutenticacao.origensPublicas} para por que retirar a de escuta não é opção.
    trustedOrigins: [...opcoes.origensPublicas],

    // O limitador nativo fica LIGADO, e com a política inteira escrita aqui (P-T6-2, T6 da fatia
    // `autorizacao-e-ciclo-de-acesso`).
    //
    // A herança que ele desfaz, medida em `better-auth@1.6.25`
    // (`dist/context/create-context.mjs`): o estado do limitador é
    // `options.rateLimit?.enabled ?? isProduction`, e `isProduction` é
    // `process.env.NODE_ENV === 'production'`. Omitir a opção LIGAVA o limitador em produção e o
    // mantinha desligado em toda verificação, que roda com `NODE_ENV=test` — a configuração que
    // atende a operação era diferente da que a suíte exercita. `enabled: true` fecha essa
    // assimetria pelo lado certo: o mesmo ESTADO em todo ambiente, e agora exercitado.
    //
    // **A assimetria do ESTADO é a que `enabled: true` fecha; a do EIXO era outra, e fechou depois.**
    // O endereço do cliente que serve de chave vem de `getIp`, que só o apura a partir de cabeçalho
    // — e devolve `127.0.0.1` sob `isTest()`/`isDevelopment()` e `null` em produção quando
    // cabeçalho nenhum chega. Enquanto nenhum salto confiável estivesse declarado, a suíte
    // exercitava um eixo que a operação não tinha; `advanced.ipAddress` o declara desde 2026-08-26
    // (ver {@link SALTOS_CONFIAVEIS}), e o que resta do balde compartilhado — o pedido cuja origem
    // NÃO se apura — é fixado por asserção no CT-236 (c).
    //
    // ELE É CAMADA ADICIONAL, NÃO SUBSTITUTO do bloqueio por conta (§11.5 da tech spec, RN-06), e
    // as duas cobrem coisas diferentes: o bloqueio conta falhas POR CONTA, e não enxerga a
    // pulverização de credencial que tenta uma senha em cada uma de muitas contas a partir da
    // mesma origem — nenhuma conta chega a cinco falhas. O limitador conta por CHAVE E CAMINHO
    // (`getIp(req) + path`), e essa chave **é** a origem porque o salto confiável está declarado em
    // `advanced.ipAddress`. Removê-lo devolveria o eixo ao nada — não é ajuste de configuração, é
    // desfazer o fecho do `D27 · F1/T6`. O CT-236 afirma as duas camadas na mesma execução, para
    // que ligar uma não possa mascarar a remoção da outra.
    //
    // A REGRA GERAL É EXPLÍCITA, E A REGRA-CURINGA TAMBÉM — o arcabouço traz regras especiais
    // próprias que se aplicam ANTES de `customRules`, e que `customRules` **substitui**: o bloco de
    // regras customizadas corre depois delas em `resolveRateLimitConfig`
    // (`dist/api/rate-limiter/index.mjs`) e reescreve `currentWindow`/`currentMax`. Herdá-las seria
    // repetir, do outro lado, o defeito que este bloco existe para fechar: a política em vigor
    // sairia do padrão de uma biblioteca, e mudaria no próximo bump sem que nada acusasse.
    //
    // SUBSTITUIR NÃO É APAGAR, E É ESSA A LIÇÃO DA RODADA 1 (T6 / Gate 1 · 2026-08-05). A primeira
    // versão deste bloco declarava a curinga logo depois do caminho de entrada, e com isso ela
    // substituía o conjunto INTEIRO de regras especiais do arcabouço pelo teto geral — sem que
    // ninguém tivesse percorrido o que cada uma delas cobria. Em produção o limitador JÁ rodava com
    // aquelas regras (o estado era `enabled ?? isProduction`), então o efeito líquido era
    // afrouxamento real, e o pior caso era `/change-password`: 6,7 vezes mais folgado, num caminho
    // que confere `currentPassword` e onde o contador POR CONTA da RN-06 não existe.
    //
    // SÃO DOIS OS CONJUNTOS SUBSTITUÍDOS, e não um: `resolveRateLimitConfig` aplica, nesta ordem,
    // as regras especiais do núcleo, as regras declaradas pelos PLUGINS e por último `customRules`
    // — de modo que o que se escreve aqui vence os dois. Percorridos um a um:
    //
    //   | Substituída                                                | Aqui                        |
    //   |------------------------------------------------------------|-----------------------------|
    //   | núcleo: `/sign-in*`, `/sign-up*`, `/change-password`,       | entrada: 30/60 s            |
    //   | `/change-email` — 3 por 10 s                                | demais: 10/60 s             |
    //   | núcleo: `/request-password-reset`,                          | 5/60 s                      |
    //   | `/send-verification-email`, `/forget-password*` — 3 por 60 s|                             |
    //   | núcleo: `/email-otp/*` — 3 por 60 s                         | plugin não instalado        |
    //   | plugin de 2º fator: `/two-factor/*` — 3 por 10 s            | teto geral, POR DECISÃO     |
    //
    // A razão de cada teto está na constante correspondente, e não aqui — é lá que ela é lida por
    // quem for alterá-lo. O `/email-otp/*` fica de fora com a rede nomeada em
    // {@link TETO_DE_EMISSAO_DE_EMAIL_POR_JANELA}.
    //
    // `/two-factor/*` é o ÚNICO caminho que fica no teto geral por decisão, e o critério é o mesmo
    // que separou `/change-password` do resto: lá o limitador é a única camada; aqui não é. A outra
    // camada é o bloqueio POR CONTA do plugin (`accountLockout`), e ele está DECLARADO nas opções
    // dele abaixo — não herdado do padrão. A rodada 2 desta task o deixava implícito, e isso era a
    // mesma forma que este bloco recusa duas vezes: a política em vigor sairia do padrão de uma
    // biblioteca e mudaria no próximo bump sem que nada acusasse, num caminho cujo teto geral só se
    // sustenta porque ela existe. Os valores estão em {@link FALHAS_DE_SEGUNDO_FATOR_ANTES_DA_TRANCA}
    // e {@link TRANCA_DO_SEGUNDO_FATOR_EM_SEGUNDOS}, e este arquivo mapeia as duas colunas que a
    // tranca usa (`falhasVerificacao` e `bloqueadoAte`), de modo que ela opera. Some-se a isso que o
    // desafio do segundo fator só é alcançável DEPOIS da conferência da senha: o regime de
    // pulverização, que é o que um teto por origem cobre, não se aplica. Um teto próprio aqui
    // trocaria uma camada existente por outra sem ganho, e recusaria a operação legítima de um
    // escritório atrás de um endereço só.
    //
    // A ORDEM É A POLÍTICA: a busca de `customRules` usa a PRIMEIRA chave que casa, na ordem de
    // declaração, de modo que a curinga é necessariamente a ÚLTIMA e cada grupo específico vem
    // antes dela. `'/**'` casa toda a superfície, e `*` NÃO atravessa `/` (medido contra o
    // `wildcardMatch` do pacote publicado) — é por isso que os grupos são escritos `'/sign-in/*'` e
    // `'/forget-password/**'`, e não `'/sign-in*'`, que não casaria caminho algum. Mover a curinga
    // para cima reprova a perna de `/change-password` do CT-236, que é o que amarra a ordem ao
    // comportamento em vez de a um comentário.
    //
    // (O `D27 · F1/T6` vivia aqui e FOI FECHADO pela T8 da fatia `publicacao-e-backup`. O que ele
    //  registrava — que esta política é dimensionada POR ORIGEM e que o eixo de origem não existia,
    //  de modo que a chave degenerava em `no-trusted-ip|<caminho>` e o teto passava a ser o do
    //  produto inteiro naquele caminho — deixou de ser verdadeiro: `advanced.ipAddress` declara o
    //  salto medido logo abaixo, e o eixo passou a ser apurado. Nenhum teto mudou no fecho, porque
    //  o que faltava era o eixo, e não o número. O `CT-236 (c)` foi revisto na mesma passada, como
    //  o marcador prescrevia, e o `CT-1167`, o `CT-1168` e o `CT-1170` são a rede do regime novo.)
    rateLimit: {
      enabled: true,
      window: JANELA_DO_LIMITADOR_EM_SEGUNDOS,
      max: TETO_GERAL_POR_JANELA,
      // Contador em memória do processo. É o padrão do arcabouço, e está escrito para ser uma
      // escolha: a alternativa (`'database'`) exigiria uma tabela de janelas e a migração dela, e
      // esta API sobe como uma unidade systemd única — um contador por processo é o contador do
      // serviço. Se um dia houver mais de um processo atendendo, o teto efetivo passa a ser o teto
      // vezes o número de processos, e é aí que a troca se paga.
      storage: 'memory',
      customRules: {
        [CAMINHO_DE_ENTRADA]: {
          window: JANELA_DO_LIMITADOR_EM_SEGUNDOS,
          max: TETO_DE_ENTRADAS_POR_JANELA,
        },

        // As demais variantes de `/sign-in/*` (hoje só a social, inerte) NÃO herdam os trinta da
        // entrada: aquele número existe para o pico do expediente num caminho que este produto usa,
        // e não é teto a distribuir por vizinhança de prefixo.
        '/sign-in/*': {
          window: JANELA_DO_LIMITADOR_EM_SEGUNDOS,
          max: TETO_DE_CREDENCIAL_POR_JANELA,
        },
        '/sign-up/*': {
          window: JANELA_DO_LIMITADOR_EM_SEGUNDOS,
          max: TETO_DE_CREDENCIAL_POR_JANELA,
        },
        '/change-password': {
          window: JANELA_DO_LIMITADOR_EM_SEGUNDOS,
          max: TETO_DE_CREDENCIAL_POR_JANELA,
        },
        '/change-email': {
          window: JANELA_DO_LIMITADOR_EM_SEGUNDOS,
          max: TETO_DE_CREDENCIAL_POR_JANELA,
        },

        '/request-password-reset': {
          window: JANELA_DO_LIMITADOR_EM_SEGUNDOS,
          max: TETO_DE_EMISSAO_DE_EMAIL_POR_JANELA,
        },
        '/send-verification-email': {
          window: JANELA_DO_LIMITADOR_EM_SEGUNDOS,
          max: TETO_DE_EMISSAO_DE_EMAIL_POR_JANELA,
        },
        '/forget-password/**': {
          window: JANELA_DO_LIMITADOR_EM_SEGUNDOS,
          max: TETO_DE_EMISSAO_DE_EMAIL_POR_JANELA,
        },

        '/**': { window: JANELA_DO_LIMITADOR_EM_SEGUNDOS, max: TETO_GERAL_POR_JANELA },
      },
    },

    database: drizzleAdapter(banco, {
      provider: 'pg',
      // O mapeamento de MODELO para tabela. Sem ele o adaptador procuraria `user`, `session` e
      // afins — nomes que este banco não tem, e nem deve ter.
      schema: { usuario, sessao, conta, verificacao, doisFatores },
    }),

    advanced: {
      // A CONFERÊNCIA DE ORIGEM FICA LIGADA, e o estado é DECLARADO — o mesmo molde, e a mesma
      // razão, do `enabled: true` do bloco `rateLimit` acima.
      //
      // A herança que ele desfaz, medida em `better-auth@1.6.25`
      // (`dist/context/create-context.mjs`): `skipOriginCheck` é
      // `options.advanced?.disableOriginCheck !== undefined ? … : isTest() ? true : false`, e
      // `isTest()` lê `NODE_ENV`. Omitir a opção **desligava a conferência em toda a verificação**,
      // que roda com `NODE_ENV=test` — a configuração que atende a operação era diferente da que a
      // suíte exercita, e o caso que prova a recusa de origem estranha passaria por vácuo. Declarar
      // `false` fecha a assimetria pelo lado certo: o mesmo ESTADO em todo ambiente, e agora
      // exercitado (`CT-1164`/`CT-1165`, em `apps/api/test/origem-publica.e2e.spec.ts`).
      //
      // ⚠️ O valor `true` também desligaria o CSRF por compatibilidade retroativa
      // (`shouldSkipCSRFForBackwardCompat`, em `dist/api/middlewares/origin-check.mjs`) — de modo
      // que a herança silenciosa alcançava duas proteções, e não uma.
      disableOriginCheck: false,
      // O EIXO DE ORIGEM — o fecho do `D27 · F1/T6`, e a aplicação da ADR-0037 do lado da
      // aplicação (a borda dá o eixo; a política, que é o bloco `rateLimit` acima, fica aqui).
      //
      // Sem esta declaração o arcabouço não apura endereço algum a partir de uma CADEIA de
      // encaminhamento: `getIPFromHeader` só aceita cabeçalho de valor único e devolve `null` para
      // toda cadeia — e `null` vira a chave `no-trusted-ip|<caminho>`, isto é, UM BALDE ÚNICO POR
      // CAMINHO para o produto inteiro. Com ela, a cadeia é percorrida da direita para a esquerda,
      // os saltos declarados são pulados, e o primeiro termo não confiável é o eixo.
      //
      // ⚠️ O que o cliente escreve fica SEMPRE à esquerda do que o primeiro salto apensa, e por
      // isso é descartado. Rotacionar o termo forjado não move o balde — é o que o `CT-1168` mede.
      //
      // Os dois campos são declarados, e nenhum herdado: ver {@link SALTOS_CONFIAVEIS} para o
      // endereço medido e {@link CABECALHO_DE_ORIGEM} para o critério de declarar o que o padrão
      // já faria.
      ipAddress: {
        ipAddressHeaders: [CABECALHO_DE_ORIGEM],
        // A cópia é deliberada, pela mesma razão de `trustedOrigins` acima: a opção do arcabouço é
        // mutável por tipo, e entregar a constante daria à instância uma referência que um chamador
        // poderia alterar depois de a instância existir.
        trustedProxies: [...SALTOS_CONFIAVEIS],
      },
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

    // (O `D21` vivia aqui e FOI FECHADO pela T9 da fatia `autorizacao-e-ciclo-de-acesso`. O que ele
    //  registrava — que a recusa deste gancho não desfaz o que `/change-password` já escreveu,
    //  porque `updateAccount` precede `deleteUserSessions` e `createSession` — continua verdadeiro
    //  sobre a rota NATIVA, e deixou de importar porque ela não é mais publicada: `apps/api` a
    //  recusa antes do repasse, e a troca do produto (`POST /v1/sessao/senha`) confere a admissão
    //  ANTES de qualquer escrita. A decisão abaixo segue intocada — ela nunca foi alcançada por
    //  aquele débito.)
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

    // DECISÃO FECHADA — T6 (fatia `autorizacao-e-ciclo-de-acesso`) · 2026-08-05 — fecha o `D7`
    // O QUÊ: `perfil` e `empresaId` são campos adicionais do modelo de pessoa **com a escrita pelo
    //        corpo da requisição FECHADA** (`input: false`). O par é declarado junto e fechado
    //        junto; nenhum dos dois se abre isoladamente.
    // POR QUÊ: sem a DECLARAÇÃO, criar pessoa pelo adaptador é inexequível — o `transformInput`
    //          itera apenas os campos declarados e descarta o resto, e o `INSERT` sairia com
    //          `perfil` em `default`, coluna `NOT NULL` sem padrão (medido duas vezes, por executor
    //          e por gate). Sem o FECHAMENTO, o mesmo par vira duas vulnerabilidades de gravidade
    //          distinta, e a segunda é a pior:
    //            * `perfil` aberto é ELEVAÇÃO DE PRIVILÉGIO — `POST /update-user` grava a coluna a
    //              partir de QUALQUER sessão autenticada;
    //            * `empresa_id` aberto é FUGA DE TENANT — o contexto de tenant nasce da sessão, que
    //              deriva desta coluna, de modo que torná-la escrevível pelo corpo faz A ORIGEM DO
    //              CONTEXTO DE RLS SER O REQUEST, por via indireta. A ADR-0008 fixa o oposto em
    //              texto literal ("sua origem **nunca é o request**"), e isso é o invariante 2 do
    //              `CLAUDE.md`.
    //          Fechar só `perfil` — com a justificativa plausível "o Master precisa mover pessoa
    //          entre empresas" — derrubaria a ADR-0008 por um flag de configuração de biblioteca,
    //          sem que nada no banco acusasse: o `usuario_master_sem_empresa_chk`
    //          (`packages/db/src/esquema/identidade.ts`) exige
    //          `(perfil = 'SYSLOC_MASTER') = (empresa_id IS NULL)` e portanto cobre SÓ METADE do
    //          espaço — a troca lateral de uma empresa para outra MANTENDO `ADMIN_EMPRESA` passa
    //          por ele, e `identidade` não tem RLS por decisão da ADR-0009. O CT-235 persegue
    //          exatamente esse vetor, e não o de elevação, que é o fácil.
    // REVERTER EXIGE: provar que nenhum caminho de escrita do modelo `user` alcança estas duas
    //                 colunas a partir do corpo de uma requisição — o que hoje é falso: o
    //                 `parseInputData` do arcabouço é o ponto único por onde todo corpo vira dado
    //                 de `user`, e é o `input: false` que o faz recusar. Trocar por validação numa
    //                 rota específica NÃO satisfaz: seria instalar por ponto a propriedade que aqui
    //                 é do campo, e a rota seguinte nasceria descoberta.
    //
    // (Adjacente à decisão acima, e não parte dela.) O que fica em aberto, herdado do texto do D7:
    // `input: false` é defesa de APLICAÇÃO. A defesa estrutural correspondente é o caminho do `D5`
    // — promover `identidade.usuario` a par `(id, empresa_id)` ou um `CHECK` por função —, e a T1
    // desta fatia já instalou a metade dele que é a conciliação estrutural. Enquanto a outra metade
    // não existir, esta é a única barreira, e é por isso que ela tem prova comportamental própria.
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
      // As duas colunas do PRODUTO que o modelo do arcabouço precisa conhecer. Elas não entram em
      // `fields` acima porque aquele mapa renomeia campos que o modelo JÁ tem; estas o modelo não
      // tem, e é `additionalFields` que as acrescenta a ele.
      //
      // A CHAVE É O NOME DA PROPRIEDADE NA TABELA DO ORM, e não o da coluna: o adaptador resolve
      // `esquemaIdentidade.usuario[chave]`, e é ele que conhece o nome físico (`empresa_id`). Uma
      // chave em caixa de coluna faria o adaptador procurar uma propriedade que não existe.
      additionalFields: {
        perfil: {
          type: 'string',
          // A coluna é `NOT NULL` sem padrão: `required` diz a verdade sobre ela.
          required: true,
          // O fechamento. Ver a decisão acima.
          input: false,
        },
        empresaId: {
          type: 'string',
          // Nulo é estado legítimo — é o do Sysloc Master, que não pertence a empresa alguma, e a
          // restrição `usuario_master_sem_empresa_chk` o exige assim.
          required: false,
          input: false,
        },
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
        // A CAMADA QUE SUSTENTA O TETO GERAL EM `/two-factor/*`. O quadro do bloco `rateLimit` deixa
        // aquele caminho na regra-curinga por decisão, e o que torna a decisão defensável é este
        // bloqueio por conta — sem ele, `/two-factor/verify-totp` ficaria a 120 tentativas por
        // minuto sobre um espaço de 10⁶ códigos, na última barreira depois da senha.
        //
        // Os três campos repetem o padrão medido do plugin, e é essa a razão de estarem escritos: um
        // padrão de biblioteca não declarado é política que muda num bump sem que nada acuse, e aqui
        // o que dependeria dela é a decisão de NÃO dar teto próprio ao caminho. Declará-los não muda
        // comportamento nenhum hoje; muda quem responde por ele.
        accountLockout: {
          enabled: true,
          maxFailedAttempts: FALHAS_DE_SEGUNDO_FATOR_ANTES_DA_TRANCA,
          durationSeconds: TRANCA_DO_SEGUNDO_FATOR_EM_SEGUNDOS,
        },
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
        // `ACESSO_RECUSADO` teve TRÊS origens e não distinguia nenhuma: recusa de política (RN-10 —
        // pessoa desativada, empresa suspensa), defeito de servidor (`FAILED_TO_CREATE_SESSION`,
        // gravado no ramo abaixo) e pedido malformado (`INVALID_EMAIL`). O efeito era um pico por
        // indisponibilidade parcial do banco indistinguível de um pico de tentativas contra contas
        // desativadas — o sinal de ataque que a RN-11 existe para tornar legível.
        //
        // **A pendência `P-T6-1` está FECHADA** (fatia `autorizacao-e-ciclo-de-acesso`, T1): a
        // migração `0004` acrescentou `ACESSO_RECUSADO_POR_POLITICA`, e o `DESFECHO_POR_MOTIVO`
        // deste arquivo — o blast radius que a T8 pesou ao recusar o escopo — passou a apontar as
        // duas recusas de política para o valor novo. **O ramo abaixo permanece `ACESSO_RECUSADO`
        // de propósito**: o que ele grava não é decisão de política, e sim defeito de servidor ou
        // pedido malformado. Trocá-lo desfaria a separação que a migração instalou, devolvendo os
        // dois picos ao mesmo rótulo.
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
