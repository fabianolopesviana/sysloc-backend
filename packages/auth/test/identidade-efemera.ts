/**
 * Instância efêmera **com identidade montada** — banco migrado, carga com credencial e o arcabouço
 * configurado exatamente como a operação o configura.
 *
 * ---------------------------------------------------------------------------
 * Ela ENVOLVE `packages/db/test/banco-efemero.ts` — não o altera
 * ---------------------------------------------------------------------------
 *
 * Mesma composição que aquele helper faz sobre `packages/shared/test/postgres-efemero.ts`: tudo o
 * que este acrescenta (a credencial da carga e a instância do arcabouço) nasce do banco que aquele
 * subiu, e nada aqui olha para configuração de ambiente (ADR-0006).
 *
 * ---------------------------------------------------------------------------
 * A credencial nasce pelo caminho real
 * ---------------------------------------------------------------------------
 *
 * A carga recebe a **função de derivação do próprio arcabouço** e reexecuta `semear` — que é
 * idempotente, e por isso não duplica nada do que `bancoEfemero()` já gravou. Nenhuma derivação é
 * escrita à mão: uma cadeia forjada em `identidade.conta` provaria um caminho que não existe, e a
 * entrada com a senha certa passaria a depender de a forja coincidir com o formato que o arcabouço
 * confere.
 *
 * ---------------------------------------------------------------------------
 * O segredo de sessão é sorteado por instância
 * ---------------------------------------------------------------------------
 *
 * Mesmo contrato das senhas de papel em `banco-efemero.ts`: vive apenas na memória deste processo e
 * morre com ele. Nada é lido de configuração, nada é versionado.
 */

import { randomBytes } from 'node:crypto';
import {
  type AcessoAIdentidade,
  abrirAcessoAIdentidade,
  semear,
  USUARIOS,
  type UsuarioSemeado,
} from '@sysloc/db';
import { hashPassword } from 'better-auth/crypto';
import { type BancoMigrado, bancoEfemero } from '../../db/test/banco-efemero.ts';
import { type Autenticacao, criarAutenticacao } from '../src/autenticacao.ts';

/** Endereço base do arcabouço nos casos. Nada escuta nele — os casos chamam a instância direto. */
const ENDERECO_BASE = 'http://127.0.0.1:0';

/** O mesmo prefixo que a §4.1 da tech spec fixa para as rotas do arcabouço. */
const PREFIXO_DAS_ROTAS = '/v1/auth';

/**
 * As origens públicas dos casos deste pacote — inertes, e declaradas porque a fábrica as **exige**.
 *
 * `criarAutenticacao` passou a receber a lista de origens públicas na T7 da fatia
 * `publicacao-e-backup` (fecho do `D23 · F1/T8`), e ela não tem valor padrão de propósito: um padrão
 * seria a adivinhação que aquele débito recusou. O domínio é `.invalid`, reservado pela RFC 2606 para
 * nunca existir — nenhum caso deste pacote fala por estas origens, e o que eles exercitam é o
 * endereço de escuta, que o arcabouço empilha por conta própria a partir de `baseURL`.
 *
 * ⚠️ **Quem prova que a lista é conferida na partida e que a origem estranha é recusada é
 * `apps/api`** (`test/ambiente.spec.ts` e `test/origem-publica.e2e.spec.ts`): é lá que ela nasce, do
 * ambiente do processo. Aqui ela é apenas arranjo.
 */
const ORIGENS_PUBLICAS = ['https://app.exemplo.invalid', 'https://painel.exemplo.invalid'] as const;

/** Instância efêmera com identidade pronta para exercitar a entrada. */
export interface IdentidadeEfemera {
  /** A instância do arcabouço, montada sobre o acesso restrito a `identidade`. */
  readonly autenticacao: Autenticacao;
  /** O acesso restrito, para observar o estado persistido — o mesmo que a instância recebeu. */
  readonly acesso: AcessoAIdentidade;
  /** O banco por baixo, quando o caso precisa de porta ou nome. */
  readonly banco: BancoMigrado;
  /** Encerra o acesso e a instância, nesta ordem. Idempotente pelo lado do banco. */
  parar(): Promise<void>;
}

/**
 * Sobe o banco migrado, define as credenciais da carga e monta o arcabouço sobre ele.
 */
export async function identidadeEfemera(): Promise<IdentidadeEfemera> {
  const banco = await bancoEfemero();

  try {
    // `hashPassword` é a MESMA função que o arcabouço usa por padrão para derivar e conferir senha
    // (§11.3: `scrypt`). Passá-la aqui é o que faz a credencial semeada nascer do caminho de
    // produção — se o formato mudar numa versão futura, a entrada continua funcionando, porque as
    // duas pontas mudam juntas.
    await semear(banco.cadeiaConexao, { derivarSenha: hashPassword });

    const acesso = abrirAcessoAIdentidade({ cadeiaDeConexao: banco.cadeiaConexao });

    return {
      autenticacao: criarAutenticacao({
        acesso,
        segredoDeSessao: randomBytes(32).toString('base64url'),
        enderecoBase: ENDERECO_BASE,
        origensPublicas: ORIGENS_PUBLICAS,
        prefixoDasRotas: PREFIXO_DAS_ROTAS,
      }),
      acesso,
      banco,
      parar: async () => {
        await acesso.encerrar();
        await banco.parar();
      },
    };
  } catch (erro) {
    // O banco já está de pé neste ponto; sem esta parada ele sobreviveria ao erro, e o diretório de
    // dados e o processo ficariam para trás — o resíduo que a F0 proíbe.
    await banco.parar();
    throw erro;
  }
}

/**
 * A pessoa semeada com o e-mail informado.
 *
 * Busca por e-mail em vez de índice na lista: índice quebra em silêncio quando a carga ganha uma
 * pessoa no meio, e o caso passaria a exercitar outra conta sem que nada acusasse.
 */
export function pessoaSemeada(email: string): UsuarioSemeado {
  const pessoa = USUARIOS.find((candidata) => candidata.email === email);

  if (pessoa === undefined) {
    throw new Error(`a carga inicial não tem pessoa com o e-mail ${email}`);
  }

  return pessoa;
}
