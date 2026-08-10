/**
 * A superfície das seis rotas de cadastro de pessoa — **escrita uma vez**, montada por três papéis.
 *
 * ---------------------------------------------------------------------------
 * Por que existe: três controladores, e nenhuma linha de comportamento em triplicata
 * ---------------------------------------------------------------------------
 *
 * Locador, locatário e fiador têm a **mesma forma** — um esquema de entrada só, um serviço
 * parametrizado só (`CadastroDePessoaService`), uma porta de dados só. O que os separa é o caminho da
 * rota e o papel que cada controlador fixa. Escrever os três controladores por extenso produziria
 * dezoito manipuladores byte a byte iguais a não ser por um argumento, e a primeira emenda a um deles
 * já os faria divergir — que é literalmente o débito **D12** que esta mesma task fecha em
 * {@link ../comum/contexto-da-sessao.js}. Repeti-lo aqui, no mesmo diff, seria trocar de mão o mesmo
 * defeito.
 *
 * O que **não** é compartilhado, e a exclusão é decisão: os **decoradores**. Cada controlador declara
 * `@Controller`, `@ApiTags`, `@ExigeChave` e os seis decoradores de rota por extenso, no próprio
 * arquivo. Três razões, e as três já custaram rodada de gate nesta fatia:
 *
 *   * a exigência de autorização é auditada por **conteúdo** (`CT-355`, ADR-0018) sobre o metadado que
 *     cada classe e cada método declaram; um decorador aplicado por fábrica ou herdado de uma base
 *     tornaria a auditoria dependente de como a herança de metadado se comporta, em vez de do que
 *     está escrito;
 *   * `MANIPULADORES_EXAMINADOS_EM_PRODUCAO` conta manipuladores declarados, e a contagem tem de ser
 *     conferível por leitura do fonte;
 *   * a **armadilha da ADR-0018** mora exatamente nestes três controladores — a área da classe
 *     (`TELA:cadastros`) coincide com `MAPA_ACAO_TELA['ACAO:excluir_cadastro']`, e a substituição
 *     silenciosa seria invisível por comportamento. A conjunção inteira precisa estar escrita, e
 *     legível, em cada uma das seis rotas de circulação.
 *
 * ---------------------------------------------------------------------------
 * O que esta classe É, e o que ela não é
 * ---------------------------------------------------------------------------
 *
 * É um objeto simples, **sem decorador algum** e sem participação no contêiner de injeção: cada
 * controlador o constrói com o próprio papel e com as três dependências que já recebe. Não é
 * controlador-base, não é `@Injectable`, e não há herança em lugar nenhum — herança colocaria os
 * metadados de rota e de exigência num lugar diferente de onde eles são lidos.
 */

import type { Janela, Pessoa } from '@sysloc/contracts';
import {
  ESQUEMA_DO_IDENTIFICADOR,
  envelopeDeLista,
  esquemaDaJanelaComCirculacao,
  esquemaDaPessoa,
  esquemaDePessoaNova,
} from '@sysloc/contracts';
import type { AcessoAoBanco, PapelDePessoa } from '@sysloc/db';
import type { Logger } from '@sysloc/shared';
import type { FastifyRequest } from 'fastify';
import { sobContextoDaSessao } from '../comum/contexto-da-sessao.js';
import { ESQUEMA_DO_CORPO_VAZIO } from '../comum/esquema-de-corpo-vazio.js';
import { validar } from '../comum/validacao.js';
import type { CadastroDePessoaService, PaginaDePessoas } from './cadastro-de-pessoa.service.js';

/**
 * A área de tela que governa as três superfícies (§4.1, §11.2).
 *
 * Constante nomeada, e não literal repetido em nove decoradores: ela aparece na classe de cada
 * controlador **e** dentro da conjunção das duas rotas de circulação de cada um, e é justamente a
 * coincidência entre as três ocorrências que faz o "além disso" ser verdade.
 */
export const AREA_DO_CADASTRO = 'TELA:cadastros' as const;

/** A ação sensível que as seis rotas de circulação exigem **além** da área (ADR-0011, §4.1). */
export const ACAO_DE_CIRCULACAO = 'ACAO:excluir_cadastro' as const;

/**
 * Nome de campo usado quando a recusa não tem caminho a nomear — o identificador da rota.
 *
 * As três constantes deste bloco são **internas ao módulo**, sem `export`, pelo mesmo critério que
 * mantém os análogos de `imoveis/conjunto.controller.ts`, de `imovel.controller.ts` e de
 * `comodo.controller.ts` privados, e pelo mesmo que despublicou `MENSAGEM_POR_CODIGO` (T8 / Gate 2) e
 * `TABELA_POR_PAPEL`: símbolo publicado sem consumidor é caminho oferecido.
 *
 * ⚠️ **Eram quatro, e `ESQUEMA_DO_CORPO_VAZIO` saiu do bloco**: ele não é mais definido aqui — vem
 * importado de `comum/esquema-de-corpo-vazio.js`, que é o ponto único da borda (débito **D23**). O
 * risco que este parágrafo nomeava continua real e continua fechado pelo outro lado: um controlador
 * futuro que valide o corpo fechado por conta própria, em vez de delegar à superfície, é a
 * duplicação por ponto do **D12** — e agora ela é detectável, porque o `CT-357` afirma por igualdade
 * de conjunto quem define e quem importa o esquema.
 */
const CAMPO_DO_IDENTIFICADOR = 'id';

/** Nome de campo usado quando a recusa é do corpo e o Zod não tem caminho a nomear. */
const CAMPO_DO_CORPO = 'corpo';

/** Nome de campo usado quando a recusa é da cadeia de consulta. */
const CAMPO_DA_CONSULTA = 'limite';

// O corpo das rotas de circulação — **vazio e fechado** (§4.1.1) — é `ESQUEMA_DO_CORPO_VAZIO`,
// importado de `comum/esquema-de-corpo-vazio.js`. A marca de retirada é decidida pelo servidor e
// nenhum campo é aceito; a razão por extenso, e por que a definição é única, estão no docblock
// daquele módulo (débito D23). ⚠️ Esta era a QUINTA cópia, e o débito registrava duas.

/** O envelope de lista de cadastros, derivado do esquema do item — nunca redigitado (ADR-0017). */
export const ESQUEMA_DA_PAGINA = envelopeDeLista(esquemaDaPessoa);

/**
 * As descrições longas das seis rotas, **escritas uma vez** para os três papéis.
 *
 * Elas descrevem o contrato, e o contrato é o mesmo nos três: o que muda é o substantivo, que já está
 * no caminho e no `summary` de cada controlador. Três cópias divergiriam no primeiro ajuste de
 * redação, e o documento publicado passaria a descrever três contratos onde há um (ADR-0016).
 */
export const DESCRICOES = Object.freeze({
  criar:
    'O cadastro nasce na empresa **da sessão de quem cria** — a empresa nunca é aceita pelo corpo ' +
    '— e **em circulação**: `retiradoEm` sai nulo. O `documentoPrincipal` chega mascarado e é ' +
    'guardado só com dígitos; o **dígito verificador é conferido** (RN-04) e documento inválido ' +
    'responde `422` nomeando o campo, sem gravar linha alguma. O documento é único por empresa **e ' +
    'por papel** — a mesma pessoa pode ser locadora e fiadora da mesma empresa —, e a unicidade ' +
    '**alcança os cadastros retirados de circulação**: a recusa é `422` nomeando o campo, com ' +
    '`detalhes.conflito` dizendo se o cadastro em conflito está `EM_CIRCULACAO` ou ' +
    '`RETIRADO_DE_CIRCULACAO`.',
  listar:
    'Devolve apenas os cadastros **em circulação**; `incluirRetirados=true` alcança também os que ' +
    'foram retirados (ADR-0014). A janela é declarável por `limite` e `deslocamento`, e pedido ' +
    'acima do teto **recusa** em vez de truncar em silêncio.',
  ler:
    'Alcança também o cadastro **retirado de circulação**, que responde `200` com `retiradoEm` ' +
    'preenchido — sem isso a recirculação ficaria inalcançável pela interface. Cadastro de outra ' +
    'empresa, ou de outro papel, é indistinguível de inexistente: `404` com o mesmo corpo.',
  alterar:
    'O corpo é **completo**: não há atualização parcial nesta superfície, e campo ausente é recusa ' +
    'por campo obrigatório. O `documentoPrincipal` passa pela **mesma** conferência de dígito ' +
    'verificador e pela **mesma** unicidade da criação — sem isso, o `PUT` seria a porta por onde ' +
    'entraria o documento que a criação recusa. A marca de circulação não é tocada por esta rota.',
  retirar:
    '**Nada é apagado** (ADR-0014): o cadastro some dos seletores e continua legível por quem já o ' +
    'referencia — e continua ocupando o `documentoPrincipal` dele. A operação é **idempotente**: ' +
    'repetir mantém a MESMA marca e responde `200`. O corpo é vazio e fechado.',
  recircular:
    'Zera a marca de retirada. É o que torna a retirada reversível — e é por ela existir que a ' +
    'leitura por identificador alcança o cadastro retirado. É também a saída de quem recebeu ' +
    '`detalhes.conflito: RETIRADO_DE_CIRCULACAO` ao tentar recadastrar. O corpo é vazio e fechado.',
});

/**
 * As seis operações de um papel, com o papel **fixado na construção**.
 *
 * Cada método recebe a requisição e devolve o que a rota publica. A unidade de trabalho abre aqui, na
 * borda (decisão D1), por {@link sobContextoDaSessao} — o ponto único que os seis atravessam, e
 * nenhum abre unidade por conta própria: propriedade instalada por ponto sobrevive só até o ponto
 * seguinte.
 */
export class SuperficieDeCadastro {
  constructor(
    /** O papel que este controlador serve. Fixado uma vez, e nunca decidido pela requisição. */
    private readonly papel: PapelDePessoa,
    /** A porta única para transação — é dela que sai o executor que o serviço recebe. */
    private readonly banco: AcessoAoBanco,
    private readonly cadastros: CadastroDePessoaService,
    private readonly logger: Logger,
  ) {}

  /** `POST` da coleção. */
  async criar(corpo: unknown, requisicao: FastifyRequest): Promise<Pessoa> {
    const entrada = validar(esquemaDePessoaNova, corpo, CAMPO_DO_CORPO);

    return await sobContextoDaSessao(this.banco, requisicao, async (tx, sessao) => {
      const criado = await this.cadastros.criar(tx, this.papel, entrada);

      this.logger.info(
        { empresaId: sessao.empresaId, entidade: this.papel, id: criado.id },
        'cadastro criado',
      );

      return criado;
    });
  }

  /** `GET` da coleção. */
  async listar(consulta: unknown, requisicao: FastifyRequest): Promise<PaginaDePessoas> {
    // O esquema vem **inteiro** de `@sysloc/contracts`, que a ADR-0016 declara fonte única. A razão
    // de `incluirRetirados` ser união fechada de dois literais, e não `z.coerce.boolean()`, está por
    // extenso no docblock de `esquemaDaJanelaComCirculacao`.
    const { incluirRetirados, ...janela } = validar(
      esquemaDaJanelaComCirculacao,
      consulta,
      CAMPO_DA_CONSULTA,
    );

    return await sobContextoDaSessao(
      this.banco,
      requisicao,
      async (tx) =>
        await this.cadastros.listar(tx, this.papel, janela satisfies Janela, {
          incluirRetirados,
        }),
    );
  }

  /** `GET` de `:id`. */
  async ler(identificador: string, requisicao: FastifyRequest): Promise<Pessoa> {
    const id = validar(ESQUEMA_DO_IDENTIFICADOR, identificador, CAMPO_DO_IDENTIFICADOR);

    return await sobContextoDaSessao(
      this.banco,
      requisicao,
      async (tx) => await this.cadastros.ler(tx, this.papel, id),
    );
  }

  /** `PUT` de `:id`. */
  async alterar(
    identificador: string,
    corpo: unknown,
    requisicao: FastifyRequest,
  ): Promise<Pessoa> {
    const id = validar(ESQUEMA_DO_IDENTIFICADOR, identificador, CAMPO_DO_IDENTIFICADOR);
    const entrada = validar(esquemaDePessoaNova, corpo, CAMPO_DO_CORPO);

    return await sobContextoDaSessao(
      this.banco,
      requisicao,
      async (tx) => await this.cadastros.alterar(tx, this.papel, id, entrada),
    );
  }

  /**
   * As duas rotas de circulação, num ponto só — elas diferem em **um** valor.
   *
   * Escrever as duas por extenso deixaria livres para divergir a validação do identificador, a do
   * corpo fechado e a linha de trilha; e o que separa retirar de recircular é o sentido, que é
   * justamente o argumento.
   */
  async definirCirculacao(
    identificador: string,
    corpo: unknown,
    requisicao: FastifyRequest,
    emCirculacao: boolean,
  ): Promise<Pessoa> {
    const id = validar(ESQUEMA_DO_IDENTIFICADOR, identificador, CAMPO_DO_IDENTIFICADOR);
    validar(ESQUEMA_DO_CORPO_VAZIO, corpo ?? {}, CAMPO_DO_CORPO);

    return await sobContextoDaSessao(this.banco, requisicao, async (tx, sessao) => {
      const cadastro = await this.cadastros.definirCirculacao(tx, this.papel, id, emCirculacao);

      this.logger.info(
        {
          empresaId: sessao.empresaId,
          entidade: this.papel,
          id: cadastro.id,
          acao: emCirculacao ? 'recirculacao' : 'retirada',
        },
        'circulação de cadastro alterada',
      );

      return cadastro;
    });
  }
}
