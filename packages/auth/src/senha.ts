/**
 * Política de força de senha (RN-05) — regras próprias, e **sem rede**.
 *
 * ---------------------------------------------------------------------------
 * Por que é código nosso
 * ---------------------------------------------------------------------------
 *
 * O arcabouço de identidade oferece **apenas comprimento mínimo** (`minPasswordLength`, padrão 8).
 * Não há verificação de força — a lacuna foi medida no pacote publicado, não suposta (§7 da T6). As
 * quatro regras abaixo cobrem o que a RN-05 exige.
 *
 * A ausência de rede é decisão registrada (§8 da tech spec): consultar um serviço de senhas vazadas
 * colocaria terceiro no caminho da entrada e da troca obrigatória de senha — dois fluxos que
 * precisam funcionar quando a internet não funciona.
 *
 * ---------------------------------------------------------------------------
 * Por que o motivo é NOMEADO, e por que ele não carrega a senha
 * ---------------------------------------------------------------------------
 *
 * Cada regra devolve um rótulo próprio, e não "senha inválida". Duas razões:
 *
 * 1. Quem teve a senha recusada precisa saber **qual** regra violou — recusa genérica transforma a
 *    troca de senha em adivinhação.
 * 2. O controlador preenche `detalhes` do envelope da ADR-0007 com o motivo (§6.1 da tech spec), e
 *    `detalhes` precisa de valor discriminável, não de texto livre.
 *
 * O rótulo é **constante fechada**, e nunca inclui a senha informada nem trecho dela. É a rede
 * local da RN-12: o motivo viaja para a resposta e para o registro estruturado, e um motivo que
 * citasse a senha a levaria para os dois.
 */

/** Comprimento mínimo. A fronteira é `>= 10` — dez caracteres exatos passam. */
export const COMPRIMENTO_MINIMO_DE_SENHA = 10;

/** A partir de quantos caracteres uma cadeia consecutiva (`abcd`, `4321`) reprova. */
export const COMPRIMENTO_DE_SEQUENCIA_PROIBIDA = 4;

/** A partir de quantos caracteres iguais em fila (`1111`) a senha reprova. */
export const COMPRIMENTO_DE_REPETICAO_PROIBIDA = 4;

/**
 * Menor pedaço de dado pessoal que a senha não pode conter.
 *
 * Abaixo de três, a regra recusaria senha boa por acaso: quase toda pessoa tem uma partícula de
 * duas letras no nome, e barrar duas letras é barrar quase tudo.
 */
const TAMANHO_MINIMO_DE_DADO_PESSOAL = 3;

/** Motivo nomeado de recusa. Enum fechado — o CT-014 afirma o rótulo exato por variante. */
export type MotivoDeRecusaDeSenha =
  | 'COMPRIMENTO_MINIMO'
  | 'CONTEM_DADO_PESSOAL'
  | 'SEQUENCIA_CONSECUTIVA'
  | 'REPETICAO';

/** O que a política sabe da pessoa. Só o necessário para a regra de dado pessoal. */
export interface PessoaDaSenha {
  readonly nome: string;
  readonly email: string;
}

/** Veredito da política. `motivos` é vazio se, e somente se, `aprovada` é verdadeiro. */
export interface AvaliacaoDeSenha {
  readonly aprovada: boolean;
  readonly motivos: readonly MotivoDeRecusaDeSenha[];
}

/**
 * Avalia a senha contra as quatro regras e devolve **todos** os motivos violados.
 *
 * Todas as regras são avaliadas, e não apenas a primeira que falha: quem trocou uma senha fraca por
 * outra igualmente fraca em outro eixo teria de descobrir os problemas um por vez, com uma ida ao
 * servidor por eixo. A ordem dos motivos é a das constantes acima — fixa, para que a asserção do
 * caso não dependa de ordem de avaliação.
 */
export function avaliarForcaDeSenha(senha: string, pessoa: PessoaDaSenha): AvaliacaoDeSenha {
  const motivos: MotivoDeRecusaDeSenha[] = [];
  const comparavel = normalizar(senha);

  if (senha.length < COMPRIMENTO_MINIMO_DE_SENHA) {
    motivos.push('COMPRIMENTO_MINIMO');
  }

  if (contemDadoPessoal(comparavel, pessoa)) {
    motivos.push('CONTEM_DADO_PESSOAL');
  }

  if (temSequenciaConsecutiva(comparavel)) {
    motivos.push('SEQUENCIA_CONSECUTIVA');
  }

  if (temRepeticao(comparavel)) {
    motivos.push('REPETICAO');
  }

  return { aprovada: motivos.length === 0, motivos };
}

/**
 * Minúsculas e sem acento.
 *
 * Sem a remoção de acento, `Joao` passaria a política de quem se chama `João` — e o objetivo da
 * regra é impedir a senha adivinhável a partir do cadastro, não a igualdade de bytes.
 */
function normalizar(valor: string): string {
  return valor
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
}

/**
 * A senha contém o nome da pessoa, um pedaço dele, ou a parte local do e-mail.
 *
 * A parte local entra inteira **e** em pedaços: `admin.a@…` produz `admin.a` e `admin`, porque
 * `Xadmin#9tuk` é tão adivinhável quanto `Xadmin.a#9`.
 */
function contemDadoPessoal(senha: string, pessoa: PessoaDaSenha): boolean {
  const parteLocal = normalizar(pessoa.email).split('@')[0] ?? '';

  const pedacos = [
    ...normalizar(pessoa.nome).split(/[^\p{Letter}\p{Number}]+/u),
    parteLocal,
    ...parteLocal.split(/[^\p{Letter}\p{Number}]+/u),
  ].filter((pedaco) => pedaco.length >= TAMANHO_MINIMO_DE_DADO_PESSOAL);

  return pedacos.some((pedaco) => senha.includes(pedaco));
}

/**
 * Existe uma corrida de caracteres consecutivos no código, crescente ou decrescente.
 *
 * Os dois sentidos, porque `dcba` é tão previsível quanto `abcd`. Passo zero **não** conta: quatro
 * iguais são `REPETICAO`, e misturar os dois eixos apagaria a distinção que o CT-014 afirma.
 */
function temSequenciaConsecutiva(senha: string): boolean {
  return temCorrida(
    senha,
    COMPRIMENTO_DE_SEQUENCIA_PROIBIDA,
    (anterior, atual) => atual - anterior === 1 || atual - anterior === -1,
  );
}

/** Existe uma corrida de caracteres iguais. */
function temRepeticao(senha: string): boolean {
  return temCorrida(
    senha,
    COMPRIMENTO_DE_REPETICAO_PROIBIDA,
    (anterior, atual) => atual === anterior,
  );
}

/**
 * Corrida: a maior fila de posições vizinhas em que `continua` vale para o par.
 *
 * O comprimento de corte é **parâmetro**, e não o máximo das duas constantes: hoje a RN-05 fixa 4
 * nas duas regras, e derivar o corte de um `Math.max` faria a regra mais permissiva passar a valer
 * pela mais restritiva no dia em que elas divergissem — um acoplamento silencioso entre eixos que
 * o CT-014 exige distinguíveis.
 */
function temCorrida(
  senha: string,
  limite: number,
  continua: (anterior: number, atual: number) => boolean,
): boolean {
  if (senha.length < limite) {
    return false;
  }

  let corrida = 1;

  for (let posicao = 1; posicao < senha.length; posicao += 1) {
    const anterior = senha.charCodeAt(posicao - 1);
    const atual = senha.charCodeAt(posicao);

    corrida = continua(anterior, atual) ? corrida + 1 : 1;

    if (corrida >= limite) {
      return true;
    }
  }

  return false;
}
