/**
 * Os **acessórios de arranjo das suítes de borda** — casa única de `pedir`, `pedirBytes`, `entrar`,
 * `entrarComSegundoFatorCumprido`, `conceder`, `credencialDeSessao` e `contarSessoesDaPessoa`.
 *
 * ---------------------------------------------------------------------------
 * Por que existe: o fecho do débito D63 (F4/fechamento)
 * ---------------------------------------------------------------------------
 *
 * Até esta fatia estes quatro acessórios não tinham casa: cada suíte nova os **redeclarava**, e o
 * marcador do débito registrava a medição de 2026-08-16 — `pedir` em 24 de 24 suítes, `entrar` em
 * 22, `conceder` em 9, `credencialDeSessao` em 7. **Medido de novo em 2026-08-19**, sobre
 * `apps/api/test/*.ts`: `pedir` em **30** arquivos, `entrar` em **28**, `conceder` em **12**,
 * `credencialDeSessao` em **7**. A medição vence a prescrição, e o número maior é a razão de o
 * gatilho ter disparado: ele dizia *"a próxima suíte E2E que precisar destes acessórios"*, e esta
 * fatia traz **duas** (a da notícia bancária e a do carnê).
 *
 * O que a duplicação custava não é estética. Endurecer um dos acessórios — um cabeçalho novo, um
 * tempo-limite, a redação de uma credencial — deixava as outras cópias para trás **em silêncio**, e
 * nenhuma asserção acusaria: cada suíte continuaria verde medindo uma borda ligeiramente diferente
 * da que as outras medem. É a mesma classe de defeito que o `D57` fechou em
 * {@link ./aplicacao-instrumentada.ts}, e este arquivo é o fecho pela mesma forma.
 *
 * ---------------------------------------------------------------------------
 * O ESCOPO DA MIGRAÇÃO É DECLARADO, e o limite dele também
 * ---------------------------------------------------------------------------
 *
 * ⚠️ **`pedirBytes` chegou na T10** (o carnê), e ele é a aplicação da mesma convenção na direção
 * certa: a suíte nova precisava de um cliente HTTP que devolvesse o corpo **em bytes** — porque
 * {@link pedir} o consome com `text()` e corromperia o PDF —, e a única cópia existente era privada
 * de `./boleto-da-cobranca.e2e.spec.ts`. Declará-lo aqui é o que impede a **segunda** cópia de
 * nascer; converter a daquela suíte é conversão de suíte existente, e vale para ela o limite
 * declarado logo abaixo.
 *
 * ⚠️ **`entrarComSegundoFatorCumprido` chegou na T3 da fatia `painel-master-administradores`**, e a
 * direção dela é a **oposta** à do limite declarado logo abaixo — ela **converte seis suítes
 * existentes de uma vez**, em vez de esperar a próxima. A exceção é medida e está escrita no
 * docblock dela: o Limiar de Três já havia disparado (eram **seis** escritas, não duas), a sétima
 * nasceria na task seguinte desta mesma fatia, e o débito `D32 · F5/T7` declarava exatamente este
 * gatilho — *a primeira task autorizada a abrir uma das seis*. A conversão foi o **objeto** daquela
 * task, com baseline comparada arquivo a arquivo, e não carona num diff que publicava rota.
 *
 * ⚠️ **`contarSessoesDaPessoa` chegou em 2026-09-02**, na triagem de débito da mesma fatia (fecho do
 * `D9 · F7/T4`), e a direção dela é a mesma da anterior: **converte três suítes existentes de uma
 * vez**. A exceção é medida — as três declarações eram **byte a byte idênticas**
 * (`./master-administradores`, `./administracao-de-pessoas`, `./ciclo-de-acesso`), o Limiar de Três
 * já havia disparado, e o débito nomeava exatamente esta promoção. ⚠️ **O débito dizia "duas"**; a
 * medição desta passada achou **três**, e a conversão alcançou as três.
 *
 * Esta task **cria a casa** e a consome nas suítes que ela própria escreve. Converter as ~30 suítes
 * existentes num diff só é refatoração cruzada que ninguém pediu (`.claude/rules/nao-regressao.md`
 * §4.5), e o risco dela é desproporcional ao ganho: 30 arquivos de prova tocados de uma vez, sem
 * rede própria. A conversão das demais acontece pelo caminho normal do `CLAUDE.md` — *acessório de
 * suíte se importa, não se copia*: a **próxima** suíte que precisar de um destes símbolos importa
 * daqui, e a cópia dela deixa de nascer.
 *
 * ⚠️ **Quem for converter uma suíte existente**: as assinaturas daqui recebem a `base` (e o acesso ao
 * banco) por **parâmetro**, enquanto as cópias privadas as leem de variável de módulo. A conversão é
 * mecânica, mas não é textual.
 *
 * ---------------------------------------------------------------------------
 * Por que aqui, e não em `packages/shared/test/`
 * ---------------------------------------------------------------------------
 *
 * Pela mesma razão de {@link ./documento.ts}, {@link ./base32.ts} e {@link ./aplicacao-instrumentada.ts},
 * que são o precedente do diretório: **não precisa** atravessar fronteira de pacote. Todo consumidor
 * é irmão deste arquivo, e o que ele monta é a borda **deste** serviço. Isto é independente do débito
 * `D28` (F0/T5), que é sobre importar `packages/<pacote>/test/` por caminho relativo profundo,
 * ATRAVESSANDO a fronteira do pacote; nada disso acontece aqui.
 */

import { type Autenticacao, type ChaveDoCatalogo, validarCoerenciaDeAjustes } from '@sysloc/auth';
import {
  type AcessoAIdentidade,
  type AcessoAoBanco,
  contextoDeTenant,
  escreverAjustes,
  esquemaIdentidade,
} from '@sysloc/db';
import { eq } from 'drizzle-orm';
import { PREFIXO_DAS_ROTAS_DE_IDENTIDADE } from '../src/autenticacao/autenticacao.module.ts';
import { decodificarBase32 } from './base32.ts';

/**
 * Sufixo do nome do cookie de sessão do arcabouço — o prefixo vem da configuração.
 *
 * Ele é conferido por **sufixo**, e não por igualdade: o arcabouço prefixa o nome conforme o modo de
 * execução (`__Secure-`, em produção), e casar o nome inteiro faria a suíte medir a configuração em
 * vez da sessão.
 */
export const SUFIXO_DO_COOKIE_DE_SESSAO = 'session_token';

/** A rota de entrada, composta a partir do prefixo real. Nunca escrita à mão. */
export const ROTA_DE_ENTRADA = `${PREFIXO_DAS_ROTAS_DE_IDENTIDADE}/sign-in/email`;

/** O que uma requisição devolve, já com o corpo interpretado quando ele é JSON. */
export interface Resposta {
  readonly status: number;
  readonly texto: string;
  readonly corpo: unknown;
  readonly cookies: readonly string[];
  /** Os cabeçalhos da resposta, como o cliente os recebeu — é por aqui que se afirma a ausência. */
  readonly cabecalhos: Headers;
}

/** Um corpo entregue **como texto**, sem passar pelo serializador. Ver {@link OpcoesDoPedido}. */
export interface CorpoBruto {
  readonly texto: string;
  readonly tipoDeConteudo: string;
}

/** O que varia de uma requisição para outra. Tudo opcional: o caminho feliz é um `GET` sem corpo. */
export interface OpcoesDoPedido {
  readonly metodo?: string;
  readonly corpo?: unknown;
  /**
   * O corpo entregue **byte a byte**, com o tipo de conteúdo declarado por quem chama.
   *
   * Ele existe porque {@link corpo} é serializado como JSON **por construção**, e há casos cujo
   * objeto de prova é justamente um corpo que **não é** JSON — a recusa do transporte na entrada da
   * notícia bancária, ou o tipo de conteúdo que o arcabouço de identidade não aceita. Sem ele, esses
   * casos precisariam de um cliente HTTP próprio, e a cópia nasceria por causa de um campo.
   *
   * Ignorado quando {@link corpo} está presente: dois corpos na mesma requisição é erro de chamada,
   * e o serializado vence porque é o caminho comum.
   */
  readonly corpoBruto?: CorpoBruto;
  readonly cookie?: string;
  readonly cabecalhos?: Readonly<Record<string, string>>;
}

/**
 * Executa uma requisição HTTP **real** contra a aplicação em `base`.
 *
 * O cabeçalho `Origin` acompanha toda requisição com a MESMA origem da aplicação — é o que um
 * navegador enviaria, e é o que o arcabouço de identidade confere nas requisições que carregam
 * cookie. `connection: close` evita que a conexão persistente segure o encerramento da suíte.
 *
 * ⚠️ **O cliente NÃO segue redirecionamento** (`redirect: 'manual'`), e a escolha é conteúdo, não
 * conveniência: uma suíte que precise afirmar *"esta rota nunca emite `3xx`"* — o caso da entrada de
 * fato de terceiro, cujo provedor reprova redirecionamento — não consegue afirmá-lo com um cliente
 * que o segue, porque o `3xx` desapareceria antes de ser observado. Seguir, quando for o caso, é
 * decisão de quem chama, e ela fica visível no caso.
 *
 * @param base Origem da aplicação sob teste, na forma `http://HOSPEDEIRO:PORTA`. Parâmetro, e não
 *   variável de módulo, porque a porta é **dinâmica** e cada suíte tem a sua.
 * @param alvo Caminho ou URL relativa à base.
 */
export async function pedir(
  base: string,
  alvo: string,
  opcoes: OpcoesDoPedido = {},
): Promise<Resposta> {
  const cabecalhos: Record<string, string> = { connection: 'close', origin: base };

  if (opcoes.corpo !== undefined) {
    cabecalhos['content-type'] = 'application/json';
  } else if (opcoes.corpoBruto !== undefined) {
    cabecalhos['content-type'] = opcoes.corpoBruto.tipoDeConteudo;
  }
  if (opcoes.cookie !== undefined) {
    cabecalhos.cookie = opcoes.cookie;
  }
  for (const [nome, valor] of Object.entries(opcoes.cabecalhos ?? {})) {
    cabecalhos[nome] = valor;
  }

  const corpo =
    opcoes.corpo !== undefined
      ? JSON.stringify(opcoes.corpo)
      : opcoes.corpoBruto !== undefined
        ? opcoes.corpoBruto.texto
        : undefined;

  const resposta = await fetch(new URL(alvo, base), {
    method: opcoes.metodo ?? 'GET',
    headers: cabecalhos,
    redirect: 'manual',
    ...(corpo === undefined ? {} : { body: corpo }),
  });

  const texto = await resposta.text();
  const tipoDeConteudo = resposta.headers.get('content-type') ?? '';

  return {
    status: resposta.status,
    texto,
    corpo:
      tipoDeConteudo.includes('application/json') && texto.length > 0
        ? (JSON.parse(texto) as unknown)
        : undefined,
    cookies: resposta.headers.getSetCookie(),
    cabecalhos: resposta.headers,
  };
}

/** O que uma requisição de **bytes** devolve. Ver {@link pedirBytes} para por que ela é separada. */
export interface RespostaEmBytes {
  readonly status: number;
  /** O tipo de mídia **canonizado**: sem o parâmetro (`; charset=…`), que não é contrato. */
  readonly tipoDeConteudo: string;
  readonly disposicao: string;
  /** O corpo **cru**. É a única forma de afirmar sobre um documento que não é texto. */
  readonly bytes: Uint8Array;
  /** O corpo interpretado como JSON quando ele for JSON — derivado **só dos bytes**. */
  readonly corpo: unknown;
}

/**
 * Executa uma requisição HTTP **real** e devolve o corpo em **bytes**, sem passar por texto.
 *
 * ---------------------------------------------------------------------------
 * Por que ela é separada de {@link pedir}, e não um sinalizador dele
 * ---------------------------------------------------------------------------
 *
 * {@link pedir} consome o corpo com `text()`, que decodifica como UTF-8: um PDF que passe por ali
 * volta **corrompido**, e a corrupção é silenciosa — a assinatura `%PDF-` sobrevive, e só o conteúdo
 * binário se perde. Um sinalizador em `pedir` faria o tipo do campo `texto` depender de um argumento,
 * e todo consumidor existente passaria a lidar com uma união que não lhe interessa. Duas funções, com
 * dois tipos de retorno, é o que mantém cada chamada dizendo o que ela espera.
 *
 * ---------------------------------------------------------------------------
 * `corpo` depende SÓ dos bytes, e a mídia é asserida à parte
 * ---------------------------------------------------------------------------
 *
 * A desserialização **não** consulta o tipo de conteúdo, e a escolha é deliberada — é a mesma, e pela
 * mesma razão medida, de `pedirBoleto` em `./boleto-da-cobranca.e2e.spec.ts`, que o Gate 1 daquela
 * task corrigiu: gateá-la pelo `content-type` faria `corpo !== undefined` **implicar**
 * `application/json`, e toda asserção sobre os bytes escrita depois de uma igualdade de `corpo`
 * viraria consequência lógica dela, incapaz de reprovar em estado alcançável (AP-29). Aqui a mídia
 * tem guardiã própria e explícita — `expect(resposta.tipoDeConteudo).toBe(…)` —, que é mais forte que
 * um `includes`: compara o tipo já canonizado, por igualdade.
 *
 * O parse é **tolerante** por necessidade: bytes que não são JSON viram `undefined` em vez de
 * derrubarem o caso com `SyntaxError` dentro do acessório. É o que permite a uma resposta que anuncia
 * JSON e entrega documento reprovar na asserção nomeada, em vez de explodir antes de alcançá-la.
 *
 * ⚠️ **Ela não segue redirecionamento**, pela mesma razão de {@link pedir}.
 */
export async function pedirBytes(
  base: string,
  alvo: string,
  opcoes: OpcoesDoPedido = {},
): Promise<RespostaEmBytes> {
  const cabecalhos: Record<string, string> = { connection: 'close', origin: base };

  if (opcoes.cookie !== undefined) {
    cabecalhos.cookie = opcoes.cookie;
  }
  for (const [nome, valor] of Object.entries(opcoes.cabecalhos ?? {})) {
    cabecalhos[nome] = valor;
  }

  const resposta = await fetch(new URL(alvo, base), {
    method: opcoes.metodo ?? 'GET',
    headers: cabecalhos,
    redirect: 'manual',
  });

  const bytes = new Uint8Array(await resposta.arrayBuffer());
  const tipoDeConteudo = resposta.headers.get('content-type') ?? '';

  return {
    status: resposta.status,
    // O parâmetro do tipo de mídia (`; charset=…`) é descartado: o que a ADR-0028 declara é o tipo,
    // e um `charset` acrescentado pelo adaptador não é divergência de contrato.
    tipoDeConteudo: (tipoDeConteudo.split(';')[0] ?? '').trim(),
    disposicao: resposta.headers.get('content-disposition') ?? '',
    bytes,
    corpo: comoJson(bytes),
  };
}

/**
 * Desserializa os bytes como JSON, ou devolve `undefined` quando eles não são JSON.
 *
 * Nada aqui olha para o tipo de conteúdo — a razão está no docblock de {@link pedirBytes}, e é o que
 * separa a asserção de mídia da asserção de corpo em vez de fazer uma implicar a outra.
 */
function comoJson(bytes: Uint8Array): unknown {
  if (bytes.byteLength === 0) {
    return undefined;
  }

  try {
    return JSON.parse(new TextDecoder().decode(bytes)) as unknown;
  } catch {
    return undefined;
  }
}

/**
 * Extrai o par `nome=valor` do cookie de sessão, no formato em que o cliente o reenvia.
 *
 * Separado de {@link entrar} porque há casos que precisam da resposta inteira da entrada — o segundo
 * fator, a troca de senha obrigatória — e ainda assim querem a credencial. Levantar quando ela não
 * vem é deliberado: devolver cadeia vazia faria a requisição seguinte falhar como `401`, longe da
 * causa.
 */
export function credencialDeSessao(resposta: Resposta): string {
  const cookie = resposta.cookies.find((candidato) =>
    (candidato.split(';')[0] ?? '').split('=')[0]?.trim().endsWith(SUFIXO_DO_COOKIE_DE_SESSAO),
  );

  if (cookie === undefined) {
    throw new Error('a entrada bem-sucedida não devolveu cookie de sessão');
  }

  return cookie.split(';')[0] ?? '';
}

/**
 * Entra pelo caminho **real** — a rota pública de entrada do arcabouço de identidade.
 *
 * Nenhum estado de sessão é forjado, e a Lei do seam é o motivo: a sessão que a suíte usa é a mesma
 * que um cliente obteria, com a mesma matriz de perfil e a mesma versão de permissões. Entrada que
 * não devolve `200` levanta nomeando o status e o corpo — sem isso, o defeito apareceria como `401`
 * na primeira requisição do caso, três passos adiante da causa.
 */
export async function entrar(base: string, email: string, senha: string): Promise<string> {
  const entrada = await pedir(base, ROTA_DE_ENTRADA, {
    metodo: 'POST',
    corpo: { email, password: senha },
  });

  if (entrada.status !== 200) {
    throw new Error(`a entrada de ${email} respondeu ${String(entrada.status)}: ${entrada.texto}`);
  }

  return credencialDeSessao(entrada);
}

/**
 * As duas rotas do segundo fator do arcabouço, compostas a partir do prefixo real.
 *
 * Constantes nomeadas, e não literais no corpo: o par `enable`/`verify-totp` é contrato do
 * arcabouço, e literal repetido em duas chamadas fica livre para divergir de uma delas.
 */
const ROTA_DE_PREPARO_DO_SEGUNDO_FATOR = `${PREFIXO_DAS_ROTAS_DE_IDENTIDADE}/two-factor/enable`;
const ROTA_DE_VERIFICACAO_DO_SEGUNDO_FATOR = `${PREFIXO_DAS_ROTAS_DE_IDENTIDADE}/two-factor/verify-totp`;

/**
 * Deriva o código do segundo fator a partir do endereço de configuração devolvido pelo preparo.
 *
 * A derivação é a **do próprio arcabouço** (`api.generateTOTP`), e não uma reimplementação: uma
 * cópia do algoritmo provaria que duas implementações concordam, não que a nossa confere o código
 * que o arcabouço espera. Só a decodificação de transporte (base32 do endereço) é local, porque o
 * decodificador do arcabouço vive num pacote transitivo que `apps/api` não resolve.
 *
 * Privada de propósito: nenhuma das seis suítes convertidas a chamava fora de
 * {@link entrarComSegundoFatorCumprido}, e publicar o que ninguém consome é superfície de graça.
 */
async function codigoDoSegundoFator(autenticacao: Autenticacao, totpURI: string): Promise<string> {
  const codificado = new URL(totpURI).searchParams.get('secret');

  if (codificado === null) {
    throw new Error(`o endereço de configuração do segundo fator não trouxe segredo: ${totpURI}`);
  }

  const { code } = await autenticacao.api.generateTOTP({
    body: { secret: decodificarBase32(codificado) },
  });

  return code;
}

/**
 * Entra e **cumpre a exigência de segundo fator**, pelo caminho público real.
 *
 * O Sysloc Master nasce da carga sem segundo fator configurado, e a sessão dele é restrita até que
 * ele o configure (RN-08): sem cumpri-lo, toda rota de negócio responderia `403` da **restrição de
 * sessão**, e o diagnóstico apontaria para a autorização, que não é onde o defeito estaria. Nada é
 * forjado — o segredo sai do endereço que a própria resposta do preparo devolveu, e o código é
 * derivado pela função de geração do arcabouço (ver {@link codigoDoSegundoFator}).
 *
 * ---------------------------------------------------------------------------
 * Por que ela mora aqui: o fecho da metade do débito `D32 · F5/T7`
 * ---------------------------------------------------------------------------
 *
 * Ela existia em **SEIS** escritas privadas de `apps/api/test/` — `administracao-de-pessoas`,
 * `ciclo-de-acesso`, `cobertura-de-autorizacao`, `contexto`, `entrega-da-noticia` e
 * `recusa-indistinguivel` —, e nenhuma podia importar as outras: importar de um arquivo `.spec.ts`
 * **executa o módulo dele** e registra os casos daquela suíte dentro da importadora. Era a razão
 * mecânica de o Limiar de Três ser inexequível para este acessório, e é o que esta casa resolve —
 * ela não é `.spec.ts`.
 *
 * ---------------------------------------------------------------------------
 * A forma que subiu é a de CINCO das seis, e a sexta divergia
 * ---------------------------------------------------------------------------
 *
 * A verificação emite credencial de sessão **nova** e apaga a anterior, e é a nova que sai daqui,
 * por {@link credencialDeSessao} — que **levanta** quando ela não vem. A cópia de
 * `./entrega-da-noticia.e2e.spec.ts` era a única a tolerar a ausência (devolvia a credencial
 * anterior) e a reconhecer o cookie por substring do texto bruto, em vez do **nome** por sufixo.
 * Subiu a estrita porque a tolerante **remove** o levantamento diagnóstico das outras cinco — e
 * afrouxar cinco suítes para acomodar um ramo que o arcabouço nunca produz é a regressão que a
 * §4.3 do Protocolo Antirregressão proíbe.
 *
 * ⚠️ **O que prova que aquele ramo era inalcançável é a suíte sair VERDE — não a contagem.**
 * {@link credencialDeSessao} **levanta** quando a credencial não vem, e é chamada dentro do
 * `beforeAll` de `./entrega-da-noticia.e2e.spec.ts`: um ramo alcançável reprovaria os **15** casos
 * daquela suíte **sem mover a contagem deles**. Os 15 saíram verdes na T3, e de novo na conferência
 * de 2026-09-02. A afirmação de que *"a contagem daquela suíte não se moveu na baseline caso a caso
 * da T3"* **permanece verdadeira e continua valendo** — mas ela prova que **nenhum caso sumiu**, e
 * não que o ramo era morto. **Não a reponha como prova de inalcançabilidade** (débito `D4` da §2 da
 * fatia `painel-master-administradores`, corrigido em 2026-09-02): registrar instrumento fraco num
 * docblock permanente é o que a `.claude/rules/testing-stack.md` adverte — *"prova inconclusiva é
 * pior que prova ausente, ela consta como feita"*.
 *
 * @param base Origem da aplicação sob teste. Parâmetro, e não variável de módulo, pela mesma razão
 *   de {@link pedir}: a porta é dinâmica e cada suíte tem a sua — e há suíte com **duas** montagens,
 *   caso em que a origem que emite a credencial tem de ser a mesma que a requisição seguinte usa.
 * @param senha A senha da carga daquela pessoa. Ela viaja **duas vezes**: na entrada e na
 *   confirmação que o preparo do segundo fator exige.
 * @param autenticacao A instância do arcabouço da suíte (`identidade.autenticacao`). Parâmetro pela
 *   mesma razão da `base`: cada suíte monta a sua sobre a instância efêmera dela.
 */
export async function entrarComSegundoFatorCumprido(
  base: string,
  email: string,
  senha: string,
  autenticacao: Autenticacao,
): Promise<string> {
  const cookie = await entrar(base, email, senha);

  const preparo = await pedir(base, ROTA_DE_PREPARO_DO_SEGUNDO_FATOR, {
    metodo: 'POST',
    cookie,
    corpo: { password: senha },
  });

  if (preparo.status !== 200) {
    throw new Error(
      `o preparo do segundo fator respondeu ${String(preparo.status)}: ${preparo.texto}`,
    );
  }

  const totpURI = (preparo.corpo as { totpURI?: unknown }).totpURI;
  if (typeof totpURI !== 'string') {
    throw new Error('o preparo do segundo fator não devolveu o endereço de configuração');
  }

  const ativacao = await pedir(base, ROTA_DE_VERIFICACAO_DO_SEGUNDO_FATOR, {
    metodo: 'POST',
    cookie,
    corpo: { code: await codigoDoSegundoFator(autenticacao, totpURI) },
  });

  if (ativacao.status !== 200) {
    throw new Error(
      `a ativação do segundo fator respondeu ${String(ativacao.status)}: ${ativacao.texto}`,
    );
  }

  return credencialDeSessao(ativacao);
}

/**
 * Concede as chaves informadas a uma pessoa, pelo **caminho real da camada de dados**.
 *
 * Sob o contexto de tenant da empresa dela e dentro da unidade de trabalho, com a coerência
 * ação→tela validada pela função de domínio — é o mesmo caminho que a rota do Admin usa por dentro,
 * e é por isso que um conjunto que deixasse ação concedida sem a tela que a comporta é recusado aqui
 * como seria lá (RN-02).
 *
 * @param banco O acesso ao banco da suíte. Parâmetro, e não variável de módulo, pela mesma razão da
 *   `base` em {@link pedir}: cada suíte abre o seu contra a instância efêmera dela.
 */
export async function conceder(
  banco: AcessoAoBanco,
  usuarioId: string,
  empresaId: string,
  chaves: readonly ChaveDoCatalogo[],
): Promise<void> {
  await contextoDeTenant.executarCom({ empresaId }, async () => {
    await banco.emUnidadeDeTrabalho(async (tx) => {
      await escreverAjustes(tx, {
        usuarioId,
        ajustes: chaves.map((chave) => ({ chave, efeito: 'CONCEDIDA' as const })),
        validarCoerencia: validarCoerenciaDeAjustes,
      });
    });
  });
}

/**
 * Quantas linhas de sessão a pessoa tem, **cruas** — contadas no banco, não deduzidas da borda.
 *
 * ---------------------------------------------------------------------------
 * Por que ela mora aqui: o fecho do débito `D9 · F7/T4`
 * ---------------------------------------------------------------------------
 *
 * Ela existia em **TRÊS** escritas privadas de `apps/api/test/`, **byte a byte idênticas** —
 * `./master-administradores.e2e.spec.ts`, `./administracao-de-pessoas.e2e.spec.ts` e
 * `./ciclo-de-acesso.e2e.spec.ts` (medido em 2026-09-02). O Limiar de Três **já havia disparado**;
 * o débito que a registrou dizia *"duas"*, e a medição desta passada o corrigiu para três.
 *
 * O custo da duplicação não era estético: endurecer uma delas — filtrar por expiração, acrescentar
 * uma coluna ao `select` — deixaria as outras duas para trás **em silêncio**, e nenhuma asserção
 * acusaria, porque cada suíte seguiria verde medindo uma contagem ligeiramente diferente da que as
 * outras medem. É a mesma classe que este arquivo fechou para `pedir`, `entrar` e `conceder`.
 *
 * ---------------------------------------------------------------------------
 * Por que a contagem é CRUA, e não a resposta de uma rota
 * ---------------------------------------------------------------------------
 *
 * É ela que discrimina *"sessão encerrada"* de *"pessoa marcada e recusada na guarda"*. Um `401` na
 * operação seguinte passa nas duas implementações; a contagem indo a zero passa só na primeira, e é
 * a RN-03 que exige a primeira. Trocá-la por qualquer leitura mediada pela borda devolve ao caso a
 * ambiguidade que ele existe para remover.
 *
 * @param acesso O acesso restrito a `identidade` da suíte (`identidade.acesso`). Parâmetro, e não
 *   variável de módulo, pela mesma razão do `banco` em {@link conceder}: cada suíte abre o seu
 *   contra a instância efêmera dela.
 * @param usuarioId A pessoa cujas sessões se contam.
 */
export async function contarSessoesDaPessoa(
  acesso: AcessoAIdentidade,
  usuarioId: string,
): Promise<number> {
  const { sessao } = esquemaIdentidade;

  const linhas = await acesso.identidade
    .select({ id: sessao.id })
    .from(sessao)
    .where(eq(sessao.usuarioId, usuarioId));

  return linhas.length;
}
