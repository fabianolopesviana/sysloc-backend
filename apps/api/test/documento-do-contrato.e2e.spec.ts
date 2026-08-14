/**
 * `GET /v1/contratos/:codigo/documento` — a rota de **bytes** do produto (T7 da fatia
 * `documentos-e-confirmacao`), e as três condições de acesso que ela impõe.
 *
 * ===========================================================================
 * INVARIANTES
 * ===========================================================================
 *
 * | Critério | Caso   | Invariante |
 * |---|---|---|
 * | CA-02 | CT-714 | A rota devolve, a cada pedido, bytes compostos a partir do estado **gravado
 * | CA-07 |        | naquele instante**: pedir duas vezes com uma alteração no meio produz dois
 * |       |        | PDFs de conteúdo textual **diferente**, refletindo a alteração, **sem ato
 * |       |        | intermediário de regeneração**. Os dois respondem `200` com
 * |       |        | `Content-Type: application/pdf` e `Content-Disposition: attachment;
 * |       |        | filename="<codigo>.pdf"` (ADR-0028); o texto do segundo contém
 * |       |        | `R$ 2.800,00` e **não** contém `R$ 2.500,00`. |
 * | CA-08 | CT-715 | **Nenhum** dos três acessos ilegítimos recebe o documento: sessão de outra
 * |       |        | empresa responde `404`, sessão sem `TELA:contratos` responde `403` e pedido
 * |       |        | sem cookie responde `401`. Os três devolvem o envelope de erro da ADR-0017,
 * |       |        | **nenhum** tem `Content-Type: application/pdf`, e **nenhum** carrega bytes de
 * |       |        | PDF no corpo. |
 * | CA-02 | CT-714 | A unidade de trabalho da rota do documento cobre **apenas a leitura**: dentro
 * |       | (b)    | da continuação de `sobContextoDaSessao` corre uma única chamada ao serviço —
 * |       |        | `agregadoDoDocumento` —, e a **renderização corre depois** dela. A segunda
 * |       |        | metade não recebe `TransactionSql`; a primeira recebe. |
 *
 * Rastreabilidade: `CA-02 → CT-714 (RN-01)`, `CA-07 → CT-714 (RN-03)`, `CA-08 → CT-715 (RN-05)`,
 * `CA-02 → CT-714 (b) (RN-01)`.
 *
 * ===========================================================================
 * POR QUE O CT-714 E O CT-715 VÊM EM PAR — e por que nenhum deles sozinho serve
 * ===========================================================================
 *
 * O `CT-714` sozinho ficaria verde numa rota que entregasse o documento a **qualquer um**: ele mede o
 * conteúdo, não o alcance. O `CT-715` sozinho ficaria verde numa rota que recusasse **sempre** —
 * três recusas é o que uma rota quebrada também produz. É o par que fecha as duas saídas, e é por
 * isso que o eixo positivo do `CT-714` corre na MESMA suíte.
 *
 * **As três condições do `CT-715` são impostas por mecanismos DISTINTOS**, e é por isso que os três
 * subcasos não são redundantes: a guarda global (sessão), o decorador de exigência herdado da classe
 * (área) e a **política do banco** (empresa dona). Remover qualquer um deixaria um vetor de
 * vazamento sem cobertura — e, o que é pior, os três produzem status diferentes, de modo que uma
 * asserção genérica de "não veio PDF" não distinguiria qual mecanismo falhou.
 *
 * ===========================================================================
 * POR QUE O `CT-714 (b)` É ESTÁTICO — e o que ele guarda que nenhum dos outros guarda
 * ===========================================================================
 *
 * Ele nasce da rodada 1 do Gate 2 desta task, que **mediu** a renderização correndo dentro da
 * unidade de trabalho: 5 amostras entre 417 e 785 ms sobre o contrato mínimo, cada uma segurando
 * uma conexão física do pool — que é um só para o processo inteiro — e deixando um
 * `idle in transaction` de meio segundo por download. **O defeito é invisível a esta suíte**: os
 * dois casos acima passam idênticos nos dois desenhos, porque nenhum deles mede concorrência, e a
 * degradação aparece longe da causa (em outra rota, esperando conexão).
 *
 * Provar isso comportamentalmente exigiria **fabricar concorrência** — disparar downloads
 * simultâneos e observar o pool —, o que produz um caso caro e instável cuja falha não discrimina
 * a causa; ou **dublar o renderizador** para observar de dentro dele o estado da transação, o que
 * é dublar exatamente o que está sob prova (AP-10) e obrigaria a montagem instrumentada que o
 * `D57` já registra como débito. A saída honesta é a estática, que afirma a **topologia** do
 * manipulador: o que corre dentro da continuação e o que corre depois dela.
 *
 * Ela vem em **par de sentidos** — dentro da unidade há exatamente uma chamada ao serviço e ela
 * não é a renderização; fora dela está a renderização — mais o **controle de assinatura** no
 * serviço: a metade que lê declara `TransactionSql` e a que renderiza **não declara**. Sozinho,
 * cada eixo seria satisfeito por um manipulador que não chamasse nada.
 *
 * ===========================================================================
 * DIVERGÊNCIAS DECLARADAS — leia antes de comparar com a §6.3 e a §6.6 da task
 * ===========================================================================
 *
 * 1. **O contrato do `CT-714` é `RASCUNHO`, e não `ATIVO`.** O card descreve os dados de entrada
 *    como *"um contrato ativo"* e, no passo 2, manda alterar `valorMensal` por
 *    `PUT /v1/contratos/:codigo`. **As duas coisas não podem ser verdadeiras ao mesmo tempo**: a
 *    RD-05 aceita o `PUT` **somente enquanto `RASCUNHO`**, e sobre um contrato `ATIVO` a resposta é
 *    `422` com `campo: 'status'` — o passo 2 seria impossível. O invariante do card é o que governa
 *    (*"dois pedidos com uma alteração no meio produzem PDFs de conteúdo diferente"*), e ele é
 *    exercitado por inteiro sobre o rascunho.
 *
 *    E o rascunho é **mais severo**, não menos: `valor_total_contrato` nasce **nulo** nele (RD-10), de
 *    modo que o documento só consegue imprimir a alínea do valor total se o `COALESCE` da consulta
 *    tiver derivado o valor **no banco** (ADR-0023). Um contrato ativo esconderia essa metade, porque
 *    a coluna já estaria preenchida pela ativação. O passo 4 afirma o total derivado nos dois pedidos.
 * 2. **A marca de cancelamento não é exercitada aqui.** Ela é do `CT-706`, na suíte de composição
 *    (T5), que percorre os quatro estados sobre a função pura. Duplicá-la nesta camada provaria a
 *    mesma coisa por um caminho mais caro, e é o `CT-710` — em `contratos.e2e.spec.ts` — que fecha o
 *    lado do cancelamento pela rota.
 * 3. **"Sem linha `error` no journal"** vale para os casos deste arquivo pelo mesmo discriminante
 *    observável que `contratos.e2e.spec.ts` registra: afirmar o corpo INTEIRO de cada recusa com
 *    `codigo: RECURSO_NAO_ENCONTRADO`, `ACESSO_NEGADO` ou `NAO_AUTENTICADO` é afirmar que a resposta
 *    veio de um `ErroDeAplicacao`, e o filtro global só registra `logger.error` para o que **não** é
 *    `ErroDeAplicacao` — o que sairia como `500 ERRO_INTERNO`.
 *
 * ===========================================================================
 * MUTANTES EXECUTADOS — e o terceiro SOBREVIVEU, o que é conteúdo
 * ===========================================================================
 *
 * Aplicados ao **fonte de produção** e invocados pelo **script do pacote**
 * (`pnpm --filter @sysloc/api test`), nunca por `vitest run` avulso: `apps/api/test/**` alcança
 * `@sysloc/db` e `@sysloc/documentos` **só pela fronteira do pacote**, e mutante no fonte sem build
 * não chega ao `dist/` que executa — verde ali se leria como *"sobreviveu"* e **inverteria a
 * conclusão**. Controle: `26 arquivos, 206 casos, 0 falhas` na rodada 1, `207` a partir da rodada 2.
 *
 * ⚠️ Os três primeiros foram medidos na **rodada 1**, quando a rota tinha um método de serviço só
 * (`ContratoService.documento`); a rodada 2 o partiu em `agregadoDoDocumento` e
 * `renderizarDocumento` pela razão que o `CT-714 (b)` guarda. Os resultados abaixo são registro do
 * que foi medido, e os nomes são os daquele momento — o que cada um prova continua valendo.
 *
 *   * **MT-1 · o documento é guardado e reaproveitado** (`ContratoService.documento` passa a manter
 *     um `Map<codigo, Uint8Array>` e a devolver o valor guardado quando ele existe — a otimização que
 *     a ADR-0030 põe fora deste ponto): `2 failed | 204 passed`. No **CT-714**, no passo 4 —
 *     `expected 'CONTRATO DE LOCAÇÃO RESIDENCIAL LOCAD…' to contain 'R$ 2.800,00'` —, e é o único
 *     mutante que o passo 1 sozinho **não** pega, razão de o caso pedir o documento **duas** vezes.
 *     E também no **CT-715**, `outra_empresa` — `expected 200 to be 404` —, o que a medição revelou e
 *     a leitura não previa: um cache indexado pelo código **atravessa a fronteira de empresa**,
 *     porque o código é único por empresa e não globalmente. É a razão mais forte para o
 *     reaproveitamento não morar naquele ponto;
 *   * **MT-2 · os dois cabeçalhos são escritos ANTES da leitura** (as duas linhas de
 *     `resposta.header(…)` movidas para cima de `sobContextoDaSessao`): `1 failed | 205 passed`, no
 *     **CT-715**, subcase `outra_empresa` — `expected 500 to be 404`. O modo de falha medido é **pior
 *     do que o previsto**: com `Content-Type: application/pdf` já escrito, o envelope de erro do
 *     filtro global não chega a ser serializado, e o cliente recebe `500` no lugar do `404` — isto é,
 *     a ordem das linhas do manipulador decide o **status** da recusa, e não apenas o rótulo dela;
 *   * **MT-3 · a rota declara `@ExigeChave(AREA_DOS_CONTRATOS)` no método** — a forma "óbvia": **ele
 *     SOBREVIVEU** (`206 passed`), e o resultado é registrado por ser conteúdo. O `CT-355` mede
 *     *"o método declara MENOS do que a classe"*, e declarar **a mesma** chave não é declarar menos:
 *     a linha é redundante, não perigosa. Quem pega a forma perigosa é o mutante seguinte;
 *   * **MT-3b · o método declara uma chave DIFERENTE da classe** (`@ExigeChave(ACAO_DE_CANCELAMENTO)`
 *     no manipulador `documento` — a substituição que `getAllAndOverride` executa em silêncio):
 *     `3 failed | 203 passed`, e os três por eixos distintos. No **`CT-355`** —
 *     *"declaração de método que SUBSTITUI a da classe: ContratoController.documento"* —, e no
 *     **CT-714** e no **CT-715**, os dois com `expected 403 to be 200`: sem a área, nem o eixo
 *     positivo passa. É a falsificação real do critério §4-6 da task.
 *
 *   * **MT-4 · as três etapas voltam para dentro da unidade** (a forma anterior à correção da
 *     rodada 2 — `sobContextoDaSessao` embrulhando `renderizarDocumento(await agregadoDoDocumento(…))`,
 *     que é literalmente o defeito de desempenho que o Gate 2 mediu): `1 failed | 206 passed`, no
 *     **CT-714 (b)** — `expected [ Array(2) ] to have a length of 1 but got 2`, isto é, a segunda
 *     chamada ao serviço aparecendo **dentro** da continuação. Os outros dois casos deste arquivo
 *     seguem verdes, que é exatamente a razão de o `CT-714 (b)` existir;
 *   * **MT-5 · a renderização volta a aceitar o executor** (`_tx?: TransactionSql` acrescentado à
 *     assinatura de `ContratoService.renderizarDocumento` — o primeiro passo para a fusão voltar
 *     por dentro do serviço, e que **compila** e não muda comportamento algum):
 *     `1 failed | 206 passed`, no **CT-714 (b)**, no eixo 4 —
 *     `expected '(\n    agregado: AgregadoDoDocumentoD…' not to contain 'TransactionSql'`. É a
 *     falsificação do controle de assinatura, o único eixo que nenhum dos outros mutantes alcança.
 *
 * Cada mutante foi revertido de cópia e conferido idêntico ao original por `diff -q` antes do
 * seguinte, com o controle de volta a `206 passed` (`207` a partir do `CT-714 (b)`).
 *
 * ===========================================================================
 * Precondição privilegiada — o caminho é o REAL
 * ===========================================================================
 *
 * Sessão por **sign-in real**; efetivo por **escrita de ajustes sob o contexto real**
 * (`escreverAjustes` dentro de `contextoDeTenant.executarCom`), que é o mesmo caminho do Admin.
 * Nenhum estado de sessão é forjado, e **nenhum símbolo nasce em `apps/api/src/**` para que a prova
 * exista** (Iron Law #6). O efetivo é **afirmado** por `GET /v1/sessao` antes do fluxo, nas três
 * sessões: sem essa linha, o `403` do `CT-715` seria indistinguível de um defeito da rota, e o `200`
 * do `CT-714` de uma guarda desligada.
 *
 * A sessão **sem** `TELA:contratos` é uma pessoa criada pela **rota real do Admin** e que troca a
 * senha provisória pela rota real do produto — o mesmo molde do `CT-425`. Ela não recebe ajuste
 * algum, e o perfil `USUARIO_EMPRESA` da matriz não concede aquela área: a ausência é do catálogo, e
 * não uma retirada escrita aqui.
 *
 * De onde vêm o banco, a fila e a credencial: de **instâncias efêmeras próprias** (ADR-0006).
 * Nenhuma coordenada de conexão é lida do ambiente — o ambiente do processo é MONTADO a partir do que
 * os helpers devolvem —, e a aplicação é a **real** (`criarAplicacao`, de `src/main.ts`), com o
 * renderizador de PDF de produção. Dublar o renderizador seria dublar exatamente o que está sob
 * prova (AP-10).
 */

import { randomBytes, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
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
import { normalizarParaComparacao } from '@sysloc/documentos';
import { CodigoErro } from '@sysloc/shared';
// A construção `legacy` é a que o próprio `pdfjs-dist` exige fora do navegador — a de entrada
// alcança `DOMMatrix` na carga do módulo e derruba a suíte antes do primeiro caso.
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
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

// ---------------------------------------------------------------------------
// Limites de tempo — constantes nomeadas, nunca número mágico no meio do caso
// ---------------------------------------------------------------------------

/** Limite da montagem: banco migrado, semente com credencial, fila e a aplicação real. */
const LIMITE_DE_MONTAGEM_MS = 240_000;

/**
 * Limite de um caso que atravessa HTTP, banco, renderização de PDF **e** extração de texto.
 *
 * Ele é maior que o dos demais arquivos desta suíte porque a fronteira real é outra: o motor de
 * renderização e o extrator são carregados uma vez por processo e custam dezenas de segundos na
 * partida desta máquina, que é a mesma razão registrada em `packages/documentos/test/`.
 */
const LIMITE_CASO_MS = 180_000;

// ---------------------------------------------------------------------------
// Caminhos e credenciais — compostos a partir do dono de cada segmento
// ---------------------------------------------------------------------------

/** Sufixo do nome do cookie de sessão do arcabouço — o prefixo vem da configuração. */
const SUFIXO_DO_COOKIE_DE_SESSAO = 'session_token';

/** A rota de entrada, composta a partir do prefixo real. Nunca escrita à mão. */
const ROTA_DE_ENTRADA = `${PREFIXO_DAS_ROTAS_DE_IDENTIDADE}/sign-in/email`;

/** Caminho, relativo à raiz, da rota de sessão do produto. Composto, nunca escrito à mão. */
const CAMINHO_DA_SESSAO_CORRENTE = `/${PREFIXO_DE_VERSAO}/${CAMINHO_DA_SESSAO}`;

/** Caminho, relativo à raiz, da coleção de contratos — a superfície desta task. */
const COLECAO_DE_CONTRATOS = `/${PREFIXO_DE_VERSAO}/${CAMINHO_DOS_CONTRATOS}`;

/** A rota do Admin por onde nasce a pessoa **sem** a área de contratos. */
const CAMINHO_DAS_PESSOAS = `/${PREFIXO_DE_VERSAO}/${CAMINHO_DOS_USUARIOS}`;

/** A rota de troca de senha **do produto** — a que baixa a marca de senha provisória. */
const ROTA_DE_TROCA_DE_SENHA = `/${PREFIXO_DE_VERSAO}/${CAMINHO_DA_TROCA_DE_SENHA_DO_PRODUTO}`;

/** A senha definitiva com que a pessoa criada pelo Admin passa a operar. */
const SENHA_TROCADA = 'brisa9Verde!';

/**
 * O segmento da rota do documento, escrito por extenso.
 *
 * Ele **não** é importado do controlador: derivá-lo do SUT faria a asserção concordar consigo mesma,
 * e trocar o caminho da rota deixaria de reprovar caso algum — a requisição passaria a bater no
 * caminho novo, e o `404` de rota inexistente nunca apareceria.
 */
const SEGMENTO_DO_DOCUMENTO = 'documento';

// ---------------------------------------------------------------------------
// As mensagens e os corpos observados — declarados aqui, nunca lidos do SUT
// ---------------------------------------------------------------------------

/**
 * As mensagens canônicas de cada código, escritas por extenso.
 *
 * Literais, e **não** lidas de `MENSAGEM_POR_CODIGO`: os casos comparam corpos inteiros por
 * igualdade, e derivá-los da mesma tabela que o SUT usa faria a asserção concordar consigo mesma.
 */
const MENSAGEM_DE_NAO_ENCONTRADO = 'recurso não encontrado';
const MENSAGEM_DE_ACESSO_NEGADO = 'acesso negado para esta sessão';
const MENSAGEM_DE_NAO_AUTENTICADO = 'sessão inválida ou expirada';

// ---------------------------------------------------------------------------
// O arranjo de permissões
// ---------------------------------------------------------------------------

/**
 * O arranjo concedido às duas sessões que **alcançam** o contrato.
 *
 * Literal, e **não** derivado da exigência declarada nos controladores: derivá-lo faria a asserção
 * concordar com o SUT, e trocar a exigência da classe deixaria de reprovar caso algum.
 * `TELA:cadastros` e `TELA:imoveis` estão aqui porque o arranjo monta imóvel e pessoas **pelas rotas
 * reais**, e não por escolha deste arquivo.
 */
const CHAVES_DO_ARRANJO: readonly ChaveDoCatalogo[] = [
  'TELA:contratos',
  'TELA:imoveis',
  'TELA:cadastros',
];

/** A área que a classe do controlador de contrato exige — afirmada no efetivo, nunca suposta. */
const AREA_DOS_CONTRATOS: ChaveDoCatalogo = 'TELA:contratos';

// ---------------------------------------------------------------------------
// A asserção ESTÁTICA do CT-714 (b) — a topologia do manipulador do documento
// ---------------------------------------------------------------------------

/**
 * Os dois fontes sob varredura: a **borda**, que decide a extensão da unidade de trabalho, e o
 * **serviço**, cujas assinaturas dizem qual das duas metades pode tocar o banco.
 */
const FONTE_DO_CONTROLADOR = fileURLToPath(
  new URL('../src/contratos/contrato.controller.ts', import.meta.url),
);
const FONTE_DO_SERVICO = fileURLToPath(
  new URL('../src/contratos/contrato.service.ts', import.meta.url),
);

/**
 * As âncoras que delimitam o manipulador do documento dentro do fonte da borda.
 *
 * Escritas por extenso, e **não** derivadas do SUT: se o manipulador for renomeado ou a rota
 * seguinte mudar de lugar, o recorte sai vazio e o caso **reprova** — em vez de passar por
 * vacuidade sobre um trecho que deixou de existir.
 */
const ABERTURA_DO_MANIPULADOR = 'async documento(';
const ABERTURA_DA_ROTA_SEGUINTE = "\n  @Put(':codigo')";

/** A abertura da unidade de trabalho na borda — o ponto único da decisão D1. */
const ABERTURA_DA_UNIDADE = 'sobContextoDaSessao(';

/**
 * As duas chamadas ao serviço, e o que separa uma da outra.
 *
 * A primeira é a **única** que pode correr dentro da unidade — ela exige o executor; a segunda tem
 * de correr **depois** de a transação ter commitado, porque custa ~0,5 s e não toca o banco.
 */
const CHAMADA_DO_AGREGADO = 'this.contratos.agregadoDoDocumento(tx, codigo)';
const CHAMADA_DA_RENDERIZACAO = 'this.contratos.renderizarDocumento(agregado)';

/**
 * Os dois predicados largos que dão sensibilidade ao caso.
 *
 * O primeiro conta **qualquer** chamada ao serviço dentro da unidade — uma segunda, ainda que de
 * outro nome, a alargaria de novo. O segundo casa qualquer forma de renderização (`renderizar`,
 * `renderizarDocumento`, `renderizacao`), de modo que trocar o nome do método não faz a asserção
 * deixar de enxergar a etapa cara.
 */
const QUALQUER_CHAMADA_AO_SERVICO = /this\.contratos\./gu;
const QUALQUER_RENDERIZACAO = /renderiza/u;

/** O tipo do executor de transação — o que a assinatura da leitura declara e a da outra não. */
const TIPO_DO_EXECUTOR = 'TransactionSql';

/** As duas assinaturas do serviço, como o fonte as escreve. */
const ASSINATURA_DA_LEITURA = 'async agregadoDoDocumento(';
const ASSINATURA_DA_RENDERIZACAO = 'async renderizarDocumento(';

/** Recorta o trecho entre duas âncoras literais; cadeia vazia quando qualquer uma delas falta. */
function recorteEntreAncoras(fonte: string, inicio: string, fim: string): string {
  const comeco = fonte.indexOf(inicio);

  if (comeco < 0) {
    return '';
  }

  const termino = fonte.indexOf(fim, comeco);

  return termino < 0 ? '' : fonte.slice(comeco, termino);
}

/**
 * Remove os comentários de linha antes da varredura.
 *
 * Sem isso, a prosa que **explica** a decisão — que nomeia a renderização e traz parênteses —
 * contaria como código, e o caso reprovaria o arquivo justamente por ele estar documentado.
 */
function semComentariosDeLinha(fonte: string): string {
  return fonte
    .split('\n')
    .map((linha) => {
      const marca = linha.indexOf('//');

      return marca < 0 ? linha : linha.slice(0, marca);
    })
    .join('\n');
}

/**
 * Devolve o índice logo após o `)` que fecha a chamada aberta em `indiceDaAbertura`, ou `-1`.
 *
 * É a contagem balanceada de parênteses, e é ela que separa *"dentro da continuação"* de *"depois
 * dela"* — a distinção que o caso inteiro mede.
 */
function fimDaChamada(codigo: string, indiceDaAbertura: number): number {
  let profundidade = 0;

  for (let posicao = indiceDaAbertura; posicao < codigo.length; posicao += 1) {
    const caractere = codigo[posicao];

    if (caractere === '(') {
      profundidade += 1;
    } else if (caractere === ')') {
      profundidade -= 1;

      if (profundidade === 0) {
        return posicao + 1;
      }
    }
  }

  return -1;
}

/** A lista de parâmetros de uma assinatura do serviço — o que está entre os parênteses dela. */
function parametrosDe(fonte: string, assinatura: string): string {
  const comeco = fonte.indexOf(assinatura);

  if (comeco < 0) {
    return '';
  }

  const abertura = comeco + assinatura.length - 1;

  return fonte.slice(abertura, fimDaChamada(fonte, abertura));
}

// ---------------------------------------------------------------------------
// Os termos do cenário do CT-714
// ---------------------------------------------------------------------------

/** Os dois valores mensais do `CT-714` — o inicial e o que o `PUT` grava entre os dois pedidos. */
const VALOR_MENSAL_INICIAL = 2500;
const VALOR_MENSAL_NOVO = 2800;

/**
 * Como o documento imprime cada um dos dois valores, escrito por extenso.
 *
 * Literais, e **não** produzidos por `formatarValorEmReais`: derivá-los da mesma função que o SUT usa
 * para compor o texto faria a asserção concordar consigo mesma — um separador trocado mudaria os dois
 * lados ao mesmo tempo e o caso continuaria verde (AP-29).
 */
const VALOR_INICIAL_NO_TEXTO = 'R$ 2.500,00';
const VALOR_NOVO_NO_TEXTO = 'R$ 2.800,00';

/**
 * O prazo do cenário e o total que o `COALESCE` da consulta deriva para cada valor mensal.
 *
 * O contrato é `RASCUNHO`, logo `valor_total_contrato` é **nulo** e o documento só consegue imprimir
 * a alínea do valor total se a derivação tiver corrido no banco (ADR-0023). São `12 × 2.500,00` e
 * `12 × 2.800,00`, escritos por extenso pela mesma razão dos dois acima.
 */
const PRAZO_EM_MESES = 12;
const TOTAL_INICIAL_NO_TEXTO = 'R$ 30.000,00';
const TOTAL_NOVO_NO_TEXTO = 'R$ 33.600,00';

/** Os demais termos do contrato do cenário — nenhum caso afirma coisa alguma sobre eles. */
const DATA_DE_INICIO = '2026-01-15';
const DIA_DE_VENCIMENTO = 10;

/**
 * Os primeiros bytes de todo arquivo PDF — a âncora de que o corpo é mesmo um documento.
 *
 * Sem ela, *"a resposta veio com `Content-Type: application/pdf`"* seria satisfeito por um corpo
 * vazio, e o `CT-714` provaria só que a rota escreve um cabeçalho.
 */
const ASSINATURA_DO_PDF = '%PDF-';

/** O tipo de mídia que a rota declara (ADR-0028) — literal, nunca importado do controlador. */
const TIPO_DE_MIDIA_DO_DOCUMENTO = 'application/pdf';

// ---------------------------------------------------------------------------
// A extração do texto do PDF
// ---------------------------------------------------------------------------

// DÉBITO COM GATILHO — D5 · F3/T7 · registrado 2026-08-13
// (NÃO é uma `DECISÃO FECHADA`: ele agenda uma mudança, não protege o código abaixo.)
// O QUÊ: `extrairTextoDePdf` é a SEGUNDA leitura de PDF da verificação. A primeira é
//        `extrairTextoDoPdf` de `packages/documentos/test/renderizador-pdf.spec.ts`, e as duas
//        diferem na fonte (arquivo em disco lá, bytes da resposta HTTP aqui) e compartilham o
//        miolo — `getDocument` mais o percurso dos `TextItem`. Duas cópias divergem em silêncio, e
//        uma que divergiu passa a extrair coisa diferente da que o caso afirma extrair.
// QUANDO FECHA: o TERCEIRO consumidor de extração de texto de PDF — o **carnê da F4**, cuja fonte é
//        o boleto emitido —, ou a primeira alteração das opções do extrator (`useSystemFonts`, o
//        diretório de fontes padrão). Ali o miolo sobe para um acessório único, e os dois formatos
//        de entrada viram parâmetro.
// POR QUE NÃO AGORA: promovê-lo exigiria criar um acessório compartilhado entre `packages/documentos`
//        e `apps/api` e editar a suíte que a T6 acabou de provar — nenhum dos dois no escopo desta
//        task, cuja lista de arquivos é declarada.
// ÍNDICE: docs/specs/features/documentos-e-confirmacao/v1/_run/run-report.md §2, D5

/**
 * O diretório das fontes padrão do extrator, resolvido pelo **próprio pacote instalado**.
 *
 * Sem ele o `pdfjs-dist` avisa que não consegue carregar `LiberationSans-Regular.ttf` e a extração
 * passa a depender do que estiver instalado no host. Resolver pelo `package.json` da biblioteca é o
 * que sobrevive ao arranjo de diretórios do pnpm, onde o caminho relativo aparente não é o real.
 */
const DIRETORIO_DAS_FONTES_PADRAO = join(
  dirname(createRequire(import.meta.url).resolve('pdfjs-dist/package.json')),
  'standard_fonts/',
);

/**
 * Extrai o texto de um PDF recebido **em bytes**, com uma quebra de linha onde o layout quebrou.
 *
 * `useSystemFonts: false` é determinismo, não ornamento: com fontes do sistema operacional em jogo, a
 * extração passaria a depender do host, e o resultado deixaria de ser propriedade do PDF.
 */
async function extrairTextoDePdf(bytes: Uint8Array): Promise<string> {
  const tarefa = getDocument({
    data: bytes,
    standardFontDataUrl: DIRETORIO_DAS_FONTES_PADRAO,
    useSystemFonts: false,
  });

  let texto = '';

  try {
    const documento = await tarefa.promise;

    for (let pagina = 1; pagina <= documento.numPages; pagina += 1) {
      const conteudo = await (await documento.getPage(pagina)).getTextContent();

      for (const item of conteudo.items) {
        // `TextMarkedContent` não carrega texto; só os `TextItem` têm `str`.
        if (!('str' in item)) continue;

        texto += item.str;
        if (item.hasEOL) texto += '\n';
      }
    }
  } finally {
    // Sem isto o processo do extrator fica de pé e a suíte não encerra sozinha.
    await tarefa.destroy();
  }

  return texto;
}

// ---------------------------------------------------------------------------
// As pessoas da carga
// ---------------------------------------------------------------------------

/** A pessoa que age na empresa A — o sujeito do `CT-714` e a dona do contrato. */
const QUEM_AGE = pessoaSemeada('usuario.a@exemplo.com.br');

/** A pessoa que age na empresa B — a outra ponta do isolamento do `CT-715`. */
const QUEM_AGE_EM_B = pessoaSemeada('usuario.b1@exemplo.com.br');

/** O Admin da empresa A — usado apenas para fazer nascer a pessoa **sem** a área de contratos. */
const ADMIN_DE_A = pessoaSemeada('admin.a@exemplo.com.br');

let identidade: IdentidadeEfemera;
let fila: FilaEfemera;
let acessoAoNegocio: AcessoAoBanco;
let aplicacao: NestFastifyApplication;
let base: string;
let ambienteAnterior: NodeJS.ProcessEnv;
let cookie: string;
let cookieDeB: string;
let cookieSemArea: string;

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

  // A terceira sessão nasce pela ROTA REAL do Admin e **não recebe ajuste algum**: o perfil
  // `USUARIO_EMPRESA` da matriz não concede `TELA:contratos`, e a ausência é do catálogo, não uma
  // retirada escrita aqui.
  cookieSemArea = (await pessoaOperandoComSenhaTrocada()).cookie;

  // Precondições AFIRMADAS, e não supostas. Sem as duas primeiras, um `403` nas rotas do arranjo
  // seria indistinguível de um defeito delas; sem a terceira, o `403` do `CT-715` seria
  // indistinguível de uma guarda que recusa qualquer sessão.
  for (const credencial of [cookie, cookieDeB]) {
    const sessao = (await pedir(CAMINHO_DA_SESSAO_CORRENTE, { cookie: credencial }))
      .corpo as SessaoPublicada;
    expect(sessao.telas).toContain(AREA_DOS_CONTRATOS);
  }

  const semArea = (await pedir(CAMINHO_DA_SESSAO_CORRENTE, { cookie: cookieSemArea }))
    .corpo as SessaoPublicada;
  expect(semArea.telas).not.toContain(AREA_DOS_CONTRATOS);
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

describe('o documento do contrato — a rota de bytes (T7)', () => {
  it(
    'CT-714 — o documento reflete o cadastro no instante do pedido, sem ato de regeneração',
    async () => {
      const partes = await montarPartes(cookie);
      const contrato = await criarContratoPor(cookie, partes);

      // --- Passo 1: o PRIMEIRO pedido ------------------------------------------------------------
      const primeiro = await pedirDocumento(cookie, contrato.codigo);

      expect(primeiro.status).toBe(200);
      // A ADR-0028 exige as três declarações, e duas delas são observáveis aqui: a **mídia** e o
      // **nome sugerido de arquivo**. A terceira — o mesmo envelope de erro — é o `CT-715`.
      expect(primeiro.tipoDeConteudo).toBe(TIPO_DE_MIDIA_DO_DOCUMENTO);
      expect(primeiro.disposicao).toBe(`attachment; filename="${contrato.codigo}.pdf"`);
      // A âncora de que o corpo é mesmo um PDF: sem ela, um corpo vazio satisfaria o cabeçalho.
      expect(textoInicialDe(primeiro.bytes)).toBe(ASSINATURA_DO_PDF);

      const textoDoPrimeiro = normalizarParaComparacao(await extrairTextoDePdf(primeiro.bytes));

      // O documento imprime o valor mensal do cadastro **e** o valor total derivado no banco — a
      // segunda metade só existe porque o contrato é `RASCUNHO` e a coluna está nula (ADR-0023).
      expect(textoDoPrimeiro).toContain(VALOR_INICIAL_NO_TEXTO);
      expect(textoDoPrimeiro).toContain(TOTAL_INICIAL_NO_TEXTO);

      // --- Passo 2: a ALTERAÇÃO, pela rota real ---------------------------------------------------
      const alteracao = await pedir(`${COLECAO_DE_CONTRATOS}/${contrato.codigo}`, {
        metodo: 'PUT',
        cookie,
        corpo: corpoDeContrato(partes, { valorMensal: VALOR_MENSAL_NOVO }),
      });
      expect(alteracao.status).toBe(200);

      // --- Passo 3: o SEGUNDO pedido, sem ato intermediário de regeneração ------------------------
      //
      // Não existe rota de regeneração, e nenhuma é chamada aqui: entre os dois pedidos houve
      // **apenas** o `PUT`. É essa ausência que a RN-01 exige, e ela é o que o passo 5 mede.
      const segundo = await pedirDocumento(cookie, contrato.codigo);

      expect(segundo.status).toBe(200);
      expect(segundo.tipoDeConteudo).toBe(TIPO_DE_MIDIA_DO_DOCUMENTO);
      expect(segundo.disposicao).toBe(`attachment; filename="${contrato.codigo}.pdf"`);
      expect(textoInicialDe(segundo.bytes)).toBe(ASSINATURA_DO_PDF);

      const textoDoSegundo = normalizarParaComparacao(await extrairTextoDePdf(segundo.bytes));

      // --- Passo 4: o valor NOVO está lá, e o total foi REDERIVADO --------------------------------
      expect(textoDoSegundo).toContain(VALOR_NOVO_NO_TEXTO);
      expect(textoDoSegundo).toContain(TOTAL_NOVO_NO_TEXTO);

      // --- Passo 5: o valor ANTIGO NÃO está lá ---------------------------------------------------
      //
      // É a metade que discrimina, e a única que um cache reprovaria: *"o documento novo contém o
      // valor novo"* seria satisfeito por um documento que contivesse os dois. As duas grandezas
      // entram, porque um reaproveitamento parcial — do texto, mas não do total — passaria com uma
      // só.
      expect(textoDoSegundo).not.toContain(VALOR_INICIAL_NO_TEXTO);
      expect(textoDoSegundo).not.toContain(TOTAL_INICIAL_NO_TEXTO);

      // --- Passo 6: os dois documentos são de fato DIFERENTES ------------------------------------
      //
      // A âncora de não-vacuidade das quatro asserções acima: sem ela, um extrator que devolvesse
      // cadeia vazia satisfaria os dois `not.toContain` e nada mais seria afirmado.
      expect(textoDoPrimeiro).not.toBe(textoDoSegundo);
      expect(textoDoPrimeiro.length).toBeGreaterThan(0);
    },
    LIMITE_CASO_MS,
  );

  it(
    'CT-715 — nenhum dos três acessos ilegítimos recebe o documento: outra empresa, sem área, sem sessão',
    async () => {
      const partes = await montarPartes(cookie);
      const contrato = await criarContratoPor(cookie, partes);

      // O controle POSITIVO vem primeiro, e é ele que impede o caso de passar por vacuidade: sem
      // ele, uma rota que recusasse **sempre** satisfaria os três subcasos abaixo.
      const legitimo = await pedirDocumento(cookie, contrato.codigo);
      expect(legitimo.status).toBe(200);
      expect(legitimo.tipoDeConteudo).toBe(TIPO_DE_MIDIA_DO_DOCUMENTO);

      // Os três cenários, cada um com uma condição de acesso violada — e cada um imposto por um
      // mecanismo DIFERENTE: a política do banco, o decorador herdado da classe e a guarda global.
      const cenarios: readonly {
        readonly nome: string;
        readonly credencial: string | undefined;
        readonly status: number;
        readonly corpo: Record<string, unknown>;
      }[] = [
        {
          nome: 'outra_empresa',
          credencial: cookieDeB,
          status: 404,
          corpo: {
            codigo: CodigoErro.RECURSO_NAO_ENCONTRADO,
            mensagem: MENSAGEM_DE_NAO_ENCONTRADO,
          },
        },
        {
          nome: 'sem_area_contratos',
          credencial: cookieSemArea,
          status: 403,
          corpo: {
            codigo: CodigoErro.ACESSO_NEGADO,
            mensagem: MENSAGEM_DE_ACESSO_NEGADO,
            detalhes: { exigido: AREA_DOS_CONTRATOS },
          },
        },
        {
          nome: 'sem_sessao',
          credencial: undefined,
          status: 401,
          corpo: {
            codigo: CodigoErro.NAO_AUTENTICADO,
            mensagem: MENSAGEM_DE_NAO_AUTENTICADO,
          },
        },
      ];

      for (const cenario of cenarios) {
        const recusa = await pedirDocumento(cenario.credencial, contrato.codigo);

        expect(recusa.status, cenario.nome).toBe(cenario.status);
        // O envelope INTEIRO por igualdade (ADR-0017) — nunca presença de campo.
        expect(recusa.corpo, cenario.nome).toEqual(cenario.corpo);
        // **Nenhum** dos três se anuncia como PDF. É o que separa "recusou" de "recusou sem vazar":
        // um cabeçalho escrito antes da leitura sobreviveria à recusa, e o envelope de erro sairia
        // rotulado como documento.
        expect(recusa.tipoDeConteudo, cenario.nome).not.toBe(TIPO_DE_MIDIA_DO_DOCUMENTO);
        // E **nenhum** carrega bytes de PDF no corpo, que é a afirmação sobre o conteúdo — o
        // cabeçalho sozinho não a faz.
        expect(textoInicialDe(recusa.bytes), cenario.nome).not.toBe(ASSINATURA_DO_PDF);
      }

      // A âncora de que a recusa da empresa B é do ISOLAMENTO, e não da área: a sessão de B alcança
      // `TELA:contratos` e, sobre um contrato **dela**, recebe `200`. Sem esta linha, o `404` acima
      // seria indistinguível de uma rota quebrada para toda sessão que não fosse a de A.
      const partesDeB = await montarPartes(cookieDeB);
      const contratoDeB = await criarContratoPor(cookieDeB, partesDeB);
      const deB = await pedirDocumento(cookieDeB, contratoDeB.codigo);

      expect(deB.status).toBe(200);
      expect(deB.tipoDeConteudo).toBe(TIPO_DE_MIDIA_DO_DOCUMENTO);
    },
    LIMITE_CASO_MS,
  );

  it('CT-714 (b) — a unidade de trabalho cobre só a leitura, e a renderização corre fora dela', () => {
    const manipulador = semComentariosDeLinha(
      recorteEntreAncoras(
        readFileSync(FONTE_DO_CONTROLADOR, 'utf8'),
        ABERTURA_DO_MANIPULADOR,
        ABERTURA_DA_ROTA_SEGUINTE,
      ),
    );

    // A âncora de não-vacuidade: sem ela, um manipulador renomeado daria recorte vazio e **todas**
    // as asserções de "não contém" abaixo passariam sobre nada.
    expect(
      manipulador.length,
      'o manipulador do documento foi encontrado no fonte',
    ).toBeGreaterThan(0);

    const abertura = manipulador.indexOf(ABERTURA_DA_UNIDADE);

    expect(abertura, 'a unidade de trabalho abre na borda (decisão D1)').toBeGreaterThanOrEqual(0);

    const fim = fimDaChamada(manipulador, abertura + ABERTURA_DA_UNIDADE.length - 1);

    expect(fim, 'a continuação da unidade de trabalho fecha').toBeGreaterThan(abertura);

    const dentroDaUnidade = manipulador.slice(abertura, fim);
    const depoisDaUnidade = manipulador.slice(fim);

    // --- Eixo 1: dentro da unidade corre a leitura, e SÓ ela ---------------------------------------
    expect(dentroDaUnidade).toContain(CHAMADA_DO_AGREGADO);
    // A contagem exata, e não "contém": uma segunda chamada ao serviço lá dentro alargaria a unidade
    // outra vez, ainda que a renderização tivesse saído.
    expect(dentroDaUnidade.match(QUALQUER_CHAMADA_AO_SERVICO) ?? []).toHaveLength(1);

    // --- Eixo 2: NADA de renderização dentro da unidade -------------------------------------------
    //
    // É a metade que discrimina o defeito medido pelo Gate 2 na rodada 1: as ~0,5 s de renderização
    // segurando conexão física do pool e transação abertas.
    expect(QUALQUER_RENDERIZACAO.test(dentroDaUnidade)).toBe(false);

    // --- Eixo 3: a renderização corre DEPOIS, sobre o agregado que a unidade devolveu --------------
    //
    // O companheiro positivo do eixo 2: sem ele, um manipulador que não renderizasse coisa alguma —
    // ou que devolvesse os bytes de outro lugar — satisfaria o "não contém" acima.
    expect(depoisDaUnidade).toContain(CHAMADA_DA_RENDERIZACAO);

    // --- Eixo 4: o controle de ASSINATURA, no serviço ---------------------------------------------
    //
    // O par de sentidos que faz a separação ser de tipo, e não de ordem das linhas: a metade que lê
    // recebe o executor, e a que renderiza **não pode** recebê-lo — sem `tx` não há caminho dela
    // até o banco, e é isso que impede a fusão de voltar por dentro do serviço.
    const servico = readFileSync(FONTE_DO_SERVICO, 'utf8');

    expect(parametrosDe(servico, ASSINATURA_DA_LEITURA)).toContain(TIPO_DO_EXECUTOR);
    expect(parametrosDe(servico, ASSINATURA_DA_RENDERIZACAO)).not.toContain(TIPO_DO_EXECUTOR);
    // E a âncora de que a segunda assinatura existe mesmo: `not.toContain` sobre cadeia vazia passa.
    expect(parametrosDe(servico, ASSINATURA_DA_RENDERIZACAO).length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------------------------
// Acessórios — todo arranjo pelas rotas reais
// ---------------------------------------------------------------------------------------------

/** O que {@link montarPartes} devolve — os identificadores que o corpo do contrato referencia. */
interface Partes {
  readonly imovelId: string;
  readonly locadorId: string;
  readonly locatarioId: string;
  readonly fiadoresIds: readonly string[];
}

/** O sequencial que dá unicidade aos campos únicos do arranjo — monotônico, nunca sorteado. */
let sequencial = 0;

function proximo(): number {
  sequencial += 1;

  return sequencial;
}

/**
 * Monta conjunto, imóvel, locador, locatário e **um** fiador pelas rotas reais, com a sessão
 * informada.
 *
 * Nada é gravado por conexão privilegiada: a empresa de cada cadastro sai da sessão que o cria, que é
 * exatamente o mecanismo que o `CT-715` explora. A falha levanta em vez de devolver — uma precondição
 * que falhasse em silêncio faria o caso reprovar numa asserção adiante, apontando para o lugar errado.
 *
 * O fiador entra porque o documento tem um bloco **inteiro** que só existe quando há fiador: um
 * arranjo sem nenhum deixaria de exercitar a junção lateral da consulta pela rota.
 */
async function montarPartes(credencial: string): Promise<Partes> {
  const conjuntoId = (
    await criarPor(credencial, CAMINHO_DOS_CONJUNTOS, { nome: `Edifício ${String(proximo())}` })
  ).id;

  const imovelId = (await criarPor(credencial, CAMINHO_DOS_IMOVEIS, corpoDeImovel(conjuntoId))).id;
  const locadorId = (await criarPor(credencial, CAMINHO_DOS_LOCADORES, corpoDePessoa())).id;
  const locatarioId = (await criarPor(credencial, CAMINHO_DOS_LOCATARIOS, corpoDePessoa())).id;
  const fiadorId = (await criarPor(credencial, CAMINHO_DOS_FIADORES, corpoDePessoa())).id;

  return { imovelId, locadorId, locatarioId, fiadoresIds: [fiadorId] };
}

/** Cria um cadastro pela rota real e devolve o identificador dele. A falha levanta. */
async function criarPor(
  credencial: string,
  dono: string,
  corpo: Record<string, unknown>,
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
    identificadorMunicipal: `DOC-${marca}`,
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

/**
 * O corpo completo de um contrato, com as partes por parâmetro.
 *
 * **`empresaId` não aparece**, e a ausência é o ponto: a empresa sai da sessão, e o `strictObject` do
 * contrato recusaria a chave. `codigo`, `status`, `dataFimLocacao` e `valorTotalContrato` também não
 * aparecem — os quatro são decididos pelo servidor —, e `pdfContratoArquivo` **não existe mais** no
 * esquema desde a T3.
 */
function corpoDeContrato(
  partes: Partes,
  ajustes: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    imovelId: partes.imovelId,
    locadorId: partes.locadorId,
    locatarioId: partes.locatarioId,
    fiadoresIds: [...partes.fiadoresIds],
    dataInicioLocacao: DATA_DE_INICIO,
    prazoMeses: PRAZO_EM_MESES,
    valorMensal: VALOR_MENSAL_INICIAL,
    diaVencimento: DIA_DE_VENCIMENTO,
    gerarCobrancasAutomaticamente: false,
    ...ajustes,
  };
}

/** Monta um contrato pela rota real e devolve o código dele. A falha levanta. */
async function criarContratoPor(
  credencial: string,
  partes: Partes,
): Promise<{ readonly codigo: string }> {
  const resposta = await pedir(COLECAO_DE_CONTRATOS, {
    metodo: 'POST',
    cookie: credencial,
    corpo: corpoDeContrato(partes),
  });

  if (resposta.status !== 201) {
    throw new Error(
      `a montagem do contrato respondeu ${String(resposta.status)}: ${resposta.texto}`,
    );
  }

  return resposta.corpo as { codigo: string };
}

/**
 * Cria uma pessoa pela **rota real do Admin** e a põe a operar com senha definitiva.
 *
 * Ela **não recebe ajuste algum**: é justamente a ausência de `TELA:contratos` no perfil
 * `USUARIO_EMPRESA` que a torna o sujeito do subcaso `sem_area_contratos`. É o mesmo molde do
 * `CT-425`, em `contratos.e2e.spec.ts`.
 */
async function pessoaOperandoComSenhaTrocada(): Promise<{ readonly cookie: string }> {
  const cookieDoAdmin = await entrar(ADMIN_DE_A.email, SENHA_DA_CARGA);

  const criada = await pedir(CAMINHO_DAS_PESSOAS, {
    metodo: 'POST',
    cookie: cookieDoAdmin,
    corpo: {
      nome: 'Pessoa Sem A Área De Contratos',
      email: `sem-area.${randomUUID()}@exemplo.com.br`,
      perfil: 'USUARIO_EMPRESA',
    },
  });

  if (criada.status !== 201) {
    throw new Error(`a criação de pessoa respondeu ${String(criada.status)}: ${criada.texto}`);
  }

  const { email, senhaProvisoria } = criada.corpo as {
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
  const reemitida = troca.cookies.find((bruto) =>
    (bruto.split(';')[0] ?? '').split('=')[0]?.trim().endsWith(SUFIXO_DO_COOKIE_DE_SESSAO),
  );

  return { cookie: reemitida?.split(';')[0] ?? restrita };
}

/** Concede as chaves à pessoa, sob o contexto real da empresa — o mesmo caminho do Admin. */
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

/** A sessão do produto, no que este arquivo observa dela. */
interface SessaoPublicada {
  readonly telas: readonly string[];
  readonly acoes: readonly string[];
}

// ---------------------------------------------------------------------------------------------
// Cliente HTTP — este arquivo lê BYTES, e não só texto
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
 * Executa uma requisição HTTP real contra a aplicação, lendo o corpo como **texto**.
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

/** O que a rota do documento devolve, como este arquivo o observa. */
interface RespostaDeDocumento {
  readonly status: number;
  readonly tipoDeConteudo: string;
  readonly disposicao: string;
  readonly bytes: Uint8Array;
  readonly corpo: unknown;
}

/**
 * Pede o documento de um contrato e devolve status, cabeçalhos e o corpo **em bytes**.
 *
 * Ele lê o corpo como `ArrayBuffer` sempre — inclusive nas recusas —, e a escolha é conteúdo: um
 * cliente que lesse texto não conseguiria afirmar que a recusa **não** carrega bytes de PDF, que é
 * metade do `CT-715`. O envelope de erro continua sendo desserializado quando o tipo de conteúdo diz
 * que ele é JSON, e é essa cadeia — bytes → texto → objeto — que mantém as duas afirmações no mesmo
 * caso.
 *
 * A credencial é opcional porque o subcaso `sem_sessao` do `CT-715` é exatamente a ausência dela.
 */
async function pedirDocumento(
  credencial: string | undefined,
  codigo: string,
): Promise<RespostaDeDocumento> {
  const cabecalhos: Record<string, string> = { connection: 'close', origin: base };

  if (credencial !== undefined) {
    cabecalhos.cookie = credencial;
  }

  const resposta = await fetch(
    new URL(`${COLECAO_DE_CONTRATOS}/${codigo}/${SEGMENTO_DO_DOCUMENTO}`, base),
    { method: 'GET', headers: cabecalhos },
  );

  const bytes = new Uint8Array(await resposta.arrayBuffer());
  const tipoDeConteudo = resposta.headers.get('content-type') ?? '';

  return {
    status: resposta.status,
    // O parâmetro do tipo de mídia (`; charset=…`) é descartado: o que a ADR-0028 declara é o tipo,
    // e um `charset` acrescentado pelo adaptador não é divergência de contrato.
    tipoDeConteudo: (tipoDeConteudo.split(';')[0] ?? '').trim(),
    disposicao: resposta.headers.get('content-disposition') ?? '',
    bytes,
    corpo:
      tipoDeConteudo.includes('application/json') && bytes.byteLength > 0
        ? (JSON.parse(new TextDecoder().decode(bytes)) as unknown)
        : undefined,
  };
}

/** Os primeiros caracteres do corpo, para comparar com a assinatura do PDF. */
function textoInicialDe(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes.subarray(0, ASSINATURA_DO_PDF.length));
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
