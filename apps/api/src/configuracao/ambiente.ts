/**
 * Configuração do serviço de aplicação — leitura e validação das variáveis de ambiente.
 *
 * ---------------------------------------------------------------------------
 * Falhar na PARTIDA, e não no primeiro uso
 * ---------------------------------------------------------------------------
 *
 * A composição raiz chama {@link carregarAmbiente} antes de qualquer rota existir. Configuração
 * incompleta derruba o processo ali, com uma mensagem que **nomeia cada variável ausente** — e
 * não uma rodada de partida por variável faltante. Subir e quebrar no primeiro uso é exatamente
 * o comportamento que esta validação existe para impedir: o supervisor do sistema operacional
 * reporta um serviço `active` que responde erro em toda requisição, e o operador descobre o
 * motivo depurando, em vez de lendo o journal.
 *
 * ---------------------------------------------------------------------------
 * A fonte é PARÂMETRO, e a falha é EXCEÇÃO — não `process.exit`
 * ---------------------------------------------------------------------------
 *
 * A função é pura: recebe o registro de variáveis e devolve a configuração ou lança. Quem decide
 * abortar é o ponto de entrada (`main.ts`), que é quem tem o processo na mão. Abortar aqui dentro
 * tornaria a validação inverificável sem subprocesso — e é justamente ela que o critério de
 * aceitação CA-15 cobra.
 *
 * ---------------------------------------------------------------------------
 * Esquema e forma das cadeias de conexão
 * ---------------------------------------------------------------------------
 *
 * `DATABASE_URL` é exigida com o esquema `postgresql://`, e não `postgres://`. Os dois são
 * equivalentes para o driver, mas não para o resto do sistema: o leitor de credencial de
 * `deploy/scripts/instalacao/provisionar-base.sh` ancora em `^DATABASE_URL=postgresql://` e
 * **recusa** um arquivo escrito com o outro. Aceitar as duas grafias aqui deixaria de pé um
 * arquivo de ambiente que a aplicação lê e o provisionamento rejeita — divergência que já foi
 * registrada como débito (D7) e cujo endereço de reconciliação é esta task. A forma (endereço de
 * rede ou socket de domínio Unix, este último com `?host=`) é livre: o provisionamento grava a
 * segunda, e o `.env.example` documenta as duas.
 */

import {
  EXIGENCIA_DA_CADEIA_DE_FILA,
  ehCadeiaDeFilaValida,
  NIVEIS_DE_LOG,
  type NivelDeLog,
} from '@sysloc/shared';
import { z } from 'zod';

/** Ambientes de execução aceitos em `NODE_ENV` — os mesmos que o `.env.example` documenta. */
const AMBIENTES = ['development', 'test', 'production'] as const;

/** Maior porta TCP existente. */
const MAIOR_PORTA = 65_535;

/**
 * O esquema é a fonte única do que o processo exige. `VARIAVEIS_EXIGIDAS` deriva dele, de modo
 * que acrescentar variável aqui já a torna exigida, documentada na mensagem de falha e coberta
 * pela verificação — sem uma segunda lista para manter em dia.
 */
const ESQUEMA = z.object({
  NODE_ENV: z.enum(AMBIENTES, {
    error: `deve ser um de: ${AMBIENTES.join(', ')}`,
  }),
  PORT: z.coerce
    .number({ error: 'deve ser um número inteiro' })
    .int('deve ser um número inteiro')
    .min(1, `deve estar entre 1 e ${MAIOR_PORTA}`)
    .max(MAIOR_PORTA, `deve estar entre 1 e ${MAIOR_PORTA}`),
  LOG_LEVEL: z.enum(NIVEIS_DE_LOG, {
    error: `deve ser um de: ${NIVEIS_DE_LOG.join(', ')}`,
  }),
  DATABASE_URL: z
    .string()
    .regex(/^postgresql:\/\//, 'deve começar com postgresql://')
    .refine(URL.canParse, 'não é uma cadeia de conexão interpretável'),
  // A regra e o texto da exigência vêm do pacote compartilhado, e não de uma cópia local: o
  // processador de trabalho valida a MESMA variável, do MESMO arquivo de ambiente, e duas
  // definições independentes divergiriam em silêncio até um `EnvironmentFile` subir um processo
  // e recusar o outro.
  REDIS_URL: z.string().refine(ehCadeiaDeFilaValida, EXIGENCIA_DA_CADEIA_DE_FILA),
});

/**
 * Nomes das variáveis que o processo exige, na ordem em que o esquema as declara.
 *
 * É por esta lista que a leitura seleciona o que consumir: o restante do ambiente do processo
 * nunca entra na validação nem na configuração devolvida. Ela também é a lista que o `.env.example`
 * documenta.
 */
export const VARIAVEIS_EXIGIDAS = Object.keys(
  ESQUEMA.shape,
) as readonly (keyof typeof ESQUEMA.shape)[];

/** Registro de variáveis de ambiente, na forma em que o runtime as entrega. */
export type FonteDeVariaveis = Readonly<Record<string, string | undefined>>;

/** Configuração validada do serviço de aplicação, já com os tipos convertidos. */
export interface Ambiente {
  /** Ambiente de execução, de `NODE_ENV`. */
  readonly ambiente: (typeof AMBIENTES)[number];
  /** Porta TCP em que o serviço escuta, de `PORT`. Número, nunca texto. */
  readonly porta: number;
  /** Severidade mínima registrada, de `LOG_LEVEL`. */
  readonly nivelDeLog: NivelDeLog;
  /** Cadeia de conexão do banco de dados, de `DATABASE_URL`. */
  readonly cadeiaConexaoBanco: string;
  /** Cadeia de conexão da fila, de `REDIS_URL`. */
  readonly cadeiaConexaoFila: string;
}

/**
 * Token de injeção da configuração. Símbolo em vez de cadeia de caracteres: colisão com um token
 * de outro módulo deixa de ser possível.
 */
export const TOKEN_AMBIENTE = Symbol('Ambiente');

/**
 * Token de injeção do registrador estruturado do processo.
 *
 * Mora aqui, ao lado do token da configuração, porque é a configuração que o alimenta (`LOG_LEVEL`)
 * e porque os dois são publicados pela mesma composição raiz. Declará-lo no módulo raiz criaria
 * importação circular com o filtro de exceção, que o consome.
 */
export const TOKEN_LOGGER = Symbol('Logger');

/**
 * Lê e valida as variáveis de ambiente exigidas.
 *
 * @param fonte Registro de variáveis — `process.env` na partida, objeto montado na verificação.
 * @returns A configuração com cada valor já convertido para o tipo declarado no esquema.
 * @throws {Error} Quando falta variável exigida ou algum valor é inválido. A mensagem nomeia
 * **todas** as variáveis com problema, uma por vez que ocorra, e nunca ecoa o valor recebido —
 * `DATABASE_URL` carrega a senha do banco, e a mensagem de falha vai para o journal.
 */
export function carregarAmbiente(fonte: FonteDeVariaveis): Ambiente {
  const resultado = ESQUEMA.safeParse(selecionar(fonte));

  if (!resultado.success) {
    throw new Error(
      'configuração inválida na partida: ' +
        `${resultado.error.issues.map((problema) => descrever(problema, fonte)).join('; ')}. ` +
        'As variáveis exigidas estão documentadas em .env.example.',
    );
  }

  const validado = resultado.data;
  return {
    ambiente: validado.NODE_ENV,
    porta: validado.PORT,
    nivelDeLog: validado.LOG_LEVEL,
    cadeiaConexaoBanco: validado.DATABASE_URL,
    cadeiaConexaoFila: validado.REDIS_URL,
  };
}

/**
 * Copia do ambiente apenas as variáveis exigidas, tratando valor em branco como **ausente**.
 *
 * O `.env.example` versionado declara toda variável sem valor (`PORT=`), e um arquivo copiado dele
 * sem preenchimento entrega cadeias vazias. Sem esta normalização a falha viria como "deve ser um
 * número" onde o problema real é "não foi preenchida" — e o diagnóstico erra o alvo justamente no
 * caso mais provável de uma máquina recém-configurada.
 */
function selecionar(fonte: FonteDeVariaveis): Record<string, string | undefined> {
  const selecionadas: Record<string, string | undefined> = {};
  for (const nome of VARIAVEIS_EXIGIDAS) {
    const valor = fonte[nome]?.trim();
    if (valor !== undefined && valor !== '') {
      selecionadas[nome] = valor;
    }
  }
  return selecionadas;
}

/** Descreve um problema de validação nomeando a variável — e nunca o valor recebido. */
function descrever(problema: z.core.$ZodIssue, fonte: FonteDeVariaveis): string {
  const nome = String(problema.path[0] ?? '(variável não identificada)');
  const ausente = (fonte[nome]?.trim() ?? '') === '';
  return `${nome}: ${ausente ? 'ausente' : problema.message}`;
}
