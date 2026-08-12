/**
 * A barreira que impede a verificação de alcançar rede — **CT-626**, da T6 da fatia
 * `regua-de-cobranca`.
 *
 * ===========================================================================
 * INVARIANTES
 * ===========================================================================
 *
 * | Critério | Caso   | Invariante |
 * |----------|--------|------------|
 * | CA-17    | CT-626 | A lista de arquivos de teste que **alcançam** o adaptador de produção de
 * | RN-15    |        | e-mail, na união dos **quatro** diretórios varridos, é `[]` — igualdade, nunca
 * |          |        | `toContain`. Os quatro são `packages/regua/test`, `packages/db/test`,
 * |          |        | `apps/worker/test` e `apps/api/test`. Contra a verdade vácua, três âncoras
 * |          |        | **falsificáveis**: a lista dos arquivos efetivamente auditados é igual à das
 * |          |        | fontes, a união não desce abaixo do piso declarado, e cada um dos quatro
 * |          |        | diretórios contribuiu. |
 * | CA-17    | CT-626 | **PROVA DE FALSIFICAÇÃO, permanente na suíte**: o MESMO detector, aplicado a
 * |          | (b)    | cópias em memória de um arquivo de teste que alcança o adaptador pelas **cinco**
 * |          |        | formas — o símbolo pela fronteira do pacote, o caminho do módulo, a cláusula
 * |          |        | quebrada em linhas, o **namespace** e o **`import()` do barrel** —, **reprova
 * |          |        | nomeando o arquivo**; e a igualdade da ligação reprova nomeando cada uma das
 * |          |        | **três pontes de re-exportação** medidas pelo Gate 1, incluindo as duas que
 * |          |        | moravam em diretório **outrora podado**. Aplicado ao conteúdo íntegro, à menção
 * |          |        | em comentário e a um import legítimo de outro símbolo do mesmo barrel, passa
 * |          |        | limpo. |
 * | CA-17    | CT-626 | Com `SMTP_URL` apontando para destino impossível (`smtp://127.0.0.1:1`), a
 * |          | (c)    | passagem da régua **conclui** dentro do limite declarado, o número de capturas é
 * |          |        | exatamente o de candidatas, e **nenhum** registro `FALHOU` nasce — porque
 * |          |        | nenhuma conexão é tentada. A barreira é **construção**, não configuração. |
 * | CA-17    | CT-626 | O conjunto de arquivos **carregáveis** de toda a árvore versionada cujo código
 * | RN-15    | (d)    | sem comentários **liga** o adaptador é, por **igualdade**, exatamente
 * |          |        | `{packages/regua/src/adaptador-smtp.ts, packages/regua/src/index.ts}` — quem
 * |          |        | define e quem publica. Contra a verdade vácua: piso declarado do conjunto,
 * |          |        | **contenção** dos quatro diretórios varridos dentro dele, testemunhas de
 * |          |        | arquivo, de **extensão** e de **prefixo**. E, contra o conjunto encolher pela
 * |          |        | **poda**, a auditoria dela contra o git, nas duas pontas: nenhum nome da lista
 * |          |        | declarada nomeia segmento de caminho **versionado**, e nenhum caminho
 * |          |        | **efetivamente podado** contém arquivo versionado. |
 * | CA-17    | CT-626 | Em cada composição raiz que constrói o adaptador, a construção está **dentro**
 * | RN-15    | (e)    | do corpo da função de composição — `fora` é `[]` por igualdade —, e há
 * |          |        | exatamente **uma** construção dentro dele. É o que sustenta a barreira no
 * |          |        | caminho em que um arquivo de teste **carrega** a composição raiz (o
 * |          |        | `apps/worker/test/ambiente.spec.ts` importa `main.ts`). **PROVA DE
 * |          |        | FALSIFICAÇÃO permanente**: a mesma função, sobre uma cópia em memória com a
 * |          |        | construção em escopo de módulo, acusa a linha. |
 * | CA-17    | CT-626 | O **COMPLEMENTO**, contra o conjunto encolher por **qualquer das duas
 * | RN-15    | (d)    | subtrações**: as classes de `versionados \ varridos` são, por **igualdade**,
 * |          |        | o elenco declarado de classes não-carregáveis; toda classe que o carregador
 * |          |        | resolve está declarada varrida; e as duas declarações são **disjuntas**. |
 *
 * Rastreabilidade: `CA-17 → CT-626 (RN-15/RD-15)`.
 *
 * ===========================================================================
 * POR QUE A BARREIRA É ESTRUTURAL, E POR QUE ISSO SE PROVA POR VARREDURA
 * ===========================================================================
 *
 * O risco crítico da fatia é **um envio real escapar durante a verificação** — e ele é
 * irreversível: mensagem entregue na caixa de uma pessoa não volta. A mitigação não é uma variável
 * de ambiente que a suíte cuida de não definir: é a **impossibilidade de construir** o adaptador de
 * produção a partir de um arquivo de teste. Quem monta o processo escolhe o adaptador, e a
 * verificação injeta o **capturador** pela mesma interface.
 *
 * Uma bandeira de ambiente (o caminho E2, descartado no alinhamento técnico) faria a separação
 * depender de configuração: bastaria uma variável herdada do host, ou um `beforeAll` esquecido, para
 * um envio escapar. Contra isso não há asserção comportamental possível — o caso que provasse *"não
 * enviou"* seria justamente o que teria enviado. O que resta é a asserção **estática**: nenhum
 * arquivo de teste importa o adaptador, em diretório nenhum.
 *
 * ⚠️ **A varredura alcança QUATRO diretórios, e não três.** Aos `packages/regua/test`,
 * `apps/worker/test` e `apps/api/test` da §19.4 do tech spec soma-se **`packages/db/test`**, que é
 * para onde os casos da T6 vieram, e é hoje o diretório que **mais** instancia a régua. Varrer só os
 * três originais deixaria de fora exatamente o alvo mais provável.
 *
 * ===========================================================================
 * O DETECTOR É MONTADO POR CONCATENAÇÃO — e a razão é ele varrer a SI MESMO
 * ===========================================================================
 *
 * `packages/db/test` está entre os alvos, e este arquivo mora ali. Escritos como literais inteiros, o
 * nome do símbolo e o do módulo fariam a varredura **acusar o próprio arquivo que a define** — a
 * asserção reprovaria o repositório íntegro, que é o defeito espelho do registrado em
 * `.claude/rules/testing-stack.md` (*"asserção que casava `ALTER ROLE` em comentário"*).
 *
 * A saída **não** é excluir este arquivo do alvo — isso abriria nele o único caminho por onde o
 * adaptador poderia ser importado sem que nada acusasse. É partir as duas cadeias, de modo que
 * nenhuma delas exista inteira no fonte, e manter o arquivo dentro da varredura.
 *
 * ===========================================================================
 * O DETECTOR AFIRMA UMA PROPRIEDADE DO TEXTO — enumerar SINTAXE era incompleto
 * ===========================================================================
 *
 * A primeira versão deste arquivo enumerava **formas de sintaxe de import** — o import estático pelo
 * caminho do módulo, a cláusula `{ … }` com o símbolo, e o import dinâmico pelo caminho — e declarava
 * a lista exaustiva. Ela não era: o Gate 1 mediu **dois** mutantes que constroem o adaptador de
 * produção no fonte de um arquivo de teste com a suíte **verde** — o import de **namespace**
 * (`import * as X from '<pacote>'` seguido de `X.<símbolo>(…)`) e o import **dinâmico do barrel**
 * (`const { <símbolo> } = await import('<pacote>')`). Nenhum dos dois traz `{` junto ao `from`, e nos
 * dois o especificador é o do **pacote**, não o do módulo.
 *
 * Acrescentar duas expressões fecharia os dois casos e deixaria a **classe** aberta: o ESM ainda tem
 * a cláusula default, o import de efeito colateral (`import '…'`, sem `from`), a cláusula mista, o
 * renome com `as`, a re-exportação (`export … from '…'`) e o `createRequire`. Enumerar sintaxe é
 * perseguir ocorrência — o defeito estrutural que a `.claude/rules/nao-regressao.md` §5 nomeia.
 *
 * Por isso o detector deixou de perguntar *como* o módulo é carregado e passou a afirmar o que o
 * **texto do fonte** precisa conter para que o adaptador seja construído. São dois fatos, e a
 * disjunção deles é **superconjunto de toda forma de carga**, presente e futura:
 *
 * 1. **o nome do símbolo** aparece no código — e ele aparece em toda via que traz o símbolo: a
 *    cláusula nomeada (inclusive com `as`, que nomeia a origem), a desestruturação do `import()`, o
 *    acesso ao namespace (`X.<símbolo>`) e a re-exportação por **qualquer outro pacote**, que é
 *    justamente o caso que um casamento preso ao especificador do barrel deixaria passar;
 * 2. **o caminho do módulo** aparece dentro de um **literal de string** — e é assim que se alcança o
 *    adaptador **sem** nomeá-lo: o import default, o import de efeito colateral, o renome no ponto do
 *    import (`import { criar } from '…/<módulo>.js'`, que é o mutante M2) e o `createRequire`. Todo
 *    especificador de módulo do ESM é um literal de string; não há outra posição em que ele caiba.
 *
 * Dentro de **um arquivo**, a disjunção é fechada: um símbolo alcançado sem que o seu nome nem o do
 * seu módulo apareçam naquele fonte não existe. **Mas o arquivo não é o conjunto** — e foi aí que a
 * afirmação categórica que esta seção trazia (*"não há terceira via"*, sem escopo) se provou falsa.
 *
 * ===========================================================================
 * O FURO ERA DE DOMÍNIO, NÃO DE EXPRESSÃO — e é por isso que há DUAS âncoras
 * ===========================================================================
 *
 * A rodada 2 fechou as duas vias de sintaxe que a rodada 1 mediu, e afirmou exaustividade. O Gate 1
 * falsificou de novo, **duas vezes**, sem concatenação e sem propriedade computada:
 *
 * 1. `packages/db/test/ponte.mts` com `export { <símbolo> as construirEnviador } from '<pacote>';`,
 *    importada por um `.spec.ts` como `./ponte.mjs` — suíte **verde**, `createTransport` chamado;
 * 2. a mesma ponte, com extensão idiomática `.ts`, em `packages/db/src/` — suíte **verde** de novo.
 *
 * Nos dois casos o arquivo de teste não nomeia o símbolo nem o módulo: quem os nomeia é a **ponte**.
 * A propriedade era afirmada sobre o texto de **cada arquivo varrido**, mas a **ligação do símbolo
 * acontece em qualquer módulo** — e o conjunto varrido eram quatro diretórios de teste, nenhum
 * `src/` entre eles. Somava-se um segundo furo, independente: `listarFontesTs` filtrava por
 * `endsWith('.ts')`, e `'ponte.mts'.endsWith('.ts')` é **falso** — `.mts`, `.cts` e `.tsx` eram
 * invisíveis **dentro** de um diretório declarado como varrido.
 *
 * Acrescentar os `src` dos pacotes e mais extensões à enumeração seria a terceira rodada de
 * perseguir ocorrência: sobrariam os `src` das aplicações, os arquivos de raiz, os manifestos, e a
 * lista voltaria a ser uma aposta sobre onde o autor futuro escreve — o defeito estrutural que a
 * `.claude/rules/nao-regressao.md` §5 nomeia. O fecho é **topológico**, e tem duas âncoras
 * **complementares** — cada uma fecha uma classe diferente, e nenhuma substitui a outra:
 *
 * - **Âncora do ALCANCE (CT-626)** — nenhum arquivo dos quatro diretórios de teste alcança o
 *   adaptador **diretamente**. Afirma `[]`, sem lista de exceção, e **continua afirmando `[]` para
 *   sempre**: teste nenhum, em tempo nenhum, constrói o adaptador de produção.
 * - **Âncora da LIGAÇÃO (CT-626 (d))** — no conjunto **inteiro** de arquivos carregáveis da árvore
 *   versionada, quem liga o símbolo é exatamente {@link ARQUIVOS_QUE_LIGAM_O_ADAPTADOR}. É o que
 *   fecha a ponte: um módulo intermediário **precisa nomear o símbolo ou o caminho do módulo para
 *   re-exportá-lo** — e a igualdade o nomeia ali, antes de o teste chegar nele. O alcance dela é o
 *   que a seção seguinte declara, classe a classe: **todo arquivo versionado que não esteja no
 *   conjunto pertence a uma classe declarada não-carregável.**
 *
 * **Por que a segunda âncora fecha a CLASSE — e por que a PODA é parte da afirmação.** Construir o
 * adaptador exige que algum módulo o ligue. Um módulo que ligue tem, no seu próprio texto, um dos
 * dois fatos acima — isso já estava provado, e não é o que mudou. O que mudou é o **conjunto** onde
 * o fato é procurado: ele deixou de ser uma escolha de diretórios e passou a ser *tudo que o
 * carregador de módulos consegue resolver* — as extensões carregáveis mais os manifestos que batizam
 * especificador (`package.json`, `tsconfig*.json`), em toda a árvore.
 *
 * ⚠️ **Mas o conjunto é o caminhamento MENOS a poda, e foi a poda que a rodada 3 falsificou.** Ela
 * casava o **nome** da entrada de diretório, e a lista trazia `docs`, que é **versionado**: qualquer
 * diretório assim chamado, em qualquer profundidade, saía do conjunto — e uma ponte em
 * `packages/db/src/docs/` ficava invisível às **duas** âncoras ao mesmo tempo, com a suíte verde. A
 * razão então escrita para aquela poda (*"o carregador não resolve o que está ali"*) foi medida e é
 * **falsa** nas duas metades. Enquanto a poda for prosa, a frase *"todo módulo que pode existir está
 * no conjunto"* não é uma afirmação: é uma aposta sobre uma lista que ninguém audita.
 *
 * Por isso a poda **deixou de ser prosa e virou asserção**. O caminhamento relata o que podou, e
 * este caso confronta as duas pontas com o git: nenhum **nome** da lista declarada nomeia segmento
 * de caminho versionado, e nenhum **caminho efetivamente podado** contém arquivo versionado.
 * Acrescentar um diretório versionado à lista reprova aqui, em vez de abrir furo em silêncio.
 *
 * ===========================================================================
 * O CONJUNTO É UMA DIFERENÇA COM DUAS SUBTRAÇÕES — e o COMPLEMENTO é o oráculo das duas
 * ===========================================================================
 *
 * A rodada 4 ancorou a poda e afirmou a fronteira. O Gate 1 falsificou pela **quinta** vez, e a
 * assinatura do laço estava na forma da afirmação, não no conteúdo dela: o conjunto é
 *
 * ```
 * conjunto varrido  =  caminhamento  −  poda  −  filtro de extensão
 * ```
 *
 * e **só a poda tinha oráculo**. As testemunhas por extensão provam que as classes *listadas* são
 * alcançadas; elas não conseguem, por construção, provar que a lista está *completa*. O Gate 1
 * mediu `packages/db/src/ponte-sem-extensao` — CommonJS puro, **sem extensão nenhuma**, consumido
 * por `createRequire` a partir de um `.spec.ts` de diretório varrido, com o idioma que
 * `packages/shared/test/preparar-artefato.ts` já estabelece — e a suíte ficou **verde** com o
 * adaptador de produção construído.
 *
 * Acrescentar uma extensão à lista seria a quinta rodada de perseguir ocorrência. O fecho é auditar
 * **o que ficou de fora**: o complemento `versionados \ conjunto varrido` tem de ser, por
 * **igualdade**, o elenco declarado de classes não-carregáveis ({@link CLASSES_NAO_CARREGAVEIS}).
 * Uma igualdade só, e ela subsume as **duas** subtrações — poda que esconda diretório versionado e
 * filtro que esqueça uma classe depositam, os dois, um arquivo no complemento com classe que
 * ninguém declarou. As três pontes das rodadas 2, 3 e 4 aparecem **todas** ali: a `.mts` invisível,
 * a que morava sob `docs/` podado e a sem extensão.
 *
 * A partição é cobrada nas duas pontas, porque uma classe **ausente da árvore** não se move sozinha:
 * {@link CLASSES_QUE_O_CARREGADOR_RESOLVE} exige que toda classe que o carregador resolve esteja
 * declarada varrida (é o que pega estreitar o filtro em `.mts`, que a árvore ainda não tem), e a
 * disjunção das duas listas impede o conserto errado — declarar não-carregável o que o carregador
 * carrega.
 *
 * **1-A e 1-B continuam, e não são redundância.** O complemento carrega a afirmação categórica; elas
 * carregam o **diagnóstico**, dizendo qual subtração falhou e nomeando o diretório. Removê-las
 * trocaria uma prova por outra, que é o que a `.claude/rules/nao-regressao.md` §4 proíbe.
 *
 * Com isso a afirmação fica **verificável, e com a fronteira dita por inteiro**: toda posição em que
 * uma ponte pode existir, **sobreviver a um checkout limpo** e **anunciar-se como módulo** está
 * dentro do conjunto varrido. Fora ficam, nomeados: o que não sobrevive ao checkout (poda auditada
 * contra o git) e o arquivo cuja classe anuncia conteúdo que não é JavaScript (complemento
 * declarado). Ponte que não sobrevive ao checkout é resíduo local; JavaScript escrito dentro de um
 * `.md` é a evasão deliberada nomeada abaixo — e os dois estão fora do modelo de ameaça pela mesma
 * razão. **Nessa fronteira, e só declarada assim, não sobra posição intermediária.**
 *
 * ⚠️ **Exposição registrada (Gate 1, BAIXO-005), e por que ela NÃO se resolve varrendo menos.** Dos
 * arquivos do conjunto, 18 estão sob `docs/` e todos são `.json` de `_run/` — artefatos que o
 * pipeline gera, entre eles um que descreve este próprio caso de teste. Hoje nenhum nomeia o
 * símbolo. Uma regeneração que escrevesse o nome literal na descrição de um caso faria a igualdade
 * da ligação reprovar **nomeando um artefato de spec** — âncora de segurança vermelha por motivo
 * documental. O conserto certo é **corrigir o artefato** para não citar o símbolo literalmente;
 * declarar `_run/` como classe fora do conjunto seria varrer menos por conveniência, e abriria em
 * diretório versionado exatamente a posição que as rodadas 3 e 4 fecharam.
 *
 * **O que fica de fora, nomeado**: a **evasão deliberada** — partir a cadeia em concatenação (como
 * este arquivo faz), indexar por propriedade computada (`X['criar' + '…']`), ou montar o
 * especificador em tempo de execução. Ela está fora do modelo de ameaça por construção: contorná-la
 * exige conhecer este detector, enquanto o risco que a CA-17 persegue é o do autor que **segue o
 * idioma já estabelecido** do repositório e envia e-mail de verdade sem perceber.
 *
 * A contrapartida do fato 1 é que **nomear** o símbolo no código de um arquivo varrido acusa, mesmo
 * sem import — e a saída para quem precisar disso é a mesma que este arquivo usa: montar a cadeia por
 * concatenação. A prosa não é afetada: a varredura roda sobre o fonte **sem comentários**, para que a
 * explicação da proibição não seja confundida com código.
 */

import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { extname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import type { PoliticaDeAvisoNova } from '@sysloc/contracts';
import {
  type CapturadorDeEmail,
  criarCapturadorDeEmail,
  executarReguaDaEmpresa,
  type ResultadoDaRegua,
} from '@sysloc/regua';
import type { TransactionSql } from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { criarPessoa, type DadosDaPessoa } from '../src/cadastro-de-pessoa.ts';
import {
  criarCobranca,
  emitirNumeroDeCobranca,
  garantirContadorDeCobranca,
  lerAnoDaSerieDeCobranca,
} from '../src/cobranca.ts';
import { criarConjunto } from '../src/conjunto.ts';
import * as contextoDeTenant from '../src/contexto.ts';
import {
  ativarContrato,
  criarContrato,
  emitirNumeroDeContrato,
  garantirContadorDeContrato,
  lerAnoDaSerieDeContrato,
} from '../src/contrato.ts';
import { derivarTerminoDaLocacao, derivarValorTotal } from '../src/derivacao-de-contrato.ts';
import { admitirEmpresa } from '../src/empresa.ts';
import { registrarEnvioDeCobranca, selecionarCandidatasAoAviso } from '../src/envio-de-cobranca.ts';
import { criarImovel } from '../src/imovel.ts';
import { gravarPoliticaDeAviso, lerPoliticaDeAviso } from '../src/politica-de-aviso.ts';
import { EMPRESA_A } from '../src/semente.ts';
import { type AcessoAoBanco, abrirAcessoAoBanco } from '../src/unidade-de-trabalho.ts';
import { type BancoMigrado, bancoEfemero } from './banco-efemero.ts';
import {
  caminharPeloRepositorio,
  classeDoCaminho,
  DIRETORIOS_FORA_DO_CAMINHAMENTO,
  EXTENSOES_CARREGAVEIS,
  listarFontesTs,
  semComentarios,
} from './varredura-de-fontes.ts';

/** Subir a instância, provisionar papéis, migrar e semear leva dezenas de segundos nesta máquina. */
const LIMITE_SUBIDA_MS = 90_000;

/** A varredura lê algumas dezenas de arquivos; o caso de banco monta um contrato e duas cobranças. */
const LIMITE_DO_CASO_MS = 180_000;

/**
 * Quanto a passagem da régua pode levar com a `SMTP_URL` hostil declarada — **sondagem com limite
 * nomeado**, nunca espera fixa.
 *
 * Ele existe para que *"conclui"* seja uma afirmação verificável: uma régua que tentasse conectar ao
 * destino impossível ficaria presa até o limite de conexão do adaptador de produção (10 s), e a
 * corrida abaixo reprovaria nomeando o estouro.
 */
const LIMITE_DE_CONCLUSAO_MS = 5_000;

/** Reserva de UMA conexão: unidade de trabalho que vazasse reserva trava o caso seguinte. */
const RESERVA_DE_UMA = 1;

/** O contexto da empresa da carga inicial — usado só para admitir a empresa do cenário. */
const CONTEXTO_DE_A = { empresaId: EMPRESA_A.id } as const;

/** A raiz do repositório, para que os caminhos relatados sejam relativos e legíveis. */
const RAIZ_DO_REPOSITORIO = fileURLToPath(new URL('../../../', import.meta.url));

/**
 * Os **quatro** diretórios de teste varridos — ver o cabeçalho para por que são quatro.
 *
 * Diretório ausente **levanta** (é a decisão de `listarFontesTs`), e é isso que impede a cobertura de
 * cair a zero em silêncio quando um alvo é renomeado ou movido.
 */
const DIRETORIOS_VARRIDOS: readonly string[] = [
  'packages/regua/test',
  'packages/db/test',
  'apps/worker/test',
  'apps/api/test',
];

/**
 * O piso declarado de arquivos varridos na união dos quatro diretórios.
 *
 * Ele existe porque `listarFontesTs` só levanta em diretório **ausente**: um alvo **esvaziado** — os
 * arquivos removidos, o diretório de pé — atravessaria o caminhamento sem alarme, e a lista vazia de
 * culpados voltaria a ser verdade vácua por um caminho que nenhuma outra âncora fecha.
 *
 * Hoje a união tem **51** arquivos. O piso fica abaixo com folga, para que a remoção legítima de
 * alguns não reprove, e alto o bastante para que o encolhimento que apagaria a cobertura reprove.
 */
const PISO_DE_FONTES_VARRIDAS = 40;

/**
 * O piso declarado do caminhamento da árvore inteira — a mesma defesa do
 * {@link PISO_DE_FONTES_VARRIDAS}, aplicada ao conjunto do `CT-626 (d)`.
 *
 * A igualdade contra uma lista de dois vira verdade vácua se o conjunto varrido encolher: podar um
 * diretório a mais, ou estreitar as extensões, deixaria a lista de culpados idêntica e a suíte
 * verde. Hoje a árvore tem **284** arquivos carregáveis — eram 266 enquanto `docs/` era podado, e a
 * poda dele saiu na rodada 4. O piso fica abaixo com folga, e é a **mais fraca** das âncoras deste
 * caso: sozinho ele não pega o encolhimento por poda, que é o que a auditoria contra o git pega.
 */
const PISO_DE_FONTES_DO_REPOSITORIO = 200;

/**
 * As **testemunhas por arquivo** do conjunto do `CT-626 (d)`: arquivos reais, nomeados, que o
 * **produto controla**, cuja presença prova que o caminhamento alcança cada classe que os furos
 * medidos mostraram faltar.
 *
 * Cada uma fecha um encolhimento diferente, e a comparação é por igualdade sobre o filtro:
 *
 * - o **fonte de `src/`** de um pacote — a classe inteira que a varredura dos quatro diretórios de
 *   teste não alcançava, e onde a segunda ponte do Gate 1 morava;
 * - o **manifesto `.json`** — quem batiza especificador por `exports`, o único ponto capaz de criar
 *   um nome de módulo que não contém o caminho real;
 * - **este próprio arquivo** — quem define o detector está dentro do conjunto que ele audita, e é
 *   isso que impede a saída fácil de se excluir da varredura.
 *
 * ⚠️ **A testemunha da extensão `.tsx` saiu daqui, e a razão é o Gate 1 (BAIXO-003).** Ela apontava
 * uma fixture de `.claude/skills/…`, que é do framework agent-spec e **não** do produto: uma
 * atualização da skill que a renomeasse deixaria uma âncora de **segurança** vermelha por motivo
 * cosmético — a situação em que se afrouxa a asserção errada. A classe que ela guardava não foi
 * abandonada: virou {@link EXTENSOES_TESTEMUNHAS}, que afirma a mesma coisa **por extensão**, e
 * portanto sobrevive a renome. Medido: hoje **nenhum** módulo `.tsx`, `.js` ou `.cjs` da árvore
 * mora fora de `.claude/`, de modo que trocar por um arquivo do produto não era possível sem criar
 * um.
 */
const TESTEMUNHAS_DO_CAMINHAMENTO: readonly string[] = [
  'packages/db/test/barreira-de-envio.spec.ts',
  'packages/regua/package.json',
  'packages/regua/src/regua.ts',
];

/**
 * As **testemunhas por extensão**: cada classe de `EXTENSOES_CARREGAVEIS` (a lista declarada em
 * `varredura-de-fontes.ts`) que a árvore realmente tem hoje é alcançada pelo caminhamento.
 *
 * É a herdeira da testemunha `.tsx` por caminho, e é estritamente mais robusta na dimensão que o
 * Gate 1 apontou: renomear ou mover o arquivo que hospeda a extensão não a quebra — só a **remoção
 * da classe inteira** quebra, que é exatamente o defeito que ela persegue (estreitar a lista de
 * extensões faria uma ponte `.tsx` ou `.cjs` sumir do conjunto sem que a igualdade acusasse).
 *
 * `.mts`, `.cts`, `.jsx` e `.mjs` **não** entram: a árvore não tem nenhum hoje, e testemunha de
 * classe ausente reprovaria o repositório íntegro. Elas continuam declaradas em
 * `EXTENSOES_CARREGAVEIS` — o que se ancora aqui é o que existe, nunca o que a lista promete.
 */
const EXTENSOES_TESTEMUNHAS: readonly string[] = ['.cjs', '.js', '.json', '.ts', '.tsx'];

/**
 * As **testemunhas por prefixo**: os dois diretórios em que o Gate 1 plantou ponte na rodada 3 e a
 * suíte ficou **verde**, porque a poda por nome os subtraía do conjunto.
 *
 * Elas são a forma permanente daqueles dois mutantes na metade que a cópia em memória **não** pode
 * provar: o mutante em memória demonstra que a *igualdade* nomeia o arquivo-ponte, e estas
 * demonstram que o *caminhamento* chega até a posição em que a ponte moraria. Sem elas, repodar
 * `docs` deixaria a suíte verde outra vez.
 *
 * São prefixos, e não arquivos, de propósito: o que se afirma é que a **posição** é alcançada, e
 * amarrar isso a um nome de arquivo de `docs/` — que é artefato de spec, renomeado a cada fatia —
 * seria o seletor frágil que o Gate 1 anotou no `.tsx`.
 */
const PREFIXOS_ALCANCADOS_PELO_CAMINHAMENTO: readonly string[] = ['docs/', 'packages/db/src/'];

/**
 * A testemunha da **poda**: o caminho cuja subtração é afirmável em qualquer árvore em que a suíte
 * roda, e que impede a auditoria da poda de passar por vacuidade (uma poda vazia satisfaz
 * trivialmente *"nada podado contém arquivo versionado"*).
 *
 * É **um só**, e a escolha é medida: `.git` é um **arquivo**, e não um diretório, em worktree
 * vinculado — ancorá-lo tornaria a asserção falsa fora do clone comum —, e todo `dist/` depende de
 * já ter havido build. O `node_modules/` da raiz existe em toda árvore com dependências
 * instaladas, que é pré-condição de rodar a suíte.
 */
const PODAS_TESTEMUNHAS: readonly string[] = ['node_modules'];

/**
 * **O COMPLEMENTO declarado** — as classes de arquivo versionado que ficam **fora** do conjunto
 * varrido, e a razão de cada uma. É a âncora 1-C, e é ela que carrega a afirmação categórica.
 *
 * O conjunto varrido é `caminhamento − poda − filtro de extensão`, e as quatro rodadas do Gate 1
 * fecharam **uma** subtração de cada vez enquanto a outra seguia sem oráculo. Auditar o que ficou
 * **de fora** fecha as duas ao mesmo tempo, porque toda subtração indevida — venha da poda, venha do
 * filtro — deposita aqui um arquivo cuja classe ninguém declarou. As três pontes medidas nas rodadas
 * 2, 3 e 4 apareceriam **todas** neste complemento, e a igualdade abaixo teria reprovado as três de
 * uma vez, antes de cada uma ser descoberta por medição.
 *
 * A declaração é por **classe** ({@link classeDoCaminho}), nunca por arquivo: uma lista de 435
 * caminhos seria manutenção impossível, e a primeira rodada que acrescentasse um `.md` a
 * "consertaria" acrescentando o caminho — que é afrouxar. Por classe, um `.md` novo não move nada, e
 * uma **classe** nova reprova e obriga a decisão explícita.
 *
 * **O que cada classe afirma**: o nome anuncia um conteúdo que não é JavaScript, e por isso nenhum
 * arquivo dela liga símbolo de módulo.
 *
 * | Classe | Por que não é carregável |
 * |---|---|
 * | `.md`, `.txt` | prosa e texto puro — documentação, spec, relatório de gate, golden do PDF |
 * | `.yaml`, `.yml`, `.toml` | dado declarativo — fixture de skill, workflow de CI, `.mise.toml` |
 * | `.sh`, `.py`, `.go`, `.mod` | fonte de outra linguagem, executada em processo próprio |
 * | `.sql` | dialeto do banco, consumido pelo servidor e não pelo carregador |
 * | `.service` | unidade do systemd |
 * | `.example` | amostra inerte de outro arquivo, e o sufixo é o que a declara inerte |
 * | `.gitignore`, `.gitattributes`, `.gitkeep` | configuração e sentinela do próprio git |
 * | `Makefile` | receita do `make` — arquivo **sem extensão** cujo nome é o anúncio |
 *
 * ⚠️ **A fronteira, dita por inteiro.** "Não carregável" aqui é *pelo anúncio*, não pelo carregador:
 * o CJS compila como JavaScript **toda** extensão que não reconhece, de modo que um `.md` cujo
 * conteúdo fosse JS seria carregável por `createRequire`. Escrever JavaScript dentro de um `.md` é
 * evasão deliberada — a mesma classe já nomeada no cabeçalho —, enquanto o arquivo **sem extensão**
 * não anuncia nada e por isso não recebe classe genérica: cada nome novo sem extensão reprova aqui.
 *
 * **O que NÃO se faz quando ela reprovar**: acrescentar a classe sem escrever por que ela é inerte,
 * filtrar o arquivo culpado, ou estreitar o caminhamento para o culpado sumir. Os três apagam a
 * âncora. Classe nova legítima é uma linha aqui **mais** a linha da tabela acima; classe que sumiu da
 * árvore é a remoção de uma linha, e as duas direções pedem a razão escrita.
 */
const CLASSES_NAO_CARREGAVEIS: readonly string[] = [
  '.example',
  '.gitattributes',
  '.gitignore',
  '.gitkeep',
  '.go',
  '.md',
  '.mod',
  '.py',
  '.service',
  '.sh',
  '.sql',
  '.toml',
  '.txt',
  '.yaml',
  '.yml',
  'Makefile',
];

/**
 * As classes que o **carregador do Node/Vitest resolve como módulo** — a outra ponta da mesma
 * partição, e a âncora 1-D.
 *
 * O complemento sozinho não pega o estreitamento de {@link EXTENSOES_CARREGAVEIS} numa classe que a
 * árvore **ainda não tem**: nenhum arquivo muda de lado, e a igualdade da 1-C segue verde. Foi o
 * mutante `MUT-I` do Gate 1, que removeu `.mts` do filtro sem que nada acusasse — e o `.mts` é
 * justamente a extensão da ponte medida na rodada 2.
 *
 * Por isso a partição é cobrada como **total**: toda classe que o carregador resolve tem de estar
 * declarada carregável. A lista é uma propriedade do **runtime**, e não desta árvore — é por isso que
 * ela é declarada e não medida: prová-la por importação exigiria plantar na árvore um arquivo de cada
 * classe, e uma delas é literalmente a posição da ponte que o Gate 1 usou.
 */
const CLASSES_QUE_O_CARREGADOR_RESOLVE: readonly string[] = [
  '.cjs',
  '.cts',
  '.js',
  '.json',
  '.jsx',
  '.mjs',
  '.mts',
  '.ts',
  '.tsx',
];

/**
 * O nome do símbolo de produção e o do módulo que o hospeda, **partidos** — ver o cabeçalho.
 *
 * A concatenação é o que impede este arquivo de casar a si mesmo. Ela não enfraquece nada: o que
 * corre no detector é a cadeia inteira, montada em tempo de execução.
 */
const SIMBOLO_DO_ADAPTADOR = `criarAdaptador${'Smtp'}`;
const MODULO_DO_ADAPTADOR = `adaptador${'-'}smtp`;

/**
 * **A lista declarada dos arquivos que podem LIGAR o adaptador de produção** — a âncora do
 * `CT-626 (d)`, auditada por **igualdade** sobre a árvore inteira.
 *
 * Hoje são dois, e é o mínimo possível: quem **define** o adaptador e quem o **publica** no barrel.
 * Nada mais na árvore nomeia o símbolo nem o caminho do módulo em literal de string.
 *
 * ⚠️ O caminho do primeiro é montado a partir de {@link MODULO_DO_ADAPTADOR}, e **não** escrito
 * inteiro: escrevê-lo faria este arquivo casar a si mesmo pelo fato 2, e a asserção reprovaria o
 * repositório íntegro nomeando o próprio detector — foi medido, e é a mesma razão que parte as duas
 * cadeias acima. É também por isso que a lista mora **depois** delas.
 *
 * ⚠️ **Esta lista CRESCE, por decisão explícita — e crescer é o comportamento correto.** Na T8 e na
 * T10 a borda de composição de cada processo passa a construir o adaptador **legitimamente**, e o
 * arquivo dela entra aqui. O idioma é o mesmo dos elencos declarados que este repositório já usa
 * (`TABELAS_LEGITIMAS`, `SIMBOLOS_ESPERADOS`): lista nomeada, comparada por igualdade, que só muda
 * quando alguém a edita e escreve por quê.
 *
 * **O que NÃO se faz quando ela reprovar**: trocar `toEqual` por `toContain`, filtrar o culpado, ou
 * varrer menos arquivos. Qualquer um dos três apaga a âncora inteira — a igualdade é o mecanismo, e
 * a lista é só o parâmetro. Acrescentar a borda de composição é uma linha a mais aqui, acompanhada
 * da linha `SUT_IS_CORRECT_BECAUSE:` que o Protocolo Antirregressão exige, dizendo por que aquele
 * arquivo é composição de processo e não arquivo de teste. Se o arquivo novo for de **teste**, não é
 * caso de crescer a lista: é a barreira acusando exatamente o que ela existe para acusar.
 */
const ARQUIVOS_QUE_LIGAM_O_ADAPTADOR: readonly string[] = [
  // A composição do módulo que publica a porta no SERVIÇO DE APLICAÇÃO (T10). Ver o segundo
  // `SUT_IS_CORRECT_BECAUSE` abaixo.
  'apps/api/src/automacao/automacao.module.ts',
  // A composição raiz do PROCESSADOR DE TRABALHO (T8). Ver o `SUT_IS_CORRECT_BECAUSE` abaixo.
  'apps/worker/src/main.ts',
  `packages/regua/src/${MODULO_DO_ADAPTADOR}.ts`,
  'packages/regua/src/index.ts',
];

/**
 * SUT_IS_CORRECT_BECAUSE: a lista tinha **dois** elementos — quem define o adaptador e quem o
 * publica no barrel — porque, até a T7, **nenhum processo o construía**: ele existia sem ser
 * ligado. A T8 é o momento que o docblock acima nomeia por antecipação (*"na T8 e na T10 a borda de
 * composição de cada processo passa a construir o adaptador legitimamente, e o arquivo dela entra
 * aqui"*), e `apps/worker/src/main.ts` é exatamente isso: composição raiz de um **processo**, não
 * arquivo de teste — ele é o `ExecStart` de `deploy/systemd/sysloc-worker.service`, lê `SMTP_URL` e
 * `EMAIL_REMETENTE` do `EnvironmentFile` e entrega a porta construída à borda do job **por
 * parâmetro**, que é o mesmo parâmetro pelo qual a verificação entrega o capturador.
 *
 * O discriminador que o docblock declara está satisfeito nos dois sentidos: o arquivo novo **não**
 * está em nenhum dos quatro diretórios de teste, e a **âncora do ALCANCE** (`CT-626`) continua
 * afirmando `[]` sobre eles — nenhum teste ganhou caminho para o adaptador de produção. Nenhuma das
 * três saídas erradas foi tomada: a igualdade continua `toEqual`, nenhum culpado foi filtrado, e o
 * conjunto varrido continua sendo a árvore inteira.
 *
 * ⚠️ **"Não está em diretório de teste" NÃO é o discriminador inteiro, e a diferença importa.**
 * `apps/worker/test/ambiente.spec.ts` **carrega** este módulo (`import { lerAmbiente } from
 * '../src/main.ts'`) — ou seja, um arquivo de teste passou a executar o módulo que nomeia o
 * adaptador de produção. **Não há furo**, e as três razões são medidas: a construção mora dentro do
 * corpo de `principal()`, que só é chamado atrás de `ehPontoDeEntrada()` — falso sob o Vitest,
 * porque `process.argv[1]` é o executável do runner —; o adaptador fica numa `const` local, não
 * exportada; e o `createTransport` sem `pool` não abre soquete na construção.
 *
 * A primeira dessas três é a que sustenta a barreira **neste caminho**, e é ela que o `CT-626 (e)`
 * abaixo passou a asserir: a construção precisa estar **dentro** do corpo da composição, nunca em
 * escopo de módulo. Movê-la para o escopo de módulo faria o simples `import` daquele arquivo de
 * teste construir o adaptador de produção — e, até esta rodada, nenhuma asserção pegava isso, de
 * modo que o docblock afirmava mais do que a suíte provava.
 */

/**
 * SUT_IS_CORRECT_BECAUSE: a lista tinha **três** elementos, e a **T10** é o segundo momento que o
 * docblock acima nomeia por antecipação (*"na T8 e na T10 a borda de composição de cada processo
 * passa a construir o adaptador legitimamente"*). O disparo manual envia de dentro do serviço de
 * aplicação, e quem escolhe a porta ali é `apps/api/src/automacao/automacao.module.ts` — composição
 * de **módulo Nest**, não arquivo de teste: ele declara o provedor de `TOKEN_PORTA_DE_EMAIL` e a
 * fábrica que constrói o adaptador a partir do ambiente **já validado na partida**.
 *
 * ⚠️ **O arquivo é o módulo, e não `apps/api/src/main.ts`** — que é o que este docblock antecipava e
 * o que a nota de `COMPOSICOES_QUE_CONSTROEM_O_ADAPTADOR` dizia. A antecipação errou o arquivo, e a
 * escolha real é melhor: no `main.ts` a porta seria um provedor global, alcançável por todo
 * controlador do produto; no módulo da área, ela fica fora de qualquer `exports`, e a única
 * superfície que a alcança é a que precisa dela.
 *
 * O discriminador que o docblock declara está satisfeito nos dois sentidos: o arquivo novo **não**
 * está em nenhum dos quatro diretórios de teste, e a **âncora do ALCANCE** (`CT-626`) continua
 * afirmando `[]` sobre eles. Nenhuma das três saídas erradas foi tomada: a igualdade continua
 * `toEqual`, nenhum culpado foi filtrado, e o conjunto varrido continua sendo a árvore inteira.
 *
 * ⚠️ **A suíte da `api` CARREGA este módulo** — todo caso que monta a aplicação real importa
 * `criarAplicacao`, que importa o `AppModule`, que importa o `AutomacaoModule`. **Não há furo**, e as
 * razões são as mesmas três do worker, medidas: a construção mora dentro do corpo de
 * `criarPortaDeEmail`, que só é chamada pelo injetor quando o provedor é resolvido — e a suíte que
 * exercita as rotas de aviso **substitui o provedor inteiro** por `overrideProvider`, de modo que a
 * fábrica nem corre; o adaptador não é exportado; e o `createTransport` sem `pool` não abre soquete
 * na construção. A primeira é a que o `CT-626 (e)` assere, agora sobre os **dois** arquivos.
 */

/**
 * **As composições raiz que constroem o adaptador, e a função dentro da qual isso é legítimo.**
 *
 * A lista é o subconjunto de {@link ARQUIVOS_QUE_LIGAM_O_ADAPTADOR} que é **composição de processo**
 * — quem define e quem publica o adaptador ficam de fora, porque neles a construção não acontece.
 *
 * ⚠️ **Ela cresce na T10**, quando `apps/api/src/main.ts` entrar na lista de cima: acrescente aqui
 * a mesma linha, nomeando a função de composição daquele processo. Deixar de acrescentar não é
 * neutro — é publicar um caminho de construção que nenhuma asserção guarda.
 *
 * SUT_IS_CORRECT_BECAUSE: a T10 chegou, e a lista cresceu como o parágrafo acima manda — com **uma**
 * correção de fato: o arquivo é `apps/api/src/automacao/automacao.module.ts`, e não o `main.ts` que a
 * antecipação supunha, e a função é a fábrica do provedor. A razão da diferença está no
 * `SUT_IS_CORRECT_BECAUSE` de {@link ARQUIVOS_QUE_LIGAM_O_ADAPTADOR}, e ela é a favor da barreira: a
 * porta fica contida na área que a usa, em vez de global. **Nenhuma entrada anterior saiu.**
 */
const COMPOSICOES_QUE_CONSTROEM_O_ADAPTADOR: readonly (readonly [string, string])[] = [
  ['apps/api/src/automacao/automacao.module.ts', 'criarPortaDeEmail'],
  ['apps/worker/src/main.ts', 'principal'],
];

/** A chamada — o símbolo seguido de abertura de parêntese. O import apenas o nomeia, e não constrói. */
const CONSTROI_O_ADAPTADOR = new RegExp(`\\b${SIMBOLO_DO_ADAPTADOR}\\s*\\(`);

/**
 * Onde estão as construções do adaptador num fonte de composição: dentro do corpo da função, ou
 * fora dele.
 *
 * O corpo vai da linha que declara a função até a primeira linha que é exatamente `}` — a coluna
 * zero é o fechamento de declaração de topo em todo este repositório, que formata com dois espaços.
 * O que sai daqui é **posição**, e não um booleano: quando reprovar, a mensagem nomeia a linha.
 */
function localizarConstrucoes(
  fonte: string,
  funcao: string,
): {
  readonly corpo: 'encontrado' | 'ausente';
  readonly dentro: number[];
  readonly fora: number[];
} {
  const linhas = fonte.split('\n');
  const abertura = linhas.findIndex((linha) =>
    new RegExp(`^(?:export )?(?:async )?function ${funcao}\\(`).test(linha),
  );
  const fechamento = linhas.findIndex((linha, indice) => indice > abertura && linha === '}');
  if (abertura === -1 || fechamento === -1) {
    return { corpo: 'ausente', dentro: [], fora: [] };
  }

  const dentro: number[] = [];
  const fora: number[] = [];
  linhas.forEach((linha, indice) => {
    if (!CONSTROI_O_ADAPTADOR.test(linha)) {
      return;
    }
    (indice > abertura && indice < fechamento ? dentro : fora).push(indice + 1);
  });

  return { corpo: 'encontrado', dentro, fora };
}

/**
 * **Fato 1** — o código nomeia o símbolo do adaptador de produção.
 *
 * Cobre toda via que traz o símbolo, qualquer que seja a sintaxe: cláusula nomeada (com ou sem `as`),
 * desestruturação de `import()`, acesso a namespace, e re-exportação por outro pacote. Ver o
 * cabeçalho para por que a disjunção destes dois fatos é exaustiva.
 */
const NOMEIA_O_SIMBOLO = new RegExp(`\\b${SIMBOLO_DO_ADAPTADOR}\\b`);

/**
 * **Fato 2** — o código nomeia o módulo do adaptador dentro de um **literal de string**.
 *
 * É como se alcança o adaptador sem nomeá-lo (import default, de efeito colateral, com renome, ou
 * `createRequire`). A âncora do literal é o que torna a cobertura completa sem enumerar sintaxe: todo
 * especificador de módulo do ESM é um literal de string, e não há outra posição em que ele caiba.
 */
const NOMEIA_O_MODULO = new RegExp(`['"\`][^'"\`]*${MODULO_DO_ADAPTADOR}`);

/**
 * Os mutantes da falsificação: as **cinco** formas de alcance, como um autor futuro as escreveria.
 *
 * Eles **não** são aplicados ao disco — as cópias existem só em memória, e o que roda sobre elas é a
 * mesma {@link alcancaOAdaptador} que roda sobre os arquivos reais. Escrever no disco durante a suíte
 * deixaria resíduo se o processo morresse no meio, e o resíduo aqui é justamente um arquivo de teste
 * capaz de enviar e-mail de verdade.
 *
 * As cadeias são montadas por concatenação pela mesma razão do detector.
 *
 * ⚠️ Os dois últimos são **os mutantes que o Gate 1 mediu na rodada 1**, e que a enumeração por
 * sintaxe deixava passar com a suíte verde. Eles ficam permanentes: é o que impede a lista de voltar
 * a ser enumeração de formas conhecidas.
 */
const MUTANTE_POR_SIMBOLO = `import { criarCapturadorDeEmail, ${SIMBOLO_DO_ADAPTADOR} } from '@sysloc/regua';`;
const MUTANTE_POR_CAMINHO = `import { criar } from '../src/${MODULO_DO_ADAPTADOR}.js';`;
const MUTANTE_POR_NAMESPACE = `import * as regua from '@sysloc/regua';\nconst enviador = regua.${SIMBOLO_DO_ADAPTADOR}(config);`;
const MUTANTE_POR_BARREL_DINAMICO = `const { ${SIMBOLO_DO_ADAPTADOR} } = await import('@sysloc/regua');`;

/**
 * **M6, M7 e M8 — as pontes de re-exportação com renome**, as três posições que o Gate 1 mediu.
 *
 * Nenhuma delas mora num diretório de teste: moram num módulo qualquer da árvore, e o arquivo de
 * teste que as consome não nomeia nem o símbolo nem o caminho do módulo. São mutantes da **âncora
 * da ligação**, e não do detector por arquivo — por isso correm sobre o conjunto do `CT-626 (d)`,
 * com o caminho de cada ponte entrando como uma entrada a mais.
 *
 * Os caminhos são os **literais medidos pelo Gate 1**, e permanecem assim de propósito:
 *
 * - `packages/db/src/ponte-de-composicao.ts` — rodada 2: `src/` de um pacote, fora dos quatro
 *   diretórios de teste. A variante `.mts` dentro de `packages/db/test/` é a mesma classe pela
 *   outra ponta (extensão invisível), e é o caminhamento inteiro que fecha as duas;
 * - `packages/db/src/docs/ponte.ts` e `docs/ponte-de-envio.ts` — rodada 3: as duas posições que a
 *   **poda por nome** subtraía do conjunto, uma em profundidade e outra na raiz. Elas ficam
 *   permanentes aqui, e a metade que a cópia em memória não alcança — que o caminhamento chega até
 *   a posição — está em {@link PREFIXOS_ALCANCADOS_PELO_CAMINHAMENTO}.
 */
const MUTANTE_PONTE_DE_REEXPORTACAO = `export { ${SIMBOLO_DO_ADAPTADOR} as construirEnviador } from '@sysloc/regua';`;
const PONTES_FORA_DOS_DIRETORIOS_DE_TESTE: readonly string[] = [
  'docs/ponte-de-envio.ts',
  'packages/db/src/docs/ponte.ts',
  'packages/db/src/ponte-de-composicao.ts',
];

/**
 * O controle contra **falso positivo**: importar outro símbolo do mesmo barrel é legítimo e comum.
 *
 * Três arquivos de teste dos diretórios varridos fazem exatamente isto — o que acusa é nomear o
 * adaptador, nunca tocar o pacote. Uma expressão que casasse `from '@sysloc/regua'` sozinha reprovaria
 * o repositório íntegro.
 */
const IMPORT_LEGITIMO_DO_BARREL = `import { criarCapturadorDeEmail } from '@sysloc/regua';`;

/** A `SMTP_URL` hostil do CT-626 (c): porta reservada, em destino que recusa de imediato. */
const TRANSPORTE_IMPOSSIVEL = 'smtp://127.0.0.1:1';

/** A política do cenário do CT-626 (c): ligada, sem recorte de horário. */
const POLITICA_LIGADA: PoliticaDeAvisoNova = {
  ativo: true,
  diasAntesDoVencimento: 10,
  intervaloMinimoDias: 1,
  janelaInicio: '00:00',
  janelaFim: '23:59',
  canal: 'EMAIL',
};

/** O instante do trabalho — dentro da janela que nunca fecha. */
const AGORA = '13:00';

/** Os dois vencimentos do cenário: uma a vencer dentro dos dias e uma já vencida. */
const DIAS_ATE_VENCER = 5;
const DIAS_DE_ATRASO = -12;

/** Valor de cada cobrança do arranjo, em reais. */
const VALOR_DA_COBRANCA = 1000;

/** Os termos do contrato do cenário — nada aqui participa do que está sob prova. */
const TERMOS_DO_CONTRATO = {
  dataInicioLocacao: '2026-01-01',
  prazoMeses: 12,
  valorMensal: VALOR_DA_COBRANCA,
  diaVencimento: 10,
  indiceReajuste: 'IGPM',
  gerarCobrancasAutomaticamente: false,
  observacoes: null,
  pdfContratoArquivo: null,
} as const;

/** A competência das cobranças do arranjo — não participa do recorte. */
const COMPETENCIA = '2026-01-01';

let banco: BancoMigrado;
let acesso: AcessoAoBanco;

beforeAll(async () => {
  banco = await bancoEfemero();
  acesso = abrirAcessoAoBanco({
    cadeiaDeConexao: banco.cadeiaConexao,
    maximoDeConexoes: RESERVA_DE_UMA,
  });
}, LIMITE_SUBIDA_MS);

afterAll(async () => {
  await acesso?.encerrar();
  await banco?.parar();
}, LIMITE_SUBIDA_MS);

/**
 * Responde se o conteúdo de um arquivo **alcança** o adaptador de produção.
 *
 * O verbo é *alcança*, e não *importa*, porque a propriedade afirmada é sobre o **texto** e não sobre
 * a sintaxe de carga — ver o cabeçalho. É a disjunção dos dois fatos, sobre o fonte já sem
 * comentários.
 *
 * **É o detector único deste arquivo**, e a unicidade é o ponto: o caso principal o consome sobre os
 * arquivos do disco, e o `CT-626 (b)` o consome sobre as cópias mutantes. Duas implementações
 * parecidas fariam a falsificação provar algo sobre a segunda, e não sobre a asserção commitada.
 */
function alcancaOAdaptador(conteudo: string): boolean {
  const codigo = semComentarios(conteudo);

  return NOMEIA_O_SIMBOLO.test(codigo) || NOMEIA_O_MODULO.test(codigo);
}

/** Um arquivo carregável da árvore, já lido: o caminho relativo à raiz e o conteúdo. */
interface FonteDaArvore {
  readonly relativo: string;
  readonly conteudo: string;
}

/** A árvore carregável observada: o que entrou no conjunto, e o que a poda subtraiu dele. */
interface ArvoreObservada {
  readonly fontes: FonteDaArvore[];
  readonly podados: string[];
}

/**
 * Lê **todo** arquivo carregável da árvore — o conjunto sobre o qual a âncora da ligação afirma a
 * igualdade — e devolve junto o que o caminhamento **podou**.
 *
 * Os dois vêm juntos porque são as duas metades da mesma afirmação: a igualdade só vale sobre o
 * conjunto varrido, e o conjunto varrido só é o que se diz que ele é enquanto a poda subtrair
 * exclusivamente o que não sobrevive a um checkout limpo. Ver o cabeçalho.
 */
async function lerArvoreCarregavel(): Promise<ArvoreObservada> {
  const { arquivos, podados } = await caminharPeloRepositorio(RAIZ_DO_REPOSITORIO);

  const fontes: FonteDaArvore[] = [];
  for (const caminho of arquivos) {
    fontes.push({
      relativo: relative(RAIZ_DO_REPOSITORIO, caminho),
      conteudo: await readFile(caminho, 'utf8'),
    });
  }

  return { fontes, podados };
}

const executar = promisify(execFile);

/**
 * Os caminhos que o **git versiona** hoje, relativos à raiz — o oráculo da auditoria da poda.
 *
 * É o git que responde, e não uma lista escrita aqui, porque a propriedade que separa uma poda
 * legítima de um furo é literalmente a dele: *sobrevive a um checkout limpo*. Falha do comando
 * **sobe** — git ausente ou árvore sem repositório tornaria a auditoria vácua, e âncora que se
 * desliga sozinha é pior que âncora nenhuma.
 */
async function caminhosVersionados(): Promise<string[]> {
  const { stdout } = await executar('git', ['ls-files', '-z'], { cwd: RAIZ_DO_REPOSITORIO });

  return stdout.split('\0').filter((caminho) => caminho.length > 0);
}

/**
 * Os caminhos, ordenados, das fontes que **ligam** o adaptador — pelo MESMO {@link alcancaOAdaptador}
 * que corre sobre os arquivos de teste.
 *
 * Recebe as fontes já lidas em vez de ler do disco, e a razão é a prova: o `CT-626 (b)` acrescenta a
 * ponte mutante como uma entrada a mais do mesmo conjunto e demonstra que a igualdade a nomeia.
 * Gravar a ponte no disco durante a suíte deixaria como resíduo exatamente um módulo capaz de
 * construir o adaptador de produção.
 */
function ligamOAdaptador(fontes: readonly FonteDaArvore[]): string[] {
  return fontes
    .filter(({ conteudo }) => alcancaOAdaptador(conteudo))
    .map(({ relativo }) => relativo)
    .sort();
}

// ===========================================================================
// CT-626 (f) — a âncora SIMÉTRICA: nenhuma composição de produção liga o CAPTURADOR (D19)
// ===========================================================================

/**
 * O nome do capturador, **partido** — pela mesma razão que parte o do adaptador.
 *
 * A concatenação é o que impede este arquivo de casar a si mesmo: ele importa `criarCapturadorDeEmail`
 * legitimamente, e o detector corre sobre `apps/*​/src/**`, onde este arquivo não está — mas a
 * disciplina é a mesma do símbolo irmão, e mantê-la é o que faz a prova sobreviver a alguém mover o
 * detector de lugar.
 */
const SIMBOLO_DO_CAPTURADOR = `criarCapturador${'DeEmail'}`;

/** O módulo que hospeda o capturador, também partido. */
const MODULO_DO_CAPTURADOR = `porta${'-'}de-email`;

/** **Fato 1** — o código de produção nomeia o símbolo do capturador. */
const NOMEIA_O_CAPTURADOR = new RegExp(`\\b${SIMBOLO_DO_CAPTURADOR}\\b`);

/** **Fato 2** — o código de produção nomeia o módulo do capturador num literal de string. */
const NOMEIA_O_MODULO_DO_CAPTURADOR = new RegExp(`['"\`][^'"\`]*${MODULO_DO_CAPTURADOR}`);

/**
 * Os diretórios de **produção** varridos pela âncora simétrica — o `src/` de cada processo.
 *
 * O conjunto é um **prefixo**, e não a árvore inteira, e a assimetria em relação ao `CT-626 (d)` é
 * deliberada: o risco que esta âncora fecha é o de uma **composição de processo** fiar o capturador,
 * e composição de processo vive em `apps/*​/src/**`. Uma ponte de re-exportação em `packages/` só
 * importaria se algum destes a consumisse — e consumi-la faria o arquivo nomear o módulo dela, que é
 * literal de string e cai no fato 2.
 */
const COMPOSICOES_DE_PRODUCAO_VARRIDAS: readonly string[] = ['apps/api/src', 'apps/worker/src'];

/** Responde se o conteúdo de um arquivo alcança o **capturador** — o irmão de `alcancaOAdaptador`. */
function alcancaOCapturador(conteudo: string): boolean {
  const codigo = semComentarios(conteudo);

  return NOMEIA_O_CAPTURADOR.test(codigo) || NOMEIA_O_MODULO_DO_CAPTURADOR.test(codigo);
}

describe('CT-626 (f) — o modo de falha INVERSO: produção nenhuma liga o capturador (D19)', () => {
  /**
   * O que esta âncora fecha, e por que ela é **pior de detectar** que a irmã.
   *
   * Toda a prova da T6 corre numa direção só: o `CT-626` afirma que teste nenhum alcança o adaptador
   * de produção. **Nada afirmava que composição de produção nenhuma alcança o capturador** — e desde a
   * T8 os dois são alcançáveis pela mesma fronteira (`@sysloc/regua`), com a mesma interface, de modo
   * que a régua **não sabe qual dos dois recebeu**.
   *
   * Uma composição que fiasse o capturador em produção **engoliria todo aviso em silêncio**: a régua
   * gravaria `ENVIADA` com `causa: null` para cada candidata, a trava do intervalo prenderia cada
   * cobrança, e nenhuma mensagem sairia. Não há caixa alheia acusando, não há linha `FALHOU`, e o
   * histórico que o operador consulta **afirmaria positivamente que o aviso saiu**.
   *
   * É o débito **D19 (F3/T6)**, com dono nomeado T8/T10, fechado aqui: a T10 é a primeira task em que
   * a `api` ganha a porta, e portanto a primeira em que existem **duas** composições a vigiar.
   */
  it('CT-626 (f) — nenhum arquivo de produção dos dois processos liga o capturador', async () => {
    const culpados: string[] = [];
    const auditados: string[] = [];

    for (const diretorio of COMPOSICOES_DE_PRODUCAO_VARRIDAS) {
      const fontes = await listarFontesTs(`${RAIZ_DO_REPOSITORIO}${diretorio}`);

      // Âncora antivácuo, por diretório: uma varredura que não lesse arquivo algum devolveria `[]` e
      // aprovaria o repositório inteiro sem ter olhado nada. `> 0` não basta como asserção final,
      // mas basta como guarda de que o conjunto existe — a igualdade abaixo é quem mede.
      expect(fontes.length, `o caminhamento de ${diretorio} não leu arquivo algum`).toBeGreaterThan(
        0,
      );

      for (const caminho of fontes) {
        const conteudo = await readFile(caminho, 'utf8');
        const relativo = relative(RAIZ_DO_REPOSITORIO, caminho);

        auditados.push(relativo);
        if (alcancaOCapturador(conteudo)) {
          culpados.push(relativo);
        }
      }
    }

    // A TESTEMUNHA POSITIVA do detector, sobre a árvore real: os mesmos diretórios contêm o arquivo
    // que liga o ADAPTADOR, e ele é encontrado pelo detector irmão. Sem esta linha, um detector que
    // respondesse `false` para tudo produziria a lista vazia abaixo e passaria.
    expect(
      auditados.filter((relativo) => ARQUIVOS_QUE_LIGAM_O_ADAPTADOR.includes(relativo)).length,
      'nenhuma composição de produção liga o adaptador: o conjunto auditado não é o esperado',
    ).toBeGreaterThan(0);

    // A IGUALDADE. Nunca `toContain`, nunca filtro — e quando reprovar, a mensagem nomeia o arquivo.
    expect(
      culpados,
      `composição de produção ligando o CAPTURADOR de e-mail: ${culpados.join(', ')}`,
    ).toEqual([]);
  });

  it('CT-626 (f) — PROVA DE FALSIFICAÇÃO: as duas formas de alcance são acusadas', () => {
    // As cópias existem só em memória, pela mesma razão dos demais mutantes deste arquivo: gravar no
    // disco deixaria como resíduo um módulo de produção capaz de engolir todo aviso em silêncio.
    const porSimbolo = `import { ${SIMBOLO_DO_CAPTURADOR} } from '@sysloc/regua';`;
    const porCaminho = `import { criar } from '../../packages/regua/src/${MODULO_DO_CAPTURADOR}.js';`;
    const porRenomeEmComentario = `// import { ${SIMBOLO_DO_CAPTURADOR} } from '@sysloc/regua';`;

    expect(alcancaOCapturador(porSimbolo)).toBe(true);
    expect(alcancaOCapturador(porCaminho)).toBe(true);
    // O CONTROLE contra falso positivo, nas duas pontas: importar OUTRO símbolo do mesmo barrel é
    // legítimo e comum — é o que a composição de cada processo faz —, e menção em comentário não é
    // código. Um detector que casasse `from '@sysloc/regua'` reprovaria o repositório íntegro.
    expect(alcancaOCapturador(IMPORT_LEGITIMO_DO_ADAPTADOR)).toBe(false);
    expect(alcancaOCapturador(porRenomeEmComentario)).toBe(false);
  });
});

/** O controle contra falso positivo da âncora simétrica: a composição real de cada processo. */
const IMPORT_LEGITIMO_DO_ADAPTADOR = `import { ${SIMBOLO_DO_ADAPTADOR} } from '@sysloc/regua';`;

describe('CT-626 — a suíte não alcança rede: o adaptador de produção não é instanciado', () => {
  it(
    'CT-626 — nenhum arquivo de teste dos QUATRO diretórios varridos alcança o adaptador',
    async () => {
      const fontes: string[] = [];
      const contribuicoes: number[] = [];
      for (const diretorio of DIRETORIOS_VARRIDOS) {
        const doDiretorio = await listarFontesTs(`${RAIZ_DO_REPOSITORIO}${diretorio}`);

        contribuicoes.push(doDiretorio.length);
        fontes.push(...doDiretorio);
      }

      const culpados: string[] = [];
      const auditados: string[] = [];
      for (const caminho of fontes) {
        const conteudo = await readFile(caminho, 'utf8');
        const relativo = relative(RAIZ_DO_REPOSITORIO, caminho);

        if (alcancaOAdaptador(conteudo)) {
          culpados.push(relativo);
        }

        // Registrado DEPOIS da leitura E do detector, nunca antes: é a posição que faz esta âncora
        // discriminar um desvio — um `continue` de filtro, um `catch` que engole — inserido em
        // qualquer ponto acima dela. Contar a ITERAÇÃO no topo do corpo, como a versão anterior
        // fazia, era garantido pelo fluxo de controle e não podia falhar por estado nenhum do SUT.
        auditados.push(relativo);
      }

      // Âncoras de não-vacuidade: "nenhum alcance" sobre zero arquivos auditados é verdade vazia, e é
      // assim que esta asserção apodreceria em silêncio. São três, cada uma fecha um caminho
      // diferente para o vácuo, e **todas as três podem falhar**:
      //  (1) cada arquivo listado foi efetivamente lido e submetido ao detector — a lista dos
      //      auditados é igual à das fontes, na ordem, e um arquivo pulado reprova nomeando-o;
      //  (2) a união não desceu abaixo do piso declarado — o alvo ESVAZIADO (não renomeado, que
      //      `listarFontesTs` já faz levantar) reprova aqui, e é o único lugar em que ele reprova;
      //  (3) **cada um dos quatro** diretórios contribuiu, nomeado pela posição.
      expect(auditados).toEqual(fontes.map((caminho) => relative(RAIZ_DO_REPOSITORIO, caminho)));
      expect(
        fontes.length,
        `arquivos varridos: ${String(fontes.length)} · piso declarado: ${String(PISO_DE_FONTES_VARRIDAS)}`,
      ).toBeGreaterThanOrEqual(PISO_DE_FONTES_VARRIDAS);
      expect(
        contribuicoes.every((quantos) => quantos > 0),
        `arquivos por diretório varrido: ${contribuicoes.join(', ')}`,
      ).toBe(true);

      // A IGUALDADE. Nunca `toContain` — o que se afirma é que a lista é VAZIA, e um arquivo novo
      // reprova nomeando o caminho.
      expect(
        culpados.sort(),
        `arquivo de teste alcançando o adaptador de produção de e-mail: ${culpados.join(', ')}`,
      ).toEqual([]);
    },
    LIMITE_DO_CASO_MS,
  );

  it(
    'CT-626 (b) — o MESMO detector reprova as CINCO formas de alcance e as TRÊS pontes, e passa limpo no conteúdo íntegro',
    async () => {
      const integro = await readFile(
        `${RAIZ_DO_REPOSITORIO}packages/db/test/execucao-da-regua.spec.ts`,
        'utf8',
      );

      // Controle: o arquivo que mais instancia a régua no repositório passa limpo.
      expect(alcancaOAdaptador(integro)).toBe(false);

      // M1 — o import do símbolo pela fronteira do pacote, que é a forma mais provável.
      expect(alcancaOAdaptador(`${MUTANTE_POR_SIMBOLO}\n${integro}`)).toBe(true);

      // M2 — o import pelo caminho do módulo, com o símbolo RENOMEADO no ponto do import: o nome do
      // adaptador não aparece em lugar nenhum, e é por isso que o fato 2 existe.
      expect(alcancaOAdaptador(`${MUTANTE_POR_CAMINHO}\n${integro}`)).toBe(true);

      // M3 — o mesmo import, quebrado em várias linhas: é por isso que a varredura é sobre o
      // conteúdo, e não linha a linha. Um detector por linha deixaria esta forma passar.
      expect(
        alcancaOAdaptador(`import {\n  ${SIMBOLO_DO_ADAPTADOR},\n} from '@sysloc/regua';\n`),
      ).toBe(true);

      // M4 — o import de NAMESPACE seguido do acesso ao símbolo. Não tem `{` junto ao `from`, e o
      // especificador é o do pacote: passava com a suíte VERDE na enumeração por sintaxe, e o idioma
      // já está estabelecido no repositório (`import * as` aparece 14 vezes nos quatro alvos, uma
      // delas neste próprio arquivo).
      expect(alcancaOAdaptador(`${MUTANTE_POR_NAMESPACE}\n${integro}`)).toBe(true);

      // M5 — o import DINÂMICO do barrel, com desestruturação. A outra forma medida pelo Gate 1 que
      // passava: a expressão do import dinâmico casava o caminho do MÓDULO, e o barrel não o contém.
      expect(alcancaOAdaptador(`${MUTANTE_POR_BARREL_DINAMICO}\n${integro}`)).toBe(true);

      // Controle negativo do detector: a MENÇÃO em comentário não é código, e não pode acusar — é o
      // defeito registrado na rule de teste, e o que faria a asserção reprovar o código correto.
      expect(alcancaOAdaptador(`// ${MUTANTE_POR_SIMBOLO}\n`)).toBe(false);

      // Controle contra FALSO POSITIVO: o barrel é importado legitimamente por três arquivos dos
      // diretórios varridos. Casar o especificador do pacote sozinho — a saída ingênua para M4 e M5 —
      // acusaria todos eles, e a asserção reprovaria o repositório íntegro.
      expect(alcancaOAdaptador(`${IMPORT_LEGITIMO_DO_BARREL}\n${integro}`)).toBe(false);

      // M6, M7 e M8 — as PONTES de re-exportação com renome, as três medidas pelo Gate 1, e as
      // únicas que o detector por arquivo não pega: quem nomeia o símbolo é a ponte, não o arquivo
      // de teste. Elas reprovam na âncora da LIGAÇÃO, e é ali que estes mutantes correm — cada
      // ponte entra como uma entrada a mais do MESMO conjunto do CT-626 (d), e a igualdade daquele
      // caso deixa de valer nomeando o arquivo-ponte. As duas últimas moravam em diretório que a
      // poda por nome subtraía; a posição delas é ancorada no CT-626 (d), por prefixo.
      const { fontes } = await lerArvoreCarregavel();

      // A comparação é contra a ligação OBSERVADA da árvore, e não contra a lista declarada: o que
      // este caso prova é do DETECTOR — que acrescentar a ponte ao conjunto muda a lista, nomeando
      // o arquivo-ponte —, e não o estado da árvore, que é o que o CT-626 (d) prova. Fixar a lista
      // declarada aqui faria este caso reprovar junto quando houvesse ponte real, com uma mensagem
      // que culpa o mutante em memória — medido, e é diagnóstico enganoso, não detecção a mais.
      const semAPonte = ligamOAdaptador(fontes);

      // A discriminante vem ANTES do laço, e é ela que impede a prova de valer por vácuo: se a
      // árvore real já ligasse o adaptador naquele caminho, acrescentar a ponte não mudaria a lista
      // e o mutante não estaria provando detecção nenhuma. (Substitui o `not.toEqual(semAPonte)` que
      // corria dentro do laço: aquele era implicado pela igualdade acima — a lista com a ponte tem
      // sempre um elemento a mais —, e portanto não podia falhar por estado nenhum do detector.)
      expect(
        PONTES_FORA_DOS_DIRETORIOS_DE_TESTE.filter((ponte) => semAPonte.includes(ponte)),
        'a árvore real já liga o adaptador na posição de uma ponte mutante — a prova do detector seria vácua',
      ).toEqual([]);

      for (const ponte of PONTES_FORA_DOS_DIRETORIOS_DE_TESTE) {
        const comAPonte = ligamOAdaptador([
          ...fontes,
          { relativo: ponte, conteudo: MUTANTE_PONTE_DE_REEXPORTACAO },
        ]);

        expect(comAPonte, `a ponte ${ponte} não foi nomeada pela igualdade da ligação`).toEqual(
          [...semAPonte, ponte].sort(),
        );
      }
    },
    LIMITE_DO_CASO_MS,
  );

  it(
    'CT-626 (d) — em TODA a árvore carregável, quem liga o adaptador são exatamente os arquivos declarados',
    async () => {
      const { fontes: arvore, podados } = await lerArvoreCarregavel();
      const relativos = arvore.map(({ relativo }) => relativo);
      const versionados = await caminhosVersionados();

      // Âncora 1 — o conjunto não encolheu: podar um diretório a mais ou estreitar as extensões
      // deixaria a lista de culpados idêntica e a igualdade abaixo virava verdade vácua.
      expect(
        arvore.length,
        `arquivos carregáveis varridos: ${String(arvore.length)} · piso declarado: ${String(PISO_DE_FONTES_DO_REPOSITORIO)}`,
      ).toBeGreaterThanOrEqual(PISO_DE_FONTES_DO_REPOSITORIO);

      // Âncora 1-A — A PODA, auditada contra o git pela ponta da LISTA DECLARADA. Ela é o que
      // impede o furo da rodada 3 de voltar: `docs` era um nome VERSIONADO na lista, e qualquer
      // diretório assim chamado, em qualquer profundidade, saía do conjunto sem que nada acusasse.
      // Acrescentar um diretório versionado aqui reprova nomeando o nome e um arquivo de exemplo.
      const nomesDePodaQueOGitVersiona = DIRETORIOS_FORA_DO_CAMINHAMENTO.filter((nome) =>
        versionados.some((caminho) => caminho.split('/').includes(nome)),
      ).map((nome) => {
        const exemplo = versionados.find((caminho) => caminho.split('/').includes(nome));

        return `${nome} (versionado, p.ex. ${String(exemplo)})`;
      });

      expect(
        nomesDePodaQueOGitVersiona,
        'nome declarado na poda que o git VERSIONA — podá-lo esconde posição que sobrevive a um checkout limpo',
      ).toEqual([]);

      // Âncora 1-B — A PODA, auditada pela ponta dos CAMINHOS EFETIVAMENTE PODADOS. A ponta acima
      // audita o parâmetro; esta audita o que o caminhamento fez com ele, e por isso pega também a
      // subtração que não passe pela lista. `PODAS_TESTEMUNHAS` a impede de valer por vacuidade.
      const podadosComArquivoVersionado = podados.filter((podado) =>
        versionados.some((caminho) => caminho === podado || caminho.startsWith(`${podado}/`)),
      );

      expect(
        podadosComArquivoVersionado,
        'caminho podado que contém arquivo versionado — a poda subtraiu do conjunto algo que sobrevive a um checkout limpo',
      ).toEqual([]);
      expect(
        podados.filter((podado) => PODAS_TESTEMUNHAS.includes(podado)).sort(),
        'testemunha da poda ausente — a auditoria da poda estaria valendo por vacuidade',
      ).toEqual([...PODAS_TESTEMUNHAS].sort());

      // Âncora 1-C — O COMPLEMENTO, que é o oráculo das DUAS subtrações ao mesmo tempo. As âncoras
      // 1-A e 1-B auditam a poda e continuam aqui pelo diagnóstico específico (dizem QUAL subtração
      // falhou); a afirmação categórica é esta: tudo que o git versiona e o caminhamento não alcança
      // pertence a uma classe DECLARADA como não-carregável. Estreitar a poda, estreitar as
      // extensões, ou plantar um arquivo sem extensão nenhuma (o mutante do Gate 1, carregado por
      // `createRequire`) deposita aqui uma classe que ninguém declarou — e a igualdade a nomeia.
      const doConjuntoVarrido = new Set(relativos);
      const complemento = versionados.filter((caminho) => !doConjuntoVarrido.has(caminho));
      const classesDoComplemento = [...new Set(complemento.map(classeDoCaminho))].sort();
      const naoDeclaradas = classesDoComplemento
        .filter((classe) => !CLASSES_NAO_CARREGAVEIS.includes(classe))
        .map((classe) => {
          const exemplo = complemento.find((caminho) => classeDoCaminho(caminho) === classe);

          return `${classe} (p.ex. ${String(exemplo)})`;
        });
      const declaradasSemArquivo = CLASSES_NAO_CARREGAVEIS.filter(
        (classe) => !classesDoComplemento.includes(classe),
      );

      expect(
        classesDoComplemento,
        `classe versionada FORA do conjunto varrido e não declarada não-carregável: ${naoDeclaradas.join(', ')} · classe declarada de que a árvore não tem mais nenhum arquivo: ${declaradasSemArquivo.join(', ')}`,
      ).toEqual([...CLASSES_NAO_CARREGAVEIS].sort());

      // Âncora 1-D — TOTALIDADE da partição. O complemento não pega o estreitamento do filtro numa
      // classe que a árvore ainda não tem (nenhum arquivo muda de lado); esta pega, porque a classe
      // deixaria de estar declarada dos DOIS lados. É o mutante `MUT-I`, que removia `.mts`.
      expect(
        CLASSES_QUE_O_CARREGADOR_RESOLVE.filter(
          (classe) => !EXTENSOES_CARREGAVEIS.includes(classe),
        ),
        'classe que o carregador resolve e que o caminhamento deixou de varrer — módulo dela ficaria invisível às duas âncoras',
      ).toEqual([]);

      // Âncora 1-E — DISJUNÇÃO das duas declarações. Sem ela, a saída fácil para a 1-C reprovada
      // seria declarar não-carregável uma classe que o carregador resolve — o complemento voltaria
      // ao verde e o conjunto varrido ficaria menor, que é o defeito, não o conserto.
      expect(
        EXTENSOES_CARREGAVEIS.filter((classe) => CLASSES_NAO_CARREGAVEIS.includes(classe)),
        'classe declarada carregável E não-carregável ao mesmo tempo — a partição deixou de ser partição',
      ).toEqual([]);

      // Âncora 2 — CONTENÇÃO: tudo que a âncora do alcance varre está aqui dentro. É o que liga as
      // duas asserções num fecho só; sem ela, as duas poderiam varrer conjuntos disjuntos e a soma
      // deixaria um vão no meio.
      const dosDiretoriosDeTeste: string[] = [];
      for (const diretorio of DIRETORIOS_VARRIDOS) {
        const doDiretorio = await listarFontesTs(`${RAIZ_DO_REPOSITORIO}${diretorio}`);

        dosDiretoriosDeTeste.push(
          ...doDiretorio.map((caminho) => relative(RAIZ_DO_REPOSITORIO, caminho)),
        );
      }

      expect(dosDiretoriosDeTeste.filter((caminho) => !relativos.includes(caminho))).toEqual([]);

      // Âncora 3 — TESTEMUNHAS nomeadas: cada classe de arquivo que o furo da rodada 2 mostrou
      // faltar está no conjunto. Igualdade sobre o filtro, para que a ausência nomeie qual sumiu.
      expect(
        relativos.filter((caminho) => TESTEMUNHAS_DO_CAMINHAMENTO.includes(caminho)).sort(),
        'testemunha ausente do caminhamento da árvore',
      ).toEqual([...TESTEMUNHAS_DO_CAMINHAMENTO].sort());

      // Âncora 3-A — TESTEMUNHAS POR EXTENSÃO: estreitar a lista de extensões faria uma ponte
      // `.tsx` ou `.cjs` sumir do conjunto com a igualdade abaixo intacta. Sobrevive a renome do
      // arquivo que hospeda a classe — que é o que a torna melhor que a testemunha por caminho.
      const extensoesAlcancadas = new Set(relativos.map((caminho) => extname(caminho)));

      expect(
        EXTENSOES_TESTEMUNHAS.filter((extensao) => !extensoesAlcancadas.has(extensao)),
        'classe de extensão que o caminhamento deixou de alcançar',
      ).toEqual([]);

      // Âncora 3-B — TESTEMUNHAS POR PREFIXO: as duas posições em que o Gate 1 plantou ponte na
      // rodada 3 e a suíte ficou verde. É a metade da prova daqueles mutantes que a cópia em
      // memória do CT-626 (b) não alcança — que o caminhamento CHEGA à posição.
      expect(
        PREFIXOS_ALCANCADOS_PELO_CAMINHAMENTO.filter(
          (prefixo) => !relativos.some((caminho) => caminho.startsWith(prefixo)),
        ),
        'posição da árvore que o caminhamento deixou de alcançar — ponte plantada ali ficaria invisível',
      ).toEqual([]);

      // A IGUALDADE da ligação. Nunca `toContain`, nunca filtro: a ponte de re-exportação reprova
      // AQUI, e reprova nomeando o arquivo — em qualquer diretório que sobreviva a um checkout
      // limpo (âncoras 1-A e 1-B) e com qualquer classe que não esteja declarada não-carregável
      // (âncoras 1-C a 1-E), com ou sem renome. Sobre crescer a lista na T8/T10, ver o docblock de
      // `ARQUIVOS_QUE_LIGAM_O_ADAPTADOR`.
      const ligam = ligamOAdaptador(arvore);

      expect(
        ligam,
        `arquivo ligando o adaptador de produção de e-mail: ${ligam.join(', ')}`,
      ).toEqual([...ARQUIVOS_QUE_LIGAM_O_ADAPTADOR]);
    },
    LIMITE_DO_CASO_MS,
  );

  it('CT-626 (e) — a construção mora DENTRO da composição, nunca em escopo de módulo', async () => {
    // A âncora que faltava ao `SUT_IS_CORRECT_BECAUSE` acima. `apps/worker/test/ambiente.spec.ts`
    // importa `apps/worker/src/main.ts`, e é o guarda `ehPontoDeEntrada()` — mais o fato de a
    // construção viver dentro de `principal()` — que impede esse import de construir o adaptador de
    // produção. Sem esta asserção, mover a construção para o escopo de módulo abriria o caminho com
    // a suíte inteira verde: o alcance por diretório de teste continuaria `[]` e a lista de quem
    // liga o adaptador continuaria a mesma.
    const foraDoCorpo: string[] = [];

    for (const [arquivo, funcao] of COMPOSICOES_QUE_CONSTROEM_O_ADAPTADOR) {
      const fonte = await readFile(`${RAIZ_DO_REPOSITORIO}${arquivo}`, 'utf8');
      const { corpo, dentro, fora } = localizarConstrucoes(fonte, funcao);

      // Âncoras antivácuo, por arquivo: a composição existe e a construção foi de fato ENCONTRADA.
      // Sem elas, renomear a função ou a chamada faria a lista de baixo ficar vazia por não haver o
      // que classificar — verdade vácua que aprovaria justamente o rearranjo perigoso.
      expect(corpo, `composição \`${funcao}\` em ${arquivo}`).toBe('encontrado');
      expect(dentro, `construções dentro de \`${funcao}\` em ${arquivo}`).toHaveLength(1);

      foraDoCorpo.push(...fora.map((linha) => `${arquivo}:${linha}`));
    }

    expect(foraDoCorpo).toEqual([]);
  });

  it('CT-626 (e) — PROVA DE FALSIFICAÇÃO: construção em escopo de módulo é acusada', () => {
    // A cópia existe só em memória, pela mesma razão dos demais mutantes deste arquivo. E o símbolo
    // vem CONCATENADO, como em todo este arquivo: escrito por extenso, ele faria a varredura do
    // `CT-626` acusar este próprio detector — o defeito que o cabeçalho descreve.
    const fonte = [
      `import { ${SIMBOLO_DO_ADAPTADOR} } from '@sysloc/regua';`,
      '',
      `const email = ${SIMBOLO_DO_ADAPTADOR}({ urlDoTransporte: '', remetente: '' });`,
      '',
      'async function principal(): Promise<void> {',
      '  usar(email);',
      '}',
      '',
    ].join('\n');

    const { corpo, dentro, fora } = localizarConstrucoes(fonte, 'principal');

    expect(corpo).toBe('encontrado');
    expect(dentro).toEqual([]);
    expect(fora).toEqual([3]);
  });

  it(
    'CT-626 (c) — com `SMTP_URL` hostil, a régua conclui e as capturas são exatamente as candidatas',
    async () => {
      const anterior = process.env.SMTP_URL;

      // A variável é montada DENTRO do caso, e restaurada ao fim: o que se prova é que ela não tem
      // efeito algum sobre a suíte, porque não há quem a leia aqui.
      process.env.SMTP_URL = TRANSPORTE_IMPOSSIVEL;

      try {
        const contexto = await admitirEmpresaNova();
        const cenario = await semearCenario(contexto);

        await emUnidade(contexto, async (tx) => await gravarPoliticaDeAviso(tx, POLITICA_LIGADA));
        await lancar(cenario, DIAS_ATE_VENCER);
        await lancar(cenario, DIAS_DE_ATRASO);

        const capturador = criarCapturadorDeEmail();
        const resultado = await concluirDentroDoLimite(passar(contexto, capturador));

        // O número de capturas é EXATAMENTE o de candidatas, e nenhuma falhou: com o adaptador de
        // produção no lugar do capturador, as duas seriam `FALHOU` com `ECONNREFUSED` — e é essa
        // diferença que prova que nenhuma conexão foi tentada.
        expect(resultado).toStrictEqual({
          candidatas: 2,
          enviadas: 2,
          falhas: 0,
          semDestinatario: 0,
          houveFalha: false,
        } satisfies ResultadoDaRegua);
        expect(capturador.capturas).toHaveLength(resultado.candidatas);
        expect(await contarFalhasRegistradas(contexto)).toBe(0);
      } finally {
        if (anterior === undefined) {
          delete process.env.SMTP_URL;
        } else {
          process.env.SMTP_URL = anterior;
        }
      }
    },
    LIMITE_DO_CASO_MS,
  );
});

// ===========================================================================
// Acessórios do arranjo — nenhum deles alcança o banco fora de uma unidade de trabalho
// ===========================================================================

/** O contexto de uma empresa, como a guarda o publica a partir da sessão. */
interface Contexto {
  readonly empresaId: string;
}

/** O cenário mínimo do CT-626 (c): a empresa e o contrato ativo sob o qual as cobranças nascem. */
interface Cenario {
  readonly contexto: Contexto;
  readonly contratoId: string;
}

/**
 * Corre o trabalho contra um limite **declarado**, e falha nomeando o estouro.
 *
 * É sondagem com teto nomeado, e não espera fixa: o temporizador é sempre liberado, inclusive quando
 * o trabalho termina primeiro — um `setTimeout` pendurado seguraria o encerramento do processo de
 * teste e o transformaria num falso positivo de vazamento de recurso.
 */
async function concluirDentroDoLimite<T>(trabalho: Promise<T>): Promise<T> {
  let disparo: NodeJS.Timeout | undefined;

  const teto = new Promise<never>((_, rejeitar) => {
    disparo = setTimeout(
      () => rejeitar(new Error(`a passagem da régua não concluiu em ${LIMITE_DE_CONCLUSAO_MS} ms`)),
      LIMITE_DE_CONCLUSAO_MS,
    );
  });

  try {
    return await Promise.race([trabalho, teto]);
  } finally {
    clearTimeout(disparo);
  }
}

/** Executa o trabalho sob o contexto informado, dentro de uma unidade de trabalho. */
async function emUnidade<T>(
  contexto: Contexto,
  trabalho: (tx: TransactionSql) => Promise<T>,
): Promise<T> {
  return await contextoDeTenant.executarCom(
    contexto,
    async () => await acesso.emUnidadeDeTrabalho(trabalho),
  );
}

/** Uma passagem da régua pelo caminho da borda: política lida pela porta real, portas injetadas. */
async function passar(contexto: Contexto, email: CapturadorDeEmail): Promise<ResultadoDaRegua> {
  const politica = await emUnidade(contexto, lerPoliticaDeAviso);

  return await executarReguaDaEmpresa({
    politica,
    agora: AGORA,
    candidatas: async () =>
      await emUnidade(contexto, async (tx) => await selecionarCandidatasAoAviso(tx, politica)),
    registrar: async (tentativa) =>
      await emUnidade(contexto, async (tx) => await registrarEnvioDeCobranca(tx, tentativa)),
    email,
  });
}

/** Quantas tentativas com desfecho `FALHOU` o contexto alcança — sem `WHERE empresa_id` (ADR-0008). */
async function contarFalhasRegistradas(contexto: Contexto): Promise<number> {
  return await emUnidade(contexto, async (tx) => {
    const linhas = await tx<{ total: string }[]>`
      SELECT count(*) AS total
        FROM negocio.envio_de_cobranca
       WHERE desfecho = 'FALHOU'::negocio.desfecho_do_aviso
    `;

    return Number(linhas[0]?.total ?? -1);
  });
}

/** O contador que mantém documentos e identificadores distintos entre execuções do arquivo. */
let sequencia = 0;

/** Admite uma empresa nova e devolve o contexto dela — a porta pública, a mesma que o Master usa. */
async function admitirEmpresaNova(): Promise<Contexto> {
  sequencia += 1;

  const criada = await emUnidade(
    CONTEXTO_DE_A,
    async (tx) =>
      await admitirEmpresa(tx, {
        nome: `Imobiliária barreira-${String(sequencia)}`,
        documento: `${String(Date.now()).slice(-8)}${String(sequencia).padStart(6, '0')}`,
      }),
  );

  if (criada === undefined) {
    throw new Error('o arranjo não conseguiu admitir a empresa da barreira');
  }

  return { empresaId: criada.id };
}

/** Cria os cadastros e um contrato **ATIVO**, pelas portas públicas e pelo protocolo da série. */
async function semearCenario(contexto: Contexto): Promise<Cenario> {
  sequencia += 1;
  const marca = `barreira-${String(sequencia)}`;

  const cadastros = await emUnidade(contexto, async (tx) => {
    const conjunto = await criarConjunto(tx, { nome: `Conjunto ${marca}` });

    const imovel = await criarImovel(tx, {
      conjuntoId: conjunto.id,
      nomeImovel: `Imóvel ${marca}`,
      identificadorMunicipal: `IPTU-${marca}`,
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
    });

    const locador = await criarPessoa(tx, 'locador', pessoaDe(`Locador ${marca}`));
    const locatario = await criarPessoa(tx, 'locatario', pessoaDe(`Locatário ${marca}`));

    return { imovelId: imovel.id, locadorId: locador.id, locatarioId: locatario.id };
  });

  const ano = await emUnidade(contexto, lerAnoDaSerieDeContrato);

  await emUnidade(contexto, async (tx) => {
    await garantirContadorDeContrato(tx, ano);
  });

  const contrato = await emUnidade(contexto, async (tx) => {
    const numero = await emitirNumeroDeContrato(tx, ano);

    return await criarContrato(
      tx,
      {
        imovelId: cadastros.imovelId,
        locadorId: cadastros.locadorId,
        locatarioId: cadastros.locatarioId,
        fiadoresIds: [],
        ...TERMOS_DO_CONTRATO,
      },
      { ano, numero },
    );
  });

  await emUnidade(contexto, async (tx) => {
    const ativado = await ativarContrato(tx, contrato.codigo, {
      dataFimLocacao: derivarTerminoDaLocacao(
        TERMOS_DO_CONTRATO.dataInicioLocacao,
        TERMOS_DO_CONTRATO.prazoMeses,
      ),
      valorTotalContrato: derivarValorTotal(
        TERMOS_DO_CONTRATO.valorMensal,
        TERMOS_DO_CONTRATO.prazoMeses,
      ),
    });

    if (ativado === undefined) {
      throw new Error(`o arranjo não conseguiu ativar o contrato ${contrato.codigo}`);
    }
  });

  return { contexto, contratoId: contrato.id };
}

/** Um cadastro de pessoa mínimo — a conferência de dígito verificador é do contrato, não da porta. */
let proximoDocumento = 50_000_000_000;

function pessoaDe(nome: string): DadosDaPessoa {
  proximoDocumento += 1;

  return {
    nome,
    tipoPessoa: 'PESSOA_FISICA',
    documentoPrincipal: String(proximoDocumento),
    rg: null,
    email: 'locatario-barreira@exemplo.invalid',
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

/** Lança uma cobrança pelo protocolo das duas unidades sequenciais da série (ADR-0015). */
async function lancar(cenario: Cenario, diasAteVencimento: number): Promise<void> {
  const ano = await emUnidade(cenario.contexto, lerAnoDaSerieDeCobranca);
  const dataVencimento = await dataDeslocada(cenario.contexto, diasAteVencimento);

  await emUnidade(cenario.contexto, async (tx) => {
    await garantirContadorDeCobranca(tx, ano);
  });

  await emUnidade(cenario.contexto, async (tx) => {
    const numero = await emitirNumeroDeCobranca(tx, ano);

    await criarCobranca(
      tx,
      {
        contratoId: cenario.contratoId,
        natureza: 'ALUGUEL',
        referencia: 'Aluguel de janeiro/2026',
        competencia: COMPETENCIA,
        dataVencimento,
        valorOriginal: VALOR_DA_COBRANCA,
      },
      { ano, numero },
    );
  });
}

/** A data corrente da operação deslocada em `dias` — o relógio nunca é falseado, o dado é que move. */
async function dataDeslocada(contexto: Contexto, dias: number): Promise<string> {
  return await emUnidade(contexto, async (tx) => {
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
