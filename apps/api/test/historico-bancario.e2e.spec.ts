/**
 * O **histórico bancário** de uma cobrança — `GET /v1/cobrancas/:codigo/historico-bancario`
 * (T14 da fatia `emissao-e-conciliacao`).
 *
 * ---------------------------------------------------------------------------
 * INVARIANTES
 * ---------------------------------------------------------------------------
 *
 * | Critério | Caso | Invariante |
 * |---|---|---|
 * | CA-13 | CT-925 | A rota devolve os eventos daquela cobrança **na ordem em que ocorreram**, do
 * |       |        | mais antigo para o mais recente. A lista de `tipo` é **exatamente**
 * |       |        | `['BOLETO_EMITIDO','BOLETO_REVOGADO','BOLETO_EMITIDO','COBRANCA_LIQUIDADA']`,
 * |       |        | por igualdade de lista **ordenada**; a de `origem` é exatamente
 * |       |        | `['ATO_DO_ADMIN','CONFERENCIA','ATO_DO_ADMIN','CONFERENCIA']`; a sequência de
 * |       |        | `ocorridoEm` é **não-decrescente**; e o `diagnostico` do item de revogação é o
 * |       |        | texto que o provedor informou, **byte a byte**, com os outros três `null`. Cada
 * |       |        | item publica **exatamente** as cinco chaves do contrato. |
 * | CA-13 | CT-925 | Cobrança que a política não alcança — aqui, um código bem formado que não existe
 * |       | (b)    | em empresa alguma — responde `404` com o envelope canônico asserido como
 * |       |        | **objeto inteiro**, e **não** lista vazia: são fatos diferentes, e a lista vazia
 * |       |        | é a resposta legítima da cobrança que existe e ainda não teve efeito bancário. |
 * | CA-13 | CT-983 | O histórico **distingue a origem** de cada efeito: a cobrança acumula três
 * |       |        | itens, e a lista ordenada de `(tipo, origem)` é **exatamente**
 * |       |        | `[(BOLETO_EMITIDO, ATO_DO_ADMIN), (COBRANCA_LIQUIDADA, NOTICIA_DO_PROVEDOR),
 * |       |        | (BOLETO_REVOGADO, CONFERENCIA)]`. A liquidação nasce da **tarefa real** que
 * |       |        | trata a notícia recebida do provedor; a revogação, do percurso real da
 * |       |        | conferência de rotina — que **é o controle**: sem ela, um produto que
 * |       |        | carimbasse tudo como notícia passaria. |
 *
 * Rastreabilidade: `CA-13 → CT-925, CT-925 (b), CT-983 (RN-05)`.
 *
 * ⚠️ **O companheiro negativo por EMPRESA é o `CT-926`, da T17**, em
 * `apps/api/test/recusa-indistinguivel.e2e.spec.ts`: lá a sessão da empresa B pede o histórico com o
 * código real de uma cobrança da empresa A e recebe resposta **byte a byte idêntica** à de um código
 * inexistente. O `CT-925 (b)` daqui é a outra metade daquela indistinguibilidade — o lado do código
 * que não existe —, e as duas juntas é que fazem a afirmação inteira.
 *
 * ===========================================================================
 * A ORDEM É O CONTEÚDO DA CA-13, e é ela que este arquivo existe para provar
 * ===========================================================================
 *
 * A porta de dados (`lerTrilhaDaCobranca`) lê `ocorrido_em DESC, id DESC` — a ordem de **exibição**
 * declarada no cabeçalho da tabela, e a do índice que serve o acesso, com a medição do plano
 * registrada no docblock dela. A **rota** publica o contrário, porque a CA-13 pede *"na ordem em que
 * aconteceram"*.
 *
 * ⚠️ **É por isso que a sequência de efeitos deste caso NÃO é palíndroma**, e a escolha é deliberada:
 * `[EMITIDO, REVOGADO, EMITIDO, LIQUIDADA]` lida de trás para frente é
 * `[LIQUIDADA, EMITIDO, REVOGADO, EMITIDO]`, de modo que uma rota que publicasse a ordem da porta
 * reprova na primeira igualdade. Uma sequência simétrica — duas emissões e nada mais — passaria nos
 * dois sentidos e mediria só que a lista tem quatro itens.
 *
 * ===========================================================================
 * OS QUATRO EFEITOS NASCEM DOS CAMINHOS REAIS — nunca de `INSERT` no arranjo
 * ===========================================================================
 *
 * As duas emissões saem da **rota** de emissão de boleto; a revogação e a liquidação saem do percurso
 * **real** da conferência (`conferirCobrancas`, de `@sysloc/cobranca-bancaria`), com as portas
 * satisfeitas pelas mesmas funções de `@sysloc/db` que a borda da tarefa satisfará. Escrever as
 * linhas direto em `negocio.evento_bancario` provaria a **consulta** e não o **produtor**: uma trilha
 * que o produto nunca gravasse passaria igual, e a asserção sobre `origem` e sobre o `diagnostico`
 * deixaria de dizer alguma coisa sobre quem os grava.
 *
 * A revogação vem da **conferência**, e não da rota de revogação, por uma razão que é conteúdo do
 * caso: só ela grava `diagnostico` — o motivo que o provedor informou —, e a CA-13 exige *"data e
 * desfecho de cada um"*. A rota de revogação é ato do Admin, e não tem motivo de terceiro a registrar.
 *
 * ===========================================================================
 * TODA DATA sai do relógio do BANCO (ADR-0026)
 * ===========================================================================
 *
 * Nenhuma data deste arquivo nasce de `new Date()` do processo: o vencimento, a competência e o dia do
 * pagamento informado saem de {@link dataDeslocada}, que lê o **mesmo**
 * `negocio.data_corrente_da_operacao()` que a visão `cobranca_derivada` consulta. E os instantes da
 * trilha **não são comparados com relógio nenhum**: o que se afirma sobre eles é a **monotonia** —
 * propriedade da sequência, e não de um valor absoluto.
 *
 * ===========================================================================
 * O ADAPTADOR VEM PELA COMPOSIÇÃO, e a produção não ganhou ramo de teste
 * ===========================================================================
 *
 * A aplicação é montada pelo **`AppModule` real**, e o que a suíte substitui é o **provedor inteiro**
 * da porta de cobrança, por `overrideProvider(TOKEN_PORTA_DE_COBRANCA_BANCARIA)` — o mecanismo do
 * arcabouço de teste, não um caminho aberto no código de produção. É a mesma forma, e a mesma razão,
 * de `boleto-da-cobranca.e2e.spec.ts` e de `certificado-do-provedor.e2e.spec.ts`.
 *
 * ===========================================================================
 * O CT-983 ATRAVESSA A FILA REAL, e a origem `NOTICIA_DO_PROVEDOR` não é escrita à mão
 * ===========================================================================
 *
 * O item de trilha que ele afirma nasce do caminho inteiro: `POST /v1/notificacoes-bancarias` grava o
 * cru e enfileira na instância **efêmera** que esta suíte já sobe, e o consumidor registrado no
 * `beforeAll` — a **mesma** fiação de `apps/worker/src/main.ts` — executa a tarefa real, que roteia,
 * confere, consulta a porta e grava o efeito. Escrever a linha direto em `negocio.evento_bancario`
 * provaria a **consulta** e não o **produtor**, que é a razão já registrada acima para os quatro
 * efeitos do `CT-925`.
 *
 * ⚠️ **A porta que o consumidor recebe é OUTRA**, e não {@link portaDoProvedor}: aquela recusa a
 * consulta de propósito, e a decisão dela é preservada. A da tarefa vive junto do caso, responde
 * `LIQUIDADO` e chega à borda **por parâmetro**, como a composição raiz do processo de trabalho a
 * entrega (ADR-0025).
 */

import { randomBytes } from 'node:crypto';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import { type ChaveDoCatalogo, validarCoerenciaDeAjustes } from '@sysloc/auth';
import type {
  AdaptadorCobrancaBancaria,
  BoletoEmitido,
  ConsultaDeSituacao,
  DesfechoDaOperacao,
  PedidoDeEmissao,
  SituacaoConsultada,
} from '@sysloc/cobranca-bancaria';
import { conferirCobrancas, criarGuardaDeBoletos } from '@sysloc/cobranca-bancaria';
import {
  type AcessoAoBanco,
  abrirAcessoAoBanco,
  abrirConferencia,
  type CobrancaAConferir,
  concluirConferencia,
  contextoDeTenant,
  EMPRESA_A,
  escreverAjustes,
  liquidarPeloProvedor,
  localizarCobranca,
  type NotificacaoBancariaPersistida,
  registrarEventoBancario,
  revogarBoleto,
  SENHA_DA_CARGA,
  selecionarCobrancasAConferir,
} from '@sysloc/db';
import { criarLogger, criarSegredoOperavel } from '@sysloc/shared';
import type { TransactionSql } from 'postgres';
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
import { reservarPorta, sondarAte } from '../../../packages/shared/test/efemero-comum.ts';
import { type FilaEfemera, redisEfemero } from '../../../packages/shared/test/redis-efemero.ts';
// A fiação do `worker` é alcançada pelo caminho do fonte, e não por especificador de pacote: ele é
// aplicação privada, sem `exports`. A razão de estar aqui é o que o cabeçalho declara — a `origem`
// que o `CT-983` afirma só nasce do produtor real, e o produtor real é a tarefa do processo de
// trabalho. Nada de `apps/api/src` importa daqui: a aresta existe só na verificação, e só nesta
// direção. É a mesma aresta, e a mesma razão, de `./confirmacao-de-email.e2e.spec.ts`:
// ÍNDICE: docs/specs/features/documentos-e-confirmacao/v1/_run/run-report.md §2, D13
import { conectarFila, type Fila } from '../../worker/src/fila.ts';
import { processarNotificacaoBancaria } from '../../worker/src/tarefas/notificacao-bancaria.ts';
import { AppModule } from '../src/app.module.ts';
import { PREFIXO_DAS_ROTAS_DE_IDENTIDADE } from '../src/autenticacao/autenticacao.module.ts';
import { CAMINHO_DA_SESSAO } from '../src/autenticacao/sessao.controller.ts';
import { CAMINHO_DOS_LOCADORES } from '../src/cadastros/locador.controller.ts';
import { CAMINHO_DOS_LOCATARIOS } from '../src/cadastros/locatario.controller.ts';
import { CAMINHO_DAS_COBRANCAS } from '../src/cobrancas/cobranca.controller.ts';
import {
  type Ambiente,
  ENDERECO_DE_ESCUTA,
  PREFIXO_DE_VERSAO,
  TOKEN_AMBIENTE,
  TOKEN_PORTA_DE_COBRANCA_BANCARIA,
} from '../src/configuracao/ambiente.ts';
import { CAMINHO_DOS_CONTRATOS } from '../src/contratos/contrato.controller.ts';
import { CAMINHO_DOS_CONJUNTOS } from '../src/imoveis/conjunto.controller.ts';
import { CAMINHO_DOS_IMOVEIS } from '../src/imoveis/imovel.controller.ts';
import {
  CAMINHO_DAS_INTEGRACOES_BANCARIAS,
  SEGMENTO_DO_REGISTRO,
} from '../src/integracoes-bancarias/certificado.controller.ts';
import { SEGMENTO_DA_IDENTIDADE } from '../src/integracoes-bancarias/identidade.controller.ts';
import { CAMINHO_DAS_NOTIFICACOES_BANCARIAS } from '../src/notificacoes-bancarias/notificacao-bancaria.controller.ts';
import { cpfValido } from './documento.ts';

/** Limite da montagem: banco migrado, semente com credencial, fila e a aplicação instrumentada. */
/**
 * A identidade da empresa perante o provedor, exigida pelos atos desde 2026-08-20
 * (`D36 · F4/T10`). Valores fixos: o que os casos afirmam é o efeito do ato, e um valor
 * sorteado aqui não tornaria a asserção mais forte.
 */
const IDENTIDADE_DO_ARRANJO = Object.freeze({
  identificadorDaAplicacao: 'identificador-do-arranjo',
  numeroDoCliente: 33065,
  numeroDaContaCorrente: 380261,
  codigoDaModalidade: 1,
});

const LIMITE_DE_MONTAGEM_MS = 240_000;

/** Limite de cada caso: o cenário encadeia quatro efeitos pelos caminhos reais. */
const LIMITE_CASO_MS = 180_000;

/** Sufixo do cookie de sessão que o arcabouço de identidade emite. */
const SUFIXO_DO_COOKIE_DE_SESSAO = 'session_token';

/** A rota de entrada — pública, e o único caminho por onde a sessão nasce. */
const ROTA_DE_ENTRADA = `${PREFIXO_DAS_ROTAS_DE_IDENTIDADE}/sign-in/email`;

/** A sessão corrente, de onde a precondição de permissão é AFIRMADA em vez de suposta. */
const CAMINHO_DA_SESSAO_CORRENTE = `/${PREFIXO_DE_VERSAO}/${CAMINHO_DA_SESSAO}`;

/** As coleções que o arranjo e os casos exercitam, compostas dos donos dos segmentos. */
const COLECAO_DE_COBRANCAS = `/${PREFIXO_DE_VERSAO}/${CAMINHO_DAS_COBRANCAS}`;
const COLECAO_DE_CONTRATOS = `/${PREFIXO_DE_VERSAO}/${CAMINHO_DOS_CONTRATOS}`;
const ROTA_DO_REGISTRO_DE_CERTIFICADO = `/${PREFIXO_DE_VERSAO}/${CAMINHO_DAS_INTEGRACOES_BANCARIAS}/${SEGMENTO_DO_REGISTRO}`;

/** A rota da identidade, composta pelo dono do segmento — nunca literal. */
const ROTA_DO_REGISTRO_DA_IDENTIDADE = `/${PREFIXO_DE_VERSAO}/${CAMINHO_DAS_INTEGRACOES_BANCARIAS}/${SEGMENTO_DA_IDENTIDADE}`;

/**
 * O arranjo concedido à sessão que age — literal, e **não** derivado da exigência do controlador.
 *
 * Derivá-lo faria a asserção concordar com o SUT, e trocar a exigência da classe deixaria de reprovar
 * caso algum. As cinco primeiras estão aqui por obrigação do cenário — sem contrato ativo não há
 * sobre o que lançar, e sem certificado não há emissão —, e `TELA:financeiro` é o eixo desta rota.
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

/** A chave afirmada no efetivo da sessão — nunca suposta. É a que esta rota exige. */
const AREA_DO_FINANCEIRO: ChaveDoCatalogo = 'TELA:financeiro';

/**
 * As **cinco** chaves que um evento bancário publica, em ordem alfabética.
 *
 * Escritas por extenso, e **não** derivadas de `esquemaDoEventoBancario` nem do corpo observado: é a
 * igualdade contra esta lista que transforma *"nada interno vaza para a saída"* numa afirmação que
 * pega **qualquer** grafia — `id`, `cobrancaId`, `empresaId` —, e não só um nome que o caso tivesse
 * adivinhado. Derivá-la do tipo do SUT faria a asserção concordar consigo mesma.
 */
const CHAVES_DO_EVENTO: readonly string[] = [
  'diagnostico',
  'ocorridoEm',
  'origem',
  'tipo',
  'valorInformado',
];

/**
 * A sequência de **efeitos** que o cenário produz, e a de **origens** que cada um carrega.
 *
 * Escritas à mão, e nesta ordem: elas são o esperado das duas igualdades de lista ordenada do
 * `CT-925`. ⚠️ Nenhuma das duas é palíndroma, e é isso que faz a inversão da ordem reprovar — ver o
 * cabeçalho deste arquivo.
 */
const EFEITOS_ESPERADOS: readonly string[] = [
  'BOLETO_EMITIDO',
  'BOLETO_REVOGADO',
  'BOLETO_EMITIDO',
  'COBRANCA_LIQUIDADA',
];
const ORIGENS_ESPERADAS: readonly string[] = [
  'ATO_DO_ADMIN',
  'CONFERENCIA',
  'ATO_DO_ADMIN',
  'CONFERENCIA',
];

/** Os termos do contrato do cenário — valores quaisquer, dentro das condições de entrada. */
const DATA_DE_INICIO = '2026-01-15';
const PRAZO_EM_MESES = 12;
const VALOR_MENSAL = 2500;
const DIA_DE_VENCIMENTO = 10;

/** O valor da cobrança do cenário, e quantos dias à frente ela vence. */
const VALOR_DA_COBRANCA = 1500;
const DIAS_ATE_O_VENCIMENTO = 30;

/** A referência da cobrança — texto livre do operador, e nada o interpreta. */
const REFERENCIA_DA_COBRANCA = 'Competência do período — parcela';

/** O valor que o provedor informa ter recebido — igual ao devido, sem divergência a registrar. */
const VALOR_INFORMADO_PELO_PROVEDOR = VALOR_DA_COBRANCA;

/** A senha do cofre PKCS#12 do arranjo — sentinela, e nunca comparada com nada do produto. */
const SENHA_DO_MATERIAL = 'senha-do-material-do-ct925';

/**
 * O texto com que o provedor informa a revogação — **opaco**, e nada o lê para decidir (RN-15).
 *
 * Ele é o oráculo do `diagnostico` publicado: o caso afirma que a coluna o preserva **byte a byte**
 * desde a resposta do provedor até o corpo da rota, atravessando o percurso da conferência.
 */
const MOTIVO_DA_REVOGACAO_NO_PROVEDOR = 'titulo baixado por solicitacao do beneficiario';

/**
 * Os códigos e as mensagens que o corpo de erro publica — **literais**, nunca lidos do SUT.
 *
 * Derivá-los de `MENSAGEM_POR_CODIGO` faria a asserção concordar consigo mesma: um erro de texto na
 * tabela passaria despercebido nos dois lados.
 */
const CODIGO_DE_RECURSO_NAO_ENCONTRADO = 'RECURSO_NAO_ENCONTRADO';
const MENSAGEM_DE_NAO_ENCONTRADO = 'recurso não encontrado';

/**
 * Um código de cobrança **bem formado** que não existe em empresa alguma.
 *
 * O ano é 2099 de propósito: ele passa pela validação de forma da borda — e é isso que se quer,
 * porque um código malformado seria recusado com `422` antes de qualquer consulta, e mediria a
 * validação em vez da recusa por ausência. O sequencial segue a largura publicada: **sete** dígitos.
 */
const COBRANCA_INEXISTENTE = 'COB-2099-0000001';

/** A pessoa que age: `USUARIO_EMPRESA` da empresa A, **da carga**. */
const QUEM_AGE = pessoaSemeada('usuario.a@exemplo.com.br');

/**
 * O consumidor da notícia bancária — a **mesma** fiação de `apps/worker/src/main.ts`.
 *
 * Ele é registrado uma vez, no `beforeAll`, sobre a instância efêmera que esta suíte já sobe: é o
 * `POST` da rota pública que enfileira, e é ele que trata. Ver o cabeçalho.
 */
let filaDoWorker: Fila;

/** A rota **sem sessão** por onde o provedor avisa. Composta, nunca escrita à mão. */
const ROTA_DA_NOTICIA = `/${PREFIXO_DE_VERSAO}/${CAMINHO_DAS_NOTIFICACOES_BANCARIAS}`;

/**
 * Os três pares `(tipo, origem)` que o `CT-983` afirma, **na ordem em que ocorreram**.
 *
 * Escritos à mão, e não derivados do corpo observado. ⚠️ **A sequência não é palíndroma**, pela mesma
 * razão registrada no cabeçalho para o `CT-925`: uma rota que publicasse a ordem da porta de dados
 * reprova aqui. E o item de `CONFERENCIA` **é o controle** — sem ele, um produto que carimbasse tudo
 * como notícia passaria.
 */
const TRILHA_ESPERADA_DO_CT983: readonly { tipo: string; origem: string }[] = [
  { tipo: 'BOLETO_EMITIDO', origem: 'ATO_DO_ADMIN' },
  { tipo: 'COBRANCA_LIQUIDADA', origem: 'NOTICIA_DO_PROVEDOR' },
  { tipo: 'BOLETO_REVOGADO', origem: 'CONFERENCIA' },
];

/** Limite para a tarefa da notícia alcançar desfecho, folgado sobre a repetição da fila. */
const LIMITE_DO_DESFECHO_MS = 90_000;

let identidade: IdentidadeEfemera;
let fila: FilaEfemera;
let acessoAoNegocio: AcessoAoBanco;
let aplicacao: NestFastifyApplication;
let base: string;
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

// ---------------------------------------------------------------------------------------------
// O provedor instrumentado — implementação da PORTA, nunca um dublê de biblioteca
// ---------------------------------------------------------------------------------------------

/** Quantos títulos o "provedor" já atribuiu — a sequência DELE, e não a do produto. */
let titulosAtribuidos = 0;

/** Os boletos que o par atribuiu, na ordem — a sequência do outro lado da porta. */
const emitidos: BoletoEmitido[] = [];

/**
 * A porta de cobrança do arranjo — implementação anotada com o tipo, e não `vi.mock`.
 *
 * Ela entra por `overrideProvider(TOKEN_PORTA_DE_COBRANCA_BANCARIA)`, pelo mecanismo do arcabouço de
 * teste, e **não** por caminho aberto no código de produção. A consulta de situação recusa: o
 * percurso da conferência que este arquivo roda traz um par **próprio** para ela, e uma consulta que
 * chegasse a esta implementação significaria que a rota do boleto foi exercitada por engano.
 */
const portaDoProvedor: AdaptadorCobrancaBancaria = {
  emitir: async (pedido: PedidoDeEmissao): Promise<DesfechoDaOperacao<BoletoEmitido>> => {
    titulosAtribuidos += 1;

    const emitido: BoletoEmitido = {
      numeroDoTituloNoProvedor: `1700000000${String(titulosAtribuidos).padStart(3, '0')}`,
      linhaDigitavel: `75691.11223 34455.667788 99001.1223${String(titulosAtribuidos).padStart(2, '0')} 5 99230000012345`,
      codigoDeBarras: `756919923000001234511122334455667788990011${String(titulosAtribuidos).padStart(2, '0')}`,
      documento: Buffer.from(`%PDF-1.4 boleto ${pedido.identificadorNoProvedor}`),
    };

    emitidos.push(emitido);

    return { aceito: true, valor: emitido };
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

/**
 * O segredo que atravessa a porta da conferência, opaco (ADR-0032).
 *
 * Construído pelo caminho público de `@sysloc/shared`, e nada neste arquivo o abre. Ele é o segredo
 * da **chamada de conferência que o caso faz**, e não o da rota: aquele o produto decifra sozinho, a
 * partir do certificado que o arranjo registrou.
 */
const SEGREDO_DA_CONFERENCIA = criarSegredoOperavel({
  material: Buffer.from('material-da-conferencia-do-ct925'),
  senha: 'senha-da-conferencia',
});

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
    .overrideProvider(TOKEN_PORTA_DE_COBRANCA_BANCARIA)
    .useValue(portaDoProvedor)
    .compile();

  aplicacao = modulo.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
  // Sem as exclusões da aplicação real, de propósito: nenhum caso deste arquivo toca as rotas de
  // saúde nem o contrato publicado, e reproduzir a lista aqui criaria uma segunda cópia dela livre
  // para divergir.
  aplicacao.setGlobalPrefix(PREFIXO_DE_VERSAO);
  await aplicacao.listen({ port: porta, host: ENDERECO_DE_ESCUTA });

  // O consumidor da notícia, com a porta PRÓPRIA dele — ver o cabeçalho para por que ela não é
  // `portaDoProvedor`, cuja recusa da consulta é decisão preservada.
  filaDoWorker = conectarFila(
    fila.cadeiaConexao,
    criarLogger({
      nivel: 'fatal',
      destino: {
        write(): void {
          // O registro do processo consumidor é descartado: o que este caso afirma é o EFEITO — o
          // que ficou na trilha e o que a rota publica —, e não a linha do journal. Quem observa
          // registro é `apps/worker/test/notificacao-bancaria.spec.ts`.
        },
      },
    }),
  );
  filaDoWorker.processar(
    filaDoWorker.notificacaoBancaria,
    async (tarefa, logger) =>
      await processarNotificacaoBancaria(tarefa, logger, {
        banco: acessoAoNegocio,
        adaptador: { ...portaDoProvedor, consultarSituacao: consultaQueLiquida },
        guarda: criarGuardaDeBoletos(diretorioDosBoletos()),
        chaveDeCifra: aplicacao.get<Ambiente>(TOKEN_AMBIENTE).chaveDeCifraDoCertificado,
      }),
  );

  cookie = await entrar(QUEM_AGE.email, SENHA_DA_CARGA);
  await conceder(QUEM_AGE.id, EMPRESA_A.id, CHAVES_DO_ARRANJO);

  // Precondição AFIRMADA, e não suposta: sem esta linha, um `403` na rota seria indistinguível de um
  // defeito dela — e é justamente a **área** que ela exige.
  const sessao = (await pedir(CAMINHO_DA_SESSAO_CORRENTE, { cookie })).corpo as SessaoPublicada;

  expect(sessao.telas).toContain(AREA_DO_FINANCEIRO);
}, LIMITE_DE_MONTAGEM_MS);

afterAll(async () => {
  await aplicacao?.close();
  await filaDoWorker?.encerrar();
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

describe('o histórico bancário de uma cobrança (T14)', () => {
  it(
    'CT-925 — o histórico publica os eventos na ordem em que ocorreram, com data e desfecho',
    async () => {
      await registrarCertificadoDaEmpresa('ct925');

      const contrato = await contratoAtivo();
      const codigo = (await lancar(contrato)).codigo;

      // ---------------------------------------------------------------------------------------
      // Os QUATRO efeitos, em ordem, pelos caminhos REAIS
      // ---------------------------------------------------------------------------------------
      //
      // Cada passo é afirmado ao acontecer: sem isso, um passo que falhasse em silêncio produziria
      // uma trilha mais curta, e a igualdade de lista lá embaixo acusaria "a ordem está errada"
      // quando o defeito é outro — o caso nomearia o problema errado.
      await emitir(codigo);
      await conferirComProvedorQueRevoga(codigo);
      await emitir(codigo);
      await conferirComProvedorQueLiquida(codigo, await dataDeslocada(0));

      const resposta = await pedir(rotaDoHistorico(codigo), { cookie });

      expect(resposta.status).toBe(200);

      // A forma do ENVELOPE — que ele declara `itens` e só ele — é ancorada no pacote, onde a
      // declaração dela é única: `CT-953`, em `packages/contracts/test/esquemas.spec.ts`. **Não
      // acrescente aqui uma segunda igualdade sobre `Object.keys(resposta.corpo)`**: seriam duas
      // listas da mesma forma, livres para divergir, que é o defeito que trouxe o envelope para o
      // pacote. O que este caso ancora é o **conteúdo** — a ordem, a origem, o desfecho e as cinco
      // chaves de cada item.
      const itens = (resposta.corpo as { readonly itens: readonly EventoPublicado[] }).itens;

      // ---------------------------------------------------------------------------------------
      // A ORDEM, por igualdade de LISTA ORDENADA — nunca por contenção
      // ---------------------------------------------------------------------------------------
      //
      // É a asserção central da CA-13, e a que discrimina: a sequência **não é palíndroma**, de modo
      // que uma rota que publicasse a ordem em que a porta de dados lê (`ocorrido_em DESC`) devolveria
      // `[LIQUIDADA, EMITIDO, REVOGADO, EMITIDO]` e reprovaria aqui. Um `toContain` aprovaria uma
      // trilha embaralhada, e uma comparação de conjuntos aprovaria a ordem invertida.
      expect(itens.map((evento) => evento.tipo)).toEqual([...EFEITOS_ESPERADOS]);

      // A ORIGEM de cada um, na mesma ordem e por igualdade de lista: ela é eixo **independente** do
      // tipo — as duas emissões são ato do Admin e os dois efeitos do percurso são da conferência —,
      // e sem ela uma trilha que registrasse tudo como vindo do mesmo lugar passaria acima.
      expect(itens.map((evento) => evento.origem)).toEqual([...ORIGENS_ESPERADAS]);

      // ---------------------------------------------------------------------------------------
      // `ocorridoEm` é NÃO-DECRESCENTE — propriedade da SEQUÊNCIA, jamais de um instante absoluto
      // ---------------------------------------------------------------------------------------
      //
      // Nenhuma data deste caso é comparada com relógio algum: o carimbo é do banco (`DEFAULT now()`),
      // e confrontá-lo com o relógio do processo seria o segundo eixo de tempo que a ADR-0026 fecha.
      // O `>=`, e não o `>`, é conteúdo: `now()` é o instante do **início da transação**, de modo que
      // dois efeitos gravados na mesma unidade de trabalho carregam carimbos idênticos — exigir
      // estritamente crescente reprovaria uma trilha correta.
      const instantes = itens.map((evento) => Date.parse(evento.ocorridoEm));

      // A âncora de não-vacuidade: sem ela, uma data que não fosse ISO-8601 viraria `NaN`, e toda
      // comparação abaixo seria falsa em silêncio — `NaN >= NaN` não reprova, ele passa despercebido
      // em um `every`.
      expect(instantes.filter((instante) => !Number.isFinite(instante))).toEqual([]);

      for (let posicao = 1; posicao < instantes.length; posicao += 1) {
        expect(
          instantes[posicao],
          `o evento ${String(posicao)} ocorreu ANTES do anterior: a trilha não está em ordem`,
        ).toBeGreaterThanOrEqual(instantes[posicao - 1] ?? Number.NaN);
      }

      // ---------------------------------------------------------------------------------------
      // O DESFECHO de cada um: o `diagnostico` do provedor, byte a byte, e `null` nos demais
      // ---------------------------------------------------------------------------------------
      //
      // O oráculo é o texto que o **par** informou, e não uma releitura do corpo: é ele que atravessa
      // o percurso da conferência, a coluna e a serialização (RN-15). Os três `null` entram na mesma
      // igualdade porque são o que separa *"preservou o motivo"* de *"carimbou o mesmo motivo em
      // tudo"*.
      expect(itens.map((evento) => evento.diagnostico)).toEqual([
        null,
        MOTIVO_DA_REVOGACAO_NO_PROVEDOR,
        null,
        null,
      ]);

      // ---------------------------------------------------------------------------------------
      // E cada item publica EXATAMENTE as cinco chaves do contrato
      // ---------------------------------------------------------------------------------------
      //
      // Igualdade de conjunto contra a lista escrita à mão: é ela que impede o UUID interno do evento,
      // o `cobranca_id` e o `empresa_id` de vazarem para a saída — e a ausência de `id` é decisão
      // registrada no esquema, porque nada aponta para um evento isolado.
      for (const [posicao, evento] of itens.entries()) {
        expect(Object.keys(evento).sort(), `chaves do evento ${String(posicao)}`).toEqual([
          ...CHAVES_DO_EVENTO,
        ]);
      }
    },
    LIMITE_CASO_MS,
  );

  it(
    'CT-925 (b) — o histórico de uma cobrança que a política não alcança é recusa, e não lista vazia',
    async () => {
      const resposta = await pedir(rotaDoHistorico(COBRANCA_INEXISTENTE), { cookie });

      // ---------------------------------------------------------------------------------------
      // `404` com o envelope canônico, por OBJETO INTEIRO — e jamais `200` com `itens: []`
      // ---------------------------------------------------------------------------------------
      //
      // É esta asserção que discrimina: a porta de dados devolve **lista vazia** tanto para a cobrança
      // inexistente quanto para a de outra empresa quanto para a que existe e ainda não teve efeito
      // bancário. Uma rota que publicasse o que ela lê, sem conferir a cobrança antes, responderia
      // `200` com `itens: []` aqui — dizendo *"esta cobrança existe e nada aconteceu com ela"* sobre
      // uma que não existe.
      expect(resposta.status).toBe(404);
      expect(resposta.corpo).toEqual({
        codigo: CODIGO_DE_RECURSO_NAO_ENCONTRADO,
        mensagem: MENSAGEM_DE_NAO_ENCONTRADO,
        campo: 'codigo',
      });
    },
    LIMITE_CASO_MS,
  );

  it(
    'CT-983 — o item da trilha distingue o aviso do provedor da conferência de rotina',
    async () => {
      await registrarCertificadoDaEmpresa('ct983');

      const contrato = await contratoAtivo();
      const codigo = (await lancar(contrato)).codigo;

      // 1) A emissão — `ATO_DO_ADMIN`, pela rota real.
      await emitir(codigo);

      const boleto = await chavesDoBoleto(codigo);

      // 2) A NOTÍCIA — `NOTICIA_DO_PROVEDOR`, pelo caminho inteiro: a rota pública grava o cru e
      //    enfileira, e o consumidor registrado no `beforeAll` executa a tarefa real.
      const recepcao = await pedir(ROTA_DA_NOTICIA, {
        metodo: 'POST',
        corpo: {
          idWebhook: 990,
          tipoMovimento: 7,
          dados: {
            seuNumero: boleto.identificador,
            nossoNumero: boleto.numeroDoTitulo,
            numeroIdentificadorBaixa: '1600100000000000983',
          },
        },
      });

      expect(recepcao.status).toBe(204);

      // A espera é por ESTADO OBSERVÁVEL, com limite nomeado — nunca `sleep` fixo.
      const desfecho = await desfechoDaNoticia(boleto.identificador);
      expect(desfecho).toBe('APLICADO');

      // 3) A CONFERÊNCIA de rotina — `CONFERENCIA`, e ela **é o controle** do caso. Só a cobrança
      //    deste caso é revogada; para as demais do conjunto o par responde *em aberto*, de modo que
      //    o cenário do `CT-925` não é alterado por este caso.
      await conferir(codigo, (cobranca) =>
        cobranca.codigo === codigo
          ? { situacao: 'REVOGADO', motivo: MOTIVO_DA_REVOGACAO_NO_PROVEDOR, documento: null }
          : { situacao: 'EM_ABERTO', documento: null },
      );

      const resposta = await pedir(rotaDoHistorico(codigo), { cookie });

      expect(resposta.status).toBe(200);

      const itens = (resposta.corpo as { readonly itens: readonly EventoPublicado[] }).itens;

      // ---------------------------------------------------------------------------------------
      // A ORIGEM de cada efeito, por igualdade de LISTA ORDENADA de PARES
      // ---------------------------------------------------------------------------------------
      //
      // O par, e não as duas listas separadas: é ele que impede uma trilha em que os tipos estejam
      // certos e as origens trocadas de passar. E é o item de `CONFERENCIA` que dá conteúdo ao caso —
      // sem ele, um produto que carimbasse **tudo** como notícia satisfaria uma asserção que só
      // procurasse `NOTICIA_DO_PROVEDOR`.
      expect(itens.map((evento) => ({ tipo: evento.tipo, origem: evento.origem }))).toEqual([
        ...TRILHA_ESPERADA_DO_CT983,
      ]);

      // E as duas origens são **distinguíveis no mesmo histórico**: três itens, duas origens
      // diferentes entre os dois efeitos que o provedor causou.
      expect([...new Set(itens.map((evento) => evento.origem))].sort()).toEqual([
        'ATO_DO_ADMIN',
        'CONFERENCIA',
        'NOTICIA_DO_PROVEDOR',
      ]);
    },
    LIMITE_CASO_MS,
  );
});

// ---------------------------------------------------------------------------------------------
// Acessórios — tudo pelas rotas reais, salvo o percurso da conferência e as leituras de arranjo
// ---------------------------------------------------------------------------------------------

let sequencial = 0;

function proximo(): number {
  sequencial += 1;

  return sequencial;
}

/** A rota do histórico, composta a partir do dono do segmento — nunca escrita à mão. */
function rotaDoHistorico(codigo: string): string {
  return `${COLECAO_DE_COBRANCAS}/${codigo}/historico-bancario`;
}

/** Emite o boleto pela rota real — o produtor de `BOLETO_EMITIDO` com `origem = ATO_DO_ADMIN`. */
async function emitir(codigo: string): Promise<void> {
  const resposta = await pedir(`${COLECAO_DE_COBRANCAS}/${codigo}/emissao-de-boleto`, {
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

/**
 * Registra o certificado vigente da empresa **pela rota real** — a precondição de toda emissão.
 *
 * A autoridade é descartável e nasce dentro do caso. É o mesmo acessório, palavra por palavra, de
 * `boleto-da-cobranca.e2e.spec.ts`.
 */
async function registrarCertificadoDaEmpresa(nome: string): Promise<void> {
  const autoridade: AutoridadeDeTeste = await gerarAutoridadeDeTeste(nome);
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
  // A identidade da empresa perante o provedor é pré-condição do MESMO tipo que o certificado
  // (`D36 · F4/T10`, fechado em 2026-08-20). Registrada pela ROTA REAL, como o certificado acima.
  const identidadeRegistrada = await pedir(ROTA_DO_REGISTRO_DA_IDENTIDADE, {
    metodo: 'POST',
    cookie,
    corpo: {
      identificadorDaAplicacao: 'identificador-do-arranjo',
      numeroDoCliente: 33065,
      numeroDaContaCorrente: 380261,
      codigoDaModalidade: 1,
    },
  });

  if (identidadeRegistrada.status !== 201) {
    throw new Error(
      `o registro da identidade respondeu ${String(identidadeRegistrada.status)}: ${identidadeRegistrada.texto}`,
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
      // Sem geração automática: o que este caso mede é a trilha de **uma** cobrança conhecida, e doze
      // parcelas nascidas da ativação encheriam o conjunto que a conferência percorre.
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

/** Lança a cobrança do cenário pela rota real, com vencimento derivado do relógio do banco. */
async function lancar(contratoCodigo: string): Promise<{ readonly codigo: string }> {
  const vencimento = await dataDeslocada(DIAS_ATE_O_VENCIMENTO);
  const competencia = `${vencimento.slice(0, 7)}-01`;

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

  return resposta.corpo as { readonly codigo: string };
}

/** Cria um recurso pela rota informada e devolve o identificador dele. A falha levanta. */
async function criarPor(
  colecao: string,
  corpo: Record<string, unknown>,
): Promise<{ readonly id: string }> {
  const resposta = await pedir(colecao, { metodo: 'POST', cookie, corpo });

  if (resposta.status !== 201) {
    throw new Error(`a criação em ${colecao} respondeu ${String(resposta.status)}`);
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
 * **É assim que toda data deste arquivo é posicionada**: o relógio nunca é falseado, o dado é que se
 * move. A leitura sai do **mesmo** `negocio.data_corrente_da_operacao()` que a visão consulta — nunca
 * de `new Date()` do processo, que é o segundo eixo de dia que a ADR-0026 fecha.
 */
async function dataDeslocada(dias: number): Promise<string> {
  return await emUnidade(async (tx) => {
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
  });
}

/** Roda a conferência **real** com um par que informa o título REVOGADO — o produtor do evento. */
async function conferirComProvedorQueRevoga(codigo: string): Promise<void> {
  await conferir(codigo, () => ({
    situacao: 'REVOGADO',
    motivo: MOTIVO_DA_REVOGACAO_NO_PROVEDOR,
    documento: null,
  }));
}

/** Roda a conferência real com um par que informa o título LIQUIDADO — o produtor da liquidação. */
async function conferirComProvedorQueLiquida(codigo: string, pagoEm: string): Promise<void> {
  await conferir(codigo, () => ({
    situacao: 'LIQUIDADO',
    pagoEm,
    valorPago: VALOR_INFORMADO_PELO_PROVEDOR,
    documento: null,
  }));
}

/**
 * O percurso da conferência sobre a carteira corrente, com a situação que o par informa.
 *
 * É `conferirCobrancas`, de `@sysloc/cobranca-bancaria`, com as portas satisfeitas pelas mesmas
 * funções de `@sysloc/db` que a borda da tarefa satisfará. Nada aqui escreve na tabela por fora: a
 * revogação sai de `revogarBoleto`, a liquidação de `liquidarPeloProvedor`, e os eventos de
 * `registrarEventoBancario`.
 *
 * A cobrança do caso é afirmada **dentro** do conjunto selecionado antes de a apuração correr: sem
 * essa linha, um predicado que a excluísse faria a conferência não fazer nada, e o passo seguinte
 * mediria um estado que ninguém produziu.
 */
async function conferir(
  codigo: string,
  situacaoDe: (cobranca: CobrancaAConferir) => SituacaoConsultada,
): Promise<void> {
  const cobrancas = await emUnidade(selecionarCobrancasAConferir);

  expect(cobrancas.map((cobranca) => cobranca.codigo)).toContain(codigo);

  const conferenciaId = await emUnidade(async (tx) => {
    const aberta = await abrirConferencia(tx, { solicitadaPor: QUEM_AGE.id });

    return aberta.id;
  });

  await conferirCobrancas({
    empresaId: EMPRESA_A.id,
    segredo: SEGREDO_DA_CONFERENCIA,
    identidade: IDENTIDADE_DO_ARRANJO,
    cobrancas,
    adaptador: {
      ...portaDoProvedor,
      consultarSituacao: async (consulta: ConsultaDeSituacao) => {
        const alvo = cobrancas.find(
          (cobranca) => cobranca.numeroDoTituloNoProvedor === consulta.numeroDoTituloNoProvedor,
        );

        if (alvo === undefined) {
          // Levantar, e não devolver uma situação qualquer: uma consulta por título que não está no
          // conjunto selecionado significa que o percurso perguntou por outra cobrança, e responder
          // "em aberto" esconderia isso atrás de um desfecho benigno.
          throw new Error('o par da conferência recebeu um título fora do conjunto selecionado');
        }

        return { aceito: true, valor: situacaoDe(alvo) };
      },
    },
    guarda: criarGuardaDeBoletos(diretorioDosBoletos()),
    valorEsperado: async (cobranca) =>
      await emUnidade(async (tx) => {
        const linha = await localizarCobranca(tx, cobranca.codigo);

        if (linha === undefined) {
          throw new Error(`o arranjo não encontrou a cobrança ${cobranca.codigo}`);
        }

        // `valorTotal` é o total DERIVADO pela visão (ADR-0022) — original mais a mora vigente —, e é
        // ele que se esperava receber. Nada aqui calcula: a derivação é do banco.
        return linha.valorTotal;
      }),
    gravarLiquidacao: async (cobranca, liquidacao) =>
      await emUnidade(async (tx) => {
        const desfecho = await liquidarPeloProvedor(tx, cobranca.codigo, {
          pagoEm: liquidacao.pagoEm,
          valorPago: liquidacao.valorPago.toFixed(2),
          dataDoCredito: liquidacao.dataDoCredito,
          valorCreditado: liquidacao.valorCreditado.toFixed(2),
        });

        if (desfecho !== 'LIQUIDADA') {
          return desfecho;
        }

        await registrarEventoBancario(tx, {
          cobrancaId: cobranca.id,
          tipo: 'COBRANCA_LIQUIDADA',
          origem: 'CONFERENCIA',
        });

        return desfecho;
      }),
    gravarEstorno: async () => {
      throw new Error('nenhum caso deste arquivo informa estorno');
    },
    gravarRevogacao: async (cobranca, motivo) =>
      await emUnidade(async (tx) => {
        const aplicada = await revogarBoleto(tx, cobranca.codigo);

        if (aplicada.desfecho === 'REVOGADO') {
          await registrarEventoBancario(tx, {
            cobrancaId: cobranca.id,
            tipo: 'BOLETO_REVOGADO',
            origem: 'CONFERENCIA',
            // O motivo do provedor viaja INTACTO até a coluna de diagnóstico (RN-15) — e é este texto
            // que o `CT-925` afirma no corpo da rota, byte a byte.
            diagnostico: motivo,
          });
        }

        return aplicada.desfecho;
      }),
    concluir: async (contagens) => {
      await emUnidade(async (tx) => {
        await concluirConferencia(tx, conferenciaId, contagens);
      });
    },
  });
}

/**
 * A resposta que a porta do **consumidor** dá: o título foi liquidado, com a data corrente e o valor
 * devido.
 *
 * A data sai do relógio do BANCO (ADR-0026), e o valor é o **esperado** — sem divergência a
 * registrar, para que a trilha do `CT-983` tenha exatamente os três itens que ele declara.
 */
async function consultaQueLiquida(): Promise<DesfechoDaOperacao<SituacaoConsultada>> {
  return {
    aceito: true,
    valor: {
      situacao: 'LIQUIDADO',
      pagoEm: await dataDeslocada(0),
      valorPago: VALOR_INFORMADO_PELO_PROVEDOR,
      documento: null,
    },
  };
}

/** As duas chaves do boleto vivo de uma cobrança — o que a notícia do provedor precisa carregar. */
async function chavesDoBoleto(
  codigo: string,
): Promise<{ readonly identificador: string; readonly numeroDoTitulo: string }> {
  return await emUnidade(async (tx) => {
    const [linha] = await tx<{ identificador: string; numeroDoTitulo: string }[]>`
      SELECT identificador_no_provedor     AS "identificador",
             numero_do_titulo_no_provedor  AS "numeroDoTitulo"
        FROM negocio.cobranca
       WHERE codigo = ${codigo}
    `;

    if (linha === undefined) {
      throw new Error(`o arranjo não encontrou o boleto da cobrança ${codigo}`);
    }

    return linha;
  });
}

/**
 * Espera a tarefa carimbar o desfecho da notícia daquele identificador, e devolve o desfecho.
 *
 * A espera é por **estado observável** — a coluna que a tarefa escreve —, com limite nomeado, e
 * nunca por `sleep` fixo. A linha crua é lida **sem contexto de tenant**: a tabela vive em
 * `plataforma` e nenhuma política a alcança (ADR-0031).
 */
async function desfechoDaNoticia(identificador: string): Promise<string> {
  let ultimo: NotificacaoBancariaPersistida | undefined;

  await sondarAte(
    `a notícia de ${identificador} ser tratada`,
    async () => {
      ultimo = await acessoAoNegocio.emUnidadeDeTrabalho(async (tx) => {
        const [linha] = await tx<NotificacaoBancariaPersistida[]>`
          SELECT id,
                 recebido,
                 recebido_em                      AS "recebidoEm",
                 desfecho,
                 identificador_perante_o_provedor AS "identificadorPeranteOProvedor",
                 identificador_da_liquidacao      AS "identificadorDaLiquidacao",
                 diagnostico,
                 tratado_em                       AS "tratadoEm"
            FROM plataforma.notificacao_bancaria
           WHERE recebido -> 'dados' ->> 'seuNumero' = ${identificador}
        `;

        return linha;
      });

      return ultimo !== undefined && ultimo.desfecho !== 'RECEBIDO';
    },
    LIMITE_DO_DESFECHO_MS,
  );

  if (ultimo === undefined) {
    throw new Error(`a notícia de ${identificador} não foi encontrada no banco`);
  }

  return ultimo.desfecho;
}

/**
 * O diretório dos boletos, lido **da aplicação montada** — nunca do ambiente do processo.
 *
 * A guarda deste percurso é construída aqui porque o percurso é do **caso**, e não da aplicação; o
 * diretório precisa ser o **mesmo** que a composição usa, para que os bytes que a conferência apagar
 * sejam os que a rota gravou.
 */
function diretorioDosBoletos(): string {
  return aplicacao.get<Ambiente>(TOKEN_AMBIENTE).diretorioDosBoletos;
}

/**
 * Abre a unidade de trabalho sob o contexto da empresa A — o mesmo par da operação.
 *
 * `contextoDeTenant.executarCom` mais `emUnidadeDeTrabalho`: nenhum `SET app.empresa_id` é escrito à
 * mão, e nenhuma consulta compara empresa com coisa alguma.
 */
async function emUnidade<T>(trabalho: (tx: TransactionSql) => Promise<T>): Promise<T> {
  return await contextoDeTenant.executarCom(
    { empresaId: EMPRESA_A.id },
    async () => await acessoAoNegocio.emUnidadeDeTrabalho(trabalho),
  );
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

/**
 * Uma linha da trilha como a rota a publica — as **cinco** chaves, escritas à mão.
 *
 * Ele descreve o corpo observado, e não é importado de `@sysloc/contracts`: o caso o assere por
 * igualdade, e derivá-lo do tipo do SUT faria a asserção concordar consigo mesma.
 */
interface EventoPublicado {
  readonly tipo: string;
  readonly origem: string;
  readonly ocorridoEm: string;
  readonly diagnostico: string | null;
  readonly valorInformado: number | null;
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
