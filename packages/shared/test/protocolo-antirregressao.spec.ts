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
 * | CT-1196| Os três números da superfície narrados no `CLAUDE.md` são iguais, um a um, às três
 * |        | constantes executáveis da âncora — a suíte é a fonte, o texto é a cópia. |
 * | CT-1198| Cada débito fechado na fatia `publicacao-e-backup/v1`, identificado pelo **par**, saiu
 * |        | das duas pontas; e cada homônimo que ela não fecha continua vivo nas duas. |
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
      // `.conf` entrou na T11 da fatia `webhook-e-carne`, com o PRIMEIRO marcador emitido em
      // configuração versionada (o vhost da borda externa). Sem ele, a lista decide sozinha que
      // marcador só existe em arquivo de linguagem: o do `.conf` some da varredura, e a linha
      // correspondente do índice vira "órfã" — o CT-907 passaria a reprovar o registro CERTO e a
      // aprovar o índice sem a linha, que é o oposto do que ele existe para garantir.
      if (!/\.(ts|js|sh|sql|json|md|conf)$/.test(caminho)) continue;
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

// ---------------------------------------------------------------------------
// T11 da fatia `publicacao-e-backup` — o P5, escrito como asserção
// ---------------------------------------------------------------------------
//
// Os dois casos abaixo nasceram do fecho da fatia, e fecham duas classes que o resto desta
// barreira não alcançava:
//
//  - o CT-1196 amarra os números NARRADOS no `CLAUDE.md` às constantes EXECUTÁVEIS da âncora de
//    superfície. Medido: nenhuma suíte fazia isso, e a linha já divergiu quatro vezes (75/77,
//    99/84, 103/88, 105/90), mais uma quinta no nome de um campo. A suíte é a fonte, o texto é a
//    cópia — e sem asserção a cópia envelhece no mesmo diff que a escreve.
//  - o CT-1198 confere que os débitos fechados nesta fatia saíram das DUAS pontas **pelo par**, e
//    que os homônimos que ela NÃO fecha continuam vivos. O CT-907 acima prova a coerência
//    genérica e ficaria verde se a fatia tivesse apagado marcador e linha do débito ERRADO —
//    fechando `D23` pelo número e levando junto o `D23 · F0/T3`, cujo código vive sob duas
//    `DECISÃO FECHADA`.
//
// Toda função desta seção é PURA: recebe o texto e devolve o veredito. É o que permite falsificar
// cada asserção com um mutante em memória, sem tocar a árvore de trabalho — a mesma construção do
// controle de não-cegueira do CT-908.

/** A âncora de superfície. Este arquivo apenas a LÊ — alterá-la não é escopo da T11. */
const ANCORA_DA_SUPERFICIE = 'apps/api/test/cobertura-de-autorizacao.e2e.spec.ts';

/**
 * Os três eixos da superfície publicada.
 *
 * `constante` é o nome declarado na âncora; `narrado` é o molde que extrai o mesmo número da prosa
 * do `CLAUDE.md`. **Nenhum valor é redigitado aqui**: os dois lados saem de leitura, e é a
 * igualdade entre eles que o caso afirma. Escrever o número esperado nesta lista transformaria o
 * caso numa terceira cópia — exatamente a divergência que ele existe para pegar.
 *
 * ⚠️ O molde dos manipuladores é ancorado na frase inteira (`Superfície: N rotas / M
 * manipuladores`), e não em `(\d+) manipuladores`: o arquivo cita `103 rotas / 88 manipuladores`
 * mais abaixo, no marco de entrega, e o molde curto casaria a menção histórica em vez da medição
 * corrente.
 */
const EIXOS_DA_SUPERFICIE = [
  {
    eixo: 'rotas',
    constante: 'ROTAS_PUBLICADAS_EM_PRODUCAO',
    narrado: /\*\*Superfície: (\d+) rotas/,
  },
  {
    eixo: 'manipuladores',
    constante: 'MANIPULADORES_EXAMINADOS_EM_PRODUCAO',
    narrado: /\*\*Superfície: \d+ rotas \/ (\d+) manipuladores\*\*/,
  },
  {
    eixo: 'públicas',
    constante: 'PARES_PUBLICOS_DA_SUPERFICIE',
    narrado: /`publicas` em \*\*(\d+)\*\*/,
  },
] as const;

interface EixoMedido {
  eixo: string;
  narrado: number;
  executavel: number;
}

/**
 * Extrai um inteiro por um molde de um grupo, **lançando** quando o molde não casa.
 *
 * Mesma decisão de construção do `recortarSecao`: devolver `undefined` (ou `0`) faria a asserção
 * comparar ausência com ausência e ficar verde justamente quando a frase ou a constante sumisse.
 */
function inteiroPor(texto: string, molde: RegExp, oQue: string): number {
  const achado = molde.exec(texto);
  if (achado?.[1] === undefined) {
    throw new Error(`não encontrei ${oQue} com o molde ${String(molde)}`);
  }
  return Number(achado[1]);
}

/** Os três eixos, cada um com o valor narrado e o valor da constante executável. */
function medirSuperficie(instrucoes: string, ancora: string): EixoMedido[] {
  return EIXOS_DA_SUPERFICIE.map(({ eixo, constante, narrado }) => ({
    eixo,
    narrado: inteiroPor(instrucoes, narrado, `o número narrado de ${eixo}`),
    executavel: inteiroPor(
      ancora,
      new RegExp(`^const ${constante} = (\\d+);`, 'm'),
      `a constante ${constante}`,
    ),
  }));
}

/** Os eixos em que o texto e a constante discordam — vazio é o estado saudável. */
function divergenciasDaSuperficie(medidos: EixoMedido[]): EixoMedido[] {
  return medidos.filter(({ narrado, executavel }) => narrado !== executavel);
}

/**
 * Devolve o texto com o número narrado de um eixo trocado por outro — o mutante de falsificação.
 *
 * O valor mutado é derivado do próprio texto (`valor - 1`), nunca escrito à mão: um literal aqui
 * apodreceria na primeira vez que a superfície mudasse, e o mutante deixaria de ser mutante.
 */
function comOEixoNarradoAlterado(instrucoes: string, eixo: string): string {
  const alvo = EIXOS_DA_SUPERFICIE.find((candidato) => candidato.eixo === eixo);
  if (alvo === undefined) throw new Error(`eixo desconhecido: ${eixo}`);

  const achado = alvo.narrado.exec(instrucoes);
  if (achado?.[1] === undefined) throw new Error(`molde de ${eixo} não casou`);

  const trecho = achado[0];
  const mutado = trecho.replace(achado[1], String(Number(achado[1]) - 1));
  return instrucoes.replace(trecho, mutado);
}

describe('CT-1196 — a superfície narrada é cópia fiel das constantes executáveis', () => {
  const instrucoes = ler(CAMINHO_DAS_INSTRUCOES);
  const ancora = ler(ANCORA_DA_SUPERFICIE);

  it('a extração devolve os TRÊS eixos, dos dois lados', () => {
    const medidos = medirSuperficie(instrucoes, ancora);

    // Antivácuo: uma extração que devolvesse lista vazia faria a comparação abaixo passar por
    // vacuidade — comparar nada com nada é o modo silencioso desta classe de asserção falhar.
    expect(medidos).toHaveLength(EIXOS_DA_SUPERFICIE.length);
    expect(medidos.map(({ eixo }) => eixo)).toEqual(['rotas', 'manipuladores', 'públicas']);
    for (const { eixo, narrado, executavel } of medidos) {
      expect(Number.isInteger(narrado), `narrado de ${eixo}`).toBe(true);
      expect(Number.isInteger(executavel), `executável de ${eixo}`).toBe(true);
    }
  });

  it.each(EIXOS_DA_SUPERFICIE.map(({ eixo }) => eixo))(
    'o eixo %s narrado é igual à constante executável',
    (eixo) => {
      const medido = medirSuperficie(instrucoes, ancora).find(
        (candidato) => candidato.eixo === eixo,
      );

      // A mensagem nomeia o eixo e OS DOIS valores: quem lê a falha precisa saber qual lado
      // corrigir, e a resposta é sempre a mesma — a suíte é a fonte, o texto é a cópia.
      expect(
        medido?.narrado,
        `${eixo}: o texto diz ${medido?.narrado}, a constante executável diz ${medido?.executavel}`,
      ).toBe(medido?.executavel);
    },
  );

  it.each(EIXOS_DA_SUPERFICIE.map(({ eixo }) => eixo))(
    'falsificação: um mutante no eixo %s reprova nomeando o eixo e os dois valores',
    (eixo) => {
      const mutante = comOEixoNarradoAlterado(instrucoes, eixo);
      expect(mutante, 'o mutante não mudou nada — a falsificação seria decorativa').not.toBe(
        instrucoes,
      );

      const divergencias = divergenciasDaSuperficie(medirSuperficie(mutante, ancora));
      const executavel = inteiroPor(
        ancora,
        new RegExp(
          `^const ${EIXOS_DA_SUPERFICIE.find((c) => c.eixo === eixo)?.constante} = (\\d+);`,
          'm',
        ),
        `a constante do eixo ${eixo}`,
      );

      // Igualdade sobre a lista inteira, e não presença: o mutante mexe em UM eixo, e uma
      // asserção de presença aprovaria uma comparação que acusasse os três de uma vez.
      expect(divergencias).toEqual([{ eixo, narrado: executavel - 1, executavel }]);
    },
  );
});

/**
 * Os débitos que a fatia `publicacao-e-backup/v1` fechou, pelo **par** `Dnn · F{n}/{origem}`.
 *
 * ⚠️ São **seis**, e a §5.6 da task declarava cinco: ela não contava o `D39 · F7/T8`, fechado pela
 * mesma T9 que fechou o `D24 · F1/T5` (a borda passou a apensar `$proxy_add_x_forwarded_for`). A
 * divergência foi medida antes de ser escrita — o par não tem marcador vivo nem linha no índice.
 */
const DEBITOS_FECHADOS_NA_FATIA = [
  { par: 'D9 · F0/T2', porQuem: 'T5' },
  { par: 'D23 · F1/T8', porQuem: 'T7' },
  { par: 'D27 · F1/T6', porQuem: 'T8' },
  { par: 'D24 · F1/T5', porQuem: 'T9' },
  { par: 'D39 · F7/T8', porQuem: 'T9' },
  { par: 'D27 · F4/T11', porQuem: 'T10' },
] as const;

/**
 * Os homônimos que a fatia **não** fecha — e que um fecho por número levaria junto.
 *
 * `D23 · F0/T3` é o caso extremo: o código sob o marcador está protegido por duas `DECISÃO
 * FECHADA`, e apagá-lo por confusão com o `D23 · F1/T8` seria violação crítica que nenhuma outra
 * asserção desta barreira pegaria.
 */
const HOMONIMOS_QUE_SOBREVIVEM = ['D23 · F0/T3', 'D26 · F3/T8'] as const;

/**
 * Linhas do índice de débito do `CLAUDE.md` ao fim da fatia — **medido**, nunca derivado.
 *
 * ⚠️ A §5.6 da task prescrevia `36`, por aritmética de planejamento (`41 − 5`), e os dois números
 * estão errados: a fatia fechou **seis** débitos e abriu **dois** (`D40 · F7/T9` e `D41 · F7/T9`).
 * O valor abaixo saiu de `grep -cE '^\| \*\*(D[0-9]+)\*\* \((F[0-9]+/...'` sobre o arquivo real, e
 * a conduta que o produziu é a que o próprio `Estado atual` documenta cinco vezes: **medir, nunca
 * estimar**. Ajustar o índice para caber num número de spec seria apagar linha de débito vivo para
 * fazer prosa fechar — a pior forma da regressão que esta barreira existe para pegar.
 *
 * **Quando um débito nascer ou fechar, este número muda no mesmo diff** — junto da prosa do bloco,
 * que a asserção abaixo amarra a ele.
 */
const LINHAS_DO_INDICE_NO_FECHO_DA_FATIA = 38;

/** O molde da prosa que anuncia o tamanho do índice, logo acima da tabela. */
const PADRAO_DO_TOTAL_NARRADO = /São \*\*(\d+)\*\*, e a tabela abaixo é a lista viva/;

/** Os pares que a tabela do índice declara, na ordem em que aparecem. */
function paresDoIndice(instrucoes: string): string[] {
  return [...instrucoes.matchAll(PADRAO_DE_LINHA_DE_INDICE)].map(
    (achado) => `${achado[1]} · ${achado[2]}`,
  );
}

/** O prefixo literal da linha de tabela de um par — usado para montar e desmontar mutantes. */
function prefixoDaLinhaDoIndice(par: string): string {
  const [numero, origem] = par.split(' · ');
  return `| **${numero}** (${origem}`;
}

/**
 * As duas pontas de um débito, contadas: quantos marcadores vivos e quantas linhas de índice.
 *
 * As duas na MESMA estrutura, de propósito (§3-B): fechar uma e esquecer a outra produz marcador
 * órfão ou linha órfã, e o objeto da falha nomeia qual das duas ficou para trás.
 */
function asDuasPontasDe(
  par: string,
  marcadores: Iterable<string>,
  pares: Iterable<string>,
): { marcadores: number; linhasDoIndice: number } {
  return {
    marcadores: [...marcadores].filter((identificador) => identificador === par).length,
    linhasDoIndice: [...pares].filter((identificador) => identificador === par).length,
  };
}

describe('CT-1198 — os débitos fechados saíram das duas pontas, e os homônimos sobreviveram', () => {
  const instrucoes = ler(CAMINHO_DAS_INSTRUCOES);

  it.each(DEBITOS_FECHADOS_NA_FATIA)(
    'o $par (fechado na $porQuem) não tem marcador nem linha',
    ({ par }) => {
      expect(asDuasPontasDe(par, marcadoresVivos(), paresDoIndice(instrucoes))).toEqual({
        marcadores: 0,
        linhasDoIndice: 0,
      });
    },
  );

  it.each(HOMONIMOS_QUE_SOBREVIVEM)('o homônimo %s continua vivo nas duas pontas', (par) => {
    const pontas = asDuasPontasDe(par, marcadoresVivos(), paresDoIndice(instrucoes));

    // É esta asserção que separa "fechou o débito certo" de "fechou pelo número": o par irmão
    // some das duas pontas, e este permanece nas duas.
    expect(pontas.linhasDoIndice, `linha do índice de ${par}`).toBe(1);
    expect(pontas.marcadores, `marcadores vivos de ${par}`).toBeGreaterThanOrEqual(1);
  });

  it('a tabela do índice tem a contagem medida, e a prosa acima concorda com ela', () => {
    expect(paresDoIndice(instrucoes)).toHaveLength(LINHAS_DO_INDICE_NO_FECHO_DA_FATIA);

    // A terceira ponta, e ela não é ornamento: o número escrito em prosa é o que chega ao agente
    // que não conta a tabela, e é justamente o que envelhece sem que nada acuse.
    expect(inteiroPor(instrucoes, PADRAO_DO_TOTAL_NARRADO, 'o total narrado do índice')).toBe(
      LINHAS_DO_INDICE_NO_FECHO_DA_FATIA,
    );
  });

  it('falsificação 1: remover a linha do homônimo o expõe como marcador órfão', () => {
    const [homonimo] = HOMONIMOS_QUE_SOBREVIVEM;
    const prefixo = prefixoDaLinhaDoIndice(homonimo);
    const mutante = instrucoes
      .split('\n')
      .filter((linha) => !linha.startsWith(prefixo))
      .join('\n');
    expect(mutante, 'o mutante não removeu linha alguma').not.toBe(instrucoes);

    expect(asDuasPontasDe(homonimo, marcadoresVivos(), paresDoIndice(mutante))).toEqual({
      marcadores: 1,
      linhasDoIndice: 0,
    });
  });

  it('falsificação 2: repor a linha de um fechado a expõe como linha órfã', () => {
    const [{ par }] = DEBITOS_FECHADOS_NA_FATIA;
    const mutante = `${instrucoes}\n${prefixoDaLinhaDoIndice(par)}, fatia inventada) | \`x.ts\` | nunca |\n`;

    expect(asDuasPontasDe(par, marcadoresVivos(), paresDoIndice(mutante))).toEqual({
      marcadores: 0,
      linhasDoIndice: 1,
    });
  });

  it('falsificação 3: repor o marcador de um fechado o expõe como marcador que deveria ter saído', () => {
    const fechadoPelaUltimaTask = DEBITOS_FECHADOS_NA_FATIA.at(-1)?.par as string;
    const mutante = new Set([...marcadoresVivos(), fechadoPelaUltimaTask]);

    expect(asDuasPontasDe(fechadoPelaUltimaTask, mutante, paresDoIndice(instrucoes))).toEqual({
      marcadores: 1,
      linhasDoIndice: 0,
    });
  });
});
