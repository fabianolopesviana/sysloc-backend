/**
 * Trilha de tentativas de entrada (RN-11) — uma linha por tentativa, **nos dois caminhos**.
 *
 * ---------------------------------------------------------------------------
 * O que a trilha registra, e por que o autor é anulável
 * ---------------------------------------------------------------------------
 *
 * Sucesso, credencial incorreta, recusa por bloqueio, e-mail inexistente e recusa de acesso: todos
 * geram linha. A tentativa com e-mail inexistente também — e é o motivo de `usuario_id` ser
 * anulável no schema. Nesse caso o único dado de autoria disponível é o que foi digitado, que fica
 * em `email_informado`.
 *
 * ---------------------------------------------------------------------------
 * Falha ao registrar NÃO é silenciada
 * ---------------------------------------------------------------------------
 *
 * Nada aqui captura exceção do banco. A RN-11 diz "toda tentativa é registrada", e uma trilha que
 * perde linhas quando o banco reclama é pior do que nenhuma — ela dá a garantia sem cumpri-la, e o
 * buraco só aparece na auditoria que dependia dela. Se a escrita falhar, a tentativa falha junto,
 * ruidosamente. É a postura fail-closed que o resto desta fatia adota.
 *
 * ---------------------------------------------------------------------------
 * Nenhum segredo entra aqui
 * ---------------------------------------------------------------------------
 *
 * Os campos são fechados pelo tipo abaixo: e-mail informado, autor, desfecho, origem e agente.
 * Senha, token de sessão e código de segundo fator **não têm lugar** na estrutura — não é uma regra
 * a lembrar na hora de chamar, é a assinatura que não os aceita (RN-12).
 */

import { type BancoDeIdentidade, esquemaIdentidade } from '@sysloc/db';

/**
 * Desfecho de uma tentativa, derivado do tipo enumerado do banco.
 *
 * Derivado, e não redigitado, pelo mesmo motivo de `perfis.ts`: um valor novo no schema quebra a
 * compilação de quem trata os casos, em vez de produzir um desfecho que ninguém previu.
 */
export type DesfechoDeTentativa = (typeof esquemaIdentidade.desfechoTentativa.enumValues)[number];

/** Uma tentativa de entrada, como ela vai para a trilha. */
export interface TentativaDeEntrada {
  /** O que foi digitado, já normalizado para minúsculas. É o único dado de autoria quando não há pessoa. */
  readonly emailInformado: string;
  /** A pessoa, quando identificável. **Nulo** quando o e-mail informado não existe. */
  readonly usuarioId: string | null;
  readonly desfecho: DesfechoDeTentativa;
  /** Endereço de rede do cliente, como o arcabouço o apurou. Nulo quando não é apurável. */
  readonly origem: string | null;
  readonly agente: string | null;
}

/**
 * Grava a tentativa.
 *
 * `ocorrida_em` não é parâmetro: ele vem do `DEFAULT now()` da coluna, isto é, do relógio do banco.
 * Deixar o instante ser escolhido por quem chama abriria o caminho para uma trilha com momentos que
 * não correspondem à ordem em que os fatos aconteceram — e é a ordem que uma auditoria lê.
 */
export async function registrarTentativa(
  banco: BancoDeIdentidade,
  tentativa: TentativaDeEntrada,
): Promise<void> {
  await banco.insert(esquemaIdentidade.tentativaLogin).values({
    emailInformado: tentativa.emailInformado,
    usuarioId: tentativa.usuarioId,
    desfecho: tentativa.desfecho,
    origem: tentativa.origem,
    agente: tentativa.agente,
  });
}
