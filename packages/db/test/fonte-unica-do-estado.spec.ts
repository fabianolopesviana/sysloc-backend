/**
 * A **fonte única do estado da cobrança** — a metade ESTRUTURAL do CA-04, provada por asserção
 * estática sobre os fontes e por introspecção do catálogo. T5 da fatia `cobranca-e-mora`, estendida
 * pela **T8** da fatia `regua-de-cobranca` com o eixo do RELÓGIO (`CT-612`) e o do ESCRITOR DE
 * CONTEXTO (`CT-624`).
 *
 * ---------------------------------------------------------------------------
 * INVARIANTES
 * ---------------------------------------------------------------------------
 *
 * | Critério | Caso   | Invariante |
 * |---|---|---|
 * | CA-04 | CT-510 | Os quatro rótulos de `negocio.status_cobranca` — `A_VENCER`, `VENCIDA`, `PAGA`
 * |       |        | e `CANCELADA` — não aparecem em posição EXECUTÁVEL em nenhum fonte de
 * |       |        | `packages/db/src/**`, `apps/api/src/**`, `packages/regua/src/**` nem
 * |       |        | `apps/worker/src/**`. O conjunto de arquivos que os carregam, varrido também
 * |       |        | sobre `packages/contracts/src/**`, é **EXATAMENTE**
 * |       |        | `['packages/contracts/src/cobranca.ts']` — igualdade de lista ordenada, nunca
 * |       |        | `toContain`. (ADR-0022, ADR-0023) |
 * | CA-05 | CT-612 | **Zero** leituras do relógio do PROCESSO (`new Date(`, `Date.now(`,
 * | CA-08 |        | `getHours(`, `getMinutes(`) em posição executável em `packages/regua/src/**` e
 * | CA-09 |        | em `apps/worker/src/tarefas/**`; e a consulta de elegibilidade
 * |       |        | (`selecionarCandidatasAoAviso`) tem `negocio.cobranca_derivada` como **única**
 * |       |        | origem de estado — nenhuma ocorrência de `negocio.cobranca` fora dela. |
 * | CA-12 | CT-624 | A lista ordenada de arquivos de PRODUÇÃO que chamam
 * |       |        | `contextoDeTenant.executarCom` é EXATAMENTE **quatro** — um por borda: a guarda
 * |       |        | HTTP de `apps/api`, as **duas** bordas de job de `apps/worker` e a borda do
 * |       |        | **ato do titular** (a rota sem sessão), todas sob a ADR-0024. E as duas
 * |       |        | listas vizinhas são igualmente declaradas: quem nomeia `app.empresa_id` em
 * |       |        | posição executável, e quem emite SQL sobre `identidade.empresa`. |
 * | CA-04 | CT-510 | `negocio.cobranca` **não tem** coluna `status`: a lista de colunas dela é
 * |       | (b)    | afirmada por igualdade, na ordem do catálogo. O estado não é coluna gravada, e
 * |       |        | é a **ausência da coluna** que impede a rotina que o legado tinha. |
 * | CA-04 | CT-510 | `negocio.cobranca_derivada` **tem** a coluna `status`, e o tipo dela é
 * |       | (c)    | `negocio.status_cobranca` — o enum publicado, e não `text`. A visão é o único
 * |       |        | lugar onde o estado existe. |
 * | CA-04 | CT-510 | **PROVA DE FALSIFICAÇÃO, permanente na suíte**: a MESMA varredura, aplicada a
 * |       | (d)    | uma cópia de `apps/api/src/cobrancas/cobranca.service.ts` com o ternário que
 * |       |        | recalcula `status` a partir de `pagoEm`/`canceladoEm`/`dataVencimento`,
 * |       |        | REPROVA nomeando o arquivo; aplicada ao fonte ÍNTEGRO, passa limpa. |
 * | CA-04 | CT-510 | A superfície publicada de `negocio.cobranca_derivada` é afirmada por
 * |       | (e)    | **igualdade de lista ordenada** contra as 31 colunas escritas à mão: ela
 * |       |        | publica `numero_do_titulo_no_provedor`, **não** publica `nosso_numero` e
 * |       |        | **não** publica `identificador_no_provedor`, que é interna. É a rede do
 * |       |        | `RENAME COLUMN` sobre a visão, que a T3 moveu para o **bloco 2** da parceira
 * |       |        | `0020_seguranca_webhook_e_carne.sql` — a rede vale onde quer que a instrução
 * |       |        | viva. (ADR-0001, `ancoras-de-superficie.md`) |
 *
 * Rastreabilidade: `CA-04 → CT-510 (RD-04)`. Acrescida pela T8 da fatia `regua-de-cobranca`:
 * `CA-05 → CT-612 (RD-06)` · `CA-08, CA-09 → CT-612 (RD-01)` · `CA-12 → CT-624 (RD-10)`.
 *
 * ===========================================================================
 * Por que esta prova é ESTÁTICA, e por que ela é indispensável
 * ===========================================================================
 *
 * A decisão central desta fatia é que **existe uma só avaliação do estado da cobrança**, e ela mora
 * na visão `negocio.cobranca_derivada` (ADR-0022, ADR-0023). O defeito de origem é medido: o sistema
 * antigo tem **três** avaliações divergentes do mesmo estado, a ponto de o envio manual cobrar por
 * uma dívida cancelada (golden `regua-de-cobranca.json`, cenário `cobranca_cancelada_e_vencida`).
 *
 * Uma segunda derivação escrita num serviço de aplicação **coincidiria com a da visão na esmagadora
 * maioria dos casos**, e atravessaria toda a suíte de rota sem uma recusa: a divergência só aparece
 * nas bordas — a virada do dia sob outro fuso, a cobrança cancelada que já venceu, a paga com atraso.
 * Nenhuma prova comportamental razoável a pega. O que a pega é a **ausência do literal**: não há como
 * decidir estado em TypeScript sem escrever um dos quatro rótulos, e é isso que este caso mede.
 *
 * É a rede que o marcador `DECISÃO FECHADA` de `../src/cobranca.ts` nomeia no próprio
 * `REVERTER EXIGE`, e é o que o P4 do Protocolo Antirregressão cobra de toda decisão fechada.
 *
 * ===========================================================================
 * Por que a igualdade é de LISTA ORDENADA, e não `toContain`
 * ===========================================================================
 *
 * `toContain` afirmaria que o arquivo de contratos está entre os que carregam os rótulos — e passaria
 * verde com um segundo, um terceiro, um décimo arquivo na lista. A igualdade exata é o que faz um
 * literal novo, em qualquer dos três pacotes varridos, reprovar **nomeando o arquivo**.
 *
 * Isso já aconteceu, e não é hipótese: na T4 desta mesma fatia, `ESTADOS_EM_ABERTO` fora declarada
 * dentro de `packages/db/src/cobranca.ts`, o que teria feito a lista real ser
 * `['packages/contracts/src/cobranca.ts', 'packages/db/src/cobranca.ts']`. O Gate 2 pegou isso
 * olhando para a especificação deste caso, e a constante foi movida para o pacote de contratos — onde
 * o consumidor passa a consumir um **nome** em vez de redigitar rótulos. **Acrescentar um arquivo à
 * lista esperada, ou trocar a igualdade por `toContain`, desfaz exatamente aquela correção.**
 *
 * ===========================================================================
 * O que conta como "posição executável"
 * ===========================================================================
 *
 * A varredura roda sobre o fonte **sem comentários** ({@link semComentarios}, do acessório comum), de
 * modo que a prosa que explica a decisão — e que cita os quatro rótulos por extenso, como o cabeçalho
 * de `../src/cobranca.ts` faz — não é confundida com código. Sem isso, a asserção reprovaria o código
 * correto pela explicação dele: é o defeito literal registrado em `.claude/rules/testing-stack.md`
 * (*"asserção que casava `ALTER ROLE` em comentário e mensagem de erro"*).
 *
 * O que resta é casado como **literal de cadeia** — o rótulo entre aspas simples, duplas ou crases —,
 * porque é essa a forma que um estado assume em TypeScript: numa comparação, num `switch`, num
 * ternário, ou dentro de um fragmento de SQL montado na aplicação. O acessório de varredura é
 * **reusado**, e não recopiado: cópias de um varredor divergem em silêncio, e um varredor que
 * divergiu passa a provar coisa diferente da que o caso afirma provar.
 *
 * Isso vale, com força maior, para o **detector**: o caso principal e o `CT-510 (d)` consomem o
 * mesmo {@link rotulosNaLinha} sobre o mesmo {@link semComentarios} — um como predicado, o outro
 * como coletor. Se o `(d)` tivesse detector próprio, a falsificação provaria que *aquele* detector
 * pega o mutante, e nada sobre a asserção que roda no disco; e é a asserção do disco que o caso
 * commita.
 *
 * ---------------------------------------------------------------------------
 * MUTANTE EXECUTADO sobre o SUT (2026-08-10) — o mutante reprovou os dois eixos
 * ---------------------------------------------------------------------------
 *
 * O `CT-510 (d)` prova a falsificação **dentro** da suíte, sobre uma cópia em memória. Falta a outra
 * metade, que a `.claude/rules/testing-stack.md` exige e que a cópia em memória sozinha não dá: que a
 * asserção **commitada** — a que lê os arquivos do disco — reprova o defeito no fonte real, e o
 * **nomeia**. Invocado pelo script do pacote (`pnpm --filter @sysloc/db test`), nunca por `vitest run`
 * avulso; controle: `104 passed`.
 *
 * Ele foi **reexecutado na rodada de correção**, depois de o detector passar a ser único
 * ({@link rotulosNaLinha}): mesmo resultado, `2 failed | 102 passed`, com o caso principal nomeando
 * `cobranca.service.ts:361, :363, :365, :366` e o `CT-510 (d)` recebendo os quatro rótulos onde
 * esperava lista vazia. A unificação do detector **não custou poder de detecção**.
 *
 *   * **M1 · a segunda derivação no serviço** — um método privado `estadoDe(linha, hoje)` acrescentado
 *     a `apps/api/src/cobrancas/cobranca.service.ts`, devolvendo `'CANCELADA'`, `'PAGA'`, `'VENCIDA'`
 *     ou `'A_VENCER'` a partir de `canceladoEm`, `pagoEm` e `dataVencimento` — a forma exata que um
 *     autor futuro escreveria por conveniência: `2 failed | 102 passed`. O caso principal reprovou
 *     nomeando as três linhas do arquivo (`cobranca.service.ts:358, :361, :364`) e a lista real
 *     passou a ter **dois** elementos contra o **um** esperado; o `CT-510 (d)` reprovou em paralelo,
 *     recebendo os quatro rótulos onde esperava lista vazia. Os dois eixos acusam por mecanismos
 *     diferentes — disco e memória —, e é o par que detecta;
 *   * **reversão** — o fonte foi restaurado do backup e conferido idêntico ao original por `diff -q`,
 *     e o controle voltou a `104 passed`.
 *
 * ===========================================================================
 * De onde vem o banco (ADR-0006)
 * ===========================================================================
 *
 * De uma instância efêmera própria, migrada, descartada ao fim. Nenhuma coordenada de conexão é lida
 * do ambiente — a suíte nunca toca o banco que atende a operação.
 */

import { readFile } from 'node:fs/promises';
import { relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { abrirConexao, type Sql } from '../src/conexao.ts';
import { type BancoMigrado, bancoEfemero } from './banco-efemero.ts';
import { diferencasDeConjunto } from './conjuntos.ts';
import {
  listarFontesTs,
  semComentarios,
  type VarreduraDeFontes,
  varrerArquivos,
} from './varredura-de-fontes.ts';

/** Subir a instância, provisionar papéis, migrar e semear leva dezenas de segundos nesta máquina. */
const LIMITE_SUBIDA_MS = 90_000;

/** Cada caso faz uma varredura de arquivos e poucas consultas ao catálogo. Teto folgado. */
const LIMITE_DO_CASO_MS = 60_000;

/** A raiz do repositório, para que os caminhos relatados sejam relativos e legíveis. */
const RAIZ_DO_REPOSITORIO = fileURLToPath(new URL('../../../', import.meta.url));

/**
 * Os **cinco** diretórios de fonte varridos.
 *
 * `packages/db/src` e `apps/api/src` são os alvos originais da proibição — são eles que leem
 * cobrança e são eles onde uma segunda derivação nasceria. `packages/contracts/src` entra porque é
 * lá que mora a **única** ocorrência legítima, e varrê-lo é o que transforma a asserção de *"não
 * existe em dois lugares"* em *"existe exatamente num"*: sem ele, a lista esperada seria vazia, e
 * uma varredura que não lesse arquivo nenhum passaria verde.
 *
 * ⚠️ **`packages/regua/src` e `apps/worker/src` entram na T8 da fatia `regua-de-cobranca`, e a
 * ausência deles seria um vão real, não uma formalidade**: o pacote da régua é justamente o lugar em
 * que a segunda derivação do estado nasceria por conveniência — ele decide *quem é avisado* — e a
 * borda do job é quem chama tudo. Sem estendê-los, o pacote novo ficaria **fora da guarda**, e o
 * caso seguiria verde afirmando uma propriedade sobre um conjunto que deixou de conter o suspeito.
 *
 * `packages/auth/src` e `packages/shared/src` ficam de fora porque não conhecem cobrança — incluí-los
 * alargaria o alvo sem acrescentar poder de detecção, e a §11.2 já os mantém sem alcance ao domínio.
 */
const DIRETORIOS_VARRIDOS: readonly string[] = [
  'packages/contracts/src',
  'packages/db/src',
  'packages/regua/src',
  'apps/api/src',
  'apps/worker/src',
];

/**
 * Os quatro rótulos de `negocio.status_cobranca`, escritos **por extenso**.
 *
 * Literais, e **não** importados de `ESTADOS_DA_COBRANCA`: derivá-los da mesma constante que o SUT
 * publica faria a asserção concordar consigo mesma — um quinto rótulo acrescentado ao enum passaria a
 * ser procurado automaticamente, e o caso deixaria de afirmar **quais** rótulos ele proíbe.
 */
const ROTULOS_DE_ESTADO: readonly string[] = ['A_VENCER', 'VENCIDA', 'PAGA', 'CANCELADA'];

/**
 * O conjunto EXATO de arquivos autorizados a carregar os rótulos em posição executável.
 *
 * Um só: a declaração do enum e a partição dos estados em aberto, que vivem lado a lado no módulo do
 * contrato. Ver o cabeçalho para por que esta lista não cresce.
 */
const FONTES_COM_ROTULO_ESPERADAS: readonly string[] = ['packages/contracts/src/cobranca.ts'];

/**
 * As colunas de `negocio.cobranca`, na ordem do catálogo — **`status` não está entre elas**.
 *
 * Escritas por extenso, e não derivadas de consulta alguma: é a igualdade contra esta lista que
 * transforma *"não tem `status`"* numa afirmação que também pega o **acréscimo** de qualquer outra
 * coluna de estado com outro nome. Uma asserção `not.toContain('status')` passaria verde sobre uma
 * coluna `situacao` gravada por rotina, que é o mesmo defeito com outro rótulo.
 *
 * As seis últimas são os campos de conciliação bancária, que nascem nulos e **só a F4** publica.
 *
 * A vigésima terceira, `identificador_no_provedor`, entrou pela migração `0017` (T2 da fatia
 * `emissao-e-conciliacao`) e é INTERNA: nenhum esquema de `@sysloc/contracts` a publica, e ela não é
 * coluna de estado — é a chave com que o SaaS se apresenta ao provedor, única GLOBALMENTE
 * (ADR-0033). Ela entra aqui porque a lista é comparada por igualdade contra o catálogo, e o
 * `ADD COLUMN` a põe no fim.
 */
const COLUNAS_DA_COBRANCA: readonly string[] = [
  'id',
  'empresa_id',
  'codigo',
  'contrato_id',
  'natureza',
  'referencia',
  'competencia',
  'data_vencimento',
  'valor_original',
  'pago_em',
  'valor_pago',
  'cancelado_em',
  'multa_aplicada',
  'juros_aplicados',
  'multa_percentual_aplicado',
  'juros_percentual_aplicado',
  'numero_do_titulo_no_provedor',
  'linha_digitavel',
  'codigo_barras',
  'data_credito',
  'valor_creditado',
  'boleto_arquivo',
  'identificador_no_provedor',
];

/**
 * As colunas de `negocio.cobranca_derivada`, na ordem do catálogo — a **superfície publicada** da
 * fonte única do estado.
 *
 * ⚠️ **Escritas à mão, e deliberadamente NÃO derivadas de {@link COLUNAS_DA_COBRANCA}.** A visão
 * expandiu `c.*` no instante em que a `0010` a criou, de modo que o conjunto dela e o da tabela
 * **divergiram de propósito**: `identificador_no_provedor`, acrescentada pela `0017`, é coluna
 * INTERNA e o cabeçalho da `0010` a mantém fora da superfície por escrito (*"a visão é superfície
 * publicada, e crescer por acidente é como um campo interno vaza"*). Compor esta lista a partir da
 * outra faria a asserção concordar com o que ela deveria vigiar.
 *
 * São 22 colunas herdadas da tabela como ela era na `0009` — com `nosso_numero` já renomeada para
 * `numero_do_titulo_no_provedor` pelo `RENAME COLUMN` da visão, que vive no **bloco 2** de
 * `0020_seguranca_webhook_e_carne.sql` — seguidas das 9 que a própria visão calcula, na ordem do
 * `SELECT`.
 *
 * É esta lista que dá rede àquela instrução. Ela nasceu na `0019`, e a T3 da fatia `webhook-e-carne`
 * a moveu para a `0020` **por causa desta rede**: o cabeçalho da `0019` declara que a regeração dele
 * é **esperada** (*"a supressão do `CREATE SCHEMA` é obrigatória a cada regeração"*), e uma regeração
 * sobrescreveria o trecho autoral **em silêncio**. A `0020` é integralmente autoral e nunca regerada.
 * A igualdade abaixo vale nos dois casos: sem ela, a visão voltaria a publicar `nosso_numero` sem
 * nenhuma asserção reprovar.
 */
const COLUNAS_DA_VISAO_DERIVADA: readonly string[] = [
  'id',
  'empresa_id',
  'codigo',
  'contrato_id',
  'natureza',
  'referencia',
  'competencia',
  'data_vencimento',
  'valor_original',
  'pago_em',
  'valor_pago',
  'cancelado_em',
  'multa_aplicada',
  'juros_aplicados',
  'multa_percentual_aplicado',
  'juros_percentual_aplicado',
  'numero_do_titulo_no_provedor',
  'linha_digitavel',
  'codigo_barras',
  'data_credito',
  'valor_creditado',
  'boleto_arquivo',
  'contrato_codigo',
  'locatario_id',
  'dias_atraso',
  'status',
  'valor_multa',
  'valor_juros',
  'multa_percentual_vigente',
  'juros_percentual_vigente',
  'valor_total',
];

/** O fonte do serviço de cobrança — o sujeito da prova de falsificação. */
const CAMINHO_DO_SERVICO = 'apps/api/src/cobrancas/cobranca.service.ts';

/**
 * O ternário que a falsificação injeta — a segunda derivação, escrita como um autor futuro a
 * escreveria por conveniência.
 *
 * Ele **não** é aplicado ao disco: a cópia mutante existe só em memória, e o que roda sobre ela é a
 * mesma função de detecção que roda sobre o fonte íntegro. Escrever no disco durante a suíte deixaria
 * resíduo se o processo morresse no meio, e o defeito ficaria no fonte.
 */
const SEGUNDA_DERIVACAO = `
    const status =
      linha.canceladoEm !== null
        ? 'CANCELADA'
        : linha.pagoEm !== null
          ? 'PAGA'
          : linha.dataVencimento < hoje
            ? 'VENCIDA'
            : 'A_VENCER';
`;

let banco: BancoMigrado;
let conexao: Sql;

beforeAll(async () => {
  banco = await bancoEfemero();
  conexao = abrirConexao(banco.cadeiaConexao, { maximoDeConexoes: 1 });
}, LIMITE_SUBIDA_MS);

afterAll(async () => {
  await conexao?.end();
  await banco?.parar();
}, LIMITE_SUBIDA_MS);

/**
 * Reconhece um rótulo de estado em **literal de cadeia**.
 *
 * As três aspas do TypeScript entram, porque as três produzem o mesmo literal. A expressão é composta
 * a partir de {@link ROTULOS_DE_ESTADO}, e não redigitada: a lista e o que se procura são o mesmo
 * fato. A bandeira `g` existe para {@link rotulosNaLinha} poder colher **todas** as ocorrências de
 * uma linha; ela é consumida só por `matchAll`, que opera sobre um clone e nunca move o `lastIndex`
 * desta constante.
 */
const LITERAL_DE_ESTADO = new RegExp(`(['"\`])(${ROTULOS_DE_ESTADO.join('|')})\\1`, 'g');

/**
 * Os rótulos de estado que uma linha carrega em posição executável, na ordem em que aparecem.
 *
 * **É o detector único deste arquivo**, e a unicidade é o ponto: o caso principal o consome como
 * predicado (`há rótulo nesta linha?`) e o `CT-510 (d)` o consome como coletor (`quais rótulos?`).
 * Duas implementações parecidas fariam a falsificação provar algo sobre a segunda, e não sobre a
 * asserção commitada — que é justamente o que o `(d)` existe para demonstrar.
 */
function rotulosNaLinha(linha: string): string[] {
  return [...linha.matchAll(LITERAL_DE_ESTADO)].map((achado) => achado[2] ?? '');
}

/** Os caminhos, relativos à raiz do repositório e em ordem, dos fontes que casam o predicado. */
function arquivosDe(ocorrencias: readonly string[]): string[] {
  return [
    ...new Set(
      ocorrencias.map((lugar) => relative(RAIZ_DO_REPOSITORIO, lugar.split(':')[0] ?? '')),
    ),
  ].sort();
}

describe('CT-510 — não existe segunda derivação do estado da cobrança', () => {
  it(
    'os quatro rótulos em posição executável estão em EXATAMENTE um fonte dos três pacotes varridos',
    async () => {
      const fontes: string[] = [];
      for (const diretorio of DIRETORIOS_VARRIDOS) {
        // Diretório ausente LEVANTA — é a decisão do acessório, e é ela que impede a cobertura de
        // cair a zero em silêncio quando um alvo é renomeado.
        fontes.push(...(await listarFontesTs(`${RAIZ_DO_REPOSITORIO}${diretorio}`)));
      }

      const varredura = await varrerArquivos(fontes, (linha) => rotulosNaLinha(linha).length > 0);

      // Âncora de não-vacuidade em valor EXATO: "nenhum literal fora do lugar" sobre zero arquivos
      // lidos é verdade vazia, e é assim que esta asserção apodreceria em silêncio.
      expect(varredura.arquivos).toBe(fontes.length);
      expect(varredura.arquivos).toBeGreaterThan(0);

      // A IGUALDADE de lista ordenada. Nunca `toContain` — ver o cabeçalho.
      expect(
        arquivosDe(varredura.ocorrencias),
        `literal de status_cobranca em posição executável fora do contrato: ${varredura.ocorrencias.join(', ')}`,
      ).toEqual([...FONTES_COM_ROTULO_ESPERADAS]);
    },
    LIMITE_DO_CASO_MS,
  );

  it(
    'CT-510 (b) — negocio.cobranca não tem coluna de estado, e a lista de colunas é afirmada inteira',
    async () => {
      const colunas = await conexao<{ nome: string }[]>`
        SELECT column_name AS nome
          FROM information_schema.columns
         WHERE table_schema = 'negocio' AND table_name = 'cobranca'
         ORDER BY ordinal_position
      `;

      expect(colunas.map((coluna) => coluna.nome)).toEqual([...COLUNAS_DA_COBRANCA]);
    },
    LIMITE_DO_CASO_MS,
  );

  it(
    'CT-510 (c) — negocio.cobranca_derivada tem status, e o tipo dele é o enum negocio.status_cobranca',
    async () => {
      const [status] = await conexao<{ tipo: string }[]>`
        SELECT udt_schema || '.' || udt_name AS tipo
          FROM information_schema.columns
         WHERE table_schema = 'negocio'
           AND table_name = 'cobranca_derivada'
           AND column_name = 'status'
      `;

      // Valor EXATO, e não "é definido": `text` também seria um tipo, e um `status` textual na visão
      // aceitaria o quinto rótulo que ninguém declarou.
      expect(status?.tipo).toBe('negocio.status_cobranca');
    },
    LIMITE_DO_CASO_MS,
  );

  it(
    'CT-510 (d) — a MESMA varredura REPROVA o serviço com a segunda derivação e passa no íntegro',
    async () => {
      const caminho = `${RAIZ_DO_REPOSITORIO}${CAMINHO_DO_SERVICO}`;
      const integro = await readFile(caminho, 'utf8');

      // CONTROLE: o fonte como ele está na árvore. Nenhum rótulo em posição executável.
      expect(rotulosExecutaveisDe(integro)).toEqual([]);

      // MUTANTE: o mesmo fonte com o ternário que recalcula o estado. A cópia vive em memória — ver
      // {@link SEGUNDA_DERIVACAO}. Um detector que devolvesse sempre `[]` passaria no controle e
      // reprovaria aqui; um que devolvesse sempre algo faria o contrário. Nenhum dos dois passa nos
      // dois.
      expect(rotulosExecutaveisDe(integro + SEGUNDA_DERIVACAO)).toEqual([
        'CANCELADA',
        'PAGA',
        'VENCIDA',
        'A_VENCER',
      ]);
    },
    LIMITE_DO_CASO_MS,
  );

  it(
    'CT-510 (e) — a superfície da visão é afirmada inteira, e ela publica o número do título pelo nome do produto',
    async () => {
      const colunas = await conexao<{ nome: string }[]>`
        SELECT column_name AS nome
          FROM information_schema.columns
         WHERE table_schema = 'negocio' AND table_name = 'cobranca_derivada'
         ORDER BY ordinal_position
      `;

      const observadas = colunas.map((coluna) => coluna.nome);

      // A IGUALDADE de lista ordenada é a rede do `ALTER TABLE … RENAME COLUMN` sobre a visão —
      // hoje no bloco 2 da `0020`, para onde a T3 o moveu. Ela fecha as TRÊS afirmações de uma vez,
      // e cada uma reprova sozinha:
      //
      //   * a visão publica `numero_do_titulo_no_provedor` — se aquela instrução sumir, o catálogo
      //     devolve `nosso_numero` na posição 17 e a igualdade reprova nomeando as duas colunas;
      //   * `nosso_numero` NÃO está mais na superfície — vocabulário do provedor em coluna publicada
      //     é o que o `D14 · F4/T6` existia para fechar (ADR-0001);
      //   * `identificador_no_provedor` continua AUSENTE — é a coluna interna que a `0017`
      //     acrescentou à TABELA e que o cabeçalho da `0010` mantém fora da superfície. Era a
      //     alegação com que se justificou o `RENAME` em vez de recriar a visão com `c.*`, e até
      //     aqui ela vivia só em prosa. Recriada com `c.*`, ela apareceria no fim da lista e esta
      //     igualdade reprovaria.
      //
      // Lista ordenada, e não `toContain`: contenção aprovaria tanto a coluna que sumiu quanto a que
      // apareceu sem ninguém decidir (`.claude/rules/ancoras-de-superficie.md`). A comparação contra
      // 31 nomes é antivácua por construção — catálogo consultado no schema errado devolve `[]`.
      expect(
        observadas,
        `superfície de negocio.cobranca_derivada divergiu: ${JSON.stringify(
          diferencasDeConjunto(observadas, COLUNAS_DA_VISAO_DERIVADA),
        )}`,
      ).toEqual([...COLUNAS_DA_VISAO_DERIVADA]);
    },
    LIMITE_DO_CASO_MS,
  );
});

/**
 * Os rótulos de estado em posição executável de um fonte, na ordem em que aparecem.
 *
 * É a **mesma** leitura do caso principal, e agora no sentido literal: os dois tiram os comentários
 * com o mesmo {@link semComentarios}, quebram o resultado em linhas e aplicam o mesmo
 * {@link rotulosNaLinha}. A única diferença é a origem do texto — aqui uma cadeia em memória, lá o
 * arquivo que {@link varrerArquivos} lê do disco. Ter as duas metades saindo do mesmo detector é o
 * que faz a falsificação provar algo sobre a **asserção commitada**, e não sobre uma segunda
 * implementação parecida com ela.
 */
function rotulosExecutaveisDe(fonte: string): string[] {
  return semComentarios(fonte)
    .split('\n')
    .flatMap((linha) => rotulosNaLinha(linha));
}

// ===========================================================================
// CT-612 — o relógio da operação mora no banco, e o predicado lê a VIEW
// ===========================================================================

/**
 * ⚠️ **Este é o caso mais importante da fatia, e a razão é o modo de falha do defeito que ele pega.**
 *
 * `dentroDaJanela` (em `@sysloc/regua`) é **pura** e recebe o `HH:MM` **por parâmetro**. A
 * consequência é dura: **nenhum caso comportamental pode pegar um erro na ORIGEM desse parâmetro**.
 * Trocar `lerHoraCorrenteDaOperacao(tx)` por `new Date().getHours()` na borda do job **passa em toda
 * a suíte** — o host está em `America/Sao_Paulo`, e as duas leituras coincidem. O defeito só
 * aparece no dia em que o processo rodar sob outro fuso: `TZ` **não é declarada por nenhuma das duas
 * unidades systemd**, e sob UTC a régua dispararia três horas fora da janela que a imobiliária
 * configurou, sem uma linha vermelha em lugar nenhum (ADR-0026).
 *
 * Esta asserção estática é a **única** rede desse defeito. O que ela mede é a **ausência** das
 * quatro formas pelas quais o relógio do processo é lido em TypeScript, em posição executável, nos
 * dois lugares onde a decisão de tempo poderia ser tomada.
 *
 * ---------------------------------------------------------------------------
 * MUTANTE EXECUTADO sobre o SUT (2026-08-12) — o mutante do relógio
 * ---------------------------------------------------------------------------
 *
 * Além da falsificação PERMANENTE na suíte (o `CT-612 (b)`, com as duas pernas sobre uma cópia em
 * memória), o defeito foi reintroduzido **no fonte de produção** e medido. Invocado pelo **script do
 * pacote** (`pnpm --filter @sysloc/db test`), nunca por `vitest run` avulso; controle: `143 passed`.
 *
 *   * **M-RELOGIO · a hora vinda do processo** — em `apps/worker/src/tarefas/regua.ts`, o import de
 *     `lerHoraCorrenteDaOperacao` removido e a leitura trocada por uma função local que compõe o
 *     `HH:MM` a partir de `new Date()`, `getHours()` e `getMinutes()` — a forma exata que um autor
 *     futuro escreveria por conveniência, e que **compila**. Resultado: `2 failed | 141 passed`,
 *     com o caso principal nomeando as três linhas ofensoras da borda e o `CT-612 (b)` recebendo
 *     `['new Date(', 'getHours(', 'getMinutes(']` onde esperava lista vazia;
 *   * **a outra metade da medição, e é ela que justifica este caso existir**: com o MESMO mutante
 *     aplicado, `pnpm --filter @sysloc/worker test` devolveu **`32 passed`** — a suíte
 *     comportamental inteira, com fila e banco reais, **verde**. O defeito acerta por acidente
 *     porque o host está em `America/Sao_Paulo`. Nenhum outro caso do repositório o pega;
 *   * **reversão** — o fonte foi restaurado do backup e conferido por `sha256sum -c` contra o
 *     estado pré-mutante, e o controle voltou a `143 passed`.
 *
 * ---------------------------------------------------------------------------
 * MUTANTE EXECUTADO sobre o SUT (2026-08-12) — a segunda origem de estado
 * ---------------------------------------------------------------------------
 *
 *   * **M-VIEW · o predicado lendo a tabela crua** — em `packages/db/src/envio-de-cobranca.ts`, o
 *     `FROM negocio.cobranca_derivada cd` do predicado trocado por `FROM negocio.cobranca cd`.
 *     Resultado: `11 failed | 132 passed`, com o `CT-612 (c)` reprovando pela **perna positiva** —
 *     `expected 'export async function selecionarCandi…' to contain 'negocio.cobranca_derivada'` —,
 *     que é o modo de falha desejado: o recorte por símbolo continuou funcionando e o que sumiu foi
 *     a citação da visão. Aqui, diferente do mutante do relógio, os casos comportamentais **também**
 *     reprovam, porque a tabela crua não publica `status` nem `valor_total`;
 *   * **reversão** — restaurado do backup e conferido por `sha256sum -c`.
 */

/** Os diretórios onde a decisão de tempo poderia ser tomada, e onde ela é proibida. */
const DIRETORIOS_SEM_RELOGIO_DE_PROCESSO: readonly string[] = [
  'packages/regua/src',
  'apps/worker/src/tarefas',
];

/**
 * As quatro formas de ler o relógio do processo, escritas **por extenso**.
 *
 * Literais, e não derivadas de nada: é esta lista que declara **o que** o caso proíbe, e o detector
 * abaixo é composto a partir dela — a lista e o que se procura são o mesmo fato.
 */
const LEITURAS_DO_RELOGIO_DO_PROCESSO: readonly string[] = [
  'new Date(',
  'Date.now(',
  'getHours(',
  'getMinutes(',
];

/** O detector, composto a partir da lista acima — ver {@link LEITURAS_DO_RELOGIO_DO_PROCESSO}. */
const LEITURA_DE_RELOGIO = new RegExp(
  LEITURAS_DO_RELOGIO_DO_PROCESSO.map((forma) =>
    forma.replace(/[.()[\]{}*+?^$|\\]/g, (caractere) => `\\${caractere}`),
  ).join('|'),
);

/** O fonte da borda do job — o sujeito da falsificação do eixo do relógio. */
const CAMINHO_DA_BORDA_DO_JOB = 'apps/worker/src/tarefas/regua.ts';

/**
 * O defeito literal que a falsificação injeta: a hora saindo do relógio do PROCESSO.
 *
 * É a forma exata que um autor futuro escreveria por conveniência — ela é mais curta que a chamada
 * ao banco, não precisa de `tx`, e produz o mesmo resultado nesta máquina.
 */
const RELOGIO_DO_PROCESSO_REINTRODUZIDO = [
  '',
  'function horaCorrenteDoProcesso(): string {',
  '  const agora = new Date();',
  '  const hora = agora.getHours();',
  '  const minuto = agora.getMinutes();',
  '',
  '  return String(hora) + String(minuto);',
  '}',
  '',
].join('\n');

/** O fonte do predicado de elegibilidade — o segundo eixo do CT-612. */
const CAMINHO_DO_PREDICADO = 'packages/db/src/envio-de-cobranca.ts';

/**
 * Os símbolos cujos corpos são auditados. A âncora é SIMBÓLICA, nunca número de linha.
 *
 * SUT_IS_CORRECT_BECAUSE: a lista tinha **um** elemento porque, até a T9, o predicado era a única
 * consulta que lia estado de cobrança neste módulo. A **T10** acrescenta `localizarCandidataAoAviso`
 * — a leitura do **disparo manual** —, e ela é exatamente a segunda consulta que o `CT-612 (c)`
 * existe para vigiar: se ela lesse `negocio.cobranca` em vez da visão, o caminho manual voltaria a
 * avaliar o estado por conta própria, que é o defeito de origem do legado (REG-08). O caso **não foi
 * afrouxado** — ele passou a correr, com as três mesmas asserções, sobre **cada** símbolo da lista, e
 * a perna positiva de cada um continua exigindo a citação da visão. **Nenhuma entrada anterior saiu.**
 *
 * ⚠️ A T10 tentou extrair o `FROM` e as quatro junções das duas consultas para um fragmento comum, e
 * **reverteu**: a extração tirava a citação da visão do corpo recortado aqui e deixava esta asserção
 * cega, que é regressão de prova (R2) com o SQL correto. A duplicação das quatro junções é o preço
 * declarado dessa rede — ver o docblock de `localizarCandidataAoAviso`.
 */
const SIMBOLOS_COM_ESTADO_DA_COBRANCA = [
  'selecionarCandidatasAoAviso',
  'localizarCandidataAoAviso',
] as const;

/** A visão que publica o estado — a fonte única (ADR-0022). */
const VISAO_DO_ESTADO = 'negocio.cobranca_derivada';

/**
 * A tabela crua, e **não** a visão — o que o predicado não pode citar como origem de estado.
 *
 * A âncora negativa `(?!_derivada)` é o mecanismo: sem ela, a própria visão casaria e a asserção
 * reprovaria o código correto. `negocio.envio_de_cobranca` **não** casa — o caractere antes de
 * `cobranca` ali é `_`, e não `.` —, e é isso que permite o predicado juntar o histórico sem virar
 * culpado.
 */
const TABELA_CRUA_DE_COBRANCA = /negocio\.cobranca(?!_derivada)/g;

/**
 * O corpo do predicado, isolado do resto do módulo e já sem comentários.
 *
 * O recorte vai da declaração do símbolo até a próxima declaração exportada — a âncora é o **nome**,
 * e não a posição, justamente porque a posição se move na primeira edição do arquivo. Um recorte que
 * falhasse produziria corpo sem a visão, e a perna positiva do caso reprovaria em vez de passar em
 * silêncio.
 */
function corpoDoPredicado(fonte: string, simbolo: string): string {
  const semProsa = semComentarios(fonte);
  const inicio = semProsa.indexOf(`export async function ${simbolo}`);

  if (inicio < 0) {
    throw new Error(`${simbolo} não foi encontrado em ${CAMINHO_DO_PREDICADO}`);
  }

  const seguinte = semProsa.indexOf('\nexport ', inicio + 1);

  return seguinte < 0 ? semProsa.slice(inicio) : semProsa.slice(inicio, seguinte);
}

describe('CT-612 — a régua consulta a fonte única e não lê o relógio do processo', () => {
  it(
    'CT-612 — zero leituras do relógio do processo na régua e na borda do job',
    async () => {
      const fontes: string[] = [];
      for (const diretorio of DIRETORIOS_SEM_RELOGIO_DE_PROCESSO) {
        // Diretório ausente LEVANTA — é a decisão do acessório, e é ela que impede a cobertura de
        // cair a zero em silêncio quando um alvo é renomeado.
        fontes.push(...(await listarFontesTs(`${RAIZ_DO_REPOSITORIO}${diretorio}`)));
      }

      const varredura = await varrerArquivos(fontes, (linha) => LEITURA_DE_RELOGIO.test(linha));

      // Âncora de não-vacuidade em valor EXATO: "nenhuma leitura de relógio" sobre zero arquivos
      // lidos é verdade vazia, e é assim que esta asserção apodreceria em silêncio.
      expect(varredura.arquivos).toBe(fontes.length);
      expect(varredura.arquivos).toBeGreaterThan(0);

      expect(
        varredura.ocorrencias.map((lugar) => relative(RAIZ_DO_REPOSITORIO, lugar)),
        `leitura do relógio do processo onde a hora tem de vir do banco (ADR-0026): ${varredura.linhas.join(' | ')}`,
      ).toEqual([]);
    },
    LIMITE_DO_CASO_MS,
  );

  it(
    'CT-612 (b) — a MESMA varredura REPROVA a borda com o relógio do processo e passa no íntegro',
    async () => {
      const caminho = `${RAIZ_DO_REPOSITORIO}${CAMINHO_DA_BORDA_DO_JOB}`;
      const integro = await readFile(caminho, 'utf8');

      // CONTROLE: o fonte como ele está na árvore. Nenhuma leitura de relógio em posição executável.
      expect(leiturasDeRelogioDe(integro)).toEqual([]);

      // MUTANTE: o mesmo fonte com a hora saindo do processo. A cópia vive em memória — escrever no
      // disco durante a suíte deixaria o defeito no fonte se o processo morresse no meio. Um
      // detector que devolvesse sempre `[]` passaria no controle e reprovaria aqui; um que
      // devolvesse sempre algo faria o contrário. Nenhum dos dois passa nos dois.
      expect(leiturasDeRelogioDe(integro + RELOGIO_DO_PROCESSO_REINTRODUZIDO)).toEqual([
        'new Date(',
        'getHours(',
        'getMinutes(',
      ]);
    },
    LIMITE_DO_CASO_MS,
  );

  it(
    'CT-612 (c) — as consultas de estado da cobrança têm a VIEW como única origem',
    async () => {
      const fonte = await readFile(`${RAIZ_DO_REPOSITORIO}${CAMINHO_DO_PREDICADO}`, 'utf8');

      // A varredura corre sobre CADA símbolo que lê estado de cobrança neste módulo, e não sobre um
      // só: o disparo manual e a passagem automática precisam ler a MESMA fonte, e é a unicidade —
      // não uma guarda escrita na régua — que torna impossível os dois discordarem (REG-08).
      for (const simbolo of SIMBOLOS_COM_ESTADO_DA_COBRANCA) {
        const corpo = corpoDoPredicado(fonte, simbolo);

        // A perna POSITIVA: a consulta cita a visão. Sem ela, "não cita a tabela crua" seria
        // verdade vazia sobre um recorte que falhou.
        expect(corpo, simbolo).toContain(VISAO_DO_ESTADO);

        // A perna NEGATIVA: nenhuma ocorrência de `negocio.cobranca` que não seja a visão. A junção
        // com `negocio.envio_de_cobranca`, que o predicado faz, não casa — ver o detector.
        expect(
          [...corpo.matchAll(TABELA_CRUA_DE_COBRANCA)].map((achado) => achado[0]),
          simbolo,
        ).toEqual([]);

        // MUTANTE, sobre o corpo REAL: trocar a visão pela tabela crua é o defeito de origem do
        // legado — a segunda avaliação do estado, que coincidiria com a da visão na quase totalidade
        // dos casos e atravessaria a suíte comportamental sem uma recusa.
        const comTabelaCrua = corpo.replaceAll(VISAO_DO_ESTADO, 'negocio.cobranca');

        expect(
          [...comTabelaCrua.matchAll(TABELA_CRUA_DE_COBRANCA)].map((achado) => achado[0]),
          simbolo,
        ).toEqual(['negocio.cobranca']);
      }
    },
    LIMITE_DO_CASO_MS,
  );
});

/** As formas de leitura de relógio em posição executável de um fonte, na ordem em que aparecem. */
function leiturasDeRelogioDe(fonte: string): string[] {
  const global = new RegExp(LEITURA_DE_RELOGIO.source, 'g');

  return [...semComentarios(fonte).matchAll(global)].map((achado) => achado[0]);
}

// ===========================================================================
// CT-624 — o escritor de contexto continua único POR BORDA (ADR-0024)
// ===========================================================================

/**
 * O que este caso acrescenta ao `CT-014` de `unidade-de-trabalho.spec.ts`, e por que os dois existem.
 *
 * O `CT-014` audita o **mesmo símbolo** por outro eixo: ele descobre os alvos no disco, percorrendo
 * todo pacote de `apps/` e `packages/` que tenha `src/`, e é isso que faz um **pacote novo** entrar
 * na auditoria sem que ninguém se lembre de acrescentá-lo. Ele é a rede da topologia.
 *
 * Este caso é a rede da **decisão**: ele fixa o elenco por borda que a ADR-0024 declara, sobre os
 * quatro diretórios em que a fatia da régua escreve, e — o que o `CT-014` não faz — audita junto as
 * **duas listas vizinhas** sem as quais a afirmação "o contexto tem escritor único" é contornável
 * por outro caminho:
 *
 * 1. quem nomeia `app.empresa_id` em posição executável — porque escrever a variável de sessão à
 *    mão estabelece contexto **sem passar pelo escritor**, e nenhuma varredura por `executarCom`
 *    veria isso;
 * 2. quem emite SQL sobre `identidade.empresa` — porque a enumeração de tenants é, pela ADR-0024, a
 *    **única** leitura legítima sem contexto de empresa, e ela vive no schema sem noção de tenant
 *    (ADR-0009). Uma borda de trabalho que a consultasse por si passaria a escolher empresas em vez
 *    de recebê-las.
 *
 * Perder qualquer um dos dois casos deixaria um dos eixos sem oráculo. Eles não se substituem.
 *
 * ---------------------------------------------------------------------------
 * MUTANTES EXECUTADOS sobre o SUT (2026-08-12) — os dois caminhos de contorno
 * ---------------------------------------------------------------------------
 *
 * Asserção estática ⇒ prova de falsificação obrigatória. Invocados pelo **script do pacote**
 * (`pnpm --filter @sysloc/db test`), nunca por `vitest run` avulso; controle: `143 passed`.
 * Os dois foram aplicados **juntos**, e cada um reprovou o seu eixo:
 *
 *   * **M1 · o terceiro escritor** — `export function sobOutraEmpresa(…)` acrescentada a
 *     `apps/worker/src/tarefas/eco.ts`, chamando `contextoDeTenant.executarCom`. Reprovou o caso
 *     principal **nomeando o arquivo e a linha** (`…/apps/worker/src/tarefas/eco.ts:77`), com a
 *     lista real de **três** elementos contra os dois esperados. Reprovou também o `CT-014` de
 *     `unidade-de-trabalho.spec.ts`, que audita o mesmo símbolo pelo eixo da topologia — os dois
 *     acusam por caminhos diferentes, e é o par que detecta;
 *   * **M2 · o `SET LOCAL` escrito à mão** — `export async function fixarContextoNaMao(…)`
 *     acrescentada a `apps/worker/src/tarefas/regua.ts`, compondo a fixação por `tx.unsafe`.
 *     **Nenhuma varredura por `executarCom` o vê** — e foi exatamente esse o resultado: o caso
 *     principal não o acusou, e quem o acusou foi o `CT-624 (b)`, nomeando
 *     `…/apps/worker/src/tarefas/regua.ts:242` com a lista de **quatro** elementos contra os três
 *     esperados. É a demonstração de que os dois eixos não são redundantes;
 *   * a soma foi `4 failed | 139 passed`, e o `CT-624 (c)` entrou entre as reprovações pela sua
 *     perna de **controle** — o fonte da borda deixou de estar limpo —, o que mostra que aquele
 *     controle não é vácuo;
 *   * **reversão** — os dois fontes foram restaurados do backup e conferidos por `sha256sum -c`
 *     contra o estado pré-mutante, e o controle voltou a `143 passed`.
 */

/** Os quatro diretórios de produção que a fatia da régua alcança. */
const DIRETORIOS_DE_PRODUCAO_DA_REGUA: readonly string[] = [
  'apps/api/src',
  'apps/worker/src',
  'packages/db/src',
  'packages/regua/src',
];

/**
 * A CHAMADA ao escritor, e não a declaração.
 *
 * `export function executarCom<T>(…` traz `<T>` entre o nome e o parêntese e **não** casa — é a
 * mesma discriminação que o `CT-014` usa, e a perna de controle abaixo a prova sobre o arquivo real.
 */
const CHAMADA_AO_ESCRITOR_DE_CONTEXTO = /\bexecutarCom\s*\(/;

/**
 * **Um escritor por borda** — o elenco que a ADR-0024 declara, por igualdade.
 *
 * Três, e a razão de cada um está escrita ao lado. Um quarto reprova nomeando o arquivo: é o
 * modo de falha desejado, porque o defeito que a ADR-0008 declara impossível de pegar por revisão
 * nasce assim — *"um por vez, cada um legítimo quando foi escrito"*.
 *
 * SUT_IS_CORRECT_BECAUSE: a lista tinha duas bordas porque o processo consumia **uma** fila de
 * negócio; a T10 da fatia `documentos-e-confirmacao` acrescenta a borda da entrega da confirmação,
 * que é uma tarefa de fila como a da régua e estabelece o contexto pela mesma regra da ADR-0024 —
 * `contextoDeTenant.executarCom({ empresaId }, …)`, uma vez, com o `empresaId` da carga já conferido
 * por esquema. A asserção **não foi afrouxada**: ela continua sendo igualdade de conjunto, e um
 * quarto arquivo — ou o mesmo escritor chamado de um serviço em vez de uma borda — segue reprovando
 * nominalmente.
 *
 * SUT_IS_CORRECT_BECAUSE: a lista tinha três bordas porque toda execução do produto ou nascia de uma
 * requisição **autenticada**, ou de uma tarefa da fila; a T11 da fatia `documentos-e-confirmacao`
 * acrescenta a quarta — o **ato do titular**, a única rota de negócio sem sessão (ADR-0027). Ela é
 * borda pelo mesmo discriminador das outras três: o contexto é estabelecido **uma vez**, no ponto em
 * que o pedido entra, a partir de um identificador que a própria borda **descobriu** (o registro que
 * o portador resolve) e que nenhuma camada abaixo dela reescreve. O que ela NÃO é: um serviço
 * abrindo contexto próprio no meio de um fluxo já contextualizado — não há sessão nem carga que
 * pudesse tê-lo aberto antes, e é justamente essa ausência que a ADR-0024 endereça. A asserção **não
 * foi afrouxada**: continua sendo igualdade de conjunto, e um quinto arquivo segue reprovando
 * nominalmente.
 *
 * SUT_IS_CORRECT_BECAUSE: a lista tinha quatro bordas porque o processo de trabalho consumia **duas**
 * filas de negócio; a T16 da fatia `emissao-e-conciliacao` acrescenta as duas da cobrança bancária —
 * a emissão em lote e a conferência —, e cada uma é borda pelo **mesmo** discriminador das anteriores:
 * a tarefa chega do servidor de fila, o `empresaId` vem da carga **já conferida por `strictObject`
 * antes de qualquer leitura**, e o contexto é aberto UMA vez, pelo mesmo escritor único, sem que nada
 * abaixo o reescreva (ADR-0024 / ADR-0029). O que elas NÃO são: serviços abrindo contexto próprio — o
 * domínio que elas orquestram (`@sysloc/cobranca-bancaria`) não conhece banco, não importa
 * `@sysloc/db` e recebe todas as portas por parâmetro (ADR-0025). A asserção **não foi afrouxada**:
 * continua sendo igualdade de conjunto, e um sétimo arquivo segue reprovando nominalmente.
 *
 * ---------------------------------------------------------------------------
 * MUTANTE EXECUTADO — a borda nova FORA das duas listas (2026-08-13)
 * ---------------------------------------------------------------------------
 *
 * A entrada acrescentada é asserção estática, e a `.claude/rules/testing-stack.md` cobra a prova de
 * falsificação. Ela foi medida pelo **script do pacote** (`pnpm --filter @sysloc/db test`), nunca por
 * `vitest run` avulso:
 *
 *   * **mutante** — a linha de `apps/api/src/confirmacoes/confirmacao.service.ts` retirada desta
 *     lista **e** de {@link ../unidade-de-trabalho.spec.ts CHAMADORES_LEGITIMOS}, com o fonte de
 *     produção intacto: `2 failed | 165 passed`, e as duas falhas **nomeiam o arquivo e a linha** —
 *     `…/confirmacoes/confirmacao.service.ts:177`. É o modo de falha desejado: a borda nova não passa
 *     despercebida por nenhuma das duas âncoras;
 *   * **controle** — as duas listas restauradas do backup: `167 passed`, com o `git diff` das duas
 *     conferido contra o estado revisado.
 */
const BORDAS_QUE_ESCREVEM_CONTEXTO: readonly string[] = [
  // A borda HTTP: a empresa vem da sessão autenticada.
  'apps/api/src/autenticacao/contexto.guard.ts',
  // A borda do trabalho enfileirado: a empresa vem da carga do próprio trabalho (ADR-0024).
  'apps/worker/src/tarefas/regua.ts',
  // A borda da entrega da confirmação de endereço: mesma regra, mesma carga como origem (ADR-0024).
  'apps/worker/src/tarefas/confirmacao-de-email.ts',
  // A borda do ATO DO TITULAR: a empresa vem do registro que o portador de segredo resolve, e a
  // resolução acontece **fora** de contexto de propósito — a empresa é o resultado dela, não a
  // entrada (ADR-0027 + ADR-0024). É a única borda do produto sem sessão nem carga de fila.
  'apps/api/src/confirmacoes/confirmacao.service.ts',
  // As duas bordas da COBRANÇA BANCÁRIA (T16 da fatia `emissao-e-conciliacao`): a empresa vem da
  // carga do próprio trabalho, como nas duas irmãs de fila acima. O que é próprio delas é o que a
  // carga **não** leva — nem material, nem senha, nem envelope cifrado (ADR-0032): o certificado é
  // resolvido pelo banco **sob este mesmo contexto**, e é por isso que a ordem "recusa primeiro,
  // contexto depois" importa aqui mais do que em qualquer outra borda.
  'apps/worker/src/tarefas/emissao-em-lote.ts',
  'apps/worker/src/tarefas/conferencia-bancaria.ts',
  // A borda do TRATAMENTO DA NOTÍCIA recebida do provedor (T7 da fatia `webhook-e-carne`): a
  // primeira em que a empresa **não vem da carga**. Ela vem do registro que o roteamento resolve —
  // a segunda origem legítima da ADR-0024, cujo alcance a terceira emenda dela (2026-08-18) declara
  // —, e as duas leituras que a precedem correm **fora** de contexto de propósito: o cru, porque a
  // tabela não tem dono-empresa (ADR-0031); e o roteamento, porque a empresa é o **resultado** dele e
  // a função de banco não tem por onde recebê-la. Nada do recebido escolhe o tenant, que é a terceira
  // *Alternativa rejeitada* da ADR-0035.
  'apps/worker/src/tarefas/notificacao-bancaria.ts',
].sort();

/** A variável de sessão que as políticas de `negocio` consultam. */
const VARIAVEL_DE_CONTEXTO = 'app.empresa_id';

/**
 * Quem pode **nomear** a variável de sessão em posição executável — elenco declarado, por igualdade.
 *
 * ⚠️ São **três**, e a medição é o que fixa o número: a especificação desta task previa *"exatamente
 * um"*, e a árvore refuta — dois dos três não a **fixam**, eles a **leem** ou a usam para semear.
 * O que a igualdade protege é o que importa: nenhum arquivo de `apps/worker/src/**` nem de
 * `packages/regua/src/**` a nomeia, e portanto nenhuma borda nova estabelece contexto por fora do
 * escritor. Estreitar esta lista para um sem mover o código faria a asserção reprovar a árvore
 * íntegra; alargá-la exige escrever por quê, aqui, ao lado do arquivo.
 */
const FONTES_QUE_NOMEIAM_A_VARIAVEL_DE_CONTEXTO: readonly string[] = [
  // Quem a FIXA — o único, e sob duas `DECISÃO FECHADA`.
  'packages/db/src/unidade-de-trabalho.ts',
  // Quem a LÊ, para compor a expressão de `empresa_id` das escritas.
  'packages/db/src/contexto-de-escrita.ts',
  // A carga inicial da verificação, que semeia vínculos sob o contexto de cada empresa.
  'packages/db/src/semente.ts',
].sort();

/** O schema sem noção de tenant, onde a enumeração de empresas vive (ADR-0009). */
const TABELA_DE_EMPRESAS = 'identidade.empresa';

/**
 * Quem pode emitir SQL sobre `identidade.empresa` — elenco declarado, por igualdade.
 *
 * Os dois vivem em `@sysloc/db`, que é a porta única de acesso a dado: a leitura sem contexto de
 * empresa fica confinada ao pacote que a publica, e nem a borda do job nem o domínio da régua
 * alcançam a tabela. É o que faz o `empresaId` **chegar** ao trabalho em vez de ser escolhido por
 * ele.
 */
const FONTES_QUE_LEEM_EMPRESAS: readonly string[] = [
  'packages/db/src/empresa.ts',
  'packages/db/src/semente.ts',
].sort();

/** A fixação escrita à mão — o segundo mutante, e o caminho que contorna o escritor. */
const FIXACAO_ESCRITA_A_MAO = [
  '',
  'export async function fixarContextoNaMao(tx: TransactionSql, empresaId: string): Promise<void> {',
  '  await tx.unsafe("SET LOCAL app.empresa_id = " + empresaId);',
  '}',
  '',
].join('\n');

/**
 * A chamada EXCEDENTE ao escritor — o primeiro mutante.
 *
 * O nome não fixa ordinal de propósito: a terceira chamada é **legítima** desde a T10 da fatia
 * `documentos-e-confirmacao` (a borda da confirmação de e-mail), e um identificador que a nomeasse
 * passaria a descrever o mundo anterior a cada borda nova. O que o mutante é — e sempre foi — é uma
 * chamada **a mais** num arquivo que já é borda, que é o caminho por onde o contexto voltaria a ser
 * estabelecido fora do escritor único.
 */
const CHAMADA_EXCEDENTE_AO_ESCRITOR = [
  '',
  'export function sobOutraEmpresa<T>(empresaId: string, trabalho: () => T): T {',
  '  return contextoDeTenant.executarCom({ empresaId }, trabalho);',
  '}',
  '',
].join('\n');

describe('CT-624 — o escritor de contexto é único por borda, e as duas listas vizinhas também', () => {
  it(
    'CT-624 — os arquivos de produção que chamam `executarCom` são EXATAMENTE as seis bordas',
    async () => {
      const varredura = await varrerFontesDaRegua(CHAMADA_AO_ESCRITOR_DE_CONTEXTO);

      expect(
        arquivosDe(varredura.ocorrencias),
        `chamada ao escritor de contexto fora das bordas declaradas: ${varredura.ocorrencias.join(', ')}`,
      ).toEqual([...BORDAS_QUE_ESCREVEM_CONTEXTO]);

      // Igualdade de LISTA, e não `toContain`: `toContain` passaria verde com um quinto, um
      // sexto e um décimo escritor. E as quatro bordas continuam PRESENTES — uma lista que
      // encolhesse (a guarda deixando de abrir contexto, por exemplo) reprova aqui do mesmo jeito.
      //
      // SUT_IS_CORRECT_BECAUSE: a contagem literal era `2` porque havia duas bordas; a T10 da fatia
      // `documentos-e-confirmacao` acrescenta a terceira — a entrega da confirmação de endereço,
      // que é trabalho enfileirado e estabelece o contexto pela ADR-0024, como a da régua. A
      // asserção **não foi afrouxada**: continua sendo contagem EXATA ao lado da igualdade de lista
      // acima, e a razão de cada borda está escrita em `BORDAS_QUE_ESCREVEM_CONTEXTO`.
      //
      // SUT_IS_CORRECT_BECAUSE: a **T11** da mesma fatia acrescenta a quarta — a borda do **ato do
      // titular**, que abre o contexto a partir do registro que o portador de segredo resolve, sem
      // sessão e sem carga de fila (ADR-0027 + ADR-0024). Ela é o único caminho pelo qual aquele
      // ato alcança dado de negócio, e o contexto é estabelecido **uma vez**, na entrada. A
      // asserção **não foi afrouxada** pela mesma razão do parágrafo acima: contagem EXATA ao lado
      // da igualdade de lista, e um quinto chamador reprova nominalmente.
      //
      // SUT_IS_CORRECT_BECAUSE: a **T16** da fatia `emissao-e-conciliacao` acrescenta a quinta e a
      // sexta — as duas bordas da cobrança bancária, que são trabalho enfileirado e estabelecem o
      // contexto pela ADR-0024 exatamente como as duas irmãs de fila. A razão de cada uma está
      // escrita em `BORDAS_QUE_ESCREVEM_CONTEXTO`. A asserção **não foi afrouxada**: continua sendo
      // contagem EXATA ao lado da igualdade de lista acima, e um sétimo chamador reprova
      // nominalmente.
      //
      // SUT_IS_CORRECT_BECAUSE: a **T7** da fatia `webhook-e-carne` acrescenta a sétima — o
      // tratamento da notícia recebida do provedor. Ela é a primeira borda em que o `empresaId`
      // **não vem da carga**: ele vem do registro que o roteamento resolve, que é a segunda origem
      // legítima da ADR-0024 e o alcance que a terceira emenda dela declara. As duas leituras
      // anteriores à resolução correm **fora** de contexto de propósito — o cru, porque a tabela não
      // tem dono-empresa (ADR-0031), e o roteamento, porque a empresa é o **resultado** dele. A
      // asserção **não foi afrouxada**: continua sendo contagem EXATA ao lado da igualdade de lista
      // acima, e um oitavo chamador reprova nominalmente.
      expect(arquivosDe(varredura.ocorrencias)).toHaveLength(7);
    },
    LIMITE_DO_CASO_MS,
  );

  it(
    'CT-624 (b) — `app.empresa_id` e `identidade.empresa` só aparecem no elenco declarado',
    async () => {
      const daVariavel = await varrerFontesDaRegua(
        new RegExp(VARIAVEL_DE_CONTEXTO.replace('.', '\\.')),
      );
      const dasEmpresas = await varrerFontesDaRegua(
        new RegExp(TABELA_DE_EMPRESAS.replace('.', '\\.')),
      );

      expect(
        arquivosDe(daVariavel.ocorrencias),
        `a variável de contexto é nomeada fora do elenco: ${daVariavel.ocorrencias.join(', ')}`,
      ).toEqual([...FONTES_QUE_NOMEIAM_A_VARIAVEL_DE_CONTEXTO]);

      expect(
        arquivosDe(dasEmpresas.ocorrencias),
        `a enumeração de empresas escapou de @sysloc/db: ${dasEmpresas.ocorrencias.join(', ')}`,
      ).toEqual([...FONTES_QUE_LEEM_EMPRESAS]);
    },
    LIMITE_DO_CASO_MS,
  );

  it(
    'CT-624 (c) — os DOIS mutantes reprovam nomeando o arquivo, e o controle passa limpo',
    async () => {
      const caminho = `${RAIZ_DO_REPOSITORIO}${CAMINHO_DA_BORDA_DO_JOB}`;
      const integro = await readFile(caminho, 'utf8');

      // CONTROLE — a borda íntegra chama o escritor UMA vez, e não nomeia a variável de sessão.
      expect(linhasQueCasam(integro, CHAMADA_AO_ESCRITOR_DE_CONTEXTO)).toHaveLength(1);
      expect(linhasQueCasam(integro, new RegExp(VARIAVEL_DE_CONTEXTO.replace('.', '\\.')))).toEqual(
        [],
      );

      // MUTANTE 1 — uma chamada EXCEDENTE ao escritor, num arquivo que já é borda. A varredura passa
      // a ver duas ocorrências neste arquivo, e a lista de arquivos do caso principal continuaria
      // com três elementos — é por isso que o mutante que importa é medido também no fonte, e está
      // registrado no relatório da task. Aqui o que se prova é que o detector as **conta**.
      expect(
        linhasQueCasam(integro + CHAMADA_EXCEDENTE_AO_ESCRITOR, CHAMADA_AO_ESCRITOR_DE_CONTEXTO),
      ).toHaveLength(2);

      // MUTANTE 2 — o `SET LOCAL` escrito à mão, que estabeleceria contexto SEM passar pelo
      // escritor. Nenhuma varredura por `executarCom` o veria; quem o vê é o elenco da variável.
      const nomeacoes = linhasQueCasam(
        integro + FIXACAO_ESCRITA_A_MAO,
        new RegExp(VARIAVEL_DE_CONTEXTO.replace('.', '\\.')),
      );

      expect(nomeacoes).toHaveLength(1);
      expect(nomeacoes[0]).toContain('SET LOCAL app.empresa_id');
    },
    LIMITE_DO_CASO_MS,
  );
});

/** Varre os quatro diretórios de produção da fatia com o predicado informado. */
async function varrerFontesDaRegua(padrao: RegExp): Promise<VarreduraDeFontes> {
  const fontes: string[] = [];
  for (const diretorio of DIRETORIOS_DE_PRODUCAO_DA_REGUA) {
    fontes.push(...(await listarFontesTs(`${RAIZ_DO_REPOSITORIO}${diretorio}`)));
  }

  const varredura = await varrerArquivos(fontes, (linha) => padrao.test(linha));

  // Âncora de não-vacuidade: elenco declarado sobre zero arquivos lidos é verdade vazia.
  expect(varredura.arquivos).toBe(fontes.length);
  expect(varredura.arquivos).toBeGreaterThan(0);

  return varredura;
}

/** As linhas EXECUTÁVEIS de um fonte que casam o padrão — o detector das pernas de falsificação. */
function linhasQueCasam(fonte: string, padrao: RegExp): string[] {
  return semComentarios(fonte)
    .split('\n')
    .filter((linha) => padrao.test(linha))
    .map((linha) => linha.trim());
}
