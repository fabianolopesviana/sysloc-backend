/**
 * A reescrita do registro de sessão acontece por **MUDANÇA**, e não por requisição — provada pela
 * ESCRITA, não pelo valor.
 *
 * ---------------------------------------------------------------------------
 * INVARIANTES
 * ---------------------------------------------------------------------------
 *
 * | Critério | Caso       | Invariante |
 * |---|---|---|
 * | CA-20 | T4 §4-6 | `regravarEfetivoDaSessao` emite **escrita física** na linha de
 * | CA-21 |         | `identidade.sessao` quando o retrato resultante difere do gravado, e **não
 * |       |         | emite escrita alguma** quando ele é igual — nem na primeira repetição, nem na
 * |       |         | segunda. O observável é a **versão da tupla** (`xmin`), que muda a cada
 * |       |         | `UPDATE` do banco ainda que os valores gravados sejam idênticos.
 * |       |         | (RN-03, RN-17, ADR-0010) |
 *
 * Rastreabilidade: `CA-20 → T4 §4-6 (RN-03)`, `CA-21 → T4 §4-6 (RN-17)`.
 *
 * ---------------------------------------------------------------------------
 * Por que este caso existe: a prova de valor NÃO podia falhar pelo defeito que nomeava
 * ---------------------------------------------------------------------------
 *
 * O **CT-219** (`apps/api/test/ponto-de-aplicacao.spec.ts`) prova o invariante pelo **valor** das
 * três colunas: retrato antigo antes da mudança, retrato novo depois dela, e valor imutável nas
 * requisições seguintes. Isso cobre "o que ficou gravado" e deixa **sem asserção** "houve ou não
 * gravação" — e a distinção é justamente o que a ADR-0010 compra: uma reescrita **idempotente** não
 * muda valor algum, de modo que a implementação que reescrevesse a cada requisição passaria naquele
 * caso inteiro.
 *
 * Isso foi **medido**, não inferido. Com o desvio de `efetivoCorrente` removido da guarda **e** o
 * curto-circuito de igualdade de {@link regravarEfetivoDaSessao} neutralizado — isto é, com toda
 * leitura autenticada virando uma escrita —, a suíte de `@sysloc/api` fechou em
 * `9 arquivos, 59 casos, tudo verde`. É o padrão que a `.claude/rules/testing-stack.md` registra
 * como causa de três das cinco rodadas reprovadas da T2 desta base: *"provou-se o que era fácil
 * provar (o valor) e deixou-se sem asserção o que era difícil (o efeito terminal)"*.
 *
 * ---------------------------------------------------------------------------
 * Por que a prova desce uma camada — a medição que descartou a via de cima
 * ---------------------------------------------------------------------------
 *
 * A observação idiomática seria ler `xmin` da linha de `identidade.sessao` **no caso de rota**, em
 * volta de cada requisição. Ela foi **medida e descartada**: o arcabouço de identidade renova a
 * sessão **a cada uso** (`RENOVACAO_DA_SESSAO_EM_SEGUNDOS = 0`, e é o que
 * `test/sessao.spec.ts` já afirma), de modo que **toda** leitura autenticada reescreve a linha por
 * conta própria. A medição, com três leituras autenticadas seguidas e nenhuma mudança de permissão:
 *
 * ```
 * xmin: ['769', '772', '773', '774']   → 4 valores distintos de 4
 * ```
 *
 * Quatro versões de tupla para zero mudanças de permissão. Naquele nível o marcador muda de todo
 * jeito, o eixo negativo seria **impossível de afirmar**, e a coluna `atualizada_em` — a outra
 * candidata — é escrita pelo mesmo caminho do arcabouço. Uma asserção ali seria ruído com aparência
 * de prova.
 *
 * Aqui não há ruído por construção: este arquivo **nunca** chama o arcabouço depois da entrada. A
 * única coisa que toca a linha entre uma leitura de marcador e a seguinte é a chamada sob prova.
 *
 * ---------------------------------------------------------------------------
 * Por que o caso NÃO se chama `CT-219`
 * ---------------------------------------------------------------------------
 *
 * O CT-219 tem casa: `apps/api/test/ponto-de-aplicacao.spec.ts`, sobre a requisição HTTP real, e
 * continua lá, íntegro. Reutilizar o identificador aqui criaria **duas implementações do mesmo CT
 * em pacotes diferentes**, e a rastreabilidade passaria a apontar para dois lugares — que é
 * exatamente a razão registrada em `test/sessao.spec.ts` para não reaproveitar `CT-018` e `CT-024`
 * naquele arquivo. A forma usada é a mesma que aquele arquivo já estabeleceu: **nomear o caso pela
 * seção da task que o exige**. `T4 §4-6` é o sexto item do Aceite Técnico da T4 —
 * *"Requisição sem divergência **não** altera as colunas da sessão"*.
 *
 * Os dois casos são complementares e nenhum substitui o outro: o CT-219 prova **o que fica gravado
 * atravessando a rota**; este prova **que a gravação só acontece quando precisa**, que é a
 * propriedade que o docblock de {@link regravarEfetivoDaSessao} declara ser *"da função, e não do
 * acaso"* — e que, até aqui, não tinha rede alguma.
 *
 * ---------------------------------------------------------------------------
 * Por que `xmin`, e por que ele discrimina
 * ---------------------------------------------------------------------------
 *
 * `xmin` é a coluna de sistema que carrega o identificador da transação que criou a **versão
 * corrente da tupla**. Todo `UPDATE` do PostgreSQL cria uma versão nova — inclusive o que grava
 * exatamente os mesmos valores, porque o banco não tem escrita nula. O marcador muda, então, pela
 * **escrita**, e não pelo efeito dela: é precisamente o observável que faltava.
 *
 * O par é o que detecta, e não a asserção isolada. O eixo **positivo** (a divergência muda o
 * marcador) é o que impede o eixo negativo de ser vácuo: sem ele, um marcador que nunca mudasse —
 * uma leitura quebrada, uma linha errada — satisfaria "não mudou" por construção.
 */

import { esquemaIdentidade, SENHA_DA_CARGA } from '@sysloc/db';
import { eq, sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { carregarRetratoDaSessao, regravarEfetivoDaSessao } from '../src/autorizacao.ts';
import type { ChaveDoCatalogo } from '../src/catalogo-de-permissoes.ts';
import { calcularEfetivo } from '../src/efetivo.ts';
import { type IdentidadeEfemera, identidadeEfemera, pessoaSemeada } from './identidade-efemera.ts';

/** O sujeito do caso — pessoa de empresa, cuja matriz de perfil é o piso de uma tela só. */
const PESSOA = pessoaSemeada('usuario.a@exemplo.com.br');

/** A área de tela concedida no retrato novo. */
const TELA_CONCEDIDA: ChaveDoCatalogo = 'TELA:financeiro';

/** A ação sensível concedida junto — é ela que faz o retrato exercitar os DOIS eixos da repartição. */
const ACAO_CONCEDIDA: ChaveDoCatalogo = 'ACAO:emitir_boleto';

/** A versão de permissão que passa a datar o retrato. Não é zero: zero é o estado de nascimento. */
const VERSAO_APOS_A_MUDANCA = 1;

/**
 * O efetivo do retrato novo, **derivado da matriz do SUT** e nunca redigitado.
 *
 * Mesmo critério do CT-202: uma lista escrita à mão passaria a reprovar por toda mudança legítima
 * da matriz do perfil, e deixaria de discriminar o que este caso persegue.
 */
const EFETIVO_NOVO: readonly ChaveDoCatalogo[] = calcularEfetivo(PESSOA.perfil, [
  { chave: TELA_CONCEDIDA, efeito: 'CONCEDIDA' },
  { chave: ACAO_CONCEDIDA, efeito: 'CONCEDIDA' },
]);

/**
 * O retrato que a gravação deve produzir, **repartido nos dois eixos**.
 *
 * Escrito por extenso de propósito: é a **expectativa revisada**, e derivá-lo do mesmo predicado de
 * pertinência que `repartirEfetivo` usa faria o caso concordar consigo mesmo — a reimplementação do
 * SUT no próprio verificador que a `.claude/rules/testing-stack.md` registra como causa de
 * reprovação. A ordem é a de `calcularEfetivo` (crescente), preservada dentro de cada eixo.
 */
const RETRATO_ESPERADO = {
  telas: ['TELA:financeiro', 'TELA:resumo'],
  acoes: ['ACAO:emitir_boleto'],
  versaoPermissoes: VERSAO_APOS_A_MUDANCA,
} as const;

/** Quantas chamadas SEM divergência o eixo negativo executa. */
const REPETICOES_SEM_DIVERGENCIA = ['primeira', 'segunda'] as const;

let identidade: IdentidadeEfemera;
let sessaoId: string;

beforeAll(async () => {
  identidade = await identidadeEfemera();
  sessaoId = await entrarEObterSessao();
});

afterAll(async () => {
  await identidade?.parar();
});

describe('T4 §4-6 — o registro de sessão é reescrito por mudança, não por chamada', () => {
  it('a divergência escreve na linha; as duas chamadas seguintes, sem divergência, não escrevem', async () => {
    const banco = identidade.acesso.identidade;

    const inicial = await carregarRetratoDaSessao(banco, sessaoId);
    expect(inicial).toBeDefined();

    // A linha nasce no padrão do schema, porque quem a cria é o arcabouço, que não conhece as três
    // colunas. Sem esta âncora, o caso poderia partir de um retrato já montado e a primeira
    // gravação deixaria de ser uma divergência.
    expect(inicial?.montado).toBe(false);

    const antes = await marcadorDaLinhaDeSessao();

    // --- eixo POSITIVO: a divergência escreve ------------------------------------------------
    const gravado = await regravarEfetivoDaSessao(banco, sessaoId, {
      efetivo: EFETIVO_NOVO,
      versaoPermissoes: VERSAO_APOS_A_MUDANCA,
      gravado: inicial?.efetivo,
    });

    expect(gravado).toEqual(RETRATO_ESPERADO);
    expect(await colunasDaSessao()).toEqual(RETRATO_ESPERADO);

    const depoisDaMudanca = await marcadorDaLinhaDeSessao();

    // É este eixo que impede o de baixo de ser vácuo: ele demonstra, no MESMO harness e na MESMA
    // linha, que o marcador se move quando há escrita. Um marcador que nunca mudasse satisfaria
    // "não mudou" por construção, e a prova inteira seria infalsificável.
    expect(
      depoisDaMudanca,
      'a gravação por divergência não produziu versão nova da tupla: o marcador não discrimina',
    ).not.toBe(antes);

    // --- eixo NEGATIVO: duas chamadas com o resultado JÁ gravado -------------------------------
    //
    // `gravado` é o retrato que a chamada acima acabou de escrever, e é exatamente o que a guarda
    // repassa quando o recálculo chega ao mesmo lugar. A asserção não é sobre o valor — ele
    // continuaria idêntico numa implementação que reescrevesse tudo de novo —, e sim sobre a
    // AUSÊNCIA da escrita.
    for (const ordinal of REPETICOES_SEM_DIVERGENCIA) {
      const repetida = await regravarEfetivoDaSessao(banco, sessaoId, {
        efetivo: EFETIVO_NOVO,
        versaoPermissoes: VERSAO_APOS_A_MUDANCA,
        gravado,
      });

      // O retorno continua sendo o retrato correto: "não escreveu" não pode virar "devolveu outra
      // coisa" sem que este caso acuse.
      expect(repetida).toEqual(RETRATO_ESPERADO);
      expect(await colunasDaSessao()).toEqual(RETRATO_ESPERADO);

      expect(
        await marcadorDaLinhaDeSessao(),
        `a ${ordinal} chamada sem divergência escreveu na linha de sessão: a reescrita virou por chamada, e não por mudança`,
      ).toBe(depoisDaMudanca);
    }
  });
});

/**
 * Entra pelo caminho real e devolve o identificador da sessão criada.
 *
 * Pela rota do arcabouço, e não por inserção à mão: a linha precisa nascer como as de produção
 * nascem — com as três colunas de efetivo no padrão do schema —, e uma linha forjada provaria um
 * estado inicial que não existe.
 */
async function entrarEObterSessao(): Promise<string> {
  const entrada = await identidade.autenticacao.api.signInEmail({
    body: { email: PESSOA.email, password: SENHA_DA_CARGA },
    asResponse: true,
  });

  if (entrada.status !== 200) {
    throw new Error(`a entrada de ${PESSOA.email} respondeu ${String(entrada.status)}`);
  }

  const { sessao } = esquemaIdentidade;
  const linhas = await identidade.acesso.identidade
    .select({ id: sessao.id })
    .from(sessao)
    .where(eq(sessao.usuarioId, PESSOA.id));

  const [linha] = linhas;
  if (linhas.length !== 1 || linha === undefined) {
    throw new Error(
      `esperava exatamente uma sessão para ${PESSOA.email}, e há ${String(linhas.length)}`,
    );
  }

  return linha.id;
}

/**
 * A versão corrente da tupla da linha de sessão — o marcador que muda a cada escrita FÍSICA.
 *
 * Sem parâmetro na consulta, e com a cardinalidade afirmada: a instância é efêmera e tem uma sessão
 * só, então ler todas e conferir que há exatamente uma — e que é a nossa — é mais forte do que
 * filtrar. Um segundo registro de sessão tornaria "o marcador" ambíguo, e a igualdade passaria a
 * depender da ordem em que o banco devolvesse as linhas.
 */
async function marcadorDaLinhaDeSessao(): Promise<string> {
  const linhas = await identidade.acesso.identidade.execute<{ id: string; marca: string }>(sql`
    SELECT id::text AS id, xmin::text AS marca
      FROM identidade.sessao
  `);

  const registros = [...linhas];
  const [registro] = registros;

  if (registros.length !== 1 || registro === undefined) {
    throw new Error(`esperava exatamente uma linha de sessão, e há ${String(registros.length)}`);
  }

  if (registro.id !== sessaoId) {
    throw new Error(`a linha de sessão observada (${registro.id}) não é a do caso (${sessaoId})`);
  }

  return registro.marca;
}

/**
 * As três colunas de efetivo como o banco as guarda — **sem reordenar**.
 *
 * Sem `sort()` de propósito: a ordem gravada é a que `calcularEfetivo` produziu e que
 * `repartirEfetivo` preservou, e é dela que a comparação posicional de `saoIguais` depende.
 * Normalizar aqui esconderia uma gravação fora de ordem, que faria o curto-circuito de igualdade
 * deixar de reconhecer o próprio retrato — e a reescrita voltaria a acontecer por chamada.
 */
async function colunasDaSessao(): Promise<{
  telas: string[];
  acoes: string[];
  versaoPermissoes: number;
}> {
  const { sessao } = esquemaIdentidade;

  const linhas = await identidade.acesso.identidade
    .select({
      telas: sessao.telas,
      acoes: sessao.acoes,
      versaoPermissoes: sessao.versaoPermissoes,
    })
    .from(sessao)
    .where(eq(sessao.id, sessaoId));

  const [linha] = linhas;
  if (linha === undefined) {
    throw new Error(`a sessão ${sessaoId} desapareceu entre a entrada e a leitura`);
  }

  return {
    telas: [...linha.telas],
    acoes: [...linha.acoes],
    versaoPermissoes: linha.versaoPermissoes,
  };
}
