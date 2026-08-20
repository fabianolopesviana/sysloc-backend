/**
 * A **entrada da notícia do provedor** — `POST /v1/notificacoes-bancarias`.
 *
 * ---------------------------------------------------------------------------
 * A SEGUNDA superfície sem sessão do produto, e a PRIMEIRA em que quem age não é titular de nada
 * ---------------------------------------------------------------------------
 *
 * A dispensa de sessão desta rota **não** vem da ADR-0027, e a distinção é conteúdo, não formalidade.
 * Aquela ADR governa o ato do **titular do dado** — o locatário que confirma o próprio endereço —, e
 * exige em troca um portador de segredo com entropia declarada, guardado como derivado, com
 * expiração e uso único. Aqui não há **nem titular nem portador**: quem envia é o provedor bancário,
 * que não é usuário do sistema, não terá sessão algum dia, não é dono do dado que a notícia afeta e
 * não oferece autenticação alguma.
 *
 * O critério que autoriza esta rota é o da **ADR-0035**, e ele cobra outra coisa em troca — sete
 * cláusulas, das quais **três** são desta camada e as outras quatro são da tarefa:
 *
 *   1. **persiste o recebido cru ANTES de interpretá-lo** — ver `./notificacao-bancaria.service.js`;
 *   2. **responde de imediato, sem que o processamento componha a resposta** — é o `@HttpCode(204)`
 *      abaixo, e a ausência de corpo é o que torna a cláusula uma propriedade **estrutural**: não
 *      existe lugar em que o desfecho pudesse viajar, então nenhuma rodada futura consegue
 *      "melhorar" a rota devolvendo-o (ADR-0029);
 *   3. **é declarada `publicas`**, de modo que `semDeclaracao` permanece vazio (ADR-0011).
 *
 * As outras quatro — rotear por chave que o próprio produto emitiu, derivar a empresa do registro
 * encontrado, descartar o que não casa sem consultar o terceiro, e ser idempotente pelo
 * identificador do fato — moram no processo de trabalho, do outro lado da fila, e **nenhuma delas
 * pode ser observada daqui**. É exatamente por isso que este arquivo não interpreta nada.
 *
 * ---------------------------------------------------------------------------
 * O CORPO É OPACO POR DECISÃO — não existe validação a acrescentar aqui
 * ---------------------------------------------------------------------------
 *
 * `@Body() corpo: unknown`, e nenhum `validar(...)`. É a **inversão deliberada** do que todas as
 * outras rotas deste serviço fazem, e a razão é a RN-02: o produto **tem de guardar o que não
 * entende**. Recusar por forma desconhecida seria perder a notícia que esta fatia existe para não
 * perder — e o provedor, que não é cliente nosso, não tem como corrigir o payload nem saberia que
 * precisou. A §21.2 do tech spec registra por escrito por que a
 * `.claude/rules/contrato-publicado.md` **não alcança** este corpo: ela governa o esquema de entrada
 * do pacote de contratos, importado pelo frontend, e aqui não há esquema nem cliente nosso.
 *
 * A interpretação existe, é **tolerante**, e vive na tarefa. O único `4xx` desta rota é do
 * **transporte** — corpo que não é JSON morre no adaptador HTTP antes deste manipulador, e nada é
 * gravado. O produto não publica erro de negócio aqui: todo desfecho é `204`.
 *
 * ⚠️ **A rota NÃO redireciona, em hipótese alguma** — o provedor aceita `200`/`201`/`204` e reprova
 * `3xx`. Não há aqui `@Redirect`, nem caminho alternativo que o arcabouço normalizasse por
 * redirecionamento; o `CT-971` mede as duas coisas, inclusive o caminho com barra final.
 *
 * ---------------------------------------------------------------------------
 * A MARCA VAI NO MÉTODO, e a granularidade é a mesma decisão de `confirmacao.controller.ts`
 * ---------------------------------------------------------------------------
 *
 * `@RotaPublica()` é declarada no **manipulador**, e não na classe, embora hoje haja um manipulador
 * só. As duas formas são lidas pela mesma consulta (`getAllAndOverride`), e a diferença aparece no
 * dia em que um segundo manipulador nascer aqui: declarada na **classe**, ele herdaria a dispensa em
 * silêncio — superfície aberta, detectada apenas pela suíte; declarada no **método**, ele nasce
 * governado e sem exigência, o que a guarda recusa com `403` e o `CT-213` acusa nominalmente. Entre
 * dois modos de falha barulhentos, escolhe-se o que falha **fechado**.
 *
 * ---------------------------------------------------------------------------
 * ELE NÃO ABRE UNIDADE DE TRABALHO, e não conhece banco
 * ---------------------------------------------------------------------------
 *
 * A gravação do cru, a ordem entre ela e o enfileiramento, e a absorção da falha de fila moram em
 * `./notificacao-bancaria.service.js`. Este arquivo recebe o corpo, publica o contrato e devolve
 * `void`; ele não conhece `AcessoAoBanco`, não conhece `contextoDeTenant` e não monta corpo de erro
 * à mão.
 */

import { Body, Controller, HttpCode, Inject, Post } from '@nestjs/common';
import { ApiBody, ApiNoContentResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RotaPublica } from '../autenticacao/rota-publica.decorator.js';
import { NotificacaoBancariaService } from './notificacao-bancaria.service.js';

/**
 * Caminho da superfície da notícia bancária, relativo ao prefixo de versão
 * (§4.1: `/v1/notificacoes-bancarias`).
 *
 * Constante nomeada e **exportada** porque o literal é contrato publicado — é ele que o provedor tem
 * cadastrado, e é ele que as âncoras de superfície de `test/cobertura-de-autorizacao.e2e.spec.ts` e
 * `test/contexto.e2e.spec.ts` compõem em vez de reescrever. Caminho escrito duas vezes é livre para
 * divergir, e a divergência apareceria como `404` num caso que deveria medir outra coisa.
 */
export const CAMINHO_DAS_NOTIFICACOES_BANCARIAS = 'notificacoes-bancarias';

/**
 * O código de resposta desta rota — `204`, e ele é a CA-02 virada propriedade estrutural.
 *
 * Constante nomeada, e não número solto no decorador, porque o valor é **contrato com o provedor**:
 * ele aceita `200`, `201` e `204`, e a escolha do `204` é a única das três em que o desfecho do
 * tratamento **não tem onde caber**. Um `200` com corpo vazio hoje seria um `200` com corpo amanhã.
 */
const SEM_CONTEUDO = 204;

@ApiTags(CAMINHO_DAS_NOTIFICACOES_BANCARIAS)
@Controller(CAMINHO_DAS_NOTIFICACOES_BANCARIAS)
export class NotificacaoBancariaController {
  constructor(
    @Inject(NotificacaoBancariaService)
    private readonly notificacoes: NotificacaoBancariaService,
  ) {}

  @Post()
  // `204`, e sem corpo. Ver {@link SEM_CONTEUDO} e a cláusula 2 do cabeçalho: a ausência de corpo é
  // o mecanismo que impede o desfecho do tratamento de compor a resposta.
  @HttpCode(SEM_CONTEUDO)
  // ⚠️ A MARCA DA DISPENSA. Ela é a **declaração** desta rota para a cobertura de autorização
  // (ADR-0011), e é por isso que `semDeclaracao` continua vazio mesmo sem `@ExigeChave`. Ver o
  // cabeçalho para por que ela está no método, e não na classe, e por que o critério aqui é o da
  // ADR-0035 e não o da ADR-0027.
  @RotaPublica()
  @ApiOperation({
    summary: 'Recebe a notícia que o provedor bancário envia sobre uma cobrança',
    description:
      'É a **entrada de fato de terceiro** do produto (ADR-0035): quem envia é o provedor, que não ' +
      'é usuário do sistema e não tem sessão. O corpo é **opaco** — ele é gravado como chegou, ' +
      '**antes** de qualquer interpretação, e nada nesta rota o valida para aceitar ou recusar. A ' +
      'resposta é sempre `204` **sem corpo**, inclusive quando o recebido é ininterpretável ou não ' +
      'corresponde a cobrança alguma: o desfecho do tratamento **não compõe a resposta**, e a rota ' +
      '**não redireciona** em hipótese alguma. O único `4xx` possível é `422` do transporte, para ' +
      'corpo que não é JSON — recusado pelo adaptador HTTP antes deste manipulador, sem gravar nada.',
  })
  @ApiBody({
    description:
      'O objeto JSON que o provedor envia, no vocabulário **dele**. Não há esquema nosso a ' +
      'declarar: o corpo é um fato de terceiro, não um contrato de entrada do produto (§21.2).',
    schema: { type: 'object', additionalProperties: true },
  })
  @ApiNoContentResponse({
    description:
      'A notícia foi gravada como chegou e o tratamento foi enfileirado. Não há corpo, e não há o ' +
      'que ler: o desfecho vive na trilha da cobrança, nunca nesta resposta.',
  })
  async receber(@Body() corpo: unknown): Promise<void> {
    // `corpo ?? null` porque a requisição **sem corpo** entrega `undefined`, e `undefined` não é
    // valor JSON: gravá-lo é impossível, e a função de dados o recusa por construção. O que chegou
    // foi "nada", e `null` é a forma JSON de dizer isso — de modo que a notícia continua sendo
    // gravada, que é o invariante desta fatia. Ela some depois como `ILEGIVEL`, no tratamento, sem
    // que a borda tenha decidido coisa alguma sobre a forma do recebido.
    await this.notificacoes.receber(corpo ?? null);
  }
}
