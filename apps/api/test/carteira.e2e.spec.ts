/**
 * A carteira expandida e o caminho feliz da fatia — CT-329 e CT-331. T10 da fatia
 * `cadastro-de-imoveis-e-pessoas`. **A T9 da fatia `contratos-de-locacao` acrescenta o CT-419**, que
 * afirma o contrato vigente nas três superfícies que publicam imóvel.
 *
 * SUT_IS_CORRECT_BECAUSE: o código de produção está certo e era este cabeçalho que descrevia uma
 * suíte de quatro casos. A T9 acrescenta dois `it` e três chaves ao arranjo compartilhado
 * ({@link CHAVES_DO_ARRANJO}), e **nenhuma asserção dos quatro casos anteriores foi alterada,
 * afrouxada ou removida** — em particular, nenhuma igualdade de corpo virou asserção de presença. A
 * única mudança em código anterior é o campo `contratoVigente` na declaração local de
 * {@link ImovelPublicado}, que é crescimento de esquema.
 *
 * ---------------------------------------------------------------------------
 * INVARIANTES
 * ---------------------------------------------------------------------------
 *
 * | Critério | Caso   | Invariante |
 * |---|---|---|
 * | CA-15 | CT-329 | `GET /v1/conjuntos?expandir=imoveis` devolve cada conjunto com os imóveis dele
 * | CA-11 |        | e cada imóvel com os cômodos ordenados por posição e a metragem total — árvore
 * |       |        | **profundamente igual** à composição das leituras individuais —, sem trazer
 * |       |        | registro retirado em nível algum, e sem exigir uma segunda chamada. As
 * |       |        | metragens são `0`, `20.13`, `25.5`, `58.5` e `67.75`. |
 * | CA-15 | CT-329 | Sem `expandir`, o item da lista **não traz a chave `imoveis`** — nem vazia. |
 * | CA-11 | CT-329 | Com `expandir=imoveis&incluirRetirados=true`, o conjunto retirado e o imóvel
 * |       | (b)    | retirado **dentro de conjunto ativo** aparecem, os dois com `retiradoEm`
 * |       |        | preenchido, e o imóvel do conjunto retirado volta junto com o pai. |
 * | CA-15 | CT-329 | A cadeia de consulta recusa nomeando o parâmetro culpado: `expandir` fora da
 * | CA-16 | (c)    | união fechada e `limite` acima do teto respondem `422 CAMPO_INVALIDO` com
 * |       |        | `campo` igual a `expandir` e a `limite` — o teto **recusa**, não trunca. |
 * | CA-01 | CT-331 | O caminho feliz completo: conjunto, imóvel vinculado e as três pessoas nascem
 * | CA-02 |        | em `201` com os valores enviados e `id` em minúsculas; o conjunto consta na
 * | CA-07 |        | listagem; o imóvel devolve `conjuntoId` igual ao do conjunto criado e aparece
 * |       |        | **sob ele** na carteira expandida; e cada pessoa consta na listagem do
 * |       |        | próprio papel e **não** nas dos outros dois. |
 * | CA-14 | CT-419 | O imóvel ocupado por contrato `ATIVO` apresenta `contratoVigente` igual a
 * |       |        | `{ codigo, locatario: { id, nome } }` nas **três** superfícies que publicam
 * |       |        | imóvel — `GET /v1/imoveis/:id`, `GET /v1/imoveis` e
 * |       |        | `GET /v1/conjuntos?expandir=imoveis` —, e o imóvel cujo contrato está **só em
 * |       |        | rascunho** apresenta `null` nas três. As três superfícies concordam sobre o
 * |       |        | corpo INTEIRO do imóvel, campo a campo. |
 * | CA-15 | CT-419 | Retirar o contrato `ATIVO` de circulação **não** libera o imóvel: o campo
 * |       | (b)    | continua preenchido nas três. **Cancelar** libera: o campo vira `null` nas três.
 *
 * Rastreabilidade: `CA-15 → CT-329 (RN-13)`, `CA-11 → CT-329 (RN-05)`,
 * `CA-11 → CT-329 (b) (RN-05)`, `CA-15 → CT-329 (c) (RN-13)`, `CA-16 → CT-329 (c) (RN-12)`,
 * `CA-01 → CT-331 (RN-01)`, `CA-02 → CT-331 (RN-01)`, `CA-07 → CT-331 (RN-04)`,
 * `CA-14 → CT-419 (RN-15)`, `CA-15 → CT-419 (b) (RN-15)`.
 *
 * ===========================================================================
 * DIVERGÊNCIAS DECLARADAS DA T10 — leia antes de comparar com a §6.6
 * ===========================================================================
 *
 * 1. **Os sub-casos com letra não estão na §6.6.** O `CT-329 (b)` recorta os passos 6 do card num
 *    caso próprio porque a invariante dele é a **oposta** da do caso principal — ali nenhum retirado
 *    aparece, aqui todos aparecem —, e reuni-los num `it` só faria a falha de qualquer das duas
 *    apontar para o mesmo lugar. O `CT-329 (c)` existe porque a §6.4 da task declara dois cenários
 *    de erro que a §6.5 não atribui a caso algum; sem ele, `expandir` fora da união fechada e
 *    `limite` acima do teto ficariam sem prova pela rota. A forma com letra é a que esta base já usa
 *    (`CT-310 (b)`, `CT-333 (b)`, `CT-305 (b)`).
 *
 *    O **sub-caso do custo** — a contagem de idas ao banco — não mora aqui: ele é da camada de
 *    dados e vive em `packages/db/test/janela.spec.ts`, junto do `CT-330`. Ele leva a letra **`(d)`**
 *    justamente porque `(b)` e `(c)` são deste arquivo: a sequência de sub-casos de um `CT` é única
 *    no **repositório**, e não por arquivo, e reusar a letra daria a dois casos de critérios e regras
 *    distintos (`CA-11 → RN-05` aqui, `CA-15 → RN-13` lá) o mesmo identificador no mapa `CA → CT` da
 *    fatia.
 * 2. **Há um QUINTO cenário de metragem, além dos quatro do card.** O card fixa `0`, `25.5`,
 *    `67.75` e `58.5`, e os quatro são **exatos em binário** — o docblock de `somarMetragem`
 *    registra que eles *"não pegariam o defeito"* da soma direta em ponto flutuante. Como o eixo
 *    principal deste caso é justamente impedir que a carteira some por conta própria, um quinto
 *    imóvel carrega `10.06 + 10.07`, cuja soma ingênua rende `20.130000000000003`. Sem ele, uma
 *    carteira com soma própria **e correta nos quatro valores do golden** atravessaria a igualdade
 *    profunda sem ser vista.
 * 3. **A §5.1 declara este arquivo, e ele foi criado.** Nenhuma divergência de placement.
 *
 * ===========================================================================
 * O que faz cada caso provar o que ele diz provar
 * ===========================================================================
 *
 * **CT-329 — a comparação é contra a COMPOSIÇÃO DAS LEITURAS INDIVIDUAIS, e é ela que torna a
 * asserção concreta sem contar idas ao banco.** A árvore de referência é montada com as rotas que já
 * existiam antes desta task: `GET /v1/conjuntos` para os conjuntos, `GET /v1/imoveis` para descobrir
 * a que conjunto cada imóvel pertence, e `GET /v1/imoveis/:id` — a leitura **individual** — para
 * cada imóvel. A igualdade profunda entre as duas árvores é o que impede a carteira de virar um
 * segundo caminho de leitura com regras próprias: qualquer campo que ela produza por conta própria
 * (a metragem à frente de todos) diverge aqui.
 *
 * **A ordem da referência é DECLARADA, e não herdada da listagem.** Os imóveis de cada conjunto são
 * ordenados por `(nomeImovel, id)` neste arquivo, que é a ordem que a porta promete. Herdá-la da
 * resposta da listagem faria a asserção concordar com o SUT — uma carteira e uma listagem que
 * ordenassem ambas errado passariam juntas.
 *
 * **CT-329 (b) — o imóvel retirado DENTRO de conjunto ativo é o eixo que só este caso alcança.** O
 * `CT-315` lista por entidade: ele vê o imóvel sumir da lista de imóveis, e não teria como ver um
 * imóvel retirado reaparecendo pendurado num conjunto que circula. É a propagação do predicado ao
 * nível filho, e ela tem os dois sentidos — o retirado some por padrão (caso principal) e volta sob
 * o parâmetro (este caso). Só o par discrimina: sem o segundo, uma carteira que **nunca** trouxesse
 * imóvel algum passaria no primeiro.
 *
 * **CT-331 — a asserção "não aparece nas listagens dos outros papéis" é o que pega a implementação
 * parametrizada que perde o discriminador.** A decisão da fatia é *"um serviço, um esquema base,
 * três montagens"*, e o papel é o único argumento que separa as três superfícies; um caminho que o
 * perdesse devolveria os três cadastros nas três listagens, e todas as asserções de presença
 * continuariam verdes. As de **ausência** são as que reprovam.
 *
 * **E `id` em minúsculas é afirmação de contrato (ADR-0017)**, não cosmética. Ela é **rede** e não
 * prova: o identificador vem do `RETURNING` do banco, e o Postgres renderiza `uuid` sempre em
 * minúsculas — nenhuma mudança no fonte desta fatia a faz reprovar. Ela existe para que uma borda
 * futura que passe a compor o identificador na aplicação seja pega aqui. A prova comportamental da
 * canonização é a do `:id` de ENTRADA, e ela é do `CT-237`, na F1.
 *
 * ===========================================================================
 * MUTANTES EXECUTADOS — os quatro reprovam
 * ===========================================================================
 *
 * A `.claude/rules/testing-stack.md` e o P4 de `.claude/rules/nao-regressao.md` exigem demonstrar que
 * a prova **reprova** com o defeito reintroduzido. Aplicados ao fonte de produção, com a suíte
 * invocada pelo **script do pacote** (`pnpm --filter @sysloc/api test`), nunca por `vitest run`
 * avulso — este arquivo carrega `@sysloc/auth`, `@sysloc/db` e `@sysloc/contracts` pela fronteira do
 * pacote, e um `vitest run` leria o `dist/` da compilação anterior.
 *
 *   * **controle** — árvore íntegra: `18 arquivos, 121 casos, 0 falhas`;
 *   * **MT10-3 · a carteira soma a metragem POR CONTA PRÓPRIA** (`publicarComImoveis` reescrevendo
 *     `metragemTotal` com a soma direta dos cômodos, em vez de devolver a que a porta produziu):
 *     `1 failed | 120 passed`, no **CT-329** — `expected "metragemTotal": 20.130000000000003 to
 *     deeply equal 20.13` na igualdade profunda. É o risco que a decisão **D2** nomeia, e a
 *     divergência **2** do cabeçalho registra por que os quatro valores do golden sozinhos não o
 *     pegariam: os quatro são exatos em binário, e o mutante os acerta — a falha sai **no quinto**;
 *   * **MT10-4 · o predicado de circulação NÃO propaga ao nível filho** (`lerCarteira` chamando
 *     `lerImoveisDeConjuntos` com `SO_EM_CIRCULACAO` fixo, em vez do `opcoes` do nível pai):
 *     `1 failed | 120 passed`, no **CT-329 (b)** — `expected undefined to be defined` no imóvel
 *     retirado que deveria voltar dentro do conjunto ativo sob `incluirRetirados=true`. O `CT-329`
 *     principal e o `CT-315` **atravessam o mutante verdes**, e é literalmente a lacuna que a
 *     observação do card nomeia;
 *   * **MT10-5 · a expansão é ignorada** (o manipulador da listagem chamando `listar` sempre, com
 *     `expandir` lido e descartado): `3 failed | 118 passed` — no **CT-329**, cujos itens voltam com
 *     três chaves onde a referência tem quatro; no **CT-329 (b)**; e no **CT-331**, que procura o
 *     imóvel sob o conjunto na carteira;
 *   * **MT10-6 · o papel deixa de discriminar a listagem** (`SuperficieDeCadastro.listar`
 *     encaminhando `PAPEIS_DE_PESSOA[0]` em vez do papel do controlador): `2 failed | 119 passed`,
 *     no **CT-331** — `locatarios: expected [ Array(1) ] to include '<uuid do locatário>'`, porque a
 *     listagem de locatários passou a devolver locadores — e, na outra suíte, no `CT-315`. As
 *     asserções de **presença** do próprio papel são as que quebram aqui por consequência; a rede
 *     contra o vazamento **para os outros papéis** são as de ausência, que o passo 7 percorre nos
 *     dois sentidos;
 *   * **reversão** — os quatro fontes foram restaurados e conferidos idênticos ao original por
 *     `diff`, e o controle voltou a `121 passed`.
 *
 * **Os três da T9**, medidos sobre a árvore com o contrato vigente já publicado — controle
 * `21 arquivos, 153 casos, 0 falhas`:
 *
 *   * **MT9-1 · a marca de circulação entra no filtro** (`lerContratosVigentesDeImoveis`, em
 *     `packages/db/src/contrato.ts`, acrescentando `AND contrato.retirado_em IS NULL` ao
 *     `status = 'ATIVO'`): `1 failed | 152 passed`, no **CT-419 (b)**. É a RN-15: com o mutante, a
 *     retirada de circulação do contrato **libera o imóvel por via oblíqua**. O `CT-419` principal
 *     atravessa o mutante **verde**, porque nada é retirado ali — a metade (b) é a única rede desta
 *     cláusula;
 *   * **MT9-4 · o filtro de estado sai** (a mesma consulta sem `AND contrato.status = 'ATIVO'`, isto
 *     é, casando **qualquer** contrato do imóvel): `2 failed | 151 passed`, no **CT-419** — o imóvel
 *     cujo contrato está só em `RASCUNHO` deixa de trazer `null` — e no **CT-419 (b)**, porque o
 *     cancelado passa a continuar aparecendo. É o par que discrimina *"tem contrato"* de *"tem
 *     contrato VIGENTE"*;
 *   * **MT9-3 · a borda zera o campo** (`publicar`, em `apps/api/src/imoveis/imovel.service.ts`,
 *     devolvendo `contratoVigente: null` fixo em vez de copiar o que a porta produziu):
 *     `2 failed | 151 passed`, nos **CT-419** e **CT-419 (b)**. Ele mede o que o `CT-420` não alcança:
 *     aquele caso conta invocações na camada de dados e passaria intacto com a borda descartando o
 *     resultado;
 *   * **reversão** — os três fontes foram restaurados e conferidos idênticos ao original por `diff`,
 *     e o controle voltou a `153 passed`.
 *
 * ===========================================================================
 * ISOLAMENTO DE ORDEM — cada caso passa sozinho (Gate 1, rodada 2)
 * ===========================================================================
 *
 * Os dois `describe` deste arquivo **compartilham a sessão e a empresa A**, e o passo 5 do `CT-329`
 * media a carteira INTEIRA contra uma lista fechada de cinco metragens. O `CT-331` grava, na mesma
 * empresa, mais um conjunto e mais um imóvel (*"Ap 1201"*, sem cômodos, `metragemTotal: 0`) — de
 * modo que o `CT-329` só era verde porque o Vitest executa os `describe` na ordem do arquivo. Sob
 * reordenação, execução particionada ou um caso novo inserido entre os dois, a prova principal da
 * task reprovaria **por um motivo que nada tem a ver com o defeito que ela persegue** (AP-08).
 *
 * A correção **recorta o universo medido ao arranjo do próprio caso** — os dois conjuntos ativos
 * que `montarCarteiraDoCaso` criou —, e não afrouxa asserção alguma: `METRAGENS_ESPERADAS` continua
 * sendo comparada por **igualdade sobre lista fechada**, com o quinto cenário (`20.13`) intacto, e
 * o recorte ganhou a âncora de tamanho que impede um filtro vazio de passar despercebido. Foi
 * preferida à separação do `CT-331` em sessão e empresa próprias porque é a menor mudança e não
 * toca a montagem; ela fecha a classe porque **toda escrita futura na empresa A nasce fora do par
 * de identificadores do arranjo** e não pode entrar na medição.
 *
 * As demais asserções do `CT-329` já eram indiferentes ao estado da empresa: a igualdade profunda
 * do passo 3 compara contra a referência **lida ao vivo**, que cresce junto; o passo 4 nomeia os
 * dois retirados; e o passo 6 afirma as chaves de cada item, uma a uma.
 *
 * **Medido depois da correção**, caso a caso, com o filtro por nome (`-t`) sobre este arquivo:
 *
 *   * `CT-329` isolado — `1 passed | 3 skipped`;
 *   * `CT-329 (b)` isolado — `1 passed | 3 skipped`;
 *   * `CT-329 (c)` isolado — `1 passed | 3 skipped`;
 *   * `CT-331` isolado — `1 passed | 3 skipped`;
 *   * **a ordem INVERTIDA**, medida sobre uma cópia descartável deste arquivo com os dois
 *     `describe` trocados de lugar, de modo que o `CT-331` grave **antes** de o `CT-329` medir:
 *     `4 passed`. A mesma cópia com o passo 5 revertido à carteira inteira — a única linha que a
 *     correção mudou — reprova com
 *     `expected [ +0, +0, 20.13, 25.5, 58.5, 67.75 ] to deeply equal [ +0, 20.13, 25.5, 58.5,
 *     67.75 ]`: o segundo `+0` é o *"Ap 1201"* do `CT-331`. É a falsificação do P4 — a correção
 *     passa e a ausência dela reprova, no cenário exato que o defeito exige;
 *   * **`MT10-3` reconfirmado** sobre a asserção corrigida: `1 failed | 120 passed`, no **CT-329** —
 *     a igualdade profunda do passo 3 divergindo em `metragemTotal` no imóvel de `10.06 + 10.07`;
 *   * **`MT10-5` reconfirmado**: `3 failed | 118 passed` — **CT-329**, **CT-329 (b)** e **CT-331**.
 *
 * **Os dois casos da T9 nascem isolados**, e a medição está feita: o arranjo deles é do `beforeAll`
 * do **próprio `describe`**, e o `CT-419 (b)` — que muda o estado do contrato — monta cenário próprio
 * **dentro** do `it`, para não deslocar o que o `CT-419` afirma. Medido caso a caso com o filtro por
 * nome sobre este arquivo: `CT-419` isolado — `1 passed | 5 skipped`; `CT-419 (b)` isolado —
 * `1 passed | 5 skipped`; e os quatro anteriores continuam passando isolados (`CT-329`, `CT-329 (b)`,
 * `CT-329 (c)` e `CT-331`). O conjunto do `CT-419` é **próprio**, de modo que nenhum imóvel dele entra
 * no recorte que o passo 5 do `CT-329` mede.
 *
 * ===========================================================================
 * Precondição privilegiada — pelo caminho REAL, sem símbolo novo e sem cookie forjado
 * ===========================================================================
 *
 * A sessão que age é de uma pessoa `USUARIO_EMPRESA` **da carga**, aberta pela rota pública de
 * entrada. A matriz do perfil dela é o piso (`TELA:resumo`), de modo que as chaves abaixo **faltam
 * de fato** e a concessão por `escreverAjustes` — sob o contexto de tenant da empresa, dentro da
 * unidade de trabalho e com `validarCoerenciaDeAjustes` — é precondição real, e não ruído:
 *
 *   * `TELA:imoveis` — a área que a classe dos controladores de conjunto, imóvel e cômodo exige;
 *   * `TELA:cadastros` — a área das três superfícies de pessoa, e **obrigatória junto da ação**: a
 *     RN-02 do catálogo mapeia `ACAO:excluir_cadastro → TELA:cadastros`, e
 *     `validarCoerenciaDeAjustes` recusa o conjunto que deixasse a ação órfã;
 *   * `ACAO:excluir_cadastro` — a ação sensível das rotas de circulação, sem a qual o `CT-329` não
 *     conseguiria retirar conjunto nem imóvel algum.
 *
 * O efetivo é **afirmado** por `GET /v1/sessao` antes do fluxo: sem essa linha, um `403` inesperado
 * seria indistinguível de um defeito das rotas. **Nenhuma rota recebe `empresaId`**, nenhuma chave é
 * concedida por escrita direta na tabela, e as retiradas acontecem pelas ROTAS reais — nunca por um
 * `UPDATE` em `retirado_em`. Nada é acrescentado a `apps/api/src/**` para que estas provas existam
 * (Iron Law #6).
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

/** Caminhos, relativos à raiz, das seis coleções que este arquivo exercita. */
const COLECAO_DE_CONJUNTOS = `/${PREFIXO_DE_VERSAO}/${CAMINHO_DOS_CONJUNTOS}`;
const COLECAO_DE_IMOVEIS = `/${PREFIXO_DE_VERSAO}/${CAMINHO_DOS_IMOVEIS}`;
const COLECAO_DE_LOCADORES = `/${PREFIXO_DE_VERSAO}/${CAMINHO_DOS_LOCADORES}`;
const COLECAO_DE_LOCATARIOS = `/${PREFIXO_DE_VERSAO}/${CAMINHO_DOS_LOCATARIOS}`;
const COLECAO_DE_FIADORES = `/${PREFIXO_DE_VERSAO}/${CAMINHO_DOS_FIADORES}`;
const COLECAO_DE_CONTRATOS = `/${PREFIXO_DE_VERSAO}/${CAMINHO_DOS_CONTRATOS}`;

/**
 * A mensagem canônica de recusa de campo, escrita por extenso.
 *
 * Literal, e **não** lida de `MENSAGEM_POR_CODIGO`: o `CT-329 (c)` compara corpos inteiros por
 * igualdade, e derivá-la da mesma tabela que o SUT usa faria a asserção concordar consigo mesma.
 */
const MENSAGEM_DE_CAMPO_INVALIDO = 'requisição inválida';

/**
 * O arranjo concedido à sessão que age.
 *
 * Literal, e **não** derivado da exigência declarada nos controladores: derivá-lo faria a asserção
 * concordar com o SUT, e trocar a exigência de uma classe deixaria de reprovar caso algum.
 */
const CHAVES_DO_ARRANJO: readonly ChaveDoCatalogo[] = [
  'TELA:imoveis',
  'TELA:cadastros',
  'ACAO:excluir_cadastro',
  // SUT_IS_CORRECT_BECAUSE: o código de produção está certo e era este arranjo que descrevia o que a
  // suíte precisava **antes** da T9. O `CT-419` monta e ativa contrato pelas ROTAS reais para provar
  // que o imóvel apresenta o vigente nas três superfícies, e sem estas três chaves ele receberia
  // `403` da guarda em vez de exercitar o campo. É **acréscimo puro**: nenhuma chave saiu, nenhuma
  // asserção dos quatro casos anteriores foi alterada, e nenhum deles observa ausência de permissão.
  'TELA:contratos',
  'ACAO:ativar_contrato',
  'ACAO:cancelar_contrato',
];

/** As chaves afirmadas, uma a uma, no efetivo — a precondição que não se supõe. */
const AREA_DOS_IMOVEIS: ChaveDoCatalogo = 'TELA:imoveis';
const AREA_DOS_CADASTROS: ChaveDoCatalogo = 'TELA:cadastros';
const AREA_DOS_CONTRATOS: ChaveDoCatalogo = 'TELA:contratos';
const ACAO_DE_CIRCULACAO: ChaveDoCatalogo = 'ACAO:excluir_cadastro';
const ACAO_DE_ATIVACAO: ChaveDoCatalogo = 'ACAO:ativar_contrato';
const ACAO_DE_CANCELAMENTO: ChaveDoCatalogo = 'ACAO:cancelar_contrato';

/** Forma canônica do UUID, em minúsculas — a chave exposta destas entidades (ADR-0017). */
const PADRAO_UUID_CANONICO = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u;

/**
 * A janela declarada em toda leitura de lista deste arquivo.
 *
 * Explícita, e não o padrão do contrato: os casos comparam árvores INTEIRAS, e uma janela implícita
 * faria a igualdade depender de um valor que este arquivo não declara — se o padrão encolhesse, a
 * comparação passaria sobre duas árvores igualmente truncadas.
 */
const LIMITE_DECLARADO = 50;

/** O teto que o contrato publica, mais um — a entrada que o `CT-329 (c)` exige que RECUSE. */
const LIMITE_ACIMA_DO_TETO = 201;

/** O valor de `expandir` que pede a carteira, e um que a união fechada tem de recusar. */
const EXPANSAO_VALIDA = 'imoveis';
const EXPANSAO_INVALIDA = 'qualquercoisa';

// ---------------------------------------------------------------------------------------------
// O cenário do CT-329 — dois conjuntos ativos, um retirado, e um imóvel retirado dentro de ativo
// ---------------------------------------------------------------------------------------------

const CONJUNTO_AURORA = 'Edifício Aurora — CT-329';
const CONJUNTO_BOREAL = 'Edifício Boreal — CT-329';
const CONJUNTO_RETIRADO = 'Edifício Crepúsculo — CT-329';

/**
 * As metragens totais dos imóveis que circulam **nos dois conjuntos ativos do arranjo**, em ordem
 * crescente. A lista é FECHADA: ela é o conjunto inteiro das metragens daquele recorte, e não uma
 * amostra dele.
 *
 * Os quatro primeiros são os cenários do golden (`sem_comodo`, `um_comodo`, `varios_comodos` e o de
 * duas peças). O `20.13` é o quinto, e a divergência 2 do cabeçalho registra por que ele existe: os
 * quatro do golden são **exatos em binário** e não pegariam uma soma direta em ponto flutuante.
 */
const METRAGENS_ESPERADAS = [0, 20.13, 25.5, 58.5, 67.75] as const;

/** Os cômodos de cada imóvel do cenário, na ordem de acréscimo. `posicao` é do servidor. */
const SEM_COMODOS: readonly ComodoEnviado[] = [];
const UM_COMODO: readonly ComodoEnviado[] = [{ nomeComodo: 'Sala', metragem: 25.5 }];
const VARIOS_COMODOS: readonly ComodoEnviado[] = [
  { nomeComodo: 'Sala', metragem: 25.5 },
  { nomeComodo: 'Quarto', metragem: 30.25 },
  { nomeComodo: 'Cozinha', metragem: 12 },
];
const DUAS_PECAS: readonly ComodoEnviado[] = [
  { nomeComodo: 'Salão', metragem: 33 },
  { nomeComodo: 'Depósito', metragem: 25.5 },
];
/** O par que a soma direta em ponto flutuante rende como `20.130000000000003`. */
const CENTESIMOS_IMPARES: readonly ComodoEnviado[] = [
  { nomeComodo: 'Copa', metragem: 10.06 },
  { nomeComodo: 'Lavabo', metragem: 10.07 },
];

// ---------------------------------------------------------------------------------------------
// O cenário do CT-331 — o caminho feliz, com identificadores exclusivos (AP-08)
// ---------------------------------------------------------------------------------------------

const CONJUNTO_DO_CAMINHO_FELIZ = 'Residencial Aurora';
const IDENTIFICADOR_DO_CAMINHO_FELIZ = '99999.111.2222-3';

/** Um CPF válido por papel — o dígito verificador é conferido pela RN-04. */
const CPF_DO_LOCADOR = '10000013773';
const CPF_DO_LOCATARIO = '10000027480';
const CPF_DO_FIADOR = '10000041122';

// ---------------------------------------------------------------------------------------------
// O cenário do CT-419 — o contrato vigente nas três superfícies (T9)
// ---------------------------------------------------------------------------------------------

/** O conjunto PRÓPRIO do caso: nenhum imóvel dele entra no recorte que o `CT-329` mede. */
const CONJUNTO_DO_CONTRATO_VIGENTE = 'Edifício Vigente — CT-419';

/**
 * Os termos do contrato do arranjo. Nenhum caso deste arquivo afirma coisa alguma sobre eles — o que
 * está sob prova é o par `{ codigo, locatario }` que o imóvel apresenta, e não as derivações da
 * ativação, que são do `CT-413`.
 */
const TERMOS_DO_CONTRATO = {
  dataInicioLocacao: '2026-03-15',
  prazoMeses: 12,
  valorMensal: 2500,
  diaVencimento: 10,
  gerarCobrancasAutomaticamente: true,
  pdfContratoArquivo: null,
} as const;

/**
 * O contador que mantém o documento das partes exclusivo entre as montagens do `CT-419`.
 *
 * Ele é próprio, e não compartilhado com {@link sequenciaDoIdentificador}: os dois numeram coisas
 * diferentes (documento e identificador municipal), e reuni-los faria a numeração de um depender de
 * quantas vezes o outro correu.
 */
let sequenciaDoDocumento = 0;

/**
 * A pessoa que age: `USUARIO_EMPRESA` da empresa A, **da carga**.
 *
 * Ela tem senha definitiva e nenhuma exigência pendente, então a sessão dela nasce **plena** com uma
 * entrada só — e o perfil dela **não** concede `TELA:imoveis` nem `TELA:cadastros`, que é o que torna
 * a concessão do arranjo uma precondição de verdade.
 */
const QUEM_AGE = pessoaSemeada('usuario.a@exemplo.com.br');

let identidade: IdentidadeEfemera;
let fila: FilaEfemera;
let acessoAoNegocio: AcessoAoBanco;
let aplicacao: NestFastifyApplication;
let base: string;
let ambienteAnterior: NodeJS.ProcessEnv;
let cookie: string;

/** Os identificadores que o arranjo do `CT-329` produz e que os casos endereçam pelo nome. */
let auroraId: string;
let borealId: string;
let crepusculoId: string;
let imovelRetiradoId: string;

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

  // Precondição AFIRMADA, e não suposta: sem estas linhas, um `403` nas rotas abaixo seria
  // indistinguível de um defeito delas.
  const sessao = (await pedir(CAMINHO_DA_SESSAO_CORRENTE, { cookie })).corpo as SessaoPublicada;
  expect(sessao.telas).toContain(AREA_DOS_IMOVEIS);
  expect(sessao.telas).toContain(AREA_DOS_CADASTROS);
  expect(sessao.telas).toContain(AREA_DOS_CONTRATOS);
  expect(sessao.acoes).toContain(ACAO_DE_CIRCULACAO);
  expect(sessao.acoes).toContain(ACAO_DE_ATIVACAO);
  expect(sessao.acoes).toContain(ACAO_DE_CANCELAMENTO);

  await montarCarteiraDoCaso();
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

describe('a carteira volta numa consulta só (T10)', () => {
  it(
    'CT-329 — a árvore é idêntica à composição das leituras individuais, sem nenhum retirado',
    async () => {
      // --- Passo 1: a árvore de REFERÊNCIA, montada pelas leituras individuais -------------------
      const referencia = await montarReferencia();

      // --- Passo 2: a carteira, numa chamada só --------------------------------------------------
      const resposta = await pedir(
        `${COLECAO_DE_CONJUNTOS}?limite=${String(LIMITE_DECLARADO)}&expandir=${EXPANSAO_VALIDA}`,
        { cookie },
      );

      expect(resposta.status).toBe(200);

      const carteira = resposta.corpo as PaginaPublicada<ConjuntoComImoveisPublicado>;

      // --- Passo 3: a igualdade PROFUNDA -------------------------------------------------------
      //
      // É esta linha que impede a carteira de virar um segundo caminho de leitura com regras
      // próprias: identificadores, ordem dos cômodos por posição e metragens totais têm de ser os
      // mesmos que as leituras individuais produzem, campo a campo.
      expect(carteira.itens).toEqual(referencia);
      // A âncora de não-vacuidade: sem ela, duas árvores vazias satisfariam a igualdade acima.
      expect(carteira.itens.length).toBeGreaterThan(0);
      // O envelope é o canônico da ADR-0017, e a janela devolvida é a que foi servida.
      expect(carteira.total).toBe(referencia.length);
      expect(carteira.limite).toBe(LIMITE_DECLARADO);
      expect(carteira.deslocamento).toBe(0);

      // --- Passo 4: nenhum retirado, em nível algum ---------------------------------------------
      const idsDosConjuntos = carteira.itens.map((conjunto) => conjunto.id);
      expect(idsDosConjuntos).not.toContain(crepusculoId);

      const idsDosImoveis = carteira.itens.flatMap((conjunto) =>
        conjunto.imoveis.map((imovel) => imovel.id),
      );
      expect(idsDosImoveis).not.toContain(imovelRetiradoId);
      // E a marca é nula em TODOS os níveis — a asserção que pega um retirado que tenha vindo com
      // outro identificador que não os dois nomeados acima.
      for (const conjunto of carteira.itens) {
        expect(conjunto.retiradoEm).toBeNull();
        for (const imovel of conjunto.imoveis) {
          expect(imovel.retiradoEm).toBeNull();
        }
      }

      // --- Passo 5: as metragens dos cinco cenários ---------------------------------------------
      //
      // O quinto (`20.13`) é o que discrimina uma soma feita por conta própria na carteira: os
      // quatro do golden são exatos em binário e uma soma ingênua os acerta.
      //
      // O universo medido é o do **próprio arranjo** — os dois conjuntos ativos que
      // `montarCarteiraDoCaso` criou —, e não a carteira inteira da empresa. A asserção continua
      // sendo IGUALDADE SOBRE LISTA FECHADA: o recorte muda **o que é medido**, não o rigor da
      // comparação, e nenhuma metragem do cenário sai dela. O que ele remove é a dependência de
      // nenhum outro caso ter gravado na empresa A antes deste (AP-08) — o `CT-331` grava, na
      // mesma sessão e na mesma empresa, um sexto imóvel.
      const conjuntosDoArranjo = [auroraId, borealId];
      const doArranjo = carteira.itens.filter((conjunto) =>
        conjuntosDoArranjo.includes(conjunto.id),
      );
      // A âncora do recorte: sem ela, um filtro que não achasse conjunto algum reprovaria adiante,
      // apontando para a soma da metragem em vez de para o arranjo que sumiu.
      expect(doArranjo).toHaveLength(conjuntosDoArranjo.length);

      const metragens = doArranjo
        .flatMap((conjunto) => conjunto.imoveis.map((imovel) => imovel.metragemTotal))
        .sort((esquerda, direita) => esquerda - direita);
      expect(metragens).toEqual([...METRAGENS_ESPERADAS]);

      // --- Passo 6: SEM `expandir`, a resposta não traz a chave de imóveis ----------------------
      //
      // Não é `imoveis: []` — que diria ao cliente que o conjunto não tem imóvel nenhum —, e é por
      // isso que a asserção é sobre as CHAVES do objeto, e não sobre o valor.
      const simples = await pedir(`${COLECAO_DE_CONJUNTOS}?limite=${String(LIMITE_DECLARADO)}`, {
        cookie,
      });

      expect(simples.status).toBe(200);

      const lista = simples.corpo as PaginaPublicada<Record<string, unknown>>;
      expect(lista.itens.length).toBeGreaterThan(0);
      for (const item of lista.itens) {
        expect(Object.keys(item).sort()).toEqual(['id', 'nome', 'retiradoEm']);
      }
    },
    LIMITE_CASO_MS,
  );

  it(
    'CT-329 (b) — com incluirRetirados, os retirados voltam MARCADOS nos dois níveis',
    async () => {
      const resposta = await pedir(
        `${COLECAO_DE_CONJUNTOS}?limite=${String(LIMITE_DECLARADO)}` +
          `&expandir=${EXPANSAO_VALIDA}&incluirRetirados=true`,
        { cookie },
      );

      expect(resposta.status).toBe(200);

      const carteira = resposta.corpo as PaginaPublicada<ConjuntoComImoveisPublicado>;

      // --- O conjunto retirado volta, e volta MARCADO -------------------------------------------
      const crepusculo = carteira.itens.find((conjunto) => conjunto.id === crepusculoId);
      expect(crepusculo).toBeDefined();
      expect(crepusculo?.retiradoEm).not.toBeNull();

      // --- E o imóvel retirado DENTRO de conjunto ATIVO também ----------------------------------
      //
      // É o eixo que só este caso alcança: o `CT-315` lista por entidade e não veria um imóvel
      // retirado pendurado num conjunto que circula. A propagação do predicado ao nível filho tem
      // os dois sentidos, e é o par com o passo 4 do caso principal que discrimina.
      const aurora = carteira.itens.find((conjunto) => conjunto.id === auroraId);
      expect(aurora).toBeDefined();
      expect(aurora?.retiradoEm).toBeNull();

      const retirado = aurora?.imoveis.find((imovel) => imovel.id === imovelRetiradoId);
      expect(retirado).toBeDefined();
      expect(retirado?.retiradoEm).not.toBeNull();

      // --- E os que circulam continuam lá, sem marca -------------------------------------------
      //
      // A âncora que impede "os retirados aparecem" de passar sobre uma carteira que devolvesse
      // TUDO marcado como retirado.
      const emCirculacao = (aurora?.imoveis ?? []).filter((imovel) => imovel.retiradoEm === null);
      expect(emCirculacao.length).toBeGreaterThan(0);
    },
    LIMITE_CASO_MS,
  );

  it(
    'CT-329 (c) — a cadeia de consulta recusa nomeando o parâmetro culpado, e o teto não trunca',
    async () => {
      // --- `expandir` fora da união fechada -----------------------------------------------------
      const expansaoInvalida = await pedir(
        `${COLECAO_DE_CONJUNTOS}?expandir=${EXPANSAO_INVALIDA}`,
        { cookie },
      );

      expect(expansaoInvalida.status).toBe(422);
      // Corpo INTEIRO por igualdade: é esta linha que impede a recusa de ecoar o valor recusado num
      // campo novo.
      expect(expansaoInvalida.corpo).toEqual(campoInvalido('expandir'));

      // --- `limite` acima do teto: RECUSA, não trunca -------------------------------------------
      //
      // Truncar devolveria 200 registros num envelope que afirma `limite: 200`, e o cliente não teria
      // como saber que pediu mais. A asserção do status é o que separa recusar de truncar.
      const acimaDoTeto = await pedir(
        `${COLECAO_DE_CONJUNTOS}?limite=${String(LIMITE_ACIMA_DO_TETO)}`,
        { cookie },
      );

      expect(acimaDoTeto.status).toBe(422);
      expect(acimaDoTeto.corpo).toEqual(campoInvalido('limite'));
    },
    LIMITE_CASO_MS,
  );
});

describe('caminho feliz completo da fatia (T10)', () => {
  it(
    'CT-331 — conjunto, imóvel vinculado e as três pessoas nascem e aparecem onde devem',
    async () => {
      // --- Passo 1: criar o conjunto ------------------------------------------------------------
      const criacaoDoConjunto = await pedir(COLECAO_DE_CONJUNTOS, {
        metodo: 'POST',
        cookie,
        corpo: { nome: CONJUNTO_DO_CAMINHO_FELIZ },
      });

      expect(criacaoDoConjunto.status).toBe(201);

      const conjunto = criacaoDoConjunto.corpo as ConjuntoPublicado;
      expect(conjunto).toEqual({
        id: conjunto.id,
        nome: CONJUNTO_DO_CAMINHO_FELIZ,
        retiradoEm: null,
      });
      expect(conjunto.id).toMatch(PADRAO_UUID_CANONICO);
      expect(conjunto.id).toBe(conjunto.id.toLowerCase());

      // --- Passo 2: ele consta na listagem ------------------------------------------------------
      const listaDeConjuntos = (
        await pedir(`${COLECAO_DE_CONJUNTOS}?limite=${String(LIMITE_DECLARADO)}`, { cookie })
      ).corpo as PaginaPublicada<ConjuntoPublicado>;

      expect(listaDeConjuntos.itens.map((item) => item.id)).toContain(conjunto.id);

      // --- Passo 3: criar o imóvel apontando aquele conjunto ------------------------------------
      const criacaoDoImovel = await pedir(COLECAO_DE_IMOVEIS, {
        metodo: 'POST',
        cookie,
        corpo: corpoDeImovel(conjunto.id, IDENTIFICADOR_DO_CAMINHO_FELIZ, {
          nomeImovel: 'Ap 1201',
          complemento: 'Bloco A',
          observacoes: 'Reformado em 2025',
        }),
      });

      expect(criacaoDoImovel.status).toBe(201);

      const imovel = criacaoDoImovel.corpo as ImovelPublicado;
      // O corpo devolvido carrega os valores enviados, campo a campo — inclusive os dois que
      // aceitam nulo e que o corpo preencheu.
      expect(imovel.conjuntoId).toBe(conjunto.id);
      expect(imovel.nomeImovel).toBe('Ap 1201');
      expect(imovel.identificadorMunicipal).toBe(IDENTIFICADOR_DO_CAMINHO_FELIZ);
      expect(imovel.tipoImovel).toBe('RESIDENCIAL');
      expect(imovel.complemento).toBe('Bloco A');
      expect(imovel.observacoes).toBe('Reformado em 2025');
      expect(imovel.statusLocacao).toBe('DISPONIVEL');
      expect(imovel.comodos).toEqual([]);
      expect(imovel.metragemTotal).toBe(0);
      expect(imovel.retiradoEm).toBeNull();
      expect(imovel.id).toMatch(PADRAO_UUID_CANONICO);
      expect(imovel.id).toBe(imovel.id.toLowerCase());

      // --- Passo 4: a leitura devolve o mesmo vínculo -------------------------------------------
      const leitura = await pedir(`${COLECAO_DE_IMOVEIS}/${imovel.id}`, { cookie });
      expect(leitura.status).toBe(200);
      expect((leitura.corpo as ImovelPublicado).conjuntoId).toBe(conjunto.id);

      // --- Passo 5: a carteira expandida traz o imóvel SOB aquele conjunto ----------------------
      const carteira = (
        await pedir(
          `${COLECAO_DE_CONJUNTOS}?limite=${String(LIMITE_DECLARADO)}&expandir=${EXPANSAO_VALIDA}`,
          { cookie },
        )
      ).corpo as PaginaPublicada<ConjuntoComImoveisPublicado>;

      const naCarteira = carteira.itens.find((item) => item.id === conjunto.id);
      expect(naCarteira).toBeDefined();
      // O imóvel inteiro, e não só o identificador: é a mesma forma que a leitura individual devolve.
      expect(naCarteira?.imoveis).toEqual([leitura.corpo]);

      // --- Passo 6: as três pessoas -------------------------------------------------------------
      const locador = await criarPessoa(COLECAO_DE_LOCADORES, CPF_DO_LOCADOR, 'Ana Locadora');
      const locatario = await criarPessoa(
        COLECAO_DE_LOCATARIOS,
        CPF_DO_LOCATARIO,
        'Bruno Locatário',
      );
      const fiador = await criarPessoa(COLECAO_DE_FIADORES, CPF_DO_FIADOR, 'Carla Fiadora');

      // --- Passo 7: cada uma consta na listagem do PRÓPRIO papel e NÃO nas dos outros dois -------
      //
      // As asserções de AUSÊNCIA são as que pegam a implementação parametrizada que perde o
      // discriminador de papel: as de presença continuariam verdes se as três listagens
      // devolvessem os três cadastros.
      const listagens = [
        { rotulo: 'locadores', alvo: COLECAO_DE_LOCADORES, proprio: locador.id },
        { rotulo: 'locatarios', alvo: COLECAO_DE_LOCATARIOS, proprio: locatario.id },
        { rotulo: 'fiadores', alvo: COLECAO_DE_FIADORES, proprio: fiador.id },
      ] as const;

      for (const listagem of listagens) {
        const pagina = (
          await pedir(`${listagem.alvo}?limite=${String(LIMITE_DECLARADO)}`, { cookie })
        ).corpo as PaginaPublicada<PessoaPublicada>;

        const ids = pagina.itens.map((item) => item.id);

        expect(ids, listagem.rotulo).toContain(listagem.proprio);
        for (const outra of listagens) {
          if (outra.proprio !== listagem.proprio) {
            expect(ids, `${listagem.rotulo} não traz ${outra.rotulo}`).not.toContain(outra.proprio);
          }
        }
      }
    },
    LIMITE_CASO_MS,
  );
});

describe('o contrato vigente nas três superfícies que publicam imóvel (T9)', () => {
  /** O conjunto próprio do caso — nenhum imóvel dele entra no recorte medido pelo `CT-329`. */
  let conjuntoDoCaso: string;

  /** O imóvel ocupado por contrato `ATIVO`, e o que só tem `RASCUNHO`. */
  let imovelOcupado: string;
  let imovelComRascunho: string;

  /** O par `{ codigo, locatario }` que as três superfícies têm de apresentar sobre o ocupado. */
  let vigenteDoOcupado: ContratoVigentePublicado;

  beforeAll(async () => {
    conjuntoDoCaso = await criarConjunto(CONJUNTO_DO_CONTRATO_VIGENTE);

    imovelOcupado = await criarImovelComComodos(conjuntoDoCaso, 'Ap 301', UM_COMODO);
    imovelComRascunho = await criarImovelComComodos(conjuntoDoCaso, 'Ap 302', SEM_COMODOS);

    vigenteDoOcupado = await ocupar(imovelOcupado);

    // O segundo imóvel recebe um contrato que **não é ativado**. É ele que discrimina "tem contrato"
    // de "tem contrato VIGENTE": um filtro que casasse qualquer contrato do imóvel — em vez de
    // `status = 'ATIVO'` — apresentaria este rascunho como se ocupasse o imóvel.
    await montarRascunho(imovelComRascunho);
  }, LIMITE_CASO_MS);

  it(
    'CT-419 — o imóvel ocupado traz o contrato e o locatário nas TRÊS superfícies; o do rascunho traz null',
    async () => {
      // --- Passo 1: a leitura individual ---------------------------------------------------------
      const individualDoOcupado = await lerImovel(imovelOcupado);
      const individualDoRascunho = await lerImovel(imovelComRascunho);

      // Igualdade sobre o objeto INTEIRO — não presença do campo, e não só o código: é ela que prende
      // as duas classes de chave da ADR-0017 no mesmo lugar (o código legível do contrato, o UUID do
      // locatário) e que impede um campo a mais de entrar no objeto sem ser visto.
      expect(individualDoOcupado.contratoVigente).toEqual(vigenteDoOcupado);
      // O negativo que discrimina: o imóvel com contrato **só em rascunho** não é ocupado por ele.
      expect(individualDoRascunho.contratoVigente).toBeNull();

      // --- Passo 2: a listagem -------------------------------------------------------------------
      const listagem = (
        await pedir(`${COLECAO_DE_IMOVEIS}?limite=${String(LIMITE_DECLARADO)}`, { cookie })
      ).corpo as PaginaPublicada<ImovelPublicado>;

      expect(naListagem(listagem, imovelOcupado).contratoVigente).toEqual(vigenteDoOcupado);
      expect(naListagem(listagem, imovelComRascunho).contratoVigente).toBeNull();

      // --- Passo 3: a carteira expandida ---------------------------------------------------------
      //
      // A terceira superfície não tem esquema próprio: `esquemaDoConjuntoComImoveis` reusa
      // `esquemaDoImovel` inteiro (ADR-0016), e é por isso que o campo chega aqui **por
      // consequência**. Afirmá-lo mesmo assim é o que pega uma carteira que voltasse a publicar
      // imóveis por uma tradução própria.
      const naCarteira = await lerCarteiraExpandida(conjuntoDoCaso);

      expect(imovelDaCarteira(naCarteira, imovelOcupado).contratoVigente).toEqual(vigenteDoOcupado);
      expect(imovelDaCarteira(naCarteira, imovelComRascunho).contratoVigente).toBeNull();

      // --- Passo 4: as três superfícies concordam CAMPO A CAMPO ----------------------------------
      //
      // A âncora que nenhuma das três asserções acima dá sozinha: elas comparam cada superfície com o
      // arranjo, e esta compara as superfícies **entre si**, sobre o corpo inteiro do imóvel. É a
      // mesma forma do `CT-307`, que compara os produtores do agregado — e é o que reprovaria uma
      // borda que apresentasse o campo em duas superfícies e o compusesse diferente na terceira.
      expect(naListagem(listagem, imovelOcupado)).toEqual(individualDoOcupado);
      expect(imovelDaCarteira(naCarteira, imovelOcupado)).toEqual(individualDoOcupado);
      expect(naListagem(listagem, imovelComRascunho)).toEqual(individualDoRascunho);
      expect(imovelDaCarteira(naCarteira, imovelComRascunho)).toEqual(individualDoRascunho);
    },
    LIMITE_CASO_MS,
  );

  it(
    'CT-419 (b) — retirar o contrato de circulação NÃO libera o imóvel; cancelar libera',
    async () => {
      // O arranjo é PRÓPRIO deste caso: ele muda o estado do contrato, e reusar o do `CT-419` faria
      // aquele caso depender da ordem de execução (AP-08).
      const imovel = await criarImovelComComodos(conjuntoDoCaso, 'Ap 303', SEM_COMODOS);
      const vigente = await ocupar(imovel);

      expect((await lerImovel(imovel)).contratoVigente).toEqual(vigente);

      // --- Metade 1: a RETIRADA de circulação não muda nada -------------------------------------
      //
      // RN-15: a retirada é de **visibilidade**, não muda o estado e não libera o imóvel. Um
      // `AND retirado_em IS NULL` na leitura em lote faria a retirada virar uma porta lateral para
      // destravar o imóvel sem cancelar o contrato — e é só esta metade que o reprova, nas três
      // superfícies.
      const retirada = await pedir(`${COLECAO_DE_CONTRATOS}/${vigente.codigo}/retirada`, {
        metodo: 'POST',
        cookie,
        corpo: {},
      });
      exigir(retirada, 200, `a retirada do contrato ${vigente.codigo}`);

      const aposRetirada = await lerImovel(imovel);
      expect(aposRetirada.contratoVigente).toEqual(vigente);
      expect(
        naListagem(
          (await pedir(`${COLECAO_DE_IMOVEIS}?limite=${String(LIMITE_DECLARADO)}`, { cookie }))
            .corpo as PaginaPublicada<ImovelPublicado>,
          imovel,
        ).contratoVigente,
      ).toEqual(vigente);
      expect(
        imovelDaCarteira(await lerCarteiraExpandida(conjuntoDoCaso), imovel).contratoVigente,
      ).toEqual(vigente);

      // --- Metade 2: o CANCELAMENTO libera ------------------------------------------------------
      //
      // O par que impede a metade acima de passar sobre uma leitura que nunca zera o campo: se o
      // filtro casasse qualquer estado, o cancelado continuaria aparecendo aqui.
      const cancelamento = await pedir(`${COLECAO_DE_CONTRATOS}/${vigente.codigo}/cancelamento`, {
        metodo: 'POST',
        cookie,
        corpo: {},
      });
      exigir(cancelamento, 200, `o cancelamento do contrato ${vigente.codigo}`);

      expect((await lerImovel(imovel)).contratoVigente).toBeNull();
      expect(
        naListagem(
          (await pedir(`${COLECAO_DE_IMOVEIS}?limite=${String(LIMITE_DECLARADO)}`, { cookie }))
            .corpo as PaginaPublicada<ImovelPublicado>,
          imovel,
        ).contratoVigente,
      ).toBeNull();
      expect(
        imovelDaCarteira(await lerCarteiraExpandida(conjuntoDoCaso), imovel).contratoVigente,
      ).toBeNull();
    },
    LIMITE_CASO_MS,
  );
});

// ---------------------------------------------------------------------------------------------
// O arranjo do CT-419 — o contrato vigente, montado e ativado pelas ROTAS reais
// ---------------------------------------------------------------------------------------------

/**
 * Monta um contrato em `RASCUNHO` sobre o imóvel informado, com locador e locatário **próprios**.
 *
 * As partes são novas a cada chamada porque o documento é único por empresa e a unicidade **alcança
 * os retirados**: reusar uma pessoa faria a segunda montagem depender do que a primeira criou (AP-08).
 * O nome do locatário volta junto porque é ele que as três superfícies têm de apresentar.
 */
async function montarRascunho(imovelId: string): Promise<ContratoVigentePublicado> {
  sequenciaDoDocumento += 1;
  const marca = String(sequenciaDoDocumento).padStart(3, '0');

  const locador = await criarPessoa(
    COLECAO_DE_LOCADORES,
    cpfValido(sequenciaDoDocumento),
    `Locador ${marca}`,
  );

  sequenciaDoDocumento += 1;
  const nomeDoLocatario = `Locatário ${marca}`;
  const locatario = await criarPessoa(
    COLECAO_DE_LOCATARIOS,
    cpfValido(sequenciaDoDocumento),
    nomeDoLocatario,
  );

  const montagem = await pedir(COLECAO_DE_CONTRATOS, {
    metodo: 'POST',
    cookie,
    corpo: {
      imovelId,
      locadorId: locador.id,
      locatarioId: locatario.id,
      fiadoresIds: [],
      ...TERMOS_DO_CONTRATO,
    },
  });
  exigir(montagem, 201, `a montagem do contrato do imóvel ${imovelId}`);

  return {
    codigo: (montagem.corpo as { codigo: string }).codigo,
    locatario: { id: locatario.id, nome: nomeDoLocatario },
  };
}

/** Monta e **ativa** um contrato sobre o imóvel, pelas rotas reais, e devolve o par publicado. */
async function ocupar(imovelId: string): Promise<ContratoVigentePublicado> {
  const vigente = await montarRascunho(imovelId);

  const ativacao = await pedir(`${COLECAO_DE_CONTRATOS}/${vigente.codigo}/ativacao`, {
    metodo: 'POST',
    cookie,
    corpo: {},
  });
  exigir(ativacao, 200, `a ativação do contrato ${vigente.codigo}`);

  return vigente;
}

/** A leitura individual do imóvel, pela rota real. A falha levanta. */
async function lerImovel(imovelId: string): Promise<ImovelPublicado> {
  const leitura = await pedir(`${COLECAO_DE_IMOVEIS}/${imovelId}`, { cookie });
  exigir(leitura, 200, `a leitura individual do imóvel ${imovelId}`);

  return leitura.corpo as ImovelPublicado;
}

/** A carteira expandida, recortada ao conjunto informado. A ausência dele levanta. */
async function lerCarteiraExpandida(conjuntoId: string): Promise<ConjuntoComImoveisPublicado> {
  const resposta = await pedir(
    `${COLECAO_DE_CONJUNTOS}?limite=${String(LIMITE_DECLARADO)}&expandir=${EXPANSAO_VALIDA}`,
    { cookie },
  );
  exigir(resposta, 200, 'a leitura da carteira expandida');

  const carteira = resposta.corpo as PaginaPublicada<ConjuntoComImoveisPublicado>;
  const doCaso = carteira.itens.find((item) => item.id === conjuntoId);

  if (doCaso === undefined) {
    throw new Error(`o conjunto ${conjuntoId} não veio na carteira expandida`);
  }

  return doCaso;
}

/**
 * O imóvel de identificador informado dentro de uma página — a ausência **levanta**.
 *
 * Ela levanta em vez de devolver `undefined` porque um imóvel que sumiu da listagem é falha de
 * arranjo, e `undefined?.contratoVigente` satisfaria silenciosamente um `toBeNull()`.
 */
function naListagem(pagina: PaginaPublicada<ImovelPublicado>, imovelId: string): ImovelPublicado {
  const encontrado = pagina.itens.find((item) => item.id === imovelId);

  if (encontrado === undefined) {
    throw new Error(`o imóvel ${imovelId} não veio na listagem`);
  }

  return encontrado;
}

/** O mesmo, dentro do conjunto da carteira expandida — e pela mesma razão, a ausência levanta. */
function imovelDaCarteira(
  conjunto: ConjuntoComImoveisPublicado,
  imovelId: string,
): ImovelPublicado {
  const encontrado = conjunto.imoveis.find((item) => item.id === imovelId);

  if (encontrado === undefined) {
    throw new Error(`o imóvel ${imovelId} não veio na carteira expandida`);
  }

  return encontrado;
}

// ---------------------------------------------------------------------------------------------
// O arranjo do CT-329 — montado pelas ROTAS reais, no `beforeAll`
// ---------------------------------------------------------------------------------------------

/**
 * Monta a carteira do caso: dois conjuntos ativos com cinco imóveis, um conjunto retirado com um
 * imóvel dentro, e um imóvel retirado dentro de conjunto ativo.
 *
 * Tudo pelas rotas reais — inclusive as duas retiradas, que acontecem por `POST …/retirada` e nunca
 * por um `UPDATE` em `retirado_em`. Escrever a coluna à mão provaria o predicado sem provar que o
 * caminho do produto chega até ele.
 */
async function montarCarteiraDoCaso(): Promise<void> {
  auroraId = await criarConjunto(CONJUNTO_AURORA);
  borealId = await criarConjunto(CONJUNTO_BOREAL);
  crepusculoId = await criarConjunto(CONJUNTO_RETIRADO);

  await criarImovelComComodos(auroraId, 'Ap 001', SEM_COMODOS);
  await criarImovelComComodos(auroraId, 'Ap 002', UM_COMODO);
  await criarImovelComComodos(borealId, 'Ap 003', VARIOS_COMODOS);
  await criarImovelComComodos(borealId, 'Ap 004', DUAS_PECAS);
  await criarImovelComComodos(borealId, 'Ap 005', CENTESIMOS_IMPARES);

  // O imóvel do conjunto RETIRADO: ele próprio circula, e some junto com o pai. É o que prova que a
  // ausência do conjunto leva o nível filho consigo.
  await criarImovelComComodos(crepusculoId, 'Ap 006', UM_COMODO);

  // E o imóvel retirado DENTRO de conjunto ativo — o eixo do `CT-329 (b)`.
  imovelRetiradoId = await criarImovelComComodos(auroraId, 'Ap 007', UM_COMODO);
  const retirada = await pedir(`${COLECAO_DE_IMOVEIS}/${imovelRetiradoId}/retirada`, {
    metodo: 'POST',
    cookie,
    corpo: {},
  });
  exigir(retirada, 200, 'a retirada do imóvel');

  const retiradaDoConjunto = await pedir(`${COLECAO_DE_CONJUNTOS}/${crepusculoId}/retirada`, {
    metodo: 'POST',
    cookie,
    corpo: {},
  });
  exigir(retiradaDoConjunto, 200, 'a retirada do conjunto');
}

/**
 * Monta a árvore de REFERÊNCIA a partir das leituras que já existiam antes desta task.
 *
 * Os conjuntos vêm da listagem simples, na ordem que a porta serve; os imóveis de cada conjunto são
 * descobertos pela listagem de imóveis e **relidos um a um** por `GET /v1/imoveis/:id`, que é a
 * leitura individual que o card manda comparar. A ordenação por `(nomeImovel, id)` é aplicada
 * **aqui**, e não herdada da listagem: herdá-la faria a asserção concordar com o SUT.
 */
async function montarReferencia(): Promise<ConjuntoComImoveisPublicado[]> {
  const conjuntos = (
    await pedir(`${COLECAO_DE_CONJUNTOS}?limite=${String(LIMITE_DECLARADO)}`, { cookie })
  ).corpo as PaginaPublicada<ConjuntoPublicado>;

  const imoveis = (
    await pedir(`${COLECAO_DE_IMOVEIS}?limite=${String(LIMITE_DECLARADO)}`, { cookie })
  ).corpo as PaginaPublicada<ImovelPublicado>;

  const referencia: ConjuntoComImoveisPublicado[] = [];

  for (const conjunto of conjuntos.itens) {
    const doConjunto = imoveis.itens
      .filter((imovel) => imovel.conjuntoId === conjunto.id)
      .sort(porNomeEIdentificador);

    const lidosIndividualmente: ImovelPublicado[] = [];
    for (const imovel of doConjunto) {
      const leitura = await pedir(`${COLECAO_DE_IMOVEIS}/${imovel.id}`, { cookie });
      exigir(leitura, 200, `a leitura individual do imóvel ${imovel.id}`);
      lidosIndividualmente.push(leitura.corpo as ImovelPublicado);
    }

    referencia.push({ ...conjunto, imoveis: lidosIndividualmente });
  }

  return referencia;
}

/** A ordem que a porta promete dentro de cada conjunto: nome, e o identificador como desempate. */
function porNomeEIdentificador(esquerda: ImovelPublicado, direita: ImovelPublicado): number {
  if (esquerda.nomeImovel !== direita.nomeImovel) {
    return esquerda.nomeImovel < direita.nomeImovel ? -1 : 1;
  }

  return esquerda.id < direita.id ? -1 : 1;
}

// ---------------------------------------------------------------------------------------------
// Acessórios de escrita — sempre pelas ROTAS reais
// ---------------------------------------------------------------------------------------------

/** Cria um conjunto pela rota real e devolve o identificador dele. */
async function criarConjunto(nome: string): Promise<string> {
  const resposta = await pedir(COLECAO_DE_CONJUNTOS, { metodo: 'POST', cookie, corpo: { nome } });
  exigir(resposta, 201, `a criação do conjunto "${nome}"`);

  return (resposta.corpo as ConjuntoPublicado).id;
}

/**
 * Cria um imóvel no conjunto informado e acrescenta os cômodos declarados, pelas rotas reais.
 *
 * O identificador municipal sai de um contador de módulo: a unicidade é por empresa e **alcança os
 * retirados**, de modo que um valor reaproveitado faria a segunda criação reprovar por um motivo que
 * nada tem a ver com o caso (AP-08).
 */
async function criarImovelComComodos(
  conjuntoId: string,
  nomeImovel: string,
  comodos: readonly ComodoEnviado[],
): Promise<string> {
  sequenciaDoIdentificador += 1;

  const resposta = await pedir(COLECAO_DE_IMOVEIS, {
    metodo: 'POST',
    cookie,
    corpo: corpoDeImovel(conjuntoId, `12345.678.${String(9000 + sequenciaDoIdentificador)}-1`, {
      nomeImovel,
    }),
  });
  exigir(resposta, 201, `a criação do imóvel "${nomeImovel}"`);

  const imovelId = (resposta.corpo as ImovelPublicado).id;

  for (const comodo of comodos) {
    const acrescimo = await pedir(`${COLECAO_DE_IMOVEIS}/${imovelId}/comodos`, {
      metodo: 'POST',
      cookie,
      corpo: { ...comodo, observacoes: null },
    });
    exigir(acrescimo, 201, `o acréscimo do cômodo "${comodo.nomeComodo}"`);
  }

  return imovelId;
}

/** O contador que mantém o identificador municipal exclusivo entre as criações deste arquivo. */
let sequenciaDoIdentificador = 0;

/** Cria uma pessoa no papel da coleção informada, pela rota real, e devolve o corpo publicado. */
async function criarPessoa(
  colecao: string,
  documentoPrincipal: string,
  nome: string,
): Promise<PessoaPublicada> {
  const resposta = await pedir(colecao, {
    metodo: 'POST',
    cookie,
    corpo: corpoDePessoa(documentoPrincipal, nome),
  });

  expect(resposta.status, `a criação de "${nome}" em ${colecao}`).toBe(201);

  const pessoa = resposta.corpo as PessoaPublicada;
  // Os valores enviados voltam no corpo, e o identificador é o UUID canônico (ADR-0017).
  expect(pessoa.nome).toBe(nome);
  expect(pessoa.documentoPrincipal).toBe(documentoPrincipal);
  expect(pessoa.tipoPessoa).toBe('PESSOA_FISICA');
  expect(pessoa.retiradoEm).toBeNull();
  expect(pessoa.id).toMatch(PADRAO_UUID_CANONICO);
  expect(pessoa.id).toBe(pessoa.id.toLowerCase());

  return pessoa;
}

/**
 * O corpo completo de um imóvel, com o conjunto e o identificador municipal por parâmetro.
 *
 * **`empresaId` não aparece**, e a ausência é o ponto: a empresa sai da sessão, e o `strictObject` do
 * contrato recusaria a chave.
 */
function corpoDeImovel(
  conjuntoId: string,
  identificadorMunicipal: string,
  ajustes: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    conjuntoId,
    nomeImovel: 'Ap 101',
    identificadorMunicipal,
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
    ...ajustes,
  };
}

/** O corpo completo de um cadastro de pessoa — o mesmo nos três papéis, que é a decisão da fatia. */
function corpoDePessoa(documentoPrincipal: string, nome: string): Record<string, unknown> {
  return {
    nome,
    tipoPessoa: 'PESSOA_FISICA',
    documentoPrincipal,
    rg: '123456789',
    email: 'contato@exemplo.com.br',
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
 * Concede as chaves informadas à pessoa, pelo caminho real da camada de dados.
 *
 * Sob o contexto de tenant **da empresa dela** e dentro da unidade de trabalho, com a coerência
 * ação→tela validada pela função de domínio e o contador incrementado na mesma transação — é o mesmo
 * caminho que a rota do Admin usa por dentro.
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

/**
 * Levanta quando um passo de ARRANJO não respondeu o que se esperava dele.
 *
 * Precondição que falha em silêncio faz o caso reprovar numa asserção adiante, apontando para o
 * lugar errado.
 */
function exigir(resposta: Resposta, status: number, oQue: string): void {
  if (resposta.status !== status) {
    throw new Error(`${oQue} respondeu ${String(resposta.status)}: ${resposta.texto}`);
  }
}

/** A recusa canônica de campo, com o campo nomeado por chamada (ADR-0017). */
function campoInvalido(campo: string): Record<string, unknown> {
  return {
    codigo: CodigoErro.CAMPO_INVALIDO,
    mensagem: MENSAGEM_DE_CAMPO_INVALIDO,
    campo,
  };
}

// ---------------------------------------------------------------------------------------------
// Corpos observados — declarados aqui, e não importados do SUT
// ---------------------------------------------------------------------------------------------

/** Um cômodo como este arquivo o ENVIA — `posicao` é do servidor e não entra no corpo. */
interface ComodoEnviado {
  readonly nomeComodo: string;
  readonly metragem: number;
}

/**
 * O envelope de lista da ADR-0017.
 *
 * Declarado aqui, e não importado de `@sysloc/contracts`: derivá-lo do tipo do SUT faria a asserção
 * concordar consigo mesma.
 */
interface PaginaPublicada<T> {
  readonly itens: readonly T[];
  readonly total: number;
  readonly limite: number;
  readonly deslocamento: number;
}

/** Um conjunto como a API o publica. */
interface ConjuntoPublicado {
  readonly id: string;
  readonly nome: string;
  readonly retiradoEm: string | null;
}

/** Um conjunto da carteira expandida — o mesmo, com os imóveis inteiros. */
interface ConjuntoComImoveisPublicado extends ConjuntoPublicado {
  readonly imoveis: readonly ImovelPublicado[];
}

/**
 * O contrato vigente que ocupa o imóvel, como a API o publica.
 *
 * Declarado aqui, e não importado de `@sysloc/contracts`, pela razão de {@link ImovelPublicado}:
 * derivá-lo do tipo do SUT faria a asserção concordar consigo mesma. As **duas classes de chave** da
 * ADR-0017 convivem nele — `codigo` para o contrato, que tem série declarada, e `id` para o
 * locatário, que não tem — e é exatamente isso que o `CT-419` afirma por igualdade.
 */
interface ContratoVigentePublicado {
  readonly codigo: string;
  readonly locatario: { readonly id: string; readonly nome: string };
}

/** Um imóvel como a API o publica, com as três derivadas — as duas da T7 e a da T9. */
interface ImovelPublicado {
  readonly id: string;
  readonly conjuntoId: string;
  readonly nomeImovel: string;
  readonly identificadorMunicipal: string;
  readonly tipoImovel: string;
  readonly logradouro: string;
  readonly numero: string;
  readonly complemento: string | null;
  readonly bairro: string;
  readonly cidade: string;
  readonly estado: string;
  readonly cep: string;
  readonly statusLocacao: string;
  readonly observacoes: string | null;
  readonly comodos: readonly unknown[];
  readonly metragemTotal: number;
  readonly contratoVigente: ContratoVigentePublicado | null;
  readonly retiradoEm: string | null;
}

/** Um cadastro de pessoa como a API o publica, no que este arquivo observa dele. */
interface PessoaPublicada {
  readonly id: string;
  readonly nome: string;
  readonly tipoPessoa: string;
  readonly documentoPrincipal: string;
  readonly retiradoEm: string | null;
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
