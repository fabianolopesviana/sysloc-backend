/**
 * O **vocabulário do provedor na saída real** das sete rotas da fatia `emissao-e-conciliacao`
 * (T17 — o fecho da fatia).
 *
 * ---------------------------------------------------------------------------
 * INVARIANTES
 * ---------------------------------------------------------------------------
 *
 * | Critério | Caso | Invariante |
 * |---|---|---|
 * | CA-20 | CT-934 | Varridos os **14 corpos de resposta REAIS** das sete rotas — sete de sucesso e
 * |       |        | sete de erro —, mais os cabeçalhos que os acompanham e as **chaves do documento
 * |       |        | publicado**, nenhum termo do provedor aparece como chave, valor, código ou
 * |       |        | estado. E o **mesmo** varredor, aplicado a objetos de controle com os termos
 * |       |        | plantados **canal a canal** — chave de topo, campo aninhado, item de lista e
 * |       |        | valor de enum —, encontra todos eles, com a lista afirmada por igualdade em cada
 * |       |        | canal. Os 14 corpos são afirmados **não-vazios**, e os status são exatamente
 * |       |        | sete `2xx` e sete `4xx`. (ADR-0001) |
 *
 * Rastreabilidade: `CA-20 → CT-934 (RN-15)`.
 *
 * ===========================================================================
 * É a metade que o CT-933 NÃO alcança — e por que as duas precisam existir
 * ===========================================================================
 *
 * O `CT-933`, em `packages/cobranca-bancaria/test/vocabulario-canonico.spec.ts`, varre **NOMES
 * declarados no fonte**: a assinatura da porta, os símbolos exportados, o texto dos arquivos. Ele é
 * asserção **estática**, e por isso lá a prova de falsificação é obrigatória.
 *
 * Este caso varre **VALORES que saíram em execução**. É asserção **comportamental**: ele sobe a
 * aplicação, exerce as sete rotas de verdade e olha o que o cliente recebeu. A diferença de método
 * não é estilo — a emenda de 2026-08-17 da **ADR-0001** diz, por escrito, que a conformidade à
 * cláusula de vocabulário *"é exigível por medição da saída real"*, e é isso que a ADR-0032 já
 * obrigava para o segredo: **jamais ler o fonte para afirmar ausência de vazamento**.
 *
 * Nenhum dos dois implica o outro, e o par é o que fecha a CA-20:
 *
 *   * um nome de campo poderia ser canônico no fonte e o **valor** publicado carregar o termo — um
 *     `origem: 'SICOOB'` num enum, um `motivo` que repetisse o texto cru do provedor. O `CT-933` é
 *     cego para isso, porque nada disso é nome de símbolo;
 *   * e o inverso: um símbolo do provedor pode existir em `src/` sem nunca chegar a corpo algum, e é
 *     o `CT-933` que o acusa — este caso ficaria verde.
 *
 * ⚠️ **Asserção comportamental dispensa prova de falsificação** (P4 do Protocolo Antirregressão, e a
 * fronteira que a `.claude/rules/testing-stack.md` fixa), **mas o controle positivo continua
 * obrigatório** — e ele NÃO é mutante: é parte da asserção. Sem ele, um varredor quebrado devolveria
 * `[]` para tudo e a prova inteira passaria por vacuidade, que é o modo de falha clássico desta
 * classe de caso.
 *
 * ===========================================================================
 * Por que este caso mora em arquivo PRÓPRIO
 * ===========================================================================
 *
 * A §3.2 da T17 registra a observação do challenge por extenso: o `CT-934` fora planejado para
 * `cobertura-de-autorizacao.e2e.spec.ts`, que **já é o inventário de rotas** — e empilhar ali a
 * varredura de vocabulário tornaria aquele arquivo dono de dois assuntos. A observação foi medida e
 * acatada, e as duas razões concretas são:
 *
 *   1. aquele arquivo audita **metadado** (a tabela do roteador, os decoradores) e monta seis
 *      aplicações que **não** exercitam negócio. Este precisa de contrato, cobrança, certificado e de
 *      uma **porta de cobrança instrumentada** — arranjo que não serve a nenhum caso de lá;
 *   2. o fecho de superfície daquele arquivo é o `CT-937`, e ele carrega o histórico dos mutantes de
 *      cinco fatias. Somar a esse cabeçalho a doutrina de varredura de vocabulário tornaria ilegível
 *      o que hoje é o mapa de uma decisão só.
 *
 * ===========================================================================
 * DUAS aplicações, e cada uma responde por uma metade da medição
 * ===========================================================================
 *
 *   * a **instrumentada** exerce as sete rotas. Ela é a aplicação de produção montada por inteiro —
 *     a mesma composição raiz, o mesmo roteador, as mesmas guardas —, com **uma** substituição feita
 *     pelo arcabouço de teste (`overrideProvider` sobre o token que a composição já publica): a porta
 *     de cobrança. Sem ela não há emissão, e sem emissão não há corpo de sucesso a varrer. Nada em
 *     `apps/api/src` ganhou bandeira, parâmetro ou ramo (Iron Law #6);
 *   * a **real** (`criarAplicacao()`) responde pelo **documento publicado**. Ela é necessária porque
 *     o documento nasce de `publicarContrato()`, que só a composição de produção chama — a montagem
 *     do arcabouço de teste não o registra.
 *
 * As duas dividem a instância efêmera de banco e a de fila, e cada uma tem porta **reservada**
 * própria (trava atômica, e não `port: 0`): o arcabouço de identidade confere a origem das
 * requisições com cookie contra o endereço base, composto a partir da porta CONFIGURADA.
 *
 * A montagem instrumentada vem de `./aplicacao-instrumentada.ts`, que é a casa única dela desde o
 * fecho do débito `D57` (F3/T12) na intervenção dirigida de 2026-08-18. Esta suíte era a QUARTA
 * cópia literal daquela montagem — as outras três estavam em `automacao-de-cobranca.e2e.spec.ts`,
 * `autorizacao-do-dominio.e2e.spec.ts` e `equivalencia-com-o-oraculo.spec.ts` —, e as quatro
 * migraram no mesmo diff.
 *
 * ===========================================================================
 * Precondição privilegiada — tudo pelo caminho REAL
 * ===========================================================================
 *
 * A sessão sai da rota pública de entrada; a permissão é escrita por `escreverAjustes` sob o contexto
 * de tenant da empresa da pessoa, com a regra de domínio validando a coerência, e o efetivo é
 * **AFIRMADO** por `GET /v1/sessao` antes do primeiro fluxo. O certificado, o contrato, a ativação, a
 * cobrança e os dois atos sobre o boleto acontecem **pelas rotas**. Nada é forjado, e nenhum símbolo
 * nasceu em `apps/api/src` para este arquivo existir.
 *
 * ===========================================================================
 * De onde vêm o banco, a fila e a credencial (ADR-0006)
 * ===========================================================================
 *
 * De instâncias efêmeras próprias. Nenhuma coordenada de conexão é lida do ambiente: o ambiente do
 * processo é MONTADO a partir do que os helpers devolvem.
 */

import { randomBytes } from 'node:crypto';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { type ChaveDoCatalogo, validarCoerenciaDeAjustes } from '@sysloc/auth';
import type {
  AdaptadorCobrancaBancaria,
  BoletoEmitido,
  DesfechoDaOperacao,
  PedidoDeEmissao,
  SituacaoConsultada,
} from '@sysloc/cobranca-bancaria';
import {
  type AcessoAoBanco,
  abrirAcessoAoBanco,
  contextoDeTenant,
  EMPRESA_A,
  escreverAjustes,
  SENHA_DA_CARGA,
} from '@sysloc/db';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
// DÉBITO COM GATILHO — D28 · F0/T5 · gatilho JÁ DISPARADO (F1/T2, 2026-08-02)
// (NÃO é uma `DECISÃO FECHADA`: ele agenda uma mudança, não protege o código abaixo.)
// O QUÊ: os imports a seguir atravessam a fronteira de `@sysloc/auth`, de `@sysloc/shared` e de
//        `@sysloc/cobranca-bancaria` por CAMINHO DE ARQUIVO, fora do `exports` e do `files` daqueles
//        manifestos. As dependências de workspace estão declaradas, então não há dependência oculta;
//        o que não existe é FRONTEIRA para os diretórios `test/` — e este arquivo é mais um a
//        repetir o padrão.
// QUANDO FECHA: o gatilho já disparou e o fechamento segue pendente; ele é o mesmo de sempre —
//        declarar o subpath `"./test"` nos manifestos e importar por `@sysloc/<pacote>/test`, ou
//        extrair um `@sysloc/test-utils`.
// POR QUE NÃO AGORA: fechar exige editar os manifestos de três pacotes e todos os consumidores,
//        nenhum deles no escopo desta task, e o índice de débitos do `CLAUDE.md`.
// ÍNDICE: docs/specs/features/fundacao-stack-nativa/v1/_run/run-report.md §2, D28
import {
  type IdentidadeEfemera,
  identidadeEfemera,
  pessoaSemeada,
} from '../../../packages/auth/test/identidade-efemera.ts';
import {
  type AutoridadeDeTeste,
  gerarAutoridadeDeTeste,
  gerarMaterialDeTeste,
} from '../../../packages/cobranca-bancaria/test/material-de-teste.ts';
import { reservarPorta } from '../../../packages/shared/test/efemero-comum.ts';
import { type FilaEfemera, redisEfemero } from '../../../packages/shared/test/redis-efemero.ts';
import { PREFIXO_DAS_ROTAS_DE_IDENTIDADE } from '../src/autenticacao/autenticacao.module.ts';
import { CAMINHO_DA_SESSAO } from '../src/autenticacao/sessao.controller.ts';
import { CAMINHO_DOS_LOCADORES } from '../src/cadastros/locador.controller.ts';
import { CAMINHO_DOS_LOCATARIOS } from '../src/cadastros/locatario.controller.ts';
import {
  CAMINHO_DA_COBRANCA_BANCARIA,
  SEGMENTO_DAS_CONFERENCIAS,
  SEGMENTO_DAS_EMISSOES,
} from '../src/cobranca-bancaria/cobranca-bancaria.controller.ts';
import { CAMINHO_DAS_COBRANCAS } from '../src/cobrancas/cobranca.controller.ts';
import {
  ENDERECO_DE_ESCUTA,
  PREFIXO_DE_VERSAO,
  TOKEN_PORTA_DE_COBRANCA_BANCARIA,
} from '../src/configuracao/ambiente.ts';
import { CAMINHO_DOS_CONTRATOS } from '../src/contratos/contrato.controller.ts';
import { CAMINHO_DOS_CONJUNTOS } from '../src/imoveis/conjunto.controller.ts';
import { CAMINHO_DOS_IMOVEIS } from '../src/imoveis/imovel.controller.ts';
import {
  CAMINHO_DAS_INTEGRACOES_BANCARIAS,
  SEGMENTO_DO_REGISTRO,
} from '../src/integracoes-bancarias/certificado.controller.ts';
import { CAMINHO_DO_DOCUMENTO, criarAplicacao } from '../src/main.ts';
import { montarAplicacaoInstrumentada } from './aplicacao-instrumentada.ts';
import { cpfValido } from './documento.ts';

/** Limite da montagem: banco migrado, semente, fila e as DUAS aplicações. */
const LIMITE_DE_MONTAGEM_MS = 240_000;

/** Limite do caso: ele encadeia o arranjo inteiro e quinze requisições reais. */
const LIMITE_CASO_MS = 180_000;

/** Sufixo do cookie de sessão que o arcabouço de identidade emite. */
const SUFIXO_DO_COOKIE_DE_SESSAO = 'session_token';

/** A rota de entrada — pública, e o único caminho por onde a sessão nasce. */
const ROTA_DE_ENTRADA = `${PREFIXO_DAS_ROTAS_DE_IDENTIDADE}/sign-in/email`;

/** A sessão corrente, de onde a precondição de permissão é AFIRMADA em vez de suposta. */
const CAMINHO_DA_SESSAO_CORRENTE = `/${PREFIXO_DE_VERSAO}/${CAMINHO_DA_SESSAO}`;

/** As coleções que o arranjo e o caso exercitam, compostas dos donos dos segmentos. */
const COLECAO_DE_COBRANCAS = `/${PREFIXO_DE_VERSAO}/${CAMINHO_DAS_COBRANCAS}`;
const COLECAO_DE_CONTRATOS = `/${PREFIXO_DE_VERSAO}/${CAMINHO_DOS_CONTRATOS}`;
const COLECAO_DA_COBRANCA_BANCARIA = `/${PREFIXO_DE_VERSAO}/${CAMINHO_DA_COBRANCA_BANCARIA}`;
const ROTA_DO_REGISTRO_DE_CERTIFICADO = `/${PREFIXO_DE_VERSAO}/${CAMINHO_DAS_INTEGRACOES_BANCARIAS}/${SEGMENTO_DO_REGISTRO}`;

/**
 * Os **nove** termos do provedor que não podem cruzar a fronteira do que o produto publica.
 *
 * Escritos à mão, e **não** importados de `packages/cobranca-bancaria/test/vocabulario-canonico.spec.ts`:
 * eles são o **oráculo** desta medição, e derivá-los da lista que a outra suíte usa faria as duas
 * medições deixarem de ser independentes — um termo que saísse de lá sairia daqui junto, em silêncio,
 * e a fatia perderia as duas provas de uma vez. São duas cópias, e o limiar de promoção deste
 * repositório é o **terceiro** consumidor.
 *
 * Os nove são: o nome do provedor em duas grafias, os quatro campos que o oráculo do sistema antigo
 * usa, os dois parâmetros do fluxo de credencial de acesso e o `pagador` do payload de emissão.
 *
 * ⚠️ `BOLETO` **não** entra, e a ausência é deliberada: ele é vocabulário do **produto** (RN-11),
 * publicado por `@sysloc/contracts`, e incluí-lo faria a varredura reprovar o próprio vocabulário
 * canônico que ela existe para proteger. `provedor` também não: é palavra do produto — o modelo
 * canônico da ADR-0001 nomeia *"o provedor"* justamente para não nomear qual.
 */
const TERMOS_DO_PROVEDOR = [
  'sicoob',
  'bancoob',
  'nossoNumero',
  'seuNumero',
  'numeroContrato',
  'codigoBeneficiario',
  'client_id',
  'scope',
  'pagador',
] as const;

/**
 * Os **quatro canais** por onde um termo pode escapar num corpo JSON, com os termos plantados em cada
 * um — a repartição do controle positivo.
 *
 * A repartição é o que torna o controle uma prova, e não uma formalidade: um varredor que só olhasse
 * as chaves de topo devolveria a lista completa se todos os nove estivessem lá, e ficaria **cego**
 * para o campo aninhado, o item de lista e o valor de enum — que são exatamente as três formas pelas
 * quais o termo escaparia de verdade. Com os nove repartidos, cada canal é afirmado **por igualdade**,
 * e a reprovação nomeia o canal cego.
 *
 * A união dos quatro é afirmada contra {@link TERMOS_DO_PROVEDOR} dentro do caso: sem essa linha, um
 * termo esquecido na repartição nunca seria exercitado por canal algum.
 */
const CONTROLE_POR_CANAL: Readonly<Record<string, readonly string[]>> = {
  'chave de topo': ['sicoob', 'nossoNumero'],
  'campo aninhado': ['bancoob', 'seuNumero'],
  'item de lista': ['numeroContrato', 'codigoBeneficiario'],
  'valor de enum': ['client_id', 'scope', 'pagador'],
};

/** Os termos do arranjo do contrato — valores quaisquer, dentro das condições de entrada. */
const DATA_DE_INICIO = '2026-01-15';
const PRAZO_EM_MESES = 12;
const VALOR_MENSAL = 2500;
const DIA_DE_VENCIMENTO = 10;

/** O valor da cobrança do arranjo, e quantos dias à frente ela vence. */
const VALOR_DA_COBRANCA = 1500;
const DIAS_ATE_O_VENCIMENTO = 30;

/** A referência da cobrança — texto livre do operador, e nada o interpreta. */
const REFERENCIA_DA_COBRANCA = 'Competência do período — parcela';

/** A senha do cofre PKCS#12 do arranjo — sentinela, e nunca comparada com nada do produto. */
const SENHA_DO_MATERIAL = 'senha-do-material-do-ct934';

/**
 * Um código de cobrança e um identificador de lote **bem formados** que não existem.
 *
 * São os alvos das quatro rotas de erro por ausência. Bem formados de propósito: um valor malformado
 * seria recusado com `422` da validação de forma, e o que se quer varrer também é o `404` — que é o
 * corpo que o cliente encontra no caso mais comum.
 */
const COBRANCA_INEXISTENTE = 'COB-2099-0000001';
const LOTE_INEXISTENTE = '11111111-1111-4111-8111-111111111111';

/** Uma chave que nenhum esquema de entrada desta fatia declara — o gatilho dos dois `422`. */
const CHAVE_QUE_NINGUEM_DECLAROU = 'campoQueNinguemDeclarou';

/**
 * O arranjo concedido à sessão que age — literal, e **não** derivado da exigência dos controladores.
 *
 * Derivá-lo faria a asserção concordar com o SUT. As cinco áreas estão aqui por obrigação do cenário
 * — sem contrato ativo não há sobre o que lançar, e sem certificado não há emissão —, e as três ações
 * são as que os atos sobre o boleto exigem.
 */
const CHAVES_DO_ARRANJO: readonly ChaveDoCatalogo[] = [
  'TELA:financeiro',
  'TELA:contratos',
  'TELA:imoveis',
  'TELA:cadastros',
  'TELA:integracoes_bancarias',
  'ACAO:ativar_contrato',
  'ACAO:emitir_boleto',
  'ACAO:solicitar_baixa_de_boleto',
  'ACAO:configurar_integracao',
];

/** A chave afirmada no efetivo da sessão — nunca suposta. É a que governa as sete rotas. */
const AREA_DO_FINANCEIRO: ChaveDoCatalogo = 'TELA:financeiro';

/** Quantas rotas a fatia publica, e quantos corpos o caso coleta — sete de sucesso e sete de erro. */
const ROTAS_DA_FATIA = 7;
const CORPOS_COLETADOS = ROTAS_DA_FATIA * 2;

/** A pessoa que age: `USUARIO_EMPRESA` da empresa A, **da carga**. */
const QUEM_AGE = pessoaSemeada('usuario.a@exemplo.com.br');

let identidade: IdentidadeEfemera;
let fila: FilaEfemera;
let acessoAoNegocio: AcessoAoBanco;
let aplicacao: NestFastifyApplication;
let aplicacaoReal: NestFastifyApplication;
let base: string;
let baseReal: string;
let ambienteAnterior: NodeJS.ProcessEnv;
let cookie: string;

const VARIAVEIS_MONTADAS = [
  'NODE_ENV',
  'PORT',
  'LOG_LEVEL',
  'DATABASE_URL',
  'REDIS_URL',
  'BETTER_AUTH_SECRET',
] as const;

/** Quantos títulos o "provedor" já atribuiu — a sequência DELE, e não a do produto. */
let titulosAtribuidos = 0;

/**
 * A porta de cobrança do arranjo — implementação anotada com o tipo, e não `vi.mock`.
 *
 * Ela entra por `overrideProvider(TOKEN_PORTA_DE_COBRANCA_BANCARIA)`, pelo mecanismo do arcabouço de
 * teste, e **não** por caminho aberto no código de produção.
 *
 * ⚠️ **Os valores que ela devolve são deliberadamente livres de vocabulário do provedor**, e a
 * escolha é conteúdo: se o dublê plantasse `sicoob` na linha digitável, a varredura reprovaria
 * apontando para o **arranjo** em vez de para o produto, e o caso nomearia o defeito errado. O que se
 * mede aqui é o que o **produto** publica, e não o que o par de teste inventa.
 */
const portaDoProvedor: AdaptadorCobrancaBancaria = {
  emitir: async (pedido: PedidoDeEmissao): Promise<DesfechoDaOperacao<BoletoEmitido>> => {
    titulosAtribuidos += 1;

    return {
      aceito: true,
      valor: {
        numeroDoTituloNoProvedor: `1700000000${String(titulosAtribuidos).padStart(3, '0')}`,
        linhaDigitavel: `75691.11223 34455.667788 99001.1223${String(titulosAtribuidos).padStart(2, '0')} 5 99230000012345`,
        codigoDeBarras: `756919923000001234511122334455667788990011${String(titulosAtribuidos).padStart(2, '0')}`,
        documento: Buffer.from(`%PDF-1.4 documento de ${pedido.identificadorNoProvedor}`),
      },
    };
  },

  solicitarRevogacaoDeBoleto: async (): Promise<DesfechoDaOperacao<void>> => ({
    aceito: true,
    valor: undefined,
  }),

  confirmarRevogacaoDeBoleto: async (): Promise<DesfechoDaOperacao<boolean>> => ({
    aceito: true,
    valor: true,
  }),

  consultarSituacao: async (): Promise<DesfechoDaOperacao<SituacaoConsultada>> => ({
    aceito: false,
    classe: 'DA_COBRANCA',
    motivo: 'consulta nao esperada por esta suite',
  }),
};

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

  // --- A aplicação INSTRUMENTADA: as sete rotas -------------------------------------------------
  const porta = await reservarPorta();
  base = `http://${ENDERECO_DE_ESCUTA}:${String(porta)}`;
  process.env.PORT = String(porta);

  // A montagem instrumentada tem casa única em `./aplicacao-instrumentada.ts` desde o fecho do
  // débito `D57 · F3/T12` — inclusive a ausência deliberada das exclusões da aplicação real, que
  // está documentada lá uma vez em vez de quatro.
  aplicacao = await montarAplicacaoInstrumentada(porta, [
    { token: TOKEN_PORTA_DE_COBRANCA_BANCARIA, valor: portaDoProvedor },
  ]);

  // --- A aplicação REAL: só o documento publicado -----------------------------------------------
  const portaReal = await reservarPorta();
  baseReal = `http://${ENDERECO_DE_ESCUTA}:${String(portaReal)}`;
  process.env.PORT = String(portaReal);

  aplicacaoReal = await criarAplicacao();
  await aplicacaoReal.listen({ port: portaReal, host: ENDERECO_DE_ESCUTA });

  cookie = await entrar(QUEM_AGE.email, SENHA_DA_CARGA);
  await conceder(QUEM_AGE.id, EMPRESA_A.id, CHAVES_DO_ARRANJO);

  // Precondição AFIRMADA, e não suposta: sem esta linha, um `403` nas rotas seria indistinguível de
  // um defeito delas — e o caso varreria sete envelopes de recusa em vez de sete corpos de sucesso.
  const sessao = (await pedir(CAMINHO_DA_SESSAO_CORRENTE, { cookie })).corpo as SessaoPublicada;

  expect(sessao.telas).toContain(AREA_DO_FINANCEIRO);
}, LIMITE_DE_MONTAGEM_MS);

afterAll(async () => {
  await aplicacaoReal?.close();
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

describe('o vocabulário do provedor na saída real das sete rotas (T17)', () => {
  it(
    'CT-934 — nenhum termo do provedor aparece nos 14 corpos reais nem nas chaves do documento, e o controle positivo os acha canal a canal',
    async () => {
      // ---------------------------------------------------------------------------------------
      // 1. O CONTROLE POSITIVO, ANTES de tudo — o varredor acha os nove, canal a canal
      // ---------------------------------------------------------------------------------------
      //
      // Ele vem primeiro de propósito: as varreduras de baixo afirmam `[]`, e `[]` é também o que um
      // varredor quebrado devolveria. Sem esta metade a prova inteira passaria por vacuidade, que é
      // o modo de falha clássico desta classe de caso — e é por isso que a `testing-stack.md` torna o
      // controle positivo **parte da asserção**, e não um extra.
      //
      // A união dos canais é afirmada contra a lista inteira ANTES de exercitá-los: sem esta linha,
      // um termo esquecido na repartição nunca seria plantado em canal algum, e o controle
      // aprovaria um varredor cego justamente para ele.
      const plantados = Object.values(CONTROLE_POR_CANAL).flat();

      expect([...plantados].sort()).toEqual([...TERMOS_DO_PROVEDOR].sort());

      // O eixo NEGATIVO do varredor, e ele roda ANTES do laço: sobre um objeto com a mesma **forma**
      // e só vocabulário do produto, a varredura devolve `[]`.
      //
      // O que ESTA linha discrimina, e as quatro igualdades abaixo não: o falso positivo disparado
      // por material que só existe quando NENHUM termo é plantado. Com `termos: []`, o campo
      // `estado` do objeto de controle é a cadeia VAZIA, e nenhum dos quatro objetos de canal tem
      // cadeia vazia entre os textos — de modo que um varredor que case o vazio devolve os nove
      // aqui e a lista exata em cada canal, satisfazendo as quatro igualdades. O defeito é
      // concreto: a varredura escrita na direção invertida (`agulha.includes(texto)`) casa `''`
      // com todos os nove termos.
      //
      // E ela vem primeiro porque a única asserção acima dela compara duas listas literais, sem
      // tocar o varredor. Depois do laço, seria inalcançável: um varredor que sobre-casa aborta já
      // no primeiro canal, esta linha nunca executaria, e a reprovação nomearia cegueira de canal
      // onde o defeito é o oposto.
      expect(termosEncontradosEm(textosDe(objetoDeControle('valor de enum', [])))).toEqual([]);

      for (const [canal, termos] of Object.entries(CONTROLE_POR_CANAL)) {
        const achados = termosEncontradosEm(textosDe(objetoDeControle(canal, termos)));

        expect(achados, `a varredura ficou cega ao canal "${canal}"`).toEqual([...termos].sort());
      }

      // ---------------------------------------------------------------------------------------
      // 2. O ARRANJO — certificado, contrato ATIVO e a cobrança, tudo pelas rotas reais
      // ---------------------------------------------------------------------------------------
      await registrarCertificadoDaEmpresa();

      const contrato = await contratoAtivo();
      const vencimento = await dataDeslocada(DIAS_ATE_O_VENCIMENTO);
      const competencia = `${vencimento.slice(0, 7)}-01`;
      const codigo = await lancar(contrato, vencimento, competencia);

      // ---------------------------------------------------------------------------------------
      // 3. AS SETE ROTAS EM SUCESSO — na ordem em que uma habilita a seguinte
      // ---------------------------------------------------------------------------------------
      //
      // A ordem é conteúdo do arranjo, e não estilo: o `GET` do boleto só tem bytes a devolver
      // depois da emissão, o histórico só tem item depois dela, e a revogação só é possível com
      // título vivo. A leitura do lote precisa do identificador que a abertura devolveu.
      const sucessos: RespostaObservada[] = [];

      sucessos.push(
        await observar('POST /v1/cobrancas/:codigo/emissao-de-boleto', {
          alvo: `${COLECAO_DE_COBRANCAS}/${codigo}/emissao-de-boleto`,
          metodo: 'POST',
          corpo: {},
        }),
      );
      sucessos.push(
        await observar('GET /v1/cobrancas/:codigo/boleto', {
          alvo: `${COLECAO_DE_COBRANCAS}/${codigo}/boleto`,
        }),
      );
      sucessos.push(
        await observar('GET /v1/cobrancas/:codigo/historico-bancario', {
          alvo: `${COLECAO_DE_COBRANCAS}/${codigo}/historico-bancario`,
        }),
      );
      sucessos.push(
        await observar('POST /v1/cobrancas/:codigo/revogacao-de-boleto', {
          alvo: `${COLECAO_DE_COBRANCAS}/${codigo}/revogacao-de-boleto`,
          metodo: 'POST',
          corpo: {},
        }),
      );

      const lote = await observar('POST /v1/cobranca-bancaria/emissoes', {
        alvo: `${COLECAO_DA_COBRANCA_BANCARIA}/${SEGMENTO_DAS_EMISSOES}`,
        metodo: 'POST',
        corpo: { competencia },
      });

      sucessos.push(lote);

      const loteId = (lote.corpo as { id: string }).id;

      sucessos.push(
        await observar('GET /v1/cobranca-bancaria/emissoes/:id', {
          alvo: `${COLECAO_DA_COBRANCA_BANCARIA}/${SEGMENTO_DAS_EMISSOES}/${loteId}`,
        }),
      );
      sucessos.push(
        await observar('POST /v1/cobranca-bancaria/conferencias', {
          alvo: `${COLECAO_DA_COBRANCA_BANCARIA}/${SEGMENTO_DAS_CONFERENCIAS}`,
          metodo: 'POST',
          corpo: {},
        }),
      );

      // ---------------------------------------------------------------------------------------
      // 4. AS SETE ROTAS EM ERRO — quatro por ausência, duas por entrada e uma por estado
      // ---------------------------------------------------------------------------------------
      //
      // Os três gatilhos são deliberadamente diferentes: o `404` da ausência, o `422` da entrada
      // recusada e o `422` de estado (a segunda abertura de lote, que publica `detalhes.loteEmCurso`
      // e é o envelope de erro mais **rico** desta superfície — o que carrega dado de domínio).
      // Sete envelopes idênticos varreriam a mesma forma sete vezes.
      const erros: RespostaObservada[] = [
        await observar('POST /v1/cobrancas/:codigo/emissao-de-boleto (404)', {
          alvo: `${COLECAO_DE_COBRANCAS}/${COBRANCA_INEXISTENTE}/emissao-de-boleto`,
          metodo: 'POST',
          corpo: {},
        }),
        await observar('POST /v1/cobrancas/:codigo/revogacao-de-boleto (404)', {
          alvo: `${COLECAO_DE_COBRANCAS}/${COBRANCA_INEXISTENTE}/revogacao-de-boleto`,
          metodo: 'POST',
          corpo: {},
        }),
        await observar('GET /v1/cobrancas/:codigo/boleto (404)', {
          alvo: `${COLECAO_DE_COBRANCAS}/${COBRANCA_INEXISTENTE}/boleto`,
        }),
        await observar('GET /v1/cobrancas/:codigo/historico-bancario (404)', {
          alvo: `${COLECAO_DE_COBRANCAS}/${COBRANCA_INEXISTENTE}/historico-bancario`,
        }),
        await observar('POST /v1/cobranca-bancaria/emissoes (422 de estado)', {
          alvo: `${COLECAO_DA_COBRANCA_BANCARIA}/${SEGMENTO_DAS_EMISSOES}`,
          metodo: 'POST',
          corpo: { competencia },
        }),
        await observar('GET /v1/cobranca-bancaria/emissoes/:id (404)', {
          alvo: `${COLECAO_DA_COBRANCA_BANCARIA}/${SEGMENTO_DAS_EMISSOES}/${LOTE_INEXISTENTE}`,
        }),
        await observar('POST /v1/cobranca-bancaria/conferencias (422 de entrada)', {
          alvo: `${COLECAO_DA_COBRANCA_BANCARIA}/${SEGMENTO_DAS_CONFERENCIAS}`,
          metodo: 'POST',
          corpo: { [CHAVE_QUE_NINGUEM_DECLAROU]: true },
        }),
      ];

      // ---------------------------------------------------------------------------------------
      // 5. AS ÂNCORAS ANTIVÁCUO — os 14 corpos foram de fato coletados, e têm conteúdo
      // ---------------------------------------------------------------------------------------
      //
      // As três medem coisas diferentes, e nenhuma implica as outras: a **contagem** pega a lista
      // truncada; a partição por **status** pega o sucesso que virou erro (que varreria um envelope
      // de recusa acreditando ser corpo de negócio) e o erro que virou sucesso; e a **não-vacuidade**
      // pega o corpo vazio, sobre o qual varrer não custa nada e não prova nada.
      const observadas = [...sucessos, ...erros];

      expect(observadas.length).toBe(CORPOS_COLETADOS);
      expect(sucessos.filter((resposta) => resposta.status >= 300).map((r) => r.rotulo)).toEqual(
        [],
      );
      expect(
        erros
          .filter((resposta) => resposta.status < 400 || resposta.status >= 500)
          .map((r) => r.rotulo),
      ).toEqual([]);
      expect(
        observadas.filter((resposta) => resposta.textos.length === 0).map((r) => r.rotulo),
        'corpo coletado sem conteúdo algum: varrer o vazio não prova nada',
      ).toEqual([]);

      // ---------------------------------------------------------------------------------------
      // 6. A VARREDURA dos 14 corpos REAIS — e a falha NOMEIA a rota e o termo
      // ---------------------------------------------------------------------------------------
      //
      // Rota a rota, e não sobre a união: uma varredura única diria *"algum corpo vazou"* sem dizer
      // qual, e é o *onde* que separa o defeito do produto do defeito do arranjo.
      for (const resposta of observadas) {
        expect(
          termosEncontradosEm(resposta.textos),
          `${resposta.rotulo} publicou vocabulário do provedor`,
        ).toEqual([]);
      }

      // ---------------------------------------------------------------------------------------
      // 7. AS CHAVES DO DOCUMENTO PUBLICADO — a superfície que o frontend vai importar
      // ---------------------------------------------------------------------------------------
      //
      // Só as **chaves**, e não a prosa: as descrições do documento falam legitimamente do provedor
      // em português (*"o que o provedor emitiu"*), e é o **nome do campo** que atravessa para o
      // tipo que o cliente gera. A âncora de não-vacuidade vem antes, pela mesma razão do item 5.
      const chaves = chavesDoDocumento(await documentoPublicado());

      expect(chaves.length).toBeGreaterThan(0);
      expect(
        termosEncontradosEm(chaves),
        'o documento publicado declara chave com vocabulário do provedor',
      ).toEqual([]);
    },
    LIMITE_CASO_MS,
  );
});

// ---------------------------------------------------------------------------------------------
// O varredor e o controle positivo
// ---------------------------------------------------------------------------------------------

/**
 * Os termos encontrados nos textos observados, **ordenados e sem repetição**.
 *
 * Devolve **lista**, e não booleano: a asserção é `toEqual([])`, e a reprovação nomeia o termo em vez
 * de dizer apenas que algo está errado. Sem repetição porque o mesmo termo pode aparecer em vários
 * pontos do mesmo corpo, e a contagem não acrescenta informação à afirmação de ausência.
 *
 * A comparação é **insensível à caixa**: `SICOOB`, `Sicoob` e `sicoob` são o mesmo vazamento, e um
 * varredor sensível à caixa seria contornado por uma linha de formatação.
 */
function termosEncontradosEm(textos: readonly string[]): string[] {
  const achados = new Set<string>();

  for (const termo of TERMOS_DO_PROVEDOR) {
    const agulha = termo.toLowerCase();

    for (const texto of textos) {
      if (texto.toLowerCase().includes(agulha)) {
        achados.add(termo);
      }
    }
  }

  return [...achados].sort();
}

/**
 * Um objeto de controle com os termos plantados **no canal informado**, e vocabulário do produto no
 * resto.
 *
 * A forma é sempre a mesma nos quatro canais — objeto com campo aninhado, lista e enum —, e só muda
 * **onde** os termos entram. É isso que faz a diferença entre os quatro resultados ser atribuível ao
 * canal, e não à forma.
 */
function objetoDeControle(canal: string, termos: readonly string[]): unknown {
  const naTopo = canal === 'chave de topo' ? Object.fromEntries(termos.map((t) => [t, 1])) : {};

  return {
    codigo: 'COB-2026-0000001',
    ...naTopo,
    detalhes: {
      ...(canal === 'campo aninhado' ? Object.fromEntries(termos.map((t) => [t, 'x'])) : {}),
      linhaDigitavel: '75691.11223 34455.667788 99001.122301 5 99230000012345',
    },
    itens: [
      'BOLETO_EMITIDO',
      ...(canal === 'item de lista' ? termos : []),
      { origem: 'ATO_DO_ADMIN' },
    ],
    estado: canal === 'valor de enum' ? termos.join('|') : 'EM_ANDAMENTO',
  };
}

/**
 * Todos os textos observáveis de um valor: **as chaves e os valores textuais**, em profundidade.
 *
 * As duas metades são canais distintos de vazamento, e nenhuma implica a outra: o nome do campo é o
 * que atravessa para o tipo que o cliente gera, e o valor é o que ele exibe. Números e nulos ficam de
 * fora porque não carregam vocabulário.
 */
function textosDe(valor: unknown): string[] {
  if (typeof valor === 'string') {
    return [valor];
  }
  if (Array.isArray(valor)) {
    return valor.flatMap((item) => textosDe(item));
  }
  if (typeof valor === 'object' && valor !== null) {
    return Object.entries(valor).flatMap(([chave, item]) => [chave, ...textosDe(item)]);
  }

  return [];
}

/** As chaves de um documento OpenAPI, em profundidade — os caminhos das rotas entre elas. */
function chavesDoDocumento(valor: unknown): string[] {
  if (Array.isArray(valor)) {
    return valor.flatMap((item) => chavesDoDocumento(item));
  }
  if (typeof valor === 'object' && valor !== null) {
    return Object.entries(valor).flatMap(([chave, item]) => [chave, ...chavesDoDocumento(item)]);
  }

  return [];
}

// ---------------------------------------------------------------------------------------------
// Observação de uma resposta real
// ---------------------------------------------------------------------------------------------

/** Uma resposta observada, com tudo o que o cliente recebeu dela. */
interface RespostaObservada {
  readonly rotulo: string;
  readonly status: number;
  readonly corpo: unknown;
  /** Chaves e valores do corpo, mais os nomes e valores dos cabeçalhos. */
  readonly textos: readonly string[];
}

interface PedidoObservado {
  readonly alvo: string;
  readonly metodo?: string;
  readonly corpo?: Record<string, unknown>;
}

/**
 * Exerce uma rota e devolve **tudo o que saiu dela**.
 *
 * O corpo entra desserializado quando é JSON e como **texto** quando são bytes — é o que permite ao
 * mesmo varredor alcançar a rota do boleto, cujo corpo não tem chaves. Os **cabeçalhos** entram
 * junto, nomes e valores: `content-disposition` carrega o nome sugerido do arquivo, e ele é saída
 * publicada tanto quanto o corpo.
 */
async function observar(rotulo: string, pedido: PedidoObservado): Promise<RespostaObservada> {
  const resposta = await pedir(pedido.alvo, {
    ...(pedido.metodo === undefined ? {} : { metodo: pedido.metodo }),
    ...(pedido.corpo === undefined ? {} : { corpo: pedido.corpo }),
    cookie,
  });

  const doCorpo = resposta.corpo === undefined ? [resposta.texto] : textosDe(resposta.corpo);

  return {
    rotulo,
    status: resposta.status,
    corpo: resposta.corpo,
    textos: [...doCorpo, ...resposta.cabecalhos].filter((texto) => texto.length > 0),
  };
}

/** O documento publicado, pedido à aplicação REAL — a única que o registra. */
async function documentoPublicado(): Promise<unknown> {
  const resposta = await pedir(`/${CAMINHO_DO_DOCUMENTO}`, { base: baseReal });

  if (resposta.status !== 200) {
    throw new Error(`o documento respondeu ${String(resposta.status)}: ${resposta.texto}`);
  }

  return resposta.corpo;
}

// ---------------------------------------------------------------------------------------------
// Acessórios de arranjo — tudo pelas rotas reais
// ---------------------------------------------------------------------------------------------

let sequencial = 0;

function proximo(): number {
  sequencial += 1;

  return sequencial;
}

/** Registra o certificado vigente da empresa **pela rota real** — a precondição de toda emissão. */
async function registrarCertificadoDaEmpresa(): Promise<void> {
  const autoridade: AutoridadeDeTeste = await gerarAutoridadeDeTeste('ct934');
  const material = await gerarMaterialDeTeste({ autoridade, senha: SENHA_DO_MATERIAL });

  const resposta = await pedir(ROTA_DO_REGISTRO_DE_CERTIFICADO, {
    metodo: 'POST',
    cookie,
    corpo: { material: material.material.toString('base64'), senha: material.senha },
  });

  if (resposta.status !== 201) {
    throw new Error(
      `o registro do certificado respondeu ${String(resposta.status)}: ${resposta.texto}`,
    );
  }
}

/** Monta conjunto, imóvel, locador, locatário e um contrato **ATIVO**, todos pelas rotas reais. */
async function contratoAtivo(): Promise<string> {
  const conjuntoId = (
    await criarPor(`/${PREFIXO_DE_VERSAO}/${CAMINHO_DOS_CONJUNTOS}`, {
      nome: `Edifício ${String(proximo())}`,
    })
  ).id;
  const imovelId = (
    await criarPor(`/${PREFIXO_DE_VERSAO}/${CAMINHO_DOS_IMOVEIS}`, corpoDeImovel(conjuntoId))
  ).id;
  const locadorId = (
    await criarPor(`/${PREFIXO_DE_VERSAO}/${CAMINHO_DOS_LOCADORES}`, corpoDePessoa())
  ).id;
  const locatarioId = (
    await criarPor(`/${PREFIXO_DE_VERSAO}/${CAMINHO_DOS_LOCATARIOS}`, corpoDePessoa())
  ).id;

  const montagem = await pedir(COLECAO_DE_CONTRATOS, {
    metodo: 'POST',
    cookie,
    corpo: {
      imovelId,
      locadorId,
      locatarioId,
      fiadoresIds: [],
      dataInicioLocacao: DATA_DE_INICIO,
      prazoMeses: PRAZO_EM_MESES,
      valorMensal: VALOR_MENSAL,
      diaVencimento: DIA_DE_VENCIMENTO,
      // Sem geração automática: o caso endereça **uma** cobrança conhecida, e doze parcelas nascidas
      // da ativação entrariam no lote da competência sem acrescentar corpo novo a varrer.
      gerarCobrancasAutomaticamente: false,
    },
  });

  if (montagem.status !== 201) {
    throw new Error(
      `a montagem do contrato respondeu ${String(montagem.status)}: ${montagem.texto}`,
    );
  }

  const codigo = (montagem.corpo as { codigo: string }).codigo;
  const ativacao = await pedir(`${COLECAO_DE_CONTRATOS}/${codigo}/ativacao`, {
    metodo: 'POST',
    cookie,
    corpo: {},
  });

  if (ativacao.status !== 200) {
    throw new Error(
      `a ativação de ${codigo} respondeu ${String(ativacao.status)}: ${ativacao.texto}`,
    );
  }

  return codigo;
}

/** Lança a cobrança do cenário pela rota real. */
async function lancar(
  contratoCodigo: string,
  vencimento: string,
  competencia: string,
): Promise<string> {
  const resposta = await pedir(COLECAO_DE_COBRANCAS, {
    metodo: 'POST',
    cookie,
    corpo: {
      contratoCodigo,
      natureza: 'ALUGUEL',
      referencia: REFERENCIA_DA_COBRANCA,
      competencia,
      dataVencimento: vencimento,
      valorOriginal: VALOR_DA_COBRANCA,
    },
  });

  if (resposta.status !== 201) {
    throw new Error(`o lançamento respondeu ${String(resposta.status)}: ${resposta.texto}`);
  }

  return (resposta.corpo as { codigo: string }).codigo;
}

/** Cria um recurso pela rota informada e devolve o identificador dele. A falha levanta. */
async function criarPor(
  colecao: string,
  corpo: Record<string, unknown>,
): Promise<{ readonly id: string }> {
  const resposta = await pedir(colecao, { metodo: 'POST', cookie, corpo });

  if (resposta.status !== 201) {
    throw new Error(
      `a criação em ${colecao} respondeu ${String(resposta.status)}: ${resposta.texto}`,
    );
  }

  return resposta.corpo as { readonly id: string };
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

/**
 * A data corrente da operação deslocada em `dias`, como cadeia `YYYY-MM-DD`.
 *
 * A leitura sai do **mesmo** `negocio.data_corrente_da_operacao()` que a visão consulta — nunca de
 * `new Date()` do processo, que é o segundo eixo de dia que a ADR-0026 fecha.
 */
async function dataDeslocada(dias: number): Promise<string> {
  return await contextoDeTenant.executarCom(
    { empresaId: EMPRESA_A.id },
    async () =>
      await acessoAoNegocio.emUnidadeDeTrabalho(async (tx) => {
        const [linha] = await tx<{ data: string }[]>`
          SELECT to_char(
                   negocio.data_corrente_da_operacao() + make_interval(days => ${dias}),
                   'YYYY-MM-DD'
                 ) AS data
        `;

        if (linha === undefined) {
          throw new Error('o relógio do banco não devolveu a data corrente da operação');
        }

        return linha.data;
      }),
  );
}

/**
 * Concede as chaves informadas a uma pessoa, pelo caminho real da camada de dados.
 *
 * Sob o contexto de tenant **da empresa dela** e dentro da unidade de trabalho, com a coerência
 * ação→tela validada pela função de domínio — é o mesmo caminho que a rota do Admin usa por dentro.
 */
async function conceder(
  usuarioId: string,
  empresaId: string,
  chaves: readonly ChaveDoCatalogo[],
): Promise<void> {
  await contextoDeTenant.executarCom({ empresaId }, async () => {
    await acessoAoNegocio.emUnidadeDeTrabalho(async (tx) => {
      await escreverAjustes(tx, {
        usuarioId,
        ajustes: chaves.map((chave) => ({ chave, efeito: 'CONCEDIDA' as const })),
        validarCoerencia: validarCoerenciaDeAjustes,
      });
    });
  });
}

/** O recorte da sessão publicada que este arquivo observa. */
interface SessaoPublicada {
  readonly telas: readonly string[];
}

// ---------------------------------------------------------------------------------------------
// Cliente HTTP
// ---------------------------------------------------------------------------------------------

interface Resposta {
  readonly status: number;
  readonly texto: string;
  readonly corpo: unknown;
  readonly cookies: readonly string[];
  /** Nomes **e** valores dos cabeçalhos, na forma `nome: valor` — eles são saída publicada. */
  readonly cabecalhos: readonly string[];
}

interface OpcoesDoPedido {
  readonly metodo?: string;
  readonly corpo?: Record<string, unknown>;
  readonly cookie?: string;
  /** Contra qual das duas aplicações a requisição corre — a instrumentada, por omissão. */
  readonly base?: string;
}

/**
 * Executa uma requisição HTTP real contra a aplicação.
 *
 * O cabeçalho `Origin` acompanha toda requisição com a MESMA origem do endereço alvo — é o que um
 * navegador enviaria, e é o que o arcabouço confere nas requisições que carregam cookie.
 */
async function pedir(alvo: string, opcoes: OpcoesDoPedido = {}): Promise<Resposta> {
  const endereco = opcoes.base ?? base;
  const cabecalhos: Record<string, string> = { connection: 'close', origin: endereco };

  if (opcoes.corpo !== undefined) {
    cabecalhos['content-type'] = 'application/json';
  }
  if (opcoes.cookie !== undefined) {
    cabecalhos.cookie = opcoes.cookie;
  }

  const resposta = await fetch(new URL(alvo, endereco), {
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
    cabecalhos: [...resposta.headers.entries()].map(([nome, valor]) => `${nome}: ${valor}`).sort(),
  };
}

/** Entra pelo caminho REAL — a rota pública de entrada. Nenhum estado de sessão é forjado. */
async function entrar(email: string, senha: string): Promise<string> {
  const entrada = await pedir(ROTA_DE_ENTRADA, {
    metodo: 'POST',
    corpo: { email, password: senha },
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
