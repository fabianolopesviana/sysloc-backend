/**
 * A **leitura do estado das rotinas agendadas** — `GET /v1/automacao-de-cobranca/rotinas`, T10 da
 * fatia `automacoes-agendadas`, e a **ÚLTIMA rota que este repositório publica** antes do
 * congelamento da superfície.
 *
 * ---------------------------------------------------------------------------
 * INVARIANTES
 * ---------------------------------------------------------------------------
 *
 * | Critério | Caso | Invariante |
 * |---|---|---|
 * | CA-14 | CT-1091 | Com sessão de Admin portando `TELA:automacao_de_cobranca`, a rota responde
 * |       |         | `200` com `itens` trazendo **uma entrada por rotina de `ROTINAS_PUBLICADAS`**,
 * |       |         | na ordem do roster; a entrada com histórico é comparada **campo a campo**, com
 * |       |         | `ultimaExecucao` igual ao instante gravado, `resumo` profundamente igual e
 * |       |         | `historicoRecente` em ordem **decrescente**; e a empresa **sem passagem
 * |       |         | alguma** recebe `200` com `ultimaExecucao: null`, `resumo: null` e
 * |       |         | `historicoRecente: []` — **nunca `404`** —, com a contagem crua de
 * |       |         | `negocio.execucao_de_rotina` sob ela **igual a `0` depois da leitura**. |
 * | CA-15 | CT-1092 | A resposta ao Admin de B contém **exclusivamente** dados de B: com o controle
 * |       |         | positivo sob A afirmando que os **três** instantes aparecem, todo
 * |       |         | `historicoRecente` de B é `[]`, todo `ultimaExecucao` é `null`, a interseção
 * |       |         | entre os instantes devolvidos a B e os gravados em A é **VAZIA**, e o corpo
 * |       |         | com `?empresaId=<A>` e `?empresa_id=<A>` é **profundamente igual** ao do mesmo
 * |       |         | pedido sem parâmetro. |
 * | CA-19 | CT-1093 | Os **três** impedimentos são derivados de fato já gravado — política com
 * | CA-14 |         | `ativo = false`, última tentativa recusada e ausência de certificado vigente
 * |       |         | —, com o `codigo` pertencente a `CODIGOS_DE_IMPEDIMENTO` e a `mensagem` em
 * |       |         | vocabulário do produto (varredura devolve `[]`, com controle positivo); e a
 * |       |         | **linha de controle** devolve `impedimento === null` nas **três** rotinas, com
 * |       |         | o conjunto de códigos presentes na resposta **VAZIO**. |
 * | CA-14 | CT-1094 | Sem cookie, `401` com corpo **igual** a `{ codigo, mensagem }`; com sessão
 * | CA-15 |         | válida sem a área, `403` com corpo **igual** a `{ codigo, mensagem, detalhes:
 * |       |         | { exigido: 'TELA:automacao_de_cobranca' } }`; cookie forjado, `401` com o
 * |       |         | **mesmo** envelope; o controle positivo responde `200` com as três entradas; e
 * |       |         | **nenhum** dos três corpos de erro contém identificador de empresa. |
 *
 * Rastreabilidade: `CA-14 → CT-1091 (RD-03)` · `CA-15 → CT-1092 (RN-15)` ·
 * `CA-19 → CT-1093 (RD-19)` · `CA-14 → CT-1093 (RN-14)` · `CA-14 → CT-1094 (RN-14)` ·
 * `CA-15 → CT-1094 (RN-15)`.
 *
 * ⚠️ **As âncoras de superfície NÃO vivem aqui** — elas vivem no `CT-1095`, em
 * `./cobertura-de-autorizacao.e2e.spec.ts`, para não duplicar cross-layer (AP-23) o que aquela suíte
 * já afirma por igualdade de conjunto.
 *
 * ===========================================================================
 * NENHUM CASO DEPENDE DA ORDEM — quem afirma um eixo, escreve esse eixo
 * ===========================================================================
 *
 * ⚠️ **A rodada 1 desta task dependia da ordem, e o Gate 1 a reprovou.** O `CT-1091` derivava o
 * impedimento `REGUA_DESLIGADA` da **ausência** de política em A — estado que a montagem deixara e
 * que o `CT-1093` **destrói** na linha `L4`, ao ligar a régua de A. Rodando isolado, ou em ordem
 * invertida, o `CT-1091` reprovava. A justificativa de então — *"não há rota que apague política"* —
 * não sustentava a dependência: este arquivo já alcança o banco por instrução própria
 * ({@link escreverPolitica}, {@link lerInstantesGravados}, {@link contarPassagens}), e o que faltava
 * era **usá-la**.
 *
 * Hoje a disciplina é uma só e vale para todos os casos: **quem afirma um eixo, escreve esse eixo**.
 * O `CT-1091` grava a régua **desligada** de A antes de ler, de modo que o impedimento que ele espera
 * é fato gravado por ele próprio — e a precedência de `REGUA_DESLIGADA` sobre
 * `AVISOS_RECUSADOS_PELO_PROVEDOR` na lista da rotina o torna independente também de qualquer
 * tentativa que outro caso tenha semeado. O `CT-1093` já era assim por dentro: cada linha da tabela
 * escreve **todos** os eixos que ela afirma — a política inteira, a última tentativa e (quando é o
 * caso) o certificado.
 *
 * O eixo que **nenhum** caso muta é o das passagens: só a montagem escreve em
 * `negocio.execucao_de_rotina`. E ele não é suposto — o `CT-1091` prende a contagem crua `0` sob B e
 * o `CT-1092` prende os três instantes sob A, de modo que um caso que mexesse no arranjo reprovaria
 * **ruidosamente** em vez de medir outra coisa em silêncio.
 *
 * ===========================================================================
 * O QUE NÃO SE COMPARA POR IGUALDADE, e por que a ausência é decisão
 * ===========================================================================
 *
 * ⚠️ **`proximaEsperada` é derivada de `now()` do servidor A CADA REQUISIÇÃO**, e para a cadência de
 * minuto ela é `date_trunc('minute', now()) + 1 min`. Dois pedidos que atravessem uma virada de
 * minuto devolvem valores **legitimamente diferentes**, e compará-los byte a byte entre duas
 * requisições faria o caso ser não determinístico **por construção** — e a saída para isso seria a
 * repetição, que é o `retry_as_fix` (AP-22) que a stack de teste proíbe. É a mesma armadilha que a
 * `.claude/rules/nao-regressao.md` nomeia: *derivar numa transação e verificar em outra*.
 *
 * Por isso o `CT-1092` compara os corpos **sem o relógio** ({@link semORelogio}) e afirma
 * `proximaEsperada` **à parte**, por propriedade própria: ISO-8601 e **estritamente futura**. O que a
 * comparação existe para provar — *nenhum parâmetro de consulta muda o que a resposta contém* — fica
 * **inteiro**: todo campo de alcance (`ultimaExecucao`, `resumo`, `historicoRecente`, `impedimento`,
 * `atrasada`, `rotina`, `cadencia`) entra na igualdade profunda, e são exatamente esses que poderiam
 * carregar dado da outra empresa.
 *
 * ===========================================================================
 * A PRECONDIÇÃO PRIVILEGIADA, e por que ela é montada pelo caminho REAL
 * ===========================================================================
 *
 *   * **sessão** — por {@link entrar} de `./acessorios-de-borda.ts`, contra a rota pública de entrada
 *     do arcabouço de identidade. Nenhum estado de sessão é forjado (salvo o cookie do `CT-1094`, que
 *     é o objeto de prova), e nenhum cookie é montado à mão;
 *   * **cliente HTTP** — {@link pedir} do **mesmo** arquivo, importado e nunca redeclarado: é a
 *     convenção *"acessório de suíte se importa, não se copia"* do `CLAUDE.md`, e é a classe de
 *     defeito que o `D40 · F5/T9` nomeia — uma suíte com duas formas de falar HTTP;
 *   * **passagens de rotina** — por `registrarExecucaoDeRotina`, a porta de produção que a própria
 *     rotina usa, **uma por unidade de trabalho**. ⚠️ A separação é conteúdo: `ocorrida_em` é o
 *     `DEFAULT now()` da coluna, e `now()` é `transaction_timestamp()` — três gravações na **mesma**
 *     transação receberiam o **mesmo** instante, e a ordem decrescente do histórico ficaria empatada.
 *     A distinção dos instantes é **afirmada** antes de ser usada;
 *   * **política, tentativa e certificado** — por `semearPoliticaDeAviso`, `registrarEnvioDeCobranca`
 *     e `registrarCertificado`, sob o contexto de tenant da empresa. Nenhum impedimento é fabricado:
 *     cada um corresponde a uma linha que **existe** (ou que falta) no banco;
 *   * **a cadeia da cobrança** — pelas **ROTAS REAIS** do produto: conjunto, imóvel, locador,
 *     locatário, contrato, ativação e lançamento, cada um por um `POST` autenticado. É a preferência
 *     **(b)** da Iron Law #6 — *"construa pela API/caminho real do boundary"* —, e ela é imitada de
 *     `./automacao-de-cobranca.e2e.spec.ts`, que monta o mesmo cenário pelas mesmas rotas.
 *
 * **Nenhum símbolo de produção nasce para o teste enxergar algo** (Iron Law #6), nenhuma rota de
 * verificação é publicada, e `app.empresa_id` nunca é fixado por fora da barreira.
 *
 * ===========================================================================
 * Por que a cadeia da cobrança NÃO vem de `packages/db/test/cenario-de-cobranca.ts`
 * ===========================================================================
 *
 * ⚠️ **Ela não é importável daqui, e a razão é medida — não é preferência.** `semearCobrancaDoZero`
 * abre a unidade de trabalho por `emUnidadeSobContexto`, que fixa o contexto de tenant no
 * `AsyncLocalStorage` do módulo **fonte** (`packages/db/src/contexto.ts`). Uma suíte de `apps/api`
 * consome `@sysloc/db` pelo **barril**, cujo `"."` resolve para `dist/`: são **duas instâncias** do
 * mesmo módulo, e o contexto fixado numa não é lido pela outra. Medido: com o auxiliar importado, a
 * primeira gravação morreu com `new row violates row-level security policy for table
 * "execucao_de_rotina"` — o `SET LOCAL app.empresa_id` do barril não via o contexto da fonte, e a
 * política recusou a linha com `empresa_id` nulo.
 *
 * O `D21 · F4/T9` **não é agravado por isto**: aquele débito é sobre a cadeia repetida dentro de
 * `packages/db/test/`, e a casa que ele criou serve **àquele** diretório — o docblock dela mede *"10
 * suítes de `packages/db/test/`"*. Aqui a cadeia nasce por **HTTP**, que não é cópia daquele arranjo:
 * é o caminho de maior nível da Iron Law #6, e o único que atravessa a validação de entrada, a guarda
 * de autorização e a contabilidade das séries do produto.
 *
 * ===========================================================================
 * DIVERGÊNCIAS DECLARADAS (`.claude/rules/autonomia-do-run.md`, A1)
 * ===========================================================================
 *
 * 1. **A "empresa C recém-admitida" do card é a EMPRESA B da carga.** O card do `CT-1091` pede uma
 *    terceira empresa; montá-la exige o percurso do operador do SaaS (criar empresa → admitir Admin →
 *    trocar a senha provisória), que custa uma **sétima** escrita de `entrarComSegundoFatorCumprido`
 *    — o `D32 · F5/T7`, cujo Limiar de Três já disparou e cujo gatilho **esta task não aciona** — e
 *    uma troca de senha contra o teto de dez por minuto — que aqui vale por balde único, porque os
 *    pedidos desta suíte não declaram origem apurável. A empresa `B` da carga
 *    satisfaz a invariante **integralmente**: ela é admitida na montagem desta suíte, e **não tem
 *    passagem alguma** de rotina. O que o caso mede — *`200` com nulos, nunca `404`, e a leitura não
 *    cria linha* — não depende de a empresa ser a terceira.
 * 2. **A borda de 24 h de `HORAS_DA_RECUSA_RECENTE` NÃO é reafirmada aqui.** Ela já tem âncora
 *    executável na **porta**, no `CT-1074 (h)` de `packages/db/test/execucao-de-rotina.spec.ts`, que
 *    envelhece a mesma linha nos dois lados da janela. Repeti-la na borda seria o
 *    `duplicate_cross_layer` (AP-23) — e a borda não tem como envelhecer a tentativa sem um `UPDATE`
 *    cru que a porta já faz melhor. As **duas pernas que discriminam** o impedimento, essas, estão
 *    aqui: a linha `L2` prende *"a última tentativa é recusa"* e a linha `L4` prende *"uma entrega
 *    posterior o limpa sozinha"*.
 *
 * ===========================================================================
 * De onde vêm o banco, a fila e a credencial (ADR-0006)
 * ===========================================================================
 *
 * De instâncias efêmeras próprias. Nenhuma coordenada de conexão é lida do ambiente: o ambiente do
 * processo é MONTADO a partir do que os auxiliares devolvem, e a porta é **reservada** (trava
 * atômica) porque o arcabouço confere a origem das requisições com cookie contra o endereço base.
 *
 * A aplicação é a de **PRODUÇÃO**, montada por `criarAplicacao()` e não remontada aqui: nenhum
 * provedor é substituído, porque esta rota não fala com terceiro algum — ela lê o banco e responde.
 */

import { randomBytes } from 'node:crypto';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import {
  CADENCIA_DA_ROTINA,
  CODIGOS_DE_IMPEDIMENTO,
  type EstadoDasRotinas,
  type EstadoDeRotina,
  LIMIAR_DE_ATRASO_POR_CADENCIA,
  type PoliticaDeAvisoNova,
  ROTINAS_PUBLICADAS,
  type RotinaPublicada,
} from '@sysloc/contracts';
import {
  type AcessoAoBanco,
  abrirAcessoAoBanco,
  contextoDeTenant,
  EMPRESA_A,
  EMPRESA_B,
  registrarCertificado,
  registrarEnvioDeCobranca,
  registrarExecucaoDeRotina,
  SENHA_DA_CARGA,
} from '@sysloc/db';
import { CodigoErro } from '@sysloc/shared';
import type { TransactionSql } from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  type IdentidadeEfemera,
  identidadeEfemera,
  pessoaSemeada,
} from '../../../packages/auth/test/identidade-efemera.ts';
import { semearPoliticaDeAviso } from '../../../packages/db/test/banco-efemero.ts';
import { reservarPorta } from '../../../packages/shared/test/efemero-comum.ts';
import { type FilaEfemera, redisEfemero } from '../../../packages/shared/test/redis-efemero.ts';
import {
  CAMINHO_DA_AUTOMACAO_DE_COBRANCA,
  SEGMENTO_DAS_ROTINAS,
} from '../src/automacao/automacao.controller.ts';
import { CAMINHO_DOS_LOCADORES } from '../src/cadastros/locador.controller.ts';
import { CAMINHO_DOS_LOCATARIOS } from '../src/cadastros/locatario.controller.ts';
import { CAMINHO_DAS_COBRANCAS } from '../src/cobrancas/cobranca.controller.ts';
import { ENDERECO_DE_ESCUTA, PREFIXO_DE_VERSAO } from '../src/configuracao/ambiente.ts';
import { CAMINHO_DOS_CONTRATOS } from '../src/contratos/contrato.controller.ts';
import { CAMINHO_DOS_CONJUNTOS } from '../src/imoveis/conjunto.controller.ts';
import { CAMINHO_DOS_IMOVEIS } from '../src/imoveis/imovel.controller.ts';
import { criarAplicacao } from '../src/main.ts';
import { entrar, pedir, SUFIXO_DO_COOKIE_DE_SESSAO } from './acessorios-de-borda.ts';
import { cpfValido } from './documento.ts';

/** Teto da montagem: banco migrado, carga com credencial, fila e a aplicação real sobem aqui. */
const LIMITE_DE_MONTAGEM_MS = 240_000;

/** Teto por caso: cada um atravessa HTTP e banco várias vezes. */
const LIMITE_CASO_MS = 120_000;

/** A rota sob prova, composta dos donos dos segmentos — nunca escrita à mão. */
const ROTA_DAS_ROTINAS = `/${PREFIXO_DE_VERSAO}/${CAMINHO_DA_AUTOMACAO_DE_COBRANCA}/${SEGMENTO_DAS_ROTINAS}`;

/**
 * A área que a **classe** do controlador exige — literal, e não importada do controlador.
 *
 * Derivá-la da mesma constante que o SUT usa para declarar faria a asserção concordar consigo mesma:
 * trocar a exigência da classe deixaria de reprovar caso algum. Ela é o valor que o cliente lê em
 * `detalhes.exigido`, e por isso a expectativa é **escrita**.
 */
const AREA_DA_AUTOMACAO_DE_COBRANCA = 'TELA:automacao_de_cobranca';

/** As duas mensagens canônicas do envelope de erro — literais, e não lidas de `MENSAGEM_POR_CODIGO`. */
const MENSAGEM_SEM_SESSAO = 'sessão inválida ou expirada';
const MENSAGEM_DE_ACESSO_NEGADO = 'acesso negado para esta sessão';

/**
 * O texto que o Admin lê em cada impedimento — a **âncora** do que a leitura publica.
 *
 * Escrito por extenso aqui, e não importado do SUT: as mensagens não saem de `@sysloc/db` (são
 * mecanismo interno da derivação), e um caso que derivasse o esperado da própria implementação
 * concordaria com ela seja qual for o texto — inclusive com um código de erro de terceiro que
 * vazasse para a tela. É a mesma disciplina, e os mesmos três textos, de
 * `packages/db/test/execucao-de-rotina.spec.ts`.
 */
const MENSAGEM_POR_IMPEDIMENTO = {
  REGUA_DESLIGADA: 'a régua de cobrança está desligada nas configurações da empresa',
  AVISOS_RECUSADOS_PELO_PROVEDOR: 'o provedor de e-mail recusou o último aviso desta empresa',
  INTEGRACAO_BANCARIA_PENDENTE: 'a empresa não tem certificado do provedor vigente',
} as const;

/**
 * Jargão de processo que **não** pode aparecer no texto que o Admin lê (RD-19, ADR-0034).
 *
 * ⚠️ **Esta é a SEGUNDA escrita desta lista** — a primeira é privada de
 * `packages/db/test/execucao-de-rotina.spec.ts`, de onde ela não pode ser importada: importar de um
 * arquivo `.spec.ts` executa o módulo dele e registraria os casos daquela suíte **dentro** desta. O
 * Limiar de Três do `CLAUDE.md` dispara na **terceira**: ali as duas sobem para a casa compartilhada
 * do diretório.
 */
const VOCABULARIO_DE_PROCESSO = [
  'null',
  'undefined',
  'error',
  'exception',
  'sqlstate',
  'constraint',
  'negocio.',
  'jsonb',
  'timestamptz',
];

/** Os resumos que a montagem grava — distintos entre si, para que cada passagem seja identificável. */
const RESUMO_DO_ENCERRAMENTO = { contratosEncerrados: 1 };
const RESUMO_DO_PRIMEIRO_AVISO = { avisosEnviados: 1 };
const RESUMO_DO_SEGUNDO_AVISO = { avisosEnviados: 2 };

/** A política ligada, com a janela que nunca fecha — o estado que **não** impede a régua. */
const REGUA_LIGADA: PoliticaDeAvisoNova = {
  ativo: true,
  diasAntesDoVencimento: 5,
  intervaloMinimoDias: 1,
  janelaInicio: '00:00',
  janelaFim: '23:59',
  canal: 'EMAIL',
};

/** A mesma política, desligada — o único eixo que muda entre as duas. */
const REGUA_DESLIGADA: PoliticaDeAvisoNova = { ...REGUA_LIGADA, ativo: false };

/** A causa que o provedor devolveu na recusa semeada — texto de arranjo, nunca lido pelo SUT. */
const CAUSA_DA_RECUSA = 'destinatario recusado pelo provedor';

/** Dias de validade do certificado do arranjo — folgados, para que a vigência nunca seja o eixo. */
const DIAS_DESDE_A_EMISSAO = -30;
const DIAS_ATE_O_VENCIMENTO = 335;

/** As pessoas da carga que este arquivo usa. */
const ADMIN_DE_A = pessoaSemeada('admin.a@exemplo.com.br');
const ADMIN_DE_B = pessoaSemeada('admin.b@exemplo.com.br');
/** Quem tem perfil de usuário e, na matriz **padrão**, só `TELA:resumo`. */
const QUEM_NAO_ALCANCA = pessoaSemeada('usuario.a@exemplo.com.br');

/**
 * O contexto de uma empresa **conhecida**, como a guarda o publica a partir da sessão.
 *
 * Declarado aqui, e não importado de `packages/db/test/unidade-sob-contexto.ts`: aquela casa serve ao
 * **diretório dela** — ver o bloco do cabeçalho sobre por que o `AsyncLocalStorage` da fonte não é o
 * que o barril lê. É a mesma forma que as sete suítes de `apps/worker/test/` declaram.
 */
interface Contexto {
  readonly empresaId: string;
}

/** O contexto de cada empresa da carga, como a guarda o publica a partir da sessão. */
const CONTEXTO_DE_A: Contexto = { empresaId: EMPRESA_A.id };
const CONTEXTO_DE_B: Contexto = { empresaId: EMPRESA_B.id };

/** As variáveis que a montagem escreve no ambiente do processo e restaura ao fim. */
const VARIAVEIS_MONTADAS = [
  'NODE_ENV',
  'PORT',
  'LOG_LEVEL',
  'DATABASE_URL',
  'REDIS_URL',
  'BETTER_AUTH_SECRET',
] as const;

let identidade: IdentidadeEfemera;
let fila: FilaEfemera;
let acessoAoNegocio: AcessoAoBanco;
let aplicacao: NestFastifyApplication;
let base: string;
let ambienteAnterior: NodeJS.ProcessEnv;
let cookieDeA: string;
let cookieDeB: string;
let cookieSemAArea: string;

/** Os instantes das três passagens semeadas em A, na ordem em que foram gravadas. */
let instantesDeA: readonly Date[];

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

  // A aplicação de PRODUÇÃO. Nenhum provedor é substituído: esta rota não fala com terceiro algum.
  aplicacao = await criarAplicacao();
  await aplicacao.listen({ port: porta, host: ENDERECO_DE_ESCUTA });

  // As três passagens de A — **uma por unidade de trabalho**, porque `now()` é
  // `transaction_timestamp()` e três gravações na mesma transação empatariam os instantes.
  await semearPassagem(CONTEXTO_DE_A, 'ENCERRAMENTO_DE_CONTRATOS', RESUMO_DO_ENCERRAMENTO);
  await semearPassagem(CONTEXTO_DE_A, 'AVISO_DE_COBRANCA', RESUMO_DO_PRIMEIRO_AVISO);
  await semearPassagem(CONTEXTO_DE_A, 'AVISO_DE_COBRANCA', RESUMO_DO_SEGUNDO_AVISO);

  instantesDeA = await lerInstantesGravados(CONTEXTO_DE_A);

  // O certificado vigente de A, pela porta de produção: sem ele, a conferência de liquidação
  // anunciaria `INTEGRACAO_BANCARIA_PENDENTE` e o `CT-1091` mediria dois fatos de uma vez.
  await registrarCertificadoVigente(CONTEXTO_DE_A, ADMIN_DE_A.id);

  cookieDeA = await entrar(base, ADMIN_DE_A.email, SENHA_DA_CARGA);
  cookieDeB = await entrar(base, ADMIN_DE_B.email, SENHA_DA_CARGA);
  cookieSemAArea = await entrar(base, QUEM_NAO_ALCANCA.email, SENHA_DA_CARGA);
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

describe('a leitura do estado das rotinas agendadas por empresa (T10)', () => {
  it(
    'CT-1091 — devolve as 3 rotinas com o histórico de quem passou, e 200 com null para quem nunca passou',
    async () => {
      // ---------------------------------------------------------------------------------------
      // SANIDADE DO ARRANJO, antes de exercitar a rota
      // ---------------------------------------------------------------------------------------
      //
      // As três passagens têm instantes DISTINTOS. Sem esta linha, três gravações que tivessem caído
      // na mesma transação — e portanto no mesmo `transaction_timestamp()` — deixariam a ordem do
      // histórico empatada, e a asserção de "ordem decrescente" passaria por acidente.
      expect(instantesDeA.length).toBe(3);
      expect(new Set(instantesDeA.map((instante) => instante.getTime())).size).toBe(3);

      // ---------------------------------------------------------------------------------------
      // O ESTADO QUE ESTE CASO AFIRMA, ESCRITO POR ELE — e não herdado de quem rodou antes
      // ---------------------------------------------------------------------------------------
      //
      // A régua **desligada** de A é o fato que origina o `REGUA_DESLIGADA` esperado lá embaixo. Sem
      // esta escrita, o caso derivaria a expectativa da **ausência** de política deixada pela
      // montagem — e o `CT-1093` liga a régua de A na linha `L4`, de modo que este caso reprovaria
      // isolado ou em ordem invertida. O escritor é `upsert`: reescrever o mesmo estado é idempotente.
      await escreverPolitica(CONTEXTO_DE_A, REGUA_DESLIGADA);

      // --- A empresa COM histórico -------------------------------------------------------------
      //
      // ⚠️ O relógio é lido **antes** do pedido, e é contra ele que `proximaEsperada` é comparada
      // adiante. Lido depois, ele teria avançado sobre a margem que a derivação de minuto deixa
      // (`date_trunc('minute', now()) + 1 min`, composta no banco), e o caso passaria a reprovar por
      // lentidão da suíte, nomeando o defeito errado. É a mesma armadilha da precondição de
      // `atrasada` logo abaixo, aplicada ao eixo do relógio.
      const antesDoPedidoDeA = Date.now();
      const resposta = await pedir(base, ROTA_DAS_ROTINAS, { cookie: cookieDeA });

      expect(resposta.status).toBe(200);

      const publicado = resposta.corpo as EstadoDasRotinas;

      // O roster INTEIRO, na ordem de declaração, por igualdade de arranjo — nunca `toContain`: uma
      // rotina que sumisse reprova como ausente, e uma que aparecesse a mais reprova como excedente.
      expect(publicado.itens.map((estado) => estado.rotina)).toEqual([...ROTINAS_PUBLICADAS]);

      // O corpo é o envelope de coleção da ADR-0017, e as três chaves de JANELA ficam de fora: o
      // roster é fechado, e paginar coleção fechada é oferecer controle que não decide nada.
      expect(Object.keys(publicado)).toEqual(['itens']);

      const doAviso = entradaDe(publicado, 'AVISO_DE_COBRANCA');
      const [primeiraDoEncerramento, primeiroAviso, segundoAviso] = instantesDeA;

      if (
        primeiraDoEncerramento === undefined ||
        primeiroAviso === undefined ||
        segundoAviso === undefined
      ) {
        throw new Error('o arranjo não gravou as três passagens da empresa A');
      }

      // PRECONDIÇÃO AFIRMADA, e não suposta: `atrasada` compara o silêncio contra o limiar da
      // cadência, e a passagem que a montagem acabou de gravar precisa estar DENTRO dele. Sem esta
      // linha, uma suíte que demorasse mais que o limiar reprovaria na igualdade abaixo nomeando o
      // defeito errado — diria "a rota mudou" onde o que envelheceu foi o arranjo.
      expect(idadeEmMinutos(segundoAviso)).toBeLessThan(
        LIMIAR_DE_ATRASO_POR_CADENCIA[CADENCIA_DA_ROTINA.AVISO_DE_COBRANCA.tipo],
      );

      // A ordem DECRESCENTE do histórico, afirmada como **relação sobre o que a rota devolveu** — e
      // ANTES da igualdade profunda abaixo, nunca depois dela.
      //
      // ⚠️ **A posição é conteúdo**, e é a disciplina que a `DECISÃO FECHADA` deste arquivo declara:
      // a igualdade abaixo fixa `historicoRecente` por extenso, de modo que estas três, lidas depois
      // dela, passariam por necessidade — nem o histórico ordenado de forma **crescente** que elas
      // dizem perseguir chegaria a elas, porque ele reprovaria antes, na igualdade (AP-29). Aqui elas
      // são falsificáveis, e a falha nomeia *a ordem do histórico* em vez de despejar o diff de um
      // objeto inteiro; a igualdade posterior não perde nada, porque ordem decrescente não implica os
      // instantes exatos nem os resumos.
      //
      // As três leem o corpo PUBLICADO, e nunca o arranjo: comparar dois valores que o próprio caso
      // escreveu não diria nada sobre o SUT. E a ordem entre elas também é a lei — a que admite
      // empate vem antes da que o recusa.
      const publicadosDoAviso = doAviso.historicoRecente.map((passagem) =>
        Date.parse(passagem.ocorridaEm),
      );

      expect(publicadosDoAviso.length).toBe(2);
      expect(publicadosDoAviso).toEqual([...publicadosDoAviso].sort((a, b) => b - a));
      expect(publicadosDoAviso[0]).toBeGreaterThan(
        publicadosDoAviso[1] ?? Number.POSITIVE_INFINITY,
      );

      // A entrada INTEIRA, campo a campo e por igualdade profunda — nunca por presença de campo, e
      // nunca por instantâneo. `proximaEsperada` é o único campo tomado do próprio corpo, porque é
      // derivado de `now()` do servidor; ele tem asserção própria logo abaixo.
      expect(doAviso).toEqual({
        rotina: 'AVISO_DE_COBRANCA',
        cadencia: { tipo: 'A_CADA_MINUTO' },
        ultimaExecucao: segundoAviso.toISOString(),
        resumo: RESUMO_DO_SEGUNDO_AVISO,
        proximaEsperada: doAviso.proximaEsperada,
        atrasada: false,
        // O fato que ESTE caso gravou acima: a régua de A está desligada. Ele não é derivado da
        // ausência de política — era assim na rodada 1, e a dependência de ordem que isso criava
        // foi o que o Gate 1 reprovou.
        impedimento: {
          codigo: 'REGUA_DESLIGADA',
          mensagem: MENSAGEM_POR_IMPEDIMENTO.REGUA_DESLIGADA,
        },
        // A ordem é DECRESCENTE: a passagem mais recente primeiro.
        historicoRecente: [
          { ocorridaEm: segundoAviso.toISOString(), resumo: RESUMO_DO_SEGUNDO_AVISO },
          { ocorridaEm: primeiroAviso.toISOString(), resumo: RESUMO_DO_PRIMEIRO_AVISO },
        ],
      });

      // `proximaEsperada`, à parte: ISO-8601 e ESTRITAMENTE futura. Sem estas duas linhas, a
      // igualdade acima aceitaria qualquer coisa naquele campo, inclusive `null`.
      //
      // O eixo é `antesDoPedidoDeA`, e a implicação é TOTAL — não é tolerância em milissegundos:
      // `antesDoPedidoDeA <= now()` do banco (mesmo host, mesmo relógio do SO) e a derivação garante
      // `proximaEsperada > now()` do banco, logo a comparação vale sempre com o SUT correto, seja
      // qual for a latência. E ela continua reprovando instante passado, `null` e valor que não
      // venha do relógio.
      expect(doAviso.proximaEsperada).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u);
      expect(Date.parse(doAviso.proximaEsperada)).toBeGreaterThan(antesDoPedidoDeA);

      // A rotina DIÁRIA publica a hora declarada, e a de intervalo NÃO tem a chave: sob
      // `exactOptionalPropertyTypes`, publicar `hora: undefined` seria publicar chave que o esquema
      // declara ausente.
      expect(entradaDe(publicado, 'ENCERRAMENTO_DE_CONTRATOS').cadencia).toEqual({
        tipo: 'DIARIA',
        hora: '00:02',
      });
      expect(entradaDe(publicado, 'ENCERRAMENTO_DE_CONTRATOS').ultimaExecucao).toBe(
        primeiraDoEncerramento.toISOString(),
      );

      // A rotina de A que NUNCA passou: nulos, e não ausência de entrada. É o que separa "esta
      // empresa não roda a conferência" de "a conferência não existe".
      const daConferencia = entradaDe(publicado, 'CONFERENCIA_DE_LIQUIDACAO');
      expect(daConferencia.ultimaExecucao).toBeNull();
      expect(daConferencia.resumo).toBeNull();
      expect(daConferencia.historicoRecente).toEqual([]);

      // --- A empresa SEM passagem alguma --------------------------------------------------------
      const antesDaLeitura = await contarPassagens(CONTEXTO_DE_B);
      expect(antesDaLeitura).toBe(0);

      const semPassagem = await pedir(base, ROTA_DAS_ROTINAS, { cookie: cookieDeB });

      // `200`, e NUNCA `404`: "ainda não rodou" e "não existe" são a mesma coisa publicada (RD-03).
      //
      // DECISÃO FECHADA — T10 / Gate 1 (ALTO-001) · 2026-08-23
      // O QUÊ: a negativa `not.toBe(404)` vem ANTES da igualdade `toBe(200)`. E a regra é do ARQUIVO
      //        INTEIRO, não deste ponto: em TODO caso desta suíte, asserção mais fraca vem antes da
      //        igualdade que a implica, nunca depois — inclusive quando a mais fraca é DERIVADA do
      //        mesmo objeto que a igualdade fixa (`.map`, `.filter`, `.flatMap`, `length`,
      //        `toContain`, `not.toContain`, `not.toHaveProperty`, comparação de ordem). Estão sob
      //        esta regra, e nesta ordem por decisão: no `CT-1091`, a ordem decrescente do histórico
      //        antes da igualdade de `doAviso`; no `CT-1092`, a interseção com os instantes de A
      //        antes das igualdades de `ultimaExecucao` e `historicoRecente`; no `CT-1093`, a
      //        pertinência do código à união e a varredura de vocabulário antes do mapa e da
      //        igualdade da mensagem, e o conjunto de códigos da linha de controle antes da
      //        igualdade de nulos; no `CT-1094`, o não-vazamento dos três corpos antes das três
      //        igualdades de envelope. Quem acrescentar asserção a este arquivo posiciona-a pela
      //        mesma regra.
      // POR QUÊ: `expect` lança ao reprovar, de modo que a negativa posterior só chega a ser
      //          avaliada quando o status JÁ é `200` — estado em que ela passa por necessidade.
      //          Nenhum estado do SUT, nem o `404` que a RD-03 persegue, a faria reprovar (AP-29,
      //          `tautological_assertion`). Invertidas, é a negativa que reprova no vazamento de
      //          existência, e a igualdade não perde nada porque `not.toBe(404)` não implica
      //          `toBe(200)`. A classe JÁ FORA FECHADA em `./autorizacao-do-dominio.e2e.spec.ts`
      //          (DECISÃO FECHADA — T12 / Gate 2 · 2026-08-12) e voltou por caminho novo: arquivo
      //          novo, escrito sem ler aquele marcador.
      // REVERTER EXIGE: demonstrar que a negativa, na posição posterior, reprova em algum estado do
      //                 SUT — o que exigiria que a igualdade anterior não abortasse.
      expect(semPassagem.status, 'a empresa sem passagem alguma teve a existência negada').not.toBe(
        404,
      );
      expect(
        semPassagem.status,
        `a empresa sem passagem alguma respondeu ${String(semPassagem.status)}`,
      ).toBe(200);

      const deB = semPassagem.corpo as EstadoDasRotinas;

      expect(deB.itens.map((estado) => estado.rotina)).toEqual([...ROTINAS_PUBLICADAS]);
      // As três grandezas numa comparação só: se alguma divergir, a falha nomeia a rotina.
      expect(
        deB.itens.map((estado) => ({
          rotina: estado.rotina,
          ultimaExecucao: estado.ultimaExecucao,
          resumo: estado.resumo,
          historicoRecente: estado.historicoRecente,
        })),
      ).toEqual(
        ROTINAS_PUBLICADAS.map((rotina) => ({
          rotina,
          ultimaExecucao: null,
          resumo: null,
          historicoRecente: [],
        })),
      );

      // A SEGUNDA metade da RD-03, e a que passa despercebida: a leitura **não escreve**. Uma
      // implementação que criasse a linha "desligada" na leitura devolveria exatamente o mesmo
      // corpo, e só esta contagem crua a separa da correta.
      expect(await contarPassagens(CONTEXTO_DE_B)).toBe(0);
    },
    LIMITE_CASO_MS,
  );

  it(
    'CT-1092 — o Admin de B não alcança passagem de A, e nenhum parâmetro de consulta muda a resposta',
    async () => {
      // ---------------------------------------------------------------------------------------
      // CONTROLE POSITIVO sob A — obrigatório
      // ---------------------------------------------------------------------------------------
      //
      // Sem ele, uma rota quebrada que devolvesse SEMPRE histórico vazio passaria em tudo que vem
      // abaixo, e a "interseção vazia" seria verdadeira por vacuidade.
      const deA = (await pedir(base, ROTA_DAS_ROTINAS, { cookie: cookieDeA }))
        .corpo as EstadoDasRotinas;

      const instantesEsperados = instantesDeA.map((instante) => instante.toISOString());

      expect(instantesEsperados.length).toBe(3);
      // O conjunto DISTINTO: `ultimaExecucao` repete o item mais recente do histórico da mesma
      // rotina, e é a coincidência dos dois campos — não a contagem bruta — que prova o alcance.
      expect(instantesDistintos(deA)).toEqual([...instantesEsperados].sort());

      // ---------------------------------------------------------------------------------------
      // A sessão de B, com e sem parâmetro de consulta
      // ---------------------------------------------------------------------------------------
      // ⚠️ O relógio ANTES dos três pedidos, e não depois deles: o laço que compara
      // `proximaEsperada` só começa depois das três requisições e das duas igualdades profundas, de
      // modo que um `Date.now()` lido lá embaixo mediria a `proximaEsperada` de `semParametro`
      // contra um relógio de duas requisições HTTP mais tarde. Ver o cabeçalho para a margem que a
      // derivação de minuto deixa.
      const antesDosPedidosDeB = Date.now();
      const semParametro = await pedir(base, ROTA_DAS_ROTINAS, { cookie: cookieDeB });
      const comCamelCase = await pedir(base, `${ROTA_DAS_ROTINAS}?empresaId=${EMPRESA_A.id}`, {
        cookie: cookieDeB,
      });
      const comSnakeCase = await pedir(base, `${ROTA_DAS_ROTINAS}?empresa_id=${EMPRESA_A.id}`, {
        cookie: cookieDeB,
      });

      for (const resposta of [semParametro, comCamelCase, comSnakeCase]) {
        expect(resposta.status).toBe(200);

        const corpo = resposta.corpo as EstadoDasRotinas;

        // A INTERSEÇÃO com os instantes de A, afirmada por igualdade a `[]` e não por um booleano:
        // a falha nomeia o instante que atravessou.
        //
        // ⚠️ **Ela vem ANTES das duas igualdades abaixo**, e a posição é conteúdo:
        // `instantesPublicados` é derivado de `ultimaExecucao` e de `historicoRecente` — os dois
        // eixos que as igualdades fixam em `null` e `[]`. Lida depois delas, a interseção seria
        // `[]` por necessidade, e o vazamento que ela existe para apanhar nunca a alcançaria
        // (AP-29). Aqui ela é falsificável, e as igualdades posteriores não perdem nada: a
        // interseção vazia não implica `ultimaExecucao` nula — uma implementação que inventasse
        // instante próprio de B reprovaria nelas.
        expect(
          instantesPublicados(corpo).filter((instante) => instantesEsperados.includes(instante)),
          'um instante da empresa A alcançou a resposta da empresa B',
        ).toEqual([]);

        // Nada de A alcança B: nem instante, nem resumo, nem item de histórico.
        expect(corpo.itens.map((estado) => estado.ultimaExecucao)).toEqual(
          ROTINAS_PUBLICADAS.map(() => null),
        );
        expect(corpo.itens.map((estado) => estado.historicoRecente)).toEqual(
          ROTINAS_PUBLICADAS.map(() => []),
        );
      }

      // ---------------------------------------------------------------------------------------
      // O PARÂMETRO NÃO MUDA NADA — igualdade profunda, sem o relógio
      // ---------------------------------------------------------------------------------------
      //
      // ⚠️ `proximaEsperada` sai do `now()` do servidor a cada requisição e varia legitimamente entre
      // duas delas — ver o cabeçalho deste arquivo para por que compará-la byte a byte tornaria o
      // caso não determinístico por construção. Ela é afirmada à parte, logo abaixo. Todo campo de
      // **alcance** entra na igualdade.
      expect(
        semORelogio(comCamelCase.corpo as EstadoDasRotinas),
        'o parâmetro `empresaId` mudou o que a rota devolve',
      ).toEqual(semORelogio(semParametro.corpo as EstadoDasRotinas));
      expect(
        semORelogio(comSnakeCase.corpo as EstadoDasRotinas),
        'o parâmetro `empresa_id` mudou o que a rota devolve',
      ).toEqual(semORelogio(semParametro.corpo as EstadoDasRotinas));

      // O relógio, à parte e nas três respostas: ISO-8601 e estritamente futuro. Sem estas linhas, a
      // comparação acima aceitaria qualquer coisa naquele campo.
      //
      // O eixo é `antesDosPedidosDeB`, tomado antes da PRIMEIRA das três requisições: ele é anterior
      // ao `now()` do banco de cada uma delas, e a derivação garante `proximaEsperada > now()` do
      // banco — a implicação é total e não depende de quanto tempo as três chamadas levaram.
      for (const resposta of [semParametro, comCamelCase, comSnakeCase]) {
        for (const estado of (resposta.corpo as EstadoDasRotinas).itens) {
          expect(estado.proximaEsperada).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u);
          expect(Date.parse(estado.proximaEsperada)).toBeGreaterThan(antesDosPedidosDeB);
        }
      }

      // E o controle positivo continua valendo DEPOIS das chamadas de B: nada do que B pediu apagou
      // o histórico de A. Sem esta linha, uma rota que zerasse o alcance de todo mundo passaria.
      expect(
        instantesDistintos(
          (await pedir(base, ROTA_DAS_ROTINAS, { cookie: cookieDeA })).corpo as EstadoDasRotinas,
        ),
      ).toEqual([...instantesEsperados].sort());
    },
    LIMITE_CASO_MS,
  );

  it(
    'CT-1093 — os três impedimentos vêm de fato já gravado, e a linha de controle devolve null nas três rotinas',
    async () => {
      // ---------------------------------------------------------------------------------------
      // O CONTROLE POSITIVO da varredura de vocabulário, ANTES de usá-la
      // ---------------------------------------------------------------------------------------
      //
      // Sem ele, uma varredura quebrada devolveria `[]` para qualquer texto, e todas as asserções de
      // "a mensagem não tem jargão de processo" passariam por vacuidade.
      expect(processoNaMensagem('violou constraint negocio.foo: null em jsonb')).toEqual([
        'null',
        'constraint',
        'negocio.',
        'jsonb',
      ]);

      const cenarioDeA = await montarCobrancaPorRotas(cookieDeA);

      // Cada linha escreve TODOS os eixos que ela afirma, de modo que o estado dela não depende da
      // anterior. A tabela nomeia o esperado **por rotina**, e a asserção é por igualdade profunda
      // do mapa inteiro: um impedimento que sumisse de uma rotina, ou que aparecesse noutra,
      // reprova nomeando a rotina.
      const linhas = [
        {
          nome: 'L1 · a régua desligada é o fato gravado',
          contexto: CONTEXTO_DE_A,
          cookie: () => cookieDeA,
          montar: async () => {
            await escreverPolitica(CONTEXTO_DE_A, REGUA_DESLIGADA);
          },
          esperado: {
            AVISO_DE_COBRANCA: 'REGUA_DESLIGADA',
            ENCERRAMENTO_DE_CONTRATOS: null,
            CONFERENCIA_DE_LIQUIDACAO: null,
          },
        },
        {
          nome: 'L2 · a ÚLTIMA tentativa foi recusada pelo provedor',
          contexto: CONTEXTO_DE_A,
          cookie: () => cookieDeA,
          montar: async () => {
            await escreverPolitica(CONTEXTO_DE_A, REGUA_LIGADA);
            await semearTentativa(cenarioDeA, 'FALHOU');
          },
          esperado: {
            AVISO_DE_COBRANCA: 'AVISOS_RECUSADOS_PELO_PROVEDOR',
            ENCERRAMENTO_DE_CONTRATOS: null,
            CONFERENCIA_DE_LIQUIDACAO: null,
          },
        },
        {
          nome: 'L3 · não há certificado do provedor vigente',
          contexto: CONTEXTO_DE_B,
          cookie: () => cookieDeB,
          montar: async () => {
            await escreverPolitica(CONTEXTO_DE_B, REGUA_LIGADA);
          },
          esperado: {
            AVISO_DE_COBRANCA: null,
            ENCERRAMENTO_DE_CONTRATOS: null,
            CONFERENCIA_DE_LIQUIDACAO: 'INTEGRACAO_BANCARIA_PENDENTE',
          },
        },
        {
          nome: 'L4 · CONTROLE — a entrega posterior limpa a recusa, e nada impede',
          contexto: CONTEXTO_DE_A,
          cookie: () => cookieDeA,
          montar: async () => {
            await escreverPolitica(CONTEXTO_DE_A, REGUA_LIGADA);
            // A recusa **antes** e a entrega **depois**: é o par que discrimina *"a última
            // tentativa"* de *"existe alguma recusa"*. Um predicado `EXISTS (… FALHOU …)` passa na
            // L2 e reprova aqui, que é exatamente o defeito que esta linha existe para apanhar.
            await semearTentativa(cenarioDeA, 'FALHOU');
            await semearTentativa(cenarioDeA, 'ENVIADA');
          },
          esperado: {
            AVISO_DE_COBRANCA: null,
            ENCERRAMENTO_DE_CONTRATOS: null,
            CONFERENCIA_DE_LIQUIDACAO: null,
          },
        },
      ] as const;

      // A sanidade da tabela, antes de percorrê-la: uma tabela truncada faria o laço passar sobre
      // menos linhas do que o caso declara, e nada acusaria.
      expect(linhas.length).toBe(4);

      for (const linha of linhas) {
        await linha.montar();

        const resposta = await pedir(base, ROTA_DAS_ROTINAS, { cookie: linha.cookie() });

        expect(resposta.status, `${linha.nome} não respondeu 200`).toBe(200);

        const corpo = resposta.corpo as EstadoDasRotinas;

        // ⚠️ **O que é mais fraco vem ANTES do mapa**, e a ordem deste bloco é conteúdo. O mapa
        // abaixo fixa o `codigo` de cada rotina contra um literal da tabela — e os três literais da
        // tabela SÃO os três de `CODIGOS_DE_IMPEDIMENTO`, de modo que a pertinência à união, lida
        // depois dele, passaria por necessidade: o código inventado que ela diz perseguir morreria
        // no mapa, e nenhum estado do SUT a faria reprovar (AP-29). O mesmo vale para a varredura de
        // vocabulário diante da igualdade da mensagem. Aqui as duas são falsificáveis, e o mapa
        // posterior não perde nada — pertencer à união não diz QUAL rotina carrega QUAL código.
        for (const estado of corpo.itens) {
          if (estado.impedimento === null) {
            continue;
          }

          // O código vem do CONTRATO, e não de um literal do teste: um código que a implementação
          // inventasse fora da união fechada reprova aqui, nomeando o código.
          expect(
            CODIGOS_DE_IMPEDIMENTO,
            `${linha.nome} publicou código fora da união fechada do contrato`,
          ).toContain(estado.impedimento.codigo);
          // A mensagem não carrega jargão de processo (RD-19, ADR-0034) — e esta varredura vem ANTES
          // da igualdade abaixo pela mesma razão que a pertinência vem antes do mapa: os três textos
          // de `MENSAGEM_POR_IMPEDIMENTO` são escritos à mão e sabidamente livres do vocabulário, de
          // modo que a varredura lida depois da igualdade devolveria `[]` por necessidade. É a mesma
          // classe que a `DECISÃO FECHADA` do `CT-1091` fecha, e o Gate 1 já a reprovou aqui na
          // rodada 1, na forma de um `length > 0` posterior.
          expect(
            processoNaMensagem(estado.impedimento.mensagem),
            `${linha.nome} publicou vocabulário de processo na mensagem do Admin`,
          ).toEqual([]);
          // E a mensagem é a que o Admin lê, comparada por igualdade contra o texto escrito à mão.
          // ⚠️ **Nada mais fraco sobre a mensagem DEPOIS desta linha.**
          expect(estado.impedimento.mensagem).toBe(
            MENSAGEM_POR_IMPEDIMENTO[estado.impedimento.codigo],
          );
        }

        // O mapa INTEIRO por igualdade profunda: valor e ausência, rotina a rotina.
        expect(
          Object.fromEntries(
            corpo.itens.map((estado) => [estado.rotina, estado.impedimento?.codigo ?? null]),
          ),
          `${linha.nome} publicou impedimento diferente do fato gravado`,
        ).toEqual(linha.esperado);
      }

      // ---------------------------------------------------------------------------------------
      // A LINHA DE CONTROLE, afirmada à parte: o conjunto de códigos presentes é VAZIO
      // ---------------------------------------------------------------------------------------
      //
      // Ela é obrigatória: sem ela, um serviço que devolvesse impedimento SEMPRE passaria nas três
      // linhas acima. O estado dela é o que a L4 acabou de escrever, e a leitura é refeita para que
      // esta asserção não dependa do corpo capturado no laço.
      const controle = (await pedir(base, ROTA_DAS_ROTINAS, { cookie: cookieDeA }))
        .corpo as EstadoDasRotinas;

      // O CONJUNTO DE CÓDIGOS PRESENTES, primeiro: ele é o mais fraco dos dois, e a falha dele nomeia
      // o código que sobrou. ⚠️ Lido **depois** da igualdade abaixo, ele seria `[]` por necessidade —
      // ela fixa todo `impedimento` em `null`, e o `flatMap` de uma lista de nulos não tem o que
      // produzir (AP-29). Nesta posição ele reprova de fato; e a igualdade posterior não perde nada,
      // porque conjunto vazio não prende a ARIDADE da resposta, que é o que ela também afirma.
      expect(
        controle.itens.flatMap((estado) =>
          estado.impedimento === null ? [] : [estado.impedimento.codigo],
        ),
        'a linha de controle publicou impedimento onde nada impede',
      ).toEqual([]);

      expect(controle.itens.map((estado) => estado.impedimento)).toEqual(
        ROTINAS_PUBLICADAS.map(() => null),
      );
    },
    LIMITE_CASO_MS,
  );

  it(
    'CT-1094 — sem sessão é 401 e sem a área é 403, com o envelope INTEIRO da ADR-0017',
    async () => {
      // --- As TRÊS recusas, pedidas antes de qualquer igualdade de envelope -----------------------
      //
      // ⚠️ **A ordem deste caso é conteúdo.** As igualdades de envelope lá embaixo fixam cada corpo
      // por extenso, e `corpo` é `JSON.parse(texto)`: passada a igualdade, o texto é a serialização
      // daquele objeto exato e não PODE conter um identificador de empresa nem a chave `itens`. As
      // asserções de não-vazamento, lidas depois delas, passariam por necessidade — o vazamento que
      // elas existem para apanhar morreria antes, na igualdade (AP-29). Por isso elas vêm primeiro,
      // e as três requisições sobem para cá. As igualdades posteriores não perdem nada: ausência de
      // identificador não implica envelope canônico — o `{ statusCode, error, message }` do
      // arcabouço passa na varredura e reprova nelas.
      const semSessao = await pedir(base, ROTA_DAS_ROTINAS);
      const cookieForjado = await pedir(base, ROTA_DAS_ROTINAS, {
        cookie: `__Secure-sysloc.${SUFIXO_DO_COOKIE_DE_SESSAO}=token-que-nunca-existiu`,
      });
      // A diferença entre os dois `401` e o `403` desta é o que prova que a sessão é real: uma sessão
      // forjada, ou uma guarda desligada, não produziria os dois status distintos.
      const semAArea = await pedir(base, ROTA_DAS_ROTINAS, { cookie: cookieSemAArea });

      expect(semSessao.status).toBe(401);
      expect(cookieForjado.status).toBe(401);
      expect(semAArea.status).toBe(403);

      // Nenhum dos três corpos vaza identificador de empresa, e nenhum traz `itens`: a recusa
      // acontece ANTES de a rota ler coisa alguma. O rótulo é o que faz a falha nomear qual recusa
      // vazou, em vez de dizer só que alguma vazou.
      for (const [rotulo, resposta] of [
        ['sem cookie', semSessao],
        ['com cookie forjado', cookieForjado],
        ['sem a área', semAArea],
      ] as const) {
        expect(
          resposta.texto,
          `a recusa ${rotulo} vazou o identificador da empresa A`,
        ).not.toContain(EMPRESA_A.id);
        expect(
          resposta.texto,
          `a recusa ${rotulo} vazou o identificador da empresa B`,
        ).not.toContain(EMPRESA_B.id);
        expect(resposta.corpo, `a recusa ${rotulo} devolveu itens`).not.toHaveProperty('itens');
      }

      // --- Sem cookie: o envelope INTEIRO ---------------------------------------------------------
      //
      // O objeto INTEIRO: o formato padrão do arcabouço HTTP (`{ statusCode, error, message }`)
      // passaria numa asserção que só conferisse o status, e é ele que a ADR-0017 existe para não
      // deixar sair. **Sem `detalhes`** — não há exigência a nomear a quem não tem sessão.
      expect(semSessao.corpo).toEqual({
        codigo: CodigoErro.NAO_AUTENTICADO,
        mensagem: MENSAGEM_SEM_SESSAO,
      });

      // --- Cookie forjado: EXATAMENTE o mesmo -----------------------------------------------------
      expect(cookieForjado.corpo).toEqual({
        codigo: CodigoErro.NAO_AUTENTICADO,
        mensagem: MENSAGEM_SEM_SESSAO,
      });
      // Byte a byte: nada revela que um token existiu ou deixou de existir. Ela NÃO é implicada pelas
      // duas igualdades acima — dois corpos com o mesmo objeto interpretado podem diferir na ordem
      // das chaves e no espaçamento, e é justamente o texto servido que o cliente compara.
      expect(cookieForjado.texto).toBe(semSessao.texto);

      // --- Sessão VÁLIDA sem a área ---------------------------------------------------------------
      expect(semAArea.corpo).toEqual({
        codigo: CodigoErro.ACESSO_NEGADO,
        mensagem: MENSAGEM_DE_ACESSO_NEGADO,
        // `detalhes.exigido` nomeia a exigência ausente, e ela é a ÁREA — a que a CLASSE declara.
        // Uma rota que tivesse declarado uma chave de ação no método publicaria outro valor aqui, e
        // esta igualdade a reprovaria nomeando o que ela pediu.
        detalhes: { exigido: AREA_DA_AUTOMACAO_DE_COBRANCA },
      });

      // --- CONTROLE POSITIVO ----------------------------------------------------------------------
      //
      // Ele separa "`403` porque falta a área" de "`403` porque a rota está quebrada".
      const comAArea = await pedir(base, ROTA_DAS_ROTINAS, { cookie: cookieDeA });

      expect(comAArea.status).toBe(200);
      expect((comAArea.corpo as EstadoDasRotinas).itens.map((estado) => estado.rotina)).toEqual([
        ...ROTINAS_PUBLICADAS,
      ]);
    },
    LIMITE_CASO_MS,
  );
});

/** A entrada de uma rotina no corpo publicado — levanta quando ela não está lá. */
function entradaDe(corpo: EstadoDasRotinas, rotina: RotinaPublicada): EstadoDeRotina {
  const encontrada = corpo.itens.find((estado) => estado.rotina === rotina);

  if (encontrada === undefined) {
    throw new Error(`a resposta não trouxe a rotina ${rotina}`);
  }

  return encontrada;
}

/** Todo instante de passagem que o corpo publica — a última execução e cada item do histórico. */
function instantesPublicados(corpo: EstadoDasRotinas): string[] {
  return corpo.itens.flatMap((estado) => [
    ...(estado.ultimaExecucao === null ? [] : [estado.ultimaExecucao]),
    ...estado.historicoRecente.map((passagem) => passagem.ocorridaEm),
  ]);
}

/** Os instantes publicados, sem repetição e em ordem crescente — a forma comparável do alcance. */
function instantesDistintos(corpo: EstadoDasRotinas): string[] {
  return [...new Set(instantesPublicados(corpo))].sort();
}

/**
 * O corpo publicado **sem o campo derivado do relógio do servidor**.
 *
 * Ver o cabeçalho deste arquivo para por que `proximaEsperada` fica de fora da comparação entre duas
 * requisições, e onde ela é afirmada à parte. Todo o resto — inclusive **todo** campo por onde dado
 * de outra empresa poderia atravessar — permanece na igualdade profunda.
 */
function semORelogio(corpo: EstadoDasRotinas): unknown {
  return corpo.itens.map(({ proximaEsperada: _relogio, ...resto }) => resto);
}

/** Que termos de processo aparecem na mensagem — lista, e não booleano, para nomear o achado. */
function processoNaMensagem(mensagem: string): string[] {
  const texto = mensagem.toLowerCase();

  return VOCABULARIO_DE_PROCESSO.filter((termo) => texto.includes(termo));
}

/**
 * Executa o trabalho sob o contexto informado, dentro de **uma** unidade de trabalho.
 *
 * É o par `executarCom` + `emUnidadeDeTrabalho` — o mesmo que a guarda e o controlador usam em
 * operação, e o **único** caminho por onde o arranjo deste arquivo alcança o banco. Ele não emite
 * `SET LOCAL` nem toca a variável de sessão: quem a fixa é o escritor único de
 * `packages/db/src/unidade-de-trabalho.ts`, sob duas `DECISÃO FECHADA`, e um atalho escrito aqui seria
 * o contorno que o `CT-624 (b)` varre nominalmente.
 *
 * Os dois símbolos vêm do **barril** (`@sysloc/db`), e não do fonte: é o barril que a aplicação sob
 * teste carrega, e misturar as duas instâncias do módulo de contexto é o defeito que o cabeçalho
 * deste arquivo mede.
 */
async function emUnidade<T>(
  contexto: Contexto,
  trabalho: (tx: TransactionSql) => Promise<T>,
): Promise<T> {
  return await contextoDeTenant.executarCom(
    contexto,
    async () => await acessoAoNegocio.emUnidadeDeTrabalho(trabalho),
  );
}

/** Quantos minutos se passaram desde o instante informado, pelo relógio deste processo. */
function idadeEmMinutos(instante: Date): number {
  const MS_POR_MINUTO = 60_000;

  return (Date.now() - instante.getTime()) / MS_POR_MINUTO;
}

/**
 * Grava **uma** passagem com efeito, em unidade de trabalho **própria**.
 *
 * A unidade própria é conteúdo, e não estilo: `ocorrida_em` é o `DEFAULT now()` da coluna, e `now()`
 * é `transaction_timestamp()` — duas gravações na mesma transação receberiam o **mesmo** instante, e
 * a ordem decrescente do histórico ficaria empatada. É a porta de produção, a mesma que a rotina usa.
 */
async function semearPassagem(
  contexto: Contexto,
  rotina: RotinaPublicada,
  resumo: Readonly<Record<string, number>>,
): Promise<void> {
  await emUnidade(contexto, async (tx) => {
    await registrarExecucaoDeRotina(tx, { rotina, resumo });
  });
}

/**
 * Os instantes gravados na empresa do contexto, em ordem **crescente**.
 *
 * A leitura é crua e **não** passa por `lerEstadoDasRotinas`: derivar o esperado da mesma função que
 * o SUT chama faria a asserção concordar consigo mesma. Não há `WHERE empresa_id`: quem recorta é a
 * política de linha (ADR-0008).
 */
async function lerInstantesGravados(contexto: Contexto): Promise<readonly Date[]> {
  return await emUnidade(contexto, async (tx) => {
    const linhas = await tx<{ ocorridaEm: Date }[]>`
      SELECT ocorrida_em AS "ocorridaEm"
        FROM negocio.execucao_de_rotina
       ORDER BY ocorrida_em
    `;

    return linhas.map((linha) => linha.ocorridaEm);
  });
}

/**
 * A contagem **crua** de passagens da empresa do contexto.
 *
 * Sem recorte escrito aqui: a empresa entra pelo **contexto**, que é o mesmo mecanismo que a
 * aplicação usa, e quem recorta é a política (ADR-0008).
 */
async function contarPassagens(contexto: Contexto): Promise<number> {
  return await emUnidade(contexto, async (tx) => {
    const [linha] = await tx<{ total: string }[]>`
      SELECT count(*)::text AS total FROM negocio.execucao_de_rotina
    `;

    return Number(linha?.total ?? '-1');
  });
}

/** Escreve a política de aviso da empresa do contexto, por instrução própria e não pelo SUT. */
async function escreverPolitica(contexto: Contexto, politica: PoliticaDeAvisoNova): Promise<void> {
  await emUnidade(contexto, async (tx) => {
    await semearPoliticaDeAviso(tx, politica);
  });
}

/**
 * Grava **uma** tentativa de aviso sobre a cobrança do cenário, pela porta de produção.
 *
 * É `registrarEnvioDeCobranca`, e não um `INSERT` cru: é o mesmo caminho que a régua usa, e é ele que
 * propõe o `empresa_id` do contexto e deixa `criado_em` com o `now()` do banco. A `causa` é pareada
 * com o desfecho pelo critério que o próprio banco impõe — a bicondicional de
 * `envio_de_cobranca_causa_chk` recusaria o par incoerente, e o arranjo morreria longe da causa.
 */
async function semearTentativa(
  cenario: CobrancaMontada,
  desfecho: 'ENVIADA' | 'FALHOU',
): Promise<void> {
  await emUnidade(cenario.contexto, async (tx) => {
    await registrarEnvioDeCobranca(tx, {
      cobrancaCodigo: cenario.cobrancaCodigo,
      caminho: 'AUTOMATICO',
      desfecho,
      destinatario: cenario.destinatarioDoLocatario,
      causa: desfecho === 'FALHOU' ? CAUSA_DA_RECUSA : null,
    });
  });
}

/**
 * Registra um certificado **vigente** na empresa do contexto, pela porta de produção.
 *
 * As duas datas de validade saem de `negocio.data_corrente_da_operacao()` deslocada **no SQL**
 * (ADR-0026): compostas em JavaScript, o arranjo mediria a diferença entre dois relógios, e a
 * vigência é justamente o que a derivação do impedimento compara. O material é de arranjo — a coluna
 * guarda o **cifrado**, e este módulo não sabe o que há dentro dele (ADR-0032).
 */
async function registrarCertificadoVigente(
  contexto: Contexto,
  registradoPor: string,
): Promise<void> {
  const validoDe = await instanteEmDias(contexto, DIAS_DESDE_A_EMISSAO);
  const validoAte = await instanteEmDias(contexto, DIAS_ATE_O_VENCIMENTO);

  await emUnidade(contexto, async (tx) => {
    await registrarCertificado(tx, {
      titular: 'Imobiliária do arranjo das rotinas',
      validoDe,
      validoAte,
      impressaoDigital: 'aa:bb:cc:dd:ee:ff',
      segredoCifrado: 'envelope-cifrado-de-teste',
      registradoPor,
    });
  });
}

/** A data corrente da operação deslocada em `dias`, como instante — composta pelo **banco**. */
async function instanteEmDias(contexto: Contexto, dias: number): Promise<Date> {
  return await emUnidade(contexto, async (tx: TransactionSql) => {
    const [linha] = await tx<{ instante: Date }[]>`
      SELECT (negocio.data_corrente_da_operacao()
                + make_interval(days => ${dias}::integer))::timestamptz AS instante
    `;

    if (linha === undefined) {
      throw new Error('o banco não devolveu a data corrente da operação deslocada');
    }

    return linha.instante;
  });
}

// ---------------------------------------------------------------------------------------------
// A cadeia da cobrança — montada pelas ROTAS REAIS do produto (Iron Law #6, preferência (b))
// ---------------------------------------------------------------------------------------------

/** Um contador local, para que cada cadastro do cenário nasça com identificador único. */
let sequencial = 0;

function proximo(): number {
  sequencial += 1;

  return sequencial;
}

/** O valor de toda parcela do cenário — nenhum caso deste arquivo mede dinheiro. */
const VALOR_DA_PARCELA = 1500;

/** Quantos dias à frente vence a cobrança do cenário — longe de qualquer borda de vencimento. */
const DIAS_ATE_O_VENCIMENTO_DA_PARCELA = 30;

/** O que a cadeia devolve — o suficiente para gravar uma tentativa de aviso por cima. */
interface CobrancaMontada {
  /** A empresa sob a qual o cenário foi montado. */
  readonly contexto: Contexto;
  /** O código legível da cobrança — a chave que `registrarEnvioDeCobranca` recebe. */
  readonly cobrancaCodigo: string;
  /** O endereço do locatário, que é o destinatário natural de um aviso. */
  readonly destinatarioDoLocatario: string;
}

/**
 * Monta conjunto, imóvel, locador, locatário, contrato **ativo** e uma cobrança, **pelas rotas**.
 *
 * ⚠️ **É o caminho legítimo de maior nível** (Iron Law #6, preferência (b)): cada passo atravessa a
 * conferência de entrada, a guarda de autorização e a contabilidade das séries do produto. É a mesma
 * cadeia, pelas mesmas rotas, de `./automacao-de-cobranca.e2e.spec.ts` — ver o cabeçalho deste
 * arquivo para por que o auxiliar de `packages/db/test/` não é importável daqui.
 *
 * `gerarCobrancasAutomaticamente: false` é conteúdo, e não conveniência: a ativação com `true`
 * derivaria as parcelas do contrato inteiro, e o que este arquivo precisa é de **uma** cobrança
 * identificável sobre a qual gravar tentativas.
 *
 * Toda falha levanta nomeando o status e o corpo — sem isso, o defeito do arranjo apareceria como um
 * impedimento inesperado três passos adiante da causa.
 */
async function montarCobrancaPorRotas(credencial: string): Promise<CobrancaMontada> {
  const conjuntoId = (
    await criarPorRota(CAMINHO_DOS_CONJUNTOS, { nome: `Edifício ${String(proximo())}` }, credencial)
  ).id;
  const imovelId = (await criarPorRota(CAMINHO_DOS_IMOVEIS, corpoDeImovel(conjuntoId), credencial))
    .id;
  const locadorId = (await criarPorRota(CAMINHO_DOS_LOCADORES, corpoDePessoa(), credencial)).id;
  const locatario = corpoDePessoa();
  const locatarioId = (await criarPorRota(CAMINHO_DOS_LOCATARIOS, locatario, credencial)).id;

  const contrato = await criarPorRota(
    CAMINHO_DOS_CONTRATOS,
    {
      imovelId,
      locadorId,
      locatarioId,
      fiadoresIds: [],
      dataInicioLocacao: '2026-01-10',
      prazoMeses: 30,
      valorMensal: VALOR_DA_PARCELA,
      diaVencimento: 10,
      gerarCobrancasAutomaticamente: false,
    },
    credencial,
  );

  const contratoCodigo = (contrato as { codigo?: string }).codigo;

  if (contratoCodigo === undefined) {
    throw new Error('a montagem do contrato não devolveu código legível');
  }

  const ativacao = await pedir(
    base,
    `/${PREFIXO_DE_VERSAO}/${CAMINHO_DOS_CONTRATOS}/${contratoCodigo}/ativacao`,
    { metodo: 'POST', cookie: credencial, corpo: {} },
  );

  if (ativacao.status !== 200) {
    throw new Error(
      `a ativação de ${contratoCodigo} respondeu ${String(ativacao.status)}: ${ativacao.texto}`,
    );
  }

  const datas = await datasDoLancamento(DIAS_ATE_O_VENCIMENTO_DA_PARCELA);
  const cobranca = await criarPorRota(
    CAMINHO_DAS_COBRANCAS,
    {
      contratoCodigo,
      natureza: 'ALUGUEL',
      referencia: 'Aluguel do cenário das rotinas',
      competencia: datas.competencia,
      dataVencimento: datas.vencimento,
      valorOriginal: VALOR_DA_PARCELA,
    },
    credencial,
  );

  const cobrancaCodigo = (cobranca as { codigo?: string }).codigo;

  if (cobrancaCodigo === undefined) {
    throw new Error('o lançamento da cobrança não devolveu código legível');
  }

  return {
    contexto: CONTEXTO_DE_A,
    cobrancaCodigo,
    destinatarioDoLocatario: locatario.email as string,
  };
}

/** Cria um recurso pela rota real e devolve o corpo publicado. A falha levanta. */
async function criarPorRota(
  dono: string,
  corpo: Record<string, unknown>,
  credencial: string,
): Promise<{ id: string }> {
  const alvo = `/${PREFIXO_DE_VERSAO}/${dono}`;
  const resposta = await pedir(base, alvo, { metodo: 'POST', cookie: credencial, corpo });

  if (resposta.status !== 201) {
    throw new Error(`a criação em ${alvo} respondeu ${String(resposta.status)}: ${resposta.texto}`);
  }

  return resposta.corpo as { id: string };
}

/** O corpo completo de um imóvel, com o identificador municipal único por construção. */
function corpoDeImovel(conjuntoId: string): Record<string, unknown> {
  const marca = String(proximo()).padStart(6, '0');

  return {
    conjuntoId,
    nomeImovel: `Ap ${marca}`,
    identificadorMunicipal: `IM-${marca}`,
    tipoImovel: 'RESIDENCIAL',
    logradouro: 'Rua das Acácias',
    numero: '100',
    complemento: null,
    bairro: 'Centro',
    cidade: 'São Paulo',
    estado: 'SP',
    cep: '01000000',
    statusLocacao: 'DISPONIVEL',
    observacoes: null,
  };
}

/** O corpo completo de um cadastro de pessoa, com documento e endereço de contato únicos. */
function corpoDePessoa(): Record<string, unknown> {
  const numero = proximo();
  const marca = String(numero).padStart(6, '0');

  return {
    nome: `Parte ${marca}`,
    tipoPessoa: 'PESSOA_FISICA',
    documentoPrincipal: cpfValido(numero),
    rg: null,
    email: `parte.${marca}@exemplo.com.br`,
    telefone: '11999990000',
    logradouro: 'Rua das Acácias',
    numero: '100',
    complemento: null,
    bairro: 'Centro',
    cidade: 'São Paulo',
    estado: 'SP',
    cep: '01000000',
  };
}

/**
 * A competência e o vencimento do lançamento, deslocados a partir do **relógio do banco**.
 *
 * Compostas em JavaScript, elas fariam o arranjo medir a diferença entre dois relógios (ADR-0026), e
 * o vencimento é justamente o eixo pelo qual a cobrança é derivada.
 */
async function datasDoLancamento(
  dias: number,
): Promise<{ readonly competencia: string; readonly vencimento: string }> {
  return await emUnidade(CONTEXTO_DE_A, async (tx) => {
    const [linha] = await tx<{ competencia: string; vencimento: string }[]>`
      SELECT to_char(
               date_trunc(
                 'month',
                 negocio.data_corrente_da_operacao() + make_interval(days => ${dias}::integer)
               ),
               'YYYY-MM-DD'
             ) AS competencia,
             to_char(
               negocio.data_corrente_da_operacao() + make_interval(days => ${dias}::integer),
               'YYYY-MM-DD'
             ) AS vencimento
    `;

    if (linha === undefined) {
      throw new Error('o relógio do banco não devolveu as datas do lançamento');
    }

    return linha;
  });
}
