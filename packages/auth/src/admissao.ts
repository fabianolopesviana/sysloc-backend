/**
 * Barreira única de admissão de sessão (T7) — os cinco predicados nomeados, e a **entrada única**
 * por onde toda criação de sessão passa.
 *
 * ---------------------------------------------------------------------------
 * Por que UMA barreira, e não um gancho por regra
 * ---------------------------------------------------------------------------
 *
 * A alternativa idiomática — instalar cada regra no ponto de extensão que o arcabouço oferece para
 * ela — é **literalmente a topologia que produziu o vazamento de credencial de quatro rodadas**
 * registrado em `.claude/rules/nao-regressao.md` §7: propriedade instalada por ponto, defeito
 * reaparecendo por caminho novo a cada correção. A forma que fechou aquela classe foi a entrada
 * única de despacho (`packages/shared/src/log.ts`), e é ela que está aqui: uma função decide, e
 * quem emite sessão a consulta.
 *
 * ---------------------------------------------------------------------------
 * Os cinco predicados, na ordem em que são avaliados
 * ---------------------------------------------------------------------------
 *
 * 1. `contaBloqueada` — instante de liberação no futuro (RN-06);
 * 2. `pessoaDesativada` (RN-10);
 * 3. `empresaSuspensa` — só se aplica a quem pertence a empresa; o Master não pertence a nenhuma;
 * 4. `senhaProvisoriaPendente` — **não recusa**: marca a sessão como restrita (RN-09);
 * 5. `segundoFatorExigido` — o Master sem segundo fator ativo entra em sessão restrita (RN-08).
 *
 * Os três primeiros **recusam**, e a avaliação para no primeiro que recusa: uma pessoa desativada
 * numa empresa suspensa é recusada por `pessoaDesativada`, e `empresaSuspensa` sequer é consultada.
 * A ordem é propriedade observável — é o motivo de o desfecho carregar o motivo em vez de um
 * booleano —, e não detalhe de implementação: é ela que decide o desfecho gravado na trilha.
 *
 * Os dois últimos **não recusam**: eles marcam a sessão como restrita, e a restrição é o que a
 * guarda de contexto (T9/T10) usa para limitar o alcance da sessão até a exigência ser cumprida.
 *
 * Cada predicado é **função pura sobre o estado já carregado** — sem I/O, sem relógio próprio, sem
 * acesso ao pedido. É o que os torna testáveis um a um, sem subir HTTP e sem banco.
 *
 * ---------------------------------------------------------------------------
 * Indistinguibilidade (RN-10) — requisito de comportamento, não de estilo
 * ---------------------------------------------------------------------------
 *
 * As três recusas produzem resposta **idêntica** à de credencial incorreta: mesmo status, mesmo
 * código, mesma mensagem, mesmo conjunto de campos. Distinguir confirmaria ao atacante que a conta
 * existe — e é por isso que a recusa é uma constante literal, e não algo derivado do motivo: não há
 * como o motivo vazar para a resposta se ele nunca entra na construção dela. O motivo fica onde ele
 * serve, que é a trilha de auditoria.
 *
 * ---------------------------------------------------------------------------
 * O segundo fator ativo NÃO chega aqui — e isso não é lacuna
 * ---------------------------------------------------------------------------
 *
 * O quinto predicado só é verdadeiro para o Master **sem** segundo fator ativo. Com o segundo fator
 * ativo, o plugin do arcabouço interrompe a entrada para o desafio e **nenhuma sessão é criada** até
 * o código ser conferido — de modo que a barreira não é alcançada, e não há o que restringir. É a
 * distinção que o glossário da fatia registra: no desafio não existe sessão; a sessão restrita já é
 * uma sessão válida, de alcance reduzido.
 */

import { type BancoDeIdentidade, esquemaIdentidade } from '@sysloc/db';
import { eq, type SQL } from 'drizzle-orm';
import { estaBloqueada } from './bloqueio.js';
import type { Perfil } from './perfis.js';

/**
 * A recusa que o arcabouço emite para credencial incorreta, replicada literalmente.
 *
 * Replicada, e não importada: o mapa `BASE_ERROR_CODES` vive em `@better-auth/core`, que é
 * dependência transitiva e não faz parte da superfície pública do pacote que consumimos — importá-lo
 * seria depender de detalhe interno. O que importa é a **igualdade**: toda recusa de admissão
 * precisa ser indistinguível da recusa por senha errada (§5.2 da tech spec), e distinguir
 * confirmaria ao atacante que a conta existe.
 *
 * Ela mora **na barreira**, e não em quem monta a instância, porque é a barreira que define o que
 * uma recusa é. Ter duas cadeias literais em dois arquivos seria duas definições da mesma coisa,
 * livres para divergir — e a divergência entre elas é exatamente o vazamento que a RN-10 proíbe.
 */
export const RECUSA_DE_CREDENCIAL = {
  code: 'INVALID_EMAIL_OR_PASSWORD',
  message: 'Invalid email or password',
} as const;

/**
 * O estado que a barreira lê, e nada além dele.
 *
 * O tipo é fechado de propósito: um predicado só pode decidir com o que está declarado aqui, e
 * acrescentar um dado à decisão obriga a acrescentá-lo ao estado — o que torna visível, no tipo, o
 * que a admissão passou a depender. Nada de pedido HTTP, cabeçalho ou cookie entra: a origem do
 * contexto nunca é o request (invariante 2, ADR-0008).
 */
export interface EstadoDeAdmissao {
  readonly usuarioId: string;
  readonly perfil: Perfil;
  readonly ativo: boolean;
  readonly senhaProvisoria: boolean;
  readonly doisFatoresAtivo: boolean;
  /** Falhas consecutivas na conta. Lido junto de `bloqueadoAte` porque é o par que `estaBloqueada` recebe. */
  readonly tentativasFalhas: number;
  readonly bloqueadoAte: Date | null;
  /** Nulo apenas para o Master, que não pertence a empresa alguma. */
  readonly empresaId: string | null;
  /** Instante da suspensão da empresa. Nulo é o estado normal — e é nulo também para quem não tem empresa. */
  readonly empresaSuspensaEm: Date | null;
}

/** Os três predicados que recusam, na ordem em que são avaliados. */
export const MOTIVOS_DE_RECUSA = [
  'CONTA_BLOQUEADA',
  'PESSOA_DESATIVADA',
  'EMPRESA_SUSPENSA',
] as const;

/** Por que a admissão foi recusada. Nunca chega à resposta — só à trilha (RN-10). */
export type MotivoDeRecusa = (typeof MOTIVOS_DE_RECUSA)[number];

/** As duas exigências que restringem a sessão em vez de recusá-la. */
export const RESTRICOES_DE_SESSAO = ['SENHA_PROVISORIA', 'SEGUNDO_FATOR'] as const;

/** Exigência pendente que reduz o alcance da sessão até ser cumprida (RN-08, RN-09). */
export type RestricaoDeSessao = (typeof RESTRICOES_DE_SESSAO)[number];

/**
 * O desfecho da barreira.
 *
 * União discriminada, e não um objeto com campos opcionais: assim é impossível ler `restricoes` de
 * uma admissão recusada, ou ignorar o `motivo` de uma recusa sem que o compilador reclame.
 */
export type Admissao =
  | { readonly admitida: false; readonly motivo: MotivoDeRecusa }
  | { readonly admitida: true; readonly restricoes: readonly RestricaoDeSessao[] };

/**
 * A conta está bloqueada por tentativas malsucedidas (RN-06).
 *
 * Delega a `estaBloqueada` de `bloqueio.ts`, que é quem já responde por esta regra desde a T6:
 * reescrever a comparação aqui criaria uma segunda definição de "bloqueada", livre para divergir
 * daquela que a operação de bloqueio usa.
 */
export function contaBloqueada(estado: EstadoDeAdmissao, agora: Date): boolean {
  return estaBloqueada(estado, agora);
}

/** A pessoa foi desativada (RN-10). */
export function pessoaDesativada(estado: EstadoDeAdmissao): boolean {
  return !estado.ativo;
}

/**
 * A empresa da pessoa está suspensa (RN-10).
 *
 * **Só se aplica a quem pertence a empresa.** O Master não pertence a nenhuma, e para ele o
 * predicado é falso por ausência de empresa, não por ausência de suspensão — a verificação de
 * `empresaId` está aqui para que isso seja afirmação do código, e não consequência acidental de o
 * `LEFT JOIN` devolver nulo.
 */
export function empresaSuspensa(estado: EstadoDeAdmissao): boolean {
  return estado.empresaId !== null && estado.empresaSuspensaEm !== null;
}

/** A senha ainda é a provisória: a sessão entra restrita até a troca (RN-09). Não recusa. */
export function senhaProvisoriaPendente(estado: EstadoDeAdmissao): boolean {
  return estado.senhaProvisoria;
}

/**
 * O segundo fator é exigido desta pessoa e ainda não está ativo: a sessão entra restrita (RN-08).
 * Não recusa.
 *
 * Exigido **por perfil**: o Master é obrigado a ter segundo fator; para o Admin ele é adesão
 * própria. Com o segundo fator já ativo o predicado é falso — e nesse caso a entrada nem chega
 * aqui, porque o arcabouço interrompe para o desafio antes de criar sessão.
 */
export function segundoFatorExigido(estado: EstadoDeAdmissao): boolean {
  return estado.perfil === 'SYSLOC_MASTER' && !estado.doisFatoresAtivo;
}

/**
 * A barreira. Decide se a sessão pode nascer e com que restrições.
 *
 * Função pura: recebe o estado já carregado e o instante, e não toca banco, pedido nem relógio. O
 * `agora` entra por parâmetro pelo mesmo motivo que `estaBloqueada` o recebe — decisão que lê o
 * relógio por dentro não é reproduzível, e o decurso do bloqueio é justamente o que precisa ser
 * exercitado sem esperar quinze minutos.
 */
export function admitirSessao(estado: EstadoDeAdmissao, agora: Date): Admissao {
  if (contaBloqueada(estado, agora)) {
    return { admitida: false, motivo: 'CONTA_BLOQUEADA' };
  }

  if (pessoaDesativada(estado)) {
    return { admitida: false, motivo: 'PESSOA_DESATIVADA' };
  }

  if (empresaSuspensa(estado)) {
    return { admitida: false, motivo: 'EMPRESA_SUSPENSA' };
  }

  const restricoes: RestricaoDeSessao[] = [];

  if (senhaProvisoriaPendente(estado)) {
    restricoes.push('SENHA_PROVISORIA');
  }

  if (segundoFatorExigido(estado)) {
    restricoes.push('SEGUNDO_FATOR');
  }

  return { admitida: true, restricoes };
}

/** Como a pessoa é encontrada: pelo que ela digitou, ou pelo identificador que a sessão carrega. */
export type AlvoDeAdmissao = { readonly email: string } | { readonly usuarioId: string };

/**
 * O que a **guarda de contexto** de `apps/api` lê de `identidade` para montar a sessão do produto.
 *
 * Ela **estende {@link EstadoDeAdmissao}**, e a herança é o ponto: o predicado da barreira
 * ({@link segundoFatorExigido}) é declarado sobre aquele estado, e satisfazê-lo por inteiro é o que
 * permite à guarda **consultá-lo** em vez de reescrever a comparação lá. Acrescentar um dado à
 * decisão de admissão passa a obrigar esta leitura a carregá-lo — **no tipo, e não na lembrança de
 * quem editar**: o retorno declarado de {@link carregarPessoa} é este, e projeção incompleta não
 * compila.
 *
 * Os três campos próprios são de **exibição**, e não de decisão: eles existem porque a §4.2 da tech
 * spec fixa `nome`, `email` e `empresaNome` no objeto de sessão, e não porque algum predicado os
 * leia. Por isso eles estão AQUI e não em `EstadoDeAdmissao`, que segue fechado no que a barreira
 * decide.
 */
export interface PessoaDaSessao extends EstadoDeAdmissao {
  readonly nome: string;
  readonly email: string;
  readonly empresaNome: string | null;
}

/**
 * A **única** leitura da linha de `identidade.usuario` que existe neste sistema.
 *
 * As duas funções públicas abaixo diferem apenas no **critério**; a tabela, o `LEFT JOIN`, a
 * projeção e o `limit` são estes, e não há um segundo lugar onde escrevê-los diferente. Antes desta
 * unificação havia duas consultas à mesma linha, em pacotes distintos, iguais na intenção e livres
 * para divergir na forma — e a Revisão Técnica da T9 registrou por que isso pesa: a contenção da
 * ausência de RLS em `identidade` (§11.2 da tech spec) é *"nenhuma rota expõe identidade além da
 * própria sessão de quem pede"*, o que só é estrutural enquanto a leitura for uma só e viver aqui.
 *
 * O `LEFT JOIN` com a empresa é o que permite decidir os três primeiros predicados com **uma**
 * leitura: duas consultas separadas abririam janela entre elas em que a empresa é suspensa depois
 * de a pessoa ter sido lida, e a decisão sairia sobre um estado que nunca existiu junto. É a mesma
 * razão pela qual a guarda precisa do par (pessoa, empresa) junto.
 *
 * É `LEFT`, e não `INNER`, porque o Master não tem empresa — com `INNER` ele simplesmente
 * desapareceria da consulta: seria tratado como e-mail inexistente na entrada, e como sessão não
 * resolvível na guarda.
 */
async function carregarPessoa(
  banco: BancoDeIdentidade,
  criterio: SQL,
): Promise<PessoaDaSessao | undefined> {
  const { empresa, usuario } = esquemaIdentidade;

  const [pessoa] = await banco
    .select({
      usuarioId: usuario.id,
      nome: usuario.nome,
      email: usuario.email,
      perfil: usuario.perfil,
      ativo: usuario.ativo,
      senhaProvisoria: usuario.senhaProvisoria,
      doisFatoresAtivo: usuario.doisFatoresAtivo,
      tentativasFalhas: usuario.tentativasFalhas,
      bloqueadoAte: usuario.bloqueadoAte,
      empresaId: usuario.empresaId,
      empresaNome: empresa.nome,
      empresaSuspensaEm: empresa.suspensaEm,
    })
    .from(usuario)
    .leftJoin(empresa, eq(empresa.id, usuario.empresaId))
    .where(criterio)
    .limit(1);

  return pessoa;
}

/**
 * Carrega o estado de admissão de uma pessoa, ou `undefined` se ela não existe.
 *
 * É a leitura **interna da ligação** (`autenticacao.ts`), e por isso não sai no índice do pacote.
 * O tipo de retorno é `EstadoDeAdmissao`, e não {@link PessoaDaSessao}: a barreira decide com o que
 * está declarado ali e nada além disso, de modo que os campos de exibição que a consulta traz
 * **não** ficam visíveis a predicado nenhum.
 *
 * O e-mail chega já normalizado por quem chama. A coluna guarda minúsculas (§6.1: a normalização é
 * ponto único na borda), então comparar sem normalizar faria `Ana@…` não encontrar a conta de
 * `ana@…`.
 */
export async function carregarEstadoDeAdmissao(
  banco: BancoDeIdentidade,
  alvo: AlvoDeAdmissao,
): Promise<EstadoDeAdmissao | undefined> {
  const { usuario } = esquemaIdentidade;

  return await carregarPessoa(
    banco,
    'email' in alvo ? eq(usuario.email, alvo.email) : eq(usuario.id, alvo.usuarioId),
  );
}

/**
 * Carrega, para a **guarda de contexto**, a pessoa por trás de uma sessão já autenticada.
 *
 * Esta é a leitura que `packages/db/src/contexto.ts` nomeia como consumidor legítimo do acesso
 * restrito a `identidade`, e ela mora aqui — e não em `apps/api` — para que a consulta a
 * `identidade` continue sendo **uma**, escrita num lugar só. O identificador vem da sessão que o
 * arcabouço conferiu, nunca do pedido (invariante 2 do `CLAUDE.md`, ADR-0008): esta função não
 * conhece requisição, cabeçalho nem cookie, e o `usuarioId` é o único jeito de chegar a uma linha.
 *
 * `undefined` significa "pessoa não resolvível" — quem traduz isso em recusa é a guarda, com o
 * mesmo código e a mesma mensagem da sessão ausente (RN-10).
 */
export async function carregarPessoaDaSessao(
  banco: BancoDeIdentidade,
  usuarioId: string,
): Promise<PessoaDaSessao | undefined> {
  const { usuario } = esquemaIdentidade;

  return await carregarPessoa(banco, eq(usuario.id, usuarioId));
}

/**
 * Baixa a marca de senha provisória — a exigência da RN-09 foi cumprida.
 *
 * **É o par de {@link senhaProvisoriaPendente}, e por isso mora ao lado dele.** O predicado lê a
 * coluna e a marca restringe a sessão até alguém baixá-la; enquanto ninguém baixasse, a restrição
 * seria permanente e a troca obrigatória não teria desfecho. Escrever a coluna a partir de
 * `apps/api` faria o leitor e o escritor da mesma marca viverem em pacotes diferentes, livres para
 * divergir no critério — e obrigaria a aplicação a conhecer `esquemaIdentidade` e o construtor de
 * consulta do ORM, que é justamente o que a §11.2 da tech spec contém ao manter a leitura de
 * `identidade` deste lado da fronteira.
 *
 * **Quem chama já concluiu a troca.** Esta função não confere senha, não decide nada e não sabe o
 * que é uma troca bem-sucedida: ela é chamada **depois** de o arcabouço ter gravado a credencial
 * nova (`apps/api/src/autenticacao/autenticacao.controller.ts`), nunca antes. A ordem é a rede que
 * o CT-022 persegue: baixar a marca antes de a troca ser aceita liberaria a sessão de quem teve a
 * senha nova recusada — escalação de privilégio silenciosa.
 *
 * Escrita incondicional, sem ler antes se há o que limpar, pela mesma razão de `limparBloqueio`: a
 * leitura prévia trocaria uma escrita barata por uma ida a mais ao banco e abriria a janela em que
 * o estado muda entre a leitura e a decisão de não escrever.
 */
export async function limparMarcaDeSenhaProvisoria(
  banco: BancoDeIdentidade,
  usuarioId: string,
): Promise<void> {
  const { usuario } = esquemaIdentidade;

  await banco.update(usuario).set({ senhaProvisoria: false }).where(eq(usuario.id, usuarioId));
}
