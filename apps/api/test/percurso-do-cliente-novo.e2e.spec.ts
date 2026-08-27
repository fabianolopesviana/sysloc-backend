/**
 * O **percurso do cliente novo**, inteiramente pela tela — T10 da fatia
 * `integracao-bancaria-autonoma`.
 *
 * ---------------------------------------------------------------------------
 * INVARIANTES
 * ---------------------------------------------------------------------------
 *
 * | Critério | Caso | Invariante |
 * |---|---|---|
 * | CA-20 | CT-1046 | O percurso de um cliente novo — registrar o certificado **no formato em que
 * | CA-09 |         | a Autoridade Certificadora o entrega** (cifra legada) e habilitar a entrega
 * | CA-01 |         | da notícia — se conclui **inteiramente pela superfície HTTP**, sem nenhuma
 * |       |         | etapa que exija acesso ao servidor: a sequência de status dos quatro atos é
 * |       |         | **exatamente `[201, 201, 200, 200]`** por igualdade, a tripla de identidade
 * |       |         | publicada é **igual** à lida do cofre apresentado, o desfecho declara a
 * |       |         | conversão como **verdadeira**, e a consulta final devolve `habilitada: true`
 * |       |         | com `motivo: null` e `verificadaEm` **não nulo**. |
 *
 * Rastreabilidade: `CA-20 → CT-1046 (RN-09)` · `CA-09 → CT-1046 (RN-09)` · `CA-01 → CT-1046 (RN-01)`.
 *
 * ===========================================================================
 * O QUE ESTE CASO AFIRMA, e o que ele deliberadamente NÃO afirma
 * ===========================================================================
 *
 * Ele afirma a **ausência de etapa de servidor**, e a afirma de forma **comportamental**: o percurso
 * completa pela superfície HTTP, e a asserção que reprova é a **igualdade da sequência de status**.
 * Se qualquer um dos quatro atos deixasse de se concluir pela tela, a sequência divergiria e o caso
 * reprovaria nomeando o ato — **e é ela que reprovaria hoje com o `D64` aberto**, porque o material
 * legado voltaria `422` no primeiro ato.
 *
 * ⚠️ **Não** se afirma a ausência por inspeção do texto deste arquivo. Uma asserção estática exigiria
 * prova de falsificação (P4) e — o que é pior — mediria **o teste**, e não o produto: um caso que
 * grepasse a si mesmo procurando invocação de roteiro continuaria verde num produto que exigisse
 * preparo manual, desde que o preparo estivesse escondido noutro arquivo. O que faz o arranjo ser a
 * prova é ele **não invocar** roteiro algum, e o percurso ainda assim fechar.
 *
 * ⚠️ **O único processo externo deste caso é o que GERA o insumo do cliente** — o cofre PKCS#12 em
 * cifra legada, fabricado pelo `openssl` do sistema dentro de `packages/cobranca-bancaria/test/material-de-teste.ts`.
 * Ele é o que a Autoridade Certificadora entregaria ao Admin, e **não** etapa de operação do
 * servidor. `deploy/scripts/cobranca-bancaria/preparar-material-do-certificado.sh` **não** é invocado
 * em ponto algum deste arquivo: se ele precisasse ser, o CA-20 teria falhado.
 *
 * ===========================================================================
 * ARQUIVO NOVO, e a separação é justificada
 * ===========================================================================
 *
 * Nenhuma suíte existente afirma **o PERCURSO**. `certificado-do-provedor.e2e.spec.ts` cobre a rota
 * do certificado **isolada** (é onde vivem o `CT-1020` e o `CT-1022`); `entrega-da-noticia.e2e.spec.ts`
 * cobre as duas rotas da entrega **isoladas**; `segredo-nao-escapa.e2e.spec.ts` mede não-vazamento e
 * `vocabulario-na-saida-real.e2e.spec.ts` mede vocabulário. **Nenhuma delas encadeia os quatro atos
 * nem afirma a AUSÊNCIA de etapa de servidor**, e engordar qualquer uma delas misturaria o recurso
 * com o **caminho** que o atravessa. As quatro são **somente leitura** nesta task.
 *
 * ⚠️ **O `CT-1046` e o `CT-1020` não são duplicata.** O `CT-1020` afirma a **ROTA** — que ela aceita
 * material em cifra legada e registra identidade idêntica. Este afirma o **PERCURSO** — as quatro
 * etapas encadeadas até `Habilitada`, partindo de uma empresa que não tem nada.
 *
 * ===========================================================================
 * O COMPANHEIRO NEGATIVO é o `CT-1022`, e ele NÃO se duplica aqui
 * ===========================================================================
 *
 * O que impede o `201` deste percurso de ser incondicional é o **mesmo cofre legado apresentado com
 * a senha errada** — `input de outra natureza`, e não um caractere trocado. Essa asserção tem dono:
 * o **`CT-1022`**, em `./certificado-do-provedor.e2e.spec.ts`, que afirma o envelope `422` com o
 * `codigo` da **SENHA** (e não o de formato), `campo: 'corpo'`, e nenhum certificado registrado.
 * Reescrevê-la aqui seria duplicata cross-layer da mesma invariante, com as duas cópias livres para
 * divergir — e o custo de divergirem é que a versão frouxa passaria a ser a que alguém lê.
 *
 * ===========================================================================
 * O PAR DO PROVEDOR É REAL, e o que se substitui é o DESTINO
 * ===========================================================================
 *
 * Vale aqui, palavra por palavra, a seção homônima de `./entrega-da-noticia.e2e.spec.ts`: o caso sobe
 * um **par TLS mútuo de verdade** em porta dinâmica do laço local, e a porta de entrega que a
 * aplicação recebe **constrói o adaptador de produção** apontado para ele. A substituição entra por
 * `overrideProvider` sobre o token que a composição já publica, pela montagem compartilhada de
 * `./aplicacao-instrumentada.ts` — nunca por bandeira ou ramo condicional em `apps/api/src`.
 *
 * ===========================================================================
 * A EMPRESA É "NOVA" no sentido que o caso exige, e isso é AFIRMADO
 * ===========================================================================
 *
 * ⚠️ **Divergência declarada** (`.claude/rules/autonomia-do-run.md`, A1): o cliente novo é o Admin da
 * carga inicial numa **instância efêmera própria**, e não uma empresa criada pelas rotas do operador
 * do SaaS. O que o caso exige da palavra *"nova"* está escrito no próprio card — *"nenhum
 * certificado, nenhuma identidade e nenhuma linha de estado antes do percurso, **afirmado por leitura
 * antes do primeiro ato**"* —, e as três ausências são afirmadas no passo 2, pelas rotas reais.
 *
 * Montá-la pelas rotas do Master custaria a **terceira** escrita de `montarEmpresaComAdmin` e a
 * **sétima** de `entrarComSegundoFatorCumprido` — o `DÉBITO COM GATILHO — D32 · F5/T7` de
 * `./entrega-da-noticia.e2e.spec.ts` diz por extenso que a terceira escrita é o gatilho, e fechá-lo
 * exigiria abrir cinco suítes alheias, uma delas declarada somente leitura. A opção conservadora é a
 * que **não** cria a cópia: as três ausências que dão sentido ao caso são medidas, não presumidas.
 */

import { randomBytes, randomUUID } from 'node:crypto';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import {
  criarAdaptadorSicoob,
  type EntregaParaCadastrar,
  type LeituraDaEntrega,
  type PortaDeEntregaDaNoticia,
  type ResultadoDaOperacaoDeEntrega,
} from '@sysloc/cobranca-bancaria';
import { SENHA_DA_CARGA } from '@sysloc/db';
import { CodigoErro } from '@sysloc/shared';
import type { DesfechoDoRegistroDeCertificado, EstadoDaEntrega } from '@syslocbr/contracts';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  type IdentidadeEfemera,
  identidadeEfemera,
} from '../../../packages/auth/test/identidade-efemera.ts';
import {
  gerarAutoridadeDeTeste,
  gerarMaterialDeTeste,
} from '../../../packages/cobranca-bancaria/test/material-de-teste.ts';
import { reservarPorta } from '../../../packages/shared/test/efemero-comum.ts';
import { type FilaEfemera, redisEfemero } from '../../../packages/shared/test/redis-efemero.ts';
import {
  ENDERECO_DE_ESCUTA,
  PREFIXO_DE_VERSAO,
  TOKEN_PORTA_DE_ENTREGA_DA_NOTICIA,
} from '../src/configuracao/ambiente.ts';
import {
  CAMINHO_DAS_INTEGRACOES_BANCARIAS,
  SEGMENTO_DA_CONSULTA,
  SEGMENTO_DO_REGISTRO,
} from '../src/integracoes-bancarias/certificado.controller.ts';
import {
  SEGMENTO_DA_ATIVACAO,
  SEGMENTO_DA_ENTREGA_DA_NOTICIA,
} from '../src/integracoes-bancarias/entrega-da-noticia.controller.ts';
import { SEGMENTO_DA_IDENTIDADE } from '../src/integracoes-bancarias/identidade.controller.ts';
import { entrar, pedir } from './acessorios-de-borda.ts';
import { montarAplicacaoInstrumentada } from './aplicacao-instrumentada.ts';
import { confiarEm, type ParInstrumentado, subirParInstrumentado } from './par-do-provedor.ts';

/** Teto da montagem: instância efêmera, fila e aplicação real sobem aqui dentro. */
const LIMITE_DE_MONTAGEM_MS = 240_000;

/** Teto do caso: ele gera autoridade e material com `openssl` e sobe um par TLS próprio. */
const LIMITE_CASO_MS = 180_000;

/** A rota que devolve a sessão corrente no modelo de domínio do produto. */
const ROTA_DA_SESSAO = `/${PREFIXO_DE_VERSAO}/sessao`;

/** As quatro rotas do percurso, compostas dos segmentos que os controladores publicam. */
const AREA = `/${PREFIXO_DE_VERSAO}/${CAMINHO_DAS_INTEGRACOES_BANCARIAS}`;
const ROTA_DO_REGISTRO = `${AREA}/${SEGMENTO_DO_REGISTRO}`;
const ROTA_DA_CONSULTA_DO_CERTIFICADO = `${AREA}/${SEGMENTO_DA_CONSULTA}`;
const ROTA_DA_IDENTIDADE = `${AREA}/${SEGMENTO_DA_IDENTIDADE}`;
const ROTA_DO_ESTADO = `${AREA}/${SEGMENTO_DA_ENTREGA_DA_NOTICIA}`;
const ROTA_DA_ATIVACAO = `${ROTA_DO_ESTADO}/${SEGMENTO_DA_ATIVACAO}`;

/**
 * Para onde o produto declara que o provedor deve entregar a notícia.
 *
 * ⚠️ É o valor que o adaptador **envia** ao provedor no cadastro, e é contra ele que a consulta
 * positiva devolve o cadastro encontrado. Escrito à mão aqui, e não lido do ambiente, pela mesma
 * razão de `./entrega-da-noticia.e2e.spec.ts`: o que a suíte mede é o percurso, e uma leitura de
 * ambiente faria o caso depender de configuração externa (ADR-0006).
 */
const ENDERECO_DA_ENTREGA = 'https://notificacao.exemplo.invalid/v1/notificacoes-bancarias';

/**
 * O contato operacional que acompanha o cadastro da entrega — a outra metade do endereço acima.
 *
 * O provedor o declara **necessário** no cadastro (`W2`, 2026-08-22), e por isso o adaptador resolve
 * negativo sem chamar quando ele falta. Domínio `.invalid`, reservado pela RFC 2606.
 */
const CONTATO_DA_ENTREGA = 'operacao@sysloc.exemplo.invalid';

/** As duas chaves que governam esta superfície — literais, como o método as declara. */
const AREA_DAS_INTEGRACOES_BANCARIAS = 'TELA:integracoes_bancarias';
const ACAO_DE_CONFIGURACAO = 'ACAO:configurar_integracao';

/** A mensagem do `404` da consulta do certificado — escrita à mão, nunca lida da tabela do SUT. */
const MENSAGEM_SEM_CERTIFICADO = 'esta empresa não tem certificado do provedor registrado';

/** O Admin da empresa que percorre o caminho — o cliente novo deste caso. */
const ADMIN_DA_EMPRESA = 'admin.a@exemplo.com.br';

/** A senha sentinela do cofre, apresentada por corpo de requisição como um Admin a apresentaria. */
const SENHA_DO_PERCURSO = 'senha-do-percurso-do-cliente-novo';

/** Validade do material — folgada, para que a vigência nunca seja o eixo por acaso. */
const DIAS_VIGENTE_FOLGADO = 45;

/** Comprimento da chave do AES-256, em bytes — o que a partida exige da chave de cifra. */
const BYTES_DA_CHAVE_DE_CIFRA = 32;

/** Status esperados, escritos por extenso — nunca faixa. */
const STATUS_OK = 200;
const STATUS_CRIADO = 201;
const STATUS_RECURSO_NAO_ENCONTRADO = 404;

/**
 * A sequência de status que o percurso **tem** de produzir, na ordem dos quatro atos.
 *
 * ⚠️ **É a asserção que discrimina.** Ela reprova se qualquer etapa deixar de se concluir pela
 * superfície HTTP — e é ela que reprovaria com o `D64` aberto, porque o registro do material legado
 * voltaria `422` e a sequência sairia `[422, …]`.
 */
const STATUS_DO_PERCURSO = [STATUS_CRIADO, STATUS_CRIADO, STATUS_OK, STATUS_OK] as const;

/** As variáveis que a montagem escreve no ambiente do processo e restaura ao fim. */
const VARIAVEIS_MONTADAS = [
  'NODE_ENV',
  'PORT',
  'LOG_LEVEL',
  'DATABASE_URL',
  'REDIS_URL',
  'BETTER_AUTH_SECRET',
  'CHAVE_DE_CIFRA_DO_CERTIFICADO',
] as const;

let identidade: IdentidadeEfemera;
let fila: FilaEfemera;
let aplicacao: NestFastifyApplication;
let base: string;
let ambienteAnterior: NodeJS.ProcessEnv;
let cookieDoAdmin: string;

/**
 * Para onde a porta de entrega conecta **neste caso** — sempre um par do laço local (ADR-0006).
 *
 * Ela nasce indefinida, e a porta abaixo **recusa** quando ela continua assim: um destino ausente que
 * degradasse em silêncio faria o caso medir outra coisa sem dizer.
 */
let destinoDoProvedor: string | undefined;

/**
 * A porta que a aplicação recebe no lugar da de produção — e ela **é o adaptador de produção**.
 *
 * O que a composição faz em operação é construir `criarAdaptadorSicoob` a partir dos endereços que a
 * partida já exigiu; o que este objeto faz é construir **o mesmo adaptador**, com o endereço do par
 * TLS que o caso subiu. O endereço da entrega continua sendo o que o produto **declara** ao provedor,
 * e não para onde ele conecta — por isso ele é constante, e não o destino do par.
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

  ambienteAnterior = { ...process.env };
  process.env.NODE_ENV = 'test';
  process.env.LOG_LEVEL = 'fatal';
  process.env.DATABASE_URL = identidade.banco.cadeiaConexao;
  process.env.REDIS_URL = fila.cadeiaConexao;
  process.env.BETTER_AUTH_SECRET = randomBytes(32).toString('base64url');
  // A chave é SORTEADA por execução, e não herdada do valor inerte da configuração do executor: um
  // percurso que só fechasse com a chave literal estaria medindo a configuração, e não o produto.
  process.env.CHAVE_DE_CIFRA_DO_CERTIFICADO =
    randomBytes(BYTES_DA_CHAVE_DE_CIFRA).toString('base64');

  const porta = await reservarPorta();
  base = `http://${ENDERECO_DE_ESCUTA}:${String(porta)}`;
  process.env.PORT = String(porta);

  aplicacao = await montarAplicacaoInstrumentada(porta, [
    { token: TOKEN_PORTA_DE_ENTREGA_DA_NOTICIA, valor: portaDaEntrega },
  ]);

  cookieDoAdmin = await entrar(base, ADMIN_DA_EMPRESA, SENHA_DA_CARGA);
}, LIMITE_DE_MONTAGEM_MS);

afterAll(async () => {
  await aplicacao?.close();
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

describe('o percurso do cliente novo, inteiramente pela tela (T10)', () => {
  it(
    'CT-1046 — registrar o certificado em cifra LEGADA e habilitar a entrega se conclui pela superfície HTTP, sem etapa de servidor',
    async () => {
      // --- PASSO 1: a sessão do Admin, com o efetivo AFIRMADO --------------------------------
      const sessao = await pedir(base, ROTA_DA_SESSAO, { cookie: cookieDoAdmin });

      expect(sessao.status).toBe(STATUS_OK);

      const efetivo = sessao.corpo as { telas: readonly string[]; acoes: readonly string[] };
      const alcancadas = new Set<string>([...efetivo.telas, ...efetivo.acoes]);
      const conjuncaoExigida = [AREA_DAS_INTEGRACOES_BANCARIAS, ACAO_DE_CONFIGURACAO];

      // Igualdade sobre a CONJUNÇÃO inteira, e não presença de uma chave: é a conjunção que a rota
      // do registro exige, e afirmar só a área deixaria passar a sessão que não alcança o ato.
      expect(conjuncaoExigida.filter((chave) => alcancadas.has(chave))).toEqual(conjuncaoExigida);

      // --- PASSO 2: o PONTO DE PARTIDA, afirmado por leitura ---------------------------------
      //
      // ⚠️ Sem isto, um estado herdado tornaria o desfecho final não atribuível ao percurso: uma
      // empresa que já tivesse certificado e entrega habilitada devolveria `Habilitada` no fim sem
      // que ato algum daqui tivesse efeito.
      const certificadoAntes = await pedir(base, ROTA_DA_CONSULTA_DO_CERTIFICADO, {
        cookie: cookieDoAdmin,
      });

      expect(certificadoAntes.status).toBe(STATUS_RECURSO_NAO_ENCONTRADO);
      // O envelope INTEIRO por igualdade — nunca a presença de campos.
      expect(certificadoAntes.corpo).toEqual({
        codigo: CodigoErro.RECURSO_NAO_ENCONTRADO,
        mensagem: MENSAGEM_SEM_CERTIFICADO,
      });

      const entregaAntes = await pedir(base, ROTA_DO_ESTADO, { cookie: cookieDoAdmin });

      expect(entregaAntes.status).toBe(STATUS_OK);
      // `verificadaEm: null` é o discriminador de *"nunca houve tentativa"* (CA-19): ele separa a
      // empresa que nunca abriu a tela daquela que tentou e não conseguiu.
      expect(entregaAntes.corpo).toEqual({
        habilitada: false,
        situacao: 'DESABILITADA',
        verificadaEm: null,
        motivo: null,
      });

      // --- PASSO 3: o insumo do cliente, gerado em execução -----------------------------------
      //
      // Uma autoridade só emite os DOIS lados — o certificado do par e o cofre que o Admin
      // apresenta —, e é isso que faz o aperto de mão do ato externo depender da decisão do par, e
      // não de uma cadeia divergente.
      const autoridade = await gerarAutoridadeDeTeste('ct1046');
      confiarEm(autoridade);

      const par: ParInstrumentado = await subirParInstrumentado(autoridade, ENDERECO_DA_ENTREGA);
      destinoDoProvedor = par.endereco;

      const material = await gerarMaterialDeTeste({
        autoridade,
        senha: SENHA_DO_PERCURSO,
        diasDeValidade: DIAS_VIGENTE_FOLGADO,
        comEmbalagemLegada: true,
      });
      const cofreLegado = material.materialEmEmbalagemLegada;

      if (cofreLegado === undefined) {
        throw new Error('o acessório não devolveu a embalagem legada pedida');
      }

      // A ÂNCORA ANTIVÁCUO DO ARRANJO: as duas embalagens são conjuntos de bytes DIFERENTES. Sem
      // ela, um acessório que devolvesse a moderna nas duas pontas faria o percurso fechar sem que
      // material legado algum tivesse atravessado a rota — e o CA-20 ficaria provado por engano.
      expect(cofreLegado.equals(material.material)).toBe(false);

      // A tripla lida do CERTIFICADO pelo `openssl` do acessório — caminho independente do SUT.
      const identidadeEsperada = {
        titular: material.titular,
        validoDe: material.validoDe.toISOString(),
        validoAte: material.validoAte.toISOString(),
        impressaoDigital: material.impressaoDigital,
      };

      // --- ATO 1: registrar o certificado, no formato em que a AC o entrega -------------------
      const registro = await pedir(base, ROTA_DO_REGISTRO, {
        metodo: 'POST',
        cookie: cookieDoAdmin,
        corpo: { material: cofreLegado.toString('base64'), senha: material.senha },
      });

      const publicado = registro.corpo as DesfechoDoRegistroDeCertificado;

      // A identidade publicada é IGUAL à do cofre apresentado — objeto inteiro, e não campo a campo
      // escolhido. A impressão digital é o resumo do certificado em DER: ela reprova **qualquer**
      // substituição que uma conversão defeituosa fizesse, inclusive a troca por um par novo.
      expect(identidadeDe(publicado)).toEqual(identidadeEsperada);
      // E o desfecho DECLARA que o material precisou ser convertido — `true` exato, nunca a mera
      // presença do campo: `false` aqui significaria que o runtime abriu o cofre direto, e o caso
      // teria deixado de exercitar a cifra legada.
      expect(publicado.materialConvertido).toBe(true);

      // --- ATO 2: registrar a identidade da empresa perante o provedor ------------------------
      //
      // Sem ela a ativação recusaria na pré-condição, e o percurso não estaria provando o que se
      // quer — por isso o desfecho é afirmado antes de seguir.
      const identidadeNoProvedor = await pedir(base, ROTA_DA_IDENTIDADE, {
        metodo: 'POST',
        cookie: cookieDoAdmin,
        corpo: {
          identificadorDaAplicacao: randomUUID(),
          numeroDoCliente: 987_654,
          numeroDaContaCorrente: 12_345,
          codigoDaModalidade: 1,
        },
      });

      // --- ATO 3: ativar a entrega da notícia -------------------------------------------------
      const ativacao = await pedir(base, ROTA_DA_ATIVACAO, {
        metodo: 'POST',
        cookie: cookieDoAdmin,
        corpo: {},
      });

      // --- ATO 4: consultar o estado que ficou gravado ----------------------------------------
      const estadoFinal = await pedir(base, ROTA_DO_ESTADO, { cookie: cookieDoAdmin });
      const estado = estadoFinal.corpo as EstadoDaEntrega;

      expect(estado).toEqual({
        habilitada: true,
        // O ternário acompanha o booleano — a `CHECK` da `0025` amarra os dois no banco.
        situacao: 'HABILITADA',
        verificadaEm: estado.verificadaEm,
        motivo: null,
      });
      // O carimbo veio do BANCO e é datado: sem esta linha a igualdade acima aceitaria `null`, que é
      // justamente o discriminador de *"nunca houve tentativa"* afirmado no passo 2.
      expect(typeof estado.verificadaEm).toBe('string');
      expect(Number.isNaN(Date.parse(estado.verificadaEm ?? ''))).toBe(false);

      // ⚠️ **A FORMA DO PERCURSO, por igualdade** — a asserção que discrimina, e o fecho do caso.
      //
      // Ela é comparada de uma vez, e não ato a ato, porque o que está sob prova é a **sequência**:
      // um percurso que exigisse etapa de servidor divergiria em algum dos quatro, e a igualdade
      // nomeia qual. `[201, 201, 200, 200]` também prende a semântica dos verbos — os dois primeiros
      // criam recurso endereçável, os dois últimos não.
      expect([
        registro.status,
        identidadeNoProvedor.status,
        ativacao.status,
        estadoFinal.status,
      ]).toEqual([...STATUS_DO_PERCURSO]);

      // O par de fato atendeu: o cadastro saiu e a confirmação correu. Sem esta linha, um
      // `habilitada: true` gravado sem conversa com o provedor satisfaria tudo acima.
      // SUT_IS_CORRECT_BECAUSE: sob o quadro da `0025` a consulta corre primeiro, e o par deste
      // percurso responde com o nosso cadastro já ativo — nesse estado não há vaga a pedir. O que a
      // âncora mede continua valendo e ficou mais forte: **houve conversa com o provedor**, e um
      // `habilitada: true` gravado sem ela reprovaria pela consulta valendo zero.
      expect(par.chamadas.cadastro).toBe(0);
      expect(par.chamadas.consulta).toBe(1);

      // E nada do segredo do cliente volta em resposta alguma do percurso (ADR-0032).
      for (const resposta of [registro, identidadeNoProvedor, ativacao, estadoFinal]) {
        expect(resposta.texto).not.toContain(material.senha);
        expect(resposta.texto).not.toContain(cofreLegado.toString('base64'));
      }
    },
    LIMITE_CASO_MS,
  );
});

// ---------------------------------------------------------------------------------------------
// Acessórios do caso
// ---------------------------------------------------------------------------------------------

/** Recorta do corpo publicado só a tripla de identidade que o percurso compara. */
function identidadeDe(publicado: DesfechoDoRegistroDeCertificado): Record<string, unknown> {
  return {
    titular: publicado.titular,
    validoDe: publicado.validoDe,
    validoAte: publicado.validoAte,
    impressaoDigital: publicado.impressaoDigital,
  };
}
