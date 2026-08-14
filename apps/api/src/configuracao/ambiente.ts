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
  // As DUAS variáveis do transporte de e-mail entram na T10 da fatia `regua-de-cobranca`, e não por
  // simetria com o processador de trabalho: o **disparo manual** envia de dentro deste processo, que
  // passa a ser o SEGUNDO capaz de alcançar a caixa de uma pessoa real. Aqui o modo perigoso é o
  // inverso do habitual — *"subir mesmo assim"* constrói um transporte que aponta para o `localhost`
  // que a biblioteca assume por omissão —, e por isso a partida é **recusada** nomeando a variável,
  // em vez de o processo subir e falhar no primeiro disparo. A conferência é a MESMA que
  // `apps/worker/src/main.ts` faz, e o par de casos que a prova nos dois processos é `CT-625`/`CT-639`.
  //
  // A **forma** da cadeia não é conferida aqui, e a ausência é decisão: quem recusa a `SMTP_URL` que
  // não serve como endereço é `coordenadasDoTransporte` (em `@sysloc/regua`), num lugar só. Uma
  // segunda conferência de forma escrita nesta composição ficaria livre para divergir da do outro
  // processo — e é justamente a divergência entre dois pontos que decidem o mesmo fato que esta fatia
  // existe para não ter.
  //
  // O piso de um caractere não é redundante com {@link selecionar}: ele é a barreira que sobrevive a
  // qualquer mudança futura naquela normalização, e `SMTP_URL` é a variável em que o valor vazio
  // atravessando custa uma mensagem entregue no endereço errado.
  SMTP_URL: z.string().min(1, 'deve ser declarada'),
  EMAIL_REMETENTE: z.string().min(1, 'deve ser declarada'),
  // O endereço público do aplicativo, sobre o qual o link de confirmação é composto (T9 da fatia
  // `documentos-e-confirmacao`). Ela **não é segredo** — é o endereço que qualquer pessoa digita no
  // navegador.
  //
  // ⚠️ **ESTE processo NÃO compõe link algum**, e a exigência aqui não finge o contrário: quem monta
  // o endereço da confirmação é o processador de trabalho (T10), e é lá que o valor é LIDO. O que a
  // linha abaixo cobra é **completude do arquivo de ambiente**, que é UM SÓ e é o `EnvironmentFile=`
  // das duas unidades (§16.3 da tech spec). A diferença é operacional e vale a linha: a `api` é o
  // processo que o operador acompanha na instalação e na virada, de modo que um arquivo incompleto é
  // recusado ali, nomeando a variável — em vez de as duas unidades subirem e a falta aparecer horas
  // depois, como um link que não leva a lugar nenhum na caixa de um locatário real.
  //
  // É por isso que ela **não** vira campo de {@link Ambiente}: exigir não é consumir, e publicar um
  // valor que nenhum código deste processo lê ensinaria o leitor seguinte que a `api` emite links.
  //
  // A mensagem de recusa nomeia a **variável**, nunca o valor — a disciplina é a mesma de todas as
  // demais, e vale mesmo para o que não é segredo: a regra é do formato da mensagem, e abri-la
  // "só para esta" cria a exceção que a próxima variável herda.
  //
  // A **forma** do endereço não é conferida aqui, e a ausência é decisão: quem compõe o link é o
  // processador de trabalho (T10), e uma conferência de forma escrita nesta composição ficaria livre
  // para divergir da que o outro processo fizer — a divergência entre dois pontos que decidem o
  // mesmo fato é o que esta fatia existe para não ter. O piso de um caractere é a barreira que
  // sobrevive a qualquer mudança futura em {@link selecionar}.
  URL_BASE_DA_CONFIRMACAO: z.string().min(1, 'deve ser declarada'),
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
  /**
   * Cadeia de conexão do servidor de e-mail, de `SMTP_URL`. **Carrega credencial.**
   *
   * Ela não é registrada, não viaja em `argv` e não é ecoada em mensagem de erro: a recusa de partida
   * nomeia a **variável**, e a falha de entrega nomeia o **código** do transporte. Mesma disciplina, e
   * mesmos nomes de campo, de `apps/worker/src/main.ts`.
   */
  readonly urlDoTransporte: string;
  /** Endereço que assina o aviso, de `EMAIL_REMETENTE`. */
  readonly remetenteDoAviso: string;
  // ⚠️ `URL_BASE_DA_CONFIRMACAO` é EXIGIDA na partida e **não** tem campo aqui. A ausência é a
  // decisão, e a razão está no esquema, junto da linha que a exige: este processo confere a
  // completude do arquivo de ambiente compartilhado e NÃO compõe link nenhum — quem lê o valor é o
  // processador de trabalho. Publicar um campo que ninguém deste processo consome ensinaria o
  // contrário a quem chegasse depois.
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
 * Token de injeção do acesso a dado de **negócio** — a unidade de trabalho (T4 da fatia
 * `autorizacao-e-ciclo-de-acesso`).
 *
 * Mora aqui pela MESMA razão dos três tokens acima, e pelo mesmo mecanismo: declará-lo no módulo que
 * o provê criaria importação circular com a guarda, que o pede no construtor enquanto o módulo ainda
 * está sendo carregado.
 *
 * **Por que a guarda precisa dele**: a revalidação por versão da ADR-0010 relê os ajustes individuais
 * da pessoa quando o retrato da sessão fica velho, e eles vivem em `negocio.acesso_usuario_permissao`
 * — sob RLS forçada. A unidade de trabalho é a única porta para lá (ADR-0008), e é ela que emite o
 * `SET LOCAL app.empresa_id` que dá escopo à leitura. Nenhum filtro por empresa é escrito na
 * aplicação.
 *
 * Ele fica **fora do `exports`** de quem o provê, exatamente como `TOKEN_ACESSO_A_IDENTIDADE`:
 * nenhum módulo de fora recebe o acesso, e a porta única para dado de negócio não vira duas por
 * conveniência de injeção.
 */
export const TOKEN_ACESSO_AO_NEGOCIO = Symbol('AcessoAoBanco');

/**
 * Token de injeção da **porta de saída de e-mail** (T10 da fatia `regua-de-cobranca`).
 *
 * Mora aqui, ao lado dos quatro tokens acima, pelo mesmo motivo deles — e não porque a verificação
 * precise dele. O que ele publica é a `PortaDeEnvioDeEmail` que `@sysloc/regua` declara: a operação
 * recebe o adaptador de SMTP, e a verificação substitui o provedor pelo **capturador**, pela mesma
 * interface e pelo mesmo mecanismo do arcabouço de teste (`overrideProvider`) que
 * `contexto.e2e.spec.ts` e `saude.e2e.spec.ts` já usam para o registrador.
 *
 * ⚠️ **`criarAplicacao()` NÃO ganha parâmetro por causa disto**, e a ausência é a decisão: uma opção
 * de composição que só a suíte passasse seria símbolo de produção a serviço do teste — o seam que a
 * disciplina do executor proíbe —, e ela seria também um segundo caminho para escolher o adaptador,
 * exatamente o `if (ehTeste)` que o cabeçalho de `packages/regua/src/adaptador-smtp.ts` recusa. A
 * barreira da CA-17 é **estrutural**: quem monta o processo escolhe, e o que a suíte faz é trocar o
 * provedor de fora, sem que exista bandeira, ambiente ou ramo no meio.
 */
export const TOKEN_PORTA_DE_EMAIL = Symbol('PortaDeEnvioDeEmail');

/**
 * Token de injeção da **porta de renderização do documento** (T7 da fatia
 * `documentos-e-confirmacao`).
 *
 * Mora aqui, ao lado dos cinco tokens acima, pelo mesmo motivo deles — e há um a mais, que é
 * estrutural: declará-lo em `contratos/contratos.module.ts` fecharia importação circular, porque o
 * módulo importa o controlador, o controlador importa o serviço, e é o **serviço** quem precisa do
 * token. O que ele publica é a `PortaDeRenderizacao` que `@sysloc/documentos` declara (ADR-0025):
 * quem monta o processo escolhe o adaptador, e a composição do documento continua sem saber que
 * existe um motor de PDF.
 *
 * ⚠️ **Ele não abre um segundo caminho para escolher o motor.** O único ponto do repositório que
 * conhece `@react-pdf/renderer` continua sendo `packages/documentos/src/renderizador-pdf.ts`, e o
 * único que decide qual adaptador entra em produção é `ContratosModule` — não há bandeira, não há
 * variável de ambiente e não há ramo `if (ehTeste)` no meio. A verificação exercita o adaptador
 * **real**: os bytes do documento são a coisa sob prova, e dublar o renderizador seria dublar
 * exatamente o que se quer medir.
 */
export const TOKEN_PORTA_DE_RENDERIZACAO = Symbol('PortaDeRenderizacao');

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
    urlDoTransporte: validado.SMTP_URL,
    remetenteDoAviso: validado.EMAIL_REMETENTE,
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
