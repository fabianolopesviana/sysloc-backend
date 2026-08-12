/**
 * Automação de cobrança — a regra de aplicação das **quatro** rotas de `/v1/automacao-de-cobranca`:
 * ler a política de aviso da empresa, defini-la, disparar o aviso de uma cobrança e ler o histórico
 * de tentativas dela.
 *
 * ---------------------------------------------------------------------------
 * ELE NÃO DECIDE QUEM É AVISADO, e a ausência é o que o separa da régua
 * ---------------------------------------------------------------------------
 *
 * **Não existe neste arquivo uma comparação de horário, um teste de estado, uma escolha de molde de
 * mensagem ou uma seleção de candidata.** Quem decide *se* aquela cobrança pode ser avisada é
 * `enviarAvisoDeCobranca`, em `@sysloc/regua` — a **mesma** função de admissão por onde passa a
 * passagem automática —, e quem decide *quem* entra na passagem é o predicado do banco
 * (`packages/db/src/envio-de-cobranca.ts`).
 *
 * A unicidade não é elegância: é a rede do **REG-08**. No sistema antigo, o caminho automático e o
 * manual decidem o mesmo fato e **discordam** — para a cobrança cancelada e vencida, um resolve
 * *"Fechada"* e não avisa, o outro resolve *"Vencida"* e cobra dívida cancelada. Um `if` de estado
 * escrito aqui seria essa divergência renascendo, agora dentro do produto: ele concordaria com o
 * automático hoje e divergiria na primeira emenda de um dos dois. Por isso o que este arquivo faz com
 * a recusa é **traduzi-la** — de `ErroDeEstadoNaoAvisavel` para o `422` da ADR-0017 —, nunca
 * reproduzi-la.
 *
 * O que este arquivo também **não** faz é conferir janela, intervalo ou recorte de dias: os três são
 * eixos de **oportunidade**, o disparo manual dispensa os três (RD-07), e a dispensa viaja como
 * **parâmetro** ({@link DISPENSAS_DO_DISPARO_MANUAL}) em vez de como um segundo trecho de código.
 *
 * ---------------------------------------------------------------------------
 * ELE RECEBE O EXECUTOR, E NÃO ABRE UNIDADE PRÓPRIA (decisão D1)
 * ---------------------------------------------------------------------------
 *
 * Os quatro métodos tomam o `tx` de quem já abriu a unidade de trabalho — o controlador. Nenhum deles
 * chama `emUnidadeDeTrabalho`, e a **ausência de `AcessoAoBanco` no construtor** é o mecanismo: o
 * acesso ao banco não é injetado aqui, porque injetá-lo daria a este serviço exatamente a capacidade
 * que ele não pode ter. É a mesma decisão, com a mesma razão, de {@link ../mora/mora.service.js} e de
 * {@link ../cobrancas/cobranca.service.js}, e é a saída que o próprio marcador `DECISÃO FECHADA` de
 * `packages/db/src/unidade-de-trabalho.ts` aponta como preferível. **A decisão fechada não é
 * tocada.**
 *
 * ⚠️ O construtor que a T10 acrescenta recebe **uma coisa só, e não é o banco**: a porta de saída de
 * e-mail. Ela não abre transação, não alcança tabela nenhuma e não sabe o que é uma empresa — a
 * capacidade que ela dá é *"entregue esta mensagem a este endereço"*, e é justamente a capacidade que
 * o disparo manual precisa ter. Quem escolhe qual implementação chega aqui é a composição do módulo,
 * e a verificação a substitui pelo capturador **de fora**, sem que exista bandeira ou ramo no meio.
 *
 * ---------------------------------------------------------------------------
 * AS DUAS ROTAS DA POLÍTICA NÃO TRADUZEM ERRO, e a ausência é decisão (RD-03)
 * ---------------------------------------------------------------------------
 *
 * Não há `404` na leitura da política, e não pode haver: a empresa que nunca configurou recebe a
 * **régua desligada com `200`**, porque a ausência de linha e a régua explicitamente desligada são a
 * mesma coisa publicada. Um `404` faria esta rota discordar do que a **passagem da régua** faz na
 * mesma empresa — nada — e obrigaria o cliente a tratar como erro o estado inicial de toda empresa
 * nova.
 *
 * As **duas rotas de aviso** são o caso oposto, e a assimetria tem causa: ali existe um recurso
 * identificado no caminho (`:codigo`), e a cobrança que o contexto não alcança **é** ausência de
 * recurso. As duas causas dela — não existe, ou é de outra empresa — respondem o **mesmo** `404`,
 * byte a byte, e a indistinguibilidade não vem de um ramo escrito para igualá-las: vem de a política
 * do banco esconder a linha alheia, de modo que as duas chegam aqui como o mesmo `undefined`
 * (ADR-0008).
 *
 * Também não há tradução de conflito: a escrita é um `upsert`, e a única restrição de unicidade em
 * jogo — `politica_de_aviso_empresa_key` — é o **alvo** do `ON CONFLICT`, e não uma recusa que possa
 * chegar ao cliente. As faixas e a janela são conferidas no esquema, na borda, com o campo culpado
 * nomeado; os `CHECK` do banco são a rede para os caminhos de escrita que não passam pela rota.
 *
 * ---------------------------------------------------------------------------
 * ELE ORQUESTRA — não escreve consulta, e não compara empresa
 * ---------------------------------------------------------------------------
 *
 * Toda instrução sobre `negocio.politica_de_aviso` vive em `packages/db/src/politica-de-aviso.ts`,
 * publicada como função de domínio — a razão é a enumerabilidade, e está por extenso no cabeçalho
 * daquele arquivo. E não existe, em lugar algum deste, uma comparação de empresa: o `empresa_id` sai
 * do contexto que a guarda publicou a partir da sessão, e nunca do corpo (ADR-0008).
 */

import { Inject, Injectable } from '@nestjs/common';
import type {
  EnvelopeDeLista,
  EnvioDeCobranca,
  Janela,
  PoliticaDeAviso,
  PoliticaDeAvisoNova,
} from '@sysloc/contracts';
import {
  contarEnviosDaCobranca,
  gravarPoliticaDeAviso,
  lerEnviosDaCobranca,
  lerPoliticaDeAviso,
  localizarCandidataAoAviso,
  localizarCobranca,
  registrarEnvioDeCobranca,
} from '@sysloc/db';
import {
  DISPENSAS_DO_DISPARO_MANUAL,
  ErroDeEstadoNaoAvisavel,
  enviarAvisoDeCobranca,
  type PortaDeEnvioDeEmail,
} from '@sysloc/regua';
import { CodigoErro, ErroDeAplicacao } from '@sysloc/shared';
import type { TransactionSql } from 'postgres';
import { MENSAGEM_POR_CODIGO } from '../comum/filtro-excecao.js';
import { TOKEN_PORTA_DE_EMAIL } from '../configuracao/ambiente.js';

/** A página do histórico, na forma canônica de lista da ADR-0017. */
export type PaginaDeEnvios = EnvelopeDeLista<EnvioDeCobranca>;

/**
 * O campo que a recusa por estado terminal nomeia, como o cliente o conhece (camelCase, ADR-0017).
 *
 * É `codigo`, e **não** `status`: o cliente não envia estado algum a esta rota — o corpo do disparo é
 * vazio e fechado —, e o único dado da requisição que identifica o alvo da recusa é o código no
 * caminho. Nomear `status` apontaria para um campo que não existe em requisição nenhuma desta
 * superfície. É a mesma escolha, pela mesma razão, de `exigirEstado` em
 * {@link ../cobrancas/cobranca.service.js}.
 */
const CAMPO_DO_CODIGO = 'codigo';

/**
 * O nome do discriminador que a recusa por estado publica dentro de `detalhes`.
 *
 * É o **mesmo** que as transições de cobrança e de contrato já publicam, e a coincidência é
 * deliberada: as três recusas descrevem o mesmo fato — *o recurso está num estado que não admite o
 * ato pedido* —, e um terceiro nome para a mesma classe faria o cliente aprender dois vocabulários
 * para tratar uma coisa só. Constante nomeada porque é **contrato publicado**, afirmado por igualdade
 * de corpo inteiro no `CT-630`.
 *
 * Não há aqui um `transicaoPedida` ao lado, e a ausência é conteúdo: o disparo manual **não é
 * transição de estado** — ele não move `status` —, e publicar o nome de uma transição inventada
 * descreveria o ato errado. A ADR-0021 alcança esta rota pela cláusula de **ato de negócio governado
 * pela natureza**, não pela de transição.
 */
const DISCRIMINADOR_DO_ESTADO = 'estadoAtual';

@Injectable()
export class AutomacaoDeCobrancaService {
  // O construtor recebe UMA coisa, e ela não é o banco: ver o cabeçalho deste arquivo.
  constructor(@Inject(TOKEN_PORTA_DE_EMAIL) private readonly email: PortaDeEnvioDeEmail) {}

  /**
   * Lê a política de aviso vigente na empresa do contexto.
   *
   * A empresa que nunca configurou devolve a régua **desligada**, e **nenhuma linha nasce** desta
   * leitura: a tradução da ausência acontece na porta, sem escrita. Um `GET` que criasse a linha
   * desligada mudaria o que ele mede, e a primeira leitura de toda empresa passaria a ser uma
   * escrita.
   */
  async lerPolitica(tx: TransactionSql): Promise<PoliticaDeAviso> {
    return await lerPoliticaDeAviso(tx);
  }

  /**
   * Define a política da empresa do contexto e devolve a que passou a valer.
   *
   * A entrada é o corpo **completo** — os seis campos, nenhum opcional —, de modo que o que se grava
   * é um estado final inteiro, e não uma fusão com o que havia antes. É isso que torna a escrita
   * exprimível como um `upsert` de um comando só, é isso que faz "última escrita vence" ser a
   * semântica correta sob concorrência, e é isso que torna a rota **idempotente por construção**.
   */
  async definirPolitica(
    tx: TransactionSql,
    entrada: PoliticaDeAvisoNova,
  ): Promise<PoliticaDeAviso> {
    return await gravarPoliticaDeAviso(tx, entrada);
  }

  /**
   * Dispara **um** aviso a pedido de quem tem a conjunção, e devolve a linha do registro.
   *
   * ---------------------------------------------------------------------------
   * A ORDEM DOS TRÊS PASSOS É CONTEÚDO
   * ---------------------------------------------------------------------------
   *
   * 1. **Localizar** — a cobrança que o contexto não alcança vira `404` aqui, antes de qualquer
   *    tentativa. A leitura é da **mesma** `negocio.cobranca_derivada` que o automático consulta, com
   *    a mesma projeção (RD-01), e ela **não** recorta estado: a cobrança paga ou cancelada chega ao
   *    domínio, e é lá que ela é recusada — filtrá-la na consulta a transformaria em `404`, e o
   *    operador ouviria *"essa cobrança não existe"* onde a resposta certa é *"ela está cancelada"*.
   * 2. **Admitir e entregar** — `enviarAvisoDeCobranca` aplica o teste de admissão único, com os três
   *    eixos de oportunidade dispensados por parâmetro, compõe a mensagem e entrega pela porta.
   * 3. **Registrar** — toda tentativa deixa linha (RD-08), inclusive a que não saiu. Quem grava é a
   *    porta de dados, na **mesma** unidade de trabalho que o controlador abriu.
   *
   * ---------------------------------------------------------------------------
   * A FALHA DE ENTREGA NÃO É ERRO DESTA REQUISIÇÃO
   * ---------------------------------------------------------------------------
   *
   * O desfecho `FALHOU` volta em `200`, com a causa. **Não há aqui um `catch` que o converta em
   * `502`**, e a ausência é a decisão: o pedido do operador foi atendido — a tentativa foi feita e
   * registrada —, e o que fracassou foi a comunicação com terceiro. Um erro esconderia dele o `id` do
   * registro que ele precisa para consultar o histórico, e faria a rota mentir sobre o que aconteceu:
   * a linha existe.
   *
   * **A recusa por estado é a única traduzida**, e ela é reconhecida pelo **tipo**
   * ({@link ErroDeEstadoNaoAvisavel}), nunca por casamento de texto: o estado viaja em campo, e é
   * esse valor — o mesmo que o compositor recusou — que sai em `detalhes.estadoAtual`. Toda outra
   * falha atravessa intacta, porque traduzir em bloco atribuiria à requisição do cliente uma recusa
   * que ele não causou.
   */
  async dispararAviso(tx: TransactionSql, codigo: string): Promise<EnvioDeCobranca> {
    const candidata = await localizarCandidataAoAviso(tx, codigo);

    if (candidata === undefined) {
      throw new ErroDeAplicacao(
        CodigoErro.RECURSO_NAO_ENCONTRADO,
        MENSAGEM_POR_CODIGO[CodigoErro.RECURSO_NAO_ENCONTRADO],
      );
    }

    try {
      return await enviarAvisoDeCobranca({
        candidata,
        // A dispensa é o objeto congelado que o domínio publica, e não um literal montado aqui: uma
        // segunda montagem seria livre para dispensar um eixo a mais, e nenhum dos três alcança o
        // ESTADO — que é o que nenhum caminho dispensa (RD-02).
        dispensas: DISPENSAS_DO_DISPARO_MANUAL,
        // A aplicação parcial acontece AQUI, sobre a unidade que a borda abriu: o domínio recebe uma
        // porta sem transação e sem empresa, e não há por onde uma empresa ser escolhida abaixo desta
        // linha.
        registrar: async (tentativa) => await registrarEnvioDeCobranca(tx, tentativa),
        email: this.email,
      });
    } catch (erro) {
      if (!(erro instanceof ErroDeEstadoNaoAvisavel)) {
        throw erro;
      }

      throw new ErroDeAplicacao(
        CodigoErro.CAMPO_INVALIDO,
        MENSAGEM_POR_CODIGO[CodigoErro.CAMPO_INVALIDO],
        {
          campo: CAMPO_DO_CODIGO,
          detalhes: { [DISCRIMINADOR_DO_ESTADO]: erro.estado },
        },
      );
    }
  }

  /**
   * Lê uma página do histórico de tentativas de uma cobrança, da mais recente para a mais antiga.
   *
   * **A existência é conferida antes**, e a conferência não é redundante: `lerEnviosDaCobranca`
   * devolve a lista vazia tanto para a cobrança sem histórico quanto para a que o contexto não
   * alcança, e as duas são fatos diferentes — uma é `200` com zero itens, a outra é `404`. Sem esta
   * leitura, o histórico de qualquer código bem formado responderia `200`, e a rota viraria um
   * oráculo silencioso: *"existe e nunca foi avisada"* é a resposta que ela daria sobre cobrança de
   * outra empresa.
   *
   * A página e o total correm na **mesma unidade de trabalho**, pela razão que `listarCobrancas`
   * registra: lidos em transações diferentes, o total poderia descrever um conjunto do qual a página
   * já não faz parte, e o cliente paginaria sobre dois retratos.
   */
  async lerHistorico(tx: TransactionSql, codigo: string, janela: Janela): Promise<PaginaDeEnvios> {
    const cobranca = await localizarCobranca(tx, codigo);

    if (cobranca === undefined) {
      throw new ErroDeAplicacao(
        CodigoErro.RECURSO_NAO_ENCONTRADO,
        MENSAGEM_POR_CODIGO[CodigoErro.RECURSO_NAO_ENCONTRADO],
      );
    }

    // Sequenciais, e não concorrentes: a unidade de trabalho é **uma conexão**, e duas consultas em
    // voo sobre ela seriam serializadas pelo driver na melhor das hipóteses. É a mesma forma de
    // `listarCobrancas`.
    const itens = await lerEnviosDaCobranca(tx, codigo, janela);
    const total = await contarEnviosDaCobranca(tx, codigo);

    return { itens: [...itens], total, limite: janela.limite, deslocamento: janela.deslocamento };
  }
}
