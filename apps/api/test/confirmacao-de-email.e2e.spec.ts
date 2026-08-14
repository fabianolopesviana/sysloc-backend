/**
 * O **disparo da confirmação de endereço de e-mail** — os dois gatilhos, e a mesma tarefa — e o
 * **ato do titular**, a única rota de negócio sem sessão do produto (T11).
 *
 * ---------------------------------------------------------------------------
 * INVARIANTES
 * ---------------------------------------------------------------------------
 *
 * | Critério | Caso   | Invariante |
 * |---|---|---|
 * | CA-09 | CT-717 | Criar um locatário com endereço de e-mail grava o endereço como **não
 * |       |        | confirmado**, cria **exatamente uma** linha de portador com prazo de ~72 h e
 * |       |        | `consumido_em` nulo, e enfileira **exatamente uma** tarefa na fila de
 * |       |        | confirmação — nunca um envio síncrono na borda HTTP. A carga da tarefa é
 * |       |        | `{ empresaId, locatarioId, segredo }`, e o nome da fila é o **mesmo** que o
 * |       |        | reenvio manual usa (CT-719). |
 * | CA-09 | CT-718 | Alterar campo que **não** é o e-mail — o `PUT` completo, com o mesmo endereço
 * |       |        | já confirmado — deixa `emailConfirmadoEm` no **mesmo instante** (`toBe`), não
 * |       |        | aumenta a contagem de portadores e **não** enfileira tarefa nova. |
 * | CA-10 | CT-719 | `POST /v1/locatarios/:id/confirmacao-de-email` responde **`202`** com o corpo
 * |       |        | **exatamente** `{ reenviadoEm, expiraEm }` — `Object.keys` igual ao par
 * |       |        | declarado, nenhuma chave de desfecho de e-mail —, marca `invalidado_em` no
 * |       |        | portador anterior (RN-09) e faz nascer um novo com expiração própria. |
 * | CA-10 | CT-720 | Sem `TELA:cadastros`, o reenvio é recusado com `403 ACESSO_NEGADO` no envelope
 * |       |        | **inteiro** da ADR-0017; a contagem crua de portadores do locatário **não**
 * |       |        | muda, e nenhuma tarefa nova aparece na fila. |
 * | CA-09 | CT-737 | Com o **servidor de fila fora do ar**, o cadastro responde `201` normalmente, o
 * |       |        | portador é gravado e **nenhuma** tarefa aparece na fila quando ela volta —
 * |       |        | mensagem perdida nunca vira cadastro perdido (§6.4). |
 * | CA-11 | CT-721 | `POST /v1/confirmacoes-de-email`, com o segredo **do corpo** e **sem cookie
 * |       |        | algum**, responde `200 { confirmado: true }` por igualdade estrita e faz
 * |       |        | `emailConfirmadoEm` do dono do portador deixar de ser nulo. O mesmo segredo
 * |       |        | apresentado pela **cadeia de consulta** é recusado — a rota lê o corpo, e só
 * |       |        | ele. |
 * | CA-10 | CT-722 | Um link emitido **antes** de um reenvio, ainda dentro das 72 h originais,
 * |       |        | recebe **exatamente** a mesma recusa indistinguível, e o endereço permanece
 * |       |        | não confirmado; o link **do reenvio** confirma normalmente — o controle
 * |       |        | positivo que separa "invalidado pelo reenvio" de "a rota está quebrada". |
 * | CA-13 | CT-723 | Segredo nunca emitido, portador vencido e portador consumido **fora da
 * |       |        | validade** produzem respostas **estritamente iguais entre si**
 * |       |        | (`toStrictEqual` sobre status + corpo) e diferentes do `200`; nenhum altera
 * |       |        | estado — o do cenário vencido continua `null`, e o do consumido preserva o
 * |       |        | instante da primeira confirmação. |
 * | CA-12 | CT-724 | Reapresentar o **mesmo** link já consumido, dentro da validade, responde a
 * |       |        | **mesma** `200 { confirmado: true }` e **não reescreve** o instante:
 * |       |        | `instanteA === instanteB` por `toBe` sobre a cadeia ISO-8601. |
 * | CA-14 | CT-725 | O valor **guardado** não confirma nada, nas duas formas: o digest em
 * |       |        | hexadecimal (64 caracteres) morre no **esquema** (`422`, campo `segredo`), e
 * |       |        | o **mesmo** digest em base64url (43 caracteres) passa pelo esquema e morre na
 * |       |        | **busca** (`404`, idêntico ao CT-723 por `toStrictEqual`). |
 * | CA-15 | CT-726 | O link do locatário da empresa A confirma **só** o dono dele: o locatário de B
 * |       |        | permanece intacto, e o portador dele, não consumido. Um `empresaId` proposto
 * |       |        | pelo corpo é recusado pelo `strictObject` (`422`) — e o estado de B continua
 * |       |        | inalterado em qualquer caso. |
 *
 * Rastreabilidade: `CA-09 → CT-717 (RN-07)`, `CA-09 → CT-718 (RN-07)`, `CA-10 → CT-719 (RN-09)`,
 * `CA-10 → CT-720 (RN-13)`, `CA-09 → CT-737 (RN-13)`, `CA-11 → CT-721 (RN-12)`,
 * `CA-10 → CT-722 (RN-09)`, `CA-13 → CT-723 (RN-14)`, `CA-12 → CT-724 (RN-10)`,
 * `CA-14 → CT-725 (RN-11)`, `CA-15 → CT-726 (RN-12)`.
 *
 * ===========================================================================
 * A FILA É REAL, e dublá-la esvaziaria o que este arquivo existe para provar
 * ===========================================================================
 *
 * A afirmação sob prova é *"os dois gatilhos enfileiram a MESMA tarefa"*, e ela só é observável do
 * lado de fora: um dublê programado para registrar chamadas provaria que o produtor foi chamado
 * duas vezes, não que as duas tarefas chegaram à **mesma fila**, com a **mesma forma de carga** e a
 * **mesma política**. Por isso a introspecção é sobre uma segunda instância de produtor — a
 * **sonda** — conectada ao mesmo servidor de fila efêmero, e o nome que ela escuta vem de
 * `@sysloc/shared`, que é a definição única que o produtor de produção também consome.
 *
 * Nenhum caso **do bloco da T9** consome as tarefas: enquanto eles rodam **não há processador
 * registrado**, de modo que a tarefa fica em espera e é exatamente ali que a sonda a encontra. É o
 * estado que discrimina — uma tarefa consumida por engano por algum processador daqui tornaria a
 * contagem indistinguível de "nada foi enfileirado".
 *
 * ⚠️ **A T11 registra um processador, e por isso a POSIÇÃO do bloco dela é conteúdo.** O bloco do ato
 * do titular vem **depois** de todos os casos da T9 — inclusive do `CT-737`, que é o último deles —,
 * e o consumidor nasce no `beforeAll` **daquele bloco**, não na montagem do arquivo. Enquanto os
 * casos da T9 medem, ele ainda não existe; quando ele passa a existir, todas as medições de fila já
 * aconteceram. Trocar a ordem, ou subir o registro para a montagem, reabre exatamente o modo de
 * falha que o parágrafo acima descreve — e ele seria **silencioso**, porque a contagem de tarefas em
 * espera cairia a zero e os deltas passariam a ser satisfeitos por vacuidade.
 *
 * ===========================================================================
 * O SEGREDO EM CLARO NÃO EXISTE NO BANCO — e é do FRAGMENTO do link que ele sai (T11)
 * ===========================================================================
 *
 * A coluna do claro não existe: `emitirPortador` grava apenas `sha256(segredo)`. O único caminho
 * legítimo para tê-lo é o do próprio locatário — criar o cadastro pela **rota real**, deixar o
 * **`worker` real** processar a tarefa contra o **capturador** (a mesma `PortaDeEnvioDeEmail` da
 * produção, entregue **por parâmetro**, como a composição raiz do processo faz) e **extrair o segredo
 * do conteúdo da mensagem capturada**.
 *
 * ⚠️ **Nada é inserido direto na tabela e nenhum derivado é fabricado.** Um arranjo que gravasse o
 * portador por `INSERT` provaria o teste, e não o produto: ele passaria mesmo que a emissão, o
 * enfileiramento e a composição do link estivessem quebradas.
 *
 * ⚠️ **A extração é pelo FRAGMENTO**, e não por posição de linha ou por corte de prefixo: a mensagem
 * leva o segredo depois do `#`, e é essa a decisão de segurança da T10 (o fragmento não é transmitido
 * ao servidor). {@link segredoDoLink} analisa a linha como endereço e lê `hash` — de modo que um link
 * que passasse o segredo para a **cadeia de consulta** deixaria este arranjo sem fragmento e
 * reprovaria nomeando o problema, em vez de continuar verde.
 *
 * O **vencimento** é obtido por `UPDATE` direto no carimbo **depois** de a linha nascer pelo caminho
 * real — no molde do que a suíte já faz para posicionar estado contra o relógio **do banco**.
 * **Nenhum mecanismo novo de "avançar o relógio" é criado**, e nenhum relógio é falseado: o que se
 * move é o dado.
 *
 * ===========================================================================
 * O CT-718 confirma o endereço pelo caminho legítimo que existe HOJE
 * ===========================================================================
 *
 * O card do caso pede a confirmação "pelo fluxo real (criar → capturar link → confirmar)", e a rota
 * que recebe o portador **ainda não existe** — ela é da T11, e o worker que monta o link é da T10.
 * O caminho legítimo disponível é o mesmo que os dois vão usar por dentro, e ele já está publicado
 * desde a T8: a carga da tarefa carrega o **segredo em claro**, e `consumirPortador` o consome pelo
 * derivado.
 *
 * ⚠️ **Nenhum símbolo de produção nasce para este arquivo enxergar algo.** O segredo é lido da
 * **fila real**, que é onde o worker o lerá; a confirmação passa pela função de domínio publicada,
 * sob o contexto de tenant, como a borda da T11 fará. Quando aquelas rotas existirem, o caso pode
 * ser reescrito pela ponta do link sem que nada aqui tenha sido um atalho.
 *
 * ===========================================================================
 * De onde vêm o banco, a fila e a credencial (ADR-0006)
 * ===========================================================================
 *
 * De instâncias efêmeras próprias. Nenhuma coordenada de conexão é lida do ambiente: o ambiente do
 * processo é MONTADO a partir do que os helpers devolvem, e a porta é **reservada** (trava atômica)
 * porque o arcabouço confere a origem das requisições com cookie contra o endereço base.
 */

import { createHash, randomBytes } from 'node:crypto';
import {
  type AcessoAoBanco,
  abrirAcessoAoBanco,
  consumirPortador,
  contextoDeTenant,
  derivarSegredo,
  EMPRESA_A,
  EMPRESA_B,
  SENHA_DA_CARGA,
} from '@sysloc/db';
import { type CapturadorDeEmail, criarCapturadorDeEmail, type EmailCapturado } from '@sysloc/regua';
import {
  type CargaDaConfirmacao,
  CodigoErro,
  criarLogger,
  FILA_DA_CONFIRMACAO,
} from '@sysloc/shared';
import { Queue } from 'bullmq';
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
//        nenhum deles no escopo desta task, e o índice de débitos do `CLAUDE.md`.
// ÍNDICE: docs/specs/features/fundacao-stack-nativa/v1/_run/run-report.md §2, D28
import {
  type IdentidadeEfemera,
  identidadeEfemera,
  pessoaSemeada,
} from '../../../packages/auth/test/identidade-efemera.ts';
import { reservarPorta, sondarAte } from '../../../packages/shared/test/efemero-comum.ts';
import { type FilaEfemera, redisEfemero } from '../../../packages/shared/test/redis-efemero.ts';
// A fiação do `worker` é alcançada pelo caminho do fonte, e não por especificador de pacote: ele é
// aplicação privada, sem `exports`. A razão de estar aqui é o que o cabeçalho declara — a prova do
// ato do titular precisa do segredo em claro, e o único caminho legítimo até ele passa pelo processo
// que entrega a mensagem. Nada de `apps/api/src` importa daqui: a aresta existe só na verificação, e
// só nesta direção.
//
// A classe é ADJACENTE à do débito acima, NÃO a mesma — e a diferença está justamente no que fecha
// cada uma: o D28 fecha declarando o subpath `"./test"` nos manifestos de `@sysloc/shared` e
// `@sysloc/auth`, e isso não alcança `apps/worker/src`, que não é diretório de teste e sim fonte de
// aplicação privada sem `exports`. Fechá-lo deixaria esta aresta viva. Ela fica sem marcador próprio
// de propósito (§3-B da `nao-regressao.md`): o gatilho — o segundo consumidor de verificação que
// precisar do fonte do `worker` — não tem a concretude que um marcador exige, e marcador em excesso
// desarma os que importam. O registro vive só no relatório da fatia:
// ÍNDICE: docs/specs/features/documentos-e-confirmacao/v1/_run/run-report.md §2, D13
import { conectarFila, type Fila } from '../../worker/src/fila.ts';
import { processarConfirmacaoDeEmail } from '../../worker/src/tarefas/confirmacao-de-email.ts';
import { PREFIXO_DAS_ROTAS_DE_IDENTIDADE } from '../src/autenticacao/autenticacao.module.ts';
import { CAMINHO_DA_SESSAO } from '../src/autenticacao/sessao.controller.ts';
import { CAMINHO_DOS_LOCATARIOS } from '../src/cadastros/locatario.controller.ts';
import { ENDERECO_DE_ESCUTA, PREFIXO_DE_VERSAO } from '../src/configuracao/ambiente.ts';
import { CAMINHO_DAS_CONFIRMACOES } from '../src/confirmacoes/confirmacao.controller.ts';
import { criarAplicacao } from '../src/main.ts';
import { cpfValido } from './documento.ts';

/** Limite da montagem: banco migrado, semente com credencial, fila e a aplicação real. */
const LIMITE_DE_MONTAGEM_MS = 240_000;

/** Limite de um caso que atravessa HTTP, banco e fila dezenas de vezes. */
const LIMITE_CASO_MS = 120_000;

/** Sufixo do nome do cookie de sessão do arcabouço — o prefixo vem da configuração. */
const SUFIXO_DO_COOKIE_DE_SESSAO = 'session_token';

/** A rota de entrada, composta a partir do prefixo real. Nunca escrita à mão. */
const ROTA_DE_ENTRADA = `${PREFIXO_DAS_ROTAS_DE_IDENTIDADE}/sign-in/email`;

/** Caminho, relativo à raiz, da rota de sessão do produto. Composto, nunca escrito à mão. */
const CAMINHO_DA_SESSAO_CORRENTE = `/${PREFIXO_DE_VERSAO}/${CAMINHO_DA_SESSAO}`;

/** Caminho, relativo à raiz, da coleção de locatários. */
const COLECAO_DE_LOCATARIOS = `/${PREFIXO_DE_VERSAO}/${CAMINHO_DOS_LOCATARIOS}`;

/** A rota de reenvio de um locatário, composta a partir do dono do segmento. */
function rotaDoReenvio(id: string): string {
  return `${COLECAO_DE_LOCATARIOS}/${id}/confirmacao-de-email`;
}

/** Caminho, relativo à raiz, da rota **sem sessão** do ato do titular. Composto, nunca escrito. */
const ROTA_DO_ATO_DO_TITULAR = `/${PREFIXO_DE_VERSAO}/${CAMINHO_DAS_CONFIRMACOES}`;

/**
 * A base do link que o `worker` recebe **por parâmetro** — como a composição raiz do processo faz.
 *
 * Ela é do domínio reservado da RFC 6761 (`.invalid`), que a resolução de nomes garante não resolver:
 * um link composto sobre ela não leva a lugar nenhum. Nada aqui lê ambiente — o valor é entregue à
 * borda, e é sobre ele que a asserção do link é escrita.
 */
const URL_BASE_DA_CONFIRMACAO = 'https://app.exemplo.invalid';

/** O caminho da página que recebe o link. Ela é da **F6** e não existe neste repositório. */
const CAMINHO_DA_PAGINA_DE_CONFIRMACAO = '/confirmar-email';

/**
 * O corpo — e **apenas** ele — que o sucesso do ato do titular publica.
 *
 * Literal, e não importado de `@sysloc/contracts`: derivá-lo do mesmo esquema que o SUT publica faria
 * a asserção concordar com ele, e uma troca do contrato deixaria de reprovar caso algum.
 */
const CORPO_DA_CONFIRMACAO = { confirmado: true } as const;

/** A mensagem canônica do `404`, escrita por extenso pela mesma razão da constante acima. */
const MENSAGEM_DE_RECURSO_NAO_ENCONTRADO = 'recurso não encontrado';

/** A mensagem canônica do `422`. Idem — literal, nunca lida de `MENSAGEM_POR_CODIGO`. */
const MENSAGEM_DE_REQUISICAO_INVALIDA = 'requisição inválida';

/** O campo que a recusa do segredo malformado nomeia. */
const CAMPO_DO_SEGREDO = 'segredo';

/** O campo que a recusa por chave desconhecida nomeia — o Zod reporta caminho vazio nela. */
const CAMPO_DO_CORPO = 'corpo';

/** Comprimento do segredo em claro: 32 bytes em base64url, sem enchimento. */
const CARACTERES_DO_SEGREDO = 43;

/** Comprimento do digest em hexadecimal — o valor que a coluna `derivado` guarda. */
const CARACTERES_DO_DIGEST_HEXADECIMAL = 64;

/** Limite para a entrega da mensagem chegar ao capturador, folgado sobre a repetição da fila. */
const LIMITE_DA_ENTREGA_MS = 90_000;

/**
 * A pessoa que administra na empresa **B**: `ADMIN_EMPRESA` da carga daquela empresa.
 *
 * Ela existe para o `CT-726`, e a matriz do perfil dela já alcança `TELA:cadastros` **sem ajuste
 * individual algum** — a mesma razão de {@link QUEM_ADMINISTRA}. O efetivo é AFIRMADO antes dos
 * casos: sem essa linha, um `403` na criação do locatário de B seria indistinguível de um defeito
 * dela.
 */
const QUEM_ADMINISTRA_EM_B = pessoaSemeada('admin.b@exemplo.com.br');

/**
 * A área que a classe do controlador exige — afirmada no efetivo, nunca suposta.
 *
 * Literal, e **não** importada do controlador: derivá-la do SUT faria a asserção concordar com ele,
 * e trocar a exigência declarada deixaria de reprovar caso algum.
 */
const AREA_DOS_CADASTROS = 'TELA:cadastros';

/**
 * As mensagens canônicas, escritas por extenso.
 *
 * Literais, e **não** lidas de `MENSAGEM_POR_CODIGO`: os casos comparam corpos inteiros por
 * igualdade, e derivá-las da mesma tabela que o SUT usa faria a asserção concordar consigo mesma —
 * um erro de texto na tabela passaria despercebido nos dois lados.
 */
const MENSAGEM_DE_ACESSO_NEGADO = 'acesso negado para esta sessão';

/** O par de chaves — e **apenas** ele — que o `202` do reenvio publica. */
const CHAVES_DO_REENVIO = ['expiraEm', 'reenviadoEm'] as const;

/** O prazo de validade do portador, em horas (RN-13) — o valor que a porta grava. */
const PRAZO_DE_VALIDADE_HORAS = 72;

/**
 * Folga aceita na conferência do prazo, em minutos.
 *
 * O `expira_em` é carimbado pelo **relógio do banco** (ADR-0026) e comparado aqui contra o relógio
 * deste processo: a diferença entre os dois é real e pequena, e uma igualdade exata reprovaria por
 * ela. A folga é declarada e apertada — larga o bastante para o desvio dos relógios, curta o
 * bastante para reprovar um prazo de 71 h ou de 73 h.
 */
const FOLGA_DO_PRAZO_MINUTOS = 10;

/**
 * A pessoa que age nos três primeiros casos: `ADMIN_EMPRESA` da carga.
 *
 * A matriz do perfil dela é o catálogo inteiro (`packages/auth/src/matriz-de-perfil.ts`), de modo
 * que ela já alcança `TELA:cadastros` **sem ajuste individual algum**. O efetivo é AFIRMADO por
 * `GET /v1/sessao` antes dos casos — sem essa linha, um `403` no reenvio seria indistinguível de um
 * defeito dele.
 */
const QUEM_ADMINISTRA = pessoaSemeada('admin.a@exemplo.com.br');

/**
 * A pessoa do CT-720: `USUARIO_EMPRESA` da carga, **sem ajuste**.
 *
 * A matriz padrão desse perfil é só `TELA:resumo`, e é isso que faz a ausência da área ser um estado
 * legítimo do produto, e não um arranjo forjado. Nenhum ajuste individual é escrito para ela — a
 * recusa que o caso mede vem da matriz do perfil.
 */
const QUEM_NAO_ALCANCA = pessoaSemeada('usuario.a@exemplo.com.br');

let identidade: IdentidadeEfemera;
let filaEfemera: FilaEfemera;
let acessoAoNegocio: AcessoAoBanco;
let aplicacao: Awaited<ReturnType<typeof criarAplicacao>>;
let base: string;
let ambienteAnterior: NodeJS.ProcessEnv;
let cookie: string;
let cookieSemArea: string;

/**
 * A SONDA da fila — um segundo produtor sobre o mesmo servidor, só para observar.
 *
 * Ela escuta o nome que `@sysloc/shared` publica, e não um literal: se o produtor de produção
 * gravasse em outra fila, a contagem aqui ficaria em zero e os casos reprovariam nomeando o
 * problema. É essa coincidência de nome, vinda da definição única, que torna verdadeira a afirmação
 * *"os dois gatilhos enfileiram a MESMA tarefa"*.
 */
let sonda: Queue<CargaDaConfirmacao, void>;

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
  filaEfemera = await redisEfemero();
  acessoAoNegocio = abrirAcessoAoBanco({ cadeiaDeConexao: identidade.banco.cadeiaConexao });

  ambienteAnterior = { ...process.env };
  process.env.NODE_ENV = 'test';
  process.env.LOG_LEVEL = 'fatal';
  process.env.DATABASE_URL = identidade.banco.cadeiaConexao;
  process.env.REDIS_URL = filaEfemera.cadeiaConexao;
  process.env.BETTER_AUTH_SECRET = randomBytes(32).toString('base64url');

  const porta = await reservarPorta();
  base = `http://${ENDERECO_DE_ESCUTA}:${String(porta)}`;
  process.env.PORT = String(porta);

  aplicacao = await criarAplicacao();
  await aplicacao.listen({ port: porta, host: ENDERECO_DE_ESCUTA });

  const endereco = new URL(filaEfemera.cadeiaConexao);
  sonda = new Queue<CargaDaConfirmacao, void>(FILA_DA_CONFIRMACAO, {
    connection: {
      host: endereco.hostname,
      port: Number.parseInt(endereco.port, 10),
    },
  });

  cookie = await entrar(QUEM_ADMINISTRA.email);
  cookieSemArea = await entrar(QUEM_NAO_ALCANCA.email);

  // As DUAS precondições de autorização AFIRMADAS, e não supostas. Sem a primeira, um `403` no
  // reenvio seria indistinguível de um defeito dele; sem a segunda, o `403` do CT-720 seria
  // compatível com uma sessão que não alcança nada por outro motivo.
  const daAdministradora = (await pedir(CAMINHO_DA_SESSAO_CORRENTE, { cookie }))
    .corpo as SessaoPublicada;
  expect(daAdministradora.telas).toContain(AREA_DOS_CADASTROS);

  const deQuemNaoAlcanca = (await pedir(CAMINHO_DA_SESSAO_CORRENTE, { cookie: cookieSemArea }))
    .corpo as SessaoPublicada;
  expect(deQuemNaoAlcanca.telas).not.toContain(AREA_DOS_CADASTROS);
}, LIMITE_DE_MONTAGEM_MS);

afterAll(async () => {
  await sonda?.close();
  await aplicacao?.close();
  await acessoAoNegocio?.encerrar();
  await filaEfemera?.parar();
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

describe('o disparo da confirmação de e-mail (T9)', () => {
  it(
    'CT-717 — criar locatário com e-mail grava o endereço não confirmado, emite portador de 72 h e enfileira a tarefa',
    async () => {
      const antesNaFila = await tarefasEmEspera();

      // ---------------------------------------------------------------------------------------
      // Passo 1 — a criação pela rota real
      // ---------------------------------------------------------------------------------------
      const corpo = corpoDeLocatario('locataria.nova@exemplo.com.br');
      const criacao = await pedir(COLECAO_DE_LOCATARIOS, { metodo: 'POST', cookie, corpo });

      expect(criacao.status).toBe(201);
      const criado = criacao.corpo as LocatarioPublicado;

      // ---------------------------------------------------------------------------------------
      // Passo 2 — o endereço nasce NÃO confirmado, e a leitura publica o instante nulo
      // ---------------------------------------------------------------------------------------
      //
      // `toBeNull` sobre o campo publicado, e não `toBeFalsy`: um campo ausente do corpo também
      // seria falso, e a ausência é exatamente o defeito oposto — a rota deixaria de publicar o que
      // `esquemaDoLocatario` declara.
      expect(criado.emailConfirmadoEm).toBeNull();

      const leitura = await pedir(`${COLECAO_DE_LOCATARIOS}/${criado.id}`, { cookie });
      expect(leitura.status).toBe(200);
      expect((leitura.corpo as LocatarioPublicado).emailConfirmadoEm).toBeNull();

      // ---------------------------------------------------------------------------------------
      // Passo 3 — EXATAMENTE uma linha de portador, com prazo de ~72 h e não consumida
      // ---------------------------------------------------------------------------------------
      //
      // A contagem é CRUA e sem recorte: nenhum `WHERE empresa_id` é escrito aqui — quem recorta é a
      // política (ADR-0008), e a empresa entra pelo CONTEXTO, que é o mesmo mecanismo da aplicação.
      const portadores = await portadoresDoLocatario(criado.id);

      expect(portadores).toHaveLength(1);
      const [portador] = portadores;
      expect(portador?.consumidoEm).toBeNull();
      expect(portador?.invalidadoEm).toBeNull();
      // O prazo, e não apenas "existe uma data": um `expira_em` no passado, ou de um ano, passaria
      // em qualquer asserção de presença.
      expect(desvioDoPrazoEmMinutos(portador?.expiraEm)).toBeLessThan(FOLGA_DO_PRAZO_MINUTOS);

      // ---------------------------------------------------------------------------------------
      // Passo 4 — EXATAMENTE uma tarefa nova, na fila que o reenvio também usa
      // ---------------------------------------------------------------------------------------
      //
      // O delta contra a contagem do começo do caso, e não o total: outro caso deste arquivo pode ter
      // deixado tarefa para trás, e um total absoluto tornaria a asserção dependente da ordem.
      const depoisNaFila = await tarefasEmEspera();
      expect(depoisNaFila.length - antesNaFila.length).toBe(1);

      // A CARGA, por igualdade de conjunto de chaves e por valor nos dois identificadores. O segredo
      // não é comparado com literal nenhum — ele é sorteado —, mas é afirmado como cadeia não vazia,
      // porque é ele que o worker precisa ter para montar o link: uma carga que trouxesse o
      // **derivado** no lugar dele passaria em qualquer asserção de presença de campo.
      const carga = depoisNaFila.at(-1) as CargaDaConfirmacao;

      expect(Object.keys(carga).sort()).toEqual(['empresaId', 'locatarioId', 'segredo']);
      expect(carga.locatarioId).toBe(criado.id);
      expect(carga.empresaId).toBe(EMPRESA_A.id);
      // E o segredo é o CLARO, e não o que o banco guarda: a igualdade abaixo liga a carga à linha
      // gravada, e é ela que prova que o worker consegue resolver o portador com o que recebeu.
      expect(derivarSegredo(carga.segredo)).toBe(portador?.derivado);
      expect(carga.segredo).not.toBe(portador?.derivado);

      // O nome da fila é o MESMO nos dois gatilhos, e é a sonda que o afirma: ela foi construída com
      // o nome que `@sysloc/shared` publica, e é nessa fila que a tarefa apareceu.
      expect(sonda.name).toBe(FILA_DA_CONFIRMACAO);
    },
    LIMITE_CASO_MS,
  );

  it(
    'CT-718 — alterar campo diferente do e-mail não reseta a confirmação nem enfileira tarefa nova',
    async () => {
      // ---------------------------------------------------------------------------------------
      // Passo 1 — criar, e CONFIRMAR o endereço pelo caminho legítimo que existe hoje
      // ---------------------------------------------------------------------------------------
      const corpo = corpoDeLocatario('locataria.confirmada@exemplo.com.br');
      const criacao = await pedir(COLECAO_DE_LOCATARIOS, { metodo: 'POST', cookie, corpo });

      expect(criacao.status).toBe(201);
      const criado = criacao.corpo as LocatarioPublicado;

      // O segredo vem da FILA REAL — é de lá que o worker o lerá. Ver o cabeçalho para por que este
      // é o caminho legítimo enquanto a rota da T11 não existe.
      const [carga] = (await tarefasEmEspera()).filter(
        (tarefa) => tarefa.locatarioId === criado.id,
      );
      // O VALOR, e não a presença: a guarda existe para que o passo seguinte não consuma o portador
      // de outro locatário do arquivo, e é a igualdade do identificador que discrimina isso.
      expect(carga?.locatarioId, 'a criação não enfileirou tarefa para este locatário').toBe(
        criado.id,
      );

      const consumo = await contextoDeTenant.executarCom(
        { empresaId: EMPRESA_A.id },
        async () =>
          await acessoAoNegocio.emUnidadeDeTrabalho(
            async (tx) =>
              await consumirPortador(tx, derivarSegredo((carga as CargaDaConfirmacao).segredo)),
          ),
      );
      // De novo o VALOR: um consumo que tivesse confirmado o endereço de OUTRO locatário passaria
      // em qualquer asserção de presença, e o passo 4 mediria o instante da pessoa errada.
      expect(consumo?.locatarioId, 'o consumo do portador não escreveu nada').toBe(criado.id);

      // ---------------------------------------------------------------------------------------
      // Passo 2 — o estado ANTES da alteração, medido pela rota real e pela contagem crua
      // ---------------------------------------------------------------------------------------
      const antes = (
        (await pedir(`${COLECAO_DE_LOCATARIOS}/${criado.id}`, { cookie }))
          .corpo as LocatarioPublicado
      ).emailConfirmadoEm;

      // A precondição do caso, AFIRMADA: sem ela, um `emailConfirmadoEm` que já fosse nulo faria a
      // igualdade do passo 4 passar por vacuidade — nulo continuaria nulo, e o caso não mediria nada.
      expect(antes).not.toBeNull();

      const portadoresAntes = (await portadoresDoLocatario(criado.id)).length;
      const naFilaAntes = (await tarefasEmEspera()).length;

      // ---------------------------------------------------------------------------------------
      // Passo 3 — o `PUT` COMPLETO, com o telefone trocado e o MESMO e-mail
      // ---------------------------------------------------------------------------------------
      //
      // O corpo é integral porque a rota é substituição integral: ele carrega `email` **sempre**, e
      // é justamente isso que faz este caso discriminar. Uma implementação que disparasse porque "o
      // corpo trouxe o campo" reprovaria aqui, e com razão.
      const alteracao = await pedir(`${COLECAO_DE_LOCATARIOS}/${criado.id}`, {
        metodo: 'PUT',
        cookie,
        corpo: { ...corpo, telefone: '31999998888' },
      });

      expect(alteracao.status).toBe(200);
      expect((alteracao.corpo as LocatarioPublicado).telefone).toBe('31999998888');

      // ---------------------------------------------------------------------------------------
      // Passo 4 — nada mudou: o MESMO instante, a MESMA contagem, NENHUMA tarefa nova
      // ---------------------------------------------------------------------------------------
      //
      // `toBe` sobre o instante, e nunca `toBeTruthy`: uma reconfirmação gravada pela alteração
      // produziria outro instante, igualmente verdadeiro, e a asserção frouxa passaria.
      const depois = (
        (await pedir(`${COLECAO_DE_LOCATARIOS}/${criado.id}`, { cookie }))
          .corpo as LocatarioPublicado
      ).emailConfirmadoEm;

      expect(depois).toBe(antes);
      expect((await portadoresDoLocatario(criado.id)).length).toBe(portadoresAntes);
      expect((await tarefasEmEspera()).length).toBe(naFilaAntes);
    },
    LIMITE_CASO_MS,
  );

  it(
    'CT-719 — o reenvio manual responde 202 sem desfecho de SMTP, invalida o anterior e emite um novo',
    async () => {
      // ---------------------------------------------------------------------------------------
      // Passo 1 — o locatário nasce com o portador P1
      // ---------------------------------------------------------------------------------------
      const criacao = await pedir(COLECAO_DE_LOCATARIOS, {
        metodo: 'POST',
        cookie,
        corpo: corpoDeLocatario('locataria.reenvio@exemplo.com.br'),
      });

      expect(criacao.status).toBe(201);
      const criado = criacao.corpo as LocatarioPublicado;

      const [primeiro] = await portadoresDoLocatario(criado.id);
      expect(primeiro?.invalidadoEm).toBeNull();

      const naFilaAntes = (await tarefasEmEspera()).length;

      // ---------------------------------------------------------------------------------------
      // Passo 2 — o reenvio, e o corpo INTEIRO por igualdade de chaves
      // ---------------------------------------------------------------------------------------
      const reenvio = await pedir(rotaDoReenvio(criado.id), { metodo: 'POST', cookie, corpo: {} });

      // `202`, e não `200`: o ato foi aceito e o efeito externo corre fora da requisição (ADR-0029).
      expect(reenvio.status).toBe(202);

      const publicado = reenvio.corpo as Record<string, unknown>;

      // A ASSERÇÃO QUE TORNA A DECISÃO DO `202` VERIFICÁVEL: o conjunto de chaves, por igualdade.
      // Uma chave de desfecho de entrega — `enviado`, `entregue`, `mensagemId` — reprova aqui, e é
      // ela que separa "a borda calou sobre a entrega" de "a borda por acaso não a devolveu hoje".
      expect(Object.keys(publicado).sort()).toEqual([...CHAVES_DO_REENVIO]);

      // E os dois valores: instantes ISO-8601, com o segundo ~72 h à frente do primeiro. Sem isto, o
      // conjunto de chaves seria satisfeito por um corpo com dois valores quaisquer.
      const reenviadoEm = publicado.reenviadoEm as string;
      const expiraEm = publicado.expiraEm as string;

      expect(Number.isNaN(Date.parse(reenviadoEm))).toBe(false);
      expect(desvioDoPrazoEmMinutos(expiraEm)).toBeLessThan(FOLGA_DO_PRAZO_MINUTOS);

      // ---------------------------------------------------------------------------------------
      // Passo 3 — P1 invalidado (RN-09) e P2 novo, com expiração própria
      // ---------------------------------------------------------------------------------------
      const depois = await portadoresDoLocatario(criado.id);
      expect(depois).toHaveLength(2);

      const anterior = depois.find((linha) => linha.id === primeiro?.id);
      const novo = depois.find((linha) => linha.id !== primeiro?.id);

      // O anterior deixou de resolver — e a marca é a do banco, não um booleano gravado.
      expect(anterior?.invalidadoEm).not.toBeNull();
      // O novo NASCE vivo. Sem esta linha, uma implementação que invalidasse os dois passaria acima.
      expect(novo?.invalidadoEm).toBeNull();
      expect(novo?.consumidoEm).toBeNull();
      // E o instante publicado é o do portador NOVO, e não o do anterior: é essa igualdade que liga o
      // corpo da resposta à linha gravada.
      expect(novo?.criadoEm.toISOString()).toBe(reenviadoEm);
      expect(novo?.expiraEm.toISOString()).toBe(expiraEm);

      // ---------------------------------------------------------------------------------------
      // Passo 4 — o reenvio enfileira na MESMA fila do disparo automático
      // ---------------------------------------------------------------------------------------
      const naFila = await tarefasEmEspera();
      expect(naFila.length - naFilaAntes).toBe(1);

      const carga = naFila.at(-1) as CargaDaConfirmacao;
      expect(Object.keys(carga).sort()).toEqual(['empresaId', 'locatarioId', 'segredo']);
      expect(carga.locatarioId).toBe(criado.id);
      // O segredo da carga resolve o portador NOVO, e não o invalidado: é o que prova que o reenvio
      // entregou o link que passou a valer, e não o que ele acabou de derrubar.
      expect(derivarSegredo(carga.segredo)).toBe(novo?.derivado);
    },
    LIMITE_CASO_MS,
  );

  it(
    'CT-720 — sem a área Cadastros, o reenvio é recusado e nada muda no portador nem na fila',
    async () => {
      // A precondição é montada pela sessão que ALCANÇA — o caso mede a recusa da outra.
      const criacao = await pedir(COLECAO_DE_LOCATARIOS, {
        metodo: 'POST',
        cookie,
        corpo: corpoDeLocatario('locataria.sem.area@exemplo.com.br'),
      });

      expect(criacao.status).toBe(201);
      const criado = criacao.corpo as LocatarioPublicado;

      const portadoresAntes = (await portadoresDoLocatario(criado.id)).length;
      const naFilaAntes = (await tarefasEmEspera()).length;

      const recusa = await pedir(rotaDoReenvio(criado.id), {
        metodo: 'POST',
        cookie: cookieSemArea,
        corpo: {},
      });

      expect(recusa.status).toBe(403);

      // O envelope INTEIRO da ADR-0017, e não a presença do código: `detalhes.exigido` nomeia a
      // chave que falta, e é ele que diz ao cliente o que pedir ao Admin. Uma recusa que omitisse o
      // detalhe passaria em qualquer asserção de presença.
      expect(recusa.corpo).toEqual({
        codigo: CodigoErro.ACESSO_NEGADO,
        mensagem: MENSAGEM_DE_ACESSO_NEGADO,
        detalhes: { exigido: AREA_DOS_CADASTROS },
      });

      // E NADA aconteceu: nem portador novo, nem invalidação do que existia, nem tarefa na fila. As
      // três medições são independentes — a contagem sozinha não distinguiria "não emitiu" de
      // "emitiu e invalidou o anterior".
      const portadoresDepois = await portadoresDoLocatario(criado.id);
      expect(portadoresDepois.length).toBe(portadoresAntes);
      expect(portadoresDepois.every((linha) => linha.invalidadoEm === null)).toBe(true);
      expect((await tarefasEmEspera()).length).toBe(naFilaAntes);
    },
    LIMITE_CASO_MS,
  );

  // ⚠️ ESTE CASO É O ÚLTIMO DO BLOCO DA T9, e a posição é conteúdo: ele derruba o servidor de fila e
  // o religa. Ele vem DEPOIS de todas as medições de fila deste bloco — antes delas, deixaria as
  // conexões reconectando no meio da medição — e ANTES do `beforeAll` do bloco da T11, que conecta o
  // consumidor do `worker` ao servidor já religado. Caso novo com medição de fila entra acima dele.
  it(
    'CT-737 — com o servidor de fila fora do ar, o cadastro é gravado e responde 201; nada é enfileirado',
    async () => {
      const naFilaAntes = (await tarefasEmEspera()).length;

      // A QUEDA preserva o diretório de dados: as tarefas que os casos anteriores deixaram em
      // espera precisam sobreviver, ou a contagem do passo final compararia conjuntos diferentes.
      await filaEfemera.parar({ preservarDados: true });

      let criacao: Resposta;
      try {
        criacao = await pedir(COLECAO_DE_LOCATARIOS, {
          metodo: 'POST',
          cookie,
          corpo: corpoDeLocatario('locataria.fila.fora@exemplo.com.br'),
        });
      } finally {
        // O retorno da fila corre no `finally` porque um caso vermelho não pode deixar o servidor
        // caído para o encerramento do arquivo — e é ele que permite observar a fila no passo 3.
        await filaEfemera.religar();
      }

      // ---------------------------------------------------------------------------------------
      // Passo 1 — a resposta do cadastro é a NORMAL. É esta linha que separa uma mensagem perdida
      // de um cadastro perdido: sem o tratamento no disparo, a falha do enfileiramento subiria
      // pela borda e responderia `500` sobre um cadastro JÁ commitado, que o cliente tentaria de
      // novo e receberia `422` por documento em uso.
      // ---------------------------------------------------------------------------------------
      expect(criacao.status).toBe(201);
      const criado = criacao.corpo as LocatarioPublicado;
      expect(criado.emailConfirmadoEm).toBeNull();

      // ---------------------------------------------------------------------------------------
      // Passo 2 — o dado está GRAVADO: o cadastro e o portador, na mesma unidade de trabalho. A
      // queda da fila é posterior ao `COMMIT` e não alcança nenhum dos dois.
      // ---------------------------------------------------------------------------------------
      const leitura = await pedir(`${COLECAO_DE_LOCATARIOS}/${criado.id}`, { cookie });
      expect(leitura.status).toBe(200);

      const portadores = await portadoresDoLocatario(criado.id);
      expect(portadores).toHaveLength(1);
      expect(portadores[0]?.consumidoEm).toBeNull();
      expect(portadores[0]?.invalidadoEm).toBeNull();

      // ---------------------------------------------------------------------------------------
      // Passo 3 — e NADA foi enfileirado. A medição é depois do retorno da fila, sobre o mesmo
      // diretório de dados: a contagem inalterada é o que distingue "a tarefa se perdeu" de "a
      // tarefa entrou e alguém a consumiu".
      // ---------------------------------------------------------------------------------------
      const naFilaDepois = await tarefasEmEspera();
      expect(naFilaDepois.length).toBe(naFilaAntes);
      expect(naFilaDepois.some((tarefa) => tarefa.locatarioId === criado.id)).toBe(false);
    },
    LIMITE_CASO_MS,
  );
});

// =============================================================================================
// O ATO DO TITULAR (T11) — a única rota de negócio sem sessão do produto
// =============================================================================================

/**
 * O capturador que recebe o que o `worker` entrega — implementação da porta, **nunca um dublê**.
 *
 * Ele é a mesma `PortaDeEnvioDeEmail` que a produção usa, e o que substitui é o **destino** da
 * mensagem, jamais a lógica sob prova. Ele chega à borda **por parâmetro** (ADR-0025), que é como a
 * composição raiz do processo o entrega — não há bandeira, ambiente ou ramo que escolha entre ele e o
 * adaptador de produção, e este arquivo não tem caminho para construir o adaptador.
 */
let capturador: CapturadorDeEmail;

/** A fila do `worker` real, com o consumidor da confirmação registrado. Ver o cabeçalho. */
let filaDoWorker: Fila;

/** O cookie da administradora da empresa **B** — o segundo lado do isolamento do `CT-726`. */
let cookieDeB: string;

describe('o ato do titular — a rota sem sessão (T11)', () => {
  beforeAll(async () => {
    capturador = criarCapturadorDeEmail();

    // A MESMA fiação de `apps/worker/src/main.ts`: `conectarFila` mais `processar`, com a borda
    // recebendo o acesso ao banco, a porta de e-mail e a base do link por parâmetro. A única
    // diferença é qual implementação da porta a composição injeta — e é essa indistinção que faz
    // esta verificação exercitar o caminho de produção inteiro.
    filaDoWorker = conectarFila(
      filaEfemera.cadeiaConexao,
      criarLogger({
        nivel: 'fatal',
        destino: {
          write(): void {
            // O registro do processo consumidor é descartado: o que estes casos afirmam é o EFEITO
            // (o que saiu pela porta, o que a rota respondeu e o que ficou gravado), e não a linha
            // do journal — quem observa registro é `apps/worker/test/eco.spec.ts`.
          },
        },
      }),
    );

    filaDoWorker.processar(
      filaDoWorker.confirmacao,
      async (tarefa, registrador) =>
        await processarConfirmacaoDeEmail(tarefa, registrador, {
          banco: acessoAoNegocio,
          email: capturador,
          urlBaseDaConfirmacao: URL_BASE_DA_CONFIRMACAO,
        }),
    );

    cookieDeB = await entrar(QUEM_ADMINISTRA_EM_B.email);

    // A precondição da sessão de B, AFIRMADA e não suposta — ver o docblock de
    // `QUEM_ADMINISTRA_EM_B`.
    const deB = (await pedir(CAMINHO_DA_SESSAO_CORRENTE, { cookie: cookieDeB }))
      .corpo as SessaoPublicada;
    expect(deB.telas).toContain(AREA_DOS_CADASTROS);
  }, LIMITE_DE_MONTAGEM_MS);

  afterAll(async () => {
    // O consumidor é devolvido aqui, e não no descarte do arquivo: ele é recurso **deste** bloco, e
    // deixá-lo vivo depois dele manteria um cliente conectado ao servidor de fila que o descarte
    // geral vai derrubar.
    await filaDoWorker?.encerrar();
  }, LIMITE_DE_MONTAGEM_MS);

  it(
    'CT-721 — o segredo do corpo, sem sessão alguma, confirma o endereço do dono do portador',
    async () => {
      const email = 'locataria.ato.titular@exemplo.com.br';
      const locatario = await criarLocatario(email, cookie);

      // A precondição, AFIRMADA: sem ela, um `emailConfirmadoEm` que já viesse preenchido faria a
      // asserção do passo final passar sem que a rota tivesse feito coisa alguma.
      expect(locatario.emailConfirmadoEm).toBeNull();

      const segredo = await segredoEntregueA(email, 1);

      // O molde do que o locatário recebeu — 43 caracteres do alfabeto base64url. Sem esta linha, um
      // link que entregasse o **derivado** no lugar do claro seguiria adiante e morreria no `404`,
      // com o caso acusando o lugar errado.
      expect(segredo).toHaveLength(CARACTERES_DO_SEGREDO);

      // ---------------------------------------------------------------------------------------
      // O ato: `POST` SEM COOKIE ALGUM, com o segredo no corpo
      // ---------------------------------------------------------------------------------------
      const resposta = await apresentar({ segredo });

      expect(resposta.status).toBe(200);
      // O corpo INTEIRO por igualdade, e não a presença de `confirmado`: um campo extra — o instante
      // da confirmação, o identificador do locatário — reprova aqui, e é essa asserção que mantém a
      // superfície publicada sendo o que o contrato declara.
      expect(resposta.corpo).toEqual(CORPO_DA_CONFIRMACAO);

      // ---------------------------------------------------------------------------------------
      // O efeito, lido pela rota COM sessão — que é a única que publica o instante
      // ---------------------------------------------------------------------------------------
      const confirmadoEm = await instanteDeConfirmacao(locatario.id, cookie);

      expect(confirmadoEm).not.toBeNull();
      // Instante ISO-8601 válido, e não apenas "não nulo": uma cadeia vazia também não é nula, e o
      // que a ADR-0022 manda publicar é o **fato datado**.
      expect(Number.isNaN(Date.parse(confirmadoEm ?? ''))).toBe(false);

      // ---------------------------------------------------------------------------------------
      // O segredo NÃO viaja fora do corpo — e a prova é comportamental
      // ---------------------------------------------------------------------------------------
      //
      // A mesma apresentação pela CADEIA DE CONSULTA, com o corpo vazio: ela é recusada pelo esquema,
      // nomeando `segredo`. É o que separa "a rota aceita o segredo no corpo" de "a rota o aceita de
      // onde vier" — e a segunda forma o levaria à trilha do servidor de borda e ao histórico do
      // navegador, que é justamente o que a escolha do corpo evita.
      const porConsulta = await pedir(
        `${ROTA_DO_ATO_DO_TITULAR}?${CAMPO_DO_SEGREDO}=${encodeURIComponent(segredo)}`,
        { metodo: 'POST', corpo: {} },
      );

      expect(porConsulta.status).toBe(422);
      expect(porConsulta.corpo).toEqual({
        codigo: CodigoErro.CAMPO_INVALIDO,
        mensagem: MENSAGEM_DE_REQUISICAO_INVALIDA,
        campo: CAMPO_DO_SEGREDO,
      });
    },
    LIMITE_CASO_MS,
  );

  it(
    'CT-724 — reapresentar o mesmo link dentro da validade responde sucesso e não reescreve o instante',
    async () => {
      const email = 'locataria.reapresentacao@exemplo.com.br';
      const locatario = await criarLocatario(email, cookie);
      const segredo = await segredoEntregueA(email, 1);

      const primeira = await apresentar({ segredo });
      expect(primeira.status).toBe(200);
      expect(primeira.corpo).toEqual(CORPO_DA_CONFIRMACAO);

      const instanteA = await instanteDeConfirmacao(locatario.id, cookie);
      // A precondição do caso, AFIRMADA: com um instante nulo, a igualdade do fim passaria por
      // vacuidade — nulo continuaria nulo, e o caso não mediria nada.
      expect(instanteA).not.toBeNull();

      // ---------------------------------------------------------------------------------------
      // A segunda apresentação, do MESMO segredo, na MESMA execução — sem relógio manipulado
      // ---------------------------------------------------------------------------------------
      const segunda = await apresentar({ segredo });

      // A resposta INTEIRA, por igualdade estrita contra a primeira: status e corpo. Uma
      // implementação que respondesse `404`, ou `200` com corpo diferente, reprova aqui — e é essa
      // indistinção que impede a pré-visualização de link feita pelo provedor de e-mail de queimar a
      // confirmação antes de o locatário clicar.
      expect(segunda).toStrictEqual(primeira);

      const instanteB = await instanteDeConfirmacao(locatario.id, cookie);

      // `toBe` sobre a cadeia ISO-8601 exata, e nunca `toBeTruthy`: uma segunda gravação produziria
      // outro instante, igualmente verdadeiro, e a asserção frouxa passaria.
      expect(instanteB).toBe(instanteA);

      // E o portador continua existindo, consumido — a RN-10 depende de o registro **não** ser
      // apagado: é ele que distingue "já foi usado" de "nunca existiu".
      const portadores = await portadoresDoLocatario(locatario.id);
      expect(portadores).toHaveLength(1);
      expect(portadores[0]?.consumidoEm).not.toBeNull();
    },
    LIMITE_CASO_MS,
  );

  it(
    'CT-722 — o reenvio invalida o link anterior, e o do reenvio confirma (controle positivo)',
    async () => {
      const email = 'locataria.link.anterior@exemplo.com.br';
      const locatario = await criarLocatario(email, cookie);

      const primeiroSegredo = await segredoEntregueA(email, 1);

      // O reenvio pela rota real, como operador com `TELA:cadastros`. É ele que invalida o anterior
      // (RN-09) e faz nascer o segundo portador.
      const reenvio = await pedir(rotaDoReenvio(locatario.id), {
        metodo: 'POST',
        cookie,
        corpo: {},
      });
      expect(reenvio.status).toBe(202);

      const segundoSegredo = await segredoEntregueA(email, 2);
      // Os dois são DIFERENTES — sem esta linha, um reenvio que reaproveitasse o portador anterior
      // faria o caso inteiro passar sem que a invalidação existisse.
      expect(segundoSegredo).not.toBe(primeiroSegredo);

      // ---------------------------------------------------------------------------------------
      // O primeiro link, ainda dentro das 72 h originais, deixou de confirmar
      // ---------------------------------------------------------------------------------------
      const recusaDoPrimeiro = await apresentar({ segredo: primeiroSegredo });

      // EXATAMENTE a mesma resposta da recusa indistinguível (a do segredo que nunca existiu), por
      // igualdade estrita: o cliente não tem como saber que este link um dia foi válido.
      expect(recusaDoPrimeiro).toStrictEqual(await recusaDeReferencia());
      expect(await instanteDeConfirmacao(locatario.id, cookie)).toBeNull();

      // ---------------------------------------------------------------------------------------
      // O CONTROLE POSITIVO — sem ele, a recusa acima poderia vir de qualquer defeito da rota
      // ---------------------------------------------------------------------------------------
      const comOSegundo = await apresentar({ segredo: segundoSegredo });

      expect(comOSegundo.status).toBe(200);
      expect(comOSegundo.corpo).toEqual(CORPO_DA_CONFIRMACAO);
      expect(await instanteDeConfirmacao(locatario.id, cookie)).not.toBeNull();
    },
    LIMITE_CASO_MS,
  );

  it(
    'CT-723 — inválido, vencido e consumido-fora-da-validade produzem a MESMA recusa, e nenhum altera estado',
    async () => {
      // ---------------------------------------------------------------------------------------
      // Cenário 1 — segredo que nunca foi emitido
      // ---------------------------------------------------------------------------------------
      const nuncaExistiu = await apresentar({ segredo: segredoSorteado() });

      // ---------------------------------------------------------------------------------------
      // Cenário 2 — portador real, com `expira_em` retrocedido DEPOIS da criação pela rota real
      // ---------------------------------------------------------------------------------------
      const emailVencido = 'locataria.link.vencido@exemplo.com.br';
      const doVencido = await criarLocatario(emailVencido, cookie);
      const segredoVencido = await segredoEntregueA(emailVencido, 1);

      expect(await vencerPortadoresDoLocatario(doVencido.id)).toBe(1);

      const vencido = await apresentar({ segredo: segredoVencido });

      // ---------------------------------------------------------------------------------------
      // Cenário 3 — portador consumido dentro da janela, e a janela vencida DEPOIS do consumo
      // ---------------------------------------------------------------------------------------
      const emailConsumido = 'locataria.link.consumido@exemplo.com.br';
      const doConsumido = await criarLocatario(emailConsumido, cookie);
      const segredoConsumido = await segredoEntregueA(emailConsumido, 1);

      const confirmacaoReal = await apresentar({ segredo: segredoConsumido });
      expect(confirmacaoReal.status).toBe(200);

      const instanteDaPrimeira = await instanteDeConfirmacao(doConsumido.id, cookie);
      expect(instanteDaPrimeira).not.toBeNull();

      expect(await vencerPortadoresDoLocatario(doConsumido.id)).toBe(1);

      const consumidoForaDaValidade = await apresentar({ segredo: segredoConsumido });

      // ---------------------------------------------------------------------------------------
      // As TRÊS respostas, comparadas entre si por `toStrictEqual`
      // ---------------------------------------------------------------------------------------
      //
      // Objeto inteiro contra objeto inteiro, e **nunca** campo a campo: uma diferença num campo que
      // ninguém se lembrou de conferir — um `detalhes` acrescentado num dos ramos, um `campo`
      // nomeando o segredo — passaria despercebida na comparação por campos, e é exatamente ela que
      // diria ao cliente qual dos três casos aconteceu.
      expect(vencido).toStrictEqual(nuncaExistiu);
      expect(consumidoForaDaValidade).toStrictEqual(nuncaExistiu);

      // E o valor LITERAL das três, para que a igualdade acima não possa ser satisfeita por três
      // respostas igualmente erradas — três `500`, por exemplo, seriam estritamente iguais entre si.
      //
      // Esta asserção é TAMBÉM o lado "diferente do sucesso" da discriminação, e é por isso que ele
      // não tem linha própria: uma recusa que respondesse o par da confirmação — `200` com
      // `{ confirmado: true }`, que é o defeito perseguido aqui — reprova NESTA linha, nomeando o
      // valor obtido. Uma `not.toStrictEqual` contra o sucesso, logo abaixo, seria decorativa: o
      // `200` de `confirmacaoReal` já está afirmado no cenário 3 e o `404` está afirmado aqui, de
      // modo que os dois pares diferem por construção quando ambas passam — e quando uma delas
      // falha, o caso aborta antes de alcançá-la. Não há estado do SUT em que ela reprovasse.
      expect(nuncaExistiu).toStrictEqual({
        status: 404,
        corpo: {
          codigo: CodigoErro.RECURSO_NAO_ENCONTRADO,
          mensagem: MENSAGEM_DE_RECURSO_NAO_ENCONTRADO,
        },
      });

      // ---------------------------------------------------------------------------------------
      // NENHUM dos três alterou estado
      // ---------------------------------------------------------------------------------------
      expect(await instanteDeConfirmacao(doVencido.id, cookie)).toBeNull();
      // O do cenário 3 preserva o instante da PRIMEIRA confirmação: a apresentação fora da validade
      // não o reescreveu (ADR-0022 — grava-se o fato, e o fato aconteceu uma vez só).
      expect(await instanteDeConfirmacao(doConsumido.id, cookie)).toBe(instanteDaPrimeira);
    },
    LIMITE_CASO_MS,
  );

  it(
    'CT-725 — o valor guardado não confirma nada: hexadecimal morre no esquema, base64url morre na busca',
    async () => {
      const email = 'locataria.derivado.apresentado@exemplo.com.br';
      const locatario = await criarLocatario(email, cookie);
      const segredo = await segredoEntregueA(email, 1);

      const [portador] = await portadoresDoLocatario(locatario.id);
      const digestHexadecimal = createHash('sha256').update(segredo, 'utf8').digest('hex');

      // O que o banco GUARDA é exatamente este digest — a ligação que torna as duas alíneas
      // afirmações sobre o valor armazenado, e não sobre um hash qualquer calculado aqui.
      expect(portador?.derivado).toBe(digestHexadecimal);
      expect(digestHexadecimal).toHaveLength(CARACTERES_DO_DIGEST_HEXADECIMAL);

      // ---------------------------------------------------------------------------------------
      // (a) A forma HEXADECIMAL — 64 caracteres, recusada pelo ESQUEMA
      // ---------------------------------------------------------------------------------------
      //
      // O molde é `[A-Za-z0-9_-]{43}`, de comprimento exato: 64 caracteres não passam. O status é o
      // que discrimina onde a recusa nasceu — `422` só a borda produz, e o serviço só levanta `404`
      // —, e é por isso que esta alínea prova que **nenhuma consulta ao banco foi disparada**.
      const emHexadecimal = await apresentar({ segredo: digestHexadecimal });

      expect(emHexadecimal).toStrictEqual({
        status: 422,
        corpo: {
          codigo: CodigoErro.CAMPO_INVALIDO,
          mensagem: MENSAGEM_DE_REQUISICAO_INVALIDA,
          campo: CAMPO_DO_SEGREDO,
        },
      });

      // ---------------------------------------------------------------------------------------
      // (b) O MESMO digest em base64url — 43 caracteres, passa pelo esquema e morre na BUSCA
      // ---------------------------------------------------------------------------------------
      //
      // ⚠️ É esta alínea que exercita a CA-14 de fato: só a (a) provaria o **esquema** achando que
      // prova a derivação. O digest tem 32 bytes, logo dá exatamente 43 caracteres e **passa** pelo
      // molde; a recusa vem de o guardado ser `sha256(segredo)`, e não `sha256(digest)`.
      const emBase64Url = createHash('sha256').update(segredo, 'utf8').digest('base64url');
      expect(emBase64Url).toHaveLength(CARACTERES_DO_SEGREDO);

      const comOGuardado = await apresentar({ segredo: emBase64Url });

      // Idêntica à recusa indistinguível — e não um erro próprio que revelasse "isto é um hash, não
      // um segredo".
      expect(comOGuardado).toStrictEqual(await recusaDeReferencia());

      // Nos dois, o endereço permanece não confirmado.
      expect(await instanteDeConfirmacao(locatario.id, cookie)).toBeNull();
    },
    LIMITE_CASO_MS,
  );

  it(
    'CT-726 — o link de A confirma só o dono dele, e o pedido não influencia a empresa do contexto',
    async () => {
      const emailDeA = 'locataria.isolamento.a@exemplo.com.br';
      const emailDeB = 'locataria.isolamento.b@exemplo.com.br';

      const deA = await criarLocatario(emailDeA, cookie);
      const deB = await criarLocatario(emailDeB, cookieDeB);

      const segredoDeA = await segredoEntregueA(emailDeA, 1);
      // O segredo de B é capturado, e **não** apresentado: o que o caso mede é que o ato sobre A não
      // alcança B. Tê-lo em mãos é o que prova que o portador de B nasceu — sem essa linha, "B
      // continua não confirmado" seria satisfeito por um cadastro que nunca emitiu portador algum.
      const segredoDeB = await segredoEntregueA(emailDeB, 1);
      expect(segredoDeB).not.toBe(segredoDeA);

      // ---------------------------------------------------------------------------------------
      // A apresentação legítima — corpo simples, sem qualquer menção a empresa
      // ---------------------------------------------------------------------------------------
      const doTitularDeA = await apresentar({ segredo: segredoDeA });

      expect(doTitularDeA.status).toBe(200);
      expect(doTitularDeA.corpo).toEqual(CORPO_DA_CONFIRMACAO);

      // A de A confirmou; a de B **não foi tocada** — e as duas leituras correm sob a sessão da
      // empresa dona de cada uma, que é o único caminho publicado até o instante.
      expect(await instanteDeConfirmacao(deA.id, cookie)).not.toBeNull();
      expect(await instanteDeConfirmacao(deB.id, cookieDeB)).toBeNull();

      // O portador de B também está intacto: a leitura crua distingue "não confirmou" de "confirmou e
      // a rota não publicou".
      const portadoresDeB = await portadoresDoLocatario(deB.id, EMPRESA_B.id);
      expect(portadoresDeB).toHaveLength(1);
      expect(portadoresDeB[0]?.consumidoEm).toBeNull();

      // ---------------------------------------------------------------------------------------
      // A tentativa de influenciar o contexto pelo CORPO
      // ---------------------------------------------------------------------------------------
      //
      // `empresaId` é chave desconhecida no `strictObject` da apresentação: ela é **recusada**, e não
      // ignorada. A diferença é o conteúdo — ignorar seria o começo de o corpo virar "o novo
      // request", que é a alternativa que a ADR-0024 rejeita por nome.
      const comEmpresaInjetada = await apresentar({
        segredo: segredoDeA,
        empresaId: EMPRESA_B.id,
      });

      expect(comEmpresaInjetada).toStrictEqual({
        status: 422,
        corpo: {
          codigo: CodigoErro.CAMPO_INVALIDO,
          mensagem: MENSAGEM_DE_REQUISICAO_INVALIDA,
          campo: CAMPO_DO_CORPO,
        },
      });

      // E o estado de B permanece inalterado — nas duas pontas, a publicada e a crua.
      expect(await instanteDeConfirmacao(deB.id, cookieDeB)).toBeNull();
      expect((await portadoresDoLocatario(deB.id, EMPRESA_B.id))[0]?.consumidoEm).toBeNull();
    },
    LIMITE_CASO_MS,
  );
});

// ---------------------------------------------------------------------------------------------
// Arranjo e observação — nada aqui é oráculo; tudo é caminho real
// ---------------------------------------------------------------------------------------------

/** Contador do arranjo, para que cada cadastro nasça com documento e nome distinguíveis. */
let sequencia = 0;

/** Um corpo completo de locatário, com o e-mail informado. */
function corpoDeLocatario(email: string): Record<string, unknown> {
  sequencia += 1;
  const marca = String(sequencia).padStart(6, '0');

  return {
    nome: `Locatária ${marca}`,
    tipoPessoa: 'PESSOA_FISICA',
    documentoPrincipal: cpfValido(sequencia),
    rg: `MG-${marca}`,
    email,
    telefone: '11999990000',
    logradouro: 'Rua das Acácias',
    numero: '100',
    complemento: 'apto 12',
    bairro: 'Centro',
    cidade: 'São Paulo',
    estado: 'SP',
    cep: '01000000',
  };
}

/** Uma linha crua de `negocio.portador_de_confirmacao`, como os casos a observam. */
interface PortadorGravado {
  readonly id: string;
  readonly derivado: string;
  readonly criadoEm: Date;
  readonly expiraEm: Date;
  readonly consumidoEm: Date | null;
  readonly invalidadoEm: Date | null;
}

/**
 * Os portadores do locatário informado, em ordem de criação — leitura **crua**, sem recorte.
 *
 * Nenhum `WHERE empresa_id` é escrito aqui: quem recorta é a política (ADR-0008), e a empresa entra
 * pelo **contexto**, que é o mesmo mecanismo que a aplicação usa.
 *
 * A empresa é **parâmetro** desde a T11, com o padrão que os casos anteriores já usavam: o `CT-726`
 * observa o portador de um locatário da empresa **B**, e sob o contexto de A a política — corretamente
 * — não alcança linha alguma. Declarar a empresa observada é o que torna a leitura vazia distinguível
 * de "o portador não existe"; herdar um contexto fixo faria a asserção de isolamento passar por
 * vacuidade, que é o pior desfecho possível para ela. Os chamadores anteriores seguem inalterados.
 */
async function portadoresDoLocatario(
  locatarioId: string,
  empresaId: string = EMPRESA_A.id,
): Promise<readonly PortadorGravado[]> {
  return await contextoDeTenant.executarCom(
    { empresaId },
    async () =>
      await acessoAoNegocio.emUnidadeDeTrabalho(
        async (tx) =>
          await tx<PortadorGravado[]>`
            SELECT id,
                   derivado,
                   criado_em     AS "criadoEm",
                   expira_em     AS "expiraEm",
                   consumido_em  AS "consumidoEm",
                   invalidado_em AS "invalidadoEm"
              FROM negocio.portador_de_confirmacao
             WHERE locatario_id = ${locatarioId}
             ORDER BY criado_em, id
          `,
      ),
  );
}

/**
 * As cargas das tarefas **em espera** na fila de confirmação, na ordem em que entraram.
 *
 * Em espera, e não "todas": nenhum processador é registrado por este arquivo (ele é da T10), de modo
 * que toda tarefa enfileirada fica ali — e uma tarefa que sumisse desse estado seria, ela própria,
 * um achado.
 */
async function tarefasEmEspera(): Promise<readonly CargaDaConfirmacao[]> {
  const tarefas = await sonda.getJobs(['waiting', 'delayed', 'prioritized']);

  return tarefas
    .sort((uma, outra) => Number(uma.id ?? 0) - Number(outra.id ?? 0))
    .map((tarefa) => tarefa.data);
}

/** Cria um locatário pela rota REAL, sob a sessão informada, e devolve o cadastro publicado. */
async function criarLocatario(email: string, credencial: string): Promise<LocatarioPublicado> {
  const criacao = await pedir(COLECAO_DE_LOCATARIOS, {
    metodo: 'POST',
    cookie: credencial,
    corpo: corpoDeLocatario(email),
  });

  if (criacao.status !== 201) {
    throw new Error(`a criação de ${email} respondeu ${String(criacao.status)}: ${criacao.texto}`);
  }

  return criacao.corpo as LocatarioPublicado;
}

/** As mensagens que o capturador reteve para um endereço, na ordem em que a borda as entregou. */
function capturasPara(destinatario: string): readonly EmailCapturado[] {
  return capturador.capturas.filter((captura) => captura.destinatario === destinatario);
}

/**
 * O segredo da **enésima** mensagem entregue a um endereço, extraído do **fragmento** do link.
 *
 * A espera é **sondagem com limite nomeado**, e não `sleep` fixo: a entrega corre noutro processo
 * lógico — a fila —, e o que se aguarda é o estado observável *"a mensagem chegou ao capturador"*.
 *
 * O ordinal é explícito porque ele **é** conteúdo em dois casos: no `CT-722`, a primeira mensagem é a
 * do cadastro e a segunda é a do reenvio, e trocá-las inverteria o que o caso mede. Filtrar por
 * destinatário, em vez de tomar a última captura, é o que torna cada caso independente das mensagens
 * que os demais deixaram na lista.
 */
async function segredoEntregueA(destinatario: string, ordinal: number): Promise<string> {
  await sondarAte(
    `a ${String(ordinal)}ª confirmação de ${destinatario} chegar ao capturador`,
    () => capturasPara(destinatario).length >= ordinal,
    LIMITE_DA_ENTREGA_MS,
  );

  const captura = capturasPara(destinatario)[ordinal - 1];

  if (captura === undefined) {
    throw new Error(`a ${String(ordinal)}ª mensagem de ${destinatario} desapareceu do capturador`);
  }

  return segredoDoLink(captura);
}

/**
 * Extrai o segredo do **fragmento** do link, exatamente como o locatário o receberia.
 *
 * O corpo é analisado linha a linha como **endereço**, e o segredo sai de `hash` — nunca de um corte
 * de prefixo nem de uma posição de linha. Duas consequências, e as duas são o motivo da forma:
 *
 *   * um link que passasse o segredo para a **cadeia de consulta** deixaria este arranjo sem
 *     fragmento e reprovaria **nomeando** o problema, em vez de continuar verde por acidente;
 *   * **exatamente uma** linha pode carregar fragmento. Duas seriam ambiguidade, e escolher uma
 *     delas aqui seria decidir por conta própria qual link o locatário abriria.
 *
 * O caminho da página é conferido junto, e ele é **redigitado de propósito** — importá-lo do módulo
 * que compõe a mensagem faria a asserção concordar com o SUT, e trocar a página deixaria de reprovar
 * caso algum. É a mesma escolha, e a mesma razão, de `apps/worker/test/confirmacao-de-email.spec.ts`.
 */
function segredoDoLink(captura: EmailCapturado): string {
  const enderecos = captura.mensagem.corpo
    .split('\n')
    .filter((linha) => URL.canParse(linha))
    .map((linha) => new URL(linha));

  const comFragmento = enderecos.filter((endereco) => endereco.hash.length > 1);

  if (comFragmento.length !== 1 || comFragmento[0] === undefined) {
    throw new Error(
      'a mensagem capturada não trouxe exatamente um endereço com fragmento: ' +
        `${String(comFragmento.length)} encontrados`,
    );
  }

  const link = comFragmento[0];

  if (link.pathname !== CAMINHO_DA_PAGINA_DE_CONFIRMACAO) {
    throw new Error(`o link da confirmação aponta para ${link.pathname}, e não para a página dela`);
  }

  return link.hash.slice(1);
}

/**
 * Apresenta um corpo na rota do ato do titular — **sem cookie algum**.
 *
 * O retorno é o par (status, corpo), que é a unidade comparada por `toStrictEqual` entre as recusas:
 * comparar as respostas inteiras traria cabeçalhos que variam por requisição, e comparar campo a
 * campo deixaria passar a diferença num campo que ninguém conferiu — que é justamente o que a RN-14
 * proíbe existir.
 */
async function apresentar(corpo: Record<string, unknown>): Promise<RespostaObservada> {
  const resposta = await pedir(ROTA_DO_ATO_DO_TITULAR, { metodo: 'POST', corpo });

  return { status: resposta.status, corpo: resposta.corpo };
}

/**
 * A recusa de referência: a de um segredo **sorteado e nunca emitido**.
 *
 * Ela é recalculada em cada uso, e não guardada entre casos: uma constante compartilhada faria dois
 * casos dependerem da ordem de execução, e o que se compara aqui é o que a rota responde **agora**.
 */
async function recusaDeReferencia(): Promise<RespostaObservada> {
  return await apresentar({ segredo: segredoSorteado() });
}

/** Um segredo com a forma exata do produto — 32 bytes em base64url —, que nunca foi emitido. */
function segredoSorteado(): string {
  return randomBytes(32).toString('base64url');
}

/**
 * O instante de confirmação publicado pela rota de leitura — **nunca lido de coluna**.
 *
 * É a superfície que o cliente enxerga (`esquemaDoLocatario`), e é sobre ela que os casos afirmam: um
 * `email_confirmado_em` gravado que a rota não publicasse seria defeito, e ler a coluna esconderia
 * exatamente esse defeito.
 */
async function instanteDeConfirmacao(
  locatarioId: string,
  credencial: string,
): Promise<string | null> {
  const leitura = await pedir(`${COLECAO_DE_LOCATARIOS}/${locatarioId}`, { cookie: credencial });

  if (leitura.status !== 200) {
    throw new Error(
      `a leitura de ${locatarioId} respondeu ${String(leitura.status)}: ${leitura.texto}`,
    );
  }

  return (leitura.corpo as LocatarioPublicado).emailConfirmadoEm;
}

/**
 * Retrocede o vencimento dos portadores do locatário — o dado se move, o relógio nunca.
 *
 * `UPDATE` direto **depois** de a linha nascer pelo caminho real, e o carimbo novo sai de
 * `pg_catalog.now()`, que é o relógio **do banco** (ADR-0026) — o mesmo que a função de resolução
 * consulta. Nenhum mecanismo de "avançar o relógio" é criado, e nenhum instante é calculado neste
 * processo.
 *
 * **Sem `WHERE empresa_id`**, e não pode haver: quem recorta é a política (ADR-0008), e a empresa
 * entra pelo contexto — o mesmo mecanismo da aplicação.
 *
 * @returns quantas linhas foram alcançadas, para que o caso afirme que o arranjo de fato aconteceu.
 */
async function vencerPortadoresDoLocatario(locatarioId: string): Promise<number> {
  return await contextoDeTenant.executarCom(
    { empresaId: EMPRESA_A.id },
    async () =>
      (
        await acessoAoNegocio.emUnidadeDeTrabalho(
          async (tx) =>
            await tx`
            UPDATE negocio.portador_de_confirmacao
               SET expira_em = pg_catalog.now() - interval '1 hour'
             WHERE locatario_id = ${locatarioId}
          `,
        )
      ).count,
  );
}

/**
 * De quantos minutos o instante informado se afasta do prazo de validade esperado.
 *
 * A comparação é contra o relógio DESTE processo, e o `expira_em` é carimbado pelo relógio do banco
 * (ADR-0026): a diferença entre os dois é real, e é por isso que a asserção usa uma folga nomeada em
 * vez de igualdade. Um prazo de 71 h ou de 73 h devolve ~60 minutos de desvio e reprova.
 */
function desvioDoPrazoEmMinutos(instante: Date | string | undefined): number {
  const alvo = typeof instante === 'string' ? Date.parse(instante) : (instante?.getTime() ?? 0);
  const horas = (alvo - Date.now()) / (60 * 60 * 1000);

  return Math.abs(horas - PRAZO_DE_VALIDADE_HORAS) * 60;
}

/** O recorte da sessão publicada que este arquivo observa. */
interface SessaoPublicada {
  readonly telas: readonly string[];
  readonly acoes: readonly string[];
}

/** O recorte do locatário publicado que os casos observam. */
interface LocatarioPublicado {
  readonly id: string;
  readonly telefone: string;
  readonly emailConfirmadoEm: string | null;
}

interface Resposta {
  readonly status: number;
  readonly texto: string;
  readonly corpo: unknown;
  readonly cookies: readonly string[];
}

/** O par que os casos da T11 comparam entre si — ver {@link apresentar}. */
interface RespostaObservada {
  readonly status: number;
  readonly corpo: unknown;
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
 * navegador enviaria, e é o que o arcabouço confere nas requisições que carregam cookie.
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
async function entrar(email: string): Promise<string> {
  const entrada = await pedir(ROTA_DE_ENTRADA, {
    metodo: 'POST',
    corpo: { email, password: SENHA_DA_CARGA },
  });

  if (entrada.status !== 200) {
    throw new Error(`a entrada de ${email} respondeu ${String(entrada.status)}: ${entrada.texto}`);
  }

  const credencial = entrada.cookies.find((bruto) =>
    (bruto.split(';')[0] ?? '').split('=')[0]?.trim().endsWith(SUFIXO_DO_COOKIE_DE_SESSAO),
  );

  if (credencial === undefined) {
    throw new Error('a entrada bem-sucedida não devolveu cookie de sessão');
  }

  return credencial.split(';')[0] ?? '';
}
