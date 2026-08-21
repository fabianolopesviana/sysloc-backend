/**
 * Os **dois atos sobre o boleto** de uma cobrança — `POST /v1/cobrancas/:codigo/emissao-de-boleto` e
 * `POST /v1/cobrancas/:codigo/revogacao-de-boleto` (T13 da fatia `emissao-e-conciliacao`) — e a
 * **entrega dos bytes** dele, `GET /v1/cobrancas/:codigo/boleto` (T14 da mesma fatia).
 *
 * ---------------------------------------------------------------------------
 * INVARIANTES
 * ---------------------------------------------------------------------------
 *
 * | Critério | Caso | Invariante |
 * |---|---|---|
 * | CA-06 | CT-918 | Revogação **confirmada** seguida de emissão que falha deixa a cobrança
 * |       |        | `numero_do_titulo_no_provedor IS NULL`, **em aberto** (`pago_em` e `cancelado_em` nulos), e a
 * |       |        | resposta é `503` com o envelope da ADR-0017 asserido como **objeto inteiro**,
 * |       |        | nomeando a cobrança pelo **código** e declarando
 * |       |        | `{ boleto: 'SEM_BOLETO', revogacao: 'CONFIRMADA' }`. A trilha ganha
 * |       |        | **exatamente dois** eventos — `BOLETO_REVOGADO` e `EMISSAO_RECUSADA` —, ambos
 * |       |        | com `origem = 'ATO_DO_ADMIN'`, e o `diagnostico` do segundo é o motivo do
 * |       |        | provedor **byte a byte**. E em nenhum instante houve mais de um título vivo:
 * |       |        | a sequência que a porta recebeu prova que a emissão só foi pedida **depois**
 * |       |        | de a revogação ter sido confirmada. |
 * | CA-06 | CT-918 | As recusas que **não custam rede** acontecem na metade transacional, e
 * |       | (b)    | nenhuma delas fala com o provedor: código malformado é `422` nomeando o campo;
 * |       |        | cobrança inexistente é `404` com o corpo canônico por igualdade de objeto
 * |       |        | inteiro; empresa **sem certificado** é `422` com
 * |       |        | `detalhes: { certificado: 'AUSENTE' }`; revogação sobre cobrança **sem título
 * |       |        | vivo** é `422` com `detalhes: { boleto: 'SEM_BOLETO' }`; e emissão sobre
 * |       |        | cobrança **já liquidada** é `422` nomeando o estado atual. Ao fim das cinco, a
 * |       |        | sequência recebida pela porta é **vazia** — é ela que liga todas. |
 * | CA-06 | CT-918 | Revogação **pedida e não confirmada** não apaga nada: o título permanece, a
 * |       | (c)    | trilha **não cresce** (ADR-0034 — tentativa que nada mudou fica fora dela), e a
 * |       |        | resposta é `503` declarando `{ revogacao: 'PEDIDA_NAO_CONFIRMADA' }`, com o
 * |       |        | envelope asserido por objeto inteiro. |
 * | CA-06 | CT-918 | A **sexta** situação de erro da §10.1 — certificado **VENCIDO** — recusa a
 * |       | (d)    | emissão com `422`, envelope asserido por objeto inteiro, mensagem **do vencido**
 * |       |        | (nunca a da ausência), **sem `campo`** e com `detalhes.validoAte` igual ao
 * |       |        | instante gravado na linha; a sequência recebida pela porta é **vazia**, e a
 * |       |        | cobrança termina sem título. |
 * | CA-06 | CT-918 | A revogação **confirmada** responde `200` com a cobrança sem título ainda
 * |       | (g)    | que os bytes do boleto **não possam ser apagados**: o efeito acessório corre
 * |       |        | depois do commit, e a falha dele — afirmada contra a guarda REAL antes do ato
 * |       |        | — não derruba o que já se completou. A trilha ganha **exatamente um** evento
 * |       |        | `BOLETO_REVOGADO`, a coluna perde o título, a sequência recebida pela porta é
 * |       |        | `['solicitarRevogacaoDeBoleto', 'confirmarRevogacaoDeBoleto']`, e o alvo que
 * |       |        | não pôde ser apagado continua em disco — o órfão benigno que o ato declara. |
 * | CA-15 | CT-918 | A sessão que **TEM** `TELA:financeiro` e **NÃO tem** as duas ações recebe `403`
 * |       | (e)    | nas duas rotas, com o envelope canônico inteiro e `detalhes.exigido` nomeando a
 * |       |        | **PRIMEIRA** exigência ausente — que é a **AÇÃO**, diferente em cada rota —,
 * |       |        | enquanto a leitura da mesma cobrança pela mesma sessão responde `200` (controle
 * |       |        | positivo). Nada é pedido ao provedor, o título não muda e a trilha não cresce. |
 * | CA-18 | CT-931 | Cobrança cujo boleto foi revogado **pela conferência real** aceita nova
 * |       |        | emissão pelo caminho normal: a sequência de operações da porta é
 * |       |        | **exatamente `['emitir']`** — sem etapa de revogação supérflua —, o novo
 * |       |        | `numero_do_titulo_no_provedor` é não-nulo e **diferente** do anterior, o novo
 * |       |        | `identificador_no_provedor` também, e a trilha ganha **um** evento
 * |       |        | `BOLETO_EMITIDO` com `origem = 'ATO_DO_ADMIN'`. |
 * | CA-19 | CT-932 | Os **cinco** campos de conciliação são publicados nos três estados, e
 * |       |        | distinguem **ausência** de valor: recém-criada, os cinco valem `null`;
 * |       |        | emitida, os três de emissão são não-nulos e os dois de crédito seguem `null`;
 * |       |        | creditada pela conferência, os dois de crédito carregam o que o provedor
 * |       |        | informou. Nos **três** estados o conjunto de chaves do corpo é afirmado por
 * |       |        | **igualdade** contra a lista declarada do contrato — é ela que impede
 * |       |        | `boleto_arquivo` e `identificador_no_provedor`, que são internos, de vazarem
 * |       |        | para a saída. |
 * | CA-07 | CT-919 | A entrega responde `200` com `content-type: application/pdf` e
 * |       |        | `content-disposition` nomeando `<codigo>.pdf`; os cinco primeiros bytes do corpo
 * |       |        | são `%PDF-`, e o corpo inteiro é, **byte a byte**, o documento que o provedor
 * |       |        | entregou naquela emissão. **Nada é perguntado ao provedor** — o arquivo estava
 * |       |        | em disco. |
 * | CA-19 | CT-919 | A cobrança publica `linhaDigitavel` com **47** dígitos e `codigoDeBarras` com
 * |       |        | **44** — comprimentos que são contrato do meio de pagamento —, medidos sobre o
 * |       |        | que a ROTA publica, e ancorados à emissão do caso pelo número do título. |
 * | CA-08 | CT-920 | Apagado o arquivo do disco (com a coluna **intacta**), o pedido seguinte responde
 * |       |        | `200` com corpo **idêntico byte a byte** ao anterior, os mesmos dois cabeçalhos, e
 * |       |        | recria o arquivo com esses mesmos bytes. A porta recebe **exatamente uma**
 * |       |        | `consultarSituacao`; os três campos de conciliação seguem iguais ao que o par
 * |       |        | atribuiu, e a trilha é **igual à de antes** — rebuscar cache não é efeito
 * |       |        | (ADR-0034). O controle antivácuo é a ausência do arquivo afirmada **antes** do
 * |       |        | segundo pedido, e a ausência de consulta afirmada no **primeiro**. |
 * | CA-08 | CT-920 | A rebusca que o provedor **recusa** responde `503` com o envelope da ADR-0017
 * |       | (b)    | asserido como **objeto inteiro** — mensagem do produto nomeando a cobrança, e
 * |       |        | **sem** o texto do provedor (RN-15) —, `content-type` de JSON, corpo que **não**
 * |       |        | começa com `%PDF-`, arquivo que **continua ausente**, colunas intactas e trilha
 * |       |        | igual à de antes. |
 * | CA-09 | CT-921 | O boleto **nunca emitido** responde `404` com o envelope asserido como objeto
 * |       |        | inteiro, nomeando a cobrança e declarando `{ boleto: 'NUNCA_EMITIDO' }`; o
 * |       |        | `content-type` é de JSON, o corpo **não** começa com `%PDF-` e tem menos de 512
 * |       |        | bytes, nada é pedido ao provedor e nenhum arquivo é escrito. |
 * | CA-09 | CT-921 | A autorização da entrega sai do **ESTADO no banco**, jamais da presença do
 * |       | (b)    | arquivo: a cobrança cujo boleto foi **revogado** e cujo alvo **sobreviveu em
 * |       |        | disco** — estado real, produzido pela rota de revogação com o efeito acessório
 * |       |        | falhando — responde o **mesmo** `404` de nunca emitido, sem consultar o provedor,
 * |       |        | e o órfão continua onde estava. |
 *
 * Rastreabilidade: `CA-06 → CT-918, CT-918 (b), CT-918 (c), CT-918 (d), CT-918 (g) (RN-15)` ·
 * `CA-15 → CT-918 (e) (RN-14)` · `CA-18 → CT-931 (RN-10)` · `CA-19 → CT-932, CT-919 (RN-12)` ·
 * `CA-07 → CT-919 (RN-05)` · `CA-08 → CT-920, CT-920 (b) (RN-05)` ·
 * `CA-09 → CT-921, CT-921 (b) (RN-05)`.
 *
 * ⚠️ **Os sufixos não são estilo, e sim a única forma disponível**: a faixa `CT-911`…`CT-948` está
 * inteiramente reservada pelos cards das tasks desta fatia, e reusar um identificador produziria
 * duas coisas diferentes com o mesmo nome. É a mesma escolha, e a mesma razão, de
 * `certificado-do-provedor.e2e.spec.ts`. O eixo **estrutural** irmão do `CT-918 (e)` é o
 * `CT-918 (f)`, em `apps/api/test/cobertura-de-autorizacao.e2e.spec.ts`, e a matriz completa
 * `7 rotas × 3 perfis` é do `CT-941`, na T17.
 *
 * ===========================================================================
 * O ADAPTADOR VEM PELA COMPOSIÇÃO, e a produção não ganhou ramo de teste
 * ===========================================================================
 *
 * A aplicação é montada pelo **`AppModule` real**, e o que a suíte substitui é o **provedor inteiro**
 * da porta de cobrança, por `overrideProvider(TOKEN_PORTA_DE_COBRANCA_BANCARIA)` — o mecanismo do
 * arcabouço de teste, não um caminho aberto no código de produção. `criarAplicacao()` não ganhou
 * parâmetro, nada em `apps/api/src` ganhou bandeira, e o adaptador Sicoob não tem ramo `if (ehTeste)`.
 * É a mesma forma, e a mesma razão, de `certificado-do-provedor.e2e.spec.ts`.
 *
 * ⚠️ **A guarda de boletos NÃO é substituída**, e a ausência é a decisão: os bytes gravados em disco
 * são a coisa sob prova da fatia, e dublá-la seria dublar o que se quer medir. O que a suíte troca é
 * o **diretório**, que `vitest.config.ts` semeia para um caminho descartável fora da árvore.
 *
 * ===========================================================================
 * A REVOGAÇÃO DO CT-931 vem da CONFERÊNCIA REAL — nunca de um `UPDATE` no arranjo
 * ===========================================================================
 *
 * O percurso da T12 (`conferirCobrancas`) é chamado com as portas satisfeitas pelas **mesmas**
 * funções de `@sysloc/db` que a borda da tarefa satisfará, sob o contexto de tenant e dentro da
 * unidade de trabalho. Zerar `numero_do_titulo_no_provedor` direto na tabela pularia o produtor sob prova, e o caso
 * passaria a medir a rota contra um estado que o produto nunca produz.
 *
 * ===========================================================================
 * TODA DATA sai do relógio do BANCO (ADR-0026)
 * ===========================================================================
 *
 * Nenhuma data deste arquivo nasce de `new Date()` do processo: o vencimento, a competência e o dia
 * do pagamento informado saem de {@link dataDeslocada}, que lê o **mesmo**
 * `negocio.data_corrente_da_operacao()` que a visão `cobranca_derivada` consulta. Um dia absoluto
 * escrito no caso reintroduziria o segundo eixo de dia que a ADR-0026 fecha, e a suíte passaria a
 * depender de quando ela roda.
 *
 * ===========================================================================
 * O QUE ESTE ARQUIVO NÃO MEDE, e onde isso mora
 * ===========================================================================
 *
 * O **histórico bancário** — a outra leitura da T14 — mora em
 * `apps/api/test/historico-bancario.e2e.spec.ts`, e a separação é a mesma escolha de sempre: aquele
 * arquivo mede a **ordem** de uma trilha construída por quatro efeitos encadeados, e trazê-la para cá
 * misturaria dois cenários com arranjos incompatíveis no mesmo lugar.
 *
 * Os **seis** ramos de erro que a §10.1 declara têm caso aqui: cinco no `CT-918 (b)` e no
 * `CT-918 (c)`, e o **certificado vencido** no `CT-918 (d)`.
 *
 * ⚠️ **A leitura anterior deste bloco dizia que o sexto era improduzível, e ela foi refutada por
 * medição.** É verdade que `registrarCertificado` recusa material com validade encerrada (RN-03), e
 * portanto que a rota não produz o estado; o que não se seguia é a conclusão: o estado nasce da
 * **passagem do tempo**, e `certificado-do-provedor.e2e.spec.ts` já o monta envelhecendo a linha
 * vigente por escrita privilegiada **declarada**, com a razão escrita no cabeçalho dele. O que aquele
 * arquivo mede, porém, é **outro ramo, de outra rota** — a recusa do *registro*, com
 * `motivo: JA_VENCIDO` —, e nada ali afirma o envelope que **esta** borda publica. O `CT-918 (d)` o
 * afirma, na rota de emissão, por objeto inteiro.
 */

import { randomBytes } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile, rm, stat } from 'node:fs/promises';
import { join } from 'node:path';
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
  EMPRESA_B,
  escreverAjustes,
  lerTrilhaDaCobranca,
  liquidarPeloProvedor,
  localizarCobranca,
  registrarEventoBancario,
  revogarBoleto,
  SENHA_DA_CARGA,
  selecionarCobrancasAConferir,
} from '@sysloc/db';
import { criarSegredoOperavel } from '@sysloc/shared';
import type { TransactionSql } from 'postgres';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
// DÉBITO COM GATILHO — D28 · F0/T5 · gatilho JÁ DISPARADO (F1/T2, 2026-08-02)
// (NÃO é uma `DECISÃO FECHADA`: ele agenda uma mudança, não protege o código abaixo.)
// O QUÊ: os imports a seguir atravessam a fronteira de `@sysloc/auth` e de `@sysloc/shared` por
//        CAMINHO DE ARQUIVO, fora do `exports` e do `files` daqueles manifestos. As dependências de
//        workspace estão declaradas, então não há dependência oculta; o que não existe é FRONTEIRA
//        para os diretórios `test/` — e este arquivo é mais um a repetir o padrão.
// QUANDO FECHA: o gatilho já disparou e o fechamento segue pendente; ele é o mesmo de sempre —
//        declarar o subpath `"./test"` nos manifestos e importar por `@sysloc/<pacote>/test`, ou
//        extrair um `@sysloc/test-utils`.
// POR QUE NÃO AGORA: fechar exige editar os manifestos de dois pacotes e todos os consumidores,
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
  SEGMENTO_DA_CONSULTA,
  SEGMENTO_DO_REGISTRO,
} from '../src/integracoes-bancarias/certificado.controller.ts';
import { SEGMENTO_DA_IDENTIDADE } from '../src/integracoes-bancarias/identidade.controller.ts';
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

/** Limite de cada caso: os três montam cadastros pelas rotas reais e falam com o par instrumentado. */
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
const ROTA_DA_CONSULTA_DE_CERTIFICADO = `/${PREFIXO_DE_VERSAO}/${CAMINHO_DAS_INTEGRACOES_BANCARIAS}/${SEGMENTO_DA_CONSULTA}`;

/**
 * As **vinte e três** chaves que a cobrança publica, em ordem alfabética.
 *
 * Escritas por extenso, e **não** derivadas de `esquemaDaCobranca` nem do corpo observado: é a
 * igualdade contra esta lista que transforma *"nada interno vaza para a saída"* numa afirmação que
 * pega **qualquer** grafia — `nossoNumero`, `boletoArquivo`, `identificadorNoProvedor` —, e não só um
 * nome que o caso tivesse adivinhado. Derivá-la do tipo do SUT faria a asserção concordar consigo
 * mesma.
 *
 * ⚠️ Ela é a **mesma** lista de `cobrancas.e2e.spec.ts`, e a duplicação é deliberada: as duas afirmam
 * o mesmo contrato por caminhos diferentes, e importá-la de lá faria um arquivo de teste virar fonte
 * do outro — a primeira divergência entre os dois passaria despercebida.
 */
const CHAVES_PUBLICADAS: readonly string[] = [
  'canceladoEm',
  'codigo',
  'codigoDeBarras',
  'competencia',
  'contratoCodigo',
  'dataDoCredito',
  'dataVencimento',
  'diasAtraso',
  'jurosPercentualAplicado',
  'linhaDigitavel',
  'locatarioId',
  'multaPercentualAplicado',
  'natureza',
  'numeroDoTituloNoProvedor',
  'pagoEm',
  'referencia',
  'status',
  'valorCreditado',
  'valorJuros',
  'valorMulta',
  'valorOriginal',
  'valorPago',
  'valorTotal',
];

/**
 * Os **três** campos que a emissão preenche e os **dois** que só o crédito preenche.
 *
 * Separá-los é o que torna o CT-932 uma prova sobre os **dois momentos**: no estado emitido os
 * primeiros já valem e os segundos ainda são `null`, e é essa diferença que distingue *"a publicação
 * mostra o que foi gravado"* de *"a publicação mostra tudo o que existe no esquema"*.
 */
const CAMPOS_DA_EMISSAO = ['numeroDoTituloNoProvedor', 'linhaDigitavel', 'codigoDeBarras'] as const;
const CAMPOS_DO_CREDITO = ['dataDoCredito', 'valorCreditado'] as const;

/**
 * O arranjo concedido à sessão que age.
 *
 * Literal, e **não** derivado da exigência declarada nos controladores: derivá-lo faria a asserção
 * concordar com o SUT, e trocar a exigência da classe deixaria de reprovar caso algum. As quatro
 * primeiras estão aqui por obrigação do cenário — sem contrato ativo não há sobre o que lançar —, e
 * as duas ações do Financeiro são o eixo desta task.
 *
 * `TELA:integracoes_bancarias` e `ACAO:configurar_integracao` entram pela MESMA obrigação de cenário:
 * a emissão exige certificado vigente da empresa, e registrá-lo pela rota real é o único caminho
 * legítimo para produzir a precondição — gravar a linha por escrita privilegiada montaria o estado
 * por fora da regra que o próprio caso observa.
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

/** As chaves afirmadas no efetivo da sessão — nunca supostas. */
const AREA_DO_FINANCEIRO: ChaveDoCatalogo = 'TELA:financeiro';
const AREA_DAS_INTEGRACOES_BANCARIAS: ChaveDoCatalogo = 'TELA:integracoes_bancarias';
const ACAO_DE_EMISSAO: ChaveDoCatalogo = 'ACAO:emitir_boleto';
const ACAO_DE_BAIXA: ChaveDoCatalogo = 'ACAO:solicitar_baixa_de_boleto';

/**
 * A extensão com que a guarda nomeia os bytes — **escrita à mão**, jamais importada do SUT.
 *
 * Ela compõe o alvo que o `CT-918 (g)` torna inapagável. Derivá-la do pacote faria o caso concordar
 * com a guarda sobre o nome do arquivo, que é justamente o que ele precisa saber por fora.
 */
const EXTENSAO_DO_BOLETO = '.pdf';

/**
 * A assinatura com que todo PDF começa — a âncora de que o corpo é mesmo um documento.
 *
 * Sem ela, *"a resposta veio com `Content-Type: application/pdf`"* seria satisfeito por um corpo
 * vazio, e o `CT-919` provaria só que a rota escreve um cabeçalho. Escrita à mão, e não derivada do
 * par instrumentado: é propriedade do formato, não do arranjo.
 */
const ASSINATURA_DO_PDF = '%PDF-';

/** O tipo de mídia que a rota dos bytes declara (ADR-0028) — literal, nunca importado do SUT. */
const TIPO_DE_MIDIA_DO_BOLETO = 'application/pdf';

/** O tipo de mídia do envelope de erro — o que separa "recusou" de "recusou anunciando-se PDF". */
const TIPO_DE_MIDIA_DO_ERRO = 'application/json';

/**
 * Os comprimentos de **dígitos** da linha digitável e do código de barras (CA-19).
 *
 * Eles são **contrato do meio de pagamento**, e não invenção do caso: 47 posições na representação
 * numérica que a pessoa digita, 44 no código que o leitor ótico lê. Escritos à mão, e conferidos
 * sobre o que a **rota publica** — derivá-los do valor que o par atribuiu faria a asserção concordar
 * com o arranjo, e um truncamento na travessia atravessaria o caso.
 */
const DIGITOS_DA_LINHA_DIGITAVEL = 47;
const DIGITOS_DO_CODIGO_DE_BARRAS = 44;

/** O maior corpo que uma recusa desta superfície pode ter — o teto que exclui documento embutido. */
const MAIOR_CORPO_DE_RECUSA = 512;

/**
 * Os códigos com que o sistema operacional recusa `unlink` sobre um **diretório** — os dois, porque
 * o privilégio do processo decide qual sai: `EISDIR` para o dono privilegiado, `EPERM` fora dele.
 *
 * Nenhum dos dois é `ENOENT`, que é o único desfecho que a guarda engole por idempotência — e é
 * essa distinção, e não a escolha entre os dois, que dá conteúdo à precondição do `CT-918 (g)`.
 */
const RECUSAS_DE_APAGAR_UM_DIRETORIO: readonly string[] = ['EISDIR', 'EPERM'];

/** O código que a guarda engole por idempotência — o que a precondição do `CT-918 (g)` exclui. */
const CODIGO_DE_AUSENCIA = 'ENOENT';

/** A senha do cofre PKCS#12 do arranjo — sentinela, e nunca comparada com nada do produto. */
const SENHA_DO_MATERIAL = 'senha-do-material-do-ct918';

/** Quantos dias no passado a validade do certificado é retroagida no `CT-918 (d)`. */
const DIAS_DE_ATRASO_DO_VENCIDO = 1;

/** O estado que a consulta publica para o certificado cuja validade terminou — escrito à mão. */
const ESTADO_VENCIDO = 'VENCIDO';

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

/** O valor que o provedor informa ter recebido no CT-932 — igual ao devido, sem divergência. */
const VALOR_INFORMADO_PELO_PROVEDOR = VALOR_DA_COBRANCA;

/** O texto com que o provedor recusa a emissão no CT-918 — preservado byte a byte (RN-15). */
const RECUSA_DA_EMISSAO = 'convenio sem faixa de nosso numero disponivel';

/** O texto com que o provedor informa a revogação no CT-931 — opaco, e nada o lê para decidir. */
const MOTIVO_DA_REVOGACAO_NO_PROVEDOR = 'titulo baixado por solicitacao do beneficiario';

/**
 * O texto com que o par recusa a consulta de situação — o padrão, e o desfecho do `CT-920 (b)`.
 *
 * Ele é o **mesmo** que os casos da T13 já observavam por omissão, e é conteúdo do `CT-920 (b)`: a
 * igualdade do envelope de lá afirma que ele **não** entra no corpo da resposta (RN-15).
 */
const RECUSA_DA_CONSULTA = 'consulta nao esperada pela rota';

/**
 * Os códigos e as mensagens que os corpos de erro publicam — **literais**, nunca lidos do SUT.
 *
 * Derivá-los de `MENSAGEM_POR_CODIGO` faria a asserção concordar consigo mesma: um erro de texto na
 * tabela passaria despercebido nos dois lados. É a mesma escolha, e a mesma razão, de
 * `cobrancas.e2e.spec.ts`.
 */
const CODIGO_DE_SERVICO_INDISPONIVEL = 'SERVICO_INDISPONIVEL';
const CODIGO_DE_CAMPO_INVALIDO = 'CAMPO_INVALIDO';
const CODIGO_DE_RECURSO_NAO_ENCONTRADO = 'RECURSO_NAO_ENCONTRADO';
const CODIGO_DE_ACESSO_NEGADO = 'ACESSO_NEGADO';
const MENSAGEM_DE_CAMPO_INVALIDO = 'requisição inválida';
const MENSAGEM_DE_NAO_ENCONTRADO = 'recurso não encontrado';
const MENSAGEM_DE_ACESSO_NEGADO = 'acesso negado para esta sessão';
const MENSAGEM_SEM_CERTIFICADO = 'esta empresa não tem certificado do provedor registrado';
const MENSAGEM_DO_CERTIFICADO_VENCIDO = 'a validade do certificado apresentado já terminou';
const MENSAGEM_SEM_BOLETO_A_REVOGAR = 'esta cobrança não tem boleto a revogar';
const MENSAGEM_DA_EMISSAO_INCOMPLETA = 'a emissão do boleto não se completou para a cobrança';
const MENSAGEM_DA_REVOGACAO_INCOMPLETA = 'a revogação do boleto não se completou para a cobrança';
const MENSAGEM_SEM_BOLETO_EMITIDO = 'não há boleto emitido para a cobrança';
const MENSAGEM_DA_ENTREGA_INCOMPLETA = 'o documento do boleto não pôde ser obtido para a cobrança';

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
 * A pessoa que age pela **empresa B** — a empresa que este arquivo nunca configura.
 *
 * Ela existe para que *"a empresa sem certificado é recusada"* seja uma afirmação sobre uma empresa
 * **de fato** não configurada, e não sobre um instante da empresa A anterior ao primeiro registro. É
 * o que remove o acoplamento de ordem entre os casos, em vez de apenas torná-lo audível.
 */
const QUEM_ADMINISTRA_EM_B = pessoaSemeada('admin.b@exemplo.com.br');

/** A pessoa cujo efetivo é recortado no `CT-918 (e)`: a área do Financeiro **sem** as duas ações. */
const QUEM_NAO_ALCANCA_AS_ACOES = pessoaSemeada('admin.a@exemplo.com.br');

let identidade: IdentidadeEfemera;
let fila: FilaEfemera;
let acessoAoNegocio: AcessoAoBanco;
let aplicacao: NestFastifyApplication;
let base: string;
let ambienteAnterior: NodeJS.ProcessEnv;
let cookie: string;
let cookieDeB: string;
let cookieSemAsAcoes: string;

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

/**
 * O roteiro que cada caso escreve antes de agir, e o registro do que a porta recebeu.
 *
 * ⚠️ **A sequência de operações é o instrumento central desta suíte.** É ela que prova a **ordem** do
 * ato composto — que a emissão só acontece depois de a revogação ter sido confirmada (CA-06) — e a
 * **ausência** de etapa supérflua quando não há título vivo (CA-18). Nenhuma das duas seria observável
 * pelo estado final do banco.
 *
 * `emitidos` guarda o que o **provedor** devolveu, inteiro e em ordem: ele é a sequência **do outro
 * lado**, independente do contador do produto, e é isso que permite ao CT-931 separar os dois eixos.
 * Ele carrega o boleto inteiro, e não só o número, porque o CT-932 afirma os **três** campos de
 * emissão contra o valor exato que o par atribuiu — `não é nulo` admitiria a cadeia vazia que a
 * CA-19 proíbe, e uma gravação que truncasse a linha digitável atravessaria o caso.
 */
interface RoteiroDoProvedor {
  /** As operações recebidas, na ordem — zerada por quem vai medir um trecho. */
  operacoes: string[];
  /** Os boletos que o provedor atribuiu, na ordem em que emitiu. */
  emitidos: BoletoEmitido[];
  /** A emissão é aceita? Quando não, o motivo viaja para a trilha e para o journal. */
  aceitarEmissao: boolean;
  /** O **pedido** de revogação é aceito? */
  aceitarPedidoDeRevogacao: boolean;
  /** A revogação se confirma na primeira sondagem? */
  confirmarRevogacao: boolean;
  /**
   * A consulta de situação é respondida? (T14)
   *
   * O padrão é `false`, e ele é **exatamente** o comportamento que os casos da T13 já observavam: a
   * consulta registra a operação e recusa. Só os casos que exercitam a re-obtenção da CA-08 o ligam,
   * e o `beforeEach` o devolve ao padrão — nenhum caso anterior muda de comportamento.
   */
  responderConsulta: boolean;
}

/** O estado do par instrumentado — mutável por caso, como o destino do par de `certificado-…`. */
const roteiro: RoteiroDoProvedor = {
  operacoes: [],
  emitidos: [],
  aceitarEmissao: true,
  aceitarPedidoDeRevogacao: true,
  confirmarRevogacao: true,
  responderConsulta: false,
};

/** Quantos títulos o "provedor" já atribuiu — a sequência DELE, e não a do produto. */
let titulosAtribuidos = 0;

/**
 * A porta de cobrança do arranjo — implementação anotada com o tipo, e não `vi.mock`.
 *
 * Ela entra por `overrideProvider(TOKEN_PORTA_DE_COBRANCA_BANCARIA)`, pelo mecanismo do arcabouço de
 * teste, e **não** por caminho aberto no código de produção. O que ela devolve na emissão é derivado
 * de uma sequência **própria** — a do provedor —, deliberadamente independente do
 * `identificadorNoProvedor` que o produto compõe e envia: derivá-la dele faria os dois eixos do
 * CT-931 serem o mesmo fato, e a asserção sobre o segundo passaria a ser implicada pela do primeiro.
 */
const portaDoProvedor: AdaptadorCobrancaBancaria = {
  emitir: async (pedido: PedidoDeEmissao): Promise<DesfechoDaOperacao<BoletoEmitido>> => {
    roteiro.operacoes.push('emitir');

    if (!roteiro.aceitarEmissao) {
      return { aceito: false, classe: 'DA_COBRANCA', motivo: RECUSA_DA_EMISSAO };
    }

    titulosAtribuidos += 1;
    const emitido: BoletoEmitido = {
      numeroDoTituloNoProvedor: `1700000000${String(titulosAtribuidos).padStart(3, '0')}`,
      // Os três campos variam **por emissão**, e a variação é o que dá conteúdo à igualdade do
      // CT-932: um valor fixo faria "publicou o que o provedor atribuiu" ser satisfeito por uma
      // gravação que devolvesse o de outra cobrança.
      linhaDigitavel: `75691.11223 34455.667788 99001.1223${String(titulosAtribuidos).padStart(2, '0')} 5 99230000012345`,
      codigoDeBarras: `756919923000001234511122334455667788990011${String(titulosAtribuidos).padStart(2, '0')}`,
      // Bytes reconhecíveis, e o valor do pedido dentro deles: um documento que fosse o mesmo para
      // todas as emissões não distinguiria a segunda gravação da primeira na guarda.
      documento: Buffer.from(`%PDF-1.4 boleto ${pedido.identificadorNoProvedor}`),
    };

    roteiro.emitidos.push(emitido);

    return { aceito: true, valor: emitido };
  },

  solicitarRevogacaoDeBoleto: async (): Promise<DesfechoDaOperacao<void>> => {
    roteiro.operacoes.push('solicitarRevogacaoDeBoleto');

    return roteiro.aceitarPedidoDeRevogacao
      ? { aceito: true, valor: undefined }
      : { aceito: false, classe: 'DA_COBRANCA', motivo: 'titulo ja liquidado nao admite baixa' };
  },

  confirmarRevogacaoDeBoleto: async (): Promise<DesfechoDaOperacao<boolean>> => {
    roteiro.operacoes.push('confirmarRevogacaoDeBoleto');

    return { aceito: true, valor: roteiro.confirmarRevogacao };
  },

  consultarSituacao: async (
    consulta: ConsultaDeSituacao,
  ): Promise<DesfechoDaOperacao<SituacaoConsultada>> => {
    // Nenhum dos casos da T13 consulta pela ROTA — a consulta daquela task é do percurso da
    // conferência, que os casos chamam com um par próprio. Ela registra a operação em vez de
    // levantar: uma chamada inesperada aparece na igualdade da sequência, nomeada, em vez de derrubar
    // o SUT. É esse o comportamento do PADRÃO, e ele é o de antes da T14, byte a byte.
    roteiro.operacoes.push('consultarSituacao');

    if (!roteiro.responderConsulta) {
      return { aceito: false, classe: 'DA_COBRANCA', motivo: RECUSA_DA_CONSULTA };
    }

    // ---------------------------------------------------------------------------------------
    // A re-obtenção da CA-08: o documento é o do TÍTULO consultado, e o sinalizador é HONRADO
    // ---------------------------------------------------------------------------------------
    //
    // O par devolve os bytes **daquela** emissão, achados pelo número do título — é o que o provedor
    // real faz, e é o que dá conteúdo à igualdade byte a byte do `CT-920`: um documento fixo faria
    // "os mesmos bytes" ser satisfeito pelo documento de outra cobrança.
    //
    // ⚠️ **`incluirDocumento` é honrado, e não asserido à parte**: pedindo `false`, o par devolve
    // `documento: null`, a rota responde `503` e o `CT-920` reprova pelo status. Uma asserção
    // separada sobre o sinalizador seria implicada pelas que já estão escritas — o antipadrão da
    // asserção tautológica.
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
        documento: consulta.incluirDocumento ? emitido.documento : null,
      },
    };
  },
};

/**
 * O segredo que atravessa a porta da conferência, opaco (ADR-0032).
 *
 * Construído pelo caminho público de `@sysloc/shared`, e nada neste arquivo o abre. Ele é o segredo da
 * **chamada de conferência que o caso faz**, e não o da rota: aquele o produto decifra sozinho, a
 * partir do certificado que o arranjo registrou.
 */
const SEGREDO_DA_CONFERENCIA = criarSegredoOperavel({
  material: Buffer.from('material-da-conferencia-do-ct931'),
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
    // A porta de cobrança entra pelo arcabouço de teste — ver o cabeçalho para por que a produção
    // não ganhou bandeira nem parâmetro.
    .overrideProvider(TOKEN_PORTA_DE_COBRANCA_BANCARIA)
    .useValue(portaDoProvedor)
    .compile();

  aplicacao = modulo.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
  // Sem as exclusões da aplicação real, de propósito: nenhum caso deste arquivo toca as rotas de
  // saúde nem o contrato publicado, e reproduzir a lista aqui criaria uma segunda cópia dela livre
  // para divergir.
  aplicacao.setGlobalPrefix(PREFIXO_DE_VERSAO);
  await aplicacao.listen({ port: porta, host: ENDERECO_DE_ESCUTA });

  cookie = await entrar(QUEM_AGE.email, SENHA_DA_CARGA);
  await conceder(QUEM_AGE.id, EMPRESA_A.id, CHAVES_DO_ARRANJO);

  // Precondição AFIRMADA, e não suposta: sem estas linhas, um `403` nas duas rotas de boleto seria
  // indistinguível de um defeito delas — e é justamente a **conjunção** que elas exigem.
  const sessao = (await pedir(CAMINHO_DA_SESSAO_CORRENTE, { cookie })).corpo as SessaoPublicada;

  expect(sessao.telas).toContain(AREA_DO_FINANCEIRO);
  expect(sessao.acoes).toContain(ACAO_DE_EMISSAO);
  expect(sessao.acoes).toContain(ACAO_DE_BAIXA);

  // -------------------------------------------------------------------------------------------
  // A sessão da EMPRESA B — a que nunca registra certificado neste arquivo
  // -------------------------------------------------------------------------------------------
  //
  // Ela é `ADMIN_EMPRESA` de propósito: a matriz do perfil já concede o catálogo inteiro, de modo
  // que nenhum ajuste é escrito para ela e o `422` que o `CT-918 (b)` mede é atribuível **só** à
  // ausência de certificado — nunca a uma chave que faltasse. É a mesma escolha, e a mesma razão, de
  // `certificado-do-provedor.e2e.spec.ts`, onde a empresa B tem o mesmo papel.
  // A pessoa é de fato de OUTRA empresa — afirmado contra a carga, e não suposto pelo e-mail: se a
  // carga passasse a semeá-la na empresa A, a metade (c) do `CT-918 (b)` mediria a mesma empresa que
  // os demais casos configuram, e o acoplamento que ela remove voltaria em silêncio.
  expect(QUEM_ADMINISTRA_EM_B.empresaId).toBe(EMPRESA_B.id);
  expect(QUEM_ADMINISTRA_EM_B.empresaId).not.toBe(EMPRESA_A.id);
  expect(QUEM_NAO_ALCANCA_AS_ACOES.empresaId).toBe(EMPRESA_A.id);

  cookieDeB = await entrar(QUEM_ADMINISTRA_EM_B.email, SENHA_DA_CARGA);

  const sessaoDeB = (await pedir(CAMINHO_DA_SESSAO_CORRENTE, { cookie: cookieDeB }))
    .corpo as SessaoPublicada;

  expect(sessaoDeB.telas).toContain(AREA_DO_FINANCEIRO);
  expect(sessaoDeB.telas).toContain(AREA_DAS_INTEGRACOES_BANCARIAS);
  expect(sessaoDeB.acoes).toContain(ACAO_DE_EMISSAO);

  // -------------------------------------------------------------------------------------------
  // A sessão que TEM a área e NÃO tem as duas ações — o sujeito do `CT-918 (e)`
  // -------------------------------------------------------------------------------------------
  //
  // O sujeito é `ADMIN_EMPRESA` da empresa A, e por isso a **retirada** é o único ajuste possível: a
  // matriz do perfil concede as 17 chaves, e conceder de novo não produziria efetivo nenhum. Negar
  // **só as duas ações** deixa `TELA:financeiro` valendo pelo perfil, que é exatamente o efetivo que
  // discrimina — uma sessão sem a área seria recusada nas duas rotas mesmo que elas exigissem
  // apenas a área, e o caso não diria nada sobre a conjunção.
  //
  // A `RN-02` não é violada: `validarCoerenciaDeAjustes` recusa o efetivo que deixasse **ação
  // concedida sem a tela que a comporta**, e aqui as ações saem enquanto a tela fica.
  cookieSemAsAcoes = await entrar(QUEM_NAO_ALCANCA_AS_ACOES.email, SENHA_DA_CARGA);
  await ajustar(QUEM_NAO_ALCANCA_AS_ACOES.id, EMPRESA_A.id, [
    { chave: ACAO_DE_EMISSAO, efeito: 'NEGADA' },
    { chave: ACAO_DE_BAIXA, efeito: 'NEGADA' },
  ]);

  const sessaoSemAsAcoes = (await pedir(CAMINHO_DA_SESSAO_CORRENTE, { cookie: cookieSemAsAcoes }))
    .corpo as SessaoPublicada;

  expect(sessaoSemAsAcoes.telas).toContain(AREA_DO_FINANCEIRO);
  expect(sessaoSemAsAcoes.acoes).not.toContain(ACAO_DE_EMISSAO);
  expect(sessaoSemAsAcoes.acoes).not.toContain(ACAO_DE_BAIXA);
}, LIMITE_DE_MONTAGEM_MS);

/**
 * O roteiro do par instrumentado volta ao neutro **ANTES** de cada caso.
 *
 * Ele é estado compartilhado do arranjo, e a reposição vivia na última linha do corpo do caso que o
 * alterava — posição que **vaza quando o caso reprova antes dela**, deixando o par recusando para
 * todos os seguintes e transformando uma falha em cascata de falhas que nomeiam o defeito errado.
 * Aqui a limpeza é robusta ao caso anterior ter reprovado, e nenhum caso precisa do preâmbulo
 * defensivo para se proteger do vizinho.
 *
 * Os casos seguem declarando o roteiro que **eles** querem — `aceitarEmissao = false` no `CT-918`,
 * por exemplo —, e a zeragem de `operacoes` no meio do corpo continua sendo do caso, porque ali ela
 * não é limpeza: é o recorte do trecho que a igualdade de sequência mede.
 */
beforeEach(() => {
  roteiro.operacoes = [];
  roteiro.aceitarEmissao = true;
  roteiro.aceitarPedidoDeRevogacao = true;
  roteiro.confirmarRevogacao = true;
  roteiro.responderConsulta = false;
});

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

describe('os dois atos sobre o boleto da cobrança (T13)', () => {
  it(
    'CT-918 (b) — as recusas de entrada, de configuração e de estado acontecem SEM falar com o provedor',
    async () => {
      // ⚠️ **Este caso NÃO depende de posição.** A metade (c) mede a empresa **sem certificado
      // registrado**, e o certificado é por empresa e persiste no banco do arranjo — medi-la contra a
      // empresa A obrigaria este caso a correr antes de todos os que registram, e a precondição
      // seria **posicional**. Ela corre contra a **empresa B**, que arquivo nenhum aqui configura, e
      // a ausência é AFIRMADA pela rota de consulta antes do ato: o acoplamento deixa de existir, em
      // vez de ficar audível.
      const contrato = await contratoAtivo();
      roteiro.operacoes = [];

      // ---------------------------------------------------------------------------------------
      // (a) código MALFORMADO — `422` nomeando o campo, e sem tocar o banco
      // ---------------------------------------------------------------------------------------
      //
      // A recusa é da forma, e acontece antes de a unidade de trabalho abrir: um código malformado
      // que virasse `404` teria custado uma ida ao banco, e faria da forma do identificador um
      // oráculo de existência.
      const malformado = await pedir(rotaDaEmissao('COB-XX'), {
        metodo: 'POST',
        cookie,
        corpo: {},
      });

      expect(malformado.status).toBe(422);
      expect((malformado.corpo as { campo?: string }).campo).toBe('codigo');

      // ---------------------------------------------------------------------------------------
      // (b) cobrança INEXISTENTE — `404` com o corpo canônico, por igualdade de objeto inteiro
      // ---------------------------------------------------------------------------------------
      //
      // O código é bem formado de propósito: um malformado seria recusado com `422` antes de
      // qualquer consulta, e mediria a validação em vez da recusa por ausência.
      const inexistente = await pedir(rotaDaEmissao(COBRANCA_INEXISTENTE), {
        metodo: 'POST',
        cookie,
        corpo: {},
      });

      expect(inexistente.status).toBe(404);
      expect(inexistente.corpo).toEqual({
        codigo: CODIGO_DE_RECURSO_NAO_ENCONTRADO,
        mensagem: MENSAGEM_DE_NAO_ENCONTRADO,
        campo: 'codigo',
      });

      // ---------------------------------------------------------------------------------------
      // (c) empresa SEM CERTIFICADO — `422` dizendo o que falta, e nada é pedido ao provedor
      // ---------------------------------------------------------------------------------------
      //
      // A empresa é a **B**, e a cobrança é montada pelas rotas reais com a sessão dela: é o que
      // torna a recusa uma afirmação sobre uma empresa de fato não configurada, e não sobre um
      // instante da empresa A anterior ao primeiro registro.
      const contratoDeB = await contratoAtivo(cookieDeB);
      const semCertificado = (await lancar(contratoDeB, cookieDeB)).codigo;

      // A precondição, AFIRMADA pela BORDA e não suposta: a consulta da empresa B responde `404`
      // porque ela nunca registrou nada. Sem esta linha, o `422` abaixo seria compatível com uma
      // empresa configurada cuja emissão falhasse por outro motivo — e a metade voltaria a depender
      // do que os outros casos fizeram antes dela.
      expect((await pedir(ROTA_DA_CONSULTA_DE_CERTIFICADO, { cookie: cookieDeB })).status).toBe(
        404,
      );

      const recusaDeConfiguracao = await pedir(rotaDaEmissao(semCertificado), {
        metodo: 'POST',
        cookie: cookieDeB,
        corpo: {},
      });

      expect(recusaDeConfiguracao.status).toBe(422);
      // **Sem `campo`**, e a ausência faz parte da igualdade: esta recusa não tem culpado no pedido —
      // o corpo é vazio e o código do caminho está correto —, e nomear um mandaria o Admin conferir a
      // cobrança quando o que falta é configuração da empresa.
      expect(recusaDeConfiguracao.corpo).toEqual({
        codigo: CODIGO_DE_CAMPO_INVALIDO,
        mensagem: MENSAGEM_SEM_CERTIFICADO,
        detalhes: { certificado: 'AUSENTE' },
      });

      // ---------------------------------------------------------------------------------------
      // A partir daqui a empresa A TEM certificado — as duas recusas restantes são de estado
      // ---------------------------------------------------------------------------------------
      //
      // As duas voltam a correr **na empresa A**, com uma cobrança dela: o que elas medem é a guarda
      // de estado, e para chegar até ela a empresa precisa estar configurada.
      await registrarCertificadoDaEmpresa('ct918b');
      const emAberto = (await lancar(contrato)).codigo;

      // (d) revogação sobre cobrança **sem título vivo**: a cobrança existe, e o ato não se aplica —
      // `422`, e não `404`, porque o recurso da rota é a cobrança.
      const semBoleto = await pedir(rotaDaRevogacao(emAberto), {
        metodo: 'POST',
        cookie,
        corpo: {},
      });

      expect(semBoleto.status).toBe(422);
      expect(semBoleto.corpo).toEqual({
        codigo: CODIGO_DE_CAMPO_INVALIDO,
        mensagem: MENSAGEM_SEM_BOLETO_A_REVOGAR,
        campo: 'codigo',
        detalhes: { boleto: 'SEM_BOLETO' },
      });

      // (e) emissão sobre cobrança **já liquidada**: a guarda de estado nomeia o estado atual, e o
      // pagamento é acusado pela ROTA real — marcar `pago_em` por escrita privilegiada montaria o
      // estado por fora da regra que o próprio caso observa.
      const pagamento = await pedir(rotaDoPagamento(emAberto), {
        metodo: 'POST',
        cookie,
        corpo: { pagoEm: await dataDeslocada(0), valorPago: VALOR_DA_COBRANCA },
      });

      expect(pagamento.status).toBe(200);

      const liquidada = await pedir(rotaDaEmissao(emAberto), {
        metodo: 'POST',
        cookie,
        corpo: {},
      });

      expect(liquidada.status).toBe(422);
      expect(liquidada.corpo).toEqual({
        codigo: CODIGO_DE_CAMPO_INVALIDO,
        mensagem: MENSAGEM_DE_CAMPO_INVALIDO,
        campo: 'codigo',
        detalhes: { estadoAtual: 'PAGA', transicaoPedida: 'EMISSAO_DE_BOLETO' },
      });

      // ---------------------------------------------------------------------------------------
      // NENHUMA das cinco recusas falou com o provedor — a asserção que liga todas
      // ---------------------------------------------------------------------------------------
      //
      // É o invariante que a §3.2 fixa: as recusas que não custam rede acontecem na metade
      // transacional, antes de o ato externo começar. Sem esta linha, uma borda que pedisse a
      // emissão e só então conferisse o estado passaria em todas as igualdades acima — e teria
      // registrado um título no provedor para uma cobrança já paga.
      expect(roteiro.operacoes).toEqual([]);
    },
    LIMITE_CASO_MS,
  );

  it(
    'CT-918 (d) — certificado VENCIDO recusa a emissão com 422 nomeando a data, e não fala com o provedor',
    async () => {
      // A empresa A registra um certificado **pela rota real**, e só então a linha é envelhecida:
      // é a única forma de produzir o estado, e a razão está em {@link envelhecerOCertificadoVigente}.
      await registrarCertificadoDaEmpresa('ct918d');
      const contrato = await contratoAtivo();
      const codigo = (await lancar(contrato)).codigo;

      const validoAte = await envelhecerOCertificadoVigente();

      // A precondição, AFIRMADA pela BORDA: a consulta publica `VENCIDO`. Sem ela, o `422` abaixo
      // seria compatível com uma empresa **sem** certificado — que é a outra recusa, com outro corpo
      // — e o caso mediria o ramo errado.
      expect(await estadoDoCertificado(cookie)).toBe(ESTADO_VENCIDO);

      roteiro.operacoes = [];

      const recusa = await pedir(rotaDaEmissao(codigo), { metodo: 'POST', cookie, corpo: {} });

      // ---------------------------------------------------------------------------------------
      // O envelope, por OBJETO INTEIRO — e **sem `campo`**, que é a distinção deliberada
      // ---------------------------------------------------------------------------------------
      //
      // As duas recusas de configuração não têm culpado no pedido — o corpo é vazio e o código do
      // caminho está correto —, e nomear `codigo` mandaria o Admin conferir a cobrança quando o que
      // falta é **renovar** o certificado da empresa. A igualdade de objeto é o que faz um `campo`
      // que aparecesse reprovar aqui.
      //
      // ⚠️ A mensagem é a **do vencido**, e não a da ausência: colapsar as duas — que é a saída curta
      // para quem tratasse o vencido como "não tem" — mandaria o Admin registrar um certificado que
      // ele já registrou. E `detalhes.validoAte` é o instante **da linha**, lido pelo `RETURNING` do
      // arranjo: uma data derivada de outro eixo (o relógio do processo, por exemplo) reprova aqui.
      expect(recusa.status).toBe(422);
      expect(recusa.corpo).toEqual({
        codigo: CODIGO_DE_CAMPO_INVALIDO,
        mensagem: MENSAGEM_DO_CERTIFICADO_VENCIDO,
        detalhes: { validoAte: validoAte.toISOString() },
      });

      // A recusa acontece na metade transacional, **antes** de qualquer ida ao provedor: sem esta
      // linha, uma borda que pedisse a emissão e só então lesse a vigência passaria na igualdade
      // acima — e teria registrado um título no provedor com identidade vencida.
      expect(roteiro.operacoes).toEqual([]);

      // E nada foi gravado: a cobrança continua sem título.
      expect(await numeroDoTituloGravado(codigo)).toBeNull();
    },
    LIMITE_CASO_MS,
  );

  it(
    'CT-918 (e) — quem TEM a área e NÃO tem a ação recebe 403 nomeando a ação, e nada muda',
    async () => {
      await registrarCertificadoDaEmpresa('ct918e');
      const codigo = await cobrancaComBoleto();

      const numeroAntes = await numeroDoTituloGravado(codigo);
      const trilhaAntes = await lerTrilha(codigo);

      roteiro.operacoes = [];

      // ---------------------------------------------------------------------------------------
      // O CONTROLE POSITIVO vem PRIMEIRO: a mesma sessão alcança a cobrança pela área
      // ---------------------------------------------------------------------------------------
      //
      // Sem ele, os dois `403` abaixo seriam compatíveis com uma sessão quebrada, ou com uma que não
      // alcança nada da superfície — e o caso não diria nada sobre a **conjunção**. A leitura exige
      // só `TELA:financeiro`, que este sujeito tem.
      const leitura = await pedir(`${COLECAO_DE_COBRANCAS}/${codigo}`, {
        cookie: cookieSemAsAcoes,
      });

      expect(leitura.status).toBe(200);

      // ---------------------------------------------------------------------------------------
      // As DUAS rotas recusam, cada uma nomeando a AÇÃO que falta — e são ações DIFERENTES
      // ---------------------------------------------------------------------------------------
      //
      // ⚠️ **É o caso que reprova a perda da chave de ação.** Trocar
      // `@ExigeChaves(AREA_DO_FINANCEIRO, ACAO_…)` por `@ExigeChave(AREA_DO_FINANCEIRO)` no
      // controlador faria estas duas chamadas **atravessarem a guarda** — a sessão tem a área —, e a
      // emissão seguiria adiante para quem não pode movê-la. Nenhuma outra prova desta base pega
      // isso: o conjunto `comExigencia` continuaria idêntico, `semDeclaracao` continuaria vazio, e a
      // coerência do catálogo esconde a perda do lado da área, porque
      // `MAPA_ACAO_TELA['ACAO:emitir_boleto']` **é** `TELA:financeiro`. O eixo estrutural irmão é o
      // `CT-918 (f)`, em `cobertura-de-autorizacao.e2e.spec.ts`.
      //
      // E `detalhes.exigido` nomeia a **PRIMEIRA** chave ausente na ordem declarada (ADR-0018): como
      // o sujeito TEM a área, o que ele ouve é o nome da **ação** — uma conjunção declarada na ordem
      // trocada nomearia a área e reprovaria aqui.
      const emissaoRecusada = await pedir(rotaDaEmissao(codigo), {
        metodo: 'POST',
        cookie: cookieSemAsAcoes,
        corpo: {},
      });

      expect(emissaoRecusada.status).toBe(403);
      expect(emissaoRecusada.corpo).toEqual({
        codigo: CODIGO_DE_ACESSO_NEGADO,
        mensagem: MENSAGEM_DE_ACESSO_NEGADO,
        detalhes: { exigido: ACAO_DE_EMISSAO },
      });

      const revogacaoRecusada = await pedir(rotaDaRevogacao(codigo), {
        metodo: 'POST',
        cookie: cookieSemAsAcoes,
        corpo: {},
      });

      expect(revogacaoRecusada.status).toBe(403);
      // A ação nomeada é a **da revogação**, e não a da emissão: é esta linha que acusa a rota que
      // declarasse a ação da vizinha por cópia — com as duas chaves negadas no sujeito, uma exigência
      // trocada continuaria respondendo `403`, e só a igualdade do corpo as separa.
      expect(revogacaoRecusada.corpo).toEqual({
        codigo: CODIGO_DE_ACESSO_NEGADO,
        mensagem: MENSAGEM_DE_ACESSO_NEGADO,
        detalhes: { exigido: ACAO_DE_BAIXA },
      });

      // ---------------------------------------------------------------------------------------
      // E NADA aconteceu: nem no provedor, nem no banco, nem na trilha
      // ---------------------------------------------------------------------------------------
      //
      // A recusa sozinha não prova ausência de efeito: uma guarda que corresse **depois** do ato
      // passaria em tudo acima e reprovaria aqui.
      expect(roteiro.operacoes).toEqual([]);
      expect(await numeroDoTituloGravado(codigo)).toBe(numeroAntes);
      expect((await lerTrilha(codigo)).length).toBe(trilhaAntes.length);

      // O controle que impede o caso de medir o nada: a cobrança TINHA título vivo, de modo que a
      // revogação recusada é uma revogação que teria o que revogar.
      expect(numeroAntes).not.toBeNull();
    },
    LIMITE_CASO_MS,
  );

  it(
    'CT-918 (c) — revogação pedida e NÃO confirmada dentro do teto não apaga nada, e declara o estado',
    async () => {
      await registrarCertificadoDaEmpresa('ct918c');
      const codigo = await cobrancaComBoleto();

      const numeroAntes = await numeroDoTituloGravado(codigo);
      const trilhaAntes = await lerTrilha(codigo);

      // O provedor **recusa o pedido** de revogação: é a classe de falha que não melhora repetindo, e
      // por isso o ato desiste em vez de sondar. O outro caminho — pedido aceito e confirmação que
      // não vem — é o mesmo desfecho publicado, e custaria os doze segundos do teto para medir.
      roteiro.aceitarPedidoDeRevogacao = false;
      roteiro.operacoes = [];

      const resposta = await pedir(rotaDaRevogacao(codigo), { metodo: 'POST', cookie, corpo: {} });

      expect(resposta.status).toBe(503);
      expect(resposta.corpo).toEqual({
        codigo: CODIGO_DE_SERVICO_INDISPONIVEL,
        mensagem: `${MENSAGEM_DA_REVOGACAO_INCOMPLETA} ${codigo}`,
        detalhes: { revogacao: 'PEDIDA_NAO_CONFIRMADA' },
      });

      // NADA foi apagado: o título continua sendo o mesmo, e é isso que mantém a cobrança dentro do
      // conjunto que a conferência seguinte apura junto ao provedor.
      expect(await numeroDoTituloGravado(codigo)).toBe(numeroAntes);
      expect((await lerCobranca(codigo)).numeroDoTituloNoProvedor).toBe(numeroAntes);

      // E a trilha NÃO cresce: a ADR-0034 mantém fora dela a tentativa que não mudou estado algum.
      expect((await lerTrilha(codigo)).length).toBe(trilhaAntes.length);

      // A sondagem não chegou a acontecer — o pedido recusado interrompe o ato.
      expect(roteiro.operacoes).toEqual(['solicitarRevogacaoDeBoleto']);

      // A reposição do roteiro NÃO fica aqui: ela é do `beforeEach`, que limpa antes de cada caso e
      // por isso é robusto a este caso reprovar antes da última linha — ver o docblock de lá.
    },
    LIMITE_CASO_MS,
  );

  it(
    'CT-918 (g) — a revogação confirmada responde 200 mesmo quando os bytes do boleto não podem ser apagados',
    async () => {
      await registrarCertificadoDaEmpresa('ct918g');
      const codigo = await cobrancaComBoleto();

      const numeroAntes = await numeroDoTituloGravado(codigo);
      const trilhaAntes = await lerTrilha(codigo);

      // ---------------------------------------------------------------------------------------
      // A precondição: sobre este alvo, `apagar` FALHA — e com falha que NÃO é ausência
      // ---------------------------------------------------------------------------------------
      //
      // O arquivo que a emissão gravou dá lugar a um **diretório** de mesmo nome: `unlink` sobre
      // diretório recusa em qualquer privilégio, e nenhuma das duas recusas é o `ENOENT` que a
      // guarda engole. É a fronteira REAL — nada aqui dubla a guarda, que é a coisa sob prova da
      // fatia —, e é o que reproduz, no que o caso alcança, a remontagem somente leitura e a falha
      // de mídia que produzem a mesma classe em operação.
      const arquivoDoBoleto = join(diretorioDosBoletos(), `${codigo}${EXTENSAO_DO_BOLETO}`);

      expect((await stat(arquivoDoBoleto)).isFile()).toBe(true);
      await rm(arquivoDoBoleto);
      await mkdir(arquivoDoBoleto);

      // E a falha é **afirmada**, não suposta: sem esta medição o caso passaria igual num alvo que
      // `apagar` removesse sem reclamar, e mediria o nada. Quem a produz é a guarda real, com o
      // mesmo diretório da aplicação.
      const recusa = await codigoDaFalhaAoApagar(codigo);

      expect(recusa).not.toBe(CODIGO_DE_AUSENCIA);
      expect(RECUSAS_DE_APAGAR_UM_DIRETORIO).toContain(recusa);

      roteiro.operacoes = [];

      const resposta = await pedir(rotaDaRevogacao(codigo), { metodo: 'POST', cookie, corpo: {} });

      // ---------------------------------------------------------------------------------------
      // O ato se completou, e é isso que a resposta diz
      // ---------------------------------------------------------------------------------------
      //
      // É esta asserção que discrimina: com a falha do acessório determinando o desfecho, o filtro
      // global publicaria `ERRO_INTERNO` sobre `500` — *erro interno* a respeito de um ato que
      // valeu —, e a retentativa cairia no `422` de *"esta cobrança não tem boleto a revogar"*, que
      // diz o oposto do que aconteceu.
      expect(resposta.status).toBe(200);

      const publicada = resposta.corpo as CobrancaPublicada;

      // O corpo é a cobrança **sem título**, e as chaves são as mesmas vinte e três: a resposta do
      // caminho acessório-que-falhou não é um corpo diferente do caminho feliz.
      expect(chavesDe(publicada)).toEqual(CHAVES_PUBLICADAS);
      expect(publicada.codigo).toBe(codigo);
      expect(camposDeEmissaoPublicados(publicada)).toEqual({
        numeroDoTituloNoProvedor: null,
        linhaDigitavel: null,
        codigoDeBarras: null,
      });
      // Revogar boleto **não** cancela cobrança: ela segue em aberto, e é isso que a mantém no
      // conjunto do lote seguinte.
      expect(publicada.status).toBe('A_VENCER');
      expect(publicada.canceladoEm).toBeNull();

      // As duas etapas junto ao provedor, e nada além — a revogação não emite nada no lugar.
      expect(roteiro.operacoes).toEqual([
        'solicitarRevogacaoDeBoleto',
        'confirmarRevogacaoDeBoleto',
      ]);

      // O estado em repouso, pela leitura crua; e o controle antivácuo, sem o qual *"ficou nulo"*
      // seria satisfeito por uma cobrança que nunca teve boleto.
      expect(await numeroDoTituloGravado(codigo)).toBeNull();
      expect(numeroAntes).not.toBeNull();

      // A trilha ganha EXATAMENTE um evento — o fato de negócio que a unidade commitou **antes** do
      // acessório. A contagem exata separa *"registrou o que devia"* de *"registrou mais alguma
      // coisa por causa da falha"*.
      const trilhaDepois = await lerTrilha(codigo);

      expect(trilhaDepois.length - trilhaAntes.length).toBe(1);
      expect(trilhaDepois.slice(0, 1)).toEqual([
        { tipo: 'BOLETO_REVOGADO', origem: 'ATO_DO_ADMIN', diagnostico: null },
      ]);

      // E o preço que o ato declara por escrito: o alvo continua em disco, órfão e benigno. Ele
      // permanece porque o nome é derivado do código, e a emissão seguinte o sobrescreve.
      expect((await stat(arquivoDoBoleto)).isDirectory()).toBe(true);
    },
    LIMITE_CASO_MS,
  );

  it(
    'CT-918 — revogação confirmada com emissão que falha deixa a cobrança SEM boleto, declarado e nomeado',
    async () => {
      await registrarCertificadoDaEmpresa('ct918');
      const codigo = await cobrancaComBoleto();

      const trilhaAntes = await lerTrilha(codigo);
      const numeroAnterior = await numeroDoTituloGravado(codigo);

      // O roteiro do ato: a revogação é pedida, confirma na primeira sondagem, e a emissão do novo
      // título é recusada pelo provedor. É o desfecho literal da CA-06.
      roteiro.aceitarPedidoDeRevogacao = true;
      roteiro.confirmarRevogacao = true;
      roteiro.aceitarEmissao = false;
      roteiro.operacoes = [];

      const resposta = await pedir(rotaDaEmissao(codigo), {
        metodo: 'POST',
        cookie,
        corpo: {},
      });

      // ---------------------------------------------------------------------------------------
      // O envelope, por OBJETO INTEIRO — e a mensagem nomeando a cobrança pelo código
      // ---------------------------------------------------------------------------------------
      //
      // Objeto inteiro, e nunca por presença de campo: é a igualdade que faz um `campo` que
      // aparecesse, ou um `detalhes` que colapsasse os dois desfechos num só, reprovarem aqui.
      expect(resposta.status).toBe(503);
      expect(resposta.corpo).toEqual({
        codigo: CODIGO_DE_SERVICO_INDISPONIVEL,
        mensagem: `${MENSAGEM_DA_EMISSAO_INCOMPLETA} ${codigo}`,
        detalhes: { boleto: 'SEM_BOLETO', revogacao: 'CONFIRMADA' },
      });

      // ---------------------------------------------------------------------------------------
      // A ORDEM prova que nunca houve dois títulos vivos
      // ---------------------------------------------------------------------------------------
      //
      // Igualdade de arranjo, e não contenção: a emissão aparece **depois** da confirmação, e é essa
      // posição que torna o invariante observável. Uma implementação que emitisse antes de confirmar
      // — ou em paralelo — produziria o mesmo estado final de banco e reprovaria só aqui.
      expect(roteiro.operacoes).toEqual([
        'solicitarRevogacaoDeBoleto',
        'confirmarRevogacaoDeBoleto',
        'emitir',
      ]);

      // ---------------------------------------------------------------------------------------
      // O estado em repouso: sem boleto, e ainda EM ABERTO
      // ---------------------------------------------------------------------------------------
      const publicada = await lerCobranca(codigo);

      expect(publicada.numeroDoTituloNoProvedor).toBeNull();
      expect(publicada.pagoEm).toBeNull();
      expect(publicada.canceladoEm).toBeNull();
      // O estado derivado continua sendo o de uma cobrança que ninguém pagou nem cancelou: revogar
      // boleto **não** cancela cobrança, e é isso que a mantém no conjunto do lote seguinte.
      expect(publicada.status).toBe('A_VENCER');
      // E o número anterior existia de fato — sem esta linha, "ficou nulo" seria satisfeito por uma
      // cobrança que nunca teve boleto, e o caso mediria o nada.
      expect(numeroAnterior).not.toBeNull();

      // ---------------------------------------------------------------------------------------
      // A trilha: EXATAMENTE dois eventos novos, na ordem em que aconteceram
      // ---------------------------------------------------------------------------------------
      //
      // A leitura vem em ordem decrescente de instante, de modo que os dois novos são os primeiros.
      // A contagem exata é o que separa *"registrou o que devia"* de *"registrou o que devia mais uma
      // tentativa"* — a ADR-0034 mantém a tentativa fora da trilha publicada.
      const trilhaDepois = await lerTrilha(codigo);

      expect(trilhaDepois.length - trilhaAntes.length).toBe(2);
      expect(trilhaDepois.slice(0, 2)).toEqual([
        {
          tipo: 'EMISSAO_RECUSADA',
          origem: 'ATO_DO_ADMIN',
          // O texto do provedor viaja INTACTO até o diagnóstico (RN-15) — e **não** entra no corpo
          // da resposta, como a igualdade do envelope acima já afirmou.
          diagnostico: RECUSA_DA_EMISSAO,
        },
        { tipo: 'BOLETO_REVOGADO', origem: 'ATO_DO_ADMIN', diagnostico: null },
      ]);
    },
    LIMITE_CASO_MS,
  );

  it(
    'CT-931 — emitir de novo depois da revogação pela conferência ocorre como a primeira vez',
    async () => {
      await registrarCertificadoDaEmpresa('ct931');
      const codigo = await cobrancaComBoleto();

      const numeroAnterior = await numeroDoTituloGravado(codigo);
      const identificadorAnterior = await identificadorGravado(codigo);

      // ---------------------------------------------------------------------------------------
      // A revogação vem da CONFERÊNCIA REAL — o percurso da T12, com as portas de `@sysloc/db`
      // ---------------------------------------------------------------------------------------
      await conferirComProvedorQueRevoga(codigo);

      // A precondição é AFIRMADA: sem esta linha, um caso em que a conferência não revogasse nada
      // mediria a emissão sobre uma cobrança que ainda tem título — que é o outro caminho, o do
      // CT-918 —, e a igualdade de sequência abaixo passaria a significar outra coisa.
      expect(await numeroDoTituloGravado(codigo)).toBeNull();

      const trilhaAntes = await lerTrilha(codigo);

      roteiro.aceitarEmissao = true;
      roteiro.operacoes = [];

      const resposta = await pedir(rotaDaEmissao(codigo), { metodo: 'POST', cookie, corpo: {} });

      expect(resposta.status).toBe(200);

      // ---------------------------------------------------------------------------------------
      // EXATAMENTE `['emitir']` — sem etapa de revogação supérflua
      // ---------------------------------------------------------------------------------------
      //
      // É a asserção central da CA-18: não havendo título vivo, não há o que revogar, e pedir a
      // revogação de um boleto inexistente gastaria duas idas ao provedor para receber recusa. A
      // igualdade de arranjo é o que a torna verdadeira nos dois sentidos.
      expect(roteiro.operacoes).toEqual(['emitir']);

      // ---------------------------------------------------------------------------------------
      // Os DOIS eixos, medidos separadamente — eles são coisas distintas
      // ---------------------------------------------------------------------------------------
      //
      // `numero_do_titulo_no_provedor` é o que o **provedor** atribuiu; `identificador_no_provedor` é o que **o
      // produto** compôs e enviou (ADR-0033). Nenhum é derivado do outro no arranjo — o primeiro sai
      // da sequência do par instrumentado, o segundo do contador do banco —, e por isso a segunda
      // asserção não é implicada pela primeira.
      const numeroNovo = await numeroDoTituloGravado(codigo);
      const identificadorNovo = await identificadorGravado(codigo);

      expect(numeroNovo).not.toBeNull();
      expect(numeroNovo).not.toBe(numeroAnterior);
      expect(identificadorNovo).not.toBeNull();
      expect(identificadorNovo).not.toBe(identificadorAnterior);

      // E o publicado é o mesmo que a coluna guarda: a rota devolve o estado novo, não o anterior.
      expect((await lerCobranca(codigo)).numeroDoTituloNoProvedor).toBe(numeroNovo);

      // ---------------------------------------------------------------------------------------
      // A trilha ganha UM evento, e ele é o da emissão pelo ato do Admin
      // ---------------------------------------------------------------------------------------
      const trilhaDepois = await lerTrilha(codigo);

      expect(trilhaDepois.length - trilhaAntes.length).toBe(1);
      expect(trilhaDepois[0]).toEqual({
        tipo: 'BOLETO_EMITIDO',
        origem: 'ATO_DO_ADMIN',
        diagnostico: null,
      });
    },
    LIMITE_CASO_MS,
  );

  it(
    'CT-932 — os cinco campos de conciliação são publicados nos três estados, e distinguem ausência de valor',
    async () => {
      await registrarCertificadoDaEmpresa('ct932');
      const contrato = await contratoAtivo();
      const codigo = (await lancar(contrato)).codigo;

      // ---------------------------------------------------------------------------------------
      // Estado 1 — recém-criada: as cinco chaves EXISTEM e valem `null`
      // ---------------------------------------------------------------------------------------
      //
      // `null`, e nunca cadeia vazia nem chave omitida: é a diferença entre *"não há boleto"* e
      // *"há um boleto sem número"*, e é ela que o cliente lê para decidir se oferece a segunda via.
      const criada = await lerCobranca(codigo);

      expect(chavesDe(criada)).toEqual(CHAVES_PUBLICADAS);
      for (const campo of [...CAMPOS_DA_EMISSAO, ...CAMPOS_DO_CREDITO]) {
        expect(criada[campo], `${campo} deveria nascer nulo`).toBeNull();
      }

      // ---------------------------------------------------------------------------------------
      // Estado 2 — emitida: os três de emissão preenchidos, os dois de crédito ainda `null`
      // ---------------------------------------------------------------------------------------
      roteiro.aceitarEmissao = true;
      roteiro.operacoes = [];

      expect(
        (await pedir(rotaDaEmissao(codigo), { metodo: 'POST', cookie, corpo: {} })).status,
      ).toBe(200);

      const emitida = await lerCobranca(codigo);

      expect(chavesDe(emitida)).toEqual(CHAVES_PUBLICADAS);
      // ---------------------------------------------------------------------------------------
      // Os TRÊS campos de emissão pelo VALOR que o provedor atribuiu — nunca por "não é nulo"
      // ---------------------------------------------------------------------------------------
      //
      // Byte a byte, e numa igualdade só, contra o boleto que o par instrumentado devolveu **nesta**
      // emissão. `não é nulo` admitiria a cadeia vazia que a CA-19 proíbe — *"`null`, nunca cadeia
      // vazia nem chave omitida"* —, e uma gravação que truncasse `linhaDigitavel` atravessaria o
      // caso inteiro. Os três valores variam por emissão no arranjo, de modo que a igualdade também
      // pega o campo preenchido com o valor de **outra** cobrança.
      expect(camposDeEmissaoPublicados(emitida)).toEqual(camposDeEmissaoAtribuidos());
      for (const campo of CAMPOS_DO_CREDITO) {
        expect(emitida[campo], `${campo} só nasce com o crédito`).toBeNull();
      }

      // ---------------------------------------------------------------------------------------
      // Estado 3 — creditada pela conferência: os dois de crédito com o que o provedor informou
      // ---------------------------------------------------------------------------------------
      //
      // O dia do pagamento sai do relógio do BANCO (ADR-0026), e o crédito é **derivado** dele pelo
      // percurso da conferência — o caso não o escreve em lugar nenhum, e é justamente por isso que
      // a igualdade abaixo mede o percurso, e não o que o arranjo plantou.
      const diaDoPagamento = await dataDeslocada(0);

      await conferirComProvedorQueLiquida(codigo, diaDoPagamento);

      const creditada = await lerCobranca(codigo);

      expect(chavesDe(creditada)).toEqual(CHAVES_PUBLICADAS);
      expect(creditada.dataDoCredito).toBe(diaDoPagamento);
      expect(creditada.valorCreditado).toBe(VALOR_INFORMADO_PELO_PROVEDOR);
      // Os três de emissão continuam onde estavam, **com os mesmos valores**: liquidar não apaga
      // nem reescreve o elo pelo qual o retorno foi reconciliado — é a `DECISÃO FECHADA — F3/T7` de
      // `cobranca.service.ts`, vista pela publicação. A igualdade é contra o mesmo boleto atribuído
      // no estado 2; `não é nulo` deixaria passar uma liquidação que os sobrescrevesse.
      expect(camposDeEmissaoPublicados(creditada)).toEqual(camposDeEmissaoAtribuidos());
      expect(creditada.status).toBe('PAGA');
    },
    LIMITE_CASO_MS,
  );
});

describe('as duas leituras sobre o boleto da cobrança (T14)', () => {
  it(
    'CT-919 — a rota do boleto entrega os bytes com mídia e nome de arquivo, e a cobrança publica linha e código de barras',
    async () => {
      await registrarCertificadoDaEmpresa('ct919');
      const codigo = await cobrancaComBoleto();
      const atribuido = ultimoBoletoEmitido();

      roteiro.operacoes = [];

      const resposta = await pedirBoleto(cookie, codigo);

      // ---------------------------------------------------------------------------------------
      // As DUAS declarações observáveis da ADR-0028: a mídia e o nome sugerido de arquivo
      // ---------------------------------------------------------------------------------------
      //
      // A terceira — o mesmo envelope de erro em todas as falhas — é o `CT-921` e o `CT-920 (b)`.
      expect(resposta.status).toBe(200);
      expect(resposta.tipoDeConteudo).toBe(TIPO_DE_MIDIA_DO_BOLETO);
      expect(resposta.disposicao).toBe(`attachment; filename="${codigo}${EXTENSAO_DO_BOLETO}"`);

      // A âncora de que o corpo é mesmo um documento: sem ela, um corpo vazio satisfaria o cabeçalho.
      expect(textoInicialDe(resposta.bytes)).toBe(ASSINATURA_DO_PDF);

      // E são os bytes que o **provedor** entregou, byte a byte — não um documento qualquer que
      // comece com a assinatura. O oráculo é o outro lado da porta, e o par varia o documento por
      // emissão, de modo que a igualdade também pega o arquivo de outra cobrança.
      expect(Buffer.from(resposta.bytes).equals(atribuido.documento)).toBe(true);

      // NADA foi perguntado ao provedor: o arquivo estava em disco, e a entrega é uma leitura. Sem
      // esta linha, uma rota que consultasse sempre passaria em tudo acima — e cada download custaria
      // uma ida à rede.
      expect(roteiro.operacoes).toEqual([]);

      // ---------------------------------------------------------------------------------------
      // A cobrança publica os DOIS campos do meio de pagamento, com os comprimentos que ele fixa
      // ---------------------------------------------------------------------------------------
      const publicada = await lerCobranca(codigo);

      // A âncora que liga a cobrança lida à emissão DESTE caso — sem ela, os comprimentos abaixo
      // seriam satisfeitos por qualquer cobrança emitida em qualquer momento da suíte.
      expect(publicada.numeroDoTituloNoProvedor).toBe(atribuido.numeroDoTituloNoProvedor);

      // Os comprimentos são conferidos sobre o que a ROTA publica, e não sobre o que o par atribuiu:
      // é a travessia inteira — provedor, gravação, visão, serialização — que precisa preservar as
      // 47 e as 44 posições. Afirmá-los sobre o arranjo mediria o arranjo.
      expect(somenteDigitos(publicada.linhaDigitavel ?? '').length).toBe(
        DIGITOS_DA_LINHA_DIGITAVEL,
      );
      expect(somenteDigitos(publicada.codigoDeBarras ?? '').length).toBe(
        DIGITOS_DO_CODIGO_DE_BARRAS,
      );
    },
    LIMITE_CASO_MS,
  );

  it(
    'CT-920 — arquivo ausente do disco é rebuscado do provedor e reescrito, sem que quem pediu perceba',
    async () => {
      await registrarCertificadoDaEmpresa('ct920');
      const codigo = await cobrancaComBoleto();
      const atribuidos = camposDeEmissaoAtribuidos();
      const trilhaAntes = await lerTrilha(codigo);

      // O controle antivácuo da trilha: a emissão do arranjo gravou UM evento, e é contra este
      // retrato que "nenhum evento novo" passa a significar alguma coisa.
      expect(trilhaAntes).toEqual([
        { tipo: 'BOLETO_EMITIDO', origem: 'ATO_DO_ADMIN', diagnostico: null },
      ]);

      roteiro.operacoes = [];

      const primeiro = await pedirBoleto(cookie, codigo);

      expect(primeiro.status).toBe(200);
      // O primeiro pedido NÃO consulta: é a leitura do arquivo que a emissão gravou. Sem esta linha,
      // "a rebusca aconteceu" não se distinguiria de "a rota sempre rebusca".
      expect(roteiro.operacoes).toEqual([]);

      // ---------------------------------------------------------------------------------------
      // A precondição: o ARQUIVO some do disco, e a coluna NÃO é tocada
      // ---------------------------------------------------------------------------------------
      //
      // O caso opera sobre o filesystem, que é a fronteira; alterar a coluna simularia **outro**
      // defeito — o registro perdido —, e não o que a CA-08 descreve.
      const caminho = arquivoDoBoleto(codigo);

      await rm(caminho);

      // O controle antivácuo do arquivo: sem ele, um caso em que nada tivesse sido apagado passaria
      // trivialmente em tudo o que vem abaixo.
      expect(existsSync(caminho)).toBe(false);

      roteiro.responderConsulta = true;
      roteiro.operacoes = [];

      const segundo = await pedirBoleto(cookie, codigo);

      // ---------------------------------------------------------------------------------------
      // Quem pediu NÃO percebe diferença: mesmo status, mesmos cabeçalhos, mesmos bytes
      // ---------------------------------------------------------------------------------------
      //
      // É esta igualdade byte a byte que discrimina: uma rota que devolvesse `404`, `503` ou um
      // documento diferente do primeiro reprovaria aqui, e nenhuma delas seria visível pelo estado
      // final do banco.
      expect(segundo.status).toBe(200);
      expect(segundo.tipoDeConteudo).toBe(TIPO_DE_MIDIA_DO_BOLETO);
      expect(segundo.disposicao).toBe(`attachment; filename="${codigo}${EXTENSAO_DO_BOLETO}"`);
      expect(Buffer.from(segundo.bytes).equals(Buffer.from(primeiro.bytes))).toBe(true);

      // EXATAMENTE uma consulta ao provedor — nem zero (que seria entregar o nada), nem duas.
      expect(roteiro.operacoes).toEqual(['consultarSituacao']);

      // ---------------------------------------------------------------------------------------
      // O arquivo VOLTOU, com os mesmos bytes — a regravação do cache
      // ---------------------------------------------------------------------------------------
      expect(existsSync(caminho)).toBe(true);
      expect((await readFile(caminho)).equals(Buffer.from(primeiro.bytes))).toBe(true);

      // ---------------------------------------------------------------------------------------
      // E NADA mudou: nem as colunas de conciliação, nem a trilha
      // ---------------------------------------------------------------------------------------
      //
      // As colunas são conferidas contra o que o **par** atribuiu na emissão, e não contra uma
      // releitura de si mesmas. A trilha é comparada inteira: rebuscar cache não é efeito (ADR-0034),
      // e um evento novo aqui encheria o histórico com linhas sobre nada ter acontecido.
      expect(camposDeEmissaoPublicados(await lerCobranca(codigo))).toEqual(atribuidos);
      expect(await lerTrilha(codigo)).toEqual(trilhaAntes);
    },
    LIMITE_CASO_MS,
  );

  it(
    'CT-920 (b) — a rebusca que o provedor recusa responde 503 sem entregar documento e sem mudar nada',
    async () => {
      await registrarCertificadoDaEmpresa('ct920b');
      const codigo = await cobrancaComBoleto();
      const atribuidos = camposDeEmissaoAtribuidos();
      const trilhaAntes = await lerTrilha(codigo);
      const caminho = arquivoDoBoleto(codigo);

      // O controle antivácuo da trilha, igual ao do `CT-920`: a emissão do arranjo gravou UM evento,
      // e é contra este retrato que "nenhum evento novo" passa a significar alguma coisa. Sem ele, a
      // comparação do fim do caso poderia ser duas trilhas vazias — nada contra nada.
      expect(trilhaAntes).toEqual([
        { tipo: 'BOLETO_EMITIDO', origem: 'ATO_DO_ADMIN', diagnostico: null },
      ]);

      await rm(caminho);
      expect(existsSync(caminho)).toBe(false);

      // O par recusa a consulta — é o padrão dele, reposto pelo `beforeEach`, e a linha está escrita
      // para que a intenção do caso não dependa de um valor herdado.
      roteiro.responderConsulta = false;
      roteiro.operacoes = [];

      const resposta = await pedirBoleto(cookie, codigo);

      // ---------------------------------------------------------------------------------------
      // A recusa não se ANUNCIA documento e não CARREGA documento — antes do envelope, e a
      // posição é conteúdo
      // ---------------------------------------------------------------------------------------
      //
      // ⚠️ **Este bloco precede deliberadamente a igualdade de `resposta.corpo`.** A implicação
      // entre os dois corre num sentido só: se o corpo é igual ao envelope, então os bytes
      // desserializaram naquele JSON — e JSON nunca começa por `%PDF-`. Escrita **depois** dela, a
      // asserção sobre os bytes seria consequência lógica da anterior e não poderia reprovar em
      // estado alcançável, que é o AP-29 medido pelo Gate 1 nesta task. Aqui ela é avaliada com
      // apenas o status e a mídia afirmados, e reprova primeiro no estado que persegue: uma rota
      // que anuncia `application/json` e escoa os bytes do documento no corpo assim mesmo.
      //
      // **Quem discrimina o quê**, agora que o acessório não infere corpo do cabeçalho:
      // `tipoDeConteudo` pega o `Content-Type` escrito **antes** da leitura — o defeito que a rota
      // do documento do contrato mediu (`MT-2`) —, porque compara o tipo já canonizado por
      // igualdade; `textoInicialDe` pega a recusa que carrega o documento apesar do cabeçalho
      // correto; e a igualdade abaixo pega o conteúdo do envelope. Nenhuma das três implica outra.
      //
      // `503` e não `500`: quem falhou é o terceiro, e a condição é transitória.
      expect(resposta.status).toBe(503);
      expect(resposta.tipoDeConteudo).toBe(TIPO_DE_MIDIA_DO_ERRO);
      expect(textoInicialDe(resposta.bytes)).not.toBe(ASSINATURA_DO_PDF);

      // ---------------------------------------------------------------------------------------
      // O envelope, por OBJETO INTEIRO — e o texto do provedor NÃO está nele (RN-15)
      // ---------------------------------------------------------------------------------------
      //
      // É a igualdade que faz o motivo do provedor, ou um `detalhes` inventado, reprovarem aqui: o
      // que sai é a mensagem do produto nomeando a cobrança, e nada mais.
      expect(resposta.corpo).toEqual({
        codigo: CODIGO_DE_SERVICO_INDISPONIVEL,
        mensagem: `${MENSAGEM_DA_ENTREGA_INCOMPLETA} ${codigo}`,
      });

      // A consulta foi feita uma vez, e o arquivo continua ausente: nada foi gravado com o nada.
      expect(roteiro.operacoes).toEqual(['consultarSituacao']);
      expect(existsSync(caminho)).toBe(false);

      // E o estado da cobrança está intacto — a falha da rebusca não desfaz emissão alguma.
      expect(camposDeEmissaoPublicados(await lerCobranca(codigo))).toEqual(atribuidos);
      expect(await lerTrilha(codigo)).toEqual(trilhaAntes);
    },
    LIMITE_CASO_MS,
  );

  it(
    'CT-921 — boleto nunca emitido é recusa nomeada, jamais documento em branco',
    async () => {
      const contrato = await contratoAtivo();
      const codigo = (await lancar(contrato)).codigo;

      roteiro.operacoes = [];

      const resposta = await pedirBoleto(cookie, codigo);

      // ---------------------------------------------------------------------------------------
      // A recusa não se ANUNCIA documento e não CARREGA documento — antes do envelope, e a
      // posição é conteúdo
      // ---------------------------------------------------------------------------------------
      //
      // A ordem é a mesma do `CT-920 (b)`, e pela mesma razão, escrita por extenso lá: a igualdade
      // de `resposta.corpo` **implica** que os bytes desserializaram naquele JSON, de modo que uma
      // asserção sobre os bytes posta depois dela não teria estado alcançável em que reprovasse.
      // Aqui as três linhas correm com apenas o status afirmado: `tipoDeConteudo` pega o cabeçalho
      // de mídia escrito **antes** da leitura — o defeito que a rota do documento do contrato mediu
      // (`MT-2`) —, `textoInicialDe` pega o `404` que devolve documento assim mesmo, e o teto de
      // tamanho pega o documento embutido num corpo que ainda seja JSON.
      //
      // `404` e não `422`: o recurso desta rota é o **documento**, e ele de fato não existe.
      expect(resposta.status).toBe(404);
      expect(resposta.tipoDeConteudo).toBe(TIPO_DE_MIDIA_DO_ERRO);
      expect(textoInicialDe(resposta.bytes)).not.toBe(ASSINATURA_DO_PDF);
      expect(resposta.bytes.byteLength).toBeLessThan(MAIOR_CORPO_DE_RECUSA);

      // ---------------------------------------------------------------------------------------
      // O envelope, por OBJETO INTEIRO — e ele NOMEIA a cobrança e a ausência do documento
      // ---------------------------------------------------------------------------------------
      //
      // É esta igualdade que fecha a classe "PDF em branco com 200": o que sai é envelope, e é o
      // envelope exato. A mensagem nomeia a cobrança porque a política já casou a linha — quem
      // pediu a lê inteira por `GET /v1/cobrancas/:codigo` —, e `detalhes.boleto` diz **por quê**
      // não há documento, que é o que separa esta recusa de "a rota está errada".
      expect(resposta.corpo).toEqual({
        codigo: CODIGO_DE_RECURSO_NAO_ENCONTRADO,
        mensagem: `${MENSAGEM_SEM_BOLETO_EMITIDO} ${codigo}`,
        campo: 'codigo',
        detalhes: { boleto: 'NUNCA_EMITIDO' },
      });

      // A recusa sai do BANCO, sem tocar o provedor nem gravar arquivo.
      expect(roteiro.operacoes).toEqual([]);
      expect(existsSync(arquivoDoBoleto(codigo))).toBe(false);
    },
    LIMITE_CASO_MS,
  );

  it(
    'CT-921 (b) — boleto REVOGADO cujo arquivo sobrou em disco responde 404, porque a autorização sai do estado',
    async () => {
      await registrarCertificadoDaEmpresa('ct921b');
      const codigo = await cobrancaComBoleto();
      const caminho = arquivoDoBoleto(codigo);

      // ---------------------------------------------------------------------------------------
      // A precondição: a revogação COMPLETA-SE e o alvo SOBREVIVE em disco
      // ---------------------------------------------------------------------------------------
      //
      // O estado é real e alcançável, e não hipótese: a revogação apaga a coluna dentro da unidade de
      // trabalho e remove os bytes **depois**, por um efeito acessório cuja falha é engolida — decisão
      // da T13, tomada porque propagá-la fazia uma revogação bem-sucedida responder `500`.
      //
      // A técnica é a mesma, palavra por palavra, do `CT-918 (g)`: o arquivo dá lugar a um
      // **diretório** de mesmo nome, e `unlink` sobre diretório recusa em qualquer privilégio. Ela é a
      // única que produz o estado sem forjar bytes de boleto no diretório — o que a fatia proíbe — e
      // sem alterar o modo do diretório-base, que é compartilhado com os demais arquivos da suíte.
      expect((await stat(caminho)).isFile()).toBe(true);
      await rm(caminho);
      await mkdir(caminho);

      const revogacao = await pedir(rotaDaRevogacao(codigo), {
        metodo: 'POST',
        cookie,
        corpo: {},
      });

      expect(revogacao.status).toBe(200);
      // As duas metades da precondição, AFIRMADAS: a coluna perdeu o título, e o alvo continua lá.
      expect(await numeroDoTituloGravado(codigo)).toBeNull();
      expect(existsSync(caminho)).toBe(true);

      roteiro.operacoes = [];

      const resposta = await pedirBoleto(cookie, codigo);

      // ---------------------------------------------------------------------------------------
      // A rota decide pelo ESTADO, e é este par que discrimina
      // ---------------------------------------------------------------------------------------
      //
      // Uma entrega que perguntasse ao **disco** *"existe boleto?"* encontraria o alvo e seguiria
      // adiante — devolvendo bytes de um boleto **revogado** a quem tivesse guardado o endereço, ou
      // falhando com `500` ao tentar lê-lo. A primeira reprova nas duas linhas de bytes abaixo; a
      // segunda, no status e na igualdade — que é a mesma recusa do `CT-921`: para esta rota,
      // revogado e nunca emitido são o mesmo fato, não há documento a entregar.
      //
      // A ordem repete a do `CT-920 (b)`, e pela mesma razão escrita por extenso lá: a igualdade de
      // `resposta.corpo` implica bytes que desserializam naquele JSON, e uma asserção sobre os bytes
      // posta depois dela não teria estado alcançável em que reprovasse.
      expect(resposta.status).toBe(404);
      expect(resposta.tipoDeConteudo).toBe(TIPO_DE_MIDIA_DO_ERRO);
      expect(textoInicialDe(resposta.bytes)).not.toBe(ASSINATURA_DO_PDF);
      expect(resposta.corpo).toEqual({
        codigo: CODIGO_DE_RECURSO_NAO_ENCONTRADO,
        mensagem: `${MENSAGEM_SEM_BOLETO_EMITIDO} ${codigo}`,
        campo: 'codigo',
        detalhes: { boleto: 'NUNCA_EMITIDO' },
      });

      // Nada foi perguntado ao provedor — a recusa saiu do banco, antes de qualquer rebusca.
      expect(roteiro.operacoes).toEqual([]);

      // E o órfão continua onde estava: a leitura não apaga nada, e o preço que a revogação declara
      // por escrito segue sendo o mesmo.
      expect(existsSync(caminho)).toBe(true);
    },
    LIMITE_CASO_MS,
  );
});

// ---------------------------------------------------------------------------------------------
// Acessórios — tudo pelas rotas reais, salvo as leituras cruas e o percurso da conferência
// ---------------------------------------------------------------------------------------------

let sequencial = 0;

function proximo(): number {
  sequencial += 1;

  return sequencial;
}

/** As duas rotas de ato, compostas a partir do dono do segmento — nunca escritas à mão. */
function rotaDaEmissao(codigo: string): string {
  return `${COLECAO_DE_COBRANCAS}/${codigo}/emissao-de-boleto`;
}

function rotaDaRevogacao(codigo: string): string {
  return `${COLECAO_DE_COBRANCAS}/${codigo}/revogacao-de-boleto`;
}

/** A rota de acusação de pagamento — o caminho legítimo para produzir a cobrança LIQUIDADA. */
function rotaDoPagamento(codigo: string): string {
  return `${COLECAO_DE_COBRANCAS}/${codigo}/pagamento`;
}

/** A rota que entrega os bytes do boleto (T14), composta a partir do dono do segmento. */
function rotaDoBoleto(codigo: string): string {
  return `${COLECAO_DE_COBRANCAS}/${codigo}/boleto`;
}

/**
 * O alvo que a guarda usa para os bytes de uma cobrança — composto **à mão**, jamais pedido ao SUT.
 *
 * O diretório vem da aplicação montada ({@link diretorioDosBoletos}), e o nome é composto do código
 * mais a extensão escrita à mão neste arquivo: derivá-lo da guarda faria o caso concordar com ela
 * sobre onde os bytes moram, que é justamente o que ele precisa saber por fora.
 */
function arquivoDoBoleto(codigo: string): string {
  return join(diretorioDosBoletos(), `${codigo}${EXTENSAO_DO_BOLETO}`);
}

/** Só os dígitos de um campo do meio de pagamento — a linha digitável vem com pontos e espaços. */
function somenteDigitos(valor: string): string {
  return valor.replace(/\D/gu, '');
}

/**
 * Registra o certificado vigente da empresa **pela rota real** — a precondição de toda emissão.
 *
 * A autoridade é descartável e nasce **dentro do caso**, porque a limpeza dela é registrada em
 * `onTestFinished`, que o arcabouço só admite de dentro de um `it`. É a mesma razão, palavra por
 * palavra, do acessório de `certificado-do-provedor.e2e.spec.ts`.
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
  // (`D36 · F4/T10`, fechado em 2026-08-20): sem ela os atos recusam com `422` antes de falar com o
  // provedor. Registrada pela ROTA REAL, como o certificado acima — o arranjo desta suíte é de
  // borda, e semear por dentro do banco mediria um caminho que a operação não percorre.
  const identidade = await pedir(ROTA_DO_REGISTRO_DA_IDENTIDADE, {
    metodo: 'POST',
    cookie,
    corpo: {
      identificadorDaAplicacao: 'identificador-do-arranjo',
      numeroDoCliente: 33065,
      numeroDaContaCorrente: 380261,
      codigoDaModalidade: 1,
    },
  });

  if (identidade.status !== 201) {
    throw new Error(
      `o registro da identidade respondeu ${String(identidade.status)}: ${identidade.texto}`,
    );
  }
}

/**
 * Retroage a validade do certificado vigente da empresa A, e devolve o instante que passou a valer.
 *
 * ⚠️ **É a única precondição deste arquivo que não passa por rota**, e a razão é a mesma que
 * `certificado-do-provedor.e2e.spec.ts` escreve por extenso no cabeçalho dele: `VENCIDO` é o único
 * estado que o **caminho de escrita recusa por construção** — a RN-03 proíbe registrar material cuja
 * validade já terminou —, e em produção ele nasce da **passagem do tempo**. Não é atalho sobre o
 * SUT: o que está sob prova no `CT-918 (d)` é a **leitura** que a emissão faz da vigência, e o
 * registro que a precede acontece pela rota real, com material real, como em todos os outros casos.
 *
 * A instrução corre **sob o contexto de tenant** e sem `WHERE empresa_id` — quem recorta é a política
 * (ADR-0008) —, e o eixo é o do banco (`pg_catalog.now()`), nunca o do processo (ADR-0026). O
 * `RETURNING` é o que permite ao caso afirmar `detalhes.validoAte` contra o instante **da linha**, em
 * vez de contra uma data que ele próprio tivesse calculado.
 */
async function envelhecerOCertificadoVigente(): Promise<Date> {
  return await emUnidade(async (tx) => {
    const [linha] = await tx<{ validoAte: Date }[]>`
      UPDATE negocio.certificado_do_provedor
         SET valido_ate = pg_catalog.now() - make_interval(days => ${DIAS_DE_ATRASO_DO_VENCIDO})
       WHERE substituido_em IS NULL
      RETURNING valido_ate AS "validoAte"
    `;

    if (linha === undefined) {
      throw new Error('não há certificado vigente para envelhecer');
    }

    return linha.validoAte;
  });
}

/** O estado da vigência que a rota de consulta publica — a precondição afirmada do `CT-918 (d)`. */
async function estadoDoCertificado(credencial: string): Promise<string> {
  const resposta = await pedir(ROTA_DA_CONSULTA_DE_CERTIFICADO, { cookie: credencial });

  if (resposta.status !== 200) {
    throw new Error(`a consulta do certificado respondeu ${String(resposta.status)}`);
  }

  return (resposta.corpo as { estado: string }).estado;
}

/**
 * Monta uma cobrança **com boleto vivo**, pelas rotas reais — cadastros, contrato, lançamento e
 * emissão.
 *
 * A emissão é feita pela própria rota sob prova, e não por escrita direta: é o caminho legítimo, e é
 * ele que grava também o `identificador_no_provedor` e o evento da trilha, que os casos leem depois.
 */
async function cobrancaComBoleto(): Promise<string> {
  const contrato = await contratoAtivo();
  const codigo = (await lancar(contrato)).codigo;

  roteiro.aceitarEmissao = true;
  roteiro.operacoes = [];

  const emissao = await pedir(rotaDaEmissao(codigo), { metodo: 'POST', cookie, corpo: {} });

  if (emissao.status !== 200) {
    throw new Error(`a emissão do arranjo respondeu ${String(emissao.status)}: ${emissao.texto}`);
  }

  return codigo;
}

/**
 * Monta conjunto, imóvel, locador, locatário e um contrato **ATIVO**, todos pelas rotas reais.
 *
 * A **credencial é parâmetro**, com a sessão do arranjo por padrão — o valor que todos os chamadores
 * anteriores usavam, de modo que nenhum deles muda de comportamento. Ela existe porque a metade (c)
 * do `CT-918 (b)` precisa do cenário na **empresa B**, e montar o cadastro dela por escrita direta
 * produziria um estado que o produto nunca produz.
 */
async function contratoAtivo(credencial: string = cookie): Promise<string> {
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

  const montagem = await pedir(COLECAO_DE_CONTRATOS, {
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
      // Sem geração automática: o que estes casos medem é o ato sobre **uma** cobrança conhecida, e
      // doze parcelas nascidas da ativação encheriam o cenário sem servir a asserção alguma.
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

/**
 * Lança a cobrança do cenário pela rota real, com vencimento derivado do relógio do banco.
 *
 * A **credencial é parâmetro**, pela mesma razão de {@link contratoAtivo} e com o mesmo padrão.
 */
async function lancar(
  contratoCodigo: string,
  credencial: string = cookie,
): Promise<CobrancaPublicada> {
  const vencimento = await dataDeslocada(DIAS_ATE_O_VENCIMENTO);
  const competencia = `${vencimento.slice(0, 7)}-01`;

  const resposta = await pedir(COLECAO_DE_COBRANCAS, {
    metodo: 'POST',
    cookie: credencial,
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

  return resposta.corpo as CobrancaPublicada;
}

/** Cria um recurso pela rota informada e devolve o identificador dele. A falha levanta. */
async function criarPor(
  colecao: string,
  corpo: Record<string, unknown>,
  credencial: string = cookie,
): Promise<{ readonly id: string }> {
  const resposta = await pedir(colecao, { metodo: 'POST', cookie: credencial, corpo });

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

/** Lê a cobrança publicada pela rota real — a mesma que o cliente lê. */
async function lerCobranca(codigo: string): Promise<CobrancaPublicada> {
  const resposta = await pedir(`${COLECAO_DE_COBRANCAS}/${codigo}`, { cookie });

  if (resposta.status !== 200) {
    throw new Error(
      `a leitura de ${codigo} respondeu ${String(resposta.status)}: ${resposta.texto}`,
    );
  }

  return resposta.corpo as CobrancaPublicada;
}

/** As chaves do corpo publicado, ordenadas — o que a igualdade de conjunto compara. */
function chavesDe(cobranca: CobrancaPublicada): readonly string[] {
  return Object.keys(cobranca).sort();
}

/** O último boleto que o par instrumentado atribuiu — a sequência DELE, lida do arranjo. */
function ultimoBoletoEmitido(): BoletoEmitido {
  const emitido = roteiro.emitidos.at(-1);

  if (emitido === undefined) {
    throw new Error('o par instrumentado não emitiu título algum');
  }

  return emitido;
}

/**
 * Os **três** campos de emissão do último boleto atribuído, na forma em que a cobrança os publica.
 *
 * É o esperado das igualdades do CT-932, e ele é montado do que o **par** devolveu — nunca do corpo
 * observado, que é justamente o que está sob prova.
 */
function camposDeEmissaoAtribuidos(): Record<string, string> {
  const emitido = ultimoBoletoEmitido();

  return {
    numeroDoTituloNoProvedor: emitido.numeroDoTituloNoProvedor,
    linhaDigitavel: emitido.linhaDigitavel,
    codigoDeBarras: emitido.codigoDeBarras,
  };
}

/** Os mesmos três campos, lidos do corpo publicado — o observado das igualdades do CT-932. */
function camposDeEmissaoPublicados(cobranca: CobrancaPublicada): Record<string, unknown> {
  return {
    numeroDoTituloNoProvedor: cobranca.numeroDoTituloNoProvedor,
    linhaDigitavel: cobranca.linhaDigitavel,
    codigoDeBarras: cobranca.codigoDeBarras,
  };
}

/**
 * A trilha publicada da cobrança, **pela porta de dados**, sem o carimbo que o banco escolhe.
 *
 * `ocorridoEm` sai da comparação porque é instante do banco, e não fato do caso; `valorInformado`
 * também, porque nenhum destes eventos carrega valor. O que se afirma é tipo, origem e diagnóstico.
 */
async function lerTrilha(
  codigo: string,
): Promise<readonly { tipo: string; origem: string; diagnostico: string | null }[]> {
  const eventos = await emUnidade(async (tx) => await lerTrilhaDaCobranca(tx, codigo));

  return eventos.map((evento) => ({
    tipo: evento.tipo,
    origem: evento.origem,
    diagnostico: evento.diagnostico,
  }));
}

/**
 * O `numero_do_titulo_no_provedor` **cru**, lido da tabela sob o contexto de tenant.
 *
 * A leitura publicada serviria para ele, e a crua é usada de propósito: o par com
 * {@link identificadorGravado} — que **não** é publicado — mantém as duas medições no mesmo eixo, e
 * evita que o caso pareça afirmar sobre a coluna o que leu do corpo.
 */
async function numeroDoTituloGravado(codigo: string): Promise<string | null> {
  return await colunaDaCobranca(codigo, 'numero_do_titulo_no_provedor');
}

/** O `identificador_no_provedor` cru — chave de correlação INTERNA, que nenhum esquema publica. */
async function identificadorGravado(codigo: string): Promise<string | null> {
  return await colunaDaCobranca(codigo, 'identificador_no_provedor');
}

/**
 * Lê uma das duas colunas internas da cobrança, sob o contexto de tenant.
 *
 * Não há `WHERE empresa_id` — quem recorta é a política (ADR-0008) —, e o nome da coluna é escolhido
 * por um `switch` fechado em vez de interpolado: a única forma de o caso não montar texto de SQL a
 * partir de parâmetro.
 */
async function colunaDaCobranca(
  codigo: string,
  coluna: 'numero_do_titulo_no_provedor' | 'identificador_no_provedor',
): Promise<string | null> {
  return await emUnidade(async (tx) => {
    const [linha] =
      coluna === 'numero_do_titulo_no_provedor'
        ? await tx<{ valor: string | null }[]>`
            SELECT numero_do_titulo_no_provedor AS valor FROM negocio.cobranca WHERE codigo = ${codigo}
          `
        : await tx<{ valor: string | null }[]>`
            SELECT identificador_no_provedor AS valor
              FROM negocio.cobranca
             WHERE codigo = ${codigo}
          `;

    if (linha === undefined) {
      throw new Error(`a cobrança ${codigo} não foi encontrada na leitura crua`);
    }

    return linha.valor;
  });
}

/**
 * A data corrente da operação deslocada em `dias`, como cadeia `YYYY-MM-DD`.
 *
 * **É assim que toda data deste arquivo é posicionada**: o relógio nunca é falseado, o dado é que se
 * move. A leitura sai do **mesmo** `negocio.data_corrente_da_operacao()` que a visão consulta — nunca
 * de `new Date()` do processo, que é o segundo eixo de dia que a ADR-0026 fecha. Mesma forma, e mesma
 * razão, de `dataDeslocada` em `packages/cobranca-bancaria/test/conferencia.spec.ts`.
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

/**
 * Roda a conferência **real** com um par que informa o título REVOGADO — o produtor da CA-18.
 *
 * O percurso é `conferirCobrancas`, de `@sysloc/cobranca-bancaria`, com as portas satisfeitas pelas
 * mesmas funções de `@sysloc/db` que a borda da tarefa (T16) satisfará. Nada aqui escreve na tabela
 * por fora: a revogação sai de `revogarBoleto`, e o evento de `registrarEventoBancario`.
 */
async function conferirComProvedorQueRevoga(codigo: string): Promise<void> {
  await conferir(codigo, () => ({
    situacao: 'REVOGADO',
    motivo: MOTIVO_DA_REVOGACAO_NO_PROVEDOR,
    documento: null,
  }));
}

/** Roda a conferência real com um par que informa o título LIQUIDADO — o produtor do crédito. */
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
 * A cobrança do caso é afirmada **dentro** do conjunto selecionado antes de a apuração correr: sem
 * essa linha, um predicado que a excluísse faria a conferência não fazer nada, e o caso seguinte
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
      // O par da conferência é **próprio deste percurso**, e não o injetado na aplicação: o que a
      // suíte mede pela rota é a sequência que a **borda** produz, e uma consulta da conferência
      // registrada lá poluiria justamente a asserção central dos outros dois casos.
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

        // `valorTotal` é o total DERIVADO pela visão (ADR-0022) — original mais a mora vigente —, e
        // é ele que se esperava receber. Nada aqui calcula: a derivação é do banco.
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
            // O motivo do provedor viaja INTACTO até a coluna de diagnóstico (RN-15).
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
 * O diretório dos boletos, lido **da aplicação montada** — nunca do ambiente do processo.
 *
 * A guarda deste percurso é construída aqui porque o percurso é do **caso**, e não da aplicação; o
 * diretório precisa ser o **mesmo** que a composição usa, para que os bytes que a conferência apagar
 * sejam os que a rota gravou. Pedi-lo ao ambiente já validado — em vez de reler `process.env` — é o
 * que garante isso por construção: se a composição passar a resolver o caminho de outro jeito, este
 * acessório o acompanha, em vez de apontar para um diretório que ninguém mais usa.
 */
function diretorioDosBoletos(): string {
  return aplicacao.get<Ambiente>(TOKEN_AMBIENTE).diretorioDosBoletos;
}

/**
 * O código com que a guarda **real** recusa apagar os bytes da cobrança — a precondição do `CT-918 (g)`.
 *
 * A guarda é construída sobre o **mesmo** diretório da aplicação, e o que se mede é a própria
 * `apagar`: o caso não presume qual falha o sistema operacional produz sobre o alvo que ele montou,
 * ele a lê. Os dois desfechos sem falha ganham rótulo próprio para que a asserção do caso nomeie o
 * que aconteceu em vez de comparar com `undefined`.
 */
async function codigoDaFalhaAoApagar(codigo: string): Promise<string> {
  try {
    await criarGuardaDeBoletos(diretorioDosBoletos()).apagar(codigo);
  } catch (erro) {
    if (typeof erro === 'object' && erro !== null && 'code' in erro) {
      return String(erro.code);
    }

    return 'FALHA_SEM_CODIGO';
  }

  return 'APAGOU_SEM_RECLAMAR';
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
  await ajustar(
    usuarioId,
    empresaId,
    chaves.map((chave) => ({ chave, efeito: 'CONCEDIDA' as const })),
  );
}

/**
 * Escreve o conjunto **completo** de ajustes individuais de uma pessoa, pelo caminho real da camada
 * de dados.
 *
 * É a forma geral de {@link conceder}, e existe porque o `CT-918 (e)` precisa da outra direção: o
 * efetivo é `(matriz do perfil ∪ concedidas) − negadas`, e o sujeito de lá é `ADMIN_EMPRESA`, cuja
 * matriz já é o catálogo inteiro — só a **negação** produz nele um efetivo com a área e sem as ações.
 *
 * A coerência ação→tela é validada pela função de domínio, com o perfil lido **dentro** da mesma
 * transação: é o mesmo caminho que a rota do Admin usa por dentro, e é ele que recusaria um conjunto
 * que deixasse ação concedida sem a tela que a comporta (RN-02).
 */
async function ajustar(
  usuarioId: string,
  empresaId: string,
  ajustes: readonly { readonly chave: ChaveDoCatalogo; readonly efeito: 'CONCEDIDA' | 'NEGADA' }[],
): Promise<void> {
  await contextoDeTenant.executarCom({ empresaId }, async () => {
    await acessoAoNegocio.emUnidadeDeTrabalho(async (tx) => {
      await escreverAjustes(tx, {
        usuarioId,
        ajustes: ajustes.map((ajuste) => ({ chave: ajuste.chave, efeito: ajuste.efeito })),
        validarCoerencia: validarCoerenciaDeAjustes,
      });
    });
  });
}

/**
 * A cobrança como a rota a publica — os **vinte e três** campos, escritos à mão.
 *
 * Ele descreve o corpo observado, e não é importado de `@sysloc/contracts`: os casos o asserem por
 * igualdade, e derivá-lo do tipo do SUT faria a asserção concordar consigo mesma.
 */
interface CobrancaPublicada {
  readonly codigo: string;
  readonly contratoCodigo: string;
  readonly locatarioId: string;
  readonly natureza: string;
  readonly referencia: string;
  readonly competencia: string;
  readonly dataVencimento: string;
  readonly valorOriginal: number;
  readonly status: string;
  readonly diasAtraso: number;
  readonly valorMulta: number;
  readonly valorJuros: number;
  readonly valorTotal: number;
  readonly pagoEm: string | null;
  readonly valorPago: number | null;
  readonly canceladoEm: string | null;
  readonly multaPercentualAplicado: number | null;
  readonly jurosPercentualAplicado: number | null;
  readonly numeroDoTituloNoProvedor: string | null;
  readonly linhaDigitavel: string | null;
  readonly codigoDeBarras: string | null;
  readonly dataDoCredito: string | null;
  readonly valorCreditado: number | null;
}

/** O recorte da sessão publicada que este arquivo observa. */
interface SessaoPublicada {
  readonly telas: readonly string[];
  readonly acoes: readonly string[];
}

interface Resposta {
  readonly status: number;
  readonly texto: string;
  readonly corpo: unknown;
  readonly cookies: readonly string[];
}

/** O que a rota do boleto devolve, como este arquivo o observa (T14). */
interface RespostaDeBoleto {
  readonly status: number;
  readonly tipoDeConteudo: string;
  readonly disposicao: string;
  readonly bytes: Uint8Array;
  readonly corpo: unknown;
}

/**
 * Pede o boleto de uma cobrança e devolve status, cabeçalhos e o corpo **em bytes**.
 *
 * ⚠️ **O débito `D63 · F4/fechamento` FOI FECHADO em 2026-08-19**, pela T6 da fatia
 * `webhook-e-carne`: a casa única passou a existir em `apps/api/test/acessorios-de-borda.ts`, e o
 * marcador saiu de `certificado-do-provedor.e2e.spec.ts` junto com a linha do índice do `CLAUDE.md`.
 * O que aquela task fez foi **criar a casa**, não converter as ~30 suítes — este `pedirBoleto`
 * continua sendo cópia, e a medição registrada aqui continua valendo: as cópias de `pedir` já
 * divergiram em 11 formas distintas (por hash do corpo), de modo que unificar não é migração
 * mecânica. A conversão desta suíte acontece pelo caminho normal do `CLAUDE.md` — *acessório de
 * suíte se importa, não se copia* —, na próxima task autorizada a abrir este arquivo por outra
 * razão. Esta prosa **não é um marcador**, e não era antes: o débito não tem mais marcador algum.
 *
 * Ele lê o corpo como `ArrayBuffer` sempre — inclusive nas recusas —, e a escolha é conteúdo: um
 * cliente que lesse texto não conseguiria afirmar que a recusa **não** carrega bytes de documento,
 * que é metade do `CT-921`. É a cadeia bytes → texto → objeto que mantém as duas afirmações no
 * mesmo caso, e o molde é `pedirDocumento`, de `apps/api/test/documento-do-contrato.e2e.spec.ts`.
 *
 * ⚠️ **A desserialização NÃO consulta o tipo de conteúdo, e a divergência com o molde é
 * deliberada.** Gateá-la pelo `content-type` fazia de `corpo` uma *função do cabeçalho de mídia*:
 * `corpo` diferente de `undefined` passava a implicar `application/json`, e com isso toda asserção
 * sobre os bytes escrita depois de uma igualdade de `corpo` virava consequência lógica dela,
 * incapaz de reprovar em estado alcançável — o AP-29 que o Gate 1 mediu nesta task. E no próprio
 * defeito que os três casos de recusa perseguem, o `Content-Type` escrito **antes** da leitura,
 * quem reprovava era a igualdade do envelope, não a asserção que a prosa creditava.
 *
 * Aqui `corpo` depende **só dos bytes**, e o cabeçalho não tem efeito algum sobre ele. A mídia
 * ganha então uma guardiã única e explícita — `expect(resposta.tipoDeConteudo).toBe(…)`, presente
 * nos três casos —, que é **mais forte** que o `includes` que saiu: compara o tipo já canonizado,
 * por igualdade, em vez de aceitar qualquer cabeçalho que contenha o texto.
 *
 * O parse é **tolerante** por necessidade, e não por conveniência: bytes que não são JSON viram
 * `undefined` em vez de derrubarem o caso com `SyntaxError` dentro do acessório. É o que permite a
 * uma resposta que anuncia JSON e entrega documento reprovar na asserção nomeada, em vez de
 * explodir antes de alcançá-la.
 */
async function pedirBoleto(credencial: string, codigo: string): Promise<RespostaDeBoleto> {
  const resposta = await fetch(new URL(rotaDoBoleto(codigo), base), {
    method: 'GET',
    headers: { connection: 'close', origin: base, cookie: credencial },
  });

  const bytes = new Uint8Array(await resposta.arrayBuffer());
  const tipoDeConteudo = resposta.headers.get('content-type') ?? '';

  return {
    status: resposta.status,
    // O parâmetro do tipo de mídia (`; charset=…`) é descartado: o que a ADR-0028 declara é o tipo,
    // e um `charset` acrescentado pelo adaptador não é divergência de contrato.
    tipoDeConteudo: (tipoDeConteudo.split(';')[0] ?? '').trim(),
    disposicao: resposta.headers.get('content-disposition') ?? '',
    bytes,
    corpo: comoJson(bytes),
  };
}

/**
 * Desserializa os bytes como JSON, ou devolve `undefined` quando eles não são JSON.
 *
 * Nada aqui olha para o tipo de conteúdo — a razão está no docblock de `pedirBoleto`, e é o que
 * separa a asserção de mídia da asserção de corpo em vez de fazer uma implicar a outra.
 */
function comoJson(bytes: Uint8Array): unknown {
  if (bytes.byteLength === 0) {
    return undefined;
  }

  try {
    return JSON.parse(new TextDecoder().decode(bytes)) as unknown;
  } catch {
    return undefined;
  }
}

/** Os primeiros caracteres do corpo, para comparar com a assinatura do PDF. */
function textoInicialDe(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes.subarray(0, ASSINATURA_DO_PDF.length));
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
