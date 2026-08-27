/**
 * A **derivação da vigência do certificado** — a metade do A8 que nenhum caso comportamental pega:
 * a faixa e os dias exatos provados **sem relógio nenhum**, e a prova de que o caminho de decisão da
 * borda não alcança o relógio do processo. Rodada 2 da T11 da fatia `fundacao-bancaria`.
 *
 * ===========================================================================
 * OS DOIS CASOS SAEM DA FAIXA DOS CARDS, e a razão precisa estar escrita
 * ===========================================================================
 *
 * A faixa `CT-801` a `CT-853` está **toda alocada** aos cards das tasks T1 a T14 desta fatia, e
 * reusar um deles produziria duas coisas diferentes com o mesmo identificador — que é o que a
 * rastreabilidade existe para impedir. O precedente da fatia é pegar o **primeiro livre acima** e
 * declará-lo: a T7 fez isso com `CT-860`/`CT-861`, a T9 com `CT-862` e a T10 com `CT-863`. Os
 * primeiros livres hoje são **`CT-864`** e **`CT-865`**, e é o que se usa aqui.
 *
 * ---------------------------------------------------------------------------
 * INVARIANTES
 * ---------------------------------------------------------------------------
 *
 * | Critério | Caso | Invariante |
 * |---|---|---|
 * | A8 | CT-864 | `derivarEstadoDaVigencia` decide faixa e dias **só** a partir dos dois dias de
 * | CA-04 |      | calendário recebidos: a tabela prende as duas bordas do limiar (`+31 → VIGENTE`
 * |    |         | com **31**, `+30 → VENCENDO` com **30**), o dia do vencimento (`0 → VENCENDO`), o
 * |    |         | vencido (`−1`, `−10`), a virada do ano, o fevereiro bissexto e as duas travessias
 * |    |         | de horário de verão. Os dias são valor **exato** e sempre inteiro. |
 * | A8 | CT-864 | Dia fora da forma `AAAA-MM-DD` **levanta**, nas duas posições, em vez de virar
 * |    | (b)    | `NaN` seguindo adiante — e a forma válida na mesma posição não levanta. |
 * | A8 | CT-865 | **Zero** leituras do relógio ou do fuso do **processo** em posição executável em
 * |    |        | `apps/api/src/integracoes-bancarias/**`, e os dois argumentos da derivação vêm do
 * |    |        | **mesmo** resultado de `lerVigenciaObservada`. |
 * | A8 | CT-865 | **PROVA DE FALSIFICAÇÃO, permanente na suíte**: as MESMAS duas medições, aplicadas
 * |    | (b)    | a uma cópia do serviço com o mutante **M4** (o par de datas derivado do relógio do
 * |    |        | processo), REPROVAM — a primeira nomeando `new Date(`, a segunda perdendo o
 * |    |        | vínculo —, e aplicadas ao fonte íntegro passam limpas. |
 *
 * Rastreabilidade: `CA-04 → CT-864 (RN-04)` · `A8 → CT-864, CT-864 (b), CT-865, CT-865 (b)`.
 *
 * ===========================================================================
 * POR QUE ESTE ARQUIVO EXISTE — o CT-824 media a diferença entre dois relógios
 * ===========================================================================
 *
 * O `certificado-do-provedor.e2e.spec.ts` afirma no cabeçalho que a consulta deriva estado e dias
 * **contra `negocio.data_corrente_da_operacao()`, e não contra o relógio do processo**. Ele mede a
 * faixa e os dias corretamente, mas **não discrimina a fonte do relógio**, e a razão é aritmética: as
 * validades daquele arquivo saem de `openssl -days N`, que é relativo ao `Date` do **processo**. Como
 * os dois lados partem do mesmo relógio, o delta se cancela — um serviço que abandonasse o eixo do
 * banco atravessaria os seis casos sem uma linha vermelha. O Gate 1 provou isso com o mutante **M4**
 * (`243/243 passed` com o par de datas vindo de `new Date()`), e é ele que o `CT-865 (b)` reintroduz.
 *
 * Os **Cons da ADR-0026** registram esse modo de falha por escrito: *"nenhum caso comportamental pega
 * a violação enquanto o host estiver no mesmo fuso da função: a única rede é asserção estática, e por
 * isso ela exige prova de falsificação"*. É a mesma rede que a **T7** instalou do lado do banco
 * (`CT-860`/`CT-861`) e que o `CT-612` já mantém sobre a régua — este arquivo a instala na **borda**.
 *
 * E o `CT-864` fecha a outra metade do achado: `derivarEstadoDaVigencia` é **pura, exportada e
 * exercitável sem banco**, e mesmo assim o limiar só era exercitado atravessando HTTP, banco e o
 * relógio que a invariante quer excluir (Iron Law #3). Aqui ele é exercitado onde mora — sem banco,
 * sem HTTP e **sem relógio nenhum** —, e o par `CT-824`/`CT-825` deixa de ser o único guardião dele.
 *
 * ===========================================================================
 * ELE NÃO É `*.e2e.spec.ts`, e a escolha é conteúdo
 * ===========================================================================
 *
 * Nada aqui sobe banco, fila ou servidor: são uma função pura e dois arquivos lidos do disco. Pôr
 * estes casos dentro do arquivo e2e os faria pagar a montagem de ~240 s de instância efêmera para
 * medir aritmética de calendário, e — pior — os poria no mesmo processo cujo relógio eles existem
 * para excluir do eixo.
 */

import { readFile } from 'node:fs/promises';
import { relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { LIMIAR_DE_VENCIMENTO_EM_DIAS } from '@syslocbr/contracts';
import { describe, expect, it } from 'vitest';
// DÉBITO COM GATILHO — D28 · F0/T5 · gatilho JÁ DISPARADO (F1/T2, 2026-08-02)
// (NÃO é uma `DECISÃO FECHADA`: ele agenda uma mudança, não protege o código abaixo.)
// O QUÊ: o import a seguir atravessa a fronteira de `@sysloc/db` por CAMINHO DE ARQUIVO, fora do
//        `exports` e do `files` daquele manifesto. A dependência de workspace está declarada, então
//        não há dependência oculta; o que não existe é FRONTEIRA para os diretórios `test/` — e
//        este arquivo é mais um a repetir o padrão, agora para o acessório de varredura.
// QUANDO FECHA: o gatilho já disparou e o fechamento segue pendente; ele é o mesmo de sempre —
//        declarar o subpath `"./test"` nos manifestos e importar por `@sysloc/<pacote>/test`, ou
//        extrair um `@sysloc/test-utils`.
// POR QUE NÃO AGORA: fechar exige editar os manifestos de três pacotes e todos os consumidores,
//        nenhum deles no escopo desta correção, e o índice de débitos do `CLAUDE.md`.
// ÍNDICE: docs/specs/features/fundacao-stack-nativa/v1/_run/run-report.md §2, D28
import {
  listarFontesTs,
  semComentarios,
  varrerArquivos,
} from '../../../packages/db/test/varredura-de-fontes.ts';
import { derivarEstadoDaVigencia } from '../src/integracoes-bancarias/certificado.service.ts';

/** Teto de um caso que só lê alguns arquivos do disco — nenhuma instância efêmera é montada. */
const LIMITE_DO_CASO_MS = 30_000;

// ===========================================================================
// CT-864 — a derivação decide sem banco, sem HTTP e sem relógio
// ===========================================================================

/** Uma linha da tabela: as duas entradas e o desfecho esperado, declarado **na linha**. */
interface LinhaDaVigencia {
  readonly nome: string;
  readonly validoAte: string;
  readonly dataCorrente: string;
  readonly estado: string;
  readonly dias: number;
}

/**
 * As doze linhas do CT-864 — o esperado é escrito por extenso, e **nunca** derivado de expressão.
 *
 * Derivá-lo faria a asserção reimplementar o SUT dentro do próprio caso, que é o defeito literal
 * registrado em `.claude/rules/testing-stack.md` (*"tabela que exercitava a reimplementação do leitor
 * no próprio verificador"*). As quatro últimas linhas não são folclore de calendário: elas são os
 * lugares onde uma aritmética escrita sobre o fuso **local** produz `29,958…` em vez de `30` — a
 * virada do ano, o fevereiro bissexto e as duas travessias do horário de verão brasileiro (o de 2018
 * começou em 4 de novembro; o de 2019 terminou em 17 de fevereiro).
 */
const LINHAS: readonly LinhaDaVigencia[] = [
  {
    nome: 'linha_1 — 45 dias à frente: VIGENTE com folga',
    validoAte: '2026-09-29',
    dataCorrente: '2026-08-15',
    estado: 'VIGENTE',
    dias: 45,
  },
  {
    nome: 'linha_2 — 31 dias: a borda VIGENTE, o primeiro dia acima do limiar',
    validoAte: '2026-09-15',
    dataCorrente: '2026-08-15',
    estado: 'VIGENTE',
    dias: 31,
  },
  {
    nome: 'linha_3 — 30 dias: a borda FECHADA do lado VENCENDO',
    validoAte: '2026-09-14',
    dataCorrente: '2026-08-15',
    estado: 'VENCENDO',
    dias: 30,
  },
  {
    nome: 'linha_4 — 1 dia: ainda VENCENDO, e o número é 1',
    validoAte: '2026-08-16',
    dataCorrente: '2026-08-15',
    estado: 'VENCENDO',
    dias: 1,
  },
  {
    nome: 'linha_5 — o dia do vencimento: VENCENDO com ZERO, e não VENCIDO',
    validoAte: '2026-08-15',
    dataCorrente: '2026-08-15',
    estado: 'VENCENDO',
    dias: 0,
  },
  {
    nome: 'linha_6 — a validade terminou ontem: VENCIDO com −1',
    validoAte: '2026-08-14',
    dataCorrente: '2026-08-15',
    estado: 'VENCIDO',
    dias: -1,
  },
  {
    nome: 'linha_7 — a validade terminou há dez dias: VENCIDO com −10',
    validoAte: '2026-08-05',
    dataCorrente: '2026-08-15',
    estado: 'VENCIDO',
    dias: -10,
  },
  {
    nome: 'linha_8 — a travessia do ano: 31/12 para 01/01 é UM dia',
    validoAte: '2027-01-01',
    dataCorrente: '2026-12-31',
    estado: 'VENCENDO',
    dias: 1,
  },
  {
    nome: 'linha_9 — fevereiro NÃO bissexto: 28/02 para 01/03 é UM dia',
    validoAte: '2026-03-01',
    dataCorrente: '2026-02-28',
    estado: 'VENCENDO',
    dias: 1,
  },
  {
    nome: 'linha_10 — fevereiro bissexto: 28/02 para 01/03 são DOIS dias',
    validoAte: '2028-03-01',
    dataCorrente: '2028-02-28',
    estado: 'VENCENDO',
    dias: 2,
  },
  {
    nome: 'linha_11 — travessia do INÍCIO do horário de verão (04/11/2018): 22 dias inteiros',
    validoAte: '2018-11-05',
    dataCorrente: '2018-10-14',
    estado: 'VENCENDO',
    dias: 22,
  },
  {
    nome: 'linha_12 — travessia do FIM do horário de verão (17/02/2019): 15 dias inteiros',
    validoAte: '2019-03-01',
    dataCorrente: '2019-02-14',
    estado: 'VENCENDO',
    dias: 15,
  },
];

/** O vetor dos doze estados, na ordem da tabela — escrito por extenso, fora do SUT. */
const ESTADOS_ESPERADOS: readonly string[] = [
  'VIGENTE',
  'VIGENTE',
  'VENCENDO',
  'VENCENDO',
  'VENCENDO',
  'VENCIDO',
  'VENCIDO',
  'VENCENDO',
  'VENCENDO',
  'VENCENDO',
  'VENCENDO',
  'VENCENDO',
];

/** O vetor dos doze números de dias, na ordem da tabela — idem. */
const DIAS_ESPERADOS: readonly number[] = [45, 31, 30, 1, 0, -1, -10, 1, 1, 2, 22, 15];

describe('CT-864 — a vigência é derivada de dois dias de calendário, sem relógio nenhum', () => {
  it.each(LINHAS)('$nome', ({ validoAte, dataCorrente, estado, dias }) => {
    // O objeto INTEIRO por igualdade, e não campo a campo: uma derivação que devolvesse a faixa
    // certa com o número errado — ou um campo a mais — passaria por duas asserções separadas.
    expect(derivarEstadoDaVigencia(validoAte, dataCorrente)).toEqual({
      estado,
      diasParaVencer: dias,
    });
  });

  it('CT-864 — os doze desfechos, em ordem, são exatamente os declarados', () => {
    const obtidos = LINHAS.map(({ validoAte, dataCorrente }) =>
      derivarEstadoDaVigencia(validoAte, dataCorrente),
    );

    expect(obtidos.map((vigencia) => vigencia.estado)).toEqual(ESTADOS_ESPERADOS);
    expect(obtidos.map((vigencia) => vigencia.diasParaVencer)).toEqual(DIAS_ESPERADOS);

    // Todo número é INTEIRO. É a asserção que apanha a aritmética escrita sobre o fuso local: nas
    // quatro últimas linhas ela produziria `0,958…` ou `1,041…`, que `toEqual` sobre um número
    // arredondado no caminho poderia esconder, e que nenhuma faixa denunciaria.
    for (const vigencia of obtidos) {
      expect(Number.isInteger(vigencia.diasParaVencer), JSON.stringify(vigencia)).toBe(true);
    }
  });

  it('CT-864 — as duas bordas da tabela são o limiar PUBLICADO, e não um número escolhido aqui', () => {
    // A âncora que liga a tabela ao contrato: sem ela, mudar o limiar em `@syslocbr/contracts` deixaria
    // as linhas 2 e 3 medindo uma fronteira que não existe mais, e as duas continuariam verdes
    // porque o SUT teria mudado junto.
    const naBordaVencendo = LINHAS[2];
    const naBordaVigente = LINHAS[1];

    expect(naBordaVencendo?.dias).toBe(LIMIAR_DE_VENCIMENTO_EM_DIAS);
    expect(naBordaVigente?.dias).toBe(LIMIAR_DE_VENCIMENTO_EM_DIAS + 1);

    // E o par discrimina: no limiar exato a faixa é `VENCENDO`, um dia acima é `VIGENTE`. Cada
    // metade sozinha aprovaria um limiar aberto (`<`) ou deslizado em um dia.
    expect(naBordaVencendo?.estado).toBe('VENCENDO');
    expect(naBordaVigente?.estado).toBe('VIGENTE');
  });
});

// ===========================================================================
// CT-864 (b) — dia fora de forma LEVANTA, nas duas posições
// ===========================================================================

/**
 * As seis formas recusadas — cada uma quebra a forma canônica por um eixo diferente.
 *
 * Elas existem porque o `throw` de `emDias` não tinha exercício algum: os únicos caminhos até ele
 * atravessavam banco e HTTP, e ali a data **sempre** chega bem formada. Um `NaN` seguindo adiante
 * produziria `diasParaVencer: null` no corpo publicado, e a rota mentiria sobre um certificado que
 * existe.
 */
const FORMAS_RECUSADAS: readonly string[] = [
  '2026-8-15',
  '2026-08-1',
  '15/08/2026',
  '2026-08-15T00:00:00.000Z',
  '2026-08-15 ',
  '',
];

/** A mensagem literal da recusa — escrita aqui, e não lida do SUT, que concordaria consigo mesmo. */
const MENSAGEM_DA_FORMA_INVALIDA = 'o eixo de data da operação não veio na forma AAAA-MM-DD';

/** Um dia bem formado, o companheiro positivo de cada linha recusada. */
const DIA_BEM_FORMADO = '2026-08-15';

describe('CT-864 (b) — dia fora da forma AAAA-MM-DD levanta em vez de virar NaN', () => {
  it.each(FORMAS_RECUSADAS)('a forma "%s" é recusada nas DUAS posições', (forma) => {
    // As duas posições, e não só a primeira: a validade e a data corrente passam pela mesma
    // conversão, e uma guarda escrita só num dos dois ramos passaria por metade do caso.
    expect(() => derivarEstadoDaVigencia(forma, DIA_BEM_FORMADO)).toThrowError(
      MENSAGEM_DA_FORMA_INVALIDA,
    );
    expect(() => derivarEstadoDaVigencia(DIA_BEM_FORMADO, forma)).toThrowError(
      MENSAGEM_DA_FORMA_INVALIDA,
    );
  });

  it('CT-864 (b) — o COMPANHEIRO POSITIVO: as duas posições bem formadas não levantam', () => {
    // Sem ele, uma implementação que levantasse para **toda** entrada passaria nas doze linhas
    // acima, e o caso inteiro viraria decoração.
    expect(() => derivarEstadoDaVigencia(DIA_BEM_FORMADO, DIA_BEM_FORMADO)).not.toThrow();
  });
});

// ===========================================================================
// CT-865 — o caminho de decisão da borda não alcança o relógio do processo
// ===========================================================================

/**
 * ⚠️ **Este é o caso que o Gate 1 exigiu na rodada 1, e a razão é o modo de falha do defeito.**
 *
 * `derivarEstadoDaVigencia` é **pura** e recebe os dois dias **por parâmetro**. A consequência é
 * dura, e igual à do `CT-612`: **nenhum caso comportamental pode pegar um erro na ORIGEM desses
 * parâmetros**. Trocar `lerVigenciaObservada(tx, …)` por `new Date()` na borda **passa em toda a
 * suíte** — o host está em `America/Sao_Paulo`, o mesmo fuso da operação, e as duas leituras
 * coincidem. O defeito só aparece no dia em que o processo rodar sob outro fuso, ou na virada do dia:
 * `TZ` não é declarada pela unidade systemd da API, e sob UTC a consulta responderia um dia a mais
 * ou a menos que a recusa do registro (RN-03, no banco) sobre o mesmo certificado.
 *
 * Esta asserção estática é a **única** rede desse defeito, e é o que os Cons da ADR-0026 prescrevem.
 * Ela mede duas coisas independentes, e **cada uma sozinha** reprova o mutante M4:
 *
 *   * a **ausência** das doze formas pelas quais o relógio ou o fuso do processo são lidos em
 *     TypeScript, em posição executável, em todo o diretório da borda bancária;
 *   * o **vínculo**: os dois argumentos da derivação são campos do **mesmo** identificador que
 *     recebeu `await lerVigenciaObservada(`. É a perna positiva, e sem ela *"não há relógio"* seria
 *     verdade vazia sobre um `publicar` que não chamasse nada.
 *
 * ---------------------------------------------------------------------------
 * MUTANTE EXECUTADO sobre o SUT (2026-08-15) — o M4, do Gate 1
 * ---------------------------------------------------------------------------
 *
 * Além da falsificação PERMANENTE na suíte (o `CT-865 (b)`, sobre uma cópia em memória), o defeito
 * foi reintroduzido **no fonte de produção** e medido. Invocado pelo **script do pacote**
 * (`pnpm --filter @sysloc/api test`), nunca por `vitest run` avulso — os pacotes resolvem `"."` para
 * `dist/`, e verde de invocação avulsa se leria como *"sobreviveu"*, invertendo a conclusão.
 *
 *   * **controle** — árvore íntegra: ver a contagem do sumário da rodada;
 *   * **M4 · o par de datas vindo do relógio do processo** — em
 *     `apps/api/src/integracoes-bancarias/certificado.service.ts`, método `publicar`, a chamada a
 *     `lerVigenciaObservada` **mantida** (para o compilador) e a derivação passando a receber
 *     {@link DERIVACAO_DO_M4}. É a forma exata que o Gate 1 aplicou, e sobre a qual **os seis casos
 *     e2e ficaram todos verdes** (`243/243 passed`) na rodada 1;
 *   * **reversão** — o fonte restaurado do backup e conferido idêntico por `diff`.
 */

/** O diretório da borda bancária — o alvo declarado da varredura. Ausência dele LEVANTA. */
const FONTE_DA_BORDA_BANCARIA = fileURLToPath(
  new URL('../src/integracoes-bancarias', import.meta.url),
);

/** O fonte do serviço — o sujeito do vínculo e da falsificação. */
const CAMINHO_DO_SERVICO = fileURLToPath(
  new URL('../src/integracoes-bancarias/certificado.service.ts', import.meta.url),
);

/**
 * As doze formas de alcançar o relógio ou o fuso do **processo**, escritas por extenso.
 *
 * Literais, e não derivadas de nada: é esta lista que declara **o que** o caso proíbe, e o detector
 * abaixo é composto a partir dela — a lista e o que se procura são o mesmo fato.
 *
 * ⚠️ **`Date.UTC(` NÃO está aqui, e a ausência é a decisão.** Ele é a única operação de data legítima
 * nesta borda: aritmética fechada sobre dois dias que **chegaram por parâmetro**, sem ler relógio e
 * sem consultar fuso — é o que torna a subtração exata (ver o docblock de `emDias`). Proibi-lo
 * reprovaria o código correto. O que se proíbe são as leituras que consultam o **ambiente do
 * processo**: o instante corrente e o fuso em que ele roda.
 */
const ALCANCES_DO_RELOGIO_DO_PROCESSO: readonly string[] = [
  'new Date(',
  'Date.now(',
  'getFullYear(',
  'getMonth(',
  'getDate(',
  'getHours(',
  'getMinutes(',
  'getTimezoneOffset(',
  'toLocaleDateString(',
  'toLocaleString(',
  'Intl.DateTimeFormat(',
  'process.env.TZ',
];

/** O detector, composto a partir da lista acima — ver {@link ALCANCES_DO_RELOGIO_DO_PROCESSO}. */
const ALCANCE_DE_RELOGIO = new RegExp(
  ALCANCES_DO_RELOGIO_DO_PROCESSO.map((forma) =>
    forma.replace(/[.()[\]{}*+?^$|\\]/g, (caractere) => `\\${caractere}`),
  ).join('|'),
);

/**
 * O vínculo: quem recebe a vigência observada do banco.
 *
 * A âncora é o **nome do símbolo de leitura**, e não a posição no arquivo — a posição se move na
 * primeira edição, e o nome só muda quando a função de domínio mudar de nome.
 */
const LIGACAO_COM_O_BANCO =
  /(?:const|let)\s+([A-Za-z_$][\w$]*)[^=\n]*=\s*await\s+lerVigenciaObservada\(/;

/**
 * A derivação alimentada pelos **dois** campos do **mesmo** identificador.
 *
 * A retrorreferência `\1` é o mecanismo: ela é o que separa *"os dois argumentos vêm da vigência
 * observada"* de *"um deles vem de outro lugar"* — que é exatamente a forma do M4, em que
 * `fimDaValidade` sai da coluna e `dataCorrente` sai do relógio do processo.
 */
const DERIVACAO_LIGADA =
  /derivarEstadoDaVigencia\(\s*([A-Za-z_$][\w$]*)\.fimDaValidade,\s*\1\.dataCorrente\s*\)/;

/** A expressão ÍNTEGRA da derivação — a âncora que garante que o mutante foi mesmo aplicado. */
const DERIVACAO_INTEGRA =
  'derivarEstadoDaVigencia(observada.fimDaValidade, observada.dataCorrente)';

/**
 * O defeito literal que a falsificação injeta: as duas datas derivadas do relógio do **processo**.
 *
 * É o mutante **M4** do Gate 1, byte a byte na forma em que ele foi medido — e é a forma que um
 * autor futuro escreveria por conveniência, porque dispensa `tx` e produz o mesmo resultado nesta
 * máquina.
 */
const DERIVACAO_DO_M4 = [
  'derivarEstadoDaVigencia(',
  'gravado.validoAte.toISOString().slice(0, 10),',
  'new Date().toISOString().slice(0, 10),',
  ')',
].join('\n      ');

describe('CT-865 — a data corrente da borda vem do banco, e não do relógio do processo', () => {
  it(
    'CT-865 — zero alcances do relógio do processo em apps/api/src/integracoes-bancarias',
    async () => {
      // Diretório ausente LEVANTA — é a decisão do acessório, e é ela que impede a cobertura de cair
      // a zero em silêncio quando um alvo é renomeado.
      const arquivos = await listarFontesTs(FONTE_DA_BORDA_BANCARIA);
      const varredura = await varrerArquivos(arquivos, (linha) => ALCANCE_DE_RELOGIO.test(linha));

      // Âncora de não-vacuidade em valor EXATO: "nenhum alcance de relógio" sobre zero arquivos
      // lidos é verdade vazia, e é assim que esta asserção apodreceria em silêncio.
      expect(varredura.arquivos).toBe(arquivos.length);
      expect(varredura.arquivos).toBeGreaterThan(0);

      expect(
        varredura.ocorrencias.map((lugar) => relative(FONTE_DA_BORDA_BANCARIA, lugar)),
        `o relógio do processo foi alcançado onde a data tem de vir do banco (ADR-0026): ${varredura.linhas.join(' | ')}`,
      ).toEqual([]);
    },
    LIMITE_DO_CASO_MS,
  );

  it(
    'CT-865 — os DOIS argumentos da derivação saem do mesmo resultado de lerVigenciaObservada',
    async () => {
      const executavel = semComentarios(await readFile(CAMINHO_DO_SERVICO, 'utf8'));

      // A perna POSITIVA, em duas metades que se amarram pelo nome. Sem ela, a varredura acima
      // ficaria verde sobre um `publicar` que não lesse a vigência do banco nem derivasse nada — a
      // ausência de relógio é trivialmente verdadeira em quem não decide coisa alguma.
      const ligacao = LIGACAO_COM_O_BANCO.exec(executavel);

      expect(
        ligacao?.[1],
        'nada recebe o resultado de lerVigenciaObservada na borda',
      ).toBeDefined();

      const derivacao = DERIVACAO_LIGADA.exec(executavel);

      expect(
        derivacao?.[1],
        'os dois argumentos da derivação não saem do MESMO resultado observado no banco',
      ).toBe(ligacao?.[1]);
    },
    LIMITE_DO_CASO_MS,
  );

  it(
    'CT-865 (b) — as MESMAS medições REPROVAM o mutante M4 e passam limpas no fonte íntegro',
    async () => {
      const integro = await readFile(CAMINHO_DO_SERVICO, 'utf8');

      // CONTROLE: o fonte como ele está na árvore.
      expect(alcancesDeRelogioDe(integro)).toEqual([]);
      expect(vinculoDaDerivacaoDe(integro)).toBe(true);

      // Âncora do mutante: se a expressão íntegra mudar de forma, a substituição abaixo não aplicaria
      // defeito nenhum e o caso passaria em silêncio provando nada. Ela reprova em vez disso.
      expect(
        semComentarios(integro),
        'a expressão íntegra da derivação mudou: o mutante M4 não seria aplicado',
      ).toContain(DERIVACAO_INTEGRA);

      // MUTANTE: o mesmo fonte com o par de datas vindo do relógio do processo. A cópia vive em
      // memória — escrever no disco durante a suíte deixaria o defeito no fonte se o processo
      // morresse no meio. Um detector que devolvesse sempre `[]` passaria no controle e reprovaria
      // aqui; um que devolvesse sempre algo faria o contrário. Nenhum dos dois passa nos dois.
      const comM4 = integro.replace(DERIVACAO_INTEGRA, DERIVACAO_DO_M4);

      expect(alcancesDeRelogioDe(comM4)).toEqual(['new Date(']);
      expect(vinculoDaDerivacaoDe(comM4)).toBe(false);
    },
    LIMITE_DO_CASO_MS,
  );
});

/** Os alcances do relógio do processo em posição executável, na ordem em que aparecem. */
function alcancesDeRelogioDe(fonte: string): string[] {
  const global = new RegExp(ALCANCE_DE_RELOGIO.source, 'g');

  return [...semComentarios(fonte).matchAll(global)].map((achado) => achado[0]);
}

/** Se os dois argumentos da derivação saem do mesmo identificador que recebeu a vigência do banco. */
function vinculoDaDerivacaoDe(fonte: string): boolean {
  const executavel = semComentarios(fonte);
  const ligacao = LIGACAO_COM_O_BANCO.exec(executavel);
  const derivacao = DERIVACAO_LIGADA.exec(executavel);

  return ligacao?.[1] !== undefined && ligacao[1] === derivacao?.[1];
}
