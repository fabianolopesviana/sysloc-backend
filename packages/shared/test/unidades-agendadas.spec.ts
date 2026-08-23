/**
 * As unidades `systemd` das rotinas agendadas — asserção **estática** sobre `deploy/systemd/` e
 * sobre o fonte de `deploy/scripts/instalacao/instalar-unidades.sh`.
 *
 * Rastreabilidade: CA-01 · CA-03 · CA-04 · CA-10 · CA-23 → CT-1057 a CT-1060 (US-04, US-08, US-10).
 *
 * INVARIANTES
 * - CT-1057: cada um dos seis `deploy/systemd/sysloc-rotina-*.timer` tem **exatamente uma** linha
 *   `OnCalendar=` em posição executável, terminada em `America/Sao_Paulo`, e o horário nela
 *   declarado é o **mesmo** que `CADENCIA_DA_ROTINA` de `@sysloc/contracts` declara para aquela
 *   unidade. A cobertura é de conjunto **nos dois sentidos**: seis unidades, seis entradas no mapa.
 * - CT-1058: o conjunto de `.timer` que declaram `Persistent=true` é **exatamente** o conjunto dos
 *   timers cuja cadência publicada é `DIARIA`; os de intervalo não declaram `Persistent=` em
 *   posição executável.
 * - CT-1059: cada um dos seis `sysloc-rotina-*.service` declara `Type=oneshot`,
 *   `OnFailure=sysloc-alerta-de-rotina@%n.service` e **nenhuma** diretiva `Restart=`; o último campo
 *   do `ExecStart=` de cada um é **exatamente** o nome que o despachante aceita para aquela rotina,
 *   derivado de `CADENCIA_DA_ROTINA`; e `sysloc-alerta-de-rotina@.service` interpola `%i` no
 *   `ExecStart=`.
 * - CT-1060: o array `UNIDADES` do instalador é **igual, como conjunto**, ao diretório versionado;
 *   `UNIDADES_DO_ARRANQUE` **não** contém despacho `oneshot` nem unidade-modelo e **contém todos**
 *   os seis relógios; todo `.timer` declara `WantedBy=timers.target`; nenhuma unidade carrega
 *   credencial em posição executável; e o rótulo de passo do instalador **avança** de uma chamada
 *   para a seguinte — esta última afirmada por **execução** do fragmento sob `bash`, e não por
 *   inspeção do texto.
 *
 * Fronteira real exercida: `filesystem` — e, no passo 4 do CT-1060, **`bash` de verdade**, num
 * subprocesso. Nenhum dublê: os arquivos lidos são os versionados, o fragmento executado é
 * **extraído do instalador real**, e as cópias defeituosas das provas de falsificação vivem em
 * diretório temporário próprio, descartado no `finally` de cada caso.
 *
 * ===========================================================================
 * Por que ESTÁTICA, e por que aqui
 * ===========================================================================
 *
 * O invariante é sobre o **texto versionado** — o que o supervisor vai ler no boot —, e não sobre
 * comportamento observável por chamada. Exercitá-lo de verdade exigiria `systemctl` com privilégio
 * administrativo, e este host pede senha interativa: a prova viraria um passo de rollout, fora da
 * suíte. É a decisão **A1** da §16.1 do tech spec, e ela também é o motivo de **nenhum
 * `verificar-*.sh` novo** ter nascido nesta task — escrever a 11ª cópia do esqueleto agravaria o
 * `D9 · F0/T2` e trocaria uma prova que roda na suíte por uma que exige `sudo`.
 *
 * Ela mora em `packages/shared/test/` porque este pacote é a **raiz do grafo de importe**: ele não
 * depende de pacote nenhum do produto, de modo que uma suíte sobre artefato de `deploy/` não
 * arrasta banco, fila nem contrato de negócio para dentro dela. `@sysloc/contracts` entra em
 * **`devDependencies`**, e a distinção é conteúdo: o `src/` deste pacote continua sem dependência
 * de execução alguma — é o que o docblock de `../src/fila.ts` declara, e vale para o fonte, não
 * para a suíte.
 *
 * ⚠️ **Nenhuma suíte do repositório lia `deploy/systemd/` como conteúdo antes desta.** O
 * `CT-512 (b)` de `packages/db/test/cobranca.spec.ts` lê o diretório, mas só os **nomes** dos
 * arquivos — ele afirma quais unidades existem, e é a âncora que cresceu no mesmo diff que publicou
 * os seis relógios. As duas se complementam sem se sobrepor: lá o conjunto, aqui o conteúdo.
 *
 * ===========================================================================
 * O horário tem UMA fonte, e esta suíte é a amarra
 * ===========================================================================
 *
 * `CADENCIA_DA_ROTINA` é a declaração única do relógio do produto. Mudar o horário na unidade sem
 * mudar no contrato — ou o contrário — **reprova o CT-1057**, e isso é deliberado: sem a amarra, o
 * mesmo fato passa a ter duas declarações livres para andar separadas, e a divergência só apareceria
 * como "a rotina correu na hora errada" meses depois.
 *
 * A tradução entre os dois vocabulários é {@link EXPRESSAO_DE_TEMPO_POR_CADENCIA}, e ela é escrita
 * **por extenso** de propósito: derivá-la do próprio `OnCalendar=` faria o caso concordar com
 * qualquer expressão que a unidade viesse a declarar, que é a asserção tautológica (AP-29). Cadência
 * nova sem tradução aqui reprova em vez de passar em silêncio.
 *
 * ===========================================================================
 * O que a §6.1 desta task diz, e o que o contrato conciliado diz
 * ===========================================================================
 *
 * A tabela do CT-1058 escreve *"`com_persistent` = 5 diárias"*. O mapa **conciliado no challenge de
 * 2026-08-22** tem **três** diárias (`ENCERRAMENTO_DE_CONTRATOS`, `CONFERENCIA_DE_LIQUIDACAO`,
 * `MANUTENCAO`) e três de intervalo — o número da task é anterior à conciliação. Esta suíte **deriva
 * do mapa** e afirma as duas contagens por igualdade, de modo que ela acompanha o contrato e não um
 * número narrativo. Não "corrija" para cinco: o `satisfies` do contrato e o CT-1090 são as fontes.
 *
 * ===========================================================================
 * A prova de falsificação está DENTRO de cada caso
 * ===========================================================================
 *
 * Asserção estática que ninguém falsificou é asserção que talvez não possa falhar. Cada caso abaixo
 * copia as unidades reais para um diretório temporário, reintroduz **um** defeito por cópia e afirma
 * a lista de achados **por igualdade** — nomeando o arquivo ofensor. O **controle**, que vem antes
 * das cópias defeituosas, é a perna que impede o desfecho oposto: sem ele, um leitor quebrado — que
 * reprovasse qualquer diretório — daria todas as reprovações abaixo sem provar coisa alguma.
 */

import { execFile } from 'node:child_process';
import { copyFile, mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { CADENCIA_DA_ROTINA, type CadenciaDaRotina } from '@sysloc/contracts';
import { describe, expect, it } from 'vitest';

// ---------------------------------------------------------------------------
// Onde as coisas estão
// ---------------------------------------------------------------------------

const RAIZ_DO_REPOSITORIO = fileURLToPath(new URL('../../..', import.meta.url));

/** O diretório das unidades versionadas — a FONTE, nunca a cópia instalada em `/etc`. */
const DIRETORIO_DE_UNIDADES = join(RAIZ_DO_REPOSITORIO, 'deploy/systemd');

/** O procedimento idempotente que posiciona, ativa e habilita as unidades (ADR-0005). */
const CAMINHO_DO_INSTALADOR = join(
  RAIZ_DO_REPOSITORIO,
  'deploy/scripts/instalacao/instalar-unidades.sh',
);

// ---------------------------------------------------------------------------
// O vocabulário das unidades — escrito por extenso, porque é a DECISÃO
// ---------------------------------------------------------------------------

/**
 * O fuso que todo `OnCalendar=` declara, como o supervisor o lê.
 *
 * Sem o sufixo, o horário depende do fuso do **sistema**, e hoje ele acerta **por acidente** — a
 * máquina está em `America/Sao_Paulo`. Duas fontes de tempo para o mesmo fato é o risco de maior
 * probabilidade desta fatia; esta constante é a metade da mitigação que roda na suíte.
 */
const FUSO_DA_OPERACAO = 'America/Sao_Paulo';

const PREFIXO_DA_ROTINA = 'sysloc-rotina-';
const SUFIXO_DE_RELOGIO = '.timer';
const SUFIXO_DE_SERVICO = '.service';

/** A unidade-modelo que o `OnFailure=` de cada despacho instancia. */
const UNIDADE_DE_ALERTA = 'sysloc-alerta-de-rotina@.service';

/**
 * O `OnFailure=` literal, com o `%n` que NOMEIA quem falhou.
 *
 * `%n` é o nome da unidade que falhou; ele vira o nome da instância da unidade-modelo, e `%i` o
 * devolve lá. Sem a interpolação o journal registraria que *"uma rotina falhou"* e o operador teria
 * de descobrir qual — que é o trabalho que o alerta existe para poupar (CA-03, metade 1).
 */
const ONFAILURE_ESPERADO = 'sysloc-alerta-de-rotina@%n.service';

/** O alvo sob o qual todo relógio é habilitado — sem ele, `systemctl enable` não tem onde ligá-lo. */
const ALVO_DOS_RELOGIOS = 'timers.target';

/** A marca da instância na unidade-modelo — é ela que carrega o nome da rotina para o journal. */
const MARCA_DA_INSTANCIA = '%i';

/**
 * As duas unidades que já existiam antes desta fatia — os serviços **permanentes**.
 *
 * Elas entram aqui para que a contagem do diretório seja afirmada por **soma declarada** em vez de
 * por um número solto: quinze é treze mais duas, e cada parcela tem nome.
 */
const UNIDADES_PREEXISTENTES: readonly string[] = Object.freeze([
  'sysloc-api.service',
  'sysloc-worker.service',
]);

/**
 * As **treze** unidades que esta fatia acrescenta — seis pares mais a unidade-modelo do alerta.
 *
 * Escritas por extenso, e não derivadas do diretório: derivá-las faria o caso concordar com qualquer
 * conjunto de arquivos que viesse a existir ali, que é exatamente a asserção tautológica (AP-29). É
 * a mesma disciplina de `FORMA_DO_CODIGO` em `packages/db/test/cobranca.spec.ts`.
 */
const UNIDADES_DA_FATIA: readonly string[] = Object.freeze([
  UNIDADE_DE_ALERTA,
  'sysloc-rotina-aviso-de-cobranca.service',
  'sysloc-rotina-aviso-de-cobranca.timer',
  'sysloc-rotina-conferencia-de-liquidacao.service',
  'sysloc-rotina-conferencia-de-liquidacao.timer',
  'sysloc-rotina-encerramento-de-contratos.service',
  'sysloc-rotina-encerramento-de-contratos.timer',
  'sysloc-rotina-manutencao.service',
  'sysloc-rotina-manutencao.timer',
  'sysloc-rotina-retomada-de-noticias.service',
  'sysloc-rotina-retomada-de-noticias.timer',
  'sysloc-rotina-vigilancia-das-rotinas.service',
  'sysloc-rotina-vigilancia-das-rotinas.timer',
]);

/** Todo arquivo que `deploy/systemd/` deve conter — as duas antigas mais as treze desta fatia. */
const UNIDADES_ESPERADAS: readonly string[] = Object.freeze(
  [...UNIDADES_PREEXISTENTES, ...UNIDADES_DA_FATIA].sort(),
);

/** Quantas unidades esta fatia acrescenta — o `13` que a §5.1 da task enumera. */
const UNIDADES_ACRESCENTADAS = 13;

/** Quantos relógios existem — uma por entrada de `CADENCIA_DA_ROTINA`, e o controle antivácuo. */
const RELOGIOS = 6;

/** Quantos arquivos de serviço o CT-1059 examina — os seis despachos mais a unidade-modelo. */
const SERVICOS_EXAMINADOS = 7;

/**
 * A tradução de cada cadência do contrato para a expressão de tempo do `OnCalendar=`.
 *
 * ⚠️ Escrita **por extenso**, e é a decisão. Derivá-la do próprio arquivo de unidade faria o caso
 * concordar com qualquer horário que a unidade declarasse — a asserção passaria a provar apenas que
 * ela é igual a si mesma. Cadência nova em `CADENCIA_DA_ROTINA` sem entrada aqui **reprova**, e o
 * `CT-1057` nomeia a rotina órfã.
 *
 * A forma é a **normalizada** pelo supervisor (medido com `systemd-analyze calendar` no systemd
 * 255.4 desta máquina), de modo que a comparação é sobre o texto que ele próprio devolveria.
 */
const EXPRESSAO_DE_TEMPO_POR_CADENCIA: Readonly<Record<string, string>> = Object.freeze({
  A_CADA_MINUTO: '*:*:00',
  A_CADA_10_MIN: '*:00/10:00',
  A_CADA_15_MIN: '*:00/15:00',
});

/** O tipo de cadência que declara hora marcada — a única em que `Persistent=true` é exigido. */
const CADENCIA_DIARIA = 'DIARIA';

/**
 * As quatro agulhas de credencial (ADR-0005, condição de entrada · ADR-0032).
 *
 * ⚠️ A **ordem é conteúdo**: cada linha reporta a **primeira** agulha que casa, e `PGPASSWORD` vem
 * antes de `password` justamente porque a segunda a conteria. Sem a ordem, o controle positivo
 * devolveria cinco achados para quatro agulhas plantadas e a asserção de igualdade viraria ruído.
 *
 * A quarta é um **padrão**, e não o literal `://usuario:segredo@` que a §6.1 escreve: o literal só
 * pegaria o exemplo da própria falsificação, enquanto o padrão pega **qualquer** credencial embutida
 * numa URL — que é a forma em que ela realmente apareceria.
 */
const AGULHAS_DE_CREDENCIAL: readonly { readonly nome: string; readonly padrao: RegExp }[] =
  Object.freeze([
    Object.freeze({ nome: 'PGPASSWORD', padrao: /PGPASSWORD/ }),
    Object.freeze({ nome: 'credencial embutida em URL', padrao: /:\/\/[^\s/:@]+:[^\s/@]+@/ }),
    Object.freeze({ nome: 'password', padrao: /password/i }),
    Object.freeze({ nome: 'senha', padrao: /senha/i }),
  ]);

/** Quantas agulhas o controle positivo planta — uma por forma, cada uma em arquivo próprio. */
const AGULHAS_PLANTADAS = AGULHAS_DE_CREDENCIAL.length;

/** Teto por caso. Leitura de algumas dezenas de arquivos pequenos; folga larga sobre o medido. */
const LIMITE_DO_CASO_MS = 30_000;

// ---------------------------------------------------------------------------
// Leitura do formato `.ini` do supervisor
// ---------------------------------------------------------------------------

/**
 * As linhas em **posição executável** — sem comentário e sem vazio.
 *
 * A distinção não é cosmética: o supervisor ignora tudo o que começa por `#`, e uma asserção que
 * varresse o arquivo inteiro leria a prosa dos cabeçalhos como se fosse configuração. É o defeito
 * que a F0 mediu, em que uma busca casava `ALTER ROLE` dentro de um comentário e ficava verde sobre
 * um script sem guarda — e é também o que permite ao cabeçalho de `sysloc-api.service` explicar por
 * que *"mudar a senha do banco"* passa por outro caminho sem disparar a varredura de credencial.
 */
function linhasExecutaveis(conteudo: string): string[] {
  return conteudo
    .split('\n')
    .map((linha) => linha.trim())
    .filter((linha) => linha.length > 0 && !linha.startsWith('#'));
}

/** Os valores de uma diretiva `Chave=valor`, em posição executável, na ordem em que aparecem. */
function valoresDaDiretiva(conteudo: string, chave: string): string[] {
  const prefixo = `${chave}=`;
  return linhasExecutaveis(conteudo)
    .filter((linha) => linha.startsWith(prefixo))
    .map((linha) => linha.slice(prefixo.length).trim());
}

// ---------------------------------------------------------------------------
// A ponte entre o roster do contrato e os nomes de arquivo
// ---------------------------------------------------------------------------

/**
 * O nome de arquivo da unidade de uma rotina — derivação **mecânica** da chave do contrato.
 *
 * `AVISO_DE_COBRANCA` → `sysloc-rotina-aviso-de-cobranca`. É a mesma conversão que `emKebab` faz em
 * `apps/worker/src/despachante.ts` para compor o argumento aceito em `argv`, e derivá-la aqui é o
 * que faz *ter timer*, *ser despachável* e *ter entrada no mapa* serem o **mesmo fato**. Uma segunda
 * tabela de tradução nome-de-arquivo ⇄ rotina é exatamente o que o cabeçalho de
 * `packages/contracts/src/rotina-agendada.ts` proíbe.
 */
function nomeDaUnidade(rotina: string, sufixo: string): string {
  return `${PREFIXO_DA_ROTINA}${emKebab(rotina)}${sufixo}`;
}

/**
 * A chave do contrato como o despachante a aceita em `argv[2]`.
 *
 * ⚠️ É a **mesma** derivação de {@link nomeDaUnidade}, extraída de propósito: ela é o único termo
 * que liga o nome do arquivo da unidade ao argumento que o `ExecStart=` dela passa ao processo, e
 * enquanto os dois eram derivações separadas nada impedia o argumento de andar sozinho. O gêmeo de
 * produção é `emKebab` em `apps/worker/src/despachante.ts`, e o nome é o mesmo para que a
 * correspondência seja visível a quem lê um dos dois.
 */
function emKebab(rotina: string): string {
  return rotina.toLowerCase().replaceAll('_', '-');
}

/** As seis entradas do contrato, como pares — a fonte de tudo o que os casos abaixo esperam. */
const CADENCIAS: readonly (readonly [string, CadenciaDaRotina])[] = Object.freeze(
  Object.entries(CADENCIA_DA_ROTINA),
);

/**
 * A expressão de tempo que o `OnCalendar=` deve declarar para uma cadência.
 *
 * Devolve `undefined` quando a cadência não tem tradução — e o caso trata o `undefined` como achado
 * em vez de o ignorar, que é o que impede uma cadência nova de passar sem cobertura.
 */
function expressaoDeTempoEsperada(cadencia: CadenciaDaRotina): string | undefined {
  if (cadencia.tipo === CADENCIA_DIARIA) {
    return cadencia.hora;
  }
  return EXPRESSAO_DE_TEMPO_POR_CADENCIA[cadencia.tipo];
}

/**
 * A expressão de tempo declarada num valor de `OnCalendar=`, na forma comparável com a do contrato.
 *
 * O valor tem três campos: data, tempo e fuso. O tempo diário vem como `HH:MM:SS` e é reduzido a
 * `HH:MM`, que é a forma em que `CADENCIA_DA_ROTINA` escreve a hora — reduzir é o que permite a
 * comparação ser sobre o **mesmo fato**, e não sobre duas grafias dele.
 */
function expressaoDeTempoDeclarada(valor: string): string {
  const campos = valor.split(/\s+/);
  const tempo = campos[1] ?? '';
  const diario = /^(\d{2}:\d{2}):00$/.exec(tempo);
  return diario?.[1] ?? tempo;
}

// ---------------------------------------------------------------------------
// Os analisadores — cada um opera sobre um DIRETÓRIO, e é isso que torna a
// prova de falsificação possível: a cópia defeituosa é analisada pelo MESMO
// código que analisa a árvore versionada.
// ---------------------------------------------------------------------------

interface DivergenciaDeHorario {
  readonly unidade: string;
  readonly declaradoNaUnidade: string;
  readonly declaradoNoContrato: string | undefined;
}

interface RetratoDosRelogios {
  readonly examinados: number;
  readonly nomes: string[];
  readonly semFuso: string[];
  readonly semOnCalendarUnico: string[];
  readonly divergenciasDeHorario: DivergenciaDeHorario[];
}

async function analisarRelogios(diretorio: string): Promise<RetratoDosRelogios> {
  const nomes = (await readdir(diretorio))
    .filter((nome) => nome.startsWith(PREFIXO_DA_ROTINA) && nome.endsWith(SUFIXO_DE_RELOGIO))
    .sort();

  const semFuso: string[] = [];
  const semOnCalendarUnico: string[] = [];
  const divergenciasDeHorario: DivergenciaDeHorario[] = [];

  for (const [rotina, cadencia] of CADENCIAS) {
    const nome = nomeDaUnidade(rotina, SUFIXO_DE_RELOGIO);
    if (!nomes.includes(nome)) {
      continue;
    }

    const valores = valoresDaDiretiva(await readFile(join(diretorio, nome), 'utf8'), 'OnCalendar');
    if (valores.length !== 1) {
      semOnCalendarUnico.push(nome);
      continue;
    }

    const valor = valores[0] ?? '';
    if (!valor.endsWith(` ${FUSO_DA_OPERACAO}`)) {
      semFuso.push(nome);
    }

    const declaradoNaUnidade = expressaoDeTempoDeclarada(valor);
    const declaradoNoContrato = expressaoDeTempoEsperada(cadencia);
    if (declaradoNaUnidade !== declaradoNoContrato) {
      divergenciasDeHorario.push({ unidade: nome, declaradoNaUnidade, declaradoNoContrato });
    }
  }

  return { examinados: nomes.length, nomes, semFuso, semOnCalendarUnico, divergenciasDeHorario };
}

interface RetratoDaPersistencia {
  readonly examinados: number;
  readonly comPersistent: string[];
  readonly persistentesIndevidos: string[];
  readonly diariasSemPersistent: string[];
}

async function analisarPersistencia(diretorio: string): Promise<RetratoDaPersistencia> {
  const nomes = (await readdir(diretorio))
    .filter((nome) => nome.startsWith(PREFIXO_DA_ROTINA) && nome.endsWith(SUFIXO_DE_RELOGIO))
    .sort();

  const comPersistent: string[] = [];
  const persistentesIndevidos: string[] = [];
  const diariasSemPersistent: string[] = [];

  for (const [rotina, cadencia] of CADENCIAS) {
    const nome = nomeDaUnidade(rotina, SUFIXO_DE_RELOGIO);
    if (!nomes.includes(nome)) {
      continue;
    }

    const conteudo = await readFile(join(diretorio, nome), 'utf8');
    const declara = valoresDaDiretiva(conteudo, 'Persistent').includes('true');
    const ehDiaria = cadencia.tipo === CADENCIA_DIARIA;

    if (declara) {
      comPersistent.push(nome);
    }
    if (declara && !ehDiaria) {
      persistentesIndevidos.push(nome);
    }
    if (!declara && ehDiaria) {
      diariasSemPersistent.push(nome);
    }
  }

  return {
    examinados: nomes.length,
    comPersistent: comPersistent.sort(),
    persistentesIndevidos: persistentesIndevidos.sort(),
    diariasSemPersistent: diariasSemPersistent.sort(),
  };
}

/**
 * O argumento que o `ExecStart=` de um despacho passa, contra o que o roster aceita.
 *
 * `declaradoNoExecStart` é `undefined` quando a unidade não tem **exatamente uma** diretiva
 * `ExecStart=` em posição executável — duas linhas fariam o supervisor recusar a unidade, e
 * nenhuma a deixaria sem o que executar. As duas formas são o mesmo achado, e por isso saem na
 * mesma lista, nomeando a unidade.
 */
interface DivergenciaDeArgumento {
  readonly unidade: string;
  readonly declaradoNoExecStart: string | undefined;
  readonly aceitoPeloDespachante: string;
}

interface RetratoDosDespachos {
  readonly examinados: number;
  readonly nomes: string[];
  readonly semOnFailure: string[];
  readonly comRestart: string[];
  readonly naoOneshot: string[];
  readonly modeloQueNaoNomeiaARotina: string[];
  readonly argumentosExaminados: number;
  readonly argumentosDivergentes: DivergenciaDeArgumento[];
}

async function analisarDespachos(diretorio: string): Promise<RetratoDosDespachos> {
  const nomes = (await readdir(diretorio))
    .filter((nome) => nome.startsWith(PREFIXO_DA_ROTINA) && nome.endsWith(SUFIXO_DE_SERVICO))
    .sort();

  const semOnFailure: string[] = [];
  const comRestart: string[] = [];
  const naoOneshot: string[] = [];
  const modeloQueNaoNomeiaARotina: string[] = [];

  for (const nome of nomes) {
    const conteudo = await readFile(join(diretorio, nome), 'utf8');

    if (!valoresDaDiretiva(conteudo, 'OnFailure').includes(ONFAILURE_ESPERADO)) {
      semOnFailure.push(nome);
    }
    if (valoresDaDiretiva(conteudo, 'Restart').length > 0) {
      comRestart.push(nome);
    }
    if (!valoresDaDiretiva(conteudo, 'Type').includes('oneshot')) {
      naoOneshot.push(nome);
    }
  }

  // O ARGUMENTO do `ExecStart=`, conferido contra o roster. O laço corre sobre `CADENCIAS`, e não
  // sobre os arquivos encontrados, porque o que se afirma é a correspondência com o contrato: o
  // nome do arquivo e o argumento saem os DOIS de `emKebab`, de modo que *ter timer*, *ser
  // despachável* e *ter entrada no mapa* são o mesmo fato. Sem esta amarra, um erro de digitação
  // (`retomada-de-noticia` sem o `s`) atravessa compilador, suíte e `systemd-analyze verify`, é
  // instalado com sucesso, e só aparece no primeiro disparo em produção.
  const argumentosDivergentes: DivergenciaDeArgumento[] = [];
  let argumentosExaminados = 0;
  for (const [rotina] of CADENCIAS) {
    const nome = nomeDaUnidade(rotina, SUFIXO_DE_SERVICO);
    if (!nomes.includes(nome)) {
      continue;
    }
    argumentosExaminados += 1;

    const valores = valoresDaDiretiva(await readFile(join(diretorio, nome), 'utf8'), 'ExecStart');
    const campos = (valores.length === 1 ? (valores[0] ?? '') : '')
      .split(/\s+/)
      .filter((campo) => campo.length > 0);
    const declaradoNoExecStart = campos.length > 0 ? campos[campos.length - 1] : undefined;
    const aceitoPeloDespachante = emKebab(rotina);

    if (declaradoNoExecStart !== aceitoPeloDespachante) {
      argumentosDivergentes.push({ unidade: nome, declaradoNoExecStart, aceitoPeloDespachante });
    }
  }

  // A unidade-modelo é lida à parte porque o prefixo dela é outro. ⚠️ A EXISTÊNCIA dela entra em
  // `examinados`, e não é detalhe: somar `1` incondicionalmente faria o controle antivácuo do caso
  // continuar em sete com o arquivo apagado — o achado nasceria, mas a contagem mentiria sobre o
  // que foi examinado, e é a contagem que impede a asserção de passar por vacuidade.
  const conteudoDoModelo = await readFile(join(diretorio, UNIDADE_DE_ALERTA), 'utf8').catch(
    () => undefined,
  );
  if (
    conteudoDoModelo === undefined ||
    !valoresDaDiretiva(conteudoDoModelo, 'ExecStart').some((valor) =>
      valor.includes(MARCA_DA_INSTANCIA),
    )
  ) {
    modeloQueNaoNomeiaARotina.push(UNIDADE_DE_ALERTA);
  }

  return {
    examinados: nomes.length + (conteudoDoModelo === undefined ? 0 : 1),
    nomes,
    semOnFailure,
    comRestart,
    naoOneshot,
    modeloQueNaoNomeiaARotina,
    argumentosExaminados,
    argumentosDivergentes,
  };
}

// ---------------------------------------------------------------------------
// O instalador — leitura dos dois arrays declarados
// ---------------------------------------------------------------------------

/**
 * Os nomes de unidade declarados num array do instalador, resolvendo as referências a constantes.
 *
 * O leitor é **delimitado** pelo cabeçalho do array (`readonly NOME=(`) e pelo parêntese que o
 * fecha, e dentro dele aceita só a linha que é um literal inteiro entre aspas. Sem a delimitação,
 * uma busca livre pelo fonte casaria os nomes citados na **prosa** do cabeçalho do script e
 * reportaria como instalada uma unidade que nenhum laço alcança — o mesmo defeito que
 * {@link linhasExecutaveis} evita nas unidades.
 *
 * As referências `"${UNIDADE_API}"` são resolvidas pelo mapa de constantes escalares porque o
 * instalador as declara assim de propósito: um segundo literal com o mesmo nome seria a segunda
 * declaração do mesmo fato, livre para divergir na primeira renomeação.
 */
function nomesDoArray(fonte: string, nomeDoArray: string): string[] {
  const constantes = new Map<string, string>();
  for (const achado of fonte.matchAll(/^readonly ([A-Z_]+)="([^"$]+)"$/gm)) {
    const chave = achado[1];
    const valor = achado[2];
    if (chave !== undefined && valor !== undefined) {
      constantes.set(chave, valor);
    }
  }

  const abertura = `\nreadonly ${nomeDoArray}=(\n`;
  const inicio = fonte.indexOf(abertura);
  if (inicio < 0) {
    return [];
  }
  const corpoInicio = inicio + abertura.length;
  const fim = fonte.indexOf('\n)\n', corpoInicio);
  if (fim < 0) {
    return [];
  }

  const nomes: string[] = [];
  for (const linha of fonte.slice(corpoInicio, fim).split('\n')) {
    const bruto = linha.trim();
    if (bruto.length === 0 || bruto.startsWith('#')) {
      continue;
    }
    const literal = /^"([^"]+)"$/.exec(bruto)?.[1];
    if (literal === undefined) {
      continue;
    }
    const referencia = /^\$\{([A-Z_]+)\}$/.exec(literal)?.[1];
    nomes.push(referencia === undefined ? literal : (constantes.get(referencia) ?? literal));
  }

  return nomes.sort();
}

interface AchadoDeCredencial {
  readonly unidade: string;
  readonly agulha: string;
}

interface RetratoDaInstalacao {
  readonly unidadesNoDiretorio: string[];
  readonly unidadesNoInstalador: string[];
  readonly unidadesDoArranque: string[];
  readonly naoInstalados: string[];
  readonly excedentesNoInstalador: string[];
  readonly habilitaServiceIndevidamente: string[];
  readonly relogiosForaDoArranque: string[];
  readonly timersSemWantedBy: string[];
  readonly unidadesComCredencial: AchadoDeCredencial[];
}

async function analisarInstalacao(
  diretorio: string,
  caminhoDoInstalador: string,
): Promise<RetratoDaInstalacao> {
  const fonte = await readFile(caminhoDoInstalador, 'utf8');
  const unidadesNoDiretorio = (await readdir(diretorio)).sort();
  const unidadesNoInstalador = nomesDoArray(fonte, 'UNIDADES');
  const unidadesDoArranque = nomesDoArray(fonte, 'UNIDADES_DO_ARRANQUE');

  const noInstalador = new Set(unidadesNoInstalador);
  const noDiretorio = new Set(unidadesNoDiretorio);
  const noArranque = new Set(unidadesDoArranque);

  const relogios = unidadesNoDiretorio.filter(
    (nome) => nome.startsWith(PREFIXO_DA_ROTINA) && nome.endsWith(SUFIXO_DE_RELOGIO),
  );

  const timersSemWantedBy: string[] = [];
  for (const nome of relogios) {
    const conteudo = await readFile(join(diretorio, nome), 'utf8');
    if (!valoresDaDiretiva(conteudo, 'WantedBy').includes(ALVO_DOS_RELOGIOS)) {
      timersSemWantedBy.push(nome);
    }
  }

  const unidadesComCredencial: AchadoDeCredencial[] = [];
  for (const nome of unidadesNoDiretorio) {
    const conteudo = await readFile(join(diretorio, nome), 'utf8');
    for (const linha of linhasExecutaveis(conteudo)) {
      const agulha = AGULHAS_DE_CREDENCIAL.find(({ padrao }) => padrao.test(linha));
      if (agulha !== undefined) {
        unidadesComCredencial.push({ unidade: nome, agulha: agulha.nome });
      }
    }
  }

  return {
    unidadesNoDiretorio,
    unidadesNoInstalador,
    unidadesDoArranque,
    naoInstalados: unidadesNoDiretorio.filter((nome) => !noInstalador.has(nome)),
    excedentesNoInstalador: unidadesNoInstalador.filter((nome) => !noDiretorio.has(nome)),
    // O despacho `oneshot` habilitado correria NO BOOT, fora do horário; a unidade-modelo não tem
    // instância própria e `systemctl enable` sobre ela não faz sentido. As duas formas são o mesmo
    // achado, e por isso saem na mesma lista.
    habilitaServiceIndevidamente: unidadesDoArranque.filter(
      (nome) =>
        (nome.startsWith(PREFIXO_DA_ROTINA) && nome.endsWith(SUFIXO_DE_SERVICO)) ||
        nome === UNIDADE_DE_ALERTA,
    ),
    // O sentido contrário, e ele importa tanto quanto: relógio versionado, instalado e nunca
    // habilitado é uma rotina que simplesmente não corre, sem que nada falhe.
    relogiosForaDoArranque: relogios.filter((nome) => !noArranque.has(nome)),
    timersSemWantedBy,
    unidadesComCredencial,
  };
}

// ---------------------------------------------------------------------------
// O rótulo de passo do instalador — a ÚNICA propriedade deste arquivo provada
// por EXECUÇÃO, e não por inspeção do texto
// ---------------------------------------------------------------------------

/**
 * Executa um programa e devolve a saída — `bash` de verdade, num subprocesso.
 *
 * A saída não é redirecionada nem interpretada: o que o fragmento imprime é o que a asserção lê.
 */
const executar = promisify(execFile);

/** A função do instalador que publica o rótulo de cada passo. */
const FUNCAO_DO_PASSO = 'proximo_passo';

/**
 * Quantos pontos do `main` pedem um rótulo — o controle antivácuo da extração.
 *
 * São os quatro laços/chamadas do procedimento: o posicionamento, a releitura das definições, a
 * ativação e a habilitação. Ponto novo sem atualizar este número **reprova**, e é deliberado: a
 * extração passar a achar cinco pontos é informação, não detalhe.
 */
const PONTOS_DE_CHAMADA_DO_PASSO = 4;

/**
 * Quantas vezes cada ponto é repetido no fragmento executado.
 *
 * ⚠️ A repetição é o **conteúdo** desta prova, e não folga. Três dos quatro pontos reais correm
 * DENTRO de um laço `for`, de modo que o defeito que interessa não é "duas chamadas seguidas dão o
 * mesmo rótulo" e sim "a mesma chamada, repetida, dá sempre o mesmo rótulo" — que é exatamente o
 * que acontece quando o incremento morre com o subshell da substituição de comando.
 */
const REPETICOES_POR_PONTO = 3;

interface FragmentoDoPasso {
  /** As atribuições de estado que o fragmento precisa, extraídas do próprio instalador. */
  readonly preambulo: string[];
  /** O corpo de {@link FUNCAO_DO_PASSO}, literal, como o instalador o declara. */
  readonly definicao: string[];
  /** Cada ponto de chamada, como as linhas que o compõem no fonte. */
  readonly pontos: string[][];
  /** As funções que RECEBEM o rótulo, sem repetição e ordenadas. */
  readonly consumidores: string[];
}

/**
 * Extrai do fonte do instalador o que basta para EXERCITAR o rótulo de passo.
 *
 * ⚠️ Nada aqui é redigitado — a inicialização do contador, o corpo da função e as linhas de chamada
 * saem do arquivo real. É o que separa esta prova de uma reimplementação: um mecanismo de rotulagem
 * novo é exercitado tal como foi escrito, e não como esta suíte imagina que ele seja.
 *
 * O ponto de chamada é reconhecido em **duas formas**, porque as duas existem em shell e a escolha
 * entre elas é justamente o que estava errado:
 *
 * - a chamada e o consumo na **mesma** linha (`f "$(proximo_passo)" …`), que roda em subshell e
 *   perde o incremento;
 * - a chamada **sozinha** numa linha, e o consumo na seguinte (`proximo_passo` / `f "${PASSO}" …`).
 *
 * O preâmbulo é filtrado a atribuições de **valor literal**: o instalador também atribui em coluna
 * zero o resultado de uma substituição de comando (`RAIZ_REPO="$(cd … )"`), e arrastá-la para o
 * fragmento faria o `cd` acontecer num diretório temporário e derrubar o `bash` por `set -e` — o
 * caso reprovaria por uma razão que não é a propriedade sob prova.
 */
function extrairFragmentoDoPasso(fonte: string): FragmentoDoPasso {
  const linhas = fonte.split('\n');

  const inicioDaDefinicao = linhas.indexOf(`${FUNCAO_DO_PASSO}() {`);
  const fimDaDefinicao = inicioDaDefinicao < 0 ? -1 : linhas.indexOf('}', inicioDaDefinicao);
  const definicao =
    inicioDaDefinicao < 0 || fimDaDefinicao < 0
      ? []
      : linhas.slice(inicioDaDefinicao, fimDaDefinicao + 1);

  const preambulo = linhas
    .slice(0, inicioDaDefinicao < 0 ? 0 : inicioDaDefinicao)
    .filter((linha) => /^[A-Za-z_][A-Za-z0-9_]*=(?:\d+|""|'')$/.test(linha));

  const pontos: string[][] = [];
  for (let indice = 0; indice < linhas.length; indice += 1) {
    if (indice >= inicioDaDefinicao && indice <= fimDaDefinicao) {
      continue;
    }
    const linha = (linhas[indice] ?? '').trim();
    if (linha.startsWith('#') || !linha.includes(FUNCAO_DO_PASSO)) {
      continue;
    }
    pontos.push(linha === FUNCAO_DO_PASSO ? [linha, (linhas[indice + 1] ?? '').trim()] : [linha]);
  }

  const consumidores = [
    ...new Set(
      pontos.map((bloco) => /^([a-z_][a-z0-9_]*)\b/.exec(bloco[bloco.length - 1] ?? '')?.[1] ?? ''),
    ),
  ].sort();

  return { preambulo, definicao, pontos, consumidores };
}

/**
 * Monta o programa `bash` que exercita o fragmento: cada consumidor vira um eco do rótulo recebido.
 *
 * O consumidor real escreve em `/etc` e chama `systemctl`; aqui ele é substituído por um `printf`
 * do **primeiro argumento**, que é a posição em que as quatro funções do instalador recebem o
 * rótulo. Nada mais é substituído — o contador, a função e as linhas de chamada são os do arquivo.
 */
function montarProgramaDoPasso(fragmento: FragmentoDoPasso): string {
  const corpo: string[] = [];
  for (const bloco of fragmento.pontos) {
    for (let repeticao = 0; repeticao < REPETICOES_POR_PONTO; repeticao += 1) {
      corpo.push(...bloco);
    }
  }

  return [
    '#!/usr/bin/env bash',
    'set -Eeuo pipefail',
    ...fragmento.preambulo,
    ...fragmento.definicao,
    ...fragmento.consumidores.map((nome) => `${nome}() { printf '%s\\n' "$1"; }`),
    // A variável do laço, que as linhas de chamada citam. Sob `set -u` ela precisa existir.
    "unidade='uma-unidade-qualquer'",
    ...corpo,
    '',
  ].join('\n');
}

/** Os rótulos que o fragmento do instalador emite, na ordem, executando `bash` de verdade. */
async function rotulosEmitidos(fragmento: FragmentoDoPasso, raiz: string): Promise<string[]> {
  const caminho = join(raiz, 'fragmento-do-passo.sh');
  await writeFile(caminho, montarProgramaDoPasso(fragmento), 'utf8');
  const { stdout } = await executar('bash', [caminho]);
  return stdout.split('\n').filter((linha) => linha.length > 0);
}

// ---------------------------------------------------------------------------
// O harness de falsificação
// ---------------------------------------------------------------------------

/** Uma mutação aplicada à cópia: o arquivo alvo e o que fazer com o texto dele. */
interface Mutacao {
  readonly unidade: string;
  readonly mutar: (conteudo: string) => string;
}

/**
 * Copia as unidades versionadas para um diretório novo, aplicando as mutações pedidas.
 *
 * A árvore versionada **nunca** é tocada — é o que permite as provas de falsificação rodarem no
 * mesmo processo dos casos verdadeiros, sem janela em que o repositório fique defeituoso. Mesmo
 * molde de `copiarUnidades` no `CT-512 (b)` de `packages/db/test/cobranca.spec.ts`.
 */
async function copiarUnidades(raiz: string, mutacoes: readonly Mutacao[]): Promise<string> {
  const destino = await mkdtemp(join(raiz, 'unidades-'));
  await mkdir(destino, { recursive: true });

  const porUnidade = new Map(mutacoes.map((mutacao) => [mutacao.unidade, mutacao.mutar]));

  for (const nome of await readdir(DIRETORIO_DE_UNIDADES)) {
    const origem = join(DIRETORIO_DE_UNIDADES, nome);
    const mutar = porUnidade.get(nome);
    if (mutar === undefined) {
      await copyFile(origem, join(destino, nome));
      continue;
    }
    await writeFile(join(destino, nome), mutar(await readFile(origem, 'utf8')), 'utf8');
  }

  return destino;
}

/**
 * Grava uma cópia do fonte do instalador com a substituição pedida, e devolve o caminho dela.
 *
 * O nome do arquivo carrega o **apelido do defeito** em vez de um sufixo aleatório: quando uma das
 * falsificações reprovar, é ele que aparece na mensagem, e "instalador-sem-um-nome.sh" diz o que
 * estava sendo provado enquanto um sufixo sorteado não diz nada.
 */
async function copiarInstalador(
  raiz: string,
  apelido: string,
  mutar: (fonte: string) => string,
): Promise<string> {
  const destino = join(raiz, `instalador-${apelido}.sh`);
  await writeFile(destino, mutar(await readFile(CAMINHO_DO_INSTALADOR, 'utf8')), 'utf8');
  return destino;
}

/** Um diretório temporário próprio do caso, descartado sem falhar se já não existir. */
async function comRaizTemporaria(trabalho: (raiz: string) => Promise<void>): Promise<void> {
  const raiz = await mkdtemp(join(tmpdir(), 'sysloc-unidades-agendadas-'));
  try {
    await trabalho(raiz);
  } finally {
    await rm(raiz, { recursive: true, force: true });
  }
}

// ===========================================================================
// CT-1057 — o fuso é DECLARADO, e o horário é o do contrato
// ===========================================================================

describe('CT-1057 — todo OnCalendar= declara o fuso, e o horário é o de CADENCIA_DA_ROTINA', () => {
  it(
    'as seis unidades cobrem o mapa nos dois sentidos, nenhuma omite o fuso e nenhuma diverge do contrato',
    async () => {
      // --- Passo 1: cobertura de conjunto, nos DOIS sentidos --------------------------------
      const retrato = await analisarRelogios(DIRETORIO_DE_UNIDADES);
      const esperados = CADENCIAS.map(([rotina]) =>
        nomeDaUnidade(rotina, SUFIXO_DE_RELOGIO),
      ).sort();

      // Controle antivácuo: sem ele, comparar dois conjuntos vazios passaria por vacuidade.
      expect(retrato.examinados).toBe(RELOGIOS);
      expect(esperados.length).toBe(RELOGIOS);
      // Igualdade, e não contenção: um relógio a mais e um relógio a menos reprovam igualmente.
      expect(retrato.nomes).toEqual(esperados);

      // --- Passo 2: uma linha por arquivo, o fuso literal e o horário do contrato -------------
      expect(retrato.semOnCalendarUnico).toEqual([]);
      expect(retrato.semFuso).toEqual([]);
      expect(retrato.divergenciasDeHorario).toEqual([]);

      // O horário de cada uma, afirmado por VALOR — a lista acima diz que não há divergência, e
      // esta diz contra o quê. Sem ela, um contrato inteiro deslocado passaria: as duas pontas
      // divergiriam juntas e a comparação continuaria verde.
      const declarados = Object.fromEntries(
        CADENCIAS.map(([rotina, cadencia]) => [rotina, expressaoDeTempoEsperada(cadencia)]),
      );
      expect(declarados).toEqual({
        AVISO_DE_COBRANCA: '*:*:00',
        ENCERRAMENTO_DE_CONTRATOS: '00:02',
        CONFERENCIA_DE_LIQUIDACAO: '03:00',
        VIGILANCIA_DAS_ROTINAS: '*:00/15:00',
        MANUTENCAO: '03:30',
        RETOMADA_DE_NOTICIAS: '*:00/10:00',
      });

      // --- Passo 3: PROVA DE FALSIFICAÇÃO ----------------------------------------------------
      await comRaizTemporaria(async (raiz) => {
        // Controle: a cópia íntegra passa limpa. Sem esta perna, um leitor quebrado — que
        // reprovasse qualquer diretório — daria as duas reprovações abaixo sem provar nada.
        const integra = await analisarRelogios(await copiarUnidades(raiz, []));
        expect(integra.examinados).toBe(RELOGIOS);
        expect(integra.semFuso).toEqual([]);
        expect(integra.divergenciasDeHorario).toEqual([]);

        // Falsificação 1: o sufixo do fuso removido — o defeito que a máquina esconde hoje, porque
        // ela está em America/Sao_Paulo e o horário passa a acertar por acidente.
        const semFuso = await analisarRelogios(
          await copiarUnidades(raiz, [
            {
              unidade: 'sysloc-rotina-encerramento-de-contratos.timer',
              // ⚠️ A mutação é aplicada À LINHA `OnCalendar=`, e não ao texto do arquivo.
              // Substituir a primeira ocorrência do fuso muta o COMENTÁRIO do cabeçalho — que
              // explica por que o fuso é declarado — e o achado não nasce, porque
              // `linhasExecutaveis` descarta comentário. Isso foi medido ao escrever este caso: a
              // primeira versão da falsificação reprovou por não produzir achado nenhum, o que é
              // a prova de que o leitor de fato ignora prosa.
              mutar: (conteudo) =>
                conteudo
                  .split('\n')
                  .map((linha) =>
                    linha.startsWith('OnCalendar=')
                      ? linha.replace(` ${FUSO_DA_OPERACAO}`, '')
                      : linha,
                  )
                  .join('\n'),
            },
          ]),
        );
        expect(semFuso.semFuso).toEqual(['sysloc-rotina-encerramento-de-contratos.timer']);
        // E só o fuso: a hora não mudou, então a segunda lista continua vazia. É o que separa
        // "a asserção reprovou" de "a asserção reprovou pelo motivo certo".
        expect(semFuso.divergenciasDeHorario).toEqual([]);

        // Falsificação 2: a hora trocada — a divergência entre a unidade e o contrato.
        const horaTrocada = await analisarRelogios(
          await copiarUnidades(raiz, [
            {
              unidade: 'sysloc-rotina-encerramento-de-contratos.timer',
              // Mesma ancoragem da falsificação acima, e pela mesma razão.
              mutar: (conteudo) =>
                conteudo
                  .split('\n')
                  .map((linha) =>
                    linha.startsWith('OnCalendar=') ? linha.replace('00:02:00', '01:02:00') : linha,
                  )
                  .join('\n'),
            },
          ]),
        );
        expect(horaTrocada.divergenciasDeHorario).toEqual([
          {
            unidade: 'sysloc-rotina-encerramento-de-contratos.timer',
            declaradoNaUnidade: '01:02',
            declaradoNoContrato: '00:02',
          },
        ]);
        expect(horaTrocada.semFuso).toEqual([]);
      });
    },
    LIMITE_DO_CASO_MS,
  );
});

// ===========================================================================
// CT-1058 — Persistent=true exatamente nas diárias
// ===========================================================================

describe('CT-1058 — Persistent=true existe exatamente nas diárias e falta nas de intervalo', () => {
  it(
    'o conjunto medido é o das cadências DIARIA, nos dois sentidos, e a de minuto não o declara',
    async () => {
      // --- Passo 1: o conjunto esperado, DERIVADO do mapa ------------------------------------
      const diariasEsperadas = CADENCIAS.filter(([, cadencia]) => cadencia.tipo === CADENCIA_DIARIA)
        .map(([rotina]) => nomeDaUnidade(rotina, SUFIXO_DE_RELOGIO))
        .sort();
      const deIntervalo = CADENCIAS.filter(([, cadencia]) => cadencia.tipo !== CADENCIA_DIARIA);

      // Controle antivácuo nas DUAS partições — sem ele, um mapa vazio satisfaria tudo abaixo.
      expect(diariasEsperadas.length).toBe(3);
      expect(deIntervalo.length).toBe(3);
      expect(diariasEsperadas.length + deIntervalo.length).toBe(RELOGIOS);

      // --- Passo 2: igualdade nos dois sentidos ----------------------------------------------
      const retrato = await analisarPersistencia(DIRETORIO_DE_UNIDADES);

      expect(retrato.examinados).toBe(RELOGIOS);
      expect(retrato.comPersistent).toEqual(diariasEsperadas);
      expect(retrato.persistentesIndevidos).toEqual([]);
      expect(retrato.diariasSemPersistent).toEqual([]);

      // A rotina de minuto, nomeada — é dela que a decisão fala: recuperar um minuto perdido não
      // recupera nada, e `Persistent=true` ali produziria enxurrada na volta de uma queda longa.
      expect(retrato.comPersistent).not.toContain('sysloc-rotina-aviso-de-cobranca.timer');

      // --- Passo 3: PROVA DE FALSIFICAÇÃO ----------------------------------------------------
      await comRaizTemporaria(async (raiz) => {
        const integra = await analisarPersistencia(await copiarUnidades(raiz, []));
        expect(integra.comPersistent).toEqual(diariasEsperadas);
        expect(integra.persistentesIndevidos).toEqual([]);
        expect(integra.diariasSemPersistent).toEqual([]);

        // Falsificação 1: `Persistent=true` acrescentado ao relógio de minuto.
        const comExcesso = await analisarPersistencia(
          await copiarUnidades(raiz, [
            {
              unidade: 'sysloc-rotina-aviso-de-cobranca.timer',
              mutar: (conteudo) =>
                conteudo.replace('AccuracySec=1s', 'Persistent=true\nAccuracySec=1s'),
            },
          ]),
        );
        expect(comExcesso.persistentesIndevidos).toEqual(['sysloc-rotina-aviso-de-cobranca.timer']);
        expect(comExcesso.diariasSemPersistent).toEqual([]);

        // Falsificação 2: a linha removida de uma diária — a direção contrária, e é a que faz a
        // máquina fora do ar na hora marcada CUSTAR a execução (US-08).
        const comFalta = await analisarPersistencia(
          await copiarUnidades(raiz, [
            {
              unidade: 'sysloc-rotina-encerramento-de-contratos.timer',
              mutar: (conteudo) => conteudo.replace('\nPersistent=true\n', '\n'),
            },
          ]),
        );
        expect(comFalta.diariasSemPersistent).toEqual([
          'sysloc-rotina-encerramento-de-contratos.timer',
        ]);
        expect(comFalta.persistentesIndevidos).toEqual([]);
      });
    },
    LIMITE_DO_CASO_MS,
  );
});

// ===========================================================================
// CT-1059 — OnFailure= nomeia a rotina; oneshot SEM Restart=
// ===========================================================================

describe('CT-1059 — todo despacho é oneshot, sem Restart=, e o alerta NOMEIA quem falhou', () => {
  it(
    'os seis despachos mais a unidade-modelo, com o OnFailure= literal, o %i interpolado e o argumento do ExecStart= que o despachante aceita',
    async () => {
      // --- Passo 1: os sete arquivos, por igualdade de conjunto -------------------------------
      const retrato = await analisarDespachos(DIRETORIO_DE_UNIDADES);
      const esperados = CADENCIAS.map(([rotina]) =>
        nomeDaUnidade(rotina, SUFIXO_DE_SERVICO),
      ).sort();

      expect(retrato.examinados).toBe(SERVICOS_EXAMINADOS);
      expect(esperados.length).toBe(RELOGIOS);
      expect(retrato.nomes).toEqual(esperados);

      // --- Passo 2: as três propriedades de cada despacho, e o %i do modelo -------------------
      expect(retrato.naoOneshot).toEqual([]);
      expect(retrato.semOnFailure).toEqual([]);
      // A AUSÊNCIA de `Restart=` é a decisão: reiniciar um despacho em laço multiplicaria o
      // enfileiramento em vez de o corrigir. A rotina que falha espera o próximo disparo.
      expect(retrato.comRestart).toEqual([]);
      expect(retrato.modeloQueNaoNomeiaARotina).toEqual([]);

      // --- Passo 3: o ARGUMENTO do ExecStart= é o nome que o despachante aceita ---------------
      //
      // Controle antivácuo antes da igualdade: sem ele, um leitor que não achasse `ExecStart=` em
      // arquivo nenhum devolveria a lista vazia e a asserção seguinte passaria por vacuidade.
      expect(retrato.argumentosExaminados).toBe(RELOGIOS);
      expect(retrato.argumentosDivergentes).toEqual([]);

      // E contra o quê, por VALOR — no mesmo molde do horário no CT-1057. A lista acima diz que
      // unidade e roster concordam; esta diz o que os dois declaram. Sem ela, uma renomeação feita
      // nas duas pontas ao mesmo tempo passaria: elas divergiriam juntas e a comparação de cima
      // continuaria verde, enquanto o `ExecStart=` teria deixado de nomear a rotina do produto.
      const argumentosAceitos = Object.fromEntries(
        CADENCIAS.map(([rotina]) => [rotina, emKebab(rotina)]),
      );
      expect(argumentosAceitos).toEqual({
        AVISO_DE_COBRANCA: 'aviso-de-cobranca',
        ENCERRAMENTO_DE_CONTRATOS: 'encerramento-de-contratos',
        CONFERENCIA_DE_LIQUIDACAO: 'conferencia-de-liquidacao',
        VIGILANCIA_DAS_ROTINAS: 'vigilancia-das-rotinas',
        MANUTENCAO: 'manutencao',
        RETOMADA_DE_NOTICIAS: 'retomada-de-noticias',
      });

      // --- Passo 4: PROVA DE FALSIFICAÇÃO ----------------------------------------------------
      await comRaizTemporaria(async (raiz) => {
        const integra = await analisarDespachos(await copiarUnidades(raiz, []));
        expect(integra.examinados).toBe(SERVICOS_EXAMINADOS);
        expect(integra.semOnFailure).toEqual([]);
        expect(integra.comRestart).toEqual([]);
        expect(integra.modeloQueNaoNomeiaARotina).toEqual([]);
        expect(integra.argumentosExaminados).toBe(RELOGIOS);
        expect(integra.argumentosDivergentes).toEqual([]);

        // Falsificação 1: a linha `OnFailure=` removida — a falha deixa de ser nomeada.
        const semAlerta = await analisarDespachos(
          await copiarUnidades(raiz, [
            {
              unidade: 'sysloc-rotina-manutencao.service',
              mutar: (conteudo) => conteudo.replace(`OnFailure=${ONFAILURE_ESPERADO}\n`, ''),
            },
          ]),
        );
        expect(semAlerta.semOnFailure).toEqual(['sysloc-rotina-manutencao.service']);
        expect(semAlerta.comRestart).toEqual([]);

        // Falsificação 2: `Restart=always` de volta — o laço de despacho.
        const comRestart = await analisarDespachos(
          await copiarUnidades(raiz, [
            {
              unidade: 'sysloc-rotina-manutencao.service',
              mutar: (conteudo) => conteudo.replace('Type=oneshot', 'Type=oneshot\nRestart=always'),
            },
          ]),
        );
        expect(comRestart.comRestart).toEqual(['sysloc-rotina-manutencao.service']);
        expect(comRestart.semOnFailure).toEqual([]);

        // Falsificação 3: o `%i` do modelo trocado por texto fixo — o alerta dispara, e o operador
        // fica sabendo que "uma rotina falhou" sem saber qual.
        const modeloMudo = await analisarDespachos(
          await copiarUnidades(raiz, [
            {
              unidade: UNIDADE_DE_ALERTA,
              mutar: (conteudo) =>
                conteudo
                  .split('\n')
                  .map((linha) =>
                    linha.startsWith('ExecStart=')
                      ? 'ExecStart=/usr/bin/echo "uma rotina agendada falhou"'
                      : linha,
                  )
                  .join('\n'),
            },
          ]),
        );
        expect(modeloMudo.modeloQueNaoNomeiaARotina).toEqual([UNIDADE_DE_ALERTA]);
        expect(modeloMudo.semOnFailure).toEqual([]);

        // Falsificação 4: o argumento do `ExecStart=` com um `s` a menos. ⚠️ A mutação é ancorada
        // na LINHA `ExecStart=`, e não no texto do arquivo, pela mesma razão do CT-1057: o nome da
        // rotina aparece na prosa do cabeçalho, e mutar o comentário não produziria achado nenhum.
        // Este é o defeito que atravessa compilador, suíte, `systemd-analyze verify` e os dois
        // gates, e só aparece no primeiro disparo — quando o despachante recusa o nome e termina
        // com o código que ele reserva para "rotina desconhecida".
        const argumentoTorto = await analisarDespachos(
          await copiarUnidades(raiz, [
            {
              unidade: 'sysloc-rotina-retomada-de-noticias.service',
              mutar: (conteudo) =>
                conteudo
                  .split('\n')
                  .map((linha) =>
                    linha.startsWith('ExecStart=')
                      ? linha.replace(/retomada-de-noticias$/, 'retomada-de-noticia')
                      : linha,
                  )
                  .join('\n'),
            },
          ]),
        );
        expect(argumentoTorto.argumentosDivergentes).toEqual([
          {
            unidade: 'sysloc-rotina-retomada-de-noticias.service',
            declaradoNoExecStart: 'retomada-de-noticia',
            aceitoPeloDespachante: 'retomada-de-noticias',
          },
        ]);
        // E só o argumento: `Type=`, `OnFailure=` e a ausência de `Restart=` não foram tocados. É
        // o que separa "a asserção reprovou" de "a asserção reprovou pelo motivo certo".
        expect(argumentoTorto.semOnFailure).toEqual([]);
        expect(argumentoTorto.comRestart).toEqual([]);
        expect(argumentoTorto.naoOneshot).toEqual([]);
      });
    },
    LIMITE_DO_CASO_MS,
  );
});

// ===========================================================================
// CT-1060 — o instalador cobre tudo, habilita só relógio, e nada carrega credencial
// ===========================================================================

describe('CT-1060 — o instalador cobre o diretório, habilita SÓ .timer, e nenhuma unidade carrega credencial', () => {
  it(
    'igualdade de conjunto com o diretório, o arranque sem oneshot, o WantedBy de todo relógio, a varredura com controle positivo, e o rótulo de passo que AVANÇA',
    async () => {
      const retrato = await analisarInstalacao(DIRETORIO_DE_UNIDADES, CAMINHO_DO_INSTALADOR);

      // --- Passo 1: o array UNIDADES é igual, como conjunto, ao diretório ---------------------
      //
      // A contagem é afirmada por SOMA DECLARADA: as duas unidades permanentes mais as treze que
      // esta fatia acrescenta. Um número solto não diria qual parcela mudou.
      expect(UNIDADES_DA_FATIA.length).toBe(UNIDADES_ACRESCENTADAS);
      expect(retrato.unidadesNoDiretorio.length).toBe(
        UNIDADES_PREEXISTENTES.length + UNIDADES_ACRESCENTADAS,
      );
      expect(retrato.unidadesNoDiretorio).toEqual([...UNIDADES_ESPERADAS]);

      // Controle antivácuo do leitor do shell: um extrator quebrado devolveria `[]` e as duas
      // listas de diferença abaixo ficariam vazias por vacuidade.
      expect(retrato.unidadesNoInstalador.length).toBe(retrato.unidadesNoDiretorio.length);
      expect(retrato.unidadesNoInstalador).toEqual([...UNIDADES_ESPERADAS]);
      expect(retrato.naoInstalados).toEqual([]);
      expect(retrato.excedentesNoInstalador).toEqual([]);

      // --- Passo 2: habilita-se o relógio, NUNCA o despacho -----------------------------------
      expect(retrato.unidadesDoArranque.length).toBe(UNIDADES_PREEXISTENTES.length + RELOGIOS);
      expect(retrato.habilitaServiceIndevidamente).toEqual([]);
      // O sentido contrário: relógio instalado e nunca habilitado não corre, sem que nada falhe.
      expect(retrato.relogiosForaDoArranque).toEqual([]);
      // E todo relógio tem onde ser ligado.
      expect(retrato.timersSemWantedBy).toEqual([]);

      // --- Passo 3: nenhuma credencial nas unidades (ADR-0005 · ADR-0032) ---------------------
      expect(retrato.unidadesComCredencial).toEqual([]);

      await comRaizTemporaria(async (raiz) => {
        // CONTROLE POSITIVO da varredura. Sem ele, uma varredura que nunca casasse nada devolveria
        // a lista vazia acima e a asserção seria tautológica (AP-29) — é a exigência que a
        // ADR-0032 faz por escrito: a ausência de vazamento se prova por MEDIÇÃO.
        const comAgulhas = await copiarUnidades(raiz, []);
        await writeFile(
          join(comAgulhas, 'sysloc-agulha-a.service'),
          '[Service]\nEnvironment=PGPASSWORD=x\n',
          'utf8',
        );
        await writeFile(
          join(comAgulhas, 'sysloc-agulha-b.service'),
          '[Service]\nEnvironment=DATABASE_URL=postgres://usuario:segredo@maquina/banco\n',
          'utf8',
        );
        await writeFile(
          join(comAgulhas, 'sysloc-agulha-c.service'),
          '[Service]\nEnvironment=SMTP_PASSWORD=x\n',
          'utf8',
        );
        await writeFile(
          join(comAgulhas, 'sysloc-agulha-d.service'),
          '[Service]\nEnvironment=SENHA_DO_BANCO=x\n',
          'utf8',
        );

        const plantado = await analisarInstalacao(comAgulhas, CAMINHO_DO_INSTALADOR);
        expect(plantado.unidadesComCredencial.length).toBe(AGULHAS_PLANTADAS);
        expect(plantado.unidadesComCredencial).toEqual([
          { unidade: 'sysloc-agulha-a.service', agulha: 'PGPASSWORD' },
          { unidade: 'sysloc-agulha-b.service', agulha: 'credencial embutida em URL' },
          { unidade: 'sysloc-agulha-c.service', agulha: 'password' },
          { unidade: 'sysloc-agulha-d.service', agulha: 'senha' },
        ]);

        // Falsificação 1: um nome retirado do array `UNIDADES` — a unidade fica versionada e nunca
        // instalada, que é o modo de falha mais silencioso desta classe.
        const semUmNome = await analisarInstalacao(
          DIRETORIO_DE_UNIDADES,
          await copiarInstalador(raiz, 'sem-um-nome', (fonte) =>
            fonte.replace('\t"sysloc-rotina-manutencao.timer"\n', ''),
          ),
        );
        expect(semUmNome.naoInstalados).toEqual(['sysloc-rotina-manutencao.timer']);
        expect(semUmNome.excedentesNoInstalador).toEqual([]);
        // Ela sai do array de posicionamento, mas continua na lista de arranque — e o segundo
        // achado é o que separa "notei que algo mudou" de "notei O QUE mudou".
        expect(semUmNome.relogiosForaDoArranque).toEqual([]);

        // Falsificação 2: um despacho `oneshot` acrescentado ao arranque — a falha típica desta
        // classe de unidade, e a que a §1 desta task nomeia: habilitado, ele correria NO BOOT, fora
        // do horário declarado. A mutação é ancorada no CABEÇALHO do array de arranque, e não num
        // item dele, porque cada nome de relógio aparece nos DOIS arrays — ancorar no item mutaria o
        // array errado e a falsificação provaria outra coisa.
        const habilitandoOneshot = await analisarInstalacao(
          DIRETORIO_DE_UNIDADES,
          await copiarInstalador(raiz, 'habilitando-oneshot', (fonte) =>
            fonte.replace(
              'readonly UNIDADES_DO_ARRANQUE=(\n',
              'readonly UNIDADES_DO_ARRANQUE=(\n\t"sysloc-rotina-manutencao.service"\n',
            ),
          ),
        );
        expect(habilitandoOneshot.habilitaServiceIndevidamente).toEqual([
          'sysloc-rotina-manutencao.service',
        ]);
        // E só isso: o array de posicionamento não foi tocado, então a cobertura continua completa.
        expect(habilitandoOneshot.naoInstalados).toEqual([]);
        expect(habilitandoOneshot.relogiosForaDoArranque).toEqual([]);

        // Falsificação 3: um `.timer` sem `WantedBy=` — habilitá-lo deixa de ligar coisa alguma.
        const semWantedBy = await analisarInstalacao(
          await copiarUnidades(raiz, [
            {
              unidade: 'sysloc-rotina-vigilancia-das-rotinas.timer',
              mutar: (conteudo) => conteudo.replace(`WantedBy=${ALVO_DOS_RELOGIOS}\n`, ''),
            },
          ]),
          CAMINHO_DO_INSTALADOR,
        );
        expect(semWantedBy.timersSemWantedBy).toEqual([
          'sysloc-rotina-vigilancia-das-rotinas.timer',
        ]);
        expect(semWantedBy.unidadesComCredencial).toEqual([]);

        // Falsificação 4: uma credencial embutida numa unidade — o que a ADR-0005 recusa na entrada.
        const comCredencial = await analisarInstalacao(
          await copiarUnidades(raiz, [
            {
              unidade: 'sysloc-rotina-manutencao.service',
              mutar: (conteudo) =>
                conteudo.replace(
                  'Environment=NODE_ENV=production',
                  'Environment=NODE_ENV=production\nEnvironment=DATABASE_URL=postgres://usuario:segredo@maquina/banco',
                ),
            },
          ]),
          CAMINHO_DO_INSTALADOR,
        );
        expect(comCredencial.unidadesComCredencial).toEqual([
          { unidade: 'sysloc-rotina-manutencao.service', agulha: 'credencial embutida em URL' },
        ]);
        expect(comCredencial.timersSemWantedBy).toEqual([]);
      });

      // --- Passo 4: o rótulo de passo AVANÇA — provado por EXECUÇÃO ---------------------------
      //
      // ⚠️ Esta é a única perna COMPORTAMENTAL do arquivo, e a escolha é a decisão. A alternativa
      // barata era estática — afirmar que `proximo_passo` não aparece dentro de `$( )` no fonte —,
      // e ela prende a FORMA de hoje em vez da propriedade: qualquer outro mecanismo que perdesse o
      // incremento (um `while` alimentado por cano, um `| while read`, uma chamada dentro de crase)
      // passaria por ela. Aqui o fragmento REAL é extraído do instalador e executado sob `bash`,
      // com cada ponto repetido, e o que se exige é o que a CA-04 quer: rótulos que distinguem uma
      // linha do registro da seguinte. Por ser comportamental, ela não pede prova de falsificação
      // por execução — ela reprova com o código antigo por construção, e a asserção que discrimina
      // é a da DISTINÇÃO: com a substituição de comando, as doze saídas eram `P01`.
      //
      // Ela também é a razão de este arquivo importar `node:child_process`: nenhuma outra asserção
      // daqui executa coisa alguma, e a exceção é deliberada — sem `sudo` o instalador inteiro não
      // roda (decisão A1 da §16.1), mas o mecanismo do rótulo roda sozinho, sem privilégio nenhum.
      await comRaizTemporaria(async (raiz) => {
        const fragmento = extrairFragmentoDoPasso(await readFile(CAMINHO_DO_INSTALADOR, 'utf8'));

        // Controle antivácuo da EXTRAÇÃO: sem ele, um leitor que não achasse chamada nenhuma
        // montaria um programa vazio, e um programa vazio não emite rótulo repetido.
        expect(fragmento.pontos.length).toBe(PONTOS_DE_CHAMADA_DO_PASSO);
        // E a quem o rótulo chega — as quatro funções que escrevem o registro de instalação. Um
        // ponto que deixasse de alimentar uma delas sairia daqui nomeado.
        expect(fragmento.consumidores).toEqual([
          'ativar_unidade',
          'habilitar_unidade',
          'posicionar_unidade',
          'recarregar_definicoes',
        ]);

        const rotulos = await rotulosEmitidos(fragmento, raiz);

        // Controle antivácuo da EXECUÇÃO, antes da distinção: zero rótulo satisfaria "nenhum se
        // repete" por vacuidade.
        expect(rotulos.length).toBe(PONTOS_DE_CHAMADA_DO_PASSO * REPETICOES_POR_PONTO);
        // A propriedade que a CA-04 cobra, nomeada: duas linhas do registro nunca dizem o mesmo
        // número. É ESTA asserção que discrimina o defeito — com o rótulo publicado por stdout e
        // consumido em `"$(proximo_passo)"`, o incremento morria no subshell e as doze saídas eram
        // `P01`, deixando o conjunto com um elemento só.
        expect(new Set(rotulos).size).toBe(rotulos.length);
        // E a forma exata: crescente, a partir de `P01`, com dois dígitos.
        expect(rotulos).toEqual(
          Array.from(
            { length: PONTOS_DE_CHAMADA_DO_PASSO * REPETICOES_POR_PONTO },
            (_, posicao) => `P${String(posicao + 1).padStart(2, '0')}`,
          ),
        );
      });
    },
    LIMITE_DO_CASO_MS,
  );
});
