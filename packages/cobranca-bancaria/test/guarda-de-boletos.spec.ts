/**
 * Verificação da **guarda de boletos** — CT-947 da fatia `emissao-e-conciliacao`, e CT-1087 da
 * fatia `automacoes-agendadas` (o expurgo do acervo, que fecha o `D26 · F4/T9`).
 *
 * ⚠️ **Este caso nasceu no challenge de 2026-08-16.** A §11.4 da tech spec promete que *"o caminho
 * resolvido é conferido contra o diretório-base antes de qualquer leitura ou escrita"*, e nenhum dos
 * 36 casos anteriores da fatia exercitava essa conferência — garantia de segurança **declarada sem
 * rede**, que o P4 do Protocolo Antirregressão não admite.
 *
 * ---------------------------------------------------------------------------
 * INVARIANTES
 * ---------------------------------------------------------------------------
 *
 * | Critério | CT     | Invariante |
 * |----------|--------|------------|
 * | CA-08    | CT-947 | O caminho legítimo grava e relê os **mesmos bytes** sob a base, e o nome do
 * |          |        | arquivo é **derivado** do código canônico — nunca recebido. É o controle
 * |          |        | antivácuo: sem ele, uma guarda que recusasse tudo passaria no caso. |
 * | CA-08    | CT-947 | O arquivo gravado **não é legível por "outros"**: os bytes não são cifrados
 * |          | (a2)   | por decisão declarada, e o que protege o acervo é a permissão. |
 * | CA-08    | CT-947 | `../fora`, caminho absoluto e separador embutido são recusados nas **três**
 * |          | (b)    | operações — gravar, ler e apagar —, e a recusa é a da guarda, **jamais** um
 * |          |        | erro de sistema: erro com `code` significa que o `fs` foi tocado. |
 * | CA-08    | CT-947 | A recusa nomeia o **campo** (`codigo`) e não carrega o caminho recebido em
 * |          | (c)    | nenhuma das superfícies do erro — nome, mensagem e campo —, medido por
 * |          |        | varredura com controle positivo. |
 * | CA-08    | CT-947 | **Nenhum byte nasce fora da base**: `readdir` da base e do **pai** são
 * |          | (d)    | comparados por igualdade de conjunto contra listas escritas por extenso, e o
 * |          |        | arquivo vizinho plantado no pai continua com o conteúdo original — a
 * |          |        | tentativa hostil não o sobrescreveu nem o leu. |
 * | CA-08    | CT-947 | `apagar` é **idempotente**: o segundo apagamento do mesmo boleto não levanta
 * |          | (e)    | erro, e a base termina vazia. |
 * | CA-08    | CT-947 | Base escrita de forma não canônica — subida de diretório no meio, separador
 * |          | (f)    | final — é **normalizada uma vez**, e o boleto cai no diretório real: o pai
 * |          |        | não ganha entrada nenhuma. |
 * | CA-08    | CT-947 | A recusa é **anterior ao filesystem**: com o diretório-base **apagado**, a
 * |          | (g)    | entrada hostil continua recusada pela guarda e **sem código de sistema**,
 * |          |        | enquanto o código **legítimo** falha com `ENOENT` — que é ao mesmo tempo o
 * |          |        | controle antivácuo (a base de fato sumiu, e o caso não passa por
 * |          |        | vacuidade) e a discriminante da ORDEM. |
 *
 * | CA-21    | CT-1087 | `expurgarBoletosVencidos(90)` remove **exatamente** o que já completou
 * |          |         | mais dias do que a retenção: o de `91d` sai, e o de `90d` exatos e o de
 * |          |         | `89d` **permanecem** — conjunto remanescente afirmado por igualdade. A
 * |          |         | chamada devolve `removidos === 1`, e a segunda devolve `0` sem levantar. |
 * | CA-21    | CT-1087 | Base **inexistente** devolve `0` sem levantar (`ENOENT`-tolerante), e o pai
 * |          | (b)     | não ganha entrada nenhuma — a base não é criada por conveniência. |
 * | CA-21    | CT-1087 | Um **vínculo simbólico** sob a base, apontando para fora dela, é recusado com
 * |          | (c)     | `ErroDeBoletoForaDaGuarda`; o arquivo de fora **continua existindo** com o
 * |          |         | conteúdo original; e **nada** é removido — nem o boleto vencido que estava
 * |          |         | na mesma passagem. É o par que discrimina a fase de reconhecimento. |
 * | CA-21    | CT-1087 | O boleto gravado pela **porta legítima** é alcançado pelo expurgo quando
 * |          | (d)     | vence, e a leitura dele passa a falhar com `ENOENT` do sistema. |
 * | CA-21    | CT-1087 | Prazo inválido (`-1`) é recusado com `RangeError` e **nada** é removido — a
 * |          | (e)     | contenção do modo de falha mais caro do módulo. |
 * | CA-21    | CT-1087 | O reconhecimento decide por **idade, nunca por nome**: o intermediário
 * |          | (f)     | `.parcial` órfão e **vencido** é removido (a contagem sobe para `2`), e o
 * |          |         | `.parcial` **recente** permanece. É a propriedade sobre a qual o `D32 ·
 * |          |         | F4/T9` foi fechado. |
 *
 * Rastreabilidade: `CA-08 → CT-947 (RN-08)` · `CA-21 → CT-1087 (RN-11)` · `CA-21 → CT-1087 (f) (RN-11)`.
 *
 * ---------------------------------------------------------------------------
 * Qual asserção DISCRIMINA o defeito (prova do P4, que aqui é de raciocínio)
 * ---------------------------------------------------------------------------
 *
 * Todas as asserções deste arquivo são **comportamentais** — exercitam a guarda contra um
 * filesystem real e observam o resultado —, e por isso o P4 as dispensa de demonstração por
 * mutante (`.claude/rules/testing-stack.md`, 2026-08-16). A que discrimina é o par do caso (d):
 * uma guarda **sem** a conferência do caminho resolvido faria `ler('../fora')` devolver os bytes do
 * arquivo vizinho plantado em `${pai}/fora.pdf`, e `gravar('../fora', …)` os sobrescreveria. As duas
 * asserções afirmam exatamente esse par — a rejeição **e** o conteúdo do vizinho intacto, byte a
 * byte —, de modo que remover a conferência reprova sem depender de contagem de arquivos.
 *
 * A conferência de que a recusa acontece **antes** de qualquer `fs` é discriminada pelo **par
 * abaixo**, e a redação anterior desta seção estava errada: ela creditava a discriminação à
 * ausência de `code` no erro levantado, que **nunca pôde falhar** — `ErroDeBoletoForaDaGuarda` não
 * tem esse campo por construção, e o acessório de captura relançava tudo que não fosse ela, de modo
 * que a asserção de tipo era condição implicada pelo setup (AP-29, achado do Gate 1 na rodada 1).
 * Uma implementação que gravasse primeiro, capturasse o `ENOENT` e o traduzisse em
 * `ErroDeBoletoForaDaGuarda` passava em todas as asserções do arquivo.
 *
 * O par que discrimina, e que precisa dos **dois** lados:
 *
 * 1. **A captura é agnóstica ao tipo.** {@link recusaDe} devolve o que for levantado, sem filtrar;
 *    quem afirma o tipo é {@link recusaDaGuarda}, num ponto único aplicado a **todos** os usos do
 *    arquivo. Um erro cru do `fs` que vaze chega até lá e reprova **nomeando o obtido**.
 * 2. **O caso (g) apaga o diretório-base antes de chamar**, removendo a premissa de que o disco
 *    coopera. Uma implementação que tocasse o `fs` primeiro só teria `ENOENT` a oferecer, e o caso
 *    afirma exatamente o par oposto: a entrada **hostil** é recusada pela guarda e sem código de
 *    sistema, enquanto o código **legítimo** falha com `ENOENT` do sistema — e **não** com a recusa
 *    da guarda. Nenhuma ordem que consulte o disco antes satisfaz as duas ao mesmo tempo: ela
 *    inverteria as duas de uma vez.
 *
 * ⚠️ **A travessia pura (`../fora`, caminho absoluto, separador embutido) NÃO ganha caso próprio no
 * CT-1087, e a omissão é deliberada.** `expurgarBoletosVencidos` não recebe nome algum — ele descobre
 * as entradas por `readdir`, que nunca devolve `..` nem separador —, de modo que um caso de travessia
 * ali só poderia ser escrito contra as três operações que **recebem** código, e essas já são o
 * `CT-947 (b)`/`(d)`, contra as mesmas três entradas hostis. Copiá-lo seria a duplicata semântica
 * (AP-26) que o `D27` daquela fatia registra. O que o CT-1087 acrescenta é o **único** vetor de fora
 * da base que a varredura pode de fato encontrar: a entrada que **parece** um boleto e é um vínculo —
 * e o alvo dela é justamente `../fora.pdf`, de modo que o caso `(c)` cruza os dois eixos.
 *
 * **No CT-1087 a asserção que discrimina é o `(c)`**, e ela precisa dos **três** lados juntos: a
 * recusa levantada, o arquivo de fora intacto **e** o boleto vencido ainda na base. Uma varredura
 * que usasse `stat` no lugar de `lstat` decidiria pela idade do alvo **fora** da base e não
 * levantaria; uma que apagasse enquanto examina levantaria, mas já teria removido o vencido — e é a
 * terceira asserção, e só ela, que separa as duas. A borda de `90d` exatos, no caso principal,
 * discrimina `>` de `>=` no corte.
 *
 * **No `(f)` quem discrimina é o par (i)+(ii)**, e ele fecha uma **classe**, não um filtro: instalar
 * em `reconhecerVencidos` toda decisão por nome que **estreite o alcance** da varredura —
 * `EXTENSAO_DO_BOLETO`, o prefixo `COB-`, o sufixo `.parcial` — reprova uma das duas pernas. Filtrar
 * por extensão faz a contagem cair para `1` e deixa o órfão vencido na base; remover todo `.parcial`
 * leva o órfão recente e reprova a igualdade de conjunto. O caso é **comportamental**, e por isso o P4
 * o dispensa de mutante: ele já reprova contra a implementação que o `D32` temia.
 *
 * ⚠️ **O predicado é "estreitar o alcance", e não "qualquer decisão por nome" — a diferença foi
 * MEDIDA.** Sobrevive uma só: a **lista branca `{.pdf, .parcial}` combinada com idade**, em que o
 * órfão vencido entra na contagem e o recente sobrevive **por idade**. Ela é **benigna**, porque
 * `gravar` só compõe essas duas formas: não é o filtro que o `D32` temia, e a rede **não** tem lacuna.
 * A redação anterior quantificava universalmente sem medir — é a mesma classe de defeito que a
 * **ADR-0015** sofreu nesta base (*"todo contador sequencial deste produto é único por empresa"*,
 * falsificado pelo contador bancário e superseded pela **0033**). Achado do Gate 2 na rodada 2.
 *
 * ⚠️ **Ele existe porque a propriedade virou fundamento de fecho de débito.** O docblock de
 * `guarda-de-boletos.ts` afirma que a varredura alcança o `.parcial` órfão *"e isso é ganho, não
 * efeito colateral"*, e a §2 do `run-report.md` da fatia `emissao-e-conciliacao` fecha o `D32` sobre
 * exatamente essa afirmação. Sem este caso, todas as asserções de conjunto do bloco usavam **só nomes
 * `.pdf`** — e continuariam verdes com o filtro instalado, que é a regressão de prova (R2) que o
 * débito previu, com o caminho invertido.
 *
 * ---------------------------------------------------------------------------
 * O que este arquivo NÃO tenta discriminar, e por que a tentativa seria pior
 * ---------------------------------------------------------------------------
 *
 * A guarda tem **dois degraus** — o esquema do código e a conferência do caminho resolvido — e cada
 * um deles, sozinho, recusa as três entradas hostis. Nenhuma asserção daqui diz **qual** dos dois
 * agiu, e isso é deliberado: o invariante da CA-08 é sobre o **efeito** (nada nasce nem é lido fora
 * da base), não sobre a mecânica interna. Um caso que exercitasse só o segundo degrau precisaria de
 * um ponto de entrada que aceitasse o nome pronto — símbolo de produção criado para o teste
 * enxergar algo, que a lei do seam proíbe —, e o custo seria trocar prova de comportamento por
 * prova de estrutura.
 *
 * É por isso que o segundo degrau existe: ele é **contenção de efeito**, e vale para o dia em que o
 * primeiro deixar de alcançar quem compõe o nome por outro caminho. Enquanto o esquema estiver no
 * lugar, ele é inalcançável pela superfície pública — e a alternativa a mantê-lo seria confiar em
 * validação de entrada como única defesa, que é o oposto do que a §11.4 da tech spec promete.
 *
 * ---------------------------------------------------------------------------
 * A fronteira é REAL, e o arranjo é descartável
 * ---------------------------------------------------------------------------
 *
 * Boundary: `filesystem`. Cada caso monta a sua própria árvore em `tmpdir()` — base **e pai
 * observável** — e a remove no fim. Nada aqui toca a árvore versionada nem o diretório que a
 * operação usa (ADR-0006): o diretório-base chega **por parâmetro**, que é a mesma propriedade que
 * a ADR-0025 exige do pacote.
 */

import {
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rm,
  stat,
  symlink,
  utimes,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, sep } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  criarGuardaDeBoletos,
  ErroDeBoletoForaDaGuarda,
  type GuardaDeBoletos,
} from '../src/guarda-de-boletos.ts';
// A comparação de conjuntos subiu para a casa única do diretório com a T10 — ver o cabeçalho de
// `./conjuntos.ts` para o limiar de três que a fez sair daqui (débito **D29**). O corpo é o mesmo,
// byte a byte; o que muda é haver **uma** declaração para as três âncoras do diretório.
import { diferencasDeConjunto } from './conjuntos.ts';

// ===========================================================================
// Dados escritos POR EXTENSO — nunca derivados do artefato sob prova
// ===========================================================================

/** O código legítimo, na forma que `ESQUEMA_DO_CODIGO_DE_COBRANCA` admite. */
const CODIGO_LEGITIMO = 'COB-2026-0000054';

/**
 * O nome do arquivo que a guarda deve derivar — escrito à mão, e jamais composto a partir de
 * {@link CODIGO_LEGITIMO} por concatenação.
 *
 * Compor o esperado com a mesma regra do artefato poria as duas pontas sob a mesma autoria, e a
 * igualdade não poderia falhar (AP-29): uma guarda que trocasse a extensão continuaria verde.
 */
const NOME_DERIVADO = 'COB-2026-0000054.pdf';

/** Os bytes do boleto — literal do caso, e a âncora do controle antivácuo. */
const BYTES_DO_BOLETO = Buffer.from('%PDF-1.4 boleto emitido pelo provedor\n', 'utf8');

/** O arquivo plantado no diretório PAI — o alvo que uma guarda sem conferência alcançaria. */
const NOME_DO_VIZINHO = 'fora.pdf';

/** O conteúdo do vizinho. Nenhuma operação da guarda pode lê-lo nem sobrescrevê-lo. */
const BYTES_DO_VIZINHO = Buffer.from('conteudo do vizinho, fora do alcance da guarda\n', 'utf8');

/**
 * As três entradas hostis do card, com o nome da forma que cada uma explora.
 *
 * ⚠️ **A terceira é a que sobrevive a um chamador futuro**: `COB-2026/0000054` é recusada pelo
 * esquema do código (primeiro degrau), e o separador embutido é o que a conferência do caminho
 * resolvido (segundo degrau) fecha para quem compuser o nome por outro caminho.
 */
const ENTRADAS_HOSTIS = [
  { forma: 'subida de diretório', valor: '../fora' },
  { forma: 'caminho absoluto', valor: '/etc/sysloc/roubado' },
  { forma: 'separador embutido', valor: 'COB-2026/0000054' },
] as const;

/** O campo que a recusa nomeia — o único conteúdo que ela tem licença para citar. */
const CAMPO_ESPERADO = 'codigo';

/**
 * O `code` que o `fs` do Node devolve quando o diretório de destino não existe.
 *
 * Escrito à mão, e não importado do artefato: é **vocabulário do sistema operacional**, e o caso
 * (g) o usa para afirmar que a falha do caminho legítimo veio do disco, e não da guarda.
 */
const CODIGO_DE_AUSENCIA = 'ENOENT';

/** O conteúdo da base ao fim do caminho legítimo — igualdade de conjunto, nunca contenção. */
const BASE_COM_O_LEGITIMO = [NOME_DERIVADO] as const;

/** O conteúdo do pai, do começo ao fim: o diretório-base e o vizinho plantado, e nada mais. */
const PAI_INTACTO = ['base', NOME_DO_VIZINHO] as const;

/**
 * O conteúdo do pai no caso (g), depois de a base ser apagada: só o vizinho.
 *
 * Escrito por extenso, e não derivado de {@link PAI_INTACTO} por subtração: derivá-lo poria a
 * expectativa e o arranjo sob a mesma autoria, e a base recriada por um `mkdir` de conveniência
 * dentro da guarda passaria despercebida.
 */
const PAI_SEM_A_BASE = [NOME_DO_VIZINHO] as const;

/** O nome do diretório-base dentro da árvore descartável — o pai precisa ser observável. */
const NOME_DA_BASE = 'base';

// ===========================================================================
// Acessórios — a árvore descartável, montada pelo caminho legítimo
// ===========================================================================

/**
 * As superfícies do erro em que um vazamento caberia — nome, mensagem e campo.
 *
 * A pilha fica de fora de propósito: ela carrega o caminho do **arquivo de teste**, e varrê-la
 * transformaria o nome deste arquivo em achado. O que se persegue é o valor recebido, e ele só
 * poderia entrar por interpolação numa das três superfícies abaixo.
 */
function superficiesDoErro(erro: ErroDeBoletoForaDaGuarda): readonly string[] {
  return [erro.name, erro.message, erro.campo];
}

/** As ocorrências de cada agulha nas superfícies dadas, na forma `<agulha> em <superfície>`. */
function ocorrenciasDe(
  superficies: readonly string[],
  agulhas: readonly string[],
): readonly string[] {
  const achados: string[] = [];
  for (const agulha of agulhas) {
    for (const superficie of superficies) {
      if (superficie.includes(agulha)) {
        achados.push(`${agulha} em ${superficie}`);
      }
    }
  }
  return achados;
}

/**
 * Captura o que a operação levantou — **seja o que for** — e reprova se ela não levantar nada.
 *
 * ⚠️ **A ausência de filtro por tipo é o mecanismo, não descuido.** A versão anterior deste
 * acessório só devolvia o erro quando ele já era `ErroDeBoletoForaDaGuarda` e relançava o resto:
 * com isso, toda asserção `toBeInstanceOf` do arquivo passava a ser condição **implicada pelo
 * setup**, e nenhuma delas podia falhar (AP-29). Quem discrimina é a asserção — {@link
 * recusaDaGuarda} —, jamais o arranjo.
 */
async function recusaDe(operacao: Promise<unknown>): Promise<unknown> {
  try {
    await operacao;
  } catch (erro) {
    return erro;
  }

  throw new Error('a operação foi aceita, e o caso exige que ela seja recusada');
}

/**
 * Afirma que a recusa capturada é a **da guarda**, e estreita o tipo para as asserções seguintes.
 *
 * É aqui que o `toBeInstanceOf` mora, e é aqui que ele pode falhar: recebendo o erro **bruto** de
 * {@link recusaDe}, um `ENOENT`/`EACCES` vazado do `fs` chega até esta linha e reprova nomeando o
 * que veio no lugar. Estreitar por `instanceof` — e não por asserção de tipo (`as`) — mantém a
 * verificação que o caso persegue em vez de apagá-la.
 */
function recusaDaGuarda(recusa: unknown): ErroDeBoletoForaDaGuarda {
  expect(recusa).toBeInstanceOf(ErroDeBoletoForaDaGuarda);

  if (!(recusa instanceof ErroDeBoletoForaDaGuarda)) {
    // Inalcançável — o `expect` acima já interrompeu o caso. O ramo existe só para estreitar o
    // tipo, e relança o original para que a falha não perca o erro que de fato apareceu.
    throw recusa;
  }

  return recusa;
}

/**
 * O `code` que o `fs` do Node põe em toda falha de sistema (`ENOENT`, `EACCES`, `EISDIR`), ou
 * `undefined` quando o erro não é do sistema.
 *
 * A leitura é feita sobre o erro **bruto**, sem asserção de tipo, e é o que separa *"recusado antes
 * de tocar o disco"* de *"tentou, falhou e traduziu o erro do sistema"*.
 */
function codigoDeSistemaDe(erro: unknown): string | undefined {
  if (typeof erro !== 'object' || erro === null || !('code' in erro)) {
    return undefined;
  }

  const { code } = erro;
  return typeof code === 'string' ? code : undefined;
}

describe('CT-947 — a guarda de boletos não escreve nem lê fora do diretório-base', () => {
  let raiz = '';
  let base = '';
  let guarda: GuardaDeBoletos;

  beforeEach(async () => {
    // A árvore inteira é descartável e nasce no caso — o diretório-base chega à guarda por
    // PARÂMETRO, que é a propriedade que a ADR-0025 exige do pacote.
    raiz = await mkdtemp(join(tmpdir(), 'sysloc-guarda-de-boletos-'));
    base = join(raiz, NOME_DA_BASE);
    await mkdir(base);

    // O vizinho: um arquivo real no diretório PAI, no caminho exato que `../fora` alcançaria.
    // Sem ele, "nada nasceu fora" seria satisfeito por um pai que nunca teve nada.
    await writeFile(join(raiz, NOME_DO_VIZINHO), BYTES_DO_VIZINHO);

    guarda = criarGuardaDeBoletos(base);
  });

  afterEach(async () => {
    await rm(raiz, { recursive: true, force: true });
  });

  it('o caminho legítimo grava e relê os MESMOS bytes sob a base', async () => {
    const nome = await guarda.gravar(CODIGO_LEGITIMO, BYTES_DO_BOLETO);

    // O nome é DERIVADO do código, e o esperado é literal — não composto com a regra do artefato.
    expect(nome).toBe(NOME_DERIVADO);

    // Controle antivácuo: os bytes voltam idênticos pela guarda...
    expect(await guarda.ler(CODIGO_LEGITIMO)).toEqual(BYTES_DO_BOLETO);

    // ...e estão no caminho literal esperado, lidos SEM a guarda. É o que separa "a guarda concorda
    // consigo mesma" de "o arquivo existe onde ela diz que existe".
    expect(await readFile(join(base, NOME_DERIVADO))).toEqual(BYTES_DO_BOLETO);

    // Os bytes NÃO são cifrados por decisão declarada, e o que protege o acervo é a permissão:
    // ninguém além do dono e do grupo enxerga o arquivo. A asserção é sobre os bits de "outros" —
    // e não sobre o modo inteiro — porque o `umask` do processo pode restringir mais, nunca menos.
    expect((await stat(join(base, NOME_DERIVADO))).mode & 0o007).toBe(0);

    // Igualdade de conjunto nas duas árvores, contra listas escritas por extenso.
    expect(diferencasDeConjunto(await readdir(base), BASE_COM_O_LEGITIMO)).toEqual({
      excedentes: [],
      ausentes: [],
    });
    expect(diferencasDeConjunto(await readdir(raiz), PAI_INTACTO)).toEqual({
      excedentes: [],
      ausentes: [],
    });
  });

  it('a base é normalizada, e o boleto cai no diretório real', async () => {
    // Uma base escrita de forma não canônica — com subida de diretório no meio e separador final —
    // que resolve para o MESMO diretório. É a forma que um `EnvironmentFile` editado à mão entrega.
    const guardaComBaseTorta = criarGuardaDeBoletos(`${join(base, '..', NOME_DA_BASE)}${sep}`);

    expect(await guardaComBaseTorta.gravar(CODIGO_LEGITIMO, BYTES_DO_BOLETO)).toBe(NOME_DERIVADO);

    // Lido SEM a guarda, pelo caminho literal: o arquivo está no diretório real, e não num vizinho
    // que a normalização ausente teria criado.
    expect(await readFile(join(base, NOME_DERIVADO))).toEqual(BYTES_DO_BOLETO);

    expect(diferencasDeConjunto(await readdir(raiz), PAI_INTACTO)).toEqual({
      excedentes: [],
      ausentes: [],
    });
  });

  it('apagar remove o boleto e é idempotente', async () => {
    await guarda.gravar(CODIGO_LEGITIMO, BYTES_DO_BOLETO);
    await guarda.apagar(CODIGO_LEGITIMO);

    expect(await readdir(base)).toEqual([]);

    // O segundo apagamento não levanta — a operação é idempotente por decisão, e o caso a fixa.
    await expect(guarda.apagar(CODIGO_LEGITIMO)).resolves.toBeUndefined();
    expect(await readdir(base)).toEqual([]);
  });

  it.each(ENTRADAS_HOSTIS)(
    'recusa gravar, ler e apagar ANTES de tocar o filesystem — $forma',
    async ({ valor }) => {
      for (const bruta of [
        await recusaDe(guarda.gravar(valor, BYTES_DO_BOLETO)),
        await recusaDe(guarda.ler(valor)),
        await recusaDe(guarda.apagar(valor)),
      ]) {
        // O erro chega BRUTO — `recusaDe` não filtra por tipo — e a primeira asserção é sobre o
        // que o `fs` teria deixado nele: toda falha de sistema carrega `code` (`ENOENT`, `EACCES`,
        // `EISDIR`), de modo que a reprovação aqui NOMEIA o código que vazou.
        expect(codigoDeSistemaDe(bruta)).toBeUndefined();

        // E o tipo é o da guarda, e não um erro genérico. A asserção mora em `recusaDaGuarda`, e
        // pode falhar: nada no arranjo garante o tipo do que foi levantado.
        const recusa = recusaDaGuarda(bruta);

        // A recusa nomeia o CAMPO, e o campo é o mesmo nas três operações.
        expect(recusa.campo).toBe(CAMPO_ESPERADO);
      }
    },
  );

  it.each(ENTRADAS_HOSTIS)(
    'a recusa nomeia o campo e JAMAIS o caminho recebido — $forma',
    async ({ valor }) => {
      const recusa = recusaDaGuarda(await recusaDe(guarda.gravar(valor, BYTES_DO_BOLETO)));

      // Controle positivo (AP-29): a MESMA varredura, sobre superfícies em que a agulha foi
      // plantada, devolve as duas ocorrências. Sem ele, a lista vazia abaixo seria indistinguível
      // de uma varredura que não olhou para nada.
      expect(ocorrenciasDe([`recusado: ${valor}`, valor], [valor])).toEqual([
        `${valor} em recusado: ${valor}`,
        `${valor} em ${valor}`,
      ]);

      // Nenhuma superfície do erro carrega o valor recebido, e a asserção é igualdade com lista
      // vazia para que a reprovação NOMEIE o que vazou e por onde.
      expect(ocorrenciasDe(superficiesDoErro(recusa), [valor])).toEqual([]);

      // E ela cita o campo, que é o único conteúdo que a recusa tem licença para nomear.
      expect(recusa.campo).toBe(CAMPO_ESPERADO);
    },
  );

  it('nenhum byte nasce fora da base, e o vizinho do pai fica intacto', async () => {
    for (const { valor } of ENTRADAS_HOSTIS) {
      // Cada recusa é afirmada como sendo a DA GUARDA, e não apenas "alguma falha": sem isto o
      // caso aprovaria uma implementação que tocasse o disco, falhasse com `ENOENT` e deixasse o
      // erro do sistema escapar — que é o desfecho que a captura agnóstica deixa passar adiante.
      recusaDaGuarda(await recusaDe(guarda.gravar(valor, BYTES_DO_BOLETO)));
      recusaDaGuarda(await recusaDe(guarda.ler(valor)));
      recusaDaGuarda(await recusaDe(guarda.apagar(valor)));
    }

    // O caminho legítimo continua funcionando depois das três tentativas — sem isto, uma guarda
    // que recusasse tudo passaria neste caso.
    await guarda.gravar(CODIGO_LEGITIMO, BYTES_DO_BOLETO);

    expect(diferencasDeConjunto(await readdir(base), BASE_COM_O_LEGITIMO)).toEqual({
      excedentes: [],
      ausentes: [],
    });

    // O pai não ganhou entrada nenhuma: nem `fora.pdf` novo, nem `COB-2026` como diretório.
    expect(diferencasDeConjunto(await readdir(raiz), PAI_INTACTO)).toEqual({
      excedentes: [],
      ausentes: [],
    });

    // A asserção que DISCRIMINA a ausência da conferência de caminho: uma guarda sem ela teria
    // sobrescrito este arquivo com os bytes do boleto.
    expect(await readFile(join(raiz, NOME_DO_VIZINHO))).toEqual(BYTES_DO_VIZINHO);
  });

  it('a leitura hostil não devolve os bytes do vizinho', async () => {
    recusaDaGuarda(await recusaDe(guarda.ler(ENTRADAS_HOSTIS[0].valor)));

    // E o vizinho segue lá, com o conteúdo original: a recusa não é "leu e descartou".
    expect(await readFile(join(raiz, NOME_DO_VIZINHO))).toEqual(BYTES_DO_VIZINHO);
  });

  it('a recusa é ANTERIOR ao filesystem: com o diretório-base apagado, a hostil segue recusada pela guarda e a legítima falha no disco', async () => {
    // O arranjo tira o disco de baixo da guarda: a base deixa de existir ANTES da chamada. É o que
    // torna este caso independente da FORMA do erro e dependente só da ORDEM — uma implementação
    // que consultasse o `fs` antes de conferir o caminho não teria o que devolver senão `ENOENT`.
    await rm(base, { recursive: true, force: true });

    for (const { valor } of ENTRADAS_HOSTIS) {
      for (const bruta of [
        await recusaDe(guarda.gravar(valor, BYTES_DO_BOLETO)),
        await recusaDe(guarda.ler(valor)),
        await recusaDe(guarda.apagar(valor)),
      ]) {
        // Sem o diretório, o `fs` só teria `ENOENT` a oferecer — e a recusa não o traz, porque ela
        // acontece antes de ele ser consultado.
        expect(codigoDeSistemaDe(bruta)).toBeUndefined();
        expect(recusaDaGuarda(bruta).campo).toBe(CAMPO_ESPERADO);
      }
    }

    // CONTROLE ANTIVÁCUO — e, ao mesmo tempo, a metade que discrimina a ordem. Se a base não
    // tivesse sumido de fato, o laço acima passaria por um arranjo que nunca mudou nada; e se a
    // guarda consultasse o disco antes de conferir, ela traduziria ESTE `ENOENT` na própria
    // recusa. As duas asserções abaixo afirmam o oposto exato: quem falha é o SISTEMA, no caminho
    // que a guarda já tinha aprovado sem tocar em nada.
    const falhaDaGravacaoLegitima = await recusaDe(guarda.gravar(CODIGO_LEGITIMO, BYTES_DO_BOLETO));
    expect(falhaDaGravacaoLegitima).not.toBeInstanceOf(ErroDeBoletoForaDaGuarda);
    expect(codigoDeSistemaDe(falhaDaGravacaoLegitima)).toBe(CODIGO_DE_AUSENCIA);

    const falhaDaLeituraLegitima = await recusaDe(guarda.ler(CODIGO_LEGITIMO));
    expect(falhaDaLeituraLegitima).not.toBeInstanceOf(ErroDeBoletoForaDaGuarda);
    expect(codigoDeSistemaDe(falhaDaLeituraLegitima)).toBe(CODIGO_DE_AUSENCIA);

    // E o pai continua com o que tinha: nem a base recriada por conveniência, nem entrada nova
    // vinda das nove tentativas hostis.
    expect(diferencasDeConjunto(await readdir(raiz), PAI_SEM_A_BASE)).toEqual({
      excedentes: [],
      ausentes: [],
    });
  });
});

// ===========================================================================
// CT-1087 — o expurgo do acervo por idade, com a contenção da base
// ===========================================================================

/**
 * O prazo que o expurgo recebe nestes casos — o mesmo que a composição raiz declara em produção.
 *
 * Escrito à mão, e não importado da composição: o que o caso afirma é o **corte**, e derivá-lo da
 * mesma constante que o SUT consome poria as duas pontas sob a mesma autoria.
 */
const DIAS_DE_RETENCAO = 90;

/** Milissegundos de um dia — literal do caso, jamais importado do artefato sob prova. */
const MS_POR_DIA = 24 * 60 * 60 * 1000;

/**
 * Os três arquivos do acervo, com a idade que decide o desfecho de cada um.
 *
 * `91` sai, `90` **exatos** permanecem e `89` permanece: é a trinca que discrimina `>` de `>=` no
 * corte, e é por isso que o do meio existe.
 */
const ACERVO_COM_IDADES = [
  { nome: 'boleto-91d.pdf', dias: 91 },
  { nome: 'boleto-90d.pdf', dias: 90 },
  { nome: 'boleto-89d.pdf', dias: 89 },
] as const;

/** Os que sobrevivem à passagem, escritos por extenso — nunca derivados da lista acima por filtro. */
const ACERVO_APOS_O_EXPURGO = ['boleto-90d.pdf', 'boleto-89d.pdf'] as const;

/** O acervo inteiro, escrito por extenso — o estado que o `(c)` e o `(e)` afirmam INTOCADO. */
const ACERVO_INTEIRO = ['boleto-91d.pdf', 'boleto-90d.pdf', 'boleto-89d.pdf'] as const;

/** Quantos arquivos a passagem principal deve remover. */
const REMOVIDOS_NA_PRIMEIRA_PASSAGEM = 1;

/** Quantos a segunda passagem deve remover — o acervo já está no prazo. */
const REMOVIDOS_NA_SEGUNDA_PASSAGEM = 0;

/**
 * O nome do vínculo simbólico plantado sob a base — **legítimo à vista**, e é esse o ponto.
 *
 * Ele é indistinguível de um boleto guardado por qualquer conferência que olhe só o nome: o que o
 * separa é a natureza da entrada, que só `lstat` revela.
 */
const NOME_DO_VINCULO = 'boleto-vinculado.pdf';

/** O prazo inválido do `(e)` — negativo, que classificaria o acervo INTEIRO como vencido. */
const RETENCAO_INVALIDA = -1;

/**
 * Os dois intermediários órfãos do `(f)`, na **forma real** que `gravar` compõe —
 * `<codigo>.pdf.<uuid>.parcial`.
 *
 * ⚠️ **Escritos à mão, e jamais compostos com a regra do artefato.** Derivá-los de
 * `EXTENSAO_DO_BOLETO` + `SUFIXO_PARCIAL` (que são privados do módulo, e por decisão) poria a
 * expectativa e o código sob a mesma autoria — e o caso deixaria de reprovar quem mudasse a forma.
 *
 * ⚠️ **O que este caso persegue NÃO é a forma, é o CRITÉRIO.** O invariante é *"o reconhecimento
 * decide por idade, e nenhuma decisão por nome ESTREITA o que ele alcança"*, e é por isso que os dois
 * têm idades opostas: um filtro por extensão faria o vencido sobreviver, e uma remoção indiscriminada
 * de `.parcial` levaria o recente. Nenhuma das duas satisfaz as duas asserções ao mesmo tempo.
 *
 * ⚠️ **Uma decisão por nome sobrevive, e está declarada de propósito**: a lista branca
 * `{.pdf, .parcial}` **combinada com idade**. Ela é benigna — `gravar` não compõe outra forma —, e
 * não é o filtro que o `D32` temia. Ver a seção de discriminação no topo do arquivo.
 */
const PARCIAL_ORFAO_VENCIDO = 'COB-2026-0000054.pdf.7c9f1f8e-3d2a-4b61-9c0e-5f18a2d47b30.parcial';
const PARCIAL_ORFAO_RECENTE = 'COB-2026-0000055.pdf.1b4d6a02-8e77-4f13-a5cd-92e0c3418f6a.parcial';

/** Quantos arquivos a passagem do `(f)` remove: o boleto de 91 dias e o órfão vencido. */
const REMOVIDOS_COM_O_ORFAO = 2;

/**
 * O que sobra no `(f)`, escrito por extenso — os dois boletos no prazo **e** o órfão recente.
 *
 * A presença do órfão recente nesta lista é o controle que separa *"varre por idade"* de *"apaga todo
 * `.parcial`"*: sem ele, uma limpeza que removesse todo intermediário passaria no caso.
 */
const ACERVO_APOS_O_EXPURGO_COM_ORFAO = [
  'boleto-90d.pdf',
  'boleto-89d.pdf',
  PARCIAL_ORFAO_RECENTE,
] as const;

describe('CT-1087 — o expurgo remove o que venceu, e nunca alcança nada fora da base', () => {
  let raiz = '';
  let base = '';
  let guarda: GuardaDeBoletos;

  beforeEach(async () => {
    // A mesma árvore descartável do CT-947 — base, pai observável e o vizinho plantado fora —, e o
    // diretório-base chega à guarda por PARÂMETRO (ADR-0025).
    raiz = await mkdtemp(join(tmpdir(), 'sysloc-expurgo-de-boletos-'));
    base = join(raiz, NOME_DA_BASE);
    await mkdir(base);
    await writeFile(join(raiz, NOME_DO_VIZINHO), BYTES_DO_VIZINHO);

    guarda = criarGuardaDeBoletos(base);
  });

  afterEach(async () => {
    await rm(raiz, { recursive: true, force: true });
  });

  /**
   * Cria os três arquivos do acervo com o `mtime` recuado — **pelo relógio do ARRANJO**.
   *
   * ⚠️ É o arranjo que lê o relógio, nunca o SUT: `utimes` fabrica a idade, e o corte que decide o
   * desfecho continua sendo calculado inteiramente dentro da guarda.
   */
  async function semearAcervo(): Promise<void> {
    for (const { nome, dias } of ACERVO_COM_IDADES) {
      const caminho = join(base, nome);
      await writeFile(caminho, BYTES_DO_BOLETO);

      const carimbo = new Date(Date.now() - dias * MS_POR_DIA);
      await utimes(caminho, carimbo, carimbo);
    }
  }

  /** O conteúdo da base, comparado por igualdade de conjunto contra uma lista escrita à mão. */
  async function afirmarAcervo(esperado: readonly string[]): Promise<void> {
    expect(diferencasDeConjunto(await readdir(base), esperado)).toEqual({
      excedentes: [],
      ausentes: [],
    });
  }

  it('remove só o que já completou mais dias do que a retenção, e a segunda passagem devolve 0', async () => {
    await semearAcervo();

    expect(await guarda.expurgarBoletosVencidos(DIAS_DE_RETENCAO)).toBe(
      REMOVIDOS_NA_PRIMEIRA_PASSAGEM,
    );

    // O que sobrou, por igualdade de conjunto: o de 90 dias EXATOS permanece — é ele que separa o
    // corte estrito (`>`) do frouxo (`>=`), e sem ele o caso aprovaria os dois.
    await afirmarAcervo(ACERVO_APOS_O_EXPURGO);

    // Nada nasceu nem sumiu fora da base, e o vizinho segue com o conteúdo original.
    expect(diferencasDeConjunto(await readdir(raiz), PAI_INTACTO)).toEqual({
      excedentes: [],
      ausentes: [],
    });
    expect(await readFile(join(raiz, NOME_DO_VIZINHO))).toEqual(BYTES_DO_VIZINHO);

    // `ENOENT`-tolerante: a segunda passagem sobre o acervo já expurgado não levanta e não conta.
    expect(await guarda.expurgarBoletosVencidos(DIAS_DE_RETENCAO)).toBe(
      REMOVIDOS_NA_SEGUNDA_PASSAGEM,
    );
    await afirmarAcervo(ACERVO_APOS_O_EXPURGO);
  });

  it('CT-1087 (b) — com o diretório-base ausente devolve 0, e não o recria', async () => {
    await rm(base, { recursive: true, force: true });

    expect(await guarda.expurgarBoletosVencidos(DIAS_DE_RETENCAO)).toBe(0);

    // A base NÃO renasce por conveniência: um `mkdir` escondido no expurgo a faria nascer com o modo
    // do `umask`, e mascararia a instalação incompleta que o verificador existe para pegar.
    expect(diferencasDeConjunto(await readdir(raiz), PAI_SEM_A_BASE)).toEqual({
      excedentes: [],
      ausentes: [],
    });
  });

  it('CT-1087 (c) — o vínculo simbólico para fora da base é recusado, o alvo sobrevive e NADA é removido', async () => {
    await semearAcervo();

    // Um vínculo com nome de boleto, apontando para o arquivo do diretório PAI. Ele é deixado
    // RECENTE de propósito: a recusa não é sobre idade, é sobre a entrada não ser conferível — e uma
    // implementação que examinasse a idade primeiro deixaria de levantar aqui.
    await symlink(join(raiz, NOME_DO_VIZINHO), join(base, NOME_DO_VINCULO));

    const bruta = await recusaDe(guarda.expurgarBoletosVencidos(DIAS_DE_RETENCAO));

    // Nenhum código de sistema vazou: a recusa é da guarda, e não um erro do `fs` traduzido.
    expect(codigoDeSistemaDe(bruta)).toBeUndefined();
    expect(recusaDaGuarda(bruta).campo).toBe(CAMPO_ESPERADO);

    // O alvo FORA da base continua existindo, com os bytes originais: `unlink` sobre um vínculo
    // removeria o vínculo, mas a asserção fixa o efeito, e não a chamada.
    await expect(stat(join(raiz, NOME_DO_VIZINHO))).resolves.toBeDefined();
    expect(await readFile(join(raiz, NOME_DO_VIZINHO))).toEqual(BYTES_DO_VIZINHO);

    // E a asserção que DISCRIMINA a fase de reconhecimento: o boleto de 91 dias — que a passagem
    // teria removido — continua lá. Uma varredura que apagasse enquanto examina já o teria levado.
    await afirmarAcervo([...ACERVO_INTEIRO, NOME_DO_VINCULO]);
  });

  it('CT-1087 (d) — o boleto gravado pela porta legítima é alcançado quando vence', async () => {
    // Liga as duas pontas do módulo: o que `gravar` produz é exatamente o que o expurgo varre. Sem
    // esta asserção, o expurgo poderia varrer um universo de nomes que a guarda nunca cria.
    const nome = await guarda.gravar(CODIGO_LEGITIMO, BYTES_DO_BOLETO);
    const vencido = new Date(Date.now() - (DIAS_DE_RETENCAO + 1) * MS_POR_DIA);
    await utimes(join(base, nome), vencido, vencido);

    expect(await guarda.expurgarBoletosVencidos(DIAS_DE_RETENCAO)).toBe(1);
    await afirmarAcervo([]);

    // E a leitura pela guarda passa a falhar no DISCO, e não com a recusa: o arquivo saiu do acervo,
    // e o código continua sendo um código legítimo.
    const falha = await recusaDe(guarda.ler(CODIGO_LEGITIMO));
    expect(falha).not.toBeInstanceOf(ErroDeBoletoForaDaGuarda);
    expect(codigoDeSistemaDe(falha)).toBe(CODIGO_DE_AUSENCIA);
  });

  it('CT-1087 (f) — o intermediário `.parcial` órfão e vencido é alcançado, e o recente permanece', async () => {
    // A árvore que a morte do processo entre `writeFile` e `rename` deixa para trás: o intermediário
    // de nome sorteado, que `ler` e `apagar` NÃO alcançam — os dois compõem `<codigo>.pdf`. Quem o
    // alcança é o expurgo, e só porque ele decide por idade.
    await semearAcervo();

    const vencido = join(base, PARCIAL_ORFAO_VENCIDO);
    await writeFile(vencido, BYTES_DO_BOLETO);
    const carimbo = new Date(Date.now() - (DIAS_DE_RETENCAO + 1) * MS_POR_DIA);
    await utimes(vencido, carimbo, carimbo);

    // O órfão RECENTE — o de uma gravação que pode estar em curso agora. Ele é o controle.
    await writeFile(join(base, PARCIAL_ORFAO_RECENTE), BYTES_DO_BOLETO);

    // (i) A contagem SOBE de um: o órfão vencido saiu junto com o boleto de 91 dias. Um filtro por
    // extensão em `reconhecerVencidos` devolveria `1` aqui, e é esta asserção que o discrimina.
    expect(await guarda.expurgarBoletosVencidos(DIAS_DE_RETENCAO)).toBe(REMOVIDOS_COM_O_ORFAO);

    // (ii) E o que ficou, por igualdade de conjunto: os dois boletos no prazo E o órfão recente. Uma
    // limpeza que apagasse todo `.parcial` reprova aqui — é a outra metade do par.
    await afirmarAcervo(ACERVO_APOS_O_EXPURGO_COM_ORFAO);
  });

  it('CT-1087 (e) — prazo inválido é recusado com RangeError, e o acervo fica intacto', async () => {
    await semearAcervo();

    const bruta = await recusaDe(guarda.expurgarBoletosVencidos(RETENCAO_INVALIDA));

    // O tipo é afirmado: um prazo negativo classificaria TODO o acervo como vencido, e o modo de
    // falha que a recusa contém é a remoção em massa.
    expect(bruta).toBeInstanceOf(RangeError);

    // O controle que separa "recusou" de "recusou antes de apagar": o acervo inteiro, os três.
    await afirmarAcervo(ACERVO_INTEIRO);
  });
});
