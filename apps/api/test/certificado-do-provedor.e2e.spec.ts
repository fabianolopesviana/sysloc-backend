/**
 * As **três rotas do certificado do provedor** — T11 e T12 da fatia `fundacao-bancaria`: registrar
 * (ou renovar) a identidade com que a empresa se apresenta ao banco, consultar o que está valendo, e
 * **verificar** a identidade registrada contra o provedor.
 *
 * ---------------------------------------------------------------------------
 * INVARIANTES
 * ---------------------------------------------------------------------------
 *
 * | Critério | Caso | Invariante |
 * |---|---|---|
 * | CA-07 | CT-826 | A verificação aceita responde `200` com `aceito: true`, `verificadoEm` dentro
 * |       |        | da janela do ato e `detalhe` **não nulo** — e o par registra **um** aperto de
 * |       |        | mão apresentando o titular daquela empresa. As duas capturas da linha do
 * |       |        | certificado são **idênticas campo a campo**: nada é gravado. |
 * | CA-07 | CT-827 | A recusa **do provedor** é `200` com `aceito: false` e `detalhe` próprio —
 * |       |        | nunca `4xx`/`5xx` —, o par contabiliza o erro de cliente, e a linha do
 * |       |        | certificado permanece idêntica campo a campo. |
 * | CA-08 | CT-828 | A empresa sem certificado recebe `404` `RECURSO_NAO_ENCONTRADO` nomeando a
 * | RN-01 |        | ausência, **e o par registra ZERO conexões** — com uma segunda identidade
 * |       |        | disponível na outra empresa, e o contador provado por controle positivo no
 * |       |        | mesmo caso. Não existe caminho de reserva. |
 * | RN-06 | CT-826 (b) | Par mudo e endereço sem ouvinte degradam para `200` com `aceito: false` e
 * |       |        | textos **distintos entre si**, jamais para `500`; a trilha `info` carrega
 * |       |        | `empresaId`, `certificadoId`, `aceito` e `duracaoMs`, e a duração do ato contra
 * |       |        | o par mudo é a do teto, não zero. |
 * | —     | CT-826 (c) | Corpo não vazio é recusado com `422` `CAMPO_INVALIDO` **antes** de qualquer
 * |       |        | ligação com o provedor, e o corpo vazio na mesma rota continua respondendo
 * |       |        | `200` — o controle que separa "recusa o corpo" de "recusa tudo". |
 * | CA-03 | CT-824 | A consulta calcula, **pela rota real e ponta a ponta**, a faixa e os dias
 * | CA-04 |        | restantes da validade: `+45 → VIGENTE`, `+30 → VENCENDO` com **30** dias,
 * |       |        | `+1 → VENCENDO` com **1**, e um vigente cuja validade terminou ontem →
 * |       |        | `VENCIDO` com **−1**. Os dias são valor exato, nunca "está definido".
 * |       |        | ⚠️ A **fonte** do relógio NÃO é discriminada aqui — ver o bloco abaixo. |
 * | CA-04 | CT-825 | O limiar de 30 dias é **fechado do lado `VENCENDO`**: `+31 → VIGENTE` com
 * |       |        | **31** dias. Um deslize de um dia reprova este caso **sozinho**, sem tocar o
 * |       |        | CT-824 — é a razão de ele existir separado. |
 * | CA-05 | CT-824 (b) | Senha que não abre e material ilegível produzem `422` com o corpo
 * |       |        | **idêntico byte a byte**, e o que os separa vive **só** no registro interno:
 * |       |        | `motivo` `SENHA_NAO_ABRE` contra `MATERIAL_ILEGIVEL`. Nada do vigente muda. |
 * | CA-06 | CT-824 (c) | Material cuja validade já terminou é recusado **na entrada**, com `422`
 * |       |        | informando em `detalhes.validoAte` a data em que ela terminou, `motivo:
 * |       |        | JA_VENCIDO` no registro interno, e **nenhuma linha gravada**. |
 * | RN-01 | CT-824 (d) | A empresa que nunca registrou recebe `404` nomeando a ausência — não
 * |       |        | existe identidade de reserva, e a recusa não é genérica. |
 * | D3-b  | CT-824 (e) | Material acima do teto declarado é recusado pelo **esquema**, com o
 * |       |        | envelope da ADR-0017 nomeando `material` — e não pelo servidor HTTP. |
 *
 * Rastreabilidade: `CA-03 → CT-824 (RN-04)` · `CA-04 → CT-824, CT-825 (RN-04)` ·
 * `CA-05 → CT-824 (b) (RN-03)` · `CA-06 → CT-824 (c) (RN-03)` · `RN-01 → CT-824 (d)` ·
 * `CA-07 → CT-826, CT-827, CT-826 (b) (RN-06)` · `CA-08 → CT-828 (RN-01)`.
 *
 * ===========================================================================
 * O PAR DO PROVEDOR É REAL, e o que se substitui é o DESTINO (T12)
 * ===========================================================================
 *
 * Os casos de verificação sobem um **par TLS mútuo de verdade** em porta dinâmica do laço local, e a
 * aplicação recebe, por `overrideProvider(TOKEN_PORTA_DE_IDENTIDADE_BANCARIA)`, o **adaptador de
 * produção** apontado para ele. Não há dublê da lógica sob prova: o aperto de mão, o cliente por
 * chamada e o teto são os do artefato — o que muda é para onde ele liga. Ver o docblock de
 * {@link portaDoProvedor}.
 *
 * `criarAplicacao()` **não ganhou parâmetro**, nada em `apps/api/src` ganhou bandeira ou ramo
 * `if (ehTeste)`, e o provedor de produção (a fábrica de `integracoes-bancarias.module.ts`) continua
 * sendo o único caminho pelo qual a aplicação real escolhe adaptador — e ele é exercitado em **toda**
 * montagem de aplicação desta suíte, porque `ENDERECO_DO_PROVEDOR_BANCARIO` é declarado inerte em
 * `apps/api/vitest.config.ts` e a fábrica corre na resolução do provedor.
 *
 * ⚠️ **Nenhum caso toca o provedor real** (ADR-0006): o destino é sempre um par que este processo
 * abriu, e a porta **recusa** quando nenhum foi apontado — um destino ausente que degradasse em
 * silêncio faria um caso medir outra coisa sem dizer.
 *
 * ===========================================================================
 * DIVERGÊNCIA DECLARADA da §6.4 da task: o par mudo produz TEMPO ESGOTADO
 * ===========================================================================
 *
 * A §6.4 descreve um cenário só — *"o provedor não responde no prazo (par mudo em porta dinâmica)"* —
 * e espera *"`detalhe` de indisponibilidade"*. **Os dois não coincidem**, e a medição é a da T10: o
 * adaptador distingue, por decisão registrada, *"não alcancei a instituição"* (destino sem ouvinte) de
 * *"ela não concluiu no prazo"* (par mudo), e os dois textos são deliberadamente diferentes porque
 * pedem ações opostas do Admin. Asserir `DETALHE_INDISPONIVEL` contra um par mudo exigiria do produto
 * o **colapso** que a T10 recusou.
 *
 * O CT-826 (b), portanto, exercita **os dois** destinos: o par mudo, afirmando o texto do tempo
 * esgotado, e o endereço sem ouvinte, afirmando o da indisponibilidade. A cobertura do cenário é
 * preservada inteira — *"degrada para `200` com `aceito: false`, nunca `500`"* —, e ganha o eixo que a
 * redação do card não podia cumprir sozinha.
 *
 * ===========================================================================
 * ORDEM DAS ASSERÇÕES: o que discrimina um campo vem ANTES da igualdade que o fixa
 * ===========================================================================
 *
 * Vale para todo `detalhe` e para o `duracaoMs` da trilha. A razão é mecânica: o `toEqual` **aborta o
 * caso ao falhar**, de modo que uma distinção posta depois só executa quando a igualdade já provou o
 * valor do campo — e aí ela compara dois literais deste arquivo, sem participação alguma do SUT, sem
 * estado em que possa reprovar (**AP-29**). É a `DECISÃO FECHADA — T10 / Gate 1` de
 * `packages/cobranca-bancaria/test/adaptador-sicoob.spec.ts`, aplicada aqui pelo mesmo motivo. ⚠️ A
 * saída **não** é importar os textos do artefato: isso faria o caso aprovar qualquer texto.
 *
 * ===========================================================================
 * ⚠️ O QUE ESTE ARQUIVO NÃO MEDE: a FONTE do relógio. Ela é provada no CT-865
 * ===========================================================================
 *
 * A rodada 1 desta task escreveu, na linha do CT-824, que a consulta deriva o estado *"contra
 * `negocio.data_corrente_da_operacao()`, e não contra o relógio do processo"*. **A segunda metade
 * daquela frase era uma promessa que asserção nenhuma deste arquivo podia cumprir**, e o Gate 1 a
 * mediu: mantida a chamada a `lerVigenciaObservada` e derivado o par de datas de `new Date()`, os
 * **seis casos daqui ficam verdes** (`243/243 passed`).
 *
 * A razão é aritmética, e não descuido de asserção: as validades saem de `openssl -days N`, que é
 * relativo ao `Date` do **processo**. Como o eixo do teste e o eixo que o defeito instalaria são o
 * **mesmo relógio**, o delta se cancela — o que se mede aqui é a diferença entre dois relógios que
 * sempre concordam. Os Cons da **ADR-0026** registram esse modo de falha por escrito: *"nenhum caso
 * comportamental pega a violação enquanto o host estiver no mesmo fuso da função: a única rede é
 * asserção estática, e por isso ela exige prova de falsificação"*.
 *
 * A rede está instalada, e **não** aqui: `apps/api/test/vigencia-do-certificado.spec.ts` (`CT-865`)
 * afirma que o caminho de decisão desta borda não alcança relógio nem fuso do processo, e que os dois
 * argumentos da derivação saem do **mesmo** resultado de `lerVigenciaObservada` — com o mutante M4
 * reintroduzido em memória como falsificação permanente. O limiar, que era guardado só pelo par
 * CT-824/CT-825, ganhou lá um guardião **sem relógio nenhum** (`CT-864`).
 *
 * O que os seis casos daqui provam continua valendo inteiro: eles são a prova **comportamental** de
 * que a rota devolve a faixa e o número certos ponta a ponta, sobre banco real e HTTP real — e é a
 * única camada em que isso é observável. As duas redes se somam; nenhuma substitui a outra.
 *
 * ⚠️ **Consequência conhecida do eixo relativo, e ela NÃO se fecha com repetição**: emissão e consulta
 * acontecem em instantes diferentes, de modo que uma execução que atravesse a meia-noite do fuso da
 * operação faz `+30` sair `29` e reprova **sem defeito nenhum no SUT**. Ancorar as validades na data
 * do banco encurta a janela, mas não a fecha — o instante da consulta continua sendo outro —, e
 * exigiria emitir o material a partir de uma data absoluta, o que é do acessório
 * `packages/cobranca-bancaria/test/material-de-teste.ts`. Se isto reprovar, **não instale retry** (a
 * `.claude/rules/testing-stack.md` o proíbe nas duas frentes): confira o horário da execução contra a
 * virada do dia antes de tratar como achado.
 *
 * ===========================================================================
 * OS QUATRO CENÁRIOS DE ERRO SÃO SUFIXOS DO CT-824, e não IDs novos
 * ===========================================================================
 *
 * A §6.4 da task descreve os quatro sem lhes dar identificador, e a faixa `CT-826` a `CT-859` está
 * **reservada** pelos cards das tasks seguintes desta fatia — reusar um deles produziria duas coisas
 * diferentes com o mesmo identificador, que é o que a rastreabilidade existe para impedir. É a mesma
 * situação que a T7 resolveu saindo da faixa; aqui os quatro são companheiros negativos do mesmo
 * fluxo que o CT-824 exercita, e o sufixo é a forma que esta base já usa (`CT-639 (b)`,
 * `CT-213 (b)`, `CT-020 (d)`).
 *
 * ===========================================================================
 * O VENCIDO DO CT-824 é montado ENVELHECENDO a linha, e a razão precisa estar escrita
 * ===========================================================================
 *
 * `VENCIDO` é o único dos quatro estados que o **caminho de escrita recusa por construção**: a RN-03
 * proíbe registrar material cuja validade já terminou, e o CT-824 (c) logo abaixo é a prova disso. Em
 * produção o estado nasce da **passagem do tempo** — o certificado registrado hoje vence um ano
 * depois —, e não há rota que o produza.
 *
 * A precondição é montada, portanto, retroagindo `valido_ate` da linha vigente por instrução direta,
 * **sob o contexto de tenant** e sem `WHERE empresa_id` (quem recorta é a política, ADR-0008). Não é
 * atalho sobre o SUT: o que está sob prova neste caso é a **leitura** — a derivação do estado contra
 * a data corrente do banco —, e o registro que a precede acontece pela rota real, com material real,
 * como nos demais. Forjar o estado pela escrita seria o oposto: aí o caso mediria a si mesmo.
 *
 * ===========================================================================
 * MUTANTES EXECUTADOS sobre a borda (2026-08-15) — os três reprovaram
 * ===========================================================================
 *
 * As asserções deste arquivo são **comportamentais** — exercitam as rotas por HTTP real e observam o
 * desfecho —, e por isso não estão sob a exigência de prova de falsificação da
 * `.claude/rules/testing-stack.md`. As três medições abaixo foram feitas assim mesmo, pelo P4 do
 * Protocolo Antirregressão: as duas propriedades centrais desta task — o **limiar fechado do lado
 * `VENCENDO`** e a **indistinguibilidade das duas causas** — são invisíveis numa resposta lida
 * isoladamente, e uma asserção que não pudesse falhar por elas seria pior que ausente. Os mutantes
 * foram aplicados ao fonte de `apps/api/src/integracoes-bancarias/certificado.service.ts` e a suíte
 * foi invocada pelo **script do pacote** (`pnpm --filter @sysloc/api test`), nunca por `vitest run`
 * avulso.
 *
 *   * **controle** — árvore íntegra: `6 passed`;
 *   * **M1 · o limiar deixa de ser fechado** (`<=` trocado por `<` em `faixaDe`): `1 failed |
 *     5 passed`, **só no CT-824** — o `+30` passa a sair `VIGENTE`. O CT-825 fica verde, e é isso
 *     que prova que ele não é o caso que prende este lado;
 *   * **M2 · o limiar desliza um dia** (`LIMIAR_DE_VENCIMENTO_EM_DIAS + 1`): `1 failed | 5 passed`,
 *     **só no CT-825** — o `+31` passa a sair `VENCENDO`, e o CT-824 fica verde. É a medição que
 *     torna literal a frase do card: *"um deslize de um dia reprova este caso sozinho"*;
 *   * **M3 · a recusa volta a distinguir a causa** (`campo: erro instanceof ErroDeSenhaQueNaoAbre ?
 *     'senha' : 'corpo'`): `1 failed | 5 passed`, no CT-824 (b), pela comparação byte a byte dos dois
 *     textos — que é a asserção que existe exatamente para apanhar esta classe;
 *   * **reversão** — o fonte foi restaurado do backup, conferido idêntico por `diff -q`, e o controle
 *     voltou a `6 passed`.
 *
 * ===========================================================================
 * MUTANTES EXECUTADOS pela T12 (2026-08-15) — os três reprovaram, e cada um NOMEIA a garantia
 * ===========================================================================
 *
 * Mesma disciplina, agora sobre as três propriedades centrais da verificação — e a primeira é a que o
 * card do CT-828 exige por escrito. Os fontes mutados são
 * `apps/api/src/integracoes-bancarias/certificado.{service,controller}.ts`, e a suíte foi invocada
 * pelo **script do pacote** (`pnpm --filter @sysloc/api test`), nunca por `vitest run` avulso.
 *
 *   * **controle** — árvore íntegra: `272 passed`;
 *   * **M4 · o CAMINHO DE RESERVA volta a existir** — o serviço guarda em memória o último envelope
 *     lido e, quando a empresa do contexto não tem certificado, **tenta com ele** antes de desistir; o
 *     `404` continua saindo, byte a byte. `1 failed | 271 passed`, **só no CT-828**, e a reprovação é
 *     literalmente a segunda asserção: *"expected 1 to be +0"* em `par.conexoes`. ⚠️ **É a medição que
 *     torna verdadeira a frase do card**: a asserção do status ficou **verde** sob este mutante, de
 *     modo que sem a contagem de conexões o caminho de reserva passaria despercebido;
 *   * **M5 · a recusa do provedor tratada como falha do produto** (`aceito: false` traduzido em `422`):
 *     `2 failed | 270 passed`, no CT-827 e no CT-826 (b) — *"expected 422 to be 200"* —, com o CT-826
 *     verde. É o par que prende os dois lados: o desfecho positivo não distingue nada aqui;
 *   * **M6 · o carimbo movido por engano** (um `UPDATE ... SET criado_em = now()` dentro da transação
 *     de leitura, a forma que uma "anotação de última verificação" teria): `3 failed | 269 passed`, nos
 *     três casos que capturam a linha antes e depois. É o mutante que separa *"respondeu o desfecho
 *     certo"* de *"respondeu o desfecho certo e não gravou nada"*, e ele reprova pela comparação da
 *     linha **inteira** — um recorte por `id` o deixaria passar;
 *   * **reversão** — os dois fontes foram restaurados do backup e conferidos idênticos por `diff -q` e
 *     `sha256sum` (`3d2015b0…` no serviço, `5b717b7d…` no controlador), e o controle voltou a
 *     `272 passed`.
 *
 * ===========================================================================
 * UMA aplicação, com o JOURNAL observável
 * ===========================================================================
 *
 * A substituição é feita pelo **arcabouço de teste** (`overrideProvider` sobre o token que a
 * composição já publica), e não por um caminho aberto no código de produção: `criarAplicacao()` **não
 * ganhou parâmetro**, nada em `apps/api/src` ganhou bandeira ou ramo, e o registrador entregue é o
 * mesmo `criarLogger` da produção, com destino em memória. É o mesmo mecanismo, sobre o mesmo tipo de
 * token, que `contexto.e2e.spec.ts` e `saude.e2e.spec.ts` já usam.
 *
 * O nível é `warn` porque é nele que as recusas do registro são emitidas — o ambiente montado fixa
 * `LOG_LEVEL=fatal` de propósito, e baixá-lo no ambiente global calaria essa escolha para todos os
 * casos.
 *
 * ===========================================================================
 * De onde vêm o banco, a fila, a credencial e o MATERIAL (ADR-0006, invariante 3)
 * ===========================================================================
 *
 * De instâncias efêmeras próprias. Nenhuma coordenada de conexão é lida do ambiente: o ambiente do
 * processo é MONTADO a partir do que os helpers devolvem, e a porta é **reservada** porque o arcabouço
 * confere a origem das requisições com cookie contra o endereço base.
 *
 * O material PKCS#12 é **gerado em execução** por `packages/cobranca-bancaria/test/material-de-teste.ts`,
 * e nenhum `.pfx` entra na árvore versionada — o invariante 3 do projeto, e a razão está por extenso
 * no cabeçalho daquele acessório. Cada validade é declarada em **dias relativos**, de modo que a
 * suíte não passa a falhar num dia futuro por vencimento de fixture.
 */

import { randomBytes } from 'node:crypto';
import type { Server as ServidorSeguro } from 'node:https';
import { createServer as criarParSeguro } from 'node:https';
import type { Server as ServidorTcp } from 'node:net';
import { createServer as criarParTcp } from 'node:net';
import type { Duplex } from 'node:stream';
import { getCACertificates, setDefaultCACertificates } from 'node:tls';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import { criarAdaptadorSicoob, type PortaDeIdentidadeBancaria } from '@sysloc/cobranca-bancaria';
import { LIMIAR_DE_VENCIMENTO_EM_DIAS, MAIOR_MATERIAL_CODIFICADO } from '@sysloc/contracts';
import {
  type AcessoAoBanco,
  abrirAcessoAoBanco,
  contextoDeTenant,
  EMPRESA_A,
  EMPRESA_B,
  SENHA_DA_CARGA,
} from '@sysloc/db';
import { CodigoErro, criarLogger } from '@sysloc/shared';
import { afterAll, beforeAll, describe, expect, it, onTestFinished } from 'vitest';
// DÉBITO COM GATILHO — D28 · F0/T5 · gatilho JÁ DISPARADO (F1/T2, 2026-08-02)
// (NÃO é uma `DECISÃO FECHADA`: ele agenda uma mudança, não protege o código abaixo.)
// O QUÊ: os imports a seguir atravessam a fronteira de `@sysloc/auth`, `@sysloc/shared` e
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
  gerarParDeServidorDeTeste,
  type MaterialDeTeste,
  type SujeitoDeTeste,
} from '../../../packages/cobranca-bancaria/test/material-de-teste.ts';
import { reservarPorta } from '../../../packages/shared/test/efemero-comum.ts';
import { type FilaEfemera, redisEfemero } from '../../../packages/shared/test/redis-efemero.ts';
import { AppModule } from '../src/app.module.ts';
import { PREFIXO_DAS_ROTAS_DE_IDENTIDADE } from '../src/autenticacao/autenticacao.module.ts';
import { CAMINHO_DA_SESSAO } from '../src/autenticacao/sessao.controller.ts';
import {
  ENDERECO_DE_ESCUTA,
  PREFIXO_DE_VERSAO,
  TOKEN_LOGGER,
  TOKEN_PORTA_DE_IDENTIDADE_BANCARIA,
} from '../src/configuracao/ambiente.ts';
import {
  CAMINHO_DAS_INTEGRACOES_BANCARIAS,
  SEGMENTO_DA_CONSULTA,
  SEGMENTO_DA_VERIFICACAO,
  SEGMENTO_DO_REGISTRO,
} from '../src/integracoes-bancarias/certificado.controller.ts';

/** Limite da montagem: banco migrado, semente com credencial, fila, aplicação real e os materiais. */
const LIMITE_DE_MONTAGEM_MS = 240_000;

/** Limite de um caso que atravessa HTTP e banco várias vezes. */
const LIMITE_CASO_MS = 120_000;

/** Sufixo do nome do cookie de sessão do arcabouço — o prefixo vem da configuração. */
const SUFIXO_DO_COOKIE_DE_SESSAO = 'session_token';

/** A rota de entrada, composta a partir do prefixo real. Nunca escrita à mão. */
const ROTA_DE_ENTRADA = `${PREFIXO_DAS_ROTAS_DE_IDENTIDADE}/sign-in/email`;

/** Caminho, relativo à raiz, da rota de sessão do produto. Composto, nunca escrito à mão. */
const CAMINHO_DA_SESSAO_CORRENTE = `/${PREFIXO_DE_VERSAO}/${CAMINHO_DA_SESSAO}`;

/** Caminho, relativo à raiz, do **registro** — composto das constantes que o controlador publica. */
const ROTA_DO_REGISTRO = `/${PREFIXO_DE_VERSAO}/${CAMINHO_DAS_INTEGRACOES_BANCARIAS}/${SEGMENTO_DO_REGISTRO}`;

/** Caminho, relativo à raiz, da **consulta**. */
const ROTA_DA_CONSULTA = `/${PREFIXO_DE_VERSAO}/${CAMINHO_DAS_INTEGRACOES_BANCARIAS}/${SEGMENTO_DA_CONSULTA}`;

/** Caminho, relativo à raiz, da **verificação** — composto, nunca escrito à mão. */
const ROTA_DA_VERIFICACAO = `${ROTA_DA_CONSULTA}/${SEGMENTO_DA_VERIFICACAO}`;

/** O endereço do laço local — o par é sempre o próprio processo (ADR-0006). */
const LACO_LOCAL = '127.0.0.1';

/** O nome comum do par de teste; o nome alternativo do certificado cobre o laço local. */
const NOME_DO_PAR = 'par-de-teste.sysloc';

/**
 * O titular dos materiais dos casos de verificação — é ele que o par tem de ver no aperto de mão.
 *
 * Declarado aqui, e não deixado no padrão do acessório, porque é a **âncora antivácuo** do CT-826: sem
 * comparar o titular que o par recebeu, um adaptador que devolvesse `aceito: true` sem apresentar
 * certificado algum passaria verde.
 */
const TITULAR_DA_EMPRESA: SujeitoDeTeste = {
  pais: 'BR',
  organizacao: 'Locadora Modelo SA',
  nomeComum: '11222333000181',
};

/**
 * Os cinco textos de desfecho, **copiados** do adaptador — jamais importados.
 *
 * Importá-los faria o caso aprovar qualquer texto, inclusive um que colapsasse dois desfechos num só;
 * é o precedente da `DECISÃO FECHADA` do `CT-642` em
 * `packages/regua/test/coordenadas-do-transporte.spec.ts`, e a mesma escolha que
 * `packages/cobranca-bancaria/test/adaptador-sicoob.spec.ts` registra. Aqui eles importam por um
 * segundo motivo: o `detalhe` é o **único** campo em que o alcance da afirmação chega ao Admin, e é
 * ele que a borda publica sem reescrever.
 */
const DETALHE_ACEITE =
  'a instituição aceitou o certificado desta empresa ao estabelecer a conexão segura. ' +
  'Isto confirma a identidade da empresa perante ela; não confirma que a emissão de cobrança já ' +
  'está habilitada, o que depende das credenciais de habilitação';

const DETALHE_RECUSA_PELO_PAR =
  'a instituição não aceitou o certificado desta empresa ao estabelecer a conexão segura. ' +
  'Confira se o certificado é o que ela emitiu para esta empresa e se continua válido perante ela';

const DETALHE_INDISPONIVEL =
  'não foi possível alcançar a instituição no endereço configurado, e o certificado desta empresa ' +
  'não chegou a ser apresentado. Tente novamente em alguns minutos';

const DETALHE_TEMPO_ESGOTADO =
  'a instituição não concluiu a conferência do certificado dentro do tempo previsto, e por isso ' +
  'esta tentativa não confirma nem recusa a identidade da empresa. Tente novamente';

/**
 * O mínimo que o ato contra um par **mudo** precisa demorar para ser o teto governando, e não outra
 * coisa.
 *
 * O adaptador declara dez segundos; este piso é metade disso de propósito — ele separa *"esperou o
 * par"* de *"desistiu na hora e devolveu o texto certo por acaso"*, sem prender o caso ao número
 * exato, que é propriedade do adaptador e já tem guardião próprio no `CT-842`.
 */
const DURACAO_MINIMA_DO_TEMPO_ESGOTADO_MS = 5_000;

/** A entidade que a linha de trilha da verificação nomeia — literal, nunca importada do SUT. */
const ENTIDADE_DA_TRILHA = 'certificado_do_provedor';

/** A mensagem que o `422` do corpo não vazio publica — a canônica de toda recusa de campo. */
const MENSAGEM_DE_REQUISICAO_INVALIDA = 'requisição inválida';

/**
 * A área e a ação que a superfície exige — afirmadas no efetivo da sessão, nunca supostas.
 *
 * Literais, e **não** importadas do controlador: derivá-las do SUT faria a asserção concordar com
 * ele, e trocar a exigência declarada deixaria de reprovar caso algum.
 */
const AREA_DAS_INTEGRACOES_BANCARIAS = 'TELA:integracoes_bancarias';
const ACAO_DE_CONFIGURACAO = 'ACAO:configurar_integracao';

/**
 * A senha **real** dos cofres gerados — e a agulha das asserções de não-vazamento.
 *
 * Ela é a senha que de fato abre o material, e não uma cadeia inventada: derivar a agulha do dado que
 * de fato circulou é o que impede a variante oca (*"procurei uma cadeia que nunca entrou"*).
 */
const SENHA_DO_MATERIAL = 'senha-do-cofre-do-ct824';

/** A senha que **não** abre nenhum dos cofres — o gatilho de uma das duas causas indistinguíveis. */
const SENHA_QUE_NAO_ABRE = 'esta-senha-nao-abre-cofre-nenhum';

/**
 * As quatro validades relativas do CT-824 e do CT-825, em dias de calendário da operação.
 *
 * Declaradas ANTES dos casos e nomeando o resultado esperado de cada uma — elas **não** são derivadas
 * da execução. `+30` e `+31` são as duas bordas do limiar, e a distância entre elas é de um dia: é o
 * par que faz o deslize de um dia reprovar.
 */
const DIAS_VIGENTE_FOLGADO = 45;
const DIAS_NA_BORDA_VIGENTE = 31;
const DIAS_NA_BORDA_VENCENDO = 30;
const DIAS_VENCENDO_IMINENTE = 1;

/** Quantos dias no passado o vigente do CT-824 é envelhecido — ver o cabeçalho. */
const DIAS_DE_ATRASO_DO_VENCIDO = 1;

/** A validade do material do CT-824 (c): terminou **ontem**, no eixo da operação. */
const DIAS_DO_MATERIAL_VENCIDO = -1;

/**
 * A mensagem canônica do `422`, escrita por extenso.
 *
 * Literal, e **não** lida do SUT: os casos comparam corpos inteiros por igualdade, e derivá-la da
 * mesma fonte que o produz faria a asserção concordar consigo mesma.
 */
const MENSAGEM_DO_MATERIAL_RECUSADO =
  'o certificado não pôde ser lido com a senha apresentada — confira o arquivo e a senha';

/** A mensagem da recusa por validade encerrada — literal, pela mesma razão. */
const MENSAGEM_DO_CERTIFICADO_VENCIDO = 'a validade do certificado apresentado já terminou';

/** A mensagem do `404` da RN-01 — literal, pela mesma razão. */
const MENSAGEM_SEM_CERTIFICADO = 'esta empresa não tem certificado do provedor registrado';

/** O campo que as duas recusas do material nomeiam — o do corpo, nunca `material` nem `senha`. */
const CAMPO_DO_CORPO = 'corpo';

/** Os dois motivos internos que separam as causas indistinguíveis — literais, nunca importados. */
const MOTIVO_DA_SENHA = 'SENHA_NAO_ABRE';
const MOTIVO_DO_MATERIAL = 'MATERIAL_ILEGIVEL';
const MOTIVO_DO_VENCIDO = 'JA_VENCIDO';

/**
 * Quem age: a `ADMIN_EMPRESA` da carga, em cada empresa.
 *
 * A matriz do perfil `ADMIN_EMPRESA` é o catálogo inteiro (`packages/auth/src/matriz-de-perfil.ts`),
 * de modo que ela já tem a área **e** a ação exigidas — **nenhum ajuste individual é escrito**, e o
 * efetivo é AFIRMADO por `GET /v1/sessao` antes dos casos. Sem essa afirmação, um `403` no registro
 * seria indistinguível de um defeito dele. Quem mede a **recusa** de quem não alcança a área é a T14.
 */
const QUEM_ADMINISTRA = pessoaSemeada('admin.a@exemplo.com.br');

/**
 * A administradora da empresa B — usada **só** pelo caso do `404`.
 *
 * A empresa dela nunca registra certificado nenhum, e é isso que torna o caso independente de ordem:
 * medir a ausência na empresa A exigiria que ele corresse antes de todos os outros, e o `it` que
 * depende de posição mede outra coisa em silêncio quando alguém insere um caso antes dele.
 */
const QUEM_ADMINISTRA_EM_B = pessoaSemeada('admin.b@exemplo.com.br');

const VARIAVEIS_MONTADAS = [
  'NODE_ENV',
  'PORT',
  'LOG_LEVEL',
  'DATABASE_URL',
  'REDIS_URL',
  'BETTER_AUTH_SECRET',
] as const;

let identidade: IdentidadeEfemera;
let fila: FilaEfemera;
let acessoAoNegocio: AcessoAoBanco;
let aplicacao: NestFastifyApplication;
let base: string;
let ambienteAnterior: NodeJS.ProcessEnv;
let cookie: string;
let cookieDeB: string;
let linhasDoJournal: string[];

/**
 * Para onde a porta de identidade conecta **neste caso** — sempre um par do laço local (ADR-0006).
 *
 * Ela nasce indefinida, e a porta abaixo **recusa** quando ela continua assim: um destino ausente que
 * degradasse em silêncio faria um caso de verificação medir outra coisa sem dizer.
 */
let destinoDoProvedor: string | undefined;

/** Quantas vezes a porta de identidade foi invocada desde o início da execução. */
let invocacoesDaPorta = 0;

/**
 * A porta que a aplicação recebe no lugar da de produção — e ela **é o adaptador de produção**.
 *
 * ---------------------------------------------------------------------------
 * O que se substitui é o DESTINO, nunca a lógica sob prova
 * ---------------------------------------------------------------------------
 *
 * O que a composição faz em produção é construir {@link criarAdaptadorSicoob} a partir de
 * `ENDERECO_DO_PROVEDOR_BANCARIO`; o que este objeto faz é construir **o mesmo adaptador**, com o
 * endereço do par TLS que o caso corrente subiu. TLS mútuo real, cliente por chamada real, teto real:
 * nada da lógica que está sob prova é dublado — se fosse, o `aceito: true` deste arquivo não
 * significaria nada. É a mesma leitura registrada no docblock de `TOKEN_PORTA_DE_EMAIL`: o duplo
 * substitui o destino.
 *
 * Ele entra por `overrideProvider(TOKEN_PORTA_DE_IDENTIDADE_BANCARIA)`, pelo mecanismo do arcabouço de
 * teste, e **não** por caminho aberto no código de produção: `criarAplicacao()` não ganhou parâmetro,
 * nada em `apps/api/src` ganhou bandeira ou ramo `if (ehTeste)`, e o provedor de produção continua
 * sendo o único caminho pelo qual a aplicação real escolhe adaptador. As três alternativas estão
 * recusadas por escrito no cabeçalho de `packages/regua/src/adaptador-smtp.ts`.
 *
 * O adaptador é construído **por ato**, e não uma vez na montagem, porque o par de cada caso nasce
 * dentro do `it` — a autoridade descartável registra a limpeza dela em `onTestFinished`, que o
 * arcabouço só admite ali. Construir por ato é fiel ao artefato: a construção resolve o destino e não
 * abre soquete algum.
 *
 * A contagem de invocações existe para o CT-828, e é a asserção **irmã** da de conexões: ela pega o
 * caminho de reserva que tentasse a identidade e falhasse **antes** de abrir a ligação — desfecho em
 * que o par não registraria conexão nenhuma e a ausência pareceria a propriedade certa.
 */
const portaDoProvedor: PortaDeIdentidadeBancaria = {
  async verificarIdentidade(identidade) {
    invocacoesDaPorta += 1;

    if (destinoDoProvedor === undefined) {
      throw new Error('nenhum par de teste foi apontado para a porta de identidade neste caso');
    }

    return await criarAdaptadorSicoob({
      enderecoDoProvedor: destinoDoProvedor,
    }).verificarIdentidade(identidade);
  },
};

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

  linhasDoJournal = [];
  // O nível é `info`, e não o `warn` da T11: as recusas do registro continuam sendo emitidas em
  // `warn` e seguem observáveis, e a linha de trilha da **verificação** — a que a §6.4 exige com
  // `empresaId`, `certificadoId`, `aceito` e `duracaoMs` — é `info`, como toda trilha de ato desta
  // base. Baixar o degrau **acrescenta** o que se captura e não tira nada: os filtros dos casos da
  // T11 leem o campo `motivo` do evento estruturado, que nenhuma linha de `info` carrega.
  const registrador = criarLogger({
    nivel: 'info',
    destino: {
      write(linha: string): void {
        linhasDoJournal.push(linha);
      },
    },
  });

  const modulo = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(TOKEN_LOGGER)
    .useValue(registrador)
    // A porta de identidade entra pelo arcabouço de teste, e o que ela substitui é o **destino** —
    // ver o docblock de {@link portaDoProvedor}.
    .overrideProvider(TOKEN_PORTA_DE_IDENTIDADE_BANCARIA)
    .useValue(portaDoProvedor)
    .compile();

  aplicacao = modulo.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
  // Sem as exclusões da aplicação real, de propósito: nenhum caso deste arquivo toca as rotas de
  // saúde nem o contrato publicado, e reproduzir a lista aqui criaria uma segunda cópia dela livre
  // para divergir. O que importa é que `/v1/auth` e as duas rotas da área atendam sob o prefixo.
  aplicacao.setGlobalPrefix(PREFIXO_DE_VERSAO);
  await aplicacao.listen({ port: porta, host: ENDERECO_DE_ESCUTA });

  cookie = await entrar(QUEM_ADMINISTRA.email, SENHA_DA_CARGA);
  cookieDeB = await entrar(QUEM_ADMINISTRA_EM_B.email, SENHA_DA_CARGA);

  // Precondição AFIRMADA, e não suposta, nas DUAS sessões: sem estas linhas, um `403` nas rotas do
  // certificado seria indistinguível de um defeito delas.
  for (const credencial of [cookie, cookieDeB]) {
    const sessao = (await pedir(CAMINHO_DA_SESSAO_CORRENTE, { cookie: credencial }))
      .corpo as SessaoPublicada;

    expect(sessao.telas).toContain(AREA_DAS_INTEGRACOES_BANCARIAS);
    expect(sessao.acoes).toContain(ACAO_DE_CONFIGURACAO);
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

describe('o certificado do provedor por empresa (T11)', () => {
  it(
    'CT-824 — estado e dias restantes saem da data corrente do BANCO, e o registro publica o que se leu do material',
    async () => {
      // A autoridade descartável DESTE caso — ver `gerarMaterial`. Ela leva embora, no fim do
      // caso, a raiz temporária e todos os materiais que emitiu.
      const autoridade = await gerarAutoridadeDeTeste('ct824');

      // -------------------------------------------------------------------------------------
      // Passo 1 — `+45` dias: VIGENTE, com os dias exatos
      // -------------------------------------------------------------------------------------
      //
      // O registro devolve `201`, e não `200`: cada registro cria um recurso novo — renovar é
      // substituir por inserção, nunca emendar a linha anterior.
      const folgado = await gerarMaterial(autoridade, DIAS_VIGENTE_FOLGADO);
      const registro = await registrarMaterial(folgado);

      expect(registro.status).toBe(201);

      // A projeção sai das COLUNAS e do que se leu do material — nunca do que chegou no corpo. Os
      // quatro campos do material são conferidos contra o que o `openssl` declarou, por caminho
      // independente do SUT.
      const publicado = registro.corpo as CertificadoPublicado;

      expect(publicado.titular).toBe(folgado.titular);
      expect(publicado.impressaoDigital).toBe(folgado.impressaoDigital);
      expect(publicado.validoAte).toBe(folgado.validoAte.toISOString());
      expect(publicado.registradoPor.id).toBe(QUEM_ADMINISTRA.id);

      // ⚠️ O que NÃO sai: nem o material, nem a senha, em campo nenhum e em profundidade nenhuma.
      // A varredura é sobre o texto cru da resposta, e não sobre as chaves — um campo novo que os
      // carregasse aninhados escaparia de uma conferência por chave.
      expect(registro.texto).not.toContain(SENHA_DO_MATERIAL);
      expect(registro.texto).not.toContain(folgado.material.toString('base64'));

      // A consulta deriva o estado no ato da leitura, contra a data corrente do banco.
      expect(await consultarVigencia(cookie)).toEqual({
        estado: 'VIGENTE',
        diasParaVencer: DIAS_VIGENTE_FOLGADO,
      });

      // -------------------------------------------------------------------------------------
      // Passo 2 — `+30` dias: a borda FECHADA do lado `VENCENDO`, com os dias exatos
      // -------------------------------------------------------------------------------------
      //
      // Renovar substitui: o vigente passa a ser este, e a consulta seguinte fala dele.
      expect(
        (await registrarMaterial(await gerarMaterial(autoridade, DIAS_NA_BORDA_VENCENDO))).status,
      ).toBe(201);

      expect(await consultarVigencia(cookie)).toEqual({
        estado: 'VENCENDO',
        diasParaVencer: DIAS_NA_BORDA_VENCENDO,
      });

      // -------------------------------------------------------------------------------------
      // Passo 3 — `+1` dia: ainda VENCENDO, e o número é **1**
      // -------------------------------------------------------------------------------------
      //
      // O valor EXATO, e não "está definido": um `diasParaVencer` que devolvesse zero, ou o total de
      // dias da validade, passaria por qualquer asserção de presença.
      expect(
        (await registrarMaterial(await gerarMaterial(autoridade, DIAS_VENCENDO_IMINENTE))).status,
      ).toBe(201);

      expect(await consultarVigencia(cookie)).toEqual({
        estado: 'VENCENDO',
        diasParaVencer: DIAS_VENCENDO_IMINENTE,
      });

      // -------------------------------------------------------------------------------------
      // Passo 4 — o vigente cuja validade terminou ONTEM: VENCIDO, com **−1**
      // -------------------------------------------------------------------------------------
      //
      // A precondição é montada envelhecendo a linha, e a razão está no cabeçalho: este é o único
      // estado que a escrita recusa por construção (RN-03 — ver o CT-824 (c)) e que em produção nasce
      // da passagem do tempo. O que está sob prova aqui é a LEITURA.
      await envelhecerOVigente(EMPRESA_A.id);

      expect(await consultarVigencia(cookie)).toEqual({
        estado: 'VENCIDO',
        diasParaVencer: -DIAS_DE_ATRASO_DO_VENCIDO,
      });

      // E o vencido **continua sendo o vigente**: `200`, e não `404`. Esconder o certificado vencido
      // tiraria da empresa justamente o aviso de que ela precisa renovar.
      const aindaVigente = await pedir(ROTA_DA_CONSULTA, { cookie });

      expect(aindaVigente.status).toBe(200);
    },
    LIMITE_CASO_MS,
  );

  it(
    'CT-825 — o limiar é fechado do lado VENCENDO: +31 dias ainda é VIGENTE, com 31 dias',
    async () => {
      // A autoridade descartável DESTE caso — ver `gerarMaterial`. Ela leva embora, no fim do
      // caso, a raiz temporária e todos os materiais que emitiu.
      const autoridade = await gerarAutoridadeDeTeste('ct825');

      // O companheiro de fronteira do CT-824, e ele reprova **sozinho** um deslize de um dia: com
      // `<` no lugar de `<=`, o `+30` do CT-824 viraria `VIGENTE` e este continuaria verde; com o
      // limiar em 31, este vira `VENCENDO` e o CT-824 continua verde. É o par que prende os dois
      // lados.
      expect(
        (await registrarMaterial(await gerarMaterial(autoridade, DIAS_NA_BORDA_VIGENTE))).status,
      ).toBe(201);

      expect(await consultarVigencia(cookie)).toEqual({
        estado: 'VIGENTE',
        diasParaVencer: DIAS_NA_BORDA_VIGENTE,
      });

      // A âncora que liga o caso ao contrato: a borda testada é exatamente o limiar publicado, e não
      // um número que este arquivo escolheu. Sem ela, mudar o limiar no contrato deixaria este caso
      // medindo uma fronteira que não existe mais.
      expect(DIAS_NA_BORDA_VIGENTE).toBe(LIMIAR_DE_VENCIMENTO_EM_DIAS + 1);
    },
    LIMITE_CASO_MS,
  );

  it(
    'CT-824 (b) — senha que não abre e material ilegível respondem o MESMO corpo, e só o journal os separa',
    async () => {
      // A autoridade descartável DESTE caso — ver `gerarMaterial`. Ela leva embora, no fim do
      // caso, a raiz temporária e todos os materiais que emitiu.
      const autoridade = await gerarAutoridadeDeTeste('ct824b');

      // A precondição: existe um vigente, e ele não pode mudar por causa de uma recusa.
      expect(
        (await registrarMaterial(await gerarMaterial(autoridade, DIAS_VIGENTE_FOLGADO))).status,
      ).toBe(201);

      const antes = await pedir(ROTA_DA_CONSULTA, { cookie });
      const linhasAntes = await contarCertificados(EMPRESA_A.id);
      const desdeAqui = linhasDoJournal.length;

      // Causa 1 — o material é bom, a senha não abre.
      const bom = await gerarMaterial(autoridade, DIAS_VIGENTE_FOLGADO);
      const comSenhaErrada = await pedir(ROTA_DO_REGISTRO, {
        metodo: 'POST',
        cookie,
        corpo: { material: bom.material.toString('base64'), senha: SENHA_QUE_NAO_ABRE },
      });

      // Causa 2 — a senha é a de sempre, os bytes não são um PKCS#12.
      const comMaterialRuim = await pedir(ROTA_DO_REGISTRO, {
        metodo: 'POST',
        cookie,
        corpo: { material: randomBytes(512).toString('base64'), senha: SENHA_DO_MATERIAL },
      });

      expect(comSenhaErrada.status).toBe(422);
      expect(comMaterialRuim.status).toBe(422);

      // ⚠️ A ASSERÇÃO QUE DISCRIMINA VEM ANTES DA IGUALDADE, e a ordem é conteúdo: os dois motivos
      // internos precisam ser DIFERENTES, senão as duas requisições podem ter caído no mesmo caminho
      // e a igualdade dos corpos seria verdadeira por trivialidade. Posta depois do `toEqual`, ela
      // nunca poderia reprovar — o caso abortaria antes.
      const motivos = motivosDesde(desdeAqui);

      expect(motivos).toEqual([MOTIVO_DA_SENHA, MOTIVO_DO_MATERIAL]);

      // E agora a indistinguibilidade, comparada sobre o TEXTO CRU da resposta — byte a byte, e não
      // campo a campo: um `detalhes` a mais numa delas escaparia de uma comparação por campo.
      expect(comSenhaErrada.texto).toBe(comMaterialRuim.texto);

      // O corpo é o envelope INTEIRO da ADR-0017, escrito à mão. Um `campo: 'senha'` numa delas — a
      // forma mais provável de a distinção voltar — reprova aqui e na linha acima.
      expect(comSenhaErrada.corpo).toEqual({
        codigo: CodigoErro.CAMPO_INVALIDO,
        mensagem: MENSAGEM_DO_MATERIAL_RECUSADO,
        campo: CAMPO_DO_CORPO,
      });

      // Nada do vigente mudou: recusa nunca é escrita parcial.
      const depois = await pedir(ROTA_DA_CONSULTA, { cookie });

      expect(depois.corpo).toEqual(antes.corpo);
      // As contagens CRUAS são o que separa "respondeu 422" de "respondeu 422 e não gravou": a
      // primeira pega a linha que teria nascido, e a segunda pega a **anulação** do vigente anterior
      // — o meio-caminho da substituição, que deixaria a empresa sem identidade e que resposta
      // nenhuma denunciaria.
      expect(await contarCertificados(EMPRESA_A.id)).toBe(linhasAntes);
      expect(await contarVigentes(EMPRESA_A.id)).toBe(1);
    },
    LIMITE_CASO_MS,
  );

  it(
    'CT-824 (c) — material com validade encerrada é recusado na ENTRADA, informando a data em que ela terminou',
    async () => {
      // A autoridade descartável DESTE caso — ver `gerarMaterial`. Ela leva embora, no fim do
      // caso, a raiz temporária e todos os materiais que emitiu.
      const autoridade = await gerarAutoridadeDeTeste('ct824c');

      const antesDaContagem = await contarCertificados(EMPRESA_A.id);
      const desdeAqui = linhasDoJournal.length;
      const vencido = await gerarMaterial(autoridade, DIAS_DO_MATERIAL_VENCIDO);

      const recusa = await registrarMaterial(vencido);

      expect(recusa.status).toBe(422);

      // A recusa é DISTINTA da do material ilegível — aqui o arquivo abriu, o titular é legível, e o
      // produto sabe exatamente o que está errado. Dizer "confira o arquivo e a senha" mandaria o
      // Admin procurar defeito onde não há.
      expect(recusa.corpo).toEqual({
        codigo: CodigoErro.CAMPO_INVALIDO,
        mensagem: MENSAGEM_DO_CERTIFICADO_VENCIDO,
        campo: CAMPO_DO_CORPO,
        // A DATA EXATA em que a validade terminou, que é o que a CA-06 manda informar: sem ela, o
        // Admin não distingue "o arquivo é o errado" de "o arquivo é o certo e está velho".
        detalhes: { validoAte: vencido.validoAte.toISOString() },
      });

      // O motivo interno é o terceiro do vocabulário, e é ele que o operador filtra no journal.
      expect(motivosDesde(desdeAqui)).toEqual([MOTIVO_DO_VENCIDO]);

      // E **nenhuma linha gravada**: a contagem crua é o que separa "respondeu 422" de "respondeu
      // 422 e não gravou".
      expect(await contarCertificados(EMPRESA_A.id)).toBe(antesDaContagem);
    },
    LIMITE_CASO_MS,
  );

  it(
    'CT-824 (d) — a empresa que nunca registrou recebe 404 nomeando a ausência, e não um erro genérico',
    async () => {
      // A autoridade descartável DESTE caso — ver `gerarMaterial`. Ela leva embora, no fim do
      // caso, a raiz temporária e todos os materiais que emitiu.
      const autoridade = await gerarAutoridadeDeTeste('ct824d');

      // A empresa B nunca registra nada neste arquivo — é o que torna o caso independente de ordem.
      expect(await contarCertificados(EMPRESA_B.id)).toBe(0);

      const ausencia = await pedir(ROTA_DA_CONSULTA, { cookie: cookieDeB });

      expect(ausencia.status).toBe(404);
      // O corpo INTEIRO, e não a presença de campos: a mensagem nomeia a empresa e a ausência,
      // porque não existe identidade de reserva e um corpo genérico faria o Admin procurar defeito
      // onde há configuração pendente.
      expect(ausencia.corpo).toEqual({
        codigo: CodigoErro.RECURSO_NAO_ENCONTRADO,
        mensagem: MENSAGEM_SEM_CERTIFICADO,
      });

      // O CONTROLE POSITIVO, na mesma rota e com a outra sessão: sem ele, o caso ficaria verde sobre
      // uma consulta que respondesse `404` para todo mundo.
      expect(
        (await registrarMaterial(await gerarMaterial(autoridade, DIAS_VIGENTE_FOLGADO))).status,
      ).toBe(201);
      expect((await pedir(ROTA_DA_CONSULTA, { cookie })).status).toBe(200);
      // E a leitura de B continua `404` depois de A ter registrado: nenhuma rota recebe empresa, e o
      // que separa as duas sessões é o cookie.
      expect((await pedir(ROTA_DA_CONSULTA, { cookie: cookieDeB })).status).toBe(404);
    },
    LIMITE_CASO_MS,
  );

  it(
    'CT-824 (e) — material acima do teto declarado é recusado pelo ESQUEMA, com o envelope da ADR-0017',
    async () => {
      // Nenhuma autoridade é gerada neste caso, e a ausência é deliberada: o que se envia é um
      // material que o esquema recusa **antes** de qualquer leitura, e fabricar um cofre legítimo
      // para depois substituí-lo por um texto excedente daria a impressão de que o teto é conferido
      // sobre bytes de PKCS#12 — ele é conferido sobre o TEXTO codificado, que é o que chega.
      const antesDaContagem = await contarCertificados(EMPRESA_A.id);
      // Um caractere acima do teto: a borda exata, e não "muito maior" — um excesso folgado
      // passaria mesmo num esquema com o teto errado por uma posição.
      const excedente = 'A'.repeat(MAIOR_MATERIAL_CODIFICADO + 1);

      const recusa = await pedir(ROTA_DO_REGISTRO, {
        metodo: 'POST',
        cookie,
        corpo: { material: excedente, senha: SENHA_DO_MATERIAL },
      });

      expect(recusa.status).toBe(422);
      // O envelope da ADR-0017 nomeando o CAMPO — e não um `413` do servidor HTTP, nem um corpo de
      // erro do arcabouço. É isso que separa "o esquema recusou" de "o transporte recusou".
      expect(recusa.corpo).toEqual({
        codigo: CodigoErro.CAMPO_INVALIDO,
        mensagem: 'requisição inválida',
        campo: 'material',
      });
      // E o valor recusado não volta na resposta: entrada não confiável nunca é ecoada.
      expect(recusa.texto).not.toContain(excedente);

      expect(await contarCertificados(EMPRESA_A.id)).toBe(antesDaContagem);
    },
    LIMITE_CASO_MS,
  );
});

describe('a verificação da identidade contra o provedor (T12)', () => {
  it(
    'CT-826 — verificação aceita: 200 com aceito, e a linha do certificado não muda',
    async () => {
      const autoridade = await gerarAutoridadeDeTeste('ct826');
      // O cliente confere o certificado **do par** contra as raízes do processo, como deve; sem esta
      // instalação todo caso reprovaria por o par de teste ser desconhecido. A alternativa — pedir ao
      // adaptador uma âncora de confiança configurável — é seam de produção criado para teste, e a
      // lei do seam a proíbe. Baixar `rejectUnauthorized` no adaptador seria pior: tornaria o
      // `aceito: true` uma afirmação falsa.
      confiarEm(autoridade);

      const par = await subirParDoProvedor(autoridade, autoridade);
      apontarProvedorPara(enderecoDoPar(par.porta));

      expect((await registrarMaterial(await materialDaEmpresa(autoridade))).status).toBe(201);

      // A linha INTEIRA, todas as colunas — comparar só o `id` deixaria passar o carimbo movido por
      // engano, que é exatamente o defeito que "nada é gravado" existe para excluir.
      const antes = await capturarCertificados(EMPRESA_A.id);
      const desdeAqui = linhasDoJournal.length;
      const certificadoId = (await consultarCertificado(cookie)).id;

      const comecou = Date.now();
      const resposta = await verificarIdentidade(cookie);
      const terminou = Date.now();

      expect(resposta.status).toBe(200);

      const publicado = resposta.corpo as ResultadoPublicado;

      // ⚠️ **A ORDEM É CONTEÚDO**: `detalhe` é campo da igualdade abaixo, e o `toEqual` aborta o caso
      // ao falhar — posta depois, esta distinção só executaria quando a igualdade já tivesse provado
      // o valor, e compararia dois literais deste arquivo sem participação do SUT (AP-29). Aqui ela
      // reprova **nomeando** os textos colapsados. O `detalhe` não é nulo no desfecho positivo por
      // decisão: nulo prometeria "está tudo pronto para cobrar", que é mais do que foi medido.
      expect(publicado.detalhe).not.toBeNull();
      expect(publicado.detalhe).not.toBe(DETALHE_RECUSA_PELO_PAR);
      expect(publicado.detalhe).not.toBe(DETALHE_INDISPONIVEL);
      expect(publicado.detalhe).not.toBe(DETALHE_TEMPO_ESGOTADO);

      expect(publicado).toEqual({
        aceito: true,
        verificadoEm: publicado.verificadoEm,
        detalhe: DETALHE_ACEITE,
      });

      // O carimbo é instante válido DENTRO da janela do ato — sem isto, `verificadoEm` acima seria
      // comparado consigo mesmo e qualquer cadeia serviria.
      const carimbo = Date.parse(publicado.verificadoEm);

      expect(Number.isNaN(carimbo)).toBe(false);
      expect(carimbo).toBeGreaterThanOrEqual(comecou);
      expect(carimbo).toBeLessThanOrEqual(terminou);

      // A ÂNCORA ANTIVÁCUO do aceite: o par contabilizou **um** aperto de mão, apresentando o titular
      // daquela empresa. Sem ela, um caminho que devolvesse `aceito: true` sem apresentar
      // certificado algum passaria verde.
      expect(par.handshakes).toBe(1);
      expect(par.titularesApresentados).toEqual([TITULAR_DA_EMPRESA.nomeComum]);
      expect(par.errosDeCliente).toBe(0);

      // A3 — **nada foi gravado**: a linha permanece idêntica campo a campo.
      expect(await capturarCertificados(EMPRESA_A.id)).toEqual(antes);

      // A linha de trilha do ato (§13.1), com os quatro campos que a §6.4 nomeia.
      const trilha = trilhasDaVerificacaoDesde(desdeAqui);

      expect(trilha.length).toBe(1);
      expect(trilha[0]?.duracaoMs).toBeGreaterThanOrEqual(0);
      expect(trilha[0]).toEqual({
        empresaId: EMPRESA_A.id,
        entidade: ENTIDADE_DA_TRILHA,
        certificadoId,
        aceito: true,
        duracaoMs: trilha[0]?.duracaoMs,
      });
    },
    LIMITE_CASO_MS,
  );

  it(
    'CT-827 — verificação recusada pelo provedor: 200 com aceito falso, e a linha não muda',
    async () => {
      const acDoPar = await gerarAutoridadeDeTeste('ct827-par');
      const acAlheia = await gerarAutoridadeDeTeste('ct827-alheia');
      confiarEm(acDoPar);

      // A recusa nasce da **decisão do par**: o material é íntegro e abre com a senha, e o que o par
      // não reconhece é a autoridade que o emitiu. Bytes truncados provariam outra coisa — a recusa
      // do registro, que é o CT-824 (b).
      const par = await subirParDoProvedor(acDoPar, acDoPar);
      apontarProvedorPara(enderecoDoPar(par.porta));

      expect((await registrarMaterial(await materialDaEmpresa(acAlheia))).status).toBe(201);

      const antes = await capturarCertificados(EMPRESA_A.id);
      const desdeAqui = linhasDoJournal.length;
      const certificadoId = (await consultarCertificado(cookie)).id;

      const resposta = await verificarIdentidade(cookie);

      // O `200` é o DISCRIMINADOR deste caso: um `4xx` ou `5xx` aqui significaria que a implementação
      // tratou a recusa do provedor como falha do produto, e o Admin leria "o sistema quebrou" onde o
      // fato é "a identidade não serve" (RN-06).
      expect(resposta.status).toBe(200);

      const publicado = resposta.corpo as ResultadoPublicado;

      // ⚠️ **ANTES da igualdade**, pela razão escrita no CT-826.
      expect(publicado.detalhe).not.toBeNull();
      expect(publicado.detalhe).not.toBe(DETALHE_ACEITE);
      expect(publicado.detalhe).not.toBe(DETALHE_INDISPONIVEL);
      expect(publicado.detalhe).not.toBe(DETALHE_TEMPO_ESGOTADO);

      expect(publicado).toEqual({
        aceito: false,
        verificadoEm: publicado.verificadoEm,
        detalhe: DETALHE_RECUSA_PELO_PAR,
      });

      // A ÂNCORA ANTIVÁCUO da recusa: o par de fato viu a conexão morrer no aperto de mão. Sem ela,
      // um caminho que nem tentasse conectar produziria a mesma resposta.
      expect(par.errosDeCliente).toBe(1);
      expect(par.handshakes).toBe(0);

      // A3 — **nada foi gravado**, nem mesmo o registro de que a identidade foi recusada.
      expect(await capturarCertificados(EMPRESA_A.id)).toEqual(antes);

      const trilha = trilhasDaVerificacaoDesde(desdeAqui);

      expect(trilha.length).toBe(1);
      expect(trilha[0]).toEqual({
        empresaId: EMPRESA_A.id,
        entidade: ENTIDADE_DA_TRILHA,
        certificadoId,
        aceito: false,
        duracaoMs: trilha[0]?.duracaoMs,
      });
    },
    LIMITE_CASO_MS,
  );

  it(
    'CT-828 — sem certificado: 404 nomeando a ausência, e ZERO conexões ao provedor',
    async () => {
      const autoridade = await gerarAutoridadeDeTeste('ct828');
      confiarEm(autoridade);

      const par = await subirParDoProvedor(autoridade, autoridade);
      apontarProvedorPara(enderecoDoPar(par.porta));

      // A empresa **A** tem certificado vigente de propósito: ela é a segunda identidade disponível,
      // e sem ela "não usou a de outra empresa" seria vacuamente verdadeiro.
      expect((await registrarMaterial(await materialDaEmpresa(autoridade))).status).toBe(201);

      // O CONTROLE POSITIVO dos dois contadores, no mesmo par e no mesmo caso: com certificado, o ato
      // abre **uma** conexão e invoca a porta **uma** vez. Sem isto, os zeros abaixo seriam
      // compatíveis com um contador que não conta nada.
      const invocacoesAntesDoControle = invocacoesDaPorta;

      expect((await verificarIdentidade(cookie)).status).toBe(200);
      expect(par.conexoes).toBe(1);
      expect(invocacoesDaPorta - invocacoesAntesDoControle).toBe(1);

      par.zerar();

      const invocacoesAntes = invocacoesDaPorta;
      // A empresa B nunca registra nada neste arquivo — é o que torna o caso independente de ordem.
      const linhasDeB = await capturarCertificados(EMPRESA_B.id);

      expect(linhasDeB).toEqual([]);

      const ausencia = await verificarIdentidade(cookieDeB);

      expect(ausencia.status).toBe(404);

      // ⚠️ **A SEGUNDA ASSERÇÃO — é ela que prova o fim do caminho de reserva (RN-01).** Sem ela o
      // caso provaria apenas a mensagem, e uma implementação que tentasse a identidade da empresa A
      // antes de desistir passaria verde: o `404` sairia igual, byte a byte. Ela vem **antes** da
      // igualdade do corpo de propósito — a propriedade central deste caso é a ausência de tentativa,
      // e a reprovação tem de nomeá-la em vez de morrer numa comparação de envelope.
      expect(par.conexoes).toBe(0);
      // A irmã dela: a porta não foi sequer invocada. Ela pega o caminho de reserva que tentasse com
      // material que não abre — desfecho em que nenhuma ligação chega a existir e o contador acima
      // continuaria zerado.
      expect(invocacoesDaPorta - invocacoesAntes).toBe(0);

      // O corpo INTEIRO, e não a presença de campos: a mensagem nomeia a empresa e a ausência, e é a
      // MESMA da consulta — o fato é o mesmo, e um texto próprio aqui diria ao Admin que há duas
      // ausências diferentes.
      expect(ausencia.corpo).toEqual({
        codigo: CodigoErro.RECURSO_NAO_ENCONTRADO,
        mensagem: MENSAGEM_SEM_CERTIFICADO,
      });

      // E a empresa A continua verificando depois disso: a recusa de B não é um serviço quebrado.
      expect((await verificarIdentidade(cookie)).status).toBe(200);
      expect(par.conexoes).toBe(1);
    },
    LIMITE_CASO_MS,
  );

  it(
    'CT-826 (b) — provedor mudo e provedor inalcançável degradam para 200, nunca para 500',
    async () => {
      const autoridade = await gerarAutoridadeDeTeste('ct826b');
      confiarEm(autoridade);

      const par = await subirParDoProvedor(autoridade, autoridade);
      apontarProvedorPara(enderecoDoPar(par.porta));

      expect((await registrarMaterial(await materialDaEmpresa(autoridade))).status).toBe(201);

      const antes = await capturarCertificados(EMPRESA_A.id);
      const certificadoId = (await consultarCertificado(cookie)).id;

      // -------------------------------------------------------------------------------------
      // Passo 1 — o par aceita a ligação e NUNCA responde: o teto do adaptador governa
      // -------------------------------------------------------------------------------------
      apontarProvedorPara(enderecoDoPar(await subirParMudo()));

      const desdeOMudo = linhasDoJournal.length;
      const mudo = await verificarIdentidade(cookie);

      expect(mudo.status).toBe(200);

      const desfechoMudo = mudo.corpo as ResultadoPublicado;

      // ⚠️ **ANTES da igualdade** — ver o CT-826. Aqui a distinção importa duplamente: o desfecho do
      // par mudo e o do destino sem ouvinte pedem leituras diferentes do Admin, e um texto único
      // satisfaria "informou o desfecho" sem informar nada.
      expect(desfechoMudo.detalhe).not.toBe(DETALHE_ACEITE);
      expect(desfechoMudo.detalhe).not.toBe(DETALHE_RECUSA_PELO_PAR);
      expect(desfechoMudo.detalhe).not.toBe(DETALHE_INDISPONIVEL);

      expect(desfechoMudo).toEqual({
        aceito: false,
        verificadoEm: desfechoMudo.verificadoEm,
        detalhe: DETALHE_TEMPO_ESGOTADO,
      });

      // A linha de trilha com os quatro campos da §6.4 — e a duração é a do ato, não zero: é ela que
      // diz ao operador que o provedor está lento, e é ela que separa "esperou o par" de "desistiu na
      // hora com o texto certo". ⚠️ ANTES da igualdade, porque `duracaoMs` é campo dela.
      const trilhaDoMudo = trilhasDaVerificacaoDesde(desdeOMudo);

      expect(trilhaDoMudo.length).toBe(1);
      expect(trilhaDoMudo[0]?.duracaoMs).toBeGreaterThanOrEqual(
        DURACAO_MINIMA_DO_TEMPO_ESGOTADO_MS,
      );
      expect(trilhaDoMudo[0]).toEqual({
        empresaId: EMPRESA_A.id,
        entidade: ENTIDADE_DA_TRILHA,
        certificadoId,
        aceito: false,
        duracaoMs: trilhaDoMudo[0]?.duracaoMs,
      });

      // -------------------------------------------------------------------------------------
      // Passo 2 — não há ninguém no endereço: indisponibilidade, com texto PRÓPRIO
      // -------------------------------------------------------------------------------------
      apontarProvedorPara(enderecoDoPar(await portaSemOuvinte()));

      const inalcancavel = await verificarIdentidade(cookie);

      expect(inalcancavel.status).toBe(200);

      const desfechoInalcancavel = inalcancavel.corpo as ResultadoPublicado;

      expect(desfechoInalcancavel.detalhe).not.toBe(DETALHE_ACEITE);
      expect(desfechoInalcancavel.detalhe).not.toBe(DETALHE_RECUSA_PELO_PAR);
      expect(desfechoInalcancavel.detalhe).not.toBe(DETALHE_TEMPO_ESGOTADO);

      expect(desfechoInalcancavel).toEqual({
        aceito: false,
        verificadoEm: desfechoInalcancavel.verificadoEm,
        detalhe: DETALHE_INDISPONIVEL,
      });

      // Nenhum dos dois desfechos gravou coisa alguma, e o par de referência não recebeu ligação —
      // ele deixou de ser o destino no primeiro passo.
      expect(await capturarCertificados(EMPRESA_A.id)).toEqual(antes);
      expect(par.conexoes).toBe(0);
    },
    LIMITE_CASO_MS,
  );

  it(
    'CT-826 (c) — corpo não vazio é recusado com 422, e o provedor não é alcançado',
    async () => {
      const autoridade = await gerarAutoridadeDeTeste('ct826c');
      confiarEm(autoridade);

      const par = await subirParDoProvedor(autoridade, autoridade);
      apontarProvedorPara(enderecoDoPar(par.porta));

      // A empresa tem certificado vigente: a recusa abaixo é do **corpo**, e não da ausência de
      // material. Sem esta precondição o caso ficaria verde sobre um `404` disfarçado.
      expect((await registrarMaterial(await materialDaEmpresa(autoridade))).status).toBe(201);

      const invocacoesAntes = invocacoesDaPorta;

      par.zerar();

      const recusa = await pedir(ROTA_DA_VERIFICACAO, {
        metodo: 'POST',
        cookie,
        corpo: { algo: 1 },
      });

      expect(recusa.status).toBe(422);

      // A recusa acontece **antes** de qualquer leitura e de qualquer ligação: corpo fechado é
      // conferido na borda, e entrada não conferida não faz o produto abrir conexão com terceiro.
      expect(par.conexoes).toBe(0);
      expect(invocacoesDaPorta - invocacoesAntes).toBe(0);

      // O envelope INTEIRO da ADR-0017, nomeando o campo do corpo — e não o nome da chave enviada.
      expect(recusa.corpo).toEqual({
        codigo: CodigoErro.CAMPO_INVALIDO,
        mensagem: MENSAGEM_DE_REQUISICAO_INVALIDA,
        campo: CAMPO_DO_CORPO,
      });

      // O CONTROLE POSITIVO da rota, com o corpo vazio que ela aceita: sem ele, o `422` acima seria
      // compatível com uma rota que recusa tudo.
      expect((await verificarIdentidade(cookie)).status).toBe(200);
      expect(par.conexoes).toBe(1);
    },
    LIMITE_CASO_MS,
  );
});

// ---------------------------------------------------------------------------------------------
// Acessórios — nenhum deles toca a superfície de produção
// ---------------------------------------------------------------------------------------------

/** O recorte da sessão publicada que este arquivo observa. */
interface SessaoPublicada {
  readonly telas: readonly string[];
  readonly acoes: readonly string[];
}

/** O recorte do certificado publicado que este arquivo observa. */
interface CertificadoPublicado {
  readonly id: string;
  readonly titular: string;
  readonly impressaoDigital: string;
  readonly validoAte: string;
  readonly estado: string;
  readonly diasParaVencer: number;
  readonly registradoPor: { readonly id: string };
}

/** O desfecho da verificação, como a rota o publica — os três campos, e nenhum a mais. */
interface ResultadoPublicado {
  readonly aceito: boolean;
  readonly verificadoEm: string;
  readonly detalhe: string | null;
}

/** A linha de trilha que a verificação emite (§13.1), lida do evento estruturado. */
interface TrilhaDaVerificacao {
  readonly empresaId: string;
  readonly entidade: string;
  readonly certificadoId: string;
  readonly aceito: boolean;
  readonly duracaoMs: number;
}

/**
 * O par instrumentado que faz as vezes do provedor — TLS mútuo real, em porta dinâmica.
 *
 * ⚠️ **Instrumenta-se o PAR, nunca o adaptador.** É o que torna "zero conexões" e "um aperto de mão"
 * fatos observados do outro lado do fio, em vez de afirmações sobre o que o produto diz ter feito.
 *
 * A maquinaria tem parentesco com a de `packages/cobranca-bancaria/test/adaptador-sicoob.spec.ts`, e
 * a forma é deliberadamente **menor**: lá o objeto medido é o desfecho do adaptador em isolamento,
 * com pedidos, sessões reusadas e conexões vivas; aqui o que os casos precisam é do que a borda faz
 * chegar ao par — quantas ligações, quantos apertos de mão e qual titular. Promover a maquinaria a
 * acessório comum é decisão de quem tiver o **terceiro** consumidor; hoje são dois, e o de lá está
 * fora da lista de arquivos desta task.
 */
interface ParDoProvedor {
  readonly porta: number;
  conexoes: number;
  handshakes: number;
  errosDeCliente: number;
  readonly titularesApresentados: string[];
  /** Zera os contadores — usado quando o mesmo par serve a dois trechos do mesmo caso. */
  zerar(): void;
}

/**
 * Gera um material com a validade relativa pedida, pela autoridade descartável **do caso**.
 *
 * ⚠️ A autoridade é parâmetro, e nasce dentro de cada `it`, porque a limpeza dela é registrada em
 * `onTestFinished` — que o arcabouço só admite de dentro de um caso. Criá-la no `beforeAll` derruba a
 * suíte inteira na montagem, e foi assim que a primeira versão deste arquivo reprovou.
 */
async function gerarMaterial(
  autoridade: AutoridadeDeTeste,
  diasDeValidade: number,
): Promise<MaterialDeTeste> {
  return await gerarMaterialDeTeste({ autoridade, senha: SENHA_DO_MATERIAL, diasDeValidade });
}

/**
 * Gera o material **da empresa** — titular declarado, validade folgada, autoridade do caso.
 *
 * O titular é fixado em {@link TITULAR_DA_EMPRESA} porque ele é a âncora antivácuo do CT-826: é o
 * nome comum que o par tem de ver no aperto de mão aceito.
 */
async function materialDaEmpresa(autoridade: AutoridadeDeTeste): Promise<MaterialDeTeste> {
  return await gerarMaterialDeTeste({
    autoridade,
    senha: SENHA_DO_MATERIAL,
    diasDeValidade: DIAS_VIGENTE_FOLGADO,
    titular: TITULAR_DA_EMPRESA,
  });
}

/** Registra o material pela rota real, com a sessão da administradora da empresa A. */
async function registrarMaterial(material: MaterialDeTeste): Promise<Resposta> {
  return await pedir(ROTA_DO_REGISTRO, {
    metodo: 'POST',
    cookie,
    corpo: { material: material.material.toString('base64'), senha: material.senha },
  });
}

/** Lê a vigência publicada pela rota real, e devolve só o par que os casos comparam. */
async function consultarVigencia(
  credencial: string,
): Promise<{ estado: string; diasParaVencer: number }> {
  const resposta = await pedir(ROTA_DA_CONSULTA, { cookie: credencial });

  if (resposta.status !== 200) {
    throw new Error(
      `a consulta do certificado respondeu ${String(resposta.status)}: ${resposta.texto}`,
    );
  }

  const publicado = resposta.corpo as CertificadoPublicado;

  return { estado: publicado.estado, diasParaVencer: publicado.diasParaVencer };
}

/**
 * Retroage a validade do vigente em um dia — a única precondição deste arquivo que não passa pela
 * rota.
 *
 * A razão está no cabeçalho: `VENCIDO` é o estado que a escrita recusa por construção e que a
 * passagem do tempo produz. A instrução corre **sob o contexto de tenant** e sem `WHERE empresa_id`
 * — quem recorta é a política (ADR-0008) —, e o eixo é o do banco (`now()`), nunca o do processo.
 */
async function envelhecerOVigente(empresaId: string): Promise<void> {
  await contextoDeTenant.executarCom({ empresaId }, async () => {
    await acessoAoNegocio.emUnidadeDeTrabalho(async (tx) => {
      await tx`
        UPDATE negocio.certificado_do_provedor
           SET valido_ate = pg_catalog.now() - make_interval(days => ${DIAS_DE_ATRASO_DO_VENCIDO})
         WHERE substituido_em IS NULL
      `;
    });
  });
}

/**
 * Quantas linhas de `negocio.certificado_do_provedor` o contexto da empresa informada alcança.
 *
 * A contagem é **crua** e sem recorte: o que os casos medem é quantas linhas existem. Nenhum
 * `WHERE empresa_id` é escrito aqui — quem recorta é a política (ADR-0008) —, e a empresa entra pelo
 * **contexto**, que é o mesmo mecanismo que a aplicação usa.
 */
async function contarCertificados(empresaId: string): Promise<number> {
  return await contarComPredicado(empresaId, false);
}

/** Quantas linhas **vigentes** (`substituido_em IS NULL`) o contexto alcança — no máximo uma. */
async function contarVigentes(empresaId: string): Promise<number> {
  return await contarComPredicado(empresaId, true);
}

async function contarComPredicado(empresaId: string, apenasVigentes: boolean): Promise<number> {
  return await contextoDeTenant.executarCom({ empresaId }, async () => {
    return await acessoAoNegocio.emUnidadeDeTrabalho(async (tx) => {
      const [linha] = await tx<{ total: string }[]>`
        SELECT count(*) AS total
          FROM negocio.certificado_do_provedor
         WHERE ${apenasVigentes ? tx`substituido_em IS NULL` : tx`true`}
      `;

      return Number(linha?.total ?? 0);
    });
  });
}

/** Pede a verificação pela rota real, com a sessão informada. */
async function verificarIdentidade(credencial: string): Promise<Resposta> {
  return await pedir(ROTA_DA_VERIFICACAO, { metodo: 'POST', cookie: credencial });
}

/** Lê o certificado vigente pela rota real — é dele que sai o identificador que a trilha nomeia. */
async function consultarCertificado(credencial: string): Promise<CertificadoPublicado> {
  const resposta = await pedir(ROTA_DA_CONSULTA, { cookie: credencial });

  if (resposta.status !== 200) {
    throw new Error(
      `a consulta do certificado respondeu ${String(resposta.status)}: ${resposta.texto}`,
    );
  }

  return resposta.corpo as CertificadoPublicado;
}

/**
 * As linhas **inteiras** de `negocio.certificado_do_provedor` que o contexto da empresa alcança.
 *
 * Todas as colunas, e não um recorte: o que os casos de verificação afirmam é que **nada** mudou, e um
 * recorte deixaria passar exatamente o campo que a implementação carimbasse por engano. A ordem é
 * fixada por `id` para que a comparação não dependa da ordem de varredura do banco.
 *
 * Nenhum `WHERE empresa_id` é escrito aqui — quem recorta é a política (ADR-0008) —, e a empresa entra
 * pelo **contexto**, que é o mesmo mecanismo que a aplicação usa.
 */
async function capturarCertificados(empresaId: string): Promise<readonly unknown[]> {
  return await contextoDeTenant.executarCom({ empresaId }, async () => {
    return await acessoAoNegocio.emUnidadeDeTrabalho(async (tx) => {
      const linhas = await tx<Record<string, unknown>[]>`
        SELECT * FROM negocio.certificado_do_provedor ORDER BY id
      `;

      return [...linhas];
    });
  });
}

/**
 * As linhas de trilha **da verificação** emitidas desde a posição informada.
 *
 * O filtro é pelo campo `aceito`, que só o evento da verificação carrega: filtrar pela entidade
 * traria junto a linha do registro, que a nomeia igual. Os campos são lidos do evento estruturado, e
 * não casados no texto.
 */
function trilhasDaVerificacaoDesde(posicao: number): readonly TrilhaDaVerificacao[] {
  return linhasDoJournal
    .slice(posicao)
    .map((linha) => JSON.parse(linha) as Partial<TrilhaDaVerificacao>)
    .filter((evento): evento is TrilhaDaVerificacao => evento.aceito !== undefined)
    .map((evento) => ({
      empresaId: evento.empresaId,
      entidade: evento.entidade,
      certificadoId: evento.certificadoId,
      aceito: evento.aceito,
      duracaoMs: evento.duracaoMs,
    }));
}

/**
 * Instala a autoridade do caso nas raízes do processo, e desfaz a instalação ao fim dele.
 *
 * A restauração é **conferida** por igualdade de conjunto: instrumentação que sobrevivesse ao caso
 * mudaria a confiança dos vizinhos, e o vermelho apareceria longe da causa. A âncora antivácuo está no
 * próprio ato de instalar — a lista tem de crescer em exatamente uma raiz, senão o `aceito: true` do
 * CT-826 poderia vir de o par de teste já ser confiável por outro motivo.
 */
function confiarEm(autoridade: AutoridadeDeTeste): void {
  const originais = getCACertificates('default');

  setDefaultCACertificates([...originais, autoridade.certificadoEmPem]);
  expect(getCACertificates('default').length).toBe(originais.length + 1);

  onTestFinished(() => {
    setDefaultCACertificates(originais);
    expect(raizesComoConjunto(getCACertificates('default'))).toEqual(raizesComoConjunto(originais));
  });
}

/**
 * As raízes como **conjunto**, sem depender de ordem nem de formatação.
 *
 * ⚠️ Medido na T10: `setDefaultCACertificates` reescreve a lista que devolve depois — a ordem muda e
 * as linhas do PEM saem quebradas em outro comprimento. A igualdade crua entre o antes e o depois
 * reprovaria uma restauração **correta**; o que importa ao invariante é o conjunto.
 */
function raizesComoConjunto(pems: readonly string[]): string[] {
  return pems.map((pem) => pem.replace(/\s+/g, '')).sort();
}

/**
 * Aponta a porta de identidade para um destino, e restaura o estado anterior ao fim do caso.
 *
 * O destino é sempre do laço local. Um caso que esqueça de apontar não degrada em silêncio: a porta
 * recusa, e a reprovação diz o que faltou.
 */
function apontarProvedorPara(destino: string): void {
  const anterior = destinoDoProvedor;
  destinoDoProvedor = destino;

  onTestFinished(() => {
    destinoDoProvedor = anterior;
  });
}

/** O endereço seguro do par, na forma que o adaptador recebe. */
function enderecoDoPar(porta: number): string {
  return `https://${LACO_LOCAL}:${porta}`;
}

/**
 * Sobe o par TLS mútuo instrumentado em porta dinâmica, confiando **apenas** na autoridade dada.
 *
 * `requestCert` mais `rejectUnauthorized` é o que faz a recusa do CT-827 nascer da **decisão do par**,
 * e não de bytes divergentes. Ele responde `404` a qualquer pedido — o código é irrelevante para a
 * sonda, que só precisa que o par fale depois do aperto de mão —, e é encerrado em `onTestFinished`,
 * com as conexões pendentes desfeitas: sem isso o processo do arcabouço não terminaria.
 */
async function subirParDoProvedor(
  autoridadeDoServidor: AutoridadeDeTeste,
  autoridadeConfiavel: AutoridadeDeTeste,
): Promise<ParDoProvedor> {
  const parDoServidor = await gerarParDeServidorDeTeste(autoridadeDoServidor, NOME_DO_PAR);

  const observado: ParDoProvedor = {
    porta: 0,
    conexoes: 0,
    handshakes: 0,
    errosDeCliente: 0,
    titularesApresentados: [],
    zerar(): void {
      observado.conexoes = 0;
      observado.handshakes = 0;
      observado.errosDeCliente = 0;
      observado.titularesApresentados.length = 0;
    },
  };

  const servidor: ServidorSeguro = criarParSeguro(
    {
      key: parDoServidor.chaveEmPem,
      cert: parDoServidor.certificadoEmPem,
      ca: [autoridadeConfiavel.certificadoEmPem],
      requestCert: true,
      rejectUnauthorized: true,
    },
    (_pedido, resposta) => {
      resposta.writeHead(404);
      resposta.end();
    },
  );

  const pendentes = new Set<Duplex>();

  servidor.on('connection', (soquete) => {
    observado.conexoes += 1;
    pendentes.add(soquete);
    soquete.once('close', () => pendentes.delete(soquete));
  });
  servidor.on('secureConnection', (ligacao) => {
    observado.handshakes += 1;
    observado.titularesApresentados.push(nomeComumDe(ligacao.getPeerCertificate()?.subject?.CN));
  });
  servidor.on('tlsClientError', () => {
    observado.errosDeCliente += 1;
  });

  const porta = await escutarEmPortaDinamica(servidor);
  onTestFinished(() => encerrar(servidor, pendentes));

  return Object.assign(observado, { porta });
}

/**
 * Sobe um par **mudo**: aceita a ligação TCP e nunca escreve nada, de modo que o aperto de mão nunca
 * começa. É o cenário em que o teto do adaptador governa.
 */
async function subirParMudo(): Promise<number> {
  const pendentes = new Set<Duplex>();
  const servidor = criarParTcp((soquete) => {
    pendentes.add(soquete);
    soquete.once('close', () => pendentes.delete(soquete));
  });

  const porta = await escutarEmPortaDinamica(servidor);
  onTestFinished(() => encerrar(servidor, pendentes));

  return porta;
}

/**
 * Devolve uma porta **sabidamente sem ouvinte**: obtida por `listen(0)` e liberada antes do ato.
 *
 * Escolher um número *"que deve estar livre"* reintroduz a corrida que
 * `packages/shared/test/reserva-de-porta.spec.ts` existe para fechar.
 */
async function portaSemOuvinte(): Promise<number> {
  const servidor = criarParTcp();
  const porta = await escutarEmPortaDinamica(servidor);

  await new Promise<void>((resolver) => servidor.close(() => resolver()));

  return porta;
}

/** Abre a porta sorteada pelo núcleo no laço local e devolve o número dela. */
function escutarEmPortaDinamica(servidor: ServidorTcp): Promise<number> {
  return new Promise((resolver, rejeitar) => {
    servidor.listen(0, LACO_LOCAL, () => {
      const endereco = servidor.address();

      if (endereco === null || typeof endereco === 'string') {
        rejeitar(new Error('o par de teste não abriu porta de rede'));
        return;
      }

      resolver(endereco.port);
    });
  });
}

/** Encerra o par e desfaz as pendentes — `close()` sozinho esperaria a última conexão terminar. */
function encerrar(servidor: ServidorTcp, pendentes: ReadonlySet<Duplex>): Promise<void> {
  for (const soquete of pendentes) {
    soquete.destroy();
  }

  return new Promise((resolver) => {
    servidor.close(() => resolver());
  });
}

/**
 * O nome comum do par, tal como o runtime o entrega.
 *
 * O tipo admite **arranjo** para atributo repetido, e reduzi-lo a `String(valor)` produziria
 * `[object Object]` — a normalização é escrita para que a reprovação nomeie um titular legível.
 */
function nomeComumDe(nomeComum: string | readonly string[] | undefined): string {
  if (typeof nomeComum === 'string') {
    return nomeComum;
  }

  return Array.isArray(nomeComum) ? nomeComum.join(', ') : '(sem CN)';
}

/**
 * Os motivos internos emitidos no journal desde a posição informada, na ordem em que saíram.
 *
 * O campo é lido do evento estruturado, e não casado no texto: é o `motivo` que o serviço emite, e a
 * ordem é a das requisições — é ela que faz a igualdade acima discriminar qual causa produziu qual
 * recusa, e não apenas que duas linhas saíram.
 */
function motivosDesde(posicao: number): readonly string[] {
  return linhasDoJournal
    .slice(posicao)
    .map((linha) => (JSON.parse(linha) as { motivo?: string }).motivo)
    .filter((motivo): motivo is string => motivo !== undefined);
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
