/**
 * Contrato de credencial da carga inicial — o par que sustenta o fechamento do D4.
 *
 * ===========================================================================
 * INVARIANTES
 * ===========================================================================
 *
 * | Critério | Caso     | Invariante |
 * |----------|----------|------------|
 * | T6 §5.2  | T6 §5.2  | `semear(cadeia)` **sem** a função de derivação não escreve linha alguma
 * | (D4)     |          | em `identidade.conta`; com ela, escreve **exatamente uma por pessoa** da
 * |          |          | carga, com a derivação produzida pela função injetada a partir de
 * |          |          | `SENHA_DA_CARGA` — e por nenhum outro caminho. |
 *
 * Rastreabilidade: `T6 §5.2 → T6 §5.2 (D4)`. Não há CA nem `CT-NNN` para este invariante: ele é o
 * contrato que a §5.2 da T6 declara ao fechar o D4, e a numeração `CT-001`..`CT-032` da tech spec
 * está inteiramente atribuída — inventar `CT-033` colidiria com a próxima atribuição dela.
 *
 * ===========================================================================
 * Por que este arquivo existe
 * ===========================================================================
 *
 * O cabeçalho de `src/semente.ts` eleva a frase a **contrato**: "`semear(cadeia)` sem a função
 * continua não escrevendo credencial alguma. Isso é contrato, não detalhe". É sobre ela que se
 * apoia manter `semear` exportada — que aceita destino arbitrário e não tem guarda de destino — e
 * `SENHA_DA_CARGA` na superfície pública sem que o par constitua segredo utilizável.
 *
 * O risco que o D4 nomeia é concreto: um `semear()` disparado contra o banco que atende a operação
 * materializaria um `SYSLOC_MASTER` de identificador conhecido. O que o desarma é **só** o fato de
 * que nenhuma credencial nasce sem injeção — e, até este arquivo, esse fato não tinha prova: o
 * pacote dono de `semear` não observava `identidade.conta` em caso nenhum, e uma derivação forjada
 * no caminho sem injeção deixava a suíte inteira verde.
 *
 * ===========================================================================
 * Por que o PAR, e não só o eixo negativo
 * ===========================================================================
 *
 * "Zero linhas em `identidade.conta`" passaria, sozinho, sobre uma semeadura que nunca escreve
 * credencial nenhuma — inclusive uma em que a injeção deixou de funcionar. O eixo positivo é o que
 * torna o negativo informativo: os dois lados exercitam a MESMA função, na MESMA instância, e a
 * única diferença entre eles é a presença da função de derivação.
 *
 * ===========================================================================
 * A derivação injetada é um dublê, e é deliberado
 * ===========================================================================
 *
 * Este pacote não pode importar `@sysloc/auth` — é ele que depende deste, e o ciclo é justamente o
 * que motivou a injeção. O que o caso prova aqui é o **contrato de injeção** (quem escreve, com
 * qual entrada, quantas vezes), não o formato da derivação; que a derivação real do arcabouço
 * produz credencial utilizável é o que o CT-015 prova, entrando com a senha da carga.
 *
 * Pelo padrão de `.claude/rules/testing-stack.md`, o dublê não é observado por "foi chamado": o
 * caso afirma o argumento exato e o número de chamadas.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { type AcessoAIdentidade, abrirAcessoAIdentidade } from '../src/acesso-identidade.ts';
import { conta } from '../src/esquema/identidade.ts';
import { PROVEDOR_DE_CREDENCIAL, SENHA_DA_CARGA, semear, USUARIOS } from '../src/semente.ts';
import { type BancoMigrado, bancoEfemero } from './banco-efemero.ts';

/** Subir a instância, provisionar papéis, migrar e semear leva dezenas de segundos nesta máquina. */
const LIMITE_SUBIDA_MS = 90_000;

/** O caso semeia duas vezes contra banco real; o teto é folgado sobre o observado. */
const LIMITE_DO_CASO_MS = 60_000;

/**
 * Marca que identifica a saída da derivação injetada.
 *
 * Ela existe para que a asserção afirme **de onde veio** o valor gravado, e não apenas que a coluna
 * está preenchida: uma derivação embutida em `semente.ts` — a forma concreta do risco do D4 —
 * preencheria a coluna com outra coisa, e a igualdade abaixo reprovaria.
 */
const MARCA_DA_DERIVACAO = 'derivada-pelo-chamador:';

let banco: BancoMigrado;
let acesso: AcessoAIdentidade;

beforeAll(async () => {
  banco = await bancoEfemero();
  acesso = abrirAcessoAIdentidade({ cadeiaDeConexao: banco.cadeiaConexao });
}, LIMITE_SUBIDA_MS);

afterAll(async () => {
  await acesso?.encerrar();
  await banco?.parar();
});

describe('T6 §5.2 — a carga só cria credencial quando o chamador injeta a derivação', () => {
  it(
    'sem a função não nasce credencial alguma; com ela nasce exatamente uma por pessoa',
    async () => {
      const senhasDerivadas: string[] = [];
      const derivarSenha = async (senha: string): Promise<string> => {
        senhasDerivadas.push(senha);
        return `${MARCA_DA_DERIVACAO}${senha}`;
      };

      // --- Eixo negativo: o caminho que a operação usa ---------------------------------------
      // `bancoEfemero()` já semeou duas vezes sem opções; esta terceira torna o eixo explícito no
      // corpo do caso, em vez de depender do que o auxiliar faz por dentro.
      await semear(banco.cadeiaConexao);

      expect(await lerContas()).toEqual([]);
      // A derivação sequer foi consultada — não há caminho em que a carga a invente por conta.
      expect(senhasDerivadas).toEqual([]);

      // --- Eixo positivo: o mesmo `semear`, agora com a injeção ------------------------------
      await semear(banco.cadeiaConexao, { derivarSenha });

      // Igualdade do conjunto inteiro, e não contagem: contar seis linhas passaria sobre uma carga
      // que gravasse seis credenciais para a mesma pessoa, ou que trocasse o provedor.
      expect(await lerContas()).toEqual(
        USUARIOS.map((pessoa) => ({
          id: pessoa.contaId,
          usuarioId: pessoa.id,
          contaId: pessoa.id,
          provedorId: PROVEDOR_DE_CREDENCIAL,
          senhaDerivada: `${MARCA_DA_DERIVACAO}${SENHA_DA_CARGA}`,
        })).toSorted((uma, outra) => uma.id.localeCompare(outra.id)),
      );

      // Uma chamada só, e com a senha da carga: derivar por pessoa custaria seis vezes o preço de
      // uma função deliberadamente cara, e derivar outra cadeia produziria conta que não entra.
      expect(senhasDerivadas).toEqual([SENHA_DA_CARGA]);
    },
    LIMITE_DO_CASO_MS,
  );
});

/** Toda linha de `identidade.conta`, na ordem do identificador. */
async function lerContas(): Promise<
  {
    id: string;
    usuarioId: string;
    contaId: string;
    provedorId: string;
    senhaDerivada: string | null;
  }[]
> {
  const linhas = await acesso.identidade
    .select({
      id: conta.id,
      usuarioId: conta.usuarioId,
      contaId: conta.contaId,
      provedorId: conta.provedorId,
      senhaDerivada: conta.senhaDerivada,
    })
    .from(conta);

  return linhas.toSorted((uma, outra) => uma.id.localeCompare(outra.id));
}
