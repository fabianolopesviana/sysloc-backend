/**
 * Verificação do **vocabulário canônico** publicado pelo domínio da cobrança bancária — CT-809,
 * CT-834 e CT-835 da fatia `fundacao-bancaria`.
 *
 * ---------------------------------------------------------------------------
 * INVARIANTES
 * ---------------------------------------------------------------------------
 *
 * | Critério | CT     | Invariante |
 * |----------|--------|------------|
 * | CA-13    | CT-809 | `PortaDeIdentidadeBancaria` declara **exatamente uma** operação —
 * |          |        | `verificarIdentidade` —, e a implementação de referência que a satisfaz tem
 * |          |        | exatamente essa chave. A porta não nasce com assinaturas sem quem as chame. |
 * | CA-13    | CT-809 | Nem o parâmetro nem o retorno da operação carregam nome de campo, código ou
 * |          | (b)    | termo do provedor — a cláusula de vocabulário da ADR-0001 vale para esta
 * |          |        | porta na íntegra, ainda que ela não esteja no roster de cinco operações. |
 * | CA-13    | CT-809 | `src/index.ts` publica **símbolo a símbolo**: nenhuma linha `export *`, e os
 * |          | (c)    | quatro símbolos desta task estão na superfície. |
 * | CA-13    | CT-834 | Nenhum termo do provedor entra no vocabulário publicado — nem nas chaves dos
 * |          |        | tipos declarados por este pacote, nem nas chaves dos esquemas de
 * |          |        | `packages/contracts/src/integracao-bancaria.ts`, nem nos literais dos dois
 * |          |        | enums que ele publica. |
 * | CA-13    | CT-834 | O nome `AdaptadorCobrancaBancaria` — **reservado** para a porta das cinco
 * |          | (b)    | operações da ADR-0001, que nasce na fatia (ii) — não é usado por símbolo
 * |          |        | algum declarado neste pacote. |
 * | CA-14    | CT-835 | `MEIOS_DE_RECEBIMENTO` publica exatamente `['BOLETO','PIX']`, nesta ordem, e
 * |          |        | é **importado** de `@sysloc/contracts` — nunca redeclarado aqui, o que é
 * |          |        | provado por varredura de **ligação local** sobre o texto de `src/`. |
 * | CA-14    | CT-835 | O conjunto de operações sobre `PIX` é **vazio**: nenhum símbolo declarado ou
 * |          | (b)    | publicado por este pacote opera sobre ele. Pix é declarado, não
 * |          |        | implementado — e a lista vazia é o que separa *"declarado sem operação"* de
 * |          |        | *"bandeira desligada escondendo código pronto"*. |
 *
 * Rastreabilidade: `CA-13 → CT-809, CT-834 (RN-10)` · `CA-14 → CT-835 (RN-11)`.
 *
 * ---------------------------------------------------------------------------
 * Estes casos são ESTÁTICOS, e a razão é que interface não existe em execução
 * ---------------------------------------------------------------------------
 *
 * O que se prova aqui é a forma da **superfície declarada**, e tipo de TypeScript some na emissão:
 * `Object.keys` do módulo compilado devolveria vazio hoje, e devolveria só os valores da T9 e da T10
 * amanhã. Por isso a enumeração é feita sobre o **texto** dos fontes de `src/`, com o extrator
 * exercido por controle positivo em todo caso onde ele decide o veredito — sem o controle, um
 * extrator que nunca acha nada aprovaria qualquer coisa (**AP-29**), que foi a única causa de
 * rejeição repetida da fatia anterior.
 *
 * A ligação com o **tipo real** não é abandonada: o CT-809 declara uma implementação de referência
 * anotada como `PortaDeIdentidadeBancaria`, de modo que a classe de defeito fica fechada dos dois
 * lados — uma operação nova **obrigatória** quebra a verificação de tipos da suíte nomeando o membro
 * ausente, e uma operação nova **opcional**, que a verificação de tipos aceitaria, reprova na
 * asserção sobre o texto nomeando o excedente.
 *
 * ⚠️ **A implementação de referência não é asserida contra si mesma**, e a distinção decide se o
 * caso prova alguma coisa. Comparar `Object.keys(portaDeReferencia)` com a lista escrita por extenso
 * poria as **duas** pontas sob autoria do teste: `Object.keys` de um literal fixo devolve o mesmo
 * arranjo em qualquer estado do código de produção, e a asserção não poderia falhar (**AP-29**). Por
 * isso o lado direito é `porta?.membros` — **lido do texto do fonte** —, o que costura a ponta de
 * tipo à ponta de texto: ela reprova sempre que o que o fonte declara divergir do que a anotação de
 * tipo aceita, inclusive quando alguém acrescenta a operação nova a `OPERACOES_DA_PORTA` para calar
 * a asserção vizinha, porque o literal está sob a anotação e não acompanha.
 *
 * ---------------------------------------------------------------------------
 * O que a varredura de termos alcança, e o que ela deliberadamente NÃO alcança
 * ---------------------------------------------------------------------------
 *
 * Ela alcança o **vocabulário executável**: chaves de tipo, literais de enum e nomes de símbolo. Não
 * alcança prosa de comentário, e a exclusão é deliberada — o docblock de `porta-de-identidade.ts`
 * precisa citar `AdaptadorCobrancaBancaria` por escrito para registrar que o nome está reservado, e
 * uma varredura sobre texto corrido transformaria esse registro em reprovação.
 *
 * ⚠️ **Ela alcança NOMES, e nunca VALORES em execução** — a exclusão estava implícita, e a explícita
 * já estava escrita ao lado. Chave de tipo, literal de enum e nome de símbolo são o que ela examina;
 * o **conteúdo** que um campo do tipo `string` venha a carregar em execução está fora do alcance de
 * qualquer asserção deste arquivo. O único campo por onde texto arbitrário atravessa a porta é
 * `ResultadoDaVerificacaoDeIdentidade.detalhe`, e a restrição que o fecha vive em prosa — está
 * registrada no `DÉBITO COM GATILHO — D27` do ponto do código, que a T10 fecha ao escolher o
 * conjunto fechado de constantes do adaptador.
 *
 * Ela também **não** varre nome de símbolo contra os termos do provedor, e sim contra o nome
 * reservado. A distinção é da própria ADR-0001, que exige *"um adaptador por provedor"*: o adaptador
 * da T10 se chamará `criarAdaptadorSicoob` porque é ele que conhece o provedor. O que não pode
 * carregar o dialeto do banco é o que **atravessa** a porta — e é exatamente isso que o conjunto
 * varrido contra `TERMOS_DO_PROVEDOR` reúne.
 */

import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ESTADOS_DO_CERTIFICADO,
  esquemaDoCertificado,
  esquemaDoCertificadoNovo,
  esquemaDoResultadoDaVerificacao,
  MEIOS_DE_RECEBIMENTO,
} from '@sysloc/contracts';
import { describe, expect, it } from 'vitest';
import type { PortaDeIdentidadeBancaria } from '../src/porta-de-identidade.ts';

// ===========================================================================
// Listas escritas POR EXTENSO — nunca derivadas do artefato sob prova
// ===========================================================================

/**
 * A única operação que esta fatia exerce.
 *
 * Escrita à mão, e jamais derivada da própria interface: derivar poria o artefato sob prova nos dois
 * lados da igualdade, e a asserção passaria a não poder falhar.
 */
const OPERACOES_DA_PORTA = ['verificarIdentidade'] as const;

/** Os meios de recebimento que o produto declara (RN-11), na ordem publicada. */
const MEIOS_DECLARADOS = ['BOLETO', 'PIX'] as const;

/**
 * O nome do enum que este pacote **consome e não redeclara** (ADR-0016).
 *
 * A igualdade do enum contra `MEIOS_DECLARADOS` prova o **conteúdo**, e ela não alcança a metade que
 * importa aqui: ela assere o objeto **importado** de `@sysloc/contracts` e, por construção, ficaria
 * verde ao lado de uma redeclaração local que sombreasse o símbolo em `src/`. Quem prova a segunda
 * metade é a varredura de ligação local sobre o texto dos fontes — a única das duas que **só este
 * pacote** pode fazer.
 */
const NOME_DO_ENUM_IMPORTADO = 'MEIOS_DE_RECEBIMENTO';

/**
 * Os termos que não podem cruzar a porta — dez, e o piso exigido é oito.
 *
 * Os oito primeiros são vocabulário do provedor: o nome dele em duas grafias, os campos que o
 * oráculo do sistema antigo usa (`nossoNumero`, `seuNumero`, `numeroContrato`,
 * `codigoBeneficiario`), e os dois parâmetros do fluxo de credencial de acesso (`client_id`,
 * `scope`), mais o `pagador` do payload de emissão. O nono é `AdaptadorCobrancaBancaria`, que não é
 * termo do provedor e sim o **nome reservado** pela ADR-0001 para a porta das cinco operações.
 *
 * ⚠️ `BOLETO` **não** entra nesta lista, e a ausência é deliberada: ele é vocabulário do produto
 * (RN-11), publicado por `@sysloc/contracts`, e incluí-lo faria a varredura reprovar o próprio
 * vocabulário canônico que ela existe para proteger.
 */
const TERMOS_DO_PROVEDOR = [
  'sicoob',
  'bancoob',
  'nossoNumero',
  'seuNumero',
  'numeroContrato',
  'codigoBeneficiario',
  'client_id',
  'scope',
  'pagador',
  'AdaptadorCobrancaBancaria',
] as const;

/** O nome que a fatia (ii) vai usar para a porta das cinco operações da ADR-0001. */
const NOME_RESERVADO = 'AdaptadorCobrancaBancaria';

/** O meio declarado sem operação — o que o CT-835 exige que nenhum símbolo consuma. */
const MEIO_SEM_OPERACAO = 'PIX';

/** Os símbolos que esta task publica, e que o CT-809 (c) exige encontrar na superfície. */
const SIMBOLOS_PUBLICADOS_NESTA_TASK = [
  'IdentidadeParaVerificar',
  'MeioDeRecebimento',
  'PortaDeIdentidadeBancaria',
  'ResultadoDaVerificacaoDeIdentidade',
] as const;

/**
 * As chaves de `esquemaDoCertificado`, na ordem em que a projeção as declara — inclusive as duas do
 * bloco aninhado de autoria.
 *
 * Ela é o **controle positivo** da coleta de chaves de esquema: uma coleta quebrada devolveria lista
 * vazia, e a varredura de termos aprovaria qualquer coisa por não ter olhado.
 */
const CHAVES_DO_CERTIFICADO_PUBLICADO = [
  'id',
  'titular',
  'validoDe',
  'validoAte',
  'impressaoDigital',
  'estado',
  'diasParaVencer',
  'registradoPor',
  'id',
  'nome',
  'registradoEm',
] as const;

/**
 * Um fonte sintético para exercer o extrator de tipos declarados.
 *
 * Ele carrega o que os fontes reais carregam e que uma implementação ingênua erraria: docblock entre
 * membros, membro `readonly`, membro opcional, assinatura de método quebrada em várias linhas com
 * nome de propriedade no meio da lista de parâmetros — que é a armadilha exata, porque
 * `identidade: X` numa linha solta parece um membro e não é — e um tipo vizinho declarado depois.
 */
const FONTE_DE_CONTROLE = `
/** Um comentário com a palavra interface e uma chave { falsa. */
export interface BlocoDeControle {
  /** Doc de membro. */
  readonly primeiro: string;
  segundo?: number;
  terceiro(
    parametro: AlgumTipo,
    outro: OutroTipo,
  ): Promise<void>;
}

export interface SegundoBlocoDeControle {
  unico: string;
}
`;

/** Um fonte sintético para exercer o detector de reexportação em massa. */
const FONTE_DE_CONTROLE_COM_ESTRELA = `
export * from './um.js';
export type { Coisa } from './dois.js';
export * as tres from './tres.js';
`;

/**
 * Um fonte sintético que **redeclara localmente** o enum importado — o defeito que o A5 proíbe.
 *
 * Ele carrega junto o import legítimo e uma menção em comentário, que é o que uma varredura ingênua
 * confundiria com a redeclaração: o que reprova é a **ligação**, não a citação do nome.
 */
const FONTE_DE_CONTROLE_COM_REDECLARACAO = `
import { MEIOS_DE_RECEBIMENTO } from '@sysloc/contracts';
/** Um comentário que cita const MEIOS_DE_RECEBIMENTO sem declarar nada. */
const MEIOS_DE_RECEBIMENTO = ['BOLETO', 'PIX', 'DINHEIRO'] as const;
`;

// ===========================================================================
// Extratores — cada um exercido por controle positivo antes de decidir veredito
// ===========================================================================

/** Um tipo declarado num fonte: o nome e os membros que ele expõe. */
interface TipoDeclarado {
  readonly nome: string;
  readonly membros: readonly string[];
}

/** Um fonte lido de `src/`, com o caminho relativo para que a reprovação nomeie o arquivo. */
interface FonteDoPacote {
  readonly arquivo: string;
  readonly texto: string;
}

const DIRETORIO_DOS_FONTES = fileURLToPath(new URL('../src/', import.meta.url));

/**
 * Remove comentários de bloco e de linha.
 *
 * É o que mantém a varredura sobre o **vocabulário executável**: o registro escrito em prosa — que o
 * cabeçalho de `porta-de-identidade.ts` precisa carregar — não é vocabulário, e reprová-lo puniria
 * exatamente a documentação que a decisão exige.
 */
function semComentarios(fonte: string): string {
  return fonte.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ');
}

/**
 * Substitui cada lista de parâmetros por `()`, preservando a natureza de método.
 *
 * Sem isso, `identidade: IdentidadeParaVerificar,` — uma linha de **parâmetro** — seria contada como
 * membro da interface, e o CT-809 acusaria uma operação a mais que não existe.
 */
function semListasDeParametros(texto: string): string {
  let saida = '';
  let profundidade = 0;
  for (const caractere of texto) {
    if (caractere === '(') {
      if (profundidade === 0) {
        saida += '()';
      }
      profundidade += 1;
    } else if (caractere === ')') {
      profundidade -= 1;
    } else if (profundidade === 0) {
      saida += caractere;
    }
  }
  return saida;
}

/** Os nomes de membro de um corpo de tipo, na ordem em que aparecem. */
function membrosDoCorpo(corpo: string): string[] {
  const membros: string[] = [];
  for (const linha of semListasDeParametros(corpo).split('\n')) {
    const achado = /^\s*(?:readonly\s+)?([A-Za-z_$][\w$]*)\s*\??\s*[(:<]/.exec(linha);
    const nome = achado?.[1];
    if (nome !== undefined) {
      membros.push(nome);
    }
  }
  return membros;
}

/**
 * Os tipos declarados num fonte, com os membros de cada um.
 *
 * O fim do bloco é achado por **contagem de chaves**, e não pela primeira `}`: um membro com tipo
 * objeto embutido fecharia o bloco cedo demais e esconderia todo o resto da declaração.
 */
function tiposDeclarados(fonteBruto: string): TipoDeclarado[] {
  const fonte = semComentarios(fonteBruto);
  const cabecalho = /\b(?:interface|type)\s+([A-Za-z_$][\w$]*)[^{;]*\{/g;
  const tipos: TipoDeclarado[] = [];

  let achado = cabecalho.exec(fonte);
  while (achado !== null) {
    const nome = achado[1];
    const inicio = achado.index + achado[0].length;
    let profundidade = 1;
    let posicao = inicio;
    while (posicao < fonte.length && profundidade > 0) {
      const caractere = fonte[posicao];
      if (caractere === '{') {
        profundidade += 1;
      } else if (caractere === '}') {
        profundidade -= 1;
      }
      posicao += 1;
    }

    if (nome !== undefined) {
      tipos.push({ nome, membros: membrosDoCorpo(fonte.slice(inicio, posicao - 1)) });
    }
    cabecalho.lastIndex = posicao;
    achado = cabecalho.exec(fonte);
  }

  return tipos;
}

/**
 * Os nomes de símbolo que um fonte declara ou reexporta.
 *
 * Alcança as duas formas que este monorepo usa: a declaração com `export` na frente e o bloco
 * `export { … } from`, com ou sem `type`. Num apelido (`X as Y`), o que vale é o nome **publicado**.
 */
function simbolosDeclarados(fonteBruto: string): string[] {
  const fonte = semComentarios(fonteBruto);
  const nomes: string[] = [];

  const declaracao =
    /\bexport\s+(?:declare\s+)?(?:abstract\s+)?(?:const|let|var|function|class|interface|type|enum)\s+([A-Za-z_$][\w$]*)/g;
  for (const achado of fonte.matchAll(declaracao)) {
    const nome = achado[1];
    if (nome !== undefined) {
      nomes.push(nome);
    }
  }

  const bloco = /\bexport\s+(?:type\s+)?\{([^}]*)\}/g;
  for (const achado of fonte.matchAll(bloco)) {
    const corpo = achado[1] ?? '';
    for (const parte of corpo.split(',')) {
      const pedacos = parte.trim().split(/\s+as\s+/);
      const nome = pedacos[pedacos.length - 1]?.trim();
      if (nome !== undefined && /^[A-Za-z_$][\w$]*$/.test(nome)) {
        nomes.push(nome);
      }
    }
  }

  return nomes;
}

/** As linhas de reexportação em massa de um fonte — o que a convenção proíbe. */
function reexportacoesEmMassa(fonteBruto: string): string[] {
  return semComentarios(fonteBruto)
    .split('\n')
    .map((linha) => linha.trim())
    .filter((linha) => /^export\s+\*/.test(linha));
}

/**
 * As **ligações locais** de um nome nos fontes dados, na forma `<nome> em <arquivo>`.
 *
 * Alcança as oito formas de ligação que declaram um nome de módulo — `const`, `let`, `var`,
 * `function`, `class`, `interface`, `type` e `enum` — e **não** alcança o `import`, que é justamente
 * o que o A5 exige que exista. Devolve **lista**, e não booleano: a reprovação nomeia o arquivo
 * ofensor em vez de dizer apenas que algo está errado.
 */
function ligacoesLocaisDe(nome: string, fontes: readonly FonteDoPacote[]): string[] {
  const ligacao = new RegExp(
    String.raw`\b(?:const|let|var|function|class|interface|type|enum)\s+${nome}\b`,
  );
  return fontes
    .filter((fonte) => ligacao.test(semComentarios(fonte.texto)))
    .map((fonte) => `${nome} em ${fonte.arquivo}`);
}

/** Os fontes que citam um nome no vocabulário executável — o que separa ausência de cegueira. */
function citacoesDe(nome: string, fontes: readonly FonteDoPacote[]): string[] {
  return fontes
    .filter((fonte) => semComentarios(fonte.texto).includes(nome))
    .map((fonte) => fonte.arquivo);
}

/** As chaves de um esquema do contrato, incluindo as dos blocos aninhados, na ordem declarada. */
function chavesDoEsquema(esquema: unknown): string[] {
  const forma = (esquema as { shape?: Record<string, unknown> }).shape;
  if (forma === undefined) {
    return [];
  }

  const chaves: string[] = [];
  for (const [chave, valor] of Object.entries(forma)) {
    chaves.push(chave, ...chavesDoEsquema(valor));
  }
  return chaves;
}

/**
 * As ocorrências de cada termo dentro de cada nome, na forma `<termo> em <nome>`.
 *
 * Devolve **lista**, e não booleano, de propósito: a asserção é `toEqual([])`, e a reprovação nomeia
 * o termo e a chave ofensora em vez de dizer apenas que algo está errado.
 */
function ocorrenciasDeTermos(nomes: readonly string[], termos: readonly string[]): string[] {
  const ocorrencias: string[] = [];
  for (const termo of termos) {
    const agulha = termo.toLowerCase();
    for (const nome of nomes) {
      if (nome.toLowerCase().includes(agulha)) {
        ocorrencias.push(`${termo} em ${nome}`);
      }
    }
  }
  return ocorrencias;
}

/** Os fontes de `src/`, em ordem determinística de caminho. */
async function fontesDoPacote(): Promise<FonteDoPacote[]> {
  const entradas = await readdir(DIRETORIO_DOS_FONTES, { withFileTypes: true, recursive: true });
  const caminhos = entradas
    .filter((entrada) => entrada.isFile() && entrada.name.endsWith('.ts'))
    .map((entrada) => join(entrada.parentPath, entrada.name))
    .sort();

  return Promise.all(
    caminhos.map(async (caminho) => ({
      arquivo: caminho.slice(DIRETORIO_DOS_FONTES.length),
      texto: await readFile(caminho, 'utf8'),
    })),
  );
}

/** O fonte da superfície publicada. */
async function fonteDoIndice(): Promise<string> {
  return readFile(new URL('../src/index.ts', import.meta.url), 'utf8');
}

/** O fonte que declara a porta. */
async function fonteDaPorta(): Promise<string> {
  return readFile(new URL('../src/porta-de-identidade.ts', import.meta.url), 'utf8');
}

// ===========================================================================
// CT-809 — a porta declara exatamente uma operação
// ===========================================================================

describe('CT-809 — a porta de identidade declara exatamente uma operação', () => {
  /**
   * A implementação de referência da porta.
   *
   * Ela existe para amarrar a asserção ao **tipo real**, e não apenas ao texto: se a interface ganhar
   * uma operação obrigatória, este literal deixa de satisfazê-la e a verificação de tipos da suíte
   * (`tsc -p tsconfig.test.json`, que o script `test` roda antes do Vitest) reprova nomeando o membro
   * ausente. A operação opcional — que a verificação de tipos aceitaria — é pega pela asserção sobre
   * o texto, logo abaixo.
   *
   * As chaves deste literal **só são asseridas contra o que o fonte declara**, nunca contra a lista
   * escrita por extenso: as duas pontas seriam autoradas aqui, e a igualdade não poderia falhar.
   */
  const portaDeReferencia: PortaDeIdentidadeBancaria = {
    verificarIdentidade: async () => ({
      aceito: true,
      verificadoEm: '2026-08-15T00:00:00.000Z',
      detalhe: null,
    }),
  };

  it('o extrator de membros acha o que existe num fonte de controle', () => {
    const tipos = tiposDeclarados(FONTE_DE_CONTROLE);

    // Controle positivo (AP-29): sem esta asserção, um extrator que devolvesse sempre `[]` faria
    // todas as asserções de ausência deste arquivo passarem por não terem olhado.
    expect(tipos.map((tipo) => tipo.nome)).toEqual(['BlocoDeControle', 'SegundoBlocoDeControle']);
    expect(tipos[0]?.membros).toEqual(['primeiro', 'segundo', 'terceiro']);
    expect(tipos[1]?.membros).toEqual(['unico']);
  });

  it('a interface declara exatamente as operações escritas por extenso', async () => {
    const porta = tiposDeclarados(await fonteDaPorta()).find(
      (tipo) => tipo.nome === 'PortaDeIdentidadeBancaria',
    );

    // Igualdade de lista: uma segunda operação reprova NOMEANDO o excedente, e uma operação
    // renomeada reprova nomeando as duas pontas.
    expect(porta?.membros).toEqual([...OPERACOES_DA_PORTA]);

    // Costura entre a ponta de TIPO e a ponta de TEXTO: o lado esquerdo é o que a anotação
    // `: PortaDeIdentidadeBancaria` obriga o literal a ter, e o lado direito é o que o fonte
    // declara. Divergir os dois é o único jeito de a interface mudar sem que alguma das duas
    // metades acuse — inclusive quando `OPERACOES_DA_PORTA` é afrouxada para calar a asserção
    // acima, porque o literal está sob a anotação de tipo e não acompanha o afrouxamento.
    expect(Object.keys(portaDeReferencia)).toEqual(porta?.membros);
  });

  it('nem o parâmetro nem o retorno da operação carregam termo do provedor', async () => {
    const fontes = await fontesDoPacote();
    const modelo = fontes.find((fonte) => fonte.arquivo === 'modelo-canonico.ts');
    const tiposQueAtravessam = tiposDeclarados(modelo?.texto ?? '').filter((tipo) =>
      ['IdentidadeParaVerificar', 'ResultadoDaVerificacaoDeIdentidade'].includes(tipo.nome),
    );

    // Âncora antivácuo: os dois tipos que atravessam a porta existem e foram lidos.
    expect(tiposQueAtravessam.map((tipo) => tipo.nome)).toEqual([
      'IdentidadeParaVerificar',
      'ResultadoDaVerificacaoDeIdentidade',
    ]);

    const nomesDaAssinatura = [
      ...OPERACOES_DA_PORTA,
      ...tiposQueAtravessam.map((tipo) => tipo.nome),
      ...tiposQueAtravessam.flatMap((tipo) => tipo.membros),
    ];

    expect(ocorrenciasDeTermos(nomesDaAssinatura, TERMOS_DO_PROVEDOR)).toEqual([]);
  });

  it('a superfície é publicada símbolo a símbolo, sem reexportação em massa', async () => {
    // Controle positivo: o detector acha as duas formas de reexportação em massa.
    expect(reexportacoesEmMassa(FONTE_DE_CONTROLE_COM_ESTRELA)).toEqual([
      "export * from './um.js';",
      "export * as tres from './tres.js';",
    ]);

    const indice = await fonteDoIndice();
    expect(reexportacoesEmMassa(indice)).toEqual([]);

    const publicados = simbolosDeclarados(indice);
    expect(
      SIMBOLOS_PUBLICADOS_NESTA_TASK.filter((simbolo) => !publicados.includes(simbolo)),
    ).toEqual([]);
  });
});

// ===========================================================================
// CT-834 — nenhum termo do provedor no vocabulário publicado
// ===========================================================================

describe('CT-834 — nenhum termo do provedor entra no vocabulário publicado', () => {
  it('a lista de termos tem o piso declarado e a varredura acha cada um deles', () => {
    expect(TERMOS_DO_PROVEDOR.length).toBeGreaterThanOrEqual(8);

    // Controle positivo (AP-29): um objeto sintético cuja chave é cada termo, submetido à MESMA
    // função de varredura, devolve a lista inteira. Sem ele, um detector que nunca acha nada
    // aprovaria qualquer vocabulário.
    const objetoDeControle = Object.fromEntries(TERMOS_DO_PROVEDOR.map((termo) => [termo, true]));

    expect(ocorrenciasDeTermos(Object.keys(objetoDeControle), TERMOS_DO_PROVEDOR)).toEqual(
      TERMOS_DO_PROVEDOR.map((termo) => `${termo} em ${termo}`),
    );
  });

  it('as chaves dos esquemas do contrato não carregam termo do provedor', () => {
    const chavesDoCertificado = chavesDoEsquema(esquemaDoCertificado);

    // Controle positivo da coleta de chaves: ela devolve as chaves reais da projeção publicada,
    // inclusive as do bloco aninhado de autoria. Coleta quebrada devolveria `[]`.
    expect(chavesDoCertificado).toEqual([...CHAVES_DO_CERTIFICADO_PUBLICADO]);

    const vocabularioDoContrato = [
      ...chavesDoEsquema(esquemaDoCertificadoNovo),
      ...chavesDoCertificado,
      ...chavesDoEsquema(esquemaDoResultadoDaVerificacao),
      ...MEIOS_DE_RECEBIMENTO,
      ...ESTADOS_DO_CERTIFICADO,
    ];

    expect(ocorrenciasDeTermos(vocabularioDoContrato, TERMOS_DO_PROVEDOR)).toEqual([]);
  });

  it('as chaves dos tipos declarados por este pacote não carregam termo do provedor', async () => {
    const fontes = await fontesDoPacote();

    // Âncora antivácuo: o pacote tem fontes, e eles declaram tipos.
    expect(fontes.length).toBeGreaterThanOrEqual(3);

    const tipos = fontes.flatMap((fonte) => tiposDeclarados(fonte.texto));
    expect(tipos.length).toBeGreaterThanOrEqual(2);

    const vocabularioDoPacote = [
      ...tipos.map((tipo) => tipo.nome),
      ...tipos.flatMap((tipo) => tipo.membros),
    ];

    expect(ocorrenciasDeTermos(vocabularioDoPacote, TERMOS_DO_PROVEDOR)).toEqual([]);
  });

  it('o nome reservado para a porta das cinco operações não é usado por este pacote', async () => {
    const fontes = await fontesDoPacote();
    const simbolos = fontes.flatMap((fonte) => simbolosDeclarados(fonte.texto));

    // Âncora antivácuo: os símbolos desta task foram efetivamente lidos dos fontes.
    expect(SIMBOLOS_PUBLICADOS_NESTA_TASK.filter((simbolo) => !simbolos.includes(simbolo))).toEqual(
      [],
    );

    expect(ocorrenciasDeTermos(simbolos, [NOME_RESERVADO])).toEqual([]);
  });
});

// ===========================================================================
// CT-835 — meio de recebimento: boleto e pix, e pix sem operação
// ===========================================================================

describe('CT-835 — o meio de recebimento é declarado, e o pix não tem operação', () => {
  it('o enum publica exatamente os meios declarados, na ordem publicada', () => {
    // Igualdade de conjunto E de ordem, contra a lista escrita por extenso: o enum é importado de
    // `@sysloc/contracts`, que é a fonte única (ADR-0016), e nunca redeclarado neste pacote.
    expect([...MEIOS_DE_RECEBIMENTO]).toEqual([...MEIOS_DECLARADOS]);
  });

  it('o enum vem do contrato, e nenhum fonte deste pacote o redeclara', async () => {
    const fontes = await fontesDoPacote();

    // Controle positivo (AP-29): a MESMA função, sobre um fonte que redeclara o nome, acha a
    // ligação e nomeia o arquivo. O fonte de controle cita o nome também no `import` e num
    // comentário, e nenhum dos dois conta — é a ligação que reprova, não a citação.
    expect(
      ligacoesLocaisDe(NOME_DO_ENUM_IMPORTADO, [
        { arquivo: 'controle.ts', texto: FONTE_DE_CONTROLE_COM_REDECLARACAO },
      ]),
    ).toEqual([`${NOME_DO_ENUM_IMPORTADO} em controle.ts`]);

    // Âncora antivácuo: o pacote de fato CONSOME o nome. Sem ela, "nenhuma ligação local" seria
    // satisfeito por um pacote que simplesmente não usa o enum, e a metade `importado` do A5
    // ficaria sem prova.
    expect(citacoesDe(NOME_DO_ENUM_IMPORTADO, fontes)).toEqual(['modelo-canonico.ts']);

    // A metade que a igualdade acima NÃO alcança: ela assere o objeto importado, e ficaria verde
    // ao lado de uma redeclaração local que sombreasse o símbolo em `src/`.
    expect(ligacoesLocaisDe(NOME_DO_ENUM_IMPORTADO, fontes)).toEqual([]);
  });

  it('nenhum símbolo declarado ou publicado por este pacote opera sobre o pix', async () => {
    const fontes = await fontesDoPacote();
    const simbolos = [
      ...fontes.flatMap((fonte) => simbolosDeclarados(fonte.texto)),
      ...fontes.flatMap((fonte) => tiposDeclarados(fonte.texto).flatMap((tipo) => tipo.membros)),
    ];

    // Âncora antivácuo: há símbolos a examinar.
    expect(simbolos.length).toBeGreaterThanOrEqual(4);

    // Controle positivo (AP-29): a MESMA varredura, sobre nomes sintéticos que operam sobre o pix,
    // devolve os três — o que prova que a lista vazia abaixo é ausência, e não cegueira.
    expect(
      ocorrenciasDeTermos(['emitirPix', 'PortaDePix', 'chaveDoPixDaEmpresa'], [MEIO_SEM_OPERACAO]),
    ).toEqual([
      `${MEIO_SEM_OPERACAO} em emitirPix`,
      `${MEIO_SEM_OPERACAO} em PortaDePix`,
      `${MEIO_SEM_OPERACAO} em chaveDoPixDaEmpresa`,
    ]);

    expect(ocorrenciasDeTermos(simbolos, [MEIO_SEM_OPERACAO])).toEqual([]);
  });
});
