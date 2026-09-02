/**
 * Administração das pessoas da própria empresa, pelas sete rotas do Admin. T8 da fatia
 * `autorizacao-e-ciclo-de-acesso`.
 *
 * ---------------------------------------------------------------------------
 * INVARIANTES
 * ---------------------------------------------------------------------------
 *
 * | Critério | Caso   | Invariante |
 * |---|---|---|
 * | CA-02 | CT-222 | A criação de pessoa devolve a Senha provisória no corpo **daquela** resposta e
 * | CA-08 |        | em nenhuma outra — nenhuma consulta posterior, por nenhum caminho da API, a
 * |       |        | devolve —, e ela serve para a pessoa entrar. Vale nos **dois** caminhos de
 * |       |        | emissão: Master→Admin e Admin→Usuário. (RN-07, RN-12) |
 * | CA-14 | CT-228 | A desativação encerra os registros de sessão **da pessoa** no próprio ato — a
 * |       |        | contagem dela vai a **zero** e a operação seguinte responde `401` —, ela não
 * |       |        | entra de novo, e **a colega da mesma empresa segue operando**. O encerramento
 * |       |        | é por pessoa, nunca por empresa. (RN-04) |
 * | CA-15 | CT-229 | A reativação devolve o efetivo que a pessoa tinha antes da desativação —
 * |       |        | **inclusive** a chave concedida individualmente e a ausência da negada —, e
 * |       |        | **não** devolve a sessão encerrada. (RN-05, RN-06) |
 * | CA-16 | CT-230 | Nenhuma das cinco rotas de `:id` alcança pessoa de outra empresa: a recusa é
 * |       |        | `404` com o corpo canônico inteiro, a listagem de A não revela nada de B, e o
 * |       |        | estado de B é **idêntico antes e depois**. Vale para os dois alvos alheios — a
 * |       |        | pessoa que **tem** vínculo e a admitida pelo Master que **não tem** —, e para
 * |       |        | esta última nenhum vínculo nasce sob contexto algum. A fronteira vem do banco.
 * |       |        | (RN-12, ADR-0008) |
 * | CA-12 | CT-231 | A troca de perfil de quem tem ajustes é recusada até que a intenção de
 * | CA-13 |        | descartá-los seja declarada, e a recusa informa **quantos**; na recusa,
 * |       |        | perfil, contagem de ajustes e contador de versão ficam **inalterados**.
 * |       |        | Declarada a intenção, todos são removidos e o efetivo vira o padrão do perfil
 * |       |        | novo. (RN-11) |
 * | CA-11 | CT-232 | O ajuste incoerente — ação sensível sem a área de tela que a comporta — é
 * | CA-23 |        | recusado com `422` nomeando a tela exigida, **antes de qualquer escrita**; e a
 * |       |        | chave fora do catálogo é recusada na borda, também com `422`. Nos dois casos
 * |       |        | os ajustes e o contador ficam inalterados. (RN-02, RN-15) |
 * | CA-08 | CT-233 | A **janela** da listagem de pessoas é servida, e não apenas ecoada: sem
 * |       |        | parâmetro vale o padrão declarado; com `limite=1&deslocamento=1` o recorte tem
 * |       |        | um item e ele é **outro** que o da primeira página. O teto é fronteira exata —
 * |       |        | no teto `200`, acima dele `422` nomeando `limite`. (ADR-0012) |
 * | CA-16 | CT-237 | **Nenhuma** das cinco rotas de `:id` aceita quem age como alvo: as cinco
 * |       |        | respondem `422` com o corpo canônico inteiro, para o Admin e para a pessoa a
 * |       |        | quem `TELA:usuarios` foi concedida individualmente. O efetivo e o estado dela
 * |       |        | ficam **idênticos** — a escalada não acontece —, e o Admin segue alcançando
 * |       |        | **outro** Admin nas cinco. As duas grafias do identificador são exercitadas:
 * |       |        | em caixa alta o alvo resolve a mesma pessoa e a recusa é a mesma.
 * |       |        | (RN-18, ADR-0010, ADR-0011) |
 *
 * Rastreabilidade: `CA-02 → CT-222 (RN-07)`, `CA-08 → CT-222 (RN-12)`, `CA-14 → CT-228 (RN-04)`,
 * `CA-15 → CT-229 (RN-05)`, `CA-16 → CT-230 (RN-12)`, `CA-12 → CT-231 (RN-11)`,
 * `CA-13 → CT-231 (RN-11)`, `CA-11 → CT-232 (RN-02)`, `CA-23 → CT-232 (RN-15)`,
 * `CA-08 → CT-233 (ADR-0012)`, `CA-16 → CT-237 (RN-18)`.
 *
 * ===========================================================================
 * O que faz cada caso provar o que ele diz provar
 * ===========================================================================
 *
 * **CT-228 — a colega.** Se o caso asserisse apenas `401` para a desativada, ele passaria com uma
 * implementação que encerra as sessões da **empresa inteira**. A colega respondendo `2xx` no mesmo
 * instante é a asserção que discrimina as duas, e a contagem indo a zero é a que distingue
 * "encerrada" de "marcada para recusar depois".
 *
 * **CT-230 — o corpo inteiro e o estado de B.** Uma implementação que comparasse empresa na
 * aplicação e devolvesse `403` reprovaria; uma que devolvesse `404` **depois** de já ter escrito
 * também. Por isso o caso lê o estado completo da pessoa de B — perfil, ativo, contagem de ajustes e
 * contador de versão — antes e depois das cinco tentativas, e compara por igualdade.
 *
 * **CT-230 — os DOIS alvos alheios.** A pessoa de B criada por `POST /v1/usuarios` já tem vínculo, e
 * o `404` dela prova apenas que a **leitura** é recortada. O segundo alvo — admitido pelo Master
 * numa terceira empresa e que nunca agiu — é o que prova a **gravação**: as rotas de `:id` garantem
 * o vínculo do alvo antes de alcançá-lo, e sem o recorte por empresa do contexto esse alvo produziria
 * uma recusa da política (erro de servidor) em vez do `404` que o contrato manda. A contagem de
 * vínculos em zero **sob o contexto de A** é o que separa "respondeu 404" de "não escreveu nada".
 *
 * **CT-231 — as três dimensões.** Verificar só o perfil deixaria passar uma implementação que remove
 * os ajustes e **só então** valida a intenção. Perfil, contagem e contador são medidos antes e
 * depois da recusa.
 *
 * **CT-237 — a premissa afirmada e a perna positiva.** O caso concede `TELA:usuarios` a uma pessoa
 * `USUARIO_EMPRESA` e **afirma que ela alcança a superfície** antes de exercitar o auto-alvo: sem
 * essa linha, todo `422` seria compatível com uma guarda que nunca deixou o pedido chegar, e o caso
 * não diria nada sobre escalada. A perna positiva — o Admin alcançando **outro Admin** nas cinco
 * rotas — é o que impede "recusa auto-alvo" de passar com uma implementação que recusa tudo, ou que
 * recusa todo alvo de perfil `ADMIN_EMPRESA`: o outro Admin é a pessoa que mais se parece com quem
 * age, e a única diferença que pode explicar o desfecho oposto é a **identidade**.
 *
 * **CT-237 — as DUAS GRAFIAS, e por que a primeira sozinha não bastava.** Até a rodada 4 o caso
 * exercitava o identificador **como o banco o devolve**, que é a única grafia que nunca precisou ser
 * recusada: o `uuid` do Postgres sai sempre em minúsculas. A grafia em caixa alta é o vetor —
 * `z.uuid()` a aceita e a devolvia **verbatim**, `uuid_in` acha a **mesma** pessoa, e a comparação
 * de string do auto-alvo respondia `false`. As duas pernas rodam para os dois atores e também na
 * perna positiva, e essa última carrega a metade que impede a leitura errada: em caixa alta o outro
 * Admin é alcançado **normalmente** (`200` nas cinco rotas), de modo que os `422` são recusa de
 * identidade, e não a borda repelindo a grafia. A **premissa** de que a caixa alta é uma grafia
 * *outra* é afirmada sobre as pessoas criadas em tempo de execução — o Admin semeado tem
 * identificador só de dígitos decimais, para o qual grafia alternativa não existe.
 *
 * ===========================================================================
 * MUTANTES EXECUTADOS — os quatorze reprovam; o M14 nasceu na rodada 5
 * ===========================================================================
 *
 * A `.claude/rules/testing-stack.md` e o P4 de `.claude/rules/nao-regressao.md` exigem demonstrar
 * que a prova **reprova** com o defeito reintroduzido. Os mutantes abaixo foram aplicados ao fonte
 * de produção e a suíte foi invocada pelo **script do pacote** (`pnpm --filter @sysloc/api test`),
 * nunca por `vitest run` avulso — este arquivo carrega `@sysloc/auth` e `@sysloc/db` pela fronteira
 * do pacote, e um `vitest run` leria o `dist/` da compilação anterior.
 *
 *   * **controle** — árvore íntegra: `82 passed` (era `81` até a rodada 2, antes do `CT-237`);
 *   * **M1 · o encerramento é por EMPRESA, e não por pessoa** (`encerrarSessoesDaPessoa` passa a
 *     alcançar todas as pessoas da mesma empresa): `6 failed | 75 passed`, e o primeiro é o CT-228,
 *     em `sessoesEncerradas` — `4` no lugar de `1`. É a medida literal do eixo do caso; as demais
 *     falhas são a cascata de a sessão do Admin ter sido derrubada junto;
 *   * **M2 · a resolução de pessoa DEIXA de passar pelo vínculo** (`localizarPessoaDoContexto` lê
 *     `identidade.usuario` direto): `1 failed | 80 passed`, no **CT-230** — `expected 200 to be 404`
 *     na rota de reemissão contra a pessoa da empresa B. É a fronteira de tenant inteira, e nenhum
 *     outro caso a sente;
 *   * **M3 · a troca de perfil ESCREVE antes de validar a intenção declarada**:
 *     `1 failed | 80 passed`, no **CT-231** — `versaoPermissoes` chega a `3` em vez de `2`. Note o
 *     que o mutante ensina: a asserção de "nada mudou" **continua verde**, porque o desfazimento da
 *     unidade de trabalho é a rede (o docblock de `escreverAjustes` já o dizia por escrito); quem
 *     pega a reordenação é a contagem do contador ao final, e é por isso que o caso mede as três
 *     dimensões e também o valor final;
 *   * **M4 · a listagem passa a JUNTAR com o vínculo** (em vez de recortar pela variável de sessão):
 *     `1 failed | 80 passed`, no **CT-227** de `test/ciclo-de-acesso.e2e.spec.ts` — o Admin
 *     desativado, criado pela rota do Master e portanto sem vínculo, desaparece da listagem. É
 *     exatamente a razão de a listagem não ser feita por junção;
 *   * **M5 · o `OFFSET` ignora o deslocamento**: `1 failed | 80 passed`, no **CT-233** — a segunda
 *     página devolve o item da primeira, que é o que separa "a janela move o recorte" de "os dois
 *     campos ecoam o que se pediu";
 *   * **M6 · o vínculo de QUEM AGE deixa de ser garantido**: `1 failed | 80 passed`, no **CT-227**
 *     de `test/ciclo-de-acesso.e2e.spec.ts` — `expected +0 to be 1` na contagem de vínculos do
 *     socorro logo depois de ele criar uma pessoa. **Ver a nota abaixo**: na rodada 2 este mutante
 *     passou a sobreviver, e a asserção que o reprova hoje não é a original;
 *   * **M7 · o vínculo da pessoa CRIADA deixa de ser gravado** (a outra metade do `D32`):
 *     `1 failed | 80 passed`, no **CT-227** — `expected +0 to be 1` na contagem de vínculos da
 *     pessoa recém-criada. Mesma nota;
 *   * **M8 · o vínculo do ALVO deixa de ser garantido** (`sobreAPessoa` chama
 *     `garantirVinculoDeAcesso(tx, sessao.usuarioId)` no lugar de `…, usuarioId` — a forma exata do
 *     defeito que o Gate 1 reprovou na rodada 1): `1 failed | 81 passed`, no **CT-227** —
 *     `expected 404 to be 200` na **reativação do Admin que o Master criou e que nunca agiu**. É a
 *     revogação de acesso inalcançável, medida no cenário da US-07.
 *
 *     **Correção de texto da rodada 3, e ela importa para quem repetir a prova**: até a rodada 2
 *     esta forma literal **não compilava** (`TS6133`, `usuarioId` declarado e nunca lido), e quem a
 *     repetisse tropeçava — o Gate 1 teve de usar uma variante equivalente. Ela passou a compilar
 *     por efeito da própria correção do bloqueante: o parâmetro agora é lido pela recusa do
 *     auto-alvo, algumas linhas acima. **Reexecutada na rodada 3 na forma literal, e reprova**;
 *     nenhuma variante é necessária;
 *   * **M9 · o recorte por empresa do contexto sai de `garantirVinculoDeAcesso`**:
 *     `1 failed | 80 passed`, no **CT-230** — `expected 500 to be 404` na primeira das cinco rotas
 *     contra o Admin alheio sem vínculo. É a medida literal da objeção que o recorte fecha: sem ele,
 *     a gravação bate no `WITH CHECK` da política e a fronteira de tenant vira erro de servidor;
 *   * **M10 · a recusa de borda ECOA o valor recusado** (`validar` acrescenta
 *     `detalhes: { recusado: <o que o cliente mandou> }`, que é o que o docblock dela promete não
 *     fazer): `2 failed | 79 passed`, no **CT-232** e no **CT-233**. Ele é o par de falsificação da
 *     asserção que a rodada 2 fortaleceu, e o **controle** o torna conclusivo: com a forma anterior
 *     (`toMatchObject`) e o **mesmo** mutante aplicado, o CT-232 volta a passar
 *     (`1 failed | 80 passed`, só o CT-233). A frouxidão deixava passar exatamente o vazamento que
 *     esta rota tem como risco;
 *   * **M11 · a recusa do AUTO-ALVO sai do ponto único** (a condição de `sobreAPessoa` passa a
 *     `usuarioId === '' && sessao.usuarioId === ''`, que nunca é verdadeira para um UUID):
 *     `2 failed | 80 passed`, no **CT-237** (`expected 200 to be 422`, já no primeiro par
 *     ator×rota) e no **CT-227** de `test/ciclo-de-acesso.e2e.spec.ts`, no passo 3. É o bloqueante
 *     ALTO da rodada 2 medido de volta: sem a recusa, a pessoa a quem `TELA:usuarios` foi concedida
 *     individualmente troca o próprio perfil para `ADMIN_EMPRESA` e sai do piso para o catálogo
 *     inteiro. **A forma literal — apagar o bloco `if` — NÃO compila** (`TS6133` nas duas constantes
 *     que só ele lê); a variante acima é a equivalente que compila, e quem repetir a prova deve usá-la;
 *   * **M12 · a listagem perde o `WHERE empresa_id`** (nas duas consultas de
 *     `listarPessoasDaEmpresa` — a página e o total): `1 failed | 81 passed`, no **CT-230** —
 *     `expected 1 to be +0` na contagem de ocorrências do identificador da pessoa de B na
 *     serialização da listagem de A. Ele nasceu na rodada 3 para fechar a aresta que faltava: aquele
 *     `WHERE` é o **único** guardião de um vazamento entre inquilinos que o banco não cobre — a
 *     ADR-0009 decide que `identidade` não tem política —, e sem este mutante a prova era suficiente
 *     mas não conclusiva;
 *   * **M13 · a asserção do DESFECHO da escalada, medida com a rede de cima REMOVIDA** — nasceu na
 *     rodada 4, e não é mutante de produção novo: é a falsificação da última linha do CT-237, que o
 *     Gate 1 mostrou ser **infalível**. Ela comparava o número de **telas** do efetivo com o
 *     tamanho de `MATRIZ_POR_PERFIL.ADMIN_EMPRESA` — dimensões diferentes: `telas` é subconjunto
 *     das **dez** `CHAVES_DE_TELA`, e a matriz do Admin soma as dez telas com as sete ações, logo
 *     `|telas| <= 10 < 17` valia incondicionalmente.
 *
 *     **Por que exigiu arnês.** Sob o **M11** o laço das cinco rotas reprova no primeiro par e o
 *     caso morre antes do desfecho — a linha nunca é alcançada, e nenhum mutante de produção
 *     sozinho a mede. A prova foi feita num arquivo de teste **temporário**, cópia deste, com o
 *     M11 aplicado ao fonte e o laço, o ataque literal e as igualdades de estado removidos, de modo
 *     que a escalada fosse consumada direto (`POST /:id/perfil` sobre si mesma, `ADMIN_EMPRESA`)
 *     e a linha fosse **alcançada**. Medido: `escalada: 200`, `telas depois: 10` — e então
 *     **a forma antiga PASSOU** (`10 < 17`, marca `forma ANTIGA passou sob a escalada consumada`)
 *     enquanto **a forma commitada REPROVOU**, nomeando o conjunto:
 *     `expected [ 'TELA:automacao_de_cobranca', …(9) ] to deeply equal [ 'TELA:resumo',
 *     'TELA:usuarios' ]`. É o par que torna a medida conclusiva: mesma execução, mesmo estado, as
 *     duas formas lado a lado. O arquivo temporário foi apagado ao fim;
 *   * **M14 · a canonicalização SAI DA BORDA** (`ESQUEMA_DO_IDENTIFICADOR` volta a ser `z.uuid()`,
 *     sem o `.transform`) — nasceu na rodada 5, e é a forma **literal**: ela compila, ao contrário
 *     do M11. Medido: `1 failed | 81 passed`, no **CT-237** —
 *     `pessoa com TELA:usuarios (em MAIÚSCULAS) → /v1/usuarios/CE1B0242-…/permissoes: expected 200
 *     to be 422`. É a escalada de privilégio consumada por grafia: sem a canonicidade estabelecida
 *     na borda, o `:id` chega verbatim, `uuid_in` do Postgres acha a mesma pessoa e a comparação de
 *     string da recusa do auto-alvo responde `false`. O caso reprova **na perna de caixa alta**, e
 *     a de caixa baixa continua verde — que é exatamente o que o defeito parecia antes desta perna
 *     existir;
 *   * **reversão** — os fontes de produção foram restaurados e conferidos idênticos ao original por
 *     `diff`, e o controle voltou a `82 passed`.
 *
 * ---------------------------------------------------------------------------
 * O que a garantia do ALVO fez com o M6 e o M7 — medido, e não suposto
 * ---------------------------------------------------------------------------
 *
 * Na rodada 1, o M6 e o M7 reprovavam por **consequência**: sem o vínculo, a rota de `:id` seguinte
 * respondia `404`. A garantia do alvo (M8) **subsome essa consequência** — ela cria o vínculo que
 * faltava, e a rota responde `200` de qualquer forma. Os dois mutantes foram reexecutados na rodada
 * 2 exatamente para medir isso, e os dois **sobreviveram** (`81 passed` cada).
 *
 * A resposta não foi apagá-los do inventário nem aceitar a perda: foi **reancorá-los**, com duas
 * asserções de contagem de vínculo no único ponto do CT-227 em que as três garantias ainda são
 * distinguíveis — logo depois da criação, quando nenhuma rota de `:id` rodou. Ali só a garantia da
 * criação explica o vínculo da pessoa nova, e só a de quem age explica o do socorro. Com elas, os
 * dois voltam a reprovar, e agora **por observação direta da propriedade**, e não pela consequência
 * que um terceiro mecanismo passou a cobrir.
 *
 * ===========================================================================
 * Cada caso arranja o próprio SUJEITO, pelas ROTAS REAIS
 * ===========================================================================
 *
 * Os Admins que agem são os **da carga** — `admin.a@…` na empresa A e `admin.b@…` na B —, e cada
 * caso cria as **próprias pessoas-alvo** por `POST /v1/usuarios`. Nenhum caso toca a pessoa de
 * outro: os alvos nascem no caso que os exercita, com endereço sorteado, e nenhuma pessoa da carga é
 * alterada por caso algum. A ordem de execução é, portanto, irrelevante.
 *
 * **Por que os Admins vêm da carga, e não de `POST /v1/master/empresas/:id/admin`.** Um Admin
 * admitido pelo Master nasce com Senha provisória, e a sessão dele é **restrita** até a troca
 * (RN-09) — uma sessão restrita não alcança as rotas desta task, e o `403` que ela produz vem da
 * restrição, não da autorização. Fazer a troca por caso custaria uma chamada a `/change-password`
 * cada, e o **limitador de taxa** que a T6 ligou concede **10 por minuto** naquele caminho, contra a
 * mesma origem (`TETO_DE_CREDENCIAL_POR_JANELA`, §11.5). O arquivo inteiro roda em menos de um
 * minuto: um Admin admitido por caso estouraria a janela e produziria `429` — uma reprovação que não
 * diz nada sobre o que os casos perseguem. Os Admins da carga já têm senha definitiva, então a
 * sessão deles nasce plena com uma entrada só.
 *
 * O caminho Master→Admin **continua exercitado**, e num caso onde ele é o eixo: o `CT-222` admite um
 * Admin por aquela rota, numa empresa criada para ele, e prova que a Senha provisória emitida ali
 * serve para entrar. As três trocas de senha que sobram no arquivo estão nos dois casos cujo cartão
 * as exige como pré-condição literal — o `CT-228` e o `CT-230`.
 *
 * A única leitura fora da API é a **observação de estado persistido** — contagem de sessões, de
 * ajustes e o contador de versão —, feita pelo acesso restrito a `identidade` e pela unidade de
 * trabalho, exatamente como os casos da T7 já faziam. **Nada foi acrescentado à produção para que
 * estas provas existissem** (Iron Law #6): a desativação, a criação, o ajuste e a troca de perfil
 * acontecem todos pelas rotas reais desta task.
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
import { type ChaveDoCatalogo, MATRIZ_POR_PERFIL } from '@sysloc/auth';
import {
  type AcessoAoBanco,
  abrirAcessoAoBanco,
  contarAjustesDaPessoa,
  contextoDeTenant,
  EMPRESA_A,
  EMPRESA_B,
  esquemaIdentidade,
  SENHA_DA_CARGA,
  USUARIO_MASTER,
} from '@sysloc/db';
import { CodigoErro } from '@sysloc/shared';
import { eq } from 'drizzle-orm';
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
import { ENDERECO_DE_ESCUTA, PREFIXO_DE_VERSAO } from '../src/configuracao/ambiente.ts';
import { criarAplicacao } from '../src/main.ts';
import { CAMINHO_DO_MASTER } from '../src/master/empresa.controller.ts';
import { CAMINHO_DOS_USUARIOS } from '../src/usuarios/usuario.controller.ts';
import {
  MAIOR_PAGINA_DE_PESSOAS,
  PAGINA_PADRAO_DE_PESSOAS,
} from '../src/usuarios/usuario.service.ts';
import { contarSessoesDaPessoa, entrarComSegundoFatorCumprido } from './acessorios-de-borda.ts';

/** Limite da montagem: banco migrado, semente com credencial, fila e a aplicação real. */
const LIMITE_DE_MONTAGEM_MS = 240_000;

/**
 * Limite de um caso.
 *
 * Generoso de propósito: os casos executam muitas entradas reais em sequência, e cada uma paga a
 * derivação `scrypt`, que é deliberadamente cara (§12.1). O teto não é espera — nada aqui dorme.
 */
const LIMITE_CASO_MS = 120_000;

/** Sufixo do nome do cookie de sessão do arcabouço — o prefixo vem da configuração. */
const SUFIXO_DO_COOKIE_DE_SESSAO = 'session_token';

/** A rota de entrada, composta a partir do prefixo real. Nunca escrita à mão. */
const ROTA_DE_ENTRADA = `${PREFIXO_DAS_ROTAS_DE_IDENTIDADE}/sign-in/email`;

/**
 * A rota de troca de senha **do produto** — a que a sessão restrita alcança (RN-09).
 *
 * SUT_IS_CORRECT_BECAUSE: até a T9 esta constante apontava para `/v1/auth/change-password`, a rota
 * NATIVA do arcabouço, que deixou de ser publicada por entrega declarada daquela task (decisão D7
 * do tech-alignment, fechamento do débito D21). Mudaram o caminho e o vocabulário do corpo
 * (`{ senhaAtual, senhaNova }`), e nada mais: aqui a troca é PASSO de arranjo — `cumprirTrocaObrigatoria`
 * tira a sessão da restrição para que o caso exercite a autorização, e não a troca.
 */
const ROTA_DE_TROCA_DE_SENHA = `/${PREFIXO_DE_VERSAO}/${CAMINHO_DA_TROCA_DE_SENHA_DO_PRODUTO}`;

/** Caminho, relativo à raiz, da rota de sessão do produto. Composto, nunca escrito à mão. */
const CAMINHO_DA_SESSAO_CORRENTE = `/${PREFIXO_DE_VERSAO}/${CAMINHO_DA_SESSAO}`;

/** Caminho, relativo à raiz, da coleção de empresas do operador. */
const CAMINHO_DAS_EMPRESAS = `/${PREFIXO_DE_VERSAO}/${CAMINHO_DO_MASTER}/empresas`;

/** Caminho, relativo à raiz, da coleção de pessoas da empresa — a superfície desta task. */
const CAMINHO_DAS_PESSOAS = `/${PREFIXO_DE_VERSAO}/${CAMINHO_DOS_USUARIOS}`;

/**
 * As mensagens canônicas de cada código, escritas por extenso.
 *
 * Literais, e **não** lidas de `MENSAGEM_POR_CODIGO`: os casos comparam corpos inteiros por
 * igualdade, e derivá-los da mesma tabela que o SUT usa faria a asserção concordar consigo mesma —
 * um erro de texto na tabela passaria despercebido nos dois lados.
 */
const MENSAGEM_SEM_SESSAO = 'sessão inválida ou expirada';
const MENSAGEM_DE_CAMPO_INVALIDO = 'requisição inválida';
const MENSAGEM_DE_NAO_ENCONTRADO = 'recurso não encontrado';

/**
 * A política da janela da listagem de pessoas, escrita **por extenso**.
 *
 * Literais aqui, e não derivados das constantes do módulo, pela mesma razão que as mensagens
 * canônicas são literais: derivá-los faria a asserção concordar com o SUT, e o teto poderia ser
 * empurrado até nunca disparar sem que caso algum reprovasse. A coerência entre este par e o do
 * módulo é asserida no `CT-233`.
 */
const TETO_DECLARADO_DA_PAGINA = 200;
const PADRAO_DECLARADO_DA_PAGINA = 50;

/** Comprimento mínimo exigido da Senha provisória devolvida (`CT-222`). */
const COMPRIMENTO_MINIMO_DA_SENHA_PROVISORIA = 10;

/** Forma canônica do UUID — a chave exposta de entidade de identidade (ADR-0012). */
const PADRAO_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;

/** Senha que satisfaz a política de força e não é a de ninguém da carga. */
const SENHA_TROCADA = 'brisa9Verde!';

/** As cinco chaves que um item da listagem de pessoas pode ter — o conjunto FECHADO do contrato. */
const CHAVES_DA_PESSOA_PUBLICADA = ['ativo', 'email', 'nome', 'perfil', 'usuarioId'];

/** A chave concedida individualmente no `CT-229`, fora da matriz de `USUARIO_EMPRESA`. */
const CHAVE_CONCEDIDA: ChaveDoCatalogo = 'TELA:financeiro';

/** A chave negada individualmente no `CT-229`, **dentro** da matriz de `USUARIO_EMPRESA`. */
const CHAVE_NEGADA: ChaveDoCatalogo = 'TELA:resumo';

/**
 * A chave que abre as sete rotas desta superfície — a que o `CT-237` concede ao sujeito da escalada.
 *
 * Literal, e não derivada da exigência declarada no controlador: derivá-la faria a asserção
 * concordar com o SUT, e trocar a exigência da classe deixaria de reprovar caso algum.
 */
const CHAVE_DA_ADMINISTRACAO: ChaveDoCatalogo = 'TELA:usuarios';

/** O motivo que a recusa do auto-alvo publica, escrito por extenso — ele entra no contrato. */
const MOTIVO_DECLARADO_DE_AUTO_ALVO = 'ALVO_E_QUEM_AGE';

// ---------------------------------------------------------------------------------------------
// O elenco
// ---------------------------------------------------------------------------------------------

/**
 * O Admin da empresa A, **da carga** — o sujeito que age em quase todos os casos.
 *
 * Ele tem senha definitiva e nenhuma exigência pendente, então a sessão dele nasce **plena** com uma
 * entrada só. Ver o cabeçalho para por que os Admins não são admitidos pela rota do Master aqui.
 */
const ADMIN_DE_A = pessoaSemeada('admin.a@exemplo.com.br');

/** O Admin da empresa B — existe para que "não alcança dado alheio" tenha um alheio concreto. */
const ADMIN_DE_B = pessoaSemeada('admin.b@exemplo.com.br');

let identidade: IdentidadeEfemera;
let fila: FilaEfemera;
let acessoAoNegocio: AcessoAoBanco;
let aplicacao: NestFastifyApplication;
let base: string;
let ambienteAnterior: NodeJS.ProcessEnv;

/** O cookie do Master, com o segundo fator já cumprido pela via real. */
let cookieDoMaster: string;

/** As sessões plenas dos dois Admins da carga, abertas uma vez pela rota real de entrada. */
let cookieDoAdminDeA: string;
let cookieDoAdminDeB: string;

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

  cookieDoMaster = await entrarComSegundoFatorCumprido(
    base,
    USUARIO_MASTER.email,
    SENHA_DA_CARGA,
    identidade.autenticacao,
  );
  cookieDoAdminDeA = await entrar(ADMIN_DE_A.email, SENHA_DA_CARGA);
  cookieDoAdminDeB = await entrar(ADMIN_DE_B.email, SENHA_DA_CARGA);
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

describe('administração das pessoas da empresa pelas rotas do Admin (T8)', () => {
  it(
    'CT-222 — a Senha provisória é exibida uma única vez, nos dois caminhos de emissão',
    async () => {
      // =========================================================================================
      // Caminho 1 — Master → Admin
      // =========================================================================================
      const empresa = await admitirEmpresa();
      const admitido = await admitirAdministrador(empresa.id, enderecoNovo('admin.senha'));

      // A senha veio no corpo **daquela** resposta, e satisfaz a política de força.
      expect(typeof admitido.senhaProvisoria).toBe('string');
      expect(admitido.senhaProvisoria.length).toBeGreaterThanOrEqual(
        COMPRIMENTO_MINIMO_DA_SENHA_PROVISORIA,
      );

      // Ela SERVE para entrar — sem esta perna, "a senha não vaza" passaria sobre uma senha que
      // nunca funcionou, e o caso não diria nada sobre o que ela é. A sessão nasce RESTRITA, que é o
      // que a RN-09 exige de quem ainda não trocou a Senha provisória.
      const entradaDoAdmitido = await entrarCom(admitido.email, admitido.senhaProvisoria);
      expect(entradaDoAdmitido.status).toBe(200);
      const cookieDoAdmitido = credencialDeSessao(entradaDoAdmitido);

      // --- Nenhuma consulta posterior a devolve, por caminho nenhum -----------------------------
      //
      // A busca é sobre a SERIALIZAÇÃO crua do corpo, e não sobre o objeto: um valor aninhado dentro
      // de um campo que uma asserção de chaves não alcança apareceria aqui. As três consultas são as
      // que o cartão nomeia, e a listagem corre com a sessão PLENA de um Admin — a do recém-admitido
      // é restrita e nem alcançaria a rota.
      await afirmarAusenciaNasConsultasPosteriores(admitido.senhaProvisoria, cookieDoAdminDeA);
      // E na sessão do PRÓPRIO admitido, que é o caminho mais curto entre quem conhece a senha e uma
      // consulta que poderia ecoá-la.
      const sessaoDoAdmitido = await pedir(CAMINHO_DA_SESSAO_CORRENTE, {
        cookie: cookieDoAdmitido,
      });
      expect(sessaoDoAdmitido.status).toBe(200);
      expect(ocorrenciasNoTexto(sessaoDoAdmitido.texto, admitido.senhaProvisoria)).toBe(0);

      // =========================================================================================
      // Caminho 2 — Admin → Usuário (a rota desta task)
      // =========================================================================================
      const criada = await criarPessoa(cookieDoAdminDeA, {
        nome: 'Pessoa Criada Pelo Admin',
        email: enderecoNovo('pessoa.senha'),
        perfil: 'USUARIO_EMPRESA',
      });

      // O conjunto de chaves do corpo é FECHADO — um campo novo aqui vazaria para o contrato.
      expect(Object.keys(criada).sort()).toEqual([
        'email',
        'perfil',
        'senhaProvisoria',
        'usuarioId',
      ]);
      expect(criada.usuarioId).toMatch(PADRAO_UUID);
      expect(typeof criada.senhaProvisoria).toBe('string');
      expect(criada.senhaProvisoria.length).toBeGreaterThanOrEqual(
        COMPRIMENTO_MINIMO_DA_SENHA_PROVISORIA,
      );
      // As duas emissões sorteiam senhas diferentes — uma constante passaria em tudo acima.
      expect(criada.senhaProvisoria).not.toBe(admitido.senhaProvisoria);

      const entradaDaCriada = await entrarCom(criada.email, criada.senhaProvisoria);
      expect(entradaDaCriada.status).toBe(200);
      const cookieDaPessoa = credencialDeSessao(entradaDaCriada);

      await afirmarAusenciaNasConsultasPosteriores(criada.senhaProvisoria, cookieDoAdminDeA);
      // Inclusive na sessão da PRÓPRIA pessoa, que é o caminho mais curto entre quem conhece a
      // senha e uma consulta que poderia ecoá-la.
      const propriaSessao = await pedir(CAMINHO_DA_SESSAO_CORRENTE, { cookie: cookieDaPessoa });
      expect(propriaSessao.status).toBe(200);
      expect(ocorrenciasNoTexto(propriaSessao.texto, criada.senhaProvisoria)).toBe(0);
    },
    LIMITE_CASO_MS,
  );

  it(
    'CT-228 — desativar a pessoa encerra a sessão dela na hora, e só a dela',
    async () => {
      // --- Arranjo: o Admin da empresa A e duas pessoas dela, ambas com senha trocada -----------
      //
      // As duas nascem pela rota real desta task e cumprem a troca obrigatória, que é a
      // pré-condição literal do cartão: elas operam com sessão PLENA, e não restrita.
      const cookieDoAdmin = cookieDoAdminDeA;

      const alvo = await pessoaOperandoComSenhaTrocada(cookieDoAdmin, 'alvo.desativacao');
      const colega = await pessoaOperandoComSenhaTrocada(cookieDoAdmin, 'colega.desativacao');

      // As duas estão de fato operando — precondição AFIRMADA, e não suposta.
      for (const cookie of [alvo.cookie, colega.cookie]) {
        expect((await pedir(CAMINHO_DA_SESSAO_CORRENTE, { cookie })).status).toBe(200);
      }
      // As contagens são MEDIDAS, e não supostas: a troca obrigatória da Senha provisória pode ou
      // não reemitir a credencial de sessão, e fixar o número aqui amarraria o caso a um detalhe do
      // arcabouço em vez de à propriedade que ele persegue. O que discrimina é o par — o alvo vai à
      // contagem medida e depois a zero; a colega não se move.
      const sessoesDoAlvoAntes = await contarSessoesDaPessoa(identidade.acesso, alvo.usuarioId);
      const sessoesDaColegaAntes = await contarSessoesDaPessoa(identidade.acesso, colega.usuarioId);
      expect(sessoesDoAlvoAntes).toBeGreaterThan(0);
      expect(sessoesDaColegaAntes).toBeGreaterThan(0);

      // --- A desativação -----------------------------------------------------------------------
      const desativacao = await pedir(`${CAMINHO_DAS_PESSOAS}/${alvo.usuarioId}/desativacao`, {
        metodo: 'POST',
        cookie: cookieDoAdmin,
      });

      expect(desativacao.status).toBe(200);
      expect(desativacao.corpo).toEqual({
        usuarioId: alvo.usuarioId,
        ativo: false,
        // O número EXATO das que existiam, e não "alguma": ele é a evidência de que o encerramento
        // aconteceu no ato. Uma implementação que apenas marcasse devolveria `0` e reprovaria aqui.
        sessoesEncerradas: sessoesDoAlvoAntes,
      });

      // --- A operação da desativada, com o cookie anterior --------------------------------------
      const depois = await pedir(CAMINHO_DA_SESSAO_CORRENTE, { cookie: alvo.cookie });
      expect(depois.status).toBe(401);
      expect(depois.corpo).toEqual({
        codigo: CodigoErro.NAO_AUTENTICADO,
        mensagem: MENSAGEM_SEM_SESSAO,
      });
      expect(await contarSessoesDaPessoa(identidade.acesso, alvo.usuarioId)).toBe(0);

      // --- A COLEGA SEGUE OPERANDO: é esta perna que separa "por pessoa" de "por empresa" -------
      //
      // Sem ela, uma implementação que encerrasse as sessões da empresa inteira passaria em todas as
      // asserções acima.
      const daColega = await pedir(CAMINHO_DA_SESSAO_CORRENTE, { cookie: colega.cookie });
      expect(daColega.status).toBe(200);
      expect(await contarSessoesDaPessoa(identidade.acesso, colega.usuarioId)).toBe(
        sessoesDaColegaAntes,
      );
      // E a do próprio Admin também — o encerramento não alcança quem administrou.
      expect((await pedir(CAMINHO_DA_SESSAO_CORRENTE, { cookie: cookieDoAdmin })).status).toBe(200);

      // --- E a desativada não entra de novo ------------------------------------------------------
      const novaEntrada = await entrarCom(alvo.email, SENHA_TROCADA);
      expect(novaEntrada.status).toBe(401);
      expect(novaEntrada.corpo).toEqual({
        codigo: CodigoErro.CREDENCIAL_INVALIDA,
        mensagem: 'credencial inválida',
      });
      expect(novaEntrada.cookies.filter(ehCookieDeSessao)).toEqual([]);
      expect(await contarSessoesDaPessoa(identidade.acesso, alvo.usuarioId)).toBe(0);

      // Repetir a desativação devolve o mesmo corpo, com zero encerradas — o par (medido → 0) é o
      // que torna a asserção discriminante: uma implementação que devolvesse `0` sempre reprova
      // acima, e uma que devolvesse uma constante positiva reprova aqui.
      const repetida = await pedir(`${CAMINHO_DAS_PESSOAS}/${alvo.usuarioId}/desativacao`, {
        metodo: 'POST',
        cookie: cookieDoAdmin,
      });
      expect(repetida.status).toBe(200);
      expect(repetida.corpo).toEqual({
        usuarioId: alvo.usuarioId,
        ativo: false,
        sessoesEncerradas: 0,
      });
    },
    LIMITE_CASO_MS,
  );

  it(
    'CT-229 — reativar a pessoa devolve exatamente as permissões que ela tinha',
    async () => {
      // --- Arranjo: pessoa com DOIS ajustes individuais, um de cada efeito ----------------------
      const cookieDoAdmin = cookieDoAdminDeA;
      const pessoa = await pessoaOperando(cookieDoAdmin, 'alvo.reativacao');

      const ajuste = await pedir(`${CAMINHO_DAS_PESSOAS}/${pessoa.usuarioId}/permissoes`, {
        metodo: 'POST',
        cookie: cookieDoAdmin,
        corpo: {
          ajustes: [
            { tipo: 'TELA', chave: nomeDaChave(CHAVE_CONCEDIDA), efeito: 'CONCEDIDA' },
            { tipo: 'TELA', chave: nomeDaChave(CHAVE_NEGADA), efeito: 'NEGADA' },
          ],
        },
      });
      expect(ajuste.status).toBe(200);

      // --- O instantâneo, lido pela rota real de sessão -----------------------------------------
      //
      // A sessão dela é relida porque o contador de versão mudou (ADR-0010) — sem isso o
      // instantâneo descreveria o efetivo de antes do ajuste.
      const antes = await lerSessao(pessoa.cookie);
      expect(antes.telas).toContain(CHAVE_CONCEDIDA);
      expect(antes.telas).not.toContain(CHAVE_NEGADA);
      expect(antes.versaoPermissoes).toBeGreaterThan(0);

      // --- Desativar e reativar ------------------------------------------------------------------
      const desativacao = await pedir(`${CAMINHO_DAS_PESSOAS}/${pessoa.usuarioId}/desativacao`, {
        metodo: 'POST',
        cookie: cookieDoAdmin,
      });
      expect(desativacao.status).toBe(200);

      const reativacao = await pedir(`${CAMINHO_DAS_PESSOAS}/${pessoa.usuarioId}/reativacao`, {
        metodo: 'POST',
        cookie: cookieDoAdmin,
      });
      expect(reativacao.status).toBe(200);
      expect(reativacao.corpo).toEqual({ usuarioId: pessoa.usuarioId, ativo: true });

      // --- Ela NÃO devolve a sessão (RN-05) ------------------------------------------------------
      const comCookieAnterior = await pedir(CAMINHO_DA_SESSAO_CORRENTE, { cookie: pessoa.cookie });
      expect(comCookieAnterior.status).toBe(401);
      expect(comCookieAnterior.corpo).toEqual({
        codigo: CodigoErro.NAO_AUTENTICADO,
        mensagem: MENSAGEM_SEM_SESSAO,
      });
      expect(await contarSessoesDaPessoa(identidade.acesso, pessoa.usuarioId)).toBe(0);

      // --- Mas devolve o EFETIVO, com os ajustes individuais -------------------------------------
      const cookieNovo = await entrar(pessoa.email, pessoa.senha);
      const depois = await lerSessao(cookieNovo);

      // Igualdade PROFUNDA sobre os dois eixos: uma reativação que devolvesse a matriz do perfil
      // (isto é, que tivesse apagado os ajustes na desativação) reprovaria aqui, e não numa
      // asserção de contenção.
      expect(depois.telas).toEqual(antes.telas);
      expect(depois.acoes).toEqual(antes.acoes);
      expect(depois.versaoPermissoes).toBe(antes.versaoPermissoes);
      // E as duas pontas do ajuste, nomeadas — a concedida está, a negada não está, e a negada é
      // uma chave que a matriz do perfil concederia.
      expect(depois.telas).toContain(CHAVE_CONCEDIDA);
      expect(depois.telas).not.toContain(CHAVE_NEGADA);
      expect(MATRIZ_POR_PERFIL.USUARIO_EMPRESA).toContain(CHAVE_NEGADA);
    },
    LIMITE_CASO_MS,
  );

  it(
    'CT-230 — o Admin da empresa A não alcança pessoa da empresa B, e a recusa vem do banco',
    async () => {
      // --- Duas empresas, cada uma com Admin e uma pessoa ---------------------------------------
      //
      // Os dois Admins são os da carga, um por empresa; a pessoa de B nasce pela rota real do Admin
      // de B e cumpre a troca obrigatória, que é a pré-condição literal do cartão.
      const pessoaDeB = await pessoaOperandoComSenhaTrocada(cookieDoAdminDeB, 'alvo.fronteira.b');

      // Ajustes semeados na pessoa de B, **para que uma alteração indevida fosse detectável**: sem
      // eles, "o estado de B não mudou" seria verdade vazia sobre uma pessoa sem estado.
      const semeadura = await pedir(`${CAMINHO_DAS_PESSOAS}/${pessoaDeB.usuarioId}/permissoes`, {
        metodo: 'POST',
        cookie: cookieDoAdminDeB,
        corpo: {
          ajustes: [{ tipo: 'TELA', chave: nomeDaChave(CHAVE_CONCEDIDA), efeito: 'CONCEDIDA' }],
        },
      });
      expect(semeadura.status).toBe(200);

      const estadoAntes = await estadoDaPessoa(EMPRESA_B.id, pessoaDeB.usuarioId);
      expect(estadoAntes).toEqual({
        perfil: 'USUARIO_EMPRESA',
        ativo: true,
        ajustes: 1,
        versaoPermissoes: 1,
      });

      // --- As CINCO rotas de `:id`, com a sessão do Admin de A e o identificador de B ------------
      for (const tentativa of rotasDeId(pessoaDeB.usuarioId)) {
        const recusada = await pedir(tentativa.alvo, {
          metodo: 'POST',
          cookie: cookieDoAdminDeA,
          ...('corpo' in tentativa ? { corpo: tentativa.corpo } : {}),
        });

        expect(recusada.status, tentativa.alvo).toBe(404);
        // Corpo INTEIRO por igualdade. É esta linha que separa "não achou" de "comparou e negou":
        // uma implementação que comparasse empresa devolveria `403 ACESSO_NEGADO`, e uma que
        // devolvesse `404` com detalhes revelaria que o recurso existe em outro lugar.
        expect(recusada.corpo, tentativa.alvo).toEqual({
          codigo: CodigoErro.RECURSO_NAO_ENCONTRADO,
          mensagem: MENSAGEM_DE_NAO_ENCONTRADO,
        });
      }

      // --- O ALVO ALHEIO QUE AINDA NÃO TEM VÍNCULO ----------------------------------------------
      //
      // A pessoa de B acima nasceu por `POST /v1/usuarios`, e portanto **já tem** vínculo de acesso:
      // o `404` dela prova que a política recorta a leitura, e não prova nada sobre a gravação. Este
      // segundo alvo fecha o outro lado, e é o que a garantia de vínculo do ALVO tornou necessário:
      // um Admin admitido por `POST /v1/master/empresas/:id/admin`, numa empresa que não é a de A,
      // que **nunca agiu** e portanto não tem linha em `negocio.acesso_usuario_app`.
      //
      // Sem o recorte por empresa do contexto em `garantirVinculoDeAcesso`, cada tentativa abaixo
      // tentaria gravar o vínculo dele com a empresa DELE sob o contexto de A: a política recusaria
      // pelo `WITH CHECK` e a rota responderia **erro de servidor**, onde o contrato manda `404`.
      // Com o recorte, o `SELECT` não casa, nenhuma linha nasce, e a recusa é a mesma ausência de
      // sempre.
      const empresaAlheia = await admitirEmpresa();
      const alheio = await admitirAdministrador(
        empresaAlheia.id,
        enderecoNovo('admin.sem.vinculo'),
      );

      const estadoAlheioAntes = await estadoDaPessoa(empresaAlheia.id, alheio.usuarioId);
      expect(estadoAlheioAntes).toEqual({
        perfil: 'ADMIN_EMPRESA',
        ativo: true,
        ajustes: 0,
        versaoPermissoes: 0,
      });

      for (const tentativa of rotasDeId(alheio.usuarioId)) {
        const recusada = await pedir(tentativa.alvo, {
          metodo: 'POST',
          cookie: cookieDoAdminDeA,
          ...('corpo' in tentativa ? { corpo: tentativa.corpo } : {}),
        });

        expect(recusada.status, tentativa.alvo).toBe(404);
        expect(recusada.corpo, tentativa.alvo).toEqual({
          codigo: CodigoErro.RECURSO_NAO_ENCONTRADO,
          mensagem: MENSAGEM_DE_NAO_ENCONTRADO,
        });
      }

      // NENHUM vínculo nasceu — nem sob o contexto de A (que é o que uma gravação com a empresa do
      // contexto produziria, e que tornaria a pessoa de outra empresa alcançável a partir de A), nem
      // sob o da empresa dele. É a asserção que separa "respondeu 404" de "não escreveu nada".
      expect(await contarVinculosVisiveis(EMPRESA_A.id, alheio.usuarioId)).toBe(0);
      expect(await contarVinculosVisiveis(empresaAlheia.id, alheio.usuarioId)).toBe(0);
      expect(await estadoDaPessoa(empresaAlheia.id, alheio.usuarioId)).toEqual(estadoAlheioAntes);

      // --- A listagem de A não revela nada de B --------------------------------------------------
      const listagem = await pedir(CAMINHO_DAS_PESSOAS, { cookie: cookieDoAdminDeA });
      expect(listagem.status).toBe(200);

      const pagina = listagem.corpo as PaginaDePessoasPublicada;
      expect(pagina.itens.length).toBeGreaterThan(0);
      // Zero ocorrências do identificador de B na SERIALIZAÇÃO crua — não só na projeção.
      expect(ocorrenciasNoTexto(listagem.texto, pessoaDeB.usuarioId)).toBe(0);
      expect(ocorrenciasNoTexto(listagem.texto, ADMIN_DE_B.id)).toBe(0);
      expect(ocorrenciasNoTexto(listagem.texto, pessoaDeB.email)).toBe(0);
      // E o Admin de A **está** lá — sem esta linha, "não vaza B" passaria com uma listagem vazia.
      expect(pagina.itens.map((item) => item.usuarioId)).toContain(ADMIN_DE_A.id);

      // --- O ESTADO DE B É IDÊNTICO ANTES E DEPOIS ----------------------------------------------
      //
      // A recusa sozinha não prova ausência de efeito: uma implementação que escrevesse e só então
      // recusasse passaria em todas as asserções acima e reprovaria aqui.
      expect(await estadoDaPessoa(EMPRESA_B.id, pessoaDeB.usuarioId)).toEqual(estadoAntes);
      // E a credencial dela continua servindo — a reemissão recusada não reescreveu senha alguma.
      expect((await entrarCom(pessoaDeB.email, SENHA_TROCADA)).status).toBe(200);
    },
    LIMITE_CASO_MS,
  );

  it(
    'CT-231 — trocar o perfil exige intenção declarada e descarta todos os ajustes',
    async () => {
      // --- Arranjo: pessoa `USUARIO_EMPRESA` com TRÊS ajustes individuais coerentes -------------
      const cookieDoAdmin = cookieDoAdminDeA;
      const empresaId = EMPRESA_A.id;
      const pessoa = await pessoaOperando(cookieDoAdmin, 'alvo.troca.perfil');

      const ajuste = await pedir(`${CAMINHO_DAS_PESSOAS}/${pessoa.usuarioId}/permissoes`, {
        metodo: 'POST',
        cookie: cookieDoAdmin,
        corpo: {
          ajustes: [
            { tipo: 'TELA', chave: 'financeiro', efeito: 'CONCEDIDA' },
            { tipo: 'ACAO', chave: 'emitir_boleto', efeito: 'CONCEDIDA' },
            { tipo: 'TELA', chave: 'imoveis', efeito: 'CONCEDIDA' },
          ],
        },
      });
      expect(ajuste.status).toBe(200);

      // --- As três dimensões, ANTES -------------------------------------------------------------
      const antes = await estadoDaPessoa(empresaId, pessoa.usuarioId);
      expect(antes).toEqual({
        perfil: 'USUARIO_EMPRESA',
        ativo: true,
        ajustes: 3,
        versaoPermissoes: 1,
      });

      // --- Sem a intenção declarada: RECUSA, informando quantos, e SEM EFEITO --------------------
      const semIntencao = await pedir(`${CAMINHO_DAS_PESSOAS}/${pessoa.usuarioId}/perfil`, {
        metodo: 'POST',
        cookie: cookieDoAdmin,
        corpo: { perfil: 'ADMIN_EMPRESA' },
      });

      expect(semIntencao.status).toBe(422);
      expect(semIntencao.corpo).toEqual({
        codigo: CodigoErro.CAMPO_INVALIDO,
        mensagem: MENSAGEM_DE_CAMPO_INVALIDO,
        campo: 'perfil',
        detalhes: { ajustesDescartados: 3 },
      });

      // **NADA MUDOU**, nas três dimensões. Verificar só o perfil deixaria passar uma implementação
      // que remove os ajustes e só então valida a intenção.
      expect(await estadoDaPessoa(empresaId, pessoa.usuarioId)).toEqual(antes);

      // O campo enviado explicitamente como `false` é tratado igual à ausência — nunca consentimento.
      const comFalso = await pedir(`${CAMINHO_DAS_PESSOAS}/${pessoa.usuarioId}/perfil`, {
        metodo: 'POST',
        cookie: cookieDoAdmin,
        corpo: { perfil: 'ADMIN_EMPRESA', descartarAjustes: false },
      });
      expect(comFalso.status).toBe(422);
      expect(await estadoDaPessoa(empresaId, pessoa.usuarioId)).toEqual(antes);

      // --- Com a intenção declarada: SUCESSO, e todos os ajustes deixam de existir ---------------
      const comIntencao = await pedir(`${CAMINHO_DAS_PESSOAS}/${pessoa.usuarioId}/perfil`, {
        metodo: 'POST',
        cookie: cookieDoAdmin,
        corpo: { perfil: 'ADMIN_EMPRESA', descartarAjustes: true },
      });

      expect(comIntencao.status).toBe(200);
      expect(comIntencao.corpo).toEqual({
        usuarioId: pessoa.usuarioId,
        perfil: 'ADMIN_EMPRESA',
        versaoPermissoes: antes.versaoPermissoes + 1,
      });

      const depois = await estadoDaPessoa(empresaId, pessoa.usuarioId);
      expect(depois).toEqual({
        perfil: 'ADMIN_EMPRESA',
        ativo: true,
        ajustes: 0,
        versaoPermissoes: antes.versaoPermissoes + 1,
      });

      // --- E o efetivo dela vira o padrão do perfil novo -----------------------------------------
      //
      // Lido pela rota real de sessão, com o cookie ANTERIOR: a sessão segue de pé e o efetivo é
      // relido porque o contador divergiu (ADR-0010, RN-03) — mudar permissão não interrompe.
      const sessao = await lerSessao(pessoa.cookie);
      expect([...sessao.telas, ...sessao.acoes].sort()).toEqual(
        [...MATRIZ_POR_PERFIL.ADMIN_EMPRESA].sort(),
      );
    },
    LIMITE_CASO_MS,
  );

  it(
    'CT-232 — o ajuste incoerente e a chave fora do catálogo são recusados antes da escrita',
    async () => {
      const cookieDoAdmin = cookieDoAdminDeA;
      const empresaId = EMPRESA_A.id;
      const pessoa = await pessoaOperando(cookieDoAdmin, 'alvo.recusa.ajuste');

      const antes = await estadoDaPessoa(empresaId, pessoa.usuarioId);
      expect(antes.ajustes).toBe(0);
      expect(antes.versaoPermissoes).toBe(0);

      // --- Ação sensível SEM a área de tela que a comporta (RN-02) -------------------------------
      const incoerente = await pedir(`${CAMINHO_DAS_PESSOAS}/${pessoa.usuarioId}/permissoes`, {
        metodo: 'POST',
        cookie: cookieDoAdmin,
        corpo: { ajustes: [{ tipo: 'ACAO', chave: 'emitir_boleto', efeito: 'CONCEDIDA' }] },
      });

      expect(incoerente.status).toBe(422);
      expect(incoerente.corpo).toEqual({
        codigo: CodigoErro.CAMPO_INVALIDO,
        mensagem: 'a ação sensível concedida exige a área de tela correspondente',
        campo: 'permissoes',
        detalhes: { telaExigida: 'TELA:financeiro', acao: 'ACAO:emitir_boleto' },
      });
      // Recusada ANTES de qualquer escrita — nem ajuste, nem contador.
      expect(await estadoDaPessoa(empresaId, pessoa.usuarioId)).toEqual(antes);

      // --- Chave fora do catálogo, recusada na BORDA (RN-15) -------------------------------------
      const inventada = await pedir(`${CAMINHO_DAS_PESSOAS}/${pessoa.usuarioId}/permissoes`, {
        metodo: 'POST',
        cookie: cookieDoAdmin,
        corpo: { ajustes: [{ tipo: 'TELA', chave: 'inventada', efeito: 'CONCEDIDA' }] },
      });

      expect(inventada.status).toBe(422);
      // Corpo INTEIRO por igualdade, como todas as recusas irmãs deste arquivo. O envelope da
      // ADR-0012 tem quatro campos e nada mais, então a igualdade é exequível — e é ela que pega o
      // risco desta rota em particular: um `detalhes` que ecoasse a chave inválida enviada pelo
      // cliente, que é precisamente o que o docblock de `validar` promete não fazer.
      expect(inventada.corpo).toEqual({
        codigo: CodigoErro.CAMPO_INVALIDO,
        mensagem: MENSAGEM_DE_CAMPO_INVALIDO,
        campo: 'ajustes',
      });
      expect(await estadoDaPessoa(empresaId, pessoa.usuarioId)).toEqual(antes);

      // --- COMPANHEIRO POSITIVO: o par coerente é ACEITO ----------------------------------------
      //
      // Sem ele, "a rota recusa o incoerente" passaria com uma rota que recusa TODO ajuste — e as
      // duas recusas acima estariam provadas sobre nada.
      const coerente = await pedir(`${CAMINHO_DAS_PESSOAS}/${pessoa.usuarioId}/permissoes`, {
        metodo: 'POST',
        cookie: cookieDoAdmin,
        corpo: {
          ajustes: [
            { tipo: 'TELA', chave: 'financeiro', efeito: 'CONCEDIDA' },
            { tipo: 'ACAO', chave: 'emitir_boleto', efeito: 'CONCEDIDA' },
          ],
        },
      });

      expect(coerente.status).toBe(200);
      expect(coerente.corpo).toEqual({
        usuarioId: pessoa.usuarioId,
        // O efetivo é o da matriz do perfil MAIS as duas chaves concedidas, repartido nos dois
        // eixos e ordenado — igualdade profunda, e não contenção.
        telas: ['TELA:financeiro', 'TELA:resumo'],
        acoes: ['ACAO:emitir_boleto'],
        versaoPermissoes: 1,
      });
      expect(await estadoDaPessoa(empresaId, pessoa.usuarioId)).toEqual({
        perfil: 'USUARIO_EMPRESA',
        ativo: true,
        ajustes: 2,
        versaoPermissoes: 1,
      });

      // --- E o conjunto é COMPLETO: um arranjo vazio remove todos -------------------------------
      const vazio = await pedir(`${CAMINHO_DAS_PESSOAS}/${pessoa.usuarioId}/permissoes`, {
        metodo: 'POST',
        cookie: cookieDoAdmin,
        corpo: { ajustes: [] },
      });

      expect(vazio.status).toBe(200);
      expect(vazio.corpo).toEqual({
        usuarioId: pessoa.usuarioId,
        telas: [...MATRIZ_POR_PERFIL.USUARIO_EMPRESA],
        acoes: [],
        versaoPermissoes: 2,
      });
      expect((await estadoDaPessoa(empresaId, pessoa.usuarioId)).ajustes).toBe(0);
    },
    LIMITE_CASO_MS,
  );

  it(
    'CT-233 — a janela da listagem de pessoas é servida, e o teto RECUSA',
    async () => {
      // --- A política, amarrada ao módulo -------------------------------------------------------
      //
      // Sem esta linha os dois números seriam órfãos: alargar a constante alargaria junto todo
      // pedido derivado dela, e a fronteira poderia ser empurrada até nunca disparar sem que caso
      // algum reprovasse.
      expect([PAGINA_PADRAO_DE_PESSOAS, MAIOR_PAGINA_DE_PESSOAS]).toEqual([
        PADRAO_DECLARADO_DA_PAGINA,
        TETO_DECLARADO_DA_PAGINA,
      ]);

      const cookieDoAdmin = cookieDoAdminDeA;
      await criarPessoa(cookieDoAdmin, {
        nome: 'Primeira Da Janela',
        email: enderecoNovo('janela.um'),
        perfil: 'USUARIO_EMPRESA',
      });
      await criarPessoa(cookieDoAdmin, {
        nome: 'Segunda Da Janela',
        email: enderecoNovo('janela.dois'),
        perfil: 'USUARIO_EMPRESA',
      });

      // --- Sem parâmetro algum: a janela PADRÃO -------------------------------------------------
      const padrao = await pedir(CAMINHO_DAS_PESSOAS, { cookie: cookieDoAdmin });
      expect(padrao.status).toBe(200);

      const paginaPadrao = padrao.corpo as PaginaDePessoasPublicada;
      expect(Object.keys(paginaPadrao).sort()).toEqual([
        'deslocamento',
        'itens',
        'limite',
        'total',
      ]);
      expect(paginaPadrao.limite).toBe(PADRAO_DECLARADO_DA_PAGINA);
      expect(paginaPadrao.deslocamento).toBe(0);
      // O conjunto FECHADO de chaves, item a item — um campo acrescentado a um ramo condicional
      // escaparia de uma amostra do primeiro item.
      expect(paginaPadrao.itens.map((item) => Object.keys(item).sort())).toEqual(
        paginaPadrao.itens.map(() => CHAVES_DA_PESSOA_PUBLICADA),
      );

      const totalDoConjunto = paginaPadrao.total;
      expect(totalDoConjunto).toBeGreaterThanOrEqual(3);

      // --- A segunda página é ALCANÇÁVEL, não apenas ecoada -------------------------------------
      const primeira = await pedir(`${CAMINHO_DAS_PESSOAS}?limite=1&deslocamento=0`, {
        cookie: cookieDoAdmin,
      });
      const segunda = await pedir(`${CAMINHO_DAS_PESSOAS}?limite=1&deslocamento=1`, {
        cookie: cookieDoAdmin,
      });

      expect([primeira.status, segunda.status]).toEqual([200, 200]);

      const paginaUm = primeira.corpo as PaginaDePessoasPublicada;
      const paginaDois = segunda.corpo as PaginaDePessoasPublicada;

      expect([paginaUm.itens.length, paginaDois.itens.length]).toEqual([1, 1]);
      expect([paginaUm.limite, paginaUm.deslocamento]).toEqual([1, 0]);
      expect([paginaDois.limite, paginaDois.deslocamento]).toEqual([1, 1]);
      // **O item é OUTRO** — é esta linha que separa "a janela move o recorte" de "os dois campos
      // ecoam o que se pediu".
      expect(paginaDois.itens[0]?.usuarioId).not.toBe(paginaUm.itens[0]?.usuarioId);
      // E o `total` descreve o CONJUNTO, não a página.
      expect([paginaUm.total, paginaDois.total]).toEqual([totalDoConjunto, totalDoConjunto]);

      // --- Companheiro NEGATIVO: acima do teto RECUSA, e não trunca em silêncio -----------------
      const acimaDoTeto = await pedir(
        `${CAMINHO_DAS_PESSOAS}?limite=${String(TETO_DECLARADO_DA_PAGINA + 1)}`,
        { cookie: cookieDoAdmin },
      );

      expect(acimaDoTeto.status).toBe(422);
      expect(acimaDoTeto.corpo).toEqual({
        codigo: CodigoErro.CAMPO_INVALIDO,
        mensagem: MENSAGEM_DE_CAMPO_INVALIDO,
        campo: 'limite',
      });

      // O teto EXATO passa. Sem este par, um teto de `1` também recusaria o pedido acima, e a perna
      // negativa não diria nada sobre ONDE a fronteira está.
      const noTeto = await pedir(
        `${CAMINHO_DAS_PESSOAS}?limite=${String(TETO_DECLARADO_DA_PAGINA)}`,
        { cookie: cookieDoAdmin },
      );
      expect(noTeto.status).toBe(200);
      expect((noTeto.corpo as PaginaDePessoasPublicada).limite).toBe(TETO_DECLARADO_DA_PAGINA);

      const abaixoDoPiso = await pedir(`${CAMINHO_DAS_PESSOAS}?deslocamento=-1`, {
        cookie: cookieDoAdmin,
      });
      expect(abaixoDoPiso.status).toBe(422);
      expect(abaixoDoPiso.corpo).toEqual({
        codigo: CodigoErro.CAMPO_INVALIDO,
        mensagem: MENSAGEM_DE_CAMPO_INVALIDO,
        campo: 'deslocamento',
      });
    },
    LIMITE_CASO_MS,
  );

  it(
    'CT-237 — nenhuma das cinco rotas de `:id` aceita quem age como alvo',
    async () => {
      const cookieDoAdmin = cookieDoAdminDeA;
      const empresaId = EMPRESA_A.id;

      // =========================================================================================
      // O SUJEITO DA ESCALADA — uma pessoa comum com UMA chave concedida individualmente
      // =========================================================================================
      //
      // É o cenário exato do vetor: a exigência desta superfície é de CHAVE, não de perfil, então
      // conceder `TELA:usuarios` a uma `USUARIO_EMPRESA` a faz alcançar as sete rotas. Sem a recusa
      // do auto-alvo, ela sairia do piso do perfil para o catálogo inteiro sozinha.
      const escalador = await pessoaOperandoComSenhaTrocada(cookieDoAdmin, 'auto.alvo');

      const concessao = await pedir(`${CAMINHO_DAS_PESSOAS}/${escalador.usuarioId}/permissoes`, {
        metodo: 'POST',
        cookie: cookieDoAdmin,
        corpo: {
          ajustes: [
            { tipo: 'TELA', chave: nomeDaChave(CHAVE_DA_ADMINISTRACAO), efeito: 'CONCEDIDA' },
          ],
        },
      });
      expect(concessao.status).toBe(200);

      // --- PREMISSA AFIRMADA: com a chave, ela DE FATO alcança a superfície ---------------------
      //
      // Sem esta linha o caso provaria a recusa sobre alguém que a guarda barraria antes, e não
      // diria nada sobre escalada: todo `422` abaixo seria compatível com um `403` que nunca chega.
      const listagemDoEscalador = await pedir(CAMINHO_DAS_PESSOAS, { cookie: escalador.cookie });
      expect(listagemDoEscalador.status).toBe(200);

      // --- O estado e o efetivo ANTES, ancorados por igualdade ----------------------------------
      const estadoAntes = await estadoDaPessoa(empresaId, escalador.usuarioId);
      expect(estadoAntes).toEqual({
        perfil: 'USUARIO_EMPRESA',
        ativo: true,
        ajustes: 1,
        versaoPermissoes: 1,
      });

      const efetivoAntes = await lerSessao(escalador.cookie);
      // Igualdade profunda sobre o conjunto: é o piso do perfil MAIS a chave concedida, e nada além.
      // Uma asserção de contenção não distinguiria isto do catálogo inteiro, que é o desfecho da
      // escalada.
      expect([...efetivoAntes.telas].sort()).toEqual(
        [...MATRIZ_POR_PERFIL.USUARIO_EMPRESA, CHAVE_DA_ADMINISTRACAO].sort(),
      );
      expect(efetivoAntes.acoes).toEqual([]);

      // =========================================================================================
      // AS CINCO ROTAS, PARA OS DOIS ATORES, NAS DUAS GRAFIAS — o auto-alvo é recusado sempre
      // =========================================================================================
      //
      // Os dois atores importam por razões diferentes: o escalador é o vetor de segurança, e o Admin
      // é o que fecha a autodesativação — o único Admin da empresa podia se desativar e trancar a
      // administração inteira, com socorro só pela rota do Master.
      //
      // **As duas grafias** foram acrescentadas na rodada 5, e a segunda é o vetor que o Gate 2
      // mediu: `z.uuid()` aceita o UUID em caixa alta e devolve o valor **verbatim**, enquanto
      // `uuid_in` do Postgres parseia hexadecimal **sem distinguir caixa** — a consulta acha a MESMA
      // pessoa, e a comparação de string do auto-alvo respondia `false`. Exercitar só a forma que o
      // banco devolve prova a recusa exatamente na única grafia que nunca precisou ser recusada.
      const atores = [
        { rotulo: 'Admin da empresa', cookie: cookieDoAdmin, usuarioId: ADMIN_DE_A.id },
        {
          rotulo: 'pessoa com TELA:usuarios',
          cookie: escalador.cookie,
          usuarioId: escalador.usuarioId,
        },
      ];

      // --- PREMISSA AFIRMADA: a segunda grafia é de fato OUTRA string --------------------------
      //
      // A caixa alta só produz uma grafia diferente quando o identificador tem dígito hexadecimal
      // **alfabético**. O Admin da empresa é semeado com `11111111-0000-4000-8000-000000000001`,
      // que só tem dígitos decimais: para ele `toUpperCase()` devolve a mesma string, e a segunda
      // perna é uma repetição inofensiva — não existe grafia alternativa daquele identificador.
      // Quem carrega o vetor é o **escalador**, cujo identificador o banco sorteia. Sem esta linha,
      // uma execução que sorteasse um identificador degenerado passaria provando menos do que o
      // caso diz provar, e nada acusaria.
      expect(escalador.usuarioId.toUpperCase()).not.toBe(escalador.usuarioId);

      for (const ator of atores) {
        for (const grafia of grafiasDoIdentificador(ator.usuarioId)) {
          for (const tentativa of rotasDeId(grafia.valor)) {
            const recusada = await pedir(tentativa.alvo, {
              metodo: 'POST',
              cookie: ator.cookie,
              ...('corpo' in tentativa ? { corpo: tentativa.corpo } : {}),
            });

            const rotulo = `${ator.rotulo} (${grafia.rotulo}) → ${tentativa.alvo}`;
            expect(recusada.status, rotulo).toBe(422);
            // Corpo INTEIRO por igualdade, como todas as recusas irmãs deste arquivo: o envelope da
            // ADR-0012 tem quatro campos e nada mais. É esta linha que fixa o contrato que congela —
            // e que impediria a recusa de virar um `404` (que mentiria: a pessoa existe e é da
            // empresa) ou um `403` (que seria uma segunda definição de recusa de autorização, fora do
            // ponto de aplicação único da guarda).
            //
            // Ela é também o que discrimina a recusa CERTA da recusa por acaso na perna da caixa
            // alta: uma borda que simplesmente rejeitasse a grafia maiúscula como UUID inválido
            // responderia `422` no mesmo `campo: 'id'` — e **sem** `detalhes`, reprovando aqui.
            expect(recusada.corpo, rotulo).toEqual({
              codigo: CodigoErro.CAMPO_INVALIDO,
              mensagem: MENSAGEM_DE_CAMPO_INVALIDO,
              campo: 'id',
              detalhes: { motivo: MOTIVO_DECLARADO_DE_AUTO_ALVO },
            });
          }
        }
      }

      // --- E o ataque na forma literal: conceder a si mesma o CATÁLOGO INTEIRO -------------------
      //
      // O laço acima já cobre a rota, com um ajuste só; esta perna é a escalada como ela seria de
      // fato tentada, e existe para que o caso seja legível como o vetor que fecha.
      const catalogoInteiro = await pedir(
        `${CAMINHO_DAS_PESSOAS}/${escalador.usuarioId}/permissoes`,
        {
          metodo: 'POST',
          cookie: escalador.cookie,
          corpo: {
            ajustes: [...MATRIZ_POR_PERFIL.ADMIN_EMPRESA].map((chave) => ({
              tipo: chave.startsWith('TELA:') ? 'TELA' : 'ACAO',
              chave: nomeDaChave(chave),
              efeito: 'CONCEDIDA',
            })),
          },
        },
      );
      expect(catalogoInteiro.status).toBe(422);

      // --- NADA MUDOU, e o efetivo dela continua sendo o de antes -------------------------------
      //
      // A recusa sozinha não prova ausência de escalada: uma implementação que escrevesse e só então
      // recusasse passaria em tudo acima e reprovaria aqui.
      expect(await estadoDaPessoa(empresaId, escalador.usuarioId)).toEqual(estadoAntes);

      const efetivoDepois = await lerSessao(escalador.cookie);
      expect(efetivoDepois.telas).toEqual(efetivoAntes.telas);
      expect(efetivoDepois.acoes).toEqual(efetivoAntes.acoes);
      expect(efetivoDepois.versaoPermissoes).toBe(efetivoAntes.versaoPermissoes);
      // E o desfecho da escalada, nomeado pelo conjunto LITERAL que ela não alcançou. A igualdade
      // acima é **relativa**: ela prova que nada mudou em relação ao retrato de antes, e nada mais.
      // Esta é **absoluta** — reprova por qualquer chave a mais, e é a que continua de pé se um dia
      // a relativa for afrouxada, que é a regressão de prova a temer aqui. Sob a escalada total o
      // efetivo dela viraria as **dez** telas do catálogo, e esta linha reprova nomeando as duas
      // que ela deveria ter.
      //
      // A forma anterior — `telas.length < MATRIZ_POR_PERFIL.ADMIN_EMPRESA.length` — comparava
      // dimensões diferentes: `telas` é subconjunto das dez `CHAVES_DE_TELA`, e a matriz do Admin
      // soma as dez telas com as sete ações. `|telas| <= 10 < 17` valia **incondicionalmente**,
      // inclusive sob a escalada total. Ela não pegava mundo nenhum, e constava como prova. O
      // **M13** mede as duas formas lado a lado, sob a escalada consumada.
      expect([...efetivoDepois.telas].sort()).toEqual(
        [...MATRIZ_POR_PERFIL.USUARIO_EMPRESA, CHAVE_DA_ADMINISTRACAO].sort(),
      );

      // =========================================================================================
      // A PERNA POSITIVA — o Admin segue alcançando OUTRO Admin, nas cinco rotas
      // =========================================================================================
      //
      // Sem ela, "recusa auto-alvo" passaria com uma implementação que recusa tudo, ou que recusa
      // todo alvo de perfil `ADMIN_EMPRESA`. O alvo é outro Admin de propósito: é a pessoa que mais
      // se parece com quem age, e a única diferença que pode explicar o desfecho é a identidade.
      //
      // Ela roda nas **duas grafias**, e a segunda carrega uma segunda prova: o identificador em
      // caixa alta **alcança a pessoa normalmente** (`200` nas cinco rotas). É o que impede a leitura
      // errada dos `422` acima — eles são recusa de IDENTIDADE, e não a borda repelindo a grafia.
      const outroAdmin = await criarPessoa(cookieDoAdmin, {
        nome: 'Outro Administrador Da Empresa',
        email: enderecoNovo('outro.admin'),
        perfil: 'ADMIN_EMPRESA',
      });

      // A mesma premissa da perna negativa, pela mesma razão: sem grafia distinta, o segundo laço
      // repetiria o primeiro e o `200` em caixa alta não diria nada.
      expect(outroAdmin.usuarioId.toUpperCase()).not.toBe(outroAdmin.usuarioId);

      for (const grafia of grafiasDoIdentificador(outroAdmin.usuarioId)) {
        for (const tentativa of rotasDeId(grafia.valor)) {
          const aceita = await pedir(tentativa.alvo, {
            metodo: 'POST',
            cookie: cookieDoAdmin,
            ...('corpo' in tentativa ? { corpo: tentativa.corpo } : {}),
          });

          expect(aceita.status, `${grafia.rotulo} → ${tentativa.alvo}`).toBe(200);
        }
      }
    },
    LIMITE_CASO_MS,
  );
});

// ---------------------------------------------------------------------------------------------
// Observação de estado persistido
// ---------------------------------------------------------------------------------------------

/** As quatro dimensões do estado de uma pessoa que os casos comparam antes e depois. */
interface EstadoDaPessoa {
  readonly perfil: string;
  readonly ativo: boolean;
  readonly ajustes: number;
  readonly versaoPermissoes: number;
}

/**
 * Lê o estado completo de uma pessoa — as quatro dimensões, numa leitura só.
 *
 * As duas primeiras saem de `identidade` pelo acesso restrito; a contagem de ajustes sai de
 * `negocio`, **sob o contexto de tenant da empresa dela**, pela mesma unidade de trabalho da
 * produção. É o que permite ao `CT-230` afirmar que nada de B mudou enquanto A tentava alcançá-la —
 * e é a única forma de fazê-lo, porque a rota de A, por construção, não enxerga B.
 */
async function estadoDaPessoa(empresaId: string, usuarioId: string): Promise<EstadoDaPessoa> {
  const { usuario } = esquemaIdentidade;

  const [linha] = await identidade.acesso.identidade
    .select({
      perfil: usuario.perfil,
      ativo: usuario.ativo,
      versaoPermissoes: usuario.versaoPermissoes,
    })
    .from(usuario)
    .where(eq(usuario.id, usuarioId))
    .limit(1);

  if (linha === undefined) {
    throw new Error(`a pessoa ${usuarioId} não existe no banco desta execução`);
  }

  const ajustes = await contextoDeTenant.executarCom(
    { empresaId },
    async () =>
      await acessoAoNegocio.emUnidadeDeTrabalho(
        async (tx) => await contarAjustesDaPessoa(tx, usuarioId),
      ),
  );

  return {
    perfil: linha.perfil,
    ativo: linha.ativo,
    ajustes,
    versaoPermissoes: linha.versaoPermissoes,
  };
}

/**
 * Quantos vínculos de acesso existem para a pessoa, **visíveis sob o contexto de uma empresa**.
 *
 * Lida pela unidade de trabalho da produção, sob RLS forçada: o que ela conta é o que a política
 * deixa ver para aquela empresa, e não o conteúdo cru da tabela. É essa restrição que a torna a
 * asserção certa para o `CT-230` — contada sob o contexto de **A**, ela devolveria `1` se alguma
 * implementação gravasse o vínculo do alvo com a empresa do contexto em vez da empresa dele, que é
 * exatamente a forma de a fronteira de tenant cair pela porta da gravação.
 */
async function contarVinculosVisiveis(empresaId: string, usuarioId: string): Promise<number> {
  return await contextoDeTenant.executarCom(
    { empresaId },
    async () =>
      await acessoAoNegocio.emUnidadeDeTrabalho(async (tx) => {
        const [linha] = await tx<{ total: string }[]>`
          SELECT count(*) AS total
            FROM negocio.acesso_usuario_app
           WHERE usuario_id = ${usuarioId}
        `;

        return Number(linha?.total ?? 0);
      }),
  );
}

/**
 * As **cinco rotas de `:id`** desta superfície, para um alvo qualquer — escrita uma vez.
 *
 * O `CT-230` exercita duas pessoas de outra empresa (uma com vínculo, outra sem), e duas listas
 * ficariam livres para divergir: bastaria alguém acrescentar uma sexta rota a uma delas para a outra
 * passar a provar menos do que diz provar.
 */
function rotasDeId(usuarioId: string) {
  return [
    {
      alvo: `${CAMINHO_DAS_PESSOAS}/${usuarioId}/permissoes`,
      corpo: { ajustes: [{ tipo: 'TELA', chave: 'imoveis', efeito: 'CONCEDIDA' }] },
    },
    {
      alvo: `${CAMINHO_DAS_PESSOAS}/${usuarioId}/perfil`,
      corpo: { perfil: 'ADMIN_EMPRESA', descartarAjustes: true },
    },
    { alvo: `${CAMINHO_DAS_PESSOAS}/${usuarioId}/desativacao` },
    { alvo: `${CAMINHO_DAS_PESSOAS}/${usuarioId}/reativacao` },
    { alvo: `${CAMINHO_DAS_PESSOAS}/${usuarioId}/senha-provisoria` },
  ] as const;
}

/**
 * As **duas grafias** do mesmo identificador — a que o banco devolve e a de caixa alta.
 *
 * A segunda existe porque as duas pontas do sistema concordam sobre a **identidade** e discordam
 * sobre a **grafia**: o Postgres renderiza `uuid` sempre em minúsculas e `uuid_in` parseia
 * hexadecimal sem distinguir caixa, enquanto `z.uuid()` na borda aceita qualquer caixa. Um alvo em
 * maiúsculas resolve a mesma pessoa e, antes da canonicalização de `ESQUEMA_DO_IDENTIFICADOR`,
 * escapava de toda comparação de identidade feita na aplicação.
 *
 * Escrita uma vez, e usada nas duas pernas do `CT-237` — a negativa (auto-alvo) e a positiva (outro
 * Admin): duas listas ficariam livres para divergir, e a positiva só prova o que promete se
 * exercitar **a mesma** grafia que a negativa recusa.
 */
function grafiasDoIdentificador(usuarioId: string) {
  return [
    { rotulo: 'como o banco devolve', valor: usuarioId },
    { rotulo: 'em MAIÚSCULAS', valor: usuarioId.toUpperCase() },
  ] as const;
}

// `contarSessoesDaPessoa` — **importada** de `./acessorios-de-borda.ts` desde 2026-09-02 (fecho do
// débito `D9 · F7/T4`). Ela era declarada aqui, byte a byte igual às de
// `./master-administradores.e2e.spec.ts` e `./ciclo-de-acesso.e2e.spec.ts` — três cópias, com o
// Limiar de Três já disparado. **É esta leitura que distingue "encerrada" de "marcada"** (CT-228), e
// é ela que carrega a metade do caso que separa "por pessoa" de "por empresa": a contagem da colega
// é lida no mesmo instante. Não a redeclare.

// ---------------------------------------------------------------------------------------------
// Arranjo do cenário, pelas rotas reais
// ---------------------------------------------------------------------------------------------

/** Uma empresa como a rota do Master a publica, no que os casos observam dela. */
interface EmpresaPublicada {
  readonly id: string;
}

/** O que a admissão de administrador devolve, no que os casos observam dela. */
interface AdministradorAdmitido {
  readonly usuarioId: string;
  readonly email: string;
  readonly senhaProvisoria: string;
}

/** O que a criação de pessoa devolve, no que os casos observam dela. */
interface PessoaCriada {
  readonly usuarioId: string;
  readonly email: string;
  readonly perfil: string;
  readonly senhaProvisoria: string;
}

/** Uma pessoa como a listagem a publica. */
interface PessoaPublicada {
  readonly usuarioId: string;
  readonly nome: string;
  readonly email: string;
  readonly perfil: string;
  readonly ativo: boolean;
}

/**
 * A página da listagem, no que os casos observam dela.
 *
 * Declarada aqui, e não importada do serviço: o conjunto de chaves do envelope é o que o `CT-233`
 * assere por igualdade, e derivá-lo do tipo do SUT faria a asserção concordar consigo mesma.
 */
interface PaginaDePessoasPublicada {
  readonly itens: readonly PessoaPublicada[];
  readonly total: number;
  readonly limite: number;
  readonly deslocamento: number;
}

/** A sessão do produto, no que os casos observam dela. */
interface SessaoPublicada {
  readonly telas: readonly string[];
  readonly acoes: readonly string[];
  readonly versaoPermissoes: number;
}

/** Uma pessoa da empresa já operando: identificador, endereço, senha corrente e sessão viva. */
interface PessoaEmOperacao {
  readonly usuarioId: string;
  readonly email: string;
  /** A senha que serve **agora** — a provisória, ou a trocada quando o caso cumpre a troca. */
  readonly senha: string;
  readonly cookie: string;
}

/** Endereço único por chamada — cada pessoa criada precisa de um que ninguém usou. */
function enderecoNovo(prefixo: string): string {
  return `${prefixo}.${randomUUID()}@exemplo.com.br`;
}

/** O nome da chave, sem o eixo — a forma que o corpo da requisição carrega. */
function nomeDaChave(chave: ChaveDoCatalogo): string {
  return chave.slice(chave.indexOf(':') + 1);
}

/** Quantas vezes um literal aparece na serialização crua de um corpo. */
function ocorrenciasNoTexto(texto: string, literal: string): number {
  return texto.split(literal).length - 1;
}

/** Cria uma empresa pela rota real do Master e devolve o corpo, ou levanta nomeando a recusa. */
async function admitirEmpresa(): Promise<EmpresaPublicada> {
  const criada = await pedir(CAMINHO_DAS_EMPRESAS, {
    metodo: 'POST',
    cookie: cookieDoMaster,
    corpo: { nome: 'Imobiliária da Administração Ltda', documento: randomUUID() },
  });

  if (criada.status !== 201) {
    throw new Error(`a criação de empresa respondeu ${String(criada.status)}: ${criada.texto}`);
  }

  return criada.corpo as EmpresaPublicada;
}

/** Admite um administrador pela rota real do Master, ou levanta nomeando a recusa. */
async function admitirAdministrador(
  empresaId: string,
  email: string,
): Promise<AdministradorAdmitido> {
  const admitido = await pedir(`${CAMINHO_DAS_EMPRESAS}/${empresaId}/admin`, {
    metodo: 'POST',
    cookie: cookieDoMaster,
    corpo: { nome: 'Administrador da Empresa', email },
  });

  if (admitido.status !== 201) {
    throw new Error(
      `a admissão de administrador respondeu ${String(admitido.status)}: ${admitido.texto}`,
    );
  }

  return admitido.corpo as AdministradorAdmitido;
}

/**
 * Cria uma pessoa pela rota real do Admin (`POST /v1/usuarios`), ou levanta nomeando a recusa.
 *
 * É o SUT desta task usado como arranjo dos casos seguintes — e é deliberado: a alternativa seria
 * escrever no banco por fora, que é justamente o que a T7 teve de fazer por a rota ainda não existir.
 */
async function criarPessoa(
  cookie: string,
  corpo: { nome: string; email: string; perfil: string },
): Promise<PessoaCriada> {
  const criada = await pedir(CAMINHO_DAS_PESSOAS, { metodo: 'POST', cookie, corpo });

  if (criada.status !== 201) {
    throw new Error(`a criação de pessoa respondeu ${String(criada.status)}: ${criada.texto}`);
  }

  return criada.corpo as PessoaCriada;
}

/**
 * Cria uma pessoa pela rota do Admin e devolve a sessão viva dela, **restrita**.
 *
 * Tudo pelas rotas reais: a pessoa nasce por `POST /v1/usuarios` e entra pela rota pública de
 * entrada, com a Senha provisória que a criação devolveu. Nenhum estado é forjado, e nada foi
 * acrescentado à produção para que este arranjo existisse.
 *
 * A sessão fica **restrita** (RN-09), e isso basta onde ele é usado: os casos que o chamam observam
 * a pessoa por `GET /v1/sessao` — a única rota que a sessão restrita alcança —, e quem age sobre ela
 * é sempre o Admin. Onde o cartão exige a pessoa com **senha trocada**, o helper é o irmão abaixo.
 */
async function pessoaOperando(cookieDoAdmin: string, prefixo: string): Promise<PessoaEmOperacao> {
  const criada = await criarPessoa(cookieDoAdmin, {
    nome: 'Pessoa Da Empresa',
    email: enderecoNovo(prefixo),
    perfil: 'USUARIO_EMPRESA',
  });

  const cookie = await entrar(criada.email, criada.senhaProvisoria);

  return {
    usuarioId: criada.usuarioId,
    email: criada.email,
    senha: criada.senhaProvisoria,
    cookie,
  };
}

/**
 * O mesmo, mais a **troca obrigatória** da Senha provisória — a sessão sai plena.
 *
 * Existe separado porque a troca custa uma chamada a `/change-password`, e o limitador de taxa
 * concede dez por minuto contra a mesma origem (ver o cabeçalho). Ele é usado apenas onde o cartão
 * exige a pré-condição literal *"com senha trocada"* — no `CT-228`, cujo eixo é a sessão de quem
 * opera de fato, e no `CT-230`, que ao final confere que a credencial da pessoa de B **continua
 * servindo** depois das cinco recusas.
 */
async function pessoaOperandoComSenhaTrocada(
  cookieDoAdmin: string,
  prefixo: string,
): Promise<PessoaEmOperacao> {
  const restrita = await pessoaOperando(cookieDoAdmin, prefixo);
  const cookie = await cumprirTrocaObrigatoria(restrita.cookie, restrita.senha);

  return { ...restrita, senha: SENHA_TROCADA, cookie };
}

/**
 * Afirma que a Senha provisória não aparece em consulta posterior alguma.
 *
 * Os três caminhos são os que o card do `CT-222` nomeia: a listagem de pessoas, a listagem de
 * empresas do Master e a leitura de sessão. A contagem é **zero ocorrências no texto cru**, e não
 * ausência de uma chave nomeada: um valor aninhado num campo que ninguém previu apareceria assim
 * mesmo.
 */
async function afirmarAusenciaNasConsultasPosteriores(
  senha: string,
  cookieDoAdmin: string,
): Promise<void> {
  const consultas = [
    {
      rotulo: 'GET /v1/usuarios',
      resposta: await pedir(CAMINHO_DAS_PESSOAS, { cookie: cookieDoAdmin }),
    },
    {
      rotulo: 'GET /v1/master/empresas',
      resposta: await pedir(CAMINHO_DAS_EMPRESAS, { cookie: cookieDoMaster }),
    },
    {
      rotulo: 'GET /v1/sessao',
      resposta: await pedir(CAMINHO_DA_SESSAO_CORRENTE, { cookie: cookieDoAdmin }),
    },
  ];

  for (const consulta of consultas) {
    expect(consulta.resposta.status, consulta.rotulo).toBe(200);
    expect(ocorrenciasNoTexto(consulta.resposta.texto, senha), consulta.rotulo).toBe(0);
    // E nenhuma **senha em texto**, sob esse nome, em corpo nenhum. A comparação é sobre a abertura
    // de um valor de cadeia (`"senhaProvisoria":"`) de propósito: `GET /v1/sessao` publica
    // legitimamente `senhaProvisoria` como BOOLEANO — é a marca que diz que a sessão está restrita
    // até a troca (RN-09) —, e proibir o nome inteiro reprovaria o contrato correto. O que não pode
    // existir numa consulta é o campo carregando **texto**.
    expect(consulta.resposta.texto, consulta.rotulo).not.toContain('"senhaProvisoria":"');
  }
}

/** A sessão do produto, pela rota real, ou levanta nomeando a recusa. */
async function lerSessao(cookie: string): Promise<SessaoPublicada> {
  const resposta = await pedir(CAMINHO_DA_SESSAO_CORRENTE, { cookie });

  if (resposta.status !== 200) {
    throw new Error(`a leitura de sessão respondeu ${String(resposta.status)}: ${resposta.texto}`);
  }

  return resposta.corpo as SessaoPublicada;
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
async function entrarCom(email: string, senha: string): Promise<Resposta> {
  return await pedir(ROTA_DE_ENTRADA, { metodo: 'POST', corpo: { email, password: senha } });
}

/** Entra e devolve o cookie de sessão, ou levanta nomeando a recusa. */
async function entrar(email: string, senha: string): Promise<string> {
  const entrada = await entrarCom(email, senha);

  if (entrada.status !== 200) {
    throw new Error(`a entrada de ${email} respondeu ${String(entrada.status)}: ${entrada.texto}`);
  }

  return credencialDeSessao(entrada);
}

/**
 * Cumpre a **troca obrigatória** da Senha provisória e devolve a sessão, agora plena.
 *
 * A troca é feita pela rota real do produto — a única, além da leitura da própria sessão, que a
 * sessão restrita alcança (RN-09). Sem ela, toda requisição seguinte receberia `403` da restrição de
 * sessão, e não da autorização.
 *
 * A resposta pode ou não reemitir a credencial de sessão, e as duas formas são aceitas: o que
 * importa é o cookie que passa a valer, e não por qual das duas ele chegou.
 */
async function cumprirTrocaObrigatoria(cookie: string, senhaAtual: string): Promise<string> {
  const troca = await pedir(ROTA_DE_TROCA_DE_SENHA, {
    metodo: 'POST',
    cookie,
    corpo: { senhaAtual, senhaNova: SENHA_TROCADA },
  });

  if (troca.status !== 200) {
    throw new Error(`a troca de senha respondeu ${String(troca.status)}: ${troca.texto}`);
  }

  return troca.cookies.some(ehCookieDeSessao) ? credencialDeSessao(troca) : cookie;
}

/** O cabeçalho `Set-Cookie` carrega a credencial de sessão do arcabouço. */
function ehCookieDeSessao(bruto: string): boolean {
  const par = bruto.split(';')[0] ?? '';
  return (par.split('=')[0] ?? '').trim().endsWith(SUFIXO_DO_COOKIE_DE_SESSAO);
}

/** O par `nome=valor` do cookie de sessão, no formato em que o cliente o reenvia. */
function credencialDeSessao(resposta: Resposta): string {
  const cookie = resposta.cookies.find(ehCookieDeSessao);

  if (cookie === undefined) {
    throw new Error('a resposta não devolveu cookie de sessão');
  }

  return cookie.split(';')[0] ?? '';
}
