/**
 * Onboarding de pessoa — Senha provisória, criação pelo adaptador e reemissão.
 *
 * ---------------------------------------------------------------------------
 * Quem cria pessoa aqui, e por que não pelas rotas do arcabouço
 * ---------------------------------------------------------------------------
 *
 * O cadastro público está desligado (`disableSignUp`, `autenticacao.ts`): pessoas não nascem por
 * iniciativa própria, nascem por ato do Sysloc Master ou do Admin da empresa (US-02, US-07, US-08).
 * A criação, portanto, é **server-side** — `internalAdapter.createUser`, e não uma rota —, e é isso
 * que permite o par `perfil`/`empresaId` ser INJETADO PELO SERVIDOR enquanto continua com a escrita
 * pelo corpo da requisição fechada. As duas metades são a mesma decisão vista dos dois lados, e a
 * `DECISÃO FECHADA` do bloco `user` de `autenticacao.ts` é o texto dela:
 *
 *   * o corpo de uma requisição **nunca** escreve os dois campos — `input: false` faz o
 *     `parseInputData` do arcabouço recusar, em qualquer rota;
 *   * o caminho server-side **não passa** por aquele analisador (`createUser` → `transformInput`,
 *     que nunca consulta `input`), então a criação continua exequível.
 *
 * ---------------------------------------------------------------------------
 * A Senha provisória em texto existe APENAS no valor de retorno
 * ---------------------------------------------------------------------------
 *
 * Nem em registro estruturado, nem em contexto de erro, nem em campo persistido, nem ecoada numa
 * resposta posterior (§11.3 e §13.1 da tech spec, RN-12). Nada neste arquivo escreve, registra ou
 * anexa a senha a coisa alguma: ela é gerada, derivada pelo mecanismo do arcabouço, e devolvida.
 * O que fica no banco é a derivação, em `identidade.conta.senha_derivada`.
 *
 * A consequência disso é uma propriedade a preservar, e não um detalhe: **quem chamar estas funções
 * é o único a ver a senha**, e o alcance dessa entrega está declarado na ADR-0013 — emitir
 * credencial é poder distinto da garantia sobre a sessão do operador. A trilha reconstitui quem
 * emitiu; a criptografia não impede que quem emitiu use.
 *
 * ---------------------------------------------------------------------------
 * Por que a política de força vale para a senha que o servidor mesmo sorteia
 * ---------------------------------------------------------------------------
 *
 * A §6.2 da tech spec manda gerar a Senha provisória "com a mesma política de força da senha
 * comum". Não é cerimônia: a senha sorteada aqui é a credencial com que a pessoa entra pela
 * primeira vez, e ela é entregue **fora de banda** (decisão E1 do discovery — o canal de e-mail só
 * nasce na F3). Uma senha que a própria política recusaria seria ainda mais frágil justamente no
 * trecho em que ela viaja por fora do sistema.
 *
 * A verificação é feita **contra a mesma função** que o gancho de `autenticacao.ts` aplica a toda
 * definição de senha, e não por uma segunda leitura das quatro regras escrita aqui — que seria a
 * segunda definição, livre para divergir. E ela roda de fato: o alfabeto abaixo torna a reprovação
 * improvável, não impossível (a regra de dado pessoal casa qualquer TOKEN de três ou mais
 * caracteres do nome ou da parte local do e-mail — `contemDadoPessoal` recorta por separador não
 * alfanumérico e descarta os menores, e não procura qualquer trecho de três letras), e a política
 * do arcabouço **não** alcança este caminho — `hooks.before` corre para endpoints, e
 * `internalAdapter` não é um.
 */

import { randomInt } from 'node:crypto';
import { type BancoDeIdentidade, esquemaIdentidade } from '@sysloc/db';
import { eq } from 'drizzle-orm';
import type { Autenticacao } from './autenticacao.js';
import type { Perfil } from './perfis.js';
import { avaliarForcaDeSenha, type PessoaDaSenha } from './senha.js';

/**
 * Provedor da credencial local, no vocabulário do arcabouço.
 *
 * É o valor que ele grava e procura em `identidade.conta.provedor_id` para a entrada por
 * identificação e senha. Escrito aqui em vez de importado de `@sysloc/db`: aquele literal
 * (`PROVEDOR_DE_CREDENCIAL`) pertence à carga inicial, e acoplar o onboarding de produção a uma
 * constante de semente inverteria a dependência.
 */
const PROVEDOR_LOCAL = 'credential';

/**
 * Comprimento da Senha provisória.
 *
 * Bem acima do piso de dez de `COMPRIMENTO_MINIMO_DE_SENHA`, e de propósito: esta senha é sorteada
 * pelo servidor e digitada uma única vez, então o custo de comprimento recai sobre a máquina e não
 * sobre a memória de ninguém. Dezesseis caracteres do alfabeto abaixo dão mais de 90 bits de
 * entropia, o que torna a adivinhação irrelevante ao lado do bloqueio por conta (RN-06).
 */
const COMPRIMENTO_DA_SENHA_PROVISORIA = 16;

/**
 * O alfabeto do sorteio, sem caracteres que se confundem à leitura.
 *
 * Fora `0`/`O`, `1`/`l`/`I` e `5`/`S`: a senha é entregue **fora de banda** — ditada, copiada de um
 * papel ou de uma mensagem —, e um caractere ambíguo transforma uma entrega correta numa recusa de
 * credencial que ninguém sabe explicar. É a mesma razão pela qual não há símbolo aqui: variedade de
 * classe não compra entropia que o comprimento não compre mais barato, e cobra na transcrição.
 */
const ALFABETO_DA_SENHA_PROVISORIA = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRTUVWXYZ23456789';

/**
 * Quantas vezes o sorteio é repetido antes de desistir.
 *
 * A política reprova um sorteio com probabilidade pequena mas não nula — a regra de dado pessoal
 * casa qualquer TOKEN de três ou mais caracteres do nome ou da parte local do e-mail (o recorte é
 * por separador não alfanumérico, e não por trecho arbitrário), e uma corrida de quatro
 * consecutivos ou repetidos também aparece de vez em quando. Repetir é a saída barata;
 * **desistir com erro** é o que impede que uma tentativa mal-sucedida vire senha fraca aceita em
 * silêncio, que é o único desfecho inaceitável aqui.
 */
const SORTEIOS_ANTES_DE_DESISTIR = 16;

/** O que o servidor decide sobre a pessoa que nasce. Nada aqui vem do corpo da requisição. */
export interface PessoaNova extends PessoaDaSenha {
  /**
   * O perfil, **decidido pelo servidor**. Na rota do Master é sempre `ADMIN_EMPRESA`; na rota da
   * empresa, o campo declarado da rota, validado contra o enum antes de chegar aqui (§6.1).
   */
  readonly perfil: Perfil;
  /**
   * A empresa, **decidida pelo servidor** — o identificador da rota do Master, ou a empresa do
   * contexto de tenant de quem chama. Nulo apenas para o Sysloc Master, e a restrição
   * `usuario_master_sem_empresa_chk` é quem torna isso obrigatório.
   */
  readonly empresaId: string | null;
}

/** O que a criação devolve. A senha em texto existe aqui, e em nenhum outro lugar. */
export interface PessoaCriada {
  readonly usuarioId: string;
  /** A Senha provisória em texto claro, entregue **uma única vez** (RN-07). */
  readonly senhaProvisoria: string;
}

/**
 * Sorteia uma Senha provisória que passa na política de força da pessoa informada (RN-05).
 *
 * O sorteio é de `node:crypto` (`randomInt`), e não de `Math.random`: o gerador de conveniência não
 * é criptográfico, e esta é a credencial de primeira entrada de uma conta administrativa.
 * `randomInt` sorteia sem viés de módulo, que é o defeito clássico de `% alfabeto.length`.
 *
 * @throws quando {@link SORTEIOS_ANTES_DE_DESISTIR} sorteios seguidos são reprovados pela política.
 *         Falhar é a única alternativa correta a devolver uma senha que a política recusa.
 */
export function gerarSenhaProvisoria(pessoa: PessoaDaSenha): string {
  for (let sorteio = 0; sorteio < SORTEIOS_ANTES_DE_DESISTIR; sorteio += 1) {
    const candidata = sortearSenha();

    // A MESMA função que o gancho de `autenticacao.ts` aplica a toda definição de senha. Os motivos
    // são descartados de propósito: eles nomeiam regra violada por uma senha que ninguém digitou, e
    // levá-los adiante só criaria um caminho por onde um trecho da senha poderia vazar.
    if (avaliarForcaDeSenha(candidata, pessoa).aprovada) {
      return candidata;
    }
  }

  // A mensagem não carrega senha, nem trecho dela, nem os motivos — só o fato e a pessoa, que é o
  // que a operação precisa para diagnosticar. Nome e e-mail já são dados que o chamador tem.
  throw new Error(
    `nenhum dos ${String(SORTEIOS_ANTES_DE_DESISTIR)} sorteios de Senha provisória passou na política de força de ${pessoa.email}`,
  );
}

/**
 * Cria a pessoa pelo adaptador, com credencial de Senha provisória, e devolve a senha em texto.
 *
 * ---------------------------------------------------------------------------
 * A ordem dos três passos é fail-closed, e é por isso que ela é esta
 * ---------------------------------------------------------------------------
 *
 * Os três — criar a pessoa, marcar a senha como provisória, criar a credencial — não correm numa
 * transação comum: o adaptador do arcabouço tem conexão própria e não aceita a transação de fora.
 * A ordem é, então, a única defesa, e ela põe a credencial **por último**: uma interrupção em
 * qualquer ponto deixa uma pessoa **sem credencial**, que não entra em lugar nenhum. A ordem
 * inversa deixaria uma pessoa que entra sem a marca que a obriga a trocar a senha — sessão plena
 * com credencial que um terceiro conhece, que é exatamente o que a RN-09 existe para impedir.
 *
 * ---------------------------------------------------------------------------
 * A ordem é fail-closed; a compensação é o que impede o endereço de queimar
 * ---------------------------------------------------------------------------
 *
 * Falhar depois do primeiro passo deixa uma pessoa sem credencial — inofensiva do ponto de vista de
 * acesso, e é essa a garantia da ordem. Mas `email` é ÚNICO, e nesta fatia não há rota de exclusão:
 * a linha órfã **queima o endereço**, e a segunda tentativa de criar a mesma pessoa passa a falhar
 * por conflito sem que ninguém saiba por quê. Por isso os passos 2 e 3 correm sob compensação — a
 * pessoa recém-criada é apagada antes de a falha propagar, e o que se propaga é a falha ORIGINAL,
 * nunca a da compensação. Não é substituto de transação: se a própria compensação falhar, a linha
 * fica, e é por isso que a falha resultante nomeia as duas causas e o identificador.
 *
 * @throws quando a pessoa é criada e a leitura do identificador falha, ou quando a política de
 *         força reprova todos os sorteios (ver {@link gerarSenhaProvisoria}).
 */
export async function criarPessoa(
  autenticacao: Autenticacao,
  banco: BancoDeIdentidade,
  pessoa: PessoaNova,
): Promise<PessoaCriada> {
  const contexto = await autenticacao.$context;
  const senhaProvisoria = gerarSenhaProvisoria(pessoa);

  // Os campos são NOMEADOS um a um, e o objeto de entrada **não** é espalhado: espalhar faria toda
  // chave que chegasse em `pessoa` viajar até o `INSERT`, e é assim que um corpo de requisição
  // repassado inteiro pela rota voltaria a escrever `perfil` — o `input: false` protege o
  // analisador de corpo do arcabouço, não este caminho, que é server-side por construção. O CT-235
  // exercita exatamente esse vetor.
  //
  // `name` é o nome do campo NO MODELO do arcabouço, e o mapeamento de `autenticacao.ts`
  // (`fields: { name: 'nome' }`) é quem o traduz para a coluna. `perfil` e `empresaId` já são os
  // nomes dos campos adicionais, e por isso viajam como estão.
  const criada = await contexto.internalAdapter.createUser({
    name: pessoa.nome,
    email: pessoa.email,
    perfil: pessoa.perfil,
    empresaId: pessoa.empresaId,
  });

  const usuarioId = criada?.id;
  if (typeof usuarioId !== 'string') {
    throw new Error(`a criação de ${pessoa.email} não devolveu identificador de pessoa`);
  }

  try {
    await marcarSenhaComoProvisoria(banco, usuarioId);

    await contexto.internalAdapter.linkAccount({
      userId: usuarioId,
      // O arcabouço usa o próprio identificador da pessoa como identificador dela no provedor local.
      accountId: usuarioId,
      providerId: PROVEDOR_LOCAL,
      // A derivação é a **do arcabouço** — a mesma que a entrada confere. Uma derivação escrita aqui
      // seria um segundo formato, e a conta nasceria impossível de conferir.
      password: await contexto.password.hash(senhaProvisoria),
    });
  } catch (falha) {
    await apagarPessoaCriada(contexto, usuarioId, falha);
    throw falha;
  }

  return { usuarioId, senhaProvisoria };
}

/**
 * Desfaz a criação da pessoa quando um passo posterior falhou.
 *
 * `deleteUser` do adaptador, e não um `DELETE` escrito aqui: ele apaga sessões, contas e a pessoa
 * pela mesma via que o arcabouço usa, e um `DELETE` próprio deixaria de fora o que uma versão
 * futura acrescentar ao modelo. Nada foi emitido em nome dessa pessoa entre a criação e a falha, de
 * modo que não há efeito externo a compensar além da linha.
 *
 * **Ela não engole a falha original.** Se a compensação também falhar, o que sobe nomeia as duas
 * causas e o identificador da linha que ficou — apagar em silêncio um erro de limpeza deixaria o
 * endereço queimado sem que nada dissesse qual pessoa examinar. A senha em texto não passa por
 * aqui, e a mensagem não a carrega (RN-12).
 */
async function apagarPessoaCriada(
  contexto: Awaited<Autenticacao['$context']>,
  usuarioId: string,
  falhaOriginal: unknown,
): Promise<void> {
  try {
    await contexto.internalAdapter.deleteUser(usuarioId);
  } catch (falhaDaCompensacao) {
    throw new AggregateError(
      [falhaOriginal, falhaDaCompensacao],
      `a criação da pessoa ${usuarioId} falhou e a compensação não conseguiu apagá-la — o endereço segue ocupado`,
    );
  }
}

/**
 * Reemite a Senha provisória de quem já existe, **invalidando a anterior no mesmo ato** (RN-09).
 *
 * A invalidação não é um passo à parte: `updatePassword` reescreve a derivação da conta local, e a
 * senha anterior deixa de derivar naquele mesmo `UPDATE`. Não há janela em que as duas valham, e
 * não há o que apagar depois — o que existe é a única linha de credencial da pessoa, com o valor
 * novo. Quem tentar a anterior recebe a recusa **indistinguível** de credencial incorreta (RN-10),
 * porque é literalmente o que ela passou a ser.
 *
 * A operação **não** é idempotente, e isso é da natureza dela (§9.2 da tech spec): cada chamada
 * sorteia uma senha e invalida a de antes.
 *
 * @throws quando a pessoa não tem credencial local. Reescrever a senha de zero linhas seria
 *         silencioso: a função devolveria uma senha que não entra em lugar nenhum, e quem a
 *         recebesse levaria horas para descobrir que o problema não era de digitação.
 */
export async function reemitirSenhaProvisoria(
  autenticacao: Autenticacao,
  banco: BancoDeIdentidade,
  pessoa: PessoaDaSenha & { readonly usuarioId: string },
): Promise<string> {
  const contexto = await autenticacao.$context;

  const contas = await contexto.internalAdapter.findAccounts(pessoa.usuarioId);
  if (!contas.some((conta) => conta.providerId === PROVEDOR_LOCAL)) {
    throw new Error(`a pessoa ${pessoa.usuarioId} não tem credencial local para reemitir`);
  }

  const senhaProvisoria = gerarSenhaProvisoria(pessoa);

  await contexto.internalAdapter.updatePassword(
    pessoa.usuarioId,
    await contexto.password.hash(senhaProvisoria),
  );

  // Depois da troca, e não antes: a marca é o que restringe a sessão até a senha ser trocada
  // (RN-09), e levantá-la sobre uma credencial que não chegou a ser reescrita deixaria a pessoa
  // restrita com a senha antiga ainda valendo.
  await marcarSenhaComoProvisoria(banco, pessoa.usuarioId);

  return senhaProvisoria;
}

/**
 * Levanta a marca que a barreira de admissão lê para restringir a sessão (RN-09).
 *
 * É a operação irmã e oposta de `limparMarcaDeSenhaProvisoria` (`admissao.ts`), e mora deste lado
 * da fronteira pelo mesmo motivo dela: quem conhece `esquemaIdentidade` e o construtor de consulta
 * do ORM é este pacote, e não `apps/api` (§11.2 da tech spec, ADR-0009).
 */
async function marcarSenhaComoProvisoria(
  banco: BancoDeIdentidade,
  usuarioId: string,
): Promise<void> {
  const { usuario } = esquemaIdentidade;

  await banco.update(usuario).set({ senhaProvisoria: true }).where(eq(usuario.id, usuarioId));
}

/** Um sorteio, sem julgamento de força — quem julga é {@link gerarSenhaProvisoria}. */
function sortearSenha(): string {
  let senha = '';

  for (let posicao = 0; posicao < COMPRIMENTO_DA_SENHA_PROVISORIA; posicao += 1) {
    senha += ALFABETO_DA_SENHA_PROVISORIA[randomInt(ALFABETO_DA_SENHA_PROVISORIA.length)];
  }

  return senha;
}
