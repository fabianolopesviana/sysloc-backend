/**
 * Cadastro de pessoa pelas rotas de `/v1/locadores`, `/v1/locatarios` e `/v1/fiadores` — CT-311,
 * CT-312, CT-313 e CT-332. T9 da fatia `cadastro-de-imoveis-e-pessoas`.
 *
 * ---------------------------------------------------------------------------
 * INVARIANTES
 * ---------------------------------------------------------------------------
 *
 * | Critério | Caso   | Invariante |
 * |---|---|---|
 * | CA-09 | CT-311 | Nos TRÊS papéis, uma segunda pessoa com o mesmo `documentoPrincipal` na MESMA
 * |       |        | empresa é recusada com `422 CAMPO_INVALIDO` nomeando `documentoPrincipal`
 * |       |        | (corpo INTEIRO afirmado, `detalhes.conflito` incluso) e **nada é gravado**: a
 * |       |        | contagem crua daquele papel na empresa A continua 1. A MESMA tentativa, da
 * |       |        | sessão de OUTRA empresa, é aceita com `201`. E a unicidade é **por papel**: o
 * |       |        | mesmo documento convive como locador, locatário e fiador da MESMA empresa —
 * |       |        | `201` nas três, com identificadores distintos. |
 * | CA-03 | CT-312 | Com o cadastro anterior RETIRADO de circulação, a segunda tentativa continua
 * | CA-09 |        | recusada; e o corpo dessa recusa é **profundamente DIFERENTE** do corpo da
 * |       |        | recusa por cadastro EM circulação, compartilhando `codigo` e `campo` e
 * |       |        | diferindo em `detalhes.conflito`. Nenhuma das duas grava linha: a contagem
 * |       |        | crua por documento permanece 1, contando também o retirado. |
 * | CA-08 | CT-313 | CPF e CNPJ com dígito verificador incorreto — e as demais formas inválidas —
 * |       |        | são recusados com `422 CAMPO_INVALIDO` nomeando `documentoPrincipal`, **na
 * |       |        | criação E na alteração**. Na criação a contagem crua não muda; na alteração a
 * |       |        | coluna `documento_principal` continua com o valor original, **caractere a
 * |       |        | caractere**. Os controles válidos passam: `201` no `POST` (CPF com
 * |       |        | `PESSOA_FISICA` e CNPJ com `PESSOA_JURIDICA`) e `200` no `PUT`, com a coluna
 * |       |        | passando a valer o documento novo. |
 * | CA-02 | CT-332 | Toda entrada inválida da superfície de cadastro nomeia o campo culpado e **não
 * | CA-07 |        | grava linha alguma**: obrigatório ausente (`documentoPrincipal`, `nome`), valor
 * | CA-16 |        | fora da lista fechada (`tipoPessoa`), chave desconhecida no corpo, `:id`
 * |       |        | malformado. UUID bem formado e inexistente responde
 * |       |        | `404 RECURSO_NAO_ENCONTRADO`. A contagem crua é idêntica antes e depois de cada
 * |       |        | tentativa, e o corpo de controle é aceito. |
 *
 * Rastreabilidade: `CA-09 → CT-311 (RN-04)`, `CA-03 → CT-312 (RN-04)`, `CA-09 → CT-312 (RN-04)`,
 * `CA-08 → CT-313 (RN-04)`, `CA-02 → CT-332 (RN-11)`, `CA-07 → CT-332 (RN-11)`,
 * `CA-16 → CT-332 (RN-12)`.
 *
 * ===========================================================================
 * DIVERGÊNCIAS DECLARADAS — leia antes de comparar com a §5.1 e a §6.6 da T9
 * ===========================================================================
 *
 * 1. **A §5.1 nomeia este arquivo `cadastro-de-pessoas.e2e.spec.ts` e os cards propõem
 *    `cadastros.e2e.spec.ts`.** Vence a §5.2 da task, pelo mesmo critério que a T6 aplicou: a lista
 *    de arquivos impactados é o contrato, e o nome do card é sugestão escrita antes dela. O nome
 *    escolhido também espelha o do arquivo irmão (`cadastro-de-imoveis.e2e.spec.ts`).
 * 2. **O card do `CT-312` prevê uma tabela de DUAS entidades (`imoveis/identificadorMunicipal` e
 *    `locadores/documentoPrincipal`) × dois estados; aqui ele exercita só a de cadastro de pessoa.**
 *    A metade de imóvel **já existe e já está provada**: é o `CT-310 (b)` de
 *    `cadastro-de-imoveis.e2e.spec.ts` (T6), que afirma os dois corpos de recusa do identificador
 *    municipal e a mudança do discriminador de `EM_CIRCULACAO` para `RETIRADO_DE_CIRCULACAO`.
 *    Reexercitá-la aqui seria `AP-26` (teste semanticamente duplicado) e custaria uma montagem de
 *    conjunto e imóvel para reprovar exatamente onde o outro arquivo já reprova. O que a comparação
 *    entre as duas entidades existe para pegar — **o nome do discriminador divergindo entre elas** —
 *    continua fechado pelas duas pontas: os dois arquivos afirmam o corpo INTEIRO por igualdade, com
 *    a chave `conflito` literal, e um nome escolhido por conveniência de qualquer um dos lados
 *    reprova no seu próprio arquivo.
 * 3. **O card do `CT-332` divide as variantes entre os dois arquivos E2E.** As de cômodo (metragem
 *    `-1`, metragem `null` explícita) e as de pai inexistente já vivem em
 *    `cadastro-de-imoveis.e2e.spec.ts` (T7 e T6), e as de conjunto em `CT-345` (T5). Aqui ficam as
 *    de **cadastro de pessoa**, que não tinham prova pela borda. A metragem `-1` continua sendo
 *    entrada inválida deliberada — é o `valor_sentinela_de_entrada` do golden, a marca de "não
 *    informado" do sistema antigo —, e é o `CT-332` daquele arquivo que a prova.
 *
 * ===========================================================================
 * O que faz cada caso provar o que ele diz provar
 * ===========================================================================
 *
 * **CT-311 — a tabela é sobre a ROTA, e o elenco é o mesmo.** Um teste parametrizado sobre os três
 * papéis, e não três testes: a implementação é declaradamente parametrizada (um serviço, um esquema,
 * três montagens), e a tabela é o que garante que as três montagens recebam a mesma prova. A
 * afirmação de que o MESMO documento convive entre papéis distintos é o que impede uma unicidade
 * global por engano — sem ela, uma implementação que varresse as três tabelas antes de gravar
 * passaria em todo o eixo negativo. A contagem de papéis exercitados é ela mesma afirmada em três:
 * uma tabela que encolhesse deixaria de provar o papel que saiu, em silêncio.
 *
 * **CT-312 — a comparação é ENTRE OS DOIS CORPOS, e não com uma constante.** Uma recusa idêntica nos
 * dois estados satisfaria a unicidade e violaria a decisão D4 (*"o usuário pode ser recusado por um
 * registro que não enxerga na lista"* — e por isso a recusa tem de dizer qual é o caminho). Nenhuma
 * outra asserção pega isso: é por igualdade profunda entre os dois corpos, exigindo que **difiram**,
 * que se detecta um discriminador constante. A retirada acontece pela ROTA real — escrever
 * `retirado_em` à mão provaria a unicidade sem provar que o caminho do produto chega lá.
 *
 * **CT-313 — as duas variantes medem coisas diferentes, e a segunda não pode reusar a asserção da
 * primeira.** Na criação, "nada foi gravado" é sobre a CONTAGEM lida depois de cada tentativa: um SUT
 * que gravasse e depois respondesse `422` passaria pelo status. Na alteração a contagem **não muda**,
 * e uma contagem inalterada ficaria verde num SUT que reescrevesse a coluna com o documento inválido
 * — por isso ela afirma o VALOR da coluna, caractere a caractere. O par de controle é obrigatório nos
 * dois caminhos: uma conferência que recusasse tudo passaria o eixo negativo inteiro e quebraria a
 * operação.
 *
 * **CT-332 — cada variante difere do corpo válido por UMA alteração.** É o que faz o campo nomeado na
 * recusa ser atribuível: se duas coisas estivessem erradas ao mesmo tempo, o campo devolvido não
 * diria nada sobre qual delas o esquema pegou. A contagem de variantes exercitadas é afirmada, pela
 * mesma razão da contagem de papéis do CT-311.
 *
 * ===========================================================================
 * MUTANTES EXECUTADOS — cada um reprova numa asserção diferente
 * ===========================================================================
 *
 * A `.claude/rules/testing-stack.md` e o P4 de `.claude/rules/nao-regressao.md` exigem demonstrar que
 * a prova **reprova** com o defeito reintroduzido. Aplicados ao fonte de produção, com a suíte
 * invocada pelo **script do pacote** (`pnpm --filter @sysloc/api test`), nunca por `vitest run`
 * avulso — este arquivo carrega `@sysloc/auth`, `@sysloc/db` e `@syslocbr/contracts` pela fronteira do
 * pacote, e um `vitest run` leria o `dist/` da compilação anterior. A âncora de cada um é
 * **simbólica**, nunca número de linha.
 *
 * **Controle** — árvore íntegra: `17 arquivos, 116 casos, 0 falhas`.
 *
 *   * **MT9-1 · `exigirDocumentoValido` removido de `CadastroDePessoaService.alterar()`**, mantido em
 *     `criar()` — o defeito exato que o Gate 2 da T8 nomeou como *sem prova em camada alguma*.
 *     Medido: `1 failed | 115 passed`, **só** no `CT-313` —
 *     `CPF com dígito verificador errado: expected 200 to be 422`, na variante de ALTERAÇÃO. É a
 *     medida literal de que a variante de criação, sozinha, não alcançava aquele ramo;
 *   * **MT9-2 · o discriminador constante em `EM_CIRCULACAO`** (`lerConflitoDoDocumento` passa a
 *     devolver sempre o primeiro valor) — medido: `1 failed | 115 passed`, no `CT-312`, exatamente na
 *     asserção que exige que os dois corpos **difiram**
 *     (`expected { codigo: 'CAMPO_INVALIDO', …(3) } to not deeply equal { … }`);
 *   * **MT9-3 · a parametrização quebra: os três controladores fixam o MESMO papel** (`PAPEL` de
 *     `locatario.controller.ts` e de `fiador.controller.ts` passa a ser `PAPEIS_DE_PESSOA[0]`, que é
 *     o modo de falha silencioso que o cabeçalho de `packages/db/src/cadastro-de-pessoa.ts` nomeia —
 *     *escrever na tabela errada*, sem que nada levante) — morto pelo `CT-311`, no **LADO QUE
 *     ACEITA**: a criação em `/v1/locatarios` cai na tabela do locador, colide com o documento que já
 *     está lá e responde `422` onde se espera `201`. Medido: `1 failed | 115 passed`, no `CT-311` —
 *     `expected { locador: 201, locatario: 422, …(1) } to deeply equal { locador: 201, locatario: 201, …(1) }`;
 *   * **MT9-4 · a tradução do `23505` removida do serviço** (a escrita volta a chamar `criarPessoa`
 *     direto, sem `gravarTraduzindoConflito`) — morto pelo `CT-311` e pelo `CT-312`, que passam a
 *     receber `500` onde esperam `422`. Ele é a **herança da T8** medida: sem a tradução, um documento
 *     repetido chega ao cliente como falha do serviço. Medido: `2 failed | 114 passed`, no `CT-311`
 *     (`locador: expected 500 to be 422`) e no `CT-312` (`expected 500 to be 422`). A forma literal do
 *     mutante não compila — `exigirGravada` fica sem uso —, e quem repetir a prova deve removê-la
 *     junto;
 *   * **MT9-7 · a armadilha da ADR-0018** — as seis rotas de circulação dos três papéis voltam a
 *     declarar `@ExigeChave(ACAO_DE_CIRCULACAO)` no método, isto é, **só a ação**. A prova que o mata
 *     **não pode ser comportamental**, e é aí que está o ponto: `MAPA_ACAO_TELA` associa a ação a
 *     `TELA:cadastros`, que é exatamente a área da classe destes controladores, de modo que a área
 *     exigida acaba sendo a mesma e nenhum caso deste arquivo muda de resultado. Quem o mata é o
 *     **`CT-355`** de `cobertura-de-autorizacao.e2e.spec.ts`, que varre a aplicação por ESTRUTURA e
 *     nomeia os seis manipuladores que exigem menos do que a classe deles. Medido: `1 failed | 115
 *     passed`, e a falha é literalmente
 *     `declaração de método que SUBSTITUI a da classe: FiadorController.recircular,
 *     FiadorController.retirar, LocadorController.recircular, LocadorController.retirar,
 *     LocatarioController.recircular, LocatarioController.retirar`. **Nenhum caso deste arquivo mudou
 *     de resultado**, e essa ausência é a medida da armadilha. A forma literal do mutante não compila
 *     (`ExigeChaves` fica sem uso); quem repetir a prova deve trocar também a importação.
 *
 * **Reversão** — os fontes foram restaurados e conferidos idênticos ao original por `diff`, e o
 * controle voltou a `116 passed`.
 *
 * ===========================================================================
 * Precondição privilegiada — as DUAS chaves, na ordem que a coerência exige
 * ===========================================================================
 *
 * As sessões que agem são de pessoas `USUARIO_EMPRESA` **da carga**, abertas pela rota pública de
 * entrada. A matriz do perfil delas é o piso (`TELA:resumo`), de modo que as chaves abaixo **faltam
 * de fato** e a concessão por `escreverAjustes` é precondição real, e não ruído:
 *
 *   * `TELA:cadastros` — a área que a classe dos três controladores exige nas dezoito rotas;
 *   * `ACAO:excluir_cadastro` — a ação sensível que as seis rotas de circulação exigem além dela.
 *
 * As duas são **coerentes** por construção: `MAPA_ACAO_TELA['ACAO:excluir_cadastro']` é
 * `TELA:cadastros`, e `validarCoerenciaDeAjustes` recusaria a ação órfã. O efetivo é **afirmado** por
 * `GET /v1/sessao` antes do fluxo, nas duas sessões: sem essa linha, um `403` nas rotas abaixo seria
 * indistinguível de um defeito delas. Nada é acrescentado a `apps/api/src/**` para que estas provas
 * existam (Iron Law #6), nenhuma chave é concedida por escrita direta na tabela, e **nenhuma rota
 * recebe `empresaId`** — o que separa uma sessão da outra é o cookie.
 *
 * ===========================================================================
 * De onde vêm o banco, a fila e a credencial (ADR-0006)
 * ===========================================================================
 *
 * De instâncias efêmeras próprias. Nenhuma coordenada de conexão é lida do ambiente: o ambiente do
 * processo é MONTADO a partir do que os helpers devolvem. A aplicação é a **real** (`criarAplicacao`,
 * de `src/main.ts`). A porta é **reservada** (trava atômica), e não dinâmica, porque o arcabouço
 * confere a origem das requisições com cookie contra o endereço base, composto a partir da porta
 * CONFIGURADA.
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
import { PREFIXO_DAS_ROTAS_DE_IDENTIDADE } from '../src/autenticacao/autenticacao.module.ts';
import { CAMINHO_DA_SESSAO } from '../src/autenticacao/sessao.controller.ts';
import { CAMINHO_DOS_FIADORES } from '../src/cadastros/fiador.controller.ts';
import { CAMINHO_DOS_LOCADORES } from '../src/cadastros/locador.controller.ts';
import { CAMINHO_DOS_LOCATARIOS } from '../src/cadastros/locatario.controller.ts';
import { ENDERECO_DE_ESCUTA, PREFIXO_DE_VERSAO } from '../src/configuracao/ambiente.ts';
import { criarAplicacao } from '../src/main.ts';

/** Limite da montagem: banco migrado, semente com credencial, fila e a aplicação real. */
const LIMITE_DE_MONTAGEM_MS = 240_000;

/** Limite de um caso que atravessa HTTP e banco várias vezes. */
const LIMITE_CASO_MS = 60_000;

/** Sufixo do nome do cookie de sessão do arcabouço — o prefixo vem da configuração. */
const SUFIXO_DO_COOKIE_DE_SESSAO = 'session_token';

/** A rota de entrada, composta a partir do prefixo real. Nunca escrita à mão. */
const ROTA_DE_ENTRADA = `${PREFIXO_DAS_ROTAS_DE_IDENTIDADE}/sign-in/email`;

/** Caminho, relativo à raiz, da rota de sessão do produto. Composto, nunca escrito à mão. */
const CAMINHO_DA_SESSAO_CORRENTE = `/${PREFIXO_DE_VERSAO}/${CAMINHO_DA_SESSAO}`;

/**
 * Um papel sob teste: o caminho da coleção e a tabela onde a leitura crua confere o estado.
 *
 * O caminho é composto a partir da constante que o próprio controlador exporta — nunca escrito à mão,
 * pela mesma razão dos inventários de `cobertura-de-autorizacao.e2e.spec.ts`: um renomeio que o
 * compilador não visse deixaria a suíte exercitando uma rota que não existe mais.
 *
 * O nome da tabela é literal e declarado **aqui**, e não importado de `@sysloc/db`: ele não sai
 * daquele pacote por decisão (§11.2), e derivá-lo do SUT faria a conferência crua concordar com o
 * que ela existe para auditar.
 */
interface PapelSobTeste {
  readonly rotulo: string;
  readonly colecao: string;
  readonly tabela: string;
}

/** Os TRÊS papéis, na ordem em que a união fechada de `@sysloc/db` os declara. */
const PAPEIS: readonly PapelSobTeste[] = [
  {
    rotulo: 'locador',
    colecao: `/${PREFIXO_DE_VERSAO}/${CAMINHO_DOS_LOCADORES}`,
    tabela: 'negocio.locador',
  },
  {
    rotulo: 'locatario',
    colecao: `/${PREFIXO_DE_VERSAO}/${CAMINHO_DOS_LOCATARIOS}`,
    tabela: 'negocio.locatario',
  },
  {
    rotulo: 'fiador',
    colecao: `/${PREFIXO_DE_VERSAO}/${CAMINHO_DOS_FIADORES}`,
    tabela: 'negocio.fiador',
  },
];

/** O papel usado pelos casos que não são parametrizados — o primeiro da união. */
const LOCADOR = PAPEIS[0] as PapelSobTeste;

/**
 * As mensagens canônicas de cada código, escritas por extenso.
 *
 * Literais, e **não** lidas de `MENSAGEM_POR_CODIGO`: os casos comparam corpos inteiros por
 * igualdade, e derivá-los da mesma tabela que o SUT usa faria a asserção concordar consigo mesma.
 */
const MENSAGEM_DE_CAMPO_INVALIDO = 'requisição inválida';
const MENSAGEM_DE_NAO_ENCONTRADO = 'recurso não encontrado';

/** O campo culpado da recusa por documento — contrato publicado, escrito por extenso. */
const CAMPO_DO_DOCUMENTO = 'documentoPrincipal';

/**
 * O nome do discriminador do conflito, dentro de `detalhes`.
 *
 * Literal, e fixado pela §10.1 da tech spec. É o MESMO nome que `cadastro-de-imoveis.e2e.spec.ts`
 * afirma para o identificador municipal — a divergência 2 do cabeçalho registra por que a comparação
 * entre as duas entidades acontece por essa coincidência de literais, e não por um caso que monte as
 * duas superfícies.
 */
const DISCRIMINADOR_DO_CONFLITO = 'conflito';

/** Os dois estados possíveis do registro em conflito — o par que discrimina reativar de recadastrar. */
const CONFLITO_EM_CIRCULACAO = 'EM_CIRCULACAO';
const CONFLITO_RETIRADO = 'RETIRADO_DE_CIRCULACAO';

/**
 * As chaves do arranjo: a área da classe e a ação sensível das rotas de circulação.
 *
 * Literais, e não derivadas da exigência declarada nos controladores: derivá-las faria a asserção
 * concordar com o SUT, e trocar a exigência da classe deixaria de reprovar caso algum.
 */
const CHAVES_DO_ARRANJO: readonly ChaveDoCatalogo[] = ['TELA:cadastros', 'ACAO:excluir_cadastro'];

/** A área afirmada, uma a uma, no efetivo — a precondição que não se supõe. */
const AREA_DO_CADASTRO: ChaveDoCatalogo = 'TELA:cadastros';
const ACAO_DE_CIRCULACAO: ChaveDoCatalogo = 'ACAO:excluir_cadastro';

// ---------------------------------------------------------------------------------------------
// Documentos — um por propósito (AP-08), todos com dígito verificador conferido
// ---------------------------------------------------------------------------------------------

/** O CPF que o `CT-311` faz existir nos três papéis da empresa A e também na empresa B. */
const DOCUMENTO_DISPUTADO = '10000013773';

/** Os dois documentos do `CT-312`: um cenário com o anterior em circulação, outro com o retirado. */
const DOCUMENTO_DO_CENARIO_EM_CIRCULACAO = '10000027480';
const DOCUMENTO_DO_CENARIO_RETIRADO = '10000041122';

/** Os controles válidos do `CT-313`, um por tipo de pessoa. */
const CPF_DE_CONTROLE = '10000054887';
const CNPJ_DE_CONTROLE = '10000137000108';

/** A variante de ALTERAÇÃO do `CT-313`: o documento com que o cadastro nasce e o do par de controle. */
const DOCUMENTO_ORIGINAL_DA_ALTERACAO = '10000068594';
const DOCUMENTO_NOVO_E_VALIDO = '10000082236';

/** O corpo de controle do `CT-332`. */
const DOCUMENTO_DO_CONTROLE_DE_ENTRADA = '10000095990';

/** Um UUID bem formado que não corresponde a cadastro algum — o controle do `404`. */
const UUID_INEXISTENTE = '00000000-0000-4000-8000-0000000000ff';

/** Um valor que não é UUID — o controle do `422` com `campo: 'id'`. */
const IDENTIFICADOR_MALFORMADO = 'nao-e-uuid';

/**
 * Um documento inválido sob teste, com o motivo por extenso.
 *
 * O rótulo entra na mensagem da falha, e é ele que diz QUAL forma inválida escapou.
 */
interface DocumentoInvalido {
  readonly rotulo: string;
  readonly valor: string;
  readonly tipoPessoa: string;
}

/**
 * As oito formas inválidas de documento, exercitadas na CRIAÇÃO.
 *
 * As duas primeiras de cada tipo são as que exercitam o **dígito verificador** — isto é, o serviço; a
 * cadeia vazia e a cadeia com letras morrem antes, no `min(1)` do esquema de entrada, e por isso não
 * bastam sozinhas: elas provariam a camada errada. É a razão de a variante de ALTERAÇÃO usar
 * **apenas** as de DV.
 */
const DOCUMENTOS_INVALIDOS: readonly DocumentoInvalido[] = [
  {
    rotulo: 'CPF com dígito verificador errado',
    valor: '52998224724',
    tipoPessoa: 'PESSOA_FISICA',
  },
  { rotulo: 'CPF de dígitos repetidos', valor: '11111111111', tipoPessoa: 'PESSOA_FISICA' },
  { rotulo: 'CPF com 10 dígitos', valor: '1234567890', tipoPessoa: 'PESSOA_FISICA' },
  {
    rotulo: 'CNPJ com dígito verificador errado',
    valor: '11222333000182',
    tipoPessoa: 'PESSOA_JURIDICA',
  },
  {
    rotulo: 'CNPJ de dígitos repetidos',
    valor: '11111111111111',
    tipoPessoa: 'PESSOA_JURIDICA',
  },
  { rotulo: 'CNPJ com 13 dígitos', valor: '1122233300018', tipoPessoa: 'PESSOA_JURIDICA' },
  { rotulo: 'cadeia vazia', valor: '', tipoPessoa: 'PESSOA_FISICA' },
  { rotulo: 'cadeia só com letras e pontuação', valor: 'abc.def-gh', tipoPessoa: 'PESSOA_FISICA' },
];

/**
 * As DUAS formas de DV inválido exercitadas na ALTERAÇÃO — o "no mínimo" do passo 6 do card.
 *
 * Derivadas da tabela acima por índice, e não redigitadas: as duas listas descrevem o mesmo fato, e
 * duas escritas ficariam livres para divergir. A restrição a DV é conteúdo: as demais formas morrem
 * no esquema de entrada e, no `PUT`, provariam a camada errada.
 */
const DOCUMENTOS_INVALIDOS_POR_DV: readonly DocumentoInvalido[] = DOCUMENTOS_INVALIDOS.filter(
  (documento) => documento.rotulo.includes('dígito verificador'),
);

/**
 * A pessoa que age na empresa A: `USUARIO_EMPRESA` **da carga**.
 *
 * Ela tem senha definitiva e nenhuma exigência pendente, então a sessão dela nasce **plena** com uma
 * entrada só — e o perfil dela **não** concede `TELA:cadastros`, que é o que torna a concessão do
 * arranjo uma precondição de verdade.
 */
const QUEM_AGE = pessoaSemeada('usuario.a@exemplo.com.br');

/**
 * A pessoa que age na empresa B: `USUARIO_EMPRESA` **da carga**, com o mesmo estado inicial.
 *
 * Ela é a outra ponta da prova de isolamento do `CT-311`. Nenhuma rota recebe a empresa dela: o que
 * separa uma sessão da outra é o cookie, e é a guarda que publica o contexto a partir da sessão.
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

  // Precondição AFIRMADA, e não suposta, nas DUAS sessões: sem estas linhas, um `403` nas rotas
  // abaixo seria indistinguível de um defeito delas.
  for (const credencial of [cookie, cookieDeB]) {
    const sessao = (await pedir(CAMINHO_DA_SESSAO_CORRENTE, { cookie: credencial }))
      .corpo as SessaoPublicada;
    expect(sessao.telas).toContain(AREA_DO_CADASTRO);
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

describe('cadastro de pessoa pelas rotas dos três papéis (T9)', () => {
  it(
    'CT-311 — o documento não se repete no papel dentro da empresa, e se repete entre papéis e entre empresas',
    async () => {
      // --- O lado que ACEITA: o MESMO documento, nos três papéis da MESMA empresa ---------------
      //
      // Sem esta metade, uma implementação que varresse as três tabelas antes de gravar — a leitura
      // ingênua da regra — passaria em todo o eixo negativo abaixo. Os identificadores são
      // colecionados e afirmados DISTINTOS: uma porta que devolvesse sempre a mesma linha passaria
      // pelo laço.
      const criacoes: Record<string, number> = {};
      const identificadores: string[] = [];

      for (const papel of PAPEIS) {
        const criacao = await pedir(papel.colecao, {
          metodo: 'POST',
          cookie,
          corpo: corpoDePessoa(DOCUMENTO_DISPUTADO, { nome: 'Pessoa Tríplice' }),
        });

        criacoes[papel.rotulo] = criacao.status;
        identificadores.push((criacao.corpo as PessoaPublicada).id);
      }

      expect(criacoes).toEqual({ locador: 201, locatario: 201, fiador: 201 });
      expect(new Set(identificadores).size).toBe(PAPEIS.length);

      // --- O lado que RECUSA: repetir no MESMO papel, na MESMA empresa --------------------------
      const recusas: Record<string, unknown> = {};
      const contagens: Record<string, number> = {};

      for (const papel of PAPEIS) {
        const repetida = await pedir(papel.colecao, {
          metodo: 'POST',
          cookie,
          corpo: corpoDePessoa(DOCUMENTO_DISPUTADO, { nome: 'Pessoa Repetida' }),
        });

        expect(repetida.status, papel.rotulo).toBe(422);
        recusas[papel.rotulo] = repetida.corpo;

        // Contagem CRUA depois de cada tentativa: um SUT que gravasse e só então respondesse `422`
        // passaria pelo status e reprovaria aqui.
        contagens[papel.rotulo] = await contarPorDocumento(
          papel.tabela,
          EMPRESA_A.id,
          DOCUMENTO_DISPUTADO,
        );
      }

      // Os três corpos INTEIROS por igualdade, e não a presença do campo: é o corpo publicado que o
      // cliente usa para destacar o campo do formulário, e `detalhes.conflito` faz parte dele.
      const recusaEsperada = {
        codigo: CodigoErro.CAMPO_INVALIDO,
        mensagem: MENSAGEM_DE_CAMPO_INVALIDO,
        campo: CAMPO_DO_DOCUMENTO,
        detalhes: { [DISCRIMINADOR_DO_CONFLITO]: CONFLITO_EM_CIRCULACAO },
      };
      expect(recusas).toEqual({
        locador: recusaEsperada,
        locatario: recusaEsperada,
        fiador: recusaEsperada,
      });

      expect(contagens).toEqual({ locador: 1, locatario: 1, fiador: 1 });

      // --- A MESMA tentativa, da sessão de OUTRA empresa: aceita ---------------------------------
      //
      // Nenhuma rota recebe `empresaId`: o que muda é o cookie, e é a guarda que publica o contexto.
      const criacoesEmB: Record<string, number> = {};

      for (const papel of PAPEIS) {
        const emB = await pedir(papel.colecao, {
          metodo: 'POST',
          cookie: cookieDeB,
          corpo: corpoDePessoa(DOCUMENTO_DISPUTADO, { nome: 'Pessoa da Outra Empresa' }),
        });

        criacoesEmB[papel.rotulo] = emB.status;
      }

      expect(criacoesEmB).toEqual({ locador: 201, locatario: 201, fiador: 201 });

      // --- A contagem de PAPÉIS exercitados, afirmada ------------------------------------------
      //
      // Uma tabela que encolhesse deixaria de provar o papel que saiu, em silêncio.
      expect(PAPEIS.map((papel) => papel.rotulo)).toEqual(['locador', 'locatario', 'fiador']);
    },
    LIMITE_CASO_MS,
  );

  it(
    'CT-312 — a unicidade alcança o retirado, e a recusa DIFERE da de um cadastro em circulação',
    async () => {
      // --- Cenário 1: o cadastro anterior está EM CIRCULAÇÃO --------------------------------------
      const emCirculacao = await criarLocador(
        DOCUMENTO_DO_CENARIO_EM_CIRCULACAO,
        'Pessoa Em Circulação',
      );
      const recusaComEmCirculacao = await pedir(LOCADOR.colecao, {
        metodo: 'POST',
        cookie,
        corpo: corpoDePessoa(DOCUMENTO_DO_CENARIO_EM_CIRCULACAO, { nome: 'Segunda Tentativa' }),
      });

      // --- Cenário 2: o cadastro anterior foi RETIRADO, pela ROTA real ---------------------------
      const retirado = await criarLocador(DOCUMENTO_DO_CENARIO_RETIRADO, 'Pessoa Retirada');
      const retirada = await pedir(`${LOCADOR.colecao}/${retirado.id}/retirada`, {
        metodo: 'POST',
        cookie,
        corpo: {},
      });
      expect(retirada.status).toBe(200);
      expect((retirada.corpo as PessoaPublicada).retiradoEm).not.toBeNull();

      // Âncora do ESTADO: o retirado sumiu da listagem padrão. Sem ela, o cenário 2 seria
      // indistinguível do cenário 1 caso a retirada não tivesse acontecido.
      const listagemPadrao = await listarIdentificadores(LOCADOR.colecao, false);
      expect(listagemPadrao.has(retirado.id)).toBe(false);
      expect(listagemPadrao.has(emCirculacao.id)).toBe(true);

      const recusaComRetirado = await pedir(LOCADOR.colecao, {
        metodo: 'POST',
        cookie,
        corpo: corpoDePessoa(DOCUMENTO_DO_CENARIO_RETIRADO, { nome: 'Tentativa Sobre Retirado' }),
      });

      // --- As duas recusas: mesmo `codigo` e `campo`, corpos INTEIROS DIFERENTES ------------------
      expect(recusaComEmCirculacao.status).toBe(422);
      expect(recusaComRetirado.status).toBe(422);

      const corpoEmCirculacao = recusaComEmCirculacao.corpo as RecusaPublicada;
      const corpoRetirado = recusaComRetirado.corpo as RecusaPublicada;

      expect(corpoEmCirculacao.codigo).toBe(corpoRetirado.codigo);
      expect(corpoEmCirculacao.campo).toBe(corpoRetirado.campo);

      // **A asserção que discrimina**: uma recusa idêntica nos dois estados satisfaria a unicidade e
      // violaria a decisão D4. Nenhuma outra asserção do arquivo pega isso.
      expect(corpoEmCirculacao).not.toEqual(corpoRetirado);

      // E os dois corpos INTEIROS, um a um, para que a falha diga QUAL deles saiu do contrato — e não
      // apenas que os dois pararam de diferir.
      expect(corpoEmCirculacao).toEqual({
        codigo: CodigoErro.CAMPO_INVALIDO,
        mensagem: MENSAGEM_DE_CAMPO_INVALIDO,
        campo: CAMPO_DO_DOCUMENTO,
        detalhes: { [DISCRIMINADOR_DO_CONFLITO]: CONFLITO_EM_CIRCULACAO },
      });
      expect(corpoRetirado).toEqual({
        codigo: CodigoErro.CAMPO_INVALIDO,
        mensagem: MENSAGEM_DE_CAMPO_INVALIDO,
        campo: CAMPO_DO_DOCUMENTO,
        detalhes: { [DISCRIMINADOR_DO_CONFLITO]: CONFLITO_RETIRADO },
      });

      // --- Nenhuma das duas gravou linha ---------------------------------------------------------
      //
      // A contagem é CRUA e sem recorte de circulação: uma contagem que aplicasse o predicado
      // esconderia justamente a linha retirada que ela quer contar.
      expect(
        await contarPorDocumento(LOCADOR.tabela, EMPRESA_A.id, DOCUMENTO_DO_CENARIO_EM_CIRCULACAO),
      ).toBe(1);
      expect(
        await contarPorDocumento(LOCADOR.tabela, EMPRESA_A.id, DOCUMENTO_DO_CENARIO_RETIRADO),
      ).toBe(1);
    },
    LIMITE_CASO_MS,
  );

  it(
    'CT-313 — documento inválido é recusado antes de qualquer escrita, na CRIAÇÃO e na ALTERAÇÃO',
    async () => {
      // =========================================================================================
      // Variante de CRIAÇÃO
      // =========================================================================================
      const contagemInicial = await contarTabela(LOCADOR.tabela, EMPRESA_A.id);
      const recusasDaCriacao: Record<string, unknown> = {};
      const contagensDepois: Record<string, number> = {};

      for (const invalido of DOCUMENTOS_INVALIDOS) {
        const tentativa = await pedir(LOCADOR.colecao, {
          metodo: 'POST',
          cookie,
          corpo: corpoDePessoa(invalido.valor, {
            nome: 'Pessoa Com Documento Inválido',
            tipoPessoa: invalido.tipoPessoa,
          }),
        });

        expect(tentativa.status, invalido.rotulo).toBe(422);
        recusasDaCriacao[invalido.rotulo] = tentativa.corpo;

        // Depois de CADA tentativa: um SUT que gravasse e só então respondesse `422` passaria pelo
        // status e reprovaria aqui.
        contagensDepois[invalido.rotulo] = await contarTabela(LOCADOR.tabela, EMPRESA_A.id);
      }

      const recusaDeDocumento = {
        codigo: CodigoErro.CAMPO_INVALIDO,
        mensagem: MENSAGEM_DE_CAMPO_INVALIDO,
        campo: CAMPO_DO_DOCUMENTO,
      };
      expect(recusasDaCriacao).toEqual(
        Object.fromEntries(
          DOCUMENTOS_INVALIDOS.map((invalido) => [invalido.rotulo, recusaDeDocumento]),
        ),
      );
      expect(contagensDepois).toEqual(
        Object.fromEntries(
          DOCUMENTOS_INVALIDOS.map((invalido) => [invalido.rotulo, contagemInicial]),
        ),
      );

      // --- Os DOIS controles válidos da criação, um por tipo de pessoa ---------------------------
      //
      // Obrigatórios: uma conferência que recusasse tudo passaria o eixo negativo inteiro e quebraria
      // a operação. É a mesma lição de `VALORES_INVALIDOS` no CT-011.
      const comCpf = await pedir(LOCADOR.colecao, {
        metodo: 'POST',
        cookie,
        corpo: corpoDePessoa(CPF_DE_CONTROLE, {
          nome: 'Pessoa Física de Controle',
          tipoPessoa: 'PESSOA_FISICA',
        }),
      });
      expect(comCpf.status).toBe(201);
      expect((comCpf.corpo as PessoaPublicada).documentoPrincipal).toBe(CPF_DE_CONTROLE);

      const comCnpj = await pedir(LOCADOR.colecao, {
        metodo: 'POST',
        cookie,
        corpo: corpoDePessoa(CNPJ_DE_CONTROLE, {
          nome: 'Pessoa Jurídica de Controle',
          tipoPessoa: 'PESSOA_JURIDICA',
          rg: null,
        }),
      });
      expect(comCnpj.status).toBe(201);
      expect((comCnpj.corpo as PessoaPublicada).documentoPrincipal).toBe(CNPJ_DE_CONTROLE);

      // =========================================================================================
      // Variante de ALTERAÇÃO — o item que o Gate 2 da T8 nomeou como sem prova em camada alguma
      // =========================================================================================
      //
      // A contagem NÃO serve aqui: o `PUT` não a muda, e uma contagem inalterada ficaria verde num
      // SUT que reescrevesse a coluna com o documento inválido. O que este bloco afirma é o VALOR da
      // coluna, lido cru, caractere a caractere.
      const alvo = await criarLocador(DOCUMENTO_ORIGINAL_DA_ALTERACAO, 'Pessoa Alterável');
      const documentoOriginal = await lerDocumentoCru(LOCADOR.tabela, EMPRESA_A.id, alvo.id);
      expect(documentoOriginal).toBe(DOCUMENTO_ORIGINAL_DA_ALTERACAO);

      const recusasDaAlteracao: Record<string, unknown> = {};
      const colunaDepois: Record<string, string | undefined> = {};

      for (const invalido of DOCUMENTOS_INVALIDOS_POR_DV) {
        const tentativa = await pedir(`${LOCADOR.colecao}/${alvo.id}`, {
          metodo: 'PUT',
          cookie,
          // Só o `documentoPrincipal` muda em relação ao corpo com que o cadastro nasceu — o `PUT` é
          // completo, e alterar mais de um campo tornaria o campo nomeado na recusa inatribuível.
          corpo: corpoDePessoa(invalido.valor, {
            nome: 'Pessoa Alterável',
            tipoPessoa: invalido.tipoPessoa,
          }),
        });

        expect(tentativa.status, invalido.rotulo).toBe(422);
        recusasDaAlteracao[invalido.rotulo] = tentativa.corpo;
        colunaDepois[invalido.rotulo] = await lerDocumentoCru(
          LOCADOR.tabela,
          EMPRESA_A.id,
          alvo.id,
        );
      }

      // A bateria é de DV, e não de forma: cadeia vazia e cadeia com letras morrem no `min(1)` do
      // esquema de entrada e provariam a camada errada. Afirmar a cardinalidade impede a tabela de
      // encolher para zero e o laço de não exercitar nada.
      expect(DOCUMENTOS_INVALIDOS_POR_DV.map((invalido) => invalido.rotulo)).toEqual([
        'CPF com dígito verificador errado',
        'CNPJ com dígito verificador errado',
      ]);
      expect(recusasDaAlteracao).toEqual(
        Object.fromEntries(
          DOCUMENTOS_INVALIDOS_POR_DV.map((invalido) => [invalido.rotulo, recusaDeDocumento]),
        ),
      );
      expect(colunaDepois).toEqual(
        Object.fromEntries(
          DOCUMENTOS_INVALIDOS_POR_DV.map((invalido) => [
            invalido.rotulo,
            DOCUMENTO_ORIGINAL_DA_ALTERACAO,
          ]),
        ),
      );

      // --- O par de controle da ALTERAÇÃO: documento VÁLIDO diferente passa, e a coluna muda ------
      //
      // Sem ele, a variante inteira ficaria verde sobre um `PUT` que recusasse TODO documento.
      const alteracaoValida = await pedir(`${LOCADOR.colecao}/${alvo.id}`, {
        metodo: 'PUT',
        cookie,
        corpo: corpoDePessoa(DOCUMENTO_NOVO_E_VALIDO, { nome: 'Pessoa Alterável' }),
      });

      expect(alteracaoValida.status).toBe(200);
      expect((alteracaoValida.corpo as PessoaPublicada).documentoPrincipal).toBe(
        DOCUMENTO_NOVO_E_VALIDO,
      );
      expect(await lerDocumentoCru(LOCADOR.tabela, EMPRESA_A.id, alvo.id)).toBe(
        DOCUMENTO_NOVO_E_VALIDO,
      );
    },
    LIMITE_CASO_MS,
  );

  it(
    'CT-332 — entrada inválida da superfície de cadastro nomeia o campo culpado, e nada é gravado',
    async () => {
      const contagemInicial = await contarTabela(LOCADOR.tabela, EMPRESA_A.id);
      const obtidos: Record<string, { status: number; corpo: unknown; contagem: number }> = {};

      for (const recusa of RECUSAS_DE_ENTRADA) {
        const resposta = await pedir(recusa.alvo(LOCADOR.colecao), {
          metodo: recusa.metodo ?? 'GET',
          cookie,
          ...(recusa.corpo === undefined ? {} : { corpo: recusa.corpo }),
        });

        obtidos[recusa.rotulo] = {
          status: resposta.status,
          corpo: resposta.corpo,
          contagem: await contarTabela(LOCADOR.tabela, EMPRESA_A.id),
        };
      }

      // O retrato INTEIRO da tabela numa asserção só: status, corpo e contagem por variante. A falha
      // nomeia a linha, e a contagem por linha é o que separa "recusou" de "recusou e não gravou".
      expect(obtidos).toEqual(
        Object.fromEntries(
          RECUSAS_DE_ENTRADA.map((recusa) => [
            recusa.rotulo,
            { status: recusa.status, corpo: recusa.esperado, contagem: contagemInicial },
          ]),
        ),
      );

      // A contagem de variantes exercitadas, afirmada: uma tabela que encolhesse deixaria de provar a
      // variante que saiu, em silêncio.
      expect(RECUSAS_DE_ENTRADA.map((recusa) => recusa.rotulo)).toEqual([
        'sem_documento',
        'sem_nome',
        'tipo_pessoa_fora_da_lista',
        'chave_extra',
        'id_malformado',
        'id_inexistente',
      ]);

      // --- O CONTROLE: o corpo válido de referência é aceito -------------------------------------
      //
      // Cada variante acima difere DELE por uma única alteração; sem esta linha, um esquema que
      // recusasse tudo passaria em todas as anteriores.
      const controle = await pedir(LOCADOR.colecao, {
        metodo: 'POST',
        cookie,
        corpo: corpoDePessoa(DOCUMENTO_DO_CONTROLE_DE_ENTRADA, { nome: 'Pessoa de Controle' }),
      });

      expect(controle.status).toBe(201);
      expect(await contarTabela(LOCADOR.tabela, EMPRESA_A.id)).toBe(contagemInicial + 1);
    },
    LIMITE_CASO_MS,
  );
});

// ---------------------------------------------------------------------------------------------
// As recusas de entrada — tabela declarada, com o desfecho de cada linha escrito por extenso
// ---------------------------------------------------------------------------------------------

interface RecusaDeEntrada {
  readonly rotulo: string;
  readonly metodo?: string;
  readonly alvo: (colecao: string) => string;
  readonly corpo?: Record<string, unknown>;
  readonly status: number;
  readonly esperado: Record<string, unknown>;
}

/** A recusa canônica de campo, com o campo nomeado por linha. */
function campoInvalido(campo: string): Record<string, unknown> {
  return {
    codigo: CodigoErro.CAMPO_INVALIDO,
    mensagem: MENSAGEM_DE_CAMPO_INVALIDO,
    campo,
  };
}

/**
 * Cada variante difere do corpo válido de referência por **UMA** alteração.
 *
 * É o que faz o campo nomeado na recusa ser **atribuível**: com duas coisas erradas ao mesmo tempo, o
 * campo devolvido não diria nada sobre qual delas o esquema pegou.
 */
const RECUSAS_DE_ENTRADA: readonly RecusaDeEntrada[] = [
  {
    rotulo: 'sem_documento',
    metodo: 'POST',
    alvo: (colecao) => colecao,
    corpo: semChave(corpoDePessoa(DOCUMENTO_DO_CONTROLE_DE_ENTRADA), 'documentoPrincipal'),
    status: 422,
    esperado: campoInvalido('documentoPrincipal'),
  },
  {
    rotulo: 'sem_nome',
    metodo: 'POST',
    alvo: (colecao) => colecao,
    corpo: semChave(corpoDePessoa(DOCUMENTO_DO_CONTROLE_DE_ENTRADA), 'nome'),
    status: 422,
    esperado: campoInvalido('nome'),
  },
  {
    rotulo: 'tipo_pessoa_fora_da_lista',
    metodo: 'POST',
    alvo: (colecao) => colecao,
    corpo: corpoDePessoa(DOCUMENTO_DO_CONTROLE_DE_ENTRADA, { tipoPessoa: 'PESSOA_ESTRANGEIRA' }),
    status: 422,
    esperado: campoInvalido('tipoPessoa'),
  },
  {
    // O campo publicado é o `campoPadrao` deste ponto de chamada — o Zod reporta chave desconhecida
    // de um `strictObject` com caminho vazio. O que a linha prova é que o corpo é FECHADO: uma chave
    // que ninguém declarou recusa a requisição inteira em vez de ser ignorada em silêncio, que é o
    // caminho por onde a fuga de tenant entraria.
    rotulo: 'chave_extra',
    metodo: 'POST',
    alvo: (colecao) => colecao,
    corpo: corpoDePessoa(DOCUMENTO_DO_CONTROLE_DE_ENTRADA, { empresaId: UUID_INEXISTENTE }),
    status: 422,
    esperado: campoInvalido('corpo'),
  },
  {
    rotulo: 'id_malformado',
    alvo: (colecao) => `${colecao}/${IDENTIFICADOR_MALFORMADO}`,
    status: 422,
    esperado: campoInvalido('id'),
  },
  {
    rotulo: 'id_inexistente',
    alvo: (colecao) => `${colecao}/${UUID_INEXISTENTE}`,
    status: 404,
    esperado: {
      codigo: CodigoErro.RECURSO_NAO_ENCONTRADO,
      mensagem: MENSAGEM_DE_NAO_ENCONTRADO,
    },
  },
];

// ---------------------------------------------------------------------------------------------
// Arranjo do cenário, pelas ROTAS REAIS
// ---------------------------------------------------------------------------------------------

/**
 * O corpo completo de um cadastro de pessoa, com o documento por parâmetro.
 *
 * **`empresaId` não aparece**, e a ausência é o ponto: a empresa sai da sessão, e o `strictObject` do
 * contrato recusaria a chave. Os `ajustes` existem para os campos que os casos variam, e mantê-los
 * abertos evita um segundo construtor quase igual.
 */
function corpoDePessoa(
  documentoPrincipal: string,
  ajustes: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    nome: 'Ana Alves',
    tipoPessoa: 'PESSOA_FISICA',
    documentoPrincipal,
    rg: '123456789',
    email: 'ana@exemplo.com.br',
    telefone: '11999990000',
    logradouro: 'Rua das Acácias',
    numero: '100',
    complemento: null,
    bairro: 'Centro',
    cidade: 'São Paulo',
    estado: 'SP',
    cep: '01000000',
    ...ajustes,
  };
}

/** O mesmo corpo, **sem** uma chave — a alteração única das variantes de obrigatório ausente. */
function semChave(corpo: Record<string, unknown>, chave: string): Record<string, unknown> {
  const { [chave]: _removida, ...resto } = corpo;
  return resto;
}

/**
 * Cria um locador pela ROTA real, ou levanta nomeando a recusa.
 *
 * A falha levanta em vez de devolver: uma precondição que falhasse em silêncio faria o caso reprovar
 * numa asserção adiante, apontando para o lugar errado.
 */
async function criarLocador(documentoPrincipal: string, nome: string): Promise<PessoaPublicada> {
  const criacao = await pedir(LOCADOR.colecao, {
    metodo: 'POST',
    cookie,
    corpo: corpoDePessoa(documentoPrincipal, { nome }),
  });

  if (criacao.status !== 201) {
    throw new Error(`a criação de "${nome}" respondeu ${String(criacao.status)}: ${criacao.texto}`);
  }

  return criacao.corpo as PessoaPublicada;
}

/** Os identificadores que a listagem devolve, com ou sem os retirados. */
async function listarIdentificadores(
  colecao: string,
  incluirRetirados: boolean,
): Promise<Set<string>> {
  const alvo = incluirRetirados
    ? `${colecao}?limite=200&incluirRetirados=true`
    : `${colecao}?limite=200`;
  const listagem = await pedir(alvo, { cookie });

  if (listagem.status !== 200) {
    throw new Error(`a listagem respondeu ${String(listagem.status)}: ${listagem.texto}`);
  }

  return new Set((listagem.corpo as PaginaPublicada).itens.map((item) => item.id));
}

// ---------------------------------------------------------------------------------------------
// Observação de estado persistido — pela API pública do pacote, sob o contexto de tenant
// ---------------------------------------------------------------------------------------------

/**
 * Quantas linhas a tabela do papel guarda para aquele documento, sem recorte de circulação.
 *
 * A leitura é **crua** e não passa pela porta de propósito: o que os casos medem é a cardinalidade da
 * tabela, e uma contagem feita pela porta aplicaria o predicado de circulação e esconderia justamente
 * a linha retirada que ela quer contar. Nenhum `WHERE empresa_id` é escrito aqui — quem recorta é a
 * política (ADR-0008); a empresa entra apenas no **contexto**, que é o mecanismo do produto.
 *
 * O nome da tabela vem da tabela declarada no topo deste arquivo e chega ao SQL pelo construtor de
 * **identificador** do driver (`tx(nome)`), que o escapa e qualifica — nunca por interpolação.
 */
async function contarPorDocumento(
  tabela: string,
  empresaId: string,
  documentoPrincipal: string,
): Promise<number> {
  return await contextoDeTenant.executarCom(
    { empresaId },
    async () =>
      await acessoAoNegocio.emUnidadeDeTrabalho(async (tx) => {
        const [linha] = await tx<{ total: string }[]>`
          SELECT count(*) AS total
            FROM ${tx(tabela)}
           WHERE documento_principal = ${documentoPrincipal}
        `;

        return Number(linha?.total ?? 0);
      }),
  );
}

/** Quantas linhas a tabela do papel guarda na empresa do contexto, sem recorte de circulação. */
async function contarTabela(tabela: string, empresaId: string): Promise<number> {
  return await contextoDeTenant.executarCom(
    { empresaId },
    async () =>
      await acessoAoNegocio.emUnidadeDeTrabalho(async (tx) => {
        const [linha] = await tx<{ total: string }[]>`
          SELECT count(*) AS total FROM ${tx(tabela)}
        `;

        return Number(linha?.total ?? 0);
      }),
  );
}

/**
 * O valor CRU da coluna `documento_principal` daquele cadastro — a asserção da variante de alteração.
 *
 * Ela corre por `abrirAcessoAoBanco` sob `contextoDeTenant.executarCom` **com a empresa da sessão**, e
 * nunca por conexão privilegiada: a auditoria não pode ser mais poderosa que o ato que ela audita.
 */
async function lerDocumentoCru(
  tabela: string,
  empresaId: string,
  id: string,
): Promise<string | undefined> {
  return await contextoDeTenant.executarCom(
    { empresaId },
    async () =>
      await acessoAoNegocio.emUnidadeDeTrabalho(async (tx) => {
        const [linha] = await tx<{ documentoPrincipal: string }[]>`
          SELECT documento_principal AS "documentoPrincipal"
            FROM ${tx(tabela)}
           WHERE id = ${id}
        `;

        return linha?.documentoPrincipal;
      }),
  );
}

/**
 * Concede as chaves informadas a uma pessoa, pelo caminho real da camada de dados.
 *
 * Sob o contexto de tenant **da empresa dela** e dentro da unidade de trabalho, com a coerência
 * ação→tela validada pela função de domínio (`validarCoerenciaDeAjustes`) e o contador incrementado
 * na mesma transação — é o mesmo caminho que a rota do Admin usa por dentro.
 *
 * A empresa é **parâmetro** porque este arquivo tem duas sessões, uma por empresa: escrever o ajuste
 * de quem é da empresa B sob o contexto da A seria recusado por `ErroDePessoaForaDoContexto`, que é o
 * comportamento certo — e o arranjo tem de respeitá-lo, não contorná-lo.
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

// ---------------------------------------------------------------------------------------------
// Corpos observados — declarados aqui, e não importados do SUT
// ---------------------------------------------------------------------------------------------

/**
 * Um cadastro de pessoa como a API o publica.
 *
 * Declarado aqui, e não importado de `@syslocbr/contracts`: o conjunto de chaves é o que os casos
 * asserem, e derivá-lo do tipo do SUT faria a asserção concordar consigo mesma.
 */
interface PessoaPublicada {
  readonly id: string;
  readonly documentoPrincipal: string;
  readonly retiradoEm: string | null;
}

/** Uma página de cadastros, no que este arquivo observa dela. */
interface PaginaPublicada {
  readonly itens: readonly PessoaPublicada[];
}

/** O envelope de erro da ADR-0017, no que este arquivo observa dele. */
interface RecusaPublicada {
  readonly codigo: string;
  readonly campo?: string;
}

/** A sessão do produto, no que este arquivo observa dela. */
interface SessaoPublicada {
  readonly telas: readonly string[];
  readonly acoes: readonly string[];
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
