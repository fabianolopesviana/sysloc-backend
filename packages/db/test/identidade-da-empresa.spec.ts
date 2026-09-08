/**
 * A identidade da empresa no aviso — a leitura que o remetente único da virada F7 tornou necessária.
 *
 * Rastreabilidade: CA-01 → CT-1277 (RN-01); companheiro de isolamento em CT-1278.
 *
 * INVARIANTES deste arquivo:
 *
 * - CT-1277: `lerIdentidadeDaEmpresaDoContexto` devolve o nome e o endereço de contato da empresa
 *   **do contexto**, e a coluna `email_contato` (migração `0028`) aceita nulo e texto.
 * - CT-1278: sob o contexto de uma empresa, a leitura **NÃO alcança** a identidade de outra — e o
 *   par é afirmado nas DUAS direções, com as duas empresas semeadas.
 * - CT-1279: sem empresa no contexto, a leitura devolve `undefined` — e não a primeira linha da
 *   tabela.
 *
 * ===========================================================================
 * POR QUE O CT-1278 É O CASO QUE IMPORTA
 * ===========================================================================
 *
 * `identidade.empresa` **não tem política de RLS** (ADR-0009), de modo que o recorte desta leitura
 * é a cláusula `WHERE` da própria consulta — e não o banco. É a única leitura do produto nessa
 * condição cujo resultado vai para dentro de uma mensagem entregue a uma pessoa real.
 *
 * O mutante que este caso existe para pegar é o mais fácil de escrever por engano: remover o
 * `WHERE` (ou trocá-lo por `LIMIT 1`). Sem o CT-1278, a suíte inteira continuaria verde — e o aviso
 * da Imobiliária Beta sairia assinado «Imobiliária Alfa», com o `Reply-To` da Alfa, para o
 * locatário da Beta. Vazamento entre inquilinos, na caixa de entrada de terceiro.
 */

import type { TransactionSql } from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import * as contextoDeTenant from '../src/contexto.ts';
import { alterarEmpresa, lerIdentidadeDaEmpresaDoContexto } from '../src/empresa.ts';
import { EMPRESA_A, EMPRESA_B } from '../src/semente.ts';
import { type AcessoAoBanco, abrirAcessoAoBanco } from '../src/unidade-de-trabalho.ts';
import { type BancoMigrado, bancoEfemero } from './banco-efemero.ts';

const LIMITE_SUBIDA_MS = 90_000;
const RESERVA_DE_UMA = 1;

const CONTEXTO_DE_A = { empresaId: EMPRESA_A.id } as const;
const CONTEXTO_DE_B = { empresaId: EMPRESA_B.id } as const;

/** O endereço que a empresa A declara — literal, para que a asserção possa reprovar. */
const CONTATO_DE_A = 'financeiro@alfa.test';

let banco: BancoMigrado;
let acesso: AcessoAoBanco;

beforeAll(async () => {
  banco = await bancoEfemero();
  acesso = abrirAcessoAoBanco({
    cadeiaDeConexao: banco.cadeiaConexao,
    maximoDeConexoes: RESERVA_DE_UMA,
  });
}, LIMITE_SUBIDA_MS);

afterAll(async () => {
  await acesso?.encerrar();
  await banco?.parar();
}, LIMITE_SUBIDA_MS);

interface Contexto {
  readonly empresaId: string;
}

/** O único caminho por onde este arquivo alcança o banco — o par que a borda também usa. */
async function emUnidade<T>(
  contexto: Contexto,
  trabalho: (tx: TransactionSql) => Promise<T>,
): Promise<T> {
  return await contextoDeTenant.executarCom(
    contexto,
    async () => await acesso.emUnidadeDeTrabalho(trabalho),
  );
}

describe('CT-1277 — a identidade sai do contexto, e a coluna aceita nulo e texto', () => {
  it('a empresa recém-semeada não tem endereço declarado, e o nome é o dela', async () => {
    const identidade = await emUnidade(CONTEXTO_DE_A, lerIdentidadeDaEmpresaDoContexto);

    // Igualdade de objeto INTEIRO, e não presença de campos: um campo a mais vazando da projeção
    // reprova aqui, e é a projeção que alimenta o assunto de uma mensagem publicada.
    expect(identidade).toEqual({ nome: EMPRESA_A.nome, emailContato: null });
  });

  it('declarado o endereço, a leitura passa a devolvê-lo — e o nome não se move', async () => {
    await emUnidade(
      CONTEXTO_DE_A,
      async (tx) =>
        await alterarEmpresa(tx, EMPRESA_A.id, {
          nome: EMPRESA_A.nome,
          documento: EMPRESA_A.documento,
          emailContato: CONTATO_DE_A,
        }),
    );

    const identidade = await emUnidade(CONTEXTO_DE_A, lerIdentidadeDaEmpresaDoContexto);

    expect(identidade).toEqual({ nome: EMPRESA_A.nome, emailContato: CONTATO_DE_A });
  });
});

describe('CT-1278 — a leitura NÃO alcança a identidade de outra empresa', () => {
  it('sob o contexto de B, o nome e o endereço são os de B — nas duas direções', async () => {
    // O arranjo do CT-1277 deixou a empresa A com endereço declarado e a B sem. A assimetria é
    // deliberada: ela faz cada uma das quatro asserções abaixo poder falhar por conta própria.
    const daB = await emUnidade(CONTEXTO_DE_B, lerIdentidadeDaEmpresaDoContexto);
    const daA = await emUnidade(CONTEXTO_DE_A, lerIdentidadeDaEmpresaDoContexto);

    expect(daB).toEqual({ nome: EMPRESA_B.nome, emailContato: null });
    expect(daA).toEqual({ nome: EMPRESA_A.nome, emailContato: CONTATO_DE_A });

    // ⚠️ As duas asserções que pegam o mutante do `WHERE` removido. Sem `WHERE`, a consulta devolve
    // a PRIMEIRA linha da tabela para os dois contextos — e as duas igualdades acima passariam
    // metade das vezes, dependendo da ordem física das linhas. Estas nomeiam o vazamento:
    expect(daB?.nome).not.toBe(EMPRESA_A.nome);
    expect(daB?.emailContato).not.toBe(CONTATO_DE_A);
  });
});

describe('CT-1279 — sem empresa no contexto, a leitura devolve `undefined`', () => {
  it('não devolve a primeira linha da tabela', async () => {
    // Sem `executarCom`, `app.empresa_id` não é fixado: `current_setting(..., true)` devolve nulo,
    // o `nullif` o mantém nulo, e `id = NULL` não casa linha alguma. É a mesma escolha, e a mesma
    // razão, da expressão que as políticas de `negocio` avaliam.
    const identidade = await acesso.emUnidadeDeTrabalho(lerIdentidadeDaEmpresaDoContexto);

    expect(identidade).toBeUndefined();
  });
});
