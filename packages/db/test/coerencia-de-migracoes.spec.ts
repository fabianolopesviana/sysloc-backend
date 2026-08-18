/**
 * Coerência do ledger de migrações — o DIRETÓRIO e o `meta/_journal.json` dizem a mesma coisa.
 *
 * ===========================================================================
 * INVARIANTES
 * ===========================================================================
 *
 * | Critério | Caso        | Invariante |
 * |----------|-------------|------------|
 * | CA-18    | RG-T3-01    | Os pares `(idx, tag)` derivados dos NOMES dos arquivos
 * |          |             | `migracoes/*.sql` e os pares `(idx, tag)` registrados em
 * |          |             | `migracoes/meta/_journal.json` são iguais — listas ORDENADAS,
 * |          |             | comparadas por igualdade, posição inclusive. E os `when` do
 * |          |             | journal são estritamente crescentes. |
 * | CA-18    | RG-T3-01    | Sobre cópias do ledger com o defeito reintroduzido, a MESMA
 * |          | (falsificação) | asserção reprova nomeando o culpado nos três eixos: entrada
 * |          |             | ausente, `idx` que não corresponde ao prefixo do arquivo, e
 * |          |             | `when` que não cresce — e a entrada ausente é falsificada sobre as
 * |          |             | DUAS migrações autorais, a `0008` e a `0010`. O controle — cópia
 * |          |             | íntegra — passa limpo. |
 * | CA-14    | CT-946      | O detector de mistura acusa, num fonte de controle que traz
 * |          |             | `CREATE TABLE` e `CREATE POLICY` no mesmo arquivo, as DUAS
 * |          |             | naturezas nomeadas; aplicado à `0017` e à `0018` REAIS devolve
 * |          |             | `[]` em cada uma, e os dois controles de natureza única também.
 * |          |             | O ledger permanece coerente com o disco **e** carrega as duas
 * |          |             | entradas novas nomeadas. E a `0018` declara
 * |          |             | `FORCE ROW LEVEL SECURITY` para as QUATRO tabelas novas, com o
 * |          |             | conjunto de tabelas que ela força igual ao conjunto de tabelas
 * |          |             | para as quais ela cria política. |
 * | CA-02    | CT-608      | Por introspecção do catálogo de uma instância migrada, as duas
 * | CA-12    |             | tabelas da `0011` têm `empresa_id NOT NULL`, `relrowsecurity` E
 * |          |             | `relforcerowsecurity` verdadeiros, EXATAMENTE uma política `FOR
 * |          |             | ALL` cada, com `qual` textualmente idêntico a `with_check` e à
 * |          |             | expressão que a `0010` já usa em `negocio.cobranca`; a FK de
 * |          |             | `envio_de_cobranca` é COMPOSTA — `['cobranca_id','empresa_id']` →
 * |          |             | `negocio.cobranca['id','empresa_id']` —; as duas restrições
 * |          |             | `UNIQUE` da política são `(id, empresa_id)` e `(empresa_id)`; os
 * |          |             | três enums têm rótulos e ORDEM estritamente iguais aos arranjos
 * |          |             | congelados de `@sysloc/contracts`; o índice da trava é PARCIAL em
 * |          |             | `desfecho = 'ENVIADA'` e o do histórico não é, os dois com
 * |          |             | `criado_em DESC`; os padrões de coluna são `false`, `0`, `1`,
 * |          |             | `00:00`, `23:59` e `EMAIL`; `sysloc_app` tem `USAGE` nos três
 * |          |             | tipos; e um valor `time` projetado CRU **reprova**
 * |          |             | `esquemaDaPoliticaDeAviso` enquanto o mesmo valor projetado por
 * |          |             | `to_char(…, 'HH24:MI')` **passa**. |
 *
 * ===========================================================================
 * Por que o identificador NÃO é um `CT-4xx`
 * ===========================================================================
 *
 * Os casos planejados desta fatia ocupam `CT-401`–`CT-434` e estão distribuídos em
 * `_run/test-cases.json`; este caso **não** está na §6 da T3. Dar-lhe um número daquela faixa o
 * faria passar por planejado e desalinharia a distribuição. `RG-T3-01` lê-se *rede de correção de
 * gate, T3, primeira* — e o prefixo é deliberadamente fora da sequência para que uma varredura por
 * `CT-` nunca o confunda com um caso da spec.
 *
 * ===========================================================================
 * Por que um arquivo NOVO, e por que ele não usa `varredura-de-fontes.ts`
 * ===========================================================================
 *
 * Os quatro arquivos de teste declarados na T3 (`catalogo`, `isolamento`, `papel-de-conexao`,
 * `unidade-de-trabalho`) sobem instância efêmera de PostgreSQL num `beforeAll` de dezenas de
 * segundos, porque tudo que eles afirmam é comportamento contra banco real. O caso `RG-T3-01` não
 * toca banco: ele lê um diretório e um JSON. Hospedá-lo em qualquer um dos quatro o faria esperar a
 * subida da instância para nada e amarraria uma afirmação sobre o LEDGER à coesão de um arquivo
 * sobre isolamento, catálogo ou privilégio.
 *
 * ⚠️ **O CT-608, acrescentado pela T3 da fatia `regua-de-cobranca`, TOCA banco** — e a designação é
 * da spec, não escolha deste arquivo (§5.2 da task e §3.6 do `tech_spec.md`). Ela é coerente: o que
 * ele afirma é a **coerência entre o que a migração declara e o que o catálogo passou a ter** —
 * mesma pergunta do `RG-T3-01`, um degrau adiante, com o banco no lugar do JSON. A instância vive
 * num `describe` PRÓPRIO, com `beforeAll`/`afterAll` próprios, de modo que o `RG-T3-01` continua
 * afirmando o que sempre afirmou, sem depender dela.
 *
 * O acessório `varredura-de-fontes.ts` também não serve: ele lista `.ts` recursivamente e casa
 * LINHA de fonte com comentários removidos. Aqui os artefatos são um nome de arquivo e um documento
 * JSON — reaproveitá-lo seria forçar a forma, não reusar o mecanismo.
 *
 * ===========================================================================
 * O que este caso existe para impedir (TR-P1, rodada 3 do Gate 2)
 * ===========================================================================
 *
 * O `_journal.json` é o ledger que o `drizzle-kit` mantém, e **nada no repositório o lê**: os dois
 * consumidores reais de migração descobrem os arquivos por DIRETÓRIO — `test/banco-efemero.ts` por
 * `readdir().sort()` e `deploy/scripts/instalacao/migrar-banco.sh` por `find … | sort`. A coerência
 * entre os dois existia **só por disciplina do autor**, e foi exatamente ela que falhou na rodada 1
 * desta task, quando a `0008_seguranca_contrato.sql` nasceu fora do ledger sem que build, lint ou
 * suíte acusassem coisa alguma.
 *
 * O dano não é o registro errado: é a colisão seguinte. Com a entrada ausente, o próximo
 * `pnpm --filter @sysloc/db gerar-migracao` reemite o índice já ocupado — `0008_<nome sorteado>.sql`
 * ao lado do `0008` autoral — e **sobrescreve `0008_snapshot.json`**. Os dois `.sql` passam a ser
 * aplicados por `find | sort`, com a ordem relativa decidida pelo sufixo sorteado em vez da
 * intenção. Reproduzido à mão na rodada 2 (`0008_kind_toro.sql`).
 *
 * **Por que a rede é a igualdade, e não uma busca pela entrada da `0008`.** Uma asserção que
 * procurasse a entrada que faltou fecharia a ocorrência e deixaria a classe aberta — é a distinção
 * do P3 de `.claude/rules/nao-regressao.md`, e foi o veredito literal do Gate 2. Aqui as duas
 * listas são derivadas de fontes INDEPENDENTES e comparadas inteiras: entrada ausente, entrada
 * sobrando, `idx` copiado da anterior sem incrementar, `tag` que não bate com o nome do arquivo e
 * ordem trocada rompem todas a mesma igualdade. E, por ser derivada do disco em vez de uma lista
 * fixa de migrações, ela já cobria a `0009` e a `0010` antes de elas existirem — as duas entraram na
 * varredura sem que uma linha do caso principal precisasse mudar, que é o que se esperava dele.
 *
 * O marcador `DECISÃO FECHADA` não é opção no `_journal.json`: JSON não admite comentário. Esta é a
 * rede possível, e ela é executável.
 *
 * ===========================================================================
 * MUTANTES EXECUTADOS — MT-J1 e MT-J2 (2026-08-09)
 * ===========================================================================
 *
 * Asserção estática ⇒ prova de falsificação obrigatória (`.claude/rules/testing-stack.md`). Além
 * das três pernas PERMANENTES na suíte (o caso de falsificação, sobre cópias), o defeito foi
 * reintroduzido no artefato REAL e medido. A suíte foi invocada pelo **script do pacote**
 * (`pnpm --filter @sysloc/db test`), nunca por `vitest run` avulso.
 *
 *   * **controle** — árvore íntegra: `70 passed`;
 *   * **MT-J1 · a entrada da `0008` removida do `_journal.json` real** — o estado literal da rodada
 *     1 desta task: `2 failed | 68 passed`, com a mensagem nomeando o culpado —
 *     `expected [ '8·0008_seguranca_contrato' ] to deeply equal []`. É o modo de falha desejado:
 *     ele aponta o ARQUIVO e o `idx` esperado, e não um diff de nove objetos;
 *   * **MT-J2 · o `when` da `0008` igualado ao da `0007`** — a entrada copiada sem avançar o
 *     carimbo. A igualdade de `(idx, tag)` segue verde, e só o terceiro eixo acusa:
 *     `expected [ '0008_seguranca_contrato' ] to deeply equal []`. É o mutante que prova que o
 *     eixo do `when` não é decorativo;
 *   * **reversão** — o `_journal.json` foi restaurado e conferido idêntico ao original por
 *     `sha256sum` (`f1e1592226…`) e por `diff` vazio, e o controle voltou a `70 passed`.
 *
 * A âncora destes registros é SIMBÓLICA — {@link MIGRACAO_AUTORAL_DESTA_TASK},
 * {@link ausentesNoJournal} e {@link CoerenciaDoLedger.foraDeOrdem} —, e nunca número de linha.
 *
 * ===========================================================================
 * Precondição privilegiada
 * ===========================================================================
 *
 * Nenhuma. O caso principal observa os artefatos reais do pacote, no lugar em que eles vivem, e não
 * escreve nada. A falsificação monta cópias em diretório temporário — os `.sql` são copiados com o
 * conteúdo REAL (o leitor só usa o nome, mas copiar o arquivo remove a objeção de estar afirmando
 * sobre um artefato inventado) e o journal é reescrito com o defeito. Nenhum símbolo foi
 * acrescentado a `packages/db/src/**` nem às migrações para este caso existir.
 */

import { copyFile, mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  CAMINHOS_DO_AVISO,
  CANAIS_DE_AVISO,
  DESFECHOS_DO_AVISO,
  esquemaDaPoliticaDeAviso,
} from '@sysloc/contracts';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { abrirConexao } from '../src/conexao.ts';
import { type BancoMigrado, bancoEfemero } from './banco-efemero.ts';

/** Onde vivem as migrações deste pacote — o mesmo diretório que `banco-efemero.ts` aplica. */
const DIRETORIO_DE_MIGRACOES = fileURLToPath(new URL('../migracoes/', import.meta.url));

/**
 * O padrão de nome, idêntico ao de `test/banco-efemero.ts` e ao `PADRAO_MIGRACAO` de
 * `migrar-banco.sh`. Ele é redeclarado aqui de propósito: o daquele módulo é privado, e exportá-lo
 * só para este caso enxergá-lo seria o seam que a `.claude/rules/testing-stack.md` proíbe.
 */
const PADRAO_MIGRACAO = /^\d{4}_.+\.sql$/;

/** O ledger do `drizzle-kit`, relativo ao diretório de migrações. */
const CAMINHO_DO_JOURNAL = join('meta', '_journal.json');

/**
 * Âncora contra descobridor quebrado.
 *
 * Sem ela, um `readdir` que devolvesse lista vazia **e** um journal ilegível ao mesmo tempo fariam
 * `[] toEqual []` passar. Os três nomes abaixo são os que o `CLAUDE.md` e o cabeçalho da `0008`
 * declaram IMUTÁVEIS — descrevem schemas já aplicados e não se emendam —, de modo que a âncora não
 * envelhece a cada migração nova: ela é um filtro, não a lista completa.
 */
const MIGRACOES_IMUTAVEIS: readonly string[] = [
  '0000_fundacao',
  '0001_seguranca',
  '0006_seguranca_dominio',
];

/**
 * A migração autoral da T3 da fatia `contratos-de-locacao` — o alvo nomeado das três primeiras
 * pernas da falsificação, e o artefato sobre o qual os mutantes MT-J1 e MT-J2 foram medidos.
 *
 * O nome do símbolo é preservado porque é ele a ÂNCORA SIMBÓLICA daquele registro, e o cabeçalho o
 * cita por `{@link}`: renomeá-lo desfaria a rastreabilidade da prova já executada. "Esta task", aqui,
 * é a que escreveu o caso.
 */
const MIGRACAO_AUTORAL_DESTA_TASK = '0008_seguranca_contrato';

/**
 * A migração autoral da T3 da fatia `cobranca-e-mora` — o alvo da QUARTA perna.
 *
 * Ela existe porque o defeito que este caso fecha é de CLASSE, e não de ocorrência: toda fatia que
 * cria tabela em `negocio` leva junto uma parceira autoral, e é a parceira — que o `drizzle-kit`
 * nunca escreve no ledger — que nasce fora dele. Falsificar sobre a `0008` prova que o detector
 * funciona; falsificar também sobre a autoral mais recente prova que ele **alcança a que acabou de
 * ser escrita**, que é onde o descuido acontece.
 */
const MIGRACAO_AUTORAL_DA_COBRANCA = '0010_seguranca_cobranca';

/** O par que identifica uma migração nas duas fontes. É sobre ele que a igualdade corre. */
interface EntradaDoLedger {
  readonly idx: number;
  readonly tag: string;
}

/** A entrada do journal como ela está no arquivo — o `when` não é derivável do diretório. */
interface EntradaDoJournal extends EntradaDoLedger {
  readonly when: number;
}

interface CoerenciaDoLedger {
  /** `(idx, tag)` derivado dos nomes de arquivo, em ordem de nome. */
  readonly derivadoDoDiretorio: EntradaDoLedger[];
  /** `(idx, tag)` como o journal os registra, na ordem em que ele os lista. */
  readonly registradoNoJournal: EntradaDoLedger[];
  /** A `tag` de cada entrada cujo `when` não é maior que o da anterior. */
  readonly foraDeOrdem: string[];
}

/**
 * Leitura de campo de um valor já estreitado para `object`.
 *
 * É a ÚNICA conversão do arquivo, e ela é estreita de propósito: o conteúdo do journal é entrada
 * não confiável (um arquivo do disco), entra como `unknown` e só vira `EntradaDoJournal` depois de
 * cada campo ser conferido por `typeof`.
 */
function campo(valor: object, nome: string): unknown {
  return (valor as Record<string, unknown>)[nome];
}

/**
 * As entradas do journal, ou erro que NOMEIA o que está ilegível.
 *
 * Ausência não é engolida: um journal corrompido tem de reprovar o caso, e não reduzi-lo a uma
 * lista vazia que passaria por vacuidade contra um diretório também vazio.
 */
function lerEntradasDoJournal(bruto: string): EntradaDoJournal[] {
  const conteudo: unknown = JSON.parse(bruto);

  if (typeof conteudo !== 'object' || conteudo === null) {
    throw new Error('`meta/_journal.json` não é um objeto — o ledger de migrações está ilegível');
  }

  const entradas = campo(conteudo, 'entries');
  if (!Array.isArray(entradas)) {
    throw new Error('`entries` de `meta/_journal.json` não é uma lista');
  }

  return entradas.map((entrada: unknown, posicao) => {
    if (typeof entrada !== 'object' || entrada === null) {
      throw new Error(`a entrada ${posicao} de \`meta/_journal.json\` não é um objeto`);
    }

    const idx = campo(entrada, 'idx');
    const tag = campo(entrada, 'tag');
    const when = campo(entrada, 'when');

    if (typeof idx !== 'number' || typeof tag !== 'string' || typeof when !== 'number') {
      throw new Error(
        `a entrada ${posicao} de \`meta/_journal.json\` não tem \`idx\`, \`tag\` e \`when\``,
      );
    }

    return { idx, tag, when };
  });
}

/** As duas fontes lidas do mesmo diretório — o real no caso principal, a cópia na falsificação. */
async function coerenciaDoLedger(diretorio: string): Promise<CoerenciaDoLedger> {
  const arquivos = (await readdir(diretorio)).filter((nome) => PADRAO_MIGRACAO.test(nome)).sort();

  if (arquivos.length === 0) {
    throw new Error(
      `nenhum arquivo de migração em ${diretorio} — a igualdade passaria por vacuidade contra um ` +
        'journal também vazio, e o caso deixaria de provar o que promete',
    );
  }

  const entradas = lerEntradasDoJournal(
    await readFile(join(diretorio, CAMINHO_DO_JOURNAL), 'utf8'),
  );

  return {
    derivadoDoDiretorio: arquivos.map((nome) => ({
      idx: Number.parseInt(nome.slice(0, 4), 10),
      tag: nome.replace(/\.sql$/, ''),
    })),
    registradoNoJournal: entradas.map(({ idx, tag }) => ({ idx, tag })),
    foraDeOrdem: entradas
      .filter((entrada, posicao) => {
        const anterior = entradas[posicao - 1];
        return anterior !== undefined && entrada.when <= anterior.when;
      })
      .map((entrada) => entrada.tag),
  };
}

/**
 * A forma NOMEÁVEL da divergência: `<idx>·<tag>`.
 *
 * A igualdade das listas inteiras é a asserção principal; estas duas listas derivadas existem para
 * que a reprovação aponte o ARQUIVO culpado, e não uma diferença de arrays que o leitor teria de
 * decifrar. É o mesmo movimento de `excedentes`/`ausentes` no CT-326.
 */
function chave(entrada: EntradaDoLedger): string {
  return `${entrada.idx}·${entrada.tag}`;
}

/** No disco e não no journal — a migração autoral esquecida no ledger. */
function ausentesNoJournal(coerencia: CoerenciaDoLedger): string[] {
  const registradas = new Set(coerencia.registradoNoJournal.map(chave));
  return coerencia.derivadoDoDiretorio.map(chave).filter((par) => !registradas.has(par));
}

/** No journal e não no disco — arquivo apagado, renomeado, ou `idx` que não bate com o prefixo. */
function excedentesNoJournal(coerencia: CoerenciaDoLedger): string[] {
  const noDisco = new Set(coerencia.derivadoDoDiretorio.map(chave));
  return coerencia.registradoNoJournal.map(chave).filter((par) => !noDisco.has(par));
}

/**
 * Monta uma cópia do ledger num diretório novo: os `.sql` REAIS, e o journal que se pedir.
 *
 * Os arquivos são copiados com o conteúdo original — o leitor só usa o nome, mas uma cópia de
 * verdade elimina a dúvida de a falsificação estar correndo sobre um artefato inventado.
 */
async function montarCopiaDoLedger(
  raiz: string,
  arquivos: readonly string[],
  entradas: readonly EntradaDoJournal[],
): Promise<string> {
  const destino = await mkdtemp(join(raiz, 'ledger-'));
  await mkdir(join(destino, 'meta'), { recursive: true });

  for (const nome of arquivos) {
    await copyFile(join(DIRETORIO_DE_MIGRACOES, nome), join(destino, nome));
  }

  await writeFile(
    join(destino, CAMINHO_DO_JOURNAL),
    `${JSON.stringify({ version: '7', dialect: 'postgresql', entries: entradas }, null, 2)}\n`,
    'utf8',
  );

  return destino;
}

/** Os nomes e as entradas reais, que as pernas da falsificação mutam uma de cada vez. */
async function ledgerReal(): Promise<{
  arquivos: string[];
  entradas: EntradaDoJournal[];
}> {
  return {
    arquivos: (await readdir(DIRETORIO_DE_MIGRACOES))
      .filter((nome) => PADRAO_MIGRACAO.test(nome))
      .sort(),
    entradas: lerEntradasDoJournal(
      await readFile(join(DIRETORIO_DE_MIGRACOES, CAMINHO_DO_JOURNAL), 'utf8'),
    ),
  };
}

/**
 * Aplica uma mutação à entrada da migração autoral NOMEADA, preservando as demais na ordem.
 *
 * O alvo é parâmetro, e não literal: as pernas correm sobre migrações autorais diferentes, e um
 * alvo fixo faria a quarta perna mutar a entrada da terceira sem que nada acusasse.
 */
function comEntradaMutada(
  entradas: readonly EntradaDoJournal[],
  alvo: string,
  mutar: (entrada: EntradaDoJournal) => EntradaDoJournal | undefined,
): EntradaDoJournal[] {
  const mutadas: EntradaDoJournal[] = [];
  for (const entrada of entradas) {
    if (entrada.tag !== alvo) {
      mutadas.push(entrada);
      continue;
    }
    const resultado = mutar(entrada);
    if (resultado !== undefined) {
      mutadas.push(resultado);
    }
  }
  return mutadas;
}

describe('coerência do ledger de migrações', () => {
  it('RG-T3-01 — toda migração do diretório tem entrada no journal, com o mesmo `idx` e `when` crescente', async () => {
    const coerencia = await coerenciaDoLedger(DIRETORIO_DE_MIGRACOES);

    // --- Âncora: o descobridor achou os arquivos que sabidamente existem --------------------
    //
    // Filtro sobre o que foi descoberto, e não a lista completa: assim a âncora não precisa ser
    // editada a cada migração nova, e um `readdir` que devolvesse vazio reprova aqui.
    expect(
      coerencia.derivadoDoDiretorio
        .map((entrada) => entrada.tag)
        .filter((tag) => MIGRACOES_IMUTAVEIS.includes(tag)),
    ).toEqual(MIGRACOES_IMUTAVEIS);

    // --- A divergência NOMEADA, e ela vem ANTES da igualdade ---------------------------------
    //
    // A ordem é conteúdo, no mesmo movimento do passo 5 do CT-406: a igualdade das listas inteiras
    // reprova por primeiro em toda divergência de conteúdo, e posta antes ela deixaria estas duas
    // asserções inalcançáveis — verdes por nunca serem avaliadas. Aqui elas correm primeiro, e é
    // por isso que a reprovação aponta o ARQUIVO culpado (`8·0008_seguranca_contrato`) em vez de um
    // diff de nove objetos que o leitor teria de decifrar. Foi o modo de falha medido no mutante.
    expect(ausentesNoJournal(coerencia)).toEqual([]);
    expect(excedentesNoJournal(coerencia)).toEqual([]);

    // --- A igualdade sobre listas ORDENADAS --------------------------------------------------
    //
    // Duas fontes independentes — os nomes dos arquivos no disco e o que o journal registra — têm
    // de dizer exatamente a mesma coisa, **na mesma ordem**. Esta asserção não é redundante com o
    // par acima: `ausentes`/`excedentes` comparam conjuntos e são cegos a ORDEM TROCADA, que é
    // divergência real — é a ordem das entradas, e não o `idx`, que o `drizzle-kit` percorre.
    expect(coerencia.registradoNoJournal).toEqual(coerencia.derivadoDoDiretorio);

    // --- O eixo que o diretório NÃO dá: `when` estritamente crescente ------------------------
    //
    // O `when` é o carimbo que o `drizzle-kit` usa para ordenar quando o prefixo empata; entrada
    // autoral copiada da anterior sem avançar o carimbo empata em silêncio. O precedente do par
    // 0005→0006 é `+1000`, e é o que a `0008` seguiu sobre a `0007`.
    expect(coerencia.foraDeOrdem).toEqual([]);
  });

  it('RG-T3-01 (falsificação) — a mesma asserção reprova nomeando a migração autoral fora do ledger', async () => {
    const raiz = await mkdtemp(join(tmpdir(), 'sysloc-ledger-de-migracoes-'));
    const real = await ledgerReal();

    try {
      // --- Controle: a cópia ÍNTEGRA passa limpa ---------------------------------------------
      //
      // Sem esta perna, um leitor quebrado — que reprovasse qualquer ledger — daria as três
      // reprovações abaixo sem provar nada.
      const controle = await coerenciaDoLedger(
        await montarCopiaDoLedger(raiz, real.arquivos, real.entradas),
      );
      expect(ausentesNoJournal(controle)).toEqual([]);
      expect(excedentesNoJournal(controle)).toEqual([]);
      expect(controle.registradoNoJournal).toEqual(controle.derivadoDoDiretorio);
      expect(controle.foraDeOrdem).toEqual([]);

      // --- Defeito 1: a entrada da migração autoral REMOVIDA -----------------------------------
      //
      // É literalmente o estado da rodada 1 desta task: o `.sql` no disco, o journal sem ele.
      const semEntrada = await coerenciaDoLedger(
        await montarCopiaDoLedger(
          raiz,
          real.arquivos,
          comEntradaMutada(real.entradas, MIGRACAO_AUTORAL_DESTA_TASK, () => undefined),
        ),
      );
      expect(ausentesNoJournal(semEntrada)).toEqual([`8·${MIGRACAO_AUTORAL_DESTA_TASK}`]);
      expect(excedentesNoJournal(semEntrada)).toEqual([]);
      expect(semEntrada.registradoNoJournal).not.toEqual(semEntrada.derivadoDoDiretorio);

      // --- Defeito 1-b: o mesmo defeito, sobre a migração autoral MAIS RECENTE -----------------
      //
      // A `0010_seguranca_cobranca.sql` é a parceira autoral da fatia `cobranca-e-mora`, e o
      // `drizzle-kit` **não a escreve no ledger** — quem a registra é quem a escreveu. É exatamente
      // a situação da rodada 1 da T3 anterior, agora sobre a migração recém-nascida: se ela ficasse
      // fora, o próximo `gerar-migracao` reemitiria o índice 10 e a ordem de aplicação passaria a
      // ser decidida por um sufixo sorteado.
      const semEntradaDaCobranca = await coerenciaDoLedger(
        await montarCopiaDoLedger(
          raiz,
          real.arquivos,
          comEntradaMutada(real.entradas, MIGRACAO_AUTORAL_DA_COBRANCA, () => undefined),
        ),
      );
      expect(ausentesNoJournal(semEntradaDaCobranca)).toEqual([
        `10·${MIGRACAO_AUTORAL_DA_COBRANCA}`,
      ]);
      expect(excedentesNoJournal(semEntradaDaCobranca)).toEqual([]);
      expect(semEntradaDaCobranca.registradoNoJournal).not.toEqual(
        semEntradaDaCobranca.derivadoDoDiretorio,
      );

      // --- Defeito 2: entrada presente, `idx` copiado da anterior ------------------------------
      //
      // A forma que uma busca por "existe entrada com esta tag" deixaria passar: a entrada está lá,
      // e o `idx` é o da `0007`. O `drizzle-kit` voltaria a emitir o índice 8.
      const idxDivergente = await coerenciaDoLedger(
        await montarCopiaDoLedger(
          raiz,
          real.arquivos,
          comEntradaMutada(real.entradas, MIGRACAO_AUTORAL_DESTA_TASK, (entrada) => ({
            ...entrada,
            idx: entrada.idx - 1,
          })),
        ),
      );
      expect(ausentesNoJournal(idxDivergente)).toEqual([`8·${MIGRACAO_AUTORAL_DESTA_TASK}`]);
      expect(excedentesNoJournal(idxDivergente)).toEqual([`7·${MIGRACAO_AUTORAL_DESTA_TASK}`]);
      expect(idxDivergente.registradoNoJournal).not.toEqual(idxDivergente.derivadoDoDiretorio);

      // --- Defeito 3: `when` que não cresce ----------------------------------------------------
      //
      // O eixo que a igualdade de `(idx, tag)` NÃO alcança, e por isso tem asserção própria: os
      // pares seguiriam idênticos e só este retrato acusa.
      const carimboEmpatado = await coerenciaDoLedger(
        await montarCopiaDoLedger(
          raiz,
          real.arquivos,
          comEntradaMutada(real.entradas, MIGRACAO_AUTORAL_DESTA_TASK, (entrada) => ({
            ...entrada,
            when: 0,
          })),
        ),
      );
      expect(carimboEmpatado.registradoNoJournal).toEqual(carimboEmpatado.derivadoDoDiretorio);
      expect(carimboEmpatado.foraDeOrdem).toEqual([MIGRACAO_AUTORAL_DESTA_TASK]);
    } finally {
      await rm(raiz, { recursive: true, force: true });
    }
  });
});

// ===========================================================================
// CT-946 — gerado e autoral não convivem no mesmo arquivo, e o ledger acompanha
// ===========================================================================
//
// ---------------------------------------------------------------------------
// O que este caso existe para impedir
// ---------------------------------------------------------------------------
//
// A regra que ele guarda está escrita em todo cabeçalho de migração de segurança desde a `0001`:
// **gerado e autoral nunca convivem no mesmo arquivo**, porque uma regeração futura da gerada
// sobrescreve o trecho autoral **em silêncio** — e o trecho autoral é justamente `FORCE ROW LEVEL
// SECURITY` e as políticas, isto é, o isolamento inteiro. O modo de falha não tem sintoma: o
// arquivo continua aplicável, a suíte continua verde no dia da mistura, e o dano aparece na
// primeira regeração, que é sempre outra fatia, meses depois.
//
// Até aqui a regra vivia **só em prosa de cabeçalho**. Este caso a torna executável.
//
// ---------------------------------------------------------------------------
// Por que o detector remove COMENTÁRIO antes de olhar
// ---------------------------------------------------------------------------
//
// Os cabeçalhos das duas migrações citam as duas naturezas por extenso — a `0017` explica por que
// não emite `FORCE ROW LEVEL SECURITY` nem `CREATE POLICY`, e a `0018` explica por que não emite
// `CREATE TABLE`. Um detector que casasse o texto cru acusaria **as duas** e nunca poderia passar,
// de modo que a única forma de deixá-lo verde seria apagar a prosa que explica a decisão. É o mesmo
// defeito que a `.claude/rules/testing-stack.md` registra como primeiro dos três da F0: a asserção
// que casava `ALTER ROLE` em comentário e mensagem de erro, permanecendo verde num script sem
// guarda alguma. Aqui ele apareceria na direção oposta — vermelho sem defeito —, e a "correção"
// intuitiva seria mutilar o arquivo.
//
// ---------------------------------------------------------------------------
// MUTANTE EXECUTADO — MT-M1 (2026-08-16)
// ---------------------------------------------------------------------------
//
// Asserção estática ⇒ prova de falsificação obrigatória (`.claude/rules/testing-stack.md`). Além do
// controle positivo PERMANENTE na suíte (o fonte sintético misturado), o defeito foi reintroduzido
// no artefato REAL e medido. A suíte foi invocada pelo **script do pacote**
// (`pnpm --filter @sysloc/db test`), nunca por `vitest run` avulso.
//
//   * **controle** — árvore íntegra: `194 passed`, 26 arquivos;
//   * **MT-M1 · o `FORCE ROW LEVEL SECURITY` e a política de `evento_bancario` copiados da `0018`
//     para o fim da `0017`** — a mistura literal que a regra proíbe, escrita como um autor futuro a
//     escreveria por conveniência ("é tudo da mesma fatia"). `24 failed | 2 passed` em arquivos e
//     `7 failed | 18 passed | 169 skipped` em casos. O CT-946 reprova NOMEANDO as duas naturezas e
//     cada instrução culpada da `0017`:
//     `[ 'AUTORAL · CREATE POLICY', 'AUTORAL · FORCE ROW LEVEL SECURITY', 'GERADA · ADD COLUMN',
//     'GERADA · ADD CONSTRAINT', 'GERADA · CREATE INDEX', 'GERADA · CREATE TABLE',
//     'GERADA · CREATE TYPE', 'GERADA · ENABLE ROW LEVEL SECURITY' ]` contra `[]`. **O alcance largo
//     é a rede funcionando**, e não ruído: a política duplicada faz a `0018` abortar com
//     `policy … already exists`, de modo que toda suíte que sobe instância migrada cai junto — o que
//     é exatamente o desfecho que a mistura produziria em operação;
//   * **MT-M2 · o `FORCE ROW LEVEL SECURITY` de `item_da_emissao_em_lote` removido da `0018`** — o
//     defeito que a separação existe para tornar impossível, aplicado diretamente. `15 failed | 179
//     passed`: o passo 5 deste caso reprova nomeando a tabela que sumiu da lista forçada, o CT-940
//     reprova com `forcada: false` naquela tabela, e a guarda de cobertura de `catalogo.spec.ts`
//     acusa `RLS_NAO_FORCADA` — três vias independentes, como no par CT-522/CT-523;
//   * **reversão** — a `0017` e a `0018` foram restauradas e conferidas por `sha256sum` idêntico ao
//     original (`2c96462a5b…` e `44bbde15c1…`), e o controle voltou a `194 passed`.
//
// A âncora deste registro é SIMBÓLICA — {@link naturezasMisturadas} e
// {@link MIGRACAO_GERADA_DA_EMISSAO} —, e nunca número de linha.
//
// ---------------------------------------------------------------------------
// Precondição privilegiada
// ---------------------------------------------------------------------------
//
// Nenhuma. O caso lê os artefatos reais do pacote, no lugar em que eles vivem, e não escreve nada —
// os fontes de controle são cadeias declaradas aqui, não arquivos. Nenhum símbolo foi acrescentado a
// `packages/db/src/**` nem às migrações para este caso existir.

/** As duas naturezas que um arquivo de migração pode ter — e nunca as duas ao mesmo tempo. */
type NaturezaDeMigracao = 'AUTORAL' | 'GERADA';

/** Uma instrução reconhecível, a natureza que ela denuncia e o rótulo que a nomeia na reprovação. */
interface MarcaDeNatureza {
  readonly natureza: NaturezaDeMigracao;
  readonly rotulo: string;
  readonly padrao: RegExp;
}

/**
 * O vocabulário do detector.
 *
 * A partição não é estética: as marcas `GERADA` são o que `drizzle-kit generate` **emite** a partir
 * do schema declarado, e as `AUTORAL` são exatamente o que ele **nunca** emite — a lista das
 * ausências está escrita, item a item, no cabeçalho de toda migração de segurança desde a `0001`.
 * É essa assimetria que torna a mistura detectável por texto: um arquivo que traga marca das duas
 * classes ou perde o trecho autoral na próxima regeração, ou faz o gerador propor recriar o que já
 * existe.
 *
 * `ENABLE ROW LEVEL SECURITY` é `GERADA` e `FORCE ROW LEVEL SECURITY` é `AUTORAL`, apesar de os dois
 * serem `ALTER TABLE … ROW LEVEL SECURITY`: o gerador emite o primeiro (a `0017` o faz, quatro
 * vezes) e não emite o segundo, que é justamente a ausência que obriga a parceira a existir.
 */
const MARCAS_DE_NATUREZA: readonly MarcaDeNatureza[] = [
  { natureza: 'GERADA', rotulo: 'CREATE TABLE', padrao: /\bCREATE\s+TABLE\b/i },
  { natureza: 'GERADA', rotulo: 'CREATE TYPE', padrao: /\bCREATE\s+TYPE\b/i },
  { natureza: 'GERADA', rotulo: 'CREATE INDEX', padrao: /\bCREATE\s+(UNIQUE\s+)?INDEX\b/i },
  { natureza: 'GERADA', rotulo: 'ADD COLUMN', padrao: /\bADD\s+COLUMN\b/i },
  { natureza: 'GERADA', rotulo: 'ADD CONSTRAINT', padrao: /\bADD\s+CONSTRAINT\b/i },
  {
    natureza: 'GERADA',
    rotulo: 'ENABLE ROW LEVEL SECURITY',
    padrao: /\bENABLE\s+ROW\s+LEVEL\s+SECURITY\b/i,
  },
  {
    natureza: 'AUTORAL',
    rotulo: 'FORCE ROW LEVEL SECURITY',
    padrao: /\bFORCE\s+ROW\s+LEVEL\s+SECURITY\b/i,
  },
  { natureza: 'AUTORAL', rotulo: 'CREATE POLICY', padrao: /\bCREATE\s+POLICY\b/i },
  { natureza: 'AUTORAL', rotulo: 'CREATE FUNCTION', padrao: /\bCREATE\s+FUNCTION\b/i },
  { natureza: 'AUTORAL', rotulo: 'CREATE SEQUENCE', padrao: /\bCREATE\s+SEQUENCE\b/i },
  { natureza: 'AUTORAL', rotulo: 'GRANT', padrao: /^\s*GRANT\b/im },
  { natureza: 'AUTORAL', rotulo: 'REVOKE', padrao: /^\s*REVOKE\b/im },
];

/**
 * O texto da migração **sem os comentários** — é sobre ele que o detector corre.
 *
 * Ver o cabeçalho: os cabeçalhos das duas migrações citam as duas naturezas por extenso, e casar o
 * texto cru faria o detector reprovar um par íntegro, empurrando a "correção" para apagar a prosa
 * que explica a decisão.
 */
function semComentarios(fonte: string): string {
  return fonte
    .split('\n')
    .map((linha) => linha.replace(/--.*$/, ''))
    .join('\n');
}

/**
 * As marcas encontradas, **quando há mais de uma natureza** — e a lista vazia quando há uma só.
 *
 * A saída nomeia a instrução culpada (`GERADA · CREATE TABLE`), e não apenas a natureza: é o que faz
 * a reprovação apontar o que remover do arquivo, em vez de exigir que quem lê releia o `.sql`
 * inteiro. Mesmo movimento de `ausentesNoJournal` no `RG-T3-01`.
 */
function naturezasMisturadas(fonte: string): string[] {
  const executavel = semComentarios(fonte);
  const encontradas = MARCAS_DE_NATUREZA.filter((marca) => marca.padrao.test(executavel));
  const naturezas = new Set(encontradas.map((marca) => marca.natureza));

  return naturezas.size > 1
    ? encontradas.map((marca) => `${marca.natureza} · ${marca.rotulo}`).sort()
    : [];
}

/** As duas migrações desta fatia, pelo nome com que vivem no disco e no ledger. */
const MIGRACAO_GERADA_DA_EMISSAO = '0017_dominio_emissao_e_conciliacao';
const MIGRACAO_AUTORAL_DA_EMISSAO = '0018_seguranca_emissao_e_conciliacao';

/**
 * As quatro tabelas da fatia, na ordem em que a `0018` as declara.
 *
 * A ordem é do arquivo, e a igualdade a cobra: uma quinta tabela forçada, ou uma das quatro que
 * ficasse de fora, aparece pela posição. Escritas à mão aqui, e não derivadas do esquema Drizzle —
 * derivá-las faria a asserção concordar com o mesmo lugar de onde a tabela nasce.
 */
const TABELAS_DA_EMISSAO_E_CONCILIACAO: readonly string[] = [
  'evento_bancario',
  'emissao_em_lote',
  'item_da_emissao_em_lote',
  'conferencia_bancaria',
];

/**
 * O fonte de CONTROLE POSITIVO: gerado e autoral no mesmo arquivo.
 *
 * Ele é escrito como um autor futuro o escreveria por conveniência — *"é tudo da mesma fatia, por
 * que dois arquivos?"* —, que é exatamente a forma pela qual a regra é quebrada. Sem esta perna, um
 * detector que devolvesse `[]` para qualquer entrada aprovaria a `0017` e a `0018` sem provar nada:
 * é o `AP-29` (`tautological_assertion`).
 */
const FONTE_MISTURADO = `
-- Um arquivo que faz as duas coisas — o defeito que este caso existe para pegar.
CREATE TABLE "negocio"."exemplo" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL
);
ALTER TABLE "negocio"."exemplo" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "negocio"."exemplo" FORCE ROW LEVEL SECURITY;
CREATE POLICY "exemplo_isolamento_empresa" ON "negocio"."exemplo" FOR ALL
	USING ("empresa_id" = nullif(current_setting('app.empresa_id', true), '')::uuid)
	WITH CHECK ("empresa_id" = nullif(current_setting('app.empresa_id', true), '')::uuid);
`;

/** Controle de natureza ÚNICA — só gerado. O detector tem de passar limpo por ele. */
const FONTE_SO_GERADO = `
CREATE TABLE "negocio"."exemplo" ("id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL);
ALTER TABLE "negocio"."exemplo" ENABLE ROW LEVEL SECURITY;
CREATE INDEX "exemplo_idx" ON "negocio"."exemplo" USING btree ("id");
`;

/** Controle de natureza ÚNICA — só autoral. O detector tem de passar limpo por ele. */
const FONTE_SO_AUTORAL = `
ALTER TABLE "negocio"."exemplo" FORCE ROW LEVEL SECURITY;
CREATE POLICY "exemplo_isolamento_empresa" ON "negocio"."exemplo" FOR ALL
	USING ("empresa_id" = nullif(current_setting('app.empresa_id', true), '')::uuid)
	WITH CHECK ("empresa_id" = nullif(current_setting('app.empresa_id', true), '')::uuid);
GRANT USAGE ON TYPE "negocio"."exemplo_enum" TO "sysloc_app";
`;

/** As tabelas que um fonte declara forçar, na ordem em que ele as declara. */
function tabelasForcadas(fonte: string): string[] {
  return [
    ...semComentarios(fonte).matchAll(
      /ALTER\s+TABLE\s+"negocio"\."(\w+)"\s+FORCE\s+ROW\s+LEVEL\s+SECURITY/gi,
    ),
  ].map((achado) => achado[1] ?? '');
}

/** As tabelas para as quais um fonte cria política, na ordem em que ele as declara. */
function tabelasComPolitica(fonte: string): string[] {
  return [
    ...semComentarios(fonte).matchAll(/CREATE\s+POLICY\s+"[^"]+"\s+ON\s+"negocio"\."(\w+)"/gi),
  ].map((achado) => achado[1] ?? '');
}

/** Lê uma migração do diretório REAL do pacote — nunca de uma cópia. */
async function lerMigracao(tag: string): Promise<string> {
  return readFile(join(DIRETORIO_DE_MIGRACOES, `${tag}.sql`), 'utf8');
}

describe('CT-946 — as migrações da emissão separam gerado de autoral, e o ledger acompanha', () => {
  it('CT-946 — o detector acusa a mistura no controle, devolve vazio na `0017` e na `0018`, e a `0018` força as quatro tabelas', async () => {
    // --- 1. Controle POSITIVO: a mistura é acusada, nomeando as duas naturezas ---------------
    //
    // Vem PRIMEIRO de propósito: é ele que autoriza a ler `[]` nas duas migrações reais como
    // "não há mistura" em vez de "o detector não detecta nada".
    expect(naturezasMisturadas(FONTE_MISTURADO)).toEqual([
      'AUTORAL · CREATE POLICY',
      'AUTORAL · FORCE ROW LEVEL SECURITY',
      'GERADA · CREATE TABLE',
      'GERADA · ENABLE ROW LEVEL SECURITY',
    ]);

    // --- 2. Controles de natureza ÚNICA: o detector passa limpo -------------------------------
    //
    // O par do controle positivo. Sem eles, um detector que acusasse QUALQUER arquivo satisfaria o
    // passo 1 e reprovaria os reais — e a leitura seria "as migrações estão erradas".
    expect(naturezasMisturadas(FONTE_SO_GERADO)).toEqual([]);
    expect(naturezasMisturadas(FONTE_SO_AUTORAL)).toEqual([]);

    // --- 3. As duas migrações REAIS, uma natureza cada ----------------------------------------
    const gerada = await lerMigracao(MIGRACAO_GERADA_DA_EMISSAO);
    const autoral = await lerMigracao(MIGRACAO_AUTORAL_DA_EMISSAO);

    expect(naturezasMisturadas(gerada)).toEqual([]);
    expect(naturezasMisturadas(autoral)).toEqual([]);

    // As duas asserções acima seriam satisfeitas por dois arquivos VAZIOS — que também têm uma
    // natureza só. Estas fixam qual natureza cada um tem, e são o controle antivácuo delas: a
    // `0017` traz a DDL e nenhuma cláusula de segurança autoral; a `0018` traz a segurança e
    // nenhuma DDL gerada.
    const executavelDaGerada = semComentarios(gerada);
    const executavelDaAutoral = semComentarios(autoral);

    expect(/\bCREATE\s+TABLE\b/i.test(executavelDaGerada)).toBe(true);
    expect(/\bCREATE\s+POLICY\b/i.test(executavelDaGerada)).toBe(false);
    expect(/\bFORCE\s+ROW\s+LEVEL\s+SECURITY\b/i.test(executavelDaGerada)).toBe(false);

    expect(/\bFORCE\s+ROW\s+LEVEL\s+SECURITY\b/i.test(executavelDaAutoral)).toBe(true);
    expect(/\bCREATE\s+POLICY\b/i.test(executavelDaAutoral)).toBe(true);
    expect(/\bCREATE\s+TABLE\b/i.test(executavelDaAutoral)).toBe(false);

    // --- 4. O ledger continua coerente com o disco, e carrega as duas entradas novas ----------
    //
    // A coerência inteira é do `RG-T3-01`; o que este passo acrescenta é a ÂNCORA NOMEADA das duas
    // entradas desta fatia — sem ela, um ledger que perdesse as duas seguiria coerente com um
    // diretório que também as perdesse, e a igualdade passaria sem falar delas.
    const coerencia = await coerenciaDoLedger(DIRETORIO_DE_MIGRACOES);

    expect(ausentesNoJournal(coerencia)).toEqual([]);
    expect(excedentesNoJournal(coerencia)).toEqual([]);
    expect(coerencia.registradoNoJournal).toEqual(coerencia.derivadoDoDiretorio);
    expect(coerencia.foraDeOrdem).toEqual([]);
    expect(
      coerencia.registradoNoJournal
        .filter((entrada) => entrada.idx >= 17)
        .map((entrada) => chave(entrada)),
    ).toEqual([`17·${MIGRACAO_GERADA_DA_EMISSAO}`, `18·${MIGRACAO_AUTORAL_DA_EMISSAO}`]);

    // --- 5. A `0018` força as QUATRO tabelas, e cria política para exatamente elas ------------
    //
    // Igualdade de array, posição inclusive: uma tabela nova que ficasse sem `FORCE` nasceria com o
    // isolamento existindo só para quem não é dono (ADR-0008, Cons), e a suíte de isolamento
    // conectada com o dono ficaria verde sem provar nada.
    expect(tabelasForcadas(autoral)).toEqual(TABELAS_DA_EMISSAO_E_CONCILIACAO);
    // O conjunto forçado e o conjunto com política são o MESMO: forçar sem política faz o
    // PostgreSQL negar tudo, e criar política sem forçar deixa o dono passando por cima dela. Os
    // dois defeitos são independentes, e só a comparação dos dois conjuntos pega ambos.
    expect(tabelasComPolitica(autoral)).toEqual(TABELAS_DA_EMISSAO_E_CONCILIACAO);
  });
});

// ===========================================================================
// CT-608 — o que a `0011` e a `0012` DECLARAM, e o que o catálogo passou a ter
// ===========================================================================
//
// ---------------------------------------------------------------------------
// Por que introspecção, e não leitura do texto das migrações
// ---------------------------------------------------------------------------
//
// Ler o `.sql` provaria que a instrução está escrita; o que importa é que ela **produziu o efeito**.
// A distinção não é acadêmica: `FORCE ROW LEVEL SECURITY` escrito na migração e uma migração que
// nunca é aplicada dão o mesmo texto e estados opostos, e um `CREATE POLICY` cuja expressão
// divergisse por um `nullif` continuaria casando qualquer `grep`. O catálogo é a autoridade sobre o
// estado real — é a mesma razão pela qual `src/catalogo.ts` consulta `pg_class` em vez de manter
// lista (ADR-0009).
//
// ---------------------------------------------------------------------------
// A expressão da política é ancorada na da COBRANÇA, e não redigitada aqui
// ---------------------------------------------------------------------------
//
// O caso não escreve o texto esperado de `USING`/`WITH CHECK`: ele o **lê da política de
// `negocio.cobranca`**, declarada pela `0010` — arquivo que esta fatia não toca — e exige igualdade.
// Redigitar a expressão aqui criaria a segunda redação do mesmo isolamento que o cabeçalho da
// `0012` existe para impedir, e ela ficaria livre para divergir junto com a errada. A âncora é
// **externa à fatia**, que é o que a torna capaz de reprovar.
//
// ---------------------------------------------------------------------------
// MUTANTES EXECUTADOS — MT-R1 e MT-R2 (2026-08-11)
// ===========================================================================
//
// A asserção é ESTRUTURAL (observa catálogo, não comportamento de domínio) ⇒ prova de falsificação
// obrigatória (`.claude/rules/testing-stack.md`). Os dois mutantes do card foram aplicados aos
// artefatos REAIS e a suíte foi invocada pelo **script do pacote** (`pnpm --filter @sysloc/db test`),
// nunca por `vitest run` avulso:
//
//   * **controle** — árvore íntegra: `117 passed`;
//   * **MT-R1 · `FORCE ROW LEVEL SECURITY` das duas tabelas removido da `0012`** — `15 failed |
//     102 passed`. O CT-608 reprova NOMEANDO as duas tabelas:
//     `- { tabela: 'envio_de_cobranca', habilitada: true, forcada: true }` contra
//     `+ { tabela: 'envio_de_cobranca', habilitada: true, forcada: false }`, e o mesmo para
//     `politica_de_aviso`. O CT-607 reprova pelo passo 7, e a guarda de cobertura de
//     `catalogo.spec.ts` acusa as duas com `RLS_NAO_FORCADA` em onze casos — as vias independentes,
//     como no par CT-522/CT-523. **O alcance largo é a rede funcionando**: `FORCE` ausente é
//     defeito de schema, e a suíte inteira que depende dele cai junto;
//   * **MT-R2 · a FK composta trocada por FK simples sobre `cobranca(id)`** — `1 failed | 116
//     passed`, com a mensagem exigida pelo card: `['cobranca_id']` obtido contra
//     `['cobranca_id','empresa_id']` esperado. **Nenhum outro caso da suíte acusa**, o que é
//     exatamente o ponto: sem o CT-608, a FK simples entraria em produção verde — a diferença entre
//     as duas formas só aparece quando alguém tenta o apontamento cruzado, e nada mais a persegue;
//   * **reversão** — os dois arquivos foram restaurados e conferidos por `sha256sum` idêntico ao
//     original (`d0051c6d…` e `b2a819ad…`), e o controle voltou a `117 passed`.
//
// ---------------------------------------------------------------------------
// Precondição privilegiada
// ---------------------------------------------------------------------------
//
// Nenhuma. A instância é a de `bancoEfemero()`, migrada pelos MESMOS arquivos que
// `migrar-banco.sh` aplica, e a conexão é a do papel `sysloc_app` — `conexaoDeMigracao` e
// `conexaoSuperusuaria` não aparecem aqui. O catálogo do sistema é legível por qualquer papel, e
// nenhuma linha de negócio é gravada: o caso observa ESTRUTURA.

/** A instância sobe uma vez por arquivo, e a subida leva dezenas de segundos nesta máquina. */
const LIMITE_SUBIDA_MS = 90_000;
const LIMITE_DO_CASO_MS = 60_000;

/** As duas tabelas da régua, pelo nome com que existem no catálogo. */
const TABELA_DA_POLITICA = 'politica_de_aviso';
const TABELA_DO_ENVIO = 'envio_de_cobranca';

/** A tabela cuja política serve de ÂNCORA da expressão — declarada pela `0010`, intocada aqui. */
const TABELA_ANCORA = 'cobranca';

interface EstadoDeRls {
  readonly tabela: string;
  readonly habilitada: boolean;
  readonly forcada: boolean;
}

interface PoliticaDoCatalogo {
  readonly tabela: string;
  readonly nome: string;
  readonly comando: string;
  readonly permissiva: string;
  readonly usando: string | null;
  readonly comVerificacao: string | null;
}

interface ColunaDoCatalogo {
  readonly tabela: string;
  readonly coluna: string;
  readonly tipo: string;
  readonly naoNula: boolean;
  readonly padrao: string | null;
}

interface RestricaoDoCatalogo {
  readonly tabela: string;
  readonly nome: string;
  readonly tipo: string;
  readonly colunas: string[];
  readonly tabelaReferida: string | null;
  readonly colunasReferidas: string[] | null;
}

describe('CT-608 — as tabelas da régua nascem isoladas, e o catálogo é quem responde', () => {
  let banco: BancoMigrado;

  beforeAll(async () => {
    banco = await bancoEfemero();
  }, LIMITE_SUBIDA_MS);

  afterAll(async () => {
    await banco?.parar();
  }, LIMITE_SUBIDA_MS);

  it(
    'CT-608 — RLS forçada, política `FOR ALL` com `USING` = `WITH CHECK`, FK composta, enums e índices',
    async () => {
      const sql = abrirConexao(banco.cadeiaConexao, { maximoDeConexoes: 1 });

      try {
        // --- 1. RLS habilitada E FORÇADA nas duas -----------------------------------------
        //
        // As duas metades numa asserção só, e por igualdade de objeto: `ENABLE` sem `FORCE` é o
        // estado em que o isolamento existe para quem não é dono e some para o dono — exatamente o
        // que a `0011` sozinha produziria (o gerador não emite `FORCE`).
        const rls = await sql<EstadoDeRls[]>`
          SELECT c.relname             AS tabela,
                 c.relrowsecurity      AS habilitada,
                 c.relforcerowsecurity AS forcada
            FROM pg_catalog.pg_class c
            JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
           WHERE n.nspname = 'negocio'
             AND c.relname IN (${TABELA_DO_ENVIO}, ${TABELA_DA_POLITICA})
           ORDER BY c.relname
        `;
        expect(rls.map((linha) => ({ ...linha }))).toEqual([
          { tabela: TABELA_DO_ENVIO, habilitada: true, forcada: true },
          { tabela: TABELA_DA_POLITICA, habilitada: true, forcada: true },
        ]);

        // --- 2. Exatamente UMA política por tabela, `FOR ALL`, `USING` = `WITH CHECK` -------
        const politicas = await sql<PoliticaDoCatalogo[]>`
          SELECT tablename  AS tabela,
                 policyname AS nome,
                 cmd        AS comando,
                 permissive AS permissiva,
                 qual       AS usando,
                 with_check AS "comVerificacao"
            FROM pg_catalog.pg_policies
           WHERE schemaname = 'negocio'
             AND tablename IN (${TABELA_DO_ENVIO}, ${TABELA_DA_POLITICA}, ${TABELA_ANCORA})
           ORDER BY tablename, policyname
        `;

        const daRegua = politicas.filter((politica) => politica.tabela !== TABELA_ANCORA);
        // A contagem vem ANTES: duas políticas na mesma tabela seriam OU lógico entre elas, e a
        // segunda poderia alargar o que a primeira restringe sem que a inspeção da primeira acusasse.
        expect(daRegua).toHaveLength(2);
        expect(
          daRegua.map((politica) => [politica.tabela, politica.nome, politica.comando]),
        ).toEqual([
          [TABELA_DO_ENVIO, 'envio_de_cobranca_isolamento_empresa', 'ALL'],
          [TABELA_DA_POLITICA, 'politica_de_aviso_isolamento_empresa', 'ALL'],
        ]);
        expect(daRegua.map((politica) => politica.permissiva)).toEqual([
          'PERMISSIVE',
          'PERMISSIVE',
        ]);

        // A expressão é lida da política da COBRANÇA, e não redigitada aqui — ver o cabeçalho.
        const ancora = politicas.find((politica) => politica.tabela === TABELA_ANCORA);
        // Sem esta linha, uma âncora ausente faria as igualdades abaixo compararem `undefined` com
        // `undefined` e passarem por vacuidade.
        expect(typeof ancora?.usando).toBe('string');
        expect(ancora?.usando).toBe(ancora?.comVerificacao);

        for (const politica of daRegua) {
          // `USING` e `WITH CHECK` idênticos entre si: divergi-los abriria o caso "enxerga só o
          // seu, grava para o alheio" — o `WITH CHECK` que faltasse seria SUBSTITUÍDO pelo `USING`
          // em silêncio, e o que ficasse mais largo passaria a valer para a gravação.
          expect(politica.usando).toBe(politica.comVerificacao);
          // …e idênticos à expressão já aplicada na cobrança: duas redações do mesmo isolamento são
          // livres para divergir, e a divergência não faz barulho.
          expect(politica.usando).toBe(ancora?.usando);
        }

        // --- 3. As colunas: `empresa_id NOT NULL`, os tipos e os PADRÕES --------------------
        //
        // Os padrões entram por igualdade porque `ativo` nascer `false` é decisão de produto (a
        // régua entra em produção DESLIGADA), e `intervalo_minimo_dias` nascer `1` é a trava que
        // protege a caixa do locatário. Um padrão trocado não quebra nada visível — e é exatamente
        // por isso que ele precisa de asserção.
        const colunas = await sql<ColunaDoCatalogo[]>`
          SELECT c.relname                                        AS tabela,
                 a.attname                                        AS coluna,
                 pg_catalog.format_type(a.atttypid, a.atttypmod)  AS tipo,
                 a.attnotnull                                     AS "naoNula",
                 pg_catalog.pg_get_expr(d.adbin, d.adrelid)       AS padrao
            FROM pg_catalog.pg_attribute a
            JOIN pg_catalog.pg_class c ON c.oid = a.attrelid
            JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
            LEFT JOIN pg_catalog.pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
           WHERE n.nspname = 'negocio'
             AND c.relname IN (${TABELA_DO_ENVIO}, ${TABELA_DA_POLITICA})
             AND a.attnum > 0
             AND NOT a.attisdropped
           ORDER BY c.relname, a.attnum
        `;

        expect(colunas.map((linha) => ({ ...linha }))).toEqual([
          {
            tabela: TABELA_DO_ENVIO,
            coluna: 'id',
            tipo: 'uuid',
            naoNula: true,
            padrao: 'gen_random_uuid()',
          },
          {
            tabela: TABELA_DO_ENVIO,
            coluna: 'empresa_id',
            tipo: 'uuid',
            naoNula: true,
            padrao: null,
          },
          {
            tabela: TABELA_DO_ENVIO,
            coluna: 'cobranca_id',
            tipo: 'uuid',
            naoNula: true,
            padrao: null,
          },
          {
            tabela: TABELA_DO_ENVIO,
            coluna: 'criado_em',
            tipo: 'timestamp with time zone',
            naoNula: true,
            padrao: 'now()',
          },
          {
            tabela: TABELA_DO_ENVIO,
            coluna: 'caminho',
            tipo: 'negocio.caminho_do_aviso',
            naoNula: true,
            padrao: null,
          },
          {
            tabela: TABELA_DO_ENVIO,
            coluna: 'desfecho',
            tipo: 'negocio.desfecho_do_aviso',
            naoNula: true,
            padrao: null,
          },
          // `NOT NULL` e sem padrão: a cadeia VAZIA do caso `SEM_DESTINATARIO` é valor gravado de
          // propósito (RD-11), e não ausência de valor.
          {
            tabela: TABELA_DO_ENVIO,
            coluna: 'destinatario',
            tipo: 'text',
            naoNula: true,
            padrao: null,
          },
          // A única coluna ANULÁVEL das duas tabelas — e a bicondicional abaixo é quem a pareia
          // com o desfecho.
          { tabela: TABELA_DO_ENVIO, coluna: 'causa', tipo: 'text', naoNula: false, padrao: null },
          {
            tabela: TABELA_DA_POLITICA,
            coluna: 'id',
            tipo: 'uuid',
            naoNula: true,
            padrao: 'gen_random_uuid()',
          },
          {
            tabela: TABELA_DA_POLITICA,
            coluna: 'empresa_id',
            tipo: 'uuid',
            naoNula: true,
            padrao: null,
          },
          {
            tabela: TABELA_DA_POLITICA,
            coluna: 'ativo',
            tipo: 'boolean',
            naoNula: true,
            padrao: 'false',
          },
          {
            tabela: TABELA_DA_POLITICA,
            coluna: 'dias_antes_do_vencimento',
            tipo: 'integer',
            naoNula: true,
            padrao: '0',
          },
          {
            tabela: TABELA_DA_POLITICA,
            coluna: 'intervalo_minimo_dias',
            tipo: 'integer',
            naoNula: true,
            padrao: '1',
          },
          {
            tabela: TABELA_DA_POLITICA,
            coluna: 'janela_inicio',
            tipo: 'time without time zone',
            naoNula: true,
            padrao: "'00:00:00'::time without time zone",
          },
          {
            tabela: TABELA_DA_POLITICA,
            coluna: 'janela_fim',
            tipo: 'time without time zone',
            naoNula: true,
            padrao: "'23:59:00'::time without time zone",
          },
          {
            tabela: TABELA_DA_POLITICA,
            coluna: 'canal',
            tipo: 'negocio.canal_de_aviso',
            naoNula: true,
            padrao: "'EMAIL'::negocio.canal_de_aviso",
          },
        ] satisfies ColunaDoCatalogo[]);

        // --- 4. As restrições: a FK COMPOSTA, as duas `UNIQUE` e os três `CHECK` ------------
        const restricoes = await sql<RestricaoDoCatalogo[]>`
          SELECT c.relname   AS tabela,
                 con.conname AS nome,
                 con.contype::text AS tipo,
                 (SELECT array_agg(att.attname ORDER BY u.ord)
                    FROM unnest(con.conkey) WITH ORDINALITY AS u(attnum, ord)
                    JOIN pg_catalog.pg_attribute att
                      ON att.attrelid = con.conrelid AND att.attnum = u.attnum) AS colunas,
                 alvo.relname AS "tabelaReferida",
                 (SELECT array_agg(att.attname ORDER BY u.ord)
                    FROM unnest(con.confkey) WITH ORDINALITY AS u(attnum, ord)
                    JOIN pg_catalog.pg_attribute att
                      ON att.attrelid = con.confrelid AND att.attnum = u.attnum) AS "colunasReferidas"
            FROM pg_catalog.pg_constraint con
            JOIN pg_catalog.pg_class c ON c.oid = con.conrelid
            JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
            LEFT JOIN pg_catalog.pg_class alvo ON alvo.oid = con.confrelid
           WHERE n.nspname = 'negocio'
             AND c.relname IN (${TABELA_DO_ENVIO}, ${TABELA_DA_POLITICA})
             AND con.contype IN ('f', 'u')
           ORDER BY c.relname, con.conname
        `;

        // A lista INTEIRA por igualdade, e não uma busca pela FK composta: uma busca ficaria verde
        // com a FK simples convivendo ao lado, que é a forma em que o defeito de fato voltaria.
        expect(restricoes.map((linha) => ({ ...linha }))).toEqual([
          {
            tabela: TABELA_DO_ENVIO,
            nome: 'envio_de_cobranca_cobranca_empresa_fkey',
            tipo: 'f',
            colunas: ['cobranca_id', 'empresa_id'],
            tabelaReferida: 'cobranca',
            colunasReferidas: ['id', 'empresa_id'],
          },
          {
            tabela: TABELA_DO_ENVIO,
            nome: 'envio_de_cobranca_empresa_id_empresa_id_fk',
            tipo: 'f',
            colunas: ['empresa_id'],
            tabelaReferida: 'empresa',
            colunasReferidas: ['id'],
          },
          {
            tabela: TABELA_DO_ENVIO,
            nome: 'envio_de_cobranca_id_empresa_key',
            tipo: 'u',
            colunas: ['id', 'empresa_id'],
            tabelaReferida: null,
            colunasReferidas: null,
          },
          {
            tabela: TABELA_DA_POLITICA,
            nome: 'politica_de_aviso_empresa_id_empresa_id_fk',
            tipo: 'f',
            colunas: ['empresa_id'],
            tabelaReferida: 'empresa',
            colunasReferidas: ['id'],
          },
          // O alvo do `ON CONFLICT` da T5 — é ela que torna "uma linha por empresa" propriedade do
          // banco, e não da disciplina de quem escreve.
          {
            tabela: TABELA_DA_POLITICA,
            nome: 'politica_de_aviso_empresa_key',
            tipo: 'u',
            colunas: ['empresa_id'],
            tabelaReferida: null,
            colunasReferidas: null,
          },
          {
            tabela: TABELA_DA_POLITICA,
            nome: 'politica_de_aviso_id_empresa_key',
            tipo: 'u',
            colunas: ['id', 'empresa_id'],
            tabelaReferida: null,
            colunasReferidas: null,
          },
        ] satisfies RestricaoDoCatalogo[]);

        // Os três `CHECK` declarados, pela expressão que o catálogo reconstrói. A bicondicional do
        // `causa_chk` é afirmada pelo TEXTO porque ela é a decisão: uma implicação simples
        // (`causa IS NOT NULL OR desfecho = 'ENVIADA'`) deixaria passar a falha sem causa.
        const verificacoes = await sql<{ nome: string; expressao: string }[]>`
          SELECT con.conname AS nome,
                 pg_catalog.pg_get_constraintdef(con.oid) AS expressao
            FROM pg_catalog.pg_constraint con
            JOIN pg_catalog.pg_class c ON c.oid = con.conrelid
            JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
           WHERE n.nspname = 'negocio'
             AND c.relname IN (${TABELA_DO_ENVIO}, ${TABELA_DA_POLITICA})
             AND con.contype = 'c'
           ORDER BY con.conname
        `;
        expect(verificacoes.map((linha) => linha.nome)).toEqual([
          'envio_de_cobranca_causa_chk',
          'politica_de_aviso_faixa_chk',
          'politica_de_aviso_janela_chk',
        ]);
        expect(verificacoes.map((linha) => linha.expressao)).toEqual([
          "CHECK (((desfecho = 'ENVIADA'::negocio.desfecho_do_aviso) = (causa IS NULL)))",
          'CHECK ((((dias_antes_do_vencimento >= 0) AND (dias_antes_do_vencimento <= 90)) AND ' +
            '((intervalo_minimo_dias >= 1) AND (intervalo_minimo_dias <= 90))))',
          'CHECK ((janela_fim >= janela_inicio))',
        ]);

        // --- 5. Os três enums, com rótulos e ORDEM vindos do CONTRATO ----------------------
        //
        // O esperado é o arranjo congelado de `@sysloc/contracts` — nunca uma lista redigitada aqui.
        // É o que fecha a ADR-0016 nas duas pontas: o schema Drizzle deriva do contrato e a
        // asserção confere contra a MESMA fonte, de modo que um rótulo acrescentado só no banco (ou
        // só no contrato) reprova. A ORDEM é conteúdo: um enum do PostgreSQL a guarda, e é ela que
        // governa comparação e ordenação do tipo.
        const enums = await sql<{ tipo: string; rotulos: string[] }[]>`
          SELECT t.typname AS tipo,
                 array_agg(e.enumlabel ORDER BY e.enumsortorder) AS rotulos
            FROM pg_catalog.pg_type t
            JOIN pg_catalog.pg_namespace n ON n.oid = t.typnamespace
            JOIN pg_catalog.pg_enum e ON e.enumtypid = t.oid
           WHERE n.nspname = 'negocio'
             AND t.typname IN ('canal_de_aviso', 'caminho_do_aviso', 'desfecho_do_aviso')
           GROUP BY t.typname
           ORDER BY t.typname
        `;
        expect(enums.map((linha) => ({ tipo: linha.tipo, rotulos: linha.rotulos }))).toEqual([
          { tipo: 'caminho_do_aviso', rotulos: [...CAMINHOS_DO_AVISO] },
          { tipo: 'canal_de_aviso', rotulos: [...CANAIS_DE_AVISO] },
          { tipo: 'desfecho_do_aviso', rotulos: [...DESFECHOS_DO_AVISO] },
        ]);

        // `USAGE` concedido a `sysloc_app` nos três, um a um: sem ele a aplicação não grava valor em
        // coluna do tipo, e a `0012` é o único lugar em que essa concessão está escrita.
        const [privilegios] = await sql<{ canal: boolean; caminho: boolean; desfecho: boolean }[]>`
          SELECT has_type_privilege('sysloc_app', 'negocio.canal_de_aviso', 'USAGE')    AS canal,
                 has_type_privilege('sysloc_app', 'negocio.caminho_do_aviso', 'USAGE')  AS caminho,
                 has_type_privilege('sysloc_app', 'negocio.desfecho_do_aviso', 'USAGE') AS desfecho
        `;
        expect(privilegios).toEqual({ canal: true, caminho: true, desfecho: true });

        // --- 6. Os dois índices, e o PARCIAL sendo parcial ---------------------------------
        //
        // A definição inteira por igualdade: é ela que carrega o `DESC` e o `WHERE`, e trocar
        // qualquer um dos dois é mudança silenciosa — a consulta continua correta e passa a varrer
        // o que o índice existia para não varrer.
        //
        // O `NULLS LAST` é do gerador, e não decisão: `DESC` sem qualificação já ordena os nulos
        // primeiro no PostgreSQL, e `criado_em` é `NOT NULL`, de modo que a cláusula não discrimina
        // linha alguma. Ela entra no esperado porque o esperado é o TEXTO que o catálogo
        // reconstrói — escrevê-lo "mais limpo" faria a asserção reprovar um schema íntegro.
        const indices = await sql<{ nome: string; definicao: string }[]>`
          SELECT indexname AS nome, indexdef AS definicao
            FROM pg_catalog.pg_indexes
           WHERE schemaname = 'negocio' AND tablename = ${TABELA_DO_ENVIO}
             AND indexname LIKE '%_idx'
           ORDER BY indexname
        `;
        expect(indices.map((linha) => ({ ...linha }))).toEqual([
          {
            nome: 'envio_de_cobranca_historico_idx',
            definicao:
              'CREATE INDEX envio_de_cobranca_historico_idx ON negocio.envio_de_cobranca ' +
              'USING btree (empresa_id, cobranca_id, criado_em DESC NULLS LAST)',
          },
          {
            nome: 'envio_de_cobranca_trava_idx',
            definicao:
              'CREATE INDEX envio_de_cobranca_trava_idx ON negocio.envio_de_cobranca ' +
              'USING btree (empresa_id, cobranca_id, criado_em DESC NULLS LAST) ' +
              "WHERE (desfecho = 'ENVIADA'::negocio.desfecho_do_aviso)",
          },
        ]);

        // --- 7. A PROJEÇÃO dos dois horários — a rede do risco carregado da T2 -------------
        //
        // A coluna é `time` (afirmado no passo 3), e o contrato publica `HH:MM` por expressão
        // ANCORADA. O que o passo abaixo mede é que as duas coisas **não se encaixam sozinhas**: o
        // valor projetado cru sai `'09:00:00'` e é RECUSADO por `esquemaDaPoliticaDeAviso`, e a
        // recusa de um esquema de SAÍDA não produz `422` — ela levanta na serialização e derruba a
        // rota de leitura da política (T9). A projeção `to_char(coluna, 'HH24:MI')` é, portanto,
        // parte da declaração da coluna, e não detalhe de quem consulta.
        //
        // O par positivo/negativo é o que discrimina: sem o positivo, "o esquema recusa" ficaria
        // verde sobre um esquema que recusasse tudo.
        const [projecao] = await sql<{ cru: string; projetado: string }[]>`
          SELECT janela.valor::text                      AS cru,
                 to_char(janela.valor, 'HH24:MI')        AS projetado
            FROM (SELECT '09:00'::time AS valor) AS janela
        `;
        expect(projecao).toEqual({ cru: '09:00:00', projetado: '09:00' });

        const politicaPublicada = {
          ativo: true,
          diasAntesDoVencimento: 3,
          intervaloMinimoDias: 7,
          janelaFim: '18:00',
          canal: 'EMAIL',
        } as const;

        expect(
          esquemaDaPoliticaDeAviso.safeParse({
            ...politicaPublicada,
            janelaInicio: projecao?.cru,
          }).success,
        ).toBe(false);
        expect(
          esquemaDaPoliticaDeAviso.safeParse({
            ...politicaPublicada,
            janelaInicio: projecao?.projetado,
          }).success,
        ).toBe(true);
      } finally {
        await sql.end();
      }
    },
    LIMITE_DO_CASO_MS,
  );
});
