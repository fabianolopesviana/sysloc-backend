/**
 * Cadastro de pessoa — a regra de domínio dos três papéis, com o papel como **parâmetro**.
 *
 * ---------------------------------------------------------------------------
 * UM serviço para locador, locatário e fiador
 * ---------------------------------------------------------------------------
 *
 * Os três papéis têm hoje a **mesma forma** — um único `esquemaDePessoaNova` os confere, e uma única
 * porta parametrizada os grava —, e o que os separa é a rota. Três serviços iguais criariam três
 * fontes do mesmo fato, e a primeira emenda a um deles já as faria divergir; os casos de teste
 * seriam triplicados junto. Se um papel divergir no futuro (o locatário ganha a máquina de
 * verificação de e-mail na F5), a parametrização se abre **por composição, não por cópia**.
 *
 * O papel chega como {@link PapelDePessoa}, a união **fechada** que `@sysloc/db` publica: papel
 * inventado não é representável, e cada controlador da superfície fixa o seu ao chamar. Nenhum
 * método deste arquivo ramifica por papel — se ramificasse, a parametrização seria decoração sobre
 * três implementações escondidas.
 *
 * ---------------------------------------------------------------------------
 * ELE RECEBE O EXECUTOR, E NÃO ABRE UNIDADE PRÓPRIA (decisão D1)
 * ---------------------------------------------------------------------------
 *
 * Todos os métodos tomam o `tx` de quem já abriu a unidade de trabalho — o controlador. Nenhum deles
 * chama `emUnidadeDeTrabalho`, e é essa ausência que mantém possível a composição de mais de uma
 * escrita num **commit só**. Se cada serviço abrisse a própria unidade, a composição bateria em
 * `ErroDeUnidadeAninhada`, e a saída seria fundir serviços para satisfazer o mecanismo de transação
 * — a topologia às avessas. É a mesma decisão, com a mesma razão, de `imoveis/conjunto.service.ts`,
 * e é a saída que o próprio marcador `DECISÃO FECHADA` de `packages/db/src/unidade-de-trabalho.ts`
 * aponta como preferível. **A decisão fechada não é tocada.**
 *
 * ---------------------------------------------------------------------------
 * ELE ORQUESTRA — não escreve consulta, e não compara empresa
 * ---------------------------------------------------------------------------
 *
 * Toda instrução sobre `negocio.locador`, `negocio.locatario` e `negocio.fiador` vive em
 * `packages/db/src/cadastro-de-pessoa.ts`, publicada como função de domínio — e o **nome físico das
 * três tabelas não sai de lá**. A razão é a enumerabilidade: a contenção da §11.2 é de **tipo** e
 * não alcança texto de SQL, de modo que o que a mantém viva é não haver **onde** escrever a
 * instrução.
 *
 * Não existe, em lugar algum deste arquivo, uma comparação de empresa. O cadastro de outra empresa
 * não é achado — a política do banco o esconde —, e a ausência vira `404 RECURSO_NAO_ENCONTRADO` num
 * ponto único ({@link CadastroDePessoaService.exigir}). A recusa é consequência de **não achar**, não
 * de ter comparado (ADR-0008).
 *
 * ---------------------------------------------------------------------------
 * A CONFERÊNCIA DO DÍGITO VERIFICADOR ACONTECE AQUI, ANTES DE QUALQUER ESCRITA
 * ---------------------------------------------------------------------------
 *
 * A RN-04 exige que CPF e CNPJ sejam conferidos, e {@link conferirDocumento} (de `@sysloc/shared`) é
 * quem confere. Ela **não** mora no esquema de entrada de `@sysloc/contracts` por decisão declarada
 * no cabeçalho daquele pacote: ele é folha, e o frontend o importa sozinho — trazer a aritmética
 * para lá custaria a propriedade que o define.
 *
 * O valor que chega aqui **já vem em dígitos**: `esquemaDePessoaNova` remove a máscara na borda,
 * porque a máscara é assunto do cliente. A conferência corre, portanto, sobre o documento
 * normalizado, que é o que a §6.2 pede — e corre **antes** da chamada à porta, de modo que documento
 * inválido não deixa linha alguma para trás.
 *
 * Ela é **uma**, e é chamada pela criação e pela alteração: um `PUT` que trocasse o documento sem
 * conferir deixaria entrar pela alteração exatamente o que a criação recusa.
 *
 * A prova pela borda é o `CT-313`, na task que publica as rotas — é lá que a recusa vira `422` com
 * `campo: 'documentoPrincipal'` observável por HTTP.
 *
 * ---------------------------------------------------------------------------
 * A RECUSA POR UNICIDADE é traduzida AQUI, num ponto só
 * ---------------------------------------------------------------------------
 *
 * O vocabulário de erro é **fechado em sete códigos e não tem código de conflito**:
 * `STATUS_POR_CODIGO` é `Record<CodigoErro, number>`, de modo que acrescentar valor sem mapear status
 * não compila — e acrescentar código é decisão de contrato com efeito no handoff, não escolha de
 * implementação. A §10.1 da tech spec fixa, por isso, a forma da recusa: `422 CAMPO_INVALIDO` com
 * `campo: 'documentoPrincipal'` e o discriminador **`detalhes.conflito`** ∈
 * `{ EM_CIRCULACAO, RETIRADO_DE_CIRCULACAO }` — o mesmo nome, e o mesmo par de valores, que
 * `imoveis/imovel.service.ts` usa para o identificador municipal.
 *
 * O discriminador é o que decide o que o usuário faz em seguida — **reativar** o cadastro retirado que
 * ocupa o documento, ou **recadastrar** com outro. Sem ele, a recusa por um registro que o usuário nem
 * consegue ver na listagem seria indistinguível de um engano de digitação, e é justamente essa a
 * consequência que a ADR-0014 registra entre os *Cons*.
 *
 * **Sem esta tradução, o `23505` sobe cru.** `packages/db/src/cadastro-de-pessoa.ts` não o traduz por
 * decisão declarada (é o que torna observável, no `CT-349` e no `CT-352`, que o mecanismo da unicidade
 * é a restrição do banco), e `comum/filtro-excecao.ts` só reconhece `ErroDeAplicacao` e as exceções do
 * arcabouço — um erro do driver chegaria ao cliente como `500`. A composição das duas metades é
 * {@link CadastroDePessoaService.gravarTraduzindoConflito}, e ela é **uma**: duas ficariam livres para
 * divergir no código, no campo nomeado e no nome do discriminador, e os três são contrato publicado.
 */

import { Injectable } from '@nestjs/common';
import type { EnvelopeDeLista, Janela, Pessoa, PessoaNova } from '@sysloc/contracts';
import {
  alterarPessoa,
  criarPessoa,
  definirCirculacaoDaPessoa,
  ErroDeDocumentoEmUso,
  gravarCadastroSobRestricaoDeUnicidade,
  listarPessoas,
  localizarPessoa,
  type OpcoesDeCirculacao,
  type PapelDePessoa,
  type PessoaCadastrada,
} from '@sysloc/db';
import { CodigoErro, conferirDocumento, ErroDeAplicacao } from '@sysloc/shared';
import type { TransactionSql } from 'postgres';
import { MENSAGEM_POR_CODIGO } from '../comum/filtro-excecao.js';

/** A página de cadastros de pessoa, na forma canônica de lista da ADR-0017. */
export type PaginaDePessoas = EnvelopeDeLista<Pessoa>;

/**
 * O campo culpado da recusa por documento inválido, como o cliente o conhece (camelCase, ADR-0017).
 *
 * Constante nomeada, e não literal no ponto da recusa: ele é **contrato publicado** — o cliente o usa
 * para destacar o campo do formulário —, e as duas escritas o nomeiam.
 */
const CAMPO_DO_DOCUMENTO = 'documentoPrincipal';

/**
 * O nome do discriminador do conflito dentro de `detalhes`.
 *
 * Fixado pela §10.1 da tech spec **antes** da implementação, e não escolhido aqui. Ele é literal
 * também em `imoveis/imovel.service.ts`, e a rede que impede os dois de divergirem é o `CT-312`, que
 * compara os corpos de recusa das duas entidades e afirma que a chave discriminadora é a **mesma**:
 * um nome escolhido por conveniência de um lado faria a comparação reprovar por divergência de forma.
 */
const DISCRIMINADOR_DO_CONFLITO = 'conflito';

@Injectable()
export class CadastroDePessoaService {
  // Sem construtor, e a ausência é o ponto: o acesso ao banco **não** é injetado aqui, porque quem
  // abre a unidade de trabalho é o controlador (D1). Injetá-lo daria a este serviço exatamente a
  // capacidade que ele não pode ter — a de abrir a própria unidade.

  /**
   * Cria o cadastro no papel informado e devolve o corpo que a rota publica.
   *
   * A conferência do documento vem **antes** da gravação; a unicidade por empresa e por papel vem
   * **do banco**, na própria gravação, e nunca de uma leitura anterior a ela — ver o cabeçalho de
   * `packages/db/src/cadastro-de-pessoa.ts`.
   */
  async criar(tx: TransactionSql, papel: PapelDePessoa, entrada: PessoaNova): Promise<Pessoa> {
    this.exigirDocumentoValido(entrada.documentoPrincipal);

    return publicar(
      this.exigirGravada(
        await this.gravarTraduzindoConflito(
          tx,
          papel,
          entrada.documentoPrincipal,
          async (escrita) => await criarPessoa(escrita, papel, entrada),
        ),
      ),
    );
  }

  /**
   * Lê a página pedida do papel informado.
   *
   * O envelope é montado aqui, e a janela devolvida é a que foi **de fato servida** — não um eco do
   * que o cliente pediu. `total` é a contagem daquele papel na empresa inteira, e é ela que permite
   * ao cliente saber que existe uma página seguinte sem pedi-la (ADR-0017).
   *
   * As opções de circulação **atravessam** este serviço sem serem interpretadas: quem decide o que a
   * leitura enxerga é a porta, e reimplementar o predicado aqui é precisamente o que o `CT-348`
   * reprova na entidade irmã, chamando a porta diretamente.
   */
  async listar(
    tx: TransactionSql,
    papel: PapelDePessoa,
    janela: Janela,
    opcoes: OpcoesDeCirculacao,
  ): Promise<PaginaDePessoas> {
    const { pessoas, total } = await listarPessoas(tx, papel, janela, opcoes);

    return {
      itens: pessoas.map(publicar),
      total,
      limite: janela.limite,
      deslocamento: janela.deslocamento,
    };
  }

  /**
   * Lê o cadastro por identificador, dentro do papel informado.
   *
   * **Ela alcança o cadastro retirado de circulação**, e responde `200` com a marca preenchida — sem
   * isso a recirculação ficaria inalcançável pela interface, porque a rota que a executa é sobre o
   * mesmo `:id`.
   */
  async ler(tx: TransactionSql, papel: PapelDePessoa, id: string): Promise<Pessoa> {
    return publicar(this.exigir(await localizarPessoa(tx, papel, id)));
  }

  /**
   * Reescreve o cadastro com o corpo completo (§4.1.1) e devolve como ele ficou.
   *
   * O documento passa pela **mesma** conferência da criação: sem ela, o `PUT` seria a porta por onde
   * entraria o documento que a criação recusa.
   *
   * E pela **mesma** tradução de conflito: um `PUT` que aponte para um documento já ocupado por outro
   * cadastro do mesmo papel é a mesma colisão da criação, e responde a mesma coisa. Um caminho que só
   * tratasse a criação deixaria a alteração devolver `500` ao cliente.
   */
  async alterar(
    tx: TransactionSql,
    papel: PapelDePessoa,
    id: string,
    entrada: PessoaNova,
  ): Promise<Pessoa> {
    this.exigirDocumentoValido(entrada.documentoPrincipal);

    return publicar(
      this.exigir(
        await this.gravarTraduzindoConflito(
          tx,
          papel,
          entrada.documentoPrincipal,
          async (escrita) => await alterarPessoa(escrita, papel, id, entrada),
        ),
      ),
    );
  }

  /**
   * Retira o cadastro de circulação, ou o devolve a ela (ADR-0014).
   *
   * **Nada é apagado**: o que muda é a marca. A idempotência da retirada é da instrução da porta —
   * repetir preserva o instante da primeira —, e não de um ramo escrito aqui: um `if` antes da
   * escrita teria duas idas ao banco e uma corrida entre elas.
   */
  async definirCirculacao(
    tx: TransactionSql,
    papel: PapelDePessoa,
    id: string,
    emCirculacao: boolean,
  ): Promise<Pessoa> {
    return publicar(this.exigir(await definirCirculacaoDaPessoa(tx, papel, id, emCirculacao)));
  }

  /**
   * Recusa com `422` o documento cujo dígito verificador não confere — **ponto único** das duas
   * escritas.
   *
   * Nada do valor recusado entra na mensagem nem no corpo: a recusa da entrada de um cliente pelo
   * dado que ele enviou é exatamente o vetor que a §13.1 fecha, porque a mensagem alcança o registro
   * estruturado. O que o usuário precisa saber — qual campo — viaja em campo nomeado.
   */
  private exigirDocumentoValido(documentoPrincipal: string): void {
    if (!conferirDocumento(documentoPrincipal)) {
      throw new ErroDeAplicacao(
        CodigoErro.CAMPO_INVALIDO,
        MENSAGEM_POR_CODIGO[CodigoErro.CAMPO_INVALIDO],
        { campo: CAMPO_DO_DOCUMENTO },
      );
    }
  }

  /**
   * Traduz a ausência em `404` — **ponto único** das quatro rotas de `:id`, nos três papéis.
   *
   * É aqui, e em nenhum outro lugar, que a fronteira de tenant do cadastro vira resposta. Traduções
   * espalhadas ficariam livres para divergir no código e no status, e a forma do erro é contrato: o
   * cadastro de outra empresa responde `404` com o corpo **idêntico** ao do cadastro que não existe,
   * porque a borda não tem como distinguir os dois — e não deve ter. O identificador de **outro
   * papel** cai no mesmo `404`, pela mesma razão: a porta não o alcança.
   */
  private exigir(pessoa: PessoaCadastrada | undefined): PessoaCadastrada {
    if (pessoa === undefined) {
      throw new ErroDeAplicacao(
        CodigoErro.RECURSO_NAO_ENCONTRADO,
        MENSAGEM_POR_CODIGO[CodigoErro.RECURSO_NAO_ENCONTRADO],
      );
    }

    return pessoa;
  }

  /**
   * Grava traduzindo a recusa da restrição de unicidade — **ponto único** das duas escritas.
   *
   * As duas metades vêm de lugares distintos por decisão, e é aqui que elas se juntam:
   * `gravarCadastroSobRestricaoDeUnicidade` (de `@sysloc/db`) corre a escrita atrás de um `SAVEPOINT`
   * e devolve {@link ErroDeDocumentoEmUso} já discriminado; esta função o veste no envelope da
   * ADR-0017. O código é `CAMPO_INVALIDO` porque o vocabulário é fechado e **não tem código de
   * conflito**; o `422` sai do próprio código, e não é escolhido aqui.
   *
   * Nada do documento recusado entra no corpo nem na mensagem: a §13.1 fecha esse vetor, e o que o
   * usuário precisa saber — qual campo, e em que estado está o registro em conflito — viaja em campo
   * nomeado.
   */
  private async gravarTraduzindoConflito(
    tx: TransactionSql,
    papel: PapelDePessoa,
    documentoPrincipal: string,
    escrever: (escrita: TransactionSql) => Promise<PessoaCadastrada | undefined>,
  ): Promise<PessoaCadastrada | undefined> {
    try {
      return await gravarCadastroSobRestricaoDeUnicidade(tx, papel, documentoPrincipal, escrever);
    } catch (erro) {
      if (!(erro instanceof ErroDeDocumentoEmUso)) {
        throw erro;
      }

      throw new ErroDeAplicacao(
        CodigoErro.CAMPO_INVALIDO,
        MENSAGEM_POR_CODIGO[CodigoErro.CAMPO_INVALIDO],
        {
          campo: CAMPO_DO_DOCUMENTO,
          detalhes: { [DISCRIMINADOR_DO_CONFLITO]: erro.conflito },
          causa: erro,
        },
      );
    }
  }

  /**
   * A linha que a CRIAÇÃO devolveu, ou uma falha nomeada.
   *
   * Inalcançável por entrada de cliente: `criarPessoa` já levanta quando o `INSERT … RETURNING` não
   * devolve linha. O ramo existe porque o envoltório de unicidade tem tipo **concreto** — ele serve
   * também à alteração, que pode não alcançar o cadastro —, e um `as` no lugar dele trocaria uma falha
   * nomeada por um `undefined` viajando como se fosse um cadastro. Ele **não** é o `exigir` de cima: a
   * ausência aqui não é `404`, porque não há identificador que possa não existir.
   */
  private exigirGravada(pessoa: PessoaCadastrada | undefined): PessoaCadastrada {
    if (pessoa === undefined) {
      throw new Error('o cadastro de pessoa foi gravado e a linha não voltou da escrita');
    }

    return pessoa;
  }
}

/**
 * A linha persistida no corpo que o contrato publica — a **única** tradução das duas formas.
 *
 * `retiradoEm` sai como cadeia ISO-8601 em UTC, que é o que `esquemaDaPessoa` declara
 * (`z.iso.datetime()`); nulo continua nulo, e é ele que diz que o cadastro circula. Os demais campos
 * são copiados um a um, e não por espalhamento: o espalhamento publicaria qualquer coluna que a
 * projeção da porta venha a ganhar — inclusive `empresa_id`, que é justamente o que não pode sair.
 */
function publicar(pessoa: PessoaCadastrada): Pessoa {
  return {
    id: pessoa.id,
    nome: pessoa.nome,
    tipoPessoa: pessoa.tipoPessoa,
    documentoPrincipal: pessoa.documentoPrincipal,
    rg: pessoa.rg,
    email: pessoa.email,
    telefone: pessoa.telefone,
    logradouro: pessoa.logradouro,
    numero: pessoa.numero,
    complemento: pessoa.complemento,
    bairro: pessoa.bairro,
    cidade: pessoa.cidade,
    estado: pessoa.estado,
    cep: pessoa.cep,
    retiradoEm: pessoa.retiradoEm === null ? null : pessoa.retiradoEm.toISOString(),
  };
}
