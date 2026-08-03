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
 * registrada como débito (D7) e cujo endereço de reconciliação é esta task. A forma é
 * `postgresql://PAPEL:SEGREDO@HOSPEDEIRO:PORTA/BANCO` — endereço de rede, e não socket de domínio
 * Unix: é a única que o provisionamento grava e a única que o `.env.example` documenta.
 *
 * Por isso o `URL.canParse` desta validação não é formalidade. O cliente que a aplicação usa
 * (`postgres.js`) constrói as opções de conexão com `new URL()` e só alcança socket de domínio
 * Unix pelo OBJETO de opções, nunca por cadeia de conexão — uma `DATABASE_URL` de socket que
 * passasse por aqui subiria o processo e quebraria na primeira consulta, que é exatamente o
 * comportamento que esta validação existe para impedir.
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
 * Comprimento mínimo do segredo de assinatura de sessão.
 *
 * Trinta e dois caracteres é o tamanho que o próprio arcabouço de identidade gera quando sorteia um
 * segredo. Exigir o piso na partida é o que impede que um `EnvironmentFile` preenchido à mão com
 * meia dúzia de caracteres suba um serviço cujas sessões são assináveis por força bruta — e a
 * falha de partida é o único momento em que isso ainda é barato de descobrir.
 */
const COMPRIMENTO_MINIMO_DO_SEGREDO = 32;

/**
 * Endereço em que o serviço escuta.
 *
 * Somente o endereço de retorno: este servidor é compartilhado com o ambiente que ainda atende a
 * operação, e escutar em toda interface publicaria o backend novo na internet antes da virada.
 * A publicação externa é da fatia de virada, e passa por servidor de borda — que alcança este
 * endereço sem que ele deixe de ser local.
 *
 * Mora aqui, e não no ponto de entrada, desde a T8: ele deixou de ter um consumidor só. Além do
 * `listen`, é a partir deste endereço que se compõe o endereço base entregue ao arcabouço de
 * identidade — que é o que ele usa para reconhecer a origem confiável das requisições com cookie.
 * Duas cópias do literal poderiam divergir, e a divergência não quebra a partida: ela recusa,
 * silenciosamente, toda requisição autenticada.
 */
export const ENDERECO_DE_ESCUTA = '127.0.0.1';

/**
 * Prefixo de versão de toda rota do produto (§15.1 da tech spec da fatia).
 *
 * Sem barra inicial porque é assim que a montagem da aplicação o consome. Quem precisa dele como
 * caminho o compõe — ver `autenticacao.module.ts`.
 */
export const PREFIXO_DE_VERSAO = 'v1';

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
  // O nome é o que o arcabouço de identidade lê por convenção própria, e o `.env.example` já o
  // documenta com essa justificativa — uma segunda grafia para a mesma coisa só criaria dois
  // arquivos de ambiente incompatíveis. A mensagem de falha nomeia a variável e o piso exigido, e
  // NUNCA o valor recebido: ela vai para o journal, e este valor assina toda sessão em curso.
  BETTER_AUTH_SECRET: z
    .string()
    .min(
      COMPRIMENTO_MINIMO_DO_SEGREDO,
      `deve ter ao menos ${COMPRIMENTO_MINIMO_DO_SEGREDO} caracteres`,
    ),
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
  /**
   * Segredo de assinatura de sessão, de `BETTER_AUTH_SECRET`.
   *
   * Trocá-lo invalida toda sessão em curso — é a alavanca de emergência para suspeita de
   * vazamento, e é por isso que ele vive em `EnvironmentFile` 0600 fora da árvore (§11.6).
   */
  readonly segredoDeSessao: string;
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
 * Token de injeção da instância do arcabouço de identidade (T8).
 *
 * Mora aqui pela MESMA razão do token acima, e o precedente é o daquele comentário: declará-lo no
 * módulo que o provê criaria importação circular com o controlador que o consome — o módulo declara
 * o controlador, o controlador pede o token no decorador, e o decorador é avaliado enquanto o
 * módulo ainda está sendo carregado. O símbolo não tem dependência alguma; este arquivo é o único
 * do serviço que nenhum outro consome de volta.
 */
export const TOKEN_AUTENTICACAO = Symbol('Autenticacao');

/**
 * Token de injeção do acesso restrito ao schema `identidade` (T9).
 *
 * Nasceu privado em `autenticacao/autenticacao.module.ts` (T8) e mudou para cá quando ganhou o
 * segundo consumidor: a guarda de contexto, que precisa dele para resolver a empresa da sessão —
 * `perfil` e `empresa_id` são colunas do produto e não campos do modelo do arcabouço, como o débito
 * **D7** registra — o marcador dele vive em `packages/auth/src/autenticacao.ts`.
 *
 * Declará-lo no módulo que o provê reproduziria a importação circular que os dois tokens acima já
 * descrevem — o módulo declara a guarda, a guarda pede o token no construtor, e o construtor é
 * avaliado enquanto o módulo ainda está sendo carregado. Mover para cá **não** o publica a outros
 * módulos: ele continua fora do `exports` de `AutenticacaoModule`, e quem precisa de dado de
 * identidade continua passando pelo arcabouço ou pela sessão.
 */
export const TOKEN_ACESSO_A_IDENTIDADE = Symbol('AcessoAIdentidade');

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
    segredoDeSessao: validado.BETTER_AUTH_SECRET,
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
