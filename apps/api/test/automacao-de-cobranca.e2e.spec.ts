/**
 * As **duas rotas da política de aviso** — T9 da fatia `regua-de-cobranca`: ler a régua que a
 * empresa configurou (`GET /v1/automacao-de-cobranca`) e defini-la (`PUT`).
 *
 * ---------------------------------------------------------------------------
 * INVARIANTES
 * ---------------------------------------------------------------------------
 *
 * | Critério | Caso   | Invariante |
 * |---|---|---|
 * | CA-02 | CT-627 | `GET /v1/automacao-de-cobranca` de empresa que **nunca** configurou devolve
 * | CA-03 |        | `200` com a régua **DESLIGADA** — nunca `404` — e **não cria linha** (contagem
 * |       |        | crua `0` depois da leitura, nas duas empresas). Duas gravações com corpos
 * |       |        | diferentes deixam a contagem crua em `1`, nunca `2`, e a leitura devolve sempre
 * |       |        | o **último** corpo gravado. Os dois horários voltam no molde `HH:MM` — cinco
 * |       |        | caracteres, sem segundos —, que é o que a projeção `to_char` do banco garante.
 * |       |        | A política de uma empresa nunca alcança a outra: nenhuma rota recebe empresa, e
 * |       |        | o que separa as duas é o cookie. |
 * | CA-15 | CT-628 | Todo corpo que viole a completude do `strictObject`, o conjunto fechado do
 * |       |        | canal, a faixa de um inteiro, o molde do horário, a ordem da janela ou o
 * |       |        | conjunto fechado de chaves é recusado com `422` e o envelope **INTEIRO** da
 * |       |        | ADR-0017 nomeando o campo; a política já gravada permanece byte a byte a mesma
 * |       |        | e a contagem crua não muda. As bordas `{dias 0, intervalo 1, 00:00–23:59}` e
 * |       |        | `{dias 90, intervalo 90, 23:59–23:59}` são **ACEITAS**: as faixas são fechadas
 * |       |        | nos dois extremos, e a janela admite início igual ao fim. |
 *
 * Rastreabilidade: `CA-02 → CT-627 (RD-03)`, `CA-03 → CT-627 (RD-03)`, `CA-15 → CT-628 (RN-13)`.
 *
 * ===========================================================================
 * A CONTAGEM DE LINHAS é o discriminador, e ela vem em duas medições
 * ===========================================================================
 *
 * As leituras sozinhas **não distinguem** a implementação correta da errada. Uma escrita que
 * inserisse uma linha por chamada passaria em todas elas — a última inserida venceria em qualquer
 * ordenação estável —, e o defeito só apareceria quando a restrição `UNIQUE (empresa_id)` fosse
 * consultada, ou quando duas políticas discordantes chegassem à passagem da régua. É a contagem crua
 * que separa *"a leitura devolve o último corpo"* de *"a empresa tem UMA política"*.
 *
 * A outra medição é a contagem **`0`** logo depois do primeiro `GET`, e ela separa a RD-03 de uma
 * implementação que cria a linha desligada na leitura. As duas metades da regra são independentes:
 * não responder `404` é a primeira, e **não escrever** é a segunda — a segunda é a que passa
 * despercebida, porque uma leitura que grava devolve exatamente o mesmo corpo.
 *
 * As contagens são **cruas e sem recorte**, e a empresa entra pelo **contexto**, que é o mesmo
 * mecanismo que a aplicação usa. Nenhum `WHERE empresa_id` é escrito aqui — quem recorta é a
 * política (ADR-0008).
 *
 * ===========================================================================
 * O MOLDE `HH:MM` de ponta a ponta — a obrigação que só ESTE arquivo fecha
 * ===========================================================================
 *
 * As colunas da janela são `time`, e o driver devolveria `'09:00:00'`. O contrato publica os dois
 * horários no molde `HH:MM` **ancorado nas duas pontas** (`esquemaDaPoliticaDeAviso`), mas quem
 * **cumpre** a obrigação é a projeção `to_char(coluna, 'HH24:MI')` de
 * `packages/db/src/politica-de-aviso.ts` — e o `CT-608` já a prova **na porta**, lendo a mesma linha
 * pelas duas projeções.
 *
 * ⚠️ **A âncora do esquema de SAÍDA não é uma rede, e isto foi MEDIDO**: com a projeção trocada por
 * leitura crua, a rota respondeu **`200` com `janelaInicio: '08:00:00'`**. **Nenhum esquema de saída
 * deste produto é aplicado em tempo de execução**: `apps/api/src/comum/esquema-publicado.ts` apenas
 * traduz o esquema para o JSON Schema do documento (`z.toJSONSchema`), e `apps/api/src/app.module.ts`
 * registra **um único** `APP_INTERCEPTOR`, que é a `GuardaDeContexto`. A ADR-0016 está correta e não
 * promete outra coisa — dela derivam a conferência de **entrada**, o tipo da resposta e o documento
 * publicado, nunca a conferência da saída.
 *
 * O que faltava era o caminho **inteiro**: gravar pela rota real e reler pela rota real. É o que o
 * passo 4-b do `CT-627` faz, e é a ausência de validação de saída que lhe dá peso: um `to_char`
 * trocado por `'HH24:MI:SS'` devolveria `200` com `'07:30:00'` **em silêncio** — não há queda, não há
 * erro, não há rede. Por isso a igualdade de corpo inteiro (`toStrictEqual`) e o molde de cinco
 * caracteres (`toMatch`) **não são metade do discriminante: são o discriminante inteiro**, a única
 * coisa entre o defeito e o cliente. **Não os remova por julgá-los redundantes com o `200`** — o
 * status separa sucesso de falha e não afirma nada sobre a forma do que voltou.
 *
 * O fato do produto atravessa esta fatia inteira, e é por isso que ele mora no cabeçalho e não só no
 * passo: **campo a mais devolvido pelo serviço chega ao cliente sem que nada o barre**, e a única
 * rede é a igualdade de corpo inteiro afirmada no teste da rota. É o que sustenta o `toStrictEqual`
 * — nunca asserção de presença — nos casos que T10, T11 e T12 acrescentarem a este arquivo.
 *
 * ===========================================================================
 * O CONTROLE POSITIVO das bordas, e por que ele é obrigatório
 * ===========================================================================
 *
 * Sem as duas bordas respondendo `200`, a tabela de dezesseis recusas do `CT-628` seria satisfeita
 * por uma validação que recusasse **todo** corpo — e a releitura intacta continuaria verdadeira,
 * porque nada teria sido gravado. O par aceito é o que torna o caso discriminante, e as bordas exatas
 * prendem cada faixa pelos dois lados: um piso maior que zero recusaria `diasAntesDoVencimento: 0`,
 * um teto menor que noventa recusaria `90`, um piso de intervalo em zero deixaria de recusar o `0` da
 * tabela, e uma janela que exigisse fim **estritamente** posterior recusaria `23:59`–`23:59`.
 *
 * ===========================================================================
 * A tabela de recusas tem DEZESSEIS linhas, e não catorze
 * ===========================================================================
 *
 * A enumeração da §6.6 da task lista catorze — os seis campos ausentes, os dois canais recusados, os
 * dois inteiros fora de faixa de cada campo, o horário fora do molde e a chave extra. Duas outras
 * recusas são exigidas por **outras** seções da mesma task e não estavam naquela enumeração: a
 * **janela invertida** (§6.4, `campo: 'janelaFim'`) e o **`empresaId` no corpo** (Aceite Técnico,
 * recusado por chave desconhecida). As duas entram aqui: a tabela **cresce**, e o que ela mede não
 * foi afrouxado.
 *
 * A segunda importa mais do que parece — ela é a prova executável da ADR-0008 nesta superfície: a
 * empresa **nunca** vem do corpo, e quem a recusa é o `strictObject`, sem uma linha de verificação
 * escrita à mão. Uma implementação que a aceitasse e a ignorasse passaria por todas as outras quinze.
 *
 * ===========================================================================
 * A ORDEM dos dois casos é conteúdo, e o primeiro depende dela
 * ===========================================================================
 *
 * O `CT-627` exige que **nenhuma** das duas empresas tenha chamado o `PUT` antes dele — é o
 * invariante da RD-03 que ele mede, e ele não é reconstituível depois de a linha existir: não há rota
 * que apague a política, e não deve haver. Por isso ele é o primeiro `it` do arquivo, e a contagem
 * `0` do passo 2 é também a **afirmação** dessa precondição: se um caso anterior tivesse configurado
 * a empresa A, este reprovaria ruidosamente, em vez de medir outra coisa em silêncio.
 *
 * O `CT-628` **não** depende de ordem: ele grava a própria precondição pela rota real, e a escrita é
 * idempotente por construção — o corpo é completo, sem campo opcional, de modo que ela descreve um
 * estado final inteiro qualquer que fosse o anterior.
 *
 * ===========================================================================
 * A precondição privilegiada, e por que ela é montada pelo caminho REAL
 * ===========================================================================
 *
 *   * **sessão** — pela rota pública de entrada, com a senha da carga. Nenhum estado de sessão é
 *     forjado, e nenhum cookie é montado à mão;
 *   * **arranjo de chaves** — pelo caminho real da camada de dados (`escreverAjustes` com a coerência
 *     ação→tela validada pela função de domínio), sob o contexto de tenant da empresa da pessoa. É o
 *     mesmo caminho que a rota do Admin usa por dentro, e o mesmo padrão de `test/mora.e2e.spec.ts`.
 *     **Nenhum símbolo de produção nasce para o teste enxergar algo**, nenhuma rota de verificação é
 *     publicada, e `app.empresa_id` nunca é fixado por fora da barreira;
 *   * **o efetivo é AFIRMADO por `GET /v1/sessao`** antes dos casos, e não presumido: sem essa linha,
 *     um `403` nas rotas da automação seria indistinguível de um defeito delas.
 *
 * O arranjo tem **uma chave só**, e a economia é conteúdo: `TELA:automacao_de_cobranca` é a exigência
 * declarada na classe do controlador, e nada nesta task exige outra área — em particular, **não** se
 * concede `ACAO:enviar_cobranca_manual`, que governa o disparo da T10. Conceder mais do que o
 * necessário faria o caso deixar de medir a exigência que ele exercita. O perfil da pessoa da carga é
 * `USUARIO_EMPRESA`, cuja matriz padrão é **só** `TELA:resumo` — é isso que torna a concessão uma
 * precondição de verdade, e não uma formalidade.
 *
 * Quem mede a **recusa** de quem não alcança a área é o `CT-633`, em T12.
 *
 * ===========================================================================
 * De onde vêm o banco, a fila e a credencial (ADR-0006)
 * ===========================================================================
 *
 * De instâncias efêmeras próprias. Nenhuma coordenada de conexão é lida do ambiente: o ambiente do
 * processo é MONTADO a partir do que os helpers devolvem, e a porta é **reservada** (trava atômica)
 * porque o arcabouço confere a origem das requisições com cookie contra o endereço base.
 */

import { randomBytes } from 'node:crypto';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import { type ChaveDoCatalogo, validarCoerenciaDeAjustes } from '@sysloc/auth';
import {
  type AcessoAoBanco,
  abrirAcessoAoBanco,
  contextoDeTenant,
  EMPRESA_A,
  EMPRESA_B,
  escreverAjustes,
  SENHA_DA_CARGA,
} from '@sysloc/db';
import { type CapturadorDeEmail, criarCapturadorDeEmail } from '@sysloc/regua';
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
//        nenhum deles no escopo desta task, e o índice de débitos do `CLAUDE.md`.
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
import { CAMINHO_DA_SESSAO } from '../src/autenticacao/sessao.controller.ts';
import { CAMINHO_DA_AUTOMACAO_DE_COBRANCA } from '../src/automacao/automacao.controller.ts';
import { CAMINHO_DOS_LOCADORES } from '../src/cadastros/locador.controller.ts';
import { CAMINHO_DOS_LOCATARIOS } from '../src/cadastros/locatario.controller.ts';
import { CAMINHO_DAS_COBRANCAS } from '../src/cobrancas/cobranca.controller.ts';
import {
  ENDERECO_DE_ESCUTA,
  PREFIXO_DE_VERSAO,
  TOKEN_PORTA_DE_EMAIL,
} from '../src/configuracao/ambiente.ts';
import { CAMINHO_DOS_CONTRATOS } from '../src/contratos/contrato.controller.ts';
import { CAMINHO_DOS_CONJUNTOS } from '../src/imoveis/conjunto.controller.ts';
import { CAMINHO_DOS_IMOVEIS } from '../src/imoveis/imovel.controller.ts';
import { criarAplicacao } from '../src/main.ts';
import { cpfValido } from './documento.ts';

/** Limite da montagem: banco migrado, semente com credencial, fila e a aplicação real. */
const LIMITE_DE_MONTAGEM_MS = 240_000;

/** Limite de um caso que atravessa HTTP e banco dezenas de vezes. */
const LIMITE_CASO_MS = 120_000;

/** Sufixo do nome do cookie de sessão do arcabouço — o prefixo vem da configuração. */
const SUFIXO_DO_COOKIE_DE_SESSAO = 'session_token';

/** A rota de entrada, composta a partir do prefixo real. Nunca escrita à mão. */
const ROTA_DE_ENTRADA = `${PREFIXO_DAS_ROTAS_DE_IDENTIDADE}/sign-in/email`;

/** Caminho, relativo à raiz, da rota de sessão do produto. Composto, nunca escrito à mão. */
const CAMINHO_DA_SESSAO_CORRENTE = `/${PREFIXO_DE_VERSAO}/${CAMINHO_DA_SESSAO}`;

/** Caminho, relativo à raiz, do recurso singular desta task. */
const POLITICA_DE_AVISO = `/${PREFIXO_DE_VERSAO}/${CAMINHO_DA_AUTOMACAO_DE_COBRANCA}`;

/**
 * A mensagem canônica do `422`, escrita por extenso.
 *
 * Literal, e **não** lida de `MENSAGEM_POR_CODIGO`: os casos comparam corpos inteiros por igualdade,
 * e derivá-la da mesma tabela que o SUT usa faria a asserção concordar consigo mesma — um erro de
 * texto na tabela passaria despercebido nos dois lados.
 */
const MENSAGEM_DE_CAMPO_INVALIDO = 'requisição inválida';

/**
 * O arranjo concedido às duas sessões — **uma chave só**.
 *
 * Literal, e **não** derivado da exigência declarada no controlador: derivá-lo faria a asserção
 * concordar com o SUT, e trocar a exigência da classe deixaria de reprovar caso algum. A ação
 * `ACAO:enviar_cobranca_manual` **não** entra: ela governa o disparo da T10, e concedê-la aqui faria
 * este arquivo deixar de medir a exigência que ele exercita.
 */
const CHAVES_DO_ARRANJO: readonly ChaveDoCatalogo[] = ['TELA:automacao_de_cobranca'];

/** A área que a classe do controlador exige — afirmada no efetivo, nunca suposta. */
const AREA_DA_AUTOMACAO_DE_COBRANCA: ChaveDoCatalogo = 'TELA:automacao_de_cobranca';

/**
 * A ação sensível que o **disparo manual** exige, ao lado da área (T10).
 *
 * Literal, e não importada do controlador, pela mesma razão da área acima: derivá-la do SUT faria a
 * asserção concordar com ele, e trocar a exigência declarada deixaria de reprovar caso algum.
 */
const ACAO_DE_ENVIO_MANUAL: ChaveDoCatalogo = 'ACAO:enviar_cobranca_manual';

/** Caminho, relativo à raiz, da coleção de cobranças — usado para montar o cenário dos avisos. */
const COLECAO_DE_COBRANCAS = `/${PREFIXO_DE_VERSAO}/${CAMINHO_DAS_COBRANCAS}`;

/** Caminho, relativo à raiz, da coleção de contratos. */
const COLECAO_DE_CONTRATOS = `/${PREFIXO_DE_VERSAO}/${CAMINHO_DOS_CONTRATOS}`;

/** A rota de aviso de uma cobrança, composta a partir do dono do segmento — nunca escrita à mão. */
function rotaDosAvisos(codigo: string): string {
  return `${POLITICA_DE_AVISO}/cobrancas/${codigo}/avisos`;
}

/** A mensagem canônica do `404`, escrita por extenso — mesma razão de {@link MENSAGEM_DE_CAMPO_INVALIDO}. */
const MENSAGEM_DE_NAO_ENCONTRADO = 'recurso não encontrado';

/** Os sete campos que `esquemaDoEnvioDeCobranca` publica — a igualdade de conjunto do corpo. */
const CAMPOS_DO_ENVIO = [
  'caminho',
  'causa',
  'cobrancaCodigo',
  'criadoEm',
  'desfecho',
  'destinatario',
  'id',
] as const;

/** O molde do `id` publicado — UUID, porque a tentativa não tem série declarada (ADR-0017). */
const MOLDE_DO_IDENTIFICADOR = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u;

/** O molde do instante publicado — ISO-8601 em UTC, com milissegundos e `Z` literal. */
const MOLDE_DO_INSTANTE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u;

/**
 * A política publicada pela empresa que **nunca** configurou (RD-03).
 *
 * Escrita por extenso, e não derivada de `POLITICA_DE_AVISO_AUSENTE`: é o corpo que o contrato
 * promete a toda empresa nova, e derivá-lo da mesma fonte que o produz faria a asserção concordar
 * consigo mesma. Os seis valores são os padrões das colunas — a régua desligada, o intervalo no piso
 * `1` (zero desligaria a trava que protege a caixa do locatário) e a janela `00:00`–`23:59`, que é a
 * que nunca fecha.
 */
const POLITICA_DESLIGADA = {
  ativo: false,
  diasAntesDoVencimento: 0,
  intervaloMinimoDias: 1,
  janelaInicio: '00:00',
  janelaFim: '23:59',
  canal: 'EMAIL',
} as const;

/** Os três corpos do `CT-627` — dois em sequência na empresa A, e a leitura intocada de B. */
const PRIMEIRA_POLITICA_DE_A = {
  ativo: true,
  diasAntesDoVencimento: 10,
  intervaloMinimoDias: 2,
  janelaInicio: '09:00',
  janelaFim: '18:00',
  canal: 'EMAIL',
} as const;

const SEGUNDA_POLITICA_DE_A = {
  ativo: false,
  diasAntesDoVencimento: 3,
  intervaloMinimoDias: 7,
  janelaInicio: '07:30',
  janelaFim: '20:00',
  canal: 'EMAIL',
} as const;

/** A política de referência do `CT-628` — a que precisa sobreviver intacta às dezesseis recusas. */
const POLITICA_DE_REFERENCIA = {
  ativo: true,
  diasAntesDoVencimento: 5,
  intervaloMinimoDias: 3,
  janelaInicio: '08:00',
  janelaFim: '17:00',
  canal: 'EMAIL',
} as const;

/**
 * As duas bordas EXATAS das faixas fechadas — o controle positivo do `CT-628`.
 *
 * A inferior prende os pisos (`0` dias, intervalo `1`) e a janela que **nunca fecha**; a superior
 * prende os tetos (`90` e `90`) e a janela de **início igual ao fim**, que a comparação `>=` do
 * `refine` admite e uma comparação `>` recusaria.
 */
const BORDA_INFERIOR = {
  ativo: false,
  diasAntesDoVencimento: 0,
  intervaloMinimoDias: 1,
  janelaInicio: '00:00',
  janelaFim: '23:59',
  canal: 'EMAIL',
} as const;

const BORDA_SUPERIOR = {
  ativo: true,
  diasAntesDoVencimento: 90,
  intervaloMinimoDias: 90,
  janelaInicio: '23:59',
  janelaFim: '23:59',
  canal: 'EMAIL',
} as const;

/**
 * O molde que os dois horários publicados precisam casar — `HH:MM`, e nada além.
 *
 * Ancorado nas duas pontas e escrito por extenso aqui, e não importado do contrato: derivá-lo do
 * mesmo objeto que o SUT usa para serializar faria a asserção concordar consigo mesma, e afrouxar a
 * âncora do esquema deixaria de reprovar caso algum. Ver o cabeçalho deste arquivo para por que a
 * forma é conteúdo e não estética.
 */
const MOLDE_DA_HORA_PUBLICADA = /^\d{2}:\d{2}$/u;

/**
 * A pessoa que age na empresa A: `USUARIO_EMPRESA` **da carga**.
 *
 * Ela tem senha definitiva e nenhuma exigência pendente, então a sessão dela nasce **plena** com uma
 * entrada só — e o perfil dela **não** concede `TELA:automacao_de_cobranca` (a matriz de
 * `USUARIO_EMPRESA` é só `TELA:resumo`), que é o que torna a concessão do arranjo uma precondição de
 * verdade.
 */
const QUEM_AGE = pessoaSemeada('usuario.a@exemplo.com.br');

/**
 * A pessoa que age na empresa B: `USUARIO_EMPRESA` **da carga**, com o mesmo estado inicial da de A.
 *
 * **Nenhuma rota recebe a empresa dela**: o que separa uma sessão da outra é o cookie, e é a guarda
 * que publica o contexto a partir da sessão.
 */
const QUEM_AGE_EM_B = pessoaSemeada('usuario.b1@exemplo.com.br');

/**
 * Quem age nas rotas de **aviso** (T10): a `ADMIN_EMPRESA` da carga, em cada empresa.
 *
 * ⚠️ **Por que outra pessoa, e não a de cima.** O arranjo de {@link QUEM_AGE} tem **uma chave só**, e
 * a economia é conteúdo declarado no cabeçalho: é ela que faz o CT-627 e o CT-628 medirem a exigência
 * que exercitam. Conceder-lhe a ação do disparo destruiria essa propriedade — e a decisão registrada
 * ali diz, com todas as letras, que `ACAO:enviar_cobranca_manual` **não** entra naquele arranjo.
 *
 * A administradora resolve isso sem tocar em nada: a matriz do perfil `ADMIN_EMPRESA` é o catálogo
 * inteiro (`packages/auth/src/matriz-de-perfil.ts`), de modo que ela já tem a área, a ação e as áreas
 * de cadastro necessárias para montar o cenário pelas rotas reais. **Nenhum ajuste individual é
 * escrito para ela**, e o efetivo é AFIRMADO por `GET /v1/sessao` antes dos casos — sem isso, um
 * `403` no disparo seria indistinguível de um defeito dele, e a recusa por ESTADO do CT-630 não
 * poderia ser atribuída ao estado.
 */
const QUEM_ADMINISTRA = pessoaSemeada('admin.a@exemplo.com.br');
const QUEM_ADMINISTRA_EM_B = pessoaSemeada('admin.b@exemplo.com.br');

let identidade: IdentidadeEfemera;
let fila: FilaEfemera;
let acessoAoNegocio: AcessoAoBanco;
let aplicacao: NestFastifyApplication;
let base: string;
let ambienteAnterior: NodeJS.ProcessEnv;
let cookie: string;
let cookieDeB: string;

/**
 * A aplicação **instrumentada** dos casos de aviso, e o capturador que ela recebe no lugar do SMTP.
 *
 * A substituição é feita pelo **arcabouço de teste** (`overrideProvider` sobre o token que a
 * composição já publica), e não por um caminho aberto no código de produção: `criarAplicacao()` **não
 * ganhou parâmetro**, nada em `apps/api/src` ganhou bandeira ou ramo, e o capturador implementa a
 * MESMA `PortaDeEnvioDeEmail` que o adaptador de produção — de dentro, a régua não sabe qual dos dois
 * recebeu. É o mesmo mecanismo, sobre o mesmo tipo de token, que `contexto.e2e.spec.ts` e
 * `saude.e2e.spec.ts` já usam para o registrador.
 *
 * Ela divide a instância efêmera de banco com a aplicação real acima — as sessões são estado do banco
 * —, e tem porta reservada própria, porque o arcabouço de identidade confere a origem das requisições
 * com cookie contra o endereço base.
 */
let aplicacaoComCaptura: NestFastifyApplication;
let baseComCaptura: string;
let capturador: CapturadorDeEmail;
let cookieDeAdmin: string;
let cookieDeAdminEmB: string;

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

  aplicacao = await criarAplicacao();
  await aplicacao.listen({ port: porta, host: ENDERECO_DE_ESCUTA });

  cookie = await entrar(QUEM_AGE.email, SENHA_DA_CARGA);
  await conceder(QUEM_AGE.id, EMPRESA_A.id, CHAVES_DO_ARRANJO);

  cookieDeB = await entrar(QUEM_AGE_EM_B.email, SENHA_DA_CARGA);
  await conceder(QUEM_AGE_EM_B.id, EMPRESA_B.id, CHAVES_DO_ARRANJO);

  // Precondição AFIRMADA, e não suposta, nas DUAS sessões: sem estas linhas, um `403` nas rotas da
  // automação seria indistinguível de um defeito delas.
  for (const credencial of [cookie, cookieDeB]) {
    const sessao = (await pedir(CAMINHO_DA_SESSAO_CORRENTE, { cookie: credencial }))
      .corpo as SessaoPublicada;
    expect(sessao.telas).toContain(AREA_DA_AUTOMACAO_DE_COBRANCA);
  }

  // -------------------------------------------------------------------------------------------
  // A aplicação INSTRUMENTADA dos casos de aviso — a porta de e-mail trocada de fora (T10)
  // -------------------------------------------------------------------------------------------
  capturador = criarCapturadorDeEmail();
  const portaComCaptura = await reservarPorta();
  baseComCaptura = `http://${ENDERECO_DE_ESCUTA}:${String(portaComCaptura)}`;
  process.env.PORT = String(portaComCaptura);

  const modulo = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(TOKEN_PORTA_DE_EMAIL)
    .useValue(capturador)
    .compile();

  aplicacaoComCaptura = modulo.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
  // Sem as exclusões da aplicação real, de propósito: nenhum caso desta aplicação toca as rotas de
  // saúde nem o contrato publicado, e reproduzir a lista aqui criaria uma segunda cópia dela livre
  // para divergir. O que importa é que `/v1/auth` e as quatro rotas da área atendam sob o prefixo.
  aplicacaoComCaptura.setGlobalPrefix(PREFIXO_DE_VERSAO);
  await aplicacaoComCaptura.listen({ port: portaComCaptura, host: ENDERECO_DE_ESCUTA });

  cookieDeAdmin = await entrar(QUEM_ADMINISTRA.email, SENHA_DA_CARGA, baseComCaptura);
  cookieDeAdminEmB = await entrar(QUEM_ADMINISTRA_EM_B.email, SENHA_DA_CARGA, baseComCaptura);

  // O efetivo das DUAS sessões administradoras é AFIRMADO, e não presumido — ver o docblock de
  // `QUEM_ADMINISTRA`. Sem estas linhas, o `403` e a recusa por estado do CT-630 seriam
  // indistinguíveis, e nenhum dos dois casos mediria o que promete.
  for (const credencial of [cookieDeAdmin, cookieDeAdminEmB]) {
    const sessao = (
      await pedir(CAMINHO_DA_SESSAO_CORRENTE, { cookie: credencial, base: baseComCaptura })
    ).corpo as SessaoPublicada;

    expect(sessao.telas).toContain(AREA_DA_AUTOMACAO_DE_COBRANCA);
    expect(sessao.acoes).toContain(ACAO_DE_ENVIO_MANUAL);
  }
}, LIMITE_DE_MONTAGEM_MS);

afterAll(async () => {
  await aplicacaoComCaptura?.close();
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

describe('a política de aviso por empresa (T9)', () => {
  it(
    'CT-627 — a leitura de quem nunca configurou devolve a régua desligada sem criar linha, e o PUT regrava a MESMA linha',
    async () => {
      // -------------------------------------------------------------------------------------
      // Passo 1 — a empresa A NUNCA configurou: `200` com a régua desligada, e jamais `404`
      // -------------------------------------------------------------------------------------
      //
      // O corpo INTEIRO por igualdade estrita, e não a presença de campos: um `id` ou um `empresaId`
      // vazando reprova aqui. E o status é afirmado à parte, porque é ele que carrega a metade da
      // RD-03 que um corpo correto não distinguiria — `404` com corpo de erro também "não tem
      // política", e é exatamente a resposta que a regra proíbe.
      const semPolitica = await pedir(POLITICA_DE_AVISO, { cookie });

      expect(semPolitica.status).toBe(200);
      expect(semPolitica.corpo).toStrictEqual(POLITICA_DESLIGADA);

      // -------------------------------------------------------------------------------------
      // Passo 2 — a leitura NÃO criou linha: a segunda metade da RD-03
      // -------------------------------------------------------------------------------------
      //
      // É a metade que passa despercebida: uma leitura que gravasse a linha desligada devolveria
      // exatamente o mesmo corpo do passo 1, e nenhuma asserção sobre a resposta a pegaria. A
      // contagem também AFIRMA a precondição deste caso — nenhuma empresa configurou ainda.
      expect(await contarPoliticas(EMPRESA_A.id)).toBe(0);
      expect(await contarPoliticas(EMPRESA_B.id)).toBe(0);

      // -------------------------------------------------------------------------------------
      // Passo 3 — a primeira gravação ECOA o corpo gravado, e a leitura o devolve
      // -------------------------------------------------------------------------------------
      const primeira = await pedir(POLITICA_DE_AVISO, {
        metodo: 'PUT',
        cookie,
        corpo: { ...PRIMEIRA_POLITICA_DE_A },
      });

      expect(primeira.status).toBe(200);
      expect(primeira.corpo).toStrictEqual(PRIMEIRA_POLITICA_DE_A);
      expect(await lerPolitica(cookie)).toStrictEqual(PRIMEIRA_POLITICA_DE_A);
      expect(await contarPoliticas(EMPRESA_A.id)).toBe(1);

      // -------------------------------------------------------------------------------------
      // Passo 4 — a REGRAVAÇÃO, com os SEIS campos diferentes, ainda na MESMA linha
      // -------------------------------------------------------------------------------------
      //
      // Os seis mudam de propósito: um corpo que repetisse um dos valores deixaria de discriminar
      // uma escrita que atualizasse só parte das colunas. E a contagem `1` é o discriminador do
      // `upsert` — sem ela, uma implementação que inserisse uma linha por chamada passaria em todas
      // as leituras, porque a última inserida venceria em qualquer ordenação estável.
      const segunda = await pedir(POLITICA_DE_AVISO, {
        metodo: 'PUT',
        cookie,
        corpo: { ...SEGUNDA_POLITICA_DE_A },
      });

      expect(segunda.status).toBe(200);
      expect(segunda.corpo).toStrictEqual(SEGUNDA_POLITICA_DE_A);

      const relida = await pedir(POLITICA_DE_AVISO, { cookie });

      expect(relida.status).toBe(200);
      expect(relida.corpo).toStrictEqual(SEGUNDA_POLITICA_DE_A);
      expect(await contarPoliticas(EMPRESA_A.id)).toBe(1);

      // -------------------------------------------------------------------------------------
      // Passo 4-b — os dois horários voltam em `HH:MM`, pelo caminho INTEIRO
      // -------------------------------------------------------------------------------------
      //
      // A obrigação é da projeção `to_char(coluna, 'HH24:MI')`, e o `CT-608` já a prova na porta;
      // o que só esta linha alcança é o caminho de ponta a ponta — gravado pela rota, relido pela
      // rota. E aqui o discriminante é INTEIRO, não metade: o esquema de SAÍDA **não é aplicado em
      // tempo de execução** (o cabeçalho mede e nomeia o mecanismo), de modo que uma projeção crua
      // devolveria `200` com `'07:30:00'` em silêncio — sem queda, sem erro, sem rede. As três
      // linhas abaixo, com a igualdade de corpo do passo acima, são a única coisa entre o defeito e
      // o cliente: nenhuma delas é redundante com o `200`, que nada afirma sobre a forma.
      const janela = relida.corpo as { readonly janelaInicio: string; readonly janelaFim: string };

      expect(janela.janelaInicio).toMatch(MOLDE_DA_HORA_PUBLICADA);
      expect(janela.janelaFim).toMatch(MOLDE_DA_HORA_PUBLICADA);
      expect([janela.janelaInicio.length, janela.janelaFim.length]).toStrictEqual([5, 5]);

      // -------------------------------------------------------------------------------------
      // Passo 5 — a empresa B, e o isolamento nos DOIS sentidos
      // -------------------------------------------------------------------------------------
      //
      // Nenhuma rota recebe empresa: o que decide onde a política nasce é o cookie. B continua lendo
      // a régua DESLIGADA depois de duas gravações de A — e a contagem de B continua em `0`, o que
      // separa "a leitura de B não enxerga a linha de A" de "a escrita de A não criou linha em B".
      expect(await lerPolitica(cookieDeB)).toStrictEqual(POLITICA_DESLIGADA);
      expect(await contarPoliticas(EMPRESA_B.id)).toBe(0);

      // E a leitura de A depois da leitura de B: sem esta linha, uma implementação sem escopo
      // devolveria o mesmo corpo nas duas sessões e ninguém saberia de qual delas ele veio.
      expect(await lerPolitica(cookie)).toStrictEqual(SEGUNDA_POLITICA_DE_A);
      expect(await contarPoliticas(EMPRESA_A.id)).toBe(1);
    },
    LIMITE_CASO_MS,
  );

  it(
    'CT-628 — o PUT recusa corpo incompleto, canal não implementado, faixa estourada, janela invertida e chave extra; e a recusa não escreve',
    async () => {
      // A precondição é gravada pela rota real, e o caso NÃO depende de ordem por causa disso: o
      // corpo é completo, então a escrita descreve um estado final inteiro qualquer que fosse o
      // anterior.
      const precondicao = await pedir(POLITICA_DE_AVISO, {
        metodo: 'PUT',
        cookie,
        corpo: { ...POLITICA_DE_REFERENCIA },
      });

      expect(precondicao.status).toBe(200);
      expect(precondicao.corpo).toStrictEqual(POLITICA_DE_REFERENCIA);

      const antes = await contarPoliticas(EMPRESA_A.id);

      /**
       * Os dezesseis corpos recusados, cada um com o campo que a resposta nomeia.
       *
       * Os seis primeiros são a metade que mais importa desta superfície: **campo ausente é recusa**,
       * e nunca "preserve o valor atual" (§4.1.1 do tech spec). O campo nomeado é o que falta, porque
       * é o primeiro problema que o esquema encontra — e é a informação que resolve a situação.
       *
       * A chave desconhecida e o `empresaId` nomeiam `corpo` porque o Zod reporta
       * `unrecognized_keys` com caminho vazio, e é o campo padrão do ponto de chamada que a batiza.
       *
       * O canal em minúscula (`'email'`) está ao lado do canal inexistente (`'SMS'`) de propósito: o
       * enum é fechado **e** sensível à caixa, e uma implementação que normalizasse a caixa aceitaria
       * o primeiro em silêncio.
       */
      const recusas: readonly {
        readonly rotulo: string;
        readonly campo: string;
        readonly corpo: Record<string, unknown>;
      }[] = [
        {
          rotulo: 'sem ativo',
          campo: 'ativo',
          corpo: semOCampo('ativo'),
        },
        {
          rotulo: 'sem diasAntesDoVencimento',
          campo: 'diasAntesDoVencimento',
          corpo: semOCampo('diasAntesDoVencimento'),
        },
        {
          rotulo: 'sem intervaloMinimoDias',
          campo: 'intervaloMinimoDias',
          corpo: semOCampo('intervaloMinimoDias'),
        },
        {
          rotulo: 'sem janelaInicio',
          campo: 'janelaInicio',
          corpo: semOCampo('janelaInicio'),
        },
        {
          rotulo: 'sem janelaFim',
          campo: 'janelaFim',
          corpo: semOCampo('janelaFim'),
        },
        {
          rotulo: 'sem canal',
          campo: 'canal',
          corpo: semOCampo('canal'),
        },
        {
          rotulo: 'canal que o produto não implementa',
          campo: 'canal',
          corpo: { ...POLITICA_DE_REFERENCIA, canal: 'SMS' },
        },
        {
          rotulo: 'canal com a caixa trocada',
          campo: 'canal',
          corpo: { ...POLITICA_DE_REFERENCIA, canal: 'email' },
        },
        {
          rotulo: 'dias um abaixo do piso da faixa',
          campo: 'diasAntesDoVencimento',
          corpo: { ...POLITICA_DE_REFERENCIA, diasAntesDoVencimento: -1 },
        },
        {
          rotulo: 'dias um acima do teto da faixa',
          campo: 'diasAntesDoVencimento',
          corpo: { ...POLITICA_DE_REFERENCIA, diasAntesDoVencimento: 91 },
        },
        {
          // O piso do intervalo é **1**, e não 0: zero desligaria a trava que protege a caixa do
          // locatário, e desligar a régua se faz por `ativo`, nunca por valor de borda de um campo
          // que significa outra coisa.
          rotulo: 'intervalo um abaixo do piso da faixa',
          campo: 'intervaloMinimoDias',
          corpo: { ...POLITICA_DE_REFERENCIA, intervaloMinimoDias: 0 },
        },
        {
          rotulo: 'intervalo um acima do teto da faixa',
          campo: 'intervaloMinimoDias',
          corpo: { ...POLITICA_DE_REFERENCIA, intervaloMinimoDias: 91 },
        },
        {
          // `24:00` é a hora que não existe, e a âncora do molde é quem a recusa. Ela nomeia
          // `janelaInicio`, e não `janelaFim`: a guarda do `refine` existe justamente para que a
          // comparação não produza uma segunda questão sobre o campo que está correto.
          rotulo: 'horário fora do molde de vinte e quatro horas',
          campo: 'janelaInicio',
          corpo: { ...POLITICA_DE_REFERENCIA, janelaInicio: '24:00' },
        },
        {
          // Janela invertida é recusada, e não reinterpretada como "a noite inteira" (§6.4).
          rotulo: 'janela invertida',
          campo: 'janelaFim',
          corpo: { ...POLITICA_DE_REFERENCIA, janelaInicio: '18:00', janelaFim: '09:00' },
        },
        {
          rotulo: 'chave desconhecida no corpo',
          campo: 'corpo',
          corpo: { ...POLITICA_DE_REFERENCIA, remetente: 'cobranca@exemplo.com.br' },
        },
        {
          // A prova executável da ADR-0008 nesta superfície: a empresa NUNCA vem do corpo, e quem a
          // recusa é o `strictObject`, sem uma linha de verificação escrita à mão.
          rotulo: 'empresa proposta pelo corpo',
          campo: 'corpo',
          corpo: { ...POLITICA_DE_REFERENCIA, empresaId: EMPRESA_B.id },
        },
      ];

      // A tabela cobre as dezesseis recusas — afirmado sobre a própria tabela, antes de percorrê-la.
      // Sem isto, uma lista truncada faria o laço passar sobre menos corpos do que a §6.1 enumera,
      // que é o modo de falha silencioso desta classe de caso.
      expect(recusas.length).toBe(16);

      for (const { rotulo, campo, corpo } of recusas) {
        const resposta = await pedir(POLITICA_DE_AVISO, { metodo: 'PUT', cookie, corpo });

        expect(resposta.status, rotulo).toBe(422);
        // O envelope INTEIRO por igualdade estrita, e não a presença de campos: `detalhes` **não**
        // aparece, e o valor recusado **não** é ecoado — o que sai é o nome do campo culpado.
        expect(resposta.corpo, rotulo).toStrictEqual({
          codigo: CodigoErro.CAMPO_INVALIDO,
          mensagem: MENSAGEM_DE_CAMPO_INVALIDO,
          campo,
        });

        // A releitura acontece DEPOIS DE CADA recusa, e não uma vez ao fim: é ela que separa
        // *recusado* de *aceito com efeito parcial*, e ao fim do laço não se saberia qual das
        // dezesseis teria escrito.
        expect(await lerPolitica(cookie), rotulo).toStrictEqual(POLITICA_DE_REFERENCIA);
      }

      // -------------------------------------------------------------------------------------
      // Nenhuma das DEZESSEIS recusas escreveu — e a contagem crua é a outra metade
      // -------------------------------------------------------------------------------------
      //
      // A releitura acima prova que o VALOR não mudou; a contagem prova que nenhuma linha nasceu —
      // uma escrita parcial que inserisse uma segunda linha poderia deixar a leitura intacta e ainda
      // assim ter gravado.
      expect(await contarPoliticas(EMPRESA_A.id)).toBe(antes);

      // -------------------------------------------------------------------------------------
      // CONTROLE POSITIVO: as duas bordas EXATAS das faixas são ACEITAS
      // -------------------------------------------------------------------------------------
      //
      // Sem ele, tudo acima seria satisfeito por uma validação que recusasse todo corpo. Ver o
      // cabeçalho deste arquivo para o que cada borda prende.
      for (const borda of [BORDA_INFERIOR, BORDA_SUPERIOR]) {
        const aceita = await pedir(POLITICA_DE_AVISO, {
          metodo: 'PUT',
          cookie,
          corpo: { ...borda },
        });

        expect(aceita.status).toBe(200);
        expect(aceita.corpo).toStrictEqual(borda);
        expect(await lerPolitica(cookie)).toStrictEqual(borda);
      }

      // E as duas escritas de borda continuaram atualizando a MESMA linha.
      expect(await contarPoliticas(EMPRESA_A.id)).toBe(antes);
    },
    LIMITE_CASO_MS,
  );
});

describe('as duas rotas de aviso (T10)', () => {
  it(
    'CT-629 — o disparo manual envia mesmo fora da janela e com aviso recente, e registra como MANUAL',
    async () => {
      // -------------------------------------------------------------------------------------
      // Arranjo — as DUAS condições de oportunidade violadas ao mesmo tempo
      // -------------------------------------------------------------------------------------
      //
      // É a simultaneidade que torna o caso discriminante: uma implementação que dispensasse só a
      // janela, ou só a trava, passaria num arranjo que violasse uma delas de cada vez.
      const cenario = await contratoAtivo(cookieDeAdmin);
      const cobranca = await lancarEm(cenario.codigo, -20);

      await definirJanelaQueNaoContemAgora();
      await semearTentativa(cobranca.codigo, {
        caminho: 'AUTOMATICO',
        desfecho: 'ENVIADA',
        destinatario: cenario.emailDoLocatario,
        causa: null,
        diasAtras: 1,
      });

      const capturasAntes = capturador.capturas.length;
      expect(await contarEnvios(cobranca.codigo)).toBe(1);

      // -------------------------------------------------------------------------------------
      // Passo 1 — o disparo responde `200`, e o corpo é a linha do registro
      // -------------------------------------------------------------------------------------
      const resposta = await pedir(rotaDosAvisos(cobranca.codigo), {
        metodo: 'POST',
        cookie: cookieDeAdmin,
        corpo: {},
        base: baseComCaptura,
      });

      // `200`, e não `201`: o ato registra um envio, e a linha é consequência dele — a mesma
      // escolha, e a mesma razão, das rotas de transição de `CobrancaController`.
      expect(resposta.status).toBe(200);

      const registro = resposta.corpo as EnvioPublicado;

      // O corpo INTEIRO: a igualdade de conjunto de campos fecha o que sai, e cada valor é afirmado
      // por igualdade exata. Um `empresaId` ou um `cobrancaId` vazando reprova na primeira linha.
      expect(Object.keys(registro).sort()).toEqual([...CAMPOS_DO_ENVIO]);
      expect(registro.cobrancaCodigo).toBe(cobranca.codigo);
      expect(registro.caminho).toBe('MANUAL');
      expect(registro.desfecho).toBe('ENVIADA');
      expect(registro.destinatario).toBe(cenario.emailDoLocatario);
      expect(registro.causa).toBeNull();
      expect(registro.id).toMatch(MOLDE_DO_IDENTIFICADOR);
      expect(registro.criadoEm).toMatch(MOLDE_DO_INSTANTE);

      // -------------------------------------------------------------------------------------
      // Passo 2 — saiu EXATAMENTE uma mensagem, para o endereço do locatário
      // -------------------------------------------------------------------------------------
      //
      // O comprimento é o discriminador: sem ele, uma implementação que entregasse duas vezes — ou
      // nenhuma, gravando `ENVIADA` sem falar com a porta — passaria em tudo acima.
      expect(capturador.capturas.length).toBe(capturasAntes + 1);
      expect(capturador.capturas.at(-1)?.destinatario).toBe(cenario.emailDoLocatario);

      // -------------------------------------------------------------------------------------
      // Passo 3 — a contagem crua sobe de `1` para `2`
      // -------------------------------------------------------------------------------------
      expect(await contarEnvios(cobranca.codigo)).toBe(2);

      // -------------------------------------------------------------------------------------
      // Companheiro — a falha de entrega responde `200` com `FALHOU` e a causa
      // -------------------------------------------------------------------------------------
      //
      // A porta passa a recusar aquele endereço, pela MESMA interface da produção — o domínio não
      // sabe que a falha foi provocada. E o disparo acontece com uma tentativa `ENVIADA` de segundos
      // atrás: se a trava valesse para o manual, esta chamada não enviaria nada.
      const causaDaRecusa = 'conexão recusada pelo transporte';
      capturador.recusar(cenario.emailDoLocatario, causaDaRecusa);

      const comFalha = await pedir(rotaDosAvisos(cobranca.codigo), {
        metodo: 'POST',
        cookie: cookieDeAdmin,
        corpo: {},
        base: baseComCaptura,
      });

      // `200`, e não `502`: a requisição do operador foi atendida — a tentativa foi feita e
      // registrada —, e o que fracassou foi a comunicação com terceiro. Um erro esconderia dele o
      // `id` do registro que ele precisa para consultar o histórico.
      expect(comFalha.status).toBe(200);

      const falhado = comFalha.corpo as EnvioPublicado;

      expect(falhado.desfecho).toBe('FALHOU');
      expect(falhado.causa).toBe(causaDaRecusa);
      expect(falhado.caminho).toBe('MANUAL');
      expect(falhado.id).not.toBe(registro.id);
      // A entrega recusada NÃO entra em `capturas` — a lista responde *"o que saiu"* —, e a linha
      // nasceu assim mesmo: é a distinção entre não enviar e não registrar.
      expect(capturador.capturas.length).toBe(capturasAntes + 1);
      expect(await contarEnvios(cobranca.codigo)).toBe(3);
    },
    LIMITE_CASO_MS,
  );

  it(
    'CT-630 — REG-08: o disparo sobre CANCELADA e sobre PAGA é recusado, e nenhuma mensagem sai',
    async () => {
      // Os três estados são alcançados pelas ROTAS REAIS — nunca escrevendo estado, que não existe
      // como coluna: ele é derivado dos fatos por `negocio.cobranca_derivada` (ADR-0022).
      const cenario = await contratoAtivo(cookieDeAdmin);
      const cancelada = await lancarEm(cenario.codigo, -25);
      const paga = await lancarEm(cenario.codigo, -15);
      const controle = await lancarEm(cenario.codigo, -12);

      await cancelarCobranca(cancelada.codigo);
      await pagarCobranca(paga.codigo, -15);

      // A precondição é AFIRMADA pelo estado publicado, e não presumida das rotas chamadas.
      expect((await lerCobranca(cancelada.codigo)).status).toBe('CANCELADA');
      expect((await lerCobranca(paga.codigo)).status).toBe('PAGA');
      expect((await lerCobranca(controle.codigo)).status).toBe('VENCIDA');

      // -------------------------------------------------------------------------------------
      // Passo 1 — as duas medições ANTES
      // -------------------------------------------------------------------------------------
      const capturasAntes = capturador.capturas.length;
      const enviosAntes = {
        cancelada: await contarEnvios(cancelada.codigo),
        paga: await contarEnvios(paga.codigo),
      };

      // -------------------------------------------------------------------------------------
      // Passos 2 e 3 — as duas recusas, com o envelope INTEIRO da ADR-0017
      // -------------------------------------------------------------------------------------
      //
      // `422`, e não `409`: a convenção é a mesma que `cobranca.service.ts` publica para transição
      // em estado terminal, e um segundo status para a mesma classe de fato faria o cliente aprender
      // dois vocabulários. O campo nomeado é `codigo` porque é o único dado da requisição que
      // identifica o alvo — o corpo do disparo é vazio.
      for (const [alvo, estadoAtual] of [
        [cancelada.codigo, 'CANCELADA'],
        [paga.codigo, 'PAGA'],
      ] as const) {
        const recusa = await pedir(rotaDosAvisos(alvo), {
          metodo: 'POST',
          cookie: cookieDeAdmin,
          corpo: {},
          base: baseComCaptura,
        });

        expect(recusa.status, alvo).toBe(422);
        expect(recusa.corpo, alvo).toStrictEqual({
          codigo: CodigoErro.CAMPO_INVALIDO,
          mensagem: MENSAGEM_DE_CAMPO_INVALIDO,
          campo: 'codigo',
          detalhes: { estadoAtual },
        });
      }

      // -------------------------------------------------------------------------------------
      // Passo 4 — nenhuma mensagem saiu, e NENHUMA linha nasceu — nem sequer `FALHOU`
      // -------------------------------------------------------------------------------------
      //
      // ⚠️ Esta é a DIVERGÊNCIA POR VITÓRIA contra o legado. No sistema antigo o caminho manual
      // conhece `Paga` e **não** conhece `Cancelada`, e cobra por dívida cancelada — o golden mede 1
      // mensagem. Aqui os dois caminhos leem a mesma fonte, onde `CANCELADA` tem precedência sobre
      // tudo, e não existe segundo lugar onde o estado se decida.
      expect(capturador.capturas.length).toBe(capturasAntes);
      expect(await contarEnvios(cancelada.codigo)).toBe(enviosAntes.cancelada);
      expect(await contarEnvios(paga.codigo)).toBe(enviosAntes.paga);

      // -------------------------------------------------------------------------------------
      // Passo 5 — o CONTROLE POSITIVO: a VENCIDA é avisada, e produz uma captura nova
      // -------------------------------------------------------------------------------------
      //
      // Sem ele, tudo acima seria satisfeito por uma rota que recusasse todo disparo.
      const aceito = await pedir(rotaDosAvisos(controle.codigo), {
        metodo: 'POST',
        cookie: cookieDeAdmin,
        corpo: {},
        base: baseComCaptura,
      });

      expect(aceito.status).toBe(200);
      expect((aceito.corpo as EnvioPublicado).desfecho).toBe('ENVIADA');
      expect(capturador.capturas.length).toBe(capturasAntes + 1);
      expect(await contarEnvios(controle.codigo)).toBe(1);
    },
    LIMITE_CASO_MS,
  );

  it(
    'CT-631 — o histórico devolve cada tentativa com instante, caminho, destinatário e causa',
    async () => {
      const cenario = await contratoAtivo(cookieDeAdmin);
      const cobranca = await lancarEm(cenario.codigo, -8);

      // As TRÊS naturezas de desfecho, com instantes distintos e decrescentes. Elas são semeadas por
      // instrução própria porque `registrarEnvioDeCobranca` **não abre parâmetro de instante** — o
      // carimbo é do banco, e dar-lhe um parâmetro daria a quem chama o poder de escolher quando a
      // tentativa aconteceu, que é justamente o eixo pelo qual a trava conta o intervalo.
      const causaDaFalha = 'conexão recusada pelo transporte';
      const causaSemContato = 'locatário sem endereço de contato';

      await semearTentativa(cobranca.codigo, {
        caminho: 'AUTOMATICO',
        desfecho: 'ENVIADA',
        destinatario: cenario.emailDoLocatario,
        causa: null,
        diasAtras: 5,
      });
      await semearTentativa(cobranca.codigo, {
        caminho: 'AUTOMATICO',
        desfecho: 'FALHOU',
        destinatario: cenario.emailDoLocatario,
        causa: causaDaFalha,
        diasAtras: 3,
      });
      await semearTentativa(cobranca.codigo, {
        caminho: 'MANUAL',
        desfecho: 'SEM_DESTINATARIO',
        destinatario: '',
        causa: causaSemContato,
        diasAtras: 1,
      });

      // -------------------------------------------------------------------------------------
      // Passo 1 e 2 — `200`, e o envelope INTEIRO com as três tentativas
      // -------------------------------------------------------------------------------------
      const resposta = await pedir(rotaDosAvisos(cobranca.codigo), {
        cookie: cookieDeAdmin,
        base: baseComCaptura,
      });

      expect(resposta.status).toBe(200);

      const pagina = resposta.corpo as PaginaDeEnviosPublicada;

      expect(Object.keys(pagina).sort()).toEqual(['deslocamento', 'itens', 'limite', 'total']);
      // O `total` é o de TODAS as tentativas daquela cobrança, e não o tamanho da página; o `limite`
      // e o `deslocamento` ecoam a janela padrão que `esquemaDaJanela` aplica.
      expect(pagina.total).toBe(3);
      expect(pagina.limite).toBe(50);
      expect(pagina.deslocamento).toBe(0);
      expect(pagina.itens.length).toBe(3);

      // Item a item, do mais recente para o mais antigo — igualdade de projeção, e não presença de
      // campo: um `causa` trocado por `null` no `SEM_DESTINATARIO` reprova aqui.
      expect(
        pagina.itens.map(({ caminho, desfecho, destinatario, causa }) => ({
          caminho,
          desfecho,
          destinatario,
          causa,
        })),
      ).toEqual([
        {
          caminho: 'MANUAL',
          desfecho: 'SEM_DESTINATARIO',
          destinatario: '',
          causa: causaSemContato,
        },
        {
          caminho: 'AUTOMATICO',
          desfecho: 'FALHOU',
          destinatario: cenario.emailDoLocatario,
          causa: causaDaFalha,
        },
        {
          caminho: 'AUTOMATICO',
          desfecho: 'ENVIADA',
          destinatario: cenario.emailDoLocatario,
          causa: null,
        },
      ]);

      // -------------------------------------------------------------------------------------
      // Passo 3 — os instantes são ESTRITAMENTE decrescentes
      // -------------------------------------------------------------------------------------
      //
      // A ordem é afirmada sobre o que voltou, e não deduzida do arranjo: uma consulta sem `ORDER
      // BY` devolveria a ordem física, que coincide com a de inserção e passaria pela igualdade
      // acima por acidente.
      const instantes = pagina.itens.map((item) => item.criadoEm);

      expect([...instantes].sort().reverse()).toEqual(instantes);
      expect(new Set(instantes).size).toBe(3);
      for (const item of pagina.itens) {
        expect(item.criadoEm).toMatch(MOLDE_DO_INSTANTE);
        expect(item.cobrancaCodigo).toBe(cobranca.codigo);
      }

      // -------------------------------------------------------------------------------------
      // Passo 4 — sob o cookie de B, o MESMO código responde `404` indistinguível
      // -------------------------------------------------------------------------------------
      //
      // A empresa B tem carteira própria, montada logo abaixo, de modo que o `404` não se explica
      // por *"B não tem cobrança nenhuma"*. E o corpo é comparado por igualdade com o de um código
      // que não existe em lugar nenhum: se as duas respostas divergissem em um byte, a rota viraria
      // um oráculo de existência sobre o dado alheio.
      await contratoAtivo(cookieDeAdminEmB);

      const sobOutraEmpresa = await pedir(rotaDosAvisos(cobranca.codigo), {
        cookie: cookieDeAdminEmB,
        base: baseComCaptura,
      });
      const inexistente = await pedir(rotaDosAvisos(CODIGO_INEXISTENTE), {
        cookie: cookieDeAdminEmB,
        base: baseComCaptura,
      });

      expect(sobOutraEmpresa.status).toBe(404);
      expect(sobOutraEmpresa.corpo).toStrictEqual({
        codigo: CodigoErro.RECURSO_NAO_ENCONTRADO,
        mensagem: MENSAGEM_DE_NAO_ENCONTRADO,
      });
      expect(sobOutraEmpresa.corpo).toStrictEqual(inexistente.corpo);
      expect(sobOutraEmpresa.status).toBe(inexistente.status);

      // E o controle: sob a sessão de A o mesmo código continua respondendo `200`. Sem esta linha, o
      // `404` de B seria satisfeito por uma rota que respondesse `404` para todo mundo.
      const sobAMesmaEmpresa = await pedir(rotaDosAvisos(cobranca.codigo), {
        cookie: cookieDeAdmin,
        base: baseComCaptura,
      });

      expect(sobAMesmaEmpresa.status).toBe(200);
    },
    LIMITE_CASO_MS,
  );

  it(
    'CT-632 — `:codigo` malformado responde 422 nomeando o campo; código inexistente responde 404',
    async () => {
      // ⚠️ `CTR-2026-00001` está na tabela de propósito: é a série de CONTRATO, bem formada para
      // outro recurso, e discrimina um esquema que só confira comprimento (ADR-0017).
      //
      // SUT_IS_CORRECT_BECAUSE: o card do CT-632 na §6.6 da task lista `cob-2026-0000001` entre os
      // malformados, e a **medição refuta** a premissa: `ESQUEMA_DO_CODIGO_DE_COBRANCA` é
      // `.trim().toUpperCase().pipe(regex)`, de modo que a caixa é **canonizada** por decisão
      // registrada (ADR-0017) — o minúsculo responde `200` porque descreve a MESMA cobrança. O
      // código de produção está certo, e a canonização é justamente o que impede caixa não canonizada
      // de virar vetor de escalada. A linha foi trocada por `COB-2026-000001`, que tem **seis**
      // dígitos onde a série exige sete e discrimina a mesma coisa que a original pretendia — a
      // tabela não encolheu, e o eixo da caixa **ganhou** asserção própria no passo 4, como controle
      // positivo. Nenhuma asserção foi afrouxada.
      const malformados = ['COB-26-1', 'COB-2026-000001', 'CTR-2026-00001'];
      const cenario = await contratoAtivo(cookieDeAdmin);
      const cobranca = await lancarEm(cenario.codigo, -6);
      const enviosAntes = await contarEnvios(cobranca.codigo);

      // -------------------------------------------------------------------------------------
      // Passo 1 — as três linhas malformadas, nas DUAS rotas: seis chamadas, seis `422`
      // -------------------------------------------------------------------------------------
      for (const invalido of malformados) {
        for (const metodo of ['GET', 'POST'] as const) {
          const resposta = await pedir(rotaDosAvisos(invalido), {
            metodo,
            cookie: cookieDeAdmin,
            base: baseComCaptura,
            ...(metodo === 'POST' ? { corpo: {} } : {}),
          });

          const rotulo = `${metodo} ${invalido}`;

          expect(resposta.status, rotulo).toBe(422);
          // O envelope INTEIRO, e o valor recusado NÃO é ecoado — o que sai é o nome do campo.
          expect(resposta.corpo, rotulo).toStrictEqual({
            codigo: CodigoErro.CAMPO_INVALIDO,
            mensagem: MENSAGEM_DE_CAMPO_INVALIDO,
            campo: 'codigo',
          });
          expect(resposta.texto, rotulo).not.toContain(invalido);
        }
      }

      // -------------------------------------------------------------------------------------
      // Passo 2 — nenhuma das seis recusas escreveu
      // -------------------------------------------------------------------------------------
      expect(await contarEnvios(cobranca.codigo)).toBe(enviosAntes);

      // -------------------------------------------------------------------------------------
      // Passo 3 — o código BEM FORMADO e inexistente responde `404` nas duas rotas
      // -------------------------------------------------------------------------------------
      //
      // É o par que separa recusa de FORMA de recusa de EXISTÊNCIA: as duas são distintas, e nenhuma
      // vaza a outra. A sessão tem a conjunção completa, então nem uma nem outra é `403`.
      for (const metodo of ['GET', 'POST'] as const) {
        const resposta = await pedir(rotaDosAvisos(CODIGO_INEXISTENTE), {
          metodo,
          cookie: cookieDeAdmin,
          base: baseComCaptura,
          ...(metodo === 'POST' ? { corpo: {} } : {}),
        });

        expect(resposta.status, metodo).toBe(404);
        expect(resposta.corpo, metodo).toStrictEqual({
          codigo: CodigoErro.RECURSO_NAO_ENCONTRADO,
          mensagem: MENSAGEM_DE_NAO_ENCONTRADO,
        });
      }

      expect(await contarEnvios(cobranca.codigo)).toBe(enviosAntes);

      // -------------------------------------------------------------------------------------
      // Passo 4 — o CONTROLE do eixo da CAIXA: minúsculas são CANONIZADAS, não recusadas
      // -------------------------------------------------------------------------------------
      //
      // Sem esta linha, tudo acima seria satisfeito por um esquema sem `toUpperCase()` — e a caixa
      // não canonizada já foi vetor de escalada (ADR-0017). O código em minúsculas descreve a MESMA
      // cobrança, e o histórico dela responde `200`: é o par que separa *"a forma é conferida"* de
      // *"a forma é conferida sobre o texto cru"*.
      const emMinusculas = await pedir(rotaDosAvisos(cobranca.codigo.toLowerCase()), {
        cookie: cookieDeAdmin,
        base: baseComCaptura,
      });

      expect(emMinusculas.status).toBe(200);
      expect((emMinusculas.corpo as PaginaDeEnviosPublicada).total).toBe(enviosAntes);
    },
    LIMITE_CASO_MS,
  );
});

// ---------------------------------------------------------------------------------------------
// Acessórios — tudo pelas rotas reais, salvo a contagem crua
// ---------------------------------------------------------------------------------------------

/**
 * A política de referência **sem um dos campos** — o corpo incompleto do `CT-628`.
 *
 * Derivado por remoção, e não escrito seis vezes por extenso: seis literais quase iguais ficariam
 * livres para divergir, e o que o caso mede é a ausência de **um** campo, não o resto do corpo. O
 * que é escrito à mão é o **campo nomeado na resposta**, que é a asserção — e ele fica na tabela, ao
 * lado do rótulo.
 */
function semOCampo(campo: keyof typeof POLITICA_DE_REFERENCIA): Record<string, unknown> {
  const { [campo]: _removido, ...resto } = POLITICA_DE_REFERENCIA;

  return resto;
}

/** Lê a política pela rota real e devolve o corpo publicado. A falha levanta. */
async function lerPolitica(credencial: string): Promise<unknown> {
  const resposta = await pedir(POLITICA_DE_AVISO, { cookie: credencial });

  if (resposta.status !== 200) {
    throw new Error(
      `a leitura da política respondeu ${String(resposta.status)}: ${resposta.texto}`,
    );
  }

  return resposta.corpo;
}

// ---------------------------------------------------------------------------------------------
// Acessórios dos casos de aviso (T10) — o cenário nasce pelas ROTAS REAIS
// ---------------------------------------------------------------------------------------------

/** Um código bem formado que **nenhuma** empresa emitiu — o alvo do `404` do CT-631 e do CT-632. */
const CODIGO_INEXISTENTE = 'COB-2026-9999999';

/** O valor de toda cobrança lançada pelos casos de aviso — nenhum deles mede dinheiro. */
const VALOR_DA_PARCELA = 1500;

/** Um contador local, para que cada cadastro do cenário nasça com identificador único. */
let sequencial = 0;

function proximo(): number {
  sequencial += 1;

  return sequencial;
}

/** O cenário mínimo que uma cobrança avisável exige — contrato ativo e o contato do locatário. */
interface CenarioDeAviso {
  readonly codigo: string;
  readonly emailDoLocatario: string;
}

/**
 * Monta conjunto, imóvel, locador, locatário e um contrato **ativo**, pelas rotas reais.
 *
 * `gerarCobrancasAutomaticamente: false` é conteúdo, e não conveniência: a ativação com `true`
 * derivaria as parcelas do contrato inteiro, e os casos deste bloco medem contagem de tentativas por
 * cobrança — uma carteira montada por trás tornaria as contagens dependentes do calendário. Aqui a
 * cobrança que interessa é lançada por {@link lancarEm}, com o vencimento posicionado contra o
 * relógio do banco.
 */
async function contratoAtivo(credencial: string): Promise<CenarioDeAviso> {
  const conjuntoId = (
    await criarPor(CAMINHO_DOS_CONJUNTOS, { nome: `Edifício ${String(proximo())}` }, credencial)
  ).id;
  const imovelId = (await criarPor(CAMINHO_DOS_IMOVEIS, corpoDeImovel(conjuntoId), credencial)).id;
  const locadorId = (await criarPor(CAMINHO_DOS_LOCADORES, corpoDePessoa(), credencial)).id;
  const locatario = corpoDePessoa();
  const locatarioId = (await criarPor(CAMINHO_DOS_LOCATARIOS, locatario, credencial)).id;

  const montagem = await pedir(COLECAO_DE_CONTRATOS, {
    metodo: 'POST',
    cookie: credencial,
    base: baseComCaptura,
    corpo: {
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
    base: baseComCaptura,
    corpo: {},
  });

  if (ativacao.status !== 200) {
    throw new Error(
      `a ativação de ${codigo} respondeu ${String(ativacao.status)}: ${ativacao.texto}`,
    );
  }

  return { codigo, emailDoLocatario: locatario.email as string };
}

/** Cria um cadastro pela rota real e devolve o identificador dele. A falha levanta. */
async function criarPor(
  dono: string,
  corpo: Record<string, unknown>,
  credencial: string,
): Promise<{ id: string }> {
  const alvo = `/${PREFIXO_DE_VERSAO}/${dono}`;
  const resposta = await pedir(alvo, {
    metodo: 'POST',
    cookie: credencial,
    corpo,
    base: baseComCaptura,
  });

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
 * Lança uma cobrança com o vencimento deslocado em `dias` a partir do **relógio do banco**.
 *
 * É assim que todo estado destes casos é posicionado: o relógio nunca é falseado, o dado é que se
 * move — a mesma convenção de `test/cobrancas.e2e.spec.ts`. Deslocamento negativo produz `VENCIDA`.
 */
async function lancarEm(contratoCodigo: string, dias: number): Promise<CobrancaPublicada> {
  const datas = await datasEm(dias);
  const resposta = await pedir(COLECAO_DE_COBRANCAS, {
    metodo: 'POST',
    cookie: cookieDeAdmin,
    base: baseComCaptura,
    corpo: {
      contratoCodigo,
      natureza: 'ALUGUEL',
      referencia: 'Aluguel do cenário de aviso',
      competencia: datas.competencia,
      dataVencimento: datas.vencimento,
      valorOriginal: VALOR_DA_PARCELA,
    },
  });

  if (resposta.status !== 201) {
    throw new Error(`o lançamento respondeu ${String(resposta.status)}: ${resposta.texto}`);
  }

  return resposta.corpo as CobrancaPublicada;
}

/** Acusa o pagamento pela rota real — o caminho legítimo até o estado `PAGA`. */
async function pagarCobranca(codigo: string, diasDoPagamento: number): Promise<void> {
  const datas = await datasEm(diasDoPagamento);
  const resposta = await pedir(`${COLECAO_DE_COBRANCAS}/${codigo}/pagamento`, {
    metodo: 'POST',
    cookie: cookieDeAdmin,
    base: baseComCaptura,
    corpo: { pagoEm: datas.vencimento, valorPago: VALOR_DA_PARCELA },
  });

  if (resposta.status !== 200) {
    throw new Error(
      `o pagamento de ${codigo} respondeu ${String(resposta.status)}: ${resposta.texto}`,
    );
  }
}

/** Cancela pela rota real — o caminho legítimo até o estado `CANCELADA`. */
async function cancelarCobranca(codigo: string): Promise<void> {
  const resposta = await pedir(`${COLECAO_DE_COBRANCAS}/${codigo}/cancelamento`, {
    metodo: 'POST',
    cookie: cookieDeAdmin,
    base: baseComCaptura,
    corpo: {},
  });

  if (resposta.status !== 200) {
    throw new Error(
      `o cancelamento de ${codigo} respondeu ${String(resposta.status)}: ${resposta.texto}`,
    );
  }
}

/** Lê uma cobrança pela rota real — é dela que sai o `status` publicado, nunca de uma coluna. */
async function lerCobranca(codigo: string): Promise<CobrancaPublicada> {
  const resposta = await pedir(`${COLECAO_DE_COBRANCAS}/${codigo}`, {
    cookie: cookieDeAdmin,
    base: baseComCaptura,
  });

  if (resposta.status !== 200) {
    throw new Error(
      `a leitura de ${codigo} respondeu ${String(resposta.status)}: ${resposta.texto}`,
    );
  }

  return resposta.corpo as CobrancaPublicada;
}

/**
 * O par competência/vencimento deslocado em `dias` a partir do relógio do banco.
 *
 * O eixo é `negocio.data_corrente_da_operacao()` — o **mesmo** que a visão consulta para decidir o
 * estado —, e não o calendário do processo: comparar por um eixo e classificar por outro faria a
 * fronteira do vencimento discordar de si mesma nas horas em torno da virada (ADR-0026).
 */
async function datasEm(dias: number): Promise<{ competencia: string; vencimento: string }> {
  return await contextoDeTenant.executarCom(
    { empresaId: EMPRESA_A.id },
    async () =>
      await acessoAoNegocio.emUnidadeDeTrabalho(async (tx) => {
        const [linha] = await tx<{ competencia: string; vencimento: string }[]>`
          SELECT to_char(
                   date_trunc(
                     'month',
                     negocio.data_corrente_da_operacao() + make_interval(days => ${dias})
                   ),
                   'YYYY-MM-DD'
                 ) AS competencia,
                 to_char(
                   negocio.data_corrente_da_operacao() + make_interval(days => ${dias}),
                   'YYYY-MM-DD'
                 ) AS vencimento
        `;

        if (linha === undefined) {
          throw new Error('o relógio do banco não devolveu as datas do cenário');
        }

        return linha;
      }),
  );
}

/**
 * Define, pela rota real, uma política **ativa** cuja janela NÃO contém o instante corrente.
 *
 * A janela é escolhida a partir da hora do **banco**, e a escolha é entre duas metades fixas do dia:
 * é o que a torna determinística e a impede de nascer invertida — uma janela montada por
 * `agora + 2h` cruzaria a meia-noite entre 21h e 22h, seria recusada pelo `refine` do contrato, e o
 * caso ficaria vermelho uma hora por dia sem que nada estivesse errado no produto.
 *
 * A exclusão é **AFIRMADA** aqui, e não presumida da aritmética: sem esta asserção, uma escolha
 * errada faria o CT-629 medir um disparo dentro da janela e ainda assim passar.
 */
async function definirJanelaQueNaoContemAgora(): Promise<void> {
  const agora = await horaCorrenteDaOperacao();
  const primeiraMetade = agora < '12:00';
  const janelaInicio = primeiraMetade ? '12:00' : '00:00';
  const janelaFim = primeiraMetade ? '23:59' : '11:59';

  expect(agora >= janelaInicio && agora <= janelaFim).toBe(false);

  const resposta = await pedir(POLITICA_DE_AVISO, {
    metodo: 'PUT',
    cookie: cookieDeAdmin,
    base: baseComCaptura,
    corpo: {
      ativo: true,
      diasAntesDoVencimento: 5,
      intervaloMinimoDias: 30,
      janelaInicio,
      janelaFim,
      canal: 'EMAIL',
    },
  });

  if (resposta.status !== 200) {
    throw new Error(
      `a definição da política respondeu ${String(resposta.status)}: ${resposta.texto}`,
    );
  }
}

/** A hora corrente da operação no molde `HH:MM`, lida do MESMO relógio que a régua consulta. */
async function horaCorrenteDaOperacao(): Promise<string> {
  return await contextoDeTenant.executarCom(
    { empresaId: EMPRESA_A.id },
    async () =>
      await acessoAoNegocio.emUnidadeDeTrabalho(async (tx) => {
        const [linha] = await tx<{ hora: string }[]>`
          SELECT to_char(now() AT TIME ZONE 'America/Sao_Paulo', 'HH24:MI') AS hora
        `;

        if (linha === undefined) {
          throw new Error('o relógio do banco não devolveu a hora corrente da operação');
        }

        return linha.hora;
      }),
  );
}

/** Uma tentativa semeada no passado — a precondição que a porta de produção não sabe montar. */
interface TentativaSemeada {
  readonly caminho: string;
  readonly desfecho: string;
  readonly destinatario: string;
  readonly causa: string | null;
  readonly diasAtras: number;
}

/**
 * Grava uma tentativa de envio **por instrução própria**, com o instante deslocado para trás.
 *
 * `registrarEnvioDeCobranca` não abre parâmetro de instante — o carimbo é o `DEFAULT now()` da tabela
 * (ADR-0026) —, e é por esse instante que a trava conta o intervalo e o histórico ordena. Abrir um
 * parâmetro na porta daria a quem chama, e a quem verifica, o poder de escolher quando a tentativa
 * aconteceu: seria símbolo de produção a serviço do teste. Por isso o arranjo desce ao SQL, como a
 * contagem crua acima.
 *
 * A instrução corre com o papel da aplicação, sob a política de linha, e **não compara `empresa_id`
 * com coisa alguma**: a empresa sai da mesma expressão que as políticas avaliam, e o `WITH CHECK` é
 * quem aceita ou recusa a linha (ADR-0008).
 */
async function semearTentativa(codigo: string, tentativa: TentativaSemeada): Promise<void> {
  await contextoDeTenant.executarCom({ empresaId: EMPRESA_A.id }, async () => {
    await acessoAoNegocio.emUnidadeDeTrabalho(async (tx) => {
      await tx`
        INSERT INTO negocio.envio_de_cobranca (
          empresa_id, cobranca_id, criado_em, caminho, desfecho, destinatario, causa
        )
        SELECT nullif(current_setting('app.empresa_id', true), '')::uuid,
               c.id,
               now() - make_interval(days => ${tentativa.diasAtras}),
               ${tentativa.caminho}::negocio.caminho_do_aviso,
               ${tentativa.desfecho}::negocio.desfecho_do_aviso,
               ${tentativa.destinatario},
               ${tentativa.causa}
          FROM negocio.cobranca c
         WHERE c.codigo = ${codigo}
      `;
    });
  });
}

/**
 * Quantas tentativas de envio existem para a cobrança informada — contagem **crua**, sem recorte.
 *
 * Nenhum `WHERE empresa_id` é escrito aqui: quem recorta é a política (ADR-0008), e a empresa entra
 * pelo **contexto**, que é o mesmo mecanismo que a aplicação usa.
 */
async function contarEnvios(codigo: string): Promise<number> {
  return await contextoDeTenant.executarCom(
    { empresaId: EMPRESA_A.id },
    async () =>
      await acessoAoNegocio.emUnidadeDeTrabalho(async (tx) => {
        const [linha] = await tx<{ total: string }[]>`
          SELECT count(*) AS total
            FROM negocio.envio_de_cobranca ec
            JOIN negocio.cobranca c ON c.id = ec.cobranca_id
           WHERE c.codigo = ${codigo}
        `;

        return Number(linha?.total ?? 0);
      }),
  );
}

/**
 * Quantas linhas de `negocio.politica_de_aviso` o contexto da empresa informada alcança.
 *
 * A contagem é **crua** e sem recorte: o que os casos medem é quantas linhas existem. Nenhum
 * `WHERE empresa_id` é escrito aqui — quem recorta é a política (ADR-0008) —, e a empresa entra pelo
 * **contexto**, que é o mesmo mecanismo que a aplicação usa.
 */
async function contarPoliticas(empresaId: string): Promise<number> {
  return await contextoDeTenant.executarCom(
    { empresaId },
    async () =>
      await acessoAoNegocio.emUnidadeDeTrabalho(async (tx) => {
        const [linha] = await tx<{ total: string }[]>`
          SELECT count(*) AS total FROM negocio.politica_de_aviso
        `;

        return Number(linha?.total ?? 0);
      }),
  );
}

// ---------------------------------------------------------------------------------------------
// Corpos observados — declarados aqui, e não importados do SUT
// ---------------------------------------------------------------------------------------------

/** O recorte da sessão publicada que este arquivo observa. */
interface SessaoPublicada {
  readonly telas: readonly string[];
  readonly acoes: readonly string[];
}

/** O recorte de uma cobrança publicada que os casos de aviso observam. */
interface CobrancaPublicada {
  readonly codigo: string;
  readonly status: string;
}

/** O recorte de uma tentativa publicada — os sete campos de `esquemaDoEnvioDeCobranca`. */
interface EnvioPublicado {
  readonly id: string;
  readonly cobrancaCodigo: string;
  readonly criadoEm: string;
  readonly caminho: string;
  readonly desfecho: string;
  readonly destinatario: string;
  readonly causa: string | null;
}

/** O envelope de lista do histórico. */
interface PaginaDeEnviosPublicada {
  readonly itens: readonly EnvioPublicado[];
  readonly total: number;
  readonly limite: number;
  readonly deslocamento: number;
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
  /**
   * Contra qual das duas aplicações a requisição corre — a real, por omissão.
   *
   * O parâmetro nasceu na T10, quando os casos de aviso passaram a exercitar a aplicação
   * **instrumentada** (a que recebeu o capturador por `overrideProvider`). Ele é opcional de
   * propósito: os casos da T9 continuam batendo na aplicação real, sem uma linha alterada.
   */
  readonly base?: string;
}

/**
 * Executa uma requisição HTTP real contra a aplicação.
 *
 * O cabeçalho `Origin` acompanha toda requisição com a MESMA origem da aplicação — é o que um
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
  };
}

/** Entra pelo caminho REAL — a rota pública de entrada. Nenhum estado de sessão é forjado. */
async function entrar(email: string, senha: string, endereco: string = base): Promise<string> {
  const entrada = await pedir(ROTA_DE_ENTRADA, {
    metodo: 'POST',
    corpo: { email, password: senha },
    base: endereco,
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
 * ação→tela validada pela função de domínio (`validarCoerenciaDeAjustes`) e o contador incrementado
 * na mesma transação — é o mesmo caminho que a rota do Admin usa por dentro, e o mesmo padrão de
 * `test/mora.e2e.spec.ts`.
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
