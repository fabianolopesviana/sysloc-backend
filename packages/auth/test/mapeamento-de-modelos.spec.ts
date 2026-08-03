/**
 * Mapeamento dos modelos do arcabouço para as colunas do projeto — o critério 3 do §4 da T6.
 *
 * ---------------------------------------------------------------------------
 * INVARIANTES
 * ---------------------------------------------------------------------------
 *
 * | Critério | Caso     | Invariante |
 * |----------|----------|------------|
 * | CA-06    | T6 §4-3a | Atualizar uma pessoa pelo caminho do arcabouço grava na coluna em
 * |          |          | português e move `atualizado_em` — o campo que o adaptador acrescenta a
 * |          |          | TODO update, e cuja ausência derrubaria o verbo inteiro. |
 * | CA-06    | T6 §4-3b | Criar o registro de segundo fator pelo caminho do arcabouço grava as três
 * |          |          | colunas que o plugin escreve por conta própria (`verificado`,
 * |          |          | `falhas_verificacao`) na tabela `dois_fatores`; trancar o segundo fator
 * |          |          | pelo mesmo caminho move `bloqueado_ate`. |
 * | CA-06    | T6 §4-3c | Atualizar uma pessoa pelo caminho do arcabouço informando a confirmação do
 * |          |          | endereço e o retrato move `email_verificado` e `imagem` — as duas
 * |          |          | colunas que nenhum fluxo de entrada escreve. |
 *
 * Rastreabilidade: `CA-06 → T6 §4-3 (RN-08)`.
 *
 * ---------------------------------------------------------------------------
 * Por que este arquivo existe
 * ---------------------------------------------------------------------------
 *
 * O critério 3 exige que **cada campo** dos modelos do arcabouço tenha coluna e mapeamento. Seis
 * deles não tinham: `emailVerified`, `updatedAt` e `image` do modelo `user`; `verified`,
 * `failedVerificationCount` e `lockedUntil` do plugin de segundo fator. Nada reprovava, porque o
 * único fluxo exercitado era a **entrada**, que só lê `usuario` e só escreve `sessao`.
 *
 * O adaptador Drizzle não ignora campo sem coluna, e falha de dois jeitos distintos — os dois
 * medidos aqui, reintroduzindo o defeito:
 *
 *   * na **criação**, levanta `BetterAuthError: The field "verified" does not exist in the
 *     "doisFatores" Drizzle schema`, em execução, na primeira linha de segundo fator (T10);
 *   * na **atualização**, não confere nada: o campo não chega ao banco e a coluna não se move. Sem
 *     o mapeamento de `updatedAt`, `atualizado_em` ficaria parada para sempre — falha silenciosa,
 *     que é a pior das duas e a que nenhuma exceção denunciaria.
 *
 * E migração é imutável: fechar o buraco depois custaria outra migração sobre um banco que já
 * atende a operação.
 *
 * ---------------------------------------------------------------------------
 * Onde o caso ataca, e por quê
 * ---------------------------------------------------------------------------
 *
 * As rotas que fariam isso são da T7, da T8 e da T10, e não existem hoje. O caso exercita o
 * **caminho real disponível** — o adaptador da própria instância, que é exatamente o que aquelas
 * rotas chamarão, e é onde a verificação de campo mora. Mesma decisão que o CT-025 registra ao
 * exercitar a entrada pela API da instância em vez de por uma rota que ainda não nasceu.
 *
 * As asserções são sobre o **estado gravado**, e não sobre "não levantou": um SUT que engolisse o
 * erro passaria por "não levantou", e um mapeamento que apontasse para a coluna errada também.
 *
 * ---------------------------------------------------------------------------
 * Todo campo provado é ESCRITO pelo adaptador antes de ser lido
 * ---------------------------------------------------------------------------
 *
 * É a regra que organiza os três casos, e ela existe porque a violá-la o caso fica **cego ao
 * mapeamento**: ler `email_verificado` numa linha em que nada passou pelo adaptador observa o
 * padrão da coluna, e o padrão continua lá com o mapeamento removido. Por isso `email_verificado`,
 * `imagem` e `bloqueado_ate` — os três campos que nenhum fluxo de entrada toca — ganham, cada um,
 * uma escrita pelo caminho do arcabouço e a leitura do **par antes/depois** da coluna.
 *
 * Para `bloqueado_ate` a distinção é de segurança, e não de higiene: ele é o instante em que o
 * plugin tranca o segundo fator após confirmações erradas demais. Como quem o escreve é uma
 * **atualização**, e na atualização o adaptador não confere campo por coluna, um mapeamento ausente
 * ali não levanta nada — a tranca simplesmente não persiste, e a proteção do plugin contra força
 * bruta no TOTP some em silêncio. Daí a asserção observar a coluna, nunca a ausência de erro.
 *
 * ---------------------------------------------------------------------------
 * Por que a prova de `email_verificado` e `imagem` é por atualização, e não por criação
 * ---------------------------------------------------------------------------
 *
 * Criar pessoa pelo adaptador (`internalAdapter.createUser`) seria o caminho mais forte: ele
 * carrega o modo de detonação (`BetterAuthError` na criação) e varreria de uma vez qualquer campo
 * do modelo `user` sem mapeamento. **Hoje ele é inexequível, e foi medido**: `perfil` e `empresa_id`
 * são colunas do PRODUTO, que o modelo `user` do arcabouço não declara; o adaptador descarta toda
 * chave que não seja campo do modelo, e o `INSERT` sai com `perfil` em `default` — coluna
 * `NOT NULL` sem padrão. A criação falha, portanto, **fora** do que este arquivo prova.
 *
 *     insert into "identidade"."usuario" (…, "perfil", "empresa_id", …)
 *     values (default, $1, $2, $3, $4, default, default, …)
 *     ⇒ null value in column "perfil" violates not-null constraint
 *
 * Habilitá-la exige declarar `perfil` e `empresa_id` ao arcabouço como campos adicionais do modelo
 * `user` — e isso muda o objeto de pessoa que a sessão devolve e abre esses campos à superfície de
 * escrita do arcabouço. É decisão de desenho da fatia **`autorizacao-e-ciclo-de-acesso`**, que é
 * onde o `CLAUDE.md` aloca o onboarding com senha temporária e as rotas do Master — o primeiro (e
 * único) lugar do produto que CRIA pessoa. Não é decisão desta task nem de um ciclo de correção.
 *
 * **Nenhuma task restante desta fatia tropeça nisto**, e é por isso que o endereçamento importa:
 * T7 é a barreira de admissão do login, T8 publica `/v1` e o enum de erros, T9 liga sessão a
 * contexto de tenant, T10 fecha senha provisória e segundo fator (por ATUALIZAÇÃO, não por
 * criação) e T11 prova a equivalência das respostas de recusa. Nenhuma das cinco cria pessoa.
 *
 * O ponteiro que a fatia de autorização vai encontrar na hora certa é o marcador de débito **D7**,
 * em `packages/auth/src/autenticacao.ts`, imediatamente acima do bloco `user.fields` que ela terá
 * obrigatoriamente de abrir para tomar a decisão. (O nome do marcador não é citado por extenso aqui
 * de propósito: o oráculo do `CLAUDE.md` grepa o literal em `apps`/`packages`/`deploy`, e prosa que
 * o repita faria o índice contar um marcador que não existe — é o P6 do Gate 2, já fechado.)
 *
 * Enquanto isso, a atualização prova as duas colunas pelo mesmo critério que `bloqueado_ate` usa e
 * que é o mais exigente dos dois: **a coluna se moveu**.
 */

import { esquemaIdentidade } from '@sysloc/db';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { type IdentidadeEfemera, identidadeEfemera, pessoaSemeada } from './identidade-efemera.ts';

/** A pessoa atualizada pelo caminho do arcabouço. */
const PESSOA = pessoaSemeada('admin.b@exemplo.com.br');

const NOME_NOVO = 'Bianca Barros de Almeida';

/**
 * A pessoa cuja confirmação de endereço e cujo retrato são escritos pelo adaptador.
 *
 * **Conta distinta da de cima, e é o ponto**: o caso `§4-3a` afirma o estado inicial das duas
 * colunas na conta dele, e movê-las ali faria um caso depender da ordem do outro — rodar o
 * `§4-3c` isolado (`-t`, workflow documentado em `.claude/rules/testing-stack.md`) passaria e
 * derrubaria o `§4-3a` na suíte completa, ou o contrário.
 */
const PESSOA_DO_RETRATO = pessoaSemeada('usuario.b1@exemplo.com.br');

/** Endereço de retrato qualquer: o caso prova a coluna que recebe o valor, não o valor. */
const RETRATO = 'https://exemplo.com.br/retratos/bruno.png';

/** Valores de segundo fator sem significado criptográfico: o caso prova o mapeamento, não o TOTP. */
const SEGREDO_DE_TESTE = 'segredo-totp-de-verificacao';
const CODIGOS_DE_TESTE = 'codigo-1,codigo-2';

/**
 * Instante em que o segundo fator fica trancado.
 *
 * Literal fixo no futuro, e não `agora + n`: a asserção compara com o valor **exato** que foi
 * escrito, então não há relógio no caminho — a regra do projeto proíbe espera temporal, que é a
 * origem clássica de instabilidade.
 */
const INSTANTE_DA_TRANCA = new Date('2099-06-01T12:00:00.000Z');

let identidade: IdentidadeEfemera;

beforeAll(async () => {
  identidade = await identidadeEfemera();
});

afterAll(async () => {
  await identidade?.parar();
});

describe('T6 §4-3 — todo campo dos modelos do arcabouço tem coluna em português', () => {
  it('atualizar a pessoa grava o nome e move `atualizado_em`', async () => {
    const banco = identidade.acesso.identidade;
    const contexto = await identidade.autenticacao.$context;
    const { usuario } = esquemaIdentidade;

    const antes = await lerPessoa(PESSOA.id);
    expect(antes.nome).not.toBe(NOME_NOVO);
    // O estado inicial das duas colunas novas, dito por extenso: elas existem e nascem no padrão
    // que o modelo do arcabouço declara.
    expect(antes.emailVerificado).toBe(false);
    expect(antes.imagem).toBeNull();

    // Recua `atualizado_em` para que o avanço seja observável sem esperar relógio nenhum — mesmo
    // recurso que `sessao.spec.ts` usa para a renovação, e pela mesma razão.
    const recuado = new Date(antes.atualizadoEm.getTime() - 60_000);
    await banco.update(usuario).set({ atualizadoEm: recuado }).where(eq(usuario.id, PESSOA.id));

    // O caminho que a T7 e a T8 vão usar. O adaptador acrescenta `updatedAt` a TODO update — é
    // este campo, e não o nome, que derrubava o verbo inteiro antes da migração `0002`.
    await contexto.internalAdapter.updateUser(PESSOA.id, { name: NOME_NOVO });

    const depois = await lerPessoa(PESSOA.id);
    expect(depois.nome).toBe(NOME_NOVO);
    // O par que discrimina: o nome provou que o update aconteceu; o instante prova que o campo
    // ACRESCENTADO pelo adaptador chegou à coluna certa, em vez de ter sido descartado.
    expect(depois.atualizadoEm.getTime()).toBeGreaterThan(recuado.getTime());
  });

  it('criar o registro de segundo fator grava as colunas que o plugin escreve sozinho', async () => {
    const contexto = await identidade.autenticacao.$context;

    // A chamada literal que o plugin de segundo fator faz ao ligar o TOTP (T10).
    await contexto.adapter.create({
      model: 'twoFactor',
      data: {
        userId: PESSOA.id,
        secret: SEGREDO_DE_TESTE,
        backupCodes: CODIGOS_DE_TESTE,
        verified: false,
      },
    });

    // Igualdade do conjunto de colunas, e não "a linha existe": um mapeamento que apontasse
    // `verified` para outra coluna, ou que perdesse o padrão de `falhas_verificacao`, reprova aqui.
    expect(await lerDoisFatores()).toEqual([
      {
        usuarioId: PESSOA.id,
        segredo: SEGREDO_DE_TESTE,
        codigosRecuperacao: CODIGOS_DE_TESTE,
        verificado: false,
        falhasVerificacao: 0,
        bloqueadoAte: null,
      },
    ]);

    // ------------------------------------------------------------------------------------------
    // Segunda fase — `bloqueado_ate`, o campo do plugin que a CRIAÇÃO não alcança
    // ------------------------------------------------------------------------------------------
    //
    // Ele não tem padrão declarado no plugin, então não viaja na carga de criação: o `null` que a
    // igualdade acima observa é inércia da coluna, e continuaria lá com o mapeamento removido. Quem
    // o escreve é o plugin, por ATUALIZAÇÃO, ao trancar o segundo fator por confirmações erradas
    // demais — a chamada abaixo é essa, pelo mesmo adaptador.
    //
    // A asserção é sobre a coluna ter se MOVIDO, e nunca sobre a ausência de erro: na atualização o
    // adaptador não confere campo por coluna (medido contra o pacote publicado), de modo que um
    // mapeamento ausente aqui não levanta nada — a tranca não persiste e a proteção contra força
    // bruta no TOTP some em silêncio.
    await contexto.adapter.update({
      model: 'twoFactor',
      where: [{ field: 'userId', value: PESSOA.id }],
      update: { lockedUntil: INSTANTE_DA_TRANCA },
    });

    expect(await lerDoisFatores()).toEqual([
      {
        usuarioId: PESSOA.id,
        segredo: SEGREDO_DE_TESTE,
        codigosRecuperacao: CODIGOS_DE_TESTE,
        verificado: false,
        falhasVerificacao: 0,
        bloqueadoAte: INSTANTE_DA_TRANCA,
      },
    ]);
  });

  it('atualizar a pessoa informando confirmação e retrato move `email_verificado` e `imagem`', async () => {
    const contexto = await identidade.autenticacao.$context;

    // O "antes" não é enfeite: sem ele, um banco que já nascesse com os dois valores faria o caso
    // passar sem que nada tivesse atravessado o mapeamento.
    const antes = await lerPessoa(PESSOA_DO_RETRATO.id);
    expect(antes.emailVerificado).toBe(false);
    expect(antes.imagem).toBeNull();

    // Os dois campos são informados por quem chama — diferente de `atualizado_em`, que o arcabouço
    // acrescenta sozinho. É o caminho que a confirmação de endereço e a edição de perfil usarão.
    await contexto.internalAdapter.updateUser(PESSOA_DO_RETRATO.id, {
      emailVerified: true,
      image: RETRATO,
    });

    const depois = await lerPessoa(PESSOA_DO_RETRATO.id);
    // Valor exato nas duas, e não "mudou": um mapeamento cruzado (`image` apontando para a coluna
    // de confirmação, por exemplo) moveria as colunas e ainda assim reprova aqui.
    expect(depois.emailVerificado).toBe(true);
    expect(depois.imagem).toBe(RETRATO);
  });
});

/** As colunas de `identidade.usuario` que o modelo `user` alcança, da pessoa informada. */
async function lerPessoa(pessoaId: string): Promise<{
  nome: string;
  emailVerificado: boolean;
  imagem: string | null;
  atualizadoEm: Date;
}> {
  const { usuario } = esquemaIdentidade;

  const [linha] = await identidade.acesso.identidade
    .select({
      nome: usuario.nome,
      emailVerificado: usuario.emailVerificado,
      imagem: usuario.imagem,
      atualizadoEm: usuario.atualizadoEm,
    })
    .from(usuario)
    .where(eq(usuario.id, pessoaId));

  if (linha === undefined) {
    throw new Error(`a pessoa ${pessoaId} sumiu da carga inicial no meio do caso`);
  }

  return linha;
}

/** Toda linha de `identidade.dois_fatores`, sem o identificador nem o instante de criação. */
async function lerDoisFatores(): Promise<
  {
    usuarioId: string;
    segredo: string;
    codigosRecuperacao: string;
    verificado: boolean;
    falhasVerificacao: number;
    bloqueadoAte: Date | null;
  }[]
> {
  const { doisFatores } = esquemaIdentidade;

  return await identidade.acesso.identidade
    .select({
      usuarioId: doisFatores.usuarioId,
      segredo: doisFatores.segredo,
      codigosRecuperacao: doisFatores.codigosRecuperacao,
      verificado: doisFatores.verificado,
      falhasVerificacao: doisFatores.falhasVerificacao,
      bloqueadoAte: doisFatores.bloqueadoAte,
    })
    .from(doisFatores);
}
