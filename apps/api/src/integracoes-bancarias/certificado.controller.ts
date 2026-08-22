/**
 * As **três rotas do certificado do provedor** — `POST /v1/integracoes-bancarias/certificados`, para
 * registrar (ou renovar) a identidade com que a empresa se apresenta ao banco,
 * `GET /v1/integracoes-bancarias/certificado`, para ver o que está valendo, e
 * `POST /v1/integracoes-bancarias/certificado/verificacao`, para perguntar ao provedor se a
 * identidade registrada serve.
 *
 * ---------------------------------------------------------------------------
 * O CAMINHO sai da lista fixa de áreas de tela, e não de uma taxonomia inventada
 * ---------------------------------------------------------------------------
 *
 * É `/v1/integracoes-bancarias`, e não `/v1/configuracoes/certificado`. O catálogo fechado da
 * ADR-0011 registra a área como `TELA:integracoes_bancarias`, e o caminho é a transcrição dela. É a
 * mesma escolha, e a mesma razão, de {@link ../automacao/automacao.controller.js} e de
 * {@link ../mora/mora.controller.js}.
 *
 * O recurso é **singular**: uma identidade vigente por empresa, e a chave é a própria sessão. Por
 * isso não há `:id` em rota nenhuma desta superfície — e por isso o plural aparece **só** no caminho
 * do `POST`: ali o que se acrescenta é um item à coleção de certificados da empresa, enquanto o `GET`
 * lê o único que vigora.
 *
 * ---------------------------------------------------------------------------
 * O `POST` responde `201`, e o número é conteúdo
 * ---------------------------------------------------------------------------
 *
 * Cada registro **cria um recurso novo**: renovar é inserir e substituir, nunca emendar a linha
 * anterior (D9-b), e o certificado anterior continua existindo no histórico com o segredo dele
 * apagado. Um `200` diria ao cliente que ele atualizou algo — que é justamente a leitura que a
 * substituição por inserção não admite.
 *
 * ---------------------------------------------------------------------------
 * A exigência é da CLASSE, e só o REGISTRO declara — e declara a CONJUNÇÃO INTEIRA
 * ---------------------------------------------------------------------------
 *
 * `@ExigeChave(AREA_DAS_INTEGRACOES_BANCARIAS)` na classe vale para o manipulador que não declara
 * nada próprio — a guarda lê o metadado com `getAllAndOverride`, e a declaração da classe é o que ela
 * encontra. A **consulta** é assim: ler qual certificado está valendo não é ato sensível, e negá-la a
 * quem tem a área esconderia dele exatamente o aviso de que o material está para vencer.
 *
 * A **verificação** é assim pela mesma razão, aplicada a um ato que **alcança um terceiro** e mesmo
 * assim não é sensível: ela não transfere direito, não move dinheiro e não altera o que outra
 * entidade pode fazer — a **RN-06** a declara **sem efeito**, e o produto continua exatamente como
 * estava depois dela (é o que o `CT-826` e o `CT-827` provam, comparando a linha campo a campo).
 * Exigir a ação de configuração faria quem administra a integração precisar do poder de **trocar** a
 * identidade só para descobrir se a atual funciona, que é o oposto do que a assimetria entre as duas
 * chaves existe para permitir.
 *
 * O **registro** troca a identidade com que a empresa cobra, e é o ato sensível desta superfície:
 * ele declara `@ExigeChaves(AREA…, ACAO…)` — o decorador **plural**, com a conjunção inteira —, e a
 * chave existe no catálogo fechado exatamente para governar esse ato.
 *
 * > **Quem governa a exigência destas três rotas é a ADR-0011 com a ADR-0018, e o fato que
 * > classifica o ato é a RN-06** — não a ADR-0021. A `Decision` da 0021 tem por sujeito *"toda
 * > **transição de estado** de entidade de negócio"*, e a segunda classe dela é *"atributo
 * > operacional **do cadastro**"*; nenhuma das três rotas daqui é uma coisa nem a outra, e a seção
 * > *"Instâncias declaradas da segunda classe"* — criada pela emenda de 2026-08-10 justamente para
 * > manter o registro verdadeiro — **não nomeia a verificação**. A 0021 aparece aqui **só como
 * > analogia de critério**: a mesma régua de *natureza do ato* (pergunta-se o que o ato faz, não
 * > como ele se chama). **Nunca como cláusula governante** — invocá-la assim seria o modo de falha
 * > que a terceira das `Alternatives considered` dela previu por escrito, *"um gate futuro leria
 * > violação onde houve decisão"*.
 *
 * > ⚠️ **A fatia (ii) NÃO herda esta classificação por analogia.** Um ato que alcance o **mesmo
 * > provedor para MOVER DINHEIRO** — emitir boleto, pedir baixa, processar retorno — **não é da
 * > mesma classe** que perguntar se a identidade serve: ele tem efeito, e a RN-06 não o alcança. A
 * > exigência de cada rota daquela fatia é **decisão própria dela**, tomada e registrada lá contra o
 * > catálogo fechado da ADR-0011 — que já traz `ACAO:emitir_boleto` e
 * > `ACAO:solicitar_baixa_de_boleto`, concedidas às operações que falam com o banco. Copiar daqui
 * > *"basta a área, porque o ato só alcança terceiro"* afrouxaria a autorização, que é literalmente
 * > o primeiro dos `Cons` da 0021: *"classificar errado para menos afrouxa a autorização"*.
 *
 * > ⚠️ **Nunca declare só a ação.** `getAllAndOverride` é **override**, não união:
 * > `@ExigeChave(ACAO…)` no método **apaga** a área da classe, em silêncio, e o manipulador passa a
 * > exigir **menos** que a classe dele. Foi defeito explorável nas duas rotas de circulação de
 * > conjunto, e é o que o marcador `DECISÃO FECHADA` de {@link ../imoveis/conjunto.controller.js}
 * > governa. **A ordem também é conteúdo**: a recusa nomeia a **primeira** chave ausente (ADR-0018),
 * > e a área vem antes da ação para que quem já tem a área ouça o nome do que lhe falta.
 *
 * **Nenhuma chave nasce aqui**, e `packages/auth/src/catalogo-de-permissoes.ts` **não é tocado**: as
 * duas já existem, e o catálogo é fechado — abrir exigiria supersedê-la ADR-0011. Pela matriz de
 * perfil, `ADMIN_EMPRESA` alcança as três rotas e `USUARIO_EMPRESA` não alcança nenhuma; o
 * `SYSLOC_MASTER` fica de fora **sem regra nova**, porque a matriz dele é vazia e a sessão dele não
 * carrega empresa (ADR-0013).
 *
 * ---------------------------------------------------------------------------
 * A CONTENÇÃO DO SEGREDO É A PRIMEIRA INSTRUÇÃO DEPOIS DA VALIDAÇÃO (ADR-0032)
 * ---------------------------------------------------------------------------
 *
 * O material e a senha entram por este arquivo e **não são tocados como cadeia crua depois da linha
 * que os embrulha**. `criarSegredoOperavel` é a única entrada do claro no produto, e o que viaja
 * daqui para baixo é opaco: campo privado de classe, invisível a `Object.keys`, ao espalhamento, ao
 * `JSON.stringify` e ao `util.inspect`.
 *
 * A ADR-0032 nasceu de um achado **medido** — um segredo em claro alcançou o diário do sistema por um
 * caminho que a redação não cobria —, e a lição que ela fixa é que redigir na saída é rede, nunca
 * garantia. A garantia é não haver o que redigir. Por isso **não existe neste arquivo** uma variável
 * intermediária com o material, um registro que o mencione ou um `detalhes` que o carregue.
 *
 * ---------------------------------------------------------------------------
 * A UNIDADE DE TRABALHO ABRE AQUI, na borda — e DEPOIS da leitura do material
 * ---------------------------------------------------------------------------
 *
 * É o controlador que a abre, e o serviço **recebe** o executor (decisão D1). A ordem do registro é
 * `validar → embrulhar → preparar o material → abrir a transação → escrever`, e a posição da abertura
 * é decisão registrada: o aperto de mão que abre o PKCS#12 é I/O — e a preparação pode acrescentar a
 * ele um subprocesso de conversão, que é I/O bem maior. Segurar conexão física durante os dois
 * repetiria o achado da T7 da fatia `documentos-e-confirmacao` — a renderização de ~0,5 s dentro do
 * `sql.begin` — com uma espera de outra ordem de grandeza.
 *
 * Na **verificação** a mesma razão aparece com o dobro de força, e por isso a ordem dela é
 * `validar → abrir a transação → ler o vigente → FECHAR a transação → apertar a mão → registrar`. A
 * unidade de trabalho cobre **apenas a leitura**, e o `await` que a fecha acontece antes de o cliente
 * mTLS existir: o ato seguinte é chamada de rede a terceiro, com teto de dez segundos, e mantê-lo
 * dentro do `sql.begin` reservaria uma conexão da mesma reserva que atende todo o produto durante a
 * espera inteira.
 *
 * As três rotas passam por {@link sobContextoDaSessao}, e nenhuma chama
 * `contextoDeTenant.executarCom`: a única origem legítima do contexto de tenant é a sessão que a
 * guarda publicou (ADR-0008).
 *
 * ---------------------------------------------------------------------------
 * O LOG não carrega nada do corpo (§13.1)
 * ---------------------------------------------------------------------------
 *
 * A linha de trilha do registro nomeia a empresa, a entidade e a **impressão digital** do material —
 * que é o resumo público do certificado, o mesmo que a rota devolve, e é ele que permite ao operador
 * casar uma emissão futura com o material que a assinou. Material, senha, titular e envelope ficam de
 * fora. **A leitura não registra linha alguma** — trilha de leitura é ruído por requisição, sem fato
 * novo a registrar (o mesmo critério de `mora.controller.ts`).
 *
 * A **verificação** registra, e a diferença em relação à leitura é o que ela é: um ato que alcança um
 * terceiro. A linha nomeia a empresa, a entidade, **qual** certificado foi apresentado, se o par o
 * aceitou e quanto o ato demorou — é o par de campos que permite ao operador distinguir *"a identidade
 * foi recusada"* de *"o provedor está lento"*. O `detalhe` **não** entra: ele é texto para a tela do
 * Admin, e repeti-lo no journal encheria a trilha de prosa sem fato novo.
 *
 * ---------------------------------------------------------------------------
 * O documento publicado DERIVA dos esquemas (ADR-0016)
 * ---------------------------------------------------------------------------
 *
 * Nenhuma descrição de corpo ou de resposta é escrita à mão aqui: `esquemaPublicado` traduz o mesmo
 * objeto que confere a entrada.
 */

import { Body, Controller, Get, HttpCode, Inject, Post, Req } from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import {
  type Certificado,
  type DesfechoDoRegistroDeCertificado,
  esquemaDoCertificado,
  esquemaDoCertificadoNovo,
  esquemaDoDesfechoDoRegistroDeCertificado,
  esquemaDoResultadoDaVerificacao,
  type ResultadoDaVerificacao,
} from '@sysloc/contracts';
import type { AcessoAoBanco } from '@sysloc/db';
import { CodigoErro, criarSegredoOperavel, type Logger } from '@sysloc/shared';
import type { FastifyRequest } from 'fastify';
import { ExigeChave, ExigeChaves } from '../autenticacao/exigencia.decorator.js';
import { sobContextoDaSessao } from '../comum/contexto-da-sessao.js';
import { ESQUEMA_DO_CORPO_VAZIO } from '../comum/esquema-de-corpo-vazio.js';
import { esquemaDoErro } from '../comum/esquema-de-erro.js';
import { esquemaPublicado } from '../comum/esquema-publicado.js';
import { validar } from '../comum/validacao.js';
import { TOKEN_ACESSO_AO_NEGOCIO, TOKEN_LOGGER } from '../configuracao/ambiente.js';
import { CertificadoDoProvedorService } from './certificado.service.js';

/**
 * Caminho da superfície das integrações bancárias, relativo ao prefixo de versão
 * (`/v1/integracoes-bancarias`).
 *
 * A grafia com hífens é a do caminho HTTP; a da chave do catálogo é `TELA:integracoes_bancarias`,
 * com sublinhado. As duas descrevem a mesma área e vivem em vocabulários diferentes — caminho de URL
 * e identificador de permissão —, e por isso são constantes separadas em vez de uma derivada da
 * outra. É o mesmo par, com a mesma justificativa, de `automacao-de-cobranca`.
 */
export const CAMINHO_DAS_INTEGRACOES_BANCARIAS = 'integracoes-bancarias';

/**
 * O segmento do **registro** — plural, porque o que ele acrescenta é um item à coleção.
 *
 * Exportado porque a suíte compõe o endereço a partir daqui, em vez de reescrever a cadeia: caminho
 * escrito duas vezes é livre para divergir, e a divergência apareceria como `404` num caso que
 * deveria medir outra coisa.
 */
export const SEGMENTO_DO_REGISTRO = 'certificados';

/** O segmento da **consulta** — singular, porque vigente há um só por empresa. */
export const SEGMENTO_DA_CONSULTA = 'certificado';

/**
 * O segmento da **verificação**, pendurado no da consulta: `certificado/verificacao`.
 *
 * Ele é sufixo do recurso singular, e não caminho irmão, porque o ato incide sobre **aquele**
 * certificado — o vigente da empresa —, e não sobre a coleção. É a mesma forma das transições do
 * produto (`:codigo/ativacao`, `:codigo/cancelamento`), com a diferença de que aqui a chave do recurso
 * é a própria sessão e por isso não há `:id` no meio.
 *
 * Exportado pela mesma razão dos dois acima: a suíte compõe o endereço a partir daqui, em vez de
 * reescrever a cadeia.
 */
export const SEGMENTO_DA_VERIFICACAO = 'verificacao';

// DECISÃO FECHADA — T12 / Gate 2 rodada 1 + Gate 1 rodada 2 · 2026-08-15
// O QUÊ: a exigência das TRÊS rotas desta superfície apoia-se em ADR-0011 + ADR-0018, com a RN-06
//        classificando o ato. A ADR-0021 só entra como ANALOGIA DE CRITÉRIO, e a negação de
//        governança vai na MESMA oração — nunca um `(ADR-0021)` ao fim de oração normativa, que é
//        atribuição de norma, não analogia. Vale para todo registro desta decisão: docblock de
//        controlador, docblock de inventário de autorização, tech_spec e task.
// POR QUÊ: a `Decision` da 0021 tem por sujeito *"toda transição de estado de entidade de negócio"*
//        e a segunda classe é *"atributo operacional do cadastro"*; o registro é criação de
//        cadastro, a consulta é leitura, e a verificação a RN-06 declara sem efeito — nenhuma das
//        três é uma coisa nem a outra, e o roster de *"Instâncias declaradas da segunda classe"*
//        não nomeia nenhuma. Invocá-la como cláusula governante foi rejeitado DUAS vezes: pelo
//        Gate 2 na rodada 1 (quatro citações aqui e duas no tech_spec) e pelo Gate 1 na rodada 2,
//        que achou a QUARTA cópia sobrevivente — o defeito voltou por caminho novo, que é a
//        assinatura do laço longo. É o modo de falha que a terceira das `Alternatives considered`
//        da própria 0021 previu por escrito: *"um gate futuro leria violação onde houve decisão"*.
// REVERTER EXIGE: a EMENDA da ADR-0021 acrescentando estes atos ao roster da segunda classe —
//        escalada ao usuário, nunca decisão de gate nem de executor. Foi a alternativa (b) que o
//        Gate 2 ofereceu e declarou fora do alcance dele. Sem essa emenda no texto da ADR, reapoiar
//        qualquer destas três rotas na 0021 reabre o achado e cria, para a fatia (ii), o precedente
//        de que *"basta a área porque o ato só alcança terceiro"* — que afrouxa a autorização, o
//        primeiro dos `Cons` da própria 0021.
/**
 * A área de tela que governa esta superfície.
 *
 * Constante nomeada, e não literal solto no decorador: o valor é **contrato publicado** — ele aparece
 * no corpo da recusa que o cliente lê, em `detalhes.exigido` —, e ter nome é o que permite à
 * auditoria de conteúdo examiná-lo sem casar uma cadeia escrita em dois lugares. É a partir desta
 * mesma constante que o registro declara a conjunção, e é isso que impede a área de divergir entre a
 * classe e o método.
 */
export const AREA_DAS_INTEGRACOES_BANCARIAS = 'TELA:integracoes_bancarias' as const;

/**
 * A ação sensível que governa o **registro** — chave do catálogo fechado da ADR-0011, declarada em
 * conjunção com a área na forma que a ADR-0018 fixa.
 *
 * Constante nomeada pela mesma razão da área acima, e por uma que só vale para ela: este valor
 * aparece em **três** pontos que precisam coincidir — a chave do catálogo fechado, a declaração do
 * método e o `detalhes.exigido` que a recusa publica. A coincidência entre os três é o que faz a
 * exigência ser verdade, e três literais soltos ficariam livres para divergir.
 */
export const ACAO_DE_CONFIGURACAO = 'ACAO:configurar_integracao' as const;

/**
 * Nome de campo usado quando a recusa é do corpo e o Zod não tem caminho a nomear.
 *
 * ⚠️ **Há uma declaração irmã em `certificado.service.ts`**, com o mesmo valor e a mesma razão — o
 * serviço nomeia o campo na recusa do material, este arquivo na recusa do esquema. Ficam duas
 * enquanto forem **duas**: no dia em que um **terceiro** ponto do módulo precisar do mesmo valor, as
 * três sobem para um módulo do próprio diretório e passam a ser importadas. O argumento que este
 * docblock faz contra o literal solto vale igual entre arquivos; o que hoje não se paga é a
 * indireção para um par.
 */
const CAMPO_DO_CORPO = 'corpo';

/**
 * A entidade nomeada na linha de trilha do registro (§13.1).
 *
 * ⚠️ Mesma situação de `CAMPO_DO_CORPO` acima: `certificado.service.ts` declara a irmã, e a promoção
 * para módulo compartilhado está condicionada ao terceiro consumidor.
 */
const ENTIDADE_DA_TRILHA = 'certificado_do_provedor';

/** A codificação em que o material chega no corpo — o esquema já a conferiu antes desta linha. */
const CODIFICACAO_DO_MATERIAL = 'base64';

@ApiTags('integracoes-bancarias')
@Controller(CAMINHO_DAS_INTEGRACOES_BANCARIAS)
@ExigeChave(AREA_DAS_INTEGRACOES_BANCARIAS)
export class CertificadoDoProvedorController {
  constructor(
    // A porta única para transação. É dela que sai o executor que os métodos do serviço recebem.
    @Inject(TOKEN_ACESSO_AO_NEGOCIO) private readonly banco: AcessoAoBanco,
    @Inject(CertificadoDoProvedorService)
    private readonly certificados: CertificadoDoProvedorService,
    @Inject(TOKEN_LOGGER) private readonly logger: Logger,
  ) {}

  @Post(SEGMENTO_DO_REGISTRO)
  // A CONJUNÇÃO INTEIRA, e nunca só a ação: `getAllAndOverride` faz esta declaração **substituir** a
  // da classe, de modo que `@ExigeChave(ACAO_DE_CONFIGURACAO)` apagaria a área em silêncio e este
  // manipulador passaria a exigir MENOS que a classe dele. A ordem é conteúdo — a recusa nomeia a
  // PRIMEIRA ausente (ADR-0018), e a área vem antes para que quem já a tem ouça o nome da ação.
  @ExigeChaves(AREA_DAS_INTEGRACOES_BANCARIAS, ACAO_DE_CONFIGURACAO)
  @ApiOperation({
    summary: 'Registra ou renova o certificado do provedor',
    description:
      'Recebe o material PKCS#12 em base64 e a senha que o abre, confere que a senha o abre e que ' +
      'a validade não terminou, e grava a identidade da empresa **da sessão**. O corpo é ' +
      '**completo e fechado**: os dois campos são obrigatórios, campo ausente é `422` — nunca ' +
      '"preserve o valor atual" — e chave desconhecida é recusada. Registrar de novo **substitui**: ' +
      'o certificado anterior continua consultável no histórico e o segredo dele deixa de existir ' +
      'no mesmo ato, de modo que a resposta é `201` e não `200`. **O material e a senha não voltam ' +
      'em resposta alguma** — o que sai é o que se lê do certificado: titular, validade, impressão ' +
      'digital, autoria e desde quando, mais `materialConvertido`, que declara se o arquivo ' +
      'enviado **precisou ser convertido** para ser aceito. Material embalado na cifra que a ' +
      'Autoridade Certificadora entrega é convertido aqui, e o que se guarda é o **convertido**. ' +
      'As **três** causas de recusa saem com `422` e **códigos distintos**: senha que não abre, ' +
      'arquivo que não se deixa ler nem converter, e validade já encerrada — esta última ' +
      'informando em `detalhes.validoAte` a data em que ela terminou.',
  })
  @ApiCreatedResponse({
    description:
      'O certificado registrado, com o estado da vigência derivado no ato e a declaração de que o ' +
      'material precisou (ou não) ser convertido.',
    schema: esquemaPublicado(esquemaDoDesfechoDoRegistroDeCertificado, 'output'),
  })
  @ApiUnauthorizedResponse({ schema: esquemaDoErro([CodigoErro.NAO_AUTENTICADO]) })
  @ApiForbiddenResponse({ schema: esquemaDoErro([CodigoErro.ACESSO_NEGADO]) })
  // Os quatro códigos que esta rota pode responder com `422`, e a lista é conteúdo: o primeiro é a
  // recusa do ESQUEMA (campo ausente, chave desconhecida, teto excedido), e os três seguintes são as
  // causas do MATERIAL, cada uma com código próprio desde a F5. Declarar só `CAMPO_INVALIDO` faria o
  // documento publicado prometer uma recusa que a rota não emite mais para as três.
  @ApiUnprocessableEntityResponse({
    schema: esquemaDoErro([
      CodigoErro.CAMPO_INVALIDO,
      CodigoErro.SENHA_DO_MATERIAL_NAO_ABRE,
      CodigoErro.MATERIAL_EM_FORMATO_NAO_SUPORTADO,
      CodigoErro.CERTIFICADO_COM_VALIDADE_ENCERRADA,
    ]),
  })
  async registrar(
    @Body() corpo: unknown,
    @Req() requisicao: FastifyRequest,
  ): Promise<DesfechoDoRegistroDeCertificado> {
    const entrada = validar(esquemaDoCertificadoNovo, corpo, CAMPO_DO_CORPO);
    // A CONTENÇÃO, na primeira instrução depois da validação (ADR-0032). Daqui para baixo não existe
    // uma linha que toque `entrada.material` ou `entrada.senha`: o que viaja é o invólucro opaco, e
    // a decodificação acontece dentro desta expressão para que os **bytes** não ganhem nome próprio
    // no escopo — uma variável com o cofre decodificado seria exatamente o que um registro de
    // diagnóstico futuro acharia à mão.
    const segredo = criarSegredoOperavel({
      material: Buffer.from(entrada.material, CODIFICACAO_DO_MATERIAL),
      senha: entrada.senha,
    });

    // FORA da unidade de trabalho, e a posição é decisão: o aperto de mão em laço local que abre o
    // cofre é I/O — e desde a F5 ele pode ser precedido de um subprocesso de conversão, que é I/O de
    // ordem de grandeza maior. Mantê-los aqui é o que impede uma conexão física de ficar reservada
    // durante os dois. O teto do ato inteiro é declarado em `prepararMaterial`.
    const preparado = await this.certificados.prepararMaterial(segredo);

    const { desfecho, empresaId } = await sobContextoDaSessao(
      this.banco,
      requisicao,
      async (tx, sessao) => {
        // O que se cifra e guarda é o material PREPARADO — o convertido, quando houve conversão
        // (ADR-0036) —, e nunca o invólucro que chegou no corpo.
        const registrado = await this.certificados.registrar(
          tx,
          preparado.lido,
          preparado.segredo,
          sessao.usuarioId,
        );

        // Os campos são os que a §13.1 nomeia para este evento. **Nada do corpo entra**: a impressão
        // digital é o resumo público do material — o mesmo que a resposta publica —, e é ela que
        // permite casar uma emissão futura com o certificado que a assinou.
        this.logger.info(
          {
            empresaId: sessao.empresaId,
            entidade: ENTIDADE_DA_TRILHA,
            certificadoId: registrado.id,
            impressaoDigital: registrado.impressaoDigital,
          },
          'certificado do provedor registrado',
        );

        // O desfecho do ATO acompanha a projeção do certificado, e não entra nela: `esquemaDoCertificado`
        // descreve o certificado, e "foi convertido" é propriedade de tê-lo registrado. É o mesmo
        // desenho, e a mesma razão, da resposta da ativação de contrato — ver o esquema em
        // `@sysloc/contracts`.
        return {
          desfecho: { ...registrado, materialConvertido: preparado.convertido },
          empresaId: sessao.empresaId,
        };
      },
    );

    // A PARTIR DAQUI O CERTIFICADO ESTÁ COMMITADO, e é por isso que o enfileiramento vem aqui e não
    // lá dentro: a tarefa correria contra uma linha que a transação ainda podia desfazer. É a mesma
    // ordem, com a mesma razão, de `../cobranca-bancaria/cobranca-bancaria.controller.ts`.
    //
    // ⚠️ **Ele NÃO derruba a resposta** (RN-12): a identidade com que a empresa se apresenta ao banco
    // mudou, e o que a reconferência faz é atualizar o que o produto sabe sobre a entrega da notícia
    // dela — efeito secundário cujo resultado não compõe esta resposta (ADR-0029). A falha ao
    // enfileirar é registrada em `warn` dentro do serviço e o `201` permanece.
    await this.certificados.enfileirarReconferencia({ empresaId }, desfecho.id);

    return desfecho;
  }

  @Get(SEGMENTO_DA_CONSULTA)
  // NADA é declarado neste método, e a ausência é a decisão: consultar qual certificado está valendo
  // não é ato sensível, e a exigência da classe — a área — é o que a guarda encontra. Declarar aqui a
  // mesma área criaria um segundo lugar para esquecê-la; declarar a ação faria a leitura pedir a
  // chave do registro, e quem administra a integração deixaria de conseguir ver que o material vence
  // em uma semana.
  @ApiOperation({
    summary: 'Consulta o certificado vigente da empresa',
    description:
      'Devolve o certificado que está valendo na empresa **da sessão**, com `estado` e ' +
      '`diasParaVencer` **derivados** da validade contra a data corrente da operação — nunca ' +
      'colunas gravadas. `VENCIDO` quando a validade já passou, `VENCENDO` quando faltam 30 dias ou ' +
      'menos, `VIGENTE` no restante; por isso a mesma linha é publicada com estados diferentes em ' +
      'dias diferentes, e nenhuma rotina "atualiza" estado. Um certificado **vencido continua ' +
      'sendo o vigente** e sai com `200` — é o que a empresa tem, e é o que ela precisa ver para ' +
      'renovar. A empresa que nunca registrou recebe `404` nomeando a ausência: não existe ' +
      'identidade de reserva. **O material e a senha não saem por esta rota**, nem por nenhuma.',
  })
  @ApiOkResponse({
    description: 'O certificado vigente, com o estado da vigência derivado no ato da leitura.',
    schema: esquemaPublicado(esquemaDoCertificado, 'output'),
  })
  @ApiUnauthorizedResponse({ schema: esquemaDoErro([CodigoErro.NAO_AUTENTICADO]) })
  @ApiForbiddenResponse({ schema: esquemaDoErro([CodigoErro.ACESSO_NEGADO]) })
  @ApiNotFoundResponse({ schema: esquemaDoErro([CodigoErro.RECURSO_NAO_ENCONTRADO]) })
  async consultar(@Req() requisicao: FastifyRequest): Promise<Certificado> {
    return await sobContextoDaSessao(
      this.banco,
      requisicao,
      async (tx) => await this.certificados.consultar(tx),
    );
  }

  @Post(`${SEGMENTO_DA_CONSULTA}/${SEGMENTO_DA_VERIFICACAO}`)
  // NADA é declarado neste método, e a ausência é a decisão — a mesma da consulta: a verificação não
  // transfere direito, não move dinheiro e não altera o que outra entidade pode fazer; a **RN-06** a
  // declara **sem efeito**. Quem governa é a ADR-0011 (toda rota declara, e o que a guarda encontra
  // aqui é a declaração da classe) com a ADR-0018 (conjunção e cobertura por CONTEÚDO) — a ADR-0021
  // entra só por analogia, e o cabeçalho diz por quê. Quem exige a conjunção é o registro, que troca
  // a identidade com que a empresa cobra. Declarar aqui a mesma área criaria um segundo lugar para
  // esquecê-la, e declarar a ação faria quem administra a integração precisar do poder de trocar o
  // certificado só para descobrir se o atual funciona.
  //
  // É `POST` e não `GET` apesar de nada mudar aqui dentro: o ato **alcança um terceiro**, e um `GET`
  // prometeria a segurança de repetição que uma chamada de rede não tem — e convidaria intermediário
  // a repeti-la com o material decifrado. A forma *"ato é rota própria"* é a mesma régua da ADR-0021,
  // citada por analogia: a `Decision` dela fixa isso de **transição de estado**, e esta rota não é uma.
  //
  // `200`, e não o `201` que o arcabouço dá a todo `@Post`: **nada é criado**, e nada é gravado.
  @HttpCode(200)
  @ApiOperation({
    summary: 'Verifica a identidade da empresa contra o provedor',
    description:
      'Apresenta ao provedor o certificado **vigente da empresa da sessão** e responde se ele foi ' +
      'aceito. A pergunta é respondida nos dois desfechos: aceito é `200` com `aceito: true`, e ' +
      '**recusado pelo provedor também é `200`**, com `aceito: false` — a recusa é resposta, não ' +
      'falha do serviço, e um `5xx` diria ao Admin que o sistema quebrou onde o fato é que a ' +
      'identidade não serve. Não alcançar a instituição, ou ela não concluir a conferência no prazo, ' +
      'degrada do mesmo jeito: `200` com `aceito: false` e `detalhe` nomeando o desfecho. **Nada é ' +
      'gravado** — a linha do certificado permanece exatamente como estava — e nada é enfileirado. O ' +
      '`detalhe` é preenchido também no desfecho positivo, e ali ele não é ornamento: a sonda é o ' +
      'aperto de mão mútuo, de modo que o aceite confirma a identidade da empresa perante a ' +
      'instituição e **não** confirma que a emissão de cobrança já está habilitada. A empresa que ' +
      'nunca registrou recebe `404` nomeando a ausência, **sem que identidade alguma seja tentada**: ' +
      'não existe certificado de reserva. O corpo é **vazio e fechado**.',
  })
  @ApiOkResponse({
    description: 'O desfecho da verificação — inclusive quando o provedor recusou a identidade.',
    schema: esquemaPublicado(esquemaDoResultadoDaVerificacao, 'output'),
  })
  @ApiUnauthorizedResponse({ schema: esquemaDoErro([CodigoErro.NAO_AUTENTICADO]) })
  @ApiForbiddenResponse({ schema: esquemaDoErro([CodigoErro.ACESSO_NEGADO]) })
  @ApiNotFoundResponse({ schema: esquemaDoErro([CodigoErro.RECURSO_NAO_ENCONTRADO]) })
  @ApiUnprocessableEntityResponse({ schema: esquemaDoErro([CodigoErro.CAMPO_INVALIDO]) })
  async verificar(
    @Body() corpo: unknown,
    @Req() requisicao: FastifyRequest,
  ): Promise<ResultadoDaVerificacao> {
    validar(ESQUEMA_DO_CORPO_VAZIO, corpo ?? {}, CAMPO_DO_CORPO);

    // A unidade de trabalho cobre **só a leitura**, e este `await` a FECHA: o cliente mTLS ainda não
    // existe quando a conexão física volta para a reserva. A empresa sem certificado nem chega à
    // linha seguinte — o `404` sai daqui de dentro (RN-01).
    const { guardada, empresaId } = await sobContextoDaSessao(
      this.banco,
      requisicao,
      async (tx, sessao) => ({
        guardada: await this.certificados.lerIdentidadeGuardada(tx),
        empresaId: sessao.empresaId,
      }),
    );

    // FORA de transação, e a posição é a decisão desta rota. A duração é medida em volta do ato
    // inteiro — decifra mais aperto de mão —, porque é ela que o operador lê no journal para saber
    // se o provedor está lento, e não um recorte que exclua a parte que ele não controla.
    //
    // ⚠️ O relógio é o **monotônico** (`performance.now`), e a escolha não é para escapar de asserção
    // nenhuma: `Date.now()` é o instrumento errado para medir duração, porque um ajuste de relógio do
    // sistema durante os até dez segundos do teto produziria uma duração inflada — ou negativa. Nada
    // aqui é **data**: `performance.now()` não sabe que dia é hoje, e por construção não pode
    // alimentar decisão de vigência. A ADR-0026 continua valendo onde ela incide, e a rede que a
    // guarda nesta área (`apps/api/test/vigencia-do-certificado.spec.ts`, CT-865) **não foi tocada**:
    // a data corrente da operação segue vindo do banco, e o carimbo do ato externo segue vindo do
    // adaptador.
    const comecouEm = performance.now();
    const resultado = await this.certificados.verificarIdentidade(guardada);
    const duracaoMs = Math.round(performance.now() - comecouEm);

    // Os campos são os que a §13.1 nomeia para este evento. **Nada do material entra**: o que se
    // registra é qual certificado foi apresentado, se o par o aceitou e quanto o ato demorou. O
    // `detalhe` também fica de fora — ele é texto para a tela do Admin, e repeti-lo no journal
    // encheria a trilha de prosa sem fato novo.
    this.logger.info(
      {
        empresaId,
        entidade: ENTIDADE_DA_TRILHA,
        certificadoId: guardada.certificadoId,
        aceito: resultado.aceito,
        duracaoMs,
      },
      'identidade do provedor verificada',
    );

    return resultado;
  }
}
