/**
 * Cobertura de autorização sobre a superfície publicada. T5 da fatia
 * `autorizacao-e-ciclo-de-acesso`.
 *
 * ---------------------------------------------------------------------------
 * INVARIANTES
 * ---------------------------------------------------------------------------
 *
 * | Critério | Caso   | Invariante |
 * |---|---|---|
 * | CA-23 | CT-212 | Uma rota publicada **sem declaração de exigência** é recusada com `403
 * |       |        | ACESSO_NEGADO` **mesmo para a sessão de maior alcance do sistema** — o Sysloc
 * |       |        | Master com o segundo fator já cumprido — e a recusa é a MESMA, corpo por
 * |       |        | corpo, para o Admin que alcança as 17 chaves. A gêmea que difere **apenas**
 * |       |        | pela marca explícita `@NaoExigePermissao()` responde `200` ao mesmo cookie: a
 * |       |        | passagem exige declaração deliberada, e a ausência dela nunca a produz.
 * |       |        | (ADR-0011) |
 * | CA-23 | CT-213 | Sobre a aplicação de PRODUÇÃO montada, o conjunto de rotas governadas pela
 * |       |        | guarda que não declaram exigência nem marca é **vazio**, e o conjunto das
 * |       |        | rotas **públicas** é **exatamente** o inventário revisado — igualdade nos dois
 * |       |        | sentidos, com excedentes e ausentes nomeados. A contagem de rotas enumeradas
 * |       |        | é afirmada em valor EXATO. (ADR-0011, §5.1) |
 * | CA-23 | CT-213 | **PROVA DE FALSIFICAÇÃO, permanente na suíte**: a MESMA conferência, aplicada
 * |       | (b)    | a uma aplicação que carrega as rotas de verificação, REPROVA nos dois eixos —
 * |       |        | nomeia `GET /v1/verificacao-sem-declaracao` no conjunto sem declaração, e
 * |       |        | acusa `GET /v1/verificacao-publica-indevida` como excedente do conjunto
 * |       |        | público. (ADR-0011) |
 * | CA-23 | CT-213 | A unidade classificada é o **manipulador**, e não o caminho: um recurso REST
 * |       | (c)    | comum — `@Get()` de lista e `@Post()` de criação no MESMO `@Controller` — é
 * |       |        | classificado par a par, cada manipulador pela própria declaração, em vez de
 * |       |        | abortar a verificação. E a disputa que continua sendo disputa — o MESMO verbo
 * |       |        | no mesmo caminho, por dois manipuladores — segue **levantando**, nomeando os
 * |       |        | dois. (ADR-0011) |
 *
 * Rastreabilidade: `CA-23 → CT-212 (RN-14)`, `CA-23 → CT-213 (RN-14)`.
 *
 * ===========================================================================
 * A prova de falsificação é o PAR de aplicações — e ela é permanente
 * ===========================================================================
 *
 * A `.claude/rules/testing-stack.md` exige, para asserção que inspeciona a **estrutura** do sistema
 * em vez de exercitá-lo, que se demonstre a asserção **reprovando** com o defeito reintroduzido, e
 * um controle limpo passando no mesmo harness. Aqui os dois lados são casos da suíte, e não uma
 * medição feita uma vez e narrada num comentário:
 *
 *   * **controle** — `criarAplicacao()`, a montagem que atende em operação. Nenhuma rota de
 *     verificação nela;
 *   * **mutante** — a mesma composição raiz mais três rotas de verificação, entre elas uma
 *     publicada **sem declaração alguma** e uma rota de negócio marcada `@RotaPublica()`
 *     indevidamente.
 *
 * A **mesma função** — {@link conferir}, e não duas asserções parecidas — roda sobre as duas, e o
 * resultado esperado é oposto: `{ [], [], [] }` no controle, e os dois conjuntos POVOADOS no
 * mutante, com os valores exatos. Um verificador que classificasse tudo como declarado passaria o
 * controle e reprovaria o mutante; um que classificasse tudo como indeclarado faria o contrário.
 * Nenhum dos dois passa nos dois.
 *
 * As rotas de verificação vivem **neste arquivo** e são registradas apenas na aplicação mutante.
 * Publicar uma rota sem declaração em `apps/api/src` seria criar em produção exatamente a superfície
 * que a ADR-0011 existe para impedir.
 *
 * O `CT-213 (c)` acrescenta duas montagens **mínimas** — sem banco, sem fila, sem sessão —, porque o
 * que elas provam é a GRANULARIDADE da classificação, e não a superfície de produção: um recurso REST
 * comum e uma disputa de verbo. Elas não repetem o par acima; medem outra propriedade.
 *
 * ---------------------------------------------------------------------------
 * MUTANTES EXECUTADOS sobre o verificador (2026-08-04) — os seis reprovaram
 * ---------------------------------------------------------------------------
 *
 * O par de aplicações acima prova que a conferência discrimina **superfícies**. Falta a outra
 * metade, que a `.claude/rules/testing-stack.md` exige e que o par sozinho não dá: que ela
 * discrimina **defeitos do próprio verificador**. Os seis mutantes abaixo foram aplicados ao fonte
 * de `src/autenticacao/cobertura-de-autorizacao.ts` e a suíte foi invocada pelo **script do pacote**
 * (`pnpm --filter @sysloc/api test`), nunca por `vitest run` avulso — este arquivo carrega
 * `@sysloc/auth` e `@sysloc/db` pela fronteira do pacote, e um `vitest run` leria o `dist/` da
 * compilação anterior.
 *
 *   * **controle** — árvore íntegra: `63 passed`;
 *   * **M1 · enumerador devolve vazio** (`rotasDaTabelaDoRoteador` → `[]`): `3 failed | 60 passed`.
 *     A junção levantou nomeando três manipuladores — entre eles `ControladorSemDeclaracao.
 *     responder` — com *"0 candidatos"*. É o modo de falha barulhento no lugar do conjunto vazio
 *     que aprovaria tudo;
 *   * **M2 · enumerador perde UMA rota** (descarta `/docs/LICENSE`): `1 failed | 62 passed`, na
 *     âncora de contagem, com a mensagem *"a superfície publicada mudou de tamanho"* — `18` contra
 *     `19`. É o caso intermediário que um `> 0` deixaria passar;
 *   * **M3 · rota sem declaração classificada como declarada**: `2 failed | 61 passed`, no caso de
 *     falsificação e no `CT-213 (c)`, os dois esperando a rota NOMEADA em `semDeclaracao` e
 *     recebendo conjunto vazio;
 *   * **M4 · marca de rota pública deixa de contar** (o ramo de `publica` neutralizado):
 *     `2 failed | 61 passed`, nos dois casos — a asserção (b) do controle e a do mutante;
 *   * **M5 · leitor ignora o metadado de CLASSE** (`getAllAndOverride(…, [alvo])` sem a classe):
 *     `2 failed | 61 passed`. É o que amarra a leitura à precedência da produção: `@RotaPublica()`
 *     mora na classe em `SaudeController` e em `AutenticacaoController`, e um leitor que só olhasse
 *     o método declararia as três rotas públicas como indeclaradas;
 *   * **M6 · a chave volta a ser o CAMINHO** (`chaveDaRota` devolvendo só o caminho, que é a forma
 *     anterior desta verificação): `3 failed | 60 passed`, e as mensagens são exatamente o defeito
 *     que o `CT-213 (c)` existe para fechar — *"/v1/verificacao-recurso é reivindicado por dois
 *     manipuladores — ControladorDeRecurso.listar e ControladorDeRecurso.criar"* e, na aplicação de
 *     produção, *"/v1/auth/* é reivindicado por dois manipuladores"*, porque o encaminhador passa a
 *     disputar consigo mesmo os sete verbos que atende. É a prova de que a granularidade do par não
 *     é verbosidade: sem ela a verificação ABORTA;
 *   * **reversão** — o fonte foi restaurado e o controle reexecutado: de novo `63 passed`.
 *
 * ---------------------------------------------------------------------------
 * Por que a contagem é EXATA, e não "maior que zero"
 * ---------------------------------------------------------------------------
 *
 * "O conjunto sem declaração é vazio" é verdade vazia sobre um enumerador quebrado. `> 0` fecha o
 * caso degenerado (nada enumerado) e deixa aberto o intermediário — o enumerador que perde metade da
 * árvore continuaria passando, com a metade perdida invisível. A contagem exata fecha os dois: ela é
 * o inventário revisado da superfície, e cresce por decisão de quem publica rota, nunca em silêncio.
 *
 * ---------------------------------------------------------------------------
 * De onde vêm o banco, a fila e a credencial (ADR-0006)
 * ---------------------------------------------------------------------------
 *
 * De instâncias efêmeras próprias. Nenhuma coordenada de conexão é lida do ambiente: o ambiente do
 * processo é MONTADO a partir do que os helpers devolvem. A porta de cada aplicação é **reservada**
 * (trava atômica), e não dinâmica, pela razão que a T8 da fatia anterior registrou: o arcabouço
 * confere a origem das requisições com cookie contra o endereço base, composto a partir da porta
 * CONFIGURADA.
 */

import { randomBytes } from 'node:crypto';
import { Controller, Get, Post, type Type } from '@nestjs/common';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import { SENHA_DA_CARGA, USUARIO_MASTER } from '@sysloc/db';
import { CodigoErro } from '@sysloc/shared';
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
import { AppModule } from '../src/app.module.ts';
import { PREFIXO_DAS_ROTAS_DE_IDENTIDADE } from '../src/autenticacao/autenticacao.module.ts';
import {
  type CoberturaDeAutorizacao,
  type RotaSemDeclaracao,
  verificarCoberturaDeAutorizacao,
} from '../src/autenticacao/cobertura-de-autorizacao.ts';
import { NaoExigePermissao } from '../src/autenticacao/exigencia.decorator.ts';
import { RotaPublica } from '../src/autenticacao/rota-publica.decorator.ts';
import { CAMINHO_DA_TROCA_DE_SENHA_DO_PRODUTO } from '../src/autenticacao/senha.controller.ts';
import { CAMINHO_DA_SESSAO } from '../src/autenticacao/sessao.controller.ts';
import { ENDERECO_DE_ESCUTA, PREFIXO_DE_VERSAO } from '../src/configuracao/ambiente.ts';
import { CAMINHO_DO_CONTRATO, CAMINHO_DO_DOCUMENTO, criarAplicacao } from '../src/main.ts';
import { CAMINHO_DO_MASTER } from '../src/master/empresa.controller.ts';
import { CAMINHO_DOS_USUARIOS } from '../src/usuarios/usuario.controller.ts';
import { decodificarBase32 } from './base32.ts';

/** Limite da montagem: banco migrado, semente, fila e DUAS aplicações. */
const LIMITE_DE_MONTAGEM_MS = 240_000;

/** Limite de um caso que atravessa HTTP e banco várias vezes. */
const LIMITE_CASO_MS = 60_000;

/** Sufixo do nome do cookie de sessão do arcabouço — o prefixo vem da configuração. */
const SUFIXO_DO_COOKIE_DE_SESSAO = 'session_token';

/** Caminho, relativo à raiz, da rota de sessão do produto. Composto, nunca escrito à mão. */
const CAMINHO_DA_SESSAO_CORRENTE = `/${PREFIXO_DE_VERSAO}/${CAMINHO_DA_SESSAO}`;

/** Idem para a troca de senha do produto (T9), composta a partir do dono do segmento. */
const CAMINHO_DA_TROCA_CORRENTE = `/${PREFIXO_DE_VERSAO}/${CAMINHO_DA_TROCA_DE_SENHA_DO_PRODUTO}`;

/** A rota de verificação publicada **sem declaração alguma** — o sujeito do CT-212. */
const CAMINHO_SEM_DECLARACAO = 'verificacao-sem-declaracao';

/** A gêmea dela: difere APENAS pela marca explícita de "não exige permissão". */
const CAMINHO_SEM_EXIGENCIA = 'verificacao-sem-exigencia';

/** A rota de negócio marcada `@RotaPublica()` indevidamente — o mutante da asserção (b). */
const CAMINHO_PUBLICO_INDEVIDO = 'verificacao-publica-indevida';

/** O recurso REST comum do CT-213 (c): um caminho, dois manipuladores, declarações diferentes. */
const CAMINHO_DO_RECURSO = 'verificacao-recurso';

/** O caminho que dois manipuladores disputam pelo MESMO verbo — a disputa que ainda levanta. */
const CAMINHO_EM_DISPUTA = 'verificacao-em-disputa';

/**
 * A mensagem da recusa por ausência de declaração.
 *
 * Literal, e **não** importada da guarda: derivá-la da mesma fonte que o SUT usa faria a asserção
 * concordar consigo mesma, e um erro de texto passaria despercebido nos dois lados.
 */
const MENSAGEM_SEM_DECLARACAO = 'acesso negado: a rota não declara exigência de autorização';

/** Quantas chaves o catálogo tem (RN-15) — a âncora de "o Admin não é recusado por falta de chave". */
const TOTAL_DE_CHAVES = 17;

/**
 * Os **pares método+caminho** que a publicação do contrato registra **direto no adaptador HTTP**.
 *
 * São nove caminhos, todos só de leitura: o adaptador publica `GET` em cada um (e o `HEAD` que ele
 * deriva do `GET`, que não é entrada própria — ver o cabeçalho do módulo verificado). Eles não têm
 * manipulador do arcabouço, e por isso o global guard não corre neles: atendem sem passar por
 * decisão alguma. A lista é literal e escrita à mão de propósito — é a **expectativa revisada**, e
 * derivá-la da mesma fonte que a cobertura classifica faria o caso concordar consigo mesmo. Um par
 * novo que a publicação passe a registrar reprova aqui até alguém olhar para ele.
 *
 * O mesmo conjunto de caminhos é afirmado, por outro caminho e por outro critério, no `CT-020 (d)`
 * de `test/contexto.e2e.spec.ts`: lá por COMPORTAMENTO (a rota responde sem exigir sessão), aqui por
 * ESTRUTURA (a rota não tem manipulador do arcabouço). Que os dois cheguem ao mesmo conjunto é o
 * que torna cada um verificável pelo outro.
 */
const ROTAS_FORA_DO_ARCABOUCO: readonly string[] = [
  `GET /${CAMINHO_DO_CONTRATO}`,
  `GET /${CAMINHO_DO_CONTRATO}-yaml`,
  `GET /${CAMINHO_DO_CONTRATO}/`,
  `GET /${CAMINHO_DO_CONTRATO}/*`,
  `GET /${CAMINHO_DO_CONTRATO}/LICENSE`,
  `GET /${CAMINHO_DO_CONTRATO}/docs/swagger-ui-init.js`,
  `GET /${CAMINHO_DO_CONTRATO}/index.html`,
  `GET /${CAMINHO_DO_CONTRATO}/swagger-ui-init.js`,
  `GET /${CAMINHO_DO_DOCUMENTO}`,
].sort();

/**
 * Os verbos que o encaminhador de identidade atende.
 *
 * Ele é **UM** manipulador (`@All('*')`), e por isso reivindica todos os verbos que o roteador
 * publica no caminho dele — sete pares para um manipulador só. A lista é literal, como todo
 * inventário deste arquivo, e é ela que torna explícito o que a versão por caminho escondia: que
 * `POST` naquele caminho — a entrada, a troca de senha, o segundo fator — também atende sem passar
 * pela decisão da guarda.
 */
const METODOS_DO_ENCAMINHADOR: readonly string[] = [
  'DELETE',
  'GET',
  'OPTIONS',
  'PATCH',
  'POST',
  'PUT',
  'TRACE',
];

/** Os pares do encaminhador de identidade sob um prefixo já composto. */
function paresDoEncaminhador(): readonly string[] {
  return METODOS_DO_ENCAMINHADOR.map((metodo) => `${metodo} ${PREFIXO_DAS_ROTAS_DE_IDENTIDADE}/*`);
}

/**
 * Os **seis pares** que as rotas do operador do SaaS publicam (T7).
 *
 * Escritos à mão, como todo inventário deste arquivo, e compostos a partir do dono do segmento
 * (`CAMINHO_DO_MASTER`) em vez de literais soltos: derivá-los da mesma fonte que a cobertura
 * classifica faria o caso concordar consigo mesmo, e escrever `/v1/master` por extenso deixaria o
 * inventário divergir na primeira mudança de segmento.
 *
 * O `HEAD` que o adaptador deriva do `GET` de `empresas` **não** entra — ele não é entrada própria,
 * e o módulo verificado já o descarta (ver o cabeçalho dele).
 */
function paresDoMaster(): readonly string[] {
  const empresas = `/${PREFIXO_DE_VERSAO}/${CAMINHO_DO_MASTER}/empresas`;
  const usuarios = `/${PREFIXO_DE_VERSAO}/${CAMINHO_DO_MASTER}/usuarios`;

  return [
    `POST ${empresas}`,
    `GET ${empresas}`,
    `POST ${empresas}/:id/admin`,
    `POST ${empresas}/:id/suspensao`,
    `POST ${empresas}/:id/reativacao`,
    `POST ${usuarios}/:id/senha-provisoria`,
  ];
}

/**
 * Os **sete pares** que as rotas de administração de pessoas publicam (T8).
 *
 * Escritos à mão e compostos a partir do dono do segmento (`CAMINHO_DOS_USUARIOS`), pela mesma razão
 * do inventário acima. O `HEAD` derivado do `GET` da coleção **não** entra: ele não é entrada
 * própria, e o módulo verificado já o descarta.
 *
 * As cinco transições de estado são **sub-recursos** de `POST`, e não campos de um `PATCH` — é por
 * isso que elas aparecem aqui como pares distintos, cada um com a própria classificação.
 */
function paresDeUsuarios(): readonly string[] {
  const usuarios = `/${PREFIXO_DE_VERSAO}/${CAMINHO_DOS_USUARIOS}`;

  return [
    `POST ${usuarios}`,
    `GET ${usuarios}`,
    `POST ${usuarios}/:id/permissoes`,
    `POST ${usuarios}/:id/perfil`,
    `POST ${usuarios}/:id/desativacao`,
    `POST ${usuarios}/:id/reativacao`,
    `POST ${usuarios}/:id/senha-provisoria`,
  ];
}

/**
 * O INVENTÁRIO dos pares que não passam pela decisão da guarda, na aplicação de produção.
 *
 * São os nove acima mais os das três rotas marcadas `@RotaPublica()`:
 *
 *   * as **duas verificações de saúde**, consultadas pelo supervisor do sistema operacional e pela
 *     prova de aceitação do reinício — nenhum dos dois com sessão;
 *   * o **encaminhador de identidade**, que precisa ser público porque entrar acontece antes de
 *     existir sessão, e que entra com os sete pares acima.
 *
 * **É esta igualdade que impede a escapatória.** Sem ela, bastaria marcar uma rota de negócio como
 * pública para ela sair da autorização inteira, e o conjunto sem declaração continuaria vazio — a
 * guarda retorna antes para rota pública, e não haveria nada a declarar.
 */
const ROTAS_PUBLICAS_ACEITAS: readonly string[] = [
  ...ROTAS_FORA_DO_ARCABOUCO,
  'GET /saude',
  'GET /saude/pronto',
  ...paresDoEncaminhador(),
].sort();

/**
 * Os pares da aplicação de produção que DECLARAM exigência — o eixo positivo da leitura.
 *
 * SUT_IS_CORRECT_BECAUSE: a T7 publicou as **seis rotas do operador do SaaS**, e as seis declaram
 * `@ExigePerfil('SYSLOC_MASTER')` na classe do controlador. O crescimento deste inventário é a
 * revisão que a ADR-0011 e o cabeçalho deste arquivo exigem de quem publica rota — *"a superfície
 * cresce por decisão de quem publica rota, nunca em silêncio"* —, e não um afrouxamento: **nenhuma
 * entrada anterior saiu** (`GET /v1/sessao` continua aqui), a igualdade segue sendo exata, e as
 * seis entram no conjunto POSITIVO, que é o que prova que elas declaram em vez de dispensar.
 *
 * SUT_IS_CORRECT_BECAUSE: a T8 publicou as **sete rotas de administração de pessoas**, e as sete
 * declaram `@ExigeChave('TELA:usuarios')` na classe do controlador. Vale aqui, palavra por palavra,
 * o parágrafo acima: **nenhuma entrada anterior saiu**, a igualdade segue exata, e as sete entram no
 * conjunto POSITIVO — o que prova que elas declaram exigência em vez de dispensá-la. É a revisão que
 * a ADR-0011 exige de quem publica rota, e ela é o motivo de esta lista ser escrita à mão.
 *
 * SUT_IS_CORRECT_BECAUSE: a T9 publicou `POST /v1/sessao/senha`, a troca de senha do produto, e ela
 * declara `@NaoExigePermissao()` no manipulador. Vale de novo o parágrafo acima — **nenhuma entrada
 * anterior saiu** e a igualdade segue exata —, com uma diferença que é a razão de o conjunto se
 * chamar POSITIVO e não "das que exigem chave": a marca de "não exige" **é** uma declaração, e é ela
 * que a ADR-0011 chama de *"única abertura deliberada"*. A rota entra aqui pelo mesmo motivo que
 * `GET /v1/sessao` entra: ela declara, e o que a ADR-0011 recusa é a rota que não declara nada.
 */
const ROTAS_COM_EXIGENCIA: readonly string[] = [
  `GET ${CAMINHO_DA_SESSAO_CORRENTE}`,
  `POST ${CAMINHO_DA_TROCA_CORRENTE}`,
  ...paresDoMaster(),
  ...paresDeUsuarios(),
].sort();

/**
 * Quantos pares método+caminho a aplicação de produção publica hoje.
 *
 * Os nove do contrato, os dois de saúde, os **sete** do encaminhador de identidade, o da sessão
 * corrente, o da troca de senha do produto, os **seis** do operador do SaaS e os **sete** da
 * administração de pessoas. Ver o cabeçalho para por que a contagem é exata e não "maior que zero".
 *
 * SUT_IS_CORRECT_BECAUSE: mesma razão do inventário acima — a T8 acrescentou sete pares à superfície
 * publicada (25 → 32), e a âncora de contagem existe justamente para que esse acréscimo passe pela
 * revisão de quem lê este arquivo em vez de entrar sozinho.
 *
 * SUT_IS_CORRECT_BECAUSE: a T9 acrescentou **um** par (32 → 33), `POST /v1/sessao/senha`. O
 * desligamento da rota nativa de troca de senha, entregue na mesma task, **não** muda esta contagem:
 * o encaminhador continua sendo um manipulador `@All('*')` sobre um caminho só, e o que mudou foi o
 * que ele repassa ao arcabouço — a recusa acontece dentro do mesmo par `POST /v1/auth/*`, que segue
 * publicado porque toda a demais superfície de identidade continua atendendo por ele.
 */
const ROTAS_PUBLICADAS_EM_PRODUCAO = 33;

/**
 * Quantos pares a aplicação MUTANTE publica.
 *
 * Ela não publica o contrato — quem o faz é `criarAplicacao()`, e a montagem de verificação usa o
 * arcabouço de teste. Sobram os do arcabouço, sob o prefixo de versão sem exclusão — duas de saúde,
 * a sessão corrente, a troca de senha do produto, os sete do encaminhador, os **seis** do operador
 * do SaaS e os **sete** da administração de pessoas —, mais os três das rotas de verificação.
 *
 * SUT_IS_CORRECT_BECAUSE: a aplicação mutante importa a MESMA composição raiz da produção, e a T8
 * registrou o módulo de pessoas nela — os sete pares aparecem aqui pela mesma razão que aparecem lá
 * (19 → 26). A âncora continua sendo de contagem EXATA.
 *
 * SUT_IS_CORRECT_BECAUSE: a T9 acrescentou o par da troca de senha do produto à mesma composição
 * raiz (26 → 27), pela mesma razão do parágrafo acima.
 */
const ROTAS_PUBLICADAS_NO_MUTANTE = 27;

/**
 * O que seria o inventário público da aplicação mutante **se o mutante não estivesse lá**.
 *
 * A montagem de verificação aplica o prefixo de versão sem exclusão, de modo que as rotas de saúde
 * atendem sob `/v1` nela. É contra este inventário que o excedente do mutante aparece nomeado.
 */
const PUBLICAS_LEGITIMAS_NO_MUTANTE: readonly string[] = [
  ...paresDoEncaminhador(),
  `GET /${PREFIXO_DE_VERSAO}/saude`,
  `GET /${PREFIXO_DE_VERSAO}/saude/pronto`,
].sort();

/** Sujeito do eixo "sessão de maior alcance" — o operador do SaaS, sem restrição pendente. */
const MASTER = USUARIO_MASTER;

/** Sujeito do segundo eixo do CT-212: o Admin, cuja matriz é o catálogo inteiro. */
const ADMIN_DE_A = pessoaSemeada('admin.a@exemplo.com.br');

let identidade: IdentidadeEfemera;
let fila: FilaEfemera;

let aplicacaoReal: NestFastifyApplication;

let aplicacaoMutante: NestFastifyApplication;
let baseMutante: string;

/** A montagem do recurso REST comum — um caminho, dois manipuladores (CT-213 c). */
let aplicacaoDeRecurso: NestFastifyApplication;

/** A montagem em que dois manipuladores disputam o MESMO verbo do mesmo caminho (CT-213 c). */
let aplicacaoEmDisputa: NestFastifyApplication;

let ambienteAnterior: NodeJS.ProcessEnv;

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

  ambienteAnterior = { ...process.env };
  process.env.NODE_ENV = 'test';
  process.env.LOG_LEVEL = 'fatal';
  process.env.DATABASE_URL = identidade.banco.cadeiaConexao;
  process.env.REDIS_URL = fila.cadeiaConexao;
  process.env.BETTER_AUTH_SECRET = randomBytes(32).toString('base64url');

  // A aplicação de produção — o CONTROLE. Ela é montada por `criarAplicacao()`, e não remontada
  // aqui: um inventário obtido de uma remontagem descreveria uma aplicação que ninguém sobe.
  const portaReal = await reservarPorta();
  process.env.PORT = String(portaReal);
  aplicacaoReal = await criarAplicacao();
  // O roteador só está completo depois de o adaptador ficar pronto: as rotas dos controladores
  // entram na inicialização do arcabouço, e as do plugin de arquivos estáticos na escuta.
  await aplicacaoReal.listen({ port: portaReal, host: ENDERECO_DE_ESCUTA });

  // A aplicação MUTANTE — mesma composição raiz, mais as três rotas de verificação.
  const portaMutante = await reservarPorta();
  baseMutante = `http://${ENDERECO_DE_ESCUTA}:${String(portaMutante)}`;
  process.env.PORT = String(portaMutante);

  const modulo = await Test.createTestingModule({
    imports: [AppModule],
    controllers: [ControladorSemDeclaracao, ControladorSemExigencia, ControladorPublicoIndevido],
  }).compile();

  aplicacaoMutante = modulo.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
  // Sem as exclusões da aplicação real, de propósito: nenhum caso desta aplicação toca as rotas de
  // saúde por endereço literal, e reproduzir a lista aqui criaria uma segunda cópia dela livre para
  // divergir. O inventário desta montagem já conta com isso.
  aplicacaoMutante.setGlobalPrefix(PREFIXO_DE_VERSAO);
  await aplicacaoMutante.listen({ port: portaMutante, host: ENDERECO_DE_ESCUTA });

  // As duas montagens do CT-213 (c). Elas não sobem servidor: nenhum caso as exercita por HTTP, e
  // `init()` já deixa a tabela do roteador completa — o que exigia `listen()` na aplicação real é o
  // plugin de arquivos estáticos do contrato, que não existe aqui. Reservar porta para elas
  // consumiria recurso do host sem provar nada.
  aplicacaoDeRecurso = await montarMinima([ControladorDeRecurso]);
  aplicacaoEmDisputa = await montarMinima([ControladorQueDisputa, ControladorQueTambemDisputa]);
}, LIMITE_DE_MONTAGEM_MS);

afterAll(async () => {
  await aplicacaoEmDisputa?.close();
  await aplicacaoDeRecurso?.close();
  await aplicacaoMutante?.close();
  await aplicacaoReal?.close();
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

describe('cobertura de autorização sobre a superfície publicada (T5)', () => {
  it(
    'CT-212 — rota sem declaração é recusada até para o Master pleno; só a marca explícita libera',
    async () => {
      // A sessão de MAIOR ALCANCE do sistema: o operador do SaaS, com o segundo fator já cumprido
      // pelo caminho público real. Sem cumpri-lo a sessão nasce restrita (RN-08), e o `403` viria da
      // restrição — não da ausência de declaração, que é o eixo do caso.
      const cookieDoMaster = await entrarComSegundoFatorCumprido(MASTER.email);

      try {
        // Precondição AFIRMADA, e não suposta: é ela que dá sentido a "maior alcance".
        const sessaoDoMaster = await pedir(CAMINHO_DA_SESSAO_CORRENTE, { cookie: cookieDoMaster });
        expect(sessaoDoMaster.status).toBe(200);
        expect(sessaoDoMaster.corpo).toMatchObject({
          perfil: 'SYSLOC_MASTER',
          senhaProvisoria: false,
          segundoFatorPendente: false,
        });

        const semDeclaracaoParaMaster = await pedir(caminho(CAMINHO_SEM_DECLARACAO), {
          cookie: cookieDoMaster,
        });

        expect(semDeclaracaoParaMaster.status).toBe(403);
        // Corpo INTEIRO por igualdade: `ACESSO_NEGADO` — a ADR-0012 proíbe código novo no enum — com
        // a mensagem que diz que o defeito é DA ROTA, e **sem** `detalhes`. Não há exigência a
        // nomear, e inventar uma diria ao cliente que existe uma chave capaz de liberá-lo.
        expect(semDeclaracaoParaMaster.corpo).toEqual({
          codigo: CodigoErro.ACESSO_NEGADO,
          mensagem: MENSAGEM_SEM_DECLARACAO,
        });

        // O par que discrimina: a MESMA sessão alcança a gêmea, que difere apenas pela marca
        // explícita. Sem ele, uma guarda que recusasse tudo passaria a metade de cima.
        const comMarca = await pedir(caminho(CAMINHO_SEM_EXIGENCIA), { cookie: cookieDoMaster });
        expect(comMarca.status).toBe(200);
        expect(comMarca.corpo).toEqual({ alcancada: true });

        // Segundo eixo: o Admin, que alcança as 17 chaves. A recusa não pode vir de permissão que
        // lhe falte, porque não falta nenhuma — e ela é a MESMA, byte a byte.
        const cookieDoAdmin = await entrar(ADMIN_DE_A.email);
        const sessaoDoAdmin = await pedir(CAMINHO_DA_SESSAO_CORRENTE, { cookie: cookieDoAdmin });
        expect(sessaoDoAdmin.status).toBe(200);
        const efetivo = sessaoDoAdmin.corpo as { telas: string[]; acoes: string[] };
        expect(efetivo.telas.length + efetivo.acoes.length).toBe(TOTAL_DE_CHAVES);

        const semDeclaracaoParaAdmin = await pedir(caminho(CAMINHO_SEM_DECLARACAO), {
          cookie: cookieDoAdmin,
        });
        expect(semDeclaracaoParaAdmin.status).toBe(403);
        expect(semDeclaracaoParaAdmin.texto).toBe(semDeclaracaoParaMaster.texto);

        // E a gêmea libera o Admin também: o par positivo/negativo vale nas duas sessões, o que
        // separa "esta rota não atende ninguém" de "esta sessão não alcança esta rota".
        expect(
          (await pedir(caminho(CAMINHO_SEM_EXIGENCIA), { cookie: cookieDoAdmin })).status,
        ).toBe(200);
      } finally {
        // O estado do Master volta ao da carga, pela rota pública, ACONTEÇA O QUE ACONTECER acima:
        // no `finally`, e não como última instrução, porque um `expect` que reprove antes deixaria o
        // segundo fator ativo e faria outro arquivo falhar por arrasto, apontando para o lugar
        // errado.
        await desfazerSegundoFator(cookieDoMaster);
      }
    },
    LIMITE_CASO_MS,
  );

  it('CT-213 — nenhuma rota da superfície publicada existe sem declaração de exigência', () => {
    const cobertura = verificarCoberturaDeAutorizacao(aplicacaoReal);

    // Âncora da enumeração, em valor EXATO. Sem ela, um enumerador que devolvesse conjuntos vazios
    // — ou que perdesse metade da árvore — passaria todas as igualdades abaixo por vacuidade.
    expect(
      cobertura.rotasEnumeradas,
      'a superfície publicada mudou de tamanho: o inventário desta prova precisa ser revisado',
    ).toBe(ROTAS_PUBLICADAS_EM_PRODUCAO);

    // A CONFERÊNCIA — a mesma função que o caso de falsificação aplica ao mutante.
    expect(conferir(cobertura, ROTAS_PUBLICAS_ACEITAS)).toEqual({
      semDeclaracao: [],
      excedentes: [],
      ausentes: [],
    });

    // Eixo POSITIVO: a leitura de declaração de fato encontra declaração. Sem isto, um leitor que
    // devolvesse "declarada" para tudo passaria as igualdades acima — e a cobertura estaria provada
    // sobre nada.
    expect(cobertura.comExigencia).toEqual([...ROTAS_COM_EXIGENCIA]);

    // E a repartição do conjunto público entre "marcada" e "sem manipulador do arcabouço": é o que
    // faz a falha dizer POR QUE uma rota não passa pela decisão, e o que impede o segundo bucket de
    // virar um depósito onde tudo cabe.
    expect(cobertura.foraDoArcabouco).toEqual([...ROTAS_FORA_DO_ARCABOUCO]);
    expect(cobertura.publicas).toEqual([...ROTAS_PUBLICAS_ACEITAS]);
  });

  it('CT-213 (b) — a mesma conferência REPROVA a aplicação que carrega as rotas de verificação', () => {
    const cobertura = verificarCoberturaDeAutorizacao(aplicacaoMutante);

    expect(cobertura.rotasEnumeradas).toBe(ROTAS_PUBLICADAS_NO_MUTANTE);

    // A MESMA função do controle, sobre a montagem com o defeito. Os dois eixos reprovam, e cada um
    // NOMEIA o culpado: o par método+caminho da rota sem declaração, e o caminho excedente do
    // conjunto público. Igualdade de objeto inteiro, e não "não está vazio": um verificador que
    // acusasse a rota errada, ou que acusasse rotas demais, reprova aqui.
    expect(conferir(cobertura, PUBLICAS_LEGITIMAS_NO_MUTANTE)).toEqual({
      semDeclaracao: [
        {
          metodo: 'GET',
          caminho: caminho(CAMINHO_SEM_DECLARACAO),
          controlador: 'ControladorSemDeclaracao',
          manipulador: 'responder',
        },
      ],
      excedentes: [`GET ${caminho(CAMINHO_PUBLICO_INDEVIDO)}`],
      ausentes: [],
    });

    // A gêmea COM a marca explícita não é acusada — ela declara. É o que separa "a verificação
    // reprova o que não declara" de "a verificação reprova toda rota de verificação".
    //
    // SUT_IS_CORRECT_BECAUSE: os seis pares do operador do SaaS e os SETE da administração de
    // pessoas entram aqui pela MESMA razão que entram no controle — a aplicação mutante importa a
    // composição raiz da produção, onde a T7 e a T8 registraram os dois módulos. Nenhuma entrada
    // anterior saiu, e a igualdade segue exata.
    //
    // SUT_IS_CORRECT_BECAUSE: o par da troca de senha do produto entra aqui pela mesma razão, agora
    // da T9 — e ele reforça a distinção que este bloco existe para fazer: a rota do produto declara
    // "não exige" como a gêmea de verificação ao lado, e por isso as duas caem no conjunto POSITIVO,
    // enquanto a que não declara nada continua sendo acusada acima.
    expect(cobertura.comExigencia).toEqual(
      [
        `GET ${CAMINHO_DA_SESSAO_CORRENTE}`,
        `POST ${CAMINHO_DA_TROCA_CORRENTE}`,
        `GET ${caminho(CAMINHO_SEM_EXIGENCIA)}`,
        ...paresDoMaster(),
        ...paresDeUsuarios(),
      ].sort(),
    );

    // E nada aqui é registrado direto no adaptador: o conjunto "fora do arcabouço" não é um depósito
    // que absorva o que a junção não soube ligar — se a junção falhasse, a rota apareceria nele.
    expect(cobertura.foraDoArcabouco).toEqual([]);
  });

  it('CT-213 (c) — o recurso REST comum é classificado par a par; a disputa do MESMO verbo levanta', () => {
    // ---------------------------------------------------------------------------------------
    // Metade 1: dois manipuladores no MESMO caminho, com declarações OPOSTAS
    // ---------------------------------------------------------------------------------------
    //
    // A asserção é o retrato INTEIRO, e ela é discriminante por construção: os dois manipuladores
    // compartilham o caminho e caem em conjuntos DIFERENTES. Nenhuma classificação por caminho
    // consegue produzir este resultado — ela teria de eleger uma das duas declarações para os dois
    // pares, ou abortar, que é o que a versão anterior fazia.
    expect(verificarCoberturaDeAutorizacao(aplicacaoDeRecurso)).toEqual({
      rotasEnumeradas: 2,
      comExigencia: [`GET ${caminho(CAMINHO_DO_RECURSO)}`],
      publicas: [],
      foraDoArcabouco: [],
      semDeclaracao: [
        {
          metodo: 'POST',
          caminho: caminho(CAMINHO_DO_RECURSO),
          controlador: 'ControladorDeRecurso',
          manipulador: 'criar',
        },
      ],
    });

    // ---------------------------------------------------------------------------------------
    // Metade 2: a disputa que CONTINUA sendo disputa
    // ---------------------------------------------------------------------------------------
    //
    // Dois manipuladores reivindicando o MESMO verbo do mesmo caminho é ambiguidade de verdade — não
    // há como dizer qual declaração vale —, e ela tem de seguir levantando. Ver
    // {@link comTabelaDoRoteador} para por que a tabela é apresentada em vez de montada.
    const disputa = capturar(() =>
      verificarCoberturaDeAutorizacao(
        comTabelaDoRoteador(aplicacaoEmDisputa, `└── ${caminho(CAMINHO_EM_DISPUTA)} (GET, HEAD)\n`),
      ),
    );

    expect(disputa?.message).toBe(
      `GET ${caminho(CAMINHO_EM_DISPUTA)} é reivindicado por dois manipuladores — ` +
        'ControladorQueDisputa.responder e ControladorQueTambemDisputa.responder: ' +
        'a cobertura não tem como dizer qual declaração vale',
    );
  });
});

// ---------------------------------------------------------------------------------------------
// As rotas de VERIFICAÇÃO — o mutante. Ver o cabeçalho deste arquivo.
// ---------------------------------------------------------------------------------------------

/**
 * A rota publicada **sem declaração alguma** — o sujeito do CT-212 e metade do mutante do CT-213.
 *
 * Ela é deliberadamente omissa, e o manipulador devolveria `200` se algum dia rodasse: é isso que
 * torna a asserção do CT-212 comportamental. Um `403` produzido por um manipulador que já levantasse
 * erro não distinguiria a guarda do próprio manipulador.
 */
@Controller(CAMINHO_SEM_DECLARACAO)
class ControladorSemDeclaracao {
  @Get()
  responder(): { readonly naoDeveriaChegarAqui: true } {
    return { naoDeveriaChegarAqui: true };
  }
}

/**
 * A GÊMEA da anterior: mesma forma, mesmo manipulador, e **uma única diferença** — a marca explícita
 * de que a rota não exige permissão.
 *
 * O par existe para que a passagem seja atribuível à declaração, e a nada mais: com rotas de formas
 * diferentes, um `200` aqui e um `403` lá provariam que duas rotas se comportam diferente.
 */
@Controller(CAMINHO_SEM_EXIGENCIA)
class ControladorSemExigencia {
  @Get()
  @NaoExigePermissao()
  responder(): { readonly alcancada: true } {
    return { alcancada: true };
  }
}

/**
 * Uma rota de negócio marcada `@RotaPublica()` **indevidamente** — a outra metade do mutante.
 *
 * É a escapatória que a asserção (b) existe para fechar: ela não aparece no conjunto sem declaração,
 * porque a marca **é** a declaração dela e a guarda retorna antes de decidir qualquer coisa. Só a
 * igualdade do inventário público a pega.
 */
@RotaPublica()
@Controller(CAMINHO_PUBLICO_INDEVIDO)
class ControladorPublicoIndevido {
  @Get()
  responder(): { readonly alcancada: true } {
    return { alcancada: true };
  }
}

/**
 * O recurso REST mais comum que existe: **um caminho, dois manipuladores** — `@Get()` de lista e
 * `@Post()` de criação —, e é ele que a versão anterior desta verificação não conseguia classificar.
 *
 * As declarações são deliberadamente OPOSTAS. Fossem iguais, uma classificação por caminho produziria
 * o mesmo retrato de uma por manipulador, e o caso não discriminaria nada: é a diferença entre elas
 * que só a granularidade certa consegue exprimir.
 *
 * A §5.3 do `tech_spec.md` desta fatia declara exatamente esta forma — `POST` e `GET
 * /v1/master/empresas`, na US-01 —, e a T7 vai publicá-la.
 */
@Controller(CAMINHO_DO_RECURSO)
class ControladorDeRecurso {
  @Get()
  @NaoExigePermissao()
  listar(): { readonly alcancada: true } {
    return { alcancada: true };
  }

  @Post()
  criar(): { readonly naoDeveriaChegarAqui: true } {
    return { naoDeveriaChegarAqui: true };
  }
}

/**
 * O primeiro dos dois manipuladores que disputam o MESMO verbo do mesmo caminho.
 *
 * O caminho da classe já carrega o prefixo de versão, e o da gêmea não: montados, os dois publicam
 * caminhos DISTINTOS (`/v1/v1/…` e `/v1/…`), que é o que permite montá-los. Apresentada a tabela do
 * roteador de {@link comTabelaDoRoteador}, os dois passam a resolver para o mesmo caminho — um pela
 * forma sem prefixo, outro pela forma com prefixo —, e a disputa acontece.
 */
@Controller(`${PREFIXO_DE_VERSAO}/${CAMINHO_EM_DISPUTA}`)
class ControladorQueDisputa {
  @Get()
  responder(): { readonly alcancada: true } {
    return { alcancada: true };
  }
}

/** O segundo da disputa — mesma forma, mesmo verbo, sem o prefixo no caminho da classe. */
@Controller(CAMINHO_EM_DISPUTA)
class ControladorQueTambemDisputa {
  @Get()
  responder(): { readonly alcancada: true } {
    return { alcancada: true };
  }
}

// ---------------------------------------------------------------------------------------------
// Acessórios
// ---------------------------------------------------------------------------------------------

/**
 * Uma montagem MÍNIMA: só os controladores informados, sob o prefixo de versão, sem servidor.
 *
 * `init()` basta porque o que se lê dela é a tabela do roteador do arcabouço — medido: o adaptador
 * já a imprime completa depois dele. Quem exigia `listen()` na aplicação real é o plugin de arquivos
 * estáticos do contrato, que aqui não existe.
 */
async function montarMinima(
  controladores: readonly Type<unknown>[],
): Promise<NestFastifyApplication> {
  const modulo = await Test.createTestingModule({ controllers: [...controladores] }).compile();
  const aplicacao = modulo.createNestApplication<NestFastifyApplication>(new FastifyAdapter());

  aplicacao.setGlobalPrefix(PREFIXO_DE_VERSAO);
  await aplicacao.init();

  return aplicacao;
}

/**
 * A MESMA aplicação, com a **tabela do roteador** apresentada em vez de lida — e nada mais.
 *
 * Existe por uma razão medida, e não por conveniência: **a disputa não é montável**. O adaptador HTTP
 * recusa registrar dois manipuladores do mesmo verbo no mesmo caminho, com
 * `Method 'GET' already declared for route '…'`, de modo que nenhuma aplicação real pode exibir a
 * situação que o levantamento existe para pegar. Ele é guarda contra defeito da **junção**, não
 * contra aplicação publicável.
 *
 * A substituição é do mínimo possível: `get` delega à aplicação REAL, e por isso o leitor de
 * metadado (a instância de `Reflector` da montagem), o prefixo global e o descobridor de
 * controladores continuam sendo os verdadeiros. O que se troca é só o texto da tabela — a única
 * entrada que a montagem não consegue produzir.
 */
function comTabelaDoRoteador(
  aplicacao: NestFastifyApplication,
  arvore: string,
): NestFastifyApplication {
  return {
    getHttpAdapter: () => ({ getInstance: () => ({ printRoutes: () => arvore }) }),
    get: (tipo: unknown, opcoes: unknown) =>
      (aplicacao.get as (alvo: unknown, opcoes: unknown) => unknown)(tipo, opcoes),
  } as unknown as NestFastifyApplication;
}

/** O erro que uma chamada levantou, ou `undefined` se ela não levantou nenhum. */
function capturar(acao: () => unknown): Error | undefined {
  try {
    acao();
  } catch (erro) {
    return erro as Error;
  }

  return undefined;
}

/** O resultado da conferência — o mesmo formato para o controle e para o mutante. */
interface Conferencia {
  readonly semDeclaracao: readonly RotaSemDeclaracao[];
  readonly excedentes: readonly string[];
  readonly ausentes: readonly string[];
}

/**
 * A conferência da cobertura contra um inventário — **a asserção, escrita uma vez só**.
 *
 * Ela roda sobre o controle e sobre o mutante, e é isso que faz o par ser prova de falsificação em
 * vez de duas asserções parecidas: o que muda entre os dois casos é a aplicação, nunca o critério.
 *
 * A igualdade do conjunto público é dita nos DOIS sentidos, com as diferenças nomeadas: excedente é
 * rota que passou a dispensar a decisão sem revisão, e ausente é rota que precisava dispensá-la e
 * deixou de fazê-lo. Uma igualdade só diria "diferente" sem dizer de que lado.
 */
function conferir(cobertura: CoberturaDeAutorizacao, inventario: readonly string[]): Conferencia {
  return {
    semDeclaracao: cobertura.semDeclaracao,
    excedentes: cobertura.publicas.filter((rota) => !inventario.includes(rota)),
    ausentes: inventario.filter((rota) => !cobertura.publicas.includes(rota)),
  };
}

/** Caminho absoluto de uma rota de verificação, sob o prefixo de versão. */
function caminho(rota: string): string {
  return `/${PREFIXO_DE_VERSAO}/${rota}`;
}

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
 * Executa uma requisição HTTP real contra a aplicação mutante — a única que os casos exercitam por
 * HTTP.
 *
 * O cabeçalho `Origin` acompanha toda requisição com a MESMA origem da aplicação: é o que um
 * navegador enviaria, e é o que o arcabouço confere nas requisições que carregam cookie.
 */
async function pedir(alvo: string, opcoes: OpcoesDoPedido = {}): Promise<Resposta> {
  const cabecalhos: Record<string, string> = { connection: 'close', origin: baseMutante };
  if (opcoes.corpo !== undefined) {
    cabecalhos['content-type'] = 'application/json';
  }
  if (opcoes.cookie !== undefined) {
    cabecalhos.cookie = opcoes.cookie;
  }

  const resposta = await fetch(new URL(alvo, baseMutante), {
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

/** Entra pelo caminho REAL — a rota pública de entrada — e devolve o cookie de sessão. */
async function entrar(email: string): Promise<string> {
  const entrada = await pedir(`${PREFIXO_DAS_ROTAS_DE_IDENTIDADE}/sign-in/email`, {
    metodo: 'POST',
    corpo: { email, password: SENHA_DA_CARGA },
  });

  if (entrada.status !== 200) {
    throw new Error(`a entrada de ${email} respondeu ${String(entrada.status)}: ${entrada.texto}`);
  }

  return credencialDeSessao(entrada);
}

/**
 * Entra e **cumpre a exigência de segundo fator**, pelo caminho público real.
 *
 * O Master nasce da carga sem segundo fator configurado, e a sessão dele é restrita até que ele o
 * configure (RN-08). Nada é forjado: o segredo sai do endereço que a própria resposta do preparo
 * devolveu, e o código é derivado pela função de geração **do arcabouço**. A verificação emite
 * credencial de sessão nova e apaga a anterior, e é a nova que sai daqui.
 */
async function entrarComSegundoFatorCumprido(email: string): Promise<string> {
  const cookie = await entrar(email);

  const preparo = await pedir(`${PREFIXO_DAS_ROTAS_DE_IDENTIDADE}/two-factor/enable`, {
    metodo: 'POST',
    cookie,
    corpo: { password: SENHA_DA_CARGA },
  });

  if (preparo.status !== 200) {
    throw new Error(
      `o preparo do segundo fator respondeu ${String(preparo.status)}: ${preparo.texto}`,
    );
  }

  const totpURI = (preparo.corpo as { totpURI?: unknown }).totpURI;
  if (typeof totpURI !== 'string') {
    throw new Error('o preparo do segundo fator não devolveu o endereço de configuração');
  }

  const ativacao = await pedir(`${PREFIXO_DAS_ROTAS_DE_IDENTIDADE}/two-factor/verify-totp`, {
    metodo: 'POST',
    cookie,
    corpo: { code: await codigoDoSegundoFator(totpURI) },
  });

  if (ativacao.status !== 200) {
    throw new Error(
      `a ativação do segundo fator respondeu ${String(ativacao.status)}: ${ativacao.texto}`,
    );
  }

  return credencialDeSessao(ativacao);
}

/** Desfaz o segundo fator pela rota pública, devolvendo a pessoa ao estado da carga. */
async function desfazerSegundoFator(cookie: string): Promise<void> {
  const desfeito = await pedir(`${PREFIXO_DAS_ROTAS_DE_IDENTIDADE}/two-factor/disable`, {
    metodo: 'POST',
    cookie,
    corpo: { password: SENHA_DA_CARGA },
  });

  if (desfeito.status !== 200) {
    throw new Error(
      `a desativação do segundo fator respondeu ${String(desfeito.status)}: ${desfeito.texto}`,
    );
  }
}

/**
 * Deriva o código do segundo fator a partir do endereço de configuração.
 *
 * A derivação é a **do próprio arcabouço** (`api.generateTOTP`), e não uma reimplementação: uma
 * cópia do algoritmo provaria que duas implementações concordam, não que a nossa confere o código
 * que o arcabouço espera. Só a decodificação de transporte (base32 do endereço) é local, porque o
 * decodificador do arcabouço vive num pacote transitivo que `apps/api` não resolve.
 */
async function codigoDoSegundoFator(totpURI: string): Promise<string> {
  const codificado = new URL(totpURI).searchParams.get('secret');

  if (codificado === null) {
    throw new Error(`o endereço de configuração do segundo fator não trouxe segredo: ${totpURI}`);
  }

  const { code } = await identidade.autenticacao.api.generateTOTP({
    body: { secret: decodificarBase32(codificado) },
  });

  return code;
}

/** O par `nome=valor` do cookie de sessão, no formato em que o cliente o reenvia. */
function credencialDeSessao(resposta: Resposta): string {
  const cookie = resposta.cookies.find((candidato) =>
    (candidato.split(';')[0] ?? '').split('=')[0]?.trim().endsWith(SUFIXO_DO_COOKIE_DE_SESSAO),
  );

  if (cookie === undefined) {
    throw new Error('a entrada bem-sucedida não devolveu cookie de sessão');
  }

  return cookie.split(';')[0] ?? '';
}
