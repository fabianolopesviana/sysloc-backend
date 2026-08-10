/**
 * A **fonte única do estado da cobrança** — a metade ESTRUTURAL do CA-04, provada por asserção
 * estática sobre os fontes e por introspecção do catálogo. T5 da fatia `cobranca-e-mora`.
 *
 * ---------------------------------------------------------------------------
 * INVARIANTES
 * ---------------------------------------------------------------------------
 *
 * | Critério | Caso   | Invariante |
 * |---|---|---|
 * | CA-04 | CT-510 | Os quatro rótulos de `negocio.status_cobranca` — `A_VENCER`, `VENCIDA`, `PAGA`
 * |       |        | e `CANCELADA` — não aparecem em posição EXECUTÁVEL em nenhum fonte de
 * |       |        | `packages/db/src/**` nem de `apps/api/src/**`. O conjunto de arquivos que os
 * |       |        | carregam, varrido também sobre `packages/contracts/src/**`, é **EXATAMENTE**
 * |       |        | `['packages/contracts/src/cobranca.ts']` — igualdade de lista ordenada, nunca
 * |       |        | `toContain`. (ADR-0022, ADR-0023) |
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
 *
 * Rastreabilidade: `CA-04 → CT-510 (RD-04)`.
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
import { listarFontesTs, semComentarios, varrerArquivos } from './varredura-de-fontes.ts';

/** Subir a instância, provisionar papéis, migrar e semear leva dezenas de segundos nesta máquina. */
const LIMITE_SUBIDA_MS = 90_000;

/** Cada caso faz uma varredura de arquivos e poucas consultas ao catálogo. Teto folgado. */
const LIMITE_DO_CASO_MS = 60_000;

/** A raiz do repositório, para que os caminhos relatados sejam relativos e legíveis. */
const RAIZ_DO_REPOSITORIO = fileURLToPath(new URL('../../../', import.meta.url));

/**
 * Os três diretórios de fonte varridos.
 *
 * `packages/db/src` e `apps/api/src` são os alvos da proibição — são eles que leem cobrança e são
 * eles onde uma segunda derivação nasceria. `packages/contracts/src` entra porque é lá que mora a
 * **única** ocorrência legítima, e varrê-lo é o que transforma a asserção de *"não existe em dois
 * lugares"* em *"existe exatamente num"*: sem ele, a lista esperada seria vazia, e uma varredura que
 * não lesse arquivo nenhum passaria verde.
 *
 * `packages/auth/src` e `packages/shared/src` ficam de fora porque não conhecem cobrança — incluí-los
 * alargaria o alvo sem acrescentar poder de detecção, e a §11.2 já os mantém sem alcance ao domínio.
 */
const DIRETORIOS_VARRIDOS: readonly string[] = [
  'packages/contracts/src',
  'packages/db/src',
  'apps/api/src',
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
  'nosso_numero',
  'linha_digitavel',
  'codigo_barras',
  'data_credito',
  'valor_creditado',
  'boleto_arquivo',
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
