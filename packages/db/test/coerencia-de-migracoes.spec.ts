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
 * segundos, porque tudo que eles afirmam é comportamento contra banco real. Este caso não toca
 * banco: ele lê um diretório e um JSON. Hospedá-lo em qualquer um dos quatro o faria esperar a
 * subida da instância para nada e amarraria uma afirmação sobre o LEDGER à coesão de um arquivo
 * sobre isolamento, catálogo ou privilégio.
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
import { describe, expect, it } from 'vitest';

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
