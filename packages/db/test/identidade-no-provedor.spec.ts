/**
 * A identidade da empresa perante o provedor bancário — camada de dados.
 *
 * CA-D36 → CT-860..CT-866 (RN-33)
 *
 * INVARIANTES
 * - o registro devolve a projeção PUBLICÁVEL, e ela **não** carrega o identificador cifrado;
 * - registrar de novo SUBSTITUI: a anterior ganha carimbo e **perde o segredo no mesmo ato**, o que
 *   a `CHECK` bicondicional da `0021` torna a única combinação representável;
 * - o envelope cifrado só vem da vigente — a substituída não tem mais o que entregar;
 * - o isolamento é do BANCO: a empresa B não alcança a identidade de A, nem para ler nem para
 *   sobrescrever. Sem este caso, a política de `0022` poderia não existir e a suíte não notaria.
 */

import type { TransactionSql } from 'postgres';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import * as contextoDeTenant from '../src/contexto.ts';
import {
  type DadosDaIdentidade,
  lerIdentidadeVigente,
  obterEnvelopeCifradoDaIdentidade,
  registrarIdentidadeNoProvedor,
} from '../src/identidade-no-provedor.ts';
import { EMPRESA_A, EMPRESA_B, USUARIOS, type UsuarioSemeado } from '../src/semente.ts';
import { type AcessoAoBanco, abrirAcessoAoBanco } from '../src/unidade-de-trabalho.ts';
import { type BancoMigrado, bancoEfemero } from './banco-efemero.ts';

const LIMITE_SUBIDA_MS = 90_000;
const LIMITE_DO_CASO_MS = 60_000;
const RESERVA_DE_UMA = 1;

function exigirUsuarioDa(empresaId: string): UsuarioSemeado {
  const achado = USUARIOS.find((u) => u.empresaId === empresaId);
  if (achado === undefined) {
    throw new Error(`a carga não tem usuário da empresa ${empresaId}`);
  }
  return achado;
}

const USUARIO_DE_A = exigirUsuarioDa(EMPRESA_A.id);
const USUARIO_DE_B = exigirUsuarioDa(EMPRESA_B.id);

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

beforeEach(async () => {
  for (const empresa of [EMPRESA_A, EMPRESA_B]) {
    await emUnidade(empresa.id, async (tx) => {
      await tx`DELETE FROM negocio.identidade_no_provedor`;
    });
  }
}, LIMITE_DO_CASO_MS);

async function emUnidade<T>(
  empresaId: string,
  trabalho: (tx: TransactionSql) => Promise<T>,
): Promise<T> {
  return await contextoDeTenant.executarCom(
    { empresaId },
    async () => await acesso.emUnidadeDeTrabalho(trabalho),
  );
}

function dadosDe(envelope: string, usuario: UsuarioSemeado): DadosDaIdentidade {
  return {
    identificadorDaAplicacaoCifrado: envelope,
    numeroDoCliente: 33065,
    numeroDaContaCorrente: 380261,
    codigoDaModalidade: 1,
    registradoPor: usuario.id,
  };
}

describe('identidade no provedor', () => {
  it(
    'CT-860 — o registro devolve a projeção publicável, SEM o identificador',
    async () => {
      const gravada = await emUnidade(
        EMPRESA_A.id,
        async (tx) =>
          await registrarIdentidadeNoProvedor(tx, dadosDe('envelope-ct860', USUARIO_DE_A)),
      );

      expect(gravada.numeroDoCliente).toBe(33065);
      expect(gravada.numeroDaContaCorrente).toBe(380261);
      expect(gravada.codigoDaModalidade).toBe(1);
      expect(gravada.registradoPor).toEqual({ id: USUARIO_DE_A.id, nome: USUARIO_DE_A.nome });
      // Igualdade de CONJUNTO de chaves: um campo novo que carregue o segredo reprova aqui, em vez
      // de depender de alguém reparar nele.
      expect(Object.keys(gravada).sort()).toEqual([
        'codigoDaModalidade',
        'id',
        'numeroDaContaCorrente',
        'numeroDoCliente',
        'registradoEm',
        'registradoPor',
      ]);
      expect(JSON.stringify(gravada)).not.toContain('envelope-ct860');
    },
    LIMITE_DO_CASO_MS,
  );

  it(
    'CT-861 — a vigente é lida sem o identificador, e o envelope vem à parte',
    async () => {
      await emUnidade(EMPRESA_A.id, async (tx) => {
        await registrarIdentidadeNoProvedor(tx, dadosDe('envelope-ct861', USUARIO_DE_A));
      });

      const [vigente, envelope] = await emUnidade(EMPRESA_A.id, async (tx) => [
        await lerIdentidadeVigente(tx),
        await obterEnvelopeCifradoDaIdentidade(tx),
      ]);

      expect(vigente?.numeroDoCliente).toBe(33065);
      expect(JSON.stringify(vigente)).not.toContain('envelope-ct861');
      expect(envelope).toBe('envelope-ct861');
    },
    LIMITE_DO_CASO_MS,
  );

  it(
    'CT-862 — sem identidade registrada, as duas leituras devolvem indefinido',
    async () => {
      const [vigente, envelope] = await emUnidade(EMPRESA_A.id, async (tx) => [
        await lerIdentidadeVigente(tx),
        await obterEnvelopeCifradoDaIdentidade(tx),
      ]);

      expect(vigente).toBeUndefined();
      expect(envelope).toBeUndefined();
    },
    LIMITE_DO_CASO_MS,
  );

  it(
    'CT-863 — registrar de novo SUBSTITUI: uma vigente só, e a anterior perde o segredo',
    async () => {
      await emUnidade(EMPRESA_A.id, async (tx) => {
        await registrarIdentidadeNoProvedor(tx, dadosDe('envelope-antigo', USUARIO_DE_A));
      });
      const nova = await emUnidade(
        EMPRESA_A.id,
        async (tx) =>
          await registrarIdentidadeNoProvedor(tx, dadosDe('envelope-novo', USUARIO_DE_A)),
      );

      const linhas = await emUnidade(
        EMPRESA_A.id,
        async (tx) =>
          await tx<{ id: string; cifrado: string | null; substituida: Date | null }[]>`
            SELECT id,
                   identificador_da_aplicacao_cifrado AS "cifrado",
                   substituida_em AS "substituida"
              FROM negocio.identidade_no_provedor
             ORDER BY criado_em
          `,
      );

      expect(linhas).toHaveLength(2);
      // A anterior: carimbada E sem segredo — as duas coisas, que é o que a `CHECK` amarra.
      expect(linhas[0]?.substituida).not.toBeNull();
      expect(linhas[0]?.cifrado).toBeNull();
      // A nova: vigente e com o segredo.
      expect(linhas[1]?.substituida).toBeNull();
      expect(linhas[1]?.cifrado).toBe('envelope-novo');
      expect(linhas[1]?.id).toBe(nova.id);

      expect(await emUnidade(EMPRESA_A.id, obterEnvelopeCifradoDaIdentidade)).toBe('envelope-novo');
    },
    LIMITE_DO_CASO_MS,
  );

  it(
    'CT-864 — o isolamento é do banco: B não vê a identidade de A',
    async () => {
      await emUnidade(EMPRESA_A.id, async (tx) => {
        await registrarIdentidadeNoProvedor(tx, dadosDe('envelope-de-a', USUARIO_DE_A));
      });

      const [vigenteDeB, envelopeDeB] = await emUnidade(EMPRESA_B.id, async (tx) => [
        await lerIdentidadeVigente(tx),
        await obterEnvelopeCifradoDaIdentidade(tx),
      ]);

      expect(vigenteDeB).toBeUndefined();
      expect(envelopeDeB).toBeUndefined();

      // ANTIVÁCUO: A continua enxergando a sua — sem isto, uma política que recusasse TUDO
      // passaria nas duas asserções acima.
      expect(await emUnidade(EMPRESA_A.id, obterEnvelopeCifradoDaIdentidade)).toBe('envelope-de-a');
    },
    LIMITE_DO_CASO_MS,
  );

  it(
    'CT-865 — o registro de B não substitui a de A (a anulação é recortada pela política)',
    async () => {
      await emUnidade(EMPRESA_A.id, async (tx) => {
        await registrarIdentidadeNoProvedor(tx, dadosDe('envelope-de-a', USUARIO_DE_A));
      });
      await emUnidade(EMPRESA_B.id, async (tx) => {
        await registrarIdentidadeNoProvedor(tx, dadosDe('envelope-de-b', USUARIO_DE_B));
      });

      expect(await emUnidade(EMPRESA_A.id, obterEnvelopeCifradoDaIdentidade)).toBe('envelope-de-a');
      expect(await emUnidade(EMPRESA_B.id, obterEnvelopeCifradoDaIdentidade)).toBe('envelope-de-b');
    },
    LIMITE_DO_CASO_MS,
  );
});
