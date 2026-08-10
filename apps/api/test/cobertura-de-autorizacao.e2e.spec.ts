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
 * | CA-23 | CT-355 | Sobre a aplicação de PRODUÇÃO montada, **nenhum manipulador declara menos do
 * |       |        | que a classe dele exige**: onde as duas declarações existem, o conjunto de
 * |       |        | átomos do MÉTODO contém o da CLASSE. A MESMA função, aplicada ao defeito
 * |       |        | literal (área na classe, ação no método), o **acusa nomeando o
 * |       |        | manipulador** — e não acusa a gêmea que declara a conjunção. |
 *
 * | CA-12 | CT-318 | As **33 rotas** que a fatia `cadastro-de-imoveis-e-pessoas` publica constam,
 * |       |        | uma a uma, no conjunto POSITIVO; **nenhuma** delas está entre as públicas nem
 * |       |        | fora do arcabouço; a metade do inventário ANTERIOR à fatia está intacta por
 * |       |        | igualdade de array; e a superfície cresceu de exatamente 33 — o delta é
 * |       |        | afirmado **além** do total, e medido sobre a superfície observada. (ADR-0011) |
 *
 * | CA-16 | CT-427 | As **quatro rotas governadas de contrato** — ativação, cancelamento, retirada e
 * | CA-17 |        | recirculação — declaram no MÉTODO a **conjunção inteira**, com `TELA:contratos`
 * |       |        | **seguido** da ação própria, **nesta ordem** (a recusa nomeia a PRIMEIRA
 * |       |        | ausente); a rota de **situação de locação** não declara nada no método e exige
 * |       |        | **exatamente** `TELA:imoveis`, que é a da classe; `semDeclaracao` é vazio; e a
 * |       |        | superfície publicada bate com as âncoras VIGENTES — **80** pares e **65**
 * |       |        | manipuladores, cada uma medida por varredura própria. (ADR-0011, ADR-0018,
 * |       |        | ADR-0019) |
 *
 * Rastreabilidade: `CA-23 → CT-212 (RN-14)`, `CA-23 → CT-213 (RN-14)`, `CA-23 → CT-355 (RN-14)`.
 * Acrescida pela T11 da fatia `cadastro-de-imoveis-e-pessoas`: `CA-12 → CT-318 (RN-14)`.
 * Acrescida pela T10 da fatia `contratos-de-locacao`: `CA-16 → CT-427 (RN-13)`,
 * `CA-17 → CT-427 (RN-14)`.
 *
 * ===========================================================================
 * Por que o CT-318 existe ao lado do CT-213, que já afirma o mesmo conjunto
 * ===========================================================================
 *
 * O `CT-213` afirma `comExigencia` por igualdade contra um inventário ÚNICO e a contagem por um
 * TOTAL único. Isso pega crescimento e encolhimento, e deixa aberta uma terceira forma: a **troca**.
 * Um par da F1 que sumisse enquanto um par da fatia entrasse no lugar dele manteria o total em `66`
 * — e a igualdade do `CT-213` reprovaria, sim, mas apontando para o inventário inteiro, sem dizer de
 * que lado da fronteira o erro está.
 *
 * O `CT-318` parte o inventário em duas metades nomeadas — {@link EXIGENCIA_ANTERIOR_A_FATIA} e
 * {@link PARES_NOVOS_DA_FATIA} — e afirma cada uma por si, mais o **delta** medido sobre a superfície
 * observada (`rotasEnumeradas` menos os 33 novos, contra a âncora de antes). É o que a §6.6 da T11
 * pede por extenso: *"afirmar o delta (33) além do total é o que impede um erro de contagem de passar
 * despercebido numa atualização apressada do inventário"*.
 *
 * **A partir da T6 da fatia `contratos-de-locacao` a partição tem TRÊS metades**, e não duas:
 * {@link EXIGENCIA_ANTERIOR_A_FATIA}, {@link PARES_NOVOS_DA_FATIA} e
 * {@link PARES_DA_FATIA_DE_CONTRATOS}. Engordar a segunda com as rotas de contrato teria sido a saída
 * mais curta e a errada — o `CT-318` afirma o tamanho dela em `33` por escrito, e o delta dele
 * passaria a somar duas fatias diferentes num número só. Com a terceira metade nomeada, cada fatia
 * responde pelo próprio crescimento e a metade antiga continua sendo afirmada por igualdade de array.
 *
 * ===========================================================================
 * O CT-355 audita o CONTEÚDO da declaração — o eixo que faltava (ADR-0018)
 * ===========================================================================
 *
 * O `CT-213` audita a **existência** da declaração: nenhuma rota governada sem nada declarado. Isso
 * deixa em aberto um defeito inteiro, e ele custou o primeiro `REJEITADO` da T5 do domínio de
 * locação: `getAllAndOverride` **substitui**, de modo que declarar `@ExigeChave` num método de uma
 * classe que já declara **apaga** a exigência da classe naquela rota. A rota segue declarando
 * *alguma coisa*, o `CT-213` segue verde, e a área desaparece.
 *
 * Foi assim que `POST /v1/conjuntos/:id/retirada` passou a exigir apenas `ACAO:excluir_cadastro`.
 * A coerência do catálogo **não** cobre a lacuna — `MAPA_ACAO_TELA['ACAO:excluir_cadastro']` é
 * `TELA:cadastros`, não `TELA:imoveis` —, e quem administra locador, locatário e fiador recebia
 * `403` para listar conjuntos e `200` para retirá-los.
 *
 * **Por que a asserção é estrutural, e não um caso de comportamento por rota.** A T6, a T7 e a T9
 * publicam as MESMAS duas rotas de circulação em mais quatro controladores. Um caso por entidade
 * dependeria de cada autor futuro lembrar de escrevê-lo — e foi exatamente um esquecimento desse
 * tipo que produziu o defeito. Esta asserção varre a superfície inteira: qualquer manipulador que
 * nasça declarando menos do que a classe dele exige reprova aqui sem que ninguém precise se lembrar
 * de nada. É a topologia, e não a ocorrência — e é a segunda metade do predicado de cobertura que a
 * **ADR-0018** fixa: *"nenhum manipulador exige menos do que a classe dele exige"*, ao lado do
 * *"nenhuma rota sem declaração"* que a ADR-0011 já pedia.
 *
 * A falsificação é **permanente na suíte**, no mesmo molde do `CT-213 (b)`: `ControladorQueSubstitui`
 * carrega o defeito literal e `ControladorQueCompoe` difere dele **apenas** por declarar a
 * conjunção. A mesma função roda nas duas montagens, e o resultado esperado é oposto.
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
import { METHOD_METADATA } from '@nestjs/common/constants.js';
import { DiscoveryService, MetadataScanner, ModulesContainer, Reflector } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import type { Exigencia } from '@sysloc/auth';
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
import {
  EXIGENCIA,
  ExigeChave,
  ExigeChaves,
  NaoExigePermissao,
} from '../src/autenticacao/exigencia.decorator.ts';
import { ROTA_PUBLICA, RotaPublica } from '../src/autenticacao/rota-publica.decorator.ts';
import { CAMINHO_DA_TROCA_DE_SENHA_DO_PRODUTO } from '../src/autenticacao/senha.controller.ts';
import { CAMINHO_DA_SESSAO } from '../src/autenticacao/sessao.controller.ts';
import { CAMINHO_DOS_FIADORES } from '../src/cadastros/fiador.controller.ts';
import { CAMINHO_DOS_LOCADORES } from '../src/cadastros/locador.controller.ts';
import { CAMINHO_DOS_LOCATARIOS } from '../src/cadastros/locatario.controller.ts';
import { CAMINHO_DAS_COBRANCAS } from '../src/cobrancas/cobranca.controller.ts';
import { ENDERECO_DE_ESCUTA, PREFIXO_DE_VERSAO } from '../src/configuracao/ambiente.ts';
import { CAMINHO_DOS_CONTRATOS } from '../src/contratos/contrato.controller.ts';
import { CAMINHO_DOS_COMODOS } from '../src/imoveis/comodo.controller.ts';
import { CAMINHO_DOS_CONJUNTOS } from '../src/imoveis/conjunto.controller.ts';
import { CAMINHO_DOS_IMOVEIS } from '../src/imoveis/imovel.controller.ts';
import { CAMINHO_DO_CONTRATO, CAMINHO_DO_DOCUMENTO, criarAplicacao } from '../src/main.ts';
import { CAMINHO_DO_MASTER } from '../src/master/empresa.controller.ts';
import { CAMINHO_DE_MULTA_E_JUROS } from '../src/mora/mora.controller.ts';
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
 *
 * SUT_IS_CORRECT_BECAUSE: o código de produção está certo e este literal é que descrevia o estado
 * anterior. Ele era `'acesso negado: a rota não declara exigência de autorização'` — texto de um
 * defeito interno de publicação que, pela ordem da guarda (o metadado é lido ANTES de a sessão ser
 * resolvida), chegava também a cliente ANÔNIMO e permitia separar por varredura as rotas bem
 * declaradas das mal declaradas. É o débito D17 da §2 do run-report desta fatia. Passou a ser a
 * mensagem canônica de `ACESSO_NEGADO`, indistinguível de qualquer outra recusa de autorização; a
 * distinção migrou para o `logger.warn` do ponto da recusa, que o cliente não lê. O discriminante
 * ESTRUTURAL que este caso assere — a ausência de `detalhes` — não mudou.
 */
const MENSAGEM_SEM_DECLARACAO = 'acesso negado para esta sessão';

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
 * Os **seis pares** que as rotas de conjunto publicam (T5 da fatia `cadastro-de-imoveis-e-pessoas`).
 *
 * Escritos à mão e compostos a partir do dono do segmento (`CAMINHO_DOS_CONJUNTOS`), pela mesma razão
 * dos inventários acima. O `HEAD` derivado do `GET` da coleção **não** entra: ele não é entrada
 * própria, e o módulo verificado já o descarta.
 *
 * As duas transições de circulação são **sub-recursos** de `POST`, e não campos de um `PATCH` — é por
 * isso que elas aparecem aqui como pares distintos, cada um com a própria classificação. E elas são
 * as únicas desta superfície que declaram no MÉTODO (`ACAO:excluir_cadastro`): as outras quatro
 * herdam a declaração da classe (`TELA:imoveis`). Nos dois casos há declaração, que é o que este
 * caso mede.
 */
function paresDeConjuntos(): readonly string[] {
  const conjuntos = `/${PREFIXO_DE_VERSAO}/${CAMINHO_DOS_CONJUNTOS}`;

  return [
    `POST ${conjuntos}`,
    `GET ${conjuntos}`,
    `GET ${conjuntos}/:id`,
    `PUT ${conjuntos}/:id`,
    `POST ${conjuntos}/:id/retirada`,
    `POST ${conjuntos}/:id/recirculacao`,
  ];
}

/**
 * Os **seis pares** que as rotas de imóvel publicam (T6 da fatia `cadastro-de-imoveis-e-pessoas`).
 *
 * Escritos à mão e compostos a partir do dono do segmento (`CAMINHO_DOS_IMOVEIS`), pela mesma razão
 * dos inventários acima. O `HEAD` derivado do `GET` da coleção **não** entra: ele não é entrada
 * própria, e o módulo verificado já o descarta.
 *
 * As duas transições de circulação são **sub-recursos** de `POST`, e não campos de um `PATCH`. Elas
 * são as únicas desta superfície que declaram no MÉTODO — e declaram a **conjunção inteira**
 * (`@ExigeChaves(TELA:imoveis, ACAO:excluir_cadastro)`), nunca só a ação: é o `CT-355` que audita
 * esse conteúdo, e é a ADR-0018 que o fixa. As outras quatro herdam a declaração da classe. Nos dois
 * casos há declaração, que é o que **este** caso mede.
 */
function paresDeImoveis(): readonly string[] {
  const imoveis = `/${PREFIXO_DE_VERSAO}/${CAMINHO_DOS_IMOVEIS}`;

  return [
    `POST ${imoveis}`,
    `GET ${imoveis}`,
    `GET ${imoveis}/:id`,
    `PUT ${imoveis}/:id`,
    `POST ${imoveis}/:id/retirada`,
    `POST ${imoveis}/:id/recirculacao`,
  ];
}

/**
 * Os **três pares** que as rotas de cômodo publicam (T7 da fatia `cadastro-de-imoveis-e-pessoas`).
 *
 * Escritos à mão e compostos a partir do dono do segmento (`CAMINHO_DOS_COMODOS`, que por sua vez
 * deriva de `CAMINHO_DOS_IMOVEIS`), pela mesma razão dos inventários acima.
 *
 * **Não existe par de LEITURA**, e a ausência é contrato: o cômodo não tem representação própria na
 * API — ele chega e volta dentro do imóvel, que é o agregado dele (§4.1). As três escritas respondem
 * com o imóvel inteiro já recalculado.
 *
 * As três declaram pela **classe** e nenhuma declara no método — nem a de remoção. Ver a razão no
 * `SUT_IS_CORRECT_BECAUSE` de {@link ROTAS_COM_EXIGENCIA}: a ação sensível é da saída de circulação
 * de cadastro, e a ADR-0014 exclui o cômodo daquele alcance.
 */
function paresDeComodos(): readonly string[] {
  const comodos = `/${PREFIXO_DE_VERSAO}/${CAMINHO_DOS_COMODOS}`;

  return [`POST ${comodos}`, `PUT ${comodos}/:comodoId`, `DELETE ${comodos}/:comodoId`];
}

/**
 * Os **seis pares** que UM papel de cadastro de pessoa publica (T9 da fatia
 * `cadastro-de-imoveis-e-pessoas`).
 *
 * Compostos a partir do dono do segmento, que é passado por argumento — os três papéis publicam a
 * MESMA superfície, e escrever três listas idênticas a não ser pelo caminho daria três lugares para
 * esquecer um par. O `HEAD` derivado do `GET` da coleção **não** entra: ele não é entrada própria, e
 * o módulo verificado já o descarta.
 *
 * As duas transições de circulação são **sub-recursos** de `POST`. Elas são as únicas desta
 * superfície que declaram no MÉTODO — e declaram a **conjunção inteira**
 * (`@ExigeChaves(TELA:cadastros, ACAO:excluir_cadastro)`), nunca só a ação. Aqui a forma importa
 * mais do que em qualquer outra superfície da fatia: `MAPA_ACAO_TELA['ACAO:excluir_cadastro']` **é**
 * `TELA:cadastros`, de modo que declarar só a ação produziria, por coincidência, a mesma área
 * exigida — e nenhuma prova comportamental reprovaria. Quem audita esse conteúdo é o `CT-355`, por
 * ESTRUTURA; este caso mede a **existência** da declaração.
 */
function paresDeUmPapelDeCadastro(caminhoDoPapel: string): readonly string[] {
  const papel = `/${PREFIXO_DE_VERSAO}/${caminhoDoPapel}`;

  return [
    `POST ${papel}`,
    `GET ${papel}`,
    `GET ${papel}/:id`,
    `PUT ${papel}/:id`,
    `POST ${papel}/:id/retirada`,
    `POST ${papel}/:id/recirculacao`,
  ];
}

/**
 * Os **oito pares** que a superfície de contrato publica — as seis rotas de cadastro (T6), a
 * **ativação** (T7) e o **cancelamento** (T8), da fatia `contratos-de-locacao`.
 *
 * Escritos à mão e compostos a partir do dono do segmento (`CAMINHO_DOS_CONTRATOS`), pela mesma razão
 * dos inventários acima. O `HEAD` derivado do `GET` da coleção **não** entra: ele não é entrada
 * própria, e o módulo verificado já o descarta.
 *
 * **A chave da rota é o `:codigo`, e não um `:id`** — o contrato tem série declarada, e a ADR-0017 lhe
 * dá o código legível como chave exposta. O nome do parâmetro entra literalmente no par, porque é ele
 * que o roteador publica.
 *
 * SUT_IS_CORRECT_BECAUSE: o código de produção está certo e era este inventário que descrevia uma
 * superfície sem a ativação. A T7 publicou `POST /v1/contratos/:codigo/ativacao` — rota própria por
 * decisão da ADR-0019 —, e uma tabela que a ignorasse deixaria o `CT-213` e o `CT-318` passarem sobre
 * uma superfície incompleta, que é exatamente o modo de falha silencioso que estes inventários
 * existem para fechar. **Nenhuma entrada anterior saiu**, a igualdade segue exata, e o par novo entra
 * no conjunto POSITIVO — o que prova que ele declara exigência em vez de dispensá-la.
 *
 * SUT_IS_CORRECT_BECAUSE: a T8 publicou `POST /v1/contratos/:codigo/cancelamento` — a segunda
 * transição governada, com ação sensível **própria** (`ACAO:cancelar_contrato`) —, e vale aqui,
 * palavra por palavra, o parágrafo acima: uma tabela que a ignorasse deixaria o `CT-213` e o `CT-318`
 * passarem sobre uma superfície incompleta. **Nenhuma entrada anterior saiu**, a igualdade segue
 * exata, e o par novo entra no conjunto POSITIVO. Com ele a máquina de estados fecha, e o único par
 * ainda por vir nesta fatia é o da rota de situação de locação (T10), que vive sob `/v1/imoveis`.
 *
 * As duas de circulação, a ativação **e o cancelamento** são as únicas desta superfície que declaram
 * no MÉTODO — e as quatro declaram a **conjunção inteira**
 * (`@ExigeChaves(TELA:contratos, <ação>)`), nunca só a ação. Aqui a forma tem consequência material:
 * `MAPA_ACAO_TELA['ACAO:excluir_cadastro']` é `TELA:cadastros`, que **não** é a área desta classe —
 * declarar só a ação daria a quem administra cadastros de pessoa o poder de retirar contratos de
 * circulação. Nas duas transições a consequência é ainda mais direta: `MAPA_ACAO_TELA` leva
 * `ACAO:ativar_contrato` e `ACAO:cancelar_contrato` **à própria** `TELA:contratos`, de modo que a
 * declaração só com a ação exigiria a área certa **por acidente** — e este caso, que mede existência,
 * não a distinguiria. Quem audita esse conteúdo é o `CT-355`.
 */
/**
 * O **único par** que a rota de situação de locação publica (T10 da fatia `contratos-de-locacao`).
 *
 * Ele é da fatia de contratos e vive sob `/v1/imoveis`, e as duas coisas são conteúdo: o que a rota
 * governa é o par `contrato ATIVO ⇔ imóvel LOCADO`, mas o recurso alterado é o **imóvel**, e um
 * caminho sob `/v1/contratos` diria que a situação do imóvel pertence ao contrato. Por isso ele entra
 * em {@link PARES_DA_FATIA_DE_CONTRATOS} — que é partição por **fatia**, não por prefixo de caminho —
 * e **não** em {@link paresDeImoveis}, cujo tamanho o `CT-318` afirma em `33` por escrito.
 *
 * **Ela é a única rota de sub-recurso de ato desta base que NÃO declara nada no método**, e a
 * ausência é a decisão registrada no cabeçalho de `imovel.controller.ts`: vale a exigência da classe,
 * `TELA:imoveis`, porque não há ação sensível para esta transição no catálogo fechado e alternar
 * entre disponível e indisponível é atributo operacional do cadastro, não ato sensível (leitura
 * declarada da ADR-0019). Para **este** caso, que mede existência de declaração, ela é uma rota como
 * as outras quatro que herdam a da classe; quem audita conteúdo é o `CT-355`, e o `CT-427` é quem
 * afirma que a ausência aqui é ausência **de declaração no método**, e não de exigência.
 */
function paresDeSituacaoDeLocacao(): readonly string[] {
  return [`POST /${PREFIXO_DE_VERSAO}/${CAMINHO_DOS_IMOVEIS}/:id/situacao-de-locacao`];
}

function paresDeContratos(): readonly string[] {
  const contratos = `/${PREFIXO_DE_VERSAO}/${CAMINHO_DOS_CONTRATOS}`;

  return [
    `POST ${contratos}`,
    `GET ${contratos}`,
    `GET ${contratos}/:codigo`,
    `PUT ${contratos}/:codigo`,
    `POST ${contratos}/:codigo/ativacao`,
    `POST ${contratos}/:codigo/cancelamento`,
    `POST ${contratos}/:codigo/retirada`,
    `POST ${contratos}/:codigo/recirculacao`,
  ];
}

/**
 * Os **três pares** que a superfície de cobrança publica (T5 da fatia `cobranca-e-mora`).
 *
 * Escritos à mão e compostos a partir do dono do segmento (`CAMINHO_DAS_COBRANCAS`), pela mesma razão
 * dos inventários acima. O `HEAD` derivado do `GET` da coleção **não** entra: ele não é entrada
 * própria, e o módulo verificado já o descarta.
 *
 * **A chave da rota é o `:codigo`, e não um `:id`** — a cobrança tem série declarada, e a ADR-0017 lhe
 * dá o código legível como chave exposta. O nome do parâmetro entra literalmente no par, porque é ele
 * que o roteador publica.
 *
 * **Nenhuma das três declara nada no MÉTODO**, e a ausência é decisão registrada (§11.2 do tech
 * spec): as três valem pela exigência da classe, `TELA:financeiro`, porque o catálogo fechado da
 * ADR-0011 enumera duas ações sensíveis dentro daquela área — `ACAO:emitir_boleto` e
 * `ACAO:solicitar_baixa_de_boleto` — e **nenhuma** para lançar ou ler cobrança. Para **este** caso,
 * que mede existência de declaração, elas são rotas como as que herdam a da classe; quem audita
 * conteúdo é o `CT-355`, e a auditoria final das sete declarações é o `CT-533`, em T11.
 *
 * **Não há par de exclusão nem de circulação**, e a ausência é contrato: a cobrança não tem ato de
 * exclusão a traduzir (ADR-0014, §21 do tech spec). O `CT-521`, em T10, afirma que os métodos sob
 * `/v1/cobrancas` são exatamente `['GET','POST']`.
 */
function paresDeCobrancas(): readonly string[] {
  const cobrancas = `/${PREFIXO_DE_VERSAO}/${CAMINHO_DAS_COBRANCAS}`;

  return [`POST ${cobrancas}`, `GET ${cobrancas}`, `GET ${cobrancas}/:codigo`];
}

/**
 * Os **dois pares** que a superfície da política de mora publica (T6 da fatia `cobranca-e-mora`).
 *
 * Escritos à mão e compostos a partir do dono do segmento (`CAMINHO_DE_MULTA_E_JUROS`), pela mesma
 * razão dos inventários acima. O `HEAD` derivado do `GET` **não** entra: ele não é entrada própria, e
 * o módulo verificado já o descarta.
 *
 * **O recurso é singular, e por isso não há `:id` nem `:codigo` em par algum**: a política é uma por
 * empresa (`configuracao_de_mora_empresa_key`), e a chave é a própria sessão. É o que faz os dois
 * pares compartilharem o mesmo caminho e diferirem só pelo verbo — a classificação por par
 * método+caminho, que é a deste arquivo, os conta separadamente, enquanto a por caminho de
 * `contexto.e2e.spec.ts` os funde em uma entrada só.
 *
 * **Nenhuma das duas declara nada no MÉTODO**, e a ausência é decisão registrada (§11.2 do tech
 * spec): as duas valem pela exigência da classe, `TELA:multa_e_juros`, porque o catálogo fechado da
 * ADR-0011 **não enumera ação sensível alguma** dentro daquela área, e
 * `packages/auth/src/catalogo-de-permissoes.ts` **não foi tocado**. Para **este** caso, que mede
 * existência de declaração, elas são rotas como as três de cobrança; quem audita conteúdo é o
 * `CT-355`, e a auditoria final das sete declarações da fatia é o `CT-533`, em T11.
 */
function paresDeMultaEJuros(): readonly string[] {
  const multaEJuros = `/${PREFIXO_DE_VERSAO}/${CAMINHO_DE_MULTA_E_JUROS}`;

  return [`GET ${multaEJuros}`, `PUT ${multaEJuros}`];
}

/** Os **dezoito pares** dos três papéis — seis por papel, na ordem em que os controladores nascem. */
function paresDeCadastrosDePessoa(): readonly string[] {
  return [
    ...paresDeUmPapelDeCadastro(CAMINHO_DOS_LOCADORES),
    ...paresDeUmPapelDeCadastro(CAMINHO_DOS_LOCATARIOS),
    ...paresDeUmPapelDeCadastro(CAMINHO_DOS_FIADORES),
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
 *
 * ---------------------------------------------------------------------------
 * A gêmea, e por que a fusão foi ANALISADA E RECUSADA (débito D22 · F1/T5)
 * ---------------------------------------------------------------------------
 *
 * Existe um inventário irmão em `apps/api/test/contexto.e2e.spec.ts`, `CAMINHOS_PUBLICOS_ACEITOS`.
 * **Os dois não são cópias** — provam coisas diferentes: **este** classifica por **DECLARAÇÃO**,
 * recorte por **par método+caminho** (o que o catálogo diz); o gêmeo classifica por
 * **COMPORTAMENTO**, recorte por **caminho** (quem a guarda de fato recusa sem cookie).
 *
 * Até 2026-08-08 os dois se chamavam `ROTAS_PUBLICAS_ACEITAS` — nome idêntico para recortes
 * divergentes, que é o que fazia alguém atualizar o inventário errado. O rename fechou essa
 * armadilha; a **manutenção dupla ao acrescentar rota permanece**, e é deliberada.
 *
 * O D22 prescrevia fundi-los num ponto único. Fundir no recorte **por caminho** contrariaria o
 * marcador `DECISÃO FECHADA — T5 / Gate 2 · 2026-08-04` de
 * `apps/api/src/autenticacao/cobertura-de-autorizacao.ts`, que fixa o par método+caminho como
 * unidade de classificação **desta** verificação — o que a §3 do Protocolo Antirregressão manda
 * escalar, não decidir numa limpeza. Fundir **por par** mudaria o que o `CT-020 (d)` do gêmeo prova.
 * **Não tente a fusão sem escalar.**
 */
const PARES_PUBLICOS_ACEITOS: readonly string[] = [
  ...ROTAS_FORA_DO_ARCABOUCO,
  'GET /saude',
  'GET /saude/pronto',
  ...paresDoEncaminhador(),
].sort();

/**
 * As **quinze** rotas que já declaravam exigência **antes** da fatia `cadastro-de-imoveis-e-pessoas`.
 *
 * A metade nomeada existe para o `CT-318`: o total sozinho (`66`) é âncora de tamanho, e uma
 * atualização apressada que tirasse um par desta metade e acrescentasse um da outra manteria o total
 * e passaria despercebida. Com as duas metades separadas, o `CT-318` afirma que **esta** ficou
 * intacta e que a outra tem exatamente 33 pares.
 *
 * Ela reúne, sem tirar nem acrescentar nada, o que {@link ROTAS_COM_EXIGENCIA} já listava: a sessão
 * corrente, a troca de senha do produto, as seis do operador do SaaS e as sete da administração de
 * pessoas.
 */
const EXIGENCIA_ANTERIOR_A_FATIA: readonly string[] = [
  `GET ${CAMINHO_DA_SESSAO_CORRENTE}`,
  `POST ${CAMINHO_DA_TROCA_CORRENTE}`,
  ...paresDoMaster(),
  ...paresDeUsuarios(),
].sort();

/**
 * Os **trinta e três** pares que a fatia `cadastro-de-imoveis-e-pessoas` acrescenta.
 *
 * Seis de conjunto (T5), seis de imóvel (T6), três de cômodo (T7) e dezoito dos três papéis de
 * cadastro de pessoa (T9) — `6 + 6 + 3 + 18 = 33`. É a outra metade de {@link ROTAS_COM_EXIGENCIA},
 * e é o inventário que o `CT-318` afirma **por igualdade** contra o que a superfície publica.
 */
const PARES_NOVOS_DA_FATIA: readonly string[] = [
  ...paresDeConjuntos(),
  ...paresDeImoveis(),
  ...paresDeComodos(),
  ...paresDeCadastrosDePessoa(),
].sort();

/**
 * Quantos pares a superfície publicava **antes** da fatia `cadastro-de-imoveis-e-pessoas` — o outro
 * lado do delta do `CT-318`.
 *
 * É o valor que {@link ROTAS_PUBLICADAS_EM_PRODUCAO} carregava ao fim da fatia
 * `autorizacao-e-ciclo-de-acesso`, e ele não é derivado daquele número: é a âncora contra a qual o
 * crescimento de exatamente 33 é afirmado, medido sobre a superfície observada.
 */
const ROTAS_PUBLICADAS_ANTES_DA_FATIA = 33;

/**
 * Os **nove** pares que a fatia `contratos-de-locacao` acrescenta — os seis de cadastro de contrato
 * (T6), a ativação (T7), o cancelamento (T8) e a situação de locação do imóvel (T10). Com o último, a
 * superfície da fatia está completa.
 *
 * SUT_IS_CORRECT_BECAUSE: a contagem narrativa desta linha dizia "os **seis** pares … (T6)" enquanto
 * a constante já carregava sete, depois oito, e agora nove — é o débito **D33 (F2/T7)**, fechado na
 * T7 e mantido em dia desde então. O que
 * mudou é **só a prosa**: a lista é derivada de {@link paresDeContratos}, e nenhuma asserção deriva
 * deste texto. A correção é obrigatória mesmo assim, e a razão está escrita no docblock de
 * `ROTAS_DE_ESCRITA` de `contrato-publicado.e2e.spec.ts`: número desatualizado convida a próxima task
 * a "corrigir" a âncora executável **para baixo**.
 *
 * Ele é uma **terceira metade** nomeada, e não uma extensão de {@link PARES_NOVOS_DA_FATIA}: aquele
 * inventário é a fatia anterior, o `CT-318` afirma o tamanho dele em `33` por escrito, e engordá-lo
 * com rotas de outra fatia tornaria o delta daquele caso uma soma de duas coisas diferentes. Separado,
 * cada fatia responde pelo próprio crescimento e a metade antiga continua sendo afirmada por
 * igualdade.
 *
 * As transições de estado (T7, T8) e a rota de situação de locação do imóvel (T10) entram aqui
 * conforme nascerem — a superfície cresce por decisão de quem publica rota, nunca em silêncio.
 *
 * SUT_IS_CORRECT_BECAUSE: a T10 publicou `POST /v1/imoveis/:id/situacao-de-locacao`, e ela entra
 * **nesta** metade, e não em {@link PARES_NOVOS_DA_FATIA}: a partição é por **fatia**, e o `CT-318`
 * afirma o tamanho daquela em `33` por escrito. Somá-la lá tornaria o delta daquele caso uma soma de
 * duas coisas diferentes; é a mesma razão que fez esta terceira metade nascer na T6. **Nenhuma
 * entrada anterior saiu**, e com ela a superfície da fatia está completa em **nove** rotas.
 */
const PARES_DA_FATIA_DE_CONTRATOS: readonly string[] = [
  ...paresDeContratos(),
  ...paresDeSituacaoDeLocacao(),
].sort();

/**
 * O inventário de exigência **anterior à fatia `contratos-de-locacao`** — as duas metades da fatia de
 * cadastro somadas.
 *
 * É contra ele que o `CT-318` compara o que sobra da superfície depois de tirar os pares de contrato,
 * e é ele que faz a prova "nenhuma entrada anterior saiu" continuar valendo com um inventário a mais
 * em jogo.
 */
const EXIGENCIA_ANTERIOR_AOS_CONTRATOS: readonly string[] = [
  ...EXIGENCIA_ANTERIOR_A_FATIA,
  ...PARES_NOVOS_DA_FATIA,
].sort();

/**
 * Os pares que a fatia `cobranca-e-mora` acrescenta — hoje os **três** de `/v1/cobrancas` (T5).
 *
 * Ela é uma **quarta metade** nomeada, e não uma extensão de {@link PARES_DA_FATIA_DE_CONTRATOS}:
 * aquele inventário é da fatia anterior, e engordá-lo com rotas desta tornaria o delta do `CT-318`
 * uma soma de coisas diferentes. É a mesma razão que fez a terceira metade nascer na T6 da fatia de
 * contratos — cada fatia responde pelo próprio crescimento, e as metades antigas continuam sendo
 * afirmadas por igualdade de array.
 *
 * As rotas de mora (T6) e as duas transições de cobrança (T7) entram aqui conforme nascerem — a
 * superfície cresce por decisão de quem publica rota, nunca em silêncio.
 *
 * SUT_IS_CORRECT_BECAUSE: a T6 publicou os **dois pares de `/v1/multa-e-juros`**, e eles entram
 * **nesta** metade, e não numa quinta: a partição é por **fatia**, e as rotas de mora são desta
 * mesma. Uma metade nova por task tornaria o delta do `CT-318` uma soma de partes arbitrárias, em
 * vez do crescimento de uma fatia. **Nenhuma entrada anterior saiu**, e a igualdade segue exata.
 */
const PARES_DA_FATIA_DE_COBRANCA: readonly string[] = [
  ...paresDeCobrancas(),
  ...paresDeMultaEJuros(),
].sort();

/**
 * O inventário de exigência **anterior à fatia `cobranca-e-mora`** — as três metades somadas.
 *
 * É contra ele que o `CT-318` compara o que sobra da superfície depois de tirar os pares desta fatia,
 * e é ele que faz a prova "nenhuma entrada anterior saiu" continuar valendo com um inventário a mais
 * em jogo.
 */
const EXIGENCIA_ANTERIOR_AS_COBRANCAS: readonly string[] = [
  ...EXIGENCIA_ANTERIOR_AOS_CONTRATOS,
  ...PARES_DA_FATIA_DE_CONTRATOS,
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
 *
 * SUT_IS_CORRECT_BECAUSE: a T5 da fatia `cadastro-de-imoveis-e-pessoas` publicou as **seis rotas de
 * conjunto**, e as seis declaram exigência — quatro pela classe (`@ExigeChave('TELA:imoveis')`) e as
 * duas de circulação pelo método (`@ExigeChave('ACAO:excluir_cadastro')`, que a ADR-0011 exige que
 * seja a chave nomeada na recusa). Vale aqui, palavra por palavra, o parágrafo da T8: **nenhuma
 * entrada anterior saiu**, a igualdade segue exata, e as seis entram no conjunto POSITIVO — o que
 * prova que elas declaram exigência em vez de dispensá-la. É a revisão que a ADR-0011 exige de quem
 * publica rota, e ela é o motivo de esta lista ser escrita à mão.
 *
 * SUT_IS_CORRECT_BECAUSE: a T6 da mesma fatia publicou as **seis rotas de imóvel**, e as seis
 * declaram exigência — quatro pela classe (`@ExigeChave('TELA:imoveis')`) e as duas de circulação
 * pelo método, com a **conjunção inteira** (`@ExigeChaves('TELA:imoveis', 'ACAO:excluir_cadastro')`),
 * que é a forma que a ADR-0018 fixa e que o `CT-355` audita por conteúdo. Vale aqui, palavra por
 * palavra, o parágrafo da T5: **nenhuma entrada anterior saiu**, a igualdade segue exata, e as seis
 * entram no conjunto POSITIVO.
 *
 * SUT_IS_CORRECT_BECAUSE: a T7 da mesma fatia publicou as **três rotas de cômodo**, e as três
 * declaram exigência pela classe (`@ExigeChave('TELA:imoveis')`) — nenhuma declara nada no método.
 * Vale aqui, palavra por palavra, o parágrafo da T6: **nenhuma entrada anterior saiu**, a igualdade
 * segue exata, e as três entram no conjunto POSITIVO.
 *
 * SUT_IS_CORRECT_BECAUSE: a T9 da mesma fatia publicou as **dezoito rotas dos três papéis de
 * cadastro de pessoa**, e as dezoito declaram exigência — doze pela classe
 * (`@ExigeChave('TELA:cadastros')`) e as seis de circulação pelo método, com a **conjunção inteira**
 * (`@ExigeChaves('TELA:cadastros', 'ACAO:excluir_cadastro')`). Vale aqui, palavra por palavra, o
 * parágrafo da T6: **nenhuma entrada anterior saiu**, a igualdade segue exata, e as dezoito entram no
 * conjunto POSITIVO.
 *
 * Nesta superfície a conjunção é a única coisa que separa o certo do errado **sem que o
 * comportamento mude**: a área da classe coincide com `MAPA_ACAO_TELA['ACAO:excluir_cadastro']`, de
 * modo que uma declaração só com a ação exigiria, por acidente, a mesma área. É o `CT-355` que a
 * acusa, por conteúdo — este inventário afirma que as dezoito declaram algo, e não o quê.
 *
 * A ausência de `ACAO:excluir_cadastro` no `DELETE` do cômodo **é conteúdo**, e não esquecimento: a
 * ação sensível governa a saída de circulação de um CADASTRO, e a ADR-0014 exclui o cômodo
 * nominalmente daquele alcance por ele não ser referenciável — remover um cômodo é corrigir a
 * planta, exatamente como alterá-lo. A §4.1 da tech spec registra as três rotas com `TELA:imoveis` e
 * nada mais, e é essa tabela que este inventário afirma. Se a decisão mudar, muda aqui **e** no
 * controlador, e o `CT-355` acusa a metade que ficar para trás.
 *
 * SUT_IS_CORRECT_BECAUSE: a T6 da fatia `contratos-de-locacao` publicou as **seis rotas de cadastro
 * de contrato**, e as seis declaram exigência — quatro pela classe (`@ExigeChave('TELA:contratos')`)
 * e as duas de circulação pelo método, com a **conjunção inteira**
 * (`@ExigeChaves('TELA:contratos', 'ACAO:excluir_cadastro')`). Vale aqui, palavra por palavra, o
 * parágrafo da T6 da fatia anterior: **nenhuma entrada anterior saiu**, a igualdade segue exata, e as
 * seis entram no conjunto POSITIVO. A diferença material desta superfície está registrada em
 * {@link paresDeContratos}: a área da classe **não** coincide com
 * `MAPA_ACAO_TELA['ACAO:excluir_cadastro']`, de modo que uma declaração só com a ação exigiria uma
 * área **diferente** — e o `CT-355` é quem a acusa, por conteúdo.
 *
 * SUT_IS_CORRECT_BECAUSE: a T5 da fatia `cobranca-e-mora` publicou as **três rotas de cobrança**, e
 * as três declaram exigência pela classe (`@ExigeChave('TELA:financeiro')`) — nenhuma declara nada no
 * método, e a ausência é decisão registrada na §11.2 do tech spec: o catálogo fechado não tem ação
 * sensível para lançar nem para ler cobrança, e `packages/auth/src/catalogo-de-permissoes.ts` **não
 * foi tocado**. Vale aqui, palavra por palavra, o parágrafo da T7 da fatia de cadastro, que é o caso
 * análogo (as três rotas de cômodo, todas pela classe): **nenhuma entrada anterior saiu**, a
 * igualdade segue exata, e as três entram no conjunto POSITIVO — o que prova que elas declaram
 * exigência em vez de dispensá-la.
 */
const ROTAS_COM_EXIGENCIA: readonly string[] = [
  ...EXIGENCIA_ANTERIOR_AS_COBRANCAS,
  ...PARES_DA_FATIA_DE_COBRANCA,
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
 *
 * SUT_IS_CORRECT_BECAUSE: a T5 da fatia `cadastro-de-imoveis-e-pessoas` acrescentou **seis** pares à
 * superfície publicada (33 → 39), as seis rotas de `/v1/conjuntos`. A âncora de contagem existe
 * justamente para que esse acréscimo passe pela revisão de quem lê este arquivo em vez de entrar
 * sozinho — e a igualdade de conjunto logo acima nomeia quais são os seis.
 *
 * SUT_IS_CORRECT_BECAUSE: a T6 da mesma fatia acrescentou **seis** pares à superfície publicada
 * (39 → 45), as seis rotas de `/v1/imoveis`, pela mesma razão do parágrafo acima. Nenhum par anterior
 * saiu.
 *
 * SUT_IS_CORRECT_BECAUSE: a T7 da mesma fatia acrescentou **três** pares (45 → 48), as três rotas de
 * `/v1/imoveis/:id/comodos`, pela mesma razão do parágrafo acima. Nenhum par anterior saiu. São três
 * e não quatro porque **não há rota de leitura de cômodo**: ele volta dentro do imóvel (§4.1), e o
 * `POST` da coleção, o `PUT` e o `DELETE` de `:comodoId` são a superfície inteira.
 *
 * SUT_IS_CORRECT_BECAUSE: a T9 da mesma fatia acrescentou **dezoito** pares (48 → 66), as seis rotas
 * de cada um dos três papéis de cadastro de pessoa, pela mesma razão do parágrafo acima. Nenhum par
 * anterior saiu. A contagem foi **refeita do zero**, por varredura dos decoradores de rota em
 * `apps/api/src`, e não derivada das outras âncoras deste arquivo.
 *
 * SUT_IS_CORRECT_BECAUSE: a T6 da fatia `contratos-de-locacao` acrescentou **seis** pares (66 → 72),
 * as seis rotas de cadastro de `/v1/contratos`, pela mesma razão dos parágrafos acima. Nenhum par
 * anterior saiu. A contagem foi **refeita do zero**, por varredura dos decoradores de rota em
 * `apps/api/src`, e não derivada das outras âncoras deste arquivo — o controlador novo tem seis
 * decoradores de rota, cada um reivindicando um par. São **seis** e não oito: as duas transições de
 * estado (`/ativacao` e `/cancelamento`) só nascem em T7 e T8, e a rota de situação de locação do
 * imóvel, em T10.
 *
 * SUT_IS_CORRECT_BECAUSE: a T7 da mesma fatia acrescentou **um** par (72 → 73),
 * `POST /v1/contratos/:codigo/ativacao`, pela mesma razão dos parágrafos acima. Nenhum par anterior
 * saiu, e a igualdade de conjunto logo acima nomeia qual é o novo. A contagem foi **refeita do
 * zero**, por varredura dos decoradores de rota em `apps/api/src`. É **um** e não dois porque a rota
 * é `POST`: só um `GET` acrescenta um segundo par ao roteador, pelo `HEAD` derivado.
 *
 * SUT_IS_CORRECT_BECAUSE: a T8 da mesma fatia acrescentou **um** par (73 → 74),
 * `POST /v1/contratos/:codigo/cancelamento`, pela mesma razão dos parágrafos acima. Nenhum par
 * anterior saiu, e a igualdade de conjunto logo acima nomeia qual é o novo. A contagem foi **refeita
 * do zero**, por varredura dos decoradores de rota em `apps/api/src`. É **um** e não dois pela mesma
 * razão do parágrafo anterior — a rota é `POST`, e só um `GET` traz o `HEAD` derivado junto.
 *
 * SUT_IS_CORRECT_BECAUSE: a T10 da mesma fatia acrescentou **um** par (74 → 75),
 * `POST /v1/imoveis/:id/situacao-de-locacao`, pela mesma razão dos parágrafos acima. Nenhum par
 * anterior saiu, e a igualdade de conjunto logo acima nomeia qual é o novo.
 *
 * ---------------------------------------------------------------------------
 * A âncora é 75, e a §11.2 do tech spec ESPERAVA 77 — a diferença foi MEDIDA
 * ---------------------------------------------------------------------------
 *
 * A §3.6 da T10 manda refazer as duas âncoras **do zero, por varredura, sem derivar uma da outra**,
 * e é isso que este número é. As duas medições independentes, feitas nesta task, concordam em **75**:
 *
 *   * **pela enumeração do próprio módulo de cobertura** — `cobertura.rotasEnumeradas` sobre a
 *     aplicação de produção montada: `75`;
 *   * **pela composição da superfície**, contada à parte — `60` manipuladores com decorador de rota
 *     nos arquivos `.controller.ts` de `apps/api/src`, dos quais **um** é o encaminhador de
 *     identidade (`@All`), que sozinho reivindica os {@link METODOS_DO_ENCAMINHADOR} sete pares:
 *     `(60 - 1) + 7 + 9 = 75`, com os nove de {@link ROTAS_FORA_DO_ARCABOUCO}, que são registrados
 *     direto no adaptador e não têm manipulador.
 *
 * O `77` da §11.2 é **aritmética da estimativa**, e não uma superfície observada: a fatia publica
 * **nove** rotas (seis de cadastro de contrato, ativação, cancelamento e a situação de locação), a
 * superfície anterior a ela tinha `66`, e `66 + 9 = 75`. A mesma §11.2 esperava `51 → 60`
 * manipuladores, e essa metade **bate exatamente** — o que confirma as nove rotas e localiza o erro
 * na soma do total, não no escopo entregue. Escrever `77` aqui exigiria publicar duas rotas que
 * ninguém especificou, ou afrouxar a âncora para uma desigualdade — as duas piores que corrigir o
 * número. É precisamente o caso que o *"não derive uma âncora da outra"* existe para pegar.
 *
 * SUT_IS_CORRECT_BECAUSE: a T5 da fatia `cobranca-e-mora` acrescentou **três** pares (75 → 78), as
 * três rotas de `/v1/cobrancas`, e a âncora de contagem existe justamente para que esse acréscimo
 * passe pela revisão de quem lê este arquivo em vez de entrar sozinho — a igualdade de conjunto acima
 * nomeia quais são os três. Nenhum par anterior saiu. A contagem foi **refeita do zero**, e por
 * **duas** medições independentes que concordam:
 *
 *   * **pela enumeração do próprio módulo de cobertura** — `cobertura.rotasEnumeradas` sobre a
 *     aplicação de produção montada: `78`;
 *   * **pela composição da superfície**, contada à parte — `63` manipuladores com decorador de rota
 *     nos arquivos `.controller.ts` de `apps/api/src`, dos quais **um** é o encaminhador de
 *     identidade (`@All`), que sozinho reivindica os {@link METODOS_DO_ENCAMINHADOR} sete pares:
 *     `(63 - 1) + 7 + 9 = 78`, com os nove de {@link ROTAS_FORA_DO_ARCABOUCO}.
 *
 * São **três** e não cinco: duas das rotas novas são `GET`, e o `HEAD` que o adaptador deriva de cada
 * uma **não** é entrada própria — o módulo verificado o suprime, e é a mesma supressão que já governa
 * todo `GET` de coleção desta base. Não "corrija" para 80 **por causa dos `HEAD`** — a subida para 80
 * que veio depois tem outra origem, e está no parágrafo seguinte.
 *
 * SUT_IS_CORRECT_BECAUSE: a T6 da mesma fatia acrescentou **dois** pares (78 → 80), o `GET` e o `PUT`
 * de `/v1/multa-e-juros`, e a âncora de contagem existe justamente para que esse acréscimo passe pela
 * revisão de quem lê este arquivo em vez de entrar sozinho — a igualdade de conjunto acima nomeia
 * quais são os dois. Nenhum par anterior saiu. A contagem foi **refeita do zero**, e por **duas**
 * medições independentes que concordam:
 *
 *   * **pela enumeração do próprio módulo de cobertura** — `cobertura.rotasEnumeradas` sobre a
 *     aplicação de produção montada: `80`;
 *   * **pela composição da superfície**, contada à parte — `65` manipuladores com decorador de rota
 *     nos arquivos `.controller.ts` de `apps/api/src`, dos quais **um** é o encaminhador de
 *     identidade (`@All`), que sozinho reivindica os {@link METODOS_DO_ENCAMINHADOR} sete pares:
 *     `(65 - 1) + 7 + 9 = 80`, com os nove de {@link ROTAS_FORA_DO_ARCABOUCO}.
 *
 * São **dois** e não três: os dois manipuladores compartilham o **mesmo caminho** — o recurso é
 * singular por empresa e não tem `:id` —, de modo que o par é `GET`/`PUT` sobre a coleção, e só o
 * `GET` traria `HEAD` derivado, que o módulo verificado suprime.
 */
const ROTAS_PUBLICADAS_EM_PRODUCAO = 80;

/**
 * Quantos **manipuladores** de controlador a aplicação de produção monta — a âncora do `CT-355`.
 *
 * Ela conta manipuladores, e não pares método+caminho: um `@All('*')` é UM manipulador que
 * reivindica sete pares, e as rotas registradas direto no adaptador (o contrato publicado) não têm
 * manipulador algum. Por isso este número **não** é `ROTAS_PUBLICADAS_EM_PRODUCAO`, e não deve ser
 * derivado dele.
 *
 * SUT_IS_CORRECT_BECAUSE: o valor é a **expectativa revisada** da superfície que hoje existe, e a
 * soma é `2 + 1 + 1 + 1 + 6 + 7 + 6 = 24`: as **duas** de saúde, o **um** encaminhador de identidade
 * (`@All('*')`, que sozinho reivindica sete pares), a sessão corrente, a troca de senha do produto,
 * as **seis** do operador do SaaS, as **sete** da administração de pessoas e as **seis** de
 * conjunto. As nove do contrato publicado não entram: elas são registradas direto no adaptador e não
 * têm manipulador do arcabouço. Ele é exato
 * pela mesma razão das outras três âncoras deste arquivo: `> 0` fecha o caso degenerado e deixa
 * aberto o intermediário. As tasks seguintes desta fatia já tocam este arquivo para subir
 * `ROTAS_PUBLICADAS_EM_PRODUCAO`, então mantê-lo exato custa zero incremental e compra a mesma
 * revisão forçada.
 *
 * SUT_IS_CORRECT_BECAUSE: a T6 acrescentou **seis manipuladores** (24 → 30), um por rota de
 * `/v1/imoveis`, e a soma passa a ser `2 + 1 + 1 + 1 + 6 + 7 + 6 + 6 = 30`. O número **não** é
 * derivável de `ROTAS_PUBLICADAS_EM_PRODUCAO`, e a coincidência de as duas terem crescido seis aqui é
 * acidente da forma destas rotas: cada uma tem manipulador próprio e reivindica um par só. Um
 * `@All('*')` acrescentaria um manipulador e sete pares, e derivar um número do outro erraria.
 *
 * SUT_IS_CORRECT_BECAUSE: a T7 acrescentou **três manipuladores** (30 → 33) — o `@Post()`, o
 * `@Put(':comodoId')` e o `@Delete(':comodoId')` de `comodo.controller.ts` —, e a soma passa a ser
 * `2 + 1 + 1 + 1 + 6 + 7 + 6 + 6 + 3 = 33`. A contagem foi **refeita do zero**, por varredura dos
 * decoradores de rota em `apps/api/src`, e não derivada de `ROTAS_PUBLICADAS_EM_PRODUCAO`: as duas
 * crescerem três aqui é, de novo, acidente da forma destas rotas — cada manipulador reivindica um
 * par só. `cobertura-de-autorizacao.ts` tem dez decoradores e **não entra**, porque é o módulo de
 * verificação e não a aplicação de produção.
 *
 * SUT_IS_CORRECT_BECAUSE: a T9 acrescentou **dezoito manipuladores** (33 → 51) — seis em cada um de
 * `cadastros/locador.controller.ts`, `cadastros/locatario.controller.ts` e
 * `cadastros/fiador.controller.ts` —, e a soma passa a ser
 * `2 + 1 + 1 + 1 + 6 + 7 + 6 + 6 + 3 + 18 = 51`. A contagem foi **refeita do zero**, por varredura
 * dos decoradores de rota em `apps/api/src`, e não derivada de `ROTAS_PUBLICADAS_EM_PRODUCAO`: as
 * duas crescerem dezoito aqui é, de novo, acidente da forma destas rotas — cada manipulador
 * reivindica um par só. `cadastros/superficie-de-cadastro.ts` **não entra**: ele carrega o
 * comportamento das seis operações e não tem decorador de rota algum, que é precisamente o que faz a
 * contagem por manipulador continuar sendo dezoito e não seis.
 *
 * SUT_IS_CORRECT_BECAUSE: a T6 da fatia `contratos-de-locacao` acrescentou **seis manipuladores**
 * (51 → 57) — o `@Post()`, o `@Get()`, o `@Get(':codigo')`, o `@Put(':codigo')`, o
 * `@Post(':codigo/retirada')` e o `@Post(':codigo/recirculacao')` de `contratos/contrato.controller.ts`
 * —, e a soma passa a ser `2 + 1 + 1 + 1 + 6 + 7 + 6 + 6 + 3 + 18 + 6 = 57`. A contagem foi **refeita
 * do zero**, por varredura dos decoradores de rota em `apps/api/src`, e não derivada de
 * `ROTAS_PUBLICADAS_EM_PRODUCAO`: as duas crescerem seis aqui é, de novo, acidente da forma destas
 * rotas — cada manipulador reivindica um par só. O método privado `definirCirculacao` do controlador
 * **não entra**: ele carrega o comportamento comum das duas rotas de circulação e não tem decorador de
 * rota algum.
 *
 * SUT_IS_CORRECT_BECAUSE: a T7 da mesma fatia acrescentou **um manipulador** (57 → 58) — o
 * `@Post(':codigo/ativacao')` de `contratos/contrato.controller.ts` —, e a soma passa a ser
 * `2 + 1 + 1 + 1 + 6 + 7 + 6 + 6 + 3 + 18 + 7 = 58`. A contagem foi **refeita do zero**, por varredura
 * dos decoradores de rota em `apps/api/src`, e não derivada de `ROTAS_PUBLICADAS_EM_PRODUCAO`: as
 * duas crescerem um aqui é acidente da forma desta rota — ela é `POST`, e por isso reivindica um par
 * só, sem o `HEAD` que todo `GET` acrescenta ao roteador.
 *
 * SUT_IS_CORRECT_BECAUSE: a T8 da mesma fatia acrescentou **um manipulador** (58 → 59) — o
 * `@Post(':codigo/cancelamento')` de `contratos/contrato.controller.ts` —, e a soma passa a ser
 * `2 + 1 + 1 + 1 + 6 + 7 + 6 + 6 + 3 + 18 + 8 = 59`. A contagem foi **refeita do zero**, por
 * varredura dos decoradores de rota em `apps/api/src`, e não derivada de
 * `ROTAS_PUBLICADAS_EM_PRODUCAO`. O manipulador novo importa duplamente para o `CT-355`: ele declara
 * no MÉTODO, e é justamente essa forma que a auditoria de conteúdo examina.
 *
 * ---------------------------------------------------------------------------
 * MUTANTE DA T8 — MT8-5 (2026-08-09), a ADR-0018 sobre a rota nova
 * ---------------------------------------------------------------------------
 *
 * Aplicado ao `@ExigeChaves(AREA_DOS_CONTRATOS, ACAO_DE_CANCELAMENTO)` do manipulador de
 * cancelamento, trocado por `@ExigeChave(ACAO_DE_CANCELAMENTO)` — a forma intuitiva e **errada**, em
 * que a declaração do método **substitui** a da classe. Invocado pelo script do pacote
 * (`pnpm --filter @sysloc/api test`); controle: `151 passed`.
 *
 *   * **MT8-5**: `1 failed | 150 passed`, no **`CT-355`**, nomeando o manipulador — *"declaração de
 *     método que SUBSTITUI a da classe: ContratoController.cancelar"*. Os casos **comportamentais**
 *     desta suíte sobreviveriam a ele: `MAPA_ACAO_TELA['ACAO:cancelar_contrato']` **é**
 *     `TELA:contratos`, de modo que a área seria exigida por acidente e nenhum `403` mudaria de
 *     forma. É a prova por **estrutura** que fecha essa direção — e é a razão de este caso existir
 *     ao lado dos que sondam comportamento;
 *   * **reversão** — o fonte foi restaurado do backup e conferido idêntico ao original por `diff -q`,
 *     `pnpm build` refeito, e o controle voltou a `151 passed`.
 *
 * SUT_IS_CORRECT_BECAUSE: a T10 da mesma fatia acrescentou **um manipulador** (59 → 60) — o
 * `@Post(':id/situacao-de-locacao')` de `imoveis/imovel.controller.ts` —, e a soma passa a ser
 * `2 + 1 + 1 + 1 + 6 + 7 + 6 + 7 + 3 + 18 + 8 = 60`, com os **sete** de imóvel no lugar dos seis. A
 * contagem foi **refeita do zero**, por varredura dos decoradores de rota em `apps/api/src`, e não
 * derivada de {@link ROTAS_PUBLICADAS_EM_PRODUCAO}: a varredura devolve, por arquivo,
 * `1 + 1 + 1 + 6 + 6 + 6 + 8 + 3 + 6 + 7 + 6 + 2 + 7 = 60`. O manipulador novo importa duplamente
 * para o `CT-355` e para o `CT-427`: ele é o único sub-recurso de ato desta base que **não** declara
 * nada no método, e a auditoria de conteúdo tem de continuar verde sobre ele — porque não declarar
 * nada no método é o oposto de declarar **menos** do que a classe.
 *
 * **Este número é o único das duas âncoras que bate com a §11.2 do tech spec** (`51 → 60`), e é ele
 * que localiza o erro do `77` esperado lá na soma do total, e não no escopo entregue — ver a seção
 * correspondente no docblock de {@link ROTAS_PUBLICADAS_EM_PRODUCAO}.
 *
 * ---------------------------------------------------------------------------
 * MUTANTE DA T10 — MT10-3 (2026-08-09), a falsificação do `CT-427`
 * ---------------------------------------------------------------------------
 *
 * Aplicado ao `@ExigeChaves(AREA_DOS_CONTRATOS, ACAO_DE_CANCELAMENTO)` do manipulador de
 * cancelamento — uma das **quatro** rotas governadas que o `CT-427` audita —, trocado por
 * `@ExigeChave(ACAO_DE_CANCELAMENTO)`: a forma intuitiva e **errada**, em que a declaração do método
 * **substitui** a da classe. Invocado pelo script do pacote (`pnpm --filter @sysloc/api test`);
 * controle: `155 passed`.
 *
 *   * **MT10-3**: `2 failed | 153 passed`, e os dois casos falham por **eixos diferentes** — o
 *     `CT-355` acusa o manipulador **pelo nome** (*"declaração de método que SUBSTITUI a da classe:
 *     ContratoController.cancelar"*, com `daClasse: ['TELA:contratos']` e
 *     `doMetodo: ['ACAO:cancelar_contrato']` no diff), e o `CT-427` reprova na igualdade de **array**
 *     da conjunção: `expected [ 'ACAO:cancelar_contrato' ] to deeply equal [ 'TELA:contratos', …(1) ]`.
 *     A divisão de trabalho entre os dois é a razão de o `CT-427` existir ao lado do `CT-355`: aquele
 *     responde *"o método declara MENOS do que a classe?"* e este responde *"o que exatamente cada uma
 *     das quatro declara, e em que ordem?"* — e a ordem, que decide qual chave a recusa nomeia, é
 *     invisível para o primeiro. Os casos **comportamentais** sobreviveriam ao mutante:
 *     `MAPA_ACAO_TELA['ACAO:cancelar_contrato']` **é** `TELA:contratos`, de modo que a área seria
 *     exigida por acidente e nenhum `403` mudaria de forma;
 *   * **reversão** — o fonte foi restaurado do backup e conferido idêntico ao original por `diff -q`,
 *     `pnpm build` refeito, e o controle voltou a `155 passed`.
 *
 * SUT_IS_CORRECT_BECAUSE: a T5 da fatia `cobranca-e-mora` acrescentou **três manipuladores**
 * (60 → 63) — o `@Post()`, o `@Get()` e o `@Get(':codigo')` de `cobrancas/cobranca.controller.ts` —,
 * e a soma passa a ser `2 + 1 + 1 + 1 + 6 + 7 + 6 + 7 + 3 + 18 + 8 + 3 = 63`. A contagem foi
 * **refeita do zero**, por varredura dos decoradores de rota em `apps/api/src`, e **não** derivada de
 * {@link ROTAS_PUBLICADAS_EM_PRODUCAO}: a varredura devolve, por arquivo,
 * `1 + 1 + 1 + 6 + 6 + 6 + 3 + 8 + 3 + 6 + 7 + 6 + 2 + 7 = 63`. As duas terem crescido três aqui é,
 * de novo, acidente da forma destas rotas — cada manipulador reivindica um par só, e o `HEAD` que o
 * adaptador deriva dos dois `GET` não é entrada própria nem manipulador. `cobrancas/cobranca.service.ts`
 * **não entra**: ele carrega a regra de aplicação das três rotas e não tem decorador de rota algum.
 *
 * Os três importam para o `CT-355` pelo lado oposto ao dos manipuladores de contrato: eles **não**
 * declaram nada no método, e a auditoria de conteúdo tem de continuar verde sobre eles — porque não
 * declarar nada no método é o oposto de declarar **menos** do que a classe.
 *
 * SUT_IS_CORRECT_BECAUSE: a T6 da mesma fatia acrescentou **dois manipuladores** (63 → 65) — o
 * `@Get()` e o `@Put()` de `mora/mora.controller.ts` —, e a soma passa a ser
 * `2 + 1 + 1 + 1 + 6 + 7 + 6 + 7 + 3 + 18 + 8 + 3 + 2 = 65`. A contagem foi **refeita do zero**, por
 * varredura dos decoradores de rota em `apps/api/src`, e **não** derivada de
 * {@link ROTAS_PUBLICADAS_EM_PRODUCAO}: a varredura devolve, por arquivo,
 * `1 + 1 + 1 + 6 + 6 + 6 + 3 + 8 + 3 + 6 + 7 + 6 + 2 + 2 + 7 = 65`. As duas terem crescido dois aqui
 * é, de novo, acidente da forma destas rotas — cada manipulador reivindica um par só, e o `HEAD` que
 * o adaptador deriva do `GET` não é entrada própria nem manipulador. `mora/mora.service.ts` **não
 * entra**: ele carrega a regra de aplicação das duas rotas e não tem decorador de rota algum.
 *
 * Os dois importam para o `CT-355` pelo mesmo lado dos três de cobrança: eles **não** declaram nada
 * no método, e a auditoria de conteúdo tem de continuar verde sobre eles.
 */
const MANIPULADORES_EXAMINADOS_EM_PRODUCAO = 65;

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
 *
 * SUT_IS_CORRECT_BECAUSE: a T5 da fatia `cadastro-de-imoveis-e-pessoas` registrou o módulo de
 * imóveis na MESMA composição raiz, e os seis pares de conjunto aparecem aqui pela mesma razão que
 * aparecem no controle (27 → 33). A âncora continua sendo de contagem EXATA.
 *
 * SUT_IS_CORRECT_BECAUSE: a T6 registrou o controlador de imóveis no MESMO módulo, e os seis pares
 * de `/v1/imoveis` aparecem aqui pela mesma razão que aparecem no controle (33 → 39).
 *
 * SUT_IS_CORRECT_BECAUSE: a T7 registrou o controlador de cômodos no MESMO módulo, e os três pares
 * de `/v1/imoveis/:id/comodos` aparecem aqui pela mesma razão que aparecem no controle (39 → 42).
 *
 * SUT_IS_CORRECT_BECAUSE: a T9 registrou os três controladores de papel em `CadastrosModule`, que a
 * T8 já havia registrado na MESMA composição raiz — o módulo existia sem publicar rota alguma, e é
 * por isso que ele não aparecia aqui até agora. Os dezoito pares aparecem pela mesma razão que
 * aparecem no controle (42 → 60).
 *
 * SUT_IS_CORRECT_BECAUSE: a T6 da fatia `contratos-de-locacao` registrou `ContratosModule` na MESMA
 * composição raiz, e os seis pares de cadastro de contrato aparecem aqui pela mesma razão que
 * aparecem no controle (60 → 66).
 *
 * SUT_IS_CORRECT_BECAUSE: a T7 acrescentou o par da ativação ao MESMO controlador, já registrado
 * naquela composição raiz, e ele aparece aqui pela mesma razão que aparece no controle (66 → 67). A
 * âncora continua sendo de contagem EXATA.
 *
 * SUT_IS_CORRECT_BECAUSE: a T8 acrescentou o par do cancelamento ao MESMO controlador, pela mesma
 * razão do parágrafo acima (67 → 68).
 *
 * SUT_IS_CORRECT_BECAUSE: a T10 acrescentou o par da situação de locação ao controlador de imóveis,
 * já registrado naquela composição raiz, e ele aparece aqui pela mesma razão que aparece no controle
 * (68 → 69). A âncora continua sendo de contagem EXATA.
 *
 * SUT_IS_CORRECT_BECAUSE: a T5 da fatia `cobranca-e-mora` registrou `CobrancasModule` na MESMA
 * composição raiz, e os três pares de `/v1/cobrancas` aparecem aqui pela mesma razão que aparecem no
 * controle (69 → 72).
 *
 * SUT_IS_CORRECT_BECAUSE: a T6 da mesma fatia registrou `MoraModule` na MESMA composição raiz, e os
 * dois pares de `/v1/multa-e-juros` aparecem aqui pela mesma razão que aparecem no controle
 * (72 → 74). A âncora continua sendo de contagem EXATA.
 */
const ROTAS_PUBLICADAS_NO_MUTANTE = 74;

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

/** As duas montagens do par de falsificação do CT-355 — o defeito literal e a gêmea que o corrige. */
let aplicacaoQueSubstitui: NestFastifyApplication;
let aplicacaoQueCompoe: NestFastifyApplication;

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

  // O par de falsificação PERMANENTE do CT-355 — o defeito literal e a gêmea que o corrige. Elas
  // vivem em montagens próprias, e nunca na composição raiz: publicar em `apps/api/src` um
  // manipulador que substitui a exigência da classe seria criar em produção exatamente a
  // vulnerabilidade que a asserção existe para impedir.
  aplicacaoQueSubstitui = await montarMinima([ControladorQueSubstitui]);
  aplicacaoQueCompoe = await montarMinima([ControladorQueCompoe]);
}, LIMITE_DE_MONTAGEM_MS);

afterAll(async () => {
  await aplicacaoQueCompoe?.close();
  await aplicacaoQueSubstitui?.close();
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
    expect(conferir(cobertura, PARES_PUBLICOS_ACEITOS)).toEqual({
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
    expect(cobertura.publicas).toEqual([...PARES_PUBLICOS_ACEITOS]);
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
    //
    // SUT_IS_CORRECT_BECAUSE: os SEIS pares de conjunto entram aqui pela mesma razão que entram no
    // controle — a aplicação mutante importa a composição raiz da produção, onde a T5 registrou o
    // módulo de imóveis. Nenhuma entrada anterior saiu, e a igualdade segue exata.
    //
    // SUT_IS_CORRECT_BECAUSE: os SEIS pares de imóvel entram pela mesma razão, agora da T6, que
    // registrou o controlador de imóveis no mesmo módulo. Nenhuma entrada anterior saiu.
    //
    // SUT_IS_CORRECT_BECAUSE: os TRÊS pares de cômodo entram pela mesma razão, agora da T7, que
    // registrou o controlador de cômodos no mesmo módulo. Nenhuma entrada anterior saiu.
    //
    // SUT_IS_CORRECT_BECAUSE: os DEZOITO pares dos três papéis de cadastro de pessoa entram pela
    // mesma razão, agora da T9, que registrou os três controladores em `CadastrosModule` — módulo
    // que a T8 já havia posto na composição raiz sem que ele publicasse rota alguma. Nenhuma entrada
    // anterior saiu, e a igualdade segue exata.
    //
    // SUT_IS_CORRECT_BECAUSE: os SEIS pares de cadastro de contrato entram pela mesma razão, agora da
    // T6 da fatia `contratos-de-locacao`, que registrou `ContratosModule` na composição raiz. Nenhuma
    // entrada anterior saiu, e a igualdade segue exata.
    //
    // SUT_IS_CORRECT_BECAUSE: o par da ATIVAÇÃO entra pela mesma razão, agora da T7 — ele nasce no
    // MESMO controlador já registrado naquela composição raiz. Nenhuma entrada anterior saiu, e a
    // igualdade segue exata; o inventário cresce por {@link paresDeContratos}, que é escrito à mão e
    // revisado, e não por derivação de outra âncora deste arquivo.
    //
    // SUT_IS_CORRECT_BECAUSE: o par do CANCELAMENTO e o da SITUAÇÃO DE LOCAÇÃO entram pela mesma
    // razão, agora da T8 e da T10 — o primeiro nasce no controlador de contrato e o segundo no de
    // imóvel, os dois já registrados naquela composição raiz. Nenhuma entrada anterior saiu, e a
    // igualdade segue exata. O par novo entra por {@link paresDeSituacaoDeLocacao}, e a rota é a única
    // desta base que não declara nada no método: ela cai no conjunto POSITIVO pela declaração da
    // CLASSE, que é exatamente o que este eixo mede — existência de declaração, não conteúdo dela.
    //
    // SUT_IS_CORRECT_BECAUSE: os TRÊS pares de cobrança entram pela mesma razão, agora da T5 da fatia
    // `cobranca-e-mora`, que registrou `CobrancasModule` na composição raiz. Nenhuma entrada anterior
    // saiu, e a igualdade segue exata. As três caem no conjunto POSITIVO pela declaração da CLASSE
    // (`TELA:financeiro`) — nenhuma declara nada no método, e é justamente isso que este eixo mede:
    // existência de declaração, não conteúdo dela.
    //
    // SUT_IS_CORRECT_BECAUSE: os DOIS pares da política de mora entram pela mesma razão, agora da T6
    // da mesma fatia, que registrou `MoraModule` na composição raiz. Nenhuma entrada anterior saiu, e
    // a igualdade segue exata. Os dois caem no conjunto POSITIVO pela declaração da CLASSE
    // (`TELA:multa_e_juros`) — nenhum declara nada no método, e é justamente isso que este eixo mede.
    expect(cobertura.comExigencia).toEqual(
      [
        `GET ${CAMINHO_DA_SESSAO_CORRENTE}`,
        `POST ${CAMINHO_DA_TROCA_CORRENTE}`,
        `GET ${caminho(CAMINHO_SEM_EXIGENCIA)}`,
        ...paresDoMaster(),
        ...paresDeUsuarios(),
        ...paresDeConjuntos(),
        ...paresDeImoveis(),
        ...paresDeComodos(),
        ...paresDeCadastrosDePessoa(),
        ...paresDeContratos(),
        ...paresDeSituacaoDeLocacao(),
        ...paresDeCobrancas(),
        ...paresDeMultaEJuros(),
      ].sort(),
    );

    // E nada aqui é registrado direto no adaptador: o conjunto "fora do arcabouço" não é um depósito
    // que absorva o que a junção não soube ligar — se a junção falhasse, a rota apareceria nele.
    expect(cobertura.foraDoArcabouco).toEqual([]);
  });

  it('CT-318 — as 33 rotas novas da fatia declaram exigência, e nenhuma escapou para o conjunto público', () => {
    const cobertura = verificarCoberturaDeAutorizacao(aplicacaoReal);

    // O inventário desta fatia tem 33 pares — afirmado sobre o próprio inventário, antes de comparar
    // com a superfície. Sem isto, uma lista truncada faria as igualdades abaixo passarem sobre menos
    // rotas do que a fatia publica, que é o modo de falha silencioso desta classe de caso.
    expect(PARES_NOVOS_DA_FATIA.length).toBe(33);

    // Nenhuma rota da superfície publicada existe sem declaração — o predicado da ADR-0011, e o que
    // torna as igualdades seguintes afirmações sobre uma superfície inteiramente governada.
    expect(cobertura.semDeclaracao).toEqual([]);

    // As 33 constam no conjunto POSITIVO, nomeadas: `filter` em vez de `every` porque a falha precisa
    // dizer QUAL rota escapou, e não apenas que alguma escapou.
    expect(PARES_NOVOS_DA_FATIA.filter((par) => !cobertura.comExigencia.includes(par))).toEqual([]);

    // E nenhuma delas escapou por `@RotaPublica()`, que é a escapatória que a existência da
    // declaração sozinha não fecha: a guarda retorna antes para rota pública, e o conjunto sem
    // declaração continuaria vazio.
    expect(PARES_NOVOS_DA_FATIA.filter((par) => cobertura.publicas.includes(par))).toEqual([]);
    expect(PARES_NOVOS_DA_FATIA.filter((par) => cobertura.foraDoArcabouco.includes(par))).toEqual(
      [],
    );

    // A metade ANTERIOR à fatia está intacta, por igualdade de array: o que o conjunto positivo
    // publica menos os 33 novos — e menos os pares que fatias POSTERIORES acrescentaram — é
    // exatamente o inventário de antes. É esta asserção que pega a troca que o total não veria — um
    // par da F1 sumindo enquanto um par novo entra no lugar dele.
    //
    // SUT_IS_CORRECT_BECAUSE: o código de produção está certo e era o filtro que descrevia uma
    // superfície de duas metades. A T6 da fatia `contratos-de-locacao` publicou seis pares que não
    // são nem da F1 nem da fatia `cadastro-de-imoveis-e-pessoas`, e o filtro anterior os empurraria
    // para dentro da metade "anterior", fazendo a igualdade reprovar sobre rotas legítimas. O que a
    // asserção mede — *"a metade anterior está intacta"* — **não foi afrouxado**: continua sendo
    // igualdade de array contra um inventário escrito à mão, agora com a terceira metade nomeada e
    // subtraída explicitamente. Nenhuma entrada saiu de {@link EXIGENCIA_ANTERIOR_A_FATIA}.
    //
    // SUT_IS_CORRECT_BECAUSE: o código de produção está certo e era o filtro que descrevia uma
    // superfície de três metades. A T5 da fatia `cobranca-e-mora` publicou três pares que não são de
    // nenhuma das anteriores, e o filtro anterior os empurraria para dentro da metade "anterior",
    // fazendo a igualdade reprovar sobre rotas legítimas. O que a asserção mede **não foi
    // afrouxado**: continua sendo igualdade de array contra um inventário escrito à mão, agora com a
    // quarta metade nomeada e subtraída explicitamente.
    expect(
      cobertura.comExigencia.filter(
        (par) =>
          !PARES_NOVOS_DA_FATIA.includes(par) &&
          !PARES_DA_FATIA_DE_CONTRATOS.includes(par) &&
          !PARES_DA_FATIA_DE_COBRANCA.includes(par),
      ),
    ).toEqual([...EXIGENCIA_ANTERIOR_A_FATIA]);

    // E os pares da fatia de contratos são exatamente os que sobram do outro lado da mesma partição:
    // sem esta linha, a subtração acima poderia estar escondendo um par de contrato que sumiu.
    expect(
      cobertura.comExigencia.filter((par) => PARES_DA_FATIA_DE_CONTRATOS.includes(par)),
    ).toEqual([...PARES_DA_FATIA_DE_CONTRATOS]);

    // O mesmo do outro lado, para a metade nova: sem esta linha, os três pares desta fatia sairiam da
    // subtração acima sem que nada afirmasse que eles de fato estão publicados e declarados.
    expect(
      cobertura.comExigencia.filter((par) => PARES_DA_FATIA_DE_COBRANCA.includes(par)),
    ).toEqual([...PARES_DA_FATIA_DE_COBRANCA]);

    // Os dois conjuntos que a fatia NÃO deve ter tocado, inalterados.
    expect(cobertura.publicas).toEqual([...PARES_PUBLICOS_ACEITOS]);
    expect(cobertura.foraDoArcabouco).toEqual([...ROTAS_FORA_DO_ARCABOUCO]);

    // O TOTAL e o DELTA, os dois. O total sozinho não distingue "33 novas entraram" de "34 entraram
    // e uma antiga saiu"; o delta é medido sobre a superfície observada — quantos pares publicados
    // NÃO são da fatia —, e por isso ele não é aritmética entre duas constantes deste arquivo.
    expect(
      cobertura.rotasEnumeradas,
      'a superfície publicada mudou de tamanho: o inventário desta prova precisa ser revisado',
    ).toBe(ROTAS_PUBLICADAS_EM_PRODUCAO);
    //
    // SUT_IS_CORRECT_BECAUSE: o código de produção está certo e era a aritmética do delta que
    // descrevia uma superfície de duas metades. Com a fatia `contratos-de-locacao` publicando seis
    // pares, o delta desta fatia passa a ser medido descontando também os dela — o valor comparado
    // (`ROTAS_PUBLICADAS_ANTES_DA_FATIA`, 33) **não muda**, e continua sendo âncora escrita à mão e
    // não derivada de `ROTAS_PUBLICADAS_EM_PRODUCAO`.
    //
    // SUT_IS_CORRECT_BECAUSE: vale de novo o parágrafo acima, agora para a fatia `cobranca-e-mora`:
    // com três pares novos, o delta desta fatia passa a ser medido descontando também os dela. O
    // valor comparado **não muda** — ele continua sendo `33`, a superfície que existia antes da fatia
    // de cadastro —, e é justamente essa imutabilidade que faz a asserção seguir pegando o par antigo
    // que sumisse enquanto um novo entrasse no lugar dele.
    expect(
      cobertura.rotasEnumeradas -
        PARES_NOVOS_DA_FATIA.length -
        PARES_DA_FATIA_DE_CONTRATOS.length -
        PARES_DA_FATIA_DE_COBRANCA.length,
    ).toBe(ROTAS_PUBLICADAS_ANTES_DA_FATIA);
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

  it('CT-355 — nenhuma declaração de MÉTODO substitui a da classe: a do método CONTÉM a da classe', () => {
    // ---------------------------------------------------------------------------------------
    // Controle: a aplicação de PRODUÇÃO inteira
    // ---------------------------------------------------------------------------------------
    const violacoes = declaracoesQueSubstituemAClasse(aplicacaoReal);

    // Âncora de não-vacuidade em valor EXATO, e ela é indispensável: "nenhuma violação" sobre zero
    // manipuladores examinados é verdade vazia, e é exatamente assim que esta asserção apodreceria
    // em silêncio. `> 0` fecharia só o caso degenerado e deixaria aberto o intermediário — uma
    // varredura que perdesse metade dos controladores continuaria passando. É o mesmo raciocínio,
    // e a mesma escolha, das outras três âncoras deste arquivo.
    expect(
      manipuladoresExaminados(aplicacaoReal),
      'o número de manipuladores da superfície publicada mudou: o inventário desta prova precisa ser revisado',
    ).toBe(MANIPULADORES_EXAMINADOS_EM_PRODUCAO);

    expect(
      violacoes,
      `declaração de método que SUBSTITUI a da classe: ${violacoes
        .map((v) => `${v.controlador}.${v.manipulador}`)
        .join(', ')}`,
    ).toEqual([]);

    // ---------------------------------------------------------------------------------------
    // FALSIFICAÇÃO PERMANENTE: a MESMA função sobre o defeito literal
    // ---------------------------------------------------------------------------------------
    //
    // O controle acima, sozinho, não prova nada — uma função que devolvesse `[]` sempre passaria.
    // O par é o que detecta, e ele vive **na suíte** em vez de numa medição narrada num comentário:
    // `ControladorQueSubstitui` é o defeito exato que rejeitou a T5 na rodada 1 (área na classe,
    // ação no método), e `ControladorQueCompoe` é a gêmea que difere **apenas** por declarar a
    // conjunção. Uma implementação que acusasse as duas, ou nenhuma, reprova aqui.
    expect(declaracoesQueSubstituemAClasse(aplicacaoQueSubstitui)).toEqual([
      {
        controlador: 'ControladorQueSubstitui',
        manipulador: 'circular',
        daClasse: ['TELA:imoveis'],
        doMetodo: ['ACAO:excluir_cadastro'],
      },
    ]);
    expect(declaracoesQueSubstituemAClasse(aplicacaoQueCompoe)).toEqual([]);
  });

  it('CT-427 — a conjunção das quatro rotas governadas de contrato é auditada por ESTRUTURA, e a superfície fecha em 80 pares / 65 manipuladores', () => {
    const cobertura = verificarCoberturaDeAutorizacao(aplicacaoReal);

    // ---------------------------------------------------------------------------------------
    // As duas âncoras FINAIS da fatia, medidas SEPARADAMENTE
    // ---------------------------------------------------------------------------------------
    //
    // Elas vêm de dois mecanismos diferentes — a enumeração da tabela do roteador e a varredura dos
    // decoradores dos controladores — e nenhuma é derivada da outra. A razão está escrita no
    // docblock de {@link ROTAS_PUBLICADAS_EM_PRODUCAO}: a coincidência aritmética entre elas não é
    // garantia, e foi justamente ela que produziu o `77` esperado pela §11.2 do tech spec.
    expect(
      cobertura.rotasEnumeradas,
      'a superfície publicada mudou de tamanho: o inventário desta prova precisa ser revisado',
    ).toBe(ROTAS_PUBLICADAS_EM_PRODUCAO);
    expect(
      manipuladoresExaminados(aplicacaoReal),
      'o número de manipuladores da superfície publicada mudou: o inventário desta prova precisa ser revisado',
    ).toBe(MANIPULADORES_EXAMINADOS_EM_PRODUCAO);

    // Nenhuma rota da superfície publicada existe sem declaração — inclusive a que nasceu nesta task.
    expect(cobertura.semDeclaracao).toEqual([]);

    // ---------------------------------------------------------------------------------------
    // A ESTRUTURA das quatro governadas: a conjunção inteira, e a ORDEM é conteúdo
    // ---------------------------------------------------------------------------------------
    //
    // Igualdade de ARRAY, e não de conjunto: a recusa nomeia a **PRIMEIRA** chave ausente (RN-14), de
    // modo que a ordem é o que decide se quem tem a área e não tem a ação recebe o nome da ação — o
    // que lhe falta — ou o da área, que ele já possui. Um `expect.arrayContaining` aceitaria a ordem
    // invertida, e um `toContain` aceitaria a declaração só com a ação, que é o defeito da ADR-0018.
    const noMetodo = exigenciasDeclaradasNoMetodo(aplicacaoReal);

    expect(noMetodo.get('ContratoController.ativar')).toEqual([
      'TELA:contratos',
      'ACAO:ativar_contrato',
    ]);
    expect(noMetodo.get('ContratoController.cancelar')).toEqual([
      'TELA:contratos',
      'ACAO:cancelar_contrato',
    ]);
    expect(noMetodo.get('ContratoController.retirar')).toEqual([
      'TELA:contratos',
      'ACAO:excluir_cadastro',
    ]);
    expect(noMetodo.get('ContratoController.recircular')).toEqual([
      'TELA:contratos',
      'ACAO:excluir_cadastro',
    ]);

    // ---------------------------------------------------------------------------------------
    // A rota NOVA: nada no método, e a exigência EFETIVA é exatamente a da classe
    // ---------------------------------------------------------------------------------------
    //
    // As duas metades são necessárias e nenhuma basta. A primeira afirma a **forma** — não há
    // declaração de método a substituir a da classe, que é a leitura declarada da ADR-0019 no
    // cabeçalho de `imovel.controller.ts`. A segunda afirma o **efeito**: a rota exige `TELA:imoveis`
    // e nada além, lido pelo MESMO `getAllAndOverride` da guarda. Sem a segunda, um manipulador que
    // perdesse a classe inteira (um `@Controller` sem `@ExigeChave`) passaria pela primeira; sem a
    // primeira, uma conjunção declarada no método com a mesma área passaria pela segunda.
    expect(noMetodo.has('ImovelController.definirSituacaoDeLocacao')).toBe(false);
    expect(
      exigenciaEfetivaDoManipulador(aplicacaoReal, 'ImovelController.definirSituacaoDeLocacao'),
    ).toEqual(['TELA:imoveis']);

    // E o par que discrimina: as duas rotas de circulação de imóvel, da MESMA classe, declaram sim no
    // método. Sem esta linha, "não declara nada no método" seria satisfeito por uma varredura que não
    // enxergasse declaração de método alguma.
    expect(noMetodo.get('ImovelController.retirar')).toEqual([
      'TELA:imoveis',
      'ACAO:excluir_cadastro',
    ]);
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
 * O DEFEITO LITERAL que rejeitou a T5 na rodada 1: área na **classe**, ação no **método**.
 *
 * `getAllAndOverride` substitui, então este manipulador exige `ACAO:excluir_cadastro` **e mais
 * nada** — `TELA:imoveis` desaparece dele. A cobertura de autorização o classifica como
 * `comExigencia` e fica verde, porque ela audita a **existência** da declaração, não o conteúdo.
 * É por isso que o `CT-355` existe: ele é a única asserção da suíte que olha o conteúdo.
 */
@Controller('verificacao-substitui')
@ExigeChave('TELA:imoveis')
class ControladorQueSubstitui {
  @Post()
  @ExigeChave('ACAO:excluir_cadastro')
  circular(): { readonly naoDeveriaChegarAqui: true } {
    return { naoDeveriaChegarAqui: true };
  }
}

/**
 * A GÊMEA da anterior: mesma classe, mesmo manipulador, mesma ação — e **uma única diferença**, que
 * é declarar a CONJUNÇÃO em vez de trocar a exigência.
 *
 * O par existe para que a acusação seja atribuível à substituição, e a nada mais: com controladores
 * de formas diferentes, uma acusação lá e um silêncio aqui provariam que dois controladores se
 * comportam diferente, não que a verificação discrimina o defeito.
 */
@Controller('verificacao-compoe')
@ExigeChave('TELA:imoveis')
class ControladorQueCompoe {
  @Post()
  @ExigeChaves('TELA:imoveis', 'ACAO:excluir_cadastro')
  circular(): { readonly alcancada: true } {
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

/**
 * Um manipulador cuja declaração de MÉTODO deixou de conter a da CLASSE.
 *
 * Os dois conjuntos viajam nomeados porque a mensagem da falha precisa dizer **o que sumiu**: o
 * defeito não é declarar no método, é declarar no método **menos** do que a classe já exigia.
 */
interface DeclaracaoQueSubstitui {
  readonly controlador: string;
  readonly manipulador: string;
  readonly daClasse: readonly string[];
  readonly doMetodo: readonly string[];
}

/**
 * Achata uma exigência nos **átomos** que ela impõe.
 *
 * `TODAS` é recursiva, então o achatamento também é. As duas dimensões viajam na mesma forma
 * textual que `detalhes.exigido` publica (`TELA:imoveis`, `PERFIL:SYSLOC_MASTER`), o que faz a
 * comparação de conjunto ser sobre o que o cliente de fato veria.
 */
function atomosDaExigencia(exigencia: Exigencia): readonly string[] {
  switch (exigencia.dimensao) {
    case 'CHAVE':
      return [exigencia.chave];
    case 'PERFIL':
      return [`PERFIL:${exigencia.perfil}`];
    case 'NENHUMA':
      // A abertura deliberada não impõe átomo nenhum — e é por isso que ela, declarada num método
      // de classe que exige, aparece como violação: ela REMOVE o que a classe impunha. Isso é
      // deliberado: a ADR-0011 chama a marca de "única abertura deliberada" e manda que cada uso
      // dela peça revisão explícita. Nenhum controlador de produção faz isso hoje.
      return [];
    case 'TODAS':
      return exigencia.exigencias.flatMap(atomosDaExigencia);
  }
}

/**
 * Percorre os manipuladores da aplicação e devolve os que **substituem** a declaração da classe.
 *
 * ---------------------------------------------------------------------------
 * Por que ela mora AQUI, e não em `apps/api/src/`
 * ---------------------------------------------------------------------------
 *
 * Iron Law #6: nenhum símbolo nasce em produção para um teste enxergar algo. Tudo que ela usa é a
 * API pública do arcabouço — `DiscoveryService`, `MetadataScanner` e a MESMA instância de
 * `Reflector` da aplicação —, exatamente como a sonda que o Gate 1 usou para medir o defeito. Ela
 * **não** duplica `verificarCoberturaDeAutorizacao`: não precisa da tabela do roteador nem da
 * resolução de caminho, porque a propriedade sob prova é sobre METADADO, não sobre rota.
 *
 * ---------------------------------------------------------------------------
 * O que ela fecha, e por que isso é a CLASSE e não a ocorrência
 * ---------------------------------------------------------------------------
 *
 * A T6, a T7 e a T9 publicam **as mesmas duas rotas de circulação** em mais quatro controladores.
 * Um caso de comportamento por entidade dependeria de cada autor futuro lembrar de escrevê-lo — e
 * foi precisamente um esquecimento desse tipo que produziu o defeito. Esta asserção é sobre a
 * superfície **inteira**: qualquer manipulador, de qualquer controlador, que declare menos do que a
 * classe dele exige, reprova aqui sem que ninguém precise se lembrar de nada.
 *
 * `@RotaPublica()` é exceção declarada: a marca **é** a declaração daquela rota (§5.1 da tech spec),
 * a guarda retorna antes de ler a exigência, e o inventário público do `CT-213` já a governa por
 * igualdade de conjunto.
 */
function declaracoesQueSubstituemAClasse(
  aplicacao: NestFastifyApplication,
): readonly DeclaracaoQueSubstitui[] {
  const violacoes: DeclaracaoQueSubstitui[] = [];

  for (const { classe, alvo, nome } of manipuladoresDe(aplicacao)) {
    const reflector = aplicacao.get(Reflector, { strict: false });

    if (reflector.getAllAndOverride<boolean | undefined>(ROTA_PUBLICA, [alvo, classe]) === true) {
      continue;
    }

    // O MESMO leitor da guarda, com a MESMA instância de `Reflector` — mas apontado a **um** alvo
    // de cada vez. É a única forma de ver a substituição: com os dois alvos juntos, a precedência
    // devolve o do método e o da classe some, que é exatamente o efeito sob prova.
    const doMetodo = reflector.getAllAndOverride<Exigencia | undefined>(EXIGENCIA, [alvo]);
    const daClasse = reflector.getAllAndOverride<Exigencia | undefined>(EXIGENCIA, [classe]);

    if (daClasse === undefined || doMetodo === undefined) {
      continue;
    }

    const atomosDaClasse = atomosDaExigencia(daClasse);
    const atomosDoMetodo = atomosDaExigencia(doMetodo);

    if (atomosDaClasse.every((atomo) => atomosDoMetodo.includes(atomo))) {
      continue;
    }

    violacoes.push({
      controlador: classe.name,
      manipulador: nome,
      daClasse: [...atomosDaClasse].sort(),
      doMetodo: [...atomosDoMetodo].sort(),
    });
  }

  return violacoes.sort((um, outro) =>
    `${um.controlador}.${um.manipulador}`.localeCompare(
      `${outro.controlador}.${outro.manipulador}`,
    ),
  );
}

/** Quantos manipuladores a varredura de {@link manipuladoresDe} alcança — a âncora do CT-355. */
function manipuladoresExaminados(aplicacao: NestFastifyApplication): number {
  return [...manipuladoresDe(aplicacao)].length;
}

/**
 * As exigências declaradas **no MÉTODO**, por manipulador, **na ordem em que o decorador as declara**
 * — o eixo que o `CT-427` audita.
 *
 * Ela é a irmã de {@link declaracoesQueSubstituemAClasse} e prova outra coisa: aquela responde *"o
 * método declara MENOS do que a classe?"*, e esta responde *"o que exatamente o método declara, e em
 * que ordem?"*. As duas são necessárias porque a ordem é conteúdo — a recusa nomeia a **primeira**
 * chave ausente (RN-14) —, e uma conjunção com os mesmos dois átomos em ordem trocada satisfaz a
 * contenção da primeira e muda o corpo que o cliente lê.
 *
 * **A ordem não é ordenada aqui, e a ausência do `sort` é a decisão.** `atomosDaExigencia` achata na
 * ordem em que `@ExigeChaves` gravou o metadado, e é essa sequência que precisa ser afirmada;
 * ordená-la apagaria justamente o que o caso mede.
 *
 * O manipulador que **não** declara nada no método não aparece no mapa — a ausência é o resultado, e
 * não um arranjo vazio que se confundiria com `@NaoExigePermissao()`, que declara e não exige nada.
 *
 * A chave é `Controlador.manipulador`, o mesmo rótulo que a mensagem de falha do `CT-355` usa: é ele
 * que a guarda de cobertura acusa **pelo nome**.
 */
function exigenciasDeclaradasNoMetodo(
  aplicacao: NestFastifyApplication,
): Map<string, readonly string[]> {
  const reflector = aplicacao.get(Reflector, { strict: false });
  const porManipulador = new Map<string, readonly string[]>();

  for (const { alvo, classe, nome } of manipuladoresDe(aplicacao)) {
    // Um alvo de cada vez, como em `declaracoesQueSubstituemAClasse`: com os dois juntos a
    // precedência devolveria o da classe quando o método não declara nada, e a distinção sumiria.
    const doMetodo = reflector.getAllAndOverride<Exigencia | undefined>(EXIGENCIA, [alvo]);

    if (doMetodo === undefined) {
      continue;
    }

    porManipulador.set(`${classe.name}.${nome}`, atomosDaExigencia(doMetodo));
  }

  return porManipulador;
}

/**
 * A exigência **efetiva** de um manipulador — a que a guarda de fato aplica, com a precedência dela.
 *
 * `getAllAndOverride([alvo, classe])` é a MESMA chamada da guarda, com os dois alvos e na mesma
 * ordem: é ela que faz a declaração do método substituir a da classe. Ler por aqui é o que torna a
 * asserção sobre a rota de situação de locação uma afirmação sobre o que o cliente encontra, e não
 * sobre o que está escrito no fonte.
 *
 * O manipulador ausente levanta em vez de devolver vazio: um nome com erro de digitação produziria
 * `[]`, e `[]` comparado a `[]` passaria em silêncio — que é exatamente a forma de esta asserção
 * apodrecer sem que ninguém perceba.
 */
function exigenciaEfetivaDoManipulador(
  aplicacao: NestFastifyApplication,
  rotulo: string,
): readonly string[] {
  const reflector = aplicacao.get(Reflector, { strict: false });

  for (const { alvo, classe, nome } of manipuladoresDe(aplicacao)) {
    if (`${classe.name}.${nome}` !== rotulo) {
      continue;
    }

    const efetiva = reflector.getAllAndOverride<Exigencia | undefined>(EXIGENCIA, [alvo, classe]);

    if (efetiva === undefined) {
      throw new Error(`${rotulo} não declara exigência alguma, nem no método nem na classe`);
    }

    return atomosDaExigencia(efetiva);
  }

  throw new Error(`a varredura não encontrou o manipulador ${rotulo}`);
}

/** Os manipuladores de rota de todos os controladores montados na aplicação. */
function* manipuladoresDe(
  aplicacao: NestFastifyApplication,
): Generator<{ classe: Type<unknown>; alvo: Type<unknown>; nome: string }> {
  const descoberta = new DiscoveryService(aplicacao.get(ModulesContainer, { strict: false }));
  const varredor = new MetadataScanner();

  for (const embrulho of descoberta.getControllers()) {
    const instancia = embrulho.instance;
    const classe = embrulho.metatype;

    if (instancia === null || instancia === undefined || typeof classe !== 'function') {
      continue;
    }

    const prototipo = Object.getPrototypeOf(instancia) as object;

    for (const nome of varredor.getAllMethodNames(prototipo)) {
      const alvo = (prototipo as Record<string, unknown>)[nome];

      if (typeof alvo !== 'function' || Reflect.getMetadata(METHOD_METADATA, alvo) === undefined) {
        continue;
      }

      // A conversão é o preço de `Reflector` aceitar `Type<any> | Function`: `alvo` já foi
      // estreitado para função pela guarda de cima, e `Type<unknown>` é a forma que os dois usos
      // abaixo — o alvo e a classe — satisfazem sem um segundo tipo só para isto.
      yield { classe: classe as Type<unknown>, alvo: alvo as unknown as Type<unknown>, nome };
    }
  }
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
