/**
 * As **duas rotas da entrega da notícia do provedor** — T7 da fatia `integracao-bancaria-autonoma`:
 * ativar (cadastrar→confirmar) e consultar o estado persistido.
 *
 * ---------------------------------------------------------------------------
 * INVARIANTES
 * ---------------------------------------------------------------------------
 *
 * | Critério | Caso | Invariante |
 * |---|---|---|
 * | CA-01 | CT-1025 | A ativação com os **dois** positivos responde `200` (nunca `201`) com
 * | CA-03 |         | `habilitada: true` e `motivo: null`, e o `GET` **com o par DERRUBADO**
 * |       |         | devolve o mesmo corpo por igualdade profunda, com o contador de conexões
 * |       |         | **exatamente igual** ao de antes: a consulta não fala com o provedor. |
 * | CA-01 | CT-1026 | **Um positivo só não basta**, e o caso o prende nos DOIS eixos. (a) Cadastro
 * | CA-03 |         | que o provedor **não responde** ⟹ `200`, `cadastro` **1** e `consulta` **0**
 * | CA-04 |         | — a confirmação não chega a ser alcançada —, e o **estado anterior
 * |       |         | permanece** íntegro. (b) Cadastro **ACEITO** com confirmação **negativa** ⟹
 * |       |         | `200` com `habilitada: false`, `cadastro` **1**, `consulta` **1** e o `motivo`
 * |       |         | **que a CONFIRMAÇÃO emitiu** por igualdade profunda. É (b) que separa a regra
 * |       |         | de uma disjunção, e é de (b) — e não de (a) — que vem o **CA-04** desta linha. |
 * | CA-02 | CT-1028 | Duas empresas ativam independentemente: as agulhas do motivo de A **não
 * | CA-04 |         | aparecem** em resposta alguma de B, por varredura com controle positivo. |
 * | CA-03 | CT-1029 | A consulta responde nos **três** estados, com o discriminador de *"nunca
 * | CA-19 |         | houve tentativa"* (`verificadaEm: null`), e **nenhum** deles é `404`. |
 * | CA-04 | CT-1030 | O `motivo` publicado é **igual por igualdade profunda** ao que o provedor
 * |       |         | emitiu, com acentuação preservada e o conjunto de chaves coincidente. |
 * | CA-04 | CT-1031 | **Quatro** motivos degenerados produzem status, estado e forma de corpo
 * |       |         | idênticos entre si — o motivo **não decide nada** —, e a chave plantada
 * |       |         | em `__proto__` não alcança o protótipo de objeto. |
 * | CA-05 | CT-1034 | O desfecho novo **substitui** o anterior: a agulha antiga some do corpo
 * |       |         | (varredura com controle positivo e âncora antivácuo), e a contagem crua
 * |       |         | de linhas do estado é **igual** à de antes. |
 * | CA-05 | CT-1035 | Cadastro **recusado** com consulta positiva ⟹ `habilitada: true`, com
 * |       |         | `cadastro` **1** e `consulta` **1**: a confirmação FOI alcançada. |
 * | CA-07 | CT-1036 | Vaga ocupada por **terceiro**: recusa informada, o mapa inteiro de métodos
 * |       |         | mutantes vale `{ put: 0, patch: 0, remocao: 0, substituicao: 0 }`, e o
 * |       |         | cadastro alheio é **idêntico** ao de antes por igualdade profunda. |
 * | CA-08 | CT-1037 | Sem a permissão, as **quatro** chamadas (2 rotas × 2 sessões deficientes)
 * |       |         | respondem `403` com o envelope INTEIRO nomeando a **primeira** exigência
 * |       |         | ausente; conexões ao par **`0`** e contagem de linhas inalterada. |
 * | CA-01 | CT-1047 | As **três** recusas de pré-condição — certificado ausente, validade
 * |       |         | encerrada e identidade ausente — são distintas, com `detalhes`
 * |       |         | discriminante, **sem `campo`**, **não `404`**, e com **zero** conexões. |
 *
 * Rastreabilidade: `CA-01 → CT-1025, CT-1026, CT-1047 (RN-01)` · `CA-02 → CT-1028 (RN-03)` ·
 * `CA-03 → CT-1025, CT-1026, CT-1029 (RN-01)` · `CA-04 → CT-1026, CT-1028, CT-1030, CT-1031 (RN-02)` ·
 * `CA-05 → CT-1034, CT-1035 (RN-04, RN-05)` · `CA-07 → CT-1036 (RN-07)` · `CA-08 → CT-1037 (RN-08)` ·
 * `CA-19 → CT-1029`.
 *
 * ⚠️ **As âncoras de superfície NÃO vivem aqui** — elas vivem no `CT-1038`, em
 * `./cobertura-de-autorizacao.e2e.spec.ts`, para não duplicar cross-layer o que aquela suíte já
 * afirma por igualdade de conjunto.
 *
 * ⚠️ **A justificativa da autorização apoia-se em ADR-0011 + ADR-0018.** A ADR-0021 **não** é
 * invocada em oração normativa alguma deste arquivo: o marcador `DECISÃO FECHADA — T12` de
 * `apps/api/src/integracoes-bancarias/certificado.controller.ts` fixa isso para toda rota desta
 * superfície, o achado já voltou por caminho novo uma vez, e o `REVERTER EXIGE` dele é uma **emenda
 * da própria 0021** — escalada ao usuário, nunca decisão de gate ou de executor.
 *
 * ===========================================================================
 * O PAR DO PROVEDOR É REAL, e o que se substitui é o DESTINO
 * ===========================================================================
 *
 * Cada caso sobe um **par TLS mútuo de verdade** em porta dinâmica do laço local, importado da casa
 * compartilhada `./par-do-provedor.ts`, e a porta de entrega que a aplicação recebe **constrói o
 * adaptador de produção** apontado para ele. Nada da lógica sob prova é dublado: TLS mútuo real,
 * cliente por chamada real, teto real, credencial concedida pelo par real. Se fosse dublado, o
 * `habilitada: true` deste arquivo não significaria nada.
 *
 * A substituição entra por `overrideProvider(TOKEN_PORTA_DE_ENTREGA_DA_NOTICIA)`, pelo mecanismo do
 * arcabouço de teste, e **não** por caminho aberto no código de produção: `criarAplicacao()` não
 * ganhou parâmetro, nada em `apps/api/src` ganhou bandeira ou ramo `if (ehTeste)`, e o provedor de
 * produção continua sendo o único caminho pelo qual a aplicação real escolhe adaptador.
 *
 * ===========================================================================
 * ARQUIVO NOVO, e a separação é justificada
 * ===========================================================================
 *
 * `certificado-do-provedor.e2e.spec.ts` é do certificado e da identidade; engordá-la com a entrega da
 * notícia misturaria recursos com **ciclos de vida distintos** — o certificado vale um ano e é
 * substituído inteiro, a identidade não muda com a renovação, e a entrega é estado reescrito a cada
 * tentativa. Aquele arquivo é **somente leitura** nesta task.
 *
 * ⚠️ **Duas divergências declaradas** (`.claude/rules/autonomia-do-run.md`, A1), as duas
 * conservadoras e registradas por escrito:
 *
 * 1. **`envelhecerOVigente` é declarado aqui, e não importado.** O card manda importá-lo de
 *    `./certificado-do-provedor.e2e.spec.ts`, e ele **não é exportado** de lá — nem poderia ser
 *    consumido: importar de um arquivo `.spec.ts` executa o módulo dele, e os ~30 casos daquela suíte
 *    passariam a ser registrados **dentro deste arquivo**. O caminho legítimo é o mesmo, byte a byte:
 *    a linha é retroagida **sob contexto de tenant, no eixo do banco**, e nunca por relógio falso.
 *    Esta é a **segunda** escrita da função; o Limiar de Três dispara na terceira.
 * 2. **O `CT-1026` mede o cadastro que o provedor NÃO RESPONDEU**, e não o *"recusado por razão que
 *    não é vaga ocupada"* do card. Os dois cenários do card — este e o `CT-1035` — só se distinguem
 *    lendo **o código da recusa**, e o modelo canônico da porta proíbe por escrito *"qualquer ramo
 *    que compare `codigo`"*. A invariante que o caso carrega é preservada integralmente: *a
 *    confirmação não chega a ser alcançada*, com `consulta` exatamente `0` contra o `1` do `CT-1035`
 *    — o par que prende a regra nos dois sentidos continua sendo o par. A razão longa está no
 *    docblock de `entrega-da-noticia.service.ts`.
 */

import { randomBytes, randomUUID } from 'node:crypto';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import {
  criarAdaptadorSicoob,
  type EntregaParaCadastrar,
  type LeituraDaEntrega,
  type PortaDeEntregaDaNoticia,
  type ResultadoDaOperacaoDeEntrega,
} from '@sysloc/cobranca-bancaria';
import {
  type AcessoAoBanco,
  abrirAcessoAoBanco,
  contextoDeTenant,
  EMPRESA_A,
  EMPRESA_B,
  SENHA_DA_CARGA,
} from '@sysloc/db';
import { CodigoErro } from '@sysloc/shared';
import type { EstadoDaEntrega } from '@syslocbr/contracts';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  type IdentidadeEfemera,
  identidadeEfemera,
} from '../../../packages/auth/test/identidade-efemera.ts';
import {
  type AutoridadeDeTeste,
  gerarAutoridadeDeTeste,
  gerarMaterialDeTeste,
} from '../../../packages/cobranca-bancaria/test/material-de-teste.ts';
import { reservarPorta } from '../../../packages/shared/test/efemero-comum.ts';
import { type FilaEfemera, redisEfemero } from '../../../packages/shared/test/redis-efemero.ts';
import { AppModule } from '../src/app.module.ts';
import { PREFIXO_DAS_ROTAS_DE_IDENTIDADE } from '../src/autenticacao/autenticacao.module.ts';
import { CAMINHO_DA_TROCA_DE_SENHA_DO_PRODUTO } from '../src/autenticacao/senha.controller.ts';
import {
  PREFIXO_DE_VERSAO,
  TOKEN_PORTA_DE_ENTREGA_DA_NOTICIA,
} from '../src/configuracao/ambiente.ts';
import {
  CAMINHO_DAS_INTEGRACOES_BANCARIAS,
  SEGMENTO_DO_REGISTRO,
} from '../src/integracoes-bancarias/certificado.controller.ts';
import {
  SEGMENTO_DA_ATIVACAO,
  SEGMENTO_DA_ENTREGA_DA_NOTICIA,
} from '../src/integracoes-bancarias/entrega-da-noticia.controller.ts';
import { SEGMENTO_DA_IDENTIDADE } from '../src/integracoes-bancarias/identidade.controller.ts';
import { CAMINHO_DO_MASTER } from '../src/master/empresa.controller.ts';
import {
  conceder,
  credencialDeSessao,
  entrar,
  entrarComSegundoFatorCumprido,
  pedir,
} from './acessorios-de-borda.ts';
import {
  confiarEm,
  corpoDeCadastroDeOutroEndereco,
  corpoDeCadastroEmValidacao,
  corpoDeCadastroEncontrado,
  corpoDeCadastroInativado,
  corpoDeCadastroNaoEncontrado,
  type ParInstrumentado,
  REFERENCIA_DO_CADASTRO_NO_PAR,
  STATUS_MUDO,
  subirParInstrumentado,
} from './par-do-provedor.ts';

/** Teto da montagem: a instância efêmera, a fila e a aplicação real sobem aqui dentro. */
const LIMITE_DE_MONTAGEM_MS = 240_000;

/** Teto por caso: cada um gera autoridade e material com `openssl`, e sobe um par TLS próprio. */
const LIMITE_CASO_MS = 180_000;

/** O endereço de escuta da aplicação sob teste. */
const ENDERECO_DE_ESCUTA = '127.0.0.1';

/** A rota de entrada do arcabouço de identidade, composta a partir do prefixo real. */
const ROTA_DE_ENTRADA = `${PREFIXO_DAS_ROTAS_DE_IDENTIDADE}/sign-in/email`;

/** As duas rotas sob prova, compostas dos segmentos que o controlador publica. */
const AREA = `/${PREFIXO_DE_VERSAO}/${CAMINHO_DAS_INTEGRACOES_BANCARIAS}`;
const ROTA_DO_ESTADO = `${AREA}/${SEGMENTO_DA_ENTREGA_DA_NOTICIA}`;
const ROTA_DA_ATIVACAO = `${ROTA_DO_ESTADO}/${SEGMENTO_DA_ATIVACAO}`;

/** As duas rotas de pré-condição, compostas pela mesma régua. */
const ROTA_DO_REGISTRO = `${AREA}/${SEGMENTO_DO_REGISTRO}`;
const ROTA_DA_IDENTIDADE = `${AREA}/${SEGMENTO_DA_IDENTIDADE}`;

/** As rotas do operador do SaaS que montam empresa e Admin novos. */
const CAMINHO_DAS_EMPRESAS = `/${PREFIXO_DE_VERSAO}/${CAMINHO_DO_MASTER}/empresas`;
const ROTA_DE_TROCA_DE_SENHA = `/${PREFIXO_DE_VERSAO}/${CAMINHO_DA_TROCA_DE_SENHA_DO_PRODUTO}`;

/**
 * Para onde o produto declara que o provedor deve entregar a notícia.
 *
 * ⚠️ É o valor que o adaptador **envia** ao provedor no cadastro, e é contra ele que a consulta
 * positiva devolve o cadastro encontrado. Escrito à mão aqui, e não lido do ambiente: o que a suíte
 * mede é o ciclo, e uma leitura de ambiente faria o caso depender de configuração externa (ADR-0006).
 */
const ENDERECO_DA_ENTREGA = 'https://notificacao.exemplo.invalid/v1/notificacoes-bancarias';

/**
 * O contato operacional que acompanha o cadastro da entrega — a outra metade do endereço acima.
 *
 * O provedor o declara **necessário** no cadastro (`W2`, 2026-08-22), e por isso o adaptador resolve
 * negativo sem chamar quando ele falta. Domínio `.invalid`, reservado pela RFC 2606.
 */
const CONTATO_DA_ENTREGA = 'operacao@sysloc.exemplo.invalid';

/** As chaves que governam esta superfície — literais, na ORDEM em que o método as declara. */
const AREA_DAS_INTEGRACOES_BANCARIAS = 'TELA:integracoes_bancarias';
const ACAO_DE_CONFIGURACAO = 'ACAO:configurar_integracao';

/**
 * A mensagem da recusa por permissão — **literal**, e não lida de `MENSAGEM_POR_CODIGO`.
 *
 * Derivá-la da mesma tabela que o SUT usa faria a asserção concordar consigo mesma: um erro de texto
 * na tabela passaria despercebido nos dois lados. É a mesma disciplina, e o mesmo valor, de
 * `./autorizacao.e2e.spec.ts`.
 */
const MENSAGEM_DE_ACESSO_NEGADO = 'acesso negado para esta sessão';

/** As três mensagens de pré-condição que este arquivo compara por igualdade, escritas à mão. */
const MENSAGEM_SEM_CERTIFICADO = 'esta empresa não tem certificado do provedor registrado';
const MENSAGEM_DO_CERTIFICADO_VENCIDO = 'a validade do certificado apresentado já terminou';
const MENSAGEM_SEM_IDENTIDADE = 'esta empresa não tem identidade registrada no provedor';

/** Os discriminadores que `detalhes` publica nas três recusas de pré-condição. */
const DISCRIMINADOR_DO_CERTIFICADO = 'certificado';
const DISCRIMINADOR_DA_VALIDADE = 'validoAte';
const DISCRIMINADOR_DA_IDENTIDADE = 'identidade';

/** O conjunto de chaves que `esquemaDoEstadoDaEntrega` publica — ordenado, escrito à mão. */
// SUT_IS_CORRECT_BECAUSE: a `0025` publica `situacao` — o campo ternário —, e ele é campo NOVO numa
// saída ABERTA, que é exatamente o que a `.claude/rules/contrato-publicado.md` prevê. Nenhum campo
// saiu e nenhum mudou de tipo; a asserção continua sendo igualdade de conjunto ordenado.
const CHAVES_DO_ESTADO = ['habilitada', 'motivo', 'situacao', 'verificadaEm'];

/** O conjunto de chaves que `esquemaDoMotivoDaRecusa` publica — ordenado, escrito à mão. */
const CHAVES_DO_MOTIVO = ['codigo', 'diagnostico', 'mensagem'];

/** A senha do material gerado em execução. Ela vive e morre dentro do caso. */
const SENHA_DO_MATERIAL = 'senha-do-cofre-da-entrega';

/** Dias de validade do material vigente — folgado, para que a vigência nunca seja o eixo por acaso. */
const DIAS_VIGENTE_FOLGADO = 45;

/** Quantos dias a linha retroagida fica **além** do fim da validade. */
const DIAS_DE_ATRASO_DO_VENCIDO = 1;

/** A senha para a qual o Admin recém-admitido troca a provisória. */
const SENHA_TROCADA = 'brisa9Verde!';

/** Status esperados, escritos por extenso — nunca faixa. */
const STATUS_OK = 200;
const STATUS_CRIADO = 201;
const STATUS_ACESSO_NEGADO = 403;
const STATUS_CAMPO_INVALIDO = 422;
const STATUS_RECURSO_NAO_ENCONTRADO = 404;

/** As duas pessoas da carga que administram cada empresa. */
const ADMIN_DE_A = 'admin.a@exemplo.com.br';
const ADMIN_DE_B = 'admin.b@exemplo.com.br';
/** Quem tem perfil de usuário e **nenhuma** das duas chaves desta superfície. */
const USUARIO_SEM_NADA = 'usuario.a@exemplo.com.br';
/** Quem receberá a **área** e não a ação — a outra sessão deficiente. */
const USUARIO_SO_COM_A_AREA = 'usuario.b1@exemplo.com.br';
/** O operador do SaaS, que monta as empresas novas. */
const MASTER = 'master@sysloc.com.br';

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
let cookieDoMaster: string;

/**
 * Para onde a porta de entrega conecta **neste caso** — sempre um par do laço local (ADR-0006).
 *
 * Ela nasce indefinida, e a porta abaixo **recusa** quando ela continua assim: um destino ausente que
 * degradasse em silêncio faria um caso medir outra coisa sem dizer.
 */
let destinoDoProvedor: string | undefined;

/**
 * A porta que a aplicação recebe no lugar da de produção — e ela **é o adaptador de produção**.
 *
 * O que a composição faz em produção é construir `criarAdaptadorSicoob` a partir dos três endereços
 * que a partida já exigiu; o que este objeto faz é construir **o mesmo adaptador**, com o endereço do
 * par TLS que o caso corrente subiu. O endereço da entrega continua sendo o que o produto **declara**
 * ao provedor, e não para onde ele conecta — por isso ele é constante, e não o destino do par.
 *
 * O adaptador é construído **por ato**, e não uma vez na montagem, porque o par de cada caso nasce
 * dentro do `it`. Construir por ato é fiel ao artefato: a construção resolve os endereços e não abre
 * soquete algum.
 */
const portaDaEntrega: PortaDeEntregaDaNoticia = {
  async cadastrarEntrega(entrega: EntregaParaCadastrar): Promise<ResultadoDaOperacaoDeEntrega> {
    return await adaptadorDoCaso().cadastrarEntrega(entrega);
  },
  // ⚠️ A referência atravessa: é ela que permite ao adaptador provar que um cadastro de endereço
  // divergente é NOSSO, e não de outro sistema. Engoli-la aqui faria o dublê medir outra coisa.
  async consultarEntrega(
    entrega: EntregaParaCadastrar,
    referenciaConhecida?: string,
  ): Promise<LeituraDaEntrega> {
    return await adaptadorDoCaso().consultarEntrega(entrega, referenciaConhecida);
  },
  async atualizarEnderecoDaEntrega(
    entrega: EntregaParaCadastrar,
    referencia: string,
  ): Promise<ResultadoDaOperacaoDeEntrega> {
    return await adaptadorDoCaso().atualizarEnderecoDaEntrega(entrega, referencia);
  },
  async reativarEntrega(
    entrega: EntregaParaCadastrar,
    referencia: string,
  ): Promise<ResultadoDaOperacaoDeEntrega> {
    return await adaptadorDoCaso().reativarEntrega(entrega, referencia);
  },
};

/** Constrói o adaptador de produção apontado para o par do caso, ou recusa se não houver par. */
function adaptadorDoCaso(): PortaDeEntregaDaNoticia {
  if (destinoDoProvedor === undefined) {
    throw new Error('nenhum par de teste foi apontado para a porta de entrega neste caso');
  }

  return criarAdaptadorSicoob({
    enderecoDoProvedor: destinoDoProvedor,
    enderecoDeAutorizacao: destinoDoProvedor,
    enderecoDaEntregaDaNoticia: ENDERECO_DA_ENTREGA,
    contatoDaEntregaDaNoticia: CONTATO_DA_ENTREGA,
  });
}

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

  const modulo = await Test.createTestingModule({ imports: [AppModule] })
    // A porta de entrega entra pelo arcabouço de teste, e o que ela substitui é o **destino**.
    .overrideProvider(TOKEN_PORTA_DE_ENTREGA_DA_NOTICIA)
    .useValue(portaDaEntrega)
    .compile();

  aplicacao = modulo.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
  aplicacao.setGlobalPrefix(PREFIXO_DE_VERSAO);
  await aplicacao.listen({ port: porta, host: ENDERECO_DE_ESCUTA });

  cookieDeA = await entrar(base, ADMIN_DE_A, SENHA_DA_CARGA);
  cookieDeB = await entrar(base, ADMIN_DE_B, SENHA_DA_CARGA);
  cookieDoMaster = await entrarComSegundoFatorCumprido(
    base,
    MASTER,
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

describe('a entrega da notícia do provedor por empresa (T7)', () => {
  it(
    'CT-1025 — habilitada só com os dois positivos, e com o par DERRUBADO a consulta ainda responde',
    async () => {
      const { autoridade, par } = await armarProvedor('ct1025');
      await registrarPreCondicoes(cookieDeA, autoridade);

      // --- A ativação, com o par aceitando o cadastro e confirmando a consulta ----------------
      const ativacao = await pedir(base, ROTA_DA_ATIVACAO, {
        metodo: 'POST',
        cookie: cookieDeA,
        corpo: {},
      });

      // `200`, e NUNCA `201`: o ato é idempotente e não cria recurso endereçável. A asserção é de
      // igualdade contra o número exato, e não de faixa — é a diferença entre os dois que ela mede.
      expect(ativacao.status).toBe(STATUS_OK);
      expect(ativacao.status).not.toBe(STATUS_CRIADO);

      const publicado = ativacao.corpo as EstadoDaEntrega;

      // O corpo INTEIRO por igualdade profunda contra o objeto escrito à mão — nunca por presença de
      // campo. `motivo` é `null` e não ausente: o esquema publicado o declara anulável e obrigatório,
      // e a distinção viaja no valor.
      expect(publicado).toEqual({
        habilitada: true,
        // O ternário acompanha o booleano, e a `CHECK` do banco os amarra desde a `0025`.
        situacao: 'HABILITADA',
        verificadaEm: publicado.verificadaEm,
        motivo: null,
      });
      expect(chavesDe(publicado)).toEqual(CHAVES_DO_ESTADO);
      // O carimbo veio do BANCO, e é datado: sem esta linha a igualdade acima aceitaria `null`, que é
      // justamente o discriminador de "nunca houve tentativa".
      expect(typeof publicado.verificadaEm).toBe('string');
      expect(Number.isNaN(Date.parse(publicado.verificadaEm ?? ''))).toBe(false);

      // SUT_IS_CORRECT_BECAUSE: o quadro de decisão da `0025` inverteu a ordem — **a consulta é o
      // primeiro passo e é ela que decide** (RN-05) —, e o par deste caso responde com o NOSSO
      // cadastro já validado e ativo. Nesse estado não há vaga a pedir: pedi-la seria o produto
      // solicitando o que já é dele, e o provedor recusaria por vaga ocupada num caminho feliz. Por
      // isso `cadastro` é **zero** aqui, e não um. A asserção **não foi afrouxada**: continua sendo
      // igualdade contra número exato nos dois eixos, e um cadastro indevido reprova imediatamente.
      expect(par.chamadas.cadastro).toBe(0);
      expect(par.chamadas.consulta).toBe(1);

      const conexoesAntes = par.conexoes;
      expect(conexoesAntes).toBeGreaterThan(0);

      // --- O DISCRIMINADOR: com o par derrubado, a consulta ainda responde --------------------
      //
      // É a derrubada que torna a asserção falsificável por construção: se o `GET` falasse com o
      // provedor, ele **não teria com quem falar**, e a resposta não sairia `200`.
      await par.derrubar();

      const consulta = await pedir(base, ROTA_DO_ESTADO, { cookie: cookieDeA });

      expect(consulta.status).toBe(STATUS_OK);
      // Igualdade PROFUNDA contra o corpo da ativação: o estado publicado é o mesmo, e ele sai das
      // COLUNAS — não de um objeto guardado em memória pela requisição anterior.
      expect(consulta.corpo).toEqual(publicado);

      // A SEGUNDA metade, e ela pega o que a primeira não pega: uma consulta que falasse com o
      // provedor e **degradasse em silêncio** ainda responderia `200`. Igualdade numérica exata,
      // nunca `toBeLessThan` — "poucas conexões" é a asserção que não discrimina.
      expect(par.conexoes).toBe(conexoesAntes);
    },
    LIMITE_CASO_MS,
  );

  it(
    'CT-1026 — um positivo só NÃO basta: sem resposta ao cadastro a confirmação não é alcançada, e com o cadastro aceito é a confirmação negativa que decide',
    async () => {
      const { autoridade, par } = await armarProvedor('ct1026');
      await registrarPreCondicoes(cookieDeA, autoridade);

      // --- A LINHA DE BASE: uma ativação positiva, para que "o anterior permanece" tenha o que
      // --- preservar. Sem ela, o estado preservado seria o vazio, e a asserção não discriminaria.
      const primeira = await pedir(base, ROTA_DA_ATIVACAO, {
        metodo: 'POST',
        cookie: cookieDeA,
        corpo: {},
      });
      expect(primeira.status).toBe(STATUS_OK);
      expect((primeira.corpo as EstadoDaEntrega).habilitada).toBe(true);

      const anterior = primeira.corpo as EstadoDaEntrega;

      // --- O cenário: o par recebe o cadastro e NÃO responde ----------------------------------
      //
      // A concessão da credencial continua sendo atendida — é o que mantém a chamada do cadastro
      // contável. Derrubar o par inteiro faria o desfecho ser o mesmo por outro motivo, e o contador
      // do cadastro valeria `0`.
      par.zerar();
      par.responderAoCadastro({ status: STATUS_MUDO, corpo: '' });
      // SUT_IS_CORRECT_BECAUSE: sob o quadro da `0025` a **consulta corre primeiro**, e é ela que
      // decide. Para que o cadastro chegue a sair, a consulta precisa dizer que **não há cadastro
      // nosso** — que é a linha 1 do quadro, a única que cria. Com a consulta positiva (a fixture
      // anterior), o desfecho seria *habilitada* sem cadastro algum, e o caso mediria outro caminho.
      // O que ele mede não mudou: o cadastro que **não responde** não vira desabilitação.
      par.responderAConsulta({ status: STATUS_OK, corpo: corpoDeCadastroNaoEncontrado() });

      const ativacao = await pedir(base, ROTA_DA_ATIVACAO, {
        metodo: 'POST',
        cookie: cookieDeA,
        corpo: {},
      });

      // A falta de resposta do provedor **não vira exceção**: `200`, nunca `5xx`.
      expect(ativacao.status).toBe(STATUS_OK);

      // O ESTADO ANTERIOR PERMANECE: nada é gravado quando não houve resposta a registrar, porque
      // gravar `habilitada: false` apagaria, por uma indisponibilidade momentânea, o desfecho que o
      // Admin ainda precisa ler. Igualdade profunda contra o corpo da primeira ativação.
      expect(ativacao.corpo).toEqual(anterior);

      // ⚠️ **O DISCRIMINADOR**, por igualdade numérica: a consulta correu (`1`) e disse que não há
      // cadastro nosso, o cadastro SAIU (`1`) e **não respondeu**. É a combinação que separa este
      // caso do `CT-1035`: lá a consulta encontra o cadastro e prevalece; aqui ela não encontra, o
      // ato é tentado, e a falta de resposta **preserva** o estado anterior em vez de o apagar.
      expect(par.chamadas.cadastro).toBe(1);
      expect(par.chamadas.consulta).toBe(1);

      // E o `GET` confirma que foi o estado PERSISTIDO que ficou intacto, e não só a resposta.
      const consulta = await pedir(base, ROTA_DO_ESTADO, { cookie: cookieDeA });
      expect(consulta.status).toBe(STATUS_OK);
      expect(consulta.corpo).toEqual(anterior);

      // ====================================================================================
      // O SEGUNDO TRECHO: cadastro ACEITO e confirmação NEGATIVA
      // ====================================================================================
      //
      // ⚠️ **É esta combinação que separa a regra de uma DISJUNÇÃO.** Ela é a única das cinco em
      // que o cadastro é positivo e a confirmação não é: trocar `habilitada = confirmacao.aceito`
      // por `cadastro.aceito || confirmacao.aceito` deixaria TODOS os outros casos deste arquivo
      // verdes e só este sairia `habilitada: true`. E ela é também o **único** caminho pelo qual o
      // motivo emitido pela CONFIRMAÇÃO alcança o corpo publicado — o outro lado do `??` do
      // serviço, cujo primeiro lado (o motivo do cadastro) o `CT-1030` já prende.
      const motivoDaConfirmacao = {
        codigo: '10404',
        mensagem: 'A entrega não está ativa nesta conta — recusa emitida pela CONSULTA',
      };

      par.zerar();
      // O cadastro é ACEITO, e por isso **nenhum motivo nasce dele**: o que sair no corpo só pode
      // ter vindo da consulta. É o que torna a origem do motivo observável.
      par.responderAoCadastro({ status: STATUS_OK, corpo: '{}' });
      // ⚠️ A consulta **responde**, e o que ela responde é uma RECUSA. Sob o quadro da `0025` isso é
      // distinto de *"não respondeu"*: o provedor disse algo sobre a nossa pergunta, e é isso que se
      // grava. A distinção é a leitura da PRESENÇA do motivo — a mesma que o cadastro sempre fez.
      par.responderAConsulta({
        status: STATUS_CAMPO_INVALIDO,
        corpo: JSON.stringify(motivoDaConfirmacao),
      });

      const semConfirmacao = await pedir(base, ROTA_DA_ATIVACAO, {
        metodo: 'POST',
        cookie: cookieDeA,
        corpo: {},
      });
      const publicado = semConfirmacao.corpo as EstadoDaEntrega;

      // `200` exato: a recusa do provedor não vira exceção aqui tampouco.
      expect(semConfirmacao.status).toBe(STATUS_OK);

      // O corpo INTEIRO por igualdade profunda. `habilitada: false` é **a asserção que reprova com
      // a disjunção**; o `motivo` é o que a CONFIRMAÇÃO emitiu, com `diagnostico` nulo porque ela
      // não mandou campo variável nenhum — e `null` é distinto de `{}`.
      expect(publicado).toEqual({
        habilitada: false,
        situacao: 'DESABILITADA',
        verificadaEm: publicado.verificadaEm,
        motivo: { ...motivoDaConfirmacao, diagnostico: null },
      });
      expect(chavesDe(publicado)).toEqual(CHAVES_DO_ESTADO);
      expect(chavesDe(publicado.motivo)).toEqual(CHAVES_DO_MOTIVO);

      // O carimbo é datado, e não nulo: houve tentativa e o desfecho FOI gravado — o que distingue
      // este trecho do primeiro, em que nada é gravado e o estado anterior permanece.
      expect(typeof publicado.verificadaEm).toBe('string');

      // SUT_IS_CORRECT_BECAUSE: sob o quadro da `0025`, a consulta corre PRIMEIRO e decide sozinha
      // quando responde recusa — não há vaga a pedir depois de o provedor ter recusado a pergunta.
      // Por isso `cadastro` é zero. O que este trecho mede não mudou: é o motivo da CONSULTA que
      // alcança o corpo publicado, e é ele que a igualdade profunda acima prende.
      expect(par.chamadas.cadastro).toBe(0);
      expect(par.chamadas.consulta).toBe(1);

      // E o `GET` prova que foi o estado PERSISTIDO que ficou desabilitado, e não só a resposta em
      // memória.
      const depois = await pedir(base, ROTA_DO_ESTADO, { cookie: cookieDeA });
      expect(depois.status).toBe(STATUS_OK);
      expect(depois.corpo).toEqual(publicado);

      // A SUBSTITUIÇÃO afirmada por si: o estado publicado agora é **diferente** do da linha de
      // base, que estava habilitada. Sem esta linha, um estado que jamais mudasse passaria nas
      // igualdades acima se elas fossem frouxas.
      expect(depois.corpo).not.toEqual(anterior);
    },
    LIMITE_CASO_MS,
  );

  it(
    'CT-1028 — duas empresas ativam independentemente, e o motivo de uma não aparece em resposta alguma da outra',
    async () => {
      const { autoridade, par } = await armarProvedor('ct1028');
      await registrarPreCondicoes(cookieDeA, autoridade);
      await registrarPreCondicoes(cookieDeB, autoridade);

      // As agulhas são únicas **por canal**: uma no código, uma na mensagem e uma dentro do
      // diagnóstico. Um vazamento que alcançasse só um dos três canais reprova nomeando qual.
      const agulhas = ['AGULHA-CODIGO-DE-A', 'AGULHA-MENSAGEM-DE-A', 'AGULHA-DIAGNOSTICO-DE-A'];
      par.responderAoCadastro({
        status: STATUS_CAMPO_INVALIDO,
        corpo: JSON.stringify({
          codigo: agulhas[0],
          mensagem: agulhas[1],
          detalheDoProvedor: agulhas[2],
        }),
      });
      par.responderAConsulta({ status: STATUS_OK, corpo: corpoDeCadastroNaoEncontrado() });

      const deA = await pedir(base, ROTA_DA_ATIVACAO, {
        metodo: 'POST',
        cookie: cookieDeA,
        corpo: {},
      });
      expect(deA.status).toBe(STATUS_OK);
      expect((deA.corpo as EstadoDaEntrega).habilitada).toBe(false);

      // A ÂNCORA ANTIVÁCUO: as três agulhas ESTÃO na saída real de A. Sem ela, a varredura de B
      // devolveria `[]` sobre um motivo que nunca chegou a ser gravado (AP-29).
      const estadoDeA = await pedir(base, ROTA_DO_ESTADO, { cookie: cookieDeA });
      expect(estadoDeA.status).toBe(STATUS_OK);
      expect(varrer(estadoDeA.texto, agulhas)).toEqual(agulhas);

      // --- B ativa, e o par aceita -----------------------------------------------------------
      par.responderAoCadastro({ status: STATUS_OK, corpo: '{}' });
      par.responderAConsulta({
        status: STATUS_OK,
        corpo: corpoDeCadastroEncontrado(ENDERECO_DA_ENTREGA),
      });

      const deB = await pedir(base, ROTA_DA_ATIVACAO, {
        metodo: 'POST',
        cookie: cookieDeB,
        corpo: {},
      });
      expect(deB.status).toBe(STATUS_OK);
      expect((deB.corpo as EstadoDaEntrega).habilitada).toBe(true);

      const estadoDeB = await pedir(base, ROTA_DO_ESTADO, { cookie: cookieDeB });
      expect(estadoDeB.status).toBe(STATUS_OK);

      // A medição da SAÍDA REAL de B, nos dois canais que ela tem (ADR-0032: a ausência de vazamento
      // se afirma medindo o que saiu, nunca lendo o código). `toEqual([])`, e nunca
      // `toHaveLength(0)`: a falha precisa NOMEAR a agulha e o canal.
      expect(varrer(deB.texto, agulhas)).toEqual([]);
      expect(varrer(estadoDeB.texto, agulhas)).toEqual([]);

      // O CONTROLE POSITIVO da MESMA função, canal a canal: sem ele, uma varredura incapaz de achar
      // qualquer coisa aprovaria um produto vazando tudo.
      expect(
        varrer(JSON.stringify({ um: agulhas[0], dois: agulhas[1], tres: agulhas[2] }), agulhas),
      ).toEqual(agulhas);

      // ⚠️ Nenhuma comparação de empresa é escrita neste caso — quem recorta é a política do banco
      // (ADR-0008). O que se afirma é o resultado observável dela.
      expect((estadoDeB.corpo as EstadoDaEntrega).motivo).toBeNull();
    },
    LIMITE_CASO_MS,
  );

  it(
    'CT-1029 — a consulta responde nos TRÊS estados, com o discriminador de "nunca houve tentativa", e nenhum é 404',
    async () => {
      const { autoridade, par } = await armarProvedor('ct1029');
      // A empresa é NOVA, e nunca tentou. Ela nasce pelas rotas reais do operador do SaaS — apagar a
      // linha de uma empresa existente reproduziria um estado que a produção não alcança.
      const nova = await montarEmpresaComAdmin();

      // --- (1) NUNCA TENTOU ------------------------------------------------------------------
      const semTentativa = await pedir(base, ROTA_DO_ESTADO, { cookie: nova.cookie });

      expect(semTentativa.status).toBe(STATUS_OK);
      // Nenhum dos três é `404`: a ausência de tentativa é estado declarado, não recurso inexistente.
      expect(semTentativa.status).not.toBe(STATUS_RECURSO_NAO_ENCONTRADO);
      expect(semTentativa.corpo).toEqual({
        habilitada: false,
        // Nunca tentou é DESABILITADA, e `verificadaEm` nulo continua sendo o discriminador entre
        // ela e a que tentou e foi recusada.
        situacao: 'DESABILITADA',
        verificadaEm: null,
        motivo: null,
      });
      expect(chavesDe(semTentativa.corpo)).toEqual(CHAVES_DO_ESTADO);

      // --- (2) DESABILITADA, com motivo íntegro ----------------------------------------------
      await registrarPreCondicoes(nova.cookie, autoridade);

      const motivoEmitido = { codigo: '10999', mensagem: 'recusado para o CT-1029' };
      par.responderAoCadastro({
        status: STATUS_CAMPO_INVALIDO,
        corpo: JSON.stringify(motivoEmitido),
      });
      par.responderAConsulta({ status: STATUS_OK, corpo: corpoDeCadastroNaoEncontrado() });

      expect(
        (await pedir(base, ROTA_DA_ATIVACAO, { metodo: 'POST', cookie: nova.cookie, corpo: {} }))
          .status,
      ).toBe(STATUS_OK);

      const desabilitada = await pedir(base, ROTA_DO_ESTADO, { cookie: nova.cookie });
      const corpoDesabilitada = desabilitada.corpo as EstadoDaEntrega;

      expect(desabilitada.status).toBe(STATUS_OK);
      expect(desabilitada.status).not.toBe(STATUS_RECURSO_NAO_ENCONTRADO);
      expect(corpoDesabilitada).toEqual({
        habilitada: false,
        situacao: 'DESABILITADA',
        verificadaEm: corpoDesabilitada.verificadaEm,
        // ÍNTEGRO: os dois campos que o provedor emitiu, e `diagnostico` NULO — ele não mandou campo
        // variável nenhum, e `null` é distinto de `{}`.
        motivo: {
          codigo: motivoEmitido.codigo,
          mensagem: motivoEmitido.mensagem,
          diagnostico: null,
        },
      });
      expect(chavesDe(corpoDesabilitada)).toEqual(CHAVES_DO_ESTADO);
      expect(chavesDe(corpoDesabilitada.motivo)).toEqual(CHAVES_DO_MOTIVO);

      // --- (3) HABILITADA --------------------------------------------------------------------
      par.responderAoCadastro({ status: STATUS_OK, corpo: '{}' });
      par.responderAConsulta({
        status: STATUS_OK,
        corpo: corpoDeCadastroEncontrado(ENDERECO_DA_ENTREGA),
      });

      expect(
        (await pedir(base, ROTA_DA_ATIVACAO, { metodo: 'POST', cookie: nova.cookie, corpo: {} }))
          .status,
      ).toBe(STATUS_OK);

      const habilitada = await pedir(base, ROTA_DO_ESTADO, { cookie: nova.cookie });
      const corpoHabilitada = habilitada.corpo as EstadoDaEntrega;

      expect(habilitada.status).toBe(STATUS_OK);
      expect(habilitada.status).not.toBe(STATUS_RECURSO_NAO_ENCONTRADO);
      expect(corpoHabilitada).toEqual({
        habilitada: true,
        situacao: 'HABILITADA',
        verificadaEm: corpoHabilitada.verificadaEm,
        motivo: null,
      });

      // --- A COMPARAÇÃO ENTRE OS TRÊS, que é onde a invariante mora --------------------------
      //
      // O conjunto de chaves é o MESMO nos três — o que muda é o valor —, e é essa igualdade que
      // discrimina *"motivo ausente"* de *"motivo vazio"*: sob `exactOptionalPropertyTypes`, opcional
      // presente com valor indefinido não é conforme, e nenhum dos três o exibe.
      expect([
        chavesDe(semTentativa.corpo),
        chavesDe(corpoDesabilitada),
        chavesDe(corpoHabilitada),
      ]).toEqual([CHAVES_DO_ESTADO, CHAVES_DO_ESTADO, CHAVES_DO_ESTADO]);

      // E os três são MUTUAMENTE DISTINTOS pelo par que os identifica: sem esta linha, uma
      // implementação que devolvesse sempre o mesmo estado passaria nas três igualdades acima só se
      // elas fossem frouxas — e esta o pega mesmo assim.
      expect(
        new Set(
          [semTentativa.corpo, corpoDesabilitada, corpoHabilitada].map((estado) =>
            JSON.stringify([
              (estado as EstadoDaEntrega).habilitada,
              (estado as EstadoDaEntrega).verificadaEm === null,
              (estado as EstadoDaEntrega).motivo === null,
            ]),
          ),
        ).size,
      ).toBe(3);
    },
    LIMITE_CASO_MS,
  );

  it(
    'CT-1030 — o motivo publicado é igual por igualdade profunda ao corpo que o provedor devolveu',
    async () => {
      const { autoridade, par } = await armarProvedor('ct1030');
      await registrarPreCondicoes(cookieDeA, autoridade);

      // O corpo RICO e LITERAL que o provedor emite: mensagem com acentuação, código do provedor e um
      // campo aninhado com arranjo dentro. É ele que atravessa TRÊS fronteiras reais entre o plantio e
      // a leitura — servidor TLS mútuo real, persistência no Postgres efêmero e projeção composta a
      // partir das COLUNAS —, e é a integridade nessa travessia que se prova.
      const emitido = {
        codigo: '10260',
        mensagem: 'Já existe configuração de notificação para esta conta — verifique a integração',
        contexto: {
          origem: 'gestão de notificações',
          campos: ['numeroCliente', 'codigoTipoMovimento'],
        },
        tentativa: 3,
      };

      par.responderAoCadastro({ status: STATUS_CAMPO_INVALIDO, corpo: JSON.stringify(emitido) });
      par.responderAConsulta({ status: STATUS_OK, corpo: corpoDeCadastroNaoEncontrado() });

      const ativacao = await pedir(base, ROTA_DA_ATIVACAO, {
        metodo: 'POST',
        cookie: cookieDeA,
        corpo: {},
      });
      expect(ativacao.status).toBe(STATUS_OK);

      const consulta = await pedir(base, ROTA_DO_ESTADO, { cookie: cookieDeA });
      expect(consulta.status).toBe(STATUS_OK);

      // O motivo CANÔNICO: os dois campos de nome do produto carregam os valores verbatim, e tudo o
      // que sobrou do corpo do provedor viaja no portador opaco, íntegro e sem reordenação semântica.
      const motivoCanonico = {
        codigo: emitido.codigo,
        mensagem: emitido.mensagem,
        diagnostico: { contexto: emitido.contexto, tentativa: emitido.tentativa },
      };

      const publicado = (consulta.corpo as EstadoDaEntrega).motivo;

      // Igualdade PROFUNDA — mensagem, código e TODOS os campos aninhados, com a acentuação
      // preservada, sem interpretação, tradução ou resumo.
      expect(publicado).toEqual(motivoCanonico);

      // À PARTE: os conjuntos de chaves, ordenados. A igualdade de conjunto reprova tanto a chave que
      // sumiu quanto a que apareceu — e as duas direções precisam reprovar.
      expect(chavesDe(publicado)).toEqual(CHAVES_DO_MOTIVO);
      expect(chavesDe(publicado?.diagnostico)).toEqual(
        Object.keys(motivoCanonico.diagnostico).sort(),
      );

      // A acentuação afirmada por si, contra o literal emitido: um trânsito que normalizasse texto
      // passaria na igualdade acima se ela fosse frouxa, e esta linha o pega no canal exato.
      expect(publicado?.mensagem).toBe(emitido.mensagem);

      // E a resposta da ATIVAÇÃO carrega o mesmo motivo, também por igualdade profunda: as duas
      // superfícies publicam o mesmo fato.
      expect((ativacao.corpo as EstadoDaEntrega).motivo).toEqual(motivoCanonico);
    },
    LIMITE_CASO_MS,
  );

  it(
    'CT-1031 — quatro motivos degenerados produzem status, estado e forma de corpo idênticos: o motivo não decide nada',
    async () => {
      const { autoridade, par } = await armarProvedor('ct1031');
      await registrarPreCondicoes(cookieDeA, autoridade);

      par.responderAConsulta({ status: STATUS_OK, corpo: corpoDeCadastroNaoEncontrado() });

      /** Os quatro corpos degenerados — vazio, não-JSON, profundamente aninhado e de nome hostil. */
      const cenarios: readonly { readonly nome: string; readonly corpo: string }[] = [
        { nome: 'corpo vazio', corpo: '' },
        { nome: 'corpo que não é JSON', corpo: '<html><body>erro 500</body></html>' },
        {
          nome: 'corpo profundamente aninhado',
          corpo: JSON.stringify({
            codigo: 'X',
            mensagem: 'Y',
            fundo: aninhar(40),
          }),
        },
        {
          nome: 'corpo com chaves de nome hostil',
          corpo: JSON.stringify({
            codigo: 'Z',
            mensagem: 'W',
            __proto__: { poluido: 'sim' },
            constructor: 'texto',
            'chave com espaço': 1,
          }),
        },
      ];

      const capturas: {
        status: number;
        habilitada: boolean;
        chaves: string[];
        statusDoGet: number;
      }[] = [];

      for (const cenario of cenarios) {
        par.responderAoCadastro({ status: STATUS_CAMPO_INVALIDO, corpo: cenario.corpo });

        const ativacao = await pedir(base, ROTA_DA_ATIVACAO, {
          metodo: 'POST',
          cookie: cookieDeA,
          corpo: {},
        });
        const consulta = await pedir(base, ROTA_DO_ESTADO, { cookie: cookieDeA });

        // Exatamente `200` nos quatro — nunca `5xx`, nunca variação de status.
        expect(ativacao.status, cenario.nome).toBe(STATUS_OK);
        expect(consulta.status, cenario.nome).toBe(STATUS_OK);
        expect((ativacao.corpo as EstadoDaEntrega).habilitada, cenario.nome).toBe(false);

        capturas.push({
          status: ativacao.status,
          habilitada: (ativacao.corpo as EstadoDaEntrega).habilitada,
          chaves: chavesDe(ativacao.corpo),
          statusDoGet: consulta.status,
        });
      }

      // --- A COMPARAÇÃO ENTRE OS QUATRO, que é onde a invariante mora ------------------------
      //
      // O que se prova NÃO é que cada cenário responde `200`, e sim que os quatro respondem **a mesma
      // coisa**. Quatro casos separados provariam quatro fatos e deixariam a igualdade entre eles sem
      // asserção nenhuma.
      const primeira = capturas[0];
      expect(capturas).toHaveLength(cenarios.length);
      for (const [indice, captura] of capturas.entries()) {
        expect(captura, cenarios[indice]?.nome).toEqual(primeira);
      }

      // --- CONTROLE contra poluição de protótipo (cenário 4) ---------------------------------
      //
      // A chave plantada em `__proto__` **não** alcança o protótipo de objeto. A asserção é sobre o
      // protótipo real do processo, e não sobre o corpo devolvido: é ali que o dano aconteceria.
      expect(Object.getPrototypeOf({})).not.toHaveProperty('poluido');
      expect(({} as Record<string, unknown>).poluido).toBeUndefined();
    },
    LIMITE_CASO_MS,
  );

  it(
    'CT-1034 — o desfecho novo SUBSTITUI o anterior, e o motivo antigo some do corpo',
    async () => {
      const { autoridade, par } = await armarProvedor('ct1034');
      await registrarPreCondicoes(cookieDeA, autoridade);

      const agulha = 'AGULHA-MOTIVO-ANTIGO';

      par.responderAoCadastro({
        status: STATUS_CAMPO_INVALIDO,
        corpo: JSON.stringify({ codigo: '10500', mensagem: agulha }),
      });
      par.responderAConsulta({ status: STATUS_OK, corpo: corpoDeCadastroNaoEncontrado() });

      expect(
        (await pedir(base, ROTA_DA_ATIVACAO, { metodo: 'POST', cookie: cookieDeA, corpo: {} }))
          .status,
      ).toBe(STATUS_OK);

      // A ÂNCORA ANTIVÁCUO: antes da segunda ativação, a MESMA varredura ENCONTRA a agulha.
      const antes = await pedir(base, ROTA_DO_ESTADO, { cookie: cookieDeA });
      expect(antes.status).toBe(STATUS_OK);
      expect(varrer(antes.texto, [agulha])).toEqual([agulha]);

      const linhasAntes = await contarEstados(EMPRESA_A.id);
      expect(linhasAntes).toBe(1);

      // --- A segunda ativação, agora aceita --------------------------------------------------
      par.responderAoCadastro({ status: STATUS_OK, corpo: '{}' });
      par.responderAConsulta({
        status: STATUS_OK,
        corpo: corpoDeCadastroEncontrado(ENDERECO_DA_ENTREGA),
      });

      const segunda = await pedir(base, ROTA_DA_ATIVACAO, {
        metodo: 'POST',
        cookie: cookieDeA,
        corpo: {},
      });
      expect(segunda.status).toBe(STATUS_OK);
      expect((segunda.corpo as EstadoDaEntrega).habilitada).toBe(true);

      const depois = await pedir(base, ROTA_DO_ESTADO, { cookie: cookieDeA });
      expect(depois.status).toBe(STATUS_OK);

      // --- AS TRÊS METADES, e nenhuma implica a outra ----------------------------------------
      //
      // (a) A varredura pega o motivo antigo que sobrevivesse na saída real dos dois desfechos novos.
      expect(varrer(segunda.texto, [agulha])).toEqual([]);
      expect(varrer(depois.texto, [agulha])).toEqual([]);

      // (b) O CONTROLE POSITIVO, no mesmo caso: a MESMA função sobre um controle com a agulha
      // plantada devolve a lista completa. Sem ele, uma varredura que não pode achar nada aprovaria
      // um corpo carregando tudo (AP-29).
      expect(varrer(JSON.stringify({ motivo: { mensagem: agulha } }), [agulha])).toEqual([agulha]);

      // (c) A contagem crua de linhas é IGUAL à de antes: **substituição, e não acúmulo**. Esta é a
      // única das três que enxerga o estado preso — uma implementação que insere linha nova e projeta
      // a mais recente passaria nas duas primeiras.
      expect(await contarEstados(EMPRESA_A.id)).toBe(linhasAntes);
    },
    LIMITE_CASO_MS,
  );

  it(
    'CT-1035 — cadastro recusado com consulta positiva ⟹ HABILITADA: a confirmação prevalece',
    async () => {
      const { autoridade, par } = await armarProvedor('ct1035');
      await registrarPreCondicoes(cookieDeA, autoridade);

      // O par recusa o cadastro **por vaga já ocupada**, na forma que o provedor usa para isso, e a
      // consulta responde positivo para o NOSSO destino.
      par.responderAoCadastro({
        status: STATUS_CAMPO_INVALIDO,
        corpo: JSON.stringify({
          codigo: '10260',
          mensagem: 'Já existe configuração de notificação para esta conta',
        }),
      });
      par.responderAConsulta({
        status: STATUS_OK,
        corpo: corpoDeCadastroEncontrado(ENDERECO_DA_ENTREGA),
      });
      par.zerar();

      const ativacao = await pedir(base, ROTA_DA_ATIVACAO, {
        metodo: 'POST',
        cookie: cookieDeA,
        corpo: {},
      });
      const publicado = ativacao.corpo as EstadoDaEntrega;

      expect(ativacao.status).toBe(STATUS_OK);
      expect(publicado).toEqual({
        habilitada: true,
        situacao: 'HABILITADA',
        verificadaEm: publicado.verificadaEm,
        // O motivo sai NULO apesar de o cadastro ter sido recusado: não há recusa a explicar numa
        // entrega que está de pé, e publicá-la diria ao Admin que algo falhou.
        motivo: null,
      });
      expect(chavesDe(publicado)).toEqual(CHAVES_DO_ESTADO);

      // SUT_IS_CORRECT_BECAUSE: o eixo deste caso — *"a consulta prevalece sobre o cadastro"* —
      // continua valendo e ficou **mais forte**: sob o quadro da `0025` a consulta encontra o nosso
      // cadastro já ativo e decide sozinha, de modo que a vaga sequer é pedida. Não é que o cadastro
      // tenha sido recusado e ignorado; é que ele não precisou acontecer. Por isso `cadastro` é
      // zero. A asserção segue sendo igualdade contra número exato nos dois eixos.
      expect(par.chamadas.cadastro).toBe(0);
      expect(par.chamadas.consulta).toBe(1);

      // E o `GET` prova que foi o estado PERSISTIDO que ficou habilitado, e não só a resposta em
      // memória.
      const consulta = await pedir(base, ROTA_DO_ESTADO, { cookie: cookieDeA });
      expect(consulta.status).toBe(STATUS_OK);
      expect(consulta.corpo).toEqual(publicado);
    },
    LIMITE_CASO_MS,
  );

  it(
    'CT-1036 — vaga ocupada por sistema de TERCEIRO: recusa informada e ZERO chamadas mutantes',
    async () => {
      const { autoridade, par } = await armarProvedor('ct1036');
      await registrarPreCondicoes(cookieDeA, autoridade);

      const motivoEmitido = {
        codigo: '10260',
        mensagem: 'Já existe configuração de notificação para esta conta',
      };

      par.responderAoCadastro({
        status: STATUS_CAMPO_INVALIDO,
        corpo: JSON.stringify(motivoEmitido),
      });
      // A consulta NÃO encontra o nosso destino: quem ocupa a vaga é o cadastro de terceiro, e o
      // produto **não o reconhece como seu**.
      par.responderAConsulta({ status: STATUS_OK, corpo: corpoDeCadastroNaoEncontrado() });

      // O estado do cadastro alheio ANTES — cópia profunda, para que a comparação de depois não seja
      // contra a mesma referência (que seria igual a si mesma por construção).
      const terceiroAntes = structuredClone(par.cadastroDeTerceiro);
      par.zerar();

      const ativacao = await pedir(base, ROTA_DA_ATIVACAO, {
        metodo: 'POST',
        cookie: cookieDeA,
        corpo: {},
      });
      const publicado = ativacao.corpo as EstadoDaEntrega;

      // Recusa INFORMADA, nunca disputa: `200`, desabilitada, e o motivo do provedor íntegro.
      expect(ativacao.status).toBe(STATUS_OK);
      expect(publicado.habilitada).toBe(false);
      expect(publicado.motivo).toEqual({ ...motivoEmitido, diagnostico: null });

      // --- O PAR DE ASSERÇÕES QUE PROVA A NÃO-INTERVENÇÃO, e nenhuma implica a outra ---------
      //
      // (a) O mapa INTEIRO por igualdade, para que a falha nomeie QUAL método foi chamado. Um total
      // agregado diria apenas que houve chamada mutante.
      expect({
        put: par.chamadas.put,
        patch: par.chamadas.patch,
        remocao: par.chamadas.remocao,
        substituicao: par.chamadas.substituicao,
      }).toEqual({ put: 0, patch: 0, remocao: 0, substituicao: 0 });

      // (b) O EFEITO, e não a chamada: o cadastro alheio é idêntico ao de antes por igualdade
      // profunda. Ela é a metade que sobrevive a uma implementação que alcance o cadastro de terceiro
      // por um caminho que o contador não enumere.
      expect(par.cadastroDeTerceiro).toEqual(terceiroAntes);

      // O CONTROLE que impede (b) de ser vácuo: o cadastro alheio **é** alterável, e a mesma
      // comparação reprovaria se algo o tivesse tocado.
      expect(terceiroAntes).not.toEqual({});

      // E o estado persistido carrega a mesma recusa.
      const consulta = await pedir(base, ROTA_DO_ESTADO, { cookie: cookieDeA });
      expect(consulta.status).toBe(STATUS_OK);
      expect(consulta.corpo).toEqual(publicado);
    },
    LIMITE_CASO_MS,
  );

  it(
    'CT-1037 — sem a permissão: envelope de recusa nas DUAS rotas, ZERO efeito e catálogo inalterado',
    async () => {
      const { par } = await armarProvedor('ct1037');
      par.zerar();

      // As duas sessões deficientes de propósito, montadas pelo caminho legítimo: `entrar` pela rota
      // real e `conceder` SELETIVO, omitindo a chave que o cenário testa. A guarda **não** é
      // desligada, a aplicação **não** é instanciada sem o arcabouço de autorização, e nenhum símbolo
      // de produção é exportado para forjar sessão.
      const semNada = await entrar(base, USUARIO_SEM_NADA, SENHA_DA_CARGA);
      const soComAArea = await entrar(base, USUARIO_SO_COM_A_AREA, SENHA_DA_CARGA);
      await conceder(acessoAoNegocio, await usuarioDaCarga(USUARIO_SO_COM_A_AREA), EMPRESA_B.id, [
        AREA_DAS_INTEGRACOES_BANCARIAS,
      ]);

      const linhasAntesDeA = await contarEstados(EMPRESA_A.id);
      const linhasAntesDeB = await contarEstados(EMPRESA_B.id);

      const cenarios = [
        { rotulo: 'sem nenhuma chave', cookie: semNada, exigido: AREA_DAS_INTEGRACOES_BANCARIAS },
        { rotulo: 'só com a área', cookie: soComAArea, exigido: ACAO_DE_CONFIGURACAO },
      ] as const;
      const chamadas = [
        { rotulo: 'POST ativação', metodo: 'POST', alvo: ROTA_DA_ATIVACAO },
        { rotulo: 'GET estado', metodo: 'GET', alvo: ROTA_DO_ESTADO },
      ] as const;

      for (const cenario of cenarios) {
        for (const chamada of chamadas) {
          const rotulo = `${cenario.rotulo} · ${chamada.rotulo}`;
          const resposta = await pedir(base, chamada.alvo, {
            metodo: chamada.metodo,
            cookie: cenario.cookie,
            ...(chamada.metodo === 'POST' ? { corpo: {} } : {}),
          });

          expect(resposta.status, rotulo).toBe(STATUS_ACESSO_NEGADO);
          // O envelope INTEIRO da ADR-0017 por igualdade, com a mensagem escrita a partir do catálogo
          // fechado e o `detalhes.exigido` nomeando a PRIMEIRA chave ausente na ordem declarada
          // (ADR-0018) — a área vem antes da ação, para que quem já tem a área ouça o que lhe falta.
          expect(resposta.corpo, rotulo).toEqual({
            codigo: CodigoErro.ACESSO_NEGADO,
            mensagem: MENSAGEM_DE_ACESSO_NEGADO,
            detalhes: { exigido: cenario.exigido },
          });
        }
      }

      // --- ZERO EFEITO, medido por DUAS grandezas independentes ------------------------------
      //
      // A primeira pega a recusa que alcança o provedor antes de negar; a segunda, a que grava antes
      // de negar. Nenhuma implica a outra.
      expect(par.conexoes).toBe(0);
      expect(await contarEstados(EMPRESA_A.id)).toBe(linhasAntesDeA);
      expect(await contarEstados(EMPRESA_B.id)).toBe(linhasAntesDeB);

      // --- CATÁLOGO INALTERADO: nenhuma chave nasceu para esta superfície --------------------
      //
      // Igualdade contra o catálogo publicado, e não contenção: uma chave nova apareceria como
      // excedente. É a asserção que reprova a rodada que "resolvesse" a autorização criando
      // `ACAO:habilitar_entrega` em vez de reusar a que já governa a integração.
      const sessaoPlena = (await pedir(base, `/${PREFIXO_DE_VERSAO}/sessao`, { cookie: cookieDeA }))
        .corpo as { telas: string[]; acoes: string[] };

      expect(sessaoPlena.telas).toContain(AREA_DAS_INTEGRACOES_BANCARIAS);
      expect(sessaoPlena.acoes).toContain(ACAO_DE_CONFIGURACAO);
      expect(sessaoPlena.telas.filter((chave) => chave.includes('entrega'))).toEqual([]);
      expect(sessaoPlena.acoes.filter((chave) => chave.includes('entrega'))).toEqual([]);
    },
    LIMITE_CASO_MS,
  );

  it(
    'CT-1047 — as TRÊS recusas de pré-condição são distintas, sem `campo`, e nenhuma é 404',
    async () => {
      const { autoridade, par } = await armarProvedor('ct1047');
      par.zerar();

      // As três empresas nascem pelas rotas reais do operador do SaaS, cada uma com sessão própria e a
      // conjunção completa (a matriz de `ADMIN_EMPRESA` é o catálogo inteiro).
      const semCertificado = await montarEmpresaComAdmin();
      const comValidadeEncerrada = await montarEmpresaComAdmin();
      const semIdentidade = await montarEmpresaComAdmin();

      // (ii) registra o certificado pela rota real e depois **retroage a linha no eixo do BANCO**,
      // sob contexto de tenant — nunca por relógio falso.
      await registrarCertificado(comValidadeEncerrada.cookie, autoridade);
      await registrarIdentidade(comValidadeEncerrada.cookie);
      await envelhecerOVigente(comValidadeEncerrada.empresaId);

      // (iii) tem certificado vigente e **nenhuma** identidade.
      await registrarCertificado(semIdentidade.cookie, autoridade);

      const capturas: {
        readonly rotulo: string;
        readonly status: number;
        readonly codigo: unknown;
        readonly chaves: string[];
        readonly discriminante: string;
      }[] = [];

      for (const cenario of [
        { rotulo: 'sem certificado', cookie: semCertificado.cookie },
        { rotulo: 'validade encerrada', cookie: comValidadeEncerrada.cookie },
        { rotulo: 'sem identidade', cookie: semIdentidade.cookie },
      ]) {
        const resposta = await pedir(base, ROTA_DA_ATIVACAO, {
          metodo: 'POST',
          cookie: cenario.cookie,
          corpo: {},
        });
        const corpo = resposta.corpo as {
          codigo: string;
          mensagem: string;
          detalhes?: Record<string, unknown>;
        };

        // ⚠️ NÃO é `404`, e a asserção é explícita: o `404` desta superfície pertence às rotas em que
        // o certificado **é o recurso pedido**; aqui ele é pré-condição de um ato.
        expect(resposta.status, cenario.rotulo).not.toBe(STATUS_RECURSO_NAO_ENCONTRADO);
        expect(resposta.status, cenario.rotulo).toBe(STATUS_CAMPO_INVALIDO);

        // `campo` AUSENTE do envelope — afirmado pelo CONJUNTO DE CHAVES do corpo, e não por
        // `campo === undefined`: sob `exactOptionalPropertyTypes`, opcional presente com valor
        // indefinido **não** é a mesma coisa que chave ausente, e só a comparação de conjunto
        // discrimina as duas.
        expect(chavesDe(corpo), cenario.rotulo).toEqual(['codigo', 'detalhes', 'mensagem']);

        capturas.push({
          rotulo: cenario.rotulo,
          status: resposta.status,
          codigo: corpo.codigo,
          chaves: chavesDe(corpo.detalhes),
          discriminante: chavesDe(corpo.detalhes).join(','),
        });
      }

      // --- AS TRÊS SÃO MUTUAMENTE DISTINTAS pelo discriminador de `detalhes` -----------------
      expect(new Set(capturas.map((captura) => captura.discriminante)).size).toBe(3);

      // E cada uma nomeia o que falta, por igualdade contra o literal escrito à mão.
      const [semCert, vencido, semIdent] = capturas;
      expect(semCert?.chaves).toEqual([DISCRIMINADOR_DO_CERTIFICADO]);
      expect(vencido?.chaves).toEqual([DISCRIMINADOR_DA_VALIDADE]);
      expect(semIdent?.chaves).toEqual([DISCRIMINADOR_DA_IDENTIDADE]);

      // As três respondem o MESMO status e o MESMO código do envelope — o que as separa é `detalhes`.
      expect(new Set(capturas.map((captura) => captura.status)).size).toBe(1);
      expect(new Set(capturas.map((captura) => captura.codigo))).toEqual(
        new Set([CodigoErro.CAMPO_INVALIDO]),
      );

      // As mensagens são distintas, e escritas à mão: é o texto que o Admin lê para saber o que fazer.
      const mensagens = await Promise.all(
        [semCertificado, comValidadeEncerrada, semIdentidade].map(async (empresa) => {
          const resposta = await pedir(base, ROTA_DA_ATIVACAO, {
            metodo: 'POST',
            cookie: empresa.cookie,
            corpo: {},
          });
          return (resposta.corpo as { mensagem: string }).mensagem;
        }),
      );
      expect(mensagens).toEqual([
        MENSAGEM_SEM_CERTIFICADO,
        MENSAGEM_DO_CERTIFICADO_VENCIDO,
        MENSAGEM_SEM_IDENTIDADE,
      ]);

      // --- ANTES DE QUALQUER CHAMADA EXTERNA, e nenhuma linha nasceu -------------------------
      //
      // Igualdade numérica exata: o par está de pé e ninguém o procurou. É esta linha que separa
      // *"recusou"* de *"recusou depois de falar com o provedor"*.
      expect(par.conexoes).toBe(0);
      expect(await contarEstados(semCertificado.empresaId)).toBe(0);
      expect(await contarEstados(comValidadeEncerrada.empresaId)).toBe(0);
      expect(await contarEstados(semIdentidade.empresaId)).toBe(0);
    },
    LIMITE_CASO_MS,
  );
});

// ---------------------------------------------------------------------------------------------
// Arranjo — tudo pelas rotas reais, salvo o que não tem rota
// ---------------------------------------------------------------------------------------------

// ===========================================================================
// CT-1055 — O QUADRO DE DECISÃO DA ATIVAÇÃO, linha a linha
//
// INVARIANTES
// - as SETE situações que a consulta distingue produzem os desfechos declarados, e cada uma dispara
//   **no máximo um** ato corretivo;
// - o desfecho é TERNÁRIO — habilitada · em validação · desabilitada —, e o quarto (*"o provedor não
//   respondeu"*) não é desfecho: ele preserva o estado anterior;
// - nenhum ato é executado sobre cadastro de terceiro, e a prova é o EFEITO, não a chamada;
// - a precedência entre corrigir o endereço e reativar é da correção.
//
// ⚠️ **ESTE É O CASO QUE IMPEDE O TERNÁRIO DE VOLTAR A SER BOOLEANO.** Ele é tabelado de propósito:
// uma implementação que colapsasse *em validação* em qualquer dos outros dois deixaria a maioria das
// suítes verdes e reprovaria aqui, nomeando a linha. Sem ele, a regressão só apareceria na primeira
// ativação real — que ainda não aconteceu nenhuma vez, porque o cadastro junto ao provedor nunca foi
// executado.
// ===========================================================================

describe('CT-1055 — o quadro de decisão da ativação, linha a linha', () => {
  it(
    'CT-1055 — as sete linhas do quadro produzem os desfechos e os atos declarados',
    async () => {
      const { autoridade, par } = await armarProvedor('ct1055');
      await registrarPreCondicoes(cookieDeA, autoridade);

      /** Corre uma ativação e devolve o estado publicado, com as chamadas que ela produziu. */
      async function ativar(): Promise<{
        readonly estado: EstadoDaEntrega;
        readonly chamadas: { cadastro: number; atualizacao: number; reativacao: number };
      }> {
        par.zerar();

        const resposta = await pedir(base, ROTA_DA_ATIVACAO, {
          metodo: 'POST',
          cookie: cookieDeA,
          corpo: {},
        });

        expect(resposta.status).toBe(STATUS_OK);

        return {
          estado: resposta.corpo as EstadoDaEntrega,
          chamadas: {
            cadastro: par.chamadas.cadastro,
            atualizacao: par.chamadas.atualizacao,
            reativacao: par.chamadas.reativacao,
          },
        };
      }

      // ── LINHA 1 — nenhum cadastro ⟹ cadastrar, e o desfecho é EM VALIDAÇÃO ───────────────────
      //
      // ⚠️ **É a asserção mais importante do arquivo.** O cadastro recém-criado nasce *aguardando
      // validação* no provedor — a validação do endereço é o aperto de mão que ele faz DEPOIS, e é
      // assíncrona por construção. Uma implementação binária publicaria `habilitada: false` aqui, e
      // **toda ativação nova** diria ao Admin que falhou quando ela deu certo.
      par.responderAConsulta({ status: STATUS_OK, corpo: corpoDeCadastroNaoEncontrado() });
      par.responderAoCadastro({
        status: STATUS_OK,
        corpo: JSON.stringify({ resultado: { idWebhook: REFERENCIA_DO_CADASTRO_NO_PAR } }),
      });

      const linha1 = await ativar();

      expect(linha1.estado.situacao).toBe('EM_VALIDACAO');
      expect(linha1.estado.habilitada).toBe(false);
      expect(linha1.estado.motivo).toBeNull();
      expect(linha1.chamadas).toEqual({ cadastro: 1, atualizacao: 0, reativacao: 0 });

      // ── LINHA 3 — cadastro nosso AGUARDANDO VALIDAÇÃO ⟹ nenhum ato ──────────────────────────
      //
      // Ele já está no caminho. Recadastrar ou reativar aqui reiniciaria a janela de validação por
      // nada, e é por isso que a asserção dos atos é de **ausência** — com os três contadores em
      // zero, e não só o que "interessa".
      par.responderAConsulta({
        status: STATUS_OK,
        corpo: corpoDeCadastroEmValidacao(ENDERECO_DA_ENTREGA),
      });

      const linha3 = await ativar();

      expect(linha3.estado.situacao).toBe('EM_VALIDACAO');
      expect(linha3.chamadas).toEqual({ cadastro: 0, atualizacao: 0, reativacao: 0 });

      // ── LINHA 2 — cadastro nosso VALIDADO ⟹ nenhum ato, e HABILITADA ────────────────────────
      par.responderAConsulta({
        status: STATUS_OK,
        corpo: corpoDeCadastroEncontrado(ENDERECO_DA_ENTREGA),
      });

      const linha2 = await ativar();

      expect(linha2.estado.situacao).toBe('HABILITADA');
      expect(linha2.estado.habilitada).toBe(true);
      expect(linha2.estado.motivo).toBeNull();
      expect(linha2.chamadas).toEqual({ cadastro: 0, atualizacao: 0, reativacao: 0 });

      // ── LINHA 4 — cadastro nosso INATIVADO ⟹ REATIVAR, e volta a EM VALIDAÇÃO ───────────────
      //
      // É o cenário do falso positivo que este trabalho fechou: antes, um cadastro inativado contava
      // como ativo, e o produto afirmava saúde no exato momento em que a entrega estava morta.
      par.responderAConsulta({
        status: STATUS_OK,
        corpo: corpoDeCadastroInativado(ENDERECO_DA_ENTREGA),
      });

      const linha4 = await ativar();

      expect(linha4.estado.situacao).toBe('EM_VALIDACAO');
      // ⚠️ O ato é a operação DEDICADA, e não a de correção de endereço: o endereço está certo, o
      // que está errado é o cadastro estar desligado. Trocar uma pela outra manteria o desfecho e
      // não restabeleceria a entrega.
      expect(linha4.chamadas).toEqual({ cadastro: 0, atualizacao: 0, reativacao: 1 });

      // ── LINHA 5 — cadastro nosso com ENDEREÇO DIVERGENTE ⟹ CORRIGIR ─────────────────────────
      //
      // ⚠️ A referência guardada é o que torna esta linha alcançável: sem ela, um cadastro de
      // endereço alheio é indistinguível do de outro sistema, e o produto não pode tocá-lo. Ela foi
      // gravada na linha 1, pelo cadastro que o par aceitou.
      par.responderAConsulta({ status: STATUS_OK, corpo: corpoDeCadastroDeOutroEndereco() });

      const linha5 = await ativar();

      expect(linha5.estado.situacao).toBe('EM_VALIDACAO');
      expect(linha5.chamadas).toEqual({ cadastro: 0, atualizacao: 1, reativacao: 0 });

      // ── LINHA 7 — o provedor NÃO RESPONDE ⟹ o estado anterior PERMANECE ─────────────────────
      //
      // Não é desfecho, é ausência de leitura. Era o `D35`: o produto gravava desabilitação porque a
      // rede falhou, apagando o motivo íntegro que o Admin ainda precisava ler.
      const antesDoSilencio = linha5.estado;
      par.responderAConsulta({ status: STATUS_MUDO, corpo: '' });

      const linha7 = await ativar();

      expect(linha7.estado).toEqual(antesDoSilencio);
      expect(linha7.chamadas).toEqual({ cadastro: 0, atualizacao: 0, reativacao: 0 });
    },
    LIMITE_CASO_MS,
  );

  it(
    'CT-1055 (b) — LINHA 6: a vaga de TERCEIRO não é tocada, e a prova é o EFEITO',
    async () => {
      const { autoridade, par } = await armarProvedor('ct1055b');
      await registrarPreCondicoes(cookieDeB, autoridade);

      // A empresa B **nunca cadastrou nada**, e por isso não tem referência guardada: sem prova de
      // propriedade, o cadastro de endereço alheio é de terceiro, e nele não se toca.
      const cadastroAlheioAntes = { ...par.cadastroDeTerceiro };
      expect(Object.keys(cadastroAlheioAntes).length).toBeGreaterThan(0);

      par.responderAConsulta({ status: STATUS_OK, corpo: corpoDeCadastroDeOutroEndereco() });
      // O provedor recusa o cadastro justamente porque a vaga está ocupada — e é essa recusa,
      // verbatim, que vira o motivo publicado. O produto **não inventa** um texto próprio dizendo
      // que a vaga é de outro sistema: isso poria vocabulário dele no campo que existe para
      // preservar o do provedor.
      const recusaDaVaga = {
        codigo: '10260',
        mensagem: 'ja existe cadastro para este cliente e tipo de movimento',
      };
      par.responderAoCadastro({
        status: STATUS_CAMPO_INVALIDO,
        corpo: JSON.stringify({ mensagens: [recusaDaVaga] }),
      });
      par.zerar();

      const resposta = await pedir(base, ROTA_DA_ATIVACAO, {
        metodo: 'POST',
        cookie: cookieDeB,
        corpo: {},
      });

      expect(resposta.status).toBe(STATUS_OK);

      const estado = resposta.corpo as EstadoDaEntrega;

      expect(estado.situacao).toBe('DESABILITADA');
      expect(estado.habilitada).toBe(false);
      // O motivo é o do PROVEDOR, verbatim — os dois campos que ele emitiu.
      expect(estado.motivo?.codigo).toBe(recusaDaVaga.codigo);
      expect(estado.motivo?.mensagem).toBe(recusaDaVaga.mensagem);

      // ⚠️ **AS DUAS ASSERÇÕES QUE PROTEGEM O CADASTRO ALHEIO**, e a segunda é a que vale: a
      // primeira mede que nenhuma chamada de correção saiu; a segunda mede que o cadastro **não
      // mudou**. Um par que apenas contasse aprovaria uma implementação que alcançasse o cadastro
      // de terceiro por um caminho que o contador não enumera.
      expect({
        atualizacao: par.chamadas.atualizacao,
        reativacao: par.chamadas.reativacao,
        substituicao: par.chamadas.substituicao,
      }).toEqual({ atualizacao: 0, reativacao: 0, substituicao: 0 });
      expect(par.cadastroDeTerceiro).toEqual(cadastroAlheioAntes);

      // Âncora antivácuo: o ato de fato correu — a vaga foi pedida e recusada. Sem ela, as ausências
      // acima seriam satisfeitas por uma ativação que nunca falou com o provedor.
      expect(par.chamadas.consulta).toBe(1);
      expect(par.chamadas.cadastro).toBe(1);
    },
    LIMITE_CASO_MS,
  );

  it(
    'CT-1055 (c) — a PRECEDÊNCIA: inativado E com endereço divergente corrige a URL, não reativa',
    async () => {
      const { autoridade, par } = await armarProvedor('ct1055c');
      await registrarPreCondicoes(cookieDeA, autoridade);

      // Primeiro uma ativação que GRAVA a referência — é ela que dá ao produto a prova de que o
      // cadastro é seu, e sem ela o caso mediria a linha 6.
      par.responderAConsulta({ status: STATUS_OK, corpo: corpoDeCadastroNaoEncontrado() });
      par.responderAoCadastro({
        status: STATUS_OK,
        corpo: JSON.stringify({ resultado: { idWebhook: REFERENCIA_DO_CADASTRO_NO_PAR } }),
      });
      await pedir(base, ROTA_DA_ATIVACAO, { metodo: 'POST', cookie: cookieDeA, corpo: {} });

      // Agora o cadastro aparece **inativado E com o endereço errado** — as duas condições juntas.
      par.responderAConsulta({
        status: STATUS_OK,
        corpo: JSON.stringify({
          resultado: [
            {
              idWebhook: REFERENCIA_DO_CADASTRO_NO_PAR,
              url: 'https://endereco-antigo.exemplo.invalid/v1/notificacoes-bancarias',
              codigoTipoMovimento: 7,
              codigoSituacao: 3,
              dataHoraInativacao: '2026-08-20T18:50:55.099Z',
              descricaoMotivoInativacao: 'Erro ao enviar notificação',
            },
          ],
        }),
      });
      par.zerar();

      const resposta = await pedir(base, ROTA_DA_ATIVACAO, {
        metodo: 'POST',
        cookie: cookieDeA,
        corpo: {},
      });

      expect(resposta.status).toBe(STATUS_OK);

      // ⚠️ **A ASSERÇÃO QUE DISCRIMINA A PRECEDÊNCIA**: o ato é a CORREÇÃO, e não a reativação.
      // A razão é concreta, e não estilística: reativar mantém a URL antiga, o provedor tentaria
      // validar **o endereço errado**, falharia, e inativaria de novo — um ciclo. Corrigir a URL já
      // leva a situação a *aguardando validação* sozinho, e pode tornar a reativação desnecessária.
      expect(par.chamadas.atualizacao).toBe(1);
      expect(par.chamadas.reativacao).toBe(0);
      expect((resposta.corpo as EstadoDaEntrega).situacao).toBe('EM_VALIDACAO');
    },
    LIMITE_CASO_MS,
  );

  it(
    'CT-1055 (d) — o ato de correção que o provedor RECUSA vira desabilitação com a causa dele',
    async () => {
      const { autoridade, par } = await armarProvedor('ct1055d');
      await registrarPreCondicoes(cookieDeA, autoridade);

      par.responderAConsulta({
        status: STATUS_OK,
        corpo: corpoDeCadastroInativado(ENDERECO_DA_ENTREGA),
      });

      const recusaDaReativacao = {
        codigo: '10777',
        mensagem: 'nao foi possivel reativar o webhook informado',
      };
      par.responderAReativacao({
        status: STATUS_CAMPO_INVALIDO,
        corpo: JSON.stringify({ mensagens: [recusaDaReativacao] }),
      });
      par.zerar();

      const resposta = await pedir(base, ROTA_DA_ATIVACAO, {
        metodo: 'POST',
        cookie: cookieDeA,
        corpo: {},
      });

      // A recusa do provedor **não vira exceção**: `200`, e o desfecho carrega a causa.
      expect(resposta.status).toBe(STATUS_OK);

      const estado = resposta.corpo as EstadoDaEntrega;

      expect(estado.situacao).toBe('DESABILITADA');
      expect(estado.motivo?.codigo).toBe(recusaDaReativacao.codigo);
      expect(estado.motivo?.mensagem).toBe(recusaDaReativacao.mensagem);

      // Âncora antivácuo: a reativação de fato foi tentada. Sem ela, o desabilitado acima seria
      // compatível com uma implementação que nem chegasse a agir.
      expect(par.chamadas.reativacao).toBe(1);
    },
    LIMITE_CASO_MS,
  );
});

/** Sobe o par do caso, instala a confiança na autoridade dele e aponta a porta para ele. */
async function armarProvedor(nome: string): Promise<{
  readonly autoridade: AutoridadeDeTeste;
  readonly par: ParInstrumentado;
}> {
  // ⚠️ UMA autoridade só, e ela emite **os dois lados**: o certificado do par e o material que o
  // cliente apresenta. É isso que torna a confiança e a recusa observáveis pela **decisão do par** —
  // com autoridades distintas, o aperto de mão cairia por cadeia divergente, e todo desfecho negativo
  // deste arquivo passaria a medir outra coisa.
  const autoridade = await gerarAutoridadeDeTeste(nome);
  confiarEm(autoridade);

  const par = await subirParInstrumentado(autoridade, ENDERECO_DA_ENTREGA);
  destinoDoProvedor = par.endereco;

  return { autoridade, par };
}

/** Registra as **duas** pré-condições do ato externo pelas rotas reais. */
async function registrarPreCondicoes(cookie: string, autoridade: AutoridadeDeTeste): Promise<void> {
  await registrarCertificado(cookie, autoridade);
  await registrarIdentidade(cookie);
}

/** Registra o certificado vigente pela rota real, com material gerado em execução. */
async function registrarCertificado(cookie: string, autoridade: AutoridadeDeTeste): Promise<void> {
  const material = await gerarMaterialDeTeste({
    autoridade,
    senha: SENHA_DO_MATERIAL,
    diasDeValidade: DIAS_VIGENTE_FOLGADO,
  });

  const resposta = await pedir(base, ROTA_DO_REGISTRO, {
    metodo: 'POST',
    cookie,
    corpo: {
      material: material.material.toString('base64'),
      senha: material.senha,
    },
  });

  if (resposta.status !== STATUS_CRIADO) {
    throw new Error(
      `o registro do certificado respondeu ${String(resposta.status)}: ${resposta.texto}`,
    );
  }
}

/** Registra a identidade da empresa perante o provedor pela rota real. */
async function registrarIdentidade(cookie: string): Promise<void> {
  const resposta = await pedir(base, ROTA_DA_IDENTIDADE, {
    metodo: 'POST',
    cookie,
    corpo: {
      identificadorDaAplicacao: randomUUID(),
      numeroDoCliente: 987_654,
      numeroDaContaCorrente: 12_345,
      codigoDaModalidade: 1,
    },
  });

  if (resposta.status !== STATUS_CRIADO) {
    throw new Error(
      `o registro da identidade respondeu ${String(resposta.status)}: ${resposta.texto}`,
    );
  }
}

// DÉBITO COM GATILHO — D32 · F5/T7 · registrado 2026-08-22 · metade PAGA em 2026-09-01
// (NÃO é uma `DECISÃO FECHADA`: ele agenda uma convergência, não protege o código abaixo.)
// ⚠️ PAGO: {@link entrarComSegundoFatorCumprido} tinha SEIS escritas privadas e hoje tem UMA, em
//        `./acessorios-de-borda.ts`, de onde esta suíte e as outras cinco a IMPORTAM. Fechou na T3
//        da fatia `painel-master-administradores`, que é literalmente o gatilho que este marcador
//        declarava — *a primeira task autorizada a abrir qualquer uma das seis*. **Não reponha a
//        cópia**, e não reabra esta metade: a prova é a baseline do pacote `api`, comparada arquivo
//        a arquivo, com as seis suítes saindo idênticas (410 → 410). O marcador PERMANECE porque as
//        outras duas metades abaixo continuam abertas — apagá-lo por número levaria as duas junto.
// ⚠️ RESSALVA MEDIDA (2026-09-02, débito `D5` da §2 desta fatia): o *"hoje tem UMA"* acima é verdade
//        pelo **nome** e incompleto pelo **comportamento**. Resta **uma sétima cópia semântica sob
//        outro nome** — `entrarComoOperadorDoSaaS`, em `./campos-fechados.e2e.spec.ts:1057` —, com o
//        **mesmo fluxo** (entrar → `two-factor/enable` → `generateTOTP` → `two-factor/verify-totp`).
//        Não tê-la tocado na T3 foi **correto**: aquela suíte está fora da §5.2 daquela task, e abrir
//        suíte alheia não declarada é o que a §4.5 do Protocolo proíbe. Ela converte quando a
//        primeira task autorizada a abrir `campos-fechados.e2e.spec.ts` chegar. Isto **não** reabre a
//        metade paga — o que fechou foi a convergência pelo NOME, e esta linha é o que impede o
//        próximo leitor de concluir que não sobrou nada a converter.
// O QUÊ: dois acessórios de arranjo ainda têm mais de uma escrita, e as contagens são MEDIDAS —
//        `grep -rln --exclude-dir=dist "function <nome>" apps packages`, em 2026-08-22.
//        {@link envelhecerOVigente} existe em **duas** — esta e
//        `./certificado-do-provedor.e2e.spec.ts`. {@link montarEmpresaComAdmin} existe em **duas**
//        formas — esta e, partida em `criarEmpresa`/`admitirAdministrador`/`administradorEmOperacao`,
//        `./recusa-indistinguivel.e2e.spec.ts`. Nenhuma pode ser importada de onde está: importar de
//        um arquivo `.spec.ts` executa o módulo dele e registra os casos daquela suíte DENTRO da
//        importadora — e é por isso que a casa compartilhada, que não é `.spec.ts`, é o destino das
//        duas quando o gatilho chegar.
// QUANDO FECHA: para as duas restantes o gatilho é o Limiar de Três: a **terceira** suíte que
//        precisar de empresa nova ou de retroagir a vigência, ou a primeira task autorizada a abrir a
//        suíte doadora por outra razão.
// POR QUE NÃO AGORA: `./certificado-do-provedor.e2e.spec.ts` está fora da lista de arquivos da T3, e
//        abrir suíte alheia que a task não declarou é exatamente a superfície de regressão que a
//        `.claude/rules/nao-regressao.md` §4.5 proíbe — a T3 converteu as seis do primeiro acessório
//        porque elas ERAM o objeto declarado dela, não por estarem a caminho.
// ÍNDICE: docs/specs/features/integracao-bancaria-autonoma/v1/_run/run-report.md §2, D32

/** Uma empresa nova com o Admin dela **operando** — senha trocada e sessão plena. */
interface EmpresaMontada {
  readonly empresaId: string;
  readonly cookie: string;
}

/**
 * Monta uma empresa nova com Admin operando, **pelas rotas reais do operador do SaaS**.
 *
 * ⚠️ Ela custa uma troca de senha por chamada, e o teto é dez por minuto: os pedidos desta suíte não
 * declaram `x-forwarded-for`, e o limitador então os conta todos no balde do endereço local — uma
 * chave só para o caminho. Este arquivo gasta **quatro**: uma no `CT-1029` e três no `CT-1047`.
 * (O ponteiro daqui era o débito `D27` de `packages/auth/src/autenticacao.ts`, FECHADO na T8 da
 * fatia `publicacao-e-backup`.)
 *
 * ⚠️ Ela é a **segunda** escrita desta forma (a primeira é privada de `./recusa-indistinguivel.e2e.spec.ts`,
 * de onde não pode ser importada sem registrar os casos daquela suíte aqui dentro). O Limiar de Três
 * do `CLAUDE.md` dispara na terceira: ali as duas sobem para a casa compartilhada do diretório.
 */
async function montarEmpresaComAdmin(): Promise<EmpresaMontada> {
  const criada = await pedir(base, CAMINHO_DAS_EMPRESAS, {
    metodo: 'POST',
    cookie: cookieDoMaster,
    // Documento sorteado por execução: ele é único, e um literal faria a segunda chamada recusar por
    // duplicidade.
    corpo: { nome: 'Imobiliária da entrega da notícia Ltda', documento: randomUUID() },
  });

  if (criada.status !== STATUS_CRIADO) {
    throw new Error(`a criação de empresa respondeu ${String(criada.status)}: ${criada.texto}`);
  }

  const empresaId = (criada.corpo as { id: string }).id;
  const email = `admin.${randomUUID()}@exemplo.com.br`;

  const admitido = await pedir(base, `${CAMINHO_DAS_EMPRESAS}/${empresaId}/admin`, {
    metodo: 'POST',
    cookie: cookieDoMaster,
    corpo: { nome: 'Administrador da entrega', email },
  });

  if (admitido.status !== STATUS_CRIADO) {
    throw new Error(
      `a admissão de administrador respondeu ${String(admitido.status)}: ${admitido.texto}`,
    );
  }

  const { senhaProvisoria } = admitido.corpo as { senhaProvisoria: string };
  const restrita = await pedir(base, ROTA_DE_ENTRADA, {
    metodo: 'POST',
    corpo: { email, password: senhaProvisoria },
  });

  if (restrita.status !== STATUS_OK) {
    throw new Error(`a entrada do Admin respondeu ${String(restrita.status)}: ${restrita.texto}`);
  }

  const cookie = credencialDeSessao(restrita);
  // A troca é obrigatória (RN-09) e acontece pela rota do produto: sem ela a sessão nasce
  // **restrita**, e toda rota de negócio responderia `403` da restrição — o que faria as recusas
  // deste arquivo medirem outra coisa.
  const troca = await pedir(base, ROTA_DE_TROCA_DE_SENHA, {
    metodo: 'POST',
    cookie,
    corpo: { senhaAtual: senhaProvisoria, senhaNova: SENHA_TROCADA },
  });

  if (troca.status !== STATUS_OK) {
    throw new Error(`a troca de senha respondeu ${String(troca.status)}: ${troca.texto}`);
  }

  const reemitido = troca.cookies.find((bruto) => bruto.includes('session_token'));

  return {
    empresaId,
    cookie: reemitido === undefined ? cookie : (reemitido.split(';')[0] ?? cookie),
  };
}

/**
 * Retroage a validade do certificado vigente da empresa, **no eixo do BANCO**.
 *
 * ⚠️ Ela é a **segunda** escrita desta função — a primeira é privada de
 * `./certificado-do-provedor.e2e.spec.ts`, de onde não pode ser importada sem registrar os casos
 * daquela suíte aqui dentro. O caminho é o mesmo, byte a byte: sob contexto de tenant, com a data
 * derivada de `pg_catalog.now()` no servidor — **nunca** por relógio falso, que alcançaria tudo o que
 * o processo agenda e está fora da stack de teste deste projeto.
 */
async function envelhecerOVigente(empresaId: string): Promise<void> {
  await contextoDeTenant.executarCom({ empresaId }, async () => {
    await acessoAoNegocio.emUnidadeDeTrabalho(async (tx) => {
      await tx`
        UPDATE negocio.certificado_do_provedor
           SET valido_ate = pg_catalog.now() - make_interval(days => ${DIAS_DE_ATRASO_DO_VENCIDO})
         WHERE substituido_em IS NULL
      `;
    });
  });
}

/**
 * Quantas linhas de `negocio.entrega_da_noticia` o contexto da empresa informada alcança.
 *
 * A contagem é **crua** e sem recorte: o que os casos medem é quantas linhas existem. Nenhum
 * `WHERE empresa_id` é escrito aqui — quem recorta é a política (ADR-0008) —, e a empresa entra pelo
 * **contexto**, que é o mesmo mecanismo que a aplicação usa.
 */
async function contarEstados(empresaId: string): Promise<number> {
  return await contextoDeTenant.executarCom({ empresaId }, async () => {
    return await acessoAoNegocio.emUnidadeDeTrabalho(async (tx) => {
      const [linha] = await tx<{ total: string }[]>`
        SELECT count(*) AS total
          FROM negocio.entrega_da_noticia
      `;

      return Number(linha?.total ?? 0);
    });
  });
}

/**
 * As chaves de um corpo, ordenadas — a forma de afirmar **ausência** de campo por igualdade.
 *
 * Ela é o instrumento que discrimina *"a chave não está no corpo"* de *"a chave está com valor
 * indefinido"*: sob `exactOptionalPropertyTypes` as duas não são a mesma coisa, e só a comparação de
 * conjunto as separa.
 */
function chavesDe(corpo: unknown): string[] {
  return corpo === null || typeof corpo !== 'object'
    ? []
    : Object.keys(corpo as Record<string, unknown>).sort();
}

/**
 * Varre um texto de saída real procurando cada agulha, e devolve as **encontradas**, em ordem.
 *
 * Ela devolve a lista, e nunca um booleano: a falha precisa NOMEAR a agulha e o canal. É a mesma
 * disciplina de `apps/worker/test/varredura-de-segredo.ts`, e todo caso que a usa carrega o controle
 * positivo no mesmo bloco — sem ele, uma varredura que não pode achar nada aprovaria um produto
 * vazando tudo (AP-29).
 */
function varrer(texto: string, agulhas: readonly string[]): string[] {
  return agulhas.filter((agulha) => texto.includes(agulha));
}

/** O identificador do usuário da carga, pelo e-mail — lido do banco, sem `WHERE empresa_id`. */
async function usuarioDaCarga(email: string): Promise<string> {
  const [linha] = await acessoAoNegocio.emUnidadeDeTrabalho(
    async (tx) =>
      await tx<{ id: string }[]>`
        SELECT id FROM identidade.usuario WHERE email = ${email}
      `,
  );

  if (linha === undefined) {
    throw new Error(`a carga não tem usuário com e-mail ${email}`);
  }

  return linha.id;
}

/** Um objeto aninhado com a profundidade pedida — o corpo degenerado do terceiro cenário. */
function aninhar(profundidade: number): Record<string, unknown> {
  let fundo: Record<string, unknown> = { fim: true };
  for (let nivel = 0; nivel < profundidade; nivel += 1) {
    fundo = { nivel: fundo };
  }
  return fundo;
}
