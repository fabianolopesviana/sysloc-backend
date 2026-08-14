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
 * | CT-638 | O contrato da fila tem definição ÚNICA em `packages/shared/src/fila.ts`, é consumido
 * |        | pela fronteira do pacote, e o D32 saiu do código E do índice — as duas pontas. |
 *
 * **Por que o CT-638 foge da faixa 9xx**: os casos acima nasceram com a barreira e provam o
 * substrato do pipeline; este prova o **fecho de um débito concreto** (o D32 · F0/T6) e teve o
 * número alocado pelo plano da fatia `regua-de-cobranca`, que é quem o fecha. O número está
 * reservado lá — a colisão que motivou a faixa 9xx não se aplica a ele. Caso de meta-verificação
 * que nasça **aqui**, sem dono numa fatia, continua entrando no 9xx.
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
import { beforeAll, describe, expect, it } from 'vitest';

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

/** Onde o contrato da fila passou a morar quando o D32 fechou. */
const CASA_DO_CONTRATO_DA_FILA = 'packages/shared/src/fila.ts';

/** O consumidor que existia antes do fecho, e que agora importa em vez de definir. */
const CONSUMIDOR_DO_CONTRATO_DA_FILA = 'apps/worker/src/fila.ts';

/** O débito fechado nesta fatia, no identificador canônico da §3-B (`D{n} · F{n}/{origem}`). */
const IDENTIFICADOR_DO_D32 = 'D32 · F0/T6';

/**
 * Os símbolos do contrato da fila — nome, política de repetição e cargas.
 *
 * A lista é o que o D32 mandava extrair, e cada um deles é um ponto onde a duplicação reabre: o
 * nome desencontra produtor e consumidor em silêncio, e as opções valem só para a instância que as
 * declara.
 */
const SIMBOLOS_DO_CONTRATO_DA_FILA = [
  'CargaDaRegua',
  'CargaDoEco',
  'ESPERA_ENTRE_TENTATIVAS_MS',
  'FILA_DA_REGUA',
  'FILA_DO_ECO',
  'OPCOES_PADRAO_DA_TAREFA',
  'TAREFAS_CONCLUIDAS_RETIDAS',
  'TAREFAS_FALHAS_RETIDAS',
  'TENTATIVAS_POR_TAREFA',
];

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

/**
 * Reconhece a **definição** de um símbolo — nunca a menção nem o import dele.
 *
 * A distinção é o caso inteiro: a asserção do CT-638 mede quantos arquivos **definem** cada
 * símbolo, e uma expressão que casasse `OPCOES_PADRAO_DA_TAREFA,` numa lista de import contaria
 * todo consumidor legítimo como redefinição — a contagem passaria de 1 e o caso reprovaria a
 * árvore correta. A discriminação é exercitada no controle de não-cegueira, abaixo.
 *
 * **O que vem DEPOIS do nome é obrigatório**, e não ornamento: medido durante a construção deste
 * caso, a forma curta (`(?:const|…|type)\s+NOME`) casava a linha `  type CargaDaRegua,` de uma
 * lista de import de várias linhas — e acusava como redefinição tanto o consumidor quanto o
 * próprio barril do pacote. Declaração de valor é seguida de `=` ou de anotação; apelido de tipo é
 * seguido de `=`; e `interface`/`class`/`function`/`enum` já se distinguem pela palavra.
 */
function definicaoDe(simbolo: string): RegExp {
  return new RegExp(
    `^\\s*(?:export\\s+)?(?:(?:const|let|var)\\s+${simbolo}\\s*[:=]` +
      `|(?:function|class|interface|enum)\\s+${simbolo}\\b` +
      `|type\\s+${simbolo}\\s*=)`,
    'm',
  );
}

/**
 * Para cada símbolo do contrato da fila, os arquivos versionados que o **definem**.
 *
 * Uma passada só sobre a árvore, pela mesma razão que a varredura de marcadores é memoizada: três
 * casos consomem este resultado, e refazer a caminhada em cada um estourava o teto sob a suíte
 * completa.
 */
let memoriaDasDefinicoes: Map<string, string[]> | undefined;

function arquivosQueDefinemOContratoDaFila(): Map<string, string[]> {
  if (memoriaDasDefinicoes !== undefined) return memoriaDasDefinicoes;

  const busca = SIMBOLOS_DO_CONTRATO_DA_FILA.map((simbolo) => ({
    simbolo,
    padrao: definicaoDe(simbolo),
    arquivos: [] as string[],
  }));

  for (const caminho of arquivosDeCodigo()) {
    const conteudo = readFileSync(join(RAIZ, caminho), 'utf8');
    for (const alvo of busca) {
      if (alvo.padrao.test(conteudo)) alvo.arquivos.push(caminho);
    }
  }

  memoriaDasDefinicoes = new Map(busca.map((alvo) => [alvo.simbolo, alvo.arquivos.sort()]));
  return memoriaDasDefinicoes;
}

/**
 * Recorta cada bloco `DECISÃO FECHADA` de um fonte, do cabeçalho até a última linha de comentário.
 *
 * O corte por "linha que deixa de ser comentário" é o que permite comparar o bloco **byte a byte**
 * sem depender da linha em que ele está — o arquivo encolheu nesta task, e amarrar a asserção a um
 * número de linha a faria reprovar por movimento em vez de por alteração.
 */
function decisoesFechadasDe(texto: string): string[] {
  const linhas = texto.split('\n');
  const blocos: string[] = [];

  for (const [indice, linha] of linhas.entries()) {
    if (!linha.startsWith('// DECISÃO FECHADA')) continue;

    const bloco: string[] = [];
    for (let i = indice; i < linhas.length; i += 1) {
      const atual = linhas[i] ?? '';
      if (!atual.startsWith('//')) break;
      bloco.push(atual);
    }
    blocos.push(bloco.join('\n'));
  }

  return blocos;
}

/**
 * Os dois marcadores de `apps/worker/src/fila.ts`, como estavam ANTES desta fatia.
 *
 * A cópia literal é o instrumento: eles são `DECISÃO FECHADA`, e a task que extraiu o contrato da
 * fila editou o arquivo inteiro ao redor deles. Comparar o texto por igualdade é o que separa
 * "editei sob o débito", que é normal, de "editei sob a decisão", que é violação crítica.
 */
const DECISOES_FECHADAS_DA_FILA_DO_WORKER = [
  [
    '// DECISÃO FECHADA — T6 · 2026-08-01',
    '// O QUÊ: a biblioteca de fila é fixada na linha 5.x (`bullmq` 5.81.3), e não na major 6.x, que já',
    '//        existe e é a escolha óbvia de quem instala hoje.',
    '// POR QUÊ: a 6.0.0 saiu em 2026-07-30 e acumulou CINCO correções em 48 horas (6.0.1 a 6.0.5), e a',
    '//          major move o cliente de Redis para dependência de par opcional com armazenamento',
    '//          plugável — mudança estrutural no ponto exato que esta fatia existe para provar. A CA-10',
    '//          (trabalho enfileirado sobrevive à queda do servidor de fila) é a única prova da decisão',
    '//          de ligar persistência em disco tomada em T2, e apostá-la numa linha em correção diária',
    '//          troca uma base provada por churn. A 5.81.3 traz o cliente `ioredis` 5.11.1, exatamente',
    '//          o que `apps/api` já fixa — uma versão do cliente no monorepo inteiro.',
    '// REVERTER EXIGE: demonstrar que a linha 6.x parou de receber correção em cadência diária e que',
    '//                 CT-001 a CT-004 — a CA-10 inclusive — passam contra ela.',
  ].join('\n'),
  [
    '// DECISÃO FECHADA — T6 / Gate 2 · 2026-08-01',
    '// O QUÊ: o encerramento gracioso INTEIRO corre contra um prazo (`LIMITE_DE_DESLIGAMENTO_MS`), e',
    '//        a devolução da conexão acontece num `finally` — em vez de esperar indefinidamente que',
    '//        cada etapa devolva o seu recurso, que é a forma óbvia e a que estava escrita.',
    '// POR QUÊ: com o servidor de fila fora do ar, a espera não termina. O `close` do consumidor',
    '//          fecha uma conexão que a biblioteca DUPLICA por dentro (`shared: false`), e o',
    '//          fechamento dela emite `QUIT`; a política de reconexão desta fatia é infinita e',
    '//          `maxRetriesPerRequest` é nulo, então o comando fica na fila de espera local para',
    '//          sempre. Verificado nesta máquina: com a fila derrubada, o processo não terminou em',
    '//          40 s após o `SIGTERM` — reconectava sem parar. E o cenário não é hipotético: é o',
    '//          desligamento do sistema com a unidade da fila parando antes da do processador.',
    '// REVERTER EXIGE: (a) que o par ordenação-de-unidades + política de reconexão garanta que',
    '//                 nenhuma etapa do encerramento possa esperar por um servidor de fila ausente, e',
    '//                 (b) que o `TimeoutStopSec` das unidades de T7 seja o único prazo em jogo. Este',
    '//                 limite é deliberadamente MENOR que aquele: quem desiste primeiro precisa ser o',
    '//                 processo, que sabe explicar no journal por que desistiu — o supervisor só sabe',
    '//                 mandar SIGKILL. Alterar um dos dois sem o outro quebra o par: T7 declara',
    '//                 `TimeoutStopSec` com folga sobre este valor.',
  ].join('\n'),
];

/** Os quatro campos obrigatórios da forma canônica da §3 da rule. */
const CAMPOS_DA_DECISAO_FECHADA = ['DECISÃO FECHADA —', 'O QUÊ:', 'POR QUÊ:', 'REVERTER EXIGE:'];

/**
 * Aquece a memória da varredura ANTES do primeiro caso.
 *
 * A memória logo acima resolve a repetição — do segundo consumidor em diante ninguém refaz a
 * caminhada. Ela não resolve o PRIMEIRO: quem chega antes paga a leitura das três áreas inteiras
 * dentro do próprio `it`, e o teto de CASO deste pacote é o padrão de 5 s, mantido de propósito
 * (ver `vitest.config.ts` — afrouxá-lo faria todo caso travado levar 90 s para reprovar em vez
 * de 5 s).
 *
 * Medido sob a suíte completa, com os oito pacotes disputando CPU e as instâncias efêmeras de
 * banco disputando IO: o arquivo inteiro levava **6.064 ms para 28 casos**, dos quais **5.464 ms
 * num único `it`** — o `CT-907 (a)`, o primeiro a consumir a varredura. Ele expirava; os outros
 * 27 somavam ~600 ms. O custo não era do caso, era do setup que ele bancava por acidente de
 * ordem.
 *
 * Pagar aqui é o conserto da CAUSA: `beforeAll` corre sob `hookTimeout`, que este pacote já
 * declara em 90 s exatamente para setup caro, e o teto de caso continua fazendo o trabalho para
 * o qual existe — pegar caso travado. Alargar `testTimeout` seria o conserto do SINTOMA, e
 * contrariaria a decisão escrita na configuração.
 *
 * ⚠️ Isto NÃO enfraquece nada. As mesmas funções, as mesmas asserções, os mesmos quatro casos
 * consumidores em três `describe` (CT-907, CT-909, CT-638). O que muda é onde a conta é paga —
 * e, se a caminhada quebrar, o arquivo inteiro reprova aqui em vez de um `it` só, que é mais
 * barulhento e não menos.
 */
beforeAll(() => {
  arquivosDeCodigo();
  marcadoresVivos();
  arquivosQueDefinemOContratoDaFila();
});

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

describe('CT-638 — o contrato da fila tem definição única, e o D32 fechou nas duas pontas', () => {
  it('cada símbolo do contrato é definido em UM arquivo só, e é o do pacote compartilhado', () => {
    const definicoes = arquivosQueDefinemOContratoDaFila();

    for (const simbolo of SIMBOLOS_DO_CONTRATO_DA_FILA) {
      // Igualdade, e não `toContain`: o que o D32 nomeia é a SEGUNDA definição, e uma asserção de
      // presença é justamente a que não a enxerga. O arquivo intruso aparece no diff da falha.
      expect(definicoes.get(simbolo), `definições de ${simbolo}`).toEqual([
        CASA_DO_CONTRATO_DA_FILA,
      ]);
    }
  });

  it('o consumidor do `worker` importa o contrato pela fronteira do pacote', () => {
    const consumidor = ler(CONSUMIDOR_DO_CONTRATO_DA_FILA);
    const lista = /import\s*\{([\s\S]*?)\}\s*from\s*'@sysloc\/shared'/.exec(consumidor)?.[1] ?? '';
    const importados = lista
      .split(',')
      .map((nome) => nome.replace(/\btype\b/, '').trim())
      .filter((nome) => nome.length > 0);

    // Igualdade sobre os símbolos DO CONTRATO (os demais imports do módulo ficam livres para
    // crescer): sem esta asserção, um consumidor que voltasse a escrever o literal `'eco'` na
    // chamada satisfaria a unicidade acima e reabriria o desencontro por outro caminho.
    expect(SIMBOLOS_DO_CONTRATO_DA_FILA.filter((simbolo) => importados.includes(simbolo))).toEqual([
      'CargaDaRegua',
      'CargaDoEco',
      'FILA_DA_REGUA',
      'FILA_DO_ECO',
      'OPCOES_PADRAO_DA_TAREFA',
    ]);
  });

  it('o contrato desceu SEM trazer a biblioteca de fila junto', () => {
    // A restrição é parte da decisão: com `bullmq` aqui, todo consumidor de registro estruturado e
    // de erros do monorepo — a API inclusive — passaria a arrastar a biblioteca de fila.
    expect(ler(CASA_DO_CONTRATO_DA_FILA)).not.toMatch(/^import\s/m);

    const manifesto = ler('packages/shared/package.json');
    for (const biblioteca of ['bullmq', 'ioredis']) {
      expect(manifesto, `@sysloc/shared passou a depender de ${biblioteca}`).not.toContain(
        `"${biblioteca}"`,
      );
    }
  });

  it('o marcador do D32 saiu do código E a linha saiu do índice — as duas pontas', () => {
    const noCodigo = [...marcadoresVivos()].filter(
      (identificador) => identificador === IDENTIFICADOR_DO_D32,
    );
    const noIndice = [...ler(CAMINHO_DAS_INSTRUCOES).matchAll(PADRAO_DE_LINHA_DE_INDICE)]
      .map((achado) => `${achado[1]} · ${achado[2]}`)
      .filter((identificador) => identificador === IDENTIFICADOR_DO_D32);

    // As duas pontas na MESMA asserção, de propósito (§3-B): fechar uma e esquecer a outra produz
    // marcador órfão ou linha órfã, e o objeto da falha nomeia qual das duas ficou para trás.
    expect({ noCodigo, noIndice }).toEqual({ noCodigo: [], noIndice: [] });
  });

  it('as duas `DECISÃO FECHADA` do consumidor continuam byte a byte, com os quatro campos', () => {
    const blocos = decisoesFechadasDe(ler(CONSUMIDOR_DO_CONTRATO_DA_FILA));

    // Editar sob o `DÉBITO COM GATILHO` é normal — é o que a task fez. Sob a `DECISÃO FECHADA` é
    // violação crítica, e esta é a única asserção da base que a apanha neste arquivo.
    expect(blocos).toEqual(DECISOES_FECHADAS_DA_FILA_DO_WORKER);

    for (const [indice, bloco] of blocos.entries()) {
      for (const campo of CAMPOS_DA_DECISAO_FECHADA) {
        expect(bloco, `marcador ${indice + 1} perdeu o campo ${campo}`).toContain(campo);
      }
    }
  });

  it('controle de não-cegueira: a expressão de definição não casa import nem menção', () => {
    const padrao = definicaoDe('OPCOES_PADRAO_DA_TAREFA');

    expect(padrao.test('export const OPCOES_PADRAO_DA_TAREFA = {')).toBe(true);
    expect(padrao.test('const OPCOES_PADRAO_DA_TAREFA = {')).toBe(true);
    // A carga é `interface`, e não `const`: se a expressão só reconhecesse declaração de valor, a
    // duplicação do TIPO passaria despercebida — e é ela que carrega a decisão da ADR-0024.
    expect(definicaoDe('CargaDaRegua').test('export interface CargaDaRegua {')).toBe(true);

    // Se a expressão casasse qualquer uma das formas abaixo, TODO consumidor legítimo seria
    // contado como redefinição — e a asserção de unicidade reprovaria a árvore correta.
    for (const consumo of [
      '  OPCOES_PADRAO_DA_TAREFA,',
      "import { OPCOES_PADRAO_DA_TAREFA } from '@sysloc/shared';",
      '    defaultJobOptions: OPCOES_PADRAO_DA_TAREFA,',
    ]) {
      expect(padrao.test(consumo), `casou consumo como definição: ${consumo}`).toBe(false);
    }

    // Defeito medido na construção deste caso: a linha de uma lista de import quebrada em várias
    // linhas começa por `type NOME,` e era lida como apelido de tipo — o consumidor e o barril do
    // pacote apareciam como redefinição da carga.
    const daCarga = definicaoDe('CargaDaRegua');
    expect(daCarga.test('  type CargaDaRegua,'), 'casou item de lista de import').toBe(false);
    expect(daCarga.test('export type CargaDaRegua = { empresaId: string };')).toBe(true);
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
