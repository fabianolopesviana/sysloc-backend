/**
 * Cliente de banco do pacote — INTERNO, e é isso que o torna útil.
 *
 * ---------------------------------------------------------------------------
 * Por que este módulo não aparece em `index.ts`
 * ---------------------------------------------------------------------------
 *
 * A §3.3 da tech spec faz da fronteira do pacote um invariante de COMPILAÇÃO, não uma convenção:
 * `@sysloc/db` não exporta cliente, reserva de conexões nem executor com alcance ao schema
 * `negocio`. A razão é a ADR-0008 — se qualquer módulo de fora puder abrir uma conexão e consultar
 * `negocio` diretamente, passa a existir um segundo caminho para o dado, que é exatamente o que a
 * decisão de isolamento existe para impedir. Fora deste pacote, alcançar dado de negócio sem
 * contexto de tenant **não é escrevível**.
 *
 * Quem consome dado de negócio usa a unidade de trabalho (T3), que abre a transação, fixa o
 * contexto e só então executa. Este arquivo é o que ela usa por dentro.
 *
 * ---------------------------------------------------------------------------
 * ADR-0006 — nenhuma coordenada de conexão é lida do ambiente aqui
 * ---------------------------------------------------------------------------
 *
 * A cadeia de conexão chega por parâmetro, sempre. Quem a lê do ambiente é a validação de partida
 * do processo (`apps/api/src/configuracao/ambiente.ts`), que falha na partida nomeando a variável
 * ausente. Um valor padrão lido daqui faria a verificação alcançar, em silêncio, o banco que atende
 * a operação — o modo de falha que a ADR-0006 nomeia.
 */

import postgres, { type Sql } from 'postgres';

/** Ajustes de operação da reserva de conexões. Tudo aqui é opcional e tem padrão da biblioteca. */
export interface OpcoesDeConexao {
  /**
   * Quantas conexões físicas a reserva mantém. Omitido, vale o padrão do `postgres.js`.
   *
   * É opção de operação, não de verificação: o processo que atende requisição dimensiona a reserva
   * pelo tamanho do banco, e quem precisa observar o comportamento de uma conexão reaproveitada a
   * reduz a uma. As duas usam o mesmo parâmetro — não há bandeira de teste aqui.
   */
  readonly maximoDeConexoes?: number;
}

/**
 * Abre uma reserva de conexões para a cadeia informada.
 *
 * Quem chama é dono do recurso e precisa encerrá-lo com `sql.end()` — inclusive no caminho de
 * falha. Uma reserva não encerrada mantém o processo vivo depois do trabalho terminar.
 */
export function abrirConexao(cadeiaDeConexao: string, opcoes: OpcoesDeConexao = {}): Sql {
  return postgres(cadeiaDeConexao, {
    // A conexão é sempre local (o processo escuta apenas no endereço de retorno, §11.3), então o
    // prazo padrão de 30 s da biblioteca só seria alcançado em cenário de banco fora do ar — em
    // que esperar meio minuto por conexão atrasa o diagnóstico sem nada ganhar em troca.
    connect_timeout: 10,
    // Espalhar a opção só quando ela foi informada preserva o padrão da biblioteca — passar
    // `max: undefined` explicitamente não é equivalente a não passar `max`.
    ...(opcoes.maximoDeConexoes === undefined ? {} : { max: opcoes.maximoDeConexoes }),
  });
}

export type { Sql };
