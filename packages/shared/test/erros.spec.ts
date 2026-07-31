/**
 * Contrato de erro da API — ADR-0007.
 *
 * Rastreabilidade: CA-13 → CT-001, CT-002, CT-003, CT-004, CT-005.
 *
 * INVARIANTES
 * - CT-001: o corpo derivado da exceção tem como chaves enumeráveis exatamente `codigo` e
 *   `mensagem` quando não há campo nem detalhes; `campo` e `detalhes` aparecem se e somente
 *   se informados — nenhuma outra chave existe em qualquer combinação.
 * - CT-002: o corpo nunca expõe estado interno da exceção (`name`, `message`, `stack`, `cause`)
 *   nem o status HTTP, e opcional não informado é omitido — nunca presente com valor indefinido.
 * - CT-003: `CodigoErro` contém, com grafia idêntica, os quatro valores fixados por esta
 *   fatia, e nenhum valor se repete. Acrescentar valor é retrocompatível; renomear ou remover
 *   não é. A convenção de grafia (`^[A-Z][A-Z0-9_]*$`) é asserida **sobre os quatro códigos
 *   desta fatia**, não sobre o enum inteiro: a grafia dos códigos de negócio que chegam em F4
 *   é decisão de F4 — ver o comentário do enum em `erros.ts`.
 * - CT-004: o status HTTP é derivado do código, não informado pelo chamador.
 * - CT-005: todo valor do enum tem status mapeado, inteiro, na faixa fechada [400, 599].
 */

import { describe, expect, it } from 'vitest';
import { CodigoErro, ErroDeAplicacao, type CodigoErro as TipoCodigoErro } from '../src/erros.js';

/**
 * Fonte externa de verdade: os códigos que a ADR-0007 e a T3 fixaram para esta fatia.
 * Deliberadamente escritos como literais — derivá-los do próprio enum tornaria CT-003
 * incapaz de detectar renomeação, que é exatamente o defeito que ele persegue.
 */
const CODIGOS_FIXADOS = [
  'CAMPO_INVALIDO',
  'RECURSO_NAO_ENCONTRADO',
  'ERRO_INTERNO',
  'SERVICO_INDISPONIVEL',
] as const;

/**
 * Convenção de grafia dos códigos **desta fatia**: maiúsculo-com-sublinhado (T3 §4).
 *
 * Deliberadamente NÃO aplicada ao enum inteiro. Ver o `SUT_IS_CORRECT_BECAUSE` do CT-003 e o
 * comentário do enum em `erros.ts`: a grafia dos códigos de negócio de F4 é decisão de F4.
 */
const GRAFIA_DO_ENUM = /^[A-Z][A-Z0-9_]*$/;

/**
 * Tabela código → status semântico, derivada da ADR-0007 (status HTTP semântico) e do CA-13.
 * O valor esperado vem de fora do SUT: a construção da exceção informa apenas código e mensagem.
 */
const STATUS_SEMANTICO: ReadonlyArray<readonly [TipoCodigoErro, number]> = [
  [CodigoErro.CAMPO_INVALIDO, 422],
  [CodigoErro.RECURSO_NAO_ENCONTRADO, 404],
  [CodigoErro.ERRO_INTERNO, 500],
  [CodigoErro.SERVICO_INDISPONIVEL, 503],
];

describe('CT-001 — corpo de erro tem exatamente as chaves fixadas pela ADR-0007', () => {
  const casos = [
    {
      nome: 'caso_1 — sem campo e sem detalhes',
      construir: () => new ErroDeAplicacao(CodigoErro.ERRO_INTERNO, 'falha ao gravar a cobrança'),
      chaves: ['codigo', 'mensagem'],
      corpoEsperado: { codigo: 'ERRO_INTERNO', mensagem: 'falha ao gravar a cobrança' },
    },
    {
      nome: 'caso_2 — com campo',
      construir: () =>
        new ErroDeAplicacao(CodigoErro.CAMPO_INVALIDO, 'data de vencimento inválida', {
          campo: 'dataVencimento',
        }),
      chaves: ['campo', 'codigo', 'mensagem'],
      corpoEsperado: {
        codigo: 'CAMPO_INVALIDO',
        mensagem: 'data de vencimento inválida',
        campo: 'dataVencimento',
      },
    },
    {
      nome: 'caso_3 — com campo e detalhes',
      construir: () =>
        new ErroDeAplicacao(CodigoErro.CAMPO_INVALIDO, 'data de vencimento inválida', {
          campo: 'dataVencimento',
          detalhes: { formatoEsperado: 'AAAA-MM-DD' },
        }),
      chaves: ['campo', 'codigo', 'detalhes', 'mensagem'],
      corpoEsperado: {
        codigo: 'CAMPO_INVALIDO',
        mensagem: 'data de vencimento inválida',
        campo: 'dataVencimento',
        detalhes: { formatoEsperado: 'AAAA-MM-DD' },
      },
    },
  ];

  it.each(casos)('$nome', ({ construir, chaves, corpoEsperado }) => {
    const corpo = construir().paraCorpo();

    expect(Object.keys(corpo).sort()).toEqual(chaves);
    expect(corpo).toEqual(corpoEsperado);
  });
});

describe('CT-002 — corpo nunca carrega chave estranha nem opcional com valor indefinido', () => {
  it('omite os opcionais informados como indefinidos e não vaza estado da exceção', () => {
    const erro = new ErroDeAplicacao(CodigoErro.ERRO_INTERNO, 'falha ao gravar a cobrança', {
      campo: undefined,
      detalhes: undefined,
    });

    // Pré-condição do caso: a exceção realmente carrega o que não pode aparecer no corpo.
    expect(typeof erro.stack).toBe('string');
    expect(erro.status).toBe(500);
    expect(erro.name).toBe('ErroDeAplicacao');

    const corpo = erro.paraCorpo();

    expect(Object.keys(corpo).sort()).toEqual(['codigo', 'mensagem']);
    expect('campo' in corpo).toBe(false);
    expect('detalhes' in corpo).toBe(false);
    expect('status' in corpo).toBe(false);
    expect('statusHttp' in corpo).toBe(false);
    expect('name' in corpo).toBe(false);
    expect('stack' in corpo).toBe(false);
    expect('message' in corpo).toBe(false);

    const serializado = JSON.stringify(corpo);
    expect(serializado).not.toContain('stack');
    expect(serializado).not.toContain('Error:');
    expect(serializado).not.toContain('erros.ts');

    // Ida e volta estável: o que sai do servidor é exatamente o que o cliente lê.
    const reconstruido = JSON.parse(serializado) as Record<string, unknown>;
    expect(Object.keys(reconstruido).sort()).toEqual(['codigo', 'mensagem']);
    expect(reconstruido).toEqual({
      codigo: 'ERRO_INTERNO',
      mensagem: 'falha ao gravar a cobrança',
    });
  });

  it('guarda a causa na exceção sem levá-la ao corpo', () => {
    const origem = new Error('conexão recusada pelo servidor de banco');
    const erro = new ErroDeAplicacao(CodigoErro.SERVICO_INDISPONIVEL, 'banco indisponível', {
      causa: origem,
    });

    // A causa fica onde o registro estruturado sabe descer e redigir (`log.ts`).
    expect(erro.cause).toBe(origem);

    // E não atravessa para o cliente: a ADR-0007 fixa o corpo em quatro campos.
    const corpo = erro.paraCorpo();
    expect(Object.keys(corpo).sort()).toEqual(['codigo', 'mensagem']);
    expect('causa' in corpo).toBe(false);
    expect('cause' in corpo).toBe(false);
  });

  it('não cria a propriedade de causa quando ela não é informada', () => {
    const erro = new ErroDeAplicacao(CodigoErro.ERRO_INTERNO, 'falha sem origem conhecida');

    // Ausência, não presença com valor indefinido — senão todo evento registrado carregaria
    // uma causa vazia.
    expect('cause' in erro).toBe(false);
  });
});

describe('CT-003 — CodigoErro é enum fechado', () => {
  // Superconjunto, nunca igualdade: acrescentar código é retrocompatível pela ADR-0007;
  // renomear ou remover não é. A assimetria da asserção É a semântica de compatibilidade.
  it.each(CODIGOS_FIXADOS)('mantém %s com grafia idêntica', (fixado) => {
    expect(Object.values(CodigoErro)).toContain(fixado);
  });

  // SUT_IS_CORRECT_BECAUSE: a grafia maiúscula é decisão desta fatia (T3 §4) sobre os quatro
  // códigos que ela cria — não sobre todo código que o enum venha a ter. Assertá-la sobre
  // `Object.values(CodigoErro)` inteiro era alcance errado desde a origem: transformava uma
  // decisão de 4 códigos em invariante global e forçava a F4, ao acrescentar os códigos do
  // Sicoob, a escolher entre (i) `SEM_CERTIFICADO_PROPRIO`, com o `switch` do cliente sobre
  // `sem_certificado_proprio` caindo em `desconhecido` na tela de configuração bancária, e
  // (ii) a grafia herdada, com este caso reprovando — pressão para enfraquecer um teste de
  // contrato por causa de uma decisão que nunca foi tomada. O alcance correto é o conjunto
  // fixado aqui; a grafia dos códigos de negócio fica em aberto para a decisão de F4, que é
  // quem tem o consumidor na mão (`erros.ts`, comentário do enum). A asserção de unicidade
  // e a de superconjunto seguem valendo sobre o enum INTEIRO — essas sim são invariantes da
  // ADR-0007, e nenhuma cobertura é perdida na redução.
  it('tem os códigos fixados em maiúsculo-com-sublinhado, e o enum sem duplicata', () => {
    const valores = Object.values(CodigoErro);
    const porNome = CodigoErro as Record<string, string | undefined>;

    // O nome vem da lista externa; o valor vem do SUT. É essa distância que dá conteúdo à
    // asserção: o defeito que ela discrimina é a entrada cujo VALOR diverge do nome — a forma
    // exata que a grafia herdada tomaria (`SEM_CERTIFICADO_PROPRIO: 'sem_certificado_proprio'`).
    for (const nome of CODIGOS_FIXADOS) {
      expect(porNome[nome], `código fora da convenção de grafia: ${nome}`).toMatch(GRAFIA_DO_ENUM);
    }
    expect(new Set(valores).size).toBe(valores.length);
    expect(valores.length).toBeGreaterThanOrEqual(CODIGOS_FIXADOS.length);
  });
});

describe('CT-004 — status HTTP é determinado pelo código, não pelo chamador', () => {
  it.each(STATUS_SEMANTICO)('%s devolve %i sem que o chamador informe status', (codigo, status) => {
    const erro = new ErroDeAplicacao(codigo, 'mensagem irrelevante para o status');

    expect(erro.status).toBe(status);
    // Reforço cruzado com CT-002: o status acompanha a resposta, não o corpo.
    expect('status' in erro.paraCorpo()).toBe(false);
  });
});

describe('CT-005 — todo valor do enum tem status mapeado na faixa de erro', () => {
  it.each(Object.values(CodigoErro))('%s produz status inteiro entre 400 e 599', (codigo) => {
    const erro = new ErroDeAplicacao(codigo, 'mensagem fixa');
    const contexto = `código ${codigo} produziu status ${String(erro.status)}`;

    expect(Number.isInteger(erro.status), contexto).toBe(true);
    expect(erro.status, contexto).toBeGreaterThanOrEqual(400);
    expect(erro.status, contexto).toBeLessThanOrEqual(599);
  });
});
