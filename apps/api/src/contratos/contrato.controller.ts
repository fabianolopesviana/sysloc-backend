/**
 * As **seis rotas de cadastro do contrato de locação** — montar, listar, ler, alterar, retirar de
 * circulação e recircular — mais as **duas transições de estado governadas do produto**
 * (`POST /:codigo/ativacao` e `POST /:codigo/cancelamento`). Com a segunda, a máquina de estados
 * fecha.
 *
 * ---------------------------------------------------------------------------
 * A exigência é declarada na CLASSE, e a dimensão é a de CHAVE
 * ---------------------------------------------------------------------------
 *
 * `@ExigeChave(AREA_DOS_CONTRATOS)` na classe vale para os seis manipuladores — a guarda lê o metadado
 * com `getAllAndOverride`, e a declaração da classe é o que ela encontra quando o método não declara
 * nada próprio. Declarar seis vezes o mesmo valor criaria seis lugares para esquecer um.
 *
 * A dimensão é a de **chave**, e nunca a de perfil (§11.2): é o que permite ao Admin conceder e
 * retirar o alcance à carteira de contratos por ajuste individual, com a negação individual vencendo a
 * matriz do perfil (ADR-0010). O Sysloc Master **não alcança** estas rotas, e é por construção: a
 * matriz de perfil dele é vazia e a exigência aqui é por chave (ADR-0013).
 *
 * ---------------------------------------------------------------------------
 * As DUAS rotas de circulação exigem a ÁREA **E** a AÇÃO — conjunção, não substituição
 * ---------------------------------------------------------------------------
 *
 * Elas declaram `@ExigeChaves(AREA_DOS_CONTRATOS, ACAO_DE_CIRCULACAO)` — a **conjunção inteira**, e
 * não apenas a ação. A forma intuitiva (`@ExigeChave` no método, contando com a área da classe) está
 * errada e o erro é **silencioso**: `getAllAndOverride` faz a declaração do método **substituir** a da
 * classe, e a área desaparece daquelas duas rotas.
 *
 * A razão por extenso, com o defeito medido e explorável que a produziu, está no marcador
 * `DECISÃO FECHADA` de {@link ../imoveis/conjunto.controller.js} — **é ele que governa esta escolha
 * aqui também**, e por isso não é copiado: marcador replicado apodrece, porque o original é corrigido
 * e a cópia não. A decisão que o torna exprimível é a **ADR-0018**, e a rede que impede a substituição
 * de renascer nesta superfície é o `CT-355`, que varre a aplicação inteira e acusa qualquer
 * manipulador que exija **menos** do que a classe dele.
 *
 * **A ordem das duas chaves é conteúdo, e não estilo**: a recusa nomeia a **primeira** ausente
 * (RN-14). Com a área declarada antes da ação, quem tem a área e não tem a ação recebe
 * `detalhes.exigido: 'ACAO:excluir_cadastro'`, e quem tem a ação e não tem a área recebe o nome da
 * área — que é a direção pela qual o defeito da fatia anterior era explorável. Aqui a distinção é
 * ainda mais material do que em `/v1/imoveis`: `MAPA_ACAO_TELA['ACAO:excluir_cadastro']` é
 * `TELA:cadastros`, que **não** é a área desta classe, de modo que declarar só a ação daria a quem
 * administra locador, locatário e fiador o poder de retirar contratos de circulação numa área que lhe
 * é negada.
 *
 * ---------------------------------------------------------------------------
 * As DUAS TRANSIÇÕES são rotas PRÓPRIAS, e cada uma tem a SUA ação (ADR-0021, ADR-0018)
 * ---------------------------------------------------------------------------
 *
 * `POST /:codigo/ativacao` declara `@ExigeChaves(AREA_DOS_CONTRATOS, ACAO_DE_ATIVACAO)` e
 * `POST /:codigo/cancelamento` declara `@ExigeChaves(AREA_DOS_CONTRATOS, ACAO_DE_CANCELAMENTO)`. A
 * forma é a mesma das duas rotas de circulação, e a razão por extenso está no marcador
 * `DECISÃO FECHADA` de {@link ../imoveis/conjunto.controller.js} — declarar aqui só a ação
 * **substituiria** a exigência da classe, e `TELA:contratos` sumiria destas rotas em silêncio.
 *
 * **A ação é outra a cada ato, e a diferença é o ponto da ADR-0021**: transitar estado não é
 * cadastrar, e `ACAO:ativar_contrato` e `ACAO:cancelar_contrato` existem no catálogo fechado desde a
 * fase de autorização exatamente para separar quem monta, de quem faz valer, de quem desfaz. Exigir
 * qualquer uma delas na rota de **criação** desfaria essa separação — é a alternativa que a ADR
 * rejeita por escrito. Nenhuma chave nova é criada (ADR-0011).
 *
 * **Os dois atos desta superfície estão NOMINALMENTE na primeira classe da ADR-0021** — a que exige
 * a chave de ação —, e é por isso que a exigência aqui não é julgamento local: a `Decision` cita
 * *"a ativação de contrato, o cancelamento de CONTRATO e a retirada de circulação"*, as três com
 * chave própria já existente. A 0021 recortou a regra mecânica da 0019 em duas classes, e o que
 * decide é a **natureza do ato**: quem é atributo operacional do cadastro — não transfere direito,
 * não move dinheiro, não altera o que outra entidade pode fazer — exige apenas a área. Aqui não é
 * o caso, e a distância entre as classes é curta: o cancelamento de **cobrança** está na segunda,
 * por nome, e confundir os dois é o erro que a T7 desta fatia custou uma rodada de gate.
 *
 * **As três ações desta superfície são independentes, e a mais tentadora das confusões é reaproveitar
 * `ACAO:excluir_cadastro` para cancelar.** A rejeição segue **nominal e vigente**: ela está escrita
 * no `Context` da **ADR-0021**, que a herda da 0019 ao supersedê-la, e a `Decision` fecha o assunto
 * pelo outro lado ao dar ao cancelamento de contrato a **sua** chave. A razão é de
 * efeito: retirar de circulação é visibilidade e **não libera o imóvel**; cancelar é transição e
 * **libera**. Quem administra a circulação de cadastros não pode, por isso, destravar um imóvel. As
 * quatro rotas que declaram no método são adjacentes neste fonte, e a linha copiada da vizinha é o
 * erro provável — o `CT-320 (b)` e o `CT-320 (c)` de `test/autorizacao-do-dominio.e2e.spec.ts` medem
 * exatamente essa escalada, com uma sessão que **tem** as outras ações.
 *
 * A ordem é área **antes** da ação, e ela é conteúdo: a recusa nomeia a **primeira** ausente, de modo
 * que quem tem a área e não tem a ação recebe `detalhes.exigido: 'ACAO:cancelar_contrato'` — o nome
 * do que de fato lhe falta. Invertida, quem só cadastra receberia o nome de uma área que já possui.
 *
 * O estado **não é escolhido pelo cliente**: o corpo das duas é vazio e fechado, e `status` sequer
 * existe no esquema de entrada de contrato. Sem o corpo fechado, quem enviasse `{"status":"ATIVO"}`
 * receberia `200` e acreditaria ter escolhido o estado.
 *
 * ---------------------------------------------------------------------------
 * A CRIAÇÃO e a ATIVAÇÃO abrem DUAS unidades de trabalho SEQUENCIAIS (ADR-0015, ADR-0020)
 * ---------------------------------------------------------------------------
 *
 * ```
 * criar    · unidade 1:  contratos.garantirSerie(tx) → ano do CONTRATO, e COMMITA
 *            unidade 2:  conferências; emissão do número; gravação do contrato e dos fiadores
 *
 * ativar   · unidade 1:  cobrancas.garantirSerie(tx) → ano da COBRANÇA, e COMMITA
 *            unidade 2:  conferências; transição; ocupação do imóvel; emissão dos N números e
 *                        gravação das N parcelas
 * ```
 *
 * **A razão não é estilo, e este é o ponto mais fácil de "simplificar" desta superfície.** Se a
 * criação da sequência e o `nextval` ficassem na mesma transação, o desfazimento apagaria a sequência
 * recém-criada e o registro seguinte tomaria `nextval = 1` outra vez — o número **seria reusado**,
 * contra a cláusula literal da ADR-0015 (*"nunca reusado, nem por criação abortada"*). Com as duas
 * unidades, a sequência já está commitada quando o `nextval` corre, e a criação abortada queima o
 * número para sempre: o furo que a ADR aceita por escrito, e que o `CT-404` e o `CT-536` medem.
 *
 * Nas duas rotas as unidades **não aninham** — a segunda começa depois de a primeira fechar —, então o
 * marcador `DECISÃO FECHADA` de `packages/db/src/unidade-de-trabalho.ts`, que recusa abrir uma segunda
 * unidade **de dentro** de uma aberta, **não é tocado**. As demais rotas abrem uma unidade só.
 *
 * O **ano** sai de dentro da primeira unidade e viaja para a segunda: ele é lido do relógio do banco
 * uma única vez, e é o mesmo valor que alimenta o contador, a emissão e o código. Ver
 * {@link ContratoService.garantirSerie} e {@link CobrancaService.garantirSerie}.
 *
 * **São contadores diferentes, e os dois anos saem de relógios diferentes de propósito.** A criação
 * garante o contador do CONTRATO (`lerAnoDaSerieDeContrato`, fuso da sessão); a ativação garante o da
 * COBRANÇA (`lerAnoDaSerieDeCobranca`, `negocio.data_corrente_da_operacao()`, fuso do objeto — o mesmo
 * eixo que a visão `negocio.cobranca_derivada` consulta para classificar a linha). Reusar um pelo outro
 * poria o código de um ano no contador do outro nas horas em torno da virada, e a razão por extenso está
 * no docblock de `lerAnoDaSerieDeCobranca`. A ativação **não** garante o contador do contrato: o código
 * do contrato foi emitido na criação e não muda.
 *
 * ---------------------------------------------------------------------------
 * A UNIDADE DE TRABALHO ABRE AQUI, na borda (decisão D1)
 * ---------------------------------------------------------------------------
 *
 * É o controlador que a abre, e o serviço **recebe** o executor. É o que torna a composição — o
 * contrato e os fiadores dele — um commit só. Todas as seis passam por {@link sobContextoDaSessao}, de
 * `comum/contexto-da-sessao.ts`, e nenhuma abre unidade por conta própria nem chama
 * `contextoDeTenant.executarCom`: a única origem legítima do contexto de tenant é a sessão que a
 * guarda publicou (ADR-0008), e propriedade instalada por ponto sobrevive só até o ponto seguinte.
 *
 * ---------------------------------------------------------------------------
 * A chave da rota é o CÓDIGO, e ele é validado e CANONIZADO antes de qualquer consulta
 * ---------------------------------------------------------------------------
 *
 * O contrato tem **série declarada**, e por isso a chave exposta é o código legível — nunca o UUID
 * interno (ADR-0017). `ESQUEMA_DO_CODIGO_DE_CONTRATO`, de `@syslocbr/contracts`, valida a **forma** e
 * canoniza a caixa (`trim` → maiúsculas). A validação acontece antes de a unidade de trabalho abrir:
 * um valor malformado é recusado com `422` sem tocar o banco, em vez de virar `404` depois de uma ida
 * inútil — e sem que a forma do identificador se torne um oráculo de existência. **O esquema é
 * importado, nunca redigitado**: normalizar em dois pontos deixa os dois livres para divergir.
 *
 * ---------------------------------------------------------------------------
 * O `PUT` carrega o corpo COMPLETO, e o corpo dos atos é VAZIO e FECHADO
 * ---------------------------------------------------------------------------
 *
 * Não há atualização parcial nesta superfície: o `PUT` usa o **mesmo** `esquemaDeContratoNovo` do
 * `POST`, campo ausente é recusa por campo obrigatório, e `fiadoresIds` é substituída por inteiro. O
 * `codigo` não está no corpo e não muda; `status`, `dataFimLocacao` e `valorTotalContrato` são
 * recusados como chave desconhecida pelo `strictObject` — a **ausência** deles no esquema é o
 * mecanismo (ADR-0021 — transição é rota própria, **nunca** campo gravado por atualização parcial do
 * recurso), e não uma conferência escrita aqui.
 *
 * O corpo das duas rotas de circulação é o objeto **vazio e fechado**: a marca de retirada é decidida
 * pelo servidor, e aceitá-la do cliente daria a ele o poder de datar a própria exclusão.
 *
 * ---------------------------------------------------------------------------
 * O documento publicado DERIVA dos esquemas (ADR-0016)
 * ---------------------------------------------------------------------------
 *
 * Nenhuma descrição de corpo ou de resposta é escrita à mão aqui: `esquemaPublicado` traduz o mesmo
 * objeto que confere a entrada.
 *
 * A **única** exceção é a rota do documento, e ela é autorizada por ADR: a **ADR-0028** decide que a
 * rota que devolve bytes permanece no contrato e declara **mídia**, **nome sugerido de arquivo** e o
 * **mesmo envelope de erro** — e nada além disso. Ver o docblock de
 * {@link ContratoController.documento}.
 *
 * ---------------------------------------------------------------------------
 * A ROTA DO DOCUMENTO herda a exigência da CLASSE, e NADA declara própria (ADR-0018)
 * ---------------------------------------------------------------------------
 *
 * `GET /:codigo/documento` é a **sétima** rota desta superfície, e ela é a única das quatro últimas
 * que **não** declara `@ExigeChaves` no método. A diferença não é esquecimento: baixar o documento é
 * **leitura** do que a área já dá — quem alcança `TELA:contratos` já lê o contrato inteiro por
 * `GET /:codigo` —, e nenhuma ação sensível do catálogo fechado corresponde a esse ato. Criar uma
 * seria contrato novo sem fonte (ADR-0011).
 *
 * ⚠️ **Declarar `@ExigeChave('TELA:contratos')` no método seria pior do que redundante.**
 * `getAllAndOverride` faz a declaração do método **substituir** a da classe, de modo que a linha
 * "óbvia" instalaria um segundo lugar por onde a área desta rota pode sumir em silêncio. O `CT-355`
 * varre a aplicação inteira e acusa manipulador que exija **menos** do que a classe dele — ele é a
 * rede, não a razão.
 *
 * **EMENDA — T10 da fatia `webhook-e-carne` (2026-08-19).** O texto acima é preservado; o que segue
 * o estende. `GET /:codigo/carne` é a **oitava** rota desta superfície, e ela é a **segunda** que não
 * declara nada no método — de modo que a rota do documento deixou de ser "a única". A razão é a
 * mesma, palavra por palavra: reunir os boletos das cobranças do contrato é **leitura** do que a área
 * já dá, nada é gravado (nem no banco nem na trilha — ADR-0034), e o catálogo fechado da ADR-0011 não
 * tem ação sensível correspondente. `packages/auth/src/catalogo-de-permissoes.ts` **não foi tocado**.
 *
 * As duas rotas que devolvem **bytes** desta classe partilham o tipo de mídia, o par de cabeçalhos e
 * a extensão do nome de arquivo, e a partilha é deliberada — ver o docblock de
 * {@link SEGMENTO_DO_CARNE}.
 */

import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Param,
  Post,
  Put,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiServiceUnavailableResponse,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import type { AcessoAoBanco } from '@sysloc/db';
import { CodigoErro, type Logger } from '@sysloc/shared';
import {
  type AtivacaoDeContrato,
  type Contrato,
  ESQUEMA_DO_CODIGO_DE_CONTRATO,
  envelopeDeLista,
  esquemaDaAtivacaoDeContrato,
  esquemaDaJanelaComCirculacao,
  esquemaDeContratoNovo,
  esquemaDoContrato,
  esquemaDoRecorteDoCarne,
} from '@syslocbr/contracts';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { ExigeChave, ExigeChaves } from '../autenticacao/exigencia.decorator.js';
import { CarneService } from '../cobrancas/carne.service.js';
import { CobrancaService } from '../cobrancas/cobranca.service.js';
import { sobContextoDaSessao } from '../comum/contexto-da-sessao.js';
import { ESQUEMA_DO_CORPO_VAZIO } from '../comum/esquema-de-corpo-vazio.js';
import { esquemaDoErro } from '../comum/esquema-de-erro.js';
import { esquemaPublicado } from '../comum/esquema-publicado.js';
import { validar } from '../comum/validacao.js';
import { TOKEN_ACESSO_AO_NEGOCIO, TOKEN_LOGGER } from '../configuracao/ambiente.js';
import { ContratoService, type PaginaDeContratos } from './contrato.service.js';

/** Caminho da superfície de contratos, relativo ao prefixo de versão (§4.1: `/v1/contratos/…`). */
export const CAMINHO_DOS_CONTRATOS = 'contratos';

/**
 * A área de tela que governa toda esta superfície (§4.1, §11.2).
 *
 * Constante nomeada, e não literal repetido em três decoradores: ela aparece na classe **e** dentro da
 * conjunção das duas rotas de circulação, e é justamente a coincidência entre os três que faz o "além
 * disso" ser verdade. Três literais ficariam livres para divergir — e a divergência seria muda para a
 * verificação de existência, ainda que o `CT-355` a pegue por conteúdo.
 */
const AREA_DOS_CONTRATOS = 'TELA:contratos' as const;

/** A ação sensível que as duas rotas de circulação exigem **além** da área (ADR-0011, §4.1). */
const ACAO_DE_CIRCULACAO = 'ACAO:excluir_cadastro' as const;

/**
 * A ação sensível que a rota de ativação exige **além** da área (ADR-0011, ADR-0021, §4.1).
 *
 * Ela **já existe** no catálogo fechado desde a fase de autorização, e nenhuma chave nova é criada
 * nesta fatia — precisar de uma seria sinal de escopo mal delimitado. Constante nomeada porque o
 * literal é contrato: ele aparece no decorador **e** no corpo da recusa que o cliente lê.
 */
const ACAO_DE_ATIVACAO = 'ACAO:ativar_contrato' as const;

/**
 * A ação sensível que a rota de cancelamento exige **além** da área (ADR-0011, ADR-0021, §4.1).
 *
 * Ela também **já existe** no catálogo fechado, e é **outra** que não a de ativar: o cancelamento de
 * CONTRATO está nominalmente na primeira classe da ADR-0021 e leva a **sua** chave, de modo que
 * conceder o poder de fazer valer não concede o de desfazer. Reaproveitar `ACAO:excluir_cadastro`
 * aqui é a alternativa que a ADR rejeita nominalmente — retirar de circulação e cancelar têm efeitos
 * diferentes sobre o imóvel. ⚠️ **Não leia isto como regra para toda transição**: a 0021 exige a
 * chave conforme a natureza do ato, e o cancelamento de **cobrança** — outra entidade — está na
 * segunda classe, exigindo apenas a área.
 */
const ACAO_DE_CANCELAMENTO = 'ACAO:cancelar_contrato' as const;

/** Nome de campo usado quando a recusa não tem caminho a nomear — o identificador da rota. */
const CAMPO_DO_CODIGO = 'codigo';

/** Nome de campo usado quando a recusa é do corpo e o Zod não tem caminho a nomear. */
const CAMPO_DO_CORPO = 'corpo';

/** Nome de campo usado quando a recusa é da cadeia de consulta. */
const CAMPO_DA_CONSULTA = 'limite';

/**
 * Nome de campo usado quando a recusa do **recorte do carnê** não tem caminho a nomear.
 *
 * Ele é `recorte`, e não `de`: o caso sem caminho é a **chave desconhecida** na cadeia de consulta,
 * que o objeto estrito reporta com caminho vazio — e ali o que está errado não é `de` nem `ate`, é o
 * conjunto. Nomear uma das duas pontas mandaria quem recebe a recusa corrigir um campo que está
 * certo. Não se reusa {@link CAMPO_DA_CONSULTA} pela mesma razão ao contrário: `limite` é campo da
 * janela da carteira, e esta rota não tem janela.
 */
const CAMPO_DO_RECORTE = 'recorte';

/** A entidade nomeada na linha de trilha desta superfície — escrita uma vez, usada nas duas. */
const ENTIDADE_DA_TRILHA = 'contrato';

/**
 * O que a rota do documento declara, conforme a **ADR-0028** — os três valores, nomeados uma vez.
 *
 * Eles são **contrato publicado**, e aparecem em **dois** lugares cada: no documento OpenAPI, que o
 * frontend lê para gerar o cliente, e no cabeçalho que a resposta de fato escreve. É justamente a
 * coincidência entre os dois que faz a declaração ser verdade — dois literais ficariam livres para
 * divergir, e o modo de falha é o pior possível: o documento anunciaria um tipo de mídia e a resposta
 * traria outro, sem que nada acusasse.
 *
 * Os nomes dos cabeçalhos são escritos em minúsculas porque é assim que o adaptador HTTP os
 * normaliza; o valor de `Content-Disposition` é composto no ponto da resposta, porque a metade dele
 * é o código do contrato.
 */
const TIPO_DE_MIDIA_DO_DOCUMENTO = 'application/pdf';
const CABECALHO_DO_TIPO = 'content-type';
const CABECALHO_DA_DISPOSICAO = 'content-disposition';

/** A extensão do nome de arquivo sugerido — a outra metade de `attachment; filename="…"`. */
const EXTENSAO_DO_DOCUMENTO = '.pdf';

/**
 * O que a rota do **carnê** declara, conforme a ADR-0028 — e por que ela reusa o que já está acima.
 *
 * O tipo de mídia, os dois nomes de cabeçalho e a extensão são **os mesmos** da rota do documento, e
 * a reutilização é deliberada: as duas rotas desta classe devolvem PDF por acaso do mesmo domínio, e
 * um segundo `'application/pdf'` escrito quatro linhas abaixo do primeiro seria a cópia que diverge
 * no dia em que uma das duas mudar. Aqui **não há fronteira de fatia entre elas** — é o mesmo
 * arquivo, o mesmo par de cabeçalhos e a mesma resposta —, ao contrário do que acontece entre este
 * controlador e o da cobrança, onde a segunda cópia é justificada por escrito.
 *
 * O que é **próprio** desta rota é só o segmento e a composição do nome do arquivo, abaixo.
 */
const SEGMENTO_DO_CARNE = ':codigo/carne';

/**
 * Quantos caracteres da competência entram no nome do arquivo — `YYYY-MM`, sem o dia.
 *
 * O dia é sempre `01` (é o que `esquemaDoRecorteDoCarne` exige), de modo que carregá-lo no nome
 * acrescentaria seis caracteres que não distinguem carnê nenhum de outro. O que quem baixa doze
 * carnês precisa ler na pasta de downloads é o contrato e os dois meses.
 */
const CARACTERES_DA_COMPETENCIA_NO_NOME = 7;

/**
 * O nome sugerido do arquivo do carnê — `<codigo>-<de>-<ate>.pdf`.
 *
 * ⚠️ **Nada aqui escapa nada, e a ausência é a decisão**, pela mesma razão registrada na rota do
 * documento: as três partes já foram **canonizadas pelos esquemas** antes de chegar — o código passou
 * por `ESQUEMA_DO_CODIGO_DE_CONTRATO`, que fixa `CTR-{ano}-{5 dígitos}` e passa a caixa para
 * maiúsculas, e as duas competências por `esquemaDoRecorteDoCarne`, que exige data ISO no primeiro
 * dia do mês. Não há aspa, quebra de linha ou caractere de controle capaz de atravessar esta linha,
 * porque **o que chega do cliente não chega até aqui**: o que chega é o que os esquemas produziram.
 */
function nomeDoArquivoDoCarne(codigo: string, de: string, ate: string): string {
  const inicio = de.slice(0, CARACTERES_DA_COMPETENCIA_NO_NOME);
  const fim = ate.slice(0, CARACTERES_DA_COMPETENCIA_NO_NOME);

  return `${codigo}-${inicio}-${fim}${EXTENSAO_DO_DOCUMENTO}`;
}

// O corpo das duas rotas de circulação **e** o das duas transições — **vazio e fechado** (§4.1.1) —
// é `ESQUEMA_DO_CORPO_VAZIO`, importado de `comum/esquema-de-corpo-vazio.js`. A marca de retirada e
// o estado são decididos pelo servidor, e nenhum campo é aceito; a razão por extenso, e por que a
// definição é única, estão no docblock daquele módulo (débito D23).

/** O envelope de lista de contratos, derivado do esquema do item — nunca redigitado (ADR-0017). */
const ESQUEMA_DA_PAGINA = envelopeDeLista(esquemaDoContrato);

@ApiTags('contratos')
@Controller(CAMINHO_DOS_CONTRATOS)
@ExigeChave(AREA_DOS_CONTRATOS)
export class ContratoController {
  constructor(
    // A porta única para transação. É dela que sai o executor que os métodos do serviço recebem, e é
    // ela que torna a operação inteira um commit só — e, na criação e na ativação, o que torna as DUAS
    // unidades sequenciais exprimíveis sem aninhamento.
    @Inject(TOKEN_ACESSO_AO_NEGOCIO) private readonly banco: AcessoAoBanco,
    @Inject(ContratoService) private readonly contratos: ContratoService,
    // O serviço da COBRANÇA entra aqui por **uma** razão: a garantia do contador da série dela, na
    // primeira unidade da ativação. Ele é **consumido**, e não recriado — `garantirSerie` já existe e é
    // quem sabe de qual relógio o ano da cobrança sai. Uma segunda garantia escrita nesta superfície
    // seria a segunda fonte do mesmo fato, com liberdade para escolher o eixo errado; e é ele que faz
    // `contratos.module.ts` importar `CobrancasModule`, em vez de prover o serviço duas vezes.
    @Inject(CobrancaService) private readonly cobrancas: CobrancaService,
    // O serviço do CARNÊ, pela mesma razão do de cobrança: ele é **consumido**, e não recriado. Ele
    // vive em `cobrancas/` porque o que ele compõe são boletos de cobrança — trazê-lo para cá
    // obrigaria esta superfície, governada por `TELA:contratos`, a receber a porta do provedor e a
    // guarda dos bytes. Quem o provê é `CobrancasModule`, que `contratos.module.ts` **já** importa
    // por causa da linha acima: nenhuma dependência de módulo nasceu nesta task.
    @Inject(CarneService) private readonly carnes: CarneService,
    @Inject(TOKEN_LOGGER) private readonly logger: Logger,
  ) {}

  @Post()
  @ApiOperation({
    summary: 'Monta um contrato de locação',
    description:
      'O contrato nasce na empresa **da sessão de quem monta** — a empresa nunca é aceita pelo ' +
      'corpo —, **em circulação** e como `RASCUNHO`: ele ainda **não vale**, e não ocupa o imóvel. ' +
      'O `codigo` é emitido pelo servidor no formato `CTR-{ano}-{5 dígitos}`, único por empresa e ' +
      '**nunca reusado** (ADR-0015). `dataFimLocacao` e `valorTotalContrato` saem **nulos**: são ' +
      'derivados na ativação. Imóvel, locador, locatário e cada fiador precisam ser alcançáveis no ' +
      'contexto da sessão — cadastro de outra empresa responde `404`, com o **mesmo** corpo de ' +
      'cadastro inexistente — e precisam estar **em circulação**: o retirado responde `422` ' +
      'nomeando o campo, com `detalhes.circulacao: RETIRADO_DE_CIRCULACAO`.',
  })
  @ApiCreatedResponse({
    description: 'O contrato foi montado, como rascunho.',
    schema: esquemaPublicado(esquemaDoContrato, 'output'),
  })
  @ApiUnauthorizedResponse({ schema: esquemaDoErro([CodigoErro.NAO_AUTENTICADO]) })
  @ApiForbiddenResponse({ schema: esquemaDoErro([CodigoErro.ACESSO_NEGADO]) })
  @ApiNotFoundResponse({ schema: esquemaDoErro([CodigoErro.RECURSO_NAO_ENCONTRADO]) })
  @ApiUnprocessableEntityResponse({ schema: esquemaDoErro([CodigoErro.CAMPO_INVALIDO]) })
  async criar(@Body() corpo: unknown, @Req() requisicao: FastifyRequest): Promise<Contrato> {
    const entrada = validar(esquemaDeContratoNovo, corpo, CAMPO_DO_CORPO);

    // PRIMEIRA unidade: ela **commita** antes de a segunda abrir, e é isso que impede o número de ser
    // reusado por uma criação abortada. Ver o cabeçalho deste arquivo — não funda as duas.
    const ano = await sobContextoDaSessao(
      this.banco,
      requisicao,
      async (tx) => await this.contratos.garantirSerie(tx),
    );

    // SEGUNDA unidade: as conferências, a emissão do número e a gravação do contrato com os fiadores,
    // num commit só. Ela abre depois de a primeira fechar, e por isso não aninha.
    return await sobContextoDaSessao(this.banco, requisicao, async (tx, sessao) => {
      const criado = await this.contratos.criar(tx, entrada, ano);

      this.logger.info(
        { empresaId: sessao.empresaId, entidade: ENTIDADE_DA_TRILHA, codigo: criado.codigo },
        'contrato montado',
      );

      return criado;
    });
  }

  @Get()
  @ApiOperation({
    summary: 'Lista a carteira de contratos da empresa',
    description:
      'Cada item traz código, partes, termos e estado — sem segunda consulta. Devolve apenas os ' +
      'contratos **em circulação**; `incluirRetirados=true` alcança também os que foram retirados ' +
      '(ADR-0014). A janela é declarável por `limite` e `deslocamento`, e pedido acima do teto ' +
      '**recusa** em vez de truncar em silêncio.',
  })
  @ApiOkResponse({
    description: 'A página pedida.',
    schema: esquemaPublicado(ESQUEMA_DA_PAGINA, 'output'),
  })
  @ApiUnauthorizedResponse({ schema: esquemaDoErro([CodigoErro.NAO_AUTENTICADO]) })
  @ApiForbiddenResponse({ schema: esquemaDoErro([CodigoErro.ACESSO_NEGADO]) })
  @ApiUnprocessableEntityResponse({ schema: esquemaDoErro([CodigoErro.CAMPO_INVALIDO]) })
  async listar(
    @Query() consulta: unknown,
    @Req() requisicao: FastifyRequest,
  ): Promise<PaginaDeContratos> {
    // O esquema vem **inteiro** de `@syslocbr/contracts`, que a ADR-0016 declara fonte única. A razão de
    // `incluirRetirados` ser união fechada de dois literais, e não `z.coerce.boolean()`, está por
    // extenso no docblock de `esquemaDaJanelaComCirculacao`.
    const { incluirRetirados, ...janela } = validar(
      esquemaDaJanelaComCirculacao,
      consulta,
      CAMPO_DA_CONSULTA,
    );

    return await sobContextoDaSessao(
      this.banco,
      requisicao,
      async (tx) => await this.contratos.listar(tx, janela, { incluirRetirados }),
    );
  }

  @Get(':codigo')
  @ApiOperation({
    summary: 'Lê um contrato pelo código',
    description:
      'Alcança também o contrato **retirado de circulação**, que responde `200` com `retiradoEm` ' +
      'preenchido — sem isso a recirculação ficaria inalcançável pela interface. Contrato de outra ' +
      'empresa é indistinguível de inexistente: `404` com o mesmo corpo. Código malformado é ' +
      'recusado com `422` **sem tocar o banco**.',
  })
  @ApiOkResponse({
    description: 'O contrato pedido.',
    schema: esquemaPublicado(esquemaDoContrato, 'output'),
  })
  @ApiUnauthorizedResponse({ schema: esquemaDoErro([CodigoErro.NAO_AUTENTICADO]) })
  @ApiForbiddenResponse({ schema: esquemaDoErro([CodigoErro.ACESSO_NEGADO]) })
  @ApiNotFoundResponse({ schema: esquemaDoErro([CodigoErro.RECURSO_NAO_ENCONTRADO]) })
  @ApiUnprocessableEntityResponse({ schema: esquemaDoErro([CodigoErro.CAMPO_INVALIDO]) })
  async ler(
    @Param('codigo') identificador: string,
    @Req() requisicao: FastifyRequest,
  ): Promise<Contrato> {
    const codigo = validar(ESQUEMA_DO_CODIGO_DE_CONTRATO, identificador, CAMPO_DO_CODIGO);

    return await sobContextoDaSessao(
      this.banco,
      requisicao,
      async (tx) => await this.contratos.ler(tx, codigo),
    );
  }

  @Get(':codigo/documento')
  // NADA é declarado aqui, e a ausência é o mecanismo: a exigência de `TELA:contratos` vem da
  // CLASSE, e `getAllAndOverride` é override — não união. Ver o cabeçalho deste arquivo.
  @ApiOperation({
    summary: 'Baixa o documento do contrato em PDF',
    description:
      'Devolve o contrato de locação **em PDF**, composto a partir do cadastro no instante do ' +
      'pedido (ADR-0030): o documento **não é armazenado** em lugar nenhum, e por isso não existe ' +
      'ato de regeração — alterar o contrato e pedir de novo já devolve o texto novo. Um contrato ' +
      '`CANCELADO` sai com a **marca de cancelamento** logo abaixo do título; um `RASCUNHO` sai ' +
      'com o valor total derivado de `valorMensal × prazoMeses`, ainda que o campo do contrato ' +
      'esteja nulo. A resposta é `application/pdf` com `Content-Disposition: attachment` sugerindo ' +
      '`<codigo>.pdf`. Contrato de outra empresa é indistinguível de inexistente: `404` com o ' +
      'mesmo corpo. Código malformado é recusado com `422` **sem tocar o banco**.',
  })
  // A ÚNICA declaração de resposta desta superfície que não deriva de um esquema, e a ADR-0028 é
  // quem a autoriza: a rota permanece no contrato publicado e declara **mídia**, **nome sugerido de
  // arquivo** e o **mesmo envelope de erro** das demais.
  //
  // ⚠️ `format: 'binary'` NÃO é declaração de forma — é o idioma que o OpenAPI tem para dizer *"isto
  // é uma sequência de bytes opaca"*, isto é, a declaração da AUSÊNCIA de forma. O que a `Decision`
  // proíbe, e o que esta rota não faz, é declarar a ESTRUTURA do sucesso: não há `esquemaPublicado`
  // aqui, nem objeto, nem campo. A leitura conjunta está registrada na §21.3 (1) do tech spec da
  // fatia, para que um gate futuro não leia violação onde houve leitura conjunta.
  //
  // E a **cláusula de exceção da ADR-0028 não se ativa**, o que foi MEDIDO e não suposto:
  // `ApiResponseCommonMetadata extends Omit<ResponseObject, 'description'>`, e `ResponseObject`
  // aceita `content` e `headers`. Não se escreve exceção declarada onde ela não é necessária.
  @ApiOkResponse({
    description: 'O contrato em PDF, composto no instante do pedido.',
    content: { [TIPO_DE_MIDIA_DO_DOCUMENTO]: { schema: { type: 'string', format: 'binary' } } },
    headers: {
      [CABECALHO_DA_DISPOSICAO]: {
        schema: { type: 'string' },
        description: 'attachment; filename="CTR-2026-00001.pdf"',
      },
    },
  })
  @ApiUnauthorizedResponse({ schema: esquemaDoErro([CodigoErro.NAO_AUTENTICADO]) })
  @ApiForbiddenResponse({ schema: esquemaDoErro([CodigoErro.ACESSO_NEGADO]) })
  @ApiNotFoundResponse({ schema: esquemaDoErro([CodigoErro.RECURSO_NAO_ENCONTRADO]) })
  @ApiUnprocessableEntityResponse({ schema: esquemaDoErro([CodigoErro.CAMPO_INVALIDO]) })
  async documento(
    @Param('codigo') identificador: string,
    @Req() requisicao: FastifyRequest,
    // `passthrough: true` porque o corpo continua sendo o **valor devolvido** — o que a resposta
    // precisa da instância é apenas dois cabeçalhos que dependem do `:codigo`. Sem `passthrough`, o
    // manipulador passaria a ser responsável por escrever a resposta inteira, e a forma dele
    // divergiria das outras seis desta classe sem ganho algum.
    @Res({ passthrough: true }) resposta: FastifyReply,
  ): Promise<Uint8Array> {
    const codigo = validar(ESQUEMA_DO_CODIGO_DE_CONTRATO, identificador, CAMPO_DO_CODIGO);

    // DECISÃO FECHADA — T7 / Gate 2 · 2026-08-13
    // (Ele PROTEGE — ao contrário de um `DÉBITO COM GATILHO`, que AGENDA. Alcance: a EXTENSÃO da
    //  unidade de trabalho deste manipulador, isto é, a repartição entre o que corre dentro da
    //  continuação e o que corre depois dela, aqui e nas duas assinaturas do serviço que a
    //  sustentam.)
    // O QUÊ: a unidade de trabalho desta rota cobre **apenas a leitura do agregado**; a composição e
    //        a renderização correm FORA dela. É a única rota desta borda em que a unidade não cobre
    //        o manipulador inteiro, e a exceção é deliberada.
    // POR QUÊ: `sobContextoDaSessao` é um `sql.begin` real, e a renderização custa ~0,5 s MEDIDOS
    //          pelo Gate 2 na rodada 1 — 5 amostras (784,9 / 416,7 / 501,1 / 655,8 / 601,4 ms) sobre
    //          o contrato mínimo, de 1 fiador e 14.960 bytes. Dentro da unidade ela reservava uma
    //          conexão física do pool — que é UM SÓ para o processo inteiro, no tamanho padrão de
    //          `postgres.js`, e é disputado por todas as outras rotas — e deixava um
    //          `idle in transaction` de meio segundo por download, segurando o horizonte de vacuum.
    //          Sob concorrência modesta o pool esgota e TODA outra rota passa a esperar por conexão:
    //          a degradação aparece longe da causa, e nenhum caso desta suíte mede concorrência. Por
    //          isso a rede é a asserção de TOPOLOGIA do `CT-714 (b)` — e por isso a decisão precisa
    //          deste marcador além dela: teste se altera com `SUT_IS_CORRECT_BECAUSE:`, marcador
    //          exige escalada.
    // REVERTER EXIGE: medir sob CONCORRÊNCIA o que a rodada 1 mediu em série, e demonstrar uma das
    //                 duas: (a) que `sobContextoDaSessao` deixou de reservar conexão física do pool
    //                 pelo tempo da continuação — hoje falso por construção, porque conexão
    //                 reservada é o que uma transação de `postgres.js` É —, ou (b) que a
    //                 renderização deixou de custar tempo da ordem da consulta que ela acompanha,
    //                 pela mesma metodologia registrada no docblock de
    //                 `ContratoService.renderizarDocumento`. Citar a medição em série NÃO satisfaz:
    //                 ela é a evidência do defeito, não da ausência dele. E, demonstrada qualquer
    //                 das duas, `renderizarDocumento` continua SEM `tx` na assinatura — é a ausência
    //                 do executor, e não a ordem das linhas, que a impede de tocar o banco.
    //
    // ⚠️ **Não "uniformize" isto de volta** para uma continuação só, por parecer-se com as outras
    // seis rotas desta classe: o desenho é deliberado, e o `CT-714 (b)` reprova quem o desfizer. O
    // que separa as duas metades é a assinatura — `renderizarDocumento` não recebe `tx` e não pode
    // tocar o banco —, e o `404` continua saindo do ponto único, DENTRO da unidade.
    const agregado = await sobContextoDaSessao(
      this.banco,
      requisicao,
      async (tx) => await this.contratos.agregadoDoDocumento(tx, codigo),
    );

    const bytes = await this.contratos.renderizarDocumento(agregado);

    // Os DOIS cabeçalhos são escritos **depois** de os bytes existirem, e a ordem é conteúdo: o
    // filtro global responde pela MESMA instância de `FastifyReply`, de modo que um `Content-Type:
    // application/pdf` definido antes da leitura sobreviveria à recusa e o envelope de erro da
    // ADR-0017 sairia anunciando-se como PDF. É a metade do `CT-715` que mede exatamente isso.
    resposta.header(CABECALHO_DO_TIPO, TIPO_DE_MIDIA_DO_DOCUMENTO);
    // O nome sugerido é o **código canonizado** — `ESQUEMA_DO_CODIGO_DE_CONTRATO` já validou a forma
    // `CTR-{ano}-{5 dígitos}` e passou a caixa para maiúsculas —, e por isso não há aqui aspa, quebra
    // de linha ou caractere de controle a escapar: o que chega do cliente não atravessa esta linha.
    resposta.header(
      CABECALHO_DA_DISPOSICAO,
      `attachment; filename="${codigo}${EXTENSAO_DO_DOCUMENTO}"`,
    );

    return bytes;
  }

  @Get(SEGMENTO_DO_CARNE)
  // NADA é declarado aqui, e a ausência é o mecanismo: a exigência de `TELA:contratos` vem da
  // CLASSE, e `getAllAndOverride` é override — não união. É a mesma forma, e a mesma razão, da rota
  // do documento logo acima: pedir o carnê é **leitura** do que a área já dá — quem alcança
  // `TELA:contratos` já lê o contrato inteiro e já baixa o documento dele —, e o catálogo fechado da
  // ADR-0011 não tem ação sensível correspondente. Criar uma seria contrato novo sem fonte.
  //
  // ⚠️ **Declarar `@ExigeChave(AREA_DOS_CONTRATOS)` aqui seria pior do que redundante**: instalaria
  // um segundo lugar por onde a área desta rota pode sumir em silêncio. E a ADR-0021 **não** alcança
  // esta rota: a `Decision` dela tem por sujeito a transição de estado de entidade de negócio, e
  // reunir documentos que já existem não transiciona coisa alguma — nada é gravado, nem no banco nem
  // na trilha (ADR-0034).
  @ApiOperation({
    summary: 'Baixa o carnê do contrato em PDF',
    description:
      'Reúne, **num documento só**, os boletos das cobranças deste contrato cujas competências ' +
      'caem no intervalo `de`..`ate` — as duas pontas **inclusive**, cada uma no formato ' +
      '`YYYY-MM-01`. As parcelas saem na ordem **crescente de vencimento**, que é a ordem em que ' +
      'quem paga as usa. O documento é composto no instante do pedido e **não é armazenado** em ' +
      'lugar nenhum (ADR-0030): pedir o mesmo recorte duas vezes devolve o que o cadastro diz ' +
      'agora. O recorte aceita no máximo **12** competências, e um pedido mais largo é recusado ' +
      'com `422` nomeando `ate` — o carnê é o caderno de um ano. Se o arquivo de algum boleto ' +
      'tiver sumido do disco, ele é **rebuscado do provedor e regravado**, de forma transparente: ' +
      'a resposta é a mesma, e nada é registrado no histórico bancário, porque rebuscar cache não ' +
      'é efeito (ADR-0034). Recorte que **não alcança cobrança alguma** responde `404` com ' +
      '`detalhes: { carne: "SEM_COBRANCAS" }`; cobrança do recorte **sem boleto emitido** responde ' +
      '`404` com `detalhes: { carne: "BOLETO_AUSENTE", cobranca: "<código>" }`, nomeando a ' +
      '**primeira** na ordem de vencimento — jamais um caderno com parcela faltando. Provedor ' +
      'indisponível durante a rebusca responde `503`, sem alterar coisa alguma. A resposta é ' +
      '`application/pdf` com `Content-Disposition: attachment` sugerindo ' +
      '`<codigo>-<de>-<ate>.pdf`. Contrato de outra empresa é indistinguível de inexistente: ' +
      '`404` com o mesmo corpo, **sem `detalhes`**. Código ou recorte malformado é recusado com ' +
      '`422` **sem tocar o banco**.',
  })
  // A segunda declaração de resposta desta superfície que não deriva de um esquema, e a ADR-0028 é
  // quem a autoriza pela mesma leitura registrada na rota do documento: a rota permanece no contrato
  // publicado e declara **mídia**, **nome sugerido de arquivo** e o **mesmo envelope de erro** das
  // demais — e nada sobre a estrutura do sucesso, que não tem estrutura.
  //
  // ⚠️ **A ENTRADA não é declarada no documento, e a ausência acompanha a base inteira**: nenhuma
  // rota desta API descreve corpo ou cadeia de consulta no OpenAPI — a rota de listagem logo acima
  // tem `limite` e `deslocamento` e não os declara. A ADR-0016 é respeitada onde ela alcança: o
  // `esquemaDoRecorteDoCarne` importado é a fonte **única** que confere a entrada, e nenhuma segunda
  // descrição dela é escrita à mão em paralelo. Publicar a entrada é trabalho de uma decisão própria
  // sobre toda a superfície, e não desta rota — antecipá-la aqui criaria a única rota da API que
  // descreve entrada, com uma forma que nenhuma outra segue.
  @ApiOkResponse({
    description: 'O carnê em PDF, composto no instante do pedido.',
    content: { [TIPO_DE_MIDIA_DO_DOCUMENTO]: { schema: { type: 'string', format: 'binary' } } },
    headers: {
      [CABECALHO_DA_DISPOSICAO]: {
        schema: { type: 'string' },
        description: 'attachment; filename="CTR-2026-00001-2026-01-2026-06.pdf"',
      },
    },
  })
  @ApiUnauthorizedResponse({ schema: esquemaDoErro([CodigoErro.NAO_AUTENTICADO]) })
  @ApiForbiddenResponse({ schema: esquemaDoErro([CodigoErro.ACESSO_NEGADO]) })
  @ApiNotFoundResponse({ schema: esquemaDoErro([CodigoErro.RECURSO_NAO_ENCONTRADO]) })
  @ApiUnprocessableEntityResponse({ schema: esquemaDoErro([CodigoErro.CAMPO_INVALIDO]) })
  // O `503` é da **rebusca**, e ele só existe nesta rota e na do boleto avulso: é o único ponto em
  // que atender a um `GET` desta base pode depender do provedor bancário estar de pé.
  @ApiServiceUnavailableResponse({ schema: esquemaDoErro([CodigoErro.SERVICO_INDISPONIVEL]) })
  async carne(
    @Param('codigo') identificador: string,
    @Query() consulta: unknown,
    @Req() requisicao: FastifyRequest,
    // `passthrough: true` pela mesma razão da rota do documento: o corpo continua sendo o **valor
    // devolvido**, e o que a resposta precisa da instância são os dois cabeçalhos que dependem do
    // `:codigo` e do recorte.
    @Res({ passthrough: true }) resposta: FastifyReply,
  ): Promise<Uint8Array> {
    // As DUAS conferências acontecem antes de qualquer ida ao banco, e a ordem entre elas não é
    // conteúdo — o que é conteúdo é as duas virem **antes** de `sobContextoDaSessao`: recorte
    // malformado é `422` sem que uma transação chegue a abrir.
    const codigo = validar(ESQUEMA_DO_CODIGO_DE_CONTRATO, identificador, CAMPO_DO_CODIGO);
    const recorte = validar(esquemaDoRecorteDoCarne, consulta, CAMPO_DO_RECORTE);

    // A unidade de trabalho cobre **apenas a leitura do estado**, e a repartição é a mesma da rota do
    // documento — cuja `DECISÃO FECHADA — T7 / Gate 2` registra a medição que a motivou — e a mesma
    // da rota do boleto avulso. Aqui a razão é ainda mais forte: o que corre depois dela é leitura de
    // disco e, no caminho raro, **até doze** conversas de rede com o provedor, com teto de dez
    // segundos cada. Dentro da unidade, um único carnê seguraria uma conexão física da reserva que
    // atende o produto inteiro por mais de dois minutos.
    // ⚠️ Não "uniformize" isto de volta para uma continuação só.
    const preparos = await sobContextoDaSessao(
      this.banco,
      requisicao,
      async (tx, sessao) =>
        await this.carnes.prepararRecorte(tx, sessao.empresaId, codigo, recorte),
    );

    // A composição corre FORA da unidade. A abertura vai por parâmetro porque a rebusca da CA-08
    // precisa ler o certificado da empresa — a única ida ao banco do caminho raro —, e ela nasce
    // aqui, na borda, sob a sessão: a única origem legítima do contexto de tenant (ADR-0008). É a
    // **mesma** abertura que a rota do boleto avulso passa, e não uma segunda forma de abri-la.
    const bytes = await this.carnes.compor(preparos, (trabalho) =>
      sobContextoDaSessao(this.banco, requisicao, trabalho),
    );

    // Os DOIS cabeçalhos são escritos **depois** de os bytes existirem, e a ordem é conteúdo: o
    // filtro global responde pela MESMA instância de `FastifyReply`, de modo que um `Content-Type:
    // application/pdf` definido antes da composição sobreviveria à recusa e o envelope de erro da
    // ADR-0017 sairia anunciando-se como PDF. Nesta rota o risco é maior que nas irmãs, porque as
    // recusas dela são **três** e uma delas (`503`) acontece depois de vários boletos já lidos.
    resposta.header(CABECALHO_DO_TIPO, TIPO_DE_MIDIA_DO_DOCUMENTO);
    resposta.header(
      CABECALHO_DA_DISPOSICAO,
      `attachment; filename="${nomeDoArquivoDoCarne(codigo, recorte.de, recorte.ate)}"`,
    );

    return bytes;
  }

  @Put(':codigo')
  @ApiOperation({
    summary: 'Altera um contrato em rascunho',
    description:
      'Aceito **somente enquanto `RASCUNHO`** (RD-05): sobre um contrato `ATIVO` ou `CANCELADO` a ' +
      'resposta é `422` com `campo: "status"` e `detalhes: { estadoAtual, transicaoPedida }`, e ' +
      'nada é gravado — mudar os termos de um contrato que já vale exige cancelar e montar outro. ' +
      'O corpo é **completo** e idêntico ao da montagem: não há atualização parcial, campo ausente ' +
      'é recusa por campo obrigatório, e `fiadoresIds` é **substituída por inteiro**, nunca ' +
      'mesclada. O `codigo` **não muda**, e a marca de circulação não é tocada por esta rota.',
  })
  @ApiOkResponse({
    description: 'O contrato como ele ficou.',
    schema: esquemaPublicado(esquemaDoContrato, 'output'),
  })
  @ApiUnauthorizedResponse({ schema: esquemaDoErro([CodigoErro.NAO_AUTENTICADO]) })
  @ApiForbiddenResponse({ schema: esquemaDoErro([CodigoErro.ACESSO_NEGADO]) })
  @ApiNotFoundResponse({ schema: esquemaDoErro([CodigoErro.RECURSO_NAO_ENCONTRADO]) })
  @ApiUnprocessableEntityResponse({ schema: esquemaDoErro([CodigoErro.CAMPO_INVALIDO]) })
  async alterar(
    @Param('codigo') identificador: string,
    @Body() corpo: unknown,
    @Req() requisicao: FastifyRequest,
  ): Promise<Contrato> {
    const codigo = validar(ESQUEMA_DO_CODIGO_DE_CONTRATO, identificador, CAMPO_DO_CODIGO);
    const entrada = validar(esquemaDeContratoNovo, corpo, CAMPO_DO_CORPO);

    return await sobContextoDaSessao(
      this.banco,
      requisicao,
      async (tx) => await this.contratos.alterar(tx, codigo, entrada),
    );
  }

  @Post(':codigo/ativacao')
  @HttpCode(200)
  // A conjunção INTEIRA — área **e** ação, nesta ordem —, e a ação é a de ATIVAR, não a de circulação.
  // Ver o cabeçalho deste arquivo e, por extenso, o marcador `DECISÃO FECHADA` de
  // `imoveis/conjunto.controller.ts`: declarar aqui apenas a ação SUBSTITUIRIA a exigência da classe,
  // e `TELA:contratos` sumiria desta rota em silêncio.
  @ExigeChaves(AREA_DOS_CONTRATOS, ACAO_DE_ATIVACAO)
  @ApiOperation({
    summary: 'Faz o contrato valer',
    description:
      'Transita `RASCUNHO → ATIVO` **num commit só** (ADR-0021): confere o estado e as condições ' +
      'de entrada, reconfere que imóvel, locador, locatário e fiadores continuam **em circulação** ' +
      '— a montagem pode ter sido há semanas —, deriva `dataFimLocacao` e `valorTotalContrato`, ' +
      'grava o contrato como `ATIVO` e marca o imóvel como `LOCADO`. Falha em qualquer etapa deixa ' +
      'o contrato `RASCUNHO` e o imóvel **exatamente como estava**. Sobre um contrato que não é ' +
      '`RASCUNHO` responde `422` com `campo: "status"` e `detalhes: { estadoAtual, transicaoPedida }`; ' +
      'sobre um imóvel que já tem contrato vigente, `422` com `campo: "imovelId"` e ' +
      '`detalhes: { conflito: "IMOVEL_COM_CONTRATO_VIGENTE", contratoVigente }` — é o código do ' +
      'vigente que diz ao usuário o que cancelar. Um imóvel `INDISPONIVEL` **é ativável**: a ' +
      'situação significa "não ofereça nas buscas", não "proibido de locar". O corpo é vazio e ' +
      'fechado — o estado nunca é escolhido pelo cliente. **A ativação gera as parcelas de aluguel ' +
      'do contrato na MESMA unidade de trabalho**: são `prazoMeses` cobranças de natureza `ALUGUEL`, ' +
      'com código próprio da série `COB-{ano}-{7 dígitos}`, competência no primeiro dia de cada mês ' +
      'e vencimento no `diaVencimento` — e a resposta traz o contrato acrescido de `efeitos`, com ' +
      '`cobrancasGeradas` igual a **quantas nasceram**. Um contrato com ' +
      '`gerarCobrancasAutomaticamente: false` gera **zero** e responde `cobrancasGeradas: 0`. Recusa ' +
      'em qualquer etapa deixa o contrato `RASCUNHO`, o imóvel como estava e **nenhuma** cobrança.',
  })
  @ApiOkResponse({
    description:
      'O contrato como ele ficou, mais a declaração de quantas cobranças a ativação gerou.',
    schema: esquemaPublicado(esquemaDaAtivacaoDeContrato, 'output'),
  })
  @ApiUnauthorizedResponse({ schema: esquemaDoErro([CodigoErro.NAO_AUTENTICADO]) })
  @ApiForbiddenResponse({ schema: esquemaDoErro([CodigoErro.ACESSO_NEGADO]) })
  @ApiNotFoundResponse({ schema: esquemaDoErro([CodigoErro.RECURSO_NAO_ENCONTRADO]) })
  @ApiUnprocessableEntityResponse({ schema: esquemaDoErro([CodigoErro.CAMPO_INVALIDO]) })
  async ativar(
    @Param('codigo') identificador: string,
    @Body() corpo: unknown,
    @Req() requisicao: FastifyRequest,
  ): Promise<AtivacaoDeContrato> {
    const codigo = validar(ESQUEMA_DO_CODIGO_DE_CONTRATO, identificador, CAMPO_DO_CODIGO);
    validar(ESQUEMA_DO_CORPO_VAZIO, corpo ?? {}, CAMPO_DO_CORPO);

    // PRIMEIRA unidade: ela **commita** antes de a segunda abrir, e é isso que impede o número da
    // cobrança de ser reusado por uma ativação abortada. O contador é o da COBRANÇA, e a garantia é a
    // do serviço dela — ver o cabeçalho deste arquivo. Não funda as duas.
    const ano = await sobContextoDaSessao(
      this.banco,
      requisicao,
      async (tx) => await this.cobrancas.garantirSerie(tx),
    );

    // SEGUNDA unidade: as três escritas da ativação — o estado do contrato, a situação do imóvel e as
    // N parcelas — commitam juntas ou não commitam. Ela abre depois de a primeira fechar, e por isso
    // não aninha. Ver o cabeçalho do serviço.
    return await sobContextoDaSessao(this.banco, requisicao, async (tx, sessao) => {
      const ativado = await this.contratos.ativar(tx, codigo, ano);

      this.logger.info(
        {
          empresaId: sessao.empresaId,
          entidade: ENTIDADE_DA_TRILHA,
          codigo: ativado.codigo,
          acao: 'ativacao',
          cobrancasGeradas: ativado.efeitos.cobrancasGeradas,
        },
        'contrato ativado',
      );

      return ativado;
    });
  }

  @Post(':codigo/cancelamento')
  @HttpCode(200)
  // A conjunção INTEIRA — área **e** ação, nesta ordem —, e a ação é a de CANCELAR: nem a de ativar,
  // que é a vizinha logo acima, nem a de circulação, que é a vizinha logo abaixo. Ver o cabeçalho
  // deste arquivo e, por extenso, o marcador `DECISÃO FECHADA` de `imoveis/conjunto.controller.ts`.
  @ExigeChaves(AREA_DOS_CONTRATOS, ACAO_DE_CANCELAMENTO)
  @ApiOperation({
    summary: 'Faz o contrato deixar de valer',
    description:
      'Transita `ATIVO → CANCELADO` **num commit só** (ADR-0021): confere o estado, grava o ' +
      'contrato como `CANCELADO`, devolve o imóvel a `DISPONIVEL`, liberando-o para um contrato ' +
      'novo, e **cancela em cascata as cobranças do contrato que ainda podem ser canceladas** — as ' +
      'que não foram pagas nem canceladas. As **pagas** e as **já canceladas** ficam exatamente ' +
      'como estavam: valor pago, instante do cancelamento e os carimbos de multa e juros **não são ' +
      'reescritos**. Um contrato sem cobrança alguma responde `200` do mesmo jeito — cascata sobre ' +
      'conjunto vazio não é erro. Falha em qualquer etapa deixa o contrato `ATIVO`, o imóvel ' +
      '**exatamente como estava** e **nenhuma** cobrança cancelada. ' +
      '**O contrato permanece na carteira** (ADR-0014): nada é apagado, ele continua ' +
      'listado e legível como histórico, e `dataFimLocacao` e `valorTotalContrato` **não são ' +
      'zerados** — eles descrevem o que o contrato foi enquanto valeu. Sobre um contrato que não é ' +
      '`ATIVO` responde `422` com `campo: "status"` e `detalhes: { estadoAtual, transicaoPedida }`: ' +
      'um rascunho abandonado se **retira de circulação**, não se cancela, e as duas operações têm ' +
      'efeitos distintos. A operação **não é idempotente por decisão** — repetir recebe `422` com ' +
      '`estadoAtual: "CANCELADO"`, porque o segundo pedido significa que quem o fez não sabia o ' +
      'estado. O corpo é vazio e fechado.',
  })
  @ApiOkResponse({
    description: 'O contrato como ele ficou, agora cancelado.',
    schema: esquemaPublicado(esquemaDoContrato, 'output'),
  })
  @ApiUnauthorizedResponse({ schema: esquemaDoErro([CodigoErro.NAO_AUTENTICADO]) })
  @ApiForbiddenResponse({ schema: esquemaDoErro([CodigoErro.ACESSO_NEGADO]) })
  @ApiNotFoundResponse({ schema: esquemaDoErro([CodigoErro.RECURSO_NAO_ENCONTRADO]) })
  @ApiUnprocessableEntityResponse({ schema: esquemaDoErro([CodigoErro.CAMPO_INVALIDO]) })
  async cancelar(
    @Param('codigo') identificador: string,
    @Body() corpo: unknown,
    @Req() requisicao: FastifyRequest,
  ): Promise<Contrato> {
    const codigo = validar(ESQUEMA_DO_CODIGO_DE_CONTRATO, identificador, CAMPO_DO_CODIGO);
    validar(ESQUEMA_DO_CORPO_VAZIO, corpo ?? {}, CAMPO_DO_CORPO);

    // UMA unidade de trabalho, aberta aqui: as TRÊS escritas do cancelamento — o estado do contrato, a
    // situação do imóvel e a cascata nas cobranças — commitam juntas ou não commitam. Ver o cabeçalho
    // do serviço.
    return await sobContextoDaSessao(this.banco, requisicao, async (tx, sessao) => {
      const { contrato: cancelado, cobrancasCanceladas } = await this.contratos.cancelar(
        tx,
        codigo,
      );

      // Os campos são os que a §13.1 da tech spec nomeia para este evento — `imovelId` entre eles,
      // porque é ele que diz **qual** imóvel voltou a ficar disponível. Nenhum valor monetário e
      // nenhum identificador de pessoa entram na linha.
      this.logger.info(
        {
          empresaId: sessao.empresaId,
          entidade: ENTIDADE_DA_TRILHA,
          codigo: cancelado.codigo,
          imovelId: cancelado.imovelId,
          acao: 'cancelamento',
        },
        'contrato cancelado',
      );

      // A SEGUNDA linha, e ela é evento próprio na §13.1 — não um campo a mais na de cima. Ela é
      // **sempre** emitida, inclusive com `quantidade: 0`: condicioná-la a haver cobrança faria a
      // ausência da linha significar tanto *"cascata de conjunto vazio"* quanto *"cascata não
      // executada"*, e a contagem é justamente o que separa as duas.
      //
      // O campo se chama `quantidade`, como a §13.1 o declara, e **não** `cobrancasCanceladas`: o
      // irmão da ativação usa `cobrancasGeradas` porque aquele nome é o do **efeito publicado**
      // (`efeitos.cobrancasGeradas`), e a linha espelha o contrato. Aqui não há efeito publicado — a
      // resposta é o contrato no root, por decisão registrada —, e um nome que sugerisse campo de
      // corpo anunciaria contrato que não existe.
      this.logger.info(
        {
          empresaId: sessao.empresaId,
          entidade: ENTIDADE_DA_TRILHA,
          codigo: cancelado.codigo,
          quantidade: cobrancasCanceladas,
        },
        'cobranças canceladas em cascata',
      );

      return cancelado;
    });
  }

  @Post(':codigo/retirada')
  @HttpCode(200)
  // A conjunção INTEIRA — área **e** ação, nesta ordem. Ver o cabeçalho deste arquivo e, por extenso,
  // o marcador `DECISÃO FECHADA` de `imoveis/conjunto.controller.ts`: declarar aqui apenas a ação
  // SUBSTITUIRIA a exigência da classe, e `TELA:contratos` sumiria desta rota em silêncio.
  @ExigeChaves(AREA_DOS_CONTRATOS, ACAO_DE_CIRCULACAO)
  @ApiOperation({
    summary: 'Retira o contrato de circulação',
    description:
      '**Nada é apagado** (ADR-0014): o contrato some das listagens e continua legível por quem já ' +
      'o referencia. A retirada é de **visibilidade** — ela alcança qualquer estado, **não muda o ' +
      'estado** e **não libera o imóvel**: um contrato ativo retirado continua vigente, e é isso ' +
      'que impede a retirada de virar porta lateral para destravar o imóvel sem cancelar o ' +
      'contrato. A operação é **idempotente**: repetir mantém a MESMA marca e responde `200`. O ' +
      'corpo é vazio e fechado.',
  })
  @ApiOkResponse({
    description: 'O contrato, agora com a marca de retirada.',
    schema: esquemaPublicado(esquemaDoContrato, 'output'),
  })
  @ApiUnauthorizedResponse({ schema: esquemaDoErro([CodigoErro.NAO_AUTENTICADO]) })
  @ApiForbiddenResponse({ schema: esquemaDoErro([CodigoErro.ACESSO_NEGADO]) })
  @ApiNotFoundResponse({ schema: esquemaDoErro([CodigoErro.RECURSO_NAO_ENCONTRADO]) })
  @ApiUnprocessableEntityResponse({ schema: esquemaDoErro([CodigoErro.CAMPO_INVALIDO]) })
  async retirar(
    @Param('codigo') identificador: string,
    @Body() corpo: unknown,
    @Req() requisicao: FastifyRequest,
  ): Promise<Contrato> {
    return await this.definirCirculacao(identificador, corpo, requisicao, false);
  }

  @Post(':codigo/recirculacao')
  @HttpCode(200)
  // A MESMA conjunção da retirada, e pela mesma razão. As duas rotas movem a mesma coluna em sentidos
  // opostos; exigir coisas diferentes delas seria abrir um caminho para desfazer o que a outra exige.
  @ExigeChaves(AREA_DOS_CONTRATOS, ACAO_DE_CIRCULACAO)
  @ApiOperation({
    summary: 'Devolve o contrato à circulação',
    description:
      'Zera a marca de retirada, sem tocar o estado. É o que torna a retirada reversível — e é por ' +
      'ela existir que `GET /v1/contratos/:codigo` alcança o contrato retirado. O corpo é vazio e ' +
      'fechado.',
  })
  @ApiOkResponse({
    description: 'O contrato, de volta à circulação.',
    schema: esquemaPublicado(esquemaDoContrato, 'output'),
  })
  @ApiUnauthorizedResponse({ schema: esquemaDoErro([CodigoErro.NAO_AUTENTICADO]) })
  @ApiForbiddenResponse({ schema: esquemaDoErro([CodigoErro.ACESSO_NEGADO]) })
  @ApiNotFoundResponse({ schema: esquemaDoErro([CodigoErro.RECURSO_NAO_ENCONTRADO]) })
  @ApiUnprocessableEntityResponse({ schema: esquemaDoErro([CodigoErro.CAMPO_INVALIDO]) })
  async recircular(
    @Param('codigo') identificador: string,
    @Body() corpo: unknown,
    @Req() requisicao: FastifyRequest,
  ): Promise<Contrato> {
    return await this.definirCirculacao(identificador, corpo, requisicao, true);
  }

  /**
   * As duas rotas de circulação, num ponto só — elas diferem em **um** valor.
   *
   * Escrever as duas por extenso deixaria livres para divergir a validação do código, a do corpo
   * fechado e a linha de trilha; e o que separa retirar de recircular é o sentido, que é justamente o
   * argumento.
   */
  private async definirCirculacao(
    identificador: string,
    corpo: unknown,
    requisicao: FastifyRequest,
    emCirculacao: boolean,
  ): Promise<Contrato> {
    const codigo = validar(ESQUEMA_DO_CODIGO_DE_CONTRATO, identificador, CAMPO_DO_CODIGO);
    validar(ESQUEMA_DO_CORPO_VAZIO, corpo ?? {}, CAMPO_DO_CORPO);

    return await sobContextoDaSessao(this.banco, requisicao, async (tx, sessao) => {
      const contrato = await this.contratos.definirCirculacao(tx, codigo, emCirculacao);

      this.logger.info(
        {
          empresaId: sessao.empresaId,
          entidade: ENTIDADE_DA_TRILHA,
          codigo: contrato.codigo,
          acao: emCirculacao ? 'recirculacao' : 'retirada',
        },
        'circulação de cadastro alterada',
      );

      return contrato;
    });
  }
}
