/**
 * Varredura de fonte — o acessório comum das asserções ESTÁTICAS desta suíte.
 *
 * ===========================================================================
 * Por que um acessório, e não duas cópias
 * ===========================================================================
 *
 * Duas asserções estáticas diferentes precisam do mesmo par de operações — listar fonte e ler linha
 * com os comentários fora: o CT-005 (`isolamento.spec.ts`), que procura ramo por perfil Master no
 * caminho do dado, e o CT-014 (`unidade-de-trabalho.spec.ts`), que audita quem chama o escritor do
 * contexto de tenant. Uma terceira cópia do mesmo caminhamento seria a fixture duplicada que o Gate
 * 1 já anotou (BAIXO-002), agravada: cópias de um varredor divergem em silêncio, e um varredor que
 * divergiu passa a provar coisa diferente da que o caso afirma provar.
 *
 * ===========================================================================
 * Duas decisões deliberadas
 * ===========================================================================
 *
 * **Diretório ausente é ERRO.** A versão anterior deste caminhamento engolia `readdir` que falhava
 * (`.catch(() => [])`), de modo que um alvo renomeado reduzia a cobertura a zero **sem alarme** —
 * e o caso seguia verde provando nada. Aqui o erro sobe. Quem quiser auditar um alvo que pode não
 * existir escolhe o alvo dinamicamente (é o que o CT-014 faz, listando os pacotes do workspace),
 * em vez de silenciar a ausência.
 *
 * **Comentários saem antes da comparação.** Sem isso, a prosa que explica por que o defeito não
 * existe faz a asserção reprovar o código correto — o defeito literal registrado em
 * `.claude/rules/testing-stack.md` ("asserção que casava `ALTER ROLE` em comentário e mensagem de
 * erro"). A substituição preserva as quebras de linha, para que o número relatado continue
 * apontando para o ponto certo do arquivo.
 *
 * ===========================================================================
 * Dois caminhamentos, e a razão de cada um
 * ===========================================================================
 *
 * {@link listarFontesTs} lista o fonte TypeScript de um diretório **declarado** — é o caminhamento
 * de quem já sabe onde o alvo mora (`src/` de um pacote, `test/` de um pacote). Ele não poda nada,
 * porque o alvo declarado não contém `node_modules/` nem `dist/`.
 *
 * {@link caminharPeloRepositorio} lista o que o **carregador de módulos** consegue resolver na
 * árvore inteira — é o caminhamento de quem precisa afirmar uma propriedade sobre *todo módulo que
 * pode existir*, e não sobre um diretório escolhido. Ele poda o que **não sobrevive a um checkout
 * limpo** e casa uma lista **declarada** de extensões, e devolve os caminhos que podou justamente
 * para que a poda seja auditável — ver {@link CaminhamentoDoRepositorio}.
 *
 * ===========================================================================
 * O CONJUNTO É UMA DIFERENÇA COM DUAS SUBTRAÇÕES — e as duas precisam de oráculo
 * ===========================================================================
 *
 * O que {@link caminharPeloRepositorio} devolve é `caminhamento − poda − filtro de extensão`, e as
 * quatro rodadas do Gate 1 sobre este arquivo mediram a mesma classe de defeito por caminhos
 * diferentes: **auditar uma subtração e deixar a outra sem oráculo**. A poda ganhou o relatório de
 * {@link CaminhamentoDoRepositorio.podados}; o filtro de extensão ficou com uma prova que **não pode**
 * fechá-lo, porque testemunhar que as classes *listadas* são alcançadas nada diz sobre a lista estar
 * *completa* — e o Gate 1 falsificou com um módulo CommonJS **sem extensão nenhuma**, consumido por
 * `createRequire`, que atravessou o conjunto com a suíte verde.
 *
 * O fecho das duas de uma vez é o **complemento**: `versionados \ conjunto` tem de ser, por
 * igualdade, um conjunto **declarado de classes** reconhecidamente não-carregáveis — ver
 * {@link classeDoCaminho}. Toda subtração indevida, venha da poda ou do filtro, aparece ali como
 * classe que ninguém declarou. Quem afirma a igualdade é o `CT-626 (d)` de
 * `barreira-de-envio.spec.ts`; o que este arquivo faz é publicar o eixo em que ela é declarada.
 */

import { readdir, readFile } from 'node:fs/promises';
import { basename, join, relative } from 'node:path';

/**
 * As extensões de fonte TypeScript que {@link listarFontesTs} reconhece.
 *
 * ⚠️ **É uma lista, e não o sufixo `.ts`, por medição**: `'ponte.mts'.endsWith('.ts')` é **falso** —
 * os três últimos caracteres são `mts`. Enquanto o filtro foi o sufixo único, `.mts`, `.cts` e
 * `.tsx` eram invisíveis **dentro** de um diretório declarado como varrido, e o Gate 1 falsificou
 * exatamente por aí: uma ponte `.mts` em `packages/db/test/` atravessou a varredura com a suíte
 * verde. "Diretório varrido" tem de significar *todo módulo do diretório*.
 */
const EXTENSOES_DE_FONTE_TS: readonly string[] = ['.cts', '.mts', '.ts', '.tsx'];

/**
 * O diretório de metadados do próprio git — podado **por caminho exato, ancorado na raiz**.
 *
 * Ele não é derivado nem ignorado: é a máquina do git. A âncora na raiz é deliberada — um diretório
 * chamado `.git` em profundidade não é este, e podá-lo por nome seria a mesma troca de identidade
 * que abriu o furo do `docs`.
 */
const DIRETORIO_DO_GIT = '.git';

/**
 * Os diretórios **derivados** que o caminhamento nunca desce — podados em **qualquer profundidade**,
 * e a semântica é deliberada: é exatamente a do padrão homônimo do `.gitignore` deste repositório
 * (`node_modules/`, `dist/`, `.turbo/`, `coverage/` são padrões **sem barra interna**, que o git
 * aplica em todo nível).
 *
 * ⚠️ **A razão de podá-los NÃO é resolubilidade — essa razão foi medida e é falsa.** A versão
 * anterior desta lista justificava a poda dizendo que o carregador não resolve o que está ali; o
 * Gate 1 falsificou importando `'../../../docs/ponte-de-envio.ts'` **sem mudar configuração
 * nenhuma**, e o Vitest resolveu. O que de fato distingue estes quatro é outra propriedade, e é ela
 * que fica escrita: eles são **derivados ou ignorados pelo git**, de modo que uma ponte plantada
 * ali **não sobrevive a um checkout limpo** — logo não pode ser parte de um teste commitado, que é
 * o objeto do modelo de ameaça. Somam-se duas consequências práticas: o `dist/` espelha o fonte que
 * já está no conjunto (contá-lo duplicaria cada achado) e o `node_modules/` é de terceiro.
 *
 * ⚠️ **`docs` NÃO está aqui, e a ausência é a decisão.** Ele esteve, e era o único nome
 * **versionado** da lista: qualquer diretório assim chamado, em qualquer profundidade, saía do
 * conjunto — o Gate 1 mediu a suíte **verde** com pontes em `packages/db/src/docs/` e em `docs/`.
 * A poda não comprava nada (os arquivos carregáveis sob `docs/` são manifestos `.json`, e nenhum
 * nomeia símbolo de produção) e o `.md` do relatório de gate que a motivava **já é excluído pelo
 * filtro de extensão** — {@link EXTENSOES_CARREGAVEIS} não tem `.md`, que é o mecanismo certo para
 * ele. Acrescentar um nome versionado a esta lista **reprova** o `CT-626 (d)`, que audita as duas
 * pontas contra o git.
 */
const DIRETORIOS_DERIVADOS: readonly string[] = ['.turbo', 'coverage', 'dist', 'node_modules'];

/**
 * A lista declarada da poda — a união das duas regras acima, exportada para ser **auditada**.
 *
 * O consumidor não a usa para podar (quem poda é {@link caminharPeloRepositorio}); ele a usa para
 * provar, contra o git, que nenhum nome daqui nomeia segmento de caminho versionado.
 */
export const DIRETORIOS_FORA_DO_CAMINHAMENTO: readonly string[] = [
  DIRETORIO_DO_GIT,
  ...DIRETORIOS_DERIVADOS,
];

/**
 * As extensões que {@link caminharPeloRepositorio} lista: tudo que o carregador de módulos do
 * Node/TS resolve, **mais** os manifestos que reescrevem especificador.
 *
 * Os manifestos (`package.json`, `tsconfig*.json`) entram porque um `exports`/`paths` batiza um
 * módulo com um nome que não contém o caminho dele — é o único ponto da árvore capaz de criar um
 * especificador novo sem que o consumidor escreva o caminho real.
 *
 * ⚠️ **Esta lista é uma SUBTRAÇÃO, e por muito tempo ela não teve oráculo.** A frase que a
 * acompanhava — *"fora dos manifestos, um arquivo que não tenha uma destas extensões não é
 * carregável"* — é uma afirmação sobre o que **falta** aqui, e nenhuma testemunha de classe listada
 * consegue prová-la: testemunha mostra que o que está na lista é alcançado, nunca que o que ficou de
 * fora é inerte. O Gate 1 falsificou a frase com um arquivo **sem extensão nenhuma** carregado por
 * `createRequire` — o CJS compila como JavaScript toda extensão que não reconhece, de modo que
 * "não carregável" nunca foi propriedade do filtro.
 *
 * Quem prova esta lista hoje é o **complemento** (`CT-626 (d)`, âncoras 1-C a 1-E): tudo que é
 * versionado e não entra aqui é classificado por {@link classeDoCaminho} e comparado, **por
 * igualdade**, ao elenco declarado de classes não-carregáveis. Estreitar esta lista tira arquivo do
 * conjunto e o joga no complemento, onde a classe dele passa a ser uma classe não declarada — e a
 * igualdade reprova nomeando-a. Estreitá-la numa classe que a árvore ainda não tem (foi o mutante
 * `MUT-I`, com `.mts`) reprova pela outra ponta, a da **totalidade**: a classe que o carregador
 * resolve deixaria de estar declarada dos dois lados.
 */
export const EXTENSOES_CARREGAVEIS: readonly string[] = [
  '.cjs',
  '.cts',
  '.js',
  '.json',
  '.jsx',
  '.mjs',
  '.mts',
  '.ts',
  '.tsx',
];

/**
 * A **classe** de um caminho — o eixo em que o complemento do conjunto varrido é declarado.
 *
 * É a extensão quando o nome tem uma, e o **nome inteiro** quando não tem. A regra não é um detalhe
 * de implementação: ela é a razão de o complemento conseguir ser declarado por classe em vez de por
 * arquivo, e vem de uma propriedade do que se está declarando.
 *
 * O que se afirma de cada classe do complemento é que ela **anuncia um conteúdo que não é
 * JavaScript** — `.md` anuncia Markdown, `.sql` anuncia SQL, `.service` anuncia unidade do systemd.
 * O anúncio é o que torna a declaração estável e curta: vale para os 364 arquivos `.md` de hoje e
 * para os do ano que vem, sem lista de caminhos que ninguém consegue manter.
 *
 * **Arquivo sem extensão não anuncia nada — logo o nome inteiro é a classe.** `Makefile` anuncia um
 * makefile pelo próprio nome, do mesmo modo que `Dockerfile` ou `LICENSE`; um `ponte-sem-extensao`
 * não anuncia coisa alguma, e é exatamente o arquivo que o Gate 1 usou para atravessar o conjunto
 * (CommonJS puro, carregado por `createRequire`). Com esta regra ele entra no complemento como uma
 * classe **nova**, e a igualdade do `CT-626 (d)` reprova nomeando-o em vez de o absorver numa classe
 * genérica de "sem extensão" — que era a forma de a declaração passar a mentir em silêncio.
 *
 * O ponto **inicial** não abre classe (`.gitignore` é a classe `.gitignore`, não a classe `''`),
 * porque em nome de arquivo oculto o ponto é prefixo, e não separador de sufixo.
 */
export function classeDoCaminho(relativo: string): string {
  const nome = basename(relativo);
  const ponto = nome.lastIndexOf('.');

  return ponto > 0 ? nome.slice(ponto) : nome;
}

export interface VarreduraDeFontes {
  /** Quantos arquivos foram efetivamente lidos. Zero nunca é escondido: é afirmável. */
  readonly arquivos: number;
  /** `<caminho>:<linha>` de cada linha que casou, na ordem de leitura. */
  readonly ocorrencias: string[];
  /** O texto de cada linha que casou, sem comentários — na mesma ordem de `ocorrencias`. */
  readonly linhas: string[];
}

/**
 * Lista recursivamente o fonte TypeScript de um diretório — ver {@link EXTENSOES_DE_FONTE_TS}.
 *
 * Não engole ausência: diretório inexistente levanta, e é o que impede a cobertura de cair a zero
 * em silêncio quando um alvo é renomeado ou movido.
 */
export async function listarFontesTs(diretorio: string): Promise<string[]> {
  const entradas = await readdir(diretorio, { withFileTypes: true });

  const caminhos: string[] = [];
  for (const entrada of entradas) {
    const caminho = join(diretorio, entrada.name);
    if (entrada.isDirectory()) {
      caminhos.push(...(await listarFontesTs(caminho)));
    } else if (EXTENSOES_DE_FONTE_TS.some((extensao) => entrada.name.endsWith(extensao))) {
      caminhos.push(caminho);
    }
  }
  return caminhos.sort();
}

/** O que {@link caminharPeloRepositorio} observou: o que entrou no conjunto e o que ficou de fora. */
export interface CaminhamentoDoRepositorio {
  /** Os caminhos **absolutos** dos arquivos carregáveis, ordenados. */
  readonly arquivos: string[];
  /**
   * Os caminhos **relativos à raiz** de cada diretório efetivamente podado, ordenados.
   *
   * Ele existe porque a poda é a única parte do caminhamento que **subtrai** — e subtração sem
   * relatório não tem como ser auditada. Devolvendo-a, o consumidor prova a cada execução que todo
   * caminho subtraído é derivado ou ignorado pelo git, e portanto que nada que sobreviva a um
   * checkout limpo ficou fora do conjunto.
   */
  readonly podados: string[];
}

/**
 * Caminha, a partir de uma raiz, por **todo** arquivo carregável que sobrevive a um checkout limpo.
 *
 * O contrato é diferente do de {@link listarFontesTs}, e a diferença é o ponto: aqui o alvo não é
 * um diretório escolhido, e sim *o conjunto inteiro de módulos que podem existir*. Ele é o que
 * permite afirmar por igualdade quem liga um símbolo — uma afirmação que um caminhamento por
 * diretório declarado **não** consegue sustentar, porque a ligação pode acontecer em qualquer
 * módulo.
 *
 * A poda ({@link DIRETORIOS_FORA_DO_CAMINHAMENTO}) e o filtro de extensão
 * ({@link EXTENSOES_CARREGAVEIS}) são **declarados**, e não heurísticos: quem os estreitar reduz o
 * conjunto sobre o qual a igualdade vale. Declarado, porém, não basta — a lista já foi declarada e
 * **errada**, com um nome versionado dentro. Por isso a poda é decidida sobre o **caminho relativo
 * à raiz** (nunca sobre o nome da entrada isolado) e é **relatada** em
 * {@link CaminhamentoDoRepositorio.podados}, para que o consumidor a confronte com o git.
 *
 * ⚠️ **A fronteira do "todo", escrita por inteiro — porque a categoria já foi escrita e era falsa.**
 * Este caminhamento devolve, e só devolve, **o arquivo versionado cuja classe é declarada carregável**
 * — as classes de {@link EXTENSOES_CARREGAVEIS}, medidas contra o complemento pelo `CT-626 (d)`. O
 * que fica de fora são três coisas, todas nomeadas: (i) o que **não sobrevive a um checkout limpo**,
 * que é a poda e é auditada contra o git nas duas pontas; (ii) o arquivo versionado cuja classe
 * **anuncia conteúdo que não é JavaScript**, que é o complemento declarado; e (iii) o arquivo
 * **não versionado** em posição normal, que é superinclusão conservadora — ele entra no conjunto, e
 * nunca sai dele. Um módulo carregado por caminho que não seja arquivo versionado da árvore (um
 * `createRequire` sobre resíduo local, um processo externo) está fora daqui **e** fora do modelo de
 * ameaça, pela mesma razão registrada em `barreira-de-envio.spec.ts`: contorná-lo exige conhecer o
 * detector, e não é o que faz o autor que segue o idioma da casa.
 *
 * Não engole ausência, pela mesma razão de {@link listarFontesTs}.
 */
export async function caminharPeloRepositorio(raiz: string): Promise<CaminhamentoDoRepositorio> {
  const arquivos: string[] = [];
  const podados: string[] = [];

  await descerPor(raiz, raiz, arquivos, podados);

  return { arquivos: arquivos.sort(), podados: podados.sort() };
}

/**
 * A poda, decidida sobre o **caminho relativo à raiz** — e não sobre o nome da entrada.
 *
 * A distinção é o defeito que a rodada 3 mediu: com o casamento por nome, um diretório versionado
 * homônimo de um derivado sumia **em qualquer profundidade**, e as duas âncoras da barreira ficavam
 * cegas ao mesmo tempo. Aqui o `.git` casa só na raiz, e os derivados casam em qualquer
 * profundidade **porque é essa a semântica do `.gitignore` que os cobre** — ver
 * {@link DIRETORIOS_DERIVADOS}. Que o espelhamento continue verdadeiro é afirmado contra o git pelo
 * consumidor, e não confiado a esta função.
 */
function estaForaDoCaminhamento(relativo: string): boolean {
  if (relativo === DIRETORIO_DO_GIT) {
    return true;
  }

  const ultimoSegmento = relativo.slice(relativo.lastIndexOf('/') + 1);

  return DIRETORIOS_DERIVADOS.includes(ultimoSegmento);
}

/** Um nível do caminhamento — separado de {@link caminharPeloRepositorio} para carregar a raiz. */
async function descerPor(
  raiz: string,
  diretorio: string,
  arquivos: string[],
  podados: string[],
): Promise<void> {
  const entradas = await readdir(diretorio, { withFileTypes: true });

  for (const entrada of entradas) {
    const caminho = join(diretorio, entrada.name);
    if (entrada.isDirectory()) {
      const relativo = relative(raiz, caminho);
      if (estaForaDoCaminhamento(relativo)) {
        podados.push(relativo);
        continue;
      }
      await descerPor(raiz, caminho, arquivos, podados);
    } else if (EXTENSOES_CARREGAVEIS.some((extensao) => entrada.name.endsWith(extensao))) {
      arquivos.push(caminho);
    }
  }
}

/** O fonte com comentários de linha e de bloco substituídos por espaço, preservando as quebras. */
export function semComentarios(fonte: string): string {
  return fonte
    .replace(/\/\*[\s\S]*?\*\//g, (bloco) => bloco.replace(/[^\n]/g, ' '))
    .replace(/\/\/[^\n]*/g, '');
}

/**
 * Lê cada arquivo da lista e coleta as linhas que o predicado aceita.
 *
 * Recebe **arquivos**, e não diretórios, de propósito: o alvo de uma asserção estática precisa ser
 * declarado e verificável, e um arquivo que sumiu faz `readFile` levantar — que é o alarme que o
 * caminhamento tolerante não dava.
 */
export async function varrerArquivos(
  arquivos: readonly string[],
  casa: (linha: string) => boolean,
): Promise<VarreduraDeFontes> {
  const ocorrencias: string[] = [];
  const linhasCasadas: string[] = [];

  for (const caminho of arquivos) {
    const conteudo = semComentarios(await readFile(caminho, 'utf8'));
    conteudo.split('\n').forEach((linha, indice) => {
      if (casa(linha)) {
        ocorrencias.push(`${caminho}:${indice + 1}`);
        linhasCasadas.push(linha.trim());
      }
    });
  }

  return { arquivos: arquivos.length, ocorrencias, linhas: linhasCasadas };
}
