/**
 * As **duas rotas de `/v1/multa-e-juros`** — ler a política de mora da empresa e defini-la.
 *
 * ---------------------------------------------------------------------------
 * O CAMINHO sai da lista fixa de áreas de tela, e não de uma taxonomia inventada
 * ---------------------------------------------------------------------------
 *
 * É `/v1/multa-e-juros`, e não `/v1/configuracoes/mora`. O glossário de domínio nomeia a área de
 * tela **"Multa e juros"**, o catálogo fechado da ADR-0011 a registra como `TELA:multa_e_juros`, e o
 * caminho é a transcrição dela. Um segmento de "configurações" inventado aqui criaria uma taxonomia
 * paralela à do produto, e a primeira configuração seguinte teria de escolher entre entrar nela ou
 * repetir a escolha.
 *
 * O recurso é **singular**: uma política por empresa, e a chave é a própria sessão. Por isso não há
 * `:id` em rota alguma desta superfície, e por isso a escrita é `PUT` sobre a coleção — não há o que
 * criar nem o que apagar, só o que definir.
 *
 * ---------------------------------------------------------------------------
 * A exigência é declarada na CLASSE, e é de ÁREA — nenhuma chave de ação
 * ---------------------------------------------------------------------------
 *
 * `@ExigeChave(AREA_DE_MULTA_E_JUROS)` na classe vale para os dois manipuladores — a guarda lê o
 * metadado com `getAllAndOverride`, e a declaração da classe é o que ela encontra quando o método
 * não declara nada próprio. Declarar duas vezes o mesmo valor criaria dois lugares para esquecer um.
 *
 * **Nenhuma das duas exige chave de ação, e a ausência é decisão registrada** (§11.2 da tech spec):
 * o catálogo fechado da ADR-0011 **não enumera ação sensível alguma** dentro de
 * `TELA:multa_e_juros`. Nenhuma chave nova nasce aqui, e
 * `packages/auth/src/catalogo-de-permissoes.ts` **não é tocado** — a área já existe, e abrir o
 * catálogo exigiria supersedê-la ADR-0011.
 *
 * Como não há declaração no método, **não existe nesta superfície o risco de substituição** que o
 * marcador `DECISÃO FECHADA` de {@link ../imoveis/conjunto.controller.js} governa:
 * `getAllAndOverride` faz a declaração do método **substituir** a da classe, e é por isso que a rota
 * que precisasse de uma ação teria de declarar a **conjunção inteira**, nunca só a ação. O `CT-355`
 * varre a aplicação e acusa qualquer manipulador que exija menos do que a classe dele; estas duas
 * exigem exatamente o que a classe exige, que é o que se quer.
 *
 * ---------------------------------------------------------------------------
 * A UNIDADE DE TRABALHO ABRE AQUI, na borda (decisão D1)
 * ---------------------------------------------------------------------------
 *
 * É o controlador que a abre, e o serviço **recebe** o executor. As duas passam por
 * {@link sobContextoDaSessao}, de `comum/contexto-da-sessao.ts`, e nenhuma abre unidade por conta
 * própria nem chama `contextoDeTenant.executarCom`: a única origem legítima do contexto de tenant é
 * a sessão que a guarda publicou (ADR-0008), e propriedade instalada por ponto sobrevive só até o
 * ponto seguinte.
 *
 * ---------------------------------------------------------------------------
 * O corpo do `PUT` é COMPLETO — campo ausente é RECUSA
 * ---------------------------------------------------------------------------
 *
 * `esquemaDaConfiguracaoDeMoraNova` é `strictObject` de dois campos, nenhum opcional, e a conferência
 * é a única desta rota: campo ausente é `422` nomeando o campo que falta, **nunca** "preserve o
 * valor atual". A razão está no cabeçalho de `packages/contracts/src/configuracao-de-mora.ts`, e é o
 * defeito do `PUT` parcial que copia o `required` do `POST` — o cliente que envia só um percentual
 * acredita ter zerado o outro, e o servidor mantém o anterior sem que nada acuse.
 *
 * ---------------------------------------------------------------------------
 * A LEITURA NUNCA RESPONDE `404` (RD-21)
 * ---------------------------------------------------------------------------
 *
 * Empresa que nunca configurou lê `200` com `{ multaPercentual: 0, jurosPercentual: 0 }`, e **a
 * leitura não cria linha alguma**. As duas metades da regra têm razão própria, e as duas estão no
 * cabeçalho de `packages/db/src/configuracao-de-mora.ts`; a que se enxerga daqui é a primeira: um
 * `404` faria esta rota discordar da view sobre o mesmo fato, porque lá a mesma empresa já apura
 * mora zero por `COALESCE` (RD-08). Não há neste arquivo, portanto, um `@ApiNotFoundResponse` — a
 * ausência é contrato publicado, e não esquecimento.
 *
 * ---------------------------------------------------------------------------
 * O LOG não carrega os percentuais (§13.1)
 * ---------------------------------------------------------------------------
 *
 * A linha de trilha da definição nomeia `empresaId` e `entidade` — e nada mais. Os dois percentuais
 * **ficam de fora** de propósito: o que a trilha precisa registrar é que a política daquela empresa
 * mudou e quando, e o valor vigente se lê pela rota, sob autorização. A leitura não registra linha
 * alguma — trilha de leitura é ruído por requisição, sem fato novo a registrar.
 *
 * ---------------------------------------------------------------------------
 * O documento publicado DERIVA dos esquemas (ADR-0016)
 * ---------------------------------------------------------------------------
 *
 * Nenhuma descrição de corpo ou de resposta é escrita à mão aqui: `esquemaPublicado` traduz o mesmo
 * objeto que confere a entrada.
 */

import { Body, Controller, Get, Inject, Put, Req } from '@nestjs/common';
import {
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import {
  type ConfiguracaoDeMora,
  esquemaDaConfiguracaoDeMora,
  esquemaDaConfiguracaoDeMoraNova,
} from '@sysloc/contracts';
import type { AcessoAoBanco } from '@sysloc/db';
import { CodigoErro, type Logger } from '@sysloc/shared';
import type { FastifyRequest } from 'fastify';
import { ExigeChave } from '../autenticacao/exigencia.decorator.js';
import { sobContextoDaSessao } from '../comum/contexto-da-sessao.js';
import { esquemaDoErro } from '../comum/esquema-de-erro.js';
import { esquemaPublicado } from '../comum/esquema-publicado.js';
import { validar } from '../comum/validacao.js';
import { TOKEN_ACESSO_AO_NEGOCIO, TOKEN_LOGGER } from '../configuracao/ambiente.js';
import { MoraService } from './mora.service.js';

/**
 * Caminho da superfície da política de mora, relativo ao prefixo de versão (§4.1:
 * `/v1/multa-e-juros`).
 *
 * A grafia com hífens é a do caminho HTTP; a da chave do catálogo é `TELA:multa_e_juros`, com
 * sublinhado. As duas descrevem a mesma área e vivem em vocabulários diferentes — caminho de URL e
 * identificador de permissão —, e por isso são constantes separadas em vez de uma derivada da outra.
 */
export const CAMINHO_DE_MULTA_E_JUROS = 'multa-e-juros';

/**
 * A área de tela que governa esta superfície (§4.1, §11.2).
 *
 * Constante nomeada, e não literal solto no decorador: o valor é **contrato publicado** — ele aparece
 * no corpo da recusa que o cliente lê, em `detalhes.exigido` —, e ter nome é o que permite ao
 * `CT-533` auditá-lo por conteúdo sem casar uma cadeia escrita em dois lugares.
 */
const AREA_DE_MULTA_E_JUROS = 'TELA:multa_e_juros' as const;

/** Nome de campo usado quando a recusa é do corpo e o Zod não tem caminho a nomear. */
const CAMPO_DO_CORPO = 'corpo';

/** A entidade nomeada na linha de trilha desta superfície — escrita uma vez (§13.1). */
const ENTIDADE_DA_TRILHA = 'configuracao_de_mora';

@ApiTags('multa-e-juros')
@Controller(CAMINHO_DE_MULTA_E_JUROS)
@ExigeChave(AREA_DE_MULTA_E_JUROS)
export class MoraController {
  constructor(
    // A porta única para transação. É dela que sai o executor que os métodos do serviço recebem.
    @Inject(TOKEN_ACESSO_AO_NEGOCIO) private readonly banco: AcessoAoBanco,
    @Inject(MoraService) private readonly mora: MoraService,
    @Inject(TOKEN_LOGGER) private readonly logger: Logger,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'Lê a política de multa e juros da empresa',
    description:
      'Devolve os dois percentuais vigentes na empresa **da sessão**. A empresa que nunca ' +
      'configurou recebe `200` com `{ "multaPercentual": 0, "jurosPercentual": 0 }` — **nunca ' +
      '`404`** —, e a leitura **não cria linha alguma**: a ausência de política e a política ' +
      'explicitamente zerada são a mesma coisa publicada, e é isso que faz esta leitura concordar ' +
      'com a mora que a carteira apura. Os percentuais alcançam o que está **em aberto**, porque ' +
      'multa, juros e total são derivados no instante da leitura da cobrança; o que já foi pago ' +
      'não muda, porque a política do dia do pagamento fica carimbada na cobrança.',
  })
  @ApiOkResponse({
    description: 'A política vigente — zerada quando a empresa nunca a definiu.',
    schema: esquemaPublicado(esquemaDaConfiguracaoDeMora, 'output'),
  })
  @ApiUnauthorizedResponse({ schema: esquemaDoErro([CodigoErro.NAO_AUTENTICADO]) })
  @ApiForbiddenResponse({ schema: esquemaDoErro([CodigoErro.ACESSO_NEGADO]) })
  async ler(@Req() requisicao: FastifyRequest): Promise<ConfiguracaoDeMora> {
    return await sobContextoDaSessao(this.banco, requisicao, async (tx) => await this.mora.ler(tx));
  }

  @Put()
  @ApiOperation({
    summary: 'Define a política de multa e juros da empresa',
    description:
      'O corpo é **completo**: os dois percentuais são obrigatórios, e campo ausente é `422` — ' +
      'nunca "preserve o valor atual". Os dois vivem em `[0, 100]`, com duas casas decimais; a ' +
      'multa é aplicada **uma vez** sobre o valor original e os juros são **ao mês**, simples, ' +
      'sobre base de trinta dias. A política nasce na empresa **da sessão** — a empresa nunca é ' +
      'aceita pelo corpo —, e a chamada é idempotente: o mesmo corpo aplicado duas vezes deixa a ' +
      'empresa com **uma** política, nunca duas. **Nenhuma cobrança é reescrita**: o que está em ' +
      'aberto passa a refletir a política nova na leitura seguinte, e o que já foi pago mantém a ' +
      'multa e os juros carimbados no ato do pagamento.',
  })
  @ApiOkResponse({
    description: 'A política que passou a valer.',
    schema: esquemaPublicado(esquemaDaConfiguracaoDeMora, 'output'),
  })
  @ApiUnauthorizedResponse({ schema: esquemaDoErro([CodigoErro.NAO_AUTENTICADO]) })
  @ApiForbiddenResponse({ schema: esquemaDoErro([CodigoErro.ACESSO_NEGADO]) })
  @ApiUnprocessableEntityResponse({ schema: esquemaDoErro([CodigoErro.CAMPO_INVALIDO]) })
  async definir(
    @Body() corpo: unknown,
    @Req() requisicao: FastifyRequest,
  ): Promise<ConfiguracaoDeMora> {
    const entrada = validar(esquemaDaConfiguracaoDeMoraNova, corpo, CAMPO_DO_CORPO);

    return await sobContextoDaSessao(this.banco, requisicao, async (tx, sessao) => {
      const vigente = await this.mora.definir(tx, entrada);

      // Os campos são os que a §13.1 nomeia para este evento. **Os dois percentuais ficam de fora**
      // — a trilha registra que a política mudou, não qual é ela.
      this.logger.info(
        { empresaId: sessao.empresaId, entidade: ENTIDADE_DA_TRILHA },
        'política de mora definida',
      );

      return vigente;
    });
  }
}
