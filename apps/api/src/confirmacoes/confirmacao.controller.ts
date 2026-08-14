/**
 * A **única rota de negócio sem sessão do produto** — `POST /v1/confirmacoes-de-email`.
 *
 * ---------------------------------------------------------------------------
 * A DISPENSA É EXCEÇÃO JUSTIFICADA, e o critério é o da ADR-0027, item a item
 * ---------------------------------------------------------------------------
 *
 * O ato é exercido pelo **titular do dado que ele afeta** — o locatário —, que **não é usuário do
 * sistema e não terá sessão algum dia**; em troca, a rota exige um portador de segredo **aleatório
 * com entropia declarada** (256 bits de `node:crypto`), guardado como **hash** (SHA-256, e a coluna
 * do claro não existe), com **expiração** (72 h) e de **uso único**; ele resolve **um ato sobre um
 * objeto**; o contexto de tenant vem do **registro que o portador resolve**, nunca do pedido
 * (ADR-0024); e a rota é declarada `publicas`, de modo que `semDeclaracao` permanece **vazio**
 * (ADR-0011).
 *
 * ---------------------------------------------------------------------------
 * A MARCA VAI NO MÉTODO, e a granularidade é a decisão
 * ---------------------------------------------------------------------------
 *
 * `@RotaPublica()` é a **única** forma que o mecanismo admite para dispensar sessão — a alternativa
 * (uma lista de caminhos liberados dentro da guarda) está descartada por escrito em
 * `../autenticacao/rota-publica.decorator.ts`, e a razão é o default: com a marca no controlador,
 * **rota nova nasce protegida por omissão**, e o esquecimento produz `401`, nunca superfície aberta.
 *
 * Ela é declarada no **manipulador**, e não na classe, embora hoje haja um manipulador só. As duas
 * formas são lidas pela mesma consulta (`getAllAndOverride`), e a diferença aparece no dia em que um
 * segundo manipulador nascer aqui: declarada na **classe**, ele herdaria a dispensa em silêncio —
 * o modo de falha é superfície aberta, e quem o detecta é apenas a suíte; declarada no **método**,
 * ele nasce governado e sem exigência, o que a guarda recusa com `403` em produção e o `CT-213`
 * acusa nominalmente. Entre dois modos de falha barulhentos, escolhe-se o que falha **fechado**.
 *
 * ---------------------------------------------------------------------------
 * O SEGREDO VAI NO CORPO, e nunca no caminho nem na consulta
 * ---------------------------------------------------------------------------
 *
 * Caminho e cadeia de consulta entram na trilha do servidor de borda (F7) e no histórico do
 * navegador, e um segredo de uso único que vaza para o registro deixa de ser de uso único. É a mesma
 * razão pela qual o link do e-mail leva o segredo no **fragmento**
 * (`packages/documentos/src/mensagem-de-confirmacao.ts`), que não é transmitido ao servidor.
 *
 * O molde é **fechado no esquema** (`esquemaDaApresentacaoDoPortador`, de `@sysloc/contracts`):
 * segredo malformado morre como `422` do arcabouço e **nunca vira consulta ao banco**, sem uma linha
 * de verificação escrita aqui. O `strictObject` fecha o outro lado: um `empresaId` proposto pelo
 * corpo é **recusado por chave desconhecida**, em vez de ignorado — o contexto de tenant não tem
 * como ser influenciado pelo pedido.
 *
 * ---------------------------------------------------------------------------
 * ELE NÃO ABRE UNIDADE DE TRABALHO, e a razão está no serviço
 * ---------------------------------------------------------------------------
 *
 * As duas unidades — a da resolução, sem contexto, e a do consumo, sob o contexto descoberto — e a
 * decisão de domínio entre elas (o `404`) moram em `./confirmacao.service.js`. Este arquivo valida a
 * entrada, publica o contrato e devolve o que o serviço decidiu; ele não conhece banco, não conhece
 * `contextoDeTenant` e não monta corpo de erro à mão.
 *
 * ---------------------------------------------------------------------------
 * O DOCUMENTO PUBLICADO DERIVA DOS ESQUEMAS (ADR-0016)
 * ---------------------------------------------------------------------------
 *
 * Nenhuma descrição de corpo é escrita à mão: `esquemaPublicado` traduz o **mesmo** objeto que
 * confere a entrada. O `401` e o `403` **não** são declarados aqui, e a ausência é conteúdo — esta
 * rota não os emite, porque não há sessão a exigir nem chave a conferir.
 */

import { Body, Controller, HttpCode, Inject, Post } from '@nestjs/common';
import {
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import {
  type Confirmacao,
  esquemaDaApresentacaoDoPortador,
  esquemaDaConfirmacao,
} from '@sysloc/contracts';
import { CodigoErro } from '@sysloc/shared';
import { RotaPublica } from '../autenticacao/rota-publica.decorator.js';
import { esquemaDoErro } from '../comum/esquema-de-erro.js';
import { esquemaPublicado } from '../comum/esquema-publicado.js';
import { validar } from '../comum/validacao.js';
import { ConfirmacaoService } from './confirmacao.service.js';

/**
 * Caminho da superfície de confirmação, relativo ao prefixo de versão (§4.1: `/v1/confirmacoes-de-email`).
 *
 * Constante nomeada e **exportada** porque o literal é contrato publicado: é ele que as âncoras de
 * superfície de `test/cobertura-de-autorizacao.e2e.spec.ts` e `test/contexto.e2e.spec.ts` compõem
 * para conferir o par método+caminho, em vez de reescrevê-lo.
 */
export const CAMINHO_DAS_CONFIRMACOES = 'confirmacoes-de-email';

/**
 * Nome de campo da recusa do corpo, quando o Zod não tem caminho a nomear.
 *
 * É o caso da **chave desconhecida** em objeto estrito — o `empresaId` que alguém tentasse propor —,
 * que o Zod reporta com caminho vazio. O segredo malformado tem caminho próprio e é nomeado por ele.
 */
const CAMPO_DO_CORPO = 'corpo';

@ApiTags('confirmacoes-de-email')
@Controller(CAMINHO_DAS_CONFIRMACOES)
export class ConfirmacaoController {
  constructor(@Inject(ConfirmacaoService) private readonly confirmacoes: ConfirmacaoService) {}

  @Post()
  // `200`, e não `201`: o ato não cria recurso que o cliente vá endereçar — ele afirma um fato
  // consumado sobre o cadastro que já existia. É a mesma escolha das transições de estado do
  // produto, e pela mesma razão.
  @HttpCode(200)
  // ⚠️ A MARCA DA DISPENSA. Ela é a **declaração** desta rota para a cobertura de autorização
  // (ADR-0011), e é por isso que `semDeclaracao` continua vazio mesmo sem `@ExigeChave`. Ver o
  // cabeçalho para por que ela está no método, e não na classe.
  @RotaPublica()
  @ApiOperation({
    summary: 'Confirma o endereço de e-mail do locatário pelo portador recebido',
    description:
      'É a **única rota de negócio sem sessão** do produto (ADR-0027): quem age é o titular do ' +
      'endereço, que não é usuário do sistema. O segredo viaja no **corpo**, nunca no caminho nem ' +
      'na consulta. Apresentar de novo o mesmo link dentro das 72 h responde sucesso e **não ' +
      'altera nada** — em particular, o instante da confirmação não é reescrito (RN-10), o que ' +
      'impede a pré-visualização de link feita pelo provedor de e-mail de queimá-lo antes do ' +
      'locatário. Portador inválido, vencido ou invalidado produzem **a mesma** recusa `404`, byte ' +
      'a byte: a resposta não diz qual dos três aconteceu (RN-14).',
  })
  @ApiOkResponse({
    description: 'O endereço está confirmado.',
    schema: esquemaPublicado(esquemaDaConfirmacao, 'output'),
  })
  @ApiNotFoundResponse({ schema: esquemaDoErro([CodigoErro.RECURSO_NAO_ENCONTRADO]) })
  @ApiUnprocessableEntityResponse({ schema: esquemaDoErro([CodigoErro.CAMPO_INVALIDO]) })
  async confirmar(@Body() corpo: unknown): Promise<Confirmacao> {
    // `corpo ?? {}` porque a requisição sem corpo entrega `undefined`, e o que se quer dela é a
    // recusa do ESQUEMA nomeando `segredo` — e não uma falha de tipo antes dele.
    const apresentacao = validar(esquemaDaApresentacaoDoPortador, corpo ?? {}, CAMPO_DO_CORPO);

    return await this.confirmacoes.confirmar(apresentacao.segredo);
  }
}
