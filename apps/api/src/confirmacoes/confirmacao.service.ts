/**
 * A confirmação do endereço de e-mail do locatário — **a borda do ato do titular**, que não tem
 * sessão e nunca terá.
 *
 * ---------------------------------------------------------------------------
 * A ORDEM DOS QUATRO PASSOS É O CONTEÚDO (§5.1-B.3 da tech spec)
 * ---------------------------------------------------------------------------
 *
 *   a) `derivarSegredo(segredo)` — o **ponto único** de derivação do produto, importado e nunca
 *      reescrito aqui: duas derivações do mesmo fato divergiriam na primeira emenda (uma passando a
 *      `base64url`, a outra ficando em `hex`) e o link deixaria de resolver sem que nada acusasse;
 *   b) `resolverPortador` — **fora de qualquer contexto de tenant**, porque a empresa é o
 *      **resultado** da resolução e não a entrada dela (ADR-0024). Zero linhas ⇒ `404`, e
 *      **nenhuma escrita acontece**;
 *   c) `contextoDeTenant.executarCom({ empresaId }, …)` — **uma vez**, com o valor que o portador
 *      resolveu;
 *   d) `consumirPortador`, na unidade de trabalho aberta sob esse contexto.
 *
 * ---------------------------------------------------------------------------
 * POR QUE ESTE SERVIÇO RECEBE `AcessoAoBanco` — a exceção é declarada, e é a da ADR-0024
 * ---------------------------------------------------------------------------
 *
 * A decisão D1 desta base manda a unidade de trabalho abrir **na borda**, e por isso os serviços de
 * domínio recebem o `tx` de quem já a abriu — `mora.service.ts`, `cobranca.service.ts` e
 * `contrato.service.ts` não têm construtor com acesso ao banco, e a ausência é o mecanismo. Aqui a
 * borda é **outra**, e por isso o arranjo também é:
 *
 *   * `sobContextoDaSessao` (o ponto único das rotas com sessão) **não se aplica**: ele lê a sessão
 *     que a guarda publicou, e nesta rota não há sessão nenhuma a ler;
 *   * são **duas** unidades de trabalho, e não uma — a primeira necessariamente **sem** contexto (é
 *     esse estado que a função `SECURITY DEFINER` existe para atravessar) e a segunda **sob** o
 *     contexto descoberto. Entre as duas há uma decisão de domínio: a recusa `404`. Um controlador
 *     que abrisse as duas teria de carregar essa decisão, que é justamente o que a camada de
 *     apresentação não pode conter.
 *
 * O molde é o de `apps/worker/src/tarefas/confirmacao-de-email.ts`, e não uma invenção: lá também a
 * borda **recebe** o acesso ao banco e abre o contexto uma vez, a partir de um identificador que não
 * veio de sessão. A ADR-0024 declara exatamente essa classe, e a §5.1-B.3 da tech spec e a §5.2 da
 * task nomeiam **este arquivo** como o dono da sequência.
 *
 * ⚠️ **Este é o TERCEIRO chamador de `contextoDeTenant.executarCom` em produção**, e o crescimento é
 * auditado por igualdade em `packages/db/test/unidade-de-trabalho.spec.ts` (`CT-014`) e em
 * `packages/db/test/fonte-unica-do-estado.spec.ts` (`CT-624`) — um chamador novo **reprova nomeando
 * o arquivo** até que a lista seja revisada por escrito. É o mecanismo funcionando, e não um
 * contorno dele.
 *
 * ---------------------------------------------------------------------------
 * O `undefined` DO CONSUMO TEM TRÊS CAUSAS, E NENHUMA DELAS GANHA RAMO (RN-10, RN-14)
 * ---------------------------------------------------------------------------
 *
 * `consumirPortador` devolve `undefined` quando o portador já foi consumido (a reapresentação da
 * RN-10), quando foi **invalidado** entre resolver e consumir (um reenvio que comitou na janela) e
 * quando **venceu** entre resolver e consumir. As três produzem o **mesmo** `200 { confirmado: true }`
 * — e aqui elas nem chegam a ser observadas: o retorno do consumo **não é lido**, e a ausência de
 * leitura é o mecanismo. Não existe ramo a esquecer, a inverter ou a reordenar.
 *
 * É o que impede a **pré-visualização de link** feita pelo provedor de e-mail de queimar a
 * confirmação antes de o locatário clicar: quem chega depois recebe sucesso, e nada é reescrito —
 * `email_confirmado_em` guarda o instante do **primeiro** consumo (ADR-0022).
 *
 * ⚠️ **Nada disto autoriza `AND p.consumido_em IS NULL` na função `SECURITY DEFINER`.** Aquela linha
 * daria a indistinguibilidade "de graça" e **quebraria a RN-10**, devolvendo `404` à reapresentação;
 * a `DECISÃO FECHADA — T3` de `packages/db/migracoes/0014_seguranca_confirmacao.sql` governa a
 * **resolução** e permanece intocada. Uso único é o **efeito**, imposto pelo `UPDATE … WHERE
 * consumido_em IS NULL RETURNING`, nunca a resolução (§21.3 (2) da tech spec).
 *
 * ---------------------------------------------------------------------------
 * A RECUSA É `RECURSO_NAO_ENCONTRADO`, E O REGISTRO OBEDECE À RN-14 TANTO QUANTO A RESPOSTA
 * ---------------------------------------------------------------------------
 *
 * `REQUISICAO_RECUSADA` **não** é levantado aqui, e a proibição é literal: o `DECISÃO FECHADA` de
 * `../comum/filtro-excecao.js` declara que ele é *"código de FECHO daquele filtro, não código de
 * negócio levantável"*. `RECURSO_NAO_ENCONTRADO` é a escolha certa por mérito próprio: ele é
 * **honesto** (não existe portador utilizável com este segredo) e **indistinguível por construção**
 * — os três casos que a RN-14 manda não separar produzem literalmente o mesmo corpo, sem que ninguém
 * precise se lembrar de mantê-los iguais.
 *
 * O registro segue a mesma regra: `motivo: 'nao-resolvido'` é **constante, sempre**. Registrar
 * `'vencido'` × `'invalido'` abriria pela lateral exatamente o que a resposta fecha, para quem tem o
 * journal — que é o operador da plataforma. E é `info`, não `warn`: link vencido é operação normal.
 *
 * ⚠️ **O segredo em claro não entra em registro nenhum**, nem o derivado. A chave `segredo` já está
 * na lista de radicais redigidos de `packages/shared/src/log.ts`; esta é a segunda barreira — não
 * passar o valor adiante.
 *
 * ---------------------------------------------------------------------------
 * ELE ORQUESTRA — não escreve consulta, e não compara empresa
 * ---------------------------------------------------------------------------
 *
 * Toda instrução sobre `negocio.portador_de_confirmacao` vive em
 * `packages/db/src/portador-de-confirmacao.ts`, publicada como função de domínio. Não existe aqui um
 * `WHERE empresa_id`, e não pode existir: quem recorta é a política do banco (ADR-0008), e o
 * contexto que ela consulta é o que o passo (c) fixa.
 */

import { Inject, Injectable } from '@nestjs/common';
import {
  type AcessoAoBanco,
  consumirPortador,
  contextoDeTenant,
  derivarSegredo,
  resolverPortador,
} from '@sysloc/db';
import { CodigoErro, ErroDeAplicacao, type Logger } from '@sysloc/shared';
import type { Confirmacao } from '@syslocbr/contracts';
import { MENSAGEM_POR_CODIGO } from '../comum/filtro-excecao.js';
import { TOKEN_ACESSO_AO_NEGOCIO, TOKEN_LOGGER } from '../configuracao/ambiente.js';

/**
 * O **único** motivo publicado no registro quando o portador não resolve.
 *
 * Constante de propósito, e constante nomeada em vez de literal solto porque ela é **contrato de
 * observabilidade** (§13.1 da tech spec): a linha do journal não pode distinguir inválido, vencido e
 * invalidado — as três causas que a resposta funde num `404` só.
 */
const MOTIVO_DA_RECUSA = 'nao-resolvido';

/**
 * O corpo do sucesso — um fato afirmado, e não um resultado variável.
 *
 * Congelado porque a mesma instância atende requisições concorrentes: `esquemaDaConfirmacao` declara
 * `confirmado: z.literal(true)`, de modo que não existe `{ confirmado: false }` nesta superfície, e
 * um objeto mutável compartilhado seria a única forma de fazer aparecer um.
 */
const CONFIRMACAO_ATENDIDA: Confirmacao = Object.freeze({ confirmado: true });

@Injectable()
export class ConfirmacaoService {
  constructor(
    // A porta única para transação. Ela é **recebida**, e não construída aqui: o dono da instância é
    // `AutenticacaoModule`, que também a encerra no desligamento. Ver o cabeçalho deste arquivo para
    // por que esta borda a recebe, ao contrário dos serviços das rotas com sessão.
    @Inject(TOKEN_ACESSO_AO_NEGOCIO) private readonly banco: AcessoAoBanco,
    @Inject(TOKEN_LOGGER) private readonly logger: Logger,
  ) {}

  /**
   * Confirma o endereço do locatário dono do portador apresentado.
   *
   * @param segredo O segredo em claro, **já conferido pelo esquema** na borda — malformado morre
   * como `422` antes de chegar aqui, e portanto antes de virar consulta ao banco.
   * @throws {ErroDeAplicacao} `404 RECURSO_NAO_ENCONTRADO` quando o portador não resolve, sem
   * distinguir inválido, vencido e invalidado — e sem que escrita alguma tenha acontecido.
   */
  async confirmar(segredo: string): Promise<Confirmacao> {
    const derivado = derivarSegredo(segredo);

    // Passo (b): FORA de contexto, de propósito. A unidade fixa `app.empresa_id = ''`, a política da
    // tabela não casa linha alguma, e é exatamente esse estado que a função `SECURITY DEFINER` da
    // migração `0014` existe para atravessar — por um caminho nominal e auditável, e não por um
    // `SELECT` direto sobre a tabela.
    const portador = await this.banco.emUnidadeDeTrabalho(
      async (tx) => await resolverPortador(tx, derivado),
    );

    if (portador === undefined) {
      // `info`, e com o motivo CONSTANTE. Nem o segredo, nem o derivado, nem qualquer identificador
      // entram: não há o que correlacionar — o portador não foi resolvido —, e o que existisse aqui
      // diria a quem lê o journal algo que a resposta calou.
      this.logger.info(
        { motivo: MOTIVO_DA_RECUSA },
        'apresentação de portador de confirmação recusada',
      );

      throw new ErroDeAplicacao(
        CodigoErro.RECURSO_NAO_ENCONTRADO,
        MENSAGEM_POR_CODIGO[CodigoErro.RECURSO_NAO_ENCONTRADO],
      );
    }

    // Passos (c) e (d). O contexto vem do **registro resolvido**, e é estabelecido uma única vez
    // (ADR-0024); a escrita corre sob a política, como qualquer outra do produto (ADR-0008).
    //
    // O retorno de `consumirPortador` NÃO é observado, e a ausência de observação é o mecanismo: as
    // três causas de "nada foi escrito" — já consumido, invalidado na janela, vencido na janela —
    // não têm ramo, não podem divergir e terminam no mesmo `200`.
    await contextoDeTenant.executarCom({ empresaId: portador.empresaId }, async () => {
      await this.banco.emUnidadeDeTrabalho(async (tx) => {
        await consumirPortador(tx, derivado);
      });
    });

    // O par que o operador precisa para ligar a apresentação ao cadastro — e nada além dele. Ele sai
    // do registro RESOLVIDO, não do consumo: usar o consumo faria a linha existir só quando houve
    // escrita, e isso é justamente a distinção que a RN-10 não quer publicada em lugar nenhum.
    this.logger.info(
      { empresaId: portador.empresaId, locatarioId: portador.locatarioId },
      'apresentação de portador de confirmação atendida',
    );

    return CONFIRMACAO_ATENDIDA;
  }
}
