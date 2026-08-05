/**
 * Bloqueio por conta — CT-015.
 *
 * ---------------------------------------------------------------------------
 * INVARIANTES
 * ---------------------------------------------------------------------------
 *
 * | Critério | CT     | Invariante |
 * |----------|--------|------------|
 * | CA-08    | CT-015 | O contador de tentativas vive na própria conta: após a 4ª falha consecutiva
 * |          |        | `bloqueado_ate` continua nulo; na 5ª ele recebe instante no futuro; uma
 * |          |        | entrada bem-sucedida zera `tentativas_falhas` e limpa `bloqueado_ate`. |
 * | CA-08    | T6 §3  | O contador **não perde incremento sob tentativas paralelas**: N falhas
 * |          |        | disparadas ao mesmo tempo sobre a mesma conta deixam `tentativas_falhas`
 * |          |        | exatamente em N, e cada chamada enxerga um valor distinto. |
 * | CA-08    | T6 §3-d| A recusa por conta bloqueada **paga a derivação da senha informada**, uma
 * |          |        | vez e com a senha informada — a MESMA conta de derivações que o arcabouço
 * |          |        | paga no seu ramo de e-mail inexistente. |
 * | —        | CT-236 | O limitador nativo recusa a tentativa de entrada acima do teto da janela,
 * |          |        | por ORIGEM e por caminho; e o bloqueio por conta da fatia anterior continua
 * |          |        | contando falhas e trancando de forma **independente** — as duas camadas
 * |          |        | coexistem, e ligar uma não removeu a outra. (P-T6-2) |
 * | —        | CT-236 | A política explícita **não afrouxa** os caminhos que o padrão do arcabouço
 * |          | (b)    | protegia mais: `/change-password` — que confere `currentPassword` e onde
 * |          |        | NÃO há contador por conta — e a emissão de e-mail recusam acima de tetos
 * |          |        | PRÓPRIOS, mais estreitos que o geral, por origem e por caminho. (P-T6-2) |
 * | —        | CT-236 | **A contagem só é por origem quando há origem.** Sem o cabeçalho que a
 * |          | (c)    | apura, pedidos que só se distinguiriam pela origem real caem num contador
 * |          |        | ÚNICO por caminho — o teto vira o do produto inteiro ali —, enquanto um
 * |          |        | pedido com origem declarada, ao mesmo caminho, segue atendido. É o estado
 * |          |        | corrente, e o débito `D27` de `autenticacao.ts` é quem o fecha. (P-T6-2) |
 * | —        | CT-236 | A tranca POR CONTA de `/two-factor/*` está DECLARADA nas opções do plugin
 * |          | (b)    | e chega à instância — não é padrão de biblioteca implícito. É ela que
 * |          |        | sustenta a decisão de deixar aquele caminho no teto geral. (P-T6-2) |
 *
 * Rastreabilidade: `CA-08 → CT-015 (RN-06)`, `CA-08 → T6 §3 (RN-06)`, `CA-08 → T6 §3-d (RN-06)` e
 * `P-T6-2 → CT-236 (RN-06)`.
 *
 * ---------------------------------------------------------------------------
 * Por que contra banco real, e por que a fronteira é em 4
 * ---------------------------------------------------------------------------
 *
 * O estado é **persistido na conta** por decisão do tech-alignment (D5). Um dublê aqui provaria a
 * aritmética do contador e não a persistência dele, que é o ponto — e não alcançaria o `CASE` que
 * decide o instante de liberação, que roda no servidor.
 *
 * A asserção percorre as **cinco** tentativas, uma a uma, e não só a quinta. Provar apenas a quinta
 * deixaria os dois vizinhos sem asserção: um limiar errado em 4 (bloqueia cedo) e um em 6 (bloqueia
 * tarde) passariam os dois por verde.
 *
 * ---------------------------------------------------------------------------
 * Precondição privilegiada — (b), construir pelo caminho real
 * ---------------------------------------------------------------------------
 *
 * A conta nasce da carga inicial, com a senha definida pela **função de derivação do próprio
 * arcabouço** (ver `identidade-efemera.ts`), nunca por escrita direta de derivação forjada. A
 * leitura das duas colunas é consulta ao schema `identidade` — que não tem RLS por decisão da
 * ADR-0009 —, e observa o estado persistido que a RN-06 exige, em vez de instrumentar o SUT.
 *
 * O desbloqueio do passo final é o **decurso do prazo**: o instante de liberação é recuado por uma
 * duração inteira, calculada com `DURACAO_DO_BLOQUEIO_EM_MINUTOS`, que é a mesma constante que a
 * operação usa. Não há relógio falso nem espera — esperar quinze minutos de verdade é o `sleep`
 * fixo que `.claude/rules/testing-stack.md` proíbe.
 *
 * > **Companheiro negativo (CT-016), fora desta task.** A 6ª tentativa com a credencial CORRETA
 * > sobre a conta já bloqueada — resposta idêntica à de credencial incorreta e nenhuma sessão nova —
 * > é do CT-016, na T11. O desfecho `CONTA_BLOQUEADA` que o bloqueio produz **é** exercitado nesta
 * > task, pelo CT-025 em `auditoria.spec.ts`.
 *
 * ---------------------------------------------------------------------------
 * Por que o segundo caso — a correção sob concorrência precisava de asserção
 * ---------------------------------------------------------------------------
 *
 * `registrarFalha` incrementa **no próprio `UPDATE`**, sem leitura prévia, e a §7.4 da tech spec, a
 * §3 da task e o cabeçalho de `src/bloqueio.ts` declaram, os três, que é isso que a torna correta
 * sob concorrência. Nenhum caso executava tentativas paralelas: reescrever a função como "ler,
 * somar em JavaScript, gravar de volta" mantinha a suíte inteira verde. Propriedade declarada em
 * três lugares e provada em nenhum é literal órfão em forma de prosa — e, num caminho de
 * autenticação, a regressão silenciosa é o ataque paralelo, que é justamente o cenário que a RN-06
 * cobre.
 *
 * O caso é determinístico nos dois sentidos: o código correto o passa sempre (o bloqueio de linha
 * serializa os `UPDATE`, e o `READ COMMITTED` reavalia a expressão sobre o valor recém-comitado), e
 * a forma ler-somar-gravar o reprova com quase-certeza. Não há espera nem relógio falso.
 *
 * ---------------------------------------------------------------------------
 * Por que o terceiro caso — e por que ele CONTA derivações em vez de medir tempo
 * ---------------------------------------------------------------------------
 *
 * A recusa por bloqueio precisa custar o mesmo que os demais desfechos, ou a conta bloqueada vira a
 * única resposta rápida do fluxo e o tempo enumera contas. A propriedade é sobre **latência**, mas
 * uma asserção de relógio seria refém da máquina — e `.claude/rules/testing-stack.md` trata teste
 * instável como defeito.
 *
 * O que se afirma, então, é a **causa** da latência, que é observável e determinística: quantas
 * vezes a derivação de senha foi chamada, e com qual argumento. O observatório é o próprio contexto
 * do arcabouço (`autenticacao.$context`), envolvido pelo caso e restaurado depois — o mesmo objeto
 * que o gancho e o manipulador usam, sem nenhuma bandeira, contador ou parâmetro acrescentado ao
 * fonte de produção para o caso enxergar algo.
 *
 * O par é o que discrimina: o e-mail inexistente é o ramo em que o **próprio arcabouço** deriva e
 * descarta, justamente para nivelar o tempo; se a recusa por bloqueio pagar a mesma conta que ele,
 * as duas respostas custam o mesmo. Sem a derivação, a contagem da recusa por bloqueio é zero e a
 * do ramo de referência continua um — e é essa diferença que o caso reprova.
 *
 * ---------------------------------------------------------------------------
 * Por que o CT-236 mora aqui, e por que ele passa pelo `handler` e não por `api.*`
 * ---------------------------------------------------------------------------
 *
 * Ele mora **neste arquivo** porque o que ele afirma é a COEXISTÊNCIA de duas camadas: o limitador
 * por origem e o bloqueio por conta. Separá-los em arquivos diferentes permitiria que remover um
 * deixasse o outro verde — e é justamente contra isso que a §11.5 da tech spec pede a asserção
 * conjunta. O bloqueio por conta é o assunto deste arquivo; o limitador entra ao lado dele.
 *
 * E ele passa pelo **manipulador** (`autenticacao.handler`), e não por `autenticacao.api.*` como os
 * três casos acima, porque é ali que o limitador existe: ele roda no `onRequest` do roteador, antes
 * do casamento de rota, e uma chamada direta a `api.signInEmail` não atravessa roteador nenhum.
 * Exercitá-lo por `api.*` provaria o oposto do que se quer — que o limitador não dispara. É a
 * fronteira REAL do SUT, e não um atalho: é por ela que toda requisição HTTP de identidade entra,
 * inclusive as que o encaminhador de `apps/api` repassa.
 *
 * **O que fica FORA do alcance deste arquivo, e onde ele é provado.** O card do CT-236 pede também
 * que a recusa do limitador chegue ao cliente no envelope canônico (`REQUISICAO_RECUSADA`, com o
 * status de origem preservado e **sem virar 500**). Essa tradução é do filtro global de `apps/api`,
 * e afirmá-la aqui exigiria que `@sysloc/auth` importasse a aplicação que o consome — inversão de
 * dependência que nenhum ganho de prova justifica. Ela é afirmada do lado certo da fronteira, em
 * `apps/api/test/campos-fechados.e2e.spec.ts`, contra a aplicação montada. O que este arquivo
 * afirma é a metade que é dele: que a recusa é do LIMITADOR (status e cabeçalho que só ele emite) e
 * que ela é recusa de cliente, isto é, cai na faixa `[400, 500)` que aquele filtro classifica.
 *
 * **Cada perna usa uma origem própria**, e não é assepsia: o contador do limitador é por
 * `origem + caminho`, e reaproveitar um endereço faria as tentativas de uma perna consumirem o teto
 * da outra — o caso passaria ou reprovaria por vizinhança, e não por defeito. A origem distinta é
 * também o que permite a asserção que discrimina o mutante mais fácil de escrever sem querer (um
 * limitador que recusa tudo): a mesma janela, de outro endereço, continua entrando.
 *
 * ---------------------------------------------------------------------------
 * Por que o CT-236 (b) — a política explícita tinha um buraco, e ele era invisível ao (a)
 * ---------------------------------------------------------------------------
 *
 * O caso acima prova o teto do caminho de ENTRADA. Ele é cego, por construção, ao defeito que o
 * Gate 1 mediu na rodada 1 desta task: `customRules` não completa as regras especiais do arcabouço,
 * ele as **substitui** — o bloco corre depois delas em `resolveRateLimitConfig` e reescreve
 * `window`/`max`. A regra-curinga `'/**'`, escrita para não herdar política de biblioteca, levava
 * junto o conjunto inteiro que o padrão protegia mais, e em produção isso era afrouxamento REAL:
 * antes desta task o limitador já rodava lá com as regras padrão (`enabled ?? isProduction`).
 *
 * O pior caso era `/change-password`: de 3 por 10 s para 120 por 60 s, 6,7 vezes mais folgado, num
 * caminho que **confere `currentPassword`** e onde o contador por conta da RN-06 **não existe** — o
 * gancho `depois` de `autenticacao.ts` retorna cedo para todo caminho que não seja o de entrada, de
 * modo que `registrarFalha` nunca corre ali. Naquele caminho o limitador era, e é, a única camada.
 *
 * Este caso é a rede desse eixo, e ele é comportamental nos dois sentidos:
 *
 *   * **apagar a entrada de `/change-password`** (ou de qualquer grupo novo) faz o caminho recair na
 *     curinga, e a requisição de número TETO+1 deixa de ser recusada — a perna 2 reprova;
 *   * **mover a curinga para cima** produz o mesmo efeito para todos os grupos de uma vez, porque a
 *     busca usa a primeira chave que casa. A ordem de `customRules` fica, assim, amarrada ao
 *     comportamento, e não a um comentário.
 *
 * **Ele exercita dois grupos, e não só o apontado**, porque a classe do defeito é *"a curinga
 * substituiu um conjunto de proteções sem que ninguém verificasse o que cada uma cobria"* — provar
 * só `/change-password` seria fechar o caso e deixar a classe aberta. O segundo grupo é a emissão de
 * e-mail (`/request-password-reset`), cujo teto é o mais estreito dos três. Os caminhos do grupo de
 * credencial que este arquivo **não** exercita — `/sign-up/*`, `/sign-in/social`, `/change-email` —
 * estão inertes por configuração e compartilham a MESMA constante que a perna de `/change-password`
 * ancora: alargá-la reprova aqui, que é o que impede o teto deles de virar literal órfão.
 *
 * As requisições destas pernas **não precisam de sessão nem de credencial**: o limitador roda no
 * `onRequest` do roteador, antes do casamento de rota e antes de qualquer manipulador. É por isso
 * que a asserção de dentro do teto observa a recusa NORMAL de cada caminho (`401` sem sessão em
 * `/change-password`, `400` de "redefinição desligada" em `/request-password-reset`) e a de cima do
 * teto observa o `429` com o cabeçalho que só o limitador escreve.
 *
 * > **Ruído esperado na saída.** Cada pedido a `/request-password-reset` faz o arcabouço escrever
 * > uma linha de erro própria (*"Reset password isn't enabled…"*) antes de recusar com `400`. É o
 * > comportamento do pacote publicado diante da configuração deste projeto — que não declara
 * > remetente de e-mail —, e não um defeito do caso: a recusa é justamente o que a perna observa.
 *
 * ---------------------------------------------------------------------------
 * Por que o CT-236 (c) — os dois casos acima só provam "por origem" porque INJETAM a origem
 * ---------------------------------------------------------------------------
 *
 * As pernas do (a) e do (b) mandam `x-forwarded-for` em toda requisição, e é isso que lhes dá
 * baldes distintos. A configuração que atende a operação **não tem esse cabeçalho**: nada publica
 * esta API ainda, `advanced.ipAddress` não é declarado, e `getIp` só apura endereço a partir de
 * cabeçalho. O efeito é o oposto do que a política afirma — uma chave só por caminho —, e nenhum
 * dos dois casos acima consegue vê-lo, porque os dois sempre declaram a origem.
 *
 * Este caso é o **companheiro negativo** que amarra a decisão ao comportamento: ele emite os pedidos
 * SEM o cabeçalho e afirma que eles se somam num contador único, ao passo que um pedido com origem
 * própria, no MESMO caminho, continua atendido. Sem ele, a linha *"o teto é por origem"* seria
 * prosa, e o débito `D27` de `autenticacao.ts` seria um recado sem prova.
 *
 * **O que ele afirma é o estado de HOJE, e é para isso que ele serve.** Fechar o débito — declarar
 * `advanced.ipAddress` com o salto confiável da F7 — muda o que este caso descreve, e a revisão
 * dele faz parte do fechamento; está escrito no `QUANDO FECHA` do marcador.
 *
 * A chave compartilhada tem dois nomes possíveis, e o caso é cego à diferença **de propósito**:
 * `getIp` devolve `127.0.0.1` sob `isTest()`/`isDevelopment()` e `null` em produção, e o limitador
 * converte o nulo em `no-trusted-ip`. Os dois produzem a MESMA forma — uma chave para todo cliente
 * —, que é a propriedade observada; asserir qual dos dois nomes está em uso seria prender o caso ao
 * ambiente em que ele roda, e não ao defeito.
 */

import { esquemaIdentidade, SENHA_DA_CARGA } from '@sysloc/db';
import { count, eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { RECUSA_DE_CREDENCIAL } from '../src/admissao.ts';
import {
  DURACAO_DA_SESSAO_EM_SEGUNDOS,
  FALHAS_DE_SEGUNDO_FATOR_ANTES_DA_TRANCA,
  JANELA_DO_LIMITADOR_EM_SEGUNDOS,
  TETO_DE_CREDENCIAL_POR_JANELA,
  TETO_DE_EMISSAO_DE_EMAIL_POR_JANELA,
  TETO_DE_ENTRADAS_POR_JANELA,
  TETO_GERAL_POR_JANELA,
  TRANCA_DO_SEGUNDO_FATOR_EM_SEGUNDOS,
} from '../src/autenticacao.ts';
import {
  DURACAO_DO_BLOQUEIO_EM_MINUTOS,
  LIMITE_DE_FALHAS_CONSECUTIVAS,
  registrarFalha,
} from '../src/bloqueio.ts';
import { type IdentidadeEfemera, identidadeEfemera, pessoaSemeada } from './identidade-efemera.ts';

/** A pessoa cuja conta é levada ao bloqueio. */
const PESSOA = pessoaSemeada('admin.a@exemplo.com.br');

/**
 * A pessoa do caso de concorrência.
 *
 * Distinta da de cima de propósito: o CT-015 afirma contagens exatas na conta dele e no número de
 * sessões, e disparar dez falhas na mesma conta mexeria nesses números — o caso novo passaria a
 * poder quebrar o antigo por vizinhança, e não por defeito.
 */
const PESSOA_CONCORRENTE = pessoaSemeada('usuario.b2@exemplo.com.br');

/**
 * Quantas falhas o caso de concorrência dispara ao mesmo tempo.
 *
 * Dez é o bastante: com a forma ler-somar-gravar, dez chamadas simultâneas leem o mesmo valor em
 * quase toda execução e o contador termina muito abaixo de dez. Um número maior não aumenta o poder
 * de detecção e só alonga o caso.
 */
const FALHAS_EM_PARALELO = 10;

/** A pessoa do caso de derivação — a terceira conta distinta, pelo mesmo motivo da segunda. */
const PESSOA_DO_TEMPO = pessoaSemeada('usuario.b1@exemplo.com.br');

/** E-mail que a carga não tem. É o ramo em que o próprio arcabouço deriva e descarta. */
const EMAIL_QUE_NAO_EXISTE = 'ninguem@exemplo.com.br';

/** Senha que a conta não tem. Longa o bastante para não ser recusada por comprimento antes da hora. */
const SENHA_ERRADA = 'nao-e-a-senha-desta-conta';

/** Endereço do cliente que as tentativas declaram. Faixa de documentação (RFC 5737). */
const ORIGEM = '203.0.113.7';

const MILISSEGUNDOS_POR_MINUTO = 60_000;

/**
 * A fronteira, escrita **por extenso** e não derivada de `LIMITE_DE_FALHAS_CONSECUTIVAS`.
 *
 * Derivá-la da constante do SUT tornaria o caso tautológico: com o limiar mudado para 4, o laço
 * abaixo passaria a rodar três vezes e a "quinta" tentativa passaria a ser a quarta — o caso
 * continuaria verde sobre a política errada, que é exatamente o defeito que ele existe para pegar.
 * A amarra com a constante é feita uma vez, em asserção própria, logo abaixo.
 */
const FALHAS_QUE_NAO_BLOQUEIAM = 4;
const FALHA_QUE_BLOQUEIA = 5;

/**
 * A validade que a RN-07 fixa, **por extenso** — mesmo critério dos números de falha acima.
 *
 * Derivá-la de `DURACAO_DA_SESSAO_EM_SEGUNDOS` tornaria a asserção tautológica: com a constante
 * trocada para uma hora, o valor esperado mudaria junto e o caso seguiria verde sobre a regra
 * errada. A amarra com a constante do SUT é feita uma vez, em asserção própria.
 */
const VALIDADE_DA_SESSAO_EM_HORAS = 8;

const MINUTOS_POR_HORA = 60;

/** A mesma validade em milissegundos, que é a unidade em que os dois instantes são comparados. */
const VALIDADE_DA_SESSAO_MS =
  VALIDADE_DA_SESSAO_EM_HORAS * MINUTOS_POR_HORA * MILISSEGUNDOS_POR_MINUTO;

/**
 * Folga tolerada entre `criada_em` e `expira_em` da linha de sessão.
 *
 * Os dois instantes não vêm do mesmo relógio lido uma vez: o arcabouço compõe a expiração a partir
 * de um `Date.now()` e a criação a partir de outro, e a diferença observada entre eles é de poucos
 * milissegundos — em qualquer sentido. Sem folga a asserção reprovaria por essa diferença, e não
 * por defeito. Ela é constante nomeada, e não número solto no meio do caso
 * (`.claude/rules/testing-stack.md`), e é quatro ordens de grandeza menor que a distância entre
 * oito horas e a hora única do mutante — folgada para o ruído, cega para o defeito.
 */
const FOLGA_DA_VALIDADE_MS = 5_000;

// ---------------------------------------------------------------------------------------------
// CT-236 — o limitador de taxa ao lado do bloqueio por conta
// ---------------------------------------------------------------------------------------------

/**
 * O teto de entradas por janela, **por extenso** — mesmo critério de `FALHAS_QUE_NAO_BLOQUEIAM`.
 *
 * Derivá-lo de `TETO_DE_ENTRADAS_POR_JANELA` tornaria o caso tautológico da pior forma possível:
 * com o teto alargado para mil, o laço abaixo passaria a emitir mil tentativas e a "N+1" seguiria
 * sendo recusada — o caso continuaria verde sobre um limitador que, na prática, nunca dispara.
 * É esse o mutante que a §11.5 da tech spec obriga a pegar. A amarra com a constante do SUT é feita
 * uma vez, em asserção própria, logo abaixo.
 */
const TETO_DE_ENTRADAS_POR_EXTENSO = 30;

/** A janela do limitador, por extenso e pela mesma razão do teto acima. */
const JANELA_POR_EXTENSO_EM_SEGUNDOS = 60;

/**
 * As três origens do CT-236, todas na faixa de documentação (RFC 5737) e todas distintas.
 *
 * O contador do limitador é por `origem + caminho`: reaproveitar um endereço entre as pernas faria
 * as tentativas de uma consumir o teto da outra, e o caso passaria — ou reprovaria — por vizinhança
 * em vez de por defeito.
 */
const ORIGEM_LIMITADA = '203.0.113.31';
const ORIGEM_VIZINHA = '203.0.113.32';
const ORIGEM_DO_BLOQUEIO = '203.0.113.33';

/** A pessoa da perna do bloqueio por conta — exclusiva, pelo mesmo motivo das demais deste arquivo. */
const PESSOA_DO_LIMITADOR = pessoaSemeada('admin.b@exemplo.com.br');

/** O caminho de entrada, relativo ao prefixo em que o arcabouço está montado. */
const CAMINHO_DE_ENTRADA = '/sign-in/email';

/** Cabeçalho que só o limitador do arcabouço escreve — é ele que identifica a autoria da recusa. */
const CABECALHO_DE_ESPERA = 'x-retry-after';

/** Faixa que o filtro global de `apps/api` classifica como recusa de cliente. */
const PRIMEIRO_STATUS_DE_RECUSA = 400;
const PRIMEIRO_STATUS_DE_SERVIDOR = 500;

/** O status que o limitador emite. Literal, e não lido do SUT — ver o teto por extenso. */
const STATUS_DO_LIMITADOR = 429;

/** O status com que o arcabouço recusa credencial. Idem. */
const STATUS_DE_CREDENCIAL_RECUSADA = 401;

/**
 * Limite do caso do limitador: ele emite mais de trinta entradas reais, cada uma pagando a
 * derivação de senha que nivela o tempo. Constante nomeada, e não número solto
 * (`.claude/rules/testing-stack.md`).
 */
const LIMITE_DO_CASO_DO_LIMITADOR_MS = 180_000;

// ---------------------------------------------------------------------------------------------
// CT-236 (b) — os tetos dos caminhos que o padrão do arcabouço protegia mais
// ---------------------------------------------------------------------------------------------

/**
 * O teto dos caminhos de credencial, **por extenso** — mesmo critério de
 * `TETO_DE_ENTRADAS_POR_EXTENSO`, e pela mesma razão: derivá-lo da constante do SUT faria o laço
 * abaixo acompanhar um teto alargado até a curinga, e o caso seguiria verde sobre o defeito que ele
 * existe para pegar. A amarra com a constante é feita uma vez, em asserção própria.
 */
const TETO_DE_CREDENCIAL_POR_EXTENSO = 10;

/** O teto do grupo de emissão de e-mail, por extenso e pela mesma razão. */
const TETO_DE_EMISSAO_DE_EMAIL_POR_EXTENSO = 5;

/**
 * O caminho de troca de senha, relativo ao prefixo.
 *
 * É o caso GRAVE do grupo de credencial: ele confere `currentPassword` e **não** é coberto pelo
 * bloqueio por conta (ver o cabeçalho). É também o único do grupo alcançável hoje — os demais estão
 * inertes por configuração e compartilham a mesma constante, que esta perna ancora.
 */
const CAMINHO_DA_TROCA_DE_SENHA = '/change-password';

/** O membro canônico do grupo de emissão de e-mail. */
const CAMINHO_DA_EMISSAO_DE_EMAIL = '/request-password-reset';

/**
 * Um caminho que fica sob o teto GERAL — o companheiro que separa "o teto é por caminho" de "a
 * origem inteira foi barrada".
 */
const CAMINHO_SOB_O_TETO_GERAL = '/get-session';

/** As três origens do CT-236 (b), exclusivas e na faixa de documentação, pela razão das de cima. */
const ORIGEM_DA_TROCA = '203.0.113.34';
const ORIGEM_VIZINHA_DA_TROCA = '203.0.113.35';
const ORIGEM_DA_EMISSAO = '203.0.113.36';

/** Com que a troca de senha recusa quem não tem sessão. Literal, e não lido do SUT. */
const STATUS_DE_RECUSA_SEM_SESSAO = 401;

/** Com que a redefinição recusa o pedido enquanto não houver remetente de e-mail declarado. Idem. */
const STATUS_DE_PEDIDO_RECUSADO = 400;

/**
 * Corpo bem formado da troca de senha.
 *
 * Bem formado de propósito: um corpo inválido seria recusado pelo esquema do endpoint com OUTRO
 * status, e a perna passaria a observar a validação do arcabouço em vez da recusa por falta de
 * sessão. Nenhum dos dois valores é conferido contra conta alguma — sem sessão, o manipulador
 * recusa antes.
 */
const CORPO_DA_TROCA_DE_SENHA = {
  currentPassword: SENHA_ERRADA,
  newPassword: 'Trilha9Verde!',
};

/** Endereço que a carga não tem — o pedido de redefinição não deve encontrar ninguém. */
const CORPO_DA_EMISSAO_DE_EMAIL = { email: EMAIL_QUE_NAO_EXISTE };

/** Limite do caso (b): ele emite ~25 requisições, todas sem derivação de senha. */
const LIMITE_DO_CASO_DOS_TETOS_MS = 60_000;

/**
 * As falhas e a duração da tranca por conta do segundo fator, **por extenso**.
 *
 * Mesmo critério dos tetos: comparar a configuração observada contra as próprias constantes do SUT
 * seria tautológico — trocar as duas por outros números mudaria os dois lados e a asserção seguiria
 * verde sobre a política errada.
 */
const FALHAS_DE_SEGUNDO_FATOR_POR_EXTENSO = 10;
const TRANCA_DO_SEGUNDO_FATOR_EM_SEGUNDOS_POR_EXTENSO = 900;

// ---------------------------------------------------------------------------------------------
// CT-236 (c) — sem cabeçalho de origem, a contagem não é por origem
// ---------------------------------------------------------------------------------------------

/**
 * O caminho em que o balde compartilhado é observado.
 *
 * O mesmo `/change-password` do (b), e de propósito: o contador é por `chave + caminho`, e a chave
 * daqui (a que o arcabouço usa quando não há cabeçalho) é **outra** que a das origens declaradas
 * lá. Reaproveitar o caminho, com chave distinta, é o que torna a perna 3 abaixo uma comparação
 * direta — mesmo caminho, mesma janela, desfechos opostos.
 */
const CAMINHO_DO_BALDE_COMPARTILHADO = CAMINHO_DA_TROCA_DE_SENHA;

/** A origem declarada da perna 3 — inédita no arquivo, pela razão das demais. */
const ORIGEM_QUE_SE_DECLARA = '203.0.113.37';

/** Limite do caso (c): ele emite 12 requisições, todas recusadas antes de qualquer derivação. */
const LIMITE_DO_CASO_DO_BALDE_MS = 60_000;

let identidade: IdentidadeEfemera;

beforeAll(async () => {
  identidade = await identidadeEfemera();
});

afterAll(async () => {
  await identidade?.parar();
});

describe('CT-015 — cinco falhas consecutivas gravam o bloqueio na conta', () => {
  it('a política em vigor é a de cinco falhas — mudá-la invalida a fronteira deste caso', () => {
    // Amarra única entre a política e o caso. Sem ela, os números por extenso acima virariam
    // literais órfãos; com ela, trocar o limiar reprova aqui, num lugar só e com a causa nomeada.
    expect(LIMITE_DE_FALHAS_CONSECUTIVAS).toBe(FALHA_QUE_BLOQUEIA);
    expect(FALHAS_QUE_NAO_BLOQUEIAM).toBe(FALHA_QUE_BLOQUEIA - 1);
  });

  it('a validade de sessão em vigor é a de oito horas — mudá-la invalida a asserção abaixo', () => {
    // Mesma amarra que a de cima, para a outra política que este caso observa. Sem ela, as oito
    // horas do SUT são literal órfão: trocá-las por uma hora não reprovaria caso nenhum, porque o
    // esperado seria recalculado a partir da própria constante trocada.
    expect(DURACAO_DA_SESSAO_EM_SEGUNDOS).toBe(VALIDADE_DA_SESSAO_EM_HORAS * MINUTOS_POR_HORA * 60);
  });

  it('a quarta não bloqueia, a quinta bloqueia e o sucesso zera o contador', async () => {
    const banco = identidade.acesso.identidade;

    expect(await contarSessoes(banco, PESSOA.id)).toBe(0);

    // --- Passos 1 e 2: quatro tentativas com a senha errada, uma a uma -----------------------
    // A leitura acontece a CADA tentativa, e não só depois da quarta: é o que fixa a fronteira nos
    // dois vizinhos. Um limiar em 4 reprovaria na quarta linha; um em 6, na quinta.
    for (let tentativa = 1; tentativa <= FALHAS_QUE_NAO_BLOQUEIAM; tentativa += 1) {
      expect(await entrar(SENHA_ERRADA)).toBe('RECUSADA');

      expect(await lerConta(banco)).toEqual({ tentativasFalhas: tentativa, bloqueadoAte: null });
    }

    // --- Passos 3 e 4: a quinta tentativa ----------------------------------------------------
    const antesDaQuinta = new Date();
    expect(await entrar(SENHA_ERRADA)).toBe('RECUSADA');
    // O teto da janela é medido DEPOIS da tentativa, não antes: o `now()` que o banco usa para
    // compor o instante de liberação corre no meio dela, e a derivação de senha do arcabouço leva
    // centenas de milissegundos. Ancorar o teto no instante anterior tornaria a asserção sensível
    // ao custo do `scrypt` — reprovaria por lentidão, não por defeito.
    const depoisDaQuinta = new Date();

    const aposAQuinta = await lerConta(banco);
    expect(aposAQuinta.tentativasFalhas).toBe(FALHA_QUE_BLOQUEIA);
    expect(aposAQuinta.bloqueadoAte).not.toBeNull();
    // Estritamente no futuro em relação ao instante que precedeu a tentativa — e não "não nulo".
    // Um `bloqueado_ate` gravado no passado seria não nulo e não bloquearia ninguém.
    expect(aposAQuinta.bloqueadoAte?.getTime()).toBeGreaterThan(antesDaQuinta.getTime());
    // E dentro da duração declarada: um prazo de um século também seria "no futuro", e não é o que
    // a operação configura.
    expect(aposAQuinta.bloqueadoAte?.getTime()).toBeLessThanOrEqual(
      depoisDaQuinta.getTime() + DURACAO_DO_BLOQUEIO_EM_MINUTOS * MILISSEGUNDOS_POR_MINUTO,
    );

    // --- Passo 5: decurso do prazo, e entrada com a senha correta ----------------------------
    await recuarLiberacaoUmaDuracaoInteira(banco);

    expect(await entrar(SENHA_DA_CARGA)).toBe('ACEITA');

    // --- Passo 6: o estado depois do sucesso -------------------------------------------------
    expect(await lerConta(banco)).toEqual({ tentativasFalhas: 0, bloqueadoAte: null });
    // Exatamente uma sessão nova: as cinco recusas não criaram nenhuma, e o sucesso criou uma só.
    expect(await contarSessoes(banco, PESSOA.id)).toBe(1);

    // E ela vale pelo prazo da RN-07. Contar a linha prova que a sessão NASCEU; só ler os dois
    // instantes dela prova POR QUANTO TEMPO ela vale — e é essa a metade que a configuração de
    // `expiresIn` decide. A âncora acima cuida da constante; esta asserção cuida do caminho: uma
    // duração certa que não chegue ao arcabouço, ou que chegue em outra unidade, reprova aqui.
    //
    // O esperado é o valor POR EXTENSO, e não `DURACAO_DA_SESSAO_EM_SEGUNDOS`: comparar o observado
    // contra a própria constante do SUT seria tautológico — trocá-la por uma hora mudaria os dois
    // lados da comparação e esta asserção seguiria verde. Mesmo critério dos números de falha, e
    // pela mesma razão; a amarra entre o extenso e a constante é a âncora acima.
    const sessaoCriada = await lerSessaoUnica(banco, PESSOA.id);
    const validadeMs = sessaoCriada.expiraEm.getTime() - sessaoCriada.criadaEm.getTime();

    expect(validadeMs).toBeGreaterThanOrEqual(VALIDADE_DA_SESSAO_MS - FOLGA_DA_VALIDADE_MS);
    expect(validadeMs).toBeLessThanOrEqual(VALIDADE_DA_SESSAO_MS + FOLGA_DA_VALIDADE_MS);
  });
});

describe('T6 §3 — o contador de falhas é correto sob tentativas paralelas', () => {
  it('dez falhas simultâneas sobre a mesma conta somam dez, sem incremento perdido', async () => {
    const banco = identidade.acesso.identidade;

    // Ponto de partida conhecido: a conta desta pessoa não foi tocada por nenhum caso anterior.
    expect(await lerContaDe(banco, PESSOA_CONCORRENTE.id)).toEqual({
      tentativasFalhas: 0,
      bloqueadoAte: null,
    });

    const estados = await Promise.all(
      Array.from({ length: FALHAS_EM_PARALELO }, () =>
        registrarFalha(banco, PESSOA_CONCORRENTE.id),
      ),
    );

    // As dez encontraram a conta: nenhuma devolveu `undefined`, que é o que uma conta inexistente
    // produziria. Sem esta perna, um SUT que não atualizasse nada passaria a asserção seguinte se
    // ela olhasse só para os valores presentes.
    expect(estados.filter((estado) => estado === undefined)).toEqual([]);

    // Cada chamada enxergou um valor DISTINTO — os dez primeiros naturais, sem repetição. É esta a
    // asserção que discrimina a forma: com "ler, somar em JavaScript, gravar de volta", chamadas
    // que correm juntas leem o mesmo valor e devolvem o mesmo resultado.
    const contados = estados
      .map((estado) => estado?.tentativasFalhas ?? 0)
      .toSorted((a, b) => a - b);
    expect(contados).toEqual(Array.from({ length: FALHAS_EM_PARALELO }, (_, i) => i + 1));

    // E o estado PERSISTIDO — que é o que a RN-06 consulta na tentativa seguinte — conta as dez.
    const persistido = await lerContaDe(banco, PESSOA_CONCORRENTE.id);
    expect(persistido.tentativasFalhas).toBe(FALHAS_EM_PARALELO);
    // Dez ultrapassa o limiar, então o instante de liberação foi gravado: o `CASE` da mesma
    // instrução também vale sob concorrência, e não só no caminho sequencial do CT-015.
    expect(persistido.bloqueadoAte).not.toBeNull();
  });
});

describe('T6 §3-d — a recusa por bloqueio paga a mesma derivação que os demais desfechos', () => {
  it('deriva a senha informada uma vez, exatamente como o ramo de e-mail inexistente', async () => {
    const banco = identidade.acesso.identidade;

    // Leva a conta ao bloqueio pelo caminho de produção — a mesma função que o gancho `depois`
    // chama —, e não por escrita direta das duas colunas.
    for (let falha = 0; falha < FALHA_QUE_BLOQUEIA; falha += 1) {
      await registrarFalha(banco, PESSOA_DO_TEMPO.id);
    }
    expect((await lerContaDe(banco, PESSOA_DO_TEMPO.id)).bloqueadoAte).not.toBeNull();

    const derivacoes = await espionarDerivacao();

    try {
      // Eixo sob prova: conta bloqueada, com a senha CORRETA. A recusa acontece antes do
      // manipulador, então nenhuma derivação viria do arcabouço — só a que o gancho paga.
      expect(await entrarComo(PESSOA_DO_TEMPO.email, SENHA_DA_CARGA)).toBe('RECUSADA');
      expect(derivacoes.argumentos).toEqual([SENHA_DA_CARGA]);

      // Eixo de referência: o ramo em que o PRÓPRIO arcabouço deriva e descarta para nivelar o
      // tempo. Uma chamada a mais, e a conta das duas passa a ser a mesma.
      expect(await entrarComo(EMAIL_QUE_NAO_EXISTE, SENHA_DA_CARGA)).toBe('RECUSADA');
      expect(derivacoes.argumentos).toEqual([SENHA_DA_CARGA, SENHA_DA_CARGA]);
    } finally {
      derivacoes.restaurar();
    }
  });
});

describe('CT-236 — o limitador de taxa é camada adicional, e não substituto do bloqueio por conta', () => {
  it('a política em vigor é a de trinta entradas por minuto — mudá-la invalida o caso abaixo', () => {
    // Amarra única entre a política e o caso, no mesmo molde do CT-015. Sem ela, os números por
    // extenso viram literais órfãos e um teto alargado até o limitador nunca disparar passaria.
    expect(TETO_DE_ENTRADAS_POR_JANELA).toBe(TETO_DE_ENTRADAS_POR_EXTENSO);
    expect(JANELA_DO_LIMITADOR_EM_SEGUNDOS).toBe(JANELA_POR_EXTENSO_EM_SEGUNDOS);
  });

  it(
    'recusa a tentativa acima do teto, sem tocar no bloqueio por conta, que segue trancando',
    async () => {
      const banco = identidade.acesso.identidade;

      // ------------------------------------------------------------------------------------
      // Perna 1 — as N tentativas DENTRO do teto. Este é o companheiro negativo do caso: se o
      // limitador recusasse cedo (ou recusasse tudo), a lista abaixo não seria só de `401`.
      // ------------------------------------------------------------------------------------
      const dentroDoTeto: number[] = [];
      for (let tentativa = 0; tentativa < TETO_DE_ENTRADAS_POR_EXTENSO; tentativa += 1) {
        const resposta = await tentarEntrada(EMAIL_QUE_NAO_EXISTE, SENHA_ERRADA, ORIGEM_LIMITADA);
        dentroDoTeto.push(resposta.status);
      }

      // Contagem exata E valor exato: `toEqual` sobre a lista inteira reprova tanto o laço que não
      // iterou quanto a tentativa que veio com outro status.
      expect(dentroDoTeto).toEqual(
        Array.from({ length: TETO_DE_ENTRADAS_POR_EXTENSO }, () => STATUS_DE_CREDENCIAL_RECUSADA),
      );

      // E são recusas DE CREDENCIAL, ditas pelo corpo — não uma recusa qualquer com o mesmo status.
      const ultimaDentroDoTeto = await tentarEntrada(
        EMAIL_QUE_NAO_EXISTE,
        SENHA_ERRADA,
        ORIGEM_VIZINHA,
      );
      expect(ultimaDentroDoTeto.corpo).toEqual(RECUSA_DE_CREDENCIAL);

      // ------------------------------------------------------------------------------------
      // Perna 2 — a N+1 da MESMA origem. É recusada pelo limitador, e a autoria é dita pelo
      // cabeçalho que só ele escreve — não por dedução a partir do status.
      // ------------------------------------------------------------------------------------
      const acimaDoTeto = await tentarEntrada(EMAIL_QUE_NAO_EXISTE, SENHA_ERRADA, ORIGEM_LIMITADA);

      expect(acimaDoTeto.status).toBe(STATUS_DO_LIMITADOR);
      expect(acimaDoTeto.status).not.toBe(STATUS_DE_CREDENCIAL_RECUSADA);
      expect(acimaDoTeto.corpo).not.toEqual(RECUSA_DE_CREDENCIAL);

      const esperaAnunciada = Number(acimaDoTeto.cabecalhos.get(CABECALHO_DE_ESPERA));
      expect(Number.isInteger(esperaAnunciada)).toBe(true);
      expect(esperaAnunciada).toBeGreaterThan(0);
      expect(esperaAnunciada).toBeLessThanOrEqual(JANELA_POR_EXTENSO_EM_SEGUNDOS);

      // **Sem virar 500.** O status fica na faixa que o filtro global de `apps/api` classifica como
      // recusa de cliente — é a pré-condição da tradução para `REQUISICAO_RECUSADA` com o status de
      // origem preservado, que é afirmada do outro lado da fronteira
      // (`apps/api/test/campos-fechados.e2e.spec.ts`). Ver o cabeçalho deste arquivo.
      expect(acimaDoTeto.status).toBeGreaterThanOrEqual(PRIMEIRO_STATUS_DE_RECUSA);
      expect(acimaDoTeto.status).toBeLessThan(PRIMEIRO_STATUS_DE_SERVIDOR);

      // ------------------------------------------------------------------------------------
      // Perna 3 — a MESMA janela, de OUTRA origem, continua entrando. Sem ela, um limitador que
      // recusasse tudo (teto zero, ou sempre-recusa) passaria as duas pernas acima.
      // ------------------------------------------------------------------------------------
      const daVizinha = await tentarEntrada(EMAIL_QUE_NAO_EXISTE, SENHA_ERRADA, ORIGEM_VIZINHA);
      expect(daVizinha.status).toBe(STATUS_DE_CREDENCIAL_RECUSADA);
      expect(daVizinha.cabecalhos.get(CABECALHO_DE_ESPERA)).toBeNull();

      // ------------------------------------------------------------------------------------
      // Perna 4 — o bloqueio POR CONTA continua operando, em origem separada e com contadores
      // zerados. É a metade que uma implementação que trocasse uma camada pela outra derrubaria.
      // ------------------------------------------------------------------------------------
      expect(await lerContaDe(banco, PESSOA_DO_LIMITADOR.id)).toEqual({
        tentativasFalhas: 0,
        bloqueadoAte: null,
      });

      const antesDaQuinta = new Date();
      const falhas: number[] = [];
      for (let falha = 0; falha < FALHA_QUE_BLOQUEIA; falha += 1) {
        const resposta = await tentarEntrada(
          PESSOA_DO_LIMITADOR.email,
          SENHA_ERRADA,
          ORIGEM_DO_BLOQUEIO,
        );
        falhas.push(resposta.status);
      }

      // As cinco chegaram ao manipulador: nenhuma foi interceptada pelo limitador, que só entraria
      // aqui a partir da trigésima primeira. Sem esta linha, um limitador estreito demais faria a
      // asserção seguinte falhar sem dizer por quê.
      expect(falhas).toEqual(
        Array.from({ length: FALHA_QUE_BLOQUEIA }, () => STATUS_DE_CREDENCIAL_RECUSADA),
      );

      const aposAsCinco = await lerContaDe(banco, PESSOA_DO_LIMITADOR.id);
      expect(aposAsCinco.tentativasFalhas).toBe(FALHA_QUE_BLOQUEIA);
      // Instante no futuro, e não apenas "não nulo": um `bloqueado_ate` no passado não tranca
      // ninguém — mesma exigência que o CT-015 faz.
      expect(aposAsCinco.bloqueadoAte).not.toBeNull();
      expect(aposAsCinco.bloqueadoAte?.getTime()).toBeGreaterThan(antesDaQuinta.getTime());
    },
    LIMITE_DO_CASO_DO_LIMITADOR_MS,
  );
});

describe('CT-236 (b) — a política explícita não afrouxa o que o padrão do arcabouço protegia', () => {
  it('os tetos em vigor são dez e cinco por minuto — mudá-los invalida as pernas abaixo', () => {
    // Amarra única entre a política e o caso, no mesmo molde da âncora do CT-236 (a). Sem ela, os
    // números por extenso das pernas abaixo viram literais órfãos.
    expect(TETO_DE_CREDENCIAL_POR_JANELA).toBe(TETO_DE_CREDENCIAL_POR_EXTENSO);
    expect(TETO_DE_EMISSAO_DE_EMAIL_POR_JANELA).toBe(TETO_DE_EMISSAO_DE_EMAIL_POR_EXTENSO);

    // E os dois são MENORES que o teto geral. Um teto "próprio" igual ao geral não protege nada —
    // é, literalmente, o estado que a rodada 1 desta task tinha, com a curinga alcançando estes
    // caminhos. A asserção existe para que "fechar o buraco" declarando o mesmo número não passe.
    expect(TETO_DE_CREDENCIAL_POR_EXTENSO).toBeLessThan(TETO_GERAL_POR_JANELA);
    expect(TETO_DE_EMISSAO_DE_EMAIL_POR_EXTENSO).toBeLessThan(TETO_GERAL_POR_JANELA);
  });

  it('a tranca por conta de `/two-factor/*` está declarada e chega à instância', () => {
    // `/two-factor/*` é o único caminho que a política deixa no teto geral, e o que sustenta essa
    // decisão é o bloqueio POR CONTA do plugin. Enquanto ele viesse do PADRÃO da biblioteca, a
    // política em vigor ali mudaria num bump sem que nada acusasse — que é o raciocínio que o bloco
    // `rateLimit` recusa duas vezes para os demais caminhos.
    //
    // A leitura é a da INSTÂNCIA, e é a MESMA que o plugin faz para decidir se tranca
    // (`getPlugin('two-factor')?.options?.accountLockout`, medido em
    // `dist/plugins/two-factor/verify-two-factor.mjs`): apagar a declaração devolve `undefined`
    // aqui, e alterá-la para outros números reprova contra os valores por extenso.
    expect(trancaDeSegundoFatorDaInstancia()).toEqual({
      enabled: true,
      maxFailedAttempts: FALHAS_DE_SEGUNDO_FATOR_POR_EXTENSO,
      durationSeconds: TRANCA_DO_SEGUNDO_FATOR_EM_SEGUNDOS_POR_EXTENSO,
    });

    // E as constantes do SUT são as que a instância carrega — a amarra que impede os dois números
    // acima de virarem literais órfãos do outro lado.
    expect(FALHAS_DE_SEGUNDO_FATOR_ANTES_DA_TRANCA).toBe(FALHAS_DE_SEGUNDO_FATOR_POR_EXTENSO);
    expect(TRANCA_DO_SEGUNDO_FATOR_EM_SEGUNDOS).toBe(
      TRANCA_DO_SEGUNDO_FATOR_EM_SEGUNDOS_POR_EXTENSO,
    );
  });

  it(
    'os caminhos de credencial e de emissão de e-mail recusam acima de tetos próprios e mais estreitos',
    async () => {
      // ------------------------------------------------------------------------------------
      // Perna 1 — as N requisições DENTRO do teto de `/change-password`. Companheiro negativo:
      // se o limitador recusasse cedo, ou recusasse tudo, a lista não seria só de `401`.
      // ------------------------------------------------------------------------------------
      const dentroDoTeto: number[] = [];
      for (let pedido = 0; pedido < TETO_DE_CREDENCIAL_POR_EXTENSO; pedido += 1) {
        const resposta = await requisitarComOrigem(CAMINHO_DA_TROCA_DE_SENHA, ORIGEM_DA_TROCA, {
          corpo: CORPO_DA_TROCA_DE_SENHA,
        });
        dentroDoTeto.push(resposta.status);
      }

      expect(dentroDoTeto).toEqual(
        Array.from({ length: TETO_DE_CREDENCIAL_POR_EXTENSO }, () => STATUS_DE_RECUSA_SEM_SESSAO),
      );

      // ------------------------------------------------------------------------------------
      // Perna 2 — a N+1 da MESMA origem. **É esta a asserção que o eixo do bloqueante exige**:
      // com o teto alargado para o geral — ou com a entrada de `/change-password` removida de
      // `customRules`, que faz o caminho recair na curinga —, a décima primeira ainda seria uma
      // recusa por falta de sessão, e não a recusa do limitador.
      // ------------------------------------------------------------------------------------
      const acimaDoTeto = await requisitarComOrigem(CAMINHO_DA_TROCA_DE_SENHA, ORIGEM_DA_TROCA, {
        corpo: CORPO_DA_TROCA_DE_SENHA,
      });

      expect(acimaDoTeto.status).toBe(STATUS_DO_LIMITADOR);

      // A autoria é dita pelo cabeçalho que só o limitador escreve, e não deduzida do status.
      const esperaAnunciada = Number(acimaDoTeto.cabecalhos.get(CABECALHO_DE_ESPERA));
      expect(Number.isInteger(esperaAnunciada)).toBe(true);
      expect(esperaAnunciada).toBeGreaterThan(0);
      expect(esperaAnunciada).toBeLessThanOrEqual(JANELA_POR_EXTENSO_EM_SEGUNDOS);

      // Sem virar 500 — mesma faixa que a perna do envelope, em `apps/api`, pressupõe.
      expect(acimaDoTeto.status).toBeGreaterThanOrEqual(PRIMEIRO_STATUS_DE_RECUSA);
      expect(acimaDoTeto.status).toBeLessThan(PRIMEIRO_STATUS_DE_SERVIDOR);

      // ------------------------------------------------------------------------------------
      // Perna 3 — a MESMA janela, de OUTRA origem, continua atendida. Sem ela, um limitador que
      // recusasse tudo passaria as duas pernas acima.
      // ------------------------------------------------------------------------------------
      const daVizinha = await requisitarComOrigem(
        CAMINHO_DA_TROCA_DE_SENHA,
        ORIGEM_VIZINHA_DA_TROCA,
        { corpo: CORPO_DA_TROCA_DE_SENHA },
      );
      expect(daVizinha.status).toBe(STATUS_DE_RECUSA_SEM_SESSAO);
      expect(daVizinha.cabecalhos.get(CABECALHO_DE_ESPERA)).toBeNull();

      // ------------------------------------------------------------------------------------
      // Perna 4 — a origem já barrada em `/change-password` continua atendida num caminho que
      // fica sob o teto GERAL. É o que separa "o teto estreito alcança o caminho estreito" de
      // "a origem inteira foi barrada" — o contador é por `origem + caminho`.
      // ------------------------------------------------------------------------------------
      const sobOTetoGeral = await requisitarComOrigem(CAMINHO_SOB_O_TETO_GERAL, ORIGEM_DA_TROCA, {
        metodo: 'GET',
      });
      expect(sobOTetoGeral.status).not.toBe(STATUS_DO_LIMITADOR);
      expect(sobOTetoGeral.cabecalhos.get(CABECALHO_DE_ESPERA)).toBeNull();

      // ------------------------------------------------------------------------------------
      // Perna 5 — o segundo grupo, com teto PRÓPRIO e distinto do primeiro. Ele existe porque a
      // classe do defeito é a substituição de um CONJUNTO de proteções: provar um grupo só
      // fecharia o caso apontado e deixaria a classe aberta. O número é outro, e é isso que a
      // asserção final afirma — sob o teto de credencial, a sexta aqui ainda passaria.
      // ------------------------------------------------------------------------------------
      const dentroDaEmissao: number[] = [];
      for (let pedido = 0; pedido < TETO_DE_EMISSAO_DE_EMAIL_POR_EXTENSO; pedido += 1) {
        const resposta = await requisitarComOrigem(CAMINHO_DA_EMISSAO_DE_EMAIL, ORIGEM_DA_EMISSAO, {
          corpo: CORPO_DA_EMISSAO_DE_EMAIL,
        });
        dentroDaEmissao.push(resposta.status);
      }

      expect(dentroDaEmissao).toEqual(
        Array.from(
          { length: TETO_DE_EMISSAO_DE_EMAIL_POR_EXTENSO },
          () => STATUS_DE_PEDIDO_RECUSADO,
        ),
      );

      const acimaDaEmissao = await requisitarComOrigem(
        CAMINHO_DA_EMISSAO_DE_EMAIL,
        ORIGEM_DA_EMISSAO,
        { corpo: CORPO_DA_EMISSAO_DE_EMAIL },
      );
      expect(acimaDaEmissao.status).toBe(STATUS_DO_LIMITADOR);
      expect(Number(acimaDaEmissao.cabecalhos.get(CABECALHO_DE_ESPERA))).toBeGreaterThan(0);

      // Os dois grupos têm tetos DIFERENTES, e a diferença é observável acima: a perna 5 recusou
      // na sexta requisição, e a perna 2 na décima primeira. Fundir os dois num teto só passaria
      // a reprovar uma das duas.
      expect(TETO_DE_EMISSAO_DE_EMAIL_POR_EXTENSO).toBeLessThan(TETO_DE_CREDENCIAL_POR_EXTENSO);
    },
    LIMITE_DO_CASO_DOS_TETOS_MS,
  );
});

describe('CT-236 (c) — sem cabeçalho de origem, a contagem não é por origem', () => {
  it(
    'os pedidos sem origem declarada somam num balde único, e um com origem declarada não',
    async () => {
      // ------------------------------------------------------------------------------------
      // Perna 1 — as N requisições SEM o cabeçalho de origem. Elas vêm, do ponto de vista do
      // limitador, de clientes indistinguíveis: é exatamente o que a operação tem hoje. Todas
      // recebem a recusa NORMAL do caminho, e não a do limitador.
      // ------------------------------------------------------------------------------------
      const semOrigem: number[] = [];
      for (let pedido = 0; pedido < TETO_DE_CREDENCIAL_POR_EXTENSO; pedido += 1) {
        const resposta = await requisitarComOrigem(CAMINHO_DO_BALDE_COMPARTILHADO, null, {
          corpo: CORPO_DA_TROCA_DE_SENHA,
        });
        semOrigem.push(resposta.status);
      }

      expect(semOrigem).toEqual(
        Array.from({ length: TETO_DE_CREDENCIAL_POR_EXTENSO }, () => STATUS_DE_RECUSA_SEM_SESSAO),
      );

      // ------------------------------------------------------------------------------------
      // Perna 2 — a N+1, também sem cabeçalho. **É esta a asserção que discrimina**: se cada um
      // desses pedidos tivesse contador próprio, nenhum teto seria alcançado e ela seguiria sendo
      // uma recusa por falta de sessão. Ela é do LIMITADOR, dito pelo cabeçalho que só ele escreve.
      // ------------------------------------------------------------------------------------
      const acimaSemOrigem = await requisitarComOrigem(CAMINHO_DO_BALDE_COMPARTILHADO, null, {
        corpo: CORPO_DA_TROCA_DE_SENHA,
      });

      expect(acimaSemOrigem.status).toBe(STATUS_DO_LIMITADOR);
      expect(Number(acimaSemOrigem.cabecalhos.get(CABECALHO_DE_ESPERA))).toBeGreaterThan(0);

      // ------------------------------------------------------------------------------------
      // Perna 3 — o companheiro positivo. MESMO caminho, MESMA janela, agora com origem própria e
      // inédita: é atendido. Sem ela, um limitador que simplesmente recusasse tudo neste caminho
      // passaria as duas pernas acima, e o caso afirmaria "balde único" sobre outra coisa.
      // ------------------------------------------------------------------------------------
      const comOrigem = await requisitarComOrigem(
        CAMINHO_DO_BALDE_COMPARTILHADO,
        ORIGEM_QUE_SE_DECLARA,
        { corpo: CORPO_DA_TROCA_DE_SENHA },
      );

      expect(comOrigem.status).toBe(STATUS_DE_RECUSA_SEM_SESSAO);
      expect(comOrigem.cabecalhos.get(CABECALHO_DE_ESPERA)).toBeNull();
    },
    LIMITE_DO_CASO_DO_BALDE_MS,
  );
});

type Banco = IdentidadeEfemera['acesso']['identidade'];

/** O que o espião registrou, e como desfazê-lo. */
interface DerivacoesObservadas {
  /** Um item por chamada, na ordem, com o argumento exato — nunca apenas "foi chamado". */
  readonly argumentos: string[];
  restaurar(): void;
}

/**
 * Envolve a derivação de senha do contexto do arcabouço, contando chamadas e argumentos.
 *
 * O contexto é o objeto que o gancho recebe em `ctx.context` e que o manipulador usa — envolvê-lo
 * observa o colaborador real, sem tocar em `src/`. A derivação verdadeira continua sendo executada:
 * suprimi-la mudaria o custo que o caso existe para afirmar.
 */
async function espionarDerivacao(): Promise<DerivacoesObservadas> {
  const contexto = await identidade.autenticacao.$context;
  const original = contexto.password.hash;
  const argumentos: string[] = [];

  contexto.password.hash = async (senha: string): Promise<string> => {
    argumentos.push(senha);
    return await original(senha);
  };

  return {
    argumentos,
    restaurar: () => {
      contexto.password.hash = original;
    },
  };
}

/** O que o CT-236 observa de uma tentativa de entrada. */
interface RespostaDaEntrada {
  readonly status: number;
  readonly corpo: unknown;
  readonly cabecalhos: Headers;
}

/**
 * Emite uma tentativa de entrada pelo **manipulador** do arcabouço, declarando a origem.
 *
 * É a fronteira real do limitador — ele roda no `onRequest` do roteador, antes do casamento de
 * rota, e `autenticacao.api.*` não passa por roteador nenhum (ver o cabeçalho deste arquivo).
 *
 * O endereço é composto a partir da configuração da PRÓPRIA instância (`baseURL` e `basePath`), e
 * não de uma segunda cópia escrita aqui: uma cópia divergente faria o pedido cair fora do prefixo,
 * o arcabouço responderia "não encontrado" e o caso passaria a provar outra coisa.
 *
 * A origem viaja em `x-forwarded-for`, que é o cabeçalho que o arcabouço lê por padrão para apurar
 * o endereço do cliente — o mesmo que a trilha de tentativas já usa nos casos acima.
 */
async function tentarEntrada(
  email: string,
  senha: string,
  origem: string,
): Promise<RespostaDaEntrada> {
  return await requisitarComOrigem(CAMINHO_DE_ENTRADA, origem, {
    corpo: { email, password: senha },
  });
}

/**
 * A mesma emissão, para um caminho qualquer do arcabouço — é o que o CT-236 (b) usa.
 *
 * Ela existe porque o limitador é por `origem + CAMINHO`, e provar a política de um caminho só
 * deixaria os demais grupos sem exercício. Toda a montagem descrita em {@link tentarEntrada} vale
 * aqui e mora neste ponto único: uma segunda cópia do endereço, dos cabeçalhos ou da leitura do
 * corpo seria livre para divergir da que a perna do caminho de entrada usa.
 *
 * O corpo é opcional porque nem todo caminho aceita um — `GET /get-session`, o companheiro do teto
 * geral, é recusado pelo roteador se vier com corpo.
 *
 * A origem é **anulável** porque a ausência do cabeçalho é o que o CT-236 (c) precisa exercitar: é
 * a configuração que atende a operação hoje, e ela produz uma chave só para todo cliente.
 */
async function requisitarComOrigem(
  caminho: string,
  origem: string | null,
  opcoes: { readonly corpo?: unknown; readonly metodo?: 'GET' | 'POST' } = {},
): Promise<RespostaDaEntrada> {
  const { baseURL, basePath } = identidade.autenticacao.options;
  const alvo = new URL(`${basePath ?? ''}${caminho}`, baseURL);

  const resposta = await identidade.autenticacao.handler(
    new Request(alvo, {
      method: opcoes.metodo ?? 'POST',
      headers: {
        'content-type': 'application/json',
        // Origem nula é a AUSÊNCIA do cabeçalho, e não um valor vazio: é o que o CT-236 (c)
        // exercita, e um cabeçalho presente com valor inválido seguiria por outro ramo de `getIp`.
        ...(origem === null ? {} : { 'x-forwarded-for': origem }),
        'user-agent': 'verificacao/1',
      },
      ...(opcoes.corpo === undefined ? {} : { body: JSON.stringify(opcoes.corpo) }),
    }),
  );

  const texto = await resposta.text();

  return {
    status: resposta.status,
    corpo: texto.length === 0 ? undefined : (JSON.parse(texto) as unknown),
    cabecalhos: resposta.headers,
  };
}

/**
 * A configuração de tranca por conta que a instância entrega ao plugin de segundo fator.
 *
 * Lida da instância pela MESMA via que o plugin usa em tempo de execução, e não do fonte: é o que
 * torna a asserção sensível à declaração ter chegado às opções, e não à existência de um comentário.
 *
 * O molde do tipo é local porque a superfície publicada tipa o plugin pelo contrato genérico, que
 * não conhece as opções de um plugin específico — o valor devolvido é comparado por igualdade
 * inteira, de modo que o molde não amplia nem estreita o que a asserção observa.
 */
function trancaDeSegundoFatorDaInstancia(): unknown {
  const doisFatores = (identidade.autenticacao.options.plugins ?? []).find(
    (plugin) => plugin.id === 'two-factor',
  ) as { readonly options?: { readonly accountLockout?: unknown } } | undefined;

  return doisFatores?.options?.accountLockout;
}

/** Executa a entrada da pessoa do CT-015 e classifica o desfecho observável. */
async function entrar(senha: string): Promise<'ACEITA' | 'RECUSADA'> {
  return await entrarComo(PESSOA.email, senha);
}

/** A mesma entrada, para o e-mail informado. */
async function entrarComo(email: string, senha: string): Promise<'ACEITA' | 'RECUSADA'> {
  try {
    const resposta = await identidade.autenticacao.api.signInEmail({
      body: { email, password: senha },
      headers: new Headers({ 'x-forwarded-for': ORIGEM, 'user-agent': 'verificacao/1' }),
      asResponse: true,
    });

    return resposta.ok ? 'ACEITA' : 'RECUSADA';
  } catch {
    // A recusa da barreira de bloqueio levanta em vez de devolver resposta, porque ela acontece
    // antes do manipulador. Para este caso as duas formas são a mesma coisa: não entrou.
    return 'RECUSADA';
  }
}

/** As duas colunas que a RN-06 mantém, lidas do banco — para a pessoa do CT-015. */
async function lerConta(
  banco: Banco,
): Promise<{ tentativasFalhas: number; bloqueadoAte: Date | null }> {
  return await lerContaDe(banco, PESSOA.id);
}

/** As mesmas duas colunas, para a pessoa informada. */
async function lerContaDe(
  banco: Banco,
  usuarioId: string,
): Promise<{ tentativasFalhas: number; bloqueadoAte: Date | null }> {
  const { usuario } = esquemaIdentidade;

  const [linha] = await banco
    .select({ tentativasFalhas: usuario.tentativasFalhas, bloqueadoAte: usuario.bloqueadoAte })
    .from(usuario)
    .where(eq(usuario.id, usuarioId));

  if (linha === undefined) {
    throw new Error(`a conta ${usuarioId} sumiu da carga inicial no meio do caso`);
  }

  return linha;
}

/**
 * Os dois instantes da única sessão da pessoa.
 *
 * Exige a unicidade em vez de pegar a primeira linha: o passo anterior já afirmou que existe uma só,
 * e uma segunda linha aqui significaria que a asserção de contagem e esta olham para sessões
 * diferentes — o tipo de divergência que passa despercebida quando se lê pelo índice.
 */
async function lerSessaoUnica(
  banco: Banco,
  usuarioId: string,
): Promise<{ expiraEm: Date; criadaEm: Date }> {
  const { sessao } = esquemaIdentidade;

  const linhas = await banco
    .select({ expiraEm: sessao.expiraEm, criadaEm: sessao.criadaEm })
    .from(sessao)
    .where(eq(sessao.usuarioId, usuarioId));

  const [linha] = linhas;
  if (linhas.length !== 1 || linha === undefined) {
    throw new Error(`esperava exatamente uma sessão para ${PESSOA.email}, e há ${linhas.length}`);
  }

  return linha;
}

async function contarSessoes(banco: Banco, usuarioId: string): Promise<number> {
  const { sessao } = esquemaIdentidade;

  const [linha] = await banco
    .select({ total: count() })
    .from(sessao)
    .where(eq(sessao.usuarioId, usuarioId));

  return linha?.total ?? 0;
}

/**
 * Recua o instante de liberação em uma duração inteira — o prazo decorreu.
 *
 * A duração vem da constante que a operação usa. Escrever um instante arbitrário no passado (por
 * exemplo, "ano 2000") provaria o mesmo caminho de código com um valor que a operação nunca produz,
 * e deixaria a configuração de duração sem nenhuma amarra ao caso.
 */
async function recuarLiberacaoUmaDuracaoInteira(banco: Banco): Promise<void> {
  const { usuario } = esquemaIdentidade;
  const decorrido = new Date(
    Date.now() - DURACAO_DO_BLOQUEIO_EM_MINUTOS * MILISSEGUNDOS_POR_MINUTO,
  );

  await banco.update(usuario).set({ bloqueadoAte: decorrido }).where(eq(usuario.id, PESSOA.id));
}
