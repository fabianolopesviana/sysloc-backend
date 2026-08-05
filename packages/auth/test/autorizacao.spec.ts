/**
 * Domínio da autorização — CT-201 a CT-205.
 *
 * ---------------------------------------------------------------------------
 * INVARIANTES
 * ---------------------------------------------------------------------------
 *
 * | Critério | CT     | Invariante |
 * |----------|--------|------------|
 * | CA-23    | CT-201 | O catálogo publicado tem exatamente 10 chaves de tela e 7 de ação, cada
 * |          |        | uma com o prefixo do seu eixo, sem duplicata entre os dois, e toda ação
 * |          |        | tem exatamente UMA tela correspondente no mapa, cujo valor pertence ao
 * |          |        | conjunto das 10 telas. O predicado de pertinência aceita as 17 e recusa o
 * |          |        | que não está lá. |
 * | CA-09    | CT-202 | Para qualquer combinação de perfil e ajustes individuais, o efetivo é
 * | CA-10    |        | exatamente `(matriz do perfil ∪ concedidas) − negadas` — igualdade de
 * | CA-23    |        | conjunto inteiro, nem um elemento a mais nem a menos. |
 * | CA-10    | CT-203 | Uma chave com ajuste `NEGADA` nunca aparece no efetivo: nem quando o perfil
 * |          |        | a concede, nem quando existe `CONCEDIDA` para a mesma chave, nem conforme
 * |          |        | a ordem em que os ajustes chegam à função. |
 * | CA-09    | CT-204 | Conceder individualmente uma chave acrescenta ao efetivo exatamente essa
 * |          |        | chave — a diferença simétrica entre o efetivo com e sem a concessão tem
 * |          |        | cardinalidade 1. |
 * | CA-11    | CT-205 | A validação de coerência RECUSA o conjunto em que uma ação fica concedida
 * |          |        | sem que a tela correspondente esteja no efetivo resultante, e a recusa
 * |          |        | nomeia a tela que precisa ser liberada junto. |
 *
 * Rastreabilidade: `CA-23 → CT-201 (RN-15)`, `CA-09 → CT-202 (RN-01)`, `CA-10 → CT-202 (RN-01)`,
 * `CA-23 → CT-202 (RN-15)`, `CA-10 → CT-203 (RN-01)`, `CA-09 → CT-204 (RN-01)` e
 * `CA-11 → CT-205 (RN-02)`.
 *
 * ---------------------------------------------------------------------------
 * Por que sem fronteira de execução real — e onde ela está
 * ---------------------------------------------------------------------------
 *
 * O SUT desta task é código puro: três módulos de constantes e duas funções sem banco, sem relógio
 * e sem requisição. `Real execution boundary: none` não é dispensa da Iron Law #4 — é o
 * reconhecimento de que a fronteira real desta CLASSE de invariante mora nas tasks vizinhas, que já
 * a declaram: a impossibilidade de concessão e negação coexistirem na mesma chave é do banco
 * (CT-206, T3, sobre a unicidade do trio da migração `0003`), e a decisão chegando à rota é do
 * CT-211 em diante (T4, HTTP real). Aqui se prova a ARITMÉTICA da precedência, que é onde o
 * conflito ainda é representável e onde uma inversão de ordem passaria despercebida por todo o
 * resto da suíte.
 *
 * ---------------------------------------------------------------------------
 * Por que o esperado é RE-DERIVADO da matriz do SUT, e nunca redigitado
 * ---------------------------------------------------------------------------
 *
 * Nenhum caso escreve à mão a lista de chaves que espera. Um teste que redigitasse
 * `['TELA:resumo', …]` provaria a lista redigitada — passaria a reprovar por toda mudança legítima
 * da matriz e, pior, deixaria de discriminar o defeito que persegue: bastaria o SUT devolver a
 * constante errada com o mesmo conteúdo para os dois lados concordarem.
 *
 * Cada linha da tabela do CT-202 declara, então, o **delta** sobre `MATRIZ_POR_PERFIL[perfil]` —
 * `comA(base, chave)` ou `semA(base, chave)` —, nunca uma reimplementação genérica de
 * `(perfil ∪ concedidas) − negadas`. A distinção importa e é a que
 * `.claude/rules/testing-stack.md` registra como causa de reprovação: uma tabela que reimplementa o
 * SUT no próprio verificador aprova o SUT com o defeito de volta, porque as duas implementações
 * erram juntas. `comA` e `semA` acrescentam e removem UM elemento — não sabem nada sobre ordem de
 * operações, que é justamente a propriedade sob prova.
 */

import { CodigoErro, ErroDeAplicacao } from '@sysloc/shared';
import { describe, expect, it } from 'vitest';
import {
  CHAVES_DE_ACAO,
  CHAVES_DE_TELA,
  type ChaveDoCatalogo,
  ehChaveDoCatalogo,
  MAPA_ACAO_TELA,
} from '../src/catalogo-de-permissoes.ts';
import {
  type AjusteDePermissao,
  calcularEfetivo,
  validarCoerenciaDeAjustes,
} from '../src/efetivo.ts';
import { MATRIZ_POR_PERFIL } from '../src/matriz-de-perfil.ts';
import type { Perfil } from '../src/perfis.ts';
import { diferencasDeConjunto } from './conjuntos.ts';

// ===========================================================================
// Ferramental — deltas de UM elemento, nunca a operação inteira
// ===========================================================================

/** As duas cardinalidades que a RN-15 fixa, e que o CT-201 afirma literalmente. */
const TOTAL_DE_TELAS = 10;
const TOTAL_DE_ACOES = 7;

/**
 * A ação usada como exemplo corrente, e a tela que a comporta.
 *
 * São as duas chaves que o card do CT-205 nomeia literalmente no resultado esperado. Ficam aqui
 * como constantes para que a asserção do `detalhes` e o cenário que a produz não possam divergir.
 */
const ACAO_DO_EXEMPLO = 'ACAO:emitir_boleto' as const;
const TELA_QUE_COMPORTA_O_EXEMPLO = 'TELA:financeiro' as const;

/** Mensagem canônica da recusa de coerência — parte do envelope da ADR-0012, asserida por inteiro. */
const MENSAGEM_DA_RECUSA = 'a ação sensível concedida exige a área de tela correspondente';

function conceder(chave: ChaveDoCatalogo): AjusteDePermissao {
  return { chave, efeito: 'CONCEDIDA' };
}

function negar(chave: ChaveDoCatalogo): AjusteDePermissao {
  return { chave, efeito: 'NEGADA' };
}

/** O conjunto base MAIS uma chave, ordenado. Não sabe o que é concessão nem negação. */
function comA(base: readonly ChaveDoCatalogo[], chave: ChaveDoCatalogo): ChaveDoCatalogo[] {
  return [...new Set([...base, chave])].sort();
}

/** O conjunto base MENOS uma chave, ordenado. Idem. */
function semA(base: readonly ChaveDoCatalogo[], chave: ChaveDoCatalogo): ChaveDoCatalogo[] {
  return base.filter((candidata) => candidata !== chave).sort();
}

/**
 * Igualdade de conjunto INTEIRO, em duas asserções que se complementam.
 *
 * A primeira nomeia o que sobra e o que falta (`diferencasDeConjunto`, o mesmo acessório que
 * `admissao.spec.ts` e `definicao-de-senha.spec.ts` já usam), para que a reprovação seja legível e
 * ninguém sinta vontade de afrouxá-la na rodada seguinte. A segunda é a comparação profunda do
 * arranjo ordenado, que é o que também prende ORDEM e REPETIDOS — dois eixos que a comparação de
 * conjunto, sozinha, deixaria passar. Nenhuma delas é `contains`.
 */
function afirmarConjuntoIgual(
  obtido: readonly ChaveDoCatalogo[],
  esperado: readonly ChaveDoCatalogo[],
): void {
  expect(diferencasDeConjunto(obtido, esperado)).toEqual({ excedentes: [], ausentes: [] });
  expect([...obtido]).toEqual([...esperado].sort());
}

/**
 * Executa o que deveria recusar e devolve a recusa.
 *
 * O ramo de saída sem exceção **falha o caso ruidosamente**: a RN-02 é explícita em que o conjunto
 * incoerente é *"recusado no momento de salvar (…) nunca aceito e silenciosamente ignorado"*, e um
 * `try` que engolisse o caminho feliz transformaria exatamente essa omissão em verde.
 */
function capturarRecusa(executar: () => void): ErroDeAplicacao {
  try {
    executar();
  } catch (erro) {
    expect(erro).toBeInstanceOf(ErroDeAplicacao);
    return erro as ErroDeAplicacao;
  }
  throw new Error('a validação ACEITOU o conjunto incoerente — nenhuma exceção foi levantada');
}

// ===========================================================================
// CT-201 — o catálogo é fechado em 17 chaves e o mapa ação→tela é total
// ===========================================================================

/**
 * PROVA DE FALSIFICAÇÃO — a asserção de prefixo do CT-201, com comando literal e saída medida.
 *
 * A classe que ela fecha é *"chave com prefixo malformado entra num eixo e nada reprova"*: o
 * `satisfies Readonly<Record<string, ChaveDeTela>>` de `MAPA_ACAO_TELA` prende os VALORES às 10
 * telas e deixa as CHAVES como `string` livre. O mutante correspondente compila, mantém o
 * comprimento em 7, mantém a união em 17, mantém todo alvo dentro das telas e é aceito por
 * `ehChaveDoCatalogo` — nenhuma das outras asserções do caso o alcança.
 *
 * **Invocação**: `pnpm --filter @sysloc/auth test` — nunca `vitest run` avulso, pela mesma razão
 * registrada no bloco do CT-203 (`exports` resolve `"."` para `dist/`, e o mutante ficaria no fonte
 * sem alcançar o que executa).
 *
 * **Resultado, 2026-08-04** (`packages/auth/src/catalogo-de-permissoes.ts`, sha256 conferido idêntico
 * antes e depois: `2d3f6e2975246a30ac6738338a99bd99542c7c4bb5d3e5cd2112da1a6043dcbe`):
 *
 * | Fonte | Resultado |
 * |---|---|
 * | mutante `'ACAO:enviar_cobranca_manual'` → `'ACOA:enviar_cobranca_manual'` | **1 failed, 73 passed** |
 * | íntegro (controle) | **74 passed**, limpo |
 *
 * A única reprovação é a asserção nova, e ela NOMEIA a chave malformada — que é por que ela é
 * `filter(...).toEqual([])` e não `every(...)`:
 * `AssertionError: expected [ 'ACOA:enviar_cobranca_manual' ] to deeply equal []`.
 *
 * **Por que o mutante é `enviar_cobranca_manual` e não `emitir_boleto`.** Foi medido: renomear
 * `'ACAO:emitir_boleto'` **não chega ao Vitest** — a constante `ACAO_DO_EXEMPLO` deste arquivo a
 * consome como `ChaveDoCatalogo`, e `tsc --build` aborta com 17 erros `TS2345`/`TS2820` antes de o
 * primeiro caso rodar. Seria prova inconclusiva sobre a asserção, ainda que reprove.
 * `enviar_cobranca_manual` não é referenciada em lugar nenhum fora do mapa, e por isso **isola**: o
 * mutante compila limpo e a única coisa que o pega é a asserção sob prova.
 */

describe('CT-201 — o catálogo é fechado em 17 chaves e o mapa ação→tela é total sobre as 7 ações', () => {
  it('os dois eixos têm 10 e 7 chaves, sem repetida dentro de um nem colisão entre eles', () => {
    expect(CHAVES_DE_TELA).toHaveLength(TOTAL_DE_TELAS);
    expect(CHAVES_DE_ACAO).toHaveLength(TOTAL_DE_ACOES);

    // Repetida DENTRO de um eixo: um arranjo com a mesma chave duas vezes teria o comprimento
    // certo e um conjunto menor. Sem estas duas, `TELA:resumo` escrita em dobro passaria.
    expect(new Set(CHAVES_DE_TELA).size).toBe(TOTAL_DE_TELAS);
    expect(new Set(CHAVES_DE_ACAO).size).toBe(TOTAL_DE_ACOES);

    // Colisão ENTRE os eixos: a união tem de valer a soma. É o que fecha o catálogo em 17.
    expect(new Set<string>([...CHAVES_DE_TELA, ...CHAVES_DE_ACAO]).size).toBe(
      TOTAL_DE_TELAS + TOTAL_DE_ACOES,
    );
  });

  it('o mapa cobre exatamente as 7 ações, e todo alvo dele é uma das 10 telas', () => {
    // "As chaves do mapa são o catálogo de ações" NÃO é mais asserção de tempo de execução, e a
    // ausência dela é deliberada: `ChaveDeAcao = keyof typeof MAPA_ACAO_TELA` e
    // `CHAVES_DE_ACAO = Object.freeze(Object.keys(MAPA_ACAO_TELA))` fazem dela propriedade do
    // COMPILADOR. Escrita como asserção, os dois lados seriam a MESMA expressão avaliada duas vezes
    // sobre um objeto congelado — nenhum estado do SUT a reprovaria (AP-29). Não a reintroduza
    // achando que faltou; o que ela nomeava está garantido antes de o teste rodar.
    //
    // O que o compilador NÃO alcança — e por isso é asserido aqui — é a FORMA da chave. O
    // `satisfies Readonly<Record<string, ChaveDeTela>>` prende os VALORES do mapa às 10 telas e
    // deixa as CHAVES como `string` livre; `CHAVES_DE_TELA` é literal e não restringe forma
    // nenhuma. Uma entrada com prefixo errado — `'ACOA:emitir_boleto'` — compila, entra na união,
    // mantém o comprimento em 7, mantém a união em 17, mantém todo alvo dentro das telas e é aceita
    // pelo predicado de pertinência. É o prefixo, varrido em CADA elemento de CADA eixo, que a
    // recusa. `filter(...).toEqual([])` e não `every(...)`: a reprovação NOMEIA a chave malformada,
    // em vez de dizer apenas `false`.
    expect(CHAVES_DE_ACAO.filter((acao) => !acao.startsWith('ACAO:'))).toEqual([]);
    expect(CHAVES_DE_TELA.filter((tela) => !tela.startsWith('TELA:'))).toEqual([]);

    // Totalidade: nenhuma entrada no mapa além das 7 ações — `Object.keys` sobre um objeto não pode
    // ter chave repetida, e é isso que torna o "exatamente UMA tela por ação" propriedade da
    // estrutura.
    const alvos = Object.values(MAPA_ACAO_TELA);
    expect(alvos).toHaveLength(TOTAL_DE_ACOES);
    // Só `excedentes`: nem toda tela comporta ação (Resumo, Relatórios e Usuários não comportam
    // nenhuma), então exigir `ausentes: []` afirmaria uma coisa que a matriz não diz.
    expect(diferencasDeConjunto(alvos, CHAVES_DE_TELA).excedentes).toEqual([]);
  });

  it('o predicado de pertinência aceita as 17 chaves e recusa a chave inventada', () => {
    // O companheiro POSITIVO existe porque sem ele um predicado que devolvesse `false` sempre
    // passaria no caso negativo — e seria a falha mais grave possível aqui, já que recusaria
    // qualquer ajuste legítimo na borda.
    for (const chave of [...CHAVES_DE_TELA, ...CHAVES_DE_ACAO]) {
      expect(ehChaveDoCatalogo(chave)).toBe(true);
    }

    expect(ehChaveDoCatalogo('TELA:inexistente')).toBe(false);
    expect(ehChaveDoCatalogo('ACAO:inexistente')).toBe(false);
    // O prefixo sozinho não basta, e o nome sozinho tampouco: a chave é o par.
    expect(ehChaveDoCatalogo('financeiro')).toBe(false);
    expect(ehChaveDoCatalogo('ACAO:financeiro')).toBe(false);
  });
});

// ===========================================================================
// CT-202 — o efetivo é (perfil ∪ concedidas) − negadas, por tabela
// ===========================================================================

/** Uma linha da tabela: o cenário, e o delta que ele produz sobre a matriz do perfil. */
interface CenarioDeEfetivo {
  readonly nome: string;
  readonly perfil: Perfil;
  readonly ajustes: readonly AjusteDePermissao[];
  /** Função, e não valor: `MATRIZ_POR_PERFIL` é lida na hora do caso, do SUT. */
  readonly esperado: () => readonly ChaveDoCatalogo[];
}

/**
 * Os seis cenários: os três perfis e os três estados de uma chave (herdado, concedido, negado).
 *
 * O `SYSLOC_MASTER` aparece **apenas** no estado herdado, e isso não é lacuna: a §4.2 da tech spec
 * fixa que ele não pode ter ajuste individual algum — eles vivem em `negocio.acesso_usuario_permissao`,
 * presa ao vínculo de acesso, que é tenantizado, e o Master não pertence a empresa nenhuma. O
 * efetivo dele é sempre a matriz do perfil, e é isso que a linha afirma.
 */
const CENARIOS_DE_EFETIVO: readonly CenarioDeEfetivo[] = [
  {
    nome: 'SYSLOC_MASTER · herdado — sem ajuste, o efetivo é a matriz do perfil (vazia)',
    perfil: 'SYSLOC_MASTER',
    ajustes: [],
    esperado: () => MATRIZ_POR_PERFIL.SYSLOC_MASTER,
  },
  {
    nome: 'ADMIN_EMPRESA · herdado — sem ajuste, o efetivo é a matriz do perfil',
    perfil: 'ADMIN_EMPRESA',
    ajustes: [],
    esperado: () => MATRIZ_POR_PERFIL.ADMIN_EMPRESA,
  },
  {
    nome: 'USUARIO_EMPRESA · herdado — sem ajuste, o efetivo é a matriz do perfil',
    perfil: 'USUARIO_EMPRESA',
    ajustes: [],
    esperado: () => MATRIZ_POR_PERFIL.USUARIO_EMPRESA,
  },
  {
    nome: 'USUARIO_EMPRESA · concedido — a chave que o perfil não dá entra, e só ela',
    perfil: 'USUARIO_EMPRESA',
    ajustes: [conceder(ACAO_DO_EXEMPLO)],
    esperado: () => comA(MATRIZ_POR_PERFIL.USUARIO_EMPRESA, ACAO_DO_EXEMPLO),
  },
  {
    nome: 'ADMIN_EMPRESA · negado — a chave que o perfil dá sai, e só ela',
    perfil: 'ADMIN_EMPRESA',
    ajustes: [negar(ACAO_DO_EXEMPLO)],
    esperado: () => semA(MATRIZ_POR_PERFIL.ADMIN_EMPRESA, ACAO_DO_EXEMPLO),
  },
  {
    nome: 'USUARIO_EMPRESA · negado — retirar o que o perfil concede esvazia o efetivo dele',
    perfil: 'USUARIO_EMPRESA',
    ajustes: [negar('TELA:resumo')],
    esperado: () => semA(MATRIZ_POR_PERFIL.USUARIO_EMPRESA, 'TELA:resumo'),
  },
];

describe('CT-202 — o efetivo é (perfil ∪ concedidas) − negadas, por igualdade de conjunto inteiro', () => {
  it.each(CENARIOS_DE_EFETIVO)('$nome', ({ perfil, ajustes, esperado }) => {
    afirmarConjuntoIgual(calcularEfetivo(perfil, ajustes), esperado());
  });
});

// ===========================================================================
// CT-203 — a negação vence a concessão por todos os caminhos
// ===========================================================================

/** Um caminho pelo qual a precedência da negação poderia ser burlada. */
interface CaminhoDaNegacao {
  readonly nome: string;
  readonly perfil: Perfil;
  readonly chaveNegada: ChaveDoCatalogo;
  /** Os ajustes na ordem direta. O caso exercita também a lista invertida. */
  readonly ajustes: readonly AjusteDePermissao[];
}

/**
 * Os três caminhos, e o que cada um discrimina.
 *
 * 1. **Negação isolada sobre chave do perfil** — o caso da RN-01 puro. Sobrevive ao mutante de
 *    ordem, e está aqui como controle: sem ele, não se saberia que os outros dois reprovam por
 *    causa da coexistência, e não por causa da negação em si.
 * 2. **Negação coexistindo com concessão, sobre chave que o perfil JÁ dá** — o conflito que o
 *    banco impede (unicidade do trio, CT-206) mas que a função ainda representa.
 * 3. **Negação coexistindo com concessão, sobre chave que o perfil NÃO dá** — o caminho em que
 *    subtrair antes de unir devolveria a chave, e o único em que o mutante ganha uma chave que o
 *    perfil nunca teve.
 */
const CAMINHOS_DA_NEGACAO: readonly CaminhoDaNegacao[] = [
  {
    nome: 'negação isolada sobre chave que o perfil concede',
    perfil: 'ADMIN_EMPRESA',
    chaveNegada: ACAO_DO_EXEMPLO,
    ajustes: [negar(ACAO_DO_EXEMPLO)],
  },
  {
    nome: 'negação coexistindo com concessão, sobre chave que o perfil concede',
    perfil: 'ADMIN_EMPRESA',
    chaveNegada: ACAO_DO_EXEMPLO,
    ajustes: [conceder(ACAO_DO_EXEMPLO), negar(ACAO_DO_EXEMPLO)],
  },
  {
    nome: 'negação coexistindo com concessão, sobre chave que o perfil NÃO concede',
    perfil: 'USUARIO_EMPRESA',
    chaveNegada: ACAO_DO_EXEMPLO,
    ajustes: [conceder(ACAO_DO_EXEMPLO), negar(ACAO_DO_EXEMPLO)],
  },
];

/**
 * PROVA DE FALSIFICAÇÃO — registrada, com o comando literal e o resultado medido.
 *
 * `.claude/rules/testing-stack.md` a torna obrigatória, e o card do CT-203 nomeia o mutante: trocar
 * a ordem das operações de `calcularEfetivo` para `(perfil − negadas) ∪ concedidas`, isto é, mover o
 * laço da subtração para ANTES do laço da união, em `packages/auth/src/efetivo.ts`.
 *
 * **Invocação**: `pnpm --filter @sysloc/auth test` — nunca `vitest run` avulso. A regra é literal, e
 * a razão é medida: os pacotes resolvem `"."` por `exports` para `./dist/`, e uma suíte que
 * carregasse o SUT pela fronteira do pacote leria o `dist/` da compilação anterior, deixando o
 * mutante no fonte sem alcançar o que executa. Verde lido como "o mutante sobreviveu" inverte a
 * conclusão, e numa fatia cujo eixo é segurança prova inconclusiva é pior que prova ausente.
 *
 * **Resultado, 2026-08-04**:
 *
 * | Fonte | Comando | Resultado |
 * |---|---|---|
 * | mutante (subtração primeiro) | `pnpm --filter @sysloc/auth test` | **4 failed, 70 passed** — as 4 são exatamente os caminhos 2 e 3 do CT-203, nas duas ordens |
 * | íntegro (controle) | idem | **74 passed**, limpo |
 *
 * A reprovação nomeia o defeito em vez de resmungar: `expected [ 'ACAO:ativar_contrato', …(16) ] to
 * not include 'ACAO:emitir_boleto'` para o Admin, e `expected [ 'ACAO:emitir_boleto', 'TELA:resumo' ]
 * to not include 'ACAO:emitir_boleto'` para o Usuário — a chave retirada de volta no efetivo, que é
 * literalmente o risco que a ADR-0010 registra nos `Cons`.
 *
 * **O caminho 1 SOBREVIVE ao mutante, e isso é a prova funcionando, não um furo.** Sem ajuste
 * `CONCEDIDA` para reintroduzir a chave, as duas ordens produzem o mesmo conjunto. Ele está na
 * tabela como controle: é ele que mostra que os caminhos 2 e 3 reprovam por causa da COEXISTÊNCIA —
 * o que o mutante de fato quebra — e não por causa da negação em si, que qualquer das duas ordens
 * aplica.
 */

/** As duas ordens em que a mesma lista de ajustes chega à função. */
const ORDENS = [
  { nome: 'ordem direta', virar: (a: readonly AjusteDePermissao[]) => [...a] },
  { nome: 'ordem invertida', virar: (a: readonly AjusteDePermissao[]) => [...a].reverse() },
] as const;

describe('CT-203 — a chave negada nunca aparece no efetivo, por caminho nenhum e em ordem nenhuma', () => {
  const exercicios = CAMINHOS_DA_NEGACAO.flatMap((caminho) =>
    ORDENS.map((ordem) => ({
      nome: `${caminho.nome} · ${ordem.nome}`,
      caminho,
      ajustes: ordem.virar(caminho.ajustes),
    })),
  );

  it.each(exercicios)('$nome', ({ caminho, ajustes }) => {
    const efetivo = calcularEfetivo(caminho.perfil, ajustes);

    // A ausência da chave é a invariante nomeada. Sozinha, porém, ela é fraca: um cálculo que
    // devolvesse o conjunto vazio a satisfaria. Por isso a asserção seguinte prende o efetivo
    // INTEIRO ao esperado do CT-202 menos exatamente a chave negada.
    expect(efetivo).not.toContain(caminho.chaveNegada);
    afirmarConjuntoIgual(efetivo, semA(MATRIZ_POR_PERFIL[caminho.perfil], caminho.chaveNegada));
  });
});

// ===========================================================================
// CT-204 — a concessão alcança exatamente uma chave e nada além dela
// ===========================================================================

describe('CT-204 — conceder individualmente alcança exatamente uma chave', () => {
  it('a diferença simétrica entre o efetivo com e sem a concessão tem cardinalidade 1', () => {
    const base = calcularEfetivo('USUARIO_EMPRESA', []);
    const comConcessao = calcularEfetivo('USUARIO_EMPRESA', [conceder(ACAO_DO_EXEMPLO)]);

    // Diferença simétrica, e não `contains`: o CA-09 exige literalmente "sem alcançar mais nada
    // além disso". Com `contains`, um cálculo que concedesse a chave MAIS um efeito colateral
    // passaria — e é exatamente esse efeito colateral que a cardinalidade 1 recusa.
    const { excedentes, ausentes } = diferencasDeConjunto(comConcessao, base);
    // As duas linhas abaixo já fixam a cardinalidade 1: um arranjo com exatamente um elemento
    // nomeado e outro vazio. Somar os comprimentos seria afirmar de novo o que elas implicam.
    expect(excedentes).toEqual([ACAO_DO_EXEMPLO]);
    expect(ausentes).toEqual([]);

    afirmarConjuntoIgual(comConcessao, comA(base, ACAO_DO_EXEMPLO));
  });
});

// ===========================================================================
// CT-205 — ação sem a tela que a comporta é recusada, nomeando a tela
// ===========================================================================

/** Um conjunto de ajustes incoerente, e por qual sentido ele o é. */
interface Incoerencia {
  readonly nome: string;
  readonly perfil: Perfil;
  readonly ajustes: readonly AjusteDePermissao[];
}

/**
 * Os dois sentidos da mesma incoerência.
 *
 * Ela pode nascer por qualquer das duas pontas, e uma validação que olhasse só os ajustes
 * `CONCEDIDA` pegaria a primeira e deixaria a segunda passar — motivo de o par existir. O que a
 * regra examina é o **efetivo resultante**, não a lista de ajustes.
 */
const INCOERENCIAS: readonly Incoerencia[] = [
  {
    nome: 'conceder a ação a quem tem a tela negada',
    perfil: 'USUARIO_EMPRESA',
    ajustes: [conceder(ACAO_DO_EXEMPLO), negar(TELA_QUE_COMPORTA_O_EXEMPLO)],
  },
  {
    nome: 'negar a tela de quem já tem a ação pelo perfil',
    perfil: 'ADMIN_EMPRESA',
    ajustes: [negar(TELA_QUE_COMPORTA_O_EXEMPLO)],
  },
];

describe('CT-205 — a ação sem a tela que a comporta é recusada, nomeando a tela exigida', () => {
  it.each(INCOERENCIAS)('$nome', ({ perfil, ajustes }) => {
    const recusa = capturarRecusa(() => {
      validarCoerenciaDeAjustes(perfil, ajustes);
    });

    // O envelope INTEIRO da ADR-0012, e não a presença de campos: é o que
    // `.claude/rules/testing-stack.md` exige do corpo de erro, e é o que impede que um campo a
    // mais — ou uma mensagem esvaziada — atravesse a asserção.
    expect(recusa.paraCorpo()).toEqual({
      codigo: CodigoErro.CAMPO_INVALIDO,
      mensagem: MENSAGEM_DA_RECUSA,
      campo: 'permissoes',
      detalhes: { telaExigida: TELA_QUE_COMPORTA_O_EXEMPLO, acao: ACAO_DO_EXEMPLO },
    });
    // O status é do código, não do corpo — mas é o que o cliente vê, e o `422` é o que a §6.1 da
    // tech spec fixa para esta recusa.
    expect(recusa.status).toBe(422);
  });

  it('o conjunto coerente — ação e tela liberadas juntas — não é recusado', () => {
    const ajustes = [conceder(TELA_QUE_COMPORTA_O_EXEMPLO), conceder(ACAO_DO_EXEMPLO)];

    expect(() => {
      validarCoerenciaDeAjustes('USUARIO_EMPRESA', ajustes);
    }).not.toThrow();

    // "Não lançou" sozinho seria ação sem asserção (AP-06): uma validação que recusasse TUDO
    // reprovaria os casos acima, mas uma que aceitasse tudo passaria aqui sem que este caso
    // dissesse nada sobre o efetivo. A igualdade de conjunto é o que fecha isso.
    afirmarConjuntoIgual(
      calcularEfetivo('USUARIO_EMPRESA', ajustes),
      comA(comA(MATRIZ_POR_PERFIL.USUARIO_EMPRESA, TELA_QUE_COMPORTA_O_EXEMPLO), ACAO_DO_EXEMPLO),
    );
  });

  it('a matriz de um perfil, sozinha, é coerente — nenhum perfil nasce com ação órfã', () => {
    // Companheiro estrutural do par acima: se a matriz de algum perfil concedesse uma ação sem a
    // tela que a comporta, todo ajuste sobre aquela pessoa seria recusado, e o produto ficaria
    // travado sem que nenhum dos casos anteriores percebesse.
    for (const perfil of Object.keys(MATRIZ_POR_PERFIL) as readonly Perfil[]) {
      expect(() => {
        validarCoerenciaDeAjustes(perfil, []);
      }).not.toThrow();
    }
  });
});
