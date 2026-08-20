/**
 * O **carnê do contrato** — `GET /v1/contratos/:codigo/carne`, a saída da fatia `webhook-e-carne`.
 * T10.
 *
 * ---------------------------------------------------------------------------
 * INVARIANTES
 * ---------------------------------------------------------------------------
 *
 * | Critério | Caso | Invariante |
 * |---|---|---|
 * | CA-14 | CT-995 | **Um único documento** com exatamente os boletos das cobranças daquele contrato
 * |       |        | cujas competências caem no intervalo — nenhum a mais, nenhum a menos —, na ordem
 * |       |        | **crescente de vencimento**. A sequência de marcas extraídas do PDF é afirmada
 * |       |        | elemento a elemento, e a contagem é **exata**: a parcela imediatamente acima do
 * |       |        | fim do recorte **não entra**, que é o que barra o mutante que ignora o limite
 * |       |        | superior. A resposta é `application/pdf` com `Content-Disposition: attachment`
 * |       |        | nomeando `<codigo>-<de>-<ate>.pdf`. (ADR-0023, ADR-0028, ADR-0030) |
 * | CA-15 | CT-996 | Boleto **ausente do disco** é rebuscado do provedor, e a rebusca é **invisível**:
 * |       |        | mesma resposta, mesma sequência, arquivo **regravado** — e a trilha bancária da
 * |       |        | cobrança **não ganha item**, porque rebuscar cache não é efeito. A porta é
 * |       |        | instrumentada e o **número de chamadas** é afirmado, nunca "foi chamada".
 * |       |        | (ADR-0034) |
 * | CA-16 | CT-997 | Cobrança do recorte **sem boleto emitido** faz o carnê recusar com `404` e
 * |       |        | `detalhes: { carne: 'BOLETO_AUSENTE', cobranca }`, nomeando a **primeira na
 * |       |        | ordem de vencimento** — com **duas** sem boleto no recorte, e uma **com**
 * |       |        | boleto antes das duas, de modo que "a primeira" não seja satisfeita nem por "a
 * |       |        | primeira do recorte" nem por "a última sem boleto". Nenhum byte de PDF sai, e
 * |       |        | o cabeçalho de disposição **não** é escrito. |
 * | CA-18 | CT-998 | Recorte **válido** que não alcança cobrança alguma responde `404` com
 * |       |        | `detalhes: { carne: 'SEM_COBRANCAS' }` — jamais um documento vazio. O
 * |       |        | discriminador é **distinto** do da recusa acima, e é isso que impede um `404`
 * |       |        | genérico de passar nos dois. |
 * | CA-17 | CT-999 | O **mesmo recorte pedido duas vezes** produz **conteúdo e ordem** iguais.
 * |       |        | ⚠️ Compara a sequência de marcas extraídas, e **não bytes brutos**: metadado de
 * |       |        | geração divergiria por razão alheia à invariante, e fabricar um instante fixo
 * |       |        | seria mentira gravada no documento. |
 * | CA-19 | CT-1000 | Carnê de contrato de **outra empresa** é **indistinguível** de inexistente: os
 * |       |         | dois respondem `404` com corpo **idêntico**, campo a campo, e **sem
 * |       |         | `detalhes`** — o que impede a resposta de vazar existência (ADR-0008). |
 * | CA-19 | CT-1000 | A rota **herda a exigência da classe**: sem credencial responde `401`, e com
 * |       | (b)     | sessão que não alcança `TELA:contratos` responde `403` nomeando a chave
 * |       |         | ausente. Nos dois, nenhum byte de documento sai. |
 * | CA-14 | CT-1001 | As **quatro** formas inválidas de recorte — invertido, largo demais,
 * |       |         | competência fora do primeiro dia e data inexistente — respondem `422
 * |       |         | CAMPO_INVALIDO` nomeando `de` ou `ate` **pelo campo**, nunca pela raiz; e
 * |       |         | **nenhuma unidade de trabalho do negócio é aberta**, afirmado por contador com
 * |       |         | **controle positivo** no mesmo caso. |
 * | CA-15 | CT-1003 | Provedor **indisponível** na rebusca responde `503 SERVICO_INDISPONIVEL` e
 * |       |         | **não altera coisa alguma**: nenhum byte sai e o arquivo continua ausente do
 * |       |         | disco. É o par de CT-996 — mesma pré-condição, provedor do outro lado —, e o
 * |       |         | par é o que discrimina *"rebuscou"* de *"engoliu"*. |
 *
 * Rastreabilidade: `CA-14 → CT-995 (RN-13)`, `CA-15 → CT-996 (RN-15)`, `CA-16 → CT-997 (RN-16)`,
 * `CA-18 → CT-998 (RN-13)`, `CA-17 → CT-999 (RN-14)`, `CA-19 → CT-1000 (RN-17)`,
 * `CA-14 → CT-1001 (RN-13)`, `CA-15 → CT-1003 (RN-15)`.
 *
 * ===========================================================================
 * O QUE ESTA SUÍTE ATRAVESSA DE VERDADE — e o único dublê que existe aqui
 * ===========================================================================
 *
 * HTTP real em porta dinâmica, PostgreSQL efêmero com RLS forçada, a **guarda de boletos real**
 * gravando em diretório temporário, `pdf-lib` real mesclando e `pdfjs-dist` real extraindo o texto
 * de volta. O **único** dublê é a porta do provedor bancário, e ela entra por
 * `overrideProvider(TOKEN_PORTA_DE_COBRANCA_BANCARIA)` — o mecanismo do arcabouço de teste —, nunca
 * por bandeira no código de produção.
 *
 * ⚠️ **O dublê do provedor emite PDF DE VERDADE**, renderizado por `criarRenderizadorPdf()`, e isso é
 * requisito e não capricho: o carnê é composto por `pdf-lib`, que **recusa** origem ilegível. Bytes
 * de mentira (`%PDF-1.4 boleto …`) fariam a suíte medir a recusa da biblioteca em vez da composição.
 * Cada boleto carrega uma **marca única derivada do vencimento** — é ela que torna a ordem afirmável
 * elemento a elemento, e não apenas a contagem.
 *
 * ⚠️ **A segunda porta trocada é o ACESSO AO BANCO**, e ela existe por um caso só: o `CT-1001`
 * precisa afirmar que a recusa de recorte malformado acontece **sem tocar o banco**. O que entra no
 * lugar é um **decorador contador** sobre o acesso real — mesma reserva de conexões, mesmo
 * comportamento, mais um inteiro. Não é um dublê do banco: as consultas correm todas contra o
 * PostgreSQL efêmero. E não é seam de produção: `TOKEN_ACESSO_AO_NEGOCIO` já é o token que a
 * composição publica, e nada em `apps/api/src` ganhou parâmetro por causa desta suíte.
 *
 * ===========================================================================
 * O certificado do arranjo é registrado pela CAMADA DE DADOS, e a razão é mecânica
 * ===========================================================================
 *
 * O caminho de rota (`POST /v1/integracoes-bancarias/certificados`) exige material PKCS#12 real, e o
 * acessório que o gera (`gerarAutoridadeDeTeste`) registra a limpeza com `onTestFinished` — que o
 * arcabouço **só admite de dentro de um `it`**. O arranjo desta suíte é único e vive em `beforeAll`,
 * de modo que aquele caminho não é alcançável daqui sem tornar a montagem posicional. O registro sai,
 * então, de `registrarCertificado`, que é a **porta de domínio** que a rota usa por dentro.
 *
 * ⚠️ **Isto é a quarta ocorrência do arranjo "cobrança com boleto vivo + certificado vigente"**, cuja
 * promoção para casa compartilhada está agendada no `DÉBITO COM GATILHO — D21 · F4/T9`, em
 * `./retomada-de-retidas.spec.ts`. O gatilho dele é *"a primeira task autorizada a abrir as duas
 * suítes irmãs por outra razão"*, e **esta task não as abre** — nenhuma delas está na §5.2 dela. O
 * arranjo daqui também não é cópia daquele: ali o eixo é o roteamento da notícia; aqui é um contrato
 * com **sete** cobranças, boletos com conteúdo distinto e arquivos de verdade na guarda.
 * ÍNDICE: docs/specs/features/webhook-e-carne/v1/_run/run-report.md §2, D21
 *
 * ===========================================================================
 * TODO CASO QUE MUTA O ARRANJO COMPARTILHADO O REPÕE — e a reposição é AFIRMADA
 * ===========================================================================
 *
 * O arranjo desta suíte é único e vive no `beforeAll`: contrato, sete cobranças, cinco emissões e
 * cinco arquivos na guarda. Promovê-lo a `beforeEach` **não** é viável — a montagem declara teto de
 * 300 s —, de modo que a reposição por caso é a única disciplina disponível, e ela vale para os dois
 * estados mutáveis: o `roteiro` do par do provedor **e os bytes no disco**.
 *
 * A regra, então, é uma só: **quem apaga arquivo da guarda ou desliga o roteiro repõe em `finally`,
 * e afirma a reposição.** Executá-la sem afirmá-la deixaria um caminho de reposição quebrado passar
 * em silêncio, e o defeito reapareceria como falha por arrasto num caso alheio — que é o modo de
 * falha mais caro de diagnosticar numa suíte de borda. É o que o `CT-1003` faz, e é por isso que
 * nenhum caso desta suíte depende da ordem de declaração dos `it`.
 *
 * ===========================================================================
 * A ORDEM DE CRIAÇÃO é DELIBERADAMENTE DIFERENTE da ordem de vencimento
 * ===========================================================================
 *
 * As parcelas são lançadas fora de ordem, de modo que o **código** da série (`COB-…`) cresça numa
 * ordem e o **vencimento** noutra. Sem isso, um carnê que ordenasse por código — ou pela ordem de
 * chegada das linhas — passaria em todos os casos, e a promessa *"na ordem crescente de vencimento"*
 * ficaria sem nada que a discriminasse.
 */

import { randomBytes, randomUUID } from 'node:crypto';
import { access, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import type {
  AdaptadorCobrancaBancaria,
  BoletoEmitido,
  ConsultaDeSituacao,
  DesfechoDaOperacao,
  PedidoDeEmissao,
  SituacaoConsultada,
} from '@sysloc/cobranca-bancaria';
import {
  type AcessoAoBanco,
  abrirAcessoAoBanco,
  contextoDeTenant,
  EMPRESA_A,
  EMPRESA_B,
  registrarCertificado,
  SENHA_DA_CARGA,
} from '@sysloc/db';
import { criarRenderizadorPdf } from '@sysloc/documentos';
import { CodigoErro, cifrarSegredo, criarSegredoOperavel } from '@sysloc/shared';
import type { TransactionSql } from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
// DÉBITO COM GATILHO — D28 · F0/T5 · gatilho JÁ DISPARADO (F1/T2, 2026-08-02)
// (NÃO é uma `DECISÃO FECHADA`: ele agenda uma mudança, não protege o código abaixo.)
// O QUÊ: os dois imports a seguir atravessam a fronteira de `@sysloc/auth` e de `@sysloc/shared` por
//        CAMINHO DE ARQUIVO, fora do `exports` e do `files` daqueles manifestos. As dependências de
//        workspace estão declaradas, então não há dependência oculta; o que não existe é FRONTEIRA
//        para os diretórios `test/` — e este arquivo é mais um a repetir o padrão.
// QUANDO FECHA: o gatilho já disparou e o fechamento segue pendente; ele é o mesmo de sempre —
//        declarar o subpath `"./test"` nos manifestos e importar por `@sysloc/auth/test` e
//        `@sysloc/shared/test`, ou extrair um `@sysloc/test-utils`.
// POR QUE NÃO AGORA: fechar exige editar os manifestos de dois pacotes e todos os consumidores,
//        nenhum deles no escopo desta task, e o índice de débitos do `CLAUDE.md`.
// ÍNDICE: docs/specs/features/fundacao-stack-nativa/v1/_run/run-report.md §2, D28
import {
  type IdentidadeEfemera,
  identidadeEfemera,
  pessoaSemeada,
} from '../../../packages/auth/test/identidade-efemera.ts';
import { reservarPorta } from '../../../packages/shared/test/efemero-comum.ts';
import { type FilaEfemera, redisEfemero } from '../../../packages/shared/test/redis-efemero.ts';
import { CAMINHO_DA_SESSAO } from '../src/autenticacao/sessao.controller.ts';
import { CAMINHO_DOS_LOCADORES } from '../src/cadastros/locador.controller.ts';
import { CAMINHO_DOS_LOCATARIOS } from '../src/cadastros/locatario.controller.ts';
import { CAMINHO_DAS_COBRANCAS } from '../src/cobrancas/cobranca.controller.ts';
import {
  type Ambiente,
  ENDERECO_DE_ESCUTA,
  PREFIXO_DE_VERSAO,
  TOKEN_ACESSO_AO_NEGOCIO,
  TOKEN_AMBIENTE,
  TOKEN_PORTA_DE_COBRANCA_BANCARIA,
} from '../src/configuracao/ambiente.ts';
import { CAMINHO_DOS_CONTRATOS } from '../src/contratos/contrato.controller.ts';
import { CAMINHO_DOS_CONJUNTOS } from '../src/imoveis/conjunto.controller.ts';
import { CAMINHO_DOS_IMOVEIS } from '../src/imoveis/imovel.controller.ts';
import { entrar, pedir, pedirBytes, type RespostaEmBytes } from './acessorios-de-borda.ts';
import { montarAplicacaoInstrumentada } from './aplicacao-instrumentada.ts';
import { cpfValido, extrairTextoDePdf } from './documento.ts';

// ---------------------------------------------------------------------------
// Os limites de tempo, nomeados (nunca número solto no meio do caso)
// ---------------------------------------------------------------------------

/**
 * O teto da montagem: instância de PostgreSQL, instância de fila, aplicação e o arranjo inteiro —
 * sete cobranças, cinco emissões e cinco renderizações de PDF.
 */
const LIMITE_DE_MONTAGEM_MS = 300_000;

/** O teto de um caso que compõe e extrai texto de PDF. */
const LIMITE_CASO_MS = 60_000;

// ---------------------------------------------------------------------------
// As rotas, compostas a partir dos donos dos segmentos — nunca escritas à mão
// ---------------------------------------------------------------------------

const COLECAO_DE_CONTRATOS = `/${PREFIXO_DE_VERSAO}/${CAMINHO_DOS_CONTRATOS}`;
const COLECAO_DE_COBRANCAS = `/${PREFIXO_DE_VERSAO}/${CAMINHO_DAS_COBRANCAS}`;
const CAMINHO_DA_SESSAO_CORRENTE = `/${PREFIXO_DE_VERSAO}/${CAMINHO_DA_SESSAO}`;

// ---------------------------------------------------------------------------
// O contrato publicado que os casos afirmam — literais, jamais importados do SUT
// ---------------------------------------------------------------------------

/**
 * O tipo de mídia e a extensão que a rota declara (ADR-0028).
 *
 * Escritos à mão e **não** importados do controlador: derivá-los da mesma fonte que o SUT usa para
 * declarar faria a asserção concordar consigo mesma — trocar o tipo de mídia no controlador deixaria
 * de reprovar caso algum.
 */
const TIPO_DE_MIDIA_DO_CARNE = 'application/pdf';
const EXTENSAO_DO_CARNE = '.pdf';

/** A assinatura que todo PDF carrega nos primeiros bytes — o que separa "documento" de "vazio". */
const ASSINATURA_DO_PDF = '%PDF-';

/** Os códigos e mensagens do envelope canônico (ADR-0017), escritos à mão. */
const CODIGO_DE_NAO_ENCONTRADO: string = CodigoErro.RECURSO_NAO_ENCONTRADO;
const CODIGO_DE_CAMPO_INVALIDO: string = CodigoErro.CAMPO_INVALIDO;
const CODIGO_DE_SERVICO_INDISPONIVEL: string = CodigoErro.SERVICO_INDISPONIVEL;
const MENSAGEM_DE_NAO_ENCONTRADO = 'recurso não encontrado';
const MENSAGEM_DE_CAMPO_INVALIDO = 'requisição inválida';
const MENSAGEM_DE_ACESSO_NEGADO = 'acesso negado para esta sessão';

/** O discriminador do carnê em `detalhes` e os dois motivos que ele admite (§4.1.1). */
const DISCRIMINADOR_DO_CARNE = 'carne';
const SEM_COBRANCAS = 'SEM_COBRANCAS';
const BOLETO_AUSENTE = 'BOLETO_AUSENTE';

/** A área que governa a superfície de contratos — literal, e afirmada na sessão antes dos casos. */
const AREA_DOS_CONTRATOS = 'TELA:contratos';

/** A única chave da matriz padrão de `USUARIO_EMPRESA` — a precondição afirmada do `CT-1000 (b)`. */
const UNICA_CHAVE_DO_USUARIO_EMPRESA = 'TELA:resumo';

/**
 * Um código de contrato **bem formado e inexistente** — o companheiro do `CT-1000`.
 *
 * Bem formado de propósito: um malformado seria recusado com `422` antes de qualquer consulta, e
 * mediria a validação em vez da recusa por ausência.
 */
const CONTRATO_INEXISTENTE = 'CTR-2026-99999';

// ---------------------------------------------------------------------------
// A marca que cada boleto carrega — o que torna a ORDEM afirmável
// ---------------------------------------------------------------------------

/**
 * O prefixo da marca gravada dentro de cada PDF de boleto, seguido do vencimento sem separadores.
 *
 * Sem separador de propósito: a marca precisa sobreviver à extração como **um único token**, e um
 * hífen no meio é ponto de quebra de linha para o renderizador. O vencimento é o eixo porque é ele
 * que a ordem promete — derivar a marca do código da cobrança faria a asserção de ordem depender de
 * um valor que o produto emite, e não do fato que a ordena.
 */
const PREFIXO_DA_MARCA = 'MARCA';

/** Casa toda marca no texto extraído, na ordem de aparição. A flag `g` é o que produz a sequência. */
const MARCAS_NO_TEXTO = /MARCA\d{8}/gu;

/** A marca de um vencimento `YYYY-MM-DD`. */
function marcaDe(vencimento: string): string {
  return `${PREFIXO_DA_MARCA}${vencimento.replaceAll('-', '')}`;
}

// ---------------------------------------------------------------------------
// Os termos do arranjo
// ---------------------------------------------------------------------------

const DATA_DE_INICIO = '2026-01-15';
const PRAZO_EM_MESES = 12;
const VALOR_MENSAL = 2500;
const DIA_DE_VENCIMENTO = 10;
const VALOR_DA_COBRANCA = 1500;
const REFERENCIA_DA_COBRANCA = 'Competência do período — parcela';

/** Quantas competências futuras o arranjo prepara — sete, e cada uma tem papel declarado abaixo. */
const COMPETENCIAS_DO_ARRANJO = 7;

/** O maior recorte que o contrato aceita (`LARGURA_MAXIMA_DO_RECORTE`) mais um — o `422` do `ate`. */
const COMPETENCIAS_ALEM_DO_TETO = 13;

// ---------------------------------------------------------------------------
// As pessoas da carga
// ---------------------------------------------------------------------------

/** Quem age na empresa A. `ADMIN_EMPRESA`: a matriz do perfil já é o catálogo inteiro. */
const QUEM_ADMINISTRA = pessoaSemeada('admin.a@exemplo.com.br');

/** Quem age na empresa B — a outra ponta do isolamento do `CT-1000`. */
const QUEM_ADMINISTRA_EM_B = pessoaSemeada('admin.b@exemplo.com.br');

/** Quem **não** alcança `TELA:contratos` — a matriz padrão de `USUARIO_EMPRESA`, sem concessão. */
const QUEM_NAO_ALCANCA = pessoaSemeada('usuario.a@exemplo.com.br');

// ---------------------------------------------------------------------------
// O estado do módulo
// ---------------------------------------------------------------------------

let identidade: IdentidadeEfemera;
let instanciaDaFila: FilaEfemera;
let aplicacao: NestFastifyApplication;
let acessoDaAplicacao: AcessoAoBanco;
let acessoDaSuite: AcessoAoBanco;
let base = '';
let cookie = '';
let cookieDeB = '';
let cookieSemArea = '';
let ambienteAnterior: NodeJS.ProcessEnv | undefined;

/** O diretório descartável desta suíte — ver a razão medida no `beforeAll`. */
let diretorioDaGuarda = '';

/** O contador de unidades de trabalho do NEGÓCIO abertas pela aplicação — o eixo do `CT-1001`. */
let unidadesAbertas = 0;

/** O contrato da empresa A, e o da empresa B — os dois montados pelas rotas reais. */
let contratoDeA = '';
let contratoDeB = '';

/** As sete competências do arranjo, na ordem cronológica, com o vencimento de cada uma. */
interface ParcelaDoArranjo {
  readonly competencia: string;
  readonly vencimento: string;
}

let parcelas: readonly ParcelaDoArranjo[] = [];

/** O código da cobrança lançada para cada competência, indexado pela competência. */
const codigoPorCompetencia = new Map<string, string>();

// ---------------------------------------------------------------------------
// A porta do provedor — implementação anotada com o tipo, e não `vi.mock`
// ---------------------------------------------------------------------------

/** O que o par guardou de cada emissão — é por aqui que a consulta devolve os mesmos bytes. */
interface EmissaoDoPar {
  readonly numeroDoTituloNoProvedor: string;
  readonly documento: Buffer;
}

/** O roteiro que os casos ajustam: se a consulta responde, e quantas vezes ela foi feita. */
const roteiro = {
  emitidos: [] as EmissaoDoPar[],
  responderConsulta: true,
  consultas: 0,
};

/** Quantos títulos o "provedor" já atribuiu — a sequência DELE, e não a do produto. */
let titulosAtribuidos = 0;

/** O renderizador real — é ele que faz os bytes do par serem um PDF que `pdf-lib` aceita. */
const renderizador = criarRenderizadorPdf();

/** O motivo que o par informa quando o provedor está indisponível — literal, nunca do produto. */
const RECUSA_DA_CONSULTA = 'provedor indisponivel para consulta';

const portaDoProvedor: AdaptadorCobrancaBancaria = {
  emitir: async (pedido: PedidoDeEmissao): Promise<DesfechoDaOperacao<BoletoEmitido>> => {
    titulosAtribuidos += 1;

    // O documento é um PDF DE VERDADE, e a marca dentro dele é derivada do **vencimento** do pedido:
    // é o que liga cada página do carnê à parcela que a produziu, sem que o par precise conhecer o
    // código da cobrança.
    const documento = Buffer.from(
      await renderizador.renderizar({
        blocos: [{ rotulo: 'boleto', texto: marcaDe(pedido.vencimento) }],
      }),
    );

    const emitido: BoletoEmitido = {
      numeroDoTituloNoProvedor: `1700000000${String(titulosAtribuidos).padStart(3, '0')}`,
      linhaDigitavel: `75691.11223 34455.667788 99001.1223${String(titulosAtribuidos).padStart(2, '0')} 5 99230000012345`,
      codigoDeBarras: `756919923000001234511122334455667788990011${String(titulosAtribuidos).padStart(2, '0')}`,
      documento,
    };

    roteiro.emitidos.push({
      numeroDoTituloNoProvedor: emitido.numeroDoTituloNoProvedor,
      documento,
    });

    return { aceito: true, valor: emitido };
  },

  solicitarRevogacaoDeBoleto: (): Promise<DesfechoDaOperacao<void>> => {
    throw new Error('nenhum caso desta suíte revoga boleto');
  },

  confirmarRevogacaoDeBoleto: (): Promise<DesfechoDaOperacao<boolean>> => {
    throw new Error('nenhum caso desta suíte confirma revogação');
  },

  consultarSituacao: async (
    consulta: ConsultaDeSituacao,
  ): Promise<DesfechoDaOperacao<SituacaoConsultada>> => {
    roteiro.consultas += 1;

    if (!roteiro.responderConsulta) {
      return { aceito: false, classe: 'DA_COBRANCA', motivo: RECUSA_DA_CONSULTA };
    }

    // O par devolve os bytes **daquela** emissão, achados pelo número do título — é o que o provedor
    // real faz, e é o que dá conteúdo à igualdade de conteúdo do `CT-996`: um documento fixo faria
    // "o mesmo carnê" ser satisfeito pelo documento de outra parcela.
    const emitido = roteiro.emitidos.find(
      (boleto) => boleto.numeroDoTituloNoProvedor === consulta.numeroDoTituloNoProvedor,
    );

    if (emitido === undefined) {
      // Levantar, e não devolver situação qualquer: uma consulta por título que o par nunca atribuiu
      // significa que a rota perguntou por outra cobrança, e responder "em aberto" esconderia isso
      // atrás de um desfecho benigno.
      throw new Error('o par recebeu consulta por título que ele nunca atribuiu');
    }

    return {
      aceito: true,
      valor: {
        situacao: 'EM_ABERTO',
        // `incluirDocumento` é **honrado**, e não asserido à parte: pedindo `false`, o par devolve
        // `null`, a rota responde `503` e o `CT-996` reprova pelo status. Uma asserção separada sobre
        // o sinalizador seria implicada pelas que já estão escritas (AP-29).
        documento: consulta.incluirDocumento ? emitido.documento : null,
      },
    };
  },
};

beforeAll(async () => {
  identidade = await identidadeEfemera();
  instanciaDaFila = await redisEfemero();
  acessoDaSuite = abrirAcessoAoBanco({ cadeiaDeConexao: identidade.banco.cadeiaConexao });
  acessoDaAplicacao = abrirAcessoAoBanco({ cadeiaDeConexao: identidade.banco.cadeiaConexao });

  ambienteAnterior = { ...process.env };
  process.env.NODE_ENV = 'test';
  process.env.LOG_LEVEL = 'fatal';
  process.env.DATABASE_URL = identidade.banco.cadeiaConexao;
  process.env.REDIS_URL = instanciaDaFila.cadeiaConexao;
  process.env.BETTER_AUTH_SECRET = randomBytes(32).toString('base64url');

  // ---------------------------------------------------------------------------------------
  // A GUARDA DESTA SUÍTE TEM DIRETÓRIO PRÓPRIO — e a razão foi MEDIDA, não suposta
  // ---------------------------------------------------------------------------------------
  //
  // `apps/api/vitest.config.ts` semeia **um** `DIRETORIO_DOS_BOLETOS` para o pacote inteiro, e o
  // arcabouço roda os arquivos de suíte em **paralelo**. Cada um tem a sua instância efêmera de
  // PostgreSQL, de modo que a série da cobrança recomeça em cada um: duas suítes emitem
  // `COB-{ano}-0000001` ao mesmo tempo e gravam **o mesmo caminho**. Medido nesta task, com seis
  // arquivos concorrentes: o carnê compunha bytes escritos por outra suíte e `pdf-lib` reprovava com
  // `Cannot read properties of undefined (reading 'Pages')`, respondendo `500` — e a rebusca da
  // CA-08 disparava por arquivos que **outra** suíte apagara, quebrando a contagem exata do
  // `CT-996`.
  //
  // O diretório próprio é o que torna a guarda desta suíte **dela**. É exatamente o mecanismo que o
  // docblock de `TOKEN_GUARDA_DE_BOLETOS` prevê — *"o que a suíte troca é o diretório"* —, e não um
  // dublê: a guarda continua sendo a real, gravando arquivos de verdade.
  diretorioDaGuarda = await mkdtemp(join(tmpdir(), 'sysloc-boletos-carne-'));
  process.env.DIRETORIO_DOS_BOLETOS = diretorioDaGuarda;

  const porta = await reservarPorta();
  base = `http://${ENDERECO_DE_ESCUTA}:${String(porta)}`;
  process.env.PORT = String(porta);

  // O decorador contador: **o acesso real**, mais um inteiro. Ver o cabeçalho para por que ele não é
  // um dublê do banco nem um seam de produção.
  const acessoContado: AcessoAoBanco = {
    emUnidadeDeTrabalho: async <T>(trabalho: (tx: TransactionSql) => Promise<T>): Promise<T> => {
      unidadesAbertas += 1;

      return await acessoDaAplicacao.emUnidadeDeTrabalho(trabalho);
    },
    // O encerramento delega: quem abriu a reserva é dono dela, e `aplicacao.close()` continua sendo
    // quem a devolve — exatamente como faria com o acesso que a composição constrói.
    encerrar: async (): Promise<void> => {
      await acessoDaAplicacao.encerrar();
    },
  };

  aplicacao = await montarAplicacaoInstrumentada(porta, [
    { token: TOKEN_PORTA_DE_COBRANCA_BANCARIA, valor: portaDoProvedor },
    { token: TOKEN_ACESSO_AO_NEGOCIO, valor: acessoContado },
  ]);

  cookie = await entrar(base, QUEM_ADMINISTRA.email, SENHA_DA_CARGA);
  cookieDeB = await entrar(base, QUEM_ADMINISTRA_EM_B.email, SENHA_DA_CARGA);
  cookieSemArea = await entrar(base, QUEM_NAO_ALCANCA.email, SENHA_DA_CARGA);

  // Precondições AFIRMADAS, e não supostas: sem elas, um `403` na rota do carnê seria indistinguível
  // de um defeito dela, e o `403` do `CT-1000 (b)` mediria uma sessão quebrada em vez da exigência.
  const sessao = (await pedir(base, CAMINHO_DA_SESSAO_CORRENTE, { cookie })).corpo as {
    telas: readonly string[];
  };
  const sessaoSemArea = (await pedir(base, CAMINHO_DA_SESSAO_CORRENTE, { cookie: cookieSemArea }))
    .corpo as { telas: readonly string[] };

  expect(sessao.telas).toContain(AREA_DOS_CONTRATOS);
  expect(sessaoSemArea.telas).toEqual([UNICA_CHAVE_DO_USUARIO_EMPRESA]);

  // A pessoa do `403` é de fato da empresa A — afirmado contra a carga, e não suposto pelo e-mail: se
  // a carga passasse a semeá-la na empresa B, o `403` deixaria de medir a falta da ÁREA e passaria a
  // medir a falta do recurso.
  expect(QUEM_NAO_ALCANCA.empresaId).toBe(EMPRESA_A.id);
  expect(QUEM_ADMINISTRA_EM_B.empresaId).toBe(EMPRESA_B.id);

  await registrarCertificadoVigente(EMPRESA_A.id, QUEM_ADMINISTRA.id);

  parcelas = await competenciasFuturas(COMPETENCIAS_DO_ARRANJO);
  contratoDeA = await contratoAtivo(cookie);

  // ---------------------------------------------------------------------------------------
  // O contrato da empresa B é o SEGUNDO dela, e a escolha é obrigatória, não estética
  // ---------------------------------------------------------------------------------------
  //
  // A série do contrato é **por empresa** (ADR-0033): o primeiro contrato de A e o primeiro de B
  // recebem o MESMO código `CTR-{ano}-00001`. Pedir o carnê daquele código com a sessão de A
  // alcançaria o contrato **da própria A**, e o `CT-1000` mediria um `200` onde ele procura um `404`
  // — vacuidade silenciosa. Montando **dois** contratos em B e usando o segundo, o código existe em
  // B e **não existe** em A, que é exatamente o cenário que a ADR-0008 governa.
  await contratoAtivo(cookieDeB);
  contratoDeB = await contratoAtivo(cookieDeB);

  // ---------------------------------------------------------------------------------------
  // As sete parcelas — lançadas FORA da ordem de vencimento, de propósito
  // ---------------------------------------------------------------------------------------
  //
  // A ordem de lançamento decide a ordem dos **códigos** da série. Lançá-las embaralhadas é o que
  // separa "ordenou por vencimento" de "ordenou por código" e de "devolveu na ordem de chegada".
  for (const indice of [2, 0, 3, 1, 4, 6, 5]) {
    const parcela = exigirParcela(indice);

    codigoPorCompetencia.set(parcela.competencia, await lancar(contratoDeA, parcela));
  }

  // As cinco primeiras ganham boleto; as duas últimas **não**, e é essa ausência que o `CT-997` mede.
  for (const indice of [0, 1, 2, 3, 4]) {
    await emitirBoleto(codigoDa(indice));
  }
}, LIMITE_DE_MONTAGEM_MS);

afterAll(async () => {
  await aplicacao?.close();
  await acessoDaSuite?.encerrar();
  await instanciaDaFila?.parar();
  await identidade?.parar();

  // O diretório descartável não sobrevive à suíte: deixá-lo acumularia PDFs em `tmpdir` a cada
  // execução, e quem os apagaria não existe.
  if (diretorioDaGuarda !== '') {
    await rm(diretorioDaGuarda, { recursive: true, force: true });
  }

  for (const nome of Object.keys(process.env)) {
    if (!(nome in (ambienteAnterior ?? {}))) {
      delete process.env[nome];
    }
  }
  for (const [nome, valor] of Object.entries(ambienteAnterior ?? {})) {
    if (valor !== undefined) {
      process.env[nome] = valor;
    }
  }
}, LIMITE_DE_MONTAGEM_MS);

// ---------------------------------------------------------------------------
// Os casos
// ---------------------------------------------------------------------------

describe('o carnê do contrato (T10)', () => {
  it(
    'CT-995 — o carnê reúne exatamente os boletos do recorte, na ordem crescente de vencimento',
    async () => {
      const recorte = recorteDe(0, 2);
      const resposta = await pedirCarne(contratoDeA, recorte);

      // ---------------------------------------------------------------------------------------
      // A resposta: status, mídia e nome sugerido do arquivo (ADR-0028)
      // ---------------------------------------------------------------------------------------
      expect(resposta.status).toBe(200);
      expect(resposta.tipoDeConteudo).toBe(TIPO_DE_MIDIA_DO_CARNE);
      expect(resposta.disposicao).toBe(
        `attachment; filename="${contratoDeA}-${semDia(recorte.de)}-${semDia(recorte.ate)}${EXTENSAO_DO_CARNE}"`,
      );

      // Um documento de verdade, e não um envelope de erro que anunciasse PDF: a assinatura é lida
      // dos bytes, e o corpo **não** é JSON.
      expect(textoInicialDe(resposta.bytes)).toBe(ASSINATURA_DO_PDF);
      expect(resposta.corpo).toBeUndefined();

      // ---------------------------------------------------------------------------------------
      // A SEQUÊNCIA, elemento a elemento — e a CONTAGEM, exata
      // ---------------------------------------------------------------------------------------
      //
      const marcas = await marcasDe(resposta.bytes);

      // ⚠️ **A ausência da parcela do índice 3 precede deliberadamente a igualdade de arranjo.** A
      // implicação entre as duas corre num sentido só: a igualdade fixa comprimento E elementos, e
      // as marcas são distintas por construção — escrita **depois** dela, esta linha seria
      // consequência lógica da anterior e não poderia reprovar em estado alcançável, que é o AP-29
      // medido pelo Gate 1 nesta task. Aqui ela é avaliada com apenas status, mídia e disposição
      // afirmados, e reprova primeiro no estado que persegue: o carnê que ignora o limite superior
      // do intervalo e junta a parcela imediatamente acima do fim do recorte.
      expect(
        marcas,
        'o carnê alcançou a parcela imediatamente acima do fim do recorte',
      ).not.toContain(marcaDaParcela(3));

      // E a igualdade de arranjo ORDENADO, que continua sendo a asserção forte — nunca `toContain`:
      // o que a rota promete é a ordem, e um documento com as três parcelas trocadas satisfaria a
      // contenção. Ela prova o que a linha acima não prova: a sequência completa.
      expect(marcas, 'a sequência de boletos do carnê divergiu da ordem de vencimento').toEqual([
        marcaDaParcela(0),
        marcaDaParcela(1),
        marcaDaParcela(2),
      ]);
    },
    LIMITE_CASO_MS,
  );

  it(
    'CT-996 — boleto ausente do disco é rebuscado, a rebusca é invisível e a trilha não ganha item',
    async () => {
      const recorte = recorteDe(0, 2);
      const codigoApagado = codigoDa(1);

      // A precondição é AFIRMADA antes de ser desfeita: sem esta linha, um arquivo que já estivesse
      // ausente faria o caso medir a rebusca de algo que nunca esteve lá.
      expect(await existeNaGuarda(codigoApagado)).toBe(true);
      await rm(arquivoDoBoleto(codigoApagado));
      expect(await existeNaGuarda(codigoApagado)).toBe(false);

      const consultasAntes = roteiro.consultas;
      const trilhaAntes = await itensDaTrilha(codigoApagado);

      const resposta = await pedirCarne(contratoDeA, recorte);

      // O carnê sai **igual**: mesmo status, mesma mídia e a MESMA sequência do `CT-995`. É isso que
      // "invisível para quem pediu" quer dizer.
      expect(resposta.status).toBe(200);
      expect(resposta.tipoDeConteudo).toBe(TIPO_DE_MIDIA_DO_CARNE);
      expect(await marcasDe(resposta.bytes)).toEqual([
        marcaDaParcela(0),
        marcaDaParcela(1),
        marcaDaParcela(2),
      ]);

      // A rebusca ACONTECEU, e o número de chamadas é exato — `1`, e não "foi chamada": duas
      // consultas significariam que a leitura de disco falhou também para outra parcela, e zero
      // significaria que os bytes vieram de outro lugar.
      expect(
        roteiro.consultas - consultasAntes,
        'o número de consultas ao provedor divergiu de exatamente uma rebusca',
      ).toBe(1);

      // O cache foi REGRAVADO — o arquivo está de volta no disco.
      expect(await existeNaGuarda(codigoApagado)).toBe(true);

      // E a trilha **não** ganhou item: rebuscar cache não é efeito (ADR-0034). A comparação é da
      // contagem exata, e não de "não cresceu muito".
      expect(
        await itensDaTrilha(codigoApagado),
        'a rebusca do cache gravou evento na trilha bancária',
      ).toBe(trilhaAntes);
    },
    LIMITE_CASO_MS,
  );

  it(
    'CT-997 — cobrança sem boleto faz o carnê recusar nomeando a PRIMEIRA por vencimento',
    async () => {
      // O recorte alcança TRÊS parcelas: a do índice 4, **com** boleto, e as dos índices 5 e 6,
      // **sem**. É o arranjo que discrimina — "a primeira do recorte" nomearia a 4, "a última sem
      // boleto" nomearia a 6, e só "a primeira sem boleto na ordem de vencimento" nomeia a 5.
      const resposta = await pedirCarne(contratoDeA, recorteDe(4, 6));

      expect(resposta.status).toBe(404);
      expect(resposta.corpo).toEqual({
        codigo: CODIGO_DE_NAO_ENCONTRADO,
        mensagem: MENSAGEM_DE_NAO_ENCONTRADO,
        campo: 'codigo',
        detalhes: { [DISCRIMINADOR_DO_CARNE]: BOLETO_AUSENTE, cobranca: codigoDa(5) },
      });

      // Nenhum documento saiu, e o cabeçalho de disposição **não** foi escrito: a ordem em que a
      // rota escreve os cabeçalhos é conteúdo, e escrevê-los antes de os bytes existirem faria o
      // envelope de erro sair anunciando-se como PDF.
      expect(textoInicialDe(resposta.bytes)).not.toBe(ASSINATURA_DO_PDF);
      expect(resposta.disposicao).toBe('');
    },
    LIMITE_CASO_MS,
  );

  it(
    'CT-998 — recorte que não alcança cobrança nenhuma recusa com SEM_COBRANCAS',
    async () => {
      // O recorte é **válido** e o contrato **tem** cobranças: é isso que faz a recusa vir da
      // seleção, e não da conferência de entrada nem da existência do recurso.
      const inicio = exigirParcela(0);
      const de = competenciaDeslocada(inicio.competencia, 24);
      const ate = competenciaDeslocada(inicio.competencia, 26);

      const resposta = await pedirCarne(contratoDeA, { de, ate });

      expect(resposta.status).toBe(404);
      expect(resposta.corpo).toEqual({
        codigo: CODIGO_DE_NAO_ENCONTRADO,
        mensagem: MENSAGEM_DE_NAO_ENCONTRADO,
        campo: 'codigo',
        detalhes: { [DISCRIMINADOR_DO_CARNE]: SEM_COBRANCAS },
      });

      expect(textoInicialDe(resposta.bytes)).not.toBe(ASSINATURA_DO_PDF);
      expect(resposta.disposicao).toBe('');
    },
    LIMITE_CASO_MS,
  );

  it(
    'CT-999 — o mesmo recorte, pedido duas vezes, produz o mesmo conteúdo na mesma ordem',
    async () => {
      const recorte = recorteDe(0, 2);

      const primeiro = await pedirCarne(contratoDeA, recorte);
      const segundo = await pedirCarne(contratoDeA, recorte);

      expect(primeiro.status).toBe(200);
      expect(segundo.status).toBe(200);

      const marcasDoPrimeiro = await marcasDe(primeiro.bytes);
      const marcasDoSegundo = await marcasDe(segundo.bytes);

      // ⚠️ A comparação é de **conteúdo e ordem**, e não de bytes brutos: metadado de geração do PDF
      // divergiria por razão alheia à invariante, e fabricar um instante fixo seria mentira gravada
      // no documento.
      expect(
        marcasDoSegundo,
        'dois pedidos do mesmo recorte divergiram em conteúdo ou ordem',
      ).toEqual(marcasDoPrimeiro);

      // E a âncora contra vacuidade: duas listas vazias seriam iguais e não provariam nada.
      expect(marcasDoPrimeiro).toEqual([marcaDaParcela(0), marcaDaParcela(1), marcaDaParcela(2)]);
    },
    LIMITE_CASO_MS,
  );

  it(
    'CT-1000 — carnê de contrato de outra empresa é indistinguível de inexistente',
    async () => {
      const recorte = recorteDe(0, 2);

      // O contrato de B **existe**, e a existência é AFIRMADA pela rota real com a sessão dela — não
      // suposta: é isso que torna a resposta de A uma afirmação sobre o **isolamento**, e não sobre
      // um código inventado. E o código dele é distinto do de A, pela razão registrada no arranjo.
      expect(contratoDeB).not.toBe(contratoDeA);
      expect(
        (await pedir(base, `${COLECAO_DE_CONTRATOS}/${contratoDeB}`, { cookie: cookieDeB })).status,
        'o contrato da empresa B não é alcançável nem pela sessão dela: o caso mediria inexistência',
      ).toBe(200);

      const alheio = await pedirCarne(contratoDeB, recorte);
      const inexistente = await pedirCarne(CONTRATO_INEXISTENTE, recorte);

      const corpoCanonico = {
        codigo: CODIGO_DE_NAO_ENCONTRADO,
        mensagem: MENSAGEM_DE_NAO_ENCONTRADO,
        campo: 'codigo',
      };

      expect(alheio.status).toBe(404);
      expect(inexistente.status).toBe(404);

      // ⚠️ **A comparação de um corpo contra o outro precede deliberadamente as igualdades contra o
      // envelope canônico.** É ela que nomeia a invariante da ADR-0008 — *indistinguível* —, e a
      // implicação entre as três corre num sentido só: se ambos já foram afirmados iguais ao MESMO
      // literal, esta linha não pode reprovar em estado alcançável, que é o AP-29 medido pelo Gate 1
      // nesta task. Avaliada aqui, com apenas os dois status afirmados, ela reprova primeiro contra
      // o `404` que vaza existência — o que acrescenta `detalhes` a um dos lados e não ao outro.
      expect(alheio.corpo, 'o 404 de contrato alheio divergiu do de contrato inexistente').toEqual(
        inexistente.corpo,
      );

      // E as igualdades de objeto INTEIRO, que provam o que a comparação acima não prova: o conteúdo
      // exato do envelope. Dois corpos igualmente ERRADOS satisfariam a linha anterior; a ausência
      // de `detalhes` só vira asserção aqui, e ela precisa valer nos DOIS lados.
      expect(alheio.corpo).toEqual(corpoCanonico);
      expect(inexistente.corpo).toEqual(corpoCanonico);

      // E os cabeçalhos equivalentes: nenhum dos dois anuncia PDF nem sugere nome de arquivo.
      expect(alheio.tipoDeConteudo).toBe(inexistente.tipoDeConteudo);
      expect(alheio.disposicao).toBe('');
      expect(inexistente.disposicao).toBe('');
    },
    LIMITE_CASO_MS,
  );

  it(
    'CT-1000 (b) — a rota herda a exigência da CLASSE: 401 sem sessão e 403 sem a área',
    async () => {
      const recorte = recorteDe(0, 2);

      const semSessao = await pedirBytes(base, rotaDoCarne(contratoDeA, recorte));

      expect(semSessao.status).toBe(401);
      expect((semSessao.corpo as { codigo?: string }).codigo).toBe(CodigoErro.NAO_AUTENTICADO);

      const semArea = await pedirCarne(contratoDeA, recorte, cookieSemArea);

      expect(semArea.status).toBe(403);
      expect(semArea.corpo).toEqual({
        codigo: CodigoErro.ACESSO_NEGADO,
        mensagem: MENSAGEM_DE_ACESSO_NEGADO,
        detalhes: { exigido: AREA_DOS_CONTRATOS },
      });

      // Nenhum dos dois devolve documento: a guarda decide **antes** do manipulador, e por isso
      // nenhum cabeçalho de disposição chega a ser escrito.
      expect(textoInicialDe(semSessao.bytes)).not.toBe(ASSINATURA_DO_PDF);
      expect(textoInicialDe(semArea.bytes)).not.toBe(ASSINATURA_DO_PDF);
      expect(semSessao.disposicao).toBe('');
      expect(semArea.disposicao).toBe('');
    },
    LIMITE_CASO_MS,
  );

  it(
    'CT-1001 — recorte malformado recusa nomeando o campo, sem abrir unidade de trabalho',
    async () => {
      const inicio = exigirParcela(0);

      // As QUATRO formas inválidas, cada uma com o campo que a recusa deve nomear. O contrato é o
      // **válido e existente**, para que a recusa venha da entrada e não do recurso.
      const formas: readonly { readonly recorte: RecorteBruto; readonly campo: string }[] = [
        // (a) invertido — o início está adiante do fim, e quem precisa recuar é `de`.
        {
          recorte: { de: competenciaDeslocada(inicio.competencia, 3), ate: inicio.competencia },
          campo: 'de',
        },
        // (b) largo demais — treze competências, e quem precisa recuar é `ate`.
        {
          recorte: {
            de: inicio.competencia,
            ate: competenciaDeslocada(inicio.competencia, COMPETENCIAS_ALEM_DO_TETO - 1),
          },
          campo: 'ate',
        },
        // (c) competência fora do primeiro dia do mês.
        {
          recorte: {
            de: `${inicio.competencia.slice(0, 7)}-15`,
            ate: competenciaDeslocada(inicio.competencia, 2),
          },
          campo: 'de',
        },
        // (d) data que não existe no calendário — `z.iso.date()` a recusa antes de qualquer refine.
        {
          recorte: { de: '2026-02-30', ate: competenciaDeslocada(inicio.competencia, 2) },
          campo: 'de',
        },
      ];

      const unidadesAntes = unidadesAbertas;

      for (const forma of formas) {
        const resposta = await pedirCarne(contratoDeA, forma.recorte);

        expect(resposta.status, `a forma que deveria recusar por ${forma.campo} não deu 422`).toBe(
          422,
        );

        // Igualdade de objeto INTEIRO: o `campo` é o que a `.claude/rules/contrato-publicado.md`
        // exige que a recusa nomeie, e um booleano de insucesso aprovaria qualquer falha de esquema.
        expect(resposta.corpo).toEqual({
          codigo: CODIGO_DE_CAMPO_INVALIDO,
          mensagem: MENSAGEM_DE_CAMPO_INVALIDO,
          campo: forma.campo,
        });

        expect(textoInicialDe(resposta.bytes)).not.toBe(ASSINATURA_DO_PDF);
        expect(resposta.disposicao).toBe('');
      }

      // ---------------------------------------------------------------------------------------
      // ZERO unidades de trabalho — e o CONTROLE POSITIVO, no mesmo caso
      // ---------------------------------------------------------------------------------------
      //
      // A contagem sozinha não provaria nada: um contador que nunca incrementasse daria zero para
      // tudo. O controle é o pedido **bem formado** logo abaixo, que percorre o mesmo manipulador e
      // abre **exatamente uma** unidade — a da leitura do recorte.
      expect(
        unidadesAbertas - unidadesAntes,
        'a recusa de recorte malformado abriu unidade de trabalho no banco',
      ).toBe(0);

      const unidadesAntesDoControle = unidadesAbertas;
      const controle = await pedirCarne(contratoDeA, recorteDe(0, 2));

      expect(controle.status).toBe(200);
      expect(
        unidadesAbertas - unidadesAntesDoControle,
        'o controle positivo do contador não abriu a unidade da leitura do recorte',
      ).toBe(1);
    },
    LIMITE_CASO_MS,
  );

  it(
    'CT-1003 — provedor indisponível na rebusca responde 503 sem regravar coisa alguma',
    async () => {
      // ---------------------------------------------------------------------------------------
      // ESTE CASO É AUTO-CONTIDO: ele muta o ARRANJO COMPARTILHADO e o repõe — disco inclusive
      // ---------------------------------------------------------------------------------------
      //
      // Ele apaga da guarda os bytes de uma parcela que pertence ao recorte `0..2` — o mesmo que o
      // `CT-995`, o `CT-996`, o `CT-999` e o controle positivo do `CT-1001` pedem —, e a rebusca que
      // ele força a falhar **não** os regrava. Sem reposição, o arranjo do `beforeAll` fica mutilado
      // até o fim do arquivo e o verde passa a depender de este `it` ser o último declarado: em
      // ordem alternada, o `CT-996` mediria **duas** rebuscas em vez de uma, e o controle positivo
      // do `CT-1001` mediria **duas** unidades de trabalho, porque a rebusca abre unidade própria
      // para ler o certificado.
      //
      // A reposição mora no `finally`, ao lado da do roteiro, porque é o único lugar que roda
      // aconteça o que acontecer; a **asserção** sobre ela fica depois do bloco, para que um
      // `expect` do `try` que reprove chegue ao relatório com a causa original em vez de ser
      // mascarado pela reposição. É a disciplina que o docblock da suíte declara.
      const recorte = recorteDe(0, 2);
      const codigoApagado = codigoDa(2);

      expect(await existeNaGuarda(codigoApagado)).toBe(true);
      await rm(arquivoDoBoleto(codigoApagado));
      expect(await existeNaGuarda(codigoApagado)).toBe(false);

      const consultasAntes = roteiro.consultas;
      const trilhaAntes = await itensDaTrilha(codigoApagado);

      roteiro.responderConsulta = false;
      let bytesRepostos = false;
      try {
        const resposta = await pedirCarne(contratoDeA, recorte);

        // Os bytes SÃO o desfecho: engolir a falha responderia `200` com um caderno incompleto.
        expect(resposta.status).toBe(503);
        expect((resposta.corpo as { codigo?: string }).codigo).toBe(CODIGO_DE_SERVICO_INDISPONIVEL);
        expect(textoInicialDe(resposta.bytes)).not.toBe(ASSINATURA_DO_PDF);
        expect(resposta.disposicao).toBe('');

        // A rebusca foi TENTADA — sem esta linha, um `503` vindo de outro ponto satisfaria o caso.
        expect(roteiro.consultas - consultasAntes).toBe(1);

        // E **nada** foi alterado: o arquivo continua ausente, e a trilha continua do mesmo tamanho.
        expect(
          await existeNaGuarda(codigoApagado),
          'a rebusca que falhou regravou bytes na guarda',
        ).toBe(false);
        expect(await itensDaTrilha(codigoApagado)).toBe(trilhaAntes);
      } finally {
        // O roteiro volta ao padrão ACONTEÇA O QUE ACONTECER acima: um `expect` que reprovasse antes
        // deixaria o par recusando consulta e faria outro caso falhar por arrasto.
        roteiro.responderConsulta = true;

        // E os BYTES voltam pelo mesmo caminho que os tirou: com o provedor de novo disponível, o
        // pedido do recorte rebusca a parcela ausente e a guarda a regrava. É o caminho legítimo —
        // nada aqui escreve no disco por fora do produto.
        await pedirCarne(contratoDeA, recorte);
        bytesRepostos = await existeNaGuarda(codigoApagado);
      }

      // A reposição é AFIRMADA, e não apenas executada: sem esta linha, um caminho de rebusca que
      // deixasse de regravar devolveria o arranjo mutilado em silêncio, e a dependência de ordem
      // voltaria sem nada acusar.
      expect(
        bytesRepostos,
        'o caso não repôs na guarda os bytes que apagou do arranjo compartilhado',
      ).toBe(true);
    },
    LIMITE_CASO_MS,
  );
});

// ---------------------------------------------------------------------------
// Os acessórios do arranjo
// ---------------------------------------------------------------------------

/** O par de competências de um recorte, tal como ele viaja na cadeia de consulta. */
interface RecorteBruto {
  readonly de: string;
  readonly ate: string;
}

/** O recorte que vai da parcela de índice `de` à de índice `ate`, inclusive. */
function recorteDe(de: number, ate: number): RecorteBruto {
  return { de: exigirParcela(de).competencia, ate: exigirParcela(ate).competencia };
}

/** A rota do carnê, composta do dono do segmento mais a cadeia de consulta. */
function rotaDoCarne(codigo: string, recorte: RecorteBruto): string {
  const consulta = new URLSearchParams({ de: recorte.de, ate: recorte.ate });

  return `${COLECAO_DE_CONTRATOS}/${codigo}/carne?${consulta.toString()}`;
}

/** Pede o carnê pela rota real, em bytes. A sessão do arranjo é o padrão. */
async function pedirCarne(
  codigo: string,
  recorte: RecorteBruto,
  credencial: string = cookie,
): Promise<RespostaEmBytes> {
  return await pedirBytes(base, rotaDoCarne(codigo, recorte), { cookie: credencial });
}

/** A competência sem o dia — a metade que entra no nome do arquivo. */
function semDia(competencia: string): string {
  return competencia.slice(0, 7);
}

/** Os primeiros caracteres do corpo, para comparar com a assinatura do PDF. */
function textoInicialDe(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes.subarray(0, ASSINATURA_DO_PDF.length));
}

/**
 * As marcas encontradas no documento, **na ordem de aparição**.
 *
 * A extração é do texto real do PDF, pelo acessório único de `./documento.ts`. A expressão global é o
 * que produz a **sequência** — a ordem das páginas do carnê chega aqui como a ordem do arranjo.
 */
async function marcasDe(bytes: Uint8Array): Promise<readonly string[]> {
  const texto = await extrairTextoDePdf(bytes);

  return [...texto.matchAll(MARCAS_NO_TEXTO)].map((achado) => achado[0]);
}

/** A marca esperada da parcela de índice `indice`. */
function marcaDaParcela(indice: number): string {
  return marcaDe(exigirParcela(indice).vencimento);
}

/** O código da cobrança da parcela de índice `indice`. */
function codigoDa(indice: number): string {
  const codigo = codigoPorCompetencia.get(exigirParcela(indice).competencia);

  if (codigo === undefined) {
    throw new Error(`o arranjo não lançou cobrança para a parcela ${String(indice)}`);
  }

  return codigo;
}

/** A parcela de índice `indice`, ou uma falha nomeada — `noUncheckedIndexedAccess` é a razão. */
function exigirParcela(indice: number): ParcelaDoArranjo {
  const parcela = parcelas[indice];

  if (parcela === undefined) {
    throw new Error(`o arranjo não preparou a parcela de índice ${String(indice)}`);
  }

  return parcela;
}

/**
 * O alvo que a guarda usa para os bytes de uma cobrança — composto **à mão**, jamais pedido ao SUT.
 *
 * O diretório vem da aplicação montada, e o nome é composto do código mais a extensão escrita à mão
 * neste arquivo: derivá-lo da guarda faria o caso concordar com ela sobre onde os bytes moram, que é
 * justamente o que ele precisa saber por fora.
 */
function arquivoDoBoleto(codigo: string): string {
  return join(diretorioDosBoletos(), `${codigo}${EXTENSAO_DO_CARNE}`);
}

/** O diretório dos boletos, lido **da aplicação montada** — nunca do ambiente do processo. */
function diretorioDosBoletos(): string {
  return aplicacao.get<Ambiente>(TOKEN_AMBIENTE).diretorioDosBoletos;
}

/** Os bytes daquela cobrança estão no disco? Leitura de presença, e nunca de conteúdo. */
async function existeNaGuarda(codigo: string): Promise<boolean> {
  try {
    await access(arquivoDoBoleto(codigo));

    return true;
  } catch {
    return false;
  }
}

/** Quantos itens a trilha bancária da cobrança publica — pela rota real que o cliente lê. */
async function itensDaTrilha(codigo: string): Promise<number> {
  const resposta = await pedir(base, `${COLECAO_DE_COBRANCAS}/${codigo}/historico-bancario`, {
    cookie,
  });

  if (resposta.status !== 200) {
    throw new Error(`o histórico de ${codigo} respondeu ${String(resposta.status)}`);
  }

  return (resposta.corpo as { itens: readonly unknown[] }).itens.length;
}

/**
 * As `quantidade` competências seguintes à corrente, com o vencimento no dia 10 de cada uma.
 *
 * Derivadas do relógio do **banco** (`negocio.data_corrente_da_operacao()`), e não do processo: é o
 * mesmo eixo que a série da cobrança usa, e datas do processo divergiriam dele por fuso.
 */
async function competenciasFuturas(quantidade: number): Promise<readonly ParcelaDoArranjo[]> {
  return await acessoDaSuite.emUnidadeDeTrabalho(async (tx) => {
    return await tx<ParcelaDoArranjo[]>`
      SELECT to_char(
               date_trunc('month', negocio.data_corrente_da_operacao())
                 + make_interval(months => passo::int),
               'YYYY-MM-DD'
             ) AS competencia,
             to_char(
               date_trunc('month', negocio.data_corrente_da_operacao())
                 + make_interval(months => passo::int, days => ${DIA_DE_VENCIMENTO - 1}),
               'YYYY-MM-DD'
             ) AS vencimento
        FROM generate_series(1, ${quantidade}) AS passo
       ORDER BY passo
    `;
  });
}

/** A competência deslocada em `meses`, calculada pelo **banco** e nunca por aritmética de `Date`. */
function competenciaDeslocada(competencia: string, meses: number): string {
  const [ano, mes] = competencia.split('-');
  const absoluto = Number(ano) * 12 + Number(mes) - 1 + meses;

  return `${String(Math.floor(absoluto / 12)).padStart(4, '0')}-${String((absoluto % 12) + 1).padStart(2, '0')}-01`;
}

/**
 * Registra o certificado vigente da empresa pela **porta de domínio** — ver o cabeçalho.
 *
 * A validade sai do relógio do banco (ADR-0026), e o material é sorteado por execução: ele nunca é
 * aberto por nada nesta suíte, e o que a rebusca faz com ele é entregá-lo ao par instrumentado.
 */
async function registrarCertificadoVigente(
  empresaId: string,
  registradoPor: string,
): Promise<void> {
  const envelopeCifrado = cifrarSegredo(
    criarSegredoOperavel({
      material: Buffer.concat([Buffer.from(`material-${randomUUID()}-`), randomBytes(64)]),
      senha: `senha-${randomUUID()}`,
    }),
    aplicacao.get<Ambiente>(TOKEN_AMBIENTE).chaveDeCifraDoCertificado,
  );

  await contextoDeTenant.executarCom({ empresaId }, async () => {
    const validade = await acessoDaSuite.emUnidadeDeTrabalho(async (tx) => {
      const [linha] = await tx<{ de: Date; ate: Date }[]>`
        SELECT (negocio.data_corrente_da_operacao() - INTERVAL '1 day')::timestamptz AS de,
               (negocio.data_corrente_da_operacao() + INTERVAL '365 days')::timestamptz AS ate
      `;

      if (linha === undefined) {
        throw new Error('o relógio do banco não devolveu a validade do certificado do arranjo');
      }

      return linha;
    });

    await acessoDaSuite.emUnidadeDeTrabalho(async (tx) => {
      await registrarCertificado(tx, {
        titular: `Empresa ${empresaId.slice(0, 8)}`,
        validoDe: validade.de,
        validoAte: validade.ate,
        impressaoDigital: randomUUID(),
        segredoCifrado: envelopeCifrado,
        registradoPor,
      });
    });
  });
}

/** Monta conjunto, imóvel, locador, locatário e um contrato **ATIVO**, todos pelas rotas reais. */
async function contratoAtivo(credencial: string): Promise<string> {
  const conjuntoId = (
    await criarPor(
      `/${PREFIXO_DE_VERSAO}/${CAMINHO_DOS_CONJUNTOS}`,
      { nome: `Edifício ${String(proximo())}` },
      credencial,
    )
  ).id;
  const imovelId = (
    await criarPor(
      `/${PREFIXO_DE_VERSAO}/${CAMINHO_DOS_IMOVEIS}`,
      corpoDeImovel(conjuntoId),
      credencial,
    )
  ).id;
  const locadorId = (
    await criarPor(`/${PREFIXO_DE_VERSAO}/${CAMINHO_DOS_LOCADORES}`, corpoDePessoa(), credencial)
  ).id;
  const locatarioId = (
    await criarPor(`/${PREFIXO_DE_VERSAO}/${CAMINHO_DOS_LOCATARIOS}`, corpoDePessoa(), credencial)
  ).id;

  const montagem = await pedir(base, COLECAO_DE_CONTRATOS, {
    metodo: 'POST',
    cookie: credencial,
    corpo: {
      imovelId,
      locadorId,
      locatarioId,
      fiadoresIds: [],
      dataInicioLocacao: DATA_DE_INICIO,
      prazoMeses: PRAZO_EM_MESES,
      valorMensal: VALOR_MENSAL,
      diaVencimento: DIA_DE_VENCIMENTO,
      // Sem geração automática: as parcelas deste arranjo são lançadas uma a uma, com competência e
      // vencimento escolhidos — doze parcelas nascidas da ativação não serviriam a asserção alguma.
      gerarCobrancasAutomaticamente: false,
    },
  });

  if (montagem.status !== 201) {
    throw new Error(
      `a montagem do contrato respondeu ${String(montagem.status)}: ${montagem.texto}`,
    );
  }

  const codigo = (montagem.corpo as { codigo: string }).codigo;

  const ativacao = await pedir(base, `${COLECAO_DE_CONTRATOS}/${codigo}/ativacao`, {
    metodo: 'POST',
    cookie: credencial,
    corpo: {},
  });

  if (ativacao.status !== 200) {
    throw new Error(
      `a ativação de ${codigo} respondeu ${String(ativacao.status)}: ${ativacao.texto}`,
    );
  }

  return codigo;
}

/** Lança a cobrança da parcela pela rota real, e devolve o código emitido pela série. */
async function lancar(contratoCodigo: string, parcela: ParcelaDoArranjo): Promise<string> {
  const resposta = await pedir(base, COLECAO_DE_COBRANCAS, {
    metodo: 'POST',
    cookie,
    corpo: {
      contratoCodigo,
      natureza: 'ALUGUEL',
      referencia: REFERENCIA_DA_COBRANCA,
      competencia: parcela.competencia,
      dataVencimento: parcela.vencimento,
      valorOriginal: VALOR_DA_COBRANCA,
    },
  });

  if (resposta.status !== 201) {
    throw new Error(`o lançamento respondeu ${String(resposta.status)}: ${resposta.texto}`);
  }

  return (resposta.corpo as { codigo: string }).codigo;
}

/** Emite o boleto da cobrança pela rota real — é ela que grava os bytes na guarda. */
async function emitirBoleto(codigo: string): Promise<void> {
  const resposta = await pedir(base, `${COLECAO_DE_COBRANCAS}/${codigo}/emissao-de-boleto`, {
    metodo: 'POST',
    cookie,
    corpo: {},
  });

  if (resposta.status !== 200) {
    throw new Error(
      `a emissão de ${codigo} respondeu ${String(resposta.status)}: ${resposta.texto}`,
    );
  }
}

/** Cria um recurso pela rota informada e devolve o identificador dele. A falha levanta. */
async function criarPor(
  colecao: string,
  corpo: Record<string, unknown>,
  credencial: string,
): Promise<{ readonly id: string }> {
  const resposta = await pedir(base, colecao, { metodo: 'POST', cookie: credencial, corpo });

  if (resposta.status !== 201) {
    throw new Error(
      `a criação em ${colecao} respondeu ${String(resposta.status)}: ${resposta.texto}`,
    );
  }

  return resposta.corpo as { readonly id: string };
}

/** O contador que mantém nomes, documentos e identificadores distintos entre os cenários. */
let sequencial = 0;

function proximo(): number {
  sequencial += 1;

  return sequencial;
}

/** O corpo completo de um imóvel — os campos que o cadastro exige, com marca única por construção. */
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

/** O corpo completo de um cadastro de pessoa, com documento e e-mail únicos por construção. */
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
