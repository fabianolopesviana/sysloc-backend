/**
 * Validação das variáveis de ambiente na partida — T5 da fatia `fundacao-stack-nativa`.
 *
 * ---------------------------------------------------------------------------
 * INVARIANTES
 * ---------------------------------------------------------------------------
 *
 * | Critério | Caso | Invariante |
 * |---|---|---|
 * | CA-15 | CT-007 | Faltando variável exigida, `carregarAmbiente` FALHA e a mensagem contém o
 * |       |        | nome literal de CADA variável ausente — nunca uma mensagem genérica, e
 * |       |        | nunca devolvendo configuração. |
 * | CA-15 | CT-008 | Com todas presentes, devolve a configuração com cada valor derivado da SUA
 * |       |        | variável de origem e já convertido para o tipo declarado no esquema. |
 * | CA-17 | CT-639 | A barreira FALHA FECHADO **também na `api`**: sem `SMTP_URL` ou sem
 * |       |        | `EMAIL_REMETENTE` — ausentes ou em branco —, `carregarAmbiente` recusa a
 * |       |        | partida nomeando a variável e NUNCA devolve ambiente parcial; com todas
 * |       |        | declaradas, devolve o ambiente por `toStrictEqual`. O conjunto exigido —
 * |       |        | **observado na execução**, nunca lido no texto do fonte — é igual a
 * |       |        | {@link VARIAVEIS_EXIGIDAS}, **basta** para a partida ser aceita, e a lista das
 * |       |        | que nenhuma fonte de provisionamento entrega é exatamente
 * |       |        | `['BETTER_AUTH_SECRET']` — o `D39`, aberto por decisão registrada —, o que
 * |       |        | torna a asserção uma **testemunha medida** em vez de um `[]` vácuo.
 * |       |        | **PROVAS DE FALSIFICAÇÃO permanentes**: uma exigência a mais escrita por dois
 * |       |        | idiomas diferentes, e a emissão de `SMTP_URL` removida do provisionador. |
 *
 * Rastreabilidade acrescida pela T10: `CA-17 → CT-639 (RD-15)`.
 *
 * A fonte de variáveis é PARÂMETRO da função (Padrão 14: fail-fast testável). Um único caso planta
 * valor em `process.env` — o que PROVA que o ambiente do processo não prevalece sobre a fonte — e
 * ele restaura o valor anterior ao terminar. Nos demais, mutação global só quebraria a
 * independência entre casos.
 *
 * ---------------------------------------------------------------------------
 * Por que o CT-639 existe, e por que ele NÃO é redundante com o CT-625 do worker
 * ---------------------------------------------------------------------------
 *
 * A barreira da CA-17 deixou de ser propriedade de **um** processo no instante em que o disparo
 * manual passou a enviar de dentro da `api` (§5.1-C do tech spec da fatia). Sem este caso, este
 * processo ganharia o poder de alcançar a caixa de uma pessoa real **sem uma única asserção** de que
 * ele recusa a partida sem transporte declarado — e a prova ficaria só indireta, pelo `CT-626`, que
 * mede outra coisa (que a suíte não alcança o adaptador de produção).
 *
 * Aqui o modo perigoso é o **inverso** do habitual: um transporte construído a partir de cadeia vazia
 * aponta para o `localhost` que a biblioteca assume por omissão, e o erro não é reversível — mensagem
 * entregue não volta. Por isso `falhaDe` **reprova quando a chamada devolve configuração**: um
 * `carregarAmbiente` que devolvesse `{ …, urlDoTransporte: '' }` cairia ali.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, onTestFinished } from 'vitest';
// DÉBITO COM GATILHO — D28 · F0/T5 · gatilho JÁ DISPARADO (F1/T2, 2026-08-02)
// (NÃO é uma `DECISÃO FECHADA`: ele agenda uma mudança, não protege o código abaixo.)
// O QUÊ: o import a seguir atravessa a fronteira de `@sysloc/shared` por CAMINHO DE ARQUIVO, fora do
//        `exports` e do `files` daquele manifesto. A dependência de workspace está declarada, então
//        não há dependência oculta; o que não existe é FRONTEIRA para os diretórios `test/`.
// QUANDO FECHA: o gatilho já disparou e o fechamento segue pendente; ele é o mesmo de sempre —
//        declarar o subpath `"./test"` no manifesto e importar por `@sysloc/shared/test`, ou extrair
//        um `@sysloc/test-utils`.
// POR QUE NÃO AGORA: fechar exige editar o manifesto do pacote e todos os consumidores, nenhum deles
//        no escopo desta task, e o índice de débitos do `CLAUDE.md`.
// ÍNDICE: docs/specs/features/fundacao-stack-nativa/v1/_run/run-report.md §2, D28
import {
  chavesDeclaradasNaUnidade,
  chavesDeclaradasPor,
  chavesEmitidasPor,
  fonteDeclarando,
  type LeituraDeAmbiente,
  semCaminhoDeProvisionamento,
  variaveisExigidasPor,
} from '../../../packages/shared/test/exigencia-de-ambiente.ts';
import {
  type Ambiente,
  carregarAmbiente,
  VARIAVEIS_EXIGIDAS,
} from '../src/configuracao/ambiente.ts';

/** Porta em texto, distinguível de qualquer valor padrão — o teste prova que ela vira número. */
const PORTA_EM_TEXTO = '31337';

/** Senha embutida na cadeia de conexão do banco, para provar que a falha não a ecoa. */
const SENHA_NA_CADEIA = 'segredoQueNaoPodeVazar';

/**
 * Segredo de assinatura de sessão válido — 32 caracteres, o piso que a partida exige.
 *
 * Distinguível de qualquer outro valor da tabela pelo mesmo motivo dos demais: com valores
 * parecidos, um campo da configuração alimentado pela variável errada passaria despercebido.
 */
const SEGREDO_DE_SESSAO = 'segredoDeSessaoCom32Caracteres!!';

/**
 * Segredo curto demais, e igualmente distinguível: ele é o valor que a mensagem de falha NÃO pode
 * conter. A mensagem vai para o journal, e este valor assina toda sessão em curso.
 */
const SEGREDO_CURTO = 'curtoDemaisParaAssinarSessao';

/**
 * Ambiente completo e válido, com valor único por variável.
 *
 * Valores distinguíveis são o que permite afirmar que nenhum campo da configuração recebeu o
 * valor de outra variável — com valores parecidos, uma troca de campos passaria despercebida.
 */
function ambienteCompleto(): Record<string, string> {
  return {
    NODE_ENV: 'production',
    PORT: PORTA_EM_TEXTO,
    LOG_LEVEL: 'warn',
    DATABASE_URL: `postgresql://usuarioct008:${SENHA_NA_CADEIA}@127.0.0.1:15433/bancoct008`,
    REDIS_URL: 'redis://127.0.0.1:16399',
    BETTER_AUTH_SECRET: SEGREDO_DE_SESSAO,
    // As DUAS do transporte entram na T10 — ver o bloco do CT-639, no fim do arquivo. A cadeia do
    // servidor carrega a MESMA senha das outras, de propósito: a asserção de não-vazamento passa a
    // valer para ela de graça, e uma mensagem que a ecoasse reprova.
    SMTP_URL: `smtps://avisos:${SENHA_NA_CADEIA}@smtp.exemplo.invalid:465`,
    EMAIL_REMETENTE: 'avisos@exemplo.invalid',
    // A variável do link de confirmação entra na T9 da fatia `documentos-e-confirmacao`. Ela NÃO é
    // segredo — é o endereço público do aplicativo —, e o valor é distinguível dos demais pela
    // mesma razão de todos: um campo da configuração alimentado pela variável errada passaria
    // despercebido com valores parecidos.
    URL_BASE_DA_CONFIRMACAO: 'https://app.exemplo.invalid',
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

/** Executa a carga e devolve a falha, ou reprova se a chamada tiver devolvido configuração. */
function falhaDe(fonte: Record<string, string>): Error {
  let devolvido: Ambiente | undefined;
  try {
    devolvido = carregarAmbiente(fonte);
  } catch (erro) {
    expect(erro).toBeInstanceOf(Error);
    return erro as Error;
  }
  throw new Error(
    `carregarAmbiente devolveu configuração onde deveria ter falhado: ${JSON.stringify(devolvido)}`,
  );
}

describe('carregarAmbiente (T5 · CA-15)', () => {
  // A tabela vem da lista do PRÓPRIO esquema do código sob teste: variável nova passa a ser
  // exercitada sem ninguém lembrar de acrescentá-la aqui.
  it.each(VARIAVEIS_EXIGIDAS.map((nome) => ({ nome })))(
    'CT-007 — sem $nome, a carga falha e a mensagem nomeia a variável ausente',
    ({ nome }) => {
      const falha = falhaDe(ambienteSem(nome));

      expect(falha.message).toContain(nome);
      expect(falha.message).toContain('ausente');
    },
  );

  it('CT-007 — variável presente e vazia conta como ausente e é nomeada', () => {
    const fonte = { ...ambienteCompleto(), PORT: '   ' };

    const falha = falhaDe(fonte);

    // Um arquivo copiado do `.env.example` sem preenchimento entrega cadeias vazias; a falha tem
    // de dizer "não foi preenchida", e não "não é um número".
    expect(falha.message).toContain('PORT: ausente');
  });

  it('CT-007 — faltando duas variáveis, a mensagem nomeia AS DUAS', () => {
    // Validação que para na primeira ausência esconde configuração incompleta e obriga uma
    // rodada de partida por variável faltante.
    const falha = falhaDe(ambienteSem('DATABASE_URL', 'REDIS_URL'));

    expect(falha.message).toContain('DATABASE_URL');
    expect(falha.message).toContain('REDIS_URL');
  });

  it('CT-007 — cadeia de conexão com esquema errado falha nomeando a variável, sem ecoar a senha', () => {
    // `provisionar-base.sh` grava e exige `postgresql://`; aceitar `postgres://` aqui deixaria de
    // pé um arquivo que a aplicação lê e o provisionamento recusa (débito D7).
    const fonte = ambienteCompleto();
    fonte.DATABASE_URL = `postgres://usuarioct007:${SENHA_NA_CADEIA}@127.0.0.1:15433/bancoct007`;

    const falha = falhaDe(fonte);

    expect(falha.message).toContain('DATABASE_URL');
    expect(falha.message).toContain('postgresql://');
    // A mensagem vai para o journal: ecoar o valor recebido publicaria a senha do banco.
    expect(falha.message).not.toContain(SENHA_NA_CADEIA);
  });

  it('CT-007 — segredo de sessão curto demais falha nomeando a variável, sem ecoar o valor', () => {
    // O par positivo/negativo desta variável: a ausência já é coberta pela tabela acima, que deriva
    // do próprio esquema. O que falta é o valor PRESENTE e inaceitável — sem ele, um esquema que
    // apenas exigisse a variável (sem piso de comprimento) passaria, e o serviço subiria assinando
    // sessão com um segredo de meia dúzia de caracteres.
    const fonte = { ...ambienteCompleto(), BETTER_AUTH_SECRET: SEGREDO_CURTO };

    const falha = falhaDe(fonte);

    expect(falha.message).toContain('BETTER_AUTH_SECRET');
    expect(falha.message).toContain('caracteres');
    // A mensagem vai para o journal; este valor assina toda sessão em curso.
    expect(falha.message).not.toContain(SEGREDO_CURTO);
    // E não é confundida com ausência: a variável foi preenchida, só que com valor inaceitável.
    expect(falha.message).not.toContain('BETTER_AUTH_SECRET: ausente');
  });

  it('CT-008 — com todas as variáveis presentes, devolve a configuração tipada com os valores lidos', () => {
    const fonte = ambienteCompleto();

    const ambiente = carregarAmbiente(fonte);

    // A conversão de tipo é a transformação que o código sob teste realiza: a porta chega como
    // texto e sai como número.
    expect(ambiente.porta).toBe(31337);
    expect(typeof ambiente.porta).toBe('number');
    expect(fonte.PORT).toBe(PORTA_EM_TEXTO);

    // Cada campo vale exatamente o valor da SUA variável de origem.
    expect(ambiente.ambiente).toBe('production');
    expect(ambiente.nivelDeLog).toBe('warn');
    expect(ambiente.cadeiaConexaoBanco).toBe(fonte.DATABASE_URL);
    expect(ambiente.cadeiaConexaoFila).toBe(fonte.REDIS_URL);
    expect(ambiente.cadeiaConexaoBanco).not.toBe(ambiente.cadeiaConexaoFila);
    expect(ambiente.segredoDeSessao).toBe(fonte.BETTER_AUTH_SECRET);
    expect(ambiente.urlDoTransporte).toBe(fonte.SMTP_URL);
    expect(ambiente.remetenteDoAviso).toBe(fonte.EMAIL_REMETENTE);
    // SUT_IS_CORRECT_BECAUSE: a rodada 1 da T9 publicava `urlBaseDaConfirmacao` como campo, e o
    // Gate 2 mediu que NENHUM código da `api` o lê — quem compõe o link é o processador de trabalho
    // (T10). O código de produção está certo agora: `URL_BASE_DA_CONFIRMACAO` segue EXIGIDA na
    // partida (completude do arquivo de ambiente, que é um só para as duas unidades) e deixou de
    // virar campo. A asserção de igualdade não foi removida — foi **substituída pela negativa que
    // discrimina**, e esta reprova se o valor voltar a atravessar para a configuração publicada.
    expect(Object.values(ambiente)).not.toContain(fonte.URL_BASE_DA_CONFIRMACAO);
  });

  it('CT-008 — o ambiente do processo não é lido, e o que não é exigido não entra na configuração', () => {
    const fonte = {
      ...ambienteCompleto(),
      VARIAVEL_ALHEIA: 'nao-deve-atravessar',
    };

    // A primeira metade do invariante, que sem isto o nome do caso prometia sem provar: o ambiente
    // do PROCESSO recebe, para a mesma variável, valor divergente do que a fonte declara. Uma
    // leitura de `process.env` que PREVALECESSE sobre a fonte devolveria `trace` aqui — e o serviço
    // passaria a registrar num nível que ninguém configurou. (A outra forma de vazamento, uma
    // leitura que apenas COMPLETASSE o que a fonte não trouxe, é morta pelo CT-007: com ela,
    // remover uma variável da fonte deixaria de falhar.) Verificado por mutação nas duas formas.
    const anterior = process.env.LOG_LEVEL;
    process.env.LOG_LEVEL = 'trace';
    onTestFinished(() => {
      if (anterior === undefined) {
        delete process.env.LOG_LEVEL;
      } else {
        process.env.LOG_LEVEL = anterior;
      }
    });

    const ambiente = carregarAmbiente(fonte);

    expect(ambiente.nivelDeLog).toBe('warn');
    expect(ambiente.nivelDeLog).not.toBe(process.env.LOG_LEVEL);
    expect(Object.values(ambiente)).not.toContain('nao-deve-atravessar');
    // SUT_IS_CORRECT_BECAUSE: esta é uma ENUMERAÇÃO EXAUSTIVA dos campos de `Ambiente`, e a T8
    // acrescenta um campo por especificação (§3.6 da tech spec da fatia: "nova variável exigida:
    // segredo de assinatura de sessão"). O literal foi escrito contra um esquema de cinco
    // variáveis; o código de produção está certo e o valor esperado tinha de crescer junto. A
    // asserção NÃO foi afrouxada — segue sendo igualdade exata sobre o conjunto inteiro, com um
    // elemento a mais, e continua reprovando qualquer campo que apareça sem ser declarado.
    //
    // SUT_IS_CORRECT_BECAUSE: a **T10** da fatia `regua-de-cobranca` acrescenta OUTROS DOIS campos,
    // `urlDoTransporte` e `remetenteDoAviso`, e pela mesma natureza: o disparo manual envia de
    // dentro deste processo (§5.1-C do tech spec da fatia), que passa a ser o SEGUNDO capaz de
    // alcançar a caixa de uma pessoa, e a barreira de partida da CA-17 vale para os dois. O código
    // de produção está certo e o literal é que descrevia o processo anterior. A asserção continua
    // sendo igualdade exata sobre o conjunto inteiro — **nenhum elemento saiu** —, e por isso ela
    // segue reprovando campo que apareça sem ser declarado.
    //
    // SUT_IS_CORRECT_BECAUSE: a rodada 1 da **T9** da fatia `documentos-e-confirmacao` acrescentara
    // aqui o campo `urlBaseDaConfirmacao`, e o Gate 2 mediu que ele **não tem consumidor** na `api`
    // — quem compõe o link é o processador de trabalho (T10). O código de produção está certo agora:
    // `URL_BASE_DA_CONFIRMACAO` continua EXIGIDA na partida, por completude do arquivo de ambiente
    // compartilhado (§16.3 da tech spec), e deixou de ser publicada como campo. Este é o ÚNICO
    // elemento que sai deste literal, e ele sai porque o campo deixou de existir — a asserção segue
    // sendo igualdade exata sobre o conjunto inteiro, e por isso ela reprova tanto um campo novo não
    // declarado quanto a volta deste.
    expect(Object.keys(ambiente).sort()).toEqual([
      'ambiente',
      'cadeiaConexaoBanco',
      'cadeiaConexaoFila',
      'nivelDeLog',
      'porta',
      'remetenteDoAviso',
      'segredoDeSessao',
      'urlDoTransporte',
    ]);
  });
});

// ===========================================================================
// CT-639 — a barreira FALHA FECHADO também na `api` (T10 · CA-17)
// ===========================================================================

/**
 * As quatro linhas inválidas da barreira, com a variável que cada uma deve nomear.
 *
 * A tabela é declarada ANTES do caso e nomeia o resultado esperado de cada linha — ela **não** é
 * derivada da execução. As duas primeiras são a **ausência**; as duas últimas são a cadeia em branco,
 * que é o que um `EnvironmentFile` copiado do `.env.example` sem preenchimento entrega, e que a
 * versão ingênua desta validação (`fonte.SMTP_URL !== undefined`) aceitaria.
 */
const LINHAS_DO_TRANSPORTE = [
  { cenario: 'sem SMTP_URL', ausente: 'SMTP_URL', embranco: undefined },
  { cenario: 'sem EMAIL_REMETENTE', ausente: 'EMAIL_REMETENTE', embranco: undefined },
  { cenario: 'SMTP_URL em branco', ausente: 'SMTP_URL', embranco: 'SMTP_URL' },
  { cenario: 'EMAIL_REMETENTE em branco', ausente: 'EMAIL_REMETENTE', embranco: 'EMAIL_REMETENTE' },
] as const;

/** O ambiente completo, já traduzido para os campos que a configuração publica. */
function configuracaoEsperada(fonte: Record<string, string>): Record<string, string | number> {
  return {
    ambiente: fonte.NODE_ENV as string,
    porta: Number(fonte.PORT),
    nivelDeLog: fonte.LOG_LEVEL as string,
    cadeiaConexaoBanco: fonte.DATABASE_URL as string,
    cadeiaConexaoFila: fonte.REDIS_URL as string,
    segredoDeSessao: fonte.BETTER_AUTH_SECRET as string,
    urlDoTransporte: fonte.SMTP_URL as string,
    remetenteDoAviso: fonte.EMAIL_REMETENTE as string,
    // `URL_BASE_DA_CONFIRMACAO` NÃO entra: ela é exigida na partida e não vira campo — ver o
    // `SUT_IS_CORRECT_BECAUSE:` do CT-008.
  };
}

/** A raiz da árvore versionada — o mesmo idioma de `packages/db/test/barreira-de-envio.spec.ts`. */
const RAIZ_DO_REPOSITORIO = fileURLToPath(new URL('../../../', import.meta.url));

/** O script que CRIA o `/etc/sysloc/backend.env` numa instalação de máquina nova. */
const CAMINHO_DO_PROVISIONADOR = 'deploy/scripts/instalacao/provisionar-base.sh';

/** A unidade `systemd` que executa ESTE processo — a segunda fonte legítima de variável. */
const CAMINHO_DA_UNIDADE_DESTE_PROCESSO = 'deploy/systemd/sysloc-api.service';

/** O arquivo versionado que DOCUMENTA o que cada variável é. */
const CAMINHO_DO_EXEMPLO = '.env.example';

function lerDoRepositorio(relativo: string): string {
  return readFileSync(`${RAIZ_DO_REPOSITORIO}${relativo}`, 'utf8');
}

/**
 * A variável exigida por este processo que **nenhuma** fonte de provisionamento entrega.
 *
 * É o `DÉBITO COM GATILHO — D39 · F1/fechamento`, aberto por decisão registrada: o provisionamento
 * não gera `BETTER_AUTH_SECRET`, e a `api` não sobe numa instalação do zero. Ele é declarado aqui
 * como **valor esperado**, e não filtrado do conjunto: é a testemunha que separa este caso de uma
 * tautologia — um detector que respondesse "provisionada" para tudo devolveria `[]` e reprovaria.
 *
 * ⚠️ Esta constante NÃO fecha o D39. Quando ele for fechado, o caso abaixo reprova, e a correção é
 * trocar o valor esperado por `[]` — **jamais** afrouxar a igualdade para `toContain`.
 */
const EXIGIDAS_SEM_PROVISIONAMENTO = ['BETTER_AUTH_SECRET'];

/** A variável que os mutantes desta seção acrescentam — nenhuma fonte real a entrega. */
const SEXTA_EXIGENCIA = 'WEBHOOK_SICOOB_SEGREDO';

/**
 * Uma leitura HIPOTÉTICA com uma exigência a mais — o **mutante** desta prova.
 *
 * ⚠️ Ela não é oráculo de coisa alguma, e nenhum caso a compara com o SUT: é o análogo, do lado da
 * composição, das cópias em memória do provisionador. Os casos que afirmam o estado do repositório
 * exercitam {@link carregarAmbiente}, sempre.
 *
 * A redação da recusa é PARÂMETRO porque é justamente o que uma derivação textual trataria como fixo
 * — e a composição raiz deste processo monta a mensagem por **template**, de modo que a via não é
 * hipotética.
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
  const { SMTP_URL, EMAIL_REMETENTE, WEBHOOK_SICOOB_SEGREDO } = fonte;
  const declaradas = [
    ...VARIAVEIS_EXIGIDAS.map((nome) => fonte[nome]),
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
 * Os idiomas pelos quais a exigência nova pode chegar — e o que cada um discrimina.
 *
 * O primeiro é a redação de hoje; o segundo é uma redação que **nem escreve** o nome da variável em
 * caixa alta; o terceiro varia a **forma de leitura**. Uma derivação que lesse o texto do fonte
 * cairia no segundo; uma que lesse a mensagem de falha real cairia no terceiro.
 */
const IDIOMAS_DA_SEXTA_EXIGENCIA = [
  {
    idioma: 'a redação de hoje, montada por template',
    ler: leituraComSextaExigencia((nome) => `${nome}: ausente`),
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

describe('carregarAmbiente (T10 · CA-17) — a barreira de partida do transporte', () => {
  it.each(LINHAS_DO_TRANSPORTE)(
    'CT-639 — $cenario: a partida é recusada nomeando a variável, sem devolver ambiente parcial',
    ({ ausente, embranco }) => {
      const fonte =
        embranco === undefined
          ? ambienteSem(ausente)
          : { ...ambienteCompleto(), [embranco]: '   ' };

      // `falhaDe` REPROVA quando a chamada devolve configuração — é assim que "nunca devolve ambiente
      // parcial nem transporte nulo" fica asserido, e não apenas afirmado no docblock.
      const falha = falhaDe(fonte);

      // A cadeia EXATA da variável faltante, e não "a mensagem não está vazia".
      expect(falha.message).toContain(`${ausente}: ausente`);
      // E a credencial das cadeias de conexão não atravessa para o journal.
      expect(falha.message).not.toContain(SENHA_NA_CADEIA);
    },
  );

  // SUT_IS_CORRECT_BECAUSE: o nome do caso dizia **OITO**, e a T9 acrescentou `URL_BASE_DA_CONFIRMACAO`
  // à partida — são NOVE. O que a asserção mede não mudou e não foi afrouxado: continua sendo a
  // igualdade estrita do objeto inteiro contra {@link configuracaoEsperada}, que também cresceu pelo
  // mesmo campo. Corrigir o rótulo é obrigatório mesmo sendo prosa: número desatualizado convida a
  // próxima task a "corrigir" a âncora executável para baixo.
  it('CT-639 — com as NOVE declaradas, devolve o ambiente INTEIRO por igualdade estrita', () => {
    // O controle positivo, sem o qual tudo acima seria satisfeito por uma validação que recusasse
    // todo ambiente. O objeto inteiro, e não campo a campo: é a igualdade estrita que faz um campo a
    // mais — ou um campo com valor de outra variável — reprovar aqui.
    const fonte = ambienteCompleto();

    expect(carregarAmbiente(fonte)).toStrictEqual(configuracaoEsperada(fonte));
  });

  it('CT-639 — `VARIAVEIS_EXIGIDAS` contém as duas variáveis do transporte', () => {
    // A lista é o que a seleção e a mensagem de falha consomem, e é ela que a tabela do CT-007
    // percorre: uma variável no esquema e fora dela deixaria de ser exercitada por aquela tabela.
    expect(VARIAVEIS_EXIGIDAS).toContain('SMTP_URL');
    expect(VARIAVEIS_EXIGIDAS).toContain('EMAIL_REMETENTE');
  });
});

// ===========================================================================
// A barreira de partida do LINK DE CONFIRMAÇÃO (T9 · CA-09)
// ===========================================================================

/**
 * As duas linhas inválidas da variável do link, com o que cada uma deve produzir.
 *
 * Declaradas ANTES do caso e nomeando o resultado esperado — elas **não** são derivadas da execução.
 * A primeira é a ausência; a segunda é a cadeia em branco, que é o que um `EnvironmentFile` copiado
 * do `.env.example` sem preenchimento entrega, e que uma validação ingênua
 * (`fonte.URL_BASE_DA_CONFIRMACAO !== undefined`) aceitaria — e o produto passaria a emitir links
 * começados por `undefined`.
 */
const LINHAS_DO_LINK_DE_CONFIRMACAO = [
  { cenario: 'sem URL_BASE_DA_CONFIRMACAO', embranco: undefined },
  { cenario: 'URL_BASE_DA_CONFIRMACAO em branco', embranco: 'URL_BASE_DA_CONFIRMACAO' },
] as const;

describe('carregarAmbiente (T9 · CA-09) — a barreira de partida do link de confirmação', () => {
  it.each(LINHAS_DO_LINK_DE_CONFIRMACAO)(
    'CT-007 — $cenario: a partida é recusada nomeando a variável, sem devolver ambiente parcial',
    ({ embranco }) => {
      const fonte =
        embranco === undefined
          ? ambienteSem('URL_BASE_DA_CONFIRMACAO')
          : { ...ambienteCompleto(), [embranco]: '   ' };

      // `falhaDe` REPROVA quando a chamada devolve configuração: é assim que "nunca sobe com o link
      // por declarar" fica asserido, e não apenas afirmado no docblock.
      const falha = falhaDe(fonte);

      // A cadeia EXATA da variável faltante, e não "a mensagem não está vazia".
      expect(falha.message).toContain('URL_BASE_DA_CONFIRMACAO: ausente');
      // E a credencial das cadeias de conexão não atravessa para o journal — a disciplina da
      // mensagem vale para a partida inteira, e não só para a variável que a motivou.
      expect(falha.message).not.toContain(SENHA_NA_CADEIA);
    },
  );

  it('CT-007 — `VARIAVEIS_EXIGIDAS` contém a variável do link, e ela TEM caminho de provisionamento', () => {
    // A lista é o que a seleção e a mensagem de falha consomem, e é ela que a tabela do CT-007
    // percorre: uma variável no esquema e fora dela deixaria de ser exercitada por aquela tabela.
    expect(VARIAVEIS_EXIGIDAS).toContain('URL_BASE_DA_CONFIRMACAO');

    // SUT_IS_CORRECT_BECAUSE: a rodada 1 da T9 entregava a variável por `Environment=` inline na
    // unidade DESTE processo, e o Gate 2 mediu que quem a consome é o processador de trabalho —
    // cuja unidade não a tinha. A §16.3 da tech spec declara o destino certo, e é para lá que ela
    // foi: o `EnvironmentFile` que as DUAS unidades leem, semeado pelo provisionamento. A asserção
    // não foi afrouxada — mudou de fonte junto com o SUT, e continua sendo `toContain` sobre a
    // fonte que de fato entrega a chave. O caso
    // `CT-639 — as duas variáveis do transporte TÊM caminho de provisionamento` cobre a outra
    // ponta, afirmando por igualdade que **nenhuma** exigida ficou sem caminho além da testemunha
    // medida do D39 — e é ele que reprovaria se esta linha mudasse de fonte sem que o SUT mudasse.
    expect(chavesEmitidasPor(lerDoRepositorio(CAMINHO_DO_PROVISIONADOR))).toContain(
      'URL_BASE_DA_CONFIRMACAO',
    );
    // E a NEGATIVA que fixa a decisão: ela não volta a ter uma segunda declaração literal na
    // unidade. Sem esta linha, um `Environment=` reintroduzido conviveria com o arquivo de
    // ambiente, e as duas coordenadas ficariam livres para divergir sem que nada acusasse.
    expect(
      chavesDeclaradasNaUnidade(lerDoRepositorio(CAMINHO_DA_UNIDADE_DESTE_PROCESSO)),
    ).not.toContain('URL_BASE_DA_CONFIRMACAO');
    expect(chavesDeclaradasPor(lerDoRepositorio(CAMINHO_DO_EXEMPLO))).toContain(
      'URL_BASE_DA_CONFIRMACAO',
    );
  });
});

describe('CT-639 (T10 · CA-17) — a exigência de partida e o provisionamento da `api`', () => {
  const fonteDoProvisionador = lerDoRepositorio(CAMINHO_DO_PROVISIONADOR);
  const fonteDaUnidade = lerDoRepositorio(CAMINHO_DA_UNIDADE_DESTE_PROCESSO);
  const fonteDoExemplo = lerDoRepositorio(CAMINHO_DO_EXEMPLO);
  // O conjunto sai de EXECUTAR a validação — quais nomes ela consulta na fonte, e quais dessas ela
  // recusa quando faltam. Nenhuma linha desta derivação lê o texto de `ambiente.ts`, e nenhuma lê a
  // mensagem de recusa: a composição raiz deste processo monta a mensagem por template, e um detector
  // textual fecharia uma redação por rodada deixando as outras abertas.
  const exigidas = variaveisExigidasPor(carregarAmbiente, ambienteCompleto());

  it('CT-639 — o conjunto derivado da EXECUÇÃO é igual a `VARIAVEIS_EXIGIDAS`', () => {
    // Âncora antivácuo do lado da exigência: sem esta igualdade, uma variável acrescentada ao esquema
    // e esquecida na lista ficaria fora da tabela de casos deste arquivo sem que nada acusasse.
    expect(exigidas).toEqual([...VARIAVEIS_EXIGIDAS].sort());
  });

  it('CT-639 — o conjunto derivado BASTA: declarando só ele, a partida é ACEITA', () => {
    // Esta é a asserção que torna a derivação COMPLETA por prova, e não por inspeção de texto: se
    // `carregarAmbiente` exigisse qualquer coisa que a derivação não enxerga — outra redação, outra
    // forma de leitura, uma consulta que nem passa pela fonte —, esta chamada seria recusada.
    expect(() => carregarAmbiente(fonteDeclarando(exigidas, ambienteCompleto()))).not.toThrow();
  });

  it('CT-639 — as duas variáveis do transporte TÊM caminho de provisionamento', () => {
    // A lista das culpadas, e não um booleano: quando reprovar, a mensagem nomeia a variável. E o
    // valor esperado é a testemunha MEDIDA do D39, não `[]` — ver `EXIGIDAS_SEM_PROVISIONAMENTO`.
    expect(
      semCaminhoDeProvisionamento(exigidas, fonteDoProvisionador, fonteDaUnidade, fonteDoExemplo),
    ).toEqual(EXIGIDAS_SEM_PROVISIONAMENTO);

    // Testemunhas POSITIVAS das duas fontes, para que a igualdade acima não possa ser satisfeita por
    // um detector que responda "provisionada" para tudo menos o que já está na lista.
    expect(chavesEmitidasPor(fonteDoProvisionador)).toContain('SMTP_URL');
    expect(chavesDeclaradasNaUnidade(fonteDaUnidade)).toContain('LOG_LEVEL');
  });

  it.each(IDIOMAS_DA_SEXTA_EXIGENCIA)(
    'CT-639 (b) — PROVA DE FALSIFICAÇÃO: exigência NOVA reprova — $idioma',
    ({ ler }) => {
      // O caminho por onde o defeito volta: toda fatia seguinte pode acrescentar uma variável
      // exigida. Uma exigência nova sem caminho de provisionamento precisa reprovar **sozinha**, sem
      // ninguém se lembrar de acrescentá-la a lista nenhuma — e qualquer que seja o idioma com que
      // ela for escrita, que é o que esta tabela varre.
      const exigidasPeloMutante = variaveisExigidasPor(ler, ambienteCompleto());

      expect(exigidasPeloMutante).toContain(SEXTA_EXIGENCIA);
      expect(
        semCaminhoDeProvisionamento(
          exigidasPeloMutante,
          fonteDoProvisionador,
          fonteDaUnidade,
          fonteDoExemplo,
        ),
      ).toContain(SEXTA_EXIGENCIA);
      // E a âncora antivácuo também reprova, o que é o segundo aviso pelo mesmo defeito.
      expect(exigidasPeloMutante).not.toEqual([...VARIAVEIS_EXIGIDAS].sort());
    },
  );

  it('CT-639 (b) — PROVA DE FALSIFICAÇÃO: sem a emissão, o detector nomeia `SMTP_URL`', () => {
    // O mutante é o estado que o `D39` descreve, aplicado à variável desta task: `SMTP_URL` exigida
    // na partida e nenhuma linha do provisionamento a gravando. A cópia existe só em memória —
    // escrever no disco durante a suíte deixaria resíduo num script de instalação.
    const semAEmissao = fonteDoProvisionador.replaceAll(/^.*printf 'SMTP_URL=.*$/gm, '');

    expect(semAEmissao).not.toEqual(fonteDoProvisionador);
    expect(chavesEmitidasPor(semAEmissao)).not.toContain('SMTP_URL');
    expect(
      semCaminhoDeProvisionamento(exigidas, semAEmissao, fonteDaUnidade, fonteDoExemplo),
    ).toEqual([...EXIGIDAS_SEM_PROVISIONAMENTO, 'SMTP_URL'].sort());
  });

  it('CT-639 (b) — PROVA DE FALSIFICAÇÃO: menção em comentário NÃO conta como emissão', () => {
    // O detector por menção — a versão ingênua — aprovaria um provisionamento que apenas FALA da
    // variável. É o modo de falha que a `.claude/rules/testing-stack.md` registra como *"asserção que
    // casava `ALTER ROLE` em comentário"*.
    const soEmComentario = fonteDoProvisionador
      .replaceAll(/^.*printf 'SMTP_URL=.*$/gm, '')
      .concat('\n# printf \'SMTP_URL=%s\\n\' "$SMTP_PADRAO"\n');

    expect(chavesEmitidasPor(soEmComentario)).not.toContain('SMTP_URL');
  });
});
