/**
 * O contrato publicado das rotas do domínio de locação — T11 da fatia
 * `cadastro-de-imoveis-e-pessoas`, estendido pela T6, pela T7 e pela T8 da fatia
 * `contratos-de-locacao`.
 *
 * SUT_IS_CORRECT_BECAUSE: o código de produção está certo e era o título — e a tabela do `CT-327` —
 * que descreviam uma superfície de **33** rotas. A T6 da fatia `contratos-de-locacao` publicou seis
 * rotas de cadastro de contrato, e uma tabela que as ignorasse deixaria o caso passar sobre uma
 * superfície incompleta: nenhuma asserção foi afrouxada, e o que mudou foi o **inventário revisado**
 * contra o qual a igualdade profunda corre, agora afirmado em duas partições nomeadas (33 + 6).
 *
 * SUT_IS_CORRECT_BECAUSE: a T7 publicou `POST /v1/contratos/{codigo}/ativacao`, e as partições passam
 * a ser `33 + 7`. A linha nova é a primeira desta tabela a apontar para um esquema **estendido** —
 * `esquemaDaAtivacaoDeContrato`, o contrato mais `efeitos` —, e é ela que faz o documento ter de
 * descrever a declaração de efeito. Nenhuma asserção foi afrouxada e nenhuma linha anterior saiu.
 *
 * SUT_IS_CORRECT_BECAUSE: a T8 publicou `POST /v1/contratos/{codigo}/cancelamento`, e as partições
 * passam a ser `33 + 8`. A linha nova aponta para `esquemaDoContrato`, e **não** para o estendido: a
 * resposta do cancelamento não leva declaração de efeito, e é a própria escolha da rota que a tabela
 * afirma aqui. Nenhuma asserção foi afrouxada e nenhuma linha anterior saiu.
 *
 * ===========================================================================
 * INVARIANTES
 * ===========================================================================
 *
 * | Critério | Caso   | Invariante |
 * |---|---|---|
 * | CA-16 | CT-322 | Em cada uma das **12** rotas de escrita, um corpo válido acrescido de uma chave
 * |       |        | que nenhum esquema declara é recusado com `422 CAMPO_INVALIDO` nomeando o corpo,
 * |       |        | e **nada é gravado** — a contagem da entidade não muda pela tentativa recusada.
 * |       |        | O MESMO corpo sem a chave extra é aceito. (ADR-0017) |
 * | CA-16 | CT-324 | O mesmo recurso é alcançado com o identificador em minúsculas, em MAIÚSCULAS e
 * |       |        | em caixa mista: as três respostas são profundamente iguais, e o `id` do corpo
 * |       |        | vem em minúsculas nas três. Identificador que não é UUID é recusado com
 * |       |        | `422 CAMPO_INVALIDO` nomeando o parâmetro, e a contagem da tabela não muda. |
 * | CA-16 | CT-327 | Para **cada uma** das 48 rotas, o esquema de resposta que o documento publicado
 * |       |        | descreve é **profundamente igual** ao derivado do esquema de `@sysloc/contracts`
 * |       |        | que a rota usa — nenhuma descrição escrita à mão em paralelo. Acrescentar um
 * |       |        | campo obrigatório ao esquema muda a descrição derivada, e a comparação passa a
 * |       |        | reprovar. (ADR-0016) |
 * | CA-16 | CT-328 | Em toda leitura das seis entidades — item, listagem e carteira expandida —,
 * |       |        | metragem, metragem total, posição, total e janela chegam como `number`; tipo de
 * |       |        | imóvel, situação de locação e tipo de pessoa chegam como um dos valores da
 * |       |        | lista fechada; e a marca de retirada é nula ou cadeia ISO-8601. Nenhum campo
 * |       |        | numérico chega como texto. |
 *
 * | CA-07 | CT-945 | `GET /v1/cobrancas/{codigo}/boleto` **consta** do documento publicado — e o caso
 * | CA-09 |        | reprova nomeando o caminho se ela desaparecer (ADR-0028) —, declara
 * |       |        | `application/pdf` como **único** tipo de mídia do sucesso e o **nome sugerido**
 * |       |        | do arquivo em `content-disposition`, **não** declara forma do corpo de sucesso
 * |       |        | (o esquema é exatamente `{ type: 'string', format: 'binary' }`), e os códigos de
 * |       |        | erro que ela publica, status a status, pertencem ao **enum fechado de oito** da
 * |       |        | ADR-0017. |
 *
 * Rastreabilidade: `CA-16 → CT-322 (RN-13)`, `CA-16 → CT-324 (RN-13)`, `CA-16 → CT-327 (RN-16)`,
 * `CA-16 → CT-328 (RN-16)`.
 * Acrescida pela T17 da fatia `emissao-e-conciliacao`: `CA-07 → CT-945 (RN-16)`,
 * `CA-09 → CT-945 (RN-16)`.
 *
 * ⚠️ **O `CT-945` NÃO entra na tabela do `CT-327`, e a ausência não é omissão**: aquela tabela
 * compara corpo **derivado de esquema**, e esta rota devolve bytes — não há `esquemaPublicado` com
 * que comparar. `ROTAS_DESCRITAS` não a conta por essa razão, e o `CT-945` é justamente a
 * prova que a ADR-0028 exige no lugar da comparação que não existe.
 *
 * ===========================================================================
 * Por que estes quatro casos moram no MESMO arquivo
 * ===========================================================================
 *
 * Os quatro medem a mesma coisa por quatro ângulos: **o que a borda promete e o que ela entrega**. O
 * `CT-327` compara a promessa publicada com o esquema que confere a entrada; o `CT-328` compara o
 * que chega ao consumidor com o tipo que aquele mesmo esquema declara; o `CT-322` e o `CT-324` medem
 * as duas fronteiras de entrada que o contrato fecha — a chave desconhecida no corpo e a forma do
 * identificador na rota. Separá-los custaria mais três instâncias efêmeras de Postgres e de Redis
 * para observar a mesma superfície.
 *
 * ===========================================================================
 * O CT-327 e a ADR-0016 — o que a comparação prova, e o que o MUTANTE prova
 * ===========================================================================
 *
 * A ADR-0016 é literal: *"o esquema declarado no pacote de contratos é a fonte única… Nenhuma
 * descrição de contrato é escrita à mão em paralelo ao esquema"*. As duas metades da prova:
 *
 *   1. **A comparação** (permanente, neste caso): para as 48 rotas, o esquema que o documento
 *      publica é profundamente igual ao que `esquemaPublicado(<esquema de @sysloc/contracts>)`
 *      produz. Uma descrição escrita à mão precisaria coincidir byte a byte com a saída de
 *      `z.toJSONSchema` — inclusive os padrões de UUID e de data — para passar aqui;
 *   2. **A sensibilidade** (permanente, na segunda metade do caso): o MESMO esquema com **um** campo
 *      obrigatório a mais produz uma descrição diferente, e a comparação do passo 1 reprovaria
 *      contra ela. É o que impede o caso de passar por vacuidade sobre uma comparação frouxa;
 *   3. **Os dois mutantes** (medidos — ver abaixo): um reintroduz a descrição escrita à mão e o
 *      outro mexe no esquema. Eles têm de dar resultados **opostos**, e é o par que prova a
 *      derivação — nenhum dos dois sozinho a prova.
 *
 * ---------------------------------------------------------------------------
 * MUTANTES EXECUTADOS — MT11-2 e MT11-3 (2026-08-06)
 * ---------------------------------------------------------------------------
 *
 * Os dois foram invocados pelo **script do pacote consumidor** (`pnpm --filter @sysloc/api test`),
 * nunca por `vitest run` avulso: `apps/api` alcança `@sysloc/contracts` pela fronteira do pacote e
 * leria o `dist/` da compilação anterior.
 *
 *   * **controle** — árvore íntegra: `129 passed`, os `4` deste arquivo entre eles;
 *   * **MT11-2 · a descrição volta a ser escrita à mão** — em
 *     `apps/api/src/imoveis/conjunto.controller.ts`, o `schema` do `@ApiOkResponse` de `GET :id`
 *     trocado de `esquemaPublicado(esquemaDoConjunto, 'output')` por um objeto literal plausível
 *     (`{ type: 'object', properties: { id, nome, retiradoEm }, required: […] }`): `1 failed | 128
 *     passed`, no `CT-327`, com a mensagem nomeando a rota — *"GET /v1/conjuntos/{id} descreve algo
 *     que o esquema não produz"*. É **o defeito literal que a ADR-0016 existe para impedir**, e o
 *     caso o acusa apontando qual rota divergiu (a superfície era de 33 rotas quando esta medição
 *     foi feita; hoje são 41, e a âncora `ROTAS_DESCRITAS` é quem carrega o número);
 *   * **MT11-3 · o esquema ganha um campo** — em `packages/contracts/src/conjunto.ts`,
 *     `esquemaDoConjunto` acrescido de `campoDerivadoDoMutante: z.string().optional()`:
 *     `129 passed`, **verde**. E o verde é a prova, não a ausência dela: o valor esperado do
 *     `CT-327` passou a conter o campo novo, de modo que a igualdade profunda **só** pode ter
 *     passado porque o documento publicado o ganhou também — sem que uma linha de descrição fosse
 *     editada. Um documento escrito à mão teria ficado para trás e reprovado, que é exatamente o
 *     que o `MT11-2` mostra acontecer;
 *   * **por que o campo é opcional, e não obrigatório** — obrigatório muda `z.infer`, e o tipo
 *     `Conjunto` passa a exigir o campo de todo produtor: a compilação cai antes de a suíte rodar, e
 *     o mutante fica **inconclusivo**. Opcional entra em `properties` sem entrar em `required`, que
 *     é mudança suficiente para a igualdade profunda deste caso detectar;
 *   * **reversão** — os dois fontes foram restaurados e conferidos por `git diff` vazio, e o
 *     controle voltou a `129 passed`.
 *
 * As âncoras destes registros são **simbólicas** — `esquemaDoConjunto` em
 * `packages/contracts/src/conjunto.ts`, e o `@ApiOkResponse` do `GET :id` em
 * `apps/api/src/imoveis/conjunto.controller.ts` —, e nunca número de linha.
 *
 * ===========================================================================
 * Precondição privilegiada — tudo pelo caminho REAL
 * ===========================================================================
 *
 * A sessão sai da rota pública de entrada, e a matriz do perfil `ADMIN_EMPRESA` é o catálogo inteiro
 * — nenhum ajuste individual precisa ser escrito, e o efetivo é AFIRMADO por `GET /v1/sessao` antes
 * do primeiro fluxo. Os registros são criados **pelas rotas**, com todos os campos opcionais
 * preenchidos, para que nenhum campo escape da varredura do `CT-328` por estar nulo. O documento é
 * pedido pela rota que a aplicação já publica (`/docs/json`, hoje sem sessão por decisão registrada
 * no débito `D24`); **nenhuma função de produção foi acrescentada para "expor os esquemas ao
 * teste"** — a derivação é observada pelo artefato real (Iron Law #6).
 *
 * ===========================================================================
 * De onde vêm o banco, a fila e a credencial (ADR-0006)
 * ===========================================================================
 *
 * De instâncias efêmeras próprias; nenhuma coordenada de conexão é lida do ambiente. A porta é
 * **reservada** (trava atômica), e não dinâmica, pela razão que a T8 da fatia anterior registrou.
 */

import { randomBytes } from 'node:crypto';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import {
  envelopeDeLista,
  esquemaDaAtivacaoDeContrato,
  esquemaDaPessoa,
  esquemaDoCertificado,
  esquemaDoConjunto,
  esquemaDoConjuntoComImoveis,
  esquemaDoContrato,
  esquemaDoDesfechoDoRegistroDeCertificado,
  esquemaDoEstadoDaEntrega,
  esquemaDoImovel,
  esquemaDoLocatario,
  esquemaDoReenvioDeConfirmacao,
  esquemaDoResultadoDaVerificacao,
  SITUACOES_DE_LOCACAO,
  TIPOS_DE_IMOVEL,
  TIPOS_DE_PESSOA,
} from '@sysloc/contracts';
import { SENHA_DA_CARGA } from '@sysloc/db';
import { CodigoErro } from '@sysloc/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod';
// DÉBITO COM GATILHO — D28 · F0/T5 · gatilho JÁ DISPARADO (F1/T2, 2026-08-02)
// (NÃO é uma `DECISÃO FECHADA`: ele agenda uma mudança, não protege o código abaixo.)
// O QUÊ: os imports a seguir atravessam a fronteira de `@sysloc/shared` e de `@sysloc/auth` por
//        CAMINHO DE ARQUIVO, fora do `exports` e do `files` daqueles manifestos.
// QUANDO FECHA: o gatilho já disparou e o fechamento segue pendente; ele é o mesmo de sempre —
//        declarar o subpath `"./test"` nos manifestos, ou extrair um `@sysloc/test-utils`.
// POR QUE NÃO AGORA: fechar exige editar os manifestos de dois pacotes e todos os consumidores,
//        nenhum deles no escopo desta task.
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
import { CAMINHO_DOS_FIADORES } from '../src/cadastros/fiador.controller.ts';
import { CAMINHO_DOS_LOCADORES } from '../src/cadastros/locador.controller.ts';
import { CAMINHO_DOS_LOCATARIOS } from '../src/cadastros/locatario.controller.ts';
import { CAMINHO_DAS_COBRANCAS } from '../src/cobrancas/cobranca.controller.ts';
import { esquemaPublicado } from '../src/comum/esquema-publicado.ts';
import { ENDERECO_DE_ESCUTA, PREFIXO_DE_VERSAO } from '../src/configuracao/ambiente.ts';
import { CAMINHO_DOS_CONTRATOS } from '../src/contratos/contrato.controller.ts';
import { CAMINHO_DOS_CONJUNTOS } from '../src/imoveis/conjunto.controller.ts';
import { CAMINHO_DOS_IMOVEIS } from '../src/imoveis/imovel.controller.ts';
import {
  CAMINHO_DAS_INTEGRACOES_BANCARIAS,
  SEGMENTO_DA_CONSULTA,
  SEGMENTO_DA_VERIFICACAO,
  SEGMENTO_DO_REGISTRO,
} from '../src/integracoes-bancarias/certificado.controller.ts';
import {
  SEGMENTO_DA_ATIVACAO,
  SEGMENTO_DA_ENTREGA_DA_NOTICIA,
} from '../src/integracoes-bancarias/entrega-da-noticia.controller.ts';
import { CAMINHO_DO_DOCUMENTO, criarAplicacao } from '../src/main.ts';
import { cpfValido } from './documento.ts';

/** Limite da montagem: banco migrado, semente, fila, aplicação e o arranjo dos registros. */
const LIMITE_DE_MONTAGEM_MS = 240_000;

/** Limite de um caso que atravessa HTTP dezenas de vezes. */
const LIMITE_CASO_MS = 120_000;

/** Sufixo do nome do cookie de sessão do arcabouço — o prefixo vem da configuração. */
const SUFIXO_DO_COOKIE_DE_SESSAO = 'session_token';

/** A rota pública de entrada do arcabouço de identidade. */
const ROTA_DE_ENTRADA = `${PREFIXO_DAS_ROTAS_DE_IDENTIDADE}/sign-in/email`;

/** A rota que publica o efetivo da sessão corrente. */
const CAMINHO_DA_SESSAO_CORRENTE = `/${PREFIXO_DE_VERSAO}/${CAMINHO_DA_SESSAO}`;

/** As mensagens canônicas — literais, e não importadas do SUT. */
const MENSAGEM_DE_CAMPO_INVALIDO = 'requisição inválida';

/** O nome de campo que a borda publica quando a recusa é do corpo e o Zod não tem caminho. */
const CAMPO_DO_CORPO = 'corpo';

/** O nome de campo que a borda publica quando a recusa é do identificador de rota. */
const CAMPO_DO_IDENTIFICADOR = 'id';

/** A chave que nenhum esquema declara — o vetor do `CT-322`. */
const CHAVE_EXTRA = 'campoQueNinguemDeclarou';

/** Quantas rotas a fatia `cadastro-de-imoveis-e-pessoas` publica. */
const ROTAS_DA_FATIA = 33;

/**
 * Quantas rotas a fatia `contratos-de-locacao` publica sob `/v1/contratos` até aqui (T7).
 *
 * SUT_IS_CORRECT_BECAUSE: o código de produção está certo e era esta partição que descrevia a
 * superfície de uma task só. A T7 publicou `POST /:codigo/ativacao`, e a partição existe justamente
 * para que o total não esconda a troca — deixá-la em `6` faria o `CT-327` reprovar sobre uma tabela
 * legítima, ou (pior) passar sobre uma incompleta se alguém "corrigisse" o total sozinho.
 *
 * SUT_IS_CORRECT_BECAUSE: a T8 publicou `POST /:codigo/cancelamento`, e a partição sobe pela mesma
 * razão do parágrafo acima — ela existe justamente para que o total não esconda a troca.
 *
 * São **oito**, e com elas a superfície de `/v1/contratos` está completa nesta fatia: a única rota
 * que ainda falta é a de situação de locação do imóvel (T10), e ela **não** entra nesta partição,
 * porque vive sob `/v1/imoveis`.
 */
const ROTAS_DE_CONTRATO = 8;

/**
 * Quantas rotas a fatia `contratos-de-locacao` publica **fora** de `/v1/contratos` — a de situação de
 * locação do imóvel (T10), e só ela.
 *
 * SUT_IS_CORRECT_BECAUSE: o código de produção está certo e era a partição em **duas** metades que
 * descrevia uma superfície em que toda rota nova da fatia caía sob `/v1/contratos`. A T10 publicou
 * `POST /v1/imoveis/{id}/situacao-de-locacao`, que é da fatia de contratos e vive sob `/v1/imoveis` —
 * sem esta terceira partição, ela seria contada como rota da fatia **anterior** e a igualdade
 * `tabela - contrato === 33` reprovaria sobre uma tabela legítima. A partição por prefixo de caminho
 * deixaria de descrever a fatia, e é a fatia que estas âncoras existem para separar. **Nenhuma
 * asserção foi afrouxada**: as três partições continuam sendo igualdades exatas, e a nova é nomeada
 * em vez de somada ao total.
 */
const ROTAS_DE_SITUACAO_DE_LOCACAO = 1;

/**
 * Quantas rotas o domínio publica hoje — a âncora do `CT-327` contra tabela truncada.
 *
 * SUT_IS_CORRECT_BECAUSE: o código de produção está certo e a âncora é que descrevia uma superfície
 * de uma fatia só. A T6 da fatia `contratos-de-locacao` acrescentou seis rotas ao domínio, e a tabela
 * do `CT-327` tem de cobrir a superfície **inteira** — deixá-la em `33` faria o caso passar sobre uma
 * tabela que ignora as rotas novas, que é exatamente o modo de falha silencioso que a âncora existe
 * para fechar. O valor é escrito à mão e revisado, e o total anterior continua nomeado ao lado dele.
 *
 * SUT_IS_CORRECT_BECAUSE: a T7 da mesma fatia acrescentou **uma** rota (39 → 40), a ativação, pela
 * mesma razão do parágrafo acima. O valor é `33 + 7`, e as duas partições continuam afirmadas
 * separadamente no `CT-327` — é essa separação que impede o total de esconder "uma entrou e uma da
 * fatia anterior saiu".
 *
 * SUT_IS_CORRECT_BECAUSE: a T8 da mesma fatia acrescentou **uma** rota (40 → 41), o cancelamento,
 * pela mesma razão dos parágrafos acima. O valor é `33 + 8`, e as duas partições continuam afirmadas
 * separadamente.
 *
 * SUT_IS_CORRECT_BECAUSE: a T10 da mesma fatia acrescentou **uma** rota (41 → 42), a situação de
 * locação do imóvel, pela mesma razão dos parágrafos acima. O valor é `33 + 8 + 1`, e as **três**
 * partições passam a ser afirmadas separadamente — ver {@link ROTAS_DE_SITUACAO_DE_LOCACAO} para por
 * que a terceira precisou nascer. Com ela, a superfície de domínio desta fatia está completa.
 *
 * SUT_IS_CORRECT_BECAUSE: a **T9** da fatia `documentos-e-confirmacao` acrescentou **uma** rota
 * (42 → 43), o reenvio da confirmação de e-mail, pela mesma razão dos parágrafos acima — deixar a
 * âncora em `42` faria o caso passar sobre uma tabela que ignora a rota nova. O valor é
 * `33 + 8 + 1 + 1`, e as **quatro** partições passam a ser afirmadas separadamente; ver
 * {@link ROTAS_DA_CONFIRMACAO} para por que a quarta precisou nascer.
 *
 * ⚠️ A rota do **documento do contrato** (T7 da mesma fatia) **não** entra nesta tabela, e a ausência
 * não é omissão: ela devolve **bytes** (`application/pdf`), e não um corpo derivado de esquema — não
 * há `esquemaPublicado` com que comparar. Quem prova o contrato dela é `documento-do-contrato.e2e.spec.ts`.
 *
 * SUT_IS_CORRECT_BECAUSE: a fatia `fundacao-bancaria` acrescentou **três** rotas (43 → 46) — o
 * registro e a consulta do certificado do provedor (T11) e a verificação da identidade (T12) —, e as
 * três publicam corpo derivado de `@sysloc/contracts` por `esquemaPublicado` (ADR-0016). Deixar a
 * âncora em `43` faria o `CT-327` passar sobre uma tabela que ignora as rotas novas, que é exatamente
 * o modo de falha silencioso que ela existe para fechar. O valor é `33 + 8 + 1 + 1 + 3`, e as
 * **cinco** partições passam a ser afirmadas separadamente — ver
 * {@link ROTAS_DA_FUNDACAO_BANCARIA}. Nenhuma linha anterior saiu, e nenhuma asserção foi afrouxada.
 */
/**
 * SUT_IS_CORRECT_BECAUSE: a **T7** da fatia `integracao-bancaria-autonoma` acrescentou **duas** rotas
 * (46 → 48) — a ativação e a consulta da **entrega da notícia** —, e as duas publicam corpo derivado
 * de `@sysloc/contracts` por `esquemaPublicado` (ADR-0016), do **mesmo** `esquemaDoEstadoDaEntrega`.
 * Deixar a âncora em `46` faria o `CT-327` passar sobre uma tabela que ignora as rotas novas, que é
 * exatamente o modo de falha silencioso que ela existe para fechar. O valor é `33 + 8 + 1 + 1 + 3 + 2`,
 * e as **seis** partições passam a ser afirmadas separadamente — ver
 * {@link ROTAS_DA_ENTREGA_DA_NOTICIA} para por que a sexta precisou nascer. Nenhuma linha anterior
 * saiu, e nenhuma asserção foi afrouxada. **Esta é a última fatia que acrescenta rota antes do
 * congelamento da superfície.**
 */
const ROTAS_DESCRITAS = 48;

/**
 * Quantas rotas a fatia `fundacao-bancaria` publica com corpo derivado de esquema — as **três**.
 *
 * Ela nasce como **quinta partição** pela mesma razão das duas anteriores, com uma diferença que vale
 * dizer: as três vivem sob um prefixo **próprio** (`/v1/integracoes-bancarias`), de modo que o filtro
 * é pelo **prefixo** e não pelo sufixo — não há aqui a confusão com as trinta e três da fatia de
 * cadastro que obrigou a terceira e a quarta a filtrarem pelo fim do caminho. Nomeada, ela responde
 * pelo próprio crescimento, e a subtração continua provando que nenhuma linha das partições
 * anteriores saiu.
 */
const ROTAS_DA_FUNDACAO_BANCARIA = 3;

/**
 * Quantas rotas a T7 da fatia `integracao-bancaria-autonoma` publica com corpo derivado de esquema —
 * as **duas** da entrega da notícia.
 *
 * Ela nasce como **sexta partição** pela mesma razão das anteriores: cada fatia responde pelo próprio
 * crescimento, e ampliar {@link ROTAS_DA_FUNDACAO_BANCARIA} de três para cinco apagaria o retrato de
 * uma fatia fechada para acomodar trabalho de outra época.
 *
 * ⚠️ **Ela é filtrada pelo SUFIXO, e não pelo prefixo**, apesar de viver sob
 * `/v1/integracoes-bancarias`: é justamente o prefixo que a confundiria com as três da
 * `fundacao-bancaria` — o mesmo motivo que obrigou a terceira e a quarta partições a filtrarem pelo
 * fim do caminho. Os dois caminhos terminam em `/entrega-da-noticia` e `/entrega-da-noticia/ativacao`,
 * e o filtro casa o segmento do recurso em qualquer das duas posições.
 */
const ROTAS_DA_ENTREGA_DA_NOTICIA = 2;

/**
 * Quantas rotas a fatia `documentos-e-confirmacao` publica com corpo derivado de esquema — hoje
 * **uma**, o reenvio da confirmação.
 *
 * Ela nasce como **quarta partição** pela mesma razão que a terceira nasceu: a rota vive sob
 * `/v1/locatarios`, e o prefixo a confundiria com as trinta e três da fatia de cadastro. Filtrada
 * pelo **sufixo** do caminho, ela responde pelo próprio crescimento, e a subtração continua provando
 * que nenhuma linha das partições anteriores saiu.
 */
const ROTAS_DA_CONFIRMACAO = 1;

/**
 * Quantas rotas de escrita a fatia `cadastro-de-imoveis-e-pessoas` publica: `POST` e `PUT` das seis
 * entidades dela.
 *
 * A fatia é **nomeada**, e o número não cresce com as rotas de contrato: quem ele ancora é a tabela
 * `rotasDeEscrita`, montada sobre o cenário daquelas seis entidades. Sem o nome da fatia, o `12`
 * pareceria descrever a superfície inteira e convidaria a próxima task a "corrigi-lo" para cima,
 * afrouxando a âncora em vez de acrescentar a tabela que falta.
 */
const ROTAS_DE_ESCRITA = 12;

/**
 * O caminho da rota de **bytes** como o documento OpenAPI o escreve — com `{codigo}`, e não
 * `:codigo`.
 *
 * Composto do dono do segmento (`CAMINHO_DAS_COBRANCAS`), e não escrito como cadeia crua: um
 * segmento que mudasse no controlador sem passar por esta linha faria o caso procurar um caminho que
 * a aplicação não publica — e reprovar dizendo *"a rota sumiu do documento"* quando ela só mudou de
 * nome, que é nomear o defeito errado.
 */
const CAMINHO_DO_BOLETO_NO_DOCUMENTO = `/${PREFIXO_DE_VERSAO}/${CAMINHO_DAS_COBRANCAS}/{codigo}/boleto`;

/** O tipo de mídia que a rota de bytes declara — literal, e nunca lido do controlador. */
const TIPO_DE_MIDIA_DO_BOLETO = 'application/pdf';

/** O status da única resposta de sucesso com conteúdo — `200`, e não o `201` de criação. */
const STATUS_DE_SUCESSO_DO_BOLETO = '200';

/** O cabeçalho por onde o nome sugerido do arquivo é publicado. */
const CABECALHO_DA_DISPOSICAO = 'content-disposition';

/**
 * A forma do nome sugerido, tal como o documento a descreve.
 *
 * Literal, e **não** importada do controlador: é o que o consumidor lê no documento publicado, e
 * derivá-la da constante que a produz faria a asserção concordar consigo mesma.
 */
const DISPOSICAO_DECLARADA_NO_DOCUMENTO = 'attachment; filename="COB-2026-0000001.pdf"';

/**
 * Os códigos de erro que a rota de bytes declara, status a status — escritos à mão.
 *
 * Eles são **contrato**: é o que o cliente do documento programa para tratar. Derivá-los dos
 * decoradores do controlador faria a asserção concordar com o SUT, e trocar um código lá deixaria de
 * reprovar caso algum. Cada um pertence ao enum fechado da ADR-0017, e a asserção que prova essa
 * pertinência é separada desta — as duas são direções diferentes.
 */
const CODIGOS_DE_ERRO_DA_ROTA_DE_BYTES: Readonly<Record<string, readonly string[]>> = {
  '401': [CodigoErro.NAO_AUTENTICADO],
  '403': [CodigoErro.ACESSO_NEGADO],
  '404': [CodigoErro.RECURSO_NAO_ENCONTRADO],
  '422': [CodigoErro.CAMPO_INVALIDO],
  '503': [CodigoErro.SERVICO_INDISPONIVEL],
};

/**
 * Quantos códigos o enum fechado da ADR-0017 tem — **onze**.
 *
 * Escrito à mão ao lado da leitura do enum, e é o par que discrimina: sem ele, a varredura de
 * pertinência abaixo aprovaria um código novo pelo simples fato de alguém o ter acrescentado ao
 * `CodigoErro`. Acrescentar código é decisão de contrato com efeito no handoff, e **reprova aqui até
 * que a decisão apareça nesta linha** — que é exatamente o papel dela.
 *
 * SUT_IS_CORRECT_BECAUSE: subiu de 8 para 11 porque a T2 da fatia `integracao-bancaria-autonoma`
 * acrescentou **três** códigos ao enum, um por causa de recusa do registro do certificado
 * (`MATERIAL_EM_FORMATO_NAO_SUPORTADO`, `SENHA_DO_MATERIAL_NAO_ABRE` e
 * `CERTIFICADO_COM_VALIDADE_ENCERRADA`) — decisão de contrato aprovada no PRD da fatia (D4), que
 * paga o `D64` tornando as três causas discrimináveis pelo `codigo`. A âncora **sobe**, nunca
 * afrouxa: continua sendo comparação exata, e um código que suma do enum segue reprovando aqui.
 * ⚠️ A frase anterior — *"e ele não cresce"* — saiu porque deixou de ser verdade: o enum cresce por
 * decisão declarada, e é esta linha que obriga a decisão a aparecer.
 */
const CODIGOS_DO_ENUM_FECHADO = 11;

/** A pessoa que age: Admin da empresa A, cuja matriz do perfil é o catálogo inteiro. */
const QUEM_AGE = pessoaSemeada('admin.a@exemplo.com.br');

/** As duas áreas de tela que governam a superfície nova, e a ação sensível da circulação. */
const AREA_DOS_IMOVEIS = 'TELA:imoveis';
const AREA_DOS_CADASTROS = 'TELA:cadastros';
const ACAO_SENSIVEL = 'ACAO:excluir_cadastro';

/** O padrão de um UUID já canonizado — minúsculas, e nada mais. */
const UUID_CANONICO = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u;

/** O padrão de uma marca de retirada em ISO-8601 — o formato que a ADR-0017 fixa. */
const MARCA_ISO = /^\d{4}-\d{2}-\d{2}T/u;

let identidade: IdentidadeEfemera;
let fila: FilaEfemera;
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

beforeAll(async () => {
  identidade = await identidadeEfemera();
  fila = await redisEfemero();

  ambienteAnterior = { ...process.env };
  process.env.NODE_ENV = 'test';
  process.env.LOG_LEVEL = 'fatal';
  process.env.DATABASE_URL = identidade.banco.cadeiaConexao;
  process.env.REDIS_URL = fila.cadeiaConexao;
  process.env.BETTER_AUTH_SECRET = randomBytes(32).toString('base64url');

  const porta = await reservarPorta();
  base = `http://${ENDERECO_DE_ESCUTA}:${String(porta)}`;
  process.env.PORT = String(porta);

  // A aplicação de PRODUÇÃO, montada por `criarAplicacao()` e não remontada aqui: um documento
  // obtido de uma remontagem descreveria uma aplicação que ninguém sobe.
  aplicacao = await criarAplicacao();
  await aplicacao.listen({ port: porta, host: ENDERECO_DE_ESCUTA });

  cookie = await entrar(QUEM_AGE.email, SENHA_DA_CARGA);

  // Precondição AFIRMADA, e não suposta: a matriz do perfil `ADMIN_EMPRESA` é o catálogo inteiro, e
  // sem esta conferência um `403` em qualquer rota abaixo seria indistinguível de defeito dela.
  const sessao = (await ler(CAMINHO_DA_SESSAO_CORRENTE)) as {
    telas: readonly string[];
    acoes: readonly string[];
  };
  expect(sessao.telas).toContain(AREA_DOS_IMOVEIS);
  expect(sessao.telas).toContain(AREA_DOS_CADASTROS);
  expect(sessao.acoes).toContain(ACAO_SENSIVEL);
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

describe('o contrato publicado das 48 rotas do domínio (T11)', () => {
  it(
    'CT-327 — o documento publicado é DERIVADO dos esquemas que validam a entrada',
    async () => {
      const documento = await documentoPublicado();
      const tabela = ESQUEMAS_POR_ROTA;

      // A tabela cobre a superfície inteira — afirmado antes de percorrê-la.
      expect(tabela.length).toBe(ROTAS_DESCRITAS);

      // E ela cobre as DUAS partições, cada uma pelo próprio tamanho: o total sozinho não distingue
      // "seis rotas de contrato entraram" de "seis entraram e seis da fatia anterior saíram".
      const doContrato = tabela.filter((rota) =>
        rota.caminho.startsWith(caminhoDoDocumento(CAMINHO_DOS_CONTRATOS)),
      );
      expect(doContrato.length).toBe(ROTAS_DE_CONTRATO);

      // A TERCEIRA partição: a rota da fatia de contratos que vive sob `/v1/imoveis`. Ela é filtrada
      // pelo sufixo do caminho, e não pelo prefixo, porque é justamente o prefixo que a confundiria
      // com as rotas da fatia anterior — ver {@link ROTAS_DE_SITUACAO_DE_LOCACAO}.
      const daSituacaoDeLocacao = tabela.filter((rota) =>
        rota.caminho.endsWith('/situacao-de-locacao'),
      );
      expect(daSituacaoDeLocacao.length).toBe(ROTAS_DE_SITUACAO_DE_LOCACAO);

      // A QUARTA partição: a rota da fatia `documentos-e-confirmacao` que vive sob `/v1/locatarios`.
      // Pelo sufixo, e não pelo prefixo, pela mesma razão da terceira — ver
      // {@link ROTAS_DA_CONFIRMACAO}.
      const daConfirmacao = tabela.filter((rota) => rota.caminho.endsWith('/confirmacao-de-email'));
      expect(daConfirmacao.length).toBe(ROTAS_DA_CONFIRMACAO);

      // A QUINTA partição: as três rotas da fatia `fundacao-bancaria`. Pelo PREFIXO, porque elas
      // vivem sob um caminho próprio — ver {@link ROTAS_DA_FUNDACAO_BANCARIA}.
      //
      // ⚠️ A SEXTA partição vive sob o MESMO prefixo, e por isso ela é **subtraída** aqui em vez de o
      // filtro ser reescrito: `ROTAS_DA_FUNDACAO_BANCARIA` continua valendo `3`, que é o retrato
      // daquela fatia, e o crescimento desta task é afirmado por si logo abaixo.
      const daEntregaDaNoticia = tabela.filter((rota) =>
        rota.caminho.includes(`/${SEGMENTO_DA_ENTREGA_DA_NOTICIA}`),
      );
      expect(daEntregaDaNoticia.length).toBe(ROTAS_DA_ENTREGA_DA_NOTICIA);

      const daFundacaoBancaria = tabela.filter(
        (rota) =>
          rota.caminho.startsWith(caminhoDoDocumento(CAMINHO_DAS_INTEGRACOES_BANCARIAS)) &&
          !rota.caminho.includes(`/${SEGMENTO_DA_ENTREGA_DA_NOTICIA}`),
      );
      expect(daFundacaoBancaria.length).toBe(ROTAS_DA_FUNDACAO_BANCARIA);

      expect(
        tabela.length -
          doContrato.length -
          daSituacaoDeLocacao.length -
          daConfirmacao.length -
          daFundacaoBancaria.length -
          daEntregaDaNoticia.length,
      ).toBe(ROTAS_DA_FATIA);

      const conferidas: string[] = [];
      for (const rota of tabela) {
        const publicado = esquemaDaResposta(documento, rota.caminho, rota.metodo);
        const derivado = esquemaPublicado(rota.esquema, 'output');

        // Igualdade PROFUNDA contra o derivado. Uma descrição escrita à mão teria de coincidir byte
        // a byte com a saída de `z.toJSONSchema` — inclusive os padrões de UUID e de data-hora —
        // para chegar aqui, e é isso que torna esta asserção uma prova de derivação.
        expect(
          publicado,
          `${rota.metodo.toUpperCase()} ${rota.caminho} descreve algo que o esquema não produz`,
        ).toEqual(derivado);

        conferidas.push(`${rota.metodo.toUpperCase()} ${rota.caminho}`);
      }
      expect(conferidas.length).toBe(ROTAS_DESCRITAS);

      // --- SENSIBILIDADE: o mesmo esquema com UM campo obrigatório a mais ----------------------
      // Sem esta metade, a comparação acima passaria por vacuidade sobre uma igualdade frouxa. Aqui
      // a MESMA função de derivação recebe o esquema mutado, e o resultado é DIFERENTE do que o
      // documento publica — de modo que, se alguém acrescentasse o campo ao esquema e o documento
      // não acompanhasse, a comparação acima reprovaria. É a perna que o mutante `MT11-2` mediu
      // sobre o fonte, permanente na suíte.
      const CAMPO_DO_MUTANTE = 'campoDerivadoDoMutante';
      const mutado = esquemaPublicado(
        esquemaDoConjunto.extend({ [CAMPO_DO_MUTANTE]: z.string() }),
        'output',
      );
      const doConjunto = esquemaDaResposta(
        documento,
        `/${PREFIXO_DE_VERSAO}/${CAMINHO_DOS_CONJUNTOS}/{id}`,
        'get',
      );

      expect(mutado).not.toEqual(doConjunto);
      expect((mutado as { required: readonly string[] }).required).toContain(CAMPO_DO_MUTANTE);
      // E o campo do mutante NÃO está no documento de hoje: sem esta linha, um documento que já
      // trouxesse o campo tornaria a desigualdade acima verdadeira por outro motivo.
      expect((doConjunto as { required: readonly string[] }).required).not.toContain(
        CAMPO_DO_MUTANTE,
      );
    },
    LIMITE_CASO_MS,
  );

  it(
    'CT-328 — nenhum campo exige conversão de tipo pelo consumidor, em nenhuma das leituras',
    async () => {
      const cenario = await montarCenarioCompleto();

      // As três formas de leitura de cada entidade: item, listagem e carteira expandida.
      const leituras: readonly Leitura[] = [
        { rotulo: 'conjunto (item)', corpo: cenario.conjunto },
        { rotulo: 'imovel (item)', corpo: cenario.imovel },
        { rotulo: 'imovel retirado (item)', corpo: cenario.imovelRetirado },
        { rotulo: 'locador (item)', corpo: cenario.locador },
        { rotulo: 'locatario (item)', corpo: cenario.locatario },
        { rotulo: 'fiador (item)', corpo: cenario.fiador },
        { rotulo: 'conjuntos (lista)', corpo: await ler(colecao(CAMINHO_DOS_CONJUNTOS)) },
        { rotulo: 'imoveis (lista)', corpo: await ler(colecao(CAMINHO_DOS_IMOVEIS)) },
        { rotulo: 'locadores (lista)', corpo: await ler(colecao(CAMINHO_DOS_LOCADORES)) },
        { rotulo: 'locatarios (lista)', corpo: await ler(colecao(CAMINHO_DOS_LOCATARIOS)) },
        { rotulo: 'fiadores (lista)', corpo: await ler(colecao(CAMINHO_DOS_FIADORES)) },
        {
          rotulo: 'carteira (lista expandida)',
          corpo: await ler(`${colecao(CAMINHO_DOS_CONJUNTOS)}?expandir=imoveis`),
        },
      ];

      // A varredura é por CAMINHO, e não campo a campo: é o que impede a asserção de envelhecer
      // quando um campo novo entrar no contrato.
      const violacoes: string[] = [];
      for (const leitura of leituras) {
        percorrer(leitura.corpo, leitura.rotulo, violacoes);
      }
      expect(violacoes, `campos entregues no tipo errado:\n${violacoes.join('\n')}`).toEqual([]);

      // Âncora de NÃO-VACUIDADE: a varredura de fato visitou os campos que ela existe para checar.
      // Sem ela, um caminhamento quebrado — ou um corpo vazio — devolveria `[]` e passaria.
      const visitados = new Set<string>();
      for (const leitura of leituras) {
        colher(leitura.corpo, visitados);
      }
      for (const nome of [...CAMPOS_NUMERICOS, ...Object.keys(LISTAS_FECHADAS), 'retiradoEm']) {
        expect(visitados, `a varredura nunca alcançou o campo \`${nome}\``).toContain(nome);
      }

      // E as asserções LITERAIS sobre os campos que o PRD nomeia — as que dizem o valor exato do
      // `typeof`, e não apenas "a lista de violações está vazia".
      expect(typeof (cenario.imovel as { metragemTotal: unknown }).metragemTotal).toBe('number');
      const comodos = (cenario.imovel as { comodos: readonly Record<string, unknown>[] }).comodos;
      expect(comodos.length).toBeGreaterThan(0);
      for (const comodo of comodos) {
        expect(typeof comodo.metragem).toBe('number');
        expect(typeof comodo.posicao).toBe('number');
      }
      const pagina = (await ler(colecao(CAMINHO_DOS_IMOVEIS))) as Record<string, unknown>;
      expect(typeof pagina.total).toBe('number');
      expect(typeof pagina.limite).toBe('number');
      expect(typeof pagina.deslocamento).toBe('number');

      // A marca de retirada preenchida é cadeia ISO-8601, e a de quem está em circulação é nula.
      expect((cenario.imovelRetirado as { retiradoEm: unknown }).retiradoEm).toMatch(MARCA_ISO);
      expect((cenario.imovel as { retiradoEm: unknown }).retiradoEm).toBeNull();
    },
    LIMITE_CASO_MS,
  );

  it(
    'CT-322 — chave desconhecida no corpo recusa em toda rota de escrita, e nada é gravado',
    async () => {
      const cenario = await montarCenarioCompleto();
      const tabela = rotasDeEscrita(cenario);

      expect(tabela.length).toBe(ROTAS_DE_ESCRITA);

      const exercitadas: string[] = [];
      for (const rota of tabela) {
        const antes = await contar(rota.colecaoDaContagem);

        // Eixo POSITIVO primeiro: sem ele, um esquema quebrado que recusasse TUDO passaria o caso
        // inteiro, e o `422` abaixo não provaria nada sobre a chave extra.
        const aceita = await pedir(rota.alvo, {
          metodo: rota.metodo,
          cookie,
          corpo: rota.corpo(),
        });
        expect(
          aceita.status,
          `${rota.rotulo} recusou o corpo VÁLIDO com ${String(aceita.status)}: ${aceita.texto}`,
        ).toBe(rota.sucesso);

        const depoisDoAceite = await contar(rota.colecaoDaContagem);

        // O MESMO corpo, com a chave a mais.
        const recusada = await pedir(rota.alvo, {
          metodo: rota.metodo,
          cookie,
          corpo: { ...rota.corpo(), [CHAVE_EXTRA]: 'valor qualquer' },
        });

        expect(
          recusada.status,
          `${rota.rotulo} aceitou a chave extra com ${String(recusada.status)}: ${recusada.texto}`,
        ).toBe(422);
        // Corpo INTEIRO por igualdade: um envelope que ganhasse `detalhes` — com o `ZodError`
        // dentro, que é por onde a entrada recusada vazaria — reprova aqui.
        expect(recusada.corpo, `a recusa de ${rota.rotulo} mudou de forma`).toEqual({
          codigo: CodigoErro.CAMPO_INVALIDO,
          mensagem: MENSAGEM_DE_CAMPO_INVALIDO,
          campo: CAMPO_DO_CORPO,
        });

        // A contagem só se moveu na tentativa ACEITA — o `422` não gravou linha nenhuma.
        expect(
          { rotulo: rota.rotulo, contagem: await contar(rota.colecaoDaContagem) },
          `${rota.rotulo} gravou apesar da recusa`,
        ).toEqual({ rotulo: rota.rotulo, contagem: depoisDoAceite });
        expect(depoisDoAceite).toBe(antes + rota.crescimentoEsperado);

        exercitadas.push(rota.rotulo);
      }
      expect(exercitadas.length).toBe(ROTAS_DE_ESCRITA);
    },
    LIMITE_CASO_MS,
  );

  it(
    'CT-324 — o identificador de rota é validado como UUID e canonizado em minúsculas',
    async () => {
      const cenario = await montarCenarioCompleto();
      const id = (cenario.conjunto as { id: string }).id;
      const item = `${colecao(CAMINHO_DOS_CONJUNTOS)}/`;

      expect(id).toMatch(UUID_CANONICO);

      // As TRÊS grafias do mesmo identificador.
      const emMinusculas = await pedir(`${item}${id}`, { cookie });
      const emMaiusculas = await pedir(`${item}${id.toUpperCase()}`, { cookie });
      const emCaixaMista = await pedir(`${item}${caixaMista(id)}`, { cookie });

      for (const resposta of [emMinusculas, emMaiusculas, emCaixaMista]) {
        expect(resposta.status, `a leitura respondeu ${String(resposta.status)}`).toBe(200);
      }

      // Corpos PROFUNDAMENTE iguais — inclusive o campo `id`, que vem em minúsculas nas três. É a
      // canonização: o Postgres renderiza `uuid` em minúsculas e parseia hexadecimal sem distinguir
      // caixa, enquanto `z.uuid()` devolveria o valor verbatim.
      expect(emMaiusculas.corpo).toEqual(emMinusculas.corpo);
      expect(emCaixaMista.corpo).toEqual(emMinusculas.corpo);
      expect((emMaiusculas.corpo as { id: string }).id).toBe(id);
      expect((emCaixaMista.corpo as { id: string }).id).toMatch(UUID_CANONICO);

      // --- Eixo NEGATIVO: o que não é UUID é recusado, nomeando o parâmetro --------------------
      const antes = await contar(CAMINHO_DOS_CONJUNTOS);

      for (const invalido of VALORES_INVALIDOS(id)) {
        const resposta = await pedir(`${item}${encodeURIComponent(invalido)}`, { cookie });

        expect(
          resposta.status,
          `o identificador ${JSON.stringify(invalido)} respondeu ${String(resposta.status)}`,
        ).toBe(422);
        expect(resposta.corpo, `a recusa de ${JSON.stringify(invalido)} mudou de forma`).toEqual({
          codigo: CodigoErro.CAMPO_INVALIDO,
          mensagem: MENSAGEM_DE_CAMPO_INVALIDO,
          campo: CAMPO_DO_IDENTIFICADOR,
        });
      }

      // Nada foi gravado nem apagado pelas tentativas — inclusive a que carrega a instrução de
      // remoção de tabela.
      expect(await contar(CAMINHO_DOS_CONJUNTOS)).toBe(antes);
    },
    LIMITE_CASO_MS,
  );

  it(
    'CT-945 — a rota de bytes CONSTA do documento publicado, declarando mídia e nome de arquivo, sem forma do corpo de sucesso',
    async () => {
      const documento = await documentoPublicado();
      const caminhos = Object.keys(
        (documento.paths ?? {}) as Record<string, Record<string, unknown>>,
      );

      // -----------------------------------------------------------------------------------------
      // A âncora ANTIVÁCUO, antes de tudo: o documento descreve caminhos
      // -----------------------------------------------------------------------------------------
      //
      // Sem ela, um documento **vazio** faria a asserção de baixo reprovar dizendo "a rota sumiu" —
      // que nomeia o defeito errado —, e as duas negativas do fim do caso passariam por vacuidade.
      // O piso é a superfície que o `CT-327` já percorre, e não um `> 0`.
      expect(caminhos.length).toBeGreaterThanOrEqual(ROTAS_DESCRITAS);

      // -----------------------------------------------------------------------------------------
      // O CAMINHO CONSTA — e é esta linha que a ADR-0028 nomeia como parte da decisão
      // -----------------------------------------------------------------------------------------
      //
      // A `Decision` da ADR-0028 exige *"prova por caso que reprova se a rota desaparecer do
      // documento publicado"*: é a única deste conjunto que nomeia o caso de teste. A falha nomeia o
      // caminho ausente por extenso, e não um booleano.
      expect(
        caminhos.filter((caminho) => caminho === CAMINHO_DO_BOLETO_NO_DOCUMENTO),
        `o documento publicado não descreve mais ${CAMINHO_DO_BOLETO_NO_DOCUMENTO}`,
      ).toEqual([CAMINHO_DO_BOLETO_NO_DOCUMENTO]);

      const operacao = operacaoPublicada(documento, CAMINHO_DO_BOLETO_NO_DOCUMENTO, 'get');
      const respostas = operacao.responses ?? {};

      // -----------------------------------------------------------------------------------------
      // O SUCESSO declara MÍDIA e NOME DE ARQUIVO — e NÃO declara forma do corpo
      // -----------------------------------------------------------------------------------------
      //
      // Há exatamente **uma** resposta `2xx` com conteúdo, e o tipo de mídia dela é afirmado por
      // igualdade de arranjo: um `application/json` que aparecesse ao lado do PDF — a forma de a
      // rota deixar de ser de bytes sem sair do documento — reprova aqui, e um `toContain` o
      // aprovaria.
      const sucessos = Object.entries(respostas).filter(
        ([codigo, corpo]) => codigo.startsWith('2') && corpo.content !== undefined,
      );

      expect(sucessos.map(([codigo]) => codigo)).toEqual([STATUS_DE_SUCESSO_DO_BOLETO]);

      const sucesso = sucessos[0]?.[1];

      expect(Object.keys(sucesso?.content ?? {})).toEqual([TIPO_DE_MIDIA_DO_BOLETO]);

      // ⚠️ `format: 'binary'` **não** é declaração de forma — é o idioma que o OpenAPI tem para
      // dizer *"isto é uma sequência de bytes opaca"*, isto é, a declaração da AUSÊNCIA de forma. O
      // que a ADR-0028 proíbe é declarar a ESTRUTURA do sucesso, e a igualdade de objeto abaixo é o
      // que separa as duas coisas: um `properties`, um `required` ou um `$ref` acrescentado aqui
      // reprova, porque o objeto inteiro deixa de ser este.
      expect(
        sucesso?.content?.[TIPO_DE_MIDIA_DO_BOLETO]?.schema,
        'a rota de bytes passou a declarar a FORMA do corpo de sucesso (ADR-0028)',
      ).toEqual({ type: 'string', format: 'binary' });

      // O nome sugerido do arquivo é publicado como CABEÇALHO declarado, e a descrição dele carrega
      // a forma `attachment; filename="…"` — é ela que diz ao consumidor como o navegador vai
      // batizar o download. Sem esta metade, "a rota está no documento" seria satisfeito por uma
      // declaração que não diz nada sobre o nome.
      const cabecalhos = sucesso?.headers ?? {};

      expect(Object.keys(cabecalhos)).toEqual([CABECALHO_DA_DISPOSICAO]);
      expect(cabecalhos[CABECALHO_DA_DISPOSICAO]?.description).toBe(
        DISPOSICAO_DECLARADA_NO_DOCUMENTO,
      );

      // -----------------------------------------------------------------------------------------
      // O ENVELOPE DE ERRO é o das demais rotas, e os códigos são do ENUM FECHADO DE OITO
      // -----------------------------------------------------------------------------------------
      //
      // A ADR-0028 declara que a rota de bytes permanece no contrato *"com o mesmo envelope de erro"*,
      // e a ADR-0017 fecha o enum: a asserção compara os códigos declarados, status a status, por
      // igualdade de OBJETO — de modo que um código a mais, um a menos, ou um status que sumisse são
      // as três direções que ela pega numa comparação só.
      const codigosPorStatus = Object.fromEntries(
        Object.entries(respostas)
          .filter(([codigo]) => !codigo.startsWith('2'))
          .map(([codigo, corpo]) => [
            codigo,
            (corpo.content?.['application/json']?.schema as EsquemaDeErroPublicado | undefined)
              ?.properties?.codigo?.enum,
          ]),
      );

      expect(codigosPorStatus).toEqual(CODIGOS_DE_ERRO_DA_ROTA_DE_BYTES);

      // E a rede: **todo** código declarado pertence ao enum fechado da ADR-0017. Sem ela, a
      // igualdade acima aprovaria um código inventado desde que alguém o escrevesse nos dois lados —
      // que é exatamente o modo de falha de um esperado escrito à mão. A lista de onze é derivada do
      // enum de `@sysloc/shared`, e a falha NOMEIA o intruso.
      const declarados = Object.values(codigosPorStatus).flatMap((codigos) => codigos ?? []);
      const fechado = new Set<string>(Object.values(CodigoErro));

      expect(fechado.size).toBe(CODIGOS_DO_ENUM_FECHADO);
      expect(
        declarados.filter((codigo) => !fechado.has(codigo)),
        'a rota de bytes declara código de erro fora do enum fechado da ADR-0017',
      ).toEqual([]);
    },
    LIMITE_CASO_MS,
  );
});

// ---------------------------------------------------------------------------------------------
// CT-327 — a tabela das 48 rotas, com o esquema de `@sysloc/contracts` que cada uma publica
// ---------------------------------------------------------------------------------------------

/** Uma rota do domínio e o esquema de que a resposta dela deve derivar. */
interface EsquemaDeRota {
  /** O caminho **como o documento OpenAPI o escreve** — com `{id}`, e não `:id`. */
  readonly caminho: string;
  readonly metodo: string;
  readonly esquema: z.ZodType;
}

/** O caminho de uma coleção no documento OpenAPI. */
function caminhoDoDocumento(dono: string): string {
  return `/${PREFIXO_DE_VERSAO}/${dono}`;
}

/** As **seis** rotas de uma entidade de cadastro, com o esquema do item e o do envelope. */
function esquemasDeUmCadastro(dono: string, item: z.ZodType, lista: z.ZodType): EsquemaDeRota[] {
  const raiz = caminhoDoDocumento(dono);

  return [
    { caminho: raiz, metodo: 'post', esquema: item },
    { caminho: raiz, metodo: 'get', esquema: lista },
    { caminho: `${raiz}/{id}`, metodo: 'get', esquema: item },
    { caminho: `${raiz}/{id}`, metodo: 'put', esquema: item },
    { caminho: `${raiz}/{id}/retirada`, metodo: 'post', esquema: item },
    { caminho: `${raiz}/{id}/recirculacao`, metodo: 'post', esquema: item },
  ];
}

/**
 * As **48** rotas, com o esquema de `@sysloc/contracts` de que cada resposta deriva.
 *
 * SUT_IS_CORRECT_BECAUSE: esta linha dizia "As **39** rotas" enquanto a tabela já tinha 40, depois
 * 41, 42, 43, 46, e agora 48 — é o débito **D33 (F2/T7)**, fechado na T7 e mantido em dia desde então. O que mudou é **só a prosa**: a cardinalidade
 * executável vive em {@link ROTAS_DESCRITAS}, e o `CT-327` a afirma antes de percorrer a tabela.
 * Corrigi-la é obrigatório mesmo assim, pela razão que o docblock de {@link ROTAS_DE_ESCRITA} escreve
 * por extenso: número desatualizado convida a próxima task a "corrigir" a âncora **para o valor
 * errado**.
 *
 * A listagem de conjuntos é a **união** da página simples com a da carteira, porque a rota é uma só
 * e devolve uma das duas formas conforme `expandir` — é o que `conjunto.controller.ts` publica, e a
 * união é composta **aqui a partir dos mesmos esquemas do pacote**, nunca importada dele: importar a
 * composição do controlador faria a asserção concordar consigo mesma.
 *
 * As três rotas de cômodo respondem com o **imóvel inteiro** já recalculado: o cômodo não tem
 * representação própria na API (§4.1), e a ausência de uma quarta rota é contrato.
 */
const ESQUEMAS_POR_ROTA: readonly EsquemaDeRota[] = [
  ...esquemasDeUmCadastro(
    CAMINHO_DOS_CONJUNTOS,
    esquemaDoConjunto,
    z.union([envelopeDeLista(esquemaDoConjunto), envelopeDeLista(esquemaDoConjuntoComImoveis)]),
  ),
  ...esquemasDeUmCadastro(CAMINHO_DOS_IMOVEIS, esquemaDoImovel, envelopeDeLista(esquemaDoImovel)),
  // SUT_IS_CORRECT_BECAUSE: o código de produção está certo e era esta tabela que descrevia uma
  // superfície de seis rotas de imóvel. A T10 publicou `POST /v1/imoveis/{id}/situacao-de-locacao`, e
  // a linha nova aponta para **`esquemaDoImovel`**: a rota responde com o imóvel inteiro já
  // recalculado, como as três de cômodo logo abaixo — e não com um objeto próprio da situação, que
  // obrigaria o cliente a uma segunda leitura para saber como o imóvel ficou. Sem a linha, o `CT-327`
  // passaria sobre uma superfície incompleta. Nenhuma asserção foi afrouxada e nenhuma linha anterior
  // saiu.
  //
  // Os **dois esquemas de entrada** que a T10 publica — `esquemaDeImovelAlterado` (o corpo do `PUT`,
  // derivado por `omit`) e `esquemaDaSituacaoDeLocacao` (o corpo de um campo desta rota) — **não**
  // aparecem nesta tabela, e a ausência não é omissão: **nenhum controlador desta base descreve corpo
  // de requisição** no documento (não há um `@ApiBody` em `apps/api/src`), de modo que o documento
  // publicado descreve respostas. Quem prova que o `PUT` deixou de aceitar `statusLocacao` é o
  // `CT-434`, pela rota, e o `CT-322` deste arquivo, que envia o corpo válido e depois a chave a mais.
  {
    caminho: `${caminhoDoDocumento(CAMINHO_DOS_IMOVEIS)}/{id}/situacao-de-locacao`,
    metodo: 'post',
    esquema: esquemaDoImovel,
  },
  {
    caminho: `${caminhoDoDocumento(CAMINHO_DOS_IMOVEIS)}/{id}/comodos`,
    metodo: 'post',
    esquema: esquemaDoImovel,
  },
  {
    caminho: `${caminhoDoDocumento(CAMINHO_DOS_IMOVEIS)}/{id}/comodos/{comodoId}`,
    metodo: 'put',
    esquema: esquemaDoImovel,
  },
  {
    caminho: `${caminhoDoDocumento(CAMINHO_DOS_IMOVEIS)}/{id}/comodos/{comodoId}`,
    metodo: 'delete',
    esquema: esquemaDoImovel,
  },
  ...esquemasDeUmCadastro(CAMINHO_DOS_LOCADORES, esquemaDaPessoa, envelopeDeLista(esquemaDaPessoa)),
  // SUT_IS_CORRECT_BECAUSE: a **T9** da fatia `documentos-e-confirmacao` fez as **seis** rotas de
  // locatário publicarem `esquemaDoLocatario` — o cadastro de pessoa **mais** `emailConfirmadoEm` —,
  // e locador e fiador seguem com `esquemaDaPessoa`. O código de produção está certo e era esta
  // tabela que descrevia a superfície anterior: a assimetria é o conteúdo, porque a coluna existe só
  // em `negocio.locatario`. **Nenhuma linha saiu**, a igualdade profunda segue exata, e as duas
  // linhas vizinhas — locador e fiador — continuam apontando para o esquema de sempre, o que é
  // exatamente o que faz esta edição ser conferível.
  ...esquemasDeUmCadastro(
    CAMINHO_DOS_LOCATARIOS,
    esquemaDoLocatario,
    envelopeDeLista(esquemaDoLocatario),
  ),
  // A rota do **reenvio da confirmação** (T9). Ela aponta para `esquemaDoReenvioDeConfirmacao`, e não
  // para o esquema do locatário: o `202` afirma só o que já aconteceu — o portador foi gravado e os
  // anteriores foram invalidados — e **cala sobre a entrega**, que corre fora da requisição
  // (ADR-0029). É a própria escolha da rota que esta linha afirma.
  {
    caminho: `${caminhoDoDocumento(CAMINHO_DOS_LOCATARIOS)}/{id}/confirmacao-de-email`,
    metodo: 'post',
    esquema: esquemaDoReenvioDeConfirmacao,
  },
  ...esquemasDeUmCadastro(CAMINHO_DOS_FIADORES, esquemaDaPessoa, envelopeDeLista(esquemaDaPessoa)),
  ...esquemasDeCadastroDeContrato(),
  ...esquemasDoCertificadoDoProvedor(),
  ...esquemasDaEntregaDaNoticia(),
];

/**
 * As **três** rotas do certificado do provedor — o registro e a consulta (T11) e a verificação (T12)
 * da fatia `fundacao-bancaria`.
 *
 * Elas não passam por {@link esquemasDeUmCadastro}, e a exclusão é conteúdo: o recurso é **singular**
 * e a chave dele é a própria sessão, de modo que não há `{id}` em caminho nenhum desta superfície —
 * nem retirada, nem recirculação, nem listagem. O plural aparece **só** no caminho do registro, onde
 * o que se acrescenta é um item à coleção de certificados da empresa.
 *
 * Os caminhos são **compostos a partir das constantes que o controlador publica**, e os segmentos são
 * os mesmos que `cobertura-de-autorizacao.e2e.spec.ts` usa para compor os pares — é essa coincidência
 * que liga a superfície descrita aqui à superfície auditada lá.
 *
 * As três apontam para **esquemas distintos**, e a distinção é o que a linha afirma. A verificação
 * **não devolve o certificado** — ela responde se a identidade foi aceita —, e apontá-la para o
 * esquema do certificado faria a igualdade profunda reprovar, que é precisamente a prova de que o
 * documento é derivado e não escrito à mão. O `201` do registro e o `200` das outras duas convivem na
 * mesma tabela porque {@link esquemaDaResposta} busca a resposta de sucesso por **prefixo**.
 *
 * SUT_IS_CORRECT_BECAUSE: o código de produção está certo e era esta tabela que descrevia a resposta
 * do **registro** como sendo a projeção do certificado. A T2 da fatia `integracao-bancaria-autonoma`
 * publicou `esquemaDoDesfechoDoRegistroDeCertificado` (§4.4 do tech spec) — que **não é**
 * `esquemaDoCertificado`: ele o estende com `materialConvertido`, a declaração de que o material
 * precisou ser convertido, que é propriedade do **ato** e não do certificado. É a mesma forma, e a
 * mesma razão, de `esquemaDaAtivacaoDeContrato` logo abaixo. **A consulta continua apontando para
 * `esquemaDoCertificado`**, e é essa assimetria que prova que o campo do ato não vazou para a
 * projeção compartilhada: apontar as duas para o mesmo esquema faria uma das igualdades profundas
 * reprovar. Nenhuma asserção foi afrouxada e nenhuma linha anterior saiu.
 *
 * O **corpo de entrada** do registro (`esquemaDoCertificadoNovo`) não aparece aqui, e a ausência não
 * é omissão: nenhum controlador desta base descreve corpo de requisição no documento — quem prova a
 * recusa da chave desconhecida é `certificado-do-provedor.e2e.spec.ts`.
 */
function esquemasDoCertificadoDoProvedor(): EsquemaDeRota[] {
  const raiz = caminhoDoDocumento(CAMINHO_DAS_INTEGRACOES_BANCARIAS);

  return [
    {
      caminho: `${raiz}/${SEGMENTO_DO_REGISTRO}`,
      metodo: 'post',
      esquema: esquemaDoDesfechoDoRegistroDeCertificado,
    },
    { caminho: `${raiz}/${SEGMENTO_DA_CONSULTA}`, metodo: 'get', esquema: esquemaDoCertificado },
    {
      caminho: `${raiz}/${SEGMENTO_DA_CONSULTA}/${SEGMENTO_DA_VERIFICACAO}`,
      metodo: 'post',
      esquema: esquemaDoResultadoDaVerificacao,
    },
  ];
}

/**
 * As **duas** rotas da entrega da notícia — a ativação e a consulta (T7 desta fatia).
 *
 * ⚠️ As duas apontam para o **mesmo** `esquemaDoEstadoDaEntrega`, e a coincidência é conteúdo: o que
 * a ativação devolve é o estado resultante, e não um envelope de ato com campo próprio. É a assimetria
 * declarada em relação ao registro do certificado, cuja resposta estende a projeção com
 * `materialConvertido` — apontar esta ativação para um esquema estendido faria a igualdade profunda
 * reprovar, e é isso que prova que o documento é **derivado** e não escrito à mão.
 *
 * O **corpo de entrada** da ativação (`esquemaDaAtivacaoDaEntrega`) não aparece aqui, e a ausência não
 * é omissão: nenhum controlador desta base descreve corpo de requisição no documento — quem prova a
 * recusa da chave desconhecida é o **`CT-1044`** de `packages/contracts/test/esquemas.spec.ts`
 * (T5 desta fatia), no molde que a `.claude/rules/contrato-publicado.md` fixa — `code` valendo
 * `'unrecognized_keys'` **mais** a lista `keys` nomeando a chave recusada. ⚠️ E **não** é
 * `entrega-da-noticia.e2e.spec.ts`, como esta linha já disse: aquela suíte só emite corpo **vazio**
 * na ativação, de modo que nenhuma requisição dela carrega chave desconhecida para ser recusada.
 */
function esquemasDaEntregaDaNoticia(): EsquemaDeRota[] {
  const raiz = caminhoDoDocumento(CAMINHO_DAS_INTEGRACOES_BANCARIAS);

  return [
    {
      caminho: `${raiz}/${SEGMENTO_DA_ENTREGA_DA_NOTICIA}/${SEGMENTO_DA_ATIVACAO}`,
      metodo: 'post',
      esquema: esquemaDoEstadoDaEntrega,
    },
    {
      caminho: `${raiz}/${SEGMENTO_DA_ENTREGA_DA_NOTICIA}`,
      metodo: 'get',
      esquema: esquemaDoEstadoDaEntrega,
    },
  ];
}

/**
 * As **oito** rotas da superfície de contrato — as seis de cadastro (T6), a **ativação** (T7) e o
 * **cancelamento** (T8) da fatia `contratos-de-locacao`.
 *
 * Elas não passam por {@link esquemasDeUmCadastro}, e a exclusão é conteúdo: o parâmetro de rota do
 * contrato é `{codigo}`, e não `{id}` — a chave exposta é o **código legível**, porque a entidade tem
 * série declarada (ADR-0017). Reusar a fábrica exigiria parametrizar o nome do parâmetro nela, o que
 * apagaria do fonte a única diferença que importa aqui.
 *
 * SUT_IS_CORRECT_BECAUSE: o código de produção está certo e era esta tabela que descrevia uma
 * superfície sem a ativação. A T7 publicou `POST /v1/contratos/{codigo}/ativacao`, e a linha nova
 * aponta para **`esquemaDaAtivacaoDeContrato`** — que não é `esquemaDoContrato`: ele o estende com
 * `efeitos`. Sem a linha, o `CT-327` passaria sobre uma superfície incompleta e **nada** afirmaria que
 * o documento descreve a declaração de efeito; e apontá-la para `esquemaDoContrato` faria a igualdade
 * profunda reprovar, que é precisamente a prova de que o documento é **derivado** e não escrito à mão.
 * Nenhuma asserção foi afrouxada e nenhuma linha anterior saiu.
 *
 * SUT_IS_CORRECT_BECAUSE: a T8 publicou `POST /v1/contratos/{codigo}/cancelamento`, e as partições
 * passam a ser `33 + 8`. A linha nova aponta para **`esquemaDoContrato`**, e **não** para
 * `esquemaDaAtivacaoDeContrato`: a resposta do cancelamento é o contrato no root, **sem** declaração
 * de efeito — escolha registrada, porque o CA-06 fala só da ativação. É essa distinção que a linha
 * afirma, e apontá-la para o esquema estendido faria a igualdade profunda reprovar. Sem a linha, o
 * `CT-327` passaria sobre uma superfície incompleta. Nenhuma asserção foi afrouxada e nenhuma linha
 * anterior saiu.
 */
function esquemasDeCadastroDeContrato(): EsquemaDeRota[] {
  const raiz = caminhoDoDocumento(CAMINHO_DOS_CONTRATOS);
  const lista = envelopeDeLista(esquemaDoContrato);

  return [
    { caminho: raiz, metodo: 'post', esquema: esquemaDoContrato },
    { caminho: raiz, metodo: 'get', esquema: lista },
    { caminho: `${raiz}/{codigo}`, metodo: 'get', esquema: esquemaDoContrato },
    { caminho: `${raiz}/{codigo}`, metodo: 'put', esquema: esquemaDoContrato },
    {
      caminho: `${raiz}/{codigo}/ativacao`,
      metodo: 'post',
      esquema: esquemaDaAtivacaoDeContrato,
    },
    { caminho: `${raiz}/{codigo}/cancelamento`, metodo: 'post', esquema: esquemaDoContrato },
    { caminho: `${raiz}/{codigo}/retirada`, metodo: 'post', esquema: esquemaDoContrato },
    { caminho: `${raiz}/{codigo}/recirculacao`, metodo: 'post', esquema: esquemaDoContrato },
  ];
}

/** O documento publicado, pedido pela rota que a aplicação já expõe. */
async function documentoPublicado(): Promise<Record<string, unknown>> {
  const resposta = await pedir(`/${CAMINHO_DO_DOCUMENTO}`);

  if (resposta.status !== 200) {
    throw new Error(`o documento respondeu ${String(resposta.status)}: ${resposta.texto}`);
  }

  return resposta.corpo as Record<string, unknown>;
}

/** O recorte do esquema de erro publicado que o `CT-945` lê — o enum de códigos, e nada mais. */
interface EsquemaDeErroPublicado {
  readonly properties?: { readonly codigo?: { readonly enum?: readonly string[] } };
}

/** Uma operação do documento, no recorte que o `CT-945` observa dela. */
interface OperacaoPublicada {
  readonly responses?: Record<
    string,
    {
      readonly content?: Record<string, { readonly schema?: unknown }>;
      readonly headers?: Record<string, { readonly description?: string }>;
    }
  >;
}

/**
 * A operação de um caminho do documento publicado.
 *
 * Ausência **levanta**, e não devolve `undefined`: uma rota que sumisse do documento faria toda
 * leitura abaixo virar `undefined`, e `undefined` igual a `undefined` passaria em silêncio — que é o
 * modo de falha que a ADR-0028 nomeia ao exigir *"caso que reprova se a rota desaparecer"*.
 */
function operacaoPublicada(
  documento: Record<string, unknown>,
  caminho: string,
  metodo: string,
): OperacaoPublicada {
  const paths = documento.paths as Record<string, Record<string, unknown>> | undefined;
  const operacao = paths?.[caminho]?.[metodo] as OperacaoPublicada | undefined;

  if (operacao === undefined) {
    throw new Error(`o documento não descreve ${metodo.toUpperCase()} ${caminho}`);
  }

  return operacao;
}

/**
 * O esquema da resposta de sucesso de uma operação do documento.
 *
 * A operação tem **exatamente uma** resposta `2xx` com conteúdo, e a busca por prefixo em vez de por
 * código literal é o que permite a `201` da criação e a `200` das demais conviverem numa tabela só.
 * Ausência levanta: uma rota que sumisse do documento devolveria `undefined`, e `undefined` igual a
 * `undefined` passaria a comparação em silêncio.
 */
function esquemaDaResposta(
  documento: Record<string, unknown>,
  caminho: string,
  metodo: string,
): unknown {
  const paths = documento.paths as Record<string, Record<string, unknown>> | undefined;
  const operacao = paths?.[caminho]?.[metodo] as
    | { responses?: Record<string, { content?: Record<string, { schema?: unknown }> }> }
    | undefined;

  if (operacao === undefined) {
    throw new Error(`o documento não descreve ${metodo.toUpperCase()} ${caminho}`);
  }

  const sucessos = Object.entries(operacao.responses ?? {}).filter(
    ([codigo, corpo]) => codigo.startsWith('2') && corpo.content !== undefined,
  );

  if (sucessos.length !== 1) {
    throw new Error(
      `${metodo.toUpperCase()} ${caminho} declara ${String(sucessos.length)} respostas de sucesso com conteúdo`,
    );
  }

  const esquema = sucessos[0]?.[1].content?.['application/json']?.schema;
  if (esquema === undefined) {
    throw new Error(`${metodo.toUpperCase()} ${caminho} não descreve o corpo da resposta`);
  }

  return esquema;
}

// ---------------------------------------------------------------------------------------------
// CT-328 — a varredura por CAMINHO
// ---------------------------------------------------------------------------------------------

/** Uma leitura observada, com o rótulo que a violação nomeia. */
interface Leitura {
  readonly rotulo: string;
  readonly corpo: unknown;
}

/** Os campos que **têm** de chegar como `number` — a métrica "zero conversão" do PRD §10. */
const CAMPOS_NUMERICOS = [
  'metragem',
  'metragemTotal',
  'posicao',
  'total',
  'limite',
  'deslocamento',
];

/** Os campos de união fechada, e a lista a que cada valor tem de pertencer. */
const LISTAS_FECHADAS: Readonly<Record<string, readonly string[]>> = {
  tipoImovel: TIPOS_DE_IMOVEL,
  statusLocacao: SITUACOES_DE_LOCACAO,
  tipoPessoa: TIPOS_DE_PESSOA,
};

/**
 * Percorre o corpo recursivamente e coleta o caminho exato de cada campo entregue no tipo errado.
 *
 * Por caminho, e não campo a campo: `numeric` e `count(*)` voltam do driver como CADEIA, e o defeito
 * que este caso previne é exatamente esse — um campo novo que nascesse texto ficaria sem prova numa
 * asserção escrita campo a campo.
 */
function percorrer(valor: unknown, caminho: string, violacoes: string[]): void {
  if (Array.isArray(valor)) {
    valor.forEach((item, indice) => {
      percorrer(item, `${caminho}[${String(indice)}]`, violacoes);
    });
    return;
  }

  if (valor === null || typeof valor !== 'object') {
    return;
  }

  for (const [nome, conteudo] of Object.entries(valor)) {
    const aqui = `${caminho}.${nome}`;

    if (CAMPOS_NUMERICOS.includes(nome) && typeof conteudo !== 'number') {
      violacoes.push(`${aqui}: esperado number, veio ${typeof conteudo}`);
    }

    const fechada = LISTAS_FECHADAS[nome];
    if (fechada !== undefined && !fechada.includes(conteudo as string)) {
      violacoes.push(`${aqui}: ${JSON.stringify(conteudo)} fora da lista fechada`);
    }

    if (nome === 'retiradoEm' && conteudo !== null && !MARCA_ISO.test(String(conteudo))) {
      violacoes.push(`${aqui}: ${JSON.stringify(conteudo)} não é nulo nem ISO-8601`);
    }

    percorrer(conteudo, aqui, violacoes);
  }
}

/** Os nomes de campo que a varredura de fato visitou — a âncora de não-vacuidade. */
function colher(valor: unknown, vistos: Set<string>): void {
  if (Array.isArray(valor)) {
    for (const item of valor) {
      colher(item, vistos);
    }
    return;
  }

  if (valor === null || typeof valor !== 'object') {
    return;
  }

  for (const [nome, conteudo] of Object.entries(valor)) {
    vistos.add(nome);
    colher(conteudo, vistos);
  }
}

// ---------------------------------------------------------------------------------------------
// CT-322 — a tabela das 12 rotas de escrita
// ---------------------------------------------------------------------------------------------

/** Uma rota de escrita, com o corpo válido e o efeito esperado sobre a contagem da entidade. */
interface RotaDeEscrita {
  readonly rotulo: string;
  readonly metodo: string;
  readonly alvo: string;
  readonly corpo: () => Record<string, unknown>;
  /** O status que o corpo VÁLIDO recebe: `201` na criação, `200` na reescrita. */
  readonly sucesso: number;
  /** A coleção cuja contagem é observada — o cômodo é contado pelo imóvel que o carrega. */
  readonly colecaoDaContagem: string;
  /** Quanto a contagem cresce com a tentativa aceita. */
  readonly crescimentoEsperado: number;
}

/** As **12** rotas de escrita: `POST` e `PUT` das seis entidades. */
function rotasDeEscrita(cenario: CenarioCompleto): readonly RotaDeEscrita[] {
  const conjuntoId = (cenario.conjunto as { id: string }).id;
  const imovelId = (cenario.imovel as { id: string }).id;
  const comodoId = (cenario.imovel as { comodos: readonly { id: string }[] }).comodos[0]?.id ?? '';
  const comodos = `${colecao(CAMINHO_DOS_IMOVEIS)}/${imovelId}/comodos`;

  const dePapel = (dono: string, id: string): readonly RotaDeEscrita[] => [
    {
      rotulo: `POST ${colecao(dono)}`,
      metodo: 'POST',
      alvo: colecao(dono),
      corpo: corpoDePessoa,
      sucesso: 201,
      colecaoDaContagem: dono,
      crescimentoEsperado: 1,
    },
    {
      rotulo: `PUT ${colecao(dono)}/:id`,
      metodo: 'PUT',
      alvo: `${colecao(dono)}/${id}`,
      corpo: corpoDePessoa,
      sucesso: 200,
      colecaoDaContagem: dono,
      crescimentoEsperado: 0,
    },
  ];

  return [
    {
      rotulo: `POST ${colecao(CAMINHO_DOS_CONJUNTOS)}`,
      metodo: 'POST',
      alvo: colecao(CAMINHO_DOS_CONJUNTOS),
      corpo: () => ({ nome: `Edifício ${String(proximo())}` }),
      sucesso: 201,
      colecaoDaContagem: CAMINHO_DOS_CONJUNTOS,
      crescimentoEsperado: 1,
    },
    {
      rotulo: `PUT ${colecao(CAMINHO_DOS_CONJUNTOS)}/:id`,
      metodo: 'PUT',
      alvo: `${colecao(CAMINHO_DOS_CONJUNTOS)}/${conjuntoId}`,
      corpo: () => ({ nome: `Edifício ${String(proximo())}` }),
      sucesso: 200,
      colecaoDaContagem: CAMINHO_DOS_CONJUNTOS,
      crescimentoEsperado: 0,
    },
    {
      rotulo: `POST ${colecao(CAMINHO_DOS_IMOVEIS)}`,
      metodo: 'POST',
      alvo: colecao(CAMINHO_DOS_IMOVEIS),
      corpo: () => corpoDeImovel(conjuntoId),
      sucesso: 201,
      colecaoDaContagem: CAMINHO_DOS_IMOVEIS,
      crescimentoEsperado: 1,
    },
    {
      rotulo: `PUT ${colecao(CAMINHO_DOS_IMOVEIS)}/:id`,
      metodo: 'PUT',
      alvo: `${colecao(CAMINHO_DOS_IMOVEIS)}/${imovelId}`,
      corpo: () => corpoDeImovelAlterado(conjuntoId),
      sucesso: 200,
      colecaoDaContagem: CAMINHO_DOS_IMOVEIS,
      crescimentoEsperado: 0,
    },
    // O cômodo não tem coleção própria, e por isso a contagem observada é a dos IMÓVEIS: o que a
    // recusa não pode fazer é criar um imóvel — e o número de cômodos é conferido pelo `CT-308`.
    {
      rotulo: `POST ${comodos}`,
      metodo: 'POST',
      alvo: comodos,
      corpo: () => ({ nomeComodo: `Sala ${String(proximo())}`, metragem: 12.5, observacoes: null }),
      sucesso: 201,
      colecaoDaContagem: CAMINHO_DOS_IMOVEIS,
      crescimentoEsperado: 0,
    },
    {
      rotulo: `PUT ${comodos}/:comodoId`,
      metodo: 'PUT',
      alvo: `${comodos}/${comodoId}`,
      corpo: () => ({ nomeComodo: `Sala ${String(proximo())}`, metragem: 13.5, observacoes: null }),
      sucesso: 200,
      colecaoDaContagem: CAMINHO_DOS_IMOVEIS,
      crescimentoEsperado: 0,
    },
    ...dePapel(CAMINHO_DOS_LOCADORES, (cenario.locador as { id: string }).id),
    ...dePapel(CAMINHO_DOS_LOCATARIOS, (cenario.locatario as { id: string }).id),
    ...dePapel(CAMINHO_DOS_FIADORES, (cenario.fiador as { id: string }).id),
  ];
}

// ---------------------------------------------------------------------------------------------
// CT-324 — os vetores inválidos
// ---------------------------------------------------------------------------------------------

/**
 * Quatro valores que não são UUID, incluindo a tentativa de injeção — o mesmo padrão do `CT-011`.
 *
 * A cadeia **vazia** fica de fora, e a ausência é medida, não esquecimento: `/v1/conjuntos/` não é
 * uma requisição de `:id` — o roteador nem chega ao manipulador do item —, de modo que ela provaria
 * o roteamento, e não a validação do identificador. O que a substitui é o UUID **truncado em um
 * dígito**, que é a fronteira que de fato exercita o esquema.
 */
function VALORES_INVALIDOS(idValido: string): readonly string[] {
  return [
    'nao-e-uuid',
    '11111111-1111-4111-8111-11111111111',
    `${idValido}'; DROP TABLE negocio.conjunto; --`,
    `${idValido}x`,
  ];
}

/** O mesmo identificador com a caixa alternada — a terceira grafia do `CT-324`. */
function caixaMista(id: string): string {
  return [...id]
    .map((caractere, indice) => (indice % 2 === 0 ? caractere.toUpperCase() : caractere))
    .join('');
}

// ---------------------------------------------------------------------------------------------
// Arranjo — tudo pelo caminho real
// ---------------------------------------------------------------------------------------------

/** Um cenário completo: um exemplar de cada entidade, com todos os campos opcionais preenchidos. */
interface CenarioCompleto {
  readonly conjunto: unknown;
  readonly imovel: unknown;
  readonly imovelRetirado: unknown;
  readonly locador: unknown;
  readonly locatario: unknown;
  readonly fiador: unknown;
}

/**
 * Monta um cenário completo **pelas rotas reais**.
 *
 * Todos os campos opcionais são preenchidos — `complemento`, `observacoes`, `rg` — para que nenhum
 * campo escape da varredura do `CT-328` por estar nulo, e o imóvel nasce com **dois cômodos** para
 * que a metragem total seja soma de mais de uma parcela.
 */
async function montarCenarioCompleto(): Promise<CenarioCompleto> {
  const conjunto = await criar(colecao(CAMINHO_DOS_CONJUNTOS), {
    nome: `Edifício ${String(proximo())}`,
  });
  const conjuntoId = (conjunto as { id: string }).id;

  const semComodos = await criar(colecao(CAMINHO_DOS_IMOVEIS), corpoDeImovel(conjuntoId));
  const imovelId = (semComodos as { id: string }).id;
  const comodos = `${colecao(CAMINHO_DOS_IMOVEIS)}/${imovelId}/comodos`;

  await criar(comodos, { nomeComodo: 'Sala', metragem: 21.5, observacoes: 'de frente' });
  const imovel = await criar(comodos, {
    nomeComodo: 'Quarto',
    metragem: 13.25,
    observacoes: 'suíte',
  });

  // Um imóvel RETIRADO, para que a marca preenchida seja exercitada — sem ele o eixo de
  // `retiradoEm` só veria nulos, e uma marca entregue como número passaria despercebida.
  const outro = await criar(colecao(CAMINHO_DOS_IMOVEIS), corpoDeImovel(conjuntoId));
  const retirada = await pedir(
    `${colecao(CAMINHO_DOS_IMOVEIS)}/${(outro as { id: string }).id}/retirada`,
    {
      metodo: 'POST',
      cookie,
      corpo: {},
    },
  );
  if (retirada.status !== 200) {
    throw new Error(`a retirada respondeu ${String(retirada.status)}: ${retirada.texto}`);
  }

  return {
    conjunto,
    imovel,
    imovelRetirado: retirada.corpo,
    locador: await criar(colecao(CAMINHO_DOS_LOCADORES), corpoDePessoa()),
    locatario: await criar(colecao(CAMINHO_DOS_LOCATARIOS), corpoDePessoa()),
    fiador: await criar(colecao(CAMINHO_DOS_FIADORES), corpoDePessoa()),
  };
}

/** A coleção de uma entidade, sob o prefixo de versão. */
function colecao(dono: string): string {
  return `/${PREFIXO_DE_VERSAO}/${dono}`;
}

/**
 * O sequencial que dá unicidade aos três campos únicos desta superfície.
 *
 * Monotônico e de processo, e não sorteado: identificador municipal, documento e endereço de e-mail
 * vivem sob restrições que **alcançam os cadastros retirados** (ADR-0014), de modo que um valor
 * repetido produziria `422` de unicidade onde o caso mede outra coisa.
 */
let sequencial = 0;

function proximo(): number {
  sequencial += 1;
  return sequencial;
}

/** O corpo completo de um imóvel, com **todos** os campos opcionais preenchidos. */
function corpoDeImovel(conjuntoId: string): Record<string, unknown> {
  return {
    conjuntoId,
    nomeImovel: `Ap ${String(proximo())}`,
    identificadorMunicipal: `IM-${String(proximo()).padStart(6, '0')}`,
    tipoImovel: 'RESIDENCIAL',
    logradouro: 'Rua das Acácias',
    numero: '100',
    complemento: 'bloco B',
    bairro: 'Centro',
    cidade: 'São Paulo',
    estado: 'SP',
    cep: '01000000',
    statusLocacao: 'DISPONIVEL',
    observacoes: 'imóvel do cenário completo',
  };
}

/**
 * O corpo completo do `PUT` de imóvel — o da criação **menos** `statusLocacao` (T10).
 *
 * SUT_IS_CORRECT_BECAUSE: o código de produção está certo e era o corpo do `PUT` desta tabela que
 * carregava um campo que a rota deixou de aceitar. A T10 da fatia `contratos-de-locacao` tirou
 * `statusLocacao` do corpo da alteração, e `esquemaDeImovelAlterado` é `strictObject` — um corpo que
 * ainda o traga responde `422`. Aqui isso quebraria justamente o **eixo positivo** do `CT-322` (*"a
 * rota aceita o corpo VÁLIDO"*), que existe para impedir que um esquema quebrado, recusando tudo,
 * passe o caso inteiro. **Nenhuma asserção foi afrouxada**: o `422` da chave a mais continua sendo
 * afirmado por corpo inteiro, agora sobre o corpo que a rota de fato aceita.
 *
 * Ele é **derivado** do corpo da criação, espelhando o `omit` do contrato — nunca uma segunda lista.
 */
function corpoDeImovelAlterado(conjuntoId: string): Record<string, unknown> {
  const corpo = corpoDeImovel(conjuntoId);
  delete corpo.statusLocacao;

  return corpo;
}

/** O corpo completo de um cadastro de pessoa, com **todos** os campos opcionais preenchidos. */
function corpoDePessoa(): Record<string, unknown> {
  const marca = String(proximo()).padStart(6, '0');

  return {
    nome: `Pessoa ${marca}`,
    tipoPessoa: 'PESSOA_FISICA',
    documentoPrincipal: cpfValido(proximo()),
    rg: `MG-${marca}`,
    email: `pessoa.${marca}@exemplo.com.br`,
    telefone: '11999990000',
    logradouro: 'Rua das Acácias',
    numero: '100',
    complemento: 'apto 12',
    bairro: 'Centro',
    cidade: 'São Paulo',
    estado: 'SP',
    cep: '01000000',
  };
}

/** Cria um registro pela rota real e devolve o corpo publicado. A falha levanta. */
async function criar(alvo: string, corpo: Record<string, unknown>): Promise<unknown> {
  const resposta = await pedir(alvo, { metodo: 'POST', cookie, corpo });

  if (resposta.status !== 201) {
    throw new Error(`a criação em ${alvo} respondeu ${String(resposta.status)}: ${resposta.texto}`);
  }

  return resposta.corpo;
}

/** Lê pela rota real e devolve o corpo publicado. A falha levanta. */
async function ler(alvo: string): Promise<unknown> {
  const resposta = await pedir(alvo, { cookie });

  if (resposta.status !== 200) {
    throw new Error(`a leitura de ${alvo} respondeu ${String(resposta.status)}: ${resposta.texto}`);
  }

  return resposta.corpo;
}

/**
 * Quantos registros a coleção publica — lida **pela rota**, e não por consulta ao banco.
 *
 * O `total` do envelope é o que o consumidor enxerga, e é sobre ele que "nada foi gravado" tem de
 * valer. Uma contagem por conexão privilegiada mediria a tabela, e não o contrato.
 */
async function contar(dono: string): Promise<number> {
  const pagina = (await ler(`${colecao(dono)}?limite=1&incluirRetirados=true`)) as {
    total: number;
  };

  return pagina.total;
}

// ---------------------------------------------------------------------------------------------
// Cliente HTTP
// ---------------------------------------------------------------------------------------------

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
