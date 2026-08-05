/**
 * Campos com escrita fechada e limitador de taxa — CT-235 e a perna de envelope do CT-236.
 * T6 da fatia `autorizacao-e-ciclo-de-acesso`, que fecha o débito herdado `D7`.
 *
 * ---------------------------------------------------------------------------
 * INVARIANTES
 * ---------------------------------------------------------------------------
 *
 * | Critério | Caso   | Invariante |
 * |---|---|---|
 * | CA-16 | CT-235 | Nenhum caminho autenticado permite que o CORPO de uma requisição altere o
 * |       |        | perfil ou a empresa de uma pessoa: os dois são campos adicionais com escrita
 * |       |        | fechada, e o valor persistido continua sendo o que o servidor decidiu. Vale
 * |       |        | para a elevação de perfil **e** para a troca lateral de empresa mantendo o
 * |       |        | mesmo perfil — o vetor que a restrição `usuario_master_sem_empresa_chk` NÃO
 * |       |        | pega, e que nenhuma suíte pegava, porque `identidade` não tem RLS (ADR-0009). |
 * | CA-16 | CT-235 | Criar pessoa pelo adaptador FUNCIONA — o `INSERT` sai com `perfil` e
 * |       |        | `empresa_id`, e a credencial emitida entra pela rota real de entrada. O
 * |       |        | corpo que a rota receberia não governa nenhum dos dois. |
 * | —     | CT-236 | A recusa do limitador de taxa chega ao cliente no envelope canônico
 * |       |        | (`REQUISICAO_RECUSADA`) com o status de origem preservado, **sem virar 500**
 * |       |        | e sem virar recusa de credencial. (P-T6-2, ADR-0012) |
 * | —     | CT-236 | A troca de senha **do produto** (`POST /v1/sessao/senha`) corre sob o teto de
 * |       | (d)    | CREDENCIAL: a conferência de `senhaAtual` acima do teto é recusada pelo
 * |       |        | limitador, por origem e por caminho, e não fica sem teto nenhum. (P-T6-2) |
 *
 * Rastreabilidade: `CA-16 → CT-235 (RN-13)` e `P-T6-2 → CT-236 (RN-06)`.
 *
 * ---------------------------------------------------------------------------
 * Por que o CT-236 (d) — a rota do produto trocou de porta de entrada, e quase perdeu o teto
 * ---------------------------------------------------------------------------
 *
 * A T9 tirou `POST /v1/auth/change-password` da superfície publicada e pôs no lugar
 * `POST /v1/sessao/senha`. A primeira versão dela gravava por `auth.api.changePassword` — uma porta
 * **lateral ao roteador**, que entrega o manipulador do endpoint e deixa para trás tudo o que vive
 * no `onRequest`, inclusive o limitador de taxa. O efeito, medido pelo Gate 2: a conferência da
 * senha em vigor passou a não ter teto nenhum, num caminho em que o contador POR CONTA da RN-06
 * **não existe** (ele só corre no caminho de entrada) e cujo acerto, por desenho, encerra as demais
 * sessões e expulsa o titular.
 *
 * Este caso é a rede desse eixo, e ele precisa morar **aqui**, e não em
 * `packages/auth/test/bloqueio.spec.ts`: as pernas de lá exercitam `/change-password` na INSTÂNCIA
 * do arcabouço, e continuariam verdes com a rota do produto gravando por fora do roteador. O que
 * discrimina é a **superfície publicada** — e ela é `apps/api`.
 *
 * O mutante correspondente é a reversão literal: trocar o repasse por `auth.api.changePassword` em
 * `apps/api/src/autenticacao/senha.controller.ts`. Com ele, a requisição de número TETO+1 volta a
 * ser a recusa normal por senha incorreta, e a perna 2 reprova.
 *
 * ===========================================================================
 * O QUE DISCRIMINA, E O QUE APENAS COBRE — leia antes de simplificar qualquer asserção
 * ===========================================================================
 *
 * A §7 da task é literal: *"não simplifique o CT-235 para 'tentei mudar o perfil e não deixou'"*. A
 * elevação de perfil é o eixo FÁCIL, e ela sozinha **não discrimina**: sem campo adicional algum
 * declarado — que é o estado que o `D7` descrevia —, `POST /update-user` já respondia recusa, por
 * "nenhum campo a atualizar". Um SUT sem a correção passaria por aquele eixo.
 *
 * O que discrimina são três coisas:
 *
 *   1. **A troca lateral de empresa mantendo `ADMIN_EMPRESA`** — o `usuario_master_sem_empresa_chk`
 *      exige `(perfil = 'SYSLOC_MASTER') = (empresa_id IS NULL)`, e essa combinação passa por ele.
 *      É a fuga de tenant, e a asserção é sobre a COLUNA e sobre a ausência de vínculo novo em
 *      `negocio.acesso_usuario_app`, nunca sobre o status da resposta.
 *   2. **A criação funcionando** — sem os campos declarados o `INSERT` sai sem `perfil`, coluna
 *      `NOT NULL` sem padrão, e o banco recusa. É a metade do `D7` que uma correção que apenas
 *      "fechasse a escrita" (por exemplo, não declarando nada) deixaria quebrada.
 *   3. **A prova de falsificação** — abaixo.
 *
 * ---------------------------------------------------------------------------
 * PROVA DE FALSIFICAÇÃO (obrigatória — `.claude/rules/testing-stack.md`)
 * ---------------------------------------------------------------------------
 *
 * O mutante é **abrir a escrita do campo adicional**: em `packages/auth/src/autenticacao.ts`, trocar
 * `input: false` por `input: true` em `user.additionalFields`. Rodado por
 * `pnpm --filter @sysloc/api test` — **nunca** `vitest run` avulso, porque este arquivo alcança
 * `@sysloc/auth` pela fronteira do pacote e leria o `dist/` da compilação anterior.
 *
 * Três execuções, e o resultado de cada uma:
 *
 *   * **controle** (código íntegro) — `65 passed`, limpo;
 *   * **mutante nos DOIS campos** — reprova na COLUNA, e não no status:
 *     `expected { perfil: 'SYSLOC_MASTER', … } to deeply equal { perfil: 'USUARIO_EMPRESA', … }`.
 *     A elevação de privilégio aconteceu de fato;
 *   * **mutante só em `empresaId`** (com `perfil` fechado) — reprova na perna da troca lateral,
 *     que é a que o `usuario_master_sem_empresa_chk` não pega. Esta terceira execução existe
 *     porque a primeira falha mascara as pernas seguintes, e sem ela o eixo de fuga de tenant
 *     ficaria sem prova própria.
 *
 * A primeira tentativa deste caso **não** discriminava — o mutante sobrevivia às duas execuções —,
 * e a causa está registrada na Fase 2 abaixo: sobre uma pessoa COM vínculo em
 * `negocio.acesso_usuario_app`, quem barra a troca de empresa é a chave estrangeira composta da T1,
 * no banco, antes de a escrita fechada ser consultada.
 *
 * ---------------------------------------------------------------------------
 * A criação é exercitada pela CAMADA que a rota do produto vai chamar
 * ---------------------------------------------------------------------------
 *
 * `POST /v1/usuarios` e `POST /v1/master/empresas/:id/admin` nascem na T7 e na T8. Até lá, a criação
 * acontece por `criarPessoa` — a mesma função que aquelas rotas chamarão por dentro. É o padrão que
 * `test/autorizacao.e2e.spec.ts` já usa para os ajustes de permissão, e pela mesma razão: o que muda
 * quando a rota existir é a borda, não o efeito observado.
 *
 * O vetor de injeção é modelado como a rota o receberia — **um corpo de requisição, com chaves que
 * ninguém declarou**, espalhado sobre a chamada. Aí também há eixo que cobre e eixo que discrimina:
 * `perfil` e `empresaId` no corpo são sobrescritos pelo que o servidor decide, e um SUT que
 * espalhasse o corpo passaria nesse eixo; o que reprova o espalhamento são as chaves que **não**
 * pertencem ao contrato de `criarPessoa` e que, se ele espalhasse, chegariam ao `INSERT` — `id`
 * (escolher a chave primária), `emailVerified` (nascer com o endereço confirmado) e a marca de senha
 * provisória (nascer sem a restrição da RN-09).
 *
 * ---------------------------------------------------------------------------
 * De onde vêm o banco, a fila e a credencial (ADR-0006)
 * ---------------------------------------------------------------------------
 *
 * De instâncias efêmeras próprias; nenhuma coordenada de conexão é lida do ambiente — o ambiente do
 * processo é MONTADO a partir do que os helpers devolvem. A porta é **reservada**, e não dinâmica,
 * pela razão que a T8 da fatia anterior registrou: o arcabouço confere a origem das requisições com
 * cookie contra o endereço base, composto a partir da porta CONFIGURADA.
 */

import { randomBytes, randomUUID } from 'node:crypto';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import { criarPessoa, limparMarcaDeSenhaProvisoria, reemitirSenhaProvisoria } from '@sysloc/auth';
import {
  type AcessoAoBanco,
  abrirAcessoAoBanco,
  contextoDeTenant,
  EMPRESA_A,
  EMPRESA_B,
  esquemaIdentidade,
  SENHA_DA_CARGA,
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
import { AppModule } from '../src/app.module.ts';
import { PREFIXO_DAS_ROTAS_DE_IDENTIDADE } from '../src/autenticacao/autenticacao.module.ts';
import { CAMINHO_DA_TROCA_DE_SENHA_DO_PRODUTO } from '../src/autenticacao/senha.controller.ts';
import { ENDERECO_DE_ESCUTA, PREFIXO_DE_VERSAO } from '../src/configuracao/ambiente.ts';

/** Limite da montagem: banco migrado, semente, fila e a aplicação. */
const LIMITE_DE_MONTAGEM_MS = 240_000;

/** Limite de um caso que atravessa HTTP e banco várias vezes. */
const LIMITE_CASO_MS = 120_000;

/** Sufixo do nome do cookie de sessão do arcabouço — o prefixo vem da configuração. */
const SUFIXO_DO_COOKIE_DE_SESSAO = 'session_token';

/** A rota NATIVA de autosserviço do arcabouço: é por ela que o corpo alcançaria o modelo `user`. */
const CAMINHO_DA_ATUALIZACAO_DE_PESSOA = `${PREFIXO_DAS_ROTAS_DE_IDENTIDADE}/update-user`;

/** A rota NATIVA de entrada, pela qual toda credencial é conferida. */
const CAMINHO_DE_ENTRADA = `${PREFIXO_DAS_ROTAS_DE_IDENTIDADE}/sign-in/email`;

/** O sujeito do CT-235: `ADMIN_EMPRESA` da empresa A, com senha já trocada (a carga não a marca). */
const ADMIN_DA_EMPRESA_A = pessoaSemeada('admin.a@exemplo.com.br');

/** O perfil que a rota do produto declarará para quem ela cria. */
const PERFIL_DECLARADO_PELA_ROTA = 'USUARIO_EMPRESA';

/** O perfil que o corpo tenta injetar. É o mais alto que existe — o pior caso da elevação. */
const PERFIL_INJETADO_PELO_CORPO = 'SYSLOC_MASTER';

/** Nome da pessoa que nasce no caso. Não pode conter pedaço do e-mail dela (política da RN-05). */
const NOME_DA_PESSOA_NASCIDA = 'Pessoa do Onboarding';

/** O status com que o arcabouço recusa credencial incorreta. */
const STATUS_DE_CREDENCIAL_RECUSADA = 401;

/** Menor status que já não é sucesso. Abaixo dele, a resposta CONFIRMARIA a escrita. */
const PRIMEIRO_STATUS_QUE_NAO_E_SUCESSO = 300;

/** A faixa que o filtro global classifica como recusa de cliente (ADR-0012). */
const PRIMEIRO_STATUS_DE_SERVIDOR = 500;

/** O status que o limitador de taxa do arcabouço emite. */
const STATUS_DO_LIMITADOR = 429;

/**
 * Quantas requisições ao caminho de entrada esgotam o teto da janela, **por extenso**.
 *
 * Escrito por extenso e não derivado de `TETO_DE_ENTRADAS_POR_JANELA`: derivá-lo faria o laço
 * acompanhar um teto alargado até o limitador nunca disparar, e o caso continuaria verde. A amarra
 * entre este número e a constante do SUT é feita no CT-236 de `packages/auth/test/bloqueio.spec.ts`,
 * que é onde a política mora — repeti-la aqui criaria duas âncoras livres para divergir.
 */
const ENTRADAS_ATE_O_TETO = 30;

/**
 * A origem exclusiva da perna do limitador, na faixa de documentação (RFC 5737).
 *
 * O contador é por `origem + caminho`: sem um endereço próprio, as entradas legítimas dos demais
 * casos deste arquivo consumiriam o teto, e o caso passaria — ou reprovaria — por vizinhança.
 */
const ORIGEM_DO_LIMITADOR = '203.0.113.41';

/** A mensagem canônica de `REQUISICAO_RECUSADA`, por extenso — ver o CT-214. */
const MENSAGEM_DE_REQUISICAO_RECUSADA = 'requisição recusada';

// ---------------------------------------------------------------------------------------------
// CT-236 (d) — a troca de senha do produto corre sob o teto de credencial
// ---------------------------------------------------------------------------------------------

/** A rota da troca de senha do produto, composta a partir do DONO do segmento. */
const ROTA_DA_TROCA_DO_PRODUTO = `/${PREFIXO_DE_VERSAO}/${CAMINHO_DA_TROCA_DE_SENHA_DO_PRODUTO}`;

/**
 * O sujeito do CT-236 (d) — `ADMIN_EMPRESA` da empresa B, exclusivo deste caso.
 *
 * Exclusivo porque o caso emite mais de uma dezena de trocas com a senha atual errada; reaproveitar
 * a pessoa do CT-235 faria um caso mexer no estado observado pelo outro.
 */
const ADMIN_DA_EMPRESA_B = pessoaSemeada('admin.b@exemplo.com.br');

/**
 * Quantas trocas esgotam o teto do grupo de CREDENCIAL, **por extenso**.
 *
 * Escrito por extenso e não derivado de `TETO_DE_CREDENCIAL_POR_JANELA`, pela razão que
 * {@link ENTRADAS_ATE_O_TETO} registra: derivá-lo faria o laço acompanhar um teto alargado até o
 * limitador nunca disparar. A amarra entre este número e a constante do SUT é feita uma vez, no
 * `CT-236 (b)` de `packages/auth/test/bloqueio.spec.ts`, que é onde a política mora.
 */
const TROCAS_ATE_O_TETO = 10;

/** A origem exclusiva da perna limitada, na faixa de documentação (RFC 5737). */
const ORIGEM_DA_TROCA = '203.0.113.42';

/** A origem da perna vizinha — inédita, porque o contador é por `origem + caminho`. */
const ORIGEM_VIZINHA_DA_TROCA = '203.0.113.43';

/** Senha que a conta não tem. Longa o bastante para não ser recusada por comprimento antes da hora. */
const SENHA_ATUAL_ERRADA = 'nao-e-a-senha-desta-conta';

/** Senha nova bem formada — a política de força não pode ser o que recusa nestas pernas. */
const SENHA_NOVA_BEM_FORMADA = 'Trilha9Verde!';

/**
 * Senha nova que a política de força recusa — curta demais.
 *
 * Ela é o que torna o aquecimento barato: a recusa vem do `hooks.before` de `@sysloc/auth`, que
 * corre **antes** do manipulador e portanto sem pagar derivação de senha. O limitador, que corre
 * antes de tudo, conta a requisição do mesmo jeito.
 */
const SENHA_NOVA_FRACA = 'curta';

/** O status com que a troca recusa a senha atual incorreta (§4.1 do contrato). */
const STATUS_DE_SENHA_ATUAL_INCORRETA = 422;

/** A mensagem canônica de `CAMPO_INVALIDO`, por extenso. */
const MENSAGEM_DE_CAMPO_INVALIDO = 'requisição inválida';

let identidade: IdentidadeEfemera;
let fila: FilaEfemera;
let acessoAoNegocio: AcessoAoBanco;
let aplicacao: NestFastifyApplication;
let base: string;
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

  const modulo = await Test.createTestingModule({ imports: [AppModule] }).compile();

  aplicacao = modulo.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
  aplicacao.setGlobalPrefix(PREFIXO_DE_VERSAO);
  await aplicacao.listen({ port: porta, host: ENDERECO_DE_ESCUTA });
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

describe('CT-235 — perfil e empresaId não são escrevíveis pelo corpo da requisição (D7)', () => {
  it(
    'as tentativas pelo corpo deixam as colunas idênticas, e a criação pelo servidor funciona',
    async () => {
      const vinculosDeBAntes = await contarVinculos(EMPRESA_B.id);

      // ------------------------------------------------------------------------------------
      // Fase 1 — CRIAÇÃO pelo caminho do produto, com o corpo tentando injetar.
      // ------------------------------------------------------------------------------------
      const email = `nascida.${randomUUID()}@exemplo.com.br`;
      const idQueOCorpoEscolheu = randomUUID();

      // O corpo que a rota receberia. `Record<string, unknown>` de propósito: é o que a borda
      // interpreta de um pedido, e é o que um SUT que espalhasse o corpo levaria ao `INSERT`.
      const corpoDaCriacao: Record<string, unknown> = {
        id: idQueOCorpoEscolheu,
        perfil: PERFIL_INJETADO_PELO_CORPO,
        empresaId: EMPRESA_B.id,
        emailVerified: true,
        senhaProvisoria: false,
        ativo: false,
      };

      const criada = await criarPessoa(identidade.autenticacao, identidade.acesso.identidade, {
        // O servidor decide, e é isto que a rota fará: o perfil vem do campo declarado dela, a
        // empresa vem do contexto — nunca do corpo.
        ...corpoDaCriacao,
        nome: NOME_DA_PESSOA_NASCIDA,
        email,
        perfil: PERFIL_DECLARADO_PELA_ROTA,
        empresaId: EMPRESA_A.id,
      });

      // Criar pelo adaptador FUNCIONA, e o `INSERT` saiu com os dois campos do produto: é a metade
      // do `D7` que a declaração fecha, e sem ela o banco recusaria o `INSERT` inteiro.
      const nascida = { perfil: PERFIL_DECLARADO_PELA_ROTA, empresaId: EMPRESA_A.id };
      expect(await lerIdentidade(criada.usuarioId)).toEqual(nascida);

      // Nada do corpo governou o restante da linha: o identificador é do banco, o endereço nasce
      // não confirmado, a pessoa nasce ativa e com a marca de senha provisória de pé (RN-09). São
      // as chaves que NÃO pertencem ao contrato de `criarPessoa`, e é por elas que um SUT que
      // espalhasse o corpo reprovaria — ver o cabeçalho.
      expect(criada.usuarioId).not.toBe(idQueOCorpoEscolheu);
      expect(await lerEstadoDaPessoa(criada.usuarioId)).toEqual({
        emailVerificado: false,
        ativo: true,
        senhaProvisoria: true,
      });

      // E a credencial emitida entra de verdade, pela rota REAL: sem isso, "o INSERT funcionou"
      // seria uma afirmação sobre linhas, e não sobre uma pessoa que consegue usar o sistema.
      const cookieDaNascida = await entrarCom(email, criada.senhaProvisoria);

      // O par negativo da credencial: a senha da carga — que é a de todo mundo, menos dela — não
      // entra. Sem esta perna, "a senha provisória entra" passaria sobre uma conta que aceita
      // qualquer coisa.
      const comSenhaAlheia = await pedir(CAMINHO_DE_ENTRADA, {
        metodo: 'POST',
        corpo: { email, password: SENHA_DA_CARGA },
      });
      expect(comSenhaAlheia.status).toBe(STATUS_DE_CREDENCIAL_RECUSADA);

      // ------------------------------------------------------------------------------------
      // Fase 2 — OS VETORES SOBRE A PESSOA RECÉM-CRIADA. É aqui que o caso DISCRIMINA.
      //
      // Ela não tem linha em `negocio.acesso_usuario_app`, e é isso que a torna o sujeito certo:
      // a chave estrangeira composta que a T1 instalou — `(usuario_id, empresa_id)` do vínculo
      // apontando para `(id, empresa_id)` da pessoa — barra a troca de empresa de quem TEM
      // vínculo, no banco, antes de qualquer defesa de aplicação. Sobre quem não tem vínculo, a
      // escrita fechada é a ÚNICA defesa, que é exatamente o que o D7 diz por escrito
      // ("`input: false` É DEFESA DE APLICAÇÃO, não estrutural").
      // ------------------------------------------------------------------------------------

      // (a) ELEVAÇÃO PLENA — e ela vem com `empresaId: null`, que é o que a torna real: elevar
      // mantendo a empresa esbarraria no `usuario_master_sem_empresa_chk`, e o caso estaria
      // provando a restrição do banco em vez da escrita fechada. Assim, o par que o corpo pede é
      // COERENTE com o `CHECK`, e nada além da escrita fechada o impede.
      const elevacao = await pedir(CAMINHO_DA_ATUALIZACAO_DE_PESSOA, {
        metodo: 'POST',
        cookie: cookieDaNascida,
        corpo: { perfil: PERFIL_INJETADO_PELO_CORPO, empresaId: null },
      });

      // A COLUNA primeiro, e o status depois: o invariante é o valor persistido, e é ele que a
      // falha precisa nomear. Um SUT com a escrita aberta que respondesse não-2xx e gravasse assim
      // mesmo passaria por um caso que olhasse só para o status.
      expect(await lerIdentidade(criada.usuarioId)).toEqual(nascida);
      expect(elevacao.status).toBeGreaterThanOrEqual(PRIMEIRO_STATUS_QUE_NAO_E_SUCESSO);

      // (b) TROCA LATERAL DE EMPRESA MANTENDO O MESMO PERFIL — o companheiro negativo deste caso
      // (`ct_id: self`). É a combinação que o `usuario_master_sem_empresa_chk` ACEITA, e que
      // nenhuma suíte pegava porque `identidade` não tem RLS (ADR-0009).
      const trocaLateral = await pedir(CAMINHO_DA_ATUALIZACAO_DE_PESSOA, {
        metodo: 'POST',
        cookie: cookieDaNascida,
        corpo: { perfil: PERFIL_DECLARADO_PELA_ROTA, empresaId: EMPRESA_B.id },
      });

      // A asserção que importa é sobre AS DUAS COLUNAS: uma troca lateral bem-sucedida deixaria
      // `perfil` intacto e `empresa_id` mudado, e um caso que olhasse só para o perfil a
      // declararia impedida.
      const depoisDaTrocaLateral = await lerIdentidade(criada.usuarioId);
      expect(depoisDaTrocaLateral).toEqual(nascida);
      expect(depoisDaTrocaLateral.empresaId).not.toBe(EMPRESA_B.id);
      expect(trocaLateral.status).toBeGreaterThanOrEqual(PRIMEIRO_STATUS_QUE_NAO_E_SUCESSO);

      // (c) A forma MÍNIMA do mesmo vetor — só a empresa, sem perfil algum no corpo. Um SUT que
      // recusasse apenas o par `(perfil, empresa)` deixaria esta passar.
      const soAEmpresa = await pedir(CAMINHO_DA_ATUALIZACAO_DE_PESSOA, {
        metodo: 'POST',
        cookie: cookieDaNascida,
        corpo: { empresaId: EMPRESA_B.id },
      });

      expect(await lerIdentidade(criada.usuarioId)).toEqual(nascida);
      expect(soAEmpresa.status).toBeGreaterThanOrEqual(PRIMEIRO_STATUS_QUE_NAO_E_SUCESSO);

      // Nenhuma linha nova de vínculo na empresa alheia, depois dos três vetores: a fuga de tenant
      // não aconteceu nem por efeito colateral.
      expect(await contarVinculos(EMPRESA_B.id)).toBe(vinculosDeBAntes);

      // ------------------------------------------------------------------------------------
      // Fase 3 — OS MESMOS VETORES SOBRE O ADMIN SEMEADO, que TEM vínculo. Eixo que COBRE: ali as
      // duas defesas se somam, e a recusa não distingue qual delas agiu. Ele está aqui porque é o
      // caso REAL de operação — toda pessoa de empresa tem vínculo —, e porque um SUT que fechasse
      // a escrita só para quem não tem vínculo reprovaria aqui.
      // ------------------------------------------------------------------------------------
      const doAdmin = await lerIdentidade(ADMIN_DA_EMPRESA_A.id);

      // Precondição afirmada, e não suposta: sem ela, uma carga que já tivesse a pessoa em outra
      // empresa faria as comparações abaixo passarem sobre o estado errado.
      expect(doAdmin).toEqual({ perfil: 'ADMIN_EMPRESA', empresaId: EMPRESA_A.id });

      const cookieDoAdmin = await entrarCom(ADMIN_DA_EMPRESA_A.email, SENHA_DA_CARGA);

      for (const corpo of [
        { perfil: PERFIL_INJETADO_PELO_CORPO, empresaId: null },
        { perfil: doAdmin.perfil, empresaId: EMPRESA_B.id },
        { empresaId: EMPRESA_B.id },
      ]) {
        const tentativa = await pedir(CAMINHO_DA_ATUALIZACAO_DE_PESSOA, {
          metodo: 'POST',
          cookie: cookieDoAdmin,
          corpo,
        });

        expect(
          await lerIdentidade(ADMIN_DA_EMPRESA_A.id),
          `o corpo ${JSON.stringify(corpo)} moveu as colunas do Admin`,
        ).toEqual(doAdmin);
        expect(
          tentativa.status,
          `o corpo ${JSON.stringify(corpo)} respondeu ${String(tentativa.status)}`,
        ).toBeGreaterThanOrEqual(PRIMEIRO_STATUS_QUE_NAO_E_SUCESSO);
      }

      expect(await contarVinculos(EMPRESA_B.id)).toBe(vinculosDeBAntes);
    },
    LIMITE_CASO_MS,
  );
});

/**
 * A reemissão tem prova de rota no **CT-223**, na T7, onde nasce
 * `POST /v1/master/usuarios/:id/senha-provisoria`. Este caso não a antecipa: ele prova a metade que
 * é desta task — que a função de domínio invalida a anterior **no mesmo ato** —, pelo mesmo motivo
 * pelo qual `test/autorizacao.e2e.spec.ts` exercita `escreverAjustes` antes de a rota existir.
 *
 * Sem ele, a única função de segurança desta task ficaria com zero exercício, e o modo de falha é
 * SILENCIOSO: `updatePassword` atualiza a conta local por `providerId`, e um mapeamento errado
 * atualizaria zero linhas devolvendo uma senha que não entra em lugar nenhum — quem a recebesse
 * levaria horas para descobrir que o problema não era de digitação.
 */
describe('T6 §4 — a reemissão invalida a Senha provisória anterior no mesmo ato (RN-09)', () => {
  it(
    'a anterior deixa de entrar, a nova entra, e a marca de troca obrigatória volta de pé',
    async () => {
      const email = `reemitida.${randomUUID()}@exemplo.com.br`;

      const primeira = await criarPessoa(identidade.autenticacao, identidade.acesso.identidade, {
        nome: NOME_DA_PESSOA_NASCIDA,
        email,
        perfil: PERFIL_DECLARADO_PELA_ROTA,
        empresaId: EMPRESA_A.id,
      });

      // Controle positivo: a primeira senha entra. Sem ele, "a primeira não entra mais" passaria
      // sobre uma conta que nunca chegou a ter credencial nenhuma.
      await entrarCom(email, primeira.senhaProvisoria);

      // A marca é baixada pelo caminho real — é o que a troca de senha faz —, para que a asserção
      // final prove que a reemissão a LEVANTA, e não que ela nunca desceu.
      await baixarMarcaDeSenhaProvisoria(primeira.usuarioId);
      expect((await lerEstadoDaPessoa(primeira.usuarioId)).senhaProvisoria).toBe(false);

      const segunda = await reemitirSenhaProvisoria(
        identidade.autenticacao,
        identidade.acesso.identidade,
        { usuarioId: primeira.usuarioId, nome: NOME_DA_PESSOA_NASCIDA, email },
      );

      expect(segunda).not.toBe(primeira.senhaProvisoria);

      // A ANTERIOR deixou de derivar — e a recusa é a de credencial incorreta, indistinguível de
      // qualquer outra (RN-10). É esta a asserção que discrimina uma reemissão que apenas
      // acrescentasse credencial em vez de substituir a que havia.
      const comAAnterior = await pedir(CAMINHO_DE_ENTRADA, {
        metodo: 'POST',
        corpo: { email, password: primeira.senhaProvisoria },
      });
      expect(comAAnterior.status).toBe(STATUS_DE_CREDENCIAL_RECUSADA);

      // E a nova entra — o par que impede a leitura "a reemissão quebrou a conta".
      await entrarCom(email, segunda);

      // A troca obrigatória volta a valer: quem recebeu credencial de terceiro não fica com sessão
      // plena (RN-09).
      expect((await lerEstadoDaPessoa(primeira.usuarioId)).senhaProvisoria).toBe(true);
    },
    LIMITE_CASO_MS,
  );
});

describe('CT-236 — a recusa do limitador chega no envelope canônico, sem virar 500', () => {
  it(
    'a tentativa acima do teto responde REQUISICAO_RECUSADA com o status de origem preservado',
    async () => {
      // O aquecimento usa corpo malformado de propósito: o limitador corre no `onRequest`, ANTES do
      // casamento de rota, então ele conta estas requisições sem que nenhuma pague a derivação de
      // senha. O que esta perna afirma é a TRADUÇÃO da recusa do limitador; que a recusa dele venha
      // depois de tentativas de credencial reais é o que o CT-236 de
      // `packages/auth/test/bloqueio.spec.ts` afirma, na fronteira em que o limitador vive.
      const doAquecimento: number[] = [];
      for (let pedido = 0; pedido < ENTRADAS_ATE_O_TETO; pedido += 1) {
        const resposta = await pedir(CAMINHO_DE_ENTRADA, {
          metodo: 'POST',
          corpo: {},
          origem: ORIGEM_DO_LIMITADOR,
        });
        doAquecimento.push(resposta.status);
      }

      // Nenhuma das trinta foi recusada pelo limitador: é o companheiro negativo desta perna, e sem
      // ele um limitador de teto zero passaria a asserção seguinte.
      expect(doAquecimento.filter((status) => status === STATUS_DO_LIMITADOR)).toEqual([]);

      const acimaDoTeto = await pedir(CAMINHO_DE_ENTRADA, {
        metodo: 'POST',
        corpo: {},
        origem: ORIGEM_DO_LIMITADOR,
      });

      // O status de ORIGEM preservado — o do limitador, e não o `400` que o código carrega por
      // padrão. É o único ponto do sistema em que a resposta não usa o status associado ao código,
      // e é deliberado (ver a `DECISÃO FECHADA — T8 / Gate 2 (P1)` de `comum/filtro-excecao.ts`).
      expect(acimaDoTeto.status).toBe(STATUS_DO_LIMITADOR);
      expect(acimaDoTeto.status).toBeLessThan(PRIMEIRO_STATUS_DE_SERVIDOR);

      // O corpo INTEIRO por igualdade, e não a presença de um campo: um envelope com `detalhes`
      // vazando o motivo do arcabouço, ou com a mensagem em inglês dele, reprova aqui.
      expect(acimaDoTeto.corpo).toEqual({
        codigo: CodigoErro.REQUISICAO_RECUSADA,
        mensagem: MENSAGEM_DE_REQUISICAO_RECUSADA,
      });

      // E não virou erro do servidor nem recusa de credencial — os dois desfechos errados possíveis.
      expect(acimaDoTeto.corpo).not.toEqual(
        expect.objectContaining({ codigo: CodigoErro.ERRO_INTERNO }),
      );
      expect(acimaDoTeto.corpo).not.toEqual(
        expect.objectContaining({ codigo: CodigoErro.CREDENCIAL_INVALIDA }),
      );
    },
    LIMITE_CASO_MS,
  );
});

describe('CT-236 (d) — a troca de senha do produto corre sob o teto de credencial', () => {
  it(
    'a troca acima do teto é recusada pelo limitador, e a mesma janela de outra origem não é',
    async () => {
      const cookie = await entrarCom(ADMIN_DA_EMPRESA_B.email, SENHA_DA_CARGA);

      // ------------------------------------------------------------------------------------
      // Perna 1 — as N trocas DENTRO do teto. É o companheiro negativo: se o limitador recusasse
      // cedo, ou recusasse tudo, a lista não seria só de `422`.
      //
      // **O aquecimento usa senha NOVA fraca de propósito, e a última usa a forma do ataque.** O
      // limitador corre no `onRequest` do roteador, antes de qualquer manipulador, então ele conta
      // as duas formas igualmente; o que muda é o custo. A senha nova fraca é recusada pela política
      // de força (o `hooks.before` de `packages/auth`), que roda ANTES do manipulador e portanto
      // **sem pagar a derivação de senha** — ao passo que a forma do ataque, com senha nova válida,
      // chega ao manipulador e paga uma derivação por requisição. Pagar doze delas **não ameaça a
      // janela do limitador**: ela é DESLIZANTE POR REQUISIÇÃO, e não contada a partir da primeira.
      // Medido em `better-auth@1.6.25` (`dist/api/rate-limiter/index.mjs`): `decideConsume` só
      // reinicia o contador quando `now - data.lastRequest > windowInMs`, e o armazenamento em
      // memória renova `expiresAt` a cada requisição PERMITIDA. Para a janela virar no meio do caso
      // seria preciso um intervalo de 60 s entre duas requisições consecutivas, e não 60 s de
      // duração total — é o mesmo mecanismo que o docblock de `JANELA_DO_LIMITADOR_EM_SEGUNDOS`, em
      // `packages/auth/src/autenticacao.ts`, já registra ("rolante a partir do último pedido").
      //
      // O aquecimento barato existe por OUTRO eixo: doze derivações aproximariam o caso do
      // `LIMITE_CASO_MS` de 120 s, e sob suítes paralelas disputando CPU ele passaria a poder
      // reprovar por LENTIDÃO em vez de por defeito — que é o teste instável que
      // `.claude/rules/testing-stack.md` trata como defeito.
      //
      // A **última** requisição dentro do teto é a forma do ataque, e é ela que amarra a perna 2 ao
      // que o teto existe para limitar: a conferência da senha em vigor. A senha atual errada
      // também é deliberada e não é atalho — ela mantém a conta intacta entre as requisições, de
      // modo que todas são a MESMA operação e só o contador muda de uma para a outra. Com a senha
      // certa, a primeira troca invalidaria as seguintes.
      // ------------------------------------------------------------------------------------
      const dentroDoTeto: number[] = [];
      for (let troca = 0; troca < TROCAS_ATE_O_TETO - 1; troca += 1) {
        const resposta = await pedir(ROTA_DA_TROCA_DO_PRODUTO, {
          metodo: 'POST',
          cookie,
          origem: ORIGEM_DA_TROCA,
          corpo: { senhaAtual: SENHA_ATUAL_ERRADA, senhaNova: SENHA_NOVA_FRACA },
        });
        dentroDoTeto.push(resposta.status);
      }

      const ultimaDentroDoTeto = await pedir(ROTA_DA_TROCA_DO_PRODUTO, {
        metodo: 'POST',
        cookie,
        origem: ORIGEM_DA_TROCA,
        corpo: { senhaAtual: SENHA_ATUAL_ERRADA, senhaNova: SENHA_NOVA_BEM_FORMADA },
      });
      dentroDoTeto.push(ultimaDentroDoTeto.status);

      // Contagem exata E valor exato: `toEqual` sobre a lista inteira reprova tanto o laço que não
      // iterou quanto a requisição que veio com outro status.
      expect(dentroDoTeto).toEqual(
        Array.from({ length: TROCAS_ATE_O_TETO }, () => STATUS_DE_SENHA_ATUAL_INCORRETA),
      );

      // E a décima é recusa pela SENHA ATUAL — a operação que a perna 2 vai encontrar barrada —, e
      // não pela política de força: as duas compartilham o status, e sem esta linha o caso poderia
      // estar exercitando dez vezes o aquecimento e nenhuma vez o eixo.
      expect(ultimaDentroDoTeto.corpo).toEqual({
        codigo: CodigoErro.CAMPO_INVALIDO,
        mensagem: MENSAGEM_DE_CAMPO_INVALIDO,
      });

      // ------------------------------------------------------------------------------------
      // Perna 2 — a N+1 da MESMA origem. **É esta a asserção que discrimina o bloqueante**: com a
      // gravação por `auth.api.changePassword`, que é porta lateral ao roteador, esta requisição
      // seria mais um `422` por senha incorreta — a conferência da senha em vigor sem teto nenhum.
      // ------------------------------------------------------------------------------------
      const acimaDoTeto = await pedir(ROTA_DA_TROCA_DO_PRODUTO, {
        metodo: 'POST',
        cookie,
        origem: ORIGEM_DA_TROCA,
        corpo: { senhaAtual: SENHA_ATUAL_ERRADA, senhaNova: SENHA_NOVA_BEM_FORMADA },
      });

      expect(acimaDoTeto.status).toBe(STATUS_DO_LIMITADOR);
      expect(acimaDoTeto.status).not.toBe(STATUS_DE_SENHA_ATUAL_INCORRETA);
      expect(acimaDoTeto.status).toBeLessThan(PRIMEIRO_STATUS_DE_SERVIDOR);

      // O corpo INTEIRO por igualdade: a recusa do limitador chega no envelope canônico, com o
      // status de origem preservado, e sem vazar a mensagem em inglês do arcabouço.
      expect(acimaDoTeto.corpo).toEqual({
        codigo: CodigoErro.REQUISICAO_RECUSADA,
        mensagem: MENSAGEM_DE_REQUISICAO_RECUSADA,
      });

      // ------------------------------------------------------------------------------------
      // Perna 3 — a MESMA janela, de OUTRA origem, continua atendida. Sem ela, um limitador que
      // recusasse tudo — ou uma rota que tivesse simplesmente parado de funcionar — passaria as
      // duas pernas acima.
      // ------------------------------------------------------------------------------------
      const daVizinha = await pedir(ROTA_DA_TROCA_DO_PRODUTO, {
        metodo: 'POST',
        cookie,
        origem: ORIGEM_VIZINHA_DA_TROCA,
        corpo: { senhaAtual: SENHA_ATUAL_ERRADA, senhaNova: SENHA_NOVA_BEM_FORMADA },
      });

      expect(daVizinha.status).toBe(STATUS_DE_SENHA_ATUAL_INCORRETA);
      expect(daVizinha.corpo).toEqual({
        codigo: CodigoErro.CAMPO_INVALIDO,
        mensagem: MENSAGEM_DE_CAMPO_INVALIDO,
      });

      // ------------------------------------------------------------------------------------
      // Perna 4 — a credencial ficou INTACTA em todas elas. É o que separa "a rota foi barrada" de
      // "a rota gravou e depois foi barrada": o teto existe para proteger a conferência da senha
      // em vigor, e uma escrita que acontecesse antes da recusa tornaria o teto decorativo.
      // ------------------------------------------------------------------------------------
      // `entrarCom` levanta quando a entrada não responde `200`, então a senha da carga continuar
      // valendo já é a metade da prova; a asserção fixa a outra metade — a entrada devolveu cookie
      // de SESSÃO, e não uma resposta `200` qualquer.
      const aindaEntra = await entrarCom(ADMIN_DA_EMPRESA_B.email, SENHA_DA_CARGA);
      expect(aindaEntra).toContain(SUFIXO_DO_COOKIE_DE_SESSAO);
    },
    LIMITE_CASO_MS,
  );
});

// ---------------------------------------------------------------------------------------------
// Acessórios
// ---------------------------------------------------------------------------------------------

/**
 * As duas colunas fechadas de uma pessoa, lidas pelo acesso restrito a `identidade`.
 *
 * Observação de estado persistido — o mesmo caminho que a T7, a T8 e a T10 usam. Nada aqui exporta
 * escritor de campo adicional para o caso enxergar algo: a leitura é do banco, e a escrita, quando
 * acontece, é pelo caminho real.
 */
async function lerIdentidade(
  usuarioId: string,
): Promise<{ perfil: string; empresaId: string | null }> {
  const { usuario } = esquemaIdentidade;

  const [linha] = await identidade.acesso.identidade
    .select({ perfil: usuario.perfil, empresaId: usuario.empresaId })
    .from(usuario)
    .where(eq(usuario.id, usuarioId))
    .limit(1);

  if (linha === undefined) {
    throw new Error(`a pessoa ${usuarioId} não existe no banco desta execução`);
  }

  return linha;
}

/** As três colunas que o corpo do pedido tentou governar na criação. */
async function lerEstadoDaPessoa(
  usuarioId: string,
): Promise<{ emailVerificado: boolean; ativo: boolean; senhaProvisoria: boolean }> {
  const { usuario } = esquemaIdentidade;

  const [linha] = await identidade.acesso.identidade
    .select({
      emailVerificado: usuario.emailVerificado,
      ativo: usuario.ativo,
      senhaProvisoria: usuario.senhaProvisoria,
    })
    .from(usuario)
    .where(eq(usuario.id, usuarioId))
    .limit(1);

  if (linha === undefined) {
    throw new Error(`a pessoa ${usuarioId} não existe no banco desta execução`);
  }

  return linha;
}

/**
 * Baixa a marca de senha provisória pelo caminho REAL — a mesma capacidade que o encaminhador de
 * identidade chama quando a troca de senha é aceita. Nunca por escrita direta da coluna aqui.
 */
async function baixarMarcaDeSenhaProvisoria(usuarioId: string): Promise<void> {
  await limparMarcaDeSenhaProvisoria(identidade.acesso.identidade, usuarioId);
}

/**
 * Quantos vínculos de aplicação a empresa tem — lidos SOB o contexto de tenant dela.
 *
 * Sem filtro por `empresa_id` na consulta: quem limita o alcance é a política do banco, e escrever
 * o filtro aqui provaria a consulta em vez da RLS (ADR-0008).
 */
async function contarVinculos(empresaId: string): Promise<number> {
  return await contextoDeTenant.executarCom({ empresaId }, async () =>
    acessoAoNegocio.emUnidadeDeTrabalho(async (tx) => {
      const linhas = await tx<{ total: string }[]>`
        SELECT count(*)::text AS total FROM negocio.acesso_usuario_app
      `;
      return Number(linhas[0]?.total ?? '0');
    }),
  );
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
  /** Endereço declarado do cliente. Sem ele, o arcabouço apura a origem local. */
  readonly origem?: string;
}

/**
 * Executa uma requisição HTTP real contra a aplicação.
 *
 * O cabeçalho `Origin` acompanha toda requisição com a MESMA origem da aplicação — é o que um
 * navegador enviaria, e é o que o arcabouço confere nas requisições que carregam cookie.
 */
async function pedir(caminho: string, opcoes: OpcoesDoPedido = {}): Promise<Resposta> {
  const cabecalhos: Record<string, string> = { connection: 'close', origin: base };
  if (opcoes.corpo !== undefined) {
    cabecalhos['content-type'] = 'application/json';
  }
  if (opcoes.cookie !== undefined) {
    cabecalhos.cookie = opcoes.cookie;
  }
  if (opcoes.origem !== undefined) {
    cabecalhos['x-forwarded-for'] = opcoes.origem;
  }

  const resposta = await fetch(new URL(caminho, base), {
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
async function entrarCom(email: string, senha: string): Promise<string> {
  const entrada = await pedir(CAMINHO_DE_ENTRADA, {
    metodo: 'POST',
    corpo: { email, password: senha },
  });

  if (entrada.status !== 200) {
    throw new Error(`a entrada de ${email} respondeu ${String(entrada.status)}: ${entrada.texto}`);
  }

  const cookie = entrada.cookies.find((candidato) =>
    (candidato.split(';')[0] ?? '').split('=')[0]?.trim().endsWith(SUFIXO_DO_COOKIE_DE_SESSAO),
  );

  if (cookie === undefined) {
    throw new Error('a entrada bem-sucedida não devolveu cookie de sessão');
  }

  return cookie.split(';')[0] ?? '';
}
