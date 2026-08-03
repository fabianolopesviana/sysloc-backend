/**
 * O **alcance** de uma sessão com exigência pendente — a decisão que a T9 deixou marcada para cá.
 *
 * ---------------------------------------------------------------------------
 * A sessão restrita já EXISTE; o que esta task decide é o que ela alcança
 * ---------------------------------------------------------------------------
 *
 * A barreira de admissão (T7) **marca** a sessão restrita: `senhaProvisoriaPendente` e
 * `segundoFatorExigido` não recusam a entrada, eles registram que uma exigência ficou pendente. A
 * guarda de contexto (T9) carrega as duas para dentro da sessão do produto, porque `GET /v1/sessao`
 * precisa reportá-las. **Nenhuma das duas decide o que a sessão restrita alcança** — essa decisão é
 * esta, e ela mora aqui em vez de dentro da guarda pelo mesmo motivo que a barreira mora fora do
 * arcabouço: uma regra escrita no ponto onde ela é aplicada vira uma regra por ponto de aplicação.
 * Aqui é uma função pura, sem pedido, sem banco e sem relógio — o que a torna exercitável e a
 * mantém sendo **uma** definição.
 *
 * ---------------------------------------------------------------------------
 * O conjunto permitido é o que a guarda GOVERNA — e o resto não é omissão
 * ---------------------------------------------------------------------------
 *
 * A §5.2 da tech spec e o §3 do cartão da T10 dizem que a sessão restrita alcança três coisas:
 * `GET /v1/sessao`, a troca de senha e a configuração do segundo fator. Só a primeira aparece em
 * {@link ROTAS_DA_SESSAO_RESTRITA}, e a razão é topológica, não esquecimento:
 *
 *   * as outras duas vivem sob `/v1/auth`, que a T8 publicou por um encaminhador `@All('*')`
 *     marcado `@RotaPublica()` — a guarda **retorna antes** de resolver sessão para elas, de modo
 *     que nada nesta função é consultado no caminho delas. Listá-las aqui produziria um ramo que
 *     nenhuma execução alcança, e um ramo inalcançável mente sobre onde a decisão é tomada;
 *   * que elas de fato atendem à sessão restrita é afirmado por comportamento, e não por esta
 *     lista: o CT-021 troca a senha com o cookie da sessão restrita e o CT-019 configura o segundo
 *     fator com ela.
 *
 * **Risco residual, nomeado.** A marca `@RotaPublica()` é do MANIPULADOR, e o encaminhador é um só:
 * a sessão restrita alcança, portanto, toda a superfície que o arcabouço publica sob `/v1/auth` —
 * inclusive rotas de autosserviço como `update-user` e `list-sessions`, que o `CT-018 (d)` da T8
 * inventaria e o **D26** registra como conjunto a decidir antes do congelamento da API. Isso **não**
 * é a janela de privilégio que esta task fecha: aquelas rotas são de identidade da própria pessoa,
 * autoescopadas pela sessão dela, e **nenhum dado de negócio** é alcançável por elas — o que a
 * sessão restrita não alcança é exatamente o que a RLS protege, e é o que o CT-019 e o CT-021
 * afirmam com a rota de negócio em `403`. Fechar o resíduo exigiria resolver sessão em rota pública
 * e manter uma lista de exceções dentro de `/v1/auth`, que é a topologia que a T8 rejeitou por
 * escrito, e a decisão sobre aquele conjunto já tem dono declarado (fatia de fechamento da F1).
 *
 * ---------------------------------------------------------------------------
 * Por que o caminho da rota de sessão é literal aqui
 * ---------------------------------------------------------------------------
 *
 * Importar `CAMINHO_DA_SESSAO` de `sessao.controller.ts` fecharia um **ciclo de módulos**:
 * `sessao.controller` → `contexto.guard` (de onde ele lê a sessão da requisição) → `sessao-restrita`
 * → `sessao.controller`. Num ciclo, o módulo que começar a avaliar primeiro entrega ao outro uma
 * ligação ainda não inicializada, e a constante de topo abaixo quebraria na carga — dependendo da
 * ordem em que a composição raiz importa os controladores, que não é propriedade que se queira
 * amarrar.
 *
 * O literal é amarrado ao dono por **duas** provas, e não por convenção: o CT-021 compara esta
 * lista, por igualdade, com o caminho composto a partir de `CAMINHO_DA_SESSAO` (asserção estática),
 * e afirma que `GET /v1/sessao` **não** responde `403` numa sessão restrita (asserção
 * comportamental). Divergir do dono reprova as duas.
 */

import { RESTRICOES_DE_SESSAO, type RestricaoDeSessao } from '@sysloc/auth';
import { PREFIXO_DE_VERSAO } from '../configuracao/ambiente.js';

/**
 * O que esta decisão lê da sessão, e nada além disso.
 *
 * Declarado por estrutura, e não importado de `contexto.guard.ts`: a sessão do produto satisfaz
 * este tipo por ter os dois campos, e declará-lo aqui evita que este módulo dependa da guarda que o
 * consome. O tipo é fechado pelo mesmo motivo que `EstadoDeAdmissao` é — acrescentar um dado à
 * decisão obriga a acrescentá-lo aqui, o que torna visível, no tipo, o que o alcance passou a
 * depender.
 */
export interface ExigenciasDaSessao {
  /** A senha em uso ainda é a provisória (RN-09). */
  readonly senhaProvisoria: boolean;
  /** O segundo fator é exigido desta pessoa e ainda não está ativo (RN-08). */
  readonly segundoFatorPendente: boolean;
}

/**
 * O desfecho da decisão.
 *
 * União discriminada, como o `Admissao` da barreira: é impossível recusar sem mensagem, e
 * impossível montar a mensagem de uma sessão que passa. A mensagem sai pronta daqui porque quem a
 * compõe é quem sabe **quais** exigências ficaram pendentes — a guarda só a repassa.
 */
export type AlcanceDaSessao =
  | { readonly permite: true }
  | { readonly permite: false; readonly mensagem: string };

/**
 * Como cada exigência é lida da sessão.
 *
 * `Record<RestricaoDeSessao, …>` sobre o vocabulário que a barreira publica: uma restrição nova em
 * `@sysloc/auth` **não compila** aqui até ganhar leitura, em vez de silenciosamente deixar de
 * restringir. É a mesma forma do `DESFECHO_POR_MOTIVO` de `packages/auth/src/autenticacao.ts`.
 */
const PENDENCIA_POR_RESTRICAO: Readonly<
  Record<RestricaoDeSessao, (exigencias: ExigenciasDaSessao) => boolean>
> = {
  SENHA_PROVISORIA: (exigencias) => exigencias.senhaProvisoria,
  SEGUNDO_FATOR: (exigencias) => exigencias.segundoFatorPendente,
};

/**
 * O que falta cumprir, dito ao cliente — a parte da mensagem que **nomeia a exigência pendente**.
 *
 * A §10.1 da tech spec fixa que a mensagem de `ACESSO_NEGADO` nomeie a exigência, e o §3 do cartão
 * diz por quê: *"recusar sem dizer o que falta deixaria a pessoa presa sem saber por quê"*. É esta
 * tabela que faz a recusa desta guarda ser mais específica que a mensagem padrão do filtro global
 * (`'acesso negado para esta sessão'`), que continua valendo para quem levantar o código sem
 * mensagem própria.
 *
 * Os textos **não** citam pessoa, empresa nem endereço: a recusa é lida por quem já está
 * autenticado, mas a mesma cadeia vai para o registro estruturado, e uma mensagem que carregasse
 * identificador nasceria como vazamento por linha de journal.
 */
const CUMPRIMENTO_POR_RESTRICAO: Readonly<Record<RestricaoDeSessao, string>> = {
  SENHA_PROVISORIA: 'a troca da senha provisória',
  SEGUNDO_FATOR: 'a configuração do segundo fator',
};

/** Abertura da mensagem de recusa. O que vem depois é a lista de exigências pendentes. */
const ABERTURA_DA_RECUSA = 'acesso negado: esta sessão está restrita até ';

/** Conector entre duas exigências pendentes na mesma mensagem. */
const CONECTOR_DE_EXIGENCIAS = ' e ';

/**
 * As rotas que uma sessão restrita alcança **entre as que a guarda governa**.
 *
 * Hoje é uma só, e o cabeçalho deste arquivo explica por que as outras duas do §3 do cartão não
 * estão aqui. Quando a fatia `autorizacao-e-ciclo-de-acesso` publicar rotas do produto para trocar
 * a senha e configurar o segundo fator — que serão protegidas, e não públicas —, elas entram nesta
 * lista, e é esta lista que decide.
 *
 * Exportada para que o CT-021 a compare, por igualdade, com o caminho composto a partir do dono do
 * segmento (`CAMINHO_DA_SESSAO`, em `sessao.controller.ts`).
 */
export const ROTAS_DA_SESSAO_RESTRITA: readonly string[] = [`/${PREFIXO_DE_VERSAO}/sessao`];

/**
 * Decide se a sessão alcança a rota, e monta a recusa quando não alcança.
 *
 * Sessão sem exigência pendente alcança tudo o que a guarda liberar — esta função **não** é um
 * segundo controle de acesso, e não conhece perfil: a matriz de telas e ações é da fatia
 * `autorizacao-e-ciclo-de-acesso` (§11.2). Ela responde a uma pergunta só: *"esta sessão ainda deve
 * algo antes de operar?"*.
 *
 * A rota chega como **padrão casado** pelo roteador (`/v1/sessao`), e não como o alvo bruto do
 * pedido: é o mesmo valor que o filtro global grava no journal, ele já vem sem cadeia de consulta, e
 * comparar padrões evita que um parâmetro de rota mude o resultado da comparação. Padrão que não
 * esteja na lista **recusa** — o default é fechado, como o da guarda.
 */
export function sessaoRestritaPermite(
  exigencias: ExigenciasDaSessao,
  rota: string,
): AlcanceDaSessao {
  const pendentes = RESTRICOES_DE_SESSAO.filter((restricao) =>
    PENDENCIA_POR_RESTRICAO[restricao](exigencias),
  );

  if (pendentes.length === 0 || ROTAS_DA_SESSAO_RESTRITA.includes(rota)) {
    return { permite: true };
  }

  return {
    permite: false,
    mensagem:
      ABERTURA_DA_RECUSA +
      pendentes
        .map((restricao) => CUMPRIMENTO_POR_RESTRICAO[restricao])
        .join(CONECTOR_DE_EXIGENCIAS),
  };
}
