/**
 * Ajuste individual de permissão — a estrutura que a migração `0003` tornou escrevível.
 *
 * ===========================================================================
 * INVARIANTES
 * ===========================================================================
 *
 * | Critério | Caso   | Invariante |
 * |----------|--------|------------|
 * | CA-09    | CT-206 | A restrição de unicidade `(acesso_id, tipo, chave)` recusa, NO BANCO, a
 * | CA-10    |        | segunda linha para o mesmo trio — de modo que concessão e negação da mesma
 * |          |        | chave para o mesmo vínculo não coexistem, e a precedência da negação nunca
 * |          |        | precisa arbitrar dado inconsistente. As TRÊS colunas participam da chave:
 * |          |        | trocar qualquer uma delas produz uma linha nova, aceita. |
 * | CA-09    | CT-206 | `efeito` é NOT NULL e SEM PADRÃO: uma inserção que omita o efeito é
 * | CA-10    |        | recusada pelo banco, em vez de assumir concessão ou negação por omissão. |
 *
 * Rastreabilidade: `CA-09 → CT-206 (RN-14)` e `CA-10 → CT-206 (RN-15)`.
 *
 * ===========================================================================
 * Por que o conflito ser IRREPRESENTÁVEL é diferente de ser tratado
 * ===========================================================================
 *
 * A regra de efetivo aplica precedência da negação: havendo `CONCEDIDA` e `NEGADA` para a mesma
 * chave, vence a negação. Uma regra que precisa desempatar é uma regra que pode desempatar errado —
 * e, pior, que só é exercitada quando o dado inconsistente existe, isto é, quase nunca.
 *
 * A unicidade tira o caso de cima da regra: o par contraditório **não chega a existir**. É por isso
 * que este caso mora na camada de dados e não na de domínio — o que se prova aqui é que o banco
 * recusa, não que alguém se lembrou de conferir antes de gravar.
 *
 * ===========================================================================
 * Precondição privilegiada
 * ===========================================================================
 *
 * `negocio.acesso_usuario_permissao` nasce sob RLS **forçada**: escrever nela exige contexto de
 * tenant fixado. O contexto vem exclusivamente da API pública do pacote — `contextoDeTenant.
 * executarCom` mais `abrirAcessoAoBanco` —, que é o mesmo caminho da operação. Nenhuma conexão
 * privilegiada é aberta neste arquivo, e nenhum símbolo foi acrescentado a `packages/db/src/**`
 * para que a prova exista (ADR-0006, ADR-0008).
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import * as contextoDeTenant from '../src/contexto.ts';
import { ACESSOS_DA_EMPRESA_A, EMPRESA_A } from '../src/semente.ts';
import { type AcessoAoBanco, abrirAcessoAoBanco } from '../src/unidade-de-trabalho.ts';
import { type BancoMigrado, bancoEfemero } from './banco-efemero.ts';

// ---------------------------------------------------------------------------
// Limites de tempo — constantes nomeadas, nunca número mágico no meio do caso
// ---------------------------------------------------------------------------

/** Subir a instância, provisionar papéis, migrar e semear leva dezenas de segundos nesta máquina. */
const LIMITE_SUBIDA_MS = 90_000;

/** O caso escreve meia dúzia de linhas; o teto é folgado sobre o observado. */
const LIMITE_DO_CASO_MS = 60_000;

/** Reserva de UMA conexão: as unidades de trabalho do caso correm sobre a mesma conexão física. */
const RESERVA_DE_UMA = 1;

// ---------------------------------------------------------------------------
// O cenário
// ---------------------------------------------------------------------------

/** O vínculo sobre o qual o trio é disputado. */
const VINCULO_A = ACESSOS_DA_EMPRESA_A[0]?.id ?? '';

/** Outro vínculo da MESMA empresa — o controle que mostra que a chave não é global. */
const VINCULO_B = ACESSOS_DA_EMPRESA_A[1]?.id ?? '';

const CONTEXTO_DE_A = { empresaId: EMPRESA_A.id } as const;

/** A restrição que o banco deve nomear ao recusar. Literal, e não derivada do erro. */
const RESTRICAO_DO_TRIO = 'acesso_usuario_permissao_acesso_tipo_chave_key';

/** A chave em disputa, e uma segunda para provar que `chave` participa da restrição. */
const CHAVE_DISPUTADA = 'emitir_boleto';
const OUTRA_CHAVE = 'cancelar_contrato';

/** Identificadores das linhas que o caso grava — literais, para que a limpeza seja por chave. */
const LINHA_CONCEDIDA = 'eeeeeeee-0000-4000-8000-000000000001';
const LINHA_NEGADA = 'eeeeeeee-0000-4000-8000-000000000002';
const LINHA_DE_CONTROLE = 'eeeeeeee-0000-4000-8000-000000000003';
const LINHA_DE_OUTRO_TIPO = 'eeeeeeee-0000-4000-8000-000000000004';
const LINHA_DE_OUTRA_CHAVE = 'eeeeeeee-0000-4000-8000-000000000005';
const LINHA_SEM_EFEITO = 'eeeeeeee-0000-4000-8000-000000000006';

const LINHAS_DO_CASO = [
  LINHA_CONCEDIDA,
  LINHA_NEGADA,
  LINHA_DE_CONTROLE,
  LINHA_DE_OUTRO_TIPO,
  LINHA_DE_OUTRA_CHAVE,
  LINHA_SEM_EFEITO,
] as const;

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------

type Resultado<T> =
  | { readonly ok: true; readonly valor: T }
  | { readonly ok: false; readonly erro: unknown };

async function tentar<T>(acao: () => Promise<T>): Promise<Resultado<T>> {
  try {
    return { ok: true, valor: await acao() };
  } catch (erro) {
    return { ok: false, erro };
  }
}

/** O SQLSTATE que o servidor devolveu, ou `undefined` quando o erro não veio dele. */
function sqlstate(erro: unknown): string | undefined {
  const codigo = (erro as { code?: unknown } | null)?.code;
  return typeof codigo === 'string' ? codigo : undefined;
}

/**
 * O nome da restrição apontada pelo servidor. O campo se chama `constraint_name` porque é assim que
 * o driver nomeia o campo `n` da resposta de erro do PostgreSQL.
 *
 * Afirmar o NOME, e não apenas o SQLSTATE, é o que distingue "alguma unicidade recusou" de "a
 * unicidade do trio recusou": a tabela tem outra restrição única — `(id, empresa_id)` — que também
 * produziria `23505`.
 */
function nomeDaRestricao(erro: unknown): string | undefined {
  const nome = (erro as { constraint_name?: unknown } | null)?.constraint_name;
  return typeof nome === 'string' ? nome : undefined;
}

interface Gravacao {
  readonly codigo: string | undefined;
  readonly restricao: string | undefined;
  readonly linhas: number | undefined;
}

/** Grava um ajuste sob o contexto da empresa A — o caminho real, sob RLS forçada. */
async function gravarAjuste(
  acesso: AcessoAoBanco,
  linha: {
    readonly id: string;
    readonly acessoId: string;
    readonly tipo: 'TELA' | 'ACAO';
    readonly chave: string;
    readonly efeito: 'CONCEDIDA' | 'NEGADA';
  },
): Promise<Gravacao> {
  const tentativa = await tentar(() =>
    contextoDeTenant.executarCom(CONTEXTO_DE_A, async () =>
      acesso.emUnidadeDeTrabalho(async (tx) => {
        const resultado = await tx`
          INSERT INTO negocio.acesso_usuario_permissao
                      (id, empresa_id, acesso_id, tipo, chave, efeito)
          VALUES (${linha.id}, ${EMPRESA_A.id}, ${linha.acessoId},
                  ${linha.tipo}::negocio.tipo_permissao, ${linha.chave},
                  ${linha.efeito}::negocio.efeito_permissao)
        `;
        return resultado.count;
      }),
    ),
  );

  return tentativa.ok
    ? { codigo: undefined, restricao: undefined, linhas: tentativa.valor }
    : {
        codigo: sqlstate(tentativa.erro),
        restricao: nomeDaRestricao(tentativa.erro),
        linhas: undefined,
      };
}

/** Os ajustes de um vínculo, na ordem da chave — `(chave, tipo, efeito)` por linha. */
async function lerAjustesDe(
  acesso: AcessoAoBanco,
  acessoId: string,
  // A ordenação é por `tipo::text`, e não por `tipo`: `ORDER BY` sobre coluna de enum segue a ordem
  // de DECLARAÇÃO do tipo (`TELA` antes de `ACAO`), não a alfabética. O texto torna a ordem
  // independente de como o enum foi declarado, que é o que permite escrever o esperado por extenso.
): Promise<{ chave: string; tipo: string; efeito: string }[]> {
  return contextoDeTenant.executarCom(CONTEXTO_DE_A, async () =>
    acesso.emUnidadeDeTrabalho(async (tx) => {
      const linhas = await tx<{ chave: string; tipo: string; efeito: string }[]>`
        SELECT chave, tipo, efeito FROM negocio.acesso_usuario_permissao
         WHERE acesso_id = ${acessoId}
         ORDER BY chave, tipo::text
      `;
      return linhas.map((linha) => ({ ...linha }));
    }),
  );
}

/** Remove só o que este arquivo gravou — pelo identificador, nunca por `empresa_id` (ADR-0008). */
async function limpar(acesso: AcessoAoBanco): Promise<void> {
  await contextoDeTenant.executarCom(CONTEXTO_DE_A, async () => {
    await acesso.emUnidadeDeTrabalho(async (tx) => {
      for (const id of LINHAS_DO_CASO) {
        await tx`DELETE FROM negocio.acesso_usuario_permissao WHERE id = ${id}`;
      }
    });
  });
}

// ---------------------------------------------------------------------------
// O caso
// ---------------------------------------------------------------------------

describe('CT-206 — conceder e negar a mesma chave para o mesmo vínculo é impossível pelo banco', () => {
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

  it(
    'CT-206 — a segunda linha do trio é recusada com 23505 na restrição nomeada, e o controle sucede',
    async () => {
      await limpar(acesso);

      try {
        // --- Passo 1: a concessão ---------------------------------------------------------
        const concedida = await gravarAjuste(acesso, {
          id: LINHA_CONCEDIDA,
          acessoId: VINCULO_A,
          tipo: 'ACAO',
          chave: CHAVE_DISPUTADA,
          efeito: 'CONCEDIDA',
        });
        expect(concedida.codigo).toBeUndefined();
        expect(concedida.linhas).toBe(1);

        // --- Passo 2 e 3: a negação do MESMO trio, com efeito oposto ----------------------
        // Este é o caso negativo do card (`ct_id: self`): `NEGADA` sobre uma `CONCEDIDA` que já
        // existe. O efeito oposto é o ponto — é a coexistência de efeitos contraditórios que a
        // restrição existe para impedir.
        const negada = await gravarAjuste(acesso, {
          id: LINHA_NEGADA,
          acessoId: VINCULO_A,
          tipo: 'ACAO',
          chave: CHAVE_DISPUTADA,
          efeito: 'NEGADA',
        });
        expect(negada.codigo).toBe('23505');
        expect(negada.restricao).toBe(RESTRICAO_DO_TRIO);

        // --- Passo 4: o controle, em OUTRO vínculo da mesma empresa -----------------------
        // Sem ele, a recusa acima passaria igual se a unicidade fosse global sobre `(tipo, chave)`
        // — o que trancaria a matriz inteira numa linha por chave para toda a empresa.
        const controle = await gravarAjuste(acesso, {
          id: LINHA_DE_CONTROLE,
          acessoId: VINCULO_B,
          tipo: 'ACAO',
          chave: CHAVE_DISPUTADA,
          efeito: 'NEGADA',
        });
        expect(controle.codigo).toBeUndefined();
        expect(controle.linhas).toBe(1);

        // --- As outras duas colunas do trio também participam ------------------------------
        // O controle acima só prova que `acesso_id` participa. Sem estes dois, uma unicidade sobre
        // `(acesso_id)` sozinho — que impediria QUALQUER segundo ajuste no mesmo vínculo — passaria
        // por todas as asserções anteriores.
        const outroTipo = await gravarAjuste(acesso, {
          id: LINHA_DE_OUTRO_TIPO,
          acessoId: VINCULO_A,
          tipo: 'TELA',
          chave: CHAVE_DISPUTADA,
          efeito: 'CONCEDIDA',
        });
        expect(outroTipo.codigo).toBeUndefined();
        expect(outroTipo.linhas).toBe(1);

        const outraChave = await gravarAjuste(acesso, {
          id: LINHA_DE_OUTRA_CHAVE,
          acessoId: VINCULO_A,
          tipo: 'ACAO',
          chave: OUTRA_CHAVE,
          efeito: 'NEGADA',
        });
        expect(outraChave.codigo).toBeUndefined();
        expect(outraChave.linhas).toBe(1);

        // --- Passo 5: o estado final, linha a linha ---------------------------------------
        // Igualdade do conjunto inteiro, e não contagem: é o que prova que a linha sobrevivente do
        // trio disputado continua sendo a `CONCEDIDA` original — a recusa não sobrescreveu nada.
        expect(await lerAjustesDe(acesso, VINCULO_A)).toEqual([
          { chave: OUTRA_CHAVE, tipo: 'ACAO', efeito: 'NEGADA' },
          { chave: CHAVE_DISPUTADA, tipo: 'ACAO', efeito: 'CONCEDIDA' },
          { chave: CHAVE_DISPUTADA, tipo: 'TELA', efeito: 'CONCEDIDA' },
        ]);
        expect(await lerAjustesDe(acesso, VINCULO_B)).toEqual([
          { chave: CHAVE_DISPUTADA, tipo: 'ACAO', efeito: 'NEGADA' },
        ]);
      } finally {
        await limpar(acesso);
      }
    },
    LIMITE_DO_CASO_MS,
  );

  it(
    'CT-206 (companheiro) — ajuste sem efeito declarado é recusado: a coluna não tem padrão',
    async () => {
      await limpar(acesso);

      try {
        const semEfeito = await tentar(() =>
          contextoDeTenant.executarCom(CONTEXTO_DE_A, async () =>
            acesso.emUnidadeDeTrabalho(async (tx) => {
              await tx`
                INSERT INTO negocio.acesso_usuario_permissao
                            (id, empresa_id, acesso_id, tipo, chave)
                VALUES (${LINHA_SEM_EFEITO}, ${EMPRESA_A.id}, ${VINCULO_A},
                        ${'ACAO'}::negocio.tipo_permissao, ${CHAVE_DISPUTADA})
              `;
            }),
          ),
        );

        // `23502` é `not_null_violation`. Um padrão na coluna faria esta inserção SUCEDER, gravando
        // silenciosamente um efeito que ninguém declarou — que é exatamente o que a ausência de
        // padrão existe para impedir.
        expect(semEfeito.ok).toBe(false);
        expect(semEfeito.ok ? undefined : sqlstate(semEfeito.erro)).toBe('23502');

        // E nada ficou para trás.
        expect(await lerAjustesDe(acesso, VINCULO_A)).toEqual([]);
      } finally {
        await limpar(acesso);
      }
    },
    LIMITE_DO_CASO_MS,
  );
});
