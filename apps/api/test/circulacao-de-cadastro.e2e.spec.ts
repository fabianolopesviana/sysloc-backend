/**
 * Circulação de cadastro pelas rotas de conjunto — CT-346 e CT-347. T5 da fatia
 * `cadastro-de-imoveis-e-pessoas`, estendida pela T9 da mesma fatia e pela **T8** da fatia
 * `contratos-de-locacao`.
 *
 * SUT_IS_CORRECT_BECAUSE: o código de produção está certo e era o arranjo deste arquivo que
 * descrevia uma sessão sem alcance à carteira de contratos. A T8 acrescenta o `CT-416`, que precisa
 * de um contrato **vigente** para medir o que mede, e as duas chaves novas de
 * {@link CHAVES_DO_ARRANJO} são **acréscimo puro** — nenhuma saiu, e nenhuma asserção dos cinco casos
 * anteriores foi alterada, afrouxada ou removida.
 *
 * ---------------------------------------------------------------------------
 * INVARIANTES
 * ---------------------------------------------------------------------------
 *
 * | Critério | Caso   | Invariante |
 * |---|---|---|
 * | CA-10 | CT-346 | Depois de `POST /v1/conjuntos/:id/retirada`, `GET /v1/conjuntos/:id` responde
 * | CA-11 |        | `200` com `retiradoEm` preenchido (data-hora ISO) em vez de `404` — sem isso a
 * |       |        | recirculação ficaria inalcançável pela interface. O UUID bem formado e
 * |       |        | inexistente segue respondendo `404` com o corpo canônico. |
 * | CA-10 | CT-347 | Repetir `POST /v1/conjuntos/:id/retirada` sobre um conjunto já retirado
 * | CA-11 |        | responde `200` com corpo **profundamente igual** ao da primeira — a marca não
 * |       |        | é reescrita —, existe **UMA** linha do conjunto no banco, e a recirculação
 * |       |        | seguida de nova retirada produz uma marca **DIFERENTE**. Corpo não vazio nas
 * |       |        | rotas de circulação é recusado com `422` e a marca fica inalterada. |
 *
 * | CA-10 | CT-315 | Nas CINCO entidades — conjunto, imóvel, locador, locatário e fiador — um
 * | CA-11 |        | registro retirado de circulação NÃO consta na listagem padrão e CONSTA na
 * |       |        | listagem com `incluirRetirados=true`, com a marca de retirada preenchida,
 * |       |        | enquanto o registro que permanece em circulação consta nas DUAS com a marca
 * |       |        | nula. A contagem de entidades exercitadas é afirmada em **cinco**. |
 * | CA-10 | CT-316 | Retirar não apaga: depois de `POST /:id/retirada` a linha continua existindo no
 * | CA-11 |        | banco com **todos os campos preservados**, `GET /:id` responde `200` com a marca
 * |       |        | preenchida e a listagem padrão não a traz. `POST /:id/recirculacao` zera a
 * |       |        | marca, devolve o registro à listagem padrão e deixa o estado cru **bit a bit**
 * |       |        | idêntico ao de antes da retirada. |
 *
 * | CA-13 | CT-354 | As duas rotas de circulação exigem a ÁREA **e** a AÇÃO. Uma sessão com
 * | CA-23 |        | `{TELA:cadastros, ACAO:excluir_cadastro}` — conjunto COERENTE, o de quem
 * |       |        | administra locador, locatário e fiador — recebe `403` nas duas, com
 * |       |        | `detalhes.exigido: 'TELA:imoveis'`, e a marca de circulação **não muda**.
 * |       |        | Na direção oposta (área sem ação), `403` com
 * |       |        | `detalhes.exigido: 'ACAO:excluir_cadastro'`. Com as duas, `200`. |
 *
 * | CA-12 | CT-416 | Retirar de circulação um imóvel **`LOCADO` por contrato vigente** é **ACEITO**:
 * |       |        | `200` com `retiradoEm` preenchido, e **nenhum `4xx`** — não existe recusa por
 * |       |        | vínculo (ADR-0014). O corpo devolvido é, tirando a marca, **idêntico** ao de
 * |       |        | antes: `statusLocacao` continua `LOCADO` — retirar é visibilidade e **não
 * |       |        | libera o imóvel** —, e a releitura confirma o persistido. O contrato fica
 * |       |        | **byte a byte** como estava, `ATIVO` e com o mesmo `imovelId`. |
 *
 * Rastreabilidade: `CA-10 → CT-346 (RN-06)`, `CA-11 → CT-346 (RN-05)`, `CA-10 → CT-347 (RN-06)`,
 * `CA-11 → CT-347 (RN-05)`, `CA-13 → CT-354 (RN-08)`, `CA-23 → CT-354 (RN-14)`,
 * `CA-10 → CT-315 (RN-06)`, `CA-11 → CT-315 (RN-05)`, `CA-10 → CT-316 (RN-06)`,
 * `CA-11 → CT-316 (RN-05)`, `CA-12 → CT-416 (RN-15)`.
 *
 * ===========================================================================
 * POR QUE O CT-416 (T8, outra fatia) MORA AQUI — divergência declarada
 * ===========================================================================
 *
 * A §6.6 da T8 manda **estender** esta suíte em vez de abrir arquivo novo, e a razão é a mesma que
 * trouxe o `CT-315` e o `CT-316` para cá: a montagem de retirada e recirculação de imóvel já vive
 * aqui, com aplicação real, banco efêmero e sessão pela rota de entrada. Duplicá-la subiria um segundo
 * Postgres para observar a mesma decisão, e criaria **duas montagens do mesmo fato** — livres para
 * divergir.
 *
 * **O que o CT-416 prova é uma AUSÊNCIA, e é por isso que ele afirma o `200` e o estado, nunca "não
 * deu erro".** A ADR-0014 decidiu que a exclusão lógica **não** tem recusa por vínculo: o cadastro
 * referenciado sai de circulação e quem já o referencia continua legível. Uma conferência de vínculo
 * escrita depois — a forma "cuidadosa" e errada — produziria `4xx` na rota de retirada, e é
 * exatamente isso que a asserção de `200` reprova. As duas metades seguintes fecham a classe: o
 * imóvel continua `LOCADO` (uma retirada que liberasse o imóvel seria porta lateral para destravá-lo
 * sem cancelar o contrato) e o contrato continua `ATIVO` com o mesmo `imovelId`.
 *
 * ---------------------------------------------------------------------------
 * MUTANTE EXECUTADO — MT8-6 (2026-08-09), a prova de que a AUSÊNCIA é falsificável
 * ---------------------------------------------------------------------------
 *
 * Aplicado ao fonte de produção e invocado pelo **script do pacote**
 * (`pnpm --filter @sysloc/api test`), nunca por `vitest run` avulso — este arquivo carrega
 * `@sysloc/auth`, `@sysloc/db` e `@syslocbr/contracts` pela fronteira do pacote.
 *
 *   * **controle** — árvore íntegra: `21 arquivos, 151 casos, 0 falhas`;
 *   * **MT8-6 · a recusa por vínculo inventada** — `ImovelService.definirCirculacao` passa a ler o
 *     imóvel antes de escrever e a recusar com `422 CAMPO_INVALIDO` quando `statusLocacao` é
 *     `'LOCADO'`, que é a forma "cuidadosa" e errada de tratar o vínculo: `1 failed | 150 passed`, no
 *     **`CT-416`** — *"a retirada do imóvel ocupado foi recusada:
 *     {"codigo":"CAMPO_INVALIDO","mensagem":"requisição inválida","campo":"statusLocacao"}: expected
 *     422 to be 200"*. É a medição que impede este caso de ser uma asserção que não pode falhar;
 *   * **reversão** — o fonte foi restaurado do backup e conferido idêntico ao original por `diff -q`
 *     e por `git diff --stat` vazio, `pnpm build` refeito, e o controle voltou a `151 passed`.
 *
 * A âncora deste registro é **simbólica** — `ImovelService.definirCirculacao`, em
 * `apps/api/src/imoveis/imovel.service.ts` —, e nunca número de linha.
 *
 * ===========================================================================
 * POR QUE O CT-315 E O CT-316 (T9) MORAM AQUI — divergência declarada
 * ===========================================================================
 *
 * A §5.1 da T9 lista `apps/api/test/circulacao-de-cadastro.e2e.spec.ts` como arquivo **a criar**, e
 * ele já existia: a T5 o criou para os CT-346, CT-347 e CT-354. Vale a instrução do Gate 2 de testes
 * — *estender a suíte existente sempre que possível* —, e sobrescrevê-lo apagaria três casos, o que é
 * **AP-24**. Estender é o certo aqui por uma razão a mais do que a economia: a prova transversal de
 * circulação precisa da MESMA montagem que este arquivo já tem (aplicação real, banco efêmero, sessão
 * pela rota de entrada) **e** do MESMO efetivo — `TELA:imoveis` para conjunto e imóvel,
 * `TELA:cadastros` para os três papéis, e `ACAO:excluir_cadastro` para as cinco retiradas. Uma
 * segunda montagem em outro arquivo subiria um segundo Postgres para provar a mesma decisão.
 *
 * **CT-315 — o par é o que detecta, e a tabela é escrita uma vez.** Só a metade *"não aparece sem o
 * parâmetro"* ficaria verde numa listagem quebrada que devolvesse vazio; só a metade *"aparece com
 * ele"* ficaria verde numa listagem **sem predicado nenhum**. É o par, por entidade, que discrimina —
 * e é por isso que a tabela cobre as cinco e afirma a própria cardinalidade: uma implementação que
 * escrevesse o predicado consulta a consulta passaria em algumas entidades e falharia em outras, e
 * uma tabela que encolhesse esconderia justamente a que ficou para trás. As cinco compartilham um
 * acessório só; cinco cópias do mesmo corpo é o que não se admite.
 *
 * **CT-316 — a asserção sobre a EXISTÊNCIA da linha é o que separa "retirado" de "removido".** A
 * ADR-0014 diz que nada é apagado, e `200` no `GET /:id` sozinho não prova isso: uma borda que
 * respondesse a partir de cache passaria. A comparação **bit a bit** do estado cru antes e depois do
 * ciclo é a outra metade — ela pega uma recirculação que, de passagem, zere ou reescreva outro campo,
 * que é o defeito que nenhuma asserção sobre a marca alcança.
 *
 * ===========================================================================
 * O que faz cada caso provar o que ele diz provar
 * ===========================================================================
 *
 * **CT-346 — o `retiradoEm` da leitura é EXATAMENTE o da retirada.** Asserir apenas *"`200` e
 * `retiradoEm` não nulo"* passaria com uma leitura que recarimbasse a marca a cada consulta. A
 * igualdade caractere a caractere entre o que a retirada devolveu e o que a leitura devolve é o que
 * separa *"a marca foi gravada"* de *"a resposta parece uma marca"*. O controle do UUID inexistente
 * é a outra metade: sem ele, um `200` para tudo passaria.
 *
 * **CT-347 — a terceira retirada é a asserção que ninguém pensa em escrever.** A igualdade entre a
 * primeira e a segunda retirada prova a idempotência; sozinha, ela é satisfeita por uma implementação
 * que **nunca** reescreve a marca — inclusive depois da recirculação, o que deixaria o conjunto
 * marcado com a data da primeira retirada para sempre. A terceira retirada, com marca **diferente**,
 * é o que discrimina as duas. E a leitura crua de **uma** linha é o que separa "idempotente" de
 * "gravou uma segunda linha e devolveu a primeira".
 *
 * ---------------------------------------------------------------------------
 * DIVERGÊNCIA DECLARADA — o corpo não vazio recusa nomeando `corpo`, e não `retiradoEm`
 * ---------------------------------------------------------------------------
 *
 * O cartão do `CT-347` prevê `campo: 'retiradoEm'` na variante de corpo não vazio. O corpo das rotas
 * de circulação é o objeto **vazio e fechado**, e o Zod v4 reporta a chave desconhecida de um
 * `strictObject` como `unrecognized_keys` com `path: []` — o nome da chave viaja em `keys`, que
 * `validar()` não lê. Publicar `'retiradoEm'` exigiria uma das duas coisas, e as duas estão vedadas:
 *
 *   * **mudar `validar()`** para ler `keys`, o que a §3 da T4 proíbe literalmente (*"esta é uma
 *     extração, não uma melhoria"*) e o `CT-343` protege;
 *   * **declarar `retiradoEm` no esquema de entrada** só para recusá-lo, o que o publicaria no
 *     documento derivado (ADR-0016) como campo do corpo — anunciando ao cliente exatamente o campo
 *     que ele não pode enviar.
 *
 * O campo publicado é, portanto, o `campoPadrao` daquele ponto de chamada: `'corpo'`. É a mesma
 * medição, e a mesma conclusão, que a T4 registrou em `test/validacao.spec.ts` e em
 * `test/campos-fechados.e2e.spec.ts`. **O que o cartão pede de fato — que o corpo não vazio seja
 * recusado e a marca fique intacta — é asserido inteiro.**
 *
 * ===========================================================================
 * MUTANTES EXECUTADOS — os três reprovam, cada um numa asserção diferente
 * ===========================================================================
 *
 * A `.claude/rules/testing-stack.md` e o P4 de `.claude/rules/nao-regressao.md` exigem demonstrar que
 * a prova **reprova** com o defeito reintroduzido. Aplicados ao fonte de produção
 * (`packages/db/src/conjunto.ts`), com a suíte invocada pelo **script do pacote**
 * (`pnpm --filter @sysloc/api test`), nunca por `vitest run` avulso — este arquivo carrega
 * `@sysloc/auth`, `@sysloc/db` e `@syslocbr/contracts` pela fronteira do pacote, e um `vitest run`
 * leria o `dist/` da compilação anterior.
 *
 *   * **controle** — árvore íntegra: `16 arquivos, 102 casos, 0 falhas`;
 *   * **MA1 · a marca é REESCRITA a cada retirada** (`coalesce(retirado_em, now())` vira `now()`, que
 *     é a forma óbvia e errada da idempotência): `1 failed | 101 passed`, no **CT-347** —
 *     `retiradoEm: "…30.522Z"` esperado contra `"…30.572Z"` recebido, cinquenta milissegundos de
 *     diferença entre a primeira e a segunda retirada. É a medida literal de que `200` sozinho não
 *     distingue idempotência de reexecução;
 *   * **MA2 · a recirculação NÃO zera a marca** (o ramo de circulação passa a `retirado_em`, isto é,
 *     a implementação que *"nunca reescreve a marca"* que o cartão nomeia): `1 failed | 101 passed`,
 *     no **CT-347** — `retiradoEm: null` esperado contra o carimbo antigo recebido, na recirculação.
 *     Ele é o mutante que a **última** asserção do caso existe para pegar: sem a recirculação zerar,
 *     a terceira retirada devolveria a marca da primeira, e o conjunto ficaria datado para sempre;
 *   * **MA3 · a leitura por identificador ganha o predicado de circulação** (`AND retirado_em IS
 *     NULL`): `2 failed | 100 passed`, e o primeiro é o **CT-346** — `expected 404 to be 200` na
 *     leitura do retirado. É a recirculação ficando inalcançável pela interface, medida;
 *   * **MA6 · o defeito de segurança da rodada 1 de volta** — as duas rotas de circulação voltam a
 *     declarar `@ExigeChave(ACAO_DE_CIRCULACAO)` no método, isto é, **só a ação**. Medido:
 *     `2 failed | 102 passed`, e os dois são o par que fecha a classe — o **CT-354**
 *     (`retirada: expected 200 to be 403`, a vulnerabilidade literal) e o **CT-355** de
 *     `cobertura-de-autorizacao.e2e.spec.ts`, que a acusa por ESTRUTURA nomeando os dois
 *     manipuladores: `declaração de método que SUBSTITUI a da classe:
 *     ConjuntoController.recircular, ConjuntoController.retirar`. A forma literal do mutante não
 *     compila (`ExigeChaves` fica sem uso); quem repetir a prova deve trocar também a importação;
 *   * **MA7 · o defeito espelhado** — as duas passam a declarar **só a área**: `1 failed | 103
 *     passed`, no **CT-354**, na metade da direção oposta. Ele é o mutante que a segunda metade
 *     daquele caso existe para pegar: sem ela, exigir apenas a área passaria por tudo. Mesma nota
 *     de compilação, mais a constante da ação;
 *   * **reversão** — os fontes foram restaurados e conferidos idênticos ao original por `diff`, e o
 *     controle voltou a `102 passed`.
 *
 * Os mutantes da **T9**, aplicados sobre os mesmos fontes e com a mesma invocação, têm âncora
 * **simbólica** e estão registrados no relatório da task com o modo de falha medido:
 *
 *   * **MT9-5 · o predicado de circulação AUSENTE em três das cinco entidades**
 *     (`predicadoDeCirculacao` de `packages/db/src/cadastro-de-pessoa.ts` passa a devolver `TRUE`
 *     sempre, isto é, a porta dos três papéis perde o recorte por padrão). Medido: `3 failed | 113
 *     passed`, e o primeiro é o **CT-315**, cuja falha **nomeia as entidades**: o retrato mostra
 *     `temRetirado: true` onde se espera `false` em `fiadores`, `locadores` e `locatarios`, enquanto
 *     `conjuntos` e `imoveis` — cujas portas não foram tocadas — seguem verdes. (O serializador do
 *     runner ordena as chaves alfabeticamente, e não na ordem da tabela; é por isso que os três
 *     blocos do diff aparecem antes de `imoveis` e de `locatarios`.) Os outros dois são o **CT-316**,
 *     na âncora de que o retirado sumiu da listagem padrão, e o **CT-312** de
 *     `cadastro-de-pessoas.e2e.spec.ts`, na âncora equivalente — as três medem o mesmo predicado por
 *     caminhos diferentes;
 *   * **MT9-6 · a recirculação zera outro campo de passagem** (`definirCirculacaoDaPessoa` acrescenta
 *     `email = ''` ao `SET`). Medido: `1 failed | 115 passed`, **só** no **CT-316**, na comparação bit
 *     a bit do estado cru — `"email": "pessoa.do.ciclo@exemplo.com.br"` esperado contra `""` recebido.
 *     Nenhuma asserção sobre a marca de retirada o alcança, e é essa ausência que justifica ler a
 *     linha inteira em vez do corpo publicado.
 *
 * **Reversão** — os fontes foram restaurados e conferidos idênticos ao original por `diff`, e o
 * controle voltou a `116 passed`.
 *
 * ===========================================================================
 * Precondição privilegiada — AS DUAS CHAVES, na ordem que a coerência exige
 * ===========================================================================
 *
 * A sessão que age é a de uma pessoa `USUARIO_EMPRESA` **da carga**, aberta pela rota pública de
 * entrada. A matriz do perfil dela é o piso (`TELA:resumo`), de modo que as chaves abaixo **faltam de
 * fato** e a concessão por `escreverAjustes` é precondição real, e não ruído:
 *
 *   * `TELA:imoveis` — a área que a classe do controlador exige nas quatro rotas de cadastro;
 *   * `ACAO:excluir_cadastro` — a ação sensível que as duas rotas de circulação exigem;
 *   * `TELA:cadastros` — **obrigatória junto da ação**, e não por escolha deste arquivo: a RN-02 do
 *     catálogo mapeia `ACAO:excluir_cadastro → TELA:cadastros`, e `validarCoerenciaDeAjustes` recusa
 *     o conjunto que deixasse a ação órfã. Conceder a ação sem a área é literalmente irrepresentável
 *     pelo caminho legítimo, e essa é a ordem que este arranjo respeita.
 *
 * O efetivo é **afirmado** por `GET /v1/sessao` antes do fluxo: sem essa linha, um `403` nas rotas
 * abaixo seria indistinguível de um defeito delas. Nada é acrescentado a `apps/api/src/**` para que
 * estas provas existam (Iron Law #6), nenhuma chave é concedida por escrita direta na tabela, e a
 * retirada acontece pela ROTA real — nunca por um `UPDATE` em `retirado_em`.
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

import { randomBytes, randomUUID } from 'node:crypto';
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
import { CAMINHO_DA_TROCA_DE_SENHA_DO_PRODUTO } from '../src/autenticacao/senha.controller.ts';
import { CAMINHO_DA_SESSAO } from '../src/autenticacao/sessao.controller.ts';
import { CAMINHO_DOS_FIADORES } from '../src/cadastros/fiador.controller.ts';
import { CAMINHO_DOS_LOCADORES } from '../src/cadastros/locador.controller.ts';
import { CAMINHO_DOS_LOCATARIOS } from '../src/cadastros/locatario.controller.ts';
import { ENDERECO_DE_ESCUTA, PREFIXO_DE_VERSAO } from '../src/configuracao/ambiente.ts';
import { CAMINHO_DOS_CONTRATOS } from '../src/contratos/contrato.controller.ts';
import { CAMINHO_DOS_CONJUNTOS } from '../src/imoveis/conjunto.controller.ts';
import { CAMINHO_DOS_IMOVEIS } from '../src/imoveis/imovel.controller.ts';
import { criarAplicacao } from '../src/main.ts';
import { CAMINHO_DOS_USUARIOS } from '../src/usuarios/usuario.controller.ts';
import { cpfValido } from './documento.ts';

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

/** Caminho, relativo à raiz, da coleção de conjuntos — a superfície desta task. */
const CAMINHO_DA_COLECAO = `/${PREFIXO_DE_VERSAO}/${CAMINHO_DOS_CONJUNTOS}`;

/**
 * As mensagens canônicas de cada código, escritas por extenso.
 *
 * Literais, e **não** lidas de `MENSAGEM_POR_CODIGO`: os casos comparam corpos inteiros por
 * igualdade, e derivá-los da mesma tabela que o SUT usa faria a asserção concordar consigo mesma.
 */
const MENSAGEM_DE_CAMPO_INVALIDO = 'requisição inválida';
const MENSAGEM_DE_NAO_ENCONTRADO = 'recurso não encontrado';

/**
 * As três chaves do arranjo, e a razão de serem três está no cabeçalho.
 *
 * Literais, e não derivadas da exigência declarada no controlador: derivá-las faria a asserção
 * concordar com o SUT, e trocar a exigência da classe deixaria de reprovar caso algum.
 */
const CHAVES_DO_ARRANJO: readonly ChaveDoCatalogo[] = [
  'TELA:imoveis',
  'TELA:cadastros',
  'ACAO:excluir_cadastro',
  'TELA:contratos',
  'ACAO:ativar_contrato',
];

/** A área e a ação afirmadas, uma a uma, no efetivo — a precondição que não se supõe. */
const AREA_DO_CADASTRO_DE_IMOVEIS: ChaveDoCatalogo = 'TELA:imoveis';
const ACAO_SENSIVEL: ChaveDoCatalogo = 'ACAO:excluir_cadastro';

/**
 * A área e a ação que o `CT-416` acrescenta ao arranjo — a superfície de contrato (T8).
 *
 * SUT_IS_CORRECT_BECAUSE: o código de produção está certo, e o arranjo é que descrevia uma sessão sem
 * alcance à carteira de contratos. O `CT-416` precisa de um contrato **vigente** sobre o imóvel para
 * medir o que ele mede, e o contrato só nasce e passa a valer pelas rotas reais. O acréscimo é
 * **puro**: nenhuma chave saiu, o efetivo dos cinco casos anteriores continua contendo tudo o que
 * eles afirmam, e o sujeito exclusivo do `CT-354` — que é quem mede ausência de chave — tem efetivo
 * próprio e não é tocado.
 *
 * `TELA:contratos` é **obrigatória junto** de `ACAO:ativar_contrato`, e não escolha deste arquivo: o
 * catálogo mapeia a ação àquela tela, e `validarCoerenciaDeAjustes` recusa o conjunto que deixasse a
 * ação órfã.
 */
const AREA_DOS_CONTRATOS: ChaveDoCatalogo = 'TELA:contratos';
const ACAO_DE_ATIVACAO: ChaveDoCatalogo = 'ACAO:ativar_contrato';

/** Um UUID bem formado que não corresponde a conjunto algum — o controle do `404`. */
const UUID_INEXISTENTE = '00000000-0000-4000-8000-0000000000ff';

/** Caminho, relativo à raiz, da coleção de imóveis — a segunda entidade da prova transversal. */
const CAMINHO_DOS_IMOVEIS_DA_API = `/${PREFIXO_DE_VERSAO}/${CAMINHO_DOS_IMOVEIS}`;

/** Os três caminhos de cadastro de pessoa — as outras três entidades da prova transversal. */
const CAMINHO_DOS_LOCADORES_DA_API = `/${PREFIXO_DE_VERSAO}/${CAMINHO_DOS_LOCADORES}`;
const CAMINHO_DOS_LOCATARIOS_DA_API = `/${PREFIXO_DE_VERSAO}/${CAMINHO_DOS_LOCATARIOS}`;
const CAMINHO_DOS_FIADORES_DA_API = `/${PREFIXO_DE_VERSAO}/${CAMINHO_DOS_FIADORES}`;

/**
 * A janela pedida nas listagens da prova transversal.
 *
 * Declarada, e não deixada no padrão: os casos deste arquivo criam registros ao longo da suíte, e uma
 * página menor que o total faria o registro procurado cair fora dela — a asserção reprovaria por
 * paginação, e não pelo predicado que ela persegue. O valor é o teto que o contrato publica.
 */
const LIMITE_DA_LISTAGEM = 200;

/**
 * Documentos com dígito verificador **válido**, um por registro do `CT-315` e do `CT-316`.
 *
 * Exclusivos deste arquivo e distintos entre si (AP-08): dois registros com o mesmo documento no
 * mesmo papel seriam recusados pela restrição de unicidade, e o caso reprovaria no arranjo em vez de
 * na asserção.
 */
const DOCUMENTOS_DA_CIRCULACAO = Object.freeze({
  locadores: ['10000109614', '10000123366'],
  locatarios: ['10000137073', '10000150762'],
  fiadores: ['10000164470', '10000178187'],
} as const);

/** O documento do único registro do `CT-316` — o do ciclo completo. */
const DOCUMENTO_DO_CICLO = '10000191876';

/**
 * Os sequenciais de que saem os documentos das duas pessoas do `CT-416`.
 *
 * Derivados por {@link cpfValido} em vez de escritos à mão, pela razão que o cabeçalho daquele módulo
 * registra: o dígito de controle é regra de domínio, e um número inventado seria recusado com `422`
 * **no arranjo** — falha no lugar errado. Os valores são altos e afastados dos literais acima
 * justamente para não colidirem com eles: a unicidade de documento por papel **alcança o retirado**
 * (ADR-0014), e um documento repetido produziria `422` onde o caso mede outra coisa.
 */
const SEQUENCIAIS_DO_CONTRATO_VIGENTE: readonly [number, number] = [901, 902];

/** Identificadores municipais dos dois imóveis do `CT-315`, distintos entre si. */
const IDENTIFICADORES_DOS_IMOVEIS: readonly [string, string] = [
  '77777.111.0001-1',
  '77777.111.0002-2',
];

/** O identificador municipal do imóvel do `CT-416` — distinto dos dois acima, pela mesma razão. */
const IDENTIFICADOR_DO_IMOVEL_OCUPADO = '77777.111.0003-3';

/** Caminho, relativo à raiz, da coleção de contratos — a superfície que o `CT-416` arranja. */
const CAMINHO_DOS_CONTRATOS_DA_API = `/${PREFIXO_DE_VERSAO}/${CAMINHO_DOS_CONTRATOS}`;

/** Os termos do contrato do `CT-416` — fixos, e irrelevantes para o que o caso mede. */
const TERMOS_DO_CONTRATO_OCUPANTE = Object.freeze({
  dataInicioLocacao: '2026-01-15',
  prazoMeses: 12,
  valorMensal: 2500,
  diaVencimento: 10,
});

/** Caminho, relativo à raiz, da coleção de pessoas — usado para arranjar o sujeito do CT-354. */
const CAMINHO_DAS_PESSOAS = `/${PREFIXO_DE_VERSAO}/${CAMINHO_DOS_USUARIOS}`;

/** A rota de troca de senha do produto — a única, além da sessão, que a sessão restrita alcança. */
const ROTA_DE_TROCA_DE_SENHA = `/${PREFIXO_DE_VERSAO}/${CAMINHO_DA_TROCA_DE_SENHA_DO_PRODUTO}`;

/** Senha que satisfaz a política de força e não é a de ninguém da carga. */
const SENHA_TROCADA = 'brisa9Verde!';

/**
 * O efetivo do sujeito do CT-354: a ação sensível mais **a área que o CATÁLOGO exige junto dela**.
 *
 * `TELA:imoveis` **não** está aqui, e é essa a ausência sob prova. O conjunto é o que
 * `validarCoerenciaDeAjustes` aceita — `MAPA_ACAO_TELA['ACAO:excluir_cadastro'] === 'TELA:cadastros'`
 * —, isto é, o efetivo legítimo de quem administra locador, locatário e fiador no uso normal do
 * produto. Não é um estado forjado: é o que o Admin concede todo dia.
 */
const CHAVES_DE_QUEM_SO_ADMINISTRA_CADASTROS: readonly ChaveDoCatalogo[] = [
  'TELA:cadastros',
  'ACAO:excluir_cadastro',
];

/** A área da CLASSE do controlador de conjuntos — a que falta ao sujeito do CT-354. */
const AREA_DOS_IMOVEIS: ChaveDoCatalogo = 'TELA:imoveis';

/** A mensagem canônica da recusa de autorização, escrita por extenso. */
const MENSAGEM_DE_ACESSO_NEGADO = 'acesso negado para esta sessão';

/** O Admin da empresa A, **da carga** — usado apenas para CRIAR o sujeito do CT-354. */
const ADMIN_DE_A = pessoaSemeada('admin.a@exemplo.com.br');

/**
 * A pessoa que age: `USUARIO_EMPRESA` da empresa A, **da carga**.
 *
 * Ela tem senha definitiva e nenhuma exigência pendente, então a sessão dela nasce **plena** com uma
 * entrada só — e o perfil dela não concede nenhuma das três chaves do arranjo.
 */
const QUEM_AGE = pessoaSemeada('usuario.a@exemplo.com.br');

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
  await concederA(QUEM_AGE.id, CHAVES_DO_ARRANJO);

  // Precondição AFIRMADA, e não suposta: as DUAS dimensões, porque as rotas de circulação exigem a
  // ação e as de cadastro exigem a área. Sem estas linhas, um `403` abaixo seria indistinguível de
  // um defeito das rotas.
  const sessao = (await pedir(CAMINHO_DA_SESSAO_CORRENTE, { cookie })).corpo as SessaoPublicada;
  expect(sessao.telas).toContain(AREA_DO_CADASTRO_DE_IMOVEIS);
  expect(sessao.acoes).toContain(ACAO_SENSIVEL);
  expect(sessao.telas).toContain(AREA_DOS_CONTRATOS);
  expect(sessao.acoes).toContain(ACAO_DE_ATIVACAO);
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

describe('circulação de cadastro pelas rotas de conjunto (T5)', () => {
  it(
    'CT-346 — o conjunto RETIRADO responde 200 na leitura por id, com a MESMA marca da retirada',
    async () => {
      const conjunto = await criarConjunto('Edifício Retirado');

      // --- A retirada ----------------------------------------------------------------------------
      const retirada = await pedir(`${CAMINHO_DA_COLECAO}/${conjunto.id}/retirada`, {
        metodo: 'POST',
        cookie,
        corpo: {},
      });

      expect(retirada.status).toBe(200);

      const retirado = retirada.corpo as ConjuntoPublicado;
      expect(retirado.retiradoEm).not.toBeNull();
      // Analisável como data-hora: sem esta linha, `retiradoEm: 'sim'` passaria na de cima.
      expect(Number.isNaN(Date.parse(retirado.retiradoEm ?? ''))).toBe(false);

      // --- A leitura do RETIRADO -----------------------------------------------------------------
      //
      // `200`, e não `404`: é isto que torna a recirculação alcançável pela interface, porque a rota
      // que a executa é sobre este mesmo identificador.
      const leitura = await pedir(`${CAMINHO_DA_COLECAO}/${conjunto.id}`, { cookie });
      expect(leitura.status).toBe(200);
      // Corpo INTEIRO por igualdade: o `id` e o `nome` inalterados, e o `retiradoEm` EXATAMENTE
      // igual ao que a retirada devolveu — a igualdade caractere a caractere é o que separa "a marca
      // foi gravada" de "a resposta parece uma marca".
      expect(leitura.corpo).toEqual({
        id: conjunto.id,
        nome: conjunto.nome,
        retiradoEm: retirado.retiradoEm,
      });

      // --- O controle: UUID bem formado e inexistente --------------------------------------------
      //
      // Sem ele, um `200` para tudo passaria em todas as asserções acima.
      const inexistente = await pedir(`${CAMINHO_DA_COLECAO}/${UUID_INEXISTENTE}`, { cookie });
      expect(inexistente.status).toBe(404);
      expect(inexistente.corpo).toEqual({
        codigo: CodigoErro.RECURSO_NAO_ENCONTRADO,
        mensagem: MENSAGEM_DE_NAO_ENCONTRADO,
      });
    },
    LIMITE_CASO_MS,
  );

  it(
    'CT-347 — a retirada é idempotente, e a recirculação faz a retirada seguinte carimbar de novo',
    async () => {
      const conjunto = await criarConjunto('Edifício Idempotente');

      // --- Primeira retirada ---------------------------------------------------------------------
      const primeira = await retirar(conjunto.id);
      expect(primeira.status).toBe(200);
      const marcaDaPrimeira = (primeira.corpo as ConjuntoPublicado).retiradoEm;
      expect(marcaDaPrimeira).not.toBeNull();

      // --- Segunda retirada: corpo PROFUNDAMENTE IGUAL ao da primeira ----------------------------
      //
      // `200` sozinho não distingue idempotência de reexecução. A igualdade do corpo inteiro — e com
      // ela a do `retiradoEm`, caractere a caractere — é a asserção que discrimina as duas.
      const segunda = await retirar(conjunto.id);
      expect(segunda.status).toBe(200);
      expect(segunda.corpo).toEqual(primeira.corpo);

      // --- UMA linha, e não duas -----------------------------------------------------------------
      //
      // Separa "idempotente" de "gravou uma segunda linha e devolveu a primeira".
      expect(await contarLinhasDoConjunto(conjunto.id)).toBe(1);

      // --- Corpo NÃO VAZIO: recusado, e a marca fica intacta -------------------------------------
      //
      // Ver a divergência declarada no cabeçalho para por que o campo nomeado é `corpo`.
      const comCorpo = await pedir(`${CAMINHO_DA_COLECAO}/${conjunto.id}/retirada`, {
        metodo: 'POST',
        cookie,
        corpo: { retiradoEm: '2020-01-01T00:00:00.000Z' },
      });
      expect(comCorpo.status).toBe(422);
      expect(comCorpo.corpo).toEqual({
        codigo: CodigoErro.CAMPO_INVALIDO,
        mensagem: MENSAGEM_DE_CAMPO_INVALIDO,
        campo: 'corpo',
      });
      // A marca é a mesma de antes da tentativa — a recusa não datou a exclusão pelo cliente.
      const aposRecusa = await pedir(`${CAMINHO_DA_COLECAO}/${conjunto.id}`, { cookie });
      expect(aposRecusa.status).toBe(200);
      expect((aposRecusa.corpo as ConjuntoPublicado).retiradoEm).toBe(marcaDaPrimeira);

      // --- Recirculação: a marca ZERA ------------------------------------------------------------
      const recirculacao = await pedir(`${CAMINHO_DA_COLECAO}/${conjunto.id}/recirculacao`, {
        metodo: 'POST',
        cookie,
        corpo: {},
      });
      expect(recirculacao.status).toBe(200);
      expect(recirculacao.corpo).toEqual({
        id: conjunto.id,
        nome: conjunto.nome,
        retiradoEm: null,
      });

      // --- Terceira retirada: marca DIFERENTE ----------------------------------------------------
      //
      // Sem esta asserção, uma implementação que NUNCA reescrevesse a marca — nem depois da
      // recirculação — passaria em tudo o que está acima, e o conjunto ficaria datado com a primeira
      // retirada para sempre.
      const terceira = await retirar(conjunto.id);
      expect(terceira.status).toBe(200);
      const marcaDaTerceira = (terceira.corpo as ConjuntoPublicado).retiradoEm;
      expect(marcaDaTerceira).not.toBeNull();
      expect(marcaDaTerceira).not.toBe(marcaDaPrimeira);

      // E a leitura seguinte reflete a marca NOVA, e não a antiga — a metade que prova que o que
      // mudou foi o estado persistido, e não só o corpo daquela resposta.
      const leituraFinal = await pedir(`${CAMINHO_DA_COLECAO}/${conjunto.id}`, { cookie });
      expect((leituraFinal.corpo as ConjuntoPublicado).retiradoEm).toBe(marcaDaTerceira);
      // E continua sendo UMA linha, depois de três retiradas e uma recirculação (ADR-0014: nada é
      // apagado, e nada é duplicado).
      expect(await contarLinhasDoConjunto(conjunto.id)).toBe(1);
    },
    LIMITE_CASO_MS,
  );

  it(
    'CT-354 — quem tem a AÇÃO e não tem a ÁREA da classe recebe 403 nas duas rotas de circulação',
    async () => {
      // --- Arranjo: o conjunto e a marca de partida, lidos pela sessão que ALCANÇA a superfície ---
      const conjunto = await criarConjunto('Edifício Fronteira de Área');
      const marcaAntes = (
        (await pedir(`${CAMINHO_DA_COLECAO}/${conjunto.id}`, { cookie })).corpo as ConjuntoPublicado
      ).retiradoEm;
      expect(marcaAntes).toBeNull();

      // --- O sujeito: uma pessoa que administra CADASTROS, e nada de imóveis --------------------
      const soCadastros = await pessoaOperandoComSenhaTrocada('so.cadastros');
      await concederA(soCadastros.usuarioId, CHAVES_DE_QUEM_SO_ADMINISTRA_CADASTROS);

      // Precondição AFIRMADA nas TRÊS pontas, e as três importam:
      const efetivo = (await pedir(CAMINHO_DA_SESSAO_CORRENTE, { cookie: soCadastros.cookie }))
        .corpo as SessaoPublicada;
      //   1. ela TEM a ação sensível — sem isso, o `403` viria da ação, e não da área;
      expect(efetivo.acoes).toContain(ACAO_SENSIVEL);
      //   2. ela TEM a área que o catálogo exige junto da ação — o conjunto é COERENTE, e não um
      //      estado impossível montado para o caso;
      expect(efetivo.telas).toContain('TELA:cadastros');
      //   3. ela NÃO tem a área da classe. É a ausência sob prova.
      expect(efetivo.telas).not.toContain(AREA_DOS_IMOVEIS);

      // --- A metade que o defeito deixava visível: ela nem lista -------------------------------
      //
      // Sem ela, "403 na retirada" seria compatível com uma sessão que não alcança nada. Com ela, o
      // caso mostra o absurdo que o defeito produzia: `403` para LER e `200` para RETIRAR.
      const listagem = await pedir(CAMINHO_DA_COLECAO, { cookie: soCadastros.cookie });
      expect(listagem.status).toBe(403);
      expect(listagem.corpo).toEqual({
        codigo: CodigoErro.ACESSO_NEGADO,
        mensagem: MENSAGEM_DE_ACESSO_NEGADO,
        detalhes: { exigido: AREA_DOS_IMOVEIS },
      });

      // --- AS DUAS ROTAS DE CIRCULAÇÃO: 403, nomeando a ÁREA que falta -------------------------
      for (const rota of ['retirada', 'recirculacao'] as const) {
        const recusada = await pedir(`${CAMINHO_DA_COLECAO}/${conjunto.id}/${rota}`, {
          metodo: 'POST',
          cookie: soCadastros.cookie,
          corpo: {},
        });

        expect(recusada.status, rota).toBe(403);
        // Corpo INTEIRO por igualdade, e `exigido` nomeando a ÁREA: é a direção oposta à do
        // `CT-320` (que fixa a AÇÃO quando é ela que falta), e é a que estava aberta. Uma
        // implementação que declarasse só a ação responderia `200` aqui.
        expect(recusada.corpo, rota).toEqual({
          codigo: CodigoErro.ACESSO_NEGADO,
          mensagem: MENSAGEM_DE_ACESSO_NEGADO,
          detalhes: { exigido: AREA_DOS_IMOVEIS },
        });
      }

      // --- E A MARCA NÃO MUDOU ------------------------------------------------------------------
      //
      // A recusa sozinha não prova ausência de efeito: uma implementação que escrevesse e só então
      // recusasse passaria em todas as asserções acima e reprovaria aqui. A leitura é pela sessão
      // que ALCANÇA a superfície, porque a do sujeito acabou de receber `403` na leitura também.
      const marcaDepois = (
        (await pedir(`${CAMINHO_DA_COLECAO}/${conjunto.id}`, { cookie })).corpo as ConjuntoPublicado
      ).retiradoEm;
      expect(marcaDepois).toBe(marcaAntes);

      // --- A DIREÇÃO OPOSTA: com a ÁREA e sem a AÇÃO, recusa nomeando a AÇÃO -------------------
      //
      // `escreverAjustes` substitui o conjunto INTEIRO, então a mesma pessoa passa a ter só a área.
      // Sem esta metade, uma declaração que exigisse **apenas** a área — o defeito espelhado —
      // passaria em tudo acima: o eixo que ela mede é o outro lado da conjunção. É também a direção
      // que o `CT-320` (T11) fixa para as dez rotas de circulação da fatia, aqui exercitada nas
      // duas que já existem.
      await concederA(soCadastros.usuarioId, [AREA_DOS_IMOVEIS]);

      const comAreaSemAcao = (
        await pedir(CAMINHO_DA_SESSAO_CORRENTE, { cookie: soCadastros.cookie })
      ).corpo as SessaoPublicada;
      expect(comAreaSemAcao.telas).toContain(AREA_DOS_IMOVEIS);
      expect(comAreaSemAcao.acoes).not.toContain(ACAO_SENSIVEL);

      // Agora ela LISTA — a área é a que governa a leitura. É a âncora que separa "não alcança
      // nada" de "não alcança a AÇÃO".
      expect((await pedir(CAMINHO_DA_COLECAO, { cookie: soCadastros.cookie })).status).toBe(200);

      for (const rota of ['retirada', 'recirculacao'] as const) {
        const semAcao = await pedir(`${CAMINHO_DA_COLECAO}/${conjunto.id}/${rota}`, {
          metodo: 'POST',
          cookie: soCadastros.cookie,
          corpo: {},
        });

        expect(semAcao.status, rota).toBe(403);
        // A recusa nomeia a AÇÃO, e não a área — que a sessão possui. É o valor que a ordem da
        // conjunção produz, e é literalmente o que a ADR-0011 pede: nomear a chave que faltou.
        expect(semAcao.corpo, rota).toEqual({
          codigo: CodigoErro.ACESSO_NEGADO,
          mensagem: MENSAGEM_DE_ACESSO_NEGADO,
          detalhes: { exigido: ACAO_SENSIVEL },
        });
      }

      expect(
        (
          (await pedir(`${CAMINHO_DA_COLECAO}/${conjunto.id}`, { cookie }))
            .corpo as ConjuntoPublicado
        ).retiradoEm,
      ).toBe(marcaAntes);

      // --- A perna POSITIVA: com a área concedida, as MESMAS rotas passam -----------------------
      //
      // Sem ela, todo o caso seria compatível com uma rota que recusa TUDO — e não diria nada sobre
      // qual chave é a responsável. Concedidas as três (a coerência exige `TELA:cadastros` junto da
      // ação), a mesma sessão retira o mesmo conjunto.
      await concederA(soCadastros.usuarioId, [
        ...CHAVES_DE_QUEM_SO_ADMINISTRA_CADASTROS,
        AREA_DOS_IMOVEIS,
      ]);

      const agoraPassa = await pedir(`${CAMINHO_DA_COLECAO}/${conjunto.id}/retirada`, {
        metodo: 'POST',
        cookie: soCadastros.cookie,
        corpo: {},
      });
      expect(agoraPassa.status).toBe(200);
      expect((agoraPassa.corpo as ConjuntoPublicado).retiradoEm).not.toBeNull();
    },
    LIMITE_CASO_MS,
  );
});

describe('circulação transversal nas cinco entidades (T9)', () => {
  it(
    'CT-315 — o retirado some da listagem padrão e aparece sob o parâmetro, nas CINCO entidades',
    async () => {
      // O conjunto pai dos imóveis: criado uma vez, pela ROTA real, e compartilhado pelas duas
      // criações de imóvel. Sem ele o `conjuntoId` não seria alcançável e a entidade `imoveis`
      // reprovaria no arranjo em vez de na asserção.
      const conjuntoPai = await criarConjunto('Edifício da Prova Transversal');
      const entidades = entidadesSobCirculacao(conjuntoPai.id);

      const observado: Record<string, unknown> = {};

      for (const entidade of entidades) {
        // --- Dois registros por entidade: um permanece, o outro é retirado --------------------
        const emCirculacao = await entidade.criar(0);
        const retirado = await entidade.criar(1);

        // Âncora do estado inicial: os DOIS constam na listagem padrão antes de qualquer retirada.
        // Sem ela, "o retirado não consta" ficaria verde sobre uma listagem que nunca os trouxe.
        const antes = await identificadoresDaListagem(entidade.colecao, false);

        // A retirada acontece pela ROTA real — nunca por um `UPDATE` em `retirado_em`. A coluna
        // escrita à mão provaria o predicado de leitura sem provar que a rota chega a ele.
        const retirada = await pedir(`${entidade.colecao}/${retirado}/retirada`, {
          metodo: 'POST',
          cookie,
          corpo: {},
        });

        const padrao = await itensDaListagem(entidade.colecao, false);
        const comRetirados = await itensDaListagem(entidade.colecao, true);

        observado[entidade.rotulo] = {
          ambosNaListagemInicial: antes.has(emCirculacao) && antes.has(retirado),
          statusDaRetirada: retirada.status,
          // As DUAS metades, lado a lado: só a primeira ficaria verde numa listagem quebrada que
          // devolvesse vazio; só a segunda, numa listagem sem predicado nenhum.
          padrao: {
            temEmCirculacao: padrao.has(emCirculacao),
            temRetirado: padrao.has(retirado),
          },
          comRetirados: {
            temEmCirculacao: comRetirados.has(emCirculacao),
            temRetirado: comRetirados.has(retirado),
          },
          // E a marca, que é o que distingue "o retirado voltou na segunda listagem" de "a segunda
          // listagem devolveu duas linhas quaisquer".
          marcaDoRetiradoPreenchida: comRetirados.get(retirado) !== null,
          marcaDoOutroNula: comRetirados.get(emCirculacao) === null,
        };
      }

      const esperadoPorEntidade = {
        ambosNaListagemInicial: true,
        statusDaRetirada: 200,
        padrao: { temEmCirculacao: true, temRetirado: false },
        comRetirados: { temEmCirculacao: true, temRetirado: true },
        marcaDoRetiradoPreenchida: true,
        marcaDoOutroNula: true,
      };

      // O retrato INTEIRO das cinco entidades numa asserção só: a falha NOMEIA a entidade em que o
      // predicado ficou para trás, que é exatamente o que uma implementação escrita consulta a
      // consulta produz.
      expect(observado).toEqual(
        Object.fromEntries(entidades.map((entidade) => [entidade.rotulo, esperadoPorEntidade])),
      );

      // A contagem de entidades exercitadas, afirmada em CINCO: uma tabela que encolhesse deixaria de
      // provar a entidade que saiu, em silêncio.
      expect(entidades.map((entidade) => entidade.rotulo)).toEqual([
        'conjuntos',
        'imoveis',
        'locadores',
        'locatarios',
        'fiadores',
      ]);
    },
    LIMITE_CASO_MS,
  );

  it(
    'CT-316 — retirar de circulação NÃO apaga a linha, e a recirculação a devolve bit a bit',
    async () => {
      const criacao = await pedir(CAMINHO_DOS_LOCADORES_DA_API, {
        metodo: 'POST',
        cookie,
        corpo: corpoDeLocador(DOCUMENTO_DO_CICLO, 'Pessoa do Ciclo Completo'),
      });
      expect(criacao.status).toBe(201);

      const locador = criacao.corpo as CadastroPublicado;
      const alvo = `${CAMINHO_DOS_LOCADORES_DA_API}/${locador.id}`;

      // --- O estado cru ANTES da retirada, serializado inteiro ---------------------------------
      //
      // A linha inteira, e não os campos que o contrato publica: o que este caso persegue é uma
      // recirculação que zere ou reescreva um campo **de passagem**, e um campo que a projeção
      // esconda é justamente onde isso passaria despercebido.
      const antes = await lerLinhaCrua(TABELA_DO_LOCADOR, locador.id);
      expect(antes).toBeDefined();
      expect(antes?.retirado_em).toBeNull();

      // --- A retirada ---------------------------------------------------------------------------
      const retirada = await pedir(`${alvo}/retirada`, { metodo: 'POST', cookie, corpo: {} });
      expect(retirada.status).toBe(200);
      const marcaDaRetirada = (retirada.corpo as CadastroPublicado).retiradoEm;
      expect(marcaDaRetirada).not.toBeNull();

      // --- NADA foi apagado: a linha existe, com todos os demais campos preservados -------------
      //
      // É a asserção que separa "retirado" de "removido" (ADR-0014). A contagem crua fecha o caso
      // degenerado em que a linha some e outra nasce.
      expect(await contarLinhasDoLocador(locador.id)).toBe(1);
      const depoisDaRetirada = await lerLinhaCrua(TABELA_DO_LOCADOR, locador.id);
      expect(depoisDaRetirada?.retirado_em).not.toBeNull();
      expect(semMarcaDeRetirada(depoisDaRetirada)).toEqual(semMarcaDeRetirada(antes));

      // --- E a leitura por identificador continua alcançando o retirado -------------------------
      //
      // `200`, e não `404`: sem isso a recirculação ficaria inalcançável pela interface, porque a
      // rota que a executa é sobre este mesmo identificador.
      const leitura = await pedir(alvo, { cookie });
      expect(leitura.status).toBe(200);
      expect((leitura.corpo as CadastroPublicado).retiradoEm).toBe(marcaDaRetirada);

      // --- E ele sumiu da listagem padrão -------------------------------------------------------
      expect(
        (await identificadoresDaListagem(CAMINHO_DOS_LOCADORES_DA_API, false)).has(locador.id),
      ).toBe(false);

      // --- A recirculação -----------------------------------------------------------------------
      const recirculacao = await pedir(`${alvo}/recirculacao`, {
        metodo: 'POST',
        cookie,
        corpo: {},
      });
      expect(recirculacao.status).toBe(200);
      expect((recirculacao.corpo as CadastroPublicado).retiradoEm).toBeNull();

      // --- E o estado é BIT A BIT o de antes da retirada ----------------------------------------
      //
      // A linha INTEIRA por igualdade, `retirado_em` incluso: uma recirculação que zerasse a marca e,
      // de passagem, apagasse o e-mail ou reescrevesse o endereço passaria em todas as asserções
      // acima e reprova aqui. Nenhuma cláusula compara empresa, e não precisa: a comparação é do
      // estado consigo mesmo, no contexto da empresa da sessão.
      expect(await lerLinhaCrua(TABELA_DO_LOCADOR, locador.id)).toEqual(antes);

      // E ele voltou à listagem padrão — a metade que prova que o que mudou foi o estado persistido,
      // e não só o corpo daquela resposta.
      expect(
        (await identificadoresDaListagem(CAMINHO_DOS_LOCADORES_DA_API, false)).has(locador.id),
      ).toBe(true);
    },
    LIMITE_CASO_MS,
  );
});

describe('circulação de imóvel OCUPADO por contrato vigente (T8)', () => {
  it(
    'CT-416 — retirar de circulação um imóvel LOCADO é ACEITO, sem recusa por vínculo',
    async () => {
      // --- Arranjo: um imóvel de fato ocupado, pelas rotas reais --------------------------------
      //
      // O `LOCADO` do imóvel é escrito pela ATIVAÇÃO, e não por corpo de requisição — a situação não
      // é informável (decisão fechada da fatia anterior). É por isso que o arranjo passa pela rota
      // de ativação em vez de mandar `statusLocacao` na criação do imóvel: sem o contrato vigente,
      // não haveria vínculo algum, e o caso mediria uma retirada comum.
      const conjunto = await criarConjunto('Edifício do Imóvel Ocupado');
      const imovelId = await criarPelaRota(CAMINHO_DOS_IMOVEIS_DA_API, {
        conjuntoId: conjunto.id,
        nomeImovel: 'Ap Ocupado',
        identificadorMunicipal: IDENTIFICADOR_DO_IMOVEL_OCUPADO,
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

      const locadorId = await criarPelaRota(
        CAMINHO_DOS_LOCADORES_DA_API,
        corpoDeLocador(cpfValido(SEQUENCIAIS_DO_CONTRATO_VIGENTE[0]), 'Locador do Ocupado'),
      );
      const locatarioId = await criarPelaRota(
        CAMINHO_DOS_LOCATARIOS_DA_API,
        corpoDeLocador(cpfValido(SEQUENCIAIS_DO_CONTRATO_VIGENTE[1]), 'Locatário do Ocupado'),
      );

      const criacao = await pedir(CAMINHO_DOS_CONTRATOS_DA_API, {
        metodo: 'POST',
        cookie,
        corpo: {
          imovelId,
          locadorId,
          locatarioId,
          fiadoresIds: [],
          ...TERMOS_DO_CONTRATO_OCUPANTE,
          gerarCobrancasAutomaticamente: true,
        },
      });
      expect(criacao.status, criacao.texto).toBe(201);
      const codigo = (criacao.corpo as { codigo: string }).codigo;

      const ativacao = await pedir(`${CAMINHO_DOS_CONTRATOS_DA_API}/${codigo}/ativacao`, {
        metodo: 'POST',
        cookie,
        corpo: {},
      });
      expect(ativacao.status, ativacao.texto).toBe(200);

      // A precondição do caso é AFIRMADA: o imóvel está de fato ocupado. Sem esta linha, a retirada
      // aceita abaixo não diria nada — ela seria a retirada de um imóvel livre, que o `CT-315` já
      // mede.
      const imovelAntes = await lerImovel(imovelId);
      expect(imovelAntes.statusLocacao).toBe('LOCADO');
      expect(imovelAntes.retiradoEm).toBeNull();

      const contratoAntes = await lerContrato(codigo);
      expect(contratoAntes.status).toBe('ATIVO');
      expect(contratoAntes.imovelId).toBe(imovelId);

      // --- A RETIRADA do imóvel ocupado ---------------------------------------------------------
      //
      // O que este caso prova é uma **ausência**: não existe recusa por vínculo (ADR-0014). A
      // asserção é `toBe(200)` sobre o estado observado, e ela **pode falhar** — qualquer `4xx` que
      // uma conferência de vínculo produzisse reprova nesta linha, com o corpo da recusa na
      // mensagem. Afirmar "não deu erro" seria o que não se admite.
      const retirada = await pedir(`${CAMINHO_DOS_IMOVEIS_DA_API}/${imovelId}/retirada`, {
        metodo: 'POST',
        cookie,
        corpo: {},
      });

      expect(retirada.status, `a retirada do imóvel ocupado foi recusada: ${retirada.texto}`).toBe(
        200,
      );

      const retirado = retirada.corpo as ImovelPublicado;
      expect(retirado.retiradoEm).not.toBeNull();

      // O corpo INTEIRO menos a marca é **idêntico** ao de antes: a retirada é de visibilidade, e o
      // que ela pode tocar é a marca, e nada mais. É esta linha que pega uma implementação que, de
      // passagem, liberasse o imóvel — `statusLocacao` voltaria a `DISPONIVEL` e reprovaria aqui,
      // enquanto qualquer asserção sobre `retiradoEm` continuaria verde.
      expect({ ...retirado, retiradoEm: null }).toEqual(imovelAntes);
      expect(retirado.statusLocacao).toBe('LOCADO');

      // --- E o estado PERSISTIDO das duas entidades ---------------------------------------------
      //
      // A releitura, e não só o corpo da resposta: uma borda que devolvesse o imóvel intacto e
      // gravasse outra coisa passaria em tudo acima.
      const imovelDepois = await lerImovel(imovelId);
      expect(imovelDepois).toEqual(retirado);
      expect(imovelDepois.statusLocacao).toBe('LOCADO');

      // E o contrato ficou byte a byte como estava — `status` ainda `ATIVO` e `imovelId` inalterado.
      // O vínculo continua existindo: o que saiu de circulação foi o cadastro do imóvel, e retirar
      // não é cancelar.
      expect(await lerContrato(codigo)).toEqual(contratoAntes);
    },
    LIMITE_CASO_MS,
  );
});

// ---------------------------------------------------------------------------------------------
// Arranjo do cenário, pelas ROTAS REAIS
// ---------------------------------------------------------------------------------------------

/** Cria um conjunto pela rota real, ou levanta nomeando a recusa. */
async function criarConjunto(nome: string): Promise<ConjuntoPublicado> {
  const criacao = await pedir(CAMINHO_DA_COLECAO, { metodo: 'POST', cookie, corpo: { nome } });

  if (criacao.status !== 201) {
    throw new Error(`a criação de conjunto respondeu ${String(criacao.status)}: ${criacao.texto}`);
  }

  return criacao.corpo as ConjuntoPublicado;
}

/** Retira o conjunto pela ROTA real — nunca por um `UPDATE` em `retirado_em`. */
async function retirar(id: string): Promise<Resposta> {
  return await pedir(`${CAMINHO_DA_COLECAO}/${id}/retirada`, {
    metodo: 'POST',
    cookie,
    corpo: {},
  });
}

// ---------------------------------------------------------------------------------------------
// A TABELA da prova transversal — escrita UMA vez, compartilhada pelas cinco entidades
// ---------------------------------------------------------------------------------------------

/**
 * Uma entidade sob a prova de circulação: o caminho da coleção e como se cria um registro dela.
 *
 * `criar` recebe o **índice** do registro (0 para o que permanece em circulação, 1 para o que é
 * retirado) e devolve o identificador. É o índice, e não o corpo, que entra por parâmetro: os valores
 * únicos de cada entidade — documento, identificador municipal — são declarados no topo do arquivo,
 * um por registro, e derivá-los aqui deixaria dois registros da mesma entidade com o mesmo valor.
 *
 * O caminho é composto a partir da constante que o próprio controlador exporta, nunca escrito à mão.
 */
interface EntidadeSobCirculacao {
  readonly rotulo: string;
  readonly colecao: string;
  readonly criar: (indice: 0 | 1) => Promise<string>;
}

/**
 * As CINCO entidades, na ordem em que a fatia as publicou.
 *
 * Escrita como função porque a entidade `imoveis` depende de um conjunto pai alcançável, que só
 * existe depois de a rota real o criar. Cinco cópias do corpo do caso é o que esta tabela existe para
 * não haver.
 */
function entidadesSobCirculacao(conjuntoPaiId: string): readonly EntidadeSobCirculacao[] {
  const documentos = (papel: keyof typeof DOCUMENTOS_DA_CIRCULACAO, indice: 0 | 1): string =>
    DOCUMENTOS_DA_CIRCULACAO[papel][indice];

  return [
    {
      rotulo: 'conjuntos',
      colecao: CAMINHO_DA_COLECAO,
      criar: async (indice) => (await criarConjunto(`Conjunto da Circulação ${String(indice)}`)).id,
    },
    {
      rotulo: 'imoveis',
      colecao: CAMINHO_DOS_IMOVEIS_DA_API,
      criar: async (indice) =>
        await criarPelaRota(CAMINHO_DOS_IMOVEIS_DA_API, {
          conjuntoId: conjuntoPaiId,
          nomeImovel: `Ap ${String(indice)}`,
          identificadorMunicipal: IDENTIFICADORES_DOS_IMOVEIS[indice],
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
        }),
    },
    {
      rotulo: 'locadores',
      colecao: CAMINHO_DOS_LOCADORES_DA_API,
      criar: async (indice) =>
        await criarPelaRota(
          CAMINHO_DOS_LOCADORES_DA_API,
          corpoDeLocador(documentos('locadores', indice), `Locador ${String(indice)}`),
        ),
    },
    {
      rotulo: 'locatarios',
      colecao: CAMINHO_DOS_LOCATARIOS_DA_API,
      criar: async (indice) =>
        await criarPelaRota(
          CAMINHO_DOS_LOCATARIOS_DA_API,
          corpoDeLocador(documentos('locatarios', indice), `Locatário ${String(indice)}`),
        ),
    },
    {
      rotulo: 'fiadores',
      colecao: CAMINHO_DOS_FIADORES_DA_API,
      criar: async (indice) =>
        await criarPelaRota(
          CAMINHO_DOS_FIADORES_DA_API,
          corpoDeLocador(documentos('fiadores', indice), `Fiador ${String(indice)}`),
        ),
    },
  ];
}

/** O imóvel como a API o publica, no que o `CT-416` observa dele. A falha levanta. */
async function lerImovel(imovelId: string): Promise<ImovelPublicado> {
  const alvo = `${CAMINHO_DOS_IMOVEIS_DA_API}/${imovelId}`;
  const leitura = await pedir(alvo, { cookie });

  if (leitura.status !== 200) {
    throw new Error(`a leitura de ${alvo} respondeu ${String(leitura.status)}: ${leitura.texto}`);
  }

  return leitura.corpo as ImovelPublicado;
}

/** O contrato como a API o publica, no que o `CT-416` observa dele. A falha levanta. */
async function lerContrato(codigo: string): Promise<ContratoPublicado> {
  const alvo = `${CAMINHO_DOS_CONTRATOS_DA_API}/${codigo}`;
  const leitura = await pedir(alvo, { cookie });

  if (leitura.status !== 200) {
    throw new Error(`a leitura de ${alvo} respondeu ${String(leitura.status)}: ${leitura.texto}`);
  }

  return leitura.corpo as ContratoPublicado;
}

/** Cria um registro pela ROTA real e devolve o identificador, ou levanta nomeando a recusa. */
async function criarPelaRota(colecao: string, corpo: Record<string, unknown>): Promise<string> {
  const criacao = await pedir(colecao, { metodo: 'POST', cookie, corpo });

  if (criacao.status !== 201) {
    throw new Error(
      `a criação em ${colecao} respondeu ${String(criacao.status)}: ${criacao.texto}`,
    );
  }

  return (criacao.corpo as CadastroPublicado).id;
}

/**
 * O corpo completo de um cadastro de pessoa — os três papéis compartilham a MESMA forma.
 *
 * **`empresaId` não aparece**, e a ausência é o ponto: a empresa sai da sessão, e o `strictObject` do
 * contrato recusaria a chave.
 */
function corpoDeLocador(documentoPrincipal: string, nome: string): Record<string, unknown> {
  return {
    nome,
    tipoPessoa: 'PESSOA_FISICA',
    documentoPrincipal,
    rg: '123456789',
    email: 'pessoa.do.ciclo@exemplo.com.br',
    telefone: '11999990000',
    logradouro: 'Rua das Acácias',
    numero: '100',
    complemento: 'Bloco B',
    bairro: 'Centro',
    cidade: 'São Paulo',
    estado: 'SP',
    cep: '01000000',
  };
}

/** Os identificadores que a listagem devolve, com ou sem os retirados. */
async function identificadoresDaListagem(
  colecao: string,
  incluirRetirados: boolean,
): Promise<Set<string>> {
  return new Set((await itensDaListagem(colecao, incluirRetirados)).keys());
}

/**
 * Os itens da listagem, como um mapa de identificador para a marca de retirada.
 *
 * O mapa, e não a lista: os casos precisam das DUAS coisas — se o registro consta e como está a marca
 * dele —, e ler a listagem duas vezes deixaria as duas asserções sobre retratos diferentes.
 */
async function itensDaListagem(
  colecao: string,
  incluirRetirados: boolean,
): Promise<Map<string, string | null>> {
  const consulta = incluirRetirados
    ? `?limite=${String(LIMITE_DA_LISTAGEM)}&incluirRetirados=true`
    : `?limite=${String(LIMITE_DA_LISTAGEM)}`;
  const listagem = await pedir(`${colecao}${consulta}`, { cookie });

  if (listagem.status !== 200) {
    throw new Error(
      `a listagem de ${colecao} respondeu ${String(listagem.status)}: ${listagem.texto}`,
    );
  }

  return new Map(
    (listagem.corpo as PaginaPublicada).itens.map((item) => [item.id, item.retiradoEm]),
  );
}

/**
 * O nome físico da tabela do locador, declarado **aqui** e não importado de `@sysloc/db`.
 *
 * Ele não sai daquele pacote por decisão (§11.2), e derivá-lo do SUT faria a conferência crua
 * concordar com o que ela existe para auditar.
 */
const TABELA_DO_LOCADOR = 'negocio.locador';

/**
 * A linha CRUA do cadastro, inteira, como objeto — a serialização do `CT-316`.
 *
 * `to_jsonb` devolve **todas** as colunas, inclusive as que a projeção publicada esconde: é
 * justamente uma delas que uma recirculação distraída zeraria sem que asserção alguma sobre o corpo
 * publicado percebesse.
 *
 * A leitura corre por `abrirAcessoAoBanco` sob `contextoDeTenant.executarCom` **com a empresa da
 * sessão**, e nunca por conexão privilegiada: a auditoria não pode ser mais poderosa que o ato que
 * ela audita. Nenhum `WHERE empresa_id` é escrito aqui — quem recorta é a política (ADR-0008).
 */
async function lerLinhaCrua(
  tabela: string,
  id: string,
): Promise<Record<string, unknown> | undefined> {
  return await contextoDeTenant.executarCom(
    { empresaId: EMPRESA_A.id },
    async () =>
      await acessoAoNegocio.emUnidadeDeTrabalho(async (tx) => {
        const [linha] = await tx<{ conteudo: Record<string, unknown> }[]>`
          SELECT to_jsonb(alvo) AS conteudo FROM ${tx(tabela)} AS alvo WHERE alvo.id = ${id}
        `;

        return linha?.conteudo;
      }),
  );
}

/** A mesma linha, **sem** a marca de retirada — o recorte que a comparação pós-retirada usa. */
function semMarcaDeRetirada(
  linha: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
  if (linha === undefined) {
    return undefined;
  }

  const { retirado_em: _marca, ...resto } = linha;
  return resto;
}

/** Quantas linhas de `negocio.locador` existem para aquele identificador — a prova de que nada sumiu. */
async function contarLinhasDoLocador(id: string): Promise<number> {
  return await contextoDeTenant.executarCom(
    { empresaId: EMPRESA_A.id },
    async () =>
      await acessoAoNegocio.emUnidadeDeTrabalho(async (tx) => {
        const [linha] = await tx<{ total: string }[]>`
          SELECT count(*) AS total FROM negocio.locador WHERE id = ${id}
        `;

        return Number(linha?.total ?? 0);
      }),
  );
}

// ---------------------------------------------------------------------------------------------
// Observação de estado persistido — pela API pública do pacote, sob o contexto de tenant
// ---------------------------------------------------------------------------------------------

/**
 * Quantas linhas de `negocio.conjunto` existem para aquele identificador.
 *
 * A leitura é **crua** e não passa pela porta de leitura de propósito: o que o `CT-347` mede é a
 * cardinalidade da tabela, e uma contagem feita pela porta aplicaria o predicado de circulação e
 * esconderia justamente a linha retirada que ela quer contar. Nenhum `WHERE empresa_id` é escrito
 * aqui — quem recorta é a política (ADR-0008).
 */
async function contarLinhasDoConjunto(id: string): Promise<number> {
  return await contextoDeTenant.executarCom(
    { empresaId: EMPRESA_A.id },
    async () =>
      await acessoAoNegocio.emUnidadeDeTrabalho(async (tx) => {
        const [linha] = await tx<{ total: string }[]>`
          SELECT count(*) AS total FROM negocio.conjunto WHERE id = ${id}
        `;

        return Number(linha?.total ?? 0);
      }),
  );
}

/**
 * Concede as chaves informadas a quem age, pelo caminho real da camada de dados.
 *
 * Sob o contexto de tenant e dentro da unidade de trabalho, com a coerência ação→tela validada pela
 * função de domínio (`validarCoerenciaDeAjustes`) e o contador incrementado na mesma transação. É o
 * mesmo caminho que a rota do Admin usa por dentro, e o mesmo padrão de
 * `test/ciclo-de-acesso.e2e.spec.ts`.
 */
async function concederA(usuarioId: string, chaves: readonly ChaveDoCatalogo[]): Promise<void> {
  await contextoDeTenant.executarCom({ empresaId: EMPRESA_A.id }, async () => {
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
 * Cria uma pessoa `USUARIO_EMPRESA` da empresa A pela ROTA REAL do Admin e devolve a sessão dela,
 * já **plena**.
 *
 * Tudo pelas rotas reais: a pessoa nasce por `POST /v1/usuarios` (com a sessão do Admin da carga,
 * cuja matriz é o catálogo inteiro), entra pela rota pública com a Senha provisória que a criação
 * devolveu, e cumpre a troca obrigatória por `POST /v1/sessao/senha`. Nenhum estado é forjado, e
 * nada foi acrescentado à produção para este arranjo existir (Iron Law #6).
 *
 * A troca é **obrigatória** aqui, e não conveniência: sem ela a sessão fica RESTRITA (RN-09), e o
 * `403` que ela produz vem da restrição — não da autorização, que é o eixo do `CT-354`. As três
 * idas ao caminho de credencial cabem folgadamente no teto do limitador (30 entradas e 10
 * conferências por minuto, contra a mesma origem).
 */
async function pessoaOperandoComSenhaTrocada(prefixo: string): Promise<PessoaEmOperacao> {
  const cookieDoAdmin = await entrar(ADMIN_DE_A.email, SENHA_DA_CARGA);

  const criada = await pedir(CAMINHO_DAS_PESSOAS, {
    metodo: 'POST',
    cookie: cookieDoAdmin,
    corpo: {
      nome: 'Pessoa Que Só Administra Cadastros',
      email: `${prefixo}.${randomUUID()}@exemplo.com.br`,
      perfil: 'USUARIO_EMPRESA',
    },
  });

  if (criada.status !== 201) {
    throw new Error(`a criação de pessoa respondeu ${String(criada.status)}: ${criada.texto}`);
  }

  const { usuarioId, email, senhaProvisoria } = criada.corpo as {
    usuarioId: string;
    email: string;
    senhaProvisoria: string;
  };

  const restrita = await entrar(email, senhaProvisoria);
  const troca = await pedir(ROTA_DE_TROCA_DE_SENHA, {
    metodo: 'POST',
    cookie: restrita,
    corpo: { senhaAtual: senhaProvisoria, senhaNova: SENHA_TROCADA },
  });

  if (troca.status !== 200) {
    throw new Error(`a troca de senha respondeu ${String(troca.status)}: ${troca.texto}`);
  }

  // A resposta pode ou não reemitir a credencial de sessão, e as duas formas são aceitas: o que
  // importa é o cookie que passa a valer, e não por qual das duas ele chegou.
  const cookieNovo = troca.cookies.some((bruto) =>
    (bruto.split(';')[0] ?? '').split('=')[0]?.trim().endsWith(SUFIXO_DO_COOKIE_DE_SESSAO),
  )
    ? (troca.cookies
        .find((bruto) =>
          (bruto.split(';')[0] ?? '').split('=')[0]?.trim().endsWith(SUFIXO_DO_COOKIE_DE_SESSAO),
        )
        ?.split(';')[0] ?? restrita)
    : restrita;

  return { usuarioId, cookie: cookieNovo };
}

/** Uma pessoa da empresa já operando com sessão plena — o que o `CT-354` observa dela. */
interface PessoaEmOperacao {
  readonly usuarioId: string;
  readonly cookie: string;
}

// ---------------------------------------------------------------------------------------------
// Corpos observados — declarados aqui, e não importados do SUT
// ---------------------------------------------------------------------------------------------

/**
 * Um conjunto como a API o publica.
 *
 * Declarado aqui, e não importado de `@syslocbr/contracts`: o conjunto de chaves é o que os casos
 * asserem por igualdade, e derivá-lo do tipo do SUT faria a asserção concordar consigo mesma.
 */
interface ConjuntoPublicado {
  readonly id: string;
  readonly nome: string;
  readonly retiradoEm: string | null;
}

/**
 * Um registro de qualquer das cinco entidades, no que a prova transversal observa dele.
 *
 * Declarado aqui, e não importado de `@syslocbr/contracts`: o que os casos asserem é o identificador e
 * a marca de circulação, e derivá-los do tipo do SUT faria a asserção concordar consigo mesma. As
 * cinco entidades compartilham estes dois campos, que é o que torna a tabela possível.
 */
interface CadastroPublicado {
  readonly id: string;
  readonly retiradoEm: string | null;
}

/** Uma página de qualquer das cinco coleções, no que este arquivo observa dela. */
interface PaginaPublicada {
  readonly itens: readonly CadastroPublicado[];
}

/**
 * O imóvel como a API o publica, no que o `CT-416` observa dele.
 *
 * Os campos nomeados são os **dois** que o caso afirma por extenso; o restante do corpo é comparado
 * por igualdade de objeto inteiro, sem que este tipo precise enumerá-lo — é o que faz a comparação
 * alcançar também um campo que o esquema venha a ganhar (a T9 lhe acrescenta `contratoVigente`).
 * Declarado aqui, e não importado de `@syslocbr/contracts`, pela razão de {@link CadastroPublicado}.
 */
interface ImovelPublicado {
  readonly id: string;
  readonly statusLocacao: string;
  readonly retiradoEm: string | null;
}

/** O contrato como a API o publica, no que o `CT-416` observa dele. */
interface ContratoPublicado {
  readonly codigo: string;
  readonly status: string;
  readonly imovelId: string;
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
