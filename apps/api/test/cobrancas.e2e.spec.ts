/**
 * As **cinco rotas de `/v1/cobrancas`** — lançar avulsa, ler a carteira e ler uma cobrança (T5 da
 * fatia `cobranca-e-mora`), acusar o pagamento e cancelar (T7).
 *
 * ---------------------------------------------------------------------------
 * INVARIANTES
 * ---------------------------------------------------------------------------
 *
 * | Critério | Caso   | Invariante |
 * |---|---|---|
 * | CA-06 | CT-514 | `POST /v1/cobrancas` com `natureza: 'AGUA'` cria a cobrança vinculada ao
 * |       |        | contrato informado, com código de série **própria** (`COB-{ano}-{7 dígitos}`) e
 * |       |        | distinto dos das parcelas; a lista filtrada por `natureza=ALUGUEL` traz
 * |       |        | **exatamente 3** itens e **não** a nova, a filtrada por `natureza=AGUA` traz
 * |       |        | **exatamente 1** — a nova —, e sem filtro de natureza são **4**. A distinção é
 * |       |        | pelo CAMPO, nunca pelo texto de `referencia`. |
 * | CA-06 | CT-514 | A **PRIMEIRA** cobrança da empresa no ano nasce por esta rota **sem falhar**, e
 * |       | (b)    | o sequencial dela é `1`: `proximo_numero_de_cobranca` consome a sequência e
 * |       |        | nunca a cria, e é a primeira unidade de trabalho da rota que a garante. |
 * | CA-06 | CT-514 | O `locatarioId` publicado é **igual ao do contrato**, e a cobrança **não** tem
 * |       | (c)    | coluna própria para ele: o valor sai da junção da visão com o contrato (RN-01). |
 * | CA-06 | CT-515 | `POST /v1/cobrancas` recusa com `422` e o envelope **inteiro** da ADR-0017 as
 * |       |        | quatro classes de entrada inválida — natureza fora da lista fechada, ausência
 * |       |        | de `contratoCodigo`, `valorOriginal` não positivo (zero e negativo) e chave
 * |       |        | desconhecida —, nomeando `natureza`, `contratoCodigo`, `valorOriginal` e
 * |       |        | `corpo`; e a contagem **crua** de `negocio.cobranca` da empresa não muda. |
 * | CA-06 | CT-515 | Independentemente da borda, o `CHECK cobranca_valor_positivo_chk` do banco
 * |       | (b)    | levanta `23514` na inserção **direta** de valor não positivo, sob o contexto da
 * |       |        | empresa — nenhum caminho de escrita futuro contorna a regra. |
 * | CA-06 | CT-515 | Contrato **inexistente** e contrato **de outra empresa** respondem o MESMO
 * |       | (c)    | `404`, comparado por **corpo inteiro** e não por status, e a leitura de cobrança
 * |       |        | alheia responde o MESMO corpo da leitura de código inexistente — o mesmo das
 * |       |        | duas recusas de lançamento. Contrato **retirado de circulação** responde `422`
 * |       |        | com o envelope inteiro nomeando `contratoCodigo` e
 * |       |        | `detalhes.circulacao: RETIRADO_DE_CIRCULACAO`. Nenhuma das recusas move a
 * |       |        | contagem crua de NENHUMA das duas empresas, e o controle positivo grava
 * |       |        | exatamente uma linha, na empresa de quem lançou. |
 * | CA-06 | CT-515 | A colisão do código **emitido** — a quarta classe de recusa — é traduzida em
 * |       | (d)    | `422` nomeando `codigo`, com `detalhes.conflito: CODIGO_EM_USO`, e o número
 * |       |        | queimado **não volta**: o lançamento seguinte toma o número posterior. |
 * | CA-07 | CT-516 | `POST /v1/cobrancas/:codigo/pagamento` sobre cobrança VENCIDA responde `200`
 * |       |        | com estado PAGA e grava, na mesma instrução, `pagoEm`, `valorPago` e os
 * |       |        | **quatro carimbos** IGUAIS, centavo a centavo, ao que a leitura imediatamente
 * |       |        | anterior publicava: `40.00`, `34.67`, `2.00` e `1.00` sobre `2000.00` vencidos
 * |       |        | há 52 dias — o caso canônico do golden. A releitura é afirmada por **corpo
 * |       |        | inteiro**, e o total publicado é `2074.67`, e não o valor original. |
 * | CA-08 | CT-518 | Depois do pagamento, `PUT /v1/multa-e-juros` de `{2, 1}` para `{10, 5}` **não
 * |       |        | move um centavo**: a releitura é idêntica por igualdade de OBJETO, os
 * |       |        | percentuais carimbados continuam sendo os ANTIGOS (`2.00`/`1.00`) e o total
 * |       |        | continua `2074.67` — **nunca** `2373.33`, que é o que a reapuração daria. |
 * | CA-14 | CT-529 | A mesma alteração alcança a cobrança **em aberto** e só ela, no mesmo ato: a
 * |       |        | VENCIDA passa de `40.00`/`2060.00` para `100.00`/`2120.00` na leitura
 * |       |        | seguinte, com os juros parados porque o percentual deles não mudou; a PAGA
 * |       |        | segue idêntica por igualdade de OBJETO; e o **`xmin` da VENCIDA não muda** —
 * |       |        | a mudança veio da derivação, não de escrita na cobrança. |
 * | CA-04 | CT-511 | Para a MESMA cobrança, o par (`status`, `valorTotal`) é idêntico nos QUATRO
 * |       |        | caminhos de leitura publicados — item, carteira sem recorte, recorte por
 * |       |        | contrato e recorte por estado —, nos quatro estados: A_VENCER `1000.00`,
 * |       |        | VENCIDA há 30 dias `1030.00`, PAGA `1030.00` pelos carimbos e CANCELADA
 * |       |        | `1000.00`. E os quatro recortes por estado **particionam** as quatro. |
 * | CA-09 | CT-519 | `POST /v1/cobrancas/:codigo/cancelamento` responde `200` com estado CANCELADA e
 * | CA-10 |        | `canceladoEm` não nulo; a releitura devolve **`200`, nunca `404`**, com
 * |       |        | natureza, referência, competência e valor originais; a cancelada **consta** da
 * |       |        | carteira; a substituta recebe código com sufixo **MAIOR**; a contagem crua
 * |       |        | sobe em **exatamente 1**; e o conjunto de chaves publicado é **igual** ao
 * |       |        | inventário de dezoito — não há campo de vínculo com a cancelada. |
 * | CA-09 | CT-520 | Cancelar cobrança PAGA ou já CANCELADA responde `422` com o envelope inteiro,
 * | CA-10 |        | `campo: "codigo"` e `detalhes: { estadoAtual, transicaoPedida }`; o `xmin` das
 * |       |        | duas tuplas é idêntico antes e depois, e a releitura de cada uma é idêntica
 * |       |        | por igualdade de objeto — o `canceladoEm` da já cancelada preserva o instante
 * |       |        | ORIGINAL, e os quatro carimbos da paga ficam onde estavam. |
 * | CA-07 | CT-517 | Pela rota, acusar pagamento de cobrança PAGA ou CANCELADA responde `422`
 * | CA-10 | (rota) | nomeando o estado atual, **sem escrita alguma** (`xmin` idêntico, publicação
 * |       |        | idêntica por igualdade de objeto). Corpo sem `valorPago` é `422` nomeando
 * |       |        | `valorPago`; chave desconhecida no corpo **vazio e fechado** do cancelamento é
 * |       |        | `422` nomeando `corpo`; e o controle positivo paga a mesma cobrança em
 * |       |        | seguida, o que separa *a guarda de estado recusa* de *a rota recusa tudo*. |
 *
 * Rastreabilidade: `CA-06 → CT-514 (RD-03)` · `CA-06 → CT-515 (RD-03, RN-01)` ·
 * `CA-07 → CT-516 (RN-09)` · `CA-08 → CT-518 (RN-10)` · `CA-14 → CT-529 (RN-10)` ·
 * `CA-04 → CT-511 (RN-04)` · `CA-09 → CT-519 (RN-12)` · `CA-10 → CT-519, CT-520 (RN-12)` ·
 * `CA-07 → CT-517 (rota) (RN-09)`.
 *
 * ===========================================================================
 * A ORDEM DOS CASOS DA T7 É CONTEÚDO — eles entram DEPOIS do `CT-515 (c)`
 * ===========================================================================
 *
 * Os sete casos da T7 criam contrato e cobrança na empresa A, e por isso vivem num `describe`
 * **posterior** ao dos casos da T5. A razão é o débito **D11** desta fatia: `ateSerExclusivo`, no
 * `CT-515 (c)`, monta até obter um código que a sessão de B não alcança, e o teto nomeado dele
 * (`MAXIMO_DE_MONTAGENS_ATE_O_CODIGO_EXCLUSIVO`) mede a **distância** entre as duas séries no instante
 * em que o laço começa. Montagens novas em A **antes** daquele caso consomem essa folga; depois dele,
 * não consomem nada. O modo de falha é ruidoso (o laço levanta nomeando a coleção e o número de
 * tentativas), nunca falso-verde — mas custa uma rodada de gate diagnosticando um erro cuja causa está
 * a centenas de linhas de distância.
 *
 * ===========================================================================
 * MUTANTES EXECUTADOS na T7 — os quatro reprovam
 * ===========================================================================
 *
 * Todos aplicados ao artefato real e invocados pelo **script do pacote** (`pnpm --filter @sysloc/api
 * test` e `pnpm --filter @sysloc/db test`), nunca por `vitest run` avulso — a regra da
 * `.claude/rules/testing-stack.md`, que existe porque os pacotes resolvem `"."` para `dist/`.
 *
 *   * **controle** — árvore íntegra: `@sysloc/api` `169 passed`, `@sysloc/db` `107 passed`;
 *   * **MT-1 · a visão volta a publicar mora zero para a cobrança liquidada** — os dois `COALESCE` do
 *     carimbo removidos de `migracoes/0010_seguranca_cobranca.sql`, que é o estado em que a T3 a
 *     deixou. `@sysloc/db` fica em `1 failed | 106 passed`, com o `CT-527` reprovando na igualdade da
 *     PAGA; `@sysloc/api` fica em `3 failed | 166 passed`, com o `CT-516` reprovando no corpo inteiro,
 *     o `CT-518` em `expected +0 to be 40` e o `CT-511` em
 *     `expected { status: 'PAGA', valorTotal: 1000 } to deeply equal { status: 'PAGA', valorTotal:
 *     1030 }`. É a medição de que o carimbo, apesar de gravado na tabela, era **inalcançável** pelas
 *     dezoito colunas publicadas — `multaAplicada` e `jurosAplicados` não estão entre elas;
 *   * **MT-2 · o `UPDATE` carimba só os dois VALORES**, deixando os dois percentuais de fora:
 *     `6 failed | 163 passed`, e o `CT-516` reprova em `expected 500 to be 200`. Quem recusa é o
 *     **banco** — `cobranca_carimbo_coerente_chk` pareia `pago_em` com **cada um** dos quatro
 *     carimbos —, de modo que "carimbar só os valores" é **irrepresentável**, e não apenas detectado.
 *     A restrição e o `CT-518` fecham a classe pelos dois lados;
 *   * **MT-3 · a guarda de estado do pagamento admite os QUATRO estados** (`ESTADOS_PAGAVEIS` aponta
 *     para `ESTADOS_DA_COBRANCA`): `1 failed | 168 passed`, e o `CT-517 (rota)` reprova em
 *     `expected 200 to be 422`. ⚠️ O mutante ÓBVIO — apagar a chamada de `exigirEstado` — **não
 *     serve**: `ESTADOS_PAGAVEIS` e `PAGAMENTO` ficam sem uso, `noUnusedLocals` derruba o
 *     `tsc --build` e a suíte não corre, o que é "reprovou sem provar nada". O mutante acima é o
 *     defeito real que o compilador não pega: alguém alargar o conjunto admitido;
 *   * **MT-4 · o `@HttpCode(200)` do pagamento ausente** — medido **por acidente**, na primeira
 *     execução, antes de o decorador existir: o arcabouço devolve `201` a todo `@Post`, e o `CT-516`,
 *     o `CT-518`, o `CT-529`, o `CT-511`, o `CT-520` e o `CT-517 (rota)` reprovaram de uma vez, cada
 *     um nomeando o status obtido;
 *   * **reversão** — em cada mutante o arquivo foi restaurado de cópia e conferido idêntico por
 *     `diff -q`, e o controle voltou aos números acima.
 *
 * ===========================================================================
 * A INDISTINGUIBILIDADE se prova por IGUALDADE DE CORPO, nunca por status
 * ===========================================================================
 *
 * O `404` de `exigirContratoEmCirculacao` e o de `exigir` não impedem coisa alguma: quem impede o
 * vínculo cruzado é a chave estrangeira composta `cobranca_contrato_empresa_fkey`, e quem esconde a
 * linha alheia é a política (ADR-0008). O que as duas conferências compram é a **forma** da recusa —
 * sem elas, o contrato de outra empresa produziria erro de driver, e o `500` diria ao cliente que
 * aquele código existe em algum lugar.
 *
 * Por isso o `CT-515 (c)` **não** afirma o status das duas recusas: ele afirma que os dois corpos são
 * profundamente iguais, e só então que o corpo é o canônico. A ordem importa e o par é o que
 * discrimina — afirmar apenas `404` nos dois deixaria passar uma mensagem que diferenciasse, que é
 * exatamente o oráculo de existência que o invariante proíbe; afirmar apenas a igualdade deixaria
 * passar dois `500` idênticos. É o molde literal do `CT-423` de `test/contratos.e2e.spec.ts`, que
 * estabeleceu o invariante na F2 junto de `test/recusa-indistinguivel.e2e.spec.ts`.
 *
 * O **controle positivo** fecha o terceiro caminho: sem o lançamento e a leitura da própria empresa
 * respondendo `201` e `200` no mesmo caso, "as duas respondem o mesmo `404`" seria satisfeito por uma
 * borda que recusasse tudo.
 *
 * ===========================================================================
 * A contagem exata por filtro é o que prova que a distinção é pelo CAMPO
 * ===========================================================================
 *
 * No sistema antigo o DocType `Cobranca` tem 48 campos e **nenhum de natureza**: lá, "novo título" se
 * distingue apenas pelo texto de `referencia`, que é rótulo livre, e somar por tipo exige casar
 * texto. Aqui `natureza` e `referencia` são campos distintos de propósito — o primeiro classifica e é
 * filtrável, o segundo descreve e é livre.
 *
 * As três contagens (3, 1, 4) são o que discrimina as duas implementações: uma que filtrasse por
 * `referencia LIKE` traria **0 ou 4** no recorte de `ALUGUEL`, porque a referência da cobrança de
 * água não contém a palavra e as das parcelas não contêm a outra. É por isso que a referência da
 * cobrança nova é um texto que **não** cita nenhuma das duas naturezas, e que as das parcelas também
 * não: um texto que casasse por acidente tornaria as três contagens indistinguíveis entre as duas
 * implementações.
 *
 * ===========================================================================
 * A precondição privilegiada, e por que ela é montada pelo caminho REAL
 * ===========================================================================
 *
 *   * **sessão** — pela rota pública de entrada, com a senha da carga. Nenhum estado de sessão é
 *     forjado, e nenhum cookie é montado à mão;
 *   * **arranjo de chaves** — pelo caminho real da camada de dados (`escreverAjustes` com a coerência
 *     ação→tela validada pela função de domínio), sob o contexto de tenant da empresa da pessoa. É o
 *     mesmo caminho que a rota do Admin usa por dentro, e o mesmo padrão de
 *     `test/contratos.e2e.spec.ts` e `test/autorizacao-do-dominio.e2e.spec.ts`. **Nenhum símbolo de
 *     produção nasce para o teste enxergar algo**, nenhuma rota de verificação é publicada, e
 *     `app.empresa_id` nunca é fixado por fora da barreira;
 *   * **o efetivo é AFIRMADO por `GET /v1/sessao`** antes dos casos, e não presumido: sem essa linha,
 *     um `403` nas rotas de cobrança seria indistinguível de um defeito delas;
 *   * **o contrato ATIVO e as três parcelas** nascem pelas rotas reais — conjunto, imóvel, locador,
 *     locatário, contrato, ativação e três `POST /v1/cobrancas`. Nesta fatia a ativação ainda **não**
 *     gera parcela alguma (é a T9 que a liga, e o débito D28 da F2 registra a pendência), de modo que
 *     as três parcelas de aluguel do cenário são lançadas pela mesma rota avulsa que o caso exercita
 *     — que é o único caminho legítimo que existe hoje.
 *
 * `TELA:imoveis`, `TELA:cadastros`, `TELA:contratos` e `ACAO:ativar_contrato` estão no arranjo por
 * **obrigação do cenário**, e não por escolha: sem eles não há contrato ativo sobre o qual lançar. O
 * eixo do caso é `TELA:financeiro`, e quem mede a recusa de quem não a alcança é o `CT-534`, em T11.
 *
 * ===========================================================================
 * O RELÓGIO NUNCA É FALSEADO — o cenário é posicionado pelo DADO
 * ===========================================================================
 *
 * A visão classifica o estado por comparação **estrita** contra o relógio do banco
 * (`c.data_vencimento < negocio.data_corrente_da_operacao()`, na `0010`). Um vencimento escrito como
 * data absoluta faria os cinco derivados que o `CT-514` afirma — `A_VENCER`, atraso zero, multa
 * zero, juros zero e total igual ao original — serem verdade **enquanto aquela data estivesse no
 * futuro**, e o caso passaria a reprovar sozinho, num dia do calendário, sobre um SUT correto.
 *
 * Por isso o vencimento e a competência do cenário são **lidos do mesmo
 * `negocio.data_corrente_da_operacao()` que a visão consulta**, deslocados em
 * {@link DIAS_ATE_O_VENCIMENTO} dias para o futuro — ver {@link datasDoCenario}. Nenhum relógio é
 * substituído, nenhum parâmetro de data foi acrescentado à produção e nenhum caso força a virada do
 * dia: o que se move é o **dado**. É a convenção que a T4 desta mesma fatia já adotou em
 * `packages/db/test/cobranca.spec.ts`, e o `A_VENCER` deixa de ser consequência do calendário para
 * ser consequência declarada do cenário.
 *
 * **Medido**, e não argumentado: com {@link DIAS_ATE_O_VENCIMENTO} trocado para `-30`, o `CT-514`
 * reprova na igualdade do corpo inteiro com `status: 'VENCIDA'` e `diasAtraso: 30` — o atraso é
 * exatamente o deslocamento, o que mostra que os cinco derivados estão presos ao relógio do banco, e
 * não a um dia do calendário. O deslocamento foi restaurado e a suíte voltou ao verde.
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
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
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
import { PREFIXO_DAS_ROTAS_DE_IDENTIDADE } from '../src/autenticacao/autenticacao.module.ts';
import { CAMINHO_DA_SESSAO } from '../src/autenticacao/sessao.controller.ts';
import { CAMINHO_DOS_LOCADORES } from '../src/cadastros/locador.controller.ts';
import { CAMINHO_DOS_LOCATARIOS } from '../src/cadastros/locatario.controller.ts';
import { CAMINHO_DAS_COBRANCAS } from '../src/cobrancas/cobranca.controller.ts';
import { ENDERECO_DE_ESCUTA, PREFIXO_DE_VERSAO } from '../src/configuracao/ambiente.ts';
import { CAMINHO_DOS_CONTRATOS } from '../src/contratos/contrato.controller.ts';
import { CAMINHO_DOS_CONJUNTOS } from '../src/imoveis/conjunto.controller.ts';
import { CAMINHO_DOS_IMOVEIS } from '../src/imoveis/imovel.controller.ts';
import { criarAplicacao } from '../src/main.ts';
import { CAMINHO_DE_MULTA_E_JUROS } from '../src/mora/mora.controller.ts';
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

/** Caminho, relativo à raiz, da coleção de cobranças — a superfície desta task. */
const COLECAO_DE_COBRANCAS = `/${PREFIXO_DE_VERSAO}/${CAMINHO_DAS_COBRANCAS}`;

/** Caminho, relativo à raiz, da coleção de contratos — a precondição do cenário. */
const COLECAO_DE_CONTRATOS = `/${PREFIXO_DE_VERSAO}/${CAMINHO_DOS_CONTRATOS}`;

/** Caminho da política de mora — a superfície que a T6 publicou, e que a T7 exercita de fora. */
const RECURSO_DE_MULTA_E_JUROS = `/${PREFIXO_DE_VERSAO}/${CAMINHO_DE_MULTA_E_JUROS}`;

/**
 * Os dois percentuais que a T7 usa como política inicial — os do caso canônico do golden.
 *
 * `2` e `1` são multa de 2% e juros de 1% ao mês, e é dessa política que saem todos os centavos
 * esperados adiante. Eles são escritos por extenso, e não lidos de artefato nenhum: são a **entrada**
 * do cenário, e o oráculo é comparado pelo `CT-525`, na suíte da camada de dados.
 */
const MULTA_INICIAL = 2;
const JUROS_INICIAL = 1;

/** A política que o `CT-518` aplica DEPOIS do pagamento — ela não pode mover a cobrança paga. */
const MULTA_ALTERADA = 10;
const JUROS_ALTERADO = 5;

/** A multa que o `CT-529` aplica com uma cobrança ainda em aberto — ela tem de alcançá-la. */
const MULTA_MAIOR = 5;

/**
 * O caso canônico do golden `calcular-mora.json` (`exemplo_canonico_2074_67`), pela rota.
 *
 * `2000.00` vencidos há 52 dias, a 2%/1%, publicam `40.00` de multa e `34.67` de juros — um total de
 * `2074.67`. Os valores são os do oráculo, e não literais escolhidos pelo caso.
 */
const VALOR_DA_CANONICA = 2000;
const DIAS_DA_CANONICA = 52;
const MULTA_DA_CANONICA = 40;
const JUROS_DA_CANONICA = 34.67;
const TOTAL_DA_CANONICA = 2074.67;

/**
 * O que a reapuração pela política nova daria — o número que o `CT-518` afirma **não** ver.
 *
 * `2000.00` a 52 dias, com multa de 10% e juros de 5%/mês: `200.00` + `173.33`. Ele existe para que a
 * asserção negativa nomeie os dois números na reprovação, em vez de dizer apenas que o total mudou.
 */
const TOTAL_REAPURADO = 2373.33;

/**
 * A cobrança em aberto dos casos de transição — `2000.00` vencidos há 30 dias.
 *
 * Trinta dias é o mês comercial inteiro, de modo que os juros valem a taxa mensal cheia: `20.00` a
 * 1%/mês, e `40.00` de multa a 2%. Com a multa a 5%, a mesma linha passa a `100.00` de multa e
 * `2120.00` de total — os juros **não** se movem, porque o percentual deles não mudou.
 */
const DIAS_DA_ABERTA = 30;
const MULTA_DA_ABERTA = 40;
const JUROS_DA_ABERTA = 20;
const TOTAL_DA_ABERTA = 2060;
const MULTA_MAIOR_APLICADA = 100;
const TOTAL_COM_MULTA_MAIOR = 2120;

/** As quatro cobranças do `CT-511`: `1000.00`, e `1030.00` quando vencidas há 30 dias a 2%/1%. */
const VALOR_REDONDO = 1000;
const TOTAL_REDONDO_COM_MORA = 1030;

/** O valor da substituta do `CT-519` — diferente do da cancelada, para que a troca seja visível. */
const VALOR_DA_SUBSTITUTA = 92.1;

/**
 * A janela declarada nas leituras de carteira do `CT-511` e do `CT-519`.
 *
 * Ela é o teto que `MAIOR_PAGINA` admite, e existe para que a lista **sem recorte** contenha a
 * carteira inteira da empresa: o que se compara é o conjunto, e uma página curta faria o caso medir a
 * primeira página em vez dele. O recorte pedido continua sendo nenhum.
 */
const JANELA_LARGA = 200;

/**
 * As **dezoito** chaves que a cobrança publica, em ordem alfabética.
 *
 * Escritas por extenso, e não derivadas de `esquemaDaCobranca` nem do corpo observado: é a igualdade
 * contra esta lista que transforma *"não há campo de vínculo com a cancelada"* numa afirmação que pega
 * **qualquer** grafia — `substituiCodigo`, `canceladaPor`, `substitutaCodigo` —, e não só um nome que
 * o caso tivesse adivinhado. Derivá-la do tipo do SUT faria a asserção concordar consigo mesma.
 */
const CHAVES_PUBLICADAS: readonly string[] = [
  'canceladoEm',
  'codigo',
  'competencia',
  'contratoCodigo',
  'dataVencimento',
  'diasAtraso',
  'jurosPercentualAplicado',
  'locatarioId',
  'multaPercentualAplicado',
  'natureza',
  'pagoEm',
  'referencia',
  'status',
  'valorJuros',
  'valorMulta',
  'valorOriginal',
  'valorPago',
  'valorTotal',
];

/**
 * As mensagens canônicas de cada código, escritas por extenso.
 *
 * Literais, e **não** lidas de `MENSAGEM_POR_CODIGO`: os casos comparam corpos inteiros por
 * igualdade, e derivá-los da mesma tabela que o SUT usa faria a asserção concordar consigo mesma —
 * um erro de texto na tabela passaria despercebido nos dois lados.
 */
const MENSAGEM_DE_CAMPO_INVALIDO = 'requisição inválida';

/** A mensagem canônica do `404`, pela mesma razão da de cima — literal, nunca lida da tabela. */
const MENSAGEM_DE_NAO_ENCONTRADO = 'recurso não encontrado';

/**
 * O arranjo concedido à sessão que age.
 *
 * Literal, e **não** derivado da exigência declarada nos controladores: derivá-lo faria a asserção
 * concordar com o SUT, e trocar a exigência da classe deixaria de reprovar caso algum. As quatro
 * primeiras estão aqui por obrigação do cenário — sem contrato ativo não há sobre o que lançar —, e
 * `TELA:financeiro` é o eixo desta task.
 *
 * `ACAO:excluir_cadastro` entrou pela MESMA obrigação de cenário: a metade de circulação do
 * `CT-515 (c)` precisa de um contrato **retirado**, e as duas rotas de circulação de contrato exigem
 * no método a conjunção `TELA:contratos` + `ACAO:excluir_cadastro`. Retirar de circulação pela rota
 * real é o único caminho legítimo para produzir a precondição — marcar `retirado_em` por escrita
 * privilegiada montaria o estado por fora da regra que o próprio caso observa.
 */
const CHAVES_DO_ARRANJO: readonly ChaveDoCatalogo[] = [
  'TELA:financeiro',
  'TELA:multa_e_juros',
  'TELA:contratos',
  'TELA:imoveis',
  'TELA:cadastros',
  'ACAO:ativar_contrato',
  'ACAO:excluir_cadastro',
];

/** A área que a classe do controlador de cobrança exige — afirmada no efetivo, nunca suposta. */
const AREA_DO_FINANCEIRO: ChaveDoCatalogo = 'TELA:financeiro';

/**
 * A área que a classe do controlador da política de mora exige — afirmada no efetivo, nunca suposta.
 *
 * Ela entra no arranjo por **obrigação do cenário** da T7, e não por conveniência: o `CT-518` e o
 * `CT-529` alteram a política por `PUT /v1/multa-e-juros`, que é rota de outra superfície, com
 * exigência própria. **A declaração de nenhuma rota foi alargada** — o que se concedeu foi a área à
 * sessão, pelo caminho real de administração, exatamente como se concedeu `TELA:contratos` para ter
 * contrato sobre o qual lançar. A alternativa de montar uma segunda sessão só para alterar a política
 * não se aplica aqui: o perfil de quem age já pode receber as duas áreas, e o glossário não separa os
 * dois papéis.
 */
const AREA_DE_MULTA_E_JUROS: ChaveDoCatalogo = 'TELA:multa_e_juros';

/** A ação que as duas rotas de circulação de contrato exigem — afirmada no efetivo, nunca suposta. */
const ACAO_DE_CIRCULACAO: ChaveDoCatalogo = 'ACAO:excluir_cadastro';

/**
 * A forma do código legível da cobrança — `COB-{ano}-{7 dígitos}` (RD-02).
 *
 * Escrita por extenso, e **não** importada de `@sysloc/contracts`: derivá-la da mesma expressão que o
 * SUT usa para validar faria a asserção concordar consigo mesma, e a largura de sete dígitos — que
 * carrega marcador `DECISÃO FECHADA` no pacote, e que **diverge** deliberadamente da largura 5 do
 * contrato — deixaria de ser afirmada por este lado.
 */
const PADRAO_DO_CODIGO_DE_COBRANCA = /^COB-\d{4}-\d{7}$/u;

/** O primeiro sequencial que a série de uma empresa emite num ano — o sujeito do `CT-514 (b)`. */
const PRIMEIRO_SEQUENCIAL = '0000001';

/**
 * Um código de contrato e um de cobrança **bem formados** que não existem em empresa nenhuma.
 *
 * O ano é 2099 de propósito: os dois passam pela validação de forma da borda — e é isso que se quer,
 * porque um código malformado seria recusado com `422` antes de qualquer consulta, e mediria a
 * validação em vez da recusa por ausência. O sequencial segue as larguras publicadas — **cinco**
 * dígitos no contrato e **sete** na cobrança.
 */
const CONTRATO_INEXISTENTE = 'CTR-2099-00001';
const COBRANCA_INEXISTENTE = 'COB-2099-0000001';

/** Os termos do contrato do cenário — valores quaisquer, dentro das seis condições de entrada. */
const DATA_DE_INICIO = '2026-01-15';
const PRAZO_EM_MESES = 12;
const VALOR_MENSAL = 2500;
const DIA_DE_VENCIMENTO = 10;

/**
 * A cobrança avulsa do cenário: água, com referência que **não cita natureza nenhuma**.
 *
 * A ausência das palavras "aluguel" e "água" nas referências — nesta e nas das parcelas — é o que
 * torna as três contagens discriminantes; ver o cabeçalho. `valorOriginal` viaja como **número**, e
 * não como cadeia: `esquemaDeCobrancaNova.valorOriginal` é `z.number()` com teto e escala de
 * `numeric(15,2)`, e uma cadeia seria recusada com `422` antes de a rota fazer qualquer coisa.
 *
 * O texto do card cita `janeiro/2027`, e a citação do mês **saiu junto com as datas absolutas**: o
 * que o caso exige da referência é só que ela não nomeie natureza alguma, e um mês fixo no rótulo
 * voltaria a afirmar em prosa exatamente o que a derivação pelo relógio do banco tirou do dado.
 */
const REFERENCIA_DA_AGUA = 'Consumo do período — hidrômetro 4471';
const VALOR_DA_AGUA = 87.4;

/** A referência das três parcelas — também sem citar natureza alguma, pela mesma razão. */
const REFERENCIA_DA_PARCELA = 'Competência do período — parcela';

/**
 * A distância, em dias, entre o relógio do banco e o vencimento de **toda** cobrança do cenário.
 *
 * Positiva, e é ela que torna `A_VENCER` uma consequência do cenário em vez de uma consequência do
 * calendário. Trinta dias é folga larga o bastante para que a virada do dia durante a execução — que
 * dura minutos — não mova nada, e curta o bastante para manter a competência derivada num mês
 * vizinho ao corrente.
 */
const DIAS_ATE_O_VENCIMENTO = 30;

/**
 * O vencimento e a competência do cenário, **derivados do relógio do banco** no `beforeAll`.
 *
 * Não são constantes de módulo porque não são fatos do calendário: são posições relativas ao eixo
 * que a visão usa para decidir o estado. A competência é o **primeiro dia do mês** do vencimento —
 * forma que o `refine` do contrato e o `cobranca_competencia_no_primeiro_dia_chk` do banco exigem.
 */
let vencimentoDoCenario: string;
let competenciaDoCenario: string;

/** O valor de cada parcela do cenário. */
const VALOR_DA_PARCELA = 2500;

/** Quantas parcelas de aluguel o cenário monta antes da cobrança de água. */
const PARCELAS_DO_CENARIO = 3;

/**
 * A pessoa que age: `USUARIO_EMPRESA` da empresa A, **da carga**.
 *
 * Ela tem senha definitiva e nenhuma exigência pendente, então a sessão dela nasce **plena** com uma
 * entrada só — e o perfil dela **não** concede `TELA:financeiro`, que é o que torna a concessão do
 * arranjo uma precondição de verdade.
 */
const QUEM_AGE = pessoaSemeada('usuario.a@exemplo.com.br');

/**
 * A pessoa que age na empresa B: `USUARIO_EMPRESA` **da carga**, com o mesmo estado inicial da de A.
 *
 * Ela é a outra ponta da prova de indistinguibilidade do `CT-515 (c)`. **Nenhuma rota recebe a
 * empresa dela**: o que separa uma sessão da outra é o cookie, e é a guarda que publica o contexto a
 * partir da sessão. É a mesma montagem, e a mesma pessoa, do `CT-423` de
 * `test/contratos.e2e.spec.ts`.
 */
const QUEM_AGE_EM_B = pessoaSemeada('usuario.b1@exemplo.com.br');

let identidade: IdentidadeEfemera;
let fila: FilaEfemera;
let acessoAoNegocio: AcessoAoBanco;
let aplicacao: NestFastifyApplication;
let base: string;
let ambienteAnterior: NodeJS.ProcessEnv;
let cookie: string;
let cookieDeB: string;

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

  // O cenário é posicionado pelo DADO, e não pelo calendário — ver o cabeçalho.
  ({ competencia: competenciaDoCenario, vencimento: vencimentoDoCenario } = await datasDoCenario());

  // Precondição AFIRMADA, e não suposta, nas DUAS sessões: sem estas linhas, um `403` nas rotas de
  // cobrança — ou na retirada de circulação do `CT-515 (c)` — seria indistinguível de um defeito
  // delas, e o `404` da sessão de B seria indistinguível de falta de alcance à área.
  for (const credencial of [cookie, cookieDeB]) {
    const sessao = (await pedir(CAMINHO_DA_SESSAO_CORRENTE, { cookie: credencial }))
      .corpo as SessaoPublicada;
    expect(sessao.telas).toContain(AREA_DO_FINANCEIRO);
    expect(sessao.telas).toContain(AREA_DE_MULTA_E_JUROS);
    expect(sessao.acoes).toContain(ACAO_DE_CIRCULACAO);
  }
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

describe('lançamento e leitura da carteira de cobranças (T5)', () => {
  it(
    'CT-514 — a cobrança avulsa de AGUA nasce vinculada ao contrato e é distinguível sem interpretar texto',
    async () => {
      const cenario = await contratoAtivo();

      // -------------------------------------------------------------------------------------
      // CT-514 (b) — a PRIMEIRA cobrança da empresa no ano nasce por ESTA rota, sem falhar
      // -------------------------------------------------------------------------------------
      //
      // `proximo_numero_de_cobranca` **consome** a sequência e nunca a cria: sem a primeira unidade
      // de trabalho da rota, que chama `garantirContadorDeCobranca` e commita, este primeiro
      // lançamento falharia — e falharia exatamente no caso mais banal, empresa nova, primeira
      // cobrança do ano. O sequencial `0000001` é o que prova que foi por aqui que a série nasceu.
      const parcelas: CobrancaPublicada[] = [];
      for (let indice = 0; indice < PARCELAS_DO_CENARIO; indice += 1) {
        parcelas.push(
          await lancar({
            contratoCodigo: cenario.codigo,
            natureza: 'ALUGUEL',
            referencia: REFERENCIA_DA_PARCELA,
            competencia: competenciaDoCenario,
            dataVencimento: vencimentoDoCenario,
            valorOriginal: VALOR_DA_PARCELA,
          }),
        );
      }

      expect(parcelas[0]?.codigo.endsWith(`-${PRIMEIRO_SEQUENCIAL}`)).toBe(true);

      // -------------------------------------------------------------------------------------
      // Passos 1 a 3: o lançamento da cobrança de água
      // -------------------------------------------------------------------------------------
      const lancamento = await pedir(COLECAO_DE_COBRANCAS, {
        metodo: 'POST',
        cookie,
        corpo: {
          contratoCodigo: cenario.codigo,
          natureza: 'AGUA',
          referencia: REFERENCIA_DA_AGUA,
          competencia: competenciaDoCenario,
          dataVencimento: vencimentoDoCenario,
          valorOriginal: VALOR_DA_AGUA,
        },
      });

      expect(lancamento.status).toBe(201);

      const agua = lancamento.corpo as CobrancaPublicada;

      // Corpo INTEIRO por igualdade: um campo a mais — o UUID interno, ou a coluna `empresa_id`
      // vazando — reprova aqui, e não numa asserção de presença. Os cinco derivados são afirmados em
      // valor EXATO, e são consequência do CENÁRIO: o vencimento está `DIAS_ATE_O_VENCIMENTO` dias à
      // frente do relógio do banco — o mesmo que a visão consulta —, então o estado é `A_VENCER`, o
      // atraso é zero e a mora é zero, com o total igual ao original. Um serviço que derivasse estado
      // por conta própria reprovaria nesta linha se discordasse da visão em qualquer um dos cinco.
      expect(agua).toEqual({
        codigo: agua.codigo,
        contratoCodigo: cenario.codigo,
        locatarioId: cenario.locatarioId,
        natureza: 'AGUA',
        referencia: REFERENCIA_DA_AGUA,
        competencia: competenciaDoCenario,
        dataVencimento: vencimentoDoCenario,
        valorOriginal: VALOR_DA_AGUA,
        status: 'A_VENCER',
        diasAtraso: 0,
        valorMulta: 0,
        valorJuros: 0,
        valorTotal: VALOR_DA_AGUA,
        pagoEm: null,
        valorPago: null,
        canceladoEm: null,
        multaPercentualAplicado: null,
        jurosPercentualAplicado: null,
      });

      // O código é da série da COBRANÇA — sete dígitos, e não os cinco do contrato — e é distinto dos
      // três das parcelas: a série nunca reusa número (ADR-0015).
      expect(agua.codigo).toMatch(PADRAO_DO_CODIGO_DE_COBRANCA);
      expect(parcelas.map((parcela) => parcela.codigo)).not.toContain(agua.codigo);
      expect(new Set([...parcelas.map((p) => p.codigo), agua.codigo]).size).toBe(
        PARCELAS_DO_CENARIO + 1,
      );

      // -------------------------------------------------------------------------------------
      // Passos 4 a 6: as três contagens que provam que a distinção é pelo CAMPO
      // -------------------------------------------------------------------------------------
      //
      // Igualdade de lista de códigos, e não só de contagem: o número certo com o item errado
      // passaria por um `length`, e é justamente a troca que uma filtragem por texto produziria.
      const soAluguel = await listar(`contrato=${cenario.codigo}&natureza=ALUGUEL`);
      expect(soAluguel.itens.map((item) => item.codigo)).toEqual(
        parcelas.map((parcela) => parcela.codigo),
      );
      expect(soAluguel.total).toBe(PARCELAS_DO_CENARIO);
      expect(soAluguel.itens.map((item) => item.codigo)).not.toContain(agua.codigo);

      const soAgua = await listar(`contrato=${cenario.codigo}&natureza=AGUA`);
      expect(soAgua.itens.map((item) => item.codigo)).toEqual([agua.codigo]);
      expect(soAgua.total).toBe(1);

      const semFiltroDeNatureza = await listar(`contrato=${cenario.codigo}`);
      expect(semFiltroDeNatureza.total).toBe(PARCELAS_DO_CENARIO + 1);
      expect([...semFiltroDeNatureza.itens.map((item) => item.codigo)].sort()).toEqual(
        [...parcelas.map((parcela) => parcela.codigo), agua.codigo].sort(),
      );

      // -------------------------------------------------------------------------------------
      // Passo 7 · CT-514 (c) — o locatário é DERIVADO do contrato
      // -------------------------------------------------------------------------------------
      //
      // Afirmado nas quatro cobranças, e não só na nova: a coluna `locatario_id` não existe (RN-01),
      // e o valor sai da junção da visão com o contrato. Uma implementação que gravasse a segunda
      // ponta poderia acertar a primeira e divergir nas seguintes — que é exatamente a incoerência que
      // a tabela do sistema antigo admite.
      for (const item of semFiltroDeNatureza.itens) {
        expect(item.locatarioId).toBe(cenario.locatarioId);
      }

      // A leitura por código devolve a MESMA coisa que a listagem — a página e o item saem da mesma
      // visão, e não de dois caminhos livres para divergir.
      const lida = await pedir(`${COLECAO_DE_COBRANCAS}/${agua.codigo}`, { cookie });
      expect(lida.status).toBe(200);
      expect(lida.corpo).toEqual(agua);
    },
    LIMITE_CASO_MS,
  );

  it(
    'CT-515 — natureza fora da lista, cobrança sem contrato, valor não positivo e chave desconhecida são recusados',
    async () => {
      const cenario = await contratoAtivo();
      const antes = await contarCobrancas(EMPRESA_A.id);

      const corpoValido = {
        contratoCodigo: cenario.codigo,
        natureza: 'ALUGUEL',
        referencia: REFERENCIA_DA_PARCELA,
        competencia: competenciaDoCenario,
        dataVencimento: vencimentoDoCenario,
        valorOriginal: VALOR_DA_PARCELA,
      };

      /**
       * As quatro classes de recusa, uma por linha, com o campo que cada uma nomeia.
       *
       * A quarta é a **chave desconhecida**, que exercita o `strictObject`: o gerador previa um caso
       * de canal de comunicação, e o arquiteto o removeu porque esta fatia não publica campo de canal
       * algum (§21 do tech spec). Ela nomeia `corpo` porque o Zod reporta chave desconhecida com
       * caminho vazio, e é o campo padrão do ponto de chamada que a batiza.
       */
      const recusas: readonly {
        readonly rotulo: string;
        readonly campo: string;
        readonly corpo: Record<string, unknown>;
      }[] = [
        {
          rotulo: 'natureza fora da lista fechada',
          campo: 'natureza',
          corpo: { ...corpoValido, natureza: 'GAS' },
        },
        {
          rotulo: 'requisição sem contratoCodigo',
          campo: 'contratoCodigo',
          corpo: semCampo(corpoValido, 'contratoCodigo'),
        },
        {
          rotulo: 'valorOriginal igual a zero',
          campo: 'valorOriginal',
          corpo: { ...corpoValido, valorOriginal: 0 },
        },
        {
          rotulo: 'valorOriginal negativo',
          campo: 'valorOriginal',
          corpo: { ...corpoValido, valorOriginal: -10 },
        },
        {
          rotulo: 'chave desconhecida no corpo',
          campo: 'corpo',
          corpo: { ...corpoValido, status: 'PAGA' },
        },
      ];

      for (const { rotulo, campo, corpo } of recusas) {
        const resposta = await pedir(COLECAO_DE_COBRANCAS, { metodo: 'POST', cookie, corpo });

        expect(resposta.status, rotulo).toBe(422);
        // O envelope INTEIRO por igualdade de objeto, e não a presença de campos: `detalhes` **não**
        // aparece, e o valor recusado **não** é ecoado — o que sai é o nome do campo culpado.
        expect(resposta.corpo, rotulo).toEqual({
          codigo: CodigoErro.CAMPO_INVALIDO,
          mensagem: MENSAGEM_DE_CAMPO_INVALIDO,
          campo,
        });
      }

      // A contagem CRUA, sem recorte algum: é ela que separa "respondeu 422" de "respondeu 422 e não
      // gravou". Nenhum `WHERE empresa_id` é escrito aqui — quem recorta é a política (ADR-0008).
      expect(await contarCobrancas(EMPRESA_A.id)).toBe(antes);
    },
    LIMITE_CASO_MS,
  );

  it(
    'CT-515 (b) — o CHECK do banco recusa valor não positivo na inserção DIRETA, fora da borda',
    async () => {
      const cenario = await contratoAtivo();
      const antes = await contarCobrancas(EMPRESA_A.id);

      // A dupla asserção — borda Zod acima, `CHECK` do banco aqui — é deliberada: a borda recusa a
      // requisição, e a restrição garante que nenhum caminho de escrita futuro a contorne. Um `INSERT`
      // escrito por uma fatia posterior, uma importação da virada ou um script de operação encontram
      // a mesma regra.
      const falha = await capturar(async () => {
        await contextoDeTenant.executarCom({ empresaId: EMPRESA_A.id }, async () => {
          await acessoAoNegocio.emUnidadeDeTrabalho(async (tx) => {
            await tx`
              INSERT INTO negocio.cobranca (
                empresa_id, codigo, contrato_id, natureza, referencia,
                competencia, data_vencimento, valor_original
              )
              SELECT ${EMPRESA_A.id}, ${'COB-2027-9999999'}, c.id, 'ALUGUEL', ${REFERENCIA_DA_PARCELA},
                     ${competenciaDoCenario}::date, ${vencimentoDoCenario}::date, ${-10}
                FROM negocio.contrato c
               WHERE c.codigo = ${cenario.codigo}
            `;
          });
        });
      });

      // SQLSTATE e restrição EXATOS: `23514` sozinho não diria QUAL `check` recusou, e a tabela tem
      // quatro. É o par que discrimina.
      expect((falha as { code?: unknown } | undefined)?.code).toBe('23514');
      expect((falha as { constraint_name?: unknown } | undefined)?.constraint_name).toBe(
        'cobranca_valor_positivo_chk',
      );

      expect(await contarCobrancas(EMPRESA_A.id)).toBe(antes);
    },
    LIMITE_CASO_MS,
  );

  it(
    'CT-515 (c) — contrato alheio e contrato inexistente respondem o MESMO 404, byte a byte, e o retirado de circulação responde 422 nomeando o campo',
    async () => {
      // --- Passo 0: a montagem, em ordem TEMPORAL — e ela é conteúdo -----------------------------
      //
      // O contrato de A nasce **primeiro**, e só depois os códigos exclusivos de B. A ordem não é
      // arbitrária: o código legível é único por empresa, e as duas séries são contíguas a partir de
      // `1`, de modo que um código de B só é inalcançável em A enquanto a série de B estiver **à
      // frente**. Montar o contrato de A depois disso o traria de volta para dentro da faixa de B —
      // foi exatamente o que aconteceu na primeira escrita deste caso, e o `POST` "com o contrato de
      // B" respondeu `201` porque aquele código também era de um contrato de A.
      //
      // Todas as montagens ficam aqui, antes de qualquer medição, para que as contagens adiante
      // comparem número EXATO em vez de um delta de tamanho desconhecido.
      const emA = await contratoAtivo();
      const emB = await ateSerExclusivo(
        async () => await contratoAtivo(cookieDeB),
        COLECAO_DE_CONTRATOS,
        cookie,
      );
      const daB = await ateSerExclusivo(
        async () => await lancar(corpoDeCobranca(emB.codigo), cookieDeB),
        COLECAO_DE_COBRANCAS,
        cookie,
      );

      // Os dois contratos têm códigos DIFERENTES, e a linha existe porque o contrário é o modo de
      // falha natural aqui — não uma hipótese remota.
      expect(emA.codigo).not.toBe(emB.codigo);

      const antesEmA = await contarCobrancas(EMPRESA_A.id);
      const antesEmB = await contarCobrancas(EMPRESA_B.id);

      // --- Passo 1: da sessão de A, um contrato que não existe em lugar nenhum ------------------
      const inexistente = await pedir(COLECAO_DE_COBRANCAS, {
        metodo: 'POST',
        cookie,
        corpo: corpoDeCobranca(CONTRATO_INEXISTENTE),
      });

      // --- Passo 2: da sessão de A, o contrato ATIVO da empresa B ------------------------------
      const alheio = await pedir(COLECAO_DE_COBRANCAS, {
        metodo: 'POST',
        cookie,
        corpo: corpoDeCobranca(emB.codigo),
      });

      // A igualdade de CORPO INTEIRO vem primeiro, e é ela o ponto do caso: afirmar só o status
      // deixaria passar uma mensagem que diferenciasse as duas causas da ausência — o oráculo de
      // existência que a ADR-0008 proíbe. A segunda asserção é o que impede dois `500` idênticos de
      // satisfazerem a primeira.
      expect(alheio.status).toBe(inexistente.status);
      expect(alheio.corpo).toEqual(inexistente.corpo);
      expect(inexistente.status).toBe(404);
      expect(inexistente.corpo).toEqual({
        codigo: CodigoErro.RECURSO_NAO_ENCONTRADO,
        mensagem: MENSAGEM_DE_NAO_ENCONTRADO,
      });

      // A direção inversa — a sessão de B citando o contrato de A — **não é exprimível ao mesmo
      // tempo** que esta, e a razão é aritmética, não desleixo: as duas séries são contíguas a partir
      // de `1`, então só a empresa que estiver à frente tem código que a outra não alcança. Ter as
      // duas exclusivas no mesmo instante é impossível. Ela também não acrescentaria poder de
      // detecção: as duas conferências são o **mesmo** ponto único do serviço, sem parâmetro de
      // empresa em lugar algum — quem separa as empresas é a política do banco, e a direção inversa
      // dessa mesma classe já está provada pelo `CT-423` de `test/contratos.e2e.spec.ts`.

      // --- Passo 3: o contrato da PRÓPRIA empresa, retirado de circulação -----------------------
      //
      // A precondição é montada pela rota real de retirada. `localizarContrato` alcança o retirado de
      // propósito (ADR-0014), então nada o recusaria sozinho: a recusa é deliberada, e diz por quê.
      const retirada = await pedir(`${COLECAO_DE_CONTRATOS}/${emA.codigo}/retirada`, {
        metodo: 'POST',
        cookie,
        corpo: {},
      });
      expect(retirada.status).toBe(200);

      const foraDeCirculacao = await pedir(COLECAO_DE_COBRANCAS, {
        metodo: 'POST',
        cookie,
        corpo: corpoDeCobranca(emA.codigo),
      });

      expect(foraDeCirculacao.status).toBe(422);
      // O envelope INTEIRO, com `detalhes` — que é o que separa esta recusa da de entrada do
      // `CT-515`, cujo corpo não tem o campo. Sem a igualdade de objeto, um `detalhes` vazio ou com
      // outro discriminador passaria.
      expect(foraDeCirculacao.corpo).toEqual({
        codigo: CodigoErro.CAMPO_INVALIDO,
        mensagem: MENSAGEM_DE_CAMPO_INVALIDO,
        campo: 'contratoCodigo',
        detalhes: { circulacao: 'RETIRADO_DE_CIRCULACAO' },
      });

      // Nenhuma das TRÊS recusas gravou coisa alguma — as contagens são cruas, sem recorte, e as
      // duas empresas são medidas: uma gravação que caísse na empresa errada seria invisível numa só.
      expect(await contarCobrancas(EMPRESA_A.id)).toBe(antesEmA);
      expect(await contarCobrancas(EMPRESA_B.id)).toBe(antesEmB);

      // --- Passo 4: a leitura por código, nas duas causas da ausência ---------------------------
      const leituraAlheia = await pedir(`${COLECAO_DE_COBRANCAS}/${daB.codigo}`, { cookie });
      const leituraInexistente = await pedir(`${COLECAO_DE_COBRANCAS}/${COBRANCA_INEXISTENTE}`, {
        cookie,
      });

      expect(leituraAlheia.status).toBe(leituraInexistente.status);
      expect(leituraAlheia.corpo).toEqual(leituraInexistente.corpo);
      expect(leituraAlheia.status).toBe(404);
      // E é o MESMO corpo das recusas de lançamento: a borda tem um ponto único de `404`, e não dois
      // livres para divergir.
      expect(leituraAlheia.corpo).toEqual(inexistente.corpo);

      // --- Passo 5: o controle positivo -----------------------------------------------------------
      //
      // Sem ele, tudo acima seria satisfeito por uma borda que respondesse `404` a toda requisição —
      // e o `422` do passo 3 deixaria de provar que a causa era a circulação, e não algo permanente
      // no contrato do cenário. A recirculação é a mesma rota real, no sentido oposto.
      const recirculacao = await pedir(`${COLECAO_DE_CONTRATOS}/${emA.codigo}/recirculacao`, {
        metodo: 'POST',
        cookie,
        corpo: {},
      });
      expect(recirculacao.status).toBe(200);

      const propria = await lancar(corpoDeCobranca(emA.codigo));
      const lidaPropria = await pedir(`${COLECAO_DE_COBRANCAS}/${propria.codigo}`, { cookie });

      expect(lidaPropria.status).toBe(200);
      expect(lidaPropria.corpo).toEqual(propria);

      // Exatamente UMA linha nasceu, e ela nasceu na empresa de quem lançou.
      expect(await contarCobrancas(EMPRESA_A.id)).toBe(antesEmA + 1);
      expect(await contarCobrancas(EMPRESA_B.id)).toBe(antesEmB);
    },
    LIMITE_CASO_MS,
  );

  it(
    'CT-515 (d) — a colisão do código EMITIDO é traduzida em 422 nomeando `codigo`, e o número queimado não volta',
    async () => {
      const cenario = await contratoAtivo();

      // A colisão é provocada pelo caminho que a produz de verdade: uma linha cujo código é o que a
      // PRÓXIMA emissão vai compor — é o que a semeadura da virada (F7) e um código gravado antes do
      // contador produzem em produção. O código não é escolhido pelo cliente, e por isso não há corpo
      // de requisição capaz de provocar a recusa: a linha é inserida DIRETAMENTE, sob o contexto da
      // empresa, pelo mesmo acessório do `CT-515 (b)`. **Nenhum símbolo de produção nasce para isso**,
      // e nada é semeado na sequência — o privilégio sobre ela não existe, por decisão fechada da
      // `0010`.
      const primeira = await lancar(corpoDeCobranca(cenario.codigo));
      const codigoDoProximo = sucessorDe(primeira.codigo);

      await inserirCobranca(cenario.codigo, codigoDoProximo);
      const antes = await contarCobrancas(EMPRESA_A.id);

      const colidiu = await pedir(COLECAO_DE_COBRANCAS, {
        metodo: 'POST',
        cookie,
        corpo: corpoDeCobranca(cenario.codigo),
      });

      expect(colidiu.status).toBe(422);
      // O campo é `codigo`, e **não** `contratoCodigo`: quem colidiu foi o código EMITIDO, e o
      // cliente não tem o que corrigir no corpo. O envelope inteiro, com `detalhes`.
      expect(colidiu.corpo).toEqual({
        codigo: CodigoErro.CAMPO_INVALIDO,
        mensagem: MENSAGEM_DE_CAMPO_INVALIDO,
        campo: 'codigo',
        detalhes: { conflito: 'CODIGO_EM_USO' },
      });

      expect(await contarCobrancas(EMPRESA_A.id)).toBe(antes);

      // O número que a tentativa recusada consumiu **não volta** (ADR-0015): o lançamento seguinte
      // toma o posterior, e não o mesmo. Sem esta asserção, uma emissão que devolvesse o número ao
      // contador passaria — e o furo aceito viraria reuso.
      const seguinte = await lancar(corpoDeCobranca(cenario.codigo));

      expect(seguinte.codigo).toBe(sucessorDe(codigoDoProximo));
      expect(await contarCobrancas(EMPRESA_A.id)).toBe(antes + 1);
    },
    LIMITE_CASO_MS,
  );
});

describe('as duas transições da cobrança (T7)', () => {
  it(
    'CT-516 — acusar pagamento congela os quatro carimbos com os centavos que a view publicava',
    async () => {
      const cenario = await contratoAtivo();
      await definirPolitica(MULTA_INICIAL, JUROS_INICIAL);

      const cobranca = await lancarEm(cenario.codigo, -DIAS_DA_CANONICA, VALOR_DA_CANONICA);

      // --- Passo 1: o que a view publicava no instante ANTERIOR ao pagamento --------------------
      //
      // Os três valores são os do golden `calcular-mora.json`, caso `exemplo_canonico_2074_67`: 2% de
      // `2000.00` são `40.00`, e 52 dias a 1%/mês sobre base de trinta dias são `34.67`. Eles são
      // afirmados **antes** para que a comparação adiante seja contra um valor observado, e não contra
      // um literal que o caso escolheu — e o literal está aqui para que o caso reprove se a view
      // deixar de reproduzir o oráculo.
      const antes = await lerCobranca(cobranca.codigo);

      expect(antes.status).toBe('VENCIDA');
      expect(antes.diasAtraso).toBe(DIAS_DA_CANONICA);
      expect(antes.valorMulta).toBe(MULTA_DA_CANONICA);
      expect(antes.valorJuros).toBe(JUROS_DA_CANONICA);
      expect(antes.valorTotal).toBe(TOTAL_DA_CANONICA);

      // --- Passos 2 e 3: o pagamento ------------------------------------------------------------
      const pagamento = await pedir(rotaDoPagamento(cobranca.codigo), {
        metodo: 'POST',
        cookie,
        corpo: { pagoEm: antes.dataVencimento, valorPago: TOTAL_DA_CANONICA },
      });

      expect(pagamento.status).toBe(200);
      expect((pagamento.corpo as CobrancaPublicada).status).toBe('PAGA');

      // --- Passos 4, 5 e 6: a releitura, e os quatro carimbos -----------------------------------
      //
      // O corpo INTEIRO por igualdade: é ele que afirma, de uma vez, que `pagoEm` e `valorPago` são os
      // informados, que os quatro carimbos ficaram com os centavos do instante anterior, que
      // `canceladoEm` continua nulo e que **nenhum campo a mais** apareceu. Os dois percentuais são o
      // discriminador do CT-518 — sem eles, uma implementação que carimbasse só os valores passaria
      // numa releitura ingênua e perderia a configuração vigente que a ADR-0022 manda gravar.
      const depois = await lerCobranca(cobranca.codigo);

      expect(depois).toEqual({
        ...antes,
        status: 'PAGA',
        diasAtraso: 0,
        pagoEm: antes.dataVencimento,
        valorPago: TOTAL_DA_CANONICA,
        multaPercentualAplicado: MULTA_INICIAL,
        jurosPercentualAplicado: JUROS_INICIAL,
      });
      // E os três valores publicados são os CARIMBOS, e não uma reapuração: a paga já não está
      // `VENCIDA`, de modo que uma view que reapurasse pela precedência devolveria `0.00`/`0.00` e o
      // total voltaria ao valor original. As três asserções nomeadas repetem o que a igualdade acima
      // já garante, e existem para que a reprovação diga QUAL centavo se moveu.
      expect(depois.valorMulta).toBe(MULTA_DA_CANONICA);
      expect(depois.valorJuros).toBe(JUROS_DA_CANONICA);
      expect(depois.valorTotal).toBe(TOTAL_DA_CANONICA);
      expect(depois.valorTotal).not.toBe(VALOR_DA_CANONICA);
      // A resposta do próprio ato é igual à releitura: a rota não publica um retrato diferente do que
      // a leitura seguinte devolve.
      expect(pagamento.corpo).toEqual(depois);
    },
    LIMITE_CASO_MS,
  );

  it(
    'CT-518 — alterar a multa DEPOIS do pagamento não move um centavo do que ficou registrado',
    async () => {
      const cenario = await contratoAtivo();
      await definirPolitica(MULTA_INICIAL, JUROS_INICIAL);

      const cobranca = await lancarEm(cenario.codigo, -DIAS_DA_CANONICA, VALOR_DA_CANONICA);

      // --- Passo 1: pagar, e guardar a publicação INTEIRA --------------------------------------
      const paga = await pagar(cobranca.codigo, {
        pagoEm: cobranca.dataVencimento,
        valorPago: TOTAL_DA_CANONICA,
      });

      expect(paga.status).toBe('PAGA');

      // --- Passo 2: a política MUDA, e a leitura dela confirma ---------------------------------
      await definirPolitica(MULTA_ALTERADA, JUROS_ALTERADO);

      expect(await lerPolitica()).toEqual({
        multaPercentual: MULTA_ALTERADA,
        jurosPercentual: JUROS_ALTERADO,
      });

      // --- Passos 3 e 4: a releitura, por igualdade de OBJETO ----------------------------------
      //
      // `toEqual` sobre o objeto inteiro, e nunca `toMatchObject` nem presença de campo: o que se
      // afirma é que **nada** se moveu, e um subconjunto deixaria passar exatamente o campo que a
      // reapuração mexeria.
      const relida = await lerCobranca(cobranca.codigo);

      expect(relida).toEqual(paga);

      // --- Passo 5: os quatro carimbos, nominalmente ------------------------------------------
      //
      // Os percentuais gravados são os **antigos**, e é isso que prova que o carimbo inclui a
      // configuração vigente no ato. Uma implementação que carimbasse só os valores publicaria aqui
      // `10.00`/`5.00` — os novos —, e a igualdade de objeto acima não a pegaria, porque os dois
      // valores continuariam corretos.
      expect(relida.valorMulta).toBe(MULTA_DA_CANONICA);
      expect(relida.valorJuros).toBe(JUROS_DA_CANONICA);
      expect(relida.multaPercentualAplicado).toBe(MULTA_INICIAL);
      expect(relida.jurosPercentualAplicado).toBe(JUROS_INICIAL);

      // --- Passo 6: o total NÃO é o da reapuração ---------------------------------------------
      //
      // Pela configuração nova, `2000.00` a 52 dias daria `200.00` de multa e `173.33` de juros —
      // `2373.33`. A asserção negativa é o que separa *"o total está certo"* de *"o total não foi
      // reapurado"*, e ela nomeia os dois números na reprovação.
      expect(relida.valorTotal).toBe(TOTAL_DA_CANONICA);
      expect(relida.valorTotal).not.toBe(TOTAL_REAPURADO);
    },
    LIMITE_CASO_MS,
  );

  it(
    'CT-529 — alterar a multa alcança as cobranças em aberto e só elas, no mesmo ato',
    async () => {
      const cenario = await contratoAtivo();
      await definirPolitica(MULTA_INICIAL, JUROS_INICIAL);

      const emAberto = await lancarEm(cenario.codigo, -DIAS_DA_ABERTA, VALOR_DA_CANONICA);
      const aPagar = await lancarEm(cenario.codigo, -DIAS_DA_ABERTA, VALOR_DA_CANONICA);
      const paga = await pagar(aPagar.codigo, {
        pagoEm: aPagar.dataVencimento,
        valorPago: TOTAL_DA_ABERTA,
      });

      // --- Passos 1 e 2: as duas publicações ANTES da alteração --------------------------------
      //
      // A vencida há 30 dias a 2%/1% apura `40.00` de multa e `20.00` de juros — um mês de atraso vale
      // a taxa mensal cheia, porque a base é o mês comercial de trinta dias.
      const abertaAntes = await lerCobranca(emAberto.codigo);

      expect(abertaAntes.status).toBe('VENCIDA');
      expect(abertaAntes.valorMulta).toBe(MULTA_DA_ABERTA);
      expect(abertaAntes.valorJuros).toBe(JUROS_DA_ABERTA);
      expect(abertaAntes.valorTotal).toBe(TOTAL_DA_ABERTA);
      expect(paga.status).toBe('PAGA');

      const xminAntes = await xminDa(emAberto.codigo);

      // --- Passo 3: a política muda ------------------------------------------------------------
      await definirPolitica(MULTA_MAIOR, JUROS_INICIAL);

      expect(await lerPolitica()).toEqual({
        multaPercentual: MULTA_MAIOR,
        jurosPercentual: JUROS_INICIAL,
      });

      // --- Passo 4: a ABERTA passa a publicar pela política NOVA, na leitura seguinte ----------
      //
      // Sem que nada tenha rodado: não há rotina, não há fila e não há gatilho — a mudança vem da
      // derivação. `2000.00` a 5% são `100.00`, e os juros não se movem porque o percentual deles não
      // mudou, o que também separa *"a multa foi reapurada"* de *"tudo foi reapurado"*.
      const abertaDepois = await lerCobranca(emAberto.codigo);

      expect(abertaDepois.valorMulta).toBe(MULTA_MAIOR_APLICADA);
      expect(abertaDepois.valorJuros).toBe(JUROS_DA_ABERTA);
      expect(abertaDepois.valorTotal).toBe(TOTAL_COM_MULTA_MAIOR);

      // --- Passo 5: a PAGA, por igualdade de OBJETO, no MESMO ato -----------------------------
      expect(await lerCobranca(aPagar.codigo)).toEqual(paga);

      // --- Passo 6: o `xmin` da ABERTA é o MESMO ----------------------------------------------
      //
      // É o que separa *derivado* de *materializado por gatilho na alteração da política*: uma
      // implementação que reescrevesse as cobranças em aberto ao salvar a configuração passaria por
      // todos os valores acima e reprovaria aqui — que é o desejado.
      expect(await xminDa(emAberto.codigo)).toBe(xminAntes);
    },
    LIMITE_CASO_MS,
  );

  it(
    'CT-511 — o estado e o valor total são idênticos nos quatro caminhos de leitura publicados',
    async () => {
      const cenario = await contratoAtivo();
      await definirPolitica(MULTA_INICIAL, JUROS_INICIAL);

      // --- Passo 0: as quatro cobranças, uma em cada estado -----------------------------------
      //
      // Os terminais são montados **pelas rotas desta task**, e não por escrita direta: é o único
      // caminho legítimo, e é ele que faz o `status` publicado ser consequência do fato gravado.
      const aVencer = await lancarEm(cenario.codigo, DIAS_ATE_O_VENCIMENTO, VALOR_REDONDO);
      const vencida = await lancarEm(cenario.codigo, -DIAS_DA_ABERTA, VALOR_REDONDO);
      const aPagar = await lancarEm(cenario.codigo, -DIAS_DA_ABERTA, VALOR_REDONDO);
      const aCancelar = await lancarEm(cenario.codigo, -DIAS_DA_ABERTA, VALOR_REDONDO);

      await pagar(aPagar.codigo, {
        pagoEm: aPagar.dataVencimento,
        valorPago: TOTAL_REDONDO_COM_MORA,
      });
      await cancelar(aCancelar.codigo);

      /** O par esperado de cada estado — os valores concretos, e não só a concordância. */
      const esperados: readonly { readonly codigo: string; readonly par: ParDeLeitura }[] = [
        { codigo: aVencer.codigo, par: { status: 'A_VENCER', valorTotal: VALOR_REDONDO } },
        { codigo: vencida.codigo, par: { status: 'VENCIDA', valorTotal: TOTAL_REDONDO_COM_MORA } },
        { codigo: aPagar.codigo, par: { status: 'PAGA', valorTotal: TOTAL_REDONDO_COM_MORA } },
        { codigo: aCancelar.codigo, par: { status: 'CANCELADA', valorTotal: VALOR_REDONDO } },
      ];

      // --- Passos 1 a 4: os quatro caminhos, para cada uma das quatro --------------------------
      //
      // A janela é declarada larga o bastante para conter a carteira inteira da empresa: o recorte
      // pedido continua sendo **nenhum**, e o que se evita é medir uma página em vez do conjunto.
      const semFiltro = await listar(`limite=${String(JANELA_LARGA)}`);
      const doContrato = await listar(`contrato=${cenario.codigo}&limite=${String(JANELA_LARGA)}`);

      for (const { codigo, par } of esperados) {
        const porItem = parDe(await lerCobranca(codigo));
        const naLista = parDe(itemDe(semFiltro, codigo));
        const noContrato = parDe(itemDe(doContrato, codigo));
        const porEstado = parDe(
          itemDe(await listar(`status=${par.status}&limite=${String(JANELA_LARGA)}`), codigo),
        );

        // A igualdade estrita dos QUATRO pares, e nunca `toMatchObject`: uma segunda derivação escrita
        // num dos caminhos de leitura reprova aqui exibindo os dois valores.
        expect(porItem, codigo).toEqual(par);
        expect(naLista, codigo).toEqual(par);
        expect(noContrato, codigo).toEqual(par);
        expect(porEstado, codigo).toEqual(par);
      }

      // --- Passo 5: e o recorte por estado PARTICIONA as quatro -------------------------------
      //
      // A âncora de não-vacuidade dos quatro recortes: cada um traz a sua e nenhuma das outras três.
      // Sem ela, um filtro ignorado devolveria a carteira inteira e as asserções acima passariam,
      // porque `itemDe` acharia o item de qualquer jeito.
      for (const { codigo, par } of esperados) {
        const doEstado = await listar(`status=${par.status}&limite=${String(JANELA_LARGA)}`);
        const outras = esperados
          .filter((esperado) => esperado.codigo !== codigo)
          .map((esperado) => esperado.codigo);

        expect(
          doEstado.itens.map((item) => item.codigo),
          codigo,
        ).toContain(codigo);
        for (const alheia of outras) {
          expect(
            doEstado.itens.map((item) => item.codigo),
            `${par.status} × ${alheia}`,
          ).not.toContain(alheia);
        }
      }
    },
    LIMITE_CASO_MS,
  );

  it(
    'CT-519 — cancelar preserva o registro legível e libera substituta com código novo',
    async () => {
      const cenario = await contratoAtivo();
      const original = await lancarEm(cenario.codigo, DIAS_ATE_O_VENCIMENTO, VALOR_DA_AGUA, 'AGUA');
      const antes = await contarCobrancas(EMPRESA_A.id);

      // --- Passo 2: o cancelamento -------------------------------------------------------------
      const cancelamento = await pedir(rotaDoCancelamento(original.codigo), {
        metodo: 'POST',
        cookie,
        corpo: {},
      });

      expect(cancelamento.status).toBe(200);
      expect((cancelamento.corpo as CobrancaPublicada).status).toBe('CANCELADA');

      // --- Passo 3: a releitura devolve `200`, e NUNCA `404` ----------------------------------
      //
      // É o que separa *cancelar* de *retirar de circulação*, e é a materialização do invariante da
      // ADR-0014 nesta fatia: o registro permanece legível por quem já o referencia. Os quatro campos
      // de negócio são afirmados um a um contra os originais — um cancelamento que zerasse termos
      // reprovaria aqui, e não numa asserção de status.
      const releitura = await pedir(`${COLECAO_DE_COBRANCAS}/${original.codigo}`, { cookie });

      expect(releitura.status).toBe(200);

      const cancelada = releitura.corpo as CobrancaPublicada;

      expect(cancelada.status).toBe('CANCELADA');
      expect(cancelada.canceladoEm).not.toBeNull();
      expect(cancelada.natureza).toBe(original.natureza);
      expect(cancelada.referencia).toBe(original.referencia);
      expect(cancelada.competencia).toBe(original.competencia);
      expect(cancelada.valorOriginal).toBe(original.valorOriginal);
      // E a mora deixa de ser apurada: o total volta ao valor original mesmo que o vencimento passe.
      expect(cancelada.valorTotal).toBe(original.valorOriginal);
      expect(cancelamento.corpo).toEqual(cancelada);

      // --- Passo 4: ela CONSTA da lista -------------------------------------------------------
      const carteira = await listar(`contrato=${cenario.codigo}&limite=${String(JANELA_LARGA)}`);

      expect(carteira.itens.map((item) => item.codigo)).toContain(original.codigo);

      // --- Passo 5: a substituta recebe código NOVO, com sufixo MAIOR -------------------------
      //
      // O código da cancelada segue ocupado na unicidade `(empresa_id, codigo)`, e a série nunca reusa
      // número (ADR-0015). A comparação é sobre o sufixo numérico, e não sobre a cadeia: é ele que
      // carrega a posição na série.
      const substituta = await lancarEm(
        cenario.codigo,
        DIAS_ATE_O_VENCIMENTO,
        VALOR_DA_SUBSTITUTA,
        'AGUA',
      );

      expect(substituta.codigo).not.toBe(original.codigo);
      expect(sufixoDe(substituta.codigo)).toBeGreaterThan(sufixoDe(original.codigo));
      expect(substituta.natureza).toBe(original.natureza);
      expect(substituta.competencia).toBe(original.competencia);

      // --- Passo 6: a contagem subiu em EXATAMENTE um ----------------------------------------
      //
      // Nada foi apagado: a cancelada continua na tabela, e o que nasceu foi a substituta. Uma
      // implementação que apagasse a cancelada deixaria a contagem igual.
      expect(await contarCobrancas(EMPRESA_A.id)).toBe(antes + 1);

      // --- Passo 7: o esquema publicado NÃO tem campo de vínculo -----------------------------
      //
      // Igualdade do conjunto de chaves, e não ausência de um nome escolhido: `substituiCodigo` seria
      // só uma das grafias possíveis, e a igualdade pega qualquer uma. A decisão está registrada na
      // §21 do tech spec — o PRD não pede rastrear a substituição.
      expect(Object.keys(cancelada).sort()).toEqual([...CHAVES_PUBLICADAS]);
      expect(Object.keys(substituta).sort()).toEqual([...CHAVES_PUBLICADAS]);
    },
    LIMITE_CASO_MS,
  );

  it(
    'CT-520 — cancelar cobrança PAGA ou já CANCELADA é recusado, e nada muda',
    async () => {
      const cenario = await contratoAtivo();
      await definirPolitica(MULTA_INICIAL, JUROS_INICIAL);

      const aPagar = await lancarEm(cenario.codigo, -DIAS_DA_ABERTA, VALOR_DA_CANONICA);
      const aCancelar = await lancarEm(cenario.codigo, DIAS_ATE_O_VENCIMENTO, VALOR_DA_CANONICA);

      const paga = await pagar(aPagar.codigo, {
        pagoEm: aPagar.dataVencimento,
        valorPago: TOTAL_DA_ABERTA,
      });
      const cancelada = await cancelar(aCancelar.codigo);

      // --- Passo 1: o `xmin` das duas tuplas, antes ------------------------------------------
      const xminDaPaga = await xminDa(paga.codigo);
      const xminDaCancelada = await xminDa(cancelada.codigo);

      // --- Passos 2 e 3: as duas recusas, com o envelope INTEIRO ----------------------------
      //
      // O envelope por igualdade de objeto, e não a presença de campos: `campo` é `codigo` — o cliente
      // não envia estado algum a esta rota —, e `detalhes` carrega os dois discriminadores que a fatia
      // de contratos fixou. Um terceiro nome para a mesma classe de recusa reprova aqui.
      const sobreAPaga = await pedir(rotaDoCancelamento(paga.codigo), {
        metodo: 'POST',
        cookie,
        corpo: {},
      });

      expect(sobreAPaga.status).toBe(422);
      expect(sobreAPaga.corpo).toEqual({
        codigo: CodigoErro.CAMPO_INVALIDO,
        mensagem: MENSAGEM_DE_CAMPO_INVALIDO,
        campo: 'codigo',
        detalhes: { estadoAtual: 'PAGA', transicaoPedida: 'CANCELAMENTO' },
      });

      const sobreACancelada = await pedir(rotaDoCancelamento(cancelada.codigo), {
        metodo: 'POST',
        cookie,
        corpo: {},
      });

      expect(sobreACancelada.status).toBe(422);
      expect(sobreACancelada.corpo).toEqual({
        codigo: CodigoErro.CAMPO_INVALIDO,
        mensagem: MENSAGEM_DE_CAMPO_INVALIDO,
        campo: 'codigo',
        detalhes: { estadoAtual: 'CANCELADA', transicaoPedida: 'CANCELAMENTO' },
      });

      // --- Passo 4: o `xmin` das duas é o MESMO ---------------------------------------------
      //
      // É o que distingue *recusado* de *aceito sem efeito visível*: um `UPDATE … WHERE cancelado_em
      // IS NULL` respondendo `200` passaria por uma asserção de estado só.
      expect(await xminDa(paga.codigo)).toBe(xminDaPaga);
      expect(await xminDa(cancelada.codigo)).toBe(xminDaCancelada);

      // --- Passos 5 e 6: o instante ORIGINAL e os carimbos, preservados ---------------------
      //
      // Um cancelamento idempotente que recarimbasse `cancelado_em` reprovaria aqui, e é o desejado: o
      // instante do primeiro cancelamento é o fato, e o segundo pedido significa que quem o fez não
      // sabia o estado.
      expect(await lerCobranca(cancelada.codigo)).toEqual(cancelada);
      expect(await lerCobranca(paga.codigo)).toEqual(paga);
    },
    LIMITE_CASO_MS,
  );

  it(
    'CT-517 (rota) — acusar pagamento de cobrança PAGA ou CANCELADA é recusado, sem escrita alguma',
    async () => {
      const cenario = await contratoAtivo();
      await definirPolitica(MULTA_INICIAL, JUROS_INICIAL);

      const aPagar = await lancarEm(cenario.codigo, -DIAS_DA_ABERTA, VALOR_DA_CANONICA);
      const aCancelar = await lancarEm(cenario.codigo, DIAS_ATE_O_VENCIMENTO, VALOR_DA_CANONICA);

      const paga = await pagar(aPagar.codigo, {
        pagoEm: aPagar.dataVencimento,
        valorPago: TOTAL_DA_ABERTA,
      });
      const cancelada = await cancelar(aCancelar.codigo);

      const xminDaPaga = await xminDa(paga.codigo);
      const xminDaCancelada = await xminDa(cancelada.codigo);

      // --- As duas recusas, nomeando o estado atual em `detalhes` ---------------------------
      const sobreAPaga = await pedir(rotaDoPagamento(paga.codigo), {
        metodo: 'POST',
        cookie,
        corpo: { pagoEm: paga.dataVencimento, valorPago: TOTAL_DA_ABERTA },
      });

      expect(sobreAPaga.status).toBe(422);
      expect(sobreAPaga.corpo).toEqual({
        codigo: CodigoErro.CAMPO_INVALIDO,
        mensagem: MENSAGEM_DE_CAMPO_INVALIDO,
        campo: 'codigo',
        detalhes: { estadoAtual: 'PAGA', transicaoPedida: 'PAGAMENTO' },
      });

      const sobreACancelada = await pedir(rotaDoPagamento(cancelada.codigo), {
        metodo: 'POST',
        cookie,
        corpo: { pagoEm: cancelada.dataVencimento, valorPago: VALOR_DA_CANONICA },
      });

      expect(sobreACancelada.status).toBe(422);
      expect(sobreACancelada.corpo).toEqual({
        codigo: CodigoErro.CAMPO_INVALIDO,
        mensagem: MENSAGEM_DE_CAMPO_INVALIDO,
        campo: 'codigo',
        detalhes: { estadoAtual: 'CANCELADA', transicaoPedida: 'PAGAMENTO' },
      });

      // --- E nada foi escrito: `xmin` idêntico, publicação idêntica -------------------------
      //
      // A igualdade de objeto sobre as duas releituras é o que afirma que `pago_em`, `valor_pago` e os
      // quatro carimbos permaneceram com os valores originais — o `xmin` prova que a tupla não foi
      // reescrita, e a igualdade prova que o que ela carrega é o mesmo.
      expect(await xminDa(paga.codigo)).toBe(xminDaPaga);
      expect(await xminDa(cancelada.codigo)).toBe(xminDaCancelada);
      expect(await lerCobranca(paga.codigo)).toEqual(paga);
      expect(await lerCobranca(cancelada.codigo)).toEqual(cancelada);

      // --- E o corpo malformado é recusado nomeando o campo do Zod --------------------------
      //
      // O companheiro que separa *"a guarda de estado recusa"* de *"a rota recusa tudo"*: uma cobrança
      // em aberto com corpo inválido é recusada por **outro** motivo, e o campo nomeado é o do corpo.
      const emAberto = await lancarEm(cenario.codigo, -DIAS_DA_ABERTA, VALOR_DA_CANONICA);
      const semValor = await pedir(rotaDoPagamento(emAberto.codigo), {
        metodo: 'POST',
        cookie,
        corpo: { pagoEm: emAberto.dataVencimento },
      });

      expect(semValor.status).toBe(422);
      expect(semValor.corpo).toEqual({
        codigo: CodigoErro.CAMPO_INVALIDO,
        mensagem: MENSAGEM_DE_CAMPO_INVALIDO,
        campo: 'valorPago',
      });

      // E a chave desconhecida no corpo do CANCELAMENTO, que é vazio e fechado.
      const comChaveDesconhecida = await pedir(rotaDoCancelamento(emAberto.codigo), {
        metodo: 'POST',
        cookie,
        corpo: { status: 'CANCELADA' },
      });

      expect(comChaveDesconhecida.status).toBe(422);
      expect(comChaveDesconhecida.corpo).toEqual({
        codigo: CodigoErro.CAMPO_INVALIDO,
        mensagem: MENSAGEM_DE_CAMPO_INVALIDO,
        campo: 'corpo',
      });

      // O CONTROLE POSITIVO das duas recusas de corpo: a cobrança segue em aberto e pagável.
      expect((await lerCobranca(emAberto.codigo)).status).toBe('VENCIDA');
      expect(
        (
          await pagar(emAberto.codigo, {
            pagoEm: emAberto.dataVencimento,
            valorPago: TOTAL_DA_ABERTA,
          })
        ).status,
      ).toBe('PAGA');
    },
    LIMITE_CASO_MS,
  );
});

// ---------------------------------------------------------------------------------------------
// Acessórios — tudo pelas rotas reais, salvo a contagem crua e a inserção direta do CT-515 (b)
// ---------------------------------------------------------------------------------------------

let sequencial = 0;

function proximo(): number {
  sequencial += 1;

  return sequencial;
}

interface CenarioDeContrato {
  readonly codigo: string;
  readonly locatarioId: string;
}

/**
 * Monta conjunto, imóvel, locador, locatário e um contrato **ATIVO**, todos pelas rotas reais.
 *
 * Nada é gravado por conexão privilegiada: a empresa de cada cadastro sai da sessão que o cria. A
 * falha levanta em vez de devolver — uma precondição que falhasse em silêncio faria o caso reprovar
 * numa asserção adiante, apontando para o lugar errado.
 *
 * A **credencial é parâmetro**, com a sessão de A por padrão, e é o que permite ao `CT-515 (c)` montar
 * o mesmo cenário na empresa B sem que rota alguma receba a empresa: quem decide onde o cadastro
 * nasce é o cookie, e nada mais.
 *
 * ---------------------------------------------------------------------------
 * O contrato nasce com `gerarCobrancasAutomaticamente: false`, e a escolha é o que PRESERVA os casos
 * ---------------------------------------------------------------------------
 *
 * SUT_IS_CORRECT_BECAUSE: o código de produção está certo e era este arranjo que dependia de a ativação
 * não gerar cobrança. Desde a T9 a ativação **gera as parcelas de aluguel na mesma unidade de trabalho**
 * — é o fecho do débito **D28** da fatia `contratos-de-locacao` (F2/T7) —, de modo que um contrato de
 * {@link PRAZO_EM_MESES} meses ativado aqui faria nascer doze cobranças `ALUGUEL` **antes** de cada caso
 * lançar as suas. Duas asserções do `CT-514` mediriam então outra coisa: a igualdade de lista de códigos
 * do recorte `natureza=ALUGUEL` (que compara com as parcelas lançadas **por ele**), e o sequencial
 * `0000001` do `CT-514 (b)`, cuja afirmação literal é *"foi por ESTA rota que a série nasceu"*.
 *
 * O `false` é o que mantém as duas verdadeiras, e ele **não** é contorno: é o campo de negócio da RD-20,
 * que declara por contrato que aquele contrato não gera parcelas automaticamente, e é exatamente o
 * cenário em que o lançamento avulso é a única origem de cobrança — que é o que este arquivo mede. Quem
 * prova o caminho oposto, com as parcelas nascendo da ativação, é o `CT-508` de
 * `test/contratos.e2e.spec.ts`.
 *
 * **Nenhuma asserção deste arquivo mudou, e nenhuma foi afrouxada** — só a precondição, num campo do
 * corpo da montagem.
 */
async function contratoAtivo(credencial: string = cookie): Promise<CenarioDeContrato> {
  const conjuntoId = (
    await criarPor(CAMINHO_DOS_CONJUNTOS, { nome: `Edifício ${String(proximo())}` }, credencial)
  ).id;
  const imovelId = (await criarPor(CAMINHO_DOS_IMOVEIS, corpoDeImovel(conjuntoId), credencial)).id;
  const locadorId = (await criarPor(CAMINHO_DOS_LOCADORES, corpoDePessoa(), credencial)).id;
  const locatarioId = (await criarPor(CAMINHO_DOS_LOCATARIOS, corpoDePessoa(), credencial)).id;

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
      // Ver o docblock acima: a ativação gera as parcelas desde a T9, e o `false` é o que mantém este
      // arquivo medindo o LANÇAMENTO AVULSO como única origem de cobrança.
      gerarCobrancasAutomaticamente: false,
      pdfContratoArquivo: null,
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

  return { codigo, locatarioId };
}

/** Lança uma cobrança pela rota real e devolve o corpo publicado. A falha levanta. */
async function lancar(
  corpo: Record<string, unknown>,
  credencial: string = cookie,
): Promise<CobrancaPublicada> {
  const resposta = await pedir(COLECAO_DE_COBRANCAS, { metodo: 'POST', cookie: credencial, corpo });

  if (resposta.status !== 201) {
    throw new Error(`o lançamento respondeu ${String(resposta.status)}: ${resposta.texto}`);
  }

  return resposta.corpo as CobrancaPublicada;
}

/**
 * O corpo de um lançamento válido sobre o contrato informado.
 *
 * Ele é válido em **todos** os campos de propósito: o que o `CT-515 (c)` e o `CT-515 (d)` medem é a
 * recusa por **referência** — contrato inalcançável, fora de circulação, código emitido em uso —, e um
 * corpo com defeito de entrada faria a borda recusá-lo antes, no Zod, medindo outra coisa.
 */
function corpoDeCobranca(contratoCodigo: string): Record<string, unknown> {
  return {
    contratoCodigo,
    natureza: 'ALUGUEL',
    referencia: REFERENCIA_DA_PARCELA,
    competencia: competenciaDoCenario,
    dataVencimento: vencimentoDoCenario,
    valorOriginal: VALOR_DA_PARCELA,
  };
}

/** As duas rotas de transição, compostas a partir do dono do segmento — nunca escritas à mão. */
function rotaDoPagamento(codigo: string): string {
  return `${COLECAO_DE_COBRANCAS}/${codigo}/pagamento`;
}

function rotaDoCancelamento(codigo: string): string {
  return `${COLECAO_DE_COBRANCAS}/${codigo}/cancelamento`;
}

/**
 * Lança uma cobrança com o vencimento deslocado em `dias` a partir do relógio do banco.
 *
 * **É assim que todo estado dos casos da T7 é posicionado**: o relógio nunca é falseado, o dado é que
 * se move — a mesma convenção do cabeçalho deste arquivo e da suíte da camada de dados. Deslocamento
 * negativo produz `VENCIDA` com `diasAtraso` igual ao módulo dele; positivo produz `A_VENCER`.
 *
 * A competência acompanha o vencimento (primeiro dia do mês dele), porque é o que o `refine` do
 * contrato e o `cobranca_competencia_no_primeiro_dia_chk` do banco exigem.
 */
async function lancarEm(
  contratoCodigo: string,
  dias: number,
  valorOriginal: number,
  natureza: string = 'ALUGUEL',
): Promise<CobrancaPublicada> {
  const datas = await datasEm(dias);

  return await lancar({
    contratoCodigo,
    natureza,
    referencia: REFERENCIA_DA_PARCELA,
    competencia: datas.competencia,
    dataVencimento: datas.vencimento,
    valorOriginal,
  });
}

/** Acusa o pagamento pela rota real e devolve o corpo publicado. A falha levanta. */
async function pagar(
  codigo: string,
  corpo: { readonly pagoEm: string; readonly valorPago: number },
): Promise<CobrancaPublicada> {
  const resposta = await pedir(rotaDoPagamento(codigo), { metodo: 'POST', cookie, corpo });

  if (resposta.status !== 200) {
    throw new Error(
      `o pagamento de ${codigo} respondeu ${String(resposta.status)}: ${resposta.texto}`,
    );
  }

  return resposta.corpo as CobrancaPublicada;
}

/** Cancela pela rota real e devolve o corpo publicado. A falha levanta. */
async function cancelar(codigo: string): Promise<CobrancaPublicada> {
  const resposta = await pedir(rotaDoCancelamento(codigo), { metodo: 'POST', cookie, corpo: {} });

  if (resposta.status !== 200) {
    throw new Error(
      `o cancelamento de ${codigo} respondeu ${String(resposta.status)}: ${resposta.texto}`,
    );
  }

  return resposta.corpo as CobrancaPublicada;
}

/** Lê uma cobrança pela rota real. A falha levanta — a ausência é medida pelos casos, não aqui. */
async function lerCobranca(codigo: string): Promise<CobrancaPublicada> {
  const resposta = await pedir(`${COLECAO_DE_COBRANCAS}/${codigo}`, { cookie });

  if (resposta.status !== 200) {
    throw new Error(
      `a leitura de ${codigo} respondeu ${String(resposta.status)}: ${resposta.texto}`,
    );
  }

  return resposta.corpo as CobrancaPublicada;
}

/**
 * Define a política de mora **pela rota real** de `/v1/multa-e-juros`.
 *
 * A área que ela exige foi concedida à sessão pelo caminho real de administração — ver
 * {@link AREA_DE_MULTA_E_JUROS}. Nenhuma escrita direta em `negocio.configuracao_de_mora` acontece
 * neste arquivo: montar a política por fora mediria a derivação sobre um estado que a operação não
 * produz.
 */
async function definirPolitica(multaPercentual: number, jurosPercentual: number): Promise<void> {
  const resposta = await pedir(RECURSO_DE_MULTA_E_JUROS, {
    metodo: 'PUT',
    cookie,
    corpo: { multaPercentual, jurosPercentual },
  });

  if (resposta.status !== 200) {
    throw new Error(
      `a definição da política respondeu ${String(resposta.status)}: ${resposta.texto}`,
    );
  }
}

/** Lê a política vigente pela rota real — é ela que confirma que a alteração valeu. */
async function lerPolitica(): Promise<unknown> {
  const resposta = await pedir(RECURSO_DE_MULTA_E_JUROS, { cookie });

  if (resposta.status !== 200) {
    throw new Error(
      `a leitura da política respondeu ${String(resposta.status)}: ${resposta.texto}`,
    );
  }

  return resposta.corpo;
}

/** O par sob prova no `CT-511` — o estado e o total, e nada mais. */
interface ParDeLeitura {
  readonly status: string;
  readonly valorTotal: number;
}

/** O par de uma cobrança publicada, extraído para comparação por igualdade estrita. */
function parDe(cobranca: CobrancaPublicada): ParDeLeitura {
  return { status: cobranca.status, valorTotal: cobranca.valorTotal };
}

/** O item de uma página, pelo código. A ausência levanta — o caso mediria `undefined` de outro jeito. */
function itemDe(pagina: PaginaPublicada, codigo: string): CobrancaPublicada {
  const item = pagina.itens.find((candidato) => candidato.codigo === codigo);

  if (item === undefined) {
    throw new Error(`a cobrança ${codigo} não veio na página lida`);
  }

  return item;
}

/** O sufixo numérico do código — a posição na série, que é o que o `CT-519` compara. */
function sufixoDe(codigo: string): number {
  const sufixo = codigo.split('-')[2];

  if (sufixo === undefined) {
    throw new Error(`código de cobrança fora da forma esperada: ${codigo}`);
  }

  return Number(sufixo);
}

/**
 * O `xmin` da tupla — o identificador da transação que gravou a versão corrente da linha.
 *
 * É a única leitura deste arquivo que observa coluna de sistema, e ela é **observação**, não caminho de
 * leitura de produto: o `xmin` muda a cada `UPDATE`, e é por isso que a igualdade entre duas medições
 * separa *recusado* de *aceito sem efeito visível*, e *derivado* de *materializado por gatilho*. A
 * empresa entra pelo **contexto**, como em toda leitura crua deste arquivo, e nenhum
 * `WHERE empresa_id` é escrito — quem recorta é a política (ADR-0008).
 */
async function xminDa(codigo: string): Promise<string> {
  return await contextoDeTenant.executarCom(
    { empresaId: EMPRESA_A.id },
    async () =>
      await acessoAoNegocio.emUnidadeDeTrabalho(async (tx) => {
        const [linha] = await tx<{ xmin: string }[]>`
          SELECT xmin::text AS xmin FROM negocio.cobranca WHERE codigo = ${codigo}
        `;

        if (linha === undefined) {
          throw new Error(`a cobrança ${codigo} não foi alcançada para a leitura do xmin`);
        }

        return linha.xmin;
      }),
  );
}

/** Lê a carteira pela rota real, com a cadeia de consulta informada. A falha levanta. */
async function listar(consulta: string): Promise<PaginaPublicada> {
  const resposta = await pedir(`${COLECAO_DE_COBRANCAS}?${consulta}`, { cookie });

  if (resposta.status !== 200) {
    throw new Error(
      `a leitura da carteira respondeu ${String(resposta.status)}: ${resposta.texto}`,
    );
  }

  return resposta.corpo as PaginaPublicada;
}

/** Cria um cadastro pela rota real e devolve o identificador dele. A falha levanta. */
async function criarPor(
  dono: string,
  corpo: Record<string, unknown>,
  credencial: string = cookie,
): Promise<{ id: string }> {
  const alvo = `/${PREFIXO_DE_VERSAO}/${dono}`;
  const resposta = await pedir(alvo, { metodo: 'POST', cookie: credencial, corpo });

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

/** Quantas montagens o acessório abaixo tenta antes de desistir — limite NOMEADO, nunca laço aberto. */
const MAXIMO_DE_MONTAGENS_ATE_O_CODIGO_EXCLUSIVO = 12;

/**
 * Monta pelo caminho real até obter um código que a **outra** sessão não alcança.
 *
 * A repetição não é zelo: o código legível é único **por empresa**, e não globalmente (ADR-0015). As
 * duas séries correm em paralelo, de modo que o primeiro contrato de A e o primeiro de B têm o
 * **mesmo** `CTR-{ano}-00001`. Um cruzamento montado sem esta precaução mediria outra coisa — foi o
 * que a primeira execução deste caso mostrou: o `POST` da sessão de A citando "o código do contrato
 * de B" respondeu `201`, e com razão, porque aquele código também é o de um contrato **de A**.
 *
 * A precondição é **afirmada pelo caminho real**, e não calculada a partir do sequencial: a leitura
 * por código na outra sessão tem de responder `404`. O laço tem limite nomeado e falha declarando o
 * que faltou — uma montagem que nunca convergisse aborta o caso em vez de deixá-lo passar por
 * acidente. Ele converge em poucas voltas por construção: cada montagem avança a série da empresa em
 * um, e basta ultrapassar a da outra.
 *
 * **A exclusividade tem prazo**: montar na outra empresa depois disto a traz de volta para dentro da
 * faixa, porque as duas séries são contíguas a partir de `1`. Por isso o `CT-515 (c)` monta em ordem
 * temporal, e não agrupa as montagens por conveniência de leitura.
 */
async function ateSerExclusivo<T extends { readonly codigo: string }>(
  montar: () => Promise<T>,
  colecao: string,
  outraSessao: string,
): Promise<T> {
  for (let tentativa = 0; tentativa < MAXIMO_DE_MONTAGENS_ATE_O_CODIGO_EXCLUSIVO; tentativa += 1) {
    const montado = await montar();
    const naOutraEmpresa = await pedir(`${colecao}/${montado.codigo}`, { cookie: outraSessao });

    if (naOutraEmpresa.status === 404) {
      return montado;
    }
  }

  throw new Error(
    `nenhum código exclusivo em ${colecao} após ` +
      `${String(MAXIMO_DE_MONTAGENS_ATE_O_CODIGO_EXCLUSIVO)} montagens`,
  );
}

/** A largura do sequencial da série da cobrança — **sete**, e não os cinco do contrato (RD-02). */
const LARGURA_DO_SEQUENCIAL = 7;

/**
 * O código que a série emite **logo depois** do informado.
 *
 * Composto a partir do valor OBSERVADO, e não derivado de `formatarCodigoDeCobranca`: derivá-lo da
 * mesma função que o SUT usa para compor faria a asserção do `CT-515 (d)` concordar consigo mesma. A
 * previsão só é legítima porque nada mais consome a sequência de `(empresa A, ano corrente)` durante
 * a execução — o arquivo é serial e a série é por empresa.
 */
function sucessorDe(codigo: string): string {
  const partes = codigo.split('-');
  const prefixo = partes[0];
  const ano = partes[1];
  const sequencial = partes[2];

  if (prefixo === undefined || ano === undefined || sequencial === undefined) {
    throw new Error(`código de cobrança fora da forma esperada: ${codigo}`);
  }

  const proximoNumero = String(Number(sequencial) + 1).padStart(LARGURA_DO_SEQUENCIAL, '0');

  return `${prefixo}-${ano}-${proximoNumero}`;
}

/**
 * Grava DIRETAMENTE uma cobrança com o código informado, sob o contexto da empresa A.
 *
 * É o mesmo acessório de inserção direta do `CT-515 (b)`, e existe pela mesma razão: o código é
 * **emitido pelo servidor**, e nenhum corpo de requisição consegue propor um que já exista. Sem esta
 * gravação não haveria como exercitar a quarta classe de recusa pelo caminho real — e semear a
 * sequência para trás é impossível por decisão fechada da `0010`, que não concede privilégio algum
 * sobre ela a `sysloc_app`.
 */
async function inserirCobranca(contratoCodigo: string, codigo: string): Promise<void> {
  await contextoDeTenant.executarCom({ empresaId: EMPRESA_A.id }, async () => {
    await acessoAoNegocio.emUnidadeDeTrabalho(async (tx) => {
      await tx`
        INSERT INTO negocio.cobranca (
          empresa_id, codigo, contrato_id, natureza, referencia,
          competencia, data_vencimento, valor_original
        )
        SELECT ${EMPRESA_A.id}, ${codigo}, c.id, 'ALUGUEL', ${REFERENCIA_DA_PARCELA},
               ${competenciaDoCenario}::date, ${vencimentoDoCenario}::date, ${VALOR_DA_PARCELA}
          FROM negocio.contrato c
         WHERE c.codigo = ${contratoCodigo}
      `;
    });
  });
}

/** O mesmo corpo, sem um dos campos — a recusa por campo obrigatório do `CT-515`. */
function semCampo(corpo: Record<string, unknown>, campo: string): Record<string, unknown> {
  const { [campo]: _removido, ...resto } = corpo;

  return resto;
}

/**
 * Quantas linhas de `negocio.cobranca` o contexto da empresa informada alcança.
 *
 * A contagem é **crua** e sem recorte: o que os casos medem é se alguma linha nasceu. Nenhum
 * `WHERE empresa_id` é escrito aqui — quem recorta é a política (ADR-0008) —, e a empresa entra pelo
 * **contexto**, que é o mesmo mecanismo que a aplicação usa. Ela lê a **tabela**, e não a visão: o
 * que se quer saber é se a linha física existe.
 */
async function contarCobrancas(empresaId: string): Promise<number> {
  return await contextoDeTenant.executarCom(
    { empresaId },
    async () =>
      await acessoAoNegocio.emUnidadeDeTrabalho(async (tx) => {
        const [linha] = await tx<{ total: string }[]>`
          SELECT count(*) AS total FROM negocio.cobranca
        `;

        return Number(linha?.total ?? 0);
      }),
  );
}

/**
 * O vencimento e a competência do cenário, **lidos do relógio do banco**.
 *
 * A leitura sai do mesmo `negocio.data_corrente_da_operacao()` que a visão consulta para classificar
 * o estado, de modo que a fronteira do vencimento é medida contra o próprio eixo que a decide — e
 * não contra o calendário. A projeção é feita por `to_char` no banco, e não por `Date` em
 * JavaScript: a competência e o vencimento viajam como `YYYY-MM-DD`, e construir um `Date` aqui
 * reintroduziria o deslocamento de dia por fuso que a coluna `date` existe para evitar.
 *
 * A competência é `date_trunc('month', …)` do vencimento — o primeiro dia do mês, que é o que o
 * `refine` do contrato e o `cobranca_competencia_no_primeiro_dia_chk` do banco exigem. A empresa
 * entra pelo **contexto**, como em toda leitura crua deste arquivo.
 */
async function datasDoCenario(): Promise<{ competencia: string; vencimento: string }> {
  return await datasEm(DIAS_ATE_O_VENCIMENTO);
}

/**
 * O par competência/vencimento deslocado em `dias` a partir do relógio do banco.
 *
 * Ela é a generalização de {@link datasDoCenario}, e nasceu na T7 porque as duas transições exigem
 * cobrança **VENCIDA** — deslocamento negativo — ao lado da `A_VENCER` que os casos da T5 já usavam.
 * O eixo é o mesmo, e é ele o ponto: a fronteira do vencimento é medida contra o próprio
 * `negocio.data_corrente_da_operacao()` que a visão consulta para decidir o estado, e não contra o
 * calendário.
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

/** Executa e devolve o erro levantado, ou `undefined` quando nada foi levantado. */
async function capturar(trabalho: () => Promise<unknown>): Promise<unknown> {
  try {
    await trabalho();
  } catch (erro) {
    return erro;
  }

  return undefined;
}

// ---------------------------------------------------------------------------------------------
// Corpos observados — declarados aqui, e não importados do SUT
// ---------------------------------------------------------------------------------------------

/**
 * Uma cobrança como a API a publica.
 *
 * Declarada aqui, e não importada de `@sysloc/contracts`: o conjunto de chaves é o que os casos
 * asserem por igualdade, e derivá-lo do tipo do SUT faria a asserção concordar consigo mesma. **Não
 * há `id`**, e a ausência é a ADR-0017 — a chave exposta é o `codigo`.
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
}

/** A página da carteira, no envelope que a ADR-0017 fixa. */
interface PaginaPublicada {
  readonly itens: readonly CobrancaPublicada[];
  readonly total: number;
  readonly limite: number;
  readonly deslocamento: number;
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
 * ação→tela validada pela função de domínio (`validarCoerenciaDeAjustes`) e o contador incrementado
 * na mesma transação — é o mesmo caminho que a rota do Admin usa por dentro, e o mesmo padrão de
 * `test/contratos.e2e.spec.ts`.
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
