/**
 * A camada de acesso do **operador do SaaS** — as duas armadilhas silenciosas e o critério de
 * exclusão.
 *
 * ---------------------------------------------------------------------------
 * INVARIANTES
 * ---------------------------------------------------------------------------
 *
 * | CA       | CT     | Invariante |
 * |----------|--------|------------|
 * | CA-13    | CT-1204| **Armadilha A1.** Sob `app.empresa_id` vazio (o do Sysloc Master), a sonda
 * | CA-19    |        | de elegibilidade de uma empresa que possui contrato registrado RECUSA com
 * |          |        | `REGISTROS_DE_NEGOCIO`, enquanto `count(*)` sobre `negocio.contrato` da
 * |          |        | mesma empresa, medida na MESMA unidade de trabalho, devolve exatamente
 * |          |        | `0` — e a mesma contagem, sob o contexto daquela empresa, devolve `1`. O
 * |          |        | par prova que o critério NÃO é a contagem. |
 * | CA-15    | CT-1205| A empresa SEM linha alguma em `negocio` é elegível, com a MESMA contagem
 * |          |        | zero do caso anterior: os dois zeros com desfechos opostos são o que
 * |          |        | discrimina uma implementação por contagem. |
 * | CA-04    | CT-1206| **Armadilha A2, metade do ENCERRAMENTO.** Com contexto vazio,
 * |          |        | `encerrarSessoesDoAdministrador` devolve `2` e zera a contagem crua,
 * |          |        | enquanto `encerrarSessoesDaPessoa` — que alcança PELO vínculo, sob RLS —
 * |          |        | devolve `0` sobre a MESMA pessoa e deixa a contagem em `2`. |
 * | CA-04    | CT-1206| **O recorte de perfil da escrita.** Sobre um `USUARIO_EMPRESA` com 2
 * | CA-01    | (b)    | sessões, `encerrarSessoesDoAdministrador` devolve `0` e a contagem crua
 * |          |        | continua `2` — enquanto `lerAdministrador`, que por decisão NÃO recorta,
 * |          |        | alcança a MESMA pessoa e devolve `perfil` igual a `'USUARIO_EMPRESA'`. É a
 * |          |        | assimetria declarada entre a leitura (que informa a recusa da RN-06) e a
 * |          |        | escrita (que a repete na instrução). |
 * | CA-04    | CT-1207| **Armadilha A2, metade da MARCAÇÃO.** No mesmo contexto,
 * |          |        | `definirAtivoDoAdministrador` grava `ativo = false` e
 * |          |        | `definirAtivoDaPessoa` devolve `undefined` sem escrever — e a prova são
 * |          |        | DUAS leituras cruas da coluna, nunca o valor de retorno. |
 * | CA-12    | CT-1208| A prévia que RECUSA não deixa efeito: `identidade.empresa` e
 * | CA-19    |        | `identidade.usuario` ficam com contagens idênticas às medidas antes, e a
 * |          |        | igualdade persiste DEPOIS do commit da transação externa. |
 * | CA-15    | CT-1209| A prévia que ACEITA também não remove — é o único caminho em que o
 * |          |        | `DELETE` do ensaio teria sucesso, e o único que pega um `savepoint`
 * |          |        | esquecido. Só o ato remove. |
 * | CA-17    | CT-1210| Cada uma das SETE origens de impedimento do administrador, presente
 * |          |        | SOZINHA, torna a exclusão inelegível com a classe EXATA do vocabulário
 * |          |        | fechado — e a pessoa continua existindo nas sete. A perna `(b)` fecha o
 * |          |        | par de restrições que `negocio.acesso_usuario_app` opõe. |
 * | CA-20    | CT-1210| **Falha fechada.** Uma dependência `23503` que o vocabulário NÃO conhece
 * |          | (c)    | faz a prévia LEVANTAR, nunca devolver `{ elegivel: true }` — com controle
 * |          |        | antes (elegível) e depois do `DROP` (elegível de novo), de modo que a
 * |          |        | inversão é atribuível à restrição nova. |
 * | CA-18    | CT-1211| Removido um `ADMIN_EMPRESA` sem nenhuma das origens, `identidade.usuario`
 * |          |        | perde exatamente 1 linha e as linhas dele em `conta`, `dois_fatores` e
 * |          |        | `sessao` deixam de existir SEM que a operação as apague — enquanto as do
 * |          |        | colega da mesma empresa permanecem. |
 * | CA-17    | CT-1212| A recusa da exclusão NUNCA destrói a trilha (RN-16, ADR-0013): a contagem
 * |          |        | de `identidade.tentativa_login` e o `id` da linha são literalmente os
 * |          |        | capturados antes. |
 * | CA-16    | CT-1213| A exclusão de uma empresa cujos 2 administradores incluem um inelegível
 * |          |        | recusa por `ADMINISTRADORES_NAO_ELEGIVEIS`, e as 3 linhas continuam
 * |          |        | existindo — nem o administrador ELEGÍVEL é removido. |
 * | CA-15    | CT-1214| A exclusão de uma empresa vazia com administrador virgem remove os dois
 * |          |        | num único commit, e a empresa de CONTROLE, com o próprio administrador,
 * |          |        | permanece intacta. |
 * | CA-01    | CT-1217| Sob contexto vazio, a listagem devolve o conjunto EXATO dos dois
 * |          |        | `ADMIN_EMPRESA` da empresa consultada — sem o `USUARIO_EMPRESA` dela e sem
 * |          |        | o `ADMIN_EMPRESA` da outra empresa —, e o `total` é número. |
 * | CA-11    | CT-1218| A correção de um administrador com o e-mail de outra pessoa é recusada
 * |          |        | pela restrição NOMEADA, e a linha do alvo continua com nome e e-mail bit
 * |          |        | a bit iguais — inclusive o NOME, que o mesmo corpo também trazia. |
 * | CA-11    | CT-1219| A correção da empresa com o documento de outra é recusada com
 * |          |        | `ErroDeDocumentoDeEmpresaEmUso`, e as DUAS linhas continuam idênticas
 * |          |        | campo a campo — inclusive depois do commit da unidade. |
 *
 * ---------------------------------------------------------------------------
 * Como estes casos alcançam o que alcançam
 * ---------------------------------------------------------------------------
 *
 * **Fronteira de execução real**: instância efêmera migrada por `./banco-efemero.ts` — importada,
 * nunca redeclarada. Nenhum dublê: a política de isolamento, a integridade referencial, o ponto de
 * salvamento e a unicidade são comportamento do armazenamento, e um dublê responde a contagem que
 * lhe mandarem responder — inclusive a que na realidade vem **zero**, que é justamente a armadilha
 * A1. É por isso que a §6.1 da task declara N/A para unitário.
 *
 * **O contexto do Master é `{ empresaId: null }`**, o mesmo valor que a guarda publica a partir da
 * sessão — ver `../src/contexto.ts`. Ele é montado por {@link emUnidadeDoMaster}, e o arranjo sob a
 * empresa usa a casa compartilhada `./unidade-sob-contexto.ts`. A assimetria é do tipo, e não
 * descuido: `Contexto` daquele módulo tem `empresaId: string` **sem alternativa**, por decisão
 * declarada no docblock dele, e o contexto sem empresa é declarado localmente — como
 * `isolamento.spec.ts` já faz com `CONTEXTO_SEM_EMPRESA`.
 *
 * **Nenhum símbolo de produção nasceu para esta suíte** (Iron Law #6): as empresas nascem por
 * `admitirEmpresa`, o cenário cheio por `semearCobrancaDoZero` (`./cenario-de-cobranca.ts`), e as
 * linhas de `identidade` por `INSERT` direto — o schema não tem política a aplicar (ADR-0009), e é
 * o mesmo caminho que `cadastro-de-pessoa.spec.ts` e `isolamento.spec.ts` já usam.
 */

import type { TransactionSql } from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  alterarAdministrador,
  type ClasseDeImpedimento,
  definirAtivoDoAdministrador,
  elegibilidadeDeExclusaoDoAdministrador,
  encerrarSessoesDoAdministrador,
  excluirAdministrador,
  IMPEDIMENTOS_DE_EXCLUSAO,
  lerAdministrador,
  listarAdministradoresDaEmpresa,
} from '../src/administrador-do-master.ts';
import { abrirConexao } from '../src/conexao.ts';
import * as contextoDeTenant from '../src/contexto.ts';
import {
  admitirEmpresa,
  alterarEmpresa,
  type EmpresaPersistida,
  ErroDeDocumentoDeEmpresaEmUso,
  elegibilidadeDeExclusaoDaEmpresa,
  excluirEmpresa,
} from '../src/empresa.ts';
import { definirAtivoDaPessoa, encerrarSessoesDaPessoa } from '../src/pessoa.ts';
import { type AcessoAoBanco, abrirAcessoAoBanco } from '../src/unidade-de-trabalho.ts';
import { type BancoMigrado, bancoEfemero, conexaoDeMigracao } from './banco-efemero.ts';
import { semearCobrancaDoZero } from './cenario-de-cobranca.ts';
import { diferencasDeConjunto } from './conjuntos.ts';
import { emUnidadeSobContexto } from './unidade-sob-contexto.ts';

let banco: BancoMigrado;
let acesso: AcessoAoBanco;

beforeAll(async () => {
  banco = await bancoEfemero();
  acesso = abrirAcessoAoBanco({ cadeiaDeConexao: banco.cadeiaConexao });
}, 120_000);

afterAll(async () => {
  await acesso?.encerrar();
  await banco?.parar();
});

// ---------------------------------------------------------------------------
// Contexto e arranjo
// ---------------------------------------------------------------------------

/**
 * O contexto que a guarda publica para o **Sysloc Master**: sessão sem empresa.
 *
 * Não é "ausência de contexto" — é contexto **com empresa nula**, que é o estado que a sessão dele
 * produz. Os dois terminam em leitura vazia por caminhos diferentes (ver `../src/contexto.ts`), e
 * montar o errado faria os casos passarem pela razão errada.
 */
const CONTEXTO_DO_MASTER = { empresaId: null } as const;

/** A janela que a borda serve por padrão — o teto e o padrão vivem no contrato, não aqui. */
const JANELA_PADRAO = { limite: 50, deslocamento: 0 } as const;

/** Uma unidade de trabalho sob o contexto do Master — o par `executarCom` + `emUnidadeDeTrabalho`. */
async function emUnidadeDoMaster<T>(trabalho: (tx: TransactionSql) => Promise<T>): Promise<T> {
  return await contextoDeTenant.executarCom(
    CONTEXTO_DO_MASTER,
    async () => await acesso.emUnidadeDeTrabalho(trabalho),
  );
}

/**
 * Um sufixo único por chamada, dentro do processo.
 *
 * `identidade.empresa` tem documento único e `identidade.usuario` tem e-mail único: um valor fixo
 * faria o segundo arranjo morrer por colisão, longe da causa que o caso investiga.
 */
let sequencia = 0;
function proximaMarca(): string {
  sequencia += 1;
  return String(sequencia).padStart(4, '0');
}

/** Um documento de 14 dígitos derivado da sequência — único dentro do processo. */
function documentoDaMarca(marca: string): string {
  return `9${marca.padStart(13, '0')}`;
}

/** Admite uma empresa pela porta publicada. */
async function semearEmpresa(nome: string): Promise<EmpresaPersistida> {
  const marca = proximaMarca();
  const criada = await emUnidadeDoMaster(
    async (tx) =>
      await admitirEmpresa(tx, { nome: `${nome} ${marca}`, documento: documentoDaMarca(marca) }),
  );

  if (criada === undefined) {
    throw new Error(`o arranjo não conseguiu admitir a empresa "${nome}" — documento repetido`);
  }

  return criada;
}

interface PessoaSemeada {
  readonly id: string;
  readonly nome: string;
  readonly email: string;
}

/**
 * Cria uma pessoa em `identidade.usuario` por `INSERT` direto.
 *
 * O schema não tem política a aplicar (ADR-0009), e não há porta publicada por este pacote que crie
 * pessoa — quem o faz em operação é o arcabouço de identidade, em `@sysloc/auth`, que este pacote
 * não conhece. É o mesmo caminho de arranjo que `isolamento.spec.ts` já usa para a pessoa
 * descartável dele.
 */
async function semearPessoa(
  empresaId: string,
  perfil: 'ADMIN_EMPRESA' | 'USUARIO_EMPRESA',
  nome: string,
): Promise<PessoaSemeada> {
  const marca = proximaMarca();
  const email = `pessoa-${marca}@exemplo.invalid`;

  const id = await emUnidadeDoMaster(async (tx) => {
    const [linha] = await tx<{ id: string }[]>`
      INSERT INTO identidade.usuario (nome, email, perfil, empresa_id)
      VALUES (${nome}, ${email}, ${perfil}::identidade.perfil_usuario, ${empresaId})
      RETURNING id
    `;

    if (linha === undefined) {
      throw new Error(`o arranjo não conseguiu criar a pessoa "${nome}"`);
    }

    return linha.id;
  });

  return { id, nome, email };
}

/** Duas sessões abertas para a pessoa — o número que o `CT-1206` afirma. */
async function semearSessoes(usuarioId: string, quantas: number): Promise<void> {
  await emUnidadeDoMaster(async (tx) => {
    for (let indice = 0; indice < quantas; indice += 1) {
      await tx`
        INSERT INTO identidade.sessao (usuario_id, token, expira_em)
        VALUES (${usuarioId}, ${`token-${proximaMarca()}`}, now() + interval '8 hours')
      `;
    }
  });
}

/** A credencial local da pessoa, que some por cascata quando ela é removida. */
async function semearConta(usuarioId: string): Promise<void> {
  await emUnidadeDoMaster(async (tx) => {
    await tx`
      INSERT INTO identidade.conta (usuario_id, conta_id, provedor_id)
      VALUES (${usuarioId}, ${usuarioId}, 'credential')
    `;
  });
}

/** O segundo fator da pessoa, que some por cascata quando ela é removida. */
async function semearDoisFatores(usuarioId: string): Promise<void> {
  await emUnidadeDoMaster(async (tx) => {
    await tx`
      INSERT INTO identidade.dois_fatores (usuario_id, segredo, codigos_recuperacao)
      VALUES (${usuarioId}, 'segredo-descartavel', 'codigos-descartaveis')
    `;
  });
}

/** Uma linha na trilha de tentativas de entrada — o impedimento da ADR-0013. */
async function semearTentativaDeEntrada(pessoa: PessoaSemeada): Promise<string> {
  return await emUnidadeDoMaster(async (tx) => {
    const [linha] = await tx<{ id: string }[]>`
      INSERT INTO identidade.tentativa_login (email_informado, usuario_id, desfecho)
      VALUES (${pessoa.email}, ${pessoa.id}, 'CREDENCIAL_INCORRETA')
      RETURNING id
    `;

    if (linha === undefined) {
      throw new Error('o arranjo não conseguiu registrar a tentativa de entrada');
    }

    return linha.id;
  });
}

/** O vínculo de acesso da pessoa, semeado **sob o contexto da empresa** — a política o exige. */
async function semearVinculoDeAcesso(empresaId: string, usuarioId: string): Promise<void> {
  await emUnidadeSobContexto(acesso, { empresaId }, async (tx) => {
    await tx`
      INSERT INTO negocio.acesso_usuario_app (empresa_id, usuario_id)
      VALUES (${empresaId}, ${usuarioId})
    `;
  });
}

// ---------------------------------------------------------------------------
// Leituras cruas — a prova de estado, nunca o valor de retorno
// ---------------------------------------------------------------------------

/**
 * O total de uma contagem crua.
 *
 * `count(*)` volta como `bigint`, que o driver entrega em cadeia de caracteres — a conversão
 * explícita é o que impede as asserções de compararem `'2'` com `2`. A ausência de linha devolve
 * `-1`, e não `0`: zero é um resultado legítimo de toda contagem deste arquivo, e colapsar os dois
 * faria um `SELECT` que não voltou passar por "não há linhas".
 */
async function totalDe(consulta: Promise<{ total: string }[]>): Promise<number> {
  const [linha] = await consulta;
  return Number(linha?.total ?? -1);
}

async function contarEmpresa(tx: TransactionSql, empresaId: string): Promise<number> {
  return await totalDe(
    tx<{ total: string }[]>`
      SELECT count(*) AS total FROM identidade.empresa WHERE id = ${empresaId}
    `,
  );
}

async function contarEmpresas(tx: TransactionSql): Promise<number> {
  return await totalDe(tx<{ total: string }[]>`SELECT count(*) AS total FROM identidade.empresa`);
}

async function contarPessoas(tx: TransactionSql): Promise<number> {
  return await totalDe(tx<{ total: string }[]>`SELECT count(*) AS total FROM identidade.usuario`);
}

async function contarPessoasDaEmpresa(tx: TransactionSql, empresaId: string): Promise<number> {
  return await totalDe(
    tx<{ total: string }[]>`
      SELECT count(*) AS total FROM identidade.usuario WHERE empresa_id = ${empresaId}
    `,
  );
}

async function contarPessoa(tx: TransactionSql, usuarioId: string): Promise<number> {
  return await totalDe(
    tx<{ total: string }[]>`
      SELECT count(*) AS total FROM identidade.usuario WHERE id = ${usuarioId}
    `,
  );
}

async function contarSessoes(tx: TransactionSql, usuarioId: string): Promise<number> {
  return await totalDe(
    tx<{ total: string }[]>`
      SELECT count(*) AS total FROM identidade.sessao WHERE usuario_id = ${usuarioId}
    `,
  );
}

async function contarContas(tx: TransactionSql, usuarioId: string): Promise<number> {
  return await totalDe(
    tx<{ total: string }[]>`
      SELECT count(*) AS total FROM identidade.conta WHERE usuario_id = ${usuarioId}
    `,
  );
}

async function contarDoisFatores(tx: TransactionSql, usuarioId: string): Promise<number> {
  return await totalDe(
    tx<{ total: string }[]>`
      SELECT count(*) AS total FROM identidade.dois_fatores WHERE usuario_id = ${usuarioId}
    `,
  );
}

async function contarTentativas(tx: TransactionSql, usuarioId: string): Promise<number> {
  return await totalDe(
    tx<{ total: string }[]>`
      SELECT count(*) AS total FROM identidade.tentativa_login WHERE usuario_id = ${usuarioId}
    `,
  );
}

/**
 * A contagem **ingênua** de contratos da empresa — a que uma elegibilidade por contagem usaria.
 *
 * Ela é o eixo do `CT-1204`: sob o contexto do Master ela devolve `0` para uma empresa **cheia**,
 * porque a política de `0001_seguranca.sql` é `FORCE` e não casa sem empresa no contexto.
 */
async function contarContratos(tx: TransactionSql, empresaId: string): Promise<number> {
  return await totalDe(
    tx<{ total: string }[]>`
      SELECT count(*) AS total FROM negocio.contrato WHERE empresa_id = ${empresaId}
    `,
  );
}

/** A coluna `ativo`, lida cruamente — a prova do `CT-1207`. */
async function lerAtivoCru(tx: TransactionSql, usuarioId: string): Promise<boolean | undefined> {
  const [linha] = await tx<{ ativo: boolean }[]>`
    SELECT ativo FROM identidade.usuario WHERE id = ${usuarioId}
  `;

  return linha?.ativo;
}

/** Nome e e-mail lidos cruamente — a prova do `CT-1218`. */
async function lerCadastroCru(
  tx: TransactionSql,
  usuarioId: string,
): Promise<{ nome: string; email: string } | undefined> {
  const [linha] = await tx<{ nome: string; email: string }[]>`
    SELECT nome, email FROM identidade.usuario WHERE id = ${usuarioId}
  `;

  return linha;
}

/** Nome, documento e marca de suspensão lidos cruamente — a prova do `CT-1219` e do `CT-1208`. */
async function lerEmpresaCrua(
  tx: TransactionSql,
  empresaId: string,
): Promise<{ nome: string; documento: string; suspensaEm: Date | null } | undefined> {
  const [linha] = await tx<{ nome: string; documento: string; suspensaEm: Date | null }[]>`
    SELECT nome, documento, suspensa_em AS "suspensaEm"
      FROM identidade.empresa
     WHERE id = ${empresaId}
  `;

  return linha;
}

// ===========================================================================
// CT-1204 / CT-1205 — a armadilha A1: os dois zeros com desfechos opostos
// ===========================================================================

describe('CT-1204 — a empresa CHEIA é recusada enquanto a contagem ingênua devolve zero', () => {
  it('recusa com REGISTROS_DE_NEGOCIO e mede 0 na mesma unidade de trabalho', async () => {
    const empresa = await semearEmpresa('Imobiliária Cheia');
    await semearCobrancaDoZero(acesso, { empresaId: empresa.id }, `a1-${proximaMarca()}`);

    // CONTROLE ANTIVÁCUO: sob o contexto DA EMPRESA a mesma contagem devolve 1. Sem ele, o zero
    // medido adiante seria indistinguível de "nada foi semeado", e o caso passaria por vacuidade.
    const contratosSobAEmpresa = await emUnidadeSobContexto(
      acesso,
      { empresaId: empresa.id },
      async (tx) => await contarContratos(tx, empresa.id),
    );
    expect(contratosSobAEmpresa).toBe(1);

    const medido = await emUnidadeDoMaster(async (tx) => ({
      contagemIngenua: await contarContratos(tx, empresa.id),
      elegibilidade: await elegibilidadeDeExclusaoDaEmpresa(tx, empresa.id),
    }));

    // Os dois na MESMA unidade: é a simultaneidade que torna o par uma prova, e não duas medições
    // que por acaso discordam.
    expect(medido.contagemIngenua).toBe(0);
    expect(medido.elegibilidade).toEqual({
      elegivel: false,
      impedimentos: ['REGISTROS_DE_NEGOCIO'],
    });

    // E o ensaio não removeu a empresa — conferido DEPOIS do commit da unidade acima.
    const sobrevivente = await emUnidadeDoMaster(async (tx) => await contarEmpresa(tx, empresa.id));
    expect(sobrevivente).toBe(1);
  }, 120_000);
});

describe('CT-1205 — a empresa VAZIA é elegível, com a MESMA contagem zero', () => {
  it('aceita com impedimentos vazios e mede 0 na mesma unidade de trabalho', async () => {
    const empresa = await semearEmpresa('Imobiliária Vazia');

    const medido = await emUnidadeDoMaster(async (tx) => ({
      contagemIngenua: await contarContratos(tx, empresa.id),
      elegibilidade: await elegibilidadeDeExclusaoDaEmpresa(tx, empresa.id),
    }));

    expect(medido.contagemIngenua).toBe(0);
    // Igualdade do objeto inteiro, e não `length === 0`: o array vazio é afirmado por igualdade.
    expect(medido.elegibilidade).toEqual({ elegivel: true, impedimentos: [] });
  }, 120_000);
});

// ===========================================================================
// CT-1206 / CT-1207 — a armadilha A2, uma metade por ponto de escrita
// ===========================================================================

describe('CT-1206 — o encerramento do Master alcança a pessoa; o de `pessoa.ts` não', () => {
  it('devolve 2 e zera, enquanto encerrarSessoesDaPessoa devolve 0 e não move nada', async () => {
    const empresa = await semearEmpresa('Imobiliária do Encerramento');
    const admin = await semearPessoa(empresa.id, 'ADMIN_EMPRESA', 'Ana do Encerramento');
    // O vínculo nasce SOB o contexto da empresa: sem ele, o zero da função antiga seria trivial —
    // ela não teria por onde alcançar nem com contexto.
    await semearVinculoDeAcesso(empresa.id, admin.id);
    await semearSessoes(admin.id, 2);

    const medido = await emUnidadeDoMaster(async (tx) => {
      const peloVinculo = await encerrarSessoesDaPessoa(tx, admin.id);
      const apósOVinculo = await contarSessoes(tx, admin.id);
      const peloMaster = await encerrarSessoesDoAdministrador(tx, admin.id);
      const apósOMaster = await contarSessoes(tx, admin.id);

      return { peloVinculo, apósOVinculo, peloMaster, apósOMaster };
    });

    // Os QUATRO números, um a um: trocar a função nova pela antiga reprova em duas asserções.
    expect(medido.peloVinculo).toBe(0);
    expect(medido.apósOVinculo).toBe(2);
    expect(medido.peloMaster).toBe(2);
    expect(medido.apósOMaster).toBe(0);
  }, 120_000);
});

describe('CT-1206 (b) — a escrita recorta por perfil; a leitura, por decisão, não', () => {
  it('devolve 0 sobre um USUARIO_EMPRESA e deixa as 2 sessões dele intactas', async () => {
    const empresa = await semearEmpresa('Imobiliária do Recorte');
    // O alvo é de OUTRO perfil, e é isso que o caso discrimina: com o `DELETE` sem recorte, ele
    // devolveria 2 e zeraria a contagem. Chamado com o id do Sysloc Master, o mesmo SQL sem
    // recorte encerraria as sessões do próprio operador do SaaS.
    const outroPerfil = await semearPessoa(empresa.id, 'USUARIO_EMPRESA', 'Dora do Recorte');
    await semearVinculoDeAcesso(empresa.id, outroPerfil.id);
    await semearSessoes(outroPerfil.id, 2);

    const medido = await emUnidadeDoMaster(async (tx) => ({
      peloMaster: await encerrarSessoesDoAdministrador(tx, outroPerfil.id),
      apósOMaster: await contarSessoes(tx, outroPerfil.id),
      lido: await lerAdministrador(tx, outroPerfil.id),
    }));

    // A contagem crua é a prova de estado: o retorno `0` sozinho seria compatível com um `DELETE`
    // que não achou a pessoa, e não com um que a achou e recusou por perfil.
    expect(medido.peloMaster).toBe(0);
    expect(medido.apósOMaster).toBe(2);

    // A leitura NÃO recorta, e é o perfil que ela devolve que a borda usará para recusar com `422`
    // nomeando `perfilDoAlvo` (RN-06) — um recorte ali viraria um `404` indistinguível.
    expect(medido.lido?.id).toBe(outroPerfil.id);
    expect(medido.lido?.perfil).toBe('USUARIO_EMPRESA');
  }, 120_000);
});

describe('CT-1207 — a marcação do Master escreve a coluna; a de `pessoa.ts` não', () => {
  it('grava ativo=false, enquanto definirAtivoDaPessoa devolve undefined sem escrever', async () => {
    const empresa = await semearEmpresa('Imobiliária da Marcação');
    const admin = await semearPessoa(empresa.id, 'ADMIN_EMPRESA', 'Bruno da Marcação');
    await semearVinculoDeAcesso(empresa.id, admin.id);

    const medido = await emUnidadeDoMaster(async (tx) => {
      const retornoPeloVinculo = await definirAtivoDaPessoa(tx, admin.id, false);
      const ativoApósOVinculo = await lerAtivoCru(tx, admin.id);
      const retornoPeloMaster = await definirAtivoDoAdministrador(tx, admin.id, false);
      const ativoApósOMaster = await lerAtivoCru(tx, admin.id);

      return { retornoPeloVinculo, ativoApósOVinculo, retornoPeloMaster, ativoApósOMaster };
    });

    expect(medido.retornoPeloVinculo).toBeUndefined();
    // As DUAS leituras cruas são a prova de estado — o valor de retorno é o que a implementação
    // errada acertaria por acaso.
    expect(medido.ativoApósOVinculo).toBe(true);
    expect(medido.retornoPeloMaster).toBe(false);
    expect(medido.ativoApósOMaster).toBe(false);
  }, 120_000);
});

// ===========================================================================
// CT-1208 / CT-1209 — o ensaio é desfeito nos DOIS caminhos
// ===========================================================================

describe('CT-1208 — a prévia que RECUSA não deixa efeito, nem depois do commit', () => {
  it('preserva as contagens de empresa e de pessoa, medidas em unidades separadas', async () => {
    const cheia = await semearEmpresa('Imobiliária Sondada Cheia');
    await semearPessoa(cheia.id, 'ADMIN_EMPRESA', 'Carla da Cheia');
    await semearCobrancaDoZero(acesso, { empresaId: cheia.id }, `sonda-${proximaMarca()}`);

    const vazia = await semearEmpresa('Imobiliária Sondada Vazia');
    await semearPessoa(vazia.id, 'ADMIN_EMPRESA', 'Davi da Vazia');

    const antes = await emUnidadeDoMaster(async (tx) => ({
      empresas: await contarEmpresas(tx),
      pessoas: await contarPessoas(tx),
    }));

    // A unidade da sonda COMITA: medir dentro dela não distinguiria o desfazimento do ponto de
    // salvamento do desfazimento da transação inteira.
    const elegibilidade = await emUnidadeDoMaster(
      async (tx) => await elegibilidadeDeExclusaoDaEmpresa(tx, cheia.id),
    );
    expect(elegibilidade.elegivel).toBe(false);

    const depois = await emUnidadeDoMaster(async (tx) => ({
      empresas: await contarEmpresas(tx),
      pessoas: await contarPessoas(tx),
      empresaSondada: await lerEmpresaCrua(tx, cheia.id),
    }));

    // Igualdade com os valores capturados, nunca `> 0`.
    expect(depois.empresas).toBe(antes.empresas);
    expect(depois.pessoas).toBe(antes.pessoas);
    expect(depois.empresaSondada?.suspensaEm).toBeNull();

    // A empresa VAZIA existe neste caso para que o par com o CT-1209 seja legível: é ela que o
    // caminho de sucesso da sonda percorre, e é lá que um `savepoint` esquecido apareceria.
    expect(await emUnidadeDoMaster(async (tx) => await contarEmpresa(tx, vazia.id))).toBe(1);
  }, 120_000);
});

describe('CT-1209 — a prévia que ACEITA também não remove: só o ato remove', () => {
  it('deixa empresa e administrador de pé após a sonda, e os remove só na exclusão', async () => {
    const empresa = await semearEmpresa('Imobiliária Elegível');
    const admin = await semearPessoa(empresa.id, 'ADMIN_EMPRESA', 'Elisa da Elegível');

    const elegibilidade = await emUnidadeDoMaster(
      async (tx) => await elegibilidadeDeExclusaoDaEmpresa(tx, empresa.id),
    );
    expect(elegibilidade).toEqual({ elegivel: true, impedimentos: [] });

    const apósASonda = await emUnidadeDoMaster(async (tx) => ({
      empresa: await contarEmpresa(tx, empresa.id),
      admin: await contarPessoa(tx, admin.id),
    }));

    const desfecho = await emUnidadeDoMaster(async (tx) => await excluirEmpresa(tx, empresa.id));
    expect(desfecho).toEqual({ desfecho: 'REMOVIDO' });

    const apósOAto = await emUnidadeDoMaster(async (tx) => ({
      empresa: await contarEmpresa(tx, empresa.id),
      admin: await contarPessoa(tx, admin.id),
    }));

    // Os quatro números por igualdade: é o par 1/1 → 0/0 que discrimina o `savepoint` esquecido,
    // porque este é o único caminho em que o `DELETE` do ensaio teria SUCESSO.
    expect(apósASonda).toEqual({ empresa: 1, admin: 1 });
    expect(apósOAto).toEqual({ empresa: 0, admin: 0 });
  }, 120_000);
});

// ===========================================================================
// CT-1210 / CT-1211 — as origens de impedimento do administrador
// ===========================================================================

/**
 * As SETE origens, uma por linha, com a classe exata que cada uma produz.
 *
 * Cada linha semeia **só** a sua origem: um arranjo com as sete juntas passaria com uma
 * implementação que só reconhecesse a primeira.
 */
const ORIGENS_DE_IMPEDIMENTO: readonly {
  readonly origem: string;
  readonly classe: ClasseDeImpedimento;
  readonly semear: (empresaId: string, pessoa: PessoaSemeada) => Promise<void>;
}[] = [
  {
    origem: 'identidade.tentativa_login',
    classe: 'TENTATIVA_DE_ENTRADA',
    semear: async (_empresaId, pessoa) => {
      await semearTentativaDeEntrada(pessoa);
    },
  },
  {
    origem: 'negocio.acesso_usuario_app',
    classe: 'VINCULO_DE_ACESSO',
    semear: async (empresaId, pessoa) => {
      await semearVinculoDeAcesso(empresaId, pessoa.id);
    },
  },
  {
    origem: 'negocio.certificado_do_provedor.registrado_por',
    classe: 'AUTORIA_EM_REGISTRO',
    semear: async (empresaId, pessoa) => {
      await emUnidadeSobContexto(acesso, { empresaId }, async (tx) => {
        await tx`
          INSERT INTO negocio.certificado_do_provedor
                      (empresa_id, titular, valido_de, valido_ate, impressao_digital,
                       segredo_cifrado, registrado_por)
          VALUES (${empresaId}, 'Titular Descartável', now() - interval '1 day',
                  now() + interval '365 days', ${`impressao-${proximaMarca()}`},
                  'envelope-descartavel', ${pessoa.id})
        `;
      });
    },
  },
  {
    origem: 'negocio.emissao_em_lote.solicitado_por',
    classe: 'AUTORIA_EM_REGISTRO',
    semear: async (empresaId, pessoa) => {
      await emUnidadeSobContexto(acesso, { empresaId }, async (tx) => {
        await tx`
          INSERT INTO negocio.emissao_em_lote (empresa_id, competencia, solicitado_por)
          VALUES (${empresaId}, '2026-01-01', ${pessoa.id})
        `;
      });
    },
  },
  {
    origem: 'negocio.conferencia_bancaria.solicitada_por',
    classe: 'AUTORIA_EM_REGISTRO',
    semear: async (empresaId, pessoa) => {
      await emUnidadeSobContexto(acesso, { empresaId }, async (tx) => {
        await tx`
          INSERT INTO negocio.conferencia_bancaria (empresa_id, solicitada_por)
          VALUES (${empresaId}, ${pessoa.id})
        `;
      });
    },
  },
  {
    origem: 'negocio.identidade_no_provedor.registrado_por',
    classe: 'AUTORIA_EM_REGISTRO',
    semear: async (empresaId, pessoa) => {
      await emUnidadeSobContexto(acesso, { empresaId }, async (tx) => {
        await tx`
          INSERT INTO negocio.identidade_no_provedor
                      (empresa_id, identificador_da_aplicacao_cifrado, numero_do_cliente,
                       numero_da_conta_corrente, codigo_da_modalidade, registrado_por)
          VALUES (${empresaId}, 'envelope-descartavel', 1, 2, 3, ${pessoa.id})
        `;
      });
    },
  },
  {
    origem: 'negocio.entrega_da_noticia.verificada_por',
    classe: 'AUTORIA_EM_REGISTRO',
    semear: async (empresaId, pessoa) => {
      await emUnidadeSobContexto(acesso, { empresaId }, async (tx) => {
        await tx`
          INSERT INTO negocio.entrega_da_noticia
                      (empresa_id, habilitada, situacao, verificada_em, verificada_por)
          VALUES (${empresaId}, false, 'EM_VALIDACAO', now(), ${pessoa.id})
        `;
      });
    },
  },
];

describe('CT-1210 — cada origem, sozinha, torna o administrador inelegível com a classe exata', () => {
  it.each(ORIGENS_DE_IMPEDIMENTO)(
    'a origem $origem produz $classe e a pessoa continua existindo',
    async ({ classe, semear }) => {
      const empresa = await semearEmpresa('Imobiliária do Impedimento');
      const admin = await semearPessoa(empresa.id, 'ADMIN_EMPRESA', 'Fábio do Impedimento');
      await semear(empresa.id, admin);

      const medido = await emUnidadeDoMaster(async (tx) => ({
        elegibilidade: await elegibilidadeDeExclusaoDoAdministrador(tx, admin.id),
        pessoa: await contarPessoa(tx, admin.id),
      }));

      // Igualdade de array, nunca `toContain`: contenção aprovaria uma implementação que devolvesse
      // todas as classes de uma vez.
      expect(medido.elegibilidade).toEqual({ elegivel: false, impedimentos: [classe] });
      expect(medido.pessoa).toBe(1);
    },
    120_000,
  );

  it('CT-1210 (b) — as DUAS restrições da acesso_usuario_app recebem a MESMA classe', () => {
    // O arranjo do caso acima não consegue discriminar qual das duas dispara: uma linha de vínculo
    // provoca as duas, e o PostgreSQL não garante a ordem. É por isso que a completude do par é
    // afirmada aqui, sobre o vocabulário: classificar só uma faria METADE das recusas degradar para
    // erro genérico, contra a RN-15, e o caso acima seguiria verde.
    expect(IMPEDIMENTOS_DE_EXCLUSAO.acesso_usuario_app_usuario_id_usuario_id_fk).toBe(
      'VINCULO_DE_ACESSO',
    );
    expect(IMPEDIMENTOS_DE_EXCLUSAO.acesso_usuario_app_usuario_empresa_fkey).toBe(
      'VINCULO_DE_ACESSO',
    );
  });
});

/** A dependência descartável que o `CT-1210 (c)` cria — e que o vocabulário NÃO conhece. */
const TABELA_SEM_CLASSE = 'negocio.dependencia_sem_classe';
const RESTRICAO_SEM_CLASSE = 'dependencia_sem_classe_usuario_fk';

describe('CT-1210 (c) — dependência sem classe no vocabulário faz a prévia FALHAR FECHADA', () => {
  it('levanta a recusa do servidor em vez de declarar o administrador elegível', async () => {
    const empresa = await semearEmpresa('Imobiliária da Dependência Nova');
    const admin = await semearPessoa(empresa.id, 'ADMIN_EMPRESA', 'Paulo Sem Classe');

    // CONTROLE ANTES: sem a dependência, o administrador é elegível. Sem ele, o levantamento
    // adiante não seria atribuível à restrição nova — poderia ser um arranjo já impedido.
    const antes = await emUnidadeDoMaster(
      async (tx) => await elegibilidadeDeExclusaoDoAdministrador(tx, admin.id),
    );
    expect(antes).toEqual({ elegivel: true, impedimentos: [] });

    const doMigrador = abrirConexao(conexaoDeMigracao(banco), { maximoDeConexoes: 1 });
    try {
      await doMigrador.unsafe(`
        CREATE TABLE ${TABELA_SEM_CLASSE} (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          usuario_id uuid NOT NULL,
          CONSTRAINT ${RESTRICAO_SEM_CLASSE}
            FOREIGN KEY (usuario_id) REFERENCES identidade.usuario (id) ON DELETE NO ACTION
        )
      `);
      await doMigrador.unsafe(`INSERT INTO ${TABELA_SEM_CLASSE} (usuario_id) VALUES ($1)`, [
        admin.id,
      ]);

      await emUnidadeDoMaster(async (tx) => {
        // LEVANTA, e não devolve `{ elegivel: true }`: uma classificação que caísse no lado
        // permissivo declararia excluível quem o banco recusa, e o operador só descobriria depois
        // do clique — com a causa já perdida. O erro sobe INTACTO, com o par (`code`,
        // `constraint_name`) que nomeia a dependência esquecida.
        await expect(elegibilidadeDeExclusaoDoAdministrador(tx, admin.id)).rejects.toMatchObject({
          code: '23503',
          constraint_name: RESTRICAO_SEM_CLASSE,
        });
      });
    } finally {
      await doMigrador.unsafe(`DROP TABLE IF EXISTS ${TABELA_SEM_CLASSE}`);
      await doMigrador.end();
    }

    // CONTROLE DEPOIS: removida a dependência, a prévia volta ao verde. A reversibilidade é o que
    // prova que foi a restrição nova, e não um efeito colateral do caso, que produziu a inversão.
    const depois = await emUnidadeDoMaster(
      async (tx) => await elegibilidadeDeExclusaoDoAdministrador(tx, admin.id),
    );
    expect(depois).toEqual({ elegivel: true, impedimentos: [] });
  }, 120_000);
});

describe('CT-1211 — o administrador virgem é removido, e conta/2FA/sessão somem por cascata', () => {
  it('perde exatamente 1 linha de usuario e as 3 dependentes, com o colega intacto', async () => {
    const empresa = await semearEmpresa('Imobiliária da Cascata');
    const alvo = await semearPessoa(empresa.id, 'ADMIN_EMPRESA', 'Gustavo Virgem');
    const colega = await semearPessoa(empresa.id, 'ADMIN_EMPRESA', 'Helena Colega');

    for (const pessoa of [alvo, colega]) {
      await semearConta(pessoa.id);
      await semearDoisFatores(pessoa.id);
      await semearSessoes(pessoa.id, 1);
    }

    const antes = await emUnidadeDoMaster(async (tx) => ({
      pessoasDaEmpresa: await contarPessoasDaEmpresa(tx, empresa.id),
      contasDoAlvo: await contarContas(tx, alvo.id),
      doisFatoresDoAlvo: await contarDoisFatores(tx, alvo.id),
      sessoesDoAlvo: await contarSessoes(tx, alvo.id),
      contasDoColega: await contarContas(tx, colega.id),
      doisFatoresDoColega: await contarDoisFatores(tx, colega.id),
      sessoesDoColega: await contarSessoes(tx, colega.id),
    }));
    expect(antes).toEqual({
      pessoasDaEmpresa: 2,
      contasDoAlvo: 1,
      doisFatoresDoAlvo: 1,
      sessoesDoAlvo: 1,
      contasDoColega: 1,
      doisFatoresDoColega: 1,
      sessoesDoColega: 1,
    });

    const desfecho = await emUnidadeDoMaster(async (tx) => await excluirAdministrador(tx, alvo.id));
    expect(desfecho).toEqual({ desfecho: 'REMOVIDO' });

    const depois = await emUnidadeDoMaster(async (tx) => ({
      pessoasDaEmpresa: await contarPessoasDaEmpresa(tx, empresa.id),
      contasDoAlvo: await contarContas(tx, alvo.id),
      doisFatoresDoAlvo: await contarDoisFatores(tx, alvo.id),
      sessoesDoAlvo: await contarSessoes(tx, alvo.id),
      contasDoColega: await contarContas(tx, colega.id),
      doisFatoresDoColega: await contarDoisFatores(tx, colega.id),
      sessoesDoColega: await contarSessoes(tx, colega.id),
      colegaAindaLegivel: (await lerAdministrador(tx, colega.id))?.id,
    }));

    // O COLEGA é o controle indispensável: sem ele, um `DELETE` sem cláusula passaria em todas as
    // demais asserções.
    expect(depois).toEqual({
      pessoasDaEmpresa: 1,
      contasDoAlvo: 0,
      doisFatoresDoAlvo: 0,
      sessoesDoAlvo: 0,
      contasDoColega: 1,
      doisFatoresDoColega: 1,
      sessoesDoColega: 1,
      colegaAindaLegivel: colega.id,
    });
  }, 120_000);
});

describe('CT-1212 — a recusa da exclusão NUNCA destrói a trilha de tentativas', () => {
  it('preserva a contagem e o id literal da linha de tentativa_login', async () => {
    const empresa = await semearEmpresa('Imobiliária da Trilha');
    const admin = await semearPessoa(empresa.id, 'ADMIN_EMPRESA', 'Iara da Trilha');
    const idDaTentativa = await semearTentativaDeEntrada(admin);

    const antes = await emUnidadeDoMaster(async (tx) => await contarTentativas(tx, admin.id));
    expect(antes).toBe(1);

    const desfecho = await emUnidadeDoMaster(
      async (tx) => await excluirAdministrador(tx, admin.id),
    );
    expect(desfecho).toEqual({
      desfecho: 'IMPEDIDO',
      impedimentos: ['TENTATIVA_DE_ENTRADA'],
    });

    const depois = await emUnidadeDoMaster(async (tx) => {
      const [linha] = await tx<{ id: string }[]>`
        SELECT id FROM identidade.tentativa_login WHERE usuario_id = ${admin.id}
      `;

      return { total: await contarTentativas(tx, admin.id), id: linha?.id };
    });

    // O `id` literalmente igual ao capturado: uma trilha reescrita passaria numa asserção de
    // contagem sozinha.
    expect(depois).toEqual({ total: 1, id: idDaTentativa });
  }, 120_000);
});

// ===========================================================================
// CT-1213 / CT-1214 — a exclusão da empresa é um commit só, e é atômica
// ===========================================================================

describe('CT-1213 — 2 administradores, 1 inelegível: a operação INTEIRA recusa', () => {
  it('recusa por ADMINISTRADORES_NAO_ELEGIVEIS e preserva as 3 linhas', async () => {
    const empresa = await semearEmpresa('Imobiliária Atômica');
    const virgem = await semearPessoa(empresa.id, 'ADMIN_EMPRESA', 'João Virgem');
    const comTrilha = await semearPessoa(empresa.id, 'ADMIN_EMPRESA', 'Karla Com Trilha');
    await semearTentativaDeEntrada(comTrilha);

    // A unidade COMITA: a recusa é valor devolvido, e o desfazimento é do ponto de salvamento —
    // se ela dependesse do desfazimento da transação, medir depois do commit não discriminaria.
    const desfecho = await emUnidadeDoMaster(async (tx) => await excluirEmpresa(tx, empresa.id));
    expect(desfecho).toEqual({
      desfecho: 'IMPEDIDO',
      impedimentos: ['ADMINISTRADORES_NAO_ELEGIVEIS'],
    });

    const depois = await emUnidadeDoMaster(async (tx) => ({
      empresa: await contarEmpresa(tx, empresa.id),
      pessoasDaEmpresa: await contarPessoasDaEmpresa(tx, empresa.id),
      virgem: await contarPessoa(tx, virgem.id),
      comTrilha: await contarPessoa(tx, comTrilha.id),
    }));

    // A sobrevivência do administrador VIRGEM é o eixo: ela reprova uma remoção em laço que apagasse
    // até topar no primeiro impedido.
    expect(depois).toEqual({ empresa: 1, pessoasDaEmpresa: 2, virgem: 1, comTrilha: 1 });
  }, 120_000);
});

describe('CT-1214 — empresa vazia com administrador virgem: os dois somem na mesma transação', () => {
  it('remove os dois e deixa a empresa de controle intacta', async () => {
    const alvo = await semearEmpresa('Imobiliária Removida');
    const adminDoAlvo = await semearPessoa(alvo.id, 'ADMIN_EMPRESA', 'Lucas do Alvo');

    const controle = await semearEmpresa('Imobiliária de Controle');
    const adminDoControle = await semearPessoa(controle.id, 'ADMIN_EMPRESA', 'Marina do Controle');

    const desfecho = await emUnidadeDoMaster(async (tx) => await excluirEmpresa(tx, alvo.id));
    expect(desfecho).toEqual({ desfecho: 'REMOVIDO' });

    const depois = await emUnidadeDoMaster(async (tx) => ({
      alvo: await contarEmpresa(tx, alvo.id),
      adminDoAlvo: await contarPessoa(tx, adminDoAlvo.id),
      controle: await contarEmpresa(tx, controle.id),
      adminDoControle: await contarPessoa(tx, adminDoControle.id),
    }));

    // A empresa de CONTROLE, com o próprio administrador, é o que impede um `DELETE` sem cláusula
    // de passar em qualquer das quatro asserções.
    expect(depois).toEqual({ alvo: 0, adminDoAlvo: 0, controle: 1, adminDoControle: 1 });
  }, 120_000);
});

// ===========================================================================
// CT-1217 — a listagem alcança só os ADMIN_EMPRESA daquela empresa
// ===========================================================================

describe('CT-1217 — a listagem devolve o conjunto EXATO dos ADMIN_EMPRESA da empresa', () => {
  it('não traz o USUARIO_EMPRESA da mesma empresa nem o ADMIN_EMPRESA da outra', async () => {
    const consultada = await semearEmpresa('Imobiliária Consultada');
    const primeiro = await semearPessoa(consultada.id, 'ADMIN_EMPRESA', 'Ana Primeira');
    const segundo = await semearPessoa(consultada.id, 'ADMIN_EMPRESA', 'Bento Segundo');
    // Os DOIS controles que fazem o caso discriminar: sem eles, uma listagem sem cláusula alguma
    // passaria.
    await semearPessoa(consultada.id, 'USUARIO_EMPRESA', 'Célia Operadora');

    const outra = await semearEmpresa('Imobiliária Alheia');
    await semearPessoa(outra.id, 'ADMIN_EMPRESA', 'Dulce Alheia');

    const pagina = await emUnidadeDoMaster(
      async (tx) => await listarAdministradoresDaEmpresa(tx, consultada.id, JANELA_PADRAO),
    );

    const observados = pagina.administradores.map((administrador) => administrador.id);
    expect(observados.length).toBe(2);
    expect(diferencasDeConjunto(observados, [primeiro.id, segundo.id])).toEqual({
      excedentes: [],
      ausentes: [],
    });
    // `count(*)` volta como `bigint`, que o driver entrega em cadeia: o total tem de ser NÚMERO.
    expect(pagina.total).toBe(2);
    expect(typeof pagina.total).toBe('number');
  }, 120_000);
});

// ===========================================================================
// CT-1218 / CT-1219 — unicidade recusa sem gravar nada
// ===========================================================================

describe('CT-1218 — e-mail já em uso recusa a correção e NADA é gravado', () => {
  it('atribui a colisão ao e-mail e preserva nome e e-mail do alvo bit a bit', async () => {
    const empresa = await semearEmpresa('Imobiliária do E-mail');
    const alvo = await semearPessoa(empresa.id, 'ADMIN_EMPRESA', 'Nara Alvo');
    const outro = await semearPessoa(empresa.id, 'ADMIN_EMPRESA', 'Otávio Outro');

    // A unidade COMITA depois da recusa: é o ponto de salvamento que desfaz a escrita, e medir
    // depois do commit é o que distingue isso de um desfazimento da transação inteira.
    const desfecho = await emUnidadeDoMaster(
      async (tx) =>
        await alterarAdministrador(tx, alvo.id, { nome: 'Nome Novo', email: outro.email }),
    );

    // A recusa é atribuída ao CAMPO, e não uma falha genérica.
    expect(desfecho).toEqual({ desfecho: 'EMAIL_EM_USO' });

    const depois = await emUnidadeDoMaster(async (tx) => ({
      alvo: await lerCadastroCru(tx, alvo.id),
      outro: await lerCadastroCru(tx, outro.id),
    }));

    // O NOME novo viajava no mesmo corpo, e é ele que reprova uma implementação que grave os campos
    // um a um.
    expect(depois.alvo).toEqual({ nome: alvo.nome, email: alvo.email });
    expect(depois.outro).toEqual({ nome: outro.nome, email: outro.email });
  }, 120_000);
});

describe('CT-1219 — documento já em uso recusa a edição e NENHUMA das duas empresas muda', () => {
  it('levanta ErroDeDocumentoDeEmpresaEmUso e preserva as duas linhas campo a campo', async () => {
    const alvo = await semearEmpresa('Imobiliária Editada');
    const outra = await semearEmpresa('Imobiliária Ocupante');

    const antes = await emUnidadeDoMaster(async (tx) => ({
      alvo: await lerEmpresaCrua(tx, alvo.id),
      outra: await lerEmpresaCrua(tx, outra.id),
    }));

    await emUnidadeDoMaster(async (tx) => {
      // A classe específica, nunca "ocorreu um erro": um `catch` genérico de `23505` seria aprovado
      // por uma asserção mais frouxa.
      await expect(
        alterarEmpresa(tx, alvo.id, { nome: 'Nome Novo', documento: outra.documento }),
      ).rejects.toBeInstanceOf(ErroDeDocumentoDeEmpresaEmUso);
    });

    const depois = await emUnidadeDoMaster(async (tx) => ({
      alvo: await lerEmpresaCrua(tx, alvo.id),
      outra: await lerEmpresaCrua(tx, outra.id),
    }));

    expect(depois.alvo).toEqual(antes.alvo);
    expect(depois.outra).toEqual(antes.outra);
  }, 120_000);
});
