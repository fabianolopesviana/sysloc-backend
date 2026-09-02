/**
 * Ciclo de vida da empresa pelas rotas do operador do SaaS. T7 da fatia
 * `autorizacao-e-ciclo-de-acesso`.
 *
 * ---------------------------------------------------------------------------
 * INVARIANTES
 * ---------------------------------------------------------------------------
 *
 * | Critério | Caso   | Invariante |
 * |---|---|---|
 * | CA-01 | CT-221 | Uma empresa criada pela rota do Master passa a existir com estado **ativo** e
 * |       |        | aparece na listagem **sem que nenhuma intervenção fora da API tenha
 * |       |        | ocorrido** — e o corpo devolvido é o conjunto fechado de cinco chaves, com
 * |       |        | identificador em UUID. A mesma rota, com sessão de `ADMIN_EMPRESA`, responde
 * |       |        | `403` nomeando `PERFIL:SYSLOC_MASTER` **sem efeito**, e o documento repetido
 * |       |        | responde `422` — as duas com a contagem de empresas inalterada. (RN-13,
 * |       |        | RN-14, ADR-0011, ADR-0012) |
 * | —     | CT-223 | A reemissão pelo Master **alcança apenas `ADMIN_EMPRESA`**: alvo de perfil
 * |       | (b)    | `USUARIO_EMPRESA` responde `422` nomeando o perfil exigido, e a credencial do
 * |       |        | alvo **continua servindo** — nada foi reemitido. O companheiro positivo é a
 * |       |        | mesma rota contra um `ADMIN_EMPRESA`, que responde `200`. (ADR-0013) |
 * | CA-04 | CT-224 | A suspensão **encerra** os registros de sessão de todas as pessoas da empresa
 * |       |        | no próprio ato — a contagem vai de **2 a 0** —, e não os marca para recusa
 * |       |        | posterior. As sessões de **outra** empresa e a do Master, vivas no mesmo
 * |       |        | instante, **sobrevivem**. As operações com o cookie anterior respondem
 * |       |        | `401 NAO_AUTENTICADO`, e ninguém entra de novo enquanto durar a suspensão.
 * |       |        | Repetir a suspensão devolve o **mesmo corpo**, com `sessoesEncerradas: 0`.
 * |       |        | (RN-04, §9.2) |
 * | CA-05 | CT-225 | A reativação devolve a capacidade de **entrar**, e não as sessões que a
 * |       |        | suspensão encerrou: os cookies anteriores seguem em `401`, a contagem
 * |       |        | continua `0`, e só depois de uma entrada nova a operação responde `2xx`.
 * |       |        | (RN-05) |
 * | CA-06 | CT-226 | A listagem devolve, por item, **exatamente** as chaves de identificação e
 * |       |        | estado, e nenhum identificador de vínculo ou chave de permissão aparece na
 * |       |        | serialização do corpo — com as duas empresas carregando vínculo e permissão
 * |       |        | semeados, afirmados antes da chamada. (RN-13, ADR-0008) |
 * | CA-06 | CT-226 | A **janela** da listagem é servida, e não apenas ecoada: sem parâmetro algum
 * |       | (b)    | ela vale o padrão declarado; com `limite=1&deslocamento=1` o recorte tem um
 * |       |        | item e ele é **outro** que o da primeira página, com o `total` descrevendo o
 * |       |        | conjunto nas duas. O teto é fronteira **exata** — no teto responde `200`,
 * |       |        | acima dele responde `422` no envelope canônico nomeando `limite`, e
 * |       |        | `deslocamento` negativo idem. Os dois números da política são afirmados
 * |       |        | contra os do módulo, de modo que alargá-los reprova. (ADR-0012) |
 * | CA-07 | CT-227 | Numa empresa cujo único Admin está desativado, o Master admite outro, e essa
 * | CA-16 |        | pessoa entra em sessão **restrita**, cumpre a troca obrigatória e passa a
 * |       |        | operar — **sem que o Master ajuste permissão de ninguém** (o contador de
 * |       |        | versão dela permanece em zero e o efetivo é o da matriz do perfil). O
 * |       |        | desativado continua sem entrar, antes e depois. Ela então **administra**: cria
 * |       |        | pessoa, lista (o desativado aparece) e alcança pelas rotas de `:id` o colega
 * |       |        | que o Master criou e que **nunca agiu** — reativando-o, vendo-o entrar de novo
 * |       |        | e **revogando** o acesso dele, com as sessões dele encerradas no ato. A **si
 * |       |        | mesma** ela não alcança: o auto-alvo é recusado com `422 CAMPO_INVALIDO` em
 * |       |        | `campo: 'id'` e `detalhes.motivo: ALVO_E_QUEM_AGE`, no corpo canônico inteiro.
 * |       |        | (RN-04, RN-05, RN-07, RN-09, RN-13, RN-18) |
 *
 * Rastreabilidade: `CA-01 → CT-221 (RN-13)`, `CA-01 → CT-221 (RN-14)`, `CA-03 → CT-223 (b)`,
 * `CA-04 → CT-224 (RN-04)`, `CA-05 → CT-225 (RN-05)`, `CA-06 → CT-226 (RN-13)`,
 * `CA-06 → CT-226 (b) (ADR-0012)`, `CA-07 → CT-227 (RN-07)`, `CA-07 → CT-227 (RN-04)`,
 * `CA-07 → CT-227 (RN-05)`, `CA-16 → CT-227 (RN-18)`.
 *
 * ===========================================================================
 * O que faz o CT-224 provar o que ele diz provar: a CONTAGEM
 * ===========================================================================
 *
 * Se o caso asserisse apenas `401` na operação seguinte, ele passaria com uma implementação que
 * **marca a empresa e recusa na guarda** — exatamente o que a decisão D5 do tech-alignment proíbe, e
 * que manteria a sessão de pé contra a RN-04. A contagem de registros de sessão indo a zero é a
 * asserção que discrimina as duas implementações; o `401` sozinho não discrimina nenhuma.
 *
 * A segunda metade da discriminação são as **sessões que sobrevivem**: uma de outra empresa e a do
 * próprio Master, vivas no mesmo instante. Sem elas, um `DELETE FROM identidade.sessao` sem
 * cláusula alguma passaria em todas as asserções acima.
 *
 * ===========================================================================
 * MUTANTES EXECUTADOS (2026-08-05) — os doze reprovaram
 * ===========================================================================
 *
 * A `.claude/rules/testing-stack.md` e o P4 de `.claude/rules/nao-regressao.md` exigem demonstrar
 * que a prova **reprova** com o defeito reintroduzido. Os mutantes abaixo foram aplicados ao
 * fonte de produção e a suíte foi invocada pelo **script do pacote** (`pnpm --filter @sysloc/api
 * test`), nunca por `vitest run` avulso — este arquivo carrega `@sysloc/auth` e `@sysloc/db` pela
 * fronteira do pacote, e um `vitest run` leria o `dist/` da compilação anterior.
 *
 *   * **controle** — árvore íntegra: `73 passed`;
 *   * **M1 · a suspensão MARCA e não ENCERRA** (`sessoesEncerradas` fixo, sem apagar as linhas):
 *     `2 failed | 71 passed` — o CT-224 e o CT-225 reprovam **na contagem**, e não no `401`. É a
 *     medida literal do parágrafo acima;
 *   * **M2 · o `DELETE` perde a cláusula de empresa** (apaga a sessão de todo mundo):
 *     `4 failed | 69 passed`, começando pelas sessões de controle que deveriam sobreviver;
 *   * **M3 · a listagem vaza um campo a mais** (`suspensaEm` no corpo publicado):
 *     `2 failed | 71 passed`, no conjunto FECHADO de chaves do CT-221 e do CT-226;
 *   * **M4 · a reemissão perde a contenção do alvo** (ADR-0013): `3 failed | 70 passed`, e o
 *     primeiro é o CT-223 (b), que é o dono do eixo;
 *   * **M5 · a superfície do operador troca `@ExigePerfil` por `@NaoExigePermissao`**:
 *     `2 failed | 71 passed` — o CT-221 e o CT-227, que são os dois casos que asserem a recusa por
 *     dimensão de perfil. (O CT-213 **não** reprova aqui, e é correto que não: ele afirma que a
 *     rota **declara**, e a rota declarou; quem afirma **o que** ela declara são estes dois.);
 *   * **M6 · a suspensão reescreve o instante a cada chamada** (`now()` sem `coalesce`):
 *     `1 failed | 72 passed`, na igualdade de corpo da idempotência declarada (§9.2);
 *   * **reversão** — os fontes foram restaurados e o controle reexecutado.
 *
 * O sétimo mutante pertence ao CT-223, que mora em `test/recusa-indistinguivel.e2e.spec.ts`:
 * **a reemissão gera senha nova e NÃO invalida a anterior** (`updatePassword` neutralizado em
 * `packages/auth/src/onboarding.ts`) — `2 failed | 71 passed`, no CT-223 e no caso de onboarding
 * daquele pacote.
 *
 * ---------------------------------------------------------------------------
 * A JANELA da listagem — os quatro mutantes do `CT-226 (b)` (controle: `74 passed`)
 * ---------------------------------------------------------------------------
 *
 * Eles existem porque o teto e o padrão eram, até aqui, **literais órfãos**: nenhuma asserção os
 * alcançava, e alargá-los até nunca dispararem sobreviveria à suíte inteira. Os quatro são as duas
 * formas de alargar o teto, mais o padrão e o recorte:
 *
 *   * **M8 · o teto do esquema é alargado no CONTROLADOR** (`.max(MAIOR_PAGINA_DE_EMPRESAS * 5)`):
 *     `1 failed | 73 passed` — `expected 200 to be 422` na perna acima do teto;
 *   * **M9 · o teto é alargado na CONSTANTE** (`MAIOR_PAGINA_DE_EMPRESAS = 1000`):
 *     `1 failed | 73 passed` — `expected [ 50, 1000 ] to deeply equal [ 50, 200 ]`. É o mutante que
 *     o pedido derivado da constante **não** pegaria, e a razão de a política ser escrita por
 *     extenso em {@link TETO_DECLARADO_DA_PAGINA};
 *   * **M10 · o padrão da página muda** (`.default(PAGINA_PADRAO_DE_EMPRESAS - 45)`, isto é, 5):
 *     `1 failed | 73 passed`, no **CT-226**, que é onde mora a chamada sem parâmetro algum;
 *   * **M11 · o `OFFSET` ignora o deslocamento** (`OFFSET 0` no serviço): `1 failed | 73 passed` —
 *     a segunda página devolve o item da primeira, que é exatamente o que a perna positiva separa
 *     de "os dois campos ecoam o que se pediu";
 *   * **M12 · o piso do deslocamento some** (`.min(0)` removido): `1 failed | 73 passed` —
 *     `expected 500 to be 422`, porque `OFFSET -1` vira erro do banco em vez de recusa de borda;
 *   * **reversão** — os dois fontes foram restaurados e conferidos idênticos ao original por
 *     `diff`, e o controle voltou a `74 passed`.
 *
 * ===========================================================================
 * O Master entra RESTRITO por segundo fator — e o preço de esquecer isso
 * ===========================================================================
 *
 * O Sysloc Master nasce da carga sem segundo fator configurado, e a sessão dele é **restrita** até
 * que ele o configure (RN-08). Uma sessão restrita não alcança as rotas deste arquivo, e o `403`
 * que ela produz vem da restrição — não da autorização —, o que produziria um diagnóstico que
 * aponta para o lugar errado. Por isso o segundo fator é cumprido **pela via real** (o caminho
 * público do arcabouço, com o código derivado pela função de geração dele) uma única vez, na
 * montagem, e a precondição é **afirmada** no primeiro caso em vez de suposta.
 *
 * ===========================================================================
 * Cada caso arranja o próprio estado, pelas ROTAS REAIS
 * ===========================================================================
 *
 * Os seis casos compartilham arquivo, banco e aplicação, e **nenhum herda estado de outro**: onde um
 * caso precisa de empresa suspensa ou ativa, ele a leva ao estado pela própria rota do Master e
 * **afirma o desfecho** antes de exercitar o eixo. As duas operações de estado são idempotentes por
 * decisão (§9.2), de modo que o arranjo é correto qualquer que seja a ordem em que os casos rodem.
 *
 * A única escrita fora da API é a **desativação de pessoa** do CT-227, e ela é escrita direta no
 * banco pela mesma razão — e pelo mesmo padrão — que `test/recusa-indistinguivel.e2e.spec.ts`
 * registra: a rota que a fará (`POST /v1/usuarios/:id/desativacao`) nasce na T8, e criar rota,
 * bandeira ou símbolo de produção para "desativar pessoa" seria antecipar aquela task e vazar
 * código test-only para a produção (Iron Law #6). A partir do arranjo, **tudo** acontece pela rota
 * real.
 *
 * ===========================================================================
 * De onde vêm o banco, a fila e a credencial (ADR-0006)
 * ===========================================================================
 *
 * De instâncias efêmeras próprias. Nenhuma coordenada de conexão é lida do ambiente: o ambiente do
 * processo é MONTADO a partir do que os helpers devolvem. A aplicação é a **real**
 * (`criarAplicacao`, de `src/main.ts`) — é ela que atende em operação, e uma remontagem descreveria
 * uma aplicação que ninguém sobe. A porta é **reservada** (trava atômica), e não dinâmica, pela
 * razão que a T8 da fatia anterior registrou: o arcabouço confere a origem das requisições com
 * cookie contra o endereço base, composto a partir da porta CONFIGURADA.
 */

import { randomBytes, randomUUID } from 'node:crypto';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { type ChaveDoCatalogo, MATRIZ_POR_PERFIL, validarCoerenciaDeAjustes } from '@sysloc/auth';
import {
  ACESSOS_DA_EMPRESA_A,
  ACESSOS_DA_EMPRESA_B,
  type AcessoAoBanco,
  abrirAcessoAoBanco,
  contextoDeTenant,
  EMPRESA_A,
  EMPRESA_B,
  escreverAjustes,
  esquemaIdentidade,
  SENHA_DA_CARGA,
  USUARIO_MASTER,
} from '@sysloc/db';
import { CodigoErro } from '@sysloc/shared';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
// DÉBITO COM GATILHO — D28 · F0/T5 · gatilho JÁ DISPARADO (F1/T2, 2026-08-02)
// (NÃO é uma `DECISÃO FECHADA`: ele agenda uma mudança, não protege o código abaixo.)
// O QUÊ: os imports a seguir atravessam a fronteira de `@sysloc/shared` e de `@sysloc/auth` por
//        CAMINHO DE ARQUIVO, fora do `exports` e do `files` daqueles manifestos. As dependências de
//        workspace estão declaradas, então não há dependência oculta; o que não existe é FRONTEIRA
//        para os diretórios `test/` — e este arquivo é mais um a repetir o padrão.
// QUANDO FECHA: o gatilho já disparou e o fechamento segue pendente; ele é o mesmo de sempre —
//        declarar o subpath `"./test"` nos manifestos e importar por `@sysloc/shared/test` e
//        `@sysloc/auth/test`, ou extrair um `@sysloc/test-utils`.
// POR QUE NÃO AGORA: fechar exige editar os manifestos de dois pacotes e todos os consumidores,
//        nenhum deles no escopo desta task, e o índice de débitos do `CLAUDE.md`. É pendência
//        escalada ao orquestrador, não decisão desta task.
// ÍNDICE: docs/specs/features/fundacao-stack-nativa/v1/_run/run-report.md §2, D28
import {
  type IdentidadeEfemera,
  identidadeEfemera,
  pessoaSemeada,
} from '../../../packages/auth/test/identidade-efemera.ts';
import { reservarPorta } from '../../../packages/shared/test/efemero-comum.ts';
import { type FilaEfemera, redisEfemero } from '../../../packages/shared/test/redis-efemero.ts';
import { PREFIXO_DAS_ROTAS_DE_IDENTIDADE } from '../src/autenticacao/autenticacao.module.ts';
import { CAMINHO_DA_TROCA_DE_SENHA_DO_PRODUTO } from '../src/autenticacao/senha.controller.ts';
import { CAMINHO_DA_SESSAO } from '../src/autenticacao/sessao.controller.ts';
import { ENDERECO_DE_ESCUTA, PREFIXO_DE_VERSAO } from '../src/configuracao/ambiente.ts';
import { criarAplicacao } from '../src/main.ts';
import { CAMINHO_DO_MASTER } from '../src/master/empresa.controller.ts';
import {
  MAIOR_PAGINA_DE_EMPRESAS,
  PAGINA_PADRAO_DE_EMPRESAS,
} from '../src/master/empresa.service.ts';
import { CAMINHO_DOS_USUARIOS } from '../src/usuarios/usuario.controller.ts';
import { entrarComSegundoFatorCumprido } from './acessorios-de-borda.ts';

/** Limite da montagem: banco migrado, semente com credencial, fila e a aplicação real. */
const LIMITE_DE_MONTAGEM_MS = 240_000;

/**
 * Limite de um caso.
 *
 * Generoso de propósito: os casos executam muitas entradas reais em sequência, e cada uma paga a
 * derivação `scrypt`, que é deliberadamente cara (§12.1). O teto não é espera — nada aqui dorme.
 */
const LIMITE_CASO_MS = 120_000;

/** Sufixo do nome do cookie de sessão do arcabouço — o prefixo vem da configuração. */
const SUFIXO_DO_COOKIE_DE_SESSAO = 'session_token';

/** A rota de entrada, composta a partir do prefixo real. Nunca escrita à mão. */
const ROTA_DE_ENTRADA = `${PREFIXO_DAS_ROTAS_DE_IDENTIDADE}/sign-in/email`;

/**
 * A rota de troca de senha **do produto** — a que a sessão restrita alcança (RN-09).
 *
 * SUT_IS_CORRECT_BECAUSE: até a T9 esta constante apontava para `/v1/auth/change-password`, a rota
 * NATIVA do arcabouço, que deixou de ser publicada por entrega declarada daquela task (decisão D7
 * do tech-alignment, fechamento do débito D21). O caminho mudou e o corpo mudou de vocabulário
 * (`{ senhaAtual, senhaNova }` em vez de `{ currentPassword, newPassword }`), e nada mais: este
 * arquivo usa a troca como PASSO do fluxo — cumprir a exigência da Senha provisória —, e o que ele
 * afirma sobre o ciclo de acesso continua sendo afirmado sobre o mesmo desfecho.
 */
const ROTA_DE_TROCA_DE_SENHA = `/${PREFIXO_DE_VERSAO}/${CAMINHO_DA_TROCA_DE_SENHA_DO_PRODUTO}`;

/** Caminho, relativo à raiz, da rota de sessão do produto. Composto, nunca escrito à mão. */
const CAMINHO_DA_SESSAO_CORRENTE = `/${PREFIXO_DE_VERSAO}/${CAMINHO_DA_SESSAO}`;

/** Caminho, relativo à raiz, da coleção de empresas do operador. Composto do dono do segmento. */
const CAMINHO_DAS_EMPRESAS = `/${PREFIXO_DE_VERSAO}/${CAMINHO_DO_MASTER}/empresas`;

/** Caminho, relativo à raiz, da reemissão de Senha provisória pelo operador. */
const CAMINHO_DOS_USUARIOS_DO_MASTER = `/${PREFIXO_DE_VERSAO}/${CAMINHO_DO_MASTER}/usuarios`;

/**
 * As mensagens canônicas de cada código, escritas por extenso.
 *
 * Literais, e **não** lidas de `MENSAGEM_POR_CODIGO`: os casos comparam corpos inteiros por
 * igualdade, e derivá-los da mesma tabela que o SUT usa faria a asserção concordar consigo mesma —
 * um erro de texto na tabela passaria despercebido nos dois lados.
 */
const MENSAGEM_DE_ACESSO_NEGADO = 'acesso negado para esta sessão';
const MENSAGEM_SEM_SESSAO = 'sessão inválida ou expirada';
const MENSAGEM_DE_CAMPO_INVALIDO = 'requisição inválida';

/** O que a recusa por dimensão de perfil nomeia em `detalhes.exigido` (RN-14). */
const EXIGIDO_DE_PERFIL = 'PERFIL:SYSLOC_MASTER';

/** A mensagem da recusa por sessão restrita, quando a pendência é a troca da senha provisória. */
const MENSAGEM_DE_SESSAO_RESTRITA =
  'acesso negado: esta sessão está restrita até a troca da senha provisória';

/**
 * As cinco chaves que o corpo da **criação** de empresa pode ter — o conjunto FECHADO da RN-13.
 *
 * SUT_IS_CORRECT_BECAUSE: o código de produção está certo, e é este inventário que descrevia o
 * estado anterior. A **T6** da fatia `painel-master-administradores` acrescenta `exclusao` — a
 * prévia de elegibilidade da US-07 — ao item da **listagem**, por critério de aceite explícito
 * (*"`exclusao` por item na listagem de empresas, vindo da sonda"*), e **não** ao corpo do `POST`.
 * A assimetria é decisão declarada no docblock de `ESQUEMA_DA_EMPRESA_LISTADA`
 * (`apps/api/src/master/empresa.controller.ts`): uma empresa que acabou de nascer é elegível por
 * construção, e compor a prévia ali custaria a sonda — que é o próprio ato em ensaio desfeito
 * (ADR-0030) — para responder uma pergunta cuja resposta é conhecida.
 *
 * ⚠️ **A constante foi PARTIDA EM DUAS, e não afrouxada.** Esta continua com as **cinco** chaves e
 * segue afirmando a criação por igualdade; {@link CHAVES_DO_ITEM_DA_LISTAGEM} tem **seis** e afirma
 * a listagem. Manter uma só obrigaria a escolher entre deixar de conferir uma das duas rotas e
 * aceitar `exclusao` onde ele não deve existir — e é exatamente a assimetria que as duas constantes
 * passam a tornar **afirmada** em vez de acidental: um `exclusao` que vazasse pela criação reprova
 * aqui.
 */
const CHAVES_DA_EMPRESA_PUBLICADA = ['criadaEm', 'documento', 'estado', 'id', 'nome'];

/**
 * As **seis** chaves de um item da listagem de empresas — as cinco acima mais a prévia da US-07.
 *
 * Composta a partir da de cima, e não redigitada: as cinco têm uma declaração só, e um campo
 * acrescentado lá aparece aqui sem que ninguém precise lembrar.
 */
const CHAVES_DO_ITEM_DA_LISTAGEM = [...CHAVES_DA_EMPRESA_PUBLICADA, 'exclusao'].sort();

/**
 * A prévia que uma empresa **elegível** publica (US-07, ADR-0030).
 *
 * Escrita por extenso, e não derivada do que a resposta trouxe: derivá-la faria a asserção concordar
 * consigo mesma. `impedimentos: []` e a **ausência** de `motivo` e `alternativa` são conteúdo — o
 * cliente que vê `disponivel: true` não deve receber um motivo inventado.
 */
const EXCLUSAO_DISPONIVEL = { disponivel: true, impedimentos: [] };

/**
 * A política da janela da listagem, escrita **por extenso**.
 *
 * Literais aqui, e **não** derivados de `MAIOR_PAGINA_DE_EMPRESAS`/`PAGINA_PADRAO_DE_EMPRESAS`,
 * pela mesma razão que as mensagens canônicas acima são literais: derivá-los faria a asserção
 * concordar com o SUT. Um pedido escrito como `MAIOR_PAGINA_DE_EMPRESAS + 1` continuaria sendo
 * recusado depois de alguém alargar a constante — a recusa aconteceria num teto que já não é o da
 * política, e o número voltaria a ser literal órfão, alargável até nunca disparar.
 *
 * A coerência entre este par e o do módulo é asserida no `CT-226 (b)`, e é ela que reprova quando o
 * teto ou o padrão mudam sem que a política mude junto.
 */
const TETO_DECLARADO_DA_PAGINA = 200;
const PADRAO_DECLARADO_DA_PAGINA = 50;

/** Forma canônica do UUID — a chave exposta de entidade de identidade (ADR-0012). */
const PADRAO_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;

/** Senha que satisfaz a política de força e não é a de ninguém da carga. */
const SENHA_TROCADA = 'brisa9Verde!';

// ---------------------------------------------------------------------------------------------
// O elenco
// ---------------------------------------------------------------------------------------------

/** O operador do SaaS. Sujeito de todas as rotas deste arquivo. */
const MASTER = USUARIO_MASTER;

/** CT-221 · a sessão de `ADMIN_EMPRESA` que a rota do Master recusa por dimensão de perfil. */
const ADMIN_DE_A = pessoaSemeada('admin.a@exemplo.com.br');

/** CT-223 (b) · o alvo de perfil `USUARIO_EMPRESA`, que a contenção da ADR-0013 recusa. */
const USUARIO_DE_A = pessoaSemeada('usuario.a@exemplo.com.br');

/** CT-224 · as duas pessoas da empresa B que estão operando quando a suspensão chega. */
const ADMIN_DE_B = pessoaSemeada('admin.b@exemplo.com.br');
const USUARIO_DE_B = pessoaSemeada('usuario.b1@exemplo.com.br');

/** CT-226 · a chave de permissão semeada nas duas empresas — o dado que **não** pode vazar. */
const CHAVE_SEMEADA: ChaveDoCatalogo = 'TELA:financeiro';

let identidade: IdentidadeEfemera;
let fila: FilaEfemera;
let acessoAoNegocio: AcessoAoBanco;
let aplicacao: NestFastifyApplication;
let base: string;
let ambienteAnterior: NodeJS.ProcessEnv;

/** O cookie do Master, com o segundo fator já cumprido pela via real. */
let cookieDoMaster: string;

const VARIAVEIS_MONTADAS = [
  'NODE_ENV',
  'PORT',
  'LOG_LEVEL',
  'DATABASE_URL',
  'REDIS_URL',
  'BETTER_AUTH_SECRET',
] as const;

beforeAll(async () => {
  identidade = await identidadeEfemera();
  fila = await redisEfemero();
  acessoAoNegocio = abrirAcessoAoBanco({ cadeiaDeConexao: identidade.banco.cadeiaConexao });

  ambienteAnterior = { ...process.env };
  process.env.NODE_ENV = 'test';
  process.env.LOG_LEVEL = 'fatal';
  process.env.DATABASE_URL = identidade.banco.cadeiaConexao;
  process.env.REDIS_URL = fila.cadeiaConexao;
  process.env.BETTER_AUTH_SECRET = randomBytes(32).toString('base64url');

  const porta = await reservarPorta();
  base = `http://${ENDERECO_DE_ESCUTA}:${String(porta)}`;
  process.env.PORT = String(porta);

  aplicacao = await criarAplicacao();
  await aplicacao.listen({ port: porta, host: ENDERECO_DE_ESCUTA });

  cookieDoMaster = await entrarComSegundoFatorCumprido(
    base,
    MASTER.email,
    SENHA_DA_CARGA,
    identidade.autenticacao,
  );
}, LIMITE_DE_MONTAGEM_MS);

afterAll(async () => {
  await aplicacao?.close();
  await acessoAoNegocio?.encerrar();
  await fila?.parar();
  await identidade?.parar();

  for (const nome of VARIAVEIS_MONTADAS) {
    const valor = ambienteAnterior?.[nome];
    if (valor === undefined) {
      delete process.env[nome];
    } else {
      process.env[nome] = valor;
    }
  }
}, LIMITE_DE_MONTAGEM_MS);

describe('ciclo de vida da empresa pelas rotas do Master (T7)', () => {
  it(
    'CT-221 — o Master admite uma empresa nova e ela aparece ativa na listagem',
    async () => {
      // Precondição AFIRMADA, e não suposta: a sessão do Master já cumpriu o segundo fator, e por
      // isso um `403` adiante só pode vir da autorização — nunca da restrição de sessão.
      const sessaoDoMaster = await pedir(CAMINHO_DA_SESSAO_CORRENTE, { cookie: cookieDoMaster });
      expect(sessaoDoMaster.status).toBe(200);
      expect(sessaoDoMaster.corpo).toMatchObject({
        perfil: 'SYSLOC_MASTER',
        senhaProvisoria: false,
        segundoFatorPendente: false,
      });

      const documento = documentoNovo();
      const nome = 'Imobiliária Recém-Admitida Ltda';

      const criada = await pedir(CAMINHO_DAS_EMPRESAS, {
        metodo: 'POST',
        cookie: cookieDoMaster,
        corpo: { nome, documento },
      });

      expect(criada.status).toBe(201);

      // O conjunto de chaves é FECHADO, e é afirmado aqui — não só na listagem: se um campo novo
      // vazasse pela criação, o CT-226 não o pegaria, porque ele examina a outra rota.
      const empresa = criada.corpo as Record<string, unknown>;
      expect(Object.keys(empresa).sort()).toEqual(CHAVES_DA_EMPRESA_PUBLICADA);
      expect(empresa).toEqual({
        id: expect.stringMatching(PADRAO_UUID),
        nome,
        documento,
        estado: 'ATIVA',
        criadaEm: expect.any(String),
      });

      // --- Ela existe na listagem, sem que nada tenha acontecido fora da API ------------------
      const listagem = await listarEmpresas();
      const naListagem = listagem.itens.find((item) => item.id === empresa.id);

      expect(naListagem, 'a empresa criada não apareceu na listagem').toBeDefined();
      // SUT_IS_CORRECT_BECAUSE: ver {@link CHAVES_DA_EMPRESA_PUBLICADA}. O item da listagem é o
      // corpo da criação **mais** a prévia de exclusão que a T6 acrescentou; a igualdade continua
      // sendo de objeto INTEIRO, e ganhou uma asserção — a empresa recém-criada é elegível, com
      // `impedimentos` vazio. Nada foi afrouxado: um campo a mais em qualquer dos dois lados
      // reprova aqui.
      expect(naListagem).toEqual({ ...empresa, exclusao: EXCLUSAO_DISPONIVEL });

      const totalDepoisDaCriacao = listagem.total;

      // -----------------------------------------------------------------------------------------
      // Companheiro negativo 1 — a MESMA rota, com sessão de `ADMIN_EMPRESA`
      // -----------------------------------------------------------------------------------------
      const cookieDoAdmin = await entrar(ADMIN_DE_A.email);
      const recusada = await pedir(CAMINHO_DAS_EMPRESAS, {
        metodo: 'POST',
        cookie: cookieDoAdmin,
        corpo: { nome: 'Imobiliária Que Não Nasce Ltda', documento: documentoNovo() },
      });

      expect(recusada.status).toBe(403);
      // Corpo INTEIRO por igualdade: a recusa nomeia a DIMENSÃO de perfil (RN-14), e não uma
      // exigência genérica que um cliente não saberia como satisfazer.
      expect(recusada.corpo).toEqual({
        codigo: CodigoErro.ACESSO_NEGADO,
        mensagem: MENSAGEM_DE_ACESSO_NEGADO,
        detalhes: { exigido: EXIGIDO_DE_PERFIL },
      });
      // **Sem efeito colateral.** Sem esta linha, uma guarda que recusasse DEPOIS de o manipulador
      // ter gravado passaria na asserção acima.
      expect((await listarEmpresas()).total).toBe(totalDepoisDaCriacao);

      // -----------------------------------------------------------------------------------------
      // Companheiro negativo 2 — o MESMO documento, outra vez
      // -----------------------------------------------------------------------------------------
      const duplicada = await pedir(CAMINHO_DAS_EMPRESAS, {
        metodo: 'POST',
        cookie: cookieDoMaster,
        corpo: { nome: 'Imobiliária Homônima Ltda', documento },
      });

      expect(duplicada.status).toBe(422);
      expect(duplicada.corpo).toEqual({
        codigo: CodigoErro.CAMPO_INVALIDO,
        mensagem: MENSAGEM_DE_CAMPO_INVALIDO,
        campo: 'documento',
        detalhes: { motivo: 'DOCUMENTO_JA_REGISTRADO' },
      });
      expect((await listarEmpresas()).total).toBe(totalDepoisDaCriacao);
    },
    LIMITE_CASO_MS,
  );

  it(
    'CT-223 (b) — a reemissão do Master alcança apenas ADMIN_EMPRESA; outro perfil responde 422',
    async () => {
      // O alvo NEGATIVO é uma pessoa de perfil `USUARIO_EMPRESA` da carga. Precondição afirmada:
      // sem ela, um `422` produzido por outro motivo passaria como se fosse a contenção.
      expect(USUARIO_DE_A.perfil).toBe('USUARIO_EMPRESA');

      const recusada = await pedir(
        `${CAMINHO_DOS_USUARIOS_DO_MASTER}/${USUARIO_DE_A.id}/senha-provisoria`,
        {
          metodo: 'POST',
          cookie: cookieDoMaster,
        },
      );

      expect(recusada.status).toBe(422);
      expect(recusada.corpo).toEqual({
        codigo: CodigoErro.CAMPO_INVALIDO,
        mensagem: MENSAGEM_DE_CAMPO_INVALIDO,
        campo: 'id',
        detalhes: { perfilExigido: 'ADMIN_EMPRESA', perfilDoAlvo: 'USUARIO_EMPRESA' },
      });

      // **Nada foi reemitido**: a credencial do alvo continua servindo. É esta linha que separa
      // "recusou" de "recusou depois de reescrever a senha" — a recusa sozinha não o faria.
      const entradaDoAlvo = await entrarCom(USUARIO_DE_A.email, SENHA_DA_CARGA);
      expect(entradaDoAlvo.status).toBe(200);

      // -----------------------------------------------------------------------------------------
      // Companheiro POSITIVO — a mesma rota, contra um `ADMIN_EMPRESA`
      // -----------------------------------------------------------------------------------------
      //
      // Sem ele, "a rota recusa alvo de outro perfil" passaria com uma rota que recusa TODO MUNDO —
      // e a contenção estaria provada sobre nada.
      const empresa = await admitirEmpresa('Imobiliária do Alvo Legítimo Ltda');
      const admitido = await admitirAdministrador(empresa.id, 'ana.legitima@exemplo.com.br');

      const reemitida = await pedir(
        `${CAMINHO_DOS_USUARIOS_DO_MASTER}/${admitido.usuarioId}/senha-provisoria`,
        {
          metodo: 'POST',
          cookie: cookieDoMaster,
        },
      );

      expect(reemitida.status).toBe(200);
      const corpo = reemitida.corpo as { usuarioId: string; senhaProvisoria: string };
      expect(Object.keys(corpo).sort()).toEqual(['senhaProvisoria', 'usuarioId']);
      expect(corpo.usuarioId).toBe(admitido.usuarioId);
      expect(corpo.senhaProvisoria).not.toBe(admitido.senhaProvisoria);
    },
    LIMITE_CASO_MS,
  );

  it(
    'CT-224 — suspender a empresa encerra as sessões na origem e ninguém entra de novo',
    async () => {
      // --- Precondição do arranjo: a empresa B está ATIVA ---------------------------------------
      //
      // Este era o único caso do arquivo que **não arranjava o próprio estado**: ele depende de a
      // empresa B estar ativa para que as duas entradas aconteçam, e o CT-226 a suspende sem
      // reativar. Hoje nada quebra — a ordem de declaração põe o CT-226 depois —, mas depender
      // dela contraria o que o cabeçalho promete por escrito ("nenhum caso herda estado de outro"),
      // e uma permutação futura reprovaria este caso por um motivo que não é o dele.
      //
      // A reativação é idempotente por decisão (§9.2): a linha é correta qualquer que seja o estado
      // de partida. E o desfecho é **afirmado**, não suposto — precondição sem asserção é a mesma
      // suposição, escrita de outro jeito.
      const empresaBAtiva = await pedir(`${CAMINHO_DAS_EMPRESAS}/${EMPRESA_B.id}/reativacao`, {
        metodo: 'POST',
        cookie: cookieDoMaster,
      });
      expect(empresaBAtiva.status).toBe(200);
      expect(empresaBAtiva.corpo).toEqual({ id: EMPRESA_B.id, estado: 'ATIVA' });

      // --- Arranjo: duas pessoas da empresa B operando, e uma de OUTRA empresa como controle ----
      const cookieDoAdminB = await entrar(ADMIN_DE_B.email);
      const cookieDoUsuarioB = await entrar(USUARIO_DE_B.email);
      const cookieDeOutraEmpresa = await entrar(USUARIO_DE_A.email);

      // As duas estão de fato operando — precondição AFIRMADA, e não suposta.
      for (const cookie of [cookieDoAdminB, cookieDoUsuarioB]) {
        expect((await pedir(CAMINHO_DA_SESSAO_CORRENTE, { cookie })).status).toBe(200);
      }

      // --- A contagem ANTES: é ela, e só ela, que distingue "encerrada" de "marcada" ------------
      expect(await contarSessoesDaEmpresa(EMPRESA_B.id)).toBe(2);
      const sessoesDeOutraEmpresaAntes = await contarSessoesDaEmpresa(EMPRESA_A.id);
      expect(sessoesDeOutraEmpresaAntes).toBeGreaterThan(0);

      // --- A suspensão -------------------------------------------------------------------------
      const suspensao = await pedir(`${CAMINHO_DAS_EMPRESAS}/${EMPRESA_B.id}/suspensao`, {
        metodo: 'POST',
        cookie: cookieDoMaster,
      });

      expect(suspensao.status).toBe(200);
      expect(suspensao.corpo).toEqual({
        id: EMPRESA_B.id,
        estado: 'SUSPENSA',
        suspensaEm: expect.any(String),
        // DUAS, e não "alguma": o número é a evidência de que o encerramento aconteceu no ato, e
        // uma contagem genérica deixaria passar a implementação que apaga uma sessão só.
        sessoesEncerradas: 2,
      });

      // --- A contagem DEPOIS: zero, e o resto INTACTO -------------------------------------------
      expect(await contarSessoesDaEmpresa(EMPRESA_B.id)).toBe(0);
      // O controle que impede "apagou tudo" de passar: sessões de outra empresa e a do Master
      // estavam vivas no mesmo instante e continuam vivas.
      expect(await contarSessoesDaEmpresa(EMPRESA_A.id)).toBe(sessoesDeOutraEmpresaAntes);
      expect(
        (await pedir(CAMINHO_DA_SESSAO_CORRENTE, { cookie: cookieDeOutraEmpresa })).status,
      ).toBe(200);
      expect((await pedir(CAMINHO_DA_SESSAO_CORRENTE, { cookie: cookieDoMaster })).status).toBe(
        200,
      );

      // --- As operações com o cookie anterior ---------------------------------------------------
      for (const cookie of [cookieDoAdminB, cookieDoUsuarioB]) {
        const depois = await pedir(CAMINHO_DA_SESSAO_CORRENTE, { cookie });
        expect(depois.status).toBe(401);
        expect(depois.corpo).toEqual({
          codigo: CodigoErro.NAO_AUTENTICADO,
          mensagem: MENSAGEM_SEM_SESSAO,
        });
      }

      // --- E ninguém entra de novo enquanto durar a suspensão -----------------------------------
      for (const pessoa of [ADMIN_DE_B, USUARIO_DE_B]) {
        const entrada = await entrarCom(pessoa.email, SENHA_DA_CARGA);
        expect(entrada.status, pessoa.email).toBe(401);
        expect(entrada.cookies.filter(ehCookieDeSessao), pessoa.email).toEqual([]);
      }
      expect(await contarSessoesDaEmpresa(EMPRESA_B.id)).toBe(0);

      // -----------------------------------------------------------------------------------------
      // Idempotência declarada (§9.2): a repetição devolve o MESMO corpo, com zero encerradas
      // -----------------------------------------------------------------------------------------
      //
      // O par 2 → 0 é o que torna a asserção discriminante: uma implementação que devolvesse `0`
      // sempre reprova na primeira suspensão, e uma que reencerrasse o instante reprova aqui.
      const repetida = await pedir(`${CAMINHO_DAS_EMPRESAS}/${EMPRESA_B.id}/suspensao`, {
        metodo: 'POST',
        cookie: cookieDoMaster,
      });

      expect(repetida.status).toBe(200);
      expect(repetida.corpo).toEqual({
        ...(suspensao.corpo as Record<string, unknown>),
        sessoesEncerradas: 0,
      });
    },
    LIMITE_CASO_MS,
  );

  it(
    'CT-225 — reativar a empresa não devolve as sessões encerradas',
    async () => {
      // --- Arranjo, pelas rotas reais: a empresa A com duas pessoas operando, depois suspensa ---
      const cookieDoAdmin = await entrar(ADMIN_DE_A.email);
      const cookieDoUsuario = await entrar(USUARIO_DE_A.email);
      const cookies = [cookieDoAdmin, cookieDoUsuario];

      for (const cookie of cookies) {
        expect((await pedir(CAMINHO_DA_SESSAO_CORRENTE, { cookie })).status).toBe(200);
      }
      expect(await contarSessoesDaEmpresa(EMPRESA_A.id)).toBeGreaterThanOrEqual(2);

      const suspensao = await pedir(`${CAMINHO_DAS_EMPRESAS}/${EMPRESA_A.id}/suspensao`, {
        metodo: 'POST',
        cookie: cookieDoMaster,
      });
      expect(suspensao.status).toBe(200);
      expect(await contarSessoesDaEmpresa(EMPRESA_A.id)).toBe(0);

      // --- A reativação ------------------------------------------------------------------------
      const reativacao = await pedir(`${CAMINHO_DAS_EMPRESAS}/${EMPRESA_A.id}/reativacao`, {
        metodo: 'POST',
        cookie: cookieDoMaster,
      });

      expect(reativacao.status).toBe(200);
      expect(reativacao.corpo).toEqual({ id: EMPRESA_A.id, estado: 'ATIVA' });
      expect((await empresaNaListagem(EMPRESA_A.id))?.estado).toBe('ATIVA');

      // --- O eixo do caso: ela devolve a capacidade de ENTRAR, não as sessões encerradas --------
      for (const cookie of cookies) {
        const comCookieAnterior = await pedir(CAMINHO_DA_SESSAO_CORRENTE, { cookie });
        expect(comCookieAnterior.status).toBe(401);
        expect(comCookieAnterior.corpo).toEqual({
          codigo: CodigoErro.NAO_AUTENTICADO,
          mensagem: MENSAGEM_SEM_SESSAO,
        });
      }
      expect(await contarSessoesDaEmpresa(EMPRESA_A.id)).toBe(0);

      // --- E depois de uma entrada NOVA, a operação responde 2xx --------------------------------
      const cookieNovo = await entrar(ADMIN_DE_A.email);
      const depoisDaEntrada = await pedir(CAMINHO_DA_SESSAO_CORRENTE, { cookie: cookieNovo });
      expect(depoisDaEntrada.status).toBe(200);
      expect(await contarSessoesDaEmpresa(EMPRESA_A.id)).toBe(1);
    },
    LIMITE_CASO_MS,
  );

  it(
    'CT-226 — a listagem traz o estado e nenhum dado de negócio',
    async () => {
      // -----------------------------------------------------------------------------------------
      // Pré-condição: as duas empresas com vínculo E permissão semeados
      // -----------------------------------------------------------------------------------------
      //
      // O cenário tem dado de negócio semeado **justamente para que a ausência dele na resposta
      // signifique algo**. Sem isso, "nenhum identificador de vínculo aparece no corpo" seria
      // verdade vazia sobre um banco que não tem vínculo nenhum.
      await ajustar(ADMIN_DE_A.id, EMPRESA_A.id, [{ chave: CHAVE_SEMEADA, efeito: 'CONCEDIDA' }]);
      await ajustar(USUARIO_DE_B.id, EMPRESA_B.id, [{ chave: CHAVE_SEMEADA, efeito: 'CONCEDIDA' }]);

      const vinculos = [...ACESSOS_DA_EMPRESA_A, ...ACESSOS_DA_EMPRESA_B].map(
        (acesso) => acesso.id,
      );
      expect(vinculos.length).toBeGreaterThan(0);

      // --- Arranjo dos dois estados, pelas rotas reais e com o desfecho afirmado ----------------
      expect(
        (
          await pedir(`${CAMINHO_DAS_EMPRESAS}/${EMPRESA_A.id}/reativacao`, {
            metodo: 'POST',
            cookie: cookieDoMaster,
          })
        ).status,
      ).toBe(200);
      expect(
        (
          await pedir(`${CAMINHO_DAS_EMPRESAS}/${EMPRESA_B.id}/suspensao`, {
            metodo: 'POST',
            cookie: cookieDoMaster,
          })
        ).status,
      ).toBe(200);

      // --- A listagem --------------------------------------------------------------------------
      const resposta = await pedir(CAMINHO_DAS_EMPRESAS, { cookie: cookieDoMaster });
      expect(resposta.status).toBe(200);

      const pagina = resposta.corpo as {
        itens: Record<string, unknown>[];
        total: number;
        limite: number;
        deslocamento: number;
      };

      // O envelope de lista da ADR-0012, por igualdade de conjunto de chaves.
      expect(Object.keys(pagina).sort()).toEqual(['deslocamento', 'itens', 'limite', 'total']);
      expect(pagina.itens.length).toBeGreaterThanOrEqual(2);

      // A janela PADRÃO, na chamada que não declarou nenhuma. O conjunto de chaves acima diz que os
      // dois campos existem; estas duas linhas dizem **o que eles valem** quando ninguém pediu — sem
      // elas, um `.default()` qualquer sobreviveria à suíte. O par (teto, padrão) é amarrado à
      // política no `CT-226 (b)`.
      expect(pagina.limite).toBe(PAGINA_PADRAO_DE_EMPRESAS);
      expect(pagina.deslocamento).toBe(0);

      // Os dois estados, um de cada lado — é o par que impede "tudo ativo" e "tudo suspenso" de
      // passar por acaso.
      const daA = pagina.itens.find((item) => item.id === EMPRESA_A.id);
      const daB = pagina.itens.find((item) => item.id === EMPRESA_B.id);
      expect(daA).toMatchObject({ id: EMPRESA_A.id, nome: EMPRESA_A.nome, estado: 'ATIVA' });
      expect(daB).toMatchObject({ id: EMPRESA_B.id, nome: EMPRESA_B.nome, estado: 'SUSPENSA' });

      // --- O conjunto FECHADO de chaves, item a item --------------------------------------------
      //
      // Igualdade profunda sobre o conjunto de chaves de CADA item, e não do primeiro: um campo
      // acrescentado a um ramo condicional (por exemplo, só para empresa suspensa) escaparia de uma
      // amostra.
      // SUT_IS_CORRECT_BECAUSE: ver {@link CHAVES_DA_EMPRESA_PUBLICADA}. O inventário do item da
      // listagem passou a ser {@link CHAVES_DO_ITEM_DA_LISTAGEM}, com `exclusao`; a asserção segue
      // sendo igualdade profunda item a item, e **nenhuma chave anterior saiu**.
      expect(pagina.itens.map((item) => Object.keys(item).sort())).toEqual(
        pagina.itens.map(() => CHAVES_DO_ITEM_DA_LISTAGEM),
      );

      // E a prévia da empresa A — que a carga povoa com vínculos e permissões — vem INDISPONÍVEL,
      // enquanto o campo existe em todos os itens. Sem esta linha, `exclusao` poderia ser um objeto
      // constante em toda a página e a asserção de chaves acima não distinguiria.
      expect(daA).toMatchObject({
        exclusao: {
          disponivel: false,
          motivo: 'EXCLUSAO_IMPEDIDA_POR_REGISTROS',
          alternativa: 'SUSPENSAO',
        },
      });

      // --- E nada de negócio na SERIALIZAÇÃO do corpo -------------------------------------------
      //
      // A busca é sobre o texto cru, e não sobre o objeto: um dado de negócio aninhado dentro de um
      // campo que a asserção de chaves não alcança apareceria aqui.
      const encontrados = vinculos.filter((vinculo) => resposta.texto.includes(vinculo));
      expect(
        encontrados,
        `identificadores de vínculo vazaram na listagem: ${encontrados.join(', ')}`,
      ).toEqual([]);
      expect(resposta.texto).not.toContain(CHAVE_SEMEADA);
      expect(resposta.texto).not.toContain(ADMIN_DE_A.id);
      expect(resposta.texto).not.toContain(USUARIO_DE_B.id);
    },
    LIMITE_CASO_MS,
  );

  it(
    'CT-226 (b) — a janela da listagem: a segunda página é alcançável e o teto RECUSA',
    async () => {
      // --- A política, amarrada ao módulo -------------------------------------------------------
      //
      // Sem esta linha os dois números seriam órfãos: alargar `MAIOR_PAGINA_DE_EMPRESAS` alargaria
      // junto todo pedido derivado dele, e a fronteira poderia ser empurrada até nunca disparar sem
      // que caso algum reprovasse. É ela que faz o teto ser uma **decisão**, e não um valor que o
      // teste descobre a cada rodada.
      expect([PAGINA_PADRAO_DE_EMPRESAS, MAIOR_PAGINA_DE_EMPRESAS]).toEqual([
        PADRAO_DECLARADO_DA_PAGINA,
        TETO_DECLARADO_DA_PAGINA,
      ]);

      // --- Perna POSITIVA: a segunda página é ALCANÇÁVEL, não apenas ecoada ---------------------
      //
      // Precondição afirmada: com uma empresa só, "a segunda página traz outro item" passaria por
      // vacuidade. A ordem da consulta é total (`criada_em, id`), de modo que o recorte é
      // determinístico qualquer que seja a ordem em que os casos deste arquivo tenham rodado.
      const totalDoConjunto = (await listarEmpresas()).total;
      expect(totalDoConjunto).toBeGreaterThanOrEqual(2);

      const primeira = await pedir(`${CAMINHO_DAS_EMPRESAS}?limite=1&deslocamento=0`, {
        cookie: cookieDoMaster,
      });
      const segunda = await pedir(`${CAMINHO_DAS_EMPRESAS}?limite=1&deslocamento=1`, {
        cookie: cookieDoMaster,
      });

      expect([primeira.status, segunda.status]).toEqual([200, 200]);

      const paginaUm = primeira.corpo as PaginaDaListagem;
      const paginaDois = segunda.corpo as PaginaDaListagem;

      // A janela pedida é a janela SERVIDA — o recorte tem o tamanho declarado, e os dois campos
      // descrevem o que de fato foi devolvido.
      expect([paginaUm.itens.length, paginaDois.itens.length]).toEqual([1, 1]);
      expect([paginaUm.limite, paginaUm.deslocamento]).toEqual([1, 0]);
      expect([paginaDois.limite, paginaDois.deslocamento]).toEqual([1, 1]);

      // **O item é OUTRO.** É esta linha que separa "a janela move o recorte" de "os dois campos
      // ecoam o que se pediu": uma implementação que ignorasse `deslocamento` no `OFFSET` passaria
      // em todas as asserções acima e reprovaria só aqui.
      expect(paginaDois.itens[0]?.id).not.toBe(paginaUm.itens[0]?.id);

      // E o `total` descreve o CONJUNTO, não a página: derivá-lo do recorte devolveria `1` nas duas.
      expect([paginaUm.total, paginaDois.total]).toEqual([totalDoConjunto, totalDoConjunto]);

      // --- Companheiro NEGATIVO: acima do teto RECUSA, e não trunca em silêncio -----------------
      //
      // Truncar faria o cliente acreditar que viu tudo; é o que o esquema da rota declara por
      // escrito, e é o que esta perna mede. O envelope é comparado INTEIRO (ADR-0012), com o campo
      // culpado nomeado — asserir só o status deixaria passar uma recusa que culpa outro campo.
      const acimaDoTeto = await pedir(
        `${CAMINHO_DAS_EMPRESAS}?limite=${String(TETO_DECLARADO_DA_PAGINA + 1)}`,
        { cookie: cookieDoMaster },
      );

      expect(acimaDoTeto.status).toBe(422);
      expect(acimaDoTeto.corpo).toEqual({
        codigo: CodigoErro.CAMPO_INVALIDO,
        mensagem: MENSAGEM_DE_CAMPO_INVALIDO,
        campo: 'limite',
      });

      // O teto EXATO passa. Sem este par, um teto de `1` também recusaria o pedido acima, e a perna
      // negativa não diria nada sobre ONDE a fronteira está.
      const noTeto = await pedir(
        `${CAMINHO_DAS_EMPRESAS}?limite=${String(TETO_DECLARADO_DA_PAGINA)}`,
        { cookie: cookieDoMaster },
      );

      expect(noTeto.status).toBe(200);
      expect((noTeto.corpo as PaginaDaListagem).limite).toBe(TETO_DECLARADO_DA_PAGINA);

      // --- Companheiro NEGATIVO: deslocamento abaixo do piso ------------------------------------
      const abaixoDoPiso = await pedir(`${CAMINHO_DAS_EMPRESAS}?deslocamento=-1`, {
        cookie: cookieDoMaster,
      });

      expect(abaixoDoPiso.status).toBe(422);
      expect(abaixoDoPiso.corpo).toEqual({
        codigo: CodigoErro.CAMPO_INVALIDO,
        mensagem: MENSAGEM_DE_CAMPO_INVALIDO,
        campo: 'deslocamento',
      });
    },
    LIMITE_CASO_MS,
  );

  it(
    'CT-227 — socorro: o Master admite um Admin adicional e ele administra a empresa',
    async () => {
      // --- Arranjo: uma empresa cujo ÚNICO Admin acaba desativado -------------------------------
      const empresa = await admitirEmpresa('Imobiliária Sem Administrador Ltda');
      const primeiro = await admitirAdministrador(empresa.id, 'bruno.primeiro@exemplo.com.br');

      // Ele ENTRA antes da desativação — sem esta perna, "o desativado não entra" passaria sobre
      // uma credencial que nunca serviu.
      const entradaAntes = await entrarCom(primeiro.email, primeiro.senhaProvisoria);
      expect(entradaAntes.status).toBe(200);

      // A desativação é escrita direta no banco: a rota que a fará nasce na T8 (ver o cabeçalho).
      await desativarPessoa(primeiro.usuarioId);

      const entradaDepois = await entrarCom(primeiro.email, primeiro.senhaProvisoria);
      expect(entradaDepois.status).toBe(401);
      expect(entradaDepois.cookies.filter(ehCookieDeSessao)).toEqual([]);

      // --- O socorro: o Master admite OUTRO Admin para a mesma empresa --------------------------
      const socorro = await admitirAdministrador(empresa.id, 'clara.socorro@exemplo.com.br');
      expect(socorro.senhaProvisoria).not.toBe(primeiro.senhaProvisoria);

      // --- Ele entra, e a sessão nasce RESTRITA (RN-09) -----------------------------------------
      const entrada = await entrarCom(socorro.email, socorro.senhaProvisoria);
      expect(entrada.status).toBe(200);
      const cookie = credencialDeSessao(entrada);

      const sessaoRestrita = await pedir(CAMINHO_DA_SESSAO_CORRENTE, { cookie });
      expect(sessaoRestrita.status).toBe(200);
      expect(sessaoRestrita.corpo).toMatchObject({
        usuarioId: socorro.usuarioId,
        perfil: 'ADMIN_EMPRESA',
        empresaId: empresa.id,
        senhaProvisoria: true,
        segundoFatorPendente: false,
      });
      // A Senha provisória é entregue **uma única vez**: nenhuma consulta posterior a devolve.
      expect(sessaoRestrita.texto).not.toContain(socorro.senhaProvisoria);

      // A restrição é observável por COMPORTAMENTO, e não só pela marca: a sessão restrita é
      // recusada nomeando a pendência, ANTES de a autorização por perfil ser consultada.
      const antesDaTroca = await pedir(CAMINHO_DAS_EMPRESAS, { cookie });
      expect(antesDaTroca.status).toBe(403);
      expect(antesDaTroca.corpo).toEqual({
        codigo: CodigoErro.ACESSO_NEGADO,
        mensagem: MENSAGEM_DE_SESSAO_RESTRITA,
      });

      // --- A troca obrigatória, pela rota real ---------------------------------------------------
      const troca = await pedir(ROTA_DE_TROCA_DE_SENHA, {
        metodo: 'POST',
        cookie,
        corpo: { senhaAtual: socorro.senhaProvisoria, senhaNova: SENHA_TROCADA },
      });
      expect(troca.status).toBe(200);

      const cookieDepois = troca.cookies.some(ehCookieDeSessao)
        ? credencialDeSessao(troca)
        : cookie;

      const sessaoPlena = await pedir(CAMINHO_DA_SESSAO_CORRENTE, { cookie: cookieDepois });
      expect(sessaoPlena.status).toBe(200);
      expect(sessaoPlena.corpo).toMatchObject({ senhaProvisoria: false });

      // A MESMA rota, com a MESMA sessão: a recusa deixou de ser a da restrição e passou a ser a da
      // dimensão de perfil. É o par que prova que a restrição saiu — e apenas ela.
      const depoisDaTroca = await pedir(CAMINHO_DAS_EMPRESAS, { cookie: cookieDepois });
      expect(depoisDaTroca.status).toBe(403);
      expect(depoisDaTroca.corpo).toEqual({
        codigo: CodigoErro.ACESSO_NEGADO,
        mensagem: MENSAGEM_DE_ACESSO_NEGADO,
        detalhes: { exigido: EXIGIDO_DE_PERFIL },
      });

      // --- O Master NÃO ajustou permissão de ninguém --------------------------------------------
      //
      // O contador de versão só se move quando um ajuste é gravado (RN-17); em zero, nenhum ajuste
      // existiu. E o efetivo publicado é exatamente a matriz do perfil — o Admin alcança o que
      // alcança **por ser Admin**, e não por concessão individual do operador do SaaS.
      expect(await versaoPersistida(socorro.usuarioId)).toBe(0);
      const efetivo = sessaoPlena.corpo as { telas: string[]; acoes: string[] };
      expect([...efetivo.telas, ...efetivo.acoes].sort()).toEqual(
        [...MATRIZ_POR_PERFIL.ADMIN_EMPRESA].sort(),
      );
      expect(await versaoPersistida(primeiro.usuarioId)).toBe(0);

      // --- E o desativado continua sem entrar ----------------------------------------------------
      expect((await entrarCom(primeiro.email, primeiro.senhaProvisoria)).status).toBe(401);

      // =========================================================================================
      // O PASSO QUE FALTAVA — acrescentado pela T8, sem remover nada do que está acima
      // =========================================================================================
      //
      // Até a T8 este caso parava na troca obrigatória, por dependência circular declarada entre os
      // testes: o card pede que o Admin novo **crie uma pessoa** e **liste as pessoas da empresa**,
      // e as duas rotas nasciam na T8 — enquanto o CT-222 daquela task exigia, na direção oposta,
      // `GET /v1/master/empresas`, que nasce aqui. Com as sete rotas do Admin publicadas, o ciclo
      // deixou de existir e o passo entra.
      //
      // É ele que fecha *"administra a Empresa normalmente"*: o socorro não apenas entra — ele
      // exerce a administração de pessoas, que é o objeto da US-07.

      // 1. Ele CRIA uma pessoa da empresa.
      const criada = await pedir(`/${PREFIXO_DE_VERSAO}/${CAMINHO_DOS_USUARIOS}`, {
        metodo: 'POST',
        cookie: cookieDepois,
        corpo: {
          nome: 'Pessoa Criada Pelo Socorro',
          email: `pessoa.socorro.${randomUUID()}@exemplo.com.br`,
          perfil: 'USUARIO_EMPRESA',
        },
      });
      expect(criada.status).toBe(201);

      // 1-b. As DUAS garantias de vínculo que não dependem de rota de `:id`, medidas AQUI porque
      //      aqui nenhuma rota de `:id` rodou ainda — é a única posição em que elas são observáveis
      //      isoladas. A garantia do alvo (passo 3) alcança as mesmas duas pessoas mais tarde, e a
      //      partir dali qualquer uma das três explicaria o vínculo; medir depois provaria só que
      //      **alguma** delas funcionou.
      //
      //      * a pessoa RECÉM-CRIADA ganha o vínculo na transação da criação — é o que fecha a
      //        janela que o docblock de `criarPessoa` declara;
      //      * QUEM AGE ganha o próprio vínculo ao estabelecer o contexto. O socorro nasceu pela
      //        rota do Master, sem vínculo (a contagem em zero está asserida no passo 4), e a
      //        criação acima foi o primeiro ato dele nesta superfície.
      const criadaPeloSocorro = (criada.corpo as { usuarioId: string }).usuarioId;
      expect(await contarVinculosVisiveis(empresa.id, criadaPeloSocorro)).toBe(1);
      expect(await contarVinculosVisiveis(empresa.id, socorro.usuarioId)).toBe(1);

      // 2. Ele LISTA as pessoas da empresa, e a listagem **inclui o Admin desativado**.
      //
      // A segunda metade é a que importa: quem foi desativado tem de continuar visível, senão a
      // reativação seria inalcançável pela interface — e o primeiro Admin desta empresa foi criado
      // pela rota do Master, isto é, sem vínculo de acesso. Ele aparecer aqui é o que prova que a
      // listagem alcança **todas** as pessoas da empresa, e não apenas as que têm vínculo.
      const listagem = await pedir(`/${PREFIXO_DE_VERSAO}/${CAMINHO_DOS_USUARIOS}`, {
        cookie: cookieDepois,
      });
      expect(listagem.status).toBe(200);

      const pessoas = (listagem.corpo as { itens: { usuarioId: string; ativo: boolean }[] }).itens;
      const identificadores = pessoas.map((pessoa) => pessoa.usuarioId);

      expect(identificadores).toContain(primeiro.usuarioId);
      expect(identificadores).toContain(socorro.usuarioId);
      expect(identificadores).toContain(criadaPeloSocorro);
      // E o estado do desativado é publicado como tal — sem isso, "ele aparece" não diria se a
      // listagem sabe que ele está desativado.
      expect(pessoas.find((pessoa) => pessoa.usuarioId === primeiro.usuarioId)?.ativo).toBe(false);

      // 3. Ele NÃO é alvo das rotas de `:id` — quem age nunca é o alvo.
      //
      // SUT_IS_CORRECT_BECAUSE: este passo asseria `200` sobre `POST /:id/permissoes` com o
      // identificador de **quem estava agindo**, e essa é literalmente a chamada que abre a escalada
      // de privilégio que o Gate 2 bloqueou (ALTO, `security`): a mesma rota, com o alvo igual ao
      // ator, é o caminho por onde uma pessoa concede a si mesma as dezesseis chaves que ainda não
      // tem. O código de produção está certo em recusá-la, e a asserção antiga codificava o
      // comportamento de antes da correção.
      //
      // O passo **não sai** — ele troca de asserção, e a propriedade que ele media não se perde. Ele
      // media *"quem age está alcançável por rota de `:id`"* como **procuração** da garantia de
      // vínculo de quem age (o conjunto vazio foi escolhido justamente para medir alcance, e não
      // permissão). Essa garantia é medida **diretamente** no passo 1-b, por contagem de vínculo, sem
      // passar por rota alguma de `:id` — prova mais forte, e independente desta. E o alcance ao
      // ALVO, que é a metade do `D32`, é provado no passo 4 sobre o colega que **nunca agiu**, que é
      // o caso extremo: vínculo zero antes, um depois.
      //
      // O que fica aqui é a fronteira nova, no cenário em que ela é mais tentadora: o Admin de
      // socorro, com o catálogo inteiro na matriz do perfil, mexendo nas próprias permissões.
      const sobreSiMesmo = await pedir(
        `/${PREFIXO_DE_VERSAO}/${CAMINHO_DOS_USUARIOS}/${socorro.usuarioId}/permissoes`,
        { metodo: 'POST', cookie: cookieDepois, corpo: { ajustes: [] } },
      );
      expect(sobreSiMesmo.status).toBe(422);
      expect(sobreSiMesmo.corpo).toEqual({
        codigo: CodigoErro.CAMPO_INVALIDO,
        mensagem: MENSAGEM_DE_CAMPO_INVALIDO,
        campo: 'id',
        detalhes: { motivo: 'ALVO_E_QUEM_AGE' },
      });

      // 4. E o colega que o Master criou e que **NUNCA AGIU** também é alcançável — inclusive para
      //    ter o acesso REVOGADO. É o cenário literal da US-07, e a metade que faltava.
      //
      // `primeiro` nasceu por `POST /v1/master/empresas/:id/admin`, entrou uma vez e nunca chamou
      // rota alguma de `/v1/usuarios`. Nem entrar nem trocar a senha estabelecem contexto de tenant,
      // de modo que a garantia de vínculo de *quem age* jamais o alcançaria: sem esta perna, o
      // socorro o **vê** na listagem (asserido acima, com `ativo: false`) e recebe `404` em toda
      // rota de `:id` sobre ele — ninguém consegue reativá-lo, desativá-lo, nem revogar o acesso
      // dele, e a credencial dele segue de pé.
      //
      // A contagem de vínculos vem ANTES de qualquer tentativa, para que "ele é alcançável" não seja
      // verdade vazia sobre alguém que já tivesse vínculo por outro caminho.
      expect(await contarVinculosVisiveis(empresa.id, primeiro.usuarioId)).toBe(0);

      const reativado = await pedir(
        `/${PREFIXO_DE_VERSAO}/${CAMINHO_DOS_USUARIOS}/${primeiro.usuarioId}/reativacao`,
        { metodo: 'POST', cookie: cookieDepois },
      );
      expect(reativado.status).toBe(200);
      expect(reativado.corpo).toEqual({ usuarioId: primeiro.usuarioId, ativo: true });
      expect(await contarVinculosVisiveis(empresa.id, primeiro.usuarioId)).toBe(1);

      // O efeito TERMINAL da reativação: ele volta a ENTRAR. Sem esta linha, o `200` da rota não
      // diria se o acesso foi de fato devolvido — e é o acesso, não a marca, que a US-07 persegue.
      const entradaReativada = await entrarCom(primeiro.email, primeiro.senhaProvisoria);
      expect(entradaReativada.status).toBe(200);

      // --- A REVOGAÇÃO, que é o que estava inalcançável -----------------------------------------
      //
      // O número devolvido é comparado com o que EXISTIA um instante antes, e não com um literal:
      // é isso que distingue "encerrada" de "marcada", e a contagem em zero depois fecha o par.
      const sessoesDoPrimeiro = await contarSessoesDaPessoa(primeiro.usuarioId);
      expect(sessoesDoPrimeiro).toBeGreaterThan(0);

      const revogado = await pedir(
        `/${PREFIXO_DE_VERSAO}/${CAMINHO_DOS_USUARIOS}/${primeiro.usuarioId}/desativacao`,
        { metodo: 'POST', cookie: cookieDepois },
      );
      expect(revogado.status).toBe(200);
      expect(revogado.corpo).toEqual({
        usuarioId: primeiro.usuarioId,
        ativo: false,
        sessoesEncerradas: sessoesDoPrimeiro,
      });
      expect(await contarSessoesDaPessoa(primeiro.usuarioId)).toBe(0);
      expect((await entrarCom(primeiro.email, primeiro.senhaProvisoria)).status).toBe(401);
    },
    LIMITE_CASO_MS,
  );
});

// ---------------------------------------------------------------------------------------------
// Observação e arranjo do estado persistido
// ---------------------------------------------------------------------------------------------

/**
 * Quantos registros de sessão existem para as pessoas de uma empresa.
 *
 * **É esta leitura que distingue "encerrada" de "marcada"** (CT-224). Ela é observação de estado
 * persistido pelo acesso restrito a `identidade` — a mesma via pela qual os casos da fatia anterior
 * já afirmam precondição —, e nada foi acrescentado à produção para que ela existisse.
 */
async function contarSessoesDaEmpresa(empresaId: string): Promise<number> {
  const { sessao, usuario } = esquemaIdentidade;

  const linhas = await identidade.acesso.identidade
    .select({ id: sessao.id })
    .from(sessao)
    .innerJoin(usuario, eq(usuario.id, sessao.usuarioId))
    .where(eq(usuario.empresaId, empresaId));

  return linhas.length;
}

/**
 * Quantos registros de sessão existem para **uma** pessoa.
 *
 * Irmã de {@link contarSessoesDaEmpresa}, e separada dela porque o eixo é outro: a desativação de
 * pessoa encerra as sessões **dela**, e comparar o número devolvido pela rota com o que existia um
 * instante antes é o que distingue "encerrada" de "marcada".
 */
async function contarSessoesDaPessoa(usuarioId: string): Promise<number> {
  const { sessao } = esquemaIdentidade;

  const linhas = await identidade.acesso.identidade
    .select({ id: sessao.id })
    .from(sessao)
    .where(eq(sessao.usuarioId, usuarioId));

  return linhas.length;
}

/**
 * Quantos vínculos de acesso existem para a pessoa, **visíveis sob o contexto de uma empresa**.
 *
 * Lida pela unidade de trabalho da produção, sob RLS forçada: o que ela conta é o que a política
 * deixa ver para aquela empresa, e não o conteúdo cru da tabela. É essa restrição que a torna útil
 * nas duas direções — ela afirma que a pessoa admitida pelo Master **não tem** vínculo antes de
 * alguém agir sobre ela, e afirma que nenhum vínculo nasceu para a pessoa de outra empresa.
 */
async function contarVinculosVisiveis(empresaId: string, usuarioId: string): Promise<number> {
  return await contextoDeTenant.executarCom(
    { empresaId },
    async () =>
      await acessoAoNegocio.emUnidadeDeTrabalho(async (tx) => {
        const [linha] = await tx<{ total: string }[]>`
          SELECT count(*) AS total
            FROM negocio.acesso_usuario_app
           WHERE usuario_id = ${usuarioId}
        `;

        return Number(linha?.total ?? 0);
      }),
  );
}

/** O contador de versão de permissão da pessoa, lido do banco. Zero significa "nenhum ajuste". */
async function versaoPersistida(usuarioId: string): Promise<number> {
  const { usuario } = esquemaIdentidade;

  const [linha] = await identidade.acesso.identidade
    .select({ versaoPermissoes: usuario.versaoPermissoes })
    .from(usuario)
    .where(eq(usuario.id, usuarioId))
    .limit(1);

  if (linha === undefined) {
    throw new Error(`a pessoa ${usuarioId} não existe no banco desta execução`);
  }

  return linha.versaoPermissoes;
}

/**
 * Desativa a pessoa no arranjo do CT-227.
 *
 * **Não existe caminho de produção para esta coluna nesta task** — a rota que a moverá
 * (`POST /v1/usuarios/:id/desativacao`) nasce na T8, e criar uma agora seria antecipar aquela task
 * e vazar símbolo test-only para a produção (Iron Law #6). É o mesmo padrão, e a mesma justificativa,
 * de `test/recusa-indistinguivel.e2e.spec.ts`. A partir do arranjo, tudo é pela rota real.
 */
async function desativarPessoa(usuarioId: string): Promise<void> {
  const { usuario } = esquemaIdentidade;

  await identidade.acesso.identidade
    .update(usuario)
    .set({ ativo: false })
    .where(eq(usuario.id, usuarioId));
}

/**
 * Grava ajustes individuais de permissão pelo caminho real da camada de dados (T3).
 *
 * Sob o contexto de tenant e dentro da unidade de trabalho — a coerência ação→tela é validada pela
 * função de domínio e o contador é incrementado na mesma transação. É o que a rota do Admin
 * chamará por dentro quando ela existir (T8); aqui ela é o **arranjo** do CT-226, cujo eixo é o que
 * a listagem do Master NÃO devolve.
 */
async function ajustar(
  usuarioId: string,
  empresaId: string,
  ajustes: readonly { readonly chave: ChaveDoCatalogo; readonly efeito: 'CONCEDIDA' | 'NEGADA' }[],
): Promise<number> {
  return await contextoDeTenant.executarCom(
    { empresaId },
    async () =>
      await acessoAoNegocio.emUnidadeDeTrabalho(
        async (tx) =>
          await escreverAjustes(tx, {
            usuarioId,
            ajustes,
            validarCoerencia: validarCoerenciaDeAjustes,
          }),
      ),
  );
}

// ---------------------------------------------------------------------------------------------
// Operações pelas rotas do Master
// ---------------------------------------------------------------------------------------------

/** Uma empresa como a listagem a publica. */
interface EmpresaPublicada {
  readonly id: string;
  readonly nome: string;
  readonly documento: string;
  readonly estado: string;
  readonly criadaEm: string;
}

/**
 * A página da listagem, no que os casos observam dela.
 *
 * Declarada aqui, e não importada do serviço: o conjunto de chaves do envelope é o que o `CT-226`
 * assere por igualdade, e derivá-lo do tipo do SUT faria a asserção concordar consigo mesma.
 */
interface PaginaDaListagem {
  readonly itens: readonly EmpresaPublicada[];
  readonly total: number;
  readonly limite: number;
  readonly deslocamento: number;
}

/** Documento único por chamada — cada caso que cria empresa precisa de um que ninguém usou. */
function documentoNovo(): string {
  return randomUUID();
}

/** Cria uma empresa pela rota real e devolve o corpo, ou levanta nomeando a recusa. */
async function admitirEmpresa(nome: string): Promise<EmpresaPublicada> {
  const criada = await pedir(CAMINHO_DAS_EMPRESAS, {
    metodo: 'POST',
    cookie: cookieDoMaster,
    corpo: { nome, documento: documentoNovo() },
  });

  if (criada.status !== 201) {
    throw new Error(`a criação de empresa respondeu ${String(criada.status)}: ${criada.texto}`);
  }

  return criada.corpo as EmpresaPublicada;
}

/** O que a admissão de administrador devolve, no que os casos observam dela. */
interface AdministradorAdmitido {
  readonly usuarioId: string;
  readonly email: string;
  readonly senhaProvisoria: string;
}

/** Admite um administrador pela rota real e devolve o corpo, ou levanta nomeando a recusa. */
async function admitirAdministrador(
  empresaId: string,
  email: string,
): Promise<AdministradorAdmitido> {
  const admitido = await pedir(`${CAMINHO_DAS_EMPRESAS}/${empresaId}/admin`, {
    metodo: 'POST',
    cookie: cookieDoMaster,
    corpo: { nome: 'Administrador Admitido', email },
  });

  if (admitido.status !== 201) {
    throw new Error(
      `a admissão de administrador respondeu ${String(admitido.status)}: ${admitido.texto}`,
    );
  }

  const corpo = admitido.corpo as AdministradorAdmitido;

  if (typeof corpo.senhaProvisoria !== 'string' || corpo.senhaProvisoria.length === 0) {
    throw new Error('a admissão de administrador não devolveu Senha provisória');
  }

  return corpo;
}

/** A página de empresas, pela rota real e com a sessão do Master. */
async function listarEmpresas(): Promise<{
  readonly itens: readonly EmpresaPublicada[];
  readonly total: number;
}> {
  const listagem = await pedir(CAMINHO_DAS_EMPRESAS, { cookie: cookieDoMaster });

  if (listagem.status !== 200) {
    throw new Error(`a listagem respondeu ${String(listagem.status)}: ${listagem.texto}`);
  }

  return listagem.corpo as { itens: readonly EmpresaPublicada[]; total: number };
}

/** A empresa de identificador informado, como a listagem a publica. */
async function empresaNaListagem(empresaId: string): Promise<EmpresaPublicada | undefined> {
  return (await listarEmpresas()).itens.find((item) => item.id === empresaId);
}

// ---------------------------------------------------------------------------------------------
// Cliente HTTP
// ---------------------------------------------------------------------------------------------

interface Resposta {
  readonly status: number;
  readonly texto: string;
  readonly corpo: unknown;
  readonly cookies: readonly string[];
}

interface OpcoesDoPedido {
  readonly metodo?: string;
  readonly corpo?: Record<string, unknown>;
  readonly cookie?: string;
}

/**
 * Executa uma requisição HTTP real contra a aplicação.
 *
 * O cabeçalho `Origin` acompanha toda requisição com a MESMA origem da aplicação — é o que um
 * navegador enviaria, e é o que o arcabouço confere nas requisições que carregam cookie. O corpo só
 * é desserializado quando o tipo declarado é JSON.
 */
async function pedir(alvo: string, opcoes: OpcoesDoPedido = {}): Promise<Resposta> {
  const cabecalhos: Record<string, string> = { connection: 'close', origin: base };

  if (opcoes.corpo !== undefined) {
    cabecalhos['content-type'] = 'application/json';
  }
  if (opcoes.cookie !== undefined) {
    cabecalhos.cookie = opcoes.cookie;
  }

  const resposta = await fetch(new URL(alvo, base), {
    method: opcoes.metodo ?? 'GET',
    headers: cabecalhos,
    ...(opcoes.corpo === undefined ? {} : { body: JSON.stringify(opcoes.corpo) }),
  });

  const texto = await resposta.text();
  const tipoDeConteudo = resposta.headers.get('content-type') ?? '';

  return {
    status: resposta.status,
    texto,
    corpo:
      tipoDeConteudo.includes('application/json') && texto.length > 0
        ? (JSON.parse(texto) as unknown)
        : undefined,
    cookies: resposta.headers.getSetCookie(),
  };
}

/** Entra pelo caminho REAL — a rota pública de entrada. Nenhum estado de sessão é forjado. */
async function entrarCom(email: string, senha: string): Promise<Resposta> {
  return await pedir(ROTA_DE_ENTRADA, { metodo: 'POST', corpo: { email, password: senha } });
}

/** Entra com a senha da carga e devolve o cookie de sessão, ou levanta nomeando a recusa. */
async function entrar(email: string): Promise<string> {
  const entrada = await entrarCom(email, SENHA_DA_CARGA);

  if (entrada.status !== 200) {
    throw new Error(`a entrada de ${email} respondeu ${String(entrada.status)}: ${entrada.texto}`);
  }

  return credencialDeSessao(entrada);
}

/** O cabeçalho `Set-Cookie` carrega a credencial de sessão do arcabouço. */
function ehCookieDeSessao(bruto: string): boolean {
  const par = bruto.split(';')[0] ?? '';
  return (par.split('=')[0] ?? '').trim().endsWith(SUFIXO_DO_COOKIE_DE_SESSAO);
}

/** O par `nome=valor` do cookie de sessão, no formato em que o cliente o reenvia. */
function credencialDeSessao(resposta: Resposta): string {
  const cookie = resposta.cookies.find(ehCookieDeSessao);

  if (cookie === undefined) {
    throw new Error('a resposta não devolveu cookie de sessão');
  }

  return cookie.split(';')[0] ?? '';
}
