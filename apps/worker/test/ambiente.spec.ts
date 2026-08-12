/**
 * Validação das variáveis de ambiente na partida do processador de trabalho — T6 da fatia
 * `fundacao-stack-nativa`, estendida pela **T8** da fatia `regua-de-cobranca`.
 *
 * ---------------------------------------------------------------------------
 * INVARIANTES
 * ---------------------------------------------------------------------------
 *
 * | Critério | Caso | Invariante |
 * |---|---|---|
 * | CA-15 | CT-006 | Faltando variável exigida, ou com valor inválido, `lerAmbiente` FALHA e a
 * |       |        | mensagem nomeia CADA variável com problema — nunca uma mensagem genérica,
 * |       |        | nunca devolvendo configuração, e nunca ecoando o valor recebido. |
 * | CA-15 | CT-007 | Com todas presentes e válidas, devolve a configuração com cada campo
 * |       |        | derivado da SUA variável de origem, e nada além delas. |
 * | CA-17 | CT-625 | A barreira FALHA FECHADO: sem `SMTP_URL`, sem `EMAIL_REMETENTE` ou sem
 * |       |        | `DATABASE_URL` — ausentes ou vazias —, `lerAmbiente` devolve erro que nomeia
 * |       |        | a variável faltante; com as cinco declaradas, devolve o ambiente completo por
 * |       |        | `toStrictEqual`. Nunca devolve ambiente parcial, nunca degrada em silêncio, e
 * |       |        | nunca aborta o processo por conta própria. |
 * | CA-17 | CT-643 | **Toda** variável que `lerAmbiente` exige tem caminho de provisionamento: o
 * |       |        | conjunto exigido — **observado na execução**, e nunca lido no texto do fonte —
 * |       |        | é igual a {@link VARIAVEIS_EXIGIDAS}, **basta** para a partida ser aceita, e a
 * |       |        | lista das que **nenhuma** das duas fontes entrega — o `provisionar-base.sh` e
 * |       |        | o `Environment=` da unidade —, ou que o `.env.example` não declara, é `[]`,
 * |       |        | por igualdade. Contra a verdade vácua: testemunhas
 * |       |        | positivas (as três cadeias e a severidade) e uma **negativa medida**
 * |       |        | (`BETTER_AUTH_SECRET`, o D39 aberto, que o provisionamento de fato não emite).
 * |       |        | **PROVAS DE FALSIFICAÇÃO permanentes**: uma exigência a mais escrita por
 * |       |        | **quatro idiomas** diferentes, uma exigência que nem passa pela fonte, e
 * |       |        | cópias em memória do provisionador sem a emissão, com ela só em comentário e
 * |       |        | com ela gravada em OUTRO arquivo — todas reprovam nomeando a variável. |
 * | CA-10 | CT-644 | A soma dos dois prazos de desligamento declarados no fonte (`fila.ts` +
 * |       |        | `main.ts`) é **menor** que o `TimeoutStopSec` das **duas** unidades — quem
 * |       |        | desiste primeiro é o processo, que sabe explicar no journal. **PROVA DE
 * |       |        | FALSIFICAÇÃO permanente**: prazos somando 31 s reprovam nomeando a unidade. |
 *
 * Rastreabilidade acrescida pela T8: `CA-17 → CT-625 (RD-15)`, `CA-17 → CT-643 (RD-15)` e
 * `CA-10 → CT-644`.
 *
 * ---------------------------------------------------------------------------
 * Por que este arquivo existe
 * ---------------------------------------------------------------------------
 *
 * O conjunto de variáveis deste processo é PRÓPRIO — ele não escuta porta, e `PORT` não entra. A
 * prova de sistema do CA-15 (T7) sobe uma unidade com o arquivo de ambiente incompleto; se ela for
 * executada contra o processador com uma variável que ele não lê removida, o processo sobe
 * normalmente e o caso prova o contrário do que afirma. A prova de unidade fecha esse vão: ela
 * exercita as variáveis que ESTE processo lê, e é a única que reprova se a mensagem de falha
 * regredir para genérica — ou se ela passar a ecoar o valor recebido, que é o que a levaria a
 * publicar credencial no journal.
 *
 * ---------------------------------------------------------------------------
 * Por que o CT-625 é o inverso do modo de falha habitual (CA-17)
 * ---------------------------------------------------------------------------
 *
 * Na T8 o processador passou a falar com um **servidor de e-mail**, e ali *"tentar mesmo assim"*
 * não degrada em erro: um transporte construído a partir de cadeia vazia aponta para o `localhost`
 * que a biblioteca assume por omissão, e o que está em jogo é alcançar a caixa de uma pessoa real.
 * Por isso a partida é recusada, e por isso o caso afirma que **nenhuma** linha inválida devolve
 * ambiente parcial: um ambiente parcial com `urlDoTransporte` vazio é exatamente o transporte
 * "nulo" que aceitaria mensagens.
 *
 * ⚠️ **O que este arquivo NÃO consegue cobrir, e por quê.** A guarda `exigirDeclarada`, dentro de
 * `criarAdaptadorSmtp` (`@sysloc/regua`), recusa a construção pelo mesmo vazio — e o Gate 1 da T6
 * a anotou como inalcançável por teste (`AP-28`). Ela continua inalcançável **por construção**, e
 * não por esquecimento: alcançá-la exige que algum arquivo de teste nomeie `criarAdaptadorSmtp` ou
 * o caminho do módulo dele, e é exatamente isso que a barreira da CA-17
 * (`packages/db/test/barreira-de-envio.spec.ts`, `CT-626`) proíbe **por igualdade** sobre os quatro
 * diretórios de teste do repositório — não há posição legítima de onde chamá-la. O que fica provado
 * aqui é o degrau que **antecede** aquela guarda: o mesmo vazio é recusado antes de o adaptador
 * chegar a ser construído.
 *
 * ---------------------------------------------------------------------------
 * Espelho de `apps/api/test/ambiente.spec.ts`
 * ---------------------------------------------------------------------------
 *
 * Mesma disciplina: a fonte de variáveis é PARÂMETRO da função, e um único caso planta valor em
 * `process.env` — o que PROVA que o ambiente do processo não prevalece sobre a fonte — restaurando
 * o valor anterior ao terminar. Nos demais, mutação global só quebraria a independência entre
 * casos. `lerAmbiente` é exportada pelo mesmo motivo que `carregarAmbiente` o é do lado do serviço
 * de aplicação: é a unidade que a composição raiz consome, não um ponto de entrada criado para a
 * verificação enxergar estado.
 *
 * ---------------------------------------------------------------------------
 * As duas asserções DE CONTRATO COM A OPERAÇÃO do fim do arquivo, e por que moram aqui
 * ---------------------------------------------------------------------------
 *
 * As duas afirmam o **contrato deste processo com o ambiente de operação**, nas suas duas pontas: o
 * arquivo que ele lê para subir (`CT-643`) e o prazo que o supervisor lhe dá para descer
 * (`CT-644`). Nenhuma das duas é observável chamando um código só — elas ligam a composição raiz,
 * um script de instalação e uma unidade `systemd`, que são três artefatos que nenhum caso
 * comportamental carrega ao mesmo tempo. Elas ficam neste arquivo, e não numa suíte de shell, por
 * uma razão medida: a bateria de `deploy/scripts/instalacao/` recusa a execução sem `root`
 * (`verificar-provisionamento.sh`, guarda de `EUID`), e `sudo` neste host pede senha interativa —
 * um caso escrito lá seria prova inconclusiva, que a `.claude/rules/testing-stack.md` trata como
 * pior que prova ausente.
 *
 * ⚠️ **O CT-643 tem as duas naturezas, e a divisão é o que a rodada 2 do Gate 1 corrigiu.** O lado
 * da **exigência** é COMPORTAMENTAL: o conjunto de variáveis sai de executar `lerAmbiente` — quais
 * nomes ela consulta na fonte, e quais dessas ela recusa quando faltam. Ele foi estático até a
 * rodada 2, derivado por `grep` de uma única redação da recusa, e o Gate 1 mediu que a mesma
 * exigência escrita por template passava despercebida (ver o marcador `DECISÃO FECHADA` sobre
 * {@link variaveisConsultadasPor}). O lado do **provisionamento** continua estático por natureza —
 * um script de shell e uma unidade `systemd` não são código que se chame —, e por isso ele traz a
 * prova de falsificação **permanente na suíte**: o detector é função pura sobre texto, aplicada
 * também a cópias em memória com o defeito de volta. Nenhum arquivo é escrito no disco.
 *
 * O `CT-644` é estático nas duas pontas, e traz a falsificação permanente pela mesma razão.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { NIVEIS_DE_LOG } from '@sysloc/shared';
import { describe, expect, it, onTestFinished } from 'vitest';
import { type Ambiente, lerAmbiente } from '../src/main.ts';

/**
 * As variáveis que o processador exige — e o `.env.example` documenta.
 *
 * ⚠️ **São CINCO desde a T8, e o crescimento é a natureza do processo mudando**: ele deixou de ser
 * um consumidor que só fala com a fila e passou a falar com o banco e com um servidor de e-mail.
 * A lista é a fonte das duas tabelas de caso abaixo, de modo que uma variável acrescentada a
 * `lerAmbiente` sem entrar aqui **não é exercitada** — e uma que saia daqui sem sair de lá reprova.
 */
const VARIAVEIS_EXIGIDAS = [
  'LOG_LEVEL',
  'REDIS_URL',
  'DATABASE_URL',
  'SMTP_URL',
  'EMAIL_REMETENTE',
] as const;

/** Senha embutida nas cadeias de conexão, para provar que a falha não a ecoa. */
const SENHA_NA_CADEIA = 'segredoQueNaoPodeVazar';

/** Severidade única e distinguível de qualquer valor padrão do registrador. */
const SEVERIDADE = 'warn';

/**
 * Ambiente completo e válido do processador.
 *
 * Traz também uma variável que o processador NÃO exige: é o que permite afirmar que a
 * configuração devolvida não a absorve.
 *
 * As três cadeias de conexão carregam a MESMA senha, de propósito: a asserção de não-vazamento
 * passa a valer para as três de uma vez, e uma mensagem que ecoasse qualquer uma delas reprova.
 */
function ambienteCompleto(): Record<string, string> {
  return {
    LOG_LEVEL: SEVERIDADE,
    REDIS_URL: `redis://usuarioct007:${SENHA_NA_CADEIA}@127.0.0.1:16399`,
    DATABASE_URL: `postgresql://sysloc_app:${SENHA_NA_CADEIA}@127.0.0.1:15432/sysloc`,
    SMTP_URL: `smtps://avisos:${SENHA_NA_CADEIA}@smtp.exemplo.invalid:465`,
    EMAIL_REMETENTE: 'avisos@exemplo.invalid',
  };
}

/** Clona o ambiente completo removendo as variáveis indicadas. */
function ambienteSem(...ausentes: readonly string[]): Record<string, string> {
  const fonte = ambienteCompleto();
  for (const nome of ausentes) {
    delete fonte[nome];
  }
  return fonte;
}

/** Executa a leitura e devolve a falha, ou reprova se a chamada tiver devolvido configuração. */
function falhaDe(fonte: Record<string, string>): Error {
  let devolvido: Ambiente | undefined;
  try {
    devolvido = lerAmbiente(fonte);
  } catch (erro) {
    expect(erro).toBeInstanceOf(Error);
    return erro as Error;
  }
  throw new Error(
    `lerAmbiente devolveu configuração onde deveria ter falhado: ${JSON.stringify(devolvido)}`,
  );
}

describe('lerAmbiente (T6 · CA-15)', () => {
  it.each(VARIAVEIS_EXIGIDAS.map((nome) => ({ nome })))(
    'CT-006 — sem $nome, a partida falha e a mensagem nomeia a variável ausente',
    ({ nome }) => {
      const falha = falhaDe(ambienteSem(nome));

      expect(falha.message).toContain(`${nome}: ausente`);
    },
  );

  it.each(VARIAVEIS_EXIGIDAS.map((nome) => ({ nome })))(
    'CT-006 — $nome presente e em branco conta como ausente e é nomeada',
    ({ nome }) => {
      // Um arquivo copiado do `.env.example` sem preenchimento entrega cadeias vazias; a falha tem
      // de dizer "não foi preenchida", e não "não é uma severidade" ou "não é interpretável".
      const fonte = { ...ambienteCompleto(), [nome]: '   ' };

      const falha = falhaDe(fonte);

      expect(falha.message).toContain(`${nome}: ausente`);
    },
  );

  it('CT-006 — severidade fora da lista falha nomeando a variável e as severidades aceitas', () => {
    const fonte = { ...ambienteCompleto(), LOG_LEVEL: 'verboso' };

    const falha = falhaDe(fonte);

    expect(falha.message).toContain('LOG_LEVEL: deve ser um de: ');
    // A lista aceita é a MESMA do serviço de aplicação, e vem do pacote compartilhado: severidade
    // acrescentada em um dos lados faria um processo subir e o outro recusar o mesmo arquivo.
    for (const nivel of NIVEIS_DE_LOG) {
      expect(falha.message).toContain(nivel);
    }
    // A mensagem nomeia a exigência, nunca o valor recebido.
    expect(falha.message).not.toContain('verboso');
  });

  it('CT-006 — cadeia de fila com esquema errado falha nomeando a variável, sem ecoar a senha', () => {
    const fonte = ambienteCompleto();
    fonte.REDIS_URL = `postgresql://usuarioct006:${SENHA_NA_CADEIA}@127.0.0.1:16399`;

    const falha = falhaDe(fonte);

    expect(falha.message).toContain('REDIS_URL: deve ser uma cadeia interpretável começando com');
    expect(falha.message).toContain('redis://');
    // A mensagem vai para o journal: ecoar o valor recebido publicaria a credencial da fila.
    expect(falha.message).not.toContain(SENHA_NA_CADEIA);
    expect(falha.message).not.toContain('postgresql://');
  });

  it('CT-006 — cadeia de fila com o esquema certo, porém não interpretável, também falha', () => {
    // O companheiro do caso acima: sem esta asserção, a regra poderia regredir para uma
    // verificação de prefixo, e uma cadeia truncada só falharia na primeira conexão — com o
    // processo já reportado como no ar pelo supervisor.
    const fonte = { ...ambienteCompleto(), REDIS_URL: 'redis://[falta-fechar' };

    const falha = falhaDe(fonte);

    expect(falha.message).toContain('REDIS_URL: deve ser uma cadeia interpretável começando com');
  });

  it('CT-006 — faltando TODAS as variáveis, a mensagem nomeia todas de uma vez', () => {
    // Validação que para na primeira ausência esconde configuração incompleta e obriga uma
    // rodada de partida por variável faltante.
    //
    // SUT_IS_CORRECT_BECAUSE: o caso afirmava as DUAS variáveis que o processo exigia até a T7, e
    // a T8 leva a exigência a cinco. A asserção não foi afrouxada — ela passou a percorrer
    // `VARIAVEIS_EXIGIDAS` e a cobrar CADA uma das cinco, de modo que a forma nova subsume a
    // antiga (`LOG_LEVEL` e `REDIS_URL` continuam sendo cobradas, agora pela lista).
    const falha = falhaDe(ambienteSem(...VARIAVEIS_EXIGIDAS));

    for (const nome of VARIAVEIS_EXIGIDAS) {
      expect(falha.message).toContain(`${nome}: ausente`);
    }
    expect(falha.message).toContain('.env.example');
  });

  it('CT-007 — com todas as variáveis válidas, devolve a configuração tipada com os valores lidos', () => {
    const fonte = ambienteCompleto();

    const ambiente = lerAmbiente(fonte);

    // Cada campo vale exatamente o valor da SUA variável de origem.
    //
    // SUT_IS_CORRECT_BECAUSE: a igualdade de chaves valia dois campos porque o processo lia duas
    // variáveis; a T8 leva a leitura a cinco. A asserção continua sendo de IGUALDADE de conjunto —
    // é ela que faz um campo acrescentado à configuração sem caso próprio reprovar aqui —, e
    // ganhou a comparação do objeto INTEIRO logo abaixo, que é mais forte do que a de chaves.
    expect(ambiente.nivelDeLog).toBe(SEVERIDADE);
    expect(ambiente.cadeiaConexaoFila).toBe(fonte.REDIS_URL);
    expect(ambiente.cadeiaConexaoBanco).toBe(fonte.DATABASE_URL);
    expect(ambiente.urlDoTransporte).toBe(fonte.SMTP_URL);
    expect(ambiente.remetenteDoAviso).toBe(fonte.EMAIL_REMETENTE);
    expect(Object.keys(ambiente).sort()).toEqual([
      'cadeiaConexaoBanco',
      'cadeiaConexaoFila',
      'nivelDeLog',
      'remetenteDoAviso',
      'urlDoTransporte',
    ]);
  });

  it('CT-007 — o ambiente do processo não é lido, e o que não é exigido não entra na configuração', () => {
    const fonte = { ...ambienteCompleto(), VARIAVEL_ALHEIA: 'nao-deve-atravessar' };

    // O ambiente do PROCESSO recebe, para a mesma variável, valor divergente do que a fonte
    // declara. Uma leitura de `process.env` que PREVALECESSE sobre a fonte devolveria `trace`
    // aqui — e o processador passaria a registrar num nível que ninguém configurou. (A outra forma
    // de vazamento, uma leitura que apenas COMPLETASSE o que a fonte não trouxe, é morta pelo
    // CT-006: com ela, remover uma variável da fonte deixaria de falhar.)
    const anterior = process.env.LOG_LEVEL;
    process.env.LOG_LEVEL = 'trace';
    onTestFinished(() => {
      if (anterior === undefined) {
        delete process.env.LOG_LEVEL;
      } else {
        process.env.LOG_LEVEL = anterior;
      }
    });

    const ambiente = lerAmbiente(fonte);

    expect(ambiente.nivelDeLog).toBe(SEVERIDADE);
    expect(ambiente.nivelDeLog).not.toBe(process.env.LOG_LEVEL);
    expect(Object.values(ambiente)).not.toContain('nao-deve-atravessar');
  });
});

// ===========================================================================
// CT-625 — a porta de e-mail FALHA FECHADO: sem transporte declarado, não há partida
// ===========================================================================

/**
 * As quatro linhas inválidas da barreira, com a variável que cada uma deve nomear.
 *
 * A tabela é declarada ANTES do caso e nomeia o resultado esperado de cada linha — ela não é
 * derivada da execução. As três primeiras são a **ausência**; a quarta é a cadeia vazia, que é o
 * que um `EnvironmentFile` copiado do `.env.example` sem preenchimento entrega, e que a versão
 * ingênua desta validação (`fonte.SMTP_URL !== undefined`) aceitaria.
 */
const LINHAS_INVALIDAS = [
  { cenario: 'sem SMTP_URL', ausente: 'SMTP_URL', vazia: undefined },
  { cenario: 'sem EMAIL_REMETENTE', ausente: 'EMAIL_REMETENTE', vazia: undefined },
  { cenario: 'sem DATABASE_URL', ausente: 'DATABASE_URL', vazia: undefined },
  { cenario: 'SMTP_URL vazia', ausente: 'SMTP_URL', vazia: 'SMTP_URL' },
] as const;

/** O ambiente completo, já traduzido para os campos que a configuração publica. */
function configuracaoEsperada(fonte: Record<string, string>): Record<string, string | undefined> {
  return {
    nivelDeLog: fonte.LOG_LEVEL,
    cadeiaConexaoFila: fonte.REDIS_URL,
    cadeiaConexaoBanco: fonte.DATABASE_URL,
    urlDoTransporte: fonte.SMTP_URL,
    remetenteDoAviso: fonte.EMAIL_REMETENTE,
  };
}

describe('lerAmbiente (T8 · CA-17) — a barreira de partida do transporte', () => {
  it.each(LINHAS_INVALIDAS)(
    'CT-625 — $cenario: a partida é recusada nomeando a variável, sem devolver ambiente parcial',
    ({ ausente, vazia }) => {
      const fonte =
        vazia === undefined ? ambienteSem(ausente) : { ...ambienteCompleto(), [vazia]: '   ' };

      // `falhaDe` REPROVA quando a chamada devolve configuração — é assim que "nunca devolve
      // ambiente parcial nem transporte nulo" fica asserido, e não apenas afirmado no docblock:
      // um `lerAmbiente` que devolvesse `{ …, urlDoTransporte: '' }` cairia aqui.
      const falha = falhaDe(fonte);

      // A cadeia EXATA da variável faltante, e não "a mensagem não está vazia".
      expect(falha.message).toContain(`${ausente}: ausente`);
      // E a credencial das três cadeias de conexão não atravessa para o journal.
      expect(falha.message).not.toContain(SENHA_NA_CADEIA);
    },
  );

  it('CT-625 — com as cinco declaradas, devolve o ambiente INTEIRO por igualdade estrita', () => {
    const fonte = ambienteCompleto();

    const ambiente = lerAmbiente(fonte);

    // O objeto inteiro, e não campo a campo: é a igualdade estrita que faz um campo a mais — ou um
    // campo com valor de outra variável — reprovar aqui.
    expect(ambiente).toStrictEqual(configuracaoEsperada(fonte));
  });

  it('CT-625 — a validação RETORNA o erro e NÃO aborta o processo por conta própria', () => {
    // Padrão 14 (fail-fast testável): quem decide abortar é o ponto de entrada. Se `lerAmbiente`
    // chamasse `process.exit` por dentro, este arquivo de teste morreria no meio — e é justamente
    // isso que o torna verificável sem subprocesso. O código de saída é observado porque um
    // `process.exitCode = 1` escrito aqui dentro condenaria a suíte inteira a terminar vermelha
    // por um caso que passou.
    const codigoAntes = process.exitCode;

    for (const { ausente, vazia } of LINHAS_INVALIDAS) {
      const fonte =
        vazia === undefined ? ambienteSem(ausente) : { ...ambienteCompleto(), [vazia]: '   ' };

      expect(() => lerAmbiente(fonte)).toThrowError(Error);
    }

    expect(process.exitCode).toBe(codigoAntes);
    // E o caminho feliz segue utilizável depois das quatro recusas — nenhuma delas deixou estado.
    expect(lerAmbiente(ambienteCompleto()).nivelDeLog).toBe(SEVERIDADE);
  });
});

// ===========================================================================
// CT-643 — toda variável EXIGIDA na partida tem caminho de PROVISIONAMENTO
// ===========================================================================

/**
 * A raiz da árvore versionada — o mesmo idioma de `packages/db/test/barreira-de-envio.spec.ts`.
 */
const RAIZ_DO_REPOSITORIO = fileURLToPath(new URL('../../../', import.meta.url));

/** O script que CRIA o `/etc/sysloc/backend.env` numa instalação de máquina nova. */
const CAMINHO_DO_PROVISIONADOR = 'deploy/scripts/instalacao/provisionar-base.sh';

/** A unidade `systemd` que executa ESTE processo — a segunda fonte legítima de variável. */
const CAMINHO_DA_UNIDADE_DESTE_PROCESSO = 'deploy/systemd/sysloc-worker.service';

/** O arquivo versionado que DOCUMENTA o que cada variável é. */
const CAMINHO_DO_EXEMPLO = '.env.example';

/** A composição raiz deste processo, de onde sai o conjunto de variáveis exigidas. */
const CAMINHO_DA_COMPOSICAO = 'apps/worker/src/main.ts';

function lerDoRepositorio(relativo: string): string {
  return readFileSync(`${RAIZ_DO_REPOSITORIO}${relativo}`, 'utf8');
}

/** Assinatura de uma leitura de ambiente — a de produção e os mutantes desta suíte. */
type LeituraDeAmbiente = (fonte: Readonly<Record<string, string | undefined>>) => unknown;

/** Valor de preenchimento para variável cujo valor válido este arquivo ainda não conhece. */
const VALOR_DE_PREENCHIMENTO = 'preenchida-para-o-experimento';

/** Monta uma fonte que declara exatamente os nomes pedidos, com valor que a partida aceita. */
function fonteDeclarando(nomes: Iterable<string>): Record<string, string> {
  const conhecidos = ambienteCompleto();
  const fonte: Record<string, string> = {};
  for (const nome of nomes) {
    fonte[nome] = conhecidos[nome] ?? VALOR_DE_PREENCHIMENTO;
  }

  return fonte;
}

/** A leitura RECUSA esta fonte? */
function recusa(ler: LeituraDeAmbiente, fonte: Record<string, string>): boolean {
  try {
    ler(fonte);

    return false;
  } catch {
    return true;
  }
}

// DECISÃO FECHADA — T8 / Gate 1 rodada 2 · 2026-08-12
// O QUÊ: o conjunto de variáveis exigidas na partida é OBSERVADO em execução — as consultas à
//        fonte, por `Proxy`, e a necessidade de cada uma, por omissão. Nenhuma linha desta
//        derivação lê o texto de `main.ts`, e nenhuma lê a mensagem de recusa.
// POR QUÊ: a versão anterior derivava por `grep` de UMA redação (`problemas.push('X: ausente')`,
//          literal, aspas simples). Medido pelo Gate 1: uma sexta exigência escrita por template
//          deixava a asserção calada — e a composição raiz irmã (`apps/api/src/configuracao/
//          ambiente.ts`) JÁ monta a mensagem por template, de modo que a via não é hipotética.
//          Enumerar formas de sintaxe fecha uma redação por rodada e deixa as outras abertas
//          (§5 da `.claude/rules/nao-regressao.md`); observar o comportamento não tem redação.
// REVERTER EXIGE: provar que nenhuma exigência de partida pode ser escrita por uma forma de
//                 leitura ou uma redação de recusa que o detector textual não reconheça — o que
//                 exigiria fixar o idioma de `lerAmbiente`, que nada no projeto fixa.
/**
 * Teto de rodadas da observação — a garantia de terminação, não um ajuste.
 *
 * O conjunto observado só cresce e é limitado pelos nomes que a leitura consulta, de modo que o
 * ponto fixo chega em poucas rodadas (duas, para a leitura de produção). O teto existe para que uma
 * leitura patológica derrube ESTE caso em vez de pendurar a suíte inteira.
 */
const LIMITE_DE_RODADAS_DA_OBSERVACAO = 50;

/**
 * Os nomes que a leitura CONSULTA na fonte, capturados enquanto ela executa.
 *
 * `fonte.NOME`, `fonte['NOME']` e a desestruturação passam todos pelo mesmo `get`, que é a razão de
 * a captura não depender de como o fonte está escrito.
 *
 * A observação é iterada até o **ponto fixo**, e não uma vez só, porque uma leitura que recusasse na
 * **primeira** ausência revelaria apenas a primeira consulta. A cada rodada, o espião entrega o que
 * já se sabe ser exigido e continua espiando o resto: a leitura avança um degrau e mostra a consulta
 * seguinte. `lerAmbiente` acumula os problemas — o `CT-006` prova isso —, então para ela a segunda
 * rodada já não acrescenta nada; a iteração é a rede para quem vier depois.
 */
function variaveisConsultadasPor(ler: LeituraDeAmbiente): readonly string[] {
  const consultadas = new Set<string>();

  for (let rodada = 0; rodada < LIMITE_DE_RODADAS_DA_OBSERVACAO; rodada += 1) {
    const conhecidas = consultadas.size;
    const espiao = new Proxy<Record<string, string | undefined>>(fonteDeclarando(consultadas), {
      get(alvo, chave) {
        if (typeof chave !== 'string') {
          return undefined;
        }
        consultadas.add(chave);

        return alvo[chave];
      },
    });

    try {
      ler(espiao);
    } catch {
      // Esperado enquanto faltar variável. O que interessa aqui é o que a leitura CONSULTOU.
    }

    if (consultadas.size === conhecidas) {
      return [...consultadas];
    }
  }

  throw new Error(
    `a observação não estabilizou em ${LIMITE_DE_RODADAS_DA_OBSERVACAO} rodadas: ${[...consultadas].join(', ')}`,
  );
}

/**
 * As variáveis que a partida EXIGE — o subconjunto das consultadas cuja **omissão** é recusada.
 *
 * O filtro por omissão é o que separa exigir de apenas ler: uma variável opcional, consultada e
 * tolerada quando ausente, não entra — e cobrá-la do provisionamento seria falso.
 */
function variaveisExigidasPor(ler: LeituraDeAmbiente): readonly string[] {
  const consultadas = variaveisConsultadasPor(ler);
  const declarandoTodas = fonteDeclarando(consultadas);

  return consultadas
    .filter((nome) => {
      const semEla = { ...declarandoTodas };
      delete semEla[nome];

      return recusa(ler, semEla);
    })
    .sort();
}

/** O arquivo de ambiente que as duas unidades carregam por `EnvironmentFile=`. */
const VARIAVEL_DO_ARQUIVO_DE_AMBIENTE = 'ARQ_AMBIENTE';

/** O destino de um redirecionamento de saída para variável (`>"${X}"` ou `>>"${X}"`). */
function destinoDeSaida(linha: string): string | undefined {
  return />>?\s*"\$\{([A-Za-z_][A-Za-z0-9_]*)\}"/.exec(linha)?.[1];
}

/**
 * O arquivo para onde uma linha de emissão escreve: o redirecionamento dela, ou o do bloco.
 *
 * A busca adiante para no **fechamento** do bloco (`}` ou `done`) e usa o destino dele — nunca
 * atravessa para o redirecionamento seguinte. É o que impede uma linha que escreve em `stdout` de
 * herdar o destino de um bloco alheio, que seria falso-negativo do detector.
 */
function destinoDaEmissao(linhas: readonly string[], indice: number): string | undefined {
  const proprio = destinoDeSaida(linhas[indice] ?? '');
  if (proprio !== undefined) {
    return proprio;
  }

  for (let adiante = indice + 1; adiante < linhas.length; adiante += 1) {
    const linha = linhas[adiante] ?? '';
    const inicio = linha.trimStart();
    if (inicio.startsWith('}') || inicio.startsWith('done')) {
      return destinoDeSaida(linha);
    }
  }

  return undefined;
}

/**
 * As chaves que o provisionamento EMITE **para o arquivo de ambiente**.
 *
 * Três descartes, e cada um fecha um jeito de o detector mentir que a chave foi entregue:
 *
 * 1. **Linha comentada** — o provisionador cita variáveis em comentário, inclusive a do
 *    `DÉBITO COM GATILHO — D39`, e um detector por menção aprovaria um script que apenas **fala**
 *    da variável sem gravá-la.
 * 2. **Menção sem escrita** — o casamento é sobre `printf 'CHAVE=`, a forma que grava.
 * 3. **Escrita para OUTRO arquivo** — `MIGRATION_DATABASE_URL` é gravada em
 *    `/etc/sysloc/migracao.env`, que **nenhuma** das duas unidades carrega; contá-la aprovaria uma
 *    variável exigida na partida e entregue a quem não a lê.
 *
 * ⚠️ O critério é o destino **literal** `${ARQ_AMBIENTE}`, e não o arquivo que o destino
 * eventualmente resolve. Consequência assumida: a semeadura de `garantir_chaves_de_conteudo`, que
 * escreve em `${arquivo}` (parâmetro), **não** conta como entrega. Isso é coerente com o que
 * {@link semCaminhoDeProvisionamento} afirma provar — a instalação de máquina nova, onde o arquivo
 * nasce do bloco `} >"${ARQ_AMBIENTE}"` — e erra para o lado ruidoso: uma chave que só fosse semeada
 * apareceria como desprovisionada, e nunca o contrário.
 */
function chavesEmitidasPor(fonteDoProvisionador: string): readonly string[] {
  const chaves = new Set<string>();
  const linhas = fonteDoProvisionador.split('\n');
  for (const [indice, linha] of linhas.entries()) {
    if (linha.trimStart().startsWith('#')) {
      continue;
    }
    if (destinoDaEmissao(linhas, indice) !== VARIAVEL_DO_ARQUIVO_DE_AMBIENTE) {
      continue;
    }
    for (const [, nome] of linha.matchAll(/printf '([A-Z][A-Z0-9_]*)=/g)) {
      chaves.add(nome as string);
    }
  }

  return [...chaves].sort();
}

/**
 * As chaves que a unidade `systemd` declara por `Environment=` — a **segunda** fonte legítima.
 *
 * Ela não é um detalhe de implementação, é a partição que as duas unidades documentam: o que
 * carrega credencial chega por `EnvironmentFile=` (o arquivo que o provisionamento grava, 0600,
 * fora da árvore), e o que é coordenada revisável chega por `Environment=` inline. `LOG_LEVEL` é
 * exigida na partida e vem por este caminho — um detector que só olhasse o provisionador a acusaria
 * como desprovisionada, que é falso.
 */
function chavesDeclaradasNaUnidade(fonteDaUnidade: string): readonly string[] {
  return [...fonteDaUnidade.matchAll(/^Environment=([A-Z][A-Z0-9_]*)=/gm)].map(
    ([, nome]) => nome as string,
  );
}

/** As chaves que o `.env.example` DECLARA — atribuição ancorada no início da linha. */
function chavesDeclaradasPor(fonteDoExemplo: string): readonly string[] {
  return [...fonteDoExemplo.matchAll(/^([A-Z][A-Z0-9_]*)=/gm)].map(([, nome]) => nome as string);
}

/**
 * O detector inteiro: as variáveis exigidas que **não** têm caminho de provisionamento.
 *
 * Uma variável está provisionada quando alguma das duas fontes a entrega — o arquivo de ambiente
 * que o script grava, ou a diretiva `Environment=` da unidade que executa este processo — **e** o
 * `.env.example` a documenta. A conjunção com o exemplo é deliberada: ele é o contrato versionado
 * que a mensagem de recusa de partida manda o operador consultar, e uma variável exigida que não
 * esteja lá manda o operador a um documento que não a menciona.
 *
 * ⚠️ **O que ele prova, e o que ele não prova.** Ele prova que a chave é ENTREGUE ao processo numa
 * instalação de máquina nova, que é onde o arquivo de ambiente nasce. Ele **não** prova o caminho
 * de atualização de um arquivo preexistente, e não poderia: esse caminho é legitimamente diferente
 * por chave. A `DATABASE_URL` ausente **aborta** de propósito (o script não sabe reconstruí-la sem
 * a credencial), a `REDIS_URL` e a `SMTP_URL` são acrescentadas pela conferência de coordenadas, e
 * a `EMAIL_REMETENTE` é semeada por `garantir_chaves_de_conteudo`, porque não é coordenada.
 */
function semCaminhoDeProvisionamento(
  exigidas: readonly string[],
  fonteDoProvisionador: string,
  fonteDaUnidade: string,
  fonteDoExemplo: string,
): readonly string[] {
  const entregues = new Set([
    ...chavesEmitidasPor(fonteDoProvisionador),
    ...chavesDeclaradasNaUnidade(fonteDaUnidade),
  ]);
  const documentadas = new Set(chavesDeclaradasPor(fonteDoExemplo));

  return exigidas.filter((nome) => !entregues.has(nome) || !documentadas.has(nome));
}

/** A variável que os mutantes desta seção acrescentam — nenhuma fonte real a entrega. */
const SEXTA_EXIGENCIA = 'WEBHOOK_SICOOB_SEGREDO';

/**
 * Um `lerAmbiente` HIPOTÉTICO com uma exigência a mais — o **mutante** desta prova.
 *
 * ⚠️ Ele não é oráculo de coisa alguma, e nenhum caso o compara com o SUT: é o análogo, do lado da
 * composição, das cópias em memória do provisionador que as outras provas de falsificação já usam.
 * Os casos que afirmam o estado do repositório exercitam {@link lerAmbiente}, sempre.
 *
 * A redação da recusa é PARÂMETRO porque é justamente o que a rodada anterior tratava como fixo.
 */
function leituraComSextaExigencia(redigirRecusa: (nome: string) => string): LeituraDeAmbiente {
  return (fonte) => {
    const problemas: string[] = [];
    for (const nome of [...VARIAVEIS_EXIGIDAS, SEXTA_EXIGENCIA]) {
      if ((fonte[nome] ?? '').trim() === '') {
        problemas.push(redigirRecusa(nome));
      }
    }
    if (problemas.length > 0) {
      throw new Error(problemas.join('; '));
    }

    return {};
  };
}

/** A mesma exigência a mais, lida por **desestruturação** e recusada sem nomear ninguém. */
const leituraComSextaPorDesestruturacao: LeituraDeAmbiente = (fonte) => {
  const { LOG_LEVEL, REDIS_URL, DATABASE_URL, SMTP_URL, EMAIL_REMETENTE, WEBHOOK_SICOOB_SEGREDO } =
    fonte;
  const declaradas = [
    LOG_LEVEL,
    REDIS_URL,
    DATABASE_URL,
    SMTP_URL,
    EMAIL_REMETENTE,
    WEBHOOK_SICOOB_SEGREDO,
  ];
  if (declaradas.some((valor) => (valor ?? '').trim() === '')) {
    throw new Error('configuração inválida na partida');
  }

  return {};
};

/**
 * Os quatro idiomas pelos quais a sexta exigência pode chegar — e o que cada um discrimina.
 *
 * Os três primeiros variam a **redação da recusa**, do formato de hoje até um que sequer escreve o
 * nome da variável em caixa alta; o quarto varia a **forma de leitura**. Uma derivação que lesse o
 * texto do fonte cairia no segundo; uma que lesse a mensagem de falha real cairia no terceiro.
 */
const IDIOMAS_DA_SEXTA_EXIGENCIA = [
  {
    idioma: 'a redação de hoje, montada por template',
    ler: leituraComSextaExigencia((nome) => `${nome}: ausente`),
  },
  {
    idioma: 'uma redação diferente da de hoje',
    ler: leituraComSextaExigencia((nome) => `faltou preencher ${nome}`),
  },
  {
    idioma: 'uma redação que nem escreve o nome da variável',
    ler: leituraComSextaExigencia((nome) => `[${nome.toLowerCase()}] não declarada`),
  },
  {
    idioma: 'leitura por desestruturação, sem redação nenhuma',
    ler: leituraComSextaPorDesestruturacao,
  },
] as const;

// DÉBITO COM GATILHO — D49 · F3/T10 · registrado 2026-08-12
// O QUÊ: a maquinaria que deriva o conjunto exigido e o caminho de provisionamento existe DUAS
//        vezes — a cópia privada deste arquivo (acima) e o lar canônico
//        `packages/shared/test/exigencia-de-ambiente.ts`, que a `api` consome desde o CT-639.
//        Endurecer uma deixa a outra para trás, e a suíte de cada processo fica verde sem a do
//        outro: a divergência não produz vermelho em lugar nenhum.
// QUANDO FECHA: quando a escalada ao usuário sobre o marcador `DECISÃO FECHADA — T8 / Gate 1
//        rodada 2` (logo acima) for feita e autorizar MOVER o bloco protegido para o lar
//        canônico — ou, antes disso, se um TERCEIRO processo precisar da maquinaria.
// POR QUE NÃO AGORA: o código a mover está sob aquele marcador, cujo `REVERTER EXIGE` não está
//        satisfeito, e a §3 item 2 da `.claude/rules/nao-regressao.md` proíbe nominalmente
//        MOVER código protegido. A T10 não precisava contrariá-lo para entregar a `api`.
// ÍNDICE: docs/specs/features/regua-de-cobranca/v1/_run/run-report.md §2, D49
//
// ⚠️ O lar canônico da maquinaria é `packages/shared/test/exigencia-de-ambiente.ts`. Qualquer
// endurecimento do detector precisa alcançar as DUAS cópias enquanto este débito estiver aberto.
describe('CT-643 (T8 · CA-17) — a exigência de partida e o provisionamento são o mesmo conjunto', () => {
  const fonteDoProvisionador = lerDoRepositorio(CAMINHO_DO_PROVISIONADOR);
  const fonteDaUnidade = lerDoRepositorio(CAMINHO_DA_UNIDADE_DESTE_PROCESSO);
  const fonteDoExemplo = lerDoRepositorio(CAMINHO_DO_EXEMPLO);
  const exigidas = variaveisExigidasPor(lerAmbiente);

  it('CT-643 — o conjunto derivado da EXECUÇÃO é igual ao que as tabelas de caso exercitam', () => {
    // Âncora antivácuo do lado da exigência, e ela vale por si: sem esta igualdade, uma variável
    // acrescentada a `lerAmbiente` e esquecida em `VARIAVEIS_EXIGIDAS` ficaria fora das duas
    // tabelas de caso deste arquivo **sem que nada acusasse** — que é o que o docblock daquela
    // constante afirma e que, até esta rodada, não era asserido em lugar nenhum.
    expect(exigidas).toEqual([...VARIAVEIS_EXIGIDAS].sort());
  });

  it('CT-643 — o conjunto derivado BASTA: declarando só ele, a partida é ACEITA', () => {
    // Esta é a asserção que torna a derivação COMPLETA por prova, e não por inspeção de texto: se
    // `lerAmbiente` exigisse qualquer coisa que a derivação não enxerga — outra redação, outra
    // forma de leitura, uma consulta que nem passa pela fonte —, esta chamada seria recusada, e a
    // mensagem da recusa nomearia o que faltou. É por isso que nenhuma redação futura escapa.
    expect(() => lerAmbiente(fonteDeclarando(exigidas))).not.toThrow();
  });

  it('CT-643 — NENHUMA variável exigida fica sem caminho de provisionamento', () => {
    // A lista das culpadas, e não um booleano: quando reprovar, a mensagem nomeia a variável.
    expect(
      semCaminhoDeProvisionamento(exigidas, fonteDoProvisionador, fonteDaUnidade, fonteDoExemplo),
    ).toEqual([]);
  });

  it('CT-643 — o detector SABE dizer que sim e que não (testemunhas medidas)', () => {
    const emitidas = chavesEmitidasPor(fonteDoProvisionador);

    // Testemunhas POSITIVAS das duas fontes: as três cadeias que o provisionamento grava no arquivo
    // de ambiente, e a severidade, que chega pela diretiva da unidade.
    expect(emitidas).toContain('DATABASE_URL');
    expect(emitidas).toContain('REDIS_URL');
    expect(emitidas).toContain('SMTP_URL');
    expect(chavesDeclaradasNaUnidade(fonteDaUnidade)).toContain('LOG_LEVEL');

    // Testemunha NEGATIVA, e ela é o que separa este caso de uma tautologia: `BETTER_AUTH_SECRET` é
    // EXIGIDA na partida da API e **nenhuma** das duas fontes a entrega — é o `DÉBITO COM GATILHO —
    // D39`, aberto por decisão registrada. Um detector que respondesse "sim" para tudo aprovaria
    // aqui, e é por isso que a asserção é `not.toContain`, sobre as duas fontes daquele processo.
    //
    // ⚠️ Esta linha NÃO fecha o D39, e não deve ser lida como se o fechasse: quando ele for
    // fechado, esta asserção reprova, e a correção é trocar a testemunha negativa por outra
    // variável comprovadamente não provisionada — jamais apagar a testemunha.
    const fontesDaApi = [
      ...emitidas,
      ...chavesDeclaradasNaUnidade(lerDoRepositorio('deploy/systemd/sysloc-api.service')),
    ];
    expect(fontesDaApi).not.toContain('BETTER_AUTH_SECRET');
  });

  it('CT-643 (b) — PROVA DE FALSIFICAÇÃO: sem a emissão, o detector nomeia a variável', () => {
    // O mutante é a rodada anterior desta task: `EMAIL_REMETENTE` exigida na partida e nenhuma
    // linha do provisionamento a gravando.
    const semAEmissao = fonteDoProvisionador.replaceAll(/^.*printf 'EMAIL_REMETENTE=.*$/gm, '');

    expect(semAEmissao).not.toEqual(fonteDoProvisionador);
    expect(
      semCaminhoDeProvisionamento(exigidas, semAEmissao, fonteDaUnidade, fonteDoExemplo),
    ).toEqual(['EMAIL_REMETENTE']);
  });

  it.each(IDIOMAS_DA_SEXTA_EXIGENCIA)(
    'CT-643 (b) — PROVA DE FALSIFICAÇÃO: exigência NOVA reprova — $idioma',
    ({ ler }) => {
      // O caminho por onde o defeito volta: a T10 leva a API a exigir as mesmas variáveis, e toda
      // fatia seguinte pode acrescentar a sexta. Uma exigência nova sem caminho de provisionamento
      // precisa reprovar **sozinha**, sem ninguém se lembrar de acrescentá-la a lista nenhuma — e
      // qualquer que seja o idioma com que ela for escrita, que é o que esta tabela varre.
      const exigidasPeloMutante = variaveisExigidasPor(ler);

      expect(exigidasPeloMutante).toContain(SEXTA_EXIGENCIA);
      expect(
        semCaminhoDeProvisionamento(
          exigidasPeloMutante,
          fonteDoProvisionador,
          fonteDaUnidade,
          fonteDoExemplo,
        ),
      ).toEqual([SEXTA_EXIGENCIA]);
      // E a âncora antivácuo também reprova, o que é o segundo aviso pelo mesmo defeito.
      expect(exigidasPeloMutante).not.toEqual([...VARIAVEIS_EXIGIDAS].sort());
    },
  );

  it('CT-643 (b) — PROVA DE FALSIFICAÇÃO: exigência que NÃO passa pela fonte reprova', () => {
    // O último caminho da classe: uma exigência que a derivação não tem como observar, porque ela
    // não consulta a fonte. Aqui a igualdade antivácuo fica CALADA de propósito — quem pega é a
    // guarda de completude, e é ela que faz "toda redação futura" ser uma afirmação e não um voto
    // de confiança.
    //
    // O mutante recusa na PRIMEIRA ausência, e isso é conteúdo: uma observação de uma rodada só
    // enxergaria `LOG_LEVEL` e nada mais, e a igualdade acima reprovaria por um defeito que não
    // existe. É o caso que obriga a observação a iterar até o ponto fixo.
    const nomeEscondido = 'SEGREDO_LIDO_PELAS_COSTAS';
    expect(process.env[nomeEscondido]).toBeUndefined();
    const leituraQueOlhaPeloLado: LeituraDeAmbiente = (fonte) => {
      for (const nome of VARIAVEIS_EXIGIDAS) {
        if ((fonte[nome] ?? '').trim() === '') {
          throw new Error(`${nome}: ausente`);
        }
      }
      if ((process.env[nomeEscondido] ?? '').trim() === '') {
        throw new Error('configuração inválida na partida');
      }

      return {};
    };

    const derivadas = variaveisExigidasPor(leituraQueOlhaPeloLado);

    expect(derivadas).toEqual([...VARIAVEIS_EXIGIDAS].sort());
    expect(() => leituraQueOlhaPeloLado(fonteDeclarando(derivadas))).toThrowError(Error);
  });

  it('CT-643 (b) — PROVA DE FALSIFICAÇÃO: menção em comentário NÃO conta como emissão', () => {
    // O detector por menção — a versão ingênua — aprovaria um provisionamento que apenas FALA da
    // variável. É o modo de falha que a `.claude/rules/testing-stack.md` registra como
    // *"asserção que casava `ALTER ROLE` em comentário"*.
    const soEmComentario = fonteDoProvisionador
      .replaceAll(/^.*printf 'EMAIL_REMETENTE=.*$/gm, '')
      .concat('\n# printf \'EMAIL_REMETENTE=%s\\n\' "$REMETENTE_PADRAO_DO_AVISO"\n');

    expect(
      semCaminhoDeProvisionamento(exigidas, soEmComentario, fonteDaUnidade, fonteDoExemplo),
    ).toEqual(['EMAIL_REMETENTE']);
  });

  it('CT-643 (b) — PROVA DE FALSIFICAÇÃO: emissão para OUTRO arquivo não conta como entrega', () => {
    // A direção perigosa da imprecisão é o falso-NEGATIVO: uma chave exigida na partida, gravada
    // apenas em `/etc/sysloc/migracao.env` — que nenhuma das duas unidades carrega —, seria dada
    // por entregue e o processo recusaria a subida assim mesmo. O par positivo/negativo é o que
    // discrimina: o MESMO bloco redirecionado para `${ARQ_AMBIENTE}` conta.
    const semAEmissao = fonteDoProvisionador.replaceAll(/^.*printf 'EMAIL_REMETENTE=.*$/gm, '');
    const emUmBlocoPara = (destino: string): string =>
      `${semAEmissao}\ngravar() {\n\tprintf 'EMAIL_REMETENTE=%s\\n' "\${REMETENTE_PADRAO_DO_AVISO}"\n} >"\${${destino}}"\n`;

    const paraOArquivoDaMigracao = emUmBlocoPara('ARQ_AMBIENTE_MIGRACAO');
    expect(chavesEmitidasPor(paraOArquivoDaMigracao)).not.toContain('EMAIL_REMETENTE');
    expect(
      semCaminhoDeProvisionamento(exigidas, paraOArquivoDaMigracao, fonteDaUnidade, fonteDoExemplo),
    ).toEqual(['EMAIL_REMETENTE']);

    const paraOArquivoDeAmbiente = emUmBlocoPara('ARQ_AMBIENTE');
    expect(chavesEmitidasPor(paraOArquivoDeAmbiente)).toContain('EMAIL_REMETENTE');
    expect(
      semCaminhoDeProvisionamento(exigidas, paraOArquivoDeAmbiente, fonteDaUnidade, fonteDoExemplo),
    ).toEqual([]);
  });
});

// ===========================================================================
// CT-644 — a soma dos prazos de desligamento cabe dentro do prazo do supervisor
// ===========================================================================

/**
 * Os dois prazos declarados no fonte, e a unidade que os limita — **três termos, três arquivos**.
 *
 * A aritmética é simples e está certa hoje (15 s + 5 s < 30 s). O que faltava era **rede**: os três
 * números moram em arquivos que nada liga, e nenhum caso nem verificador lia o `TimeoutStopSec` das
 * unidades. Baixar o `TimeoutStopSec` para 20 s, ou subir um dos dois prazos, inverteria quem
 * desiste primeiro — e quem desiste primeiro é conteúdo: com o processo desistindo, o journal
 * recebe a linha que explica o que ficou para trás; com o supervisor desistindo, chega `SIGKILL`,
 * a tarefa em voo é abandonada sem registro (o que a CA-10 existe para impedir) e a unidade vai
 * para `failed`.
 *
 * ⚠️ Os valores são lidos do **fonte** por `fs`, e não importados. Exportar
 * `LIMITE_DE_DESLIGAMENTO_MS` e `LIMITE_DE_DEVOLUCAO_DA_RESERVA_MS` só para esta asserção enxergá-los
 * criaria símbolo de produção a serviço do teste — o seam que a disciplina do executor proíbe. É o
 * mesmo molde de varredura do `CT-612`.
 */
const UNIDADES_DO_SUPERVISOR = [
  'deploy/systemd/sysloc-worker.service',
  'deploy/systemd/sysloc-api.service',
] as const;

/** Lê uma constante de prazo em milissegundos declarada no fonte (aceita o separador `_`). */
function prazoDeclaradoEm(fonte: string, constante: string): number | undefined {
  const achado = new RegExp(`${constante} = ([0-9_]+)`).exec(fonte);

  return achado?.[1] === undefined ? undefined : Number(achado[1].replaceAll('_', ''));
}

/** Lê o `TimeoutStopSec=` de uma unidade `systemd`, em milissegundos. */
function prazoDoSupervisorEm(fonteDaUnidade: string): number | undefined {
  const achado = /^TimeoutStopSec=([0-9]+)$/m.exec(fonteDaUnidade);

  return achado?.[1] === undefined ? undefined : Number(achado[1]) * 1_000;
}

/** As unidades cujo prazo NÃO comporta a soma declarada — a lista que precisa ser `[]`. */
function unidadesComPrazoInsuficiente(
  somaDosPrazosMs: number,
  unidades: ReadonlyMap<string, string>,
): readonly string[] {
  return [...unidades]
    .filter(([, fonte]) => {
      const limite = prazoDoSupervisorEm(fonte);

      return limite === undefined || somaDosPrazosMs >= limite;
    })
    .map(([nome]) => nome);
}

describe('CT-644 (T8 · CA-10) — quem desiste primeiro é o processo, não o supervisor', () => {
  const fontesDasUnidades = new Map<string, string>(
    UNIDADES_DO_SUPERVISOR.map((caminho) => [caminho, lerDoRepositorio(caminho)]),
  );
  const prazoDaFila = prazoDeclaradoEm(
    lerDoRepositorio('apps/worker/src/fila.ts'),
    'LIMITE_DE_DESLIGAMENTO_MS',
  );
  const prazoDaReserva = prazoDeclaradoEm(
    lerDoRepositorio(CAMINHO_DA_COMPOSICAO),
    'LIMITE_DE_DEVOLUCAO_DA_RESERVA_MS',
  );

  it('CT-644 — os três termos foram efetivamente LIDOS, e não assumidos', () => {
    // Âncora antivácuo: um `undefined` silencioso — constante renomeada, `TimeoutStopSec` removido
    // do arquivo — faria a desigualdade abaixo comparar contra nada.
    expect(prazoDaFila).toBe(15_000);
    expect(prazoDaReserva).toBe(5_000);
    expect(
      [...fontesDasUnidades].map(([nome, fonte]) => [nome, prazoDoSupervisorEm(fonte)]),
    ).toEqual(UNIDADES_DO_SUPERVISOR.map((nome) => [nome, 30_000]));
  });

  it('CT-644 — a soma dos prazos cabe no `TimeoutStopSec` das DUAS unidades', () => {
    expect(
      unidadesComPrazoInsuficiente((prazoDaFila ?? 0) + (prazoDaReserva ?? 0), fontesDasUnidades),
    ).toEqual([]);
  });

  it('CT-644 (b) — PROVA DE FALSIFICAÇÃO: soma acima do prazo reprova nomeando as unidades', () => {
    // 31 s contra os 30 s declarados — um segundo além, que é o menor mutante que discrimina.
    expect(unidadesComPrazoInsuficiente(31_000, fontesDasUnidades)).toEqual([
      ...UNIDADES_DO_SUPERVISOR,
    ]);
    // E a igualdade também é discriminada: empatar já é tarde, porque o supervisor conta a partir
    // do sinal e o processo só começa a contar depois de recebê-lo.
    expect(unidadesComPrazoInsuficiente(30_000, fontesDasUnidades)).toEqual([
      ...UNIDADES_DO_SUPERVISOR,
    ]);
  });

  it('CT-644 (b) — PROVA DE FALSIFICAÇÃO: unidade sem `TimeoutStopSec` reprova', () => {
    // O outro caminho pelo qual a desigualdade ficaria sem objeto: a unidade deixar de declarar o
    // prazo e passar a herdar o padrão do sistema, que nada aqui conhece.
    const semDeclaracao = new Map([
      ['unidade-sintetica.service', 'Restart=always\nTimeoutStartSec=30\n'],
    ]);

    expect(unidadesComPrazoInsuficiente(1_000, semDeclaracao)).toEqual([
      'unidade-sintetica.service',
    ]);
  });
});
