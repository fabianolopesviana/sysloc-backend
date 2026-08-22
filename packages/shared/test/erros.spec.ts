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
 *
 * Acrescentado pela T8 da fatia `fundacao-multitenancy-identidade` — os três códigos de identidade
 * da §10.1 daquela tech spec. Os blocos abaixo são **novos**; nenhum caso acima foi alterado, e a
 * assimetria que a CT-003 já registra (superconjunto, nunca igualdade) é exatamente o que torna o
 * acréscimo retrocompatível pela ADR-0007.
 *
 * - CT-003 (b): `CREDENCIAL_INVALIDA`, `NAO_AUTENTICADO` e `ACESSO_NEGADO` existem no enum, com
 *   grafia idêntica à fixada e na convenção maiúsculo-com-sublinhado.
 * - CT-004 (b): o status de cada um é o semântico da §10.1 — `401`, `401` e `403` —, derivado do
 *   código e não informado pelo chamador.
 *
 * Acrescentado no ciclo de correção da T8 (Gate 2, P1) — o código de fecho da classificação:
 *
 * - CT-003 (c): `REQUISICAO_RECUSADA` existe no enum, com grafia idêntica, e é código PRÓPRIO —
 *   não um apelido de `ERRO_INTERNO`. É ele que impede uma recusa de CLIENTE emitida por
 *   componente externo de sair como falha do SERVIDOR; a prova de comportamento do filtro que o
 *   consome vive em `apps/api/test/autenticacao.e2e.spec.ts` (CT-018 (e)).
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

/**
 * Os três códigos que a T8 acrescenta, escritos como literais pela mesma razão de `CODIGOS_FIXADOS`:
 * derivá-los do enum tornaria o caso incapaz de detectar renomeação, que é o que a ADR-0007 declara
 * incompatível. Lista SEPARADA, e não acréscimo à de cima, para que a distinção entre "o que a F0
 * fixou" e "o que a F1 fixou" continue legível no dia em que uma delas mudar.
 */
const CODIGOS_DA_IDENTIDADE = ['CREDENCIAL_INVALIDA', 'NAO_AUTENTICADO', 'ACESSO_NEGADO'] as const;

/**
 * Tabela código → status semântico da §10.1 da tech spec da fatia. O valor esperado vem de fora do
 * SUT: a construção da exceção informa apenas código e mensagem.
 */
const STATUS_SEMANTICO_DA_IDENTIDADE: ReadonlyArray<readonly [TipoCodigoErro, number]> = [
  [CodigoErro.CREDENCIAL_INVALIDA, 401],
  [CodigoErro.NAO_AUTENTICADO, 401],
  [CodigoErro.ACESSO_NEGADO, 403],
];

describe('CT-003 (b) — os três códigos de identidade entram no enum fechado', () => {
  it.each(CODIGOS_DA_IDENTIDADE)('mantém %s com grafia idêntica', (fixado) => {
    expect(Object.values(CodigoErro)).toContain(fixado);
  });

  it('tem os três em maiúsculo-com-sublinhado, com nome e valor coincidentes', () => {
    const porNome = CodigoErro as Record<string, string | undefined>;

    for (const nome of CODIGOS_DA_IDENTIDADE) {
      // O nome vem da lista externa e o valor vem do SUT — é essa distância que discrimina a
      // entrada cujo VALOR diverge do nome, que é a forma que a grafia herdada tomaria.
      expect(porNome[nome], `código fora da convenção de grafia: ${nome}`).toMatch(GRAFIA_DO_ENUM);
      expect(porNome[nome]).toBe(nome);
    }
  });

  it('não reaproveita os códigos da F0 para as recusas de identidade', () => {
    // Companheiro negativo: sem ele, um enum que apontasse os três nomes novos para
    // `ERRO_INTERNO` passaria nas asserções de presença acima — e o cliente perderia a
    // classificação por `codigo` que a ADR-0007 comprou.
    const daIdentidade = CODIGOS_DA_IDENTIDADE.map(
      (nome) => (CodigoErro as Record<string, string | undefined>)[nome],
    );

    expect(new Set(daIdentidade).size).toBe(CODIGOS_DA_IDENTIDADE.length);
    for (const codigo of daIdentidade) {
      expect(CODIGOS_FIXADOS as readonly string[]).not.toContain(codigo);
    }
  });
});

describe('CT-004 (b) — status semântico dos códigos de identidade', () => {
  it.each(STATUS_SEMANTICO_DA_IDENTIDADE)(
    '%s devolve %i sem que o chamador informe status',
    (codigo, status) => {
      const erro = new ErroDeAplicacao(codigo, 'mensagem irrelevante para o status');

      expect(erro.status).toBe(status);
      expect('status' in erro.paraCorpo()).toBe(false);
    },
  );

  it('separa "não sei quem é você" de "sei, e você não alcança isto"', () => {
    // Os dois `401` são deliberadamente o mesmo status com códigos distintos; o `403` é status
    // distinto. Um mapeamento que colapsasse os três em `401` — ou que promovesse a recusa de
    // credencial a `403` — passaria nas asserções por par acima só se a tabela mudasse junto, e é
    // esta comparação cruzada que amarra a relação entre eles.
    expect(new ErroDeAplicacao(CodigoErro.CREDENCIAL_INVALIDA, 'x').status).toBe(
      new ErroDeAplicacao(CodigoErro.NAO_AUTENTICADO, 'x').status,
    );
    expect(new ErroDeAplicacao(CodigoErro.ACESSO_NEGADO, 'x').status).not.toBe(
      new ErroDeAplicacao(CodigoErro.NAO_AUTENTICADO, 'x').status,
    );
  });
});

describe('CT-003 (c) — o código de fecho da classificação entra no enum fechado', () => {
  // Acrescentado no ciclo de correção da T8 (Gate 2, P1). Bloco NOVO: nenhum caso acima foi
  // alterado, e a assimetria que a CT-003 registra — superconjunto, nunca igualdade — é o que
  // torna o acréscimo retrocompatível pela ADR-0007.
  it('mantém REQUISICAO_RECUSADA com grafia idêntica e nome coincidente com o valor', () => {
    const porNome = CodigoErro as Record<string, string | undefined>;

    expect(Object.values(CodigoErro)).toContain('REQUISICAO_RECUSADA');
    expect(porNome.REQUISICAO_RECUSADA).toMatch(GRAFIA_DO_ENUM);
    expect(porNome.REQUISICAO_RECUSADA).toBe('REQUISICAO_RECUSADA');
  });

  it('é código PRÓPRIO, e não um apelido de ERRO_INTERNO', () => {
    // Companheiro negativo, e o eixo que importa: um enum que apontasse o nome novo para
    // `ERRO_INTERNO` passaria na asserção de presença acima, e a recusa de cliente voltaria a
    // sair com o código — e o status — de falha do servidor, que é exatamente o defeito que o
    // código existe para fechar.
    expect(CodigoErro.REQUISICAO_RECUSADA).not.toBe(CodigoErro.ERRO_INTERNO);
    expect(new ErroDeAplicacao(CodigoErro.REQUISICAO_RECUSADA, 'x').status).toBe(400);
    expect(new ErroDeAplicacao(CodigoErro.REQUISICAO_RECUSADA, 'x').status).not.toBe(
      new ErroDeAplicacao(CodigoErro.ERRO_INTERNO, 'x').status,
    );
  });
});

/**
 * Os três códigos que a F5 acrescenta — as três causas de recusa do registro do certificado.
 *
 * Escritos como literais pela mesma razão de {@link CODIGOS_FIXADOS} e de
 * {@link CODIGOS_DA_IDENTIDADE}: derivá-los do enum tornaria o caso incapaz de detectar renomeação,
 * que é o que a ADR-0007 declara incompatível. Lista **separada**, e não acréscimo às de cima, para
 * que a distinção entre o que cada fase fixou continue legível no dia em que uma delas mudar.
 */
const CODIGOS_DO_MATERIAL_DO_CERTIFICADO = [
  'MATERIAL_EM_FORMATO_NAO_SUPORTADO',
  'SENHA_DO_MATERIAL_NAO_ABRE',
  'CERTIFICADO_COM_VALIDADE_ENCERRADA',
] as const;

describe('CT-003 (d) — os três códigos do material do certificado entram no enum fechado', () => {
  // ⚠️ O sufixo é **(d)**: (b) é o dos três de identidade e (c) é o do código de fecho da
  // classificação. Bloco NOVO — nenhum caso acima foi alterado, e a assimetria que o CT-003
  // registra (superconjunto, nunca igualdade) é o que torna o acréscimo retrocompatível.
  it.each(CODIGOS_DO_MATERIAL_DO_CERTIFICADO)('mantém %s com grafia idêntica', (fixado) => {
    expect(Object.values(CodigoErro)).toContain(fixado);
  });

  it('tem os três em maiúsculo-com-sublinhado, com nome e valor coincidentes', () => {
    const porNome = CodigoErro as Record<string, string | undefined>;

    for (const nome of CODIGOS_DO_MATERIAL_DO_CERTIFICADO) {
      // O nome vem da lista externa e o valor vem do SUT — é essa distância que discrimina a
      // entrada cujo VALOR diverge do nome.
      expect(porNome[nome], `código fora da convenção de grafia: ${nome}`).toMatch(GRAFIA_DO_ENUM);
      expect(porNome[nome]).toBe(nome);
    }
  });

  it('são TRÊS códigos distintos, e nenhum deles é CAMPO_INVALIDO', () => {
    // Companheiro negativo, e o eixo que a fatia existe para fechar: um enum que apontasse os três
    // nomes para `CAMPO_INVALIDO` passaria nas asserções de presença acima, e as três causas
    // voltariam a ser indistinguíveis pelo `codigo` — que é exatamente o defeito do `D64`.
    const doMaterial = CODIGOS_DO_MATERIAL_DO_CERTIFICADO.map(
      (nome) => (CodigoErro as Record<string, string | undefined>)[nome],
    );

    expect(new Set(doMaterial).size).toBe(CODIGOS_DO_MATERIAL_DO_CERTIFICADO.length);
    for (const codigo of doMaterial) {
      expect(codigo).not.toBe(CodigoErro.CAMPO_INVALIDO);
    }
  });

  it('os três saem em 422, como a recusa de entrada que eles são', () => {
    // O status é o de `CAMPO_INVALIDO` de propósito: o que a fatia acrescenta é a distinção do
    // CÓDIGO, e não uma natureza nova de desfecho. A comparação é contra o status daquele código, e
    // não contra o literal, para que a relação entre os quatro fique amarrada num ponto só.
    for (const nome of CODIGOS_DO_MATERIAL_DO_CERTIFICADO) {
      const codigo = (CodigoErro as Record<string, string | undefined>)[nome] as TipoCodigoErro;

      expect(new ErroDeAplicacao(codigo, 'mensagem fixa').status).toBe(422);
      expect(new ErroDeAplicacao(codigo, 'mensagem fixa').status).toBe(
        new ErroDeAplicacao(CodigoErro.CAMPO_INVALIDO, 'mensagem fixa').status,
      );
    }
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
