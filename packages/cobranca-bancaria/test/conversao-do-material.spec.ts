/**
 * Verificação da **conversão do material PKCS#12 por processo externo** — CT-1014 a CT-1019 e
 * CT-1048 da fatia `integracao-bancaria-autonoma`.
 *
 * ---------------------------------------------------------------------------
 * INVARIANTES
 * ---------------------------------------------------------------------------
 *
 * | Critério | CT      | Invariante |
 * |----------|---------|------------|
 * | CA-09    | CT-1014 | A conversão **preserva a identidade**: a tripla do convertido é idêntica à
 * |          |         | do mesmo certificado em cifra moderna, com a **impressão digital** como
 * |          |         | discriminador — lida por caminho independente do SUT. |
 * | CA-10,11 | CT-1015 | Senha e formato produzem classes e **motivos distintos**, e nada da saída do
 * | CA-16    |         | conversor atravessa a fronteira — medido com **controle positivo**. |
 * | CA-16    | CT-1016 | O **único** artefato em claro é removido em **todo** desfecho: sucesso e os
 * |          |         | **dois** caminhos de erro. |
 * | CA-16    | CT-1017 | O artefato nasce com permissão **`0600` exata**, mesmo com a máscara do
 * |          |         | processo aberta em `0o000`. |
 * | CA-13,14 | CT-1018 | A conversão só corre quando o runtime não abre; o booleano do desfecho é
 * |          |         | **fechado nos dois sentidos**, e o sentido falso devolve os **mesmos bytes**. |
 * | CA-16    | CT-1019 | A superfície nova do processo externo — inclusive `spawnargs` e o objeto de
 * |          |         | erro **cru** — não carrega material nem senha. |
 * | CA-10,11 | CT-1048 | O radical do conversor é o do **executável**, medido nas duas pontas: ele casa
 * |          |         | a saída da senha errada e **não** casa a do formato, e o sinal da
 * |          |         | **biblioteca** jamais casaria — reusá-lo desligaria o ramo da senha. |
 * | CA-16    | CT-1050 | O ambiente do processo da API **não alcança** o conversor: com variável
 * |          |         | hostil plantada — e **controle positivo** provando que ela derruba o
 * |          |         | `-legacy` neste host —, a conversão preserva a identidade. |
 *
 * Rastreabilidade: `CA-09 → CT-1014 (RN-09)` · `CA-10, CA-11 → CT-1015, CT-1048 (RN-09)` ·
 * `CA-13, CA-14 → CT-1018` · `CA-16 → CT-1015, CT-1016, CT-1017, CT-1019, CT-1050`.
 *
 * ⚠️ **O CT-1050 nasceu fora do pipeline**, na intervenção dirigida de 2026-08-22, como a rede do
 * P4 para o `D3` desta fatia (`spawn` sem `env`). Ele é o único caso desta suíte que escreve em
 * `process.env`, e o faz sob `try/finally` com a restauração asserida — ver o docblock de
 * {@link VARIAVEL_HOSTIL_DO_CONVERSOR} para por que a variável é essa e não outra.
 *
 * ⚠️ **O caso do radical é o `CT-1048`, e NÃO o `CT-1022`** — não "corrija" o número de volta. Ele
 * nasceu numerado como `CT-1022` sobre a premissa falsa de que esse era *"o primeiro livre depois de
 * `CT-1021`"*, quando a **T2 já detinha `CT-1020` a `CT-1023`**: o `CT-1022` legítimo é o de
 * `apps/api/test/certificado-do-provedor.e2e.spec.ts` (*"senha errada sobre material legado nomeia a
 * senha"*), alocado desde a geração do plano. A renumeração é o fecho do **`D6`** desta fatia, e o
 * `CT-1048` foi **medido** como o primeiro identificador realmente livre de todo o repositório em
 * 2026-08-22 — varredura de `CT-1[0-9]{3}` sobre `apps`, `packages`, `deploy` e `docs`.
 *
 * ---------------------------------------------------------------------------
 * A fronteira é REAL — processo externo, memória compartilhada e aperto de mão
 * ---------------------------------------------------------------------------
 *
 * Nenhum dublê. O binário de criptografia do host é invocado de verdade, o artefato em claro nasce
 * de verdade em `/dev/shm`, e o material convertido é aberto pelo mesmo `lerMaterial` que a borda
 * usa. Todas as invariantes desta suíte atravessam essa fronteira, e simulá-la produziria confiança
 * dirigida por dublê — o material do provedor é exatamente o insumo que só o mundo real recusa.
 *
 * ⚠️ **Nenhum byte de certificado entra na árvore versionada** (Invariante 3). Autoridade, par e as
 * **duas** embalagens nascem em `mkdtemp` sob `tmpdir()` e são apagados por `onTestFinished`, que o
 * acessório registra no ato da criação.
 *
 * ---------------------------------------------------------------------------
 * O ARRANJO É O CASO: duas embalagens do MESMO par
 * ---------------------------------------------------------------------------
 *
 * Todos os casos partem de **um** par chave/certificado exportado **duas vezes** — moderna, que o
 * runtime abre, e legada (`RC2-40-CBC`), que é a que a Autoridade Certificadora entrega e que o
 * runtime recusa. A âncora que dá conteúdo ao arranjo está no CT-1014 e é executável:
 * `lerMaterial(legado)` **rejeita**. Sem ela, um acessório que gerasse duas embalagens modernas
 * faria toda esta suíte **aprovar um conversor que não converte nada**.
 *
 * ---------------------------------------------------------------------------
 * O prefixo do artefato é literal AQUI, e jamais derivado do módulo
 * ---------------------------------------------------------------------------
 *
 * `PREFIXO_DO_ARTEFATO` é escrito por extenso neste arquivo. Pedir ao módulo o caminho do artefato —
 * por parâmetro, por variável de ambiente ou por símbolo exportado — seria criar um ponto de injeção
 * de produção que só o teste usa, o que a **lei do seam** proíbe; e derivar o esperado do artefato
 * sob prova faria a asserção aprovar qualquer prefixo, inclusive um que mudasse sem ninguém decidir.
 * A observação é por **leitura direta** do diretório.
 *
 * A varredura **filtra pelo prefixo**: `/dev/shm` é compartilhado com outros processos do host (o
 * banco, por exemplo, mantém segmentos lá), e comparar o diretório inteiro seria instável por
 * construção.
 *
 * ---------------------------------------------------------------------------
 * As varreduras de ausência têm CONTROLE POSITIVO, e sem ele não provariam nada
 * ---------------------------------------------------------------------------
 *
 * O molde vive na casa compartilhada do diretório (`./varredura-de-agulhas.ts`), importado por esta
 * suíte e pelas duas irmãs. Ausência é exatamente o que um detector quebrado também devolve
 * (**AP-29**), e por isso a mesma função é aplicada antes a um objeto que **contém** as agulhas.
 *
 * ⚠️ **No CT-1019 o controle é mais forte que o das suítes irmãs, e a diferença é deliberada**: lá
 * ele é um objeto sintético com agulhas plantadas; aqui é a **rejeição REAL** de uma invocação do
 * mesmo binário com a senha em `argv` — isto é, exatamente o defeito que se quer impedir,
 * reproduzido pelo próprio caso. É o que separa *"a varredura enxerga objetos"* de *"a varredura
 * enxerga ESTA superfície"*.
 */

import { execFile } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdtemp, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { criarSegredoOperavel } from '@sysloc/shared';
import { describe, expect, it, onTestFinished } from 'vitest';
import {
  converterMaterialSeNecessario,
  ErroDeFormatoDoMaterial,
  MOTIVO_DO_FORMATO_NAO_SUPORTADO,
  RADICAL_DE_SENHA_DO_CONVERSOR,
} from '../src/conversao-do-material.ts';
import {
  ErroDeMaterialIlegivel,
  ErroDeSenhaQueNaoAbre,
  lerMaterial,
} from '../src/leitura-do-material.ts';
import { diferencasDeConjunto } from './conjuntos.ts';
import type { MaterialDeTeste } from './material-de-teste.ts';
import { gerarAutoridadeDeTeste, gerarMaterialDeTeste } from './material-de-teste.ts';
import type { Agulha } from './varredura-de-agulhas.ts';
import { agulhasDe, controleComAsAgulhas, ocorrenciasDeAgulhas } from './varredura-de-agulhas.ts';

const executar = promisify(execFile);

/**
 * Teto de um caso inteiro: gerar duas chaves RSA, emitir o par nas duas embalagens, converter e
 * completar os apertos de mão.
 *
 * A geração é o trecho lento, e o teto é folgado por causa dela. Sob disputa de CPU o modo de falha
 * previsto é **tempo esgotado**, e não resultado errado.
 */
const LIMITE_DO_CASO_MS = 120_000;

/** A senha real do cofre — improvável, para servir de agulha da varredura. */
const SENHA_DO_COFRE = 'senha-real-do-cofre-7c4e2a9f1b';

/** A senha deliberadamente errada — input efetivamente distinto, e não um caractere trocado. */
const SENHA_SENTINELA_ERRADA = 'senha-sentinela-que-nao-abre-5e1d3c';

/** O binário do host, por caminho absoluto — o mesmo que o módulo invoca. */
const CONVERSOR = '/usr/bin/openssl';

/** Um caminho que **não existe**, para obter do runtime a rejeição crua que carrega `spawnargs`. */
const CONVERSOR_INEXISTENTE = '/usr/bin/openssl-que-nao-existe-neste-host';

/** Onde o artefato em claro nasce — observado **diretamente**, por leitura do diretório. */
const DIRETORIO_EM_MEMORIA = '/dev/shm';

/** O prefixo do nome do artefato, escrito por extenso — ver o cabeçalho sobre por que não se deriva. */
const PREFIXO_DO_ARTEFATO = 'material-do-certificado-';

/** O arquivo que o CT-1016 planta para provar que o listador enxerga o que existe. */
const SENTINELA_DO_LISTADOR = `${PREFIXO_DO_ARTEFATO}sentinela-do-caso.pem`;

/** Quanto se espera pelo aparecimento do artefato antes de reprovar — sondagem, nunca `sleep` fixo. */
const LIMITE_DA_SONDAGEM_MS = 30_000;

/** A permissão exata que o artefato tem de ter — **valor exato**, e não "o grupo não lê". */
const PERMISSAO_EXIGIDA = 0o600;

/** A máscara de bits de permissão que se compara. */
const BITS_DE_PERMISSAO = 0o777;

/**
 * O que o **executável** de criptografia diz com a senha errada — **medido neste host** em
 * 2026-08-21, e escrito por extenso.
 */
const TEXTO_MEDIDO_DO_EXECUTAVEL = 'Mac verify error: invalid password?';

/**
 * O que a **biblioteca** diz — o sinal privado de `leitura-do-material.ts`, copiado como literal.
 *
 * ⚠️ **Ele é copiado, e não importado, de propósito**: é o valor que o módulo da conversão **não pode
 * usar**, e importá-lo daria ao caso o mesmo símbolo que o SUT usaria no defeito — a asserção
 * passaria a comparar o teste consigo mesmo. Ele é privado daquele módulo e assim permanece.
 */
const SINAL_DA_BIBLIOTECA = 'mac verify failure';

/** O titular do material de teste, na forma que o produto publica. */
const TITULAR_DO_MATERIAL = 'C=BR, O=Imobiliaria de Teste Sysloc, CN=00000000000191';

/** A impressão digital tal como o runtime a formata: 32 pares hexadecimais separados por `:`. */
const FORMA_DA_IMPRESSAO_DIGITAL = /^(?:[0-9A-F]{2}:){31}[0-9A-F]{2}$/;

/** As propriedades próprias que uma recusa deste domínio carrega — e nenhuma a mais. */
const PROPRIEDADES_DA_RECUSA = ['message', 'motivo', 'name', 'stack'] as const;

/** Bytes que não são PKCS#12 — o eixo do formato. */
const BYTES_QUE_NAO_SAO_MATERIAL = 200;

/**
 * A variável de ambiente com que o CT-1050 envenena o processo do arcabouço.
 *
 * Escolhida porque o efeito dela é **determinístico e verificável neste host**: apontada para uma
 * pasta sem providers, ela derruba o `-legacy`, que é exatamente o que a conversão depende de
 * carregar. Não é a única que o conversor lê — `OPENSSL_CONF` e, no carregador dinâmico,
 * `LD_PRELOAD`/`LD_LIBRARY_PATH` também alcançariam o filho —, e é por isso que a guarda do SUT é
 * `env: {}` e não uma lista de variáveis barradas: o caso mede **uma** herança para provar que
 * **nenhuma** acontece.
 */
const VARIAVEL_HOSTIL_DO_CONVERSOR = 'OPENSSL_MODULES';

/** O par gerado, com as duas embalagens já separadas. */
interface ParNasDuasEmbalagens {
  readonly gerado: MaterialDeTeste;
  readonly moderno: Buffer;
  readonly legado: Buffer;
}

/**
 * Gera **um** par e o entrega nas duas embalagens.
 *
 * A guarda de ausência não é decorativa: se o acessório deixasse de produzir a embalagem legada,
 * todos os casos abaixo exercitariam material moderno e aprovariam um conversor que não converte.
 */
async function parNasDuasEmbalagens(nome: string): Promise<ParNasDuasEmbalagens> {
  const autoridade = await gerarAutoridadeDeTeste(nome);
  const gerado = await gerarMaterialDeTeste({
    autoridade,
    senha: SENHA_DO_COFRE,
    comEmbalagemLegada: true,
  });
  const legado = gerado.materialEmEmbalagemLegada;

  if (legado === undefined) {
    throw new Error(
      'o acessório de material não produziu a embalagem legada — sem ela, esta suíte exercitaria ' +
        'material moderno dos dois lados e aprovaria um conversor que não converte nada',
    );
  }

  return { gerado, moderno: gerado.material, legado };
}

/** Executa e devolve a exceção — falhando quando a chamada resolve onde se esperava recusa. */
async function capturarRecusa(trabalho: () => Promise<unknown>): Promise<unknown> {
  try {
    await trabalho();
  } catch (falha) {
    return falha;
  }

  throw new Error('a preparação do material resolveu onde o caso exige recusa');
}

/** As entradas de `/dev/shm` que carregam o prefixo do artefato — ordenadas, para a comparação. */
async function entradasDoPrefixo(): Promise<string[]> {
  const entradas = await readdir(DIRETORIO_EM_MEMORIA);

  return entradas.filter((nome) => nome.startsWith(PREFIXO_DO_ARTEFATO)).sort();
}

/** O motivo interno de uma recusa, ou um literal que **não** é motivo de classe alguma. */
function motivoDe(falha: unknown): string {
  return falha instanceof ErroDeSenhaQueNaoAbre || falha instanceof ErroDeFormatoDoMaterial
    ? falha.motivo
    : '(outro erro)';
}

/**
 * As agulhas de um material, mais os **textos medidos da saída do conversor**.
 *
 * A saída do conversor entra como agulha porque ela é a superfície nova desta task: se um dia ela
 * virar causa, propriedade ou texto de mensagem, a varredura a nomeia.
 */
function agulhasDoAto(material: Buffer, senhas: readonly string[]): Agulha[] {
  return [
    ...agulhasDe(material, senhas),
    { rotulo: 'saida-do-conversor', valor: TEXTO_MEDIDO_DO_EXECUTAVEL },
    { rotulo: 'radical-do-conversor', valor: RADICAL_DE_SENHA_DO_CONVERSOR },
  ];
}

/** Escreve a senha num arquivo restrito e devolve o caminho — nunca `argv`, como o acessório faz. */
async function pastaComSenha(senha: string): Promise<{ pasta: string; caminhoDaSenha: string }> {
  const pasta = await mkdtemp(join(tmpdir(), 'sysloc-conversao-'));
  onTestFinished(() => rm(pasta, { recursive: true, force: true }));

  const caminhoDaSenha = join(pasta, 'senha');
  await writeFile(caminhoDaSenha, senha, { encoding: 'utf8', mode: 0o600 });

  return { pasta, caminhoDaSenha };
}

/** A saída de erro **real** de uma decodificação que falha — o insumo do CT-1048. */
async function saidaDeErroDaDecodificacao(
  caminhoDoMaterial: string,
  caminhoDaSenha: string,
): Promise<string> {
  try {
    await executar(CONVERSOR, [
      'pkcs12',
      '-legacy',
      '-nodes',
      '-in',
      caminhoDoMaterial,
      '-passin',
      `file:${caminhoDaSenha}`,
    ]);
  } catch (falha) {
    const saida = (falha as { stderr?: string }).stderr;

    if (typeof saida !== 'string' || saida === '') {
      throw new Error('o conversor falhou sem escrever nada na saída de erro — nada a medir');
    }

    return saida;
  }

  throw new Error('o conversor resolveu onde o caso exige a saída de erro dele');
}

describe('conversão do material do certificado por processo externo (T1)', () => {
  it('CT-1014 — a conversão preserva a identidade do certificado recebido', {
    timeout: LIMITE_DO_CASO_MS,
  }, async () => {
    const { gerado, moderno, legado } = await parNasDuasEmbalagens('Sysloc Conversao A');
    const segredoLegado = criarSegredoOperavel({ material: legado, senha: SENHA_DO_COFRE });

    // ÂNCORA ANTIVÁCUO DO ARRANJO, e ela é o que dá conteúdo ao caso: o runtime NÃO abre a
    // embalagem legada. Sem esta linha, duas embalagens modernas fariam o caso aprovar um
    // conversor que devolve o recebido sem converter nada.
    await expect(lerMaterial(segredoLegado)).rejects.toBeInstanceOf(ErroDeMaterialIlegivel);

    // Âncora antivácuo do oráculo: os fatos conhecidos vieram do `openssl` do acessório, por
    // caminho independente do SUT, e têm conteúdo.
    expect(gerado.titular).toBe(TITULAR_DO_MATERIAL);
    expect(gerado.impressaoDigital).toMatch(FORMA_DA_IMPRESSAO_DIGITAL);
    expect(gerado.validoAte.getTime()).toBeGreaterThan(gerado.validoDe.getTime());
    expect(legado).not.toEqual(moderno);

    const referencia = await lerMaterial(
      criarSegredoOperavel({ material: moderno, senha: SENHA_DO_COFRE }),
    );
    const preparado = await converterMaterialSeNecessario(segredoLegado);
    const lido = await lerMaterial(
      criarSegredoOperavel({ material: preparado.material, senha: SENHA_DO_COFRE }),
    );

    // A tripla inteira por IGUALDADE PROFUNDA contra o mesmo certificado em cifra moderna — os
    // quatro campos de `MaterialLido`, jamais presença de campo.
    expect(lido).toEqual(referencia);

    // ⚠️ A ASSERÇÃO DISCRIMINANTE: um conversor que gerasse par novo passaria em toda asserção de
    // forma e reprovaria exatamente aqui. A impressão digital vem do `openssl x509 -fingerprint
    // -sha256` do acessório, e não do caminho TLS que o SUT usa.
    expect(lido.impressaoDigital).toBe(gerado.impressaoDigital);
    expect(lido.titular).toBe(TITULAR_DO_MATERIAL);
    expect(lido.validoDe).toEqual(gerado.validoDe);
    expect(lido.validoAte).toEqual(gerado.validoAte);

    expect(preparado.convertido).toBe(true);
  });

  it('CT-1015 — senha e formato produzem motivos distintos, e nada da saída do conversor atravessa', {
    timeout: LIMITE_DO_CASO_MS,
  }, async () => {
    const { legado } = await parNasDuasEmbalagens('Sysloc Conversao B');
    const bytesQueNaoSaoMaterial = randomBytes(BYTES_QUE_NAO_SAO_MATERIAL);

    const falhaDaSenha = await capturarRecusa(() =>
      converterMaterialSeNecessario(
        criarSegredoOperavel({ material: legado, senha: SENHA_SENTINELA_ERRADA }),
      ),
    );

    // A classe e a NÃO-classe da irmã. As duas asserções não são redundantes: a segunda pega a
    // implementação que faz uma classe herdar da outra.
    expect(falhaDaSenha).toBeInstanceOf(ErroDeSenhaQueNaoAbre);
    expect(falhaDaSenha).not.toBeInstanceOf(ErroDeFormatoDoMaterial);
    expect(motivoDe(falhaDaSenha)).toBe('SENHA_NAO_ABRE');

    const falhaDoFormato = await capturarRecusa(() =>
      converterMaterialSeNecessario(
        criarSegredoOperavel({ material: bytesQueNaoSaoMaterial, senha: SENHA_DO_COFRE }),
      ),
    );

    expect(falhaDoFormato).toBeInstanceOf(ErroDeFormatoDoMaterial);
    expect(falhaDoFormato).not.toBeInstanceOf(ErroDeSenhaQueNaoAbre);
    // O literal fixa o VALOR (constante importada compararia o SUT consigo mesmo); a linha
    // seguinte fixa que é este o valor que o módulo PUBLICA, e não um segundo motivo interno.
    expect(motivoDe(falhaDoFormato)).toBe('FORMATO_NAO_SUPORTADO');
    expect(MOTIVO_DO_FORMATO_NAO_SUPORTADO).toBe('FORMATO_NAO_SUPORTADO');

    // A distinção é afirmada comparando os motivos NA ORIGEM, e nunca por
    // `expect(motivo).not.toBe('<o outro literal>')` — a razão está por extenso na
    // `DECISÃO FECHADA — T9 / Gate 1 · 2026-08-15` de `leitura-do-material.spec.ts`: aquela forma
    // é IMPLICADA pela igualdade literal acima e fica verde com os dois motivos unificados no SUT.
    expect(new ErroDeSenhaQueNaoAbre().motivo).not.toBe(new ErroDeFormatoDoMaterial().motivo);

    const agulhasDaSenha = agulhasDoAto(legado, [SENHA_SENTINELA_ERRADA, SENHA_DO_COFRE]);
    const agulhasDoFormato = agulhasDoAto(bytesQueNaoSaoMaterial, [SENHA_DO_COFRE]);

    // CONTROLE POSITIVO (AP-29), antes de qualquer asserção de ausência: a MESMA varredura, sobre
    // um objeto que contém as agulhas em superfícies diferentes, devolve todas elas.
    expect(ocorrenciasDeAgulhas(controleComAsAgulhas(agulhasDaSenha), agulhasDaSenha)).toEqual(
      agulhasDaSenha.map((agulha) => agulha.rotulo),
    );
    expect(ocorrenciasDeAgulhas(controleComAsAgulhas(agulhasDoFormato), agulhasDoFormato)).toEqual(
      agulhasDoFormato.map((agulha) => agulha.rotulo),
    );

    // Medido sobre a SAÍDA REAL das duas recusas, e nunca por leitura do fonte (ADR-0032).
    expect(ocorrenciasDeAgulhas(falhaDaSenha, agulhasDaSenha)).toEqual([]);
    expect(ocorrenciasDeAgulhas(falhaDoFormato, agulhasDoFormato)).toEqual([]);
  });

  it('CT-1016 — o único artefato em claro é removido em todo desfecho', {
    timeout: LIMITE_DO_CASO_MS,
  }, async () => {
    const { legado } = await parNasDuasEmbalagens('Sysloc Conversao C');
    const sentinela = join(DIRETORIO_EM_MEMORIA, SENTINELA_DO_LISTADOR);

    await writeFile(sentinela, 'sentinela do listador', { encoding: 'utf8', mode: 0o600 });
    onTestFinished(() => rm(sentinela, { force: true }));

    // CONTROLE POSITIVO DO LISTADOR, antes de qualquer chamada ao SUT: a ausência dos outros só
    // significa alguma coisa depois que a varredura prova enxergar arquivos daquela forma.
    expect(await entradasDoPrefixo()).toEqual([SENTINELA_DO_LISTADOR]);

    // Desfecho 1 — SUCESSO. Ele é a não-vacuidade do caso: a reexportação exige entrada *seekable*
    // de arquivo (medição M7), de modo que NÃO existe caminho de conversão bem-sucedida sem que o
    // intermediário tenha existido. O sucesso prova a criação; a listagem prova a remoção.
    const preparado = await converterMaterialSeNecessario(
      criarSegredoOperavel({ material: legado, senha: SENHA_DO_COFRE }),
    );
    expect(preparado.convertido).toBe(true);
    expect(diferencasDeConjunto(await entradasDoPrefixo(), [SENTINELA_DO_LISTADOR])).toEqual({
      excedentes: [],
      ausentes: [],
    });

    // Desfecho 2 — erro de SENHA, que é o `finally` exercido no caminho da decodificação.
    const falhaDaSenha = await capturarRecusa(() =>
      converterMaterialSeNecessario(
        criarSegredoOperavel({ material: legado, senha: SENHA_SENTINELA_ERRADA }),
      ),
    );
    expect(falhaDaSenha).toBeInstanceOf(ErroDeSenhaQueNaoAbre);
    expect(diferencasDeConjunto(await entradasDoPrefixo(), [SENTINELA_DO_LISTADOR])).toEqual({
      excedentes: [],
      ausentes: [],
    });

    // Desfecho 3 — erro de FORMATO.
    const falhaDoFormato = await capturarRecusa(() =>
      converterMaterialSeNecessario(
        criarSegredoOperavel({
          material: randomBytes(BYTES_QUE_NAO_SAO_MATERIAL),
          senha: SENHA_DO_COFRE,
        }),
      ),
    );
    expect(falhaDoFormato).toBeInstanceOf(ErroDeFormatoDoMaterial);
    // `excedentes` não-vazio NOMEIA o artefato deixado para trás; `ausentes` não-vazio acusa que o
    // próprio listador parou de funcionar.
    expect(diferencasDeConjunto(await entradasDoPrefixo(), [SENTINELA_DO_LISTADOR])).toEqual({
      excedentes: [],
      ausentes: [],
    });
  });

  it('CT-1017 — o artefato nasce restrito mesmo com a máscara do processo aberta', {
    timeout: LIMITE_DO_CASO_MS,
  }, async () => {
    const { legado } = await parNasDuasEmbalagens('Sysloc Conversao D');

    // A máscara aberta é o INPUT ADVERSO: com um `umask` restritivo herdado do host, um artefato
    // criado sem cuidado nasceria `0600` por acidente e a asserção passaria por motivo errado. O
    // valor de restauração vem da PRÓPRIA chamada, nunca de um literal.
    const mascaraAnterior = process.umask(0o000);
    onTestFinished(() => {
      process.umask(mascaraAnterior);
    });

    const jaExistentes = new Set(await entradasDoPrefixo());

    // A conversão é iniciada SEM ser aguardada: a janela de observação é a duração do processo
    // externo, e o artefato existe do início dela até o `finally` do módulo.
    const promessa = converterMaterialSeNecessario(
      criarSegredoOperavel({ material: legado, senha: SENHA_DO_COFRE }),
    );
    let terminou = false;
    void promessa.then(
      () => {
        terminou = true;
      },
      () => {
        terminou = true;
      },
    );

    let modoObservado: number | undefined;
    const prazo = Date.now() + LIMITE_DA_SONDAGEM_MS;

    while (modoObservado === undefined && !terminou && Date.now() < prazo) {
      for (const nome of await entradasDoPrefixo()) {
        if (jaExistentes.has(nome)) {
          continue;
        }
        try {
          modoObservado = (await stat(join(DIRETORIO_EM_MEMORIA, nome))).mode;
        } catch {
          // Removido entre a listagem e a leitura: a sondagem continua.
        }
        break;
      }
      await new Promise((resolver) => setImmediate(resolver));
    }

    // A conversão precisa ter RESOLVIDO — sem isto, a não-observação e a falha do SUT ficariam
    // indistinguíveis, e o caso passaria por vacuidade.
    const preparado = await promessa;
    expect(preparado.convertido).toBe(true);
    expect(preparado.material).toBeInstanceOf(Buffer);

    expect(
      modoObservado,
      `nenhuma entrada nova com o prefixo '${PREFIXO_DO_ARTEFATO}' apareceu em ` +
        `${DIRETORIO_EM_MEMORIA} enquanto a conversão corria`,
    ).toBeDefined();

    // VALOR EXATO, e não apenas `& 0o007 === 0`: com a máscara aberta, a asserção fraca aprovaria
    // `0o660`, que já entrega a chave privada em claro ao grupo.
    expect((modoObservado ?? 0) & BITS_DE_PERMISSAO).toBe(PERMISSAO_EXIGIDA);
  });

  it('CT-1018 — a conversão só corre quando o runtime não abre, e o desfecho declara qual caminho correu', {
    timeout: LIMITE_DO_CASO_MS,
  }, async () => {
    const { moderno, legado } = await parNasDuasEmbalagens('Sysloc Conversao E');

    const antesDoModerno = await entradasDoPrefixo();
    const desfechoModerno = await converterMaterialSeNecessario(
      criarSegredoOperavel({ material: moderno, senha: SENHA_DO_COFRE }),
    );

    // ⚠️ A ASSERÇÃO DE MAIOR VALOR DO CASO: `convertido === false` SOZINHO seria satisfeito por uma
    // implementação que converte sempre e depois declara que não converteu. A igualdade byte a
    // byte com o recebido é a única que a reprova.
    expect(desfechoModerno.convertido).toBe(false);
    expect(desfechoModerno.material).toEqual(moderno);

    // E nenhum artefato chegou a nascer — o que só é verdade se nenhum processo externo correu: o
    // artefato precede as duas invocações do binário.
    expect(await entradasDoPrefixo()).toEqual(antesDoModerno);

    const desfechoLegado = await converterMaterialSeNecessario(
      criarSegredoOperavel({ material: legado, senha: SENHA_DO_COFRE }),
    );

    expect(desfechoLegado.convertido).toBe(true);
    expect(desfechoLegado.material).not.toEqual(legado);
    await expect(
      lerMaterial(
        criarSegredoOperavel({ material: desfechoLegado.material, senha: SENHA_DO_COFRE }),
      ),
    ).resolves.toBeDefined();

    // O booleano fechado nos DOIS sentidos, por igualdade — nunca `toBeTruthy`.
    expect([...new Set([desfechoModerno.convertido, desfechoLegado.convertido])].sort()).toEqual([
      false,
      true,
    ]);
  });

  it('CT-1019 — a superfície do processo externo não carrega material nem senha, inclusive spawnargs', {
    timeout: LIMITE_DO_CASO_MS,
  }, async () => {
    const { legado } = await parNasDuasEmbalagens('Sysloc Conversao F');
    const bytesQueNaoSaoMaterial = randomBytes(BYTES_QUE_NAO_SAO_MATERIAL);
    const agulhas = agulhasDoAto(legado, [SENHA_DO_COFRE, SENHA_SENTINELA_ERRADA]);
    const { caminhoDaSenha } = await pastaComSenha(SENHA_DO_COFRE);

    // CONTROLE POSITIVO 1, e ele é o coração do caso: o próprio teste invoca o binário do conversor
    // COM A SENHA EM `argv`, deixa a chamada falhar, e captura a rejeição CRUA do runtime.
    const rejeicaoPorArgv = await capturarRecusa(() =>
      executar(CONVERSOR, [
        'pkcs12',
        '-legacy',
        '-nodes',
        '-in',
        caminhoDaSenha,
        '-passin',
        `pass:${SENHA_DO_COFRE}`,
      ]),
    );
    expect(ocorrenciasDeAgulhas(rejeicaoPorArgv, agulhas)).toContain('senha[0]');

    // CONTROLE POSITIVO 2 — a rejeição crua que carrega `spawnargs`, que é a superfície específica
    // que o módulo tem de não expor. O runtime só a anexa quando o processo nem chega a nascer.
    const rejeicaoDoSpawn = await capturarRecusa(() =>
      executar(CONVERSOR_INEXISTENTE, ['pkcs12', '-passin', `pass:${SENHA_DO_COFRE}`]),
    );
    expect('spawnargs' in (rejeicaoDoSpawn as object)).toBe(true);
    expect(ocorrenciasDeAgulhas(rejeicaoDoSpawn, agulhas)).toContain('senha[0]');

    // E o achado vem DE `spawnargs`: a mesma varredura, sobre um objeto que carrega **apenas** o
    // valor real de `spawnargs` daquela rejeição, continua achando a senha. É o que separa "a
    // varredura enxerga objetos" de "a varredura enxerga ESTA superfície".
    const soComSpawnargs = Object.assign(new Error('recusa crua reduzida ao argv'), {
      spawnargs: (rejeicaoDoSpawn as { spawnargs: readonly string[] }).spawnargs,
    });
    expect(ocorrenciasDeAgulhas(soComSpawnargs, agulhas)).toContain('senha[0]');

    const falhaDaSenha = await capturarRecusa(() =>
      converterMaterialSeNecessario(
        criarSegredoOperavel({ material: legado, senha: SENHA_SENTINELA_ERRADA }),
      ),
    );
    const falhaDoFormato = await capturarRecusa(() =>
      converterMaterialSeNecessario(
        criarSegredoOperavel({ material: bytesQueNaoSaoMaterial, senha: SENHA_DO_COFRE }),
      ),
    );

    for (const falha of [falhaDaSenha, falhaDoFormato]) {
      // Medido sobre a saída REAL do módulo, com as MESMAS agulhas do controle.
      expect(ocorrenciasDeAgulhas(falha, agulhas)).toEqual([]);

      // Ausência ESTRUTURAL: nada de `child_process` alcançável a partir da recusa, e nenhuma
      // causa — no molde de `ErroDeSenhaQueNaoAbre`, que já descarta a causa por decisão.
      expect('spawnargs' in (falha as object)).toBe(false);
      expect((falha as { cause?: unknown }).cause).toBeUndefined();

      // A saída do conversor não vira propriedade: o conjunto de propriedades próprias da recusa é
      // afirmado por IGUALDADE, de modo que um campo novo — `saida`, `detalhe`, `codigo` —
      // reprovaria nomeando-se.
      expect(Object.getOwnPropertyNames(falha).sort()).toEqual([...PROPRIEDADES_DA_RECUSA]);
    }
  });

  it('CT-1048 — o radical do conversor é o do executável, e o da biblioteca jamais casaria', {
    timeout: LIMITE_DO_CASO_MS,
  }, async () => {
    const { legado } = await parNasDuasEmbalagens('Sysloc Conversao G');
    const { pasta, caminhoDaSenha } = await pastaComSenha(SENHA_SENTINELA_ERRADA);
    const caminhoDoLegado = join(pasta, 'material-legado.pfx');
    const caminhoDoLixo = join(pasta, 'nao-e-material.bin');

    await writeFile(caminhoDoLegado, legado, { mode: 0o600 });
    await writeFile(caminhoDoLixo, randomBytes(BYTES_QUE_NAO_SAO_MATERIAL), { mode: 0o600 });

    // A saída REAL do executável nos dois eixos — medida agora, neste host, e não copiada de um
    // registro que envelhece.
    const saidaDaSenha = (
      await saidaDeErroDaDecodificacao(caminhoDoLegado, caminhoDaSenha)
    ).toLowerCase();
    const saidaDoFormato = (
      await saidaDeErroDaDecodificacao(caminhoDoLixo, caminhoDaSenha)
    ).toLowerCase();

    // O radical publicado é o literal medido, e não um valor que o caso leia do SUT para si mesmo.
    expect(RADICAL_DE_SENHA_DO_CONVERSOR).toBe('mac verify');

    // (a) Ele CASA a saída do executável — é o que faz o ramo da senha disparar.
    expect(saidaDaSenha).toContain(RADICAL_DE_SENHA_DO_CONVERSOR);

    // (b) ⚠️ A ASSERÇÃO QUE DISCRIMINA O DEFEITO: o sinal da BIBLIOTECA — o que
    // `leitura-do-material.ts` escuta — **não** aparece na saída do executável. Importar aquela
    // constante para o conversor faria o ramo da senha NUNCA disparar, e todo desfecho de senha
    // errada degradaria em silêncio para "formato", que é o `D64` invertido.
    expect(saidaDaSenha).not.toContain(SINAL_DA_BIBLIOTECA);
    expect(TEXTO_MEDIDO_DO_EXECUTAVEL.toLowerCase()).not.toContain(SINAL_DA_BIBLIOTECA);

    // (c) E ele é o denominador COMUM: casa também a redação da biblioteca, de modo que a
    // degradação declarada continua valendo nas duas pontas.
    expect(SINAL_DA_BIBLIOTECA).toContain(RADICAL_DE_SENHA_DO_CONVERSOR);
    expect(TEXTO_MEDIDO_DO_EXECUTAVEL.toLowerCase()).toContain(RADICAL_DE_SENHA_DO_CONVERSOR);

    // NEGATIVO — a outra ponta da discriminação (medição M11): material que não é PKCS#12 produz
    // erro de codificação ASN.1 e **não** casa o radical. Sem esta linha, um radical que casasse
    // tudo passaria em (a) e as duas causas se fundiriam.
    expect(saidaDoFormato).not.toContain(RADICAL_DE_SENHA_DO_CONVERSOR);
    expect(saidaDoFormato).not.toBe('');
  });

  it('CT-1050 — o ambiente do processo da API não alcança o conversor', {
    timeout: LIMITE_DO_CASO_MS,
  }, async () => {
    // O material nasce ANTES de o ambiente ser envenenado: o acessório também invoca o conversor
    // para emitir a embalagem legada, e envenenar antes mediria o acessório, não o SUT.
    const { gerado, moderno, legado } = await parNasDuasEmbalagens('Sysloc Conversao H');
    const segredoLegado = criarSegredoOperavel({ material: legado, senha: SENHA_DO_COFRE });
    const referencia = await lerMaterial(
      criarSegredoOperavel({ material: moderno, senha: SENHA_DO_COFRE }),
    );

    // Âncora antivácuo do arranjo, a mesma do CT-1014: sem ela, duas embalagens modernas fariam o
    // caso aprovar um conversor que devolve o recebido sem converter nada.
    await expect(lerMaterial(segredoLegado)).rejects.toBeInstanceOf(ErroDeMaterialIlegivel);

    // A pasta vazia é o que torna a variável HOSTIL: ela reaponta a busca de providers para um
    // lugar onde o `legacy` não está, e é o `legacy` que a conversão inteira depende de carregar.
    const pastaSemProviders = await mkdtemp(join(tmpdir(), 'sysloc-sem-providers-'));
    onTestFinished(async () => {
      await rm(pastaSemProviders, { recursive: true, force: true });
    });

    const anterior = process.env[VARIAVEL_HOSTIL_DO_CONVERSOR];

    try {
      // O ambiente DESTE processo — o do arcabouço, que no produto é o da API — passa a carregar a
      // variável. Restaurada no `finally`; o pool `forks` do arcabouço já isola por arquivo, e o
      // `finally` fecha a janela para os casos seguintes deste mesmo arquivo.
      process.env[VARIAVEL_HOSTIL_DO_CONVERSOR] = pastaSemProviders;

      // ⚠️ CONTROLE POSITIVO — sem ele o caso não vale nada: ele prova que a variável plantada É
      // capaz de derrubar este conversor, neste host, agora. Um subprocesso que HERDE o ambiente
      // falha aqui em `unable to load provider legacy`. Se algum dia esta linha passar a resolver,
      // a variável deixou de ser hostil e o caso vira vácuo — é o que esta asserção impede.
      await expect(
        executar(
          CONVERSOR,
          ['pkcs12', '-legacy', '-nodes', '-in', '/dev/null', '-passin', 'pass:x'],
          {
            env: { ...process.env },
          },
        ),
      ).rejects.toMatchObject({
        stderr: expect.stringContaining('unable to load provider legacy'),
      });

      // ⚠️ A ASSERÇÃO QUE DISCRIMINA O DEFEITO: com o `spawn` herdando o ambiente — como era antes
      // desta correção — a conversão morre em `ErroDeFormatoDoMaterial`, porque o filho recebe a
      // variável de cima. Ela só resolve porque o `env` explícito do SUT barra a herança.
      const preparado = await converterMaterialSeNecessario(segredoLegado);
      const lido = await lerMaterial(
        criarSegredoOperavel({ material: preparado.material, senha: SENHA_DO_COFRE }),
      );

      expect(preparado.convertido).toBe(true);

      // E o desfecho é o do CT-1014, não apenas "não lançou": a identidade atravessa intacta com o
      // ambiente hostil de pé. A impressão digital vem do acessório, por caminho independente do SUT.
      expect(lido).toEqual(referencia);
      expect(lido.impressaoDigital).toBe(gerado.impressaoDigital);
    } finally {
      if (anterior === undefined) {
        delete process.env[VARIAVEL_HOSTIL_DO_CONVERSOR];
      } else {
        process.env[VARIAVEL_HOSTIL_DO_CONVERSOR] = anterior;
      }
    }

    // O ambiente do arcabouço voltou ao que era — a limpeza é asserida, e não presumida.
    expect(process.env[VARIAVEL_HOSTIL_DO_CONVERSOR]).toBe(anterior);
  });
});
