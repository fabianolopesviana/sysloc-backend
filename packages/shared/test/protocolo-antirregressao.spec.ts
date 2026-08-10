/**
 * Barreira executável do Protocolo Antirregressão — CT-901 a CT-910.
 *
 * A faixa **CT-9xx é deliberada**: estes casos não provam regra de domínio, provam o substrato do
 * pipeline. A sequência de domínio cresce fatia a fatia (a F3 já alocou até CT-545) e alcançaria
 * qualquer faixa baixa que se escolhesse — a primeira versão deste arquivo nasceu em CT-501 e
 * colidiu inteira com a fatia de cobrança. Casos de meta-verificação ficam no 9xx, fora do caminho.
 *
 * ---------------------------------------------------------------------------
 * INVARIANTES
 * ---------------------------------------------------------------------------
 *
 * | CT     | Invariante |
 * |--------|------------|
 * | CT-901 | A rule do protocolo declara escopo de carregamento UNIVERSAL (`paths: - "**"`). |
 * | CT-902 | O núcleo do protocolo está íntegro: 5 passos, 3 formas de regressão, **exatamente**
 * |        | 7 proibições, e as 3 linhas de declaração nomeadas literalmente. |
 * | CT-903 | O `CLAUDE.md` aponta para a rule e carrega o resumo mínimo com os 4 itens. |
 * | CT-904 | Nenhum contrato de agente DUPLICA o texto normativo do protocolo. |
 * | CT-905 | Os dentes existem: as âncoras de L1 (Gate 2), L2 (Gate 1), L3 (fonte única de
 * |        | severidade) e L4 (bloco injetado) estão nos arquivos onde foram instaladas. |
 * | CT-906 | As 3 cópias do bloco de disciplina do executor são byte-idênticas. |
 * | CT-907 | O índice de débito fecha nas DUAS pontas, e todo campo `ÍNDICE` de marcador vivo
 * |        | aponta para arquivo existente. |
 *
 * ---------------------------------------------------------------------------
 * Por que uma barreira, e por que ELA e não outra coisa
 * ---------------------------------------------------------------------------
 *
 * O protocolo é texto normativo em arquivo de configuração. Sem barreira, ele é vinculante e sem
 * dentes: nada fica vermelho quando alguém "consolida" uma seção seis meses depois, e o
 * esvaziamento é indistinguível do estado saudável. As sete asserções acima provam o **substrato**
 * de que o protocolo depende — o mecanismo que o entrega, o núcleo que não pode ser resumido, as
 * ligações que o alcançam, e os pontos onde ele ganhou capacidade de reprovar.
 *
 * **Ela não julga prosa.** Toda asserção é presença, contagem ou igualdade — verificável sem
 * interpretar texto. Julgar mérito de redação seria asserção que ninguém consegue manter verde.
 *
 * ---------------------------------------------------------------------------
 * Três decisões de construção que separam barreira de teatro — leia antes de "simplificar"
 * ---------------------------------------------------------------------------
 *
 * 1. **`recortarSecao` LANÇA quando a âncora falta; não devolve string vazia.** A forma idiomática
 *    (`texto.slice(texto.indexOf(ancora))`) é uma armadilha exata: com a âncora ausente — que é
 *    precisamente o defeito perseguido — `indexOf` devolve `-1` e `slice(-1)` devolve o **último
 *    caractere**, uma string não-vazia que passa em qualquer asserção de "não está vazio". A
 *    asserção fica decorativa e ninguém percebe.
 *
 * 2. **Controle de não-cegueira (CT-908 e CT-909).** Uma varredura que hoje não encontra alvo fica
 *    verde por não enxergar, e uma expressão de busca quebrada fica verde igual. Os dois casos
 *    provam que a detecção discrimina (fixtures positiva e negativa) e que a varredura enxerga
 *    arquivos de verdade, excluindo saída de build.
 *
 * 3. **Este arquivo se exclui da varredura, de propósito.** Ele cita os nomes dos marcadores como
 *    dado; sem a exclusão, a barreira acusaria a si mesma e o índice do `CLAUDE.md` teria de
 *    listar um débito que não existe.
 *
 * Fronteira real exercida: **filesystem**. Não há dublê — a barreira lê os arquivos versionados
 * exatamente como um agente os lê.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const RAIZ = resolve(import.meta.dirname, '..', '..', '..');

const CAMINHO_DA_RULE = '.claude/rules/nao-regressao.md';
const CAMINHO_DAS_INSTRUCOES = 'CLAUDE.md';
const FONTE_DE_SEVERIDADE = '.claude/rules/agent-spec-workflow-rules.md';
const CONTRATO_GATE_1 = '.claude/agents/agent-spec-qa-validator.md';
const CONTRATO_GATE_2 = '.claude/agents/agent-spec-staff-architecture-review.md';

const COPIAS_DA_DISCIPLINA = [
  '.claude/skills/agent-spec-sdd-run-tasks/references/executor-discipline.md',
  '.claude/skills/agent-spec-minispec-run-tasks/references/executor-discipline.md',
  '.claude/skills/agent-spec-taskcard-run/references/executor-discipline.md',
];

/** Diretórios varridos em busca de marcadores vivos. */
const AREAS_DE_CODIGO = ['apps', 'packages', 'deploy'];

/**
 * Este arquivo cita os marcadores como dado. Sem a exclusão, a varredura o encontraria e o
 * CT-907 exigiria uma linha no índice do `CLAUDE.md` para um débito que não existe.
 */
const ARQUIVO_DESTA_BARREIRA = relative(RAIZ, import.meta.filename);

const ler = (caminhoRelativo: string): string => readFileSync(join(RAIZ, caminhoRelativo), 'utf8');

/**
 * Recorta o trecho entre duas âncoras, **lançando** quando qualquer uma falta.
 *
 * Ver a decisão de construção 1 no cabeçalho: a variante com `slice(indexOf())` devolve o último
 * caractere quando a âncora some, e transforma a asserção em decoração.
 */
function recortarSecao(texto: string, ancoraInicio: string, ancoraFim: string): string {
  const inicio = texto.indexOf(ancoraInicio);
  if (inicio === -1) {
    throw new Error(`âncora de início ausente: ${JSON.stringify(ancoraInicio)}`);
  }
  const fim = texto.indexOf(ancoraFim, inicio + ancoraInicio.length);
  if (fim === -1) {
    throw new Error(`âncora de fim ausente: ${JSON.stringify(ancoraFim)}`);
  }
  return texto.slice(inicio, fim);
}

/** Identificador canônico de um débito: `D{n} · F{n}/{origem}` (§3-B da rule). */
const PADRAO_DE_MARCADOR = /DÉBITO COM GATILHO — (D\d+ · F\d+\/[A-Za-zç]+\d*)/g;
const PADRAO_DE_LINHA_DE_INDICE = /^\| \*\*(D\d+)\*\* \((F\d+\/[A-Za-zç]+\d*)/gm;
const PADRAO_DE_CAMPO_INDICE = /ÍNDICE:\s*(\S+\.md)/g;

/**
 * Memória da varredura.
 *
 * A árvore de arquivos não muda durante a execução, e quatro casos consomem estes dois
 * resultados. Sem a memória, cada um refaz a caminhada e relê todo o repositório — quatro
 * varreduras completas. Isolado o arquivo cabia no teto de caso; sob a suíte inteira (arquivos
 * em paralelo, mais as instâncias efêmeras de banco disputando CPU e IO) não cabia, e os casos
 * expiravam. Memoizar é o conserto da causa; alargar o teto seria conserto do sintoma, e deixaria
 * o custo pronto para voltar assim que um quinto caso consumisse a função.
 */
let memoriaDosArquivos: string[] | undefined;
let memoriaDosMarcadores: Set<string> | undefined;

function arquivosDeCodigo(): string[] {
  if (memoriaDosArquivos !== undefined) return memoriaDosArquivos;

  const encontrados: string[] = [];
  for (const area of AREAS_DE_CODIGO) {
    for (const entrada of readdirSync(join(RAIZ, area), {
      recursive: true,
      withFileTypes: true,
    })) {
      if (!entrada.isFile()) continue;
      const absoluto = join(entrada.parentPath, entrada.name);
      const caminho = relative(RAIZ, absoluto);
      const segmentos = caminho.split('/');
      // `dist/` é saída de build e espelha o comentário do fonte: sem a exclusão o mesmo
      // marcador é contado duas vezes.
      if (segmentos.includes('dist')) continue;
      // `node_modules/` guarda os symlinks que o pnpm cria para os pacotes do workspace. Sem
      // esta exclusão a varredura alcança CADA arquivo do monorepo por caminhos não-canônicos
      // (`packages/auth/node_modules/@sysloc/db/node_modules/@sysloc/shared/test/...`), o que
      // infla a contagem e faz a exclusão por igualdade de caminho — inclusive a deste próprio
      // arquivo — nunca casar.
      if (segmentos.includes('node_modules')) continue;
      if (caminho === ARQUIVO_DESTA_BARREIRA) continue;
      if (!/\.(ts|js|sh|sql|json|md)$/.test(caminho)) continue;
      encontrados.push(caminho);
    }
  }
  memoriaDosArquivos = encontrados;
  return encontrados;
}

function marcadoresVivos(): Set<string> {
  if (memoriaDosMarcadores !== undefined) return memoriaDosMarcadores;

  const identificadores = new Set<string>();
  for (const caminho of arquivosDeCodigo()) {
    const conteudo = readFileSync(join(RAIZ, caminho), 'utf8');
    for (const achado of conteudo.matchAll(PADRAO_DE_MARCADOR)) {
      identificadores.add(achado[1] as string);
    }
  }
  memoriaDosMarcadores = identificadores;
  return identificadores;
}

describe('CT-901 — a rule do protocolo carrega em TODA sessão', () => {
  it('declara escopo de carregamento universal', () => {
    const frontmatter = recortarSecao(ler(CAMINHO_DA_RULE), '---', '---');

    // Sem escopo universal a rule não chega a sessão nenhuma, e o protocolo deixa de existir
    // sem que nada fique vermelho — é a falha mais silenciosa possível.
    expect(frontmatter).toContain('paths:');
    expect(frontmatter).toMatch(/paths:\s*\n\s*-\s*"\*\*"/);
  });
});

describe('CT-902 — o núcleo do protocolo está íntegro', () => {
  const rule = ler(CAMINHO_DA_RULE);

  it('mantém os 5 passos do protocolo, nomeados', () => {
    const passos = rule.match(/^### P[1-5] ·/gm) ?? [];
    expect(passos).toHaveLength(5);
  });

  it('mantém as 3 formas de regressão', () => {
    for (const forma of ['**R1**', '**R2**', '**R3**']) {
      expect(rule).toContain(forma);
    }
  });

  it('mantém EXATAMENTE 7 proibições absolutas', () => {
    const secao = recortarSecao(rule, '## 4. Proibições absolutas', '## 5.');
    const proibicoes = secao.match(/^\d+\. \*\*Nunca/gm) ?? [];

    // A contagem exata é o ponto: "6 proibições" continua parecendo lista completa, e um resumo
    // bem-intencionado é a forma mais provável de perder uma delas.
    expect(proibicoes).toHaveLength(7);
  });

  it('nomeia literalmente as 3 linhas da declaração do P3', () => {
    for (const linha of [
      'CAUSA-RAIZ:',
      'POR QUE ISTO FECHA A CLASSE:',
      'O QUE ESTA MUDANÇA REMOVE:',
    ]) {
      expect(rule).toContain(linha);
    }
  });
});

describe('CT-903 — o arquivo de instruções liga o protocolo e não o resume a menos', () => {
  const instrucoes = ler(CAMINHO_DAS_INSTRUCOES);

  it('aponta para o caminho da rule', () => {
    expect(instrucoes).toContain(CAMINHO_DA_RULE);
  });

  it('carrega o resumo mínimo com os 4 itens', () => {
    // Âncora curta de propósito: o arquivo é quebrado em ~100 colunas com prefixo de citação,
    // e a frase completa atravessa a quebra de linha ("O mínimo que todo agente\n> carrega...").
    const resumo = recortarSecao(instrucoes, 'O mínimo que todo agente', '**Fronteira**');
    const itens = resumo.match(/^> \d+\. \*\*/gm) ?? [];

    // Resumir o resumo é o erro clássico: cada item perdido some sem deixar rastro.
    expect(itens).toHaveLength(4);
  });
});

describe('CT-904 — nenhum contrato de agente duplica o texto do protocolo', () => {
  it('nenhum agente reproduz as seções normativas da rule', () => {
    const secoesNormativas = ['## 4. Proibições absolutas', '## 2. Protocolo obrigatório'];

    for (const arquivo of readdirSync(join(RAIZ, '.claude/agents'))) {
      if (!arquivo.endsWith('.md')) continue;
      const conteudo = ler(join('.claude/agents', arquivo));
      for (const secao of secoesNormativas) {
        // Duas cópias divergem, e a cópia é sempre a desatualizada. Agentes APONTAM para a
        // rule; quem a carrega é o system-prompt.
        expect(conteudo, `${arquivo} duplica "${secao}"`).not.toContain(secao);
      }
    }
  });
});

describe('CT-905 — os dentes estão instalados onde reprovam', () => {
  it('L1 · o Gate 2 detecta regressão de decisão e garantia removida', () => {
    const gate2 = ler(CONTRATO_GATE_2);
    expect(gate2).toContain('DECISÃO FECHADA');
    expect(gate2).toContain('Garantia removida');
    expect(gate2).toContain('O QUE ESTA MUDANÇA REMOVE');
  });

  it('L2 · o Gate 1 conta casos por unidade e compara entre rodadas', () => {
    const gate1 = ler(CONTRATO_GATE_1);
    expect(gate1).toContain('contagem_por_unidade');
    expect(gate1).toContain('weakening_test_to_pass');
  });

  it('L3 · a escrituração tem severidade fixa na fonte única', () => {
    expect(ler(FONTE_DE_SEVERIDADE)).toContain('Escrituração de débito ⇒ severidade fixa BAIXO');
  });

  it('L4 · a precedência chega ao executor DENTRO do bloco extraído', () => {
    for (const copia of COPIAS_DA_DISCIPLINA) {
      // O bloco é recortado entre delimitadores antes de ir ao prompt: conteúdo escrito fora
      // deles é cortado na extração e nunca alcança o executor — falha silenciosa total.
      const bloco = recortarSecao(
        ler(copia),
        '## Disciplina do Executor (Iron Rules)',
        'EXECUTOR_DISCIPLINE>>>',
      );
      expect(bloco, copia).toContain('Protocolo Antirregressão');
      expect(bloco, copia).toContain('POR QUE ISTO FECHA A CLASSE:');
      expect(bloco, copia).toContain('Garantias removidas');
    }
  });
});

describe('CT-906 — as 3 cópias do bloco de disciplina não divergem', () => {
  it('são byte-idênticas', () => {
    const [primeira, ...demais] = COPIAS_DA_DISCIPLINA.map(ler);
    for (const [indice, copia] of demais.entries()) {
      // Não são symlinks: editar uma à mão deixa as outras com a versão antiga, e o framework
      // não editado segue rodando a política antiga sem que nada acuse.
      expect(copia, COPIAS_DA_DISCIPLINA[indice + 1]).toBe(primeira);
    }
  });
});

describe('CT-907 — o índice de débito fecha nas duas pontas', () => {
  const instrucoes = ler(CAMINHO_DAS_INSTRUCOES);

  const doIndice = new Set(
    [...instrucoes.matchAll(PADRAO_DE_LINHA_DE_INDICE)].map(
      (achado) => `${achado[1]} · ${achado[2]}`,
    ),
  );

  it('todo marcador vivo no código tem linha no índice', () => {
    for (const identificador of marcadoresVivos()) {
      expect(doIndice, `marcador órfão: ${identificador}`).toContain(identificador);
    }
  });

  it('toda linha do índice tem marcador vivo no código', () => {
    const vivos = marcadoresVivos();
    for (const identificador of doIndice) {
      // A direção contrária do marcador órfão: débito já fechado que ficou no índice mente
      // sobre o estado do código, e o índice chega a TODO agente antes de qualquer arquivo.
      expect(vivos, `linha órfã no índice: ${identificador}`).toContain(identificador);
    }
  });

  it('todo campo ÍNDICE aponta para arquivo existente', () => {
    const alvos = new Set<string>();
    for (const caminho of arquivosDeCodigo()) {
      const conteudo = readFileSync(join(RAIZ, caminho), 'utf8');
      for (const achado of conteudo.matchAll(PADRAO_DE_CAMPO_INDICE)) {
        alvos.add(achado[1] as string);
      }
    }

    expect(alvos.size).toBeGreaterThan(0);
    for (const alvo of alvos) {
      // O marcador é ponteiro; sem alvo ele apodrece.
      expect(() => ler(alvo), `ÍNDICE aponta para caminho inexistente: ${alvo}`).not.toThrow();
    }
  });
});

describe('CT-908 — controle de não-cegueira da detecção de marcador', () => {
  it('a expressão POSITIVA reconhece um marcador na forma canônica', () => {
    const exemplo = '// DÉBITO COM GATILHO — D99 · F7/T3 · registrado 2026-01-01';
    const achados = [...exemplo.matchAll(PADRAO_DE_MARCADOR)];
    expect(achados).toHaveLength(1);
    expect(achados[0]?.[1]).toBe('D99 · F7/T3');
  });

  it('a expressão NEGATIVA recusa o marcador irmão e formas incompletas', () => {
    // `DECISÃO FECHADA` protege e `DÉBITO COM GATILHO` agenda: confundir os dois congela o que
    // deveria mudar. A varredura não pode casar um pelo outro.
    for (const contraexemplo of [
      '// DECISÃO FECHADA — T3 / Gate 2 · 2026-07-31',
      '// DÉBITO COM GATILHO — sem identificador',
      '// DÉBITO COM GATILHO — D99 sem origem',
    ]) {
      expect([...contraexemplo.matchAll(PADRAO_DE_MARCADOR)]).toHaveLength(0);
    }
  });

  it('a expressão do índice reconhece a linha da tabela e recusa menção em prosa', () => {
    const linha = '| **D44** (F2/T10, fatia `contratos-de-locacao`) | `arquivo.ts` | quando ... |';
    expect([...linha.matchAll(PADRAO_DE_LINHA_DE_INDICE)]).toHaveLength(1);

    const prosa = 'o **D44** (F2/T10) foi fechado na intervenção dirigida';
    expect([...prosa.matchAll(PADRAO_DE_LINHA_DE_INDICE)]).toHaveLength(0);
  });
});

describe('CT-909 — controle de não-vacuidade da varredura', () => {
  it('a varredura enxerga arquivos de verdade e exclui saída de build', () => {
    const arquivos = arquivosDeCodigo();

    // Sem este controle, uma varredura quebrada (caminho errado, filtro que casa nada) ficaria
    // verde por não enxergar — e as asserções do CT-907 seriam vacuamente verdadeiras.
    expect(arquivos.length).toBeGreaterThan(50);
    expect(arquivos.some((caminho) => caminho.split('/').includes('dist'))).toBe(false);
    // Defeito medido durante a construção desta barreira: o pnpm symlinka os pacotes do
    // workspace dentro de `node_modules`, e a varredura alcançava cada arquivo várias vezes por
    // caminho não-canônico — inflando a contagem e furando toda exclusão por igualdade.
    expect(arquivos.some((caminho) => caminho.split('/').includes('node_modules'))).toBe(false);
    expect(arquivos).not.toContain(ARQUIVO_DESTA_BARREIRA);
    // O caminho canônico deste arquivo TEM de ser o que a varredura veria — senão a exclusão
    // acima é vacuamente verdadeira e o CT-907 volta a acusar a si mesmo.
    expect(ARQUIVO_DESTA_BARREIRA).toBe('packages/shared/test/protocolo-antirregressao.spec.ts');
  });

  it('a varredura encontra ao menos um marcador vivo', () => {
    // Se um dia o último marcador sair, a §3-B manda apagar o bloco do `CLAUDE.md` inteiro — e
    // este caso é o que obriga a revisitar a barreira em vez de deixá-la vacuamente verde.
    expect(marcadoresVivos().size).toBeGreaterThan(0);
  });
});

describe('CT-910 — a comparação de contagem não mede replay de cache', () => {
  it('a tarefa de teste do orquestrador de build declara cache desligado', () => {
    const turbo = ler('turbo.json');
    const tarefaDeTeste = recortarSecao(turbo, '"test": {', '}');

    // Se o runner reaproveitar resultado cacheado, a "contagem anterior" do CT-905/L2 é replay,
    // e a comparação passa a provar que o cache está íntegro — não que os testes estão.
    expect(tarefaDeTeste).toContain('"cache": false');
  });
});
