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
 *
 * A fonte de variáveis é PARÂMETRO da função (Padrão 14: fail-fast testável). Um único caso planta
 * valor em `process.env` — o que PROVA que o ambiente do processo não prevalece sobre a fonte — e
 * ele restaura o valor anterior ao terminar. Nos demais, mutação global só quebraria a
 * independência entre casos.
 */

import { describe, expect, it, onTestFinished } from 'vitest';
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
    expect(Object.keys(ambiente).sort()).toEqual([
      'ambiente',
      'cadeiaConexaoBanco',
      'cadeiaConexaoFila',
      'nivelDeLog',
      'porta',
      'segredoDeSessao',
    ]);
  });
});
